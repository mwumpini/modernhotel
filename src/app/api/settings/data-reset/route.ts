import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/app/lib/api/auth-guard'
import { readDataResetAt } from '@/app/lib/maintenance/dataResetMarker'

// GET — when this hotel's test data was last cleared (null if never). Any signed-in user.
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (!auth.ok) return auth.response
    const tenantId = (auth.session as any)?.user?.tenantId as string | undefined
    if (!tenantId) return NextResponse.json({ resetAt: null })
    return NextResponse.json({ resetAt: await readDataResetAt(tenantId) })
  } catch (error) {
    console.error('[settings/data-reset][GET] error', error)
    return NextResponse.json({ resetAt: null })
  }
}
