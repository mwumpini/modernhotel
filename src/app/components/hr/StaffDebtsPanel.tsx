'use client';

import React from 'react';
import {
  Button, Card, CardBody, CardHeader, Chip, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader,
  Pagination, Select, SelectItem, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow, Textarea,
} from '@heroui/react';
import { useStaffDebtStore, repaymentStartYm } from '@/app/lib/hr/staffDebtStore';
import { useEmployeeStore } from '@/app/lib/hr/employeeStore';
import type { StaffDebt, StaffDebtStatus, StaffDebtType } from '@/app/lib/hr/models';
import { formatGhs, formatMoney } from '@/app/lib/format/currency';
import { printDetailSheet } from '@/app/lib/print/simpleReport';
import { confirmDelete } from '@/app/components/DangerConfirm';
import { SortLabel, deskResizableTableClassNames, rowClassNames, useResizableColumns } from '../frontoffice/columnResize';
import { DetailField, DetailGrid } from '../frontoffice/detailView';
import { useDeskPagination } from '../dashboard/deskTableUi';

type SortKey = 'employee' | 'type' | 'original' | 'outstanding' | 'installment' | 'payments' | 'paid' | 'grace' | 'issued' | 'status';

const TYPE_LABEL: Record<StaffDebtType, string> = { loan: 'Loan', iou: 'IOU', surcharge: 'Surcharge' };
const STATUS_COLOR: Record<StaffDebtStatus, 'success' | 'warning' | 'default'> = {
  active: 'warning',
  cleared: 'success',
  written_off: 'default',
};

function startsLabel(d: Pick<StaffDebt, 'issuedDate' | 'graceMonths'>) {
  const { year, month } = repaymentStartYm(d.issuedDate, d.graceMonths ?? 0);
  return new Date(year, month - 1, 1).toLocaleString('en-GB', { month: 'short', year: 'numeric' });
}

export default function StaffDebtsPanel() {
  const debts = useStaffDebtStore((s) => s.debts);
  const issueDebt = useStaffDebtStore((s) => s.issueDebt);
  const updateDebt = useStaffDebtStore((s) => s.updateDebt);
  const writeOffDebt = useStaffDebtStore((s) => s.writeOffDebt);
  const clearDebt = useStaffDebtStore((s) => s.clearDebt);
  const deleteDebt = useStaffDebtStore((s) => s.deleteDebt);
  const repayments = useStaffDebtStore((s) => s.repayments);
  const employees = useEmployeeStore((s) => s.employees);

  const [q, setQ] = React.useState('');
  const [typeFilter, setTypeFilter] = React.useState<string>('all');
  const [statusFilter, setStatusFilter] = React.useState<string>('active');
  const [sortKey, setSortKey] = React.useState<SortKey>('issued');
  const [sortDir, setSortDir] = React.useState<'asc' | 'desc'>('desc');
  const cols = useResizableColumns<SortKey>({
    employee: 148, type: 88, original: 96, outstanding: 104, installment: 96, payments: 88, paid: 96, grace: 100, issued: 100, status: 96,
  });

  const repaymentStats = React.useMemo(() => {
    const map = new Map<string, { count: number; paid: number }>();
    for (const r of repayments) {
      const cur = map.get(r.debtId) || { count: 0, paid: 0 };
      cur.count += 1;
      cur.paid += Number(r.amount) || 0;
      map.set(r.debtId, cur);
    }
    return map;
  }, [repayments]);

  const statsOf = React.useCallback(
    (debtId: string) => repaymentStats.get(debtId) || { count: 0, paid: 0 },
    [repaymentStats],
  );

  const [issueOpen, setIssueOpen] = React.useState(false);
  const [viewing, setViewing] = React.useState<StaffDebt | null>(null);
  const [form, setForm] = React.useState({
    employeeId: '',
    type: 'loan' as StaffDebtType,
    originalAmount: '',
    monthlyInstallment: '',
    graceMonths: '0',
    reason: '',
    issuedDate: new Date().toISOString().slice(0, 10),
  });

  const nameOf = React.useCallback(
    (id: string) => {
      const e = employees.find((x) => x.id === id);
      return e ? `${e.firstName} ${e.lastName}` : id;
    },
    [employees],
  );

  const filtered = React.useMemo(() => {
    const needle = q.trim().toLowerCase();
    const rows = debts.filter((d) => {
      if (typeFilter !== 'all' && d.type !== typeFilter) return false;
      if (statusFilter !== 'all' && d.status !== statusFilter) return false;
      if (!needle) return true;
      const hay = `${nameOf(d.employeeId)} ${d.type} ${d.reason || ''}`.toLowerCase();
      return hay.includes(needle);
    });
    const value = (d: StaffDebt): string | number => {
      const stats = statsOf(d.id);
      switch (sortKey) {
        case 'employee': return nameOf(d.employeeId).toLowerCase();
        case 'type': return d.type;
        case 'original': return d.originalAmount;
        case 'outstanding': return d.remainingBalance;
        case 'installment': return d.monthlyInstallment;
        case 'payments': return stats.count;
        case 'paid': return stats.paid;
        case 'grace': return Number(d.graceMonths || 0);
        case 'issued': return new Date(d.issuedDate).getTime();
        case 'status': return d.status;
        default: return '';
      }
    };
    const sorted = [...rows].sort((a, b) => {
      const av = value(a);
      const bv = value(b);
      if (typeof av === 'number' && typeof bv === 'number') return av - bv;
      return String(av).localeCompare(String(bv));
    });
    return sortDir === 'asc' ? sorted : sorted.reverse();
  }, [debts, q, typeFilter, statusFilter, sortKey, sortDir, nameOf, statsOf]);

  const { page, setPage, pages, paged } = useDeskPagination(filtered, [q, typeFilter, statusFilter, sortKey, sortDir]);

  const onSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir(key === 'issued' || key === 'outstanding' || key === 'paid' || key === 'payments' ? 'desc' : 'asc');
    }
  };

  const column = (key: SortKey, label: string, align: 'left' | 'right' | 'center' = 'left') => (
    <TableColumn key={key} className="relative" style={cols.style(key)}>
      <SortLabel active={sortKey === key} dir={sortDir} align={align} onPress={() => onSort(key)}>{label}</SortLabel>
      {cols.sizer(key, label)}
    </TableColumn>
  );

  const openIssue = () => {
    setForm({
      employeeId: employees.find((e) => e.status === 'active')?.id || '',
      type: 'loan',
      originalAmount: '',
      monthlyInstallment: '',
      graceMonths: '0',
      reason: '',
      issuedDate: new Date().toISOString().slice(0, 10),
    });
    setIssueOpen(true);
  };

  const saveIssue = () => {
    const amount = Number(form.originalAmount);
    if (!form.employeeId || !(amount > 0)) return;
    const installment = Number(form.monthlyInstallment);
    issueDebt({
      employeeId: form.employeeId,
      type: form.type,
      originalAmount: amount,
      monthlyInstallment: installment > 0 ? installment : amount,
      graceMonths: Math.max(0, Math.floor(Number(form.graceMonths) || 0)),
      reason: form.reason.trim() || undefined,
      issuedDate: new Date(`${form.issuedDate}T00:00:00`),
    });
    setIssueOpen(false);
  };

  const live = viewing ? debts.find((d) => d.id === viewing.id) || viewing : null;
  const debtRepayments = live ? repayments.filter((r) => r.debtId === live.id) : [];

  const activeTotal = debts.filter((d) => d.status === 'active').reduce((s, d) => s + d.remainingBalance, 0);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="justify-between gap-2 flex-wrap">
          <div>
            <div className="font-medium">Staff debts</div>
            <div className="text-xs text-gray-500">Loans, IOUs and surcharges — optional grace before payroll starts deducting; balance drops when that pay is marked paid.</div>
          </div>
          <div className="flex items-center gap-3 text-sm text-gray-600">
            <div>Outstanding: <span className="font-medium tabular-nums">{formatGhs(activeTotal)}</span></div>
            <Button size="sm" color="primary" onPress={openIssue}>+ Issue debt</Button>
          </div>
        </CardHeader>
        <CardBody className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Input size="sm" placeholder="Search staff or reason" value={q} onChange={(e) => setQ(e.target.value)} variant="bordered" className="w-52" />
            <Select size="sm" selectedKeys={[typeFilter]} onSelectionChange={(k) => setTypeFilter(String(Array.from(k)[0] || 'all'))} className="w-36" variant="bordered" aria-label="Type">
              <SelectItem key="all">All types</SelectItem>
              <SelectItem key="loan">Loan</SelectItem>
              <SelectItem key="iou">IOU</SelectItem>
              <SelectItem key="surcharge">Surcharge</SelectItem>
            </Select>
            <Select size="sm" selectedKeys={[statusFilter]} onSelectionChange={(k) => setStatusFilter(String(Array.from(k)[0] || 'all'))} className="w-36" variant="bordered" aria-label="Status">
              <SelectItem key="all">All status</SelectItem>
              <SelectItem key="active">Active</SelectItem>
              <SelectItem key="cleared">Cleared</SelectItem>
              <SelectItem key="written_off">Written off</SelectItem>
            </Select>
          </div>

          <div ref={cols.frameRef} style={cols.frameStyle}>
            <Table aria-label="staff-debts" removeWrapper classNames={deskResizableTableClassNames()}>
              <TableHeader>
                {column('employee', 'Staff')}
                {column('type', 'Type')}
                {column('original', 'Original', 'right')}
                {column('outstanding', 'Outstanding', 'right')}
                {column('installment', 'Monthly', 'right')}
                {column('payments', 'Payments', 'center')}
                {column('paid', 'Paid', 'right')}
                {column('grace', 'Grace')}
                {column('issued', 'Issued')}
                {column('status', 'Status')}
              </TableHeader>
              <TableBody emptyContent="No staff debts match these filters.">
                {paged.map((d) => {
                  const stats = statsOf(d.id);
                  return (
                    <TableRow key={d.id} className={rowClassNames(viewing?.id === d.id)} onClick={() => setViewing(d)}>
                      <TableCell className="font-semibold text-ghana-black">
                        <span className="block truncate" title={nameOf(d.employeeId)}>{nameOf(d.employeeId)}</span>
                      </TableCell>
                      <TableCell>{TYPE_LABEL[d.type]}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatMoney(d.originalAmount)}</TableCell>
                      <TableCell className="text-right tabular-nums font-medium">{formatMoney(d.remainingBalance)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatMoney(d.monthlyInstallment)}</TableCell>
                      <TableCell className="text-center tabular-nums">{stats.count}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatMoney(stats.paid)}</TableCell>
                      <TableCell>
                        {(d.graceMonths || 0) > 0
                          ? <span title={`Repayment from ${startsLabel(d)}`}>{d.graceMonths} mo · {startsLabel(d)}</span>
                          : '—'}
                      </TableCell>
                      <TableCell>{new Date(d.issuedDate).toLocaleDateString('en-GB')}</TableCell>
                      <TableCell>
                        <Chip size="sm" variant="flat" color={STATUS_COLOR[d.status]}>{d.status.replace('_', ' ')}</Chip>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <div className="mt-3 flex justify-end">
            <Pagination page={page} total={pages} onChange={setPage} showControls size="sm" />
          </div>
        </CardBody>
      </Card>

      <Modal isOpen={issueOpen} onOpenChange={setIssueOpen} size="lg">
        <ModalContent>
          {() => (
            <>
              <ModalHeader>Issue staff debt</ModalHeader>
              <ModalBody className="gap-3">
                <Select
                  label="Staff"
                  selectedKeys={form.employeeId ? [form.employeeId] : []}
                  onSelectionChange={(k) => setForm({ ...form, employeeId: String(Array.from(k)[0] || '') })}
                  variant="bordered"
                  items={employees.filter((e) => e.status === 'active').map((e) => ({ id: e.id, name: `${e.firstName} ${e.lastName}` }))}
                >
                  {(item: { id: string; name: string }) => <SelectItem key={item.id}>{item.name}</SelectItem>}
                </Select>
                <Select
                  label="Type"
                  selectedKeys={[form.type]}
                  onSelectionChange={(k) => setForm({ ...form, type: (Array.from(k)[0] as StaffDebtType) || 'loan' })}
                  variant="bordered"
                >
                  <SelectItem key="loan">Loan</SelectItem>
                  <SelectItem key="iou">IOU</SelectItem>
                  <SelectItem key="surcharge">Surcharge</SelectItem>
                </Select>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Input label="Amount (GHS)" type="number" min={0} value={form.originalAmount} onChange={(e) => setForm({ ...form, originalAmount: e.target.value })} variant="bordered" isRequired />
                  <Input
                    label="Monthly installment (GHS)"
                    type="number"
                    min={0}
                    value={form.monthlyInstallment}
                    onChange={(e) => setForm({ ...form, monthlyInstallment: e.target.value })}
                    variant="bordered"
                    description="Leave blank to deduct the full amount in one payroll"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Input label="Issued on" type="date" value={form.issuedDate} onChange={(e) => setForm({ ...form, issuedDate: e.target.value })} variant="bordered" />
                  <Input
                    label="Grace (months)"
                    type="number"
                    min={0}
                    value={form.graceMonths}
                    onChange={(e) => setForm({ ...form, graceMonths: e.target.value })}
                    variant="bordered"
                    description={
                      Number(form.graceMonths) > 0
                        ? `First payroll deduction from ${startsLabel({ issuedDate: new Date(`${form.issuedDate}T00:00:00`), graceMonths: Number(form.graceMonths) || 0 })}`
                        : '0 = deduct from the issue month’s payroll'
                    }
                  />
                </div>
                <Textarea label="Reason" value={form.reason} onValueChange={(v) => setForm({ ...form, reason: v })} variant="bordered" minRows={2} placeholder="e.g. Salary advance for medical costs" />
              </ModalBody>
              <ModalFooter>
                <Button variant="flat" onPress={() => setIssueOpen(false)}>Cancel</Button>
                <Button color="primary" onPress={saveIssue} isDisabled={!form.employeeId || !(Number(form.originalAmount) > 0)}>Issue</Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      <Modal isOpen={!!live} onOpenChange={(open) => !open && setViewing(null)} size="lg" scrollBehavior="inside">
        <ModalContent>
          {() => live && (
            <>
              <ModalHeader>{TYPE_LABEL[live.type]} — {nameOf(live.employeeId)}</ModalHeader>
              <ModalBody className="space-y-4">
                <DetailGrid>
                  <DetailField label="Staff" value={nameOf(live.employeeId)} />
                  <DetailField label="Type" value={TYPE_LABEL[live.type]} />
                  <DetailField label="Original" value={formatGhs(live.originalAmount)} />
                  <DetailField label="Outstanding" value={formatGhs(live.remainingBalance)} />
                  <DetailField label="Payments" value={String(statsOf(live.id).count)} />
                  <DetailField label="Paid" value={formatGhs(statsOf(live.id).paid)} />
                  <DetailField label="Monthly installment" value={formatGhs(live.monthlyInstallment)} />
                  <DetailField
                    label="Grace"
                    value={
                      (live.graceMonths || 0) > 0
                        ? `${live.graceMonths} month${live.graceMonths === 1 ? '' : 's'} · starts ${startsLabel(live)}`
                        : 'None — from issue month'
                    }
                  />
                  <DetailField label="Issued" value={new Date(live.issuedDate).toLocaleDateString('en-GB')} />
                  <DetailField label="Status" value={<Chip size="sm" variant="flat" color={STATUS_COLOR[live.status]}>{live.status.replace('_', ' ')}</Chip>} />
                  <DetailField label="Reason" value={live.reason || '—'} full />
                </DetailGrid>
                {debtRepayments.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Repayments</div>
                    <ul className="text-sm space-y-1">
                      {debtRepayments.map((r) => (
                        <li key={r.id} className="flex justify-between gap-2">
                          <span>{new Date(r.paidAt).toLocaleDateString('en-GB')}</span>
                          <span className="tabular-nums font-medium">{formatGhs(r.amount)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {live.status === 'active' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Input
                      label="Monthly installment"
                      type="number"
                      min={0}
                      size="sm"
                      value={String(live.monthlyInstallment)}
                      onChange={(e) => updateDebt(live.id, { monthlyInstallment: Math.max(0, Number(e.target.value) || 0) })}
                      variant="bordered"
                      description="Applied automatically once grace has ended"
                    />
                    <Input
                      label="Grace (months)"
                      type="number"
                      min={0}
                      size="sm"
                      value={String(live.graceMonths ?? 0)}
                      onChange={(e) => updateDebt(live.id, { graceMonths: Math.max(0, Math.floor(Number(e.target.value) || 0)) })}
                      variant="bordered"
                      description={`First deduction from ${startsLabel(live)}`}
                    />
                  </div>
                )}
              </ModalBody>
              <ModalFooter className="flex flex-wrap justify-between gap-2">
                <Button variant="flat" onPress={() => setViewing(null)}>Close</Button>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="bordered"
                    onPress={() => printDetailSheet(
                      `${TYPE_LABEL[live.type]} — ${nameOf(live.employeeId)}`,
                      [
                        { label: 'Staff', value: nameOf(live.employeeId) },
                        { label: 'Type', value: TYPE_LABEL[live.type] },
                        { label: 'Original', value: formatMoney(live.originalAmount) },
                        { label: 'Outstanding', value: formatMoney(live.remainingBalance) },
                        { label: 'Payments', value: String(statsOf(live.id).count) },
                        { label: 'Paid', value: formatMoney(statsOf(live.id).paid) },
                        { label: 'Monthly installment', value: formatMoney(live.monthlyInstallment) },
                        { label: 'Grace', value: (live.graceMonths || 0) > 0 ? `${live.graceMonths} month(s) · starts ${startsLabel(live)}` : 'None' },
                        { label: 'Issued', value: new Date(live.issuedDate).toLocaleDateString('en-GB') },
                        { label: 'Status', value: live.status.replace('_', ' ') },
                        { label: 'Reason', value: live.reason || '—' },
                      ],
                      'Staff debt',
                    )}
                  >
                    Print
                  </Button>
                  {live.status === 'active' && (
                    <>
                      <Button color="success" variant="flat" onPress={() => { clearDebt(live.id); setViewing(null); }}>Mark cleared</Button>
                      <Button color="warning" variant="flat" onPress={() => { writeOffDebt(live.id); setViewing(null); }}>Write off</Button>
                    </>
                  )}
                  <Button color="danger" variant="flat" onPress={async () => {
                    const ok = await confirmDelete('this staff debt', 'Only a debt that never counted can be removed. This cannot be undone.');
                    if (!ok) return;
                    deleteDebt(live.id);
                    setViewing(null);
                  }}>Delete</Button>
                </div>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}
