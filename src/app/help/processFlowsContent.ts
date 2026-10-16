import type { HelpTopic } from './helpContent';

/**
 * Process Flows: each business process step by step — who does it, where in the app,
 * what they do, and what the system does (including what reaches the books).
 * Shown at /help/process-flows (open, print, or download to share). Keep in step with the
 * app: when a process changes in code, change its flow here in the same change.
 */

export const processFlowsManual = {
  intro:
    'Each business process from start to finish: who does each step, where in AGM Sync, what they do, and what the system does, including what reaches the books. Use it to train staff and to agree who is responsible for what. The rules behind these steps (fees, taxes, approval limits) are in the Operations Manual.',
};

const t = (topic: Omit<HelpTopic, 'category'>): HelpTopic => ({ ...topic, category: 'operations' });

export const processFlows: HelpTopic[] = [
  // ---------------- Executive Management ----------------
  t({
    id: 'flow-exec-daily',
    title: 'Daily management review and approvals',
    keywords: ['dashboard', 'approvals', 'general manager', 'flash report'],
    description: 'What the general manager or director checks each day. Role: general manager / director.',
    flow: [
      { who: 'General manager', where: 'Executive Management → Main Dashboard', action: 'Read in-house guests, arrivals, departures, occupancy, the financial pulse and the alerts.', result: 'Live figures from every desk; alerts point to low stock, overdue checkouts and open incidents.' },
      { who: 'General manager / director', where: 'Executive Management → Approvals', action: 'Approve or reject what is waiting: requisitions, journals, payments, overtime and payroll above the approval limits.', result: 'Approved items continue; rejected ones go back with the reason.' },
      { who: 'General manager', where: 'Front Office → Reports & Analysis', action: 'Read the daily flash report for yesterday.', result: 'Occupancy, revenue and payments for the closed day.' },
    ],
  }),

  // ---------------- Guests and rooms ----------------
  t({
    id: 'flow-stay',
    title: 'Booking to checkout (a guest stay)',
    keywords: ['reservation', 'deposit', 'check-in', 'checkout', 'folio', 'invoice'],
    description: 'A guest books, pays a deposit, stays and leaves. Roles: front desk, night auditor, cashier, housekeeping.',
    flow: [
      { who: 'Front desk', where: 'Front Office → Reservations → New reservation', action: 'Enter the guest, dates, room type and rate plan (or a quoted rate).', result: 'The booking is saved with a price for each night. A guest profile is created or reused.' },
      { who: 'Front desk / cashier', where: 'The booking → Payments', action: 'Take the deposit if the business asks for one.', result: 'Deposit recorded on the folio and held in Guest Deposits (owed to the guest). The booking can become confirmed if a deposit is required to confirm.' },
      { who: 'Front desk', where: 'Front Office → Desk (arrivals)', action: 'Check the guest in: confirm details, assign a clean room, print the registration card.', result: 'Stay is in-house, room occupied. The deposit now counts against the stay. The first night is charged now if that rule is on.' },
      { who: 'Night auditor (or automatic at 1:00am)', where: 'Front Office → Night', action: 'Close the business day.', result: 'Each in-house guest is charged that night\'s room rate and taxes, as revenue of that day.' },
      { who: 'Restaurant, bar, other outlets', where: 'POS → Room charge / folio', action: 'Charge meals, drinks or services to the room.', result: 'Added to the guest\'s folio and to revenue the same day.' },
      { who: 'Cashier', where: 'The stay → Invoices & Payments / Cashiering', action: 'Take payments during the stay or at the end (cash, card, MoMo, bank, or bill the company).', result: 'Each payment reduces the guest\'s balance and is in the books when taken.' },
      { who: 'Front desk', where: 'The stay → Check out', action: 'Review the bill, take the final payment, check out, print the checkout bill.', result: 'Early/late checkout rules applied. Invoice and receipts created. Anything still owed moves to receivables. The room becomes dirty for housekeeping, unless Settings → Operational Policies → After checkout has Mark the room dirty turned off, in which case the room is vacant and can be sold at once.' },
      { who: 'Housekeeping', where: 'Housekeeping → Floor', action: 'Clean and inspect the room.', result: 'Room ready to sell again.' },
    ],
    notHere: 'Fees for cancellations, no-shows and early or late checkout follow Settings → Operational Policies (see the Operations Manual).',
  }),
  t({
    id: 'flow-walk-in',
    title: 'Walk-in guest',
    keywords: ['walk-in', 'same day', 'no booking'],
    description: 'A guest arrives without a booking.',
    flow: [
      { who: 'Front desk', where: 'Front Office → Desk → Walk-in', action: 'Check room availability, create the stay for tonight, assign a clean room.', result: 'Booking and check-in in one step; room occupied.' },
      { who: 'Cashier', where: 'Cashiering', action: 'Take payment up front if the business requires it.', result: 'Payment in the books at once, against the stay.' },
      { who: 'Front desk', where: 'Desk', action: 'Print the registration card and hand over the key.', result: 'From here the stay follows "Booking to checkout".' },
    ],
  }),
  t({
    id: 'flow-company-billing',
    title: 'Company guest billed to the company account',
    keywords: ['corporate', 'company account', 'city ledger', 'pay later', 'receivables', 'collection'],
    description: 'A company pays for its guest later. Roles: front desk, accountant.',
    flow: [
      { who: 'Front desk', where: 'Reservation → Billing person / company', action: 'Link the stay to the company and add the purchase order or reference (required if the business asks).', result: 'The company appears as who pays.' },
      { who: 'Front desk', where: 'Checkout → Payment: Corporate Account', action: 'Check out with the balance billed to the company.', result: 'Invoice issued to the company with its credit terms (company terms, else the default). The amount moves to receivables.' },
      { who: 'Accountant', where: 'Accounting → Accounts Receivable', action: 'Send the invoice and statements; follow up by age.', result: 'The invoice shows in the company\'s aging until paid.' },
      { who: 'Accountant', where: 'Accounts Receivable → Receipts', action: 'Record the company\'s payment (and any withholding tax certificate).', result: 'Bank up, receivable down; a certificate becomes a tax credit.' },
      { who: 'Accountant (month end)', where: 'Accounts Receivable → Doubtful debts', action: 'Review old debts; update the allowance; write off what will not be paid.', result: 'Receivables shown at what is expected to be collected (IFRS 9).' },
    ],
  }),
  t({
    id: 'flow-cancel-no-show',
    title: 'Cancellation, no-show and deposit refund',
    keywords: ['cancellation', 'no-show', 'refund', 'deposit'],
    description: 'A booking is cancelled or the guest does not arrive. Roles: front desk, night auditor, cashier, manager.',
    flow: [
      { who: 'Front desk', where: 'Reservation → Cancel', action: 'Cancel the booking at the guest\'s request.', result: 'Fee by the business\'s rule: free inside the free window, otherwise the late fee. Taken from the deposit first.' },
      { who: 'Front desk or night audit', where: 'Reservation → No-show / Night audit', action: 'Mark the guest as a no-show (or the night audit does it when it closes the day).', result: 'No-show fee by the business\'s rule, taken from the deposit first; any excess billed or charged to the guarantee card.' },
      { who: 'System', where: '—', action: '—', result: 'The fee is revenue (Cancellation & No-show Fees). What is left of the deposit shows as a refund due on the booking.' },
      { who: 'Manager', where: 'Folio of the booking', action: 'Approve the refund of what is left.', result: '—' },
      { who: 'Cashier', where: 'Folio → Refund', action: 'Pay the refund back (cash, MoMo or bank).', result: 'Cash out; Guest Deposits back to zero for that booking.' },
    ],
  }),
  t({
    id: 'flow-night-audit',
    title: 'End of day (night audit)',
    keywords: ['night audit', 'business date', 'end of day', 'close day'],
    description: 'Closing the hotel\'s business day. Role: night auditor (or automatic at 1:00am).',
    flow: [
      { who: 'Night auditor', where: 'Front Office → Night', action: 'Check arrivals still expected, guests past departure, and tills still open.', result: 'Shows what is outstanding before closing.' },
      { who: 'Night auditor', where: 'Night → Close', action: 'Close the day (or Catch up if days were missed).', result: 'Room nights charged to every in-house guest; bookings that did not arrive marked no-show with the no-show rule applied; the business date moves to the next day.' },
      { who: 'Night manager', where: 'Notices', action: 'Act on any failure notice.', result: 'A failed audit notifies the Night Manager role.' },
      { who: 'Manager (next morning)', where: 'Front Office → Reports & Analysis', action: 'Read the daily flash report: occupancy, revenue, payments.', result: '—' },
    ],
  }),
  t({
    id: 'flow-housekeeping',
    title: 'Room turnover and maintenance',
    keywords: ['housekeeping', 'dirty', 'clean', 'inspect', 'maintenance', 'out of order'],
    description: 'From checkout to a room ready to sell, and fixing faults. Roles: housekeeping, supervisor, maintenance, front desk.',
    flow: [
      { who: 'System', where: '—', action: '—', result: 'At checkout the room becomes dirty, unless Mark the room dirty is off. Then the room stays vacant and this cleaning flow does not start.' },
      { who: 'Housekeeping', where: 'Housekeeping → Floor / Work', action: 'Take the room, clean it, mark it done.', result: 'Room shows cleaned.' },
      { who: 'Supervisor', where: 'Housekeeping → Inspections', action: 'Inspect and pass the room.', result: 'Room ready; Front Office can sell or assign it.' },
      { who: 'Anyone', where: 'Housekeeping → Maintenance request', action: 'Report a fault; set the room out of order if it cannot be sold.', result: 'Out-of-order rooms are not offered for sale.' },
      { who: 'Maintenance', where: 'Maintenance work order', action: 'Fix it and close the work order.', result: 'Room back in service.' },
    ],
  }),

  // ---------------- Restaurant and cash ----------------
  t({
    id: 'flow-restaurant-sale',
    title: 'Restaurant and bar sale',
    keywords: ['POS', 'order', 'kitchen', 'bill', 'payment', 'room charge', 'stock'],
    description: 'From order to payment. Roles: waiter, kitchen/bar, cashier.',
    flow: [
      { who: 'Cashier', where: 'Restaurant & Bar → Cashiering', action: 'Open a Restaurant/Bar till with the float.', result: 'Cash bills can now be taken.' },
      { who: 'Waiter', where: 'POS Terminal', action: 'Pick the table (or takeaway or room), add items, send the order (Ctrl+Enter).', result: 'Kitchen and bar tickets are sent.' },
      { who: 'Kitchen / bar', where: 'Kitchen Display', action: 'Prepare and mark ready.', result: 'Waiter sees it ready to serve.' },
      { who: 'Waiter / cashier', where: 'POS → Payment (Ctrl+P)', action: 'Bill and take payment, or charge to a guest\'s room.', result: 'Receipt printed with taxes. Paid: revenue and cash in the books. Room charge: added to the guest\'s folio. Stock for the items (and recipe ingredients) leaves the store and becomes cost of sales.' },
      { who: 'Manager', where: 'Transactions', action: 'Approve voids or refunds when needed.', result: 'A refund puts the stock back and reverses the sale.' },
      { who: 'Cashier', where: 'Cashiering → Close', action: 'Count and close the till at the end of the shift.', result: 'Variance recorded (see "Cashier shift").' },
    ],
  }),
  t({
    id: 'flow-cashier-shift',
    title: 'Cashier shift: open, take money, pay out, close, hand over',
    keywords: ['till', 'shift', 'float', 'petty cash', 'variance', 'banking', 'handover'],
    description: 'Every cedi belongs to a cashier\'s shift. Roles: cashier, accountant.',
    flow: [
      { who: 'Cashier', where: 'Cashiering → Open till', action: 'Open the cash till (and MoMo tills) with the opening float.', result: 'Shift open; payments taken are counted on it.' },
      { who: 'Cashier', where: 'Cashiering → Paid out', action: 'Pay a small expense with a reason and type (within the till\'s limit).', result: 'Expense in the books; expected cash goes down.' },
      { who: 'Cashier', where: 'Cashiering → Close', action: 'Count the drawer and read the MoMo device.', result: 'Expected vs counted: over or short recorded on the shift.' },
      { who: 'Cashier', where: 'Cash handover', action: 'Hand the takings to Accounts (or to the next cashier).', result: 'Custody moves to the receiver, recorded.' },
      { who: 'Accountant', where: 'Accounting → Bank & Cash → Transfer between accounts', action: 'Move the takings from cash (or MoMo) into the bank.', result: 'A contra entry: the bank is debited, cash or MoMo is credited. No income or expense. A fee is a separate Bank charge.' },
    ],
  }),

  // ---------------- Stores ----------------
  t({
    id: 'flow-purchase',
    title: 'Buying stock: request to payment',
    keywords: ['requisition', 'purchase order', 'goods received', 'supplier invoice', 'payment', 'withholding'],
    description: 'Roles: department head, storekeeper, purchasing, director (above limits), accountant.',
    flow: [
      { who: 'Department head', where: 'Inventory → Requisitions', action: 'Request the items needed.', result: 'Requisition waiting for approval.' },
      { who: 'Approver / director', where: 'Requisitions or Approvals', action: 'Approve (a director must approve at or above the requisition limit).', result: 'Approved; can be turned into a purchase order.' },
      { who: 'Purchasing', where: 'Purchase Orders', action: 'Raise the order to the supplier (small buys up to the direct limit can go straight to an order).', result: 'Order sent and tracked.' },
      { who: 'Storekeeper', where: 'Purchase Orders → Goods Receipt', action: 'Count what arrives and receive it (accept or reject each line).', result: 'Stock goes up at the receiving location. Its value is recorded, and what is owed sits in Goods Received, Not Invoiced until the bill is entered.' },
      { who: 'Accountant', where: 'Inventory → Invoices', action: 'Match the supplier\'s bill to the order and what was received.', result: 'Differences in quantity or price are flagged before paying.' },
      { who: 'Accountant', where: 'Accounting → Accounts Payable → New bill', action: 'Enter the supplier\'s bill with its delivery (GRN) number or PO number.', result: 'The delivery is cleared from Goods Received, Not Invoiced and the supplier is owed the bill amount once, with the VAT as input tax. A dearer bill adds the difference to the stock value.' },
      { who: 'Accountant (approver above the payment limit)', where: 'Accounting → Accounts Payable → Payments', action: 'Pay the supplier, keeping back withholding tax.', result: 'Bank down, supplier balance down; the withholding is owed to GRA.' },
    ],
  }),
  t({
    id: 'flow-stock-movement',
    title: 'Issuing, transferring and counting stock',
    keywords: ['issue', 'transfer', 'stock count', 'location'],
    description: 'Roles: storekeeper, departments, manager.',
    flow: [
      { who: 'Storekeeper', where: 'Inventory → Issues', action: 'Issue items to a department or person.', result: 'Quantity leaves the store.' },
      { who: 'Storekeeper', where: 'Inventory → Transfers', action: 'Move stock between locations (for example main store to bar).', result: 'Quantity moves; the hotel total does not change.' },
      { who: 'Storekeeper + witness', where: 'Inventory → Stock Count', action: 'Count the shelf at a location and enter the quantities.', result: 'Book quantity set to the count; differences are visible for review.' },
      { who: 'Manager', where: 'Inventory reports', action: 'Review differences and low-stock alerts.', result: '—' },
    ],
  }),

  // ---------------- Events ----------------
  t({
    id: 'flow-event',
    title: 'Event or conference: enquiry to invoice',
    keywords: ['event', 'conference', 'quotation', 'deposit', 'function sheet', 'invoice'],
    description: 'Roles: events coordinator, kitchen and banquets, accountant.',
    flow: [
      { who: 'Events coordinator', where: 'Events & Conferences → New event', action: 'Enter the client, date, hall, guests, catering and rates (and rooms if residential).', result: 'Event booked; the hall is held.' },
      { who: 'Events coordinator', where: 'The event → Quotation', action: 'Send the quotation.', result: 'Printed with the business\'s quotation design and taxes.' },
      { who: 'Cashier / accountant', where: 'The event → Record receipt', action: 'Take the deposit or payment against the event invoice.', result: 'Money received in advance is held until the event takes place, then becomes revenue.' },
      { who: 'Banquets / kitchen', where: 'Function sheet', action: 'Prepare and run the event from the function sheet.', result: '—' },
      { who: 'Accountant', where: 'Accounts Receivable', action: 'Collect any balance after the event.', result: 'Receivable until paid.' },
    ],
  }),

  // ---------------- People ----------------
  t({
    id: 'flow-new-staff',
    title: 'New staff member',
    keywords: ['new hire', 'employee', 'user account', 'role'],
    description: 'Roles: HR, system administrator.',
    flow: [
      { who: 'HR', where: 'HR & Payroll → Employees → Add Employee', action: 'Enter personal details, department, position, hire date, salary, and SSNIT (Tier 1) / Tier 2 / PAYE choices. Phone is required. Email is optional; if it is typed, it must be a real address. Starred fields are required.', result: 'Employee on file; included in the next payroll. Pension columns use the names from Compliance → Payroll tax, with the tier still on the name.' },
      { who: 'Administrator', where: 'Settings → Users & Roles', action: 'Create their sign-in with the right role (only the desks and actions they need).', result: 'They can sign in with their own account.' },
      { who: 'HR', where: 'Employee file', action: 'Add documents, contract and probation dates.', result: 'Expiry reminders appear in HR notices.' },
    ],
  }),
  t({
    id: 'flow-payroll',
    title: 'Monthly payroll',
    keywords: ['payroll', 'payslips', 'PAYE', 'SSNIT', 'payment advice', 'remittance'],
    description: 'Roles: HR / payroll officer, manager or director, accountant.',
    flow: [
      { who: 'HR', where: 'HR & Payroll → Time / Leave', action: 'Approve overtime and leave for the month.', result: 'Approved overtime is included in the pay.' },
      { who: 'Payroll officer', where: 'Payroll → Staff Payroll → + Prepare', action: 'Prepare the month; review each person\'s gross, deductions and net.', result: 'Payroll lines created with PAYE and the three pensions, under the names from Compliance → Payroll tax. Each name keeps (Tier 1), (Tier 2), or (Tier 3). Staff debt repayments are included.' },
      { who: 'Manager / director', where: 'Payroll → Payment Advice', action: 'Approve the month (if approval is required).', result: 'Salaries, employer contributions and amounts owed (net pay, PAYE, pensions) posted to the books.' },
      { who: 'Accountant', where: 'Payment Advice → Mark as paid', action: 'Pay staff by bank, MoMo or cash and mark them paid.', result: 'Net pay owed cleared.' },
      { who: 'Payroll officer', where: 'Payroll → Payslips', action: 'Print payslips: one, the ticked staff, or the whole month.', result: 'Printed with the business\'s payslip design.' },
      { who: 'Accountant', where: 'Accounting → Taxes → Record payment', action: 'Pay PAYE to GRA and pensions to SSNIT and the trustees by their due dates, and record each payment.', result: 'Amounts owed to GRA, SSNIT and trustees cleared.' },
    ],
  }),

  // ---------------- Finance ----------------
  t({
    id: 'flow-cash-transfer',
    title: 'Moving money between cash, bank and MoMo',
    keywords: ['transfer', 'contra', 'cash', 'bank', 'momo', 'mobile money', 'bank charge'],
    description: 'Cash, the bank, and MoMo can pay each other. Role: accountant.',
    flow: [
      { who: 'Accountant', where: 'Accounting → Bank & Cash → New transaction', action: 'Set the type to Transfer between accounts. Choose the account the money leaves and the account it arrives in (cash, bank, or MoMo), the amount, and a reference.', result: 'The two accounts must be different, and in the same currency.' },
      { who: 'System', where: '—', action: '—', result: 'One journal: debit the account that receives the money, credit the account that gives it up. Two linked cashbook lines, money out and money in. Nothing is income or an expense.' },
      { who: 'Accountant', where: 'Bank & Cash → Bank charge', action: 'Record a MoMo or bank fee on its own, if there is one.', result: 'Bank charges go up; the account the fee left goes down.' },
    ],
  }),
  t({
    id: 'flow-month-end',
    title: 'Month end close',
    keywords: ['month end', 'close period', 'bank reconciliation', 'statements', 'doubtful debts'],
    description: 'Roles: accountant, general manager.',
    flow: [
      { who: 'Accountant', where: 'Front Office → Night', action: 'Make sure the last night of the month is closed.', result: 'All room nights of the month are in the month.' },
      { who: 'Accountant', where: 'Bank & Cash → Reconciliation', action: 'Reconcile each bank and MoMo account with its statement.', result: 'Bank charges and interest posted; differences explained.' },
      { who: 'Accountant', where: 'Accounts Receivable → Doubtful debts', action: 'Read the allowance by customer and the overdue invoices. Update the allowance, and write off a debt that will not be paid.', result: 'Receivables at their expected value. A customer\'s share of the allowance follows what they owe in each age band.' },
      { who: 'Accountant', where: 'Accounting → PPE & Assets', action: 'Check the month\x27s depreciation for each asset.', result: 'Depreciation expense in the books.' },
      { who: 'Accountant', where: 'Financial Statements → Trial balance / Balance sheet', action: 'Check the trial balance balances and review unusual balances (guest ledger, deposits, suspense).', result: '—' },
      { who: 'General manager', where: 'Financial Statements', action: 'Review the income statement and balance sheet.', result: '—' },
      { who: 'Accountant', where: 'Financial Statements → Close P&L', action: 'Close the period.', result: 'Profit moves to retained earnings; nothing more can be posted into the month.' },
    ],
  }),
  t({
    id: 'flow-tax-returns',
    title: 'Paying taxes to GRA',
    keywords: ['VAT return', 'NHIL', 'GETFund', 'Tourism Levy', 'withholding', 'PAYE', 'remittance'],
    description: 'Monthly returns from the amounts the system has collected. Role: accountant.',
    flow: [
      { who: 'Accountant', where: 'Compliance & Reports → Reports', action: 'Open the month\'s tax report and the filing dates.', result: 'VAT, NHIL, GETFund and Tourism Levy collected; input tax on purchases; withholding kept back; PAYE.' },
      { who: 'Accountant', where: 'GRA portal (outside AGM Sync)', action: 'File the returns.', result: '—' },
      { who: 'Accountant', where: 'Accounting → Taxes → Record payment', action: 'Record each payment to GRA.', result: 'The tax owed accounts go down; bank down.' },
    ],
  }),
];

/** Chapters of the Process Flows document, in reading order. */
/** Chapters in side-menu order (Executive Management → … → Compliance & Reports); a desk with no flow yet is left out. */
export const processFlowModules = [
  { id: 'flows-exec', title: 'Executive Management', intro: 'The daily review and approvals.', topicIds: ['flow-exec-daily'] },
  { id: 'flows-frontdesk', title: 'Front Office Operations', intro: 'From booking to checkout, company billing, cancellations, the end of day and the cashier shift.', topicIds: ['flow-stay', 'flow-walk-in', 'flow-company-billing', 'flow-cancel-no-show', 'flow-night-audit', 'flow-cashier-shift'] },
  { id: 'flows-events', title: 'Events & Conferences', intro: 'Halls, conferences and functions.', topicIds: ['flow-event'] },
  { id: 'flows-restaurant', title: 'Restaurant & Bar', intro: 'From order to payment, through the kitchen.', topicIds: ['flow-restaurant-sale'] },
  { id: 'flows-housekeeping', title: 'Housekeeping & Maintenance', intro: 'Room turnover and fixing faults.', topicIds: ['flow-housekeeping'] },
  { id: 'flows-inventory', title: 'Inventory & Stores', intro: 'Buying stock and moving it.', topicIds: ['flow-purchase', 'flow-stock-movement'] },
  { id: 'flows-hr', title: 'HR & Payroll', intro: 'New staff and the monthly payroll.', topicIds: ['flow-new-staff', 'flow-payroll'] },
  { id: 'flows-accounting', title: 'Accounting & Finance', intro: 'Moving money between cash, bank and MoMo, then closing the month.', topicIds: ['flow-cash-transfer', 'flow-month-end'] },
  { id: 'flows-compliance', title: 'Compliance & Reports', intro: 'Paying taxes to GRA.', topicIds: ['flow-tax-returns'] },
];

export function groupProcessFlows() {
  const byId = new Map(processFlows.map((f) => [f.id, f]));
  return processFlowModules.map((m) => ({
    ...m,
    topics: m.topicIds.map((id) => byId.get(id)).filter((f): f is HelpTopic => Boolean(f)),
  }));
}
