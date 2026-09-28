import { prisma } from '@/app/lib/database/client';
import { issueDepartmentStock, recordStockTransaction } from '@/app/lib/inventory/repository';

export type FbStockIssueWarning = {
	itemName: string;
	needed: number;
	onHand: number;
};

export type FbCogsLine = {
	itemId: string;
	itemName: string;
	quantity: number;
	unitCost: number;
	amount: number;
};

export type FbStockIssueResult = {
	warnings: FbStockIssueWarning[];
	cogs: { amount: number; lines: FbCogsLine[] };
};

type IngredientLine = {
	name?: string;
	quantity?: number;
	unit?: string;
	inventoryItemId?: string | null;
};

type IssuedLine = {
	itemId: string;
	itemName: string;
	quantity: number;
	unitCost: number;
};

/**
 * When an F&B order is billed:
 * - Bar / 1:1 menu links → issue from Restaurant
 * - Kitchen recipes linked to the menu dish → issue BOM ingredients from Kitchen
 * Idempotent per order + item + location via issueDepartmentStock reference keys.
 * Returns COGS amount (qty × item defaultCost) for client GL capture.
 */
export async function issueStockForFbOrder(params: {
	tenantId: string;
	orderId: string;
	orderNumber: string;
	performedBy?: string;
}): Promise<FbStockIssueResult> {
	const empty: FbStockIssueResult = { warnings: [], cogs: { amount: 0, lines: [] } };
	const order = await prisma.fBOrder.findFirst({
		where: { id: params.orderId, tenantId: params.tenantId },
		include: { items: true },
	});
	if (!order) return empty;

	const menuIds = [
		...new Set(order.items.map((line) => line.menuItemId).filter((id): id is string => Boolean(id))),
	];
	if (menuIds.length === 0) return empty;

	const warnings: FbStockIssueWarning[] = [];
	const issued: IssuedLine[] = [];

	// ── Restaurant 1:1 (bar bottles / retail) ───────────────────────────────
	const linkedMenus = await prisma.fBMenuItem.findMany({
		where: {
			tenantId: params.tenantId,
			id: { in: menuIds },
			inventoryItemId: { not: null },
		},
		select: { id: true, inventoryItemId: true, stockLocationId: true, name: true },
	});

	const byMenu = new Map(linkedMenus.map((m) => [m.id, m]));
	const restaurantBuckets = new Map<string, { locationId?: string; items: Map<string, number> }>();

	for (const line of order.items) {
		if (!line.menuItemId) continue;
		const menu = byMenu.get(line.menuItemId);
		if (!menu?.inventoryItemId) continue;
		const locKey = menu.stockLocationId || '';
		let bucket = restaurantBuckets.get(locKey);
		if (!bucket) {
			bucket = { locationId: menu.stockLocationId || undefined, items: new Map() };
			restaurantBuckets.set(locKey, bucket);
		}
		const prev = bucket.items.get(menu.inventoryItemId) || 0;
		bucket.items.set(menu.inventoryItemId, prev + Number(line.quantity || 0));
	}

	for (const bucket of restaurantBuckets.values()) {
		const items = [...bucket.items.entries()].map(([itemId, quantity]) => ({ itemId, quantity }));
		if (items.length === 0) continue;
		const result = await runIssue({
			tenantId: params.tenantId,
			department: 'restaurant',
			locationId: bucket.locationId,
			items,
			orderId: params.orderId,
			orderNumber: params.orderNumber,
			performedBy: params.performedBy,
			notes: `F&B sale ${params.orderNumber}`,
		});
		warnings.push(...result.warnings);
		issued.push(...result.issued);
	}

	// ── Kitchen recipe BOM ──────────────────────────────────────────────────
	const recipes = await prisma.recipe.findMany({
		where: {
			tenantId: params.tenantId,
			menuItemId: { in: menuIds },
		},
		select: { menuItemId: true, ingredients: true, name: true },
	});

	const recipesByMenu = new Map<string, typeof recipes>();
	for (const recipe of recipes) {
		if (!recipe.menuItemId) continue;
		const list = recipesByMenu.get(recipe.menuItemId) || [];
		list.push(recipe);
		recipesByMenu.set(recipe.menuItemId, list);
	}

	const kitchenItems = new Map<string, number>();
	for (const line of order.items) {
		if (!line.menuItemId) continue;
		const linked = recipesByMenu.get(line.menuItemId);
		if (!linked?.length) continue;
		const soldQty = Number(line.quantity || 0);
		if (soldQty <= 0) continue;
		for (const recipe of linked) {
			const ingredients = (Array.isArray(recipe.ingredients) ? recipe.ingredients : []) as IngredientLine[];
			for (const ing of ingredients) {
				if (!ing.inventoryItemId) continue;
				const perPortion = Number(ing.quantity || 0);
				if (perPortion <= 0) continue;
				const need = perPortion * soldQty;
				kitchenItems.set(ing.inventoryItemId, (kitchenItems.get(ing.inventoryItemId) || 0) + need);
			}
		}
	}

	if (kitchenItems.size > 0) {
		const result = await runIssue({
			tenantId: params.tenantId,
			department: 'kitchen',
			items: [...kitchenItems.entries()].map(([itemId, quantity]) => ({ itemId, quantity })),
			orderId: params.orderId,
			orderNumber: params.orderNumber,
			performedBy: params.performedBy,
			notes: `Kitchen BOM ${params.orderNumber}`,
		});
		warnings.push(...result.warnings);
		issued.push(...result.issued);
	}

	const cogsLines: FbCogsLine[] = issued.map((line) => ({
		...line,
		amount: +(line.quantity * line.unitCost).toFixed(2),
	}));
	const cogsAmount = +cogsLines.reduce((sum, line) => sum + line.amount, 0).toFixed(2);

	return {
		warnings,
		cogs: { amount: cogsAmount, lines: cogsLines },
	};
}

/**
 * Restock items issued for an F&B order (refund). Idempotent via fb_order_refund refs.
 */
export async function reverseStockForFbOrder(params: {
	tenantId: string;
	orderId: string;
	orderNumber: string;
	performedBy?: string;
}): Promise<{ restored: number }> {
	const issues = await prisma.inventoryTransaction.findMany({
		where: {
			tenantId: params.tenantId,
			referenceType: 'fb_order',
			referenceId: params.orderId,
			type: 'issue',
		},
	});
	let restored = 0;
	for (const tx of issues) {
		if (!tx.locationId || !tx.itemId) continue;
		const qty = Math.abs(Number(tx.quantity || 0));
		if (qty <= 0) continue;
		const already = await prisma.inventoryTransaction.findFirst({
			where: {
				tenantId: params.tenantId,
				itemId: tx.itemId,
				locationId: tx.locationId,
				type: 'receipt',
				referenceType: 'fb_order_refund',
				referenceId: params.orderId,
			},
		});
		if (already) continue;
		await recordStockTransaction({
			tenantId: params.tenantId,
			itemId: tx.itemId,
			locationId: tx.locationId,
			type: 'receipt',
			quantity: qty,
			referenceType: 'fb_order_refund',
			referenceId: params.orderId,
			notes: `Refund restock ${params.orderNumber}`,
			performedBy: params.performedBy,
		});
		restored += 1;
	}
	return { restored };
}

async function runIssue(params: {
	tenantId: string;
	department: string;
	locationId?: string;
	items: { itemId: string; quantity: number }[];
	orderId: string;
	orderNumber: string;
	performedBy?: string;
	notes: string;
}): Promise<{ warnings: FbStockIssueWarning[]; issued: IssuedLine[] }> {
	const warnings: FbStockIssueWarning[] = [];
	const issued: IssuedLine[] = [];
	const result = await issueDepartmentStock({
		tenantId: params.tenantId,
		department: params.department,
		locationId: params.locationId,
		items: params.items,
		referenceType: 'fb_order',
		referenceId: params.orderId,
		performedBy: params.performedBy,
		notes: params.notes,
		mode: 'best_effort',
	});

	if (result.error === 'unknown_department' || result.error === 'no_location') {
		warnings.push({ itemName: `(${params.department} location)`, needed: 0, onHand: 0 });
		return { warnings, issued };
	}
	if (result.error === 'insufficient') {
		warnings.push({
			itemName: result.itemName || 'item',
			needed: 0,
			onHand: Number(result.onHand || 0),
		});
		return { warnings, issued };
	}
	for (const w of result.warnings || []) {
		warnings.push({
			itemName: w.itemName,
			needed: w.needed,
			onHand: w.onHand,
		});
	}
	for (const line of result.issued || []) {
		issued.push(line);
	}
	return { warnings, issued };
}
