import { NextRequest, NextResponse } from 'next/server'
import { getTenantFromRequest, getTenantContext, createAuditLog } from '@/app/lib/api/tenant'
import { listReservations, createReservationRow, isRoomAvailable } from '@/app/lib/frontoffice/repository'

export async function GET(request: NextRequest) {
  try {
    const subdomain = getTenantFromRequest(request)
    if (!subdomain) return NextResponse.json({ error: 'Missing tenant header' }, { status: 400 })
    const ctx = await getTenantContext(subdomain)
    if (!ctx) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

    const reservations = await listReservations(ctx.tenantId)
    return NextResponse.json({ reservations })
  } catch (error) {
    console.error('[reservations][GET] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const subdomain = getTenantFromRequest(request)
    if (!subdomain) return NextResponse.json({ error: 'Missing tenant header' }, { status: 400 })
    const ctx = await getTenantContext(subdomain)
    if (!ctx) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

    const body = await request.json()
    if (!body.guestId) return NextResponse.json({ error: 'guestId is required' }, { status: 400 })
    if (!body.arrival || !body.departure) {
      return NextResponse.json({ error: 'arrival and departure are required' }, { status: 400 })
    }

    // Double-booking guard when a specific room is requested
    if (body.roomId) {
      const available = await isRoomAvailable(ctx.tenantId, body.roomId, body.arrival, body.departure)
      if (!available) {
        return NextResponse.json({ error: 'Room is not available for the selected dates' }, { status: 409 })
      }
    }

    const reservation = await createReservationRow(ctx.tenantId, body.guestId, body)
    await createAuditLog(ctx.tenantId, null, 'RESERVATION_CREATED', 'Reservation', reservation.id, undefined, { status: reservation.status, roomId: reservation.roomId }, request)
    return NextResponse.json({ reservation }, { status: 201 })
  } catch (error) {
    console.error('[reservations][POST] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
