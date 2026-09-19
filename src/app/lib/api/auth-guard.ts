import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/lib/auth/auth'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/app/lib/database/client'
import { ensureDefaultRolesForTenant, permissionGrants } from '@/app/lib/settings/roleRepository'

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

/**
 * Verify the caller has a session AND their role grants a specific permission
 * string from the catalog in src/app/lib/settings/permissionCatalog.ts (e.g.
 * 'frontdesk.void-charge', 'accounting.void-transaction'). Roles live in the
 * `Role` table, keyed by (tenantId, code) where `code` is the same slug
 * already carried on session.user.role — self-healed via
 * ensureDefaultRolesForTenant so a tenant that's never touched Role
 * Management still resolves the four defaults instead of failing closed.
 */
export async function requirePermission(request: NextRequest, permissionId: string): Promise<AuthResult> {
  return requireAnyPermission(request, [permissionId])
}

/**
 * Like requirePermission, but succeeds if the caller's role grants ANY of the
 * given permission ids — e.g. saving a checkpoint location typed fresh while
 * starting a patrol should work for someone who can run patrols even if they
 * don't separately hold the narrower "manage checkpoint locations" permission.
 */
export async function requireAnyPermission(request: NextRequest, permissionIds: string[]): Promise<AuthResult> {
  const auth = await requireAuth(request)
  if (!auth.ok) return auth

  const user = (auth.session as any).user
  const tenantId: string | undefined = user?.tenantId
  const roleCode: string | undefined = user?.role
  const forbidden = () => ({
    ok: false as const,
    response: NextResponse.json({ error: 'Forbidden — insufficient permissions' }, { status: 403 }),
  })
  if (!tenantId || !roleCode) return forbidden()

  await ensureDefaultRolesForTenant(tenantId)
  const role = await prisma.role.findUnique({ where: { tenantId_code: { tenantId, code: roleCode } } })
  if (!role || !role.isActive) return forbidden()

  const permissions = Array.isArray(role.permissions) ? (role.permissions as unknown[]).filter((p): p is string => typeof p === 'string') : []
  const granted = permissionIds.some((permissionId) => permissions.some((p) => permissionGrants(p, permissionId)))
  if (!granted) return forbidden()

  return auth
}

/**
 * True if some OTHER active user in the tenant holds a role that grants `permissionId`.
 * Used for separation-of-duties rules (e.g. whoever processed payroll can't also approve it)
 * that must not lock a one-person setup out of the action entirely.
 */
export async function anotherUserHoldsPermission(tenantId: string, excludeUserId: string | undefined, permissionId: string): Promise<boolean> {
  await ensureDefaultRolesForTenant(tenantId)
  const roles = await prisma.role.findMany({ where: { tenantId, isActive: true } })
  const codes = roles
    .filter((r) => (Array.isArray(r.permissions) ? (r.permissions as unknown[]) : []).some((p) => typeof p === 'string' && permissionGrants(p, permissionId)))
    .map((r) => r.code)
  if (codes.length === 0) return false
  const others = await prisma.user.count({
    where: { tenantId, isActive: true, role: { in: codes }, ...(excludeUserId ? { id: { not: excludeUserId } } : {}) },
  })
  return others > 0
}
