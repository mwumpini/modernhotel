import crypto from 'crypto'

export function newSyncToken(): string {
  return crypto.randomBytes(32).toString('hex')
}

export function hashSyncToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

export function readTokenHash(metadata: unknown): string {
  if (!metadata || typeof metadata !== 'object') return ''
  const value = (metadata as Record<string, unknown>).syncTokenHash
  return typeof value === 'string' ? value : ''
}
