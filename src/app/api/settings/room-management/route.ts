import { NextRequest, NextResponse } from 'next/server'
import { getTenantFromRequest, getTenantContext } from '@/app/lib/api/tenant'
import { prisma } from '@/app/lib/database/client'

/**
 * Minimal server-side mirror of the client-only settings/store.ts `roomManagement`
 * slice — just the no-show policy fields, so server-side jobs (the night-audit cron)
 * can apply the same policy a tenant configured in the UI instead of a hardcoded
 * default. The rest of roomManagement (room types, rate plans, etc.) stays client-only
 * for now; this is scoped to what the cron actually needs.
 */
export type NoShowPolicy = {
  noShowPolicyEnabled: boolean
  noShowChargeType: 'first_night' | 'percent_reservation' | 'flat'
  noShowChargeValue: number
}

const DEFAULT_POLICY: NoShowPolicy = {
  noShowPolicyEnabled: false,
  noShowChargeType: 'first_night',
  noShowChargeValue: 0,
}

export async function GET(request: NextRequest) {
  try {
    const subdomain = getTenantFromRequest(request)
    if (!subdomain) return NextResponse.json({ error: 'Missing tenant header' }, { status: 400 })
    const ctx = await getTenantContext(subdomain)
    if (!ctx) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

    const settings = await prisma.systemSettings.findUnique({
      where: { tenantId: ctx.tenantId },
      select: { roomSettings: true },
    })
    const rs = (settings?.roomSettings as Record<string, any>) || {}
    const policy: NoShowPolicy = {
      noShowPolicyEnabled: rs.noShowPolicyEnabled ?? DEFAULT_POLICY.noShowPolicyEnabled,
      noShowChargeType: rs.noShowChargeType ?? DEFAULT_POLICY.noShowChargeType,
      noShowChargeValue: rs.noShowChargeValue ?? DEFAULT_POLICY.noShowChargeValue,
    }
    return NextResponse.json({ policy })
  } catch (error) {
    console.error('[settings/room-management][GET] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const subdomain = getTenantFromRequest(request)
    if (!subdomain) return NextResponse.json({ error: 'Missing tenant header' }, { status: 400 })
    const ctx = await getTenantContext(subdomain)
    if (!ctx) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

    const body = await request.json()
    const patch: Partial<NoShowPolicy> = {
      ...(typeof body.noShowPolicyEnabled === 'boolean' ? { noShowPolicyEnabled: body.noShowPolicyEnabled } : {}),
      ...(typeof body.noShowChargeType === 'string' ? { noShowChargeType: body.noShowChargeType } : {}),
      ...(typeof body.noShowChargeValue === 'number' ? { noShowChargeValue: body.noShowChargeValue } : {}),
    }

    const existing = await prisma.systemSettings.findUnique({ where: { tenantId: ctx.tenantId } })
    const mergedRoomSettings = { ...((existing?.roomSettings as Record<string, any>) || {}), ...patch }

    await prisma.systemSettings.upsert({
      where: { tenantId: ctx.tenantId },
      update: { roomSettings: mergedRoomSettings },
      create: {
        tenantId: ctx.tenantId,
        generalSettings: {},
        hotelSettings: {},
        roomSettings: mergedRoomSettings,
        financialSettings: {},
        clientSettings: {},
        saasSettings: {},
      },
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[settings/room-management][POST] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
