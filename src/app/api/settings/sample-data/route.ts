import { NextRequest, NextResponse } from 'next/server'
import { createAuditLog } from '@/app/lib/api/tenant'
import { requireAuth, requirePermission } from '@/app/lib/api/auth-guard'
import { getSampleDataStatus, loadSampleData, removeSampleData } from '@/app/lib/sampleData'

/**
 * Starter data for testers: an admin loads a set of sample records into THEIR hotel (rooms, guests,
 * stays, staff, stock, events…) and can remove it again later, leaving the hotel's own data alone.
 * The hotel comes from the signed-in session, never from a request header, since this changes data.
 */
const PERMISSION = 'settings.manage-sample-data'

function sessionTenant(auth: { session: unknown }) {
  const user = (auth.session as any)?.user
  return { tenantId: user?.tenantId as string | undefined, userId: user?.id as string | undefined }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (!auth.ok) return auth.response
    const { tenantId } = sessionTenant(auth)
    if (!tenantId) return NextResponse.json({ error: 'No hotel on this session' }, { status: 400 })
    return NextResponse.json(await getSampleDataStatus(tenantId))
  } catch (error) {
    console.error('[settings/sample-data][GET] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requirePermission(request, PERMISSION)
    if (!auth.ok) return auth.response
    const { tenantId, userId } = sessionTenant(auth)
    if (!tenantId) return NextResponse.json({ error: 'No hotel on this session' }, { status: 400 })
    const { notes } = await loadSampleData(tenantId)
    const status = await getSampleDataStatus(tenantId)
    await createAuditLog(tenantId, userId ?? null, 'SAMPLE_DATA_LOADED', 'Tenant', tenantId, undefined, status.counts, request)
    return NextResponse.json({ ...status, notes })
  } catch (error) {
    console.error('[settings/sample-data][POST] error', error)
    return NextResponse.json({ error: 'Could not load the sample data' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requirePermission(request, PERMISSION)
    if (!auth.ok) return auth.response
    const { tenantId, userId } = sessionTenant(auth)
    if (!tenantId) return NextResponse.json({ error: 'No hotel on this session' }, { status: 400 })
    const before = await getSampleDataStatus(tenantId)
    const { kept } = await removeSampleData(tenantId)
    await createAuditLog(tenantId, userId ?? null, 'SAMPLE_DATA_REMOVED', 'Tenant', tenantId, before.counts, { kept }, request)
    return NextResponse.json({ ...(await getSampleDataStatus(tenantId)), kept })
  } catch (error) {
    console.error('[settings/sample-data][DELETE] error', error)
    return NextResponse.json({ error: 'Could not remove the sample data' }, { status: 500 })
  }
}
