'use client';

import React from 'react';
import { Button, Chip, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Pagination, Select, SelectItem, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow } from '@heroui/react';
import { useAccountingStore } from '@/app/lib/accounting/store';
import { useSettingsStore } from '@/app/lib/settings/store';
import { filterFinanceArInvoices, invoiceOpenBalance } from '@/app/lib/accounting/arSubledger';
import {
  GL_DOUBTFUL_DEBTS,
  bandIndexForDays,
  bandLabel,
  computeRequiredAllowance,
  normaliseBands,
  planAllowanceAdjustment,
  planRecovery,
  planWriteOff,
  type LedgerLine,
} from '@/app/lib/accounting/badDebt';
import { PAYMENT_GL_MAP } from '@/app/lib/accounting/glAccounts';
import { formatAccountingCurrency } from '@/app/lib/accounting/tenantAccountingConfig';
import { formatMoney } from '@/app/lib/format/currency';
import { notifyError, notifySuccess } from '@/app/lib/notifications/notify';
import type { Invoice, JournalEntry } from '@/app/lib/accounting/models';
import { SortLabel, deskResizableTableClassNames, useResizableColumns } from '../frontoffice/columnResize';
import { useDeskPagination } from '../dashboard/deskTableUi';

const SOURCE = 'doubtful_debts';
const r2 = (n: number) => Math.round(n * 100) / 100;
const daysPastDue = (inv: Invoice) => Math.max(0, Math.floor((Date.now() - new Date(inv.dueDate || inv.date).getTime()) / 86400000));
const amt = (n: number) => (Math.abs(n) < 0.005 ? '-' : formatAccountingCurrency(n));
const bandTone = (i: number) => ['', 'text-yellow-600', 'text-orange-600', 'text-red-500', 'text-red-700 font-medium'][Math.min(i, 4)];

/** Split a band's allowance across customers in proportion to what they owe, so the column adds up. */
function shareAllowance(opens: number[], allowance: number): number[] {
  if (opens.length === 0) return [];
  const total = opens.reduce((s, n) => s + n, 0);
  if (total <= 0.004 || allowance <= 0.004) return opens.map(() => 0);
  const shares = opens.map(() => 0);
  let used = 0;
  opens.forEach((open, i) => {
    if (i === opens.length - 1) shares[i] = r2(allowance - used);
    else {
      shares[i] = r2(allowance * (open / total));
      used = r2(used + shares[i]);
    }
  });
  return shares;
}

/**
 * Accounts Receivable → Doubtful debts (IFRS 9 simplified approach). The percentages per age band
 * are the business's own (Settings → Operational Policies → Doubtful debts).
 */
export default function DoubtfulDebtsPanel() {
  const invoices = useAccountingStore((s) => s.invoices);
  const journalEntries = useAccountingStore((s) => s.journalEntries);
  const bands = useSettingsStore((s) => s.roomManagement.badDebtBands);

  const open = React.useMemo(
    () => filterFinanceArInvoices(invoices).filter((i) => invoiceOpenBalance(i) > 0.004),
    [invoices],
  );
  const { lines, required, totalOpen } = React.useMemo(
    () => computeRequiredAllowance(open.map((i) => ({ id: i.id, open: invoiceOpenBalance(i), dueDate: i.dueDate, date: i.date })), bands),
    [open, bands],
  );
  const posted = journalEntries.filter((je) => je.status === 'Posted');
  // The allowance account carries a credit balance; this is what is booked today.
  const booked = r2(posted.flatMap((je) => je.lines).filter((l) => l.accountCode === GL_DOUBTFUL_DEBTS).reduce((s, l) => s + (Number(l.credit) || 0) - (Number(l.debit) || 0), 0));
  const adjustment = planAllowanceAdjustment(required, booked);

  // Written off and recovered, read back from their own entries.
  const ours = posted.filter((je) => je.sourceModule === SOURCE);
  const writtenOff = new Map<string, number>();
  const recovered = new Map<string, number>();
  for (const je of ours) {
    const [kind, invoiceId] = String(je.sourceTransactionId || '').split(':');
    if (kind === 'WO') writtenOff.set(invoiceId, r2((writtenOff.get(invoiceId) || 0) + je.totalDebit));
    if (kind === 'REC') recovered.set(invoiceId, r2((recovered.get(invoiceId) || 0) + je.totalDebit));
  }

  const post = (key: string, description: string, reference: string, ledger: LedgerLine[]) => {
    if (ledger.length === 0) return false;
    const now = new Date().toISOString();
    const id = `JE-DD-${Date.now().toString(36)}`;
    const total = r2(ledger.reduce((s, l) => s + l.debit, 0));
    const entry: JournalEntry = {
      id,
      entryNumber: `JE-${new Date().getFullYear()}-DD${Date.now().toString().slice(-6)}`,
      date: now,
      reference,
      description,
      totalDebit: total,
      totalCredit: total,
      currency: 'GHS',
      status: 'Posted',
      postedAt: now,
      createdAt: now,
      updatedAt: now,
      sourceModule: SOURCE,
      sourceTransactionId: key,
      lines: ledger.map((l, i) => ({ id: `${id}-${i}`, journalEntryId: id, accountCode: l.accountCode, description: l.description, debit: l.debit, credit: l.credit, currency: 'GHS' })),
    };
    useAccountingStore.getState().addJournalEntry(entry);
    return useAccountingStore.getState().journalEntries.some((e) => e.id === id);
  };

  const updateAllowance = () => {
    const ok = post(`ADJ:${new Date().toISOString().slice(0, 10)}-${Date.now().toString(36)}`, `Allowance for doubtful debts brought to ${formatMoney(required)}`, 'Doubtful debts', adjustment.lines);
    if (ok) notifySuccess(`Allowance ${adjustment.change > 0 ? 'increased' : 'reduced'} by ${formatMoney(Math.abs(adjustment.change))}.`, 'Doubtful debts');
    else notifyError('The allowance could not be posted. Check the posting date rules and try again.');
  };

  // Write-off and recovery dialogs.
  const [writeOff, setWriteOff] = React.useState<Invoice | null>(null);
  const [reason, setReason] = React.useState('');
  const [recovery, setRecovery] = React.useState<{ invoice: Invoice; max: number } | null>(null);
  const [recAmount, setRecAmount] = React.useState('');
  const [recMethod, setRecMethod] = React.useState('Bank Transfer');

  const confirmWriteOff = () => {
    if (!writeOff) return;
    const amount = invoiceOpenBalance(writeOff);
    const ledger = planWriteOff(amount, booked);
    const ok = post(`WO:${writeOff.id}`, `Written off: ${writeOff.invoiceNumber} — ${reason.trim()}`, writeOff.invoiceNumber, ledger);
    if (!ok) { notifyError('The write-off could not be posted.'); return; }
    useAccountingStore.getState().updateInvoice(writeOff.id, {
      paidAmount: r2((writeOff.paidAmount || 0) + amount),
      status: 'Paid',
      description: `${writeOff.description || ''} (written off: ${reason.trim()})`.trim(),
    } as Partial<Invoice>);
    notifySuccess(`${writeOff.invoiceNumber}: ${formatMoney(amount)} written off.`, 'Doubtful debts');
    setWriteOff(null);
    setReason('');
  };

  const confirmRecovery = () => {
    if (!recovery) return;
    const amount = r2(Math.min(recovery.max, Number(recAmount) || 0));
    const ok = post(`REC:${recovery.invoice.id}:${Date.now().toString(36)}`, `Recovered on written-off ${recovery.invoice.invoiceNumber}`, recovery.invoice.invoiceNumber, planRecovery(amount, PAYMENT_GL_MAP[recMethod] || '1110'));
    if (ok) notifySuccess(`${formatMoney(amount)} recovered on ${recovery.invoice.invoiceNumber}.`, 'Doubtful debts');
    else notifyError('The recovery could not be posted.');
    setRecovery(null);
    setRecAmount('');
  };

  const overdue = open.filter((i) => daysPastDue(i) > 0).sort((a, b) => daysPastDue(b) - daysPastDue(a));
  const writtenOffInvoices = invoices.filter((i) => writtenOff.has(i.id));
  const normalised = React.useMemo(() => normaliseBands(bands), [bands]);
  const bandCols = React.useMemo(
    () => normalised.map((_, i) => ({ key: `b${i}`, label: bandLabel(normalised, i) })),
    [normalised],
  );
  const customers = React.useMemo(() => {
    const buckets = new Map<string, { customerName: string; count: number; open: number; bandOpen: number[] }>();
    for (const inv of open) {
      const customerName = String((inv as { customerName?: string }).customerName || '').trim() || '—';
      const bal = invoiceOpenBalance(inv);
      const idx = bandIndexForDays(daysPastDue(inv), normalised);
      let row = buckets.get(customerName);
      if (!row) {
        row = { customerName, count: 0, open: 0, bandOpen: normalised.map(() => 0) };
        buckets.set(customerName, row);
      }
      row.count += 1;
      row.open = r2(row.open + bal);
      row.bandOpen[idx] = r2((row.bandOpen[idx] || 0) + bal);
    }
    const shares = new Map<string, number[]>();
    for (const row of buckets.values()) shares.set(row.customerName, normalised.map(() => 0));
    normalised.forEach((_, i) => {
      const parts = [...buckets.values()].filter((row) => row.bandOpen[i] > 0.004);
      const split = shareAllowance(parts.map((row) => row.bandOpen[i]), lines[i]?.allowance || 0);
      parts.forEach((row, j) => {
        const arr = shares.get(row.customerName);
        if (arr) arr[i] = split[j] || 0;
      });
    });
    return [...buckets.values()].map((row) => {
      const bandAllowance = shares.get(row.customerName) || normalised.map(() => 0);
      return {
        key: row.customerName,
        customerName: row.customerName,
        count: row.count,
        open: row.open,
        allowance: r2(bandAllowance.reduce((sum, n) => sum + n, 0)),
        bands: bandAllowance,
      };
    });
  }, [open, normalised, lines]);

  const [sortKey, setSortKey] = React.useState('allowance');
  const [sortDir, setSortDir] = React.useState<'asc' | 'desc'>('desc');
  const sortedCustomers = React.useMemo(() => {
    const value = (row: (typeof customers)[number]): string | number => {
      if (sortKey === 'customer') return row.customerName.toLowerCase();
      if (sortKey === 'open') return row.open;
      if (sortKey === 'allowance') return row.allowance;
      const band = bandCols.findIndex((col) => col.key === sortKey);
      return band >= 0 ? row.bands[band] || 0 : 0;
    };
    return [...customers].sort((a, b) => {
      const av = value(a);
      const bv = value(b);
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [customers, sortKey, sortDir, bandCols]);
  const customerPaging = useDeskPagination(sortedCustomers, [sortKey, sortDir, customers.length]);
  const onSort = (key: string) => {
    if (sortKey === key) setSortDir((dir) => (dir === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir(key === 'customer' ? 'asc' : 'desc');
    }
  };
  const colDefaults = React.useMemo(() => {
    const widths: Record<string, number> = { customer: 180, open: 110, allowance: 120 };
    bandCols.forEach((col) => { widths[col.key] = 120; });
    return widths;
  }, [bandCols]);
  const allowCols = useResizableColumns(colDefaults);
  const overdueCols = useResizableColumns({ invoice: 120, customer: 180, days: 120, open: 110, action: 110 });
  const writtenCols = useResizableColumns({ invoice: 120, customer: 180, written: 120, recovered: 120, action: 140 });
  const [view, setView] = React.useState<'allowance' | 'overdue' | 'written'>('allowance');
  React.useEffect(() => {
    if (view === 'written' && writtenOffInvoices.length === 0) setView('allowance');
  }, [view, writtenOffInvoices.length]);
  const viewButton = (key: 'allowance' | 'overdue' | 'written', label: string) => (
    <button
      type="button"
      onClick={() => setView(key)}
      className={`px-3 py-1 text-sm rounded-md transition-colors ${view === key ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-100'}`}
    >
      {label}
    </button>
  );
  const column = (key: string, label: string, align: 'left' | 'right' = 'left') => (
    <TableColumn key={key} className="relative" style={allowCols.style(key)}>
      <SortLabel active={sortKey === key} dir={sortDir} align={align} onPress={() => onSort(key)}>{label}</SortLabel>
      {allowCols.sizer(key, label)}
    </TableColumn>
  );

  return (
    <div>
      <div className="flex flex-nowrap items-center gap-3 overflow-x-auto mb-2">
        <div className="flex rounded-lg border border-gray-200 p-0.5 shrink-0 mr-auto">
          {viewButton('allowance', 'Allowance by age')}
          {viewButton('overdue', overdue.length ? `Overdue invoices (${overdue.length})` : 'Overdue invoices')}
          {writtenOffInvoices.length > 0 && viewButton('written', `Written off (${writtenOffInvoices.length})`)}
        </div>
        {view === 'allowance' && (
          <>
            <span className="text-sm shrink-0 text-gray-600">Booked <strong className="tabular-nums text-gray-900">{formatAccountingCurrency(booked)}</strong></span>
            <span className={`text-sm shrink-0 ${adjustment.lines.length ? 'text-amber-700' : 'text-gray-600'}`}>
              Difference <strong className="tabular-nums">{formatAccountingCurrency(adjustment.change)}</strong>
            </span>
            {adjustment.lines.length > 0 && (
              <Button size="sm" color="primary" className="shrink-0" onPress={updateAllowance}>Post</Button>
            )}
          </>
        )}
      </div>
      {view === 'allowance' && <div ref={allowCols.frameRef} style={allowCols.frameStyle}>
        <Table removeWrapper classNames={deskResizableTableClassNames()} aria-label="Allowance by customer and age">
          <TableHeader>
            {[
              column('customer', 'Customer'),
              column('open', 'Open', 'right'),
              column('allowance', 'Allowance', 'right'),
              ...bandCols.map((col) => column(col.key, col.label, 'right')),
            ]}
          </TableHeader>
          <TableBody emptyContent="No open invoices.">
            {[
              ...customerPaging.paged.map((row) => (
                <TableRow key={row.key}>
                  {[
                    <TableCell key="customer">
                      <div className="font-medium">{row.customerName}</div>
                      <div className="text-xs text-gray-500">{row.count} {row.count === 1 ? 'invoice' : 'invoices'}</div>
                    </TableCell>,
                    <TableCell key="open" className="tabular-nums text-right">{amt(row.open)}</TableCell>,
                    <TableCell key="allowance" className="tabular-nums text-right font-bold">{amt(row.allowance)}</TableCell>,
                    ...row.bands.map((value, i) => (
                      <TableCell key={bandCols[i].key} className={`tabular-nums text-right ${value > 0.004 ? bandTone(i) : ''}`}>{amt(value)}</TableCell>
                    )),
                  ]}
                </TableRow>
              )),
              ...(customers.length > 0 ? [
                <TableRow key="total" className="font-semibold">
                  {[
                    <TableCell key="customer">
                      <div>Total</div>
                      <div className="text-xs font-normal text-gray-500">{open.length} {open.length === 1 ? 'invoice' : 'invoices'}</div>
                    </TableCell>,
                    <TableCell key="open" className="tabular-nums text-right">{amt(totalOpen)}</TableCell>,
                    <TableCell key="allowance" className="tabular-nums text-right">{amt(required)}</TableCell>,
                    ...lines.map((line, i) => (
                      <TableCell key={bandCols[i]?.key || i} className={`tabular-nums text-right ${line.allowance > 0.004 ? bandTone(i) : ''}`}>{amt(line.allowance)}</TableCell>
                    )),
                  ]}
                </TableRow>,
              ] : []),
            ]}
          </TableBody>
        </Table>
      </div>}
      {view === 'allowance' && customerPaging.pages > 1 && (
        <div className="mt-3 flex justify-end">
          <Pagination page={customerPaging.page} total={customerPaging.pages} onChange={customerPaging.setPage} showControls size="sm" />
        </div>
      )}

      {view === 'overdue' && <div ref={overdueCols.frameRef} style={overdueCols.frameStyle}>
        <Table removeWrapper classNames={deskResizableTableClassNames()} aria-label="Overdue invoices">
          <TableHeader>
            <TableColumn className="relative" style={overdueCols.style('invoice')}>Invoice{overdueCols.sizer('invoice', 'Invoice')}</TableColumn>
            <TableColumn className="relative" style={overdueCols.style('customer')}>Customer{overdueCols.sizer('customer', 'Customer')}</TableColumn>
            <TableColumn className="relative text-right" style={overdueCols.style('days')}>Days past due{overdueCols.sizer('days', 'Days past due')}</TableColumn>
            <TableColumn className="relative text-right" style={overdueCols.style('open')}>Open{overdueCols.sizer('open', 'Open')}</TableColumn>
            <TableColumn className="relative" style={overdueCols.style('action')}>{overdueCols.sizer('action', 'Action')}</TableColumn>
          </TableHeader>
          <TableBody emptyContent="Nothing is overdue.">
            {overdue.map((inv) => (
              <TableRow key={inv.id}>
                <TableCell className="font-mono text-sm">{inv.invoiceNumber}</TableCell>
                <TableCell>{(inv as { customerName?: string }).customerName || '—'}</TableCell>
                <TableCell className="text-right tabular-nums">{daysPastDue(inv)}</TableCell>
                <TableCell className="text-right tabular-nums font-medium">{amt(invoiceOpenBalance(inv))}</TableCell>
                <TableCell><Button size="sm" variant="flat" color="danger" onPress={() => { setWriteOff(inv); setReason(''); }}>Write off</Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>}

      {view === 'written' && writtenOffInvoices.length > 0 && (
          <div ref={writtenCols.frameRef} style={writtenCols.frameStyle}>
            <Table removeWrapper classNames={deskResizableTableClassNames()} aria-label="Written-off invoices">
              <TableHeader>
                <TableColumn className="relative" style={writtenCols.style('invoice')}>Invoice{writtenCols.sizer('invoice', 'Invoice')}</TableColumn>
                <TableColumn className="relative" style={writtenCols.style('customer')}>Customer{writtenCols.sizer('customer', 'Customer')}</TableColumn>
                <TableColumn className="relative text-right" style={writtenCols.style('written')}>Written off{writtenCols.sizer('written', 'Written off')}</TableColumn>
                <TableColumn className="relative text-right" style={writtenCols.style('recovered')}>Recovered{writtenCols.sizer('recovered', 'Recovered')}</TableColumn>
                <TableColumn className="relative" style={writtenCols.style('action')}>{writtenCols.sizer('action', 'Action')}</TableColumn>
              </TableHeader>
              <TableBody>
                {writtenOffInvoices.map((inv) => {
                  const off = writtenOff.get(inv.id) || 0;
                  const back = recovered.get(inv.id) || 0;
                  return (
                    <TableRow key={inv.id}>
                      <TableCell className="font-mono text-sm">{inv.invoiceNumber}</TableCell>
                      <TableCell>{(inv as { customerName?: string }).customerName || '—'}</TableCell>
                      <TableCell className="text-right tabular-nums">{amt(off)}</TableCell>
                      <TableCell className="text-right tabular-nums">{back > 0 ? amt(back) : '—'}</TableCell>
                      <TableCell>
                        {back < off - 0.004 ? (
                          <Button size="sm" variant="flat" onPress={() => { setRecovery({ invoice: inv, max: r2(off - back) }); setRecAmount(String(r2(off - back))); }}>Record recovery</Button>
                        ) : <Chip size="sm" variant="flat" color="success">Recovered</Chip>}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
      )}

      <Modal isOpen={!!writeOff} onOpenChange={(o) => { if (!o) setWriteOff(null); }}>
        <ModalContent>
          <ModalHeader>Write off {writeOff?.invoiceNumber}</ModalHeader>
          <ModalBody className="space-y-2">
            <p className="text-sm">
              {formatMoney(writeOff ? invoiceOpenBalance(writeOff) : 0)} owed by {(writeOff as { customerName?: string } | null)?.customerName || 'the customer'} will be removed from receivables.
              {writeOff && invoiceOpenBalance(writeOff) > booked + 0.004
                ? ` The allowance covers ${formatMoney(Math.max(0, booked))}; the rest is a bad-debt expense.`
                : ' The allowance covers it.'}
            </p>
            <Input isRequired label="Reason" placeholder="e.g. Company closed, no assets" value={reason} onChange={(e) => setReason(e.target.value)} variant="bordered" />
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={() => setWriteOff(null)}>Cancel</Button>
            <Button color="danger" isDisabled={!reason.trim()} onPress={confirmWriteOff}>Write off</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={!!recovery} onOpenChange={(o) => { if (!o) setRecovery(null); }}>
        <ModalContent>
          <ModalHeader>Money received on {recovery?.invoice.invoiceNumber}</ModalHeader>
          <ModalBody className="space-y-2">
            <Input type="number" label="Amount received" value={recAmount} onChange={(e) => setRecAmount(e.target.value)} variant="bordered" description={`Up to ${formatMoney(recovery?.max || 0)}`} />
            <Select disallowEmptySelection label="Received by" selectedKeys={[recMethod]} onSelectionChange={(k) => setRecMethod(String(Array.from(k)[0]))} variant="bordered">
              {['Cash', 'Bank Transfer', 'Mobile Money', 'Card', 'Cheque'].map((m) => <SelectItem key={m}>{m}</SelectItem>)}
            </Select>
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={() => setRecovery(null)}>Cancel</Button>
            <Button color="primary" isDisabled={!(Number(recAmount) > 0)} onPress={confirmRecovery}>Record</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
