'use client';

import React from 'react';
import { Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, Badge, Chip, Tabs, Tab, Button } from '@heroui/react';
import { useDepartmentStaff, type DepartmentStaffMember } from '../../lib/hr/useDepartmentStaff';
import DepartmentShiftsPanel from './DepartmentShiftsPanel';
import DepartmentOvertimePanel from './DepartmentOvertimePanel';
import { printSimpleReport } from '../../lib/print/simpleReport';

function statusColor(status: string) {
  switch (status) {
    case 'active': return 'success';
    case 'on_leave': return 'warning';
    case 'suspended': return 'danger';
    case 'terminated': return 'danger';
    default: return 'default';
  }
}

/**
 * "Staff Management" tab shared by every department (Kitchen, Restaurant &
 * Bar, and now the rest) — consolidates a staff list, shift scheduling (with
 * a printable weekly grid), and overtime (records + request) into one place,
 * all scoped to this department's own HR-record staff via useDepartmentStaff.
 * `departmentNameHints` best-effort-matches this department's own HR
 * Department record(s) by name (case-insensitive substring) — departments
 * are tenant-created free-text, not tied to the RBAC module key, so this
 * can't be exact.
 */
export default function DepartmentStaffTab({
  departmentLabel,
  overtimePermissionId,
  departmentNameHints,
  excludeNameHints = [],
  emptyLabel,
  helperText,
  staff: preloadedStaff,
  alsoStaffNames = [],
  extraTabs = [],
}: {
  departmentLabel: string;
  overtimePermissionId: string;
  departmentNameHints: string[];
  /** Departments matching one of these are excluded even if they also match a
   * departmentNameHint — e.g. Restaurant & Bar matches "food"/"beverage" but
   * must not pick up a "Kitchen" department that also contains "food". */
  excludeNameHints?: string[];
  emptyLabel?: string;
  helperText?: string;
  /** Pass this when the parent already calls useDepartmentStaff itself (e.g.
   * for its own staff-count summary card) so the list isn't fetched twice. */
  staff?: DepartmentStaffMember[];
  /** Extra HR names to include even when they sit in another department
   * (e.g. coordinators already assigned on live event bookings). */
  alsoStaffNames?: string[];
  /** Optional extra tabs (e.g. Housekeeping room responsibilities). Receives the same staff list. */
  extraTabs?: { key: string; title: string; render: (staff: DepartmentStaffMember[]) => React.ReactNode }[];
}) {
  const fetchedStaff = useDepartmentStaff(departmentNameHints, excludeNameHints, !preloadedStaff, alsoStaffNames);
  const staff = preloadedStaff ?? fetchedStaff;
  const listHelper =
    helperText ||
    `HR staff in a ${departmentLabel} department. Names come from the HR file — this tab does not invent staff.`;
  const listEmpty = emptyLabel || `No ${departmentLabel} department in HR.`;

  const printStaffList = () => {
    printSimpleReport(
      `${departmentLabel} — Staff List`,
      `${staff.length} staff member${staff.length === 1 ? '' : 's'}`,
      ['Staff Member', 'Position', 'Department', 'Employment Type', 'Status'],
      staff.map((m) => [m.name, m.position, m.department, m.employmentType, m.status])
    );
  };

  return (
    <div className="p-6">
      <Tabs aria-label="Staff management sections">
        <Tab key="list" title="👥 Staff List">
          <div className="pt-4">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-slate-500">
                {listHelper}
              </p>
              <Button size="sm" color="primary" variant="flat" onPress={printStaffList}>Print</Button>
            </div>
            <Table aria-label="Department staff table">
              <TableHeader>
                <TableColumn>STAFF MEMBER</TableColumn>
                <TableColumn>POSITION</TableColumn>
                <TableColumn>DEPARTMENT</TableColumn>
                <TableColumn>EMPLOYMENT TYPE</TableColumn>
                <TableColumn>STATUS</TableColumn>
              </TableHeader>
              <TableBody emptyContent={listEmpty}>
                {staff.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell>
                      <p className="font-medium text-ghana-black">{member.name}</p>
                    </TableCell>
                    <TableCell>{member.position}</TableCell>
                    <TableCell>{member.department}</TableCell>
                    <TableCell>
                      <Badge color="primary" variant="flat">{String(member.employmentType || '—').replace(/_/g, ' ')}</Badge>
                    </TableCell>
                    <TableCell>
                      <Chip color={statusColor(member.status) as any} size="sm">
                        {member.status?.charAt(0).toUpperCase() + member.status?.slice(1).replace('_', ' ')}
                      </Chip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Tab>

        <Tab key="shifts" title="🕐 Shift Scheduling">
          <DepartmentShiftsPanel staff={staff} departmentLabel={departmentLabel} />
        </Tab>

        <Tab key="overtime" title="⏱️ Overtime">
          <DepartmentOvertimePanel
            staff={staff}
            departmentLabel={departmentLabel}
            overtimePermissionId={overtimePermissionId}
            departmentNameHints={departmentNameHints}
          />
        </Tab>

        {extraTabs.map((tab) => (
          <Tab key={tab.key} title={tab.title}>
            {tab.render(staff)}
          </Tab>
        ))}
      </Tabs>
    </div>
  );
}
