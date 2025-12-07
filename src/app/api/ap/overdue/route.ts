import { NextRequest, NextResponse } from 'next/server'
import { getTenantContext, getTenantFromRequest } from '@/app/lib/api/tenant'
import { listOverdueVouchers } from '@/app/lib/expenses/repository'

export async function GET(request: NextRequest) {
	console.log('[ap/overdue][GET] start')
	try {
		const subdomain = getTenantFromRequest(request)
		if (!subdomain) return NextResponse.json({ error: 'Missing tenant header' }, { status: 400 })
		const ctx = await getTenantContext(subdomain)
		if (!ctx) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

		const { searchParams } = new URL(request.url)
		const days = Math.max(parseInt(searchParams.get('days') || '30', 10) || 30, 1)

		const data = await listOverdueVouchers(ctx.tenantId, days)
		console.log('[ap/overdue][GET] result', { count: data.length })
		return NextResponse.json({ data, days })
	} catch (error) {
		console.error('[ap/overdue][GET] error', error)
		return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
	}
}


