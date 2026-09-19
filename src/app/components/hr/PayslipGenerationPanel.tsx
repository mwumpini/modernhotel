'use client';

import React from 'react';
import { Button, Card, CardBody, CardHeader, Select, SelectItem } from '@heroui/react';
import { usePayrollStore, payrollRecordLabels } from '@/app/lib/hr/payrollStore';
import { useEmployeeStore } from '@/app/lib/hr/employeeStore';
import { useSettingsStore } from '@/app/lib/settings/store';
import { openPrintPreview } from '@/app/lib/print/engine';
import { buildOrgProfile } from '@/app/lib/print/buildOrgProfile';
import type { PrintData } from '@/app/lib/print/templates';

export default function PayslipGenerationPanel() {
  const periods = usePayrollStore((s) => s.payrollPeriods);
  const records = usePayrollStore((s) => s.payrollRecords);

  const [periodId, setPeriodId] = React.useState<string>(periods[0]?.id || '');
  const periodRecords = records.filter((r) => r.payrollPeriodId === periodId);
  const [recordId, setRecordId] = React.useState<string>(periodRecords[0]?.id || '');

  const record = records.find((r) => r.id === recordId);
  const period = periods.find((p) => p.id === periodId);
  const labels = record ? payrollRecordLabels(record) : undefined;

  const generate = () => {
    if (!record) return;
    const monthLabel = period
      ? new Date(period.startDate).toLocaleString('en-US', { month: 'long', year: 'numeric' })
      : new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' });
    const settings = useSettingsStore.getState();
    const org = buildOrgProfile(settings);
    const employee = useEmployeeStore.getState().getEmployee(record.employeeId);

    // Same composition as the on-screen preview below, so the printed payslip
    // never shows a different total than what was just previewed.
    const data: PrintData = {
      org,
      guest: { name: record.employeeName },
      employee: {
        name: record.employeeName,
        employeeNumber: record.employeeNumber,
        position: labels?.position ?? record.position,
        department: labels?.department ?? record.department,
        payPeriod: monthLabel,
        dateOfJoining: employee?.hireDate ? new Date(employee.hireDate).toISOString() : undefined,
      },
      docDate: new Date().toISOString(),
      title: 'Payslip',
      items: [],
      totals: { subTotal: 0 },
      earningsItems: [
        { description: 'Basic Salary', amount: record.basicSalary },
        { description: 'Allowances', amount: record.allowances },
        { description: 'Overtime', amount: record.overtimePay },
        { description: 'Bonuses', amount: record.bonuses },
      ].filter((it) => it.amount),
      deductionsItems: [
        { description: 'Tax (PAYE)', amount: record.deductions.tax },
        { description: 'Social Security (SSNIT)', amount: record.deductions.socialSecurity },
        { description: 'Health Insurance', amount: record.deductions.healthInsurance },
        { description: 'Pension', amount: record.deductions.pension },
        { description: 'Provident Fund (Tier 3)', amount: record.deductions.tier3 || 0 },
        { description: 'Other Deductions', amount: record.deductions.other },
      ].filter((it) => it.amount),
      bankDetails: { accountNumber: record.bankAccount },
      footerNotes: ['This is a system generated payslip.'],
      currency: '₵',
    };
    openPrintPreview('payslip', settings.printing.payslip, data);
  };

  React.useEffect(() => {
    const prs = records.filter((r) => r.payrollPeriodId === periodId);
    if (prs.length > 0) setRecordId(prs[0].id);
  }, [periodId, records]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="justify-between">
          <div className="font-medium">Payslip Generation</div>
          <div className="flex items-center gap-2">
            <Select size="sm" selectedKeys={[periodId]} onSelectionChange={(k) => setPeriodId(Array.from(k)[0] as string)} className="w-48" variant="bordered" aria-label="Period">
              {periods.map((p) => <SelectItem key={p.id}>{p.periodNumber}</SelectItem>)}
            </Select>
            <Select size="sm" selectedKeys={[recordId]} onSelectionChange={(k) => setRecordId(Array.from(k)[0] as string)} className="w-64" variant="bordered" aria-label="Employee">
              {periodRecords.map((r) => <SelectItem key={r.id}>{r.employeeName}</SelectItem>)}
            </Select>
            <Button color="primary" onPress={generate} isDisabled={!periodId || !recordId}>Generate Payslip</Button>
          </div>
        </CardHeader>
        <CardBody>
          {!record && <div className="text-sm text-gray-600">Select a period and employee to preview payslip.</div>}
          {record && (
            <div className="border rounded p-4 space-y-2 bg-white">
              <div className="text-lg font-semibold">Payslip</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                <div>Employee: <span className="font-medium">{record.employeeName}</span></div>
                <div>Department: {labels?.department}</div>
                <div>Position: {labels?.position}</div>
                <div>Payment Method: {record.paymentMethod}</div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-2 text-sm mt-2">
                <div>Basic Salary: {record.basicSalary.toFixed(2)}</div>
                <div>Allowances: {record.allowances.toFixed(2)}</div>
                <div>Overtime: {record.overtimePay.toFixed(2)}</div>
                <div>Bonuses: {record.bonuses.toFixed(2)}</div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-2 text-sm">
                <div>Gross: <span className="font-medium">{record.grossPay.toFixed(2)}</span></div>
                <div>Tax: {record.deductions.tax.toFixed(2)}</div>
                <div>Other Deductions: {(
                  record.deductions.socialSecurity + record.deductions.healthInsurance + record.deductions.pension + record.deductions.other
                ).toFixed(2)}</div>
                <div>Net: <span className="font-semibold">{record.netPay.toFixed(2)}</span></div>
              </div>
              <div className="text-xs text-gray-500">Bank: {record.bankAccount}</div>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}


