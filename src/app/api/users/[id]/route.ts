import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { getTenantFromRequest, getTenantContext, createAuditLog } from '@/app/lib/api/tenant'
import { requireAuth, requirePermission, requireAnyPermission } from '@/app/lib/api/auth-guard'
import { prisma } from '@/app/lib/database/client'

const USER_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  isActive: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
} as const

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth(request)
    if (!auth.ok) return auth.response
    const subdomain = getTenantFromRequest(request)
    if (!subdomain) return NextResponse.json({ error: 'Missing tenant header' }, { status: 400 })
    const ctx = await getTenantContext(subdomain)
    if (!ctx) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

    const { id } = await params
    const target = await prisma.user.findFirst({ where: { id, tenantId: ctx.tenantId } })
    if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    const body = await request.json()

    // Gated per field rather than one blanket permission: activating/deactivating
    // and resetting a password are each independently grantable
    // (settings.toggle-user-status / settings.reset-password), separate from
    // general profile editing (settings.edit) — a role can have one without the
    // others.
    const changingProfile = ['email', 'name', 'role'].some((k) => typeof body[k] === 'string' && body[k].trim())
    if (changingProfile) {
      const perm = await requirePermission(request, 'settings.edit')
      if (!perm.ok) return perm.response
    }
    if (typeof body.isActive === 'boolean') {
      const perm = await requireAnyPermission(request, ['settings.edit', 'settings.toggle-user-status'])
      if (!perm.ok) return perm.response
    }
    if (typeof body.password === 'string' && body.password) {
      const perm = await requireAnyPermission(request, ['settings.edit', 'settings.reset-password'])
      if (!perm.ok) return perm.response
    }

    const data: Record<string, unknown> = {}
    if (typeof body.email === 'string' && body.email.trim()) data.email = body.email.trim().toLowerCase()
    if (typeof body.name === 'string' && body.name.trim()) data.name = body.name.trim()
    if (typeof body.role === 'string' && body.role.trim()) data.role = body.role.trim()
    if (typeof body.isActive === 'boolean') data.isActive = body.isActive
    if (typeof body.password === 'string' && body.password) {
      if (body.password.length < 6) {
        return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })
      }
      data.password = await bcrypt.hash(body.password, 10)
    }

    // Reassigning away from 'admin' or deactivating could strip the tenant's
    // last administrator of access — same protection DELETE already has.
    const losesAdmin =
      target.role === 'admin' &&
      ((typeof data.role === 'string' && data.role !== 'admin') || data.isActive === false)
    if (losesAdmin) {
      const otherAdmins = await prisma.user.count({
        where: { tenantId: ctx.tenantId, role: 'admin', isActive: true, id: { not: id } },
      })
      if (otherAdmins === 0) {
        return NextResponse.json({ error: 'Cannot remove admin access from the last active administrator' }, { status: 400 })
      }
    }

    const user = await prisma.user
      .update({ where: { id }, data, select: USER_SELECT })
      .catch((e: any) => {
        if (e?.code === 'P2002') return null
        throw e
      })
    if (!user) return NextResponse.json({ error: 'A user with this email already exists' }, { status: 409 })

    const sessionUserId = (auth.session as any).user?.id
    await createAuditLog(ctx.tenantId, sessionUserId ?? null, 'USER_UPDATED', 'User', id, undefined, { email: user.email, role: user.role, isActive: user.isActive }, request)
    return NextResponse.json({ user })
  } catch (error) {
    console.error('[users/:id][PATCH] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth(request)
    if (!auth.ok) return auth.response
    const perm = await requirePermission(request, 'settings.delete')
    if (!perm.ok) return perm.response
    const subdomain = getTenantFromRequest(request)
    if (!subdomain) return NextResponse.json({ error: 'Missing tenant header' }, { status: 400 })
    const ctx = await getTenantContext(subdomain)
    if (!ctx) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

    const { id } = await params
    const target = await prisma.user.findFirst({ where: { id, tenantId: ctx.tenantId } })
    if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    const sessionUserId = (auth.session as any).user?.id
    if (sessionUserId && sessionUserId === id) {
      return NextResponse.json({ error: "You can't delete your own account" }, { status: 400 })
    }

    if (target.role === 'admin') {
      const otherAdmins = await prisma.user.count({
        where: { tenantId: ctx.tenantId, role: 'admin', isActive: true, id: { not: id } },
      })
      if (otherAdmins === 0) {
        return NextResponse.json({ error: 'Cannot delete the last active administrator' }, { status: 400 })
      }
    }

    await prisma.user.delete({ where: { id } })
    await createAuditLog(ctx.tenantId, sessionUserId ?? null, 'USER_DELETED', 'User', id, undefined, { email: target.email, role: target.role }, request)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[users/:id][DELETE] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
