import { NextRequest, NextResponse } from 'next/server';
import { listHotels, openHotel, type HotelHosting } from '@/app/lib/platform/operator';
import { requireOperator } from '@/app/lib/platform/requireOperator';

export async function GET() {
  const gate = await requireOperator();
  if (gate.error) return gate.error;
  const hotels = await listHotels();
  return NextResponse.json({ hotels });
}

export async function POST(request: NextRequest) {
  const gate = await requireOperator();
  if (gate.error) return gate.error;
  const body = await request.json().catch(() => ({}));
  const result = await openHotel({
    name: String(body.name || ''),
    subdomain: String(body.subdomain || ''),
    hosting: (body.hosting === 'local' || body.hosting === 'sync' ? body.hosting : 'cloud') as HotelHosting,
    monthlyFee: body.monthlyFee,
    adminName: String(body.adminName || ''),
    adminEmail: String(body.adminEmail || ''),
    password: String(body.password || ''),
  });
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json(result.hotel, { status: 201 });
}
