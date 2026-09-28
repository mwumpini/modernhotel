import { NextRequest, NextResponse } from 'next/server'
import { getTenantFromRequest, getTenantContext } from '@/app/lib/api/tenant'
import { requireAuth } from '@/app/lib/api/auth-guard'
import { prisma } from '@/app/lib/database/client'

// Without this, Next.js can treat the GET below as a static/cacheable route
// (it has no request-derived dynamic API calls Next.js would otherwise detect),
// letting the CDN or a client's default HTTP cache keep serving whatever this
// URL first returned — including a stale `false` from before setup completed.
export const dynamic = 'force-dynamic'

/**
 * Whether this tenant has completed the setup wizard — shared across devices.
 * Previously tracked only in the completing browser's localStorage, so every
 * other device (or the same device after clearing storage) saw the wizard
 * again even though the tenant's real setup was already done elsewhere.
 */
export async function GET(request: NextRequest) {
  try {
    const subdomain = getTenantFromRequest(request)
    if (!subdomain) return NextResponse.json({ error: 'Missing tenant header' }, { status: 400 })
    const ctx = await getTenantContext(subdomain)
    if (!ctx) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

    const settings = await prisma.systemSettings.findUnique({
      where: { tenantId: ctx.tenantId },
      select: { generalSettings: true },
    })
    const gs = (settings?.generalSettings as Record<string, any>) || {}
    return NextResponse.json({ initialSetupCompleted: gs.initialSetupCompleted === true })
  } catch (error) {
    console.error('[settings/setup-status][GET] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (!auth.ok) return auth.response
    const subdomain = getTenantFromRequest(request)
    if (!subdomain) return NextResponse.json({ error: 'Missing tenant header' }, { status: 400 })
    const ctx = await getTenantContext(subdomain)
    if (!ctx) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

    const body = await request.json()
    if (body.initialSetupCompleted !== true) {
      return NextResponse.json({ error: 'initialSetupCompleted must be true' }, { status: 400 })
    }

    const existing = await prisma.systemSettings.findUnique({ where: { tenantId: ctx.tenantId } })
    const existingGeneral = (existing?.generalSettings as Record<string, any>) || {}
    if (existingGeneral.initialSetupCompleted === true) {
      return NextResponse.json({ ok: true, unchanged: true })
    }
    const mergedGeneral = { ...existingGeneral, initialSetupCompleted: true }

    await prisma.systemSettings.upsert({
      where: { tenantId: ctx.tenantId },
      update: { generalSettings: mergedGeneral },
      create: {
        tenantId: ctx.tenantId,
        generalSettings: mergedGeneral,
        hotelSettings: {},
        roomSettings: {},
        financialSettings: {},
        clientSettings: {},
        saasSettings: {},
      },
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[settings/setup-status][POST] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
