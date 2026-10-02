'use client';

import { getClientTenantSubdomain } from '../api/clientTenant';
import { useSettingsStore } from '../settings/store';

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
  menuItemId?: string;
  category?: string;
  status?: 'pending' | 'preparing' | 'ready' | 'served' | 'cancelled';
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
  orderNumber?: string;
  table: string;
  waiterId: string;
  items: OrderItem[];
  status: 'pending' | 'sent' | 'served' | 'paid' | 'preparing' | 'ready' | 'billed' | 'cancelled';
  customerType: CustomerType;
  venue: VenueMode;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  guestName?: string;
  roomNumber?: string;
  tabName?: string;
  preAuthLast4?: string;
  total?: number;
  timestamp?: string;
  createdAt?: string;
  updatedAt?: string;
  urgent?: boolean;
  notes?: string;
  edited?: boolean;
  audit?: Array<{ at: string; by: string; action: string; details?: string }>;
  // Real, Prisma-persisted fields (see serializeFbOrder.ts) that reporting needs
  // for real history tables — KOT/BOT tickets, voids, discounts, table sales —
  // and that weren't previously carried over by hydrateFromApi() below.
  covers?: number;
  discountAmount?: number;
  serviceCharge?: number;
  subtotal?: number;
  taxAmount?: number;
  assignedToName?: string;
  preparingAt?: string;
  servedAt?: string;
  billedAt?: string;
  folioId?: string;
  guestId?: string;
  /** Cash, Card, Mobile Money, or Room Charge. Empty until the order is settled. */
  paymentMethod?: string;
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

  /**
   * Replace in-memory orders with the real, Prisma-persisted history from
   * /api/fb/orders. Without this, every consumer of this store (FBPOS's order
   * list, reportingStore.ts's sales/labor/hourly reports, the Restaurant/Bar
   * "POS Activity" tabs) only ever sees orders placed in the current browser
   * tab since the last reload — this store was never hydrated from the DB.
   *
   * Field reconciliation notes (the server shape differs from this client shape):
   * - table <- tableNumber; waiterId <- serverName (the real order stores the
   *   resolved name, not a staff id — every consumer already falls back to
   *   displaying waiterId as-is when it doesn't match a known staff id, so this
   *   displays correctly even though it's a name, not an id).
   * - venue collapses 4 real values (restaurant|bar|room_service|pool_bar) to
   *   this store's 2 (Restaurant|Bar).
   * - customerType isn't persisted server-side at all; inferred from
   *   guestId/roomNumber/venue as the closest honest approximation.
   * - Per-item discountPerUnit/serviceChargePerUnit aren't persisted either
   *   (only the final net `amount` is) — reverse-derived from
   *   amount/quantity vs unitPrice so downstream code computing
   *   `price - discountPerUnit + serviceChargePerUnit` still reproduces the
   *   real, already-billed amount exactly.
   */
  async hydrateFromApi(): Promise<void> {
    if (typeof window === 'undefined') return;
    const t = getClientTenantSubdomain();
    if (!t) return;
    try {
      const res = await fetch('/api/fb/orders', { headers: { 'x-tenant-subdomain': t }, cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      const rows: any[] = data.orders || [];

      this.orders = rows.map((o): FBOrder => {
        const venue: VenueMode = (o.venue === 'bar' || o.venue === 'pool_bar') ? 'Bar' : 'Restaurant';
        const customerType: CustomerType = o.guestId || o.roomNumber
          ? 'In-house'
          : venue === 'Bar' ? 'Bar Tab' : 'Walk-in';

        const items: OrderItem[] = (o.items || []).map((it: any): OrderItem => {
          const qty = Number(it.quantity) || 0;
          const unitPrice = Number(it.unitPrice) || 0;
          const netPerUnit = qty > 0 ? Number(it.amount) / qty : unitPrice;
          const discountPerUnit = Math.max(0, unitPrice - netPerUnit) || undefined;
          const serviceChargePerUnit = Math.max(0, netPerUnit - unitPrice) || undefined;
          return {
            id: it.id,
            name: it.name,
            price: unitPrice,
            route: it.route === 'bar' ? 'bar' : 'kitchen',
            qty,
            menuItemId: it.menuItemId || undefined,
            category: it.category || undefined,
            discountPerUnit,
            serviceChargePerUnit,
          };
        });

        return {
          id: o.id,
          orderNumber: o.orderNumber || undefined,
          table: o.tableNumber || '',
          waiterId: o.serverName || o.assignedToName || '',
          items,
          status: o.status,
          customerType,
          venue,
          priority: o.priority,
          guestName: o.guestName || undefined,
          roomNumber: o.roomNumber || undefined,
          total: Number(o.total) || 0,
          timestamp: o.createdAt,
          createdAt: o.createdAt,
          updatedAt: o.updatedAt,
          notes: o.notes || undefined,
          covers: o.covers ?? undefined,
          discountAmount: Number(o.discountAmount) || undefined,
          serviceCharge: Number(o.serviceCharge) || undefined,
          subtotal: Number(o.subtotal) || undefined,
          taxAmount: Number(o.taxAmount) || undefined,
          assignedToName: o.assignedToName || undefined,
          preparingAt: o.preparingAt || undefined,
          servedAt: o.servedAt || undefined,
          billedAt: o.billedAt || undefined,
          folioId: o.folioId || undefined,
          guestId: o.guestId || undefined,
          paymentMethod: o.paymentMethod || undefined,
        };
      });
      this.listeners.forEach((l) => l());
      const ticket = (notes: string | undefined, key: 'KOT' | 'BOT') => notes?.match(new RegExp(`${key}=([^;\\]]+)`))?.[1];
      const settings = useSettingsStore.getState();
      settings.raiseModuleNumberFloor('foodBeverage', 'order', this.orders.map((o) => o.orderNumber));
      settings.raiseModuleNumberFloor('foodBeverage', 'kitchenOrderTicket', this.orders.map((o) => ticket(o.notes, 'KOT')));
      settings.raiseModuleNumberFloor('foodBeverage', 'barOrderTicket', this.orders.map((o) => ticket(o.notes, 'BOT')));
    } catch (e) {
      console.warn('[FB] ordersStore hydrateFromApi failed:', e);
    }
  }
}

export const ordersStore = new OrdersStore();


