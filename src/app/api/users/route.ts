import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { getTenantFromRequest, getTenantContext, createAuditLog } from '@/app/lib/api/tenant'
import { requireAuth, requirePermission } from '@/app/lib/api/auth-guard'
import { prisma } from '@/app/lib/database/client'
import { passwordPolicyError } from '@/app/lib/settings/passwordPolicy'
import { readTenantSecurity } from '@/app/lib/settings/securityPolicyDb'
import { publicUser } from '@/app/lib/auth/posPin'
import { emailError, NEEDS_SIGN_IN_NAME, normalizeEmail, normalizeUsername, usernameError, usernameTaken } from '@/app/lib/auth/loginLookup'

const USER_SELECT = {
  id: true,
  email: true,
  username: true,
  name: true,
  role: true,
  isActive: true,
  lastLoginAt: true,
  profile: true,
  preferences: true,
  createdAt: true,
  updatedAt: true,
} as const

// Real, NextAuth-authenticated accounts — distinct from the client-only demo
// `users` slice in settings/store.ts. Settings > User Management merges these
// in on load so the list (and, critically, Delete) act on real rows.
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (!auth.ok) return auth.response
    const subdomain = getTenantFromRequest(request)
    if (!subdomain) return NextResponse.json({ error: 'Missing tenant header' }, { status: 400 })
    const ctx = await getTenantContext(subdomain)
    if (!ctx) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

    const users = await prisma.user.findMany({
      where: { tenantId: ctx.tenantId },
      select: USER_SELECT,
      orderBy: { createdAt: 'asc' },
    })
    return NextResponse.json({ users: users.map(publicUser) })
  } catch (error) {
    console.error('[users][GET] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (!auth.ok) return auth.response
    const perm = await requirePermission(request, 'settings.create')
    if (!perm.ok) return perm.response
    const subdomain = getTenantFromRequest(request)
    if (!subdomain) return NextResponse.json({ error: 'Missing tenant header' }, { status: 400 })
    const ctx = await getTenantContext(subdomain)
    if (!ctx) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

    const body = await request.json()
    // Email is optional: staff without one sign in with a username.
    const email = normalizeEmail(body.email)
    const name = String(body.name || '').trim()
    const password = String(body.password || '')
    const role = String(body.role || '').trim()
    if (!name || !password || !role) {
      return NextResponse.json({ error: 'name, password, and role are required' }, { status: 400 })
    }
    const username = normalizeUsername(body.username)
    if (!email && !username) return NextResponse.json({ error: NEEDS_SIGN_IN_NAME }, { status: 400 })
    const badEmail = emailError(email)
    if (badEmail) return NextResponse.json({ error: badEmail }, { status: 400 })
    const nameError = usernameError(username)
    if (nameError) return NextResponse.json({ error: nameError }, { status: 400 })
    if (await usernameTaken(ctx.tenantId, username)) {
      return NextResponse.json({ error: 'That username is already taken in this hotel' }, { status: 409 })
    }
    const { policy } = await readTenantSecurity(ctx.tenantId)
    const passwordError = passwordPolicyError(password, policy.passwordPolicy)
    if (passwordError) return NextResponse.json({ error: passwordError }, { status: 400 })

    const hashed = await bcrypt.hash(password, 10)
    const user = await prisma.user
      .create({
        data: {
          tenantId: ctx.tenantId,
          email: email || null,
          username: username || null,
          name,
          password: hashed,
          role,
          isActive: typeof body.isActive === 'boolean' ? body.isActive : true,
          profile: body.profile && typeof body.profile === 'object' ? body.profile : undefined,
          preferences: { passwordChangedAt: new Date().toISOString() },
        },
        select: USER_SELECT,
      })
      .catch((e: any) => {
        if (e?.code === 'P2002') return null // unique (tenantId, email) violated
        throw e
      })
    if (!user) return NextResponse.json({ error: 'A user with this email already exists' }, { status: 409 })

    const sessionUserId = (auth.session as any).user?.id
    await createAuditLog(ctx.tenantId, sessionUserId ?? null, 'USER_CREATED', 'User', user.id, undefined, { email: user.email, role: user.role }, request)
    return NextResponse.json({ user: publicUser(user) })
  } catch (error) {
    console.error('[users][POST] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
