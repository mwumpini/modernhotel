import { NextRequest, NextResponse } from 'next/server'
import { getTenantFromRequest, getTenantContext, createAuditLog } from '@/app/lib/api/tenant'
import { requireAuth, requirePermission } from '@/app/lib/api/auth-guard'
import { listHrPayrollRecords, upsertHrPayrollRecord, payrollRecordLockedReason } from '@/app/lib/hr/repository'

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
    const payrollRecords = await listHrPayrollRecords(ctx.tenantId)
    return NextResponse.json({ payrollRecords })
  } catch (error) {
    console.error('[hr/payroll-records][GET] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (!auth.ok) return auth.response
    const sessionUserId = (auth.session as any).user?.id
    const ctx = await resolveTenant(request)
    if (!ctx) return NextResponse.json({ error: 'Missing or unknown tenant' }, { status: 400 })
    const body = await request.json()
    // One request can carry a whole batch (a month's records, or one bank's worth being paid)
    // — hundreds of staff shouldn't mean hundreds of round trips.
    const isBatch = Array.isArray(body.records)
    const items: Record<string, any>[] = isBatch ? body.records : [body]
    if (items.length === 0 || items.some((i) => !i?.id)) return NextResponse.json({ error: 'id is required' }, { status: 400 })
    // Marking paid takes the approval permission; anything else (creating or correcting a
    // record before approval) takes the processing permission.
    const perm = await requirePermission(request, items.some((i) => i.status === 'paid') ? 'hr.approve-payroll' : 'hr.process-payroll')
    if (!perm.ok) return perm.response
    const periodStatuses = new Map<string, string | undefined>()
    for (const item of items) {
      const locked = await payrollRecordLockedReason(ctx.tenantId, item, periodStatuses)
      if (locked) return NextResponse.json({ error: locked }, { status: 409 })
    }
    const saved = []
    for (const item of items) saved.push(await upsertHrPayrollRecord(ctx.tenantId, item.id, item))
    await createAuditLog(
      ctx.tenantId, sessionUserId ?? null,
      isBatch ? 'HR_PAYROLL_RECORDS_SAVED' : 'HR_PAYROLL_RECORD_SAVED',
      'HrPayrollRecord', isBatch ? `batch:${items.length}` : items[0].id, undefined,
      isBatch
        ? { count: saved.length, statuses: Array.from(new Set(saved.map((r) => r.status))) }
        : { employeeNumber: saved[0].employeeNumber, netPay: saved[0].netPay, status: saved[0].status },
      request,
    )
    return NextResponse.json(isBatch ? { payrollRecords: saved } : { record: saved[0] })
  } catch (error) {
    console.error('[hr/payroll-records][POST] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
