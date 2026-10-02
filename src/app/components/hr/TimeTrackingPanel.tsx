'use client';

import React from 'react';
import { Button, Card, CardBody, CardHeader, Chip, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Pagination, Select, SelectItem, Tab, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow, Tabs } from '@heroui/react';
import { useLeaveAttendanceStore } from '@/app/lib/hr/leaveAttendanceStore';
import { useEmployeeStore } from '@/app/lib/hr/employeeStore';
import { leaveOn, todayKey } from '@/app/lib/hr/leaveDates';
import { isLate, minutesOfDay, pastGrace, shiftOn } from '@/app/lib/hr/attendanceStatus';
import { useSectionExport } from '@/app/lib/export/useSectionExport';
import ExportButtons from '@/app/components/ExportButtons';
import type { ExportFormat } from '@/app/lib/frontoffice/reportExportFormat';
import { printDetailSheet } from '@/app/lib/print/simpleReport';
import { SortLabel, deskResizableTableClassNames, rowClassNames, useResizableColumns } from '../frontoffice/columnResize';
import { DetailGrid, DetailField } from '../frontoffice/detailView';
import { useDeskPagination } from '../dashboard/deskTableUi';
import { deskBookTabsClassNames, deskBookTabPanelClassName } from '../dashboard/deskTabsUi';

type TodayState = 'leave' | 'on_duty' | 'done' | 'no_show' | 'expected';
const STATE_CHIP: Record<TodayState, { label: string; color: 'default' | 'success' | 'warning' | 'danger' | 'primary' }> = {
  leave: { label: 'On leave', color: 'default' },
  on_duty: { label: 'On duty', color: 'primary' },
  done: { label: 'Completed', color: 'success' },
  no_show: { label: 'No-show', color: 'danger' },
  expected: { label: 'Expected', color: 'warning' },
};

const localDay = (d: Date | string) => todayKey(new Date(d));
const fmtTime = (d?: Date | string) => (d ? new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '—');

type TodaySort = 'staff' | 'rostered' | 'in' | 'out' | 'status';
type LogSort = 'timesheet' | 'staff' | 'date' | 'in' | 'out' | 'hours' | 'overtime' | 'status';
type SummarySort = 'staff' | 'scheduled' | 'present' | 'late' | 'absent' | 'leaveDays' | 'hours' | 'overtime';

export default function TimeTrackingPanel() {
  const attendances = useLeaveAttendanceStore((s) => s.attendances);
  const shifts = useLeaveAttendanceStore((s) => s.shifts);
  const leaveRequests = useLeaveAttendanceStore((s) => s.leaveRequests);
  const clockIn = useLeaveAttendanceStore((s) => s.clockIn);
  const clockOut = useLeaveAttendanceStore((s) => s.clockOut);
  const employees = useEmployeeStore((s) => s.employees);
  const departments = useEmployeeStore((s) => s.departments);
  const exportSection = useSectionExport();

  const [employeeId, setEmployeeId] = React.useState<string>(employees[0]?.id || '');
  const [now, setNow] = React.useState(() => new Date());
  React.useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);
  const [month, setMonth] = React.useState(() => todayKey().slice(0, 7));
  const [deptFilter, setDeptFilter] = React.useState('all');
  const [q, setQ] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<'all' | TodayState>('all');
  const [viewLog, setViewLog] = React.useState<(typeof attendances)[number] | null>(null);

  const [todaySort, setTodaySort] = React.useState<{ key: TodaySort; dir: 'asc' | 'desc' }>({ key: 'staff', dir: 'asc' });
  const [logSort, setLogSort] = React.useState<{ key: LogSort; dir: 'asc' | 'desc' }>({ key: 'date', dir: 'desc' });
  const [sumSort, setSumSort] = React.useState<{ key: SummarySort; dir: 'asc' | 'desc' }>({ key: 'staff', dir: 'asc' });

  const todayCols = useResizableColumns<TodaySort>({ staff: 160, rostered: 120, in: 90, out: 90, status: 160 });
  const logCols = useResizableColumns<LogSort>({ timesheet: 120, staff: 150, date: 110, in: 90, out: 90, hours: 90, overtime: 100, status: 140 });
  const sumCols = useResizableColumns<SummarySort>({ staff: 160, scheduled: 110, present: 100, late: 90, absent: 90, leaveDays: 100, hours: 90, overtime: 100 });

  const staff = employees.filter((e) => e.status !== 'terminated' && e.status !== 'inactive');
  const nameOf = (id: string) => { const e = employees.find((x) => x.id === id); return e ? `${e.firstName} ${e.lastName}` : id; };
  const today = todayKey(now);

  const attendanceOn = (id: string, day: string) => attendances.find((a) => a.employeeId === id && localDay(a.date) === day);
  const todayRows = React.useMemo(() => {
    const rows = staff.flatMap((e) => {
      if (deptFilter !== 'all' && e.departmentId !== deptFilter) return [];
      const name = `${e.firstName} ${e.lastName}`;
      if (q.trim() && !name.toLowerCase().includes(q.trim().toLowerCase())) return [];
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
      if (statusFilter !== 'all' && state !== statusFilter) return [];
      return [{ e, name, shift, att, state, late: isLate(att?.checkInTime, shift) }];
    });
    const value = (r: (typeof rows)[number]): string | number => {
      switch (todaySort.key) {
        case 'staff': return r.name.toLowerCase();
        case 'rostered': return r.shift ? r.shift.startTime : '';
        case 'in': return r.att?.checkInTime ? new Date(r.att.checkInTime).getTime() : 0;
        case 'out': return r.att?.checkOutTime ? new Date(r.att.checkOutTime).getTime() : 0;
        case 'status': return r.state;
        default: return '';
      }
    };
    const sorted = [...rows].sort((a, b) => (value(a) < value(b) ? -1 : value(a) > value(b) ? 1 : 0));
    return todaySort.dir === 'asc' ? sorted : sorted.reverse();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staff, deptFilter, q, statusFilter, shifts, leaveRequests, attendances, today, now, todaySort]);

  const logRows = React.useMemo(() => {
    const rows = attendances.filter((a) => {
      const emp = employees.find((e) => e.id === a.employeeId);
      if (deptFilter !== 'all' && emp?.departmentId !== deptFilter) return false;
      if (q.trim() && !nameOf(a.employeeId).toLowerCase().includes(q.trim().toLowerCase())) return false;
      return true;
    });
    const value = (a: (typeof rows)[number]): string | number => {
      switch (logSort.key) {
        case 'timesheet': return a.id;
        case 'staff': return nameOf(a.employeeId).toLowerCase();
        case 'date': return new Date(a.date).getTime();
        case 'in': return a.checkInTime ? new Date(a.checkInTime).getTime() : 0;
        case 'out': return a.checkOutTime ? new Date(a.checkOutTime).getTime() : 0;
        case 'hours': return a.totalHours || 0;
        case 'overtime': return a.overtimeHours || 0;
        case 'status': return a.checkInTime && !a.checkOutTime ? 'in_progress' : 'completed';
        default: return '';
      }
    };
    const sorted = [...rows].sort((a, b) => (value(a) < value(b) ? -1 : value(a) > value(b) ? 1 : 0));
    return logSort.dir === 'asc' ? sorted : sorted.reverse();
  }, [attendances, employees, deptFilter, q, logSort]);

  const monthDays = (() => {
    const [y, m] = month.split('-').map(Number);
    const n = new Date(Date.UTC(y, m, 0)).getUTCDate();
    return Array.from({ length: n }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`);
  })();
  const summary = React.useMemo(() => {
    const rows = staff.filter((e) => {
      if (deptFilter !== 'all' && e.departmentId !== deptFilter) return false;
      const name = `${e.firstName} ${e.lastName}`;
      if (q.trim() && !name.toLowerCase().includes(q.trim().toLowerCase())) return false;
      return true;
    }).map((e) => {
      const scheduled = monthDays.filter((d) => shiftOn(shifts, e.id, d));
      const monthAtt = attendances.filter((a) => a.employeeId === e.id && localDay(a.date).startsWith(month));
      const presentDates = new Set(monthAtt.filter((a) => a.checkInTime).map((a) => localDay(a.date)));
      const late = [...presentDates].filter((d) => isLate(attendanceOn(e.id, d)?.checkInTime, shiftOn(shifts, e.id, d))).length;
      const leaveDays = monthDays.filter((d) => leaveOn(leaveRequests, e.id, d)).length;
      const absent = scheduled.filter((d) => d < today && !presentDates.has(d) && !leaveOn(leaveRequests, e.id, d)).length;
      return {
        id: e.id,
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
    const value = (r: (typeof rows)[number]): string | number => {
      switch (sumSort.key) {
        case 'staff': return r.name.toLowerCase();
        case 'scheduled': return r.scheduled;
        case 'present': return r.present;
        case 'late': return r.late;
        case 'absent': return r.absent;
        case 'leaveDays': return r.leaveDays;
        case 'hours': return r.hours;
        case 'overtime': return r.overtime;
        default: return '';
      }
    };
    const sorted = [...rows].sort((a, b) => (value(a) < value(b) ? -1 : value(a) > value(b) ? 1 : 0));
    return sumSort.dir === 'asc' ? sorted : sorted.reverse();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staff, deptFilter, q, month, monthDays, shifts, attendances, leaveRequests, today, sumSort]);

  const { page: todayPage, setPage: setTodayPage, pages: todayPages, paged: todayPaged } = useDeskPagination(todayRows, [q, deptFilter, statusFilter, todaySort]);
  const { page: logPage, setPage: setLogPage, pages: logPages, paged: logPaged } = useDeskPagination(logRows, [q, deptFilter, logSort]);
  const { page: sumPage, setPage: setSumPage, pages: sumPages, paged: sumPaged } = useDeskPagination(summary, [q, deptFilter, month, sumSort]);

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

  const toggleSort = <K extends string>(prev: { key: K; dir: 'asc' | 'desc' }, key: K) =>
    prev.key === key ? { key, dir: (prev.dir === 'asc' ? 'desc' : 'asc') as 'asc' | 'desc' } : { key, dir: 'asc' as const };

  const filters = (
    <>
      <Input size="sm" placeholder="Search staff" value={q} onChange={(e) => setQ(e.target.value)} variant="bordered" className="w-40" />
      <Select
        size="sm"
        aria-label="Department"
        className="w-44"
        variant="bordered"
        selectedKeys={[deptFilter]}
        onSelectionChange={(k) => setDeptFilter(Array.from(k)[0] as string)}
        items={[{ id: 'all', name: 'All departments' }, ...departments.map((d) => ({ id: d.id, name: d.name }))]}
      >
        {(item: any) => <SelectItem key={item.id}>{item.name}</SelectItem>}
      </Select>
    </>
  );

  return (
    <>
    <Tabs aria-label="Time tracking views" size="sm" variant="solid" className="w-full" classNames={deskBookTabsClassNames}>
      <Tab key="today" title="Today">
        <div className={deskBookTabPanelClassName}>
        <Card className="shadow-sm">
          <CardHeader className="px-3 py-2 justify-between gap-2 flex-wrap">
            <div className="text-sm font-semibold text-gray-800">Today — {now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
            <div className="flex flex-wrap items-center gap-2">
              {filters}
              <Select size="sm" aria-label="Status" className="w-36" variant="bordered" selectedKeys={[statusFilter]} onSelectionChange={(k) => setStatusFilter(Array.from(k)[0] as any)}>
                <SelectItem key="all">All status</SelectItem>
                <SelectItem key="expected">Expected</SelectItem>
                <SelectItem key="on_duty">On duty</SelectItem>
                <SelectItem key="done">Completed</SelectItem>
                <SelectItem key="no_show">No-show</SelectItem>
                <SelectItem key="leave">On leave</SelectItem>
              </Select>
              <Select label="Quick clock" size="sm" selectedKeys={[employeeId]} onSelectionChange={(k) => setEmployeeId(Array.from(k)[0] as string)} variant="bordered" items={staff.map((e) => ({ id: e.id, name: `${e.firstName} ${e.lastName}` }))} className="w-48">
                {(item: any) => <SelectItem key={item.id}>{item.name}</SelectItem>}
              </Select>
              <Button color="primary" onPress={() => clockIn(employeeId)}>Clock In</Button>
              <Button variant="flat" onPress={() => clockOut(employeeId)}>Clock Out</Button>
            </div>
          </CardHeader>
          <CardBody>
            <div ref={todayCols.frameRef} style={todayCols.frameStyle}>
            <Table aria-label="today-attendance" removeWrapper classNames={deskResizableTableClassNames()}>
              <TableHeader>
                {[
                  ...(['staff', 'rostered', 'in', 'out', 'status'] as TodaySort[]).map((key) => (
                    <TableColumn key={key} className="relative" style={todayCols.style(key)}>
                      <SortLabel active={todaySort.key === key} dir={todaySort.dir} onPress={() => setTodaySort((p) => toggleSort(p, key))}>
                        {{ staff: 'Staff', rostered: 'Rostered', in: 'In', out: 'Out', status: 'Status' }[key]}
                      </SortLabel>
                      {todayCols.sizer(key, key)}
                    </TableColumn>
                  )),
                  <TableColumn key="actions">Actions</TableColumn>,
                ]}
              </TableHeader>
              <TableBody emptyContent="Nobody is rostered, on leave or clocked in today — build the roster under Shifts.">
                {todayPaged.map(({ e, name, shift, att, state, late }) => (
                  <TableRow key={e.id} className="hover:bg-gray-50">
                    <TableCell className="font-semibold text-ghana-black"><span className="block truncate">{name}</span></TableCell>
                    <TableCell>{shift ? `${shift.startTime}–${shift.endTime}` : '—'}</TableCell>
                    <TableCell className="tabular-nums">{fmtTime(att?.checkInTime)}</TableCell>
                    <TableCell className="tabular-nums">{fmtTime(att?.checkOutTime)}</TableCell>
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
            </div>
            <div className="mt-3 flex justify-end">
              <Pagination page={todayPage} total={todayPages} onChange={setTodayPage} showControls size="sm" />
            </div>
            <p className="text-xs text-gray-500 mt-2">Late = clocked in more than 10 minutes after the rostered start. No-show = rostered, not clocked in, and past that grace period.</p>
          </CardBody>
        </Card>
        </div>
      </Tab>

      <Tab key="log" title="Log">
        <div className={deskBookTabPanelClassName}>
        <Card className="shadow-sm">
          <CardHeader className="px-3 py-2 justify-between gap-2 flex-wrap">
            <div className="text-sm font-semibold text-gray-800">Clock log</div>
            <div className="flex flex-wrap items-center gap-2">{filters}</div>
          </CardHeader>
          <CardBody>
            <div ref={logCols.frameRef} style={logCols.frameStyle}>
            <Table aria-label="attendance-log" removeWrapper classNames={deskResizableTableClassNames()}>
              <TableHeader>
                {([
                  ['timesheet', 'Timesheet'],
                  ['staff', 'Staff'],
                  ['date', 'Date'],
                  ['in', 'In'],
                  ['out', 'Out'],
                  ['hours', 'Hours'],
                  ['overtime', 'Overtime'],
                  ['status', 'Status'],
                ] as [LogSort, string][]).map(([key, label]) => (
                  <TableColumn key={key} className="relative" style={logCols.style(key)}>
                    <SortLabel active={logSort.key === key} dir={logSort.dir} align={key === 'hours' || key === 'overtime' ? 'right' : 'left'} onPress={() => setLogSort((p) => toggleSort(p, key))}>{label}</SortLabel>
                    {logCols.sizer(key, label)}
                  </TableColumn>
                ))}
              </TableHeader>
              <TableBody emptyContent="No clock records yet.">
                {logPaged.map((a) => {
                  const inProgress = a.checkInTime && !a.checkOutTime;
                  const late = isLate(a.checkInTime, shiftOn(shifts, a.employeeId, localDay(a.date)));
                  return (
                    <TableRow key={a.id} className={rowClassNames(viewLog?.id === a.id)} onClick={() => setViewLog(a)}>
                      <TableCell className="font-mono text-gray-600">{a.id}</TableCell>
                      <TableCell className="font-semibold text-ghana-black"><span className="block truncate">{nameOf(a.employeeId)}</span></TableCell>
                      <TableCell>{new Date(a.date).toLocaleDateString('en-GB')}</TableCell>
                      <TableCell className="tabular-nums">{fmtTime(a.checkInTime)}</TableCell>
                      <TableCell className="tabular-nums">{fmtTime(a.checkOutTime)}</TableCell>
                      <TableCell className="text-right tabular-nums">{(a.totalHours || 0).toFixed(2)}</TableCell>
                      <TableCell className="text-right tabular-nums">{(a.overtimeHours || 0).toFixed(2)}</TableCell>
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
            </div>
            <div className="mt-3 flex justify-end">
              <Pagination page={logPage} total={logPages} onChange={setLogPage} showControls size="sm" />
            </div>
          </CardBody>
        </Card>
        </div>
      </Tab>

      <Tab key="summary" title="Monthly Summary">
        <div className={deskBookTabPanelClassName}>
        <Card className="shadow-sm">
          <CardHeader className="px-3 py-2 justify-between gap-2 flex-wrap">
            <div className="text-sm font-semibold text-gray-800">Attendance summary — {monthLabel}</div>
            <div className="flex flex-wrap items-center gap-2">
              {filters}
              <Button size="sm" variant="flat" onPress={() => shiftMonth(-1)}>‹</Button>
              <Button size="sm" variant="flat" onPress={() => setMonth(todayKey().slice(0, 7))}>This month</Button>
              <Button size="sm" variant="flat" onPress={() => shiftMonth(1)}>›</Button>
              <ExportButtons onDownload={downloadSummary} />
            </div>
          </CardHeader>
          <CardBody>
            <div ref={sumCols.frameRef} style={sumCols.frameStyle}>
            <Table aria-label="attendance-summary" removeWrapper classNames={deskResizableTableClassNames()}>
              <TableHeader>
                {([
                  ['staff', 'Staff'],
                  ['scheduled', 'Rostered'],
                  ['present', 'Present'],
                  ['late', 'Late'],
                  ['absent', 'Absent'],
                  ['leaveDays', 'Leave'],
                  ['hours', 'Hours'],
                  ['overtime', 'Overtime'],
                ] as [SummarySort, string][]).map(([key, label]) => (
                  <TableColumn key={key} className="relative" style={sumCols.style(key)}>
                    <SortLabel active={sumSort.key === key} dir={sumSort.dir} align={key === 'staff' ? 'left' : 'center'} onPress={() => setSumSort((p) => toggleSort(p, key))}>{label}</SortLabel>
                    {sumCols.sizer(key, label)}
                  </TableColumn>
                ))}
              </TableHeader>
              <TableBody emptyContent="No staff match these filters.">
                {sumPaged.map((r) => (
                  <TableRow key={r.id} className="hover:bg-gray-50">
                    <TableCell className="font-semibold text-ghana-black"><span className="block truncate">{r.name}</span></TableCell>
                    <TableCell className="text-center tabular-nums">{r.scheduled}</TableCell>
                    <TableCell className="text-center tabular-nums">{r.present}</TableCell>
                    <TableCell className={`text-center tabular-nums ${r.late ? 'text-amber-700 font-medium' : ''}`}>{r.late}</TableCell>
                    <TableCell className={`text-center tabular-nums ${r.absent ? 'text-red-600 font-medium' : ''}`}>{r.absent}</TableCell>
                    <TableCell className="text-center tabular-nums">{r.leaveDays}</TableCell>
                    <TableCell className="text-center tabular-nums">{r.hours.toFixed(1)}</TableCell>
                    <TableCell className="text-center tabular-nums">{r.overtime.toFixed(1)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
            <div className="mt-3 flex justify-end">
              <Pagination page={sumPage} total={sumPages} onChange={setSumPage} showControls size="sm" />
            </div>
            <p className="text-xs text-gray-500 mt-2">Absent = a rostered day that has passed with no clock-in and no approved leave.</p>
          </CardBody>
        </Card>
        </div>
      </Tab>
    </Tabs>

    <Modal isOpen={!!viewLog} onOpenChange={(open) => !open && setViewLog(null)} size="lg">
      <ModalContent>
        {() => {
          if (!viewLog) return null;
          const inProgress = viewLog.checkInTime && !viewLog.checkOutTime;
          const late = isLate(viewLog.checkInTime, shiftOn(shifts, viewLog.employeeId, localDay(viewLog.date)));
          return (
            <>
              <ModalHeader>Clock record</ModalHeader>
              <ModalBody>
                <DetailGrid>
                  <DetailField label="Timesheet" value={viewLog.id} />
                  <DetailField label="Staff" value={nameOf(viewLog.employeeId)} />
                  <DetailField label="Date" value={new Date(viewLog.date).toLocaleDateString('en-GB')} />
                  <DetailField label="In" value={fmtTime(viewLog.checkInTime)} />
                  <DetailField label="Out" value={fmtTime(viewLog.checkOutTime)} />
                  <DetailField label="Hours" value={(viewLog.totalHours || 0).toFixed(2)} />
                  <DetailField label="Overtime" value={(viewLog.overtimeHours || 0).toFixed(2)} />
                  <DetailField label="Status" value={`${inProgress ? 'In progress' : 'Completed'}${late ? ' · Late' : ''}`} />
                </DetailGrid>
              </ModalBody>
              <ModalFooter className="flex flex-wrap justify-between gap-2">
                <Button variant="flat" onPress={() => setViewLog(null)}>Close</Button>
                {inProgress && viewLog.status !== 'void' && (
                  <Button color="danger" variant="light" onPress={async () => {
                    const { confirmDelete } = await import('../DangerConfirm');
                    if (!(await confirmDelete('this clock record', 'An open punch that never counted will be permanently removed.'))) return;
                    useLeaveAttendanceStore.getState().deleteAttendance(viewLog.id);
                    setViewLog(null);
                  }}>Delete</Button>
                )}
                {!inProgress && viewLog.status !== 'void' && (
                  <Button color="warning" variant="flat" onPress={async () => {
                    const { confirmVoid } = await import('../DangerConfirm');
                    if (!(await confirmVoid('this clock record', 'The completed timesheet stays on file as Void.'))) return;
                    useLeaveAttendanceStore.getState().voidAttendance(viewLog.id);
                    setViewLog(null);
                  }}>Void</Button>
                )}
                <Button
                  variant="bordered"
                  onPress={() => printDetailSheet('Clock record', [
                    { label: 'Timesheet', value: viewLog.id },
                    { label: 'Staff', value: nameOf(viewLog.employeeId) },
                    { label: 'Date', value: new Date(viewLog.date).toLocaleDateString('en-GB') },
                    { label: 'In', value: fmtTime(viewLog.checkInTime) },
                    { label: 'Out', value: fmtTime(viewLog.checkOutTime) },
                    { label: 'Hours', value: (viewLog.totalHours || 0).toFixed(2) },
                    { label: 'Overtime', value: (viewLog.overtimeHours || 0).toFixed(2) },
                    { label: 'Status', value: `${inProgress ? 'In progress' : 'Completed'}${late ? ' · Late' : ''}` },
                  ])}
                >
                  Print
                </Button>
              </ModalFooter>
            </>
          );
        }}
      </ModalContent>
    </Modal>
    </>
  );
}
