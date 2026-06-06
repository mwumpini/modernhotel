'use client';

/**
 * Simple hotel accounting flow — front office:
 * - Folio = operational subledger during the stay (charges/payments only).
 * - General ledger: one sales posting at checkout (Dr AR, Cr revenue + VAT)
 *   plus per folio payment line:
 *     · Receipt: Dr Cash/Bank, Cr AR
 *     · Refund (negative folio payment): Dr AR, Cr Cash/Bank (return of funds)
 *
 * Events/POS continue to use integration.ts (captureRevenue / capturePayment)
 * for real-time departmental posting — see revenueSourcePolicy.ts for reporting.
 */

import { useAccountingStore } from './store';
import { GL_ACCOUNTS, REVENUE_CENTERS, PAYMENT_GL_MAP } from './integration';
import { computeSalesTax } from '../tax/engine';

function nowIso() {
  return new Date().toISOString();
}

export function postGuestFolioCheckoutToLedger(params: {
  invoiceId: string;
  invoiceNumber: string;
  reference: string;
  guestLabel: string;
  reservationId: string;
  lines: Array<{ amount: number; glAccountCode: string }>;
  subtotal: number;
  taxAmount: number;
  total: number;
  payments: Array<{ amount: number; method: string; date: string }>;
}): { salesJournalEntryId: string } | null {
  if (params.total <= 0) return null;

  const store = useAccountingStore.getState();
  const ts = nowIso();

  // recordRevenue() needs a center with code RM. If the user has not opened a module
  // that runs initializeAccounting() yet, revenue centers can be empty.
  if (!store.revenueCenters.some((rc) => rc.code === REVENUE_CENTERS.ROOM)) {
    store.addRevenueCenter({
      id: `RC-RM-${Date.now()}`,
      code: REVENUE_CENTERS.ROOM,
      name: 'Rooms',
      description: 'Auto-created for guest folio checkout',
      type: 'rooms',
      department: 'front_office',
      glAccountCode: GL_ACCOUNTS.ROOM_REVENUE,
      budget: 0,
      actualRevenue: 0,
      isActive: true,
      createdAt: ts,
      updatedAt: ts,
    });
  }

  const revenueByGl = new Map<string, number>();
  for (const line of params.lines) {
    const code = line.glAccountCode || GL_ACCOUNTS.ROOM_REVENUE;
    revenueByGl.set(code, (revenueByGl.get(code) || 0) + line.amount);
  }

  const salesJeId = `JE-FO-CHK-${params.invoiceId}`;
  const jl = (suffix: string) => `JL-${salesJeId}-${suffix}`;

  const lines: Array<{
    id: string;
    journalEntryId: string;
    accountCode: string;
    description: string;
    debit: number;
    credit: number;
    currency: string;
    costCenter?: string;
  }> = [
    {
      id: jl('ar'),
      journalEntryId: salesJeId,
      accountCode: GL_ACCOUNTS.ACCOUNTS_RECEIVABLE,
      description: `AR — Folio ${params.invoiceNumber}`,
      debit: +params.total.toFixed(2),
      credit: 0,
      currency: 'GHS',
      costCenter: REVENUE_CENTERS.ROOM,
    },
  ];

  for (const [code, amt] of revenueByGl) {
    if (amt <= 0) continue;
    lines.push({
      id: jl(`rev-${code}`),
      journalEntryId: salesJeId,
      accountCode: code,
      description: `Revenue — ${params.guestLabel}`,
      debit: 0,
      credit: +amt.toFixed(2),
      currency: 'GHS',
      costCenter: REVENUE_CENTERS.ROOM,
    });
  }

  if (params.taxAmount > 0) {
    const { lines: taxLines } = computeSalesTax(params.subtotal, params.taxAmount);
    taxLines.forEach((tl, i) => {
      if (tl.amount <= 0) return;
      lines.push({
        id: jl(`tax-${tl.taxCode}-${i}`),
        journalEntryId: salesJeId,
        accountCode: tl.glAccountCode,
        description: `${tl.name} — ${params.invoiceNumber}`,
        debit: 0,
        credit: +tl.amount.toFixed(2),
        currency: 'GHS',
        costCenter: REVENUE_CENTERS.ROOM,
      });
    });
  }

  const sumCredit = lines.slice(1).reduce((s, l) => s + (l.credit || 0), 0);
  const sumDebit = lines[0].debit || 0;
  if (Math.abs(sumDebit - sumCredit) > 0.02) {
    console.warn('[simpleFlow] Sales JE not balanced', { sumDebit, sumCredit, params });
  }

  const salesEntry = {
    id: salesJeId,
    entryNumber: `JE-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`,
    date: ts,
    reference: params.reference,
    description: `Guest folio posted — ${params.invoiceNumber}`,
    totalDebit: sumDebit,
    totalCredit: sumDebit,
    currency: 'GHS',
    status: 'Posted' as const,
    postedBy: 'system',
    postedAt: ts,
    createdAt: ts,
    updatedAt: ts,
    lines,
    sourceModule: 'front_office_checkout',
    sourceTransactionId: params.reservationId,
  };

  store.addJournalEntry(salesEntry as any);
  store.recordRevenue(REVENUE_CENTERS.ROOM, params.subtotal);

  store.addAuditTrail({
    id: `AT-SF-${Date.now()}`,
    tableName: 'SimpleFlow',
    recordId: params.invoiceId,
    action: 'Post',
    oldValues: null as any,
    newValues: {
      type: 'FolioCheckoutSales',
      journalEntryId: salesJeId,
      invoiceNumber: params.invoiceNumber,
      total: params.total,
    },
    userId: 'system',
    timestamp: ts,
  });

  params.payments.forEach((p, i) => {
    const raw = p.amount;
    if (raw === 0 || raw === null || raw === undefined || Number.isNaN(raw)) return;
    const abs = Math.abs(raw);
    const isRefund = raw < 0;
    const cashGl = PAYMENT_GL_MAP[p.method] || GL_ACCOUNTS.CASH;
    const payJeId = `JE-FO-${isRefund ? 'REF' : 'PAY'}-${params.invoiceId}-${i}-${Date.now()}`;

    const payLines = isRefund
      ? [
          {
            id: `JL-${payJeId}-dr`,
            journalEntryId: payJeId,
            accountCode: GL_ACCOUNTS.ACCOUNTS_RECEIVABLE,
            description: `Refund — restore AR (${params.invoiceNumber})`,
            debit: +abs.toFixed(2),
            credit: 0,
            currency: 'GHS',
            costCenter: REVENUE_CENTERS.ROOM,
          },
          {
            id: `JL-${payJeId}-cr`,
            journalEntryId: payJeId,
            accountCode: cashGl,
            description: `Cash out — guest refund (${p.method})`,
            debit: 0,
            credit: +abs.toFixed(2),
            currency: 'GHS',
            costCenter: REVENUE_CENTERS.ROOM,
          },
        ]
      : [
          {
            id: `JL-${payJeId}-dr`,
            journalEntryId: payJeId,
            accountCode: cashGl,
            description: `Receipt — ${p.method}`,
            debit: +abs.toFixed(2),
            credit: 0,
            currency: 'GHS',
            costCenter: REVENUE_CENTERS.ROOM,
          },
          {
            id: `JL-${payJeId}-cr`,
            journalEntryId: payJeId,
            accountCode: GL_ACCOUNTS.ACCOUNTS_RECEIVABLE,
            description: `Clear AR — ${params.invoiceNumber}`,
            debit: 0,
            credit: +abs.toFixed(2),
            currency: 'GHS',
            costCenter: REVENUE_CENTERS.ROOM,
          },
        ];

    store.addJournalEntry({
      id: payJeId,
      entryNumber: `JE-${new Date().getFullYear()}-${isRefund ? 'RF' : 'R'}${Date.now().toString().slice(-5)}${i}`,
      date: p.date || ts,
      reference: params.invoiceNumber,
      description: isRefund
        ? `Guest refund — ${params.guestLabel}`
        : `Guest payment — ${params.guestLabel}`,
      totalDebit: abs,
      totalCredit: abs,
      currency: 'GHS',
      status: 'Posted',
      postedBy: 'system',
      postedAt: ts,
      createdAt: ts,
      updatedAt: ts,
      lines: payLines,
      sourceModule: 'front_office_checkout',
      sourceTransactionId: params.reservationId,
    } as any);

    store.addAuditTrail({
      id: `AT-SF-PAY-${Date.now()}-${i}`,
      tableName: 'SimpleFlow',
      recordId: payJeId,
      action: 'Post',
      oldValues: null as any,
      newValues: {
        type: isRefund ? 'FolioCheckoutRefund' : 'FolioCheckoutReceipt',
        amount: raw,
        method: p.method,
        invoiceNumber: params.invoiceNumber,
      },
      userId: 'system',
      timestamp: ts,
    });
  });

  try {
    store.updateInvoice(params.invoiceId, { journalEntryId: salesJeId } as any);
  } catch (e) {
    console.warn('[simpleFlow] updateInvoice journal link failed', e);
  }

  return { salesJournalEntryId: salesJeId };
}

/** No-show penalty — direct GL (not checkout). Dr AR, Cr room revenue + tax; optional card receipt. */
export function postNoShowPenaltyToLedger(params: {
  reservationId: string;
  reference: string;
  guestLabel: string;
  subtotal: number;
  taxAmount: number;
  total: number;
  cardCollected?: { amount: number; date?: string };
}): { salesJournalEntryId: string } | null {
  if (params.total <= 0) return null;

  const store = useAccountingStore.getState();
  const ts = nowIso();
  const invRef = `NS-${params.reference}`;

  const salesJeId = `JE-FO-NS-${params.reservationId}-${Date.now().toString().slice(-6)}`;
  const jl = (suffix: string) => `JL-${salesJeId}-${suffix}`;

  const lines: Array<{
    id: string;
    journalEntryId: string;
    accountCode: string;
    description: string;
    debit: number;
    credit: number;
    currency: string;
    costCenter?: string;
  }> = [
    {
      id: jl('ar'),
      journalEntryId: salesJeId,
      accountCode: GL_ACCOUNTS.ACCOUNTS_RECEIVABLE,
      description: `AR — No-show ${invRef}`,
      debit: +params.total.toFixed(2),
      credit: 0,
      currency: 'GHS',
      costCenter: REVENUE_CENTERS.ROOM,
    },
    {
      id: jl('rev'),
      journalEntryId: salesJeId,
      accountCode: GL_ACCOUNTS.ROOM_REVENUE,
      description: `No-show penalty — ${params.guestLabel}`,
      debit: 0,
      credit: +params.subtotal.toFixed(2),
      currency: 'GHS',
      costCenter: REVENUE_CENTERS.ROOM,
    },
  ];

  if (params.taxAmount > 0) {
    const { lines: taxLines } = computeSalesTax(params.subtotal, params.taxAmount);
    taxLines.forEach((tl, i) => {
      if (tl.amount <= 0) return;
      lines.push({
        id: jl(`tax-${tl.taxCode}-${i}`),
        journalEntryId: salesJeId,
        accountCode: tl.glAccountCode,
        description: `${tl.name} — No-show ${invRef}`,
        debit: 0,
        credit: +tl.amount.toFixed(2),
        currency: 'GHS',
        costCenter: REVENUE_CENTERS.ROOM,
      });
    });
  }

  store.addJournalEntry({
    id: salesJeId,
    entryNumber: `JE-${new Date().getFullYear()}-NS${Date.now().toString().slice(-5)}`,
    date: ts,
    reference: invRef,
    description: `No-show penalty — ${params.guestLabel}`,
    totalDebit: params.total,
    totalCredit: params.total,
    currency: 'GHS',
    status: 'Posted',
    postedBy: 'system',
    postedAt: ts,
    createdAt: ts,
    updatedAt: ts,
    lines,
    sourceModule: 'front_office_noshow',
    sourceTransactionId: params.reservationId,
  } as any);

  store.recordRevenue(REVENUE_CENTERS.ROOM, params.subtotal);

  if (params.cardCollected && params.cardCollected.amount > 0) {
    const abs = params.cardCollected.amount;
    const payJeId = `JE-FO-NS-PAY-${params.reservationId}-${Date.now()}`;
    const cashGl = PAYMENT_GL_MAP['Card'] || GL_ACCOUNTS.BANK;
    store.addJournalEntry({
      id: payJeId,
      entryNumber: `JE-${new Date().getFullYear()}-NSR${Date.now().toString().slice(-5)}`,
      date: params.cardCollected.date || ts,
      reference: invRef,
      description: `No-show card charge — ${params.guestLabel}`,
      totalDebit: abs,
      totalCredit: abs,
      currency: 'GHS',
      status: 'Posted',
      postedBy: 'system',
      postedAt: ts,
      createdAt: ts,
      updatedAt: ts,
      lines: [
        {
          id: `JL-${payJeId}-dr`,
          journalEntryId: payJeId,
          accountCode: cashGl,
          description: 'Card — no-show guarantee',
          debit: +abs.toFixed(2),
          credit: 0,
          currency: 'GHS',
          costCenter: REVENUE_CENTERS.ROOM,
        },
        {
          id: `JL-${payJeId}-cr`,
          journalEntryId: payJeId,
          accountCode: GL_ACCOUNTS.ACCOUNTS_RECEIVABLE,
          description: `Clear AR — No-show ${invRef}`,
          debit: 0,
          credit: +abs.toFixed(2),
          currency: 'GHS',
          costCenter: REVENUE_CENTERS.ROOM,
        },
      ],
      sourceModule: 'front_office_noshow',
      sourceTransactionId: params.reservationId,
    } as any);
  }

  return { salesJournalEntryId: salesJeId };
}
