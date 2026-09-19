'use client';

import React from 'react';
import { Card, CardBody, CardHeader, Select, SelectItem, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow } from '@heroui/react';
import { useLeaveAttendanceStore } from '@/app/lib/hr/leaveAttendanceStore';
import { useEmployeeStore } from '@/app/lib/hr/employeeStore';
import { useSectionExport } from '@/app/lib/export/useSectionExport';
import ExportButtons from '@/app/components/ExportButtons';
import type { LeaveRequest } from '@/app/lib/hr/models';
import type { ExportFormat } from '@/app/lib/frontoffice/reportExportFormat';

const TYPES: Array<{ key: LeaveRequest['leaveType']; label: string }> = [
  { key: 'annual', label: 'Annual' },
  { key: 'sick', label: 'Sick' },
  { key: 'personal', label: 'Personal' },
  { key: 'maternity', label: 'Maternity' },
  { key: 'paternity', label: 'Paternity' },
  { key: 'bereavement', label: 'Bereavement' },
];

/** Days each current staff member has left of every leave type this year. */
export default function LeaveBalancesTab() {
  const requests = useLeaveAttendanceStore((s) => s.leaveRequests);
  const getLeaveBalance = useLeaveAttendanceStore((s) => s.getLeaveBalance);
  const employees = useEmployeeStore((s) => s.employees);
  const exportSection = useSectionExport();

  const thisYear = new Date().getFullYear();
  const [year, setYear] = React.useState(thisYear);
  const staff = employees.filter((e) => e.status !== 'terminated' && e.status !== 'inactive');

  const rows = staff.map((e) => {
    const balances = TYPES.map((t) => getLeaveBalance(e.id, t.key, year));
    const pending = requests
      .filter((r) => r.employeeId === e.id && r.status === 'pending' && new Date(r.startDate).getUTCFullYear() === year)
      .reduce((sum, r) => sum + (r.totalDays || 0), 0);
    return { e, name: `${e.firstName} ${e.lastName}`, balances, pending };
  });

  const download = (format: ExportFormat) =>
    exportSection(format, `Leave Balances ${year}`, {
      title: `Leave Balances ${year}`,
      columns: ['Staff', ...TYPES.map((t) => `${t.label} (left / entitled)`), 'Pending days'],
      rows: rows.map((r) => [r.name, ...r.balances.map((b) => `${b.remaining} / ${b.entitlement}`), r.pending]),
    });

  return (
    <Card>
      <CardHeader className="justify-between gap-2 flex-wrap">
        <div className="font-medium">Leave Balances</div>
        <div className="flex items-center gap-2">
          <Select size="sm" aria-label="Year" className="w-28" variant="bordered" selectedKeys={[String(year)]} onSelectionChange={(k) => setYear(Number(Array.from(k)[0]))}>
            {[thisYear - 1, thisYear, thisYear + 1].map((y) => <SelectItem key={String(y)}>{String(y)}</SelectItem>)}
          </Select>
          <ExportButtons onDownload={download} />
        </div>
      </CardHeader>
      <CardBody>
        <Table aria-label="leave-balances" className="overflow-x-auto">
          <TableHeader>
            {[
              <TableColumn key="staff">STAFF</TableColumn>,
              ...TYPES.map((t) => <TableColumn key={t.key}>{t.label.toUpperCase()}</TableColumn>),
              <TableColumn key="pending">PENDING</TableColumn>,
            ]}
          </TableHeader>
          <TableBody emptyContent="No staff yet.">
            {rows.map((r) => (
              <TableRow key={r.e.id}>
                {[
                  <TableCell key="staff" className="font-medium">{r.name}</TableCell>,
                  ...r.balances.map((b, i) => (
                    <TableCell key={TYPES[i].key}>
                      <span className={b.entitlement > 0 && b.remaining === 0 ? 'text-red-600 font-medium' : ''}>{b.remaining}</span>
                      <span className="text-gray-400"> / {b.entitlement}</span>
                    </TableCell>
                  )),
                  <TableCell key="pending">{r.pending ? `${r.pending}d` : '—'}</TableCell>,
                ]}
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <p className="text-xs text-gray-500 mt-2">Days left / days entitled for {year}. Only approved leave is deducted; pending requests are shown separately.</p>
      </CardBody>
    </Card>
  );
}
