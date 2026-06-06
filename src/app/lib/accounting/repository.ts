import { prisma } from '../database/client'
import { JournalEntry, JournalEntryLine, Invoice, InvoiceLine, Payment } from './models'

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
    dueDate: row.dueDate ? toISO(row.dueDate) : '',
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
      dueDate: inv.dueDate ? new Date(inv.dueDate) : undefined,
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
