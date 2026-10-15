import { expect, test, type APIRequestContext } from '@playwright/test';
import { apiSignIn, hotel } from './helpers';

// A bar sale from stock to books: receive bottles, sell two, bill in cash, then refund.
test.describe.serial('Restaurant sale: stock, tax, books, refund', () => {
  const code = `E2E-COLA-${Date.now().toString(36).toUpperCase()}`;
  let itemId = '';
  let locationId = '';
  let menuItemId = '';
  let orderId = '';
  let orderNumber = '';
  let shiftId = '';

  const onHand = async (request: APIRequestContext) => {
    const res = await request.get(`/api/inventory/stock-levels?department=restaurant`, { headers: hotel() });
    expect(res.ok()).toBeTruthy();
    const rows = (await res.json()).items as Array<{ id: string; onHand: number }>;
    return Number(rows.find((row) => row.id === itemId)?.onHand ?? 0);
  };

  test.beforeEach(async ({ request }) => {
    await apiSignIn(request);
  });

  test('receive 24 bottles into the restaurant', async ({ request }) => {
    // A run against a reused server may have left a restaurant till open; close it first.
    const shifts = (await (await request.get('/api/frontoffice/cashier-shifts?outlet=restaurant', { headers: hotel() })).json()).shifts || [];
    for (const open of shifts.filter((sh: { status: string; outlet?: string }) => sh.status === 'open' && sh.outlet === 'restaurant')) {
      await request.patch(`/api/frontoffice/cashier-shifts/${open.id}`, { headers: hotel(), data: { action: 'close', closingCount: 0 } });
    }

    const item = await request.post('/api/inventory/items', {
      headers: hotel(),
      data: { code, name: 'E2E Cola 350ml', unit: 'bottle', defaultCost: 4, sellingPrice: 12.1 },
    });
    expect(item.status(), await item.text()).toBe(201);
    itemId = (await item.json()).item.id;

    // Asking for restaurant stock first makes sure the department locations exist.
    const levels = await request.get('/api/inventory/stock-levels?department=restaurant', { headers: hotel() });
    expect(levels.ok()).toBeTruthy();
    const location = await request.get('/api/inventory/stock-locations', { headers: hotel() });
    const locations = ((await location.json()).locations || []) as Array<{ id: string; code?: string }>;
    // The restaurant's own floor stock (Settings → Stock Locations, code RESTAURANT).
    locationId = locations.find((loc) => loc.code === 'RESTAURANT')?.id || '';
    expect(locationId, 'a restaurant stock location').not.toBe('');

    const receive = await request.post('/api/inventory/stock-transactions', {
      headers: hotel(),
      data: { itemId, locationId, type: 'receipt', quantity: 24, unitCost: 4, referenceType: 'e2e', referenceId: code },
    });
    expect(receive.ok(), await receive.text()).toBeTruthy();
    expect(await onHand(request)).toBe(24);
  });

  test('put it on the bar menu at ₵12.10, tax included', async ({ request }) => {
    const menu = await request.post('/api/fb/menu', {
      headers: hotel(),
      data: {
        code, name: 'E2E Cola', category: 'beverage', venue: 'bar', route: 'bar',
        unitPrice: 12.1, priceIncludesTax: true, inventoryItemId: itemId, stockLocationId: locationId,
      },
    });
    expect(menu.ok(), await menu.text()).toBeTruthy();
    menuItemId = (await menu.json()).item?.id;
    expect(menuItemId).toBeTruthy();
  });

  test('order two: the bill is ₵24.20 with ₵4.20 tax', async ({ request }) => {
    const order = await request.post('/api/fb/orders', {
      headers: hotel(),
      data: { venue: 'bar', tableNumber: 'E2E', items: [{ menuItemId, name: 'E2E Cola', quantity: 2, unitPrice: 12.1, route: 'bar' }] },
    });
    expect(order.status(), await order.text()).toBe(201);
    const created = (await order.json()).order;
    orderId = created.id;
    orderNumber = created.orderNumber;
    expect(Number(created.total)).toBeCloseTo(24.2, 2);
    expect(Number(created.taxAmount)).toBeCloseTo(4.2, 2);
    expect(await onHand(request), 'stock only leaves when the bill is paid').toBe(24);
  });

  test('cash is refused until a Restaurant / Bar till is open', async ({ request }) => {
    for (const status of ['ready', 'served']) {
      const step = await request.patch(`/api/fb/orders/${orderId}`, { headers: hotel(), data: { status } });
      expect(step.ok(), `${status}: ${await step.text()}`).toBeTruthy();
    }
    const noTill = await request.patch(`/api/fb/orders/${orderId}`, {
      headers: hotel(),
      data: { status: 'billed', paymentMethod: 'Cash' },
    });
    expect(noTill.status()).toBe(403);
    expect(await onHand(request), 'nothing leaves stock on a refused bill').toBe(24);

    const till = await request.post('/api/frontoffice/cashier-shifts', {
      headers: hotel(),
      data: { outlet: 'restaurant', openingFloat: 100, notes: 'E2E till' },
    });
    expect(till.ok(), await till.text()).toBeTruthy();
    shiftId = (await till.json()).shift?.id;
    expect(shiftId, 'an open till').toBeTruthy();
  });

  test('serve and bill in cash: two bottles leave stock and the sale reaches the books', async ({ request }) => {
    const billed = await request.patch(`/api/fb/orders/${orderId}`, {
      headers: hotel(),
      data: { status: 'billed', paymentMethod: 'Cash' },
    });
    expect(billed.ok(), await billed.text()).toBeTruthy();
    const result = await billed.json();
    expect(result.accounting?.receiptId || result.accounting?.invoiceId, 'a receipt or invoice in the books').toBeTruthy();
    expect(Number(result.cogs?.amount)).toBeCloseTo(8, 2);
    expect(await onHand(request)).toBe(22);

    const journals = await request.get('/api/accounting/journal-entries', { headers: hotel() });
    expect(journals.ok()).toBeTruthy();
    expect(JSON.stringify(await journals.json())).toContain(orderNumber);
  });

  test('billing twice never takes stock twice', async ({ request }) => {
    const again = await request.patch(`/api/fb/orders/${orderId}`, {
      headers: hotel(),
      data: { status: 'billed', paymentMethod: 'Cash' },
    });
    expect(again.status()).toBeLessThan(500);
    expect(await onHand(request)).toBe(22);
  });

  test('a refund puts the two bottles back', async ({ request }) => {
    const refund = await request.patch(`/api/fb/orders/${orderId}`, {
      headers: hotel(),
      data: { status: 'refunded', refundReason: 'E2E test refund' },
    });
    expect(refund.ok(), await refund.text()).toBeTruthy();
    expect(await onHand(request)).toBe(24);
  });

  test('the till closes balanced: ₵100 float + ₵24.20 sale - ₵24.20 refund', async ({ request }) => {
    const close = await request.patch(`/api/frontoffice/cashier-shifts/${shiftId}`, {
      headers: hotel(),
      data: { action: 'close', closingCount: 100, notes: 'E2E close' },
    });
    expect(close.ok(), await close.text()).toBeTruthy();
    const shift = (await close.json()).shift;
    expect(shift?.status).toBe('closed');
    expect(Number(shift?.variance ?? 0)).toBeCloseTo(0, 2);
  });
});
