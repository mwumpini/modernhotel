import type { Department, Position } from './models';
import type { ModuleSettings } from '../settings/store';

/**
 * Standard departments and positions, one department per part of the system. A business gets
 * the ones for the modules it has switched on (Settings → Modules), so a restaurant does not
 * get a Front Office. Salaries are left blank: pay differs from one business to the next.
 */
type StandardDept = {
  code: string;
  name: string;
  description: string;
  /** Module that must be on; undefined = every business. */
  module?: keyof ModuleSettings;
  /** Other names a business may already use for this department (matched instead of adding a copy). */
  aliases?: string[];
  positions: Array<[code: string, title: string, description: string]>;
};

export const STANDARD_DEPARTMENTS: StandardDept[] = [
  {
    code: 'MGT', name: 'Management', description: 'Overall running of the business', aliases: ['administration','executive','executive office','general management'],
    positions: [
      ['GM', 'General Manager', 'Runs the whole business and reports to the owners'],
      ['AGM', 'Assistant General Manager', 'Stands in for the General Manager and oversees daily operations'],
      ['PA', 'Personal Assistant', 'Supports management with diary, letters and records'],
    ],
  },
  {
    code: 'FO', name: 'Front Office', description: 'Reservations, reception, guest billing and night audit', aliases: ['front desk','reception','rooms division'], module: 'frontOffice',
    positions: [
      ['FOM', 'Front Office Manager', 'Leads reception, reservations and guest billing'],
      ['FOS', 'Front Office Supervisor', 'Supervises shifts at the front desk'],
      ['REC', 'Receptionist', 'Checks guests in and out, takes payments and answers enquiries'],
      ['RES', 'Reservations Agent', 'Takes and manages bookings'],
      ['NA', 'Night Auditor', 'Runs the night audit and covers the desk overnight'],
      ['POR', 'Porter', 'Helps guests with luggage and errands'],
    ],
  },
  {
    code: 'HK', name: 'Housekeeping', description: 'Rooms, public areas and laundry', aliases: ['housekeeping & laundry','housekeeping and laundry','laundry'], module: 'housekeeping',
    positions: [
      ['EHK', 'Executive Housekeeper', 'Leads housekeeping and laundry'],
      ['HKS', 'Housekeeping Supervisor', 'Assigns and inspects rooms'],
      ['RA', 'Room Attendant', 'Cleans and prepares guest rooms'],
      ['LA', 'Laundry Attendant', 'Washes and presses linen and guest laundry'],
      ['PAC', 'Public Area Cleaner', 'Keeps lobbies, corridors and washrooms clean'],
    ],
  },
  {
    code: 'MNT', name: 'Maintenance', description: 'Building, equipment, power and grounds', aliases: ['engineering','maintenance & engineering','technical'], module: 'maintenance',
    positions: [
      ['CE', 'Maintenance Manager', 'Plans repairs and preventive maintenance'],
      ['ELE', 'Electrician', 'Electrical repairs, generator and power'],
      ['PLB', 'Plumber', 'Water, drainage and plumbing repairs'],
      ['TEC', 'Maintenance Technician', 'General repairs, air conditioning and fittings'],
      ['GRD', 'Groundskeeper', 'Gardens, pool area and grounds'],
    ],
  },
  {
    code: 'FB', name: 'Food & Beverage', description: 'Restaurant, bar, room service and banquets service', aliases: ['restaurant','restaurant & bar','restaurant and bar','f&b','food and beverages','bar'], module: 'foodBeverage',
    positions: [
      ['FBM', 'Food & Beverage Manager', 'Leads the restaurant, bar and room service'],
      ['RSUP', 'Restaurant Supervisor', 'Supervises service on the floor'],
      ['WTR', 'Waiter / Waitress', 'Takes orders and serves guests'],
      ['BAR', 'Bartender', 'Prepares and serves drinks at the bar'],
      ['FBC', 'Restaurant Cashier', 'Takes payments at the POS and balances the till'],
    ],
  },
  {
    code: 'KIT', name: 'Kitchen', description: 'Food preparation, recipes and kitchen hygiene', aliases: ['kitchen & stewarding','culinary'], module: 'foodBeverage',
    positions: [
      ['EC', 'Head Chef', 'Leads the kitchen, menus and recipe costs'],
      ['SC', 'Sous Chef', 'Runs the kitchen on shift'],
      ['COOK', 'Cook', 'Prepares dishes to recipe'],
      ['STW', 'Kitchen Steward', 'Washing up, cleaning and kitchen hygiene'],
    ],
  },
  {
    code: 'EVT', name: 'Events & Conferences', description: 'Halls, meetings, weddings and banquets', aliases: ['events','conferences','banqueting','banquets','conference & events'],
    positions: [
      ['EVM', 'Events Coordinator', 'Sells and plans events and conferences'],
      ['BQS', 'Banquet Supervisor', 'Sets up halls and supervises event service'],
    ],
  },
  {
    code: 'STR', name: 'Stores & Purchasing', description: 'Buying, receiving and issuing stock', aliases: ['stores','purchasing','procurement','inventory','stores & inventory','supply chain'], module: 'inventory',
    positions: [
      ['PUR', 'Purchasing Officer', 'Raises purchase orders and deals with suppliers'],
      ['SK', 'Storekeeper', 'Receives goods, issues stock and keeps counts'],
    ],
  },
  {
    code: 'SEC', name: 'Security', description: 'Guards, patrols and incident reporting', aliases: ['security & safety'], module: 'security',
    positions: [
      ['SSUP', 'Security Supervisor', 'Plans shifts and patrols and reports incidents'],
      ['SO', 'Security Officer', 'Guards the premises and logs visitors'],
    ],
  },
  {
    code: 'FIN', name: 'Accounts & Finance', description: 'Books, payments, taxes and reports', aliases: ['accounting','accounts','finance','accounts & administration','accounts and administration','accounting & finance'], module: 'accounting',
    positions: [
      ['ACC', 'Accountant', 'Keeps the books, taxes and monthly reports'],
      ['ACL', 'Accounts Clerk', 'Posts bills, receipts and payments'],
      ['IA', 'Income Auditor', 'Checks daily sales, tills and the night audit'],
    ],
  },
  {
    code: 'HR', name: 'Human Resources', description: 'Staff records, leave, training and payroll', aliases: ['hr','personnel','human resource'], module: 'hr',
    positions: [
      ['HRM', 'HR Manager', 'Recruitment, staff relations and payroll'],
      ['HRO', 'HR Officer', 'Staff records, leave and attendance'],
    ],
  },
];

const normal = (s: string) => s.trim().toLowerCase().replace(/&/g, 'and').replace(/\s+/g, ' ');

/**
 * What to add for this business: departments for its switched-on modules that it does not
 * have yet (matched by name), and their positions that are not there yet (matched by title
 * within the department). Ids are fixed per business, so adding twice never duplicates.
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
    const titles = new Set(params.positions.filter((p) => p.departmentId === deptId).map((p) => normal(p.title)));
    for (const [code, title, description] of d.positions) {
      if (titles.has(normal(title))) continue;
      outPositions.push({ id: `${prefix}-pos-${d.code}-${code}`, title, code: `${d.code}-${code}`, departmentId: deptId, description, requirements: [], isActive: true, status: 'active', createdAt: now, updatedAt: now });
    }
  }
  return { departments: outDepts, positions: outPositions };
}
