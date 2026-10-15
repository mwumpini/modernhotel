import { expect, test } from '@playwright/test';
import { uiSignIn } from './helpers';

const money = (text: string) => Number((text.match(/[\d,]+\.\d{2}/)?.[0] || '0').replace(/,/g, ''));

// The Financial Pulse once showed GHS 3,300 of made-up room charges on every hotel. What it
// calls "billed today" must be exactly the charges the hotel's folios really hold for today.
test('Financial Pulse shows only real charges', async ({ page }) => {
  await uiSignIn(page);
  const line = page.getByText(/Billed on guest folios today/).first();
  await expect(line).toBeVisible({ timeout: 60_000 });

  // The dashboard shows the hotel's business date, which the night audit moves on; compare that day.
  const dateInput = page.locator('input[type="date"]').first();
  await expect(dateInput).not.toHaveValue('');
  const today = await dateInput.inputValue();
  const res = await page.request.get('/api/folios', { headers: { 'x-tenant-subdomain': 'demo' } });
  expect(res.ok()).toBeTruthy();
  const folios = ((await res.json()).folios || []) as Array<{ charges?: Array<{ date?: string; amount?: number; tax?: number }> }>;
  const real = folios
    .flatMap((f) => f.charges || [])
    .filter((c) => (c.date || '').slice(0, 10) === today)
    .reduce((sum, c) => sum + Number(c.amount || 0) + Number(c.tax || 0), 0);

  await expect.poll(async () => money((await line.textContent()) || ''), { timeout: 30_000 }).toBeCloseTo(real, 2);
});
