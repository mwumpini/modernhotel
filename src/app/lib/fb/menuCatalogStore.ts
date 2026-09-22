'use client';

/**
 * The real, distinct menu categories and item names currently configured in Menu &
 * Inventory (food/beverage/dessert/snack/special, or whatever gets added there later;
 * every real item name on the menu) — read from /api/fb/menu, the same source FBPOS's
 * own menu already uses. Report filters (see reportingStore.ts) need this rather than
 * deriving options from order history alone: a category/item with real menu entries but
 * no sales yet should still be selectable, and one nobody uses anymore shouldn't linger.
 */

import { create } from 'zustand';
import { getClientTenantSubdomain } from '../api/clientTenant';

interface MenuCatalogStore {
  categories: string[];
  items: string[];
  hydrated: boolean;
  hydrateFromApi: () => Promise<void>;
}

export const useMenuCatalogStore = create<MenuCatalogStore>((set) => ({
  categories: [],
  items: [],
  hydrated: false,
  hydrateFromApi: async () => {
    if (typeof window === 'undefined') return;
    try {
      const res = await fetch('/api/fb/menu', { headers: { 'x-tenant-subdomain': getClientTenantSubdomain() }, cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      const menuItems: Array<{ category?: string; name?: string }> = Array.isArray(data.items) ? data.items : [];
      const categories = Array.from(new Set(menuItems.map((i) => i.category).filter((c): c is string => !!c))).sort();
      const items = Array.from(new Set(menuItems.map((i) => i.name).filter((n): n is string => !!n))).sort();
      set({ categories, items, hydrated: true });
    } catch (e) {
      console.warn('[FB] menuCatalogStore hydrateFromApi failed:', e);
    }
  },
}));
