/**
 * Accounting certification: supplier bill paid from cash, June GRA remittance,
 * cashbook tied to GL, journals balanced, chart covers every posted code.
 * Run: node --env-file=.env.local --import tsx scripts/cert-accounting-pass.ts
 */
import { PrismaClient } from '@prisma/client';

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

const JUNE_REMIT = [
  { gl: '2130', amount: 6.25, label: 'GETFund' },
  { gl: '2120', amount: 6.25, label: 'NHIL' },
  { gl: '2150', amount: 2.5, label: 'Tourism' },
  { gl: '2110', amount: 39.75, label: 'VAT' },
];

async function main() {
  const prisma = new PrismaClient();
  const fails: string[] = [];
  try {
    const tenant = await prisma.tenant.findFirst({ where: { subdomain: 'demo' } });
    if (!tenant) throw new Error('demo tenant missing');
    const tenantId = tenant.id;

    const bill = await prisma.accountingInvoice.findFirst({
      where: { tenantId, invoiceNumber: 'AP-CERT-2026-01' },
    });
    if (!bill) fails.push('purchase invoice AP-CERT-2026-01 missing');
    else {
      if (bill.type !== 'Purchase') fails.push(`bill type is ${bill.type}`);
      if (Math.abs(bill.total - 100) > 0.01) fails.push(`bill total ${bill.total}`);
      if (Math.abs((bill.paidAmount || 0) - 100) > 0.01) fails.push(`bill paidAmount ${bill.paidAmount}`);
      const outstanding = round2(bill.total - (bill.paidAmount || 0));
      if (Math.abs(outstanding) > 0.01) fails.push(`bill outstanding ${outstanding}`);
    }

    const payment = await prisma.accountingPayment.findFirst({
      where: { tenantId, invoiceId: bill?.id, status: 'Posted' },
    });
    if (!payment) fails.push('posted payment for AP-CERT-2026-01 missing');
    else {
      if (Math.abs(payment.amount - 100) > 0.01) fails.push(`payment amount ${payment.amount}`);
      if (payment.bankAccountId !== 'reg-cash-1110') fails.push(`payment bank ${payment.bankAccountId}`);
    }

    const remits = await prisma.journalEntry.findMany({
      where: { tenantId, sourceModule: 'tax_remittance', status: 'Posted' },
      include: { lines: true },
    });
    for (const want of JUNE_REMIT) {
      const hit = remits.find((e) => e.sourceTransactionId === `${want.gl}-2026-06`);
      if (!hit) {
        fails.push(`June ${want.label} remittance missing`);
        continue;
      }
      const debit = hit.lines.find((l) => l.accountCode === want.gl)?.debit || 0;
      const credit = hit.lines.find((l) => l.accountCode === '1110')?.credit || 0;
      if (Math.abs(debit - want.amount) > 0.01 || Math.abs(credit - want.amount) > 0.01) {
        fails.push(`June ${want.label} lines Dr ${debit} Cr ${credit}`);
      }
    }

    const posted = await prisma.journalEntry.findMany({
      where: { tenantId, status: 'Posted' },
      include: { lines: true },
    });
    let unbalanced = 0;
    const gl = new Map<string, number>();
    for (const entry of posted) {
      const debit = round2(entry.lines.reduce((s, l) => s + (l.debit || 0), 0));
      const credit = round2(entry.lines.reduce((s, l) => s + (l.credit || 0), 0));
      if (Math.abs(debit - credit) > 0.02) unbalanced++;
      for (const line of entry.lines) {
        gl.set(line.accountCode, round2((gl.get(line.accountCode) || 0) + (line.debit || 0) - (line.credit || 0)));
      }
    }
    if (unbalanced) fails.push(`${unbalanced} unbalanced posted journals`);

    const net2170 = gl.get('2170') || 0;
    if (Math.abs(net2170) > 0.02) fails.push(`GL 2170 net ${net2170}`);

    const registers = await prisma.bankAccount.findMany({
      where: { tenantId, id: { in: ['reg-cash-1110', 'reg-bank-1120'] } },
    });
    for (const [id, code] of [['reg-cash-1110', '1110'], ['reg-bank-1120', '1120']] as const) {
      const reg = registers.find((r) => r.id === id);
      const book = gl.get(code) || 0;
      if (!reg) fails.push(`${id} missing`);
      else if (Math.abs(round2(reg.currentBalance) - book) > 0.02) {
        fails.push(`${id} balance ${reg.currentBalance} != GL ${code} ${book}`);
      }
    }

    const codes = [...gl.keys()];
    const accounts = await prisma.account.findMany({
      where: { tenantId, code: { in: codes } },
      select: { code: true, type: true },
    });
    const have = new Set(accounts.map((a) => a.code));
    const missing = codes.filter((c) => !have.has(c));
    if (missing.length) fails.push(`posted codes missing from chart: ${missing.join(',')}`);

    const buckets = { ASSET: 0, LIABILITY: 0, EQUITY: 0, REVENUE: 0, EXPENSE: 0 };
    for (const account of accounts) {
      const net = gl.get(account.code) || 0;
      buckets[account.type] = round2(buckets[account.type] + net);
    }
    const assets = buckets.ASSET;
    const liabilities = round2(-buckets.LIABILITY);
    const equity = round2(-buckets.EQUITY);
    const revenue = round2(-buckets.REVENUE);
    const expenses = buckets.EXPENSE;
    const equation = round2(assets - liabilities - equity - revenue + expenses);
    if (Math.abs(equation) > 0.05) {
      fails.push(`books out of balance by ${equation} (assets ${assets}, liabilities ${liabilities}, equity ${equity}, revenue ${revenue}, expenses ${expenses})`);
    }

    let headerMismatch = 0;
    for (const entry of posted) {
      const debit = round2(entry.lines.reduce((s, l) => s + (l.debit || 0), 0));
      const credit = round2(entry.lines.reduce((s, l) => s + (l.credit || 0), 0));
      if (Math.abs(round2(entry.totalDebit) - debit) > 0.02 || Math.abs(round2(entry.totalCredit) - credit) > 0.02) {
        headerMismatch++;
      }
    }
    if (headerMismatch) fails.push(`${headerMismatch} journals whose header totals differ from their lines`);

    if (payment?.journalEntryId) {
      const payJe = posted.find((e) => e.id === payment.journalEntryId);
      if (!payJe) fails.push('supplier payment journal missing');
      else {
        const dr = payJe.lines.find((l) => l.accountCode === '2205')?.debit || 0;
        const cr = payJe.lines.find((l) => l.accountCode === '1110')?.credit || 0;
        if (Math.abs(dr - 100) > 0.01 || Math.abs(cr - 100) > 0.01) {
          fails.push(`supplier payment journal Dr 2205 ${dr} / Cr 1110 ${cr}`);
        }
      }
    } else if (payment) {
      fails.push('supplier payment has no journal');
    }

    const txns = await prisma.bankTransaction.findMany({
      where: { tenantId, bankAccountId: { in: ['reg-cash-1110', 'reg-bank-1120'] } },
    });
    for (const [id, code] of [['reg-cash-1110', '1110'], ['reg-bank-1120', '1120']] as const) {
      const rows = txns.filter((t) => t.bankAccountId === id);
      const txnNet = round2(rows.reduce((s, t) => s + (t.type === 'Withdrawal' ? -t.amount : t.amount), 0));
      const book = gl.get(code) || 0;
      if (Math.abs(txnNet - book) > 0.02) fails.push(`${id} transaction net ${txnNet} != GL ${code} ${book}`);
      const seen = new Set<string>();
      for (const row of rows) {
        if (!row.journalEntryId) continue;
        const key = `${row.journalEntryId}`;
        if (seen.has(key)) fails.push(`${id} duplicate cashbook row for journal ${row.journalEntryId}`);
        seen.add(key);
      }
    }

    const sales = await prisma.accountingInvoice.findMany({
      where: { tenantId, type: 'Sales', status: { notIn: ['Void', 'Draft'] } },
      select: { id: true, invoiceNumber: true, total: true, paidAmount: true },
    });
    const receipts = await prisma.accountingPayment.findMany({
      where: { tenantId, status: 'Posted', invoiceId: { not: null } },
      select: { invoiceId: true, amount: true, type: true },
    });
    const paidByInvoice = new Map<string, number>();
    for (const receipt of receipts) {
      if (!receipt.invoiceId) continue;
      const sign = receipt.type === 'Refund' ? -1 : 1;
      paidByInvoice.set(receipt.invoiceId, round2((paidByInvoice.get(receipt.invoiceId) || 0) + sign * receipt.amount));
    }
    const drifted = sales.filter((inv) => Math.abs((inv.paidAmount || 0) - (paidByInvoice.get(inv.id) || 0)) > 0.02);
    if (drifted.length) {
      fails.push(`${drifted.length} invoices whose paid amount does not match their receipts (${drifted.slice(0, 3).map((i) => i.invoiceNumber).join(', ')})`);
    }
    const signedAr = round2(sales.reduce((s, inv) => s + inv.total - (paidByInvoice.get(inv.id) || 0), 0));
    const gl1210 = gl.get('1210') || 0;
    if (Math.abs(gl1210 - signedAr) > 0.05) {
      fails.push(`GL 1210 ${gl1210} != receivables net ${signedAr}`);
    }

    const auditLogs = await prisma.auditLog.count({
      where: { tenantId, entity: { in: ['JournalEntry', 'Invoice', 'Payment'] } },
    });
    if (auditLogs === 0) fails.push('accounting audit log is empty');

    const cash = registers.find((r) => r.id === 'reg-cash-1110');
    const summary = {
      journals: posted.length,
      unbalanced,
      cash: cash ? round2(cash.currentBalance) : null,
      gl1110: gl.get('1110') || 0,
      gl1120: gl.get('1120') || 0,
      remit: remits.length,
      billOutstanding: bill ? round2(bill.total - (bill.paidAmount || 0)) : null,
    };

    if (fails.length) {
      console.log('ACCT_CERT_FAIL');
      for (const f of fails) console.log(' - ' + f);
      console.log(JSON.stringify(summary));
      process.exitCode = 1;
    } else {
      console.log('ACCT_CERT_PASS');
      console.log(JSON.stringify(summary));
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('ACCT_CERT_FAIL');
  console.error(err);
  process.exit(1);
});
