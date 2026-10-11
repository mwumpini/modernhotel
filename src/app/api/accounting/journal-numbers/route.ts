import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/app/lib/api/auth-guard'
import { getTenantFromRequest, getTenantContext } from '@/app/lib/api/tenant'
import { allocateJournalEntryNumber } from '@/app/lib/accounting/repository'

/** POST: take the hotel's next journal number (each call gets a different one). */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (!auth.ok) return auth.response
    const subdomain = getTenantFromRequest(request)
    if (!subdomain) return NextResponse.json({ error: 'Missing tenant header' }, { status: 400 })
    const ctx = await getTenantContext(subdomain)
    if (!ctx) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
    return NextResponse.json({ entryNumber: await allocateJournalEntryNumber(ctx.tenantId) })
  } catch (error) {
    console.error('[accounting/journal-numbers][POST] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
