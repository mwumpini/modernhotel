'use client';

import { Customer } from './models';

class CustomerStore {
  private customers: Customer[] = [];
  private listeners: Array<() => void> = [];

  constructor() {
    this.initializeSampleData();
  }

  private initializeSampleData() {
    this.customers = [
      {
        id: 'CUST001',
        firstName: 'Kwame',
        lastName: 'Mensah',
        email: 'kwame.mensah@email.com',
        phone: '+233 24 123 4567',
        address: {
          street: '123 High Street',
          city: 'Accra',
          state: 'Greater Accra',
          zipCode: '00233',
          country: 'Ghana'
        },
        loyaltyPoints: 1250,
        totalSpent: 2850.75,
        visitCount: 18,
        lastVisit: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        preferences: {
          dietaryRestrictions: ['vegetarian'],
          favoriteItems: ['M1', 'M3'], // Jollof Rice, Waakye Pack
          allergies: ['nuts']
        },
        isActive: true,
        createdAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        id: 'CUST002',
        firstName: 'Ama',
        lastName: 'Osei',
        email: 'ama.osei@email.com',
        phone: '+233 26 987 6543',
        address: {
          street: '456 Beach Road',
          city: 'Tema',
          state: 'Greater Accra',
          zipCode: '00233',
          country: 'Ghana'
        },
        loyaltyPoints: 890,
        totalSpent: 1567.50,
        visitCount: 12,
        lastVisit: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        preferences: {
          dietaryRestrictions: [],
          favoriteItems: ['M2', 'D1'], // Banku & Tilapia, Club Beer
          allergies: []
        },
        isActive: true,
        createdAt: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        id: 'CUST003',
        firstName: 'Efua',
        lastName: 'Addo',
        email: 'efua.addo@email.com',
        phone: '+233 20 555 1234',
        address: {
          street: '789 University Avenue',
          city: 'Kumasi',
          state: 'Ashanti',
          zipCode: '00233',
          country: 'Ghana'
        },
        loyaltyPoints: 2100,
        totalSpent: 4230.25,
        visitCount: 25,
        lastVisit: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        preferences: {
          dietaryRestrictions: ['vegan'],
          favoriteItems: ['M5', 'D2'], // Garden Salad, Fresh Juice
          allergies: ['dairy', 'gluten']
        },
        isActive: true,
        createdAt: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString()
      }
    ];
  }

  // Customer CRUD operations
  addCustomer(customer: Omit<Customer, 'id' | 'loyaltyPoints' | 'totalSpent' | 'visitCount' | 'createdAt'>): Customer {
    const id = `CUST${String(this.customers.length + 1).padStart(3, '0')}`;
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
    return newCustomer;
  }

  updateCustomer(id: string, updates: Partial<Customer>): Customer | null {
    const index = this.customers.findIndex(c => c.id === id);
    if (index === -1) return null;
    
    this.customers[index] = { ...this.customers[index], ...updates };
    this.notifyListeners();
    return this.customers[index];
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
    return true;
  }

  deductLoyaltyPoints(customerId: string, points: number): boolean {
    const customer = this.getCustomer(customerId);
    if (!customer || customer.loyaltyPoints < points) return false;
    
    customer.loyaltyPoints -= points;
    this.notifyListeners();
    return true;
  }

  getLoyaltyTier(points: number): string {
    if (points >= 5000) return 'Platinum';
    if (points >= 2000) return 'Gold';
    if (points >= 1000) return 'Silver';
    if (points >= 500) return 'Bronze';
    return 'New';
  }

  // Customer activity tracking
  recordVisit(customerId: string, orderAmount: number): boolean {
    const customer = this.getCustomer(customerId);
    if (!customer) return false;
    
    customer.visitCount += 1;
    customer.totalSpent += orderAmount;
    customer.lastVisit = new Date().toISOString();
    
    // Award loyalty points (1 point per 1 cedi spent)
    const pointsEarned = Math.floor(orderAmount);
    customer.loyaltyPoints += pointsEarned;
    
    this.notifyListeners();
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
    
    customer.preferences = { ...customer.preferences, ...preferences };
    this.notifyListeners();
    return true;
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
