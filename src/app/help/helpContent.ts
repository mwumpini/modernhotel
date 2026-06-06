/** Targets Navigation `activeSection` after `localStorage.nav.section` handoff on `/`. */
export type HelpNavSection =
  | 'dashboard'
  | 'frontdesk'
  | 'housekeeping'
  | 'food-beverage'
  | 'accounting-management'
  | 'hr'
  | 'security'
  | 'inventory'
  | 'events-conferences-standalone'
  | 'settings'
  | 'compliance'
  | 'offline-management'
  | 'user-management-unified';

export type HelpTopic = {
  id: string;
  title: string;
  description: string;
  keywords: string[];
  section?: HelpNavSection;
  href?: string;
};

export const helpTopics: HelpTopic[] = [
  {
    id: 'exec',
    title: 'Executive dashboard',
    description: 'Property-wide KPIs, summaries, and management views.',
    keywords: ['gm', 'executive', 'dashboard', 'management', 'overview'],
    section: 'dashboard',
  },
  {
    id: 'front',
    title: 'Front office',
    description: 'Check-ins, room status, guest services, and front-desk operations.',
    keywords: ['front desk', 'reception', 'guest', 'rooms', 'check in', 'checkout'],
    section: 'frontdesk',
  },
  {
    id: 'hk',
    title: 'Housekeeping',
    description: 'Room cleaning status, assignments, and housekeeping workflow.',
    keywords: ['cleaning', 'rooms', 'housekeeper', 'status'],
    section: 'housekeeping',
  },
  {
    id: 'fb',
    title: 'Food & beverage',
    description: 'Restaurant, bar, kitchen, menu, and F&B operations.',
    keywords: ['restaurant', 'bar', 'kitchen', 'menu', 'pos', 'food'],
    section: 'food-beverage',
  },
  {
    id: 'acc',
    title: 'Accounting',
    description: 'GL, AP/AR, bank, reports, and audit-related accounting screens.',
    keywords: ['finance', 'ledger', 'vat', 'payable', 'receivable', 'reports'],
    section: 'accounting-management',
  },
  {
    id: 'hr',
    title: 'Human resources',
    description: 'Staff, payroll-related views, and HR dashboards.',
    keywords: ['staff', 'payroll', 'employee', 'ssnit'],
    section: 'hr',
  },
  {
    id: 'sec',
    title: 'Security',
    description: 'Security operations, logs, and compliance views.',
    keywords: ['safety', 'access', 'logs'],
    section: 'security',
  },
  {
    id: 'inv',
    title: 'Inventory & supply',
    description: 'Stock, purchasing, and supply-chain style inventory screens.',
    keywords: ['stock', 'stores', 'purchase', 'warehouse'],
    section: 'inventory',
  },
  {
    id: 'evt',
    title: 'Events & conferences',
    description: 'Banquets, conferences, and event booking workflows.',
    keywords: ['conference', 'banquet', 'event', 'meeting'],
    section: 'events-conferences-standalone',
  },
  {
    id: 'setup',
    title: 'Initial setup wizard',
    description: 'Configure property, taxes, currency, and localization.',
    keywords: ['configure', 'wizard', 'first run', 'country', 'currency'],
    href: '/setup',
  },
  {
    id: 'settings',
    title: 'System settings',
    description: 'Rates, rooms, integrations, templates, and advanced configuration.',
    keywords: ['config', 'rates', 'rooms', 'api', 'offline', 'template'],
    section: 'settings',
  },
  {
    id: 'compliance',
    title: 'Compliance & reports',
    description: 'Ghana-specific compliance automation and reporting.',
    keywords: ['ghana', 'vat', 'nhil', 'tourism', 'levy', 'compliance'],
    section: 'compliance',
  },
  {
    id: 'offline',
    title: 'Offline & sync',
    description: 'Manage offline queues and synchronization when connectivity is limited.',
    keywords: ['sync', 'offline', 'network'],
    section: 'offline-management',
  },
  {
    id: 'users',
    title: 'Users & preferences',
    description: 'User management and preference screens.',
    keywords: ['users', 'roles', 'admin', 'preferences'],
    section: 'user-management-unified',
  },
  {
    id: 'messenger',
    title: 'Department messenger',
    description: 'Open the department chat / notices panel from anywhere.',
    keywords: ['chat', 'message', 'messenger', 'ctrl m', 'announcements'],
  },
  {
    id: 'help-keys',
    title: 'Keyboard help',
    description: 'F1 or F12 opens this page. Esc returns to the dashboard from here.',
    keywords: ['keyboard', 'shortcut', 'f12', 'f1', 'escape'],
  },
];

export const moduleQuickLinks: { label: string; section: HelpNavSection }[] = [
  { label: 'Executive', section: 'dashboard' },
  { label: 'Front office', section: 'frontdesk' },
  { label: 'Housekeeping', section: 'housekeeping' },
  { label: 'F&B', section: 'food-beverage' },
  { label: 'Accounting', section: 'accounting-management' },
  { label: 'HR', section: 'hr' },
  { label: 'Security', section: 'security' },
  { label: 'Inventory', section: 'inventory' },
  { label: 'Events', section: 'events-conferences-standalone' },
  { label: 'Compliance', section: 'compliance' },
  { label: 'Settings', section: 'settings' },
];
