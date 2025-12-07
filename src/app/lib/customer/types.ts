export type UnifiedCustomer =
	| { id: string; type: 'guest'; name: string; email: string | null; phone: string | null; serialNumber?: string }
	| { id: string; type: 'company'; name: string; email: string | null; phone: string | null; code?: string; taxNumber?: string | null };


