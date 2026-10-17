import { NextRequest, NextResponse } from 'next/server'
import { getTenantFromRequest, getTenantContext, createAuditLog } from '@/app/lib/api/tenant'
import { requireAuth } from '@/app/lib/api/auth-guard'
import { prisma } from '@/app/lib/database/client'
import { normalizeLeavePolicy } from '@/app/lib/hr/leavePolicy'

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

    const row = await prisma.systemSettings.findUnique({
      where: { tenantId: ctx.tenantId },
      select: { generalSettings: true },
    })
    const general = (row?.generalSettings as Record<string, unknown>) || {}
    return NextResponse.json({ policy: normalizeLeavePolicy(general.leavePolicy) })
  } catch (error) {
    console.error('[hr/leave-policy][GET] error', error)
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
    const policy = normalizeLeavePolicy(body?.policy)

    const existing = await prisma.systemSettings.findUnique({ where: { tenantId: ctx.tenantId } })
    const general = (existing?.generalSettings as Record<string, unknown>) || {}
    const generalSettings: Record<string, any> = { ...general, leavePolicy: policy }

    await prisma.systemSettings.upsert({
      where: { tenantId: ctx.tenantId },
      update: { generalSettings },
      create: {
        tenantId: ctx.tenantId,
        generalSettings,
        hotelSettings: {},
        roomSettings: {},
        financialSettings: {},
        clientSettings: {},
        saasSettings: {},
      },
    })

    const sessionUserId = (auth.session as any).user?.id
    await createAuditLog(ctx.tenantId, sessionUserId ?? null, 'HR_LEAVE_POLICY_SAVED', 'SystemSettings', ctx.tenantId, undefined, { bands: policy.bands.map((b) => b.id) }, request)

    return NextResponse.json({ policy })
  } catch (error) {
    console.error('[hr/leave-policy][POST] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
