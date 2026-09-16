'use client';

import React from 'react';
import { Button, Card, CardBody, CardHeader, Input, Select, SelectItem, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow } from '@heroui/react';
import { useLeaveAttendanceStore } from '../../lib/hr/leaveAttendanceStore';
import type { DepartmentStaffMember } from '../../lib/hr/useDepartmentStaff';
import { printSimpleReport } from '../../lib/print/simpleReport';

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function mondayOf(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun..6=Sat
  const diff = day === 0 ? -6 : 1 - day; // shift back to Monday
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function formatWeekLabel(monday: Date): string {
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);
  const fmt = (d: Date) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return `${fmt(monday)} – ${fmt(sunday)}, ${sunday.getFullYear()}`;
}

/**
 * Shift scheduling scoped to one department's own staff — same underlying
 * shifts store as HR & Payroll's own Shift Scheduling panel
 * (leaveAttendanceStore.ts), just filtered to this department's employee
 * list so a department manager only sees and schedules their own people.
 * Defaults to a week-at-a-glance grid (the common case — plan the coming
 * week for everyone at once) with a flat add/edit list underneath for
 * one-off entries.
 */
export default function DepartmentShiftsPanel({ staff, departmentLabel }: { staff: DepartmentStaffMember[]; departmentLabel: string }) {
  const allShifts = useLeaveAttendanceStore((s) => s.shifts);
  const scheduleShift = useLeaveAttendanceStore((s) => s.scheduleShift);
  const updateShift = useLeaveAttendanceStore((s) => s.updateShift);
  const deleteShift = useLeaveAttendanceStore((s) => s.deleteShift);
  const hydrateShifts = useLeaveAttendanceStore((s) => s.hydrateFromApi);

  React.useEffect(() => { void hydrateShifts(); }, [hydrateShifts]);

  const staffIds = React.useMemo(() => new Set(staff.map((s) => s.id)), [staff]);
  const shifts = allShifts.filter((s) => staffIds.has(s.employeeId));

  const [weekStart, setWeekStart] = React.useState(() => mondayOf(new Date()));
  const weekDates = React.useMemo(
    () => Array.from({ length: 7 }, (_, i) => { const d = new Date(weekStart); d.setDate(d.getDate() + i); return d; }),
    [weekStart]
  );
  const weekEnd = weekDates[6];

  const shiftsInWeek = (employeeId: string, date: Date) =>
    shifts.filter((s) => s.employeeId === employeeId && s.date === toISODate(date));

  const printWeek = () => {
    const columns = ['Employee', ...DAY_LABELS.map((d, i) => `${d} ${weekDates[i].getDate()}`)];
    const rows = staff.map((member) => [
      member.name,
      ...weekDates.map((d) => shiftsInWeek(member.id, d).map((s) => `${s.startTime}-${s.endTime}`).join(', ') || '—'),
    ]);
    printSimpleReport(`${departmentLabel} — Weekly Shift Schedule`, formatWeekLabel(weekStart), columns, rows);
  };

  const [form, setForm] = React.useState<any>({ employeeId: '', date: new Date().toISOString().slice(0, 10), startTime: '08:00', endTime: '16:00', location: '' });
  const [editingShiftId, setEditingShiftId] = React.useState<string | null>(null);
  const [editTimes, setEditTimes] = React.useState<{ startTime: string; endTime: string }>({ startTime: '', endTime: '' });

  const create = () => {
    if (!form.employeeId || !form.date || !form.startTime || !form.endTime) return;
    if (form.endTime <= form.startTime) return;
    scheduleShift({ employeeId: form.employeeId, date: form.date, startTime: form.startTime, endTime: form.endTime, location: form.location });
    setForm({ ...form, location: '' });
  };

  const startEdit = (s: any) => {
    setEditingShiftId(s.id);
    setEditTimes({ startTime: s.startTime, endTime: s.endTime });
  };

  const saveEdit = (shiftId: string) => {
    if (!editTimes.startTime || !editTimes.endTime || editTimes.endTime <= editTimes.startTime) return;
    updateShift(shiftId, { startTime: editTimes.startTime, endTime: editTimes.endTime });
    setEditingShiftId(null);
  };

  return (
    <div className="p-6 space-y-4">
      <Card>
        <CardHeader className="flex items-center justify-between flex-wrap gap-2">
          <div className="font-medium">Weekly Schedule — {formatWeekLabel(weekStart)}</div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="flat" onPress={() => setWeekStart((d) => { const n = new Date(d); n.setDate(n.getDate() - 7); return n; })}>← Prev</Button>
            <Button size="sm" variant="flat" onPress={() => setWeekStart(mondayOf(new Date()))}>This Week</Button>
            <Button size="sm" variant="flat" onPress={() => setWeekStart((d) => { const n = new Date(d); n.setDate(n.getDate() + 7); return n; })}>Next →</Button>
            <Button size="sm" color="primary" variant="flat" onPress={printWeek}>🖨️ Print</Button>
          </div>
        </CardHeader>
        <CardBody>
          <Table aria-label="Weekly shift grid">
            <TableHeader columns={[{ key: 'employee', label: 'EMPLOYEE' }, ...DAY_LABELS.map((label, i) => ({ key: toISODate(weekDates[i]), label: `${label} ${weekDates[i].getDate()}` }))]}>
              {(col) => <TableColumn key={col.key}>{col.label}</TableColumn>}
            </TableHeader>
            <TableBody items={staff} emptyContent="No staff in this department yet.">
              {(member) => (
                <TableRow key={member.id}>
                  {[
                    <TableCell key="employee" className="font-medium">{member.name}</TableCell>,
                    ...weekDates.map((d) => {
                      const dayShifts = shiftsInWeek(member.id, d);
                      return (
                        <TableCell key={toISODate(d)}>
                          {dayShifts.length > 0
                            ? dayShifts.map((s) => `${s.startTime}-${s.endTime}`).join(', ')
                            : <span className="text-gray-400">—</span>}
                        </TableCell>
                      );
                    }),
                  ]}
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardBody>
      </Card>

      <Card>
        <CardHeader className="justify-between">
          <div className="font-medium">Add / Manage Shifts</div>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-4">
            <Select label="Employee" placeholder="Select employee" selectedKeys={form.employeeId ? [form.employeeId] : []} onSelectionChange={(k) => setForm({ ...form, employeeId: Array.from(k)[0] as string })} variant="bordered">
              {staff.map((s) => <SelectItem key={s.id}>{s.name}</SelectItem>)}
            </Select>
            <Input label="Date" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} variant="bordered" />
            <Input label="Start" type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} variant="bordered" />
            <Input label="End" type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} variant="bordered" />
            <Input label="Location" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} variant="bordered" />
            <div className="md:col-span-5">
              <Button color="primary" onPress={create} isDisabled={!form.employeeId || !form.date || !form.startTime || !form.endTime || (form.endTime <= form.startTime)}>
                Add Shift
              </Button>
            </div>
          </div>

          <Table aria-label="Department shifts">
            <TableHeader>
              <TableColumn>EMPLOYEE</TableColumn>
              <TableColumn>DATE</TableColumn>
              <TableColumn>START</TableColumn>
              <TableColumn>END</TableColumn>
              <TableColumn>LOCATION</TableColumn>
              <TableColumn>{' '}</TableColumn>
            </TableHeader>
            <TableBody emptyContent="No shifts scheduled for this department.">
              {shifts.map((s) => {
                const emp = staff.find((m) => m.id === s.employeeId);
                const name = emp ? emp.name : s.employeeId;
                return (
                  <TableRow key={s.id}>
                    <TableCell>{name}</TableCell>
                    <TableCell>{s.date}</TableCell>
                    <TableCell>
                      {editingShiftId === s.id
                        ? <Input type="time" size="sm" value={editTimes.startTime} onChange={(e) => setEditTimes({ ...editTimes, startTime: e.target.value })} variant="bordered" />
                        : s.startTime}
                    </TableCell>
                    <TableCell>
                      {editingShiftId === s.id
                        ? <Input type="time" size="sm" value={editTimes.endTime} onChange={(e) => setEditTimes({ ...editTimes, endTime: e.target.value })} variant="bordered" />
                        : s.endTime}
                    </TableCell>
                    <TableCell>{s.location || '-'}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {editingShiftId === s.id ? (
                          <>
                            <Button size="sm" color="primary" variant="flat" onPress={() => saveEdit(s.id)} isDisabled={!editTimes.startTime || !editTimes.endTime || editTimes.endTime <= editTimes.startTime}>Save</Button>
                            <Button size="sm" variant="flat" onPress={() => setEditingShiftId(null)}>Cancel</Button>
                          </>
                        ) : (
                          <>
                            <Button size="sm" variant="flat" onPress={() => startEdit(s)}>Move</Button>
                            <Button size="sm" variant="flat" color="danger" onPress={() => deleteShift(s.id)}>Delete</Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardBody>
      </Card>
    </div>
  );
}
