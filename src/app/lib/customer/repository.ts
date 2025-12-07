import { prisma } from '../database/client'
import { UnifiedCustomer } from './types'

export async function searchCustomers(params: {
	tenantId: string;
	q?: string;
	type?: 'guest' | 'company' | 'all';
	take?: number;
	dedupe?: boolean;
}): Promise<UnifiedCustomer[]> {
	const { tenantId, q, type = 'all', take = 200, dedupe = true } = params

	const guestWhere: any = {
		tenantId,
		...(q
			? {
					OR: [
						{ name: { contains: q, mode: 'insensitive' } },
						{ email: { contains: q, mode: 'insensitive' } },
						{ phone: { contains: q, mode: 'insensitive' } },
						{ serialNumber: { contains: q, mode: 'insensitive' } },
					],
			  }
			: {}),
	}

	const companyWhere: any = {
		tenantId,
		...(q
			? {
					OR: [
						{ name: { contains: q, mode: 'insensitive' } },
						{ code: { contains: q, mode: 'insensitive' } },
						{ email: { contains: q, mode: 'insensitive' } },
						{ phone: { contains: q, mode: 'insensitive' } },
						{ taxNumber: { contains: q, mode: 'insensitive' } },
					],
			  }
			: {}),
	}

	const fetchGuests = type !== 'company'
		? prisma.guest.findMany({
				where: guestWhere,
				orderBy: { name: 'asc' },
				take,
		  })
		: Promise.resolve([])

	const fetchCompanies = type !== 'guest'
		? prisma.company.findMany({
				where: companyWhere,
				orderBy: { name: 'asc' },
				take,
		  })
		: Promise.resolve([])

	const [guests, companies] = await Promise.all([fetchGuests, fetchCompanies])

	let unified: UnifiedCustomer[] = [
		...guests.map((g) => ({
			id: g.id,
			type: 'guest' as const,
			name: g.name,
			email: g.email ?? null,
			phone: g.phone ?? null,
			serialNumber: g.serialNumber,
		})),
		...companies.map((c) => ({
			id: c.id,
			type: 'company' as const,
			name: c.name,
			email: c.email ?? null,
			phone: c.phone ?? null,
			code: c.code,
			taxNumber: c.taxNumber ?? null,
		})),
	]

	// Optional de-duplication across Guests and Companies
	if (dedupe) {
		const seen = new Map<string, UnifiedCustomer>();

		const normalizePhone = (p?: string | null) =>
			(p || '')
				.replace(/[\s\-\(\)\+]/g, '')
				.replace(/^0+/, '');

		const keyOf = (c: UnifiedCustomer) => {
			const email = (c.email || '').trim().toLowerCase();
			const phone = normalizePhone(c.phone);
			// Strong keys first
			if (email) return `email:${email}`;
			if (phone) return `phone:${phone}`;
			// Fallback to domain keys
			if (c.type === 'company' && c.code) return `company:${c.code.toLowerCase()}`;
			if (c.type === 'guest' && c.serialNumber) return `guest:${c.serialNumber.toLowerCase()}`;
			// Last resort: name
			return `name:${(c.name || '').trim().toLowerCase()}`;
		};

		for (const c of unified) {
			const k = keyOf(c);
			const existing = seen.get(k);
			if (!existing) {
				seen.set(k, c);
				continue;
			}
			// Prefer company records over guest when keys collide
			if (existing.type === 'guest' && c.type === 'company') {
				seen.set(k, c);
			}
		}

		unified = Array.from(seen.values());
	}

	return unified.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
}


