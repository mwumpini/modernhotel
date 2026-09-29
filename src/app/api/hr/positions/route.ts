import { NextRequest, NextResponse } from 'next/server'
import { getTenantFromRequest, getTenantContext, createAuditLog } from '@/app/lib/api/tenant'
import { requireAuth } from '@/app/lib/api/auth-guard'
import { listHrPositions, upsertHrPosition, deleteHrPosition } from '@/app/lib/hr/repository'

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
    const positions = await listHrPositions(ctx.tenantId)
    return NextResponse.json({ positions })
  } catch (error) {
    console.error('[hr/positions][GET] error', error)
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
    const position = await upsertHrPosition(ctx.tenantId, body.id, body)
    const sessionUserId = (auth.session as any).user?.id
    await createAuditLog(ctx.tenantId, sessionUserId ?? null, 'HR_POSITION_SAVED', 'HrPosition', body.id, undefined, { title: position.title }, request)
    return NextResponse.json({ position })
  } catch (error) {
    console.error('[hr/positions][POST] error', error)
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
    const ok = await deleteHrPosition(ctx.tenantId, id)
    if (!ok) return NextResponse.json({ error: 'Position not found' }, { status: 404 })
    const sessionUserId = (auth.session as any).user?.id
    await createAuditLog(ctx.tenantId, sessionUserId ?? null, 'HR_POSITION_DELETED', 'HrPosition', id, undefined, undefined, request)
    return NextResponse.json({ message: 'Deleted' })
  } catch (error) {
    console.error('[hr/positions][DELETE] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
