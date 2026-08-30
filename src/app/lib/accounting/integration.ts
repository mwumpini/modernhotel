'use client';

/**
 * Accounting Integration Module
 * 
 * This module provides automatic accounting capture for all revenue-generating
 * departments in the hotel. When operational transactions occur, this module
 * automatically:
 * 
 * 1. Creates Sales Invoices in Accounts Receivable
 * 2. Records revenue to Revenue Centers
 * 3. Posts journal entries to General Ledger
 * 4. Creates Receipts when payments are received
 * 5. Updates AR balances and GL accounts
 * 
 * Integration Points:
 * - Front Office (Room Revenue)
 * - Restaurant (F&B Revenue)
 * - Bar (F&B Revenue)
 * - Room Service (F&B Revenue)
 * - Conference/Events (Conference Revenue)
 */

import { useAccountingStore } from './store';
import { computeStackedTaxLines, getEffectiveTaxConfigs } from './taxFromConfig';
import { logAccountingProcess, logAccountingProcessError } from './accountingProcessLog';

// GL Account Codes for Ghana Hotel Chart of Accounts
const GL_ACCOUNTS = {
  // Assets
  CASH: '1110',
  BANK: '1100',
  ACCOUNTS_RECEIVABLE: '1200',
  INVENTORY: '1300',
  
  // Liabilities (fallback codes; tax postings use `TaxConfig.glAccountCode` when present)
  ACCOUNTS_PAYABLE: '2000',
  VAT_PAYABLE: '2110',
  NHIL_PAYABLE: '2120',
  GETFUND_PAYABLE: '2130',
  TOURISM_LEVY_PAYABLE: '2150',
  
  // Revenue
  ROOM_REVENUE: '4100',
  FB_REVENUE: '4200',
  CONFERENCE_REVENUE: '4300',
  SERVICE_CHARGES: '4400',
  OTHER_REVENUE: '4500',
  
  // Cost of Sales
  ROOM_COGS: '5100',
  FB_COGS: '5200',
  
  // Expenses
  OPERATING_EXPENSES: '6000',
};

// Revenue Center Codes
const REVENUE_CENTERS = {
  ROOM: 'RM',
  RESTAURANT: 'REST',
  BAR: 'BAR',
  ROOM_SERVICE: 'RS',
  CONFERENCE: 'CF',
  SERVICE_CHARGES: 'SC',
};

// Payment method to GL mapping. Single source shared with the folio checkout
// flow (simpleFlow.ts); covers both departmental and folio payment vocabularies.
const PAYMENT_GL_MAP: Record<string, string> = {
  'Cash': GL_ACCOUNTS.CASH,
  'Card': GL_ACCOUNTS.BANK,
  'Mobile Money': GL_ACCOUNTS.BANK,
  'Bank Transfer': GL_ACCOUNTS.BANK,
  'Cheque': GL_ACCOUNTS.BANK,
  'Check': GL_ACCOUNTS.BANK,
  'Credit': GL_ACCOUNTS.BANK,
  'Corporate Account': GL_ACCOUNTS.BANK,
};

export type DepartmentSource = 'front_office' | 'restaurant' | 'bar' | 'room_service' | 'conference' | 'spa' | 'other';

export interface ProformaTransaction {
  id: string;
  source: DepartmentSource;
  customerId?: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  reference?: string;
  description: string;
  items: {
    description: string;
    quantity: number;
    unitPrice: number;
    taxPercent?: number;
  }[];
  subtotal: number;
  taxAmount: number;
  total: number;
  currency?: string;
  validUntil?: string;
  date?: string;
  staffId?: string;
  staffName?: string;
  staffRole?: string;
  // Additional metadata
  eventId?: string;
  reservationId?: string;
  pax?: number;
  checkIn?: string;
  checkOut?: string;
  venue?: string;
}

export interface RevenueTransaction {
  id: string;
  source: DepartmentSource;
  customerId?: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  reference?: string; // reservation ID, order ID, etc.
  description: string;
  items: {
    description: string;
    quantity: number;
    unitPrice: number;
    taxPercent?: number;
  }[];
  subtotal: number;
  taxAmount: number;
  total: number;
  currency?: string;
  date?: string;
  // Staff tracking
  staffId?: string;
  staffName?: string;
  staffRole?: string;
}

export interface PaymentTransaction {
  id: string;
  invoiceId?: string;
  customerId?: string;
  customerName: string;
  amount: number;
  paymentMethod: 'Cash' | 'Card' | 'Mobile Money' | 'Bank Transfer' | 'Cheque';
  reference?: string;
  description?: string;
  currency?: string;
  date?: string;
  // Staff tracking
  staffId?: string;
  staffName?: string;
  staffRole?: string;
}

/**
 * Get the GL revenue account for a department
 */
function getRevenueGLAccount(source: DepartmentSource): string {
  switch (source) {
    case 'front_office':
      return GL_ACCOUNTS.ROOM_REVENUE;
    case 'restaurant':
    case 'bar':
    case 'room_service':
      return GL_ACCOUNTS.FB_REVENUE;
    case 'conference':
      return GL_ACCOUNTS.CONFERENCE_REVENUE;
    case 'spa':
      return GL_ACCOUNTS.OTHER_REVENUE;
    default:
      return GL_ACCOUNTS.OTHER_REVENUE;
  }
}

/**
 * Get the Revenue Center code for a department
 */
function getRevenueCenterCode(source: DepartmentSource): string {
  switch (source) {
    case 'front_office':
      return REVENUE_CENTERS.ROOM;
    case 'restaurant':
      return REVENUE_CENTERS.RESTAURANT;
    case 'bar':
      return REVENUE_CENTERS.BAR;
    case 'room_service':
      return REVENUE_CENTERS.ROOM_SERVICE;
    case 'conference':
      return REVENUE_CENTERS.CONFERENCE;
    default:
      return REVENUE_CENTERS.SERVICE_CHARGES;
  }
}

/**
 * Generate a unique invoice number
 */
function generateInvoiceNumber(source: DepartmentSource): string {
  const prefixes: Record<DepartmentSource, string> = {
    front_office: 'FO',
    restaurant: 'REST',
    bar: 'BAR',
    room_service: 'RS',
    conference: 'CONF',
    spa: 'SPA',
    other: 'OTH',
  };
  const prefix = prefixes[source] || 'INV';
  const year = new Date().getFullYear();
  const timestamp = Date.now().toString().slice(-6);
  return `${prefix}-${year}-${timestamp}`;
}

/**
 * Generate a unique payment/receipt number
 */
function generateReceiptNumber(source: DepartmentSource): string {
  const prefixes: Record<DepartmentSource, string> = {
    front_office: 'FO-RCP',
    restaurant: 'REST-RCP',
    bar: 'BAR-RCP',
    room_service: 'RS-RCP',
    conference: 'CONF-RCP',
    spa: 'SPA-RCP',
    other: 'RCP',
  };
  const prefix = prefixes[source] || 'RCP';
  const year = new Date().getFullYear();
  const timestamp = Date.now().toString().slice(-6);
  return `${prefix}-${year}-${timestamp}`;
}

/**
 * MAIN FUNCTION: Capture revenue transaction
 * 
 * This function is called when any department generates revenue.
 * It automatically:
 * 1. Creates a Sales Invoice
 * 2. Records to Revenue Center
 * 3. Posts journal entry to GL (Dr: AR, Cr: Revenue)
 * 4. Adds to audit trail
 */
export function captureRevenue(transaction: RevenueTransaction): { invoiceId: string; journalEntryId: string } | null {
  const store = useAccountingStore.getState();
  const now = new Date().toISOString();
  const transactionDate = transaction.date || now;
  
  console.log(`[Accounting Integration] Capturing revenue from ${transaction.source}:`, {
    customer: transaction.customerName,
    total: transaction.total,
    reference: transaction.reference,
  });
  logAccountingProcess('AccountingCapture', `Revenue capture started — ${transaction.source}`, {
    customer: transaction.customerName,
    total: transaction.total,
    reference: transaction.reference,
  });
  
  try {
    const existingJe = store.journalEntries.find(
      (je) =>
        je.sourceModule === transaction.source &&
        je.sourceTransactionId === transaction.id &&
        je.status === 'Posted',
    );
    if (existingJe) {
      const linkedInv = store.invoices.find(
        (i) => i.journalEntryId === existingJe.id || i.id === `INV-${transaction.source.toUpperCase()}-${transaction.id}`,
      );
      return {
        invoiceId: linkedInv?.id ?? `INV-${transaction.source.toUpperCase()}-${transaction.id}`,
        journalEntryId: existingJe.id,
      };
    }

    // 1. Create Sales Invoice
    const invoiceId = `INV-${transaction.source.toUpperCase()}-${transaction.id}`;
    if (store.invoices.some((i) => i.id === invoiceId)) {
      const inv = store.invoices.find((i) => i.id === invoiceId);
      if (inv?.journalEntryId) {
        return { invoiceId, journalEntryId: inv.journalEntryId };
      }
    }
    const invoiceNumber = generateInvoiceNumber(transaction.source);
    const revenueGLAccount = getRevenueGLAccount(transaction.source);
    
    const invoiceLines = transaction.items.map((item, idx) => ({
      id: `IL-${Date.now()}-${idx}`,
      invoiceId,
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      amount: +(item.quantity * item.unitPrice).toFixed(2),
      taxAmount: +((item.quantity * item.unitPrice * (item.taxPercent || 0)) / 100).toFixed(2),
      glAccountCode: revenueGLAccount,
    }));
    
    const taxCfgs = getEffectiveTaxConfigs(store.taxConfigs);
    const { lines: salesTaxLines } =
      transaction.taxAmount > 0
        ? computeStackedTaxLines(transaction.subtotal, taxCfgs, 'sales', transaction.taxAmount)
        : { lines: [] };

    const taxBreakdown =
      transaction.taxAmount > 0
        ? salesTaxLines.map((l) => ({
            code: l.taxCode,
            name: l.name,
            rate: l.rate,
            amount: l.amount,
          }))
        : [];
    
    const invoice = {
      id: invoiceId,
      invoiceNumber,
      type: 'Sales' as const,
      date: transactionDate,
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
      businessPartnerId: transaction.customerId || `GUEST-${Date.now()}`,
      reference: transaction.reference,
      description: transaction.description,
      subtotal: transaction.subtotal,
      taxAmount: transaction.taxAmount,
      total: transaction.total,
      taxBreakdown, // Store tax breakdown for display
      currency: transaction.currency || 'GHS',
      status: 'Posted' as const,
      paidAmount: 0,
      createdAt: now,
      updatedAt: now,
      lines: invoiceLines,
      items: transaction.items, // Store original items for display
      // Extended fields for tracking
      sourceModule: transaction.source,
      customerName: transaction.customerName,
      customerEmail: transaction.customerEmail,
      customerPhone: transaction.customerPhone,
      // Staff who processed the transaction
      staffId: transaction.staffId,
      staffName: transaction.staffName,
      staffRole: transaction.staffRole,
    };
    
    store.addInvoice(invoice as any);
    console.log(`[Accounting Integration] Created Sales Invoice: ${invoiceNumber}`);
    
    // 2. Record to Revenue Center
    const revenueCenterCode = getRevenueCenterCode(transaction.source);
    store.recordRevenue(revenueCenterCode, transaction.subtotal);
    console.log(`[Accounting Integration] Recorded revenue to center: ${revenueCenterCode}, Amount: ${transaction.subtotal}`);
    
    // 3. Create Journal Entry (Dr: AR, Cr: Revenue, Cr: each tax payable per TaxConfig)
    const journalEntryId = `JE-${transaction.source.toUpperCase()}-${transaction.id}`;
    let jlSeq = 0;
    const nextJeLineId = () => `JL-${journalEntryId}-${++jlSeq}-${Math.random().toString(36).slice(2, 7)}`;
    const journalLines: any[] = [
      {
        id: nextJeLineId(),
        journalEntryId,
        accountCode: GL_ACCOUNTS.ACCOUNTS_RECEIVABLE,
        description: `AR - ${transaction.description}`,
        debit: transaction.total,
        credit: 0,
        costCenter: revenueCenterCode,
      },
      {
        id: nextJeLineId(),
        journalEntryId,
        accountCode: revenueGLAccount,
        description: `Revenue - ${transaction.description}`,
        debit: 0,
        credit: transaction.subtotal,
        costCenter: revenueCenterCode,
      },
    ];

    for (const tl of salesTaxLines) {
      journalLines.push({
        id: nextJeLineId(),
        journalEntryId,
        accountCode: tl.glAccountCode,
        description: `${tl.name} — ${transaction.description}`,
        debit: 0,
        credit: tl.amount,
        costCenter: revenueCenterCode,
      });
    }
    
    const journalEntry = {
      id: journalEntryId,
      entryNumber: `JE-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`,
      date: transactionDate,
      description: `Auto-posted: ${transaction.description}`,
      reference: transaction.reference || invoiceNumber,
      status: 'Posted' as const,
      lines: journalLines,
      totalDebit: transaction.total,
      totalCredit: transaction.total,
      createdBy: 'system',
      postedBy: 'system',
      postedAt: now,
      createdAt: now,
      updatedAt: now,
      sourceModule: transaction.source,
      sourceTransactionId: transaction.id,
    };
    
    store.addJournalEntry(journalEntry as any);
    store.updateInvoice(invoiceId, { journalEntryId });
    console.log(`[Accounting Integration] Posted Journal Entry: ${journalEntry.entryNumber}`);
    
    // 4. Add Audit Trail
    store.addAuditTrail({
      id: `AT-${Date.now()}`,
      tableName: 'AccountingIntegration',
      recordId: invoiceId,
      action: 'Create',
      oldValues: null as any,
      newValues: {
        type: 'RevenueCapture',
        source: transaction.source,
        invoiceId,
        journalEntryId,
        total: transaction.total,
        customer: transaction.customerName,
      },
      userId: 'system',
      timestamp: now,
    });
    
    console.log(`[Accounting Integration] ✅ Revenue capture complete for ${transaction.customerName}: GHS ${transaction.total.toLocaleString()}`);
    logAccountingProcess('AccountingCapture', 'Revenue capture complete', {
      source: transaction.source,
      invoiceId,
      journalEntryId,
      total: transaction.total,
    });
    
    return { invoiceId, journalEntryId };
    
  } catch (error) {
    console.error('[Accounting Integration] ❌ Error capturing revenue:', error);
    logAccountingProcessError('AccountingCapture', 'Revenue capture failed', {
      source: transaction.source,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Generate a unique proforma number
 */
function generateProformaNumber(source: DepartmentSource): string {
  const prefixes: Record<DepartmentSource, string> = {
    front_office: 'PRO-FO',
    restaurant: 'PRO-REST',
    bar: 'PRO-BAR',
    room_service: 'PRO-RS',
    conference: 'PRO-CONF',
    spa: 'PRO-SPA',
    other: 'PRO',
  };
  const prefix = prefixes[source] || 'PRO';
  const year = new Date().getFullYear();
  const timestamp = Date.now().toString().slice(-6);
  return `${prefix}-${year}-${timestamp}`;
}

/**
 * PROFORMA FUNCTION: Capture proforma/quote
 * 
 * This function is called when a proforma invoice or quote is created.
 * It automatically:
 * 1. Creates a Proforma Invoice (not yet revenue - just a quote)
 * 2. Adds to audit trail
 * 
 * Note: Proformas do NOT post to GL until converted to actual invoices
 */
export function captureProforma(transaction: ProformaTransaction): { proformaId: string } | null {
  const store = useAccountingStore.getState();
  const now = new Date().toISOString();
  const transactionDate = transaction.date || now;
  
  console.log(`[Accounting Integration] Capturing proforma from ${transaction.source}:`, {
    customer: transaction.customerName,
    total: transaction.total,
    reference: transaction.reference,
    eventId: transaction.eventId,
    reservationId: transaction.reservationId,
  });
  
  try {
    const proformaId = `PRO-${transaction.source.toUpperCase()}-${Date.now()}`;
    const proformaNumber = generateProformaNumber(transaction.source);
    
    const proformaLines = transaction.items.map((item, idx) => ({
      id: `PL-${Date.now()}-${idx}`,
      invoiceId: proformaId,
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      amount: +(item.quantity * item.unitPrice).toFixed(2),
      taxAmount: +((item.quantity * item.unitPrice * (item.taxPercent || 0)) / 100).toFixed(2),
    }));
    
    const proforma = {
      id: proformaId,
      invoiceNumber: proformaNumber,
      type: 'Sales' as const,
      isProforma: true,
      date: transactionDate,
      dueDate: transaction.validUntil || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      businessPartnerId: transaction.customerId || `GUEST-${Date.now()}`,
      reference: transaction.reference,
      description: transaction.description,
      subtotal: transaction.subtotal,
      taxAmount: transaction.taxAmount,
      total: transaction.total,
      currency: transaction.currency || 'GHS',
      status: 'Draft' as const,
      paidAmount: 0,
      createdAt: now,
      updatedAt: now,
      lines: proformaLines,
      // Extended fields
      sourceModule: transaction.source,
      customerName: transaction.customerName,
      customerEmail: transaction.customerEmail,
      customerPhone: transaction.customerPhone,
      staffId: transaction.staffId,
      staffName: transaction.staffName,
      staffRole: transaction.staffRole,
      // Proforma-specific metadata
      eventId: transaction.eventId,
      reservationId: transaction.reservationId,
      pax: transaction.pax,
      checkIn: transaction.checkIn,
      checkOut: transaction.checkOut,
      venue: transaction.venue,
    };
    
    store.addInvoice(proforma as any);
    console.log(`[Accounting Integration] Created Proforma: ${proformaNumber}`);
    
    // Add Audit Trail
    store.addAuditTrail({
      id: `AT-${Date.now()}`,
      tableName: 'AccountingIntegration',
      recordId: proformaId,
      action: 'Create',
      oldValues: null as any,
      newValues: {
        type: 'ProformaCapture',
        source: transaction.source,
        proformaId,
        total: transaction.total,
        customer: transaction.customerName,
        eventId: transaction.eventId,
        reservationId: transaction.reservationId,
      },
      userId: transaction.staffId || 'system',
      timestamp: now,
    });
    
    console.log(`[Accounting Integration] ✅ Proforma capture complete for ${transaction.customerName}: GHS ${transaction.total.toLocaleString()}`);
    
    return { proformaId };
    
  } catch (error) {
    console.error('[Accounting Integration] ❌ Error capturing proforma:', error);
    return null;
  }
}

/**
 * Convert proforma to sales invoice
 * Called when a proforma is confirmed and becomes an actual invoice
 */
export function convertProformaToInvoice(proformaId: string): { invoiceId: string; journalEntryId: string } | null {
  const store = useAccountingStore.getState();
  const now = new Date().toISOString();
  
  const proforma = store.invoices.find((inv: any) => inv.id === proformaId && inv.isProforma);
  if (!proforma) {
    console.error('[Accounting Integration] Proforma not found:', proformaId);
    return null;
  }
  
  console.log(`[Accounting Integration] Converting proforma to invoice:`, proformaId);
  
  try {
    // Update proforma to regular invoice
    const source = (proforma as any).sourceModule || 'other';
    const revenueGLAccount = getRevenueGLAccount(source);
    const revenueCenterCode = getRevenueCenterCode(source);
    
    store.updateInvoice(proformaId, {
      isProforma: false,
      status: 'Posted',
      updatedAt: now,
      invoiceNumber: (proforma as any).invoiceNumber?.replace('PRO-', 'INV-') || `INV-${Date.now()}`,
    } as any);
    
    // Record to Revenue Center
    store.recordRevenue(revenueCenterCode, proforma.subtotal);
    
    const taxCfgsConv = getEffectiveTaxConfigs(store.taxConfigs);
    const { lines: convTaxLines } =
      proforma.taxAmount && proforma.taxAmount > 0
        ? computeStackedTaxLines(proforma.subtotal, taxCfgsConv, 'sales', proforma.taxAmount)
        : { lines: [] };

    const journalEntryId = `JE-CONV-${Date.now()}`;
    let convSeq = 0;
    const nextConvLineId = () => `JL-${journalEntryId}-${++convSeq}-${Math.random().toString(36).slice(2, 7)}`;
    const convLines: any[] = [
      {
        id: nextConvLineId(),
        journalEntryId,
        accountCode: GL_ACCOUNTS.ACCOUNTS_RECEIVABLE,
        description: `AR - ${(proforma as any).description}`,
        debit: proforma.total,
        credit: 0,
        costCenter: revenueCenterCode,
      },
      {
        id: nextConvLineId(),
        journalEntryId,
        accountCode: revenueGLAccount,
        description: `Revenue - ${(proforma as any).description}`,
        debit: 0,
        credit: proforma.subtotal,
        costCenter: revenueCenterCode,
      },
    ];
    for (const tl of convTaxLines) {
      convLines.push({
        id: nextConvLineId(),
        journalEntryId,
        accountCode: tl.glAccountCode,
        description: `${tl.name} — ${(proforma as any).description}`,
        debit: 0,
        credit: tl.amount,
        costCenter: revenueCenterCode,
      });
    }

    const journalEntry = {
      id: journalEntryId,
      entryNumber: `JE-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`,
      date: now,
      description: `Proforma converted to Invoice: ${(proforma as any).description}`,
      reference: proformaId,
      status: 'Posted' as const,
      lines: convLines,
      totalDebit: proforma.total,
      totalCredit: proforma.total,
      createdBy: 'system',
      postedBy: 'system',
      postedAt: now,
      createdAt: now,
      updatedAt: now,
      sourceModule: source,
      sourceTransactionId: proformaId,
    };
    
    store.addJournalEntry(journalEntry as any);
    store.updateInvoice(proformaId, { journalEntryId });
    
    // Audit Trail
    store.addAuditTrail({
      id: `AT-${Date.now()}`,
      tableName: 'AccountingIntegration',
      recordId: proformaId,
      action: 'Update',
      oldValues: { isProforma: true, status: 'Draft' },
      newValues: { type: 'ProformaConversion', isProforma: false, status: 'Posted', journalEntryId },
      userId: 'system',
      timestamp: now,
    });
    
    console.log(`[Accounting Integration] ✅ Proforma converted: ${proformaId} → Invoice posted`);
    
    return { invoiceId: proformaId, journalEntryId };
    
  } catch (error) {
    console.error('[Accounting Integration] ❌ Error converting proforma:', error);
    return null;
  }
}

/**
 * MAIN FUNCTION: Capture payment/receipt
 * 
 * This function is called when payment is received for any transaction.
 * It automatically:
 * 1. Creates a Receipt
 * 2. Updates the Invoice paid amount
 * 3. Posts journal entry to GL (Dr: Cash/Bank, Cr: AR)
 * 4. Adds to audit trail
 */
export function capturePayment(
  transaction: PaymentTransaction,
  source: DepartmentSource
): { receiptId: string; journalEntryId: string } | null {
  const store = useAccountingStore.getState();
  const now = new Date().toISOString();
  const transactionDate = transaction.date || now;
  
  console.log(`[Accounting Integration] Capturing payment from ${source}:`, {
    customer: transaction.customerName,
    amount: transaction.amount,
    method: transaction.paymentMethod,
    invoiceId: transaction.invoiceId,
  });
  
  try {
    const existingPayJe = store.journalEntries.find(
      (je) =>
        je.sourceModule === source &&
        je.sourceTransactionId === transaction.id &&
        je.status === 'Posted',
    );
    if (existingPayJe) {
      const linkedRcp = store.payments.find(
        (p) => p.journalEntryId === existingPayJe.id || p.id === `RCP-${source.toUpperCase()}-${transaction.id}`,
      );
      return {
        receiptId: linkedRcp?.id ?? `RCP-${source.toUpperCase()}-${transaction.id}`,
        journalEntryId: existingPayJe.id,
      };
    }

    // 1. Create Receipt
    const receiptId = `RCP-${source.toUpperCase()}-${transaction.id}`;
    if (store.payments.some((p) => p.id === receiptId)) {
      const rcp = store.payments.find((p) => p.id === receiptId);
      if (rcp?.journalEntryId) {
        return { receiptId, journalEntryId: rcp.journalEntryId };
      }
    }
    const receiptNumber = generateReceiptNumber(source);
    
    const receipt = {
      id: receiptId,
      paymentNumber: receiptNumber,
      date: transactionDate,
      type: 'Receipt' as const,
      businessPartnerId: transaction.customerId || `GUEST-${Date.now()}`,
      invoiceId: transaction.invoiceId,
      reference: transaction.reference,
      description: transaction.description || `Payment from ${transaction.customerName}`,
      amount: transaction.amount,
      currency: transaction.currency || 'GHS',
      paymentMethod: transaction.paymentMethod,
      status: 'Posted' as const,
      createdAt: now,
      updatedAt: now,
      sourceModule: source,
      customerName: transaction.customerName,
      // Staff who processed the payment
      staffId: transaction.staffId,
      staffName: transaction.staffName,
      staffRole: transaction.staffRole,
    };
    
    store.addPayment(receipt as any);
    console.log(`[Accounting Integration] Created Receipt: ${receiptNumber}`);
    
    // 2. Update Invoice paid amount if linked
    // Try to find invoice by ID first, then by reference (for event bookings)
    const invoices = store.invoices;
    let invoice = null;
    
    if (transaction.invoiceId) {
      invoice = invoices.find((inv: any) => inv.id === transaction.invoiceId);
    }
    
    // If not found by ID, try to find by reference (common for conference/event payments)
    if (!invoice && transaction.reference) {
      invoice = invoices.find((inv: any) => 
        inv.reference === transaction.reference || 
        (inv as any).eventId === transaction.reference ||
        inv.id.includes(transaction.reference)
      );
    }
    
    // Also try to find by customer for partial matching
    if (!invoice && transaction.customerId) {
      const customerInvoices = invoices.filter((inv: any) => 
        inv.businessPartnerId === transaction.customerId &&
        inv.type === 'Sales' &&
        (inv.paidAmount || 0) < inv.total
      );
      // Get the oldest unpaid invoice for this customer
      if (customerInvoices.length > 0) {
        invoice = customerInvoices.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0];
      }
    }
    
    if (invoice) {
      const newPaidAmount = (invoice.paidAmount || 0) + transaction.amount;
      const newStatus = newPaidAmount >= invoice.total ? 'Paid' : invoice.status;
      store.updateInvoice(invoice.id, {
        paidAmount: newPaidAmount,
        status: newStatus as any,
        paidDate: newPaidAmount >= invoice.total ? now : undefined,
        updatedAt: now,
      });
      console.log(`[Accounting Integration] Updated Invoice ${(invoice as any).invoiceNumber}: Paid ${newPaidAmount}/${invoice.total}`);
      
      // Update receipt with actual invoice ID
      store.updatePayment(receiptId, { invoiceId: invoice.id } as any);
    } else if (transaction.invoiceId || transaction.reference) {
      console.warn(`[Accounting Integration] ⚠ Could not find invoice to link payment. InvoiceID: ${transaction.invoiceId}, Ref: ${transaction.reference}`);
    }
    
    // 3. Create Journal Entry (Dr: Cash/Bank, Cr: AR)
    const journalEntryId = `JE-PAY-${source.toUpperCase()}-${transaction.id}`;
    const cashGLAccount = PAYMENT_GL_MAP[transaction.paymentMethod] || GL_ACCOUNTS.CASH;
    const revenueCenterCode = getRevenueCenterCode(source);
    
    const journalEntry = {
      id: journalEntryId,
      entryNumber: `JE-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`,
      date: transactionDate,
      description: `Auto-posted: Payment received - ${transaction.customerName}`,
      reference: receiptNumber,
      status: 'Posted' as const,
      lines: [
        // Debit Cash/Bank
        {
          id: `JL-${Date.now()}-1`,
          journalEntryId,
          accountCode: cashGLAccount,
          description: `${transaction.paymentMethod} received - ${transaction.customerName}`,
          debit: transaction.amount,
          credit: 0,
          costCenter: revenueCenterCode,
        },
        // Credit Accounts Receivable
        {
          id: `JL-${Date.now()}-2`,
          journalEntryId,
          accountCode: GL_ACCOUNTS.ACCOUNTS_RECEIVABLE,
          description: `AR settlement - ${transaction.customerName}`,
          debit: 0,
          credit: transaction.amount,
          costCenter: revenueCenterCode,
        },
      ],
      totalDebit: transaction.amount,
      totalCredit: transaction.amount,
      createdBy: 'system',
      postedBy: 'system',
      postedAt: now,
      createdAt: now,
      updatedAt: now,
      sourceModule: source,
      sourceTransactionId: transaction.id,
    };
    
    store.addJournalEntry(journalEntry as any);
    store.updatePayment(receiptId, { journalEntryId });
    console.log(`[Accounting Integration] Posted Payment Journal Entry: ${journalEntry.entryNumber}`);
    
    // 4. Add Audit Trail
    store.addAuditTrail({
      id: `AT-${Date.now()}`,
      tableName: 'AccountingIntegration',
      recordId: receiptId,
      action: 'Create',
      oldValues: null as any,
      newValues: {
        type: 'PaymentCapture',
        source,
        receiptId,
        journalEntryId,
        amount: transaction.amount,
        method: transaction.paymentMethod,
        customer: transaction.customerName,
        invoiceId: transaction.invoiceId,
      },
      userId: 'system',
      timestamp: now,
    });
    
    console.log(`[Accounting Integration] ✅ Payment capture complete: ${transaction.paymentMethod} GHS ${transaction.amount.toLocaleString()} from ${transaction.customerName}`);
    
    return { receiptId, journalEntryId };
    
  } catch (error) {
    console.error('[Accounting Integration] ❌ Error capturing payment:', error);
    return null;
  }
}

/**
 * Capture a complete sale transaction (revenue + payment in one go)
 * Useful for POS transactions where payment is immediate
 */
export function captureCompleteSale(
  revenue: RevenueTransaction,
  payment: Omit<PaymentTransaction, 'invoiceId'>
): { invoiceId: string; receiptId: string; journalEntryIds: string[] } | null {
  console.log(`[Accounting Integration] Capturing complete sale from ${revenue.source}:`, {
    customer: revenue.customerName,
    total: revenue.total,
    paymentMethod: payment.paymentMethod,
  });
  
  try {
    // 1. Capture revenue first
    const revenueResult = captureRevenue(revenue);
    if (!revenueResult) {
      throw new Error('Failed to capture revenue');
    }
    
    // 2. Capture payment with invoice link
    const paymentResult = capturePayment(
      {
        ...payment,
        invoiceId: revenueResult.invoiceId,
      },
      revenue.source
    );
    
    if (!paymentResult) {
      throw new Error('Failed to capture payment');
    }
    
    console.log(`[Accounting Integration] ✅ Complete sale captured: Invoice ${revenueResult.invoiceId}, Receipt ${paymentResult.receiptId}`);
    
    return {
      invoiceId: revenueResult.invoiceId,
      receiptId: paymentResult.receiptId,
      journalEntryIds: [revenueResult.journalEntryId, paymentResult.journalEntryId],
    };
    
  } catch (error) {
    console.error('[Accounting Integration] ❌ Error capturing complete sale:', error);
    return null;
  }
}

/**
 * Get accounting summary for a department
 */
export function getDepartmentAccountingSummary(source: DepartmentSource): {
  totalRevenue: number;
  totalReceivables: number;
  totalReceipts: number;
  invoiceCount: number;
  receiptCount: number;
} {
  const store = useAccountingStore.getState();
  
  const departmentInvoices = store.invoices.filter(
    (inv: any) => inv.sourceModule === source && inv.type === 'Sales'
  );
  
  const departmentReceipts = store.payments.filter(
    (pmt: any) => pmt.sourceModule === source && pmt.type === 'Receipt'
  );
  
  const totalRevenue = departmentInvoices.reduce((sum: number, inv: any) => sum + (inv.total || 0), 0);
  const totalReceivables = departmentInvoices.reduce(
    (sum: number, inv: any) => sum + ((inv.total || 0) - (inv.paidAmount || 0)),
    0
  );
  const totalReceipts = departmentReceipts.reduce((sum: number, pmt: any) => sum + (pmt.amount || 0), 0);
  
  return {
    totalRevenue,
    totalReceivables,
    totalReceipts,
    invoiceCount: departmentInvoices.length,
    receiptCount: departmentReceipts.length,
  };
}

/**
 * Export GL Account codes for use in other modules
 */
export { GL_ACCOUNTS, REVENUE_CENTERS, PAYMENT_GL_MAP };

/** Expense, AP, PO, inventory, payroll, fixed assets, accruals, prepayments, tax — Menish extended architecture */
export * from './integrationExtendedCaptures';

