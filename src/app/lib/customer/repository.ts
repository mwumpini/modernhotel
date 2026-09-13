import { prisma } from '../database/client'
import { UnifiedCustomer } from './types'

const SUPPORTS_INSENSITIVE_MODE = (prisma as any)._activeProvider !== 'sqlite'
function ci(value: string) {
	return SUPPORTS_INSENSITIVE_MODE ? { contains: value, mode: 'insensitive' as const } : { contains: value }
}

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
						{ name: ci(q) },
						{ email: ci(q) },
						{ phone: ci(q) },
						{ serialNumber: ci(q) },
					],
			  }
			: {}),
	}

	const companyWhere: any = {
		tenantId,
		...(q
			? {
					OR: [
						{ name: ci(q) },
						{ code: ci(q) },
						{ email: ci(q) },
						{ phone: ci(q) },
						{ taxNumber: ci(q) },
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
		...guests.map((g: any) => ({
			id: g.id,
			type: 'guest' as const,
			name: g.name,
			email: g.email ?? null,
			phone: g.phone ?? null,
			serialNumber: g.serialNumber,
		})),
		...companies.map((c: any) => ({
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


