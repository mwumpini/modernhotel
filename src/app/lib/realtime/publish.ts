import { after } from 'next/server'

/**
 * Live updates: after a save, send that hotel's open screens a tiny
 * "this changed" notice through Ably so they refetch at once instead of
 * waiting for their next poll. Only model names travel — never data.
 *
 * Off (a silent no-op) until ABLY_API_KEY is set in the environment.
 */

/** Ably channel for one hotel. Screens may only subscribe to their own (see /api/realtime/token). */
export const hotelChannel = (tenantId: string) => `hotel:${tenantId}`

/** Busy or private tables that no screen watches. */
const QUIET_MODELS = new Set(['AuditLog', 'NumberCounter', 'User'])

const pending = new Map<string, Set<string>>()
let flushScheduled = false

export function realtimeEnabled() {
  return Boolean(process.env.ABLY_API_KEY)
}

/** Queue a change notice; notices from one request go out together once the response is sent. */
export function notifyChange(tenantId: string | null | undefined, model: string, kind?: string) {
  if (!tenantId || !realtimeEnabled() || QUIET_MODELS.has(model)) return
  const models = pending.get(tenantId) ?? new Set<string>()
  models.add(kind ? `${model}:${kind}` : model)
  pending.set(tenantId, models)
  if (flushScheduled) return
  flushScheduled = true
  try {
    after(flush)
  } catch {
    // Outside a request (scripts, seed): send shortly, batched.
    setTimeout(() => void flush(), 100)
  }
}

async function flush() {
  flushScheduled = false
  const batch = [...pending.entries()]
  pending.clear()
  const key = process.env.ABLY_API_KEY
  if (!key || !batch.length) return
  const auth = `Basic ${Buffer.from(key).toString('base64')}`
  await Promise.all(
    batch.map(async ([tenantId, models]) => {
      try {
        const res = await fetch(`https://rest.ably.io/channels/${encodeURIComponent(hotelChannel(tenantId))}/messages`, {
          method: 'POST',
          headers: { Authorization: auth, 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'changed', data: { models: [...models] } }),
        })
        if (!res.ok) console.warn('[realtime] publish failed', res.status)
      } catch (error) {
        console.warn('[realtime] publish failed', error)
      }
    }),
  )
}

const WRITE_OPERATIONS = new Set([
  'create', 'createMany', 'createManyAndReturn', 'update', 'updateMany',
  'updateManyAndReturn', 'upsert', 'delete', 'deleteMany',
])

function pickTenantId(model: string, args: any, result: any): string | undefined {
  const row = Array.isArray(result) ? result[0] : result
  if (model === 'Tenant') return row?.id ?? args?.where?.id
  return (
    row?.tenantId ??
    args?.where?.tenantId ??
    args?.data?.tenantId ??
    (Array.isArray(args?.data) ? args.data[0]?.tenantId : undefined) ??
    args?.create?.tenantId ??
    // Compound keys, e.g. where: { tenantId_kind_recordId: { tenantId, ... } }
    (Object.values(args?.where ?? {}) as any[]).find((v) => v && typeof v === 'object' && v.tenantId)?.tenantId
  )
}

/** Prisma query hook: every write to a hotel's table queues a notice for that hotel. */
export async function afterWrite(model: string | undefined, operation: string, args: any, result: any) {
  if (!model || !WRITE_OPERATIONS.has(operation)) return
  if (model !== 'SyncLog') {
    const record = async () => {
      try {
        const { recordWrite } = await import('../sync/record')
        await recordWrite(model, operation, args, result)
      } catch (error) {
        console.warn('[sync] could not record the change', error)
      }
    }
    // Inside a request: once the response is sent, so it never waits on (or deadlocks) the write's
    // own transaction, and the cloud function still finishes it. Outside a request: straight away.
    try {
      const { after } = await import('next/server')
      after(record)
    } catch {
      void record()
    }
  }
  if (!realtimeEnabled()) return
  const tenantId = pickTenantId(model, args, result)
  const row = Array.isArray(result) ? result[0] : result
  const kind = model === 'TenantRecord' ? (row?.kind ?? args?.where?.kind ?? args?.data?.kind) : undefined
  notifyChange(tenantId, model, typeof kind === 'string' ? kind : undefined)
}
