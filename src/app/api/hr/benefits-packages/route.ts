import { NextRequest, NextResponse } from 'next/server'
import { getTenantFromRequest, getTenantContext, createAuditLog } from '@/app/lib/api/tenant'
import { listHrBenefitsPackages, upsertHrBenefitsPackage, deleteHrBenefitsPackage } from '@/app/lib/hr/repository'

async function resolveTenant(req: NextRequest) {
  const subdomain = getTenantFromRequest(req)
  if (!subdomain) return null
  return getTenantContext(subdomain)
}

export async function GET(request: NextRequest) {
  try {
    const ctx = await resolveTenant(request)
    if (!ctx) return NextResponse.json({ error: 'Missing or unknown tenant' }, { status: 400 })
    const packages = await listHrBenefitsPackages(ctx.tenantId)
    return NextResponse.json({ packages })
  } catch (error) {
    console.error('[hr/benefits-packages][GET] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await resolveTenant(request)
    if (!ctx) return NextResponse.json({ error: 'Missing or unknown tenant' }, { status: 400 })
    const body = await request.json()
    if (!body.id) return NextResponse.json({ error: 'id is required' }, { status: 400 })
    const pkg = await upsertHrBenefitsPackage(ctx.tenantId, body.id, body)
    await createAuditLog(ctx.tenantId, null, 'HR_BENEFITS_PACKAGE_SAVED', 'HrBenefitsPackage', body.id, undefined, { name: pkg.name }, request)
    return NextResponse.json({ package: pkg })
  } catch (error) {
    console.error('[hr/benefits-packages][POST] error', error)
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
    const ok = await deleteHrBenefitsPackage(ctx.tenantId, id)
    if (!ok) return NextResponse.json({ error: 'Benefits package not found' }, { status: 404 })
    await createAuditLog(ctx.tenantId, null, 'HR_BENEFITS_PACKAGE_DELETED', 'HrBenefitsPackage', id, undefined, undefined, request)
    return NextResponse.json({ message: 'Deleted' })
  } catch (error) {
    console.error('[hr/benefits-packages][DELETE] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
