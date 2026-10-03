'use client';

import { useEffect } from 'react';
import { frontOfficeStore } from './store';

/** Reload reservations and folios on open, on window focus, and every 15 seconds. */
export function useFrontOfficeLiveRefresh() {
  useEffect(() => {
    frontOfficeStore.beginLiveRefresh();
    return () => frontOfficeStore.endLiveRefresh();
  }, []);
}
