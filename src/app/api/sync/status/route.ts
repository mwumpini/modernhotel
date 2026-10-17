import { NextResponse } from 'next/server'
import { readSyncConfig } from '@/app/lib/sync/config'

export async function GET() {
  if (process.env.VERCEL) return NextResponse.json({ linked: false })
  const config = readSyncConfig()
  return NextResponse.json({
    linked: Boolean(config?.token && config.tenantId),
    cloudUrl: config?.cloudUrl || 'https://app.agmsync.com',
    subdomain: config?.subdomain || '',
    lastSync: config?.lastSync || null,
    lastError: config?.lastError || null,
  })
}
