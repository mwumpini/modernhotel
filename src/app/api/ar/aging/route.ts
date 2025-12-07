import { NextRequest, NextResponse } from 'next/server'
import { getTenantContext, getTenantFromRequest } from '@/app/lib/api/tenant'
import { getAgingBuckets } from '@/app/lib/ar/repository'

export async function GET(request: NextRequest) {
	console.log('[ar/aging][GET] start')
	try {
		const subdomain = getTenantFromRequest(request)
		if (!subdomain) return NextResponse.json({ error: 'Missing tenant header' }, { status: 400 })
		const ctx = await getTenantContext(subdomain)
		if (!ctx) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

		const { searchParams } = new URL(request.url)
		const asOfParam = searchParams.get('asOf')
		const bucketsParam = searchParams.get('buckets') // e.g., "0,30,60,90,120"

		const asOf = asOfParam ? new Date(asOfParam) : new Date()
		const buckets = bucketsParam ? bucketsParam.split(',').map(s => parseInt(s.trim(), 10)).filter(n => Number.isFinite(n)) : undefined

		const data = await getAgingBuckets(ctx.tenantId, asOf, buckets)
		console.log('[ar/aging][GET] result', { buckets: data.length })
		return NextResponse.json({ data, asOf })
	} catch (error) {
		console.error('[ar/aging][GET] error', error)
		return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
	}
}


