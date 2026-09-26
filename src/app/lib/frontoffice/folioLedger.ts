/**
 * Guest folio line math — shared by API routes, F&B billing, and night audit.
 * Pure functions (no Prisma, no React) so the same totals night audit reconstructs
 * are the totals every writer commits.
 */

export const OPEN_FOLIO_STATUSES = ['active', 'open'] as const

export type FolioLineJson = {
  id: string
  date?: string
  description?: string
  amount?: number
  tax?: number
  serviceCharge?: number
  discountAmount?: number
  category?: string
  status?: string
  method?: string
  [key: string]: unknown
}

export type FolioTotals = {
  totalCharges: number
  totalPayments: number
  balance: number
}

export function asLineArray(value: unknown): FolioLineJson[] {
  return Array.isArray(value) ? (value as FolioLineJson[]).filter((l) => l && typeof l === 'object') : []
}

/** Net of a line before tax: amount plus any service charge, minus any discount. */
export function chargeNet(c: FolioLineJson): number {
  return Number(c.amount || 0) + Number(c.serviceCharge || 0) - Number(c.discountAmount || 0)
}

export function chargeGross(c: FolioLineJson): number {
  return chargeNet(c) + Number(c.tax || 0)
}

export type FolioRoundingRule = 'nearest' | 'up' | 'down'

/** Cash rounding for the amount the guest is asked to settle. Defaults match Settings. */
export type FolioRounding = {
  increment?: number
  rule?: FolioRoundingRule
}

export const DEFAULT_FOLIO_ROUNDING: FolioRounding = { increment: 0.5, rule: 'nearest' }

export function roundCents(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

/**
 * Same result as accounting/taxFromConfig roundToIncrement, without reading the
 * browser settings store — night audit and folio saves run on the server.
 */
export function roundFolioTotal(amount: number, rounding: FolioRounding = DEFAULT_FOLIO_ROUNDING): number {
  const rule = rounding.rule || 'nearest'
  const cents = (n: number) => {
    if (rule === 'up') return Math.ceil(n * 100 - Number.EPSILON) / 100
    if (rule === 'down') return Math.floor(n * 100 + Number.EPSILON) / 100
    return Math.round((n + Number.EPSILON) * 100) / 100
  }
  const increment = Number(rounding.increment)
  if (!(increment > 0)) return cents(amount)
  const units = amount / increment
  let roundedUnits: number
  if (rule === 'up') roundedUnits = Math.ceil(units - 1e-9)
  else if (rule === 'down') roundedUnits = Math.floor(units + 1e-9)
  else roundedUnits = Math.round(units + 1e-9)
  return cents(roundedUnits * increment)
}

export function roundingFromFinancialSettings(fs: unknown): FolioRounding {
  const raw = fs && typeof fs === 'object' ? (fs as Record<string, unknown>) : {}
  const hasIncrement = raw.roundToNearest != null && raw.roundToNearest !== ''
  const increment = hasIncrement ? Number(raw.roundToNearest) || 0 : (DEFAULT_FOLIO_ROUNDING.increment as number)
  const rule: FolioRoundingRule =
    raw.roundingRule === 'up' || raw.roundingRule === 'down' || raw.roundingRule === 'nearest'
      ? raw.roundingRule
      : 'nearest'
  return { increment: Number.isFinite(increment) ? increment : 0.5, rule }
}

export function recomputeFolioTotals(
  charges: FolioLineJson[],
  payments: FolioLineJson[],
  rounding: FolioRounding = DEFAULT_FOLIO_ROUNDING,
): FolioTotals {
  const exactCharges = charges.reduce((s, c) => s + chargeGross(c), 0)
  const totalCharges = roundFolioTotal(exactCharges, rounding)
  const totalPayments = payments
    .filter((p) => (p.status || 'completed') === 'completed')
    .reduce((s, p) => s + Number(p.amount || 0), 0)
  return {
    totalCharges,
    totalPayments,
    balance: roundCents(totalCharges - totalPayments),
  }
}

/** A posted room-night line. Room service and other "room…" descriptions are not room revenue. */
export function isPostedRoomCharge(line: { description?: string; category?: string }): boolean {
  const desc = String(line.description || '').toLowerCase()
  if (desc.includes('room service')) return false
  const cat = String(line.category || '').toLowerCase()
  if (cat === 'f&b' || cat === 'fb') return false
  if (cat === 'room' || cat === 'accommodation') return true
  return desc.includes('room charge')
}

/** Union by id. Incoming overwrites the same id; server-only lines are kept. */
export function mergeLinesById(existing: FolioLineJson[], incoming: FolioLineJson[]): FolioLineJson[] {
  const map = new Map<string, FolioLineJson>()
  for (const line of existing) {
    if (line?.id) map.set(String(line.id), line)
  }
  for (const line of incoming) {
    if (!line) continue
    if (line.id) map.set(String(line.id), line)
    else map.set(`anon-${map.size}-${Date.now()}`, line)
  }
  return Array.from(map.values())
}

export function mergeFolioStatus(existingStatus: string | undefined, incomingStatus: string | undefined): string {
  const incoming = incomingStatus || 'active'
  const existing = existingStatus || 'active'
  if (existing === 'closed' || incoming === 'closed') return 'closed'
  return incoming
}

export function lineOnBusinessDate(line: FolioLineJson, businessDate: string): boolean {
  return String(line.date || '').slice(0, 10) === businessDate
}

export type DayLedger = {
  businessDate: string
  folioCount: number
  checkedInCount: number
  chargesByCategory: { room: number; fb: number; other: number }
  taxTotal: number
  folioChargesTotal: number
  paymentsByMethod: { cash: number; card: number; mobileMoney: number; other: number }
  folioPaymentsTotal: number
}

function bucketChargeCategory(c: FolioLineJson): 'room' | 'fb' | 'other' {
  const cat = String(c.category || '').toLowerCase()
  const desc = String(c.description || '').toLowerCase()
  if (cat === 'room' || (desc.includes('room charge') && !desc.includes('room service'))) return 'room'
  if (cat === 'f&b' || cat === 'fb' || desc.includes('f&b') || desc.startsWith('fb-')) return 'fb'
  return 'other'
}

function bucketPaymentMethod(method: string | undefined): keyof DayLedger['paymentsByMethod'] {
  const m = (method || '').toLowerCase()
  if (m.includes('cash')) return 'cash'
  if (m.includes('card') || m.includes('visa') || m.includes('credit')) return 'card'
  if (m.includes('momo') || m.includes('mobile')) return 'mobileMoney'
  return 'other'
}

export function reconstructDayLedger(
  folios: Array<{ charges?: unknown; payments?: unknown }>,
  businessDate: string,
  checkedInCount = 0,
): DayLedger {
  const ledger: DayLedger = {
    businessDate,
    folioCount: folios.length,
    checkedInCount,
    chargesByCategory: { room: 0, fb: 0, other: 0 },
    taxTotal: 0,
    folioChargesTotal: 0,
    paymentsByMethod: { cash: 0, card: 0, mobileMoney: 0, other: 0 },
    folioPaymentsTotal: 0,
  }

  for (const folio of folios) {
    for (const c of asLineArray(folio.charges)) {
      if (!lineOnBusinessDate(c, businessDate)) continue
      const gross = chargeGross(c)
      ledger.chargesByCategory[bucketChargeCategory(c)] += gross
      ledger.taxTotal += Number(c.tax || 0)
      ledger.folioChargesTotal += gross
    }
    for (const p of asLineArray(folio.payments)) {
      if ((p.status || 'completed') !== 'completed') continue
      if (!lineOnBusinessDate(p, businessDate)) continue
      const amt = Number(p.amount || 0)
      ledger.paymentsByMethod[bucketPaymentMethod(String(p.method))] += amt
      ledger.folioPaymentsTotal += amt
    }
  }

  return ledger
}

export function nextCalendarDate(isoDate: string): string {
  const d = new Date(isoDate + 'T12:00:00')
  d.setDate(d.getDate() + 1)
  return d.toISOString().slice(0, 10)
}

/** Open hotel days strictly before the property calendar date. Today stays open. */
export function elapsedBusinessDates(openDate: string, today: string, maxDays = 366): string[] {
  const dates: string[] = []
  let cursor = openDate
  while (cursor < today && dates.length < maxDays) {
    dates.push(cursor)
    const next = nextCalendarDate(cursor)
    if (next <= cursor) break
    cursor = next
  }
  return dates
}

export function previousCalendarDate(isoDate: string): string {
  const d = new Date(isoDate.slice(0, 10) + 'T12:00:00')
  d.setDate(d.getDate() - 1)
  return d.toISOString().slice(0, 10)
}

export function isMainFolioRow(row: { type?: string | null }): boolean {
  return row.type !== 'split'
}
