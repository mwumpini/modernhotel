import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/auth'
import { prisma } from '../database/client'
import { normalizeTenantSubdomain } from './tenantSubdomain'

export { normalizeTenantSubdomain } from './tenantSubdomain'

export interface TenantContext {
  tenantId: string
  tenant: any
  user?: any
}

/**
 * Extract tenant information from request headers
 */
export function getTenantFromRequest(request: NextRequest): string | null {
  const raw =
    request.headers.get('x-tenant-subdomain') ||
    request.headers.get('x-tenant-id');
  return raw ? normalizeTenantSubdomain(raw) : null;
}

async function ensureDemoTenantDev() {
  return prisma.tenant.upsert({
    where: { subdomain: 'demo' },
    update: {},
    create: {
      name: 'Demo Hotel',
      subdomain: 'demo',
      plan: 'professional',
      status: 'active',
      maxUsers: 10,
      maxRooms: 50,
      maxProperties: 2,
      features: { housekeeping: true, inventory: true, reporting: true },
      metadata: { region: 'ghana', industry: 'hospitality' },
    },
  });
}

/**
 * Get tenant context from subdomain
 */
export async function getTenantContext(subdomain: string): Promise<TenantContext | null> {
  try {
    const normalized = normalizeTenantSubdomain(subdomain)

    let tenant = await prisma.tenant.findUnique({
      where: { subdomain: normalized },
    })

    if (!tenant && normalized === 'demo' && process.env.NODE_ENV === 'development') {
      console.warn('[tenant] demo missing — auto-creating for local dev')
      tenant = await ensureDemoTenantDev()
    }

    if (!tenant) {
      console.warn(`[tenant] not found: raw="${subdomain}" normalized="${normalized}"`)
      return null
    }

    // Ownership check: if the caller has an authenticated session, it must belong to THIS
    // tenant -- a logged-in user must never be able to read/write another tenant's data just
    // by sending a different x-tenant-subdomain/x-tenant-id header. Deliberately scoped to
    // *only* run this check when a session exists: routes that don't require auth at all (no
    // session present) are completely unaffected by this change -- it adds an ownership check
    // wherever auth already exists, it does not newly require auth anywhere. (validateTenantAccess
    // below was written to do this same check but was never actually called from anywhere.)
    const session = await getServerSession(authOptions).catch(() => null)
    const sessionTenantId = (session as any)?.user?.tenantId
    if (sessionTenantId && sessionTenantId !== tenant.id) {
      console.warn(
        `[tenant] cross-tenant access blocked: session tenant="${sessionTenantId}" requested tenant="${tenant.id}" (${normalized})`
      )
      return null
    }

    return {
      tenantId: tenant.id,
      tenant
    }
  } catch (error) {
    console.error('Error getting tenant context:', error)
    return null
  }
}

/**
 * Create tenant-aware database query
 */
export function withTenant<T extends { tenantId: string }>(
  query: any,
  tenantId: string
): any {
  return {
    ...query,
    where: {
      ...query.where,
      tenantId
    }
  }
}

/**
 * Validate tenant access
 */
export async function validateTenantAccess(
  tenantId: string,
  userId?: string
): Promise<boolean> {
  try {
    if (userId) {
      const user = await prisma.user.findFirst({
        where: {
          id: userId,
          tenantId,
          isActive: true
        }
      })
      return !!user
    }
    return true
  } catch (error) {
    console.error('Error validating tenant access:', error)
    return false
  }
}

/**
 * Create audit log entry
 */
export async function createAuditLog(
  tenantId: string,
  userId: string | null,
  action: string,
  entity: string,
  entityId?: string,
  oldValues?: any,
  newValues?: any,
  request?: NextRequest
) {
  try {
    await prisma.auditLog.create({
      data: {
        tenantId,
        userId,
        action,
        entity,
        entityId,
        oldValues: oldValues ? JSON.stringify(oldValues) : null,
        newValues: newValues ? JSON.stringify(newValues) : null,
        ipAddress: request?.headers.get('x-forwarded-for') || 
                  request?.headers.get('x-real-ip') || 
                  'unknown',
        userAgent: request?.headers.get('user-agent') || 'unknown'
      }
    })
  } catch (error) {
    console.error('Error creating audit log:', error)
  }
}
