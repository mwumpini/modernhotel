'use client';

import React from 'react';
import { Button, Card, CardBody, CardHeader, Input, Select, SelectItem, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow } from '@heroui/react';
import { useEmployeeStore } from '@/app/lib/hr/employeeStore';

export default function NewHiresPanel() {
  const employees = useEmployeeStore((s) => s.employees);
  const getDepartment = useEmployeeStore((s) => s.getDepartment);
  const getPosition = useEmployeeStore((s) => s.getPosition);

  const [days, setDays] = React.useState(30);
  const [q, setQ] = React.useState('');

  const since = Date.now() - days * 24 * 60 * 60 * 1000;
  const hires = employees
    .filter((e) => new Date(e.hireDate).getTime() >= since)
    .filter((e) => `${e.firstName} ${e.lastName}`.toLowerCase().includes(q.toLowerCase()) || e.employeeNumber.toLowerCase().includes(q.toLowerCase()));

  const onboard = (id: string) => {
    const e = employees.find((x) => x.id === id);
    console.log('[HR][NewHires] startOnboarding', { id, name: e ? `${e.firstName} ${e.lastName}` : id });
    // Placeholder: integrate with onboarding workflow when available
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="justify-between">
          <div className="font-medium">New Hires</div>
          <div className="flex items-center gap-2">
            <Input size="sm" placeholder="Search name/number" value={q} onChange={(e) => setQ(e.target.value)} variant="bordered" className="w-56" />
            <Select size="sm" selectedKeys={[String(days)]} onSelectionChange={(k) => setDays(parseInt(Array.from(k)[0] as string, 10))} className="w-32" variant="bordered" aria-label="Period">
              <SelectItem key="7">7 days</SelectItem>
              <SelectItem key="14">14 days</SelectItem>
              <SelectItem key="30">30 days</SelectItem>
              <SelectItem key="60">60 days</SelectItem>
              <SelectItem key="90">90 days</SelectItem>
            </Select>
          </div>
        </CardHeader>
        <CardBody>
          <Table aria-label="new-hires">
            <TableHeader>
              <TableColumn>NUMBER</TableColumn>
              <TableColumn>NAME</TableColumn>
              <TableColumn>HIRED</TableColumn>
              <TableColumn>DEPARTMENT</TableColumn>
              <TableColumn>POSITION</TableColumn>
              <TableColumn>{' '}</TableColumn>
            </TableHeader>
            <TableBody>
              {hires.map((e) => {
                const dept = getDepartment(e.departmentId);
                const pos = getPosition(e.positionId);
                return (
                  <TableRow key={e.id}>
                    <TableCell>{e.employeeNumber}</TableCell>
                    <TableCell>{e.firstName} {e.lastName}</TableCell>
                    <TableCell>{new Date(e.hireDate).toLocaleDateString()}</TableCell>
                    <TableCell>{dept?.name || '-'}</TableCell>
                    <TableCell>{pos?.title || '-'}</TableCell>
                    <TableCell>
                      <Button size="sm" color="primary" onPress={() => onboard(e.id)}>Start Onboarding</Button>
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


