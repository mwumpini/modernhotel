import type { Reservation } from './types';

export function isExpectedArrivalToday(
  reservation: Pick<Reservation, 'status' | 'arrival'>,
  businessDate: string,
): boolean {
  return (
    (reservation.status === 'confirmed' || reservation.status === 'pending') &&
    reservation.arrival.slice(0, 10) === businessDate
  );
}

/** Guest was due on or before business date but never checked in. */
export function canMarkNoShow(
  reservation: Pick<Reservation, 'status' | 'arrival'>,
  businessDate: string,
): boolean {
  return (
    (reservation.status === 'confirmed' || reservation.status === 'pending') &&
    reservation.arrival.slice(0, 10) <= businessDate
  );
}

export function filterTodaysArrivals<T extends Pick<Reservation, 'status' | 'arrival'>>(
  reservations: T[],
  businessDate: string,
): T[] {
  return reservations.filter((r) => isExpectedArrivalToday(r, businessDate));
}
