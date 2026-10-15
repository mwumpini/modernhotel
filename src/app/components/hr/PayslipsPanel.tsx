'use client';

import React from 'react';
import { Button, Card, CardBody, CardHeader, Chip, Input, Select, SelectItem, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow } from '@heroui/react';
import { usePayrollStore, payrollRecordLabels } from '@/app/lib/hr/payrollStore';
import { useEmployeeStore } from '@/app/lib/hr/employeeStore';
import { buildPayslipData, payslipMonth, printPayslips, type DeductionLabels } from '@/app/lib/payroll/payslip';
import { formatMoney } from '@/app/lib/format/currency';
import { notifyError } from '@/app/lib/notifications/notify';

/**
 * Payslips for a prepared payroll month, printed with the payslip design chosen in
 * Settings → Document Templates → Payslip. One at a time or the whole month, one per page.
 */
export default function PayslipsPanel({ labels }: { labels: DeductionLabels }) {
  const periods = usePayrollStore((s) => s.payrollPeriods);
  const records = usePayrollStore((s) => s.payrollRecords);
  const getEmployee = useEmployeeStore((s) => s.getEmployee);

  const months = React.useMemo(
    () => [...periods]
      .filter((p) => records.some((r) => r.payrollPeriodId === p.id))
      .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()),
    [periods, records],
  );
  const [periodId, setPeriodId] = React.useState('');
  const [q, setQ] = React.useState('');
  // Ticked staff for "Print selected"; cleared when the month changes.
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  React.useEffect(() => { setSelected(new Set()); }, [periodId]);
  React.useEffect(() => {
    if (!months.some((m) => m.id === periodId) && months[0]) setPeriodId(months[0].id);
  }, [months, periodId]);

  const period = months.find((m) => m.id === periodId);
  const rows = records
    .filter((r) => r.payrollPeriodId === periodId)
    .filter((r) => !q || `${r.employeeName} ${r.employeeNumber}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => a.employeeName.localeCompare(b.employeeName));

  const chosen = rows.filter((r) => selected.has(r.id));

  const print = (list: typeof rows) => {
    const slips = list.map((record) => buildPayslipData({ record, period, employee: getEmployee(record.employeeId), labels }));
    if (!printPayslips(slips)) notifyError('The payslips could not be opened for printing. Try again.');
  };

  const statusChip = (status: string) => {
    const map: Record<string, { label: string; color: 'success' | 'warning' | 'default' | 'danger' }> = {
      paid: { label: 'Paid', color: 'success' },
      processed: { label: 'Prepared', color: 'warning' },
      pending: { label: 'Pending', color: 'default' },
      failed: { label: 'Failed', color: 'danger' },
    };
    const s = map[status] || { label: status, color: 'default' as const };
    return <Chip size="sm" variant="flat" color={s.color}>{s.label}</Chip>;
  };

  return (
    <Card className="shadow-sm">
      <CardHeader className="px-3 py-2 flex items-center gap-3 flex-wrap">
        <div className="text-sm font-semibold text-gray-800">Payslips</div>
        {months.length > 0 && (
          <Select
            disallowEmptySelection
            size="sm"
            aria-label="Payroll month"
            className="w-56"
            variant="bordered"
            selectedKeys={periodId ? [periodId] : []}
            onSelectionChange={(k) => setPeriodId(String(Array.from(k)[0] || ''))}
          >
            {months.map((m) => <SelectItem key={m.id}>{payslipMonth(m)}</SelectItem>)}
          </Select>
        )}
        <div className="ml-auto flex items-center gap-2">
          <Input size="sm" variant="bordered" className="w-52" placeholder="Search name or staff no." value={q} onChange={(e) => setQ(e.target.value)} />
          <Button size="sm" variant="flat" isDisabled={chosen.length === 0} onPress={() => print(chosen)}>
            Print selected{chosen.length ? ` (${chosen.length})` : ''}
          </Button>
          <Button size="sm" color="primary" isDisabled={rows.length === 0} onPress={() => print(rows)}>
            Print all payslips{rows.length ? ` (${rows.length})` : ''}
          </Button>
        </div>
      </CardHeader>
      <CardBody className="space-y-2">
        {months.length === 0 ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            No prepared payroll yet. Prepare a month on Staff Payroll; its payslips appear here.
          </div>
        ) : (
          <>
            <p className="text-xs text-gray-500">
              Printed with the payslip design set in Settings → Document Templates → Payslip.
            </p>
            <Table
              aria-label="Payslips"
              removeWrapper
              isCompact
              selectionMode="multiple"
              selectionBehavior="toggle"
              selectedKeys={selected}
              onSelectionChange={(keys) => setSelected(keys === 'all' ? new Set(rows.map((r) => r.id)) : new Set(Array.from(keys).map(String)))}
            >
              <TableHeader>
                <TableColumn>Staff No.</TableColumn>
                <TableColumn>Name</TableColumn>
                <TableColumn>Department</TableColumn>
                <TableColumn className="text-right">Gross pay</TableColumn>
                <TableColumn className="text-right">Deductions</TableColumn>
                <TableColumn className="text-right">Net pay</TableColumn>
                <TableColumn>Status</TableColumn>
                <TableColumn>Payslip</TableColumn>
              </TableHeader>
              <TableBody emptyContent="No staff match this search.">
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-gray-600">{r.employeeNumber}</TableCell>
                    <TableCell className="font-semibold">{r.employeeName}</TableCell>
                    <TableCell>{payrollRecordLabels(r).department}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(r.grossPay)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(Number(r.grossPay || 0) - Number(r.netPay || 0))}</TableCell>
                    <TableCell className="text-right tabular-nums font-semibold">{formatMoney(r.netPay)}</TableCell>
                    <TableCell>{statusChip(r.status)}</TableCell>
                    <TableCell>
                      <Button size="sm" variant="flat" onPress={() => print([r])}>Print</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>
        )}
      </CardBody>
    </Card>
  );
}
