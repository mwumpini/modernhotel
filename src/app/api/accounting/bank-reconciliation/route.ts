import { NextRequest, NextResponse } from 'next/server'
import { getTenantFromRequest, getTenantContext } from '@/app/lib/api/tenant'
import { listBankReconciliations, upsertBankReconciliation } from '@/app/lib/accounting/repository'

// GET /api/accounting/bank-reconciliation — all reconciliations + items for the tenant
export async function GET(request: NextRequest) {
  try {
    const subdomain = getTenantFromRequest(request)
    if (!subdomain) return NextResponse.json({ error: 'Missing tenant header' }, { status: 400 })
    const ctx = await getTenantContext(subdomain)
    if (!ctx) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

    const data = await listBankReconciliations(ctx.tenantId)
    return NextResponse.json(data)
  } catch (error) {
    console.error('[bank-reconciliation][GET] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// POST /api/accounting/bank-reconciliation — create or update one reconciliation
export async function POST(request: NextRequest) {
  try {
    const subdomain = getTenantFromRequest(request)
    if (!subdomain) return NextResponse.json({ error: 'Missing tenant header' }, { status: 400 })
    const ctx = await getTenantContext(subdomain)
    if (!ctx) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

    const body = await request.json()
    if (!body.id || !body.bankAccountId || !body.periodEndDate) {
      return NextResponse.json({ error: 'id, bankAccountId, and periodEndDate are required' }, { status: 400 })
    }

    const recon = await upsertBankReconciliation(ctx.tenantId, {
      id: body.id,
      bankAccountId: body.bankAccountId,
      periodEndDate: body.periodEndDate,
      statementBalance: Number(body.statementBalance ?? 0),
      cashbookBalance: Number(body.cashbookBalance ?? 0),
      status: body.status || 'Draft',
      preparedAt: body.preparedAt,
      approvedAt: body.approvedAt,
    })
    return NextResponse.json({ reconciliation: recon })
  } catch (error) {
    console.error('[bank-reconciliation][POST] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
