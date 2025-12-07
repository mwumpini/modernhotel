import { prisma } from '../database/client'

type CustomerType = 'guest' | 'company';

export interface CustomerBalance {
	customerType: CustomerType;
	customerId: string;
	name: string;
	balance: number;
	folioCount: number;
}

export interface FolioWithBalance {
	id: string;
	type: string;
	status: string;
	propertyId: string;
	guestId?: string | null;
	companyId?: string | null;
	currencyId: string;
	openedAt: Date;
	closedAt?: Date | null;
	balance: number;
	totalCharges: number;
	totalCredits: number;
	totalPayments: number;
}

function toNumber(n: any): number {
	if (n === null || n === undefined) return 0;
	const x = typeof n === 'string' ? parseFloat(n) : Number(n);
	return Number.isFinite(x) ? x : 0;
}

export async function computeFolioBalance(folioId: string): Promise<{
	totalCharges: number;
	totalCredits: number;
	totalPayments: number;
	balance: number;
}> {
	const [lines, payments] = await Promise.all([
		prisma.folioLine.findMany({
			where: { folioId },
			select: { amount: true, isCredit: true },
		}),
		prisma.payment.findMany({
			where: { folioId },
			select: { amount: true },
		}),
	]);

	let totalCharges = 0;
	let totalCredits = 0;
	for (const ln of lines) {
		const amt = toNumber(ln.amount);
		if (ln.isCredit) totalCredits += amt;
		else totalCharges += amt;
	}

	const totalPayments = payments.reduce((s, p) => s + toNumber(p.amount), 0);
	const balance = totalCharges - (totalCredits + totalPayments);
	return { totalCharges, totalCredits, totalPayments, balance };
}

export async function listFoliosWithBalancesByCustomer(tenantId: string, customerType: CustomerType, customerId: string): Promise<FolioWithBalance[]> {
	const where = {
		tenantId,
		[customerType === 'guest' ? 'guestId' : 'companyId']: customerId,
	} as any;

	const folios = await prisma.folio.findMany({
		where,
		orderBy: [{ openedAt: 'desc' }],
		take: 500,
	});

	const withBalances: FolioWithBalance[] = [];
	for (const f of folios) {
		const b = await computeFolioBalance(f.id);
		withBalances.push({
			id: f.id,
			type: f.type,
			status: f.status,
			propertyId: f.propertyId,
			guestId: f.guestId,
			companyId: f.companyId,
			currencyId: f.currencyId,
			openedAt: f.openedAt,
			closedAt: f.closedAt,
			balance: b.balance,
			totalCharges: b.totalCharges,
			totalCredits: b.totalCredits,
			totalPayments: b.totalPayments,
		});
	}
	return withBalances;
}

export async function listCustomerBalances(tenantId: string, type: 'all' | CustomerType = 'all'): Promise<CustomerBalance[]> {
	// Pull recent folios to aggregate balances; increase limit as needed
	const folios = await prisma.folio.findMany({
		where: { tenantId },
		select: {
			id: true,
			guestId: true,
			companyId: true,
			type: true,
		},
		orderBy: [{ openedAt: 'desc' }],
		take: 1000,
	});

	const guestIds = new Set<string>();
	const companyIds = new Set<string>();
	for (const f of folios) {
		if (f.guestId) guestIds.add(f.guestId);
		if (f.companyId) companyIds.add(f.companyId);
	}

	const [guests, companies] = await Promise.all([
		type !== 'company' && guestIds.size > 0
			? prisma.guest.findMany({ where: { tenantId, id: { in: Array.from(guestIds) } }, select: { id: true, name: true } })
			: Promise.resolve([]),
		type !== 'guest' && companyIds.size > 0
			? prisma.company.findMany({ where: { tenantId, id: { in: Array.from(companyIds) } }, select: { id: true, name: true } })
			: Promise.resolve([]),
	]) as [Array<{ id: string; name: string }>, Array<{ id: string; name: string }>];

	const guestMap = new Map(guests.map(g => [g.id, g.name]));
	const companyMap = new Map(companies.map(c => [c.id, c.name]));

	const balances = new Map<string, CustomerBalance>();

	for (const f of folios) {
		const isGuest = !!f.guestId;
		const isCompany = !!f.companyId;
		if (!isGuest && !isCompany) continue;
		const customerType: CustomerType = isGuest ? 'guest' : 'company';
		if (type !== 'all' && type !== customerType) continue;
		const customerId = isGuest ? (f.guestId as string) : (f.companyId as string);

		const key = `${customerType}:${customerId}`;
		if (!balances.has(key)) {
			balances.set(key, {
				customerType,
				customerId,
				name: isGuest ? (guestMap.get(customerId) || 'Guest') : (companyMap.get(customerId) || 'Company'),
				balance: 0,
				folioCount: 0,
			});
		}

		const b = await computeFolioBalance(f.id);
		const entry = balances.get(key)!;
		entry.balance += b.balance;
		entry.folioCount += 1;
	}

	// Sort by highest balance descending
	return Array.from(balances.values()).sort((a, b) => b.balance - a.balance);
}

export async function getAgingBuckets(tenantId: string, asOf: Date = new Date(), buckets: number[] = [0, 30, 60, 90, 120]) {
	// Build buckets like: 0-30, 31-60, 61-90, 91-120, >120
	const folios = await prisma.folio.findMany({
		where: { tenantId },
		select: { id: true, openedAt: true },
		orderBy: [{ openedAt: 'desc' }],
		take: 1000,
	});

	const segments = buckets.map((start, idx) => ({
		label: idx === buckets.length - 1 ? `>${start}` : `${start}-${buckets[idx + 1]}`,
		start,
		end: buckets[idx + 1] ?? Infinity,
		total: 0,
		count: 0,
	}));

	for (const f of folios) {
		const b = await computeFolioBalance(f.id);
		if (b.balance <= 0) continue;
		const days = Math.floor((asOf.getTime() - f.openedAt.getTime()) / (1000 * 60 * 60 * 24));
		for (const seg of segments) {
			const inRange = seg.end === Infinity ? days > seg.start : days >= seg.start && days < seg.end;
			if (inRange) {
				seg.total += b.balance;
				seg.count += 1;
				break;
			}
		}
	}

	return segments;
}

export async function listOverdueFolios(tenantId: string, minDaysOverdue: number = 30) {
	const cutoff = new Date(Date.now() - minDaysOverdue * 24 * 60 * 60 * 1000);
	const folios = await prisma.folio.findMany({
		where: {
			tenantId,
			status: 'open',
			openedAt: { lte: cutoff }
		},
		select: {
			id: true,
			type: true,
			status: true,
			propertyId: true,
			guestId: true,
			companyId: true,
			currencyId: true,
			openedAt: true,
			closedAt: true,
			tenantId: true
		},
		orderBy: [{ openedAt: 'asc' }],
		take: 1000
	});

	const results = [];
	for (const f of folios) {
		const bal = await computeFolioBalance(f.id);
		if (bal.balance > 0) {
			results.push({
				...f,
				balance: bal.balance,
				totalCharges: bal.totalCharges,
				totalCredits: bal.totalCredits,
				totalPayments: bal.totalPayments,
				daysOpen: Math.floor((Date.now() - f.openedAt.getTime()) / (1000 * 60 * 60 * 24)),
			});
		}
	}
	return results;
}


