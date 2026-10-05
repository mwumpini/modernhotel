# Hotel system test: 3 testers, 3 days

This test runs a small hotel for **three real days** with **three testers**. Each tester has their own part of the hotel. Each day builds on the day before, so you will see what the system does "tomorrow": room nights added overnight, guests due to leave, unpaid bills getting older, stock going down, and tax and payroll amounts adding up.

You do not need to know the system before you start. Every step says where to click and what you should see.

---

## Before you start (owner)

1. Use a hotel that has finished setup. Go to **⚙️ System Settings → Sample Data**. It must say **No sample data loaded**. If it shows old test records, press **Clear test data** first.
2. Give each tester their own login. Write down who is who:

| Tester | Name | Desk | Login |
| --- | --- | --- | --- |
| **A** | | Front desk, housekeeping, events, security | |
| **B** | | Stores, restaurant & bar, kitchen | |
| **C** | | Settings, HR & payroll, accounting, tax | |

3. Pick the three test days. Write the dates here. The script calls them **Day 1**, **Day 2** and **Day 3**.

| Day 1 | Day 2 | Day 3 |
| --- | --- | --- |
| | | |

---

## How to use this script

- **Do only your own letter.** Each step starts with **A**, **B** or **C**.
- **Wait** when a step says *wait for*. Another tester has to finish something first. Message them on WhatsApp (or call) when you finish a step that someone is waiting for. Those steps are marked **📣 Tell A / B / C**.
- **Use the exact names and amounts** in this script. The answer sheet at the end only works if everyone types the same thing.
- **Tick each step:** ✅ it did what the script says, ❌ it did not.
- **When something is wrong**, write down:
  1. the step number
  2. the screen (the menu on the left, and the tab at the top)
  3. what you typed
  4. what you expected, and what you saw
  5. any message on the screen. A phone photo of the screen is best.

  Then carry on with the next step if you can.

### Finding your way

- The **menu on the left** has the big areas: 🏨 Front Office Operations, 🍽️ Restaurant & Bar, 📦 Inventory & Stores, 🧾 Accounting & Finance, and so on. Click one to open it. The items under it open the screens.
- Most screens have **tabs along the top**. In this script, **Front Office Operations → Desk** means "click Front Office Operations on the left, then Desk".
- To add something, look for a button such as **+ New**, **Add** or **New …** at the top right of a list.
- If a screen looks out of date, press **Refresh** on the screen, or reload the page (**F5**).

### Words you will see

| Word | Meaning |
| --- | --- |
| **Folio** | A guest's bill: room nights, restaurant charges, and payments |
| **In house** | A guest who has checked in and not yet left |
| **Night audit** | The end-of-day close. It moves the hotel to the next business day and adds the next room night to every in-house guest |
| **Business date** | The day the hotel is working on. It changes when night audit runs, not at midnight |
| **On account** | A bill the guest or company will pay later. It shows as money owed to the hotel |
| **Receivable (AR)** | Money customers owe the hotel |
| **Payable (AP)** | Money the hotel owes suppliers |
| **WHT** | Withholding tax: tax one side keeps back from a payment and pays to GRA |
| **PO** | Purchase order: what we ask a supplier to deliver |
| **Requisition** | A department asking the store for stock |
| **Recipe** | What one dish uses from stock. Selling the dish takes those amounts off stock |
| **Till** | The cash drawer for one cashier's shift |
| **PAYE** | Income tax taken from staff pay |
| **Tier 1 / Tier 2** | SSNIT pension contributions |

### Taxes in this test

Room, food, drink and event prices in this test are **before tax**. The system adds tax on top:

| Tax | Rate | On |
| --- | --- | --- |
| VAT | 15% | everything sold |
| NHIL | 2.5% | everything sold |
| GETFund | 2.5% | everything sold |
| Tourism levy | 1% | rooms, food, drink, events |
| **Total** | **21%** | |

For example, a ₵200 room night comes to **₵242.00** (₵200 + ₵42 tax). If your hotel rounds bills, a total may be a few pesewas different.

---

# Day 1

## Day 1 morning: setting up (C first)

**C1. Rooms.** Go to **⚙️ System Settings → Rooms → Rooms & Pricing**.
1. Add three room types:
   - **Standard**, ₵200 a night
   - **Deluxe**, ₵350 a night
   - **Suite**, ₵600 a night
2. Add six rooms:
   - Standard: **101**, **102**, **103**
   - Deluxe: **201**, **202**
   - Suite: **301**
3. ✅ You should see all six rooms in the list, with the right type.

**C2. Stock places.** Go to **⚙️ System Settings → Stock → Stock Locations**.
1. You should see a main store, plus **Kitchen**, **Restaurant & Bar** and **Housekeeping**.
2. If there is no main store, add one called **Main Store**.

**C3. Bank and cash.** Go to **🧾 Accounting & Finance → Cash** (the **Bank & Cash** tab).
1. Add a bank account **GCB Bank** with an opening balance of **₵60,000**.
2. Check that a cash account for the front desk / cashier exists.
3. Write down its opening balance: ₵______

**C4. Tax rules are there.** Go to **⚖️ Compliance & Reports → Tax**.
1. You should see VAT 15%, NHIL 2.5%, GETFund 2.5%, Tourism 1%, the withholding taxes, and PAYE.
2. Open **PAYE**. The first band should be **₵588 at 0%**. These are the 2026 bands.
3. Do not change or delete anything.

**C5. 📣 Tell A and B:** "Rooms and stock places are ready."

---

## Day 1: Tester A (front desk)

*Wait for C5.*

**A1. Rooms look ready.** Go to **🛏️ Housekeeping & Maintenance → Floor**.
1. All six rooms should show and be **clean / vacant**.
2. If any room is dirty, mark it clean.

**A2. Clients.** Go to **🏨 Front Office Operations → Clients** and press **New Client** for each of these.

| Name | Type | Phone | Email |
| --- | --- | --- | --- |
| **Ama Mensah** | Person | 024 000 0001 | ama@test.com |
| **Kwame Asante** | Person | 024 000 0002 | kwame@test.com |
| **Akosua Darko** | Person | 024 000 0003 | akosua@test.com |
| **Kojo Badu** | Person | 024 000 0004 | kojo@test.com |
| **Volta Mining Ltd** | Company, with a TIN | 030 000 0005 | accounts@volta.test |

✅ Typing "Volta" in the search should find the company.

**A3. Reservations.** Go to **Front Office Operations → Desk** and open the **Reservations** tab. Press **New Reservation** and make these four:

| Guest | Room type | Arrive | Leave | Room |
| --- | --- | --- | --- | --- |
| Ama Mensah | Standard | Day 1 | Day 3 | 101 |
| Akosua Darko | Suite | Day 2 | Day 3 | 301 |
| Kojo Badu | Standard | Day 2 | Day 3 | (leave empty) |
| Esi Boateng, billed to **Volta Mining Ltd** | Deluxe | Day 1 | Day 3 | 202 |

✅ Ama's reservation should show 2 nights. Before tax that's ₵400; with tax it's **₵484.00**.

**A4. Ama checks in and pays a deposit.**
1. On **Desk**, open Ama's stay.
2. Under the payment, choose **Cash** and enter **₵242.00**. Press **Take payment**.
3. Press **Check in**.
4. ✅ Room **101** becomes occupied.
5. ✅ Her folio shows **one room night** (₵200 + ₵42 tax), payments ₵242.00, and outstanding **₵0.00**. Her second night is added tonight by night audit.

**A5. Walk-in who pays in full.** On **Desk**, press **Walk-in**.
1. Guest **Kwame Asante**, Deluxe, room **201**, leaving Day 2.
2. Take **Cash ₵423.50** (₵350 + ₵73.50 tax), then **Check in**.
3. ✅ Outstanding is **₵0.00**.

**A6. Company guest checks in.** Open Esi Boateng's reservation and press **Check in**. Take no payment; Volta Mining Ltd pays later.

**A7. Checked into the wrong room, then moved.**
1. **Walk-in:** guest **Yaw Owusu**, billed to **Volta Mining Ltd**, Standard, leaving Day 3. Put him in room **103** and check in.
2. Go to **Room Transfer**. Move Yaw from **103** to **102**.
   - Reason: **Checked into wrong room (desk error)**.
   - When it asks whether the guest used the room, answer **No**.
3. ✅ Room 102 is occupied by Yaw. Room 103 is back to available, not dirty.

**A8. Cancel a booking.** Open **Kojo Badu**'s reservation and **cancel** it (reason: guest called to cancel).
✅ It shows as cancelled, and room 301 / the Standard rooms are not held for him.

**A9. Event venue.** Go to **🎪 Events & Conferences → Venues** and add **Volta Hall**, capacity **100**.

**A10. Event booking with deposit.** Go to **Events & Conferences → Events** and create:
- **Event:** Volta Mining strategy workshop
- **Client:** Volta Mining Ltd
- **Venue:** Volta Hall
- **Date:** Day 2, 9:00–16:00
- **Guests:** 40
- **Package:** ₵150 per head, which is ₵6,000 before tax

Then:
1. ✅ The event total should be **₵7,260.00** (₵6,000 + 21% tax).
2. Take a **deposit of ₵3,000** by **bank transfer**.
3. ✅ It should show **₵4,260.00** still to pay.
4. Print or preview the **contract** and the **receipt**. ✅ Both open with the right names and amounts.

**A11. Security visitor.** Go to **🚨 Security Operations → Visitors** and log a visitor:
- Name: **Musah Ibrahim**, driver from **Accra Foods Ltd**
- Purpose: delivery
- Time in: now

Log him out when B says the delivery is in.

**A12. Housekeeping work.** Go to **Housekeeping & Maintenance → Floor**.
1. ✅ It should show 101, 201, 202 and 102 occupied, and 103, 301 vacant.
2. Go to **Work**. Add a task "Turn-down service" for room **202**, assign it to anyone, and mark it done.

---

## Day 1: Tester B (stores and restaurant)

*Wait for C5.*

**B1. Stock items.** Go to **📦 Inventory & Stores → Stock**. On the **Items** tab, add:

| Item | Unit | Cost price |
| --- | --- | --- |
| **Rice** | kg | ₵20.00 |
| **Chicken** | kg | ₵60.00 |
| **Cooking oil** | litre | ₵30.00 |
| **Coca-Cola 350ml** | bottle | ₵5.00 |
| **Toilet roll** | piece | ₵3.00 |

**B2. Suppliers.** On the **Suppliers** tab, add:
- **Accra Foods Ltd**, VAT registered, with a TIN
- **Kumasi Drinks Ltd**, VAT registered, with a TIN

**B3. Purchase orders.** On the **Purchase Orders** tab, raise two POs and send them.

**PO 1, to Accra Foods Ltd:**

| Item | Qty | Price | Line |
| --- | --- | --- | --- |
| Rice | 50 kg | 20 | 1,000.00 |
| Chicken | 20 kg | 60 | 1,200.00 |
| Cooking oil | 10 L | 30 | 300.00 |
| Toilet roll | 100 | 3 | 300.00 |
| **Total before tax** | | | **2,800.00** |

**PO 2, to Kumasi Drinks Ltd:** Coca-Cola, 48 bottles at ₵5, which is **₵240.00** before tax.

**B4. Receive the goods.** On the **Receive & Recon** tab, receive both POs in full into the **Main Store**.
✅ On the **Items** tab, Main Store shows:
- Rice 50
- Chicken 20
- Cooking oil 10
- Coca-Cola 48
- Toilet roll 100

📣 **Tell A** the delivery is in.

**B5. Supplier invoices.** On the **Invoices** tab, enter each supplier's invoice for what you received.

| Supplier | Before tax | VAT 15% | NHIL 2.5% | GETFund 2.5% | Total |
| --- | --- | --- | --- | --- | --- |
| Accra Foods Ltd | 2,800.00 | 420.00 | 70.00 | 70.00 | **3,360.00** |
| Kumasi Drinks Ltd | 240.00 | 36.00 | 6.00 | 6.00 | **288.00** |

✅ The tax lines match the table. There should be no tourism levy on purchases.

📣 **Tell C** the supplier invoices are in.

**B6. Stock to the bar (transfer).** On the **Transfers** tab, move **24 Coca-Cola** from Main Store to **Restaurant & Bar**.
✅ Main Store shows Coca-Cola 24, and Restaurant & Bar shows 24.

**B7. Stock to the kitchen (requisition, then issue).**
1. Go to **👨‍🍳 Kitchen → Supplies** and request **Rice 10 kg, Chicken 5 kg, Cooking oil 2 L**.
2. Go to **Inventory & Stores → Stock → Requisitions**. ✅ The same request is there. Approve it.
3. Go to the **Issues** tab and issue it.
4. ✅ Main Store shows Rice 40, Chicken 15, Oil 8.
5. ✅ Kitchen shows Rice 10, Chicken 5, Oil 2.

**B8. Menu.** Go to **🍽️ Restaurant & Bar → Menu** and add:
- **Jollof with Chicken**, ₵80.00, food
- **Coca-Cola**, ₵10.00, drink. Link it to the stock item **Coca-Cola 350ml**, so one sale uses one bottle.

**B9. Recipe.** Go to **Kitchen → Recipes** and make a recipe for **Jollof with Chicken**, linked to the menu dish:
- Rice **0.25 kg**
- Chicken **0.3 kg**
- Cooking oil **0.05 L**

✅ The recipe cost should be about **₵24.50** (5 + 18 + 1.50).

**B10. Open the till.** Go to **Restaurant & Bar → Cash** and open the till with a float of **₵200.00** cash.

**B11. Sales.** Go to **Restaurant & Bar → POS Terminal**.

| # | Order | Before tax | Tax | Total | Pay with |
| --- | --- | --- | --- | --- | --- |
| 1 | Dine-in: 2 Jollof + 2 Coca-Cola | 180.00 | 37.80 | **217.80** | Cash |
| 2 | 1 Jollof | 80.00 | 16.80 | **96.80** | **Bill to Room 101** (Ama Mensah) |
| 3 | Dine-in: 1 Jollof + 1 Coca-Cola | 90.00 | 18.90 | **108.90** | Mobile money |

Send each order to the kitchen first (**Send to kitchen**), then take payment.

**B12. Kitchen display.** Go to **Kitchen → Kitchen Display**.
1. ✅ All three tickets are there.
2. Move each one to **ready**, then **served**.

**B13. Stock went down.** Go to **Inventory & Stores → Stock → Items**, or check the stock levels on the Kitchen and Restaurant & Bar supply screens.
✅ After 4 Jollof and 3 Coca-Cola:
- Kitchen: Rice **9**, Chicken **3.8**, Oil **1.8**
- Restaurant & Bar: Coca-Cola **21**

**B14. Housekeeping stock.** Go to **Housekeeping & Maintenance → Supplies** and request **20 toilet rolls**. Then in **Inventory → Requisitions / Issues**, approve and issue them.
✅ Main Store shows Toilet roll **80**; Housekeeping shows **20**.

**B15. Close the till.** Go to **Restaurant & Bar → Cash** and close the till.
1. ✅ It should expect **₵417.80** cash (₵200 float + ₵217.80).
2. Count **₵417.80** and close it.
3. ✅ Mobile money ₵108.90 shows separately, not as cash.

📣 **Tell A** the till is closed.

---

## Day 1: Tester C (back office)

*Wait for C5.*

**C6. Staff.** Go to **👥 HR & Payroll → People** (the **Records** tab) and add five employees. Departments and positions can be anything sensible.

| Name | Job | Monthly basic | Allowance | Employment class | Residency |
| --- | --- | --- | --- | --- | --- |
| **Abena Kusi** | Front office manager | 4,000 | 500 | Regular | Resident |
| **Kofi Mensah** | Chef | 3,000 | 0 | Regular | Resident |
| **Adwoa Sarpong** | Room attendant | 1,200 | 100 | Regular | Resident |
| **Yaw Boakye** | Waiter | 800 | 0 | **Casual** | Resident |
| **John Smith** | General manager | 15,000 | 0 | Regular | **Non-resident** |

**C7. Staff loan.** Go to **HR & Payroll → Payroll → Staff debts**.
1. Give **Kofi Mensah** a salary advance of **₵500**, repaid in **one** instalment this month.
2. ✅ It shows ₵500 owing.

**C8. Petty cash.** Go to **Accounting & Finance → Cash**.
1. Fund petty cash with **₵500** from GCB Bank.
2. Spend **₵150** on **stationery**.
3. ✅ The petty cash balance is **₵350.00**.

**C9. Supplier bills reached accounting.** *Wait for B5.* Go to **Accounting & Finance → Payable**.
1. ✅ Accra Foods Ltd is owed **₵3,360.00**.
2. ✅ Kumasi Drinks Ltd is owed **₵288.00**.

**C10. Equipment purchase (fixed asset).**
1. In **Payable**, enter a bill from a new supplier **Tema Equipment Ltd** (VAT registered): **Laundry machine**, ₵4,000.00 + 20% tax = **₵4,800.00**.
2. Go to the **PPE & Assets** tab and add the laundry machine as an asset:
   - Cost ₵4,000
   - Bought Day 1
   - Class 2 (machinery), 30% a year
3. ✅ It shows in the asset register with cost ₵4,000.

**C11. Event deposit reached accounting.** *Wait for A10.* Go to **Accounting & Finance → Receivable**.
1. ✅ Volta Mining Ltd's event invoice shows **₵7,260.00**, with **₵3,000.00** received and **₵4,260.00** still owed.
2. ✅ The ₵3,000 shows on **Receipts**.

**C12. Restaurant and desk money reached accounting.** *Wait for B15.*
1. ✅ **Receipts:** Ama ₵242.00 cash, Kwame ₵423.50 cash, the restaurant cash sale ₵217.80, and the mobile money sale ₵108.90.
2. ✅ The room-bill Jollof (₵96.80) is not a receipt. It's on Ama's bill.

---

## Day 1: end of day (A)

*Wait for B15 (till closed).*

**A13. Night audit.** Go to **Front Office Operations → Night** (Night Audit).
1. Read the business date. It should be **Day 1**.
2. ✅ The in-house count is **4**: Ama, Kwame, Esi, Yaw.
3. Press **Close** (or **Catch up** if the screen asks).
4. ✅ The business date changes to **Day 2**.

If the system already ran night audit by itself, write down the time it ran and carry on.

---

# Day 2: "what happens tomorrow"

## Day 2: Tester A

**A14. The overnight changes.** Go to **Front Office Operations → Desk**.
1. ✅ The business date is **Day 2**.
2. ✅ **Departures today** lists **Kwame Asante**.
3. ✅ **Arrivals today** lists **Akosua Darko**, and not Kojo Badu (cancelled).
4. Open **Ama**'s folio. ✅ It now has **two room nights**. Charges are ₵484.00 + Jollof ₵96.80 = **₵580.80**; paid ₵242.00; outstanding **₵338.80**.
5. Open **Esi** and **Yaw**. ✅ Each has two room nights:
   - Esi: ₵847.00
   - Yaw: ₵484.00

**A15. Kwame checks out.** Open his stay and press **Check out**.
1. ✅ Outstanding is ₵0.00, so checkout goes straight through.
2. ✅ Room **201** goes to dirty / to be cleaned.

**A16. Housekeeping cleans 201.** Go to **Housekeeping & Maintenance → Floor**.
1. Mark **201** cleaned and inspected.
2. ✅ It shows available again.

**A17. Maintenance job.** Go to **Housekeeping & Maintenance → Work** and log a maintenance request: "Air conditioner leaking", room **202**, priority medium.
✅ It shows as open.

**A18. Akosua arrives.** Open Akosua's reservation and **check in** to **301**. Take no payment yet.
✅ Her folio shows one Suite night: ₵600 + ₵126 tax = **₵726.00**.

**A19. The event happens.** Go to **Events & Conferences → Events** and open the Volta Mining workshop.
1. Mark it as in progress or held, if the screen has that.
2. ✅ The balance still shows **₵4,260.00**.

**A20. Security incident.** Go to **🚨 Security Operations → Incidents** and log "Guest lost key card, room 201", severity low. Close it with a note "card replaced".

**A21. End of day: night audit.** *Wait for B's Day 2 till close (B21).* Go to **Night**.
1. ✅ In-house is **4**: Ama, Esi, Yaw, Akosua.
2. Close the day. ✅ The business date is **Day 3**.

## Day 2: Tester B

**B16. Open the till** with a ₵200 float.

**B17. Sale paid by card.** On **POS Terminal**: dine-in, **3 Jollof + 3 Coca-Cola** = ₵270.00 + ₵56.70 tax = **₵326.70**. Pay by **card**.

**B18. A mistake that is voided.**
1. Ring up **1 Coca-Cola** by mistake and send it, then **void** it. Give the reason "wrong order"; the system may ask a manager to approve.
2. ✅ It shows as void.
3. ✅ It is not in the day's sales.
4. ✅ It did **not** take a bottle off stock.

**B19. Stock after Day 2.**
✅ Kitchen:
- Rice **8.25**
- Chicken **2.9**
- Oil **1.65**

✅ Restaurant & Bar: Coca-Cola **18**.

**B20. Low-stock check.** Go to **Inventory & Stores → Stock**. Note whether Chicken in the kitchen shows as low. If there is a reorder level, set Chicken's to **3 kg** and check the alert appears.

**B21. Close the till.** ✅ Expected cash is **₵200.00** (no cash sales today). The card ₵326.70 shows separately.
📣 **Tell A**.

## Day 2: Tester C

**C13. Pay the suppliers, keeping withholding tax.** Go to **Accounting & Finance → Payable**.

| Supplier | Invoice | Withhold | Pay from GCB Bank |
| --- | --- | --- | --- |
| Accra Foods Ltd | 3,360.00 | WHT goods 3% of 2,800 = **84.00** | **3,276.00** |
| Tema Equipment Ltd | 4,800.00 | WHT goods 3% of 4,000 = **120.00** | **4,680.00** |
| Kumasi Drinks Ltd | 288.00 | none (under ₵2,000) | **288.00** |

For Accra Foods and Tema Equipment, turn on **Withhold tax (WHT)** when you record the payment.

1. ✅ Each supplier's balance goes to **₵0.00**. The withholding counts as paid.
2. ✅ GCB Bank goes down only by what you actually paid: ₵8,244.00 in total.

**C14. Overtime and leave.**
1. Go to **HR & Payroll → Time → Overtime**. Record **20 hours** of overtime for **Adwoa Sarpong** this month, and approve it.
2. Go to **HR & Payroll → Leave**. Enter a 2-day leave request for Adwoa next week, and approve it.
   ✅ It shows on **Who's Off** for those days.

**C15. Who owes us, one day later.** Go to **Accounting & Finance → Receivable → Who owes us**.
✅ Volta Mining Ltd shows the event balance **₵4,260.00** under **Current**.

**C16. A manual journal.** Go to **Accounting & Finance → Books → Journal**.
1. Record bank charges of **₵25.00**:
   - Debit: bank charges expense
   - Credit: GCB Bank
2. ✅ The journal balances and posts.

---

# Day 3

## Day 3: Tester A

**A22. Morning check.**
1. ✅ The business date is **Day 3**.
2. ✅ Departures today: **Ama, Esi, Yaw, Akosua**.
3. ✅ Akosua's folio has **one** night only (she arrived Day 2).

**A23. Ama pays the rest and leaves.**
1. Take **mobile money ₵338.80**.
2. ✅ Outstanding is ₵0.00.
3. Check her out.

**A24. Akosua pays by card and leaves.**
1. Take **card ₵726.00**.
2. Check her out.

**A25. The company leaves the bill on account.** Open **Esi** and then **Yaw**.
1. For each, turn on **Leave the balance on account** and **Check out**.
2. ✅ The confirm screen says the balance stays on Volta Mining Ltd's account.
3. ✅ The company's total on account is **₵1,331.00** (₵847.00 + ₵484.00).
4. 📣 **Tell C**.

**A26. Event balance paid.** Take the event balance **₵4,260.00** by **bank transfer**.
✅ The event shows fully paid.

**A27. Close the maintenance job.** Go to **Housekeeping & Maintenance → Work**. Close the room 202 air-conditioner request, with a note "fixed".

**A28. Housekeeping after checkout.** Go to **Housekeeping & Maintenance → Floor**.
1. ✅ 101, 102, 202 and 301 show dirty.
2. Clean them all.
3. ✅ All six rooms are available.

**A29. Front office reports.** Go to **Front Office Operations → Reports & Analysis**. ✅ You can find:
- 4 stays with revenue, and occupancy of **4 of 6 rooms** on Day 1 and on Day 2
- Kojo Badu cancelled
- Yaw's room move, with its reason
- Ama, Kwame and Akosua paid in full
- Volta Mining owing ₵1,331.00 until C records the payment

**A30. Events and security reports.**
1. ✅ **Events & Conferences → Reports & Analysis** shows the workshop: ₵7,260.00 billed and ₵7,260.00 paid.
2. ✅ **Security Operations → Reports & Analysis** shows the visitor and the incident.

## Day 3: Tester B

**B22. Stock count.** Go to **Kitchen → Supplies** (stock count) and count the kitchen.
1. Enter **Rice 8.25**, **Oil 1.65**, and **Chicken 2.7** (0.2 kg is missing).
2. ✅ The count shows a **shortage of 0.2 kg chicken**, worth about **₵12.00**.
3. Post it.
4. ✅ Kitchen chicken is now **2.7**.

**B23. Restaurant reports.** Go to **Restaurant & Bar → Reports & Analysis**. ✅ Over the three days:
- **7 Jollof** and **6 Coca-Cola** sold
- One voided Coca-Cola
- Sales before tax **₵620.00**, tax **₵130.20**, total **₵750.20**
- Paid by: cash ₵217.80, mobile money ₵108.90, card ₵326.70, and ₵96.80 billed to a room

**B24. Inventory reports.** Go to **Inventory & Stores → Reports & Analysis**. ✅ The movements show:
- Received: Rice 50, Chicken 20, Oil 10, Coca-Cola 48, Toilet roll 100
- Transferred: 24 Coca-Cola
- Issued: kitchen and housekeeping
- Sold through recipes
- The 0.2 kg count shortage

**B25. Final stock.**

| Item | Main Store | Kitchen | Restaurant & Bar | Housekeeping |
| --- | --- | --- | --- | --- |
| Rice | 40 | 8.25 | | |
| Chicken | 15 | 2.7 | | |
| Cooking oil | 8 | 1.65 | | |
| Coca-Cola | 24 | | 18 | |
| Toilet roll | 80 | | | 20 |

## Day 3: Tester C

**C17. The company pays, keeping withholding tax.** *Wait for A25.* Go to **Receivable → Invoices** and open Volta Mining Ltd's room bill (₵1,331.00).
1. Record a receipt of **₵1,248.50** by bank transfer to GCB Bank.
2. Enter the withholding the company kept: **WHT 7.5% of ₵1,100 = ₵82.50**. You may leave the GRA certificate number empty for now.
3. ✅ The invoice is fully settled (₵1,248.50 + ₵82.50 = ₵1,331.00).
4. ✅ **Tax certificates** lists ₵82.50.
5. Add certificate number **WHT-TEST-001**. ✅ The same certificate updates; no second one appears.

**C18. Run payroll.** Go to **HR & Payroll → Payroll → Run** and process **this month**. Check every line against this table:

| Employee | Gross | Tier 1 (5.5%) | Tax | Kind of tax | Net pay |
| --- | --- | --- | --- | --- | --- |
| Abena Kusi | 4,500.00 | 220.00 | 674.50 | PAYE | 3,605.50 |
| Kofi Mensah | 9,000.00 *(incl. ₵6,000 bonus, added in the run)* | 165.00 | 750.73 | PAYE 480.73 + bonus tax 5% 270.00 | 8,084.27 − 500.00 advance = **7,584.27** |
| Adwoa Sarpong | 1,507.60 *(incl. 20 h overtime ₵207.60)* | 66.00 | 105.93 | PAYE 95.55 + overtime tax 5% 10.38 | 1,335.67 |
| Yaw Boakye | 800.00 | 44.00 | 40.00 | casual worker 5% | 716.00 |
| John Smith | 15,000.00 | 825.00 | 3,543.75 | non-resident 25% | 10,631.25 |
| **Total** | **30,807.60** | **1,320.00** | **5,114.91** | | **23,872.69** |

How the special rates work:
- **Kofi's bonus:** ₵5,400 of it (15% of his yearly basic) is taxed at 5%. The rest goes through the normal PAYE bands.
- **Adwoa's overtime:** she earns under ₵18,000 a year, so her overtime is taxed at 5%.
- **Yaw** (casual) pays a flat 5%.
- **John** (non-resident) pays a flat 25%.

When the run asks for adjustments, add Kofi's **₵6,000 bonus** to his line.

The employer also pays:
- **Tier 1 (8%):** ₵1,920.00
- **Tier 2 (5%):** ₵1,200.00

**C19. Approve and pay payroll.**
1. Approve the month, then mark it paid from GCB Bank.
2. ✅ GCB Bank goes down by the net pay, **₵23,872.69**.
3. ✅ Kofi's staff advance shows **₵0.00** owing.

**C20. Payroll taxes.** Go to **⚖️ Compliance & Reports → Payroll** (or **HR → Compliance → Tax**).
✅ For this month:
- PAYE and other income tax: **₵5,114.91**
- Tier 1 to SSNIT: **₵3,240.00** (₵1,320 staff + ₵1,920 employer)
- Tier 2: **₵1,200.00**

**C21. Bank reconciliation.** Go to **Accounting & Finance → Cash → Bank & Cash** (reconciliation) for **GCB Bank**. Tick off each of these movements:

| Movement | Amount |
| --- | --- |
| Opening balance | +60,000.00 |
| Petty cash funding | −500.00 |
| Event deposit | +3,000.00 |
| Supplier payments | −3,276.00, −4,680.00, −288.00 |
| Bank charges | −25.00 |
| Event balance | +4,260.00 |
| Volta Mining room bill | +1,248.50 |
| Payroll | −23,872.69 |

✅ If card and mobile money also land in GCB Bank, add them too: +726.00, +326.70, +338.80, +108.90.
✅ Without card and mobile money, GCB Bank ends at **₵35,866.81**.

**C22. Taxes due.** Go to **Accounting & Finance → Taxes**, and **⚖️ Compliance & Reports → Tax** (reports and filing). Check against the answer sheet below:
- Sales taxes collected (output)
- Taxes paid on purchases (input)
- Amount due to GRA
- WHT we kept from suppliers
- WHT the customer kept from us

**C23. Statements.** Go to **Accounting & Finance → Statements**.
1. ✅ **Trial balance:** total debits equal total credits.
2. ✅ **Profit and loss** shows:
   - Room revenue ₵2,450.00
   - Food & drink ₵620.00
   - Events ₵6,000.00, so total revenue **₵9,070.00**
   - Cost of food and drink about ₵201.50, plus the ₵12.00 chicken shortage
   - Salaries ₵30,807.60 plus employer pension ₵3,120.00
   - Stationery ₵150.00
   - Bank charges ₵25.00
3. ✅ **Balance sheet** shows:
   - The laundry machine ₵4,000.00 under fixed assets
   - GCB Bank, petty cash ₵350.00, and the cash drawers
   - Stock on hand
   - Taxes owed to GRA
4. Run depreciation for the month if the screen offers it. ✅ About **₵100.00** (₵4,000 × 30% ÷ 12).

**C24. Owner's view.** Go to **🏛️ Executive Management → Main Dashboard**.
✅ Revenue, occupancy, receipts and payroll match the desks. It should not look like an empty hotel.

**C25. Activity log.** Go to **Accounting & Finance → Activity log**, and **⚙️ System Settings → Audit Log**.
✅ The voided Coca-Cola, the room move, the cancelled booking, the supplier payments and the payroll approval each show who did them and when.

---

# Answer sheet (C checks, everyone can use)

### What the hotel sold (before tax)

| | Amount |
| --- | --- |
| Rooms: Ama 400, Kwame 350, Esi 700, Yaw 400, Akosua 600 | 2,450.00 |
| Restaurant & bar: 7 Jollof × 80 + 6 Coca-Cola × 10 | 620.00 |
| Event: 40 × 150 | 6,000.00 |
| **Total** | **9,070.00** |

### Sales taxes collected (output)

| Tax | Calculation | Amount |
| --- | --- | --- |
| VAT | 15% × 9,070 | 1,360.50 |
| NHIL | 2.5% × 9,070 | 226.75 |
| GETFund | 2.5% × 9,070 | 226.75 |
| Tourism levy | 1% × 9,070 | 90.70 |
| **Total** | | **1,904.70** |

### Taxes paid on purchases (input, claimable)

| Supplier | VAT | NHIL | GETFund |
| --- | --- | --- | --- |
| Accra Foods Ltd | 420.00 | 70.00 | 70.00 |
| Kumasi Drinks Ltd | 36.00 | 6.00 | 6.00 |
| Tema Equipment Ltd | 600.00 | 100.00 | 100.00 |
| **Total** | **1,056.00** | **176.00** | **176.00** |

### Amount due to GRA for VAT and levies

| Tax | Output | Input | Due |
| --- | --- | --- | --- |
| VAT | 1,360.50 | 1,056.00 | **304.50** |
| NHIL | 226.75 | 176.00 | **50.75** |
| GETFund | 226.75 | 176.00 | **50.75** |
| Tourism levy (not claimable; goes to the Ghana Tourism Authority) | 90.70 | — | **90.70** |

### Withholding tax

| | Amount |
| --- | --- |
| Kept from suppliers, to pay to GRA: Accra Foods 84.00 + Tema Equipment 120.00 | **204.00** |
| Kept from us by Volta Mining (credit for the hotel) | **82.50** |

### Payroll, this month

| | Amount |
| --- | --- |
| Gross pay | 30,807.60 |
| PAYE and other income tax due | **5,114.91** |
| Tier 1 due to SSNIT: 1,320.00 + 1,920.00 | **3,240.00** |
| Tier 2 due to trustee | **1,200.00** |
| Net pay to staff (after Kofi's ₵500 advance) | 23,872.69 |

### Money received

| Method | Detail | Amount |
| --- | --- | --- |
| Cash | Ama 242.00 + Kwame 423.50 + restaurant 217.80 | 883.30 |
| Mobile money | Ama 338.80 + restaurant 108.90 | 447.70 |
| Card | Akosua 726.00 + restaurant 326.70 | 1,052.70 |
| Bank transfer | event 3,000.00 + 4,260.00, Volta 1,248.50 | 8,508.50 |
| **Total** | | **10,892.20** |

Check: everything billed (₵9,070 + ₵1,904.70 = ₵10,974.70) minus the WHT the company kept (₵82.50) = **₵10,892.20**. Nobody should owe the hotel anything at the end of Day 3.

### Rooms

| | Rooms occupied | Occupancy |
| --- | --- | --- |
| Night of Day 1 | 4 of 6 | 66.7% |
| Night of Day 2 | 4 of 6 | 66.7% |

---

# What "connected" means

If one screen has it and the other doesn't, the step fails.

| Done here | Must also show here |
| --- | --- |
| Room added in Settings | Front Office, Housekeeping |
| Checkout | Room goes to Housekeeping as dirty; paid bill clears from Receivable |
| Balance left on account | Receivable → Who owes us, until C records the payment |
| POS **Bill to Room** | That guest's folio |
| Restaurant sale | Stock goes down through the recipe or the 1:1 drink link |
| Voided sale | No sale and no stock taken |
| Stock received in Inventory | Supplier bill in Payable |
| WHT on supplier payment | Supplier fully paid; WHT on the tax report |
| WHT kept by a customer | Receivable invoice settled; listed under Tax certificates |
| Event deposit and balance | Event folio, Receivable, Receipts |
| Payroll approved | Bank, Compliance → Payroll, Statements |
| Night audit | Next room night on every in-house guest; business date moves on |

---

# After the test

1. Each tester sends the owner this script with ✅ / ❌ ticks and their notes.
2. The owner can wipe the test with **⚙️ System Settings → Sample Data → Clear test data**. Settings, rooms, menu, stock items, tax rules and logins stay.
