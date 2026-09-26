import type UniversalPayrollBuilder from './builder';
import { useEmployeeStore } from '../hr/employeeStore';
import { usePayrollStore } from '../hr/payrollStore';
import { useLeaveAttendanceStore } from '../hr/leaveAttendanceStore';
import { useComplianceStore } from '../compliance/store';
import { syncPayrollRunToComplianceFiling } from '../compliance/payrollSync';
import type { PayrollPeriod, PayrollRecord } from '../hr/models';
import type { JournalEntry } from '../accounting/models';

export interface MonthlyRunInput {
  builder: UniversalPayrollBuilder;
  /** Id of the payroll configuration already loaded into `builder`. */
  runtimeId: string;
  employees: any[];
  /** Periods already saved — a month can only be processed once. */
  periods: PayrollPeriod[];
  month: number;
  year: number;
  /** Per-employee overtime hours that override the HR-approved figure for the month. */
  overtimeOverrides?: Record<string, number>;
  userName: string;
  complianceCountry: string;
}

export type MonthlyRunResult =
  | { ok: true; employeeCount: number; periodId: string; warning?: string }
  | { ok: false; error: string };

/** Loads the country's payroll template into a fresh builder, with any rate edits saved on this
 * browser for it, and returns the id to run against. */
export function prepareBuilderForRun(builder: UniversalPayrollBuilder, countryCode: string): string {
  const template = builder.getCountryTemplate(countryCode);
  let config = template;
  try {
    const saved = typeof window !== 'undefined' ? localStorage.getItem(`payroll.config.${template.country}`) : null;
    if (saved) config = JSON.parse(saved);
  } catch {
    /* fall back to the template */
  }
  const id = config.id || template.id;
  builder.payrollConfigs.set(id, config);
  return id;
}

/** Changes made to one person's line after the run, before the month is approved. */
export interface StaffAdjustments {
  /** Replaces the employee's standing allowance for this month. */
  allowances?: number;
  /** Overtime hours instead of the HR-approved figure. */
  overtimeHours?: number;
  /** Extra taxable pay (a bonus). */
  bonus?: number;
  /** A deduction taken after tax (loan repayment, salary advance…). */
  otherDeduction?: number;
  reason?: string;
  editedBy?: string;
  editedAt?: string;
}

/** What the record's notes carry: the adjustments behind its figures, so a second edit starts
 * from what was actually applied. Older notes were plain text. */
export function readAdjustments(notes?: string): StaffAdjustments {
  if (!notes) return {};
  try {
    const parsed = JSON.parse(notes);
    return parsed && typeof parsed === 'object' && parsed.adjustments ? parsed.adjustments : {};
  } catch {
    return {};
  }
}

/** The employer's statutory contribution for the whole month, captured when the run was
 * processed (records only hold the employee's side). None of the adjustable items change it —
 * contributions are based on basic salary alone. */
export function readEmployerContribution(period: Pick<PayrollPeriod, 'notes'>): number | undefined {
  try {
    const n = period.notes ? JSON.parse(period.notes)?.employerContribution : undefined;
    return typeof n === 'number' ? n : undefined;
  } catch {
    return undefined;
  }
}

export const monthYearOf = (period: Pick<PayrollPeriod, 'periodNumber'>) => {
  const m = /(\d{4})-(\d{2})/.exec(period.periodNumber);
  return m ? { year: Number(m[1]), month: Number(m[2]) } : undefined;
};

/** HR-approved overtime hours for one person in one month. */
export const approvedOvertimeFor = (employeeId: string, month: number, year: number) =>
  useLeaveAttendanceStore.getState().getApprovedOvertimeHours(employeeId, new Date(year, month - 1, 1), new Date(year, month, 0));

/** Labour Act cap is 40 hours a week. A monthly salary with no hourly rate on file
 * converts as basic × 12 / (40 × 52), so approved overtime still has a wage to multiply. */
export const STANDARD_MONTHLY_HOURS = (40 * 52) / 12;

export function impliedHourlyRate(basicSalary: number, statedHourly?: number) {
  const stated = Number(statedHourly || 0);
  if (stated > 0) return stated;
  const basic = Number(basicSalary || 0);
  if (basic <= 0) return 0;
  return Math.round((basic / STANDARD_MONTHLY_HOURS) * 100) / 100;
}

interface CalcContext {
  builder: UniversalPayrollBuilder;
  runtimeId: string;
  month: number;
  year: number;
}

/** Calculates one employee's month with the payroll engine and returns the record fields to
 * save. Used for the full run and for re-calculating a single edited line, so both always agree. */
function calculateStaff(ctx: CalcContext, emp: any, defaultOvertimeHours: number, adj: StaffAdjustments = {}) {
  const { builder, runtimeId, month, year } = ctx;
  const baseCfg = JSON.parse(JSON.stringify((builder as any).payrollConfigs.get(runtimeId)));

  // Tier 1/Tier 2 are tracked as fully separate rules (different institutions), each
  // independently renameable — so downstream code must match on the rule's stable id,
  // never its (user-editable) display name.
  const rules = useComplianceStore.getState().taxRules;
  const ruleFor = (tag: string) => rules.find((r) => r.countryCode === 'GH' && r.domain === 'payroll' && (r.appliesTo || []).includes(tag));
  const tier1Rule = ruleFor('TIER1');
  const tier2Rule = ruleFor('TIER2');
  const tier3CapRule = ruleFor('TIER3_RELIEF_CAP');

  // Create or update employee profile for the run
  const eid = emp.id || emp.employeeNumber || `EMP-${Math.floor(Math.random() * 10000)}`;
  const basicForRate = Number((emp as any).basicSalary ?? (emp as any).salary ?? 0);
  const hourly = impliedHourlyRate(basicForRate, (emp as any).hourlyRate);
  const profiles = (builder as any).employeeProfiles as Map<string, any>;
  if (!profiles.get(eid)) {
    builder.createEmployee({
      id: eid,
      employeeId: emp.employeeNumber || eid,
      firstName: emp.firstName, lastName: emp.lastName, email: emp.email,
      employment: { type: emp.employmentType || 'full_time', department: emp.departmentId, position: emp.positionId, salary: basicForRate, currency: ((builder as any).payrollConfigs.get(runtimeId)?.currency || 'GHS'), hourlyRate: hourly },
      taxInfo: { filingStatus: (emp as any).taxWithholding?.filingStatus || 'single', allowances: Number((emp as any).taxWithholding?.allowances || 0), additionalWithholding: Number((emp as any).taxWithholding?.additionalWithholding || 0) },
    });
  } else {
    const existing = profiles.get(eid);
    existing.employment.salary = basicForRate;
    existing.employment.hourlyRate = hourly;
  }

  // Pay comes from the staff file. Drop template placeholders (a flat transport line, a second
  // basic) so they are not added on top of the recorded salary.
  const runtimeConfig = JSON.parse(JSON.stringify(baseCfg));
  runtimeConfig.earnings = (runtimeConfig.earnings || []).filter((c: any) => !['BASIC', 'ALLOWANCE', 'TRANSPORT', 'VEHICLE_BENEFIT', 'HOUSING_BENEFIT', 'OTHER_NON_CASH', 'BONUS'].includes(c.code));
  const allowances = Number(adj.allowances ?? (emp as any).allowances ?? 0);
  // A flat cash allowance is PAYE-taxable unless it reimburses a documented expense.
  if (allowances > 0) runtimeConfig.earnings.push({ name: 'Allowance', code: 'ALLOWANCE', calculationType: 'fixed', amount: allowances, taxable: true });
  const vehicle = Number((emp as any).vehicleBenefit || 0);
  if (vehicle > 0) runtimeConfig.earnings.push({ name: 'Vehicle Benefit', code: 'VEHICLE_BENEFIT', calculationType: 'fixed', amount: vehicle, taxable: true });
  const housing = Number((emp as any).housingBenefit || 0);
  if (housing > 0) runtimeConfig.earnings.push({ name: 'Housing Benefit', code: 'HOUSING_BENEFIT', calculationType: 'fixed', amount: housing, taxable: true });
  const other = Number((emp as any).otherNonCashBenefits || 0);
  if (other > 0) runtimeConfig.earnings.push({ name: 'Other Non-Cash Benefits', code: 'OTHER_NON_CASH', calculationType: 'fixed', amount: other, taxable: true });
  const bonus = Number(adj.bonus || 0);
  if (bonus > 0) runtimeConfig.earnings.push({ name: 'Bonus', code: 'BONUS', calculationType: 'fixed', amount: bonus, taxable: true });

  // Tier 3 (voluntary provident fund) — a real, employee-elected pre-tax deduction,
  // fully separate from Tier 1/Tier 2 (own institution, own election). Only applied
  // when the employee opted in with a contribution rate; capped at the statutory
  // relief ceiling. The rule's own (renameable) name is used for the deduction label
  // so a rename actually shows up on payslips instead of a hardcoded string.
  runtimeConfig.deductions = (runtimeConfig.deductions || []).filter((d: any) => d.code !== 'TIER3_EMP' && d.code !== 'OTHER_DED');
  const tier3Pct = Number((emp as any).tier3Enrolled ? (emp as any).tier3ContributionPct || 0 : 0);
  if (tier3Pct > 0) {
    const basicSalary = Number((emp as any).basicSalary ?? (emp as any).salary ?? 0);
    const grossForTier3 = basicSalary + allowances;
    const reliefCapPct = tier3CapRule?.rate ?? 16.5;
    // The relief cap limits the RESULTING contribution amount to reliefCapPct% of basic
    // salary — it's not an income ceiling the rate stops applying above (that's what
    // `limits.ceiling` means for Tier 1/2), so compute and clamp the amount directly
    // here rather than pushing a 'percentage' deduction with a ceiling.
    const rawAmount = grossForTier3 * (tier3Pct / 100);
    const maxRelief = basicSalary * (reliefCapPct / 100);
    runtimeConfig.deductions.push({
      name: tier3CapRule?.name || 'Tier 3',
      code: 'TIER3_EMP',
      category: 'statutory',
      calculationType: 'fixed',
      amount: Math.round(Math.min(rawAmount, maxRelief) * 100) / 100,
      base: 'gross',
    });
  }
  // After-tax deduction (base 'net' is what the engine treats as post-tax).
  const otherDeduction = Number(adj.otherDeduction || 0);
  if (otherDeduction > 0) runtimeConfig.deductions.push({ name: 'Other deduction', code: 'OTHER_DED', category: 'other', calculationType: 'fixed', amount: otherDeduction, base: 'net' });
  (builder as any).payrollConfigs.set(runtimeId, runtimeConfig);

  const adjustments = { hours: { OVERTIME: Number(adj.overtimeHours ?? defaultOvertimeHours) } };
  const calc = (builder as any).calculatePayroll(eid, runtimeId, { month, year }, adjustments);
  const deductionsSum = calc.deductions?.total || 0;
  const tier1Amount = tier1Rule ? (calc.taxes.items.find((t: any) => t.ruleId === tier1Rule.id)?.amount || 0) : 0;
  const tier2Amount = tier2Rule ? (calc.taxes.items.find((t: any) => t.ruleId === tier2Rule.id)?.amount || 0) : 0;
  const tier3Amount = calc.deductions.items.find((d: any) => d.component?.code === 'TIER3_EMP')?.amount || 0;
  const overtimePay = calc.earnings.items.find((i: any) => i.component?.code === 'OVERTIME')?.amount || 0;
  const bonusPaid = calc.earnings.items.find((i: any) => i.component?.code === 'BONUS')?.amount || 0;
  const ssnitEmployee = calc.taxes.items.filter((t: any) => t.type === 'social').reduce((s: number, t: any) => s + (t.amount || 0), 0);
  const tier1Employer = tier1Rule ? (calc.taxes.items.find((t: any) => t.ruleId === tier1Rule.id)?.employerAmount || 0) : 0;
  const tier2Employer = tier2Rule ? (calc.taxes.items.find((t: any) => t.ruleId === tier2Rule.id)?.employerAmount || 0) : 0;

  return {
    calc,
    employerContribution: calc.taxes.employer || 0,
    tier1Employer,
    tier2Employer,
    ssnitEmployee,
    deductionsSum,
    fields: {
      employeeId: eid,
      employeeNumber: emp.employeeNumber || '',
      employeeName: `${emp.firstName} ${emp.lastName}`,
      department: useEmployeeStore.getState().getDepartment(emp.departmentId)?.name ?? 'Unassigned',
      position: useEmployeeStore.getState().getPosition(emp.positionId)?.title ?? 'Unassigned',
      basicSalary: Number((emp as any).basicSalary ?? (emp as any).salary ?? 0),
      allowances,
      overtimePay,
      bonuses: bonusPaid,
      grossPay: calc.summary.gross,
      deductions: {
        tax: calc.taxes.employee,
        // Tier 1 and Tier 2 are separate institutions/rules — kept as separate fields so
        // a rename of one never bleeds into the other's figure. `pension` historically
        // meant "Tier 2"; `tier3` is new. socialSecurity/pension/tier3 are the current
        // display labels' amounts regardless of what the underlying rules are renamed to.
        socialSecurity: tier1Amount,
        pension: tier2Amount,
        tier3: tier3Amount,
        healthInsurance: 0,
        // deductions.total is the pre-tax deductions (Tier 1/2/3) plus after-tax ones; income tax is
        // separate, so what is left once the tiers are taken out is the 'other' deductions.
        other: Math.max(Math.round((deductionsSum - tier1Amount - tier2Amount - tier3Amount) * 100) / 100, 0),
      },
      netPay: calc.summary.net,
      bankAccount: emp.bankAccount?.accountNumber || '',
      paymentMethod: 'bank_transfer' as const,
    },
  };
}

/** One employee's month, without saving. Shared by the payroll run and by corrections of a saved month. */
export function calculateEmployeeMonth(ctx: CalcContext, emp: any, overtimeHours: number, adjustments: StaffAdjustments = {}) {
  return calculateStaff(ctx, emp, overtimeHours, adjustments);
}

/** Processes payroll for every active employee for one month: calculates each person's pay,
 * saves the period and its records (awaiting approval) and files the PAYE/SSNIT hints. Nothing
 * is approved, paid or posted to the ledger here — approving a month posts it. */
export function runMonthlyPayroll(input: MonthlyRunInput): MonthlyRunResult {
  const { builder, runtimeId, employees, periods: payrollPeriods, month, year, overtimeOverrides, userName, complianceCountry } = input;
  const { createPayrollPeriod, createPayrollRecord, updatePayrollPeriod } = usePayrollStore.getState();

  const activeEmployees = (employees || []).filter((e: any) => e.status === 'active');
  if (activeEmployees.length === 0) return { ok: false, error: 'No active employees to process.' };

  const periodNumber = `PP-${year}-${String(month).padStart(2, '0')}`;
  const existingPeriod = (payrollPeriods || []).find((p) => p.periodNumber === periodNumber);
  if (existingPeriod) {
    return { ok: false, error: `Payroll for ${periodNumber} has already been processed (status: ${existingPeriod.status}), so it can't be run again — that would double-count every employee's pay.` };
  }
  const period = createPayrollPeriod({
    periodNumber,
    startDate: new Date(year, month - 1, 1),
    endDate: new Date(year, month, 0),
    status: 'processing',
    totalGrossPay: 0,
    totalNetPay: 0,
    totalDeductions: 0,
    totalTaxes: 0,
    employeeCount: activeEmployees.length,
    processedBy: userName,
  } as any);

  const ctx: CalcContext = { builder, runtimeId, month, year };
  const totals = { gross: 0, net: 0, tax: 0, ssnit: 0, employerTax: 0, tier1Employer: 0, tier2Employer: 0, deductions: 0 };
  activeEmployees.forEach((emp: any) => {
    const eid = emp.id || emp.employeeNumber;
    const r = calculateStaff(ctx, emp, Number(overtimeOverrides?.[eid] ?? approvedOvertimeFor(eid, month, year)));
    totals.gross += r.calc.summary.gross;
    totals.net += r.calc.summary.net;
    totals.tax += r.calc.taxes.employee;
    totals.ssnit += r.ssnitEmployee;
    totals.employerTax += r.employerContribution;
    totals.tier1Employer += r.tier1Employer;
    totals.tier2Employer += r.tier2Employer;
    totals.deductions += r.deductionsSum;
    createPayrollRecord({
      payrollPeriodId: period.id,
      ...r.fields,
      // Calculated, not yet approved or paid — that happens in Payroll Processing.
      status: 'processed',
      notes: 'Monthly payroll run',
    } as any);
  });

  updatePayrollPeriod(period.id, {
    status: 'processing', // awaiting approval
    totalGrossPay: totals.gross,
    totalNetPay: totals.net,
    totalDeductions: totals.deductions,
    totalTaxes: totals.tax,
    processedAt: new Date(),
    processedBy: userName,
    // The employer's share of the contributions isn't on any employee record, so keep it with the
    // month: the ledger entry built at approval needs it.
    notes: JSON.stringify({
      employerContribution: Math.round(totals.employerTax * 100) / 100,
      tier1Employer: Math.round(totals.tier1Employer * 100) / 100,
      tier2Employer: Math.round(totals.tier2Employer * 100) / 100,
    }),
  } as any);

  syncPayrollRunToComplianceFiling({
    countryCode: complianceCountry,
    period: `${year}-${String(month).padStart(2, '0')}`,
    payeTotal: totals.tax,
    ssnitTotal: Math.round((totals.ssnit + totals.tier1Employer) * 100) / 100,
    employeeCount: activeEmployees.length,
  });

  return { ok: true, employeeCount: activeEmployees.length, periodId: period.id };
}

export interface EditLineInput {
  builder: UniversalPayrollBuilder;
  runtimeId: string;
  period: PayrollPeriod;
  record: PayrollRecord;
  /** The employee the record belongs to — needed to recalculate; undefined if they were deleted. */
  employee: any;
  adjustments: StaffAdjustments;
  complianceCountry: string;
}

export type EditLineResult = { ok: true; before: number; after: number } | { ok: false; error: string };

/** Re-calculates one person's line with the adjustments applied, saves it, and brings the month's
 * totals and PAYE/SSNIT filing hints back in line. Only for a month still awaiting approval. */
export function recalculateStaffLine(input: EditLineInput): EditLineResult {
  const { builder, runtimeId, period, record, employee, adjustments, complianceCountry } = input;
  if (period.status !== 'processing' && period.status !== 'draft') return { ok: false, error: 'Approved payroll can no longer be changed.' };
  if (!employee) return { ok: false, error: 'This staff member is no longer in the system, so their line cannot be recalculated.' };
  const my = monthYearOf(period);
  if (!my) return { ok: false, error: 'Could not work out which month this payroll is for.' };

  const r = calculateStaff({ builder, runtimeId, month: my.month, year: my.year }, employee, approvedOvertimeFor(record.employeeId, my.month, my.year), adjustments);
  const { updatePayrollRecord, updatePayrollPeriod } = usePayrollStore.getState();
  const changedAt = new Date().toISOString();
  updatePayrollRecord(record.id, {
    ...r.fields,
    // keep the original payment method / account choice
    paymentMethod: record.paymentMethod,
    notes: JSON.stringify({ source: 'Monthly payroll run', adjustments: { ...adjustments, editedAt: changedAt } }),
  } as any);

  // Month totals, from every record as they now stand.
  const records = usePayrollStore.getState().payrollRecords.filter((x) => x.payrollPeriodId === period.id);
  const sum = (pick: (x: PayrollRecord) => number) => records.reduce((s, x) => s + pick(x), 0);
  const tax = sum((x) => x.deductions.tax);
  const ssnitEmployee = sum((x) => x.deductions.socialSecurity);
  const split = readEmployerSplit(period);
  updatePayrollPeriod(period.id, {
    totalGrossPay: sum((x) => x.grossPay),
    totalNetPay: sum((x) => x.netPay),
    totalTaxes: tax,
    totalDeductions: sum((x) => x.deductions.socialSecurity + x.deductions.pension + (x.deductions.tier3 || 0) + x.deductions.healthInsurance + x.deductions.other),
  } as any);
  syncPayrollRunToComplianceFiling({
    countryCode: complianceCountry,
    period: `${my.year}-${String(my.month).padStart(2, '0')}`,
    payeTotal: tax,
    ssnitTotal: Math.round((ssnitEmployee + split.tier1) * 100) / 100,
    employeeCount: records.length,
  });
  return { ok: true, before: record.netPay, after: r.fields.netPay };
}

function readEmployerSplit(period: Pick<PayrollPeriod, 'notes'>) {
  const empty = { total: 0, tier1: 0, tier2: 0 };
  try {
    const n = period.notes ? JSON.parse(period.notes) : {};
    const total = typeof n.employerContribution === 'number' ? n.employerContribution : 0;
    if (typeof n.tier1Employer === 'number' || typeof n.tier2Employer === 'number') {
      return { total, tier1: Number(n.tier1Employer || 0), tier2: Number(n.tier2Employer || 0) };
    }
    // Older runs stored one employer figure. It was posted entirely to Tier 1.
    return { total, tier1: total, tier2: 0 };
  } catch {
    return empty;
  }
}

/** The ledger entry for an approved month. Salary expense and the employer's statutory cost
 * are debited. PAYE, Tier 1, Tier 2, Tier 3, other withholdings, and the actual net pay are
 * credited separately so the amount owed to staff matches the payslips.
 * Returns undefined for a month with nothing to post. */
export function buildPayrollJournal(period: PayrollPeriod, records: PayrollRecord[]): JournalEntry | undefined {
  const round2 = (n: number) => Math.round(n * 100) / 100;
  const sum = (pick: (r: PayrollRecord) => number) => records.reduce((s, r) => s + (pick(r) || 0), 0);
  const grossExpense = round2(sum((r) => r.grossPay));
  if (grossExpense <= 0) return undefined;
  const payeAmount = round2(sum((r) => r.deductions.tax));
  const tier1Employee = round2(sum((r) => r.deductions.socialSecurity));
  const tier2Employee = round2(sum((r) => r.deductions.pension));
  const tier3Amount = round2(sum((r) => r.deductions.tier3 || 0));
  const otherAmount = round2(sum((r) => r.deductions.other + (r.deductions.healthInsurance || 0)));
  const accruedNetPay = round2(sum((r) => r.netPay));
  const split = readEmployerSplit(period);
  const employer = round2(split.total);
  const tier1Payable = round2(tier1Employee + split.tier1);
  const tier2Payable = round2(tier2Employee + split.tier2);
  const totalDebit = round2(grossExpense + employer);
  const totalCredit = round2(payeAmount + tier1Payable + tier2Payable + tier3Amount + otherAmount + accruedNetPay);

  const now = new Date().toISOString();
  const entryId = `JE-PAYROLL-${period.id}`;
  const ref = period.periodNumber;
  const line = (suffix: string, accountCode: string, description: string, debit: number, credit: number) => ({
    id: `JL-${entryId}-${suffix}`, journalEntryId: entryId, accountCode, description, debit, credit, currency: 'GHS', reference: ref,
  });
  return {
    id: entryId,
    entryNumber: `JE-PR-${ref}`,
    date: now,
    reference: ref,
    description: `Payroll run — ${ref} (${records.length} employees)`,
    totalDebit,
    totalCredit,
    currency: 'GHS',
    status: 'Draft',
    createdAt: now,
    updatedAt: now,
    sourceModule: 'payroll',
    sourceTransactionId: period.id,
    lines: [
      line('salaries', '5210', `Gross pay — ${ref}`, grossExpense, 0),
      ...(employer > 0 ? [line('employercost', '5221', `Employer statutory contributions — ${ref}`, employer, 0)] : []),
      ...(payeAmount > 0 ? [line('paye', '2210', `PAYE withheld — ${ref}`, 0, payeAmount)] : []),
      ...(tier1Payable > 0 ? [line('tier1', '2220', `Tier 1 due (employee + employer) — ${ref}`, 0, tier1Payable)] : []),
      ...(tier2Payable > 0 ? [line('tier2', '2225', `Tier 2 occupational pension — ${ref}`, 0, tier2Payable)] : []),
      ...(tier3Amount > 0 ? [line('tier3', '2221', `Tier 3 provident fund — ${ref}`, 0, tier3Amount)] : []),
      ...(otherAmount > 0 ? [line('other', '2230', `Other staff deductions — ${ref}`, 0, otherAmount)] : []),
      line('accrued', '2300', `Net pay accrued — ${ref}`, 0, accruedNetPay),
    ],
  };
}
