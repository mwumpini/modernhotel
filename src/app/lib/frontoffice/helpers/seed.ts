'use client';

/**
 * Demo seeding logic extracted from the front office store.
 * Keeps long constant data out of the class file while preserving behavior.
 */

import { buildDemoReservations, isDemoFixturesEnabled } from '../../demo';

type StoreLike = { reservations: unknown[] };

export function initializeSampleReservations(self: StoreLike) {
  if (!isDemoFixturesEnabled()) {
    self.reservations = [];
    return;
  }

  self.reservations = buildDemoReservations();
}
