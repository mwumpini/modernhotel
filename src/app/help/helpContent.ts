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

export type HelpTopicCategory =
  | 'start'
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
  /** Screenshot under public/help-images, served as /help-images/... */
  image?: string;
  imageAlt?: string;
  /** Boundary note — what this screen does *not* control */
  notHere?: string;
  section?: HelpNavSection;
  href?: string;
  settingsTab?: 'users' | 'rooms' | 'numbering' | 'security';
  complianceTab?: 'tax' | 'payroll' | 'reports';
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
    'Add or edit an entry in the helpTopics array (id, title, description, keywords, category).',
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
    id: 'start-desks',
    title: 'How a desk is laid out',
    description: 'Every department screen has a title, a summary you can hide, and tabs for the work.',
    keywords: ['summary', 'tabs', 'show summary', 'hide summary', 'tablet', 'layout', 'desk'],
    category: 'start',
    image: '/help-images/desk-summary.png',
    imageAlt: "The Front Office desk with the summary shown: count cards at the top, Hide summary and Customize at the top right.",
    steps: [
      'The title row names the desk. Show summary / Hide summary sits at the top right, next to Customize and Expand.',
      'The summary (the count cards, today\'s operations, and quick actions) is hidden when a desk opens, so the work tabs come first. Press Show summary to bring it up, and Hide summary to put it away. Each desk remembers your choice.',
      'Customize picks which summary cards a desk shows. Recent activity and notices stay visible either way.',
      'Wide tables scroll inside their own box. The page itself does not scroll sideways.',
    ],
  },
  {
    id: 'start-mamani',
    title: 'Ask Mamani',
    description: 'The desk assistant drafts notices and answers how-to questions from this Help.',
    keywords: ['mamani', 'ask', 'ai', 'f12', 'f1', 'assistant', 'how to'],
    category: 'start',
    steps: [
      'On a desk, press F1 or F12, or open Messenger (Ctrl+M) and choose Ask Mamani.',
      'Use a suggested prompt, or type a question such as "How do I change VAT?"',
      'A how-to answer includes Open in app, which jumps to that screen.',
      'A drafted notice can be copied into Messenger. You still press Send. Mamani does not post it.',
      'On Settings, Compliance, and other screens without the assistant, F1 and F12 open this Help page. Full Help inside Ask Mamani does the same.',
    ],
  },
  {
    id: 'start-notices',
    title: 'Notices and the messenger',
    description: 'Send a department notice, or a private message, without leaving the desk.',
    keywords: ['notice', 'messenger', 'ctrl m', 'urgent', 'department', 'chat'],
    category: 'start',
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
    image: '/help-images/settings.png',
    imageAlt: 'System Settings',
  },
  {
    id: 'users',
    title: 'Users & roles',
    description: 'Create staff accounts, assign roles, and manage personal preferences.',
    keywords: ['users', 'roles', 'admin', 'preferences', 'password'],
    category: 'configuration',
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
    category: 'configuration',
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
    category: 'configuration',
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
    title: 'Security & passwords',
    description: 'Two-factor auth, session timeout, and password policy for all staff.',
    keywords: ['2fa', 'password', 'session', 'security', 'lockout'],
    category: 'configuration',
    image: '/help-images/security-settings.png',
    imageAlt: "Settings, Security: password, session, PIN rules and the manager PIN.",
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
    category: 'configuration',
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
      'On a supplier bill in Accounting, choose Standard purchase stack for the VAT, NHIL, and GETFund you can claim. Turn on Withhold tax and pick goods, services, works, or rent.',
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
    keywords: ['paye', 'payroll', 'ssnit', 'income tax', 'staff tax', 'bands', 'setup'],
    category: 'configuration',
    image: '/help-images/paye.png',
    imageAlt: "Compliance, Payroll tax: PAYE bands and the SSNIT tiers used by payroll.",
    section: 'compliance',
    complianceTab: 'payroll',
    steps: [
      'Open Compliance & Reports, then Payroll tax.',
      'The Ghana bands are already loaded. PAYE is worked out in bands on the month’s pay. SSNIT is the staff 5.5% plus the employer share.',
      'Change a band only when the law changes. Then run a test pay before you post a real payroll.',
    ],
    notHere: 'Guest-bill VAT and supplier withholding are on Tax rules. Company income tax is on Reports & Filing.',
  },
  {
    id: 'compliance-reports',
    title: 'Filing dates and company income tax',
    description: 'When each return is due, and where the hotel’s company income tax sits.',
    keywords: ['vat return', 'filing', 'ssnit', 'paye', 'wht', 'gsl', 'cit', 'income tax', 'company tax', 'reports', 'due date', 'setup'],
    category: 'configuration',
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
    category: 'operations',
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
    description: 'Arrivals, in-house guests, room status, folios, and the night audit.',
    keywords: ['front desk', 'reception', 'guest', 'rooms', 'check in', 'checkout', 'folio'],
    category: 'operations',
    section: 'frontdesk',
    image: '/help-images/front-office.png',
    imageAlt: 'Front Office desk with room status and tabs',
    steps: [
      'Open Front Office Operations. Desk, Rooms, Billing, Clients, Night, and Reports in the side menu open that part of the desk.',
      'Rooms shows which rooms are occupied, vacant, or need housekeeping.',
      'Reservations is the list of stays. Desk is the counter for the guest in front of you.',
      'Invoices & Payments holds the folio. Cashiering takes the money. Night Audit closes the business date.',
    ],
    notHere: 'Nightly room prices are set in Settings → Rooms & Pricing. Tax percentages are in Compliance.',
  },
  {
    id: 'front-checkin',
    title: 'Check in a guest',
    description: 'Move an arriving reservation to in-house and assign a room.',
    keywords: ['check-in', 'check in', 'arrival', 'assign room', 'walk in'],
    category: 'operations',
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
    id: 'front-checkout',
    title: 'Check out and take payment',
    description: 'Settle the folio and release the room to housekeeping.',
    keywords: ['checkout', 'check out', 'payment', 'folio', 'cashier', 'invoice'],
    category: 'operations',
    image: '/help-images/front-checkout.png',
    imageAlt: "An in-house stay: charges, payments, Open the folio and Check out.",
    section: 'frontdesk',
    steps: [
      'Open the stay from Desk or Reservations.',
      'Open Invoices & Payments and review room, tax, and extra charges.',
      'Open Cashiering and take the payment.',
      'Complete checkout. The room leaves occupied and housekeeping can pick it up as dirty.',
    ],
    notHere: 'Company tax rates are not edited here. A wrong VAT amount is fixed under Compliance → Tax rules.',
  },
  {
    id: 'front-transfer',
    title: 'Move a guest to another room',
    description: 'Room transfer keeps the same stay and folio.',
    keywords: ['room transfer', 'move room', 'change room'],
    category: 'operations',
    image: '/help-images/front-transfer.png',
    imageAlt: "Room Transfer: pick the guest, the new room and the reason.",
    section: 'frontdesk',
    steps: [
      'Open Front Office → Room Transfer. Rooms in the side menu opens the room board.',
      'Select the in-house stay and the new vacant room.',
      'Confirm. The old room is released for housekeeping and the guest stays on the same folio.',
    ],
  },
  {
    id: 'front-audit',
    title: 'Close the business day (night audit)',
    description: 'Post the day\'s room charges and roll the business date. The hotel can also run this automatically at 1:00 AM.',
    keywords: ['night audit', 'close day', 'business date', 'end of day', 'catch up'],
    category: 'operations',
    image: '/help-images/front-audit.png',
    imageAlt: "Night Audit: the business date, the checks, and Close.",
    section: 'frontdesk',
    steps: [
      'Open Front Office → Night Audit. Night in the side menu opens the same screen.',
      'Read the in-house count and the business date on the card.',
      'Press Close and the date shown. If the audit is behind, the button says Catch up instead.',
      'History of past runs is under Reports & Analysis.',
    ],
  },
  {
    id: 'hk',
    title: 'Housekeeping',
    description: 'See the floor, assign cleaning, and request supplies.',
    keywords: ['cleaning', 'rooms', 'housekeeper', 'dirty', 'floor', 'linen'],
    category: 'operations',
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
    category: 'operations',
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
    category: 'operations',
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
    category: 'operations',
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
    id: 'kitchen',
    title: 'Kitchen display',
    description: 'Tickets coming from the restaurant, the operations log, stations, and recipes.',
    keywords: ['kitchen', 'kds', 'ticket', 'recipe', 'station', 'prep'],
    category: 'operations',
    section: 'kitchen',
    image: '/help-images/kitchen.png',
    imageAlt: 'Kitchen desk',
    steps: [
      'Open Kitchen in the side menu.',
      'Kitchen Display is the live ticket screen. Move a ticket as it is cooked and ready.',
      'Kitchen Operations Log is the record of what was prepared.',
      'Recipes and Kitchen Stations are the setup. Supplies is the kitchen stock request.',
    ],
  },
  {
    id: 'evt',
    title: 'Events and conferences',
    description: 'Banquet and conference bookings, setup, catering, and the event invoice.',
    keywords: ['conference', 'banquet', 'event', 'meeting', 'beo', 'function'],
    category: 'operations',
    section: 'events-conferences-standalone',
    image: '/help-images/events.png',
    imageAlt: 'Events and Conferences desk',
    steps: [
      'Open Events & Conferences → Event Management.',
      'Press New event, or open an existing row. The booking has Event, Setup, Catering, Timeline, and Tasks.',
      'Invoices and Receipts sit on the Event Management screen next to Event Master.',
      'Venue Management is the halls. Guest Rates are the prices for event guests. Staff Management is the crew.',
    ],
    notHere: 'Nightly room prices are under Settings → Rooms & Pricing → Rate Plans.',
  },
  {
    id: 'inv',
    title: 'Inventory and stores',
    description: 'Stock on hand, suppliers, purchase orders, and the physical stock count.',
    keywords: ['stock', 'stores', 'purchase', 'warehouse', 'reorder', 'supplier', 'po'],
    category: 'operations',
    section: 'inventory',
    image: '/help-images/inventory.png',
    imageAlt: 'Inventory and Stores desk',
    steps: [
      'Open Inventory & Stores.',
      'Stock & Supply is the item list, including what is at or below reorder.',
      'Quick actions on a full desktop: Add Item, Create PO, Add Supplier, Stock Count, and Reports.',
      'Housekeeping, Kitchen, and Restaurant request stock from their own Supplies tabs. Those requests land here.',
    ],
    notHere: 'The names of stock locations (stores, fridges, floor pantries) are edited in Settings → Stock Locations.',
  },
  {
    id: 'inv-count',
    title: 'Count stock and reorder',
    description: 'Reconcile what is on the shelf, then raise a purchase order for what is short.',
    keywords: ['stock count', 'reorder', 'low stock', 'purchase order', 'physical'],
    category: 'operations',
    image: '/help-images/inv-count.png',
    imageAlt: "Kitchen Supplies: request stock from the store and count what is on hand.",
    section: 'inventory',
    steps: [
      'Open Inventory & Stores and start Stock Count from Quick actions, or the count on Stock & Supply.',
      'Enter the quantity you can see. The book quantity updates to the count.',
      'Items at or below their reorder point show on the summary. Create PO for those items and send it to the supplier on file.',
      'Add Supplier first if the vendor is not in the list yet.',
    ],
  },
  {
    id: 'sec',
    title: 'Security operations',
    description: 'Patrols, incidents, visitors, and who is on duty.',
    keywords: ['safety', 'patrol', 'incident', 'visitor', 'shift', 'checkpoint'],
    category: 'operations',
    section: 'security',
    image: '/help-images/security.png',
    imageAlt: 'Security Operations desk',
    steps: [
      'Open Security Operations.',
      'Patrol Log is the round in progress. Press Start Patrol, then check each checkpoint as you pass it, or mark it missed.',
      'Incident Management is for theft, alarms, medical calls, and anything else that must be written down. Assign it, then resolve it when it is finished.',
      'Visitor Management is sign-in and sign-out. Shift Log is who checked in for duty.',
    ],
  },

  // —— Finance ——
  {
    id: 'acc',
    title: 'Accounting',
    description: 'GL, AP/AR, bank, reports, and audit-related accounting screens.',
    keywords: ['finance', 'ledger', 'payable', 'receivable', 'reports', 'journal'],
    category: 'finance',
    section: 'accounting-management',
    image: '/help-images/accounting.png',
    imageAlt: 'Accounting and Finance desk',
    steps: [
      'Open Accounting & Finance → Accounting Management.',
      'Accounts Receivable is guest and company invoices. Accounts Payable is supplier bills.',
      'Bank & Cash is the bank book. Journal is a manual entry. Statements are the profit and loss and balance sheet.',
      'Books is the chart of accounts. Activity log is who posted what.',
    ],
    notHere: 'VAT, NHIL, and levy percentages are edited in Compliance. Accounting uses the rates saved there.',
  },
  {
    id: 'hr',
    title: 'Human resources',
    description: 'Staff records, leave, time, and payroll. Hotel sales tax is a different screen.',
    keywords: ['staff', 'payroll', 'employee', 'leave', 'attendance', 'ssnit', 'paye'],
    category: 'finance',
    section: 'hr',
    image: '/help-images/hr.png',
    imageAlt: 'HR and Payroll desk',
    steps: [
      'Open HR & Payroll.',
      'Employees is the staff file. Use Add Employee for a new hire.',
      'Leave is requests. Time is attendance. Payroll is the monthly run.',
      'Departments and positions are on the Departments tab.',
    ],
    notHere: 'PAYE bands and SSNIT rates are in Compliance → Payroll tax. This screen applies them to staff.',
  },
  {
    id: 'hr-payroll',
    title: 'Run payroll',
    description: 'Prepare the month, check the figures, then send it for approval.',
    keywords: ['payroll run', 'salary', 'net pay', 'approve payroll', 'payslip'],
    category: 'finance',
    image: '/help-images/hr-payroll.png',
    imageAlt: "HR Payroll: run the month, check each line, then approve.",
    section: 'hr',
    steps: [
      'Open HR & Payroll → Payroll, or press Run Payroll on the summary.',
      'Open the current period. Draft or processing means it is not finished.',
      'Review each employee\'s gross, deductions, and net pay before approval.',
      'Approval is a separate step. Once a period is approved it is no longer a draft you can delete.',
    ],
    notHere: 'Changing the PAYE bands themselves is Compliance → Payroll tax, not this payroll run.',
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
    description: 'Keys that save time on every desk. The most useful: Ctrl + L signs you out at once.',
    keywords: ['keyboard', 'shortcut', 'f12', 'f1', 'escape', 'sign out', 'log out', 'logout', 'help'],
    category: 'general',
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
    category: 'finance',
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
    category: 'finance',
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
    category: 'finance',
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
    category: 'finance',
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
    category: 'operations',
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
    category: 'operations',
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
    category: 'general',
    steps: helpMaintainerGuide.steps,
  },
];

export const helpCategoryLabels: Record<HelpTopicCategory, string> = {
  start: 'Start here',
  configuration: 'Configuration & setup',
  operations: 'Daily operations',
  finance: 'Finance & HR',
  general: 'General',
};
