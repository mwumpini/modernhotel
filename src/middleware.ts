import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Skip middleware for static files and API routes
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/static') ||
    pathname.includes('.')
  ) {
    return NextResponse.next()
  }

  // Extract tenant from subdomain
  const hostname = request.headers.get('host') || ''
  const subdomain = hostname.split('.')[0]
  
  // Skip for localhost development
  if (hostname.includes('localhost') || hostname.includes('127.0.0.1')) {
    return NextResponse.next()
  }

  // Check if it's a valid tenant subdomain
  if (subdomain && subdomain !== 'www' && subdomain !== 'api') {
    // Add tenant info to headers for API routes
    const requestHeaders = new Headers(request.headers)
    requestHeaders.set('x-tenant-subdomain', subdomain)

    // For API routes, add tenant isolation
    if (pathname.startsWith('/api/')) {
      const response = NextResponse.next({
        request: {
          headers: requestHeaders,
        },
      })
      return response
    }
  }

  // For now, skip authentication check to avoid middleware errors
  // TODO: Re-enable when next-auth middleware is properly configured

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/auth (auth endpoints)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api/auth|_next/static|_next/image|favicon.ico).*)',
  ],
}
