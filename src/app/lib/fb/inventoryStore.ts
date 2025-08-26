'use client';

import { Ingredient, Recipe, InventoryTransaction, WasteRecord, PurchaseOrder } from './models';

class InventoryStore {
  private ingredients: Ingredient[] = [];
  private recipes: Recipe[] = [];
  private transactions: InventoryTransaction[] = [];
  private wasteRecords: WasteRecord[] = [];
  private purchaseOrders: PurchaseOrder[] = [];
  private listeners: Array<() => void> = [];

  // Sample data initialization
  constructor() {
    this.initializeSampleData();
  }

  private initializeSampleData() {
    // Sample ingredients
    this.ingredients = [
      {
        id: 'ING001',
        name: 'Fresh Tomatoes',
        category: 'produce',
        unit: 'kg',
        unitCost: 2.50,
        currentStock: 15.5,
        minimumThreshold: 5,
        reorderPoint: 8,
        supplierId: 'SUP001',
        location: 'Walk-in Cooler A',
        isActive: true,
        notes: 'Organic, local supplier'
      },
      {
        id: 'ING002',
        name: 'Chicken Breast',
        category: 'meat',
        unit: 'kg',
        unitCost: 8.75,
        currentStock: 12.0,
        minimumThreshold: 8,
        reorderPoint: 10,
        supplierId: 'SUP002',
        location: 'Freezer B',
        isActive: true
      },
      {
        id: 'ING003',
        name: 'Basmati Rice',
        category: 'pantry',
        unit: 'kg',
        unitCost: 3.20,
        currentStock: 25.0,
        minimumThreshold: 10,
        reorderPoint: 15,
        supplierId: 'SUP003',
        location: 'Dry Storage',
        isActive: true
      },
      {
        id: 'ING004',
        name: 'Olive Oil',
        category: 'pantry',
        unit: 'liters',
        unitCost: 12.50,
        currentStock: 8.5,
        minimumThreshold: 3,
        reorderPoint: 5,
        supplierId: 'SUP001',
        location: 'Dry Storage',
        isActive: true
      },
      {
        id: 'ING005',
        name: 'Fresh Basil',
        category: 'produce',
        unit: 'bunches',
        unitCost: 1.80,
        currentStock: 6,
        minimumThreshold: 2,
        reorderPoint: 3,
        supplierId: 'SUP001',
        location: 'Walk-in Cooler A',
        isActive: true
      }
    ];

    // Sample recipes
    this.recipes = [
      {
        id: 'REC001',
        menuItemId: 'M1', // Jollof Rice
        name: 'Jollof Rice Recipe',
        ingredients: [
          { ingredientId: 'ING003', quantity: 0.5, unit: 'kg', cost: 1.60 },
          { ingredientId: 'ING001', quantity: 0.3, unit: 'kg', cost: 0.75 },
          { ingredientId: 'ING004', quantity: 0.05, unit: 'liters', cost: 0.63 },
          { ingredientId: 'ING005', quantity: 0.5, unit: 'bunches', cost: 0.90 }
        ],
        instructions: [
          'Wash and rinse rice thoroughly',
          'Dice tomatoes and prepare other vegetables',
          'Heat oil in large pot',
          'Add tomatoes and cook until soft',
          'Add rice and other ingredients',
          'Simmer until rice is cooked'
        ],
        preparationTime: 45,
        yield: 4,
        costPerServing: 0.97,
        isActive: true
      }
    ];

    // Sample transactions
    this.transactions = [
      {
        id: 'TXN001',
        ingredientId: 'ING001',
        type: 'purchase',
        quantity: 20,
        unitCost: 2.50,
        totalCost: 50.00,
        date: new Date().toISOString(),
        employeeId: 'EMP001',
        notes: 'Weekly produce delivery'
      },
      {
        id: 'TXN002',
        ingredientId: 'ING001',
        type: 'usage',
        quantity: 4.5,
        unitCost: 2.50,
        totalCost: 11.25,
        date: new Date().toISOString(),
        employeeId: 'EMP002',
        referenceId: 'ORD-001',
        notes: 'Used in Jollof Rice preparation'
      }
    ];

    // Sample waste records
    this.wasteRecords = [
      {
        id: 'WASTE001',
        ingredientId: 'ING001',
        quantity: 0.5,
        unit: 'kg',
        cost: 1.25,
        reason: 'expired',
        date: new Date().toISOString(),
        employeeId: 'EMP001',
        notes: 'Tomatoes past expiration date'
      }
    ];
  }

  // Ingredient management
  addIngredient(ingredient: Omit<Ingredient, 'id'>): Ingredient {
    const id = `ING${String(this.ingredients.length + 1).padStart(3, '0')}`;
    const newIngredient = { ...ingredient, id };
    this.ingredients.push(newIngredient);
    this.notifyListeners();
    return newIngredient;
  }

  updateIngredient(id: string, updates: Partial<Ingredient>): Ingredient | null {
    const index = this.ingredients.findIndex(i => i.id === id);
    if (index === -1) return null;
    
    this.ingredients[index] = { ...this.ingredients[index], ...updates };
    this.notifyListeners();
    return this.ingredients[index];
  }

  getIngredient(id: string): Ingredient | undefined {
    return this.ingredients.find(i => i.id === id);
  }

  getAllIngredients(): Ingredient[] {
    return [...this.ingredients];
  }

  getIngredientsByCategory(category: string): Ingredient[] {
    return this.ingredients.filter(i => i.category === category);
  }

  getLowStockIngredients(): Ingredient[] {
    return this.ingredients.filter(i => i.currentStock <= i.minimumThreshold);
  }

  getExpiringIngredients(): Ingredient[] {
    const today = new Date();
    return this.ingredients.filter(i => {
      if (!i.expiryDate) return false;
      const expiry = new Date(i.expiryDate);
      const daysUntilExpiry = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return daysUntilExpiry <= 7 && daysUntilExpiry >= 0;
    });
  }

  // Inventory transactions
  addTransaction(transaction: Omit<InventoryTransaction, 'id'>): InventoryTransaction {
    const id = `TXN${String(this.transactions.length + 1).padStart(3, '0')}`;
    const newTransaction = { ...transaction, id };
    this.transactions.push(newTransaction);
    
    // Update ingredient stock
    this.updateIngredientStock(transaction);
    
    this.notifyListeners();
    return newTransaction;
  }

  private updateIngredientStock(transaction: InventoryTransaction): void {
    const ingredient = this.ingredients.find(i => i.id === transaction.ingredientId);
    if (!ingredient) return;

    switch (transaction.type) {
      case 'purchase':
      case 'return':
        ingredient.currentStock += transaction.quantity;
        break;
      case 'usage':
      case 'waste':
        ingredient.currentStock = Math.max(0, ingredient.currentStock - transaction.quantity);
        break;
      case 'adjustment':
        ingredient.currentStock = transaction.quantity;
        break;
    }
  }

  getTransactions(ingredientId?: string): InventoryTransaction[] {
    if (ingredientId) {
      return this.transactions.filter(t => t.ingredientId === ingredientId);
    }
    return [...this.transactions];
  }

  // Recipe management
  addRecipe(recipe: Omit<Recipe, 'id'>): Recipe {
    const id = `REC${String(this.recipes.length + 1).padStart(3, '0')}`;
    const newRecipe = { ...recipe, id };
    this.recipes.push(newRecipe);
    this.notifyListeners();
    return newRecipe;
  }

  getRecipe(menuItemId: string): Recipe | undefined {
    return this.recipes.find(r => r.menuItemId === menuItemId);
  }

  getAllRecipes(): Recipe[] {
    return [...this.recipes];
  }

  // Waste management
  addWasteRecord(waste: Omit<WasteRecord, 'id'>): WasteRecord {
    const id = `WASTE${String(this.wasteRecords.length + 1).padStart(3, '0')}`;
    const newWaste = { ...waste, id };
    this.wasteRecords.push(newWaste);
    
    // Add as inventory transaction
    this.addTransaction({
      ingredientId: waste.ingredientId,
      type: 'waste',
      quantity: waste.quantity,
      unitCost: waste.cost / waste.quantity,
      totalCost: waste.cost,
      date: waste.date,
      employeeId: waste.employeeId,
      notes: `Waste: ${waste.reason} - ${waste.notes || ''}`
    });
    
    this.notifyListeners();
    return newWaste;
  }

  getWasteRecords(ingredientId?: string): WasteRecord[] {
    if (ingredientId) {
      return this.wasteRecords.filter(w => w.ingredientId === ingredientId);
    }
    return [...this.wasteRecords];
  }

  // Purchase order management
  addPurchaseOrder(po: Omit<PurchaseOrder, 'id'>): PurchaseOrder {
    const id = `PO${String(this.purchaseOrders.length + 1).padStart(3, '0')}`;
    const newPO = { ...po, id };
    this.purchaseOrders.push(newPO);
    this.notifyListeners();
    return newPO;
  }

  updatePurchaseOrderStatus(id: string, status: PurchaseOrder['status']): PurchaseOrder | null {
    const po = this.purchaseOrders.find(p => p.id === id);
    if (!po) return null;
    
    po.status = status;
    this.notifyListeners();
    return po;
  }

  getPurchaseOrders(status?: PurchaseOrder['status']): PurchaseOrder[] {
    if (status) {
      return this.purchaseOrders.filter(po => po.status === status);
    }
    return [...this.purchaseOrders];
  }

  // Analytics and reporting
  getInventoryValue(): number {
    return this.ingredients.reduce((total, ingredient) => {
      return total + (ingredient.currentStock * ingredient.unitCost);
    }, 0);
  }

  getCostOfGoodsSold(startDate: string, endDate: string): number {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    return this.transactions
      .filter(t => {
        const date = new Date(t.date);
        return date >= start && date <= end && t.type === 'usage';
      })
      .reduce((total, t) => total + t.totalCost, 0);
  }

  getWasteValue(startDate: string, endDate: string): number {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    return this.wasteRecords
      .filter(w => {
        const date = new Date(w.date);
        return date >= start && date <= end;
      })
      .reduce((total, w) => total + w.cost, 0);
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

export const inventoryStore = new InventoryStore();
