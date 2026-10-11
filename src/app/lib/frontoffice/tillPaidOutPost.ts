import { allocateJournalEntryNumber, createJournalEntry, listBankAccounts, upsertBankAccountRow, upsertBankTransactionRow } from '../accounting/repository'

const CASH_GL = '1110'
const MOMO_GL = '1120'

function round2(n: number) {
  return Math.round(n * 100) / 100
}

async function cashRegister(tenantId: string) {
  const accounts = await listBankAccounts(tenantId)
  const existing = accounts.find((account) => account.glAccountCode === CASH_GL && account.isActive !== false)
  if (existing) return existing
  return upsertBankAccountRow(tenantId, {
    id: `cash-1110-${tenantId}`,
    accountNumber: 'CASH-1110',
    accountName: 'Cash in hand',
    bankName: 'Front office cash',
    currency: 'GHS',
    glAccountCode: CASH_GL,
    openingBalanceType: 'period',
    openingBalance: 0,
    currentBalance: 0,
    isActive: true,
  })
}

async function writeCashbookLine(
  tenantId: string,
  direction: 'out' | 'in',
  amount: number,
  journalEntryId: string,
  date: string,
  reference: string,
  description: string,
) {
  const account = await cashRegister(tenantId)
  const signed = direction === 'out' ? -amount : amount
  const balance = round2(Number(account.currentBalance || 0) + signed)
  await upsertBankAccountRow(tenantId, {
    id: account.id,
    accountNumber: account.accountNumber,
    accountName: account.accountName,
    bankName: account.bankName,
    branch: account.branch,
    swiftCode: account.swiftCode,
    iban: account.iban,
    currency: account.currency || 'GHS',
    glAccountCode: account.glAccountCode || CASH_GL,
    openingBalanceType: account.openingBalanceType,
    openingBalance: account.openingBalance || 0,
    currentBalance: balance,
    isActive: account.isActive !== false,
  })
  await upsertBankTransactionRow(tenantId, {
    id: `BT-${journalEntryId}`,
    bankAccountId: account.id,
    transactionDate: date,
    reference,
    description,
    amount,
    type: direction === 'out' ? 'Withdrawal' : 'Deposit',
    currency: 'GHS',
    balance,
    status: 'Cleared',
    journalEntryId,
    createdAt: new Date().toISOString(),
  })
}

/** Debit the expense, credit cash in hand, and show the withdrawal on the cash register. */
export async function postTillPaidOut(input: {
  tenantId: string
  paidOutId: string
  amount: number
  expenseCode: string
  expenseName: string
  description: string
  businessDate: string
  postedBy: string
  paidFrom?: 'cash' | 'momo'
}): Promise<{ id: string; entryNumber: string }> {
  const amount = round2(input.amount)
  const paidFrom = input.paidFrom === 'momo' ? 'momo' : 'cash'
  const creditGl = paidFrom === 'momo' ? MOMO_GL : CASH_GL
  const reference = await allocateJournalEntryNumber(input.tenantId)
  const when = `${input.businessDate}T12:00:00`
  const text = `${input.expenseName}: ${input.description}`
  const entry = await createJournalEntry(input.tenantId, {
    entryNumber: reference,
    date: when,
    reference,
    description: `Petty paid-out — ${text}`,
    totalDebit: amount,
    totalCredit: amount,
    currency: 'GHS',
    status: 'Posted',
    postedBy: input.postedBy,
    postedAt: new Date().toISOString(),
    sourceModule: 'till_paid_out',
    sourceTransactionId: input.paidOutId,
    lines: [
      { id: `${reference}-1`, journalEntryId: reference, accountCode: input.expenseCode, description: text, debit: amount, credit: 0, currency: 'GHS' },
      { id: `${reference}-2`, journalEntryId: reference, accountCode: creditGl, description: paidFrom === 'momo' ? `MoMo — ${input.description}` : `Cash in hand — ${input.description}`, debit: 0, credit: amount, currency: 'GHS' },
    ],
  })
  if (paidFrom === 'cash') {
    try {
      await writeCashbookLine(input.tenantId, 'out', amount, entry.id, input.businessDate, reference, text)
    } catch (error) {
      console.error('[till paid-out] cashbook line failed', error)
    }
  }
  return { id: entry.id, entryNumber: reference }
}

/** Put the cash back: debit cash in hand, credit the same expense. */
export async function reverseTillPaidOut(input: {
  tenantId: string
  paidOutId: string
  amount: number
  expenseCode: string
  expenseName: string
  description: string
  businessDate: string
  postedBy: string
  paidFrom?: 'cash' | 'momo'
}): Promise<{ id: string; entryNumber: string }> {
  const amount = round2(input.amount)
  const paidFrom = input.paidFrom === 'momo' ? 'momo' : 'cash'
  const debitGl = paidFrom === 'momo' ? MOMO_GL : CASH_GL
  const reference = await allocateJournalEntryNumber(input.tenantId)
  const when = `${input.businessDate}T12:00:00`
  const text = `Void petty paid-out — ${input.expenseName}: ${input.description}`
  const entry = await createJournalEntry(input.tenantId, {
    entryNumber: reference,
    date: when,
    reference,
    description: text,
    totalDebit: amount,
    totalCredit: amount,
    currency: 'GHS',
    status: 'Posted',
    postedBy: input.postedBy,
    postedAt: new Date().toISOString(),
    sourceModule: 'till_paid_out_void',
    sourceTransactionId: input.paidOutId,
    lines: [
      { id: `${reference}-1`, journalEntryId: reference, accountCode: debitGl, description: text, debit: amount, credit: 0, currency: 'GHS' },
      { id: `${reference}-2`, journalEntryId: reference, accountCode: input.expenseCode, description: text, debit: 0, credit: amount, currency: 'GHS' },
    ],
  })
  if (paidFrom === 'cash') {
    try {
      await writeCashbookLine(input.tenantId, 'in', amount, entry.id, input.businessDate, reference, text)
    } catch (error) {
      console.error('[till paid-out] void cashbook line failed', error)
    }
  }
  return { id: entry.id, entryNumber: reference }
}
