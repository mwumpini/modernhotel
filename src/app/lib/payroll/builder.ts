/* eslint-disable @typescript-eslint/no-explicit-any */
// Universal Payroll Builder - integrated as a library module

import { useComplianceStore } from '../compliance/store';

// Currency amounts are never fractions of a pesewa — without a final rounding pass,
// chained percentage math accumulates float artifacts like 123.44999999999998 by the time
// a total reaches a payslip.
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Ghana PAYE/Tier 1/Tier 2/Tier 3 rates live in the compliance engine (tax rules with
 * domain:'payroll', countryCode:'GH', ids gh-paye/gh-ssnit-tier1/gh-ssnit-tier2/
 * gh-tier3-relief-cap — see seed-taxes.json) instead of a static config file, so a rate
 * change (GRA revises PAYE bands, SSNIT revises the ceiling) is an edit in
 * Settings → Tax Rate Builder, not a code change. Tier 1 and Tier 2 are tracked as fully
 * separate rules — not a combined SSNIT figure split for reporting — because they're
 * remitted to different institutions (Tier 1 to SSNIT, Tier 2 to a private occupational
 * trustee); each can be independently renamed (e.g. Tier 1 → "SSNIT") without affecting the
 * other or the calculation. Requires the compliance store to have loaded GH rules —
 * callers must await useComplianceStore.getState().setCountry('GH') (or
 * syncCountryFromSetup()) before running Ghana payroll; if no rules are loaded, these
 * helpers return a zero result rather than silently falling back to guessed numbers.
 */
function findGhanaTaxRule(appliesToTag: string) {
  const rules = useComplianceStore.getState().taxRules;
  return rules.find(
    (r) => r.countryCode === 'GH' && r.domain === 'payroll' && (r.appliesTo || []).includes(appliesToTag)
  );
}

export default class UniversalPayrollBuilder {
  payrollConfigs: Map<string, any>;
  employeeProfiles: Map<string, any>;
  countryTemplates: Map<string, any>;

  constructor() {
    this.payrollConfigs = new Map();
    this.employeeProfiles = new Map();
    this.countryTemplates = new Map();
    this.initializeDefaultTemplates();
  }

  // ==================== CORE DATA MODELS ====================

  createPayrollConfig(config: any) {
    const payrollConfig = {
      id: config.id || this.generateId('config'),
      name: config.name,
      country: config.country,
      currency: config.currency,
      payFrequency: config.payFrequency || 'monthly',
      calculationMethod: config.calculationMethod || 'standard',
      earnings: config.earnings || [],
      deductions: config.deductions || [],
      taxConfig: config.taxConfig || {},
      socialSecurity: config.socialSecurity || {},
      statutory: config.statutory || {},
      customRules: config.customRules || [],
      metadata: { created: new Date().toISOString(), modified: new Date().toISOString(), version: '1.0' }
    };
    this.payrollConfigs.set(payrollConfig.id, payrollConfig);
    return payrollConfig;
  }

  createEmployee(employeeData: any) {
    const employee = {
      id: employeeData.id || this.generateId('emp'),
      employeeId: employeeData.employeeId,
      firstName: employeeData.firstName,
      lastName: employeeData.lastName,
      email: employeeData.email,
      hireDate: employeeData.hireDate,
      employment: {
        type: employeeData.employment?.type || 'full-time',
        department: employeeData.employment?.department,
        position: employeeData.employment?.position,
        salary: employeeData.employment?.salary || 0,
        currency: employeeData.employment?.currency || 'USD',
        hourlyRate: employeeData.employment?.hourlyRate || 0
      },
      taxInfo: {
        taxId: employeeData.taxInfo?.taxId,
        filingStatus: employeeData.taxInfo?.filingStatus,
        allowances: employeeData.taxInfo?.allowances || 0,
        additionalWithholding: employeeData.taxInfo?.additionalWithholding || 0
      },
      benefits: employeeData.benefits || [],
      bankInfo: employeeData.bankInfo || {},
      customFields: employeeData.customFields || {},
      metadata: { created: new Date().toISOString(), active: true }
    };
    this.employeeProfiles.set(employee.id, employee);
    return employee;
  }

  // ==================== BUILDERS ====================
  createEarningComponent(config: any) {
    return {
      type: 'earning',
      id: config.id || this.generateId('earn'),
      name: config.name,
      code: config.code,
      category: config.category || 'regular',
      calculationType: config.calculationType || 'fixed',
      amount: config.amount || 0,
      rate: config.rate || 0,
      unit: config.unit || 'currency',
      taxable: config.taxable !== false,
      appliesTo: config.appliesTo || 'all',
      conditions: config.conditions || [],
      formula: config.formula || null,
      limits: config.limits || {},
      metadata: { created: new Date().toISOString() }
    };
  }

  createTaxConfig(config: any) {
    return {
      id: config.id || this.generateId('tax'),
      name: config.name,
      type: config.type || 'income',
      authority: config.authority,
      calculationMethod: config.calculationMethod || 'progressive',
      brackets: config.brackets || [],
      rates: config.rates || {},
      allowances: config.allowances || {},
      credits: config.credits || [],
      filingStatuses: config.filingStatuses || ['single', 'married'],
      metadata: { created: new Date().toISOString() }
    };
  }

  createSocialSecurityConfig(config: any) {
    return {
      id: config.id || this.generateId('ss'),
      name: config.name,
      type: config.type || 'pension',
      employeeRate: config.employeeRate || 0,
      employerRate: config.employerRate || 0,
      ceiling: config.ceiling || null,
      floor: config.floor || 0,
      calculationBase: config.calculationBase || 'gross',
      includes: config.includes || ['basic', 'allowances'],
      excludes: config.excludes || ['bonus', 'overtime'],
      // Optional: reporting split of a mandatory scheme into sub-tiers (e.g. Ghana SSNIT's
      // Tier 1 / Tier 2 split — see ghana.json), and voluntary-scheme metadata (Tier 3).
      tier1SplitOfTotalPct: config.tier1SplitOfTotalPct,
      tier2SplitOfTotalPct: config.tier2SplitOfTotalPct,
      isVoluntary: config.isVoluntary || false,
      reliefCapPct: config.reliefCapPct,
      metadata: { created: new Date().toISOString() }
    };
  }

  // ==================== ENGINE ====================
  calculatePayroll(employeeId: string, payrollConfigId: string, period: any, adjustments: any = {}) {
    const employee = this.employeeProfiles.get(employeeId);
    const config = this.payrollConfigs.get(payrollConfigId);
    if (!employee) throw new Error(`Employee ${employeeId} not found`);
    if (!config) throw new Error(`Payroll config ${payrollConfigId} not found`);

    const payrollResult: any = {
      employee, config, period,
      calculationDate: new Date().toISOString(),
      earnings: { items: [], total: 0, taxable: 0 },
      deductions: { items: [], total: 0, pretax: 0, posttax: 0 },
      taxes: { items: [], total: 0, employee: 0, employer: 0 },
      summary: { gross: 0, taxable: 0, net: 0, employerCost: 0 },
      breakdown: {}
    };

    try {
      this.calculateEarnings(payrollResult, employee, config, adjustments);
      this.calculatePreTaxDeductions(payrollResult, employee, config);
      payrollResult.summary.taxable = round2(payrollResult.earnings.taxable - payrollResult.deductions.pretax);
      this.calculateTaxes(payrollResult, employee, config);
      this.calculatePostTaxDeductions(payrollResult, employee, config);
      // Net = everything earned, less pre-tax deductions, less income tax, less post-tax
      // deductions. `summary.taxable` leaves out NON-taxable earnings (e.g. an allowance), so
      // add those back — otherwise they are counted in gross but never paid out in net.
      payrollResult.summary.net = round2(
        payrollResult.summary.taxable + (payrollResult.earnings.total - payrollResult.earnings.taxable) - payrollResult.taxes.employee - payrollResult.deductions.posttax,
      );
      this.calculateEmployerCosts(payrollResult, employee, config);
      payrollResult.summary.gross = round2(payrollResult.summary.gross);
      payrollResult.summary.employerCost = round2(payrollResult.summary.employerCost);
      payrollResult.deductions.pretax = round2(payrollResult.deductions.pretax);
      payrollResult.deductions.posttax = round2(payrollResult.deductions.posttax);
      payrollResult.deductions.total = round2(payrollResult.deductions.total);
      payrollResult.taxes.employee = round2(payrollResult.taxes.employee);
      payrollResult.taxes.employer = round2(payrollResult.taxes.employer);
      payrollResult.taxes.total = round2(payrollResult.taxes.total);
      return payrollResult;
    } catch (e: any) {
      throw new Error(`Payroll calculation failed: ${e.message}`);
    }
  }

  calculateEarnings(payrollResult: any, employee: any, config: any, adjustments: any) {
    let totalEarnings = 0;
    let taxableEarnings = 0;
    config.earnings.forEach((earning: any) => {
      if (this.shouldApplyComponent(earning, employee)) {
        const amount = round2(this.calculateEarningAmount(earning, employee, adjustments));
        if (amount > 0) {
          payrollResult.earnings.items.push({ component: earning, amount, taxable: earning.taxable });
          totalEarnings += amount;
          if (earning.taxable) taxableEarnings += amount;
        }
      }
    });
    const basicSalary = employee.employment.salary;
    payrollResult.earnings.items.push({ component: { name: 'Basic Salary', code: 'BASIC', taxable: true }, amount: basicSalary, taxable: true });
    totalEarnings += basicSalary;
    taxableEarnings += basicSalary;
    payrollResult.earnings.total = totalEarnings;
    payrollResult.earnings.taxable = taxableEarnings;
    payrollResult.summary.gross = totalEarnings;
  }

  calculateEarningAmount(earning: any, employee: any, adjustments: any) {
    switch (earning.calculationType) {
      case 'fixed':
        return earning.amount;
      case 'percentage':
        return employee.employment.salary * (earning.rate / 100);
      case 'hourly': {
        // earning.rate is a multiplier (e.g. 1.5x for overtime), not a currency rate — it
        // must be applied on top of the employee's actual hourly wage, not used alone
        // (hours * 1.5 previously produced a near-zero amount regardless of salary). If no
        // hourly rate is on file, this pays 0 rather than guessing one from salary.
        const recorded = adjustments.hours?.[earning.code];
        const hours = recorded == null ? earning.amount : recorded;
        const hourlyWage = employee.employment.hourlyRate || 0;
        return hours * hourlyWage * earning.rate;
      }
      case 'formula':
        return earning.formula ? this.evaluateFormula(earning.formula, { salary: employee.employment.salary, ...adjustments }) : 0;
      default:
        return earning.amount;
    }
  }

  calculatePreTaxDeductions(payrollResult: any, employee: any, config: any) {
    let preTaxTotal = 0;

    if (config.country === 'GH') {
      // Tier 1 and Tier 2 must be deducted before PAYE is computed (they're genuine
      // pre-tax deductions under Ghana law) and their base is BASIC SALARY ONLY —
      // allowances, bonuses, and overtime are excluded (SSNIT's own "insurable earnings"
      // definition). Each is its own rule/institution (see findGhanaTaxRule's doc comment
      // above), computed and stored separately here; calculateTaxes() below reuses both
      // results instead of recomputing them.
      for (const tag of ['TIER1', 'TIER2'] as const) {
        const rule = findGhanaTaxRule(tag);
        if (!rule) {
          console.warn(`[Payroll] No GH ${tag} tax rule loaded from the compliance store — not withheld. Call useComplianceStore.getState().setCountry("GH") before running Ghana payroll.`);
          continue;
        }
        const result = useComplianceStore
          .getState()
          .calculateTax(employee.employment.salary, tag, { domain: 'payroll', operation: 'internal' });
        const line = result.taxes.find((t) => t.ruleId === rule.id);
        if (!line) {
          console.warn(`[Payroll] GH ${tag} rule is loaded but calculateTax() returned no matching line (check the rule's enabled/effectiveFrom/effectiveTo/appliesTo/domain/operation fields) — not withheld.`);
        } else if (line.amount > 0) {
          payrollResult.deductions.items.push({
            component: { name: line.name, code: `${tag}_EMP` },
            amount: line.amount,
            type: 'pre-tax',
          });
          preTaxTotal += line.amount;
        }
        payrollResult[tag === 'TIER1' ? '_ghanaTier1' : '_ghanaTier2'] = line;
      }

      // Tier 3 (voluntary provident fund) isn't a statutory rate — it's an employee-elected
      // contribution the caller injects into config.deductions at runtime (see
      // PayrollBuilderPanel.tsx), already capped against the compliance-sourced relief
      // ceiling. Process it (and anything else a caller adds here) the same way non-Ghana
      // countries process their deductions array.
      (config.deductions || [])
        .filter((ded: any) => ded.base === 'gross' || ded.base === 'taxable')
        .forEach((deduction: any) => {
          if (this.shouldApplyComponent(deduction, payrollResult.employee)) {
            const base = deduction.base === 'gross' ? payrollResult.summary.gross : payrollResult.summary.taxable;
            const amount = this.calculateDeductionAmount(deduction, base);
            if (amount > 0) {
              payrollResult.deductions.items.push({ component: deduction, amount, type: 'pre-tax' });
              preTaxTotal += amount;
            }
          }
        });
    } else {
      config.deductions
        .filter((ded: any) => ded.base === 'gross' || ded.base === 'taxable')
        .forEach((deduction: any) => {
          if (this.shouldApplyComponent(deduction, payrollResult.employee)) {
            const base = deduction.base === 'gross' ? payrollResult.summary.gross : payrollResult.summary.taxable;
            const amount = this.calculateDeductionAmount(deduction, base);
            if (amount > 0) {
              payrollResult.deductions.items.push({ component: deduction, amount, type: 'pre-tax' });
              preTaxTotal += amount;
            }
          }
        });
    }

    payrollResult.deductions.pretax = preTaxTotal;
  }

  calculateTaxes(payrollResult: any, employee: any, config: any) {
    let employeeTaxTotal = 0;
    let employerTaxTotal = 0;

    if (config.country === 'GH') {
      const payeRule = findGhanaTaxRule('PAYE');
      if (payeRule) {
        const result = useComplianceStore
          .getState()
          .calculateTax(payrollResult.summary.taxable, 'PAYE', { domain: 'payroll', operation: 'internal' });
        const line = result.taxes.find((t) => t.ruleId === payeRule.id);
        if (!line) {
          console.warn('[Payroll] GH PAYE rule is loaded but calculateTax() returned no matching line (check the rule\'s enabled/effectiveFrom/effectiveTo/appliesTo/domain/operation fields) — income tax not withheld.');
        }
        const payeAmount = line?.amount || 0;
        payrollResult.taxes.items.push({ type: 'income', name: payeRule.name, ruleId: payeRule.id, amount: payeAmount, employerAmount: 0 });
        employeeTaxTotal += payeAmount;
      } else {
        console.warn('[Payroll] No GH PAYE tax rule loaded from the compliance store — income tax not withheld.');
      }

      // Reuse the Tier 1/Tier 2 results already computed in calculatePreTaxDeductions (same
      // employee, same period) instead of recomputing them — one source of truth, and
      // avoids the calls ever silently disagreeing. Pushed as two independent line items
      // (not a combined figure) so each keeps its own name/ruleId for downstream code and
      // payslips — a rename of one never affects the other.
      for (const key of ['_ghanaTier1', '_ghanaTier2'] as const) {
        const tier = payrollResult[key];
        if (tier) {
          payrollResult.taxes.items.push({
            type: 'social',
            name: tier.name,
            ruleId: tier.ruleId,
            amount: tier.amount,
            employerAmount: tier.employerAmount || 0,
          });
          employerTaxTotal += tier.employerAmount || 0;
        }
        delete payrollResult[key];
      }
    } else {
      if (config.taxConfig?.income) {
        const incomeTax = this.calculateIncomeTax(payrollResult.summary.taxable, employee.taxInfo, config.taxConfig.income);
        payrollResult.taxes.items.push({ type: 'income', name: 'Income Tax', amount: incomeTax.employee, employerAmount: incomeTax.employer || 0 });
        employeeTaxTotal += incomeTax.employee;
        employerTaxTotal += incomeTax.employer || 0;
      }
      if (config.socialSecurity) {
        Object.values(config.socialSecurity).forEach((ssConfig: any) => {
          const ssTax = this.calculateSocialSecurityTax(payrollResult.summary.gross, ssConfig);
          // Report the real employee-side amount (payslip breakdowns, compliance filing,
          // and analytics all read taxes.items for the actual withheld figure) but do NOT
          // fold it into employeeTaxTotal — it's already subtracted from taxable pay as a
          // pre-tax deduction (see calculatePreTaxDeductions / config.deductions), and
          // employeeTaxTotal feeds directly into the net-pay formula below. Adding it here
          // too would double-deduct it from net pay.
          const item: any = { type: 'social', name: ssConfig.name, amount: ssTax.employee, employerAmount: ssTax.employer };
          if (typeof ssConfig.tier1SplitOfTotalPct === 'number' && typeof ssConfig.tier2SplitOfTotalPct === 'number') {
            const splitBase = ssConfig.tier1SplitOfTotalPct + ssConfig.tier2SplitOfTotalPct;
            const totalContribution = ssTax.employee + ssTax.employer;
            if (splitBase > 0) {
              item.tier1Amount = totalContribution * (ssConfig.tier1SplitOfTotalPct / splitBase);
              item.tier2Amount = totalContribution * (ssConfig.tier2SplitOfTotalPct / splitBase);
            }
          }
          payrollResult.taxes.items.push(item);
          employerTaxTotal += ssTax.employer;
        });
      }
    }

    // A flat extra amount the employee/employer elected to withhold on top of the statutory
    // calculation above (garnishment, employee-requested top-up, etc.) -- country-agnostic,
    // so it applies regardless of which branch computed the statutory tax. Previously captured
    // in the UI and saved onto the employee record but never read here at all.
    const additionalWithholding = Number(employee?.taxInfo?.additionalWithholding || 0);
    if (additionalWithholding > 0) {
      payrollResult.taxes.items.push({ type: 'income', name: 'Additional Withholding', amount: additionalWithholding, employerAmount: 0 });
      employeeTaxTotal += additionalWithholding;
    }

    payrollResult.taxes.employee = employeeTaxTotal;
    payrollResult.taxes.employer = employerTaxTotal;
    payrollResult.taxes.total = employeeTaxTotal + employerTaxTotal;
  }

  calculateIncomeTax(taxableIncome: number, _taxInfo: any, taxConfig: any) {
    switch (taxConfig.calculationMethod) {
      case 'progressive':
        return this.calculateProgressiveTax(taxableIncome, taxConfig.brackets);
      case 'flat':
        return { employee: round2(taxableIncome * (taxConfig.rates.employee / 100)), employer: round2(taxableIncome * (taxConfig.rates.employer / 100)) };
      default:
        return { employee: 0, employer: 0 };
    }
  }

  calculateProgressiveTax(income: number, brackets: Array<{ threshold: number; rate: number }>) {
    let tax = 0;
    let remainingIncome = income;
    for (let i = 0; i < brackets.length; i++) {
      const bracket = brackets[i];
      if (remainingIncome <= 0) break;
      if (i === 0) { remainingIncome -= bracket.threshold; continue; }
      const prev = brackets[i - 1];
      const width = bracket.threshold - prev.threshold;
      const taxableInBracket = Math.min(remainingIncome, width);
      tax += taxableInBracket * (bracket.rate / 100);
      remainingIncome -= taxableInBracket;
    }
    return { employee: round2(tax), employer: 0 };
  }

  calculateSocialSecurityTax(grossIncome: number, ssConfig: any) {
    const base = Math.min(Math.max(grossIncome, ssConfig.floor || 0), ssConfig.ceiling || Infinity);
    return {
      employee: round2(base * (ssConfig.employeeRate / 100)),
      employer: round2(base * (ssConfig.employerRate / 100))
    };
  }

  calculatePostTaxDeductions(payrollResult: any, employee: any, config: any) {
    let postTaxTotal = 0;
    config.deductions
      .filter((ded: any) => ded.base === 'net')
      .forEach((deduction: any) => {
        if (this.shouldApplyComponent(deduction, employee)) {
          const amount = this.calculateDeductionAmount(deduction, payrollResult.summary.taxable - payrollResult.taxes.employee);
          if (amount > 0) payrollResult.deductions.items.push({ component: deduction, amount, type: 'post-tax' });
          postTaxTotal += amount;
        }
      });
    payrollResult.deductions.posttax = postTaxTotal;
    payrollResult.deductions.total = payrollResult.deductions.pretax + postTaxTotal;
  }

  calculateEmployerCosts(payrollResult: any, _employee: any, _config: any) {
    payrollResult.summary.employerCost = payrollResult.summary.gross + payrollResult.taxes.employer;
  }

  calculateDeductionAmount(deduction: any, baseAmount: number) {
    // `limits.ceiling` was declared on deductions (e.g. SSNIT_EMP's 69,000 ceiling in
    // ghana.json) but never actually enforced here — every deduction was computed against
    // the full uncapped base regardless of its own stated ceiling. For a percentage
    // deduction with a statutory ceiling (SSNIT, Tier 3 relief cap), that means high
    // earners were silently over-deducted past the legal cap.
    const limits = deduction.limits || {};
    const effectiveBase =
      typeof limits.ceiling === 'number' ? Math.min(baseAmount, limits.ceiling) : baseAmount;
    switch (deduction.calculationType) {
      case 'fixed':
        return round2(deduction.amount);
      case 'percentage':
        return round2(effectiveBase * (deduction.rate / 100));
      case 'formula':
        return deduction.formula ? round2(this.evaluateFormula(deduction.formula, { base: effectiveBase })) : 0;
      default:
        return round2(deduction.amount);
    }
  }

  shouldApplyComponent(component: any, employee: any) {
    if (!component.conditions || component.conditions.length === 0) return true;
    return component.conditions.every((condition: any) => {
      switch (condition.type) {
        case 'department': return employee.employment.department === condition.value;
        case 'employmentType': return employee.employment.type === condition.value;
        case 'salaryRange': return employee.employment.salary >= condition.min && employee.employment.salary <= condition.max;
        case 'custom': return this.evaluateCustomCondition(condition, employee);
        default: return true;
      }
    });
  }

  // ==================== COUNTRY TEMPLATES ====================
  initializeDefaultTemplates() {
    this.countryTemplates.set('ghana', this.createGhanaTemplate());
    this.countryTemplates.set('nigeria', this.createNigeriaTemplate());
    this.countryTemplates.set('south_africa', this.createSouthAfricaTemplate());
    this.countryTemplates.set('usa', this.createUSATemplate());
    this.countryTemplates.set('uk', this.createUKTemplate());
  }

  createGhanaTemplate() {
    // PAYE/SSNIT rates are NOT sourced from here — calculatePreTaxDeductions/calculateTaxes
    // pull them live from the compliance tax-rule engine for any config with country:'GH'
    // (see findGhanaTaxRule above). `deductions`/`socialSecurity`/`taxConfig` are left empty
    // for Ghana since nothing reads them on this path any more.
    return this.createPayrollConfig({
      id: 'ghana_standard',
      name: 'Ghana Standard Payroll',
      country: 'GH',
      currency: 'GHS',
      payFrequency: 'monthly',
      earnings: [
        this.createEarningComponent({ name: 'Basic Salary', code: 'BASIC', category: 'regular', calculationType: 'fixed', taxable: true }),
        // Overtime only. Cash allowances, benefits and bonuses come from the staff file
        // so a template amount is not paid to every employee.
        this.createEarningComponent({ name: 'Overtime', code: 'OVERTIME', category: 'overtime', calculationType: 'hourly', rate: 1.5, taxable: true }),
      ],
      deductions: [],
      socialSecurity: {},
      taxConfig: {},
    });
  }

  createNigeriaTemplate() {
    return this.createPayrollConfig({ id: 'nigeria_standard', name: 'Nigeria Standard Payroll', country: 'NG', currency: 'NGN', payFrequency: 'monthly',
      socialSecurity: { pension: this.createSocialSecurityConfig({ name: 'Pension', type: 'pension', employeeRate: 8, employerRate: 10, ceiling: null }) },
      taxConfig: { income: this.createTaxConfig({ name: 'Nigeria Income Tax', type: 'income', calculationMethod: 'progressive', brackets: [
        { threshold: 0, rate: 7 }, { threshold: 300000, rate: 11 }, { threshold: 600000, rate: 15 }, { threshold: 1100000, rate: 19 }, { threshold: 1600000, rate: 21 }, { threshold: 3200000, rate: 24 }
      ] }) }
    });
  }

  createSouthAfricaTemplate() {
    return this.createPayrollConfig({ id: 'south_africa_standard', name: 'South Africa Standard Payroll', country: 'ZA', currency: 'ZAR', payFrequency: 'monthly',
      taxConfig: { income: this.createTaxConfig({ name: 'South Africa Income Tax', type: 'income', calculationMethod: 'progressive', brackets: [
        { threshold: 0, rate: 18 }, { threshold: 237100, rate: 26 }, { threshold: 370500, rate: 31 }, { threshold: 512800, rate: 36 }, { threshold: 673000, rate: 39 }, { threshold: 857900, rate: 41 }, { threshold: 1817000, rate: 45 }
      ] }) }
    });
  }

  createUSATemplate() {
    return this.createPayrollConfig({ id: 'usa_standard', name: 'USA Standard Payroll', country: 'US', currency: 'USD', payFrequency: 'bi-weekly',
      socialSecurity: {
        fica: this.createSocialSecurityConfig({ name: 'FICA Social Security', type: 'pension', employeeRate: 6.2, employerRate: 6.2, ceiling: 160200 }),
        medicare: this.createSocialSecurityConfig({ name: 'Medicare', type: 'health', employeeRate: 1.45, employerRate: 1.45, ceiling: null })
      }
    });
  }

  createUKTemplate() {
    return this.createPayrollConfig({ id: 'uk_standard', name: 'UK Standard Payroll', country: 'GB', currency: 'GBP', payFrequency: 'monthly',
      taxConfig: { income: this.createTaxConfig({ name: 'UK Income Tax', type: 'income', calculationMethod: 'progressive', brackets: [
        { threshold: 0, rate: 0 }, { threshold: 12570, rate: 20 }, { threshold: 50270, rate: 40 }, { threshold: 125140, rate: 45 }
      ] }) },
      socialSecurity: { ni: this.createSocialSecurityConfig({ name: 'National Insurance', type: 'pension', employeeRate: 12, employerRate: 13.8, ceiling: 50270 }) }
    });
  }

  // ==================== UTILITY & RUN ====================
  generateId(prefix: string) { return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`; }

  evaluateFormula(formula: string, context: Record<string, any>) {
    try { const fn = new Function(...Object.keys(context), `return ${formula}`); return fn(...Object.values(context)); } catch { return 0; }
  }

  evaluateCustomCondition(_condition: any, _employee: any) { return true; }

  getCountryTemplate(countryCode: string) {
    const key = (countryCode ?? '').toString().toLowerCase();
    // Accept common aliases and ISO codes
    const aliasMap: Record<string, string> = {
      gh: 'ghana', ghana: 'ghana', ghs: 'ghana',
      ng: 'nigeria', nigeria: 'nigeria', ngn: 'nigeria',
      za: 'south_africa', south_africa: 'south_africa', zar: 'south_africa',
      us: 'usa', usa: 'usa', usd: 'usa',
      gb: 'uk', uk: 'uk', gbp: 'uk'
    };
    const lookupKey = aliasMap[key] || key || 'ghana';
    const template = this.countryTemplates.get(lookupKey);
    if (!template) throw new Error(`No template found for country: ${countryCode}`);
    return JSON.parse(JSON.stringify(template));
  }
  listCountryTemplates() { return Array.from(this.countryTemplates.values()).map((t: any) => ({ id: t.id, name: t.name, country: t.country, currency: t.currency, description: `Standard payroll template for ${t.country}` })); }
}


