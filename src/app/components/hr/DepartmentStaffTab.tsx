'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Button, Card, CardBody, Chip, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Pagination, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow } from '@heroui/react';
import { useDepartmentStaff, type DepartmentStaffMember } from '../../lib/hr/useDepartmentStaff';
import DepartmentShiftsPanel from './DepartmentShiftsPanel';
import DepartmentOvertimePanel from './DepartmentOvertimePanel';
import { printSimpleReport } from '../../lib/print/simpleReport';
import { sizedTableClassNames, useResizableColumns } from '../frontoffice/columnResize';
import { deskTableCardBodyClassName, deskTableCardClassName, deskTableClassNames, SortHeader, toggleColumnSort, DESK_PAGE_SIZE, type ColumnSort } from '../dashboard/deskTableUi';

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
  /** @deprecated No longer rendered; accepted for call-site compat. */
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
  const fetched = useDepartmentStaff(departmentNameHints, excludeNameHints, !preloadedStaff, alsoStaffNames);
  const staff = preloadedStaff ?? fetched.members;
  const listEmpty = (preloadedStaff || fetched.hasDepartment)
    ? `No staff in ${departmentLabel} yet.`
    : (emptyLabel || `No ${departmentLabel} department in HR.`);

  const [section, setSection] = useState('list');
  const [sort, setSort] = useState<ColumnSort>({ column: 'name', direction: 'asc' });
  const [page, setPage] = useState(1);
  const [selectedMember, setSelectedMember] = useState<DepartmentStaffMember | null>(null);
  const cols = useResizableColumns({
    name: 180,
    position: 140,
    department: 140,
    employmentType: 130,
    status: 110,
  });
  const sections = [
    { key: 'list', label: '👥 Staff List' },
    { key: 'shifts', label: '🕐 Shift Scheduling' },
    { key: 'overtime', label: '⏱️ Overtime' },
    ...extraTabs.map((tab) => ({ key: tab.key, label: tab.title })),
  ];

  const sortedStaff = useMemo(() => {
    const direction = sort.direction === 'asc' ? 1 : -1;
    const value = (member: DepartmentStaffMember) => {
      switch (sort.column) {
        case 'position': return member.position || '';
        case 'department': return member.department || '';
        case 'employmentType': return member.employmentType || '';
        case 'status': return member.status || '';
        default: return member.name || '';
      }
    };
    return [...staff].sort((a, b) => String(value(a)).localeCompare(String(value(b))) * direction);
  }, [staff, sort]);

  const pages = Math.max(1, Math.ceil(sortedStaff.length / DESK_PAGE_SIZE));
  const pageSafe = Math.min(page, pages);
  const pagedStaff = sortedStaff.slice((pageSafe - 1) * DESK_PAGE_SIZE, pageSafe * DESK_PAGE_SIZE);

  useEffect(() => { setPage(1); }, [staff.length]);

  const printStaffList = () => {
    printSimpleReport(
      `${departmentLabel} — Staff List`,
      `${staff.length} staff member${staff.length === 1 ? '' : 's'}`,
      ['Staff Member', 'Position', 'Department', 'Employment Type', 'Status'],
      staff.map((m) => [m.name, m.position, m.department, m.employmentType, m.status])
    );
  };

  return (
    <div className="mt-4 space-y-3">
      <div
        role="tablist"
        aria-label="Staff management sections"
        className="flex w-full flex-nowrap gap-1 overflow-x-auto rounded-lg border border-gray-200 bg-gray-50 p-1 scrollbar-thin"
      >
        {sections.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={section === tab.key}
            onClick={() => setSection(tab.key)}
            className={`min-h-9 flex-shrink-0 whitespace-nowrap rounded-md px-3 text-sm transition-colors ${
              section === tab.key
                ? 'bg-white font-semibold text-ghana-black shadow-sm'
                : 'text-gray-600 hover:bg-white/60 hover:text-ghana-black'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {section === 'list' && (
        <Card className={deskTableCardClassName}>
          <CardBody className={deskTableCardBodyClassName}>
            <div className="mb-[18px] flex flex-wrap items-center justify-end gap-2">
              <Button size="sm" variant="bordered" className="shrink-0" onPress={printStaffList}>Print</Button>
            </div>
            <div ref={cols.frameRef} style={cols.frameStyle}>
            <Table aria-label="Department staff table" removeWrapper classNames={sizedTableClassNames(deskTableClassNames)}>
              <TableHeader>
                <TableColumn className="relative" style={cols.style('name')}>{<SortHeader label="Staff member" column="name" sort={sort} onSort={(c) => setSort((p) => toggleColumnSort(p, c))} />}{cols.sizer('name', 'Staff member')}</TableColumn>
                <TableColumn className="relative" style={cols.style('position')}>{<SortHeader label="Position" column="position" sort={sort} onSort={(c) => setSort((p) => toggleColumnSort(p, c))} />}{cols.sizer('position', 'Position')}</TableColumn>
                <TableColumn className="relative" style={cols.style('department')}>{<SortHeader label="Department" column="department" sort={sort} onSort={(c) => setSort((p) => toggleColumnSort(p, c))} />}{cols.sizer('department', 'Department')}</TableColumn>
                <TableColumn className="relative" style={cols.style('employmentType')}>{<SortHeader label="Employment type" column="employmentType" sort={sort} onSort={(c) => setSort((p) => toggleColumnSort(p, c))} />}{cols.sizer('employmentType', 'Employment type')}</TableColumn>
                <TableColumn className="relative" style={cols.style('status')}>{<SortHeader label="Status" column="status" sort={sort} onSort={(c) => setSort((p) => toggleColumnSort(p, c))} />}{cols.sizer('status', 'Status')}</TableColumn>
              </TableHeader>
              <TableBody emptyContent={listEmpty}>
                {pagedStaff.map((member) => (
                  <TableRow
                    key={member.id}
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => setSelectedMember(member)}
                  >
                    <TableCell>
                      <p className="font-medium text-ghana-black truncate" title={member.name}>{member.name}</p>
                    </TableCell>
                    <TableCell>
                      <span className="truncate block" title={member.position}>{member.position}</span>
                    </TableCell>
                    <TableCell>
                      <span className="truncate block" title={member.department}>{member.department}</span>
                    </TableCell>
                    <TableCell>
                      <Chip size="sm" variant="flat" color="primary">
                        {String(member.employmentType || '—').replace(/_/g, ' ')}
                      </Chip>
                    </TableCell>
                    <TableCell>
                      <Chip color={statusColor(member.status) as any} size="sm" variant="flat">
                        {member.status?.charAt(0).toUpperCase() + member.status?.slice(1).replace('_', ' ')}
                      </Chip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
            <div className="mt-3 flex justify-end">
              <Pagination page={pageSafe} total={pages} onChange={setPage} showControls size="sm" />
            </div>
          </CardBody>
        </Card>
      )}

      <Modal isOpen={!!selectedMember} onClose={() => setSelectedMember(null)} size="md">
        <ModalContent>
          <ModalHeader>Staff member</ModalHeader>
          <ModalBody>
            {selectedMember && (
              <dl className="grid grid-cols-[7rem_1fr] gap-x-3 gap-y-2 text-sm">
                <dt className="text-gray-500">Name</dt>
                <dd className="font-medium text-ghana-black">{selectedMember.name}</dd>
                <dt className="text-gray-500">Position</dt>
                <dd>{selectedMember.position || '—'}</dd>
                <dt className="text-gray-500">Department</dt>
                <dd>{selectedMember.department || '—'}</dd>
                <dt className="text-gray-500">Employment</dt>
                <dd>{String(selectedMember.employmentType || '—').replace(/_/g, ' ')}</dd>
                <dt className="text-gray-500">Status</dt>
                <dd>
                  <Chip color={statusColor(selectedMember.status) as any} size="sm" variant="flat">
                    {selectedMember.status?.charAt(0).toUpperCase() + selectedMember.status?.slice(1).replace('_', ' ')}
                  </Chip>
                </dd>
              </dl>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={() => setSelectedMember(null)}>Close</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {section === 'shifts' && (
        <DepartmentShiftsPanel staff={staff} departmentLabel={departmentLabel} />
      )}

      {section === 'overtime' && (
        <DepartmentOvertimePanel
          staff={staff}
          departmentLabel={departmentLabel}
          overtimePermissionId={overtimePermissionId}
          departmentNameHints={departmentNameHints}
        />
      )}

      {extraTabs.map((tab) => section === tab.key ? <div key={tab.key}>{tab.render(staff)}</div> : null)}
    </div>
  );
}
