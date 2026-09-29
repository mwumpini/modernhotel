/**
 * Server-side F&B sale / COGS / refund posting (Prisma accounting repos).
 * Keeps bill ↔ ledger atomic with PATCH /api/fb/orders/[id] — not client Zustand.
 */
import {
  createInvoice,
  createPayment,
  createJournalEntry,
  updateInvoice,
  updatePayment,
} from '@/app/lib/accounting/repository'
import { GL_ACCOUNTS, PAYMENT_GL_MAP } from '@/app/lib/accounting/glAccounts'
import { departmentSourceGlAccount } from '@/app/lib/fb/venueGl'
import { prisma } from '@/app/lib/database/client'
import { GHANA_TAX_CODES } from '@/app/lib/accounting/models'
import { remapComplianceGlToChart } from '@/app/lib/tax/glMap'

export type FbDepartmentSource = 'restaurant' | 'bar' | 'room_service'

/** Fallback when an order has no stored per-tax breakdown (legacy rows) — VAT payable leaf. */
const FALLBACK_TAX_GL = GHANA_TAX_CODES.VAT.glCode

export type FbTaxLine = { taxCode?: string; name?: string; amount: number; glAccountCode?: string | null }

/**
 * One credit line per stored tax (VAT 2110, NHIL 2120, GETFund 2130, Tourism 2150 …),
 * same split the front-office checkout posts. Any rounding gap vs the order's taxAmount
 * goes on the VAT line (or the last line) so the entry still balances.
 */
function buildTaxCredits(taxLines: FbTaxLine[] | null | undefined, taxAmount: number) {
  const parsed = (Array.isArray(taxLines) ? taxLines : [])
    .map((tl) => ({
      name: String(tl?.name || tl?.taxCode || 'Tax'),
      taxCode: tl?.taxCode ? String(tl.taxCode) : undefined,
      gl: remapComplianceGlToChart(String(tl?.glAccountCode || '').trim()) || FALLBACK_TAX_GL,
      amount: +Number(tl?.amount || 0).toFixed(2),
    }))
    .filter((tl) => tl.amount > 0)

  if (parsed.length === 0) {
    return [{ name: 'Output Tax', taxCode: undefined as string | undefined, gl: FALLBACK_TAX_GL, amount: taxAmount }]
  }

  const diff = +(taxAmount - parsed.reduce((s, tl) => s + tl.amount, 0)).toFixed(2)
  if (Math.abs(diff) >= 0.01) {
    const vatIdx = parsed.findIndex((tl) => tl.gl === FALLBACK_TAX_GL)
    const idx = vatIdx >= 0 ? vatIdx : parsed.length - 1
    parsed[idx].amount = Math.max(0, +(parsed[idx].amount + diff).toFixed(2))
  }
  return parsed.filter((tl) => tl.amount > 0)
}

function revenueCenter(source: FbDepartmentSource): string {
  switch (source) {
    case 'bar':
      return 'BAR'
    case 'room_service':
      return 'RS'
    default:
      return 'REST'
  }
}

function mapVenueToSource(venue: string): FbDepartmentSource {
  const v = String(venue || '').toLowerCase().replace(/\s+/g, '_')
  if (v === 'bar' || v === 'pool_bar') return 'bar'
  if (v === 'room_service') return 'room_service'
  return 'restaurant'
}

async function journalExists(tenantId: string, id: string): Promise<boolean> {
  const row = await prisma.journalEntry.findFirst({ where: { id, tenantId } })
  return Boolean(row)
}

async function invoiceExists(tenantId: string, id: string): Promise<boolean> {
  const row = await prisma.accountingInvoice.findFirst({ where: { id, tenantId } })
  return Boolean(row)
}

async function paymentExists(tenantId: string, id: string): Promise<boolean> {
  const row = await prisma.accountingPayment.findFirst({ where: { id, tenantId } })
  return Boolean(row)
}

export type PostFbSaleInput = {
  tenantId: string
  orderId: string
  orderNumber: string
  venue: string
  customerName: string
  tableNumber?: string | null
  subtotal: number
  taxAmount: number
  /** FBOrder.taxLines — per-tax breakdown with glAccountCode */
  taxLines?: FbTaxLine[] | null
  total: number
  paymentMethod: 'Cash' | 'Card' | 'Mobile Money'
  cashierUserId?: string | null
  cashierName?: string | null
  staffId?: string | null
  staffName?: string | null
  items: { description: string; quantity: number; unitPrice: number }[]
  /** Skip walk-in sale (Room Charge — folio only). Still posts COGS if amount > 0. */
  skipSale?: boolean
  cogsAmount?: number
}

export async function postFbSaleAndCogsServer(
  input: PostFbSaleInput,
): Promise<{ invoiceId?: string; receiptId?: string; cogsJournalId?: string }> {
  const source = mapVenueToSource(input.venue)
  const sourceKey = source.toUpperCase()
  const revenueGl = departmentSourceGlAccount(source)
  const center = revenueCenter(source)
  const now = new Date().toISOString()
  const result: { invoiceId?: string; receiptId?: string; cogsJournalId?: string } = {}

  if (!input.skipSale) {
    const invoiceId = `INV-${sourceKey}-${input.orderId}`
    const journalEntryId = `JE-${sourceKey}-${input.orderId}`
    const receiptId = `RCP-${sourceKey}-PAY-${input.orderId}`
    const payJeId = `JE-PAY-${sourceKey}-PAY-${input.orderId}`

    if (!(await invoiceExists(input.tenantId, invoiceId))) {
      const subtotal = +Number(input.subtotal).toFixed(2)
      const taxAmount = +Number(input.taxAmount).toFixed(2)
      const total = +Number(input.total).toFixed(2)
      const lines = (input.items.length ? input.items : [{ description: `${source} sale`, quantity: 1, unitPrice: subtotal }]).map(
        (item, idx) => ({
          id: `IL-${input.orderId}-${idx}`,
          invoiceId,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          amount: +(item.quantity * item.unitPrice).toFixed(2),
          taxAmount: 0,
          glAccountCode: revenueGl,
        }),
      )

      const jeLines: any[] = [
        {
          id: `JL-${journalEntryId}-ar`,
          journalEntryId,
          accountCode: GL_ACCOUNTS.ACCOUNTS_RECEIVABLE,
          description: `AR — ${input.orderNumber}`,
          debit: total,
          credit: 0,
          costCenter: center,
        },
        {
          id: `JL-${journalEntryId}-rev`,
          journalEntryId,
          accountCode: revenueGl,
          description: `Revenue — ${input.orderNumber}`,
          debit: 0,
          credit: Math.max(0, +(total - taxAmount).toFixed(2)),
          costCenter: center,
        },
      ]
      if (taxAmount > 0.005) {
        buildTaxCredits(input.taxLines, taxAmount).forEach((tl, idx) => {
          jeLines.push({
            id: `JL-${journalEntryId}-tax-${idx}`,
            journalEntryId,
            accountCode: tl.gl,
            description: `${tl.name} — ${input.orderNumber}`,
            debit: 0,
            credit: tl.amount,
            costCenter: center,
            taxCode: tl.taxCode,
          })
        })
      }

      if (!(await journalExists(input.tenantId, journalEntryId))) {
        await createJournalEntry(input.tenantId, {
          id: journalEntryId,
          entryNumber: `JE-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`,
          date: now,
          description: `Auto-posted: F&B sale ${input.orderNumber}`,
          reference: input.orderNumber,
          status: 'Posted',
          lines: jeLines,
          totalDebit: total,
          totalCredit: total,
          postedBy: 'system',
          postedAt: now,
          sourceModule: source,
          sourceTransactionId: input.orderId,
        })
      }

      await createInvoice(input.tenantId, {
        id: invoiceId,
        invoiceNumber: `INV-${sourceKey}-${Date.now().toString().slice(-6)}`,
        type: 'Sales',
        date: now,
        // Cash-at-sale F&B invoices settle immediately — due date matches the sale date.
        dueDate: now,
        businessPartnerId: `GUEST-FB-${input.orderId}`,
        reference: input.orderNumber,
        description: `${source} sale — Table ${input.tableNumber || 'N/A'} — ${input.orderNumber}`,
        subtotal,
        taxAmount,
        total,
        currency: 'GHS',
        status: 'Paid',
        paidAmount: total,
        paidDate: now,
        journalEntryId,
        sourceModule: source,
        customerName: input.customerName,
        staffId: input.staffId || undefined,
        staffName: input.staffName || undefined,
        lines,
      } as any)
    }
    result.invoiceId = invoiceId

    if (!(await paymentExists(input.tenantId, receiptId))) {
      const amount = +Number(input.total).toFixed(2)
      const cashGl = PAYMENT_GL_MAP[input.paymentMethod] || GL_ACCOUNTS.CASH
      if (!(await journalExists(input.tenantId, payJeId))) {
        await createJournalEntry(input.tenantId, {
          id: payJeId,
          entryNumber: `JE-PAY-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`,
          date: now,
          description: `Auto-posted: Payment ${input.paymentMethod} — ${input.orderNumber}`,
          reference: input.orderNumber,
          status: 'Posted',
          lines: [
            {
              id: `JL-${payJeId}-cash`,
              journalEntryId: payJeId,
              accountCode: cashGl,
              description: `${input.paymentMethod} — ${input.orderNumber}`,
              debit: amount,
              credit: 0,
              currency: 'GHS',
              costCenter: center,
            },
            {
              id: `JL-${payJeId}-ar`,
              journalEntryId: payJeId,
              accountCode: GL_ACCOUNTS.ACCOUNTS_RECEIVABLE,
              description: `Clear AR — ${input.orderNumber}`,
              debit: 0,
              credit: amount,
              currency: 'GHS',
              costCenter: center,
            },
          ],
          totalDebit: amount,
          totalCredit: amount,
          postedBy: 'system',
          postedAt: now,
          sourceModule: source,
          sourceTransactionId: `pay:${input.orderId}`,
        })
      }

      await createPayment(input.tenantId, {
        id: receiptId,
        paymentNumber: `RCP-${sourceKey}-${Date.now().toString().slice(-6)}`,
        date: now,
        type: 'Receipt',
        businessPartnerId: `GUEST-FB-${input.orderId}`,
        invoiceId,
        reference: input.orderNumber,
        description: `Payment for ${source} order ${input.orderNumber}`,
        amount,
        currency: 'GHS',
        paymentMethod: input.paymentMethod,
        status: 'Posted',
        journalEntryId: payJeId,
        sourceModule: source,
        customerName: input.customerName,
        staffId: input.staffId || undefined,
        staffName: input.staffName || undefined,
        cashierUserId: input.cashierUserId || undefined,
        cashierName: input.cashierName || undefined,
      } as any)
    }
    result.receiptId = receiptId
  }

  const cogsAmount = +Number(input.cogsAmount || 0).toFixed(2)
  if (cogsAmount > 0) {
    const cogsId = `JE-COGS-${sourceKey}-${input.orderId}`
    if (!(await journalExists(input.tenantId, cogsId))) {
      await createJournalEntry(input.tenantId, {
        id: cogsId,
        entryNumber: `JE-COGS-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`,
        date: now,
        description: `Auto-posted: F&B COGS — ${input.orderNumber}`,
        reference: input.orderNumber,
        status: 'Posted',
        lines: [
          {
            id: `JL-${cogsId}-1`,
            journalEntryId: cogsId,
            accountCode: GL_ACCOUNTS.FB_COGS,
            description: `COGS — ${input.orderNumber}`,
            debit: cogsAmount,
            credit: 0,
            currency: 'GHS',
            costCenter: center,
          },
          {
            id: `JL-${cogsId}-2`,
            journalEntryId: cogsId,
            accountCode: GL_ACCOUNTS.FB_INVENTORY,
            description: `Inventory issue — ${input.orderNumber}`,
            debit: 0,
            credit: cogsAmount,
            currency: 'GHS',
            costCenter: center,
          },
        ],
        totalDebit: cogsAmount,
        totalCredit: cogsAmount,
        postedBy: 'system',
        postedAt: now,
        sourceModule: source,
        sourceTransactionId: `cogs:${input.orderId}`,
      })
    }
    result.cogsJournalId = cogsId
  }

  return result
}

async function reverseJournalIfNeeded(tenantId: string, originalId: string, reason: string) {
  const original = await prisma.journalEntry.findFirst({
    where: { id: originalId, tenantId },
    include: { lines: true },
  })
  if (!original || original.status === 'Void') return
  const revId = `JE-REV-${originalId}`
  if (await journalExists(tenantId, revId)) return
  const now = new Date().toISOString()
  const lines = (original.lines || []).map((l, idx) => ({
    id: `JL-${revId}-${idx}`,
    journalEntryId: revId,
    accountCode: l.accountCode,
    description: `Reversal — ${l.description || originalId}`,
    debit: Number(l.credit || 0),
    credit: Number(l.debit || 0),
    currency: l.currency || 'GHS',
    costCenter: l.costCenter || undefined,
    taxCode: l.taxCode || undefined,
  }))
  const total = lines.reduce((s, l) => s + l.debit, 0)
  await createJournalEntry(tenantId, {
    id: revId,
    entryNumber: `JE-REV-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`,
    date: now,
    description: `Reversal: ${reason}`,
    reference: original.reference || originalId,
    status: 'Posted',
    lines,
    totalDebit: total,
    totalCredit: total,
    postedBy: 'system',
    postedAt: now,
    sourceModule: original.sourceModule || undefined,
    sourceTransactionId: `rev:${originalId}`,
  })
}

export async function refundFbSaleServer(params: {
  tenantId: string
  orderId: string
  venue: string
  orderNumber: string
  reason?: string
}): Promise<{ ok: boolean; error?: string }> {
  const source = mapVenueToSource(params.venue)
  const sourceKey = source.toUpperCase()
  const reason = params.reason || `F&B refund ${params.orderNumber}`
  const invoiceId = `INV-${sourceKey}-${params.orderId}`
  const saleJeId = `JE-${sourceKey}-${params.orderId}`
  const receiptId = `RCP-${sourceKey}-PAY-${params.orderId}`
  const payJeId = `JE-PAY-${sourceKey}-PAY-${params.orderId}`
  const cogsId = `JE-COGS-${sourceKey}-${params.orderId}`

  try {
    await reverseJournalIfNeeded(params.tenantId, payJeId, reason)
    await reverseJournalIfNeeded(params.tenantId, saleJeId, reason)
    await reverseJournalIfNeeded(params.tenantId, cogsId, reason)

    if (await paymentExists(params.tenantId, receiptId)) {
      await updatePayment(params.tenantId, receiptId, { status: 'Void' } as any)
    }
    if (await invoiceExists(params.tenantId, invoiceId)) {
      await updateInvoice(params.tenantId, invoiceId, { status: 'Void' } as any)
    }

    // Also void any receipts keyed by order number reference
    const extras = await prisma.accountingPayment.findMany({
      where: {
        tenantId: params.tenantId,
        type: 'Receipt',
        status: { not: 'Void' },
        OR: [{ id: receiptId }, { reference: params.orderNumber }],
      },
    })
    for (const p of extras) {
      if (p.journalEntryId) await reverseJournalIfNeeded(params.tenantId, p.journalEntryId, reason)
      await updatePayment(params.tenantId, p.id, { status: 'Void' } as any)
    }

    return { ok: true }
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Refund GL failed' }
  }
}

/** Mark restaurant table occupied/available from order lifecycle. */
export async function syncRestaurantTableStatus(params: {
  tenantId: string
  tableNumber?: string | null
  status: 'available' | 'occupied' | 'cleaning'
}): Promise<void> {
  const number = String(params.tableNumber || '').trim()
  if (!number) return
  const table = await prisma.restaurantTable.findFirst({
    where: { tenantId: params.tenantId, number },
  })
  if (!table) return
  if (table.status === params.status) return
  await prisma.restaurantTable.update({
    where: { id: table.id },
    data: { status: params.status },
  })
}
