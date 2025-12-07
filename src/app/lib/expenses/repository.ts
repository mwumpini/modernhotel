import { prisma } from '../database/client'

export async function listOverdueVouchers(tenantId: string, minDaysOverdue: number = 30) {
	console.log('[ap][listOverdueVouchers] start', { tenantId, minDaysOverdue });
	const cutoff = new Date(Date.now() - minDaysOverdue * 24 * 60 * 60 * 1000);

	const vouchers = await prisma.expenseVoucher.findMany({
		where: {
			tenantId,
			date: { lte: cutoff },
			NOT: { status: { in: ['paid', 'void'] } }
		},
		include: {
			supplier: true,
			property: true,
			currency: true
		},
		orderBy: [{ date: 'asc' }],
		take: 1000
	});

	return vouchers.map(v => ({
		id: v.id,
		date: v.date,
		reference: v.reference,
		status: v.status,
		totalAmount: v.totalAmount,
		currencyCode: v.currency.code,
		supplierName: v.supplier?.name || v.payeeName || '-',
		propertyName: v.property?.name || null,
		daysOverdue: Math.floor((Date.now() - v.date.getTime()) / (1000 * 60 * 60 * 24))
	}));
}


