import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/app/lib/database/client'
import { FOLIO_LEDGER_SOURCE } from '@/app/lib/accounting/folioLedgerServer'
import { getTenantFromRequest, getTenantContext, createAuditLog } from '@/app/lib/api/tenant'
import { requireAuth } from '@/app/lib/api/auth-guard'
import { listJournalEntries, createJournalEntry } from '@/app/lib/accounting/repository'
import { rejectIfManualBackdated } from '@/app/lib/frontoffice/postingDateGuard'

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
    const backdated = await rejectIfManualBackdated(ctx.tenantId, body)
    if (backdated) return backdated
    if (!body.entryNumber) return NextResponse.json({ error: 'entryNumber is required' }, { status: 400 })
    // A stay already posted night by night must not also get the old all-at-checkout entry
    // (a browser still running the previous version would otherwise book it twice).
    if (body.sourceModule === 'front_office_checkout' && body.sourceTransactionId) {
      const daily = await prisma.journalEntry.findFirst({
        where: { tenantId: ctx.tenantId, sourceModule: FOLIO_LEDGER_SOURCE, sourceTransactionId: { startsWith: `${body.sourceTransactionId}:` } },
        select: { id: true },
      })
      if (daily) return NextResponse.json({ error: 'This stay is already in the books as it happened. Refresh the page.' }, { status: 409 })
    }

    const journalEntry = await createJournalEntry(ctx.tenantId, body)
    await createAuditLog(ctx.tenantId, sessionUserId ?? null, 'JOURNAL_ENTRY_CREATED', 'JournalEntry', journalEntry.id, undefined, { entryNumber: journalEntry.entryNumber, totalDebit: journalEntry.totalDebit, sourceModule: journalEntry.sourceModule }, request)
    return NextResponse.json({ journalEntry }, { status: 201 })
  } catch (error) {
    console.error('[accounting/journal-entries][POST] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
