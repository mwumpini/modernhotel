import { NextResponse } from 'next/server'
import { prisma } from '@/app/lib/database/client'
import { backfill, ingest, listForPeer, type SyncCursor, type SyncEntry } from '@/app/lib/sync/engine'
import { hashSyncToken, readTokenHash } from '@/app/lib/sync/token'

/** The hotel computer sends what changed there and receives what changed on the cloud. */
export async function POST(request: Request) {
  const header = request.headers.get('authorization') || ''
  const token = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : ''
  if (!token) return NextResponse.json({ error: 'Missing link key.' }, { status: 401 })

  const body = await request.json().catch(() => null) as {
    tenantId?: string
    nodeId?: string
    entries?: SyncEntry[]
    cursor?: SyncCursor
    wantSnapshot?: boolean
  } | null
  const tenantId = body?.tenantId || ''
  const nodeId = body?.nodeId || ''
  if (!tenantId || !nodeId) return NextResponse.json({ error: 'Missing hotel.' }, { status: 400 })

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } })
  if (!tenant || hashSyncToken(token) !== readTokenHash(tenant.metadata)) {
    return NextResponse.json({ error: 'This hotel computer is not linked.' }, { status: 401 })
  }

  if (body?.wantSnapshot) await backfill(prisma, tenantId, 'cloud')
  const entries = Array.isArray(body?.entries) ? body.entries : []
  await ingest(prisma, entries.filter((entry) => entry.tenantId === tenantId && entry.nodeId === nodeId))
  const outgoing = await listForPeer(prisma, tenantId, nodeId, body?.cursor ?? null)
  return NextResponse.json({ entries: outgoing })
}
