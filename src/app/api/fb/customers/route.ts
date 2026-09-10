import { NextRequest, NextResponse } from 'next/server'
import { getTenantFromRequest, getTenantContext, createAuditLog } from '@/app/lib/api/tenant'
import { requireAuth } from '@/app/lib/api/auth-guard'
import { listFBCustomers, upsertFBCustomer, recordFBCustomerVisit } from '@/app/lib/fb/customersRepository'

async function resolveTenant(req: NextRequest) {
  const subdomain = getTenantFromRequest(req)
  if (!subdomain) return null
  return getTenantContext(subdomain)
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (!auth.ok) return auth.response
    const ctx = await resolveTenant(request)
    if (!ctx) return NextResponse.json({ error: 'Missing or unknown tenant' }, { status: 400 })
    const customers = await listFBCustomers(ctx.tenantId)
    return NextResponse.json({ customers })
  } catch (error) {
    console.error('[fb/customers][GET] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (!auth.ok) return auth.response
    const ctx = await resolveTenant(request)
    if (!ctx) return NextResponse.json({ error: 'Missing or unknown tenant' }, { status: 400 })
    const body = await request.json()
    if (!body.id) return NextResponse.json({ error: 'id is required' }, { status: 400 })
    if (!body.firstName || !body.lastName) return NextResponse.json({ error: 'firstName and lastName are required' }, { status: 400 })
    const customer = await upsertFBCustomer(ctx.tenantId, body.id, body)
    await createAuditLog(ctx.tenantId, null, 'FB_CUSTOMER_SAVED', 'FBCustomer', body.id, undefined, { name: `${customer.firstName} ${customer.lastName}` }, request)
    return NextResponse.json({ customer })
  } catch (error) {
    console.error('[fb/customers][POST] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// PATCH — record a visit (increments visitCount/totalSpent/loyaltyPoints atomically)
export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (!auth.ok) return auth.response
    const ctx = await resolveTenant(request)
    if (!ctx) return NextResponse.json({ error: 'Missing or unknown tenant' }, { status: 400 })
    const body = await request.json()
    if (!body.id) return NextResponse.json({ error: 'id is required' }, { status: 400 })
    if (typeof body.orderAmount !== 'number') return NextResponse.json({ error: 'orderAmount (number) is required' }, { status: 400 })
    const customer = await recordFBCustomerVisit(ctx.tenantId, body.id, body.orderAmount)
    if (!customer) return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    return NextResponse.json({ customer })
  } catch (error) {
    console.error('[fb/customers][PATCH] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
