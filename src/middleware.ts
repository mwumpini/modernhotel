import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

// Routes that must stay reachable without a session: `/` renders its own login form
// client-side when unauthenticated, and `/setup` is the first-run onboarding wizard that
// creates the tenant/first user before any login is possible.
const PUBLIC_PATHS = ['/setup']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
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
    // Skip API routes, static assets, and files with extensions
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.).*)',
  ],
}
