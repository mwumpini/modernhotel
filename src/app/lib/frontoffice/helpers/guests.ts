'use client';

import type { GuestProfile } from '../types';

/**
 * Resolves a guest's mailing address for print documents (letter-style
 * recipient blocks, registration cards, folio statements, …) — was
 * duplicated as the same 2-3 line `guests.find(...)` + join independently
 * in check-ins, check-outs, and ReservationsBookingsManager print builders.
 * Returns undefined (rather than an empty string) when there's nothing to
 * show, matching how PrintGuestInfo.address is treated as optional.
 */
export function resolveGuestAddress(
  guests: Array<Pick<GuestProfile, 'id' | 'address' | 'city' | 'country'>>,
  guestId?: string | null,
): string | undefined {
  if (!guestId) return undefined;
  const guest = guests.find(g => g.id === guestId);
  if (!guest) return undefined;
  return [guest.address, guest.city, guest.country].filter(Boolean).join('\n') || undefined;
}

/**
 * Canonical individual-vs-corporate check — the single source of truth for "is this
 * guest a corporate client", replacing several inline heuristics that could disagree
 * with each other. `isCorporate` is authoritative when present (set by the Add/Edit
 * Client form); older records that predate that field may only have `companyName`
 * set, or (legacy data) a literal lastName === 'corporate' marker — both checked only
 * as a fallback when `isCorporate` itself is undefined.
 */
export function isCorporateGuest(
  guest: { isCorporate?: boolean; companyName?: string; lastName?: string } | undefined | null,
): boolean {
  if (!guest) return false;
  if (typeof guest.isCorporate === 'boolean') return guest.isCorporate;
  return !!guest.companyName || (guest.lastName || '').trim().toLowerCase() === 'corporate';
}
