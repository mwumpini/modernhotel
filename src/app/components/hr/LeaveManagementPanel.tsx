'use client';

import React from 'react';
import { Button, Card, CardBody, CardHeader, Input, Select, SelectItem, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow, Chip, Tabs, Tab, Textarea } from '@heroui/react';
import { useLeaveAttendanceStore } from '@/app/lib/hr/leaveAttendanceStore';
import { useEmployeeStore } from '@/app/lib/hr/employeeStore';
import { useCurrentUserName } from '@/app/lib/auth/useCurrentUserName';
import { addDays, countLeaveDays, dayKey, leaveOn } from '@/app/lib/hr/leaveDates';
import { downloadLeaveForm, printLeaveForm } from '@/app/lib/hr/leaveForm';
import LeaveBalancesTab from './LeaveBalancesTab';
import LeaveCalendarTab from './LeaveCalendarTab';

export default function LeaveManagementPanel() {
  const requests = useLeaveAttendanceStore((s) => s.leaveRequests);
  const requestLeave = useLeaveAttendanceStore((s) => s.requestLeave);
  const approveLeave = useLeaveAttendanceStore((s) => s.approveLeave);
  const rejectLeave = useLeaveAttendanceStore((s) => s.rejectLeave);
  const getLeaveBalance = useLeaveAttendanceStore((s) => s.getLeaveBalance);
  const employees = useEmployeeStore((s) => s.employees);
  const userName = useCurrentUserName();

  const [form, setForm] = React.useState<any>({ employeeId: employees[0]?.id || '', leaveType: 'annual', startDate: '', endDate: '', reason: '', coveringEmployeeId: '', handoverNotes: '' });
  const [status, setStatus] = React.useState<'all' | 'pending' | 'approved' | 'rejected' | 'cancelled'>('all');

  const filtered = requests.filter(r => status === 'all' || r.status === status);

  const submit = () => {
    if (!form.employeeId || !form.startDate || !form.endDate) return;
    if (new Date(form.endDate) < new Date(form.startDate)) return;
    requestLeave({ employeeId: form.employeeId, leaveType: form.leaveType, startDate: new Date(form.startDate), endDate: new Date(form.endDate), totalDays: countLeaveDays(form.startDate, form.endDate, form.leaveType), reason: form.reason, coveringEmployeeId: form.coveringEmployeeId || undefined, handoverNotes: form.handoverNotes.trim() || undefined, requestedBy: form.employeeId, status: 'pending', createdAt: new Date(), updatedAt: new Date() } as any);
    // Dates, reason and cover belong to that one request — start the next one clean.
    setForm({ ...form, startDate: '', endDate: '', reason: '', coveringEmployeeId: '', handoverNotes: '' });
  };

  // Anyone else on approved leave at any point in these dates can't be the relief officer.
  const candidates = employees.filter((e) => e.id !== form.employeeId && e.status !== 'terminated' && e.status !== 'inactive');
  const unavailableIds = React.useMemo(() => {
    if (!form.startDate || !form.endDate || form.endDate < form.startDate) return [] as string[];
    const days: string[] = [];
    for (let d = form.startDate, i = 0; d <= form.endDate && i < 400; d = addDays(d, 1), i++) days.push(d);
    return candidates.filter((c) => days.some((d) => leaveOn(requests, c.id, d))).map((c) => c.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.startDate, form.endDate, form.employeeId, requests, employees]);

  // Shown under the form so the requester sees what is left before submitting.
  const requestedDays = form.startDate && form.endDate && form.endDate >= form.startDate
    ? countLeaveDays(form.startDate, form.endDate, form.leaveType)
    : 0;
  const balance = form.employeeId
    ? getLeaveBalance(form.employeeId, form.leaveType, form.startDate ? new Date(form.startDate).getUTCFullYear() : new Date().getFullYear())
    : null;

  const statusColor = (s: string) => (s === 'approved' ? 'success' : s === 'pending' ? 'warning' : s === 'rejected' ? 'danger' : 'default') as any;

  return (
    <Tabs aria-label="Leave views">
      <Tab key="requests" title="📝 Requests">
      <Card>
        <CardHeader className="justify-between">
          <div className="font-medium">Leave Management</div>
          <div className="flex items-center gap-2">
            <Select size="sm" selectedKeys={[status]} onSelectionChange={(k) => setStatus(Array.from(k)[0] as any)} className="w-40" variant="bordered">
              <SelectItem key="all">All</SelectItem>
              <SelectItem key="pending">Pending</SelectItem>
              <SelectItem key="approved">Approved</SelectItem>
              <SelectItem key="rejected">Rejected</SelectItem>
            </Select>
          </div>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-4">
            <Select label="Employee" selectedKeys={[form.employeeId]} onSelectionChange={(k) => { const id = Array.from(k)[0] as string; setForm({ ...form, employeeId: id, coveringEmployeeId: form.coveringEmployeeId === id ? '' : form.coveringEmployeeId }); }} variant="bordered" items={employees.map(e => ({ id: e.id, name: `${e.firstName} ${e.lastName}` }))}>
              {(item: any) => <SelectItem key={item.id}>{item.name}</SelectItem>}
            </Select>
            <Select label="Type" selectedKeys={[form.leaveType]} onSelectionChange={(k) => setForm({ ...form, leaveType: Array.from(k)[0] as string })} variant="bordered">
              <SelectItem key="annual">Annual</SelectItem>
              <SelectItem key="sick">Sick</SelectItem>
              <SelectItem key="personal">Personal</SelectItem>
              <SelectItem key="maternity">Maternity</SelectItem>
              <SelectItem key="paternity">Paternity</SelectItem>
              <SelectItem key="bereavement">Bereavement</SelectItem>
            </Select>
            <Input label="Start" type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} variant="bordered" />
            <Input label="End" type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} variant="bordered" />
            <Input label="Reason" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} variant="bordered" />
            <Select className="md:col-span-2" label="Covered by (relief officer)" placeholder="Who takes over while they're away?" selectedKeys={form.coveringEmployeeId ? [form.coveringEmployeeId] : []} disabledKeys={unavailableIds}
              onSelectionChange={(k) => setForm({ ...form, coveringEmployeeId: (Array.from(k)[0] as string) || '' })} variant="bordered"
              items={candidates.map((e) => ({ id: e.id, name: `${e.firstName} ${e.lastName}${unavailableIds.includes(e.id) ? ' (on leave then)' : ''}` }))}>
              {(item: any) => <SelectItem key={item.id}>{item.name}</SelectItem>}
            </Select>
            <Textarea className="md:col-span-3" label="Handover notes" placeholder="Tasks, contacts and anything pending the relief officer needs to know" minRows={2} value={form.handoverNotes} onChange={(e) => setForm({ ...form, handoverNotes: e.target.value })} variant="bordered" />
            <div className="md:col-span-5 flex items-center gap-3 flex-wrap"><Button color="primary" onPress={submit} isDisabled={!form.employeeId || !form.startDate || !form.endDate || (new Date(form.endDate) < new Date(form.startDate))}>Request Leave</Button>
              {balance && balance.entitlement > 0 && (
                <span className={`text-sm ${requestedDays > balance.remaining ? 'text-red-600' : 'text-gray-600'}`}>
                  {balance.remaining} of {balance.entitlement} {form.leaveType} days left this year
                  {requestedDays > 0 ? ` · this request is ${requestedDays} day${requestedDays === 1 ? '' : 's'}${requestedDays > balance.remaining ? ' — over the balance, so it cannot be approved' : ''}` : ''}
                </span>
              )}
            </div>
          </div>

          <Table aria-label="leave-requests">
            <TableHeader>
              <TableColumn>EMPLOYEE</TableColumn>
              <TableColumn>TYPE</TableColumn>
              <TableColumn>FROM</TableColumn>
              <TableColumn>TO</TableColumn>
              <TableColumn>DAYS</TableColumn>
              <TableColumn>COVERED BY</TableColumn>
              <TableColumn>STATUS</TableColumn>
              <TableColumn>{' '}</TableColumn>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => {
                const emp = employees.find(e => e.id === r.employeeId);
                const name = emp ? `${emp.firstName} ${emp.lastName}` : r.employeeId;
                return (
                  <TableRow key={r.id}>
                    <TableCell>{name}</TableCell>
                    <TableCell>{r.leaveType}</TableCell>
                    <TableCell>{new Date(r.startDate).toLocaleDateString()}</TableCell>
                    <TableCell>{new Date(r.endDate).toLocaleDateString()}</TableCell>
                    <TableCell>{r.totalDays}</TableCell>
                    <TableCell>{(() => { const c = employees.find((e) => e.id === r.coveringEmployeeId); return c ? `${c.firstName} ${c.lastName}` : '—'; })()}</TableCell>
                    <TableCell><Chip size="sm" variant="flat" color={statusColor(r.status)}>{r.status}</Chip></TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button size="sm" variant="flat" onPress={() => printLeaveForm(r, userName)}>Print form</Button>
                        <Button size="sm" variant="flat" onPress={() => { void downloadLeaveForm(r, userName); }}>PDF</Button>
                        {r.status === 'pending' && (
                          <>
                            <Button size="sm" variant="flat" color="success" onPress={() => {
                              const result = approveLeave(r.id, 'HR Manager');
                              if (!result.success) alert(result.error);
                            }}>Approve</Button>
                            <Button size="sm" variant="flat" color="danger" onPress={() => rejectLeave(r.id, 'HR Manager')}>Reject</Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardBody>
      </Card>
      </Tab>
      <Tab key="balances" title="📊 Balances"><LeaveBalancesTab /></Tab>
      <Tab key="calendar" title="📅 Who's Off"><LeaveCalendarTab /></Tab>
    </Tabs>
  );
}


