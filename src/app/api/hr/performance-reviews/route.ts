import { NextRequest, NextResponse } from 'next/server'
import { getTenantFromRequest, getTenantContext, createAuditLog } from '@/app/lib/api/tenant'
import { listHrPerformanceReviews, upsertHrPerformanceReview, deleteHrPerformanceReview } from '@/app/lib/hr/repository'

async function resolveTenant(req: NextRequest) {
  const subdomain = getTenantFromRequest(req)
  if (!subdomain) return null
  return getTenantContext(subdomain)
}

export async function GET(request: NextRequest) {
  try {
    const ctx = await resolveTenant(request)
    if (!ctx) return NextResponse.json({ error: 'Missing or unknown tenant' }, { status: 400 })
    const reviews = await listHrPerformanceReviews(ctx.tenantId)
    return NextResponse.json({ reviews })
  } catch (error) {
    console.error('[hr/performance-reviews][GET] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await resolveTenant(request)
    if (!ctx) return NextResponse.json({ error: 'Missing or unknown tenant' }, { status: 400 })
    const body = await request.json()
    if (!body.id) return NextResponse.json({ error: 'id is required' }, { status: 400 })
    const review = await upsertHrPerformanceReview(ctx.tenantId, body.id, body)
    await createAuditLog(ctx.tenantId, null, 'HR_PERFORMANCE_REVIEW_SAVED', 'HrPerformanceReview', body.id, undefined, { employeeId: review.employeeId, status: review.status }, request)
    return NextResponse.json({ review })
  } catch (error) {
    console.error('[hr/performance-reviews][POST] error', error)
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
    const ok = await deleteHrPerformanceReview(ctx.tenantId, id)
    if (!ok) return NextResponse.json({ error: 'Performance review not found' }, { status: 404 })
    await createAuditLog(ctx.tenantId, null, 'HR_PERFORMANCE_REVIEW_DELETED', 'HrPerformanceReview', id, undefined, undefined, request)
    return NextResponse.json({ message: 'Deleted' })
  } catch (error) {
    console.error('[hr/performance-reviews][DELETE] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
