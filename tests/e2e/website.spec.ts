import { expect, test } from '@playwright/test';

// The public website and its demo request form (no sign-in).
test.describe('Website', () => {
  test('the site opens without signing in, with the demo form and WhatsApp', async ({ page }) => {
    await page.goto('/site');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Run your whole business');
    await expect(page.locator('#demo form')).toBeVisible();
    await expect(page.locator('a[href^="https://wa.me/4915255641215"]').first()).toBeVisible();
  });

  test('a demo request is saved', async ({ page }) => {
    await page.goto('/site#demo');
    await page.locator('#name').fill('Ama Mensah');
    await page.locator('#hotelName').fill('E2E Test Lodge');
    await page.locator('#whatsapp').fill('+233 24 000 0000');
    await page.locator('#rooms').fill('18');
    await page.getByRole('button', { name: 'Request a demo' }).last().click();
    await expect(page.getByText('We’ll be in touch shortly')).toBeVisible();
  });

  test('a request needs a name, a hotel and a way to reach them', async ({ request }) => {
    const noHotel = await request.post('/api/demo-request', { data: { name: 'Kofi', whatsapp: '0240000000' } });
    expect(noHotel.status()).toBe(400);
    const noContact = await request.post('/api/demo-request', { data: { name: 'Kofi', hotelName: 'Lodge' } });
    expect(noContact.status()).toBe(400);
    const badEmail = await request.post('/api/demo-request', { data: { name: 'Kofi', hotelName: 'Lodge', email: 'not-an-email' } });
    expect(badEmail.status()).toBe(400);
  });

  test('bots that fill the hidden field are quietly ignored', async ({ request }) => {
    const bot = await request.post('/api/demo-request', {
      data: { name: 'Bot', hotelName: 'Spam', email: 'bot@spam.test', website: 'http://spam.test' },
    });
    expect(bot.ok()).toBeTruthy();
    expect((await bot.json()).id).toBeUndefined();
  });
});
