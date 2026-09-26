import { NextRequest, NextResponse } from 'next/server'
import { getTenantFromRequest, getTenantContext, createAuditLog } from '@/app/lib/api/tenant'
import { requireAuth } from '@/app/lib/api/auth-guard'
import { prisma } from '@/app/lib/database/client'
import { parseRoomListInput } from '@/app/lib/housekeeping/roomResponsibilities'

async function resolveTenant(req: NextRequest) {
  const subdomain = getTenantFromRequest(req)
  if (!subdomain) return null
  return getTenantContext(subdomain)
}

type Row = {
  id: string
  tenantId: string
  label: string | null
  staffId: string
  staffName: string
  shift: string
  rooms: string
  isActive: number | boolean
  notes: string | null
  createdAt: string
  updatedAt: string
}

function serialize(row: Row) {
  let rooms: string[] = []
  try {
    const parsed = typeof row.rooms === 'string' ? JSON.parse(row.rooms) : row.rooms
    rooms = Array.isArray(parsed) ? parsed.map(String) : []
  } catch {
    rooms = []
  }
  return {
    id: row.id,
    label: row.label,
    staffId: row.staffId,
    staffName: row.staffName,
    shift: row.shift,
    rooms,
    isActive: row.isActive === true || row.isActive === 1,
    notes: row.notes,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function newId() {
  return `hkr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`
}

export async function GET(request: NextRequest) {
  try {
    const ctx = await resolveTenant(request)
    if (!ctx) return NextResponse.json({ error: 'Missing or unknown tenant' }, { status: 400 })

    const { searchParams } = new URL(request.url)
    const shift = searchParams.get('shift')
    const staffId = searchParams.get('staffId')
    const activeOnly = searchParams.get('active') !== '0'

    // Raw SQL so we don't depend on a freshly regenerated Prisma client
    // (Windows often locks query_engine while next dev is running).
    let sql = `SELECT * FROM housekeeping_room_responsibilities WHERE tenantId = ?`
    const params: unknown[] = [ctx.tenantId]
    if (shift) {
      sql += ` AND shift = ?`
      params.push(shift)
    }
    if (staffId) {
      sql += ` AND staffId = ?`
      params.push(staffId)
    }
    if (activeOnly) {
      sql += ` AND isActive = 1`
    }
    sql += ` ORDER BY shift ASC, staffName ASC`

    const rows = await prisma.$queryRawUnsafe<Row[]>(sql, ...params)
    return NextResponse.json({ responsibilities: rows.map(serialize) })
  } catch (error) {
    console.error('[housekeeping/room-responsibilities][GET] error', error)
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
    if (!body.staffId || !body.staffName) {
      return NextResponse.json({ error: 'staffId and staffName are required' }, { status: 400 })
    }
    if (!body.shift) {
      return NextResponse.json({ error: 'shift is required' }, { status: 400 })
    }

    const rooms: string[] = Array.isArray(body.rooms)
      ? body.rooms.map(String).filter(Boolean)
      : parseRoomListInput(String(body.roomsText || ''))
    if (rooms.length === 0) {
      return NextResponse.json({ error: 'At least one room is required' }, { status: 400 })
    }

    const label = body.label ? String(body.label).trim() : null
    const staffId = String(body.staffId)
    const staffName = String(body.staffName).trim()
    const shift = String(body.shift)
    const notes = body.notes ? String(body.notes) : null
    const isActive = body.isActive === false ? 0 : 1
    const roomsJson = JSON.stringify(rooms)
    const now = new Date().toISOString()

    let id = body.id ? String(body.id) : newId()

    if (body.id) {
      const existing = await prisma.$queryRawUnsafe<Row[]>(
        `SELECT id FROM housekeeping_room_responsibilities WHERE id = ? AND tenantId = ? LIMIT 1`,
        id,
        ctx.tenantId
      )
      if (!existing.length) return NextResponse.json({ error: 'Not found' }, { status: 404 })

      await prisma.$executeRawUnsafe(
        `UPDATE housekeeping_room_responsibilities
         SET label = ?, staffId = ?, staffName = ?, shift = ?, rooms = ?, isActive = ?, notes = ?, updatedAt = ?
         WHERE id = ? AND tenantId = ?`,
        label,
        staffId,
        staffName,
        shift,
        roomsJson,
        isActive,
        notes,
        now,
        id,
        ctx.tenantId
      )
    } else {
      await prisma.$executeRawUnsafe(
        `INSERT INTO housekeeping_room_responsibilities
         (id, tenantId, label, staffId, staffName, shift, rooms, isActive, notes, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        id,
        ctx.tenantId,
        label,
        staffId,
        staffName,
        shift,
        roomsJson,
        isActive,
        notes,
        now,
        now
      )
    }

    const saved = await prisma.$queryRawUnsafe<Row[]>(
      `SELECT * FROM housekeeping_room_responsibilities WHERE id = ? LIMIT 1`,
      id
    )

    const sessionUserId = (auth.session as any).user?.id
    await createAuditLog(
      ctx.tenantId,
      sessionUserId ?? null,
      body.id ? 'HK_ROOM_RESPONSIBILITY_UPDATED' : 'HK_ROOM_RESPONSIBILITY_CREATED',
      'HousekeepingRoomResponsibility',
      id,
      undefined,
      { staffName, shift, roomCount: rooms.length },
      request
    )

    return NextResponse.json({ responsibility: serialize(saved[0]) }, { status: body.id ? 200 : 201 })
  } catch (error) {
    console.error('[housekeeping/room-responsibilities][POST] error', error)
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

    const existing = await prisma.$queryRawUnsafe<Row[]>(
      `SELECT * FROM housekeeping_room_responsibilities WHERE id = ? AND tenantId = ? LIMIT 1`,
      id,
      ctx.tenantId
    )
    if (!existing.length) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const now = new Date().toISOString()
    await prisma.$executeRawUnsafe(
      `UPDATE housekeeping_room_responsibilities SET isActive = 0, updatedAt = ? WHERE id = ? AND tenantId = ?`,
      now,
      id,
      ctx.tenantId
    )

    const sessionUserId = (auth.session as any).user?.id
    await createAuditLog(
      ctx.tenantId,
      sessionUserId ?? null,
      'HK_ROOM_RESPONSIBILITY_CLEARED',
      'HousekeepingRoomResponsibility',
      id,
      undefined,
      { staffName: existing[0].staffName, shift: existing[0].shift },
      request
    )

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[housekeeping/room-responsibilities][DELETE] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
