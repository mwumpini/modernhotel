import { NextRequest, NextResponse } from 'next/server'
import { getTenantFromRequest, getTenantContext, createAuditLog } from '@/app/lib/api/tenant'
import { listHrTrainingRecords, upsertHrTrainingRecord, deleteHrTrainingRecord } from '@/app/lib/hr/repository'

async function resolveTenant(req: NextRequest) {
  const subdomain = getTenantFromRequest(req)
  if (!subdomain) return null
  return getTenantContext(subdomain)
}

export async function GET(request: NextRequest) {
  try {
    const ctx = await resolveTenant(request)
    if (!ctx) return NextResponse.json({ error: 'Missing or unknown tenant' }, { status: 400 })
    const records = await listHrTrainingRecords(ctx.tenantId)
    return NextResponse.json({ records })
  } catch (error) {
    console.error('[hr/training-records][GET] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await resolveTenant(request)
    if (!ctx) return NextResponse.json({ error: 'Missing or unknown tenant' }, { status: 400 })
    const body = await request.json()
    if (!body.id) return NextResponse.json({ error: 'id is required' }, { status: 400 })
    const record = await upsertHrTrainingRecord(ctx.tenantId, body.id, body)
    await createAuditLog(ctx.tenantId, null, 'HR_TRAINING_RECORD_SAVED', 'HrTrainingRecord', body.id, undefined, { employeeId: record.employeeId, status: record.status }, request)
    return NextResponse.json({ record })
  } catch (error) {
    console.error('[hr/training-records][POST] error', error)
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
    const ok = await deleteHrTrainingRecord(ctx.tenantId, id)
    if (!ok) return NextResponse.json({ error: 'Training record not found' }, { status: 404 })
    await createAuditLog(ctx.tenantId, null, 'HR_TRAINING_RECORD_DELETED', 'HrTrainingRecord', id, undefined, undefined, request)
    return NextResponse.json({ message: 'Deleted' })
  } catch (error) {
    console.error('[hr/training-records][DELETE] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
