import { NextRequest, NextResponse } from 'next/server';
import { getTenantFromRequest, getTenantContext } from '@/app/lib/api/tenant';
import { requireAuth } from '@/app/lib/api/auth-guard';
import { listInvoices } from '@/app/lib/accounting/repository';
import {
  computeFinanceAgingBuckets,
  computeCustomerAgingFromInvoices,
  totalFinanceReceivables,
  FINANCE_AR_SOURCE,
} from '@/app/lib/accounting/arSubledger';

/** Finance AR aging — accounting subledger only (Option B). */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;

    const subdomain = getTenantFromRequest(request);
    if (!subdomain) return NextResponse.json({ error: 'Missing tenant header' }, { status: 400 });
    const ctx = await getTenantContext(subdomain);
    if (!ctx) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const { searchParams } = new URL(request.url);
    const asOfParam = searchParams.get('asOf');
    const bucketsParam = searchParams.get('buckets');
    const includeCustomers = searchParams.get('customers') === 'true';

    const asOf = asOfParam ? new Date(asOfParam) : new Date();
    const bucketStarts = bucketsParam
      ? bucketsParam.split(',').map((s) => parseInt(s.trim(), 10)).filter((n) => Number.isFinite(n))
      : undefined;

    const invoices = await listInvoices(ctx.tenantId);
    const buckets = computeFinanceAgingBuckets(invoices, asOf, bucketStarts);
    const totalOutstanding = totalFinanceReceivables(invoices);

    const body: Record<string, unknown> = {
      source: FINANCE_AR_SOURCE,
      asOf: asOf.toISOString(),
      totalOutstanding,
      buckets,
    };

    if (includeCustomers) {
      body.customers = computeCustomerAgingFromInvoices(invoices, [], asOf);
    }

    return NextResponse.json(body);
  } catch (error) {
    console.error('[accounting/receivables/aging][GET] error', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
