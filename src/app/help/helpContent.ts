/** Targets Navigation `activeSection` after `localStorage.nav.section` handoff on `/`. */
export type HelpNavSection =
  | 'dashboard'
  | 'frontdesk'
  | 'housekeeping'
  | 'food-beverage'
  | 'kitchen'
  | 'accounting-management'
  | 'hr'
  | 'security'
  | 'inventory'
  | 'events-conferences-standalone'
  | 'settings'
  | 'compliance';

/** One chapter of Help, in side-menu order. `reference` is not a desk. */
export type HelpTopicCategory =
  | 'dashboard'
  | 'frontdesk'
  | 'events'
  | 'restaurant'
  | 'kitchen'
  | 'housekeeping'
  | 'inventory'
  | 'security'
  | 'hr'
  | 'accounting'
  | 'compliance'
  | 'settings'
  | 'operations'
  | 'reference';

export type HelpTopic = {
  id: string;
  title: string;
  description: string;
  keywords: string[];
  category: HelpTopicCategory;
  /** Short procedural steps shown on the Help page */
  steps?: string[];
  /** Screenshot under public/help-images, served as /help-images/... */
  image?: string;
  imageAlt?: string;
  /** Boundary note — what this screen does *not* control */
  notHere?: string;
  /** Operations manual: each setting and what it does, in plain words. */
  rules?: Array<{ name: string; meaning: string }>;
  /** Operations manual: worked examples, each a short list of lines. */
  examples?: Array<{ title: string; lines: string[] }>;
  /** Process flows: one row per step — who acts, where in the app, what they do, what the system does. */
  flow?: Array<{ who: string; where: string; action: string; result: string }>;
  section?: HelpNavSection;
  href?: string;
  settingsTab?: 'users' | 'rooms' | 'policies' | 'tills' | 'numbering' | 'templates' | 'locations' | 'security' | 'approvals' | 'modules' | 'sample-data' | 'audit' | 'profile';
  complianceTab?: 'tax' | 'payroll' | 'reports';
  /** Opens that tab after the desk loads. */
  accountingTab?: 'receivables' | 'payables' | 'banking' | 'assets' | 'journal' | 'statements' | 'accounts';
  hrTab?: 'employees' | 'leave' | 'time' | 'payroll' | 'departments';
  securityTab?: 'patrols' | 'incidents' | 'visitors' | 'staff';
  eventsTab?: 'confirmed' | 'venues' | 'quoting' | 'staff';
  kitchenTab?: 'kds' | 'ready' | 'log';
  fbTab?: 'activity' | 'tables' | 'menu' | 'cashiering' | 'supplies';
  /** Stock & Supply tab inside Inventory → Stock. */
  inventoryOpsTab?: 'inventory' | 'suppliers' | 'requisitions' | 'purchase-orders' | 'transfers' | 'goods-issue' | 'supplier-invoices' | 'stock-operations';
  /** Purchase Orders inner tab. */
  inventoryPoView?: 'orders' | 'goods-receipt';
};

/** Every keyboard shortcut, shown on the Help page, in its "Keyboard shortcuts" topic and in the manual. */
export const keyboardShortcuts = [
  { keys: 'Ctrl + L', action: 'Sign out at once (hand the till or desk to the next person). Not while typing in a box, so a slip cannot lose a half-filled form' },
  { keys: 'Ctrl + Shift + L', action: 'Sign out from anywhere, even while typing' },
  { keys: 'Ctrl + Shift + H', action: 'Open this Help page from any desk' },
  { keys: 'F1 / F12', action: 'Open Ask Mamani on the current desk. Opens this Help page when that desk has no assistant.' },
  { keys: 'Ctrl + M', action: 'Open the department messenger (when not typing in a field)' },
  { keys: 'Esc', action: 'Close the open window. From this Help page: back to the dashboard' },
  { keys: 'Ctrl + Enter', action: 'POS: send the order' },
  { keys: 'Ctrl + P', action: 'POS: open payment' },
];

/** High-level map for staff — avoids hunting in the wrong module */
export const configurationGuide = {
  title: 'Where to configure what',
  intro:
    'Hotel setup is split on purpose. Use the area that owns the data — do not duplicate settings across screens.',
  areas: [
    {
      name: 'Settings → Company Profile',
      owns: 'Hotel name, legal name, logo (position and size on documents), TIN, registration number, address, contacts, timezone, date and time formats.',
      notHere: 'Country and currency (set once when the hotel first opens) or VAT percentages (Compliance).',
      section: 'settings' as const,
    },
    {
      name: 'Settings → System Settings',
      owns: 'Users & roles, room types & rate plans, document numbering (invoices, receipts), password & session policy.',
      notHere: 'VAT/NHIL/levy percentages — those live in Compliance.',
      section: 'settings' as const,
    },
    {
      name: 'Compliance & Reports',
      owns: 'Guest-bill taxes (VAT, NHIL, GETFund, tourism levy), supplier withholding, staff PAYE, and filing dates.',
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
    'Add or edit an entry in the helpTopics array (id, title, description, keywords, category). Category is the side-menu desk: dashboard, frontdesk, events, restaurant, kitchen, housekeeping, inventory, security, hr, accounting, compliance, or settings.',
    'Add the topic id to that desk in helpModules, in the order a person meets that part of the desk. Help and the manual follow helpModules, from Executive Management through System Settings.',
    'To deep-link into Settings, set section: "settings" and settingsTab to users | rooms | numbering | locations | security.',
    'To deep-link into Compliance, set section: "compliance" and complianceTab to tax | payroll | reports.',
    'For standalone pages (e.g. setup wizard), set href: "/setup" instead of section.',
    'Optional: add steps[] for the procedure, image for a screenshot in public/help-images, and notHere to warn users away from the wrong module.',
    'Screenshots: with the dev server running and sample data loaded, run node scripts/capture-help-screenshots.mjs (all of them) or name a few (e.g. front-checkin users). Add a new screen to the SHOTS list in that script.',
    'The Download manual button on the Help page builds the manual from this same file, so new topics and pictures appear in it with nothing else to do.',
    'Country list, category labels, seed taxes/reports, rule templates, and hospitality reference: src/app/lib/compliance/config/*.json (loaded via config.ts).',
    'Runtime edits persist to prisma/compliance.*.json via ComplianceDB APIs.',
    'Press F1 or F12 in the app to verify search finds new keywords and "Open in app" lands on the right tab.',
  ],
};

export const helpTopics: HelpTopic[] = [
  {
    id: 'reach-premises',
    title: 'On-premises only',
    description: 'One computer in the hotel keeps the records. Phones, tablets and other computers on the same Wi-Fi open that computer.',
    keywords: ['install', 'setup', 'premises', 'server', 'wifi', 'wi-fi', 'exe', 'agm sync setup', 'local'],
    category: 'dashboard',
    steps: [
      'Run AGMSync-Setup.exe on the computer that stays on.',
      'The AGM Sync icon opens the hotel in the browser. No black window stays open.',
      'On the sign-in page, note the address. It looks like http://192.168.x.x:3000.',
      'Put every other phone, tablet and computer on the same Wi-Fi and open that address. They share this computer’s records.',
      'This computer must stay on. The internet can be down.',
    ],
    notHere: 'https://app.agmsync.com is a separate copy. It does not share these records. Use Cloud and premises when home and the hotel must see the same records.',
  },
  {
    id: 'reach-cloud',
    title: 'Cloud and premises',
    description: 'The hotel computer and https://app.agmsync.com keep one set of records. A change at home shows in the hotel, and a change in the hotel shows at home.',
    keywords: ['cloud', 'sync', 'link', 'home', 'internet', 'app.agmsync.com', 'two way', 'premises'],
    category: 'dashboard',
    href: '/sync',
    steps: [
      'Close any other AGM Sync window, then run AGMSync-Cloud-Premises-Setup.exe on the computer that stays on.',
      'On the link page, enter the cloud address, the hotel code, and the cloud sign-in.',
      'Someone at home opens https://app.agmsync.com. Someone in the hotel opens the address on the sign-in page. After a sync, both show the same records.',
      'While the internet is up, changes pass both ways. When it is down, this computer keeps working, and the missed changes catch up when the internet returns.',
      'If both sides change the same record before they connect, the later change is the one that remains.',
    ],
    notHere: 'AGMSync-Setup.exe does not send records to the cloud.',
  },
  {
    id: 'reach-icon',
    title: 'Save an icon on a phone, tablet or computer',
    description: 'Save the hotel page the same way you save any webpage. The icon opens the sign-in.',
    keywords: ['icon', 'home screen', 'shortcut', 'android', 'iphone', 'ipad', 'tablet', 'staff', 'mac', 'windows'],
    category: 'dashboard',
    href: '/staff',
    steps: [
      'Open Save an icon from the sign-in page, or go to /staff. Copy the address shown there.',
      'On the hotel Wi-Fi that address is the hotel computer. On the cloud it is https://app.agmsync.com.',
      'Android: open it in Chrome, then the menu, then Add to Home screen.',
      'iPhone, iPad and tablet: open it in Safari, tap Share, then Add to Home Screen.',
      'Windows: open it in Chrome or Edge, then Create shortcut, or Apps then Install. On a Mac: Safari File then Add to Dock, or Chrome Create shortcut.',
    ],
  },
  {
    id: 'start-desks',
    title: 'How a desk is laid out',
    description: 'Every department screen has a title, a summary you can hide, and tabs for the work.',
    keywords: ['summary', 'tabs', 'show summary', 'hide summary', 'tablet', 'layout', 'desk'],
    category: 'dashboard',
    image: '/help-images/desk-summary.png',
    imageAlt: "The Front Office desk with the summary shown: count cards at the top, Hide summary and Customize at the top right.",
    steps: [
      'The title row names the desk. Show summary / Hide summary sits at the top right, next to Customize and Expand.',
      'The summary (the count cards, today\'s operations, and quick actions) is hidden when a desk opens, so the work tabs come first. Press Show summary to bring it up, and Hide summary to put it away. Each desk remembers your choice.',
      'Customize picks which cards a desk shows. Recent activity and notices start hidden. Turn them on in Customize; this device remembers that choice.',
      'Wide tables scroll inside their own box. The page itself does not scroll sideways.',
    ],
  },
  {
    id: 'start-mamani',
    title: 'Ask Mamani',
    description: 'The desk assistant drafts notices and answers how-to questions from Help, the Operations Manual, and the Process Flows of every module.',
    keywords: ['mamani', 'ask', 'ai', 'f12', 'f1', 'assistant', 'how to'],
    category: 'dashboard',
    steps: [
      'On a desk, press F1 or F12, or open Messenger (Ctrl+M) and choose Ask Mamani.',
      'Use a suggested prompt, or type a question such as "How do I change VAT?"',
      'A how-to can come from any module, including its operations rules and process flow, not only the desk you are on. Open jumps to that screen or that page of the manual.',
      'A drafted notice can be copied into Messenger. You still press Send. Mamani does not post it.',
      'On Settings, Compliance, and other screens without the assistant, F1 and F12 open this Help page. Full Help inside Ask Mamani does the same.',
    ],
  },
  {
    id: 'start-notices',
    title: 'Notices and the messenger',
    description: 'Send a department notice, or a private message, without leaving the desk.',
    keywords: ['notice', 'messenger', 'ctrl m', 'urgent', 'department', 'chat'],
    category: 'dashboard',
    steps: [
      'Press Ctrl+M or the round message button to open the drawer.',
      'Choose Info, Normal, or Urgent, pick the departments, type the message, and press Send.',
      'Use @frontdesk, @housekeeping, @inventory, and the other department names to mention a desk.',
      'Turn on Private to message one colleague instead of posting a notice.',
    ],
  },

  // —— Configuration ——
  {
    id: 'config-map',
    title: 'Configuration map (Setup vs Settings vs Compliance)',
    description: 'Which module owns company info, room prices, tax rates, and numbering.',
    keywords: ['where', 'configure', 'setup', 'settings', 'compliance', 'map', 'boundaries'],
    category: 'settings',
    steps: [
      'First visit: the setup wizard asks once for the company, country, and currency. Afterwards, change company details in Settings → Company Profile. The books stay in that currency. Other currencies are added under Settings → Operational Policies → Currencies, switched on while you are taking them, then switched off to return to cedis.',
      'Ongoing: use Settings for users, rooms & rate plans, numbering, and security.',
      'Tax rates and filing: use Compliance → Tax rules, Payroll tax, or Reports & Filing.',
    ],
  },
  {
    id: 'setup',
    title: 'Initial setup wizard',
    description: 'First-run property bootstrap: company, localization, currency, and base policies.',
    keywords: ['configure', 'wizard', 'first run', 'country', 'currency', 'company'],
    category: 'settings',
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
    description: 'The last desk. Users, rooms, documents, stock locations, security, approvals, and the company profile.',
    keywords: ['config', 'settings', 'admin', 'templates', 'approvals', 'audit', 'locations'],
    category: 'settings',
    section: 'settings',
    image: '/help-images/settings.png',
    imageAlt: 'System Settings and its tabs, including Document Templates, Stock Locations, Security, Approvals, and Audit Log.',
    steps: [
      'Open System Settings in the side menu.',
      'The tabs run across the top: Users & Roles, Rooms & Pricing, Operational Policies, Till management, Document Numbering, Document Templates, Stock Locations, Security, Approvals, Modules, Sample Data, Audit Log, and Company Profile.',
      'People in the side menu opens Users & Roles. Rooms, Documents, and Stock open those tabs. The Security tab here is passwords and sign-in. Company Profile is the hotel name, logo, and TIN.',
    ],
  },
  {
    id: 'users',
    title: 'Users & roles',
    description: 'Create staff accounts, assign roles, and manage personal preferences.',
    keywords: ['users', 'roles', 'admin', 'preferences', 'password'],
    category: 'settings',
    image: '/help-images/users.png',
    imageAlt: "Settings, Users & Roles: the staff accounts and what each role may do.",
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
    description: 'Room types, rate plans, seasonal pricing, and operational policies.',
    keywords: ['rates', 'pricing', 'room types', 'seasonal', 'rate plan', 'bar'],
    category: 'settings',
    image: '/help-images/rooms-pricing.png',
    imageAlt: "Settings, Rooms & Pricing: room types, rooms, rate plans and service charges.",
    section: 'settings',
    settingsTab: 'rooms',
    steps: [
      'Settings → Rooms & Pricing → Rate Plans for nightly prices.',
      'Use seasonal rates on each plan for peak/off-peak.',
    ],
    notHere: 'VAT or NHIL percentages — tax preview uses rules from Compliance.',
  },
  {
    id: 'numbering',
    title: 'Document numbering',
    description: 'Invoice, receipt, reservation, and client ID formats and next numbers.',
    keywords: ['invoice', 'receipt', 'numbering', 'prefix', 'folio', 'reservation number'],
    category: 'settings',
    image: '/help-images/numbering.png',
    imageAlt: "Settings, Document Numbering: the prefix and next number for invoices, receipts and other documents.",
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
    title: 'Passwords and sign-in',
    description: 'The Security tab in System Settings: password rules, session timeout, and the manager PIN. This is not the security desk.',
    keywords: ['2fa', 'password', 'session', 'security', 'lockout', 'pin'],
    category: 'settings',
    image: '/help-images/security-settings.png',
    imageAlt: "Settings, Security tab: password, session, PIN rules and the manager PIN.",
    section: 'settings',
    settingsTab: 'security',
    steps: [
      'Open System Settings → Security. This tab is passwords and how long a sign-in lasts.',
      'Set the password rules, the session timeout, and the manager PIN.',
    ],
    notHere: 'Patrols, visitors, and incidents are the Security Operations desk, earlier in the side menu. They are not set here.',
  },
  {
    id: 'settings-templates',
    title: 'Document templates',
    description: 'The printed layout for front-desk documents, the restaurant receipt, event paperwork, and the payslip.',
    keywords: ['template', 'payslip', 'receipt', 'print', 'letterhead', 'document'],
    category: 'settings',
    section: 'settings',
    settingsTab: 'templates',
    steps: [
      'Open System Settings → Document Templates.',
      'Accommodation & Front Desk covers room and front-desk documents. Restaurant & Bar is the receipt the POS prints. Events & Conferences is separate.',
      'Pick the design and save it as the one that prints. The logo, name, address, and TIN come from Company Profile.',
    ],
    notHere: 'The next invoice number is Document Numbering, not the template.',
  },
  {
    id: 'settings-locations',
    title: 'Stock locations',
    description: 'The names of stores, fridges, and floor pantries that inventory transfers and issues use.',
    keywords: ['stock location', 'store', 'warehouse', 'pantry', 'fridge'],
    category: 'settings',
    section: 'settings',
    settingsTab: 'locations',
    steps: [
      'Open System Settings → Stock Locations, or Stock in the side menu.',
      'Add a location and keep it active. Inventory → Transfers and Issues offer these names.',
    ],
    notHere: 'Quantities on hand are Inventory & Stores, not here.',
  },
  {
    id: 'settings-approvals',
    title: 'Approval thresholds',
    description: 'The amount at which a journal, purchase, payment, overtime, or payroll must wait for a director.',
    keywords: ['approval', 'threshold', 'director', 'sign-off', 'purchase order'],
    category: 'settings',
    section: 'settings',
    settingsTab: 'approvals',
    steps: [
      'Open System Settings → Approvals.',
      'Turn on Require approval and set the amount for expenses and journal entries, purchase orders, payments, overtime, and payroll.',
      'Press Save Thresholds. A posting at or above that amount waits for someone who can approve it.',
    ],
  },
  {
    id: 'settings-audit',
    title: 'Audit log',
    description: 'Who signed in, changed a setting, or posted a document, and when.',
    keywords: ['audit', 'log', 'history', 'who changed'],
    category: 'settings',
    section: 'settings',
    settingsTab: 'audit',
    steps: [
      'Open System Settings → Audit Log.',
      'Search or filter the list. Each row is an action, the person, and the time.',
    ],
    notHere: 'Accounting → Activity log is the books. This log is sign-in and settings across the hotel.',
  },
  {
    id: 'compliance',
    title: 'Compliance & tax (overview)',
    description: 'Tax rules, PAYE, and regulatory filing — drives all system tax calculations.',
    keywords: ['ghana', 'compliance', 'tax', 'gra'],
    category: 'compliance',
    section: 'compliance',
    image: '/help-images/compliance.png',
    imageAlt: 'Compliance and Reports',
  },
  {
    id: 'tax-rules',
    title: 'How to set up taxes',
    description: 'Ghana guest-bill taxes, supplier withholding, and where staff tax and company tax live.',
    keywords: [
      'setup', 'set up', 'tax', 'taxes', 'vat', 'nhil', 'getfund', 'tourism levy',
      'withholding', 'wht', 'goods', 'supplier', 'guest bill', 'claim back', 'gl',
    ],
    category: 'compliance',
    image: '/help-images/compliance.png',
    imageAlt: "Compliance, Tax rules: the guest-bill taxes and supplier withholding rates.",
    section: 'compliance',
    complianceTab: 'tax',
    steps: [
      'Open Compliance & Reports in the side menu, then Tax rules. Leave the country on Ghana.',
      'The standard rates are already on the list. Check them before you add a new one.',
      'Careful: VAT, NHIL, and GETFund work on both sides. Changing one of their rates, or switching one off, changes what is added to guest bills (sales) and what you claim back on supplier bills (purchases) at the same time. The Tourism Levy changes guest bills only; withholding rules change supplier payments only. Change a rate only when GRA changes it, and tell your accountant.',
      'Guest bills is what is added to a room or a meal: Tourism Levy 1% (Claim back No), NHIL 2.5% (Yes), GETFund 2.5% (Yes), and VAT 15% (Yes). VAT, NHIL, and GETFund are each worked out on the same amount.',
      'Claim back Yes means a supplier bill can claim that tax. Tourism stays No, so it is never claimed.',
      'Supplier bills is money kept back from a supplier: services 7.5%, goods 3%, works 5%, commercial rent 15%, residential rent 8%. These are not added to a guest bill.',
      'On a supplier bill in Accounting, choose Standard purchase stack for the VAT, NHIL, and GETFund you can claim. Choose Hotel bill when the supplier is another hotel: those three can still be claimed, and the Tourism Levy is a cost. Press Tax under the total to see each line. Hotel-bill rates are their own type in Compliance and do not change the guest-bill rates. Turn on Withhold tax and pick goods, services, works, or rent.',
      'To add a rate that is missing, press + Tax Rule. Pick the tax type, type the name, the percent, and the account code, then save. Leave More options closed.',
      'Both shows the guest-bill list and the withholding list together. Simulator lets you type an amount and see the tax. It does not save.',
      'Staff income tax and SSNIT are on the Payroll tax tab. Company income tax and the dates you file are on Reports & Filing. Neither is a line on a guest bill.',
    ],
    notHere: 'Nightly room prices are under Settings → Rooms & Pricing.',
  },
  {
    id: 'paye',
    title: 'Staff income tax (PAYE and SSNIT)',
    description: 'Set the PAYE bands and SSNIT rates used when you pay staff.',
    keywords: ['paye', 'payroll', 'ssnit', 'income tax', 'staff tax', 'bands', 'setup', 'tier 1', 'tier 2', 'tier 3', 'rename'],
    category: 'compliance',
    image: '/help-images/paye.png',
    imageAlt: "Compliance, Payroll tax: PAYE bands and the SSNIT tiers used by payroll.",
    section: 'compliance',
    complianceTab: 'payroll',
    steps: [
      'Open Compliance & Reports, then Payroll tax.',
      'The Ghana bands are already loaded. PAYE is worked out in bands on the month’s pay. SSNIT is the staff 5.5% plus the employer share.',
      'A new hotel starts as SSNIT (Tier 1), Tier 2, and Tier 3. Press a name to rename it, for example to the trustee or the provident fund. (Tier 1), (Tier 2), or (Tier 3) stays on the name. Payroll, the staff list, and the payslip use that name.',
      'Change a band only when the law changes. HR & Payroll → Payroll uses these rates when the month is prepared.',
    ],
    notHere: 'The monthly pay run is HR & Payroll → Payroll. Guest-bill VAT and supplier withholding are on Tax rules. Company income tax is on Reports & Filing.',
  },
  {
    id: 'compliance-reports',
    title: 'Filing dates and company income tax',
    description: 'When each return is due, and where the hotel’s company income tax sits.',
    keywords: ['vat return', 'filing', 'ssnit', 'paye', 'wht', 'gsl', 'cit', 'income tax', 'company tax', 'reports', 'due date', 'setup'],
    category: 'compliance',
    image: '/help-images/compliance-reports.png',
    imageAlt: "Compliance, Reports & Filing: what to file and when it is due.",
    section: 'compliance',
    complianceTab: 'reports',
    steps: [
      'Open Compliance & Reports, then Reports & Filing.',
      'Each row is a return: VAT, withholding, PAYE, SSNIT, tourism levy, company income tax, and the growth levy.',
      'Press Edit to change how often it is filed, the due rule, the amount, or the status. The next due date follows the due rule.',
      'A hotel’s company income tax is 22% of profit, paid in quarterly instalments, with the annual return four months after the year ends. It is not a line on a guest bill or a supplier bill.',
    ],
  },

  // —— Operations ——
  {
    id: 'exec',
    title: 'Executive dashboard',
    description: 'Property-wide view for the general manager: rooms, stock, staff, security, and open restaurant orders in one place.',
    keywords: ['gm', 'executive', 'dashboard', 'management', 'overview', 'approvals'],
    category: 'dashboard',
    section: 'dashboard',
    image: '/help-images/executive.png',
    imageAlt: 'Executive Management dashboard',
    steps: [
      'Open Executive Management in the side menu.',
      'Read the property cards for rooms, stock, and other desks. Hide summary if you need the lists higher on the screen.',
      'Approvals, when your role has them, are a separate item under Executive Management.',
      'Ask Mamani on this desk can summarize today\'s notices across the hotel.',
    ],
  },
  {
    id: 'front',
    title: 'Front office',
    description: 'The second desk. Desk, Rooms, Billing, Clients, Night, and Reports are the parts — open each one from the side menu.',
    keywords: ['front desk', 'reception', 'guest', 'rooms', 'check in', 'checkout', 'folio', 'billing', 'night', 'clients'],
    category: 'frontdesk',
    section: 'frontdesk',
    image: '/help-images/front-office.png',
    imageAlt: 'Front Office desk with room status and tabs',
    steps: [
      'Open Front Office Operations in the side menu. Under it: Desk, Rooms, Billing, Clients, Night, and Reports. Each name opens that part of this desk.',
      'Desk is the counter for the guest in front of you. Check-in, the open stay, wake-up calls, and checkout start here.',
      'Rooms is the board: occupied, vacant, or needs housekeeping. Room Transfer, on this part, moves a guest and keeps the same folio.',
      'Billing holds the folio (Invoices & Payments) and Cashiering, where you take the money. Clients is the guest and company list.',
      'Night closes the business date. Reports is the period summary.',
    ],
    notHere: 'Nightly room prices are set in Settings → Rooms & Pricing. Tax percentages are in Compliance.',
  },
  {
    id: 'front-checkin',
    title: 'Check in a guest',
    description: 'Move an arriving reservation to in-house and assign a room.',
    keywords: ['check-in', 'check in', 'arrival', 'assign room', 'walk in'],
    category: 'frontdesk',
    image: '/help-images/front-checkin.png',
    imageAlt: "The stay window at check-in: room nights with tax, the financial summary, Take payment and Check in.",
    section: 'frontdesk',
    steps: [
      'Open Front Office → Reservations and find the arrival, or open Desk from the side menu for check-in.',
      'Confirm the guest, dates, and rate. Assign a vacant room when one is free.',
      'Press Check-in. The stay becomes in-house and the room shows occupied.',
      'If no vacant room matches the dates, the desk can still post the night and leave the room open. Assign a room as soon as one is free.',
    ],
  },
  {
    id: 'front-wakeup',
    title: 'Schedule a wake-up call',
    description: 'A morning call for an in-house guest. The reminder stays on the browser where it was set.',
    keywords: ['wake-up', 'wake up', 'alarm', 'silent', 'morning call', 'notice'],
    category: 'frontdesk',
    section: 'frontdesk',
    steps: [
      'Open the in-house stay from Desk. Press Wake-up on the stay header. The form stays closed until you press it.',
      'Set the morning, the time, and a note if you need one. Under When due, choose Silent or Alarm, then press Schedule.',
      'The desk keeps one line of calls still to make: how many, the next guest and time, and Done and Cancel. More opens the rest, so a long list does not cover the worksheet. Finished calls leave that line.',
      'While this browser has the app open, a due call shows a notice at the bottom of any screen. Silent is the notice only. Alarm also sounds until Done or Quiet.',
      'The call stays on this browser. A person who later uses another computer does not get that notice. The sheet of calls is under Reports & Analysis → Wake-up Calls.',
    ],
    notHere: 'Night Audit does not schedule or ring wake-ups. A chargeable concierge service of the same name, if the hotel sells one, is a folio charge, not this reminder.',
  },
  {
    id: 'front-checkout',
    title: 'Check out and take payment',
    description: 'Settle the folio and release the room.',
    keywords: ['checkout', 'check out', 'payment', 'folio', 'cashier', 'invoice', 'dirty', 'housekeeping'],
    category: 'frontdesk',
    image: '/help-images/front-checkout.png',
    imageAlt: "An in-house stay: charges, payments, Open the folio and Check out.",
    section: 'frontdesk',
    steps: [
      'Open the stay from Desk or Reservations.',
      'Open Invoices & Payments and review room, tax, and extra charges.',
      'Open Cashiering and take the payment.',
      'Complete checkout. With Mark the room dirty on (Settings → Operational Policies → After checkout), housekeeping picks the room up as dirty. With it off, the room is vacant and can be sold at once.',
    ],
    notHere: 'Company tax rates are not edited here. A wrong VAT amount is fixed under Compliance → Tax rules.',
  },
  {
    id: 'front-transfer',
    title: 'Move a guest to another room',
    description: 'Room transfer keeps the same stay and folio.',
    keywords: ['room transfer', 'move room', 'change room'],
    category: 'frontdesk',
    image: '/help-images/front-transfer.png',
    imageAlt: "Room Transfer: pick the guest, the new room and the reason.",
    section: 'frontdesk',
    steps: [
      'Open Front Office → Room Transfer. Rooms in the side menu opens the room board.',
      'Select the in-house stay and the new vacant room.',
      'Confirm. The old room goes to housekeeping as dirty, or stays vacant if Mark the room dirty is off. The guest stays on the same folio.',
    ],
  },
  {
    id: 'front-audit',
    title: 'Close the business day (night audit)',
    description: 'Post the day\'s room charges and roll the business date. The hotel can also run this automatically at 1:00 AM.',
    keywords: ['night audit', 'close day', 'business date', 'end of day', 'catch up'],
    category: 'frontdesk',
    image: '/help-images/front-audit.png',
    imageAlt: "Night Audit: the business date, the checks, and Close.",
    section: 'frontdesk',
    steps: [
      'Open Front Office → Night Audit. Night in the side menu opens the same screen.',
      'The business date is on the title row. The (i) beside it shows the last run, whether today is still open, and that 1:00 AM closes the day once the calendar has moved on.',
      'The date control (All Dates, Today, Specific Date, Date Range) only changes which posted totals you are reading. It does not close a day.',
      'Posted totals are three figures: Charges (room, other, and tax), Payments (cash, card, and mobile money), and On account (charged and not yet paid).',
      'While the hotel date is still today, the button on the right says Still open and does nothing. When the hotel date is behind the calendar, press Catch up. That closes only the missed days and stops on today.',
      'At 1:00 AM the same close runs by itself, once the calendar has moved on. History of past runs is under Reports & Analysis.',
    ],
    notHere: 'Wake-up calls are set on the in-house stay from Desk, not on this screen.',
  },
  {
    id: 'hk',
    title: 'Housekeeping',
    description: 'See the floor, assign cleaning, and request supplies.',
    keywords: ['cleaning', 'rooms', 'housekeeper', 'dirty', 'floor', 'linen'],
    category: 'housekeeping',
    section: 'housekeeping',
    image: '/help-images/housekeeping.png',
    imageAlt: 'Housekeeping desk',
    steps: [
      'Open Housekeeping & Maintenance.',
      'Floor is the room board: occupied, dirty, clean, and out of order.',
      'Work is the task list for the attendants on shift.',
      'Supplies is stock, a physical stock count, and requisitions back to Inventory.',
      'Staff is who is working. Reports is the period summary.',
    ],
  },
  {
    id: 'hk-clean',
    title: 'Update a room after cleaning',
    description: 'Mark a room clean so the front desk can sell or assign it.',
    keywords: ['clean room', 'dirty', 'inspected', 'room status', 'attendant'],
    category: 'housekeeping',
    image: '/help-images/hk-clean.png',
    imageAlt: "Housekeeping Work: cleaning tasks and maintenance jobs.",
    section: 'housekeeping',
    steps: [
      'Open Housekeeping → Floor and find the dirty room, or open Work and take the task.',
      'Finish the clean, then set the room to clean.',
      'Front Office reads the same room status, so a room left dirty will not show as ready to sell.',
    ],
    notHere: 'Room numbers and types are created in Settings → Rooms & Pricing, not on this board.',
  },
  {
    id: 'fb',
    title: 'Restaurant and bar',
    description: 'Tables, orders, the menu, and cashiering for food and drink.',
    keywords: ['restaurant', 'bar', 'menu', 'pos', 'food', 'table', 'order'],
    category: 'restaurant',
    section: 'food-beverage',
    image: '/help-images/restaurant.png',
    imageAlt: 'Restaurant and Bar desk',
    steps: [
      'Open Restaurant & Bar.',
      'Open POS Terminal in the side menu, or press Open POS on the desk, to take an order at the counter.',
      'Tables is the floor. Reservations are booked covers. Menu is what you sell.',
      'Transactions and Cashiering settle the check. Supplies requests stock from Inventory.',
    ],
    notHere: 'Recipes and the kitchen ticket screen are under Kitchen, not here.',
  },
  {
    id: 'fb-order',
    title: 'Send a food order',
    description: 'Take the order in the POS and send it to the kitchen.',
    keywords: ['pos', 'send order', 'ctrl enter', 'payment', 'cover'],
    category: 'restaurant',
    image: '/help-images/fb-order.png',
    imageAlt: "The POS: menu on the left, the order on the right, Send to kitchen and payment.",
    section: 'food-beverage',
    steps: [
      'Open Restaurant & Bar → POS Terminal, or press Open POS on the desk.',
      'Pick the table or takeaway, add menu items, and send the order. Ctrl+Enter sends the order.',
      'Ctrl+P opens payment when the guest is ready to pay.',
      'The kitchen sees the ticket on Kitchen → Kitchen Display.',
    ],
  },
  {
    id: 'fb-transactions',
    title: 'Restaurant transactions',
    description: 'Every ticket: waiting on the kitchen, waiting on the bar, unpaid, billed, or voided.',
    keywords: ['kot', 'bot', 'transaction', 'unpaid', 'billed', 'voided', 'ticket'],
    category: 'restaurant',
    section: 'food-beverage',
    fbTab: 'activity',
    steps: [
      'Open Restaurant & Bar → Transactions.',
      'Filter All activity, Pending KOT (kitchen ticket), Pending BOT (bar ticket), Unpaid, Billed, or Voided.',
      'Narrow by staff, or by today, one date, or a date range. Open a row for the ticket.',
    ],
  },
  {
    id: 'kitchen',
    title: 'Kitchen display',
    description: 'Live tickets from the restaurant, plus Ready now and the operations log.',
    keywords: ['kitchen', 'kds', 'ticket', 'recipe', 'station', 'prep', 'ready now'],
    category: 'kitchen',
    section: 'kitchen',
    kitchenTab: 'kds',
    image: '/help-images/kitchen.png',
    imageAlt: 'Kitchen Display with tickets in New, Cooking, and Ready.',
    steps: [
      'Open Kitchen → Kitchen Display. The board groups tickets as New, Cooking, Ready, and Done.',
      'Move a ticket as it is cooked. Display and Sync keep the board with the restaurant.',
      'Ready now is dishes that can be served at once. Kitchen Operations Log is the history of those moves.',
      'Recipes and Kitchen Stations are the setup. Supplies is the kitchen stock request.',
    ],
  },
  {
    id: 'kitchen-ready',
    title: 'Ready now',
    description: 'Dishes the kitchen can serve immediately. Drinks stay on the bar, not on this board.',
    keywords: ['ready now', 'ready board', 'starred', 'dish', 'portion'],
    category: 'kitchen',
    section: 'kitchen',
    kitchenTab: 'ready',
    image: '/help-images/kitchen-ready.png',
    imageAlt: 'Ready now: tap a dish to mark it ready. Drinks are not on this board.',
    steps: [
      'Open Kitchen → Ready now, or the Ready now tab on the kitchen desk.',
      'Tap a dish to mark it ready for immediate service. Drinks are not on this board.',
      'Starred keeps a dish easy to find. Clear board takes the ready list down.',
    ],
  },
  {
    id: 'kitchen-log',
    title: 'Kitchen operations log',
    description: 'What happened on the kitchen display: assigned, status change, and prepared.',
    keywords: ['operations log', 'kitchen log', 'prepared', 'status change'],
    category: 'kitchen',
    section: 'kitchen',
    kitchenTab: 'log',
    steps: [
      'Open Kitchen → the Kitchen Operations Log tab.',
      'Filter by action (Assigned, Status change, Prepared) and by priority.',
      'Click a row for the full detail.',
    ],
  },
  {
    id: 'evt',
    title: 'Events and conferences',
    description: 'Bookings, the four ways to look at them, halls, and the event invoice.',
    keywords: ['conference', 'banquet', 'event', 'meeting', 'beo', 'function', 'venue', 'calendar', 'gantt'],
    category: 'events',
    section: 'events-conferences-standalone',
    eventsTab: 'confirmed',
    image: '/help-images/events.png',
    imageAlt: 'Events and Conferences desk',
    steps: [
      'Open Events & Conferences → Events. Event Management is the bookings. Venues is the halls. Rates are guest prices. Staff is the crew.',
      'On Event Master, switch Table, Calendar, Gantt, or Function. New event starts a booking.',
      'Invoices and Receipts sit beside Event Master. Record Receipt searches the unpaid invoice.',
    ],
    notHere: 'Nightly room prices are under Settings → Rooms & Pricing → Rate Plans.',
  },
  {
    id: 'evt-create',
    title: 'Create an event',
    description: 'The booking window: client, schedule, rates, and whether guests also stay.',
    keywords: ['new event', 'create event', 'residential', 'client', 'banquet'],
    category: 'events',
    section: 'events-conferences-standalone',
    eventsTab: 'confirmed',
    steps: [
      'Open Events & Conferences → Events and press New event.',
      'Phase 1 is the event details and the client: event name, organization, contact name, phone, and email.',
      'Turn on Residential Events when the party also takes rooms. Continue through the schedule and the rates.',
    ],
  },
  {
    id: 'evt-views',
    title: 'Table, calendar, Gantt, and the function sheet',
    description: 'Four ways to read the same bookings, including the sheet other desks work from.',
    keywords: ['calendar', 'gantt', 'function sheet', 'beo', 'table', 'venue', 'pax'],
    category: 'events',
    section: 'events-conferences-standalone',
    eventsTab: 'confirmed',
    steps: [
      'On Event Master, the switch at the right is Table, Calendar, Gantt, and Function.',
      'Table is the list. Calendar is the month, and can switch to week or day. Today jumps back to the current date.',
      'Gantt is one row per hall across the month, with daily guest totals along the bottom. Choose All venues or one hall.',
      'Function is the provisional function schedule: department duties from the banquet event order. Print Schedule, Download CSV, or Send to Departments so restaurant, housekeeping, and reservations can post their work.',
    ],
  },
  {
    id: 'evt-receipt',
    title: 'Record an event receipt',
    description: 'Take money against one unpaid event invoice, without opening the whole invoice book.',
    keywords: ['event receipt', 'deposit', 'unpaid invoice', 'record receipt'],
    category: 'events',
    section: 'events-conferences-standalone',
    eventsTab: 'confirmed',
    steps: [
      'Open the event, then Record Receipt.',
      'Search the unpaid invoice. The window says not to browse the full invoice book.',
      'Enter the amount and save. The balance on that invoice comes down.',
    ],
  },
  {
    id: 'evt-venue',
    title: 'Venue management',
    description: 'The halls and spaces an event can be booked into.',
    keywords: ['venue', 'hall', 'boardroom', 'banquet room', 'new venue'],
    category: 'events',
    section: 'events-conferences-standalone',
    eventsTab: 'venues',
    steps: [
      'Open Events & Conferences → Venues. The heading is Venue Management.',
      'Press New Venue. Name the hall and its capacity, then save.',
      'The Gantt and the event booking both offer the venues on this list.',
    ],
  },
  {
    id: 'inv',
    title: 'Inventory and stores',
    description: 'From a department request through the purchase order, the goods receipt, and the shelf count.',
    keywords: ['stock', 'stores', 'purchase', 'warehouse', 'reorder', 'supplier', 'po', 'requisition', 'grn'],
    category: 'inventory',
    section: 'inventory',
    inventoryOpsTab: 'inventory',
    image: '/help-images/inventory.png',
    imageAlt: 'Inventory and Stores desk',
    steps: [
      'Open Inventory & Stores → Stock, then Stock & Supply.',
      'The tabs follow the work: Items, Suppliers, Requisitions, Purchase Orders, Transfers, Issues, Invoices, and Stock Count.',
      'Purchase Orders has two parts: Orders, and Goods Receipt for what arrives.',
      'Housekeeping, Kitchen, and Restaurant request stock from their own Supplies tabs. Those requests land on Requisitions.',
    ],
    notHere: 'The names of stock locations are Settings → Stock Locations. Supplier bills in the books are Accounting → Accounts Payable.',
  },
  {
    id: 'inv-requisition',
    title: 'Requisitions',
    description: 'A department asks the store for stock. An approved request becomes a purchase order.',
    keywords: ['requisition', 'request stock', 'approve requisition', 'convert'],
    category: 'inventory',
    section: 'inventory',
    inventoryOpsTab: 'requisitions',
    steps: [
      'Open Inventory & Stores → Stock → Stock & Supply → Requisitions.',
      'Press Create Requisition. Name who is asking, the department, and the items.',
      'Approve it, then convert it to a purchase order when the store must buy.',
    ],
  },
  {
    id: 'inv-po',
    title: 'Purchase orders and goods receipts',
    description: 'Order from a supplier, then record what actually arrives.',
    keywords: ['purchase order', 'po', 'goods receipt', 'grn', 'receive'],
    category: 'inventory',
    section: 'inventory',
    inventoryOpsTab: 'purchase-orders',
    steps: [
      'Open Purchase Orders and press Create PO. Pick the supplier and the lines.',
      'When the delivery arrives, open Goods Receipt on that same screen.',
      'Choose the confirmed or in-transit order, enter Receive Now for each line, and press Receive & Create GRN.',
    ],
    notHere: 'The supplier bill is the Invoices tab. Paying it is Accounting → Accounts Payable.',
  },
  {
    id: 'inv-suppliers',
    title: 'Suppliers',
    description: 'The vendors purchase orders and supplier invoices are raised against.',
    keywords: ['supplier', 'vendor', 'add supplier'],
    category: 'inventory',
    section: 'inventory',
    inventoryOpsTab: 'suppliers',
    steps: [
      'Open Inventory & Stores → Stock → Suppliers.',
      'Press Add Supplier. Name, contact, and address.',
      'Create PO offers this list. Add the supplier before the first order.',
    ],
  },
  {
    id: 'inv-transfer',
    title: 'Stock transfers',
    description: 'Move quantity from one location to another without leaving the hotel.',
    keywords: ['transfer', 'move stock', 'location', 'store'],
    category: 'inventory',
    section: 'inventory',
    inventoryOpsTab: 'transfers',
    steps: [
      'Open Inventory & Stores → Stock → Transfers.',
      'Press New Transfer. Pick the from location, the to location, and the items.',
      'The locations are the names in Settings → Stock Locations.',
    ],
  },
  {
    id: 'inv-issue',
    title: 'Goods issues',
    description: 'Send stock out of the store to a department or a person.',
    keywords: ['goods issue', 'issue stock', 'department issue'],
    category: 'inventory',
    section: 'inventory',
    inventoryOpsTab: 'goods-issue',
    steps: [
      'Open Inventory & Stores → Stock → Issues.',
      'Press New Issue. Choose the department or person and the items leaving the store.',
      'A transfer between two stores is Transfers, not an issue.',
    ],
  },
  {
    id: 'inv-invoices',
    title: 'Supplier invoices',
    description: 'The bill from a supplier for goods the store received.',
    keywords: ['supplier invoice', 'vendor bill', 'create invoice', 'stores invoice'],
    category: 'inventory',
    section: 'inventory',
    inventoryOpsTab: 'supplier-invoices',
    steps: [
      'Open Inventory & Stores → Stock → Invoices.',
      'Press Create Invoice and tie it to the supplier and the goods received.',
    ],
    notHere: 'Guest invoices are Front Office. Paying the supplier from the bank book is Accounting → Accounts Payable.',
  },
  {
    id: 'inv-count',
    title: 'Stock count',
    description: 'Count what is on the shelf at one location and update the book quantity.',
    keywords: ['stock count', 'physical count', 'reorder', 'shelf'],
    category: 'inventory',
    section: 'inventory',
    inventoryOpsTab: 'stock-operations',
    steps: [
      'Open Inventory & Stores → Stock → Stock Count.',
      'Press New Count, pick the location, and enter the quantity you can see.',
      'Save. The book quantity for that location becomes the count.',
    ],
  },
  {
    id: 'sec',
    title: 'Patrols, visitors, and shifts',
    description: 'The security desk: the patrol round, who is visiting, and who is on duty. Incidents are the next topic.',
    keywords: ['safety', 'patrol', 'visitor', 'shift', 'checkpoint', 'security desk'],
    category: 'security',
    section: 'security',
    image: '/help-images/security.png',
    imageAlt: 'Security Operations desk',
    steps: [
      'Open Security Operations in the side menu. It sits after Inventory and before HR.',
      'Watch is the patrol. Press Start Patrol, then check each checkpoint as you pass it, or mark it missed.',
      'Visitors is sign-in and sign-out. Staff is who checked in for duty.',
    ],
    notHere: 'Password rules are System Settings → Security, at the end of the side menu.',
  },
  {
    id: 'sec-incidents',
    title: 'Incident management',
    description: 'Write down a theft, an alarm, a medical call, or anything else that must stay on file.',
    keywords: ['incident', 'report incident', 'alarm', 'theft', 'security'],
    category: 'security',
    section: 'security',
    securityTab: 'incidents',
    steps: [
      'Open Security Operations → Incidents. The heading is Security Incident Management.',
      'Press Report Incident. Enter the type, severity, and location.',
      'Assign it to an officer. Resolve it when the matter is finished. The row stays on the list.',
    ],
  },

  // —— Finance ——
  {
    id: 'acc',
    title: 'Accounting',
    description: 'Receivables, payables, the bank, assets, the chart of accounts, and the statements.',
    keywords: ['finance', 'ledger', 'payable', 'receivable', 'reports', 'journal', 'books', 'statements', 'assets'],
    category: 'accounting',
    section: 'accounting-management',
    image: '/help-images/accounting.png',
    imageAlt: 'Accounting and Finance desk',
    steps: [
      'Open Accounting & Finance. The desk tabs are Receivable, Payable, Bank & Cash, PPE & Assets, Taxes, Journal, Statements, Reports, Activity log, Books, and Cost & Income.',
      'Receivable is guest and company invoices. Payable is supplier bills. Journal is an entry you type.',
      'Books is the chart of accounts. Statements are the income statement, balance sheet, and the other reports.',
    ],
    notHere: 'VAT, NHIL, and levy percentages are edited in Compliance. Accounting uses the rates saved there.',
  },
  {
    id: 'acc-books',
    title: 'Chart of accounts',
    description: 'The list of accounts that bank, invoices, and journals post to.',
    keywords: ['chart of accounts', 'books', 'gl', 'account code', 'ledger'],
    category: 'accounting',
    section: 'accounting-management',
    accountingTab: 'accounts',
    steps: [
      'Open Accounting & Finance and choose the Books tab. The heading is Chart of Accounts.',
      'Search by name or code. Main accounts, all accounts, and how many have a balance sit above the list.',
      'The side-menu item named Books opens the Journal. The chart is this Books tab on the desk.',
    ],
    notHere: 'Typing a balanced entry is the Journal tab. This list is the accounts that entry can use.',
  },
  {
    id: 'acc-bank',
    title: 'Bank and cash',
    description: 'The bank book: accounts, money in, money out, and transfers between cash, bank, and MoMo.',
    keywords: ['bank', 'cash', 'momo', 'mobile money', 'transfer', 'contra', 'reconciliation', 'deposit', 'bank charge'],
    category: 'accounting',
    section: 'accounting-management',
    accountingTab: 'banking',
    steps: [
      'Open Accounting & Finance → Cash, or the Bank & Cash tab on the desk.',
      'Pick the bank, cash, or MoMo account, then record the movement against it.',
      'To move money between them, record a transaction and set the type to Transfer between accounts. Choose the account the money leaves and the account it arrives in. They must be two different accounts, in the same currency.',
      'That posts one entry: debit the account that receives the money, credit the account that gives it up. The cashbook shows money out and money in, linked, for the same amount and reference. Nothing is income or an expense.',
      'A MoMo or bank fee is a separate transaction, type Bank charge. It is not part of the transfer.',
    ],
    notHere: 'A guest payment at the desk is Front Office cashiering. It reaches this book when it is posted.',
  },
  {
    id: 'acc-assets',
    title: 'PPE and assets',
    description: 'Property and equipment: cost, depreciation, and the group it sits in on the books.',
    keywords: ['ppe', 'asset', 'depreciation', 'fixed asset', 'equipment'],
    category: 'accounting',
    section: 'accounting-management',
    accountingTab: 'assets',
    steps: [
      'Open Accounting & Finance and choose PPE & Assets.',
      'Add the asset with its cost and the books group. Depreciation follows the method on that group.',
    ],
    notHere: 'Stock on the shelf is Inventory & Stores, not an asset register.',
  },
  {
    id: 'acc-statements',
    title: 'Financial statements',
    description: 'Overview, income statement, balance sheet, changes in equity, cash flow, and the trial balance.',
    keywords: ['statements', 'income statement', 'profit', 'balance sheet', 'cash flow', 'trial balance', 'equity', 'financial year'],
    category: 'accounting',
    section: 'accounting-management',
    accountingTab: 'statements',
    steps: [
      'Open Accounting & Finance → Statements.',
      'The inner tabs are Overview, Income Statement, Balance Sheet, Changes in equity, Cash Flow, and Trial Balance.',
      'On Changes in equity, the year button reads Open · ends and the year-end date while that year is still open. Press it when you are ready to close the year. After the close it reads Closed.',
    ],
    notHere: 'Guest-bill tax rates are Compliance. These statements use the postings already in the books.',
  },
  {
    id: 'hr',
    title: 'Human resources',
    description: 'Staff records, leave, departments, and the monthly pay run with its payslips.',
    keywords: ['staff', 'payroll', 'employee', 'leave', 'attendance', 'ssnit', 'paye', 'department', 'payslip'],
    category: 'hr',
    section: 'hr',
    image: '/help-images/hr.png',
    imageAlt: 'HR and Payroll desk',
    steps: [
      'Open HR & Payroll. People is the staff file. Leave is requests. Time is attendance.',
      'Departments holds departments and positions.',
      'Payroll is the month: Staff Payroll, Payment Advice, Payslips, and History.',
    ],
    notHere: 'PAYE bands and SSNIT rates are in Compliance → Payroll tax. This screen applies them to staff.',
  },
  {
    id: 'hr-leave',
    title: 'Leave',
    description: 'Ask for leave, then approve or reject it.',
    keywords: ['leave', 'request leave', 'absence', 'holiday'],
    category: 'hr',
    section: 'hr',
    hrTab: 'leave',
    steps: [
      'Open HR & Payroll → Leave.',
      'Press Request Leave and fill the dates and the type.',
      'Open the request to approve or reject it. Print form or PDF if the file needs a copy.',
    ],
  },
  {
    id: 'hr-departments',
    title: 'Departments and positions',
    description: 'The hotel’s departments and the jobs inside them.',
    keywords: ['department', 'position', 'job title', 'org'],
    category: 'hr',
    section: 'hr',
    hrTab: 'departments',
    steps: [
      'Open HR & Payroll → the Departments tab.',
      'A new hotel already has one department per desk and the usual jobs in each. Edit or delete any that do not fit, or add your own.',
      'Payroll and leave use these names when they group staff.',
    ],
  },
  {
    id: 'hr-payroll',
    title: 'Run payroll',
    description: 'Prepare the month, check the figures, then send it for approval.',
    keywords: ['payroll run', 'salary', 'net pay', 'approve payroll', 'payslip'],
    category: 'hr',
    image: '/help-images/hr-payroll.png',
    imageAlt: "HR Payroll: run the month, check each line, then approve.",
    section: 'hr',
    hrTab: 'payroll',
    steps: [
      'Open HR & Payroll → Payroll. Stay on Staff Payroll for the month.',
      'Open the current period. Draft or processing means it is not finished.',
      'Review each employee\'s gross, deductions, and net pay before approval.',
      'Payment Advice is how the net pay goes out. Payslips is the print. History is a closed month.',
    ],
    notHere: 'Changing the PAYE bands, or the SSNIT, Tier 2, and Tier 3 names, is Compliance → Payroll tax, not this payroll run.',
  },
  {
    id: 'hr-payslips',
    title: 'Payslips',
    description: 'Print one payslip or the whole month, using the payslip design from Settings.',
    keywords: ['payslip', 'pay slip', 'print payroll', 'salary slip'],
    category: 'hr',
    section: 'hr',
    hrTab: 'payroll',
    steps: [
      'Open HR & Payroll → Payroll → Payslips.',
      'Pick the month. Print one row, or Print all payslips.',
      'The layout is Settings → Document Templates → Payslip. A month that has not been prepared yet has nothing to print.',
    ],
  },

  // —— General ——
  {
    id: 'messenger',
    title: 'Department messenger',
    description: 'Open the department chat / notices panel from anywhere (Ctrl+M).',
    keywords: ['chat', 'message', 'messenger', 'ctrl m', 'announcements'],
    category: 'dashboard',
  },
  {
    id: 'help-keys',
    title: 'Keyboard shortcuts',
    description: 'Keys that save time on every desk. The most useful: Ctrl + L signs you out at once.',
    keywords: ['keyboard', 'shortcut', 'f12', 'f1', 'escape', 'sign out', 'log out', 'logout', 'help'],
    category: 'reference',
    steps: [
      'Ctrl + L: sign out at once. Use it when you hand the till or the desk to someone else. It does nothing while the cursor is in a text box, so a slip cannot lose what you were typing.',
      'Ctrl + Shift + L: sign out from anywhere, even while typing.',
      'Ctrl + Shift + H: open this Help page from any desk.',
      'F1 or F12: open Ask Mamani on the current desk (this Help page when the desk has no assistant).',
      'Ctrl + M: open the department messenger.',
      'Esc: close the open window. From this Help page it returns to the dashboard.',
      'On the POS: Ctrl + Enter sends the order, Ctrl + P opens payment.',
    ],
  },
  // —— Fixing mistakes: void, delete, edit ——
  {
    id: 'void-customer-invoice',
    title: 'Void or delete a customer invoice',
    description:
      'Void keeps the invoice on file marked Void and posts a reversing entry, so the books stay correct. Delete removes it for good and is only for drafts, proformas, and invoices typed in by hand.',
    keywords: ['void invoice', 'cancel invoice', 'delete invoice', 'wrong invoice', 'reverse invoice', 'receivable', 'customer invoice'],
    category: 'accounting',
    image: '/help-images/accounting.png',
    imageAlt: "Accounting, Receivable: who owes the hotel, invoices and receipts.",
    section: 'accounting-management',
    steps: [
      'Accounting → Accounts Receivable → Invoices, then open the invoice.',
      'If money was received on it, void those receipts first (Receipts tab → open the receipt → Void).',
      'Press Void on the invoice and confirm. It stays listed as Void.',
      'Use Delete only for a draft, a proforma, or a manual invoice you never need to see again.',
    ],
    notHere:
      'Needs the "void transactions" permission on your role. A guest folio charge is voided on the folio in Front Office, not here.',
  },
  {
    id: 'void-customer-receipt',
    title: 'Void a customer receipt (payment received)',
    description:
      'Voiding a receipt reverses the money in the books and reopens the balance on its invoice. A receipt taken on a guest folio is also taken off the folio.',
    keywords: ['void receipt', 'cancel payment', 'wrong payment', 'reverse receipt', 'refund', 'receivable'],
    category: 'accounting',
    section: 'accounting-management',
    steps: [
      'Accounting → Accounts Receivable → Receipts, then open the receipt.',
      'Press Void and confirm.',
      'The invoice shows the amount as owed again.',
    ],
    notHere: 'Only receipts typed in by hand or taken on an in-house folio can be voided here.',
  },
  {
    id: 'void-supplier-bill',
    title: 'Void a supplier bill or a payment to a supplier',
    description:
      'Voiding a bill or a supplier payment posts a reversing entry. A voided payment puts the amount back on the bill as owed.',
    keywords: ['void bill', 'cancel bill', 'wrong bill', 'supplier payment', 'void payment', 'payable', 'supplier'],
    category: 'accounting',
    image: '/help-images/acc-payable.png',
    imageAlt: "Accounting, Payable: supplier bills and payments.",
    section: 'accounting-management',
    steps: [
      'Accounting → Accounts Payable → Bills, then open the bill.',
      'Void any payments made on it first (open the payment → Void).',
      'Press Void on the bill and confirm.',
    ],
  },
  {
    id: 'void-journal-entry',
    title: 'Void a journal entry',
    description:
      'A posted journal entry is not deleted. Voiding it posts the opposite entry so the two cancel out, and both stay on record.',
    keywords: ['void journal', 'reverse journal', 'wrong journal', 'cancel entry', 'journal entry', 'ledger'],
    category: 'accounting',
    image: '/help-images/acc-journal.png',
    imageAlt: "Accounting, Journal: entries posted to the books.",
    section: 'accounting-management',
    steps: [
      'Accounting → Journal, then open the entry.',
      'Press Void, then Confirm void.',
      'A draft entry that was never posted can simply be deleted.',
    ],
    notHere:
      'Entries posted from another screen (invoices, receipts, POS, payroll) are voided on that screen. The Journal tells you which one.',
  },
  {
    id: 'void-folio-charge',
    title: 'Void a charge on a guest folio',
    description: 'Removes a wrong charge from a guest bill by posting a reversing entry. It cannot be undone.',
    keywords: ['void charge', 'folio', 'guest bill', 'wrong charge', 'remove charge', 'cancel charge', 'guest'],
    category: 'frontdesk',
    section: 'frontdesk',
    steps: [
      'Front Office → Invoices & Payments, then choose the guest folio.',
      'Find the charge and press Void on its line.',
      'Confirm. The folio total updates straight away.',
    ],
    notHere: 'Customer invoices for companies are voided in Accounting → Accounts Receivable.',
  },
  {
    id: 'pos-cancel-order',
    title: 'Cancel an item or delete an order on the POS',
    description:
      'Cancel one item that was ordered by mistake, or delete a whole order. Deleting an order needs a manager PIN.',
    keywords: ['delete order', 'cancel order', 'cancel item', 'void order', 'wrong order', 'pos', 'restaurant', 'bar'],
    category: 'restaurant',
    section: 'food-beverage',
    steps: [
      'On the POS, open the Orders tab (next to Current order).',
      'Pick Open or Paid today, then tap the item on the order.',
      'Press Cancel item, or Delete order and enter the manager PIN.',
    ],
  },
  {
    id: 'help-maintain',
    title: 'Updating this Help page (for admins & developers)',
    description: 'How to add topics and keep configuration guidance accurate when the product changes.',
    keywords: ['documentation', 'help content', 'maintain', 'developer', 'helpTopics'],
    category: 'reference',
    steps: helpMaintainerGuide.steps,
  },
];

/**
 * Help and the printable manual follow the side menu: the first desk, then Front Office
 * part by part, then each later desk, and System Settings last.
 * topicIds is the reading order inside that desk. Keyboard shortcuts and the maintainer
 * note stay out of this list (they have their own blocks on the page).
 */
export const helpModules: {
  id: Exclude<HelpTopicCategory, 'reference'>;
  title: string;
  intro: string;
  topicIds: string[];
}[] = [
  {
    id: 'dashboard',
    title: 'Executive Management',
    intro:
      'How people open AGM Sync, then the hotel-wide picture. Every desk after this uses the same layout, Ask Mamani, and notices.',
    topicIds: ['reach-premises', 'reach-cloud', 'reach-icon', 'start-desks', 'exec', 'start-mamani', 'start-notices', 'messenger'],
  },
  {
    id: 'frontdesk',
    title: 'Front Office Operations',
    intro:
      'The second desk. Open Desk, Rooms, Billing, Clients, Night, and Reports from the side menu. The topics below follow that path: the counter, a wake-up, a room move, the folio, checkout, and night audit.',
    topicIds: ['front', 'front-checkin', 'front-wakeup', 'front-transfer', 'void-folio-charge', 'front-checkout', 'front-audit'],
  },
  {
    id: 'events',
    title: 'Events & Conferences',
    intro: 'Bookings, four ways to read them, receipts, and the halls. This desk is next after Front Office.',
    topicIds: ['evt', 'evt-create', 'evt-views', 'evt-receipt', 'evt-venue'],
  },
  {
    id: 'restaurant',
    title: 'Restaurant & Bar',
    intro: 'Tables, the menu, the POS, the transaction list, and cashiering. POS Terminal in the side menu is where an order starts.',
    topicIds: ['fb', 'fb-order', 'fb-transactions', 'pos-cancel-order'],
  },
  {
    id: 'kitchen',
    title: 'Kitchen',
    intro: 'Live tickets, dishes ready to serve now, and the log of what the display did.',
    topicIds: ['kitchen', 'kitchen-ready', 'kitchen-log'],
  },
  {
    id: 'housekeeping',
    title: 'Housekeeping & Maintenance',
    intro: 'The floor board, cleaning tasks, and supply requests. A room left dirty here is not ready for Front Office to sell.',
    topicIds: ['hk', 'hk-clean'],
  },
  {
    id: 'inventory',
    title: 'Inventory & Stores',
    intro: 'Requisitions, purchase orders and goods receipts, suppliers, transfers, issues, supplier invoices, then the shelf count.',
    topicIds: ['inv', 'inv-requisition', 'inv-po', 'inv-suppliers', 'inv-transfer', 'inv-issue', 'inv-invoices', 'inv-count'],
  },
  {
    id: 'security',
    title: 'Security Operations',
    intro: 'One desk, after Inventory and before HR. Patrols and visitors first, then how to write up an incident. Passwords are under System Settings, not here.',
    topicIds: ['sec', 'sec-incidents'],
  },
  {
    id: 'hr',
    title: 'HR & Payroll',
    intro: 'Staff records, leave, departments and positions, the monthly pay run, and payslips.',
    topicIds: ['hr', 'hr-leave', 'hr-departments', 'hr-payroll', 'hr-payslips'],
  },
  {
    id: 'accounting',
    title: 'Accounting & Finance',
    intro: 'The chart of accounts, bank and cash, assets, the statements, and how to void a wrong posting.',
    topicIds: ['acc', 'acc-books', 'acc-bank', 'acc-assets', 'acc-statements', 'void-customer-invoice', 'void-customer-receipt', 'void-supplier-bill', 'void-journal-entry'],
  },
  {
    id: 'compliance',
    title: 'Compliance & Reports',
    intro: 'Guest-bill taxes, supplier withholding, staff PAYE, and filing dates. The other desks calculate from the rates saved here.',
    topicIds: ['compliance', 'tax-rules', 'paye', 'compliance-reports'],
  },
  {
    id: 'settings',
    title: 'System Settings',
    intro:
      'The last item in the side menu. Users, rooms, document numbers and templates, stock locations, passwords, approval amounts, and the audit log. Tax percentages stay in Compliance & Reports.',
    topicIds: ['config-map', 'setup', 'settings', 'users', 'rooms-pricing', 'numbering', 'settings-templates', 'settings-locations', 'security-settings', 'settings-approvals', 'settings-audit'],
  },
];

export const helpCategoryLabels: Record<HelpTopicCategory, string> = {
  ...Object.fromEntries(helpModules.map((mod) => [mod.id, mod.title])),
  reference: 'Reference',
} as Record<HelpTopicCategory, string>;

/** Topics in side-menu order. A search result keeps this order and drops empty desks. */
export function groupHelpTopics(topics: HelpTopic[]) {
  const byId = new Map(topics.map((topic) => [topic.id, topic]));
  return helpModules
    .map((mod) => ({
      ...mod,
      topics: mod.topicIds.map((id) => byId.get(id)).filter((topic): topic is HelpTopic => Boolean(topic)),
    }))
    .filter((mod) => mod.topics.length > 0);
}
