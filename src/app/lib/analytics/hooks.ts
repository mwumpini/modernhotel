'use client';

import React from 'react';
import { analyticsEventStore } from './store';

export function useAnalyticsEvents() {
  const [tick, setTick] = React.useState(0);
  React.useEffect(() => {
    const unsub = analyticsEventStore.subscribe(() => setTick((t) => t + 1));
    return () => unsub();
  }, []);
  return { tick };
}


