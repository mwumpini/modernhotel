import { expect, test } from '@playwright/test';
import { uiSignIn } from './helpers';

// Every module opens in a real browser without crashing.
const MODULES = [
  'Front Office Operations',
  'Events & Conferences',
  'Restaurant & Bar',
  'Kitchen',
  'Housekeeping & Maintenance',
  'Inventory & Stores',
  'Security Operations',
  'HR & Payroll',
  'Accounting & Finance',
  'Compliance & Reports',
  'System Settings',
];

const CRASH = /Something went wrong|Application error|Unhandled Runtime Error|client-side exception/i;

test('sign in and open every module', async ({ page }) => {
  test.setTimeout(8 * 60_000);
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await uiSignIn(page);

  for (const name of MODULES) {
    await test.step(name, async () => {
      // The sidebar entry (an icon button when the sidebar is folded, text when open).
      const entry = page.getByRole('button', { name, exact: true }).or(page.getByText(name, { exact: true })).first();
      await entry.click({ timeout: 30_000 });
      const pane = page.locator('.work-pane');
      // The module's own title shows in the work area, e.g. "Front Office" or "Kitchen".
      await expect(pane.locator('h2').first()).toContainText(name.split(/ (&|Operations|Management)/)[0].split(' ')[0], { timeout: 90_000 });
      // The module has finished loading once its "Loading…" placeholder is gone.
      await expect(pane.getByText(/^Loading/)).toHaveCount(0, { timeout: 90_000 });
      await expect(pane).not.toContainText(CRASH);
      expect(pageErrors, `browser errors while opening ${name}`).toEqual([]);
    });
  }
});

test('a wrong password is refused', async ({ page }) => {
  await page.goto('/');
  await page.getByPlaceholder(/organization ID/i).fill('demo');
  await page.getByPlaceholder(/email or username/i).fill('admin@demohotel.com');
  await page.getByPlaceholder(/password/i).fill('not-the-password');
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page.getByText(/invalid|incorrect|wrong|failed/i).first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/Executive Management/i)).toHaveCount(0);
});
