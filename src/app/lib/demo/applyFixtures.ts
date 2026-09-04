'use client';

/**
 * Applies demo fixtures into stores when settings are empty.
 * DELETE with the rest of `src/app/lib/demo` before production.
 */

import { useSettingsStore } from '../settings/store';
import { isDemoFixturesEnabled } from './index';
import {
  DEMO_RATE_PLANS,
  DEMO_ROOM_STATUSES,
  DEMO_ROOM_TYPES,
  DEMO_ROOMS,
} from './fixtures';

let applied = false;

/** Seed room types, rooms, rate plans, and statuses if not yet configured. */
export function applyDemoFixturesIfNeeded(): void {
  if (!isDemoFixturesEnabled() || applied) return;

  // This runs from a module-import-time microtask (see ./init.ts), which fires
  // before any component's useEffect — including the one that normally hydrates
  // this store from localStorage. Without loading first, the checks below see
  // only in-memory defaults (empty roomManagement) even when real settings were
  // already saved, and the saveSettings() call further down would then persist
  // that default state over the real one, wiping out everything the user saved
  // (including initialSetupCompleted) on every fresh page load.
  useSettingsStore.getState().loadSettings();

  const state = useSettingsStore.getState();
  const rm = state.roomManagement;
  const needsRoomTypes = (rm.roomTypes?.length ?? 0) === 0;
  const needsRooms = (rm.rooms?.length ?? 0) === 0;
  const needsRatePlans = (rm.ratePlans?.length ?? 0) === 0;
  const needsStatuses = (rm.roomStatuses?.length ?? 0) === 0;

  if (!needsRoomTypes && !needsRooms && !needsRatePlans && !needsStatuses) {
    applied = true;
    return;
  }

  useSettingsStore.setState({
    roomManagement: {
      ...rm,
      roomTypes: needsRoomTypes ? DEMO_ROOM_TYPES : rm.roomTypes,
      rooms: needsRooms ? DEMO_ROOMS : rm.rooms,
      ratePlans: needsRatePlans ? DEMO_RATE_PLANS : rm.ratePlans,
      roomStatuses: needsStatuses ? DEMO_ROOM_STATUSES : rm.roomStatuses,
      housekeepingEnabled: rm.housekeepingEnabled ?? true,
    },
  });

  state.saveSettings();
  state.publish();
  applied = true;
}
