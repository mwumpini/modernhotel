import { NextRequest, NextResponse } from 'next/server'
import { getTenantFromRequest, getTenantContext, createAuditLog } from '@/app/lib/api/tenant'
import { requireAuth } from '@/app/lib/api/auth-guard'
import { listJournalEntries, createJournalEntry } from '@/app/lib/accounting/repository'

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (!auth.ok) return auth.response
    const subdomain = getTenantFromRequest(request)
    if (!subdomain) return NextResponse.json({ error: 'Missing tenant header' }, { status: 400 })
    const ctx = await getTenantContext(subdomain)
    if (!ctx) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

    const journalEntries = await listJournalEntries(ctx.tenantId)
    return NextResponse.json({ journalEntries })
  } catch (error) {
    console.error('[accounting/journal-entries][GET] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (!auth.ok) return auth.response
    const sessionUserId = (auth.session as any).user?.id
    const subdomain = getTenantFromRequest(request)
    if (!subdomain) return NextResponse.json({ error: 'Missing tenant header' }, { status: 400 })
    const ctx = await getTenantContext(subdomain)
    if (!ctx) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

    const body = await request.json()
    if (!body.entryNumber) return NextResponse.json({ error: 'entryNumber is required' }, { status: 400 })

    const journalEntry = await createJournalEntry(ctx.tenantId, body)
    await createAuditLog(ctx.tenantId, sessionUserId ?? null, 'JOURNAL_ENTRY_CREATED', 'JournalEntry', journalEntry.id, undefined, { entryNumber: journalEntry.entryNumber, totalDebit: journalEntry.totalDebit, sourceModule: journalEntry.sourceModule }, request)
    return NextResponse.json({ journalEntry }, { status: 201 })
  } catch (error) {
    console.error('[accounting/journal-entries][POST] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
