import bcrypt from 'bcryptjs'
import { stripRecoverySecrets } from '@/app/lib/auth/recoveryQuestions'

/**
 * Waiter PINs for the shared POS terminal. The terminal stays signed in as the cashier; a waiter
 * switches in by tapping their name and typing a short PIN, so every order records who took it.
 *
 * Stored on the user's `preferences` JSON (hashed, never readable) under the keys below. The
 * general user PATCH strips these keys so a PIN can only be set through /api/users/[id]/pos-pin.
 */
export const POS_PIN_KEYS = ['posPinHash', 'posPinFailures', 'posPinLockedUntil'] as const

const MAX_FAILURES = 5
const LOCK_MINUTES = 5

export type PinLength = { minLength: number; maxLength: number }

export const DEFAULT_PIN_LENGTH: PinLength = { minLength: 4, maxLength: 6 }

/** Digits only, within the hotel's saved PIN length. */
export function pinLengthError(pin: string, rule: PinLength = DEFAULT_PIN_LENGTH): string | null {
  const min = rule.minLength
  const max = rule.maxLength
  if (!/^\d+$/.test(pin) || pin.length < min || pin.length > max) {
    return min === max ? `The PIN must be ${min} digits.` : `The PIN must be ${min} to ${max} digits.`
  }
  return null
}

export function isValidPin(pin: unknown, rule: PinLength = DEFAULT_PIN_LENGTH): pin is string {
  return typeof pin === 'string' && pinLengthError(pin, rule) === null
}

export async function hashPin(pin: string): Promise<string> {
  return bcrypt.hash(pin, 10)
}

type Prefs = Record<string, unknown>

export function hasPin(prefs: unknown): boolean {
  return typeof (prefs as Prefs | null)?.posPinHash === 'string'
}

export function withoutPinKeys(prefs: Prefs): Prefs {
  const copy = { ...prefs }
  for (const key of POS_PIN_KEYS) delete copy[key]
  return copy
}

/**
 * A user as it may leave the server: secrets kept in `preferences` (the POS PIN hash and the
 * two-factor authenticator key) are removed, and `hasPin` says whether a POS PIN is set.
 */
export function publicUser<T extends { preferences?: unknown }>(user: T): T & { hasPin: boolean } {
  const prefs = user.preferences && typeof user.preferences === 'object' ? (user.preferences as Prefs) : null
  if (!prefs) return { ...user, hasPin: false }
  const safe = stripRecoverySecrets(withoutPinKeys(prefs))
  delete safe.twoFactorSecret
  return { ...user, preferences: safe, hasPin: hasPin(prefs) }
}

export type PinCheck =
  | { ok: true; prefs: Prefs }
  | { ok: false; reason: 'no-pin' | 'locked' | 'wrong'; prefs: Prefs; retryAfterMinutes?: number }

/**
 * Checks a PIN and returns the preferences to save back (failure count / lockout updated).
 * Five wrong tries lock that person's PIN for five minutes.
 */
export async function checkPin(prefsRaw: unknown, pin: string, now = new Date()): Promise<PinCheck> {
  const prefs: Prefs = prefsRaw && typeof prefsRaw === 'object' ? { ...(prefsRaw as Prefs) } : {}
  const hash = typeof prefs.posPinHash === 'string' ? prefs.posPinHash : ''
  if (!hash) return { ok: false, reason: 'no-pin', prefs }

  const lockedUntil = typeof prefs.posPinLockedUntil === 'string' ? new Date(prefs.posPinLockedUntil) : null
  if (lockedUntil && lockedUntil > now) {
    return { ok: false, reason: 'locked', prefs, retryAfterMinutes: Math.ceil((lockedUntil.getTime() - now.getTime()) / 60000) }
  }

  if (await bcrypt.compare(pin, hash)) {
    delete prefs.posPinFailures
    delete prefs.posPinLockedUntil
    return { ok: true, prefs }
  }

  const failures = (typeof prefs.posPinFailures === 'number' ? prefs.posPinFailures : 0) + 1
  if (failures >= MAX_FAILURES) {
    delete prefs.posPinFailures
    prefs.posPinLockedUntil = new Date(now.getTime() + LOCK_MINUTES * 60000).toISOString()
    return { ok: false, reason: 'locked', prefs, retryAfterMinutes: LOCK_MINUTES }
  }
  prefs.posPinFailures = failures
  delete prefs.posPinLockedUntil
  return { ok: false, reason: 'wrong', prefs }
}
