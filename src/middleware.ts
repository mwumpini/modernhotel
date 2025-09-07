import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  // Simple middleware that just passes through all requests
  // This prevents the "Cannot find the middleware module" error
  return NextResponse.next()
}

export const config = {
  matcher: [
    // Skip all static files and API routes
    '/((?!_next/static|_next/image|favicon.ico|.*\\.).*)',
  ],
}
