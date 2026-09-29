'use client';

import React from 'react';
import { Card, CardBody, CardHeader, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow } from '@heroui/react';
import { usePayrollStore } from '@/app/lib/hr/payrollStore';
import { useTrainingStore } from '@/app/lib/hr/trainingStore';
import { useEmployeeStore } from '@/app/lib/hr/employeeStore';
import { formatMoney } from '@/app/lib/format/currency';
import { SortLabel, deskResizableTableClassNames, useResizableColumns } from '../frontoffice/columnResize';

type DeptPaySortKey = 'dept' | 'net';
type DeductionSortKey = 'type' | 'amount';
type TrainingCostSortKey = 'dept' | 'cost';

const deptPayWidths: Record<DeptPaySortKey, number> = { dept: 200, net: 120 };
const deductionWidths: Record<DeductionSortKey, number> = { type: 200, amount: 120 };
const trainingCostWidths: Record<TrainingCostSortKey, number> = { dept: 200, cost: 120 };

function useSortedRows<T>(
  rows: T[],
  sortKey: string,
  sortDir: 'asc' | 'desc',
  value: (row: T) => string | number,
) {
  return React.useMemo(() => {
    const sorted = [...rows].sort((a, b) => {
      const av = value(a);
      const bv = value(b);
      if (av < bv) return -1;
      if (av > bv) return 1;
      return 0;
    });
    return sortDir === 'asc' ? sorted : sorted.reverse();
  }, [rows, sortKey, sortDir, value]);
}

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

  const deptPayCols = useResizableColumns<DeptPaySortKey>(deptPayWidths);
  const deductCols = useResizableColumns<DeductionSortKey>(deductionWidths);
  const trainCols = useResizableColumns<TrainingCostSortKey>(trainingCostWidths);

  const [deptPaySort, setDeptPaySort] = React.useState<{ key: DeptPaySortKey; dir: 'asc' | 'desc' }>({ key: 'dept', dir: 'asc' });
  const [deductSort, setDeductSort] = React.useState<{ key: DeductionSortKey; dir: 'asc' | 'desc' }>({ key: 'type', dir: 'asc' });
  const [trainSort, setTrainSort] = React.useState<{ key: TrainingCostSortKey; dir: 'asc' | 'desc' }>({ key: 'dept', dir: 'asc' });

  const deptPayRows = React.useMemo(() => Object.entries(a.payrollByDepartment).map(([dept, val]) => ({ dept, val })), [a.payrollByDepartment]);
  const deductRows = React.useMemo(() => Object.entries(a.deductionsBreakdown).map(([type, amount]) => ({ type, amount })), [a.deductionsBreakdown]);
  const trainRows = React.useMemo(() => Object.entries(trainingCostByDepartment).map(([dept, cost]) => ({ dept, cost })), [trainingCostByDepartment]);

  const sortedDeptPay = useSortedRows(deptPayRows, deptPaySort.key, deptPaySort.dir, (r) =>
    deptPaySort.key === 'net' ? r.val : r.dept.toLowerCase(),
  );
  const sortedDeduct = useSortedRows(deductRows, deductSort.key, deductSort.dir, (r) =>
    deductSort.key === 'amount' ? r.amount : r.type.toLowerCase(),
  );
  const sortedTrain = useSortedRows(trainRows, trainSort.key, trainSort.dir, (r) =>
    trainSort.key === 'cost' ? r.cost : r.dept.toLowerCase(),
  );

  const toggleSort = <K extends string>(current: { key: K; dir: 'asc' | 'desc' }, key: K, set: React.Dispatch<React.SetStateAction<{ key: K; dir: 'asc' | 'desc' }>>) => {
    if (current.key === key) set({ key, dir: current.dir === 'asc' ? 'desc' : 'asc' });
    else set({ key, dir: 'asc' });
  };

  const mkColumn = <K extends string>(
    cols: ReturnType<typeof useResizableColumns<K>>,
    sort: { key: K; dir: 'asc' | 'desc' },
    setSort: React.Dispatch<React.SetStateAction<{ key: K; dir: 'asc' | 'desc' }>>,
    key: K,
    label: string,
    align: 'left' | 'right' | 'center' = 'left',
  ) => (
    <TableColumn key={key} className="relative" style={cols.style(key)}>
      <SortLabel active={sort.key === key} dir={sort.dir} align={align} onPress={() => toggleSort(sort, key, setSort)}>{label}</SortLabel>
      {cols.sizer(key, label)}
    </TableColumn>
  );

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
              <div className="text-xl font-semibold tabular-nums">{formatMoney(a.totalPayroll)}</div>
            </div>
            <div className="p-3 bg-gray-50 rounded">
              <div className="text-xs text-gray-500">Total Gross</div>
              <div className="text-xl font-semibold tabular-nums">{formatMoney(a.totalGrossPay)}</div>
            </div>
            <div className="p-3 bg-gray-50 rounded">
              <div className="text-xs text-gray-500">Total Deductions</div>
              <div className="text-xl font-semibold tabular-nums">{formatMoney(a.totalDeductions)}</div>
            </div>
            <div className="p-3 bg-gray-50 rounded">
              <div className="text-xs text-gray-500">Average Salary</div>
              <div className="text-xl font-semibold tabular-nums">{formatMoney(a.averageSalary)}</div>
            </div>
            <div className="p-3 bg-gray-50 rounded">
              <div className="text-xs text-gray-500">Total Training Cost</div>
              <div className="text-xl font-semibold tabular-nums">{formatMoney(totalTrainingCost)}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <div className="font-medium">Payroll by Department</div>
              </CardHeader>
              <CardBody>
                <div ref={deptPayCols.frameRef} style={deptPayCols.frameStyle}>
                  <Table aria-label="payroll-by-dept" removeWrapper classNames={deskResizableTableClassNames()}>
                    <TableHeader>
                      {mkColumn(deptPayCols, deptPaySort, setDeptPaySort, 'dept', 'Department')}
                      {mkColumn(deptPayCols, deptPaySort, setDeptPaySort, 'net', 'Net pay', 'right')}
                    </TableHeader>
                    <TableBody emptyContent="No payroll data by department.">
                      {sortedDeptPay.map((row) => (
                        <TableRow key={row.dept}>
                          <TableCell><span className="block truncate" title={row.dept}>{row.dept}</span></TableCell>
                          <TableCell className="text-right tabular-nums">{formatMoney(row.val)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardHeader>
                <div className="font-medium">Deductions Breakdown</div>
              </CardHeader>
              <CardBody>
                <div ref={deductCols.frameRef} style={deductCols.frameStyle}>
                  <Table aria-label="deductions-breakdown" removeWrapper classNames={deskResizableTableClassNames()}>
                    <TableHeader>
                      {mkColumn(deductCols, deductSort, setDeductSort, 'type', 'Type')}
                      {mkColumn(deductCols, deductSort, setDeductSort, 'amount', 'Amount', 'right')}
                    </TableHeader>
                    <TableBody emptyContent="No deductions recorded.">
                      {sortedDeduct.map((row) => (
                        <TableRow key={row.type}>
                          <TableCell><span className="block truncate" title={row.type}>{row.type}</span></TableCell>
                          <TableCell className="text-right tabular-nums">{formatMoney(row.amount)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardHeader>
                <div className="font-medium">Training Cost by Department</div>
              </CardHeader>
              <CardBody>
                <div ref={trainCols.frameRef} style={trainCols.frameStyle}>
                  <Table aria-label="training-cost-by-dept" removeWrapper classNames={deskResizableTableClassNames()}>
                    <TableHeader>
                      {mkColumn(trainCols, trainSort, setTrainSort, 'dept', 'Department')}
                      {mkColumn(trainCols, trainSort, setTrainSort, 'cost', 'Training cost', 'right')}
                    </TableHeader>
                    <TableBody emptyContent="No training cost by department.">
                      {sortedTrain.map((row) => (
                        <TableRow key={row.dept}>
                          <TableCell><span className="block truncate" title={row.dept}>{row.dept}</span></TableCell>
                          <TableCell className="text-right tabular-nums">{formatMoney(row.cost)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardBody>
            </Card>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
