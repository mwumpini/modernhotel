import { NextRequest, NextResponse } from 'next/server'
import { getTenantFromRequest, getTenantContext } from '@/app/lib/api/tenant'
import { requireAuth, requirePermission } from '@/app/lib/api/auth-guard'
import { ensureDefaultRolesForTenant } from '@/app/lib/settings/roleRepository'
import { prisma } from '@/app/lib/database/client'

/**
 * Server-side mirror of the client-only settings/store.ts `roles` slice, so
 * API routes (via requirePermission in auth-guard.ts) can resolve what a
 * caller's role actually grants instead of trusting the browser. The
 * Settings > Role Management UI still edits `roles` locally first and syncs
 * here in the background (see useSettingsStore's addRole/updateRole/deleteRole).
 */
export async function GET(request: NextRequest) {
  try {
    const subdomain = getTenantFromRequest(request)
    if (!subdomain) return NextResponse.json({ error: 'Missing tenant header' }, { status: 400 })
    const ctx = await getTenantContext(subdomain)
    if (!ctx) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

    await ensureDefaultRolesForTenant(ctx.tenantId)
    const roles = await prisma.role.findMany({ where: { tenantId: ctx.tenantId }, orderBy: { createdAt: 'asc' } })
    return NextResponse.json({ roles })
  } catch (error) {
    console.error('[settings/roles][GET] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (!auth.ok) return auth.response
    const perm = await requirePermission(request, 'settings.manage-role-permissions')
    if (!perm.ok) return perm.response
    const subdomain = getTenantFromRequest(request)
    if (!subdomain) return NextResponse.json({ error: 'Missing tenant header' }, { status: 400 })
    const ctx = await getTenantContext(subdomain)
    if (!ctx) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

    const body = await request.json()
    if (!body.code || !body.name) return NextResponse.json({ error: 'code and name are required' }, { status: 400 })

    const role = await prisma.role.upsert({
      where: { tenantId_code: { tenantId: ctx.tenantId, code: body.code } },
      update: {
        name: body.name,
        description: body.description ?? null,
        permissions: Array.isArray(body.permissions) ? body.permissions : [],
        isActive: body.isActive ?? true,
      },
      create: {
        tenantId: ctx.tenantId,
        code: body.code,
        name: body.name,
        description: body.description ?? null,
        permissions: Array.isArray(body.permissions) ? body.permissions : [],
        isActive: body.isActive ?? true,
      },
    })
    return NextResponse.json({ role })
  } catch (error) {
    console.error('[settings/roles][POST] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
