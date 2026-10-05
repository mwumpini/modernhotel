'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { EventsScreen } from './eventsScreenTypes';

/** Shared events dashboard state. Screen files under this folder read it. */
const ScreenContext = createContext<EventsScreen | null>(null);

export function EventsScreenProvider({ value, children }: { value: EventsScreen; children: ReactNode }) {
  return <ScreenContext.Provider value={value}>{children}</ScreenContext.Provider>;
}

export function useEventsScreen(): EventsScreen {
  const value = useContext(ScreenContext);
  if (!value) throw new Error('useEventsScreen must be used inside EventsScreenProvider');
  return value;
}
