'use client';

import React from 'react';
import { Button, Card, CardBody, CardHeader, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow, Chip } from '@heroui/react';
import { useComplianceStore } from '@/app/lib/compliance/store';

export default function ComplianceReportsPanel() {
  const reports = useComplianceStore((s) => s.reports);
  const updateReport = useComplianceStore((s) => s.updateReport);

  const color = (s: string) => (s === 'approved' ? 'success' : s === 'submitted' ? 'primary' : s === 'pending' ? 'warning' : 'default') as any;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="justify-between">
          <div className="font-medium">Compliance Reports</div>
        </CardHeader>
        <CardBody>
          <Table aria-label="compliance-reports">
            <TableHeader>
              <TableColumn>REPORT</TableColumn>
              <TableColumn>PERIOD</TableColumn>
              <TableColumn>STATUS</TableColumn>
              <TableColumn>{' '}</TableColumn>
            </TableHeader>
            <TableBody>
              {reports.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.reportType}</TableCell>
                  <TableCell>{r.period || '-'}</TableCell>
                  <TableCell><Chip size="sm" variant="flat" color={color(r.status)}>{r.status}</Chip></TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button size="sm" variant="flat" onPress={() => updateReport(r.id, { status: 'submitted' })}>Submit</Button>
                      <Button size="sm" variant="flat" color="success" onPress={() => updateReport(r.id, { status: 'approved' })}>Approve</Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardBody>
      </Card>
    </div>
  );
}


