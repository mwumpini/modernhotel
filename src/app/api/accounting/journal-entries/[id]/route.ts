import { NextRequest, NextResponse } from 'next/server'
import { getTenantFromRequest, getTenantContext, createAuditLog } from '@/app/lib/api/tenant'
import { requireAuth } from '@/app/lib/api/auth-guard'
import { updateJournalEntryStatus } from '@/app/lib/accounting/repository'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth(request)
    if (!auth.ok) return auth.response
    const subdomain = getTenantFromRequest(request)
    if (!subdomain) return NextResponse.json({ error: 'Missing tenant header' }, { status: 400 })
    const ctx = await getTenantContext(subdomain)
    if (!ctx) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

    const { id } = await params
    const body = await request.json()
    const journalEntry = await updateJournalEntryStatus(ctx.tenantId, id, body)
    if (!journalEntry) return NextResponse.json({ error: 'Journal entry not found' }, { status: 404 })
    await createAuditLog(ctx.tenantId, null, 'JOURNAL_ENTRY_UPDATED', 'JournalEntry', id, undefined, { status: journalEntry.status }, request)
    return NextResponse.json({ journalEntry })
  } catch (error) {
    console.error('[accounting/journal-entries/:id][PATCH] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
