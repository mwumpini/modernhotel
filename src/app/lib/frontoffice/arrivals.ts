import type { Reservation } from './types';
import { noShowCutoffReached } from './operationalPolicies';

export function isExpectedArrivalToday(
  reservation: Pick<Reservation, 'status' | 'arrival'>,
  businessDate: string,
): boolean {
  return (
    (reservation.status === 'confirmed' || reservation.status === 'pending') &&
    reservation.arrival.slice(0, 10) === businessDate
  );
}

/** Guest was due on or before business date but never checked in. The cutoff hour applies on the arrival day. */
export function canMarkNoShow(
  reservation: Pick<Reservation, 'status' | 'arrival'>,
  businessDate: string,
  options?: { now?: Date; cutoffHour?: number },
): boolean {
  const eligible =
    (reservation.status === 'confirmed' || reservation.status === 'pending') &&
    reservation.arrival.slice(0, 10) <= businessDate;
  if (!eligible) return false;
  if (options?.cutoffHour == null) return true;
  return noShowCutoffReached(reservation.arrival, options.cutoffHour, options.now ?? new Date());
}

export function filterTodaysArrivals<T extends Pick<Reservation, 'status' | 'arrival'>>(
  reservations: T[],
  businessDate: string,
): T[] {
  return reservations.filter((r) => isExpectedArrivalToday(r, businessDate));
}
