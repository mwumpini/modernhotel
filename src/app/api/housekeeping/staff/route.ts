import { NextRequest, NextResponse } from 'next/server'
import { getTenantFromRequest, getTenantContext, createAuditLog } from '@/app/lib/api/tenant'
import { requireAuth } from '@/app/lib/api/auth-guard'
import { prisma } from '@/app/lib/database/client'

async function resolveTenant(req: NextRequest) {
  const subdomain = getTenantFromRequest(req)
  if (!subdomain) return null
  return getTenantContext(subdomain)
}

export async function GET(request: NextRequest) {
  try {
    const ctx = await resolveTenant(request)
    if (!ctx) return NextResponse.json({ error: 'Missing or unknown tenant' }, { status: 400 })
    const staff = await prisma.housekeepingStaff.findMany({
      where: { tenantId: ctx.tenantId },
      orderBy: { name: 'asc' },
    })
    return NextResponse.json({ staff })
  } catch (error) {
    console.error('[housekeeping/staff][GET] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (!auth.ok) return auth.response
    const ctx = await resolveTenant(request)
    if (!ctx) return NextResponse.json({ error: 'Missing or unknown tenant' }, { status: 400 })
    const body = await request.json()
    if (!body.id) return NextResponse.json({ error: 'id is required' }, { status: 400 })
    if (!body.name || !body.role) return NextResponse.json({ error: 'name and role are required' }, { status: 400 })

    const existing = await prisma.housekeepingStaff.findUnique({ where: { id: body.id } })
    if (existing && existing.tenantId !== ctx.tenantId) {
      return NextResponse.json({ error: 'Record belongs to a different tenant' }, { status: 403 })
    }

    const data = {
      name: body.name,
      role: body.role,
      isActive: body.isActive ?? true,
      dailyTarget: body.dailyTarget ?? 0,
      completedToday: body.completedToday ?? 0,
      shift: body.shift || undefined,
      phone: body.phone || undefined,
      notes: body.notes || undefined,
    }

    const staff = existing
      ? await prisma.housekeepingStaff.update({ where: { id: body.id }, data })
      : await prisma.housekeepingStaff.create({ data: { id: body.id, tenantId: ctx.tenantId, ...data } })

    const sessionUserId = (auth.session as any).user?.id
    await createAuditLog(ctx.tenantId, sessionUserId ?? null, 'HOUSEKEEPING_STAFF_SAVED', 'HousekeepingStaff', staff.id, undefined, { name: staff.name, role: staff.role }, request)
    return NextResponse.json({ staff })
  } catch (error) {
    console.error('[housekeeping/staff][POST] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (!auth.ok) return auth.response
    const ctx = await resolveTenant(request)
    if (!ctx) return NextResponse.json({ error: 'Missing or unknown tenant' }, { status: 400 })
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })
    const existing = await prisma.housekeepingStaff.findFirst({ where: { id, tenantId: ctx.tenantId } })
    if (!existing) return NextResponse.json({ error: 'Staff member not found' }, { status: 404 })
    // Soft-delete: past tasks may reference this staff member's id in assignedTo.
    await prisma.housekeepingStaff.update({ where: { id }, data: { isActive: false } })
    const sessionUserId = (auth.session as any).user?.id
    await createAuditLog(ctx.tenantId, sessionUserId ?? null, 'HOUSEKEEPING_STAFF_DEACTIVATED', 'HousekeepingStaff', id, undefined, undefined, request)
    return NextResponse.json({ message: 'Deactivated' })
  } catch (error) {
    console.error('[housekeeping/staff][DELETE] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
