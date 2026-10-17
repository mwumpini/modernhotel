/** Contact details and copy for the agmsync.com website, in one place. */

export const CONTACT = {
  email: 'info@agmsync.com',
  /** WhatsApp only (no calls). Digits with country code, for wa.me links. */
  whatsappDigits: '4915255641215',
  whatsappDisplay: '+49 1525 5641215',
};

export const whatsappLink = (text = 'Hello AGM Sync, I would like a demo for my business.') =>
  `https://wa.me/${CONTACT.whatsappDigits}?text=${encodeURIComponent(text)}`;

/** Where "Sign in" goes: the app's own address once it has one, else this site's app. */
export const SIGN_IN_URL = process.env.NEXT_PUBLIC_APP_URL || '/';

/** The kinds of business AGM Sync is set up for. Also the choices on the demo form. */
export const FACILITIES = [
  { icon: '🔑', title: 'Hotels', text: 'From boutique hotels to large properties with several outlets.' },
  { icon: '🏡', title: 'Guest houses & B&Bs', text: 'Simple bookings, bills and housekeeping for a small team.' },
  { icon: '🛖', title: 'Lodges & motels', text: 'Quick check-ins, room status and a bar or kitchen on the side.' },
  { icon: '🌴', title: 'Resorts', text: 'Rooms, restaurants, pools, events and activities on one guest bill.' },
  { icon: '🏢', title: 'Serviced apartments', text: 'Long stays, monthly billing and company accounts.' },
  { icon: '🛏️', title: 'Hostels', text: 'Beds and rooms, deposits and fast turnover.' },
  { icon: '🍽️', title: 'Restaurants, bars & lounges', text: 'POS, kitchen display, recipes and stock, with or without rooms.' },
  { icon: '🎤', title: 'Event & conference centres', text: 'Halls, bookings, catering, quotations and contracts.' },
];

/** The side menu, in order. These are the modules. */
export const MODULES = [
  { icon: '🏛️', title: 'Executive Management', text: 'The whole business on one screen: who is in house, what is arriving, and what needs a decision.' },
  { icon: '🛎️', title: 'Front Office Operations', text: 'Reservations, check-in and checkout, rooms, billing, clients and the night audit.' },
  { icon: '🎤', title: 'Events & Conferences', text: 'Halls, bookings, catering, quotations, invoices and contracts.' },
  { icon: '🍽️', title: 'Restaurant & Bar', text: 'Touch ordering, bills, the menu, room charges and the till.' },
  { icon: '👨‍🍳', title: 'Kitchen', text: 'The kitchen display, recipes, and ingredients taken from stock as dishes sell.' },
  { icon: '🛏️', title: 'Housekeeping & Maintenance', text: 'Room status, cleaning tasks, inspections and repairs.' },
  { icon: '📦', title: 'Inventory & Stores', text: 'Purchase orders, goods received, issues, transfers, stock counts and low-stock alerts.' },
  { icon: '🚨', title: 'Security Operations', text: 'Patrols, incidents and visitor logs.' },
  { icon: '👥', title: 'HR & Payroll', text: 'Staff, leave, time, and payroll with PAYE and SSNIT worked out for you.' },
  { icon: '🧾', title: 'Accounting & Finance', text: 'What customers owe, what you owe suppliers, cash and bank, the books and the statements.' },
  { icon: '⚖️', title: 'Compliance & Reports', text: 'Ghana’s taxes and the returns: VAT, levies, withholding, PAYE and SSNIT.' },
  { icon: '⚙️', title: 'System Settings', text: 'Users, rooms and prices, documents, stock locations, and how the business is set up.' },
];

/** What a business can shape, and the features that come with every module. */
export const CUSTOMISE_POINTS = [
  { title: 'Ask Mamani', text: 'The assistant on a module. Ask how to do something, or ask for today’s numbers. It can draft a notice. You still send it. It does not change a booking, a bill, or the books.' },
  { title: 'More than one currency', text: 'The books stay in cedis. Add a currency, such as US dollars, take a payment in it, and the books record the cedi value. Switch back to cedis when you are done.' },
  { title: 'At the hotel and at home', text: 'Work on the cloud, on a computer in the building, or on both at once. A change at home shows at the front desk, and a change at the desk shows at home.' },
  { title: 'Only the modules you need', text: 'A restaurant can run POS, kitchen and stores without a front desk. Switch modules on as you grow.' },
  { title: 'Your logo, your documents', text: 'Bills, quotations, receipts and registration cards carry your logo and details, laid out the way you like. The same document can be printed or emailed to the guest or client.' },
  { title: 'Your numbering and dates', text: 'Invoice and receipt numbers, date formats, your accounting year and check-in times, set once and used everywhere.' },
  { title: 'Your taxes and charges', text: 'Choose which taxes apply to rooms, food, drinks, events and services.' },
  { title: 'Your people, your rules', text: 'Roles and permissions per desk, approvals for discounts and voids, and an audit trail of who did what.' },
  { title: 'Light or dark', text: 'Each person picks the look they work best in, and arranges their own dashboard.' },
];

/** How a business can run it. Cloud and premises together is the one to lead with. */
export const SETUP_OPTIONS = [
  {
    tag: 'Cloud and premises',
    title: 'The hotel and home, one set of records',
    featured: true,
    points: [
      'A server or PC in the hotel and the cloud keep the same records',
      'Someone at home makes a change and the front desk sees it',
      'Someone at the desk makes a change and home sees it',
      'If the internet drops, the hotel keeps working, and the missed changes catch up when it returns',
      'If both sides change the same record before they connect, the later change remains',
    ],
  },
  {
    tag: 'Cloud',
    title: 'Sign in from anywhere',
    featured: false,
    points: [
      'Nothing to install',
      'Open https://app.agmsync.com on a PC, tablet or phone',
      'Updates and backups handled for you',
      'Each desk needs the internet',
    ],
  },
  {
    tag: 'On the premises',
    title: 'The hotel computer is the system',
    featured: false,
    points: [
      'One computer in the building stays on and keeps the records',
      'Phones, tablets and other computers on the hotel Wi-Fi open that computer',
      'The internet can be down',
      'Those records stay on that computer',
    ],
  },
];

export const GHANA_POINTS = [
  { title: 'Ghana taxes, done right', text: 'NHIL and GETFund, VAT and the Tourism Levy are worked out on every bill and printed in the order guests expect.' },
  { title: 'Bills your guests know', text: 'Check-out bills, quotations, receipts and registration cards in a familiar layout, with your logo. Email the same document, or print it. 80 mm till slips for the restaurant.' },
  { title: 'Cedis, other currencies, and Mobile Money', text: 'The books stay in cedis. Take cash, card, Mobile Money, or a payment in another currency such as dollars, and balance each till at the end of a shift.' },
  { title: 'Runs when the light stays on', text: 'Use the cloud, the computer in the hotel, or both. On the premises the hotel keeps working when the internet is down. Phones and tablets on the Wi-Fi open the same system.' },
  { title: 'Your data stays yours', text: 'Each business’s data is kept apart from every other’s, behind staff sign-in with roles and permissions.' },
  { title: 'Preparing for GRA E-VAT', text: 'Built on itemised, numbered documents, the foundation for electronic VAT invoicing as GRA brings businesses on board.' },
];

export const STEPS = [
  { title: 'See it with your own business', text: 'A short video call or visit. We show the system using your rooms, your menu and the way you work.' },
  { title: 'We set you up', text: 'Modules, rooms, rates, menu, stock, staff and your documents are configured for you, ready for day one.' },
  { title: 'Your staff learn it', text: 'Hands-on training for each desk, and a step-by-step guide for every role.' },
  { title: 'Go live, with us beside you', text: 'We stay close in the first weeks and answer on WhatsApp when your team has a question.' },
];

export const FAQS = [
  { q: 'Do I need to install anything?', a: 'Only if you want a computer in the hotel to keep the records. Cloud only is a sign-in at https://app.agmsync.com, with nothing to install. On the premises, one computer runs the system and the other devices open it on the Wi-Fi. Cloud and premises uses that computer and the website together, so home and the hotel share the same records.' },
  { q: 'We are not a hotel. Will it fit us?', a: 'Yes. Guest houses, lodges, resorts, apartments, hostels, restaurants, bars and event centres all use it. We switch on only the modules you need and set it up around how you work.' },
  { q: 'What happens if the internet goes off?', a: 'On the cloud, each desk needs the internet. On the premises, the hotel computer keeps the records and the other devices on the Wi-Fi keep working. With cloud and premises, the hotel keeps working while the internet is down, and the changes catch up with home when the connection returns.' },
  { q: 'Does it handle Ghana’s taxes?', a: 'Yes. NHIL, GETFund, VAT and the Tourism Levy are calculated on room, restaurant, event and service charges, printed on guest documents, and posted to the right accounts for your returns.' },
  { q: 'Can we take US dollars as well as cedis?', a: 'Yes. The books stay in Ghana cedis. You add a currency, such as US dollars, and how many cedis one unit is worth. While that currency is on, a receipt is entered in it and the books record the cedi value. Switch back to cedis when you want.' },
  { q: 'Is there an assistant?', a: 'Yes. Ask Mamani sits on each desk. Press F1 and ask how to do something, or ask for today’s numbers. It can draft a notice for you to send. It does not change bookings, bills, or the books on its own.' },
  { q: 'Can it print to my receipt printer?', a: 'Yes. A4 printers for invoices and bills, and standard 80 mm thermal printers for restaurant and bar slips and kitchen tickets.' },
  { q: 'Can we email a bill instead of only printing it?', a: 'Yes. The registration card, invoice, receipt, quotation, statement and event paperwork can be emailed as a PDF. The guest or client needs an email address on file, and the person sending confirms before it goes out.' },
  { q: 'How much does it cost?', a: 'Pricing depends on the size of your business, the modules you use and how you run it. Book a demo and we will send a clear quote. Our first partners get hands-on setup and launch pricing.' },
  { q: 'Can someone at home and someone at the desk work at the same time?', a: 'Yes, with cloud and premises. Home opens https://app.agmsync.com. The desk opens the hotel computer, on the premises address or on the cloud. They see the same records. A booking made at home shows at the desk, and a check-in at the desk shows at home.' },
  { q: 'Can we bring in our existing guests and rooms?', a: 'Yes. During setup we enter your rooms, rates, menu and staff, and bring over your guest list so your team starts with what they know.' },
];
