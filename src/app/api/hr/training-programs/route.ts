import { NextRequest, NextResponse } from 'next/server'
import { getTenantFromRequest, getTenantContext, createAuditLog } from '@/app/lib/api/tenant'
import { listHrTrainingPrograms, upsertHrTrainingProgram, deleteHrTrainingProgram } from '@/app/lib/hr/repository'

async function resolveTenant(req: NextRequest) {
  const subdomain = getTenantFromRequest(req)
  if (!subdomain) return null
  return getTenantContext(subdomain)
}

export async function GET(request: NextRequest) {
  try {
    const ctx = await resolveTenant(request)
    if (!ctx) return NextResponse.json({ error: 'Missing or unknown tenant' }, { status: 400 })
    const programs = await listHrTrainingPrograms(ctx.tenantId)
    return NextResponse.json({ programs })
  } catch (error) {
    console.error('[hr/training-programs][GET] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await resolveTenant(request)
    if (!ctx) return NextResponse.json({ error: 'Missing or unknown tenant' }, { status: 400 })
    const body = await request.json()
    if (!body.id) return NextResponse.json({ error: 'id is required' }, { status: 400 })
    const program = await upsertHrTrainingProgram(ctx.tenantId, body.id, body)
    await createAuditLog(ctx.tenantId, null, 'HR_TRAINING_PROGRAM_SAVED', 'HrTrainingProgram', body.id, undefined, { title: program.title }, request)
    return NextResponse.json({ program })
  } catch (error) {
    console.error('[hr/training-programs][POST] error', error)
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
    const ok = await deleteHrTrainingProgram(ctx.tenantId, id)
    if (!ok) return NextResponse.json({ error: 'Training program not found' }, { status: 404 })
    await createAuditLog(ctx.tenantId, null, 'HR_TRAINING_PROGRAM_DELETED', 'HrTrainingProgram', id, undefined, undefined, request)
    return NextResponse.json({ message: 'Deleted' })
  } catch (error) {
    console.error('[hr/training-programs][DELETE] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
