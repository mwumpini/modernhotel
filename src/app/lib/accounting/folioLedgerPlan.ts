/**
 * Guest folio → general ledger, as it happens (IFRS 15).
 *
 * Revenue is recognised as the service is delivered: each room night (posted by the
 * night audit), restaurant charge or other folio charge reaches the books on its own
 * date, not at checkout. Money received before arrival is a contract liability (Guest
 * Deposits) until the guest checks in.
 *
 *   Charge (night, F&B, service)   Dr 1215 Guest Ledger      Cr revenue + each tax payable
 *   Void / discount / comp line    the reverse (discounts and comps to 4950 Allowances)
 *   Payment before arrival         Dr cash / bank / MoMo      Cr 2450 Guest Deposits
 *   Payment during the stay        Dr cash / bank / MoMo      Cr 1215 Guest Ledger
 *   "Billed to company"            nothing yet: no money moved; it reaches receivables at checkout
 *   "Credit" on the bill           Dr 4950 Allowances         Cr 1215
 *   Check-in                       Dr 2450 Guest Deposits     Cr 1215 (deposits now count against the stay)
 *   Checkout                       Dr 1210 Receivables        Cr 1215 for whatever is still owed
 *
 * It is a reconcile, not a log: for each folio line the books are compared with what the
 * line says now, and only the difference is posted. Edits, voids, transfers, splits and
 * refunds therefore always end with the books matching the folio, and running it twice
 * posts nothing. Every entry carries `sourceTransactionId = <reservationId>:<kind>:<line>`.
 *
 * Stays checked out under the old rule (one entry at checkout) are left alone.
 */

import { computeStackedTaxLines } from './taxFromConfig'
import { GL_ACCOUNTS, PAYMENT_GL_MAP, revenueCenterForGl } from './glAccounts'
import { chargeNet, folioChargeGlCode, roundCents, type FolioLineJson } from '../frontoffice/folioLedger'
import type { TaxConfig } from './models'
import { remapComplianceGlToChart } from '../tax/glMap'

export const FOLIO_LEDGER_SOURCE = 'guest_folio'
export const LEGACY_CHECKOUT_SOURCE = 'front_office_checkout'
export const CASH_CODES = new Set(['1110', '1120', '1130'])

export type PlannedLine = { accountCode: string; amount: number; description: string; taxCode?: string; costCenter?: string }
export type PlannedEntry = { key: string; date: string; description: string; lines: PlannedLine[] }

/** What the books already hold for one folio line (summed over its entries). */
export type PostedLineState = { gross: number; tax: number; ledgerCode?: string; taxParts?: Map<string, { amount: number; taxCode: string }> }

export type FolioLedgerState = {
  /** Per line key: charges `C:<lineId>`, payments `P:<lineId>`. */
  posted: Map<string, PostedLineState>
  /** Balance of 2450 Guest Deposits for this stay (credit positive). */
  depositBalance: number
  /** Balance of 1215 Guest Ledger for this stay (debit positive). */
  guestLedgerBalance: number
  /** Keys already used, so a new entry never reuses one. */
  usedKeys: Set<string>
}


function isDiscountLine(c: FolioLineJson): boolean {
  const d = String(c.description || '')
  return (d.startsWith('Discount: ') || d.startsWith('Complimentary: ')) && Number(c.amount) < 0
}

/** Revenue account for a charge line. A void goes back to the account of the charge it voids. */
export function revenueAccountForLine(c: FolioLineJson, allCharges: FolioLineJson[]): string {
  if (isDiscountLine(c)) return GL_ACCOUNTS.ALLOWANCES
  const voids = String((c as { voidsChargeId?: string }).voidsChargeId || '')
  if (voids) {
    const original = allCharges.find((x) => x.id === voids)
    if (original) return folioChargeGlCode(original as never)
  }
  return folioChargeGlCode(c as never)
}

/**
 * A payment counts for the amount on the line while completed; refunded lines count as nothing.
 * "Corporate Account" is the company taking over the bill, not money: it stays on the guest
 * ledger and moves to receivables with the checkout invoice.
 */
export function effectivePaymentAmount(p: FolioLineJson): number {
  if (String(p.method || '') === 'Corporate Account') return 0
  return (p.status || 'completed') === 'completed' ? roundCents(Number(p.amount || 0)) : 0
}

export function paymentAccount(method?: string): string {
  return PAYMENT_GL_MAP[String(method || 'Cash')] || GL_ACCOUNTS.CASH
}

/** Split a tax amount across the payable accounts the way the stack does (VAT absorbs rounding). */
export function splitTax(net: number, tax: number, configs: TaxConfig[]): Array<{ accountCode: string; amount: number; taxCode: string; name: string }> {
  const absTax = roundCents(Math.abs(tax))
  if (absTax < 0.005) return []
  const sign = tax < 0 ? -1 : 1
  const { lines } = computeStackedTaxLines(Math.abs(net), configs, 'sales', absTax)
  let out = lines.filter((l) => l.amount > 0).map((l) => ({ accountCode: l.glAccountCode, amount: l.amount, taxCode: l.taxCode, name: l.name }))
  if (out.length === 0) {
    const vat = configs.find((c) => c.type === 'VAT' && c.isActive)
    out = [{ accountCode: vat?.glAccountCode || '2110', amount: absTax, taxCode: vat?.code || 'VAT', name: vat?.name || 'VAT' }]
  }
  const gap = roundCents(absTax - out.reduce((s, l) => s + l.amount, 0))
  if (Math.abs(gap) >= 0.005) out[out.length - 1].amount = roundCents(out[out.length - 1].amount + gap)
  return out.map((l) => ({ ...l, amount: roundCents(l.amount * sign) }))
}

/**
 * The tax split stored on the line itself (restaurant bills keep VAT/NHIL/GETFund/Tourism
 * separately). Used when the whole line is being posted or reversed; partial changes are re-split.
 */
function storedTaxSplit(line: FolioLineJson | null, dTax: number): Array<{ accountCode: string; amount: number; taxCode: string; name: string }> | null {
  const raw = (line as { taxLines?: unknown } | null)?.taxLines
  if (!line || !Array.isArray(raw) || raw.length === 0) return null
  const lineTax = roundCents(Math.abs(Number(line.tax || 0)))
  if (lineTax < 0.005 || Math.abs(Math.abs(dTax) - lineTax) >= 0.01) return null
  const parts = raw
    .map((t: { taxCode?: string; name?: string; amount?: number; glAccountCode?: string | null }) => ({
      accountCode: remapComplianceGlToChart(String(t?.glAccountCode || '').trim()) || '2110',
      amount: roundCents(Math.abs(Number(t?.amount || 0))),
      taxCode: String(t?.taxCode || t?.name || 'TAX'),
      name: String(t?.name || t?.taxCode || 'Tax'),
    }))
    .filter((t) => t.amount > 0)
  if (parts.length === 0) return null
  const gap = roundCents(Math.abs(dTax) - parts.reduce((s, t) => s + t.amount, 0))
  if (Math.abs(gap) >= 0.005) {
    const vat = parts.findIndex((t) => t.accountCode === '2110')
    const i = vat >= 0 ? vat : parts.length - 1
    parts[i].amount = roundCents(parts[i].amount + gap)
  }
  const sign = dTax < 0 ? -1 : 1
  return parts.map((t) => ({ ...t, amount: roundCents(t.amount * sign) }))
}

/** Lines the cancellation/no-show settlement (or the old night-audit no-show) already posted. */
export function isSettledLine(line: FolioLineJson): boolean {
  const id = String(line?.id || '')
  return id.startsWith('PEN-') || id.startsWith('C-NS-') || id.startsWith('P-NS-')
}

function nextKey(base: string, used: Set<string>): string {
  if (!used.has(base)) return base
  let n = 2
  while (used.has(`${base}:${n}`)) n++
  return `${base}:${n}`
}

/**
 * Work out the entries that bring the books in line with the folio. Pure: no database.
 * `inHouse` is true once the guest has checked in (or at checkout).
 */
export function planFolioPostings(params: {
  reservationId: string
  label: string
  inHouse: boolean
  charges: FolioLineJson[]
  payments: FolioLineJson[]
  state: FolioLedgerState
  taxConfigs: TaxConfig[]
  now: string
  /**
   * After checkout the stay lives in receivables. Only refunds or voids of payments taken
   * during the stay are posted here (against 1210); later charges and new receipts go
   * through Accounts Receivable.
   */
  afterCheckout?: boolean
  /** Cancelled or no-show booking: only deposits and refunds move; the fee is settled separately. */
  paymentsOnly?: boolean
}): PlannedEntry[] {
  const { reservationId, label, inHouse, state, taxConfigs, now, afterCheckout, paymentsOnly } = params
  // Fee lines written by the cancellation/no-show settlement are already in the books.
  const charges = params.charges.filter((l) => !isSettledLine(l))
  const payments = params.payments.filter((l) => !isSettledLine(l))
  const entries: PlannedEntry[] = []
  const used = new Set(state.usedKeys)
  const ledger = afterCheckout ? GL_ACCOUNTS.ACCOUNTS_RECEIVABLE : inHouse ? GL_ACCOUNTS.GUEST_LEDGER : GL_ACCOUNTS.GUEST_DEPOSITS
  const seenCharges = new Set<string>()
  const seenPayments = new Set<string>()

  const chargeEntry = (lineKey: string, line: FolioLineJson | null, dNet: number, dTax: number, revenueGl: string, date: string, why: string, taxSource: FolioLineJson | null = line, exactTaxes?: Array<{ accountCode: string; amount: number; taxCode: string; name: string }>) => {
    if (Math.abs(dNet) < 0.005 && Math.abs(dTax) < 0.005) return
    const taxes = exactTaxes || storedTaxSplit(taxSource, dTax) || splitTax(dNet, dTax, taxConfigs)
    const taxTotal = roundCents(taxes.reduce((s, t) => s + t.amount, 0))
    const net = roundCents(dNet)
    const gross = roundCents(net + taxTotal)
    const costCenter = revenueCenterForGl(revenueGl) || undefined
    const key = nextKey(`${reservationId}:${lineKey}`, used)
    used.add(key)
    entries.push({
      key,
      date,
      description: `${why}${line?.description ? ` — ${line.description}` : ''} · ${label}`,
      lines: [
        { accountCode: GL_ACCOUNTS.GUEST_LEDGER, amount: gross, description: `Guest ledger — ${label}` },
        { accountCode: revenueGl, amount: -net, description: String(line?.description || 'Folio charge'), ...(costCenter ? { costCenter } : {}) },
        ...taxes.map((t) => ({ accountCode: t.accountCode, amount: -t.amount, description: `${t.name} — ${label}`, taxCode: t.taxCode })),
      ],
    })
  }

  for (const c of afterCheckout || paymentsOnly ? [] : charges) {
    if (!c?.id) continue
    const lineKey = `C:${c.id}`
    seenCharges.add(lineKey)
    const net = roundCents(chargeNet(c))
    const tax = roundCents(Number(c.tax || 0))
    const posted = state.posted.get(lineKey)
    const dNet = roundCents(net - (posted ? posted.gross - posted.tax : 0))
    const dTax = roundCents(tax - (posted?.tax || 0))
    const isNew = !posted
    const why = isNew ? (net < 0 ? (isDiscountLine(c) ? 'Allowance' : 'Charge voided') : 'Charge') : 'Charge changed'
    const voids = String((c as { voidsChargeId?: string }).voidsChargeId || '')
    const taxSource = voids ? charges.find((x) => x.id === voids) || c : c
    chargeEntry(lineKey, c, dNet, dTax, revenueAccountForLine(c, charges), isNew ? String(c.date || now) : now, why, taxSource)
  }
  // A charge that has left this folio (moved to another room, deleted) comes off the books here.
  for (const [lineKey, posted] of afterCheckout || paymentsOnly ? [] : state.posted) {
    if (!lineKey.startsWith('C:') || seenCharges.has(lineKey)) continue
    if (Math.abs(posted.gross) < 0.005) continue
    // Reverse exactly the tax that was posted for this line.
    const exact = [...(posted.taxParts || new Map()).entries()]
      .filter(([, t]) => Math.abs(t.amount) >= 0.005)
      .map(([accountCode, t]) => ({ accountCode, amount: roundCents(-t.amount), taxCode: t.taxCode, name: t.taxCode }))
    chargeEntry(lineKey, null, -roundCents(posted.gross - posted.tax), -posted.tax, posted.ledgerCode || GL_ACCOUNTS.OTHER_REVENUE, now, 'Charge moved off this folio', null, exact.length ? exact : undefined)
  }

  const paymentEntry = (lineKey: string, line: FolioLineJson | null, delta: number, method: string | undefined, date: string, why: string) => {
    if (Math.abs(delta) < 0.005) return
    const cashGl = paymentAccount(method)
    const key = nextKey(`${reservationId}:${lineKey}`, used)
    used.add(key)
    const amount = roundCents(delta)
    entries.push({
      key,
      date,
      description: `${why} (${method || 'Cash'}) · ${label}`,
      lines: [
        { accountCode: cashGl, amount, description: `${method || 'Cash'} — ${label}` },
        { accountCode: ledger, amount: -amount, description: afterCheckout ? `Receivable — ${label}` : inHouse ? `Guest ledger — ${label}` : `Deposit — ${label}` },
      ],
    })
  }

  for (const p of payments) {
    if (!p?.id) continue
    const lineKey = `P:${p.id}`
    seenPayments.add(lineKey)
    const want = effectivePaymentAmount(p)
    const posted = state.posted.get(lineKey)
    if (afterCheckout && !posted) continue
    const delta = roundCents(want - (posted?.gross || 0))
    const why = !posted ? (inHouse ? 'Payment' : 'Deposit received') : delta < 0 ? 'Payment refunded' : 'Payment changed'
    paymentEntry(lineKey, p, delta, String(p.method || 'Cash'), !posted ? String(p.date || now) : now, why)
  }
  for (const [lineKey, posted] of state.posted) {
    if (!lineKey.startsWith('P:') || seenPayments.has(lineKey)) continue
    if (Math.abs(posted.gross) < 0.005) continue
    paymentEntry(lineKey, null, -posted.gross, posted.ledgerCode, now, 'Payment removed')
  }

  // On check-in, deposits stop being owed back and count against the stay.
  const depositAfter = roundCents(
    state.depositBalance + entries.reduce((s, e) => s - e.lines.filter((l) => l.accountCode === GL_ACCOUNTS.GUEST_DEPOSITS).reduce((t, l) => t + l.amount, 0), 0),
  )
  if (inHouse && !afterCheckout && Math.abs(depositAfter) >= 0.005) {
    const key = nextKey(`${reservationId}:XFER`, used)
    used.add(key)
    entries.push({
      key,
      date: now,
      description: `Deposits applied on arrival · ${label}`,
      lines: [
        { accountCode: GL_ACCOUNTS.GUEST_DEPOSITS, amount: depositAfter, description: `Deposits applied — ${label}` },
        { accountCode: GL_ACCOUNTS.GUEST_LEDGER, amount: -depositAfter, description: `Guest ledger — ${label}` },
      ],
    })
  }

  return entries
}

/** The checkout close: cash rounding, then whatever is still owed moves from the guest ledger to receivables. */
export function planCheckoutClose(params: {
  reservationId: string
  label: string
  guestLedgerBalance: number
  roundingAdjustment: number
  usedKeys: Set<string>
  now: string
}): PlannedEntry[] {
  const { reservationId, label, now } = params
  if (params.usedKeys.has(`${reservationId}:CLOSE`)) return []
  const entries: PlannedEntry[] = []
  const rounding = roundCents(params.roundingAdjustment || 0)
  if (Math.abs(rounding) >= 0.01 && !params.usedKeys.has(`${reservationId}:ROUND`)) {
    entries.push({
      key: `${reservationId}:ROUND`,
      date: now,
      description: `Cash rounding on the bill · ${label}`,
      lines: [
        { accountCode: GL_ACCOUNTS.GUEST_LEDGER, amount: rounding, description: `Guest ledger — ${label}` },
        { accountCode: GL_ACCOUNTS.ROUNDING_ADJUSTMENT, amount: -rounding, description: `Rounding — ${label}` },
      ],
    })
  }
  const owed = roundCents(params.guestLedgerBalance + rounding)
  entries.push({
    key: `${reservationId}:CLOSE`,
    date: now,
    description: Math.abs(owed) >= 0.005 ? `Checkout — balance to receivables · ${label}` : `Checkout — nothing left to collect · ${label}`,
    lines: Math.abs(owed) >= 0.005
      ? [
          { accountCode: GL_ACCOUNTS.ACCOUNTS_RECEIVABLE, amount: owed, description: `Receivable — ${label}` },
          { accountCode: GL_ACCOUNTS.GUEST_LEDGER, amount: -owed, description: `Guest ledger — ${label}` },
        ]
      : [],
  })
  return entries
}

/** Read what the books already hold for this stay from its own entries. */
export function ledgerStateFromEntries(
  reservationId: string,
  entries: Array<{ sourceTransactionId: string | null; lines: Array<{ accountCode: string; debit: number; credit: number; taxCode: string | null }> }>,
): FolioLedgerState {
  const posted = new Map<string, PostedLineState>()
  const usedKeys = new Set<string>()
  let depositBalance = 0
  let guestLedgerBalance = 0
  const prefix = `${reservationId}:`
  for (const e of entries) {
    const key = String(e.sourceTransactionId || '')
    if (!key.startsWith(prefix)) continue
    usedKeys.add(key)
    const parts = key.slice(prefix.length).split(':')
    const lineKey = (parts[0] === 'C' || parts[0] === 'P') && parts[1] ? `${parts[0]}:${parts[1]}` : null
    for (const l of e.lines) {
      const dr = Number(l.debit || 0)
      const cr = Number(l.credit || 0)
      if (l.accountCode === GL_ACCOUNTS.GUEST_DEPOSITS) depositBalance += cr - dr
      if (l.accountCode === GL_ACCOUNTS.GUEST_LEDGER) guestLedgerBalance += dr - cr
      if (!lineKey) continue
      const s = posted.get(lineKey) || { gross: 0, tax: 0 }
      if (lineKey.startsWith('C:')) {
        if (l.accountCode === GL_ACCOUNTS.GUEST_LEDGER) s.gross += dr - cr
        else if (l.taxCode) {
          s.tax += cr - dr
          const parts = s.taxParts || new Map<string, { amount: number; taxCode: string }>()
          const part = parts.get(l.accountCode) || { amount: 0, taxCode: l.taxCode }
          part.amount = roundCents(part.amount + cr - dr)
          parts.set(l.accountCode, part)
          s.taxParts = parts
        }
        else s.ledgerCode = l.accountCode
      } else {
        if (l.accountCode === GL_ACCOUNTS.GUEST_LEDGER || l.accountCode === GL_ACCOUNTS.GUEST_DEPOSITS) s.gross += cr - dr
        else s.ledgerCode = s.ledgerCode || paymentMethodForAccount(l.accountCode)
      }
      posted.set(lineKey, s)
    }
  }
  for (const s of posted.values()) {
    s.gross = roundCents(s.gross)
    s.tax = roundCents(s.tax)
  }
  return { posted, usedKeys, depositBalance: roundCents(depositBalance), guestLedgerBalance: roundCents(guestLedgerBalance) }
}

/** For reversing a payment whose line is gone: the method that leads back to the same account. */
function paymentMethodForAccount(code: string): string {
  const match = Object.entries(PAYMENT_GL_MAP).find(([, gl]) => gl === code)
  return match ? match[0] : 'Cash'
}

