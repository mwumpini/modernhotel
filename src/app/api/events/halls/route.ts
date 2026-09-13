import { NextRequest, NextResponse } from 'next/server'
import { getTenantFromRequest, getTenantContext, createAuditLog } from '@/app/lib/api/tenant'
import { requireAuth } from '@/app/lib/api/auth-guard'
import { listConferenceHalls, upsertConferenceHall, deleteConferenceHall } from '@/app/lib/frontoffice/eventsRepository'

async function resolveTenant(req: NextRequest) {
  const subdomain = getTenantFromRequest(req)
  if (!subdomain) return null
  return getTenantContext(subdomain)
}

export async function GET(request: NextRequest) {
  try {
    const ctx = await resolveTenant(request)
    if (!ctx) return NextResponse.json({ error: 'Missing or unknown tenant' }, { status: 400 })
    const halls = await listConferenceHalls(ctx.tenantId)
    return NextResponse.json({ halls })
  } catch (error) {
    console.error('[events/halls][GET] error', error)
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
    const hall = await upsertConferenceHall(ctx.tenantId, body.id, body)
    const sessionUserId = (auth.session as any).user?.id
    await createAuditLog(ctx.tenantId, sessionUserId ?? null, 'CONFERENCE_HALL_SAVED', 'ConferenceHall', body.id, undefined, { name: hall.name }, request)
    return NextResponse.json({ hall })
  } catch (error) {
    console.error('[events/halls][POST] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (!auth.ok) return auth.response
    const ctx = await resolveTenant(request)
    if (!ctx) return NextResponse.json({ error: 'Missing or unknown tenant' }, { status: 400 })
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Missing required parameter: id' }, { status: 400 })
    const ok = await deleteConferenceHall(ctx.tenantId, id)
    if (!ok) return NextResponse.json({ error: 'Hall not found' }, { status: 404 })
    const sessionUserId = (auth.session as any).user?.id
    await createAuditLog(ctx.tenantId, sessionUserId ?? null, 'CONFERENCE_HALL_DELETED', 'ConferenceHall', id, undefined, undefined, request)
    return NextResponse.json({ message: 'Deleted' })
  } catch (error) {
    console.error('[events/halls][DELETE] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
