import { NextRequest, NextResponse } from 'next/server'
import { getTenantFromRequest, getTenantContext, createAuditLog } from '@/app/lib/api/tenant'
import { updateInvoice, deleteInvoice } from '@/app/lib/accounting/repository'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const subdomain = getTenantFromRequest(request)
    if (!subdomain) return NextResponse.json({ error: 'Missing tenant header' }, { status: 400 })
    const ctx = await getTenantContext(subdomain)
    if (!ctx) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

    const { id } = await params
    const body = await request.json()
    const invoice = await updateInvoice(ctx.tenantId, id, body)
    if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    await createAuditLog(ctx.tenantId, null, 'INVOICE_UPDATED', 'Invoice', id, undefined, { status: invoice.status, total: invoice.total }, request)
    return NextResponse.json({ invoice })
  } catch (error) {
    console.error('[accounting/invoices/:id][PATCH] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const subdomain = getTenantFromRequest(request)
    if (!subdomain) return NextResponse.json({ error: 'Missing tenant header' }, { status: 400 })
    const ctx = await getTenantContext(subdomain)
    if (!ctx) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

    const { id } = await params
    const ok = await deleteInvoice(ctx.tenantId, id)
    if (!ok) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    await createAuditLog(ctx.tenantId, null, 'INVOICE_DELETED', 'Invoice', id, undefined, undefined, request)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[accounting/invoices/:id][DELETE] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
