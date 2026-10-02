/**
 * Canonical list of permission strings the app actually understands.
 *
 * Module `key`s mirror Navigation.tsx's `navigationSections[].key` exactly —
 * that's what `hasModuleAccess(modulePrefix)` gates the sidebar with today,
 * so checking a module's "Full access" box here is what actually shows/hides
 * it for a role. `view`/`create`/`edit`/`delete`/`print`/`void` are the matrix
 * columns the Role editor renders; `extra` holds the handful of bespoke action
 * strings the default roles already use that don't fit that shape (frontdesk.checkin,
 * restaurant.pos). None of the finer actions are enforced anywhere yet beyond the
 * sidebar's module check — add real hasPermission() calls as they're wired up.
 */
export interface PermissionAction {
  /** Exact string stored in UserRole.permissions, matched by hasPermission()/hasModuleAccess() */
  id: string;
  label: string;
  /** Desk, table, or dialog this action belongs to. Role Management groups extras under this heading. */
  group?: string;
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
  print?: PermissionAction;
  void?: PermissionAction;
  /** Bespoke actions outside the View/Create/Edit/Delete/Print/Void shape, shown below the matrix. */
  extra: PermissionAction[];
  /** Extra matrix rows for a screen inside this module, such as Kitchen → Ready now. */
  lines?: PermissionLine[];
}

/** A screen inside a module that has its own View/Create/Edit/Delete/Print/Void checkboxes. */
export interface PermissionLine {
  key: string;
  label: string;
  icon?: string;
  view?: PermissionAction;
  create?: PermissionAction;
  edit?: PermissionAction;
  delete?: PermissionAction;
  print?: PermissionAction;
  void?: PermissionAction;
}

interface CrudOptions {
  /** Override the generated '<key>.view' id — compliance's real data uses the legacy 'reports.view'. */
  viewId?: string;
  create?: boolean;
  edit?: boolean;
  delete?: boolean;
  print?: boolean;
  void?: boolean;
  /** Keep a legacy void permission id (e.g. accounting.void-transaction). */
  voidId?: string;
}

/**
 * Standard View/Create/Edit/Delete/Print/Void slots for a module's own records
 * (reservations, orders, incidents, employee records, etc). `noun` reads
 * into each label, e.g. crud('frontdesk', 'reservations').create ->
 * { id: 'frontdesk.create', label: 'Create reservations' }.
 */
function crud(key: string, noun: string, opts: CrudOptions = {}) {
  const {
    viewId = `${key}.view`,
    create = true,
    edit = true,
    delete: del = true,
    print = false,
    void: voidOpt = false,
    voidId,
  } = opts;
  return {
    view: { id: viewId, label: `View ${noun}` },
    create: create ? { id: `${key}.create`, label: `Create ${noun}` } : undefined,
    edit: edit ? { id: `${key}.edit`, label: `Edit ${noun}` } : undefined,
    delete: del ? { id: `${key}.delete`, label: `Delete ${noun}` } : undefined,
    print: print ? { id: `${key}.print`, label: `Print ${noun}` } : undefined,
    void: voidOpt
      ? { id: voidId || `${key}.void`, label: `Void ${noun}` }
      : undefined,
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
    ...crud('frontdesk', 'reservations', { print: true, void: true }),
    extra: [
      { id: 'frontdesk.room-status', label: 'Change room status', group: '🛏️ Rooms' },
      { id: 'frontdesk.cancel', label: 'Cancel a reservation', group: '📅 Reservations' },
      { id: 'frontdesk.no-show', label: 'Mark a reservation no-show', group: '📅 Reservations' },
      { id: 'frontdesk.extend-stay', label: 'Extend a stay', group: '📅 Reservations' },
      { id: 'frontdesk.checkin', label: 'Check guests in', group: '🛎️ Desk' },
      { id: 'frontdesk.checkout', label: 'Check guests out', group: '🛎️ Desk' },
      { id: 'frontdesk.waive-late-checkout', label: 'Waive a late checkout fee', group: '🛎️ Desk' },
      { id: 'frontdesk.assign-room', label: 'Assign / reassign a room', group: '🔄 Room transfer' },
      { id: 'frontdesk.transfer-charge', label: 'Transfer/split a charge between folios', group: '🔄 Room transfer' },
      { id: 'frontdesk.manage-service-charges', label: 'Post a service charge', group: '🏊 Service charges' },
      { id: 'frontdesk.post-charge', label: 'Post a folio charge', group: '💳 Invoices & payments' },
      { id: 'frontdesk.void-charge', label: 'Void a folio charge', group: '💳 Invoices & payments' },
      { id: 'frontdesk.close-folio', label: 'Close a folio', group: '💳 Invoices & payments' },
      { id: 'frontdesk.post-payment', label: 'Post a payment', group: '💳 Invoices & payments' },
      { id: 'frontdesk.refund-payment', label: 'Refund a payment', group: '💳 Invoices & payments' },
      { id: 'frontdesk.apply-credit', label: 'Add/apply a guest credit', group: '💳 Invoices & payments' },
      { id: 'frontdesk.manage-cash', label: 'Use front-desk cashiering', group: '💵 Cashiering' },
      { id: 'frontdesk.manage-clients', label: 'Add or edit a guest', group: '👥 Clients' },
      { id: 'frontdesk.manage-company-clients', label: 'Add or edit a company', group: '👥 Clients' },
      { id: 'frontdesk.view-company-ledger', label: 'Open a company ledger', group: '🏢 Companies' },
      { id: 'frontdesk.post-company-payment', label: 'Record a lump-sum payment on a company ledger', group: '🏢 Companies' },
      { id: 'frontdesk.night-audit', label: 'Run night audit', group: '🌙 Night audit' },
      { id: 'frontdesk.view-reports', label: 'Open front office reports', group: '📈 Reports' },
      { id: 'frontdesk.log-overtime', label: 'Submit an overtime request', group: '⏰ Overtime' },
    ],
  },
  {
    key: 'events-conferences',
    label: 'Events & Conferences',
    icon: '🎪',
    fullAccessId: 'events-conferences.*',
    ...crud('events-conferences', 'events & bookings', { print: true, void: true }),
    extra: [
      { id: 'events-conferences.generate-quote', label: 'Generate/save a quote', group: '📋 Events' },
      { id: 'events-conferences.generate-contract', label: 'Generate/open a contract', group: '📋 Events' },
      { id: 'events-conferences.manage-beo', label: 'Save a BEO (banquet event order)', group: '📋 Events' },
      { id: 'events-conferences.complete-event', label: 'Mark an event completed', group: '📋 Events' },
      { id: 'events-conferences.manage-venues', label: 'Add/edit a venue (hall)', group: '🏢 Venues' },
      { id: 'events-conferences.delete-venue', label: 'Delete a venue', group: '🏢 Venues' },
      { id: 'events-conferences.manage-catering', label: 'Add/edit a catering service', group: '🍽️ Catering' },
      { id: 'events-conferences.manage-rates', label: 'Add/edit an event rate', group: '💰 Rates' },
      { id: 'events-conferences.manage-staff', label: 'Assign event staff', group: '👥 Staff' },
      { id: 'events-conferences.manage-invoice', label: 'Create/save an event invoice', group: '🧾 Invoices' },
      { id: 'events-conferences.manage-receipt', label: 'Create/save an event receipt', group: '💳 Receipts' },
      { id: 'events-conferences.post-payment', label: 'Record a payment/deposit', group: '💳 Receipts' },
      { id: 'events-conferences.manage-folio', label: 'Manage an event folio', group: '📂 Folios' },
      { id: 'events-conferences.export-data', label: 'Export event data', group: '📈 Reports' },
      { id: 'events-conferences.log-overtime', label: 'Submit an overtime request', group: '⏰ Overtime' },
    ],
  },
  {
    key: 'restaurant',
    label: 'Restaurant & Bar',
    icon: '🍽️',
    fullAccessId: 'restaurant.*',
    ...crud('restaurant', 'menu items & orders', { print: true, void: true }),
    extra: [
      { id: 'restaurant.pos', label: 'Use POS terminal', group: '💳 Transactions' },
      { id: 'restaurant.apply-discount', label: 'Apply a discount', group: '💳 Transactions' },
      { id: 'restaurant.post-payment', label: 'Post a payment', group: '💳 Transactions' },
      { id: 'restaurant.print-bot', label: 'Print a bar order ticket', group: '💳 Transactions' },
      { id: 'restaurant.manage-tables', label: 'Set/change a table status', group: '🪑 Tables' },
      { id: 'restaurant.manage-reservations', label: 'Create/edit a table reservation', group: '📅 Reservations' },
      { id: 'restaurant.view-ready-board', label: 'See the Ready now board', group: '🍽️ Ready now' },
      { id: 'restaurant.toggle-availability', label: 'Toggle menu item availability', group: '🍽️ Menu' },
      { id: 'restaurant.manage-cash', label: 'Use restaurant cashiering', group: '💵 Cashiering' },
      { id: 'restaurant.manage-supplies', label: 'Use restaurant supplies, stock count, and requisitions', group: '📦 Supplies' },
      { id: 'restaurant.log-overtime', label: 'Submit an overtime request', group: '⏰ Overtime' },
    ],
  },
  {
    key: 'kitchen',
    label: 'Kitchen',
    icon: '👨‍🍳',
    fullAccessId: 'kitchen.*',
    ...crud('kitchen', 'kitchen tickets', { create: false, delete: false, print: true, void: true }),
    lines: [
      {
        key: 'ready',
        label: 'Ready now',
        icon: '🍽️',
        view: { id: 'kitchen.view-ready-board', label: 'View the Ready now board' },
        edit: { id: 'kitchen.manage-ready-board', label: 'Publish dishes and portions on Ready now' },
      },
    ],
    extra: [
      { id: 'kitchen.send-to-kitchen', label: 'Send an order to the kitchen', group: '🍳 Kitchen display' },
      { id: 'kitchen.cancel-order', label: 'Cancel an order', group: '🍳 Kitchen display' },
      { id: 'kitchen.manager-override', label: 'Manager PIN override (delete/void order)', group: '🍳 Kitchen display' },
      { id: 'kitchen.view-log', label: 'Open the kitchen operations log', group: '🧾 Operations log' },
      { id: 'kitchen.manage-stations', label: 'Manage kitchen stations', group: '🔥 Stations' },
      { id: 'kitchen.manage-inventory', label: 'Manage kitchen ingredient stock and submit stock requisitions', group: '📦 Supplies' },
      { id: 'kitchen.manage-recipes', label: 'Add or edit a recipe', group: '📖 Recipes' },
      { id: 'kitchen.manage-staff', label: 'Manage kitchen staff', group: '👥 Staff' },
      { id: 'kitchen.log-overtime', label: 'Submit an overtime request', group: '⏰ Overtime' },
    ],
  },
  {
    key: 'housekeeping',
    label: 'Housekeeping & Maintenance',
    icon: '🛏️',
    fullAccessId: 'housekeeping.*',
    ...crud('housekeeping', 'tasks', { viewId: 'housekeeping.view', print: true, void: true }),
    extra: [
      { id: 'housekeeping.update-room-status', label: 'Mark room clean/dirty/ready', group: '🏠 Floor' },
      { id: 'housekeeping.block-room', label: 'Block a room (out-of-order)', group: '🏠 Floor' },
      { id: 'housekeeping.assign-task', label: 'Assign a task to staff', group: '🧹 Work' },
      { id: 'housekeeping.log-maintenance', label: 'Log a maintenance request', group: '🧹 Work' },
      { id: 'housekeeping.manage-maintenance', label: "Update a maintenance request's status", group: '🧹 Work' },
      { id: 'housekeeping.manage-inspection', label: 'Create/save a room inspection', group: '🧹 Work' },
      { id: 'housekeeping.manage-supplies', label: 'Restock / add / edit supplies', group: '📦 Supplies' },
      { id: 'housekeeping.manage-staff', label: 'Add/edit housekeeping staff', group: '👥 Staff' },
      { id: 'housekeeping.view-activities', label: 'Open the housekeeping activity log', group: '👁️ Activities' },
      { id: 'housekeeping.log-overtime', label: 'Submit an overtime request', group: '⏰ Overtime' },
    ],
  },
  {
    key: 'inventory',
    label: 'Inventory & Stores',
    icon: '📦',
    fullAccessId: 'inventory.*',
    ...crud('inventory', 'stock & purchase orders', { print: true, void: true }),
    extra: [
      { id: 'inventory.receive-goods', label: 'Receive goods against a PO', group: '📦 Stock' },
      { id: 'inventory.quality-check', label: 'Perform a quality check', group: '📦 Stock' },
      { id: 'inventory.issue-stock', label: 'Issue stock to a department', group: '📦 Stock' },
      { id: 'inventory.transfer-stock', label: 'Transfer stock between locations', group: '📦 Stock' },
      { id: 'inventory.stock-count', label: 'Start/complete a stock count', group: '📦 Stock' },
      { id: 'inventory.acknowledge-alert', label: 'Acknowledge an inventory alert', group: '📦 Stock' },
      { id: 'inventory.create-requisition', label: 'Create a requisition', group: '📝 Requisitions' },
      { id: 'inventory.approve-requisition', label: 'Approve/reject a requisition, and mark it ready for pickup', group: '📝 Requisitions' },
      { id: 'inventory.approve-high-value-requisition', label: 'Approve/reject a requisition at or above the director approval threshold', group: '📝 Requisitions' },
      { id: 'inventory.edit-processed-requisition', label: 'Edit or delete a requisition Stores has already acted on', group: '📝 Requisitions' },
      { id: 'inventory.approve-po', label: 'Approve/reject a purchase order', group: '🛒 Purchase orders' },
      { id: 'inventory.manage-suppliers', label: 'Add/edit a supplier', group: '🏭 Suppliers' },
      { id: 'inventory.manage-supplier-invoices', label: 'Create/pay a supplier invoice', group: '🏭 Suppliers' },
      { id: 'inventory.manage-staff', label: 'Manage stores staff', group: '👥 Staff' },
      { id: 'inventory.log-overtime', label: 'Submit an overtime request', group: '⏰ Overtime' },
    ],
  },
  {
    key: 'security',
    label: 'Security Operations',
    icon: '🚨',
    fullAccessId: 'security.*',
    ...crud('security', 'incident logs', { print: true }),
    extra: [
      { id: 'security.manage-patrols', label: 'Start/complete a security patrol', group: '🚶 Watch' },
      { id: 'security.manage-checkpoints', label: 'Add/deactivate checkpoint locations', group: '🚶 Watch' },
      { id: 'security.manage-routes', label: 'Add/deactivate patrol routes', group: '🚶 Watch' },
      { id: 'security.assign-incident', label: 'Assign an incident to staff', group: '🚨 Incidents' },
      { id: 'security.resolve-incident', label: 'Resolve an incident', group: '🚨 Incidents' },
      { id: 'security.register-visitor', label: 'Register a visitor (check in)', group: '🎟️ Visitors' },
      { id: 'security.checkout-visitor', label: 'Check out a visitor', group: '🎟️ Visitors' },
      { id: 'security.manage-personnel', label: 'Add/deactivate outsourced security personnel', group: '👥 Staff' },
      { id: 'security.manage-shifts', label: 'Check staff in/out of a duty shift', group: '👥 Staff' },
      { id: 'security.mark-compliance', label: 'Mark a compliance requirement completed', group: '📋 Compliance' },
      { id: 'security.view-activities', label: 'Open the security activity log', group: '👁️ Activities' },
      { id: 'security.log-overtime', label: 'Submit an overtime request', group: '⏰ Overtime' },
    ],
  },
  {
    key: 'hr',
    label: 'HR & Payroll',
    icon: '👥',
    fullAccessId: 'hr.*',
    ...crud('hr', 'employee records', { print: true }),
    extra: [
      { id: 'hr.log-employee-change', label: 'Log an employee change', group: '👥 People' },
      { id: 'hr.manage-onboarding', label: 'Manage employee onboarding', group: '👥 People' },
      { id: 'hr.manage-leave', label: 'Approve/reject a leave request', group: '🌴 Leave' },
      { id: 'hr.manage-shifts', label: 'Schedule a shift', group: '⏰ Time' },
      { id: 'hr.manage-attendance', label: 'Record time and attendance', group: '⏰ Time' },
      { id: 'hr.log-overtime', label: 'Submit an overtime request', group: '⏰ Time' },
      { id: 'hr.approve-overtime', label: 'Approve overtime at/above the director threshold', group: '⏰ Time' },
      { id: 'hr.manage-payroll-periods', label: 'Create a payroll period', group: '💰 Payroll' },
      { id: 'hr.process-payroll', label: 'Process payroll for a period', group: '💰 Payroll' },
      { id: 'hr.approve-payroll', label: 'Approve payroll', group: '💰 Payroll' },
      { id: 'hr.manage-benefits', label: 'Enroll/cancel a benefits enrollment', group: '💳 Benefits' },
      { id: 'hr.manage-performance-reviews', label: 'Add/edit a performance review', group: '📊 Performance' },
      { id: 'hr.manage-training', label: 'Enroll an employee in training', group: '🎓 Training' },
      { id: 'hr.manage-compliance', label: 'Open HR tax and labour compliance', group: '📋 Compliance' },
      { id: 'hr.manage-departments', label: 'Add or edit departments and positions', group: '🏢 Departments' },
    ],
  },
  {
    key: 'accounting',
    label: 'Accounting & Finance',
    icon: '🧾',
    fullAccessId: 'accounting.*',
    ...crud('accounting', 'transactions & invoices', {
      print: true,
      void: true,
      voidId: 'accounting.void-transaction',
    }),
    extra: [
      { id: 'accounting.manage-ar', label: 'Record a customer invoice/receipt (AR)', group: '📝 Receivable' },
      { id: 'accounting.manage-ap', label: 'Record a supplier invoice/payment (AP)', group: '🧾 Payable' },
      { id: 'accounting.approve-payment', label: 'Approve a payment at or above the director approval threshold', group: '🧾 Payable' },
      { id: 'accounting.manage-wht', label: 'Record/receive a WHT payment or certificate', group: '🧾 Payable' },
      { id: 'accounting.manage-bank', label: 'Sync cashbook / post bank items to ledger', group: '💰 Bank & cash' },
      { id: 'accounting.reconcile-bank', label: 'Complete a bank reconciliation', group: '💰 Bank & cash' },
      { id: 'accounting.approve-reconciliation', label: 'Approve and lock a reconciliation', group: '💰 Bank & cash' },
      { id: 'accounting.manage-ppe', label: 'Add/dispose a fixed asset (PPE)', group: '🏗️ Assets' },
      { id: 'accounting.manage-taxes', label: 'Work the taxes desk', group: '🧮 Taxes' },
      { id: 'accounting.post-journal-entry', label: 'Post a journal entry', group: '📒 Journal' },
      { id: 'accounting.approve-journal-entry', label: 'Approve/reverse a journal entry', group: '📒 Journal' },
      { id: 'accounting.view-statements', label: 'Open financial statements', group: '📑 Statements' },
      { id: 'accounting.manage-chart-of-accounts', label: 'Manage the chart of accounts', group: '📚 Books' },
      { id: 'accounting.manage-centers', label: 'Manage cost/revenue centers', group: '📚 Books' },
      { id: 'accounting.close-period', label: 'Close an accounting period', group: '📚 Books' },
      { id: 'accounting.view-activity', label: 'Open the accounting activity log', group: '👁️ Activity log' },
      { id: 'accounting.log-overtime', label: 'Submit an overtime request', group: '⏰ Overtime' },
    ],
  },
  {
    key: 'compliance',
    label: 'Compliance & Reports',
    icon: '⚖️',
    fullAccessId: 'compliance.*',
    ...crud('compliance', 'filings', { print: true }),
    extra: [
      { id: 'compliance.manage-tax-types', label: 'Create/edit a tax type', group: '🧮 Tax' },
      { id: 'compliance.manage-tax-rules', label: 'Create/edit/delete a tax rule', group: '🧮 Tax' },
      { id: 'compliance.submit-filing', label: 'Submit a filed report', group: '📈 Filings' },
      { id: 'compliance.approve-filing', label: 'Approve a filed report', group: '📈 Filings' },
    ],
  },
  {
    key: 'settings',
    label: 'System Settings',
    icon: '⚙️',
    fullAccessId: 'settings.*',
    ...crud('settings', 'users, roles & configuration', { viewId: 'settings.view' }),
    extra: [
      { id: 'settings.toggle-user-status', label: 'Activate/deactivate a user', group: '👥 Users & roles' },
      { id: 'settings.reset-password', label: "Change a user's password", group: '👥 Users & roles' },
      { id: 'settings.manage-2fa', label: 'Toggle two-factor authentication', group: '👥 Users & roles' },
      { id: 'settings.manage-role-permissions', label: 'Open, edit, and deactivate a role', group: '👥 Users & roles' },
      { id: 'settings.manage-rooms-pricing', label: 'Configure room types, rate plans, and seasonal rates', group: '🛏️ Rooms & pricing' },
      { id: 'settings.manage-document-numbering', label: 'Configure document numbering', group: '📄 Documents' },
      { id: 'settings.manage-templates', label: 'Save/publish a document template, including restaurant receipts', group: '📄 Documents' },
      { id: 'settings.manage-stock-locations', label: 'Add/edit/deactivate stock locations (stores, fridges, outlets)', group: '📦 Stock locations' },
      { id: 'settings.manage-security-policy', label: 'Configure security policy (2FA, session timeout, passwords)', group: '🔒 Security' },
      { id: 'settings.manage-approval-thresholds', label: 'Configure director-approval thresholds for expenses, purchase orders, and payments', group: '✅ Approvals' },
      { id: 'settings.manage-modules', label: 'Turn modules on or off', group: '🧩 Modules' },
      { id: 'settings.manage-sample-data', label: 'Load or remove sample data', group: '🧪 Sample data' },
      { id: 'settings.view-audit-log', label: 'View the system audit log (logins and actions)', group: '📜 Audit log' },
      { id: 'settings.manage-company', label: 'Edit the company profile (legal name, trading name, logo, contacts, TIN)', group: '🏢 Company' },
      { id: 'settings.manage-company-finance', label: 'Set currency, tax scheme, and financial year', group: '🏢 Company' },
    ],
  },
];

/** Special case: '*' grants every permission in every module (System Administrator). */
export const FULL_SYSTEM_ACCESS = '*';

/**
 * Older ids that still mean the same checkbox. `reports.view` was the compliance
 * view id before it moved under `compliance.view`, which Full (`compliance.*`) covers.
 */
export const PERMISSION_EQUIVALENTS: Record<string, string[]> = {
  'compliance.view': ['reports.view'],
  'reports.view': ['compliance.view'],
};

export function permissionIdsFor(id: string): string[] {
  return [id, ...(PERMISSION_EQUIVALENTS[id] ?? [])];
}

/** True when a stored grant (`*`, `module.*`, or an exact id) allows `permission`. */
export function grantCovers(granted: string, permission: string): boolean {
  if (granted === '*' || granted === permission) return true;
  if (granted.endsWith('.*')) return permission.startsWith(granted.slice(0, -1));
  return false;
}
