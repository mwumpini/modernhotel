import { prisma } from '@/app/lib/database/client'

// SQLite (this project's local dev DB) doesn't support Prisma's
// `mode: 'insensitive'` filter — LIKE is already case-insensitive there for
// ASCII, so it's only needed against Postgres (production). The datasource
// url is a literal in prisma/schema.prisma rather than env-based, so the
// only reliable way to tell which DB is live is to ask the client itself.
const SUPPORTS_INSENSITIVE_MODE = (prisma as any)._activeProvider !== 'sqlite'
function ci(value: string) {
  return SUPPORTS_INSENSITIVE_MODE ? { contains: value, mode: 'insensitive' as const } : { contains: value }
}

export interface AuditLogEntry {
  id: string
  action: string
  entity: string
  entityId: string | null
  userId: string | null
  userName: string | null
  userEmail: string | null
  ipAddress: string | null
  createdAt: string
  /** Plain-text "field: old → new" summary, or "field: value" for creations with no prior state. */
  details: string
  /** Short "Browser on OS" summary of the stored user-agent string — not a full device registry, just what's already captured. */
  device: string | null
}

/**
 * Reduces a raw user-agent string to "Browser on OS" (e.g. "Chrome on Windows").
 * Deliberately coarse — good enough to tell "front desk PC" from "manager's phone"
 * without needing a real device-registration feature.
 */
function summarizeUserAgent(ua: string | null): string | null {
  if (!ua || ua === 'unknown') return null
  let os = 'Unknown OS'
  if (/windows/i.test(ua)) os = 'Windows'
  else if (/android/i.test(ua)) os = 'Android'
  else if (/iphone|ipad|ios/i.test(ua)) os = 'iOS'
  else if (/mac os/i.test(ua)) os = 'Mac'
  else if (/linux/i.test(ua)) os = 'Linux'

  let browser = 'Unknown browser'
  if (/edg\//i.test(ua)) browser = 'Edge'
  else if (/chrome\//i.test(ua)) browser = 'Chrome'
  else if (/firefox\//i.test(ua)) browser = 'Firefox'
  else if (/safari\//i.test(ua)) browser = 'Safari'

  return `${browser} on ${os}`
}

function parseValues(raw: string | null): Record<string, any> | null {
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

/** Turns the raw oldValues/newValues JSON columns into one short, readable line. */
function summarizeChange(oldValues: Record<string, any> | null, newValues: Record<string, any> | null): string {
  if (!newValues && !oldValues) return ''
  if (!oldValues) {
    return Object.entries(newValues || {}).map(([k, v]) => `${k}: ${v}`).join(', ')
  }
  const keys = new Set([...Object.keys(oldValues), ...Object.keys(newValues || {})])
  const parts: string[] = []
  for (const k of keys) {
    const ov = oldValues[k]
    const nv = newValues ? newValues[k] : undefined
    if (ov !== nv) parts.push(`${k}: ${ov ?? '—'} → ${nv ?? '—'}`)
  }
  return parts.join(', ')
}

export interface ListAuditLogsResult {
  entries: AuditLogEntry[]
  total: number
  page: number
  limit: number
}

/**
 * Paginated, searchable read of the audit_logs table. Search matches action,
 * entity, entity id, and IP address directly, plus user name/email via a
 * small separate lookup — AuditLog.userId has no FK relation (rows must
 * survive a deleted user), so it can't be joined in one query.
 */
export async function listAuditLogs(
  tenantId: string,
  opts: { q?: string; page?: number; limit?: number } = {}
): Promise<ListAuditLogsResult> {
  const page = Math.max(1, opts.page ?? 1)
  const limit = Math.min(500, Math.max(1, opts.limit ?? 50))
  const q = opts.q?.trim()

  const where: any = { tenantId }
  if (q) {
    const userWhere: any = {
      tenantId,
      OR: [{ name: ci(q) }, { email: ci(q) }],
    }
    const matchingUsers = await prisma.user.findMany({ where: userWhere, select: { id: true } })
    where.OR = [
      { action: ci(q) },
      { entity: ci(q) },
      { entityId: ci(q) },
      { ipAddress: ci(q) },
      { userAgent: ci(q) },
      ...(matchingUsers.length ? [{ userId: { in: matchingUsers.map((u) => u.id) } }] : []),
    ]
  }

  const [total, rows] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ])

  const userIds = [...new Set(rows.map((r) => r.userId).filter((id): id is string => !!id))]
  const users = userIds.length
    ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, email: true } })
    : []
  const userMap = new Map(users.map((u) => [u.id, u]))

  const entries: AuditLogEntry[] = rows.map((r) => {
    const user = r.userId ? userMap.get(r.userId) : undefined
    return {
      id: r.id,
      action: r.action,
      entity: r.entity,
      entityId: r.entityId,
      userId: r.userId,
      userName: user?.name ?? null,
      userEmail: user?.email ?? null,
      ipAddress: r.ipAddress,
      createdAt: r.createdAt.toISOString(),
      details: summarizeChange(parseValues(r.oldValues), parseValues(r.newValues)),
      device: summarizeUserAgent(r.userAgent),
    }
  })

  return { entries, total, page, limit }
}
