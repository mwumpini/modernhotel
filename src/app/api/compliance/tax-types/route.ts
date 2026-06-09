import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/app/lib/api/auth-guard';
import { ComplianceDB } from '@/app/lib/compliance/db';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;

    const { searchParams } = new URL(request.url);
    const country = searchParams.get('country') || undefined;

    const taxTypes = ComplianceDB.getTaxTypes(country);
    return NextResponse.json(taxTypes);
  } catch (error) {
    console.error('[compliance/tax-types][GET] error', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
