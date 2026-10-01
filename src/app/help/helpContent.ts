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
    'To deep-link into Settings, set section: "settings" and settingsTab to users | rooms | numbering | locations | security.',
    'To deep-link into Compliance, set section: "compliance" and complianceTab to tax | payroll | reports.',
    'For standalone pages (e.g. setup wizard), set href: "/setup" instead of section.',
    'Optional: add steps[] for the procedure, image for a screenshot in public/help-images, and notHere to warn users away from the wrong module.',
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
    steps: [
      'The title row names the desk. Show summary / Hide summary sits beside it.',
      'On a phone, tablet, or short window the summary hides on its own so the tabs stay on screen. Show summary brings the counts back. The choice is remembered for that desk.',
      'Summary means the count cards, today\'s operations, and quick actions. Recent activity and notices stay visible.',
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
    image: '/help-images/compliance.png',
    imageAlt: 'Compliance and Reports',
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
      'Switch to Hospitality reference for CIT, VAT, PAYE bands, WHT, SSNIT, and the tourism levy.',
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
    notHere: 'Conference package prices are maintained under Settings → Rooms & Pricing → Event & Conference Rates.',
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
    description: 'F1 or F12 opens Ask Mamani on the current desk. This Help page opens when that desk has no assistant. Esc returns to the dashboard from this page.',
    keywords: ['keyboard', 'shortcut', 'f12', 'f1', 'escape'],
    category: 'general',
  },
  // —— Fixing mistakes: void, delete, edit ——
  {
    id: 'void-customer-invoice',
    title: 'Void or delete a customer invoice',
    description:
      'Void keeps the invoice on file marked Void and posts a reversing entry, so the books stay correct. Delete removes it for good and is only for drafts, proformas, and invoices typed in by hand.',
    keywords: ['void invoice', 'cancel invoice', 'delete invoice', 'wrong invoice', 'reverse invoice', 'receivable', 'customer invoice'],
    category: 'finance',
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
