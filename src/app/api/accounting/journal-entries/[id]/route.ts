import { NextRequest, NextResponse } from 'next/server'
import { getTenantFromRequest, getTenantContext, createAuditLog } from '@/app/lib/api/tenant'
import { requireAuth, requirePermission } from '@/app/lib/api/auth-guard'
import { updateJournalEntryStatus } from '@/app/lib/accounting/repository'
import { prisma } from '@/app/lib/database/client'
import { getApprovalRequirement } from '@/app/lib/api/approvalThresholds'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth(request)
    if (!auth.ok) return auth.response
    const sessionUserId = (auth.session as any).user?.id
    const subdomain = getTenantFromRequest(request)
    if (!subdomain) return NextResponse.json({ error: 'Missing tenant header' }, { status: 400 })
    const ctx = await getTenantContext(subdomain)
    if (!ctx) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

    const { id } = await params
    const body = await request.json()

    // Client always voids via persistJournalEntryStatus(id, {status:'Void'}) —
    // gate specifically on that transition, matching invoices/payments.
    if (body.status === 'Void') {
      const perm = await requirePermission(request, 'accounting.void-transaction')
      if (!perm.ok) return perm.response
    }

    // Posting requires the baseline permission (previously unenforced — anyone
    // authenticated could post). Posting an entry at/above the tenant's
    // configured expense-approval threshold additionally needs director
    // sign-off — rather than hard-reject a poster who lacks that, the request
    // still succeeds but lands in 'Pending Approval' instead of 'Posted', the
    // same "post" action becoming "submit for approval" until someone with
    // accounting.approve-journal-entry runs it again.
    if (body.status === 'Posted') {
      const basePerm = await requirePermission(request, 'accounting.post-journal-entry')
      if (!basePerm.ok) return basePerm.response

      const existing = await prisma.journalEntry.findFirst({ where: { id, tenantId: ctx.tenantId }, select: { totalDebit: true } })
      if (existing) {
        const { needsApproval } = await getApprovalRequirement(ctx.tenantId, 'expense', existing.totalDebit)
        if (needsApproval) {
          const approvePerm = await requirePermission(request, 'accounting.approve-journal-entry')
          if (!approvePerm.ok) {
            body.status = 'Pending Approval'
            body.postedBy = undefined
            body.postedAt = undefined
          }
        }
      }
    }

    const journalEntry = await updateJournalEntryStatus(ctx.tenantId, id, body)
    if (!journalEntry) return NextResponse.json({ error: 'Journal entry not found' }, { status: 404 })
    const action = body.status === 'Void' ? 'JOURNAL_ENTRY_VOIDED' : body.status === 'Pending Approval' ? 'JOURNAL_ENTRY_SUBMITTED_FOR_APPROVAL' : 'JOURNAL_ENTRY_UPDATED'
    await createAuditLog(ctx.tenantId, sessionUserId ?? null, action, 'JournalEntry', id, undefined, { status: journalEntry.status }, request)
    return NextResponse.json({ journalEntry })
  } catch (error) {
    console.error('[accounting/journal-entries/:id][PATCH] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
