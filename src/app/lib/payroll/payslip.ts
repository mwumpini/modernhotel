import type { Employee, PayrollPeriod, PayrollRecord } from '../hr/models';
import { payrollRecordLabels } from '../hr/payrollStore';
import { readDebtRepayments } from '../hr/staffDebtStore';
import { buildOrgProfile } from '../print/buildOrgProfile';
import { openHtmlPrintWindow, renderPrint } from '../print/engine';
import type { PrintData, PrintLineItem } from '../print/templates';
import { useSettingsStore } from '../settings/store';

const round2 = (n: number) => Math.round(n * 100) / 100;

export type DeductionLabels = { tier1: string; tier2: string; tier3: string };

const PAYMENT_METHOD: Record<string, string> = { bank_transfer: 'Bank transfer', check: 'Cheque', cash: 'Cash' };

export function payslipMonth(period?: Pick<PayrollPeriod, 'startDate'>): string {
  const d = period?.startDate ? new Date(period.startDate) : new Date();
  return d.toLocaleString('en-GB', { month: 'long', year: 'numeric' });
}

/**
 * One payslip from a prepared payroll line. Deduction names follow the rules in the Tax Rate
 * Builder, staff debt repayments are listed one by one, and whatever else was withheld is one
 * "Other deductions" line, so earnings minus deductions always equals the net pay on the record.
 */
export function buildPayslipData(params: {
  record: PayrollRecord;
  period?: PayrollPeriod;
  employee?: Employee;
  labels: DeductionLabels;
}): PrintData {
  const { record, period, employee, labels } = params;
  const settings = useSettingsStore.getState();
  const names = payrollRecordLabels(record);
  const d = record.deductions || ({} as PayrollRecord['deductions']);

  const earningsItems: PrintLineItem[] = [
    { description: 'Basic salary', amount: record.basicSalary },
    { description: 'Allowances', amount: record.allowances },
    { description: 'Overtime', amount: record.overtimePay },
    { description: 'Bonus', amount: record.bonuses },
  ].filter((it) => Number(it.amount) > 0.004);

  const listed: PrintLineItem[] = [
    { description: 'Income tax (PAYE)', amount: d.tax },
    { description: labels.tier1, amount: d.socialSecurity },
    { description: labels.tier2, amount: d.pension },
    { description: labels.tier3, amount: d.tier3 || 0 },
    { description: 'Health insurance', amount: d.healthInsurance },
    ...readDebtRepayments(record.notes).map((l) => ({
      description: `Staff ${String(l.type || 'debt').replace(/_/g, ' ')} repayment`,
      amount: l.amount,
    })),
  ].filter((it) => Number(it.amount) > 0.004);
  const listedTotal = listed.reduce((s, it) => s + Number(it.amount || 0), 0);
  const other = round2(Number(record.grossPay || 0) - Number(record.netPay || 0) - listedTotal);
  const deductionsItems = other > 0.004 ? [...listed, { description: 'Other deductions', amount: other }] : listed;

  const bank = (employee as { bankAccount?: { accountNumber?: string; bankName?: string; branchCode?: string } } | undefined)?.bankAccount;
  return {
    org: buildOrgProfile(settings as never),
    guest: { name: record.employeeName },
    employee: {
      name: record.employeeName,
      employeeNumber: record.employeeNumber,
      position: names.position,
      department: names.department,
      payPeriod: payslipMonth(period),
      dateOfJoining: employee?.hireDate ? new Date(employee.hireDate).toISOString() : undefined,
    },
    docDate: (record.paidAt ? new Date(record.paidAt) : new Date()).toISOString(),
    docNumber: `${period?.periodNumber || ''}-${record.employeeNumber || ''}`.replace(/^-|-$/g, ''),
    title: 'Payslip',
    items: [],
    totals: { subTotal: 0 },
    earningsItems,
    deductionsItems,
    bankDetails: {
      bankName: bank?.bankName || undefined,
      accountNumber: bank?.accountNumber || record.bankAccount || undefined,
      branch: bank?.branchCode || undefined,
    },
    footerNotes: [
      ...(record.paymentMethod ? [`Paid by ${(PAYMENT_METHOD[record.paymentMethod] || record.paymentMethod).toLowerCase()}.`] : []),
      'This is a system generated payslip.',
    ],
    currency: '₵',
  };
}

/** Print one or many payslips with the payslip template chosen in Settings, one per page. */
export function printPayslips(slips: PrintData[]): boolean {
  if (slips.length === 0) return false;
  const key = useSettingsStore.getState().printing?.payslip || 'builtin-payslip-grid';
  const pages = slips.map((data) => renderPrint('payslip', key, data));
  if (pages.length === 1) return openHtmlPrintWindow(pages[0]);
  // Same template for every page, so the first page's <head> styles all of them.
  const head = pages[0].match(/<head[^>]*>([\s\S]*?)<\/head>/i)?.[1] || '';
  const bodies = pages.map((html) => html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] || html);
  const combined = `<!DOCTYPE html><html><head>${head}<style>.payslip-page{page-break-after:always;break-after:page}.payslip-page:last-child{page-break-after:auto;break-after:auto}</style></head><body>${bodies
    .map((b) => `<div class="payslip-page">${b}</div>`)
    .join('')}</body></html>`;
  return openHtmlPrintWindow(combined);
}
