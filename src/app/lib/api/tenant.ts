import { NextRequest } from 'next/server'
import { prisma } from '../database/client'

export interface TenantContext {
  tenantId: string
  tenant: any
  user?: any
}

/**
 * Extract tenant information from request headers
 */
export function getTenantFromRequest(request: NextRequest): string | null {
  const subdomain = request.headers.get('x-tenant-subdomain')
  return subdomain || null
}

/**
 * Get tenant context from subdomain
 */
export async function getTenantContext(subdomain: string): Promise<TenantContext | null> {
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { subdomain },
      include: {
        settings: true
      }
    })

    if (!tenant) {
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
