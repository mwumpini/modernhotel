'use client';

import { useSettingsStore } from '../settings/store';
import { DEFAULT_PROPERTY_TIMEZONE } from './propertyTime';

/** Resolve hotel timezone from settings (tenant → user preference → Accra default). */
export function resolvePropertyTimezone(): string {
  try {
    const s = useSettingsStore.getState();
    return (
      s.tenant?.metadata?.timezone ||
      s.currentUser?.preferences?.timezone ||
      DEFAULT_PROPERTY_TIMEZONE
    );
  } catch {
    return DEFAULT_PROPERTY_TIMEZONE;
  }
}
