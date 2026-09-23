'use client';

import { useEffect, useState } from 'react';
import { getClientTenantSubdomain } from '../api/clientTenant';

function hrHeaders() {
  return { 'Content-Type': 'application/json', 'x-tenant-subdomain': getClientTenantSubdomain() };
}

export interface DepartmentStaffMember {
  id: string;
  name: string;
  position: string;
  department: string;
  employmentType: string;
  status: string;
}

/**
 * Real HR employee/department/position records, filtered to this department
 * by best-effort name match — shared by DepartmentStaffTab (the "Staff
 * Management" tab) and any summary card that needs the same list (e.g. an
 * "Active Staff" count), so both read from one fetch instead of duplicating
 * it. `departmentNameHints`/`excludeNameHints` match DepartmentStaffTab's own
 * props exactly.
 */
export function useDepartmentStaff(
  departmentNameHints: string[],
  excludeNameHints: string[] = [],
  enabled = true,
  alsoStaffNames: string[] = [],
) {
  const [staff, setStaff] = useState<DepartmentStaffMember[]>([]);

  useEffect(() => {
    if (!enabled) return;
    const headers = hrHeaders();
    const assignedNames = new Set(
      alsoStaffNames
        .map((name) => String(name || '').trim().toLowerCase())
        .filter((name) => name && name !== 'unassigned')
    );
    Promise.all([
      fetch('/api/hr/employees', { headers }).then((r) => (r.ok ? r.json() : { employees: [] })),
      fetch('/api/hr/departments', { headers }).then((r) => (r.ok ? r.json() : { departments: [] })),
      fetch('/api/hr/positions', { headers }).then((r) => (r.ok ? r.json() : { positions: [] })),
    ]).then(([empData, deptData, posData]) => {
      const departments = deptData.departments || [];
      const positions = posData.positions || [];
      const matchingDeptIds = new Set(
        departments
          .filter((d: any) => {
            const name = (d.name || '').toLowerCase();
            if (excludeNameHints.some((h) => name.includes(h))) return false;
            return departmentNameHints.some((h) => name.includes(h));
          })
          .map((d: any) => d.id)
      );
      const deptById = new Map<string, string>(departments.map((d: any) => [d.id, d.name]));
      const posById = new Map<string, string>(positions.map((p: any) => [p.id, p.title]));
      const employees = (empData.employees || []) as any[];
      setStaff(
        employees
          .filter((e) => {
            const fullName = `${e.firstName || ''} ${e.lastName || ''}`.trim().toLowerCase();
            return matchingDeptIds.has(e.departmentId) || assignedNames.has(fullName);
          })
          .map((e) => ({
            id: e.id,
            name: `${e.firstName} ${e.lastName}`.trim(),
            position: posById.get(e.positionId) || 'Unassigned',
            department: deptById.get(e.departmentId) || 'Unknown',
            employmentType: e.employmentType,
            status: e.status,
          }))
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [departmentNameHints.join(','), excludeNameHints.join(','), alsoStaffNames.join(','), enabled]);

  return staff;
}
