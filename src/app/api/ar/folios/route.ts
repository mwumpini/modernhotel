import { NextRequest, NextResponse } from 'next/server'
import { getTenantContext, getTenantFromRequest } from '@/app/lib/api/tenant'
import { listFoliosWithBalancesByCustomer } from '@/app/lib/ar/repository'

export async function GET(request: NextRequest) {
	console.log('[ar/folios][GET] start')
	try {
		const subdomain = getTenantFromRequest(request)
		if (!subdomain) return NextResponse.json({ error: 'Missing tenant header' }, { status: 400 })
		const ctx = await getTenantContext(subdomain)
		if (!ctx) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

		const { searchParams } = new URL(request.url)
		const customerType = searchParams.get('customerType') as 'guest' | 'company' | null
		const customerId = searchParams.get('customerId')

		if (!customerType || !customerId) {
			return NextResponse.json({ error: 'customerType and customerId are required' }, { status: 400 })
		}

		const data = await listFoliosWithBalancesByCustomer(ctx.tenantId, customerType, customerId)
		console.log('[ar/folios][GET] result', { count: data.length })
		return NextResponse.json({ data })
	} catch (error) {
		console.error('[ar/folios][GET] error', error)
		return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
	}
}


