'use client';

import React from 'react';
import { Button, Card, CardBody, CardHeader, Input, Select, SelectItem, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow } from '@heroui/react';
import { useLeaveAttendanceStore } from '@/app/lib/hr/leaveAttendanceStore';
import { useEmployeeStore } from '@/app/lib/hr/employeeStore';

export default function ShiftSchedulingPanel() {
  const shifts = useLeaveAttendanceStore((s) => s.shifts);
  const scheduleShift = useLeaveAttendanceStore((s) => s.scheduleShift);
  const updateShift = useLeaveAttendanceStore((s) => s.updateShift);
  const deleteShift = useLeaveAttendanceStore((s) => s.deleteShift);
  const employees = useEmployeeStore((s) => s.employees);

  const [form, setForm] = React.useState<any>({ employeeId: employees[0]?.id || '', date: new Date().toISOString().slice(0,10), startTime: '08:00', endTime: '16:00', location: '' });

  const create = () => {
    if (!form.employeeId || !form.date || !form.startTime || !form.endTime) return;
    if (form.endTime <= form.startTime) return;
    scheduleShift({ employeeId: form.employeeId, date: form.date, startTime: form.startTime, endTime: form.endTime, location: form.location });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="justify-between">
          <div className="font-medium">Shift Scheduling</div>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-4">
            <Select label="Employee" selectedKeys={[form.employeeId]} onSelectionChange={(k) => setForm({ ...form, employeeId: Array.from(k)[0] as string })} variant="bordered" items={employees.map(e => ({ id: e.id, name: `${e.firstName} ${e.lastName}` }))}>
              {(item: any) => <SelectItem key={item.id}>{item.name}</SelectItem>}
            </Select>
            <Input label="Date" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} variant="bordered" />
            <Input label="Start" type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} variant="bordered" />
            <Input label="End" type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} variant="bordered" />
            <Input label="Location" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} variant="bordered" />
            <div className="md:col-span-5"><Button color="primary" onPress={create} isDisabled={!form.employeeId || !form.date || !form.startTime || !form.endTime || (form.endTime <= form.startTime)}>Add Shift</Button></div>
          </div>

          <Table aria-label="shifts">
            <TableHeader>
              <TableColumn>EMPLOYEE</TableColumn>
              <TableColumn>DATE</TableColumn>
              <TableColumn>START</TableColumn>
              <TableColumn>END</TableColumn>
              <TableColumn>LOCATION</TableColumn>
              <TableColumn></TableColumn>
            </TableHeader>
            <TableBody>
              {shifts.map((s) => {
                const emp = employees.find(e => e.id === s.employeeId);
                const name = emp ? `${emp.firstName} ${emp.lastName}` : s.employeeId;
                return (
                  <TableRow key={s.id}>
                    <TableCell>{name}</TableCell>
                    <TableCell>{s.date}</TableCell>
                    <TableCell>{s.startTime}</TableCell>
                    <TableCell>{s.endTime}</TableCell>
                    <TableCell>{s.location || '-'}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button size="sm" variant="flat" onPress={() => updateShift(s.id, { startTime: '09:00' })}>Move</Button>
                        <Button size="sm" variant="flat" color="danger" onPress={() => deleteShift(s.id)}>Delete</Button>
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


