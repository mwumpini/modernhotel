'use client';

import React from 'react';
import { Button, Card, CardBody, CardHeader, Select, SelectItem } from '@heroui/react';
import { useLeaveAttendanceStore } from '@/app/lib/hr/leaveAttendanceStore';
import { useEmployeeStore } from '@/app/lib/hr/employeeStore';
import { leaveOn, todayKey } from '@/app/lib/hr/leaveDates';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MAX_NAMES = 3;

/** Month view of who is off each day, so a manager can see cover gaps at a glance. */
export default function LeaveCalendarTab() {
  const requests = useLeaveAttendanceStore((s) => s.leaveRequests);
  const employees = useEmployeeStore((s) => s.employees);
  const departments = useEmployeeStore((s) => s.departments);

  const [cursor, setCursor] = React.useState(() => { const n = new Date(); return { y: n.getFullYear(), m: n.getMonth() }; });
  const [dept, setDept] = React.useState('all');
  const today = todayKey();

  const staff = employees.filter((e) => e.status !== 'terminated' && e.status !== 'inactive' && (dept === 'all' || e.departmentId === dept));
  const daysInMonth = new Date(Date.UTC(cursor.y, cursor.m + 1, 0)).getUTCDate();
  const lead = (new Date(Date.UTC(cursor.y, cursor.m, 1)).getUTCDay() + 6) % 7; // Monday-first
  const p = (n: number) => String(n).padStart(2, '0');
  const cells: Array<string | null> = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => `${cursor.y}-${p(cursor.m + 1)}-${p(i + 1)}`),
  ];

  const move = (delta: number) => setCursor(({ y, m }) => { const d = new Date(y, m + delta, 1); return { y: d.getFullYear(), m: d.getMonth() }; });
  const monthLabel = new Date(cursor.y, cursor.m, 1).toLocaleString('en-GB', { month: 'long', year: 'numeric' });

  const offOn = (day: string) =>
    staff.flatMap((e) => {
      const r = leaveOn(requests, e.id, day, ['approved', 'pending']);
      return r ? [{ name: `${e.firstName} ${e.lastName}`, pending: r.status === 'pending', type: r.leaveType }] : [];
    });

  return (
    <Card>
      <CardHeader className="justify-between gap-2 flex-wrap">
        <div className="font-medium">Who's Off — {monthLabel}</div>
        <div className="flex items-center gap-2">
          <Select size="sm" aria-label="Department" className="w-48" variant="bordered" selectedKeys={[dept]} onSelectionChange={(k) => setDept(Array.from(k)[0] as string)}
            items={[{ id: 'all', name: 'All Departments' }, ...departments.map((d) => ({ id: d.id, name: d.name }))]}>
            {(item: any) => <SelectItem key={item.id}>{item.name}</SelectItem>}
          </Select>
          <Button size="sm" variant="flat" onPress={() => move(-1)}>‹</Button>
          <Button size="sm" variant="flat" onPress={() => { const n = new Date(); setCursor({ y: n.getFullYear(), m: n.getMonth() }); }}>Today</Button>
          <Button size="sm" variant="flat" onPress={() => move(1)}>›</Button>
        </div>
      </CardHeader>
      <CardBody>
        <div className="grid grid-cols-7 gap-1 text-xs">
          {WEEKDAYS.map((w) => <div key={w} className="text-center font-medium text-gray-500 py-1">{w}</div>)}
          {cells.map((day, i) => {
            if (!day) return <div key={`pad-${i}`} />;
            const off = offOn(day);
            return (
              <div key={day} className={`min-h-[84px] rounded border p-1 ${day === today ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white'}`}>
                <div className="flex justify-between text-gray-500">
                  <span>{Number(day.slice(8))}</span>
                  {off.length > 0 && <span className="text-[10px] font-medium text-amber-700">{off.length} off</span>}
                </div>
                <div className="space-y-0.5 mt-0.5">
                  {off.slice(0, MAX_NAMES).map((o) => (
                    <div key={o.name} title={`${o.name} — ${o.type}${o.pending ? ' (pending)' : ''}`}
                      className={`truncate rounded px-1 ${o.pending ? 'border border-dashed border-amber-400 text-amber-700' : 'bg-amber-100 text-amber-900'}`}>
                      {o.name}
                    </div>
                  ))}
                  {off.length > MAX_NAMES && <div className="text-gray-500 px-1">+{off.length - MAX_NAMES} more</div>}
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex gap-4 mt-3 text-xs text-gray-500">
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-amber-100" /> Approved</span>
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded border border-dashed border-amber-400" /> Pending approval</span>
        </div>
      </CardBody>
    </Card>
  );
}
