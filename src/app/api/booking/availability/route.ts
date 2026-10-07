import { NextResponse } from 'next/server';
import { hotelForRequest, listWebsiteRooms, stayWindow } from '@/app/lib/booking/websiteBooking';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Api-Key',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: CORS });
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

/** Rooms still free for the dates. The hotel website sends the booking key. */
export async function GET(request: Request) {
  const auth = await hotelForRequest(request);
  if ('error' in auth) return json({ error: auth.error }, auth.status);
  const url = new URL(request.url);
  const window = stayWindow(url.searchParams.get('arrival'), url.searchParams.get('departure'));
  if ('error' in window) return json({ error: window.error }, 400);
  const guestsRaw = url.searchParams.get('guests');
  const guests = guestsRaw == null || guestsRaw === '' ? 1 : Number(guestsRaw);
  if (!Number.isInteger(guests) || guests < 1 || guests > 20) return json({ error: 'Guests must be a whole number from 1 to 20.' }, 400);
  const listed = await listWebsiteRooms(auth.hotel.id, window.arrival, window.departure, guests);
  return json({
    hotel: auth.hotel.name,
    arrival: window.arrival,
    departure: window.departure,
    nights: window.nights,
    currency: listed.currency,
    rooms: listed.rooms,
  });
}
