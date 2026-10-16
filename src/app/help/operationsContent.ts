import type { HelpTopic } from './helpContent';

/**
 * The Operations Manual: what every policy and rule in the system means, in plain words,
 * with worked examples. Shown at /help/operations (open, print, or download to share).
 * Keep it in step with Settings → Operational Policies and the accounting rules: when a
 * rule changes in code, change its words here in the same change.
 *
 * Examples use a ₵500 room night. With VAT 15%, NHIL 2.5%, GETFund 2.5% and Tourism 1%
 * the taxes are ₵105, so the guest pays ₵605 a night.
 */

export const operationsManual = {
  intro:
    'What every rule in Settings → Operational Policies does, and how bookings, payments and fees reach the books. Each rule says what each option means, followed by a worked example. Examples use a ₵500 room night; with VAT, NHIL, GETFund and Tourism Levy (21%) the guest pays ₵605 a night.',
};

const POLICIES = 'Settings → Operational Policies';

export const operationsTopics: HelpTopic[] = [
  // ---------------- Check-in and checkout ----------------
  {
    id: 'ops-times',
    title: 'Standard check-in and checkout times',
    category: 'operations',
    keywords: ['check-in hour', 'checkout hour', 'standard times'],
    description: `${POLICIES} → Check-in and checkout → Standard times. The hours the hotel works to. Other rules count from them.`,
    rules: [
      { name: 'Check-in hour (24h)', meaning: 'When a room is normally ready on the arrival day. Cancellation windows are counted back from this hour on the arrival day.' },
      { name: 'Check-out hour (24h)', meaning: 'When a guest is expected to leave on the departure day. The late checkout fee counts from this hour.' },
    ],
    examples: [
      {
        title: 'how the hours are used',
        lines: [
          'Check-in 14:00, check-out 11:00.',
          'A guest arriving Friday cancels on Thursday at 14:00: that is 24 hours before arrival.',
          'A guest leaving Sunday is late from 11:00 (plus any grace minutes).',
        ],
      },
    ],
  },
  {
    id: 'ops-late-checkout',
    title: 'Late checkout fee',
    category: 'operations',
    keywords: ['late checkout', 'grace minutes', 'fee'],
    description: `${POLICIES} → Check-in and checkout → Late checkout. Charges a guest who leaves after the check-out hour plus the grace minutes. The fee is added to the bill at checkout.`,
    rules: [
      { name: 'Late checkout fee (switch)', meaning: 'Off: no fee, however late. On: the fee below is added when the guest checks out late.' },
      { name: 'Grace minutes', meaning: 'Free time after the check-out hour. A guest leaving within it pays nothing.' },
      { name: 'Fee type: Flat amount (₵)', meaning: 'A fixed amount before tax; taxes are added like on any charge.' },
      { name: 'Fee type: % of nightly rate', meaning: 'A share of one night of this booking, taxes included in the same proportion.' },
      { name: 'Fee value', meaning: 'The amount (flat) or the percentage.' },
    ],
    examples: [
      {
        title: 'check-out 11:00, grace 30 minutes, 50% of the nightly rate',
        lines: [
          'Leaves at 11:20: inside the grace, no fee.',
          'Leaves at 12:10: late. Fee = 50% of ₵605 = ₵302.50 (₵250 + ₵52.50 tax).',
        ],
      },
    ],
  },
  {
    id: 'ops-early-checkout',
    title: 'Early checkout: refund or penalty',
    category: 'operations',
    keywords: ['early checkout', 'refund', 'penalty', 'unused nights', 'prorate', 'cutoff'],
    description: `${POLICIES} → Check-in and checkout → Early checkout. What the guest pays when they leave before the booked departure date. The unused nights are read from the booking itself.`,
    rules: [
      { name: 'Early checkout rule (switch)', meaning: 'Off: the bill is left as it is. On: the rule below is applied at checkout. Without "Advanced", the guest pays only the nights stayed.' },
      { name: 'Cutoff hour (24h)', meaning: 'Decides whether the departure day counts. Leaving before this hour: that day\'s night is unused. Leaving after it: that night is charged.' },
      { name: 'Advanced refund and penalty', meaning: 'Tick to choose one of the three options below. Unticked always means "Pay only the nights stayed".' },
      { name: 'Pay only the nights stayed', meaning: 'Unused nights come off the bill. Nothing extra is charged.' },
      { name: 'No refund: charge the whole booking', meaning: 'The guest pays every booked night. The unused nights are added to the bill at checkout, with their taxes.' },
      { name: 'Nights stayed + % of the unused nights', meaning: 'Unused nights come off, and the penalty % of their value is charged instead.' },
      { name: 'Penalty % (of the unused nights)', meaning: 'Only used by the option above.' },
      { name: 'Note', meaning: 'Your own wording; it is saved in the audit log each time the rule is applied.' },
    ],
    examples: [
      {
        title: 'booked 5 nights Monday to Saturday at ₵500, leaves Wednesday at 08:00 (cutoff 11:00)',
        lines: [
          'Nights stayed: Monday and Tuesday. Unused: Wednesday, Thursday, Friday.',
          'Pay only the nights stayed: 2 nights = ₵1,000 (+ tax).',
          'No refund: 5 nights = ₵2,500 (+ tax).',
          '20% penalty: 2 nights + 20% of 3 nights (₵300) = ₵1,300 (+ tax).',
          'If the guest leaves at 12:30 instead, Wednesday night counts as stayed: 2 unused nights, and the 20% penalty is ₵200.',
        ],
      },
    ],
    notHere: 'The money kept is room revenue on the checkout day. A refund of money already paid is given from the folio (Refund) by staff.',
  },
  {
    id: 'ops-checkout-room',
    title: 'Room after checkout',
    category: 'operations',
    keywords: ['dirty', 'housekeeping', 'vacant', 'checkout', 'sell the room', 'no housekeeping'],
    description: `${POLICIES} → Check-in and checkout → After checkout. Whether the room needs housekeeping before it can be sold again.`,
    rules: [
      { name: 'Mark the room dirty (switch)', meaning: 'On, the usual: checkout marks the room dirty and opens a turnover task. A dirty room is not offered for sale until housekeeping cleans it. Off: the room becomes vacant and can be sold at once. No turnover task is opened. Turn it off when the facility has no housekeeping.' },
      { name: 'Void and room move', meaning: 'The same switch. A voided stay, and the room a guest leaves when they are moved, become vacant instead of dirty while the switch is off.' },
    ],
    examples: [
      {
        title: 'a guesthouse with no housekeeping',
        lines: [
          'Turn Mark the room dirty off.',
          'The guest checks out of room 4. Room 4 is vacant and can take the next arrival.',
        ],
      },
    ],
  },
  {
    id: 'ops-room-charges',
    title: 'Night audit, first night at check-in, and rounding',
    category: 'operations',
    keywords: ['night audit', 'first night', 'rounding', 'amount due'],
    description: `${POLICIES} → Night audit and billing. When room nights are charged, and how bills are rounded.`,
    rules: [
      { name: 'Post the first night at check-in', meaning: 'On: the first night appears on the bill as soon as the guest checks in. The night audit will not charge that night again. Off: every night, including the first, is charged by the night audit.' },
      { name: 'Run night audit at 1:00am', meaning: 'Closes the business day automatically while the app is open: posts the room night for every guest in house, marks bookings that did not arrive as no-shows (and applies the no-show rule), then moves the hotel date on. A failure notifies the Night Manager.' },
      { name: 'Line and tax rounding', meaning: 'How each line and each tax is rounded to the pesewa: nearest, always up, or always down.' },
      { name: 'Round the amount due to', meaning: 'Rounds what the guest is asked to pay (for example to the nearest ₵0.50 for cash). The difference goes to account 4900 Rounding Adjustment, so the books still balance.' },
    ],
    examples: [
      {
        title: 'rounding the amount due to ₵0.50',
        lines: ['Bill total ₵1,210.30 → guest pays ₵1,210.50.', 'The ₵0.20 difference is posted to 4900 Rounding Adjustment.'],
      },
    ],
  },

  // ---------------- Bookings, deposits and cancellations ----------------
  {
    id: 'ops-deposit',
    title: 'Deposits',
    category: 'operations',
    keywords: ['deposit', 'advance payment', 'confirm booking', 'guarantee'],
    description: `${POLICIES} → Booking changes → Deposit. How much is asked for to hold a booking, and where the money sits until the guest arrives.`,
    rules: [
      { name: 'Require a deposit (switch)', meaning: 'On: the booking asks for the deposit below.' },
      { name: 'Deposit type: % of reservation', meaning: 'A share of the whole stay, taxes included.' },
      { name: 'Deposit type: Flat amount', meaning: 'The same amount for every booking.' },
      { name: 'Deposit value', meaning: 'The percentage or the amount.' },
      { name: 'Require deposit to confirm', meaning: 'On: a pending booking only becomes confirmed once the full deposit is paid.' },
    ],
    examples: [
      {
        title: '30% deposit on a 2-night stay',
        lines: [
          'Stay: 2 × ₵605 = ₵1,210. Deposit: 30% = ₵363.',
          'The ₵363 is held in 2450 Guest Deposits (money the hotel owes until the guest arrives). It is not revenue yet.',
          'At check-in it is applied to the guest\'s bill.',
        ],
      },
    ],
  },
  {
    id: 'ops-no-show',
    title: 'No-show fee',
    category: 'operations',
    keywords: ['no-show', 'did not arrive', 'fee', 'first night', 'keep deposit'],
    description: `${POLICIES} → Booking changes → No-show. What a guest who never arrives is charged. Applied once, when the booking is marked no-show (by staff, or by the night audit).`,
    rules: [
      { name: 'No-show charge (switch)', meaning: 'Off: no fee. The whole deposit becomes a refund due.' },
      { name: 'First night', meaning: 'The fee is the first night of the booking, with its taxes.' },
      { name: '% of reservation', meaning: 'The fee is this share of the whole stay.' },
      { name: 'Flat amount', meaning: 'A fixed fee before tax (taxes added if "Taxes on these fees" is on).' },
      { name: 'Keep the whole deposit', meaning: 'Whatever was paid is kept as the fee, nothing more is billed.' },
      { name: 'Cutoff hour (24h)', meaning: 'From this hour on the arrival day, staff can mark the guest as a no-show. The night audit marks any remaining ones when it closes the day.' },
    ],
    examples: [
      {
        title: 'first night, guest paid a ₵200 deposit',
        lines: [
          'Fee: ₵605 (first night with tax).',
          '₵200 is taken from the deposit; ₵405 is billed to the guest (or charged to the guarantee card).',
          'If "Fee bigger than the deposit" is set to "Only keep the deposit", only the ₵200 is kept and nothing is billed.',
        ],
      },
    ],
  },
  {
    id: 'ops-cancellation',
    title: 'Cancellation fee',
    category: 'operations',
    keywords: ['cancellation', 'late cancellation', 'free window', 'fee'],
    description: `${POLICIES} → Booking changes → Cancellation. Cancelling is free until a number of hours before arrival; after that the late fee applies. Applied once, when the booking is cancelled.`,
    rules: [
      { name: 'Cancellation fee (switch)', meaning: 'Off: cancelling is always free. The whole deposit becomes a refund due.' },
      { name: 'Free window (hours before arrival)', meaning: 'Cancelling at least this many hours before the check-in hour on the arrival day is free.' },
      { name: 'Late fee type', meaning: 'First night, % of reservation, Flat amount, or Keep the whole deposit (same meanings as the no-show fee).' },
      { name: 'Late fee value', meaning: 'The percentage or the amount, when the type uses one.' },
    ],
    examples: [
      {
        title: 'free up to 48 hours, then the first night; deposit ₵800; arrival Friday 14:00',
        lines: [
          'Cancelled Tuesday 10:00 (76 hours before): free. ₵800 refund due.',
          'Cancelled Thursday 18:00 (20 hours before): fee ₵605 from the deposit. ₵195 refund due.',
        ],
      },
    ],
  },
  {
    id: 'ops-fees-deposits',
    title: 'Fees and deposits: taxes, refunds due, and fees bigger than the deposit',
    category: 'operations',
    keywords: ['refund due', 'deposit', 'tax on fees', 'bill the rest', 'guarantee card'],
    description: `${POLICIES} → Booking changes → Fees and deposits. Rules that apply to both the no-show and the cancellation fee.`,
    rules: [
      { name: 'Deposit first', meaning: 'A fee is always taken from the guest\'s deposit first.' },
      { name: 'Refund due', meaning: 'Whatever is left of the deposit after the fee is owed back to the guest. It stays in 2450 Guest Deposits and shows on the booking\'s folio. Nothing is refunded automatically: staff pay it back from the folio (Refund), and the books follow.' },
      { name: 'Taxes on these fees', meaning: 'Charged: VAT, NHIL, GETFund and Tourism Levy are included in the fee (on the first-night and % types they are part of the amount; on a flat amount they are added). Not charged: the whole fee is revenue, no tax.' },
      { name: 'Fee bigger than the deposit: Bill the rest', meaning: 'The part of the fee the deposit does not cover is billed to the guest (receivables). For a no-show with a guaranteed card, it is charged to the card.' },
      { name: 'Fee bigger than the deposit: Only keep the deposit', meaning: 'The hotel never asks for more than was paid.' },
      { name: 'Where the fee goes', meaning: 'Account 4150 Cancellation & No-show Fees, with each tax in its own payable account.' },
    ],
    examples: [
      {
        title: 'late cancellation, fixed fee ₵300 with taxes, deposit ₵500',
        lines: [
          'Fee: ₵300 + ₵63 tax = ₵363, taken from the deposit.',
          'Refund due: ₵137 (still in Guest Deposits).',
          'When staff refund the ₵137, Guest Deposits goes to ₵0.',
        ],
      },
    ],
  },

  // ---------------- Company accounts and money owed ----------------
  {
    id: 'ops-company',
    title: 'Company accounts: pay later, credit terms, references',
    category: 'operations',
    keywords: ['pay later', 'corporate', 'credit terms', 'company account', 'city ledger'],
    description: `${POLICIES} → Company accounts. Who may leave without paying, and the terms on the invoice.`,
    rules: [
      { name: 'Who can pay later', meaning: 'Corporate and individual, corporate only, or individual only. Anyone else must settle the bill at checkout.' },
      { name: 'Default credit terms', meaning: 'Days to pay written on a company invoice, unless the company\'s own terms say otherwise (for example "Net 45").' },
      { name: 'Corporate reference', meaning: 'Required: a company pay-later stay needs a purchase order, project or cost-centre reference before checkout.' },
      { name: '"Corporate Account" as a payment', meaning: 'Means the company takes over the bill: no money is received. The amount moves to receivables (1210) with the checkout invoice and is collected later.' },
    ],
    examples: [
      {
        title: 'company with "Net 45", default terms 30 days',
        lines: ['Checkout 1 October: invoice due 15 November (the company\'s 45 days win over the default 30).'],
      },
    ],
  },
  {
    id: 'ops-doubtful-debts',
    title: 'Doubtful debts (allowance, write-off, recovery)',
    category: 'operations',
    keywords: ['bad debt', 'doubtful debts', 'allowance', 'write off', 'IFRS 9', 'recovery'],
    description: `Percentages: ${POLICIES} → Doubtful debts. Posting: Accounting → Accounts Receivable → Doubtful debts. Sets aside the share of what customers owe that may not be paid (IFRS 9).`,
    rules: [
      { name: 'Age bands', meaning: 'Each open invoice falls in a band by days past its due date; invoices not yet due count in the first band. The last band covers everything older. Defaults: up to 30 days 1%, 31–60 5%, 61–90 15%, 91–180 40%, older 100%.' },
      { name: 'By customer', meaning: 'The screen lists each customer, what they still owe, and their share of the allowance in each age band. The shares in a band add up to that band\'s allowance.' },
      { name: 'Overdue invoices', meaning: 'Invoices past their due date, with the days overdue, so a write-off starts from a named invoice.' },
      { name: 'Increase / reduce allowance', meaning: 'Posts only the change between what is required and what is already booked: bad-debt expense (5685) against the allowance (1290, shown as a minus under receivables). Do it at month end.' },
      { name: 'Write off', meaning: 'For a debt that will not be paid. It comes out of the allowance first; any part beyond it is an expense. A reason is required.' },
      { name: 'Record recovery', meaning: 'Money received later on a written-off debt. It reduces the bad-debt expense.' },
    ],
    examples: [
      {
        title: 'month end',
        lines: [
          'Owed: ₵10,000 not yet due (1% = ₵100) and ₵4,000 overdue 45 days (5% = ₵200). Required: ₵300.',
          'Booked last month: ₵120. Posting adds ₵180.',
          'Later a ₵400 debt is written off: ₵300 from the allowance, ₵100 expense.',
        ],
      },
    ],
  },

  {
    id: 'ops-currencies',
    title: 'Currencies',
    category: 'operations',
    keywords: ['currency', 'exchange rate', 'USD', 'dollar', 'euro', 'amount in words', 'pesewa', 'cent'],
    description: `${POLICIES} → Currencies. The books stay in Ghana cedis. Add another currency, switch it on while the hotel is taking it, then switch it off to take cedis again.`,
    rules: [
      { name: 'Home currency', meaning: 'GHS. Write the main unit and the small unit yourself (for example Ghana Cedis and Pesewas). Those words are used in the amount in words on cedis documents. This currency cannot be switched off.' },
      { name: 'Code', meaning: 'What you type, such as USD or EUR. There is no list to pick from.' },
      { name: 'Main unit and small unit', meaning: 'The two names amount in words uses for that currency, such as US dollar and cents.' },
      { name: 'Cedis per 1', meaning: 'How many cedis one unit of that currency is worth. Used when a receipt in that currency is posted, so the books stay in cedis. It is not asked for on the receipt.' },
      { name: 'Add a currency', meaning: 'Opens a bank account and a cash account for that currency. Bank receipts use the bank account. Cash receipts use the cash account.' },
      { name: 'Use this', meaning: 'The desk takes that currency. New customer receipts are entered in it and posted to its bank or cash account. Only one extra currency is on at a time.' },
      { name: 'Back to cedis', meaning: 'Switches that currency off. New receipts are in cedis again. Receipts already recorded stay as they were.' },
    ],
    examples: [
      {
        title: 'USD at 15.50 cedis, then back to cedis',
        lines: [
          'Add USD, main unit US dollar, small unit cents, cedis per 1 = 15.50. The system opens USD bank and USD cash.',
          'Press Use this. A guest pays 100 dollars by bank transfer. The receipt is 100 USD. The USD bank rises by 100. The books record ₵1,550.',
          'Press Back to cedis. The next receipt is in cedis, into the cedi bank or cash account.',
        ],
      },
    ],
    notHere: 'The home currency of the books is chosen once in setup. A purchase bill is entered in cedis. Customer receipts follow the currency switched on here.',
  },
  {
    id: 'ops-cash-transfers',
    title: 'Transfers between cash, bank and MoMo',
    category: 'operations',
    keywords: ['transfer', 'contra', 'cash', 'bank', 'momo', 'mobile money', 'bank charge'],
    description: 'Accounting → Bank & Cash. Moving money from one of the hotel\'s own accounts to another. Cash in hand is 1110, Bank is 1120, Mobile Money is 1130. A foreign currency opened under Currencies has its own bank account and its own cash account.',
    rules: [
      { name: 'Transfer between accounts', meaning: 'One transaction, two accounts. The account the money leaves is credited. The account it arrives in is debited. Both sides are cash, bank, or MoMo, so nothing is income or an expense. This is a contra entry.' },
      { name: 'Same currency', meaning: 'The amount leaves one account and arrives in the other unchanged. Use two accounts in the same currency. A dollar account and a cedi account are not a transfer.' },
      { name: 'Cashbook', meaning: 'Two linked lines, money out and money in, with the same amount and reference. The two accounts\' balances move by that amount.' },
      { name: 'Bank charge or MoMo fee', meaning: 'A separate transaction, type Bank charge. It debits Bank charges (5625) and credits the account the fee left. It is not part of the transfer.' },
    ],
    examples: [
      {
        title: '₵2,000 from the cash drawer into the bank',
        lines: [
          'Transfer between accounts: from Cash in hand, to Bank, ₵2,000.',
          'Books: Bank +₵2,000, Cash in hand −₵2,000.',
          'A ₵5 MoMo fee is its own Bank charge: Bank charges +₵5, Mobile Money −₵5.',
        ],
      },
    ],
  },

  // ---------------- Dates and the year ----------------
  {
    id: 'ops-posting-dates',
    title: 'Posting dates (backdating)',
    category: 'operations',
    keywords: ['backdating', 'posting date', 'past date', 'lock'],
    description: `${POLICIES} → Posting dates. Whether payments, charges, journals, stock, payroll and new bookings may use a date before today.`,
    rules: [
      { name: 'Backdating off (default)', meaning: 'Nothing new can be dated before today. Arrivals may still use yesterday until the night audit closes it.' },
      { name: 'Backdating on', meaning: 'Earlier dates are allowed, for example while entering last month\'s records. Turn it off again afterwards.' },
      { name: 'Closed periods', meaning: 'Once a period is closed in Financial Reports, nothing is posted into it; a late item lands on the first open day.' },
    ],
  },
  {
    id: 'ops-year-payments',
    title: 'Accounting year and phone/card payments',
    category: 'operations',
    keywords: ['accounting year', 'financial year', 'Hubtel', 'Paystack', 'mobile money'],
    description: `${POLICIES} → Accounting year, and Phone and card payments.`,
    rules: [
      { name: 'Accounting year: opening day', meaning: 'The day the books open each year. Reports, quarters, year-end close and filing dates follow it.' },
      { name: 'Payments service', meaning: 'Not connected yet. Card and mobile money are recorded by staff; a connected service (Hubtel or Paystack) is planned so the guest approves on their phone.' },
    ],
  },

  // ---------------- How it reaches the books ----------------
  {
    id: 'ops-stay-books',
    title: 'How a stay reaches the books (IFRS 15)',
    category: 'operations',
    keywords: ['IFRS 15', 'revenue', 'guest ledger', 'deposits', 'receivables', 'checkout'],
    description: 'Every room night, meal and payment is posted on the day it happens, not all at checkout. This is what the accountant sees.',
    rules: [
      { name: 'Deposit before arrival', meaning: 'Cash/bank/MoMo up, 2450 Guest Deposits up (owed to the guest).' },
      { name: 'Check-in', meaning: 'The deposit moves from 2450 Guest Deposits to 1215 Guest Ledger, against the stay.' },
      { name: 'Each room night, meal or service', meaning: 'On its own date: 1215 Guest Ledger up; revenue (rooms 4100, restaurant 4210, bar 4220, room service 4230, services 4400) and each tax payable up.' },
      { name: 'Payment during the stay', meaning: 'Cash/bank/MoMo up, 1215 Guest Ledger down.' },
      { name: 'Void, discount, refund, moved charge', meaning: 'Only the difference is posted, so the books always match the bill. Discounts and bill credits go to 4950 Allowances and Discounts.' },
      { name: 'Checkout', meaning: 'Whatever is still owed moves from 1215 Guest Ledger to 1210 Receivables, with the invoice. After that, receipts and credit notes go through Accounts Receivable.' },
      { name: 'Cancellation or no-show', meaning: 'The fee comes from 2450 Guest Deposits to 4150 Cancellation & No-show Fees; any remainder stays as a refund due.' },
    ],
    examples: [
      {
        title: '2 nights, ₵500 deposit, ₵700 card payment at checkout',
        lines: [
          'Before arrival: Mobile Money +₵500, Guest Deposits ₵500.',
          'Check-in: Guest Deposits to ₵0, Guest Ledger −₵500.',
          'Night 1 and night 2: Guest Ledger +₵605 each; Rooms +₵500 each; taxes +₵105 each.',
          'Card ₵700: Bank +₵700, Guest Ledger down to ₵10.',
          'Checkout: the ₵10 still owed moves to Receivables with the invoice.',
        ],
      },
    ],
  },
  {
    id: 'ops-payroll-rules',
    title: 'Payroll rules: SSNIT, Tier 2, PAYE and payslips',
    category: 'operations',
    keywords: ['payroll', 'SSNIT', 'tier 1', 'tier 2', 'PAYE', 'payslip'],
    description: 'HR & Payroll. What decides each deduction, and where the rates come from.',
    rules: [
      { name: 'Staff file choices', meaning: 'Social Security (Tier 1), Tier 2 and Income Tax (PAYE) are Yes/No on each employee. Only an explicit "No" skips a deduction, in both the preview and the monthly run.' },
      { name: 'Rates', meaning: 'Compliance → Payroll tax: PAYE bands, SSNIT (Tier 1) at 5.5% of basic, Tier 2, and Tier 3. A rename keeps (Tier 1), (Tier 2), or (Tier 3) on the name. Payroll only ever uses payroll rules; sales taxes such as VAT never apply to pay.' },
      { name: 'Order of deductions', meaning: 'SSNIT (Tier 1) comes off basic salary before PAYE is worked out.' },
      { name: 'Estimate vs prepared month', meaning: 'Until a month is prepared, Payroll and Employee Records show grey estimates at today\'s rates. Payslips are only printed for prepared months.' },
      { name: 'Payslips', meaning: 'Payroll → Payslips: one, the ticked staff, or the whole month, printed with the payslip design from Settings → Document Templates.' },
    ],
    examples: [
      {
        title: 'basic ₵1,000, allowance ₵300 (2026 bands)',
        lines: ['SSNIT: 5.5% × ₵1,000 = ₵55.', 'PAYE on ₵1,245: ₵97.48.', 'Net pay: ₵1,300 − ₵55 − ₵97.48 = ₵1,147.52.'],
      },
    ],
  },
  // ---------------- Inventory & Stores ----------------
  {
    id: 'ops-grni',
    title: 'Stock bought on a purchase order: goods received, then the bill',
    category: 'operations',
    keywords: ['goods received', 'GRN', 'not invoiced', 'GRNI', 'supplier bill', 'three-way match'],
    description: 'How stock bought from a supplier reaches the books, so the supplier is owed only once.',
    rules: [
      { name: 'Goods received (GRN)', meaning: 'Receiving a delivery adds the stock (food and drink 1310, housekeeping 1320, operating supplies 1330) and records what is owed in 2350 Goods Received, Not Invoiced, because the supplier\'s bill has not been entered yet.' },
      { name: 'Supplier bill in Accounts Payable', meaning: 'Enter the bill with the delivery (GRN) number, or the PO number. It clears the delivery from 2350 and records the amount owed to the supplier (2205), with the VAT as input tax.' },
      { name: 'Bill dearer than the delivery', meaning: 'The difference is added to the stock value.' },
      { name: 'Bill for part of a delivery', meaning: 'The rest stays in 2350 until the next bill for that delivery.' },
      { name: 'Bill with no GRN or PO number', meaning: 'Treated as an ordinary expense bill, as before (for services, utilities, repairs…).' },
      { name: 'Inventory → Invoices', meaning: 'Checks the bill against the order and the goods received (three-way match). It does not post anything itself.' },
      { name: 'What 2350 should show', meaning: 'Deliveries still waiting for their bill. An old amount there is a bill that was never entered.' },
    ],
    examples: [
      {
        title: '₵1,000 of produce received, bill ₵1,000 + ₵200 VAT',
        lines: [
          'Goods received: Food & Beverage stock +₵1,000; Goods Received, Not Invoiced ₵1,000.',
          'Bill entered with GRN-0001: Goods Received, Not Invoiced back to ₵0; input VAT ₵200; owed to the supplier ₵1,200.',
          'The supplier is owed ₵1,200 once, not ₵2,200.',
        ],
      },
    ],
  },

  // ---------------- Rooms and pricing ----------------
  {
    id: 'ops-room-pricing',
    title: 'How a room price is worked out',
    category: 'operations',
    keywords: ['room rate', 'rate plan', 'price type', 'season', 'tax inclusive', 'tax exempt'],
    description: 'Settings → Rooms & Pricing. Every booking gets a price for each night when it is made; that nightly price (and its tax) is what the night audit later charges.',
    rules: [
      { name: 'Room type base rate', meaning: 'Used only when the room type has no rate plan.' },
      { name: 'Rate plan', meaning: 'A price for one room type (for example "Standard", "Corporate", "Bed & Breakfast"). The booking uses the plan picked on it; otherwise the room type\'s default plan; otherwise the first plan for that room type.' },
      { name: 'Price type: before tax (subtotal)', meaning: 'The plan price is the room\'s value; VAT, NHIL, GETFund and Tourism Levy are added on top.' },
      { name: 'Price type: tax included (gross total)', meaning: 'The plan price is what the guest pays; the taxes are worked out backwards from it.' },
      { name: 'Seasons', meaning: 'A date range with a multiplier on the plan price (1.2 = 20% more, 0.8 = 20% less). Only the nights inside the season get it.' },
      { name: 'Price typed at booking', meaning: 'A rate entered by hand on the booking replaces the plan for that stay (no season applied).' },
      { name: 'Tax-exempt booking', meaning: 'For exempt guests (for example diplomatic): no tax is added; the guest pays the room value only.' },
      { name: 'Meal plan', meaning: 'Room only, bed & breakfast, half board or full board. It is shown on reports (guest count and meal plan); it does not change the price by itself.' },
      { name: 'Not used yet', meaning: 'Day-of-week rates and minimum/maximum stay are stored on rate plans but are not applied to prices or bookings yet.' },
    ],
    examples: [
      {
        title: 'Deluxe plan ₵500 before tax, high season 15–31 December at 1.2',
        lines: [
          'Night of 10 December: ₵500 + ₵105 tax = ₵605.',
          'Night of 20 December: ₵600 + ₵126 tax = ₵726.',
          'Same plan set as "tax included" at ₵605: the room value is ₵500 and the taxes ₵105.',
        ],
      },
    ],
  },

  // ---------------- Tills and cash ----------------
  {
    id: 'ops-tills',
    title: 'Tills: opening, closing and the variance',
    category: 'operations',
    keywords: ['till', 'cashier shift', 'float', 'variance', 'over', 'short', 'momo till'],
    description: 'Front Office and Restaurant & Bar each have their own tills (Cashiering). A cashier opens a shift before taking money and closes it at the end with a count. Till types are set in Settings → Tills.',
    rules: [
      { name: 'Cash till', meaning: 'Always there. Holds the cash drawer.' },
      { name: 'MoMo tills', meaning: 'One per mobile-money device. Can be switched on or off.' },
      { name: 'Opening float', meaning: 'The cash in the drawer when the shift opens (change for customers).' },
      { name: 'Expected cash', meaning: 'Float + cash taken during the shift − cash paid out (petty expenses).' },
      { name: 'Close: count and variance', meaning: 'The cashier counts the drawer. Variance = counted − expected: positive is over, negative is short. MoMo is checked the same way against what the device shows.' },
      { name: 'Restaurant sales need an open till', meaning: 'Restaurant and bar cash bills can only be taken while a Restaurant/Bar till is open, so every cedi belongs to a cashier\'s shift. Room charges do not need a till.' },
    ],
    examples: [
      {
        title: 'a front desk shift',
        lines: [
          'Float ₵200. Cash taken ₵1,450. Paid out for printer paper ₵50.',
          'Expected cash: ₵200 + ₵1,450 − ₵50 = ₵1,600.',
          'Counted ₵1,590: short by ₵10, recorded on the shift.',
        ],
      },
    ],
  },
  {
    id: 'ops-petty-cash',
    title: 'Petty expenses from a till, and handing cash over',
    category: 'operations',
    keywords: ['petty cash', 'paid out', 'expense', 'cash handover', 'till drop', 'custody'],
    description: 'Cash can leave a till for small expenses, and the takings are handed on at the end of a shift.',
    rules: [
      { name: 'Petty expense (paid out)', meaning: 'Taken from the cash till (or a MoMo till that allows spending) with a reason and an expense type: transport, printing and stationery, cleaning, vehicle, equipment repairs, generator fuel, or miscellaneous. It goes straight to that expense account and lowers the expected cash.' },
      { name: 'Spending limit per till', meaning: 'Settings → Tills: a till can be allowed or not allowed to pay expenses, with a largest amount for one expense.' },
      { name: 'Till drop to Accounts', meaning: 'The cashier hands the takings to Accounts; Accounts holds that cash until it is banked.' },
      { name: 'Hand on to the next cashier', meaning: 'Cash passed from one cashier to another, recorded so each person\'s custody is clear.' },
    ],
    examples: [
      {
        title: 'fuel for the generator',
        lines: ['₵120 paid out of the cash till: Generator Fuel and Repairs +₵120, Cash in Hand −₵120.', 'Expected cash for the shift drops by ₵120.'],
      },
    ],
  },

  // ---------------- Document numbers ----------------
  {
    id: 'ops-numbering',
    title: 'Document numbers',
    category: 'operations',
    keywords: ['numbering', 'invoice number', 'receipt number', 'prefix', 'format', 'next number'],
    description: 'Settings → Numbering. How every document (bookings, folios, invoices, receipts, orders, stock documents, staff IDs …) is numbered.',
    rules: [
      { name: 'Prefix', meaning: 'Letters in front, for example INV, RCP, PO.' },
      { name: 'Format', meaning: 'Built from {PREFIX}, {NUMBER}, {YEAR} (2026), {YY} (26) and {SUFFIX}, for example {PREFIX}-{YEAR}-{NUMBER} gives INV-2026-1002.' },
      { name: 'Next number', meaning: 'The number the next document gets. For bookings, guest profiles, invoices and folios the system raises it past any number already used, so a reset never repeats one.' },
      { name: 'Years', meaning: 'The count carries on across years; {YEAR} only changes the text. Journal entry numbers (JE-2026-0001) are the exception: they start again each year.' },
    ],
    examples: [
      {
        title: 'invoice numbering',
        lines: ['Prefix INV, format {PREFIX}{YY}{NUMBER}, next number 1: first invoice INV260001, then INV260002.'],
      },
    ],
  },

  // ---------------- Taxes ----------------
  {
    id: 'ops-tax-rules',
    title: 'How a tax rule is built (Tax Rate Builder)',
    category: 'operations',
    keywords: ['tax rule', 'tax rate builder', 'compound', 'additive', 'withhold', 'tiered', 'applies to'],
    description: 'Compliance & Reports → Tax Rate Builder. Every tax the system charges or withholds is one rule here. Bills, purchases and payroll all read these rules.',
    rules: [
      { name: 'Tax area', meaning: 'Sales only (guest bills), Purchases only (supplier bills), Both sales and purchases, or Payroll. Payroll only ever uses payroll rules.' },
      { name: 'Category (applies to)', meaning: 'What it is charged on: All, or Room, Food, Event, Service, Goods, Works, Rent… A Tourism Levy set to Room, Food, Event and Service is not charged on a shop item.' },
      { name: 'Method', meaning: 'Rate (%) of the amount, a Fixed amount, or Tiered (bands, like PAYE: each band is the width of its slice).' },
      { name: 'Base', meaning: 'Subtotal (the usual), Subtotal + taxes already applied, per person, per night, or per person × night.' },
      { name: 'Stacking', meaning: 'Additive: worked out on the same base as the others. Compound: added to the base before the next rule is worked out (a tax on a tax).' },
      { name: 'Effect', meaning: 'Add to the bill (VAT, levies), Withhold from the payment (withholding tax), or Show on the paper only / Track only (recorded, not charged).' },
      { name: 'Order (priority), dates, on/off', meaning: 'Rules run in priority order, only between their start and end dates, and only when switched on.' },
      { name: 'Account', meaning: 'The payable (or receivable) account each tax is posted to, for example VAT 2110, NHIL 2120, GETFund 2130, Tourism 2150.' },
    ],
  },
  {
    id: 'ops-ghana-taxes',
    title: 'Ghana taxes on a guest bill',
    category: 'operations',
    keywords: ['VAT', 'NHIL', 'GETFund', 'Tourism Levy', 'Act 1151', 'guest bill'],
    description: 'The standard Ghana setup (VAT Act 2025, Act 1151, from 1 January 2026), as shipped. Rates can be changed in the Tax Rate Builder if GRA revises them.',
    rules: [
      { name: 'NHIL 2.5% and GETFund 2.5%', meaning: 'On the bill\'s value before tax. Claimable as input tax on purchases.' },
      { name: 'VAT 15%', meaning: 'On the same value as NHIL and GETFund, not on top of them (no tax on a tax).' },
      { name: 'Tourism Levy 1%', meaning: 'On rooms, food, events and services. Separate from VAT and not claimable.' },
      { name: 'Hotel bill (a bill from another hotel)', meaning: 'On Accounting → Accounts Payable → New bill, set the tax to Hotel bill. NHIL 2.5%, GETFund 2.5% and VAT 15% are input tax and can be claimed. Tourism Levy 1% is a cost on that bill, not claimed. Press Tax under the total to see each line. These rates are their own type in Compliance and do not change the guest-bill rates.' },
      { name: 'Order on the bill', meaning: 'NHIL, GETFund, VAT, then Tourism Levy.' },
      { name: 'Tax-exempt guests', meaning: 'A booking marked tax-exempt pays no taxes on its room nights.' },
    ],
    examples: [
      {
        title: 'a ₵1,000 bill',
        lines: ['NHIL ₵25 + GETFund ₵25 + VAT ₵150 + Tourism Levy ₵10 = ₵210 tax.', 'The guest pays ₵1,210.'],
      },
    ],
  },
  {
    id: 'ops-withholding',
    title: 'Withholding tax on suppliers and customers',
    category: 'operations',
    keywords: ['withholding tax', 'WHT', 'supplier', 'certificate', 'withholding VAT'],
    description: 'Tax kept back from a payment and paid to GRA instead.',
    rules: [
      { name: 'When the hotel pays a supplier', meaning: 'The withholding rate is kept back from the payment and owed to GRA (2160 Withholding Tax Payable): services 7.5%, goods 3%, works 5%, commercial rent 15%, residential rent 8%.' },
      { name: 'Withholding VAT', meaning: 'If the hotel is a GRA-appointed VAT withholding agent, 7% of the VAT on a supplier bill is kept back (2170).' },
      { name: 'When a customer withholds from the hotel', meaning: 'A company paying an invoice may keep back tax and give a GRA certificate. Record it in Accounts Receivable → Tax certificates; it becomes a tax credit (1230 / 1240) instead of an unpaid balance.' },
    ],
    examples: [
      {
        title: 'paying a ₵2,000 cleaning service',
        lines: ['Withholding 7.5% = ₵150 kept back.', 'Supplier receives ₵1,850; ₵150 is owed to GRA.'],
      },
    ],
  },

  // ---------------- Payroll ----------------
  {
    id: 'ops-paye',
    title: 'PAYE bands and the special rates',
    category: 'operations',
    keywords: ['PAYE', 'income tax', 'bands', 'Act 1178', 'bonus', 'overtime', 'casual', 'non-resident'],
    description: 'Compliance & Reports → Tax Rate Builder → PAYE (Payroll). Monthly bands for resident staff, plus flat rates for some kinds of pay.',
    rules: [
      { name: 'Bands from 1 September 2026 (Act 1178)', meaning: 'First ₵588 at 0%, next ₵80 at 5%, next ₵100 at 10%, next ₵2,900 at 17.5%, next ₵16,000 at 25%, next ₵30,332 at 30%, the rest at 35%. Earlier months use the bands in force then.' },
      { name: 'Taxable pay', meaning: 'Basic + allowances + taxable benefits, less SSNIT (Tier 1) and Tier 3 (within its relief limit).' },
      { name: 'Bonus', meaning: 'Up to 15% of annual basic: 5% final tax. Any bonus above that joins the normal bands.' },
      { name: 'Overtime (junior staff)', meaning: 'For staff earning up to ₵18,000 a year: 5% on overtime up to half of monthly basic, 10% above. Other staff\'s overtime joins the normal bands.' },
      { name: 'Casual workers', meaning: '5% final tax on the payment.' },
      { name: 'Non-resident staff', meaning: '25% flat; bonus and overtime 20%.' },
    ],
    examples: [
      {
        title: 'taxable pay ₵1,768',
        lines: ['₵588 × 0% + ₵80 × 5% (₵4) + ₵100 × 10% (₵10) + ₵1,000 × 17.5% (₵175) = ₵189 PAYE.'],
      },
    ],
  },
  {
    id: 'ops-pensions',
    title: 'SSNIT, Tier 2 and Tier 3',
    category: 'operations',
    keywords: ['SSNIT', 'tier 1', 'tier 2', 'tier 3', 'pension', 'provident fund', 'employer contribution'],
    description: 'Pensions on basic salary. Names and rates are on Compliance → Payroll tax. Each employee\'s file says which apply.',
    rules: [
      { name: 'Tier 1 (SSNIT)', meaning: '13.5% of basic salary: 5.5% deducted from the employee, 8% paid by the employer. Allowances, bonus and overtime are not included. Basic is counted between ₵587.80 and ₵69,000 a month.' },
      { name: 'Tier 2', meaning: '5% of basic, paid by the employer only (no deduction from the employee), to a licensed trustee.' },
      { name: 'Tier 3 (voluntary)', meaning: 'The employee\'s own chosen % of pay, to a provident fund. Tax relief is limited to 16.5% of basic.' },
      { name: 'Names', meaning: 'A new hotel starts as SSNIT (Tier 1), Tier 2, and Tier 3. Press the name to rename it. The tier stays in brackets, and that full name is the column on payroll, the staff list, and the payslip.' },
      { name: 'In the books', meaning: 'Employee deductions are owed to the institutions (2220, 2225, 2221); the employer\'s share is an expense (5221) when the month is approved.' },
    ],
    examples: [
      {
        title: 'basic ₵2,000',
        lines: ['Employee SSNIT 5.5% = ₵110 (deducted).', 'Employer SSNIT 8% = ₵160 and Tier 2 5% = ₵100 (company cost).'],
      },
    ],
  },

  // ---------------- Controls ----------------
  {
    id: 'ops-approvals',
    title: 'Approval limits',
    category: 'operations',
    keywords: ['approval', 'threshold', 'director', 'purchase order', 'payment', 'overtime', 'payroll approval'],
    description: 'Settings → Approvals. Amounts above which a director or general manager must sign off. They are checked on the server, so no screen can skip them.',
    rules: [
      { name: 'Journal entry posting', meaning: 'A manual journal at or above the amount waits for approval.' },
      { name: 'Requisition approval', meaning: 'A stock or purchase request at or above the amount needs approval.' },
      { name: 'Direct purchase order limit', meaning: 'Up to this amount a purchase order can be raised directly; above it the buy starts as a requisition.' },
      { name: 'Payment posting', meaning: 'A payment at or above the amount needs approval before it is posted.' },
      { name: 'Overtime approval (hours)', meaning: 'Overtime requests of this many hours or more need a director; below it, HR can approve.' },
      { name: 'Payroll approval', meaning: 'On: a prepared month must be approved on Payment Advice before staff can be paid.' },
    ],
  },
  {
    id: 'ops-users-modules',
    title: 'Users, roles and modules',
    category: 'operations',
    keywords: ['users', 'roles', 'permissions', 'modules', 'access'],
    description: 'Settings → Users & Roles and Settings → Modules. Who can do what, and which desks the business uses.',
    rules: [
      { name: 'Roles', meaning: 'Each user has a role. A role lists the desks the person can open and sensitive actions they may take, such as voiding a charge, refunding, running the night audit or approving payroll.' },
      { name: 'Own sign-in', meaning: 'Every staff member signs in with their own account, so the audit log shows who did what.' },
      { name: 'Modules', meaning: 'Desks the business does not use can be switched off; they disappear from the side menu. Data already entered is kept.' },
    ],
  },
  {
    id: 'ops-company-profile',
    title: 'Company profile, dates and documents',
    category: 'operations',
    keywords: ['company profile', 'logo', 'TIN', 'date format', 'time zone', 'document templates'],
    description: 'Settings → Company Profile and Settings → Document Templates. What prints on every document.',
    rules: [
      { name: 'Company details', meaning: 'Trading and legal name, logo (with its position and size), tax and registration numbers, address and contacts: printed on bills, invoices, receipts, quotations, registration cards and payslips.' },
      { name: 'Time zone and date format', meaning: 'Decide the hotel\'s day (when the night audit closes it) and how dates print (for example 16/10/2026).' },
      { name: 'Document templates', meaning: 'Pick the design for each document type (checkout bill, quotation, receipt, registration card, payslip …). The one set active is used everywhere that document prints.' },
    ],
  },
];

/** Chapters of the Operations Manual, in reading order. */
/** Chapters in side-menu order (Executive Management → … → System Settings); a desk with no rules yet is left out. */
export const operationsModules = [
  { id: 'ops-frontdesk', title: 'Front Office Operations', intro: 'Check-in and checkout times, late and early checkout, the room after checkout, the night audit, room pricing, deposits, no-shows and cancellations, company accounts, and the tills.', topicIds: ['ops-times', 'ops-late-checkout', 'ops-early-checkout', 'ops-checkout-room', 'ops-room-charges', 'ops-room-pricing', 'ops-deposit', 'ops-no-show', 'ops-cancellation', 'ops-fees-deposits', 'ops-company', 'ops-tills', 'ops-petty-cash'] },
  { id: 'ops-inventory', title: 'Inventory & Stores', intro: 'How stock bought from suppliers reaches the books.', topicIds: ['ops-grni'] },
  { id: 'ops-hr', title: 'HR & Payroll', intro: 'PAYE bands and special rates, pensions, and what decides each deduction.', topicIds: ['ops-paye', 'ops-pensions', 'ops-payroll-rules'] },
  { id: 'ops-accounting', title: 'Accounting & Finance', intro: 'How a stay reaches the books, doubtful debts, currencies, transfers between cash, bank and MoMo, and the accounting year.', topicIds: ['ops-stay-books', 'ops-doubtful-debts', 'ops-currencies', 'ops-cash-transfers', 'ops-year-payments'] },
  { id: 'ops-compliance', title: 'Compliance & Reports', intro: 'How tax rules are built, the Ghana guest-bill taxes, and withholding tax.', topicIds: ['ops-tax-rules', 'ops-ghana-taxes', 'ops-withholding'] },
  { id: 'ops-settings', title: 'System Settings', intro: 'Document numbers, posting dates, approval limits, users and roles, and the company profile.', topicIds: ['ops-numbering', 'ops-posting-dates', 'ops-approvals', 'ops-users-modules', 'ops-company-profile'] },
];

export function groupOperationsTopics() {
  const byId = new Map(operationsTopics.map((t) => [t.id, t]));
  return operationsModules.map((m) => ({
    ...m,
    topics: m.topicIds.map((id) => byId.get(id)).filter((t): t is HelpTopic => Boolean(t)),
  }));
}
