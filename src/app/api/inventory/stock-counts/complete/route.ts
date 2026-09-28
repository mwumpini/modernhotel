import { NextRequest, NextResponse } from 'next/server';
import { getTenantFromRequest, getTenantContext } from '@/app/lib/api/tenant';
import { requireAuth } from '@/app/lib/api/auth-guard';
import {
	DEPARTMENT_LOCATIONS,
	findStockLocationByName,
	listStockCounts,
	postLocationStockCountVariances,
	upsertStockCount,
	type StockCountItemInput,
} from '@/app/lib/inventory/repository';

async function resolveTenantId(req: NextRequest): Promise<string | null> {
	const subdomain = getTenantFromRequest(req);
	if (!subdomain) return null;
	const ctx = await getTenantContext(subdomain);
	return ctx?.tenantId ?? null;
}

/**
 * POST /api/inventory/stock-counts/complete
 * Marks a count completed and posts variances to the count's stock location
 * (resolved by name). When `department` is set, the location must belong to it.
 */
export async function POST(req: NextRequest) {
	try {
		const auth = await requireAuth(req);
		if (!auth.ok) return auth.response;
		const tenantId = await resolveTenantId(req);
		if (!tenantId) return NextResponse.json({ error: 'Missing or unknown tenant' }, { status: 400 });

		const body = await req.json();
		const id = body.id as string | undefined;
		if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

		const existing = (await listStockCounts(tenantId)).find((c) => c.id === id);
		if (!existing) return NextResponse.json({ error: 'Stock count not found' }, { status: 404 });
		if (existing.status === 'completed') {
			return NextResponse.json({ error: 'Count already completed' }, { status: 400 });
		}
		if (existing.status === 'cancelled') {
			return NextResponse.json({ error: 'Cannot complete a voided count' }, { status: 400 });
		}

		const items: StockCountItemInput[] = (existing.items || []).map((item) => ({
			itemId: item.itemId,
			itemCode: item.itemCode,
			itemName: item.itemName,
			expectedQuantity: Number(item.expectedQuantity),
			countedQuantity: Number(item.countedQuantity),
			variance: Number(item.variance),
			unitCost: Number(item.unitCost),
			varianceValue: Number(item.varianceValue),
			notes: item.notes ?? undefined,
		}));

		const department = typeof body.department === 'string' ? body.department : '';
		const performedBy = body.performedBy || existing.performedBy || existing.createdBy || 'staff';

		if (department || body.postLocationVariances) {
			if (department && !DEPARTMENT_LOCATIONS[department]) {
				return NextResponse.json({ error: 'Unknown department' }, { status: 400 });
			}
			const location = await findStockLocationByName(tenantId, existing.location);
			if (!location) {
				return NextResponse.json(
					{ error: `Stock location "${existing.location}" was not found` },
					{ status: 400 },
				);
			}
			if (department && location.department && location.department !== department) {
				return NextResponse.json(
					{ error: 'Count location does not belong to this department' },
					{ status: 403 },
				);
			}
			await postLocationStockCountVariances({
				tenantId,
				locationId: location.id,
				countId: id,
				performedBy,
				items: items.map((i) => ({
					itemId: i.itemId,
					variance: i.variance,
					unitCost: i.unitCost,
					notes: i.notes,
				})),
			});
		}

		const count = await upsertStockCount({
			id,
			tenantId,
			countNumber: existing.countNumber,
			countType: existing.countType,
			location: existing.location,
			startDate: existing.startDate,
			endDate: new Date(),
			status: 'completed',
			notes: existing.notes ?? undefined,
			createdBy: existing.createdBy,
			performedBy,
			items,
		});

		return NextResponse.json({ count });
	} catch (error) {
		console.error('Error completing stock count:', error);
		return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
	}
}
