import { prisma } from '../database/client'
import { readSyncConfig, writeSyncConfig, type SyncConfig } from './config'
import { backfill, ingest, listOwn, type SyncCursor, type SyncEntry } from './engine'

let running = false

async function postExchange(config: SyncConfig, entries: SyncEntry[], cursor: SyncCursor): Promise<SyncEntry[]> {
  const response = await fetch(`${config.cloudUrl}/api/sync/exchange`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.token}`,
    },
    body: JSON.stringify({
      tenantId: config.tenantId,
      nodeId: config.nodeId,
      entries,
      cursor,
      wantSnapshot: true,
    }),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error || 'The cloud did not accept the records.')
  return Array.isArray(data.entries) ? data.entries as SyncEntry[] : []
}

/** Send this computer's changes to the cloud and apply what came back. */
export async function runExchange(): Promise<{ pushed: number; pulled: number; error: string | null }> {
  const config = readSyncConfig()
  if (!config?.token || !config.tenantId) return { pushed: 0, pulled: 0, error: null }
  if (running) return { pushed: 0, pulled: 0, error: null }
  running = true
  try {
    if (!config.snapshotDone) {
      await backfill(prisma, config.tenantId, config.nodeId)
      config.snapshotDone = true
    }
    let pushed = 0
    let pulled = 0
    let pushCursor: SyncCursor = config.pushed
    for (let page = 0; page < 40; page += 1) {
      const mine = await listOwn(prisma, config.tenantId, config.nodeId, pushCursor)
      const incoming = await postExchange(config, mine, config.cursor)
      pushed += mine.length
      if (mine.length) {
        const lastOwn = mine[mine.length - 1]
        pushCursor = { at: lastOwn.at, id: lastOwn.id }
        config.pushed = pushCursor
      }
      pulled += await ingest(prisma, incoming)
      const last = incoming[incoming.length - 1]
      if (last) config.cursor = { at: last.at, id: last.id }
      if (mine.length < 500 && incoming.length < 500) break
    }
    config.lastSync = new Date().toISOString()
    config.lastError = null
    writeSyncConfig(config)
    return { pushed, pulled, error: null }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The link did not complete.'
    const latest = readSyncConfig()
    if (latest) {
      latest.lastError = message
      writeSyncConfig(latest)
    }
    return { pushed: 0, pulled: 0, error: message }
  } finally {
    running = false
  }
}
