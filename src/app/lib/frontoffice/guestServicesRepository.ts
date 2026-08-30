import { prisma } from '../database/client'

function stripUndefined<T extends Record<string, any>>(obj: T): Partial<T> {
  const out: Record<string, any> = {}
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v
  }
  return out as Partial<T>
}

/**
 * Ownership-checked upsert: `prisma.model.upsert({ where: { id } })` has no tenant filter
 * (id is the sole unique key), so a naive upsert would silently overwrite another tenant's
 * row on a client-supplied id collision. Check first, then create-or-update explicitly —
 * same pattern used across the app's other repositories.
 */
async function ownershipCheckedUpsert<T>(
  model: { findUnique: (args: any) => Promise<any>; create: (args: any) => Promise<T>; update: (args: any) => Promise<T> },
  id: string,
  tenantId: string,
  data: Record<string, any>,
  createExtra: Record<string, any> = {},
): Promise<T> {
  const existing = await model.findUnique({ where: { id } })
  if (existing && existing.tenantId !== tenantId) {
    throw new Error('Record belongs to a different tenant')
  }
  if (existing) {
    return model.update({ where: { id }, data })
  }
  return model.create({ data: { id, tenantId, ...createExtra, ...data } })
}

// ---------------------------------------------------------------------------
// Guest Services (catalog)
// ---------------------------------------------------------------------------

function toStoreService(row: any) {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    description: row.description ?? '',
    price: Number(row.price || 0),
    status: row.status,
    provider: row.provider ?? '',
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export async function listGuestServices(tenantId: string) {
  const rows = await prisma.guestService.findMany({ where: { tenantId }, orderBy: { name: 'asc' } })
  return rows.map(toStoreService)
}

export async function upsertGuestService(tenantId: string, id: string, service: Record<string, any>) {
  const data = stripUndefined({
    name: service.name,
    category: service.category,
    description: service.description,
    price: service.price,
    status: service.status,
    provider: service.provider,
  })
  const row = await ownershipCheckedUpsert(prisma.guestService, id, tenantId, data, {
    name: service.name,
    category: service.category,
  })
  return toStoreService(row)
}

export async function deleteGuestService(tenantId: string, id: string) {
  const existing = await prisma.guestService.findFirst({ where: { id, tenantId } })
  if (!existing) return false
  await prisma.guestService.delete({ where: { id } })
  return true
}

// ---------------------------------------------------------------------------
// Service Requests (queue)
// ---------------------------------------------------------------------------

function toStoreRequest(row: any) {
  return {
    id: row.id,
    serviceId: row.serviceId,
    guestId: row.guestId ?? undefined,
    reservationId: row.reservationId ?? undefined,
    clientName: row.clientName,
    roomNumber: row.roomNumber ?? '',
    requestDate: row.requestDate,
    status: row.status,
    priority: row.priority,
    notes: row.notes ?? '',
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export async function listServiceRequests(tenantId: string) {
  const rows = await prisma.serviceRequest.findMany({ where: { tenantId }, orderBy: { requestDate: 'desc' } })
  return rows.map(toStoreRequest)
}

export async function upsertServiceRequest(tenantId: string, id: string, request: Record<string, any>) {
  const data = stripUndefined({
    serviceId: request.serviceId,
    guestId: request.guestId,
    reservationId: request.reservationId,
    clientName: request.clientName,
    roomNumber: request.roomNumber,
    requestDate: request.requestDate ? new Date(request.requestDate) : undefined,
    status: request.status,
    priority: request.priority,
    notes: request.notes,
  })
  const row = await ownershipCheckedUpsert(prisma.serviceRequest, id, tenantId, data, {
    serviceId: request.serviceId,
    clientName: request.clientName,
  })
  return toStoreRequest(row)
}

export async function deleteServiceRequest(tenantId: string, id: string) {
  const existing = await prisma.serviceRequest.findFirst({ where: { id, tenantId } })
  if (!existing) return false
  await prisma.serviceRequest.delete({ where: { id } })
  return true
}
