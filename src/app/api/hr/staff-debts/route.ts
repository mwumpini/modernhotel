import { NextRequest, NextResponse } from 'next/server'
import { getTenantFromRequest, getTenantContext, createAuditLog } from '@/app/lib/api/tenant'
import { requireAuth } from '@/app/lib/api/auth-guard'
import {
  listHrStaffDebts,
  upsertHrStaffDebt,
  deleteHrStaffDebt,
  listHrStaffDebtRepayments,
  upsertHrStaffDebtRepayment,
} from '@/app/lib/hr/repository'

async function resolveTenant(req: NextRequest) {
  const subdomain = getTenantFromRequest(req)
  if (!subdomain) return null
  return getTenantContext(subdomain)
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (!auth.ok) return auth.response
    const ctx = await resolveTenant(request)
    if (!ctx) return NextResponse.json({ error: 'Missing or unknown tenant' }, { status: 400 })
    const [debts, repayments] = await Promise.all([
      listHrStaffDebts(ctx.tenantId),
      listHrStaffDebtRepayments(ctx.tenantId),
    ])
    return NextResponse.json({ debts, repayments })
  } catch (error) {
    console.error('[hr/staff-debts][GET] error', error)
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
    if (!body.id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    const sessionUserId = (auth.session as any).user?.id
    if (body._kind === 'repayment' || body.debtId) {
      const { _kind, ...rest } = body
      const repayment = await upsertHrStaffDebtRepayment(ctx.tenantId, body.id, rest)
      await createAuditLog(ctx.tenantId, sessionUserId ?? null, 'HR_STAFF_DEBT_REPAYMENT_SAVED', 'HrStaffDebtRepayment', body.id, undefined, { debtId: repayment.debtId, amount: repayment.amount }, request)
      return NextResponse.json({ repayment })
    }

    const debt = await upsertHrStaffDebt(ctx.tenantId, body.id, body)
    await createAuditLog(ctx.tenantId, sessionUserId ?? null, 'HR_STAFF_DEBT_SAVED', 'HrStaffDebt', body.id, undefined, { employeeId: debt.employeeId, type: debt.type }, request)
    return NextResponse.json({ debt })
  } catch (error) {
    console.error('[hr/staff-debts][POST] error', error)
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
    if (!id) return NextResponse.json({ error: 'Missing required parameter: id' }, { status: 400 })
    const ok = await deleteHrStaffDebt(ctx.tenantId, id)
    if (!ok) return NextResponse.json({ error: 'Staff debt not found' }, { status: 404 })
    const sessionUserId = (auth.session as any).user?.id
    await createAuditLog(ctx.tenantId, sessionUserId ?? null, 'HR_STAFF_DEBT_DELETED', 'HrStaffDebt', id, undefined, undefined, request)
    return NextResponse.json({ message: 'Deleted' })
  } catch (error) {
    console.error('[hr/staff-debts][DELETE] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
