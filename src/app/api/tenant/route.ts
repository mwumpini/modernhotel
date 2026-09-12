import { NextRequest, NextResponse } from 'next/server'
import { getTenantFromRequest, getTenantContext } from '@/app/lib/api/tenant'
import { prisma } from '@/app/lib/database/client'
import { ensureDefaultRolesForTenant, roleGrantsModule } from '@/app/lib/settings/roleRepository'

/**
 * GET /api/tenant
 * Returns tenant display name and active staff list (for POS waiter select,
 * and — filtered via ?module=<prefix> — for pickers like Kitchen's "assign
 * cook" that should only offer staff whose role actually grants that module).
 */
export async function GET(request: NextRequest) {
  try {
    const subdomain = getTenantFromRequest(request)
    if (!subdomain) return NextResponse.json({ error: 'Missing tenant header' }, { status: 400 })
    const ctx = await getTenantContext(subdomain)
    if (!ctx) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

    // Pull tenant name
    const tenant = await prisma.tenant.findUnique({
      where: { id: ctx.tenantId },
      select: { name: true },
    })

    // Pull active users as staff (all roles by default — POS lets manager choose who is serving)
    const users = await prisma.user.findMany({
      where: { tenantId: ctx.tenantId, isActive: true },
      select: { id: true, name: true, role: true },
      orderBy: { name: 'asc' },
    })

    const modulePrefix = request.nextUrl.searchParams.get('module')
    let scopedUsers = users
    if (modulePrefix) {
      await ensureDefaultRolesForTenant(ctx.tenantId)
      const roles = await prisma.role.findMany({ where: { tenantId: ctx.tenantId }, select: { code: true, permissions: true } })
      const permissionsByCode = new Map(roles.map((r) => [r.code, (Array.isArray(r.permissions) ? r.permissions : []) as string[]]))
      scopedUsers = users.filter((u) => roleGrantsModule(permissionsByCode.get(u.role) ?? [], modulePrefix))
    }

    // Try to get hotel name from SystemSettings if available
    let hotelName = tenant?.name ?? 'Hotel'
    try {
      const settings = await prisma.systemSettings.findUnique({
        where: { tenantId: ctx.tenantId },
        select: { hotelSettings: true },
      })
      if (settings?.hotelSettings) {
        const hs = settings.hotelSettings as any
        if (hs?.propertyName) hotelName = hs.propertyName
        else if (hs?.hotelName) hotelName = hs.hotelName
      }
    } catch { /* use tenant name fallback */ }

    return NextResponse.json({
      hotelName,
      staff: scopedUsers.map(u => ({ id: u.id, name: u.name, role: u.role })),
    })
  } catch (error) {
    console.error('[/api/tenant][GET] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
