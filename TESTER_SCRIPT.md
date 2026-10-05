# Hotel system tester script

Use this on a **new hotel** that has finished setup and has **no sample data**. Do not press **Settings → Sample Data → Load sample data**. If that screen says sample data is loaded, stop and tell the owner before you continue.

Work in order. Later desks depend on rooms, clients, and money created earlier. Write down every name and amount. When something fails, note the screen, the name, the amount, and the exact message.

Log in with the account you were given. If the setup wizard opens, do section 1. If the hotel is already set up, start at section 2 and confirm the company, currency, and tax scheme match Ghana.

## How to mark a step

- **Pass:** the screen shows what the step says you should see.
- **Fail:** you cannot finish the step, a number does not match what you wrote down, or a desk that should show the same guest or bill does not.

---

## 1. First setup only

1. Country **Ghana**. Currency should become **GHS** (₵).
2. Enter the hotel legal name, a phone number, an email, and a TIN.
3. Tax scheme: **Ghana Standard (NHIL+GETFund+Tourism+VAT)**.
4. Leave invoice and receipt numbering as offered, unless the owner gave other prefixes.
5. Press **Complete Setup**.

You should land in the hotel with an empty front desk: no guests, no stays, no bills.

## 2. Confirm the blank hotel

1. **Settings → Sample Data** says **No sample data loaded**. Leave it that way.
2. Open **Accounting & Finance → Books**. The chart of accounts should already be there. **Receivable** and **Payable** should have no invoices and no receipts.
3. Open **Compliance & Reports → Tax rules**. Ghana VAT, NHIL, GETFund, tourism levy, withholding, and PAYE should already be listed. Do not delete them.
4. Open **Front Office → Clients**, **Reservations**, and **Desk**. All three should be empty of real stays.

## 3. Rooms the other desks will use

**Settings → Rooms & Pricing**

1. Add one room type, for example **Standard**, with a nightly rate you will remember (use **₵200**).
2. Add two rooms of that type, for example **101** and **102**.
3. Open **Housekeeping → Floor**. Both rooms should appear and be ready to sell (clean / vacant). If a room is dirty, mark it clean before you sell it.

## 4. Front office: person who pays in full

Use the name **Ama Test**.

1. **Front Office → Clients → New Client**. Type is a person. Save Ama Test with a phone number and an email. Search should find her.
2. **Reservations → New Reservation**. Add Ama Test, room type Standard, arrival today, departure tomorrow, room **101**. Save.
3. **Desk → Check-in**. Open Ama’s stay. Write down **Total charges** and **Outstanding**.
4. Payment method **Cash**. Amount = about half of Outstanding. Press **Take payment**. Total payment shows that half. Outstanding shows the rest. She is not in house yet.
5. Press **Check in**. Room **101** is occupied. **Housekeeping → Floor** shows 101 occupied.
6. Open the stay again under **In-house**. Pay the rest with **Take payment**. Outstanding is **₵0.00**.
7. Press **Check out**, then confirm. She leaves the in-house list. Room **101** is no longer occupied. Housekeeping can show it dirty.

**Invoices & Payments:** Ama is paid, outstanding **₵0.00**.

## 5. Front office: company that pays part and leaves the rest

Use the name **Test Company Ltd**.

1. **Clients → New Client**. Choose a company. Save **Test Company Ltd**.
2. **Desk → Walk-in**. Add the company, or a guest billed to that company, into room **102**, arriving today and leaving tomorrow. Finish so the guest is **in house**.
3. Open the stay. Take a **Cash** payment for only part of the bill. Outstanding stays above zero.
4. Turn on **Leave the balance on account**. Press **Check out**.
5. The confirm screen says the remaining amount stays on account, and checkout completes.

**Invoices & Payments:** Test Company Ltd is partly paid. The amount you left is still outstanding.

## 6. Accounting must show the same front-office money

**Accounting → Accounts Receivable**

1. **Receipts:** Ama’s payments and the company’s part payment are both there. Amounts match what you wrote down.
2. **Invoices** and **Who owes us:** Ama is not still owed. Test Company Ltd still shows the amount left on account.
3. **Accounting → Bank & Cash** (or the cash register used by the desk): the cash you took appears. It matches the receipts, not the amount left on the company account.

## 7. Customer withholding (the company kept tax)

Still on Test Company Ltd’s open invoice.

1. **Accounts Receivable → Invoices**. Open the company invoice that still has a balance.
2. Record the receipt for the **cash you actually receive now**, and enter the withholding the customer deducted (WHT, and WHT-VAT if the screen asks).
3. You may save the withholding **without** a GRA certificate number.
4. Open **WHT Certificates**. The withholding is listed. Outstanding on that invoice drops by the cash plus the withholding, not by the cash alone.
5. If you add the certificate number afterwards, the same certificate updates. It does not create a second one.

## 8. Restaurant, kitchen, and the guest’s bill

Leave one guest in house for this. If both test stays are already checked out, walk in a third guest, **Kofi Test**, into a free room and do not check him out yet.

1. **Restaurant & Bar → Menu**. Add one dish, for example **Jollof**, with a price you will remember.
2. **Restaurant & Bar → Cashiering** (or the POS button **Open the till**). Open the till. Cash and card sales need an open till.
3. **POS Terminal**. Send one Jollof to the kitchen (**Send to kitchen**).
4. **Kitchen → Kitchen Display**. The Jollof ticket is there. Move it to ready.
5. On the POS, pay that order with **Bill to Room** and choose Kofi’s room.
6. **Front Office → Desk**, open Kofi. **Open the folio**. The Jollof charge is on his bill. Outstanding includes it.
7. Take a cash payment on a **second** order (not billed to a room). **Restaurant → Reports** and **Accounting → Receipts** both show that cash sale.

## 9. Stores, supplier bill, and withholding we keep

1. **Settings → Stock Locations**. Confirm a store location exists. Add **Main Store** if the list is empty.
2. **Inventory → Items**. Add one stock item, for example **Cooking oil**, tracked in Main Store.
3. **Suppliers**. Add **Test Supplier Ltd**.
4. **Purchase Orders**. Raise a small PO for cooking oil from that supplier. Send it.
5. **Receive & Recon**. Receive the goods. Main Store quantity goes up by the quantity received.
6. **Invoices**. Enter the supplier invoice for that receipt. Tax lines should show the purchase taxes from Compliance, not a single made-up percent.
7. **Accounting → Accounts Payable**. The supplier invoice is owed.
8. **Record Payment** for that invoice. Turn on **Withhold tax (WHT)**. If you are a withholding VAT agent, turn on **Withhold VAT** as well. Pay the **net** (invoice minus what you withhold).
9. The supplier balance falls by the full invoice, not only by the cash. The cash register falls by the net only.
10. **Accounting → Taxes** (or **Compliance → Reports & Filing**): the withholding you kept appears under tax withheld from suppliers.

## 10. A department asks stores for stock

1. **Housekeeping → Supplies** (or **Restaurant → Supplies**). Raise a requisition for cooking oil.
2. **Inventory → Requisitions**. The same request is there.
3. Issue the stock. Main Store quantity goes down. The department supply screen shows the issue.

## 11. Events

1. **Events → Venues → New Venue**. Add **Test Hall**.
2. **Events**. Create an event for Test Hall, with a client and a total you write down.
3. Take a **deposit** (part of the total) and leave a balance.
4. **Front Office** does not need a room for this. **Accounting → Accounts Receivable** shows the event invoice: deposit received, balance still owed.
5. Take the balance. The event invoice outstanding becomes **₵0.00**.

## 12. Payroll withholdings

1. **HR → People → Add Employee**. One employee, with a monthly basic salary.
2. **HR → Payroll → Process payroll** for the current month.
3. The payslip (or payroll line) shows **PAYE** and **SSNIT** taken off the pay. Net pay is less than gross.
4. **Compliance → Payroll tax** shows that same PAYE and SSNIT for the month. The figures match the payroll run.

## 13. Housekeeping and security after the stay

1. After Ama’s checkout, **Housekeeping → Floor** shows room **101** dirty (or waiting to be cleaned).
2. Mark **101** clean. **Front Office → Rooms** can sell **101** again.
3. **Security → Visitors**. Log one visitor for the hotel. **Security → Reports** includes that visit.

## 14. Night audit

Do this while **Kofi Test** is still in house.

1. **Front Office → Night Audit**. Read the business date and the in-house count. The count includes Kofi.
2. Press **Close** (or **Catch up** if the button says the audit is behind).
3. Open Kofi’s folio. A room charge for the closed night is on the bill.
4. **Accounting** shows that room charge as well. Pay Kofi in full and check him out. Outstanding returns to **₵0.00** and checkout is allowed.

## 15. Reports must agree

Open each **Reports & Analysis** and confirm today’s test activity is there. Empty reports, or a report that omits a payment you can see on the desk, is a fail.

| Desk | What must show |
| --- | --- |
| Front Office reports | Ama paid in full, Test Company Ltd still owing the amount you left, Kofi’s room charge |
| Restaurant reports | Jollof sent and the cash sale |
| Inventory reports | Cooking oil received, then issued |
| Events reports | Test Hall event, deposit, then the balance |
| HR reports | The payroll run |
| Accounting reports | The same receipts, the company balance, the supplier payment, and the withholdings |
| Accounting statements | A statement opens (trial balance or profit and loss) and includes today’s room, restaurant, and supplier figures |
| Compliance reports | Sales taxes from the guest and restaurant bills, WHT kept from the supplier, WHT the company deducted, and payroll PAYE / SSNIT |
| Executive Management | Rooms and today’s activity match the desks, not an empty hotel |

## 16. What “connected” means

These are the links to check. If one side has the guest and the other does not, that step fails.

- A room created in **Settings** is the same room on **Front Office** and **Housekeeping**.
- A checkout frees the room for housekeeping and, when the bill is paid, clears it in **Accounts Receivable**.
- A part payment left on account stays in **Who owes us** after checkout.
- **Bill to Room** on the POS adds the dish to that guest’s folio.
- A supplier invoice in **Inventory** is the same bill in **Accounts Payable**.
- Withholding on a supplier payment reduces what we pay and shows on the tax report.
- Withholding a customer deducts reduces what they pay and shows on **WHT Certificates**.
- Payroll PAYE and SSNIT show again under **Compliance → Payroll tax**.
