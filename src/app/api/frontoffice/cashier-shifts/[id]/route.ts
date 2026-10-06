import { NextRequest, NextResponse } from 'next/server'
import { getTenantFromRequest, getTenantContext, createAuditLog } from '@/app/lib/api/tenant'
import { requireAuth } from '@/app/lib/api/auth-guard'
import { rejectIfBackdated } from '@/app/lib/frontoffice/postingDateGuard'
import {
  closeCashierShift,
  deleteCashierShift,
  previewOpenShiftTotals,
  updateCashierShift,
} from '@/app/lib/frontoffice/cashierShiftRepository'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth(request)
    if (!auth.ok) return auth.response
    const subdomain = getTenantFromRequest(request)
    if (!subdomain) return NextResponse.json({ error: 'Missing tenant header' }, { status: 400 })
    const ctx = await getTenantContext(subdomain)
    if (!ctx) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

    const { id } = await params
    const preview = await previewOpenShiftTotals(ctx.tenantId, id)
    if (!preview) return NextResponse.json({ error: 'Open shift not found' }, { status: 404 })
    return NextResponse.json({ preview })
  } catch (error) {
    console.error('[frontoffice/cashier-shifts/:id][GET] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth(request)
    if (!auth.ok) return auth.response
    const subdomain = getTenantFromRequest(request)
    if (!subdomain) return NextResponse.json({ error: 'Missing tenant header' }, { status: 400 })
    const ctx = await getTenantContext(subdomain)
    if (!ctx) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

    const { id } = await params
    const body = await request.json()
    const sessionUserId = (auth.session as any).user?.id
    const action = body.action === 'update' ? 'update' : 'close'

    if (action === 'close') {
      const closingCount = Number(body.closingCount)
      if (!Number.isFinite(closingCount) || closingCount < 0) {
        return NextResponse.json({ error: 'closingCount must be zero or a positive number' }, { status: 400 })
      }
      const shift = await closeCashierShift(ctx.tenantId, id, closingCount, body.notes)
      if (!shift) return NextResponse.json({ error: 'Shift not found, or already closed' }, { status: 404 })
      await createAuditLog(
        ctx.tenantId,
        sessionUserId ?? null,
        'CASHIER_SHIFT_CLOSED',
        'CashierShift',
        shift.id,
        undefined,
        { closingCount, expectedCash: shift.expectedCash, variance: shift.variance },
        request,
      )
      return NextResponse.json({ shift })
    }

    try {
      if (body.businessDate) {
        const blocked = await rejectIfBackdated(ctx.tenantId, body.businessDate, { model: 'cashierShift', id })
        if (blocked) return blocked
      }
      const shift = await updateCashierShift(ctx.tenantId, id, {
        businessDate: body.businessDate,
        openingFloat: body.openingFloat !== undefined ? Number(body.openingFloat) : undefined,
        closingCount: body.closingCount !== undefined ? Number(body.closingCount) : undefined,
        notes: body.notes,
        recompute: Boolean(body.recompute),
        transferTo: body.transferTo,
        transferToName: body.transferToName,
        transferToUserId: body.transferToUserId,
        transferAmount: body.transferAmount !== undefined ? Number(body.transferAmount) : undefined,
        transferFromUserId: sessionUserId || undefined,
        transferFromName: (auth.session as any).user?.name || (auth.session as any).user?.email || undefined,
      })
      if (!shift) return NextResponse.json({ error: 'Shift not found' }, { status: 404 })
      await createAuditLog(
        ctx.tenantId,
        sessionUserId ?? null,
        'CASHIER_SHIFT_UPDATED',
        'CashierShift',
        shift.id,
        undefined,
        body,
        request,
      )
      return NextResponse.json({ shift })
    } catch (e: any) {
      return NextResponse.json({ error: e?.message || 'Invalid update' }, { status: 400 })
    }
  } catch (error) {
    console.error('[frontoffice/cashier-shifts/:id][PATCH] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth(request)
    if (!auth.ok) return auth.response
    const subdomain = getTenantFromRequest(request)
    if (!subdomain) return NextResponse.json({ error: 'Missing tenant header' }, { status: 400 })
    const ctx = await getTenantContext(subdomain)
    if (!ctx) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

    const { id } = await params
    const ok = await deleteCashierShift(ctx.tenantId, id)
    if (!ok) return NextResponse.json({ error: 'Shift not found' }, { status: 404 })
    const sessionUserId = (auth.session as any).user?.id
    await createAuditLog(
      ctx.tenantId,
      sessionUserId ?? null,
      'CASHIER_SHIFT_DELETED',
      'CashierShift',
      id,
      undefined,
      undefined,
      request,
    )
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[frontoffice/cashier-shifts/:id][DELETE] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
