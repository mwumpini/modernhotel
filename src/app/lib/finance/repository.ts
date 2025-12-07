import { prisma } from '../database/client'

export async function upsertCurrency(params: {
	tenantId: string;
	code: string;
	name: string;
	symbol?: string;
	decimalPlaces?: number;
	isBase?: boolean;
}) {
	console.log('[finance][upsertCurrency]', params);
	const { tenantId, code, ...rest } = params;
	return prisma.currency.upsert({
		where: { tenantId_code: { tenantId, code } },
		update: { ...rest },
		create: { tenantId, code, ...rest },
	});
}

export async function setExchangeRate(params: {
	tenantId: string;
	fromCurrencyId: string;
	toCurrencyId: string;
	rate: any;
	validFrom: Date;
}) {
	console.log('[finance][setExchangeRate]', params);
	return prisma.exchangeRate.create({ data: params });
}

export async function upsertAccount(params: {
	tenantId: string;
	code: string;
	name: string;
	type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
	parentId?: string;
	isActive?: boolean;
}) {
	console.log('[finance][upsertAccount]', params);
	const { tenantId, code, ...rest } = params;
	return prisma.account.upsert({
		where: { tenantId_code: { tenantId, code } },
		update: { ...rest },
		create: { tenantId, code, ...rest },
	});
}

export async function upsertTax(params: {
	tenantId: string;
	code: string;
	name: string;
	rate: any;
	type: string;
	isInclusive?: boolean;
	isActive?: boolean;
}) {
	console.log('[finance][upsertTax]', params);
	const { tenantId, code, ...rest } = params;
	return prisma.tax.upsert({
		where: { tenantId_code: { tenantId, code } },
		update: { ...rest },
		create: { tenantId, code, ...rest },
	});
}

export async function upsertPaymentMethod(params: {
	tenantId: string;
	code: string;
	name: string;
	type: string;
	isActive?: boolean;
}) {
	console.log('[finance][upsertPaymentMethod]', params);
	const { tenantId, code, ...rest } = params;
	return prisma.paymentMethod.upsert({
		where: { tenantId_code: { tenantId, code } },
		update: { ...rest },
		create: { tenantId, code, ...rest },
	});
}


