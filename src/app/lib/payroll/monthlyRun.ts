import type UniversalPayrollBuilder from './builder';
import { useEmployeeStore } from '../hr/employeeStore';
import { usePayrollStore } from '../hr/payrollStore';
import { useLeaveAttendanceStore } from '../hr/leaveAttendanceStore';
import { useComplianceStore } from '../compliance/store';
import { useAccountingStore } from '../accounting/store';
import { syncPayrollRunToComplianceFiling } from '../compliance/payrollSync';
import type { PayrollPeriod } from '../hr/models';

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

/** Processes payroll for every active employee for one month: calculates each person's pay,
 * saves the period and its records (awaiting approval), files the PAYE/SSNIT hints and prepares
 * the ledger entry as a Draft. Nothing is approved or paid here. */
export function runMonthlyPayroll(input: MonthlyRunInput): MonthlyRunResult {
  const { builder, runtimeId, employees, periods: payrollPeriods, month: runMonth, year: runYear, overtimeOverrides, userName, complianceCountry } = input;
  const { createPayrollPeriod, createPayrollRecord, updatePayrollPeriod } = usePayrollStore.getState();
  const approvedOvertimeHours = (eid: string) =>
    useLeaveAttendanceStore.getState().getApprovedOvertimeHours(eid, new Date(runYear, runMonth - 1, 1), new Date(runYear, runMonth, 0));

    // Use active employees only
    const activeEmployees = (employees || []).filter((e: any) => e.status === 'active');
    if (activeEmployees.length === 0) {
      return { ok: false, error: 'No active employees to process.' };
    }
    // Create payroll period
    const periodNumber = `PP-${runYear}-${String(runMonth).padStart(2, '0')}`;
    const existingPeriod = (payrollPeriods || []).find((p: any) => p.periodNumber === periodNumber);
    if (existingPeriod) {
      return { ok: false, error: `Payroll for ${periodNumber} has already been processed (status: ${existingPeriod.status}), so it can't be run again — that would double-count every employee's pay.` };
    }
    const period = createPayrollPeriod({
      periodNumber,
      startDate: new Date(runYear, runMonth - 1, 1),
      endDate: new Date(runYear, runMonth, 0),
      status: 'processing',
      totalGrossPay: 0,
      totalNetPay: 0,
      totalDeductions: 0,
      totalTaxes: 0,
      employeeCount: activeEmployees.length,
      processedBy: userName,
    } as any);

    // Prepare config with benefits as runtime add-ons per employee (from HR form values if present)
    const baseCfg = JSON.parse(JSON.stringify((builder as any).payrollConfigs.get(runtimeId)));
    (builder as any).payrollConfigs.set(runtimeId, baseCfg);

    // Tier 1/Tier 2 are tracked as fully separate rules (different institutions), each
    // independently renameable — so downstream code must match on the rule's stable id,
    // never its (user-editable) display name.
    const tier1Rule = useComplianceStore.getState().taxRules.find(
      (r) => r.countryCode === 'GH' && r.domain === 'payroll' && (r.appliesTo || []).includes('TIER1')
    );
    const tier2Rule = useComplianceStore.getState().taxRules.find(
      (r) => r.countryCode === 'GH' && r.domain === 'payroll' && (r.appliesTo || []).includes('TIER2')
    );

    const totals = { gross: 0, net: 0, tax: 0, ssnit: 0, employerTax: 0, deductions: 0 } as any;
    activeEmployees.forEach((emp: any) => {
      // Create or update employee profile for the run
      const eid = emp.id || emp.employeeNumber || `EMP-${Math.floor(Math.random() * 10000)}`;
      const prof = (builder as any).employeeProfiles.get(eid) || builder.createEmployee({
        id: eid,
        employeeId: emp.employeeNumber || eid,
        firstName: emp.firstName, lastName: emp.lastName, email: emp.email,
        employment: { type: emp.employmentType || 'full_time', department: emp.departmentId, position: emp.positionId, salary: Number((emp as any).basicSalary ?? (emp as any).salary ?? 0), currency: ((builder as any).payrollConfigs.get(runtimeId)?.currency || 'GHS'), hourlyRate: Number((emp as any).hourlyRate || 0) },
        taxInfo: { filingStatus: (emp as any).taxWithholding?.filingStatus || 'single', allowances: Number((emp as any).taxWithholding?.allowances || 0) }
      });
      // Inject allowances & benefits as earnings
      const runtimeConfig = JSON.parse(JSON.stringify(baseCfg));
      runtimeConfig.earnings = runtimeConfig.earnings || [];
      runtimeConfig.earnings = runtimeConfig.earnings.filter((c: any) => !['ALLOWANCE','VEHICLE_BENEFIT','HOUSING_BENEFIT','OTHER_NON_CASH'].includes(c.code));
      const allowances = Number((emp as any).allowances || 0);
      if (allowances > 0) runtimeConfig.earnings.push({ name: 'Allowance', code: 'ALLOWANCE', calculationType: 'fixed', amount: allowances, taxable: false });
      const vehicle = Number((emp as any).vehicleBenefit || 0);
      if (vehicle > 0) runtimeConfig.earnings.push({ name: 'Vehicle Benefit', code: 'VEHICLE_BENEFIT', calculationType: 'fixed', amount: vehicle, taxable: true });
      const housing = Number((emp as any).housingBenefit || 0);
      if (housing > 0) runtimeConfig.earnings.push({ name: 'Housing Benefit', code: 'HOUSING_BENEFIT', calculationType: 'fixed', amount: housing, taxable: true });
      const other = Number((emp as any).otherNonCashBenefits || 0);
      if (other > 0) runtimeConfig.earnings.push({ name: 'Other Non-Cash Benefits', code: 'OTHER_NON_CASH', calculationType: 'fixed', amount: other, taxable: true });

      // Tier 3 (voluntary provident fund) — a real, employee-elected pre-tax deduction,
      // fully separate from Tier 1/Tier 2 (own institution, own election). Only applied
      // when the employee opted in with a contribution rate; capped at the statutory
      // relief ceiling. The rule's own (renameable) name is used for the deduction label
      // so a rename actually shows up on payslips instead of a hardcoded string.
      runtimeConfig.deductions = (runtimeConfig.deductions || []).filter((d: any) => d.code !== 'TIER3_EMP');
      const tier3Pct = Number((emp as any).tier3Enrolled ? (emp as any).tier3ContributionPct || 0 : 0);
      const tier3CapRule = useComplianceStore.getState().taxRules.find(
        (r) => r.countryCode === 'GH' && r.domain === 'payroll' && (r.appliesTo || []).includes('TIER3_RELIEF_CAP')
      );
      if (tier3Pct > 0) {
        const basicSalary = Number((emp as any).basicSalary ?? (emp as any).salary ?? 0);
        const grossForTier3 = basicSalary + Number((emp as any).allowances || 0);
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
      (builder as any).payrollConfigs.set(runtimeId, runtimeConfig);

      const adjustments = { hours: { OVERTIME: Number(overtimeOverrides?.[eid] ?? approvedOvertimeHours(eid)) } };
      const calc = (builder as any).calculatePayroll(eid, runtimeId, { month: runMonth, year: runYear }, adjustments);
      totals.gross += calc.summary.gross;
      totals.net += calc.summary.net;
      totals.tax += calc.taxes.employee;
      const ssnitAmt = calc.taxes.items.filter((t: any) => t.type === 'social').reduce((s: number, t: any) => s + (t.amount || 0), 0);
      totals.ssnit += ssnitAmt;
      totals.employerTax += calc.taxes.employer || 0;
      const deductionsSum = (calc.deductions?.total || 0);
      totals.deductions += deductionsSum;

      const tier1Amount = tier1Rule ? (calc.taxes.items.find((t: any) => t.ruleId === tier1Rule.id)?.amount || 0) : 0;
      const tier2Amount = tier2Rule ? (calc.taxes.items.find((t: any) => t.ruleId === tier2Rule.id)?.amount || 0) : 0;
      const tier3Amount = calc.deductions.items.find((d: any) => d.component?.code === 'TIER3_EMP')?.amount || 0;
      const overtimePay = calc.earnings.items.find((i: any) => i.component?.code === 'OVERTIME')?.amount || 0;

      // Persist payroll record to store
      createPayrollRecord({
        payrollPeriodId: period.id,
        employeeId: eid,
        employeeNumber: emp.employeeNumber || '',
        employeeName: `${emp.firstName} ${emp.lastName}`,
        department: useEmployeeStore.getState().getDepartment(emp.departmentId)?.name ?? 'Unassigned',
        position: useEmployeeStore.getState().getPosition(emp.positionId)?.title ?? 'Unassigned',
        basicSalary: Number((emp as any).basicSalary ?? (emp as any).salary ?? 0),
        allowances: allowances,
        overtimePay,
        bonuses: 0,
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
          other: Math.max(deductionsSum - calc.taxes.employee - tier1Amount - tier2Amount - tier3Amount, 0)
        },
        netPay: calc.summary.net,
        bankAccount: emp.bankAccount?.accountNumber || '',
        paymentMethod: 'bank_transfer',
        // Calculated, not yet approved or paid — that happens in Payroll Processing → Staff Payroll.
        status: 'processed',
        notes: 'Monthly payroll run'
      } as any);
    });

    // Update period totals
    updatePayrollPeriod(period.id, {
      status: 'processing', // awaiting approval
      totalGrossPay: totals.gross,
      totalNetPay: totals.net,
      totalDeductions: totals.deductions,
      totalTaxes: totals.tax,
      processedAt: new Date(),
      processedBy: userName,
    } as any);

    syncPayrollRunToComplianceFiling({
      countryCode: complianceCountry,
      period: `${runYear}-${String(runMonth).padStart(2, '0')}`,
      payeTotal: totals.tax,
      ssnitTotal: totals.ssnit,
      employeeCount: activeEmployees.length,
    });

    // Prepare the GL entry — previously payroll never touched the ledger at all, so
    // Salary Expense/PAYE/SSNIT payables and the accrued net-pay liability permanently
    // omitted the largest opex line from every financial report. The "Accrued Expenses"
    // credit is a residual (gross − PAYE − SSNIT) rather than a hardcoded totals.net, so
    // the entry balances exactly even if some employee has other post-tax deductions
    // this run's totals don't itemize separately.
    let warning: string | undefined;
    if (totals.gross > 0) {
      try {
        const accountingStore = useAccountingStore.getState();
        const now = new Date().toISOString();
        const entryId = `JE-PAYROLL-${period.id}`;
        const round2 = (n: number) => Math.round(n * 100) / 100;
        const grossExpense = round2(totals.gross);
        const employerTax = round2(totals.employerTax);
        const payeAmount = round2(totals.tax);
        const ssnitPayable = round2(totals.ssnit + totals.employerTax);
        const accruedNetPay = round2(totals.gross - totals.tax - totals.ssnit);
        const totalDebit = round2(grossExpense + employerTax);
        const totalCredit = round2(payeAmount + ssnitPayable + accruedNetPay);

        accountingStore.addJournalEntry({
          id: entryId,
          entryNumber: `JE-PR-${periodNumber}`,
          date: now,
          reference: periodNumber,
          description: `Payroll run — ${periodNumber} (${activeEmployees.length} employees)`,
          totalDebit,
          totalCredit,
          currency: 'GHS',
          // Prepared now with this run's exact figures (including employer contributions), but
          // only posted to the ledger once the run is approved — see Payroll Processing.
          status: 'Draft',
          createdAt: now,
          updatedAt: now,
          sourceModule: 'payroll',
          sourceTransactionId: period.id,
          lines: [
            {
              id: `JL-${entryId}-salaries`,
              journalEntryId: entryId,
              accountCode: '5210', // Salaries and Wages
              description: `Gross pay — ${periodNumber}`,
              debit: grossExpense,
              credit: 0,
              currency: 'GHS',
              reference: periodNumber,
            },
            ...(employerTax > 0 ? [{
              id: `JL-${entryId}-employercost`,
              journalEntryId: entryId,
              accountCode: '5220', // Employee Benefits (employer-side statutory cost)
              description: `Employer statutory contributions — ${periodNumber}`,
              debit: employerTax,
              credit: 0,
              currency: 'GHS',
              reference: periodNumber,
            }] : []),
            ...(payeAmount > 0 ? [{
              id: `JL-${entryId}-paye`,
              journalEntryId: entryId,
              accountCode: '2210', // PAYE Payable
              description: `PAYE withheld — ${periodNumber}`,
              debit: 0,
              credit: payeAmount,
              currency: 'GHS',
              reference: periodNumber,
            }] : []),
            ...(ssnitPayable > 0 ? [{
              id: `JL-${entryId}-ssnit`,
              journalEntryId: entryId,
              accountCode: '2220', // SSNIT & Tier-1 Contributions Payable
              description: `SSNIT due (employee + employer) — ${periodNumber}`,
              debit: 0,
              credit: ssnitPayable,
              currency: 'GHS',
              reference: periodNumber,
            }] : []),
            {
              id: `JL-${entryId}-accrued`,
              journalEntryId: entryId,
              accountCode: '2300', // Accrued Expenses (net pay owed to employees)
              description: `Net pay accrued — ${periodNumber}`,
              debit: 0,
              credit: accruedNetPay,
              currency: 'GHS',
              reference: periodNumber,
            },
          ],
        });
      } catch (e) {
        console.error('[Payroll] Failed to post payroll journal entry:', e);
        warning = 'Payroll was processed, but preparing its general ledger entry failed. Please notify accounting.';
      }
    }

    return { ok: true, employeeCount: activeEmployees.length, periodId: period.id, warning };
}
