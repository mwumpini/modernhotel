# Accounting Auto-Capture System - Complete Implementation

## ✅ Implementation Complete

All revenue-generating departments now automatically capture transactions to the accounting system. When any operational transaction occurs, the system automatically:

1. **Creates Sales Invoices** in Accounts Receivable
2. **Records to Revenue Centers** with budget tracking
3. **Posts Journal Entries** to General Ledger (double-entry)
4. **Creates Receipts** when payments are received
5. **Updates AR balances** and partner accounts
6. **Maintains complete audit trail**

---

## Integration Points

### 1. Front Office (Room Revenue) ✅

**File**: `src/app/lib/frontoffice/helpers/folio.ts`

**When charges are posted to guest folios:**
- Auto-creates Sales Invoice with guest details
- Records revenue to **Room Revenue (RM)** center
- Posts GL journal entry:
  - **Debit**: Accounts Receivable (1200)
  - **Credit**: Room Revenue (4100)
  - **Credit**: Tax Payable (2100) if applicable

**When payments are received:**
- Auto-creates Receipt
- Updates Invoice paid amount
- Posts GL journal entry:
  - **Debit**: Cash/Bank (1000/1100)
  - **Credit**: Accounts Receivable (1200)

### 2. Restaurant ✅

**File**: `src/app/components/FBPOS.tsx`

**When POS sales are processed:**
- Auto-creates Sales Invoice
- Records revenue to **Restaurant Revenue (REST)** center
- Auto-creates Receipt for immediate payment
- Posts GL entries for both revenue and payment

### 3. Bar ✅

**File**: `src/app/components/FBPOS.tsx`

**When bar sales are processed:**
- Auto-creates Sales Invoice
- Records revenue to **Bar Revenue (BAR)** center
- Auto-creates Receipt for immediate payment
- Posts GL entries for both revenue and payment

### 4. Room Service ✅

**File**: `src/app/components/FBPOS.tsx`

**When room service orders are processed:**
- Auto-creates Sales Invoice
- Records revenue to **Room Service Revenue (RS)** center
- Posts GL entries

### 5. Conference/Events ✅

**File**: `src/app/components/EventsConferencesMainDashboard.tsx`

**When events are confirmed:**
- Auto-creates Sales Invoice for total booking value
- Records revenue to **Conference Revenue (CF)** center
- If deposit paid, auto-creates Receipt
- Posts GL entries

**When folio charges/payments are added:**
- Auto-captures revenue for charges
- Auto-creates receipts for payments
- Posts appropriate GL entries

---

## GL Account Mapping

| Department | Revenue GL | Revenue Center |
|------------|------------|----------------|
| Front Office | 4100 - Room Revenue | RM |
| Restaurant | 4200 - F&B Revenue | REST |
| Bar | 4200 - F&B Revenue | BAR |
| Room Service | 4200 - F&B Revenue | RS |
| Conference | 4300 - Conference Revenue | CF |

---

## Automatic Journal Entries

### Revenue Capture (for each sale)
```
Dr: 1200 - Accounts Receivable     [Total Amount]
    Cr: 4xxx - Revenue Account     [Subtotal]
    Cr: 2100 - Tax Payable         [Tax Amount]
```

### Payment Capture (for each receipt)
```
Dr: 1000/1100 - Cash/Bank          [Amount]
    Cr: 1200 - Accounts Receivable [Amount]
```

---

## Detailed Logging

All accounting operations now log detailed information:

### Revenue Center Recording
```javascript
[Accounting] 💰 Revenue Recorded: {
  revenueCenter: "Restaurant Revenue (REST)",
  amount: "GHS 450",
  previousTotal: "GHS 12,500",
  newTotal: "GHS 12,950",
  target: "GHS 200,000",
  variance: "GHS -187,050",
  achievement: "6.5%",
  timestamp: "2026-01-07T10:30:00.000Z"
}
```

### Invoice Creation
```javascript
[Accounting] 📄 Invoice Created: {
  invoiceNumber: "REST-2026-123456",
  type: "Sales",
  customer: "Walk-in Customer",
  subtotal: "GHS 400",
  tax: "GHS 50",
  total: "GHS 450",
  status: "Posted",
  source: "restaurant",
  timestamp: "2026-01-07T10:30:00.000Z"
}
```

### Receipt Creation
```javascript
[Accounting] 🧾 Receipt Created: {
  paymentNumber: "REST-RCP-2026-123456",
  type: "Receipt",
  party: "Walk-in Customer",
  amount: "GHS 450",
  method: "Cash",
  invoiceId: "INV-REST-123456",
  source: "restaurant",
  timestamp: "2026-01-07T10:30:00.000Z"
}
```

### Journal Entry Creation
```javascript
[Accounting] 📒 Journal Entry Created: {
  entryNumber: "JE-2026-123456",
  description: "Auto-posted: Restaurant Sale - Table 5",
  totalDebit: "GHS 450",
  totalCredit: "GHS 450",
  balanced: "✓ Balanced",
  lineCount: 2,
  accounts: "1200: Dr 450 / Cr 0, 4200: Dr 0 / Cr 450",
  timestamp: "2026-01-07T10:30:00.000Z"
}
```

---

## Integration Module API

**File**: `src/app/lib/accounting/integration.ts`

### captureRevenue(transaction)
Captures revenue from any department. Creates Sales Invoice, records to revenue center, posts GL entry.

### capturePayment(transaction, source)
Captures payment/receipt. Creates Receipt, updates Invoice, posts GL entry.

### captureCompleteSale(revenue, payment)
For POS-style transactions where payment is immediate. Combines revenue and payment capture in one call.

### getDepartmentAccountingSummary(source)
Returns summary of invoices, receivables, and receipts for a department.

---

## Benefits

1. **Zero Manual Data Entry**: All transactions auto-capture
2. **Real-Time Financial Visibility**: AR, revenue, and cash updated instantly
3. **Accurate Receivables Tracking**: Know exactly what's owed
4. **Complete Audit Trail**: Every transaction tracked with source
5. **Budget vs Actual**: Revenue centers track against targets
6. **GL Integration**: Double-entry bookkeeping maintained
7. **Department Performance**: Track each profit center separately

---

## Files Modified

| File | Changes |
|------|---------|
| `src/app/lib/accounting/integration.ts` | **NEW** - Core integration module |
| `src/app/lib/accounting/store.ts` | Enhanced logging for all operations |
| `src/app/lib/frontoffice/helpers/folio.ts` | Auto-capture for room charges/payments |
| `src/app/components/FBPOS.tsx` | Auto-capture for F&B sales |
| `src/app/components/EventsConferencesMainDashboard.tsx` | Auto-capture for events |

---

## Accounts Receivable UI Enhancements

The AR page now shows:

### Revenue by Source Summary
- Visual breakdown of revenue by department
- Color-coded cards showing totals and invoice counts
- Sources: Front Office, Restaurant, Bar, Room Service, Conference

### Auto-Captured Invoices Table
Shows all automatically generated invoices with:
- **SOURCE** column with color-coded department badge
- **CUSTOMER** name from original transaction
- **DESCRIPTION** of what was sold/charged
- **PAID/BALANCE** tracking
- **STATUS** (Posted, Paid, etc.)

### Receipts Table
Shows all payments received with:
- **SOURCE** column showing which department received payment
- **METHOD** of payment (Cash, Card, Mobile Money, etc.)
- **INVOICE** link to associated invoice

---

## Testing

To verify the integration is working:

1. **Front Office**: Check in a guest and post a room charge → Check Accounts Receivable for new invoice
2. **Restaurant**: Process a sale → Check AR for invoice and receipt
3. **Conference**: Confirm an event booking → Check AR for invoice
4. Open browser console to see detailed logging for each transaction
5. Go to **Accounting → Accounts Receivable** to see:
   - Revenue by Source summary at top
   - Auto-captured invoices with SOURCE badges
   - Receipts showing payment source

