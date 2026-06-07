# Ghana Hotel Management — User Acceptance Testing (UAT) Guide

**Version:** 1.0 · **Date:** June 2026  
**Production URL:** https://ghana-hotel-management.vercel.app

---

## Purpose

This guide helps testers walk through the main hotel processes on the **live deployed app** so nothing important is missed before the next development phase (database migration, etc.).

**Time required:** about 45–60 minutes per tester (one role focus).

---

## Before you start

| Item | Instruction |
|------|-------------|
| **Browser** | Use **Chrome** or **Edge** on a laptop (desktop layout). Avoid phone for first pass. |
| **Private window** | Open an **Incognito / Private** window so you start fresh. |
| **Internet** | Stable connection required. |
| **Data note** | Most operational data is stored **in your browser** for now. Another tester on a different device will **not** see your reservations unless they use the same browser profile. This is expected. |
| **Screenshots** | Take a screenshot for every **problem** (error message, blank screen, wrong total). |
| **Feedback** | Fill in the **Feedback log** at the end of this document (or a copy in Word/Google Docs). |

---

## How to report issues

For each issue record:

1. **Tester name**
2. **Date / time**
3. **Module** (e.g. Front Office, F&B, Accounting)
4. **Steps** (what you clicked, in order)
5. **Expected** vs **Actual**
6. **Severity:** Blocker / Major / Minor / Suggestion
7. **Screenshot** (attach if possible)

---

## Test A — First visit & setup (everyone, ~10 min)

**Goal:** Confirm the app loads and initial setup works.

1. Open https://ghana-hotel-management.vercel.app
2. If redirected to **Setup**, complete the wizard:
   - Hotel name (any test name, e.g. “Accra Demo Hotel”)
   - Country: **Ghana** (defaults for GHS, taxes, timezone Africa/Accra)
   - Complete remaining steps and **Save / Finish**
3. Confirm you reach the **main dashboard** (sidebar navigation visible).
4. Open **Help** (sidebar or `/help`) — page should load without error.
5. Press **F12** only if instructed; otherwise skip developer tools.

**Pass if:** Setup completes, dashboard loads, no crash.  
**Fail if:** Blank white screen, endless loading, or unrecoverable error.

---

## Test B — Front desk: reservation → check-in → folio → checkout (~20 min)

**Assign to:** Tester playing **Front Office / Reception**

**Navigation:** Sidebar → **Front Office** / **Guest Services** → **Check-ins**  
Direct link: https://ghana-hotel-management.vercel.app/guest-services/check-ins

### B1 — Create a reservation

1. Go to **Reservations / Bookings** tab (or equivalent on Check-ins page).
2. Create a **new reservation**:
   - Guest name: `Test Guest [your initials]`
   - Room type: any available type
   - Arrival: **today**
   - Departure: **tomorrow** (1 night)
   - Status: confirmed
3. Save and confirm the reservation appears in the list.

### B2 — Check in

1. Open **Today’s Arrivals** (or arrivals panel).
2. Find your reservation and **Check in**.
3. Assign a **room number** if prompted.
4. Confirm status changes to **checked-in**.

### B3 — Post charges to folio

1. Open the guest **folio** (in-house / billing view).
2. Add a charge, e.g. **Laundry** or **Minibar** — any amount (e.g. GHS 50).
3. Confirm folio **balance increases** (room charges may appear after night audit or per policy).

### B4 — Check out

1. Go to **Check-outs** tab or checkout flow.
2. **Check out** the same guest.
3. Note **final folio total** (room + extras + tax if shown).
4. Record payment method (cash/card) if prompted.

**Pass if:** Full stay cycle completes without error; totals look reasonable.  
**Note for testers:** Room revenue posts to accounting mainly at **checkout**, not at every folio click.

---

## Test C — F&B POS: cash sale vs room charge (~15 min)

**Assign to:** Tester playing **Restaurant / Bar cashier**

**Navigation:** Sidebar → **Food & Beverage** → **POS** (F&B POS)

### C1 — Walk-in cash sale

1. Start a **walk-in** (not in-house guest) order.
2. Add 2–3 menu items to cart.
3. Pay with **Cash** or **Card**.
4. Complete sale — confirm receipt/success message.

### C2 — In-house room charge (important)

1. Start order for **In-house guest** (link to a checked-in room if available).
2. Add items to cart.
3. Pay with **Room Charge** (not cash).
4. Complete sale.

**Pass if:** Both flows complete.  
**Watch for (report if seen):** Room charge **and** immediate accounting duplicate; balance looks wrong on folio after room charge.

---

## Test D — Night audit & no-show (~15 min)

**Assign to:** Tester playing **Night Manager**

**Navigation:** Sidebar → **Front Office** → **Night Audit**  
Settings (optional): **Room Configuration** → Operational Policies → Night Audit & Room Charges

### D1 — Review settings

1. Confirm **Night audit auto-run** and **Post first night at check-in** toggles exist.
2. Leave defaults unless instructed (auto-run **on**, first night at check-in **off**).

### D2 — Manual night audit

1. Open **Night Audit** screen.
2. Note current **business date** and in-house count.
3. Run **Night Audit** manually (button on screen).
4. Confirm success message / history entry (room charges posted count).

### D3 — No-show (if arrivals available)

1. Create a **second reservation** for **today**, do **not** check in.
2. On **Today’s Arrivals** or Reservations, use **No-show** (confirm dialog).
3. Confirm reservation status updates.

**Pass if:** Night audit runs without crash; no-show can be marked.  
**Known limit:** Auto night audit at 1:00 AM only runs if someone keeps the **browser tab open** overnight.

---

## Test E — Accounting (~15 min)

**Assign to:** Tester playing **Finance / Accounts**

**Navigation:** Sidebar → **Accounting**

### E1 — Manual sales invoice (AR)

1. Open **Accounts Receivable**.
2. Create a **new sales invoice**:
   - Customer name: `UAT Customer [initials]`
   - Amount: e.g. GHS 1,000 + tax if applicable
3. Save as **Posted** (or post after save).
4. Confirm invoice appears in list with **Posted** status.

### E2 — Customer receipt

1. Create a **receipt** against the invoice (or on account).
2. Amount: partial or full payment.
3. Confirm receipt saved.

### E3 — Financial reports

1. Open **Financial Reports**.
2. Run **Income Statement** or **Trial Balance** (default date range OK).
3. Confirm report **renders** (numbers may be demo/zero — that is OK).

**Pass if:** Invoice, receipt, and report screens work without error.

---

## Test F — Room configuration & rates (~10 min)

**Assign to:** Any spare tester or admin

**Navigation:** **Room Configuration** / **Rate Management** (sidebar under Front Office or Settings)

1. Open **Room Configuration**.
2. View **room types** and **operational policies** (night audit section).
3. Open **Rate Management** — confirm rates load for room types.

**Pass if:** Pages load; edits save without crash (optional: change a rate and revert).

---

## Test G — Smoke checks (quick, anyone)

Open each URL — expect **200** (page loads, not “404 This page could not be found”):

| URL | Expect |
|-----|--------|
| `/` | Main app |
| `/setup` | Setup wizard (or redirect if already done) |
| `/help` | Help content |
| `/guest-services/check-ins` | Check-ins hub |
| `/management` | Management view |

---

## Known limitations (do **not** log as bugs unless behavior differs)

- Data is **per browser** until cloud database (Supabase) is connected.
- Two testers overwriting each other on the **same browser** may confuse results.
- Some API calls require **tenant context** — server routes may return “Missing tenant header” in raw API tests; ignore unless seen in normal UI.
- **Lean mode** may hide some menu items in production.
- Reports may show **demo or empty** figures if no GL activity yet.

---

## Feedback log (copy for each tester)

| # | Module | Steps summary | Expected | Actual | Severity | Screenshot? |
|---|--------|---------------|----------|--------|----------|-------------|
| 1 | | | | | | |
| 2 | | | | | | |
| 3 | | | | | | |
| 4 | | | | | | |
| 5 | | | | | | |

---

## Sign-off checklist

| Test | Tester initials | Date | Pass / Fail |
|------|-----------------|------|-------------|
| A — Setup | | | |
| B — FO stay cycle | | | |
| C — F&B POS | | | |
| D — Night audit | | | |
| E — Accounting | | | |
| F — Room config | | | |
| G — Smoke URLs | | | |

**Overall recommendation:** ☐ Ready for next phase · ☐ Needs fixes first

**Comments:**

---

*Send completed feedback to the project owner. Thank you for testing.*
