import { expect, type APIRequestContext, type Page } from '@playwright/test';

export const DEMO = { org: 'demo', email: 'admin@demohotel.com', password: 'password123' };
export const RIVAL = { org: 'rival', email: 'admin@rival.test', password: 'rival-pass-123' };

/** Signs in through NextAuth's credentials endpoint; the request context keeps the session cookie. */
export async function apiSignIn(request: APIRequestContext, who = DEMO) {
  const csrf = await (await request.get('/api/auth/csrf')).json();
  const res = await request.post('/api/auth/callback/credentials', {
    form: { csrfToken: csrf.csrfToken, email: who.email, password: who.password, tenantId: who.org, json: 'true' },
  });
  expect(res.ok(), `sign-in for ${who.email}`).toBeTruthy();
  const session = await (await request.get('/api/auth/session')).json();
  expect(session?.user?.email, 'a session after sign-in').toBe(who.email);
}

/** Headers every hotel API call carries: which hotel the request is for. */
export function hotel(org: string = DEMO.org) {
  return { 'x-tenant-subdomain': org, 'content-type': 'application/json' };
}

/** Signs in through the real sign-in page. */
export async function uiSignIn(page: Page, who = DEMO) {
  await page.goto('/');
  await page.getByPlaceholder(/organization ID/i).fill(who.org);
  await page.getByPlaceholder(/email or username/i).fill(who.email);
  await page.getByPlaceholder(/password/i).fill(who.password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page.getByText(/Executive Management/i).first()).toBeVisible({ timeout: 60_000 });
}
