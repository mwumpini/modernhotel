'use client';

export type KitchenAction = 'assigned' | 'status' | 'prepared';

export interface KitchenOpRecord {
	 id: string;
	 at: string; // ISO timestamp
	 orderId: string;
	 table: string;
	 waiterId?: string;
	 itemId: string;
	 itemName: string;
	 action: KitchenAction;
	 fromStatus?: 'pending' | 'preparing' | 'ready' | 'served';
	 toStatus?: 'pending' | 'preparing' | 'ready' | 'served';
	 assignedToId?: string;
	 assignedToName?: string;
	 preparedById?: string;
	 preparedByName?: string;
	 priority?: 'low' | 'medium' | 'high' | 'urgent';
	 prepMinutes?: number;
	 notes?: string;
}

class KitchenOpsStore {
	 private records: KitchenOpRecord[] = [];
	 private listeners: Array<() => void> = [];

	 add(partial: Omit<KitchenOpRecord, 'id' | 'at'> & Partial<Pick<KitchenOpRecord, 'at'>>) {
		 const at = partial.at || new Date().toISOString();
		 const id = `KLOG-${Date.now().toString().slice(-6)}-${Math.floor(Math.random()*100)}`;
		 const rec: KitchenOpRecord = { id, at, ...partial } as KitchenOpRecord;
		 this.records.unshift(rec);
		 this.listeners.forEach(l => l());
	 }

	 all() { return [...this.records]; }

	 subscribe(listener: () => void) {
		 this.listeners.push(listener);
		 return () => { this.listeners = this.listeners.filter(l => l !== listener); };
	 }
}

export const kitchenOpsStore = new KitchenOpsStore();


