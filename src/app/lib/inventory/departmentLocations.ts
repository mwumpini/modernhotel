/** Shared department stock locations — safe for client + server. */
export const DEPARTMENT_LOCATIONS: Record<string, { code: string; name: string }> = {
	restaurant: { code: 'RESTAURANT', name: 'Restaurant & Bar' },
	kitchen: { code: 'KITCHEN', name: 'Kitchen' },
	housekeeping: { code: 'HOUSEKEEPING', name: 'Housekeeping' },
};
