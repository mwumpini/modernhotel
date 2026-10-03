import { NextRequest, NextResponse } from 'next/server'
import { getTenantFromRequest, getTenantContext, createAuditLog } from '@/app/lib/api/tenant'
import { requireAuth, requirePermission } from '@/app/lib/api/auth-guard'
import { prisma } from '@/app/lib/database/client'
import { hashPin, pinLengthError, withoutPinKeys } from '@/app/lib/auth/posPin'
import { readTenantSecurity } from '@/app/lib/settings/securityPolicyDb'

/**
 * PUT    /api/users/:id/pos-pin  { pin }  — set or change a staff member's POS PIN (4–6 digits)
 * DELETE /api/users/:id/pos-pin           — remove it
 * A manager (settings.edit) can do this for anyone; a signed-in user can set their own.
 */
async function resolve(request: NextRequest, id: string) {
  const auth = await requireAuth(request)
  if (!auth.ok) return { response: auth.response }
  const sessionUserId = (auth.session as { user?: { id?: string } }).user?.id ?? null
  if (sessionUserId !== id) {
    const perm = await requirePermission(request, 'settings.edit')
    if (!perm.ok) return { response: perm.response }
  }
  const subdomain = getTenantFromRequest(request)
  if (!subdomain) return { response: NextResponse.json({ error: 'Missing tenant header' }, { status: 400 }) }
  const ctx = await getTenantContext(subdomain)
  if (!ctx) return { response: NextResponse.json({ error: 'Tenant not found' }, { status: 404 }) }
  const target = await prisma.user.findFirst({ where: { id, tenantId: ctx.tenantId }, select: { id: true, name: true, preferences: true } })
  if (!target) return { response: NextResponse.json({ error: 'User not found' }, { status: 404 }) }
  return { ctx, target, sessionUserId }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const r = await resolve(request, id)
    if ('response' in r) return r.response
    const body = await request.json().catch(() => ({}))
    const { policy } = await readTenantSecurity(r.ctx.tenantId)
    const pinError = pinLengthError(String(body.pin ?? ''), policy.pinPolicy)
    if (pinError) return NextResponse.json({ error: pinError }, { status: 400 })

    const prefs = withoutPinKeys((r.target.preferences as Record<string, unknown>) || {})
    await prisma.user.update({ where: { id }, data: { preferences: { ...prefs, posPinHash: await hashPin(body.pin) } } })
    await createAuditLog(r.ctx.tenantId, r.sessionUserId, 'POS_PIN_SET', 'User', id, undefined, { name: r.target.name }, request)
    return NextResponse.json({ ok: true, hasPin: true })
  } catch (error) {
    console.error('[users/:id/pos-pin][PUT] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const r = await resolve(request, id)
    if ('response' in r) return r.response
    const prefs = withoutPinKeys((r.target.preferences as Record<string, unknown>) || {})
    await prisma.user.update({ where: { id }, data: { preferences: prefs as object } })
    await createAuditLog(r.ctx.tenantId, r.sessionUserId, 'POS_PIN_REMOVED', 'User', id, undefined, { name: r.target.name }, request)
    return NextResponse.json({ ok: true, hasPin: false })
  } catch (error) {
    console.error('[users/:id/pos-pin][DELETE] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
