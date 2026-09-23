'use client';

import React from 'react';
import { useSession } from 'next-auth/react';
import {
  Button, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter,
  Select, SelectItem, Input, Textarea, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, Divider,
} from '@heroui/react';
import { useEmployeeStore } from '../../lib/hr/employeeStore';
import { useLeaveAttendanceStore } from '../../lib/hr/leaveAttendanceStore';
import { useSettingsStore } from '../../lib/settings/store';
import type { DepartmentStaffMember } from '../../lib/hr/useDepartmentStaff';
import { todayKey } from '../../lib/hr/leaveDates';

interface OvertimeRow {
  rowId: string;
  employeeId: string;
  startTime: string;
  endTime: string;
  rate: number;
}

const emptyRow = (): OvertimeRow => ({
  rowId: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
  employeeId: '', startTime: '', endTime: '', rate: 0,
});

function computeHours(startTime: string, endTime: string): number | null {
  if (!startTime || !endTime) return null;
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  let mins = (eh * 60 + em) - (sh * 60 + sm);
  if (mins <= 0) mins += 24 * 60; // overnight shift
  return mins / 60;
}

/**
 * "Request Overtime" entry point shared by every department that can submit
 * one (Front Office, Kitchen, Restaurant & Bar, ...) — same shape as the
 * shared DepartmentRequisitionModal (multi-row, one submission for the whole
 * shift's staff instead of one modal round-trip per person). Each row still
 * becomes its own Attendance record — same underlying data HR & Payroll's
 * Overtime Management approves and Payroll pulls from (see
 * leaveAttendanceStore.ts) — just reachable from the requesting department's
 * own dashboard instead of requiring HR to log it.
 *
 * `departmentNameHints` best-effort-scopes the employee picker to this
 * department's own HR Department record(s) by name match (e.g. a "Front
 * Desk" or "Reception" department for hint "front") — departments are
 * tenant-created free-text, not tied to the RBAC module key, so this can't
 * be exact. Falls back to every active employee when nothing matches,
 * rather than blocking the requester on an HR setup step.
 */
export default function RequestOvertimeButton({
  departmentLabel,
  permissionId,
  departmentNameHints = [],
  staff,
}: {
  departmentLabel: string;
  permissionId: string;
  departmentNameHints?: string[];
  /** When set, the picker is this department list only — no fallback to the whole hotel. */
  staff?: DepartmentStaffMember[];
}) {
  const canLog = useSettingsStore((s) => s.hasPermission(permissionId));
  const { data: session } = useSession();
  const requesterName = (session?.user as any)?.name || (session?.user as any)?.email || departmentLabel;

  const employees = useEmployeeStore((s) => s.employees);
  const departments = useEmployeeStore((s) => s.departments);
  const hydrateEmployees = useEmployeeStore((s) => s.hydrateFromApi);
  const logManualOvertime = useLeaveAttendanceStore((s) => s.logManualOvertime);
  const hydrateAttendance = useLeaveAttendanceStore((s) => s.hydrateFromApi);

  const [isOpen, setIsOpen] = React.useState(false);
  const [date, setDate] = React.useState(() => todayKey());
  const [rows, setRows] = React.useState<OvertimeRow[]>([emptyRow()]);
  const [notes, setNotes] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  const scopedEmployees = React.useMemo(() => {
    const active = employees.filter((e) => e.status === 'active');
    if (staff?.length) {
      const allowed = new Set(staff.map((row) => row.id));
      return active.filter((employee) => allowed.has(employee.id));
    }
    if (departmentNameHints.length === 0) return active;
    const matchingDeptIds = new Set(
      departments.filter((d) => departmentNameHints.some((h) => d.name.toLowerCase().includes(h))).map((d) => d.id)
    );
    if (matchingDeptIds.size === 0) return [];
    return active.filter((e) => matchingDeptIds.has(e.departmentId));
  }, [employees, departments, departmentNameHints, staff]);

  if (!canLog) {
    return (
      <p className="text-sm text-slate-500">
        You do not have permission to submit overtime from {departmentLabel}.
      </p>
    );
  }

  const handleOpen = () => {
    void hydrateEmployees();
    void hydrateAttendance();
    setDate(todayKey());
    setRows([emptyRow()]);
    setNotes('');
    setIsOpen(true);
  };

  const addRow = () => setRows((prev) => [...prev, emptyRow()]);
  const removeRow = (rowId: string) => setRows((prev) => prev.filter((r) => r.rowId !== rowId));
  const updateRow = (rowId: string, updates: Partial<OvertimeRow>) =>
    setRows((prev) => prev.map((r) => (r.rowId === rowId ? { ...r, ...updates } : r)));

  const selectEmployee = (rowId: string, employeeId: string) => {
    const emp = scopedEmployees.find((e) => e.id === employeeId);
    updateRow(rowId, { employeeId, rate: Number((emp as any)?.hourlyRate || 0) });
  };

  const validRows = rows.filter((r) => r.employeeId && r.startTime && r.endTime && (computeHours(r.startTime, r.endTime) || 0) > 0);
  const totalCost = validRows.reduce((sum, r) => sum + (computeHours(r.startTime, r.endTime) || 0) * r.rate, 0);

  const handleSubmit = async () => {
    if (validRows.length === 0) return;
    setSaving(true);
    try {
      for (const row of validRows) {
        logManualOvertime(
          row.employeeId,
          new Date(`${date}T00:00:00`),
          new Date(`${date}T${row.startTime}:00`),
          new Date(`${date}T${row.endTime}:00`),
          `[${departmentLabel}] ${notes || 'Overtime request'}`
        );
      }
      setIsOpen(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Button size="sm" color="primary" variant="flat" onPress={handleOpen}>
        ⏱️ Request Overtime
      </Button>
      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} size="4xl" scrollBehavior="inside">
        <ModalContent>
          <ModalHeader>Request Overtime — {departmentLabel}</ModalHeader>
          <ModalBody>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Requested By" value={requesterName} isDisabled />
              <Input label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} isRequired />
            </div>

            <Divider />

            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold">Staff on Overtime</h4>
                <Button size="sm" color="primary" onPress={addRow}>+ Add Staff</Button>
              </div>
              <Table aria-label="Overtime rows" className="[&_thead]:hidden">
                <TableHeader>
                  <TableColumn>Employee</TableColumn>
                  <TableColumn>Start</TableColumn>
                  <TableColumn>End</TableColumn>
                  <TableColumn>Hours</TableColumn>
                  <TableColumn>Rate (₵/hr)</TableColumn>
                  <TableColumn>Est. Cost</TableColumn>
                  <TableColumn>Action</TableColumn>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => {
                    const hours = computeHours(row.startTime, row.endTime);
                    const cost = (hours || 0) * row.rate;
                    return (
                      <TableRow key={row.rowId}>
                        <TableCell className="w-[26%]">
                          <Select
                            size="sm"
                            placeholder="Employee"
                            selectedKeys={row.employeeId ? [row.employeeId] : []}
                            onSelectionChange={(k) => selectEmployee(row.rowId, Array.from(k)[0] as string)}
                          >
                            {scopedEmployees.length === 0 ? (
                              <SelectItem key="none" textValue="No department staff" isDisabled>No department staff</SelectItem>
                            ) : scopedEmployees.map((e) => {
                              const name = `${e.firstName} ${e.lastName}`.trim();
                              return <SelectItem key={e.id} textValue={name}>{name}</SelectItem>;
                            })}
                          </Select>
                        </TableCell>
                        <TableCell className="w-[13%]">
                          <Input size="sm" type="time" value={row.startTime} onChange={(e) => updateRow(row.rowId, { startTime: e.target.value })} />
                        </TableCell>
                        <TableCell className="w-[13%]">
                          <Input size="sm" type="time" value={row.endTime} onChange={(e) => updateRow(row.rowId, { endTime: e.target.value })} />
                        </TableCell>
                        <TableCell className="w-[10%] text-center">
                          {hours !== null ? hours.toFixed(2) : '—'}
                        </TableCell>
                        <TableCell className="w-[15%]">
                          <Input size="sm" type="number" startContent="₵" value={String(row.rate)} onChange={(e) => updateRow(row.rowId, { rate: parseFloat(e.target.value) || 0 })} />
                        </TableCell>
                        <TableCell className="w-[13%] text-right font-semibold">
                          {row.rate > 0
                            ? `₵${cost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                            : '—'}
                        </TableCell>
                        <TableCell className="w-[10%]">
                          <Button size="sm" color="danger" variant="flat" onPress={() => removeRow(row.rowId)} isDisabled={rows.length === 1}>🗑️</Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="flex justify-between">
                <span className="text-lg font-bold">Estimated Total Cost:</span>
                <span className="text-lg font-bold">
                  {totalCost > 0
                    ? `₵${totalCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    : '—'}
                </span>
              </div>
            </div>

            <Textarea label="Reason (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Applies to every staff member on this request" />
            <p className="text-xs text-gray-500">
              Submitted as pending — goes to Payroll/HR for approval (or the Director if a request is above the
              tenant's overtime threshold) in HR &amp; Payroll → Overtime Management.
            </p>
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={() => setIsOpen(false)}>Cancel</Button>
            <Button color="primary" isLoading={saving} isDisabled={validRows.length === 0} onPress={handleSubmit}>
              Submit Request{validRows.length > 1 ? ` (${validRows.length})` : ''}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}
