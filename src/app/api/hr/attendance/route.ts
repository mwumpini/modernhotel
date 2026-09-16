import { NextRequest, NextResponse } from 'next/server'
import { getTenantFromRequest, getTenantContext, createAuditLog } from '@/app/lib/api/tenant'
import { requireAuth, requirePermission } from '@/app/lib/api/auth-guard'
import { listHrAttendances, upsertHrAttendance } from '@/app/lib/hr/repository'
import { getApprovalRequirement } from '@/app/lib/api/approvalThresholds'
import { prisma } from '@/app/lib/database/client'

async function resolveTenant(req: NextRequest) {
  const subdomain = getTenantFromRequest(req)
  if (!subdomain) return null
  return getTenantContext(subdomain)
}

export async function GET(request: NextRequest) {
  try {
    const ctx = await resolveTenant(request)
    if (!ctx) return NextResponse.json({ error: 'Missing or unknown tenant' }, { status: 400 })
    const attendances = await listHrAttendances(ctx.tenantId)
    return NextResponse.json({ attendances })
  } catch (error) {
    console.error('[hr/attendance][GET] error', error)
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

    // An overtime approval at/above the tenant's configured hour threshold needs
    // director sign-off — same "downgrade rather than reject" approach used for
    // payments/journal entries/requisitions: the request still succeeds, it just
    // silently doesn't apply the approval fields, leaving the record pending
    // until someone with hr.approve-overtime does the same action.
    if (body.approvedAt) {
      const existing = await prisma.hrAttendance.findFirst({ where: { id: body.id, tenantId: ctx.tenantId }, select: { approvedAt: true, overtimeHours: true } })
      const alreadyApproved = !!existing?.approvedAt
      if (!alreadyApproved) {
        const hours = Number(body.overtimeHours ?? existing?.overtimeHours ?? 0)
        const { needsApproval } = await getApprovalRequirement(ctx.tenantId, 'overtime', hours)
        if (needsApproval) {
          const approvePerm = await requirePermission(request, 'hr.approve-overtime')
          if (!approvePerm.ok) {
            delete body.approvedAt
            delete body.approvedBy
          }
        }
      }
    }

    const attendance = await upsertHrAttendance(ctx.tenantId, body.id, body)
    const sessionUserId = (auth.session as any).user?.id
    await createAuditLog(ctx.tenantId, sessionUserId ?? null, 'HR_ATTENDANCE_SAVED', 'HrAttendance', body.id, undefined, { employeeId: attendance.employeeId, status: attendance.status }, request)
    return NextResponse.json({ attendance })
  } catch (error) {
    console.error('[hr/attendance][POST] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
