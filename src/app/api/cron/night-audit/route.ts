import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/app/lib/database/client'
import { catchUpTenantNightAudit } from '@/app/lib/frontoffice/nightAuditServer'

/**
 * Server-side Night Audit — Vercel Cron (01:00) or Bearer CRON_SECRET.
 * Posts room charges and no-shows onto GuestFolio rows, then reconstructs
 * the day's totals from those rows. Manual runs use the same engine at
 * POST /api/frontoffice/night-audit/run.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = request.headers.get('authorization')
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const results: Record<string, any> = {}
  const errors: string[] = []
  let totalRoomChargesPosted = 0
  let totalNoShowsMarked = 0

  try {
    const tenants = await prisma.tenant.findMany({ where: { status: 'active' } })

    for (const tenant of tenants) {
      try {
        const run = await catchUpTenantNightAudit({
          tenantId: tenant.id,
          source: 'cron',
          runBy: 'night-audit-cron',
        })
        totalRoomChargesPosted += run.roomChargesPosted
        totalNoShowsMarked += run.noShowsMarked
        results[tenant.subdomain] = {
          skipped: run.skipped,
          businessDate: run.businessDate,
          nextBusinessDate: run.nextBusinessDate,
          daysClosed: run.daysClosed,
          roomChargesPosted: run.roomChargesPosted,
          noShowsMarked: run.noShowsMarked,
          folioChargesTotal: run.folioChargesTotal,
          folioPaymentsTotal: run.folioPaymentsTotal,
          status: run.status,
        }
        if (run.errors.length) errors.push(...run.errors.map((e) => `${tenant.subdomain}: ${e}`))
      } catch (tenantErr) {
        const msg = `${tenant.subdomain}: ${tenantErr}`
        errors.push(msg)
        results[tenant.subdomain] = { status: 'failed', error: String(tenantErr) }
      }
    }

    return NextResponse.json({
      ok: errors.length === 0,
      summary: {
        totalRoomChargesPosted,
        totalNoShowsMarked,
        tenantsProcessed: tenants.length,
      },
      byTenant: results,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error) {
    console.error('[night-audit] error', error)
    return NextResponse.json({ ok: false, error: 'Night audit failed', details: String(error) }, { status: 500 })
  }
}
