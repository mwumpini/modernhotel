'use client';

import React from 'react';
import { Button, Card, CardBody, CardHeader, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from '@heroui/react';
import { useLeaveAttendanceStore, type Shift } from '../../lib/hr/leaveAttendanceStore';
import type { DepartmentStaffMember } from '../../lib/hr/useDepartmentStaff';
import { addDays, leaveOn, todayKey, weekStart } from '../../lib/hr/leaveDates';
import { printSimpleReport } from '../../lib/print/simpleReport';
import { notifySuccess } from '../../lib/notifications/notify';

const PRESETS = [
  { label: 'Morning', start: '06:00', end: '14:00' },
  { label: 'Afternoon', start: '14:00', end: '22:00' },
  { label: 'Night', start: '22:00', end: '06:00' },
];

const shiftLabel = (s: Pick<Shift, 'startTime' | 'endTime'>) =>
  `${s.startTime}–${s.endTime}${s.endTime < s.startTime ? ' (+1)' : ''}`;

const dayLabel = (day: string) =>
  new Date(`${day}T00:00:00Z`).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });

type Draft = {
  employeeId: string;
  date: string;
  shiftId?: string;
  startTime: string;
  endTime: string;
  location: string;
};

/**
 * Department roster on the shared HR shift file. Empty cells are unscheduled,
 * not a utilisation score. Click a day to add; click a shift to edit.
 */
export default function DepartmentShiftsPanel({
  staff,
  departmentLabel,
}: {
  staff: DepartmentStaffMember[];
  departmentLabel: string;
}) {
  const allShifts = useLeaveAttendanceStore((s) => s.shifts);
  const leaveRequests = useLeaveAttendanceStore((s) => s.leaveRequests);
  const scheduleShift = useLeaveAttendanceStore((s) => s.scheduleShift);
  const updateShift = useLeaveAttendanceStore((s) => s.updateShift);
  const deleteShift = useLeaveAttendanceStore((s) => s.deleteShift);
  const hydrate = useLeaveAttendanceStore((s) => s.hydrateFromApi);

  React.useEffect(() => {
    void hydrate();
  }, [hydrate]);

  const staffIds = React.useMemo(() => new Set(staff.map((row) => row.id)), [staff]);
  const shifts = allShifts.filter((shift) => staffIds.has(shift.employeeId));

  const [week, setWeek] = React.useState(() => weekStart(todayKey()));
  const [draft, setDraft] = React.useState<Draft | null>(null);
  const days = React.useMemo(() => Array.from({ length: 7 }, (_, index) => addDays(week, index)), [week]);
  const today = todayKey();

  const shiftsFor = (employeeId: string, day: string) =>
    shifts
      .filter((shift) => shift.employeeId === employeeId && shift.date === day)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));

  const nameOf = (id: string) => staff.find((row) => row.id === id)?.name || id;

  const openNew = (employeeId: string, date: string) =>
    setDraft({ employeeId, date, startTime: '08:00', endTime: '16:00', location: '' });
  const openEdit = (shift: Shift) =>
    setDraft({
      employeeId: shift.employeeId,
      date: shift.date,
      shiftId: shift.id,
      startTime: shift.startTime,
      endTime: shift.endTime,
      location: shift.location || '',
    });

  const draftValid = Boolean(draft && draft.startTime && draft.endTime && draft.startTime !== draft.endTime);
  const save = () => {
    if (!draft || !draftValid) return;
    const fields = { startTime: draft.startTime, endTime: draft.endTime, location: draft.location.trim() || undefined };
    if (draft.shiftId) updateShift(draft.shiftId, fields);
    else scheduleShift({ employeeId: draft.employeeId, date: draft.date, ...fields });
    setDraft(null);
  };

  const copyPreviousWeek = () => {
    const visible = new Set(staff.map((row) => row.id));
    const prevDays = new Set(days.map((day) => addDays(day, -7)));
    let copied = 0;
    for (const shift of shifts) {
      if (!visible.has(shift.employeeId) || !prevDays.has(shift.date)) continue;
      const date = addDays(shift.date, 7);
      const exists = shiftsFor(shift.employeeId, date).some(
        (row) => row.startTime === shift.startTime && row.endTime === shift.endTime
      );
      if (exists || leaveOn(leaveRequests, shift.employeeId, date)) continue;
      scheduleShift({
        employeeId: shift.employeeId,
        date,
        startTime: shift.startTime,
        endTime: shift.endTime,
        location: shift.location,
      });
      copied += 1;
    }
    notifySuccess(
      copied
        ? `${copied} shift${copied === 1 ? '' : 's'} copied from last week`
        : 'Nothing to copy — last week is empty or already copied',
      'Roster'
    );
  };

  const printWeek = () => {
    printSimpleReport(
      `${departmentLabel} — Weekly Shift Schedule`,
      `${dayLabel(week)} – ${dayLabel(addDays(week, 6))}`,
      ['Employee', ...days.map(dayLabel)],
      staff.map((member) => [
        member.name,
        ...days.map((day) =>
          leaveOn(leaveRequests, member.id, day)
            ? 'Leave'
            : shiftsFor(member.id, day).map(shiftLabel).join(', ') || '—'
        ),
      ])
    );
  };

  return (
    <div className="pt-4">
      <Card className="border border-slate-200 shadow-sm">
        <CardHeader className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="font-medium text-slate-900">
              Shift roster — {dayLabel(week)} to {dayLabel(addDays(week, 6))}
            </div>
            <p className="text-xs text-slate-500">
              Stored HR shifts for this department’s staff. Empty cells are unscheduled, not a coverage score.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="flat" onPress={() => setWeek(addDays(week, -7))}>
              ← Prev
            </Button>
            <Button size="sm" variant="flat" onPress={() => setWeek(weekStart(todayKey()))}>
              This week
            </Button>
            <Button size="sm" variant="flat" onPress={() => setWeek(addDays(week, 7))}>
              Next →
            </Button>
            <Button size="sm" variant="flat" onPress={copyPreviousWeek}>
              Copy last week
            </Button>
            <Button size="sm" color="primary" variant="flat" onPress={printWeek}>
              Print
            </Button>
          </div>
        </CardHeader>
        <CardBody>
          <div className="overflow-x-auto">
            <table className="min-w-[900px] w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className="w-48 p-2 text-left text-xs font-medium text-slate-500">Staff</th>
                  {days.map((day) => (
                    <th
                      key={day}
                      className={`p-2 text-xs font-medium ${day === today ? 'bg-blue-50 text-blue-700' : 'text-slate-500'}`}
                    >
                      {dayLabel(day)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {staff.length === 0 && (
                  <tr>
                    <td colSpan={8} className="p-4 text-center text-slate-500">
                      No staff in this department yet.
                    </td>
                  </tr>
                )}
                {staff.map((member) => (
                  <tr key={member.id} className="align-top border-t border-slate-200">
                    <td className="p-2">
                      <div className="font-medium text-slate-900">{member.name}</div>
                      <div className="text-xs text-slate-500">{member.position}</div>
                    </td>
                    {days.map((day) => {
                      const leave = leaveOn(leaveRequests, member.id, day);
                      return (
                        <td key={day} className={`p-1 ${day === today ? 'bg-blue-50/50' : ''}`}>
                          <div className="flex flex-col gap-1">
                            {leave && (
                              <span className="rounded bg-amber-100 px-1.5 py-1 text-center text-xs text-amber-900">
                                {leave.leaveType} leave
                              </span>
                            )}
                            {shiftsFor(member.id, day).map((shift) => (
                              <button
                                key={shift.id}
                                type="button"
                                onClick={() => openEdit(shift)}
                                title={shift.location ? `Location: ${shift.location}` : 'Edit shift'}
                                className="rounded bg-emerald-100 px-1.5 py-1 text-center text-xs text-emerald-900 hover:bg-emerald-200"
                              >
                                {shiftLabel(shift)}
                              </button>
                            ))}
                            {!leave && (
                              <button
                                type="button"
                                onClick={() => openNew(member.id, day)}
                                className="rounded border border-dashed border-slate-300 py-0.5 text-xs text-slate-400 hover:border-slate-500 hover:text-slate-700"
                                aria-label={`Add shift for ${member.name} on ${dayLabel(day)}`}
                              >
                                +
                              </button>
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
                  <tr className="border-t-2 border-slate-300 text-xs text-slate-600">
                    <td className="p-2 font-medium">On shift</td>
                    {days.map((day) => (
                      <td key={day} className="p-2 text-center">
                        {new Set(staff.filter((member) => shiftsFor(member.id, day).length > 0).map((member) => member.id)).size}
                      </td>
                    ))}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </CardBody>
      </Card>

      <Modal isOpen={Boolean(draft)} onOpenChange={(open) => { if (!open) setDraft(null); }} size="md">
        <ModalContent>
          {() =>
            draft && (
              <>
                <ModalHeader>
                  {draft.shiftId ? 'Edit shift' : 'Add shift'} — {nameOf(draft.employeeId)}, {dayLabel(draft.date)}
                </ModalHeader>
                <ModalBody>
                  <div className="flex flex-wrap gap-2">
                    {PRESETS.map((preset) => (
                      <Button
                        key={preset.label}
                        size="sm"
                        variant="flat"
                        onPress={() => setDraft({ ...draft, startTime: preset.start, endTime: preset.end })}
                      >
                        {preset.label} {preset.start}–{preset.end}
                      </Button>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      label="Start"
                      type="time"
                      value={draft.startTime}
                      onChange={(event) => setDraft({ ...draft, startTime: event.target.value })}
                      variant="bordered"
                    />
                    <Input
                      label="End"
                      type="time"
                      value={draft.endTime}
                      onChange={(event) => setDraft({ ...draft, endTime: event.target.value })}
                      variant="bordered"
                      description={draft.endTime && draft.endTime < draft.startTime ? 'Ends the next day' : undefined}
                    />
                  </div>
                  <Input
                    label="Location (optional)"
                    value={draft.location}
                    onChange={(event) => setDraft({ ...draft, location: event.target.value })}
                    variant="bordered"
                  />
                </ModalBody>
                <ModalFooter className="justify-between">
                  <div>
                    {draft.shiftId && (
                      <Button
                        variant="flat"
                        color="danger"
                        onPress={() => {
                          deleteShift(draft.shiftId!);
                          setDraft(null);
                        }}
                      >
                        Delete
                      </Button>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="flat" onPress={() => setDraft(null)}>
                      Cancel
                    </Button>
                    <Button color="primary" onPress={save} isDisabled={!draftValid}>
                      Save
                    </Button>
                  </div>
                </ModalFooter>
              </>
            )
          }
        </ModalContent>
      </Modal>
    </div>
  );
}
