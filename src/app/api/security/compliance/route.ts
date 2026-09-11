import { NextRequest, NextResponse } from 'next/server'
import { getTenantFromRequest, getTenantContext, createAuditLog } from '@/app/lib/api/tenant'
import { requireAuth } from '@/app/lib/api/auth-guard'
import { listComplianceRequirements, upsertComplianceRequirement } from '@/app/lib/security/repository'

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
    const requirements = await listComplianceRequirements(ctx.tenantId)
    return NextResponse.json({ requirements })
  } catch (error) {
    console.error('[security/compliance][GET] error', error)
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
    if (!body.title || !body.category || !body.nextDueDate) {
      return NextResponse.json({ error: 'title, category and nextDueDate are required' }, { status: 400 })
    }
    const requirement = await upsertComplianceRequirement(ctx.tenantId, body.id, body)
    await createAuditLog(ctx.tenantId, null, 'SECURITY_COMPLIANCE_SAVED', 'SecurityComplianceRequirement', body.id, undefined, { title: requirement.title }, request)
    return NextResponse.json({ requirement })
  } catch (error) {
    console.error('[security/compliance][POST] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
