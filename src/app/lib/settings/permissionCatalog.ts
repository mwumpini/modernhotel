/**
 * Canonical list of permission strings the app actually understands.
 *
 * Module `key`s mirror Navigation.tsx's `navigationSections[].key` exactly —
 * that's what `hasModuleAccess(modulePrefix)` gates the sidebar with today,
 * so checking a module's "Full access" box here is what actually shows/hides
 * it for a role. Per-module `actions` beyond "Full access" reflect the finer
 * permission strings the default roles (System Administrator / Hotel Manager
 * / Staff Member / Night Manager) already use — e.g. 'frontdesk.checkin' —
 * even though nothing enforces them yet beyond the sidebar's module check.
 * Add an action here once real code starts calling hasPermission() for it.
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
  actions: PermissionAction[];
}

/**
 * Standard View/Create/Edit/Delete action set for a module's own records
 * (reservations, orders, incidents, employee records, etc). `noun` reads
 * into each label, e.g. crud('frontdesk', 'reservations') -> "Create
 * reservations". Modules that already have a bespoke '<key>.view' action
 * (housekeeping, settings) skip the generated view entry to avoid a dupe.
 */
function crud(key: string, noun: string, { view = true } = {}): PermissionAction[] {
  const entries: PermissionAction[] = [];
  if (view) entries.push({ id: `${key}.view`, label: `View ${noun}` });
  entries.push(
    { id: `${key}.create`, label: `Create ${noun}` },
    { id: `${key}.edit`, label: `Edit ${noun}` },
    { id: `${key}.delete`, label: `Delete ${noun}` },
  );
  return entries;
}

export const PERMISSION_MODULES: PermissionModule[] = [
  {
    key: 'dashboard',
    label: 'Executive Dashboard',
    icon: '📊',
    fullAccessId: 'dashboard.*',
    actions: [{ id: 'dashboard.view', label: 'View dashboard' }],
  },
  {
    key: 'frontdesk',
    label: 'Front Office Operations',
    icon: '🏨',
    fullAccessId: 'frontdesk.*',
    actions: [
      ...crud('frontdesk', 'reservations'),
      { id: 'frontdesk.checkin', label: 'Check guests in' },
      { id: 'frontdesk.checkout', label: 'Check guests out' },
    ],
  },
  {
    key: 'events-conferences',
    label: 'Events & Conferences',
    icon: '🎪',
    fullAccessId: 'events-conferences.*',
    actions: crud('events-conferences', 'events & bookings'),
  },
  {
    key: 'f&b',
    label: 'Food & Beverage',
    icon: '🍽️',
    fullAccessId: 'f&b.*',
    actions: [
      ...crud('f&b', 'menu items & orders'),
      { id: 'f&b.pos', label: 'Use POS terminal' },
    ],
  },
  {
    key: 'housekeeping',
    label: 'Housekeeping & Maintenance',
    icon: '🛏️',
    fullAccessId: 'housekeeping.*',
    actions: [
      { id: 'housekeeping.view', label: 'View room status' },
      ...crud('housekeeping', 'tasks', { view: false }),
    ],
  },
  {
    key: 'inventory',
    label: 'Inventory & Stores',
    icon: '📦',
    fullAccessId: 'inventory.*',
    actions: crud('inventory', 'stock & purchase orders'),
  },
  {
    key: 'security',
    label: 'Security Operations',
    icon: '🚨',
    fullAccessId: 'security.*',
    actions: crud('security', 'incident logs'),
  },
  {
    key: 'hr',
    label: 'HR & Payroll',
    icon: '👥',
    fullAccessId: 'hr.*',
    actions: crud('hr', 'employee records'),
  },
  {
    key: 'accounting',
    label: 'Accounting & Finance',
    icon: '🧾',
    fullAccessId: 'accounting.*',
    actions: crud('accounting', 'transactions & invoices'),
  },
  {
    key: 'compliance',
    label: 'Compliance & Reports',
    icon: '⚖️',
    fullAccessId: 'compliance.*',
    actions: [
      { id: 'reports.view', label: 'View reports' },
      ...crud('compliance', 'filings', { view: false }),
    ],
  },
  {
    key: 'settings',
    label: 'System Settings',
    icon: '⚙️',
    fullAccessId: 'settings.*',
    actions: [
      { id: 'settings.view', label: 'View settings' },
      ...crud('settings', 'users, roles & configuration', { view: false }),
    ],
  },
];

/** Special case: '*' grants every permission in every module (System Administrator). */
export const FULL_SYSTEM_ACCESS = '*';
