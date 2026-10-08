import { NextRequest, NextResponse } from 'next/server';
import { getTenantFromRequest, getTenantContext, createAuditLog } from '@/app/lib/api/tenant';
import { requireAuth, requirePermission } from '@/app/lib/api/auth-guard';
import { prisma } from '@/app/lib/database/client';
import { Prisma } from '@prisma/client';
import { parseCleaningKits } from '@/app/lib/housekeeping/cleaningKits';

/** Room-type kits: turnover after checkout, stayover while the guest is in house. */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;
    const subdomain = getTenantFromRequest(request);
    if (!subdomain) return NextResponse.json({ error: 'Missing tenant header' }, { status: 400 });
    const ctx = await getTenantContext(subdomain);
    if (!ctx) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const [settings, items] = await Promise.all([
      prisma.systemSettings.findUnique({ where: { tenantId: ctx.tenantId }, select: { roomSettings: true } }),
      prisma.inventoryItem.findMany({
        where: { tenantId: ctx.tenantId, isActive: true },
        select: { id: true, name: true, unit: { select: { name: true } } },
        orderBy: { name: 'asc' },
      }),
    ]);
    const kits = parseCleaningKits((settings?.roomSettings as { cleaningKits?: unknown } | null)?.cleaningKits);
    return NextResponse.json({
      kits,
      items: items.map((item) => ({ id: item.id, name: item.name, unit: item.unit?.name || '' })),
    });
  } catch (error) {
    console.error('[housekeeping/cleaning-kits][GET] error', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await requirePermission(request, 'housekeeping.manage-supplies');
    if (!auth.ok) return auth.response;
    const subdomain = getTenantFromRequest(request);
    if (!subdomain) return NextResponse.json({ error: 'Missing tenant header' }, { status: 400 });
    const ctx = await getTenantContext(subdomain);
    if (!ctx) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const body = await request.json();
    const kits = parseCleaningKits(body.kits);
    const existing = await prisma.systemSettings.findUnique({ where: { tenantId: ctx.tenantId } });
    const roomSettings = { ...((existing?.roomSettings as Record<string, unknown>) || {}), cleaningKits: kits };
    await prisma.systemSettings.upsert({
      where: { tenantId: ctx.tenantId },
      update: { roomSettings: roomSettings as Prisma.InputJsonValue },
      create: {
        tenantId: ctx.tenantId,
        generalSettings: {},
        hotelSettings: {},
        roomSettings: roomSettings as Prisma.InputJsonValue,
        financialSettings: {},
        clientSettings: {},
        saasSettings: {},
      },
    });

    const sessionUserId = (auth.session as { user?: { id?: string } }).user?.id;
    await createAuditLog(ctx.tenantId, sessionUserId ?? null, 'HOUSEKEEPING_KITS_SAVED', 'SystemSettings', ctx.tenantId, undefined, { roomTypes: Object.keys(kits).length }, request);
    return NextResponse.json({ kits });
  } catch (error) {
    console.error('[housekeeping/cleaning-kits][PUT] error', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
