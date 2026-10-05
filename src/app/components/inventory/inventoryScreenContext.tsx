'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { InventoryScreen } from './inventoryScreenTypes';

/** Shared inventory dashboard state. Screen files under this folder read it. */
const ScreenContext = createContext<InventoryScreen | null>(null);

export function InventoryScreenProvider({ value, children }: { value: InventoryScreen; children: ReactNode }) {
  return <ScreenContext.Provider value={value}>{children}</ScreenContext.Provider>;
}

export function useInventoryScreen(): InventoryScreen {
  const value = useContext(ScreenContext);
  if (!value) throw new Error('useInventoryScreen must be used inside InventoryScreenProvider');
  return value;
}
