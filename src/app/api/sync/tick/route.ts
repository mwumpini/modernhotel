import { NextResponse } from 'next/server'
import { runExchange } from '@/app/lib/sync/run'

/** The hotel computer calls this on a timer. It does nothing on the cloud. */
export async function POST() {
  if (process.env.VERCEL || process.env.CLOUD_SYNC_MODE !== '1') {
    return NextResponse.json({ ok: false }, { status: 404 })
  }
  const result = await runExchange()
  return NextResponse.json(result)
}
