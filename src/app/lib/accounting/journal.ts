'use client';

export interface JournalEntry {
  id: string;
  date: string;
  memo: string;
  lines: Array<{ account: string; debit?: number; credit?: number; ref?: string }>;
}

class JournalStore {
  private entries: JournalEntry[] = [];
  private listeners: Array<() => void> = [];

  post(memo: string, lines: JournalEntry['lines']) {
    const je: JournalEntry = { id: `JE-${Date.now().toString().slice(-6)}`, date: new Date().toISOString(), memo, lines };
    this.entries.unshift(je);
    this.listeners.forEach(l => l());
    return je;
  }

  list() { return [...this.entries]; }
  subscribe(l: () => void) { this.listeners.push(l); return () => { this.listeners = this.listeners.filter(x => x !== l); }; }
}

export const journalStore = new JournalStore();

// Helpers
export function postRoomRevenue(reservationId: string, amount: number, tax: number) {
  const gross = amount + tax;
  return journalStore.post(`Room revenue for ${reservationId}`, [
    { account: 'Accounts Receivable', debit: gross, ref: reservationId },
    { account: 'Room Revenue', credit: amount, ref: reservationId },
    ...(tax ? [{ account: 'Tax Payable', credit: tax, ref: reservationId }] : []),
  ]);
}

export function postPayment(reservationId: string, method: 'Cash'|'Card'|'Mobile Money', amount: number) {
  const account = method === 'Cash' ? 'Cash' : method === 'Card' ? 'Card Clearing' : 'Mobile Money';
  return journalStore.post(`Payment ${method} for ${reservationId}`, [
    { account, debit: amount, ref: reservationId },
    { account: 'Accounts Receivable', credit: amount, ref: reservationId },
  ]);
}


