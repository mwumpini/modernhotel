'use client';

import { loadRecords, saveRecord } from '../api/tenantRecords';

export type AuditArea = 'frontdesk' | 'f&b' | 'kitchen' | 'housekeeping' | 'inventory' | 'security' | 'hr' | 'accounting' | 'settings' | 'system';
export type AuditAction = 'create' | 'update' | 'delete' | 'status' | 'assign' | 'print' | 'export' | 'login' | 'logout' | 'view' | 'void' | 'refund' | 'other';

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

const MAX_RECORDS = 300;

class AuditLogStore {
	 private records: AuditRecord[] = [];
	 private listeners: Array<() => void> = [];
	 private hydrateStarted = false;
	 private loaded = false;

	 // Kept on the server so a refresh (or another computer in the hotel) still sees them.
	 private hydrate() {
		 if (this.hydrateStarted || typeof window === 'undefined') return;
		 this.hydrateStarted = true;
		 void loadRecords<AuditRecord>('desk.activity').then((server) => {
			 if (server) {
				 const demos = this.records.filter((r) => r.meta?.demo);
				 const byId = new Map(server.filter((r) => !r.meta?.demo).map((r) => [r.id, r]));
				 for (const r of this.records) if (!r.meta?.demo) byId.set(r.id, r);
				 const saved = Array.from(byId.values()).sort((a, b) => b.at.localeCompare(a.at)).slice(0, MAX_RECORDS);
				 this.records = [...saved, ...demos];
			 }
			 this.loaded = true;
			 this.listeners.forEach((l) => l());
		 });
	 }

	 add(record: Omit<AuditRecord, 'id' | 'at'> & Partial<Pick<AuditRecord, 'at'>>) {
		 this.hydrate();
		 const at = record.at || new Date().toISOString();
		 const id = `AUD-${Date.now().toString().slice(-6)}-${Math.floor(Math.random()*100)}`;
		 const full: AuditRecord = { id, at, ...record } as AuditRecord;
		 this.records.unshift(full);
		 if (this.records.length > MAX_RECORDS) this.records.length = MAX_RECORDS;
		 if (!full.meta?.demo) void saveRecord('desk.activity', full.id, full);
		 this.listeners.forEach(l => l());
	 }

	 all() {
		 this.hydrate();
		 return [...this.records];
	 }

	 byArea(area: AuditArea) {
		 this.hydrate();
		 return this.records.filter(r => r.area === area);
	 }

	 subscribe(listener: () => void) {
		 this.hydrate();
		 this.listeners.push(listener);
		 if (this.loaded) listener();
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


