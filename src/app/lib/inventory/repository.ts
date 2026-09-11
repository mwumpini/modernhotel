import { prisma } from '../database/client'
import { resolveTaxConfigs } from '../tax/resolveConfigs'
import { computeStackedTaxLines } from '../accounting/taxFromConfig'

/**
 * Resident Withholding Tax on a purchase — reads the same real, user-editable
 * compliance rules (domain: 'purchases', appliesTo: SERVICE/GOODS/WORKS/RENT)
 * the client-side WHT helper (accounting/purchaseWht.ts) reads via
 * useComplianceStore, but that store only exists client-side — this is the
 * server-safe equivalent used when persisting a purchase order, so the
 * server (not the client) is the source of truth for what actually gets
 * charged. Never a hardcoded rate.
 */
function resolvePurchaseWithholding(subtotal: number, category?: string | null, customRate?: number): { rate: number; amount: number } {
	if (!(subtotal > 0)) return { rate: 0, amount: 0 }
	if (category === 'custom') {
		const rate = Number(customRate) || 0
		return { rate, amount: Math.round(subtotal * (rate / 100) * 100) / 100 }
	}
	if (!category) return { rate: 0, amount: 0 }
	try {
		// Dynamic import avoids bundling fs into client chunks when tree-shaken.
		const { ComplianceDB } = require('../compliance/db') as typeof import('../compliance/db')
		const rules = ComplianceDB.getTaxes('GH') as Array<Record<string, any>>
		const rule = rules
			.filter((r) => r.domain === 'purchases' && r.enabled !== false && Array.isArray(r.appliesTo) && r.appliesTo.includes(category))
			.sort((a, b) => (a.priority ?? 100) - (b.priority ?? 100))[0]
		if (!rule) return { rate: 0, amount: 0 }
		const rate = Number(rule.rate) || 0
		return { rate, amount: Math.round(subtotal * (rate / 100) * 100) / 100 }
	} catch {
		return { rate: 0, amount: 0 }
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
	// SERVICE | GOODS | WORKS | RENT — which resident-WHT category (if any) applies to
	// this purchase; undefined/null means no withholding. Never a client-supplied rate:
	// the server looks up the real, currently-configured rate for the category itself.
	withholdingCategory?: string | null;
	// Only meaningful when withholdingCategory is the literal 'custom' — a manual
	// override rate for a one-off scenario the compliance rule set doesn't cover yet.
	customWithholdingRate?: number;
	items: PurchaseOrderItemInput[];
}) {
	const totalAmount = params.items.reduce((sum, i) => sum + i.quantity * i.unitCost, 0);
	// Real configured VAT rate (Settings → Tax Rate Builder), not a hardcoded 15% — a
	// purchase order only attracts input VAT (recoverable); NHIL/GETFund/Tourism are
	// output-only levies and don't apply on purchases (see resolveTaxConfigs/
	// mapPrismaTaxRowToConfig's applyOnPurchases flag).
	const taxConfigs = resolveTaxConfigs()
	const { totalTax: taxAmount } = computeStackedTaxLines(totalAmount, taxConfigs, 'purchase')
	// Resident WHT is a separate, independent mechanism from input VAT above: it's
	// deducted from what's paid to the supplier (and remitted to GRA on their behalf),
	// not added on top — a purchase order can have VAT, WHT, both, or neither.
	const { amount: withholdingAmount } = resolvePurchaseWithholding(totalAmount, params.withholdingCategory, params.customWithholdingRate)
	const shippingAmount = params.shippingAmount ?? 0;
	const discountAmount = params.discountAmount ?? 0;
	const finalAmount = totalAmount + taxAmount + shippingAmount - discountAmount - withholdingAmount;

	const data = {
		supplierId: params.supplierId,
		supplierName: params.supplierName,
		expectedDeliveryDate: params.expectedDeliveryDate ? new Date(params.expectedDeliveryDate) : undefined,
		actualDeliveryDate: params.actualDeliveryDate ? new Date(params.actualDeliveryDate) : undefined,
		status: params.status,
		priority: params.priority,
		totalAmount,
		taxAmount,
		withholdingCategory: params.withholdingCategory || null,
		withholdingAmount,
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
	notes?: string;
}

export async function listRequisitions(tenantId: string, filters?: { status?: string }) {
	return prisma.requisition.findMany({
		where: { tenantId, status: filters?.status || undefined },
		include: { items: true },
		orderBy: { createdAt: 'desc' },
	});
}

export async function upsertRequisition(params: {
	id?: string;
	tenantId: string;
	requisitionNumber?: string;
	requestedBy: string;
	requestedDate?: Date | string;
	status?: string;
	approvedBy?: string;
	approvedAt?: Date | string;
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
		approvedBy: params.approvedBy,
		approvedAt: params.approvedAt ? new Date(params.approvedAt) : undefined,
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
			return prisma.requisition.update({
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
							notes: i.notes,
						})),
					},
				},
				include: { items: true },
			});
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
							poItemId: i.poItemId,
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
					poItemId: i.poItemId,
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


