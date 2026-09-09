/**
 * Actuals for Cost & Revenue Centers, derived from posted journal entries — the same
 * "roll up from the GL by account code" approach used for Tax remittance and PPE, applied
 * here instead of trusting a manually-incremented counter as the sole source of truth.
 *
 * Revenue centers already carry a `glAccountCode` (unused for this purpose until now); cost
 * centers gained the same optional field. When a center has no GL code mapped, its actual
 * falls back to the legacy manually-recorded counter (`recordExpense`/`recordRevenue`, still
 * called by a few modules — Housekeeping, Maintenance, Events, Inventory — that don't yet tag
 * a GL account line for cost-centre purposes) so nothing already working regresses.
 *
 * Known limitation: several revenue centers can share one coarse GL code (e.g. Restaurant,
 * Bar, and Room Service all post to Food & Beverage Revenue) — the chart doesn't split
 * revenue that finely, so those centers show the same rolled-up total rather than a true
 * per-center split. Still a real improvement over the previous permanent ₵0.
 */

import type { JournalEntry, CostCenter, RevenueCenter } from './models';

function sumByGl(journalEntries: JournalEntry[], glCode: string, side: 'debit' | 'credit'): number {
  let total = 0;
  for (const je of journalEntries) {
    if (je.status !== 'Posted') continue;
    for (const line of je.lines || []) {
      if (line.accountCode !== glCode) continue;
      total += side === 'debit' ? line.debit || 0 : line.credit || 0;
    }
  }
  return Math.round(total * 100) / 100;
}

export function computeCostCenterActual(center: CostCenter, journalEntries: JournalEntry[]): number {
  if (!center.glAccountCode) return center.actualExpenses || 0;
  return sumByGl(journalEntries, center.glAccountCode, 'debit');
}

export function computeRevenueCenterActual(center: RevenueCenter, journalEntries: JournalEntry[]): number {
  if (!center.glAccountCode) return center.actualRevenue || 0;
  return sumByGl(journalEntries, center.glAccountCode, 'credit');
}
