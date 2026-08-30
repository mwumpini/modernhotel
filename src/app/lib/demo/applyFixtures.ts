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
