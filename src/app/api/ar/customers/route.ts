import { NextRequest, NextResponse } from 'next/server'
import { getTenantContext, getTenantFromRequest } from '@/app/lib/api/tenant'
import { listCustomerBalances } from '@/app/lib/ar/repository'
import { operationalArResponse } from '@/app/lib/ar/operationalResponse'

export async function GET(request: NextRequest) {
	console.log('[ar/customers][GET] start (guest ledger — not finance AR)')
	try {
		const subdomain = getTenantFromRequest(request)
		if (!subdomain) return NextResponse.json({ error: 'Missing tenant header' }, { status: 400 })
		const ctx = await getTenantContext(subdomain)
		if (!ctx) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

		const { searchParams } = new URL(request.url)
		const type = (searchParams.get('type') as 'all' | 'guest' | 'company') || 'all'

		const data = await listCustomerBalances(ctx.tenantId, type)
		console.log('[ar/customers][GET] result', { count: data.length })
		return NextResponse.json(operationalArResponse(data))
	} catch (error) {
		console.error('[ar/customers][GET] error', error)
		return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
	}
}


