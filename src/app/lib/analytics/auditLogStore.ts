'use client';

export type AuditArea = 'frontdesk' | 'f&b' | 'kitchen' | 'housekeeping' | 'inventory' | 'security' | 'hr' | 'accounting' | 'settings' | 'system';
export type AuditAction = 'create' | 'update' | 'delete' | 'status' | 'assign' | 'print' | 'export' | 'login' | 'logout' | 'view' | 'other';

export interface AuditRecord {
	 id: string;
	 at: string;
	 user?: string;
	 area: AuditArea;
	 action: AuditAction;
	 entity?: string;
	 entityId?: string;
	 details?: string;
	 severity?: 'low' | 'medium' | 'high' | 'critical';
	 meta?: Record<string, unknown>;
}

class AuditLogStore {
	 private records: AuditRecord[] = [];
	 private listeners: Array<() => void> = [];

	 add(record: Omit<AuditRecord, 'id' | 'at'> & Partial<Pick<AuditRecord, 'at'>>) {
		 const at = record.at || new Date().toISOString();
		 const id = `AUD-${Date.now().toString().slice(-6)}-${Math.floor(Math.random()*100)}`;
		 const full: AuditRecord = { id, at, ...record } as AuditRecord;
		 this.records.unshift(full);
		 this.listeners.forEach(l => l());
	 }

	 all() { return [...this.records]; }

	 byArea(area: AuditArea) { return this.records.filter(r => r.area === area); }

	 subscribe(listener: () => void) {
		 this.listeners.push(listener);
		 return () => { this.listeners = this.listeners.filter(l => l !== listener); };
	 }
}

export const auditLogStore = new AuditLogStore();

export function logAudit(entry: Parameters<AuditLogStore['add']>[0]) {
	 auditLogStore.add(entry);
}

// Add sample data for testing
if (typeof window !== 'undefined') {
	// Add sample accounting activities
	auditLogStore.add({
		area: 'accounting',
		action: 'create',
		entity: 'Chart of Accounts',
		entityId: 'COA-001',
		details: 'Created new account: Cash at Bank - GCB',
		severity: 'medium',
		user: 'admin@hotel.com',
		meta: { category: 'Assets', code: '1001', demo: true }
	});

	auditLogStore.add({
		area: 'accounting',
		action: 'update',
		entity: 'Journal Entry',
		entityId: 'JE-2024-001',
		details: 'Updated journal entry for room revenue posting',
		severity: 'high',
		user: 'accountant@hotel.com',
		meta: { amount: 2500.00, reference: 'ROOM-REV-001', demo: true }
	});

	auditLogStore.add({
		area: 'accounting',
		action: 'create',
		entity: 'Invoice',
		entityId: 'INV-2024-0001',
		details: 'Created sales invoice for corporate booking',
		severity: 'medium',
		user: 'billing@hotel.com',
		meta: { customer: 'ABC Corp', amount: 15000.00, itemCode: 'ROOM-001', demo: true }
	});

	auditLogStore.add({
		area: 'f&b',
		action: 'create',
		entity: 'Order',
		entityId: 'ORD-001',
		details: 'New order created for Table 5',
		severity: 'low',
		user: 'waiter@hotel.com',
		meta: { table: '5', itemCode: 'MAIN-001', category: 'Main Course', alias: 'JOLLOF', demo: true }
	});

	auditLogStore.add({
		area: 'frontdesk',
		action: 'update',
		entity: 'Booking',
		entityId: 'BK-001',
		details: 'Updated room assignment for guest',
		severity: 'medium',
		user: 'receptionist@hotel.com',
		meta: { room: '101', guest: 'John Doe', demo: true }
	});
}


