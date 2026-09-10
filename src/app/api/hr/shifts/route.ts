import { NextRequest, NextResponse } from 'next/server'
import { getTenantFromRequest, getTenantContext, createAuditLog } from '@/app/lib/api/tenant'
import { listHrShifts, upsertHrShift, deleteHrShift } from '@/app/lib/hr/repository'

async function resolveTenant(req: NextRequest) {
  const subdomain = getTenantFromRequest(req)
  if (!subdomain) return null
  return getTenantContext(subdomain)
}

export async function GET(request: NextRequest) {
  try {
    const ctx = await resolveTenant(request)
    if (!ctx) return NextResponse.json({ error: 'Missing or unknown tenant' }, { status: 400 })
    const shifts = await listHrShifts(ctx.tenantId)
    return NextResponse.json({ shifts })
  } catch (error) {
    console.error('[hr/shifts][GET] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await resolveTenant(request)
    if (!ctx) return NextResponse.json({ error: 'Missing or unknown tenant' }, { status: 400 })
    const body = await request.json()
    if (!body.id) return NextResponse.json({ error: 'id is required' }, { status: 400 })
    const shift = await upsertHrShift(ctx.tenantId, body.id, body)
    await createAuditLog(ctx.tenantId, null, 'HR_SHIFT_SAVED', 'HrShift', body.id, undefined, { employeeId: shift.employeeId, date: shift.date }, request)
    return NextResponse.json({ shift })
  } catch (error) {
    console.error('[hr/shifts][POST] error', error)
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
    const ok = await deleteHrShift(ctx.tenantId, id)
    if (!ok) return NextResponse.json({ error: 'Shift not found' }, { status: 404 })
    await createAuditLog(ctx.tenantId, null, 'HR_SHIFT_DELETED', 'HrShift', id, undefined, undefined, request)
    return NextResponse.json({ message: 'Deleted' })
  } catch (error) {
    console.error('[hr/shifts][DELETE] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
