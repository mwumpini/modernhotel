import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/app/lib/database/client'
import { getTenantFromRequest, getTenantContext, createAuditLog } from '@/app/lib/api/tenant'

// GET - Fetch all guests for tenant
export async function GET(request: NextRequest) {
  try {
    const subdomain = getTenantFromRequest(request)
    if (!subdomain) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
    }

    const tenantContext = await getTenantContext(subdomain)
    if (!tenantContext) {
      return NextResponse.json({ error: 'Invalid tenant' }, { status: 400 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const status = searchParams.get('status')
    const source = searchParams.get('source')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const skip = (page - 1) * limit

    // Build where clause
    const where: Record<string, unknown> = {
      tenantId: tenantContext.tenantId,
      isActive: true
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
        { serialNumber: { contains: search, mode: 'insensitive' } }
      ]
    }

    if (status) {
      where.isActive = status === 'active'
    }

    if (source) {
      where.source = source
    }

    // Get guests with pagination
    const [guests, total] = await Promise.all([
      prisma.guest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          reservations: {
            select: {
              id: true,
              checkInDate: true,
              checkOutDate: true,
              status: true
            }
          }
        }
      }),
      prisma.guest.count({ where })
    ])

    // Create audit log
    await createAuditLog(
      tenantContext.tenantId,
      null,
      'GUEST_LIST_VIEWED',
      'Guest',
      undefined,
      undefined,
      { count: guests.length, filters: { search, status, source } },
      request
    )

    return NextResponse.json({
      guests,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Error fetching guests:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Create new guest
export async function POST(request: NextRequest) {
  try {
    const subdomain = getTenantFromRequest(request)
    if (!subdomain) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
    }

    const tenantContext = await getTenantContext(subdomain)
    if (!tenantContext) {
      return NextResponse.json({ error: 'Invalid tenant' }, { status: 400 })
    }

    const body = await request.json()

    // Validate required fields
    if (!body.name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    // Generate next serial number
    const lastGuest = await prisma.guest.findFirst({
      where: { tenantId: tenantContext.tenantId },
      orderBy: { serialNumber: 'desc' }
    })

    let nextNumber = 1
    if (lastGuest) {
      const lastNumber = parseInt(lastGuest.serialNumber.replace('C', ''))
      nextNumber = lastNumber + 1
    }

    const serialNumber = `C${nextNumber.toString().padStart(3, '0')}`

    // Create guest
    const guest = await prisma.guest.create({
      data: {
        tenantId: tenantContext.tenantId,
        serialNumber,
        name: body.name,
        phone: body.phone,
        email: body.email,
        nationality: body.nationality,
        ghanaCard: body.ghanaCard,
        source: body.source,
        referralGuestId: body.referralGuestId,
        referralName: body.referralName,
        socialPlatform: body.socialPlatform,
        socialHandle: body.socialHandle,
        campaignCode: body.campaignCode,
        isActive: true
      },
      include: {
        reservations: {
          select: {
            id: true,
            checkInDate: true,
            checkOutDate: true,
            status: true
          }
        }
      }
    })

    // Create audit log
    await createAuditLog(
      tenantContext.tenantId,
      null,
      'GUEST_CREATED',
      'Guest',
      guest.id,
      undefined,
      guest,
      request
    )

    return NextResponse.json(guest, { status: 201 })
  } catch (error) {
    console.error('Error creating guest:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT - Update guest
export async function PUT(request: NextRequest) {
  try {
    const subdomain = getTenantFromRequest(request)
    if (!subdomain) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
    }

    const tenantContext = await getTenantContext(subdomain)
    if (!tenantContext) {
      return NextResponse.json({ error: 'Invalid tenant' }, { status: 400 })
    }

    const body = await request.json()

    if (!body.id) {
      return NextResponse.json({ error: 'Guest ID is required' }, { status: 400 })
    }

    // Get existing guest
    const existingGuest = await prisma.guest.findFirst({
      where: {
        id: body.id,
        tenantId: tenantContext.tenantId
      }
    })

    if (!existingGuest) {
      return NextResponse.json({ error: 'Guest not found' }, { status: 404 })
    }

    // Update guest
    const updatedGuest = await prisma.guest.update({
      where: { id: body.id },
      data: {
        name: body.name,
        phone: body.phone,
        email: body.email,
        nationality: body.nationality,
        ghanaCard: body.ghanaCard,
        source: body.source,
        referralGuestId: body.referralGuestId,
        referralName: body.referralName,
        socialPlatform: body.socialPlatform,
        socialHandle: body.socialHandle,
        campaignCode: body.campaignCode,
        isActive: body.isActive
      },
      include: {
        reservations: {
          select: {
            id: true,
            checkInDate: true,
            checkOutDate: true,
            status: true
          }
        }
      }
    })

    // Create audit log
    await createAuditLog(
      tenantContext.tenantId,
      null,
      'GUEST_UPDATED',
      'Guest',
      updatedGuest.id,
      existingGuest,
      updatedGuest,
      request
    )

    return NextResponse.json(updatedGuest)
  } catch (error) {
    console.error('Error updating guest:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE - Soft delete guest
export async function DELETE(request: NextRequest) {
  try {
    const subdomain = getTenantFromRequest(request)
    if (!subdomain) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
    }

    const tenantContext = await getTenantContext(subdomain)
    if (!tenantContext) {
      return NextResponse.json({ error: 'Invalid tenant' }, { status: 400 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Guest ID is required' }, { status: 400 })
    }

    // Check if guest has active reservations
    const activeReservations = await prisma.reservation.findFirst({
      where: {
        guestId: id,
        tenantId: tenantContext.tenantId,
        status: { in: ['confirmed', 'checked_in'] }
      }
    })

    if (activeReservations) {
      return NextResponse.json(
        { error: 'Cannot delete guest with active reservations' },
        { status: 400 }
      )
    }

    // Soft delete
    const deletedGuest = await prisma.guest.update({
      where: { id },
      data: { isActive: false }
    })

    // Create audit log
    await createAuditLog(
      tenantContext.tenantId,
      null,
      'GUEST_DELETED',
      'Guest',
      id,
      deletedGuest,
      { isActive: false },
      request
    )

    return NextResponse.json({ message: 'Guest deleted successfully' })
  } catch (error) {
    console.error('Error deleting guest:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
