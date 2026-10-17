import { Prisma, type PrismaClient } from '@prisma/client'

export type SyncOp = 'upsert' | 'delete'

export type SyncEntry = {
  id: string
  tenantId: string
  nodeId: string
  model: string
  recordId: string
  op: SyncOp
  at: string
  payload: Record<string, unknown> | null
}

export type SyncCursor = { at: string; id: string } | null

const SKIP_MODELS = new Set(['SyncLog', 'AuditLog', 'DemoRequest'])

type ModelMeta = {
  name: string
  delegate: string
  fields: { name: string; kind: string; type: string; isRequired: boolean }[]
  dependsOn: string[]
}

let modelCache: ModelMeta[] | null = null

function metas(): ModelMeta[] {
  if (modelCache) return modelCache
  const models = Prisma.dmmf.datamodel.models
  const names = new Set(models.map((model) => model.name))
  modelCache = models
    .filter((model) => !SKIP_MODELS.has(model.name) && model.fields.some((field) => field.name === 'id'))
    .map((model) => ({
      name: model.name,
      delegate: model.name.charAt(0).toLowerCase() + model.name.slice(1),
      fields: model.fields.map((field) => ({
        name: field.name,
        kind: field.kind,
        type: field.type,
        isRequired: field.isRequired,
      })),
      dependsOn: model.fields
        .filter((field) => field.kind === 'object' && field.relationFromFields?.length && names.has(field.type) && field.type !== model.name)
        .map((field) => field.type),
    }))
  return modelCache
}

export function syncModelNames(): string[] {
  const items = metas()
  const pending = new Map(items.map((item) => [item.name, new Set(item.dependsOn.filter((name) => items.some((item) => item.name === name)))]))
  const ordered: string[] = []
  while (pending.size) {
    const ready = [...pending.entries()].filter(([, deps]) => deps.size === 0).map(([name]) => name)
    const batch = ready.length ? ready : [...pending.keys()]
    for (const name of batch) {
      ordered.push(name)
      pending.delete(name)
    }
    for (const deps of pending.values()) {
      for (const name of batch) deps.delete(name)
    }
  }
  return ordered
}

function meta(name: string): ModelMeta | undefined {
  return metas().find((item) => item.name === name)
}

function delegate(db: PrismaClient, name: string) {
  const item = meta(name)
  if (!item) return null
  return (db as unknown as Record<string, {
    findMany: (args: unknown) => Promise<Record<string, unknown>[]>
    findUnique: (args: unknown) => Promise<Record<string, unknown> | null>
    findFirst: (args: unknown) => Promise<Record<string, unknown> | null>
    upsert: (args: unknown) => Promise<unknown>
    deleteMany: (args: unknown) => Promise<unknown>
    updateMany: (args: unknown) => Promise<unknown>
  }>)[item.delegate]
}

export function serializeRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(row)) {
    if (typeof value === 'bigint') out[key] = value.toString()
    else if (value instanceof Date) out[key] = value.toISOString()
    else out[key] = value
  }
  return out
}

function coerce(name: string, payload: Record<string, unknown>): Record<string, unknown> {
  const item = meta(name)
  const data: Record<string, unknown> = {}
  if (!item) return data
  for (const field of item.fields) {
    if (field.kind !== 'scalar' && field.kind !== 'enum') continue
    if (!Object.prototype.hasOwnProperty.call(payload, field.name)) continue
    let value = payload[field.name]
    if (value == null) {
      data[field.name] = null
      continue
    }
    if (field.type === 'DateTime' && typeof value === 'string') value = new Date(value)
    if (field.type === 'BigInt' && (typeof value === 'string' || typeof value === 'number')) value = BigInt(value)
    if (field.type === 'Int' && typeof value === 'string') value = Number(value)
    if (field.type === 'Float' && typeof value === 'string') value = Number(value)
    data[field.name] = value
  }
  return data
}

function toEntry(row: {
  id: string
  tenantId: string
  nodeId: string
  model: string
  recordId: string
  op: string
  at: Date
  payload: unknown
}): SyncEntry {
  return {
    id: row.id,
    tenantId: row.tenantId,
    nodeId: row.nodeId,
    model: row.model,
    recordId: row.recordId,
    op: row.op === 'delete' ? 'delete' : 'upsert',
    at: row.at.toISOString(),
    payload: row.payload && typeof row.payload === 'object' ? row.payload as Record<string, unknown> : null,
  }
}

let applyDepth = 0

export function isSyncApply(): boolean {
  return applyDepth > 0
}

async function rowsForTenant(db: PrismaClient, name: string, tenantId: string): Promise<Record<string, unknown>[]> {
  const model = delegate(db, name)
  if (!model) return []
  if (name === 'Tenant') return model.findMany({ where: { id: tenantId } })
  if (!meta(name)?.fields.some((field) => field.name === 'tenantId')) return []
  return model.findMany({ where: { tenantId } })
}

/** One local change, written so the other copy can apply it. */
export async function logLocalWrite(db: PrismaClient, entry: SyncEntry): Promise<void> {
  applyDepth += 1
  try {
    await db.syncLog.create({
      data: {
        id: entry.id,
        tenantId: entry.tenantId,
        nodeId: entry.nodeId,
        model: entry.model,
        recordId: entry.recordId,
        op: entry.op,
        at: new Date(entry.at),
        payload: entry.payload === null ? undefined : entry.payload as Prisma.InputJsonValue,
      },
    })
  } finally {
    applyDepth -= 1
  }
}

/** Records that already exist, once, so the first link can share them. */
export async function backfill(db: PrismaClient, tenantId: string, nodeId: string): Promise<number> {
  const markerId = `snap:${nodeId}:done`
  const marker = await db.syncLog.findUnique({ where: { id: markerId } })
  if (marker) return 0
  let created = 0
  for (const name of syncModelNames()) {
    const rows = await rowsForTenant(db, name, tenantId)
    for (const row of rows) {
      const recordId = String(row.id ?? '')
      if (!recordId) continue
      const id = `snap:${nodeId}:${name}:${recordId}`
      const existing = await db.syncLog.findUnique({ where: { id } })
      if (existing) continue
      const stamp = row.updatedAt instanceof Date ? row.updatedAt : row.createdAt instanceof Date ? row.createdAt : new Date()
      await logLocalWrite(db, {
        id,
        tenantId,
        nodeId,
        model: name,
        recordId,
        op: 'upsert',
        at: stamp.toISOString(),
        payload: serializeRow(row),
      })
      created += 1
    }
  }
  await logLocalWrite(db, {
    id: markerId,
    tenantId,
    nodeId,
    model: 'SyncMarker',
    recordId: 'done',
    op: 'upsert',
    at: new Date().toISOString(),
    payload: {},
  })
  return created
}

async function applyOne(db: PrismaClient, entry: SyncEntry): Promise<void> {
  const model = delegate(db, entry.model)
  if (!model) return
  if (entry.op === 'delete') {
    await model.deleteMany({ where: { id: entry.recordId } })
    return
  }
  if (!entry.payload) return
  const data = coerce(entry.model, entry.payload)
  const create = { ...data, id: entry.recordId }
  const update = { ...data }
  delete update.id
  await model.upsert({ where: { id: entry.recordId }, create, update })
}

/** Store the other copy's changes and apply them when they are the later change. */
export async function ingest(db: PrismaClient, entries: SyncEntry[]): Promise<number> {
  const sorted = entries.slice().sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id))
  const pending = [...sorted]
  let applied = 0
  applyDepth += 1
  try {
    for (let pass = 0; pass < 4 && pending.length; pass += 1) {
      const failed: SyncEntry[] = []
      for (const entry of pending) {
        const already = await db.syncLog.findUnique({ where: { id: entry.id } })
        if (already) continue
        const latest = await db.syncLog.findFirst({
          where: { tenantId: entry.tenantId, model: entry.model, recordId: entry.recordId },
          orderBy: [{ at: 'desc' }, { id: 'desc' }],
        })
        const latestAt = latest ? latest.at.toISOString() : null
        const newer = !latestAt || entry.at > latestAt || (entry.at === latestAt && entry.id > (latest?.id ?? ''))
        try {
          if (newer) await applyOne(db, entry)
          await db.syncLog.create({
            data: {
              id: entry.id,
              tenantId: entry.tenantId,
              nodeId: entry.nodeId,
              model: entry.model,
              recordId: entry.recordId,
              op: entry.op,
              at: new Date(entry.at),
              payload: entry.payload === null ? undefined : entry.payload as Prisma.InputJsonValue,
            },
          })
          if (newer) applied += 1
        } catch {
          failed.push(entry)
        }
      }
      if (failed.length === pending.length) break
      pending.splice(0, pending.length, ...failed)
    }
  } finally {
    applyDepth -= 1
  }
  return applied
}

export async function listOwn(db: PrismaClient, tenantId: string, nodeId: string, cursor: SyncCursor): Promise<SyncEntry[]> {
  const rows = await db.syncLog.findMany({
    where: {
      tenantId,
      nodeId,
      ...(cursor
        ? {
            OR: [
              { at: { gt: new Date(cursor.at) } },
              { at: new Date(cursor.at), id: { gt: cursor.id } },
            ],
          }
        : {}),
    },
    orderBy: [{ at: 'asc' }, { id: 'asc' }],
    take: 500,
  })
  return rows.map(toEntry)
}

export async function listForPeer(db: PrismaClient, tenantId: string, peerNodeId: string, cursor: SyncCursor): Promise<SyncEntry[]> {
  const rows = await db.syncLog.findMany({
    where: {
      tenantId,
      NOT: { nodeId: peerNodeId },
      ...(cursor
        ? {
            OR: [
              { at: { gt: new Date(cursor.at) } },
              { at: new Date(cursor.at), id: { gt: cursor.id } },
            ],
          }
        : {}),
    },
    orderBy: [{ at: 'asc' }, { id: 'asc' }],
    take: 500,
  })
  return rows.map(toEntry)
}

/** Premises sends its changes, then applies what the cloud sends back. */
export async function exchangeWith(
  local: PrismaClient,
  remote: PrismaClient,
  tenantId: string,
  localNodeId: string,
  remoteNodeId: string,
  cursor: SyncCursor,
): Promise<{ cursor: SyncCursor; pushed: number; pulled: number }> {
  let pushed = 0
  let ownCursor: SyncCursor = null
  for (;;) {
    const mine = await listOwn(local, tenantId, localNodeId, ownCursor)
    if (!mine.length) break
    await ingest(remote, mine)
    pushed += mine.length
    const lastOwn = mine[mine.length - 1]
    ownCursor = { at: lastOwn.at, id: lastOwn.id }
    if (mine.length < 500) break
  }
  let pulled = 0
  let pullCursor = cursor
  for (;;) {
    const incoming = await listForPeer(remote, tenantId, localNodeId, pullCursor)
    if (!incoming.length) break
    pulled += await ingest(local, incoming)
    const last = incoming[incoming.length - 1]
    pullCursor = { at: last.at, id: last.id }
    if (incoming.length < 500) break
  }
  return { cursor: pullCursor, pushed, pulled }
}

export async function alignTenantId(db: PrismaClient, fromId: string, toId: string): Promise<void> {
  if (fromId === toId) return
  await db.$executeRawUnsafe('PRAGMA foreign_keys = OFF')
  for (const name of syncModelNames()) {
    if (name === 'Tenant') continue
    if (!meta(name)?.fields.some((field) => field.name === 'tenantId')) continue
    const model = delegate(db, name)
    if (!model) continue
    await model.updateMany({ where: { tenantId: fromId }, data: { tenantId: toId } })
  }
  await db.$executeRawUnsafe('UPDATE tenants SET id = ? WHERE id = ?', toId, fromId)
  await db.$executeRawUnsafe('UPDATE sync_logs SET tenantId = ? WHERE tenantId = ?', toId, fromId)
  await db.$executeRawUnsafe('PRAGMA foreign_keys = ON')
}
