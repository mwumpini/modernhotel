/**
 * Demo fixtures — import from here for test names, room types, etc.
 *
 * To remove all demo data later:
 *   1. Delete the `src/app/lib/demo` folder
 *   2. Remove `import '../lib/demo/init'` from Providers.tsx
 *   3. Remove demo imports from frontoffice store / seed helpers
 *
 * Enable explicitly: NEXT_PUBLIC_DEMO_MODE=true
 * Disabled in production unless that flag is set.
 */

export function isDemoFixturesEnabled(): boolean {
  if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true') return true;
  if (process.env.NEXT_PUBLIC_DEMO_MODE === 'false') return false;
  return process.env.NODE_ENV === 'development';
}

export {
  DEMO_HOTEL,
  DEMO_ROOM_TYPE_IDS,
  DEMO_RATE_PLAN_IDS,
  DEMO_ROOM_TYPES,
  DEMO_ROOMS,
  DEMO_ROOM_STATUSES,
  DEMO_RATE_PLANS,
  DEMO_GUEST_PERSONAS,
  DEMO_BILLING_PERSONS,
  DEMO_HOUSEKEEPING_STAFF,
  DEMO_MARKET_CODES,
  DEMO_PAYMENT_METHODS,
  DEMO_STAY_REASONS,
  DEMO_RESERVATION_IDS,
  buildDemoReservations,
} from './fixtures';

export type { DemoGuestPersona } from './fixtures';

export { applyDemoFixturesIfNeeded } from './applyFixtures';
