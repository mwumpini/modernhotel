'use client';

/**
 * Client bootstrap for demo fixtures.
 * Imported once from Providers — delete with the demo folder.
 */

import { applyDemoFixturesIfNeeded } from './applyFixtures';

if (typeof window !== 'undefined') {
  queueMicrotask(() => applyDemoFixturesIfNeeded());
}
