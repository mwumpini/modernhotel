'use client';

/**
 * API helpers for the Front Office store.
 *
 * The server returns reservations and guests already shaped as the store's
 * domain types (see lib/frontoffice/repository.ts), so these helpers just move
 * data across the network without any lossy re-mapping.
 */

type StoreLike = any;

const tenantHeaders = (tenantSubdomain: string) => ({
  'Content-Type': 'application/json',
  'x-tenant-subdomain': tenantSubdomain,
});

const errorFrom = async (res: Response, fallback: string) => {
  const body = await res.json().catch(() => ({}));
  return new Error(body?.error || fallback);
};

export async function syncReservationsFromApi(self: StoreLike, tenantSubdomain: string) {
  try {
    const res = await fetch('/api/reservations', {
      headers: { 'x-tenant-subdomain': tenantSubdomain },
    });
    if (!res.ok) return;
    const data = await res.json();
    self.reservations = data.reservations || [];
    self.notify();
  } catch (e) {
    console.error('Failed to sync reservations from API', e);
  }
}

export async function syncFoliosFromApi(self: StoreLike, tenantSubdomain: string) {
  try {
    const res = await fetch('/api/folios', {
      headers: { 'x-tenant-subdomain': tenantSubdomain },
    });
    if (!res.ok) return;
    const data = await res.json();
    if (Array.isArray(data.folios) && data.folios.length > 0) {
      const byId = new Map<string, any>();
      self.folios.forEach((f: any) => byId.set(f.id, f));
      data.folios.forEach((f: any) => byId.set(f.id, f));
      self.folios = Array.from(byId.values());
      self.notify();
    }
  } catch (e) {
    console.error('Failed to sync folios from API', e);
  }
}

export async function upsertFolioViaApi(_self: StoreLike, tenantSubdomain: string, folio: any) {
  const res = await fetch('/api/folios', {
    method: 'PUT',
    headers: tenantHeaders(tenantSubdomain),
    body: JSON.stringify(folio),
  });
  if (!res.ok) throw await errorFrom(res, 'Failed to upsert folio');
  const { folio: saved } = await res.json();
  return saved;
}

export async function syncGuestsFromApi(self: StoreLike, tenantSubdomain: string) {
  try {
    const res = await fetch('/api/guests', {
      headers: { 'x-tenant-subdomain': tenantSubdomain },
    });
    if (!res.ok) return;
    const data = await res.json();
    if (Array.isArray(data.guests)) {
      self.guests = data.guests;
      self.notify();
    }
  } catch (e) {
    console.error('Failed to sync guests from API', e);
  }
}

export async function createReservationViaApi(_self: StoreLike, tenantSubdomain: string, reservation: any) {
  const res = await fetch('/api/reservations', {
    method: 'POST',
    headers: tenantHeaders(tenantSubdomain),
    body: JSON.stringify(reservation),
  });
  if (!res.ok) throw await errorFrom(res, 'Failed to create reservation');
  const { reservation: created } = await res.json();
  return created;
}

export async function updateReservationViaApi(_self: StoreLike, tenantSubdomain: string, id: string, patch: any) {
  const res = await fetch(`/api/reservations/${id}`, {
    method: 'PATCH',
    headers: tenantHeaders(tenantSubdomain),
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw await errorFrom(res, 'Failed to update reservation');
  const { reservation } = await res.json();
  return reservation;
}

export async function createGuestViaApi(_self: StoreLike, tenantSubdomain: string, guest: any) {
  const res = await fetch('/api/guests', {
    method: 'POST',
    headers: tenantHeaders(tenantSubdomain),
    body: JSON.stringify(guest),
  });
  if (!res.ok) throw await errorFrom(res, 'Failed to create guest');
  const { guest: created } = await res.json();
  return created;
}

export async function createGuestAndReservationViaApi(self: StoreLike, tenantSubdomain: string, payload: {
  guestName: string;
  guestPhone?: string;
  guestEmail?: string;
  arrival: string;
  departure: string;
  adults?: number;
  children?: number;
  source?: string;
}) {
  try {
    const guest = await createGuestViaApi(self, tenantSubdomain, {
      name: payload.guestName,
      phone: payload.guestPhone,
      email: payload.guestEmail,
      nationality: 'ghanaian',
    });
    await createReservationViaApi(self, tenantSubdomain, {
      guestId: guest.id,
      guestName: payload.guestName,
      arrival: payload.arrival,
      departure: payload.departure,
      adults: payload.adults ?? 1,
      children: payload.children ?? 0,
      status: 'confirmed',
      source: payload.source || 'Direct',
    });
    await syncReservationsFromApi(self, tenantSubdomain);
  } catch (e) {
    console.error('Failed to create reservation via API', e);
  }
}
