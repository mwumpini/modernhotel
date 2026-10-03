/**
 * Isolated security certification. No hotel, session, or database is touched.
 *
 * Run: npx tsx scripts/cert-security-e2e.ts
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { passwordPolicyError, passwordExpired } from '../src/app/lib/settings/passwordPolicy';
import { idleTimedOut } from '../src/app/lib/settings/sessionIdle';
import { normalizeSecurityPolicy, securityFromGeneral, DEFAULT_SECURITY_POLICY } from '../src/app/lib/settings/securityPolicy';
import { permissionGrants } from '../src/app/lib/settings/roleRepository';
import { generateTotpSecret, totpCode, verifyTotp } from '../src/app/lib/auth/totp';
import { recordBelongsToOtherTenant } from '../src/app/lib/security/tenantGuard';
import { pinLengthError } from '../src/app/lib/auth/posPin';

let failed = 0;

function check(name: string, ok: boolean, detail?: string) {
  if (ok) {
    console.log(`ok  ${name}`);
    return;
  }
  failed += 1;
  console.error(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
}

function routeSource(file: string): string {
  return readFileSync(join(__dirname, '..', 'src', 'app', 'api', 'security', file), 'utf8');
}

function count(src: string, needle: string): number {
  return src.split(needle).length - 1;
}

function main() {
  const policy = DEFAULT_SECURITY_POLICY.passwordPolicy;
  check('a short password is rejected', passwordPolicyError('Ab1!', policy) !== null);
  check('a password without a number is rejected', passwordPolicyError('Abcdefg!', policy) !== null);
  check('a password that meets the hotel rules is accepted', passwordPolicyError('Abcdefg1!', policy) === null);

  const now = Date.now();
  check(
    'password expiry uses the saved number of days',
    passwordExpired(new Date(now - 10 * 24 * 60 * 60 * 1000).toISOString(), 90) === false
      && passwordExpired(new Date(now - 91 * 24 * 60 * 60 * 1000).toISOString(), 90) === true
      && passwordExpired(undefined, 90) === false,
  );
  check(
    'session timeout fires only after the saved idle minutes',
    idleTimedOut(now - 29 * 60 * 1000, now, 30) === false
      && idleTimedOut(now - 30 * 60 * 1000, now, 30) === true
      && idleTimedOut(now - 60 * 60 * 1000, now, 0) === false,
  );

  const secret = generateTotpSecret();
  const code = totpCode(secret);
  check('authenticator code matches its key', verifyTotp(secret, code) && !verifyTotp(secret, '000000'));

  const normalized = normalizeSecurityPolicy({
    sessionTimeout: 15,
    twoFactorAuth: true,
    ipWhitelist: ['  ', '10.0.0.8', ...Array.from({ length: 60 }, (_, i) => `10.1.0.${i}`)],
    passwordPolicy: { minLength: 12, requireUppercase: false },
    loginAttempts: { maxAttempts: 99, lockoutDuration: 0 },
  });
  check(
    'security policy keeps the saved rules and fills the rest',
    normalized.sessionTimeout === 15
      && normalized.twoFactorAuth === true
      && normalized.passwordPolicy.minLength === 12
      && normalized.passwordPolicy.requireUppercase === false
      && normalized.passwordPolicy.requireNumbers === true,
  );
  check('blank addresses are dropped and the allow-list stops at 50', normalized.ipWhitelist.length === 50 && normalized.ipWhitelist[0] === '10.0.0.8');
  check('lockout settings stay inside the allowed range', normalized.loginAttempts.maxAttempts === 20 && normalized.loginAttempts.lockoutDuration === 1);
  const pinPolicy = normalizeSecurityPolicy({ pinPolicy: { minLength: 2, maxLength: 3 } }).pinPolicy;
  check('PIN length stays between 4 and 8 digits', pinPolicy.minLength === 4 && pinPolicy.maxLength === 4);
  check('a PIN outside the saved length is rejected', pinLengthError('123', { minLength: 4, maxLength: 6 }) !== null && pinLengthError('1234', { minLength: 4, maxLength: 6 }) === null);
  check('a password without a special character is rejected when that rule is on', passwordPolicyError('Abcdefg1', { ...policy, requireSpecialChars: true }) !== null);
  check('a password with a special character is accepted', passwordPolicyError('Abcdefg1!', { ...policy, requireSpecialChars: true }) === null);
  check(
    'a hotel with no saved security policy is not treated as configured',
    securityFromGeneral({}).configured === false && securityFromGeneral({ security: { twoFactorAuth: true } }).configured === true,
  );

  check('full security access covers a single security action', permissionGrants('security.*', 'security.resolve-incident'));
  check('one security action does not cover another', permissionGrants('security.manage-patrols', 'security.manage-shifts') === false);
  check('another module does not cover security', permissionGrants('frontdesk.*', 'security.view') === false);
  check('a hotel-wide grant covers security', permissionGrants('*', 'security.register-visitor'));

  check('a security record stays with its own hotel', recordBelongsToOtherTenant('hotel-a', 'hotel-a') === false && recordBelongsToOtherTenant(null, 'hotel-a') === false);
  check('a security record from another hotel is refused', recordBelongsToOtherTenant('hotel-b', 'hotel-a') === true);

  const routes: Array<{ file: string; authCalls: number; permissions: Array<{ call: string; times: number }> }> = [
    { file: 'incidents/route.ts', authCalls: 3, permissions: [] },
    { file: 'visitors/route.ts', authCalls: 3, permissions: [] },
    { file: 'compliance/route.ts', authCalls: 2, permissions: [] },
    { file: 'patrols/route.ts', authCalls: 1, permissions: [{ call: "requirePermission(request, 'security.manage-patrols')", times: 2 }] },
    { file: 'personnel/route.ts', authCalls: 1, permissions: [{ call: "requirePermission(request, 'security.manage-personnel')", times: 2 }] },
    { file: 'shifts/route.ts', authCalls: 1, permissions: [{ call: "requirePermission(request, 'security.manage-shifts')", times: 2 }] },
    {
      file: 'patrol-routes/route.ts',
      authCalls: 1,
      permissions: [
        { call: "requireAnyPermission(request, ['security.manage-routes', 'security.manage-patrols'])", times: 1 },
        { call: "requirePermission(request, 'security.manage-routes')", times: 1 },
      ],
    },
    {
      file: 'checkpoint-locations/route.ts',
      authCalls: 1,
      permissions: [
        { call: "requireAnyPermission(request, ['security.manage-checkpoints', 'security.manage-patrols'])", times: 1 },
        { call: "requirePermission(request, 'security.manage-checkpoints')", times: 1 },
      ],
    },
  ];

  for (const route of routes) {
    const src = routeSource(route.file);
    check(`${route.file} requires a login`, count(src, 'requireAuth(request)') === route.authCalls);
    for (const permission of route.permissions) {
      check(`${route.file} keeps ${permission.call}`, count(src, permission.call) === permission.times);
    }
  }

  if (failed) {
    console.error(`security cert failed: ${failed}`);
    process.exit(1);
  }
  console.log('security cert ok');
}

main();
