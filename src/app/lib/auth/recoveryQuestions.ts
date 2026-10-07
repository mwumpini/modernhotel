import bcrypt from 'bcryptjs';
import { normalizeRecoveryAnswer, recoveryQuestionText } from '@/app/lib/auth/recoveryQuestionList';

export { RECOVERY_QUESTIONS, normalizeRecoveryAnswer, recoveryFallbackMessage, recoveryQuestionText } from '@/app/lib/auth/recoveryQuestionList';

export const RECOVERY_SECRET_KEYS = ['recoveryQuestions', 'recoveryFails'] as const;
export const MAX_RECOVERY_FAILS = 5;

export type StoredRecoveryQuestion = { id: string; answerHash: string };

export function readRecoveryQuestions(prefs: unknown): StoredRecoveryQuestion[] {
  const raw = prefs && typeof prefs === 'object' ? (prefs as Record<string, unknown>).recoveryQuestions : null;
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const id = String((item as { id?: unknown }).id || '');
    const answerHash = String((item as { answerHash?: unknown }).answerHash || '');
    if (!recoveryQuestionText(id) || !answerHash) return [];
    return [{ id, answerHash }];
  });
}

export function recoveryFailCount(prefs: unknown): number {
  const count = prefs && typeof prefs === 'object' ? (prefs as Record<string, unknown>).recoveryFails : 0;
  return typeof count === 'number' && count > 0 ? Math.trunc(count) : 0;
}

export function recoveryLocked(prefs: unknown): boolean {
  return recoveryFailCount(prefs) >= MAX_RECOVERY_FAILS;
}

export function publicRecoveryQuestions(prefs: unknown): { id: string; text: string }[] {
  return readRecoveryQuestions(prefs).flatMap((item) => {
    const text = recoveryQuestionText(item.id);
    return text ? [{ id: item.id, text }] : [];
  });
}

export function stripRecoverySecrets(prefs: Record<string, unknown>): Record<string, unknown> {
  const copy = { ...prefs };
  for (const key of RECOVERY_SECRET_KEYS) delete copy[key];
  return copy;
}

export async function hashRecoveryAnswers(pairs: { id: string; answer: string }[]): Promise<StoredRecoveryQuestion[]> {
  const stored: StoredRecoveryQuestion[] = [];
  for (const pair of pairs) {
    stored.push({ id: pair.id, answerHash: await bcrypt.hash(normalizeRecoveryAnswer(pair.answer), 10) });
  }
  return stored;
}

/** Both stored questions must be answered. A miss still checks every hash. */
export async function recoveryAnswersMatch(stored: StoredRecoveryQuestion[], given: { id: string; answer: string }[]): Promise<boolean> {
  if (stored.length < 2) return false;
  const byId = new Map(given.map((item) => [item.id, normalizeRecoveryAnswer(item.answer)]));
  let ok = stored.length === given.length;
  for (const item of stored) {
    const answer = byId.get(item.id) ?? '';
    const match = answer.length > 0 && await bcrypt.compare(answer, item.answerHash);
    if (!match) ok = false;
  }
  return ok;
}
