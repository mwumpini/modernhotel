import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/app/lib/api/auth-guard';
import { getTenantFromRequest, getTenantContext } from '@/app/lib/api/tenant';
import { upsertTaxRule, deleteTaxRule } from '@/app/lib/compliance/repository';

function validateRule(body: Record<string, unknown>): string | null {
  if (!body) return 'Missing body';
  if (!body.countryCode) return 'countryCode is required';
  if (!body.name) return 'name is required';
  if (typeof body.rate !== 'number' || Number.isNaN(body.rate)) return 'rate must be a number';
  if (!body.glCode) return 'glCode is required';
  return null;
}

async function resolveTenant(req: NextRequest) {
  const subdomain = getTenantFromRequest(req);
  if (!subdomain) return null;
  return getTenantContext(subdomain);
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;
    const ctx = await resolveTenant(request);
    if (!ctx) return NextResponse.json({ error: 'Missing or unknown tenant' }, { status: 400 });

    const body = await request.json();
    const err = validateRule(body);
    if (err) return NextResponse.json({ error: err }, { status: 400 });

    const saved = await upsertTaxRule(ctx.tenantId, body);
    return NextResponse.json(saved, { status: 201 });
  } catch (error) {
    console.error('[compliance/taxes/manage][POST] error', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;
    const ctx = await resolveTenant(request);
    if (!ctx) return NextResponse.json({ error: 'Missing or unknown tenant' }, { status: 400 });

    const body = await request.json();
    if (!body.id) return NextResponse.json({ error: 'id is required for update' }, { status: 400 });
    const err = validateRule(body);
    if (err) return NextResponse.json({ error: err }, { status: 400 });

    const saved = await upsertTaxRule(ctx.tenantId, body);
    return NextResponse.json(saved);
  } catch (error) {
    console.error('[compliance/taxes/manage][PUT] error', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;
    const ctx = await resolveTenant(request);
    if (!ctx) return NextResponse.json({ error: 'Missing or unknown tenant' }, { status: 400 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    const result = await deleteTaxRule(ctx.tenantId, id);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[compliance/taxes/manage][DELETE] error', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
