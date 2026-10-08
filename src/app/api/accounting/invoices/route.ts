import { NextRequest, NextResponse } from 'next/server'
import { getTenantFromRequest, getTenantContext, createAuditLog } from '@/app/lib/api/tenant'
import { requireAuth } from '@/app/lib/api/auth-guard'
import { listInvoices, createInvoice } from '@/app/lib/accounting/repository'
import { rejectIfManualBackdated } from '@/app/lib/frontoffice/postingDateGuard'

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (!auth.ok) return auth.response
    const subdomain = getTenantFromRequest(request)
    if (!subdomain) return NextResponse.json({ error: 'Missing tenant header' }, { status: 400 })
    const ctx = await getTenantContext(subdomain)
    if (!ctx) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

    const invoices = await listInvoices(ctx.tenantId)
    return NextResponse.json({ invoices })
  } catch (error) {
    console.error('[accounting/invoices][GET] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (!auth.ok) return auth.response
    const sessionUserId = (auth.session as any).user?.id
    const subdomain = getTenantFromRequest(request)
    if (!subdomain) return NextResponse.json({ error: 'Missing tenant header' }, { status: 400 })
    const ctx = await getTenantContext(subdomain)
    if (!ctx) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

    const body = await request.json()
    if (!body.invoiceNumber) return NextResponse.json({ error: 'invoiceNumber is required' }, { status: 400 })
    const backdated = await rejectIfManualBackdated(ctx.tenantId, body)
    if (backdated) return backdated

    const invoice = await createInvoice(ctx.tenantId, body)
    await createAuditLog(ctx.tenantId, sessionUserId ?? null, 'INVOICE_CREATED', 'Invoice', invoice.id, undefined, { invoiceNumber: invoice.invoiceNumber, type: invoice.type, total: invoice.total, sourceModule: invoice.sourceModule }, request)
    return NextResponse.json({ invoice }, { status: 201 })
  } catch (error) {
    console.error('[accounting/invoices][POST] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
