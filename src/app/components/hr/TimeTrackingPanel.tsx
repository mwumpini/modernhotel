'use client';

import React from 'react';
import { Button, Card, CardBody, CardHeader, Chip, Select, SelectItem, Tab, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow, Tabs } from '@heroui/react';
import { useLeaveAttendanceStore } from '@/app/lib/hr/leaveAttendanceStore';
import { useEmployeeStore } from '@/app/lib/hr/employeeStore';
import { leaveOn, todayKey } from '@/app/lib/hr/leaveDates';
import { isLate, minutesOfDay, pastGrace, shiftOn } from '@/app/lib/hr/attendanceStatus';
import { useSectionExport } from '@/app/lib/export/useSectionExport';
import ExportButtons from '@/app/components/ExportButtons';
import type { ExportFormat } from '@/app/lib/frontoffice/reportExportFormat';

type TodayState = 'leave' | 'on_duty' | 'done' | 'no_show' | 'expected';
const STATE_CHIP: Record<TodayState, { label: string; color: 'default' | 'success' | 'warning' | 'danger' | 'primary' }> = {
  leave: { label: 'On leave', color: 'default' },
  on_duty: { label: 'On duty', color: 'primary' },
  done: { label: 'Completed', color: 'success' },
  no_show: { label: 'No-show', color: 'danger' },
  expected: { label: 'Expected', color: 'warning' },
};

const localDay = (d: Date | string) => todayKey(new Date(d));
const fmtTime = (d?: Date | string) => (d ? new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '-');

export default function TimeTrackingPanel() {
  const attendances = useLeaveAttendanceStore((s) => s.attendances);
  const shifts = useLeaveAttendanceStore((s) => s.shifts);
  const leaveRequests = useLeaveAttendanceStore((s) => s.leaveRequests);
  const clockIn = useLeaveAttendanceStore((s) => s.clockIn);
  const clockOut = useLeaveAttendanceStore((s) => s.clockOut);
  const employees = useEmployeeStore((s) => s.employees);
  const exportSection = useSectionExport();

  const [employeeId, setEmployeeId] = React.useState<string>(employees[0]?.id || '');
  const [now, setNow] = React.useState(() => new Date());
  React.useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);
  const [month, setMonth] = React.useState(() => todayKey().slice(0, 7)); // YYYY-MM

  const staff = employees.filter((e) => e.status !== 'terminated' && e.status !== 'inactive');
  const nameOf = (id: string) => { const e = employees.find((x) => x.id === id); return e ? `${e.firstName} ${e.lastName}` : id; };
  const today = todayKey(now);

  // ---- Today: everyone rostered, on leave or already clocked today ----
  const attendanceOn = (id: string, day: string) => attendances.find((a) => a.employeeId === id && localDay(a.date) === day);
  const todayRows = staff.flatMap((e) => {
    const shift = shiftOn(shifts, e.id, today);
    const att = attendanceOn(e.id, today);
    const leave = leaveOn(leaveRequests, e.id, today);
    if (!shift && !att && !leave) return [];
    let state: TodayState;
    if (leave && !att) state = 'leave';
    else if (att?.checkOutTime) state = 'done';
    else if (att?.checkInTime) state = 'on_duty';
    else if (shift && pastGrace(shift, minutesOfDay(now))) state = 'no_show';
    else state = 'expected';
    return [{ e, shift, att, state, late: isLate(att?.checkInTime, shift) }];
  });

  // ---- Monthly summary ----
  const monthDays = (() => {
    const [y, m] = month.split('-').map(Number);
    const n = new Date(Date.UTC(y, m, 0)).getUTCDate();
    return Array.from({ length: n }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`);
  })();
  const summary = staff.map((e) => {
    const scheduled = monthDays.filter((d) => shiftOn(shifts, e.id, d));
    const monthAtt = attendances.filter((a) => a.employeeId === e.id && localDay(a.date).startsWith(month));
    const presentDates = new Set(monthAtt.filter((a) => a.checkInTime).map((a) => localDay(a.date)));
    const late = [...presentDates].filter((d) => isLate(attendanceOn(e.id, d)?.checkInTime, shiftOn(shifts, e.id, d))).length;
    const leaveDays = monthDays.filter((d) => leaveOn(leaveRequests, e.id, d)).length;
    // A rostered day already gone by, with no clock-in and no approved leave, was missed.
    const absent = scheduled.filter((d) => d < today && !presentDates.has(d) && !leaveOn(leaveRequests, e.id, d)).length;
    return {
      name: `${e.firstName} ${e.lastName}`,
      scheduled: scheduled.length,
      present: presentDates.size,
      late,
      absent,
      leaveDays,
      hours: monthAtt.reduce((s, a) => s + (a.totalHours || 0), 0),
      overtime: monthAtt.reduce((s, a) => s + (a.overtimeHours || 0), 0),
    };
  });
  const shiftMonth = (delta: number) => {
    const [y, m] = month.split('-').map(Number);
    const d = new Date(Date.UTC(y, m - 1 + delta, 1));
    setMonth(d.toISOString().slice(0, 7));
  };
  const monthLabel = new Date(`${month}-01T00:00:00Z`).toLocaleString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const downloadSummary = (format: ExportFormat) =>
    exportSection(format, `Attendance Summary ${month}`, {
      title: `Attendance Summary — ${monthLabel}`,
      columns: ['Staff', 'Rostered days', 'Present', 'Late', 'Absent', 'Leave days', 'Hours', 'Overtime hrs'],
      rows: summary.map((r) => [r.name, r.scheduled, r.present, r.late, r.absent, r.leaveDays, Number(r.hours.toFixed(2)), Number(r.overtime.toFixed(2))]),
    });

  return (
    <Tabs aria-label="Time tracking views">
      <Tab key="today" title="📍 Today">
        <Card>
          <CardHeader className="justify-between gap-2 flex-wrap">
            <div className="font-medium">Today — {now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
            <div className="flex items-center gap-2">
              <Select label="Quick clock" size="sm" selectedKeys={[employeeId]} onSelectionChange={(k) => setEmployeeId(Array.from(k)[0] as string)} variant="bordered" items={staff.map((e) => ({ id: e.id, name: `${e.firstName} ${e.lastName}` }))} className="w-56">
                {(item: any) => <SelectItem key={item.id}>{item.name}</SelectItem>}
              </Select>
              <Button color="primary" onPress={() => clockIn(employeeId)}>Clock In</Button>
              <Button variant="flat" onPress={() => clockOut(employeeId)}>Clock Out</Button>
            </div>
          </CardHeader>
          <CardBody>
            <Table aria-label="today-attendance" className="overflow-x-auto">
              <TableHeader>
                <TableColumn>STAFF</TableColumn>
                <TableColumn>ROSTERED</TableColumn>
                <TableColumn>IN</TableColumn>
                <TableColumn>OUT</TableColumn>
                <TableColumn>STATUS</TableColumn>
                <TableColumn>ACTIONS</TableColumn>
              </TableHeader>
              <TableBody emptyContent="Nobody is rostered, on leave or clocked in today — build the roster under Shift Scheduling.">
                {todayRows.map(({ e, shift, att, state, late }) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-medium">{e.firstName} {e.lastName}</TableCell>
                    <TableCell>{shift ? `${shift.startTime}–${shift.endTime}` : '—'}</TableCell>
                    <TableCell>{fmtTime(att?.checkInTime)}</TableCell>
                    <TableCell>{fmtTime(att?.checkOutTime)}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Chip size="sm" variant="flat" color={STATE_CHIP[state].color}>{STATE_CHIP[state].label}</Chip>
                        {late && <Chip size="sm" variant="flat" color="warning">Late</Chip>}
                      </div>
                    </TableCell>
                    <TableCell>
                      {state === 'on_duty' ? (
                        <Button size="sm" variant="flat" onPress={() => clockOut(e.id)}>Clock out</Button>
                      ) : state === 'expected' || state === 'no_show' ? (
                        <Button size="sm" color="primary" variant="flat" onPress={() => clockIn(e.id)}>Clock in</Button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <p className="text-xs text-gray-500 mt-2">Late = clocked in more than 10 minutes after the rostered start. No-show = rostered, not clocked in, and past that grace period.</p>
          </CardBody>
        </Card>
      </Tab>

      <Tab key="log" title="🕒 Log">
        <Card>
          <CardHeader><div className="font-medium">Clock Log</div></CardHeader>
          <CardBody>
            <Table aria-label="attendance-log" className="overflow-x-auto">
              <TableHeader>
                <TableColumn>TIMESHEET</TableColumn>
                <TableColumn>STAFF</TableColumn>
                <TableColumn>DATE</TableColumn>
                <TableColumn>IN</TableColumn>
                <TableColumn>OUT</TableColumn>
                <TableColumn>HOURS</TableColumn>
                <TableColumn>OVERTIME</TableColumn>
                <TableColumn>STATUS</TableColumn>
              </TableHeader>
              <TableBody emptyContent="No clock records yet.">
                {attendances.map((a) => {
                  const inProgress = a.checkInTime && !a.checkOutTime;
                  const late = isLate(a.checkInTime, shiftOn(shifts, a.employeeId, localDay(a.date)));
                  return (
                    <TableRow key={a.id}>
                      <TableCell className="font-mono">{a.id}</TableCell>
                      <TableCell>{nameOf(a.employeeId)}</TableCell>
                      <TableCell>{new Date(a.date).toLocaleDateString('en-GB')}</TableCell>
                      <TableCell>{fmtTime(a.checkInTime)}</TableCell>
                      <TableCell>{fmtTime(a.checkOutTime)}</TableCell>
                      <TableCell>{(a.totalHours || 0).toFixed(2)}</TableCell>
                      <TableCell>{(a.overtimeHours || 0).toFixed(2)}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Chip size="sm" variant="flat" color={inProgress ? 'primary' : 'success'}>{inProgress ? 'In progress' : 'Completed'}</Chip>
                          {late && <Chip size="sm" variant="flat" color="warning">Late</Chip>}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardBody>
        </Card>
      </Tab>

      <Tab key="summary" title="📊 Monthly Summary">
        <Card>
          <CardHeader className="justify-between gap-2 flex-wrap">
            <div className="font-medium">Attendance Summary — {monthLabel}</div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="flat" onPress={() => shiftMonth(-1)}>‹</Button>
              <Button size="sm" variant="flat" onPress={() => setMonth(todayKey().slice(0, 7))}>This month</Button>
              <Button size="sm" variant="flat" onPress={() => shiftMonth(1)}>›</Button>
              <ExportButtons onDownload={downloadSummary} />
            </div>
          </CardHeader>
          <CardBody>
            <Table aria-label="attendance-summary" className="overflow-x-auto">
              <TableHeader>
                <TableColumn>STAFF</TableColumn>
                <TableColumn>ROSTERED DAYS</TableColumn>
                <TableColumn>PRESENT</TableColumn>
                <TableColumn>LATE</TableColumn>
                <TableColumn>ABSENT</TableColumn>
                <TableColumn>LEAVE DAYS</TableColumn>
                <TableColumn>HOURS</TableColumn>
                <TableColumn>OVERTIME</TableColumn>
              </TableHeader>
              <TableBody emptyContent="No staff yet.">
                {summary.map((r) => (
                  <TableRow key={r.name}>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell>{r.scheduled}</TableCell>
                    <TableCell>{r.present}</TableCell>
                    <TableCell className={r.late ? 'text-amber-700 font-medium' : ''}>{r.late}</TableCell>
                    <TableCell className={r.absent ? 'text-red-600 font-medium' : ''}>{r.absent}</TableCell>
                    <TableCell>{r.leaveDays}</TableCell>
                    <TableCell>{r.hours.toFixed(1)}</TableCell>
                    <TableCell>{r.overtime.toFixed(1)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <p className="text-xs text-gray-500 mt-2">Absent = a rostered day that has passed with no clock-in and no approved leave.</p>
          </CardBody>
        </Card>
      </Tab>
    </Tabs>
  );
}
