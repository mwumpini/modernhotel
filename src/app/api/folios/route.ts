import { NextRequest, NextResponse } from 'next/server'
import { getTenantFromRequest, getTenantContext, createAuditLog } from '@/app/lib/api/tenant'
import { listFolios, upsertFolio } from '@/app/lib/frontoffice/repository'

export async function GET(request: NextRequest) {
  try {
    const subdomain = getTenantFromRequest(request)
    if (!subdomain) return NextResponse.json({ error: 'Missing tenant header' }, { status: 400 })
    const ctx = await getTenantContext(subdomain)
    if (!ctx) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

    const folios = await listFolios(ctx.tenantId)
    return NextResponse.json({ folios })
  } catch (error) {
    console.error('[folios][GET] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// Folios are upserted as a whole because the in-house subledger mutates often
// (charges, payments, transfers). A single PUT keyed by folio id keeps the row
// authoritative without juggling child-record diffs.
export async function PUT(request: NextRequest) {
  try {
    const subdomain = getTenantFromRequest(request)
    if (!subdomain) return NextResponse.json({ error: 'Missing tenant header' }, { status: 400 })
    const ctx = await getTenantContext(subdomain)
    if (!ctx) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

    const body = await request.json()
    if (!body.id) return NextResponse.json({ error: 'folio id is required' }, { status: 400 })
    if (!body.reservationId) return NextResponse.json({ error: 'reservationId is required' }, { status: 400 })

    const folio = await upsertFolio(ctx.tenantId, body)
    await createAuditLog(ctx.tenantId, null, 'FOLIO_UPSERTED', 'Folio', folio.id, undefined, { reservationId: folio.reservationId, status: folio.status, balance: folio.balance }, request)
    return NextResponse.json({ folio })
  } catch (error) {
    console.error('[folios][PUT] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
