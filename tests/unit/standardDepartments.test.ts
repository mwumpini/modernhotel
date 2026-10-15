import { describe, expect, it } from 'vitest';
import { planStandardDepartments, STANDARD_DEPARTMENTS } from '@/app/lib/hr/standardDepartments';

describe('Standard departments and positions', () => {
  it('a full hotel gets every department, each with its positions', () => {
    const plan = planStandardDepartments({ tenant: 'demo', modules: {}, departments: [], positions: [] });
    expect(plan.departments.map((d) => d.name)).toEqual(STANDARD_DEPARTMENTS.map((d) => d.name));
    for (const d of plan.departments) expect(plan.positions.some((p) => p.departmentId === d.id)).toBe(true);
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
