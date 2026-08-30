# Bank & Cash Management — Process Flow Design Notes

> **Status:** Design reference for a full process-flow document (to be expanded later).  
> **Last updated:** 2026-06-10 (incl. how-to-book notes)  
> **Related code:** `BankCashReceivables.tsx`, `bankCoaLink.ts`, `bankOpeningBalance.ts`, `bankTransactionLedger.ts`, `bankRecon/ledgerSync.ts`, `store.ts`

---

## Purpose

Bank & Cash sits between **operational cashbook** (registers, statements, reconciliation) and **general ledger** (COA, journal entries, financial reports). This note captures intended behaviour agreed during implementation so a formal process-flow doc can be written later.

---

## Architecture: Two Layers

```
┌──────────────────────┐     glAccountCode      ┌──────────────────────┐
│  Bank sub-ledger     │ ─────────────────────► │  Chart of Accounts   │
│  BankAccount         │                        │  (Asset 1100 subtree)│
│  BankTransaction     │                        └──────────┬───────────┘
│  currentBalance      │                                   │
└──────────┬───────────┘                                   │ journal lines
           │                                               ▼
           │                                    ┌──────────────────────┐
           │  Reconciliation compares           │  General Ledger      │
           └──────────────────────────────────► │  Trial balance, CF   │
              register vs GL balance            └──────────────────────┘
```

| Layer | Records | Purpose |
|-------|---------|---------|
| **Sub-ledger** | `BankAccount`, `BankTransaction` | Operational cashbook; statement matching |
| **General ledger** | `JournalEntry`, COA balances | Financial reporting; audit trail |

Every bank/cash register **must** link to a COA account via `BankAccount.glAccountCode`.

---

## COA Linkage Rules

### Standard Ghana hotel COA (cash hierarchy)

| Code | Name | Role |
|------|------|------|
| `1100` | Cash and Cash Equivalents | Header (not postable) |
| `1110` | Cash in Hand | Petty cash / cash drawer |
| `1120` | Bank Accounts | Generic bank header |
| `1121–1199` | (child accounts) | Dedicated GL per bank account |

### Mapping when creating a bank account

| Account type | Default GL | Dedicated GL option |
|--------------|------------|---------------------|
| Petty cash / cash drawer | `1110` | No (shared bucket) |
| Bank account | `1120` or new child | Yes — auto-create child under `1120` (e.g. `1121 GCB Main`) |

### Where `glAccountCode` is consumed

- **Payments / receipts** (`invoicePostingBridge`) — cash side of JE when `payment.bankAccountId` is set
- **Payment vouchers** (`store.postPaymentVoucher`) — bank line delta on post
- **Bank reconciliation** (`linkCashbookToLedger`) — compare register `currentBalance` vs GL balance for that code
- **Cash flow reports** — codes `1000`, `1100`, `1110`, `1120`, and `1121–1199` treated as cash equivalents

---

## Opening Balance — Two Distinct Concepts

**Critical design decision:** “Opening balance” is **not** one thing. The UI exposes **Opening balance type**:

### 1. Period / year opening (`openingBalanceType: 'period'`) — **DEFAULT**

| Aspect | Behaviour |
|--------|-----------|
| **Use when** | Hotel already live on the system; start of month/year; new reconciliation period |
| **Updates** | Bank register (`openingBalance`, `currentBalance` on create) |
| **GL** | **No automatic journal entry** — GL balance comes from posted transactions (receipts, payments, JEs) carried forward |
| **Reconciliation** | Starting figure for cashbook vs bank statement |

### 2. Go-live import (`openingBalanceType: 'go_live'`)

| Aspect | Behaviour |
|--------|-----------|
| **Use when** | First-time system setup; migration from legacy books; incomplete opening balance sheet |
| **Updates** | Bank register + **posts to GL** |
| **GL entry** | Dr Bank GL / Cr Retained Earnings (`3200`) |
| **Adjustments** | Changing opening balance posts delta only (`bank_opening_balance_adjustment`) |
| **Source modules** | `bank_opening_balance`, `bank_opening_balance_adjustment` |

### Decision tree (for process-flow doc)

```
User enters opening balance
         │
         ▼
┌────────────────────────────┐
│ Opening balance type?      │
└─────────────┬──────────────┘
              │
     ┌────────┴────────┐
     ▼                 ▼
  period            go_live
     │                 │
     ▼                 ▼
 Update cashbook    Update cashbook
 only               + post JE
     │              Dr Bank GL
     │              Cr 3200 Retained Earnings
     ▼                 │
 GL from normal         ▼
 transactions      Trial balance
 over time         reflects import
```

### What go-live import is **not**

- Not for every January 1 reset (GL carries forward automatically)
- Not the right offset when balance is a **transfer from another bank** (should be Dr new bank / Cr old bank — **future enhancement**)
- Not a substitute for a full opening balance sheet (AR, AP, loans, PPE still need separate entries)

### Legacy / backward compatibility

- Accounts with no `openingBalanceType` but **existing** go-live JEs continue GL sync on edit
- Accounts with no type and no prior JE default to **period** behaviour (no GL post)

---

## End-to-End Flows (draft for formal doc)

### A. Add bank account (live hotel)

1. User → Bank & Cash → Add Account  
2. Type: Bank account  
3. Link GL (pick existing or create dedicated child under `1120`)  
4. Opening balance type: **Period / year opening**  
5. Enter opening balance (statement/cashbook start)  
6. Save → register updated; **no equity JE**  
7. Day-to-day: receipts/payments post Dr/Cr bank GL  

### B. Add bank account (migration / go-live)

1. Same as A, but opening balance type: **Go-live import**  
2. Save → register + **Dr bank / Cr 3200**  
3. Complete remaining opening balance sheet items separately  
4. Switch to **period** mode for ongoing use  

### C. Bank reconciliation

1. Select bank account (shows `glAccountCode`)  
2. Enter statement balance (period opening — separate from account `openingBalance` field)  
3. System compares: GL balance vs register `currentBalance` vs statement  
4. Reconciling items → optional book-side JEs via `bankRecon/ledgerSync`  

### D. Payment hits bank GL

1. Payment posted with `bankAccountId`  
2. `syncPaymentToLedger` uses `bank.glAccountCode` as cash leg  
3. Register: `currentBalance` updated + `BankTransaction` created  

---

## How to Book — User Guide (draft for training / help doc)

Plain-language reference for staff and a future in-app **How to book** article.

### Before you book anything

1. **Set up bank accounts** (Bank & Cash → Bank Accounts).  
2. **Link each account to GL** — petty cash → `1110`; each real bank → dedicated code under `1120`.  
3. **Choose opening balance type** when creating the account.  
4. Day-to-day movements: **Transactions** tab or automatic from **AR/AP**.

### Step 1 — Set up a bank or cash account

| Field | What to enter |
|-------|----------------|
| Account type | Bank account or Petty cash / cash drawer |
| GL account | Auto or pick cash/bank under `1100` |
| Dedicated GL | ✅ for each real bank (e.g. `1121 GCB Main`) |
| Opening balance type | Period (live hotel) or Go-live (migration) |
| Opening balance | Statement / till figure at period start |

**Opening balance type**

| Situation | Choose | Result |
|-----------|--------|--------|
| Hotel already on system; new month/year | **Period / year opening** | Cashbook only — no GL journal |
| First-time migration from old books | **Go-live import** | Cashbook + Dr bank / Cr 3200 |
| Money from another bank already in system | **Transfer** later — not go-live opening | |

### Step 2 — Book day-to-day transactions

**Where:** Bank & Cash → Transactions → Add Transaction

| Type | When to use | Register | GL if Post to GL ✅ |
|------|-------------|----------|---------------------|
| Deposit | Money in (not via AR) | Balance ↑ | Dr bank / Cr 4500 |
| Withdrawal | Money out (not via AP) | Balance ↓ | Dr 6000 / Cr bank |
| Charge | Bank fee | Balance ↓ | Dr 5625 / Cr bank |
| Interest | Bank interest | Balance ↑ | Dr bank / Cr 4300 |
| Transfer | Between your accounts | Out ↓ / In ↑ | Dr to-bank / Cr from-bank |

**Transfer:** From account → To account. Same amount; hotel total cash unchanged.

**Status:** Pending → Cleared (on statement) → Reconciled (Reconciliation tab).

### Post to GL — explained

**GL** = Chart of Accounts / official books (reports, trial balance, audit).

| Setting | Meaning |
|---------|---------|
| ✅ Post to GL | Save creates a **journal entry** + updates cashbook |
| ⬜ Off | **Cashbook only** — GL already posted elsewhere |

**Leave unchecked when:** payment/receipt already posted from AR or AP.  
**Keep checked (default) when:** manual bank entry, transfer, charge, interest not booked elsewhere.

**Transactions ≠ Reconciliation** — booking records what happened; reconciliation proves it matches the bank statement.

### Step 3 — Common scenarios (cheat sheet)

| Scenario | Where | Post to GL? |
|----------|-------|-------------|
| Guest pays invoice by bank | AR → Receive payment | Auto — don’t duplicate |
| Pay supplier | AP → Pay bill | Auto — don’t duplicate |
| GCB → Ecobank transfer | Transactions → Transfer | ✅ |
| Bank fee on statement | Transactions → Charge | ✅ |
| Petty cash from main bank | Transfer | ✅ |
| Migration opening balance | Add account → Go-live | Auto (Dr bank / Cr 3200) |
| Month-end statement | Reconciliation tab | Adjustments only if gaps |

### Step 4 — Month-end reconciliation

**Where:** Bank & Cash → Reconciliation tab

**Goal:** Adjusted bank balance = adjusted cashbook balance at period end.

1. Select bank account and **period end** date.  
2. Enter **statement balance** from the bank.  
3. Review **register transactions** (from Transactions tab) through period end.  
4. Add **bank-side items** — deposits in transit, outstanding cheques, bank errors.  
5. Add **book-side items** — bank charges/credits not in books; post to GL.  
6. **Sync cashbook from GL** after posting book-side items.  
7. When balanced → **Mark complete** (register lines → Reconciled) → **Approve & lock**.

| Bank-side | Book-side |
|-----------|-----------|
| Timing differences on the statement | Items on statement not yet in books |
| Does not post to GL | Posts to GL before complete |

Do **not** use Reconciliation to record transfers, daily receipts, or go-live opening balances.

### Booking mistakes to avoid

| Mistake | Do instead |
|---------|------------|
| Go-live opening every January | Period opening; GL carries forward |
| Same payment in AP and Transactions with GL | Book once; uncheck Post to GL if duplicate line |
| Transfer as Withdrawal only | Use Transfer with From/To |
| All banks on GL `1120` only | Dedicated GL per bank |

### JE quick reference

| Event | JE pattern |
|-------|------------|
| Go-live opening | Dr bank / Cr 3200 |
| Deposit (manual) | Dr bank / Cr 4500 |
| Withdrawal (manual) | Dr 6000 / Cr bank |
| Charge | Dr 5625 / Cr bank |
| Interest | Dr bank / Cr 4300 |
| Transfer | Dr to-bank / Cr from-bank |
| AR/AP payment | Via payment post — bank GL from linked account |

---

## Future Process-Flow / Product Enhancements

Document these as open items when writing the full flow:

- [ ] **Offset account picker** on go-live (equity vs another bank vs opening balance equity suspense vs manual JE only)
- [ ] **Separate UI labels:** “Statement opening (recon)” vs “Go-live import balance”
- [ ] **Tenant onboarding question:** “First-time setup or already live?” → default opening balance type
- [x] **Transfer between banks** — Dr destination / Cr source (`bankTransactionLedger.ts`)
- [ ] **Auto-reverse** when switching go-live → period (or warn user)
- [ ] **Opening balance sheet wizard** — single balanced JE for all go-live accounts
- [ ] **Persist bank accounts** to tenant DB (currently client store / demo seed)
- [ ] **In-app How to Book** — link from ⓘ icons and help menu to this section

---

## Key Files (implementation map)

| File | Responsibility |
|------|----------------|
| `src/app/components/accounting/BankCashReceivables.tsx` | UI: accounts, GL picker, opening balance type |
| `src/app/lib/accounting/bankCoaLink.ts` | COA filtering, dedicated bank GL creation |
| `src/app/lib/accounting/bankOpeningBalance.ts` | Go-live GL posting logic |
| `src/app/lib/accounting/bankTransactionLedger.ts` | Manual transactions, transfers, GL post, reversals |
| `src/app/lib/accounting/bankRecon/ledgerSync.ts` | Register ↔ GL link for reconciliation |
| `src/app/lib/accounting/invoicePostingBridge.ts` | Payment → bank GL |
| `src/app/lib/accounting/models.ts` | `BankAccount.openingBalanceType`, `glAccountCode` |
| `src/app/lib/accounting/financialReportRollup.ts` | Cash equivalent GL code detection |

---

## Glossary (for final process doc)

| Term | Meaning in this system |
|------|------------------------|
| **Register** | Bank sub-ledger balance (`currentBalance`) |
| **Period opening** | Cashbook starting point; no GL post |
| **Go-live import** | One-time GL recognition of legacy bank balance |
| **Dedicated GL** | Child account under `1120` for one physical bank account |
| **Reconciliation statement balance** | User-entered figure on recon screen for a specific period end |
| **Post to GL** | Create a journal entry in COA when saving a manual bank transaction |
| **Cashbook / register** | Bank sub-ledger: transactions list + `currentBalance` |
