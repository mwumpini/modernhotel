import { expect, test } from '@playwright/test';
import { apiSignIn, hotel } from './helpers';

const day = (offset: number) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
};

// A stay from booking to checkout, with a bar bill charged to the room.
test.describe.serial('Front office: book, check in, charge to room, night audit, check out', () => {
  // A room number of its own each run, so a reused test server never sees a clash.
  const room = `E2E-${Date.now().toString(36).toUpperCase()}`;
  let guestId = '';
  let reservationId = '';

  test.beforeEach(async ({ request }) => {
    await apiSignIn(request);
  });

  test('book the room for tonight', async ({ request }) => {
    const guest = await request.post('/api/guests', {
      headers: hotel(),
      data: { firstName: 'Ama', lastName: 'Mensah', phone: '0240000000' },
    });
    expect(guest.status(), await guest.text()).toBe(201);
    guestId = (await guest.json()).guest.id;

    const booking = await request.post('/api/reservations', {
      headers: hotel(),
      data: { guestId, roomId: room, arrival: day(0), departure: day(1), status: 'confirmed' },
    });
    expect(booking.status(), await booking.text()).toBe(201);
    reservationId = (await booking.json()).reservation.id;
  });

  test('the same room cannot be booked twice for the same night', async ({ request }) => {
    const clash = await request.post('/api/reservations', {
      headers: hotel(),
      data: { guestId, roomId: room, arrival: day(0), departure: day(2), status: 'confirmed' },
    });
    expect(clash.status()).toBe(409);
  });

  test('a stay cannot end before it starts', async ({ request }) => {
    const wrong = await request.post('/api/reservations', {
      headers: hotel(),
      data: { guestId, roomId: `${room}-B`, arrival: day(2), departure: day(1) },
    });
    expect(wrong.status()).toBe(400);
  });

  test('check in', async ({ request }) => {
    const res = await request.patch(`/api/reservations/${reservationId}`, {
      headers: hotel(),
      data: { status: 'checked-in' },
    });
    expect(res.ok(), await res.text()).toBeTruthy();
    expect((await res.json()).reservation.status).toBe('checked-in');
  });

  test('a bar bill charged to the room lands on the guest folio, with no till needed', async ({ request }) => {
    const menu = await request.get('/api/fb/menu', { headers: hotel() });
    const items = ((await menu.json()).items || []) as Array<{ id: string; name: string; unitPrice: number }>;
    expect(items.length, 'seeded menu items').toBeGreaterThan(0);
    const dish = items[0];

    const order = await request.post('/api/fb/orders', {
      headers: hotel(),
      data: {
        venue: 'restaurant', roomNumber: room, reservationId, guestId, guestName: 'Ama Mensah',
        items: [{ menuItemId: dish.id, name: dish.name, quantity: 1, unitPrice: Number(dish.unitPrice) }],
      },
    });
    expect(order.status(), await order.text()).toBe(201);
    const created = (await order.json()).order;

    for (const status of ['ready', 'served']) {
      const step = await request.patch(`/api/fb/orders/${created.id}`, { headers: hotel(), data: { status } });
      expect(step.ok(), `${status}: ${await step.text()}`).toBeTruthy();
    }
    const billed = await request.patch(`/api/fb/orders/${created.id}`, {
      headers: hotel(),
      data: { status: 'billed', paymentMethod: 'Room Charge' },
    });
    expect(billed.ok(), await billed.text()).toBeTruthy();

    const folios = await request.get('/api/folios', { headers: hotel() });
    expect(folios.ok()).toBeTruthy();
    const folio = ((await folios.json()).folios || []).find((f: { reservationId?: string }) => f.reservationId === reservationId);
    expect(folio, 'a folio for the stay').toBeTruthy();
    expect(JSON.stringify(folio)).toContain(`FB-${created.orderNumber}`);
  });

  test('the night audit runs', async ({ request }) => {
    const audit = await request.post('/api/frontoffice/night-audit/run', { headers: hotel(), data: {} });
    expect(audit.ok(), await audit.text()).toBeTruthy();
    expect((await audit.json()).result).toBeTruthy();
  });

  test('check out frees the room for the next guest', async ({ request }) => {
    const out = await request.patch(`/api/reservations/${reservationId}`, {
      headers: hotel(),
      data: { status: 'checked-out' },
    });
    expect(out.ok(), await out.text()).toBeTruthy();

    const next = await request.post('/api/reservations', {
      headers: hotel(),
      data: { guestId, roomId: room, arrival: day(1), departure: day(2), status: 'confirmed' },
    });
    expect(next.status(), await next.text()).toBe(201);
  });
});
