import { NextRequest, NextResponse } from 'next/server'
import { getTenantFromRequest, getTenantContext, createAuditLog } from '@/app/lib/api/tenant'
import { requireAuth, requirePermission } from '@/app/lib/api/auth-guard'
import { prisma } from '@/app/lib/database/client'

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
