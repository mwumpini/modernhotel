import { expect, test } from '@playwright/test';
import { apiSignIn, hotel, RIVAL } from './helpers';

// One hotel must never read or change another hotel's data.
test.describe('Hotel data separation', () => {
  test('no sign-in, no data', async ({ request }) => {
    const res = await request.get('/api/fb/menu', { headers: hotel('demo') });
    expect(res.status()).toBe(401);
  });

  test('Demo staff asking for Rival Lodge are refused', async ({ request }) => {
    await apiSignIn(request);
    for (const path of ['/api/fb/menu', '/api/fb/orders', '/api/guests', '/api/accounting/journal-entries']) {
      const res = await request.get(path, { headers: hotel('rival') });
      expect(res.status(), `${path} for another hotel`).toBe(403);
    }
  });

  test('Demo staff cannot write into Rival Lodge', async ({ request }) => {
    await apiSignIn(request);
    const res = await request.post('/api/fb/menu', {
      headers: hotel('rival'),
      data: { code: 'HACK', name: 'Injected', category: 'food', venue: 'bar', unitPrice: 1 },
    });
    expect(res.status()).toBe(403);
  });

  test("Demo's own menu never includes Rival Lodge's items", async ({ request }) => {
    await apiSignIn(request);
    const res = await request.get('/api/fb/menu', { headers: hotel('demo') });
    expect(res.ok()).toBeTruthy();
    expect(JSON.stringify(await res.json())).not.toContain('Rival Secret Cocktail');
  });

  test('Rival Lodge sees its own item, and only with its own sign-in', async ({ request }) => {
    await apiSignIn(request, RIVAL);
    const res = await request.get('/api/fb/menu', { headers: hotel('rival') });
    expect(res.ok()).toBeTruthy();
    expect(JSON.stringify(await res.json())).toContain('Rival Secret Cocktail');
  });
});
