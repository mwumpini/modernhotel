import { prisma } from '../database/client'

function stripUndefined<T extends Record<string, any>>(obj: T): Partial<T> {
  const out: Record<string, any> = {}
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v
  }
  return out as Partial<T>
}

/** Ownership-checked upsert — see guestServicesRepository.ts for the full rationale. */
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
// Conference Halls
// ---------------------------------------------------------------------------

function toStoreHall(row: any) {
  return {
    id: row.id,
    name: row.name,
    capacity: row.capacity,
    type: row.type,
    status: row.status,
    price: Number(row.price || 0),
    features: Array.isArray(row.features) ? row.features : [],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export async function listConferenceHalls(tenantId: string) {
  const rows = await prisma.conferenceHall.findMany({ where: { tenantId }, orderBy: { name: 'asc' } })
  return rows.map(toStoreHall)
}

export async function upsertConferenceHall(tenantId: string, id: string, hall: Record<string, any>) {
  const data = stripUndefined({
    name: hall.name,
    capacity: hall.capacity,
    type: hall.type,
    status: hall.status,
    price: hall.price,
    features: hall.features,
  })
  const row = await ownershipCheckedUpsert(prisma.conferenceHall, id, tenantId, data, {
    name: hall.name,
    capacity: hall.capacity ?? 0,
    type: hall.type,
  })
  return toStoreHall(row)
}

export async function deleteConferenceHall(tenantId: string, id: string) {
  const existing = await prisma.conferenceHall.findFirst({ where: { id, tenantId } })
  if (!existing) return false
  await prisma.conferenceHall.delete({ where: { id } })
  return true
}

// ---------------------------------------------------------------------------
// Catering Items
// ---------------------------------------------------------------------------

function toStoreCateringItem(row: any) {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? '',
    price: Number(row.price || 0),
    category: row.category,
    minimumOrder: row.minimumOrder,
    available: row.available,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export async function listCateringItems(tenantId: string) {
  const rows = await prisma.cateringItem.findMany({ where: { tenantId }, orderBy: { name: 'asc' } })
  return rows.map(toStoreCateringItem)
}

export async function upsertCateringItem(tenantId: string, id: string, item: Record<string, any>) {
  const data = stripUndefined({
    name: item.name,
    description: item.description,
    price: item.price,
    category: item.category,
    minimumOrder: item.minimumOrder,
    available: item.available,
  })
  const row = await ownershipCheckedUpsert(prisma.cateringItem, id, tenantId, data, {
    name: item.name,
    category: item.category,
  })
  return toStoreCateringItem(row)
}

export async function deleteCateringItem(tenantId: string, id: string) {
  const existing = await prisma.cateringItem.findFirst({ where: { id, tenantId } })
  if (!existing) return false
  await prisma.cateringItem.delete({ where: { id } })
  return true
}

// ---------------------------------------------------------------------------
// Event Bookings
// ---------------------------------------------------------------------------

function toStoreEventBooking(row: any) {
  return {
    id: row.id,
    title: row.title,
    organizer: row.organizer,
    contactPerson: row.contactPerson ?? '',
    contactPhone: row.contactPhone ?? '',
    contactEmail: row.contactEmail ?? '',
    hallId: row.hallId ?? '',
    hallName: row.hallName ?? '',
    startDate: row.startDate,
    endDate: row.endDate,
    startTime: row.startTime ?? '',
    endTime: row.endTime ?? '',
    attendees: row.attendees,
    status: row.status,
    type: row.type ?? undefined,
    catering: row.catering,
    audioVisual: row.audioVisual,
    decoration: row.decoration,
    totalCost: Number(row.totalCost || 0),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export async function listEventBookings(tenantId: string) {
  const rows = await prisma.eventBooking.findMany({ where: { tenantId }, orderBy: { startDate: 'desc' } })
  return rows.map(toStoreEventBooking)
}

export async function upsertEventBooking(tenantId: string, id: string, booking: Record<string, any>) {
  const data = stripUndefined({
    title: booking.title,
    organizer: booking.organizer,
    contactPerson: booking.contactPerson,
    contactPhone: booking.contactPhone,
    contactEmail: booking.contactEmail,
    hallId: booking.hallId,
    hallName: booking.hallName,
    startDate: booking.startDate ? new Date(booking.startDate) : undefined,
    endDate: booking.endDate ? new Date(booking.endDate) : undefined,
    startTime: booking.startTime,
    endTime: booking.endTime,
    attendees: booking.attendees,
    status: booking.status,
    type: booking.type,
    catering: booking.catering,
    audioVisual: booking.audioVisual,
    decoration: booking.decoration,
    totalCost: booking.totalCost,
  })
  const row = await ownershipCheckedUpsert(prisma.eventBooking, id, tenantId, data, {
    title: booking.title,
    organizer: booking.organizer,
    startDate: booking.startDate ? new Date(booking.startDate) : new Date(),
    endDate: booking.endDate ? new Date(booking.endDate) : new Date(),
  })
  return toStoreEventBooking(row)
}

export async function deleteEventBooking(tenantId: string, id: string) {
  const existing = await prisma.eventBooking.findFirst({ where: { id, tenantId } })
  if (!existing) return false
  await prisma.eventBooking.delete({ where: { id } })
  return true
}
