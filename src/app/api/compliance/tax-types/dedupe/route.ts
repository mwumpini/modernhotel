import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/app/lib/api/auth-guard';
import { ComplianceDB } from '@/app/lib/compliance/db';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;

    const body = await request.json();
    const countryCode = body?.countryCode;
    if (!countryCode) {
      return NextResponse.json({ error: 'countryCode is required' }, { status: 400 });
    }

    const result = ComplianceDB.dedupeTaxTypesForCountry(String(countryCode));
    return NextResponse.json(result);
  } catch (error) {
    console.error('[compliance/tax-types/dedupe][POST] error', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
