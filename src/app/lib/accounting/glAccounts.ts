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
  MOBILE_MONEY: '1130',
  ACCOUNTS_RECEIVABLE: '1210',
  /** In-house guests: charges and payments post here during the stay (IFRS 15, revenue as each night is delivered). */
  GUEST_LEDGER: '1215',

  // Liabilities
  // 2200 is the "Accounts Payable" category HEADER (see GHANA_CHART_OF_ACCOUNTS in
  // models.ts). Postable children include 2205 (trade), 2210 (PAYE), 2220 (Tier 1),
  // 2221 (Tier 3), 2225 (Tier 2) and 2230 (other staff deductions).
  // 2205 is the actual postable leaf for supplier invoices/payments.
  ACCOUNTS_PAYABLE: '2205',
  DEFERRED_REVENUE: '2400',
  /** Money received before arrival: a liability until the guest checks in (IFRS 15 contract liability). */
  GUEST_DEPOSITS: '2450',

  // Revenue
  ROOM_REVENUE: '4100',
  FB_REVENUE: '4200',
  FB_REVENUE_RESTAURANT: '4210',
  FB_REVENUE_BAR: '4220',
  FB_REVENUE_ROOM_SERVICE: '4230',
  // 4300 is the "Other Revenue" category HEADER — children 4320/4330 are postable leaves.
  CONFERENCE_REVENUE: '4320',
  SERVICE_CHARGES: '4400',
  OTHER_REVENUE: '4330',
  ROUNDING_ADJUSTMENT: '4900',
  ALLOWANCES: '4950',

  // Inventory / COGS (F&B stock issue on bill)
  FB_INVENTORY: '1310',
  HOUSEKEEPING_SUPPLIES: '1320',
  OPERATING_SUPPLIES: '1330',
  FB_COGS: '5110',
} as const;

/** Stock category → inventory leaf. Food and drink share 1310 because bar and kitchen COGS is taken from 1310. */
export function inventoryGlForCategory(category?: string | null): string {
  switch ((category || '').toLowerCase()) {
    case 'cleaning':
    case 'linens':
    case 'amenities':
      return GL_ACCOUNTS.HOUSEKEEPING_SUPPLIES;
    case 'maintenance':
    case 'office':
      return GL_ACCOUNTS.OPERATING_SUPPLIES;
    default:
      return GL_ACCOUNTS.FB_INVENTORY;
  }
}

export const REVENUE_CENTERS = {
  ROOM: 'RM',
  RESTAURANT: 'REST',
  BAR: 'BAR',
  ROOM_SERVICE: 'RS',
  CONFERENCE: 'CF',
  SERVICE_CHARGES: 'SC',
} as const;

/** Department that earned a folio charge. Cash and bank settlement lines stay untagged. */
export function revenueCenterForGl(glCode: string): string | null {
  switch ((glCode || '').trim()) {
    case GL_ACCOUNTS.ROOM_REVENUE:
      return REVENUE_CENTERS.ROOM;
    case GL_ACCOUNTS.FB_REVENUE:
    case GL_ACCOUNTS.FB_REVENUE_RESTAURANT:
      return REVENUE_CENTERS.RESTAURANT;
    case GL_ACCOUNTS.FB_REVENUE_BAR:
      return REVENUE_CENTERS.BAR;
    case GL_ACCOUNTS.FB_REVENUE_ROOM_SERVICE:
      return REVENUE_CENTERS.ROOM_SERVICE;
    case GL_ACCOUNTS.CONFERENCE_REVENUE:
      return REVENUE_CENTERS.CONFERENCE;
    case GL_ACCOUNTS.SERVICE_CHARGES:
      return REVENUE_CENTERS.SERVICE_CHARGES;
    default:
      return null;
  }
}

/** Payment method → cash/bank leaf. Shared by integration, simpleFlow, invoicePostingBridge. */
export const PAYMENT_GL_MAP: Record<string, string> = {
  Cash: GL_ACCOUNTS.CASH,
  Card: GL_ACCOUNTS.BANK,
  'Mobile Money': GL_ACCOUNTS.MOBILE_MONEY,
  'Bank Transfer': GL_ACCOUNTS.BANK,
  Bank: GL_ACCOUNTS.BANK,
  Cheque: GL_ACCOUNTS.BANK,
  Check: GL_ACCOUNTS.BANK,
  // A folio "credit" is a reduction of the bill, not money: it reduces revenue.
  Credit: GL_ACCOUNTS.ALLOWANCES,
  // Billed to the company: no money moved. Folio sync skips it (the balance reaches
  // receivables at checkout); elsewhere it nets to nothing against receivables.
  'Corporate Account': GL_ACCOUNTS.ACCOUNTS_RECEIVABLE,
};
