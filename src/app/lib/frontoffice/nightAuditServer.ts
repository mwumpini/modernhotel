import { Prisma } from '@prisma/client'
import { prisma } from '../database/client'
import { salesTaxConfigsForTenant } from '../tax/serverConfigs'
import { computeStackedTaxLines } from '../accounting/taxFromConfig'
import { createNightAuditLog } from './nightAuditLogRepository'
import { asLineArray, elapsedBusinessDates, isPostedRoomCharge, lineOnBusinessDate, nextCalendarDate, roundCents, type FolioLineJson } from './folioLedger'
import {
  appendGuestFolioCharge,
  ensureGuestFolio,
  getFrontOfficeBusinessDate,
  getPropertyCalendarDate,

  reconstructTenantDay,
  setFrontOfficeBusinessDate,
} from './folioServer'
import { settleBookingPenalty, syncReservationFolioToLedger } from '../accounting/folioLedgerServer'

// Leaf GL codes — 1100/1200 are chart headers, not postable accounts.
const GL = {
  CASH: '1110',
  // A card guarantee settles to the bank, not the cash drawer.
  BANK: '1120',
  AR: '1210',
  ROOM_REVENUE: '4100',
}

export type NightAuditServerResult = {
  skipped: boolean
  businessDate: string
  nextBusinessDate: string
  roomChargesPosted: number
  noShowsMarked: number
  checkedInCount: number
  folioChargesTotal: number
  folioPaymentsTotal: number
  status: 'completed' | 'failed'
  errors: string[]
  completedAt: string
  logId?: string
  /** Hotel days this call actually closed. Empty when the open day was already closed. */
  daysClosed: string[]
}

type RateDay = { date: string; base: number; total?: number }

/**
 * The night the guest was quoted, for this business date only.
 * Tax is the stored gross minus net so a ₵500.00 rate is not recomputed into ₵499.99,
 * and a missing night is not silently priced at the first night's rate.
 */
function quotedNight(details: unknown, businessDate: string): { base: number; tax: number; taxIsQuoted: boolean } | null {
  const breakdown = (details as { rateBreakdown?: RateDay[] } | null)?.rateBreakdown || []
  const day = breakdown.find((d) => d.date === businessDate)
  if (!day || !(Number(day.base) > 0)) return null
  if (typeof day.total === 'number') {
    return { base: day.base, tax: roundCents(Math.max(0, day.total - day.base)), taxIsQuoted: true }
  }
  return { base: day.base, tax: 0, taxIsQuoted: false }
}

export async function runTenantNightAudit(params: {
  tenantId: string
  source: 'cron' | 'manual'
  runBy?: string
  businessDate?: string
}): Promise<NightAuditServerResult> {
  const businessDate = params.businessDate || (await getFrontOfficeBusinessDate(params.tenantId))
  const completedAt = new Date().toISOString()
  const nextDate = nextCalendarDate(businessDate)

  const already = await prisma.nightAuditLog.findFirst({
    where: { tenantId: params.tenantId, businessDate, status: 'completed' },
    orderBy: { runAt: 'desc' },
  })
  if (already) {
    const snapshot = ((already as { snapshot?: Record<string, unknown> | null }).snapshot) || {}
    return {
      skipped: true,
      businessDate,
      nextBusinessDate: (snapshot.nextBusinessDate as unknown as string) || nextDate,
      roomChargesPosted: already.roomChargesPosted,
      noShowsMarked: already.noShowsMarked,
      checkedInCount: Number(snapshot.checkedInCount) || 0,
      folioChargesTotal: Number(snapshot.folioChargesTotal) || 0,
      folioPaymentsTotal: Number(snapshot.folioPaymentsTotal) || 0,
      status: 'completed',
      errors: [],
      completedAt: already.runAt.toISOString(),
      logId: already.id,
      daysClosed: [],
    }
  }

  const errors: string[] = []
  let roomChargesPosted = 0
  let noShowsMarked = 0
  const tenantTaxConfigs = await salesTaxConfigsForTenant(params.tenantId, 'GH')

  const inHouse = await prisma.reservation.findMany({
    where: { tenantId: params.tenantId, status: 'checked-in' },
  })

  for (const reservation of inHouse) {
    try {
      const arrival = reservation.checkInDate.toISOString().slice(0, 10)
      const departure = reservation.checkOutDate.toISOString().slice(0, 10)
      if (businessDate < arrival || businessDate >= departure) continue

      const night = quotedNight(reservation.details, businessDate)
      if (!night) continue
      const taxAmount = night.taxIsQuoted
        ? night.tax
        : computeStackedTaxLines(night.base, tenantTaxConfigs, 'sales').totalTax
      const charge: FolioLineJson = {
        id: `ROOM-${businessDate}-${reservation.id.slice(-8)}`,
        date: `${businessDate}T12:00:00.000Z`,
        description: `Room Charge — ${businessDate}`,
        amount: night.base,
        tax: taxAmount,
        category: 'room',
        glAccountCode: GL.ROOM_REVENUE,
      }

      const posted = await prisma.$transaction(async (tx) => {
        const folio = await ensureGuestFolio(params.tenantId, reservation.id, tx as any)
        const already = asLineArray(folio.charges).some(
          (c) => isPostedRoomCharge(c) && lineOnBusinessDate(c, businessDate),
        )
        if (already) return false
        const result = await appendGuestFolioCharge({
          tenantId: params.tenantId,
          reservationId: reservation.id,
          charge,
          db: tx as any,
        })
        return result.appended
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })

      if (posted) roomChargesPosted += 1
      // The night is revenue today (IFRS 15); this also posts anything a save missed.
      await syncReservationFolioToLedger(params.tenantId, reservation.id, { postedBy: params.runBy || 'night-audit' })
        .catch((e) => errors.push(`Ledger for ${reservation.id}: ${e}`))
    } catch (folioErr) {
      errors.push(`Reservation ${reservation.id}: ${folioErr}`)
    }
  }

  const dayEnd = new Date(`${businessDate}T23:59:59.999Z`)
  const noShows = await prisma.reservation.findMany({
    where: {
      tenantId: params.tenantId,
      status: { in: ['confirmed', 'pending'] },
      checkInDate: { lte: dayEnd },
    },
  })

  for (const res of noShows) {
    try {
      const arrival = res.checkInDate.toISOString().slice(0, 10)
      if (arrival > businessDate) continue

      await prisma.reservation.update({ where: { id: res.id }, data: { status: 'no-show' } })
      await ensureGuestFolio(params.tenantId, res.id)
      // The business's own rule (Settings → Operational Policies → Booking changes): the fee
      // comes out of the deposit first, the rest of the deposit is a refund due, and a larger
      // fee is billed or collected on the guarantee card. One settlement, shared with manual no-shows.
      await settleBookingPenalty(params.tenantId, res.id, 'no-show', { postedBy: params.runBy || 'night-audit', businessDate })
      const folio = await ensureGuestFolio(params.tenantId, res.id)
      await prisma.guestFolio.update({ where: { id: folio.id }, data: { status: 'closed' } })
      noShowsMarked += 1
    } catch (nsErr) {
      errors.push(`No-show ${res.id}: ${nsErr}`)
    }
  }

  const day = await reconstructTenantDay(params.tenantId, businessDate)
  const status = errors.length > 0 ? 'failed' : 'completed'
  if (status === 'completed') {
    await setFrontOfficeBusinessDate(params.tenantId, nextDate)
  }

  const log = await createNightAuditLog(params.tenantId, {
    businessDate,
    source: params.source,
    status,
    roomChargesPosted,
    noShowsMarked,
    errors: errors.length ? errors : undefined,
    runBy: params.runBy,
    snapshot: {
      nextBusinessDate: status === 'completed' ? nextDate : businessDate,
      folioChargesTotal: day.folioChargesTotal,
      folioPaymentsTotal: day.folioPaymentsTotal,
      checkedInCount: inHouse.length,
      chargesByCategory: day.chargesByCategory,
      paymentsByMethod: day.paymentsByMethod,
    },
  })

  return {
    skipped: false,
    businessDate,
    nextBusinessDate: status === 'completed' ? nextDate : businessDate,
    roomChargesPosted,
    noShowsMarked,
    checkedInCount: inHouse.length,
    folioChargesTotal: day.folioChargesTotal,
    folioPaymentsTotal: day.folioPaymentsTotal,
    status,
    errors,
    completedAt,
    logId: log.id,
    daysClosed: status === 'completed' ? [businessDate] : [],
  }
}

function dayLeftOpen(openDate: string, completedAt: string): NightAuditServerResult {
  return {
    skipped: true,
    businessDate: openDate,
    nextBusinessDate: openDate,
    roomChargesPosted: 0,
    noShowsMarked: 0,
    checkedInCount: 0,
    folioChargesTotal: 0,
    folioPaymentsTotal: 0,
    status: 'completed',
    errors: [],
    completedAt,
    daysClosed: [],
  }
}

/**
 * Close every hotel day that is already behind the property calendar.
 * The open day stays open while it is still that calendar day, and a date
 * already ahead of the calendar is not closed either.
 */
export async function catchUpTenantNightAudit(params: {
  tenantId: string
  source: 'cron' | 'manual'
  runBy?: string
  now?: Date
}): Promise<NightAuditServerResult> {
  const today = await getPropertyCalendarDate(params.tenantId, params.now)
  const openDate = await getFrontOfficeBusinessDate(params.tenantId)
  const elapsed = elapsedBusinessDates(openDate, today)

  if (elapsed.length === 0) {
    return dayLeftOpen(openDate, new Date().toISOString())
  }

  let roomChargesPosted = 0
  let noShowsMarked = 0
  const daysClosed: string[] = []
  const errors: string[] = []
  let last: NightAuditServerResult | null = null

  for (const businessDate of elapsed) {
    const run = await runTenantNightAudit({ ...params, businessDate })
    last = run
    roomChargesPosted += run.roomChargesPosted
    noShowsMarked += run.noShowsMarked
    errors.push(...run.errors)
    if (run.status !== 'completed') {
      return {
        ...run,
        roomChargesPosted,
        noShowsMarked,
        errors,
        daysClosed,
      }
    }
    if (!run.skipped) daysClosed.push(run.businessDate)
    const next = run.nextBusinessDate
    if (run.skipped && next > businessDate) {
      await setFrontOfficeBusinessDate(params.tenantId, next)
    }
    if (!next || next <= businessDate) break
  }

  return {
    ...last!,
    roomChargesPosted,
    noShowsMarked,
    errors,
    nextBusinessDate: last!.status === 'completed' ? last!.nextBusinessDate : last!.businessDate,
    daysClosed,
  }
}
