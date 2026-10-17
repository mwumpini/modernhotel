import { NextRequest, NextResponse } from 'next/server'
import { getTenantFromRequest, getTenantContext, createAuditLog } from '@/app/lib/api/tenant'
import { requireAuth } from '@/app/lib/api/auth-guard'
import { prisma } from '@/app/lib/database/client'
import { normalizePaySetup } from '@/app/lib/hr/salaryBanks'

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
    const stored = general.payrollPaySetup
    return NextResponse.json({ setup: stored ? normalizePaySetup(stored) : null })
  } catch (error) {
    console.error('[hr/pay-setup][GET] error', error)
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
    const setup = normalizePaySetup(body?.setup)

    const existing = await prisma.systemSettings.findUnique({ where: { tenantId: ctx.tenantId } })
    const general = (existing?.generalSettings as Record<string, unknown>) || {}
    const generalSettings: Record<string, any> = { ...general, payrollPaySetup: setup }

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
    await createAuditLog(ctx.tenantId, sessionUserId ?? null, 'HR_PAY_SETUP_SAVED', 'SystemSettings', ctx.tenantId, undefined, { banks: setup.banks.length }, request)

    return NextResponse.json({ setup })
  } catch (error) {
    console.error('[hr/pay-setup][POST] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
