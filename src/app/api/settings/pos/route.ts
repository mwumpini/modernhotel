import { NextRequest, NextResponse } from 'next/server';
import { getTenantFromRequest, getTenantContext, createAuditLog } from '@/app/lib/api/tenant';
import { requireAuth, requireAnyPermission } from '@/app/lib/api/auth-guard';
import { readTenantPos, saveTenantPos } from '@/app/lib/settings/posPolicyDb';

/** GET/POST /api/settings/pos — hotel-wide POS rules (see posPolicyDb.ts). */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;
    const subdomain = getTenantFromRequest(request);
    if (!subdomain) return NextResponse.json({ error: 'Missing tenant header' }, { status: 400 });
    const ctx = await getTenantContext(subdomain);
    if (!ctx) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    return NextResponse.json({ policy: await readTenantPos(ctx.tenantId) });
  } catch (error) {
    console.error('[settings/pos][GET] error', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;
    const perm = await requireAnyPermission(request, ['settings.manage-security-policy', 'settings.edit']);
    if (!perm.ok) return perm.response;
    const subdomain = getTenantFromRequest(request);
    if (!subdomain) return NextResponse.json({ error: 'Missing tenant header' }, { status: 400 });
    const ctx = await getTenantContext(subdomain);
    if (!ctx) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const policy = await saveTenantPos(ctx.tenantId, await request.json().catch(() => ({})));
    const sessionUserId = (auth.session as { user?: { id?: string } }).user?.id;
    await createAuditLog(ctx.tenantId, sessionUserId ?? null, 'POS_POLICY_UPDATED', 'SystemSettings', ctx.tenantId, undefined, policy, request);
    return NextResponse.json({ ok: true, policy });
  } catch (error) {
    console.error('[settings/pos][POST] error', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
