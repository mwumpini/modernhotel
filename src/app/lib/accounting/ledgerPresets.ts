'use client';

/**
 * Explicit GL presets for NHIA / insurance receivables and payroll accruals.
 * Matches extended Ghana hotel COA (1225, 1226, 2210, 2220, 5210, 2300).
 */

import { useAccountingStore } from './store';
import { useSettingsStore } from '../settings/store';
import type { InvoiceLine } from './models';

export const LEDGER_PRESET_GL = {
  NHIA_RECEIVABLE: '1225',
  INSURANCE_RECEIVABLE: '1226',
  CLAIM_REVENUE: '4300',
  SALARIES_EXPENSE: '5210',
  PAYE_PAYABLE: '2210',
  SSNIT_PAYABLE: '2220',
  ACCRUED_NET_PAYROLL: '2300',
} as const;

function nowIso() {
  return new Date().toISOString();
}

function jeLine(
  jeId: string,
  suffix: string,
  accountCode: string,
  desc: string,
  debit: number,
  credit: number,
  costCenter?: string
) {
  return {
    id: `JL-${jeId}-${suffix}`,
    journalEntryId: jeId,
    accountCode,
    description: desc,
    debit: +debit.toFixed(2),
    credit: +credit.toFixed(2),
    currency: 'GHS' as const,
    ...(costCenter ? { costCenter } : {}),
  };
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

/**
 * NHIA / NHIS amount owed to the hotel — Dr NHIA receivable, Cr other revenue (tariff / claim).
 */
export function postNHIAReceivableClaim(input: {
  businessPartnerId: string;
  description: string;
  amount: number;
  reference?: string;
}): { invoiceId: string; journalEntryId: string } | null {
  const amt = round2(input.amount);
  if (amt <= 0) return null;

  const store = useAccountingStore.getState();
  const settings = useSettingsStore.getState();
  const ts = nowIso();
  const invId = `INV-NHIA-${Date.now()}`;
  const jeId = `JE-NHIA-${Date.now()}`;
  const invNumber = settings.getNextInvoiceNumber();

  const line: InvoiceLine = {
    id: `IL-${invId}-1`,
    invoiceId: invId,
    description: input.description || 'NHIA / NHIS claim',
    quantity: 1,
    unitPrice: amt,
    amount: amt,
    taxAmount: 0,
    glAccountCode: LEDGER_PRESET_GL.CLAIM_REVENUE,
  };

  const invoice = {
    id: invId,
    invoiceNumber: invNumber,
    type: 'Sales' as const,
    date: ts,
    dueDate: ts,
    businessPartnerId: input.businessPartnerId,
    reference: input.reference || 'NHIA',
    description: input.description,
    subtotal: amt,
    taxAmount: 0,
    total: amt,
    currency: 'GHS',
    status: 'Posted' as const,
    paidAmount: 0,
    createdAt: ts,
    updatedAt: ts,
    lines: [line],
    sourceModule: 'accounting_preset',
    salesLedgerPreset: 'nhia_claim' as const,
  };

  store.addInvoice(invoice as any);

  const entry = {
    id: jeId,
    entryNumber: `JE-${new Date().getFullYear()}-NHIA-${Date.now().toString().slice(-6)}`,
    date: ts,
    reference: input.reference || invNumber,
    description: `NHIA receivable — ${input.description}`,
    totalDebit: amt,
    totalCredit: amt,
    currency: 'GHS',
    status: 'Posted' as const,
    postedBy: 'system',
    postedAt: ts,
    createdAt: ts,
    updatedAt: ts,
    lines: [
      jeLine(jeId, 'ar', LEDGER_PRESET_GL.NHIA_RECEIVABLE, 'NHIA / NHIS receivable', amt, 0, 'RM'),
      jeLine(jeId, 'rev', LEDGER_PRESET_GL.CLAIM_REVENUE, 'NHIS tariff / claim revenue', 0, amt, 'RM'),
    ],
    sourceModule: 'accounting_preset',
    sourceTransactionId: invId,
  };

  store.addJournalEntry(entry as any);
  try {
    store.updateInvoice(invId, { journalEntryId: jeId } as any);
  } catch {}

  store.addAuditTrail({
    id: `AT-NHIA-${Date.now()}`,
    tableName: 'LedgerPreset',
    recordId: invId,
    action: 'Post',
    oldValues: null as any,
    newValues: { preset: 'nhia_claim', amount: amt, journalEntryId: jeId },
    userId: 'system',
    timestamp: ts,
  });

  return { invoiceId: invId, journalEntryId: jeId };
}

/**
 * Insurance (corporate / travel) recovery — Dr insurance receivable, Cr other revenue.
 */
export function postInsuranceReceivableClaim(input: {
  businessPartnerId: string;
  description: string;
  amount: number;
  reference?: string;
}): { invoiceId: string; journalEntryId: string } | null {
  const amt = round2(input.amount);
  if (amt <= 0) return null;

  const store = useAccountingStore.getState();
  const settings = useSettingsStore.getState();
  const ts = nowIso();
  const invId = `INV-INS-${Date.now()}`;
  const jeId = `JE-INS-${Date.now()}`;
  const invNumber = settings.getNextInvoiceNumber();

  const line: InvoiceLine = {
    id: `IL-${invId}-1`,
    invoiceId: invId,
    description: input.description || 'Insurance receivable',
    quantity: 1,
    unitPrice: amt,
    amount: amt,
    taxAmount: 0,
    glAccountCode: LEDGER_PRESET_GL.CLAIM_REVENUE,
  };

  const invoice = {
    id: invId,
    invoiceNumber: invNumber,
    type: 'Sales' as const,
    date: ts,
    dueDate: ts,
    businessPartnerId: input.businessPartnerId,
    reference: input.reference || 'INSURANCE',
    description: input.description,
    subtotal: amt,
    taxAmount: 0,
    total: amt,
    currency: 'GHS',
    status: 'Posted' as const,
    paidAmount: 0,
    createdAt: ts,
    updatedAt: ts,
    lines: [line],
    sourceModule: 'accounting_preset',
    salesLedgerPreset: 'insurance_receivable' as const,
  };

  store.addInvoice(invoice as any);

  const entry = {
    id: jeId,
    entryNumber: `JE-${new Date().getFullYear()}-INS-${Date.now().toString().slice(-6)}`,
    date: ts,
    reference: input.reference || invNumber,
    description: `Insurance receivable — ${input.description}`,
    totalDebit: amt,
    totalCredit: amt,
    currency: 'GHS',
    status: 'Posted' as const,
    postedBy: 'system',
    postedAt: ts,
    createdAt: ts,
    updatedAt: ts,
    lines: [
      jeLine(jeId, 'ar', LEDGER_PRESET_GL.INSURANCE_RECEIVABLE, 'Insurance receivable', amt, 0, 'RM'),
      jeLine(jeId, 'rev', LEDGER_PRESET_GL.CLAIM_REVENUE, 'Insurance / third-party revenue', 0, amt, 'RM'),
    ],
    sourceModule: 'accounting_preset',
    sourceTransactionId: invId,
  };

  store.addJournalEntry(entry as any);
  try {
    store.updateInvoice(invId, { journalEntryId: jeId } as any);
  } catch {}

  store.addAuditTrail({
    id: `AT-INS-${Date.now()}`,
    tableName: 'LedgerPreset',
    recordId: invId,
    action: 'Post',
    oldValues: null as any,
    newValues: { preset: 'insurance_receivable', amount: amt, journalEntryId: jeId },
    userId: 'system',
    timestamp: ts,
  });

  return { invoiceId: invId, journalEntryId: jeId };
}

/**
 * Payroll accrual for a period: Dr salaries (gross), Cr PAYE, Cr SSNIT, Cr accrued net pay.
 * Credits must sum to gross (within 0.02).
 */
export function postPayrollAccrualJournal(input: {
  grossPay: number;
  payePayable: number;
  ssnitPayable: number;
  netPayable: number;
  periodLabel: string;
  reference?: string;
}): { journalEntryId: string } | null {
  const gross = round2(input.grossPay);
  const paye = round2(input.payePayable);
  const ssnit = round2(input.ssnitPayable);
  const net = round2(input.netPayable);
  const credits = round2(paye + ssnit + net);
  if (gross <= 0) return null;
  if (Math.abs(gross - credits) > 0.02) {
    console.warn('[ledgerPresets] Payroll accrual not balanced', { gross, credits, paye, ssnit, net });
    return null;
  }

  const store = useAccountingStore.getState();
  const ts = nowIso();
  const jeId = `JE-PAY-${Date.now()}`;

  const lines = [
    jeLine(jeId, 'sal', LEDGER_PRESET_GL.SALARIES_EXPENSE, `Salaries & wages — ${input.periodLabel}`, gross, 0, 'ADM'),
  ];
  if (paye > 0) lines.push(jeLine(jeId, 'paye', LEDGER_PRESET_GL.PAYE_PAYABLE, 'PAYE withheld', 0, paye, 'ADM'));
  if (ssnit > 0) lines.push(jeLine(jeId, 'ssnit', LEDGER_PRESET_GL.SSNIT_PAYABLE, 'SSNIT / Tier-1 due', 0, ssnit, 'ADM'));
  if (net > 0)
    lines.push(
      jeLine(jeId, 'net', LEDGER_PRESET_GL.ACCRUED_NET_PAYROLL, 'Net payroll accrued (unpaid)', 0, net, 'ADM')
    );

  const entry = {
    id: jeId,
    entryNumber: `JE-${new Date().getFullYear()}-PAY-${Date.now().toString().slice(-6)}`,
    date: ts,
    reference: input.reference || input.periodLabel,
    description: `Payroll accrual — ${input.periodLabel}`,
    totalDebit: gross,
    totalCredit: gross,
    currency: 'GHS',
    status: 'Posted' as const,
    postedBy: 'system',
    postedAt: ts,
    createdAt: ts,
    updatedAt: ts,
    lines,
    sourceModule: 'accounting_preset',
    sourceTransactionId: jeId,
  };

  store.addJournalEntry(entry as any);

  store.addAuditTrail({
    id: `AT-PAY-${Date.now()}`,
    tableName: 'LedgerPreset',
    recordId: jeId,
    action: 'Post',
    oldValues: null as any,
    newValues: { preset: 'payroll_accrual', gross, paye, ssnit, net, period: input.periodLabel },
    userId: 'system',
    timestamp: ts,
  });

  return { journalEntryId: jeId };
}
