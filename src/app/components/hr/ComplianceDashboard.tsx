'use client';

import React from 'react';
import { Card, CardHeader, CardBody, Chip, Tooltip } from '@heroui/react';
import { useComplianceStore } from '@/app/lib/compliance/store';
import { useTrainingStore } from '@/app/lib/hr/trainingStore';
import { useEmployeeStore } from '@/app/lib/hr/employeeStore';
import { computeLaborCompliance } from '@/app/lib/hr/laborCompliance';

type SectionKey = 'tax' | 'training' | 'labor' | 'reports';

export default function ComplianceDashboard({ onSelect }: { onSelect?: (k: SectionKey) => void }) {
  const score = useComplianceStore((s) => s.getComplianceScore());
  const reportCount = useComplianceStore(
    (s) => s.reports.filter((report) => report.countryCode === s.country).length
  );
  const programs = useTrainingStore((s) => s.programs);
  const enrollments = useTrainingStore((s) => s.enrollments);
  const employees = useEmployeeStore((s) => s.employees);
  // Same computeLaborCompliance() LaborCompliancePanel.tsx uses -- this tile and that panel
  // must never disagree on the score, so there's exactly one implementation of it.
  const laborScore = React.useMemo(
    () => computeLaborCompliance(employees, programs, enrollments).score,
    [employees, programs, enrollments]
  );

  const go = (k: SectionKey) => onSelect?.(k);

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <Card isPressable onPress={() => go('tax')}>
        <CardHeader className="justify-between">
          <div className="flex items-center gap-2"><span className="text-xl">📋</span><div className="font-medium">Tax Compliance</div><Tooltip content="Score based on reports & rules"><span className="inline-flex w-4 h-4 items-center justify-center rounded-full bg-gray-200 text-gray-700 text-xs cursor-help">i</span></Tooltip></div>
          <Chip color="success" variant="flat">active</Chip>
        </CardHeader>
        <CardBody>
          <div className="text-3xl font-semibold">{score}</div>
          <div className="text-xs text-gray-500">Compliance Score</div>
        </CardBody>
      </Card>

      <Card isPressable onPress={() => go('training')}>
        <CardHeader className="justify-between">
          <div className="flex items-center gap-2"><span className="text-xl">🎓</span><div className="font-medium">Training Programs</div><Tooltip content="Active programs"><span className="inline-flex w-4 h-4 items-center justify-center rounded-full bg-gray-200 text-gray-700 text-xs cursor-help">i</span></Tooltip></div>
          <Chip color="success" variant="flat">active</Chip>
        </CardHeader>
        <CardBody>
          <div className="text-3xl font-semibold">{programs.length}</div>
          <div className="text-xs text-gray-500">Programs</div>
        </CardBody>
      </Card>

      <Card isPressable onPress={() => go('labor')}>
        <CardHeader className="justify-between">
          <div className="flex items-center gap-2"><span className="text-xl">🔒</span><div className="font-medium">Labor Compliance</div><Tooltip content="Checklist status"><span className="inline-flex w-4 h-4 items-center justify-center rounded-full bg-gray-200 text-gray-700 text-xs cursor-help">i</span></Tooltip></div>
          <Chip color="success" variant="flat">active</Chip>
        </CardHeader>
        <CardBody>
          <div className="text-3xl font-semibold">{laborScore}</div>
          <div className="text-xs text-gray-500">Score</div>
        </CardBody>
      </Card>

      <Card isPressable onPress={() => go('reports')}>
        <CardHeader className="justify-between">
          <div className="flex items-center gap-2"><span className="text-xl">📊</span><div className="font-medium">Compliance Reports</div><Tooltip content="Active reports"><span className="inline-flex w-4 h-4 items-center justify-center rounded-full bg-gray-200 text-gray-700 text-xs cursor-help">i</span></Tooltip></div>
          <Chip color="success" variant="flat">active</Chip>
        </CardHeader>
        <CardBody>
          <div className="text-3xl font-semibold">{reportCount}</div>
          <div className="text-xs text-gray-500">Reports</div>
        </CardBody>
      </Card>
    </div>
  );
}


