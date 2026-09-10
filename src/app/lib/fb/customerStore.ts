'use client';

import { Customer } from './models';
import { fbTenantHeaders } from './api';

class CustomerStore {
  private customers: Customer[] = [];
  private listeners: Array<() => void> = [];

  // Customer CRUD operations
  addCustomer(customer: Omit<Customer, 'id' | 'loyaltyPoints' | 'totalSpent' | 'visitCount' | 'createdAt'>): Customer {
    const id = `tmp_${Date.now()}`;
    const newCustomer: Customer = {
      ...customer,
      id,
      loyaltyPoints: 0,
      totalSpent: 0,
      visitCount: 0,
      createdAt: new Date().toISOString()
    };

    this.customers.push(newCustomer);
    this.notifyListeners();

    if (typeof window !== 'undefined') {
      fetch('/api/fb/customers', {
        method: 'POST',
        headers: fbTenantHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ id, ...customer }),
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (!data?.customer) return;
          // Reconcile the temp id with the server's real id.
          this.customers = this.customers.map((c) => (c.id === id ? data.customer : c));
          this.notifyListeners();
        })
        .catch((e) => console.warn('[FB] Failed to sync new customer:', e));
    }

    return newCustomer;
  }

  updateCustomer(id: string, updates: Partial<Customer>): Customer | null {
    const index = this.customers.findIndex(c => c.id === id);
    if (index === -1) return null;

    this.customers[index] = { ...this.customers[index], ...updates };
    this.notifyListeners();
    this.syncCustomer(this.customers[index]);
    return this.customers[index];
  }

  /** Replace in-memory customers with the real, Prisma-persisted list from
   *  /api/fb/customers. Without this, this store only ever showed whatever
   *  had been added in the current browser tab since the last reload. */
  async hydrateFromApi(): Promise<void> {
    if (typeof window === 'undefined') return;
    try {
      const res = await fetch('/api/fb/customers', { headers: fbTenantHeaders(), cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      this.customers = data.customers || [];
      this.notifyListeners();
    } catch (e) {
      console.warn('[FB] customerStore hydrateFromApi failed:', e);
    }
  }

  getCustomer(id: string): Customer | undefined {
    return this.customers.find(c => c.id === id);
  }

  getAllCustomers(): Customer[] {
    return [...this.customers];
  }

  getActiveCustomers(): Customer[] {
    return this.customers.filter(c => c.isActive);
  }

  // Customer search and filtering
  searchCustomers(query: string): Customer[] {
    const q = query.toLowerCase();
    return this.customers.filter(c => 
      c.firstName.toLowerCase().includes(q) ||
      c.lastName.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q) ||
      c.phone?.includes(q)
    );
  }

  getCustomersByLoyaltyTier(minPoints: number): Customer[] {
    return this.customers.filter(c => c.loyaltyPoints >= minPoints);
  }

  getTopSpendingCustomers(limit: number = 10): Customer[] {
    return [...this.customers]
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, limit);
  }

  getFrequentVisitors(limit: number = 10): Customer[] {
    return [...this.customers]
      .sort((a, b) => b.visitCount - a.visitCount)
      .slice(0, limit);
  }

  // Loyalty program management
  addLoyaltyPoints(customerId: string, points: number): boolean {
    const customer = this.getCustomer(customerId);
    if (!customer) return false;

    customer.loyaltyPoints += points;
    this.notifyListeners();
    this.syncCustomer(customer);
    return true;
  }

  deductLoyaltyPoints(customerId: string, points: number): boolean {
    const customer = this.getCustomer(customerId);
    if (!customer || customer.loyaltyPoints < points) return false;

    customer.loyaltyPoints -= points;
    this.notifyListeners();
    this.syncCustomer(customer);
    return true;
  }

  getLoyaltyTier(points: number): string {
    if (points >= 5000) return 'Platinum';
    if (points >= 2000) return 'Gold';
    if (points >= 1000) return 'Silver';
    if (points >= 500) return 'Bronze';
    return 'New';
  }

  // Customer activity tracking — the visit/spend/points tally is incremented
  // atomically server-side (see recordFBCustomerVisit) rather than a client
  // read-modify-write, so two concurrent orders for the same customer can't
  // clobber each other's tally.
  recordVisit(customerId: string, orderAmount: number): boolean {
    const customer = this.getCustomer(customerId);
    if (!customer) return false;

    customer.visitCount += 1;
    customer.totalSpent += orderAmount;
    customer.lastVisit = new Date().toISOString();
    customer.loyaltyPoints += Math.floor(orderAmount);
    this.notifyListeners();

    if (typeof window !== 'undefined' && !customerId.startsWith('tmp_')) {
      fetch('/api/fb/customers', {
        method: 'PATCH',
        headers: fbTenantHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ id: customerId, orderAmount }),
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (!data?.customer) return;
          this.customers = this.customers.map((c) => (c.id === customerId ? data.customer : c));
          this.notifyListeners();
        })
        .catch((e) => console.warn('[FB] Failed to sync customer visit:', e));
    }
    return true;
  }

  // Customer preferences and analytics
  getCustomerPreferences(customerId: string): Customer['preferences'] | undefined {
    const customer = this.getCustomer(customerId);
    return customer?.preferences;
  }

  updateCustomerPreferences(customerId: string, preferences: Partial<Customer['preferences']>): boolean {
    const customer = this.getCustomer(customerId);
    if (!customer) return false;

    customer.preferences = { ...customer.preferences, ...preferences } as Customer['preferences'];
    this.notifyListeners();
    this.syncCustomer(customer);
    return true;
  }

  private syncCustomer(customer: Customer) {
    if (typeof window === 'undefined' || customer.id.startsWith('tmp_')) return;
    fetch('/api/fb/customers', {
      method: 'POST',
      headers: fbTenantHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(customer),
    }).catch((e) => console.warn('[FB] Failed to sync customer:', e));
  }

  getCustomersByDietaryRestriction(restriction: string): Customer[] {
    return this.customers.filter(c => 
      c.preferences?.dietaryRestrictions?.includes(restriction)
    );
  }

  getCustomersByAllergy(allergy: string): Customer[] {
    return this.customers.filter(c => 
      c.preferences?.allergies?.includes(allergy)
    );
  }

  // Customer analytics
  getCustomerRetentionRate(): number {
    const totalCustomers = this.customers.length;
    const activeCustomers = this.customers.filter(c => c.isActive).length;
    return totalCustomers > 0 ? (activeCustomers / totalCustomers) * 100 : 0;
  }

  getAverageCustomerLifetimeValue(): number {
    if (this.customers.length === 0) return 0;
    const totalValue = this.customers.reduce((sum, c) => sum + c.totalSpent, 0);
    return totalValue / this.customers.length;
  }

  getCustomerGrowthRate(days: number = 30): number {
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const recentCustomers = this.customers.filter(c => 
      new Date(c.createdAt) >= cutoffDate
    ).length;
    
    return recentCustomers;
  }

  // Export and reporting
  exportCustomerData(): string {
    const headers = ['ID', 'First Name', 'Last Name', 'Email', 'Phone', 'Loyalty Points', 'Total Spent', 'Visit Count', 'Last Visit', 'Status'];
    const rows = this.customers.map(c => [
      c.id,
      c.firstName,
      c.lastName,
      c.email || '',
      c.phone || '',
      c.loyaltyPoints,
      c.totalSpent.toFixed(2),
      c.visitCount,
      c.lastVisit ? new Date(c.lastVisit).toLocaleDateString() : '',
      c.isActive ? 'Active' : 'Inactive'
    ]);
    
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    return csv;
  }

  // Subscription management
  subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener());
  }
}

export const customerStore = new CustomerStore();
