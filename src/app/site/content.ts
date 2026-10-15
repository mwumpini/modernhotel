/** Contact details and copy for the agmsync.com website, in one place. */

export const CONTACT = {
  email: 'info@agmsync.com',
  /** WhatsApp only (no calls). Digits with country code, for wa.me links. */
  whatsappDigits: '4915255641215',
  whatsappDisplay: '+49 1525 5641215',
};

export const whatsappLink = (text = 'Hello AGM Sync, I would like a demo for my hotel.') =>
  `https://wa.me/${CONTACT.whatsappDigits}?text=${encodeURIComponent(text)}`;

/** Where "Sign in" goes: the app's own address once it has one, else this site's app. */
export const SIGN_IN_URL = process.env.NEXT_PUBLIC_APP_URL || '/';

export const MODULES = [
  { icon: '🏨', title: 'Front desk', text: 'Reservations, check-in and checkout, room moves, folios, deposits, company billing and the night audit.' },
  { icon: '🍽️', title: 'Restaurant & bar POS', text: 'Fast touch ordering, kitchen and bar tickets, split bills, room charges and receipts with the right taxes.' },
  { icon: '👨‍🍳', title: 'Kitchen', text: 'A live kitchen display, recipes, and ingredients taken from stock as dishes are sold.' },
  { icon: '🛏️', title: 'Housekeeping', text: 'Room status at a glance, cleaning tasks, inspections and maintenance requests.' },
  { icon: '📦', title: 'Stores & inventory', text: 'Purchase orders, goods received, requisitions, transfers, stock counts and low-stock alerts.' },
  { icon: '👥', title: 'HR & payroll', text: 'Staff records, shifts, leave, and payroll with PAYE and SSNIT worked out for you.' },
  { icon: '🧾', title: 'Accounting', text: 'Sales post to the books on their own: receivables, payables, bank reconciliation and financial statements.' },
  { icon: '🎪', title: 'Events & conferences', text: 'Halls, bookings, catering, quotations, invoices and contracts for every event.' },
  { icon: '🚨', title: 'Security', text: 'Shifts, patrols, incidents and visitor logs in the same system as the rest of the hotel.' },
  { icon: '📊', title: 'Reports & assistant', text: 'Daily flash reports, occupancy and revenue, plus Ask Mamani: ask a question, get the number.' },
];

export const GHANA_POINTS = [
  { title: 'Ghana taxes, done right', text: 'NHIL and GETFund, VAT and the Tourism Levy are worked out on every bill and printed in the order guests expect.' },
  { title: 'Bills your guests know', text: 'Check-out bills, quotations, receipts and registration cards in a familiar layout, with your logo. 80 mm till slips for the restaurant.' },
  { title: 'Cedis and Mobile Money', text: 'Every amount in cedis. Take cash, card, Mobile Money or charge to the room, and balance each till at the end of a shift.' },
  { title: 'Runs on what you have', text: 'Works in the browser on desktops, laptops and tablets, including older Windows 8 computers. Nothing to install.' },
  { title: 'Your data stays yours', text: 'Each hotel’s data is kept apart from every other hotel’s, behind staff sign-in with roles and permissions.' },
  { title: 'Preparing for GRA E-VAT', text: 'Built on itemised, numbered documents, the foundation for electronic VAT invoicing as GRA brings hotels on board.' },
];

export const STEPS = [
  { title: 'See it with your own hotel', text: 'A short video call or visit. We show the system using your room types and your menu.' },
  { title: 'We set you up', text: 'Rooms, rates, menu, stock, staff and your documents are entered for you, ready for day one.' },
  { title: 'Your staff learn it', text: 'Hands-on training for each desk, and a step-by-step guide for every role.' },
  { title: 'Go live, with us beside you', text: 'We stay close in the first weeks and answer on WhatsApp when your team has a question.' },
];

export const FAQS = [
  { q: 'Do I need to install anything?', a: 'No. AGM Sync runs in the web browser on any computer or tablet. Staff sign in with their own account, and each desk sees only what that person is allowed to use.' },
  { q: 'What happens if the internet goes off?', a: 'AGM Sync is online software, so each desk needs internet. Many hotels keep a backup Mobile data bundle or a second provider. Tell us how your connection is and we will advise on a setup.' },
  { q: 'Does it handle Ghana’s taxes?', a: 'Yes. NHIL, GETFund, VAT and the Tourism Levy are calculated on room, restaurant, event and service charges, printed on guest documents, and posted to the right accounts for your returns.' },
  { q: 'Can it print to my receipt printer?', a: 'Yes. A4 printers for invoices and bills, and standard 80 mm thermal printers for restaurant and bar slips and kitchen tickets.' },
  { q: 'How much does it cost?', a: 'Pricing depends on the size of your hotel and the modules you use. Book a demo and we will send a clear quote. Our first partner hotels get hands-on setup and launch pricing.' },
  { q: 'Can we bring in our existing guests and rooms?', a: 'Yes. During setup we enter your rooms, rates, menu and staff, and bring over your guest list so your team starts with what they know.' },
];
