/**
 * Shared money formatter for the Front Office folio screens (check-ins, check-outs,
 * invoices & payments, service charges). Previously each screen defined its own
 * identical `formatMoney` — same formula, four separate copies — which is how they'd
 * drift apart the next time someone tweaked rounding/locale in only one place.
 *
 * Returns the number only (e.g. "1,234.56"); callers prefix the ₵ symbol themselves,
 * matching how the four original copies were called (`₵{formatMoney(amount)}`).
 */
export function formatMoney(amount: number): string {
  return (amount || 0).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
