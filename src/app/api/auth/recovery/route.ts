import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/app/lib/database/client';
import { findUserForLogin } from '@/app/lib/auth/loginLookup';
import { normalizeTenantSubdomain } from '@/app/lib/api/tenantSubdomain';
import { resolveLoginTenant } from '@/app/lib/platform/operator';
import { isPlatformOperator, PLATFORM_SUBDOMAIN } from '@/app/lib/platform/operatorRole';
import { passwordPolicyError } from '@/app/lib/settings/passwordPolicy';
import { readTenantSecurity } from '@/app/lib/settings/securityPolicyDb';
import {
  publicRecoveryQuestions,
  readRecoveryQuestions,
  recoveryAnswersMatch,
  recoveryFailCount,
  recoveryFallbackMessage,
  recoveryLocked,
} from '@/app/lib/auth/recoveryQuestions';

const EITHER = recoveryFallbackMessage('either');

function prefsOf(user: { preferences: unknown }): Record<string, unknown> {
  return user.preferences && typeof user.preferences === 'object' && !Array.isArray(user.preferences)
    ? { ...(user.preferences as Record<string, unknown>) }
    : {};
}

async function fallbackFor(tenantId: string, user: { id: string; role: string }, subdomain: string, prefs: unknown) {
  const locked = recoveryLocked(prefs);
  if (subdomain === PLATFORM_SUBDOMAIN || isPlatformOperator(user, { subdomain })) {
    return recoveryFallbackMessage('operator-account', locked);
  }
  const firstAdmin = await prisma.user.findFirst({
    where: { tenantId, role: 'admin' },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });
  const who = firstAdmin?.id === user.id ? 'operator' : 'admin';
  return recoveryFallbackMessage(who, locked);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const subdomain = normalizeTenantSubdomain(String(body.tenantId || ''));
    const login = String(body.login || body.email || '').trim();
    if (!subdomain || !login) {
      return NextResponse.json({ fallback: true, message: 'Enter the Tenant ID and the email or username first.' }, { status: 400 });
    }

    const tenant = await resolveLoginTenant(subdomain);
    if (!tenant || tenant.status !== 'active') {
      return NextResponse.json({ fallback: true, message: recoveryFallbackMessage('operator') });
    }

    const user = await findUserForLogin(tenant.id, login);
    if (!user || !user.isActive || !user.password) {
      return NextResponse.json({ fallback: true, message: EITHER });
    }

    const prefs = prefsOf(user);
    const message = await fallbackFor(tenant.id, user, tenant.subdomain, prefs);
    // The platform operator controls every hotel: never reset it by secret questions.
    const operatorAccount = tenant.subdomain === PLATFORM_SUBDOMAIN || isPlatformOperator(user, { subdomain: tenant.subdomain });
    if (operatorAccount || recoveryLocked(prefs) || readRecoveryQuestions(prefs).length < 2) {
      return NextResponse.json({ fallback: true, message });
    }

    if (body.action === 'reset') {
      const answers: { id: string; answer: string }[] = Array.isArray(body.answers)
        ? body.answers.flatMap((item: unknown) => {
            if (!item || typeof item !== 'object') return [];
            const id = String((item as { id?: unknown }).id || '');
            const answer = String((item as { answer?: unknown }).answer || '');
            return id ? [{ id, answer }] : [];
          })
        : [];
      const password = String(body.password || '');
      const confirm = String(body.confirm || '');
      if (password !== confirm) {
        return NextResponse.json({ error: 'The two passwords do not match.', questions: publicRecoveryQuestions(prefs) }, { status: 400 });
      }
      const { policy } = await readTenantSecurity(tenant.id);
      const passwordError = passwordPolicyError(password, policy.passwordPolicy);
      if (passwordError) {
        return NextResponse.json({ error: passwordError, questions: publicRecoveryQuestions(prefs) }, { status: 400 });
      }
      const matched = await recoveryAnswersMatch(readRecoveryQuestions(prefs), answers);
      if (!matched) {
        const fails = recoveryFailCount(prefs) + 1;
        const next = { ...prefs, recoveryFails: fails };
        await prisma.user.update({ where: { id: user.id }, data: { preferences: next } });
        const locked = fails >= 5;
        return NextResponse.json({
          error: locked ? undefined : 'Those answers do not match.',
          fallback: locked,
          message: locked ? await fallbackFor(tenant.id, user, tenant.subdomain, next) : undefined,
          questions: locked ? undefined : publicRecoveryQuestions(prefs),
        }, { status: locked ? 200 : 400 });
      }
      const { recoveryFails: _fails, ...rest } = prefs;
      await prisma.user.update({
        where: { id: user.id },
        data: {
          password: await bcrypt.hash(password, 12),
          preferences: { ...rest, passwordChangedAt: new Date().toISOString() },
        },
      });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ questions: publicRecoveryQuestions(prefs) });
  } catch (error) {
    console.error('[auth/recovery] error', error);
    return NextResponse.json({ error: 'Could not reset the password.' }, { status: 500 });
  }
}
