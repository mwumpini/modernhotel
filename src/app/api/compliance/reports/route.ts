import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/app/lib/api/auth-guard';
import { getTenantFromRequest, getTenantContext } from '@/app/lib/api/tenant';
import { listReportingRules } from '@/app/lib/compliance/repository';

/** Filing schedules / reporting rules for Compliance → Reports & Filing (the shared
 * reference data -- due dates/frequencies -- distinct from /api/compliance/report-filings,
 * which tracks this tenant's actual submitted/approved status per period). */
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

    const reportingRules = await listReportingRules(ctx.tenantId, country);
    return NextResponse.json(reportingRules);
  } catch (error) {
    console.error('[compliance/reports][GET] error', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
