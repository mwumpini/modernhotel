/**
 * Screenshots of the app for the marketing site (public/site/*.png).
 * Usage: node scripts/capture-site-shots.mjs [baseUrl]   (default http://localhost:3000, demo hotel)
 */
import { chromium } from '@playwright/test';

const base = process.argv[2] || 'http://localhost:3000';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, colorScheme: 'light' });
// Hide the dev-server badge and the messenger button so the shots show only the product.
const tidy = () => page.addStyleTag({ content: 'nextjs-portal, [data-nextjs-toast], [data-next-badge-root]{display:none!important}' }).catch(() => {});

await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 180_000 });
await page.getByPlaceholder(/organization ID/i).fill('demo');
await page.getByPlaceholder(/email or username/i).fill('admin@demohotel.com');
await page.getByPlaceholder(/password/i).fill('password123');
await page.getByRole('button', { name: /sign in/i }).click();
await page.getByText(/LIVE OPERATIONS/i).first().waitFor({ timeout: 180_000 });
await page.waitForTimeout(5000);

const open = async (label) => {
  await page.getByRole('button', { name: label, exact: true }).or(page.getByText(label, { exact: true })).first().click();
  await page.waitForTimeout(10_000);
};

const shots = [
  { file: 'dashboard', go: async () => {} },
  { file: 'front-office', go: () => open('Front Office Operations') },
  { file: 'housekeeping', go: () => open('Housekeeping & Maintenance') },
  { file: 'accounting', go: () => open('Accounting & Finance') },
];
for (const shot of shots) {
  await shot.go();
  await tidy();
  await page.screenshot({ path: `public/site/${shot.file}.png` });
  console.log('saved', shot.file);
}
await browser.close();
