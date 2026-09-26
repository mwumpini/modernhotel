import { Prisma } from '@prisma/client'
import { prisma } from '../database/client'
import { resolveTaxConfigs, type PrismaTaxRow } from '../tax/resolveConfigs'
import { computeStackedTaxLines } from '../accounting/taxFromConfig'
import { createNightAuditLog } from './nightAuditLogRepository'
import { asLineArray, elapsedBusinessDates, isPostedRoomCharge, lineOnBusinessDate, nextCalendarDate, recomputeFolioTotals, roundCents, type FolioLineJson } from './folioLedger'
import {
  appendGuestFolioCharge,
  ensureGuestFolio,
  getFrontOfficeBusinessDate,
  getPropertyCalendarDate,
  loadFolioRounding,
  reconstructTenantDay,
  setFrontOfficeBusinessDate,
} from './folioServer'

// Leaf GL codes — 1100/1200 are chart headers, not postable accounts.
const GL = {
  CASH: '1110',
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
  const folioRounding = await loadFolioRounding(params.tenantId)

  const tenantTaxRows = await prisma.tax.findMany({ where: { tenantId: params.tenantId, isActive: true } })
  const tenantTaxConfigs = resolveTaxConfigs({
    countryCode: 'GH',
    prismaTaxes: tenantTaxRows as unknown as PrismaTaxRow[],
  })

  const tenantSettings = await prisma.systemSettings.findUnique({
    where: { tenantId: params.tenantId },
    select: { roomSettings: true },
  })
  const rs = (tenantSettings?.roomSettings as Record<string, any>) || {}
  const noShowPolicy = {
    enabled: !!rs.noShowPolicyEnabled,
    chargeType: (rs.noShowChargeType as 'first_night' | 'percent_reservation' | 'flat') || 'first_night',
    chargeValue: Number(rs.noShowChargeValue) || 0,
  }

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
    } catch (folioErr) {
      errors.push(`Reservation ${reservation.id}: ${folioErr}`)
    }
  }

  const dayStart = new Date(`${businessDate}T00:00:00.000Z`)
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

      const resBreakdown = (res.details as { rateBreakdown?: RateDay[] } | null)?.rateBreakdown || []
      const nightlyNet = resBreakdown[0]?.base ?? 0
      const nightlyGross = typeof resBreakdown[0]?.total === 'number' ? resBreakdown[0].total : nightlyNet
      const stayNetTotal = resBreakdown.reduce((s, d) => s + (d.base || 0), 0)
      const stayGrossTotal = resBreakdown.reduce((s, d) => s + (typeof d.total === 'number' ? d.total : (d.base || 0)), 0)

      let chargeAmt = 0
      let quotedTax: number | undefined
      if (noShowPolicy.enabled) {
        if (noShowPolicy.chargeType === 'first_night') {
          chargeAmt = nightlyNet
          quotedTax = roundCents(Math.max(0, nightlyGross - nightlyNet))
        } else if (noShowPolicy.chargeType === 'percent_reservation') {
          const penaltyGross = Math.max(0, (noShowPolicy.chargeValue / 100) * stayGrossTotal)
          const ratio = stayGrossTotal > 0 ? penaltyGross / stayGrossTotal : 0
          chargeAmt = roundCents(stayNetTotal * ratio)
          quotedTax = roundCents(Math.max(0, penaltyGross - chargeAmt))
        } else {
          chargeAmt = Math.max(0, noShowPolicy.chargeValue)
        }
      }

      const chargeId = `C-NS-${res.id.slice(-8)}`
      const { totalTax: taxAmount, lines: taxLines } =
        chargeAmt > 0
          ? computeStackedTaxLines(chargeAmt, tenantTaxConfigs, 'sales', quotedTax)
          : { totalTax: 0, lines: [] as Array<{ amount: number; glAccountCode: string; name: string }> }
      const total = chargeAmt + taxAmount
      const cardCollected = chargeAmt > 0 && res.isGuaranteed

      await prisma.$transaction(async (tx) => {
        await tx.reservation.update({ where: { id: res.id }, data: { status: 'no-show' } })
        const folio = await ensureGuestFolio(params.tenantId, res.id, tx as any)

        if (chargeAmt > 0) {
          const existingCharges = asLineArray(folio.charges)
          if (!existingCharges.some((c) => c.id === chargeId)) {
            await appendGuestFolioCharge({
              tenantId: params.tenantId,
              reservationId: res.id,
              charge: {
                id: chargeId,
                date: `${businessDate}T12:00:00.000Z`,
                description: 'No-Show Charge',
                amount: chargeAmt,
                tax: taxAmount,
                category: 'room',
              },
              db: tx as any,
            })
            const fresh = await ensureGuestFolio(params.tenantId, res.id, tx as any)
            const payments = asLineArray(fresh.payments)
            const payId = `P-NS-${res.id.slice(-8)}`
            if (cardCollected && !payments.some((p) => p.id === payId)) {
              payments.push({
                id: payId,
                date: `${businessDate}T12:00:00.000Z`,
                method: 'Card',
                amount: total,
                status: 'completed',
                notes: 'No-show penalty — card guarantee',
              })
            }
            const totals = recomputeFolioTotals(asLineArray(fresh.charges), payments, folioRounding)
            await tx.guestFolio.update({
              where: { id: fresh.id },
              data: { payments: payments as any, ...totals, status: 'closed' },
            })

            const existingJe = await tx.journalEntry.findFirst({ where: { tenantId: params.tenantId, sourceTransactionId: chargeId } })
            if (!existingJe) {
              await tx.journalEntry.create({
                data: {
                  tenantId: params.tenantId,
                  entryNumber: `JE-${new Date().getFullYear()}-NS${Date.now().toString().slice(-5)}`,
                  date: dayStart,
                  description: `No-show penalty — ${res.resId || res.id}`,
                  totalDebit: total,
                  totalCredit: total,
                  currency: 'GHS',
                  status: 'Posted',
                  postedBy: params.runBy || 'night-audit',
                  postedAt: new Date(),
                  sourceModule: 'night-audit',
                  sourceTransactionId: chargeId,
                  lines: {
                    create: [
                      { tenantId: params.tenantId, accountCode: GL.AR, description: `AR — No-show ${res.resId || res.id}`, debit: total, credit: 0, currency: 'GHS' },
                      { tenantId: params.tenantId, accountCode: GL.ROOM_REVENUE, description: 'No-show penalty revenue', debit: 0, credit: chargeAmt, currency: 'GHS' },
                      ...taxLines
                        .filter((tl) => tl.amount > 0)
                        .map((tl) => ({
                          tenantId: params.tenantId,
                          accountCode: tl.glAccountCode,
                          description: `${tl.name} — No-show`,
                          debit: 0,
                          credit: tl.amount,
                          currency: 'GHS',
                        })),
                    ],
                  },
                } as any,
              })
            }

            if (cardCollected) {
              const payChargeId = `${chargeId}-pay`
              const existingPayJe = await tx.journalEntry.findFirst({ where: { tenantId: params.tenantId, sourceTransactionId: payChargeId } })
              if (!existingPayJe) {
                await tx.journalEntry.create({
                  data: {
                    tenantId: params.tenantId,
                    entryNumber: `JE-${new Date().getFullYear()}-NSR${Date.now().toString().slice(-5)}`,
                    date: dayStart,
                    description: `No-show card charge — ${res.resId || res.id}`,
                    totalDebit: total,
                    totalCredit: total,
                    currency: 'GHS',
                    status: 'Posted',
                    postedBy: params.runBy || 'night-audit',
                    postedAt: new Date(),
                    sourceModule: 'night-audit',
                    sourceTransactionId: payChargeId,
                    lines: {
                      create: [
                        { tenantId: params.tenantId, accountCode: GL.CASH, description: 'Card — no-show guarantee', debit: total, credit: 0, currency: 'GHS' },
                        { tenantId: params.tenantId, accountCode: GL.AR, description: `Clear AR — No-show ${res.resId || res.id}`, debit: 0, credit: total, currency: 'GHS' },
                      ],
                    },
                  } as any,
                })
              }
            }
          }
          await tx.guestFolio.update({
            where: { id: folio.id },
            data: { status: 'closed' },
          })
        } else {
          await tx.guestFolio.update({
            where: { id: folio.id },
            data: { status: 'closed' },
          })
        }
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })

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

/**
 * Close every hotel day that is already behind the property calendar.
 * Today stays open. When the open day is already today, one run closes that day.
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
    return runTenantNightAudit({ ...params, businessDate: openDate })
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
