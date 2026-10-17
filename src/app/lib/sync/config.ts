import fs from 'fs'
import path from 'path'

export type SyncConfig = {
  cloudUrl: string
  token: string
  tenantId: string
  subdomain: string
  nodeId: string
  cursor: { at: string; id: string } | null
  pushed: { at: string; id: string } | null
  snapshotDone: boolean
  lastSync: string | null
  lastError: string | null
}

export function syncConfigPath(): string {
  if (process.env.CLOUD_SYNC_CONFIG) return process.env.CLOUD_SYNC_CONFIG
  const root = process.env.ProgramData || 'C:\\ProgramData'
  return path.join(root, 'GhanaHotel', 'sync.json')
}

export function readSyncConfig(): SyncConfig | null {
  const file = syncConfigPath()
  if (!fs.existsSync(file)) return null
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as Partial<SyncConfig>
    if (!parsed.nodeId) return null
    return {
      cloudUrl: parsed.cloudUrl || 'https://app.agmsync.com',
      token: parsed.token || '',
      tenantId: parsed.tenantId || '',
      subdomain: parsed.subdomain || '',
      nodeId: parsed.nodeId,
      cursor: parsed.cursor ?? null,
      pushed: parsed.pushed ?? null,
      snapshotDone: Boolean(parsed.snapshotDone),
      lastSync: parsed.lastSync ?? null,
      lastError: parsed.lastError ?? null,
    }
  } catch {
    return null
  }
}

export function writeSyncConfig(config: SyncConfig): void {
  const file = syncConfigPath()
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, JSON.stringify(config, null, 2), 'utf8')
}
