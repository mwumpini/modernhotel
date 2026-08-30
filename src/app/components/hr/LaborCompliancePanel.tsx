'use client';

import React from 'react';
import { Card, CardBody, CardHeader, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow, Chip } from '@heroui/react';
import { useEmployeeStore } from '@/app/lib/hr/employeeStore';
import { useTrainingStore } from '@/app/lib/hr/trainingStore';
import { computeLaborCompliance } from '@/app/lib/hr/laborCompliance';

export default function LaborCompliancePanel() {
  const employees = useEmployeeStore((s) => s.employees);
  const trainingPrograms = useTrainingStore((s) => s.programs);
  const trainingEnrollments = useTrainingStore((s) => s.enrollments);

  const { checklist, score } = React.useMemo(
    () => computeLaborCompliance(employees, trainingPrograms, trainingEnrollments),
    [employees, trainingPrograms, trainingEnrollments]
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="justify-between">
          <div className="font-medium">Labor Compliance</div>
          <div className="text-sm">Score: <span className="font-semibold">{score}</span></div>
        </CardHeader>
        <CardBody>
          <div className="text-xs text-gray-500 mb-3">
            Derived from actual employee records — not a manual checklist. Fill in SSNIT numbers,
            Ghana Card numbers, work-permit expiry dates, and documents on employee profiles to
            improve this score.
          </div>
          <Table aria-label="labor-checklist">
            <TableHeader>
              <TableColumn>ITEM</TableColumn>
              <TableColumn>COVERAGE</TableColumn>
              <TableColumn>STATUS</TableColumn>
            </TableHeader>
            <TableBody>
              {checklist.map((c) => {
                const isCompliant = c.total === 0 || c.compliant === c.total;
                return (
                  <TableRow key={c.id}>
                    <TableCell>{c.label}</TableCell>
                    <TableCell>{c.total === 0 ? 'N/A — no applicable employees' : `${c.compliant}/${c.total}`}</TableCell>
                    <TableCell>
                      <Chip size="sm" variant="flat" color={isCompliant ? 'success' : 'warning'}>
                        {isCompliant ? 'Compliant' : 'Attention Needed'}
                      </Chip>
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
