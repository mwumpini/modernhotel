import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/app/lib/api/auth-guard';
import { getTenantFromRequest, getTenantContext } from '@/app/lib/api/tenant';
import { upsertTaxType, deleteTaxType } from '@/app/lib/compliance/repository';

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
    if (!body.countryCode) return NextResponse.json({ error: 'countryCode is required' }, { status: 400 });
    if (!body.name) return NextResponse.json({ error: 'name is required' }, { status: 400 });

    const saved = await upsertTaxType(ctx.tenantId, body);
    return NextResponse.json(saved, { status: 201 });
  } catch (error) {
    console.error('[compliance/tax-types/manage][POST] error', error);
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
    if (!body.countryCode) return NextResponse.json({ error: 'countryCode is required' }, { status: 400 });
    if (!body.name) return NextResponse.json({ error: 'name is required' }, { status: 400 });

    const saved = await upsertTaxType(ctx.tenantId, body);
    return NextResponse.json(saved);
  } catch (error) {
    console.error('[compliance/tax-types/manage][PUT] error', error);
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

    const result = await deleteTaxType(ctx.tenantId, id);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[compliance/tax-types/manage][DELETE] error', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
