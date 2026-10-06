import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/app/lib/database/client';
import { getTenantFromRequest, getTenantContext, createAuditLog } from '@/app/lib/api/tenant';
import { requireAuth, requireAnyPermission } from '@/app/lib/api/auth-guard';

/**
 * The POS manager PIN, one per hotel, kept hashed in SystemSettings.generalSettings (never sent
 * back). GET says whether one is set; PUT sets it; POST checks an entered PIN. Five wrong tries
 * lock checking for five minutes.
 */
const STARTER_PIN = '1234';
const MAX_FAILURES = 5;
const LOCK_MS = 5 * 60 * 1000;

type General = Record<string, unknown> & {
  managerPinHash?: string;
  managerPinFailures?: number;
  managerPinLockedUntil?: string;
};

async function tenantOf(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return { error: auth.response };
  const subdomain = getTenantFromRequest(request);
  if (!subdomain) return { error: NextResponse.json({ error: 'Missing tenant header' }, { status: 400 }) };
  const ctx = await getTenantContext(subdomain);
  if (!ctx) return { error: NextResponse.json({ error: 'Tenant not found' }, { status: 404 }) };
  return { tenantId: ctx.tenantId, session: auth.session };
}

async function readGeneral(tenantId: string): Promise<General> {
  const row = await prisma.systemSettings.findUnique({ where: { tenantId }, select: { generalSettings: true } });
  return ((row?.generalSettings as General) || {}) as General;
}

async function writeGeneral(tenantId: string, general: General) {
  const generalSettings = JSON.parse(JSON.stringify(general)); // plain JSON; drops cleared (undefined) fields
  await prisma.systemSettings.upsert({
    where: { tenantId },
    update: { generalSettings },
    create: { tenantId, generalSettings, hotelSettings: {}, roomSettings: {}, financialSettings: {}, clientSettings: {}, saasSettings: {} },
  });
}

export async function GET(request: NextRequest) {
  try {
    const t = await tenantOf(request);
    if ('error' in t) return t.error;
    const general = await readGeneral(t.tenantId);
    return NextResponse.json({ isSet: Boolean(general.managerPinHash) });
  } catch (error) {
    console.error('[settings/manager-pin][GET] error', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const t = await tenantOf(request);
    if ('error' in t) return t.error;
    const perm = await requireAnyPermission(request, ['settings.manage-security-policy']);
    if (!perm.ok) return perm.response;
    const body = await request.json().catch(() => null);
    const pin = typeof body?.pin === 'string' ? body.pin : '';
    if (!/^\d{4,12}$/.test(pin)) return NextResponse.json({ error: 'The PIN must be 4 to 12 digits.' }, { status: 400 });
    const general = await readGeneral(t.tenantId);
    await writeGeneral(t.tenantId, { ...general, managerPinHash: await bcrypt.hash(pin, 10), managerPinFailures: 0, managerPinLockedUntil: undefined });
    const userId = (t.session as { user?: { id?: string } }).user?.id;
    await createAuditLog(t.tenantId, userId ?? null, 'MANAGER_PIN_CHANGED', 'SystemSettings', t.tenantId, undefined, undefined, request);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[settings/manager-pin][PUT] error', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const t = await tenantOf(request);
    if ('error' in t) return t.error;
    const body = await request.json().catch(() => null);
    const pin = typeof body?.pin === 'string' ? body.pin : '';
    const general = await readGeneral(t.tenantId);
    const lockedUntil = Date.parse(general.managerPinLockedUntil || '');
    if (Number.isFinite(lockedUntil) && lockedUntil > Date.now()) {
      return NextResponse.json({ ok: false, error: 'Too many wrong PINs. Try again in a few minutes.' }, { status: 429 });
    }
    const ok = general.managerPinHash ? await bcrypt.compare(pin, general.managerPinHash) : pin === STARTER_PIN;
    const previous = Number(general.managerPinFailures || 0);
    const failures = ok ? 0 : previous + 1;
    if (!ok || previous > 0) {
      await writeGeneral(t.tenantId, {
        ...general,
        managerPinFailures: failures >= MAX_FAILURES ? 0 : failures,
        managerPinLockedUntil: failures >= MAX_FAILURES ? new Date(Date.now() + LOCK_MS).toISOString() : undefined,
      });
    }
    return NextResponse.json({ ok });
  } catch (error) {
    console.error('[settings/manager-pin][POST] error', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
