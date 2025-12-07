import { create } from 'zustand';
import { StockItem, StockMovement, InventoryAlert } from './models';

interface StockStore {
  stockItems: StockItem[];
  stockMovements: StockMovement[];
  alerts: InventoryAlert[];
  selectedItem: StockItem | null;
  selectedMovement: StockMovement | null;
  
  // Stock Item Management
  addStockItem: (item: Omit<StockItem, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateStockItem: (id: string, updates: Partial<StockItem>) => void;
  deleteStockItem: (id: string) => void;
  getStockItem: (id: string) => StockItem | undefined;
  getStockItemByCode: (itemCode: string) => StockItem | undefined;
  getStockItemsByCategory: (category: StockItem['category']) => StockItem[];
  getStockItemsByLocation: (location: string) => StockItem[];
  getStockItemsBySupplier: (supplierId: string) => StockItem[];
  
  // Stock Level Management
  updateStockLevel: (itemId: string, quantity: number, operation: 'add' | 'remove' | 'set') => void;
  checkReorderPoint: (itemId: string) => boolean;
  getLowStockItems: () => StockItem[];
  getOutOfStockItems: () => StockItem[];
  getOverstockItems: () => StockItem[];
  getExpiringItems: (daysThreshold: number) => StockItem[];
  
  // Stock Movement Management
  addStockMovement: (movement: Omit<StockMovement, 'id' | 'createdAt'>) => void;
  getMovementsByItem: (itemId: string) => StockMovement[];
  getMovementsByType: (type: StockMovement['movementType']) => StockMovement[];
  getMovementsByDateRange: (startDate: Date, endDate: Date) => StockMovement[];
  
  // Alert Management
  createAlert: (alert: Omit<InventoryAlert, 'id' | 'createdAt' | 'updatedAt'>) => void;
  acknowledgeAlert: (alertId: string, acknowledgedBy: string) => void;
  getActiveAlerts: () => InventoryAlert[];
  getAlertsByType: (type: InventoryAlert['alertType']) => InventoryAlert[];
  getAlertsBySeverity: (severity: InventoryAlert['severity']) => InventoryAlert[];
  
  // Selection
  selectStockItem: (item: StockItem | null) => void;
  selectMovement: (movement: StockMovement | null) => void;
  
  // Analytics
  getTotalInventoryValue: () => number;
  getCategoryBreakdown: () => Record<string, { count: number; value: number }>;
  getLocationBreakdown: () => Record<string, { count: number; value: number }>;
  getSupplierBreakdown: () => Record<string, { count: number; value: number }>;
  getStockTurnoverRate: () => number;
  getDaysInventoryOutstanding: () => number;
  getLowStockPercentage: () => number;
  getOverstockPercentage: () => number;
}

// Sample data
const sampleStockItems: StockItem[] = [
  {
    id: '1',
    itemCode: 'F001',
    name: 'Fresh Tomatoes',
    description: 'Fresh red tomatoes for kitchen use',
    category: 'food',
    subcategory: 'vegetables',
    unit: 'kg',
    unitCost: 2.50,
    sellingPrice: 4.00,
    currentStock: 25,
    minimumStock: 10,
    maximumStock: 50,
    reorderPoint: 15,
    supplierId: 'supplier1',
    supplierName: 'Fresh Farms Ltd',
    location: 'Kitchen Store',
    binLocation: 'A1-B2',
    isActive: true,
    isPerishable: true,
    isSerialized: false,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: '2',
    itemCode: 'B001',
    name: 'Premium Coffee Beans',
    description: 'High-quality Arabica coffee beans',
    category: 'beverage',
    subcategory: 'coffee',
    unit: 'kg',
    unitCost: 15.00,
    sellingPrice: 25.00,
    currentStock: 8,
    minimumStock: 5,
    maximumStock: 20,
    reorderPoint: 7,
    supplierId: 'supplier2',
    supplierName: 'Coffee Traders Co',
    location: 'Bar Store',
    binLocation: 'B1-C3',
    isActive: true,
    isPerishable: false,
    isSerialized: false,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: '3',
    itemCode: 'C001',
    name: 'Multi-Surface Cleaner',
    description: 'Professional cleaning solution',
    category: 'cleaning',
    subcategory: 'chemicals',
    unit: 'bottles',
    unitCost: 8.50,
    currentStock: 15,
    minimumStock: 20,
    maximumStock: 100,
    reorderPoint: 25,
    supplierId: 'supplier3',
    supplierName: 'CleanPro Supplies',
    location: 'Housekeeping Store',
    binLocation: 'C1-D4',
    isActive: true,
    isPerishable: false,
    isSerialized: false,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: '4',
    itemCode: 'L001',
    name: 'Bath Towels',
    description: 'Premium cotton bath towels',
    category: 'linens',
    subcategory: 'towels',
    unit: 'pieces',
    unitCost: 12.00,
    currentStock: 45,
    minimumStock: 30,
    maximumStock: 120,
    reorderPoint: 35,
    supplierId: 'supplier4',
    supplierName: 'LinenCo',
    location: 'Linen Store',
    binLocation: 'D1-E5',
    isActive: true,
    isPerishable: false,
    isSerialized: false,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: '5',
    itemCode: 'M001',
    name: 'AC Filters',
    description: 'Air conditioning filters for maintenance',
    category: 'maintenance',
    subcategory: 'hvac',
    unit: 'pieces',
    unitCost: 25.00,
    currentStock: 3,
    minimumStock: 10,
    maximumStock: 50,
    reorderPoint: 12,
    supplierId: 'supplier5',
    supplierName: 'HVAC Supplies',
    location: 'Maintenance Store',
    binLocation: 'E1-F6',
    isActive: true,
    isPerishable: false,
    isSerialized: false,
    createdAt: new Date(),
    updatedAt: new Date()
  }
];

const sampleStockMovements: StockMovement[] = [
  {
    id: '1',
    itemId: '1',
    itemCode: 'F001',
    itemName: 'Fresh Tomatoes',
    movementType: 'in',
    quantity: 30,
    unitCost: 2.50,
    totalValue: 75.00,
    toLocation: 'Kitchen Store',
    referenceType: 'purchase',
    referenceId: 'po001',
    referenceNumber: 'PO-2024-001',
    performedBy: 'John Smith',
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) // 2 days ago
  },
  {
    id: '2',
    itemId: '1',
    itemCode: 'F001',
    itemName: 'Fresh Tomatoes',
    movementType: 'out',
    quantity: 5,
    unitCost: 2.50,
    totalValue: 12.50,
    fromLocation: 'Kitchen Store',
    referenceType: 'sale',
    referenceId: 'sale001',
    referenceNumber: 'SALE-2024-001',
    performedBy: 'Chef Maria',
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000) // 1 day ago
  },
  {
    id: '3',
    itemId: '2',
    itemCode: 'B001',
    itemName: 'Premium Coffee Beans',
    movementType: 'in',
    quantity: 15,
    unitCost: 15.00,
    totalValue: 225.00,
    toLocation: 'Bar Store',
    referenceType: 'purchase',
    referenceId: 'po002',
    referenceNumber: 'PO-2024-002',
    performedBy: 'John Smith',
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) // 3 days ago
  }
];

const sampleAlerts: InventoryAlert[] = [
  {
    id: '1',
    itemId: '5',
    itemCode: 'M001',
    itemName: 'AC Filters',
    alertType: 'low-stock',
    severity: 'high',
    message: 'AC Filters stock is below reorder point',
    currentValue: 3,
    thresholdValue: 10,
    isActive: true,
    isAcknowledged: false,
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
    updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
  },
  {
    id: '2',
    itemId: '3',
    itemCode: 'C001',
    itemName: 'Multi-Surface Cleaner',
    alertType: 'low-stock',
    severity: 'medium',
    message: 'Multi-Surface Cleaner stock is below reorder point',
    currentValue: 15,
    thresholdValue: 20,
    isActive: true,
    isAcknowledged: false,
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
    updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
  }
];

export const useStockStore = create<StockStore>((set, get) => ({
  stockItems: sampleStockItems,
  stockMovements: sampleStockMovements,
  alerts: sampleAlerts,
  selectedItem: null,
  selectedMovement: null,

  // Stock Item Management
  addStockItem: (itemData) => {
    const newItem: StockItem = {
      ...itemData,
      id: Date.now().toString(),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    set(state => ({ stockItems: [...state.stockItems, newItem] }));
  },

  updateStockItem: (id, updates) => {
    set(state => ({
      stockItems: state.stockItems.map(item => 
        item.id === id 
          ? { ...item, ...updates, updatedAt: new Date() }
          : item
      )
    }));
  },

  deleteStockItem: (id) => {
    set(state => ({ stockItems: state.stockItems.filter(item => item.id !== id) }));
  },

  getStockItem: (id) => get().stockItems.find(item => item.id === id),

  getStockItemByCode: (itemCode) => get().stockItems.find(item => item.itemCode === itemCode),

  getStockItemsByCategory: (category) => get().stockItems.filter(item => item.category === category),

  getStockItemsByLocation: (location) => get().stockItems.filter(item => item.location === location),

  getStockItemsBySupplier: (supplierId) => get().stockItems.filter(item => item.supplierId === supplierId),

  // Stock Level Management
  updateStockLevel: (itemId, quantity, operation) => {
    const item = get().getStockItem(itemId);
    if (!item) return;

    let newQuantity = item.currentStock;
    switch (operation) {
      case 'add':
        newQuantity = Math.min(item.maximumStock, item.currentStock + quantity);
        break;
      case 'remove':
        newQuantity = Math.max(0, item.currentStock - quantity);
        break;
      case 'set':
        newQuantity = Math.max(0, Math.min(item.maximumStock, quantity));
        break;
    }

    get().updateStockItem(itemId, { currentStock: newQuantity });
  },

  checkReorderPoint: (itemId) => {
    const item = get().getStockItem(itemId);
    if (!item) return false;
    return item.currentStock <= item.reorderPoint;
  },

  getLowStockItems: () => get().stockItems.filter(item => 
    item.isActive && 
    item.currentStock > 0 && 
    item.currentStock <= item.reorderPoint
  ),

  getOutOfStockItems: () => get().stockItems.filter(item => 
    item.isActive && 
    (item.currentStock === 0 || item.currentStock < item.minimumStock)
  ),

  getOverstockItems: () => get().stockItems.filter(item => 
    item.isActive && 
    item.currentStock > item.maximumStock * 0.8
  ),

  getExpiringItems: (daysThreshold) => {
    const thresholdDate = new Date(Date.now() + daysThreshold * 24 * 60 * 60 * 1000);
    return get().stockItems.filter(item => 
      item.expiryDate && item.expiryDate <= thresholdDate
    );
  },

  // Stock Movement Management
  addStockMovement: (movementData) => {
    const newMovement: StockMovement = {
      ...movementData,
      id: Date.now().toString(),
      createdAt: new Date()
    };
    set(state => ({ stockMovements: [...state.stockMovements, newMovement] }));
  },

  getMovementsByItem: (itemId) => get().stockMovements.filter(movement => movement.itemId === itemId),

  getMovementsByType: (type) => get().stockMovements.filter(movement => movement.movementType === type),

  getMovementsByDateRange: (startDate, endDate) => {
    return get().stockMovements.filter(movement => 
      movement.createdAt >= startDate && movement.createdAt <= endDate
    );
  },

  // Alert Management
  createAlert: (alertData) => {
    const newAlert: InventoryAlert = {
      ...alertData,
      id: Date.now().toString(),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    set(state => ({ alerts: [...state.alerts, newAlert] }));
  },

  acknowledgeAlert: (alertId, acknowledgedBy) => {
    set(state => ({
      alerts: state.alerts.map(alert => 
        alert.id === alertId 
          ? { 
              ...alert, 
              isAcknowledged: true, 
              acknowledgedBy, 
              acknowledgedAt: new Date(),
              updatedAt: new Date()
            }
          : alert
      )
    }));
  },

  getActiveAlerts: () => get().alerts.filter(alert => alert.isActive),

  getAlertsByType: (type) => get().alerts.filter(alert => alert.alertType === type),

  getAlertsBySeverity: (severity) => get().alerts.filter(alert => alert.severity === severity),

  // Selection
  selectStockItem: (item) => set({ selectedItem: item }),

  selectMovement: (movement) => set({ selectedMovement: movement }),

  // Analytics
  getTotalInventoryValue: () => {
    return get().stockItems.reduce((total, item) => 
      total + (item.currentStock * item.unitCost), 0
    );
  },

  getCategoryBreakdown: () => {
    const breakdown: Record<string, { count: number; value: number }> = {};
    
    get().stockItems.forEach(item => {
      if (!breakdown[item.category]) {
        breakdown[item.category] = { count: 0, value: 0 };
      }
      breakdown[item.category].count += item.currentStock;
      breakdown[item.category].value += item.currentStock * item.unitCost;
    });
    
    return breakdown;
  },

  getLocationBreakdown: () => {
    const breakdown: Record<string, { count: number; value: number }> = {};
    
    get().stockItems.forEach(item => {
      if (!breakdown[item.location]) {
        breakdown[item.location] = { count: 0, value: 0 };
      }
      breakdown[item.location].count += item.currentStock;
      breakdown[item.location].value += item.currentStock * item.unitCost;
    });
    
    return breakdown;
  },

  getSupplierBreakdown: () => {
    const breakdown: Record<string, { count: number; value: number }> = {};
    
    get().stockItems.forEach(item => {
      if (!breakdown[item.supplierName]) {
        breakdown[item.supplierName] = { count: 0, value: 0 };
      }
      breakdown[item.supplierName].count += item.currentStock;
      breakdown[item.supplierName].value += item.currentStock * item.unitCost;
    });
    
    return breakdown;
  },

  getStockTurnoverRate: () => {
    const movements = get().stockMovements;
    const totalOutValue = movements
      .filter(m => m.movementType === 'out')
      .reduce((sum, m) => sum + m.totalValue, 0);
    
    const averageInventoryValue = get().getTotalInventoryValue();
    
    return averageInventoryValue > 0 ? totalOutValue / averageInventoryValue : 0;
  },

  getDaysInventoryOutstanding: () => {
    const turnoverRate = get().getStockTurnoverRate();
    return turnoverRate > 0 ? 365 / turnoverRate : 0;
  },

  getLowStockPercentage: () => {
    const items = get().stockItems;
    const lowStockItems = items.filter(item => item.currentStock <= item.reorderPoint);
    
    return items.length > 0 ? (lowStockItems.length / items.length) * 100 : 0;
  },

  getOverstockPercentage: () => {
    const items = get().stockItems;
    const overstockItems = items.filter(item => item.currentStock > item.maximumStock * 0.8);
    
    return items.length > 0 ? (overstockItems.length / items.length) * 100 : 0;
  }
}));
