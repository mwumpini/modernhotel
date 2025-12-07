'use client';

import React from 'react';
import { Card, CardBody, CardHeader, Input, Select, SelectItem, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow, Chip } from '@heroui/react';
import { useEmployeeChangesStore } from '@/app/lib/hr/employeeChangesStore';

export default function EmployeeChangesPanel() {
  const changesAll = useEmployeeChangesStore((s) => s.changes);
  const getRecentChanges = useEmployeeChangesStore((s) => s.getRecentChanges);

  const [days, setDays] = React.useState(30);
  const [q, setQ] = React.useState('');

  const recent = getRecentChanges(days).filter((c) => (c.employeeName || '').toLowerCase().includes(q.toLowerCase()));

  const colorFor = (
    type: string
  ): 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'danger' => {
    switch (type) {
      case 'promotion':
      case 'salary_change':
        return 'success';
      case 'transfer':
      case 'department_change':
      case 'position_change':
        return 'primary';
      case 'status_change':
        return 'warning';
      default:
        return 'default';
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="justify-between">
          <div className="font-medium">Employee Changes</div>
          <div className="flex items-center gap-2">
            <Input size="sm" placeholder="Filter by name" value={q} onChange={(e) => setQ(e.target.value)} variant="bordered" className="w-56" />
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
          <Table aria-label="employee-changes">
            <TableHeader>
              <TableColumn>DATE</TableColumn>
              <TableColumn>EMPLOYEE</TableColumn>
              <TableColumn>TYPE</TableColumn>
              <TableColumn>FIELD</TableColumn>
              <TableColumn>FROM</TableColumn>
              <TableColumn>TO</TableColumn>
            </TableHeader>
            <TableBody>
              {recent.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>{new Date(c.timestamp).toLocaleString()}</TableCell>
                  <TableCell>{c.employeeName || c.employeeId}</TableCell>
                  <TableCell><Chip size="sm" variant="flat" color={colorFor(c.type)}>{c.type}</Chip></TableCell>
                  <TableCell>{c.field || '-'}</TableCell>
                  <TableCell>{String(c.previousValue ?? '-')}</TableCell>
                  <TableCell>{String(c.newValue ?? '-')}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardBody>
      </Card>
    </div>
  );
}


