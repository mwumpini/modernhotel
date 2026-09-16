'use client';

import React from 'react';
import { Button, Card, CardBody, CardHeader, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow, Chip } from '@heroui/react';
import { useLeaveAttendanceStore } from '../../lib/hr/leaveAttendanceStore';
import { useSettingsStore } from '../../lib/settings/store';
import type { DepartmentStaffMember } from '../../lib/hr/useDepartmentStaff';
import RequestOvertimeButton from './RequestOvertimeButton';
import { printSimpleReport } from '../../lib/print/simpleReport';

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
  React.useEffect(() => { void hydrateAttendance(); }, [hydrateAttendance]);

  const requireDirectorApproval = useSettingsStore((s) => s.financialSettings.requireApprovalForOvertime);
  const directorThreshold = useSettingsStore((s) => s.financialSettings.overtimeApprovalThreshold);
  const needsDirector = (hours: number) => requireDirectorApproval && hours >= directorThreshold;

  const staffIds = React.useMemo(() => new Set(staff.map((s) => s.id)), [staff]);
  const records = attendances
    .filter((a) => staffIds.has(a.employeeId) && (a.overtimeHours || 0) > 0)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const statusLabel = (a: (typeof records)[number]) => {
    if (a.approvedAt) return `Approved by ${a.approvedBy}`;
    if (needsDirector(a.overtimeHours || 0)) return 'Needs Director Approval';
    return 'Pending';
  };

  const printRecords = () => {
    printSimpleReport(
      `${departmentLabel} — Overtime Records`,
      `${records.length} record${records.length === 1 ? '' : 's'}`,
      ['Employee', 'Date', 'Hours', 'Overtime', 'Status'],
      records.map((a) => {
        const emp = staff.find((m) => m.id === a.employeeId);
        return [
          emp ? emp.name : a.employeeId,
          new Date(a.date).toLocaleDateString(),
          (a.totalHours || 0).toFixed(2),
          (a.overtimeHours || 0).toFixed(2),
          statusLabel(a),
        ];
      })
    );
  };

  return (
    <div className="p-6 space-y-4">
      <Card>
        <CardHeader className="flex items-center justify-between">
          <div className="font-medium">Overtime Records</div>
          <Button size="sm" color="primary" variant="flat" onPress={printRecords}>🖨️ Print</Button>
        </CardHeader>
        <CardBody>
          <Table aria-label="Department overtime records">
            <TableHeader>
              <TableColumn>EMPLOYEE</TableColumn>
              <TableColumn>DATE</TableColumn>
              <TableColumn>HOURS</TableColumn>
              <TableColumn>OVERTIME</TableColumn>
              <TableColumn>STATUS</TableColumn>
            </TableHeader>
            <TableBody emptyContent="No overtime recorded for this department.">
              {records.map((a) => {
                const emp = staff.find((m) => m.id === a.employeeId);
                const isApproved = !!a.approvedAt;
                const escalated = !isApproved && needsDirector(a.overtimeHours || 0);
                return (
                  <TableRow key={a.id}>
                    <TableCell>{emp ? emp.name : a.employeeId}</TableCell>
                    <TableCell>{new Date(a.date).toLocaleDateString()}</TableCell>
                    <TableCell>{(a.totalHours || 0).toFixed(2)}</TableCell>
                    <TableCell>{(a.overtimeHours || 0).toFixed(2)}</TableCell>
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
        </CardBody>
      </Card>

      <div className="space-y-3">
        <p className="text-sm text-gray-500">
          Submit an overtime request for staff in this department. It goes to Payroll/HR for approval (or
          the Director if it's above the tenant's overtime threshold) — see HR &amp; Payroll → Overtime
          Management for the full approval history.
        </p>
        <RequestOvertimeButton
          departmentLabel={departmentLabel}
          permissionId={overtimePermissionId}
          departmentNameHints={departmentNameHints}
        />
      </div>
    </div>
  );
}
