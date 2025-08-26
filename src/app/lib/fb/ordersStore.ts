'use client';

export type VenueMode = 'Restaurant' | 'Bar';
export type CustomerType = 'In-house' | 'Walk-in' | 'Takeout' | 'Bar Tab';

export interface MenuItemRef {
  id: string;
  name: string;
  price: number;
  route: 'kitchen' | 'bar';
}

export interface OrderItem extends MenuItemRef {
  qty: number;
  status?: 'pending' | 'preparing' | 'ready' | 'served';
  prepMinutes?: number;
  startedAt?: string;
  readyAt?: string;
  assignedToId?: string;
  assignedToName?: string;
  preparedById?: string;
  preparedByName?: string;
  preparedAt?: string;
  discountPerUnit?: number; // absolute ₵ per unit
  serviceChargePerUnit?: number; // absolute ₵ per unit
  isRoomService?: boolean;
  roomServiceChargeApplied?: boolean;
}

export interface FBOrder {
  id: string;
  table: string;
  waiterId: string;
  items: OrderItem[];
  status: 'pending' | 'sent' | 'served' | 'paid';
  customerType: CustomerType;
  venue: VenueMode;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  guestName?: string;
  roomNumber?: string;
  tabName?: string;
  preAuthLast4?: string;
  createdAt?: string;
  updatedAt?: string;
  urgent?: boolean;
  notes?: string;
  edited?: boolean;
  audit?: Array<{ at: string; by: string; action: string; details?: string }>;
}

class OrdersStore {
  private orders: FBOrder[] = [];
  private listeners: Array<() => void> = [];

  add(order: FBOrder) {
    const now = new Date().toISOString();
    this.orders.unshift({ ...order, createdAt: now, updatedAt: now, audit: order.audit || [] });
    this.listeners.forEach((l) => l());
  }

  update(order: FBOrder) {
    const now = new Date().toISOString();
    this.orders = this.orders.map(o => o.id === order.id ? { ...order, updatedAt: now, audit: order.audit || o.audit || [] } : o);
    this.listeners.forEach((l) => l());
  }

  updateOrder(orderId: string, patch: Partial<FBOrder>) {
    const idx = this.orders.findIndex(o => o.id === orderId);
    if (idx === -1) return;
    const current = this.orders[idx];
    this.orders[idx] = { ...current, ...patch, updatedAt: new Date().toISOString() };
    this.listeners.forEach(l => l());
  }

  updateItem(orderId: string, itemId: string, patch: Partial<OrderItem>) {
    const order = this.orders.find(o => o.id === orderId);
    if (!order) return;
    order.items = order.items.map(i => i.id === itemId ? { ...i, ...patch } : i);
    order.updatedAt = new Date().toISOString();
    this.listeners.forEach(l => l());
  }

  all() {
    return [...this.orders];
  }

  byVenue(venue: VenueMode) {
    return this.orders.filter(o => o.venue === venue);
  }

  subscribe(listener: () => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  remove(orderId: string) {
    this.orders = this.orders.filter(o => o.id !== orderId);
    this.listeners.forEach((l) => l());
  }

  removeItem(orderId: string, itemId: string) {
    const order = this.orders.find(o => o.id === orderId);
    if (!order) return;
    order.items = order.items.filter(i => i.id !== itemId);
    order.updatedAt = new Date().toISOString();
    this.listeners.forEach(l => l());
  }
}

export const ordersStore = new OrdersStore();


