import { NextRequest, NextResponse } from 'next/server'
import { getTenantFromRequest, getTenantContext } from '@/app/lib/api/tenant'
import { requireAuth } from '@/app/lib/api/auth-guard'
import { prisma } from '@/app/lib/database/client'

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (!auth.ok) return auth.response
    const subdomain = getTenantFromRequest(request)
    if (!subdomain) return NextResponse.json({ error: 'Missing tenant header' }, { status: 400 })
    const ctx = await getTenantContext(subdomain)
    if (!ctx) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || undefined

    const taxes = await prisma.tax.findMany({
      where: { tenantId: ctx.tenantId, ...(type ? { type } : {}) },
      orderBy: { code: 'asc' },
    })

    return NextResponse.json(taxes)
  } catch (error) {
    console.error('[compliance/taxes][GET] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
