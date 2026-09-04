/**
 * Regression tests for two bugs found during a live front-office demo:
 *
 * 1. A charge added to a checked-in guest's folio (e.g. a swimming pool
 *    service charge) could be silently erased if the periodic GET /api/folios
 *    refresh (pullFromApi, triggered on window focus / tab visibility) resolved
 *    with a snapshot taken before that charge's own PUT had reached the
 *    database — the merge unconditionally let the server copy win. Fixed in
 *    frontoffice/store.ts by preferring whichever copy (local vs server) has
 *    more charges/payments recorded.
 *
 * 2. Demo-seeded business partners had glAccountCode '1200' — a category
 *    HEADER row in the chart of accounts (see GHANA_CHART_OF_ACCOUNTS in
 *    models.ts), not a postable leaf — instead of '1210' (Guest Accounts
 *    Receivable). Any manual/legacy AR posting for one of these partners
 *    landed directly on '1200', which the Trial Balance's per-leaf-account
 *    rollup doesn't fully reconcile against the parent-inclusive total,
 *    producing a spurious "Balance Check" mismatch despite every journal
 *    entry being individually balanced.
 */
import { buildDemoTransactionSeed } from '../src/app/lib/accounting/demoAccountingSeed';
import { buildSalesInvoiceJournalEntry } from '../src/app/lib/accounting/invoicePostingBridge';
import type { Invoice } from '../src/app/lib/accounting/models';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

// 1. Folio merge race — replicate the exact preference rule from
// frontoffice/store.ts's pullFromApi (the real function is 'use client' and
// touches window/localStorage, so its merge logic is exercised here directly
// rather than imported).
{
  type MiniFolio = { id: string; charges: unknown[]; payments: unknown[] };
  const local: MiniFolio[] = [{ id: 'FOL-1', charges: [{ id: 'c1' }, { id: 'c2' }], payments: [] }];
  const serverStale: MiniFolio[] = [{ id: 'FOL-1', charges: [{ id: 'c1' }], payments: [] }]; // missing c2

  const byId = new Map<string, MiniFolio>();
  local.forEach((f) => byId.set(f.id, f));
  serverStale.forEach((f) => {
    const localF = byId.get(f.id);
    const localCount = (localF?.charges?.length || 0) + (localF?.payments?.length || 0);
    const serverCount = (f.charges?.length || 0) + (f.payments?.length || 0);
    byId.set(f.id, serverCount >= localCount ? f : (localF as MiniFolio));
  });
  const merged = byId.get('FOL-1')!;
  assert(merged.charges.length === 2, `stale server pull must not drop a locally-added charge, got ${merged.charges.length}`);

  // A genuinely newer server copy (e.g. another terminal added a payment) must still win.
  const serverNewer: MiniFolio[] = [{ id: 'FOL-1', charges: [{ id: 'c1' }, { id: 'c2' }], payments: [{ id: 'p1' }] }];
  const byId2 = new Map<string, MiniFolio>();
  local.forEach((f) => byId2.set(f.id, f));
  serverNewer.forEach((f) => {
    const localF = byId2.get(f.id);
    const localCount = (localF?.charges?.length || 0) + (localF?.payments?.length || 0);
    const serverCount = (f.charges?.length || 0) + (f.payments?.length || 0);
    byId2.set(f.id, serverCount >= localCount ? f : (localF as MiniFolio));
  });
  assert(byId2.get('FOL-1')!.payments.length === 1, 'a genuinely ahead server copy must still be adopted');
}

// 2. Demo-seeded AR partners must point at the postable leaf (1210), not the
// category header (1200).
{
  const seed = buildDemoTransactionSeed();
  const arPartners = seed.businessPartners.filter((p) => p.type === 'Customer');
  assert(arPartners.length > 0, 'demo seed has at least one AR customer to check');
  arPartners.forEach((p) => {
    assert(p.glAccountCode !== '1200', `customer ${p.id} must not point at header account 1200`);
    assert(p.glAccountCode === '1210', `customer ${p.id} should post to leaf account 1210, got ${p.glAccountCode}`);
  });

  // And the actual posting path (manual/legacy AR bridge) must honor it.
  const customer = arPartners[0];
  const inv: Invoice = {
    id: 'INV-AR-CODE-TEST',
    invoiceNumber: 'INV-2026-9001',
    type: 'Sales',
    date: '2026-06-01',
    dueDate: '2026-07-01',
    businessPartnerId: customer.id,
    description: 'AR account-code regression check',
    subtotal: 100,
    taxAmount: 0,
    total: 100,
    currency: 'GHS',
    status: 'Posted',
    paidAmount: 0,
    createdAt: '2026-06-01',
    updatedAt: '2026-06-01',
    lines: [],
  };
  const result = buildSalesInvoiceJournalEntry(inv, customer, { journalSeq: 0 });
  assert(result.ok, 'sales JE builds for demo customer');
  if (result.ok) {
    const arLine = result.entry.lines.find((l) => l.debit > 0);
    assert(!!arLine, 'AR debit line exists');
    assert(arLine!.accountCode === '1210', `AR line must post to 1210, got ${arLine!.accountCode}`);
  }
}

console.log('All folio-sync and AR-account-code regression checks passed.');
