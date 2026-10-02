import { NextRequest, NextResponse } from 'next/server'
import { createAuditLog } from '@/app/lib/api/tenant'
import { requirePermission } from '@/app/lib/api/auth-guard'
import { clearTestData, countTestData } from '@/app/lib/maintenance/clearTestData'

/**
 * Settings → Sample Data → "Clear test data". Admin only, same permission as loading sample data.
 * The hotel comes from the signed-in session, never from a header, because this deletes records.
 */
const PERMISSION = 'settings.manage-sample-data'

async function adminTenant(request: NextRequest) {
  const auth = await requirePermission(request, PERMISSION)
  if (!auth.ok) return { error: auth.response }
  const user = (auth.session as any)?.user
  if (user?.role !== 'admin') {
    return { error: NextResponse.json({ error: 'Only an administrator can clear test data' }, { status: 403 }) }
  }
  const tenantId = user?.tenantId as string | undefined
  if (!tenantId) return { error: NextResponse.json({ error: 'No hotel on this session' }, { status: 400 }) }
  return { tenantId, userId: user?.id as string | undefined }
}

// GET — what a clear would remove (changes nothing).
export async function GET(request: NextRequest) {
  try {
    const who = await adminTenant(request)
    if ('error' in who) return who.error
    return NextResponse.json(await countTestData(who.tenantId))
  } catch (error) {
    console.error('[settings/test-data][GET] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// POST { confirm: 'CLEAR' } — clears test data and reloads sample data if it was loaded.
export async function POST(request: NextRequest) {
  try {
    const who = await adminTenant(request)
    if ('error' in who) return who.error
    const body = await request.json().catch(() => ({}))
    if (body?.confirm !== 'CLEAR') {
      return NextResponse.json({ error: 'Type CLEAR to confirm' }, { status: 400 })
    }
    const before = await countTestData(who.tenantId)
    const result = await clearTestData(who.tenantId)
    await createAuditLog(who.tenantId, who.userId ?? null, 'TEST_DATA_CLEARED', 'Tenant', who.tenantId, { total: before.total }, { removed: result.removed, sampleReloaded: result.sampleReloaded }, request)
    return NextResponse.json(result)
  } catch (error) {
    console.error('[settings/test-data][POST] error', error)
    return NextResponse.json({ error: 'Clearing failed. Nothing was removed.' }, { status: 500 })
  }
}
