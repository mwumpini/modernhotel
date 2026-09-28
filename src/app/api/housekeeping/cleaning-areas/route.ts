import { NextRequest, NextResponse } from 'next/server'
import { getTenantFromRequest, getTenantContext, createAuditLog } from '@/app/lib/api/tenant'
import { requireAuth } from '@/app/lib/api/auth-guard'
import { prisma } from '@/app/lib/database/client'
import { DEFAULT_CLEANING_AREAS } from '@/app/lib/housekeeping/cleaningAreas'

async function resolveTenant(req: NextRequest) {
  const subdomain = getTenantFromRequest(req)
  if (!subdomain) return null
  return getTenantContext(subdomain)
}

type Row = {
  id: string
  tenantId: string
  name: string
  sortOrder: number
  isActive: number | boolean
  status?: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

function serialize(row: Row) {
  return {
    id: row.id,
    name: row.name,
    sortOrder: Number(row.sortOrder) || 0,
    isActive: row.isActive === true || row.isActive === 1,
    status: String(row.status || 'clean'),
    notes: row.notes,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function newId() {
  return `hkca_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`
}

async function ensureTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS housekeeping_cleaning_areas (
      id TEXT PRIMARY KEY NOT NULL,
      tenantId TEXT NOT NULL,
      name TEXT NOT NULL,
      sortOrder INTEGER NOT NULL DEFAULT 0,
      isActive INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'clean',
      notes TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    )
  `)
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS housekeeping_cleaning_areas_tenantId_idx
    ON housekeeping_cleaning_areas (tenantId)
  `)
  try {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE housekeeping_cleaning_areas ADD COLUMN status TEXT NOT NULL DEFAULT 'clean'`
    )
  } catch {
    // column already exists
  }
}

async function seedDefaults(tenantId: string) {
  const now = new Date().toISOString()
  for (let i = 0; i < DEFAULT_CLEANING_AREAS.length; i++) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO housekeeping_cleaning_areas
       (id, tenantId, name, sortOrder, isActive, status, notes, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, 1, 'clean', NULL, ?, ?)`,
      newId(),
      tenantId,
      DEFAULT_CLEANING_AREAS[i],
      i,
      now,
      now
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const ctx = await resolveTenant(request)
    if (!ctx) return NextResponse.json({ error: 'Missing or unknown tenant' }, { status: 400 })

    await ensureTable()

    const { searchParams } = new URL(request.url)
    const activeOnly = searchParams.get('active') !== '0'

    let countRows = await prisma.$queryRawUnsafe<{ c: number }[]>(
      `SELECT COUNT(*) as c FROM housekeeping_cleaning_areas WHERE tenantId = ?`,
      ctx.tenantId
    )
    if (Number(countRows[0]?.c || 0) === 0) {
      await seedDefaults(ctx.tenantId)
    }

    let sql = `SELECT * FROM housekeeping_cleaning_areas WHERE tenantId = ?`
    const params: unknown[] = [ctx.tenantId]
    if (activeOnly) {
      sql += ` AND isActive = 1`
    }
    sql += ` ORDER BY sortOrder ASC, name ASC`

    const rows = await prisma.$queryRawUnsafe<Row[]>(sql, ...params)
    return NextResponse.json({ areas: rows.map(serialize) })
  } catch (error) {
    console.error('[housekeeping/cleaning-areas][GET] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (!auth.ok) return auth.response
    const ctx = await resolveTenant(request)
    if (!ctx) return NextResponse.json({ error: 'Missing or unknown tenant' }, { status: 400 })

    await ensureTable()

    const body = await request.json()
    const name = String(body.name || '').trim()
    const statusRaw = body.status != null ? String(body.status).trim().toLowerCase() : null
    const allowedStatus = ['clean', 'dirty', 'in-progress', 'inspected', 'maintenance']
    const status = statusRaw && allowedStatus.includes(statusRaw) ? statusRaw : null

    // Status-only update (Floor public-space cards)
    if (body.id && status && !name && body.name === undefined) {
      const id = String(body.id)
      const existing = await prisma.$queryRawUnsafe<Row[]>(
        `SELECT * FROM housekeeping_cleaning_areas WHERE id = ? AND tenantId = ? LIMIT 1`,
        id,
        ctx.tenantId
      )
      if (!existing.length) return NextResponse.json({ error: 'Not found' }, { status: 404 })
      const now = new Date().toISOString()
      await prisma.$executeRawUnsafe(
        `UPDATE housekeeping_cleaning_areas SET status = ?, updatedAt = ? WHERE id = ? AND tenantId = ?`,
        status,
        now,
        id,
        ctx.tenantId
      )
      const saved = await prisma.$queryRawUnsafe<Row[]>(
        `SELECT * FROM housekeeping_cleaning_areas WHERE id = ? LIMIT 1`,
        id
      )
      return NextResponse.json({ area: serialize(saved[0]) })
    }

    if (!name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 })
    }

    const notes = body.notes != null && String(body.notes).trim() ? String(body.notes).trim() : null
    const isActive = body.isActive === false ? 0 : 1
    const sortOrder = Number.isFinite(Number(body.sortOrder)) ? Number(body.sortOrder) : 0
    const now = new Date().toISOString()
    let id = body.id ? String(body.id) : newId()

    if (body.id) {
      const existing = await prisma.$queryRawUnsafe<Row[]>(
        `SELECT id FROM housekeeping_cleaning_areas WHERE id = ? AND tenantId = ? LIMIT 1`,
        id,
        ctx.tenantId
      )
      if (!existing.length) return NextResponse.json({ error: 'Not found' }, { status: 404 })

      if (status) {
        await prisma.$executeRawUnsafe(
          `UPDATE housekeeping_cleaning_areas
           SET name = ?, sortOrder = ?, isActive = ?, status = ?, notes = ?, updatedAt = ?
           WHERE id = ? AND tenantId = ?`,
          name,
          sortOrder,
          isActive,
          status,
          notes,
          now,
          id,
          ctx.tenantId
        )
      } else {
        await prisma.$executeRawUnsafe(
          `UPDATE housekeeping_cleaning_areas
           SET name = ?, sortOrder = ?, isActive = ?, notes = ?, updatedAt = ?
           WHERE id = ? AND tenantId = ?`,
          name,
          sortOrder,
          isActive,
          notes,
          now,
          id,
          ctx.tenantId
        )
      }
    } else {
      const dup = await prisma.$queryRawUnsafe<Row[]>(
        `SELECT id FROM housekeeping_cleaning_areas WHERE tenantId = ? AND lower(name) = lower(?) LIMIT 1`,
        ctx.tenantId,
        name
      )
      if (dup.length) {
        return NextResponse.json({ error: 'An area with that name already exists' }, { status: 409 })
      }

      const maxRows = await prisma.$queryRawUnsafe<{ m: number | null }[]>(
        `SELECT MAX(sortOrder) as m FROM housekeeping_cleaning_areas WHERE tenantId = ?`,
        ctx.tenantId
      )
      const nextOrder = body.sortOrder != null ? sortOrder : Number(maxRows[0]?.m ?? -1) + 1

      await prisma.$executeRawUnsafe(
        `INSERT INTO housekeeping_cleaning_areas
         (id, tenantId, name, sortOrder, isActive, status, notes, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        id,
        ctx.tenantId,
        name,
        nextOrder,
        isActive,
        status || 'clean',
        notes,
        now,
        now
      )
    }

    const saved = await prisma.$queryRawUnsafe<Row[]>(
      `SELECT * FROM housekeeping_cleaning_areas WHERE id = ? LIMIT 1`,
      id
    )

    const sessionUserId = (auth.session as any).user?.id
    await createAuditLog(
      ctx.tenantId,
      sessionUserId ?? null,
      body.id ? 'HK_CLEANING_AREA_UPDATED' : 'HK_CLEANING_AREA_CREATED',
      'HousekeepingCleaningArea',
      id,
      undefined,
      { name },
      request
    )

    return NextResponse.json({ area: serialize(saved[0]) })
  } catch (error) {
    console.error('[housekeeping/cleaning-areas][POST] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (!auth.ok) return auth.response
    const ctx = await resolveTenant(request)
    if (!ctx) return NextResponse.json({ error: 'Missing or unknown tenant' }, { status: 400 })

    await ensureTable()

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    // Soft-delete so historical tasks still resolve the name string.
    await prisma.$executeRawUnsafe(
      `UPDATE housekeeping_cleaning_areas SET isActive = 0, updatedAt = ? WHERE id = ? AND tenantId = ?`,
      new Date().toISOString(),
      id,
      ctx.tenantId
    )

    const sessionUserId = (auth.session as any).user?.id
    await createAuditLog(
      ctx.tenantId,
      sessionUserId ?? null,
      'HK_CLEANING_AREA_DEACTIVATED',
      'HousekeepingCleaningArea',
      id,
      undefined,
      undefined,
      request
    )

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[housekeeping/cleaning-areas][DELETE] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
