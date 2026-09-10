import { NextRequest, NextResponse } from 'next/server'
import { getTenantFromRequest, getTenantContext } from '@/app/lib/api/tenant'
import { requireAuth } from '@/app/lib/api/auth-guard'
import {
  listComplianceReportFilings,
  upsertComplianceReportFilingByKey,
  updateComplianceReportFilingById,
} from '@/app/lib/compliance/repository'

async function resolveTenant(req: NextRequest) {
  const subdomain = getTenantFromRequest(req)
  if (!subdomain) return null
  return getTenantContext(subdomain)
}

// GET /api/compliance/report-filings?country=GH — this tenant's filing status records
// (distinct from /api/compliance/reports, which serves the shared filing-schedule reference
// data, not per-tenant filing status).
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (!auth.ok) return auth.response
    const ctx = await resolveTenant(request)
    if (!ctx) return NextResponse.json({ error: 'Missing or unknown tenant' }, { status: 400 })

    const { searchParams } = new URL(request.url)
    const country = searchParams.get('country') || undefined
    const filings = await listComplianceReportFilings(ctx.tenantId, country)
    return NextResponse.json({ filings })
  } catch (error) {
    console.error('[compliance/report-filings][GET] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// POST /api/compliance/report-filings — create-or-update by (country, reportType, period),
// mirrors the store's upsertReport() used by payroll/tax-remittance sync.
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (!auth.ok) return auth.response
    const ctx = await resolveTenant(request)
    if (!ctx) return NextResponse.json({ error: 'Missing or unknown tenant' }, { status: 400 })

    const body = await request.json()
    if (!body.countryCode || !body.reportType || !body.period || !body.dueDate) {
      return NextResponse.json({ error: 'countryCode, reportType, period, and dueDate are required' }, { status: 400 })
    }

    const filing = await upsertComplianceReportFilingByKey(ctx.tenantId, body)
    return NextResponse.json({ filing })
  } catch (error) {
    console.error('[compliance/report-filings][POST] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// PATCH /api/compliance/report-filings — direct id-based partial update, used by the
// Submit/Approve buttons in ComplianceReportsPanel.tsx.
export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (!auth.ok) return auth.response
    const ctx = await resolveTenant(request)
    if (!ctx) return NextResponse.json({ error: 'Missing or unknown tenant' }, { status: 400 })

    const body = await request.json()
    if (!body.id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    const filing = await updateComplianceReportFilingById(ctx.tenantId, body.id, body.updates || {})
    if (!filing) return NextResponse.json({ error: 'Filing not found' }, { status: 404 })
    return NextResponse.json({ filing })
  } catch (error) {
    console.error('[compliance/report-filings][PATCH] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
