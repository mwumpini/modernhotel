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
  | 'compliance';

export type HelpTopicCategory =
  | 'operations'
  | 'configuration'
  | 'finance'
  | 'general';

export type HelpTopic = {
  id: string;
  title: string;
  description: string;
  keywords: string[];
  category: HelpTopicCategory;
  /** Short procedural steps shown on the Help page */
  steps?: string[];
  /** Boundary note — what this screen does *not* control */
  notHere?: string;
  section?: HelpNavSection;
  href?: string;
  settingsTab?: 'users' | 'rooms' | 'numbering' | 'security';
  complianceTab?: 'tax' | 'payroll' | 'reports';
};

/** High-level map for staff — avoids hunting in the wrong module */
export const configurationGuide = {
  title: 'Where to configure what',
  intro:
    'Hotel setup is split on purpose. Use the area that owns the data — do not duplicate settings across screens.',
  areas: [
    {
      name: 'System Setup (/setup)',
      owns: 'Company legal name, address, tax ID, country, currency, date/time formats, initial security defaults.',
      notHere: 'Day-to-day room rates, VAT percentages, or staff accounts after first run.',
      href: '/setup' as const,
    },
    {
      name: 'Settings → System Settings',
      owns: 'Users & roles, room types & rate plans, document numbering (invoices, receipts), password & session policy.',
      notHere: 'VAT/NHIL/levy percentages — those live in Compliance.',
      section: 'settings' as const,
    },
    {
      name: 'Compliance & Reports',
      owns: 'Tax rules (VAT, NHIL, GETFund, Tourism Levy), GL mapping, PAYE bands, filing schedules & return tracking.',
      notHere: 'Room nightly prices or company registration details.',
      section: 'compliance' as const,
    },
  ],
};

/** For developers / admins maintaining Help content */
export const helpMaintainerGuide = {
  title: 'How to update Help later',
  file: 'src/app/help/helpContent.ts',
  steps: [
    'Add or edit an entry in the helpTopics array (id, title, description, keywords, category).',
    'To deep-link into Settings, set section: "settings" and settingsTab to users | rooms | numbering | security.',
    'To deep-link into Compliance, set section: "compliance" and complianceTab to tax | payroll | reports.',
    'For standalone pages (e.g. setup wizard), set href: "/setup" instead of section.',
    'Optional: add steps[] for procedures and notHere to warn users away from the wrong module.',
    'Country list, category labels, seed taxes/reports, rule templates, and hospitality reference: src/app/lib/compliance/config/*.json (loaded via config.ts).',
    'Runtime edits persist to prisma/compliance.*.json via ComplianceDB APIs.',
    'Press F1 or F12 in the app to verify search finds new keywords and "Open in app" lands on the right tab.',
  ],
};

export const helpTopics: HelpTopic[] = [
  // —— Configuration ——
  {
    id: 'config-map',
    title: 'Configuration map (Setup vs Settings vs Compliance)',
    description: 'Which module owns company info, room prices, tax rates, and numbering.',
    keywords: ['where', 'configure', 'setup', 'settings', 'compliance', 'map', 'boundaries'],
    category: 'configuration',
    steps: [
      'First visit: complete System Setup (/setup) for company, country, and currency.',
      'Ongoing: use Settings for users, rooms & rate plans, numbering, and security.',
      'Tax rates and filing: use Compliance → Tax rules, Payroll tax, or Reports & Filing.',
    ],
  },
  {
    id: 'setup',
    title: 'Initial setup wizard',
    description: 'First-run property bootstrap: company, localization, currency, and base policies.',
    keywords: ['configure', 'wizard', 'first run', 'country', 'currency', 'company'],
    category: 'configuration',
    href: '/setup',
    steps: [
      'Open /setup or follow the banner in Settings when setup is incomplete.',
      'Enter company details, country, currency, and localization.',
      'Complete numbering and security defaults, then finish the wizard.',
    ],
    notHere: 'Ongoing VAT/NHIL rate changes — use Compliance after setup.',
  },
  {
    id: 'settings',
    title: 'System settings (overview)',
    description: 'Users, rooms & pricing, document numbering, and security.',
    keywords: ['config', 'settings', 'admin'],
    category: 'configuration',
    section: 'settings',
  },
  {
    id: 'users',
    title: 'Users & roles',
    description: 'Create staff accounts, assign roles, and manage personal preferences.',
    keywords: ['users', 'roles', 'admin', 'preferences', 'password'],
    category: 'configuration',
    section: 'settings',
    settingsTab: 'users',
    steps: [
      'Settings → Users & Roles tab.',
      'Add user, assign role, set active status.',
      'Use Preferences sub-tab for theme and display options per user.',
    ],
  },
  {
    id: 'rooms-pricing',
    title: 'Rooms & pricing',
    description: 'Room types, rate plans, seasonal pricing, event rates, and operational policies.',
    keywords: ['rates', 'pricing', 'room types', 'seasonal', 'rate plan', 'bar'],
    category: 'configuration',
    section: 'settings',
    settingsTab: 'rooms',
    steps: [
      'Settings → Rooms & Pricing → Rate Plans for nightly prices.',
      'Use seasonal rates on each plan for peak/off-peak.',
      'Event & Conference Rates tab for conference packages.',
    ],
    notHere: 'VAT or NHIL percentages — tax preview uses rules from Compliance.',
  },
  {
    id: 'numbering',
    title: 'Document numbering',
    description: 'Invoice, receipt, reservation, and client ID formats and next numbers.',
    keywords: ['invoice', 'receipt', 'numbering', 'prefix', 'folio', 'reservation number'],
    category: 'configuration',
    section: 'settings',
    settingsTab: 'numbering',
    steps: [
      'Settings → Document Numbering.',
      'Set prefix, format pattern, and next number per document type.',
      'Save — new documents pick up the sequence automatically.',
    ],
  },
  {
    id: 'security-settings',
    title: 'Security & passwords',
    description: 'Two-factor auth, session timeout, and password policy for all staff.',
    keywords: ['2fa', 'password', 'session', 'security', 'lockout'],
    category: 'configuration',
    section: 'settings',
    settingsTab: 'security',
    notHere: 'Company tax ID or VAT rates.',
  },
  {
    id: 'compliance',
    title: 'Compliance & tax (overview)',
    description: 'Tax rules, PAYE, and regulatory filing — drives all system tax calculations.',
    keywords: ['ghana', 'compliance', 'tax', 'gra'],
    category: 'configuration',
    section: 'compliance',
  },
  {
    id: 'tax-rules',
    title: 'Tax rules (VAT, NHIL, levies)',
    description: 'Configure rates and GL codes; syncs to accounting and every invoice/room tax calculation.',
    keywords: ['vat', 'nhil', 'getfund', 'tourism levy', 'tax rates', 'wht', 'gl'],
    category: 'configuration',
    section: 'compliance',
    complianceTab: 'tax',
    steps: [
      'Compliance → Tax rules tab.',
      'Use Rules, Tax Types, or Simulator sub-tabs as needed.',
      'Ensure each rule has a valid GL code on the chart of accounts.',
      'Save — rates flow to accounting store and computeSalesTax() everywhere.',
    ],
    notHere: 'Room base prices — set those under Settings → Rooms & Pricing.',
  },
  {
    id: 'paye',
    title: 'PAYE & payroll tax',
    description: 'Configure PAYE bands, SSNIT, and payroll deductions for staff — separate from sales VAT.',
    keywords: ['paye', 'payroll', 'ssnit', 'income tax', 'withholding', 'bands'],
    category: 'configuration',
    section: 'compliance',
    complianceTab: 'payroll',
    steps: [
      'Compliance → Payroll tax tab.',
      'Load or edit the country payroll template.',
      'Run a test calculation before posting payroll periods.',
    ],
    notHere: 'Guest invoice VAT/NHIL — use Compliance → Tax rules.',
  },
  {
    id: 'compliance-reports',
    title: 'Compliance reports & filing',
    description: 'VAT, NHIL, PAYE, WHT, SSNIT, CIT, GSL schedules plus Ghana hospitality tax reference (June 2026 / Act 1151).',
    keywords: ['vat return', 'filing', 'ssnit', 'paye', 'wht', 'gsl', 'cit', 'reports', 'due date', 'hospitality', 'act 1151'],
    category: 'configuration',
    section: 'compliance',
    complianceTab: 'reports',
    steps: [
      'Compliance → Reports & Filing → Filing schedule for due dates and required fields.',
      'Switch to Hospitality reference for CIT, VAT stack, PAYE bands, WHT, SSNIT, GSL, and capital allowances.',
      'Defaults live in src/app/lib/compliance/config/seed-reports.json and config/hospitality/gh-2026.json.',
    ],
  },

  // —— Operations ——
  {
    id: 'exec',
    title: 'Executive dashboard',
    description: 'Property-wide KPIs, summaries, and management views.',
    keywords: ['gm', 'executive', 'dashboard', 'management', 'overview'],
    category: 'operations',
    section: 'dashboard',
  },
  {
    id: 'front',
    title: 'Front office',
    description: 'Check-ins, room status, guest services, and front-desk operations.',
    keywords: ['front desk', 'reception', 'guest', 'rooms', 'check in', 'checkout'],
    category: 'operations',
    section: 'frontdesk',
  },
  {
    id: 'hk',
    title: 'Housekeeping',
    description: 'Room cleaning status, assignments, and housekeeping workflow.',
    keywords: ['cleaning', 'rooms', 'housekeeper', 'status'],
    category: 'operations',
    section: 'housekeeping',
  },
  {
    id: 'fb',
    title: 'Food & beverage',
    description: 'Restaurant, bar, kitchen, menu, and F&B operations.',
    keywords: ['restaurant', 'bar', 'kitchen', 'menu', 'pos', 'food'],
    category: 'operations',
    section: 'food-beverage',
  },
  {
    id: 'evt',
    title: 'Events & conferences',
    description: 'Banquets, conferences, and event booking workflows.',
    keywords: ['conference', 'banquet', 'event', 'meeting'],
    category: 'operations',
    section: 'events-conferences-standalone',
  },
  {
    id: 'inv',
    title: 'Inventory & supply',
    description: 'Stock, purchasing, and supply-chain style inventory screens.',
    keywords: ['stock', 'stores', 'purchase', 'warehouse'],
    category: 'operations',
    section: 'inventory',
  },
  {
    id: 'sec',
    title: 'Security operations',
    description: 'Security operations, logs, and property safety views.',
    keywords: ['safety', 'access', 'logs', 'incident'],
    category: 'operations',
    section: 'security',
  },

  // —— Finance ——
  {
    id: 'acc',
    title: 'Accounting',
    description: 'GL, AP/AR, bank, reports, and audit-related accounting screens.',
    keywords: ['finance', 'ledger', 'payable', 'receivable', 'reports', 'journal'],
    category: 'finance',
    section: 'accounting-management',
    notHere: 'Editing VAT/NHIL rates — change rules in Compliance; accounting reads synced configs.',
  },
  {
    id: 'hr',
    title: 'Human resources',
    description: 'Staff records, payroll views, and HR compliance (separate from hotel tax rules).',
    keywords: ['staff', 'payroll', 'employee', 'ssnit', 'paye hr'],
    category: 'finance',
    section: 'hr',
  },

  // —— General ——
  {
    id: 'messenger',
    title: 'Department messenger',
    description: 'Open the department chat / notices panel from anywhere (Ctrl+M).',
    keywords: ['chat', 'message', 'messenger', 'ctrl m', 'announcements'],
    category: 'general',
  },
  {
    id: 'help-keys',
    title: 'Keyboard shortcuts',
    description: 'F1 or F12 opens Help. Esc returns to the dashboard from this page.',
    keywords: ['keyboard', 'shortcut', 'f12', 'f1', 'escape'],
    category: 'general',
  },
  {
    id: 'help-maintain',
    title: 'Updating this Help page (for admins & developers)',
    description: 'How to add topics and keep configuration guidance accurate when the product changes.',
    keywords: ['documentation', 'help content', 'maintain', 'developer', 'helpTopics'],
    category: 'general',
    steps: helpMaintainerGuide.steps,
  },
];

export const helpCategoryLabels: Record<HelpTopicCategory, string> = {
  configuration: 'Configuration & setup',
  operations: 'Daily operations',
  finance: 'Finance & HR',
  general: 'General',
};

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
