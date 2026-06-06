'use client';

import React from 'react';
import { Card, CardBody, CardHeader, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow, Chip, Select, SelectItem } from '@heroui/react';
import { useLeaveAttendanceStore } from '@/app/lib/hr/leaveAttendanceStore';
import { useEmployeeStore } from '@/app/lib/hr/employeeStore';

export default function OvertimeManagementPanel() {
  const attendances = useLeaveAttendanceStore((s) => s.attendances);
  const employees = useEmployeeStore((s) => s.employees);

  const [filter, setFilter] = React.useState<'all' | 'open' | 'closed'>('all');
  const rows = attendances.filter(a => {
    const hasOt = (a.overtimeHours || 0) > 0;
    if (filter === 'open') return hasOt && !!a.checkOutTime;
    if (filter === 'closed') return !hasOt;
    return true;
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="justify-between">
          <div className="font-medium">Overtime Management</div>
          <Select size="sm" selectedKeys={[filter]} onSelectionChange={(k) => setFilter(Array.from(k)[0] as any)} className="w-40" variant="bordered">
            <SelectItem key="all">All</SelectItem>
            <SelectItem key="open">Open</SelectItem>
            <SelectItem key="closed">No OT</SelectItem>
          </Select>
        </CardHeader>
        <CardBody>
          <Table aria-label="overtime">
            <TableHeader>
              <TableColumn>EMPLOYEE</TableColumn>
              <TableColumn>DATE</TableColumn>
              <TableColumn>HOURS</TableColumn>
              <TableColumn>OVERTIME</TableColumn>
              <TableColumn>STATUS</TableColumn>
            </TableHeader>
            <TableBody>
              {rows.map((a) => {
                const emp = employees.find(e => e.id === a.employeeId);
                const name = emp ? `${emp.firstName} ${emp.lastName}` : a.employeeId;
                const hasOt = (a.overtimeHours || 0) > 0;
                return (
                  <TableRow key={a.id}>
                    <TableCell>{name}</TableCell>
                    <TableCell>{new Date(a.date).toLocaleDateString()}</TableCell>
                    <TableCell>{(a.totalHours || 0).toFixed(2)}</TableCell>
                    <TableCell>{(a.overtimeHours || 0).toFixed(2)}</TableCell>
                    <TableCell><Chip size="sm" variant="flat" color={hasOt ? 'warning' : 'success'}>{hasOt ? 'Open' : 'No OT'}</Chip></TableCell>
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


