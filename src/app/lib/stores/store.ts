'use client';

import { 
  InventoryItem, 
  Supplier, 
  PurchaseOrder, 
  PurchaseOrderItem,
  StockMovement,
  StockCount,
  StockCountItem,
  InventoryCategory,
  CostCenter,
  InventoryAlert,
  StockStatus,
  PurchaseOrderStatus,
  StockMovementType
} from './types';
import { trackEvent } from '../analytics/trackEvent';

class StoresStore {
  private items: Map<string, InventoryItem> = new Map();
  private suppliers: Map<string, Supplier> = new Map();
  private purchaseOrders: PurchaseOrder[] = [];
  private stockMovements: StockMovement[] = [];
  private stockCounts: StockCount[] = [];
  private categories: InventoryCategory[] = [];
  private costCenters: CostCenter[] = [];
  private alerts: InventoryAlert[] = [];
  private listeners: Array<() => void> = [];

  constructor() {
    // Clean slate - no demo data initialization
    // this.initializeDemoData();
  }

  private initializeDemoData() {
    // Initialize categories
    this.categories = [
      { id: 'cat1', name: 'Food & Beverage', description: 'Restaurant and bar supplies', isActive: true },
      { id: 'cat2', name: 'Housekeeping', description: 'Cleaning and maintenance supplies', isActive: true },
      { id: 'cat3', name: 'Office Supplies', description: 'Administrative supplies', isActive: true },
      { id: 'cat4', name: 'Maintenance', description: 'Technical and repair supplies', isActive: true }
    ];

    // Initialize cost centers
    this.costCenters = [
      { id: 'cc1', name: 'Restaurant', code: 'REST', department: 'F&B', budget: 50000, currentSpend: 32000, isActive: true },
      { id: 'cc2', name: 'Bar', code: 'BAR', department: 'F&B', budget: 30000, currentSpend: 18000, isActive: true },
      { id: 'cc3', name: 'Housekeeping', code: 'HK', department: 'Operations', budget: 25000, currentSpend: 15000, isActive: true },
      { id: 'cc4', name: 'Maintenance', code: 'MT', department: 'Engineering', budget: 20000, currentSpend: 12000, isActive: true }
    ];

    // Initialize suppliers
    const suppliers: Supplier[] = [
      {
        id: 'sup1',
        name: 'Ghana Foods Ltd',
        contactPerson: 'Kwame Asante',
        email: 'kwame@ghanafoods.com',
        phone: '+233 20 123 4567',
        address: 'Accra, Ghana',
        taxId: 'GH123456789',
        vatNumber: 'GH-VAT-123456789',
        paymentTerms: 30,
        creditLimit: 100000,
        currentBalance: 25000,
        status: 'active',
        rating: 4.5,
        lastOrderDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        id: 'sup2',
        name: 'CleanPro Supplies',
        contactPerson: 'Ama Osei',
        email: 'ama@cleanpro.com',
        phone: '+233 24 987 6543',
        address: 'Kumasi, Ghana',
        taxId: 'GH987654321',
        vatNumber: 'GH-VAT-987654321',
        paymentTerms: 15,
        creditLimit: 50000,
        currentBalance: 8000,
        status: 'active',
        rating: 4.2,
        lastOrderDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
      }
    ];

    suppliers.forEach(supplier => this.suppliers.set(supplier.id, supplier));

    // Initialize inventory items
    const items: InventoryItem[] = [
      {
        id: 'item1',
        code: 'RICE-001',
        name: 'Basmati Rice',
        description: 'Premium quality basmati rice',
        category: 'Food & Beverage',
        unit: 'kg',
        costPrice: 15.50,
        sellingPrice: 25.00,
        minStockLevel: 50,
        maxStockLevel: 200,
        currentStock: 75,
        status: 'in-stock',
        supplierId: 'sup1',
        location: 'Main Store',
        lastUpdated: new Date().toISOString(),
        reorderPoint: 60,
        leadTime: 7,
        taxRate: 12.5
      },
      {
        id: 'item2',
        code: 'CHICKEN-001',
        name: 'Fresh Chicken',
        description: 'Fresh whole chicken',
        category: 'Food & Beverage',
        unit: 'kg',
        costPrice: 45.00,
        sellingPrice: 65.00,
        minStockLevel: 20,
        maxStockLevel: 100,
        currentStock: 15,
        status: 'low-stock',
        supplierId: 'sup1',
        location: 'Cold Storage',
        lastUpdated: new Date().toISOString(),
        reorderPoint: 25,
        leadTime: 2,
        taxRate: 12.5
      },
      {
        id: 'item3',
        code: 'DETERGENT-001',
        name: 'Laundry Detergent',
        description: 'Professional laundry detergent',
        category: 'Housekeeping',
        unit: 'liters',
        costPrice: 8.50,
        minStockLevel: 30,
        maxStockLevel: 150,
        currentStock: 45,
        status: 'in-stock',
        supplierId: 'sup2',
        location: 'Housekeeping Store',
        lastUpdated: new Date().toISOString(),
        reorderPoint: 40,
        leadTime: 5,
        taxRate: 12.5
      },
      {
        id: 'item4',
        code: 'TOWELS-001',
        name: 'Bath Towels',
        description: 'Premium cotton bath towels',
        category: 'Housekeeping',
        unit: 'pieces',
        costPrice: 35.00,
        minStockLevel: 100,
        maxStockLevel: 500,
        currentStock: 0,
        status: 'out-of-stock',
        supplierId: 'sup2',
        location: 'Linen Room',
        lastUpdated: new Date().toISOString(),
        reorderPoint: 120,
        leadTime: 10,
        taxRate: 12.5
      }
    ];

    items.forEach(item => this.items.set(item.id, item));

    // Initialize some stock movements
    this.createStockMovement({
      movementType: 'purchase',
      itemId: 'item1',
      itemName: 'Basmati Rice',
      quantity: 100,
      unitPrice: 15.50,
      reference: 'PO-001',
      notes: 'Initial stock purchase'
    });

    this.createStockMovement({
      movementType: 'issue',
      itemId: 'item1',
      itemName: 'Basmati Rice',
      quantity: 25,
      unitPrice: 15.50,
      reference: 'ISSUE-001',
      department: 'F&B',
      costCenter: 'Restaurant'
    });

    // Initialize some purchase orders
    this.createPurchaseOrder({
      supplierId: 'sup1',
      supplierName: 'Ghana Foods Ltd',
      expectedDelivery: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      items: [
        { itemId: 'item2', itemName: 'Fresh Chicken', quantity: 50, unitPrice: 45.00 },
        { itemId: 'item1', itemName: 'Basmati Rice', quantity: 100, unitPrice: 15.50 }
      ]
    });

    // Generate alerts
    this.generateAlerts();
  }

  // Item Management
  createItem(data: {
    code: string;
    name: string;
    description?: string;
    category: string;
    unit: string;
    costPrice: number;
    sellingPrice?: number;
    minStockLevel: number;
    maxStockLevel: number;
    supplierId?: string;
    location?: string;
    reorderPoint: number;
    leadTime: number;
    taxRate: number;
  }): InventoryItem {
    const item: InventoryItem = {
      id: `ITEM-${Date.now().toString().slice(-6)}`,
      ...data,
      currentStock: 0,
      status: 'out-of-stock',
      lastUpdated: new Date().toISOString()
    };

    this.items.set(item.id, item);
    this.notify();
    trackEvent('Stores.ItemCreated', { itemId: item.id, itemName: item.name, category: item.category });
    return item;
  }

  updateItemStock(itemId: string, quantityChange: number) {
    const item = this.items.get(itemId);
    if (item) {
      item.currentStock += quantityChange;
      item.lastUpdated = new Date().toISOString();
      
      // Update status based on new stock level
      if (item.currentStock <= 0) {
        item.status = 'out-of-stock';
      } else if (item.currentStock <= item.minStockLevel) {
        item.status = 'low-stock';
      } else {
        item.status = 'in-stock';
      }
      
      this.notify();
    }
  }

  // Stock Movement Management
  createStockMovement(data: {
    movementType: StockMovementType;
    itemId: string;
    itemName: string;
    quantity: number;
    unitPrice: number;
    reference: string;
    notes?: string;
    department?: string;
    costCenter?: string;
  }): StockMovement {
    const movement: StockMovement = {
      id: `SM-${Date.now().toString().slice(-6)}`,
      ...data,
      totalValue: data.quantity * data.unitPrice,
      date: new Date().toISOString(),
      createdBy: 'System'
    };

    this.stockMovements.unshift(movement);
    this.updateItemStock(data.itemId, data.quantity);
    this.notify();
    trackEvent('Stores.StockMovementCreated', { movementId: movement.id, movementType: movement.movementType, itemId: data.itemId });
    return movement;
  }

  // Purchase Order Management
  createPurchaseOrder(data: {
    supplierId: string;
    supplierName: string;
    expectedDelivery: string;
    items: Array<{itemId: string, itemName: string, quantity: number, unitPrice: number}>;
  }): PurchaseOrder {
    const po: PurchaseOrder = {
      id: `PO-${Date.now().toString().slice(-6)}`,
      poNumber: `PO-${Date.now().toString().slice(-6)}`,
      supplierId: data.supplierId,
      supplierName: data.supplierName,
      orderDate: new Date().toISOString(),
      expectedDelivery: data.expectedDelivery,
      status: 'draft',
      totalAmount: data.items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0),
      taxAmount: undefined,
      items: data.items.map(item => ({
        id: `${Date.now()}-${item.itemId}`,
        itemId: item.itemId,
        itemName: item.itemName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.quantity * item.unitPrice,
        receivedQuantity: 0,
        notes: ''
      })),
      notes: '',
      createdBy: 'system',
      approvedBy: null,
      approvedAt: null
    };

    this.purchaseOrders.push(po);
    this.notify();
    return po;
  }

  updatePurchaseOrderStatus(poId: string, status: PurchaseOrderStatus, approvedBy?: string) {
    const po = this.purchaseOrders.find(p => p.id === poId);
    if (po) {
      po.status = status;
      if (approvedBy && status === 'confirmed') {
        po.approvedBy = approvedBy;
        po.approvedAt = new Date().toISOString();
      }
      this.notify();
    }
  }

  receiveGoods(poId: string, receivedItems: Array<{itemId: string, quantity: number, unitPrice: number, notes: string}>) {
    const po = this.purchaseOrders.find(p => p.id === poId);
    if (po) {
      receivedItems.forEach(receivedItem => {
        const poItem = po.items.find(item => item.itemId === receivedItem.itemId);
        if (poItem) {
          poItem.receivedQuantity += receivedItem.quantity;
          
          // Update inventory
          this.updateItemStock(receivedItem.itemId, receivedItem.quantity);
          
          // Create stock movement
          this.createStockMovement({
            movementType: 'purchase',
            itemId: receivedItem.itemId,
            itemName: poItem.itemName,
            quantity: receivedItem.quantity,
            unitPrice: receivedItem.unitPrice,
            reference: po.poNumber,
            notes: `Received from PO ${po.poNumber}: ${receivedItem.notes}`,
            department: 'PURCHASING',
            costCenter: 'PURCHASING'
          });
        }
      });
      
      // Check if all items are received
      const allReceived = po.items.every(item => item.receivedQuantity >= item.quantity);
      if (allReceived) {
        po.status = 'received';
      } else {
        po.status = 'partially-received';
      }
      
      this.notify();
    }
  }

  // Supplier Management
  createSupplier(data: {
    name: string;
    contactPerson: string;
    email: string;
    phone: string;
    address: string;
    taxId: string;
    paymentTerms: number;
    creditLimit: number;
  }): Supplier {
    const supplier: Supplier = {
      id: `SUP-${Date.now().toString().slice(-6)}`,
      ...data,
      currentBalance: 0,
      status: 'active',
      rating: 0
    };

    this.suppliers.set(supplier.id, supplier);
    this.notify();
    trackEvent('Stores.SupplierCreated', { supplierId: supplier.id, supplierName: supplier.name });
    return supplier;
  }

  // Analytics and Reporting
  getInventoryValue(): number {
    return Array.from(this.items.values()).reduce((total, item) => {
      return total + (item.currentStock * item.costPrice);
    }, 0);
  }

  getVATLiability(): number {
    return Array.from(this.items.values()).reduce((total, item) => {
      if (item.taxRate > 0) {
        return total + (item.currentStock * item.costPrice * (item.taxRate / 100));
      }
      return total;
    }, 0);
  }

  getCategoryValue(categoryName: string): number {
    return Array.from(this.items.values())
      .filter(item => item.category === categoryName)
      .reduce((total, item) => total + (item.currentStock * item.costPrice), 0);
  }

  getLowStockItems(): InventoryItem[] {
    return Array.from(this.items.values()).filter(item => item.status === 'low-stock' || item.status === 'out-of-stock');
  }

  getStockMovementsByDateRange(startDate: string, endDate: string): StockMovement[] {
    return this.stockMovements.filter(movement => 
      movement.date >= startDate && movement.date <= endDate
    );
  }

  getDepartmentSpending(department: string, startDate: string, endDate: string): number {
    return this.stockMovements
      .filter(movement => 
        movement.department === department && 
        movement.date >= startDate && 
        movement.date <= endDate &&
        movement.movementType === 'issue'
      )
      .reduce((total, movement) => total + movement.totalValue, 0);
  }

  getSupplierSpending(supplierId: string, startDate: string, endDate: string): number {
    return this.stockMovements
      .filter(movement => 
        movement.reference?.includes('PO-') && 
        movement.date >= startDate && 
        movement.date <= endDate
      )
      .reduce((total, movement) => total + movement.totalValue, 0);
  }

  // Alert Management
  private generateAlerts() {
    // Check for low stock items
    this.getLowStockItems().forEach(item => {
      this.createAlert({
        itemId: item.id,
        itemName: item.name,
        alertType: 'low-stock',
        message: `${item.name} is running low (${item.currentStock} ${item.unit} remaining)`,
        severity: item.currentStock === 0 ? 'critical' : 'high'
      });
    });

    // Check for items approaching expiry
    const today = new Date();
    Array.from(this.items.values()).forEach(item => {
      if (item.expiryDate && new Date(item.expiryDate) <= new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)) {
        this.createAlert({
          itemId: item.id,
          itemName: item.name,
          alertType: 'expiry',
          message: `${item.name} expires on ${new Date(item.expiryDate).toLocaleDateString()}`,
          severity: new Date(item.expiryDate) <= today ? 'critical' : 'medium'
        });
      }
    });
  }

  createAlert(data: {
    itemId: string;
    itemName: string;
    alertType: InventoryAlert['alertType'];
    message: string;
    severity: InventoryAlert['severity'];
  }): InventoryAlert {
    const alert: InventoryAlert = {
      id: `ALERT-${Date.now().toString().slice(-6)}`,
      ...data,
      isRead: false,
      createdAt: new Date().toISOString()
    };

    this.alerts.unshift(alert);
    this.notify();
    return alert;
  }

  markAlertAsRead(alertId: string) {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.isRead = true;
      this.notify();
    }
  }

  // Store interface
  subscribe(listener: () => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  // Getters
  getAllItems(): InventoryItem[] {
    return Array.from(this.items.values());
  }

  getItemById(itemId: string): InventoryItem | undefined {
    return this.items.get(itemId);
  }

  getAllSuppliers(): Supplier[] {
    return Array.from(this.suppliers.values());
  }

  getSupplierById(supplierId: string): Supplier | undefined {
    return this.suppliers.get(supplierId);
  }

  getPurchaseOrders(): PurchaseOrder[] {
    return [...this.purchaseOrders];
  }

  getStockMovements(): StockMovement[] {
    return [...this.stockMovements];
  }

  getCategories(): InventoryCategory[] {
    return [...this.categories];
  }

  getCostCenters(): CostCenter[] {
    return [...this.costCenters];
  }

  getAlerts(): InventoryAlert[] {
    return [...this.alerts];
  }

  private notify() {
    this.listeners.forEach(listener => listener());
  }
}

export const storesStore = new StoresStore();
