'use client';

/**
 * Shared id generator for front-office domain records (charges, payments,
 * guests, reservations, events, invoices, ...). A base-36 timestamp plus a
 * random suffix — short and roughly sortable, but with a low enough collision
 * chance that two ids generated in the same millisecond won't match, unlike
 * the `Date.now().toString().slice(-N)` scheme this replaces (which kept only
 * the last few digits of the millisecond timestamp and collided immediately
 * whenever two records were created back-to-back — surfacing as React "two
 * children with the same key" errors wherever the id was used as a list key,
 * and as double-counted folio totals).
 */
export function genId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
}
