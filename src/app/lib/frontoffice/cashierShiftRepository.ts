import { prisma } from '../database/client'

export interface CashierShiftDTO {
  id: string
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
}

function toDTO(row: any): CashierShiftDTO {
  return {
    id: row.id,
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
  }
}

export async function listCashierShifts(tenantId: string): Promise<CashierShiftDTO[]> {
  const rows = await prisma.cashierShift.findMany({ where: { tenantId }, orderBy: { openedAt: 'desc' } })
  return rows.map(toDTO)
}

export async function findOpenShiftForCashier(tenantId: string, cashierUserId: string): Promise<CashierShiftDTO | null> {
  const row = await prisma.cashierShift.findFirst({ where: { tenantId, cashierUserId, status: 'open' } })
  return row ? toDTO(row) : null
}

export async function openCashierShift(
  tenantId: string,
  cashierUserId: string,
  cashierName: string,
  openingFloat: number,
  notes?: string,
): Promise<CashierShiftDTO> {
  const row = await prisma.cashierShift.create({
    data: { tenantId, cashierUserId, cashierName, openingFloat, notes: notes || undefined, status: 'open' },
  })
  return toDTO(row)
}

/**
 * Sums real payments this cashier actually processed (GuestFolio.payments —
 * a JSON array, see /api/folios) between the shift's open time and now, by
 * method. Matches on the cashier's display name at the time of payment
 * (Payment.processedBy) — the same field generateCashierReport already
 * reads — since that's the only cashier attribution the payment record
 * carries.
 */
async function sumPaymentsForCashier(
  tenantId: string,
  cashierName: string,
  from: Date,
  to: Date,
): Promise<{ cash: number; card: number; mobileMoney: number; other: number }> {
  const folios = await prisma.guestFolio.findMany({ where: { tenantId }, select: { payments: true } })
  let cash = 0, card = 0, mobileMoney = 0, other = 0
  for (const folio of folios) {
    const payments = Array.isArray(folio.payments) ? (folio.payments as any[]) : []
    for (const p of payments) {
      if (!p || p.processedBy !== cashierName) continue
      if (p.status === 'refunded') continue
      const ts = p.date ? new Date(p.date) : null
      if (!ts || ts < from || ts > to) continue
      const amount = Number(p.amount || 0)
      switch (p.method) {
        case 'Cash': cash += amount; break
        case 'Card': card += amount; break
        case 'Mobile Money': mobileMoney += amount; break
        default: other += amount; break
      }
    }
  }
  return { cash, card, mobileMoney, other }
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
  const totals = await sumPaymentsForCashier(tenantId, existing.cashierName, existing.openedAt, closedAt)
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
