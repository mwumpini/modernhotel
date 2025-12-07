import { NextRequest, NextResponse } from 'next/server'
import { getTenantFromRequest, getTenantContext } from '@/app/lib/api/tenant'
import { searchCustomers } from '@/app/lib/customer/repository'

export async function GET(request: NextRequest) {
	console.log('[customers][GET] start')

	try {
		const subdomain = getTenantFromRequest(request)
		if (!subdomain) {
			console.warn('[customers][GET] missing x-tenant-subdomain header')
			return NextResponse.json({ error: 'Missing tenant header' }, { status: 400 })
		}

		const ctx = await getTenantContext(subdomain)
		if (!ctx) {
			console.warn('[customers][GET] tenant not found for subdomain', { subdomain })
			return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
		}

		const { searchParams } = new URL(request.url)
		const q = searchParams.get('q') || undefined
		const type = (searchParams.get('type') as 'guest' | 'company' | 'all') || 'all'
		const page = Math.max(parseInt(searchParams.get('page') || '1', 10) || 1, 1)
		const pageSize = Math.min(Math.max(parseInt(searchParams.get('pageSize') || '25', 10) || 25, 1), 100)

		console.log('[customers][GET] params', { subdomain, tenantId: ctx.tenantId, q, type, page, pageSize })

		const unified = await searchCustomers({ tenantId: ctx.tenantId, q, type, take: page * pageSize })

		const start = (page - 1) * pageSize
		const end = start + pageSize
		const data = unified.slice(start, end)

		console.log('[customers][GET] result', { total: unified.length, returned: data.length })
		return NextResponse.json({
			data,
			page,
			pageSize,
			total: unified.length,
		})
	} catch (error) {
		console.error('[customers][GET] error', error)
		return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
	}
}


