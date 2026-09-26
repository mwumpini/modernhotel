import { PrismaClient } from '@prisma/client';

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function tier1Employer(notes: string | null) {
  try {
    const n = notes ? JSON.parse(notes) : {};
    if (typeof n.tier1Employer === 'number') return n.tier1Employer;
    if (typeof n.employerContribution === 'number') return n.employerContribution;
  } catch { /* ignore */ }
  return 0;
}

const SALES: Record<string, string> = { '2110': 'VAT', '2120': 'NHIL', '2130': 'GETFund', '2150': 'Tourism', '2160': 'WHT' };
const REMIT: Record<string, string> = { '2110': 'VAT', '2120': 'NHIL', '2130': 'GETFund', '2150': 'Tourism', '2160': 'WHT', '2170': 'WHT', '2210': 'PAYE', '2220': 'SSNIT' };

async function main() {
  const prisma = new PrismaClient();
  const fails: string[] = [];
  try {
    const tenant = await prisma.tenant.findFirst({ where: { subdomain: 'demo' } });
    if (!tenant) throw new Error('no tenant');
    const tenantId = tenant.id;
    const filings = await prisma.complianceReport.findMany({ where: { tenantId, countryCode: 'GH' } });
    const filing = (type: string, period: string) => filings.find((f) => f.reportType === type && f.period === period);

    const schedules = await prisma.complianceReportingRule.findMany({ where: { tenantId, countryCode: 'GH' } });
    const types = new Set(schedules.map((r) => String((r.data as { reportType?: string }).reportType)));
    for (const required of ['VAT', 'NHIL', 'GETFund', 'Tourism', 'PAYE', 'SSNIT', 'WHT']) {
      if (!types.has(required)) fails.push(`missing schedule ${required}`);
    }

    const periods = await prisma.hrPayrollPeriod.findMany({
      where: { tenantId },
      include: { records: { select: { deductions: true } } },
    });
    let postedPaye = 0;
    let postedSsnit = 0;
    for (const p of periods) {
      const ym = /(\d{4})-(\d{2})/.exec(p.periodNumber);
      if (!ym) continue;
      const period = `${ym[1]}-${ym[2]}`;
      let paye = 0;
      let employee = 0;
      for (const r of p.records) {
        const d = r.deductions as { tax?: number; socialSecurity?: number };
        paye += Number(d.tax || 0);
        employee += Number(d.socialSecurity || 0);
      }
      paye = round2(paye);
      const ssnit = round2(employee + tier1Employer(p.notes));
      const payeFiling = filing('PAYE', period);
      const ssnitFiling = filing('SSNIT', period);
      if (paye > 0.05 && Math.abs((payeFiling?.amount || 0) - paye) > 0.05) {
        fails.push(`PAYE ${period} filing ${payeFiling?.amount ?? 'missing'} != payroll ${paye}`);
      }
      if (ssnit > 0.05 && Math.abs((ssnitFiling?.amount || 0) - ssnit) > 0.05) {
        fails.push(`SSNIT ${period} filing ${ssnitFiling?.amount ?? 'missing'} != tier 1 ${ssnit}`);
      }
      const je = await prisma.journalEntry.findFirst({
        where: { id: `JE-PAYROLL-${p.id}`, tenantId, status: 'Posted' },
        include: { lines: { select: { accountCode: true, credit: true } } },
      });
      if (!je) continue;
      const credit = (code: string) => round2(je.lines.filter((l) => l.accountCode === code).reduce((s, l) => s + (l.credit || 0), 0));
      if (Math.abs(credit('2210') - (payeFiling?.amount || 0)) > 0.05) {
        fails.push(`PAYE ${period} filing != posted journal ${credit('2210')}`);
      }
      if (Math.abs(credit('2220') - (ssnitFiling?.amount || 0)) > 0.05) {
        fails.push(`SSNIT ${period} filing != posted journal ${credit('2220')}`);
      }
      postedPaye = round2(postedPaye + credit('2210'));
      postedSsnit = round2(postedSsnit + credit('2220'));
    }

    const gl = async (code: string) => {
      const lines = await prisma.journalEntryLine.findMany({
        where: { accountCode: code, journalEntry: { tenantId, status: 'Posted' } },
        select: { debit: true, credit: true },
      });
      return round2(lines.reduce((s, l) => s + (l.credit || 0) - (l.debit || 0), 0));
    };
    const gl2210 = await gl('2210');
    const gl2220 = await gl('2220');
    if (Math.abs(gl2210 - postedPaye) > 0.05) fails.push(`GL 2210 ${gl2210} != posted payroll PAYE ${postedPaye}`);
    if (Math.abs(gl2220 - postedSsnit) > 0.05) fails.push(`GL 2220 ${gl2220} != posted payroll Tier 1 ${postedSsnit}`);

    const remits = await prisma.journalEntry.findMany({
      where: { tenantId, sourceModule: 'tax_remittance', status: 'Posted' },
      select: { sourceTransactionId: true, totalDebit: true },
    });
    for (const remit of remits) {
      const [glCode, ...rest] = String(remit.sourceTransactionId || '').split('-');
      const period = rest.join('-');
      const reportType = REMIT[glCode];
      const row = reportType ? filing(reportType, period) : undefined;
      if (!row || (row.status !== 'submitted' && row.status !== 'approved') || Math.abs(row.amount - remit.totalDebit) > 0.05) {
        fails.push(`remittance ${remit.sourceTransactionId} ${remit.totalDebit} != filing ${row?.status ?? 'missing'} ${row?.amount ?? ''}`);
      }
    }

    const lines = await prisma.journalEntryLine.findMany({
      where: { accountCode: { in: Object.keys(SALES) }, journalEntry: { tenantId, status: 'Posted' } },
      select: { accountCode: true, debit: true, credit: true, journalEntry: { select: { date: true, sourceModule: true, sourceTransactionId: true } } },
    });
    const nets = new Map<string, number>();
    for (const l of lines) {
      const reportType = SALES[l.accountCode];
      const remit = l.journalEntry.sourceModule === 'tax_remittance';
      const period = remit
        ? String(l.journalEntry.sourceTransactionId || '').split('-').slice(1).join('-')
        : new Date(l.journalEntry.date).toISOString().slice(0, 7);
      const key = `${reportType}|${period}`;
      const delta = remit ? -(l.debit || 0) : (l.credit || 0) - (l.debit || 0);
      nets.set(key, (nets.get(key) || 0) + delta);
    }
    for (const [key, raw] of nets) {
      const open = round2(raw);
      const [reportType, period] = key.split('|');
      const row = filing(reportType, period);
      if (open > 0.05) {
        if (!row || row.status === 'submitted' || row.status === 'approved' || Math.abs(row.amount - open) > 0.05) {
          fails.push(`open ${reportType} ${period} ${open} != pending filing ${row?.status ?? 'missing'} ${row?.amount ?? ''}`);
        }
      }
    }

    const submitted = filings.filter((f) => f.status === 'submitted' || f.status === 'approved').length;
    const filedPct = filings.length ? Math.round((submitted / filings.length) * 100) : 0;
    if (fails.length) {
      console.log('COMPLIANCE_CERT_FAIL');
      for (const f of fails) console.log(f);
      process.exitCode = 1;
      return;
    }
    console.log('COMPLIANCE_CERT_PASS');
    console.log(JSON.stringify({ filings: filings.length, submitted, filedPct, gl2210, gl2220, schedules: schedules.length }));
  } finally {
    await prisma.$disconnect();
  }
}

main();
