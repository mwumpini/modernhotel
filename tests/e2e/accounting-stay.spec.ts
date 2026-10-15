import { expect, test, type APIRequestContext } from '@playwright/test';
import { apiSignIn, hotel } from './helpers';

const day = (offset: number) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
};

type JeLine = { accountCode: string; debit: number; credit: number };
type Je = { id: string; sourceModule?: string; sourceTransactionId?: string; status: string; lines: JeLine[] };

/**
 * IFRS 15 in the real app: a deposit is a liability until arrival, each charge is revenue on
 * its own day, payments post when taken, and checkout moves what is still owed to receivables.
 * Checked through the actual journal the server writes.
 */
test.describe.serial('Accounting: a stay posts as it happens (IFRS 15)', () => {
  const room = `ACC-${Date.now().toString(36).toUpperCase()}`;
  let reservationId = '';
  const folioId = `F-E2E-${Date.now().toString(36)}`;
  const charges: Record<string, unknown>[] = [];
  const payments: Record<string, unknown>[] = [];

  const stayEntries = async (request: APIRequestContext): Promise<Je[]> => {
    const res = await request.get('/api/accounting/journal-entries', { headers: hotel() });
    expect(res.ok(), await res.text()).toBeTruthy();
    const all = ((await res.json()).journalEntries || []) as Je[];
    return all.filter((je) => je.sourceModule === 'guest_folio' && String(je.sourceTransactionId || '').startsWith(`${reservationId}:`));
  };
  const balance = (entries: Je[], code: string) =>
    Math.round(entries.flatMap((e) => e.lines).filter((l) => l.accountCode === code).reduce((s, l) => s + Number(l.debit) - Number(l.credit), 0) * 100) / 100;
  const saveFolio = async (request: APIRequestContext) => {
    const res = await request.put('/api/folios', {
      headers: hotel(),
      data: { id: folioId, reservationId, currency: 'GHS', status: 'active', charges, payments },
    });
    expect(res.ok(), await res.text()).toBeTruthy();
  };

  test.beforeEach(async ({ request }) => {
    await apiSignIn(request);
  });

  test('a deposit before arrival is held as a liability', async ({ request }) => {
    const guest = await request.post('/api/guests', { headers: hotel(), data: { firstName: 'Kofi', lastName: 'Ledger', phone: '0240000001' } });
    expect(guest.status(), await guest.text()).toBe(201);
    const booking = await request.post('/api/reservations', {
      headers: hotel(),
      data: { guestId: (await guest.json()).guest.id, roomId: room, arrival: day(0), departure: day(2), status: 'confirmed' },
    });
    expect(booking.status(), await booking.text()).toBe(201);
    reservationId = (await booking.json()).reservation.id;

    payments.push({ id: 'DEP-1', date: new Date().toISOString(), method: 'Mobile Money', amount: 500, status: 'completed' });
    await saveFolio(request);
    const entries = await stayEntries(request);
    expect(balance(entries, '2450')).toBe(-500);
    expect(balance(entries, '1130')).toBe(500);
    expect(balance(entries, '4100')).toBe(0);
  });

  test('on check-in the deposit counts against the stay', async ({ request }) => {
    const res = await request.patch(`/api/reservations/${reservationId}`, { headers: hotel(), data: { status: 'checked-in' } });
    expect(res.ok(), await res.text()).toBeTruthy();
    const entries = await stayEntries(request);
    expect(balance(entries, '2450')).toBe(0);
    expect(balance(entries, '1215')).toBe(-500);
  });

  test('a room night and a service are revenue on the day, with each levy separate', async ({ request }) => {
    charges.push({ id: 'ROOM-N1', date: new Date().toISOString(), description: `Room Charge — ${day(0)}`, amount: 1000, tax: 210, category: 'room', glAccountCode: '4100' });
    charges.push({ id: 'LAUNDRY-1', date: new Date().toISOString(), description: 'Laundry', amount: 100, tax: 21 });
    await saveFolio(request);
    const entries = await stayEntries(request);
    expect(balance(entries, '4100')).toBe(-1000);
    expect(balance(entries, '4400')).toBe(-100);
    expect(balance(entries, '2110')).toBe(-165);
    expect(balance(entries, '2120')).toBe(-27.5);
    expect(balance(entries, '2130')).toBe(-27.5);
    expect(balance(entries, '2150')).toBe(-11);
    expect(balance(entries, '1215')).toBe(831);
  });

  test('a card payment posts when taken, and saving again posts nothing new', async ({ request }) => {
    payments.push({ id: 'CARD-1', date: new Date().toISOString(), method: 'Card', amount: 700, status: 'completed' });
    await saveFolio(request);
    const before = await stayEntries(request);
    expect(balance(before, '1120')).toBe(700);
    expect(balance(before, '1215')).toBe(131);

    await saveFolio(request);
    const sync = await request.post('/api/frontoffice/folio-ledger', { headers: hotel(), data: { reservationId } });
    expect(sync.ok(), await sync.text()).toBeTruthy();
    expect((await sync.json()).result.posted).toBe(0);
    expect((await stayEntries(request)).length).toBe(before.length);
  });

  test('every entry balances', async ({ request }) => {
    for (const je of await stayEntries(request)) {
      const dr = je.lines.reduce((s, l) => s + Number(l.debit), 0);
      const cr = je.lines.reduce((s, l) => s + Number(l.credit), 0);
      expect(Math.round(dr * 100), je.id).toBe(Math.round(cr * 100));
      expect(je.status).toBe('Posted');
    }
  });

  test('checkout moves what is still owed to receivables, once', async ({ request }) => {
    const out = await request.post('/api/frontoffice/folio-ledger', { headers: hotel(), data: { reservationId, checkout: true, roundingAdjustment: 0 } });
    expect(out.ok(), await out.text()).toBeTruthy();
    let entries = await stayEntries(request);
    expect(balance(entries, '1215')).toBe(0);
    expect(balance(entries, '1210')).toBe(131);

    const again = await request.post('/api/frontoffice/folio-ledger', { headers: hotel(), data: { reservationId, checkout: true, roundingAdjustment: 0 } });
    expect((await again.json()).result.posted).toBe(0);
    await request.patch(`/api/reservations/${reservationId}`, { headers: hotel(), data: { status: 'checked-out' } });
    entries = await stayEntries(request);
    expect(balance(entries, '1210')).toBe(131);
  });

  test('the old all-at-checkout entry is refused for this stay', async ({ request }) => {
    const res = await request.post('/api/accounting/journal-entries', {
      headers: hotel(),
      data: {
        entryNumber: `JE-OLD-${Date.now()}`, date: new Date().toISOString(), status: 'Posted', sourceModule: 'front_office_checkout', sourceTransactionId: reservationId,
        lines: [{ accountCode: '1210', debit: 10, credit: 0 }, { accountCode: '4100', debit: 0, credit: 10 }],
      },
    });
    expect(res.status()).toBe(409);
  });
});
