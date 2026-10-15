import { describe, expect, it } from 'vitest';
import {
  ledgerStateFromEntries,
  planCheckoutClose,
  planFolioPostings,
  type PlannedEntry,
} from '@/app/lib/accounting/folioLedgerPlan';
import { taxConfigsFromGhanaTemplate } from '@/app/lib/accounting/taxFromConfig';
import type { FolioLineJson } from '@/app/lib/frontoffice/folioLedger';

/**
 * Walks one stay through the books the way the server does: each step plans entries
 * against what is already posted, then "posts" them. Every entry must balance, and the
 * account balances after each step are what IFRS 15 expects.
 */
const taxConfigs = taxConfigsFromGhanaTemplate();
const RES = 'res1';

type Line = { accountCode: string; debit: number; credit: number; taxCode: string | null };
type Posted = { sourceTransactionId: string; lines: Line[] };

function makeBooks() {
  const posted: Posted[] = [];
  const post = (entries: PlannedEntry[]) => {
    for (const e of entries) {
      const lines = e.lines.filter((l) => Math.abs(l.amount) >= 0.005).map((l) => ({
        accountCode: l.accountCode,
        debit: l.amount > 0 ? l.amount : 0,
        credit: l.amount < 0 ? -l.amount : 0,
        taxCode: l.taxCode ?? null,
      }));
      const dr = lines.reduce((s, l) => s + l.debit, 0);
      const cr = lines.reduce((s, l) => s + l.credit, 0);
      expect(Math.round(dr * 100)).toBe(Math.round(cr * 100));
      posted.push({ sourceTransactionId: e.key, lines });
    }
    return entries;
  };
  const balance = (code: string) =>
    Math.round(posted.flatMap((e) => e.lines).filter((l) => l.accountCode === code).reduce((s, l) => s + l.debit - l.credit, 0) * 100) / 100;
  const state = () => ledgerStateFromEntries(RES, posted);
  return { posted, post, balance, state };
}

const sync = (books: ReturnType<typeof makeBooks>, inHouse: boolean, charges: FolioLineJson[], payments: FolioLineJson[]) =>
  books.post(planFolioPostings({ reservationId: RES, label: 'RES-1 Ama', inHouse, charges, payments, state: books.state(), taxConfigs, now: '2026-10-20T10:00:00.000Z' }));

const night = (date: string): FolioLineJson => ({ id: `ROOM-${date}`, date: `${date}T12:00:00.000Z`, description: `Room Charge — ${date}`, amount: 1000, tax: 210, category: 'room', glAccountCode: '4100' });

describe('Guest stay in the books, as it happens (IFRS 15)', () => {
  it('a deposit before arrival is a liability, not revenue', () => {
    const books = makeBooks();
    sync(books, false, [], [{ id: 'P1', date: '2026-10-10', method: 'Mobile Money', amount: 500, status: 'completed' }]);
    expect(books.balance('1130')).toBe(500);
    expect(books.balance('2450')).toBe(-500);
    expect(books.balance('4100')).toBe(0);
  });

  it('runs a whole stay: check-in, nights, a meal, a void, a discount, a refund and checkout', () => {
    const books = makeBooks();
    const payments: FolioLineJson[] = [{ id: 'P1', date: '2026-10-10', method: 'Mobile Money', amount: 500, status: 'completed' }];
    sync(books, false, [], payments);

    // Check-in: the deposit now counts against the stay.
    const charges: FolioLineJson[] = [];
    const xfer = sync(books, true, charges, payments);
    expect(xfer.map((e) => e.key)).toEqual([`${RES}:XFER`]);
    expect(books.balance('2450')).toBe(0);
    expect(books.balance('1215')).toBe(-500);

    // Night 1: revenue and each levy on the night itself.
    charges.push(night('2026-10-15'));
    const n1 = sync(books, true, charges, payments);
    expect(n1).toHaveLength(1);
    expect(n1[0].date).toBe('2026-10-15T12:00:00.000Z');
    expect(books.balance('4100')).toBe(-1000);
    expect(books.balance('2110')).toBe(-150);
    expect(books.balance('2120')).toBe(-25);
    expect(books.balance('2130')).toBe(-25);
    expect(books.balance('2150')).toBe(-10);
    expect(books.balance('1215')).toBe(710);

    // Running again posts nothing.
    expect(sync(books, true, charges, payments)).toHaveLength(0);

    // A restaurant meal billed to the room keeps its own tax split.
    charges.push({ id: 'FB-1', date: '2026-10-15T19:00:00.000Z', description: 'F&B — restaurant 1', amount: 200, tax: 42, category: 'F&B', glAccountCode: '4210',
      taxLines: [{ taxCode: 'NHIL', name: 'NHIL', amount: 5, glAccountCode: '2120' }, { taxCode: 'GETFUND', name: 'GETFund', amount: 5, glAccountCode: '2130' }, { taxCode: 'VAT', name: 'VAT', amount: 30, glAccountCode: '2110' }, { taxCode: 'TOURISM', name: 'Tourism', amount: 2, glAccountCode: '2150' }] });
    sync(books, true, charges, payments);
    expect(books.balance('4210')).toBe(-200);

    // Night 2, then a mistaken minibar charge that is voided.
    charges.push(night('2026-10-16'));
    charges.push({ id: 'MB-1', date: '2026-10-16', description: 'Minibar', amount: 50, tax: 10.5, category: 'F&B' });
    sync(books, true, charges, payments);
    charges.push({ id: 'V-1', date: '2026-10-16', description: 'VOID Minibar - wrong room', amount: -50, tax: -10.5, voidsChargeId: 'MB-1' });
    sync(books, true, charges, payments);
    expect(books.balance('4210')).toBe(-200); // minibar went to 4210 and came back off it

    // A goodwill discount reduces revenue through Allowances, with its tax.
    charges.push({ id: 'D-1', date: '2026-10-16', description: 'Discount: noisy room', amount: -100, tax: -21 });
    sync(books, true, charges, payments);
    expect(books.balance('4950')).toBe(100);

    // Card payment, then half of it refunded.
    payments.push({ id: 'P2', date: '2026-10-16', method: 'Card', amount: 1000, status: 'completed' });
    sync(books, true, charges, payments);
    expect(books.balance('1120')).toBe(1000);
    payments[1] = { ...payments[1], amount: 600 };
    payments.push({ id: 'P3', date: '2026-10-16', method: 'Card', amount: 400, status: 'refunded' });
    sync(books, true, charges, payments);
    expect(books.balance('1120')).toBe(600);

    // The meal is moved to another guest's folio: it comes off this stay exactly.
    const moved = charges.findIndex((c) => c.id === 'FB-1');
    charges.splice(moved, 1);
    sync(books, true, charges, payments);
    expect(books.balance('4210')).toBe(0);
    expect(books.balance('2150')).toBe(-20 + 1); // two nights' tourism less the discount's share

    // What the guest owes: 2 nights 2420 − discount 121 − deposit 500 − card 600 = 1199
    expect(books.balance('1215')).toBe(1199);

    // Checkout with 0.50 cash rounding up: guest ledger is cleared to receivables.
    const close = books.post(planCheckoutClose({ reservationId: RES, label: 'RES-1 Ama', guestLedgerBalance: books.balance('1215'), roundingAdjustment: 0.5, usedKeys: books.state().usedKeys, now: '2026-10-17T11:00:00.000Z' }));
    expect(close.map((e) => e.key)).toEqual([`${RES}:ROUND`, `${RES}:CLOSE`]);
    expect(books.balance('1215')).toBe(0);
    expect(books.balance('1210')).toBe(1199.5);
    expect(books.balance('4900')).toBe(-0.5);
    // Closing twice does nothing.
    expect(planCheckoutClose({ reservationId: RES, label: 'x', guestLedgerBalance: 0, roundingAdjustment: 0.5, usedKeys: books.state().usedKeys, now: 'x' })).toHaveLength(0);

    // Trial balance of this stay is zero.
    const all = books.posted.flatMap((e) => e.lines);
    expect(Math.round(all.reduce((s, l) => s + l.debit - l.credit, 0) * 100)).toBe(0);
  });

  it('a charge edited after posting only posts the difference', () => {
    const books = makeBooks();
    const charges: FolioLineJson[] = [{ id: 'L1', date: '2026-10-15', description: 'Laundry', amount: 100, tax: 21 }];
    sync(books, true, charges, []);
    charges[0] = { ...charges[0], amount: 150, tax: 31.5 };
    const delta = sync(books, true, charges, []);
    expect(delta).toHaveLength(1);
    expect(delta[0].key).toBe(`${RES}:C:L1:2`);
    expect(books.balance('4400')).toBe(-150);
    expect(books.balance('1215')).toBe(181.5);
  });

  it('billing to the company reaches receivables at checkout; a bill credit reduces revenue', () => {
    const books = makeBooks();
    sync(books, true, [night('2026-10-15')], [
      { id: 'C1', method: 'Corporate Account', amount: 1000, status: 'completed' },
      { id: 'C2', method: 'Credit', amount: 210, status: 'completed' },
    ]);
    expect(books.balance('1210')).toBe(0);
    expect(books.balance('4950')).toBe(210);
    expect(books.balance('1215')).toBe(1000);
    expect(books.balance('1110') + books.balance('1120')).toBe(0);
    books.post(planCheckoutClose({ reservationId: RES, label: 'x', guestLedgerBalance: books.balance('1215'), roundingAdjustment: 0, usedKeys: books.state().usedKeys, now: '2026-10-16' }));
    expect(books.balance('1210')).toBe(1000);
    expect(books.balance('1215')).toBe(0);
  });

  it('after checkout, refunding a stay payment reopens the receivable; new lines are left to Accounts Receivable', () => {
    const books = makeBooks();
    const charges = [night('2026-10-15')];
    const payments: FolioLineJson[] = [{ id: 'P1', method: 'Cash', amount: 1210, status: 'completed' }];
    sync(books, true, charges, payments);
    books.post(planCheckoutClose({ reservationId: RES, label: 'x', guestLedgerBalance: books.balance('1215'), roundingAdjustment: 0, usedKeys: books.state().usedKeys, now: '2026-10-16' }));
    expect(books.balance('1210')).toBe(0);

    payments[0] = { ...payments[0], status: 'refunded' };
    payments.push({ id: 'P9', method: 'Cash', amount: 50, status: 'completed' });
    charges.push({ id: 'LATE', description: 'Late minibar', amount: 20, tax: 4.2 });
    const after = books.post(planFolioPostings({ reservationId: RES, label: 'x', inHouse: true, charges, payments, state: books.state(), taxConfigs, now: '2026-10-17', afterCheckout: true }));
    expect(after).toHaveLength(1);
    expect(books.balance('1110')).toBe(0);
    expect(books.balance('1210')).toBe(1210);
    expect(books.balance('1215')).toBe(0);
  });

  it('a refunded deposit before arrival leaves nothing owed', () => {
    const books = makeBooks();
    const payments: FolioLineJson[] = [{ id: 'P1', method: 'Cash', amount: 300, status: 'completed' }];
    sync(books, false, [], payments);
    payments[0] = { ...payments[0], status: 'refunded' };
    sync(books, false, [], payments);
    expect(books.balance('2450')).toBe(0);
    expect(books.balance('1110')).toBe(0);
  });
});
