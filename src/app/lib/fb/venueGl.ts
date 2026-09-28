/**
 * Venue → postable F&B revenue leaf (CoA children under 4200).
 * Shared by order APIs, folio checkout, and POS accounting capture.
 */
export function venueGlAccount(venue: string | null | undefined): string {
  switch (String(venue || '').toLowerCase().replace(/\s+/g, '_')) {
    case 'restaurant':
      return '4210';
    case 'bar':
    case 'pool_bar':
      return '4220';
    case 'room_service':
      return '4230';
    default:
      return '4200';
  }
}

/** Departmental POS source → same venue leaves. */
export function departmentSourceGlAccount(
  source: 'restaurant' | 'bar' | 'room_service' | string,
): string {
  switch (source) {
    case 'restaurant':
      return '4210';
    case 'bar':
      return '4220';
    case 'room_service':
      return '4230';
    default:
      return '4200';
  }
}
