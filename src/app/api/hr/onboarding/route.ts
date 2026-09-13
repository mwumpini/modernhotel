import { NextRequest, NextResponse } from 'next/server'
import { getTenantFromRequest, getTenantContext, createAuditLog } from '@/app/lib/api/tenant'
import { requireAuth } from '@/app/lib/api/auth-guard'
import { listHrOnboardingChecklists, upsertHrOnboardingChecklist } from '@/app/lib/hr/repository'

async function resolveTenant(req: NextRequest) {
  const subdomain = getTenantFromRequest(req)
  if (!subdomain) return null
  return getTenantContext(subdomain)
}

// GET /api/hr/onboarding — every onboarding checklist for the tenant (one per employee)
export async function GET(request: NextRequest) {
  try {
    const ctx = await resolveTenant(request)
    if (!ctx) return NextResponse.json({ error: 'Missing or unknown tenant' }, { status: 400 })
    const checklists = await listHrOnboardingChecklists(ctx.tenantId)
    return NextResponse.json({ checklists })
  } catch (error) {
    console.error('[hr/onboarding][GET] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// POST /api/hr/onboarding — create or update the checklist for one employee (body.employeeId required)
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (!auth.ok) return auth.response
    const ctx = await resolveTenant(request)
    if (!ctx) return NextResponse.json({ error: 'Missing or unknown tenant' }, { status: 400 })
    const body = await request.json()
    if (!body.employeeId) return NextResponse.json({ error: 'employeeId is required' }, { status: 400 })
    const checklist = await upsertHrOnboardingChecklist(ctx.tenantId, body.employeeId, body)
    const sessionUserId = (auth.session as any).user?.id
    await createAuditLog(ctx.tenantId, sessionUserId ?? null, 'HR_ONBOARDING_CHECKLIST_SAVED', 'HrOnboardingChecklist', checklist.id, undefined, { employeeId: checklist.employeeId }, request)
    return NextResponse.json({ checklist })
  } catch (error) {
    console.error('[hr/onboarding][POST] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
