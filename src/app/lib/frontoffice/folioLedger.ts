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

export function chargeGross(c: FolioLineJson): number {
  return Number(c.amount || 0) + Number(c.tax || 0) + Number(c.serviceCharge || 0) - Number(c.discountAmount || 0)
}

export function recomputeFolioTotals(charges: FolioLineJson[], payments: FolioLineJson[]): FolioTotals {
  const totalCharges = charges.reduce((s, c) => s + chargeGross(c), 0)
  const totalPayments = payments
    .filter((p) => (p.status || 'completed') === 'completed')
    .reduce((s, p) => s + Number(p.amount || 0), 0)
  return {
    totalCharges,
    totalPayments,
    balance: totalCharges - totalPayments,
  }
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

export function isMainFolioRow(row: { type?: string | null }): boolean {
  return row.type !== 'split'
}
