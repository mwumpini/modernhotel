import { prisma } from '../database/client'
import { resolveTaxConfigs } from '../tax/resolveConfigs'
import { computeStackedTaxLines } from '../accounting/taxFromConfig'

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
	items: PurchaseOrderItemInput[];
}) {
	const totalAmount = params.items.reduce((sum, i) => sum + i.quantity * i.unitCost, 0);
	// Real configured VAT rate (Settings → Tax Rate Builder), not a hardcoded 15% — a
	// purchase order only attracts input VAT (recoverable); NHIL/GETFund/Tourism are
	// output-only levies and don't apply on purchases (see resolveTaxConfigs/
	// mapPrismaTaxRowToConfig's applyOnPurchases flag).
	const taxConfigs = resolveTaxConfigs()
	const { totalTax: taxAmount } = computeStackedTaxLines(totalAmount, taxConfigs, 'purchase')
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
}) {
	const item = await prisma.inventoryItem.findFirst({ where: { id: params.itemId, tenantId: params.tenantId } });
	if (!item) throw new Error('Item not found for this tenant');
	const referenceId = `transfer_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

	return prisma.$transaction(async (tx) => {
		await tx.inventoryTransaction.create({
			data: {
				tenantId: params.tenantId,
				itemId: params.itemId,
				locationId: params.fromLocationId,
				type: 'transfer_out',
				quantity: -Math.abs(params.quantity),
				referenceType: 'transfer',
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
				referenceType: 'transfer',
				referenceId,
				notes: params.notes,
				performedBy: params.performedBy,
			},
		});
		// Net zero on quantityOnHand (same item, in and out) — the transfer only moves
		// stock between locations, so no adjustment to the item's flat quantity is needed
		// unless there's no location dimension in use, in which case this is a no-op pair.
		return { referenceId };
	});
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


