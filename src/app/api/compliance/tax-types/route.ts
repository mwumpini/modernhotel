import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/app/lib/api/auth-guard';
import { getTenantFromRequest, getTenantContext } from '@/app/lib/api/tenant';
import { listTaxTypes } from '@/app/lib/compliance/repository';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;

    const subdomain = getTenantFromRequest(request);
    if (!subdomain) return NextResponse.json({ error: 'Missing tenant header' }, { status: 400 });
    const ctx = await getTenantContext(subdomain);
    if (!ctx) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const { searchParams } = new URL(request.url);
    const country = searchParams.get('country');
    if (!country) return NextResponse.json({ error: 'country is required' }, { status: 400 });

    const taxTypes = await listTaxTypes(ctx.tenantId, country);
    return NextResponse.json(taxTypes);
  } catch (error) {
    console.error('[compliance/tax-types][GET] error', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
