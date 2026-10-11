'use client';

import { useEffect } from 'react';
import { frontOfficeStore } from './store';
import { useLiveChanges } from '../realtime/useLiveChanges';

/** Tables behind the front-desk screens: a save to any of them elsewhere refreshes them here. */
const FRONT_OFFICE_MODELS = [
  'Reservation', 'Guest', 'GuestFolio', 'Folio', 'FolioLine', 'Payment', 'NightAuditLog', 'TenantRecord:fo.*',
];

/**
 * Reload reservations and folios on open, on window focus, and the moment
 * another screen saves (live updates). Without live updates, every 15 seconds.
 */
export function useFrontOfficeLiveRefresh() {
  const live = useLiveChanges(FRONT_OFFICE_MODELS, () => { void frontOfficeStore.refreshFromApi({ force: true }); });
  useEffect(() => {
    frontOfficeStore.beginLiveRefresh();
    return () => frontOfficeStore.endLiveRefresh();
  }, []);
  useEffect(() => {
    frontOfficeStore.setLiveConnected(live);
  }, [live]);
}
