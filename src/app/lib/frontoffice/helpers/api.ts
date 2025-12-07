'use client';

/**
 * API helpers for the Front Office store.
 * These functions keep network mapping logic out of the store class, so the
 * store remains concise and easier to test.
 */

type StoreLike = any;

export async function syncReservationsFromApi(self: StoreLike, tenantSubdomain: string) {
  try {
    const res = await fetch('/api/reservations', {
      headers: { 'x-tenant-subdomain': tenantSubdomain }
    });
    if (!res.ok) return;
    const data = await res.json();
    const mapped = (data.reservations || []).map((r: any) => ({
      id: r.id,
      guestId: r.guestId,
      guestName: r.guest?.name || 'Guest',
      roomTypeId: 'rt-standard',
      ratePlanId: undefined,
      arrival: new Date(r.checkInDate).toISOString(),
      departure: new Date(r.checkOutDate).toISOString(),
      status: (r.status as any) || 'pending',
      source: r.source || 'Direct',
      roomId: r.roomId || undefined,
      adults: r.adults ?? 1,
      children: r.children ?? 0,
      isGuaranteed: false,
      remarksToGuest: undefined,
      marketCodes: [],
      internalNotes: undefined,
      stayReason: 'personal',
      createdAt: r.createdAt,
      updatedAt: r.updatedAt
    }));
    self.reservations = mapped;
    self.notify();
  } catch (e) {
    console.error('Failed to sync reservations from API', e);
  }
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
    const guestResp = await fetch('/api/guests', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-tenant-subdomain': tenantSubdomain
      },
      body: JSON.stringify({
        name: payload.guestName,
        phone: payload.guestPhone,
        email: payload.guestEmail,
        nationality: 'Ghana'
      })
    });
    if (!guestResp.ok) throw new Error('Failed to create guest');
    const guest = await guestResp.json();

    const resResp = await fetch('/api/reservations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-tenant-subdomain': tenantSubdomain
      },
      body: JSON.stringify({
        guestId: guest.id,
        checkInDate: payload.arrival,
        checkOutDate: payload.departure,
        adults: payload.adults ?? 1,
        children: payload.children ?? 0,
        status: 'confirmed',
        source: payload.source || 'Direct'
      })
    });
    if (!resResp.ok) throw new Error('Failed to create reservation');
    await syncReservationsFromApi(self, tenantSubdomain);
  } catch (e) {
    console.error('Failed to create reservation via API', e);
  }
}


