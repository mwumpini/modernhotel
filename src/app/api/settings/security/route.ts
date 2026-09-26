import { NextRequest, NextResponse } from 'next/server';
import { getTenantFromRequest, getTenantContext, createAuditLog } from '@/app/lib/api/tenant';
import { requireAuth, requireAnyPermission } from '@/app/lib/api/auth-guard';
import { readTenantSecurity, saveTenantSecurity } from '@/app/lib/settings/securityPolicyDb';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;
    const subdomain = getTenantFromRequest(request);
    if (!subdomain) return NextResponse.json({ error: 'Missing tenant header' }, { status: 400 });
    const ctx = await getTenantContext(subdomain);
    if (!ctx) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const { configured, policy } = await readTenantSecurity(ctx.tenantId);
    return NextResponse.json({ configured, policy });
  } catch (error) {
    console.error('[settings/security][GET] error', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;
    const perm = await requireAnyPermission(request, ['settings.manage-security-policy', 'settings.manage-2fa']);
    if (!perm.ok) return perm.response;
    const subdomain = getTenantFromRequest(request);
    if (!subdomain) return NextResponse.json({ error: 'Missing tenant header' }, { status: 400 });
    const ctx = await getTenantContext(subdomain);
    if (!ctx) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const body = await request.json();
    const policy = await saveTenantSecurity(ctx.tenantId, body);
    const sessionUserId = (auth.session as { user?: { id?: string } }).user?.id;
    await createAuditLog(ctx.tenantId, sessionUserId ?? null, 'SECURITY_POLICY_UPDATED', 'SystemSettings', ctx.tenantId, undefined, {
      twoFactorAuth: policy.twoFactorAuth,
      sessionTimeout: policy.sessionTimeout,
      minLength: policy.passwordPolicy.minLength,
    }, request);
    return NextResponse.json({ ok: true, policy });
  } catch (error) {
    console.error('[settings/security][POST] error', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
