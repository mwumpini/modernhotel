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
} from '@heroui/react';
import { useAccountingStore } from '../../lib/accounting/store';
import { accountingAmountsLabel } from '../../lib/accounting/tenantAccountingConfig';
import { generatePdfHtml, openPrintPreview } from '../../lib/accounting/helpers/exportHelpers';
import type { JournalEntry } from '../../lib/accounting/models';

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
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const accountName = useMemo(() => {
    const names = new Map<string, string>();
    for (const account of chartOfAccounts) names.set(account.code, account.name);
    return (code: string) => names.get(code) || code;
  }, [chartOfAccounts]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...journalEntries]
      .filter((entry) => {
        if (!q) return true;
        return [entry.entryNumber, entry.reference, entry.description, entry.sourceModule, entry.status]
          .some((value) => (value || '').toLowerCase().includes(q));
      })
      .sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.entryNumber || '').localeCompare(a.entryNumber || ''));
  }, [journalEntries, query]);

  const selected = rows.find((entry) => entry.id === selectedId) ?? null;

  const printJournal = () => {
    const html = generatePdfHtml('General Journal', journalPrintHtml(rows, accountName), 'General Journal');
    openPrintPreview(html);
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h4 className="text-lg font-semibold text-ghana-black">General journal</h4>
          <p className="text-xs text-gray-500">{accountingAmountsLabel()}</p>
          <p className="text-sm text-gray-500">
            Entries from folios, invoices, payables, bank, payroll, tax, and period close. Posted entries are the ones the statements use.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Input
            className="max-w-xs"
            placeholder="Search entry, reference, source"
            value={query}
            onValueChange={setQuery}
            aria-label="Search journal entries"
          />
          <Button variant="flat" onPress={printJournal}>Print</Button>
        </div>
      </div>

      <Table
        aria-label="General journal"
        selectionMode="single"
        selectedKeys={selected ? new Set([selected.id]) : new Set()}
        onSelectionChange={(keys) => {
          if (keys === 'all') return;
          const id = [...keys][0];
          setSelectedId(id ? String(id) : null);
        }}
      >
        <TableHeader>
          <TableColumn>Entry</TableColumn>
          <TableColumn>Date</TableColumn>
          <TableColumn>Reference</TableColumn>
          <TableColumn>Description</TableColumn>
          <TableColumn>Source</TableColumn>
          <TableColumn>Status</TableColumn>
          <TableColumn className="text-right">Debit</TableColumn>
          <TableColumn className="text-right">Credit</TableColumn>
        </TableHeader>
        <TableBody emptyContent="No journal entries for this search.">
          {rows.map((entry) => (
            <TableRow key={entry.id}>
              <TableCell>{entry.entryNumber}</TableCell>
              <TableCell>{dayOf(entry.date)}</TableCell>
              <TableCell>{entry.reference || '—'}</TableCell>
              <TableCell>{entry.description || '—'}</TableCell>
              <TableCell>{entry.sourceModule || '—'}</TableCell>
              <TableCell>
                <Chip size="sm" variant="flat" color={entry.status === 'Posted' ? 'success' : 'default'}>
                  {entry.status}
                </Chip>
              </TableCell>
              <TableCell className="text-right font-mono">{formatPlainAmount(entry.totalDebit)}</TableCell>
              <TableCell className="text-right font-mono">{formatPlainAmount(entry.totalCredit)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {selected && (
        <div className="space-y-2">
          <h5 className="text-sm font-semibold text-ghana-black">
            {selected.entryNumber} — {selected.description || 'Lines'}
          </h5>
          <Table aria-label="Journal lines">
            <TableHeader>
              <TableColumn>Account</TableColumn>
              <TableColumn>Description</TableColumn>
              <TableColumn className="text-right">Debit</TableColumn>
              <TableColumn className="text-right">Credit</TableColumn>
            </TableHeader>
            <TableBody emptyContent="This entry has no lines.">
              {selected.lines.map((line) => (
                <TableRow key={line.id}>
                  <TableCell>{line.accountCode} {accountName(line.accountCode)}</TableCell>
                  <TableCell>{line.description || '—'}</TableCell>
                  <TableCell className="text-right font-mono">{line.debit ? formatPlainAmount(line.debit) : '—'}</TableCell>
                  <TableCell className="text-right font-mono">{line.credit ? formatPlainAmount(line.credit) : '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
