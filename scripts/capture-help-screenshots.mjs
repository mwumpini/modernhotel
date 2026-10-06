// Captures the Help / manual screenshots into public/help-images from a running local app.
// Uses the Microsoft Edge (or Chrome) already on this computer through its debugging port —
// no extra packages. Run with the dev server up and sample data loaded:
//   node scripts/capture-help-screenshots.mjs            (all shots)
//   node scripts/capture-help-screenshots.mjs front-checkin rooms-pricing   (only these)
// Sign-in uses the local demo login (override with HELP_SHOT_TENANT / _USER / _PASSWORD).
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const APP = process.env.HELP_SHOT_URL || 'http://localhost:3000';
const TENANT = process.env.HELP_SHOT_TENANT || 'demo';
const USER = process.env.HELP_SHOT_USER || 'admin@demohotel.com';
const PASSWORD = process.env.HELP_SHOT_PASSWORD || 'password123';
const OUT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..', 'public', 'help-images');
const PORT = 9400 + Math.floor(Math.random() * 400); // own port per run
const BROWSERS = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
];

// Each shot: open a side-menu area and its item (as a person would), optionally a tab, then clicks.
const SHOTS = [
  { file: 'executive.png', menu: ['Executive Management', 'Main Dashboard'] },
  { file: 'front-office.png', menu: ['Front Office Operations', 'Desk'] },
  { file: 'front-checkin.png', menu: ['Front Office Operations', 'Desk'], clicks: ['Check-in'], openFirstRow: true },
  { file: 'front-checkout.png', menu: ['Front Office Operations', 'Desk'], clicks: ['All Dates', 'In-house'], openFirstRow: true },
  { file: 'front-transfer.png', menu: ['Front Office Operations', 'Desk'], tab: 'Room Transfer' },
  { file: 'front-audit.png', menu: ['Front Office Operations', 'Night'] },
  { file: 'housekeeping.png', menu: ['Housekeeping & Maintenance', 'Floor'] },
  { file: 'hk-clean.png', menu: ['Housekeeping & Maintenance', 'Work'] },
  { file: 'restaurant.png', menu: ['Restaurant & Bar', 'Service'] },
  { file: 'fb-order.png', menu: ['Restaurant & Bar', 'POS Terminal'], wait: 12000 },
  { file: 'kitchen.png', menu: ['Kitchen', 'Kitchen Display'] },
  { file: 'events.png', menu: ['Events & Conferences', 'Events'] },
  { file: 'inventory.png', menu: ['Inventory & Stores', 'Stock'] },
  { file: 'inv-count.png', menu: ['Kitchen', 'Supplies'] },
  { file: 'security.png', menu: ['Security Operations', 'Watch'] },
  { file: 'hr.png', menu: ['HR & Payroll', 'People'] },
  { file: 'hr-payroll.png', menu: ['HR & Payroll', 'Payroll'] },
  { file: 'accounting.png', menu: ['Accounting & Finance', 'Receivable'] },
  { file: 'acc-payable.png', menu: ['Accounting & Finance', 'Payable'] },
  { file: 'acc-journal.png', menu: ['Accounting & Finance', 'Books'], tab: 'Journal' },
  { file: 'compliance.png', menu: ['Compliance & Reports', 'Tax'] },
  { file: 'paye.png', menu: ['Compliance & Reports', 'Payroll'] },
  { file: 'compliance-reports.png', menu: ['Compliance & Reports', 'Reports & Analysis'] },
  { file: 'settings.png', menu: ['System Settings', 'System Setup'] },
  { file: 'users.png', menu: ['System Settings', 'People'], tab: 'User Management' },
  { file: 'rooms-pricing.png', menu: ['System Settings', 'Rooms'] },
  { file: 'numbering.png', menu: ['System Settings', 'Documents'], tab: 'Document Numbering' },
  { file: 'security-settings.png', menu: ['System Settings', 'Security'] },
  // Last: the desk remembers an open summary, which would show in every later Front Office shot.
  { file: 'desk-summary.png', menu: ['Front Office Operations', 'Desk'], clicks: ['Show summary'] },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function cdp(wsUrl) {
  const ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0;
  const pending = new Map();
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
    }
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const n = ++id;
    pending.set(n, { resolve, reject });
    ws.send(JSON.stringify({ id: n, method, params }));
  });
  const evaluate = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    return r.result?.value;
  };
  return { send, evaluate, close: () => ws.close() };
}

// In-page helpers: click the smallest visible element whose text matches.
const CLICK_TEXT = `(text, exact) => {
  const norm = (s) => (s || '').replace(/\\s+/g, ' ').trim();
  const strip = (s) => norm(s).replace(/^[^A-Za-z0-9]+/, '');
  const all = Array.from(document.querySelectorAll('button, a, [role=tab], [role=button], li, div, span'));
  const hits = all.filter((el) => {
    if (!el.offsetParent && el.tagName !== 'BODY') return false;
    const t = strip(el.textContent);
    return exact ? t === text : t === text || t.startsWith(text + ' (');
  });
  hits.sort((a, b) => a.textContent.length - b.textContent.length);
  const el = hits[0];
  if (!el) return false;
  el.scrollIntoView({ block: 'center' });
  el.click();
  return true;
}`;

// Click an item inside one side-menu area (names like "Payroll" repeat across areas).
const CLICK_IN_SECTION = `(section, item) => {
  const norm = (s) => (s || '').replace(/\\s+/g, ' ').trim().replace(/^[^A-Za-z0-9]+/, '').replace(/ \\(\\d+\\)$/, '');
  const headers = Array.from(document.querySelectorAll('*')).filter((el) => el.offsetParent && el.children.length <= 3 && norm(el.textContent) === section);
  for (const h of headers) {
    let box = h.parentElement;
    for (let i = 0; i < 6 && box; i++, box = box.parentElement) {
      const items = Array.from(box.querySelectorAll('*')).filter((el) => el.offsetParent && norm(el.textContent) === item);
      if (items.length) { items.sort((a, b) => a.textContent.length - b.textContent.length); items[0].click(); return true; }
    }
  }
  return false;
}`;

async function main() {
  const only = process.argv.slice(2);
  const shots = only.length ? SHOTS.filter((s) => only.some((o) => s.file.startsWith(o))) : SHOTS;
  const exe = BROWSERS.find((p) => fs.existsSync(p));
  if (!exe) throw new Error('No Edge or Chrome found.');
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'help-shots-'));
  const browser = spawn(exe, [
    '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
    '--window-size=1440,900', '--hide-scrollbars', '--no-first-run', '--disable-extensions', 'about:blank',
  ], { stdio: 'ignore' });

  try {
    let version;
    for (let i = 0; i < 40 && !version; i++) {
      try { version = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json(); } catch { await sleep(250); }
    }
    if (!version) throw new Error('Browser did not start.');
    const page = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json();
    const c = await cdp(page.webSocketDebuggerUrl);
    await c.send('Page.enable');
    await c.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

    const goto = async (url, wait = 6000) => { await c.send('Page.navigate', { url }); await sleep(wait); };
    const click = (text, exact = false) => c.evaluate(`(${CLICK_TEXT})(${JSON.stringify(text)}, ${exact})`);
    const hideDevBits = () => c.evaluate(`(() => { const s = document.createElement('style'); s.textContent = 'nextjs-portal{display:none!important}'; document.head.appendChild(s); return true; })()`);

    // Sign in, retrying until the login form is gone (the first load may still be compiling).
    const loginVisible = () => c.evaluate('Boolean(document.querySelector("input[type=password]"))');
    let signedIn = false;
    for (let attempt = 1; attempt <= 4 && !signedIn; attempt++) {
      await goto(APP, 8000 + attempt * 2000);
      if (!(await loginVisible())) { signedIn = true; break; }
      await c.evaluate(`(async () => {
        const set = (el, v) => { const d = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value'); d.set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); };
        const tenant = document.querySelector('input[placeholder*="tenant" i]');
        const user = document.querySelector('input[placeholder*="email" i]');
        const pass = document.querySelector('input[type=password]');
        if (!user || !pass) return 'already';
        if (tenant) set(tenant, ${JSON.stringify(TENANT)});
        set(user, ${JSON.stringify(USER)}); set(pass, ${JSON.stringify(PASSWORD)});
        const btn = Array.from(document.querySelectorAll('button')).find((b) => /sign in/i.test(b.textContent));
        btn && btn.click();
        return 'submitted';
      })()`);
      for (let i = 0; i < 15 && (await loginVisible()); i++) await sleep(1000);
      signedIn = !(await loginVisible());
      console.log(`sign-in attempt ${attempt}: ${signedIn ? 'ok' : 'not yet'}`);
    }
    // Never overwrite good pictures with the login screen.
    if (!signedIn) throw new Error('Could not sign in; no screenshots were taken.');
    await sleep(4000);

    fs.mkdirSync(OUT, { recursive: true });
    for (const shot of shots) {
      const [section, item] = shot.menu;
      await goto(APP, 7000);
      await hideDevBits();
      // An item is only clickable while its area is open, and clicking an open area closes it.
      const openItem = () => c.evaluate(`(${CLICK_IN_SECTION})(${JSON.stringify(section)}, ${JSON.stringify(item)})`);
      let ok = await openItem();
      for (let i = 0; i < 2 && !ok; i++) { await click(section, true); await sleep(900); ok = await openItem(); }
      await sleep(5000 + (shot.wait || 0)); // slow screens (the POS loads its menu) ask for more
      if (shot.tab) { await click(shot.tab); await sleep(3500); }
      for (const t of shot.clicks || []) { await click(t, true); await sleep(2500); }
      if (shot.openFirstRow) {
        await c.evaluate(`(() => { const row = document.querySelector('tbody tr'); if (!row) return false; (row.querySelector('td:nth-child(2)') || row).click(); return true; })()`);
        await sleep(3500);
      }
      await c.evaluate('window.scrollTo(0, 0)');
      if (await loginVisible()) throw new Error(`Signed out before ${shot.file}; stopped so no picture is overwritten.`);
      const { data } = await c.send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(path.join(OUT, shot.file), Buffer.from(data, 'base64'));
      console.log(`${ok ? 'ok  ' : 'MENU?'} ${shot.file}`);
    }
    c.close();
  } finally {
    // Edge starts helper processes; end the whole tree so no hidden browser is left behind.
    if (process.platform === 'win32') spawn('taskkill', ['/PID', String(browser.pid), '/T', '/F'], { stdio: 'ignore' });
    else browser.kill();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
