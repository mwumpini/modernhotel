'use client';

import React from 'react';
import { Card, CardBody, CardHeader, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow } from '@heroui/react';
import { usePayrollStore } from '@/app/lib/hr/payrollStore';
import { useTrainingStore } from '@/app/lib/hr/trainingStore';
import { useEmployeeStore } from '@/app/lib/hr/employeeStore';

export default function SalaryAnalyticsPanel() {
  const getAnalytics = usePayrollStore((s) => s.getPayrollAnalytics);
  const a = getAnalytics();
  const trainingEnrollments = useTrainingStore((s) => s.enrollments);
  const employees = useEmployeeStore((s) => s.employees);
  const getDepartment = useEmployeeStore((s) => s.getDepartment);

  const totalTrainingCost = trainingEnrollments.reduce((sum, r) => sum + (r.cost || 0), 0);
  const trainingCostByDepartment = React.useMemo(() => {
    const byEmployee = new Map(employees.map((e) => [e.id, e.departmentId]));
    const out: Record<string, number> = {};
    for (const r of trainingEnrollments) {
      const deptId = byEmployee.get(r.employeeId);
      const deptName = deptId ? (getDepartment(deptId)?.name || deptId) : 'Unassigned';
      out[deptName] = (out[deptName] || 0) + (r.cost || 0);
    }
    return out;
  }, [trainingEnrollments, employees, getDepartment]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="font-medium">Salary Analytics</div>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
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
            <div className="p-3 bg-gray-50 rounded">
              <div className="text-xs text-gray-500">Total Training Cost</div>
              <div className="text-xl font-semibold">{totalTrainingCost.toFixed(2)}</div>
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

            <Card>
              <CardHeader>
                <div className="font-medium">Training Cost by Department</div>
              </CardHeader>
              <CardBody>
                <Table aria-label="training-cost-by-dept">
                  <TableHeader>
                    <TableColumn>DEPARTMENT</TableColumn>
                    <TableColumn>TRAINING COST</TableColumn>
                  </TableHeader>
                  <TableBody>
                    {Object.entries(trainingCostByDepartment).map(([dept, val]) => (
                      <TableRow key={dept}>
                        <TableCell>{dept}</TableCell>
                        <TableCell>{val.toFixed(2)}</TableCell>
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


