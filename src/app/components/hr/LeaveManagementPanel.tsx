'use client';

import React from 'react';
import {
  Button, Card, CardBody, CardHeader, Input, Select, SelectItem, Table, TableBody, TableCell, TableColumn,
  TableHeader, TableRow, Chip, Textarea, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Pagination,
} from '@heroui/react';
import { useLeaveAttendanceStore } from '@/app/lib/hr/leaveAttendanceStore';
import { useEmployeeStore } from '@/app/lib/hr/employeeStore';
import { useCurrentUserName } from '@/app/lib/auth/useCurrentUserName';
import { addDays, countLeaveDays, leaveOn } from '@/app/lib/hr/leaveDates';
import { downloadLeaveForm, printLeaveForm } from '@/app/lib/hr/leaveForm';
import type { LeaveRequest } from '@/app/lib/hr/models';
import { SortLabel, unifiedTableClassNames, rowClassNames, useResizableColumns } from '../frontoffice/columnResize';
import { DetailGrid, DetailField } from '../frontoffice/detailView';
import { useDeskPagination } from '../dashboard/deskTableUi';

type LeaveSortKey = 'employee' | 'type' | 'from' | 'to' | 'days' | 'coveredBy' | 'status';

const defaultColumnWidths: Record<LeaveSortKey, number> = {
  employee: 160,
  type: 110,
  from: 110,
  to: 110,
  days: 72,
  coveredBy: 140,
  status: 110,
};

const emptyForm = (employeeId = '') => ({
  employeeId,
  leaveType: 'annual' as LeaveRequest['leaveType'],
  startDate: '',
  endDate: '',
  reason: '',
  coveringEmployeeId: '',
  handoverNotes: '',
});

/** Leave → Requests: Desk-style table + click-to-open detail + request modal. */
export default function LeaveManagementPanel() {
  const requests = useLeaveAttendanceStore((s) => s.leaveRequests);
  const requestLeave = useLeaveAttendanceStore((s) => s.requestLeave);
  const approveLeave = useLeaveAttendanceStore((s) => s.approveLeave);
  const rejectLeave = useLeaveAttendanceStore((s) => s.rejectLeave);
  const getLeaveBalance = useLeaveAttendanceStore((s) => s.getLeaveBalance);
  const employees = useEmployeeStore((s) => s.employees);
  const departments = useEmployeeStore((s) => s.departments);
  const userName = useCurrentUserName();

  const [form, setForm] = React.useState(() => emptyForm(employees[0]?.id || ''));
  const [status, setStatus] = React.useState<'all' | 'pending' | 'approved' | 'rejected' | 'cancelled'>('all');
  const [deptFilter, setDeptFilter] = React.useState('all');
  const [typeFilter, setTypeFilter] = React.useState('all');
  const [q, setQ] = React.useState('');
  const [requestOpen, setRequestOpen] = React.useState(false);
  const [viewing, setViewing] = React.useState<LeaveRequest | null>(null);
  const [sortKey, setSortKey] = React.useState<LeaveSortKey>('from');
  const [sortDir, setSortDir] = React.useState<'asc' | 'desc'>('desc');
  const cols = useResizableColumns<LeaveSortKey>(defaultColumnWidths);

  const filtered = React.useMemo(() => {
    const rows = requests.filter((r) => {
      if (status !== 'all' && r.status !== status) return false;
      if (typeFilter !== 'all' && r.leaveType !== typeFilter) return false;
      const emp = employees.find((e) => e.id === r.employeeId);
      if (deptFilter !== 'all' && emp?.departmentId !== deptFilter) return false;
      if (q.trim()) {
        const name = emp ? `${emp.firstName} ${emp.lastName}` : r.employeeId;
        if (!name.toLowerCase().includes(q.trim().toLowerCase())) return false;
      }
      return true;
    });
    const value = (r: LeaveRequest): string | number => {
      const emp = employees.find((e) => e.id === r.employeeId);
      const cover = employees.find((e) => e.id === r.coveringEmployeeId);
      switch (sortKey) {
        case 'employee': return emp ? `${emp.firstName} ${emp.lastName}`.toLowerCase() : r.employeeId;
        case 'type': return r.leaveType || '';
        case 'from': return new Date(r.startDate).getTime();
        case 'to': return new Date(r.endDate).getTime();
        case 'days': return Number(r.totalDays || 0);
        case 'coveredBy': return cover ? `${cover.firstName} ${cover.lastName}`.toLowerCase() : '';
        case 'status': return r.status || '';
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
  }, [requests, status, typeFilter, deptFilter, q, sortKey, sortDir, employees]);

  const { page, setPage, pages, paged } = useDeskPagination(filtered, [status, typeFilter, deptFilter, q, sortKey, sortDir]);

  const openRequestForm = () => {
    setForm(emptyForm(employees.find((e) => e.status === 'active')?.id || employees[0]?.id || ''));
    setRequestOpen(true);
  };

  const submit = () => {
    if (!form.employeeId || !form.startDate || !form.endDate) return;
    if (new Date(form.endDate) < new Date(form.startDate)) return;
    requestLeave({
      employeeId: form.employeeId,
      leaveType: form.leaveType,
      startDate: new Date(form.startDate),
      endDate: new Date(form.endDate),
      totalDays: countLeaveDays(form.startDate, form.endDate, form.leaveType),
      reason: form.reason,
      coveringEmployeeId: form.coveringEmployeeId || undefined,
      handoverNotes: form.handoverNotes.trim() || undefined,
      requestedBy: form.employeeId,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);
    setRequestOpen(false);
    setForm(emptyForm(form.employeeId));
  };

  const candidates = employees.filter((e) => e.id !== form.employeeId && e.status !== 'terminated' && e.status !== 'inactive');
  const unavailableIds = React.useMemo(() => {
    if (!form.startDate || !form.endDate || form.endDate < form.startDate) return [] as string[];
    const days: string[] = [];
    for (let d = form.startDate, i = 0; d <= form.endDate && i < 400; d = addDays(d, 1), i++) days.push(d);
    return candidates.filter((c) => days.some((d) => leaveOn(requests, c.id, d))).map((c) => c.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.startDate, form.endDate, form.employeeId, requests, employees]);

  const requestedDays = form.startDate && form.endDate && form.endDate >= form.startDate
    ? countLeaveDays(form.startDate, form.endDate, form.leaveType)
    : 0;
  const balance = form.employeeId
    ? getLeaveBalance(form.employeeId, form.leaveType, form.startDate ? new Date(form.startDate).getUTCFullYear() : new Date().getFullYear())
    : null;

  const statusColor = (s: string) => (s === 'approved' ? 'success' : s === 'pending' ? 'warning' : s === 'rejected' ? 'danger' : 'default') as any;

  const onSort = (key: LeaveSortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const column = (key: LeaveSortKey, label: string, align: 'left' | 'right' | 'center' = 'left') => (
    <TableColumn key={key} className="relative" style={cols.style(key)}>
      <SortLabel active={sortKey === key} dir={sortDir} align={align} onPress={() => onSort(key)}>{label}</SortLabel>
      {cols.sizer(key, label)}
    </TableColumn>
  );

  const liveView = viewing ? requests.find((r) => r.id === viewing.id) || viewing : null;
  const viewEmp = liveView ? employees.find((e) => e.id === liveView.employeeId) : undefined;
  const viewCover = liveView?.coveringEmployeeId ? employees.find((e) => e.id === liveView.coveringEmployeeId) : undefined;

  return (
    <>
      <Card>
        <CardHeader className="justify-between gap-2 flex-wrap">
          <div className="font-medium">Leave requests</div>
          <div className="flex flex-wrap items-center gap-2">
            <Input size="sm" placeholder="Search employee" value={q} onChange={(e) => setQ(e.target.value)} variant="bordered" className="w-44" />
            <Select
              size="sm"
              selectedKeys={[deptFilter]}
              onSelectionChange={(k) => setDeptFilter(Array.from(k)[0] as string)}
              className="w-44"
              variant="bordered"
              aria-label="Department"
              items={[{ id: 'all', name: 'All departments' }, ...departments.map((d) => ({ id: d.id, name: d.name }))]}
            >
              {(item: any) => <SelectItem key={item.id}>{item.name}</SelectItem>}
            </Select>
            <Select size="sm" selectedKeys={[typeFilter]} onSelectionChange={(k) => setTypeFilter(Array.from(k)[0] as string)} className="w-36" variant="bordered" aria-label="Leave type">
              <SelectItem key="all">All types</SelectItem>
              <SelectItem key="annual">Annual</SelectItem>
              <SelectItem key="sick">Sick</SelectItem>
              <SelectItem key="personal">Personal</SelectItem>
              <SelectItem key="maternity">Maternity</SelectItem>
              <SelectItem key="paternity">Paternity</SelectItem>
              <SelectItem key="bereavement">Bereavement</SelectItem>
            </Select>
            <Select size="sm" selectedKeys={[status]} onSelectionChange={(k) => setStatus(Array.from(k)[0] as any)} className="w-36" variant="bordered" aria-label="Status">
              <SelectItem key="all">All status</SelectItem>
              <SelectItem key="pending">Pending</SelectItem>
              <SelectItem key="approved">Approved</SelectItem>
              <SelectItem key="rejected">Rejected</SelectItem>
            </Select>
            <Button color="primary" onPress={openRequestForm}>+ Request Leave</Button>
          </div>
        </CardHeader>
        <CardBody>
          <div ref={cols.frameRef} style={cols.frameStyle}>
          <Table
            aria-label="leave-requests"
            removeWrapper
            classNames={{
              ...unifiedTableClassNames,
              table: 'table-fixed w-[var(--col-table-width)] min-w-[var(--col-table-width)] max-w-none',
              th: `${unifiedTableClassNames.th} relative`,
              td: `${unifiedTableClassNames.td} overflow-hidden`,
            }}
          >
            <TableHeader>
              {column('employee', 'Employee')}
              {column('type', 'Type')}
              {column('from', 'From')}
              {column('to', 'To')}
              {column('days', 'Days', 'center')}
              {column('coveredBy', 'Covered by')}
              {column('status', 'Status')}
            </TableHeader>
            <TableBody emptyContent="No leave requests match these filters.">
              {paged.map((r) => {
                const emp = employees.find((e) => e.id === r.employeeId);
                const name = emp ? `${emp.firstName} ${emp.lastName}` : r.employeeId;
                const cover = employees.find((e) => e.id === r.coveringEmployeeId);
                return (
                  <TableRow
                    key={r.id}
                    className={rowClassNames(viewing?.id === r.id)}
                    onClick={() => setViewing(r)}
                  >
                    <TableCell className="font-semibold text-ghana-black">
                      <span className="block truncate" title={name}>{name}</span>
                    </TableCell>
                    <TableCell className="capitalize">{r.leaveType}</TableCell>
                    <TableCell>{new Date(r.startDate).toLocaleDateString()}</TableCell>
                    <TableCell>{new Date(r.endDate).toLocaleDateString()}</TableCell>
                    <TableCell className="text-center tabular-nums">{r.totalDays}</TableCell>
                    <TableCell>
                      <span className="block truncate">{cover ? `${cover.firstName} ${cover.lastName}` : '—'}</span>
                    </TableCell>
                    <TableCell><Chip size="sm" variant="flat" color={statusColor(r.status)}>{r.status}</Chip></TableCell>
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

      <Modal isOpen={requestOpen} onOpenChange={setRequestOpen} size="3xl" scrollBehavior="inside">
        <ModalContent>
          {() => (
            <>
              <ModalHeader>Request leave</ModalHeader>
              <ModalBody className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Select
                    label="Employee"
                    selectedKeys={form.employeeId ? [form.employeeId] : []}
                    onSelectionChange={(k) => {
                      const id = (Array.from(k)[0] as string) || '';
                      setForm({ ...form, employeeId: id, coveringEmployeeId: form.coveringEmployeeId === id ? '' : form.coveringEmployeeId });
                    }}
                    variant="bordered"
                    items={employees.filter((e) => e.status !== 'terminated').map((e) => ({ id: e.id, name: `${e.firstName} ${e.lastName}` }))}
                  >
                    {(item: any) => <SelectItem key={item.id}>{item.name}</SelectItem>}
                  </Select>
                  <Select label="Type" selectedKeys={[form.leaveType]} onSelectionChange={(k) => setForm({ ...form, leaveType: Array.from(k)[0] as LeaveRequest['leaveType'] })} variant="bordered">
                    <SelectItem key="annual">Annual</SelectItem>
                    <SelectItem key="sick">Sick</SelectItem>
                    <SelectItem key="personal">Personal</SelectItem>
                    <SelectItem key="maternity">Maternity</SelectItem>
                    <SelectItem key="paternity">Paternity</SelectItem>
                    <SelectItem key="bereavement">Bereavement</SelectItem>
                  </Select>
                  <Input label="Start" type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} variant="bordered" />
                  <Input label="End" type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} variant="bordered" />
                  <Input className="md:col-span-2" label="Reason" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} variant="bordered" />
                  <Select
                    className="md:col-span-2"
                    label="Covered by (relief officer)"
                    placeholder="Who takes over while they're away?"
                    selectedKeys={form.coveringEmployeeId ? [form.coveringEmployeeId] : []}
                    disabledKeys={unavailableIds}
                    onSelectionChange={(k) => setForm({ ...form, coveringEmployeeId: (Array.from(k)[0] as string) || '' })}
                    variant="bordered"
                    items={candidates.map((e) => ({
                      id: e.id,
                      name: `${e.firstName} ${e.lastName}${unavailableIds.includes(e.id) ? ' (on leave then)' : ''}`,
                    }))}
                  >
                    {(item: any) => <SelectItem key={item.id}>{item.name}</SelectItem>}
                  </Select>
                  <Textarea
                    className="md:col-span-2"
                    label="Handover notes"
                    placeholder="Tasks, contacts and anything pending the relief officer needs to know"
                    minRows={3}
                    value={form.handoverNotes}
                    onChange={(e) => setForm({ ...form, handoverNotes: e.target.value })}
                    variant="bordered"
                  />
                </div>
                {balance && balance.entitlement > 0 && (
                  <p className={`text-sm ${requestedDays > balance.remaining ? 'text-red-600' : 'text-gray-600'}`}>
                    {balance.remaining} of {balance.entitlement} {form.leaveType} days left this year
                    {requestedDays > 0
                      ? ` · this request is ${requestedDays} day${requestedDays === 1 ? '' : 's'}${requestedDays > balance.remaining ? ' — over the balance, so it cannot be approved' : ''}`
                      : ''}
                  </p>
                )}
              </ModalBody>
              <ModalFooter>
                <Button variant="flat" onPress={() => setRequestOpen(false)}>Cancel</Button>
                <Button
                  color="primary"
                  onPress={submit}
                  isDisabled={!form.employeeId || !form.startDate || !form.endDate || (new Date(form.endDate) < new Date(form.startDate))}
                >
                  Submit request
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      <Modal isOpen={!!liveView} onOpenChange={(open) => !open && setViewing(null)} size="2xl" scrollBehavior="inside">
        <ModalContent>
          {() => liveView && (
            <>
              <ModalHeader className="flex flex-col gap-1">
                <span>Leave request</span>
                <span className="text-sm font-normal text-gray-500 capitalize">{liveView.leaveType} · {liveView.status}</span>
              </ModalHeader>
              <ModalBody>
                <DetailGrid>
                  <DetailField label="Employee" value={viewEmp ? `${viewEmp.firstName} ${viewEmp.lastName}` : liveView.employeeId} />
                  <DetailField label="Status" value={<Chip size="sm" variant="flat" color={statusColor(liveView.status)}>{liveView.status}</Chip>} />
                  <DetailField label="Type" value={<span className="capitalize">{liveView.leaveType}</span>} />
                  <DetailField label="Days" value={String(liveView.totalDays)} />
                  <DetailField label="From" value={new Date(liveView.startDate).toLocaleDateString()} />
                  <DetailField label="To" value={new Date(liveView.endDate).toLocaleDateString()} />
                  <DetailField label="Covered by" value={viewCover ? `${viewCover.firstName} ${viewCover.lastName}` : '—'} />
                  <DetailField label="Reason" value={liveView.reason || '—'} full />
                  <DetailField label="Handover notes" value={liveView.handoverNotes || '—'} full />
                </DetailGrid>
              </ModalBody>
              <ModalFooter className="flex flex-wrap justify-between gap-2">
                <Button variant="flat" onPress={() => setViewing(null)}>Close</Button>
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="bordered" onPress={() => printLeaveForm(liveView, userName)}>Print form</Button>
                  <Button variant="bordered" onPress={() => { void downloadLeaveForm(liveView, userName); }}>PDF</Button>
                  {liveView.status === 'pending' && (
                    <>
                      <Button
                        color="success"
                        variant="flat"
                        onPress={() => {
                          const result = approveLeave(liveView.id, 'HR Manager');
                          if (!result.success) alert(result.error);
                        }}
                      >
                        Approve
                      </Button>
                      <Button color="danger" variant="flat" onPress={() => rejectLeave(liveView.id, 'HR Manager')}>
                        Reject
                      </Button>
                    </>
                  )}
                </div>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </>
  );
}
