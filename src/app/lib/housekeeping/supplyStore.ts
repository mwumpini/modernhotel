import { create } from 'zustand';
import { SupplyInventory } from './models';

interface SupplyStore {
  supplies: SupplyInventory[];
  selectedSupply: SupplyInventory | null;
  
  // Supply Management
  addSupply: (supply: Omit<SupplyInventory, 'id'>) => void;
  updateSupply: (id: string, updates: Partial<SupplyInventory>) => void;
  deleteSupply: (id: string) => void;
  getSupply: (id: string) => SupplyInventory | undefined;
  getSuppliesByCategory: (category: SupplyInventory['category']) => SupplyInventory[];
  getSuppliesBySupplier: (supplier: string) => SupplyInventory[];
  getLowStockSupplies: () => SupplyInventory[];
  getExpiringSupplies: (daysThreshold: number) => SupplyInventory[];
  
  // Inventory Operations
  updateStock: (id: string, quantity: number, operation: 'add' | 'remove') => void;
  restockSupply: (id: string, quantity: number) => void;
  useSupply: (id: string, quantity: number) => void;
  adjustStock: (id: string, newQuantity: number, reason: string) => void;
  
  // Selection
  selectSupply: (supply: SupplyInventory | null) => void;
  
  // Analytics
  getInventoryValue: () => number;
  getCategoryBreakdown: () => Record<string, { count: number; value: number }>;
  getSupplierBreakdown: () => Record<string, { count: number; value: number }>;
  getRestockAlerts: () => SupplyInventory[];
  getExpiryAlerts: () => SupplyInventory[];
  getLowStockAlerts: () => SupplyInventory[];
}

// Sample data
const sampleSupplies: SupplyInventory[] = [
  {
    id: '1',
    name: 'Multi-Surface Cleaner',
    category: 'cleaning',
    currentStock: 45,
    minimumStock: 20,
    maximumStock: 100,
    unit: 'bottles',
    unitCost: 8.50,
    supplier: 'CleanPro Supplies',
    lastRestocked: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
    nextRestockDate: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000), // 4 days from now
    location: 'Housekeeping Storage A',
    isActive: true
  },
  {
    id: '2',
    name: 'Fresh Bed Linens',
    category: 'linens',
    currentStock: 15,
    minimumStock: 25,
    maximumStock: 80,
    unit: 'sets',
    unitCost: 45.00,
    supplier: 'LinenCo',
    lastRestocked: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
    nextRestockDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days from now
    location: 'Linen Storage',
    isActive: true
  },
  {
    id: '3',
    name: 'Bath Towels',
    category: 'linens',
    currentStock: 8,
    minimumStock: 30,
    maximumStock: 120,
    unit: 'pieces',
    unitCost: 12.00,
    supplier: 'LinenCo',
    lastRestocked: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
    nextRestockDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000), // 1 day from now
    location: 'Linen Storage',
    isActive: true
  },
  {
    id: '4',
    name: 'Toilet Paper',
    category: 'amenities',
    currentStock: 35,
    minimumStock: 20,
    maximumStock: 100,
    unit: 'rolls',
    unitCost: 2.50,
    supplier: 'OfficeMax',
    lastRestocked: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
    nextRestockDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days from now
    location: 'Amenities Storage',
    isActive: true
  },
  {
    id: '5',
    name: 'Hand Soap',
    category: 'amenities',
    currentStock: 12,
    minimumStock: 15,
    maximumStock: 50,
    unit: 'bottles',
    unitCost: 6.00,
    supplier: 'OfficeMax',
    lastRestocked: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000), // 4 days ago
    nextRestockDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
    location: 'Amenities Storage',
    isActive: true
  },
  {
    id: '6',
    name: 'Glass Cleaner',
    category: 'cleaning',
    currentStock: 18,
    minimumStock: 10,
    maximumStock: 40,
    unit: 'bottles',
    unitCost: 5.50,
    supplier: 'CleanPro Supplies',
    lastRestocked: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
    nextRestockDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 days from now
    location: 'Housekeeping Storage A',
    isActive: true
  },
  {
    id: '7',
    name: 'Air Freshener',
    category: 'amenities',
    currentStock: 5,
    minimumStock: 20,
    maximumStock: 60,
    unit: 'cans',
    unitCost: 4.50,
    supplier: 'OfficeMax',
    lastRestocked: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000), // 6 days ago
    nextRestockDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000), // 1 day from now
    location: 'Amenities Storage',
    isActive: true
  },
  {
    id: '8',
    name: 'Disposable Gloves',
    category: 'cleaning',
    currentStock: 22,
    minimumStock: 25,
    maximumStock: 100,
    unit: 'boxes',
    unitCost: 15.00,
    supplier: 'CleanPro Supplies',
    lastRestocked: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
    nextRestockDate: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000), // 6 days from now
    location: 'Housekeeping Storage A',
    isActive: true
  }
];

export const useSupplyStore = create<SupplyStore>((set, get) => ({
  supplies: sampleSupplies,
  selectedSupply: null,

  // Supply Management
  addSupply: (supplyData) => {
    const newSupply: SupplyInventory = {
      ...supplyData,
      id: Date.now().toString()
    };
    set(state => ({ supplies: [...state.supplies, newSupply] }));
  },

  updateSupply: (id, updates) => {
    set(state => ({
      supplies: state.supplies.map(supply => 
        supply.id === id 
          ? { ...supply, ...updates }
          : supply
      )
    }));
  },

  deleteSupply: (id) => {
    set(state => ({ supplies: state.supplies.filter(supply => supply.id !== id) }));
  },

  getSupply: (id) => get().supplies.find(supply => supply.id === id),

  getSuppliesByCategory: (category) => get().supplies.filter(supply => supply.category === category),

  getSuppliesBySupplier: (supplier) => get().supplies.filter(supply => supply.supplier === supplier),

  getLowStockSupplies: () => get().supplies.filter(supply => supply.currentStock <= supply.minimumStock),

  getExpiringSupplies: (daysThreshold) => {
    const thresholdDate = new Date(Date.now() + daysThreshold * 24 * 60 * 60 * 1000);
    return get().supplies.filter(supply => 
      supply.expiryDate && supply.expiryDate <= thresholdDate
    );
  },

  // Inventory Operations
  updateStock: (id, quantity, operation) => {
    const supply = get().getSupply(id);
    if (!supply) return;

    let newQuantity = supply.currentStock;
    if (operation === 'add') {
      newQuantity = Math.min(supply.maximumStock, supply.currentStock + quantity);
    } else if (operation === 'remove') {
      newQuantity = Math.max(0, supply.currentStock - quantity);
    }

    get().updateSupply(id, { currentStock: newQuantity });
  },

  restockSupply: (id, quantity) => {
    get().updateStock(id, quantity, 'add');
    
    // Update last restocked date
    get().updateSupply(id, { 
      lastRestocked: new Date(),
      nextRestockDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days from now
    });
  },

  useSupply: (id, quantity) => {
    get().updateStock(id, quantity, 'remove');
  },

  adjustStock: (id, newQuantity, reason) => {
    const supply = get().getSupply(id);
    if (!supply) return;

    // Ensure quantity is within bounds
    const adjustedQuantity = Math.max(0, Math.min(supply.maximumStock, newQuantity));
    
    get().updateSupply(id, { currentStock: adjustedQuantity });
    
    // Log the adjustment (in a real system, this would go to an audit log)
    console.log(`Stock adjusted for ${supply.name}: ${supply.currentStock} → ${adjustedQuantity}. Reason: ${reason}`);
  },

  // Selection
  selectSupply: (supply) => set({ selectedSupply: supply }),

  // Analytics
  getInventoryValue: () => {
    return get().supplies.reduce((total, supply) => 
      total + (supply.currentStock * supply.unitCost), 0
    );
  },

  getCategoryBreakdown: () => {
    const breakdown: Record<string, { count: number; value: number }> = {};
    
    get().supplies.forEach(supply => {
      if (!breakdown[supply.category]) {
        breakdown[supply.category] = { count: 0, value: 0 };
      }
      breakdown[supply.category].count += supply.currentStock;
      breakdown[supply.category].value += supply.currentStock * supply.unitCost;
    });
    
    return breakdown;
  },

  getSupplierBreakdown: () => {
    const breakdown: Record<string, { count: number; value: number }> = {};
    
    get().supplies.forEach(supply => {
      if (!breakdown[supply.supplier]) {
        breakdown[supply.supplier] = { count: 0, value: 0 };
      }
      breakdown[supply.supplier].count += supply.currentStock;
      breakdown[supply.supplier].value += supply.currentStock * supply.unitCost;
    });
    
    return breakdown;
  },

  getRestockAlerts: () => {
    const now = new Date();
    return get().supplies.filter(supply => 
      supply.nextRestockDate <= now || supply.currentStock <= supply.minimumStock
    );
  },

  getExpiryAlerts: () => {
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    
    return get().supplies.filter(supply => 
      supply.expiryDate && supply.expiryDate <= thirtyDaysFromNow
    );
  },

  getLowStockAlerts: () => {
    return get().supplies.filter(supply => 
      supply.currentStock <= supply.minimumStock
    );
  }
}));
