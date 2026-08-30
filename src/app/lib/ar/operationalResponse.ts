/** Wrap folio/guest-ledger API responses — not for finance reporting. */
export function operationalArResponse<T>(data: T, extra?: Record<string, unknown>) {
  return {
    source: 'guest_ledger_operational' as const,
    financeSource: '/api/accounting/receivables/aging',
    notice:
      'In-house open folio balances only. For financial statements, aging, and audit use the accounting receivables API.',
    ...extra,
    data,
  };
}
