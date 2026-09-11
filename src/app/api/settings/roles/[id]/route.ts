import { NextRequest, NextResponse } from 'next/server'
import { getTenantFromRequest, getTenantContext } from '@/app/lib/api/tenant'
import { requireAuth, requirePermission } from '@/app/lib/api/auth-guard'
import { prisma } from '@/app/lib/database/client'

// `id` here is the role's `code` (the client-side UserRole.id, e.g. 'admin'
// or a generated 'role_<timestamp>') — the same slug used everywhere else
// this Role is looked up, not the DB row's own cuid.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth(request)
    if (!auth.ok) return auth.response
    const subdomain = getTenantFromRequest(request)
    if (!subdomain) return NextResponse.json({ error: 'Missing tenant header' }, { status: 400 })
    const ctx = await getTenantContext(subdomain)
    if (!ctx) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

    const { id: code } = await params
    const body = await request.json()
    const data: Record<string, unknown> = {}
    if (typeof body.name === 'string') data.name = body.name
    if (typeof body.description === 'string' || body.description === null) data.description = body.description
    if (Array.isArray(body.permissions)) data.permissions = body.permissions
    if (typeof body.isActive === 'boolean') data.isActive = body.isActive

    const role = await prisma.role.update({
      where: { tenantId_code: { tenantId: ctx.tenantId, code } },
      data,
    }).catch(() => null)
    if (!role) return NextResponse.json({ error: 'Role not found' }, { status: 404 })
    return NextResponse.json({ role })
  } catch (error) {
    console.error('[settings/roles/:id][PATCH] error', error)
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

    const { id: code } = await params

    // A role in active use is load-bearing for those users' own auth checks —
    // deleting it out from under them would leave requirePermission() unable
    // to resolve anything for them at all, denying every action instead of
    // just the ones they shouldn't have.
    const usersWithRole = await prisma.user.count({ where: { tenantId: ctx.tenantId, role: code } })
    if (usersWithRole > 0) {
      return NextResponse.json(
        { error: `${usersWithRole} user(s) still have this role assigned — reassign them first` },
        { status: 400 },
      )
    }

    const role = await prisma.role.delete({
      where: { tenantId_code: { tenantId: ctx.tenantId, code } },
    }).catch(() => null)
    if (!role) return NextResponse.json({ error: 'Role not found' }, { status: 404 })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[settings/roles/:id][DELETE] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
