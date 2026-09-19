'use client';

import React from 'react';
import { Card, CardHeader, CardBody, Tooltip } from '@heroui/react';
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
  const getPayrollAnalytics = usePayrollStore((s) => s.getPayrollAnalytics);
  const getSummary = useBenefitsStore((s) => s.getSummary);

  React.useEffect(() => {
    hydrateFromApi();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const benefitsActive = React.useMemo(() => getSummary().activeEnrollments, [getSummary, periods, records]);
  const totalPaid = React.useMemo(() => getPayrollAnalytics().totalPayroll, [getPayrollAnalytics, records]);

  const cards: Array<{ key: SectionKey; icon: string; title: string; tip: string; value: string | number; caption: string }> = [
    { key: 'processing', icon: '💰', title: 'Payroll Processing', tip: 'Payroll periods run so far', value: periods.length, caption: 'Periods processed' },
    { key: 'payslips', icon: '🧾', title: 'Payslip Generation', tip: 'Payslips per period', value: records.length, caption: 'Total payslips' },
    { key: 'benefits', icon: '💳', title: 'Benefits Management', tip: 'Active employee enrollments', value: benefitsActive, caption: 'Active enrollments' },
    { key: 'analytics', icon: '📈', title: 'Salary Analytics', tip: 'Payroll insights', value: `₵${totalPaid.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, caption: 'Net pay paid out' },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      {cards.map((c) => (
        <Card key={c.key} isPressable onPress={() => onSelect?.(c.key)}>
          <CardHeader>
            <div className="flex items-center gap-2">
              <span className="text-xl">{c.icon}</span>
              <div className="font-medium">{c.title}</div>
              <Tooltip content={c.tip}>
                <span className="inline-flex w-4 h-4 items-center justify-center rounded-full bg-gray-200 text-gray-700 text-xs cursor-help">i</span>
              </Tooltip>
            </div>
          </CardHeader>
          <CardBody>
            <div className="text-3xl font-semibold">{c.value}</div>
            <div className="text-xs text-gray-500">{c.caption}</div>
          </CardBody>
        </Card>
      ))}
    </div>
  );
}
