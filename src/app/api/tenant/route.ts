import { NextRequest, NextResponse } from 'next/server'
import { getTenantFromRequest, getTenantContext } from '@/app/lib/api/tenant'
import { prisma } from '@/app/lib/database/client'

/**
 * GET /api/tenant
 * Returns tenant display name and active staff list (for POS waiter select).
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

    // Pull active users as staff (all roles — POS lets manager choose who is serving)
    const users = await prisma.user.findMany({
      where: { tenantId: ctx.tenantId, isActive: true },
      select: { id: true, name: true, role: true },
      orderBy: { name: 'asc' },
    })

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
      staff: users.map(u => ({ id: u.id, name: u.name, role: u.role })),
    })
  } catch (error) {
    console.error('[/api/tenant][GET] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
