import type { JournalEntry } from '../accounting/models';
import { useAccountingStore } from '../accounting/store';
import { assertPeriodNotClosed } from '../accounting/periodClose';
import { logAccountingProcessWarn } from '../accounting/accountingProcessLog';
import { findJournalReversal, postJournalReversal } from '../accounting/journalReversal';
import { useComplianceStore } from '../compliance/store';
import { getNextDueDateForSchedule, scheduleInputFromRule, toIsoDateLocal } from '../compliance/dueDates';
import { taxCodeForGl, TAX_CODE_TO_REPORT_TYPE } from './glMap';

export type TaxRemittancePayment = {
  journalEntryId: string;
  entryNumber: string;
  date: string;
  amount: number;
  reference: string;
  bankAccountId: string | null;
  bankGlCode: string | null;
  taxGlCode: string;
  period: string;
  taxName: string;
};

/** Remittance JEs posted through Record payment for this tax GL + accrual period, not yet reversed. */
export function listTaxRemittances(
  journalEntries: JournalEntry[],
  taxGlCode: string,
  period: string,
): TaxRemittancePayment[] {
  const expectedStx = `${taxGlCode}-${period}`;
  const out: TaxRemittancePayment[] = [];
  for (const je of journalEntries) {
    if (je.status !== 'Posted') continue;
    if (String(je.sourceModule || '').toLowerCase() !== 'tax_remittance') continue;
    if (je.sourceTransactionId !== expectedStx) continue;
    if (findJournalReversal(journalEntries, je.id)) continue;

    const taxLine = je.lines.find((l) => l.accountCode === taxGlCode && Number(l.debit || 0) > 0.004);
    const bankLine = je.lines.find((l) => l.accountCode !== taxGlCode && Number(l.credit || 0) > 0.004);
    const amount = Number(taxLine?.debit || je.totalDebit || 0);
    if (amount <= 0.004) continue;

    const store = useAccountingStore.getState();
    const bankTxn = store.bankTransactions.find((t) => t.journalEntryId === je.id);
    const bankByGl = bankLine
      ? store.bankAccounts.find((b) => b.glAccountCode === bankLine.accountCode)
      : undefined;

    out.push({
      journalEntryId: je.id,
      entryNumber: je.entryNumber,
      date: je.date.slice(0, 10),
      amount,
      reference: je.reference || '',
      bankAccountId: bankTxn?.bankAccountId || bankByGl?.id || null,
      bankGlCode: bankLine?.accountCode || null,
      taxGlCode,
      period,
      taxName: String(taxLine?.description || je.description || '').replace(/\s+remitted\s+—.*$/i, '').trim() || taxGlCode,
    });
  }
  return out.sort((a, b) => b.date.localeCompare(a.date) || b.journalEntryId.localeCompare(a.journalEntryId));
}

/**
 * Reverse a Record-payment remittance: opposite journal (original stays Posted), put the cash
 * back on the paying account, remove the linked bank withdrawal.
 */
export function voidTaxRemittance(
  journalEntryId: string,
): { ok: true } | { ok: false; error: string } {
  const store = useAccountingStore.getState();
  const original = store.journalEntries.find((je) => je.id === journalEntryId);
  if (!original) return { ok: false, error: 'Payment not found' };
  if (String(original.sourceModule || '').toLowerCase() !== 'tax_remittance') {
    return { ok: false, error: 'Only payments recorded on this Taxes desk can be removed here' };
  }
  if (findJournalReversal(store.journalEntries, journalEntryId)) {
    return { ok: false, error: 'This payment is already removed' };
  }

  const result = postJournalReversal(
    journalEntryId,
    store.journalEntries,
    store.addJournalEntry,
    `Removed tax payment — ${original.description}`,
  );
  if (!result.ok) return result;

  const now = new Date().toISOString();
  const bankTxn = store.bankTransactions.find((t) => t.journalEntryId === journalEntryId);
  const amount = Number(original.totalDebit || 0);
  const bankId = bankTxn?.bankAccountId;
  if (bankId && amount > 0.004) {
    const live = useAccountingStore.getState().bankAccounts.find((b) => b.id === bankId);
    if (live) {
      const newBalance = Math.round(((live.currentBalance ?? 0) + amount) * 100) / 100;
      store.updateBankAccount(bankId, { currentBalance: newBalance, updatedAt: now });
    }
  }
  if (bankTxn) {
    store.deleteBankTransaction(bankTxn.id);
  }

  store.addAuditTrail({
    id: `AT-TAX-REMIT-VOID-${Date.now()}`,
    tableName: 'TaxRemittance',
    recordId: original.sourceTransactionId || journalEntryId,
    action: 'Delete',
    oldValues: {
      type: 'tax_remittance',
      journalEntryId,
      amount,
      reversedBy: result.reversal.id,
    },
    userId: 'system',
    timestamp: now,
  });

  return { ok: true };
}

/**
 * Marks the filing for this tax/period as submitted the moment its remittance posts — there
 * was previously no path anywhere in the app that ever told the Compliance & Reports filing
 * tracker that a VAT/WHT/NHIL/GETFund/Tourism/PAYE/SSNIT payment had actually been made, so
 * "Filing compliance" stayed stuck at 0% regardless of real payment activity (only payroll's
 * own PAYE/SSNIT sync ever wrote into it). Silently no-ops for a tax code with no filing
 * schedule of its own (COVID levy — bundled into the VAT return).
 */
function syncTaxRemittanceToComplianceFiling(input: CaptureTaxRemittanceInput): void {
  const taxCode = taxCodeForGl(input.taxGlCode);
  const reportType = taxCode ? TAX_CODE_TO_REPORT_TYPE[taxCode] : undefined;
  if (!reportType) return;

  const compliance = useComplianceStore.getState();
  const schedule = compliance.reportingRules.find(
    (r) => r.countryCode === compliance.country && r.reportType === reportType
  );

  // Anchor "next due date" on the period's own end (not today) so a remittance for an old
  // period doesn't get stamped with a due date computed from today's calendar position.
  const periodEnd = new Date(`${input.period}-01T00:00:00`);
  periodEnd.setMonth(periodEnd.getMonth() + 1);
  periodEnd.setDate(0);
  const dueDate = schedule
    ? toIsoDateLocal(getNextDueDateForSchedule(scheduleInputFromRule(schedule), periodEnd))
    : input.date.slice(0, 10);

  compliance.upsertReport({
    countryCode: compliance.country,
    reportType,
    period: input.period,
    dueDate,
    status: 'submitted',
    amount: input.amount,
    currency: 'GHS',
    notes: `Auto from tax remittance — ${input.taxName}, ${input.reference || input.period}`,
  });
}

function lineId() {
  return `JEL-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function jeNumber() {
  return `JE-${Date.now().toString().slice(-8)}`;
}

export interface CaptureTaxRemittanceInput {
  taxGlCode: string;
  taxName: string;
  /** YYYY-MM, the period this payment settles */
  period: string;
  amount: number;
  date: string;
  reference?: string;
  bankAccountId: string;
}

/**
 * Posts a tax remittance: Dr the tax liability GL (reduces what's owed) / Cr the paying bank
 * account, tagged `sourceModule: 'tax_remittance'` so ledgerRollup.ts's isRemittanceJe() picks
 * it up as an actual GRA payment rather than an unclassified adjustment. Also records a real
 * bank withdrawal + balance update, same as every other "pay from a real account" flow in this
 * app (PPE capitalization/disposal) — there was previously no way anywhere in the system to
 * record that a tax liability had actually been paid.
 */
export function captureTaxRemittance(input: CaptureTaxRemittanceInput): { journalEntryId: string } | null {
  if (input.amount <= 0.004) return null;
  const store = useAccountingStore.getState();
  const bank = store.bankAccounts.find((b) => b.id === input.bankAccountId);
  if (!bank) return null;

  const periodCheck = assertPeriodNotClosed(store.journalEntries, input.date);
  if (!periodCheck.ok) {
    logAccountingProcessWarn('TaxRemittance', 'Tax remittance GL post blocked — closed period', {
      taxGlCode: input.taxGlCode,
      period: input.period,
      error: periodCheck.error,
    });
    return null;
  }

  const now = new Date().toISOString();
  const jeId = `JE-TAX-REMIT-${Date.now()}`;
  const reference = input.reference || `${input.taxName} ${input.period}`;

  const je: JournalEntry = {
    id: jeId,
    entryNumber: jeNumber(),
    date: input.date.slice(0, 10),
    reference,
    description: `Tax remittance — ${input.taxName} (${input.period}) to GRA`,
    totalDebit: input.amount,
    totalCredit: input.amount,
    currency: 'GHS',
    status: 'Posted',
    postedBy: 'system',
    postedAt: now,
    createdAt: now,
    updatedAt: now,
    sourceModule: 'tax_remittance',
    sourceTransactionId: `${input.taxGlCode}-${input.period}`,
    lines: [
      {
        id: lineId(),
        journalEntryId: jeId,
        accountCode: input.taxGlCode,
        description: `${input.taxName} remitted — ${input.period}`,
        debit: input.amount,
        credit: 0,
        currency: 'GHS',
      },
      {
        id: lineId(),
        journalEntryId: jeId,
        accountCode: bank.glAccountCode,
        description: 'Settlement — GRA payment',
        debit: 0,
        credit: input.amount,
        currency: 'GHS',
      },
    ],
  };

  try {
    store.addJournalEntry(je);

    const live = useAccountingStore.getState().bankAccounts.find((b) => b.id === bank.id) || bank;
    const newBalance = Math.round(((live.currentBalance ?? 0) - input.amount) * 100) / 100;
    store.updateBankAccount(bank.id, { currentBalance: newBalance, updatedAt: now });
    store.addBankTransaction({
      id: `BT-TAX-REMIT-${jeId}`,
      bankAccountId: bank.id,
      transactionDate: input.date.slice(0, 10),
      reference,
      description: `Tax remittance — ${input.taxName} (${input.period})`,
      amount: input.amount,
      type: 'Withdrawal',
      currency: bank.currency || 'GHS',
      balance: newBalance,
      status: 'Cleared',
      journalEntryId: jeId,
      createdAt: now,
    });

    store.addAuditTrail({
      id: `AT-TAX-REMIT-${Date.now()}`,
      tableName: 'TaxRemittance',
      recordId: `${input.taxGlCode}-${input.period}`,
      action: 'Post',
      newValues: {
        type: 'tax_remittance',
        journalEntryId: jeId,
        amount: input.amount,
        taxGlCode: input.taxGlCode,
        period: input.period,
      },
      userId: 'system',
      timestamp: now,
    });

    syncTaxRemittanceToComplianceFiling(input);

    return { journalEntryId: jeId };
  } catch {
    return null;
  }
}
