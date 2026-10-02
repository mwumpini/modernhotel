import { requireAuth } from '@/app/lib/api/auth-guard'
import { NextRequest, NextResponse } from 'next/server'
import { getTenantFromRequest, getTenantContext } from '@/app/lib/api/tenant'
import { prisma } from '@/app/lib/database/client'
import { ensureDefaultRolesForTenant, roleGrantsModule } from '@/app/lib/settings/roleRepository'
import { hasPin } from '@/app/lib/auth/posPin'

const SERVICE_DEPT_HINTS = ['food', 'beverage', 'restaurant', 'bar'];

function normName(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Food & Beverage, restaurant, or bar — a Kitchen department is a different station. */
function isServiceDepartment(name: string) {
  const n = name.toLowerCase();
  if (n.includes('kitchen')) return false;
  return SERVICE_DEPT_HINTS.some((hint) => n.includes(hint));
}

function isServicePosition(title: string) {
  return /waiter|waitress|bartender|barman|server/.test(title.toLowerCase());
}

/**
 * GET /api/tenant
 * Returns tenant display name and active staff list (for POS waiter select,
 * and — filtered via ?module=<prefix> — for pickers like Kitchen's "assign
 * cook" that should only offer staff whose role actually grants that module).
 * ?assigned=fb limits the list to waiters and people assigned to Food & Beverage.
 * A manager role that can open Restaurant is not enough.
 */
export async function GET(request: NextRequest) {
  try {
    // Staff names and roles are for signed-in users of this hotel only.
    const auth = await requireAuth(request)
    if (!auth.ok) return auth.response
    const subdomain = getTenantFromRequest(request)
    if (!subdomain) return NextResponse.json({ error: 'Missing tenant header' }, { status: 400 })
    const ctx = await getTenantContext(subdomain)
    if (!ctx) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

    // Pull tenant name
    const tenant = await prisma.tenant.findUnique({
      where: { id: ctx.tenantId },
      select: { name: true },
    })

    const users = await prisma.user.findMany({
      where: { tenantId: ctx.tenantId, isActive: true },
      select: { id: true, name: true, email: true, role: true, preferences: true, profile: true },
      orderBy: { name: 'asc' },
    })

    const modulePrefix = request.nextUrl.searchParams.get('module')
    const assigned = request.nextUrl.searchParams.get('assigned')
    let scopedUsers = users
    let assignedOnly: { id: string; name: string; role: string; hasPin: boolean }[] | null = null
    if (assigned === 'fb') {
      const [departments, positions, employees] = await Promise.all([
        prisma.hrDepartment.findMany({ where: { tenantId: ctx.tenantId }, select: { id: true, name: true } }),
        prisma.hrPosition.findMany({ where: { tenantId: ctx.tenantId }, select: { id: true, title: true } }),
        prisma.hrEmployee.findMany({
          where: { tenantId: ctx.tenantId, status: 'active' },
          select: { id: true, firstName: true, lastName: true, email: true, departmentId: true, positionId: true },
        }),
      ])
      const deptName = new Map(departments.map((d) => [d.id, d.name || '']))
      const posTitle = new Map(positions.map((p) => [p.id, p.title || '']))
      const serviceEmployees = employees.filter((employee) => {
        const department = deptName.get(employee.departmentId || '') || ''
        const title = posTitle.get(employee.positionId || '') || ''
        return isServiceDepartment(department) || isServicePosition(title)
      })
      const matchedEmployeeIds = new Set<string>()
      const serviceUsers = users.filter((user) => {
        const profile = (user.profile || {}) as { department?: string; position?: string }
        const email = normName(user.email || '')
        const name = normName(user.name || '')
        const match = serviceEmployees.find((employee) => {
          const employeeName = normName(`${employee.firstName || ''} ${employee.lastName || ''}`)
          return (email && normName(employee.email || '') === email) || (name && employeeName === name)
        })
        if (match) matchedEmployeeIds.add(match.id)
        const assignedOnProfile = isServiceDepartment(String(profile.department || '')) || isServicePosition(String(profile.position || ''))
        return assignedOnProfile || !!match
      })
      assignedOnly = [
        ...serviceUsers.map((user) => ({ id: user.id, name: user.name, role: user.role, hasPin: hasPin(user.preferences) })),
        ...serviceEmployees
          .filter((employee) => !matchedEmployeeIds.has(employee.id))
          .map((employee) => ({
            id: employee.id,
            name: `${employee.firstName || ''} ${employee.lastName || ''}`.trim(),
            role: posTitle.get(employee.positionId || '') || 'Waiter',
            hasPin: false,
          })),
      ].sort((a, b) => a.name.localeCompare(b.name))
    } else if (modulePrefix) {
      await ensureDefaultRolesForTenant(ctx.tenantId)
      const roles = await prisma.role.findMany({ where: { tenantId: ctx.tenantId }, select: { code: true, permissions: true } })
      const permissionsByCode = new Map(roles.map((r) => [r.code, (Array.isArray(r.permissions) ? r.permissions : []) as string[]]))
      scopedUsers = users.filter((u) => roleGrantsModule(permissionsByCode.get(u.role) ?? [], modulePrefix))
    }

    // Try to get hotel name from SystemSettings if available
    let hotelName = tenant?.name ?? 'Hotel'
    try {
      const settings = await prisma.systemSettings.findUnique({
        where: { tenantId: ctx.tenantId },
        select: { hotelSettings: true },
      })
      if (settings?.hotelSettings) {
        const hs = settings.hotelSettings as any
        if (hs?.propertyName) hotelName = hs.propertyName
        else if (hs?.hotelName) hotelName = hs.hotelName
      }
    } catch { /* use tenant name fallback */ }

    return NextResponse.json({
      hotelName,
      // hasPin: whether this person can switch in on the shared POS terminal (the PIN itself never leaves the server).
      staff: assignedOnly ?? scopedUsers.map(u => ({ id: u.id, name: u.name, role: u.role, hasPin: hasPin(u.preferences) })),
    })
  } catch (error) {
    console.error('[/api/tenant][GET] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
