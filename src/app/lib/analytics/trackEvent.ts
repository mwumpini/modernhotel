'use client';

import { analyticsEventStore, createEvent } from './store';
import type { DomainEventMeta, DomainEventType } from './types';

export function trackEvent(type: DomainEventType, payload: Record<string, unknown> = {}, meta?: DomainEventMeta) {
  const evt = createEvent(type, payload, meta);
  analyticsEventStore.addEvent(evt);
  // In a real app, enqueue for background sync to API (with offline support)
  return evt;
}


