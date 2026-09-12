import { NextRequest, NextResponse } from 'next/server';
import { getTenantFromRequest, getTenantContext } from '@/app/lib/api/tenant';
import { requireAuth } from '@/app/lib/api/auth-guard';
import { getLocationStockLevels, DEPARTMENT_LOCATIONS } from '@/app/lib/inventory/repository';

/**
 * GET /api/inventory/stock-levels?department=restaurant|kitchen
 * Real, per-department on-hand quantities — derived from InventoryTransaction
 * (see getLocationStockLevels), not a separately-maintained counter.
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (!auth.ok) return auth.response;
    const subdomain = getTenantFromRequest(req);
    if (!subdomain) return NextResponse.json({ error: 'Missing tenant header' }, { status: 400 });
    const ctx = await getTenantContext(subdomain);
    if (!ctx) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const department = req.nextUrl.searchParams.get('department') || '';
    if (!DEPARTMENT_LOCATIONS[department]) {
      return NextResponse.json({ error: `department must be one of: ${Object.keys(DEPARTMENT_LOCATIONS).join(', ')}` }, { status: 400 });
    }

    const items = await getLocationStockLevels(ctx.tenantId, department);
    return NextResponse.json({ items });
  } catch (error) {
    console.error('[inventory/stock-levels][GET] error', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
