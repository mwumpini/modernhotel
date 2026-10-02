import { NextRequest, NextResponse } from 'next/server'
import { getTenantFromRequest, getTenantContext, createAuditLog } from '@/app/lib/api/tenant'
import { requireAuth, requirePermission } from '@/app/lib/api/auth-guard'
import { updateReservationRow, deleteReservationRow, isRoomAvailable, GuestNotInHotelError } from '@/app/lib/frontoffice/repository'

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth(request)
    if (!auth.ok) return auth.response
    const perm = await requirePermission(request, 'frontdesk.delete')
    if (!perm.ok) return perm.response
    const subdomain = getTenantFromRequest(request)
    if (!subdomain) return NextResponse.json({ error: 'Missing tenant header' }, { status: 400 })
    const ctx = await getTenantContext(subdomain)
    if (!ctx) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
    const { id } = await params
    const result = await deleteReservationRow(ctx.tenantId, id)
    if (result === 'not-found') return NextResponse.json({ error: 'Reservation not found' }, { status: 404 })
    if (result !== 'deleted') {
      return NextResponse.json({ error: 'Only a pending reservation with no charges or payments can be deleted. Void it instead.' }, { status: 409 })
    }
    const sessionUserId = (auth.session as any).user?.id
    await createAuditLog(ctx.tenantId, sessionUserId ?? null, 'RESERVATION_DELETED', 'Reservation', id, undefined, undefined, request)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[reservations/:id][DELETE] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth(request)
    if (!auth.ok) return auth.response
    const subdomain = getTenantFromRequest(request)
    if (!subdomain) return NextResponse.json({ error: 'Missing tenant header' }, { status: 400 })
    const ctx = await getTenantContext(subdomain)
    if (!ctx) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

    const { id } = await params
    const body = await request.json()

    // Re-check availability when (re)assigning a room for given dates
    if (body.roomId && body.arrival && body.departure) {
      const available = await isRoomAvailable(ctx.tenantId, body.roomId, body.arrival, body.departure, id)
      if (!available) {
        return NextResponse.json({ error: 'Room is not available for the selected dates' }, { status: 409 })
      }
    }

    const reservation = await updateReservationRow(ctx.tenantId, id, body).catch((e) => {
      if (e instanceof GuestNotInHotelError) return e
      throw e
    })
    if (reservation instanceof GuestNotInHotelError) return NextResponse.json({ error: reservation.message }, { status: 400 })
    if (!reservation) return NextResponse.json({ error: 'Reservation not found' }, { status: 404 })
    const sessionUserId = (auth.session as any).user?.id
    await createAuditLog(ctx.tenantId, sessionUserId ?? null, 'RESERVATION_UPDATED', 'Reservation', id, undefined, { status: reservation.status, roomId: reservation.roomId }, request)
    return NextResponse.json({ reservation })
  } catch (error) {
    console.error('[reservations/:id][PATCH] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
