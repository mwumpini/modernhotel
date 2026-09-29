import { SampleCtx, prisma, seedRows, bySampleId, dayOffset, atTime, round2 } from './common'
import { Entry, postEntries, removeEntries, salesTax, cashAccountFor, hasChartOfAccounts } from './ledger'

/**
 * Sample books: who the hotel buys from and bills, the checked-out sample stays posted to the ledger,
 * supplier bills (paid, open and overdue), a corporate account with invoices in every aging bucket,
 * day-to-day expenses, a bank deposit, and a few fixed assets. Everything balances and shows up in the
 * trial balance, P&L, balance sheet, AR/AP aging and the cash book.
 */

const CORPORATE = { key: 'mining', code: 'SMP-CUST-01', name: 'Sample Mining Ltd', contact: 'Adwoa Frimpong', phone: '+233 30 277 0001', email: 'accounts@samplemining.sample.hotel', terms: 30, limit: 50000 }

// key, name, contact, phone, terms (days)
const SUPPLIERS: Array<[string, string, string, string, number]> = [
  ['fresh', 'Accra Fresh Foods Ltd', 'Yaa Asantewaa', '+233 30 200 1001', 30],
  ['clean', 'Tema Cleaning Supplies', 'Selorm Agbenu', '+233 30 200 1004', 14],
  ['ecg', 'Electricity Company of Ghana (sample)', 'Customer Service', '+233 30 261 1611', 14],
]

// key, number, days ago issued, days until due (negative = overdue), description, net, amount already paid
const CORPORATE_INVOICES: Array<[string, string, number, number, string, number, number]> = [
  ['c1', 'SMP-AR-001', 75, -45, 'Room block — site engineers (6 rooms × 5 nights)', 10500, 0],
  ['c2', 'SMP-AR-002', 40, -10, 'Boardroom hire and lunch — quarterly review', 3200, 1500],
  ['c3', 'SMP-AR-003', 12, 18, 'Room block — audit team (3 rooms × 4 nights)', 4200, 0],
]

// key, number, supplier, days ago, days until due, description, GL, amount, paid by (bank / cash) or null if still open
const SUPPLIER_BILLS: Array<[string, string, string, number, number, string, string, number, string | null]> = [
  ['b1', 'SMP-AP-001', 'fresh', 7, 23, 'Produce delivery against SMP-PO-001', '1310', 4820, null],
  ['b2', 'SMP-AP-002', 'clean', 19, -5, 'Detergent, toilet rolls and cleaning chemicals', '1320', 1180, null],
  ['b3', 'SMP-AP-003', 'ecg', 25, -11, 'Electricity — last month', '5310', 3450, 'Bank Transfer'],
]

// key, days ago, description, expense GL, amount, paid from (1110 cash / 1120 bank)
const EXPENSES: Array<[string, number, string, string, number, string]> = [
  ['diesel', 3, 'Generator diesel — 120 litres', '5315', 1850, '1110'],
  ['print', 6, 'Printing — registration cards and receipts', '5645', 240, '1110'],
  ['repair', 9, 'Plumber — bathroom tap repair, room 102', '5415', 380, '1110'],
  ['ads', 14, 'Facebook & Instagram advertising', '5510', 600, '1120'],
  ['bankfee', 1, 'Monthly bank charges', '5680', 35, '1120'],
]

// key, code, name, category (matched by name prefix), days ago bought, qty, unit price
const ASSETS: Array<[string, string, string, string, number, number, number]> = [
  ['oven', 'SMP-KE-01', 'Commercial gas oven (6-burner)', 'Kitchen', 120, 1, 18500],
  ['beds', 'SMP-FFE-01', 'Guest room beds and mattresses', 'Furniture', 200, 9, 4200],
  ['laptop', 'SMP-CE-01', 'Front desk laptop', 'Computer', 60, 1, 7800],
]

const SAMPLE_CATEGORIES = [
  { key: 'kitchen', name: 'Kitchen Equipment & Utensils', codePrefix: 'KE', graClass: 'Class 3', graRate: 0.2, graMethod: 'RB', iasMethod: 'SL', iasRate: 0.2, usefulLifeYrs: 8, residualPct: 0.05, presentationGroup: 'Kitchen Equipment & Utensils' },
  { key: 'ffe', name: 'Furniture, Fixtures & Equipment', codePrefix: 'FFE', graClass: 'Class 3', graRate: 0.2, graMethod: 'RB', iasMethod: 'SL', iasRate: 0.2, usefulLifeYrs: 7, residualPct: 0.05, presentationGroup: 'Furniture & Fixtures' },
  { key: 'computer', name: 'Computer & Accessories', codePrefix: 'CE', graClass: 'Class 1', graRate: 0.4, graMethod: 'RB', iasMethod: 'RB', iasRate: 0.4, usefulLifeYrs: 4, residualPct: 0, presentationGroup: 'Computer & Accessories' },
]

export async function loadAccounting(ctx: SampleCtx): Promise<string[]> {
  const { p, tenantId } = ctx
  if (!(await hasChartOfAccounts(ctx))) return ['Accounting sample data was skipped: this hotel has no chart of accounts yet — open Accounting once (or finish setup) first.']
  const notes: string[] = []
  const entries: Entry[] = []

  // ---- business partners ----
  const sampleGuests = await prisma.guest.findMany({ where: bySampleId(ctx), select: { id: true, name: true, email: true, phone: true } })
  await seedRows(prisma.businessPartner, [
    { id: `${p}bp_${CORPORATE.key}`, tenantId, code: CORPORATE.code, name: CORPORATE.name, type: 'Customer', contactPerson: CORPORATE.contact, phone: CORPORATE.phone, email: CORPORATE.email, creditLimit: CORPORATE.limit, paymentTerms: CORPORATE.terms, glAccountCode: '1210', taxNumber: 'C0001234567' },
    ...SUPPLIERS.map(([key, name, contact, phone, terms], i) => ({ id: `${p}bp_${key}`, tenantId, code: `SMP-SUP-${String(i + 1).padStart(2, '0')}`, name, type: 'Supplier', contactPerson: contact, phone, paymentTerms: terms, glAccountCode: '2205' })),
    ...sampleGuests.map((g, i) => ({ id: `${p}bp_${g.id.slice(p.length)}`, tenantId, code: `SMP-G-${String(i + 1).padStart(2, '0')}`, name: g.name, type: 'Customer', email: g.email, phone: g.phone, glAccountCode: '1210' })),
  ])
  await seedRows(prisma.company, [{ id: `${p}co_${CORPORATE.key}`, tenantId, code: CORPORATE.code, name: CORPORATE.name, email: CORPORATE.email, phone: CORPORATE.phone, taxNumber: 'C0001234567', billingAddress: { street: '12 Independence Avenue', city: 'Accra', country: 'Ghana' } }])

  // ---- opening capital, so the cash book and bank start from a sensible balance ----
  entries.push({
    id: `${p}je_open`, entryNumber: 'SMP-JE-OPEN', date: dayOffset(ctx, -90), reference: 'SMP-OPENING', description: 'Sample opening balance — owner capital and a cash float', sourceModule: 'manual',
    lines: [
      { account: '1120', description: 'Opening bank balance (sample)', debit: 100000 },
      { account: '1110', description: 'Opening cash float (sample)', debit: 5000 },
      { account: '3100', description: 'Owner capital (sample)', credit: 105000 },
    ],
  })

  // ---- checked-out sample stays: folio posted at checkout, then settled ----
  const closed = await prisma.guestFolio.findMany({ where: { tenantId, status: 'closed', reservationId: { startsWith: p } } })
  const reservations = await prisma.reservation.findMany({ where: { id: { in: closed.map((f) => f.reservationId) } }, select: { id: true, resId: true, guestId: true, checkedOutAt: true, details: true } })
  const invoices: Array<Record<string, any>> = []
  const invoiceLines: Array<Record<string, any>> = []
  const payments: Array<Record<string, any>> = []
  for (const folio of closed) {
    const res = reservations.find((r) => r.id === folio.reservationId)
    if (!res) continue
    const key = res.id.slice(p.length)
    const guestName = (res.details as any)?.guestName || 'Guest'
    const when = res.checkedOutAt || dayOffset(ctx, -1)
    const charges = (folio.charges as any[]) || []
    const byGl = new Map<string, number>()
    for (const c of charges) {
      const gl = c.category === 'room' ? '4100' : c.category === 'f&b' ? '4210' : '4330'
      byGl.set(gl, round2((byGl.get(gl) || 0) + Number(c.amount)))
    }
    const net = round2(Array.from(byGl.values()).reduce((s, v) => s + v, 0))
    const tax = salesTax(net)
    const total = round2(folio.totalCharges)
    const rounding = round2(total - net - tax.total)
    const invId = `${p}inv_fo_${key}`
    const invNumber = `SMP-INV-FO-${key.toUpperCase()}`
    invoices.push({
      id: invId, tenantId, invoiceNumber: invNumber, type: 'Sales', date: when, dueDate: when, businessPartnerId: `${p}bp_${res.guestId.slice(p.length)}`, reference: res.resId,
      description: `Guest stay folio for ${guestName}`, subtotal: net, taxAmount: round2(total - net), total, status: 'Paid', paidAmount: total, paidDate: when,
      journalEntryId: `${p}je_fo_${key}`, sourceModule: 'front_office_checkout', details: { customerName: guestName },
    })
    charges.forEach((c, n) => invoiceLines.push({
      id: `${invId}_l${n + 1}`, tenantId, invoiceId: invId, description: c.description, quantity: 1, unitPrice: Number(c.amount), amount: Number(c.amount), taxAmount: Number(c.tax || 0),
      glAccountCode: c.category === 'room' ? '4100' : c.category === 'f&b' ? '4210' : '4330',
    }))
    entries.push({
      id: `${p}je_fo_${key}`, entryNumber: `SMP-JE-FO-${key.toUpperCase()}`, date: when, reference: res.resId || invNumber, description: `Guest folio posted — ${invNumber}`, sourceModule: 'front_office_checkout', sourceTransactionId: res.id,
      lines: [
        { account: '1210', description: `AR — Folio ${invNumber}`, debit: total, costCenter: 'RM' },
        ...Array.from(byGl).map(([gl, amount]) => ({ account: gl, description: `Revenue — ${guestName}`, credit: amount, costCenter: 'RM' })),
        ...tax.lines.map((l) => ({ account: l.accountCode, description: `${l.name} — ${invNumber}`, credit: l.amount, costCenter: 'RM' })),
        ...(Math.abs(rounding) >= 0.005 ? [{ account: '4900', description: `Rounding adjustment — ${invNumber}`, ...(rounding > 0 ? { credit: rounding } : { debit: -rounding }), costCenter: 'RM' }] : []),
      ],
    })
    for (const [n, pay] of ((folio.payments as any[]) || []).entries()) {
      const payId = `${p}rcp_fo_${key}_${n}`
      payments.push({
        id: payId, tenantId, paymentNumber: `SMP-RCP-FO-${key.toUpperCase()}-${n + 1}`, date: new Date(pay.date), type: 'Receipt', businessPartnerId: `${p}bp_${res.guestId.slice(p.length)}`, invoiceId: invId,
        reference: invNumber, description: `Guest payment — ${guestName}`, amount: Number(pay.amount), paymentMethod: pay.method, status: 'Posted', journalEntryId: `${p}je_fopay_${key}_${n}`,
      })
      entries.push({
        id: `${p}je_fopay_${key}_${n}`, entryNumber: `SMP-JE-FOPAY-${key.toUpperCase()}-${n + 1}`, date: new Date(pay.date), reference: invNumber, description: `Guest payment — ${guestName}`, sourceModule: 'front_office_checkout', sourceTransactionId: res.id,
        lines: [
          { account: cashAccountFor(pay.method), description: `Receipt — ${pay.method}`, debit: Number(pay.amount), costCenter: 'RM' },
          { account: '1210', description: `Clear AR — ${invNumber}`, credit: Number(pay.amount), costCenter: 'RM' },
        ],
      })
    }
  }

  // ---- corporate account: invoices across the aging buckets ----
  for (const [key, number, ago, due, description, net, paid] of CORPORATE_INVOICES) {
    const tax = salesTax(net)
    const total = round2(net + tax.total)
    const when = dayOffset(ctx, -ago)
    const gl = /boardroom/i.test(description) ? '4320' : '4100'
    invoices.push({
      id: `${p}inv_${key}`, tenantId, invoiceNumber: number, type: 'Sales', date: when, dueDate: dayOffset(ctx, due), businessPartnerId: `${p}bp_${CORPORATE.key}`, reference: number, description,
      subtotal: net, taxAmount: tax.total, total, status: 'Posted', paidAmount: paid, journalEntryId: `${p}je_${key}`, sourceModule: 'manual_ar_ap', details: { customerName: CORPORATE.name },
    })
    invoiceLines.push({ id: `${p}inv_${key}_l1`, tenantId, invoiceId: `${p}inv_${key}`, description, quantity: 1, unitPrice: net, amount: net, taxAmount: tax.total, glAccountCode: gl })
    entries.push({
      id: `${p}je_${key}`, entryNumber: `SMP-JE-${number}`, date: when, reference: number, description: `Sales invoice ${number} — ${CORPORATE.name}`, sourceModule: 'manual_ar_ap', sourceTransactionId: `${p}inv_${key}`,
      lines: [
        { account: '1210', description: `AR — ${number}`, debit: total },
        { account: gl, description, credit: net },
        ...tax.lines.map((l) => ({ account: l.accountCode, description: `${l.name} — ${number}`, credit: l.amount })),
      ],
    })
    if (paid > 0) {
      const payDate = dayOffset(ctx, -ago + 20)
      payments.push({ id: `${p}rcp_${key}`, tenantId, paymentNumber: `SMP-RCP-${number.slice(-3)}`, date: payDate, type: 'Receipt', businessPartnerId: `${p}bp_${CORPORATE.key}`, invoiceId: `${p}inv_${key}`, reference: number, description: `Part payment for ${number}`, amount: paid, paymentMethod: 'Bank Transfer', status: 'Posted', journalEntryId: `${p}je_rcp_${key}` })
      entries.push({
        id: `${p}je_rcp_${key}`, entryNumber: `SMP-JE-RCP-${number.slice(-3)}`, date: payDate, reference: number, description: `Receipt from ${CORPORATE.name} — ${number}`, sourceModule: 'manual_ar_ap',
        lines: [{ account: '1120', description: `Bank receipt — ${number}`, debit: paid }, { account: '1210', description: `Clear AR — ${number}`, credit: paid }],
      })
    }
  }

  // ---- supplier bills ----
  for (const [key, number, supplier, ago, due, description, gl, amount, paidBy] of SUPPLIER_BILLS) {
    const when = dayOffset(ctx, -ago)
    invoices.push({
      id: `${p}inv_${key}`, tenantId, invoiceNumber: number, type: 'Purchase', date: when, dueDate: dayOffset(ctx, due), businessPartnerId: `${p}bp_${supplier}`, description,
      subtotal: amount, taxAmount: 0, total: amount, status: paidBy ? 'Paid' : 'Posted', paidAmount: paidBy ? amount : 0, paidDate: paidBy ? dayOffset(ctx, -ago + 10) : null,
      journalEntryId: `${p}je_${key}`, details: { amountDue: paidBy ? 0 : amount, workflowStatus: 'Posted', attachments: [] },
    })
    invoiceLines.push({ id: `${p}inv_${key}_l1`, tenantId, invoiceId: `${p}inv_${key}`, description, quantity: 1, unitPrice: amount, amount, taxAmount: 0, glAccountCode: gl })
    entries.push({
      id: `${p}je_${key}`, entryNumber: `SMP-JE-${number}`, date: when, reference: number, description: `Supplier bill ${number} — ${description}`, sourceModule: 'manual_ar_ap', sourceTransactionId: `${p}inv_${key}`,
      lines: [{ account: gl, description, debit: amount }, { account: '2205', description: `AP — ${number}`, credit: amount }],
    })
    if (paidBy) {
      const payDate = dayOffset(ctx, -ago + 10)
      payments.push({ id: `${p}pay_${key}`, tenantId, paymentNumber: `SMP-PAY-${number.slice(-3)}`, date: payDate, type: 'Payment', businessPartnerId: `${p}bp_${supplier}`, invoiceId: `${p}inv_${key}`, description: `Payment for invoice ${number}`, amount, paymentMethod: paidBy, status: 'Posted', journalEntryId: `${p}je_pay_${key}` })
      entries.push({
        id: `${p}je_pay_${key}`, entryNumber: `SMP-JE-PAY-${number.slice(-3)}`, date: payDate, reference: number, description: `Supplier payment — ${number}`, sourceModule: 'manual_ar_ap',
        lines: [{ account: '2205', description: `Payment for ${number}`, debit: amount }, { account: '1120', description: `Payment for ${number}`, credit: amount }],
      })
    }
  }

  // ---- day-to-day expenses and a cash deposit ----
  for (const [key, ago, description, gl, amount, from] of EXPENSES) {
    entries.push({
      id: `${p}je_exp_${key}`, entryNumber: `SMP-JE-EXP-${key.toUpperCase()}`, date: atTime(ctx, -ago, 11), reference: `SMP-EXP-${key.toUpperCase()}`, description, sourceModule: from === '1110' ? 'petty_cash' : 'bank_manual_transaction',
      lines: [{ account: gl, description, debit: amount }, { account: from, description, credit: amount }],
    })
  }
  entries.push({
    id: `${p}je_deposit`, entryNumber: 'SMP-JE-DEP-001', date: atTime(ctx, -2, 10), reference: 'SMP-DEP-001', description: 'Cash takings banked', sourceModule: 'bank_manual_transaction',
    lines: [{ account: '1120', description: 'Deposit — cash takings', debit: 2000 }, { account: '1110', description: 'Cash taken to the bank', credit: 2000 }],
  })

  // ---- fixed assets ----
  const categories = await prisma.ppeCategory.findMany({ where: { tenantId } })
  const newCategories = SAMPLE_CATEGORIES.filter((c) => !categories.some((x) => x.name === c.name))
  await seedRows(prisma.ppeCategory, newCategories.map(({ key, ...c }) => ({ id: `${p}ppecat_${key}`, tenantId, ...c, organisationId: 'default-org' })))
  const allCategories = [...categories, ...(await prisma.ppeCategory.findMany({ where: bySampleId(ctx) }))]
  const assetRows: Array<Record<string, any>> = []
  for (const [key, code, name, category, ago, quantity, unitPrice] of ASSETS) {
    const cat = allCategories.find((c) => c.name.startsWith(category))
    if (!cat) continue
    const cost = round2(quantity * unitPrice)
    assetRows.push({ id: `${p}ppe_${key}`, tenantId, purchaseDate: dayOffset(ctx, -ago), assetCode: code, assetName: name, categoryId: cat.id, quantity, unitPrice, capExp: 'Capitalise', organisationId: 'default-org', capitalizationJournalEntryId: `${p}je_ppe_${key}` })
    entries.push({
      id: `${p}je_ppe_${key}`, entryNumber: `SMP-JE-PPE-${key.toUpperCase()}`, date: dayOffset(ctx, -ago), reference: code, description: `PPE capitalization — ${name}`, sourceModule: 'ppe_register_capitalize', sourceTransactionId: `${p}ppe_${key}`,
      lines: [{ account: '1510', description: 'Property & equipment', debit: cost }, { account: '1120', description: 'Settlement — bank', credit: cost }],
    })
  }
  await seedRows(prisma.ppeAsset, assetRows)

  await seedRows(prisma.accountingInvoice, invoices)
  await seedRows(prisma.accountingInvoiceLine, invoiceLines)
  await seedRows(prisma.accountingPayment, payments)
  const skipped = await postEntries(ctx, entries.sort((a, b) => a.date.getTime() - b.date.getTime()))
  if (skipped.length) notes.push(`Some accounting postings were skipped: ${skipped.join(', ')}`)
  return notes
}

export async function removeAccounting(ctx: SampleCtx) {
  const where = bySampleId(ctx)
  await prisma.accountingPayment.deleteMany({ where })
  await prisma.accountingInvoice.deleteMany({ where }) // lines go with their invoice
  await prisma.ppeAsset.deleteMany({ where })
  // A sample asset category stays if a tester filed a real asset under it.
  for (const cat of await prisma.ppeCategory.findMany({ where, select: { id: true } })) {
    if ((await prisma.ppeAsset.count({ where: { categoryId: cat.id } })) === 0) await prisma.ppeCategory.delete({ where: { id: cat.id } })
  }
  await prisma.company.deleteMany({ where })
  await prisma.businessPartner.deleteMany({ where })
  await removeEntries(ctx)
}

export async function countAccounting(ctx: SampleCtx) {
  return { journalEntries: await prisma.journalEntry.count({ where: bySampleId(ctx) }) }
}
