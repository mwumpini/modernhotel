import { prisma } from '../database/client'
import { DEPARTMENT_LOCATIONS } from './departmentLocations'

export { DEPARTMENT_LOCATIONS };

/**
 * Tax on a purchase order — sums whichever real, tenant-editable compliance Tax Type
 * (Settings → Tax Rate Builder, e.g. "Purchases Standard Tax" = NHIL+GETFund+VAT
 * stacked, or "Purchases Flat Rate" = VFRS 3% — the same Tax Types a PO's Tax Type
 * dropdown lists) the client selected, using the one shared stacking engine
 * (computeTaxStack) so this never diverges from what the compliance simulator/store
 * would show. The server re-resolves the rules itself rather than trusting whatever
 * the client last saw, so a rate change in Settings takes effect immediately.
 * 'custom' is the one exception: a manually typed override rate for a one-off case
 * the compliance rule set doesn't cover.
 */
async function resolvePurchaseTax(tenantId: string, subtotal: number, taxTypeId?: string | null, customRate?: number): Promise<{ amount: number }> {
	if (!(subtotal > 0) || !taxTypeId) return { amount: 0 }
	if (taxTypeId === 'custom') {
		const rate = Number(customRate) || 0
		return { amount: Math.round(subtotal * (rate / 100) * 100) / 100 }
	}
	try {
		// Dynamic imports avoid bundling this into client chunks when tree-shaken.
		// listTaxRules is the real, tenant-scoped (Prisma-backed) store -- the same one
		// the Tax Rate Builder UI reads/writes via /api/compliance/taxes[/manage].
		// ComplianceDB (compliance/db.ts) is a legacy, non-tenant-scoped JSON snapshot
		// frozen at first seed; reading from it here would silently ignore every tax
		// rule/type a tenant creates or edits afterward.
		const { listTaxRules } = require('../compliance/repository') as typeof import('../compliance/repository')
		const { computeTaxStack } = require('../compliance/calcEngine') as typeof import('../compliance/calcEngine')
		const rules = await listTaxRules(tenantId, 'GH')
		const { total } = computeTaxStack(rules as any[], subtotal, 'ALL', { domain: 'purchases', operation: 'internal', typeId: taxTypeId })
		return { amount: Math.round((total - subtotal) * 100) / 100 }
	} catch (e) {
		console.error('[resolvePurchaseTax] failed:', e)
		return { amount: 0 }
	}
}

export async function upsertUnitOfMeasure(tenantId: string, code: string, name: string, precision = 0) {
	console.log('[inventory][upsertUnitOfMeasure]', { tenantId, code, name, precision });
	return prisma.unitOfMeasure.upsert({
		where: { tenantId_code: { tenantId, code } },
		update: { name, precision },
		create: { tenantId, code, name, precision },
	});
}

export async function upsertItemCategory(tenantId: string, code: string, name: string, parentId?: string) {
	console.log('[inventory][upsertItemCategory]', { tenantId, code, name, parentId });
	return prisma.itemCategory.upsert({
		where: { tenantId_code: { tenantId, code } },
		update: { name, parentId },
		create: { tenantId, code, name, parentId },
	});
}

export async function createSupplier(params: {
	tenantId: string;
	code: string;
	name: string;
	email?: string;
	phone?: string;
	contactPerson?: string;
	taxNumber?: string;
	address?: Record<string, unknown>;
}) {
	console.log('[inventory][createSupplier]', params);
	return prisma.supplier.create({ data: params as any });
}

export async function listSuppliers(tenantId: string) {
	return prisma.supplier.findMany({ where: { tenantId, isActive: true }, orderBy: { name: 'asc' } });
}

async function nextSupplierCode(tenantId: string): Promise<string> {
	const last = await prisma.supplier.findFirst({ where: { tenantId }, orderBy: { code: 'desc' } });
	const n = last?.code ? (parseInt(last.code.replace(/\D/g, ''), 10) || 0) + 1 : 1;
	return `SUP${String(n).padStart(3, '0')}`;
}

/** Ownership-checked upsert by id — a client-supplied id collision must not let one
 * tenant overwrite another tenant's supplier (see hr/repository.ts for the full rationale). */
export async function upsertSupplier(tenantId: string, id: string, supplier: Record<string, any>) {
	const existing = await prisma.supplier.findUnique({ where: { id } });
	if (existing && existing.tenantId !== tenantId) {
		throw new Error('Record belongs to a different tenant');
	}
	const data = {
		name: supplier.name,
		email: supplier.email || undefined,
		phone: supplier.phone || undefined,
		contactPerson: supplier.contactPerson || undefined,
		taxNumber: supplier.taxNumber || undefined,
		address: supplier.address || undefined,
		details: supplier.details || undefined,
		isActive: supplier.isActive !== undefined ? supplier.isActive : undefined,
	};
	if (existing) {
		return prisma.supplier.update({ where: { id }, data });
	}
	const code = supplier.code || (await nextSupplierCode(tenantId));
	return prisma.supplier.create({ data: { id, tenantId, code, ...data } as any });
}

export async function createInventoryItem(params: {
	tenantId: string;
	code: string;
	name: string;
	description?: string;
	categoryId?: string;
	unitId?: string;
	isPerishable?: boolean;
	isSerialized?: boolean;
	barcode?: string;
	defaultCost?: any;
	sellingPrice?: any;
}) {
	console.log('[inventory][createInventoryItem]', { tenantId: params.tenantId, code: params.code, name: params.name });
	return prisma.inventoryItem.create({ data: params });
}

export async function getItemByCode(tenantId: string, code: string) {
	console.log('[inventory][getItemByCode]', { tenantId, code });
	return prisma.inventoryItem.findUnique({
		where: { tenantId_code: { tenantId, code } },
		include: { category: true, unit: true },
	});
}

export async function listItems(tenantId: string, q?: string) {
	console.log('[inventory][listItems]', { tenantId, q });
	return prisma.inventoryItem.findMany({
		where: {
			tenantId,
			AND: q
				? [
						{
							OR: [
								{ code: { contains: q } },
								{ name: { contains: q } },
							],
						},
				  ]
				: undefined,
		},
		orderBy: [{ code: 'asc' }],
		take: 200,
	});
}

// ---------------------------------------------------------------------------
// Purchase Orders — field names/status vocabulary match
// src/app/lib/inventory/models.ts's PurchaseOrder/PurchaseOrderItem (the shape
// supplierStore.ts's UI actions actually use), so the store can map 1:1 with no
// lossy translation.
// ---------------------------------------------------------------------------

export interface PurchaseOrderItemInput {
	id?: string;
	itemId: string;
	itemCode: string;
	itemName: string;
	quantity: number;
	unitCost: number;
	receivedQuantity?: number;
	notes?: string;
}

export async function listPurchaseOrders(
	tenantId: string,
	filters?: { status?: string; supplierId?: string; startDate?: string; endDate?: string },
) {
	return prisma.purchaseOrder.findMany({
		where: {
			tenantId,
			status: filters?.status || undefined,
			supplierId: filters?.supplierId || undefined,
			orderDate: {
				gte: filters?.startDate ? new Date(filters.startDate) : undefined,
				lte: filters?.endDate ? new Date(filters.endDate) : undefined,
			},
		},
		include: { items: true },
		orderBy: { createdAt: 'desc' },
	});
}

export async function upsertPurchaseOrder(params: {
	id?: string;
	tenantId: string;
	poNumber?: string;
	supplierId: string;
	supplierName: string;
	orderDate?: Date | string;
	expectedDeliveryDate?: Date | string;
	actualDeliveryDate?: Date | string;
	status?: string;
	priority?: string;
	shippingAmount?: number;
	discountAmount?: number;
	currency?: string;
	paymentTerms?: string;
	notes?: string;
	createdBy?: string;
	approvedBy?: string;
	approvedAt?: Date | string;
	// Which compliance Tax Type (Settings → Tax Rate Builder — a named bundle of
	// rules, e.g. "Purchases Standard Tax" or "Purchases Flat Rate") applies to
	// this purchase, by id; undefined/null means none. 'custom' means
	// customTaxRate below is a manually typed override instead of a real type.
	taxTypeId?: string | null;
	customTaxRate?: number;
	items: PurchaseOrderItemInput[];
}) {
	const totalAmount = params.items.reduce((sum, i) => sum + i.quantity * i.unitCost, 0);
	const { amount: taxAmount } = await resolvePurchaseTax(params.tenantId, totalAmount, params.taxTypeId, params.customTaxRate)
	const shippingAmount = params.shippingAmount ?? 0;
	const discountAmount = params.discountAmount ?? 0;
	const finalAmount = totalAmount + taxAmount + shippingAmount - discountAmount;

	const data = {
		supplierId: params.supplierId,
		supplierName: params.supplierName,
		expectedDeliveryDate: params.expectedDeliveryDate ? new Date(params.expectedDeliveryDate) : undefined,
		actualDeliveryDate: params.actualDeliveryDate ? new Date(params.actualDeliveryDate) : undefined,
		status: params.status,
		priority: params.priority,
		totalAmount,
		taxAmount,
		taxTypeId: params.taxTypeId || null,
		shippingAmount,
		discountAmount,
		finalAmount,
		currency: params.currency,
		paymentTerms: params.paymentTerms,
		notes: params.notes,
		approvedBy: params.approvedBy,
		approvedAt: params.approvedAt ? new Date(params.approvedAt) : undefined,
	};

	if (params.id) {
		const existing = await prisma.purchaseOrder.findFirst({ where: { id: params.id, tenantId: params.tenantId } });
		if (existing) {
			await prisma.purchaseOrderItem.deleteMany({ where: { purchaseOrderId: params.id } });
			return prisma.purchaseOrder.update({
				where: { id: params.id },
				data: {
					...data,
					items: {
						create: params.items.map((i) => ({
							tenantId: params.tenantId,
							itemId: i.itemId,
							itemCode: i.itemCode,
							itemName: i.itemName,
							quantity: i.quantity,
							unitCost: i.unitCost,
							totalCost: i.quantity * i.unitCost,
							receivedQuantity: i.receivedQuantity ?? 0,
							notes: i.notes,
						})),
					},
				},
				include: { items: true },
			});
		}
		// id given but no row exists yet — the client (supplierStore.ts) generates its own
		// id optimistically before this sync call resolves; honor it on create instead of
		// generating a different server-side id that the client would then have to reconcile.
	}

	const orderCount = await prisma.purchaseOrder.count({ where: { tenantId: params.tenantId } });
	const poNumber = params.poNumber || `PO-${new Date().getFullYear()}-${String(orderCount + 1).padStart(3, '0')}`;

	return prisma.purchaseOrder.create({
		data: {
			...(params.id ? { id: params.id } : {}),
			tenantId: params.tenantId,
			poNumber,
			orderDate: params.orderDate ? new Date(params.orderDate) : new Date(),
			...data,
			status: data.status || 'draft',
			priority: data.priority || 'medium',
			currency: data.currency || 'GHS',
			items: {
				create: params.items.map((i) => ({
					tenantId: params.tenantId,
					itemId: i.itemId,
					itemCode: i.itemCode,
					itemName: i.itemName,
					quantity: i.quantity,
					unitCost: i.unitCost,
					totalCost: i.quantity * i.unitCost,
					receivedQuantity: i.receivedQuantity ?? 0,
					notes: i.notes,
				})),
			},
		},
		include: { items: true },
	});
}

export async function deletePurchaseOrder(tenantId: string, id: string) {
	const existing = await prisma.purchaseOrder.findFirst({ where: { id, tenantId } });
	if (!existing) return { error: 'not_found' as const };
	await prisma.purchaseOrder.delete({ where: { id } });
	return { error: null };
}

// ---------------------------------------------------------------------------
// Stock — InventoryItem.quantityOnHand is the current-state field;
// InventoryTransaction is the append-only movement log it's derived from.
// Every write goes through recordStockTransaction so the two never drift.
// ---------------------------------------------------------------------------

export type StockTransactionType = 'receipt' | 'issue' | 'transfer_in' | 'transfer_out' | 'adjustment' | 'count';

export async function recordStockTransaction(params: {
	tenantId: string;
	itemId: string;
	locationId?: string;
	type: StockTransactionType;
	quantity: number; // signed: positive adds to stock, negative removes
	unitCost?: number;
	referenceType?: string;
	referenceId?: string;
	notes?: string;
	performedBy?: string;
}) {
	const item = await prisma.inventoryItem.findFirst({ where: { id: params.itemId, tenantId: params.tenantId } });
	if (!item) throw new Error('Item not found for this tenant');

	return prisma.$transaction(async (tx) => {
		const updatedItem = await tx.inventoryItem.update({
			where: { id: params.itemId },
			data: { quantityOnHand: { increment: params.quantity } },
		});
		const transaction = await tx.inventoryTransaction.create({
			data: {
				tenantId: params.tenantId,
				itemId: params.itemId,
				locationId: params.locationId,
				type: params.type,
				quantity: params.quantity,
				unitCost: params.unitCost,
				referenceType: params.referenceType,
				referenceId: params.referenceId,
				notes: params.notes,
				performedBy: params.performedBy,
			},
		});
		return { item: updatedItem, transaction };
	});
}

/** Two linked legs (out at fromLocation, in at toLocation) sharing one referenceId. */
export async function recordStockTransfer(params: {
	tenantId: string;
	itemId: string;
	fromLocationId?: string;
	toLocationId?: string;
	quantity: number; // positive magnitude
	notes?: string;
	performedBy?: string;
	referenceType?: string;
	referenceId?: string;
}) {
	const item = await prisma.inventoryItem.findFirst({ where: { id: params.itemId, tenantId: params.tenantId } });
	if (!item) throw new Error('Item not found for this tenant');
	const referenceType = params.referenceType || 'transfer';
	const referenceId = params.referenceId || `transfer_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

	return prisma.$transaction(async (tx) => {
		await tx.inventoryTransaction.create({
			data: {
				tenantId: params.tenantId,
				itemId: params.itemId,
				locationId: params.fromLocationId,
				type: 'transfer_out',
				quantity: -Math.abs(params.quantity),
				referenceType,
				referenceId,
				notes: params.notes,
				performedBy: params.performedBy,
			},
		});
		await tx.inventoryTransaction.create({
			data: {
				tenantId: params.tenantId,
				itemId: params.itemId,
				locationId: params.toLocationId,
				type: 'transfer_in',
				quantity: Math.abs(params.quantity),
				referenceType,
				referenceId,
				notes: params.notes,
				performedBy: params.performedBy,
			},
		});
		// Net zero on quantityOnHand (same item, in and out) — the transfer only moves
		// stock between locations (fromLocationId left undefined represents the shared,
		// untagged central pool — see ensureDepartmentLocations/getLocationStockLevels),
		// so no adjustment to the item's flat quantity is needed.
		return { referenceId };
	});
}

// ---------------------------------------------------------------------------
// Per-department stock — Restaurant/Kitchen each get a real StockLocation row;
// their "on hand" is derived by summing InventoryTransaction.quantity at that
// location (never a separately-maintained counter, so it can't drift). Stock
// that hasn't been transferred to a department yet is the implicit central
// pool: quantityOnHand minus every department's on-hand, rather than its own
// tracked location — see the transfer_out `fromLocationId: undefined` above.
// ---------------------------------------------------------------------------

/** Hotel-wide stock places. Seeded once; hotels rename/add/deactivate in Settings. */
export const DEFAULT_STOCK_LOCATIONS: {
	code: string;
	name: string;
	type: string;
	department?: string | null;
}[] = [
	{ code: 'MAIN_STORE', name: 'Main Store', type: 'central' },
	{ code: 'DRY_STORE', name: 'Dry Store', type: 'dry' },
	{ code: 'COLD_ROOM', name: 'Cold Room', type: 'cold' },
	{ code: 'FRIDGE_1', name: 'Fridge 1', type: 'cold' },
	{ code: 'FRIDGE_2', name: 'Fridge 2', type: 'cold' },
	{ code: 'BAR_STORE', name: 'Bar Store', type: 'outlet', department: 'restaurant' },
	{ code: 'REST_FRIDGE_SOFT', name: 'Restaurant Soft Drinks Fridge', type: 'cold', department: 'restaurant' },
	{ code: 'REST_FRIDGE_BAR', name: 'Restaurant Bar Fridge', type: 'cold', department: 'restaurant' },
	{ code: 'WAREHOUSE_1', name: 'Warehouse 1', type: 'central' },
	{ code: 'RESTAURANT', name: 'Restaurant & Bar', type: 'department', department: 'restaurant' },
	{ code: 'KITCHEN', name: 'Kitchen', type: 'department', department: 'kitchen' },
	{ code: 'KITCHEN_FRIDGE', name: 'Kitchen Fridge', type: 'cold', department: 'kitchen' },
	{ code: 'HOUSEKEEPING', name: 'Housekeeping', type: 'department', department: 'housekeeping' },
];

function toStockLocation(row: {
	id: string;
	code: string;
	name: string;
	type: string;
	department: string | null;
	isActive: boolean;
	createdAt: Date;
	updatedAt: Date;
}) {
	return {
		id: row.id,
		code: row.code,
		name: row.name,
		type: row.type,
		department: row.department ?? null,
		isActive: row.isActive,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
	};
}

export async function ensureStockLocations(tenantId: string): Promise<void> {
	const existing = await prisma.stockLocation.findMany({
		where: { tenantId },
		select: { id: true, code: true, department: true },
	});
	const byCode = new Map(existing.map((row) => [row.code, row]));

	await Promise.all(
		DEFAULT_STOCK_LOCATIONS.map(async (loc) => {
			const row = byCode.get(loc.code);
			if (!row) {
				await prisma.stockLocation.create({
					data: {
						tenantId,
						code: loc.code,
						name: loc.name,
						type: loc.type,
						department: loc.department ?? null,
						isActive: true,
					},
				});
				return;
			}
			// Backfill department on older seeds only — never overwrite hotel edits
			if (row.department == null && loc.department) {
				await prisma.stockLocation.update({
					where: { id: row.id },
					data: { department: loc.department },
				});
			}
		}),
	);
}

export async function ensureDepartmentLocations(tenantId: string): Promise<void> {
	await ensureStockLocations(tenantId);
}

export async function listStockLocations(
	tenantId: string,
	opts?: { activeOnly?: boolean; seed?: boolean; department?: string },
) {
	if (opts?.seed !== false) await ensureStockLocations(tenantId);
	const rows = await prisma.stockLocation.findMany({
		where: {
			tenantId,
			...(opts?.activeOnly ? { isActive: true } : {}),
			...(opts?.department ? { department: opts.department } : {}),
		},
		orderBy: [{ type: 'asc' }, { name: 'asc' }],
	});
	return rows.map(toStockLocation);
}

export async function findStockLocationByName(tenantId: string, name: string) {
	await ensureStockLocations(tenantId);
	const trimmed = name.trim();
	const exact = await prisma.stockLocation.findFirst({
		where: { tenantId, name: trimmed },
	});
	if (exact) return exact;
	const all = await prisma.stockLocation.findMany({
		where: { tenantId },
		select: { id: true, name: true, department: true, code: true, tenantId: true, type: true, isActive: true, createdAt: true, updatedAt: true },
	});
	return all.find((row) => row.name.toLowerCase() === trimmed.toLowerCase()) ?? null;
}

export async function upsertStockLocation(
	tenantId: string,
	id: string,
	data: {
		code?: string;
		name?: string;
		type?: string;
		department?: string | null;
		isActive?: boolean;
	},
) {
	const existing = await prisma.stockLocation.findUnique({ where: { id } });
	if (existing && existing.tenantId !== tenantId) {
		throw new Error('Record belongs to a different tenant');
	}
	const code = (data.code || existing?.code || '').trim().toUpperCase().replace(/[^A-Z0-9_]+/g, '_');
	const name = (data.name || existing?.name || '').trim();
	if (!code || !name) throw new Error('code and name are required');
	const type = data.type || existing?.type || 'central';
	const department =
		data.department === undefined ? existing?.department ?? null : data.department || null;
	const isActive = data.isActive ?? existing?.isActive ?? true;

	if (existing) {
		const row = await prisma.stockLocation.update({
			where: { id },
			data: { code, name, type, department, isActive },
		});
		return toStockLocation(row);
	}
	const row = await prisma.stockLocation.create({
		data: { id, tenantId, code, name, type, department, isActive },
	});
	return toStockLocation(row);
}

export async function setStockLocationActive(tenantId: string, id: string, isActive: boolean) {
	const existing = await prisma.stockLocation.findFirst({ where: { id, tenantId } });
	if (!existing) return null;
	const row = await prisma.stockLocation.update({ where: { id }, data: { isActive } });
	return toStockLocation(row);
}

export async function getDepartmentLocationId(tenantId: string, department: string): Promise<string | null> {
	const loc = DEPARTMENT_LOCATIONS[department];
	if (!loc) return null;
	await ensureDepartmentLocations(tenantId);
	const row = await prisma.stockLocation.findUnique({ where: { tenantId_code: { tenantId, code: loc.code } } });
	return row?.id ?? null;
}

/** Use stock sitting in a department (housekeeping task, kitchen prep, F&B sale). Reduces that location and the hotel-wide balance. */
export async function issueDepartmentStock(params: {
	tenantId: string;
	department: string;
	/** Override department floor — e.g. Bar Store / fridge tagged to this department */
	locationId?: string;
	items: { itemId: string; quantity: number }[];
	referenceType: string;
	referenceId: string;
	performedBy?: string;
	notes?: string;
	/** strict (default): fail if any line short. best_effort: issue what we can and return warnings. */
	mode?: 'strict' | 'best_effort';
}) {
	if (!DEPARTMENT_LOCATIONS[params.department]) return { error: 'unknown_department' as const };

	let locationId = params.locationId || null;
	if (locationId) {
		const loc = await prisma.stockLocation.findFirst({
			where: { id: locationId, tenantId: params.tenantId, isActive: true },
		});
		if (!loc) return { error: 'no_location' as const };
		if (loc.department && loc.department !== params.department) {
			return { error: 'no_location' as const };
		}
	} else {
		locationId = await getDepartmentLocationId(params.tenantId, params.department);
	}
	if (!locationId) return { error: 'no_location' as const };

	const levels = await getStockLevelsAtLocation(params.tenantId, locationId);
	const onHand = new Map(levels.map((row) => [row.id, row.onHand]));
	const wanted = params.items.filter((item) => item.itemId && Number(item.quantity) > 0);
	const mode = params.mode || 'strict';
	const warnings: { itemId: string; itemName: string; needed: number; onHand: number }[] = [];
	const issued: { itemId: string; itemName: string; quantity: number; unitCost: number }[] = [];

	if (mode === 'strict') {
		for (const item of wanted) {
			const qty = Number(item.quantity);
			const already = await prisma.inventoryTransaction.findFirst({
				where: {
					tenantId: params.tenantId,
					itemId: item.itemId,
					locationId,
					type: 'issue',
					referenceType: params.referenceType,
					referenceId: params.referenceId,
				},
			});
			if (already) continue;
			const have = onHand.get(item.itemId) ?? 0;
			if (have < qty) {
				const name = levels.find((row) => row.id === item.itemId)?.name || item.itemId;
				return { error: 'insufficient' as const, itemName: name, onHand: have };
			}
		}
	}

	for (const item of wanted) {
		const qty = Number(item.quantity);
		const already = await prisma.inventoryTransaction.findFirst({
			where: {
				tenantId: params.tenantId,
				itemId: item.itemId,
				locationId,
				type: 'issue',
				referenceType: params.referenceType,
				referenceId: params.referenceId,
			},
		});
		if (already) {
			// Idempotent re-read: treat prior issue as already issued for callers that need COGS.
			const level = levels.find((row) => row.id === item.itemId);
			issued.push({
				itemId: item.itemId,
				itemName: level?.name || item.itemId,
				quantity: Math.abs(Number(already.quantity || qty)),
				unitCost: Number(level?.defaultCost || 0),
			});
			continue;
		}
		const have = onHand.get(item.itemId) ?? 0;
		if (have < qty) {
			const name = levels.find((row) => row.id === item.itemId)?.name || item.itemId;
			if (mode === 'best_effort') {
				warnings.push({ itemId: item.itemId, itemName: name, needed: qty, onHand: have });
				continue;
			}
			return { error: 'insufficient' as const, itemName: name, onHand: have };
		}
		await recordStockTransaction({
			tenantId: params.tenantId,
			itemId: item.itemId,
			locationId,
			type: 'issue',
			quantity: -qty,
			referenceType: params.referenceType,
			referenceId: params.referenceId,
			notes: params.notes,
			performedBy: params.performedBy,
		});
		const level = levels.find((row) => row.id === item.itemId);
		issued.push({
			itemId: item.itemId,
			itemName: level?.name || item.itemId,
			quantity: qty,
			unitCost: Number(level?.defaultCost || 0),
		});
		onHand.set(item.itemId, have - qty);
	}

	return { error: null as null, warnings, issued };
}

/** Put department stock back. One receipt per item and reference, so a second return does not add the same lines again. */
export async function returnDepartmentStock(params: {
	tenantId: string;
	department: string;
	items: { itemId: string; quantity: number }[];
	referenceType: string;
	referenceId: string;
	performedBy?: string;
	notes?: string;
}) {
	if (!DEPARTMENT_LOCATIONS[params.department]) return { error: 'unknown_department' as const };
	const locationId = await getDepartmentLocationId(params.tenantId, params.department);
	if (!locationId) return { error: 'no_location' as const };

	const returned: { itemId: string; quantity: number }[] = [];
	for (const item of params.items) {
		const qty = Math.floor(Number(item.quantity));
		if (!item.itemId || !Number.isFinite(qty) || qty <= 0) continue;
		const already = await prisma.inventoryTransaction.findFirst({
			where: {
				tenantId: params.tenantId,
				itemId: item.itemId,
				locationId,
				type: 'receipt',
				referenceType: params.referenceType,
				referenceId: params.referenceId,
			},
		});
		if (already) {
			returned.push({ itemId: item.itemId, quantity: Math.abs(Number(already.quantity || qty)) });
			continue;
		}
		await recordStockTransaction({
			tenantId: params.tenantId,
			itemId: item.itemId,
			locationId,
			type: 'receipt',
			quantity: qty,
			referenceType: params.referenceType,
			referenceId: params.referenceId,
			notes: params.notes,
			performedBy: params.performedBy,
		});
		returned.push({ itemId: item.itemId, quantity: qty });
	}
	return { error: null as null, returned };
}

export async function getStockLevelsAtLocation(tenantId: string, locationId: string) {
	const [items, sums] = await Promise.all([
		prisma.inventoryItem.findMany({
			where: { tenantId, isActive: true },
			select: { id: true, code: true, name: true, defaultCost: true, sellingPrice: true, category: { select: { name: true } }, unit: { select: { name: true } } },
			orderBy: { name: 'asc' },
		}),
		prisma.inventoryTransaction.groupBy({
			by: ['itemId'],
			where: { tenantId, locationId },
			_sum: { quantity: true },
		}),
	]);

	const onHandByItem = new Map(sums.map((s) => [s.itemId, Number(s._sum.quantity ?? 0)]));
	return items.map((item) => ({
		id: item.id,
		code: item.code,
		name: item.name,
		category: item.category?.name || '—',
		unit: item.unit?.name || '—',
		defaultCost: Number(item.defaultCost || 0),
		sellingPrice: Number(item.sellingPrice || 0),
		onHand: onHandByItem.get(item.id) ?? 0,
	}));
}

export async function getLocationStockLevels(tenantId: string, department: string) {
	const locationId = await getDepartmentLocationId(tenantId, department);
	if (!locationId) return [];
	return getStockLevelsAtLocation(tenantId, locationId);
}

/** Post count variances onto a location ledger (does not change catalog quantityOnHand). */
export async function postLocationStockCountVariances(params: {
	tenantId: string;
	locationId: string;
	countId: string;
	performedBy: string;
	items: { itemId: string; variance: number; unitCost?: number; notes?: string }[];
}) {
	const location = await prisma.stockLocation.findFirst({
		where: { id: params.locationId, tenantId: params.tenantId },
	});
	if (!location) throw new Error('Location missing');

	const lines = params.items.filter((item) => Number(item.variance) !== 0);
	if (lines.length === 0) return { posted: 0 };

	await prisma.$transaction(
		lines.map((item) =>
			prisma.inventoryTransaction.create({
				data: {
					tenantId: params.tenantId,
					itemId: item.itemId,
					locationId: params.locationId,
					type: 'count',
					quantity: Number(item.variance),
					unitCost: item.unitCost,
					referenceType: 'stock_count',
					referenceId: params.countId,
					notes: item.notes,
					performedBy: params.performedBy,
				},
			}),
		),
	);

	return { posted: lines.length };
}

/** @deprecated Prefer postLocationStockCountVariances with an explicit locationId */
export async function postDepartmentStockCountVariances(params: {
	tenantId: string;
	department: string;
	countId: string;
	performedBy: string;
	items: { itemId: string; variance: number; unitCost?: number; notes?: string }[];
}) {
	const locationId = await getDepartmentLocationId(params.tenantId, params.department);
	if (!locationId) throw new Error('Department location missing');
	return postLocationStockCountVariances({ ...params, locationId });
}

export async function listStockTransactions(
	tenantId: string,
	filters?: { itemId?: string; type?: string; limit?: number },
) {
	return prisma.inventoryTransaction.findMany({
		where: {
			tenantId,
			itemId: filters?.itemId || undefined,
			type: filters?.type || undefined,
		},
		include: { item: true, location: true },
		orderBy: { createdAt: 'desc' },
		take: filters?.limit ?? 200,
	});
}

// ---------------------------------------------------------------------------
// Requisitions — field names/status vocabulary match models.ts's Requisition/
// RequisitionItem, same 1:1 mapping approach as Purchase Orders above.
// ---------------------------------------------------------------------------

export interface RequisitionItemInput {
	itemId: string;
	itemCode: string;
	itemName: string;
	quantity: number;
	estimatedPrice: number;
	preferredSupplierId?: string;
	preferredSupplierName?: string;
	notes?: string;
}

export async function listRequisitions(tenantId: string, filters?: { status?: string; department?: string }) {
	return prisma.requisition.findMany({
		where: { tenantId, status: filters?.status || undefined, department: filters?.department || undefined },
		include: { items: true },
		orderBy: { createdAt: 'desc' },
	});
}

export async function getRequisitionById(tenantId: string, id: string) {
	return prisma.requisition.findFirst({ where: { id, tenantId }, include: { items: true } });
}

export async function upsertRequisition(params: {
	id?: string;
	tenantId: string;
	requisitionNumber?: string;
	requestedBy: string;
	requestedDate?: Date | string;
	status?: string;
	department?: string;
	assignedToId?: string;
	assignedToName?: string;
	approvedBy?: string;
	approvedAt?: Date | string;
	readyBy?: string;
	readyAt?: Date | string;
	rejectedBy?: string;
	rejectedAt?: Date | string;
	rejectionReason?: string;
	convertedToPOId?: string;
	convertedToPONumber?: string;
	notes?: string;
	items: RequisitionItemInput[];
}) {
	const data = {
		requestedBy: params.requestedBy,
		requestedDate: params.requestedDate ? new Date(params.requestedDate) : undefined,
		status: params.status,
		department: params.department,
		assignedToId: params.assignedToId,
		assignedToName: params.assignedToName,
		approvedBy: params.approvedBy,
		approvedAt: params.approvedAt ? new Date(params.approvedAt) : undefined,
		readyBy: params.readyBy,
		readyAt: params.readyAt ? new Date(params.readyAt) : undefined,
		rejectedBy: params.rejectedBy,
		rejectedAt: params.rejectedAt ? new Date(params.rejectedAt) : undefined,
		rejectionReason: params.rejectionReason,
		convertedToPOId: params.convertedToPOId,
		convertedToPONumber: params.convertedToPONumber,
		notes: params.notes,
	};

	if (params.id) {
		const existing = await prisma.requisition.findFirst({ where: { id: params.id, tenantId: params.tenantId } });
		if (existing) {
			await prisma.requisitionItem.deleteMany({ where: { requisitionId: params.id } });
			const updated = await prisma.requisition.update({
				where: { id: params.id },
				data: {
					...data,
					items: {
						create: params.items.map((i) => ({
							tenantId: params.tenantId,
							itemId: i.itemId,
							itemCode: i.itemCode,
							itemName: i.itemName,
							quantity: i.quantity,
							estimatedPrice: i.estimatedPrice,
							totalCost: i.quantity * i.estimatedPrice,
							preferredSupplierId: i.preferredSupplierId,
							preferredSupplierName: i.preferredSupplierName,
							notes: i.notes,
						})),
					},
				},
				include: { items: true },
			});

			// Fulfill on the approved → ready transition (once): 'approved' is just Stores'
			// decision to fulfill it — the requester is still "waiting on it" until Stores
			// has actually pulled/staged the items and marks it 'ready' for pickup, which is
			// the point real stock leaves the shared central pool for the department's own.
			// Re-saves after that don't re-fire since `existing.status` is already 'ready'.
			const department = updated.department ?? existing.department;
			if (existing.status !== 'ready' && updated.status === 'ready' && department && DEPARTMENT_LOCATIONS[department]) {
				const toLocationId = await getDepartmentLocationId(params.tenantId, department);
				if (toLocationId) {
					await Promise.all(
						updated.items.map((item) =>
							recordStockTransfer({
								tenantId: params.tenantId,
								itemId: item.itemId,
								toLocationId,
								quantity: Number(item.quantity),
								referenceType: 'requisition',
								referenceId: updated.id,
								performedBy: updated.readyBy ?? undefined,
								notes: `Fulfilled requisition ${updated.requisitionNumber}`,
							}),
						),
					);
				}
			}

			return updated;
		}
	}

	const reqCount = await prisma.requisition.count({ where: { tenantId: params.tenantId } });
	const requisitionNumber = params.requisitionNumber || `REQ-${new Date().getFullYear()}-${String(reqCount + 1).padStart(3, '0')}`;

	return prisma.requisition.create({
		data: {
			...(params.id ? { id: params.id } : {}),
			tenantId: params.tenantId,
			requisitionNumber,
			...data,
			status: data.status || 'pending',
			items: {
				create: params.items.map((i) => ({
					tenantId: params.tenantId,
					itemId: i.itemId,
					itemCode: i.itemCode,
					itemName: i.itemName,
					quantity: i.quantity,
					estimatedPrice: i.estimatedPrice,
					totalCost: i.quantity * i.estimatedPrice,
					preferredSupplierId: i.preferredSupplierId,
					preferredSupplierName: i.preferredSupplierName,
					notes: i.notes,
				})),
			},
		},
		include: { items: true },
	});
}

export async function deleteRequisition(tenantId: string, id: string) {
	const existing = await prisma.requisition.findFirst({ where: { id, tenantId } });
	if (!existing) return { error: 'not_found' as const };
	await prisma.requisition.delete({ where: { id } });
	return { ok: true as const };
}

// ---------------------------------------------------------------------------
// Goods Receipt Notes — field names/status vocabulary match models.ts's
// GoodsReceiptNote/GRNItem.
// ---------------------------------------------------------------------------

export interface GRNItemInput {
	poItemId: string;
	itemId: string;
	itemCode: string;
	itemName: string;
	orderedQuantity: number;
	receivedQuantity: number;
	acceptedQuantity: number;
	rejectedQuantity: number;
	unitCost: number;
}

export async function listGoodsReceiptNotes(tenantId: string, filters?: { poId?: string; status?: string }) {
	return prisma.goodsReceiptNote.findMany({
		where: { tenantId, poId: filters?.poId || undefined, status: filters?.status || undefined },
		include: { items: true },
		orderBy: { createdAt: 'desc' },
	});
}

export async function upsertGoodsReceiptNote(params: {
	id?: string;
	tenantId: string;
	grnNumber?: string;
	poId: string;
	poNumber: string;
	supplierId: string;
	supplierName: string;
	receiptDate?: Date | string;
	receivedBy: string;
	status?: string;
	qualityCheckedBy?: string;
	qualityCheckedAt?: Date | string;
	qualityStatus?: string;
	qualityNotes?: string;
	approvedBy?: string;
	approvedAt?: Date | string;
	notes?: string;
	items: GRNItemInput[];
}) {
	const totalItems = params.items.length;
	const totalValue = params.items.reduce((sum, i) => sum + i.acceptedQuantity * i.unitCost, 0);
	const data = {
		poId: params.poId,
		poNumber: params.poNumber,
		supplierId: params.supplierId,
		supplierName: params.supplierName,
		receiptDate: params.receiptDate ? new Date(params.receiptDate) : undefined,
		receivedBy: params.receivedBy,
		totalItems,
		totalValue,
		status: params.status,
		qualityCheckedBy: params.qualityCheckedBy,
		qualityCheckedAt: params.qualityCheckedAt ? new Date(params.qualityCheckedAt) : undefined,
		qualityStatus: params.qualityStatus,
		qualityNotes: params.qualityNotes,
		approvedBy: params.approvedBy,
		approvedAt: params.approvedAt ? new Date(params.approvedAt) : undefined,
		notes: params.notes,
	};

	if (params.id) {
		const existing = await prisma.goodsReceiptNote.findFirst({ where: { id: params.id, tenantId: params.tenantId } });
		if (existing) {
			await prisma.gRNItem.deleteMany({ where: { grnId: params.id } });
			return prisma.goodsReceiptNote.update({
				where: { id: params.id },
				data: {
					...data,
					items: {
						create: params.items.map((i) => ({
							tenantId: params.tenantId,
							poItemId: i.poItemId || i.itemId,
							itemId: i.itemId,
							itemCode: i.itemCode,
							itemName: i.itemName,
							orderedQuantity: i.orderedQuantity,
							receivedQuantity: i.receivedQuantity,
							acceptedQuantity: i.acceptedQuantity,
							rejectedQuantity: i.rejectedQuantity,
							unitCost: i.unitCost,
							totalValue: i.acceptedQuantity * i.unitCost,
						})),
					},
				},
				include: { items: true },
			});
		}
	}

	const grnCount = await prisma.goodsReceiptNote.count({ where: { tenantId: params.tenantId } });
	const grnNumber = params.grnNumber || `GRN-${new Date().getFullYear()}-${String(grnCount + 1).padStart(3, '0')}`;

	return prisma.goodsReceiptNote.create({
		data: {
			...(params.id ? { id: params.id } : {}),
			tenantId: params.tenantId,
			grnNumber,
			...data,
			status: data.status || 'pending',
			items: {
				create: params.items.map((i) => ({
					tenantId: params.tenantId,
					poItemId: i.poItemId || i.itemId,
					itemId: i.itemId,
					itemCode: i.itemCode,
					itemName: i.itemName,
					orderedQuantity: i.orderedQuantity,
					receivedQuantity: i.receivedQuantity,
					acceptedQuantity: i.acceptedQuantity,
					rejectedQuantity: i.rejectedQuantity,
					unitCost: i.unitCost,
					totalValue: i.acceptedQuantity * i.unitCost,
				})),
			},
		},
		include: { items: true },
	});
}

// ---------------------------------------------------------------------------
// Quality Checks — field names/status vocabulary match models.ts's
// QualityCheck/QualityCheckItem, same 1:1 mapping approach as GRNs above.
// ---------------------------------------------------------------------------

export interface QualityCheckItemInput {
	grnItemId: string;
	itemId: string;
	itemCode: string;
	itemName: string;
	receivedQuantity: number;
	checkedQuantity: number;
	passedQuantity: number;
	failedQuantity: number;
	qualityStatus?: string;
	failureReason?: string;
	notes?: string;
}

export async function listQualityChecks(tenantId: string, filters?: { grnId?: string }) {
	return prisma.qualityCheck.findMany({
		where: { tenantId, grnId: filters?.grnId || undefined },
		include: { items: true },
		orderBy: { createdAt: 'desc' },
	});
}

export async function upsertQualityCheck(params: {
	id?: string;
	tenantId: string;
	checkNumber?: string;
	grnId: string;
	grnNumber: string;
	poId: string;
	poNumber: string;
	supplierId: string;
	supplierName: string;
	checkedBy: string;
	checkedDate?: Date | string;
	overallStatus?: string;
	notes?: string;
	approvedBy?: string;
	approvedAt?: Date | string;
	items: QualityCheckItemInput[];
}) {
	const totalItems = params.items.length;
	const passedItems = params.items.filter((i) => i.qualityStatus === 'passed').length;
	const failedItems = params.items.filter((i) => i.qualityStatus === 'failed').length;
	const data = {
		grnId: params.grnId,
		grnNumber: params.grnNumber,
		poId: params.poId,
		poNumber: params.poNumber,
		supplierId: params.supplierId,
		supplierName: params.supplierName,
		checkedBy: params.checkedBy,
		checkedDate: params.checkedDate ? new Date(params.checkedDate) : undefined,
		totalItems,
		passedItems,
		failedItems,
		overallStatus: params.overallStatus,
		notes: params.notes,
		approvedBy: params.approvedBy,
		approvedAt: params.approvedAt ? new Date(params.approvedAt) : undefined,
	};

	if (params.id) {
		const existing = await prisma.qualityCheck.findFirst({ where: { id: params.id, tenantId: params.tenantId } });
		if (existing) {
			await prisma.qualityCheckItem.deleteMany({ where: { checkId: params.id } });
			return prisma.qualityCheck.update({
				where: { id: params.id },
				data: {
					...data,
					items: {
						create: params.items.map((i) => ({
							tenantId: params.tenantId,
							grnItemId: i.grnItemId,
							itemId: i.itemId,
							itemCode: i.itemCode,
							itemName: i.itemName,
							receivedQuantity: i.receivedQuantity,
							checkedQuantity: i.checkedQuantity,
							passedQuantity: i.passedQuantity,
							failedQuantity: i.failedQuantity,
							qualityStatus: i.qualityStatus || 'pending',
							failureReason: i.failureReason,
							notes: i.notes,
						})),
					},
				},
				include: { items: true },
			});
		}
	}

	const checkCount = await prisma.qualityCheck.count({ where: { tenantId: params.tenantId } });
	const checkNumber = params.checkNumber || `QC-${new Date().getFullYear()}-${String(checkCount + 1).padStart(3, '0')}`;

	return prisma.qualityCheck.create({
		data: {
			...(params.id ? { id: params.id } : {}),
			tenantId: params.tenantId,
			checkNumber,
			...data,
			overallStatus: data.overallStatus || 'pending',
			items: {
				create: params.items.map((i) => ({
					tenantId: params.tenantId,
					grnItemId: i.grnItemId,
					itemId: i.itemId,
					itemCode: i.itemCode,
					itemName: i.itemName,
					receivedQuantity: i.receivedQuantity,
					checkedQuantity: i.checkedQuantity,
					passedQuantity: i.passedQuantity,
					failedQuantity: i.failedQuantity,
					qualityStatus: i.qualityStatus || 'pending',
					failureReason: i.failureReason,
					notes: i.notes,
				})),
			},
		},
		include: { items: true },
	});
}

// ---------------------------------------------------------------------------
// Supplier Invoices — field names/status vocabulary match models.ts's
// SupplierInvoice/InvoiceItem. `matchingStatus` (three-way-match result) is
// stored as-is in the Json column since it's one optional nested record, not
// a real relation.
// ---------------------------------------------------------------------------

export interface SupplierInvoiceItemInput {
	poItemId: string;
	grnItemId?: string;
	itemId: string;
	itemCode: string;
	itemName: string;
	quantity: number;
	unitPrice: number;
	notes?: string;
}

export async function listSupplierInvoices(tenantId: string, filters?: { poId?: string; status?: string }) {
	return prisma.supplierInvoice.findMany({
		where: { tenantId, poId: filters?.poId || undefined, status: filters?.status || undefined },
		include: { items: true },
		orderBy: { createdAt: 'desc' },
	});
}

export async function upsertSupplierInvoice(params: {
	id?: string;
	tenantId: string;
	invoiceNumber?: string;
	supplierId: string;
	supplierName: string;
	poId: string;
	poNumber: string;
	grnId?: string;
	grnNumber?: string;
	invoiceDate?: Date | string;
	dueDate: Date | string;
	subtotal?: number;
	taxAmount?: number;
	shippingAmount?: number;
	discountAmount?: number;
	totalAmount?: number;
	currency?: string;
	status?: string;
	matchingStatus?: Record<string, unknown>;
	approvedBy?: string;
	approvedAt?: Date | string;
	rejectedBy?: string;
	rejectedAt?: Date | string;
	rejectionReason?: string;
	paidBy?: string;
	paidAt?: Date | string;
	paymentMethod?: string;
	paymentReference?: string;
	notes?: string;
	items: SupplierInvoiceItemInput[];
}) {
	const data = {
		supplierId: params.supplierId,
		supplierName: params.supplierName,
		poId: params.poId,
		poNumber: params.poNumber,
		grnId: params.grnId,
		grnNumber: params.grnNumber,
		invoiceDate: params.invoiceDate ? new Date(params.invoiceDate) : undefined,
		dueDate: new Date(params.dueDate),
		subtotal: params.subtotal,
		taxAmount: params.taxAmount,
		shippingAmount: params.shippingAmount,
		discountAmount: params.discountAmount,
		totalAmount: params.totalAmount,
		currency: params.currency,
		status: params.status,
		matchingStatus: params.matchingStatus as any,
		approvedBy: params.approvedBy,
		approvedAt: params.approvedAt ? new Date(params.approvedAt) : undefined,
		rejectedBy: params.rejectedBy,
		rejectedAt: params.rejectedAt ? new Date(params.rejectedAt) : undefined,
		rejectionReason: params.rejectionReason,
		paidBy: params.paidBy,
		paidAt: params.paidAt ? new Date(params.paidAt) : undefined,
		paymentMethod: params.paymentMethod,
		paymentReference: params.paymentReference,
		notes: params.notes,
	};

	if (params.id) {
		const existing = await prisma.supplierInvoice.findFirst({ where: { id: params.id, tenantId: params.tenantId } });
		if (existing) {
			if (params.items.length) await prisma.supplierInvoiceItem.deleteMany({ where: { invoiceId: params.id } });
			return prisma.supplierInvoice.update({
				where: { id: params.id },
				data: {
					...data,
					...(params.items.length
						? {
								items: {
									create: params.items.map((i) => ({
										tenantId: params.tenantId,
										poItemId: i.poItemId,
										grnItemId: i.grnItemId,
										itemId: i.itemId,
										itemCode: i.itemCode,
										itemName: i.itemName,
										quantity: i.quantity,
										unitPrice: i.unitPrice,
										totalPrice: i.quantity * i.unitPrice,
										notes: i.notes,
									})),
								},
							}
						: {}),
				},
				include: { items: true },
			});
		}
	}

	const invoiceCount = await prisma.supplierInvoice.count({ where: { tenantId: params.tenantId } });
	const invoiceNumber = params.invoiceNumber || `INV-${new Date().getFullYear()}-${String(invoiceCount + 1).padStart(4, '0')}`;

	return prisma.supplierInvoice.create({
		data: {
			...(params.id ? { id: params.id } : {}),
			tenantId: params.tenantId,
			invoiceNumber,
			...data,
			status: data.status || 'pending',
			items: {
				create: params.items.map((i) => ({
					tenantId: params.tenantId,
					poItemId: i.poItemId,
					grnItemId: i.grnItemId,
					itemId: i.itemId,
					itemCode: i.itemCode,
					itemName: i.itemName,
					quantity: i.quantity,
					unitPrice: i.unitPrice,
					totalPrice: i.quantity * i.unitPrice,
					notes: i.notes,
				})),
			},
		},
		include: { items: true },
	});
}

// ---------------------------------------------------------------------------
// Stock Transfers & Stock Counts — document headers + line items, same upsert
// pattern as GRNs so the UI can create optimistically then sync via PUT.
// ---------------------------------------------------------------------------

export interface StockTransferItemInput {
	itemId: string;
	itemCode: string;
	itemName: string;
	quantity: number;
	unitCost: number;
	transferredQuantity?: number;
	notes?: string;
}

export async function listStockTransfers(tenantId: string, filters?: { status?: string }) {
	return prisma.stockTransfer.findMany({
		where: { tenantId, status: filters?.status || undefined },
		include: { items: true },
		orderBy: { createdAt: 'desc' },
	});
}

export async function upsertStockTransfer(params: {
	id?: string;
	tenantId: string;
	transferNumber?: string;
	fromLocation: string;
	toLocation: string;
	transferDate?: Date | string;
	expectedDeliveryDate?: Date | string;
	actualDeliveryDate?: Date | string | null;
	status?: string;
	priority?: string;
	notes?: string;
	createdBy: string;
	approvedBy?: string;
	approvedAt?: Date | string;
	items: StockTransferItemInput[];
}) {
	const totalItems = params.items.length;
	const totalValue = params.items.reduce((sum, i) => sum + Number(i.quantity) * Number(i.unitCost), 0);
	const data = {
		fromLocation: params.fromLocation,
		toLocation: params.toLocation,
		transferDate: params.transferDate ? new Date(params.transferDate) : undefined,
		expectedDeliveryDate: params.expectedDeliveryDate ? new Date(params.expectedDeliveryDate) : undefined,
		actualDeliveryDate: params.actualDeliveryDate ? new Date(params.actualDeliveryDate) : params.actualDeliveryDate === null ? null : undefined,
		status: params.status,
		priority: params.priority,
		totalItems,
		totalValue,
		notes: params.notes,
		createdBy: params.createdBy,
		approvedBy: params.approvedBy,
		approvedAt: params.approvedAt ? new Date(params.approvedAt) : undefined,
	};

	const itemCreates = params.items.map((i) => ({
		tenantId: params.tenantId,
		itemId: i.itemId,
		itemCode: i.itemCode,
		itemName: i.itemName,
		quantity: Number(i.quantity),
		unitCost: Number(i.unitCost),
		totalValue: Number(i.quantity) * Number(i.unitCost),
		transferredQuantity: Number(i.transferredQuantity || 0),
		notes: i.notes,
	}));

	if (params.id) {
		const existing = await prisma.stockTransfer.findFirst({ where: { id: params.id, tenantId: params.tenantId } });
		if (existing) {
			await prisma.stockTransferItem.deleteMany({ where: { transferId: params.id } });
			return prisma.stockTransfer.update({
				where: { id: params.id },
				data: {
					...data,
					items: { create: itemCreates },
				},
				include: { items: true },
			});
		}
	}

	const count = await prisma.stockTransfer.count({ where: { tenantId: params.tenantId } });
	const transferNumber = params.transferNumber || `ST-${String(count + 1).padStart(4, '0')}`;

	return prisma.stockTransfer.create({
		data: {
			...(params.id ? { id: params.id } : {}),
			tenantId: params.tenantId,
			transferNumber,
			...data,
			status: data.status || 'pending',
			priority: data.priority || 'medium',
			items: { create: itemCreates },
		},
		include: { items: true },
	});
}

export interface StockCountItemInput {
	itemId: string;
	itemCode: string;
	itemName: string;
	expectedQuantity: number;
	countedQuantity: number;
	variance: number;
	unitCost: number;
	varianceValue: number;
	notes?: string;
}

export async function listStockCounts(tenantId: string, filters?: { status?: string; location?: string }) {
	return prisma.stockCount.findMany({
		where: {
			tenantId,
			status: filters?.status || undefined,
			location: filters?.location || undefined,
		},
		include: { items: true },
		orderBy: { createdAt: 'desc' },
	});
}

export async function upsertStockCount(params: {
	id?: string;
	tenantId: string;
	countNumber?: string;
	countType?: string;
	location: string;
	startDate?: Date | string;
	endDate?: Date | string | null;
	status?: string;
	notes?: string;
	createdBy: string;
	performedBy?: string;
	items: StockCountItemInput[];
}) {
	const totalItems = params.items.length;
	const countedItems = params.items.filter((i) => i.countedQuantity >= 0).length;
	const varianceItems = params.items.filter((i) => Number(i.variance) !== 0).length;
	const totalValue = params.items.reduce((sum, i) => sum + Number(i.expectedQuantity) * Number(i.unitCost), 0);
	const varianceValue = params.items.reduce((sum, i) => sum + Math.abs(Number(i.varianceValue)), 0);

	const data = {
		countType: params.countType,
		location: params.location,
		startDate: params.startDate ? new Date(params.startDate) : undefined,
		endDate: params.endDate ? new Date(params.endDate) : params.endDate === null ? null : undefined,
		status: params.status,
		totalItems,
		countedItems,
		varianceItems,
		totalValue,
		varianceValue,
		notes: params.notes,
		createdBy: params.createdBy,
		performedBy: params.performedBy,
	};

	const itemCreates = params.items.map((i) => ({
		tenantId: params.tenantId,
		itemId: i.itemId,
		itemCode: i.itemCode,
		itemName: i.itemName,
		expectedQuantity: Number(i.expectedQuantity),
		countedQuantity: Number(i.countedQuantity),
		variance: Number(i.variance),
		unitCost: Number(i.unitCost),
		varianceValue: Number(i.varianceValue),
		notes: i.notes,
	}));

	if (params.id) {
		const existing = await prisma.stockCount.findFirst({ where: { id: params.id, tenantId: params.tenantId } });
		if (existing) {
			await prisma.stockCountItem.deleteMany({ where: { countId: params.id } });
			return prisma.stockCount.update({
				where: { id: params.id },
				data: {
					...data,
					items: { create: itemCreates },
				},
				include: { items: true },
			});
		}
	}

	const count = await prisma.stockCount.count({ where: { tenantId: params.tenantId } });
	let countNumber = params.countNumber || `CNT-${new Date().getFullYear()}-${String(count + 1).padStart(3, '0')}`;

	// The number the client suggests comes from a per-browser local counter
	// (Settings -> Document Numbering), not a server-side sequence, so two
	// sessions — or a counter that's drifted out of sync with the database —
	// can both land on the same countNumber. Before that reaches the unique
	// constraint and crashes the request, check for a collision and
	// disambiguate; this is stock movement data, so silently losing a count
	// under a 500 is worse than a number that doesn't exactly match Settings' preview.
	const collision = await prisma.stockCount.findFirst({ where: { tenantId: params.tenantId, countNumber } });
	if (collision) {
		countNumber = `${countNumber}-${Date.now().toString().slice(-5)}`;
	}

	return prisma.stockCount.create({
		data: {
			...(params.id ? { id: params.id } : {}),
			tenantId: params.tenantId,
			countNumber,
			...data,
			status: data.status || 'in-progress',
			countType: data.countType || 'full',
			items: { create: itemCreates },
		},
		include: { items: true },
	});
}

export async function deleteStockCount(tenantId: string, id: string): Promise<boolean> {
	const existing = await prisma.stockCount.findFirst({ where: { id, tenantId } });
	if (!existing) return false;
	await prisma.stockCount.delete({ where: { id } });
	return true;
}

export interface GoodsIssueItemInput {
	itemId: string;
	itemCode: string;
	itemName: string;
	quantity: number;
	unitCost: number;
	reason?: string;
}

export async function listGoodsIssues(tenantId: string, filters?: { status?: string; department?: string }) {
	return prisma.goodsIssue.findMany({
		where: {
			tenantId,
			status: filters?.status || undefined,
			department: filters?.department || undefined,
		},
		include: { items: true },
		orderBy: { createdAt: 'desc' },
	});
}

export async function upsertGoodsIssue(params: {
	id?: string;
	tenantId: string;
	issueNumber?: string;
	department: string;
	issuedTo: string;
	issueDate?: Date | string;
	status?: string;
	notes?: string;
	issuedBy: string;
	items: GoodsIssueItemInput[];
}) {
	const totalItems = params.items.length;
	const totalValue = params.items.reduce((sum, i) => sum + Number(i.quantity) * Number(i.unitCost), 0);
	const data = {
		department: params.department,
		issuedTo: params.issuedTo,
		issueDate: params.issueDate ? new Date(params.issueDate) : undefined,
		status: params.status,
		totalItems,
		totalValue,
		notes: params.notes,
		issuedBy: params.issuedBy,
	};
	const itemCreates = params.items.map((i) => ({
		tenantId: params.tenantId,
		itemId: i.itemId,
		itemCode: i.itemCode,
		itemName: i.itemName,
		quantity: Number(i.quantity),
		unitCost: Number(i.unitCost),
		totalValue: Number(i.quantity) * Number(i.unitCost),
		reason: i.reason,
	}));

	if (params.id) {
		const existing = await prisma.goodsIssue.findFirst({ where: { id: params.id, tenantId: params.tenantId } });
		if (existing) {
			await prisma.goodsIssueItem.deleteMany({ where: { issueId: params.id } });
			return prisma.goodsIssue.update({
				where: { id: params.id },
				data: { ...data, items: { create: itemCreates } },
				include: { items: true },
			});
		}
	}

	const count = await prisma.goodsIssue.count({ where: { tenantId: params.tenantId } });
	const issueNumber = params.issueNumber || `ISS-${String(count + 1).padStart(4, '0')}`;

	return prisma.goodsIssue.create({
		data: {
			...(params.id ? { id: params.id } : {}),
			tenantId: params.tenantId,
			issueNumber,
			...data,
			status: data.status || 'issued',
			items: { create: itemCreates },
		},
		include: { items: true },
	});
}

// ---------------------------------------------------------------------------
// Inventory alert acknowledgments — see InventoryAlertAcknowledgment's comment
// in schema.prisma for why only the acknowledgment itself needs a durable row.
// ---------------------------------------------------------------------------

export async function listAlertAcknowledgments(tenantId: string) {
	return prisma.inventoryAlertAcknowledgment.findMany({ where: { tenantId } });
}

export async function upsertAlertAcknowledgment(tenantId: string, alertId: string, acknowledgedBy: string) {
	return prisma.inventoryAlertAcknowledgment.upsert({
		where: { tenantId_alertId: { tenantId, alertId } },
		update: { acknowledgedBy },
		create: { tenantId, alertId, acknowledgedBy },
	});
}


