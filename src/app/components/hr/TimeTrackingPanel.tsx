'use client';

import React from 'react';
import { Button, Card, CardBody, CardHeader, Input, Select, SelectItem, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow, Chip } from '@heroui/react';
import { useLeaveAttendanceStore } from '@/app/lib/hr/leaveAttendanceStore';
import { useEmployeeStore } from '@/app/lib/hr/employeeStore';

export default function TimeTrackingPanel() {
  const attendances = useLeaveAttendanceStore((s) => s.attendances);
  const clockIn = useLeaveAttendanceStore((s) => s.clockIn);
  const clockOut = useLeaveAttendanceStore((s) => s.clockOut);
  const employees = useEmployeeStore((s) => s.employees);

  const [employeeId, setEmployeeId] = React.useState<string>(employees[0]?.id || '');

  const clockedIn = attendances.filter((a) => a.checkInTime && !a.checkOutTime);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="justify-between">
          <div className="font-medium">Time Tracking</div>
          <div className="flex items-center gap-2">
            <Select label="Employee" selectedKeys={[employeeId]} onSelectionChange={(k) => setEmployeeId(Array.from(k)[0] as string)} variant="bordered" items={employees.map(e => ({ id: e.id, name: `${e.firstName} ${e.lastName}` }))} className="w-60">
              {(item: any) => <SelectItem key={item.id}>{item.name}</SelectItem>}
            </Select>
            <Button color="primary" onPress={() => clockIn(employeeId)}>Clock In</Button>
            <Button variant="flat" onPress={() => clockOut(employeeId)}>Clock Out</Button>
          </div>
        </CardHeader>
        <CardBody>
          <Table aria-label="clocked-in">
            <TableHeader>
              <TableColumn>EMPLOYEE</TableColumn>
              <TableColumn>DATE</TableColumn>
              <TableColumn>IN</TableColumn>
              <TableColumn>OUT</TableColumn>
              <TableColumn>HOURS</TableColumn>
              <TableColumn>OVERTIME</TableColumn>
              <TableColumn>STATUS</TableColumn>
            </TableHeader>
            <TableBody>
              {attendances.map((a) => {
                const emp = employees.find(e => e.id === a.employeeId);
                const name = emp ? `${emp.firstName} ${emp.lastName}` : a.employeeId;
                return (
                  <TableRow key={a.id}>
                    <TableCell>{name}</TableCell>
                    <TableCell>{new Date(a.date).toLocaleDateString()}</TableCell>
                    <TableCell>{a.checkInTime ? new Date(a.checkInTime).toLocaleTimeString() : '-'}</TableCell>
                    <TableCell>{a.checkOutTime ? new Date(a.checkOutTime).toLocaleTimeString() : '-'}</TableCell>
                    <TableCell>{(a.totalHours || 0).toFixed(2)}</TableCell>
                    <TableCell>{(a.overtimeHours || 0).toFixed(2)}</TableCell>
                    <TableCell><Chip size="sm" variant="flat" color={a.checkInTime && !a.checkOutTime ? 'warning' : 'success'}>{a.checkInTime && !a.checkOutTime ? 'In Progress' : 'Completed'}</Chip></TableCell>
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


