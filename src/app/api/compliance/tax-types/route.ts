import { NextRequest, NextResponse } from 'next/server';
import { ComplianceDB } from '@/app/lib/compliance/db';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const country = searchParams.get('country') || undefined;
    const items = ComplianceDB.getTaxTypes(country);
    console.log('[API] GET /api/compliance/tax-types', { country, count: items.length });
    return NextResponse.json(items);
  } catch (e: any) {
    console.error('[API] GET /api/compliance/tax-types error', e);
    return NextResponse.json({ error: e?.message || 'Failed to load tax types' }, { status: 500 });
  }
}


