import { NextRequest, NextResponse } from 'next/server'
import { getTenantFromRequest, getTenantContext } from '@/app/lib/api/tenant'
import { requirePermission } from '@/app/lib/api/auth-guard'
import { listAuditLogs } from '@/app/lib/audit/repository'

async function resolveTenant(req: NextRequest) {
  const subdomain = getTenantFromRequest(req)
  if (!subdomain) return null
  return getTenantContext(subdomain)
}

function toCsv(rows: { createdAt: string; action: string; entity: string; entityId: string | null; userName: string | null; userEmail: string | null; ipAddress: string | null; device: string | null; details: string }[]) {
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`
  const header = ['Time', 'Action', 'Entity', 'Entity ID', 'User', 'Email', 'IP Address', 'Device', 'Details']
  const lines = [header.map(escape).join(',')]
  for (const r of rows) {
    lines.push(
      [r.createdAt, r.action, r.entity, r.entityId ?? '', r.userName ?? '', r.userEmail ?? '', r.ipAddress ?? '', r.device ?? '', r.details]
        .map((v) => escape(String(v)))
        .join(',')
    )
  }
  return lines.join('\r\n')
}

// GET - search/paginate the audit log, or download it as CSV with ?format=csv
export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission(request, 'settings.view-audit-log')
    if (!auth.ok) return auth.response
    const ctx = await resolveTenant(request)
    if (!ctx) return NextResponse.json({ error: 'Missing or unknown tenant' }, { status: 400 })

    const { searchParams } = new URL(request.url)
    const q = searchParams.get('q') || undefined
    const format = searchParams.get('format')

    if (format === 'csv') {
      const { entries } = await listAuditLogs(ctx.tenantId, { q, page: 1, limit: 5000 })
      const csv = toCsv(entries)
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="audit-log-${ctx.tenant.subdomain}-${new Date().toISOString().slice(0, 10)}.csv"`,
        },
      })
    }

    const page = Number(searchParams.get('page') || '1')
    const limit = Number(searchParams.get('limit') || '50')
    const result = await listAuditLogs(ctx.tenantId, { q, page, limit })
    return NextResponse.json(result)
  } catch (error) {
    console.error('[audit-logs][GET] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
