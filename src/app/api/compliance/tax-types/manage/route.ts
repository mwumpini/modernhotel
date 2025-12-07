import { NextRequest, NextResponse } from 'next/server';
import { ComplianceDB } from '@/app/lib/compliance/db';

export const runtime = 'nodejs';

function validateType(body: any) {
  if (!body) return 'Missing body';
  if (!body.countryCode) return 'countryCode is required';
  if (!body.name) return 'name is required';
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const err = validateType(body);
    if (err) return NextResponse.json({ error: err }, { status: 400 });
    const saved = ComplianceDB.upsertTaxType({
      countryCode: body.countryCode,
      name: body.name,
      description: body.description,
      domain: body.domain,
      operation: body.operation,
      tags: Array.isArray(body.tags) ? body.tags : undefined
    });
    console.log('[API] POST /api/compliance/tax-types/manage', saved);
    return NextResponse.json(saved, { status: 201 });
  } catch (e: any) {
    console.error('[API] POST /api/compliance/tax-types/manage error', e);
    return NextResponse.json({ error: e?.message || 'Failed to save tax type' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
    const err = validateType(body);
    if (err) return NextResponse.json({ error: err }, { status: 400 });
    const saved = ComplianceDB.upsertTaxType({
      id: body.id,
      countryCode: body.countryCode,
      name: body.name,
      description: body.description,
      domain: body.domain,
      operation: body.operation,
      tags: Array.isArray(body.tags) ? body.tags : undefined
    });
    console.log('[API] PUT /api/compliance/tax-types/manage', saved);
    return NextResponse.json(saved);
  } catch (e: any) {
    console.error('[API] PUT /api/compliance/tax-types/manage error', e);
    return NextResponse.json({ error: e?.message || 'Failed to update tax type' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
    const result = ComplianceDB.deleteTaxType(id);
    console.log('[API] DELETE /api/compliance/tax-types/manage', result);
    return NextResponse.json(result);
  } catch (e: any) {
    console.error('[API] DELETE /api/compliance/tax-types/manage error', e);
    return NextResponse.json({ error: e?.message || 'Failed to delete tax type' }, { status: 500 });
  }
}


