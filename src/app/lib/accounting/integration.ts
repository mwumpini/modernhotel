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
import { useSettingsStore } from '../settings/store';
import { nextNumberFromLabels } from '../events/documentNumbers';
import { computeStackedTaxLines, getEffectiveTaxConfigs } from './taxFromConfig';
import { logAccountingProcess, logAccountingProcessError } from './accountingProcessLog';
import { assertPeriodNotClosed } from './periodClose';
import { hasReversalForEntry, postJournalEntryReversal } from './journalReversal';
import { GL_ACCOUNTS, REVENUE_CENTERS, PAYMENT_GL_MAP } from './glAccounts';
import { mirrorGlCashToCashbook } from './cashbookMirror';
import { departmentSourceGlAccount } from '../fb/venueGl';

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
  /** Override revenue leaf (e.g. venue 4210/4220/4230). */
  glAccountCode?: string;
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
  // Staff tracking (waiter / server on the ticket)
  staffId?: string;
  staffName?: string;
  staffRole?: string;
  /** Logged-in till cashier — used for restaurant/bar shift recon */
  cashierUserId?: string;
  cashierName?: string;
}

/**
 * Get the GL revenue account for a department
 */
function getRevenueGLAccount(source: DepartmentSource, override?: string): string {
  if (override && /^\d{4}$/.test(override.trim())) return override.trim();
  switch (source) {
    case 'front_office':
      return GL_ACCOUNTS.ROOM_REVENUE;
    case 'restaurant':
    case 'bar':
    case 'room_service':
      return departmentSourceGlAccount(source);
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
  if (source === 'conference') {
    const store = useAccountingStore.getState();
    return nextNumberFromLabels(
      'INV',
      store.invoices
        .filter((invoice) => invoice.sourceModule === 'conference' && !invoice.isProforma && invoice.status !== 'Void')
        .map((invoice) => invoice.invoiceNumber)
    );
  }
  const prefixes: Partial<Record<DepartmentSource, string>> = {
    front_office: 'FO',
    restaurant: 'REST',
    bar: 'BAR',
    room_service: 'RS',
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
  if (source === 'conference') {
    const store = useAccountingStore.getState();
    return nextNumberFromLabels(
      'RCP',
      store.payments
        .filter((payment) => payment.sourceModule === 'conference' && payment.status !== 'Void')
        .map((payment) => payment.paymentNumber)
    );
  }
  const prefixes: Partial<Record<DepartmentSource, string>> = {
    front_office: 'FO-RCP',
    restaurant: 'REST-RCP',
    bar: 'BAR-RCP',
    room_service: 'RS-RCP',
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
export function captureRevenue(
  transaction: RevenueTransaction,
  opts?: {
    /**
     * Money committed/collected for a service not yet delivered (e.g. a
     * confirmed-but-not-yet-held event booking) isn't earned income yet —
     * credit Deferred Revenue (a liability) instead of the revenue account.
     * Call recognizeDeferredRevenue() once the service is actually delivered
     * to reclassify it into real revenue. AR/the invoice are unaffected —
     * the client owes the same money either way; only which GL account
     * absorbs the credit side changes.
     */
    deferred?: boolean;
  }
): { invoiceId: string; journalEntryId: string } | null {
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
    const periodCheck = assertPeriodNotClosed(store.journalEntries, transactionDate);
    if (!periodCheck.ok) {
      console.error('[Accounting Integration] Revenue capture aborted — closed period', periodCheck.error);
      logAccountingProcessError('AccountingCapture', 'Revenue capture aborted — closed period', {
        source: transaction.source,
        transactionDate,
        error: periodCheck.error,
      });
      return null;
    }

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
    const revenueGLAccount = getRevenueGLAccount(transaction.source, transaction.glAccountCode);
    
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
    
    // 2. Build the Journal Entry (Dr: AR, Cr: Revenue, Cr: each tax payable per
    // TaxConfig) BEFORE touching the invoice — tax computation is the step most
    // likely to throw on bad config data, and building+validating it first means
    // nothing gets committed at all if it fails, instead of leaving a "Posted"
    // invoice behind with no journal entry ever backing it.
    const revenueCenterCode = getRevenueCenterCode(transaction.source);
    const journalEntryId = `JE-${transaction.source.toUpperCase()}-${transaction.id}`;
    const creditAccount = opts?.deferred ? GL_ACCOUNTS.DEFERRED_REVENUE : revenueGLAccount;
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
        accountCode: creditAccount,
        description: opts?.deferred
          ? `Deferred revenue (not yet delivered) - ${transaction.description}`
          : `Revenue - ${transaction.description}`,
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

    const lineDebit = journalLines.reduce((s, l) => s + (l.debit || 0), 0);
    const lineCredit = journalLines.reduce((s, l) => s + (l.credit || 0), 0);
    if (Math.abs(lineDebit - lineCredit) > 0.02) {
      console.error('[Accounting Integration] Revenue JE not balanced — capture aborted, nothing posted', { lineDebit, lineCredit, transaction });
      logAccountingProcessError('AccountingCapture', 'Revenue capture aborted — unbalanced JE', {
        source: transaction.source,
        lineDebit,
        lineCredit,
      });
      return null;
    }

    const journalEntry = {
      id: journalEntryId,
      entryNumber: `JE-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`,
      date: transactionDate,
      description: `Auto-posted: ${transaction.description}`,
      reference: transaction.reference || invoiceNumber,
      status: 'Posted' as const,
      lines: journalLines,
      totalDebit: lineDebit,
      totalCredit: lineCredit,
      createdBy: 'system',
      postedBy: 'system',
      postedAt: now,
      createdAt: now,
      updatedAt: now,
      sourceModule: transaction.source,
      sourceTransactionId: transaction.id,
    };

    // 3. Now commit — invoice and its journal entry together, back to back, with
    // nothing left that can throw in between.
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
      journalEntryId,
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

    store.recordRevenue(revenueCenterCode, transaction.subtotal);
    console.log(`[Accounting Integration] Recorded revenue to center: ${revenueCenterCode}, Amount: ${transaction.subtotal}`);

    store.addJournalEntry(journalEntry as any);
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
 * Reclassify every prior captureRevenue({ deferred: true }) posting tagged
 * with this reference (an event id, typically) into real, recognized
 * revenue — call this once the service booked/paid for in advance is
 * actually delivered (e.g. an event's completion). A booking can accumulate
 * more than one deferred entry (confirm-time capture, a later invoice sync,
 * a folio adjustment) — every one still holding a Deferred Revenue balance
 * gets its own matching recognition entry (Dr Deferred Revenue, Cr revenue),
 * so nothing here needs to guess which single entry to look for.
 * Idempotent per source entry: each recognition entry's id is derived from
 * the entry it recognizes, so a second call only recognizes what's new since
 * the last call (and no-ops entirely if there's nothing left to recognize —
 * never captured, captured as regular non-deferred revenue, or already
 * fully recognized).
 */
export function recognizeDeferredRevenue(
  source: DepartmentSource,
  reference: string,
  description: string
): { journalEntryIds: string[] } | null {
  const store = useAccountingStore.getState();
  const now = new Date().toISOString();
  const revenueGLAccount = getRevenueGLAccount(source);
  const revenueCenterCode = getRevenueCenterCode(source);

  const deferredEntries = store.journalEntries.filter(
    (je) =>
      je.status === 'Posted' &&
      je.sourceModule === source &&
      je.reference === reference &&
      je.lines.some((l) => l.accountCode === GL_ACCOUNTS.DEFERRED_REVENUE && (l.credit || 0) > 0)
  );
  if (!deferredEntries.length) {
    console.log('[Accounting Integration] No deferred-capture entries found to recognize for', reference);
    return null;
  }

  const postedIds: string[] = [];
  for (const deferredJe of deferredEntries) {
    const recognitionJeId = `JE-RECOGNIZE-${deferredJe.id}`;
    if (store.journalEntries.some((je) => je.id === recognitionJeId && je.status === 'Posted')) {
      continue; // already recognized this one
    }

    const deferredAmount = deferredJe.lines
      .filter((l) => l.accountCode === GL_ACCOUNTS.DEFERRED_REVENUE)
      .reduce((s, l) => s + (l.credit || 0), 0);
    if (deferredAmount <= 0) continue;

    try {
      const periodCheck = assertPeriodNotClosed(store.journalEntries, now);
      if (!periodCheck.ok) {
        console.error('[Accounting Integration] Revenue recognition aborted — closed period', periodCheck.error);
        continue;
      }

      const entry = {
        id: recognitionJeId,
        entryNumber: `JE-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`,
        date: now,
        description: `Revenue recognized (delivered) — ${description}`,
        reference,
        status: 'Posted' as const,
        totalDebit: deferredAmount,
        totalCredit: deferredAmount,
        createdBy: 'system',
        postedBy: 'system',
        postedAt: now,
        createdAt: now,
        updatedAt: now,
        sourceModule: source,
        sourceTransactionId: `RECOGNIZE-${deferredJe.id}`,
        lines: [
          {
            id: `JL-${recognitionJeId}-1`,
            journalEntryId: recognitionJeId,
            accountCode: GL_ACCOUNTS.DEFERRED_REVENUE,
            description: `Clear deferred revenue — ${description}`,
            debit: deferredAmount,
            credit: 0,
            costCenter: revenueCenterCode,
          },
          {
            id: `JL-${recognitionJeId}-2`,
            journalEntryId: recognitionJeId,
            accountCode: revenueGLAccount,
            description: `Revenue recognized — ${description}`,
            debit: 0,
            credit: deferredAmount,
            costCenter: revenueCenterCode,
          },
        ],
      };

      store.addJournalEntry(entry as any);
      store.recordRevenue(revenueCenterCode, deferredAmount);
      postedIds.push(recognitionJeId);
    } catch (error) {
      console.error('[Accounting Integration] ❌ Error recognizing deferred revenue:', error);
      logAccountingProcessError('AccountingCapture', 'Deferred revenue recognition failed', {
        source,
        reference,
        deferredEntryId: deferredJe.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if (!postedIds.length) return null;

  logAccountingProcess('AccountingCapture', 'Deferred revenue recognized', {
    source,
    reference,
    journalEntryIds: postedIds,
  });

  return { journalEntryIds: postedIds };
}

/** Undo recognizeDeferredRevenue when an event was ended by mistake. */
export function reverseRecognizedRevenue(source: DepartmentSource, reference: string) {
  const store = useAccountingStore.getState();
  const revenueCenterCode = getRevenueCenterCode(source);
  const recognized = store.journalEntries.filter(
    (je) =>
      je.status === 'Posted' &&
      je.sourceModule === source &&
      je.reference === reference &&
      String(je.id || '').startsWith('JE-RECOGNIZE-')
  );
  recognized.forEach((entry) => {
    const amount = Number(entry.totalCredit || 0) || entry.lines.reduce((sum, line) => sum + (line.credit || 0), 0);
    void store.voidJournalEntry(entry.id);
    if (amount > 0) store.recordRevenue(revenueCenterCode, -amount);
  });
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
      invoiceNumber: String((proforma as any).invoiceNumber || '').startsWith('PRO-')
        ? String((proforma as any).invoiceNumber).replace(/^PRO-/, 'INV-')
        : useSettingsStore.getState().getNextInvoiceNumber(),
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
    const periodCheck = assertPeriodNotClosed(store.journalEntries, transactionDate);
    if (!periodCheck.ok) {
      console.error('[Accounting Integration] Payment capture aborted — closed period', periodCheck.error);
      return null;
    }

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
      cashierUserId: transaction.cashierUserId,
      cashierName: transaction.cashierName,
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
    mirrorGlCashToCashbook(() => useAccountingStore.getState(), {
      glCode: cashGLAccount,
      amount: transaction.amount,
      direction: 'in',
      date: transactionDate,
      reference: receiptNumber,
      description: `${transaction.paymentMethod} received — ${transaction.customerName}`,
      journalEntryId,
    });
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
 * Post F&B COGS when stock was issued on bill (Dr 5110 / Cr 1310).
 * Idempotent per order via JE id. Skip when amount is 0 (unlinked / no cost).
 */
export function captureFbCogs(params: {
  orderId: string;
  source: DepartmentSource;
  amount: number;
  description?: string;
  reference?: string;
}): { journalEntryId: string } | null {
  const amount = +Number(params.amount || 0).toFixed(2);
  if (amount <= 0) return null;

  const store = useAccountingStore.getState();
  const journalEntryId = `JE-COGS-${params.source.toUpperCase()}-${params.orderId}`;
  if (store.journalEntries.some((je) => je.id === journalEntryId && je.status === 'Posted')) {
    return { journalEntryId };
  }
  if (store.journalEntries.some((je) => je.id === journalEntryId)) {
    return { journalEntryId };
  }

  const now = new Date().toISOString();
  const periodCheck = assertPeriodNotClosed(store.journalEntries, now);
  if (!periodCheck.ok) {
    console.error('[Accounting Integration] COGS aborted — closed period', periodCheck.error);
    return null;
  }

  const description = params.description || `F&B COGS — ${params.orderId}`;
  const journalEntry = {
    id: journalEntryId,
    entryNumber: `JE-COGS-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`,
    date: now,
    description: `Auto-posted: ${description}`,
    reference: params.reference || params.orderId,
    status: 'Posted' as const,
    lines: [
      {
        id: `JL-${journalEntryId}-1`,
        journalEntryId,
        accountCode: GL_ACCOUNTS.FB_COGS,
        description: `COGS — ${description}`,
        debit: amount,
        credit: 0,
        costCenter: getRevenueCenterCode(params.source),
      },
      {
        id: `JL-${journalEntryId}-2`,
        journalEntryId,
        accountCode: GL_ACCOUNTS.FB_INVENTORY,
        description: `Inventory issue — ${description}`,
        debit: 0,
        credit: amount,
        costCenter: getRevenueCenterCode(params.source),
      },
    ],
    totalDebit: amount,
    totalCredit: amount,
    createdBy: 'system',
    postedBy: 'system',
    postedAt: now,
    createdAt: now,
    updatedAt: now,
    sourceModule: params.source,
    sourceTransactionId: `cogs:${params.orderId}`,
  };

  store.addJournalEntry(journalEntry as any);
  logAccountingProcess('AccountingCapture', 'F&B COGS captured', {
    orderId: params.orderId,
    amount,
    journalEntryId,
  });
  return { journalEntryId };
}

/**
 * Refund a walk-in F&B sale: void receipts + sales invoice (reverses JEs) and reverse COGS.
 * Stock/folio reverse is handled by PATCH status=refunded on the server.
 */
export async function refundFbSale(params: {
  orderId: string;
  source: DepartmentSource;
  reason?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const store = useAccountingStore.getState();
  const sourceKey = params.source.toUpperCase();
  const invoiceId = `INV-${sourceKey}-${params.orderId}`;
  const cogsId = `JE-COGS-${sourceKey}-${params.orderId}`;
  const reason = params.reason || `F&B refund ${params.orderId}`;

  const invoice = store.invoices.find((inv) => inv.id === invoiceId || inv.reference === params.orderId);
  if (invoice && String(invoice.status) !== 'Void') {
    const receipts = store.payments.filter(
      (p) => p.type === 'Receipt' && p.status !== 'Void' && (p.invoiceId === invoice.id || p.reference === params.orderId),
    );
    for (const receipt of receipts) {
      const latest = useAccountingStore.getState();
      if (receipt.journalEntryId && !hasReversalForEntry(latest.journalEntries, receipt.journalEntryId)) {
        const reversed = postJournalEntryReversal(receipt.journalEntryId, latest, {
          postedBy: 'system',
          reason: `Refund receipt — ${reason}`,
        });
        if (!reversed.ok) {
          return { ok: false, error: reversed.error };
        }
      }
      try {
        await useAccountingStore.getState().voidPayment(receipt.id);
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : 'Could not void receipt' };
      }
    }

    const afterReceipts = useAccountingStore.getState();
    const current = afterReceipts.invoices.find((row) => row.id === invoice.id);
    if (current && String(current.status) !== 'Void') {
      if (current.journalEntryId && !hasReversalForEntry(afterReceipts.journalEntries, current.journalEntryId)) {
        const reversed = postJournalEntryReversal(current.journalEntryId, afterReceipts, {
          postedBy: 'system',
          reason: `Refund invoice — ${reason}`,
        });
        if (!reversed.ok) {
          return { ok: false, error: reversed.error };
        }
      }
      try {
        await useAccountingStore.getState().voidInvoice(current.id);
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : 'Could not void invoice' };
      }
    }
  }

  const afterInv = useAccountingStore.getState();
  const cogsJe = afterInv.journalEntries.find((je) => je.id === cogsId && je.status === 'Posted');
  if (cogsJe && !hasReversalForEntry(afterInv.journalEntries, cogsId)) {
    const reversed = postJournalEntryReversal(cogsId, afterInv, {
      postedBy: 'system',
      reason: `Refund COGS — ${reason}`,
    });
    if (!reversed.ok) {
      return { ok: false, error: reversed.error };
    }
  }

  logAccountingProcess('AccountingCapture', 'F&B sale refunded', {
    orderId: params.orderId,
    source: params.source,
    reason,
  });
  return { ok: true };
}

export function conferenceDocBelongsToLiveEvent(
  doc: { reference?: string; eventId?: string; description?: string; invoiceId?: string },
  liveEventIds: Iterable<string>,
): boolean {
  const live = new Set(Array.from(liveEventIds).filter(Boolean));
  if (!live.size) return false;
  const haystack = [doc.reference, doc.eventId, doc.invoiceId, doc.description]
    .filter(Boolean)
    .map((value) => String(value));
  for (const id of live) {
    if (haystack.some((part) => part === id || part.includes(id))) return true;
  }
  return false;
}

export function captureConferenceProforma(input: {
  eventId: string;
  customerId?: string;
  customerName: string;
  description: string;
  subtotal: number;
  taxAmount?: number;
  total: number;
  date?: string;
  quoteNumber?: string;
}): string | null {
  if (!input.eventId || !(input.total > 0)) return null;
  const store = useAccountingStore.getState();
  const now = new Date().toISOString();
  const invoiceId = `INV-CONFERENCE-PRO-${input.eventId}`;
  const existing = store.invoices.find((invoice) => invoice.id === invoiceId);
  const invoiceNumber = input.quoteNumber || existing?.invoiceNumber || nextNumberFromLabels(
    'Q',
    store.invoices
      .filter((invoice) => invoice.sourceModule === 'conference' && invoice.isProforma)
      .map((invoice) => invoice.invoiceNumber)
  );
  const payload = {
    id: invoiceId,
    invoiceNumber,
    type: 'Sales' as const,
    isProforma: true,
    date: input.date || now,
    dueDate: now,
    businessPartnerId: input.customerId || `client_${input.eventId}`,
    reference: input.eventId,
    description: input.description,
    subtotal: input.subtotal,
    taxAmount: input.taxAmount || 0,
    total: input.total,
    currency: 'GHS',
    status: existing && !existing.isProforma ? existing.status : 'Draft',
    paidAmount: 0,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    lines: existing?.lines || [],
    sourceModule: 'conference' as const,
    customerName: input.customerName,
  };
  if (existing) {
    if (!existing.isProforma) return existing.id;
    store.updateInvoice(invoiceId, payload as any);
    return invoiceId;
  }
  store.addInvoice(payload as any);
  return invoiceId;
}

export function markConferenceProformaConverted(eventId: string): void {
  if (!eventId) return;
  const store = useAccountingStore.getState();
  const invoiceId = `INV-CONFERENCE-PRO-${eventId}`;
  const existing = store.invoices.find((invoice) => invoice.id === invoiceId && invoice.isProforma);
  if (!existing) return;
  store.updateInvoice(invoiceId, {
    status: 'Converted' as any,
    updatedAt: new Date().toISOString(),
  } as any);
}

export async function retireOrphanConferenceInvoices(liveEventIds: string[]): Promise<{ voided: string[] }> {
  const live = Array.from(new Set((liveEventIds || []).map((id) => String(id || '').trim()).filter(Boolean)));
  if (!live.length) return { voided: [] };

  const voided: string[] = [];
  const snapshot = useAccountingStore.getState();
  const orphans = snapshot.invoices.filter((invoice) => {
    if (invoice.sourceModule !== 'conference') return false;
    if (invoice.isProforma) return false;
    if (String(invoice.status || '') === 'Void') return false;
    return !conferenceDocBelongsToLiveEvent(invoice as any, live);
  });

  for (const invoice of orphans) {
    const store = useAccountingStore.getState();
    const invoiceKeys = [invoice.id, invoice.invoiceNumber, invoice.reference]
      .filter(Boolean)
      .map((value) => String(value));
    const receipts = store.payments.filter((payment) => {
      if (payment.type !== 'Receipt' || payment.status === 'Void') return false;
      if (payment.invoiceId === invoice.id) return true;
      if (payment.sourceModule !== 'conference') return false;
      const haystack = [payment.invoiceId, payment.reference, payment.description]
        .filter(Boolean)
        .map((value) => String(value));
      return invoiceKeys.some((key) => haystack.some((part) => part === key || part.includes(key)));
    });

    let receiptsOk = true;
    for (const receipt of receipts) {
      const latestStore = useAccountingStore.getState();
      if (receipt.journalEntryId && !hasReversalForEntry(latestStore.journalEntries, receipt.journalEntryId)) {
        const reversed = postJournalEntryReversal(receipt.journalEntryId, latestStore, {
          postedBy: 'system',
          reason: `Retire orphan conference receipt ${receipt.paymentNumber}`,
        });
        if (!reversed.ok) {
          console.warn('[Accounting Integration] Could not reverse orphan conference receipt', receipt.paymentNumber, reversed.error);
          receiptsOk = false;
          break;
        }
      }
      try {
        await latestStore.voidPayment(receipt.id);
      } catch (error) {
        console.warn('[Accounting Integration] Could not void orphan conference receipt', receipt.paymentNumber, error);
        receiptsOk = false;
        break;
      }
    }
    if (!receiptsOk) continue;

    const latest = useAccountingStore.getState();
    const current = latest.invoices.find((row) => row.id === invoice.id);
    if (!current || current.status === 'Void') {
      voided.push(invoice.invoiceNumber || invoice.id);
      continue;
    }
    if ((current.paidAmount || 0) > 0.01) {
      console.warn('[Accounting Integration] Orphan conference invoice still shows paid amount after receipts', current.invoiceNumber);
      continue;
    }
    if (current.journalEntryId && !hasReversalForEntry(latest.journalEntries, current.journalEntryId)) {
      const reversed = postJournalEntryReversal(current.journalEntryId, latest, {
        postedBy: 'system',
        reason: `Retire orphan conference invoice ${current.invoiceNumber}`,
      });
      if (!reversed.ok) {
        console.warn('[Accounting Integration] Could not reverse orphan conference invoice', current.invoiceNumber, reversed.error);
        continue;
      }
    }
    try {
      await latest.voidInvoice(current.id);
      voided.push(current.invoiceNumber || current.id);
    } catch (error) {
      console.warn('[Accounting Integration] Could not void orphan conference invoice', current.invoiceNumber, error);
    }
  }
  return { voided };
}

/**
 * Export GL Account codes for use in other modules
 */
export { GL_ACCOUNTS, REVENUE_CENTERS, PAYMENT_GL_MAP } from './glAccounts';

