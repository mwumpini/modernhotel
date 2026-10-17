'use client';

import React from 'react';
import { Button, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from '@heroui/react';
import { useEmployeeStore } from '@/app/lib/hr/employeeStore';
import { useLeaveAttendanceStore } from '@/app/lib/hr/leaveAttendanceStore';
import { LEAVE_TYPE_OPTIONS, normalizeLeavePolicy, resolveLeaveBandId, type LeaveBandId, type LeavePolicy } from '@/app/lib/hr/leavePolicy';
import type { LeaveRequest } from '@/app/lib/hr/models';

/** Hotel-wide Staff and Management leave days, plus who sits in each group. */
export default function LeaveAllowancesEditor() {
  const policy = useLeaveAttendanceStore((s) => s.leavePolicy);
  const saveLeavePolicy = useLeaveAttendanceStore((s) => s.saveLeavePolicy);
  const employees = useEmployeeStore((s) => s.employees);
  const departments = useEmployeeStore((s) => s.departments);
  const updateEmployee = useEmployeeStore((s) => s.updateEmployee);

  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<LeavePolicy>(policy);
  const [assignments, setAssignments] = React.useState<Record<string, LeaveBandId>>({});
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState('');

  const people = React.useMemo(
    () => employees
      .filter((e) => e.status !== 'terminated' && e.status !== 'inactive')
      .slice()
      .sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`)),
    [employees],
  );

  const openEditor = () => {
    setDraft(normalizeLeavePolicy(policy));
    setAssignments(Object.fromEntries(people.map((e) => [e.id, resolveLeaveBandId(e, departments)])));
    setError('');
    setOpen(true);
  };

  const setDays = (bandId: LeaveBandId, leaveType: LeaveRequest['leaveType'], raw: string) => {
    const n = raw === '' ? 0 : Math.max(0, Math.min(366, Math.round(Number(raw) || 0)));
    setDraft((current) => ({
      ...current,
      bands: current.bands.map((band) => (
        band.id === bandId
          ? { ...band, entitlements: { ...band.entitlements, [leaveType]: n } }
          : band
      )),
    }));
  };

  const closeType = (leaveType: LeaveRequest['leaveType']) => {
    setDraft((current) => {
      const closed = current.closedTypes || [];
      const stillOpen = LEAVE_TYPE_OPTIONS.filter((type) => !closed.includes(type.key) && type.key !== leaveType);
      if (stillOpen.length === 0) return current;
      return { ...current, closedTypes: [...closed, leaveType] };
    });
  };

  const reopenType = (leaveType: LeaveRequest['leaveType']) => {
    setDraft((current) => ({ ...current, closedTypes: (current.closedTypes || []).filter((key) => key !== leaveType) }));
  };

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      await saveLeavePolicy(draft);
      for (const person of people) {
        const chosen = assignments[person.id];
        if (!chosen || chosen === resolveLeaveBandId(person, departments)) continue;
        updateEmployee(person.id, { leaveBand: chosen });
      }
      setOpen(false);
    } catch {
      setError('Could not save the allowances. Try again.');
    } finally {
      setSaving(false);
    }
  };

  const staff = draft.bands.find((b) => b.id === 'staff');
  const management = draft.bands.find((b) => b.id === 'management');
  const closed = new Set(draft.closedTypes || []);
  const openTypes = LEAVE_TYPE_OPTIONS.filter((type) => !closed.has(type.key));
  const closedTypes = LEAVE_TYPE_OPTIONS.filter((type) => closed.has(type.key));

  return (
    <>
      <Button size="sm" color="primary" onPress={openEditor}>Allowances</Button>
      <Modal isOpen={open} onClose={() => setOpen(false)} size="3xl" scrollBehavior="inside">
        <ModalContent>
          <ModalHeader>Leave allowances</ModalHeader>
          <ModalBody>
            <p className="text-sm text-gray-500">
              Set the days each group receives for the year. People in the Management department start in the Management group. Move anyone whose job should follow the other allowance. Use × to close a leave type this hotel does not offer.
            </p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500">
                    <th className="py-1 pr-3 font-medium">Leave</th>
                    <th className="py-1 pr-3 font-medium">Staff days</th>
                    <th className="py-1 font-medium">Management days</th>
                    <th className="w-10 py-1" />
                  </tr>
                </thead>
                <tbody>
                  {openTypes.map((type) => (
                    <tr key={type.key} className="border-t border-gray-100">
                      <td className="py-2 pr-3">{type.label}</td>
                      <td className="py-2 pr-3">
                        <Input
                          size="sm"
                          type="number"
                          min={0}
                          max={366}
                          aria-label={`Staff ${type.label}`}
                          variant="bordered"
                          className="w-28"
                          value={String(staff?.entitlements[type.key] ?? 0)}
                          onValueChange={(v) => setDays('staff', type.key, v)}
                        />
                      </td>
                      <td className="py-2">
                        <div className="flex items-center gap-2">
                          <Input
                            size="sm"
                            type="number"
                            min={0}
                            max={366}
                            aria-label={`Management ${type.label}`}
                            variant="bordered"
                            className="w-28"
                            value={String(management?.entitlements[type.key] ?? 0)}
                            onValueChange={(v) => setDays('management', type.key, v)}
                          />
                          <button
                            type="button"
                            aria-label={`Close ${type.label}`}
                            title={openTypes.length === 1 ? 'Keep at least one leave type' : `Close ${type.label}`}
                            disabled={openTypes.length === 1}
                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-lg leading-none text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-30"
                            onClick={() => closeType(type.key)}
                          >
                            ×
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {closedTypes.length > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-gray-500">
                <span>Closed</span>
                {closedTypes.map((type) => (
                  <button
                    key={type.key}
                    type="button"
                    className="rounded-full border border-gray-300 px-2 py-0.5 hover:bg-gray-50"
                    onClick={() => reopenType(type.key)}
                  >
                    {type.label} · add back
                  </button>
                ))}
              </div>
            )}
            <div className="mt-4 font-medium text-sm">Who is in each group</div>
            <div className="mt-2 max-h-64 overflow-y-auto rounded-lg border border-gray-200">
              {people.map((person) => {
                const department = departments.find((d) => d.id === person.departmentId)?.name || '—';
                const name = `${person.firstName} ${person.lastName}`;
                return (
                  <div key={person.id} className="flex items-center gap-3 border-b border-gray-100 px-3 py-2 last:border-b-0">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{name}</div>
                      <div className="truncate text-xs text-gray-500">{department}</div>
                    </div>
                    <select
                      aria-label={`Allowance group for ${name}`}
                      className="rounded-md border border-gray-300 bg-transparent px-2 py-1 text-sm"
                      value={assignments[person.id] || 'staff'}
                      onChange={(e) => setAssignments((current) => ({ ...current, [person.id]: e.target.value as LeaveBandId }))}
                    >
                      <option value="staff">Staff</option>
                      <option value="management">Management</option>
                    </select>
                  </div>
                );
              })}
            </div>
            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={() => setOpen(false)} isDisabled={saving}>Cancel</Button>
            <Button color="primary" onPress={save} isLoading={saving}>Save allowances</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}
