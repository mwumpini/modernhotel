import { NextRequest, NextResponse } from 'next/server';
import { getTenantFromRequest, getTenantContext } from '@/app/lib/api/tenant';
import { requireAuth } from '@/app/lib/api/auth-guard';
import {
  listBankAccounts,
  listBusinessPartners,
  listChartOfAccounts,
  listCostCenters,
  listInvoices,
  listPayments,
  listRevenueCenters,
} from '@/app/lib/accounting/repository';

/**
 * One read for opening Accounting. Ten separate calls each repeat login and
 * tenant lookup, and in development each one is compiled the first time.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;
    const subdomain = getTenantFromRequest(request);
    if (!subdomain) return NextResponse.json({ error: 'Missing tenant header' }, { status: 400 });
    const ctx = await getTenantContext(subdomain);
    if (!ctx) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const tenantId = ctx.tenantId;
    // Journal lines, the cashbook, and the activity log load when those desks open.
    const [
      invoices,
      payments,
      chartOfAccounts,
      bankAccounts,
      costCenters,
      revenueCenters,
      businessPartners,
    ] = await Promise.all([
      listInvoices(tenantId),
      listPayments(tenantId),
      listChartOfAccounts(tenantId),
      listBankAccounts(tenantId),
      listCostCenters(tenantId),
      listRevenueCenters(tenantId),
      listBusinessPartners(tenantId),
    ]);

    return NextResponse.json({
      invoices,
      payments,
      chartOfAccounts,
      bankAccounts,
      costCenters,
      revenueCenters,
      businessPartners,
    });
  } catch (error) {
    console.error('[accounting/bootstrap][GET] error', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
