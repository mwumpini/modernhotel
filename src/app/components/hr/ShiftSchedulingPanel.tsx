'use client';

import React from 'react';
import { Button, Card, CardBody, CardHeader, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Select, SelectItem } from '@heroui/react';
import { useLeaveAttendanceStore, type Shift } from '@/app/lib/hr/leaveAttendanceStore';
import { useEmployeeStore } from '@/app/lib/hr/employeeStore';
import { addDays, leaveOn, todayKey, weekStart } from '@/app/lib/hr/leaveDates';
import { useSectionExport } from '@/app/lib/export/useSectionExport';
import { notifySuccess } from '@/app/lib/notifications/notify';
import ExportButtons from '@/app/components/ExportButtons';
import type { ExportFormat } from '@/app/lib/frontoffice/reportExportFormat';

const PRESETS = [
  { label: 'Morning', start: '06:00', end: '14:00' },
  { label: 'Afternoon', start: '14:00', end: '22:00' },
  { label: 'Night', start: '22:00', end: '06:00' },
];

// An end time earlier than the start means the shift runs past midnight (e.g. a night shift).
const shiftLabel = (s: Pick<Shift, 'startTime' | 'endTime'>) => `${s.startTime}–${s.endTime}${s.endTime < s.startTime ? ' (+1)' : ''}`;
const dayLabel = (day: string) => new Date(`${day}T00:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });

type Draft = { employeeId: string; date: string; shiftId?: string; startTime: string; endTime: string; location: string };

/** Weekly roster: one row per staff member, one column per day. */
export default function ShiftSchedulingPanel() {
  const shifts = useLeaveAttendanceStore((s) => s.shifts);
  const leaveRequests = useLeaveAttendanceStore((s) => s.leaveRequests);
  const scheduleShift = useLeaveAttendanceStore((s) => s.scheduleShift);
  const updateShift = useLeaveAttendanceStore((s) => s.updateShift);
  const deleteShift = useLeaveAttendanceStore((s) => s.deleteShift);
  const employees = useEmployeeStore((s) => s.employees);
  const departments = useEmployeeStore((s) => s.departments);
  const getPosition = useEmployeeStore((s) => s.getPosition);
  const exportSection = useSectionExport();

  const [week, setWeek] = React.useState(() => weekStart(todayKey()));
  const [dept, setDept] = React.useState('all');
  const [draft, setDraft] = React.useState<Draft | null>(null);

  const days = Array.from({ length: 7 }, (_, i) => addDays(week, i));
  const today = todayKey();
  const staff = employees.filter((e) => e.status !== 'terminated' && e.status !== 'inactive' && (dept === 'all' || e.departmentId === dept));
  const shiftsFor = (employeeId: string, day: string) =>
    shifts.filter((s) => s.employeeId === employeeId && s.date === day).sort((a, b) => a.startTime.localeCompare(b.startTime));
  const nameOf = (id: string) => { const e = employees.find((x) => x.id === id); return e ? `${e.firstName} ${e.lastName}` : id; };

  const openNew = (employeeId: string, date: string) => setDraft({ employeeId, date, startTime: '08:00', endTime: '16:00', location: '' });
  const openEdit = (s: Shift) => setDraft({ employeeId: s.employeeId, date: s.date, shiftId: s.id, startTime: s.startTime, endTime: s.endTime, location: s.location || '' });

  const draftValid = !!draft && !!draft.startTime && !!draft.endTime && draft.startTime !== draft.endTime;
  const save = () => {
    if (!draft || !draftValid) return;
    const fields = { startTime: draft.startTime, endTime: draft.endTime, location: draft.location.trim() || undefined };
    if (draft.shiftId) updateShift(draft.shiftId, fields);
    else scheduleShift({ employeeId: draft.employeeId, date: draft.date, ...fields });
    setDraft(null);
  };

  // Repeats last week's shifts for everyone shown, skipping days that already have the same
  // shift and days the person is on approved leave.
  const copyPreviousWeek = () => {
    const visible = new Set(staff.map((e) => e.id));
    const prevDays = new Set(days.map((d) => addDays(d, -7)));
    let copied = 0;
    for (const s of shifts) {
      if (!visible.has(s.employeeId) || !prevDays.has(s.date)) continue;
      const date = addDays(s.date, 7);
      const exists = shiftsFor(s.employeeId, date).some((x) => x.startTime === s.startTime && x.endTime === s.endTime);
      if (exists || leaveOn(leaveRequests, s.employeeId, date)) continue;
      scheduleShift({ employeeId: s.employeeId, date, startTime: s.startTime, endTime: s.endTime, location: s.location });
      copied += 1;
    }
    notifySuccess(copied ? `${copied} shift${copied === 1 ? '' : 's'} copied from last week` : 'Nothing to copy — last week is empty or already copied', 'Roster');
  };

  const download = (format: ExportFormat) =>
    exportSection(format, `Shift Roster ${week}`, {
      title: `Shift Roster — week of ${dayLabel(week)}`,
      columns: ['Staff', ...days.map(dayLabel)],
      rows: staff.map((e) => [
        `${e.firstName} ${e.lastName}`,
        ...days.map((d) => (leaveOn(leaveRequests, e.id, d) ? 'Leave' : shiftsFor(e.id, d).map(shiftLabel).join('; '))),
      ]),
    });

  return (
    <Card>
      <CardHeader className="justify-between gap-2 flex-wrap">
        <div className="font-medium">Shift Roster — {dayLabel(week)} to {dayLabel(addDays(week, 6))}</div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select size="sm" aria-label="Department" className="w-48" variant="bordered" selectedKeys={[dept]} onSelectionChange={(k) => setDept(Array.from(k)[0] as string)}
            items={[{ id: 'all', name: 'All Departments' }, ...departments.map((d) => ({ id: d.id, name: d.name }))]}>
            {(item: any) => <SelectItem key={item.id}>{item.name}</SelectItem>}
          </Select>
          <Button size="sm" variant="flat" onPress={() => setWeek(addDays(week, -7))}>‹</Button>
          <Button size="sm" variant="flat" onPress={() => setWeek(weekStart(todayKey()))}>This week</Button>
          <Button size="sm" variant="flat" onPress={() => setWeek(addDays(week, 7))}>›</Button>
          <Button size="sm" variant="flat" onPress={copyPreviousWeek}>Copy last week</Button>
          <ExportButtons onDownload={download} />
        </div>
      </CardHeader>
      <CardBody>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse min-w-[900px]">
            <thead>
              <tr>
                <th className="text-left p-2 w-48 text-xs text-gray-500 font-medium">STAFF</th>
                {days.map((d) => (
                  <th key={d} className={`p-2 text-xs font-medium ${d === today ? 'text-blue-700 bg-blue-50' : 'text-gray-500'}`}>{dayLabel(d).toUpperCase()}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {staff.length === 0 && (
                <tr><td colSpan={8} className="p-4 text-center text-gray-500">No staff in this department.</td></tr>
              )}
              {staff.map((e) => (
                <tr key={e.id} className="border-t border-gray-200 align-top">
                  <td className="p-2">
                    <div className="font-medium">{e.firstName} {e.lastName}</div>
                    <div className="text-xs text-gray-500">{getPosition(e.positionId)?.title || ''}</div>
                  </td>
                  {days.map((d) => {
                    const leave = leaveOn(leaveRequests, e.id, d);
                    return (
                      <td key={d} className={`p-1 ${d === today ? 'bg-blue-50/50' : ''}`}>
                        <div className="flex flex-col gap-1">
                          {leave && <span className="rounded bg-amber-100 text-amber-900 text-xs px-1.5 py-1 text-center">🌴 {leave.leaveType} leave</span>}
                          {shiftsFor(e.id, d).map((s) => (
                            <button key={s.id} type="button" onClick={() => openEdit(s)} title={s.location ? `Location: ${s.location}` : 'Edit shift'}
                              className="rounded bg-emerald-100 hover:bg-emerald-200 text-emerald-900 text-xs px-1.5 py-1 text-center">
                              {shiftLabel(s)}
                            </button>
                          ))}
                          {!leave && (
                            <button type="button" onClick={() => openNew(e.id, d)} className="rounded border border-dashed border-gray-300 text-gray-400 hover:text-gray-700 hover:border-gray-500 text-xs py-0.5" aria-label={`Add shift for ${e.firstName} on ${dayLabel(d)}`}>+</button>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
            {staff.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-gray-300 text-xs text-gray-600">
                  <td className="p-2 font-medium">On shift</td>
                  {days.map((d) => (
                    <td key={d} className="p-2 text-center">{new Set(staff.filter((e) => shiftsFor(e.id, d).length > 0).map((e) => e.id)).size}</td>
                  ))}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </CardBody>

      <Modal isOpen={!!draft} onOpenChange={(open) => { if (!open) setDraft(null); }} size="md">
        <ModalContent>
          {() => draft && (
            <>
              <ModalHeader>{draft.shiftId ? 'Edit shift' : 'Add shift'} — {nameOf(draft.employeeId)}, {dayLabel(draft.date)}</ModalHeader>
              <ModalBody>
                <div className="flex gap-2 flex-wrap">
                  {PRESETS.map((p) => (
                    <Button key={p.label} size="sm" variant="flat" onPress={() => setDraft({ ...draft, startTime: p.start, endTime: p.end })}>{p.label} {p.start}–{p.end}</Button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Input label="Start" type="time" value={draft.startTime} onChange={(e) => setDraft({ ...draft, startTime: e.target.value })} variant="bordered" />
                  <Input label="End" type="time" value={draft.endTime} onChange={(e) => setDraft({ ...draft, endTime: e.target.value })} variant="bordered"
                    description={draft.endTime && draft.endTime < draft.startTime ? 'Ends the next day' : undefined} />
                </div>
                <Input label="Location (optional)" value={draft.location} onChange={(e) => setDraft({ ...draft, location: e.target.value })} variant="bordered" />
              </ModalBody>
              <ModalFooter className="justify-between">
                <div>
                  {draft.shiftId && <Button variant="flat" color="danger" onPress={() => { deleteShift(draft.shiftId!); setDraft(null); }}>Delete</Button>}
                </div>
                <div className="flex gap-2">
                  <Button variant="flat" onPress={() => setDraft(null)}>Cancel</Button>
                  <Button color="primary" onPress={save} isDisabled={!draftValid}>Save</Button>
                </div>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </Card>
  );
}
