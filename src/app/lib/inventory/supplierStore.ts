import { create } from 'zustand';
import { Supplier, PurchaseOrder, PurchaseOrderItem } from './models';

interface SupplierStore {
  suppliers: Supplier[];
  purchaseOrders: PurchaseOrder[];
  selectedSupplier: Supplier | null;
  selectedPurchaseOrder: PurchaseOrder | null;
  
  // Supplier Management
  addSupplier: (supplier: Omit<Supplier, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateSupplier: (id: string, updates: Partial<Supplier>) => void;
  deleteSupplier: (id: string) => void;
  getSupplier: (id: string) => Supplier | undefined;
  getSupplierByCode: (code: string) => Supplier | undefined;
  getSuppliersByCategory: (category: string) => Supplier[];
  getActiveSuppliers: () => Supplier[];
  
  // Purchase Order Management
  createPurchaseOrder: (order: Omit<PurchaseOrder, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updatePurchaseOrder: (id: string, updates: Partial<PurchaseOrder>) => void;
  deletePurchaseOrder: (id: string) => void;
  getPurchaseOrder: (id: string) => PurchaseOrder | undefined;
  getPurchaseOrdersBySupplier: (supplierId: string) => PurchaseOrder[];
  getPurchaseOrdersByStatus: (status: PurchaseOrder['status']) => PurchaseOrder[];
  getPurchaseOrdersByDateRange: (startDate: Date, endDate: Date) => PurchaseOrder[];
  
  // Purchase Order Items Management
  addPurchaseOrderItem: (orderId: string, item: Omit<PurchaseOrderItem, 'id'>) => void;
  updatePurchaseOrderItem: (orderId: string, itemId: string, updates: Partial<PurchaseOrderItem>) => void;
  removePurchaseOrderItem: (orderId: string, itemId: string) => void;
  
  // Purchase Order Workflow
  sendPurchaseOrder: (orderId: string) => void;
  confirmPurchaseOrder: (orderId: string, supplierId: string) => void;
  markInTransit: (orderId: string) => void;
  markDelivered: (orderId: string, actualDeliveryDate: Date) => void;
  cancelPurchaseOrder: (orderId: string, reason: string) => void;
  closePurchaseOrder: (orderId: string) => void;
  
  // Selection
  selectSupplier: (supplier: Supplier | null) => void;
  selectPurchaseOrder: (order: PurchaseOrder | null) => void;
  
  // Analytics
  getSupplierPerformance: (supplierId: string) => {
    totalOrders: number;
    totalValue: number;
    onTimeDelivery: number;
    averageRating: number;
    averageResponseTime: number;
  };
  getTopSuppliers: (limit: number) => Array<{
    supplier: Supplier;
    totalOrders: number;
    totalValue: number;
    performance: number;
  }>;
  getPurchaseOrderAnalytics: (period: 'daily' | 'weekly' | 'monthly') => {
    totalOrders: number;
    totalValue: number;
    averageOrderValue: number;
    ordersByStatus: Record<string, number>;
    ordersByPriority: Record<string, number>;
  };
  getSupplierSpendAnalysis: () => Record<string, {
    supplierName: string;
    totalSpend: number;
    orderCount: number;
    averageOrderValue: number;
    percentageOfTotal: number;
  }>;
}

// Sample data
const sampleSuppliers: Supplier[] = [
  {
    id: 'supplier1',
    code: 'FF001',
    name: 'Fresh Farms Ltd',
    contactPerson: 'John Farmer',
    email: 'john@freshfarms.com',
    phone: '+233 20 123 4567',
    address: '123 Farm Road',
    city: 'Accra',
    country: 'Ghana',
    postalCode: '00233',
    taxId: 'GH123456789',
    paymentTerms: 'net30',
    creditLimit: 50000,
    currentBalance: 15000,
    rating: 4.5,
    categories: ['food', 'vegetables', 'fruits'],
    isActive: true,
    contractStartDate: new Date('2023-01-01'),
    performance: {
      onTimeDelivery: 95,
      qualityRating: 4.5,
      responseTime: 2,
      totalOrders: 45
    },
    createdAt: new Date('2023-01-01'),
    updatedAt: new Date()
  },
  {
    id: 'supplier2',
    code: 'CT001',
    name: 'Coffee Traders Co',
    contactPerson: 'Sarah Coffee',
    email: 'sarah@coffeetraders.com',
    phone: '+233 24 987 6543',
    address: '456 Coffee Street',
    city: 'Kumasi',
    country: 'Ghana',
    postalCode: '00233',
    taxId: 'GH987654321',
    paymentTerms: 'net60',
    creditLimit: 30000,
    currentBalance: 8000,
    rating: 4.8,
    categories: ['beverage', 'coffee', 'tea'],
    isActive: true,
    contractStartDate: new Date('2023-03-15'),
    performance: {
      onTimeDelivery: 98,
      qualityRating: 4.8,
      responseTime: 1,
      totalOrders: 32
    },
    createdAt: new Date('2023-03-15'),
    updatedAt: new Date()
  },
  {
    id: 'supplier3',
    code: 'CP001',
    name: 'CleanPro Supplies',
    contactPerson: 'Mike Clean',
    email: 'mike@cleanpro.com',
    phone: '+233 26 555 1234',
    address: '789 Clean Avenue',
    city: 'Tema',
    country: 'Ghana',
    postalCode: '00233',
    taxId: 'GH555123456',
    paymentTerms: 'net30',
    creditLimit: 25000,
    currentBalance: 5000,
    rating: 4.2,
    categories: ['cleaning', 'chemicals', 'equipment'],
    isActive: true,
    contractStartDate: new Date('2023-02-01'),
    performance: {
      onTimeDelivery: 90,
      qualityRating: 4.2,
      responseTime: 3,
      totalOrders: 28
    },
    createdAt: new Date('2023-02-01'),
    updatedAt: new Date()
  },
  {
    id: 'supplier4',
    code: 'LC001',
    name: 'LinenCo',
    contactPerson: 'Lisa Linen',
    email: 'lisa@linenco.com',
    phone: '+233 27 777 8888',
    address: '321 Linen Lane',
    city: 'Accra',
    country: 'Ghana',
    postalCode: '00233',
    taxId: 'GH777888999',
    paymentTerms: 'net30',
    creditLimit: 40000,
    currentBalance: 12000,
    rating: 4.6,
    categories: ['linens', 'towels', 'bedding'],
    isActive: true,
    contractStartDate: new Date('2023-01-15'),
    performance: {
      onTimeDelivery: 92,
      qualityRating: 4.6,
      responseTime: 2,
      totalOrders: 38
    },
    createdAt: new Date('2023-01-15'),
    updatedAt: new Date()
  },
  {
    id: 'supplier5',
    code: 'HS001',
    name: 'HVAC Supplies',
    contactPerson: 'Tom HVAC',
    email: 'tom@hvacsupplies.com',
    phone: '+233 23 444 5678',
    address: '654 HVAC Road',
    city: 'Accra',
    country: 'Ghana',
    postalCode: '00233',
    taxId: 'GH444567890',
    paymentTerms: 'net30',
    creditLimit: 35000,
    currentBalance: 9000,
    rating: 4.4,
    categories: ['maintenance', 'hvac', 'electrical'],
    isActive: true,
    contractStartDate: new Date('2023-04-01'),
    performance: {
      onTimeDelivery: 88,
      qualityRating: 4.4,
      responseTime: 4,
      totalOrders: 22
    },
    createdAt: new Date('2023-04-01'),
    updatedAt: new Date()
  }
];

const samplePurchaseOrders: PurchaseOrder[] = [
  {
    id: '1',
    poNumber: 'PO-2024-001',
    supplierId: 'supplier1',
    supplierName: 'Fresh Farms Ltd',
    orderDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
    expectedDeliveryDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days from now
    status: 'confirmed',
    priority: 'high',
    totalAmount: 1500,
    taxAmount: 150,
    shippingAmount: 50,
    discountAmount: 100,
    finalAmount: 1600,
    currency: 'GHS',
    paymentTerms: 'net30',
    notes: 'Fresh vegetables for weekend menu',
    createdBy: 'John Smith',
    approvedBy: 'Manager',
    approvedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000), // 4 days ago
    items: [
      {
        id: '1',
        itemId: 'item1',
        itemCode: 'F001',
        itemName: 'Fresh Tomatoes',
        quantity: 60,
        unitCost: 2.50,
        totalCost: 150,
        receivedQuantity: 0
      },
      {
        id: '2',
        itemId: 'item2',
        itemCode: 'F002',
        itemName: 'Fresh Onions',
        quantity: 40,
        unitCost: 1.50,
        totalCost: 60,
        receivedQuantity: 0
      }
    ],
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
    updatedAt: new Date()
  },
  {
    id: '2',
    poNumber: 'PO-2024-002',
    supplierId: 'supplier2',
    supplierName: 'Coffee Traders Co',
    orderDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
    expectedDeliveryDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000), // 1 day from now
    status: 'in-transit',
    priority: 'medium',
    totalAmount: 2250,
    taxAmount: 225,
    shippingAmount: 75,
    discountAmount: 150,
    finalAmount: 2400,
    currency: 'GHS',
    paymentTerms: 'net60',
    notes: 'Premium coffee beans for bar',
    createdBy: 'John Smith',
    approvedBy: 'Manager',
    approvedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
    items: [
      {
        id: '3',
        itemId: 'item3',
        itemCode: 'B001',
        itemName: 'Premium Coffee Beans',
        quantity: 15,
        unitCost: 15.00,
        totalCost: 225,
        receivedQuantity: 0
      }
    ],
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
    updatedAt: new Date()
  }
];

export const useSupplierStore = create<SupplierStore>((set, get) => ({
  suppliers: sampleSuppliers,
  purchaseOrders: samplePurchaseOrders,
  selectedSupplier: null,
  selectedPurchaseOrder: null,

  // Supplier Management
  addSupplier: (supplierData) => {
    const newSupplier: Supplier = {
      ...supplierData,
      id: Date.now().toString(),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    set(state => ({ suppliers: [...state.suppliers, newSupplier] }));
  },

  updateSupplier: (id, updates) => {
    set(state => ({
      suppliers: state.suppliers.map(supplier => 
        supplier.id === id 
          ? { ...supplier, ...updates, updatedAt: new Date() }
          : supplier
      )
    }));
  },

  deleteSupplier: (id) => {
    set(state => ({ suppliers: state.suppliers.filter(supplier => supplier.id !== id) }));
  },

  getSupplier: (id) => get().suppliers.find(supplier => supplier.id === id),

  getSupplierByCode: (code) => get().suppliers.find(supplier => supplier.code === code),

  getSuppliersByCategory: (category) => get().suppliers.filter(supplier => 
    supplier.categories.includes(category)
  ),

  getActiveSuppliers: () => get().suppliers.filter(supplier => supplier.isActive),

  // Purchase Order Management
  createPurchaseOrder: (orderData) => {
    const newOrder: PurchaseOrder = {
      ...orderData,
      id: Date.now().toString(),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    set(state => ({ purchaseOrders: [...state.purchaseOrders, newOrder] }));
  },

  updatePurchaseOrder: (id, updates) => {
    set(state => ({
      purchaseOrders: state.purchaseOrders.map(order => 
        order.id === id 
          ? { ...order, ...updates, updatedAt: new Date() }
          : order
      )
    }));
  },

  deletePurchaseOrder: (id) => {
    set(state => ({ purchaseOrders: state.purchaseOrders.filter(order => order.id !== id) }));
  },

  getPurchaseOrder: (id) => get().purchaseOrders.find(order => order.id === id),

  getPurchaseOrdersBySupplier: (supplierId) => get().purchaseOrders.filter(order => 
    order.supplierId === supplierId
  ),

  getPurchaseOrdersByStatus: (status) => get().purchaseOrders.filter(order => 
    order.status === status
  ),

  getPurchaseOrdersByDateRange: (startDate, endDate) => get().purchaseOrders.filter(order => 
    order.orderDate >= startDate && order.orderDate <= endDate
  ),

  // Purchase Order Items Management
  addPurchaseOrderItem: (orderId, itemData) => {
    const newItem: PurchaseOrderItem = {
      ...itemData,
      id: Date.now().toString()
    };
    
    set(state => ({
      purchaseOrders: state.purchaseOrders.map(order => 
        order.id === orderId 
          ? { ...order, items: [...order.items, newItem] }
          : order
      )
    }));
  },

  updatePurchaseOrderItem: (orderId, itemId, updates) => {
    set(state => ({
      purchaseOrders: state.purchaseOrders.map(order => 
        order.id === orderId 
          ? {
              ...order,
              items: order.items.map(item => 
                item.id === itemId 
                  ? { ...item, ...updates }
                  : item
              )
            }
          : order
      )
    }));
  },

  removePurchaseOrderItem: (orderId, itemId) => {
    set(state => ({
      purchaseOrders: state.purchaseOrders.map(order => 
        order.id === orderId 
          ? {
              ...order,
              items: order.items.filter(item => item.id !== itemId)
            }
          : order
      )
    }));
  },

  // Purchase Order Workflow
  sendPurchaseOrder: (orderId) => {
    get().updatePurchaseOrder(orderId, { status: 'sent' });
  },

  confirmPurchaseOrder: (orderId, supplierId) => {
    get().updatePurchaseOrder(orderId, { 
      status: 'confirmed',
      supplierId
    });
  },

  markInTransit: (orderId) => {
    get().updatePurchaseOrder(orderId, { status: 'in-transit' });
  },

  markDelivered: (orderId, actualDeliveryDate) => {
    get().updatePurchaseOrder(orderId, { 
      status: 'delivered',
      actualDeliveryDate
    });
  },

  cancelPurchaseOrder: (orderId, reason) => {
    get().updatePurchaseOrder(orderId, { 
      status: 'cancelled',
      notes: reason
    });
  },

  closePurchaseOrder: (orderId) => {
    get().updatePurchaseOrder(orderId, { status: 'closed' });
  },

  // Selection
  selectSupplier: (supplier) => set({ selectedSupplier: supplier }),

  selectPurchaseOrder: (order) => set({ selectedPurchaseOrder: order }),

  // Analytics
  getSupplierPerformance: (supplierId) => {
    const supplier = get().getSupplier(supplierId);
    if (!supplier) return {
      totalOrders: 0,
      totalValue: 0,
      onTimeDelivery: 0,
      averageRating: 0,
      averageResponseTime: 0
    };

    const orders = get().getPurchaseOrdersBySupplier(supplierId);
    const totalOrders = orders.length;
    const totalValue = orders.reduce((sum, order) => sum + order.finalAmount, 0);

    return {
      totalOrders,
      totalValue,
      onTimeDelivery: supplier.performance.onTimeDelivery,
      averageRating: supplier.performance.qualityRating,
      averageResponseTime: supplier.performance.responseTime
    };
  },

  getTopSuppliers: (limit) => {
    const suppliers = get().getActiveSuppliers();
    
    return suppliers
      .map(supplier => {
        const performance = get().getSupplierPerformance(supplier.id);
        const performanceScore = (performance.onTimeDelivery * 0.4) + 
                               (performance.averageRating * 0.4) + 
                               ((10 - performance.averageResponseTime) * 0.2);
        
        return {
          supplier,
          totalOrders: performance.totalOrders,
          totalValue: performance.totalValue,
          performance: performanceScore
        };
      })
      .sort((a, b) => b.performance - a.performance)
      .slice(0, limit);
  },

  getPurchaseOrderAnalytics: (period) => {
    const now = new Date();
    let startDate: Date;
    
    switch (period) {
      case 'daily':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'weekly':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'monthly':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
    }
    
    const orders = get().purchaseOrders.filter(order => order.orderDate >= startDate);
    const totalOrders = orders.length;
    const totalValue = orders.reduce((sum, order) => sum + order.finalAmount, 0);
    const averageOrderValue = totalOrders > 0 ? totalValue / totalOrders : 0;
    
    const ordersByStatus: Record<string, number> = {};
    const ordersByPriority: Record<string, number> = {};
    
    orders.forEach(order => {
      ordersByStatus[order.status] = (ordersByStatus[order.status] || 0) + 1;
      ordersByPriority[order.priority] = (ordersByPriority[order.priority] || 0) + 1;
    });
    
    return {
      totalOrders,
      totalValue,
      averageOrderValue,
      ordersByStatus,
      ordersByPriority
    };
  },

  getSupplierSpendAnalysis: () => {
    const suppliers = get().getActiveSuppliers();
    const totalSpend = suppliers.reduce((sum, supplier) => 
      sum + get().getSupplierPerformance(supplier.id).totalValue, 0
    );
    
    const analysis: Record<string, {
      supplierName: string;
      totalSpend: number;
      orderCount: number;
      averageOrderValue: number;
      percentageOfTotal: number;
    }> = {};
    
    suppliers.forEach(supplier => {
      const performance = get().getSupplierPerformance(supplier.id);
      const percentageOfTotal = totalSpend > 0 ? (performance.totalValue / totalSpend) * 100 : 0;
      
      analysis[supplier.id] = {
        supplierName: supplier.name,
        totalSpend: performance.totalValue,
        orderCount: performance.totalOrders,
        averageOrderValue: performance.totalOrders > 0 ? performance.totalValue / performance.totalOrders : 0,
        percentageOfTotal
      };
    });
    
    return analysis;
  }
}));
