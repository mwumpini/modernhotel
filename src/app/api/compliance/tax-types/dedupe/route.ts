import { NextRequest, NextResponse } from 'next/server';
import { ComplianceDB } from '@/app/lib/compliance/db';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const countryCode = body?.countryCode as string | undefined;
    if (!countryCode) {
      return NextResponse.json({ error: 'countryCode is required' }, { status: 400 });
    }
    const result = ComplianceDB.dedupeTaxTypesForCountry(countryCode);
    return NextResponse.json(result);
  } catch (e: any) {
    console.error('[API] POST /api/compliance/tax-types/dedupe error', e);
    return NextResponse.json({ error: e?.message || 'Dedupe failed' }, { status: 500 });
  }
}
