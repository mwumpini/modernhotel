'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Button, Card, CardBody, Chip, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Pagination, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow } from '@heroui/react';
import { useLeaveAttendanceStore } from '../../lib/hr/leaveAttendanceStore';
import type { Attendance } from '../../lib/hr/models';
import { useSettingsStore } from '../../lib/settings/store';
import type { DepartmentStaffMember } from '../../lib/hr/useDepartmentStaff';
import RequestOvertimeButton from './RequestOvertimeButton';
import { printSimpleReport } from '../../lib/print/simpleReport';
import { dayKey } from '../../lib/hr/leaveDates';
import { sizedTableClassNames, useResizableColumns } from '../frontoffice/columnResize';
import { deskTableCardBodyClassName, deskTableCardClassName, deskTableClassNames, SortHeader, toggleColumnSort, DESK_PAGE_SIZE, type ColumnSort } from '../dashboard/deskTableUi';

/**
 * Read-only overtime record for one department's own staff, plus the
 * "Request Overtime" entry point — same underlying Attendance records HR &
 * Payroll's Overtime Management approves and Payroll pulls from (see
 * leaveAttendanceStore.ts). Approval itself still happens centrally in HR &
 * Payroll (and the Executive Approvals inbox above the director threshold);
 * this is visibility + submission for the department, not a second approval
 * surface.
 */
export default function DepartmentOvertimePanel({
  staff,
  departmentLabel,
  overtimePermissionId,
  departmentNameHints,
}: {
  staff: DepartmentStaffMember[];
  departmentLabel: string;
  overtimePermissionId: string;
  departmentNameHints: string[];
}) {
  const attendances = useLeaveAttendanceStore((s) => s.attendances);
  const hydrateAttendance = useLeaveAttendanceStore((s) => s.hydrateFromApi);
  useEffect(() => { void hydrateAttendance(); }, [hydrateAttendance]);

  const requireDirectorApproval = useSettingsStore((s) => s.financialSettings.requireApprovalForOvertime);
  const directorThreshold = useSettingsStore((s) => s.financialSettings.overtimeApprovalThreshold);
  const needsDirector = (hours: number) => requireDirectorApproval && hours >= directorThreshold;

  const staffIds = useMemo(() => new Set(staff.map((s) => s.id)), [staff]);
  const records = useMemo(
    () =>
      attendances
        .filter((a) => staffIds.has(a.employeeId) && (a.overtimeHours || 0) > 0)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [attendances, staffIds],
  );
  const [sort, setSort] = useState<ColumnSort>({ column: 'date', direction: 'desc' });
  const [page, setPage] = useState(1);
  const [selectedRecord, setSelectedRecord] = useState<Attendance | null>(null);
  const cols = useResizableColumns({
    employee: 160,
    date: 110,
    start: 80,
    end: 80,
    hours: 80,
    overtime: 90,
    status: 160,
  });

  const statusLabel = (a: (typeof records)[number]) => {
    if (a.approvedAt) return `Approved by ${a.approvedBy}`;
    if (needsDirector(a.overtimeHours || 0)) return 'Needs Director Approval';
    return 'Pending';
  };

  const formatClock = (value?: Date | string) => {
    if (!value) return '—';
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  const sortedRecords = useMemo(() => {
    const direction = sort.direction === 'asc' ? 1 : -1;
    const value = (record: (typeof records)[number]) => {
      const emp = staff.find((member) => member.id === record.employeeId);
      switch (sort.column) {
        case 'employee': return emp?.name || record.employeeId;
        case 'start': return record.checkInTime ? new Date(record.checkInTime).getTime() : 0;
        case 'end': return record.checkOutTime ? new Date(record.checkOutTime).getTime() : 0;
        case 'hours': return record.totalHours || 0;
        case 'overtime': return record.overtimeHours || 0;
        case 'status': return statusLabel(record);
        default: return new Date(record.date).getTime();
      }
    };
    return [...records].sort((a, b) => {
      const left = value(a);
      const right = value(b);
      if (typeof left === 'number' && typeof right === 'number') return (left - right) * direction;
      return String(left).localeCompare(String(right)) * direction;
    });
  }, [records, sort, staff]);

  const pages = Math.max(1, Math.ceil(sortedRecords.length / DESK_PAGE_SIZE));
  const pageSafe = Math.min(page, pages);
  const pagedRecords = sortedRecords.slice((pageSafe - 1) * DESK_PAGE_SIZE, pageSafe * DESK_PAGE_SIZE);

  useEffect(() => { setPage(1); }, [records.length]);

  const printRecords = () => {
    printSimpleReport(
      `${departmentLabel} — Overtime Records`,
      `${records.length} record${records.length === 1 ? '' : 's'}`,
      ['Employee', 'Date', 'Start', 'End', 'Hours', 'Overtime', 'Status'],
      records.map((a) => {
        const emp = staff.find((m) => m.id === a.employeeId);
        return [
          emp ? emp.name : a.employeeId,
          dayKey(a.date),
          formatClock(a.checkInTime),
          formatClock(a.checkOutTime),
          (a.totalHours || 0).toFixed(2),
          (a.overtimeHours || 0).toFixed(2),
          statusLabel(a),
        ];
      })
    );
  };

  return (
    <div className="space-y-3">
      <Card className={deskTableCardClassName}>
        <CardBody className={deskTableCardBodyClassName}>
          <div className="mb-[18px] flex flex-nowrap items-center justify-between gap-2 overflow-x-auto">
            <h3 className="text-base font-semibold text-slate-800 shrink-0">Overtime</h3>
            <Button size="sm" variant="bordered" onPress={printRecords}>Print</Button>
          </div>
          <div ref={cols.frameRef} style={cols.frameStyle}>
          <Table aria-label="Department overtime records" removeWrapper classNames={sizedTableClassNames(deskTableClassNames)}>
            <TableHeader>
              <TableColumn className="relative" style={cols.style('employee')}>{<SortHeader label="Employee" column="employee" sort={sort} onSort={(c) => setSort((p) => toggleColumnSort(p, c))} />}{cols.sizer('employee', 'Employee')}</TableColumn>
              <TableColumn className="relative" style={cols.style('date')}>{<SortHeader label="Date" column="date" sort={sort} onSort={(c) => setSort((p) => toggleColumnSort(p, c))} />}{cols.sizer('date', 'Date')}</TableColumn>
              <TableColumn className="relative" style={cols.style('start')}>{<SortHeader label="Start" column="start" sort={sort} onSort={(c) => setSort((p) => toggleColumnSort(p, c))} />}{cols.sizer('start', 'Start')}</TableColumn>
              <TableColumn className="relative" style={cols.style('end')}>{<SortHeader label="End" column="end" sort={sort} onSort={(c) => setSort((p) => toggleColumnSort(p, c))} />}{cols.sizer('end', 'End')}</TableColumn>
              <TableColumn className="relative" style={cols.style('hours')}>{<SortHeader label="Hours" column="hours" sort={sort} onSort={(c) => setSort((p) => toggleColumnSort(p, c))} align="right" />}{cols.sizer('hours', 'Hours')}</TableColumn>
              <TableColumn className="relative" style={cols.style('overtime')}>{<SortHeader label="Overtime" column="overtime" sort={sort} onSort={(c) => setSort((p) => toggleColumnSort(p, c))} align="right" />}{cols.sizer('overtime', 'Overtime')}</TableColumn>
              <TableColumn className="relative" style={cols.style('status')}>{<SortHeader label="Status" column="status" sort={sort} onSort={(c) => setSort((p) => toggleColumnSort(p, c))} />}{cols.sizer('status', 'Status')}</TableColumn>
            </TableHeader>
            <TableBody emptyContent="No overtime recorded for this department.">
              {pagedRecords.map((a) => {
                const emp = staff.find((m) => m.id === a.employeeId);
                const isApproved = !!a.approvedAt;
                const escalated = !isApproved && needsDirector(a.overtimeHours || 0);
                return (
                  <TableRow
                    key={a.id}
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => setSelectedRecord(a)}
                  >
                    <TableCell>
                      <span className="truncate block" title={emp ? emp.name : a.employeeId}>{emp ? emp.name : a.employeeId}</span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{dayKey(a.date)}</TableCell>
                    <TableCell className="whitespace-nowrap tabular-nums">{formatClock(a.checkInTime)}</TableCell>
                    <TableCell className="whitespace-nowrap tabular-nums">{formatClock(a.checkOutTime)}</TableCell>
                    <TableCell className="text-right tabular-nums">{(a.totalHours || 0).toFixed(2)}</TableCell>
                    <TableCell className="text-right tabular-nums">{(a.overtimeHours || 0).toFixed(2)}</TableCell>
                    <TableCell>
                      {isApproved ? (
                        <Chip size="sm" variant="flat" color="success">Approved by {a.approvedBy}</Chip>
                      ) : escalated ? (
                        <Chip size="sm" variant="flat" color="danger">Needs Director Approval</Chip>
                      ) : (
                        <Chip size="sm" variant="flat" color="warning">Pending</Chip>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          </div>
          <div className="mt-3 flex justify-end">
            <Pagination page={pageSafe} total={pages} onChange={setPage} showControls size="sm" />
          </div>
        </CardBody>
      </Card>

      <Modal isOpen={!!selectedRecord} onClose={() => setSelectedRecord(null)} size="md">
        <ModalContent>
          <ModalHeader>Overtime record</ModalHeader>
          <ModalBody>
            {selectedRecord && (() => {
              const emp = staff.find((m) => m.id === selectedRecord.employeeId);
              const isApproved = !!selectedRecord.approvedAt;
              const escalated = !isApproved && needsDirector(selectedRecord.overtimeHours || 0);
              return (
                <dl className="grid grid-cols-[7rem_1fr] gap-x-3 gap-y-2 text-sm">
                  <dt className="text-gray-500">Employee</dt>
                  <dd className="font-medium text-ghana-black">{emp ? emp.name : selectedRecord.employeeId}</dd>
                  <dt className="text-gray-500">Date</dt>
                  <dd>{dayKey(selectedRecord.date)}</dd>
                  <dt className="text-gray-500">Start</dt>
                  <dd className="tabular-nums">{formatClock(selectedRecord.checkInTime)}</dd>
                  <dt className="text-gray-500">End</dt>
                  <dd className="tabular-nums">{formatClock(selectedRecord.checkOutTime)}</dd>
                  <dt className="text-gray-500">Hours</dt>
                  <dd className="tabular-nums">{(selectedRecord.totalHours || 0).toFixed(2)}</dd>
                  <dt className="text-gray-500">Overtime</dt>
                  <dd className="tabular-nums">{(selectedRecord.overtimeHours || 0).toFixed(2)}</dd>
                  <dt className="text-gray-500">Status</dt>
                  <dd>
                    {isApproved ? (
                      <Chip size="sm" variant="flat" color="success">Approved by {selectedRecord.approvedBy}</Chip>
                    ) : escalated ? (
                      <Chip size="sm" variant="flat" color="danger">Needs Director Approval</Chip>
                    ) : (
                      <Chip size="sm" variant="flat" color="warning">Pending</Chip>
                    )}
                  </dd>
                  {selectedRecord.notes ? (
                    <>
                      <dt className="text-gray-500">Notes</dt>
                      <dd>{selectedRecord.notes}</dd>
                    </>
                  ) : null}
                </dl>
              );
            })()}
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={() => setSelectedRecord(null)}>Close</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <div className="space-y-3">
        <p className="text-sm text-slate-500">
          Submit overtime for the staff on this list. Approval stays in HR &amp; Payroll → Overtime
          Management (or the Director above the tenant threshold). This tab does not invent hours.
        </p>
        <RequestOvertimeButton
          departmentLabel={departmentLabel}
          permissionId={overtimePermissionId}
          departmentNameHints={departmentNameHints}
          staff={staff}
        />
      </div>
    </div>
  );
}
