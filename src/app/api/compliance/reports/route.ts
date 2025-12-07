import { NextRequest, NextResponse } from 'next/server';
import { ComplianceDB } from '@/app/lib/compliance/db';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const country = searchParams.get('country') || undefined;
    const items = ComplianceDB.getReports(country);
    console.log('[API] GET /api/compliance/reports', { country, count: items.length });
    return NextResponse.json(items);
  } catch (e: any) {
    console.error('[API] GET /api/compliance/reports error', e);
    return NextResponse.json({ error: e?.message || 'Failed to load reports' }, { status: 500 });
  }
}


