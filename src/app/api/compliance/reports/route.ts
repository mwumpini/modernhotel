import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/app/lib/api/auth-guard';
import { ComplianceDB } from '@/app/lib/compliance/db';

/** Filing schedules / reporting rules for Compliance → Reports & Filing */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;

    const { searchParams } = new URL(request.url);
    const country = searchParams.get('country') || undefined;

    const reportingRules = ComplianceDB.getReports(country);
    return NextResponse.json(reportingRules);
  } catch (error) {
    console.error('[compliance/reports][GET] error', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
