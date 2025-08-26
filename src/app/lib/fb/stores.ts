'use client';

import { trackEvent } from '../analytics/trackEvent';

export interface IssueRecord {
  id: string;
  sku: string;
  name: string;
  qty: number;
  uom: string;
  department: 'Kitchen' | 'Bar' | 'Housekeeping' | 'Security' | 'Frontdesk' | 'Other';
  referenceId?: string; // e.g., order id
  createdAt: string;
}

class StoresIssueBus {
  private issues: IssueRecord[] = [];
  private listeners: Array<() => void> = [];

  issue(item: Omit<IssueRecord, 'id' | 'createdAt'>) {
    const rec: IssueRecord = { ...item, id: `${Date.now()}-${Math.random().toString(36).slice(2,8)}`, createdAt: new Date().toISOString() };
    this.issues.unshift(rec);
    this.listeners.forEach(l=>l());
    trackEvent('Stores.Issued', { sku: rec.sku, qty: rec.qty, dept: rec.department, ref: rec.referenceId });
    trackEvent('Accounting.COGSBooked', { sku: rec.sku, qty: rec.qty, dept: rec.department, ref: rec.referenceId });
    return rec;
  }

  list() { return [...this.issues]; }

  subscribe(l: () => void) {
    this.listeners.push(l);
    return () => { this.listeners = this.listeners.filter(x => x !== l); };
  }
}

export const storesIssueBus = new StoresIssueBus();


