import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/lib/auth/auth'
import { NextRequest, NextResponse } from 'next/server'

export type AuthResult =
  | { ok: true; session: NonNullable<Awaited<ReturnType<typeof getServerSession>>> }
  | { ok: false; response: NextResponse }

/**
 * Verify the caller has a valid NextAuth session.
 * Returns the session on success, or a 401 response on failure.
 *
 * Usage:
 *   const auth = await requireAuth(request)
 *   if (!auth.ok) return auth.response
 *   const { session } = auth
 */
export async function requireAuth(request: NextRequest): Promise<AuthResult> {
  const session = await getServerSession(authOptions)
  if (!session) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized — please log in' }, { status: 401 }),
    }
  }
  return { ok: true, session }
}

/**
 * Verify the caller has a session AND one of the allowed roles.
 */
export async function requireRole(request: NextRequest, allowedRoles: string[]): Promise<AuthResult> {
  const auth = await requireAuth(request)
  if (!auth.ok) return auth

  const role = (auth.session as any).user?.role || ''
  if (!allowedRoles.includes(role)) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Forbidden — insufficient permissions' }, { status: 403 }),
    }
  }
  return auth
}
