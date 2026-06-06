'use client';

import React from 'react';
import { Card, CardBody, CardHeader, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow, Chip, Button } from '@heroui/react';

const checklist = [
  { id: 'contracts', label: 'Signed Employment Contracts' },
  { id: 'ssnit', label: 'SSNIT Registration for Employees' },
  { id: 'overtime', label: 'Overtime Policy in Place' },
  { id: 'leave', label: 'Annual Leave Policy' },
  { id: 'safety', label: 'Workplace Safety Training' },
];

export default function LaborCompliancePanel() {
  const [done, setDone] = React.useState<Record<string, boolean>>({ ssnit: true, contracts: true });
  const score = Math.round((Object.keys(done).filter(k => done[k]).length / checklist.length) * 100);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="justify-between">
          <div className="font-medium">Labor Compliance</div>
          <div className="text-sm">Score: <span className="font-semibold">{score}</span></div>
        </CardHeader>
        <CardBody>
          <Table aria-label="labor-checklist">
            <TableHeader>
              <TableColumn>ITEM</TableColumn>
              <TableColumn>STATUS</TableColumn>
              <TableColumn>{' '}</TableColumn>
            </TableHeader>
            <TableBody>
              {checklist.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>{c.label}</TableCell>
                  <TableCell><Chip size="sm" variant="flat" color={done[c.id] ? 'success' : 'warning'}>{done[c.id] ? 'Complete' : 'Pending'}</Chip></TableCell>
                  <TableCell><Button size="sm" variant="flat" onPress={() => setDone(d => ({ ...d, [c.id]: !d[c.id] }))}>{done[c.id] ? 'Mark Pending' : 'Mark Complete'}</Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardBody>
      </Card>
    </div>
  );
}


