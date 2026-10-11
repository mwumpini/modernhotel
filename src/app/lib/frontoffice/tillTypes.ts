export const CASH_TILL_ID = 'cash'

export type TillKind = 'cash' | 'momo'

/** A till the hotel can open. Cash is built in. MoMo tills are one per device. */
export type TillType = {
  id: string
  name: string
  kind: TillKind
  /** Shown when opening a new shift. Cash stays on. */
  active: boolean
  /** Petty expenses can leave this till. */
  spend: boolean
  /** Largest single expense from this till. Empty means no extra cap. */
  threshold: number | null
}

export function defaultTillTypes(momoSpend = true): TillType[] {
  return [
    { id: CASH_TILL_ID, name: 'Cash', kind: 'cash', active: true, spend: true, threshold: null },
    { id: 'till-2', name: 'Till 2', kind: 'momo', active: true, spend: momoSpend, threshold: null },
    { id: 'till-3', name: 'Till 3', kind: 'momo', active: true, spend: momoSpend, threshold: null },
  ]
}

function cleanId(raw: string) {
  return raw.trim().toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 24)
}

function cleanThreshold(raw: unknown): number | null {
  if (raw == null || raw === '') return null
  const value = Number(raw)
  if (!Number.isFinite(value) || value <= 0) return null
  return Math.round(value * 100) / 100
}

/** Drop broken rows and keep Cash first. Missing settings use the hotel defaults. */
export function normalizeTillTypes(raw: unknown, momoSpend = true): TillType[] {
  const fallback = defaultTillTypes(momoSpend)
  if (!Array.isArray(raw) || raw.length === 0) return fallback
  const rows: TillType[] = []
  const seen = new Set<string>()
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const source = item as Partial<TillType>
    const id = cleanId(String(source.id || ''))
    if (!id || seen.has(id)) continue
    const kind: TillKind = id === CASH_TILL_ID ? 'cash' : 'momo'
    const name = String(source.name || '').trim().slice(0, 40)
    if (!name) continue
    seen.add(id)
    rows.push({
      id,
      name,
      kind,
      active: kind === 'cash' ? true : source.active !== false,
      spend: kind === 'cash' ? source.spend !== false : source.spend === true,
      threshold: cleanThreshold(source.threshold),
    })
  }
  if (!rows.some((row) => row.id === CASH_TILL_ID)) rows.unshift(fallback[0])
  rows.sort((a, b) => Number(b.kind === 'cash') - Number(a.kind === 'cash'))
  return rows
}
