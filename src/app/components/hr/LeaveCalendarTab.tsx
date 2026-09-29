'use client';

import React from 'react';
import { Button, Card, CardBody, CardHeader, Chip, Input, Select, SelectItem, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Pagination } from '@heroui/react';
import { useLeaveAttendanceStore } from '@/app/lib/hr/leaveAttendanceStore';
import { useEmployeeStore } from '@/app/lib/hr/employeeStore';
import { leaveOn, todayKey } from '@/app/lib/hr/leaveDates';
import type { LeaveRequest } from '@/app/lib/hr/models';
import { printDetailSheet } from '@/app/lib/print/simpleReport';
import { SortLabel, unifiedTableClassNames, rowClassNames, useResizableColumns } from '../frontoffice/columnResize';
import { DetailGrid, DetailField } from '../frontoffice/detailView';
import { useDeskPagination } from '../dashboard/deskTableUi';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MAX_NAMES = 3;

type OffSortKey = 'date' | 'employee' | 'department' | 'type' | 'status' | 'days';

const defaultWidths: Record<OffSortKey, number> = {
  date: 120,
  employee: 160,
  department: 140,
  type: 110,
  status: 110,
  days: 80,
};

type OffRow = {
  id: string;
  date: string;
  employeeId: string;
  name: string;
  department: string;
  type: LeaveRequest['leaveType'];
  status: LeaveRequest['status'];
  days: number;
  request: LeaveRequest;
};

/** Month view + Desk table of who is off, so cover gaps are obvious. */
export default function LeaveCalendarTab() {
  const requests = useLeaveAttendanceStore((s) => s.leaveRequests);
  const employees = useEmployeeStore((s) => s.employees);
  const departments = useEmployeeStore((s) => s.departments);
  const getDepartment = useEmployeeStore((s) => s.getDepartment);

  const [cursor, setCursor] = React.useState(() => { const n = new Date(); return { y: n.getFullYear(), m: n.getMonth() }; });
  const [dept, setDept] = React.useState('all');
  const [statusFilter, setStatusFilter] = React.useState<'all' | 'approved' | 'pending'>('all');
  const [typeFilter, setTypeFilter] = React.useState('all');
  const [q, setQ] = React.useState('');
  const [sortKey, setSortKey] = React.useState<OffSortKey>('date');
  const [sortDir, setSortDir] = React.useState<'asc' | 'desc'>('asc');
  const [viewing, setViewing] = React.useState<OffRow | null>(null);
  const cols = useResizableColumns<OffSortKey>(defaultWidths);
  const today = todayKey();

  const staff = employees.filter((e) => e.status !== 'terminated' && e.status !== 'inactive' && (dept === 'all' || e.departmentId === dept));
  const daysInMonth = new Date(Date.UTC(cursor.y, cursor.m + 1, 0)).getUTCDate();
  const lead = (new Date(Date.UTC(cursor.y, cursor.m, 1)).getUTCDay() + 6) % 7;
  const p = (n: number) => String(n).padStart(2, '0');
  const cells: Array<string | null> = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => `${cursor.y}-${p(cursor.m + 1)}-${p(i + 1)}`),
  ];

  const move = (delta: number) => setCursor(({ y, m }) => { const d = new Date(y, m + delta, 1); return { y: d.getFullYear(), m: d.getMonth() }; });
  const monthLabel = new Date(cursor.y, cursor.m, 1).toLocaleString('en-GB', { month: 'long', year: 'numeric' });

  const offOn = (day: string) =>
    staff.flatMap((e) => {
      const r = leaveOn(requests, e.id, day, ['approved', 'pending']);
      return r ? [{ name: `${e.firstName} ${e.lastName}`, pending: r.status === 'pending', type: r.leaveType }] : [];
    });

  const tableRows = React.useMemo(() => {
    const monthPrefix = `${cursor.y}-${p(cursor.m + 1)}-`;
    const rows: OffRow[] = [];
    for (const r of requests) {
      if (r.status !== 'approved' && r.status !== 'pending') continue;
      if (statusFilter !== 'all' && r.status !== statusFilter) continue;
      if (typeFilter !== 'all' && r.leaveType !== typeFilter) continue;
      const emp = employees.find((e) => e.id === r.employeeId);
      if (!emp || emp.status === 'terminated' || emp.status === 'inactive') continue;
      if (dept !== 'all' && emp.departmentId !== dept) continue;
      const name = `${emp.firstName} ${emp.lastName}`;
      if (q.trim() && !name.toLowerCase().includes(q.trim().toLowerCase())) continue;

      const start = new Date(r.startDate);
      const end = new Date(r.endDate);
      for (let d = new Date(start), i = 0; d <= end && i < 400; d.setUTCDate(d.getUTCDate() + 1), i++) {
        const key = `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`;
        if (!key.startsWith(monthPrefix)) continue;
        rows.push({
          id: `${r.id}-${key}`,
          date: key,
          employeeId: emp.id,
          name,
          department: getDepartment(emp.departmentId)?.name || '—',
          type: r.leaveType,
          status: r.status,
          days: r.totalDays,
          request: r,
        });
      }
    }

    const value = (row: OffRow): string | number => {
      switch (sortKey) {
        case 'date': return row.date;
        case 'employee': return row.name.toLowerCase();
        case 'department': return row.department.toLowerCase();
        case 'type': return row.type;
        case 'status': return row.status;
        case 'days': return row.days;
        default: return '';
      }
    };
    const sorted = [...rows].sort((a, b) => {
      const av = value(a);
      const bv = value(b);
      if (av < bv) return -1;
      if (av > bv) return 1;
      return 0;
    });
    return sortDir === 'asc' ? sorted : sorted.reverse();
  }, [requests, employees, cursor, dept, statusFilter, typeFilter, q, sortKey, sortDir, getDepartment]);

  const { page, setPage, pages, paged } = useDeskPagination(tableRows, [cursor.y, cursor.m, dept, statusFilter, typeFilter, q, sortKey, sortDir]);

  const onSort = (key: OffSortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const column = (key: OffSortKey, label: string, align: 'left' | 'right' | 'center' = 'left') => (
    <TableColumn key={key} className="relative" style={cols.style(key)}>
      <SortLabel active={sortKey === key} dir={sortDir} align={align} onPress={() => onSort(key)}>{label}</SortLabel>
      {cols.sizer(key, label)}
    </TableColumn>
  );

  const statusColor = (s: string) => (s === 'approved' ? 'success' : s === 'pending' ? 'warning' : 'default') as any;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="justify-between gap-2 flex-wrap">
          <div className="font-medium">Who&apos;s off — {monthLabel}</div>
          <div className="flex flex-wrap items-center gap-2">
            <Input size="sm" placeholder="Search staff" value={q} onChange={(e) => setQ(e.target.value)} variant="bordered" className="w-40" />
            <Select size="sm" aria-label="Department" className="w-44" variant="bordered" selectedKeys={[dept]} onSelectionChange={(k) => setDept(Array.from(k)[0] as string)}
              items={[{ id: 'all', name: 'All departments' }, ...departments.map((d) => ({ id: d.id, name: d.name }))]}>
              {(item: any) => <SelectItem key={item.id}>{item.name}</SelectItem>}
            </Select>
            <Select size="sm" aria-label="Type" className="w-36" variant="bordered" selectedKeys={[typeFilter]} onSelectionChange={(k) => setTypeFilter(Array.from(k)[0] as string)}>
              <SelectItem key="all">All types</SelectItem>
              <SelectItem key="annual">Annual</SelectItem>
              <SelectItem key="sick">Sick</SelectItem>
              <SelectItem key="personal">Personal</SelectItem>
              <SelectItem key="maternity">Maternity</SelectItem>
              <SelectItem key="paternity">Paternity</SelectItem>
              <SelectItem key="bereavement">Bereavement</SelectItem>
            </Select>
            <Select size="sm" aria-label="Status" className="w-36" variant="bordered" selectedKeys={[statusFilter]} onSelectionChange={(k) => setStatusFilter(Array.from(k)[0] as any)}>
              <SelectItem key="all">All status</SelectItem>
              <SelectItem key="approved">Approved</SelectItem>
              <SelectItem key="pending">Pending</SelectItem>
            </Select>
            <Button size="sm" variant="flat" onPress={() => move(-1)}>‹</Button>
            <Button size="sm" variant="flat" onPress={() => { const n = new Date(); setCursor({ y: n.getFullYear(), m: n.getMonth() }); }}>Today</Button>
            <Button size="sm" variant="flat" onPress={() => move(1)}>›</Button>
          </div>
        </CardHeader>
        <CardBody className="space-y-4">
          <div className="grid grid-cols-7 gap-1 text-xs">
            {WEEKDAYS.map((w) => <div key={w} className="text-center font-medium text-gray-500 py-1">{w}</div>)}
            {cells.map((day, i) => {
              if (!day) return <div key={`pad-${i}`} />;
              const off = offOn(day).filter((o) => {
                if (statusFilter === 'pending' && !o.pending) return false;
                if (statusFilter === 'approved' && o.pending) return false;
                if (typeFilter !== 'all' && o.type !== typeFilter) return false;
                if (q.trim() && !o.name.toLowerCase().includes(q.trim().toLowerCase())) return false;
                return true;
              });
              return (
                <div key={day} className={`min-h-[84px] rounded border p-1 ${day === today ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white'}`}>
                  <div className="flex justify-between text-gray-500">
                    <span>{Number(day.slice(8))}</span>
                    {off.length > 0 && <span className="text-[10px] font-medium text-amber-700">{off.length} off</span>}
                  </div>
                  <div className="space-y-0.5 mt-0.5">
                    {off.slice(0, MAX_NAMES).map((o) => (
                      <div key={o.name} title={`${o.name} — ${o.type}${o.pending ? ' (pending)' : ''}`}
                        className={`truncate rounded px-1 ${o.pending ? 'border border-dashed border-amber-400 text-amber-700' : 'bg-amber-100 text-amber-900'}`}>
                        {o.name}
                      </div>
                    ))}
                    {off.length > MAX_NAMES && <div className="text-gray-500 px-1">+{off.length - MAX_NAMES} more</div>}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-amber-100" /> Approved</span>
            <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded border border-dashed border-amber-400" /> Pending approval</span>
          </div>

          <div ref={cols.frameRef} style={cols.frameStyle}>
          <Table
            aria-label="whos-off-table"
            removeWrapper
            classNames={{
              ...unifiedTableClassNames,
              table: 'table-fixed w-[var(--col-table-width)] min-w-[var(--col-table-width)] max-w-none',
              th: `${unifiedTableClassNames.th} relative`,
              td: `${unifiedTableClassNames.td} overflow-hidden`,
            }}
          >
            <TableHeader>
              {column('date', 'Date')}
              {column('employee', 'Employee')}
              {column('department', 'Department')}
              {column('type', 'Type')}
              {column('status', 'Status')}
              {column('days', 'Days', 'center')}
            </TableHeader>
            <TableBody emptyContent="No one is off this month with these filters.">
              {paged.map((row) => (
                <TableRow
                  key={row.id}
                  className={rowClassNames(viewing?.id === row.id)}
                  onClick={() => setViewing(row)}
                >
                  <TableCell className="text-gray-600">{new Date(row.date + 'T00:00:00Z').toLocaleDateString()}</TableCell>
                  <TableCell className="font-semibold text-ghana-black">
                    <span className="block truncate" title={row.name}>{row.name}</span>
                  </TableCell>
                  <TableCell>
                    <span className="block truncate" title={row.department}>{row.department}</span>
                  </TableCell>
                  <TableCell className="capitalize">{row.type}</TableCell>
                  <TableCell><Chip size="sm" variant="flat" color={statusColor(row.status)}>{row.status}</Chip></TableCell>
                  <TableCell className="text-center tabular-nums">{row.days}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
          <div className="mt-3 flex justify-end">
            <Pagination page={page} total={pages} onChange={setPage} showControls size="sm" />
          </div>
        </CardBody>
      </Card>

      <Modal isOpen={!!viewing} onOpenChange={(open) => !open && setViewing(null)} size="lg">
        <ModalContent>
          {() => viewing && (
            <>
              <ModalHeader>Leave day</ModalHeader>
              <ModalBody>
                <DetailGrid>
                  <DetailField label="Date" value={new Date(viewing.date + 'T00:00:00Z').toLocaleDateString()} />
                  <DetailField label="Employee" value={viewing.name} />
                  <DetailField label="Department" value={viewing.department} />
                  <DetailField label="Type" value={<span className="capitalize">{viewing.type}</span>} />
                  <DetailField label="Status" value={<Chip size="sm" variant="flat" color={statusColor(viewing.status)}>{viewing.status}</Chip>} />
                  <DetailField label="Request days" value={String(viewing.days)} />
                  <DetailField label="From" value={new Date(viewing.request.startDate).toLocaleDateString()} />
                  <DetailField label="To" value={new Date(viewing.request.endDate).toLocaleDateString()} />
                  <DetailField label="Reason" value={viewing.request.reason || '—'} full />
                </DetailGrid>
              </ModalBody>
              <ModalFooter className="flex flex-wrap justify-between gap-2">
                <Button variant="flat" onPress={() => setViewing(null)}>Close</Button>
                <Button
                  variant="bordered"
                  onPress={() => printDetailSheet('Leave day', [
                    { label: 'Date', value: new Date(viewing.date + 'T00:00:00Z').toLocaleDateString() },
                    { label: 'Employee', value: viewing.name },
                    { label: 'Department', value: viewing.department },
                    { label: 'Type', value: viewing.type },
                    { label: 'Status', value: viewing.status },
                    { label: 'Request days', value: String(viewing.days) },
                    { label: 'From', value: new Date(viewing.request.startDate).toLocaleDateString() },
                    { label: 'To', value: new Date(viewing.request.endDate).toLocaleDateString() },
                    { label: 'Reason', value: viewing.request.reason || '—' },
                  ])}
                >
                  Print
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}
