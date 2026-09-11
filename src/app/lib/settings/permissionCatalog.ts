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
      { id: 'frontdesk.checkin', label: 'Check guests in' },
      { id: 'frontdesk.checkout', label: 'Check guests out' },
    ],
  },
  {
    key: 'events-conferences',
    label: 'Events & Conferences',
    icon: '🎪',
    fullAccessId: 'events-conferences.*',
    actions: [],
  },
  {
    key: 'f&b',
    label: 'Food & Beverage',
    icon: '🍽️',
    fullAccessId: 'f&b.*',
    actions: [{ id: 'f&b.pos', label: 'Use POS terminal' }],
  },
  {
    key: 'housekeeping',
    label: 'Housekeeping & Maintenance',
    icon: '🛏️',
    fullAccessId: 'housekeeping.*',
    actions: [{ id: 'housekeeping.view', label: 'View room status' }],
  },
  {
    key: 'inventory',
    label: 'Inventory & Stores',
    icon: '📦',
    fullAccessId: 'inventory.*',
    actions: [],
  },
  {
    key: 'security',
    label: 'Security Operations',
    icon: '🚨',
    fullAccessId: 'security.*',
    actions: [],
  },
  {
    key: 'hr',
    label: 'HR & Payroll',
    icon: '👥',
    fullAccessId: 'hr.*',
    actions: [],
  },
  {
    key: 'accounting',
    label: 'Accounting & Finance',
    icon: '🧾',
    fullAccessId: 'accounting.*',
    actions: [],
  },
  {
    key: 'compliance',
    label: 'Compliance & Reports',
    icon: '⚖️',
    fullAccessId: 'compliance.*',
    actions: [{ id: 'reports.view', label: 'View reports' }],
  },
  {
    key: 'settings',
    label: 'System Settings',
    icon: '⚙️',
    fullAccessId: 'settings.*',
    actions: [{ id: 'settings.view', label: 'View settings' }],
  },
];

/** Special case: '*' grants every permission in every module (System Administrator). */
export const FULL_SYSTEM_ACCESS = '*';
