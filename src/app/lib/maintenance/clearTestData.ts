import { prisma } from '@/app/lib/database/client'
import { makeCtx } from '@/app/lib/sampleData/common'
import { getSampleDataStatus, loadSampleData } from '@/app/lib/sampleData'
import { markDataReset } from './dataResetMarker'

/**
 * "Clear test data" for one hotel: removes what testers entered and keeps the set-up.
 *
 * Cleared:  every transaction (stays, folios, payments, invoices, journals, POS orders, stock
 *           movements, HR records, incidents, …) — sample ones too, because the sample set is
 *           loaded again afterwards, fresh around today's date.
 *           Guests, company clients, F&B customers, suppliers, business partners and HR
 *           employees that testers created (sample ones stay).
 * Kept:     settings, staff logins, roles, rooms and rates, menu, recipes, stock items, chart of
 *           accounts, taxes, payment methods, departments, compliance rules and report designs,
 *           document templates, and the audit log.
 * Reset:    stock on hand of non-sample items → 0; every cash/bank register → its opening balance;
 *           petty cash → 0; restaurant tables → available; the kitchen ready board → empty.
 *           Room status comes from its history, which is cleared, so rooms read as available.
 */

/** Transaction tables, children before parents so no row is left pointing at a removed one. */
const TRANSACTION_MODELS = [
  'expenseLine', 'pettyCashTxn', 'expenseVoucher',
  'journalEntryLine', 'journalEntry',
  'accountingInvoiceLine', 'accountingPayment', 'accountingInvoice',
  'reconcilingItem', 'bankReconciliation', 'bankTransaction',
  'ppeAsset',
  'folioLine', 'payment', 'folio', 'guestFolio',
  'cashTransfer', 'cashierShift', 'nightAuditLog',
  'fBOrderItem', 'fBOrder', 'tableReservation',
  'serviceRequest', 'eventBooking',
  'housekeepingTask', 'roomStatusLog', 'maintenanceRequest',
  'purchaseOrderItem', 'purchaseOrder', 'requisitionItem', 'requisition',
  'gRNItem', 'goodsReceiptNote', 'stockTransferItem', 'stockTransfer',
  'stockCountItem', 'stockCount', 'goodsIssueItem', 'goodsIssue',
  'qualityCheckItem', 'qualityCheck', 'supplierInvoiceItem', 'supplierInvoice',
  'inventoryAlertAcknowledgment', 'inventoryTransaction',
  'hrPayrollRecord', 'hrPayrollPeriod', 'hrLeaveRequest', 'hrTrainingRecord', 'hrAttendance',
  'hrShift', 'hrEmployeeBenefits', 'hrPerformanceReview', 'hrPerformanceLog', 'hrEmployeeChange',
  'hrOnboardingChecklist', 'hrStaffDebtRepayment', 'hrStaffDebt',
  'complianceReport',
  'securityIncident', 'securityVisitor', 'securityPatrolLog', 'securityShift',
  'reservation',
] as const

/** Profiles: only the ones testers created are removed (sample profiles keep their ids and links). */
const PROFILE_MODELS = ['guest', 'company', 'fBCustomer', 'businessPartner', 'supplier', 'hrEmployee'] as const

type Counts = Record<string, number>

function model(name: string): any {
  const m = (prisma as any)[name]
  if (!m || typeof m.deleteMany !== 'function') throw new Error(`Unknown table: ${name}`)
  return m
}

function notSample(tenantId: string) {
  const { p } = makeCtx(tenantId)
  return { tenantId, NOT: { id: { startsWith: p } } }
}

/** What a clear would remove — nothing is changed. */
export async function countTestData(tenantId: string): Promise<{ transactions: Counts; profiles: Counts; total: number }> {
  const transactions: Counts = {}
  for (const name of TRANSACTION_MODELS) transactions[name] = await model(name).count({ where: { tenantId } })
  const profiles: Counts = {}
  for (const name of PROFILE_MODELS) profiles[name] = await model(name).count({ where: notSample(tenantId) })
  const total = [...Object.values(transactions), ...Object.values(profiles)].reduce((s, n) => s + n, 0)
  return { transactions, profiles, total }
}

export async function clearTestData(tenantId: string): Promise<{ removed: Counts; sampleReloaded: boolean; notes: string[] }> {
  // Fail before touching anything if a table name is wrong.
  for (const name of [...TRANSACTION_MODELS, ...PROFILE_MODELS]) model(name)

  const { p } = makeCtx(tenantId)
  const sampleWasLoaded = (await getSampleDataStatus(tenantId)).loaded
  const banks = await prisma.bankAccount.findMany({ where: { tenantId }, select: { id: true, openingBalance: true } })

  // One database transaction: either everything below happens, or nothing does.
  const ops: any[] = []
  for (const name of TRANSACTION_MODELS) ops.push(model(name).deleteMany({ where: { tenantId } }))
  // Kept stock items must not point at a supplier that is about to go.
  ops.push(prisma.inventoryItem.updateMany({
    where: { tenantId, supplierId: { not: null }, NOT: { supplierId: { startsWith: p } } },
    data: { supplierId: null },
  }))
  for (const name of PROFILE_MODELS) ops.push(model(name).deleteMany({ where: notSample(tenantId) }))
  ops.push(prisma.inventoryItem.updateMany({ where: notSample(tenantId), data: { quantityOnHand: 0 } }))
  for (const bank of banks) {
    ops.push(prisma.bankAccount.update({ where: { id: bank.id }, data: { currentBalance: bank.openingBalance || 0 } }))
  }
  ops.push(prisma.pettyCashFund.updateMany({ where: { tenantId }, data: { balance: 0 } }))
  ops.push(prisma.restaurantTable.updateMany({ where: { tenantId }, data: { status: 'available' } }))
  ops.push(prisma.fBMenuItem.updateMany({ where: { tenantId }, data: { readyNow: false, readyPortions: null, readyForDate: null } }))

  const results = await prisma.$transaction(ops)
  // Tell every browser to drop its local copies of what was just cleared.
  await markDataReset(tenantId)

  const removed: Counts = {}
  TRANSACTION_MODELS.forEach((name, i) => { removed[name] = results[i]?.count ?? 0 })
  const profileStart = TRANSACTION_MODELS.length + 1
  PROFILE_MODELS.forEach((name, i) => { removed[name] = results[profileStart + i]?.count ?? 0 })

  // Fresh sample set around today, only for a hotel that had it loaded.
  let notes: string[] = []
  if (sampleWasLoaded) {
    try {
      notes = (await loadSampleData(tenantId)).notes
    } catch (error) {
      console.error('[clearTestData] sample reload failed', error)
      notes = ['Test data was cleared, but loading the sample set again failed. Use “Load again” above.']
    }
  }
  return { removed, sampleReloaded: sampleWasLoaded, notes }
}
