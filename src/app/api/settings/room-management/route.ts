import { NextRequest, NextResponse } from 'next/server'
import { getTenantFromRequest, getTenantContext } from '@/app/lib/api/tenant'
import { requireAuth, requirePermission } from '@/app/lib/api/auth-guard'
import { prisma } from '@/app/lib/database/client'

/**
 * Server-side mirror of the client-only settings/store.ts `roomManagement` slice.
 * Started as just the no-show policy fields (for the night-audit cron); now also
 * carries roomTypes/rooms/ratePlans/roomStatuses so Room Configuration is shared
 * across devices instead of living only in one browser's localStorage. Stored as
 * opaque JSON here rather than normalized tables — this data is read wholesale by
 * the UI, never queried relationally, so a JSON blob matches how it's actually used.
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

const ROOM_CONFIG_ARRAY_KEYS = ['roomTypes', 'rooms', 'ratePlans', 'roomStatuses'] as const

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
    const roomConfig = Object.fromEntries(ROOM_CONFIG_ARRAY_KEYS.map((k) => [k, Array.isArray(rs[k]) ? rs[k] : []]))
    return NextResponse.json({ policy, ...roomConfig })
  } catch (error) {
    console.error('[settings/room-management][GET] error', error)
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

    // This route is called from saveSettings() on every settings change site-wide
    // (see syncRoomManagementToApi), not just from Room Configuration — so the room
    // arrays arrive in the body far more often than they actually change. Rather
    // than 403 the whole request (which would also drop an unrelated no-show-policy
    // edit made by someone without this permission), only the array fields
    // themselves are dropped when the caller lacks settings.manage-rooms-pricing;
    // the rest of the patch still applies.
    let canManageRoomConfig = true
    if (ROOM_CONFIG_ARRAY_KEYS.some((k) => Array.isArray(body[k]))) {
      const perm = await requirePermission(request, 'settings.manage-rooms-pricing')
      canManageRoomConfig = perm.ok
    }

    const patch: Record<string, any> = {
      ...(typeof body.noShowPolicyEnabled === 'boolean' ? { noShowPolicyEnabled: body.noShowPolicyEnabled } : {}),
      ...(typeof body.noShowChargeType === 'string' ? { noShowChargeType: body.noShowChargeType } : {}),
      ...(typeof body.noShowChargeValue === 'number' ? { noShowChargeValue: body.noShowChargeValue } : {}),
    }
    if (canManageRoomConfig) {
      for (const k of ROOM_CONFIG_ARRAY_KEYS) {
        if (Array.isArray(body[k])) patch[k] = body[k]
      }
    }

    const existing = await prisma.systemSettings.findUnique({ where: { tenantId: ctx.tenantId } })
    const existingRoomSettings = (existing?.roomSettings as Record<string, any>) || {}
    const mergedRoomSettings = { ...existingRoomSettings, ...patch }

    // saveSettings() calls this on every settings change site-wide, so most calls
    // carry a payload identical to what's already stored — skip the write when
    // nothing actually changed rather than pointlessly re-persisting it. Matters
    // in practice: a stray infinite-render-loop elsewhere in the app can call this
    // dozens of times a second indefinitely, and this keeps that from turning into
    // an equal volume of database writes.
    if (existing && JSON.stringify(mergedRoomSettings) === JSON.stringify(existingRoomSettings)) {
      return NextResponse.json({ ok: true, unchanged: true })
    }

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
