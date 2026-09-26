/**
 * Canonical leaf GL account codes — kept free of store/integration imports so
 * posting bridges can share them without circular module init (TDZ on GL_ACCOUNTS).
 */

// GL Account Codes for Ghana Hotel Chart of Accounts — leaf (postable) codes only,
// cross-checked against GHANA_CHART_OF_ACCOUNTS in models.ts. '1100'/'1200'/'2000'
// look plausible but are category HEADER rows, not postable accounts.
export const GL_ACCOUNTS = {
  // Assets
  CASH: '1110',
  BANK: '1120',
  ACCOUNTS_RECEIVABLE: '1210',

  // Liabilities
  // 2200 is the "Accounts Payable" category HEADER (see GHANA_CHART_OF_ACCOUNTS in
  // models.ts). Postable children include 2205 (trade), 2210 (PAYE), 2220 (Tier 1),
  // 2221 (Tier 3), 2225 (Tier 2) and 2230 (other staff deductions).
  // 2205 is the actual postable leaf for supplier invoices/payments.
  ACCOUNTS_PAYABLE: '2205',
  DEFERRED_REVENUE: '2400',

  // Revenue
  ROOM_REVENUE: '4100',
  FB_REVENUE: '4200',
  // 4300 is the "Other Revenue" category HEADER — children 4320/4330 are postable leaves.
  CONFERENCE_REVENUE: '4320',
  SERVICE_CHARGES: '4400',
  OTHER_REVENUE: '4330',
  ROUNDING_ADJUSTMENT: '4900',
} as const;

export const REVENUE_CENTERS = {
  ROOM: 'RM',
  RESTAURANT: 'REST',
  BAR: 'BAR',
  ROOM_SERVICE: 'RS',
  CONFERENCE: 'CF',
  SERVICE_CHARGES: 'SC',
} as const;

/** Payment method → cash/bank leaf. Shared by integration, simpleFlow, invoicePostingBridge. */
export const PAYMENT_GL_MAP: Record<string, string> = {
  Cash: GL_ACCOUNTS.CASH,
  Card: GL_ACCOUNTS.BANK,
  'Mobile Money': GL_ACCOUNTS.BANK,
  'Bank Transfer': GL_ACCOUNTS.BANK,
  Bank: GL_ACCOUNTS.BANK,
  Cheque: GL_ACCOUNTS.BANK,
  Check: GL_ACCOUNTS.BANK,
  Credit: GL_ACCOUNTS.BANK,
  'Corporate Account': GL_ACCOUNTS.BANK,
};
