/**
 * Screenshots of the app for the marketing site (public/site/*.png).
 * Usage: node scripts/capture-site-shots.mjs [baseUrl] [light|dark]   (default http://localhost:3000, light)
 * The theme is whatever the demo admin account uses; the second argument only picks the folder.
 * Desktop shots go to public/site/{folder}/; tablet and phone shots to public/site/{folder}/devices/.
 */
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const base = process.argv[2] || 'http://localhost:3000';
const folder = process.argv[3] === 'dark' ? 'dark' : 'light';
mkdirSync(`public/site/${folder}/devices`, { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, colorScheme: 'light' });
const page = await context.newPage();
// Hide the dev-server badge so the shots show only the product.
const tidy = (p = page) => p.addStyleTag({ content: 'nextjs-portal, [data-nextjs-toast], [data-next-badge-root]{display:none!important}' }).catch(() => {});

await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 180_000 });
await page.getByPlaceholder(/organization ID/i).fill('demo');
await page.getByPlaceholder(/email or username/i).fill('admin@demohotel.com');
await page.getByPlaceholder(/password/i).fill('password123');
await page.getByRole('button', { name: /sign in/i }).click();
await page.getByText(/LIVE OPERATIONS/i).first().waitFor({ timeout: 180_000 });
await page.waitForTimeout(5000);

const open = async (label, p = page) => {
  await p.getByRole('button', { name: label, exact: true }).or(p.getByText(label, { exact: true })).first().click();
  await p.waitForTimeout(10_000);
};

const only = process.argv[4]; // optional: 'desktop' or 'devices'
if (only !== 'devices') {
  const shots = [
    { file: 'dashboard', go: async () => {} },
    { file: 'front-office', go: () => open('Front Office Operations') },
    { file: 'housekeeping', go: () => open('Housekeeping & Maintenance') },
    { file: 'accounting', go: () => open('Accounting & Finance') },
  ];
  for (const shot of shots) {
    await shot.go();
    await tidy();
    await page.screenshot({ path: `public/site/${folder}/${shot.file}.png` });
    console.log('saved', shot.file);
  }
}

if (only !== 'desktop') {
  const storageState = await context.storageState();
  const devices = [
    { name: 'tablet', viewport: { width: 1024, height: 768 }, mobile: false },
    { name: 'phone', viewport: { width: 390, height: 844 }, mobile: true },
  ];
  for (const d of devices) {
    const ctx = await browser.newContext({ storageState, viewport: d.viewport, deviceScaleFactor: 2, isMobile: d.mobile, hasTouch: true, colorScheme: 'light' });
    const p = await ctx.newPage();
    await p.goto(base, { waitUntil: 'domcontentloaded', timeout: 180_000 });
    await p.getByText(/LIVE OPERATIONS/i).first().waitFor({ timeout: 180_000 }).catch(() => {});
    await p.waitForTimeout(8000);
    await tidy(p);
    await p.screenshot({ path: `public/site/${folder}/devices/${d.name}.png` });
    console.log('saved', d.name);
    await ctx.close();
  }
}
await browser.close();
