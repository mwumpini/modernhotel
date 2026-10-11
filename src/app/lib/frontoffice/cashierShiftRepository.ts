import { prisma } from '../database/client'
import { pettyExpenseName } from './pettyExpenses'
import { postTillPaidOut, reverseTillPaidOut } from './tillPaidOutPost'
import { readTillTypes } from './tillTypesPolicy'
import type { TillKind } from './tillTypes'

export type CashierOutlet = 'frontoffice' | 'restaurant'

export type TillPaidOut = {
  id: string
  amount: number
  expenseCode: string
  expenseName: string
  description: string
  /** cash leaves the drawer. momo leaves the device and does not change expected cash. */
  method?: 'cash' | 'momo'
  /** Which opened till this expense left. */
  tillId?: string
  /** MoMo receipt number. Required when method is momo. */
  momoTxnId?: string
  /** Person or business the MoMo was sent to. */
  paidTo?: string
  /** MoMo number that received the payment. */
  paidToNumber?: string
  journalEntryId?: string
  /** Accounting journal number, same series as other expenses. */
  entryNumber?: string
  voidedAt?: string
  createdAt: string
}

function round2(n: number) {
  return Math.round(n * 100) / 100
}

/** One till on a shift. Close counts the same rows that were opened. */
export type ShiftTillLine = {
  tillId: string
  name: string
  kind: TillKind
  opening: number
  note?: string
  counted?: number
}

export function readTillLines(raw: unknown): ShiftTillLine[] {
  if (!Array.isArray(raw)) return []
  return raw.flatMap((row) => {
    if (!row || typeof row !== 'object') return []
    const item = row as ShiftTillLine
    const opening = Number(item.opening)
    if (!item.tillId || !item.name || !Number.isFinite(opening) || opening < 0) return []
    const counted = item.counted == null ? undefined : Number(item.counted)
    return [{
      tillId: String(item.tillId),
      name: String(item.name),
      kind: item.kind === 'momo' ? 'momo' : 'cash',
      opening,
      note: item.note ? String(item.note) : undefined,
      counted: counted != null && Number.isFinite(counted) ? counted : undefined,
    }]
  })
}

export function readPaidOuts(raw: unknown): TillPaidOut[] {
  if (!Array.isArray(raw)) return []
  return raw.flatMap((row) => {
    if (!row || typeof row !== 'object') return []
    const item = row as TillPaidOut
    const amount = Number(item.amount)
    if (!item.id || !Number.isFinite(amount)) return []
    return [{
      id: String(item.id),
      amount,
      expenseCode: String(item.expenseCode || ''),
      expenseName: String(item.expenseName || ''),
      description: String(item.description || ''),
      method: item.method === 'momo' ? 'momo' : 'cash',
      tillId: item.tillId ? String(item.tillId) : undefined,
      momoTxnId: item.momoTxnId ? String(item.momoTxnId) : undefined,
      paidTo: item.paidTo ? String(item.paidTo) : undefined,
      paidToNumber: item.paidToNumber ? String(item.paidToNumber) : undefined,
      journalEntryId: item.journalEntryId ? String(item.journalEntryId) : undefined,
      entryNumber: item.entryNumber ? String(item.entryNumber) : undefined,
      voidedAt: item.voidedAt ? String(item.voidedAt) : undefined,
      createdAt: String(item.createdAt || ''),
    }]
  })
}

export function activePaidOutTotal(raw: unknown): number {
  return round2(readPaidOuts(raw).filter((row) => !row.voidedAt).reduce((sum, row) => sum + row.amount, 0))
}

function cashPaidOutTotal(raw: unknown): number {
  return round2(readPaidOuts(raw).filter((row) => !row.voidedAt && row.method !== 'momo').reduce((sum, row) => sum + row.amount, 0))
}

function momoPaidOutTotal(raw: unknown): number {
  return round2(readPaidOuts(raw).filter((row) => !row.voidedAt && row.method === 'momo').reduce((sum, row) => sum + row.amount, 0))
}

function tillExpected(openingFloat: number, cashSales: number, paidOuts: unknown) {
  return round2(openingFloat + cashSales - cashPaidOutTotal(paidOuts))
}

function momoExpected(recorded: number, paidOuts: unknown) {
  return round2(recorded - momoPaidOutTotal(paidOuts))
}

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
  /** What the cashier read on the MoMo device at close. */
  momoDeclared?: number
  /** momoDeclared minus recorded MoMo sales. */
  momoVariance?: number
  paidOuts: TillPaidOut[]
  /** Tills opened on this shift. Close counts these same rows. Older shifts have none. */
  tillLines: ShiftTillLine[]
  /** Active petty paid-outs. Already subtracted from expected cash once the shift is closed. */
  totalPaidOut: number
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
    momoDeclared: row.momoDeclared != null ? Number(row.momoDeclared) : undefined,
    momoVariance: row.momoVariance != null ? Number(row.momoVariance) : undefined,
    paidOuts: readPaidOuts(row.paidOuts),
    tillLines: readTillLines(row.tillLines),
    totalPaidOut: activePaidOutTotal(row.paidOuts),
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
  await ensureWalletColumns()
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
  await ensureWalletColumns()
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
  tills?: Array<{ tillId: string; opening: number; note?: string }>,
): Promise<CashierShiftDTO> {
  await ensureWalletColumns()
  const day = (businessDate || new Date().toISOString().slice(0, 10)).slice(0, 10)
  const tillLines = tills ? await snapshotOpenTills(tenantId, tills) : []
  const cashLine = tillLines.find((line) => line.kind === 'cash')
  const float = cashLine ? cashLine.opening : openingFloat
  const row = await prisma.cashierShift.create({
    data: {
      tenantId,
      outlet,
      businessDate: day,
      cashierUserId,
      cashierName,
      openingFloat: float,
      notes: cashLine?.note || notes || undefined,
      status: 'open',
      tillLines: tillLines.length ? tillLines : undefined,
    },
  })
  return toDTO(row)
}

function applyTillCounts(
  opened: ShiftTillLine[],
  counts?: Array<{ tillId: string; amount: number }>,
): ShiftTillLine[] {
  if (!counts || counts.length !== opened.length) throw new Error('Count each till that was opened')
  return opened.map((line) => {
    const row = counts.find((item) => item.tillId === line.tillId)
    const amount = Number(row?.amount)
    if (!row || !Number.isFinite(amount) || amount < 0) throw new Error(`Count ${line.name}`)
    return { ...line, counted: round2(amount) }
  })
}

async function snapshotOpenTills(
  tenantId: string,
  tills: Array<{ tillId: string; opening: number; note?: string }>,
): Promise<ShiftTillLine[]> {
  const active = (await readTillTypes(tenantId)).filter((till) => till.active)
  if (tills.length !== active.length) throw new Error('Enter an opening amount for each till')
  return active.map((till) => {
    const row = tills.find((item) => item.tillId === till.id)
    const opening = Number(row?.opening)
    if (!row || !Number.isFinite(opening) || opening < 0) throw new Error(`Enter the opening amount for ${till.name}`)
    const note = String(row.note || '').trim().slice(0, 160)
    return { tillId: till.id, name: till.name, kind: till.kind, opening: round2(opening), note: note || undefined }
  })
}

let walletColumnsReady: Promise<void> | null = null

/** Older hotel databases predate the MoMo declaration columns. */
function ensureWalletColumns(): Promise<void> {
  if (!walletColumnsReady) {
    walletColumnsReady = (async () => {
      for (const sql of [
        'ALTER TABLE cashier_shifts ADD COLUMN momoDeclared REAL',
        'ALTER TABLE cashier_shifts ADD COLUMN momoVariance REAL',
        'ALTER TABLE cashier_shifts ADD COLUMN paidOuts TEXT',
        'ALTER TABLE cashier_shifts ADD COLUMN tillLines TEXT',
      ]) {
        try {
          await prisma.$executeRawUnsafe(sql)
        } catch {
          // The column is already there.
        }
      }
    })()
  }
  return walletColumnsReady
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
): Promise<{ totalCash: number; totalCard: number; totalMobileMoney: number; totalOther: number; totalPaidOut: number; expectedCash: number } | null> {
  await ensureWalletColumns()
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
    totalPaidOut: activePaidOutTotal(existing.paidOuts),
    expectedCash: tillExpected(Number(existing.openingFloat || 0), totals.cash, existing.paidOuts),
  }
}

export async function closeCashierShift(
  tenantId: string,
  id: string,
  closingCount: number,
  notes?: string,
  momoDeclared?: number,
  counts?: Array<{ tillId: string; amount: number }>,
): Promise<CashierShiftDTO | null> {
  await ensureWalletColumns()
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

  const opened = readTillLines(existing.tillLines)
  const countedLines = opened.length ? applyTillCounts(opened, counts) : opened
  const cashCount = countedLines.find((line) => line.kind === 'cash')?.counted
  const count = cashCount != null ? cashCount : closingCount
  const expectedCash = tillExpected(Number(existing.openingFloat || 0), totals.cash, existing.paidOuts)
  const variance = count - expectedCash
  const momoLines = countedLines.filter((line) => line.kind === 'momo')
  const declaredMomo = momoLines.length
    ? round2(momoLines.reduce((sum, line) => sum + Number(line.counted || 0), 0))
    : momoDeclared != null && Number.isFinite(momoDeclared) ? momoDeclared : null
  const momoOpening = round2(momoLines.reduce((sum, line) => sum + line.opening, 0))
  const momoOnDevices = declaredMomo == null ? null : momoOpening + momoExpected(totals.mobileMoney, existing.paidOuts)

  const row = await prisma.cashierShift.update({
    where: { id },
    data: {
      closedAt,
      status: 'closed',
      closingCount: count,
      expectedCash,
      variance,
      totalCash: totals.cash,
      totalCard: totals.card,
      totalMobileMoney: totals.mobileMoney,
      totalOther: totals.other,
      momoDeclared: declaredMomo,
      momoVariance: declaredMomo == null || momoOnDevices == null ? null : declaredMomo - momoOnDevices,
      notes: notes !== undefined ? notes : existing.notes,
      tillLines: countedLines.length ? countedLines : undefined,
    },
  })
  return toDTO(row)
}

export type CashierShiftPatch = {
  businessDate?: string
  openingFloat?: number
  closingCount?: number
  /** What the MoMo device received this shift. Null clears a saved declaration. */
  momoDeclared?: number | null
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
  await ensureWalletColumns()
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
  if (patch.momoDeclared !== undefined) {
    if (patch.momoDeclared !== null && (!Number.isFinite(patch.momoDeclared) || patch.momoDeclared < 0)) {
      throw new Error('momoDeclared must be zero or a positive number')
    }
    data.momoDeclared = patch.momoDeclared
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
    const expectedCash = tillExpected(openingFloat, totals.cash, existing.paidOuts)
    data.totalCash = totals.cash
    data.totalCard = totals.card
    data.totalMobileMoney = totals.mobileMoney
    data.totalOther = totals.other
    data.expectedCash = expectedCash
    data.variance = closingCount - expectedCash
  } else if (existing.status === 'closed' && closingCount != null && existing.expectedCash != null) {
    if (patch.openingFloat !== undefined || patch.closingCount !== undefined) {
      const cashSales = Number(existing.totalCash || 0)
      const expectedCash = tillExpected(openingFloat, cashSales, existing.paidOuts)
      data.expectedCash = expectedCash
      data.variance = closingCount - expectedCash
    }
  }

  if (patch.momoDeclared !== undefined || data.totalMobileMoney !== undefined) {
    const declared =
      patch.momoDeclared !== undefined
        ? patch.momoDeclared
        : existing.momoDeclared != null
          ? Number(existing.momoDeclared)
          : null
    const recorded = Number(
      data.totalMobileMoney !== undefined ? data.totalMobileMoney : existing.totalMobileMoney || 0,
    )
    if (declared == null) {
      if (patch.momoDeclared !== undefined) data.momoVariance = null
    } else {
      data.momoVariance = declared - momoExpected(recorded, existing.paidOuts)
    }
  }

  const row = await prisma.cashierShift.update({ where: { id }, data: data as any })
  return toDTO(row)
}

function readPayee(input: { paidTo?: string; paidToNumber?: string }) {
  const paidTo = String(input.paidTo || '').trim()
  const paidToNumber = String(input.paidToNumber || '').trim()
  if (!paidTo) throw new Error('Say who was paid')
  if (paidTo.length > 80) throw new Error('Keep the name under 80 characters')
  const digits = paidToNumber.replace(/\D/g, '')
  if (digits.length < 9 || digits.length > 15) throw new Error('Enter the number')
  return { paidTo, paidToNumber }
}

function readMomoTxn(raw?: string) {
  const momoTxnId = String(raw || '').trim()
  if (!momoTxnId) throw new Error('Enter the MoMo transaction ID')
  if (momoTxnId.length > 40) throw new Error('Transaction ID is too long')
  return momoTxnId
}

export async function recordTillPaidOut(
  tenantId: string,
  shiftId: string,
  input: {
    amount: number
    expenseCode: string
    description: string
    method?: 'cash' | 'momo'
    tillId?: string
    momoTxnId?: string
    paidTo?: string
    paidToNumber?: string
  },
  postedBy: string,
): Promise<CashierShiftDTO> {
  await ensureWalletColumns()
  const existing = await prisma.cashierShift.findFirst({ where: { id: shiftId, tenantId } })
  if (!existing || existing.status !== 'open') throw new Error('Shift is not open')
  const opened = readTillLines(existing.tillLines)
  const tillLine = input.tillId ? opened.find((line) => line.tillId === input.tillId) : undefined
  if (opened.length && !tillLine) throw new Error('Choose a till that is open')
  const tillTypes = await readTillTypes(tenantId)
  const tillType = tillLine ? tillTypes.find((till) => till.id === tillLine.tillId) : undefined
  if (tillLine && tillType && !tillType.spend) throw new Error(`${tillLine.name} cannot pay expenses`)
  const expenseName = pettyExpenseName(input.expenseCode)
  if (!expenseName) throw new Error('Choose an expense')
  const description = String(input.description || '').trim()
  if (!description) throw new Error('Say what it was for')
  if (description.length > 160) throw new Error('Keep the note under 160 characters')
  const amount = round2(Number(input.amount))
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Amount must be greater than zero')
  const method: TillKind = tillLine ? tillLine.kind : input.method === 'momo' ? 'momo' : 'cash'
  if (method === 'cash' && !tillLine) {
    const cashType = tillTypes.find((till) => till.kind === 'cash')
    if (cashType && !cashType.spend) throw new Error(`${cashType.name} cannot pay expenses`)
  }
  if (method === 'momo' && !tillLine && !tillTypes.some((till) => till.kind === 'momo' && till.spend)) {
    throw new Error('MoMo expenses are turned off')
  }
  if (tillType?.threshold != null && amount - tillType.threshold > 0.009) {
    throw new Error(`That is more than the ${tillLine?.name || tillType.name} limit`)
  }
  const payee = readPayee(input)
  const momoTxnId = method === 'momo' ? readMomoTxn(input.momoTxnId) : undefined

  if (method === 'cash') {
    const outlet = (existing.outlet === 'restaurant' ? 'restaurant' : 'frontoffice') as CashierOutlet
    const totals = await sumPaymentsForShift(
      tenantId,
      outlet,
      existing.cashierUserId,
      existing.cashierName,
      existing.openedAt,
      new Date(),
    )
    const available = tillExpected(Number(existing.openingFloat || 0), totals.cash, existing.paidOuts)
    if (amount - available > 0.009) throw new Error('That is more cash than the till has')
  }

  const paid: TillPaidOut = {
    id: crypto.randomUUID(),
    amount,
    expenseCode: input.expenseCode,
    expenseName,
    description,
    method,
    tillId: tillLine?.tillId,
    momoTxnId,
    paidTo: payee.paidTo,
    paidToNumber: payee.paidToNumber,
    createdAt: new Date().toISOString(),
  }
  const wallet = tillLine && tillLine.kind === 'momo' ? `${tillLine.name} ` : ''
  const journalNote = momoTxnId
    ? `${description} (${wallet}MoMo ${momoTxnId}, ${payee.paidTo}, ${payee.paidToNumber})`
    : `${description} (${payee.paidTo}, ${payee.paidToNumber})`
  const posted = await postTillPaidOut({
    tenantId,
    paidOutId: paid.id,
    amount,
    expenseCode: paid.expenseCode,
    expenseName,
    description: journalNote,
    businessDate: String(existing.businessDate || '').slice(0, 10) || new Date().toISOString().slice(0, 10),
    postedBy,
    paidFrom: method,
  })
  paid.journalEntryId = posted.id
  paid.entryNumber = posted.entryNumber
  const paidOuts = [...readPaidOuts(existing.paidOuts), paid]
  const row = await prisma.cashierShift.update({ where: { id: shiftId }, data: { paidOuts } })
  return toDTO(row)
}

export async function voidTillPaidOut(
  tenantId: string,
  shiftId: string,
  paidOutId: string,
  postedBy: string,
): Promise<CashierShiftDTO> {
  await ensureWalletColumns()
  const existing = await prisma.cashierShift.findFirst({ where: { id: shiftId, tenantId } })
  if (!existing || existing.status !== 'open') throw new Error('Shift is not open')
  const paidOuts = readPaidOuts(existing.paidOuts)
  const item = paidOuts.find((row) => row.id === paidOutId)
  if (!item || item.voidedAt) throw new Error('Paid-out not found')
  await reverseTillPaidOut({
    tenantId,
    paidOutId: item.id,
    amount: item.amount,
    expenseCode: item.expenseCode,
    expenseName: item.expenseName,
    description: item.paidTo
      ? item.method === 'momo' && item.momoTxnId
        ? `${item.description} (MoMo ${item.momoTxnId}, ${item.paidTo}, ${item.paidToNumber || ''})`
        : `${item.description} (${item.paidTo}, ${item.paidToNumber || ''})`
      : item.description,
    businessDate: String(existing.businessDate || '').slice(0, 10) || new Date().toISOString().slice(0, 10),
    postedBy,
    paidFrom: item.method === 'momo' ? 'momo' : 'cash',
  })
  item.voidedAt = new Date().toISOString()
  const row = await prisma.cashierShift.update({ where: { id: shiftId }, data: { paidOuts } })
  return toDTO(row)
}

export async function deleteCashierShift(tenantId: string, id: string): Promise<boolean> {
  await ensureWalletColumns()
  const existing = await prisma.cashierShift.findFirst({ where: { id, tenantId } })
  if (!existing) return false
  await prisma.cashierShift.delete({ where: { id } })
  return true
}
