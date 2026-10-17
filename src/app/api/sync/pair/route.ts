import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { Prisma } from '@prisma/client'
import { prisma } from '@/app/lib/database/client'
import { findUserForLogin } from '@/app/lib/auth/loginLookup'
import { resolveLoginTenant } from '@/app/lib/platform/operator'
import { hashSyncToken, newSyncToken, readTokenHash } from '@/app/lib/sync/token'

/** The hotel computer signs in once and receives the key that links the two copies. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { subdomain?: string; email?: string; password?: string } | null
  const subdomain = body?.subdomain?.trim().toLowerCase() || ''
  const email = body?.email?.trim() || ''
  const password = body?.password || ''
  if (!subdomain || !email || !password) {
    return NextResponse.json({ error: 'Enter the hotel code, email, and password.' }, { status: 400 })
  }

  const tenant = await resolveLoginTenant(subdomain)
  if (!tenant || tenant.status !== 'active') {
    return NextResponse.json({ error: 'That hotel code was not found.' }, { status: 401 })
  }
  const user = await findUserForLogin(tenant.id, email)
  const passwordValid = !!(user?.isActive && user.password && await bcrypt.compare(password, user.password))
  if (!passwordValid) {
    return NextResponse.json({ error: 'That sign-in was not accepted.' }, { status: 401 })
  }

  const token = newSyncToken()
  const metadata = tenant.metadata && typeof tenant.metadata === 'object' && !Array.isArray(tenant.metadata)
    ? { ...(tenant.metadata as Record<string, unknown>) }
    : {}
  metadata.syncTokenHash = hashSyncToken(token)
  await prisma.tenant.update({ where: { id: tenant.id }, data: { metadata: metadata as Prisma.InputJsonValue } })

  return NextResponse.json({
    token,
    tenantId: tenant.id,
    subdomain: tenant.subdomain,
    name: tenant.name,
    replaced: Boolean(readTokenHash(tenant.metadata)),
  })
}
