import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/database/client';
import { requireAuth } from '@/app/lib/api/auth-guard';
import { getTenantFromRequest, getTenantContext } from '@/app/lib/api/tenant';
import { isRecordKind } from '@/app/lib/api/recordKinds';

/**
 * Per-hotel records that used to live only in one browser: GET lists a kind, PUT saves one
 * record ({ id, data }), DELETE ?id= removes one. See TenantRecord in the Prisma schema.
 */
const MAX_BYTES = 3 * 1024 * 1024; // settings can carry logos

/** Kinds where each record belongs to one person (record id = their user id): nobody else may read or change it. */
const PERSONAL_KINDS = new Set<string>(['setting.stickies']);

async function context(request: NextRequest, kind: string) {
  const auth = await requireAuth(request);
  if (!auth.ok) return { error: auth.response };
  if (!isRecordKind(kind)) return { error: NextResponse.json({ error: 'Unknown record kind' }, { status: 400 }) };
  const subdomain = getTenantFromRequest(request);
  if (!subdomain) return { error: NextResponse.json({ error: 'Missing tenant header' }, { status: 400 }) };
  const ctx = await getTenantContext(subdomain);
  if (!ctx) return { error: NextResponse.json({ error: 'Tenant not found' }, { status: 404 }) };
  const userId = String((auth.session as { user?: { id?: string } }).user?.id || '');
  return { tenantId: ctx.tenantId, userId, personal: PERSONAL_KINDS.has(kind) };
}

function notYours() {
  return NextResponse.json({ error: 'You can only change your own notes.' }, { status: 403 });
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ kind: string }> }) {
  try {
    const { kind } = await params;
    const c = await context(request, kind);
    if ('error' in c) return c.error;
    const rows = await prisma.tenantRecord.findMany({
      where: { tenantId: c.tenantId, kind, ...(c.personal ? { recordId: c.userId || '-' } : {}) },
      orderBy: { createdAt: 'asc' },
    });
    return NextResponse.json({ records: rows.map((r) => ({ id: r.recordId, data: r.data, updatedAt: r.updatedAt })) });
  } catch (error) {
    console.error('[records][GET] error', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ kind: string }> }) {
  try {
    const { kind } = await params;
    const c = await context(request, kind);
    if ('error' in c) return c.error;
    const body = await request.json().catch(() => null);
    const recordId = typeof body?.id === 'string' ? body.id.trim() : '';
    if (!recordId || recordId.length > 200 || body?.data === undefined) {
      return NextResponse.json({ error: 'id and data are required' }, { status: 400 });
    }
    if (c.personal && recordId !== c.userId) return notYours();
    if (JSON.stringify(body.data).length > MAX_BYTES) {
      return NextResponse.json({ error: 'Record too large' }, { status: 413 });
    }
    await prisma.tenantRecord.upsert({
      where: { tenantId_kind_recordId: { tenantId: c.tenantId, kind, recordId } },
      update: { data: body.data },
      create: { tenantId: c.tenantId, kind, recordId, data: body.data },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[records][PUT] error', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ kind: string }> }) {
  try {
    const { kind } = await params;
    const c = await context(request, kind);
    if ('error' in c) return c.error;
    const recordId = request.nextUrl.searchParams.get('id') || '';
    if (!recordId) return NextResponse.json({ error: 'id is required' }, { status: 400 });
    if (c.personal && recordId !== c.userId) return notYours();
    await prisma.tenantRecord.deleteMany({ where: { tenantId: c.tenantId, kind, recordId } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[records][DELETE] error', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
