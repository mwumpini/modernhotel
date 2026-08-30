import type { FbOrderDto } from './api';

export type KitchenStationDef = {
  id: string;
  name: string;
  specializations: string[];
  /** Match kitchen line items to this station */
  match: (name: string, category?: string | null) => boolean;
};

export const KITCHEN_STATION_DEFS: KitchenStationDef[] = [
  {
    id: 'grill',
    name: 'Main Grill',
    specializations: ['Grilled Meats', 'Fish', 'Burgers'],
    match: (name) => /grill|chicken|tilapia|beef|burger|fish|banku/i.test(name),
  },
  {
    id: 'rice',
    name: 'Rice Station',
    specializations: ['Jollof Rice', 'Waakye', 'Fried Rice'],
    match: (name) => /jollof|rice|waakye|fried rice/i.test(name),
  },
  {
    id: 'soup',
    name: 'Soup Station',
    specializations: ['Light Soup', 'Groundnut Soup', 'Fufu'],
    match: (name) => /soup|fufu|light soup|groundnut/i.test(name),
  },
  {
    id: 'apps',
    name: 'Appetizer Station',
    specializations: ['Kelewele', 'Salads', 'Snacks'],
    match: (name, cat) =>
      /kelewele|salad|sandwich|snack|appetizer/i.test(name) ||
      (cat ?? '').toLowerCase().includes('snack'),
  },
];

export function stationForItem(name: string, category?: string | null): string {
  for (const s of KITCHEN_STATION_DEFS) {
    if (s.match(name, category)) return s.id;
  }
  return 'grill';
}

export type LiveStationView = {
  id: string;
  name: string;
  specializations: string[];
  status: 'available' | 'busy' | 'maintenance';
  chef: string;
  currentOrders: string[];
  activeCount: number;
  efficiency: number;
};

const ACTIVE = new Set(['pending', 'preparing', 'ready']);

export function buildLiveStationBoard(orders: FbOrderDto[]): LiveStationView[] {
  const byStation: Record<string, { orders: Set<string>; chefs: Set<string> }> = {};
  for (const def of KITCHEN_STATION_DEFS) {
    byStation[def.id] = { orders: new Set(), chefs: new Set() };
  }

  for (const order of orders) {
    if (!ACTIVE.has(order.status)) continue;
    const kitchenItems = order.items.filter(i => (i.route ?? 'kitchen') === 'kitchen');
    if (kitchenItems.length === 0) continue;

    const stationsHit = new Set<string>();
    for (const item of kitchenItems) {
      stationsHit.add(stationForItem(item.name, item.category));
    }
    for (const sid of stationsHit) {
      byStation[sid].orders.add(order.orderNumber);
      if (order.assignedToName) byStation[sid].chefs.add(order.assignedToName);
    }
  }

  return KITCHEN_STATION_DEFS.map(def => {
    const bucket = byStation[def.id];
    const activeCount = bucket.orders.size;
    const chef =
      bucket.chefs.size === 1
        ? [...bucket.chefs][0]
        : bucket.chefs.size > 1
          ? `${bucket.chefs.size} cooks`
          : 'Unassigned';
    return {
      id: def.id,
      name: def.name,
      specializations: def.specializations,
      status: activeCount >= 3 ? 'busy' : activeCount > 0 ? 'busy' : 'available',
      chef,
      currentOrders: [...bucket.orders],
      activeCount,
      efficiency: activeCount === 0 ? 100 : Math.max(55, 100 - activeCount * 12),
    };
  });
}

export function kitchenStats(orders: FbOrderDto[]) {
  const active = orders.filter(o => ACTIVE.has(o.status));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const servedToday = orders.filter(o => {
    if (o.status !== 'served' && o.status !== 'billed') return false;
    return new Date(o.servedAt || o.createdAt) >= today;
  });
  const prepTimes = servedToday
    .map(o => {
      const start = o.preparingAt ? new Date(o.preparingAt).getTime() : new Date(o.createdAt).getTime();
      const end = o.servedAt ? new Date(o.servedAt).getTime() : Date.now();
      return (end - start) / 60_000;
    })
    .filter(m => m > 0 && m < 180);
  const avgPrep =
    prepTimes.length > 0
      ? Math.round(prepTimes.reduce((a, b) => a + b, 0) / prepTimes.length)
      : 0;
  const urgent = active.filter(o => o.priority === 'urgent').length;
  return { activeCount: active.length, avgPrep, urgent, servedToday: servedToday.length };
}
