import { SampleCtx, prisma, round2 } from './common'

/**
 * Double-entry postings for sample records, shaped like the ones the app posts itself (checkout, POS,
 * payroll, supplier bills…) so the ledger, trial balance, P&L and cash book all move with the sample
 * activity. Every entry id starts with the sample prefix, so removal finds exactly these.
 */

// Ghana's sales-tax stack as the app applies it: levies on the net amount, VAT on net + levies.
const LEVIES: Array<[string, string, number]> = [
  ['2120', 'National Health Insurance Levy', 0.025],
  ['2130', 'GETFund Levy', 0.025],
  ['2150', 'Tourism Development Levy', 0.01],
]
const VAT_RATE = 0.15

export type TaxLine = { accountCode: string; name: string; amount: number }

/** The tax lines on a tax-exclusive amount (≈ 21.9% in total). */
export function salesTax(net: number): { lines: TaxLine[]; total: number } {
  const levyLines = LEVIES.map(([accountCode, name, rate]) => ({ accountCode, name, amount: round2(net * rate) }))
  const levyTotal = levyLines.reduce((s, l) => s + l.amount, 0)
  const vat = { accountCode: '2110', name: 'Value Added Tax', amount: round2((net + levyTotal) * VAT_RATE) }
  const lines = [...levyLines, vat]
  return { lines, total: round2(lines.reduce((s, l) => s + l.amount, 0)) }
}

/** The POS's per-tax breakdown shape (FBOrder.taxLines). */
export function posTaxLines(net: number) {
  const codes: Record<string, [string, string, number]> = {
    '2120': ['NHIL', 'NHIL', 2.5], '2130': ['GETFUND', 'GETFund', 2.5], '2150': ['TOURISM', 'Tourism', 1], '2110': ['VAT', 'VAT', 15],
  }
  return salesTax(net).lines.map((l) => {
    const [taxCode, type, rate] = codes[l.accountCode]
    return { taxCode, name: l.name, type, rate, amount: l.amount, glAccountCode: l.accountCode }
  })
}

export type Line = { account: string; description: string; debit?: number; credit?: number; costCenter?: string }

export type Entry = {
  id: string
  entryNumber: string
  date: Date
  reference: string
  description: string
  sourceModule: string
  sourceTransactionId?: string
  status?: 'Posted' | 'Draft'
  lines: Line[]
}

/** Payment method → the GL cash account it lands in. */
export const cashAccountFor = (method: string) => (/cash/i.test(method) ? '1110' : '1120')

const REGISTER: Record<string, { id: string; accountNumber: string; accountName: string; bankName: string }> = {
  '1110': { id: 'reg-cash-1110', accountNumber: 'CASH-1110', accountName: 'Cash in hand', bankName: 'Front office cash' },
  '1120': { id: 'reg-bank-1120', accountNumber: 'BANK-1120', accountName: 'Operating bank', bankName: 'Operating account' },
}

/**
 * Writes the entries that don't exist yet (never rewrites one a tester has since touched), and mirrors
 * every cash / bank line into the cash book the same way the app does when it posts.
 * Returns the entries it skipped because they were unbalanced — a guard against a bad sample definition.
 */
export async function postEntries(ctx: SampleCtx, entries: Entry[]): Promise<string[]> {
  const skipped: string[] = []
  for (const e of entries) {
    const debit = round2(e.lines.reduce((s, l) => s + (l.debit || 0), 0))
    const credit = round2(e.lines.reduce((s, l) => s + (l.credit || 0), 0))
    if (Math.abs(debit - credit) > 0.01) { skipped.push(`${e.entryNumber} (${debit} ≠ ${credit})`); continue }
    if (await prisma.journalEntry.findUnique({ where: { id: e.id }, select: { id: true } })) continue

    const status = e.status || 'Posted'
    await prisma.journalEntry.create({
      data: {
        id: e.id, tenantId: ctx.tenantId, entryNumber: e.entryNumber, date: e.date, reference: e.reference, description: e.description,
        totalDebit: debit, totalCredit: credit, currency: 'GHS', status, sourceModule: e.sourceModule, sourceTransactionId: e.sourceTransactionId,
        postedBy: status === 'Posted' ? 'Sample data' : undefined, postedAt: status === 'Posted' ? e.date : undefined,
        lines: {
          create: e.lines.map((l, n) => ({
            id: `${e.id}-L${n + 1}`, tenantId: ctx.tenantId, accountCode: l.account, description: l.description,
            debit: round2(l.debit || 0), credit: round2(l.credit || 0), currency: 'GHS', costCenter: l.costCenter, reference: e.reference,
          })),
        },
      } as any,
    })
    if (status === 'Posted') await mirrorCash(ctx, e)
  }
  return skipped
}

async function mirrorCash(ctx: SampleCtx, e: Entry) {
  for (const code of ['1110', '1120']) {
    const net = round2(e.lines.filter((l) => l.account === code).reduce((s, l) => s + (l.debit || 0) - (l.credit || 0), 0))
    if (Math.abs(net) < 0.005) continue
    const bank = await ensureRegister(ctx, code)
    const balance = round2((bank.currentBalance || 0) + net)
    await prisma.bankAccount.update({ where: { id: bank.id }, data: { currentBalance: balance } })
    await prisma.bankTransaction.create({
      data: {
        // The app keys a mirrored line as BT-<entry id>; an entry that touches both cash and bank (a cash deposit) gets one per register.
        id: code === '1110' ? `BT-${e.id}` : `BT-${e.id}-bank`, tenantId: ctx.tenantId, bankAccountId: bank.id, transactionDate: e.date,
        reference: e.reference, description: e.description, amount: Math.abs(net), type: net > 0 ? 'Deposit' : 'Withdrawal', currency: 'GHS',
        balance, status: 'Cleared', journalEntryId: e.id,
      },
    })
  }
}

/** The hotel's cash or bank register (the same fixed ids the app uses), created when it doesn't exist yet. */
async function ensureRegister(ctx: SampleCtx, code: string) {
  const reg = REGISTER[code]
  const existing = await prisma.bankAccount.findFirst({ where: { tenantId: ctx.tenantId, OR: [{ id: reg.id }, { glAccountCode: code }] }, orderBy: { createdAt: 'asc' } })
  if (existing) return existing
  return prisma.bankAccount.create({
    data: { id: reg.id, tenantId: ctx.tenantId, accountNumber: reg.accountNumber, accountName: reg.accountName, bankName: reg.bankName, currency: 'GHS', glAccountCode: code, openingBalanceType: 'period', openingBalance: 0, currentBalance: 0, isActive: true },
  })
}

/** Removes every sample entry, its cash-book lines, and takes their amounts back off the registers. */
export async function removeEntries(ctx: SampleCtx) {
  const t = ctx.tenantId
  const txs = await prisma.bankTransaction.findMany({ where: { tenantId: t, journalEntryId: { startsWith: ctx.p } } })
  const byAccount = new Map<string, number>()
  for (const tx of txs) byAccount.set(tx.bankAccountId, (byAccount.get(tx.bankAccountId) || 0) + (tx.type === 'Deposit' ? tx.amount : -tx.amount))
  for (const [id, net] of Array.from(byAccount)) {
    const bank = await prisma.bankAccount.findFirst({ where: { id, tenantId: t } })
    if (bank) await prisma.bankAccount.update({ where: { id }, data: { currentBalance: round2((bank.currentBalance || 0) - net) } })
  }
  await prisma.bankTransaction.deleteMany({ where: { tenantId: t, journalEntryId: { startsWith: ctx.p } } })
  await prisma.journalEntry.deleteMany({ where: { tenantId: t, id: { startsWith: ctx.p } } })
}

/** True when the hotel has a chart of accounts — postings are skipped otherwise. */
export async function hasChartOfAccounts(ctx: SampleCtx): Promise<boolean> {
  return (await prisma.account.count({ where: { tenantId: ctx.tenantId } })) > 0
}
