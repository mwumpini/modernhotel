export type PasswordPolicy = {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
};

/** Settings → Security password rules. Returns a message when the password fails. */
export function passwordPolicyError(password: string, policy: PasswordPolicy): string | null {
  const min = Number.isFinite(policy.minLength) && policy.minLength > 0 ? Math.trunc(policy.minLength) : 8;
  if (!password || password.length < min) {
    return `Password must be at least ${min} characters.`;
  }
  if (policy.requireUppercase && !/[A-Z]/.test(password)) {
    return 'Password must include an uppercase letter.';
  }
  if (policy.requireLowercase && !/[a-z]/.test(password)) {
    return 'Password must include a lowercase letter.';
  }
  if (policy.requireNumbers && !/[0-9]/.test(password)) {
    return 'Password must include a number.';
  }
  if (policy.requireSpecialChars && !/[^A-Za-z0-9]/.test(password)) {
    return 'Password must include a special character.';
  }
  return null;
}

/** Settings → Security "Password Expiry". Missing dates stay valid so existing accounts are not locked out. */
export function passwordExpired(changedAt: string | undefined, expiryDays: number, now = Date.now()): boolean {
  if (!Number.isFinite(expiryDays) || expiryDays < 1) return false;
  if (!changedAt) return false;
  const then = Date.parse(changedAt);
  if (!Number.isFinite(then)) return false;
  return now - then >= expiryDays * 24 * 60 * 60 * 1000;
}
