import { prisma } from '../database/client'

function stripUndefined<T extends Record<string, any>>(obj: T): Partial<T> {
  const out: Record<string, any> = {}
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v
  }
  return out as Partial<T>
}

/** Ownership-checked upsert — see eventsRepository.ts for the full rationale. */
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
// Restaurant Tables
// ---------------------------------------------------------------------------

function toStoreTable(row: any) {
  return {
    id: row.id,
    number: row.number,
    capacity: row.capacity,
    section: row.section ?? undefined,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export async function listRestaurantTables(tenantId: string) {
  const rows = await prisma.restaurantTable.findMany({ where: { tenantId }, orderBy: { number: 'asc' } })
  return rows.map(toStoreTable)
}

export async function upsertRestaurantTable(tenantId: string, id: string, table: Record<string, any>) {
  const data = stripUndefined({
    number: table.number,
    capacity: table.capacity,
    section: table.section,
    status: table.status,
  })
  const row = await ownershipCheckedUpsert(prisma.restaurantTable, id, tenantId, data, {
    number: table.number,
    capacity: table.capacity ?? 2,
  })
  return toStoreTable(row)
}

export async function deleteRestaurantTable(tenantId: string, id: string) {
  const existing = await prisma.restaurantTable.findFirst({ where: { id, tenantId } })
  if (!existing) return false
  await prisma.restaurantTable.delete({ where: { id } })
  return true
}

// ---------------------------------------------------------------------------
// Table Reservations
// ---------------------------------------------------------------------------

function toStoreReservation(row: any) {
  return {
    id: row.id,
    customerName: row.customerName,
    phone: row.phone ?? '',
    tableId: row.tableId ?? undefined,
    tableNumber: row.table?.number ?? undefined,
    reservationDate: row.reservationDate,
    time: row.time,
    guests: row.guests,
    status: row.status,
    specialRequests: row.specialRequests ?? '',
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export async function listTableReservations(tenantId: string) {
  const rows = await prisma.tableReservation.findMany({
    where: { tenantId },
    include: { table: true },
    orderBy: { reservationDate: 'desc' },
  })
  return rows.map(toStoreReservation)
}

export async function upsertTableReservation(tenantId: string, id: string, reservation: Record<string, any>) {
  const data = stripUndefined({
    customerName: reservation.customerName,
    phone: reservation.phone,
    tableId: reservation.tableId,
    reservationDate: reservation.reservationDate ? new Date(reservation.reservationDate) : undefined,
    time: reservation.time,
    guests: reservation.guests,
    status: reservation.status,
    specialRequests: reservation.specialRequests,
  })
  const row = await ownershipCheckedUpsert(prisma.tableReservation, id, tenantId, data, {
    customerName: reservation.customerName,
    reservationDate: reservation.reservationDate ? new Date(reservation.reservationDate) : new Date(),
    time: reservation.time,
  })
  const withTable = await prisma.tableReservation.findUnique({ where: { id: row.id }, include: { table: true } })
  return toStoreReservation(withTable)
}

export async function deleteTableReservation(tenantId: string, id: string) {
  const existing = await prisma.tableReservation.findFirst({ where: { id, tenantId } })
  if (!existing) return false
  await prisma.tableReservation.delete({ where: { id } })
  return true
}
