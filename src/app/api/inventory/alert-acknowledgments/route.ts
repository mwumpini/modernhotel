import { NextRequest, NextResponse } from 'next/server';
import { getTenantFromRequest, getTenantContext } from '@/app/lib/api/tenant';
import { requireAuth } from '@/app/lib/api/auth-guard';
import { listAlertAcknowledgments, upsertAlertAcknowledgment } from '@/app/lib/inventory/repository';

async function resolveTenantId(req: NextRequest): Promise<string | null> {
  const subdomain = getTenantFromRequest(req);
  if (!subdomain) return null;
  const ctx = await getTenantContext(subdomain);
  return ctx?.tenantId ?? null;
}

// GET - all acknowledged alert ids for the tenant
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (!auth.ok) return auth.response;
    const tenantId = await resolveTenantId(req);
    if (!tenantId) return NextResponse.json({ error: 'Missing or unknown tenant' }, { status: 400 });

    const acknowledgments = await listAlertAcknowledgments(tenantId);
    return NextResponse.json({ acknowledgments });
  } catch (error) {
    console.error('Error fetching alert acknowledgments:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - acknowledge one alert (deterministic alertId, e.g. "low_<itemId>")
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (!auth.ok) return auth.response;
    const tenantId = await resolveTenantId(req);
    if (!tenantId) return NextResponse.json({ error: 'Missing or unknown tenant' }, { status: 400 });

    const body = await req.json();
    if (!body.alertId || !body.acknowledgedBy) {
      return NextResponse.json({ error: 'Missing required fields: alertId, acknowledgedBy' }, { status: 400 });
    }

    const acknowledgment = await upsertAlertAcknowledgment(tenantId, body.alertId, body.acknowledgedBy);
    return NextResponse.json({ acknowledgment }, { status: 201 });
  } catch (error) {
    console.error('Error acknowledging alert:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
