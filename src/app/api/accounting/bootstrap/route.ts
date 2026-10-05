import { NextRequest, NextResponse } from 'next/server';
import { getTenantFromRequest, getTenantContext } from '@/app/lib/api/tenant';
import { requireAuth } from '@/app/lib/api/auth-guard';
import { listAccountingAuditTrail } from '@/app/lib/accounting/auditTrailList';
import {
  listBankAccounts,
  listBankTransactions,
  listBusinessPartners,
  listChartOfAccounts,
  listCostCenters,
  listInvoices,
  listJournalEntries,
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
    const [
      journalEntries,
      invoices,
      payments,
      chartOfAccounts,
      bankAccounts,
      costCenters,
      revenueCenters,
      businessPartners,
      bankTransactions,
      auditTrail,
    ] = await Promise.all([
      listJournalEntries(tenantId),
      listInvoices(tenantId),
      listPayments(tenantId),
      listChartOfAccounts(tenantId),
      listBankAccounts(tenantId),
      listCostCenters(tenantId),
      listRevenueCenters(tenantId),
      listBusinessPartners(tenantId),
      listBankTransactions(tenantId),
      listAccountingAuditTrail(tenantId),
    ]);

    return NextResponse.json({
      journalEntries,
      invoices,
      payments,
      chartOfAccounts,
      bankAccounts,
      costCenters,
      revenueCenters,
      businessPartners,
      bankTransactions,
      auditTrail,
    });
  } catch (error) {
    console.error('[accounting/bootstrap][GET] error', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
