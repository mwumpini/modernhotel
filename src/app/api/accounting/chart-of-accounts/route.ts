import { NextRequest, NextResponse } from 'next/server'
import { getTenantFromRequest, getTenantContext } from '@/app/lib/api/tenant'
import { listChartOfAccounts, upsertChartOfAccount, bulkUpsertChartOfAccounts, deleteChartOfAccountRow } from '@/app/lib/accounting/repository'

// GET /api/accounting/chart-of-accounts — the tenant's full chart
export async function GET(request: NextRequest) {
  try {
    const subdomain = getTenantFromRequest(request)
    if (!subdomain) return NextResponse.json({ error: 'Missing tenant header' }, { status: 400 })
    const ctx = await getTenantContext(subdomain)
    if (!ctx) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

    const accounts = await listChartOfAccounts(ctx.tenantId)
    return NextResponse.json({ accounts })
  } catch (error) {
    console.error('[chart-of-accounts][GET] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// POST /api/accounting/chart-of-accounts — upsert one account, or bulk-seed with { accounts: [...] }
export async function POST(request: NextRequest) {
  try {
    const subdomain = getTenantFromRequest(request)
    if (!subdomain) return NextResponse.json({ error: 'Missing tenant header' }, { status: 400 })
    const ctx = await getTenantContext(subdomain)
    if (!ctx) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

    const body = await request.json()

    if (Array.isArray(body?.accounts)) {
      await bulkUpsertChartOfAccounts(ctx.tenantId, body.accounts)
      return NextResponse.json({ ok: true, count: body.accounts.length })
    }

    if (!body.id || !body.code || !body.name || !body.type) {
      return NextResponse.json({ error: 'id, code, name, and type are required' }, { status: 400 })
    }

    const account = await upsertChartOfAccount(ctx.tenantId, {
      id: body.id,
      code: body.code,
      name: body.name,
      type: body.type,
      parentCode: body.parentCode ?? null,
      position: Number(body.position ?? 0),
      isActive: body.isActive ?? true,
    })
    return NextResponse.json({ account })
  } catch (error) {
    console.error('[chart-of-accounts][POST] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// DELETE /api/accounting/chart-of-accounts?id=... — remove one account
export async function DELETE(request: NextRequest) {
  try {
    const subdomain = getTenantFromRequest(request)
    if (!subdomain) return NextResponse.json({ error: 'Missing tenant header' }, { status: 400 })
    const ctx = await getTenantContext(subdomain)
    if (!ctx) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Missing required parameter: id' }, { status: 400 })

    const ok = await deleteChartOfAccountRow(ctx.tenantId, id)
    if (!ok) return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    return NextResponse.json({ message: 'Deleted' })
  } catch (error) {
    console.error('[chart-of-accounts][DELETE] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
