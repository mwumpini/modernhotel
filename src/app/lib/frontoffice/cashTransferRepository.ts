import { prisma } from '../database/client'
import type { CashierOutlet } from './cashierShiftRepository'

export type CashTransferTo = 'accounts' | 'cashier'

export interface CashTransferDTO {
  id: string
  outlet: CashierOutlet
  businessDate: string
  fromUserId: string
  fromName: string
  toType: CashTransferTo
  toUserId?: string
  toName: string
  amount: number
  shiftId?: string
  kind: 'till_drop' | 'custody_forward'
  notes?: string
  status: 'posted' | 'void'
  transferredAt: string
}

export interface CashCustodyDTO {
  holding: number
  received: number
  forwarded: number
  transfers: CashTransferDTO[]
}

function toDTO(row: any): CashTransferDTO {
  return {
    id: row.id,
    outlet: (row.outlet === 'restaurant' ? 'restaurant' : 'frontoffice') as CashierOutlet,
    businessDate: String(row.businessDate || '').slice(0, 10),
    fromUserId: row.fromUserId,
    fromName: row.fromName,
    toType: row.toType === 'cashier' ? 'cashier' : 'accounts',
    toUserId: row.toUserId ?? undefined,
    toName: row.toName,
    amount: Number(row.amount || 0),
    shiftId: row.shiftId ?? undefined,
    kind: row.kind === 'custody_forward' ? 'custody_forward' : 'till_drop',
    notes: row.notes ?? undefined,
    status: row.status === 'void' ? 'void' : 'posted',
    transferredAt: row.transferredAt.toISOString(),
  }
}

export type CreateCashTransferInput = {
  outlet: CashierOutlet
  businessDate: string
  fromUserId: string
  fromName: string
  toType: CashTransferTo
  toUserId?: string | null
  toName: string
  amount: number
  shiftId?: string | null
  kind?: 'till_drop' | 'custody_forward'
  notes?: string | null
}

export async function createCashTransfer(
  tenantId: string,
  input: CreateCashTransferInput,
): Promise<CashTransferDTO> {
  const amount = Number(input.amount)
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Transfer amount must be greater than zero')
  }
  const day = String(input.businessDate || '').trim().slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    throw new Error('businessDate must be YYYY-MM-DD')
  }
  const toType: CashTransferTo = input.toType === 'cashier' ? 'cashier' : 'accounts'
  const toName = String(input.toName || (toType === 'accounts' ? 'Accounts' : '')).trim()
  if (!toName) throw new Error(toType === 'cashier' ? 'Select the receiving cashier' : 'Enter Accounts receiver')
  if (toType === 'cashier' && !String(input.toUserId || '').trim()) {
    throw new Error('Select the receiving cashier')
  }
  if (toType === 'cashier' && input.toUserId === input.fromUserId) {
    throw new Error('Cannot transfer to yourself')
  }
  const kind = input.kind === 'custody_forward' ? 'custody_forward' : 'till_drop'

  const row = await prisma.cashTransfer.create({
    data: {
      tenantId,
      outlet: input.outlet,
      businessDate: day,
      fromUserId: input.fromUserId,
      fromName: input.fromName,
      toType,
      toUserId: toType === 'cashier' ? String(input.toUserId) : null,
      toName,
      amount,
      shiftId: input.shiftId || null,
      kind,
      notes: input.notes || null,
      status: 'posted',
    },
  })
  return toDTO(row)
}

export async function listCashTransfers(
  tenantId: string,
  opts: {
    outlet?: CashierOutlet
    userId?: string
    limit?: number
  } = {},
): Promise<CashTransferDTO[]> {
  const where: Record<string, unknown> = { tenantId, status: 'posted' }
  if (opts.outlet) where.outlet = opts.outlet
  if (opts.userId) {
    where.OR = [
      { fromUserId: opts.userId },
      { toUserId: opts.userId, toType: 'cashier' },
    ]
  }
  const rows = await prisma.cashTransfer.findMany({
    where: where as any,
    orderBy: { transferredAt: 'desc' },
    take: opts.limit ?? 100,
  })
  return rows.map(toDTO)
}

/** Physical cash still held by this user (received as cashier − forwarded out). */
export async function getCashCustody(
  tenantId: string,
  userId: string,
  outlet?: CashierOutlet,
): Promise<CashCustodyDTO> {
  const outletFilter = outlet ? { outlet } : {}
  const [receivedRows, forwardedRows, transfers] = await Promise.all([
    prisma.cashTransfer.findMany({
      where: {
        tenantId,
        status: 'posted',
        toType: 'cashier',
        toUserId: userId,
        ...outletFilter,
      },
      select: { amount: true },
    }),
    prisma.cashTransfer.findMany({
      where: {
        tenantId,
        status: 'posted',
        fromUserId: userId,
        kind: 'custody_forward',
        ...outletFilter,
      },
      select: { amount: true },
    }),
    listCashTransfers(tenantId, { outlet, userId, limit: 50 }),
  ])
  const received = receivedRows.reduce((s, r) => s + Number(r.amount || 0), 0)
  const forwarded = forwardedRows.reduce((s, r) => s + Number(r.amount || 0), 0)
  return {
    received,
    forwarded,
    holding: Math.round((received - forwarded) * 100) / 100,
    transfers,
  }
}

export async function voidCashTransfer(tenantId: string, id: string): Promise<CashTransferDTO | null> {
  const existing = await prisma.cashTransfer.findFirst({ where: { id, tenantId } })
  if (!existing || existing.status === 'void') return null
  const row = await prisma.cashTransfer.update({
    where: { id },
    data: { status: 'void' },
  })
  return toDTO(row)
}
