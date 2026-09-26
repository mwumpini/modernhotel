import { prisma } from '../database/client'
import { getZonedClockParts, DEFAULT_PROPERTY_TIMEZONE } from './propertyTime'
import {
  asLineArray,
  isMainFolioRow,
  mergeFolioStatus,
  mergeLinesById,
  recomputeFolioTotals,
  reconstructDayLedger,
  roundingFromFinancialSettings,
  type DayLedger,
  type FolioLineJson,
  type FolioRounding,
} from './folioLedger'

type Tx = Omit<typeof prisma, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>

export async function getPropertyCalendarDate(tenantId: string, now = new Date()): Promise<string> {
  const property = await prisma.property.findFirst({
    where: { tenantId, isActive: true },
    select: { timezone: true },
  })
  return getZonedClockParts(now, property?.timezone || DEFAULT_PROPERTY_TIMEZONE).date
}

export async function getFrontOfficeBusinessDate(tenantId: string): Promise<string> {
  const settings = await prisma.systemSettings.findUnique({
    where: { tenantId },
    select: { hotelSettings: true },
  })
  const stored = (settings?.hotelSettings as { frontOfficeBusinessDate?: string } | null)?.frontOfficeBusinessDate
  if (stored && /^\d{4}-\d{2}-\d{2}$/.test(stored)) return stored

  const property = await prisma.property.findFirst({
    where: { tenantId, isActive: true },
    select: { timezone: true },
  })
  const date = getZonedClockParts(new Date(), property?.timezone || DEFAULT_PROPERTY_TIMEZONE).date
  await setFrontOfficeBusinessDate(tenantId, date)
  return date
}

export async function setFrontOfficeBusinessDate(tenantId: string, date: string): Promise<void> {
  const existing = await prisma.systemSettings.findUnique({ where: { tenantId } })
  const hotelSettings = { ...((existing?.hotelSettings as object) || {}), frontOfficeBusinessDate: date }
  await prisma.systemSettings.upsert({
    where: { tenantId },
    update: { hotelSettings },
    create: {
      tenantId,
      generalSettings: {},
      hotelSettings,
      roomSettings: {},
      financialSettings: {},
      clientSettings: {},
      saasSettings: {},
    },
  })
}

export async function loadFolioRounding(tenantId: string): Promise<FolioRounding> {
  const settings = await prisma.systemSettings.findUnique({
    where: { tenantId },
    select: { financialSettings: true },
  })
  return roundingFromFinancialSettings(settings?.financialSettings)
}

export async function findMainGuestFolio(
  tenantId: string,
  reservationId: string,
  db: Tx = prisma,
) {
  const rows = await db.guestFolio.findMany({
    where: { tenantId, reservationId },
    orderBy: { updatedAt: 'desc' },
  })
  const mains = rows.filter(isMainFolioRow)
  if (mains.length === 0) return null
  return (
    mains.find((f) => asLineArray(f.charges).length > 0 || asLineArray(f.payments).length > 0) || mains[0]
  )
}

export async function ensureGuestFolio(
  tenantId: string,
  reservationId: string,
  db: Tx = prisma,
) {
  const existing = await findMainGuestFolio(tenantId, reservationId, db)
  if (existing) return existing
  const id = `F-${reservationId.slice(-10)}`
  return db.guestFolio.create({
    data: {
      id,
      tenantId,
      reservationId,
      currency: 'GHS',
      status: 'active',
      charges: [],
      payments: [],
      totalCharges: 0,
      totalPayments: 0,
      balance: 0,
    },
  })
}

export async function appendGuestFolioCharge(params: {
  tenantId: string
  reservationId: string
  charge: FolioLineJson
  db?: Tx
}): Promise<{ folioId: string; appended: boolean }> {
  const db = params.db ?? prisma
  const folio = await ensureGuestFolio(params.tenantId, params.reservationId, db)
  const charges = asLineArray(folio.charges)
  if (charges.some((c) => c.id === params.charge.id)) {
    return { folioId: folio.id, appended: false }
  }
  charges.push(params.charge)
  const payments = asLineArray(folio.payments)
  const totals = recomputeFolioTotals(charges, payments, await loadFolioRounding(params.tenantId))
  await db.guestFolio.update({
    where: { id: folio.id },
    data: {
      charges: charges as any,
      ...totals,
    },
  })
  return { folioId: folio.id, appended: true }
}

export async function replaceGuestFolioPayments(params: {
  tenantId: string
  folioId: string
  payments: FolioLineJson[]
  db?: Tx
}) {
  const db = params.db ?? prisma
  const folio = await db.guestFolio.findFirst({ where: { id: params.folioId, tenantId: params.tenantId } })
  if (!folio) return
  const charges = asLineArray(folio.charges)
  const payments = mergeLinesById(asLineArray(folio.payments), params.payments)
  const totals = recomputeFolioTotals(charges, payments, await loadFolioRounding(params.tenantId))
  await db.guestFolio.update({
    where: { id: folio.id },
    data: { payments: payments as any, ...totals },
  })
}

/** Merge a client PUT into the DB row so F&B/night-audit lines cannot be wiped. */
export function mergedFolioWrite(existing: {
  status?: string | null
  charges?: unknown
  payments?: unknown
} | null, incoming: {
  status?: string
  charges?: FolioLineJson[]
  payments?: FolioLineJson[]
}, rounding?: FolioRounding) {
  const charges = mergeLinesById(asLineArray(existing?.charges), incoming.charges || [])
  const payments = mergeLinesById(asLineArray(existing?.payments), incoming.payments || [])
  const totals = recomputeFolioTotals(charges, payments, rounding)
  return {
    charges,
    payments,
    status: mergeFolioStatus(existing?.status || undefined, incoming.status),
    ...totals,
  }
}

export async function reconstructTenantDay(tenantId: string, businessDate: string): Promise<DayLedger> {
  const [folios, checkedInCount] = await Promise.all([
    prisma.guestFolio.findMany({ where: { tenantId }, select: { charges: true, payments: true } }),
    prisma.reservation.count({ where: { tenantId, status: 'checked-in' } }),
  ])
  return reconstructDayLedger(folios, businessDate, checkedInCount)
}

export async function resolveCheckedInReservationId(params: {
  tenantId: string
  reservationId?: string | null
  guestId?: string | null
  roomNumber?: string | null
}): Promise<string | null> {
  if (params.reservationId) {
    const hit = await prisma.reservation.findFirst({
      where: { id: params.reservationId, tenantId: params.tenantId },
      select: { id: true },
    })
    if (hit) return hit.id
  }
  if (params.guestId) {
    const byGuest = await prisma.reservation.findFirst({
      where: { tenantId: params.tenantId, guestId: params.guestId, status: 'checked-in' },
      select: { id: true },
    })
    if (byGuest) return byGuest.id
  }
  if (params.roomNumber) {
    const byRoom = await prisma.reservation.findFirst({
      where: { tenantId: params.tenantId, roomId: params.roomNumber, status: 'checked-in' },
      select: { id: true },
    })
    if (byRoom) return byRoom.id
  }
  return null
}
