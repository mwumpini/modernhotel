import { prisma } from '../database/client'
import { JournalEntry, JournalEntryLine, Invoice, InvoiceLine, Payment, ChartOfAccounts, BankAccount, CostCenter, RevenueCenter, BusinessPartner, BankTransaction, GHANA_CHART_OF_ACCOUNTS } from './models'
import type { PpeAsset, PpeCategory } from './ppe/types'
import { mapCoaTypeToCategory, mapCoaTypeToRollup } from './coaTree'

const toISO = (v: any): string =>
  v instanceof Date ? v.toISOString() : (v ?? new Date().toISOString())

// ---------------------------------------------------------------------------
// Journal entry (general ledger) mapping. The store's JournalEntry maps 1:1 to
// columns, so the round-trip is lossless without needing the JSON column.
// ---------------------------------------------------------------------------

function toStoreLine(row: any): JournalEntryLine {
  return {
    id: row.id,
    journalEntryId: row.journalEntryId,
    accountCode: row.accountCode,
    description: row.description || '',
    debit: row.debit ?? 0,
    credit: row.credit ?? 0,
    currency: row.currency || 'GHS',
    exchangeRate: row.exchangeRate ?? undefined,
    taxCode: row.taxCode || undefined,
    taxAmount: row.taxAmount ?? undefined,
    department: row.department || undefined,
    project: row.project || undefined,
    costCenter: row.costCenter || undefined,
    reference: row.reference || undefined,
  }
}

export function toStoreJournalEntry(row: any): JournalEntry {
  return {
    id: row.id,
    entryNumber: row.entryNumber,
    date: toISO(row.date),
    reference: row.reference || '',
    description: row.description || '',
    totalDebit: row.totalDebit ?? 0,
    totalCredit: row.totalCredit ?? 0,
    currency: row.currency || 'GHS',
    exchangeRate: row.exchangeRate ?? undefined,
    status: (row.status as any) || 'Draft',
    postedBy: row.postedBy || undefined,
    postedAt: row.postedAt ? toISO(row.postedAt) : undefined,
    sourceModule: row.sourceModule || undefined,
    sourceTransactionId: row.sourceTransactionId || undefined,
    createdAt: toISO(row.createdAt),
    updatedAt: toISO(row.updatedAt),
    lines: (row.lines || []).map(toStoreLine),
  }
}

export async function listJournalEntries(tenantId: string): Promise<JournalEntry[]> {
  const rows = await prisma.journalEntry.findMany({
    where: { tenantId },
    include: { lines: true },
    orderBy: { date: 'desc' },
  })
  return rows.map(toStoreJournalEntry)
}

export async function createJournalEntry(tenantId: string, je: Partial<JournalEntry>): Promise<JournalEntry> {
  if (!je.entryNumber) throw new Error('entryNumber is required')
  // Sum the actual lines rather than trusting the caller's totalDebit/totalCredit
  // summary fields — a caller could (and one live path did) mislabel those while
  // the real lines were still fine, or vice versa. The lines are what actually get
  // persisted and what every GL balance/report is computed from.
  const lineDebit = (je.lines || []).reduce((s, l) => s + (l.debit ?? 0), 0)
  const lineCredit = (je.lines || []).reduce((s, l) => s + (l.credit ?? 0), 0)
  if (Math.abs(lineDebit - lineCredit) > 0.01) {
    throw new Error(
      `Journal entry is unbalanced: line debits ${lineDebit.toFixed(2)} ≠ line credits ${lineCredit.toFixed(2)}`
    )
  }
  const row = await prisma.journalEntry.create({
    data: {
      tenantId,
      // Honor the store-supplied id so the DB row matches the client's id.
      ...(je.id ? { id: je.id } : {}),
      entryNumber: je.entryNumber,
      date: je.date ? new Date(je.date) : new Date(),
      reference: je.reference,
      description: je.description,
      totalDebit: je.totalDebit ?? 0,
      totalCredit: je.totalCredit ?? 0,
      currency: je.currency || 'GHS',
      exchangeRate: je.exchangeRate,
      status: je.status || 'Draft',
      postedBy: je.postedBy,
      postedAt: je.postedAt ? new Date(je.postedAt) : undefined,
      sourceModule: je.sourceModule,
      sourceTransactionId: je.sourceTransactionId,
      lines: {
        create: (je.lines || []).map(l => ({
          tenantId,
          ...(l.id ? { id: l.id } : {}),
          accountCode: l.accountCode,
          description: l.description,
          debit: l.debit ?? 0,
          credit: l.credit ?? 0,
          currency: l.currency || je.currency || 'GHS',
          exchangeRate: l.exchangeRate,
          taxCode: l.taxCode,
          taxAmount: l.taxAmount,
          department: l.department,
          project: l.project,
          costCenter: l.costCenter,
          reference: l.reference,
        })),
      },
    } as any,
    include: { lines: true },
  })
  return toStoreJournalEntry(row)
}

export async function updateJournalEntryStatus(
  tenantId: string,
  id: string,
  patch: { status?: string; postedBy?: string; postedAt?: string },
): Promise<JournalEntry | null> {
  const existing = await prisma.journalEntry.findFirst({ where: { id, tenantId } })
  if (!existing) return null
  const row = await prisma.journalEntry.update({
    where: { id },
    data: {
      status: patch.status,
      postedBy: patch.postedBy,
      postedAt: patch.postedAt ? new Date(patch.postedAt) : undefined,
    } as any,
    include: { lines: true },
  })
  return toStoreJournalEntry(row)
}

// ---------------------------------------------------------------------------
// AR/AP sub-ledger: invoices + payments. The store models carry a long tail of
// optional metadata (tax breakdown, WHT tracking, approvals, PDF refs). Only
// the columns that are queried/reported live as real fields; everything else is
// round-tripped through the `details` JSON column so the mapping is lossless.
// ---------------------------------------------------------------------------

// Invoice fields that are stored in dedicated columns; the rest go to details.
const INVOICE_COLUMN_KEYS = new Set([
  'id', 'invoiceNumber', 'type', 'date', 'dueDate', 'businessPartnerId',
  'reference', 'description', 'subtotal', 'taxAmount', 'total', 'currency',
  'exchangeRate', 'status', 'paidAmount', 'paidDate', 'journalEntryId',
  'sourceModule', 'createdAt', 'updatedAt', 'lines',
])

function toStoreInvoiceLine(row: any): InvoiceLine {
  return {
    id: row.id,
    invoiceId: row.invoiceId,
    itemCode: row.itemCode || undefined,
    description: row.description || '',
    quantity: row.quantity ?? 0,
    unitPrice: row.unitPrice ?? 0,
    amount: row.amount ?? 0,
    taxCode: row.taxCode || undefined,
    taxAmount: row.taxAmount ?? 0,
    glAccountCode: row.glAccountCode || '',
    costCenter: row.costCenter || undefined,
    project: row.project || undefined,
    uom: row.uom || undefined,
    taxRate: row.taxRate ?? undefined,
    ...((row.details as object) || {}),
  }
}

export function toStoreInvoice(row: any): Invoice {
  const details = (row.details as Record<string, any>) || {}
  return {
    ...details,
    id: row.id,
    invoiceNumber: row.invoiceNumber,
    type: (row.type as any) || 'Sales',
    date: toISO(row.date),
    dueDate: row.dueDate ? toISO(row.dueDate) : (row.date ? toISO(row.date) : ''),
    businessPartnerId: row.businessPartnerId || '',
    reference: row.reference || undefined,
    description: row.description || '',
    subtotal: row.subtotal ?? 0,
    taxAmount: row.taxAmount ?? 0,
    total: row.total ?? 0,
    currency: row.currency || 'GHS',
    exchangeRate: row.exchangeRate ?? undefined,
    status: (row.status as any) || 'Draft',
    paidAmount: row.paidAmount ?? 0,
    paidDate: row.paidDate ? toISO(row.paidDate) : undefined,
    journalEntryId: row.journalEntryId || undefined,
    sourceModule: row.sourceModule || undefined,
    createdAt: toISO(row.createdAt),
    updatedAt: toISO(row.updatedAt),
    lines: (row.lines || []).map(toStoreInvoiceLine),
  } as Invoice
}

function invoiceDetails(inv: Partial<Invoice>): Record<string, any> {
  const out: Record<string, any> = {}
  for (const [k, v] of Object.entries(inv)) {
    if (v === undefined) continue
    if (INVOICE_COLUMN_KEYS.has(k)) continue
    out[k] = v
  }
  return out
}

function invoiceLineDetails(line: Partial<InvoiceLine>): Record<string, any> {
  const known = new Set([
    'id', 'invoiceId', 'itemCode', 'description', 'quantity', 'unitPrice',
    'amount', 'taxCode', 'taxAmount', 'glAccountCode', 'costCenter', 'project',
    'uom', 'taxRate',
  ])
  const out: Record<string, any> = {}
  for (const [k, v] of Object.entries(line)) {
    if (v === undefined || known.has(k)) continue
    out[k] = v
  }
  return out
}

function invoiceLineCreateData(tenantId: string, l: Partial<InvoiceLine>) {
  const extra = invoiceLineDetails(l)
  return {
    tenantId,
    ...(l.id ? { id: l.id } : {}),
    itemCode: l.itemCode,
    description: l.description,
    quantity: l.quantity ?? 0,
    unitPrice: l.unitPrice ?? 0,
    amount: l.amount ?? 0,
    taxCode: l.taxCode,
    taxAmount: l.taxAmount ?? 0,
    glAccountCode: l.glAccountCode,
    costCenter: l.costCenter,
    project: l.project,
    uom: l.uom,
    taxRate: l.taxRate,
    details: Object.keys(extra).length ? extra : undefined,
  }
}

export async function listInvoices(tenantId: string): Promise<Invoice[]> {
  const rows = await prisma.accountingInvoice.findMany({
    where: { tenantId },
    include: { lines: true },
    orderBy: { date: 'desc' },
  })
  return rows.map(toStoreInvoice)
}

export async function createInvoice(tenantId: string, inv: Partial<Invoice>): Promise<Invoice> {
  if (!inv.invoiceNumber) throw new Error('invoiceNumber is required')
  const extra = invoiceDetails(inv)
  const row = await prisma.accountingInvoice.create({
    data: {
      tenantId,
      ...(inv.id ? { id: inv.id } : {}),
      invoiceNumber: inv.invoiceNumber,
      type: inv.type || 'Sales',
      date: inv.date ? new Date(inv.date) : new Date(),
      // Always persist a due date — F&B and other auto-captures used to omit it,
      // which rendered as "Invalid Date" in AR desks.
      dueDate: inv.dueDate ? new Date(inv.dueDate) : (inv.date ? new Date(inv.date) : new Date()),
      businessPartnerId: inv.businessPartnerId,
      reference: inv.reference,
      description: inv.description,
      subtotal: inv.subtotal ?? 0,
      taxAmount: inv.taxAmount ?? 0,
      total: inv.total ?? 0,
      currency: inv.currency || 'GHS',
      exchangeRate: inv.exchangeRate,
      status: inv.status || 'Draft',
      paidAmount: inv.paidAmount ?? 0,
      paidDate: inv.paidDate ? new Date(inv.paidDate) : undefined,
      journalEntryId: inv.journalEntryId,
      sourceModule: inv.sourceModule,
      details: Object.keys(extra).length ? extra : undefined,
      lines: {
        create: (inv.lines || []).map(l => invoiceLineCreateData(tenantId, l)),
      },
    } as any,
    include: { lines: true },
  })
  return toStoreInvoice(row)
}

export async function updateInvoice(tenantId: string, id: string, patch: Partial<Invoice>): Promise<Invoice | null> {
  const existing = await prisma.accountingInvoice.findFirst({ where: { id, tenantId } })
  if (!existing) return null

  // Merge incoming detail keys onto whatever is already stored so a partial
  // update never drops previously persisted metadata.
  const incomingExtra = invoiceDetails(patch)
  const mergedDetails = { ...((existing.details as Record<string, any>) || {}), ...incomingExtra }

  const data: Record<string, any> = { details: Object.keys(mergedDetails).length ? mergedDetails : undefined }
  if (patch.invoiceNumber !== undefined) data.invoiceNumber = patch.invoiceNumber
  if (patch.type !== undefined) data.type = patch.type
  if (patch.date !== undefined) data.date = new Date(patch.date)
  if (patch.dueDate !== undefined) data.dueDate = patch.dueDate ? new Date(patch.dueDate) : null
  if (patch.businessPartnerId !== undefined) data.businessPartnerId = patch.businessPartnerId
  if (patch.reference !== undefined) data.reference = patch.reference
  if (patch.description !== undefined) data.description = patch.description
  if (patch.subtotal !== undefined) data.subtotal = patch.subtotal
  if (patch.taxAmount !== undefined) data.taxAmount = patch.taxAmount
  if (patch.total !== undefined) data.total = patch.total
  if (patch.currency !== undefined) data.currency = patch.currency
  if (patch.exchangeRate !== undefined) data.exchangeRate = patch.exchangeRate
  if (patch.status !== undefined) data.status = patch.status
  if (patch.paidAmount !== undefined) data.paidAmount = patch.paidAmount
  if (patch.paidDate !== undefined) data.paidDate = patch.paidDate ? new Date(patch.paidDate) : null
  if (patch.journalEntryId !== undefined) data.journalEntryId = patch.journalEntryId
  if (patch.sourceModule !== undefined) data.sourceModule = patch.sourceModule

  // Replace the line set only when the caller supplies one.
  if (patch.lines !== undefined) {
    data.lines = {
      deleteMany: {},
      create: patch.lines.map(l => invoiceLineCreateData(tenantId, l)),
    }
  }

  const row = await prisma.accountingInvoice.update({
    where: { id },
    data: data as any,
    include: { lines: true },
  })
  return toStoreInvoice(row)
}

export async function deleteInvoice(tenantId: string, id: string): Promise<boolean> {
  const existing = await prisma.accountingInvoice.findFirst({ where: { id, tenantId } })
  if (!existing) return false
  await prisma.accountingInvoice.delete({ where: { id } })
  return true
}

// Payment columns; the rest (WHT, receipt acknowledgement, PDF refs) go to details.
const PAYMENT_COLUMN_KEYS = new Set([
  'id', 'paymentNumber', 'date', 'type', 'businessPartnerId', 'invoiceId',
  'reference', 'description', 'amount', 'currency', 'exchangeRate',
  'paymentMethod', 'bankAccountId', 'checkNumber', 'status', 'journalEntryId',
  'createdAt', 'updatedAt',
])

export function toStorePayment(row: any): Payment {
  const details = (row.details as Record<string, any>) || {}
  return {
    ...details,
    id: row.id,
    paymentNumber: row.paymentNumber,
    date: toISO(row.date),
    type: (row.type as any) || 'Receipt',
    businessPartnerId: row.businessPartnerId || '',
    invoiceId: row.invoiceId || undefined,
    reference: row.reference || undefined,
    description: row.description || '',
    amount: row.amount ?? 0,
    currency: row.currency || 'GHS',
    exchangeRate: row.exchangeRate ?? undefined,
    paymentMethod: (row.paymentMethod as any) || 'Cash',
    bankAccountId: row.bankAccountId || undefined,
    checkNumber: row.checkNumber || undefined,
    status: (row.status as any) || 'Draft',
    journalEntryId: row.journalEntryId || undefined,
    createdAt: toISO(row.createdAt),
    updatedAt: toISO(row.updatedAt),
  } as Payment
}

function paymentDetails(p: Partial<Payment>): Record<string, any> {
  const out: Record<string, any> = {}
  for (const [k, v] of Object.entries(p)) {
    if (v === undefined || PAYMENT_COLUMN_KEYS.has(k)) continue
    out[k] = v
  }
  return out
}

export async function listPayments(tenantId: string): Promise<Payment[]> {
  const rows = await prisma.accountingPayment.findMany({
    where: { tenantId },
    orderBy: { date: 'desc' },
  })
  return rows.map(toStorePayment)
}

export async function createPayment(tenantId: string, p: Partial<Payment>): Promise<Payment> {
  if (!p.paymentNumber) throw new Error('paymentNumber is required')
  const extra = paymentDetails(p)
  const row = await prisma.accountingPayment.create({
    data: {
      tenantId,
      ...(p.id ? { id: p.id } : {}),
      paymentNumber: p.paymentNumber,
      date: p.date ? new Date(p.date) : new Date(),
      type: p.type || 'Receipt',
      businessPartnerId: p.businessPartnerId,
      invoiceId: p.invoiceId,
      reference: p.reference,
      description: p.description,
      amount: p.amount ?? 0,
      currency: p.currency || 'GHS',
      exchangeRate: p.exchangeRate,
      paymentMethod: p.paymentMethod,
      bankAccountId: p.bankAccountId,
      checkNumber: p.checkNumber,
      status: p.status || 'Draft',
      journalEntryId: p.journalEntryId,
      details: Object.keys(extra).length ? extra : undefined,
    } as any,
  })
  return toStorePayment(row)
}

export async function updatePayment(tenantId: string, id: string, patch: Partial<Payment>): Promise<Payment | null> {
  const existing = await prisma.accountingPayment.findFirst({ where: { id, tenantId } })
  if (!existing) return null

  const incomingExtra = paymentDetails(patch)
  const mergedDetails = { ...((existing.details as Record<string, any>) || {}), ...incomingExtra }

  const data: Record<string, any> = { details: Object.keys(mergedDetails).length ? mergedDetails : undefined }
  if (patch.paymentNumber !== undefined) data.paymentNumber = patch.paymentNumber
  if (patch.date !== undefined) data.date = new Date(patch.date)
  if (patch.type !== undefined) data.type = patch.type
  if (patch.businessPartnerId !== undefined) data.businessPartnerId = patch.businessPartnerId
  if (patch.invoiceId !== undefined) data.invoiceId = patch.invoiceId
  if (patch.reference !== undefined) data.reference = patch.reference
  if (patch.description !== undefined) data.description = patch.description
  if (patch.amount !== undefined) data.amount = patch.amount
  if (patch.currency !== undefined) data.currency = patch.currency
  if (patch.exchangeRate !== undefined) data.exchangeRate = patch.exchangeRate
  if (patch.paymentMethod !== undefined) data.paymentMethod = patch.paymentMethod
  if (patch.bankAccountId !== undefined) data.bankAccountId = patch.bankAccountId
  if (patch.checkNumber !== undefined) data.checkNumber = patch.checkNumber
  if (patch.status !== undefined) data.status = patch.status
  if (patch.journalEntryId !== undefined) data.journalEntryId = patch.journalEntryId

  const row = await prisma.accountingPayment.update({
    where: { id },
    data: data as any,
  })
  return toStorePayment(row)
}

export async function deletePayment(tenantId: string, id: string): Promise<Payment | null> {
  const existing = await prisma.accountingPayment.findFirst({ where: { id, tenantId } })
  if (!existing) return null
  await prisma.accountingPayment.delete({ where: { id } })
  return toStorePayment(existing)
}

// ---------------------------------------------------------------------------
// Bank reconciliation — was previously localStorage-only (unscoped by tenant,
// no backend at all). Field shape matches src/app/lib/accounting/bankRecon/types.ts.
// ---------------------------------------------------------------------------

function toStoreRecon(row: any) {
  return {
    id: row.id,
    bankAccountId: row.bankAccountId,
    periodEndDate: toISO(row.periodEndDate).slice(0, 10),
    statementBalance: Number(row.statementBalance),
    cashbookBalance: Number(row.cashbookBalance),
    status: row.status,
    preparedAt: row.preparedAt ? toISO(row.preparedAt) : undefined,
    approvedAt: row.approvedAt ? toISO(row.approvedAt) : undefined,
    createdAt: toISO(row.createdAt),
    updatedAt: toISO(row.updatedAt),
  }
}

function toStoreReconItem(row: any) {
  return {
    id: row.id,
    reconciliationId: row.reconciliationId,
    itemType: row.itemType,
    description: row.description,
    reference: row.reference || undefined,
    transactionDate: row.transactionDate ? toISO(row.transactionDate).slice(0, 10) : undefined,
    amount: Number(row.amount),
    isCleared: row.isCleared,
    clearedDate: row.clearedDate ? toISO(row.clearedDate).slice(0, 10) : undefined,
    journalEntryId: row.journalEntryId || undefined,
    offsetGlCode: row.offsetGlCode || undefined,
    carriedFromItemId: row.carriedFromItemId || undefined,
    createdAt: toISO(row.createdAt),
  }
}

export async function listBankReconciliations(tenantId: string) {
  const [reconciliations, items] = await Promise.all([
    prisma.bankReconciliation.findMany({ where: { tenantId }, orderBy: { periodEndDate: 'desc' } }),
    prisma.reconcilingItem.findMany({ where: { tenantId } }),
  ])
  return {
    reconciliations: reconciliations.map(toStoreRecon),
    items: items.map(toStoreReconItem),
  }
}

export async function upsertBankReconciliation(tenantId: string, recon: {
  id: string
  bankAccountId: string
  periodEndDate: string
  statementBalance: number
  cashbookBalance: number
  status: string
  preparedAt?: string
  approvedAt?: string
}) {
  const data = {
    bankAccountId: recon.bankAccountId,
    periodEndDate: new Date(recon.periodEndDate),
    statementBalance: recon.statementBalance,
    cashbookBalance: recon.cashbookBalance,
    status: recon.status,
    preparedAt: recon.preparedAt ? new Date(recon.preparedAt) : undefined,
    approvedAt: recon.approvedAt ? new Date(recon.approvedAt) : undefined,
  }
  // Check ownership BEFORE writing — `upsert`'s `where: { id }` has no tenant filter
  // (id is the sole unique key), so a naive upsert would silently overwrite another
  // tenant's row on an id collision instead of refusing.
  const existing = await prisma.bankReconciliation.findUnique({ where: { id: recon.id } })
  if (existing && existing.tenantId !== tenantId) {
    throw new Error('Reconciliation belongs to a different tenant')
  }
  const row = existing
    ? await prisma.bankReconciliation.update({ where: { id: recon.id }, data })
    : await prisma.bankReconciliation.create({ data: { id: recon.id, tenantId, ...data } })
  return toStoreRecon(row)
}

export async function upsertReconcilingItem(tenantId: string, item: {
  id: string
  reconciliationId: string
  itemType: string
  description: string
  reference?: string
  transactionDate?: string
  amount: number
  isCleared: boolean
  clearedDate?: string
  journalEntryId?: string
  offsetGlCode?: string
  carriedFromItemId?: string
}) {
  const data = {
    reconciliationId: item.reconciliationId,
    itemType: item.itemType,
    description: item.description,
    reference: item.reference,
    transactionDate: item.transactionDate ? new Date(item.transactionDate) : undefined,
    amount: item.amount,
    isCleared: item.isCleared,
    clearedDate: item.clearedDate ? new Date(item.clearedDate) : undefined,
    journalEntryId: item.journalEntryId,
    offsetGlCode: item.offsetGlCode,
    carriedFromItemId: item.carriedFromItemId,
  }
  // Check ownership BEFORE writing — see upsertBankReconciliation for why upsert's
  // where-by-id alone isn't a safe tenant guard.
  const existing = await prisma.reconcilingItem.findUnique({ where: { id: item.id } })
  if (existing && existing.tenantId !== tenantId) {
    throw new Error('Reconciling item belongs to a different tenant')
  }
  const row = existing
    ? await prisma.reconcilingItem.update({ where: { id: item.id }, data })
    : await prisma.reconcilingItem.create({ data: { id: item.id, tenantId, ...data } })
  return toStoreReconItem(row)
}

export async function deleteReconcilingItem(tenantId: string, id: string) {
  const existing = await prisma.reconcilingItem.findFirst({ where: { id, tenantId } })
  if (!existing) return false
  await prisma.reconcilingItem.delete({ where: { id } })
  return true
}

// ---------------------------------------------------------------------------
// Chart of accounts — was previously in-memory only (rebuilt from the seed on
// every page load; any account you added, renamed, or deleted was gone on
// refresh). The `accounts` table already existed but nothing wrote to it.
// `type` is the coarse 5-value DB enum used by other tables (folio/expense
// lines); `category` carries the exact client-side CoaAccountType (e.g. "Cost
// of Sales", "Contra") so it round-trips losslessly instead of collapsing to
// the coarse type on every reload.
// ---------------------------------------------------------------------------

function toDbAccountType(type: string): 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE' {
  return mapCoaTypeToRollup(type as any).toUpperCase() as any
}

function toStoreAccount(row: any): ChartOfAccounts {
  const fallbackType = row.type.charAt(0) + row.type.slice(1).toLowerCase()
  const type = (row.category || fallbackType) as ChartOfAccounts['type']
  return {
    id: row.id,
    name: row.name,
    type,
    parentId: row.parentId || null,
    position: row.position ?? 0,
    code: row.code,
    level: 1, // recomputed client-side from parentId via syncCoaLegacyFields
    category: mapCoaTypeToCategory(type),
    isActive: row.isActive,
    currency: 'GHS',
    createdAt: toISO(row.createdAt),
    updatedAt: toISO(row.updatedAt),
  }
}

export async function listChartOfAccounts(tenantId: string): Promise<ChartOfAccounts[]> {
  await ensurePostedTemplateAccounts(tenantId)
  const rows = await prisma.account.findMany({ where: { tenantId }, orderBy: { position: 'asc' } })
  return rows.map(toStoreAccount)
}

/** A posted journal can name a template account the tenant chart never received
 *  (payroll Tier 2 is 2225). Add those codes so the balance sheet includes them. */
async function ensurePostedTemplateAccounts(tenantId: string) {
  const [existing, posted] = await Promise.all([
    prisma.account.findMany({ where: { tenantId }, select: { code: true, position: true } }),
    prisma.journalEntryLine.findMany({
      where: { tenantId, journalEntry: { status: 'Posted' } },
      select: { accountCode: true },
      distinct: ['accountCode'],
    }),
  ])
  const have = new Set(existing.map((a) => a.code))
  const postedCodes = new Set(posted.map((l) => l.accountCode))
  const missing = GHANA_CHART_OF_ACCOUNTS.filter((row) => postedCodes.has(row.code) && !have.has(row.code))
  if (!missing.length) return
  let position = existing.reduce((max, a) => Math.max(max, a.position || 0), 0)
  for (const row of missing) {
    position += 1
    await prisma.account.create({
      data: {
        tenantId,
        code: row.code,
        name: row.name,
        type: toDbAccountType(row.type),
        category: row.type,
        position,
        isActive: true,
      },
    })
  }
}

/** `code` (unique per tenant) is the only identifier guaranteed to match between the
 *  client's copy and the DB row — a code seeded through a different path (e.g. the
 *  standalone `prisma/seed.ts` script, which assigns its own DB-generated ids) ends up
 *  with a different `id` than whatever the client currently holds in memory. Every write
 *  below resolves the row (and any parent reference) by code, never by trusting the
 *  caller's id to already match a DB row. */
export async function upsertChartOfAccount(tenantId: string, account: {
  id: string
  code: string
  name: string
  type: string
  /** Parent's `code`, not its id — see the note above. Null for a top-level account. */
  parentCode: string | null
  position: number
  isActive: boolean
}) {
  const parentRow = account.parentCode
    ? await prisma.account.findUnique({ where: { tenantId_code: { tenantId, code: account.parentCode } } })
    : null

  const data = {
    code: account.code,
    name: account.name,
    type: toDbAccountType(account.type),
    category: account.type,
    parentId: parentRow?.id ?? null,
    position: account.position,
    isActive: account.isActive,
  }
  const existing = await prisma.account.findUnique({ where: { tenantId_code: { tenantId, code: account.code } } })
  if (existing && existing.tenantId !== tenantId) {
    throw new Error('Account belongs to a different tenant')
  }
  const row = existing
    ? await prisma.account.update({ where: { id: existing.id }, data })
    : await prisma.account.create({ data: { id: account.id, tenantId, ...data } })
  return toStoreAccount(row)
}

/** First-visit seed only: persists the prebuilt chart the client already showed so it's
 *  there on the next load / another device. Two passes avoid FK ordering issues — parentId
 *  must reference an existing row, and the seed's flat array order doesn't strictly
 *  guarantee every parent precedes its children. Parent links are resolved by code after
 *  the fact (see the function-group comment above for why). */
export async function bulkUpsertChartOfAccounts(tenantId: string, accounts: ChartOfAccounts[]) {
  await prisma.$transaction(
    accounts.map((a) =>
      prisma.account.upsert({
        where: { tenantId_code: { tenantId, code: a.code } },
        update: { name: a.name, type: toDbAccountType(a.type), category: a.type, position: a.position, isActive: a.isActive },
        create: {
          tenantId,
          code: a.code,
          name: a.name,
          type: toDbAccountType(a.type),
          category: a.type,
          position: a.position,
          isActive: a.isActive,
        },
      })
    )
  )

  const rows = await prisma.account.findMany({ where: { tenantId }, select: { id: true, code: true } })
  const dbIdByCode = new Map(rows.map((r) => [r.code, r.id]))
  const clientIdToCode = new Map(accounts.map((a) => [a.id, a.code]))

  const parentUpdates = accounts
    .map((a) => {
      if (!a.parentId) return null
      const parentCode = clientIdToCode.get(a.parentId)
      const parentDbId = parentCode ? dbIdByCode.get(parentCode) : undefined
      const ownDbId = dbIdByCode.get(a.code)
      if (!parentDbId || !ownDbId || parentDbId === ownDbId) return null
      return prisma.account.update({ where: { id: ownDbId }, data: { parentId: parentDbId } })
    })
    .filter((op): op is NonNullable<typeof op> => op !== null)

  if (parentUpdates.length) await prisma.$transaction(parentUpdates)
}

export async function deleteChartOfAccountRow(tenantId: string, id: string) {
  const existing = await prisma.account.findFirst({ where: { id, tenantId } })
  if (!existing) return false
  await prisma.account.delete({ where: { id } })
  return true
}

// ---------------------------------------------------------------------------
// Bank accounts — same previously-in-memory-only gap as chart of accounts:
// added/edited/deleted accounts didn't survive a reload.
// ---------------------------------------------------------------------------

function toStoreBankAccount(row: any): BankAccount {
  return {
    id: row.id,
    accountNumber: row.accountNumber,
    accountName: row.accountName,
    bankName: row.bankName,
    branch: row.branch || undefined,
    swiftCode: row.swiftCode || undefined,
    iban: row.iban || undefined,
    currency: row.currency || 'GHS',
    glAccountCode: row.glAccountCode,
    openingBalanceType: (row.openingBalanceType || undefined) as BankAccount['openingBalanceType'],
    openingBalance: row.openingBalance ?? 0,
    currentBalance: row.currentBalance ?? 0,
    isActive: row.isActive,
    createdAt: toISO(row.createdAt),
    updatedAt: toISO(row.updatedAt),
  }
}

export async function listBankAccounts(tenantId: string): Promise<BankAccount[]> {
  const rows = await prisma.bankAccount.findMany({ where: { tenantId }, orderBy: { createdAt: 'asc' } })
  return rows.map(toStoreBankAccount)
}

export async function upsertBankAccountRow(tenantId: string, account: {
  id: string
  accountNumber: string
  accountName: string
  bankName: string
  branch?: string
  swiftCode?: string
  iban?: string
  currency: string
  glAccountCode: string
  openingBalanceType?: string
  openingBalance: number
  currentBalance: number
  isActive: boolean
}) {
  const data = {
    accountNumber: account.accountNumber,
    accountName: account.accountName,
    bankName: account.bankName,
    branch: account.branch,
    swiftCode: account.swiftCode,
    iban: account.iban,
    currency: account.currency,
    glAccountCode: account.glAccountCode,
    openingBalanceType: account.openingBalanceType,
    openingBalance: account.openingBalance,
    currentBalance: account.currentBalance,
    isActive: account.isActive,
  }
  const existing = await prisma.bankAccount.findUnique({ where: { id: account.id } })
  if (existing && existing.tenantId !== tenantId) {
    throw new Error('Bank account belongs to a different tenant')
  }
  const row = existing
    ? await prisma.bankAccount.update({ where: { id: account.id }, data })
    : await prisma.bankAccount.create({ data: { id: account.id, tenantId, ...data } })
  return toStoreBankAccount(row)
}

export async function deleteBankAccountRow(tenantId: string, id: string) {
  const existing = await prisma.bankAccount.findFirst({ where: { id, tenantId } })
  if (!existing) return false
  await prisma.bankAccount.delete({ where: { id } })
  return true
}

// ---------------------------------------------------------------------------
// Cost & revenue centers — same previously-in-memory-only gap as chart of
// accounts / bank accounts. Unlike chart of accounts there's no pre-existing
// seed script writing to these tables, so client ids can be trusted directly
// (no code-based id resolution needed here).
// ---------------------------------------------------------------------------

function toStoreCostCenter(row: any): CostCenter {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description || undefined,
    type: row.type,
    department: row.department,
    glAccountCode: row.glAccountCode || undefined,
    parentCenter: row.parentCenter || undefined,
    manager: row.manager || undefined,
    budget: row.budget ?? 0,
    actualExpenses: row.actualExpenses ?? 0,
    isActive: row.isActive,
    createdAt: toISO(row.createdAt),
    updatedAt: toISO(row.updatedAt),
  }
}

export async function listCostCenters(tenantId: string): Promise<CostCenter[]> {
  const rows = await prisma.costCenter.findMany({ where: { tenantId }, orderBy: { createdAt: 'asc' } })
  return rows.map(toStoreCostCenter)
}

export async function upsertCostCenterRow(tenantId: string, center: {
  id: string
  code: string
  name: string
  description?: string
  type: string
  department: string
  glAccountCode?: string
  parentCenter?: string
  manager?: string
  budget: number
  actualExpenses: number
  isActive: boolean
}) {
  const data = {
    code: center.code,
    name: center.name,
    description: center.description,
    type: center.type,
    department: center.department,
    glAccountCode: center.glAccountCode,
    parentCenter: center.parentCenter,
    manager: center.manager,
    budget: center.budget,
    actualExpenses: center.actualExpenses,
    isActive: center.isActive,
  }
  const existing = await prisma.costCenter.findUnique({ where: { id: center.id } })
  if (existing && existing.tenantId !== tenantId) {
    throw new Error('Cost centre belongs to a different tenant')
  }
  const row = existing
    ? await prisma.costCenter.update({ where: { id: center.id }, data })
    : await prisma.costCenter.create({ data: { id: center.id, tenantId, ...data } })
  return toStoreCostCenter(row)
}

export async function deleteCostCenterRow(tenantId: string, id: string) {
  const existing = await prisma.costCenter.findFirst({ where: { id, tenantId } })
  if (!existing) return false
  await prisma.costCenter.delete({ where: { id } })
  return true
}

function toStoreRevenueCenter(row: any): RevenueCenter {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description || undefined,
    type: row.type,
    department: row.department,
    glAccountCode: row.glAccountCode,
    parentCenter: row.parentCenter || undefined,
    manager: row.manager || undefined,
    budget: row.budget ?? 0,
    actualRevenue: row.actualRevenue ?? 0,
    isActive: row.isActive,
    createdAt: toISO(row.createdAt),
    updatedAt: toISO(row.updatedAt),
  }
}

export async function listRevenueCenters(tenantId: string): Promise<RevenueCenter[]> {
  const rows = await prisma.revenueCenter.findMany({ where: { tenantId }, orderBy: { createdAt: 'asc' } })
  return rows.map(toStoreRevenueCenter)
}

export async function upsertRevenueCenterRow(tenantId: string, center: {
  id: string
  code: string
  name: string
  description?: string
  type: string
  department: string
  glAccountCode: string
  parentCenter?: string
  manager?: string
  budget: number
  actualRevenue: number
  isActive: boolean
}) {
  const data = {
    code: center.code,
    name: center.name,
    description: center.description,
    type: center.type,
    department: center.department,
    glAccountCode: center.glAccountCode,
    parentCenter: center.parentCenter,
    manager: center.manager,
    budget: center.budget,
    actualRevenue: center.actualRevenue,
    isActive: center.isActive,
  }
  const existing = await prisma.revenueCenter.findUnique({ where: { id: center.id } })
  if (existing && existing.tenantId !== tenantId) {
    throw new Error('Revenue centre belongs to a different tenant')
  }
  const row = existing
    ? await prisma.revenueCenter.update({ where: { id: center.id }, data })
    : await prisma.revenueCenter.create({ data: { id: center.id, tenantId, ...data } })
  return toStoreRevenueCenter(row)
}

export async function deleteRevenueCenterRow(tenantId: string, id: string) {
  const existing = await prisma.revenueCenter.findFirst({ where: { id, tenantId } })
  if (!existing) return false
  await prisma.revenueCenter.delete({ where: { id } })
  return true
}

// ---------------------------------------------------------------------------
// Business partners (customers/suppliers)
// ---------------------------------------------------------------------------

function toStoreBusinessPartner(row: any): BusinessPartner {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    type: row.type,
    taxNumber: row.taxNumber || undefined,
    address: row.address || undefined,
    phone: row.phone || undefined,
    email: row.email || undefined,
    contactPerson: row.contactPerson || undefined,
    creditLimit: row.creditLimit ?? undefined,
    paymentTerms: row.paymentTerms ?? undefined,
    glAccountCode: row.glAccountCode,
    currency: row.currency,
    balance: row.balance ?? 0,
    isActive: row.isActive,
    countryCode: row.countryCode,
    createdAt: toISO(row.createdAt),
    updatedAt: toISO(row.updatedAt),
    bankName: row.bankName || undefined,
    bankAccountNumber: row.bankAccountNumber || undefined,
    bankSwift: row.bankSwift || undefined,
    bankIban: row.bankIban || undefined,
  }
}

export async function listBusinessPartners(tenantId: string): Promise<BusinessPartner[]> {
  const rows = await prisma.businessPartner.findMany({ where: { tenantId }, orderBy: { createdAt: 'asc' } })
  return rows.map(toStoreBusinessPartner)
}

export async function upsertBusinessPartnerRow(tenantId: string, partner: BusinessPartner) {
  const data = {
    code: partner.code,
    name: partner.name,
    type: partner.type,
    taxNumber: partner.taxNumber,
    address: partner.address,
    phone: partner.phone,
    email: partner.email,
    contactPerson: partner.contactPerson,
    creditLimit: partner.creditLimit,
    paymentTerms: partner.paymentTerms,
    glAccountCode: partner.glAccountCode,
    currency: partner.currency,
    balance: partner.balance,
    isActive: partner.isActive,
    countryCode: partner.countryCode,
    bankName: partner.bankName,
    bankAccountNumber: partner.bankAccountNumber,
    bankSwift: partner.bankSwift,
    bankIban: partner.bankIban,
  }
  const existing = await prisma.businessPartner.findUnique({ where: { id: partner.id } })
  if (existing && existing.tenantId !== tenantId) {
    throw new Error('Business partner belongs to a different tenant')
  }
  const row = existing
    ? await prisma.businessPartner.update({ where: { id: partner.id }, data })
    : await prisma.businessPartner.create({ data: { id: partner.id, tenantId, ...data } })
  return toStoreBusinessPartner(row)
}

export async function deleteBusinessPartnerRow(tenantId: string, id: string) {
  const existing = await prisma.businessPartner.findFirst({ where: { id, tenantId } })
  if (!existing) return false
  await prisma.businessPartner.delete({ where: { id } })
  return true
}

// ---------------------------------------------------------------------------
// Bank ledger transactions
// ---------------------------------------------------------------------------

function toStoreBankTransaction(row: any): BankTransaction {
  return {
    id: row.id,
    bankAccountId: row.bankAccountId,
    transactionDate: toISO(row.transactionDate),
    reference: row.reference || '',
    description: row.description || '',
    amount: row.amount ?? 0,
    type: row.type,
    currency: row.currency,
    balance: row.balance ?? 0,
    status: row.status,
    reconciledAt: row.reconciledAt ? toISO(row.reconciledAt) : undefined,
    reconciledBy: row.reconciledBy || undefined,
    journalEntryId: row.journalEntryId || undefined,
    transferToAccountId: row.transferToAccountId || undefined,
    linkedTransactionId: row.linkedTransactionId || undefined,
    createdAt: toISO(row.createdAt),
  }
}

export async function listBankTransactions(tenantId: string): Promise<BankTransaction[]> {
  const rows = await prisma.bankTransaction.findMany({ where: { tenantId }, orderBy: { transactionDate: 'desc' } })
  return rows.map(toStoreBankTransaction)
}

export async function upsertBankTransactionRow(tenantId: string, txn: BankTransaction) {
  const data = {
    bankAccountId: txn.bankAccountId,
    transactionDate: new Date(txn.transactionDate),
    reference: txn.reference,
    description: txn.description,
    amount: txn.amount,
    type: txn.type,
    currency: txn.currency,
    balance: txn.balance,
    status: txn.status,
    reconciledAt: txn.reconciledAt ? new Date(txn.reconciledAt) : null,
    reconciledBy: txn.reconciledBy,
    journalEntryId: txn.journalEntryId,
    transferToAccountId: txn.transferToAccountId,
    linkedTransactionId: txn.linkedTransactionId,
  }
  const existing = await prisma.bankTransaction.findUnique({ where: { id: txn.id } })
  if (existing && existing.tenantId !== tenantId) {
    throw new Error('Bank transaction belongs to a different tenant')
  }
  const row = existing
    ? await prisma.bankTransaction.update({ where: { id: txn.id }, data })
    : await prisma.bankTransaction.create({ data: { id: txn.id, tenantId, ...data } })
  return toStoreBankTransaction(row)
}

export async function deleteBankTransactionRow(tenantId: string, id: string) {
  const existing = await prisma.bankTransaction.findFirst({ where: { id, tenantId } })
  if (!existing) return false
  await prisma.bankTransaction.delete({ where: { id } })
  return true
}

// ---------------------------------------------------------------------------
// PPE (fixed assets) register
// ---------------------------------------------------------------------------

function toStorePpeCategory(row: any): PpeCategory {
  return {
    id: row.id,
    name: row.name,
    codePrefix: row.codePrefix || undefined,
    graClass: row.graClass,
    graRate: row.graRate,
    graMethod: row.graMethod,
    iasMethod: row.iasMethod,
    iasRate: row.iasRate,
    usefulLifeYrs: row.usefulLifeYrs,
    residualPct: row.residualPct,
    presentationGroup: row.presentationGroup,
    organisationId: row.organisationId || undefined,
  }
}

export async function listPpeCategories(tenantId: string): Promise<PpeCategory[]> {
  const rows = await prisma.ppeCategory.findMany({ where: { tenantId }, orderBy: { createdAt: 'asc' } })
  return rows.map(toStorePpeCategory)
}

export async function upsertPpeCategoryRow(tenantId: string, category: PpeCategory) {
  const data = {
    name: category.name,
    codePrefix: category.codePrefix,
    graClass: category.graClass,
    graRate: category.graRate,
    graMethod: category.graMethod,
    iasMethod: category.iasMethod,
    iasRate: category.iasRate,
    usefulLifeYrs: category.usefulLifeYrs,
    residualPct: category.residualPct,
    presentationGroup: category.presentationGroup,
    organisationId: category.organisationId,
  }
  const existing = await prisma.ppeCategory.findUnique({ where: { id: category.id } })
  if (existing && existing.tenantId !== tenantId) {
    throw new Error('PPE category belongs to a different tenant')
  }
  const row = existing
    ? await prisma.ppeCategory.update({ where: { id: category.id }, data })
    : await prisma.ppeCategory.create({ data: { id: category.id, tenantId, ...data } })
  return toStorePpeCategory(row)
}

export async function deletePpeCategoryRow(tenantId: string, id: string) {
  const existing = await prisma.ppeCategory.findFirst({ where: { id, tenantId } })
  if (!existing) return false
  await prisma.ppeCategory.delete({ where: { id } })
  return true
}

function toStorePpeAsset(row: any): PpeAsset {
  return {
    id: row.id,
    purchaseDate: toISO(row.purchaseDate).slice(0, 10),
    assetCode: row.assetCode,
    assetName: row.assetName,
    categoryId: row.categoryId,
    quantity: row.quantity,
    unitPrice: row.unitPrice,
    capExp: row.capExp,
    disposalDate: row.disposalDate ? toISO(row.disposalDate).slice(0, 10) : undefined,
    disposalProceeds: row.disposalProceeds ?? undefined,
    organisationId: row.organisationId || undefined,
    capitalizationJournalEntryId: row.capitalizationJournalEntryId || undefined,
    ledgerAccumDepPosted: row.ledgerAccumDepPosted ?? undefined,
    lastDepreciationJournalEntryId: row.lastDepreciationJournalEntryId || undefined,
    disposalJournalEntryId: row.disposalJournalEntryId || undefined,
    disposalProceedsBankAccountId: row.disposalProceedsBankAccountId || undefined,
    attachments: row.attachments || undefined,
    createdAt: toISO(row.createdAt),
    updatedAt: toISO(row.updatedAt),
  }
}

export async function listPpeAssets(tenantId: string): Promise<PpeAsset[]> {
  const rows = await prisma.ppeAsset.findMany({ where: { tenantId }, orderBy: { createdAt: 'asc' } })
  return rows.map(toStorePpeAsset)
}

export async function upsertPpeAssetRow(tenantId: string, asset: PpeAsset) {
  const data = {
    purchaseDate: new Date(asset.purchaseDate),
    assetCode: asset.assetCode,
    assetName: asset.assetName,
    categoryId: asset.categoryId,
    quantity: asset.quantity,
    unitPrice: asset.unitPrice,
    capExp: asset.capExp,
    disposalDate: asset.disposalDate ? new Date(asset.disposalDate) : null,
    disposalProceeds: asset.disposalProceeds,
    organisationId: asset.organisationId,
    capitalizationJournalEntryId: asset.capitalizationJournalEntryId,
    ledgerAccumDepPosted: asset.ledgerAccumDepPosted,
    lastDepreciationJournalEntryId: asset.lastDepreciationJournalEntryId,
    disposalJournalEntryId: asset.disposalJournalEntryId,
    disposalProceedsBankAccountId: asset.disposalProceedsBankAccountId,
    attachments: asset.attachments,
  }
  const existing = await prisma.ppeAsset.findUnique({ where: { id: asset.id } })
  if (existing && existing.tenantId !== tenantId) {
    throw new Error('PPE asset belongs to a different tenant')
  }
  const row = existing
    ? await prisma.ppeAsset.update({ where: { id: asset.id }, data })
    : await prisma.ppeAsset.create({ data: { id: asset.id, tenantId, ...data } })
  return toStorePpeAsset(row)
}

export async function deletePpeAssetRow(tenantId: string, id: string) {
  const existing = await prisma.ppeAsset.findFirst({ where: { id, tenantId } })
  if (!existing) return false
  await prisma.ppeAsset.delete({ where: { id } })
  return true
}
