import { NextResponse } from 'next/server'
import { prisma } from '@/app/lib/database/client'
import { alignTenantId, backfill } from '@/app/lib/sync/engine'
import { readSyncConfig, writeSyncConfig, type SyncConfig } from '@/app/lib/sync/config'
import { runExchange } from '@/app/lib/sync/run'

function premisesOnly(): NextResponse | null {
  if (process.env.VERCEL) return NextResponse.json({ error: 'Linking is done on the hotel computer.' }, { status: 404 })
  return null
}

/** Save the cloud link on this computer and pass the records both ways once. */
export async function POST(request: Request) {
  const blocked = premisesOnly()
  if (blocked) return blocked
  const body = await request.json().catch(() => null) as {
    cloudUrl?: string
    subdomain?: string
    email?: string
    password?: string
  } | null
  const cloudUrl = (body?.cloudUrl || 'https://app.agmsync.com').replace(/\/$/, '')
  const subdomain = body?.subdomain?.trim().toLowerCase() || ''
  const email = body?.email?.trim() || ''
  const password = body?.password || ''
  if (!subdomain || !email || !password) {
    return NextResponse.json({ error: 'Enter the hotel code, email, and password.' }, { status: 400 })
  }

  let paired: { token: string; tenantId: string; subdomain: string; name: string }
  try {
    const response = await fetch(`${cloudUrl}/api/sync/pair`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subdomain, email, password }),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) return NextResponse.json({ error: data.error || 'The cloud did not accept the link.' }, { status: response.status })
    paired = data
  } catch {
    return NextResponse.json({ error: 'This computer could not reach the cloud.' }, { status: 502 })
  }

  const current = readSyncConfig()
  const local = await prisma.tenant.findFirst({ where: { subdomain: paired.subdomain } })
    || await prisma.tenant.findFirst({ orderBy: { createdAt: 'asc' } })
  if (local && local.id !== paired.tenantId) {
    await alignTenantId(prisma, local.id, paired.tenantId)
  }

  const config: SyncConfig = {
    cloudUrl,
    token: paired.token,
    tenantId: paired.tenantId,
    subdomain: paired.subdomain,
    nodeId: current?.nodeId || `premises-${paired.tenantId.slice(0, 8)}`,
    cursor: null,
    pushed: null,
    snapshotDone: false,
    lastSync: null,
    lastError: null,
  }
  writeSyncConfig(config)
  await backfill(prisma, paired.tenantId, config.nodeId)
  const result = await runExchange()
  return NextResponse.json({ ok: !result.error, hotel: paired.name, ...result })
}
