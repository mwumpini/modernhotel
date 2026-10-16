/**
 * Server runner for the guest folio → general ledger reconcile (IFRS 15).
 * The rules and the planning live in folioLedgerPlan.ts (pure, unit tested).
 */

import { prisma } from '../database/client'
import { salesTaxConfigsForTenant } from '../tax/serverConfigs'
import { computeStackedTaxLines } from './taxFromConfig'
import { GL_ACCOUNTS } from './glAccounts'
import { allocateJournalEntryNumber, createJournalEntry } from './repository'
import { mirrorGlCashToCashbookServer } from './cashbookMirrorServer'
import { CLOSE_SOURCE } from './periodClose'
import { asLineArray, recomputeFolioTotals, roundCents, type FolioLineJson } from '../frontoffice/folioLedger'
import { appendGuestFolioCharge, ensureGuestFolio, loadFolioRounding } from '../frontoffice/folioServer'
import { computeBookingPenalty, type BookingPenalty, type BookingPolicy, type RateNight } from '../frontoffice/bookingPenalty'
import {
  CASH_CODES,
  FOLIO_LEDGER_SOURCE,
  LEGACY_CHECKOUT_SOURCE,
  ledgerStateFromEntries,
  planCheckoutClose,
  planFolioPostings,
  splitTax,
  type PlannedEntry,
} from './folioLedgerPlan'

export { FOLIO_LEDGER_SOURCE }

const signed = (amount: number) => roundCents(amount)

function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate.slice(0, 10)}T12:00:00.000Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString()
}

export type FolioLedgerSyncResult = { posted: number; skipped?: 'not-found' | 'legacy-checkout' | 'no-show' | 'checked-out' | 'closed' }

type SyncOpts = { checkout?: { roundingAdjustment?: number }; postedBy?: string; settling?: boolean }

// One sync per stay at a time in this server process, so two saves never post the same difference twice.
const running = new Map<string, Promise<unknown>>()

function serialised<T>(tenantId: string, reservationId: string, work: () => Promise<T>): Promise<T> {
  const lockKey = `${tenantId}:${reservationId}`
  const previous = running.get(lockKey) || Promise.resolve()
  const job = previous.catch(() => {}).then(work)
  running.set(lockKey, job)
  return job.finally(() => {
    if (running.get(lockKey) === job) running.delete(lockKey)
  })
}

/**
 * Bring the books in line with this stay's folios. Call after any folio change, at check-in,
 * and at checkout (with `checkout`), which also moves what is still owed to receivables.
 */
export function syncReservationFolioToLedger(tenantId: string, reservationId: string, opts: SyncOpts = {}): Promise<FolioLedgerSyncResult> {
  return serialised(tenantId, reservationId, () => syncOnce(tenantId, reservationId, opts))
}

async function loadStay(tenantId: string, reservationId: string) {
  const reservation = await prisma.reservation.findFirst({ where: { id: reservationId, tenantId } })
  if (!reservation) return null
  const existing = await prisma.journalEntry.findMany({
    where: { tenantId, sourceModule: FOLIO_LEDGER_SOURCE, sourceTransactionId: { startsWith: `${reservationId}:` } },
    select: { sourceTransactionId: true, lines: { select: { accountCode: true, debit: true, credit: true, taxCode: true } } },
  })
  const state = ledgerStateFromEntries(reservationId, existing as never)
  const guest = await prisma.guest.findFirst({ where: { id: reservation.guestId, tenantId }, select: { name: true } })
  const label = [reservation.resId || reservation.id, guest?.name].filter(Boolean).join(' ')
  return { reservation, state, label }
}

async function syncOnce(tenantId: string, reservationId: string, opts: SyncOpts): Promise<FolioLedgerSyncResult> {
  const stay = await loadStay(tenantId, reservationId)
  if (!stay) return { posted: 0, skipped: 'not-found' }
  const { reservation, state, label } = stay
  const status = String(reservation.status || '')
  // A no-show is settled once (settleBookingPenalty). Older no-shows were posted by the night
  // audit itself, so they are only synced when they went through the new settlement.
  if (status === 'no-show' && !opts.settling && !state.usedKeys.has(`${reservationId}:PENALTY`)) {
    return { posted: 0, skipped: 'no-show' }
  }

  const legacy = await prisma.journalEntry.findFirst({
    where: { tenantId, sourceModule: LEGACY_CHECKOUT_SOURCE, sourceTransactionId: reservationId },
    select: { id: true },
  })
  if (legacy) return { posted: 0, skipped: 'legacy-checkout' }

  // After checkout only refunds/voids of payments taken during the stay are posted here;
  // later charges and new receipts go through Accounts Receivable.
  const afterCheckout = state.usedKeys.has(`${reservationId}:CLOSE`)
  if (!afterCheckout && status === 'checked-out' && !opts.checkout) return { posted: 0, skipped: 'checked-out' }

  const folios = await prisma.guestFolio.findMany({ where: { tenantId, reservationId } })
  const charges = folios.flatMap((f) => asLineArray(f.charges))
  const payments = folios.flatMap((f) => asLineArray(f.payments))
  const taxConfigs = await salesTaxConfigsForTenant(tenantId)
  const now = new Date().toISOString()
  const inHouse = status === 'checked-in' || !!opts.checkout
  // A cancelled or no-show booking never had a stay: only its deposit and refunds move.
  const paymentsOnly = status === 'cancelled' || status === 'no-show'

  const planned = planFolioPostings({ reservationId, label, inHouse, charges, payments, state, taxConfigs, now, afterCheckout, paymentsOnly })
  if (opts.checkout && !afterCheckout) {
    const ledgerAfter = roundCents(
      state.guestLedgerBalance + planned.reduce((s, e) => s + e.lines.filter((l) => l.accountCode === GL_ACCOUNTS.GUEST_LEDGER).reduce((t, l) => t + l.amount, 0), 0),
    )
    planned.push(...planCheckoutClose({ reservationId, label, guestLedgerBalance: ledgerAfter, roundingAdjustment: opts.checkout.roundingAdjustment || 0, usedKeys: new Set([...state.usedKeys, ...planned.map((e) => e.key)]), now }))
  }
  return { posted: await postEntries(tenantId, reservation, planned, opts.postedBy, now) }
}

async function postEntries(
  tenantId: string,
  reservation: { id: string; resId: string | null },
  planned: PlannedEntry[],
  postedBy: string | undefined,
  now: string,
): Promise<number> {
  if (planned.length === 0) return 0
  // Nothing is posted into a closed period; it lands on the first open day instead.
  const lastClose = await prisma.journalEntry.findFirst({
    where: { tenantId, sourceModule: CLOSE_SOURCE, status: 'Posted' },
    orderBy: { date: 'desc' },
    select: { date: true },
  })
  const firstOpenDay = lastClose ? addDays(lastClose.date.toISOString(), 1) : null
  const reference = reservation.resId || reservation.id

  let posted = 0
  for (const entry of planned) {
    const lines = entry.lines.filter((l) => Math.abs(l.amount) >= 0.005)
    const total = roundCents(lines.reduce((s, l) => s + Math.max(0, l.amount), 0))
    const date = firstOpenDay && entry.date < firstOpenDay ? firstOpenDay : entry.date
    // Another server copy may have just posted this exact line.
    const taken = await prisma.journalEntry.findFirst({ where: { tenantId, sourceModule: FOLIO_LEDGER_SOURCE, sourceTransactionId: entry.key }, select: { id: true } })
    if (taken) continue
    // An empty CLOSE or PENALTY still gets written: it marks the step as done.
    const entryNumber = await allocateJournalEntryNumber(tenantId)
    const je = await createJournalEntry(tenantId, {
      entryNumber,
      date,
      reference,
      description: entry.description,
      totalDebit: total,
      totalCredit: total,
      currency: 'GHS',
      status: 'Posted',
      postedBy: postedBy || 'front-office',
      postedAt: now,
      sourceModule: FOLIO_LEDGER_SOURCE,
      sourceTransactionId: entry.key,
      lines: lines.map((l) => ({
        accountCode: l.accountCode,
        description: l.description,
        debit: l.amount > 0 ? signed(l.amount) : 0,
        credit: l.amount < 0 ? signed(-l.amount) : 0,
        currency: 'GHS',
        reference,
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
        reference,
        description: entry.description,
        journalEntryId: je.id,
      }).catch((e) => console.warn('[folio-ledger] cashbook mirror failed', e))
    }
  }
  return posted
}

export type BookingSettlement = BookingPenalty & { settled: boolean; alreadySettled?: boolean }

/**
 * A booking was cancelled or the guest did not arrive: apply the business's own rule
 * (Settings → Operational Policies → Booking changes). The fee comes out of the deposit
 * first; any part of the deposit left over stays in 2450 Guest Deposits as a refund due
 * (staff pay it back; nothing is refunded automatically). A fee larger than the deposit is
 * billed to the guest (receivables), or collected on a guaranteed card for a no-show,
 * unless the business takes fees from the deposit only. Runs once per booking.
 */
export function settleBookingPenalty(
  tenantId: string,
  reservationId: string,
  kind: 'cancel' | 'no-show',
  opts: { postedBy?: string; businessDate?: string } = {},
): Promise<BookingSettlement | null> {
  return serialised(tenantId, reservationId, async () => {
    // Deposits taken but not yet in the books are posted first, so the balance is right.
    await syncOnce(tenantId, reservationId, { postedBy: opts.postedBy, settling: true })
    const stay = await loadStay(tenantId, reservationId)
    if (!stay) return null
    const { reservation, state, label } = stay
    const empty = computeBookingPenalty({ kind, policy: {}, nights: [], deposit: state.depositBalance, taxOn: () => 0 })
    if (state.usedKeys.has(`${reservationId}:PENALTY`)) return { ...empty, settled: false, alreadySettled: true }

    const settings = await prisma.systemSettings.findUnique({ where: { tenantId }, select: { roomSettings: true } })
    const rs = (settings?.roomSettings as Record<string, unknown> | null) || {}
    const policy = rs as BookingPolicy
    const taxConfigs = await salesTaxConfigsForTenant(tenantId)
    const details = (reservation.details as { rateBreakdown?: RateNight[]; taxExempt?: boolean } | null) || {}
    const checkInHour = Number(rs.standardCheckInHour ?? 14)
    const arrival = new Date(reservation.checkInDate)
    arrival.setUTCHours(Number.isFinite(checkInHour) ? checkInHour : 14, 0, 0, 0)
    const hoursBeforeArrival = (arrival.getTime() - Date.now()) / 36e5

    const penalty = computeBookingPenalty({
      kind,
      policy,
      nights: details.rateBreakdown || [],
      deposit: state.depositBalance,
      hoursBeforeArrival,
      taxExempt: !!details.taxExempt,
      taxOn: (net) => computeStackedTaxLines(net, taxConfigs, 'sales').totalTax,
    })

    const now = new Date().toISOString()
    const date = opts.businessDate ? `${opts.businessDate}T12:00:00.000Z` : now
    const what = kind === 'no-show' ? 'No-show charge' : 'Cancellation fee'
    const isGuaranteedCard = kind === 'no-show' && !!reservation.isGuaranteed && penalty.billed.gross > 0
    const taxes = splitTax(penalty.fee.net, penalty.fee.tax, taxConfigs)
    const entries: PlannedEntry[] = [
      {
        key: `${reservationId}:PENALTY`,
        date,
        description: penalty.fee.gross > 0 ? `${what} — ${penalty.reason} · ${label}` : `${what}: none (${penalty.reason}) · ${label}`,
        lines: penalty.fee.gross > 0
          ? [
              { accountCode: GL_ACCOUNTS.GUEST_DEPOSITS, amount: penalty.fromDeposit.gross, description: `Kept from deposit — ${label}` },
              { accountCode: GL_ACCOUNTS.ACCOUNTS_RECEIVABLE, amount: penalty.billed.gross, description: `Billed to guest — ${label}` },
              { accountCode: GL_ACCOUNTS.BOOKING_FEES, amount: -penalty.fee.net, description: `${what} — ${label}` },
              ...taxes.map((t) => ({ accountCode: t.accountCode, amount: -t.amount, description: `${t.name} — ${what}`, taxCode: t.taxCode })),
            ]
          : [],
      },
    ]
    if (isGuaranteedCard) {
      entries.push({
        key: `${reservationId}:PENALTY-CARD`,
        date,
        description: `No-show charge collected on the guarantee card · ${label}`,
        lines: [
          { accountCode: GL_ACCOUNTS.BANK, amount: penalty.billed.gross, description: `Card — ${label}` },
          { accountCode: GL_ACCOUNTS.ACCOUNTS_RECEIVABLE, amount: -penalty.billed.gross, description: `Receivable — ${label}` },
        ],
      })
    }
    await postEntries(tenantId, reservation, entries, opts.postedBy, now)

    // Show it on the folio too, so the bill and the refund due read the same as the books.
    if (penalty.fee.gross > 0) {
      const suffix = reservationId.slice(-8)
      await appendGuestFolioCharge({
        tenantId,
        reservationId,
        charge: { id: `PEN-${kind}-${suffix}`, date, description: what, amount: penalty.fee.net, tax: penalty.fee.tax, category: 'penalty' },
      })
      if (isGuaranteedCard) {
        const folio = await ensureGuestFolio(tenantId, reservationId)
        const pays = asLineArray(folio.payments)
        const payId = `PEN-CARD-${suffix}`
        if (!pays.some((p) => p.id === payId)) {
          pays.push({ id: payId, date, method: 'Card', amount: penalty.billed.gross, status: 'completed', notes: 'No-show charge — card guarantee' } as FolioLineJson)
          const totals = recomputeFolioTotals(asLineArray(folio.charges), pays, await loadFolioRounding(tenantId))
          await prisma.guestFolio.update({ where: { id: folio.id }, data: { payments: pays as never, ...totals } })
        }
      }
    }
    return { ...penalty, settled: true }
  })
}
