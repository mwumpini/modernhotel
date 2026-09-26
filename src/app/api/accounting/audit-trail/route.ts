import { NextRequest, NextResponse } from 'next/server'
import { getTenantFromRequest, getTenantContext } from '@/app/lib/api/tenant'
import { requireAuth } from '@/app/lib/api/auth-guard'
import { prisma } from '@/app/lib/database/client'

const ENTITIES = ['JournalEntry', 'Invoice', 'Payment']

function trailAction(action: string): 'Create' | 'Update' | 'Delete' | 'Post' | 'Void' {
  const a = action.toUpperCase()
  if (a.includes('VOID')) return 'Void'
  if (a.includes('DELETE')) return 'Delete'
  if (a.includes('POST') || a === 'JOURNAL_ENTRY_CREATED') return 'Post'
  return a.includes('CREATE') ? 'Create' : 'Update'
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (!auth.ok) return auth.response
    const subdomain = getTenantFromRequest(request)
    if (!subdomain) return NextResponse.json({ error: 'Missing tenant header' }, { status: 400 })
    const ctx = await getTenantContext(subdomain)
    if (!ctx) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

    const logs = await prisma.auditLog.findMany({
      where: { tenantId: ctx.tenantId, entity: { in: ENTITIES } },
      orderBy: { createdAt: 'desc' },
      take: 500,
    })
    const userIds = [...new Set(logs.map((l) => l.userId).filter((id): id is string => !!id))]
    const users = userIds.length
      ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, email: true } })
      : []
    const names = new Map(users.map((u) => [u.id, u.name || u.email || u.id]))

    const auditTrail = logs.map((log) => {
      let newValues: Record<string, unknown> | undefined
      if (log.newValues) {
        try { newValues = JSON.parse(log.newValues) } catch { newValues = { detail: log.newValues } }
      }
      return {
        id: log.id,
        tableName: log.entity,
        recordId: log.entityId || '',
        action: trailAction(log.action),
        newValues: { event: log.action, ...(newValues || {}) },
        userId: (log.userId && names.get(log.userId)) || log.userId || 'system',
        timestamp: log.createdAt.toISOString(),
        ipAddress: log.ipAddress || undefined,
      }
    })

    return NextResponse.json({ auditTrail })
  } catch (error) {
    console.error('[accounting/audit-trail][GET] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
