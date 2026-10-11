import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/app/lib/api/auth-guard'
import { hotelChannel } from '@/app/lib/realtime/publish'

export const dynamic = 'force-dynamic'

const TOKEN_TTL_MS = 60 * 60 * 1000

/**
 * GET: a short-lived Ably token that can only LISTEN to the signed-in user's
 * own hotel channel. The hotel comes from the login session, never from the
 * browser, so one hotel can never hear another. 204 when live updates are off.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (!auth.ok) return auth.response
    const key = process.env.ABLY_API_KEY
    if (!key) return new NextResponse(null, { status: 204 })
    const user = (auth.session as { user?: { id?: string; tenantId?: string } }).user
    if (!user?.tenantId) return NextResponse.json({ error: 'No hotel on this login' }, { status: 403 })
    const channel = hotelChannel(user.tenantId)
    const keyName = key.split(':')[0]
    const res = await fetch(`https://rest.ably.io/keys/${encodeURIComponent(keyName)}/requestToken`, {
      method: 'POST',
      headers: { Authorization: `Basic ${Buffer.from(key).toString('base64')}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        keyName,
        clientId: user.id || undefined,
        capability: JSON.stringify({ [channel]: ['subscribe'] }),
        ttl: TOKEN_TTL_MS,
        timestamp: Date.now(),
      }),
      cache: 'no-store',
    })
    if (!res.ok) {
      console.warn('[realtime/token] Ably refused the token request', res.status)
      return NextResponse.json({ error: 'Live updates unavailable' }, { status: 502 })
    }
    const token = (await res.json()) as { token?: string; expires?: number }
    return NextResponse.json({ channel, token: token.token, expires: token.expires })
  } catch (error) {
    console.error('[realtime/token][GET] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
