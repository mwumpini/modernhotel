import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/app/lib/api/auth-guard';
import { ComplianceDB } from '@/app/lib/compliance/db';

function validateType(body: Record<string, unknown>): string | null {
  if (!body) return 'Missing body';
  if (!body.countryCode) return 'countryCode is required';
  if (!body.name || !String(body.name).trim()) return 'name is required';
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;

    const body = await request.json();
    const err = validateType(body);
    if (err) return NextResponse.json({ error: err }, { status: 400 });

    const saved = ComplianceDB.upsertTaxType(body);
    return NextResponse.json(saved, { status: 201 });
  } catch (error) {
    console.error('[compliance/tax-types/manage][POST] error', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;

    const body = await request.json();
    if (!body.id) return NextResponse.json({ error: 'id is required for update' }, { status: 400 });
    const err = validateType(body);
    if (err) return NextResponse.json({ error: err }, { status: 400 });

    const saved = ComplianceDB.upsertTaxType(body);
    return NextResponse.json(saved);
  } catch (error) {
    console.error('[compliance/tax-types/manage][PUT] error', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    const result = ComplianceDB.deleteTaxType(id);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[compliance/tax-types/manage][DELETE] error', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
