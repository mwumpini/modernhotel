import { NextRequest, NextResponse } from 'next/server'
import { getTenantFromRequest, getTenantContext, createAuditLog } from '@/app/lib/api/tenant'
import { requireAuth } from '@/app/lib/api/auth-guard'
import { listGuests, createGuestRow, updateGuestRow } from '@/app/lib/frontoffice/repository'

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (!auth.ok) return auth.response
    const subdomain = getTenantFromRequest(request)
    if (!subdomain) return NextResponse.json({ error: 'Missing tenant header' }, { status: 400 })
    const ctx = await getTenantContext(subdomain)
    if (!ctx) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || undefined
    const guests = await listGuests(ctx.tenantId, search)
    return NextResponse.json({ guests })
  } catch (error) {
    console.error('[guests][GET] error', error)
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
    if (!body.name && !body.firstName) {
      return NextResponse.json({ error: 'name or firstName is required' }, { status: 400 })
    }
    const guest = await createGuestRow(ctx.tenantId, body)
    const sessionUserId = (auth.session as any).user?.id
    await createAuditLog(ctx.tenantId, sessionUserId ?? null, 'GUEST_CREATED', 'Guest', guest.id, undefined, { serialNumber: guest.serialNumber }, request)
    return NextResponse.json({ guest }, { status: 201 })
  } catch (error) {
    console.error('[guests][POST] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (!auth.ok) return auth.response
    const subdomain = getTenantFromRequest(request)
    if (!subdomain) return NextResponse.json({ error: 'Missing tenant header' }, { status: 400 })
    const ctx = await getTenantContext(subdomain)
    if (!ctx) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

    const body = await request.json()
    if (!body.id) return NextResponse.json({ error: 'id is required' }, { status: 400 })
    const guest = await updateGuestRow(ctx.tenantId, body.id, body)
    if (!guest) return NextResponse.json({ error: 'Guest not found' }, { status: 404 })
    const sessionUserId = (auth.session as any).user?.id
    await createAuditLog(ctx.tenantId, sessionUserId ?? null, 'GUEST_UPDATED', 'Guest', guest.id, undefined, { serialNumber: guest.serialNumber }, request)
    return NextResponse.json({ guest })
  } catch (error) {
    console.error('[guests][PATCH] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
