import { NextRequest, NextResponse } from 'next/server'
import { getTenantFromRequest, getTenantContext } from '@/app/lib/api/tenant'
import { requireAuth } from '@/app/lib/api/auth-guard'
import { prisma } from '@/app/lib/database/client'

// `id` here is the role's `code` (the client-side UserRole.id, e.g. 'admin'
// or a generated 'role_<timestamp>') — the same slug used everywhere else
// this Role is looked up, not the DB row's own cuid.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth(request)
    if (!auth.ok) return auth.response
    const subdomain = getTenantFromRequest(request)
    if (!subdomain) return NextResponse.json({ error: 'Missing tenant header' }, { status: 400 })
    const ctx = await getTenantContext(subdomain)
    if (!ctx) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

    const { id: code } = await params
    const body = await request.json()
    const data: Record<string, unknown> = {}
    if (typeof body.name === 'string') data.name = body.name
    if (typeof body.description === 'string' || body.description === null) data.description = body.description
    if (Array.isArray(body.permissions)) data.permissions = body.permissions
    if (typeof body.isActive === 'boolean') data.isActive = body.isActive

    const role = await prisma.role.update({
      where: { tenantId_code: { tenantId: ctx.tenantId, code } },
      data,
    }).catch(() => null)
    if (!role) return NextResponse.json({ error: 'Role not found' }, { status: 404 })
    return NextResponse.json({ role })
  } catch (error) {
    console.error('[settings/roles/:id][PATCH] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth(request)
    if (!auth.ok) return auth.response
    const subdomain = getTenantFromRequest(request)
    if (!subdomain) return NextResponse.json({ error: 'Missing tenant header' }, { status: 400 })
    const ctx = await getTenantContext(subdomain)
    if (!ctx) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

    const { id: code } = await params
    const role = await prisma.role.delete({
      where: { tenantId_code: { tenantId: ctx.tenantId, code } },
    }).catch(() => null)
    if (!role) return NextResponse.json({ error: 'Role not found' }, { status: 404 })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[settings/roles/:id][DELETE] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
