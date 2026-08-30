import { NextRequest, NextResponse } from 'next/server'
import { getTenantFromRequest, getTenantContext, createAuditLog } from '@/app/lib/api/tenant'
import { listTableReservations, upsertTableReservation, deleteTableReservation } from '@/app/lib/fb/tablesRepository'

async function resolveTenant(req: NextRequest) {
  const subdomain = getTenantFromRequest(req)
  if (!subdomain) return null
  return getTenantContext(subdomain)
}

export async function GET(request: NextRequest) {
  try {
    const ctx = await resolveTenant(request)
    if (!ctx) return NextResponse.json({ error: 'Missing or unknown tenant' }, { status: 400 })
    const reservations = await listTableReservations(ctx.tenantId)
    return NextResponse.json({ reservations })
  } catch (error) {
    console.error('[fb/reservations][GET] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await resolveTenant(request)
    if (!ctx) return NextResponse.json({ error: 'Missing or unknown tenant' }, { status: 400 })
    const body = await request.json()
    if (!body.id) return NextResponse.json({ error: 'id is required' }, { status: 400 })
    const reservation = await upsertTableReservation(ctx.tenantId, body.id, body)
    await createAuditLog(ctx.tenantId, null, 'TABLE_RESERVATION_SAVED', 'TableReservation', body.id, undefined, { customerName: reservation.customerName, status: reservation.status }, request)
    return NextResponse.json({ reservation })
  } catch (error) {
    console.error('[fb/reservations][POST] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const ctx = await resolveTenant(request)
    if (!ctx) return NextResponse.json({ error: 'Missing or unknown tenant' }, { status: 400 })
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Missing required parameter: id' }, { status: 400 })
    const ok = await deleteTableReservation(ctx.tenantId, id)
    if (!ok) return NextResponse.json({ error: 'Reservation not found' }, { status: 404 })
    await createAuditLog(ctx.tenantId, null, 'TABLE_RESERVATION_DELETED', 'TableReservation', id, undefined, undefined, request)
    return NextResponse.json({ message: 'Deleted' })
  } catch (error) {
    console.error('[fb/reservations][DELETE] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
