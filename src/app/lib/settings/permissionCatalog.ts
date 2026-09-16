/**
 * Canonical list of permission strings the app actually understands.
 *
 * Module `key`s mirror Navigation.tsx's `navigationSections[].key` exactly —
 * that's what `hasModuleAccess(modulePrefix)` gates the sidebar with today,
 * so checking a module's "Full access" box here is what actually shows/hides
 * it for a role. `view`/`create`/`edit`/`delete` are the matrix columns the
 * Role editor renders; `extra` holds the handful of bespoke action strings
 * the default roles already use that don't fit that shape (frontdesk.checkin,
 * restaurant.pos). None of the finer actions are enforced anywhere yet beyond the
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
      { id: 'frontdesk.cancel', label: 'Cancel a reservation' },
      { id: 'frontdesk.no-show', label: 'Mark a reservation no-show' },
      { id: 'frontdesk.assign-room', label: 'Assign / reassign a room' },
      { id: 'frontdesk.extend-stay', label: 'Extend a stay' },
      { id: 'frontdesk.post-charge', label: 'Post a folio charge' },
      { id: 'frontdesk.void-charge', label: 'Void a folio charge' },
      { id: 'frontdesk.transfer-charge', label: 'Transfer/split a charge between folios' },
      { id: 'frontdesk.close-folio', label: 'Close a folio' },
      { id: 'frontdesk.post-payment', label: 'Post a payment' },
      { id: 'frontdesk.refund-payment', label: 'Refund a payment' },
      { id: 'frontdesk.apply-credit', label: 'Add/apply a guest credit' },
      { id: 'frontdesk.room-status', label: 'Change room status' },
      { id: 'frontdesk.night-audit', label: 'Run night audit' },
    ],
  },
  {
    key: 'events-conferences',
    label: 'Events & Conferences',
    icon: '🎪',
    fullAccessId: 'events-conferences.*',
    ...crud('events-conferences', 'events & bookings'),
    extra: [
      { id: 'events-conferences.manage-venues', label: 'Add/edit a venue (hall)' },
      { id: 'events-conferences.delete-venue', label: 'Delete a venue' },
      { id: 'events-conferences.manage-catering', label: 'Add/edit a catering service' },
      { id: 'events-conferences.generate-quote', label: 'Generate/save a quote' },
      { id: 'events-conferences.generate-contract', label: 'Generate/open a contract' },
      { id: 'events-conferences.manage-beo', label: 'Save a BEO (banquet event order)' },
      { id: 'events-conferences.manage-invoice', label: 'Create/save an event invoice' },
      { id: 'events-conferences.manage-receipt', label: 'Create/save an event receipt' },
      { id: 'events-conferences.manage-folio', label: 'Manage an event folio' },
      { id: 'events-conferences.complete-event', label: 'Mark an event completed' },
      { id: 'events-conferences.post-payment', label: 'Record a payment/deposit' },
      { id: 'events-conferences.export-data', label: 'Export event data' },
      { id: 'events-conferences.manage-rates', label: 'Add/edit an event rate' },
    ],
  },
  {
    key: 'restaurant',
    label: 'Restaurant & Bar',
    icon: '🍽️',
    fullAccessId: 'restaurant.*',
    ...crud('restaurant', 'menu items & orders'),
    extra: [
      { id: 'restaurant.pos', label: 'Use POS terminal' },
      { id: 'restaurant.apply-discount', label: 'Apply a discount' },
      { id: 'restaurant.post-payment', label: 'Post a payment' },
      { id: 'restaurant.manage-tables', label: 'Set/change a table status' },
      { id: 'restaurant.manage-reservations', label: 'Create/edit a table reservation' },
      { id: 'restaurant.toggle-availability', label: 'Toggle menu item availability' },
    ],
  },
  {
    key: 'kitchen',
    label: 'Kitchen',
    icon: '👨‍🍳',
    fullAccessId: 'kitchen.*',
    ...crud('kitchen', 'kitchen tickets', { create: false, delete: false }),
    extra: [
      { id: 'kitchen.send-to-kitchen', label: 'Send an order to the kitchen' },
      { id: 'kitchen.cancel-order', label: 'Cancel an order' },
      { id: 'kitchen.manager-override', label: 'Manager PIN override (delete/void order)' },
      { id: 'kitchen.manage-inventory', label: 'Manage kitchen ingredient stock & submit stock requisitions' },
    ],
  },
  {
    key: 'housekeeping',
    label: 'Housekeeping & Maintenance',
    icon: '🛏️',
    fullAccessId: 'housekeeping.*',
    ...crud('housekeeping', 'tasks', { viewId: 'housekeeping.view' }),
    extra: [
      { id: 'housekeeping.update-room-status', label: 'Mark room clean/dirty/ready' },
      { id: 'housekeeping.block-room', label: 'Block a room (out-of-order)' },
      { id: 'housekeeping.assign-task', label: 'Assign a task to staff' },
      { id: 'housekeeping.log-maintenance', label: 'Log a maintenance request' },
      { id: 'housekeeping.manage-maintenance', label: "Update a maintenance request's status" },
      { id: 'housekeeping.manage-inspection', label: 'Create/save a room inspection' },
      { id: 'housekeeping.manage-supplies', label: 'Restock / add / edit supplies' },
      { id: 'housekeeping.manage-staff', label: 'Add/edit housekeeping staff' },
    ],
  },
  {
    key: 'inventory',
    label: 'Inventory & Stores',
    icon: '📦',
    fullAccessId: 'inventory.*',
    ...crud('inventory', 'stock & purchase orders'),
    extra: [
      { id: 'inventory.manage-suppliers', label: 'Add/edit a supplier' },
      { id: 'inventory.approve-po', label: 'Approve/reject a purchase order' },
      { id: 'inventory.create-requisition', label: 'Create a requisition' },
      { id: 'inventory.approve-requisition', label: 'Approve/reject a requisition, and mark it ready for pickup' },
      { id: 'inventory.approve-high-value-requisition', label: 'Approve/reject a requisition at or above the director approval threshold' },
      { id: 'inventory.edit-processed-requisition', label: 'Edit or delete a requisition Stores has already acted on' },
      { id: 'inventory.receive-goods', label: 'Receive goods against a PO' },
      { id: 'inventory.quality-check', label: 'Perform a quality check' },
      { id: 'inventory.issue-stock', label: 'Issue stock to a department' },
      { id: 'inventory.transfer-stock', label: 'Transfer stock between locations' },
      { id: 'inventory.stock-count', label: 'Start/complete a stock count' },
      { id: 'inventory.manage-supplier-invoices', label: 'Create/pay a supplier invoice' },
      { id: 'inventory.acknowledge-alert', label: 'Acknowledge an inventory alert' },
    ],
  },
  {
    key: 'security',
    label: 'Security Operations',
    icon: '🚨',
    fullAccessId: 'security.*',
    ...crud('security', 'incident logs'),
    extra: [
      { id: 'security.assign-incident', label: 'Assign an incident to staff' },
      { id: 'security.resolve-incident', label: 'Resolve an incident' },
      { id: 'security.register-visitor', label: 'Register a visitor (check in)' },
      { id: 'security.checkout-visitor', label: 'Check out a visitor' },
      { id: 'security.manage-patrols', label: 'Start/complete a security patrol' },
      { id: 'security.manage-personnel', label: 'Add/deactivate outsourced security personnel' },
      { id: 'security.manage-checkpoints', label: 'Add/deactivate checkpoint locations' },
      { id: 'security.manage-routes', label: 'Add/deactivate patrol routes' },
      { id: 'security.manage-shifts', label: 'Check staff in/out of a duty shift' },
      { id: 'security.mark-compliance', label: 'Mark a compliance requirement completed' },
    ],
  },
  {
    key: 'hr',
    label: 'HR & Payroll',
    icon: '👥',
    fullAccessId: 'hr.*',
    ...crud('hr', 'employee records'),
    extra: [
      { id: 'hr.log-employee-change', label: 'Log an employee change' },
      { id: 'hr.manage-payroll-periods', label: 'Create a payroll period' },
      { id: 'hr.process-payroll', label: 'Process payroll for a period' },
      { id: 'hr.approve-payroll', label: 'Approve payroll' },
      { id: 'hr.manage-leave', label: 'Approve/reject a leave request' },
      { id: 'hr.manage-shifts', label: 'Schedule a shift' },
      { id: 'hr.manage-benefits', label: 'Enroll/cancel a benefits enrollment' },
      { id: 'hr.manage-performance-reviews', label: 'Add/edit a performance review' },
      { id: 'hr.manage-onboarding', label: 'Manage employee onboarding' },
      { id: 'hr.manage-training', label: 'Enroll an employee in training' },
    ],
  },
  {
    key: 'accounting',
    label: 'Accounting & Finance',
    icon: '🧾',
    fullAccessId: 'accounting.*',
    ...crud('accounting', 'transactions & invoices'),
    extra: [
      { id: 'accounting.post-journal-entry', label: 'Post a journal entry' },
      { id: 'accounting.approve-journal-entry', label: 'Approve/reverse a journal entry' },
      { id: 'accounting.approve-payment', label: 'Approve a payment at or above the director approval threshold' },
      { id: 'accounting.manage-ap', label: 'Record a supplier invoice/payment (AP)' },
      { id: 'accounting.manage-ar', label: 'Record a customer invoice/receipt (AR)' },
      { id: 'accounting.void-transaction', label: 'Void an invoice or receipt' },
      { id: 'accounting.manage-wht', label: 'Record/receive a WHT payment or certificate' },
      { id: 'accounting.manage-bank', label: 'Sync cashbook / post bank items to ledger' },
      { id: 'accounting.reconcile-bank', label: 'Complete a bank reconciliation' },
      { id: 'accounting.approve-reconciliation', label: 'Approve and lock a reconciliation' },
      { id: 'accounting.manage-chart-of-accounts', label: 'Manage the chart of accounts' },
      { id: 'accounting.manage-centers', label: 'Manage cost/revenue centers' },
      { id: 'accounting.close-period', label: 'Close an accounting period' },
      { id: 'accounting.manage-ppe', label: 'Add/dispose a fixed asset (PPE)' },
    ],
  },
  {
    key: 'compliance',
    label: 'Compliance & Reports',
    icon: '⚖️',
    fullAccessId: 'compliance.*',
    ...crud('compliance', 'filings', { viewId: 'reports.view' }),
    extra: [
      { id: 'compliance.manage-tax-types', label: 'Create/edit a tax type' },
      { id: 'compliance.manage-tax-rules', label: 'Create/edit/delete a tax rule' },
      { id: 'compliance.submit-filing', label: 'Submit a filed report' },
      { id: 'compliance.approve-filing', label: 'Approve a filed report' },
    ],
  },
  {
    key: 'settings',
    label: 'System Settings',
    icon: '⚙️',
    fullAccessId: 'settings.*',
    ...crud('settings', 'users, roles & configuration', { viewId: 'settings.view' }),
    extra: [
      { id: 'settings.toggle-user-status', label: 'Activate/deactivate a user' },
      { id: 'settings.reset-password', label: "Change a user's password" },
      { id: 'settings.manage-2fa', label: 'Toggle two-factor authentication' },
      { id: 'settings.manage-role-permissions', label: 'Assign permissions to a role' },
      { id: 'settings.manage-document-numbering', label: 'Configure document numbering' },
      { id: 'settings.manage-templates', label: 'Save/publish a document template' },
      { id: 'settings.manage-rooms-pricing', label: 'Configure room types, rate plans & seasonal rates' },
      { id: 'settings.manage-security-policy', label: 'Configure security policy (2FA, session timeout, passwords)' },
      { id: 'settings.view-audit-log', label: 'View the system audit log (logins & actions)' },
      { id: 'settings.manage-approval-thresholds', label: 'Configure director-approval thresholds for expenses, purchase orders & payments' },
    ],
  },
];

/** Special case: '*' grants every permission in every module (System Administrator). */
export const FULL_SYSTEM_ACCESS = '*';
