import type { Department, Position } from './models';
import type { ModuleSettings } from '../settings/store';

/**
 * The jobs a new hotel starts with: one department per desk, and only the jobs people
 * are actually hired into. A business gets the departments for the modules it has switched
 * on, so a restaurant does not get a Front Office. Salaries stay blank. Any of these can
 * be renamed or deleted afterwards.
 */
type StandardPosition = {
  code: string;
  title: string;
  description: string;
  /** Other titles that mean this same job, so a second copy is not added. */
  aliases?: string[];
};

type StandardDept = {
  code: string;
  name: string;
  description: string;
  /** Module that must be on; undefined = every business. */
  module?: keyof ModuleSettings;
  /** Other names a business may already use for this department (matched instead of adding a copy). */
  aliases?: string[];
  positions: StandardPosition[];
};

export const STANDARD_DEPARTMENTS: StandardDept[] = [
  {
    code: 'MGT', name: 'Management', description: 'Overall running of the business', aliases: ['administration', 'executive', 'executive office', 'general management', 'general'],
    positions: [
      { code: 'GM', title: 'General Manager', description: 'Runs the whole business and reports to the owners', aliases: ['GM', 'Hotel Manager'] },
    ],
  },
  {
    code: 'FO', name: 'Front Office', description: 'Reservations, reception, guest billing and night audit', aliases: ['front desk', 'reception', 'rooms division'], module: 'frontOffice',
    positions: [
      { code: 'REC', title: 'Receptionist', description: 'Checks guests in and out, takes payments and answers enquiries', aliases: ['Front Desk Receptionist', 'Front Desk Agent'] },
      { code: 'NA', title: 'Night Auditor', description: 'Runs the night audit and covers the desk overnight' },
    ],
  },
  {
    code: 'HK', name: 'Housekeeping', description: 'Rooms, public areas and laundry', aliases: ['housekeeping & laundry', 'housekeeping and laundry', 'laundry'], module: 'housekeeping',
    positions: [
      { code: 'HKS', title: 'Housekeeping Supervisor', description: 'Assigns and inspects rooms', aliases: ['Executive Housekeeper'] },
      { code: 'RA', title: 'Room Attendant', description: 'Cleans and prepares guest rooms', aliases: ['Housekeeper', 'Room Maid'] },
    ],
  },
  {
    code: 'MNT', name: 'Maintenance', description: 'Building, equipment and repairs', aliases: ['engineering', 'maintenance & engineering', 'technical'], module: 'maintenance',
    positions: [
      { code: 'TEC', title: 'Maintenance Technician', description: 'Repairs, air conditioning and fittings', aliases: ['Maintenance Manager'] },
    ],
  },
  {
    code: 'FB', name: 'Food & Beverage', description: 'Restaurant, bar and room service', aliases: ['restaurant', 'restaurant & bar', 'restaurant and bar', 'f&b', 'food and beverages', 'bar'], module: 'foodBeverage',
    positions: [
      { code: 'WTR', title: 'Waiter', description: 'Takes orders and serves guests', aliases: ['Waiter / Waitress', 'Waitress', 'Server'] },
      { code: 'BAR', title: 'Bartender', description: 'Prepares and serves drinks at the bar', aliases: ['Barman', 'Barmaid'] },
    ],
  },
  {
    code: 'KIT', name: 'Kitchen', description: 'Food preparation and kitchen hygiene', aliases: ['kitchen & stewarding', 'culinary'], module: 'foodBeverage',
    positions: [
      { code: 'EC', title: 'Head Chef', description: 'Leads the kitchen, menus and recipe costs', aliases: ['Executive Chef', 'Chef'] },
      { code: 'COOK', title: 'Cook', description: 'Prepares dishes to recipe', aliases: ['Line Cook'] },
    ],
  },
  {
    code: 'EVT', name: 'Events & Conferences', description: 'Halls, meetings, weddings and banquets', aliases: ['events', 'conferences', 'banqueting', 'banquets', 'conference & events'],
    positions: [
      { code: 'EVM', title: 'Events Coordinator', description: 'Sells and plans events and conferences' },
    ],
  },
  {
    code: 'STR', name: 'Stores & Purchasing', description: 'Buying, receiving and issuing stock', aliases: ['stores', 'purchasing', 'procurement', 'inventory', 'stores & inventory', 'supply chain'], module: 'inventory',
    positions: [
      { code: 'SK', title: 'Storekeeper', description: 'Receives goods, issues stock and keeps counts', aliases: ['Purchasing Officer'] },
    ],
  },
  {
    code: 'SEC', name: 'Security', description: 'Guards, patrols and incident reporting', aliases: ['security & safety'], module: 'security',
    positions: [
      { code: 'SO', title: 'Security Officer', description: 'Guards the premises, patrols and logs visitors', aliases: ['Security Supervisor', 'Guard'] },
    ],
  },
  {
    code: 'FIN', name: 'Accounts & Finance', description: 'Books, payments, taxes and reports', aliases: ['accounting', 'accounts', 'finance', 'accounts & administration', 'accounts and administration', 'accounting & finance'], module: 'accounting',
    positions: [
      { code: 'ACC', title: 'Accountant', description: 'Keeps the books, taxes and monthly reports' },
      { code: 'ACL', title: 'Accounts Clerk', description: 'Posts bills, receipts and payments', aliases: ['Accounts Assistant'] },
    ],
  },
  {
    code: 'HR', name: 'Human Resources', description: 'Staff records, leave and payroll', aliases: ['hr', 'personnel', 'human resource'], module: 'hr',
    positions: [
      { code: 'HRO', title: 'HR Officer', description: 'Staff records, leave and attendance', aliases: ['HR Manager'] },
    ],
  },
];

const normal = (s: string) => s.trim().toLowerCase().replace(/&/g, 'and').replace(/\s+/g, ' ');

function deptByName(name: string): StandardDept | undefined {
  const n = normal(name);
  if (!n) return undefined;
  return STANDARD_DEPARTMENTS.find((d) => normal(d.name) === n || (d.aliases || []).some((a) => normal(a) === n));
}

/** The standard job this title already is, including names like "Front Desk Receptionist" for Receptionist. */
export function matchStandardPosition(departmentName: string, title: string): StandardPosition | undefined {
  const dept = deptByName(departmentName);
  if (!dept) return undefined;
  const n = normal(title);
  return dept.positions.find((p) => normal(p.title) === n || (p.aliases || []).some((a) => normal(a) === n));
}

function groupKey(name: string): string {
  const dept = deptByName(name);
  if (dept) return `std:${dept.code}`;
  const n = normal(name);
  return n ? `name:${n}` : '';
}

/**
 * What to add for this business: departments for its switched-on modules that it does not
 * have yet (matched by name), and their positions that are not there yet (matched by title
 * within the department, including the other names for the same job). Ids are fixed per
 * business, so adding twice never duplicates.
 */
export function planStandardDepartments(params: {
  tenant: string;
  modules: Partial<ModuleSettings> | undefined;
  departments: Pick<Department, 'id' | 'name'>[];
  positions: Pick<Position, 'title' | 'departmentId'>[];
}): { departments: Department[]; positions: Position[] } {
  const now = new Date();
  const on = (m?: keyof ModuleSettings) => !m || params.modules?.[m] !== false;
  const byName = new Map(params.departments.map((d) => [normal(d.name), d.id]));
  const outDepts: Department[] = [];
  const outPositions: Position[] = [];
  const prefix = `std-${params.tenant || 'local'}`;

  for (const d of STANDARD_DEPARTMENTS) {
    if (!on(d.module)) continue;
    let deptId = [d.name, ...(d.aliases || [])].map((n) => byName.get(normal(n))).find(Boolean);
    if (!deptId) {
      deptId = `${prefix}-dept-${d.code}`;
      outDepts.push({ id: deptId, name: d.name, code: d.code, description: d.description, budget: 0, location: '', isActive: true, status: 'active', createdAt: now, updatedAt: now });
    }
    const existing = params.positions.filter((p) => p.departmentId === deptId).map((p) => normal(p.title));
    for (const position of d.positions) {
      const names = [position.title, ...(position.aliases || [])].map(normal);
      if (existing.some((title) => names.includes(title))) continue;
      outPositions.push({
        id: `${prefix}-pos-${d.code}-${position.code}`,
        title: position.title,
        code: `${d.code}-${position.code}`,
        departmentId: deptId,
        description: position.description,
        requirements: [],
        isActive: true,
        status: 'active',
        createdAt: now,
        updatedAt: now,
      });
    }
  }
  return { departments: outDepts, positions: outPositions };
}

type DeptRef = { id: string; name: string };
type PosRef = { id: string; title: string; departmentId: string };
type EmpRef = { departmentId?: string | null; positionId?: string | null };

/**
 * One row per department and one row per job. Departments that are the same desk under
 * two names are joined. The same job under two titles (Receptionist and Front Desk
 * Receptionist) is joined, and the title becomes the standard one. Standard jobs that
 * are no longer in the starter list, and that nobody is employed in, are dropped.
 * A job someone added by hand is kept.
 */
export function focusHrStructure<D extends DeptRef, P extends PosRef, E extends EmpRef>(input: {
  departments: D[];
  positions: P[];
  employees: E[];
}): {
  departments: D[];
  positions: P[];
  employees: E[];
  removeDepartmentIds: string[];
  removePositionIds: string[];
} {
  const staffInDept = new Map<string, number>();
  for (const employee of input.employees) {
    if (!employee.departmentId) continue;
    staffInDept.set(employee.departmentId, (staffInDept.get(employee.departmentId) || 0) + 1);
  }

  const groups = new Map<string, D[]>();
  const keptDepartments: D[] = [];
  for (const department of input.departments) {
    const key = groupKey(department.name);
    if (!key) {
      keptDepartments.push(department);
      continue;
    }
    const group = groups.get(key) || [];
    group.push(department);
    groups.set(key, group);
  }

  const deptRemap = new Map<string, string>();
  const removeDepartmentIds: string[] = [];
  for (const [key, group] of groups) {
    const catalog = key.startsWith('std:') ? STANDARD_DEPARTMENTS.find((d) => d.code === key.slice(4)) : undefined;
    const keeper = [...group].sort((a, b) => {
      const aCanon = catalog && normal(a.name) === normal(catalog.name) ? 1 : 0;
      const bCanon = catalog && normal(b.name) === normal(catalog.name) ? 1 : 0;
      if (aCanon !== bCanon) return bCanon - aCanon;
      return (staffInDept.get(b.id) || 0) - (staffInDept.get(a.id) || 0);
    })[0];
    keptDepartments.push(keeper);
    for (const department of group) {
      if (department.id !== keeper.id) {
        deptRemap.set(department.id, keeper.id);
        removeDepartmentIds.push(department.id);
      }
    }
  }

  const deptId = (id: string) => deptRemap.get(id) || id;
  const deptName = new Map(keptDepartments.map((d) => [d.id, d.name]));
  let positions = input.positions.map((position) => (
    deptRemap.has(position.departmentId) ? { ...position, departmentId: deptId(position.departmentId) } : position
  ));
  let employees = input.employees.map((employee) => (
    employee.departmentId && deptRemap.has(employee.departmentId) ? { ...employee, departmentId: deptId(employee.departmentId) } : employee
  ));

  const posGroups = new Map<string, P[]>();
  for (const position of positions) {
    const name = deptName.get(position.departmentId) || '';
    const match = matchStandardPosition(name, position.title);
    const key = `${position.departmentId}|${match ? `std:${match.title}` : `title:${normal(position.title)}`}`;
    const group = posGroups.get(key) || [];
    group.push(position);
    posGroups.set(key, group);
  }

  const staffOnPos = new Map<string, number>();
  for (const employee of employees) {
    if (!employee.positionId) continue;
    staffOnPos.set(employee.positionId, (staffOnPos.get(employee.positionId) || 0) + 1);
  }

  const posRemap = new Map<string, string>();
  const removePositionIds: string[] = [];
  const keptPositions: P[] = [];
  for (const group of posGroups.values()) {
    const name = deptName.get(group[0].departmentId) || '';
    const match = matchStandardPosition(name, group[0].title);
    const keeper = [...group].sort((a, b) => {
      const aCanon = match && a.title === match.title ? 1 : 0;
      const bCanon = match && b.title === match.title ? 1 : 0;
      if (aCanon !== bCanon) return bCanon - aCanon;
      return (staffOnPos.get(b.id) || 0) - (staffOnPos.get(a.id) || 0);
    })[0];
    const titled = match && keeper.title !== match.title ? { ...keeper, title: match.title } : keeper;
    keptPositions.push(titled);
    for (const position of group) {
      if (position.id !== keeper.id) {
        posRemap.set(position.id, keeper.id);
        removePositionIds.push(position.id);
      }
    }
  }

  positions = keptPositions;
  employees = employees.map((employee) => (
    employee.positionId && posRemap.has(employee.positionId) ? { ...employee, positionId: posRemap.get(employee.positionId) } : employee
  ));

  const stillUsed = new Set(employees.map((e) => e.positionId).filter(Boolean) as string[]);
  const retired = positions.filter((position) => {
    if (!position.id.startsWith('std-') || !position.id.includes('-pos-')) return false;
    if (stillUsed.has(position.id)) return false;
    const name = deptName.get(position.departmentId) || '';
    return !matchStandardPosition(name, position.title);
  });
  if (retired.length) {
    const drop = new Set(retired.map((p) => p.id));
    retired.forEach((p) => removePositionIds.push(p.id));
    positions = positions.filter((p) => !drop.has(p.id));
  }

  return { departments: keptDepartments, positions, employees, removeDepartmentIds, removePositionIds };
}
