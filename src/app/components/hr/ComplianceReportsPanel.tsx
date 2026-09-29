'use client';

import React from 'react';
import { Button, Card, CardBody, CardHeader, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow, Chip } from '@heroui/react';
import { useComplianceStore } from '@/app/lib/compliance/store';
import { deskResizableTableClassNames, useResizableColumns } from '../frontoffice/columnResize';

const reportColWidths = { report: 200, period: 120, status: 110, actions: 160 };

export default function ComplianceReportsPanel() {
  const reportCols = useResizableColumns(reportColWidths);
  const reports = useComplianceStore((s) => s.reports);
  const updateReport = useComplianceStore((s) => s.updateReport);
  const hydrateReportFilingsFromApi = useComplianceStore((s) => s.hydrateReportFilingsFromApi);

  React.useEffect(() => {
    hydrateReportFilingsFromApi();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const color = (s: string) => (s === 'approved' ? 'success' : s === 'submitted' ? 'primary' : s === 'pending' ? 'warning' : 'default') as any;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="justify-between">
          <div className="font-medium">Compliance Reports</div>
        </CardHeader>
        <CardBody>
          <div ref={reportCols.frameRef} style={reportCols.frameStyle}>
            <Table aria-label="compliance-reports" removeWrapper classNames={deskResizableTableClassNames()}>
              <TableHeader>
                <TableColumn style={reportCols.style('report')}>Report</TableColumn>
                <TableColumn style={reportCols.style('period')}>Period</TableColumn>
                <TableColumn style={reportCols.style('status')}>Status</TableColumn>
                <TableColumn style={reportCols.style('actions')}>{' '}</TableColumn>
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
          </div>
        </CardBody>
      </Card>
    </div>
  );
}


