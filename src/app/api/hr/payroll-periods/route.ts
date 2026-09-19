import { NextRequest, NextResponse } from 'next/server'
import { getTenantFromRequest, getTenantContext, createAuditLog } from '@/app/lib/api/tenant'
import { requireAuth, requirePermission, anotherUserHoldsPermission } from '@/app/lib/api/auth-guard'
import { listHrPayrollPeriods, upsertHrPayrollPeriod, getHrPayrollPeriodStatus } from '@/app/lib/hr/repository'

async function resolveTenant(req: NextRequest) {
  const subdomain = getTenantFromRequest(req)
  if (!subdomain) return null
  return getTenantContext(subdomain)
}

export async function GET(request: NextRequest) {
  try {
    const ctx = await resolveTenant(request)
    if (!ctx) return NextResponse.json({ error: 'Missing or unknown tenant' }, { status: 400 })
    const payrollPeriods = await listHrPayrollPeriods(ctx.tenantId)
    return NextResponse.json({ payrollPeriods })
  } catch (error) {
    console.error('[hr/payroll-periods][GET] error', error)
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
    // Signing off or paying a run is not something any logged-in user may do.
    if (body.status === 'approved' || body.status === 'paid') {
      const perm = await requirePermission(request, 'hr.approve-payroll')
      if (!perm.ok) return perm.response
      const saved = await getHrPayrollPeriodStatus(ctx.tenantId, body.id)
      if (body.status === 'paid' && saved?.status !== 'approved' && saved?.status !== 'paid') {
        return NextResponse.json({ error: 'A payroll period must be approved before it can be marked as paid' }, { status: 409 })
      }
      // Separation of duties: whoever processed a run can't also sign it off — unless nobody
      // else holds the approval permission, so a one-person setup isn't locked out.
      if (body.status === 'approved' && saved && saved.status !== 'approved' && saved.status !== 'paid' && saved.processedBy) {
        const user = (perm.session as any).user
        const me = String(user?.name || user?.email || '').trim().toLowerCase()
        if (me && me === saved.processedBy.trim().toLowerCase() && (await anotherUserHoldsPermission(ctx.tenantId, user?.id, 'hr.approve-payroll'))) {
          return NextResponse.json({ error: "You processed this payroll run, so someone else with payroll-approval permission has to approve it." }, { status: 403 })
        }
      }
    }
    const period = await upsertHrPayrollPeriod(ctx.tenantId, body.id, body)
    const sessionUserId = (auth.session as any).user?.id
    await createAuditLog(ctx.tenantId, sessionUserId ?? null, 'HR_PAYROLL_PERIOD_SAVED', 'HrPayrollPeriod', body.id, undefined, { periodNumber: period.periodNumber, status: period.status }, request)
    return NextResponse.json({ period })
  } catch (error) {
    console.error('[hr/payroll-periods][POST] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
