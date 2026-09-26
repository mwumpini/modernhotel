/**
 * Isolated settings certification. Uses an in-memory localStorage and a stubbed
 * fetch so nothing is written to the open hotel or the database.
 *
 * Run: npx tsx scripts/cert-settings-e2e.ts
 */
export {}; // isolate this script's scope — otherwise its top-level `localStorage`
// mock collides with the DOM lib's ambient global, and `let failed`/`function
// check` collide with other standalone cert-*.ts scripts, since a file with no
// import/export is treated as a global script.

const mem = new Map<string, string>();
const localStorage = {
  getItem: (k: string) => (mem.has(k) ? mem.get(k)! : null),
  setItem: (k: string, v: string) => { mem.set(k, String(v)); },
  removeItem: (k: string) => { mem.delete(k); },
  clear: () => { mem.clear(); },
  key: (i: number) => [...mem.keys()][i] ?? null,
  get length() { return mem.size; },
};

const attrs = new Map<string, string>();
const classes = new Set<string>();
const cssVars = new Map<string, string>();
const documentElement = {
  setAttribute: (k: string, v: string) => { attrs.set(k, v); },
  getAttribute: (k: string) => attrs.get(k) ?? null,
  removeAttribute: (k: string) => { attrs.delete(k); },
  classList: {
    toggle: (name: string, on?: boolean) => {
      if (on) classes.add(name);
      else classes.delete(name);
    },
  },
  style: {
    colorScheme: '',
    setProperty: (k: string, v: string) => { cssVars.set(k, v); },
    removeProperty: (k: string) => { cssVars.delete(k); },
  },
};

const posts: { url: string; body: string }[] = [];
(globalThis as any).localStorage = localStorage;
(globalThis as any).window = globalThis;
(globalThis as any).document = { documentElement };
(globalThis as any).fetch = async (url: string, init?: { method?: string; body?: string }) => {
  if (init?.method === 'POST') posts.push({ url: String(url), body: String(init.body || '') });
  return { ok: false, json: async () => null, text: async () => '' };
};
localStorage.setItem('tenant.subdomain', 'demo');

let failed = 0;
function check(name: string, ok: boolean, detail = '') {
  if (ok) console.log('ok ', name);
  else {
    failed += 1;
    console.error('FAIL', name, detail);
  }
}

async function main() {
  const settingsMod = await import('../src/app/lib/settings/store');
  const { passwordPolicyError } = await import('../src/app/lib/settings/passwordPolicy');
  const { managerPinMatches } = await import('../src/app/lib/settings/managerPin');
  const { approvalDecision } = await import('../src/app/lib/settings/approvalDecision');
  const { applyDisplay, readStoredDisplay } = await import('../src/app/lib/theme/applyTheme');
  const { creditTermDays } = await import('../src/app/lib/frontoffice/operationalPolicies');
  const { stayClock } = await import('../src/app/lib/frontoffice/stayWorksheet');
  const { getFolioDisplayTotals } = await import('../src/app/lib/frontoffice/helpers/folio');
  const { renderPrint } = await import('../src/app/lib/print/engine');
  const { DEFAULT_TEMPLATE_STYLE } = await import('../src/app/lib/print/blocks');

  const store = settingsMod.useSettingsStore;
  const { autoAssignRoomsEnabled, formatDocumentNumber } = settingsMod;

  store.getState().loadSettings();
  await new Promise((r) => setTimeout(r, 30));

  let published = 0;
  const unsub = store.getState().subscribe(() => { published += 1; });
  store.getState().publish();
  check('publish still has a Set of subscribers after load', published === 1);
  unsub();

  const receiptBefore = store.getState().receiptSettings.nextNumber;
  const folioBefore = store.getState().moduleNumbering.frontOffice.folio.nextNumber;

  store.getState().updateInvoiceSettings({
    prefix: 'INV',
    suffix: '',
    nextNumber: 7,
    numberFormat: '{PREFIX}-{YEAR}-{NUMBER}',
  });
  const issued = store.getState().getNextInvoiceNumber();
  check('invoice series prints the edited prefix and year', issued === `INV-${new Date().getFullYear()}-0007`, issued);
  check('invoice counter advanced by one', store.getState().invoiceSettings.nextNumber === 8);
  check('receipt series was not moved by the invoice issue', store.getState().receiptSettings.nextNumber === receiptBefore);

  store.getState().updateNestedSetting('moduleNumbering.foodBeverage.kitchenOrderTicket.prefix', 'KX');
  store.getState().updateNestedSetting('moduleNumbering.foodBeverage.kitchenOrderTicket.nextNumber', 100088);
  const kot = store.getState().getNextModuleNumber('foodBeverage', 'kitchenOrderTicket');
  check('kitchen ticket uses the edited series', kot === 'KX100088', kot);
  check('folio series was not moved by the kitchen ticket', store.getState().moduleNumbering.frontOffice.folio.nextNumber === folioBefore);

  store.getState().updateFinancialSettings({
    roundToNearest: 1,
    roundingRule: 'up',
    requireApprovalForExpenses: true,
    expenseApprovalThreshold: 2500,
    requireApprovalForPurchaseOrders: true,
    purchaseOrderApprovalThreshold: 500,
    requireApprovalForPayments: false,
    paymentApprovalThreshold: 100,
    requireApprovalForOvertime: true,
    overtimeApprovalThreshold: 4,
  });
  const totals = getFolioDisplayTotals({
    charges: [{ amount: 10.03, tax: 0, description: 'Room', date: '2026-09-26' }],
    payments: [],
  } as any);
  check('folio total rounds up to the billing increment', totals.totalCharges === 11, String(totals.totalCharges));

  const fs = store.getState().financialSettings as unknown as Record<string, unknown>;
  check('expense at the threshold needs approval', approvalDecision(fs, 'expense', 2500).needsApproval);
  check('expense under the threshold does not', !approvalDecision(fs, 'expense', 2499.99).needsApproval);
  check('purchase order uses its own threshold', approvalDecision(fs, 'purchaseOrder', 500).needsApproval && !approvalDecision(fs, 'purchaseOrder', 499).needsApproval);
  check('payments skip approval when the switch is off', !approvalDecision(fs, 'payment', 100000).needsApproval);
  check('overtime uses the hour threshold', approvalDecision(fs, 'overtime', 4).needsApproval && !approvalDecision(fs, 'overtime', 3).needsApproval);
  const approvalPost = posts.find((p) => p.url.includes('/api/settings/approval-thresholds'));
  const approvalBody = approvalPost ? JSON.parse(approvalPost.body) : {};
  check('approvals save posts the threshold the server reads', approvalBody.expenseApprovalThreshold === 2500 && approvalBody.roundToNearest === 1 && approvalBody.roundingRule === 'up');

  store.getState().updateNestedSetting('security.sessionTimeout', 45);
  store.getState().updateNestedSetting('security.twoFactorAuth', false);
  store.getState().updateNestedSetting('security.passwordPolicy.minLength', 10);
  store.getState().updateNestedSetting('security.passwordPolicy.requireUppercase', true);
  store.getState().updateNestedSetting('security.passwordPolicy.requireLowercase', true);
  store.getState().updateNestedSetting('security.passwordPolicy.requireNumbers', true);
  store.getState().updateNestedSetting('security.passwordPolicy.requireSpecialChars', false);
  const policy = () => store.getState().security.passwordPolicy;
  check('password shorter than the saved minimum is rejected', !!passwordPolicyError('Abcdef1', policy()));
  check('password missing a number is rejected', !!passwordPolicyError('Abcdefghij', policy()));
  check('password that meets the saved rules is accepted', passwordPolicyError('Abcdefghij1', policy()) === null);

  store.getState().updateNestedSetting('posSettings.managerPin', '9090');
  check('POS void accepts the saved manager PIN', managerPinMatches('9090'));
  check('POS void rejects the old PIN', !managerPinMatches('1234'));

  store.getState().updateRoomSettings({ autoAssignRooms: false });
  check('check-in stops auto-assigning when the switch is off', autoAssignRoomsEnabled() === false);

  store.getState().updateNestedSetting('roomManagement.defaultCreditTermsDays', 21);
  store.getState().updateNestedSetting('roomManagement.standardCheckInHour', 16);
  store.getState().updateHotelSettings({ checkInTime: '09:00' });
  check('company terms win, otherwise the saved credit days', creditTermDays(store.getState().roomManagement, 'Net 45') === 45 && creditTermDays(store.getState().roomManagement, null) === 21 && creditTermDays(store.getState().roomManagement, 'Immediate') === 0);
  const clock = stayClock({ arrival: '2026-09-26', departure: '2026-09-28' } as any, 'in');
  check('planned check-in uses the policy hour, not the old hotel time', /4:00|16:00/.test(clock), clock);

  const templateId = 'custom-cert-settings';
  store.getState().addDocBuilderTemplate({
    id: templateId,
    docType: 'invoice',
    name: 'Cert mark',
    isBuiltIn: false,
    blocks: [{ id: 'mark', type: 'custom-text', visible: true, order: 0, text: 'CERT-SETTINGS-MARK' }],
    style: DEFAULT_TEMPLATE_STYLE,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  store.getState().updateNestedSetting('printing.invoice', templateId);
  const html = renderPrint('invoice', 'not-a-saved-template', {
    org: { name: 'Cert Hotel' },
    guest: { name: 'Ama' },
    items: [{ description: 'Room', amount: 10 }],
    totals: { subTotal: 10, grandTotal: 10 },
  });
  check('print uses the template set active in settings', html.includes('CERT-SETTINGS-MARK'));

  store.getState().updateNestedSetting('currentUser.preferences.theme', 'dark');
  store.getState().updateNestedSetting('currentUser.preferences.font', 'serif');
  store.getState().updateNestedSetting('currentUser.preferences.fontSize', 'xlarge');
  store.getState().updateNestedSetting('currentUser.preferences.backgroundDark', '#112233');

  store.getState().updateRole('admin', { permissions: ['frontdesk.view'], isActive: true });
  check('a narrowed role loses audit access', store.getState().hasPermission('settings.view-audit-log') === false);
  check('a narrowed role keeps the permission it was given', store.getState().hasPermission('frontdesk.view') === true);
  check('a single permission does not grant the rest of the module', store.getState().hasModuleAccess('frontdesk') === true && store.getState().hasModuleAccess('accounting') === false);
  store.getState().updateRole('admin', { permissions: ['frontdesk.*'] });
  check('a module wildcard covers a leaf permission', store.getState().hasPermission('frontdesk.check-in') === true);
  store.getState().updateRole('admin', { isActive: false });
  check('an inactive role grants nothing', store.getState().hasPermission('frontdesk.check-in') === false);
  store.getState().updateRole('admin', { permissions: ['*'], isActive: true });
  store.getState().setSessionRole('night_manager');
  check('the session role overrides the signed-in role', store.getState().hasPermission('settings.manage-approval-thresholds') === false && store.getState().hasPermission('frontdesk.view') === true);
  store.getState().setSessionRole(null);

  store.getState().loadSettings();
  await new Promise((r) => setTimeout(r, 40));

  check('invoice counter survived reload', store.getState().invoiceSettings.nextNumber === 8 && store.getState().invoiceSettings.numberFormat === '{PREFIX}-{YEAR}-{NUMBER}');
  check('next invoice still follows the saved format', formatDocumentNumber(store.getState().invoiceSettings, 4) === `INV-${new Date().getFullYear()}-0008`);
  check('receipt counter survived untouched', store.getState().receiptSettings.nextNumber === receiptBefore);
  check('kitchen ticket counter survived reload', store.getState().moduleNumbering.foodBeverage.kitchenOrderTicket.nextNumber === 100089 && store.getState().moduleNumbering.foodBeverage.kitchenOrderTicket.prefix === 'KX');
  check('folio counter survived untouched', store.getState().moduleNumbering.frontOffice.folio.nextNumber === folioBefore);

  const totalsAfter = getFolioDisplayTotals({
    charges: [{ amount: 10.03, tax: 0, description: 'Room', date: '2026-09-26' }],
    payments: [],
  } as any);
  check('rounding survived reload', totalsAfter.totalCharges === 11 && store.getState().financialSettings.roundingRule === 'up');
  const fsAfter = store.getState().financialSettings as unknown as Record<string, unknown>;
  check('approval thresholds survived reload', approvalDecision(fsAfter, 'expense', 2500).needsApproval && !approvalDecision(fsAfter, 'payment', 100000).needsApproval);

  check('password policy survived reload', passwordPolicyError('Abcdefghij1', store.getState().security.passwordPolicy) === null && !!passwordPolicyError('short', store.getState().security.passwordPolicy));
  check('session timeout and 2FA switch survived reload', store.getState().security.sessionTimeout === 45 && store.getState().security.twoFactorAuth === false);
  check('manager PIN survived reload', managerPinMatches('9090') && store.getState().posSettings.managerPin === '9090');
  check('auto-assign switch survived reload', autoAssignRoomsEnabled() === false);
  check('credit days and check-in hour survived reload', store.getState().roomManagement.defaultCreditTermsDays === 21 && store.getState().roomManagement.standardCheckInHour === 16);
  const htmlAfter = renderPrint('invoice', 'not-a-saved-template', {
    org: { name: 'Cert Hotel' },
    guest: { name: 'Ama' },
    items: [{ description: 'Room', amount: 10 }],
    totals: { subTotal: 10, grandTotal: 10 },
  });
  check('active invoice template survived reload', htmlAfter.includes('CERT-SETTINGS-MARK') && store.getState().printing.invoice === templateId);

  const display = readStoredDisplay();
  applyDisplay(display);
  check('display prefs survived reload', display.theme === 'dark' && display.font === 'serif' && display.fontSize === 'xlarge' && display.backgroundDark === '#112233');
  check('display prefs apply to the page', documentElement.getAttribute('data-font-size') === 'xlarge' && documentElement.getAttribute('data-font') === 'serif' && classes.has('dark') && cssVars.get('--page-background') === '#112233');

  check('admin access survived reload', store.getState().hasPermission('settings.view-audit-log') === true && store.getState().sessionRoleId == null);
  let publishedAgain = 0;
  try {
    const unsubAgain = store.getState().subscribe(() => { publishedAgain += 1; });
    store.getState().publish();
    unsubAgain();
  } catch (err) {
    check('subscribers are still a Set after a second load', false, String(err));
  }
  check('subscribers are still a Set after a second load', publishedAgain === 1);

  const { totpCode, verifyTotp, generateTotpSecret } = await import('../src/app/lib/auth/totp');
  const { idleTimedOut } = await import('../src/app/lib/settings/sessionIdle');
  const { moduleEnabled, reportsEnabled } = await import('../src/app/lib/settings/moduleAccess');
  const { passwordExpired } = await import('../src/app/lib/settings/passwordPolicy');
  const { normalizeSecurityPolicy, securityFromGeneral } = await import('../src/app/lib/settings/securityPolicy');

  const secret = generateTotpSecret();
  const code = totpCode(secret);
  check('authenticator code matches its key', verifyTotp(secret, code) && !verifyTotp(secret, '000000'));
  const now = Date.now();
  check('session timeout fires only after the saved idle minutes', idleTimedOut(now - 29 * 60 * 1000, now, 30) === false && idleTimedOut(now - 30 * 60 * 1000, now, 30) === true && idleTimedOut(now - 60 * 60 * 1000, now, 0) === false);
  check('a switched-off module leaves the menu', moduleEnabled('kitchen', { foodBeverage: false }) === false && moduleEnabled('settings', { foodBeverage: false }) === true && moduleEnabled('housekeeping', { housekeeping: false, maintenance: true }) === true);
  check('reports switch hides reports only', reportsEnabled({ analytics: false }) === false && reportsEnabled({}) === true);
  check('password expiry uses the saved number of days', passwordExpired(new Date(now - 10 * 24 * 60 * 60 * 1000).toISOString(), 90) === false && passwordExpired(new Date(now - 91 * 24 * 60 * 60 * 1000).toISOString(), 90) === true && passwordExpired(undefined, 90) === false);
  const normalized = normalizeSecurityPolicy({ sessionTimeout: 15, twoFactorAuth: true, passwordPolicy: { minLength: 12, requireUppercase: false } });
  check('security policy keeps the saved rules and fills the rest', normalized.sessionTimeout === 15 && normalized.twoFactorAuth === true && normalized.passwordPolicy.minLength === 12 && normalized.passwordPolicy.requireUppercase === false && normalized.passwordPolicy.requireNumbers === true);
  check('a hotel with no saved security policy is not treated as configured', securityFromGeneral({}).configured === false && securityFromGeneral({ security: { twoFactorAuth: true } }).configured === true);

  if (failed) {
    console.error(`settings cert failed: ${failed}`);
    process.exit(1);
  }
  console.log('settings cert ok');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
