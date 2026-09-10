import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/app/lib/api/auth-guard';
import { getTenantFromRequest, getTenantContext } from '@/app/lib/api/tenant';
import { dedupeTaxTypesForTenant } from '@/app/lib/compliance/repository';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;

    const subdomain = getTenantFromRequest(request);
    if (!subdomain) return NextResponse.json({ error: 'Missing tenant header' }, { status: 400 });
    const ctx = await getTenantContext(subdomain);
    if (!ctx) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const body = await request.json();
    const countryCode = body?.countryCode;
    if (!countryCode) {
      return NextResponse.json({ error: 'countryCode is required' }, { status: 400 });
    }

    const result = await dedupeTaxTypesForTenant(ctx.tenantId, String(countryCode));
    return NextResponse.json(result);
  } catch (error) {
    console.error('[compliance/tax-types/dedupe][POST] error', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
