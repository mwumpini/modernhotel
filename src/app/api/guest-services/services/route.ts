import { NextRequest, NextResponse } from 'next/server'
import { getTenantFromRequest, getTenantContext, createAuditLog } from '@/app/lib/api/tenant'
import { listGuestServices, upsertGuestService, deleteGuestService } from '@/app/lib/frontoffice/guestServicesRepository'

async function resolveTenant(req: NextRequest) {
  const subdomain = getTenantFromRequest(req)
  if (!subdomain) return null
  return getTenantContext(subdomain)
}

export async function GET(request: NextRequest) {
  try {
    const ctx = await resolveTenant(request)
    if (!ctx) return NextResponse.json({ error: 'Missing or unknown tenant' }, { status: 400 })
    const services = await listGuestServices(ctx.tenantId)
    return NextResponse.json({ services })
  } catch (error) {
    console.error('[guest-services/services][GET] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await resolveTenant(request)
    if (!ctx) return NextResponse.json({ error: 'Missing or unknown tenant' }, { status: 400 })
    const body = await request.json()
    if (!body.id) return NextResponse.json({ error: 'id is required' }, { status: 400 })
    const service = await upsertGuestService(ctx.tenantId, body.id, body)
    await createAuditLog(ctx.tenantId, null, 'GUEST_SERVICE_SAVED', 'GuestService', body.id, undefined, { name: service.name }, request)
    return NextResponse.json({ service })
  } catch (error) {
    console.error('[guest-services/services][POST] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const ctx = await resolveTenant(request)
    if (!ctx) return NextResponse.json({ error: 'Missing or unknown tenant' }, { status: 400 })
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Missing required parameter: id' }, { status: 400 })
    const ok = await deleteGuestService(ctx.tenantId, id)
    if (!ok) return NextResponse.json({ error: 'Service not found' }, { status: 404 })
    await createAuditLog(ctx.tenantId, null, 'GUEST_SERVICE_DELETED', 'GuestService', id, undefined, undefined, request)
    return NextResponse.json({ message: 'Deleted' })
  } catch (error) {
    console.error('[guest-services/services][DELETE] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
