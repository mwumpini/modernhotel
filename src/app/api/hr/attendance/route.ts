import { NextRequest, NextResponse } from 'next/server'
import { getTenantFromRequest, getTenantContext, createAuditLog } from '@/app/lib/api/tenant'
import { listHrAttendances, upsertHrAttendance } from '@/app/lib/hr/repository'

async function resolveTenant(req: NextRequest) {
  const subdomain = getTenantFromRequest(req)
  if (!subdomain) return null
  return getTenantContext(subdomain)
}

export async function GET(request: NextRequest) {
  try {
    const ctx = await resolveTenant(request)
    if (!ctx) return NextResponse.json({ error: 'Missing or unknown tenant' }, { status: 400 })
    const attendances = await listHrAttendances(ctx.tenantId)
    return NextResponse.json({ attendances })
  } catch (error) {
    console.error('[hr/attendance][GET] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await resolveTenant(request)
    if (!ctx) return NextResponse.json({ error: 'Missing or unknown tenant' }, { status: 400 })
    const body = await request.json()
    if (!body.id) return NextResponse.json({ error: 'id is required' }, { status: 400 })
    const attendance = await upsertHrAttendance(ctx.tenantId, body.id, body)
    await createAuditLog(ctx.tenantId, null, 'HR_ATTENDANCE_SAVED', 'HrAttendance', body.id, undefined, { employeeId: attendance.employeeId, status: attendance.status }, request)
    return NextResponse.json({ attendance })
  } catch (error) {
    console.error('[hr/attendance][POST] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
