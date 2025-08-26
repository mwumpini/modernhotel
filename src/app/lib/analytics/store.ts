'use client';

import { AnyDomainEvent, DomainEvent } from './types';

// In-memory event store for SPA usage. In a real app, mirror to server.
class AnalyticsEventStore {
  private events: AnyDomainEvent[] = [];
  private listeners: Array<() => void> = [];

  addEvent(event: AnyDomainEvent) {
    this.events.push(event);
    this.listeners.forEach((l) => l());
  }

  getEvents() {
    return [...this.events];
  }

  clear() {
    this.events = [];
    this.listeners.forEach((l) => l());
  }

  subscribe(listener: () => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }
}

export const analyticsEventStore = new AnalyticsEventStore();

export function createEvent<TPayload>(type: DomainEvent['type'], payload: TPayload, meta?: DomainEvent['meta']): AnyDomainEvent {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    type,
    timestamp: new Date().toISOString(),
    payload,
    meta,
  };
}


