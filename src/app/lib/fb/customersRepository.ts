import { prisma } from '../database/client'

function stripUndefined<T extends Record<string, any>>(obj: T): Partial<T> {
  const out: Record<string, any> = {}
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v
  }
  return out as Partial<T>
}

/** Ownership-checked upsert — see tablesRepository.ts for the full rationale. */
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

function toStoreCustomer(row: any) {
  return {
    id: row.id,
    firstName: row.firstName,
    lastName: row.lastName,
    email: row.email ?? undefined,
    phone: row.phone ?? undefined,
    address: row.address ?? undefined,
    loyaltyPoints: row.loyaltyPoints,
    totalSpent: Number(row.totalSpent),
    visitCount: row.visitCount,
    lastVisit: row.lastVisit ? new Date(row.lastVisit).toISOString() : undefined,
    preferences: row.preferences ?? undefined,
    isActive: row.isActive,
    createdAt: new Date(row.createdAt).toISOString(),
  }
}

export async function listFBCustomers(tenantId: string) {
  const rows = await prisma.fBCustomer.findMany({ where: { tenantId }, orderBy: { lastName: 'asc' } })
  return rows.map(toStoreCustomer)
}

export async function upsertFBCustomer(tenantId: string, id: string, customer: Record<string, any>) {
  const data = stripUndefined({
    firstName: customer.firstName,
    lastName: customer.lastName,
    email: customer.email,
    phone: customer.phone,
    address: customer.address,
    preferences: customer.preferences,
    isActive: customer.isActive,
  })
  const row = await ownershipCheckedUpsert(prisma.fBCustomer, id, tenantId, data, {
    firstName: customer.firstName,
    lastName: customer.lastName,
  })
  return toStoreCustomer(row)
}

/** Atomic increment — visitCount/totalSpent/loyaltyPoints, called once per order,
 *  so concurrent orders for the same customer never clobber each other's tally
 *  (unlike a read-modify-write from the client). */
export async function recordFBCustomerVisit(tenantId: string, id: string, orderAmount: number) {
  const existing = await prisma.fBCustomer.findFirst({ where: { id, tenantId } })
  if (!existing) return null
  const pointsEarned = Math.floor(orderAmount)
  const row = await prisma.fBCustomer.update({
    where: { id },
    data: {
      visitCount: { increment: 1 },
      totalSpent: { increment: orderAmount },
      loyaltyPoints: { increment: pointsEarned },
      lastVisit: new Date(),
    },
  })
  return toStoreCustomer(row)
}
