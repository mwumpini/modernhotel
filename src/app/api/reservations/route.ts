import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/app/lib/database/client'
import { getTenantFromRequest, getTenantContext, createAuditLog } from '@/app/lib/api/tenant'

// GET - Fetch reservations for tenant
export async function GET(request: NextRequest) {
  try {
    const subdomain = getTenantFromRequest(request)
    if (!subdomain) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

    const tenantContext = await getTenantContext(subdomain)
    if (!tenantContext) return NextResponse.json({ error: 'Invalid tenant' }, { status: 400 })

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || undefined
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const skip = (page - 1) * limit

    const where: any = { tenantId: tenantContext.tenantId }
    if (status) where.status = status

    const [reservations, total] = await Promise.all([
      prisma.reservation.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          guest: {
            select: { id: true, name: true, email: true, phone: true, serialNumber: true }
          }
        }
      }),
      prisma.reservation.count({ where })
    ])

    await createAuditLog(
      tenantContext.tenantId,
      null,
      'RESERVATION_LIST_VIEWED',
      'Reservation',
      undefined,
      undefined,
      { count: reservations.length, filters: { status } },
      request
    )

    return NextResponse.json({
      reservations,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    })
  } catch (error) {
    console.error('Error fetching reservations:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Create reservation
export async function POST(request: NextRequest) {
  try {
    const subdomain = getTenantFromRequest(request)
    if (!subdomain) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

    const tenantContext = await getTenantContext(subdomain)
    if (!tenantContext) return NextResponse.json({ error: 'Invalid tenant' }, { status: 400 })

    const body = await request.json()
    if (!body.guestId || !body.checkInDate || !body.checkOutDate) {
      return NextResponse.json({ error: 'guestId, checkInDate, checkOutDate are required' }, { status: 400 })
    }

    const reservation = await prisma.reservation.create({
      data: {
        tenantId: tenantContext.tenantId,
        guestId: body.guestId,
        roomType: body.roomType,
        roomId: body.roomId,
        status: body.status || 'pending',
        source: body.source,
        checkInDate: new Date(body.checkInDate),
        checkOutDate: new Date(body.checkOutDate),
        adults: body.adults ?? 1,
        children: body.children ?? 0,
        specialRequests: body.specialRequests
      }
    })

    await createAuditLog(
      tenantContext.tenantId,
      null,
      'RESERVATION_CREATED',
      'Reservation',
      reservation.id,
      undefined,
      reservation,
      request
    )

    return NextResponse.json(reservation, { status: 201 })
  } catch (error) {
    console.error('Error creating reservation:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT - Update reservation
export async function PUT(request: NextRequest) {
  try {
    const subdomain = getTenantFromRequest(request)
    if (!subdomain) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

    const tenantContext = await getTenantContext(subdomain)
    if (!tenantContext) return NextResponse.json({ error: 'Invalid tenant' }, { status: 400 })

    const body = await request.json()
    if (!body.id) {
      return NextResponse.json({ error: 'Reservation id is required' }, { status: 400 })
    }

    const existing = await prisma.reservation.findFirst({
      where: { id: body.id, tenantId: tenantContext.tenantId }
    })
    if (!existing) return NextResponse.json({ error: 'Reservation not found' }, { status: 404 })

    const updated = await prisma.reservation.update({
      where: { id: body.id },
      data: {
        roomType: body.roomType,
        roomId: body.roomId,
        status: body.status,
        source: body.source,
        checkInDate: body.checkInDate ? new Date(body.checkInDate) : existing.checkInDate,
        checkOutDate: body.checkOutDate ? new Date(body.checkOutDate) : existing.checkOutDate,
        adults: body.adults ?? existing.adults,
        children: body.children ?? existing.children,
        specialRequests: body.specialRequests
      }
    })

    await createAuditLog(
      tenantContext.tenantId,
      null,
      'RESERVATION_UPDATED',
      'Reservation',
      updated.id,
      existing,
      updated,
      request
    )

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error updating reservation:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE - Delete reservation
export async function DELETE(request: NextRequest) {
  try {
    const subdomain = getTenantFromRequest(request)
    if (!subdomain) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

    const tenantContext = await getTenantContext(subdomain)
    if (!tenantContext) return NextResponse.json({ error: 'Invalid tenant' }, { status: 400 })

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Reservation id is required' }, { status: 400 })

    const existing = await prisma.reservation.findFirst({ where: { id, tenantId: tenantContext.tenantId } })
    if (!existing) return NextResponse.json({ error: 'Reservation not found' }, { status: 404 })

    await prisma.reservation.delete({ where: { id } })

    await createAuditLog(
      tenantContext.tenantId,
      null,
      'RESERVATION_DELETED',
      'Reservation',
      id,
      existing,
      { deleted: true },
      request
    )

    return NextResponse.json({ message: 'Reservation deleted' })
  } catch (error) {
    console.error('Error deleting reservation:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}


