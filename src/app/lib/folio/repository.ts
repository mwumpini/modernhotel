import { prisma } from '../database/client'

export async function openFolio(params: {
	tenantId: string;
	propertyId: string;
	guestId?: string;
	companyId?: string;
	currencyId: string;
	type: string;
	remarks?: string;
}) {
	console.log('[folio][openFolio]', params);
	return prisma.folio.create({
		data: {
			...params,
			status: 'open',
		},
	});
}

export async function addFolioLine(params: {
	tenantId: string;
	folioId: string;
	description: string;
	quantity: any;
	unitPrice: any;
	amount: any;
	isCredit?: boolean;
	source?: string;
	reference?: string;
	taxId?: string;
	taxAmount?: any;
	accountId?: string;
	postingDate?: Date;
}) {
	console.log('[folio][addFolioLine]', { tenantId: params.tenantId, folioId: params.folioId, description: params.description, amount: params.amount });
	return prisma.folioLine.create({ data: params });
}

export async function recordPayment(params: {
	tenantId: string;
	folioId?: string;
	amount: any;
	currencyId: string;
	methodId: string;
	reference?: string;
	externalId?: string;
	status?: string;
	receivedAt?: Date;
}) {
	console.log('[folio][recordPayment]', { tenantId: params.tenantId, folioId: params.folioId, amount: params.amount, methodId: params.methodId });
	return prisma.payment.create({ data: params });
}

export async function closeFolio(tenantId: string, folioId: string) {
	console.log('[folio][closeFolio]', { tenantId, folioId });
	return prisma.folio.update({
		where: { id: folioId },
		data: { status: 'closed', closedAt: new Date() },
	});
}


