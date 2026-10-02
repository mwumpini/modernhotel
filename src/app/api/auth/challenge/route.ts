import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/app/lib/database/client';
import { generateTotpSecret, otpauthUri } from '@/app/lib/auth/totp';
import { passwordExpired } from '@/app/lib/settings/passwordPolicy';
import { readTenantSecurity } from '@/app/lib/settings/securityPolicyDb';
import { normalizeTenantSubdomain } from '@/app/lib/api/tenantSubdomain';
import { findUserForLogin } from '@/app/lib/auth/loginLookup';

/**
 * Password check that runs before a session is created.
 * When two-factor is required, this is where a new authenticator key is issued.
 * The session itself is still created by NextAuth, which checks the code again.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    // Email or username.
    const login = String(body.email || '').trim();
    const password = String(body.password || '');
    const subdomain = normalizeTenantSubdomain(String(body.tenantId || ''));
    if (!login || !password || !subdomain) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const tenant = await prisma.tenant.findUnique({ where: { subdomain } });
    if (!tenant || tenant.status !== 'active') {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }
    const user = await findUserForLogin(tenant.id, login);
    if (!user || !user.isActive || !user.password || !(await bcrypt.compare(password, user.password))) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const { policy } = await readTenantSecurity(tenant.id);
    const prefs = (user.preferences && typeof user.preferences === 'object' ? user.preferences : {}) as Record<string, unknown>;
    if (passwordExpired(typeof prefs.passwordChangedAt === 'string' ? prefs.passwordChangedAt : undefined, policy.passwordPolicy.expiryDays)) {
      return NextResponse.json({ expired: true, error: 'This password has expired. An administrator must set a new one.' }, { status: 403 });
    }
    if (!policy.twoFactorAuth) return NextResponse.json({ required: false });

    let secret = typeof prefs.twoFactorSecret === 'string' ? prefs.twoFactorSecret : '';
    const confirmed = prefs.twoFactorConfirmed === true;
    if (!secret) {
      secret = generateTotpSecret();
      await prisma.user.update({
        where: { id: user.id },
        data: { preferences: { ...prefs, twoFactorSecret: secret, twoFactorConfirmed: false } },
      });
    }
    if (!confirmed) {
      return NextResponse.json({
        required: true,
        enroll: true,
        secret,
        otpauth: otpauthUri(secret, user.email),
      });
    }
    return NextResponse.json({ required: true, enroll: false });
  } catch (error) {
    console.error('[auth/challenge] error', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
