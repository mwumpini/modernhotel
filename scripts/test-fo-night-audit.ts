import {
  getRoomChargeDatesOnFolio,
  isRoomLine,
  postRoomChargeForDate,
} from '../src/app/lib/frontoffice/roomCharges';
import {
  canMarkNoShow,
  filterTodaysArrivals,
  isExpectedArrivalToday,
} from '../src/app/lib/frontoffice/arrivals';
import {
  hasCompletedNightAuditForDate,
  isNightAuditScheduleWindow,
} from '../src/app/lib/frontoffice/nightAudit';
import { getZonedClockParts, formatPropertyClockStamp } from '../src/app/lib/frontoffice/propertyTime';
import {
  isAuthoritativeRevenueSource,
} from '../src/app/lib/accounting/revenueSourcePolicy';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

// Room line detection
assert(isRoomLine('Room Charge'), 'room line');
assert(!isRoomLine('Restaurant'), 'non-room');

// Folio date dedup set
{
  const dates = getRoomChargeDatesOnFolio({
    charges: [
      { description: 'Room Charge', date: '2026-06-01' },
      { description: 'Room Charge', date: '2026-06-02' },
      { description: 'F&B lunch', date: '2026-06-01' },
    ],
  });
  assert(dates.size === 2, `folio dates ${dates.size}`);
  assert(dates.has('2026-06-01'), 'has jun 1');
}

// Idempotent room charge posting
{
  let chargeCount = 0;
  const mockStore = {
    reservations: [
      {
        id: 'R-1',
        status: 'checked-in',
        arrival: '2026-06-01',
        departure: '2026-06-04',
        roomTypeId: 'rt-1',
        rateBreakdown: [{ date: '2026-06-01', base: 500, total: 575 }],
      },
    ],
    getOrCreateFolio: () => ({
      id: 'F-1',
      charges: chargeCount
        ? [{ description: 'Room Charge', date: '2026-06-01', amount: 500 }]
        : [],
    }),
    addFolioCharge: () => {
      chargeCount += 1;
    },
    updateFolioBalances: () => {},
    calculateRateBreakdown: () => [{ date: '2026-06-01', base: 500, total: 575 }],
    ratePlans: [],
  };
  const first = postRoomChargeForDate(mockStore as any, 'R-1', '2026-06-01');
  const second = postRoomChargeForDate(mockStore as any, 'R-1', '2026-06-01');
  assert(first === true, 'first post');
  assert(second === false, 'duplicate skipped');
  assert(chargeCount === 1, `charge count ${chargeCount}`);
}

// Arrivals helpers
{
  const r = { status: 'confirmed' as const, arrival: '2026-06-05' };
  assert(isExpectedArrivalToday(r, '2026-06-05'), 'expected today');
  assert(!isExpectedArrivalToday(r, '2026-06-06'), 'not today');
  assert(canMarkNoShow(r, '2026-06-05'), 'can no-show today');
  assert(canMarkNoShow({ status: 'confirmed', arrival: '2026-06-04' }, '2026-06-05'), 'past arrival');
  assert(!canMarkNoShow({ status: 'checked-in', arrival: '2026-06-05' }, '2026-06-05'), 'checked-in excluded');
  const list = filterTodaysArrivals(
    [
      { status: 'confirmed', arrival: '2026-06-05' },
      { status: 'pending', arrival: '2026-06-06' },
    ] as any,
    '2026-06-05',
  );
  assert(list.length === 1, `arrivals filter ${list.length}`);
}

// Night audit completion check
{
  const store = {
    nightAuditHistory: [
      { businessDate: '2026-06-04', status: 'completed' as const, id: '1', completedAt: '', roomChargesPosted: 0, noShowsProcessed: 0, checkedInCount: 0, folioChargesTotal: 0, folioPaymentsTotal: 0 },
      { businessDate: '2026-06-05', status: 'failed' as const, id: '2', completedAt: '', roomChargesPosted: 0, noShowsProcessed: 0, checkedInCount: 0, folioChargesTotal: 0, folioPaymentsTotal: 0 },
    ],
  };
  assert(hasCompletedNightAuditForDate(store, '2026-06-04'), 'completed found');
  assert(!hasCompletedNightAuditForDate(store, '2026-06-05'), 'failed not completed');
}

// Property timezone window (Africa/Accra — 1:00 local)
{
  const tz = 'Africa/Accra';
  const oneAm = new Date('2026-06-01T01:01:00+00:00');
  assert(isNightAuditScheduleWindow(oneAm, tz), '1am Accra window');
  const noon = new Date('2026-06-01T12:00:00+00:00');
  assert(!isNightAuditScheduleWindow(noon, tz), 'noon outside window');
  const parts = getZonedClockParts(oneAm, tz);
  assert(parts.hour === 1, `hour ${parts.hour}`);
  assert(formatPropertyClockStamp(oneAm, tz).includes('1:01'), `stamp ${formatPropertyClockStamp(oneAm, tz)}`);
}

// Revenue source classification. Note: no longer wired into the financial-report
// rollup itself — a line-level exclusion there let a non-authoritative entry's
// Revenue line drop while its Asset/AR lines stayed in, breaking debit=credit for
// the Trial Balance/Balance Check. Every posted entry's lines are now included in
// full; this classification remains for other policy decisions only.
{
  assert(isAuthoritativeRevenueSource('front_office_checkout'), 'checkout ok');
  assert(!isAuthoritativeRevenueSource('front_office'), 'fo builder excluded');
}

console.log('All front-office night-audit regression checks passed.');
