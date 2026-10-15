// Builds one self-contained test guide per friend (no setup needed; everyone shares Demo Hotel).
// Run: node scripts/build-friend-guides.mjs  →  docs/testers/friends/*.html
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const outDir = path.join(root, 'docs', 'testers', 'friends');
fs.mkdirSync(outDir, { recursive: true });

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// **bold** and `code` inside step text.
const md = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/`(.+?)`/g, '<code>$1</code>');

// ---------- shared parts ----------

const SIGN_IN = [
  'Open **www.agmsync.com** on a laptop (Chrome or Edge). A phone works for the restaurant and housekeeping screens.',
  'Organization ID: **demo**',
  'Email and password: **the ones Abdul sent you**. Do not share them.',
  'If the page looks old after an update, press **Ctrl + F5**.',
];

const rules = (who) => [
  `Everyone uses the same practice hotel (**Demo Hotel**). Use **your own name** on every guest, client or item you create, for example **${who} Test Guest**. That way nobody mixes up whose is whose.`,
  'Only use **your rooms** (listed in your guide). Other rooms belong to the other testers.',
  'Do **not** run **Night Audit** unless your guide says so. It moves the whole hotel to the next day.',
  'Nothing here is real money. Try things, even "wrong" things. Finding problems is the point.',
  'Each task has a ✅ check. Tick it if it worked, or mark ❌ and write down what happened.',
];

const REPORT = [
  'The **task number** (for example M4).',
  'The **screen**: the menu on the left and the tab at the top.',
  'What you **typed or clicked**.',
  'What you **expected**, and what **actually happened**.',
  'A **phone photo or screenshot** of the screen, if you can.',
];

const FEEDBACK = [
  'Which screen was the **easiest** to use?',
  'Which screen was the **most confusing**, and why?',
  'Was any word or button name **unclear**? Which one?',
  'Was anything **slow**?',
  'What would you **add or change** before a real hotel uses this?',
];

const WORDS = [
  ['Folio', "A guest's bill: room nights, restaurant charges, and payments."],
  ['In house', 'A guest who has checked in and not left yet.'],
  ['Walk-in', 'A guest who arrives without a booking.'],
  ['Night audit', 'The end-of-day close. It adds the next room night to every guest and moves the hotel to the next day.'],
  ['Till', "One cashier's cash drawer for a shift. It must be open before taking cash."],
  ['KOT / BOT', 'Kitchen / bar order ticket, printed when an order is sent.'],
  ['Recipe', 'What one dish uses from stock. Selling the dish takes those amounts off stock.'],
  ['Requisition', 'A department asking the store for stock.'],
  ['PO / GRN', 'Purchase order (what we ask a supplier for) / goods received note (what arrived).'],
  ['Receivable / Payable', 'Money customers owe the hotel / money the hotel owes suppliers.'],
];

const TAX_NOTE = 'Taxes: **room and event prices** have tax **added on top** (VAT 15%, NHIL 2.5%, GETFund 2.5%, Tourism Levy 1%). **Menu prices already include tax**: the guest pays the menu price and the tax is shown inside it. Bills list the taxes as **NHIL/GETFund 5%, VAT 15%, Tourism Levy 1%**.';

// ---------- people ----------

const PEOPLE = [
  {
    file: 'mike.html', name: 'Mike', code: 'M', time: 'about 2 to 3 hours',
    focus: 'A full hotel day: bookings, check-in, the room bill, the restaurant, housekeeping, stock, and closing the day.',
    rooms: 'Rooms **101, 102, 201, 202**',
    tasks: [
      { t: 'Look around first', s: ['Click each area in the left menu once: Front Office, Restaurant & Bar, Kitchen, Housekeeping, Inventory, Accounting.', 'Open **Executive Management → Main Dashboard**. Note what it shows today.'], c: 'You can reach every area without an error.' },
      { t: 'Add a client', s: ['**Front Office Operations → Clients**, press **New Client**.', 'Name **Mike Test Guest**, a phone number, and an email.'], c: 'Searching "Mike" finds the client.' },
      { t: 'Make a reservation', s: ['**Front Office → Reservations**, press **New Reservation**.', 'Guest: Mike Test Guest. Room type **Standard**, room **101**, arriving **today**, leaving **in 2 days**.'], c: 'It shows **2 nights** and a total with tax added.' },
      { t: 'Check in and take a deposit', s: ['**Front Office → Desk**, open the stay.', 'Take a **Cash** payment for one night, then press **Check in**.'], c: 'Room 101 turns occupied. The folio shows the first night and your payment.' },
      { t: 'A walk-in', s: ['On **Desk**, press **Walk-in**: guest **Mike Walk-in**, Deluxe, room **201**, leaving **tomorrow**.', 'Take **Mobile Money** for the full amount and check in.'], c: 'Outstanding balance is **0.00**.' },
      { t: 'Wrong room, then move', s: ['Walk-in **Mike Mover**, Standard, room **102**, check in.', '**Room Transfer**: move him to room **202**. When asked whether he used room 102, answer **No**.'], c: 'Room 202 is occupied; room 102 is free again (not dirty).' },
      { t: 'A restaurant meal charged to the room', s: ['Open the till: **Restaurant & Bar → Cash → Open till** (any float, for example 200).', '**Restaurant & Bar → POS Terminal**: switch to **In-house**, pick room **101**, add **Jollof Rice & Chicken**, press **Send to kitchen**.', 'Press **Process payment → Bill to Room**.'], c: 'The meal appears on the **room 101 folio** (Front Office → Desk). It is not a cash sale.' },
      { t: 'Housekeeping', s: ['**Housekeeping & Maintenance → Floor**: find your rooms.', 'Mark room **102** dirty, then clean it (Start → Done).', '**Work**: add a task "Extra towels" for room **201** and finish it.'], c: 'Room statuses change straight away, and on another computer too.' },
      { t: 'Check out', s: ['**Desk**: open room **101**, pay what is left (Card), then **Check out**.', 'Print or preview the **bill**.'], c: 'The bill lists room nights, the restaurant meal, and taxes as NHIL/GETFund 5%, VAT 15%, Tourism Levy 1%. Room 101 turns dirty.' },
      { t: 'Ask the assistant', s: ['Open the green chat button (bottom right) → **Ask Mamani**.', 'Ask: "how many rooms are occupied?" and "give me a summary".'], c: 'The answers match what you see on the screens.' },
      { t: 'Close the restaurant till', s: ['**Restaurant & Bar → Cash**: close your till and count the cash.'], c: 'Expected cash = float + cash sales. Room charges are not in the cash.' },
      { t: 'End of day: Night Audit (only Mike)', s: ['Tell the others on WhatsApp first: "Running night audit now."', '**Front Office → Night**: read the business date, then press **Close**.'], c: 'The business date moves to tomorrow, and in-house guests get their next room night.' },
    ],
  },
  {
    file: 'gina.html', name: 'Gina', code: 'G', time: 'about 1.5 to 2 hours',
    focus: 'The restaurant from start to finish: till, orders, kitchen, paying, receipts, and how stock goes down when food sells.',
    rooms: 'Room **103** (for one meal charged to a room)',
    tasks: [
      { t: 'Open your till', s: ['**Restaurant & Bar → Cash → Open till**, float **200**.'], c: 'The till shows open with 200 cash.' },
      { t: 'Look at the menu', s: ['**Restaurant & Bar → Menu**. Find **Jollof Rice & Chicken** and **Star Beer (Bottle)**.', 'Note: menu prices already include tax.'], c: 'Both dishes are there with prices.' },
      { t: 'Make a stock item for beer', s: ['**Inventory & Stores → Stock → Items**: add **Gina Star Beer**, unit **bottle**, cost **10**.', 'Give it stock: receive **24** bottles (Purchase Orders → receive, or Receive & Recon), into **Restaurant & Bar**.'], c: 'Gina Star Beer shows 24 in Restaurant & Bar.' },
      { t: 'Link the beer to the menu', s: ['**Restaurant & Bar → Menu**: edit **Star Beer (Bottle)** and set **Stock item** to **Gina Star Beer**.'], c: 'The menu item shows it is linked to stock.' },
      { t: 'A dine-in order', s: ['**POS Terminal**: table **T05**, add **2 Jollof Rice & Chicken + 2 Star Beer**.', 'Press **Send to kitchen**.'], c: 'A KOT goes to the kitchen and a BOT goes to the bar.' },
      { t: 'The kitchen side', s: ['**Kitchen → Kitchen Display**: find your ticket, move it to **ready**, then **served**.'], c: 'The order shows on the display within a second or two of sending.' },
      { t: 'Take payment', s: ['Back on **POS**: **Process payment → Cash**.', 'Look at the receipt.'], c: 'The total equals the menu prices. The receipt has a receipt number (RCT…) and lists the taxes inside the price.' },
      { t: 'Stock went down', s: ['**Inventory & Stores → Stock → Items**: look at **Gina Star Beer**.'], c: 'It went from 24 to **22**.' },
      { t: 'Mobile money and card', s: ['Make two more small orders (1 Star Beer each). Pay one with **Mobile Money** (pick MTN) and one with **Card** (pick Visa).'], c: 'Receipts show the network / card brand you picked.' },
      { t: 'Charge to a room', s: ['Front desk part: **Front Office → Desk → Walk-in**: guest **Gina Room Guest**, room **103**, check in (no payment).', 'POS: **In-house**, room **103**, 1 Jollof, **Bill to Room**.'], c: 'The meal shows on the room 103 folio, not in your cash.' },
      { t: 'Reprint and void', s: ['**Restaurant & Bar → Transactions**: open your first order and press **Print**.', 'Make a new order, then **Void** one line of it.'], c: 'The reprint has the same receipt number. The voided line no longer counts as sales.' },
      { t: 'Close your till', s: ['**Restaurant & Bar → Cash**: close the till and count your cash.'], c: 'Expected cash = 200 + your cash sales. Mobile money and card are shown separately.' },
    ],
  },
  {
    file: 'rukaya.html', name: 'Rukaya', code: 'R', time: 'about 1.5 to 2 hours',
    focus: 'The stores: buying from suppliers, receiving goods, giving stock to departments, counting, and what it does to the accounts.',
    rooms: 'No rooms needed',
    tasks: [
      { t: 'Add stock items', s: ['**Inventory & Stores → Stock → Items**, add:', '**Rukaya Rice** (kg, cost 20), **Rukaya Chicken** (kg, cost 60), **Rukaya Toilet Roll** (piece, cost 3).'], c: 'All three items are listed.' },
      { t: 'Add a supplier', s: ['**Suppliers** tab: add **Rukaya Foods Ltd**, VAT registered, with any TIN.'], c: 'The supplier is listed.' },
      { t: 'Purchase order', s: ['**Purchase Orders**: raise a PO to Rukaya Foods Ltd for **Rice 50 kg, Chicken 20 kg, Toilet Roll 100**, and send it.'], c: 'The PO total is **2,500** before tax (1,000 + 1,200 + 300).' },
      { t: 'Receive the goods', s: ['**Receive & Recon**: receive the PO in full into the **Main Store**.'], c: 'Items tab: Main Store shows Rice 50, Chicken 20, Toilet Roll 100.' },
      { t: "Enter the supplier's invoice", s: ['**Invoices** tab: enter the invoice for what you received.'], c: 'Tax lines are VAT 15%, NHIL 2.5%, GETFund 2.5%. There is **no tourism levy** on purchases.' },
      { t: 'Effect on accounts (look only)', s: ['**Accounting & Finance → Payable**: find Rukaya Foods Ltd.'], c: 'The invoice total shows as money the hotel owes.' },
      { t: 'Kitchen asks for stock', s: ['**Kitchen → Supplies**: request **Rukaya Rice 10, Rukaya Chicken 5**.', '**Inventory → Stock → Requisitions**: approve it. Then **Issues**: issue it.'], c: 'Main Store: Rice 40, Chicken 15. Kitchen: Rice 10, Chicken 5.' },
      { t: 'Housekeeping asks for stock', s: ['**Housekeeping → Supplies**: request **20 Rukaya Toilet Roll**, then approve and issue it in Inventory.'], c: 'Main Store: Toilet Roll 80. Housekeeping: 20.' },
      { t: 'Transfer', s: ['**Transfers**: move **5 kg Rukaya Rice** from Main Store to **Restaurant & Bar**.'], c: 'Main Store Rice 35, Restaurant & Bar Rice 5.' },
      { t: 'A recipe uses stock', s: ['**Kitchen → Recipes**: make **Rukaya Rice Bowl**: Rukaya Rice **0.25 kg**, Rukaya Chicken **0.3 kg**. Link it to any food menu dish (for example Fried Rice & Chicken).', 'Ask Gina or Mike to sell 2 of that dish, or sell them yourself on the POS (a till must be open).'], c: 'Kitchen stock drops by Rice 0.5 and Chicken 0.6.' },
      { t: 'Stock count', s: ['**Stock count**: count Main Store and enter Toilet Roll as **78** (2 went missing).'], c: 'Stock becomes 78 and the 2-piece difference is recorded as a loss.' },
      { t: 'Reports', s: ['**Inventory & Stores → Reports & Analysis**: open stock on hand and stock movement.'], c: 'Your receipts, issues, transfer and count all show.' },
    ],
  },
  {
    file: 'anita.html', name: 'Anita', code: 'A', time: 'about 1 to 1.5 hours',
    focus: 'Events and conferences only: venues, prices, a booking, the quote, the deposit, the function sheet, and the final bill.',
    rooms: 'No rooms needed',
    tasks: [
      { t: 'Look around Events', s: ['**Events & Conferences → Events**. Look at the tabs: Event Management, Venue Management, Guest Rates, Reports & Analysis, Staff Management.'], c: 'Each tab opens without an error.' },
      { t: 'Add a venue', s: ['**Venue Management**: add **Anita Hall**, capacity **80**.'], c: 'Anita Hall is listed.' },
      { t: 'Guest rates', s: ['**Guest Rates**: look at the per-head prices. Add or edit a conference package, for example **Anita Day Package**, **150 per head**.'], c: 'The package shows with its price.' },
      { t: 'A client', s: ['Add the client **Anita Events Ltd** (a company) when the booking asks for one, or under **Front Office → Clients**.'], c: 'You can pick Anita Events Ltd on the booking.' },
      { t: 'Book an event', s: ['**Event Management → New event**: **Anita Strategy Workshop**, client Anita Events Ltd, venue Anita Hall, a date **next week**, 9:00–16:00, **40 guests**, Anita Day Package.'], c: '40 × 150 = **6,000** before tax; the total adds tax on top.' },
      { t: 'Quote / proforma', s: ['Preview or print the **proforma** (quote).'], c: 'It shows the client, date, guests, package, and taxes as NHIL/GETFund 5%, VAT 15%, Tourism Levy 1%.' },
      { t: 'Deposit', s: ['Take a **deposit of 3,000** by **bank transfer**.', 'Print the **receipt**.'], c: 'The balance still to pay = total − 3,000.' },
      { t: 'Function sheet', s: ['Open the **function sheet** (the plan for the day): add a coffee break and lunch, and a note for setup.'], c: 'It prints clearly enough to hand to the kitchen and setup team.' },
      { t: 'Contract', s: ['Preview the **contract**.'], c: 'The names, date and amounts are right.' },
      { t: 'Change the numbers', s: ['Change the guests from 40 to **45**.'], c: 'The total and the balance update.' },
      { t: 'Final invoice and payment', s: ['Make the **invoice**, then take the rest as **Mobile Money**.'], c: 'Balance becomes **0.00**.' },
      { t: 'Reports', s: ['**Reports & Analysis** in Events: find your event in the revenue and bookings reports.'], c: 'Your event and its money show correctly.' },
    ],
  },
  {
    file: 'noda-accounts.html', name: 'Noda accounts staff', code: 'N', time: 'about 1.5 to 2 hours',
    focus: 'How the front of the house reaches the books: what each sale, payment, and supplier bill posts, the taxes, and the reports.',
    rooms: 'Room **104** (one small stay of your own)',
    tasks: [
      { t: 'Find your way in Accounting', s: ['**Accounting & Finance**: look at the tabs: Receivable, Payable, Bank & Cash, Assets, Tax, Journal, Statements, Reports & Analysis, Books.'], c: 'Each tab opens without an error.' },
      { t: 'A front desk sale of your own', s: ['**Front Office → Desk → Walk-in**: guest **Noda Test Guest**, Standard, room **104**, leaving tomorrow. Take **Cash** for the full stay and check in.'], c: 'The folio balance is 0.00.' },
      { t: 'Where the cash went', s: ['**Accounting → Receivable / Receipts**: find the payment.', '**Journal**: find the entries for the stay and the payment.'], c: 'Cash goes up, and the room revenue and the tax payables (VAT, NHIL, GETFund, Tourism) are on separate lines.' },
      { t: 'A restaurant sale in the books', s: ['Restaurant: open a till (**Restaurant & Bar → Cash**), sell **1 Waakye with Stew** for **Cash** on the **POS**.', '**Journal**: find that sale.'], c: 'Sales and taxes post; the tax is taken out of the menu price (prices include tax).' },
      { t: 'Company on account', s: ['**Walk-in**: **Noda Corporate Guest**, billed to a company client **Noda Accounts Ltd** (create it), room **105**. Check in and check out **without paying** (on account).'], c: 'Receivable shows Noda Accounts Ltd owing the bill.' },
      { t: 'Receive the company payment', s: ['**Receivable**: record a payment from Noda Accounts Ltd by **bank transfer**, with **5% WHT** if the screen offers it.'], c: 'The balance clears; any WHT shows as a tax credit.' },
      { t: 'A supplier bill and payment', s: ['**Payable**: enter a bill from **Noda Office Supplies**, stationery **500 + tax**.', 'Pay it from the bank.'], c: 'Payable goes to zero; the bank goes down.' },
      { t: 'Petty cash', s: ['**Bank & Cash**: fund petty cash **300** and spend **80** on cleaning items.'], c: 'Petty cash balance is **220**.' },
      { t: 'Taxes', s: ['**Tax** tab: look at the output taxes (sales) and input taxes (purchases) for today.'], c: 'Sales taxes add up from the stays and meals; purchases show VAT/NHIL/GETFund only.' },
      { t: 'Statements', s: ['**Statements**: open the profit and loss and the balance sheet for this month.'], c: 'They balance, and your sales and costs appear.' },
      { t: 'Check out your guest', s: ['**Desk**: check out room **104**.'], c: 'The final bill has 0.00 to pay.' },
      { t: 'Backdating lock', s: ['Try to make a **manual journal** dated **last week**.'], c: 'It is refused (backdating is locked) unless a manager turns it on in Operational Policies.' },
    ],
  },
];

// ---------- page ----------

function page(p) {
  const tasks = p.tasks.map((task, i) => `
    <section class="task">
      <div class="task-head"><span class="num">${p.code}${i + 1}</span><h3>${md(task.t)}</h3></div>
      <ol>${task.s.map((s) => `<li>${md(s)}</li>`).join('')}</ol>
      <div class="check"><span class="box" aria-hidden="true"></span><span><strong>Check:</strong> ${md(task.c)}</span></div>
      <div class="note">Notes: <span class="line"></span></div>
    </section>`).join('');
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>AGM Sync test: ${esc(p.name)}</title>
<style>
:root{--ink:#1c1917;--muted:#57534e;--line:#e7e5e4;--teal:#0b5f64;--gold:#e9a23b;--bg:#fafaf9;--card:#fff;--ok:#15803d}
@media (prefers-color-scheme:dark){:root{--ink:#f5f5f4;--muted:#a8a29e;--line:#3f3a36;--bg:#1c1917;--card:#262220}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.55 "Segoe UI",system-ui,Arial,sans-serif}
.wrap{max-width:820px;margin:0 auto;padding:20px 16px 60px}
header{background:linear-gradient(120deg,var(--teal),#147a7f 60%,var(--gold));color:#fff;border-radius:16px;padding:22px 22px 18px}
header h1{margin:0 0 4px;font-size:26px}header p{margin:4px 0;opacity:.95}
.pill{display:inline-block;background:rgba(255,255,255,.18);border-radius:999px;padding:3px 10px;margin:6px 6px 0 0;font-size:13px}
h2{font-size:19px;margin:28px 0 10px;color:var(--teal)}
@media (prefers-color-scheme:dark){h2{color:#5fc3c7}}
.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px 18px}
ul,ol{margin:6px 0;padding-left:22px}li{margin:4px 0}
.task{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px 18px;margin:12px 0;break-inside:avoid}
.task-head{display:flex;align-items:center;gap:10px}.task-head h3{margin:0;font-size:17px}
.num{flex:none;background:var(--teal);color:#fff;border-radius:8px;padding:2px 8px;font-weight:700;font-size:14px}
.check{display:flex;gap:10px;align-items:flex-start;margin-top:8px;padding:8px 10px;border-radius:10px;background:rgba(21,128,61,.08)}
.box{flex:none;width:18px;height:18px;border:2px solid var(--ok);border-radius:4px;margin-top:3px}
.note{margin-top:8px;color:var(--muted);font-size:14px;display:flex;gap:6px}.line{flex:1;border-bottom:1px dashed var(--line);min-height:18px}
code{background:rgba(120,113,108,.15);padding:1px 5px;border-radius:5px}
table{width:100%;border-collapse:collapse;font-size:15px}td{border-top:1px solid var(--line);padding:6px 4px;vertical-align:top}td:first-child{font-weight:600;width:34%}
.foot{margin-top:30px;color:var(--muted);font-size:13px;text-align:center}
@media print{body{background:#fff}header{color:#000;background:none;border:1px solid #ccc}.pill{background:#eee}}
</style></head><body><div class="wrap">
<header>
  <h1>Hi ${esc(p.name)}, thanks for testing AGM Sync</h1>
  <p>${md(p.focus)}</p>
  <span class="pill">⏱ ${esc(p.time)}</span><span class="pill">🛎️ ${md(p.rooms)}</span><span class="pill">🧾 ${p.tasks.length} small tasks</span>
</header>

<h2>1. Sign in</h2>
<div class="card"><ol>${SIGN_IN.map((s) => `<li>${md(s)}</li>`).join('')}</ol></div>

<h2>2. A few rules</h2>
<div class="card"><ul>${rules(p.name.split(" ")[0]).map((s) => `<li>${md(s)}</li>`).join('')}</ul><p>${md(TAX_NOTE)}</p></div>

<h2>3. Your tasks</h2>
<p>Do them in order. Each one takes a few minutes. Getting lost is useful feedback too, so note it.</p>
${tasks}

<h2>4. When something goes wrong</h2>
<div class="card"><p>Write down:</p><ol>${REPORT.map((s) => `<li>${md(s)}</li>`).join('')}</ol><p>Then carry on with the next task. Send your notes and photos to Abdul on WhatsApp.</p></div>

<h2>5. At the end, tell us</h2>
<div class="card"><ol>${FEEDBACK.map((s) => `<li>${md(s)}</li>`).join('')}</ol></div>

<h2>Words you will see</h2>
<div class="card"><table>${WORDS.map(([w, d]) => `<tr><td>${esc(w)}</td><td>${esc(d)}</td></tr>`).join('')}</table></div>

<p class="foot">AGM Sync · Your property, simply connected · www.agmsync.com</p>
</div></body></html>`;
}

for (const p of PEOPLE) fs.writeFileSync(path.join(outDir, p.file), page(p));

// A small index for Abdul: who gets which page.
const index = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>AGM Sync tester guides</title>
<style>body{font:16px/1.5 "Segoe UI",system-ui,Arial,sans-serif;max-width:720px;margin:24px auto;padding:0 16px;color:#1c1917}a{color:#0b5f64;font-weight:600}td{padding:6px 8px;border-top:1px solid #e7e5e4;vertical-align:top}</style></head><body>
<h1>AGM Sync tester guides</h1><p>Send each friend their own page. Everyone uses Demo Hotel (Organization ID <b>demo</b>); give each a sign-in first.</p>
<table>${PEOPLE.map((p) => `<tr><td><a href="${p.file}">${esc(p.name)}</a></td><td>${md(p.focus)}<br><small>${md(p.rooms)} · ${p.tasks.length} tasks · ${esc(p.time)}</small></td></tr>`).join('')}</table>
<p><b>Only Mike runs Night Audit</b>, at the end, after telling the others.</p></body></html>`;
fs.writeFileSync(path.join(outDir, 'index.html'), index);
console.log(`Wrote ${PEOPLE.length} guides + index to docs/testers/friends`);
