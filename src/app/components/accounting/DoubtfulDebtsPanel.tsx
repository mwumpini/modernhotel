'use client';

import React from 'react';
import { Button, Card, CardBody, Chip, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Select, SelectItem, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow } from '@heroui/react';
import { useAccountingStore } from '@/app/lib/accounting/store';
import { useSettingsStore } from '@/app/lib/settings/store';
import { filterFinanceArInvoices, invoiceOpenBalance } from '@/app/lib/accounting/arSubledger';
import {
  GL_DOUBTFUL_DEBTS,
  computeRequiredAllowance,
  planAllowanceAdjustment,
  planRecovery,
  planWriteOff,
  type LedgerLine,
} from '@/app/lib/accounting/badDebt';
import { PAYMENT_GL_MAP } from '@/app/lib/accounting/glAccounts';
import { formatMoney } from '@/app/lib/format/currency';
import { notifyError, notifySuccess } from '@/app/lib/notifications/notify';
import type { Invoice, JournalEntry } from '@/app/lib/accounting/models';

const SOURCE = 'doubtful_debts';
const r2 = (n: number) => Math.round(n * 100) / 100;
const daysPastDue = (inv: Invoice) => Math.max(0, Math.floor((Date.now() - new Date(inv.dueDate || inv.date).getTime()) / 86400000));

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

  return (
    <div className="space-y-3">
      <Card className="shadow-none border">
        <CardBody className="space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-gray-800">Allowance for doubtful debts</h3>
              <p className="text-xs text-gray-500">The share of what customers owe that may not be paid, by age (IFRS 9). Percentages are set in Settings → Operational Policies → Doubtful debts.</p>
            </div>
            <Button size="sm" color="primary" isDisabled={adjustment.lines.length === 0} onPress={updateAllowance}>
              {adjustment.lines.length === 0 ? 'Allowance is up to date' : `${adjustment.change > 0 ? 'Increase' : 'Reduce'} allowance by ${formatMoney(Math.abs(adjustment.change))}`}
            </Button>
          </div>
          <Table aria-label="Allowance by age" removeWrapper isCompact>
            <TableHeader>
              <TableColumn>Days past due</TableColumn>
              <TableColumn className="text-right">Invoices</TableColumn>
              <TableColumn className="text-right">Open balance</TableColumn>
              <TableColumn className="text-right">Allowance %</TableColumn>
              <TableColumn className="text-right">Allowance</TableColumn>
            </TableHeader>
            <TableBody>
              {[
                ...lines.map((l) => (
                  <TableRow key={l.label}>
                    <TableCell>{l.label}</TableCell>
                    <TableCell className="text-right tabular-nums">{l.count}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(l.balance)}</TableCell>
                    <TableCell className="text-right tabular-nums">{l.percent}%</TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(l.allowance)}</TableCell>
                  </TableRow>
                )),
                <TableRow key="total" className="font-semibold">
                  <TableCell>Total</TableCell>
                  <TableCell className="text-right tabular-nums">{open.length}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatMoney(totalOpen)}</TableCell>
                  <TableCell> </TableCell>
                  <TableCell className="text-right tabular-nums">{formatMoney(required)}</TableCell>
                </TableRow>,
              ]}
            </TableBody>
          </Table>
          <div className="flex flex-wrap gap-4 text-sm">
            <span>Required: <strong className="tabular-nums">{formatMoney(required)}</strong></span>
            <span>Booked (account {GL_DOUBTFUL_DEBTS}): <strong className="tabular-nums">{formatMoney(booked)}</strong></span>
            <span>Difference: <strong className={`tabular-nums ${adjustment.lines.length ? 'text-amber-700' : 'text-emerald-700'}`}>{formatMoney(adjustment.change)}</strong></span>
          </div>
        </CardBody>
      </Card>

      <Card className="shadow-none border">
        <CardBody className="space-y-2">
          <h3 className="text-sm font-semibold text-gray-800">Overdue invoices</h3>
          <p className="text-xs text-gray-500">Write off only a debt that will not be paid. It comes out of the allowance first; anything beyond it is a bad-debt expense.</p>
          <Table aria-label="Overdue invoices" removeWrapper isCompact>
            <TableHeader>
              <TableColumn>Invoice</TableColumn>
              <TableColumn>Customer</TableColumn>
              <TableColumn className="text-right">Days past due</TableColumn>
              <TableColumn className="text-right">Open</TableColumn>
              <TableColumn> </TableColumn>
            </TableHeader>
            <TableBody emptyContent="Nothing is overdue.">
              {overdue.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell>{inv.invoiceNumber}</TableCell>
                  <TableCell>{(inv as { customerName?: string }).customerName || '—'}</TableCell>
                  <TableCell className="text-right tabular-nums">{daysPastDue(inv)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatMoney(invoiceOpenBalance(inv))}</TableCell>
                  <TableCell><Button size="sm" variant="flat" color="danger" onPress={() => { setWriteOff(inv); setReason(''); }}>Write off</Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardBody>
      </Card>

      {writtenOffInvoices.length > 0 && (
        <Card className="shadow-none border">
          <CardBody className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-800">Written off</h3>
            <Table aria-label="Written-off invoices" removeWrapper isCompact>
              <TableHeader>
                <TableColumn>Invoice</TableColumn>
                <TableColumn>Customer</TableColumn>
                <TableColumn className="text-right">Written off</TableColumn>
                <TableColumn className="text-right">Recovered</TableColumn>
                <TableColumn> </TableColumn>
              </TableHeader>
              <TableBody>
                {writtenOffInvoices.map((inv) => {
                  const off = writtenOff.get(inv.id) || 0;
                  const back = recovered.get(inv.id) || 0;
                  return (
                    <TableRow key={inv.id}>
                      <TableCell>{inv.invoiceNumber}</TableCell>
                      <TableCell>{(inv as { customerName?: string }).customerName || '—'}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatMoney(off)}</TableCell>
                      <TableCell className="text-right tabular-nums">{back > 0 ? formatMoney(back) : '—'}</TableCell>
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
          </CardBody>
        </Card>
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
