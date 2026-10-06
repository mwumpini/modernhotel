import { NextRequest, NextResponse } from 'next/server';
import { getHotel, markHotelPaid, removeHotel, setHotelModules, setHotelStatus, setHotelTrial } from '@/app/lib/platform/operator';
import { requireOperator } from '@/app/lib/platform/requireOperator';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireOperator();
  if (gate.error) return gate.error;
  const { id } = await params;
  const result = await getHotel(id);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 404 });
  return NextResponse.json(result.hotel);
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireOperator();
  if (gate.error) return gate.error;
  const { id } = await params;
  const result = await removeHotel(id);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireOperator();
  if (gate.error) return gate.error;
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  if (body?.paid === true) {
    const result = await markHotelPaid(id);
    if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json(result.hotel);
  }
  if (body?.trialDays != null) {
    const result = await setHotelTrial(id, body.trialDays);
    if (result.error) return NextResponse.json({ error: result.error }, { status: result.error === 'Hotel not found.' ? 404 : 400 });
    return NextResponse.json(result.hotel);
  }
  if (body?.modules && typeof body.modules === 'object') {
    const result = await setHotelModules(id, body.modules);
    if (result.error) return NextResponse.json({ error: result.error }, { status: 404 });
    return NextResponse.json(result.hotel);
  }
  if (body.status !== 'active' && body.status !== 'suspended') {
    return NextResponse.json({ error: 'Status must be active or suspended.' }, { status: 400 });
  }
  const result = await setHotelStatus(id, body.status);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 404 });
  return NextResponse.json(result.hotel);
}
