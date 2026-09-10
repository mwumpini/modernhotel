'use client';

import React from 'react';
import { Button, Card, CardBody, CardHeader, Select, SelectItem } from '@heroui/react';
import { usePayrollStore } from '@/app/lib/hr/payrollStore';
import { useSettingsStore } from '@/app/lib/settings/store';
import { generatePayslipsPDF, type PayslipRow } from '@/app/lib/hr/payrollPdf';

export default function PayslipGenerationPanel() {
  const periods = usePayrollStore((s) => s.payrollPeriods);
  const records = usePayrollStore((s) => s.payrollRecords);
  const hotelName = useSettingsStore((s) => s.hotelSettings.hotelName) || 'Hotel';

  const [periodId, setPeriodId] = React.useState<string>(periods[0]?.id || '');
  const periodRecords = records.filter((r) => r.payrollPeriodId === periodId);
  const [recordId, setRecordId] = React.useState<string>(periodRecords[0]?.id || '');

  const record = records.find((r) => r.id === recordId);
  const period = periods.find((p) => p.id === periodId);

  const generate = async () => {
    if (!record) return;
    const monthLabel = period
      ? new Date(period.startDate).toLocaleString('en-US', { month: 'long', year: 'numeric' })
      : new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' });
    // Same composition as the on-screen preview below, so the PDF never shows a different
    // total than what was just previewed.
    const otherDeductions =
      record.deductions.socialSecurity + record.deductions.healthInsurance + record.deductions.pension + record.deductions.other;
    const rows: PayslipRow[] = [
      { label: 'Basic Salary', value: record.basicSalary.toFixed(2) },
      { label: 'Allowances', value: record.allowances.toFixed(2) },
      { label: 'Overtime', value: record.overtimePay.toFixed(2) },
      { label: 'Bonuses', value: record.bonuses.toFixed(2) },
      { label: 'Gross Pay', value: record.grossPay.toFixed(2) },
      { label: 'Tax (PAYE)', value: record.deductions.tax.toFixed(2) },
      { label: 'Other Deductions', value: otherDeductions.toFixed(2) },
      { label: 'Net Pay', value: record.netPay.toFixed(2) },
      { label: 'Payment Method', value: record.paymentMethod },
      { label: 'Bank Account', value: record.bankAccount || '-' },
    ];
    await generatePayslipsPDF({
      slips: [
        {
          hotelName,
          monthLabel,
          employeeName: record.employeeName,
          position: record.position,
          rows,
        },
      ],
      fileName: `Payslip_${record.employeeName.replace(/\s+/g, '_')}_${monthLabel.replace(/\s+/g, '_')}.pdf`,
    });
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
                <div>Department: {record.department}</div>
                <div>Position: {record.position}</div>
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


