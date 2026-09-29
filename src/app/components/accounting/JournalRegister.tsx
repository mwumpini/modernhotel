'use client';

import React, { useMemo, useState } from 'react';
import {
  Button,
  Input,
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
import { accountingAmountsLabel } from '../../lib/accounting/tenantAccountingConfig';
import { generatePdfHtml, openPrintPreview } from '../../lib/accounting/helpers/exportHelpers';
import type { JournalEntry } from '../../lib/accounting/models';
import { SortLabel, deskResizableTableClassNames, rowClassNames, useResizableColumns } from '../frontoffice/columnResize';
import { useDeskPagination } from '../dashboard/deskTableUi';

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
          ${entry.sourceModule ? ` · ${escapeHtml(entry.sourceModule)}` : ''}
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
      <h1>General Journal</h1>
      <div class="subtitle">${escapeHtml(accountingAmountsLabel())}</div>
      <div class="subtitle">${entries.length} entries · printed ${escapeHtml(new Date().toLocaleString())}</div>
    </div>
    ${blocks || '<p>No journal entries.</p>'}
    <table>
      <tbody>
        <tr class="total-row">
          <td>Journal total</td>
          <td class="amount">${formatPlainAmount(totalDebit)}</td>
          <td class="amount">${formatPlainAmount(totalCredit)}</td>
        </tr>
      </tbody>
    </table>`;
}

export default function JournalRegister() {
  const journalEntries = useAccountingStore((s) => s.journalEntries);
  const chartOfAccounts = useAccountingStore((s) => s.chartOfAccounts);
  const [query, setQuery] = useState('');
  const [viewEntry, setViewEntry] = useState<JournalEntry | null>(null);
  const [sortKey, setSortKey] = useState<JournalSortKey>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const cols = useResizableColumns<JournalSortKey>({
    entry: 110, date: 100, reference: 120, description: 200, source: 120, status: 88, debit: 100, credit: 100,
  });

  const accountName = useMemo(() => {
    const names = new Map<string, string>();
    for (const account of chartOfAccounts) names.set(account.code, account.name);
    return (code: string) => names.get(code) || code;
  }, [chartOfAccounts]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = journalEntries.filter((entry) => {
      if (!q) return true;
      return [entry.entryNumber, entry.reference, entry.description, entry.sourceModule, entry.status]
        .some((value) => (value || '').toLowerCase().includes(q));
    });
    const value = (entry: JournalEntry): string | number => {
      switch (sortKey) {
        case 'entry': return (entry.entryNumber || '').toLowerCase();
        case 'date': return entry.date || '';
        case 'reference': return (entry.reference || '').toLowerCase();
        case 'description': return (entry.description || '').toLowerCase();
        case 'source': return (entry.sourceModule || '').toLowerCase();
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
  }, [journalEntries, query, sortKey, sortDir]);

  const { page, setPage, pages, paged } = useDeskPagination(rows, [query, sortKey, sortDir]);

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
    const html = generatePdfHtml('General Journal', journalPrintHtml(rows, accountName), 'General Journal');
    openPrintPreview(html);
  };

  const statusColor = (status: JournalEntry['status']) => {
    if (status === 'Posted') return 'success';
    if (status === 'Void') return 'danger';
    if (status === 'Pending Approval') return 'warning';
    return 'default';
  };

  return (
    <div className="px-3 pt-2 pb-3 md:px-4 md:pt-3 md:pb-4 space-y-3">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h4 className="text-lg md:text-xl font-bold text-gray-800">General journal</h4>
          <p className="text-xs text-gray-500">{accountingAmountsLabel()}</p>
        </div>
        <div className="flex items-center gap-2">
          <Input
            size="sm"
            className="max-w-xs"
            placeholder="Search entry, reference, source"
            value={query}
            onValueChange={setQuery}
            aria-label="Search journal entries"
          />
          <Button size="sm" variant="flat" onPress={printJournal}>Print</Button>
        </div>
      </div>

      <div ref={cols.frameRef} style={cols.frameStyle}>
        <Table
          aria-label="General journal"
          removeWrapper
          classNames={deskResizableTableClassNames()}
        >
          <TableHeader>
            {column('entry', 'Entry')}
            {column('date', 'Date')}
            {column('reference', 'Reference')}
            {column('description', 'Description')}
            {column('source', 'Source')}
            {column('status', 'Status')}
            {column('debit', 'Debit', 'right')}
            {column('credit', 'Credit', 'right')}
          </TableHeader>
          <TableBody emptyContent="No journal entries for this search.">
            {paged.map((entry) => (
              <TableRow
                key={entry.id}
                className={rowClassNames(viewEntry?.id === entry.id)}
                onClick={() => setViewEntry(entry)}
              >
                <TableCell className="text-blue-600 hover:underline">{entry.entryNumber}</TableCell>
                <TableCell>{dayOf(entry.date)}</TableCell>
                <TableCell><span className="block truncate" title={entry.reference || undefined}>{entry.reference || '—'}</span></TableCell>
                <TableCell><span className="block truncate" title={entry.description || undefined}>{entry.description || '—'}</span></TableCell>
                <TableCell>{entry.sourceModule || '—'}</TableCell>
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
      <div className="mt-3 flex justify-end">
        <Pagination page={page} total={pages} onChange={setPage} showControls size="sm" />
      </div>

      <Modal
        isOpen={!!viewEntry}
        onOpenChange={(open) => { if (!open) setViewEntry(null); }}
        size="3xl"
        scrollBehavior="inside"
      >
        <ModalContent>
          {(onClose) => {
            if (!viewEntry) return null;
            const balanced = Math.abs((viewEntry.totalDebit || 0) - (viewEntry.totalCredit || 0)) < 0.005;
            return (
              <>
                <ModalHeader className="border-b bg-white px-6 py-4">
                  <div className="flex justify-between items-start w-full pr-6 gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-xl font-bold text-gray-900">JOURNAL ENTRY</h3>
                        <Chip size="sm" variant="flat" color={statusColor(viewEntry.status)}>
                          {viewEntry.status}
                        </Chip>
                      </div>
                      <p className="text-lg font-mono text-gray-800">{viewEntry.entryNumber}</p>
                      <p className="text-sm text-gray-600">{viewEntry.description || '—'}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-gray-500">Entry totals (must match)</p>
                      <p className="text-lg font-bold tabular-nums">
                        Dr {formatPlainAmount(viewEntry.totalDebit)} · Cr {formatPlainAmount(viewEntry.totalCredit)}
                      </p>
                      <Chip size="sm" variant="flat" color={balanced ? 'success' : 'danger'} className="mt-1">
                        {balanced ? 'Balanced' : 'Out of balance'}
                      </Chip>
                    </div>
                  </div>
                </ModalHeader>
                <ModalBody className="p-6 bg-white space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div><span className="text-gray-500">Date:</span> <span className="font-medium">{dayOf(viewEntry.date)}</span></div>
                    <div><span className="text-gray-500">Reference:</span> <span className="font-mono text-xs">{viewEntry.reference || '—'}</span></div>
                    <div><span className="text-gray-500">Source:</span> <span className="font-medium">{viewEntry.sourceModule || '—'}</span></div>
                    <div><span className="text-gray-500">Posted:</span> <span className="font-medium">{viewEntry.postedAt ? new Date(viewEntry.postedAt).toLocaleString() : '—'}</span></div>
                  </div>

                  <div>
                    <p className="text-sm font-semibold text-gray-800 mb-1">Lines</p>
                    <p className="text-xs text-gray-500 mb-2">
                      Each line posts to one account on one side only — debit or credit.
                    </p>
                    <Table aria-label="Journal entry lines" removeWrapper>
                      <TableHeader>
                        <TableColumn>Account</TableColumn>
                        <TableColumn>Description</TableColumn>
                        <TableColumn align="end">Debit</TableColumn>
                        <TableColumn align="end">Credit</TableColumn>
                      </TableHeader>
                      <TableBody emptyContent="This entry has no lines.">
                        {viewEntry.lines.map((line) => (
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
                      <span>Debit {formatPlainAmount(viewEntry.totalDebit)}</span>
                      <span>Credit {formatPlainAmount(viewEntry.totalCredit)}</span>
                    </div>
                  </div>
                </ModalBody>
                <ModalFooter className="border-t bg-white">
                  <Button variant="flat" onPress={onClose}>Close</Button>
                </ModalFooter>
              </>
            );
          }}
        </ModalContent>
      </Modal>
    </div>
  );
}
