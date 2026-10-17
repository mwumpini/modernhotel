import os from 'os'
import { NextResponse } from 'next/server'

function lanAddress(): string | null {
  const found: string[] = []
  for (const list of Object.values(os.networkInterfaces())) {
    for (const item of list || []) {
      const family = item.family as string | number
      if (item.internal) continue
      if (family !== 'IPv4' && family !== 4) continue
      if (item.address.startsWith('169.254.')) continue
      found.push(item.address)
    }
  }
  const preferred = found.find((ip) =>
    ip.startsWith('192.168.') ||
    ip.startsWith('10.') ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(ip),
  )
  return preferred || found[0] || null
}

function isCloudHost(hostname: string): boolean {
  return hostname === 'agmsync.com' || hostname.endsWith('.agmsync.com')
}

/** The address other devices should open. Cloud stays on the cloud host. A local server shares its Wi-Fi address. */
export async function GET(request: Request) {
  const hostHeader = request.headers.get('host') || ''
  const hostname = hostHeader.split(':')[0]
  if (isCloudHost(hostname)) {
    return NextResponse.json({ url: `https://${hostname}`, mode: 'cloud' })
  }
  if (hostname && hostname !== 'localhost' && hostname !== '127.0.0.1') {
    const proto = request.headers.get('x-forwarded-proto') || 'http'
    return NextResponse.json({ url: `${proto}://${hostHeader}`, mode: 'local' })
  }
  const port = hostHeader.includes(':') ? hostHeader.split(':')[1] : '3000'
  const ip = lanAddress() || '127.0.0.1'
  return NextResponse.json({ url: `http://${ip}:${port}`, mode: 'local' })
}
