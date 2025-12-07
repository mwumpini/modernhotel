import { prisma } from '../database/client'

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
	return prisma.supplier.create({ data: params });
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
								{ code: { contains: q, mode: 'insensitive' } },
								{ name: { contains: q, mode: 'insensitive' } },
							],
						},
				  ]
				: undefined,
		},
		orderBy: [{ code: 'asc' }],
		take: 200,
	});
}


