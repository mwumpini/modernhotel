import { prisma } from '@/app/lib/database/client'

/**
 * Sign-in name rules. No "@" — that is how the login box tells a username from
 * an email. Stored lowercase so "Kofi.M" and "kofi.m" are the same person.
 */
const USERNAME_PATTERN = /^[a-z0-9][a-z0-9._-]{2,31}$/

export function normalizeUsername(value: unknown): string {
  return String(value ?? '').trim().toLowerCase()
}

/** Null when the username is acceptable (an empty one means "no username"). */
export function usernameError(username: string): string | null {
  if (!username) return null
  if (!USERNAME_PATTERN.test(username)) {
    return 'Username must be 3–32 characters: letters, numbers, dot, dash or underscore, starting with a letter or number.'
  }
  return null
}

/** One username per hotel. The database has no unique index for it, so every write checks here. */
export async function usernameTaken(tenantId: string, username: string, exceptUserId?: string): Promise<boolean> {
  if (!username) return false
  const clash = await prisma.user.findFirst({
    where: { tenantId, username, ...(exceptUserId ? { id: { not: exceptUserId } } : {}) },
    select: { id: true },
  })
  return Boolean(clash)
}

/** The account a sign-in name points at: an email when it contains "@", otherwise a username. */
export async function findUserForLogin(tenantId: string, login: unknown) {
  const value = String(login ?? '').trim().toLowerCase()
  if (!value) return null
  if (value.includes('@')) {
    return prisma.user.findUnique({ where: { tenantId_email: { tenantId, email: value } } })
  }
  return prisma.user.findFirst({ where: { tenantId, username: value }, orderBy: { createdAt: 'asc' } })
}
