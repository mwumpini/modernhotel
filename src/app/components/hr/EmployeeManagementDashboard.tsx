'use client';

import React from 'react';
import { Card, CardHeader, CardBody, Chip, Tooltip } from '@heroui/react';
import { useEmployeeStore } from '@/app/lib/hr/employeeStore';
import { useEmployeeChangesStore } from '@/app/lib/hr/employeeChangesStore';
import { usePerformanceStore } from '@/app/lib/hr/performanceStore';

type SectionKey = 'records' | 'newHires' | 'changes' | 'reviews' | 'departments';

interface Props {
  onSelect?: (key: SectionKey) => void;
}

export default function EmployeeManagementDashboard({ onSelect }: Props) {
  const getEmployeeAnalytics = useEmployeeStore((s) => s.getEmployeeAnalytics);
  const employees = useEmployeeStore((s) => s.employees);
  const departments = useEmployeeStore((s) => s.departments);
  const positions = useEmployeeStore((s) => s.positions);
  const hydrateFromApi = useEmployeeStore((s) => s.hydrateFromApi);
  const changes = useEmployeeChangesStore((s) => s.changes);
  const reviews = usePerformanceStore((s) => s.reviews);

  // Load real persisted employees/departments/positions once on mount, replacing the
  // hardcoded in-memory seed.
  React.useEffect(() => {
    hydrateFromApi();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const analytics = React.useMemo(() => getEmployeeAnalytics('monthly'), [getEmployeeAnalytics, employees]);
  const activeEmployeesCount = React.useMemo(() => employees.filter((e) => e.status === 'active').length, [employees]);
  const changesCount = React.useMemo(() => {
    const since = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return changes.filter((c) => c.timestamp.getTime() >= since).length;
  }, [changes]);
  const pendingReviews = React.useMemo(() => reviews.filter((r) => r.status !== 'completed').length, [reviews]);

  const handleSelect = (key: SectionKey) => {
    console.log('[HR][Dashboard] navigate', { key });
    onSelect?.(key);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <Card isPressable onPress={() => handleSelect('records')}>
        <CardHeader className="justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">👥</span>
            <div className="font-medium">Employee Records</div>
            <Tooltip content="Total active employees">
              <span className="inline-flex w-4 h-4 items-center justify-center rounded-full bg-gray-200 text-gray-700 text-xs cursor-help">i</span>
            </Tooltip>
          </div>
          <Chip color="success" variant="flat">active</Chip>
        </CardHeader>
        <CardBody>
          <div className="text-3xl font-semibold">{activeEmployeesCount}</div>
          <div className="text-xs text-gray-500">Total: {analytics.totalEmployees}</div>
        </CardBody>
      </Card>

      <Card isPressable onPress={() => handleSelect('newHires')}>
        <CardHeader className="justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">📝</span>
            <div className="font-medium">New Hires</div>
            <Tooltip content="Hired in last 30 days">
              <span className="inline-flex w-4 h-4 items-center justify-center rounded-full bg-gray-200 text-gray-700 text-xs cursor-help">i</span>
            </Tooltip>
          </div>
          <Chip color="success" variant="flat">active</Chip>
        </CardHeader>
        <CardBody>
          <div className="text-3xl font-semibold">{analytics.newHires}</div>
          <div className="text-xs text-gray-500">Last 30 days</div>
        </CardBody>
      </Card>

      <Card isPressable onPress={() => handleSelect('changes')}>
        <CardHeader className="justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">🔄</span>
            <div className="font-medium">Employee Changes</div>
            <Tooltip content="Changes in last 30 days">
              <span className="inline-flex w-4 h-4 items-center justify-center rounded-full bg-gray-200 text-gray-700 text-xs cursor-help">i</span>
            </Tooltip>
          </div>
          <Chip color="success" variant="flat">active</Chip>
        </CardHeader>
        <CardBody>
          <div className="text-3xl font-semibold">{changesCount}</div>
          <div className="text-xs text-gray-500">Last 30 days</div>
        </CardBody>
      </Card>

      <Card isPressable onPress={() => handleSelect('reviews')}>
        <CardHeader className="justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">📊</span>
            <div className="font-medium">Performance Reviews</div>
            <Tooltip content="Open or in-progress reviews">
              <span className="inline-flex w-4 h-4 items-center justify-center rounded-full bg-gray-200 text-gray-700 text-xs cursor-help">i</span>
            </Tooltip>
          </div>
          <Chip color="success" variant="flat">active</Chip>
        </CardHeader>
        <CardBody>
          <div className="text-3xl font-semibold">{pendingReviews}</div>
          <div className="text-xs text-gray-500">Open reviews</div>
        </CardBody>
      </Card>

      <Card isPressable onPress={() => handleSelect('departments')}>
        <CardHeader className="justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">🏢</span>
            <div className="font-medium">Departments &amp; Positions</div>
            <Tooltip content="Manage the Department/Position options used on New Staff and Settings → User Management">
              <span className="inline-flex w-4 h-4 items-center justify-center rounded-full bg-gray-200 text-gray-700 text-xs cursor-help">i</span>
            </Tooltip>
          </div>
          <Chip color="success" variant="flat">active</Chip>
        </CardHeader>
        <CardBody>
          <div className="text-3xl font-semibold">{departments.length}</div>
          <div className="text-xs text-gray-500">{positions.length} position{positions.length !== 1 ? 's' : ''}</div>
        </CardBody>
      </Card>
    </div>
  );
}


