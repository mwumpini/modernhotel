import { useComplianceStore } from '../compliance/store';

type Rule = { rate?: number } | undefined;

/**
 * One employee's month at today's rates, before any payroll is prepared. Shared by the
 * Payroll preview and the Employee Records table so both always show the same figures.
 * Tier 1 is on basic salary and comes off before PAYE; Tier 2 is employer-funded (0%
 * employee by default); Tier 3 is the employee's own voluntary rate. Only an explicit
 * "No" on the staff file skips a contribution or PAYE.
 */
export function estimateMonthlyPay(e: Record<string, any>, rules: { tier1?: Rule; tier2?: Rule }) {
  const salary = e.salary ?? e.baseSalary ?? 0;
  const basic = Number(e.basicSalary ?? salary ?? 0);
  const allowances = Number(e.allowances ?? 0);
  const gross = basic + allowances;
  const tier1 = e.ssnitEnrolled === true ? round2(basic * ((rules.tier1?.rate ?? 5.5) / 100)) : 0;
  const tax = e.incomeTaxDeductible !== false
    ? round2(
        useComplianceStore.getState()
          .calculateTax(Math.max(0, gross - tier1), 'PAYE', { domain: 'payroll', operation: 'internal' })
          .taxes.reduce((s, t) => s + t.amount, 0),
      )
    : 0;
  const tier2 = e.tier2Enrolled === true ? round2(basic * ((rules.tier2?.rate ?? 0) / 100)) : 0;
  const tier3 = e.tier3Enrolled === true ? round2(gross * (Number(e.tier3ContributionPct || 0) / 100)) : 0;
  return { basic, allowances, gross, tax, tier1, tier2, tier3, net: round2(gross - tax - tier1 - tier2 - tier3) };
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
