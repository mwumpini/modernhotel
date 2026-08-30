'use client';

import React from 'react';
import { Card, CardHeader, CardBody, Chip, Tooltip } from '@heroui/react';
import { usePayrollStore } from '@/app/lib/hr/payrollStore';
import { useBenefitsStore } from '@/app/lib/hr/benefitsStore';

type SectionKey = 'processing' | 'payslips' | 'benefits' | 'analytics';

interface Props {
  onSelect?: (key: SectionKey) => void;
}

export default function PayrollManagementDashboard({ onSelect }: Props) {
  const periods = usePayrollStore((s) => s.payrollPeriods);
  const records = usePayrollStore((s) => s.payrollRecords);
  const hydrateFromApi = usePayrollStore((s) => s.hydrateFromApi);
  const getSummary = useBenefitsStore((s) => s.getSummary);

  React.useEffect(() => {
    hydrateFromApi();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const processingActive = periods.filter((p) => ['draft', 'processing', 'approved'].includes(p.status)).length;
  const payslipsCount = records.length; // generated count placeholder
  const benefitsActive = React.useMemo(() => getSummary().activeEnrollments, [getSummary, periods, records]);

  const handleSelect = (key: SectionKey) => {
    console.log('[HR][PayrollDashboard] navigate', { key });
    onSelect?.(key);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <Card isPressable onPress={() => handleSelect('processing')}>
        <CardHeader className="justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">💰</span>
            <div className="font-medium">Payroll Processing</div>
            <Tooltip content="Open or draft payroll periods">
              <span className="inline-flex w-4 h-4 items-center justify-center rounded-full bg-gray-200 text-gray-700 text-xs cursor-help">i</span>
            </Tooltip>
          </div>
          <Chip color="success" variant="flat">active</Chip>
        </CardHeader>
        <CardBody>
          <div className="text-3xl font-semibold">{processingActive}</div>
          <div className="text-xs text-gray-500">Open periods</div>
        </CardBody>
      </Card>

      <Card isPressable onPress={() => handleSelect('payslips')}>
        <CardHeader className="justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">🧾</span>
            <div className="font-medium">Payslip Generation</div>
            <Tooltip content="Payslips per period">
              <span className="inline-flex w-4 h-4 items-center justify-center rounded-full bg-gray-200 text-gray-700 text-xs cursor-help">i</span>
            </Tooltip>
          </div>
          <Chip color="success" variant="flat">active</Chip>
        </CardHeader>
        <CardBody>
          <div className="text-3xl font-semibold">{payslipsCount}</div>
          <div className="text-xs text-gray-500">Total records</div>
        </CardBody>
      </Card>

      <Card isPressable onPress={() => handleSelect('benefits')}>
        <CardHeader className="justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">💳</span>
            <div className="font-medium">Benefits Management</div>
            <Tooltip content="Active employee enrollments">
              <span className="inline-flex w-4 h-4 items-center justify-center rounded-full bg-gray-200 text-gray-700 text-xs cursor-help">i</span>
            </Tooltip>
          </div>
          <Chip color="success" variant="flat">active</Chip>
        </CardHeader>
        <CardBody>
          <div className="text-3xl font-semibold">{benefitsActive}</div>
          <div className="text-xs text-gray-500">Active enrollments</div>
        </CardBody>
      </Card>

      <Card isPressable onPress={() => handleSelect('analytics')}>
        <CardHeader className="justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">📈</span>
            <div className="font-medium">Salary Analytics</div>
            <Tooltip content="Payroll insights">
              <span className="inline-flex w-4 h-4 items-center justify-center rounded-full bg-gray-200 text-gray-700 text-xs cursor-help">i</span>
            </Tooltip>
          </div>
          <Chip color="success" variant="flat">active</Chip>
        </CardHeader>
        <CardBody>
          <div className="text-3xl font-semibold">—</div>
          <div className="text-xs text-gray-500">View insights</div>
        </CardBody>
      </Card>
    </div>
  );
}


