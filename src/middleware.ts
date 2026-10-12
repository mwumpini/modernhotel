import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { normalizeTenantSubdomain } from '@/app/lib/api/tenantSubdomain'
import { isPlatformOperator } from '@/app/lib/platform/operatorRole'

// Routes that must stay reachable without a session: `/` renders its own login form
// client-side when unauthenticated, and `/setup` is the first-run onboarding wizard that
// creates the tenant/first user before any login is possible.
const PUBLIC_PATHS = ['/setup']

/**
 * API routes that answer without a login, each guarded its own way: sign-in and
 * account recovery, the health check, the hotel website's booking API (booking key),
 * Vercel cron (CRON_SECRET), and the setup wizard's "is this hotel set up?" check.
 */
const PUBLIC_API_PREFIXES = ['/api/auth/', '/api/health', '/api/booking/', '/api/cron/']
const PUBLIC_API_GET = ['/api/settings/setup-status']

function isPublicApi(request: NextRequest): boolean {
  const { pathname } = request.nextUrl
  if (PUBLIC_API_PREFIXES.some((p) => pathname === p.replace(/\/$/, '') || pathname.startsWith(p))) return true
  return request.method === 'GET' && PUBLIC_API_GET.includes(pathname)
}

/**
 * Every other API call needs a login, and the hotel it names (x-tenant-subdomain /
 * x-tenant-id) must be the hotel of that login. Routes read the hotel from that header,
 * so without this check anyone could read a hotel's data by naming it, and a user of
 * one hotel could reach another's. The platform operator works across hotels.
 */
async function guardApi(request: NextRequest) {
  if (isPublicApi(request)) return NextResponse.next()

  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized — please log in' }, { status: 401 })
  }

  const named = [request.headers.get('x-tenant-subdomain'), request.headers.get('x-tenant-id')]
    .filter((v): v is string => Boolean(v && v.trim()))
    .map(normalizeTenantSubdomain)
  if (named.length === 0) return NextResponse.next()

  const tenant = token.tenant as { subdomain?: string | null } | undefined
  if (isPlatformOperator({ role: token.role as string | undefined }, tenant)) return NextResponse.next()

  const own = tenant?.subdomain ? normalizeTenantSubdomain(tenant.subdomain) : ''
  if (!own || named.some((n) => n !== own)) {
    return NextResponse.json(
      { error: 'This sign-in belongs to a different hotel. Sign out and sign in again.' },
      { status: 403 },
    )
  }
  return NextResponse.next()
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  if (pathname.startsWith('/api/')) return guardApi(request)

  if (pathname === '/' || PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next()
  }

  // Edge-safe: decodes the JWT session cookie directly rather than importing `authOptions`
  // (which pulls in Prisma/bcrypt — not Edge-runtime compatible, the likely cause of the
  // previous "Cannot find the middleware module" failure that led to this being a no-op).
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })
  if (!token) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    // Every API route (see guardApi), then pages: skip static assets and files with extensions
    '/api/:path*',
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.).*)',
  ],
}
