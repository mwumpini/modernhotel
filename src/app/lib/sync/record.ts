import { randomUUID } from 'crypto'
import { prisma } from '../database/client'
import { isSyncApply, logLocalWrite, serializeRow, type SyncEntry } from './engine'
import { readSyncConfig } from './config'

function nodeId(): string {
  if (process.env.VERCEL) return 'cloud'
  return readSyncConfig()?.nodeId || (process.env.CLOUD_SYNC_MODE === '1' ? 'premises' : 'cloud')
}

function shouldRecord(): boolean {
  if (isSyncApply()) return false
  // On the cloud, only when switched on: every hotel writes here, and most have no computer linked.
  if (process.env.VERCEL) return process.env.CLOUD_SYNC_RECORD === '1'
  return process.env.CLOUD_SYNC_MODE === '1'
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
  if (!tenantId) return
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
