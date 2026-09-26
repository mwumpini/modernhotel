/**
 * Repair Accounting cashbook and sales journals that credited purchase withholding (2170).
 * Run: node --env-file=.env.local --import tsx scripts/repair-accounting-cashbook-tax.ts
 */
import { PrismaClient } from '@prisma/client';

const CASH_REGISTER_ID = 'reg-cash-1110';
const BANK_REGISTER_ID = 'reg-bank-1120';
const SALES_TAX = ['2110', '2120', '2130', '2150', '2170'];

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function registerFor(gl: string): { id: string; gl: string; name: string; bank: string; number: string } | null {
  if (gl === '1110') return { id: CASH_REGISTER_ID, gl, name: 'Cash in hand', bank: 'Front office cash', number: 'CASH-1110' };
  if (gl === '1120') return { id: BANK_REGISTER_ID, gl, name: 'Operating bank', bank: 'Operating account', number: 'BANK-1120' };
  return null;
}

async function main() {
  const prisma = new PrismaClient();
  const tenant = await prisma.tenant.findFirst({ where: { subdomain: 'demo' } });
  if (!tenant) throw new Error('demo tenant missing');
  const tenantId = tenant.id;
  const now = new Date();

  const cashLines = await prisma.journalEntryLine.findMany({
    where: { tenantId, accountCode: { in: ['1110', '1120'] }, journalEntry: { status: 'Posted' } },
    include: { journalEntry: true },
    orderBy: { journalEntry: { date: 'asc' } },
  });

  const balances = new Map<string, number>();
  let mirrored = 0;
  for (const line of cashLines) {
    const reg = registerFor(line.accountCode);
    if (!reg) continue;
    const debit = line.debit || 0;
    const credit = line.credit || 0;
    if (debit < 0.005 && credit < 0.005) continue;
    const txnId = `BT-${line.id}`;
    const existing = await prisma.bankTransaction.findFirst({ where: { id: txnId } });
    if (!balances.has(reg.id)) balances.set(reg.id, 0);
    const signed = debit >= credit ? debit : -credit;
    const next = round2((balances.get(reg.id) || 0) + signed);
    balances.set(reg.id, next);
    if (existing) continue;
    await prisma.bankTransaction.create({
      data: {
        id: txnId,
        tenantId,
        bankAccountId: reg.id,
        transactionDate: line.journalEntry.date,
        reference: line.journalEntry.reference || line.journalEntry.entryNumber,
        description: line.description || line.journalEntry.description || 'Cashbook',
        amount: round2(Math.max(debit, credit)),
        type: debit >= credit ? 'Deposit' : 'Withdrawal',
        currency: 'GHS',
        balance: next,
        status: 'Cleared',
        journalEntryId: line.journalEntryId,
        createdAt: now,
      },
    });
    mirrored++;
  }

  for (const [id, balance] of balances) {
    const reg = id === CASH_REGISTER_ID
      ? registerFor('1110')!
      : registerFor('1120')!;
    await prisma.bankAccount.upsert({
      where: { id },
      create: {
        id,
        tenantId,
        accountNumber: reg.number,
        accountName: reg.name,
        bankName: reg.bank,
        currency: 'GHS',
        glAccountCode: reg.gl,
        openingBalanceType: 'period',
        openingBalance: 0,
        currentBalance: balance,
        isActive: true,
      },
      update: { currentBalance: balance, isActive: true },
    });
  }
  console.log(`cashbook lines mirrored: ${mirrored}; registers: ${[...balances.entries()].map(([k, v]) => `${k}=${v}`).join(', ') || 'none'}`);

  const invoices = await prisma.accountingInvoice.findMany({
    where: { tenantId, type: 'Sales' },
  });
  const partners = await prisma.businessPartner.findMany({ where: { tenantId } });
  const partnerIds = new Set(partners.map((p) => p.id));
  let customers = 0;
  for (const inv of invoices) {
    const pid = inv.businessPartnerId;
    if (!pid || partnerIds.has(pid)) continue;
    const guest = await prisma.guest.findFirst({ where: { tenantId, id: pid } });
    const fromDesc = (inv.description || '').replace(/^Guest stay folio for /i, '').trim();
    const name = guest?.name || fromDesc || 'Guest';
    await prisma.businessPartner.create({
      data: {
        id: pid,
        tenantId,
        code: (guest?.serialNumber || pid).slice(0, 20),
        name,
        type: 'Customer',
        glAccountCode: '1210',
        currency: 'GHS',
        balance: 0,
        isActive: true,
        countryCode: 'GH',
        email: guest?.email || undefined,
        phone: guest?.phone || undefined,
      },
    });
    partnerIds.add(pid);
    customers++;
    console.log(`customer ${name} (${pid})`);
  }
  console.log(`customers added: ${customers}`);

  const whtLines = await prisma.journalEntryLine.findMany({
    where: { tenantId, accountCode: '2170', credit: { gt: 0 }, journalEntry: { status: 'Posted' } },
    include: { journalEntry: { include: { lines: true } } },
  });
  let reclassed = 0;
  for (const wht of whtLines) {
    const je = wht.journalEntry;
    const isSale = je.lines.some((l) => l.accountCode === '1210' && (l.debit || 0) > 0);
    if (!isSale) continue;
    const marker = `tax-reclass-${je.id}`;
    const already = await prisma.journalEntry.findFirst({
      where: { tenantId, sourceModule: 'tax_reclass_2170', sourceTransactionId: je.id },
    });
    if (already) continue;

    const creditOf = (code: string) =>
      round2(je.lines.filter((l) => l.accountCode === code).reduce((s, l) => s + (l.credit || 0) - (l.debit || 0), 0));
    const taxTotal = round2(SALES_TAX.reduce((s, code) => s + creditOf(code), 0));
    if (taxTotal <= 0) continue;
    const nhil = round2(taxTotal * 2.5 / 21);
    const getfund = round2(taxTotal * 2.5 / 21);
    const tourism = round2(taxTotal * 1 / 21);
    const vat = round2(taxTotal - nhil - getfund - tourism);
    const target: Record<string, number> = { '2120': nhil, '2130': getfund, '2150': tourism, '2110': vat, '2170': 0 };
    const deltas = SALES_TAX.map((code) => ({ code, delta: round2((target[code] || 0) - creditOf(code)) })).filter((d) => Math.abs(d.delta) >= 0.005);
    const sum = round2(deltas.reduce((s, d) => s + d.delta, 0));
    if (Math.abs(sum) > 0.02) {
      console.log('skip unbalanced', je.entryNumber, sum);
      continue;
    }

    const entryId = marker;
    await prisma.journalEntry.create({
      data: {
        id: entryId,
        tenantId,
        entryNumber: `JE-RECLASS-${je.entryNumber.replace(/\D/g, '').slice(-6) || reclassed}`,
        date: je.date,
        reference: je.reference,
        description: `Reclass purchase withholding off sale ${je.entryNumber}`,
        totalDebit: round2(deltas.filter((d) => d.delta < 0).reduce((s, d) => s + Math.abs(d.delta), 0)),
        totalCredit: round2(deltas.filter((d) => d.delta > 0).reduce((s, d) => s + d.delta, 0)),
        currency: 'GHS',
        status: 'Posted',
        postedBy: 'system',
        postedAt: now,
        sourceModule: 'tax_reclass_2170',
        sourceTransactionId: je.id,
        lines: {
          create: deltas.map((d, i) => ({
            id: `${entryId}-${i}`,
            tenantId,
            accountCode: d.code,
            description: `Tax reclass — ${je.reference || je.entryNumber}`,
            debit: d.delta < 0 ? Math.abs(d.delta) : 0,
            credit: d.delta > 0 ? d.delta : 0,
            currency: 'GHS',
          })),
        },
      },
    });
    reclassed++;
    console.log(`reclass ${je.entryNumber} 2170 ${creditOf('2170')} → VAT/levies`);
  }
  console.log(`reclass journals: ${reclassed}`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
