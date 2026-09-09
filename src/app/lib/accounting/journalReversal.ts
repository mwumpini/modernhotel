/**
 * GL reversal entries for voiding posted AR/AP subledger documents.
 */

import type { JournalEntry, JournalEntryLine } from './models';
import { assertPeriodNotClosed } from './periodClose';

export const AR_AP_REVERSAL_SOURCE = 'manual_ar_ap_reversal';

function nowIso(): string {
  return new Date().toISOString();
}

function nextEntryNumber(seq: number): string {
  return `JE-${new Date().getFullYear()}-${String(seq + 1).padStart(4, '0')}`;
}

export function hasReversalForEntry(journalEntries: JournalEntry[], originalEntryId: string): boolean {
  return journalEntries.some(
    (je) => je.sourceModule === AR_AP_REVERSAL_SOURCE && je.sourceTransactionId === originalEntryId,
  );
}

export function buildReversalJournalEntry(
  original: JournalEntry,
  opts: { journalSeq: number; postedBy?: string; reason?: string },
): JournalEntry | null {
  if (original.status !== 'Posted') return null;
  if (hasReversalForEntry([], original.id)) {
    // caller should guard with hasReversalForEntry(store.journalEntries, id)
  }

  const revId = `JE-REV-${original.id}-${Date.now()}`;
  const ts = nowIso();
  const lines: JournalEntryLine[] = original.lines.map((line, i) => ({
    ...line,
    id: `JL-${revId}-${i + 1}`,
    journalEntryId: revId,
    debit: +(line.credit || 0).toFixed(2),
    credit: +(line.debit || 0).toFixed(2),
    description: line.description ? `Rev — ${line.description}` : 'Reversal',
  }));

  const totalDebit = +lines.reduce((s, l) => s + (l.debit || 0), 0).toFixed(2);
  const totalCredit = +lines.reduce((s, l) => s + (l.credit || 0), 0).toFixed(2);

  return {
    id: revId,
    entryNumber: nextEntryNumber(opts.journalSeq),
    date: ts.slice(0, 10),
    reference: original.reference,
    description: opts.reason || `Reversal — ${original.description}`,
    totalDebit,
    totalCredit,
    currency: original.currency,
    exchangeRate: original.exchangeRate,
    status: 'Posted',
    postedBy: opts.postedBy || 'system',
    postedAt: ts,
    createdAt: ts,
    updatedAt: ts,
    lines,
    sourceModule: AR_AP_REVERSAL_SOURCE,
    sourceTransactionId: original.id,
  };
}

export interface ReversalStoreActions {
  journalEntries: JournalEntry[];
  currentPeriod: string;
  addJournalEntry: (entry: JournalEntry) => void;
  updateGLBalance: (
    accountCode: string,
    period: string,
    updates: { currentDebit?: number; currentCredit?: number },
  ) => void;
}

/** Post a reversing JE and mark the original as Void (idempotent). */
export function postJournalEntryReversal(
  originalEntryId: string,
  store: ReversalStoreActions,
  opts: { postedBy?: string; reason?: string; persistEntry?: (entry: JournalEntry) => void; markOriginalVoid?: (id: string) => void },
): { ok: true; reversal: JournalEntry } | { ok: false; error: string } {
  const original = store.journalEntries.find((e) => e.id === originalEntryId);
  if (!original) return { ok: false, error: 'Journal entry not found' };
  if (original.status === 'Void') return { ok: false, error: 'Entry is already void' };
  if (original.status !== 'Posted') return { ok: false, error: 'Only posted entries can be reversed' };
  if (hasReversalForEntry(store.journalEntries, originalEntryId)) {
    return { ok: false, error: 'Entry already has a reversal' };
  }

  const periodCheck = assertPeriodNotClosed(store.journalEntries, new Date().toISOString());
  if (!periodCheck.ok) {
    return { ok: false, error: periodCheck.error };
  }

  const reversal = buildReversalJournalEntry(original, {
    journalSeq: store.journalEntries.length,
    postedBy: opts.postedBy,
    reason: opts.reason,
  });
  if (!reversal) return { ok: false, error: 'Could not build reversal entry' };

  store.addJournalEntry(reversal);
  for (const line of reversal.lines) {
    store.updateGLBalance(line.accountCode, store.currentPeriod, {
      currentDebit: line.debit || 0,
      currentCredit: line.credit || 0,
    });
  }
  opts.persistEntry?.(reversal);
  opts.markOriginalVoid?.(originalEntryId);

  return { ok: true, reversal };
}

export function isManualArApSource(sourceModule?: string): boolean {
  return (
    !sourceModule ||
    sourceModule === 'manual' ||
    sourceModule === 'manual_ar_ap' ||
    sourceModule === 'manual_ar_ap_wht'
  );
}
