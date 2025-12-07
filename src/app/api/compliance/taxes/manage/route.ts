import { NextRequest, NextResponse } from 'next/server';
import { ComplianceDB } from '@/app/lib/compliance/db';

export const runtime = 'nodejs';

function validateRule(body: any) {
  if (!body) return 'Missing body';
  if (!body.countryCode) return 'countryCode is required';
  if (!body.name) return 'name is required';
  if (typeof body.rate !== 'number' || Number.isNaN(body.rate)) return 'rate must be a number';
  if (!body.glCode) return 'glCode is required';
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const err = validateRule(body);
    if (err) return NextResponse.json({ error: err }, { status: 400 });
    const saved = ComplianceDB.upsertTax({
      countryCode: body.countryCode,
      typeId: body.typeId,
      name: body.name,
      rate: body.rate,
      glCode: body.glCode,
      appliesTo: Array.isArray(body.appliesTo) ? body.appliesTo : ['ALL'],
      description: body.description,
      enabled: body.enabled !== false,
      priority: body.priority,
      calculationBase: body.calculationBase,
      stacking: body.stacking,
      rounding: body.rounding,
      roundTo: body.roundTo,
      effectiveFrom: body.effectiveFrom,
      effectiveTo: body.effectiveTo,
      isSeparate: body.isSeparate === true,
      method: body.method,
      fixedAmount: body.fixedAmount,
      tiers: body.tiers,
      domain: body.domain,
      operation: body.operation,
      effect: body.effect,
      tags: Array.isArray(body.tags) ? body.tags : undefined
    });
    console.log('[API] POST /api/compliance/taxes/manage', saved);
    return NextResponse.json(saved, { status: 201 });
  } catch (e: any) {
    console.error('[API] POST /api/compliance/taxes/manage error', e);
    return NextResponse.json({ error: e?.message || 'Failed to save tax' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
    const err = validateRule(body);
    if (err) return NextResponse.json({ error: err }, { status: 400 });
    const saved = ComplianceDB.upsertTax({
      id: body.id,
      countryCode: body.countryCode,
      typeId: body.typeId,
      name: body.name,
      rate: body.rate,
      glCode: body.glCode,
      appliesTo: Array.isArray(body.appliesTo) ? body.appliesTo : ['ALL'],
      description: body.description,
      enabled: body.enabled !== false,
      priority: body.priority,
      calculationBase: body.calculationBase,
      stacking: body.stacking,
      rounding: body.rounding,
      roundTo: body.roundTo,
      effectiveFrom: body.effectiveFrom,
      effectiveTo: body.effectiveTo,
      isSeparate: body.isSeparate === true,
      method: body.method,
      fixedAmount: body.fixedAmount,
      tiers: body.tiers,
      domain: body.domain,
      operation: body.operation,
      effect: body.effect,
      tags: Array.isArray(body.tags) ? body.tags : undefined
    });
    console.log('[API] PUT /api/compliance/taxes/manage', saved);
    return NextResponse.json(saved);
  } catch (e: any) {
    console.error('[API] PUT /api/compliance/taxes/manage error', e);
    return NextResponse.json({ error: e?.message || 'Failed to update tax' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
    const result = ComplianceDB.deleteTax(id);
    console.log('[API] DELETE /api/compliance/taxes/manage', result);
    return NextResponse.json(result);
  } catch (e: any) {
    console.error('[API] DELETE /api/compliance/taxes/manage error', e);
    return NextResponse.json({ error: e?.message || 'Failed to delete tax' }, { status: 500 });
  }
}


