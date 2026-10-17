import { randomUUID } from 'crypto'
import { prisma } from '../database/client'
import { isSyncApply, logLocalWrite, serializeRow, type SyncEntry } from './engine'
import { readSyncConfig } from './config'
import { readTokenHash } from './token'

function nodeId(): string {
  if (process.env.VERCEL) return 'cloud'
  return readSyncConfig()?.nodeId || (process.env.CLOUD_SYNC_MODE === '1' ? 'premises' : 'cloud')
}

function shouldRecord(): boolean {
  if (isSyncApply()) return false
  if (process.env.VERCEL) return true
  return process.env.CLOUD_SYNC_MODE === '1'
}

// On the cloud, only hotels that linked a hotel computer keep a change list. Checked once a minute per hotel.
const linked = new Map<string, { yes: boolean; until: number }>()
async function hasLinkedComputer(tenantId: string): Promise<boolean> {
  if (!process.env.VERCEL) return true
  const hit = linked.get(tenantId)
  if (hit && hit.until > Date.now()) return hit.yes
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { metadata: true } })
  const yes = Boolean(readTokenHash(tenant?.metadata))
  linked.set(tenantId, { yes, until: Date.now() + 60_000 })
  return yes
}

function tenantOf(model: string, row: Record<string, unknown> | null, args: { where?: Record<string, unknown>; data?: Record<string, unknown> }): string | null {
  if (model === 'Tenant') return String(row?.id ?? args.where?.id ?? '')
  const value = row?.tenantId ?? args.data?.tenantId ?? args.where?.tenantId
  return typeof value === 'string' && value ? value : null
}

/** Remember a staff change so the other copy of the hotel can receive it. */
export async function recordWrite(model: string, operation: string, args: any, result: any): Promise<void> {
  if (!shouldRecord()) return
  const row = result && typeof result === 'object' && !Array.isArray(result) ? result as Record<string, unknown> : null
  const id = typeof row?.id === 'string' ? row.id : typeof args?.where?.id === 'string' ? args.where.id : null
  if (!id) return
  const tenantId = tenantOf(model, row, args ?? {})
  if (!tenantId || !(await hasLinkedComputer(tenantId))) return
  const op = operation === 'delete' || operation === 'deleteMany' ? 'delete' : 'upsert'
  const entry: SyncEntry = {
    id: randomUUID(),
    tenantId,
    nodeId: nodeId(),
    model,
    recordId: id,
    op,
    at: new Date().toISOString(),
    payload: op === 'delete' || !row ? null : serializeRow(row),
  }
  await logLocalWrite(prisma, entry)
}
