import { NextResponse } from 'next/server';
import { createWebsiteBooking, hotelForRequest, stayWindow } from '@/app/lib/booking/websiteBooking';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Api-Key',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: CORS });
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

/** Creates one unpaid reservation on the hotel's front desk. The hotel collects the money. */
export async function POST(request: Request) {
  const auth = await hotelForRequest(request);
  if ('error' in auth) return json({ error: auth.error }, auth.status);
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') return json({ error: 'Send the booking as JSON.' }, 400);
  const input = body as Record<string, unknown>;
  const window = stayWindow(input.arrival, input.departure);
  if ('error' in window) return json({ error: window.error }, 400);
  try {
    const result = await createWebsiteBooking(auth.hotel.id, {
      arrival: window.arrival,
      departure: window.departure,
      nights: window.nights,
      roomId: input.roomId,
      guestName: input.guestName,
      phone: input.phone,
      email: input.email,
      adults: input.adults,
      children: input.children,
      notes: input.notes,
    });
    if ('error' in result) return json({ error: result.error }, result.status);
    return json({ hotel: auth.hotel.name, ...result.booking }, 201);
  } catch (error) {
    console.error('Website booking failed', error);
    return json({ error: 'The booking could not be saved. Try again.' }, 500);
  }
}
