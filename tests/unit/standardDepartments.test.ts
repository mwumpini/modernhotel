import { describe, expect, it } from 'vitest';
import { focusHrStructure, planStandardDepartments, STANDARD_DEPARTMENTS } from '@/app/lib/hr/standardDepartments';

describe('Standard departments and positions', () => {
  it('a full hotel gets every department, with only the focused jobs', () => {
    const plan = planStandardDepartments({ tenant: 'demo', modules: {}, departments: [], positions: [] });
    expect(plan.departments.map((d) => d.name)).toEqual(STANDARD_DEPARTMENTS.map((d) => d.name));
    expect(plan.positions).toHaveLength(STANDARD_DEPARTMENTS.reduce((n, d) => n + d.positions.length, 0));
    expect(plan.positions.map((p) => p.title)).not.toContain('Porter');
    expect(plan.positions.map((p) => p.title)).not.toContain('Electrician');
    expect(plan.positions.map((p) => p.title)).not.toContain('Front Office Supervisor');
    for (const d of plan.departments) {
      const titles = plan.positions.filter((p) => p.departmentId === d.id).map((p) => p.title);
      expect(titles.length).toBeGreaterThan(0);
      expect(titles.length).toBeLessThanOrEqual(2);
      expect(new Set(titles).size).toBe(titles.length);
    }
  });

  it('a restaurant with rooms, housekeeping and security switched off gets no Front Office, Housekeeping or Security', () => {
    const plan = planStandardDepartments({ tenant: 'demo', modules: { frontOffice: false, housekeeping: false, security: false }, departments: [], positions: [] });
    const names = plan.departments.map((d) => d.name);
    expect(names).toContain('Food & Beverage');
    expect(names).toContain('Kitchen');
    expect(names).not.toContain('Front Office');
    expect(names).not.toContain('Housekeeping');
    expect(names).not.toContain('Security');
  });

  it('keeps what the business already has and only fills the gaps', () => {
    const plan = planStandardDepartments({
      tenant: 'demo',
      modules: {},
      departments: [{ id: 'my-fo', name: 'front office' }, { id: 'my-fb', name: 'Food and Beverage' }],
      positions: [{ title: 'Receptionist', departmentId: 'my-fo' }],
    });
    expect(plan.departments.some((d) => d.name === 'Front Office' || d.name === 'Food & Beverage')).toBe(false);
    const fo = plan.positions.filter((p) => p.departmentId === 'my-fo').map((p) => p.title);
    expect(fo).toContain('Night Auditor');
    expect(fo).not.toContain('Receptionist');
  });

  it('treats another name for the same job as already there', () => {
    const plan = planStandardDepartments({
      tenant: 'demo',
      modules: {},
      departments: [{ id: 'my-fo', name: 'Front Office' }, { id: 'my-hk', name: 'Housekeeping' }],
      positions: [
        { title: 'Front Desk Receptionist', departmentId: 'my-fo' },
        { title: 'Housekeeper', departmentId: 'my-hk' },
      ],
    });
    const titles = plan.positions.map((p) => p.title);
    expect(titles).not.toContain('Receptionist');
    expect(titles).not.toContain('Room Attendant');
    expect(titles).toContain('Night Auditor');
  });

  it('joins repeated departments and repeated jobs, and drops unused starter jobs that are no longer in the list', () => {
    const focused = focusHrStructure({
      departments: [
        { id: 'fo', name: 'Front Office' },
        { id: 'rec', name: 'Reception' },
        { id: 'spa', name: 'Spa' },
      ],
      positions: [
        { id: 'p1', title: 'Receptionist', departmentId: 'fo' },
        { id: 'p2', title: 'Front Desk Receptionist', departmentId: 'rec' },
        { id: 'p3', title: 'Porter', departmentId: 'fo' },
        { id: 'std-demo-pos-FO-POR', title: 'Porter', departmentId: 'fo' },
        { id: 'spa-therapist', title: 'Spa Therapist', departmentId: 'spa' },
      ],
      employees: [{ departmentId: 'rec', positionId: 'p2' }],
    });
    expect(focused.departments.map((d) => d.name).sort()).toEqual(['Front Office', 'Spa']);
    expect(focused.removeDepartmentIds).toEqual(['rec']);
    const titles = focused.positions.map((p) => p.title).sort();
    expect(titles).toEqual(['Porter', 'Receptionist', 'Spa Therapist']);
    expect(focused.removePositionIds).toContain('std-demo-pos-FO-POR');
    expect(focused.removePositionIds).toContain('p2');
    expect(focused.employees[0].departmentId).toBe('fo');
    expect(focused.employees[0].positionId).toBe('p1');
  });

  it('recognises a department under another usual name (Accounting, Reception, Stores)', () => {
    const plan = planStandardDepartments({
      tenant: 'demo',
      modules: {},
      departments: [{ id: 'a', name: 'Accounting' }, { id: 'r', name: 'Reception' }, { id: 's', name: 'Stores' }],
      positions: [],
    });
    const names = plan.departments.map((d) => d.name);
    expect(names).not.toContain('Accounts & Finance');
    expect(names).not.toContain('Front Office');
    expect(names).not.toContain('Stores & Purchasing');
    expect(plan.positions.some((p) => p.departmentId === 'a' && p.title === 'Accountant')).toBe(true);
  });

  it('running it again adds nothing, and ids belong to the business', () => {
    const first = planStandardDepartments({ tenant: 'demo', modules: {}, departments: [], positions: [] });
    const again = planStandardDepartments({ tenant: 'demo', modules: {}, departments: first.departments, positions: first.positions });
    expect(again.departments).toHaveLength(0);
    expect(again.positions).toHaveLength(0);
    expect(first.departments.every((d) => d.id.startsWith('std-demo-'))).toBe(true);
    expect(new Set(first.positions.map((p) => p.id)).size).toBe(first.positions.length);
  });
});
