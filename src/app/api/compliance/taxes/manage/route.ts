import { NextRequest, NextResponse } from 'next/server'
import { getTenantFromRequest, getTenantContext } from '@/app/lib/api/tenant'
import { requireAuth } from '@/app/lib/api/auth-guard'
import { prisma } from '@/app/lib/database/client'

function validateTax(body: any) {
  if (!body) return 'Missing body'
  if (!body.code) return 'code is required'
  if (!body.name) return 'name is required'
  if (typeof body.rate !== 'number' || Number.isNaN(body.rate)) return 'rate must be a number'
  if (!body.type) return 'type is required'
  return null
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (!auth.ok) return auth.response
    const subdomain = getTenantFromRequest(request)
    if (!subdomain) return NextResponse.json({ error: 'Missing tenant header' }, { status: 400 })
    const ctx = await getTenantContext(subdomain)
    if (!ctx) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

    const body = await request.json()
    const err = validateTax(body)
    if (err) return NextResponse.json({ error: err }, { status: 400 })

    const tax = await prisma.tax.upsert({
      where: { tenantId_code: { tenantId: ctx.tenantId, code: body.code } },
      update: {
        name: body.name,
        rate: body.rate,
        type: body.type,
        isInclusive: body.isInclusive ?? false,
        isActive: body.isActive !== false,
      },
      create: {
        tenantId: ctx.tenantId,
        code: body.code,
        name: body.name,
        rate: body.rate,
        type: body.type,
        isInclusive: body.isInclusive ?? false,
        isActive: body.isActive !== false,
      },
    })

    return NextResponse.json(tax, { status: 201 })
  } catch (error) {
    console.error('[compliance/taxes/manage][POST] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (!auth.ok) return auth.response
    const subdomain = getTenantFromRequest(request)
    if (!subdomain) return NextResponse.json({ error: 'Missing tenant header' }, { status: 400 })
    const ctx = await getTenantContext(subdomain)
    if (!ctx) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    if (!code) return NextResponse.json({ error: 'code is required' }, { status: 400 })

    await prisma.tax.update({
      where: { tenantId_code: { tenantId: ctx.tenantId, code } },
      data: { isActive: false },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[compliance/taxes/manage][DELETE] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
