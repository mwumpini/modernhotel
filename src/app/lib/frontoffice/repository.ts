import { prisma } from '../database/client'
import { Reservation, GuestProfile, Folio } from './types'
import { loadFolioRounding, mergedFolioWrite } from './folioServer'
import { asLineArray } from './folioLedger'

function stripUndefined<T extends Record<string, any>>(obj: T): Partial<T> {
  const out: Record<string, any> = {}
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v
  }
  return out as Partial<T>
}

const toISO = (v: any): string =>
  v instanceof Date ? v.toISOString() : (v ?? new Date().toISOString())

// Unlike toISO, doesn't default a missing value to "now" — for fields that
// are legitimately absent (an event that hasn't happened yet), defaulting
// to "now" would fabricate a timestamp instead of reporting it as unset.
const toISOOrUndefined = (v: any): string | undefined =>
  v instanceof Date ? v.toISOString() : (v ?? undefined)

// ---------------------------------------------------------------------------
// Reservation mapping
// ---------------------------------------------------------------------------

export function toStoreReservation(row: any): Reservation {
  const details = (row.details || {}) as Record<string, any>
  return {
    id: row.id,
    resId: row.resId || undefined,
    guestId: row.guestId,
    guestName: row.guest?.name || details.guestName || 'Guest',
    roomTypeId: row.roomType || details.roomTypeId || '',
    ratePlanId: row.ratePlanId || undefined,
    arrival: toISO(row.checkInDate),
    departure: toISO(row.checkOutDate),
    status: (row.status as any) || 'pending',
    source: row.source || undefined,
    roomId: row.roomId || undefined,
    adults: row.adults ?? 1,
    children: row.children ?? 0,
    isGuaranteed: !!row.isGuaranteed,
    stayReason: (row.stayReason as any) || 'personal',
    billingPersonId: row.billingPersonId || undefined,
    companyName: row.companyName || undefined,
    groupId: row.groupId || undefined,
    groupSize: row.groupSize ?? undefined,
    isGroupLeader: !!row.isGroupLeader,
    linkedReservationId: row.linkedReservationId || undefined,
    remarksToGuest: row.specialRequests || details.remarksToGuest || undefined,
    // Long-tail fields preserved in the JSON column
    marketCodes: details.marketCodes || [],
    internalNotes: details.internalNotes,
    stayReasonDetails: details.stayReasonDetails,
    projectCode: details.projectCode,
    costCenter: details.costCenter,
    billingPersonName: details.billingPersonName,
    guestPhone: details.guestPhone,
    guestEmail: details.guestEmail,
    paymentMethod: details.paymentMethod,
    paymentStatus: details.paymentStatus,
    amountPaid: details.amountPaid,
    rateBreakdown: details.rateBreakdown || undefined,
    deposit: details.deposit,
    isSelfReservation: details.isSelfReservation,
    selfReservationToken: details.selfReservationToken,
    invoiceGenerated: details.invoiceGenerated,
    invoiceStatus: details.invoiceStatus,
    pendingGlPost: details.pendingGlPost,
    taxExempt: details.taxExempt,
    taxExemptionType: details.taxExemptionType,
    taxExemptionNumber: details.taxExemptionNumber,
    taxExemptionAuthority: details.taxExemptionAuthority,
    taxExemptionExpiry: details.taxExemptionExpiry,
    taxExemptionDocuments: details.taxExemptionDocuments || [],
    taxExemptionNotes: details.taxExemptionNotes,
    waiveLateCheckoutFee: details.waiveLateCheckoutFee,
    companyBillStatus: details.companyBillStatus,
    checkedInAt: toISOOrUndefined(row.checkedInAt),
    checkedOutAt: toISOOrUndefined(row.checkedOutAt),
    createdAt: toISO(row.createdAt),
    updatedAt: toISO(row.updatedAt),
  } as Reservation
}

export function toDbReservationData(r: Partial<Reservation>) {
  const details = stripUndefined({
    guestName: r.guestName,
    roomTypeId: r.roomTypeId,
    marketCodes: r.marketCodes,
    internalNotes: r.internalNotes,
    stayReasonDetails: r.stayReasonDetails,
    projectCode: r.projectCode,
    costCenter: r.costCenter,
    billingPersonName: r.billingPersonName,
    guestPhone: r.guestPhone,
    guestEmail: r.guestEmail,
    paymentMethod: r.paymentMethod,
    paymentStatus: r.paymentStatus,
    amountPaid: r.amountPaid,
    rateBreakdown: r.rateBreakdown,
    deposit: r.deposit,
    isSelfReservation: r.isSelfReservation,
    selfReservationToken: r.selfReservationToken,
    invoiceGenerated: r.invoiceGenerated,
    invoiceStatus: r.invoiceStatus,
    taxExempt: r.taxExempt,
    taxExemptionType: r.taxExemptionType,
    taxExemptionNumber: r.taxExemptionNumber,
    taxExemptionAuthority: r.taxExemptionAuthority,
    taxExemptionExpiry: r.taxExemptionExpiry,
    taxExemptionDocuments: r.taxExemptionDocuments,
    taxExemptionNotes: r.taxExemptionNotes,
    waiveLateCheckoutFee: r.waiveLateCheckoutFee,
    companyBillStatus: r.companyBillStatus,
  })
  const data: Record<string, any> = stripUndefined({
    resId: r.resId,
    roomType: r.roomTypeId,
    ratePlanId: r.ratePlanId,
    roomId: r.roomId,
    status: r.status,
    source: r.source,
    adults: r.adults,
    children: r.children,
    specialRequests: r.remarksToGuest,
    stayReason: r.stayReason,
    isGuaranteed: r.isGuaranteed,
    billingPersonId: r.billingPersonId,
    companyName: r.companyName,
    groupId: r.groupId,
    isGroupLeader: r.isGroupLeader,
    linkedReservationId: r.linkedReservationId,
    groupSize: r.groupSize,
    checkInDate: r.arrival ? new Date(r.arrival) : undefined,
    checkOutDate: r.departure ? new Date(r.departure) : undefined,
    checkedInAt: r.checkedInAt ? new Date(r.checkedInAt) : undefined,
    checkedOutAt: r.checkedOutAt ? new Date(r.checkedOutAt) : undefined,
  })
  if (Object.keys(details).length) data.details = details
  return data
}

export async function listReservations(tenantId: string): Promise<Reservation[]> {
  const rows = await prisma.reservation.findMany({
    where: { tenantId },
    include: { guest: true },
    orderBy: { createdAt: 'desc' },
  })
  return rows.map(toStoreReservation)
}

export async function createReservationRow(
  tenantId: string,
  guestId: string,
  r: Partial<Reservation>,
): Promise<Reservation> {
  if (!r.arrival || !r.departure) {
    throw new Error('arrival and departure are required')
  }
  const data = toDbReservationData(r)
  const row = await prisma.reservation.create({
    data: {
      tenantId,
      guestId,
      // Honor the store-supplied id so the DB row matches the client's id and
      // synchronous follow-up operations (check-in, assign room) keep working.
      ...(r.id ? { id: r.id } : {}),
      status: r.status || 'pending',
      adults: r.adults ?? 1,
      children: r.children ?? 0,
      ...data,
      checkInDate: new Date(r.arrival),
      checkOutDate: new Date(r.departure),
    } as any,
    include: { guest: true },
  })
  return toStoreReservation(row)
}

export class GuestNotInHotelError extends Error {
  constructor() {
    super('That guest is not on this hotel\'s guest list')
  }
}

export async function updateReservationRow(
  tenantId: string,
  id: string,
  patch: Partial<Reservation>,
): Promise<Reservation | null> {
  const existing = await prisma.reservation.findFirst({ where: { id, tenantId } })
  if (!existing) return null
  const data = toDbReservationData(patch)
  if (data.details) {
    data.details = { ...((existing.details as any) || {}), ...data.details }
  }
  // Switching the booking to another guest: only a guest of the same hotel.
  if (typeof patch.guestId === 'string' && patch.guestId && patch.guestId !== existing.guestId) {
    const guest = await prisma.guest.findFirst({ where: { id: patch.guestId, tenantId }, select: { id: true } })
    if (!guest) throw new GuestNotInHotelError()
    data.guestId = patch.guestId
  }
  const row = await prisma.reservation.update({
    where: { id },
    data: data as any,
    include: { guest: true },
  })
  return toStoreReservation(row)
}

/**
 * Hard-delete a reservation that never became a stay. Refused once it is past
 * pending or its folio holds any charge or payment (those are voided instead,
 * so the money stays on file). Folios are not linked by a foreign key, so an
 * empty folio is removed here too rather than left orphaned.
 */
export async function deleteReservationRow(
  tenantId: string,
  id: string,
): Promise<'deleted' | 'not-found' | 'not-pending' | 'has-money'> {
  const existing = await prisma.reservation.findFirst({ where: { id, tenantId } })
  if (!existing) return 'not-found'
  if (existing.status !== 'pending') return 'not-pending'
  const folios = await prisma.guestFolio.findMany({ where: { tenantId, reservationId: id } })
  const hasMoney = folios.some((f) => asLineArray(f.charges).length > 0 || asLineArray(f.payments).length > 0)
  if (hasMoney) return 'has-money'
  await prisma.$transaction([
    prisma.guestFolio.deleteMany({ where: { tenantId, reservationId: id } }),
    prisma.reservation.delete({ where: { id } }),
  ])
  return 'deleted'
}

// Date-range overlap against active reservations for the same room.
export async function isRoomAvailable(
  tenantId: string,
  roomId: string,
  arrival: string,
  departure: string,
  excludeReservationId?: string,
): Promise<boolean> {
  const overlap = await prisma.reservation.findFirst({
    where: {
      tenantId,
      roomId,
      ...(excludeReservationId ? { id: { not: excludeReservationId } } : {}),
      status: { in: ['pending', 'confirmed', 'checked-in'] },
      checkInDate: { lt: new Date(departure) },
      checkOutDate: { gt: new Date(arrival) },
    },
  })
  return !overlap
}

// ---------------------------------------------------------------------------
// Guest mapping
// ---------------------------------------------------------------------------

export function toStoreGuest(row: any): GuestProfile {
  const details = (row.details || {}) as Record<string, any>
  return {
    ...details,
    id: row.id,
    serialNumber: row.serialNumber,
    name: row.name,
    firstName: row.firstName || details.firstName || (row.name?.split(' ')[0] ?? ''),
    lastName: row.lastName || details.lastName || (row.name?.split(' ').slice(1).join(' ') ?? ''),
    email: row.email || undefined,
    phone: row.phone || undefined,
    nationality: (row.nationality as any) || 'ghanaian',
    idType: (row.idType as any) || 'ghana_card',
    idNumber: row.idNumber || details.idNumber || '',
    vipStatus: row.vipStatus || undefined,
    source: row.source || undefined,
    emergencyContact: details.emergencyContact || { name: '', relationship: 'other', phone: '' },
    isActive: row.isActive !== false,
    createdAt: toISO(row.createdAt),
    updatedAt: toISO(row.updatedAt),
  } as GuestProfile
}

export function toDbGuestData(g: Partial<GuestProfile>) {
  const details = stripUndefined({
    middleName: g.middleName,
    dateOfBirth: g.dateOfBirth,
    gender: g.gender,
    address: g.address,
    city: g.city,
    country: g.country,
    notes: g.notes,
    company: g.company,
    employerCompany: g.employerCompany,
    jobTitle: g.jobTitle,
    billingContactName: g.billingContactName,
    billingContactEmail: g.billingContactEmail,
    billingContactPhone: g.billingContactPhone,
    secondaryPhone: g.secondaryPhone,
    emergencyContact: g.emergencyContact,
    preferences: g.preferences,
    creditBalance: g.creditBalance,
    creditLimit: g.creditLimit,
    creditStatus: g.creditStatus,
  })
  const data: Record<string, any> = stripUndefined({
    name: g.name || (g.firstName ? `${g.firstName} ${g.lastName || ''}`.trim() : undefined),
    firstName: g.firstName,
    lastName: g.lastName,
    email: g.email,
    phone: g.phone,
    nationality: g.nationality,
    ghanaCard: (g as any).ghanaCard,
    idType: g.idType,
    idNumber: g.idNumber,
    vipStatus: g.vipStatus,
    source: g.source,
    isActive: typeof g.isActive === 'boolean' ? g.isActive : undefined,
  })
  if (Object.keys(details).length) data.details = details
  return data
}

export async function listGuests(
  tenantId: string,
  search?: string,
  opts?: { includeInactive?: boolean },
): Promise<GuestProfile[]> {
  const where: Record<string, any> = { tenantId }
  if (!opts?.includeInactive) where.isActive = true
  if (search) {
    where.OR = [
      { name: { contains: search } },
      { email: { contains: search } },
      { phone: { contains: search } },
      { serialNumber: { contains: search } },
    ]
  }
  const rows = await prisma.guest.findMany({ where, orderBy: { createdAt: 'desc' } })
  return rows.map(toStoreGuest)
}

export async function createGuestRow(tenantId: string, g: Partial<GuestProfile>): Promise<GuestProfile> {
  // serialNumber is globally unique. Honor a client-supplied value only if it is
  // still free; otherwise allocate the next available C### so persistence never
  // fails on a counter that has drifted from the database.
  let serialNumber = g.serialNumber
  if (!serialNumber || (await prisma.guest.findUnique({ where: { serialNumber } }))) {
    const last = await prisma.guest.findFirst({ where: { tenantId }, orderBy: { serialNumber: 'desc' } })
    let n = 1
    if (last?.serialNumber) {
      const parsed = parseInt(last.serialNumber.replace(/\D/g, ''))
      if (!isNaN(parsed)) n = parsed + 1
    }
    serialNumber = `C${n.toString().padStart(3, '0')}`
    while (await prisma.guest.findUnique({ where: { serialNumber } })) {
      n += 1
      serialNumber = `C${n.toString().padStart(3, '0')}`
    }
  }
  const data = toDbGuestData(g)
  const row = await prisma.guest.create({
    data: {
      tenantId,
      ...(g.id ? { id: g.id } : {}),
      serialNumber,
      name: data.name || g.name || 'Guest',
      ...data,
      isActive: true,
    } as any,
  })
  return toStoreGuest(row)
}

export async function updateGuestRow(
  tenantId: string,
  id: string,
  patch: Partial<GuestProfile>,
): Promise<GuestProfile | null> {
  const existing = await prisma.guest.findFirst({ where: { id, tenantId } })
  if (!existing) return null
  const data = toDbGuestData(patch)
  if (data.details) {
    data.details = { ...((existing.details as any) || {}), ...data.details }
  }
  const row = await prisma.guest.update({ where: { id }, data: data as any })
  return toStoreGuest(row)
}

export async function guestHasHistory(tenantId: string, id: string): Promise<number> {
  const [reservations, folios, orders, requests] = await Promise.all([
    prisma.reservation.count({ where: { tenantId, guestId: id } }),
    prisma.folio.count({ where: { tenantId, guestId: id } }),
    prisma.fBOrder.count({ where: { tenantId, guestId: id } }),
    prisma.serviceRequest.count({ where: { tenantId, guestId: id } }),
  ])
  return reservations + folios + orders + requests
}

export async function deleteGuestRow(
  tenantId: string,
  id: string,
): Promise<{ deleted?: boolean; deactivated?: boolean; used?: number; guest?: GuestProfile | null } | null> {
  const existing = await prisma.guest.findFirst({ where: { id, tenantId } })
  if (!existing) return null
  const used = await guestHasHistory(tenantId, id)
  if (used > 0) {
    const row = await prisma.guest.update({ where: { id }, data: { isActive: false } })
    return { deactivated: true, used, guest: toStoreGuest(row) }
  }
  await prisma.guest.delete({ where: { id } })
  return { deleted: true }
}

// ---------------------------------------------------------------------------
// Folio mapping. The store's Folio maps 1:1 to columns, with the charge and
// payment arrays round-tripped through JSON columns so each folio is a single
// upserted row.
// ---------------------------------------------------------------------------

export function toStoreFolio(row: any): Folio {
  return {
    id: row.id,
    reservationId: row.reservationId,
    charges: Array.isArray(row.charges) ? row.charges : [],
    payments: Array.isArray(row.payments) ? row.payments : [],
    currency: row.currency || 'GHS',
    status: (row.status as any) || 'active',
    type: (row.type as any) || undefined,
    description: row.description || undefined,
    responsibleParty: row.responsibleParty || undefined,
    creditBalance: row.creditBalance ?? undefined,
    totalCharges: row.totalCharges ?? 0,
    totalPayments: row.totalPayments ?? 0,
    balance: row.balance ?? 0,
  }
}

export async function listFolios(tenantId: string): Promise<Folio[]> {
  const rows = await prisma.guestFolio.findMany({
    where: { tenantId },
    orderBy: { updatedAt: 'desc' },
  })
  return rows.map(toStoreFolio)
}

export async function upsertFolio(tenantId: string, f: Partial<Folio>): Promise<{ folio: Folio; changed: boolean }> {
  if (!f.id) throw new Error('folio id is required')
  if (!f.reservationId) throw new Error('reservationId is required')
  const existing = await prisma.guestFolio.findFirst({ where: { id: f.id, tenantId } })
  const rounding = await loadFolioRounding(tenantId)
  const merged = mergedFolioWrite(existing, {
    status: f.status,
    charges: (f.charges || []) as any,
    payments: (f.payments || []) as any,
  }, rounding)
  const fields = {
    reservationId: f.reservationId,
    currency: f.currency || 'GHS',
    status: merged.status,
    type: f.type,
    description: f.description,
    responsibleParty: f.responsibleParty,
    creditBalance: f.creditBalance,
    totalCharges: merged.totalCharges,
    totalPayments: merged.totalPayments,
    balance: merged.balance,
    charges: merged.charges as any,
    payments: merged.payments as any,
  }
  // A re-send of what's already stored is a no-op: no write, and the caller skips
  // its audit row. (undefined = "leave as is" for Prisma, so it never counts as a change.)
  if (existing) {
    const same = Object.entries(fields).every(([k, v]) =>
      v === undefined || JSON.stringify(v) === JSON.stringify((existing as any)[k] ?? null))
    if (same) return { folio: toStoreFolio(existing), changed: false }
  }
  const row = existing
    ? await prisma.guestFolio.update({ where: { id: f.id }, data: fields as any })
    : await prisma.guestFolio.create({ data: { id: f.id, tenantId, ...fields } as any })
  return { folio: toStoreFolio(row), changed: true }
}
