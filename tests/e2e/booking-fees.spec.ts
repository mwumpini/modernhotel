import { expect, test, type APIRequestContext } from '@playwright/test';
import { apiSignIn, hotel } from './helpers';

const day = (offset: number) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
};

type JeLine = { accountCode: string; debit: number; credit: number };
type Je = { sourceModule?: string; sourceTransactionId?: string; lines: JeLine[] };

/**
 * Cancellation and no-show fees follow the business's own settings: taken from the deposit
 * first, the rest of the deposit a refund due (paid back by staff), a bigger fee billed.
 */
test.describe.serial('Booking changes: cancellation and no-show fees', () => {
  const tag = Date.now().toString(36).toUpperCase();
  let guestId = '';

  const policy = (request: APIRequestContext, patch: Record<string, unknown>) =>
    request.post('/api/settings/room-management', { headers: hotel(), data: patch });
  const book = async (request: APIRequestContext, room: string, arrival: number) => {
    const res = await request.post('/api/reservations', {
      headers: hotel(),
      data: { guestId, roomId: room, arrival: day(arrival), departure: day(arrival + 2), status: 'confirmed' },
    });
    expect(res.status(), await res.text()).toBe(201);
    return (await res.json()).reservation.id as string;
  };
  const deposit = async (request: APIRequestContext, reservationId: string, payments: Record<string, unknown>[]) => {
    const res = await request.put('/api/folios', {
      headers: hotel(),
      data: { id: `F-FEE-${reservationId.slice(-10)}`, reservationId, currency: 'GHS', status: 'active', charges: [], payments },
    });
    expect(res.ok(), await res.text()).toBeTruthy();
  };
  const books = async (request: APIRequestContext, reservationId: string) => {
    const res = await request.get('/api/accounting/journal-entries', { headers: hotel() });
    const all = ((await res.json()).journalEntries || []) as Je[];
    const mine = all.filter((je) => je.sourceModule === 'guest_folio' && String(je.sourceTransactionId || '').startsWith(`${reservationId}:`));
    for (const je of mine) {
      const dr = je.lines.reduce((s, l) => s + Number(l.debit), 0);
      const cr = je.lines.reduce((s, l) => s + Number(l.credit), 0);
      expect(Math.round(dr * 100)).toBe(Math.round(cr * 100));
    }
    return (code: string) =>
      Math.round(mine.flatMap((e) => e.lines).filter((l) => l.accountCode === code).reduce((s, l) => s + Number(l.debit) - Number(l.credit), 0) * 100) / 100;
  };

  test.beforeEach(async ({ request }) => {
    await apiSignIn(request);
  });

  test('set the rules: 48 hours free, late fee ₵300, no-show ₵200, taxed, bill the rest', async ({ request }) => {
    const res = await policy(request, {
      cancellationPolicyEnabled: true, freeCancellationHours: 48, lateCancellationFeeType: 'flat', lateCancellationFeeValue: 300,
      noShowPolicyEnabled: true, noShowChargeType: 'flat', noShowChargeValue: 200,
      bookingFeesTaxable: true, bookingFeesDepositOnly: false,
    });
    expect(res.ok(), await res.text()).toBeTruthy();
    const guest = await request.post('/api/guests', { headers: hotel(), data: { firstName: 'Esi', lastName: 'Fees', phone: '0240000002' } });
    guestId = (await guest.json()).guest.id;
  });

  test('late cancellation: the fee comes from the deposit, the rest is a refund due', async ({ request }) => {
    const id = await book(request, `FEE-A-${tag}`, 1);
    await deposit(request, id, [{ id: 'DEP', date: new Date().toISOString(), method: 'Mobile Money', amount: 500, status: 'completed' }]);
    const res = await request.patch(`/api/reservations/${id}`, { headers: hotel(), data: { status: 'cancelled' } });
    expect(res.ok(), await res.text()).toBeTruthy();
    const settlement = (await res.json()).settlement;
    expect(settlement.fee).toEqual({ net: 300, tax: 63, gross: 363 });
    expect(settlement.refundDue).toBe(137);

    let bal = await books(request, id);
    expect(bal('1130')).toBe(500);
    expect(bal('4150')).toBe(-300);
    expect(bal('2450')).toBe(-137);

    // Staff refund what is left: the deposit liability clears.
    await deposit(request, id, [
      { id: 'DEP', date: new Date().toISOString(), method: 'Mobile Money', amount: 363, status: 'completed' },
      { id: 'REF', date: new Date().toISOString(), method: 'Mobile Money', amount: 137, status: 'refunded' },
    ]);
    bal = await books(request, id);
    expect(bal('2450')).toBe(0);
    expect(bal('1130')).toBe(363);

    // Cancelling again changes nothing.
    const again = await request.patch(`/api/reservations/${id}`, { headers: hotel(), data: { status: 'cancelled' } });
    expect((await again.json()).settlement?.alreadySettled).toBe(true);
  });

  test('cancelled inside the free window: no fee, the whole deposit is a refund due', async ({ request }) => {
    const id = await book(request, `FEE-B-${tag}`, 6);
    await deposit(request, id, [{ id: 'DEP', date: new Date().toISOString(), method: 'Cash', amount: 100, status: 'completed' }]);
    const res = await request.patch(`/api/reservations/${id}`, { headers: hotel(), data: { status: 'cancelled' } });
    expect((await res.json()).settlement.fee.gross).toBe(0);
    const bal = await books(request, id);
    expect(bal('2450')).toBe(-100);
    expect(bal('4150')).toBe(0);
  });

  test('no-show fee bigger than the deposit: the deposit is kept and the rest billed', async ({ request }) => {
    const id = await book(request, `FEE-C-${tag}`, 0);
    await deposit(request, id, [{ id: 'DEP', date: new Date().toISOString(), method: 'Cash', amount: 100, status: 'completed' }]);
    const res = await request.patch(`/api/reservations/${id}`, { headers: hotel(), data: { status: 'no-show' } });
    expect(res.ok(), await res.text()).toBeTruthy();
    const s = (await res.json()).settlement;
    expect(s.fee.gross).toBe(242);
    expect(s.fromDeposit.gross).toBe(100);
    expect(s.billed.gross).toBe(142);
    const bal = await books(request, id);
    expect(bal('2450')).toBe(0);
    expect(bal('1210')).toBe(142);
    expect(bal('4150')).toBe(-200);
  });

  test('put the rules back', async ({ request }) => {
    const res = await policy(request, { cancellationPolicyEnabled: false, noShowPolicyEnabled: false });
    expect(res.ok()).toBeTruthy();
  });
});
