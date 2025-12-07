/* eslint-disable @typescript-eslint/no-explicit-any */
// Universal Payroll Builder - integrated as a library module

export default class UniversalPayrollBuilder {
  payrollConfigs: Map<string, any>;
  employeeProfiles: Map<string, any>;
  payrollRuns: Map<string, any>;
  countryTemplates: Map<string, any>;

  constructor() {
    this.payrollConfigs = new Map();
    this.employeeProfiles = new Map();
    this.payrollRuns = new Map();
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
        currency: employeeData.employment?.currency || 'USD'
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

  createDeductionComponent(config: any) {
    return {
      type: 'deduction',
      id: config.id || this.generateId('ded'),
      name: config.name,
      code: config.code,
      category: config.category || 'statutory',
      calculationType: config.calculationType || 'fixed',
      amount: config.amount || 0,
      rate: config.rate || 0,
      base: config.base || 'gross',
      taxable: config.taxable || false,
      appliesTo: config.appliesTo || 'all',
      conditions: config.conditions || [],
      limits: config.limits || {},
      priority: config.priority || 1,
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
      payrollResult.summary.taxable = payrollResult.earnings.taxable - payrollResult.deductions.pretax;
      this.calculateTaxes(payrollResult, employee, config);
      this.calculatePostTaxDeductions(payrollResult, employee, config);
      payrollResult.summary.net = payrollResult.summary.taxable - payrollResult.taxes.employee - payrollResult.deductions.posttax;
      this.calculateEmployerCosts(payrollResult, employee, config);
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
        const amount = this.calculateEarningAmount(earning, employee, adjustments);
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
        const hours = adjustments.hours?.[earning.code] || earning.amount;
        return hours * earning.rate;
      }
      case 'formula':
        return earning.formula ? this.evaluateFormula(earning.formula, { salary: employee.employment.salary, ...adjustments }) : 0;
      default:
        return earning.amount;
    }
  }

  calculatePreTaxDeductions(payrollResult: any, _employee: any, config: any) {
    let preTaxTotal = 0;
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
    payrollResult.deductions.pretax = preTaxTotal;
  }

  calculateTaxes(payrollResult: any, employee: any, config: any) {
    let employeeTaxTotal = 0;
    let employerTaxTotal = 0;
    if (config.taxConfig?.income) {
      const incomeTax = this.calculateIncomeTax(payrollResult.summary.taxable, employee.taxInfo, config.taxConfig.income);
      payrollResult.taxes.items.push({ type: 'income', name: 'Income Tax', amount: incomeTax.employee, employerAmount: incomeTax.employer || 0 });
      employeeTaxTotal += incomeTax.employee;
      employerTaxTotal += incomeTax.employer || 0;
    }
    if (config.socialSecurity) {
      Object.values(config.socialSecurity).forEach((ssConfig: any) => {
        const ssTax = this.calculateSocialSecurityTax(payrollResult.summary.gross, ssConfig);
        payrollResult.taxes.items.push({ type: 'social', name: (ssConfig as any).name, amount: ssTax.employee, employerAmount: ssTax.employer });
        employeeTaxTotal += ssTax.employee;
        employerTaxTotal += ssTax.employer;
      });
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
        return { employee: taxableIncome * (taxConfig.rates.employee / 100), employer: taxableIncome * (taxConfig.rates.employer / 100) };
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
    return { employee: tax, employer: 0 };
  }

  calculateSocialSecurityTax(grossIncome: number, ssConfig: any) {
    const base = Math.min(Math.max(grossIncome, ssConfig.floor || 0), ssConfig.ceiling || Infinity);
    return {
      employee: base * (ssConfig.employeeRate / 100),
      employer: base * (ssConfig.employerRate / 100)
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
    switch (deduction.calculationType) {
      case 'fixed':
        return deduction.amount;
      case 'percentage':
        return baseAmount * (deduction.rate / 100);
      case 'formula':
        return deduction.formula ? this.evaluateFormula(deduction.formula, { base: baseAmount }) : 0;
      default:
        return deduction.amount;
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
    return this.createPayrollConfig({
      id: 'ghana_standard', name: 'Ghana Standard Payroll', country: 'GH', currency: 'GHS', payFrequency: 'monthly',
      earnings: [
        this.createEarningComponent({ name: 'Basic Salary', code: 'BASIC', category: 'regular', calculationType: 'fixed', taxable: true }),
        this.createEarningComponent({ name: 'Transport Allowance', code: 'TRANSPORT', category: 'allowance', calculationType: 'fixed', amount: 300, taxable: false }),
        this.createEarningComponent({ name: 'Overtime', code: 'OVERTIME', category: 'overtime', calculationType: 'hourly', rate: 1.5, taxable: true })
      ],
      deductions: [
        this.createDeductionComponent({ name: 'SSNIT Employee', code: 'SSNIT_EMP', category: 'statutory', calculationType: 'percentage', rate: 5.5, base: 'gross', taxable: false, limits: { ceiling: 17500 } })
      ],
      socialSecurity: {
        ssnit: this.createSocialSecurityConfig({ name: 'SSNIT', type: 'pension', employeeRate: 5.5, employerRate: 13.0, ceiling: 17500 })
      },
      taxConfig: {
        income: this.createTaxConfig({ name: 'Ghana Income Tax', type: 'income', calculationMethod: 'progressive', brackets: [
          { threshold: 0, rate: 0 }, { threshold: 490, rate: 5 }, { threshold: 600, rate: 10 }, { threshold: 730, rate: 17.5 }, { threshold: 3730, rate: 25 }, { threshold: 20125, rate: 30 }
        ] })
      }
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

  createPayrollRun(configId: string, period: any, employeeIds: string[]) {
    const payrollRun = { id: this.generateId('payrun'), configId, period, employeeIds, status: 'draft', results: [], totals: {}, metadata: { created: new Date().toISOString(), processed: null, completed: null } };
    this.payrollRuns.set(payrollRun.id, payrollRun);
    return payrollRun;
  }

  processPayrollRun(payrollRunId: string) {
    const payrollRun = this.payrollRuns.get(payrollRunId);
    if (!payrollRun) throw new Error('Payroll run not found');
    payrollRun.status = 'processing';
    payrollRun.results = [];
    const grandTotal = { gross: 0, taxable: 0, net: 0, employeeTax: 0, employerTax: 0, employerCost: 0 } as any;
    payrollRun.employeeIds.forEach((employeeId: string) => {
      try {
        const result = this.calculatePayroll(employeeId, payrollRun.configId, payrollRun.period);
        payrollRun.results.push(result);
        grandTotal.gross += result.summary.gross;
        grandTotal.taxable += result.summary.taxable;
        grandTotal.net += result.summary.net;
        grandTotal.employeeTax += result.taxes.employee;
        grandTotal.employerTax += result.taxes.employer;
        grandTotal.employerCost += result.summary.employerCost;
      } catch (e: any) {
        payrollRun.results.push({ employeeId, error: e.message, status: 'failed' });
      }
    });
    payrollRun.totals = grandTotal;
    payrollRun.status = 'completed';
    payrollRun.metadata.processed = new Date().toISOString();
    return payrollRun;
  }

  generatePayrollReport(payrollRunId: string, format = 'summary') {
    const payrollRun = this.payrollRuns.get(payrollRunId);
    if (!payrollRun) throw new Error('Payroll run not found');
    switch (format) {
      case 'summary': return this.generateSummaryReport(payrollRun);
      case 'detailed': return this.generateDetailedReport(payrollRun);
      case 'tax': return this.generateTaxReport(payrollRun);
      case 'bank': return this.generateBankTransferReport(payrollRun);
      default: return this.generateSummaryReport(payrollRun);
    }
  }

  generateSummaryReport(payrollRun: any) {
    return { payrollRunId: payrollRun.id, period: payrollRun.period, processedDate: payrollRun.metadata.processed, employeeCount: payrollRun.results.filter((r: any) => !r.error).length, totals: payrollRun.totals, summaryByDepartment: this.groupByDepartment(payrollRun.results), status: payrollRun.status };
  }

  generateDetailedReport(payrollRun: any) { return payrollRun; }
  generateTaxReport(payrollRun: any) { return { taxTotals: payrollRun.results.reduce((acc: any, r: any) => acc + (r?.taxes?.employee || 0), 0) }; }
  generateBankTransferReport(payrollRun: any) { return payrollRun.results.map((r: any) => ({ account: r.employee?.bankInfo?.account, amount: r.summary?.net })); }

  groupByDepartment(results: any[]) {
    const departmentSummary: any = {};
    results.forEach((result: any) => {
      if (result.error) return;
      const dept = result.employee.employment.department || 'Unassigned';
      if (!departmentSummary[dept]) departmentSummary[dept] = { employeeCount: 0, gross: 0, net: 0, tax: 0 };
      departmentSummary[dept].employeeCount++;
      departmentSummary[dept].gross += result.summary.gross;
      departmentSummary[dept].net += result.summary.net;
      departmentSummary[dept].tax += result.taxes.employee;
    });
    return departmentSummary;
  }

  exportConfiguration(configId: string) { const config = this.payrollConfigs.get(configId); if (!config) throw new Error('Configuration not found'); return { ...config, exportDate: new Date().toISOString(), format: 'Universal Payroll Builder v1.0' }; }
  importConfiguration(configData: any) { return this.createPayrollConfig(configData); }
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


