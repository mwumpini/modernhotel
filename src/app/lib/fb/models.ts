// Enhanced F&B Data Models

export interface MenuItem {
  id: string;
  name: string;
  price: number;
  category: string;
  route: 'kitchen' | 'bar';
  description?: string;
  imageUrl?: string;
  isActive: boolean;
  preparationTime?: number; // in minutes
  allergens?: string[];
  nutritionalInfo?: {
    calories?: number;
    protein?: number;
    carbs?: number;
    fat?: number;
  };
}

export interface Ingredient {
  id: string;
  name: string;
  category: 'produce' | 'meat' | 'dairy' | 'pantry' | 'beverage' | 'spice' | 'other';
  unit: string; // kg, liters, pieces, etc.
  unitCost: number; // cost per unit
  currentStock: number;
  minimumThreshold: number;
  reorderPoint: number;
  supplierId?: string;
  location?: string; // storage location
  expiryDate?: string;
  isActive: boolean;
  notes?: string;
}

export interface Recipe {
  id: string;
  menuItemId: string;
  name: string;
  ingredients: RecipeIngredient[];
  instructions: string[];
  preparationTime: number; // in minutes
  yield: number; // how many servings this recipe makes
  costPerServing: number;
  isActive: boolean;
}

export interface RecipeIngredient {
  ingredientId: string;
  quantity: number;
  unit: string;
  cost: number; // calculated cost for this ingredient
}

export interface InventoryTransaction {
  id: string;
  ingredientId: string;
  type: 'purchase' | 'usage' | 'adjustment' | 'waste' | 'return';
  quantity: number;
  unitCost: number;
  totalCost: number;
  date: string;
  referenceId?: string; // order ID, purchase order ID, etc.
  employeeId: string;
  notes?: string;
}

export interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  address?: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  loyaltyPoints: number;
  totalSpent: number;
  visitCount: number;
  lastVisit?: string;
  preferences?: {
    dietaryRestrictions: string[];
    favoriteItems: string[];
    allergies: string[];
  };
  isActive: boolean;
  createdAt: string;
}

export interface Supplier {
  id: string;
  name: string;
  contactPerson: string;
  email: string;
  phone: string;
  address: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  products: string[]; // categories or specific products they supply
  paymentTerms: string;
  rating: number; // 1-5 rating
  isActive: boolean;
  notes?: string;
}

export interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: 'manager' | 'waiter' | 'chef' | 'bartender' | 'host' | 'cashier' | 'kitchen_staff';
  hourlyRate: number;
  isActive: boolean;
  hireDate: string;
  department: 'front_of_house' | 'back_of_house' | 'management';
  permissions: string[]; // specific permissions like 'discount_override', 'void_transaction', etc.
  emergencyContact?: {
    name: string;
    relationship: string;
    phone: string;
  };
}

export interface WorkShift {
  id: string;
  employeeId: string;
  date: string;
  startTime: string;
  endTime: string;
  breakTime: number; // in minutes
  totalHours: number;
  hourlyRate: number;
  totalPay: number;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  notes?: string;
}

export interface PurchaseOrder {
  id: string;
  supplierId: string;
  orderDate: string;
  expectedDelivery: string;
  status: 'draft' | 'sent' | 'confirmed' | 'received' | 'cancelled';
  items: PurchaseOrderItem[];
  subtotal: number;
  tax: number;
  shipping: number;
  total: number;
  notes?: string;
  createdBy: string;
}

export interface PurchaseOrderItem {
  ingredientId: string;
  quantity: number;
  unit: string;
  unitCost: number;
  totalCost: number;
  receivedQuantity?: number;
  receivedDate?: string;
}

export interface WasteRecord {
  id: string;
  ingredientId: string;
  quantity: number;
  unit: string;
  cost: number;
  reason: 'expired' | 'damaged' | 'overcooked' | 'spill' | 'other';
  date: string;
  employeeId: string;
  notes?: string;
}

export interface SalesReport {
  id: string;
  date: string;
  totalSales: number;
  totalOrders: number;
  averageOrderValue: number;
  paymentBreakdown: {
    cash: number;
    card: number;
    mobile: number;
    roomCharge: number;
  };
  topSellingItems: Array<{
    itemId: string;
    name: string;
    quantity: number;
    revenue: number;
  }>;
  salesByHour: Array<{
    hour: number;
    orders: number;
    revenue: number;
  }>;
}

export interface InventoryReport {
  id: string;
  date: string;
  totalValue: number;
  lowStockItems: Ingredient[];
  expiringItems: Ingredient[];
  wasteValue: number;
  cogs: number; // Cost of Goods Sold
  stockTurnover: number;
}

export interface LaborReport {
  id: string;
  period: string; // weekly, monthly, etc.
  totalHours: number;
  totalPay: number;
  averageHourlyRate: number;
  laborPercentage: number; // labor cost as % of sales
  employeeBreakdown: Array<{
    employeeId: string;
    name: string;
    hours: number;
    pay: number;
    efficiency: number; // orders per hour, etc.
  }>;
}
