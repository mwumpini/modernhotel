import { NextRequest, NextResponse } from 'next/server'
import { getTenantFromRequest, getTenantContext } from '@/app/lib/api/tenant'
import { listBankAccounts, upsertBankAccountRow, deleteBankAccountRow } from '@/app/lib/accounting/repository'

// GET /api/accounting/bank-accounts — the tenant's bank & cash accounts
export async function GET(request: NextRequest) {
  try {
    const subdomain = getTenantFromRequest(request)
    if (!subdomain) return NextResponse.json({ error: 'Missing tenant header' }, { status: 400 })
    const ctx = await getTenantContext(subdomain)
    if (!ctx) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

    const bankAccounts = await listBankAccounts(ctx.tenantId)
    return NextResponse.json({ bankAccounts })
  } catch (error) {
    console.error('[bank-accounts][GET] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// POST /api/accounting/bank-accounts — create or update one bank account
export async function POST(request: NextRequest) {
  try {
    const subdomain = getTenantFromRequest(request)
    if (!subdomain) return NextResponse.json({ error: 'Missing tenant header' }, { status: 400 })
    const ctx = await getTenantContext(subdomain)
    if (!ctx) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

    const body = await request.json()
    if (!body.id || !body.accountName || !body.glAccountCode) {
      return NextResponse.json({ error: 'id, accountName, and glAccountCode are required' }, { status: 400 })
    }

    const bankAccount = await upsertBankAccountRow(ctx.tenantId, {
      id: body.id,
      accountNumber: body.accountNumber || '',
      accountName: body.accountName,
      bankName: body.bankName || '',
      branch: body.branch,
      swiftCode: body.swiftCode,
      iban: body.iban,
      currency: body.currency || 'GHS',
      glAccountCode: body.glAccountCode,
      openingBalanceType: body.openingBalanceType,
      openingBalance: Number(body.openingBalance ?? 0),
      currentBalance: Number(body.currentBalance ?? 0),
      isActive: body.isActive ?? true,
    })
    return NextResponse.json({ bankAccount })
  } catch (error) {
    console.error('[bank-accounts][POST] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// DELETE /api/accounting/bank-accounts?id=... — remove one bank account
export async function DELETE(request: NextRequest) {
  try {
    const subdomain = getTenantFromRequest(request)
    if (!subdomain) return NextResponse.json({ error: 'Missing tenant header' }, { status: 400 })
    const ctx = await getTenantContext(subdomain)
    if (!ctx) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Missing required parameter: id' }, { status: 400 })

    const ok = await deleteBankAccountRow(ctx.tenantId, id)
    if (!ok) return NextResponse.json({ error: 'Bank account not found' }, { status: 404 })
    return NextResponse.json({ message: 'Deleted' })
  } catch (error) {
    console.error('[bank-accounts][DELETE] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
