'use client';

import React from 'react';
import { Button, Card, CardBody, CardHeader, Input, Select, SelectItem, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow, Chip } from '@heroui/react';
import { useLeaveAttendanceStore } from '@/app/lib/hr/leaveAttendanceStore';
import { useEmployeeStore } from '@/app/lib/hr/employeeStore';

export default function LeaveManagementPanel() {
  const requests = useLeaveAttendanceStore((s) => s.leaveRequests);
  const requestLeave = useLeaveAttendanceStore((s) => s.requestLeave);
  const approveLeave = useLeaveAttendanceStore((s) => s.approveLeave);
  const rejectLeave = useLeaveAttendanceStore((s) => s.rejectLeave);
  const employees = useEmployeeStore((s) => s.employees);

  const [form, setForm] = React.useState<any>({ employeeId: employees[0]?.id || '', leaveType: 'annual', startDate: '', endDate: '', reason: '' });
  const [status, setStatus] = React.useState<'all' | 'pending' | 'approved' | 'rejected' | 'cancelled'>('all');

  const filtered = requests.filter(r => status === 'all' || r.status === status);

  const submit = () => {
    if (!form.employeeId || !form.startDate || !form.endDate) return;
    if (new Date(form.endDate) < new Date(form.startDate)) return;
    requestLeave({ employeeId: form.employeeId, leaveType: form.leaveType, startDate: new Date(form.startDate), endDate: new Date(form.endDate), totalDays: Math.max(1, Math.ceil((new Date(form.endDate).getTime() - new Date(form.startDate).getTime()) / (1000*60*60*24)) + 1), reason: form.reason, requestedBy: form.employeeId, status: 'pending', createdAt: new Date(), updatedAt: new Date() } as any);
  };

  const statusColor = (s: string) => (s === 'approved' ? 'success' : s === 'pending' ? 'warning' : s === 'rejected' ? 'danger' : 'default') as any;

  return (
    <div className="space-y-4">
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
            <Select label="Employee" selectedKeys={[form.employeeId]} onSelectionChange={(k) => setForm({ ...form, employeeId: Array.from(k)[0] as string })} variant="bordered" items={employees.map(e => ({ id: e.id, name: `${e.firstName} ${e.lastName}` }))}>
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
            <div className="md:col-span-5"><Button color="primary" onPress={submit} isDisabled={!form.employeeId || !form.startDate || !form.endDate || (new Date(form.endDate) < new Date(form.startDate))}>Request Leave</Button></div>
          </div>

          <Table aria-label="leave-requests">
            <TableHeader>
              <TableColumn>EMPLOYEE</TableColumn>
              <TableColumn>TYPE</TableColumn>
              <TableColumn>FROM</TableColumn>
              <TableColumn>TO</TableColumn>
              <TableColumn>DAYS</TableColumn>
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
                    <TableCell><Chip size="sm" variant="flat" color={statusColor(r.status)}>{r.status}</Chip></TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {r.status === 'pending' && (
                          <>
                            <Button size="sm" variant="flat" color="success" onPress={() => approveLeave(r.id, 'HR Manager')}>Approve</Button>
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
    </div>
  );
}


