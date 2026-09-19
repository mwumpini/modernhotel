import { NextRequest, NextResponse } from 'next/server'
import { getTenantFromRequest, getTenantContext, createAuditLog } from '@/app/lib/api/tenant'
import { requireAuth, requirePermission } from '@/app/lib/api/auth-guard'
import { listHrPerformanceLogs, upsertHrPerformanceLog } from '@/app/lib/hr/repository'

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
    const logs = await listHrPerformanceLogs(ctx.tenantId)
    return NextResponse.json({ logs })
  } catch (error) {
    console.error('[hr/performance-logs][GET] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// No DELETE on purpose: a wrong entry is voided (with a reason), never removed.
export async function POST(request: NextRequest) {
  try {
    const auth = await requirePermission(request, 'hr.manage-performance-reviews')
    if (!auth.ok) return auth.response
    const ctx = await resolveTenant(request)
    if (!ctx) return NextResponse.json({ error: 'Missing or unknown tenant' }, { status: 400 })
    const body = await request.json()
    if (!body.id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    const score = Number(body.score)
    const isNew = body.employeeId !== undefined && body.note !== undefined
    if (isNew) {
      if (!body.employeeId) return NextResponse.json({ error: 'employeeId is required' }, { status: 400 })
      if (!Number.isInteger(score) || score === 0 || score < -5 || score > 5) {
        return NextResponse.json({ error: 'score must be a whole number from -5 to -1 or 1 to 5' }, { status: 400 })
      }
      if (!String(body.note).trim()) return NextResponse.json({ error: 'note (what happened) is required' }, { status: 400 })
    }
    if (body.status === 'voided' && !String(body.voidedReason || '').trim()) {
      return NextResponse.json({ error: 'A reason is required to void an entry' }, { status: 400 })
    }

    const log = await upsertHrPerformanceLog(ctx.tenantId, body.id, body)
    const sessionUserId = (auth.session as any).user?.id
    await createAuditLog(ctx.tenantId, sessionUserId ?? null, log.status === 'voided' ? 'HR_PERFORMANCE_LOG_VOIDED' : 'HR_PERFORMANCE_LOG_SAVED', 'HrPerformanceLog', body.id, undefined, { employeeId: log.employeeId, score: log.score, status: log.status }, request)
    return NextResponse.json({ log })
  } catch (error) {
    console.error('[hr/performance-logs][POST] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
