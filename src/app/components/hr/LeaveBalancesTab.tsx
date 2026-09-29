'use client';

import React from 'react';
import { Card, CardBody, CardHeader, Input, Pagination, Select, SelectItem, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow } from '@heroui/react';
import { useLeaveAttendanceStore } from '@/app/lib/hr/leaveAttendanceStore';
import { useEmployeeStore } from '@/app/lib/hr/employeeStore';
import { useSectionExport } from '@/app/lib/export/useSectionExport';
import ExportButtons from '@/app/components/ExportButtons';
import type { LeaveRequest } from '@/app/lib/hr/models';
import type { ExportFormat } from '@/app/lib/frontoffice/reportExportFormat';
import { SortLabel, unifiedTableClassNames, useResizableColumns } from '../frontoffice/columnResize';
import { useDeskPagination } from '../dashboard/deskTableUi';

const TYPES: Array<{ key: LeaveRequest['leaveType']; label: string }> = [
  { key: 'annual', label: 'Annual' },
  { key: 'sick', label: 'Sick' },
  { key: 'personal', label: 'Personal' },
  { key: 'maternity', label: 'Maternity' },
  { key: 'paternity', label: 'Paternity' },
  { key: 'bereavement', label: 'Bereavement' },
];

type BalanceSortKey = 'staff' | 'department' | LeaveRequest['leaveType'] | 'pending';

const defaultWidths: Record<BalanceSortKey, number> = {
  staff: 160,
  department: 140,
  annual: 100,
  sick: 90,
  personal: 100,
  maternity: 110,
  paternity: 110,
  bereavement: 120,
  other: 100,
  pending: 100,
};

/** Days each current staff member has left of every leave type this year. */
export default function LeaveBalancesTab() {
  const requests = useLeaveAttendanceStore((s) => s.leaveRequests);
  const getLeaveBalance = useLeaveAttendanceStore((s) => s.getLeaveBalance);
  const employees = useEmployeeStore((s) => s.employees);
  const departments = useEmployeeStore((s) => s.departments);
  const getDepartment = useEmployeeStore((s) => s.getDepartment);
  const exportSection = useSectionExport();

  const thisYear = new Date().getFullYear();
  const [year, setYear] = React.useState(thisYear);
  const [deptFilter, setDeptFilter] = React.useState('all');
  const [q, setQ] = React.useState('');
  const [sortKey, setSortKey] = React.useState<BalanceSortKey>('staff');
  const [sortDir, setSortDir] = React.useState<'asc' | 'desc'>('asc');
  const cols = useResizableColumns<BalanceSortKey>(defaultWidths);

  const rows = React.useMemo(() => {
    const staff = employees.filter((e) => {
      if (e.status === 'terminated' || e.status === 'inactive') return false;
      if (deptFilter !== 'all' && e.departmentId !== deptFilter) return false;
      const name = `${e.firstName} ${e.lastName}`;
      if (q.trim() && !name.toLowerCase().includes(q.trim().toLowerCase())) return false;
      return true;
    });

    const mapped = staff.map((e) => {
      const balances = Object.fromEntries(TYPES.map((t) => [t.key, getLeaveBalance(e.id, t.key, year)])) as Record<LeaveRequest['leaveType'], ReturnType<typeof getLeaveBalance>>;
      const pending = requests
        .filter((r) => r.employeeId === e.id && r.status === 'pending' && new Date(r.startDate).getUTCFullYear() === year)
        .reduce((sum, r) => sum + (r.totalDays || 0), 0);
      return {
        e,
        name: `${e.firstName} ${e.lastName}`,
        department: getDepartment(e.departmentId)?.name || '—',
        balances,
        pending,
      };
    });

    const value = (r: (typeof mapped)[number]): string | number => {
      if (sortKey === 'staff') return r.name.toLowerCase();
      if (sortKey === 'department') return r.department.toLowerCase();
      if (sortKey === 'pending') return r.pending;
      return r.balances[sortKey as LeaveRequest['leaveType']]?.remaining ?? 0;
    };

    const sorted = [...mapped].sort((a, b) => {
      const av = value(a);
      const bv = value(b);
      if (av < bv) return -1;
      if (av > bv) return 1;
      return 0;
    });
    return sortDir === 'asc' ? sorted : sorted.reverse();
  }, [employees, deptFilter, q, year, requests, getLeaveBalance, getDepartment, sortKey, sortDir]);

  const { page, setPage, pages, paged } = useDeskPagination(rows, [deptFilter, q, year, sortKey, sortDir]);

  const onSort = (key: BalanceSortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const column = (key: BalanceSortKey, label: string, align: 'left' | 'right' | 'center' = 'left') => (
    <TableColumn key={key} className="relative" style={cols.style(key)}>
      <SortLabel active={sortKey === key} dir={sortDir} align={align} onPress={() => onSort(key)}>{label}</SortLabel>
      {cols.sizer(key, label)}
    </TableColumn>
  );

  const download = (format: ExportFormat) =>
    exportSection(format, `Leave Balances ${year}`, {
      title: `Leave Balances ${year}`,
      columns: ['Staff', 'Department', ...TYPES.map((t) => `${t.label} (left / entitled)`), 'Pending days'],
      rows: rows.map((r) => [
        r.name,
        r.department,
        ...TYPES.map((t) => `${r.balances[t.key].remaining} / ${r.balances[t.key].entitlement}`),
        r.pending,
      ]),
    });

  return (
    <Card>
      <CardHeader className="justify-between gap-2 flex-wrap">
        <div className="font-medium">Leave balances</div>
        <div className="flex flex-wrap items-center gap-2">
          <Input size="sm" placeholder="Search staff" value={q} onChange={(e) => setQ(e.target.value)} variant="bordered" className="w-44" />
          <Select
            size="sm"
            aria-label="Department"
            className="w-44"
            variant="bordered"
            selectedKeys={[deptFilter]}
            onSelectionChange={(k) => setDeptFilter(Array.from(k)[0] as string)}
            items={[{ id: 'all', name: 'All departments' }, ...departments.map((d) => ({ id: d.id, name: d.name }))]}
          >
            {(item: any) => <SelectItem key={item.id}>{item.name}</SelectItem>}
          </Select>
          <Select size="sm" aria-label="Year" className="w-28" variant="bordered" selectedKeys={[String(year)]} onSelectionChange={(k) => setYear(Number(Array.from(k)[0]))}>
            {[thisYear - 1, thisYear, thisYear + 1].map((y) => <SelectItem key={String(y)}>{String(y)}</SelectItem>)}
          </Select>
          <ExportButtons onDownload={download} />
        </div>
      </CardHeader>
      <CardBody>
        <div ref={cols.frameRef} style={cols.frameStyle}>
        <Table
          aria-label="leave-balances"
          removeWrapper
          classNames={{
            ...unifiedTableClassNames,
            table: 'table-fixed w-[var(--col-table-width)] min-w-[var(--col-table-width)] max-w-none',
            th: `${unifiedTableClassNames.th} relative`,
            td: `${unifiedTableClassNames.td} overflow-hidden`,
          }}
        >
          <TableHeader>
            {[
              column('staff', 'Staff'),
              column('department', 'Department'),
              ...TYPES.map((t) => column(t.key, t.label, 'center')),
              column('pending', 'Pending', 'center'),
            ]}
          </TableHeader>
          <TableBody emptyContent="No staff match these filters.">
            {paged.map((r) => (
              <TableRow key={r.e.id} className="hover:bg-gray-50">
                {[
                  <TableCell key="staff" className="font-semibold text-ghana-black">
                    <span className="block truncate" title={r.name}>{r.name}</span>
                  </TableCell>,
                  <TableCell key="department">
                    <span className="block truncate" title={r.department}>{r.department}</span>
                  </TableCell>,
                  ...TYPES.map((t) => {
                    const b = r.balances[t.key];
                    return (
                      <TableCell key={t.key} className="text-center tabular-nums">
                        <span className={b.entitlement > 0 && b.remaining === 0 ? 'text-red-600 font-medium' : ''}>{b.remaining}</span>
                        <span className="text-gray-400"> / {b.entitlement}</span>
                      </TableCell>
                    );
                  }),
                  <TableCell key="pending" className="text-center tabular-nums">{r.pending ? `${r.pending}` : '—'}</TableCell>,
                ]}
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </div>
        <div className="mt-3 flex justify-end">
          <Pagination page={page} total={pages} onChange={setPage} showControls size="sm" />
        </div>
        <p className="text-xs text-gray-500 mt-2">Days left / days entitled for {year}. Only approved leave is deducted; pending requests are shown separately.</p>
      </CardBody>
    </Card>
  );
}
