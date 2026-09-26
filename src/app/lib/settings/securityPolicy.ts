import type { PasswordPolicy } from './passwordPolicy';

export type SecurityPolicy = {
  sessionTimeout: number;
  twoFactorAuth: boolean;
  ipWhitelist: string[];
  passwordPolicy: PasswordPolicy & { expiryDays: number };
  loginAttempts: { maxAttempts: number; lockoutDuration: number };
};

export const DEFAULT_SECURITY_POLICY: SecurityPolicy = {
  sessionTimeout: 30,
  twoFactorAuth: false,
  ipWhitelist: [],
  passwordPolicy: {
    minLength: 8,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
    expiryDays: 90,
  },
  loginAttempts: { maxAttempts: 5, lockoutDuration: 15 },
};

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

function flag(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

/** Drop anything that is not a real security setting before it is stored or enforced. */
export function normalizeSecurityPolicy(raw: unknown): SecurityPolicy {
  const src = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const password = src.passwordPolicy && typeof src.passwordPolicy === 'object'
    ? (src.passwordPolicy as Record<string, unknown>)
    : {};
  const attempts = src.loginAttempts && typeof src.loginAttempts === 'object'
    ? (src.loginAttempts as Record<string, unknown>)
    : {};
  const whitelist = Array.isArray(src.ipWhitelist)
    ? src.ipWhitelist.filter((ip): ip is string => typeof ip === 'string' && ip.trim().length > 0).slice(0, 50)
    : DEFAULT_SECURITY_POLICY.ipWhitelist;
  const base = DEFAULT_SECURITY_POLICY;
  return {
    sessionTimeout: clampInt(src.sessionTimeout, 0, 24 * 60, base.sessionTimeout),
    twoFactorAuth: flag(src.twoFactorAuth, base.twoFactorAuth),
    ipWhitelist: whitelist,
    passwordPolicy: {
      minLength: clampInt(password.minLength, 1, 128, base.passwordPolicy.minLength),
      requireUppercase: flag(password.requireUppercase, base.passwordPolicy.requireUppercase),
      requireLowercase: flag(password.requireLowercase, base.passwordPolicy.requireLowercase),
      requireNumbers: flag(password.requireNumbers, base.passwordPolicy.requireNumbers),
      requireSpecialChars: flag(password.requireSpecialChars, base.passwordPolicy.requireSpecialChars),
      expiryDays: clampInt(password.expiryDays, 0, 3650, base.passwordPolicy.expiryDays),
    },
    loginAttempts: {
      maxAttempts: clampInt(attempts.maxAttempts, 1, 20, base.loginAttempts.maxAttempts),
      lockoutDuration: clampInt(attempts.lockoutDuration, 1, 24 * 60, base.loginAttempts.lockoutDuration),
    },
  };
}

export function securityFromGeneral(general: unknown): { configured: boolean; policy: SecurityPolicy } {
  const bag = general && typeof general === 'object' ? (general as Record<string, unknown>) : {};
  if (!bag.security || typeof bag.security !== 'object') {
    return { configured: false, policy: DEFAULT_SECURITY_POLICY };
  }
  return { configured: true, policy: normalizeSecurityPolicy(bag.security) };
}
