'use client';

import { Supplier } from './models';

class SupplierStore {
  private suppliers: Supplier[] = [];
  private listeners: Array<() => void> = [];

  constructor() {
    this.initializeSampleData();
  }

  private initializeSampleData() {
    this.suppliers = [
      {
        id: 'SUP001',
        name: 'Fresh Harvest Farms',
        contactPerson: 'Kwame Addo',
        email: 'orders@freshharvestgh.com',
        phone: '+233 30 123 4567',
        address: {
          street: '45 Farm Road',
          city: 'Kumasi',
          state: 'Ashanti',
          zipCode: '00233',
          country: 'Ghana'
        },
        products: ['produce', 'herbs', 'vegetables'],
        paymentTerms: 'Net 30',
        rating: 4.8,
        isActive: true,
        notes: 'Organic certified, local supplier, excellent quality'
      },
      {
        id: 'SUP002',
        name: 'Premium Meats Ghana',
        contactPerson: 'Ama Osei',
        email: 'sales@premiummeatsgh.com',
        phone: '+233 24 987 6543',
        address: {
          street: '78 Industrial Avenue',
          city: 'Tema',
          state: 'Greater Accra',
          zipCode: '00233',
          country: 'Ghana'
        },
        products: ['meat', 'poultry', 'fish'],
        paymentTerms: 'Net 15',
        rating: 4.5,
        isActive: true,
        notes: 'HACCP certified, reliable delivery, competitive pricing'
      },
      {
        id: 'SUP003',
        name: 'Ghana Grain Co.',
        contactPerson: 'Efua Mensah',
        email: 'info@ghanagrain.com',
        phone: '+233 20 555 7890',
        address: {
          street: '123 Warehouse Street',
          city: 'Accra',
          state: 'Greater Accra',
          zipCode: '00233',
          country: 'Ghana'
        },
        products: ['grains', 'rice', 'flour', 'pantry'],
        paymentTerms: 'Net 45',
        rating: 4.2,
        isActive: true,
        notes: 'Bulk quantities available, good for large orders'
      },
      {
        id: 'SUP004',
        name: 'Beverage Solutions Ltd',
        contactPerson: 'Kofi Asante',
        email: 'orders@beveragesolutionsgh.com',
        phone: '+233 26 111 2222',
        address: {
          street: '56 Beverage Lane',
          city: 'Accra',
          state: 'Greater Accra',
          zipCode: '00233',
          country: 'Ghana'
        },
        products: ['beverages', 'juices', 'soft drinks', 'alcohol'],
        paymentTerms: 'Net 30',
        rating: 4.6,
        isActive: true,
        notes: 'Wide selection, good for bar supplies'
      },
      {
        id: 'SUP005',
        name: 'Spice & Seasoning Co.',
        contactPerson: 'Yaa Owusu',
        email: 'sales@spiceseasoninggh.com',
        phone: '+233 27 333 4444',
        address: {
          street: '89 Spice Street',
          city: 'Kumasi',
          state: 'Ashanti',
          zipCode: '00233',
          country: 'Ghana'
        },
        products: ['spices', 'seasonings', 'herbs', 'condiments'],
        paymentTerms: 'Net 30',
        rating: 4.7,
        isActive: true,
        notes: 'Authentic local spices, traditional recipes'
      }
    ];
  }

  // Supplier CRUD operations
  addSupplier(supplier: Omit<Supplier, 'id'>): Supplier {
    const id = `SUP${String(this.suppliers.length + 1).padStart(3, '0')}`;
    const newSupplier = { ...supplier, id };
    this.suppliers.push(newSupplier);
    this.notifyListeners();
    return newSupplier;
  }

  updateSupplier(id: string, updates: Partial<Supplier>): Supplier | null {
    const index = this.suppliers.findIndex(s => s.id === id);
    if (index === -1) return null;
    
    this.suppliers[index] = { ...this.suppliers[index], ...updates };
    this.notifyListeners();
    return this.suppliers[index];
  }

  getSupplier(id: string): Supplier | undefined {
    return this.suppliers.find(s => s.id === id);
  }

  getAllSuppliers(): Supplier[] {
    return [...this.suppliers];
  }

  getActiveSuppliers(): Supplier[] {
    return this.suppliers.filter(s => s.isActive);
  }

  // Supplier search and filtering
  searchSuppliers(query: string): Supplier[] {
    const q = query.toLowerCase();
    return this.suppliers.filter(s => 
      s.name.toLowerCase().includes(q) ||
      s.contactPerson.toLowerCase().includes(q) ||
      s.email.toLowerCase().includes(q) ||
      s.products.some(p => p.toLowerCase().includes(q))
    );
  }

  getSuppliersByProduct(product: string): Supplier[] {
    return this.suppliers.filter(s => 
      s.products.some(p => p.toLowerCase().includes(product.toLowerCase()))
    );
  }

  getSuppliersByRating(minRating: number): Supplier[] {
    return this.suppliers.filter(s => s.rating >= minRating);
  }

  getTopRatedSuppliers(limit: number = 5): Supplier[] {
    return [...this.suppliers]
      .sort((a, b) => b.rating - a.rating)
      .slice(0, limit);
  }

  // Supplier performance and analytics
  getAverageSupplierRating(): number {
    if (this.suppliers.length === 0) return 0;
    const totalRating = this.suppliers.reduce((sum, s) => sum + s.rating, 0);
    return totalRating / this.suppliers.length;
  }

  getSupplierCountByProductCategory(): Record<string, number> {
    const categoryCount: Record<string, number> = {};
    
    this.suppliers.forEach(supplier => {
      supplier.products.forEach(product => {
        categoryCount[product] = (categoryCount[product] || 0) + 1;
      });
    });
    
    return categoryCount;
  }

  getSuppliersByPaymentTerms(terms: string): Supplier[] {
    return this.suppliers.filter(s => s.paymentTerms === terms);
  }

  // Supplier relationship management
  updateSupplierRating(supplierId: string, newRating: number): boolean {
    const supplier = this.getSupplier(supplierId);
    if (!supplier || newRating < 1 || newRating > 5) return false;
    
    supplier.rating = newRating;
    this.notifyListeners();
    return true;
  }

  addProductToSupplier(supplierId: string, product: string): boolean {
    const supplier = this.getSupplier(supplierId);
    if (!supplier) return false;
    
    if (!supplier.products.includes(product)) {
      supplier.products.push(product);
      this.notifyListeners();
    }
    return true;
  }

  removeProductFromSupplier(supplierId: string, product: string): boolean {
    const supplier = this.getSupplier(supplierId);
    if (!supplier) return false;
    
    const index = supplier.products.indexOf(product);
    if (index > -1) {
      supplier.products.splice(index, 1);
      this.notifyListeners();
      return true;
    }
    return false;
  }

  // Supplier contact management
  getSupplierContactInfo(supplierId: string): Pick<Supplier, 'name' | 'contactPerson' | 'email' | 'phone'> | undefined {
    const supplier = this.getSupplier(supplierId);
    if (!supplier) return undefined;
    
    return {
      name: supplier.name,
      contactPerson: supplier.contactPerson,
      email: supplier.email,
      phone: supplier.phone
    };
  }

  updateSupplierContact(supplierId: string, contact: Partial<Pick<Supplier, 'contactPerson' | 'email' | 'phone'>>): boolean {
    const supplier = this.getSupplier(supplierId);
    if (!supplier) return false;
    
    Object.assign(supplier, contact);
    this.notifyListeners();
    return true;
  }

  // Supplier address management
  getSupplierAddress(supplierId: string): Supplier['address'] | undefined {
    const supplier = this.getSupplier(supplierId);
    return supplier?.address;
  }

  updateSupplierAddress(supplierId: string, address: Partial<Supplier['address']>): boolean {
    const supplier = this.getSupplier(supplierId);
    if (!supplier) return false;
    
    supplier.address = { ...supplier.address, ...address };
    this.notifyListeners();
    return true;
  }

  // Supplier analytics and reporting
  getSupplierPerformanceMetrics(): {
    totalSuppliers: number;
    activeSuppliers: number;
    averageRating: number;
    topProductCategory: string;
    supplierDistribution: Record<string, number>;
  } {
    const totalSuppliers = this.suppliers.length;
    const activeSuppliers = this.suppliers.filter(s => s.isActive).length;
    const averageRating = this.getAverageSupplierRating();
    
    const categoryCount = this.getSupplierCountByProductCategory();
    const topProductCategory = Object.entries(categoryCount)
      .sort(([,a], [,b]) => b - a)[0]?.[0] || 'N/A';
    
    const supplierDistribution = {
      '5 Star': this.suppliers.filter(s => s.rating >= 4.5).length,
      '4 Star': this.suppliers.filter(s => s.rating >= 3.5 && s.rating < 4.5).length,
      '3 Star': this.suppliers.filter(s => s.rating >= 2.5 && s.rating < 3.5).length,
      'Below 3': this.suppliers.filter(s => s.rating < 2.5).length
    };

    return {
      totalSuppliers,
      activeSuppliers,
      averageRating,
      topProductCategory,
      supplierDistribution
    };
  }

  // Export and reporting
  exportSupplierData(): string {
    const headers = ['ID', 'Name', 'Contact Person', 'Email', 'Phone', 'Products', 'Payment Terms', 'Rating', 'Status'];
    const rows = this.suppliers.map(s => [
      s.id,
      s.name,
      s.contactPerson,
      s.email,
      s.phone,
      s.products.join('; '),
      s.paymentTerms,
      s.rating.toString(),
      s.isActive ? 'Active' : 'Inactive'
    ]);
    
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    return csv;
  }

  // Supplier recommendations
  getRecommendedSuppliers(productCategory: string, minRating: number = 4.0): Supplier[] {
    return this.suppliers
      .filter(s => 
        s.isActive && 
        s.rating >= minRating &&
        s.products.some(p => p.toLowerCase().includes(productCategory.toLowerCase()))
      )
      .sort((a, b) => b.rating - a.rating);
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

export const supplierStore = new SupplierStore();
