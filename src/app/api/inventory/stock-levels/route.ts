import { NextRequest, NextResponse } from 'next/server';
import { getTenantFromRequest, getTenantContext } from '@/app/lib/api/tenant';
import { requireAuth } from '@/app/lib/api/auth-guard';
import {
  getLocationStockLevels,
  getStockLevelsAtLocation,
  DEPARTMENT_LOCATIONS,
} from '@/app/lib/inventory/repository';
import { prisma } from '@/app/lib/database/client';

/**
 * GET /api/inventory/stock-levels?department=restaurant|kitchen|housekeeping
 * GET /api/inventory/stock-levels?locationId=...
 * Optional: department + locationId (location must belong to that department).
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
    const locationId = req.nextUrl.searchParams.get('locationId') || '';

    if (locationId) {
      const location = await prisma.stockLocation.findFirst({
        where: { id: locationId, tenantId: ctx.tenantId, isActive: true },
      });
      if (!location) {
        return NextResponse.json({ error: 'Location not found' }, { status: 404 });
      }
      if (department) {
        if (!DEPARTMENT_LOCATIONS[department]) {
          return NextResponse.json(
            { error: `department must be one of: ${Object.keys(DEPARTMENT_LOCATIONS).join(', ')}` },
            { status: 400 },
          );
        }
        if (location.department && location.department !== department) {
          return NextResponse.json({ error: 'Location does not belong to this department' }, { status: 403 });
        }
      }
      const items = await getStockLevelsAtLocation(ctx.tenantId, locationId);
      return NextResponse.json({ items, location: { id: location.id, name: location.name, code: location.code } });
    }

    if (!DEPARTMENT_LOCATIONS[department]) {
      return NextResponse.json(
        { error: `department or locationId required; department must be one of: ${Object.keys(DEPARTMENT_LOCATIONS).join(', ')}` },
        { status: 400 },
      );
    }

    const items = await getLocationStockLevels(ctx.tenantId, department);
    return NextResponse.json({ items });
  } catch (error) {
    console.error('[inventory/stock-levels][GET] error', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
