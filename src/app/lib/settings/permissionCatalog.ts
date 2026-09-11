/**
 * Canonical list of permission strings the app actually understands.
 *
 * Module `key`s mirror Navigation.tsx's `navigationSections[].key` exactly —
 * that's what `hasModuleAccess(modulePrefix)` gates the sidebar with today,
 * so checking a module's "Full access" box here is what actually shows/hides
 * it for a role. `view`/`create`/`edit`/`delete` are the matrix columns the
 * Role editor renders; `extra` holds the handful of bespoke action strings
 * the default roles already use that don't fit that shape (frontdesk.checkin,
 * f&b.pos). None of the finer actions are enforced anywhere yet beyond the
 * sidebar's module check — add real hasPermission() calls as they're wired up.
 */
export interface PermissionAction {
  /** Exact string stored in UserRole.permissions, matched by hasPermission()/hasModuleAccess() */
  id: string;
  label: string;
}

export interface PermissionModule {
  key: string;
  label: string;
  icon: string;
  /** module.* — checking this implies every action below it */
  fullAccessId: string;
  /** Matrix columns. Undefined means this module has no such action (e.g. dashboard has no Delete). */
  view?: PermissionAction;
  create?: PermissionAction;
  edit?: PermissionAction;
  delete?: PermissionAction;
  /** Bespoke actions outside the View/Create/Edit/Delete shape, shown below the matrix. */
  extra: PermissionAction[];
}

interface CrudOptions {
  /** Override the generated '<key>.view' id — compliance's real data uses the legacy 'reports.view'. */
  viewId?: string;
  create?: boolean;
  edit?: boolean;
  delete?: boolean;
}

/**
 * Standard View/Create/Edit/Delete slots for a module's own records
 * (reservations, orders, incidents, employee records, etc). `noun` reads
 * into each label, e.g. crud('frontdesk', 'reservations').create ->
 * { id: 'frontdesk.create', label: 'Create reservations' }.
 */
function crud(key: string, noun: string, opts: CrudOptions = {}) {
  const { viewId = `${key}.view`, create = true, edit = true, delete: del = true } = opts;
  return {
    view: { id: viewId, label: `View ${noun}` },
    create: create ? { id: `${key}.create`, label: `Create ${noun}` } : undefined,
    edit: edit ? { id: `${key}.edit`, label: `Edit ${noun}` } : undefined,
    delete: del ? { id: `${key}.delete`, label: `Delete ${noun}` } : undefined,
  };
}

export const PERMISSION_MODULES: PermissionModule[] = [
  {
    key: 'dashboard',
    label: 'Executive Dashboard',
    icon: '📊',
    fullAccessId: 'dashboard.*',
    view: { id: 'dashboard.view', label: 'View dashboard' },
    extra: [],
  },
  {
    key: 'frontdesk',
    label: 'Front Office Operations',
    icon: '🏨',
    fullAccessId: 'frontdesk.*',
    ...crud('frontdesk', 'reservations'),
    extra: [
      { id: 'frontdesk.checkin', label: 'Check guests in' },
      { id: 'frontdesk.checkout', label: 'Check guests out' },
    ],
  },
  {
    key: 'events-conferences',
    label: 'Events & Conferences',
    icon: '🎪',
    fullAccessId: 'events-conferences.*',
    ...crud('events-conferences', 'events & bookings'),
    extra: [],
  },
  {
    key: 'f&b',
    label: 'Food & Beverage',
    icon: '🍽️',
    fullAccessId: 'f&b.*',
    ...crud('f&b', 'menu items & orders'),
    extra: [{ id: 'f&b.pos', label: 'Use POS terminal' }],
  },
  {
    key: 'housekeeping',
    label: 'Housekeeping & Maintenance',
    icon: '🛏️',
    fullAccessId: 'housekeeping.*',
    ...crud('housekeeping', 'tasks', { viewId: 'housekeeping.view' }),
    extra: [],
  },
  {
    key: 'inventory',
    label: 'Inventory & Stores',
    icon: '📦',
    fullAccessId: 'inventory.*',
    ...crud('inventory', 'stock & purchase orders'),
    extra: [],
  },
  {
    key: 'security',
    label: 'Security Operations',
    icon: '🚨',
    fullAccessId: 'security.*',
    ...crud('security', 'incident logs'),
    extra: [],
  },
  {
    key: 'hr',
    label: 'HR & Payroll',
    icon: '👥',
    fullAccessId: 'hr.*',
    ...crud('hr', 'employee records'),
    extra: [],
  },
  {
    key: 'accounting',
    label: 'Accounting & Finance',
    icon: '🧾',
    fullAccessId: 'accounting.*',
    ...crud('accounting', 'transactions & invoices'),
    extra: [],
  },
  {
    key: 'compliance',
    label: 'Compliance & Reports',
    icon: '⚖️',
    fullAccessId: 'compliance.*',
    ...crud('compliance', 'filings', { viewId: 'reports.view' }),
    extra: [],
  },
  {
    key: 'settings',
    label: 'System Settings',
    icon: '⚙️',
    fullAccessId: 'settings.*',
    ...crud('settings', 'users, roles & configuration', { viewId: 'settings.view' }),
    extra: [],
  },
];

/** Special case: '*' grants every permission in every module (System Administrator). */
export const FULL_SYSTEM_ACCESS = '*';
