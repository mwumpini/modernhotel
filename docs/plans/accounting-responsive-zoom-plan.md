# Accounting — responsiveness & 200% zoom plan

Owner: Cursor (implementation). Plan + measurements: Claude, 2026-10-01.
Scope: `src/app/components/AccountingMainDashboard.tsx` and everything under `src/app/components/accounting/`.
Out of scope: business logic, store, API, Prisma. **Do not change any calculation, posting, or data flow.** Layout/CSS/markup only.

---

## Status — implemented 2026-10-01 (Claude)

Done and measured on all 11 tabs at 683×320, plus checks at 960×470, 768×1024, 375×812 and 1440×900:
desk tabs start ~59px from the top (was 1175px); no sideways page scroll; nothing clipped; no control under 32px below 768px wide
(only the 28px ✕ hide buttons, kept small on purpose).

- **Change from the plan (owner's call):** below desktop width (<1024px) or on short screens, *all* summary cards (status cards,
  Today's ops, Quick actions, and every book's KPI tiles) start hidden. "Show / Hide summary" in the header brings them back;
  the choice is remembered (`localStorage accounting.headerCollapsed`). With no saved choice it follows the screen size.
- Tap targets are done with a scoped CSS layer (`.acct-desk` in `globals.css`), not per-button edits: 40px minimum on phones,
  narrow windows and touch screens. Any `min-h-*` / `min-w-*` class still wins.
- Sticky first table column (<1024px) and dialog inside-scroll are CSS too; the dialog rule applies to every dialog in the app.
- Fixed 2/3/4-column detail grids in accounting dialogs now collapse on phones.
- **Not done:** collapsing row actions into a ⋯ menu, and compacting table rows to ≤40px. The acceptance checks pass without them;
  pick them up only if real users find rows too tall.

---

## 1. Targets (what "works at 200%" means)

Browser zoom halves the CSS viewport. These are the screens to pass:

| Name | CSS viewport | Real-world case |
|---|---|---|
| **Z-small** | **683 × 320** | 1366×768 laptop at 200% (the hardest, most common in Ghana offices) |
| **Z-large** | **960 × 470** | 1920×1080 monitor at 200% |
| Tablet | 768 × 1024 | iPad portrait |
| Phone | 375 × 812 | Accountant checking on phone |
| Desktop | 1440 × 900 | Regression check — must look the same as today |

Sidebar is a 56px rail below 1024px, so the work pane is ~631px at Z-small and ~892px at Z-large.

## 2. What I measured (current state, commit 72a0fa5)

Good news — the global CSS in `globals.css` (`.work-pane` rules) already works:
- **No horizontal page scroll and no clipped elements on any of the 11 tabs** at 683×320.
- Tables scroll inside their own box.

The real problems:

| # | Problem | Evidence |
|---|---|---|
| P1 | **The dashboard header eats the screen.** The tab strip (Receivable/Payable/…) starts **1175px** down at Z-small (3.7 screen-heights of scrolling before you reach any work) and **502px** at Z-large (still below the fold of 470). | Status cards (3 stacked) + Today's Ops + Quick Actions all render before `<Tabs>` |
| P2 | **Quick Action buttons cut their content** — fixed `h-24` with icon + title + subtitle; content is 90–99px tall and is clipped when text wraps. | `AccountingMainDashboard.tsx` ~L394–423 |
| P3 | **Hide (✕) buttons are 9px** — untappable on touch, near-invisible at any zoom. Shared component, used in 22 files. | `dashboard/CustomizeViewControl.tsx` `HideCardButton`, `text-[9px] px-0.5` |
| P4 | **Small tap targets (<32px)** everywhere: receivables 15, payables 29, banking 28, assets 37, taxes 33, journal 30, statements 17, reports 22, audit 28, **Books 294**, cost-centers 30. Customize/Expand are 30px. | HeroUI `size="sm"` buttons, icon-only row actions, tree toggles in Chart of Accounts |
| P5 | **Today's Financial Operations row** is a non-wrapping `flex justify-between` with `gap-6` — overflows/squeezes at narrow widths. | ~L357–379 |
| P6 | **Table rows are tall** (49–60px) and the first table on a tab sits ~230–290px below the tab strip (filters/KPI strip above it). At 320px height you see ~1 row. | journal, payables |
| P7 | Side-scrolling tables lose context (no sticky first column; user can't tell which row they're on). | 1–3 scroll boxes per tab |

Not yet verified (check during the work): sub-tabs inside each desk, every dialog/modal at Z-small, dark mode, keyboard focus order.

---

## 3. Rules for every change

1. **Mobile-first Tailwind, no new width breakpoints.** Use existing `sm md lg xl`. For short screens use the `short:` height variant (see A1) — not JS.
2. **Never use `window.innerWidth` / `useMediaQuery` to render different trees** unless unavoidable — it causes hydration flashes. Prefer CSS.
3. **Money never wraps:** any currency figure gets `whitespace-nowrap tabular-nums`. HeroUI `Card` sets `overflow-wrap: break-word` which splits numbers — override on the number, not the card.
4. **Tap targets:** interactive elements ≥ **40px** tall on touch/narrow (`min-h-10`), ≥ 32px on desktop. Icon-only buttons: `min-w-10 min-h-10` (visual icon can stay small; pad the hit area).
5. **Don't fight the global CSS.** `globals.css` already gives `.flex-1` / `.w-*` children inside input rows `flex: 1 1 9rem; max-width: 18rem`. If a block must grow (e.g. a search box), use `grow basis-[22rem] min-w-0` instead of `flex-1` (same trick used in `FBPOS.tsx`).
6. Follow the existing Cursor rules: `.cursor/rules/date-filter-responsive.mdc` (chip bar at `lg+`, Select below `lg`/when zoomed) and `.cursor/rules/void-delete-edit.mdc`.
7. Desktop at 1440×900 must look unchanged (or tighter) — screenshot before/after.

---

## 4. Work, in order

### Phase A — Shared fixes (biggest win, smallest diff). Do first.

**A1. Compact header on short screens (fixes P1).**
In `AccountingMainDashboard.tsx`:
- Add a Tailwind custom variant for short viewports. This repo is **Tailwind v4 (no tailwind.config file)** — add to `src/app/globals.css` near the top, after the `@import "tailwindcss"`:
  `@custom-variant short (@media (max-height: 600px));`
  Then `short:p-2`, `short:hidden` etc. work like any other variant.
- Status cards grid (~L259): on short screens collapse to a **single compact strip**: `short:grid-cols-3 short:gap-2 short:mb-2`, card body `short:p-2`, title `short:text-sm`, big figure `short:text-lg`, and **hide the 3-line breakdown** under each figure with `short:hidden`.
- Also below `md` (phone width) make the status cards a horizontal scroll strip (`flex overflow-x-auto snap-x` with each card `min-w-[15rem] snap-start`) instead of stacking 3 tall cards.
- Today's Ops (~L357): see A3.
- Quick Actions (~L383): see A2.
- **Add a "Collapse summary" toggle** next to Customize (`DeskKpiCustomize`): one button that hides status cards + today's ops + quick actions together, remembered in `localStorage` key `accounting.headerCollapsed` (wrap in try/catch). **Default collapsed when `(max-height: 600px)` matches on first visit** (read once in an effect; don't SSR-branch).
- Acceptance: tab strip top ≤ **120px** from pane top at Z-small with header collapsed, ≤ **320px** expanded-compact; ≤ **470px** (i.e. visible without scroll) at Z-large.

**A2. Quick Actions (fixes P2).**
- Replace `h-24` with `min-h-[4.5rem] h-auto py-3`. Allow `whitespace-normal` on the labels.
- Below `md` and on `short:`: render as a row of 3 compact buttons — icon + title inline (`flex-row gap-2 min-h-10`), subtitle `hidden`.
- Grid: `grid-cols-1 sm:grid-cols-3` (not `md:`) so 631px pane gets 3 across.

**A3. Today's Financial Operations (fixes P5).**
- Outer: `flex flex-wrap items-center gap-x-4 gap-y-2`; inner stats: `flex flex-wrap gap-x-4 gap-y-1`. Title `text-base md:text-lg`. Optionally merge this row into the status strip on `short:`.

**A4. HideCardButton (fixes P3) — shared, fixes 22 screens.**
In `dashboard/CustomizeViewControl.tsx`:
- Keep the visual ✕ small but give it a real hit area: `inline-flex items-center justify-center min-w-8 min-h-8 rounded-md text-xs text-gray-400 hover:bg-default-100 hover:text-gray-700 focus-visible:ring-2` (sm) and `min-w-10 min-h-10 text-sm` (md).
- Check the 22 call sites still align (they sit in `flex items-center gap-2` rows — should be fine). Spot-check FBDashboard, Housekeeping, Frontdesk.

**A5. Desk tabs (`dashboard/deskTabsUi.ts`).**
- `tab: 'px-3 min-w-fit text-sm h-10 md:h-9'` (bigger touch height on narrow).
- Make the main tab strip **sticky** inside the pane so you can switch desks without scrolling up: wrap tab list with `sticky top-0 z-20 bg-background` (via `classNames.tabList` or a wrapper; make sure the Card doesn't have `overflow-hidden` that kills sticky).
- Shorten titles on narrow: keep emoji + short word ("📝 Receivable", "🧾 Payable", "💰 Bank", "PPE", "🧮 Tax", "Journal", …) using `<span className="hidden lg:inline">Accounts </span>` patterns.

**A6. Shared `DeskKpiStrip.tsx`.**
- KPI tiles: `grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-[auto-fit]`, figures `whitespace-nowrap tabular-nums text-base md:text-lg`, padding `p-2 md:p-3`. On `short:` hide KPI sub-labels/trend lines.
- Collapsible like A1 (respect the same `accounting.headerCollapsed` toggle, or its own chevron).

**A7. Shared table conventions** — create `src/app/components/accounting/tableUi.ts` exporting class strings, then apply per tab in Phase B:
- Wrapper: `overflow-x-auto max-w-full` (global CSS mostly does this; make it explicit).
- **Sticky first column:** first `th`/`td` get `sticky left-0 z-10 bg-background` (+ subtle right border/shadow).
- **Sticky header:** `thead th` `sticky top-0 z-10 bg-default-100` when the table has its own `max-h` scroll.
- Compact rows: `py-1.5 md:py-2`, `text-xs md:text-sm`; target row height ≤ 40px.
- Money cells: `text-right whitespace-nowrap tabular-nums`.
- Row actions: on `< md` collapse multiple icon buttons into one `⋯` Dropdown (HeroUI `Dropdown`) with ≥40px trigger. Keep Void/Delete confirm flow per `void-delete-edit.mdc`.

**A8. Dialogs.** Global CSS already makes modals fit and go full-screen under 640px. For every accounting modal:
- Use `scrollBehavior="inside"` on HeroUI `Modal` so header/footer stay visible and the body scrolls (critical at 320px height).
- Footer buttons: `flex-wrap gap-2`, primary action last and visible.
- Form grids inside: `grid-cols-1 sm:grid-cols-2` (global auto-fit handles most; check line-item editors in invoices/bills/journals, which need a horizontal-scroll table, not squeezed inputs).

### Phase B — Per-tab pass (one PR/commit per tab; biggest first)

For each tab: apply A7 to its tables, check filters follow `date-filter-responsive.mdc`, fix any `flex` row without `flex-wrap`, make toolbar buttons `min-h-10` on narrow, then run the §5 checklist.

| Order | Tab | File(s) | Specific notes |
|---|---|---|---|
| 1 | Books | `ChartOfAccounts.tsx` | **294 small targets** — tree expand/collapse toggles and per-row icons. Give the whole row a click target, toggles `min-w-8 min-h-8`, move row actions into `⋯` menu below `md`. Indent with `pl-[calc(level*0.75rem)]` capped so deep levels don't push names off-screen. |
| 2 | Receivables | `AccountsReceivable.tsx` (4.5k lines) | Invoice editor dialog (line items table), customer list, aging. Don't refactor logic — layout only. |
| 3 | Payables | `AccountsPayable.tsx` (3.4k) | Same as AR: bill editor, supplier list, payment runs. Rows are 60px tall today → compact. |
| 4 | Assets | `PpeAssetRegister.tsx`, `PpeSummaryPivotTable.tsx` | Pivot table = widest table in the app: sticky first column is mandatory. 37 small targets. |
| 5 | Taxes | `BooksTaxes.tsx` | Return forms: two-column label/amount layout → `grid-cols-1 sm:grid-cols-[1fr_auto]`. |
| 6 | Journal | `JournalRegister.tsx` | Journal entry editor (debit/credit lines) must stay a table with horizontal scroll; totals row sticky at bottom of dialog. |
| 7 | Banking | `BankCashReceivables.tsx`, `BankReconciliation.tsx` | Reconciliation is two side-by-side lists → stack below `lg` with a segmented control (Bank / Book) on `< md`. |
| 8 | Statements | `FinancialReports.tsx` | P&L / BS: indented account rows, right-aligned amounts, comparative columns scroll with sticky account column. Print styles must not regress. |
| 9 | Reports | `ReportsAnalysis.tsx` | Charts: give containers `min-h-[14rem]` and `w-full`; legends below chart on narrow. |
| 10 | Cost centers | `CostRevenueCenters.tsx` | |
| 11 | Audit | `AuditControls.tsx` | Long text cells: `line-clamp-2` + tooltip/expand. |

### Phase C — Polish
- Dark mode: check every changed sticky cell has a background token (`bg-background` / `bg-content1`), not white.
- Keyboard: tab order through header → tab strip → toolbar → table; visible `focus-visible` rings on the new icon buttons.
- `prefers-reduced-motion`: no new animations needed.

---

## 5. Test procedure (run after every tab)

**Chrome DevTools:** Device toolbar → Responsive → set each size from §1. (Or real zoom: Ctrl + to 200% on a 1366×768 window.)

Paste in the console to measure (works on the current tab):

```js
(() => {
  const pane = document.querySelector('.work-pane'); const top = pane.getBoundingClientRect().top;
  const tabs = [...pane.querySelectorAll('[role=tablist]')].find(t => /Receivable/.test(t.textContent));
  const small = [...pane.querySelectorAll('button,a,[role=tab],input,select,[role=button]')]
    .filter(e => { const r = e.getBoundingClientRect(); return r.width && r.height && r.height < 32; });
  const clipped = [...pane.querySelectorAll('*')].filter(e => e.getBoundingClientRect().right > pane.getBoundingClientRect().right + 1 && !e.closest('table, .overflow-x-auto'));
  return {
    viewport: `${innerWidth}x${innerHeight}`,
    pageScrollsSideways: document.documentElement.scrollWidth > innerWidth,
    tabStripTop: tabs ? Math.round(tabs.getBoundingClientRect().top - top + pane.scrollTop) : null,
    smallTapTargets: small.length,
    smallExamples: small.slice(0, 8).map(e => (e.getAttribute('aria-label') || e.textContent || e.tagName).trim().slice(0, 30)),
    clippedOutsidePane: clipped.length,
  };
})()
```

**Acceptance per tab (Z-small 683×320 and Z-large 960×470):**
- [ ] `pageScrollsSideways: false`, `clippedOutsidePane: 0`
- [ ] `tabStripTop` ≤ 120 (header collapsed) at Z-small; ≤ 470 at Z-large expanded
- [ ] `smallTapTargets` = 0 below 768px wide; any left on desktop are justified (e.g. inline text links)
- [ ] No money figure split over two lines; no text clipped inside buttons
- [ ] At least **3 table rows visible** at Z-small after scrolling the table into view
- [ ] When a table scrolls sideways, the first column (name/number) stays visible
- [ ] Every dialog on the tab: header + primary button visible without scrolling the page; body scrolls
- [ ] Create → save → void flow works at Z-small (do one real action per desk with test data)
- [ ] Desktop 1440×900 screenshot matches before (or is cleaner)
- [ ] Phone 375×812: usable, no sideways page scroll
- [ ] Dark mode: sticky cells not white

**Before merging:** `npx tsc --noEmit` and `npm run lint` clean. No changes to `prisma/`, `src/app/api/`, or `src/app/lib/accounting/store.ts`.

---

## 6. Suggested commits

1. `accounting: compact/collapsible header on short screens` (A1–A3, A6)
2. `ui: HideCardButton real hit area` (A4 — touches shared component)
3. `accounting: sticky, touch-sized desk tabs` (A5)
4. `accounting: shared table classes + modal inside-scroll` (A7, A8)
5. One commit per tab in Phase B order.
6. `accounting: dark-mode + focus polish` (Phase C)

Push only after each commit passes §5 — `main` deploys straight to production.
