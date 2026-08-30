import { NextRequest, NextResponse } from 'next/server'
import { getTenantFromRequest, getTenantContext, createAuditLog } from '@/app/lib/api/tenant'
import { listServiceRequests, upsertServiceRequest, deleteServiceRequest } from '@/app/lib/frontoffice/guestServicesRepository'

async function resolveTenant(req: NextRequest) {
  const subdomain = getTenantFromRequest(req)
  if (!subdomain) return null
  return getTenantContext(subdomain)
}

export async function GET(request: NextRequest) {
  try {
    const ctx = await resolveTenant(request)
    if (!ctx) return NextResponse.json({ error: 'Missing or unknown tenant' }, { status: 400 })
    const requests = await listServiceRequests(ctx.tenantId)
    return NextResponse.json({ requests })
  } catch (error) {
    console.error('[guest-services/requests][GET] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await resolveTenant(request)
    if (!ctx) return NextResponse.json({ error: 'Missing or unknown tenant' }, { status: 400 })
    const body = await request.json()
    if (!body.id) return NextResponse.json({ error: 'id is required' }, { status: 400 })
    const req_ = await upsertServiceRequest(ctx.tenantId, body.id, body)
    await createAuditLog(ctx.tenantId, null, 'SERVICE_REQUEST_SAVED', 'ServiceRequest', body.id, undefined, { status: req_.status }, request)
    return NextResponse.json({ request: req_ })
  } catch (error) {
    console.error('[guest-services/requests][POST] error', error)
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
    const ok = await deleteServiceRequest(ctx.tenantId, id)
    if (!ok) return NextResponse.json({ error: 'Request not found' }, { status: 404 })
    await createAuditLog(ctx.tenantId, null, 'SERVICE_REQUEST_DELETED', 'ServiceRequest', id, undefined, undefined, request)
    return NextResponse.json({ message: 'Deleted' })
  } catch (error) {
    console.error('[guest-services/requests][DELETE] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
