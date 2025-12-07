'use client';

import React from 'react';
import { Card, CardBody, CardHeader, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow } from '@heroui/react';
import { usePayrollStore } from '@/app/lib/hr/payrollStore';

export default function SalaryAnalyticsPanel() {
  const getAnalytics = usePayrollStore((s) => s.getPayrollAnalytics);
  const a = getAnalytics('monthly');

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="font-medium">Salary Analytics</div>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div className="p-3 bg-gray-50 rounded">
              <div className="text-xs text-gray-500">Total Payroll</div>
              <div className="text-xl font-semibold">{a.totalPayroll.toFixed(2)}</div>
            </div>
            <div className="p-3 bg-gray-50 rounded">
              <div className="text-xs text-gray-500">Total Gross</div>
              <div className="text-xl font-semibold">{a.totalGrossPay.toFixed(2)}</div>
            </div>
            <div className="p-3 bg-gray-50 rounded">
              <div className="text-xs text-gray-500">Total Deductions</div>
              <div className="text-xl font-semibold">{a.totalDeductions.toFixed(2)}</div>
            </div>
            <div className="p-3 bg-gray-50 rounded">
              <div className="text-xs text-gray-500">Average Salary</div>
              <div className="text-xl font-semibold">{a.averageSalary.toFixed(2)}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <div className="font-medium">Payroll by Department</div>
              </CardHeader>
              <CardBody>
                <Table aria-label="payroll-by-dept">
                  <TableHeader>
                    <TableColumn>DEPARTMENT</TableColumn>
                    <TableColumn>NET PAY</TableColumn>
                  </TableHeader>
                  <TableBody>
                    {Object.entries(a.payrollByDepartment).map(([dept, val]) => (
                      <TableRow key={dept}>
                        <TableCell>{dept}</TableCell>
                        <TableCell>{val.toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardBody>
            </Card>

            <Card>
              <CardHeader>
                <div className="font-medium">Deductions Breakdown</div>
              </CardHeader>
              <CardBody>
                <Table aria-label="deductions-breakdown">
                  <TableHeader>
                    <TableColumn>TYPE</TableColumn>
                    <TableColumn>AMOUNT</TableColumn>
                  </TableHeader>
                  <TableBody>
                    {Object.entries(a.deductionsBreakdown).map(([k, v]) => (
                      <TableRow key={k}>
                        <TableCell>{k}</TableCell>
                        <TableCell>{v.toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardBody>
            </Card>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}


