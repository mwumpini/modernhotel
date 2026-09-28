import { prisma } from '../database/client'

export type CashierOutlet = 'frontoffice' | 'restaurant'

export interface CashierShiftDTO {
  id: string
  outlet: CashierOutlet
  businessDate: string
  cashierUserId: string
  cashierName: string
  openingFloat: number
  openedAt: string
  closedAt?: string
  closingCount?: number
  expectedCash?: number
  variance?: number
  totalCash?: number
  totalCard?: number
  totalMobileMoney?: number
  totalOther?: number
  status: 'open' | 'closed'
  notes?: string
  transferTo?: 'accounts' | 'cashier'
  transferToName?: string
  transferAmount?: number
  transferredAt?: string
}

function toDTO(row: any): CashierShiftDTO {
  return {
    id: row.id,
    outlet: (row.outlet === 'restaurant' ? 'restaurant' : 'frontoffice') as CashierOutlet,
    businessDate: String(row.businessDate || '').slice(0, 10) || row.openedAt.toISOString().slice(0, 10),
    cashierUserId: row.cashierUserId,
    cashierName: row.cashierName,
    openingFloat: Number(row.openingFloat || 0),
    openedAt: row.openedAt.toISOString(),
    closedAt: row.closedAt ? row.closedAt.toISOString() : undefined,
    closingCount: row.closingCount != null ? Number(row.closingCount) : undefined,
    expectedCash: row.expectedCash != null ? Number(row.expectedCash) : undefined,
    variance: row.variance != null ? Number(row.variance) : undefined,
    totalCash: row.totalCash != null ? Number(row.totalCash) : undefined,
    totalCard: row.totalCard != null ? Number(row.totalCard) : undefined,
    totalMobileMoney: row.totalMobileMoney != null ? Number(row.totalMobileMoney) : undefined,
    totalOther: row.totalOther != null ? Number(row.totalOther) : undefined,
    status: row.status,
    notes: row.notes ?? undefined,
    transferTo: row.transferTo === 'cashier' ? 'cashier' : row.transferTo === 'accounts' ? 'accounts' : undefined,
    transferToName: row.transferToName ?? undefined,
    transferAmount: row.transferAmount != null ? Number(row.transferAmount) : undefined,
    transferredAt: row.transferredAt ? row.transferredAt.toISOString() : undefined,
  }
}

export async function listCashierShifts(
  tenantId: string,
  outlet: CashierOutlet = 'frontoffice',
): Promise<CashierShiftDTO[]> {
  const rows = await prisma.cashierShift.findMany({
    where: { tenantId, outlet },
    orderBy: { openedAt: 'desc' },
  })
  return rows.map(toDTO)
}

export async function findOpenShiftForCashier(
  tenantId: string,
  cashierUserId: string,
  outlet: CashierOutlet = 'frontoffice',
): Promise<CashierShiftDTO | null> {
  const row = await prisma.cashierShift.findFirst({
    where: { tenantId, cashierUserId, status: 'open', outlet },
  })
  return row ? toDTO(row) : null
}

export async function openCashierShift(
  tenantId: string,
  cashierUserId: string,
  cashierName: string,
  openingFloat: number,
  notes?: string,
  outlet: CashierOutlet = 'frontoffice',
  businessDate?: string,
): Promise<CashierShiftDTO> {
  const day = (businessDate || new Date().toISOString().slice(0, 10)).slice(0, 10)
  const row = await prisma.cashierShift.create({
    data: {
      tenantId,
      outlet,
      businessDate: day,
      cashierUserId,
      cashierName,
      openingFloat,
      notes: notes || undefined,
      status: 'open',
    },
  })
  return toDTO(row)
}

type MethodTotals = { cash: number; card: number; mobileMoney: number; other: number }

function emptyTotals(): MethodTotals {
  return { cash: 0, card: 0, mobileMoney: 0, other: 0 }
}

function bumpMethod(totals: MethodTotals, method: string | undefined, amount: number) {
  switch (method) {
    case 'Cash':
      totals.cash += amount
      break
    case 'Card':
      totals.card += amount
      break
    case 'Mobile Money':
      totals.mobileMoney += amount
      break
    default:
      totals.other += amount
      break
  }
}

/**
 * Front office: GuestFolio.payments with processedBy = cashier display name.
 */
async function sumFolioPaymentsForCashier(
  tenantId: string,
  cashierName: string,
  from: Date,
  to: Date,
): Promise<MethodTotals> {
  const folios = await prisma.guestFolio.findMany({ where: { tenantId }, select: { payments: true } })
  const totals = emptyTotals()
  for (const folio of folios) {
    const payments = Array.isArray(folio.payments) ? (folio.payments as any[]) : []
    for (const p of payments) {
      if (!p || p.processedBy !== cashierName) continue
      if (p.status === 'refunded') continue
      const ts = p.date ? new Date(p.date) : null
      if (!ts || ts < from || ts > to) continue
      bumpMethod(totals, p.method, Number(p.amount || 0))
    }
  }
  return totals
}

/**
 * Restaurant / bar: accounting receipts from F&B sources during the shift window.
 * Prefer cashierUserId / cashierName stamps; otherwise count unstamped F&B
 * receipts in-window (single-till / legacy POS rows without cashier stamp).
 */
async function sumFbPaymentsForCashier(
  tenantId: string,
  cashierUserId: string,
  cashierName: string,
  from: Date,
  to: Date,
): Promise<MethodTotals> {
  const rows = await prisma.accountingPayment.findMany({
    where: {
      tenantId,
      type: 'Receipt',
      status: { not: 'Void' },
      date: { gte: from, lte: to },
    },
  })
  const totals = emptyTotals()
  const fbSources = new Set(['restaurant', 'bar', 'room_service'])
  const nameLc = cashierName.trim().toLowerCase()

  for (const row of rows) {
    const details = (row.details && typeof row.details === 'object' ? row.details : {}) as Record<string, any>
    const source = String(details.sourceModule || '')
    if (!fbSources.has(source)) continue
    if (String(row.status || '') === 'Void') continue

    const stampedUserId = String(details.cashierUserId || '').trim()
    const stampedName = String(details.cashierName || '').trim().toLowerCase()
    const attributed =
      (stampedUserId && stampedUserId === cashierUserId) ||
      (stampedName && stampedName === nameLc) ||
      (!stampedUserId && !stampedName)
    if (!attributed) continue

    bumpMethod(totals, row.paymentMethod || undefined, Number(row.amount || 0))
  }
  return totals
}

async function sumPaymentsForShift(
  tenantId: string,
  outlet: CashierOutlet,
  cashierUserId: string,
  cashierName: string,
  from: Date,
  to: Date,
): Promise<MethodTotals> {
  return outlet === 'restaurant'
    ? sumFbPaymentsForCashier(tenantId, cashierUserId, cashierName, from, to)
    : sumFolioPaymentsForCashier(tenantId, cashierName, from, to)
}

/** Live till preview: float + cash sales so far → expected. */
export async function previewOpenShiftTotals(
  tenantId: string,
  shiftId: string,
): Promise<{ totalCash: number; totalCard: number; totalMobileMoney: number; totalOther: number; expectedCash: number } | null> {
  const existing = await prisma.cashierShift.findFirst({ where: { id: shiftId, tenantId } })
  if (!existing || existing.status !== 'open') return null
  const outlet = (existing.outlet === 'restaurant' ? 'restaurant' : 'frontoffice') as CashierOutlet
  const totals = await sumPaymentsForShift(
    tenantId,
    outlet,
    existing.cashierUserId,
    existing.cashierName,
    existing.openedAt,
    new Date(),
  )
  return {
    totalCash: totals.cash,
    totalCard: totals.card,
    totalMobileMoney: totals.mobileMoney,
    totalOther: totals.other,
    expectedCash: Number(existing.openingFloat || 0) + totals.cash,
  }
}

export async function closeCashierShift(
  tenantId: string,
  id: string,
  closingCount: number,
  notes?: string,
): Promise<CashierShiftDTO | null> {
  const existing = await prisma.cashierShift.findFirst({ where: { id, tenantId } })
  if (!existing || existing.status !== 'open') return null

  const closedAt = new Date()
  const outlet = (existing.outlet === 'restaurant' ? 'restaurant' : 'frontoffice') as CashierOutlet
  const totals = await sumPaymentsForShift(
    tenantId,
    outlet,
    existing.cashierUserId,
    existing.cashierName,
    existing.openedAt,
    closedAt,
  )

  const expectedCash = Number(existing.openingFloat || 0) + totals.cash
  const variance = closingCount - expectedCash

  const row = await prisma.cashierShift.update({
    where: { id },
    data: {
      closedAt,
      closingCount,
      expectedCash,
      variance,
      totalCash: totals.cash,
      totalCard: totals.card,
      totalMobileMoney: totals.mobileMoney,
      totalOther: totals.other,
      status: 'closed',
      notes: notes !== undefined ? notes : existing.notes,
    },
  })
  return toDTO(row)
}

export type CashierShiftPatch = {
  businessDate?: string
  openingFloat?: number
  closingCount?: number
  notes?: string | null
  /** Re-sum sales and recompute expected/variance (closed shifts). */
  recompute?: boolean
  transferTo?: 'accounts' | 'cashier' | null
  transferToName?: string | null
  transferToUserId?: string | null
  transferAmount?: number | null
  /** Who is posting the transfer (session user). Defaults to shift cashier. */
  transferFromUserId?: string
  transferFromName?: string
}

export async function updateCashierShift(
  tenantId: string,
  id: string,
  patch: CashierShiftPatch,
): Promise<CashierShiftDTO | null> {
  const existing = await prisma.cashierShift.findFirst({ where: { id, tenantId } })
  if (!existing) return null

  const data: Record<string, unknown> = {}
  if (patch.businessDate !== undefined) {
    const day = String(patch.businessDate).trim().slice(0, 10)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error('businessDate must be YYYY-MM-DD')
    data.businessDate = day
  }
  if (patch.openingFloat !== undefined) {
    if (!Number.isFinite(patch.openingFloat) || patch.openingFloat < 0) {
      throw new Error('openingFloat must be zero or a positive number')
    }
    data.openingFloat = patch.openingFloat
  }
  if (patch.notes !== undefined) data.notes = patch.notes
  if (patch.closingCount !== undefined) {
    if (!Number.isFinite(patch.closingCount) || patch.closingCount < 0) {
      throw new Error('closingCount must be zero or a positive number')
    }
    data.closingCount = patch.closingCount
  }

  if (patch.transferTo !== undefined) {
    if (patch.transferTo === null) {
      data.transferTo = null
      data.transferToName = null
      data.transferAmount = null
      data.transferredAt = null
    } else {
      const amount = Number(patch.transferAmount)
      if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error('transferAmount must be greater than zero')
      }
      if (patch.transferTo === 'cashier' && !String(patch.transferToName || '').trim()) {
        throw new Error('Enter the receiving cashier name')
      }
      if (patch.transferTo === 'cashier' && !String(patch.transferToUserId || '').trim()) {
        throw new Error('Select the receiving cashier')
      }
      const toName =
        patch.transferTo === 'accounts'
          ? String(patch.transferToName || 'Accounts').trim() || 'Accounts'
          : String(patch.transferToName).trim()
      data.transferTo = patch.transferTo
      data.transferToName = toName
      data.transferAmount = amount
      data.transferredAt = new Date()

      // Append physical-cash custody journal line (micro journal).
      const { createCashTransfer } = await import('./cashTransferRepository')
      const outlet = (existing.outlet === 'restaurant' ? 'restaurant' : 'frontoffice') as CashierOutlet
      await createCashTransfer(tenantId, {
        outlet,
        businessDate: String(existing.businessDate || '').slice(0, 10) || new Date().toISOString().slice(0, 10),
        fromUserId: patch.transferFromUserId || existing.cashierUserId,
        fromName: patch.transferFromName || existing.cashierName,
        toType: patch.transferTo,
        toUserId: patch.transferTo === 'cashier' ? patch.transferToUserId : null,
        toName,
        amount,
        shiftId: existing.id,
        kind: 'till_drop',
      })
    }
  }

  const openingFloat = Number(
    patch.openingFloat !== undefined ? patch.openingFloat : existing.openingFloat || 0,
  )
  const closingCount =
    patch.closingCount !== undefined
      ? patch.closingCount
      : existing.closingCount != null
        ? Number(existing.closingCount)
        : null

  const shouldRecompute =
    Boolean(patch.recompute) ||
    patch.openingFloat !== undefined ||
    patch.closingCount !== undefined

  if (shouldRecompute && existing.status === 'closed' && closingCount != null) {
    const outlet = (existing.outlet === 'restaurant' ? 'restaurant' : 'frontoffice') as CashierOutlet
    const to = existing.closedAt || new Date()
    const totals = await sumPaymentsForShift(
      tenantId,
      outlet,
      existing.cashierUserId,
      existing.cashierName,
      existing.openedAt,
      to,
    )
    const expectedCash = openingFloat + totals.cash
    data.totalCash = totals.cash
    data.totalCard = totals.card
    data.totalMobileMoney = totals.mobileMoney
    data.totalOther = totals.other
    data.expectedCash = expectedCash
    data.variance = closingCount - expectedCash
  } else if (existing.status === 'closed' && closingCount != null && existing.expectedCash != null) {
    if (patch.openingFloat !== undefined || patch.closingCount !== undefined) {
      const cashSales = Number(existing.totalCash || 0)
      const expectedCash = openingFloat + cashSales
      data.expectedCash = expectedCash
      data.variance = closingCount - expectedCash
    }
  }

  const row = await prisma.cashierShift.update({ where: { id }, data: data as any })
  return toDTO(row)
}

export async function deleteCashierShift(tenantId: string, id: string): Promise<boolean> {
  const existing = await prisma.cashierShift.findFirst({ where: { id, tenantId } })
  if (!existing) return false
  await prisma.cashierShift.delete({ where: { id } })
  return true
}
