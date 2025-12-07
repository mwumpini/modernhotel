'use client';

import React from 'react';
import { Card, CardHeader, CardBody, Chip, Tooltip } from '@heroui/react';
import { useLeaveAttendanceStore } from '@/app/lib/hr/leaveAttendanceStore';

type SectionKey = 'leave' | 'time' | 'shifts' | 'overtime';

interface Props { onSelect?: (key: SectionKey) => void; }

export default function LeaveAttendanceDashboard({ onSelect }: Props) {
  const pendingLeaves = useLeaveAttendanceStore((s) => s.getPendingLeaveCount());
  const onClock = useLeaveAttendanceStore((s) => s.getActiveEmployeesOnClock());
  const upcomingShifts = useLeaveAttendanceStore((s) => s.getUpcomingShiftCount());
  const openOvertime = useLeaveAttendanceStore((s) => s.getOpenOvertimeCount());

  const go = (k: SectionKey) => onSelect?.(k);

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <Card isPressable onPress={() => go('leave')}>
        <CardHeader className="justify-between">
          <div className="flex items-center gap-2"><span className="text-xl">🌴</span><div className="font-medium">Leave Management</div><Tooltip content="Pending requests"><span className="inline-flex w-4 h-4 items-center justify-center rounded-full bg-gray-200 text-gray-700 text-xs cursor-help">i</span></Tooltip></div>
          <Chip color="success" variant="flat">active</Chip>
        </CardHeader>
        <CardBody>
          <div className="text-3xl font-semibold">{pendingLeaves}</div>
          <div className="text-xs text-gray-500">Pending</div>
        </CardBody>
      </Card>

      <Card isPressable onPress={() => go('time')}>
        <CardHeader className="justify-between">
          <div className="flex items-center gap-2"><span className="text-xl">⏰</span><div className="font-medium">Time Tracking</div><Tooltip content="Currently clocked in"><span className="inline-flex w-4 h-4 items-center justify-center rounded-full bg-gray-200 text-gray-700 text-xs cursor-help">i</span></Tooltip></div>
          <Chip color="success" variant="flat">active</Chip>
        </CardHeader>
        <CardBody>
          <div className="text-3xl font-semibold">{onClock}</div>
          <div className="text-xs text-gray-500">Clocked In</div>
        </CardBody>
      </Card>

      <Card isPressable onPress={() => go('shifts')}>
        <CardHeader className="justify-between">
          <div className="flex items-center gap-2"><span className="text-xl">📅</span><div className="font-medium">Shift Scheduling</div><Tooltip content="Upcoming shifts"><span className="inline-flex w-4 h-4 items-center justify-center rounded-full bg-gray-200 text-gray-700 text-xs cursor-help">i</span></Tooltip></div>
          <Chip color="success" variant="flat">active</Chip>
        </CardHeader>
        <CardBody>
          <div className="text-3xl font-semibold">{upcomingShifts}</div>
          <div className="text-xs text-gray-500">Upcoming</div>
        </CardBody>
      </Card>

      <Card isPressable onPress={() => go('overtime')}>
        <CardHeader className="justify-between">
          <div className="flex items-center gap-2"><span className="text-xl">🚨</span><div className="font-medium">Overtime Management</div><Tooltip content="Open overtime entries"><span className="inline-flex w-4 h-4 items-center justify-center rounded-full bg-gray-200 text-gray-700 text-xs cursor-help">i</span></Tooltip></div>
          <Chip color="success" variant="flat">active</Chip>
        </CardHeader>
        <CardBody>
          <div className="text-3xl font-semibold">{openOvertime}</div>
          <div className="text-xs text-gray-500">Open</div>
        </CardBody>
      </Card>
    </div>
  );
}


