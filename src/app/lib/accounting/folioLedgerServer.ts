/**
 * Server runner for the guest folio → general ledger reconcile (IFRS 15).
 * The rules and the planning live in folioLedgerPlan.ts (pure, unit tested).
 */

import { prisma } from '../database/client'
import { salesTaxConfigsForTenant } from '../tax/serverConfigs'
import { GL_ACCOUNTS } from './glAccounts'
import { allocateJournalEntryNumber, createJournalEntry } from './repository'
import { mirrorGlCashToCashbookServer } from './cashbookMirrorServer'
import { CLOSE_SOURCE } from './periodClose'
import { asLineArray, roundCents } from '../frontoffice/folioLedger'
import {
  CASH_CODES,
  FOLIO_LEDGER_SOURCE,
  LEGACY_CHECKOUT_SOURCE,
  ledgerStateFromEntries,
  planCheckoutClose,
  planFolioPostings,
} from './folioLedgerPlan'

export { FOLIO_LEDGER_SOURCE }

const signed = (amount: number) => roundCents(amount)

function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate.slice(0, 10)}T12:00:00.000Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString()
}

export type FolioLedgerSyncResult = { posted: number; skipped?: 'not-found' | 'legacy-checkout' | 'no-show' | 'checked-out' | 'closed' }

/**
 * Bring the books in line with this stay's folios. Call after any folio change, at check-in,
 * and at checkout (with `checkout`), which also moves what is still owed to receivables.
 */
// One sync per stay at a time in this server process, so two saves never post the same difference twice.
const running = new Map<string, Promise<unknown>>()

export async function syncReservationFolioToLedger(
  tenantId: string,
  reservationId: string,
  opts: { checkout?: { roundingAdjustment?: number }; postedBy?: string } = {},
): Promise<FolioLedgerSyncResult> {
  const lockKey = `${tenantId}:${reservationId}`
  const previous = running.get(lockKey) || Promise.resolve()
  const job = previous.catch(() => {}).then(() => syncOnce(tenantId, reservationId, opts))
  running.set(lockKey, job)
  try {
    return await job
  } finally {
    if (running.get(lockKey) === job) running.delete(lockKey)
  }
}

async function syncOnce(
  tenantId: string,
  reservationId: string,
  opts: { checkout?: { roundingAdjustment?: number }; postedBy?: string },
): Promise<FolioLedgerSyncResult> {
  const reservation = await prisma.reservation.findFirst({ where: { id: reservationId, tenantId } })
  if (!reservation) return { posted: 0, skipped: 'not-found' }
  const status = String(reservation.status || '')
  // The night audit posts a no-show's penalty and card guarantee itself.
  if (status === 'no-show') return { posted: 0, skipped: 'no-show' }

  const legacy = await prisma.journalEntry.findFirst({
    where: { tenantId, sourceModule: LEGACY_CHECKOUT_SOURCE, sourceTransactionId: reservationId },
    select: { id: true },
  })
  if (legacy) return { posted: 0, skipped: 'legacy-checkout' }

  const existing = await prisma.journalEntry.findMany({
    where: { tenantId, sourceModule: FOLIO_LEDGER_SOURCE, sourceTransactionId: { startsWith: `${reservationId}:` } },
    select: { sourceTransactionId: true, lines: { select: { accountCode: true, debit: true, credit: true, taxCode: true } } },
  })
  const state = ledgerStateFromEntries(reservationId, existing as never)
  // After checkout only refunds/voids of payments taken during the stay are posted here;
  // later charges and new receipts go through Accounts Receivable.
  const afterCheckout = state.usedKeys.has(`${reservationId}:CLOSE`)
  if (!afterCheckout && status === 'checked-out' && !opts.checkout) return { posted: 0, skipped: 'checked-out' }

  const folios = await prisma.guestFolio.findMany({ where: { tenantId, reservationId } })
  const charges = folios.flatMap((f) => asLineArray(f.charges))
  const payments = folios.flatMap((f) => asLineArray(f.payments))
  const taxConfigs = await salesTaxConfigsForTenant(tenantId)
  const now = new Date().toISOString()
  const guest = await prisma.guest.findFirst({ where: { id: reservation.guestId, tenantId }, select: { name: true } })
  const label = [reservation.resId || reservation.id, guest?.name].filter(Boolean).join(' ')
  const inHouse = status === 'checked-in' || !!opts.checkout

  const planned = planFolioPostings({ reservationId, label, inHouse, charges, payments, state, taxConfigs, now, afterCheckout })
  if (opts.checkout && !afterCheckout) {
    const ledgerAfter = roundCents(
      state.guestLedgerBalance + planned.reduce((s, e) => s + e.lines.filter((l) => l.accountCode === GL_ACCOUNTS.GUEST_LEDGER).reduce((t, l) => t + l.amount, 0), 0),
    )
    planned.push(...planCheckoutClose({ reservationId, label, guestLedgerBalance: ledgerAfter, roundingAdjustment: opts.checkout.roundingAdjustment || 0, usedKeys: new Set([...state.usedKeys, ...planned.map((e) => e.key)]), now }))
  }
  if (planned.length === 0) return { posted: 0 }

  // Nothing is posted into a closed period; it lands on the first open day instead.
  const lastClose = await prisma.journalEntry.findFirst({
    where: { tenantId, sourceModule: CLOSE_SOURCE, status: 'Posted' },
    orderBy: { date: 'desc' },
    select: { date: true },
  })
  const firstOpenDay = lastClose ? addDays(lastClose.date.toISOString(), 1) : null

  let posted = 0
  for (const entry of planned) {
    const lines = entry.lines.filter((l) => Math.abs(l.amount) >= 0.005)
    const total = roundCents(lines.reduce((s, l) => s + Math.max(0, l.amount), 0))
    const date = firstOpenDay && entry.date < firstOpenDay ? firstOpenDay : entry.date
    // Another server copy may have just posted this exact line.
    const taken = await prisma.journalEntry.findFirst({ where: { tenantId, sourceModule: FOLIO_LEDGER_SOURCE, sourceTransactionId: entry.key }, select: { id: true } })
    if (taken) continue
    // An empty CLOSE still gets written: it marks the stay as handed over to receivables.
    const entryNumber = await allocateJournalEntryNumber(tenantId)
    const je = await createJournalEntry(tenantId, {
      entryNumber,
      date,
      reference: reservation.resId || reservation.id,
      description: entry.description,
      totalDebit: total,
      totalCredit: total,
      currency: 'GHS',
      status: 'Posted',
      postedBy: opts.postedBy || 'front-office',
      postedAt: now,
      sourceModule: FOLIO_LEDGER_SOURCE,
      sourceTransactionId: entry.key,
      lines: lines.map((l) => ({
        accountCode: l.accountCode,
        description: l.description,
        debit: l.amount > 0 ? signed(l.amount) : 0,
        credit: l.amount < 0 ? signed(-l.amount) : 0,
        currency: 'GHS',
        reference: reservation.resId || reservation.id,
        ...(l.taxCode ? { taxCode: l.taxCode } : {}),
        ...(l.costCenter ? { costCenter: l.costCenter } : {}),
      })) as never,
    })
    posted += 1
    // Cash, bank and MoMo movements also show in the cashbook, like every other receipt.
    for (const l of lines) {
      if (!CASH_CODES.has(l.accountCode)) continue
      await mirrorGlCashToCashbookServer({
        tenantId,
        glCode: l.accountCode,
        amount: Math.abs(l.amount),
        direction: l.amount > 0 ? 'in' : 'out',
        date,
        reference: reservation.resId || reservation.id,
        description: entry.description,
        journalEntryId: je.id,
      }).catch((e) => console.warn('[folio-ledger] cashbook mirror failed', e))
    }
  }
  return { posted }
}
