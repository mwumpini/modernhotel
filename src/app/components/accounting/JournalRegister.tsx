'use client';

import React, { useMemo, useState, useEffect } from 'react';
import {
  Alert,
  Button,
  Input,
  Select,
  SelectItem,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Chip,
  Pagination,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from '@heroui/react';
import { useAccountingStore } from '../../lib/accounting/store';
import { confirmDelete as askDelete, confirmUnvoid as askUnvoid, confirmVoid as askVoid } from '../DangerConfirm';
import { accountingAmountsLabel } from '../../lib/accounting/tenantAccountingConfig';
import { downloadCSV, generatePdfHtml, openPrintPreview } from '../../lib/accounting/helpers/exportHelpers';
import type { ChartOfAccounts, JournalEntry, JournalEntryLine } from '../../lib/accounting/models';
import { GHANA_CHART_OF_ACCOUNTS } from '../../lib/accounting/models';
import { findJournalReversal, postJournalReversal } from '../../lib/accounting/journalReversal';
import { migrateCoaParentIds } from '../../lib/accounting/coaTree';
import { SortLabel, deskResizableTableClassNames, rowClassNames, useResizableColumns } from '../frontoffice/columnResize';
import { useDeskPagination } from '../dashboard/deskTableUi';
import HeadingInfo from '../HeadingInfo';
import { DeskKpiStrip, useAccountingDeskPeriod } from './DeskKpiStrip';

type JournalSortKey = 'entry' | 'date' | 'reference' | 'description' | 'source' | 'status' | 'debit' | 'credit';

function dayOf(iso?: string) {
  return (iso || '').slice(0, 10);
}

function formatPlainAmount(amount: number) {
  return Math.abs(amount).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function journalPrintHtml(
  entries: JournalEntry[],
  accountName: (code: string) => string,
) {
  const blocks = entries.map((entry) => {
    const lines = entry.lines.map((line) => `
      <tr>
        <td>${escapeHtml(line.accountCode)} ${escapeHtml(accountName(line.accountCode))}</td>
        <td>${escapeHtml(line.description || '—')}</td>
        <td class="amount">${line.debit ? formatPlainAmount(line.debit) : ''}</td>
        <td class="amount">${line.credit ? formatPlainAmount(line.credit) : ''}</td>
      </tr>`).join('');
    return `
      <div class="section">
        <div class="section-title">${escapeHtml(entry.entryNumber)} · ${escapeHtml(dayOf(entry.date))} · ${escapeHtml(entry.status)}</div>
        <p style="margin-bottom:8px;font-size:13px;">
          ${escapeHtml(entry.description || '—')}
          ${entry.reference ? ` · ${escapeHtml(entry.reference)}` : ''}
          ${entry.sourceModule ? ` · ${escapeHtml(sourceInfo(entry.sourceModule).label)}` : ''}
        </p>
        <table>
          <thead><tr><th>Account</th><th>Description</th><th>Debit</th><th>Credit</th></tr></thead>
          <tbody>
            ${lines || '<tr><td colspan="4">No lines</td></tr>'}
            <tr class="total-row">
              <td colspan="2">Entry total</td>
              <td class="amount">${formatPlainAmount(entry.totalDebit)}</td>
              <td class="amount">${formatPlainAmount(entry.totalCredit)}</td>
            </tr>
          </tbody>
        </table>
      </div>`;
  }).join('');

  const totalDebit = entries.reduce((sum, entry) => sum + (entry.totalDebit || 0), 0);
  const totalCredit = entries.reduce((sum, entry) => sum + (entry.totalCredit || 0), 0);

  return `
    <div class="header">
      <h1>Journal</h1>
      <div class="subtitle">${escapeHtml(accountingAmountsLabel())}</div>
      <div class="subtitle">${entries.length} entries · printed ${escapeHtml(new Date().toLocaleString())}</div>
    </div>
    ${blocks || '<p>No journal entries.</p>'}
    <table>
      <tbody>
        <tr class="total-row">
          <td>Total</td>
          <td class="amount">${formatPlainAmount(totalDebit)}</td>
          <td class="amount">${formatPlainAmount(totalCredit)}</td>
        </tr>
      </tbody>
    </table>`;
}

function sourceInfo(sourceModule?: string): { label: string; where: string } {
  const key = sourceModule || '';
  if (key.startsWith('ppe_')) return { label: 'Assets', where: 'PPE & Assets' };
  if (key.startsWith('front_office') || key === 'guest_noshow') return { label: 'Front office', where: 'Front office' };
  if (key === 'restaurant') return { label: 'Restaurant', where: 'Restaurant & Bar' };
  if (key === 'bar') return { label: 'Bar', where: 'Restaurant & Bar' };
  if (key === 'room_service') return { label: 'Room service', where: 'Restaurant & Bar' };
  if (key === 'conference') return { label: 'Events', where: 'Events' };
  if (key === 'payroll') return { label: 'Payroll', where: 'Payroll' };
  if (key === 'bank_reconciliation' || key === 'bank_manual_transaction') return { label: 'Bank', where: 'Bank & Cash' };
  if (key === 'petty_cash') return { label: 'Petty cash', where: 'Bank & Cash' };
  if (key === 'manual_ar_ap' || key === 'manual_ar_ap_wht') return { label: 'Invoices', where: 'Accounts Receivable or Accounts Payable' };
  if (key === 'manual_ar_ap_reversal' || key === 'journal_reversal') return { label: 'Reversal', where: '' };
  if (key === 'pl_period_close') return { label: 'Period close', where: 'Financial Statements' };
  if (!key || key === 'manual') return { label: 'Journal', where: '' };
  const words = key.replace(/_/g, ' ');
  return { label: words.charAt(0).toUpperCase() + words.slice(1), where: '' };
}

function canManageHere(sourceModule?: string) {
  return !sourceModule || sourceModule === 'manual' || sourceModule === 'journal_reversal';
}

function canReverseHere(sourceModule?: string) {
  return canManageHere(sourceModule);
}

function leafAccounts(chart: ChartOfAccounts[]) {
  const templateLevel = new Map(GHANA_CHART_OF_ACCOUNTS.map((row) => [row.code, row.level]));
  const prepared = chart.map((account) => ({
    ...account,
    parentId: null,
    parentAccount: undefined,
    level: templateLevel.get(account.code) ?? Math.max(account.level || 3, 3),
  }));
  const linked = migrateCoaParentIds(prepared);
  const parentIds = new Set(linked.map((account) => account.parentId).filter(Boolean));
  return linked
    .filter((account) => account.isActive && account.code && !parentIds.has(account.id))
    .sort((a, b) => a.code.localeCompare(b.code));
}

type DraftLine = { key: string; accountCode: string; debit: string; credit: string };

function blankLine(): DraftLine {
  return { key: `line-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, accountCode: '', debit: '', credit: '' };
}

export default function JournalRegister() {
  const journalEntries = useAccountingStore((s) => s.journalEntries);
  const chartOfAccounts = useAccountingStore((s) => s.chartOfAccounts);
  const addJournalEntry = useAccountingStore((s) => s.addJournalEntry);
  const updateJournalEntry = useAccountingStore((s) => s.updateJournalEntry);
  const deleteJournalEntry = useAccountingStore((s) => s.deleteJournalEntry);
  const voidJournalEntry = useAccountingStore((s) => s.voidJournalEntry);
  const unvoidJournalEntry = useAccountingStore((s) => s.unvoidJournalEntry);
  const { period: kpiPeriod, todayISO: kpiToday, bounds: kpiBounds } = useAccountingDeskPeriod();
  const [query, setQuery] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [viewEntry, setViewEntry] = useState<JournalEntry | null>(null);
  const [reversePrompt, setReversePrompt] = useState(false);
  const [voidPrompt, setVoidPrompt] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftDate, setDraftDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [draftReference, setDraftReference] = useState('');
  const [draftDescription, setDraftDescription] = useState('');
  const [draftLines, setDraftLines] = useState<DraftLine[]>(() => [blankLine(), blankLine()]);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<JournalSortKey>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const cols = useResizableColumns<JournalSortKey>({
    entry: 110, date: 100, reference: 120, description: 200, source: 120, status: 88, debit: 100, credit: 100,
  });

  // Keep the register date window aligned with Customize → KPI period.
  useEffect(() => {
    if (kpiPeriod === 'all') {
      setFromDate('');
      setToDate('');
      return;
    }
    setFromDate(kpiBounds?.start ?? '');
    setToDate(kpiBounds?.end ?? kpiToday);
  }, [kpiPeriod, kpiBounds, kpiToday]);

  const accountName = useMemo(() => {
    const names = new Map<string, string>();
    for (const account of chartOfAccounts) names.set(account.code, account.name);
    return (code: string) => names.get(code) || code;
  }, [chartOfAccounts]);

  const accounts = useMemo(() => leafAccounts(chartOfAccounts), [chartOfAccounts]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = journalEntries.filter((entry) => {
      const day = dayOf(entry.date);
      if (fromDate && day < fromDate) return false;
      if (toDate && day > toDate) return false;
      if (!q) return true;
      const source = sourceInfo(entry.sourceModule).label;
      const haystack = [entry.entryNumber, entry.reference, entry.description, source, entry.status]
        .concat((entry.lines || []).flatMap((line) => [line.accountCode, accountName(line.accountCode), line.description]))
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
    const value = (entry: JournalEntry): string | number => {
      switch (sortKey) {
        case 'entry': return (entry.entryNumber || '').toLowerCase();
        case 'date': return entry.date || '';
        case 'reference': return (entry.reference || '').toLowerCase();
        case 'description': return (entry.description || '').toLowerCase();
        case 'source': return sourceInfo(entry.sourceModule).label.toLowerCase();
        case 'status': return entry.status;
        case 'debit': return entry.totalDebit || 0;
        case 'credit': return entry.totalCredit || 0;
        default: return '';
      }
    };
    const sorted = [...filtered].sort((a, b) => {
      const av = value(a);
      const bv = value(b);
      if (typeof av === 'number' && typeof bv === 'number') return av - bv;
      return String(av).localeCompare(String(bv));
    });
    return sortDir === 'asc' ? sorted : sorted.reverse();
  }, [journalEntries, query, fromDate, toDate, accountName, sortKey, sortDir]);

  const { page, setPage, pages, paged } = useDeskPagination(rows, [query, fromDate, toDate, sortKey, sortDir]);

  const totals = useMemo(() => {
    const debit = rows.reduce((sum, entry) => sum + (entry.totalDebit || 0), 0);
    const credit = rows.reduce((sum, entry) => sum + (entry.totalCredit || 0), 0);
    return { debit, credit, matched: Math.abs(debit - credit) < 0.01 };
  }, [rows]);

  const onSort = (key: JournalSortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir(key === 'date' || key === 'debit' || key === 'credit' ? 'desc' : 'asc');
    }
  };

  const column = (key: JournalSortKey, label: string, align: 'left' | 'right' | 'center' = 'left') => (
    <TableColumn key={key} className="relative" style={cols.style(key)}>
      <SortLabel active={sortKey === key} dir={sortDir} align={align} onPress={() => onSort(key)}>{label}</SortLabel>
      {cols.sizer(key, label)}
    </TableColumn>
  );

  const printJournal = () => {
    const html = generatePdfHtml('Journal', journalPrintHtml(rows, accountName), 'Journal');
    openPrintPreview(html);
  };

  const exportJournalCSV = () => {
    downloadCSV(
      rows.map((entry) => ({
        entry: entry.entryNumber,
        date: dayOf(entry.date),
        reference: entry.reference || '',
        description: entry.description || '',
        source: sourceInfo(entry.sourceModule).label,
        status: entry.status,
        debit: (entry.totalDebit || 0).toFixed(2),
        credit: (entry.totalCredit || 0).toFixed(2),
      })),
      'journal',
      [
        { key: 'entry', label: 'Entry' },
        { key: 'date', label: 'Date' },
        { key: 'reference', label: 'Reference' },
        { key: 'description', label: 'What for' },
        { key: 'source', label: 'Source' },
        { key: 'status', label: 'Status' },
        { key: 'debit', label: 'Debit' },
        { key: 'credit', label: 'Credit' },
      ],
    );
  };

  const printEntry = (entry: JournalEntry) => {
    const html = generatePdfHtml(
      entry.entryNumber || 'Journal entry',
      journalPrintHtml([entry], accountName),
      entry.entryNumber || 'Journal entry',
    );
    openPrintPreview(html);
  };

  const exportEntryCSV = (entry: JournalEntry) => {
    downloadCSV(
      (entry.lines || []).map((line) => ({
        entry: entry.entryNumber,
        date: dayOf(entry.date),
        account: line.accountCode,
        accountName: accountName(line.accountCode),
        description: line.description || entry.description || '',
        debit: line.debit ? line.debit.toFixed(2) : '',
        credit: line.credit ? line.credit.toFixed(2) : '',
      })),
      `journal_${entry.entryNumber || entry.id}`,
      [
        { key: 'entry', label: 'Entry' },
        { key: 'date', label: 'Date' },
        { key: 'account', label: 'Books account' },
        { key: 'accountName', label: 'Account name' },
        { key: 'description', label: 'Description' },
        { key: 'debit', label: 'Debit' },
        { key: 'credit', label: 'Credit' },
      ],
    );
  };

  const statusColor = (status: JournalEntry['status']) => {
    if (status === 'Posted') return 'success';
    if (status === 'Void') return 'danger';
    if (status === 'Pending Approval') return 'warning';
    return 'default';
  };

  const openComposer = () => {
    setEditingId(null);
    setDraftDate(new Date().toISOString().slice(0, 10));
    setDraftReference('');
    setDraftDescription('');
    setDraftLines([blankLine(), blankLine()]);
    setDraftError(null);
    setComposerOpen(true);
  };

  const openEditEntry = (entry: JournalEntry) => {
    if (!canManageHere(entry.sourceModule)) {
      setActionError(`Posted from ${sourceInfo(entry.sourceModule).where || 'another screen'}. Change it there.`);
      return;
    }
    if (entry.status === 'Void') {
      setActionError('Voided entries cannot be edited.');
      return;
    }
    setEditingId(entry.id);
    setDraftDate(dayOf(entry.date) || new Date().toISOString().slice(0, 10));
    setDraftReference(entry.reference || '');
    setDraftDescription(entry.description || '');
    const lines = (entry.lines || []).map((line) => ({
      key: `line-${line.id}`,
      accountCode: line.accountCode,
      debit: line.debit ? String(line.debit) : '',
      credit: line.credit ? String(line.credit) : '',
    }));
    setDraftLines(lines.length >= 2 ? lines : [...lines, blankLine(), blankLine()].slice(0, Math.max(2, lines.length)));
    setDraftError(null);
    setViewEntry(null);
    setComposerOpen(true);
  };

  const saveDraft = async () => {
    const description = draftDescription.trim();
    if (!draftDate) {
      setDraftError('Choose a date.');
      return;
    }
    if (!description) {
      setDraftError('Say what this entry is for.');
      return;
    }
    const lines: JournalEntryLine[] = [];
    let debit = 0;
    let credit = 0;
    for (const line of draftLines) {
      const lineDebit = line.debit.trim() === '' ? 0 : Number(line.debit);
      const lineCredit = line.credit.trim() === '' ? 0 : Number(line.credit);
      if (!line.accountCode && !lineDebit && !lineCredit) continue;
      if (!line.accountCode) {
        setDraftError('Each amount needs a books account.');
        return;
      }
      if (Number.isNaN(lineDebit) || Number.isNaN(lineCredit) || lineDebit < 0 || lineCredit < 0) {
        setDraftError('Amounts must be numbers.');
        return;
      }
      if (lineDebit > 0 && lineCredit > 0) {
        setDraftError('A line is either a debit or a credit.');
        return;
      }
      if (lineDebit === 0 && lineCredit === 0) {
        setDraftError('Enter an amount on each line you use.');
        return;
      }
      debit += lineDebit;
      credit += lineCredit;
      lines.push({
        id: `JL-${line.key}`,
        journalEntryId: '',
        accountCode: line.accountCode,
        description,
        debit: +lineDebit.toFixed(2),
        credit: +lineCredit.toFixed(2),
        currency: 'GHS',
      });
    }
    debit = +debit.toFixed(2);
    credit = +credit.toFixed(2);
    if (lines.length < 2) {
      setDraftError('An entry needs at least two lines.');
      return;
    }
    if (Math.abs(debit - credit) >= 0.01) {
      setDraftError(`Debits ${formatPlainAmount(debit)} and credits ${formatPlainAmount(credit)} must match.`);
      return;
    }

    const existing = editingId ? journalEntries.find((entry) => entry.id === editingId) : undefined;
    const now = new Date().toISOString();

    if (existing?.status === 'Draft') {
      updateJournalEntry(existing.id, {
        date: draftDate,
        reference: draftReference.trim(),
        description,
        totalDebit: debit,
        totalCredit: credit,
        updatedAt: now,
        lines: lines.map((line) => ({ ...line, journalEntryId: existing.id })),
      });
      setComposerOpen(false);
      setEditingId(null);
      setNotice('Entry updated.');
      return;
    }

    if (existing?.status === 'Posted') {
      await voidJournalEntry(existing.id);
      const err = useAccountingStore.getState().error;
      if (err) {
        setDraftError(err);
        return;
      }
    }

    const id = `JE-MAN-${Date.now()}`;
    addJournalEntry({
      id,
      entryNumber: `JE-${now.slice(0, 4)}-${String(useAccountingStore.getState().journalEntries.length + 1).padStart(4, '0')}`,
      date: draftDate,
      reference: draftReference.trim(),
      description,
      totalDebit: debit,
      totalCredit: credit,
      currency: 'GHS',
      status: 'Posted',
      postedBy: 'current-user',
      postedAt: now,
      createdAt: now,
      updatedAt: now,
      sourceModule: 'manual',
      lines: lines.map((line) => ({ ...line, journalEntryId: id })),
    });
    setComposerOpen(false);
    setEditingId(null);
    setNotice(existing ? 'Entry replaced. The old one is void.' : 'Entry posted.');
  };

  const openEntry = (entry: JournalEntry) => {
    setReversePrompt(false);
    setVoidPrompt(false);
    setActionError(null);
    setViewEntry(entry);
  };

  const reversal = viewEntry ? findJournalReversal(journalEntries, viewEntry.id) : undefined;
  const liveViewEntry = viewEntry
    ? journalEntries.find((entry) => entry.id === viewEntry.id) || viewEntry
    : null;

  const confirmReverse = () => {
    if (!liveViewEntry) return;
    const result = postJournalReversal(liveViewEntry.id, journalEntries, addJournalEntry);
    if (!result.ok) {
      setActionError(result.error);
      return;
    }
    setReversePrompt(false);
    setViewEntry(null);
    setNotice(`Reversed. The opposite entry is ${result.reversal.entryNumber}.`);
  };

  const confirmVoid = async () => {
    if (!liveViewEntry) return;
    await voidJournalEntry(liveViewEntry.id);
    const err = useAccountingStore.getState().error;
    if (err) {
      setActionError(err);
      return;
    }
    setVoidPrompt(false);
    setViewEntry(null);
    setNotice('Entry voided. An opposite entry was posted so the books stay even.');
  };

  const requestVoid = async (entry: JournalEntry) => {
    setActionError(null);
    setReversePrompt(false);
    if (!canManageHere(entry.sourceModule)) {
      const where = sourceInfo(entry.sourceModule).where;
      setActionError(where
        ? `Posted from ${where}. Void or change it on that screen.`
        : 'This entry was posted from another screen. Change it there.');
      return;
    }
    if (entry.status === 'Void') {
      setActionError('This entry is already void.');
      return;
    }
    if (entry.status !== 'Posted') {
      setActionError('Only a posted entry can be voided. Delete a draft instead.');
      return;
    }
    if (findJournalReversal(journalEntries, entry.id)) {
      setActionError('This entry is already reversed.');
      return;
    }
    const ok = await askVoid(entry.entryNumber, 'Void posts the opposite amounts and marks this entry void. The books stay even.');
    if (!ok) return;
    await confirmVoid();
  };

  const requestUnvoid = async (entry: JournalEntry) => {
    setActionError(null);
    setReversePrompt(false);
    setVoidPrompt(false);
    if (!canManageHere(entry.sourceModule)) {
      const where = sourceInfo(entry.sourceModule).where;
      setActionError(where
        ? `Posted from ${where}. Unvoid it on that screen.`
        : 'This entry was posted from another screen. Change it there.');
      return;
    }
    if (entry.status !== 'Void') {
      setActionError('Only a void entry can be restored.');
      return;
    }
    const ok = await askUnvoid(entry.entryNumber, 'The entry counts again. The void is reversed so the books match.');
    if (!ok) return;
    await unvoidJournalEntry(entry.id);
    const err = useAccountingStore.getState().error;
    if (err) {
      setActionError(err);
      return;
    }
    setViewEntry(null);
    setNotice('Entry restored. It counts in the books again.');
  };

  const requestEdit = (entry: JournalEntry) => {
    setActionError(null);
    setVoidPrompt(false);
    setReversePrompt(false);
    openEditEntry(entry);
  };

  const confirmDelete = async () => {
    if (!liveViewEntry) return;
    if (!canManageHere(liveViewEntry.sourceModule)) {
      setActionError(
        sourceInfo(liveViewEntry.sourceModule).where
          ? `Posted from ${sourceInfo(liveViewEntry.sourceModule).where}. Change it on that screen.`
          : 'This entry was posted from another screen. Change it there.',
      );
      return;
    }
    if (liveViewEntry.status === 'Posted') {
      setActionError('Void a posted entry first. Deleting would leave the books wrong.');
      return;
    }
    if (!(await askDelete(liveViewEntry.entryNumber, 'A draft entry will be permanently removed. Posted entries must be voided first.'))) return;
    deleteJournalEntry(liveViewEntry.id);
    setViewEntry(null);
    setNotice('Entry deleted.');
  };

  return (
    <div className="px-3 pt-2 pb-3 md:px-4 md:pt-3 md:pb-4 space-y-3">
      {(notice || actionError) && !viewEntry && (
        <Alert color={actionError ? 'danger' : 'success'} onClose={() => { setNotice(null); setActionError(null); }}>
          {actionError || notice}
        </Alert>
      )}
      <div className="mb-0 flex items-center gap-1.5">
        <h1 className="text-lg md:text-xl font-bold text-gray-800">Journal</h1>
        <HeadingInfo label="About the journal">
          Every posting to the books shows here — from invoices, bank, assets, and entries you type yourself. Reverse a manual entry if you need to undo it.
        </HeadingInfo>
      </div>
      <p className="text-xs text-gray-500 -mt-2">{accountingAmountsLabel()}</p>

      <DeskKpiStrip
        className="mb-1"
        items={[
          { id: 'journal.entries', label: 'Entries', value: String(rows.length), tone: 'text-gray-800' },
          { id: 'journal.debits', label: 'Debits', value: formatPlainAmount(totals.debit), tone: 'text-blue-700' },
          { id: 'journal.credits', label: 'Credits', value: formatPlainAmount(totals.credit), tone: 'text-green-700' },
        ]}
      />
      <p className="text-xs text-gray-600">
        {rows.length > 0 && (totals.matched ? 'Debits and credits match.' : 'Debits and credits do not match.')}
      </p>

      <div className="flex flex-nowrap items-center gap-2 overflow-x-auto">
        <Input aria-label="From date" type="date" size="sm" className="w-36 shrink-0" value={fromDate} onValueChange={setFromDate} />
        <Input aria-label="To date" type="date" size="sm" className="w-36 shrink-0" value={toDate} onValueChange={setToDate} />
        <Input
          size="sm"
          className="w-52 shrink-0"
          placeholder="Search entry, account, source"
          value={query}
          onValueChange={setQuery}
          aria-label="Search journal entries"
        />
        <div className="flex-1 min-w-2" />
        <Button size="sm" variant="bordered" className="shrink-0" onPress={exportJournalCSV}>CSV</Button>
        <Button size="sm" variant="flat" className="shrink-0" onPress={printJournal}>Print</Button>
        <Button size="sm" color="primary" className="shrink-0" onPress={openComposer}>New entry</Button>
      </div>

      <div ref={cols.frameRef} style={cols.frameStyle}>
        <Table
          aria-label="Journal"
          removeWrapper
          classNames={deskResizableTableClassNames()}
        >
          <TableHeader>
            {column('entry', 'Entry')}
            {column('date', 'Date')}
            {column('reference', 'Reference')}
            {column('description', 'What for')}
            {column('source', 'Source')}
            {column('status', 'Status')}
            {column('debit', 'Debit', 'right')}
            {column('credit', 'Credit', 'right')}
          </TableHeader>
          <TableBody emptyContent="No entries for this search.">
            {paged.map((entry) => (
              <TableRow
                key={entry.id}
                className={rowClassNames(viewEntry?.id === entry.id)}
                onClick={() => openEntry(entry)}
              >
                <TableCell className="text-blue-600 hover:underline">{entry.entryNumber}</TableCell>
                <TableCell>{dayOf(entry.date)}</TableCell>
                <TableCell><span className="block truncate" title={entry.reference || undefined}>{entry.reference || '—'}</span></TableCell>
                <TableCell><span className="block truncate" title={entry.description || undefined}>{entry.description || '—'}</span></TableCell>
                <TableCell>{sourceInfo(entry.sourceModule).label}</TableCell>
                <TableCell>
                  <Chip size="sm" variant="flat" color={statusColor(entry.status)}>
                    {entry.status}
                  </Chip>
                </TableCell>
                <TableCell className="text-right tabular-nums">{formatPlainAmount(entry.totalDebit)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatPlainAmount(entry.totalCredit)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-xs text-gray-600 tabular-nums">
          Debit {formatPlainAmount(totals.debit)} · Credit {formatPlainAmount(totals.credit)}
        </p>
        <Pagination page={page} total={pages} onChange={setPage} showControls size="sm" />
      </div>

      <Modal
        isOpen={!!liveViewEntry}
        onOpenChange={(open) => { if (!open) setViewEntry(null); }}
        size="3xl"
        scrollBehavior="inside"
      >
        <ModalContent>
          {(onClose) => {
            if (!liveViewEntry) return null;
            const balanced = Math.abs((liveViewEntry.totalDebit || 0) - (liveViewEntry.totalCredit || 0)) < 0.005;
            const manageable = canManageHere(liveViewEntry.sourceModule);
            const canReverse = manageable && liveViewEntry.status === 'Posted' && !reversal;
            return (
              <>
                <ModalHeader className="border-b bg-white px-6 py-4">
                  <div className="flex justify-between items-start w-full pr-6 gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-xl font-bold text-gray-900">Journal entry</h3>
                        <Chip size="sm" variant="flat" color={statusColor(liveViewEntry.status)}>
                          {liveViewEntry.status}
                        </Chip>
                      </div>
                      <p className="text-lg font-mono text-gray-800">{liveViewEntry.entryNumber}</p>
                      <p className="text-sm text-gray-600">{liveViewEntry.description || '—'}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-gray-500">Totals (must match)</p>
                      <p className="text-lg font-bold tabular-nums">
                        Debit {formatPlainAmount(liveViewEntry.totalDebit)} · Credit {formatPlainAmount(liveViewEntry.totalCredit)}
                      </p>
                      <Chip size="sm" variant="flat" color={balanced ? 'success' : 'danger'} className="mt-1">
                        {balanced ? 'Amounts match' : "Amounts don't match"}
                      </Chip>
                    </div>
                  </div>
                </ModalHeader>
                <ModalBody className="p-6 bg-white space-y-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 text-sm">
                    <div><span className="text-gray-500">Date:</span> <span className="font-medium">{dayOf(liveViewEntry.date)}</span></div>
                    <div><span className="text-gray-500">Reference:</span> <span className="font-mono text-xs">{liveViewEntry.reference || '—'}</span></div>
                    <div><span className="text-gray-500">Source:</span> <span className="font-medium">{sourceInfo(liveViewEntry.sourceModule).label}</span></div>
                    <div><span className="text-gray-500">Posted:</span> <span className="font-medium">{liveViewEntry.postedAt ? new Date(liveViewEntry.postedAt).toLocaleString() : '—'}</span></div>
                  </div>

                  <div>
                    <p className="text-sm font-semibold text-gray-800 mb-1">Lines</p>
                    <p className="text-xs text-gray-500 mb-2">
                      Each line posts to one books account on one side only — debit or credit.
                    </p>
                    <Table aria-label="Journal entry lines" removeWrapper>
                      <TableHeader>
                        <TableColumn>Books account</TableColumn>
                        <TableColumn>Description</TableColumn>
                        <TableColumn align="end">Debit</TableColumn>
                        <TableColumn align="end">Credit</TableColumn>
                      </TableHeader>
                      <TableBody emptyContent="This entry has no lines.">
                        {liveViewEntry.lines?.map((line) => (
                          <TableRow key={line.id}>
                            <TableCell>
                              <span className="font-mono text-xs">{line.accountCode}</span>
                              <span className="block text-sm truncate">{accountName(line.accountCode)}</span>
                            </TableCell>
                            <TableCell>
                              <span className="block truncate text-sm" title={line.description || undefined}>
                                {line.description || '—'}
                              </span>
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-sm">
                              {line.debit ? formatPlainAmount(line.debit) : '—'}
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-sm">
                              {line.credit ? formatPlainAmount(line.credit) : '—'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    <div className="mt-2 flex justify-end gap-6 text-sm font-semibold tabular-nums border-t pt-2">
                      <span>Debit {formatPlainAmount(liveViewEntry.totalDebit)}</span>
                      <span>Credit {formatPlainAmount(liveViewEntry.totalCredit)}</span>
                    </div>
                  </div>
                </ModalBody>
                <ModalFooter className="border-t bg-white flex-col items-stretch gap-3">
                  {actionError && <Alert color="danger" onClose={() => setActionError(null)}>{actionError}</Alert>}
                  {reversal && (
                    <p className="text-sm text-gray-600">Reversed by {reversal.entryNumber} on {dayOf(reversal.date)}.</p>
                  )}
                  {voidPrompt && (
                    <Alert color="warning">
                      Void posts the opposite amounts and marks this entry void. The books stay even.
                    </Alert>
                  )}
                  {reversePrompt && (
                    <Alert color="warning">
                      This posts the opposite amounts today. The original entry stays on the list, and the two together come to zero.
                    </Alert>
                  )}
                  {!manageable && sourceInfo(liveViewEntry.sourceModule).where && (
                    <p className="text-sm text-gray-600">
                      Posted from {sourceInfo(liveViewEntry.sourceModule).where}. Change it on that screen.
                    </p>
                  )}
                  <div className="flex justify-end gap-2 flex-wrap">
                    <Button variant="flat" onPress={onClose}>Close</Button>
                    <Button color="primary" variant="flat" onPress={() => requestEdit(liveViewEntry)}>Edit</Button>
                    {liveViewEntry.status === 'Void' && manageable ? (
                      <Button color="warning" variant="flat" onPress={() => requestUnvoid(liveViewEntry)}>Unvoid</Button>
                    ) : voidPrompt && manageable && liveViewEntry.status === 'Posted' && !reversal ? (
                      <Button color="danger" onPress={confirmVoid}>Confirm void</Button>
                    ) : (
                      <Button color="danger" variant="flat" onPress={() => requestVoid(liveViewEntry)}>Void</Button>
                    )}
                    <Button color="danger" variant="light" onPress={confirmDelete}>Delete</Button>
                    <Button variant="bordered" onPress={() => exportEntryCSV(liveViewEntry)}>CSV</Button>
                    <Button variant="bordered" onPress={() => printEntry(liveViewEntry)}>Print</Button>
                    {canReverse && (
                      reversePrompt ? (
                        <Button color="warning" onPress={confirmReverse}>Confirm reverse</Button>
                      ) : (
                        <Button
                          color="warning"
                          variant="flat"
                          onPress={() => { setActionError(null); setVoidPrompt(false); setReversePrompt(true); }}
                        >
                          Reverse
                        </Button>
                      )
                    )}
                  </div>
                </ModalFooter>
              </>
            );
          }}
        </ModalContent>
      </Modal>

      <Modal
        isOpen={composerOpen}
        onOpenChange={(open) => {
          setComposerOpen(open);
          if (!open) setEditingId(null);
        }}
        size="3xl"
        scrollBehavior="inside"
      >
        <ModalContent>
          {(onClose) => {
            const draftDebit = draftLines.reduce((sum, line) => sum + (line.debit.trim() === '' ? 0 : Number(line.debit) || 0), 0);
            const draftCredit = draftLines.reduce((sum, line) => sum + (line.credit.trim() === '' ? 0 : Number(line.credit) || 0), 0);
            const draftMatched = Math.abs(draftDebit - draftCredit) < 0.005 && draftDebit > 0;
            const editingPosted = editingId
              ? journalEntries.find((entry) => entry.id === editingId)?.status === 'Posted'
              : false;
            return (
            <>
              <ModalHeader className="border-b bg-white px-6 py-4">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">{editingId ? 'Edit entry' : 'New entry'}</h3>
                  <p className="text-sm text-gray-500">
                    {editingPosted
                      ? 'Saving voids the old entry and posts this one in its place.'
                      : 'Put the same total on the debit side and the credit side, then post.'}
                  </p>
                </div>
              </ModalHeader>
              <ModalBody className="p-6 bg-white space-y-5">
                {draftError && <Alert color="danger" onClose={() => setDraftError(null)}>{draftError}</Alert>}

                <div
                  className="grid gap-3 items-end"
                  style={{ gridTemplateColumns: '8.5rem minmax(7rem, 0.9fr) minmax(0, 1.4fr)' }}
                >
                  <Input
                    type="date"
                    label="Date"
                    size="sm"
                    value={draftDate}
                    onValueChange={setDraftDate}
                    isRequired
                    className="w-full"
                    classNames={{ inputWrapper: 'h-10 min-h-10' }}
                  />
                  <Input
                    label="Reference"
                    size="sm"
                    placeholder="Invoice, cheque…"
                    value={draftReference}
                    onValueChange={setDraftReference}
                    className="w-full"
                    classNames={{ inputWrapper: 'h-10 min-h-10' }}
                  />
                  <Input
                    label="What for"
                    size="sm"
                    placeholder="Short plain description"
                    value={draftDescription}
                    onValueChange={setDraftDescription}
                    isRequired
                    className="w-full"
                    classNames={{ inputWrapper: 'h-10 min-h-10' }}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-end justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-gray-800">Lines</p>
                      <p className="text-xs text-gray-500">One books account per line. Fill Debit or Credit — not both.</p>
                    </div>
                    <p className={`text-xs tabular-nums shrink-0 ${draftMatched ? 'text-green-700' : 'text-gray-500'}`}>
                      Debit {formatPlainAmount(draftDebit)} · Credit {formatPlainAmount(draftCredit)}
                      {draftDebit > 0 || draftCredit > 0 ? (draftMatched ? ' · match' : ' · not yet') : ''}
                    </p>
                  </div>

                  <div
                    className="grid gap-2 px-0.5 text-[11px] font-medium uppercase tracking-wide text-gray-400"
                    style={{ gridTemplateColumns: 'minmax(0, 1fr) 7.5rem 7.5rem 2.75rem' }}
                  >
                    <span>Books account</span>
                    <span className="text-right pr-1">Debit</span>
                    <span className="text-right pr-1">Credit</span>
                    <span />
                  </div>

                  <div className="space-y-2">
                    {draftLines.map((line, index) => (
                      <div
                        key={line.key}
                        className="grid gap-2 items-center"
                        style={{ gridTemplateColumns: 'minmax(0, 1fr) 7.5rem 7.5rem 2.75rem' }}
                      >
                        <Select
                          aria-label={`Books account ${index + 1}`}
                          placeholder="Choose books account"
                          size="sm"
                          className="w-full min-w-0"
                          selectedKeys={line.accountCode ? [line.accountCode] : []}
                          onSelectionChange={(keys) => {
                            const code = String(Array.from(keys)[0] || '');
                            setDraftLines((current) => current.map((row) => row.key === line.key ? { ...row, accountCode: code } : row));
                          }}
                          classNames={{ trigger: 'h-10 min-h-10' }}
                        >
                          {accounts.map((account) => (
                            <SelectItem key={account.code}>{`${account.code} ${account.name}`}</SelectItem>
                          ))}
                        </Select>
                        <Input
                          aria-label={`Debit ${index + 1}`}
                          placeholder="0.00"
                          size="sm"
                          type="number"
                          min="0"
                          value={line.debit}
                          onValueChange={(value) => setDraftLines((current) => current.map((row) => row.key === line.key ? { ...row, debit: value, credit: value ? '' : row.credit } : row))}
                          className="w-full"
                          classNames={{ inputWrapper: 'h-10 min-h-10', input: 'text-right tabular-nums' }}
                        />
                        <Input
                          aria-label={`Credit ${index + 1}`}
                          placeholder="0.00"
                          size="sm"
                          type="number"
                          min="0"
                          value={line.credit}
                          onValueChange={(value) => setDraftLines((current) => current.map((row) => row.key === line.key ? { ...row, credit: value, debit: value ? '' : row.debit } : row))}
                          className="w-full"
                          classNames={{ inputWrapper: 'h-10 min-h-10', input: 'text-right tabular-nums' }}
                        />
                        <Button
                          size="sm"
                          variant="light"
                          isIconOnly
                          className="h-10 w-10 min-w-10"
                          aria-label={`Remove line ${index + 1}`}
                          isDisabled={draftLines.length <= 2}
                          onPress={() => setDraftLines((current) => current.filter((row) => row.key !== line.key))}
                        >
                          ×
                        </Button>
                      </div>
                    ))}
                  </div>

                  <Button size="sm" variant="flat" className="w-fit" onPress={() => setDraftLines((current) => [...current, blankLine()])}>
                    Add line
                  </Button>
                </div>
              </ModalBody>
              <ModalFooter className="border-t bg-white">
                <Button variant="flat" onPress={onClose}>Cancel</Button>
                <Button color="primary" onPress={() => { void saveDraft(); }}>
                  {editingId ? (editingPosted ? 'Void & post replacement' : 'Save changes') : 'Post entry'}
                </Button>
              </ModalFooter>
            </>
            );
          }}
        </ModalContent>
      </Modal>
    </div>
  );
}
