'use client';

import React, { useMemo, useState } from 'react';
import { Card, CardHeader, CardBody, Button, Input, Select, SelectItem, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, Chip, Divider, Tooltip, Checkbox } from '@heroui/react';
import UniversalPayrollBuilder from '@/app/lib/payroll/builder';
import { useEmployeeStore } from '@/app/lib/hr/employeeStore';
import { usePayrollStore } from '@/app/lib/hr/payrollStore';
import { useComplianceStore } from '@/app/lib/compliance/store';
import { syncPayrollRunToComplianceFiling } from '@/app/lib/compliance/payrollSync';
import { useAccountingStore } from '@/app/lib/accounting/store';
import PayrollTaxRatesEditor from './PayrollTaxRatesEditor';

export default function PayrollBuilderPanel() {
  const builder = useMemo(() => new UniversalPayrollBuilder(), []);
  const employees = useEmployeeStore((s: any) => s.employees);
  const createPayrollPeriod = usePayrollStore((s: any) => s.createPayrollPeriod);
  const payrollPeriods = usePayrollStore((s: any) => s.payrollPeriods);
  const updatePayrollPeriod = usePayrollStore((s: any) => s.updatePayrollPeriod);
  const createPayrollRecord = usePayrollStore((s: any) => s.createPayrollRecord);
  const complianceCountry = useComplianceStore((s) => s.country);
  const [selectedTemplate, setSelectedTemplate] = useState(complianceCountry);
  const [configId, setConfigId] = useState<string>('');
  const [employeeId, setEmployeeId] = useState<string>('');
  const [result, setResult] = useState<any>(null);
  const [editableConfig, setEditableConfig] = useState<any>(null);
  const [employeeForm, setEmployeeForm] = useState({
    salary: 5000,
    additionalWithholding: 0,
    overtimeHours: 0,
    vehicleBenefit: 0,
    housingBenefit: 0,
    otherNonCashBenefits: 0
  });
  const [runMonth, setRunMonth] = useState<number>(new Date().getMonth() + 1);
  const [runYear, setRunYear] = useState<number>(new Date().getFullYear());
  const [markPaid, setMarkPaid] = useState<boolean>(true);
  // Overtime hours worked this period, per employee id — entered by the payroll admin
  // right before running, since there's no attendance/clock-in system feeding this
  // automatically yet. Keyed by employee id so it survives re-renders across employees.
  const [overtimeHoursByEmployee, setOvertimeHoursByEmployee] = useState<Record<string, number>>({});

  React.useEffect(() => {
    void useComplianceStore.getState().syncCountryFromSetup();
    // This panel can be reached directly (Compliance & Reports → PAYE) without ever
    // visiting HR & Payroll first, which is the only other place these stores get
    // hydrated — without this, activeEmployees is silently empty and "Process Monthly
    // Payroll" fails with "No active employees to process" despite real employees existing.
    void useEmployeeStore.getState().hydrateFromApi();
    void usePayrollStore.getState().hydrateFromApi();
  }, []);

  React.useEffect(() => {
    setSelectedTemplate(complianceCountry);
  }, [complianceCountry]);

  React.useEffect(() => {
    if (!editableConfig && complianceCountry) {
      try {
        const cfg = builder.getCountryTemplate(complianceCountry);
        builder.payrollConfigs.set(cfg.id, cfg);
        setConfigId(cfg.id);
        const saved = typeof window !== 'undefined' ? localStorage.getItem(`payroll.config.${cfg.country}`) : null;
        setEditableConfig(saved ? JSON.parse(saved) : JSON.parse(JSON.stringify(cfg)));
      } catch {
        /* template not available for country */
      }
    }
  }, [complianceCountry, editableConfig, builder]);
  const templateOptions = useMemo(() => builder.listCountryTemplates(), [builder]);

  const resetFromTemplate = () => {
    const cfg = builder.getCountryTemplate(selectedTemplate || complianceCountry);
    builder.payrollConfigs.set(cfg.id, cfg);
    setConfigId(cfg.id);
    setEditableConfig(JSON.parse(JSON.stringify(cfg)));
  };

  const incomeBracketSummary = useMemo(() => {
    const brackets = editableConfig?.taxConfig?.income?.brackets || [];
    if (!brackets.length) return null;
    return brackets.map((b: { threshold: number; rate: number }) => `${b.threshold} @ ${b.rate}%`).join(' → ');
  }, [editableConfig]);

  const socialSecurityPresets = useMemo(() => {
    if (!editableConfig?.socialSecurity) return [];
    return Object.entries(editableConfig.socialSecurity).map(([key, ss]: [string, any]) => ({
      key,
      name: ss.name,
      employeeRate: ss.employeeRate,
      employerRate: ss.employerRate,
      ceiling: ss.ceiling,
    }));
  }, [editableConfig]);

  const earningOptions = [
    { key: 'BASIC', name: 'Basic Salary', calculationType: 'fixed', amount: 0, taxable: true },
    { key: 'TRANSPORT', name: 'Transport Allowance', calculationType: 'fixed', amount: 300, taxable: false },
    { key: 'OVERTIME', name: 'Overtime', calculationType: 'hourly', rate: 1.5, amount: 0, taxable: true },
  ];

  const deductionOptions = [
    { key: 'SSNIT_EMP', name: 'Social Security (Employee)', calculationType: 'percentage', rate: 5.5, base: 'gross' },
    { key: 'HEALTH', name: 'Health Insurance', calculationType: 'fixed', amount: 100, base: 'gross' },
  ];

  const handleLoadTemplate = () => {
    const cfg = builder.getCountryTemplate(selectedTemplate || complianceCountry);
    builder.payrollConfigs.set(cfg.id, cfg);
    setConfigId(cfg.id);
    const saved = typeof window !== 'undefined' ? localStorage.getItem(`payroll.config.${cfg.country}`) : null;
    setEditableConfig(saved ? JSON.parse(saved) : JSON.parse(JSON.stringify(cfg)));
  };

  // Auto-save edits to localStorage
  React.useEffect(() => {
    if (!editableConfig?.country) return;
    try { localStorage.setItem(`payroll.config.${editableConfig.country}`, JSON.stringify(editableConfig)); } catch {}
  }, [editableConfig]);

  const handleCreateDemoEmployee = () => {
    const emp = builder.createEmployee({
      employeeId: `EMP-${Math.floor(Math.random() * 1000)}`,
      firstName: 'Demo', lastName: 'User', email: 'demo@hotel.com',
      employment: { type: 'full-time', department: 'Frontdesk', position: 'Agent', salary: 5000, currency: 'GHS' },
    });
    setEmployeeId(emp.id);
  };

  const handleRun = () => {
    // Auto-load template if not loaded
    if (!configId && !editableConfig) {
      const cfg = builder.getCountryTemplate(selectedTemplate || complianceCountry);
      builder.payrollConfigs.set(cfg.id, cfg);
      setConfigId(cfg.id);
      setEditableConfig(JSON.parse(JSON.stringify(cfg)));
    }
    if (!configId && !editableConfig?.id) return;
    // Ensure employee exists and get id immediately
    let eid = employeeId;
    if (!eid) {
      const created = builder.createEmployee({
        employeeId: `EMP-${Math.floor(Math.random() * 1000)}`,
        firstName: 'Demo', lastName: 'User', email: 'demo@hotel.com',
        employment: { type: 'full-time', department: 'Frontdesk', position: 'Agent', salary: Number(employeeForm.salary) || 0, currency: (editableConfig?.currency || 'GHS') },
        taxInfo: { additionalWithholding: Number(employeeForm.additionalWithholding) || 0 }
      });
      eid = created.id; setEmployeeId(created.id);
    }
    // Persist edited config
    if (editableConfig?.id) builder.payrollConfigs.set(editableConfig.id, editableConfig);
    // Update employee profile with current form
    const emp = (builder as any).employeeProfiles.get(eid);
    if (emp) {
      emp.employment.salary = Number(employeeForm.salary) || 0;
      emp.taxInfo = emp.taxInfo || {};
      emp.taxInfo.additionalWithholding = Number(employeeForm.additionalWithholding) || 0;
      (builder as any).employeeProfiles.set(eid, emp);
    }
    const adjustments = { hours: { OVERTIME: Number(employeeForm.overtimeHours) || 0 } };
    // Inject benefit components for this run
    const runtimeConfigId = editableConfig?.id || configId;
    const baseCfg = JSON.parse(JSON.stringify((builder as any).payrollConfigs.get(runtimeConfigId)));
    baseCfg.earnings = baseCfg.earnings || [];
    const v = Number(employeeForm.vehicleBenefit) || 0;
    const h = Number(employeeForm.housingBenefit) || 0;
    const o = Number(employeeForm.otherNonCashBenefits) || 0;
    // Remove previous runtime benefit items if present
    baseCfg.earnings = baseCfg.earnings.filter((c: any) => !['VEHICLE_BENEFIT','HOUSING_BENEFIT','OTHER_NON_CASH'].includes(c.code));
    if (v > 0) baseCfg.earnings.push({ name: 'Vehicle Benefit', code: 'VEHICLE_BENEFIT', calculationType: 'fixed', amount: v, taxable: true });
    if (h > 0) baseCfg.earnings.push({ name: 'Housing Benefit', code: 'HOUSING_BENEFIT', calculationType: 'fixed', amount: h, taxable: true });
    if (o > 0) baseCfg.earnings.push({ name: 'Other Non-Cash Benefits', code: 'OTHER_NON_CASH', calculationType: 'fixed', amount: o, taxable: true });
    (builder as any).payrollConfigs.set(runtimeConfigId, baseCfg);
    const res = (builder as any).calculatePayroll(eid, runtimeConfigId, { month: new Date().getMonth() + 1, year: new Date().getFullYear() }, adjustments);
    setResult(res);
  };

  const addBracket = () => {
    if (!editableConfig) return;
    const next = { ...editableConfig };
    next.taxConfig = next.taxConfig || {};
    next.taxConfig.income = next.taxConfig.income || { brackets: [] };
    next.taxConfig.income.brackets = [...(next.taxConfig.income.brackets || []), { threshold: 0, rate: 0 }];
    setEditableConfig(next);
  };

  const removeBracket = (idx: number) => {
    if (!editableConfig) return;
    const next = { ...editableConfig };
    next.taxConfig.income.brackets = next.taxConfig.income.brackets.filter((_: any, i: number) => i !== idx);
    setEditableConfig(next);
  };

  const updateBracket = (idx: number, field: 'threshold' | 'rate', value: number) => {
    if (!editableConfig) return;
    const next = { ...editableConfig };
    next.taxConfig.income.brackets = next.taxConfig.income.brackets.map((b: any, i: number) => i === idx ? { ...b, [field]: value } : b);
    setEditableConfig(next);
  };

  const setSS = (key: 'employeeRate' | 'employerRate' | 'ceiling', value: number) => {
    if (!editableConfig) return;
    const next = { ...editableConfig };
    const firstKey = Object.keys(next.socialSecurity || {})[0] || 'ssnit';
    next.socialSecurity = next.socialSecurity || {};
    next.socialSecurity[firstKey] = next.socialSecurity[firstKey] || {};
    next.socialSecurity[firstKey][key] = value;
    setEditableConfig(next);
  };

  const addEarning = () => {
    if (!editableConfig) return;
    const next = { ...editableConfig };
    next.earnings = next.earnings || [];
    next.earnings.push({ name: 'Allowance', code: `ALLW_${next.earnings.length + 1}`, calculationType: 'fixed', amount: 100, taxable: false });
    setEditableConfig(next);
  };

  const removeEarning = (idx: number) => {
    if (!editableConfig) return;
    const next = { ...editableConfig };
    next.earnings = (next.earnings || []).filter((_: any, i: number) => i !== idx);
    setEditableConfig(next);
  };

  const updateEarning = (idx: number, field: 'name' | 'amount' | 'taxable', value: any) => {
    if (!editableConfig) return;
    const next = { ...editableConfig };
    next.earnings[idx] = { ...next.earnings[idx], [field]: value };
    setEditableConfig(next);
  };

  const addDeduction = () => {
    if (!editableConfig) return;
    const next = { ...editableConfig };
    next.deductions = next.deductions || [];
    next.deductions.push({ name: 'Pre-tax Deduction', code: `DED_${next.deductions.length + 1}`, calculationType: 'percentage', rate: 2.5, base: 'gross', taxable: false });
    setEditableConfig(next);
  };

  const updateDeduction = (idx: number, field: 'name' | 'rate' | 'base', value: any) => {
    if (!editableConfig) return;
    const next = { ...editableConfig };
    next.deductions[idx] = { ...next.deductions[idx], [field]: value };
    setEditableConfig(next);
  };

  const removeDeduction = (idx: number) => {
    if (!editableConfig) return;
    const next = { ...editableConfig };
    next.deductions = (next.deductions || []).filter((_: any, i: number) => i !== idx);
    setEditableConfig(next);
  };

  const addSSItem = () => {
    if (!editableConfig) return;
    const next = { ...editableConfig };
    next.socialSecurity = next.socialSecurity || {};
    const key = `ss_${Date.now()}`;
    next.socialSecurity[key] = { name: 'Custom SS', employeeRate: 0, employerRate: 0, ceiling: null };
    setEditableConfig(next);
  };

  const removeSSItem = (key: string) => {
    if (!editableConfig) return;
    const next = { ...editableConfig };
    if (next.socialSecurity && next.socialSecurity[key]) {
      delete next.socialSecurity[key];
      setEditableConfig(next);
    }
  };

  const saveConfig = () => {
    if (!editableConfig?.country) return;
    try { localStorage.setItem(`payroll.config.${editableConfig.country}`, JSON.stringify(editableConfig)); } catch {}
  };

  const ensureConfigLoaded = () => {
    if (!configId && !editableConfig) {
      const cfg = builder.getCountryTemplate(selectedTemplate || complianceCountry);
      builder.payrollConfigs.set(cfg.id, cfg);
      setConfigId(cfg.id);
      setEditableConfig(JSON.parse(JSON.stringify(cfg)));
      return cfg.id;
    }
    return editableConfig?.id || configId;
  };

  const handleRunMonthly = () => {
    const runtimeId = ensureConfigLoaded();
    if (!runtimeId) return;
    // Use active employees only
    const activeEmployees = (employees || []).filter((e: any) => e.status === 'active');
    if (activeEmployees.length === 0) {
      alert('No active employees to process.');
      return;
    }
    // Create payroll period
    const periodNumber = `PP-${runYear}-${String(runMonth).padStart(2, '0')}`;
    const existingPeriod = (payrollPeriods || []).find((p: any) => p.periodNumber === periodNumber);
    if (existingPeriod) {
      alert(`Payroll for ${periodNumber} has already been processed (status: ${existingPeriod.status}). Re-running would double-count gross/net pay for every employee — void the existing period first if you need to redo it.`);
      return;
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
      processedBy: 'system'
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
        employment: { type: emp.employmentType || 'full_time', department: emp.departmentId, position: emp.positionId, salary: Number((emp as any).basicSalary ?? (emp as any).salary ?? 0), currency: (editableConfig?.currency || 'GHS'), hourlyRate: Number((emp as any).hourlyRate || 0) },
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

      const adjustments = { hours: { OVERTIME: Number(overtimeHoursByEmployee[eid] || 0) } };
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
        department: emp.departmentId,
        position: emp.positionId,
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
        status: markPaid ? 'paid' : 'processed',
        paidAt: markPaid ? new Date(runYear, runMonth - 1, 28) : undefined,
        notes: 'Monthly payroll run'
      } as any);
    });

    // Update period totals
    updatePayrollPeriod(period.id, {
      status: markPaid ? 'paid' : 'processed',
      totalGrossPay: totals.gross,
      totalNetPay: totals.net,
      totalDeductions: totals.deductions,
      totalTaxes: totals.tax,
      processedAt: new Date(),
      approvedAt: markPaid ? new Date() : undefined,
      approvedBy: markPaid ? 'system' : undefined
    } as any);

    syncPayrollRunToComplianceFiling({
      countryCode: complianceCountry,
      period: `${runYear}-${String(runMonth).padStart(2, '0')}`,
      payeTotal: totals.tax,
      ssnitTotal: totals.ssnit,
      employeeCount: activeEmployees.length,
    });

    // Post the run to the GL — previously payroll never touched the ledger at all, so
    // Salary Expense/PAYE/SSNIT payables and the accrued net-pay liability permanently
    // omitted the largest opex line from every financial report. The "Accrued Expenses"
    // credit is a residual (gross − PAYE − SSNIT) rather than a hardcoded totals.net, so
    // the entry balances exactly even if some employee has other post-tax deductions
    // this run's totals don't itemize separately.
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
          status: 'Posted',
          postedBy: 'system',
          postedAt: now,
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
        alert('Payroll was processed, but posting it to the general ledger failed. Please notify accounting to post it manually.');
      }
    }

    alert(`Monthly payroll processed for ${activeEmployees.length} employee(s).`);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between w-full">
          <h4 className="font-semibold">Universal Payroll Builder (PAYE)</h4>
          <div className="flex gap-2">
            <Select selectedKeys={[selectedTemplate]} onSelectionChange={(k) => setSelectedTemplate(Array.from(k)[0] as string)} className="w-48" variant="bordered">
              {templateOptions.map((t) => (
                <SelectItem key={t.country}>{t.name}</SelectItem>
              ))}
            </Select>
            <Button className="bg-ghana-green text-white" onPress={handleLoadTemplate}>Load Template</Button>
            <Button variant="flat" onPress={handleCreateDemoEmployee}>Create Demo Employee</Button>
            <Button color="primary" onPress={handleRun} isDisabled={!configId}>Run Payroll</Button>
            <Button variant="flat" onPress={saveConfig} isDisabled={!editableConfig}>Save Config</Button>
          </div>
        </div>
      </CardHeader>
      <CardBody>
        {!editableConfig && (
          <div className="text-sm text-gray-600">Load a template, create a demo employee, then adjust PAYE brackets, SSNIT, earnings and deductions before running payroll.</div>
        )}
        {editableConfig && (
          <div className="space-y-4">
            {/* Employee Controls */}
            <Card>
              <CardHeader>
                <h5 className="font-medium">Employee & Run Controls</h5>
              </CardHeader>
              <CardBody>
                {(() => { const currency = (editableConfig?.currency || editableConfig?.countryCurrency || 'GHS'); return (
                <>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <Input label={`Salary (${currency})`} type="number" value={String(employeeForm.salary)} onChange={(e) => setEmployeeForm({ ...employeeForm, salary: parseFloat(e.target.value || '0') })} variant="bordered" />
                  <Input label={`Addl. Withholding (${currency})`} type="number" value={String(employeeForm.additionalWithholding)} onChange={(e) => setEmployeeForm({ ...employeeForm, additionalWithholding: parseFloat(e.target.value || '0') })} variant="bordered" />
                  <Input label="Overtime Hours" type="number" value={String(employeeForm.overtimeHours)} onChange={(e) => setEmployeeForm({ ...employeeForm, overtimeHours: parseFloat(e.target.value || '0') })} variant="bordered" />
                  <div className="grid grid-cols-2 gap-2">
                    <Input label="Effective From" type="date" value={editableConfig?.effectiveFrom || ''} onChange={(e) => setEditableConfig((prev: any) => ({ ...prev, effectiveFrom: e.target.value }))} variant="bordered" />
                    <Input label="Effective To" type="date" value={editableConfig?.effectiveTo || ''} onChange={(e) => setEditableConfig((prev: any) => ({ ...prev, effectiveTo: e.target.value }))} variant="bordered" />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
                  <Input label={`Vehicle Benefit (${currency})`} type="number" value={String(employeeForm.vehicleBenefit)} onChange={(e) => setEmployeeForm({ ...employeeForm, vehicleBenefit: parseFloat(e.target.value || '0') })} variant="bordered" />
                  <Input label={`Housing Benefit (${currency})`} type="number" value={String(employeeForm.housingBenefit)} onChange={(e) => setEmployeeForm({ ...employeeForm, housingBenefit: parseFloat(e.target.value || '0') })} variant="bordered" />
                  <Input label={`Other Non-Cash Benefits (${currency})`} type="number" value={String(employeeForm.otherNonCashBenefits)} onChange={(e) => setEmployeeForm({ ...employeeForm, otherNonCashBenefits: parseFloat(e.target.value || '0') })} variant="bordered" />
                </div>
                </>
                ); })()}
              </CardBody>
            </Card>
            {/* Monthly Payroll Run */}
            <Card>
              <CardHeader>
                <h5 className="font-medium">Monthly Payroll Run</h5>
              </CardHeader>
              <CardBody>
                <div className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
                  <Select label="Month" selectedKeys={[String(runMonth)]} onSelectionChange={(k) => setRunMonth(parseInt(String(Array.from(k)[0]), 10))} variant="bordered">
                    {Array.from({ length: 12 }).map((_, i) => (
                      <SelectItem key={String(i + 1)}>{new Date(2000, i, 1).toLocaleString(undefined, { month: 'long' })}</SelectItem>
                    ))}
                  </Select>
                  <Input label="Year" type="number" value={String(runYear)} onChange={(e) => setRunYear(parseInt(e.target.value || String(new Date().getFullYear()), 10))} variant="bordered" />
                  <div className="flex items-center gap-2">
                    <Checkbox isSelected={markPaid} onValueChange={setMarkPaid}>Mark as Paid</Checkbox>
                  </div>
                  <div className="md:col-span-3 flex justify-end">
                    <Button color="primary" onPress={handleRunMonthly}>Process Monthly Payroll</Button>
                  </div>
                </div>
                {(employees || []).filter((e: any) => e.status === 'active').length > 0 && (
                  <div className="mt-4">
                    <div className="text-sm font-medium mb-1">Overtime Hours This Period</div>
                    <div className="text-xs text-gray-500 mb-2">
                      Enter hours worked beyond normal schedule per employee before running — there&apos;s no
                      attendance/clock-in system feeding this automatically yet, so it defaults to 0 (no overtime pay)
                      if left blank.
                    </div>
                    <Table aria-label="overtime-hours">
                      <TableHeader>
                        <TableColumn>EMPLOYEE</TableColumn>
                        <TableColumn>HOURLY RATE</TableColumn>
                        <TableColumn>OT HOURS</TableColumn>
                      </TableHeader>
                      <TableBody>
                        {(employees || []).filter((e: any) => e.status === 'active').map((emp: any) => {
                          const eid = emp.id || emp.employeeNumber;
                          return (
                            <TableRow key={eid}>
                              <TableCell>{emp.firstName} {emp.lastName}</TableCell>
                              <TableCell>{Number(emp.hourlyRate || 0) > 0 ? Number(emp.hourlyRate).toFixed(2) : (
                                <span className="text-gray-400">not set</span>
                              )}</TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  size="sm"
                                  value={String(overtimeHoursByEmployee[eid] || 0)}
                                  onChange={(e) => setOvertimeHoursByEmployee(prev => ({ ...prev, [eid]: parseFloat(e.target.value || '0') }))}
                                  variant="bordered"
                                  isDisabled={!Number(emp.hourlyRate || 0)}
                                />
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardBody>
            </Card>
            {/* Editors */}
            {editableConfig?.country === 'GH' && (
              <PayrollTaxRatesEditor />
            )}
            {editableConfig?.country !== 'GH' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card>
                <CardHeader>
                  <h5 className="font-medium">Income Tax Brackets</h5>
                </CardHeader>
                <CardBody>
                  <div>
                    {incomeBracketSummary && (
                      <p className="mb-3 text-xs text-gray-500 bg-gray-50 rounded p-2">
                        Current bands: {incomeBracketSummary}
                      </p>
                    )}
                    <Table aria-label="brackets">
                      <TableHeader>
                        <TableColumn>
                          <div className="flex items-center gap-1">THRESHOLD
                            <Tooltip content="Cumulative upper bound for this bracket. Order top-to-bottom; remaining income falls into the last tier.">
                              <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-gray-200 text-gray-700 text-xs cursor-help">i</span>
                            </Tooltip>
                          </div>
                        </TableColumn>
                        <TableColumn>
                          <div className="flex items-center gap-1">RATE %
                            <Tooltip content="Percentage applied to income within this bracket.">
                              <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-gray-200 text-gray-700 text-xs cursor-help">i</span>
                            </Tooltip>
                          </div>
                        </TableColumn>
                        <TableColumn>ACTIONS</TableColumn>
                      </TableHeader>
                      <TableBody>
                        {(editableConfig.taxConfig?.income?.brackets || []).map((b: any, idx: number) => (
                          <TableRow key={idx}>
                            <TableCell>
                              <Input type="number" value={String(b.threshold)} onChange={(e) => updateBracket(idx, 'threshold', parseFloat(e.target.value || '0'))} variant="bordered" />
                            </TableCell>
                            <TableCell>
                              <Input type="number" value={String(b.rate)} onChange={(e) => updateBracket(idx, 'rate', parseFloat(e.target.value || '0'))} variant="bordered" />
                            </TableCell>
                            <TableCell>
                              <Button size="sm" variant="flat" color="danger" onPress={() => removeBracket(idx)}>Remove</Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    <div className="mt-2 flex gap-2 flex-wrap">
                      <Button size="sm" variant="flat" onPress={addBracket}>+ Add Bracket</Button>
                      <Button size="sm" color="primary" onPress={handleRun}>Recalculate</Button>
                      <Button size="sm" variant="flat" onPress={resetFromTemplate}>Reset from template</Button>
                    </div>
                  </div>
                </CardBody>
              </Card>

              <Card>
                <CardHeader>
                  <h5 className="font-medium">Social Security</h5>
                </CardHeader>
                <CardBody>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Items</span>
                      <Button size="sm" variant="flat" onPress={addSSItem}>+ Add SS Item</Button>
                    </div>
                    <div className="space-y-2">
                      {Object.entries(editableConfig.socialSecurity || {}).map(([key, ss]: any) => (
                        <div key={key} className="grid grid-cols-6 gap-2 items-start">
                          <Select label="Name" selectedKeys={[String((() => { const m = socialSecurityPresets.find(o => o.name === ss.name || o.key === ss.name); return m?.name || ss.name || key; })())]} onSelectionChange={(k) => {
                            const selected = String(Array.from(k)[0] || 'Social Security');
                            const preset = socialSecurityPresets.find(o => o.name === selected || o.key === selected);
                            const next = { ...editableConfig } as any;
                            next.socialSecurity[key] = {
                              ...(next.socialSecurity[key] || {}),
                              name: preset?.name || selected,
                              employeeRate: preset ? preset.employeeRate : (next.socialSecurity[key]?.employeeRate || 0),
                              employerRate: preset ? preset.employerRate : (next.socialSecurity[key]?.employerRate || 0),
                              ceiling: preset ? preset.ceiling : (next.socialSecurity[key]?.ceiling ?? 0)
                            };
                            setEditableConfig(next);
                          }} variant="bordered">
                            {socialSecurityPresets.map(opt => (
                              <SelectItem key={opt.name}>{opt.name}</SelectItem>
                            ))}
                          </Select>
                          <Input label="Emp %" type="number" value={String(ss.employeeRate || 0)} onChange={(e) => { const next = { ...editableConfig } as any; next.socialSecurity[key] = { ...(next.socialSecurity[key] || {}), employeeRate: parseFloat(e.target.value || '0') }; setEditableConfig(next); }} variant="bordered" />
                          <Input label="Er %" type="number" value={String(ss.employerRate || 0)} onChange={(e) => { const next = { ...editableConfig } as any; next.socialSecurity[key] = { ...(next.socialSecurity[key] || {}), employerRate: parseFloat(e.target.value || '0') }; setEditableConfig(next); }} variant="bordered" />
                          <Input label="Ceiling" type="number" value={String(ss.ceiling ?? 0)} onChange={(e) => { const next = { ...editableConfig } as any; next.socialSecurity[key] = { ...(next.socialSecurity[key] || {}), ceiling: parseFloat(e.target.value || '0') || null }; setEditableConfig(next); }} variant="bordered" />
                          <Button size="sm" variant="flat" color="danger" onPress={() => removeSSItem(key)}>Remove</Button>
                        </div>
                      ))}
                    </div>
                    <Button size="sm" color="primary" onPress={handleRun}>Recalculate</Button>
                  </div>
                </CardBody>
              </Card>
            </div>
            )}

            <Card>
                <CardHeader>
                  <h5 className="font-medium">Components</h5>
                </CardHeader>
                <CardBody>
                  <div className="space-y-3">
                    <div>
                      <div className="flex items-center justify-between mb-1"><span className="text-sm font-medium">Earnings</span><Button size="sm" variant="flat" onPress={addEarning}>+ Add</Button></div>
                      <div className="space-y-2">
                        {(editableConfig.earnings || []).map((e: any, idx: number) => (
                          <div key={idx} className="grid grid-cols-6 gap-2 items-start">
                            <Select selectedKeys={[e.name || '']} onSelectionChange={(k) => {
                              const key = String(Array.from(k)[0] || '');
                              const preset = earningOptions.find(o => o.name === key);
                              const val: any = preset ? { name: preset.name, calculationType: preset.calculationType, amount: preset.amount || 0, rate: preset.rate || 0, taxable: preset.taxable !== false } : { name: key };
                              updateEarning(idx, 'name', val.name);
                              // update related fields
                              const next = { ...editableConfig } as any; next.earnings[idx] = { ...(next.earnings[idx] || {}), ...val }; setEditableConfig(next);
                            }} variant="bordered">
                              {earningOptions.map(opt => (<SelectItem key={opt.name}>{opt.name}</SelectItem>))}
                            </Select>
                            <Input type="number" value={String(e.amount || 0)} onChange={(ev) => updateEarning(idx, 'amount', parseFloat(ev.target.value || '0'))} variant="bordered" />
                            <Select selectedKeys={[e.taxable ? 'yes' : 'no']} onSelectionChange={(k) => updateEarning(idx, 'taxable', Array.from(k)[0] === 'yes')} variant="bordered">
                              <SelectItem key="yes">Taxable</SelectItem>
                              <SelectItem key="no">Non-taxable</SelectItem>
                            </Select>
                            <div className="col-span-2"></div>
                            <Button size="sm" variant="flat" color="danger" onPress={() => removeEarning(idx)}>Remove</Button>
                          </div>
                        ))}
                      </div>
                    </div>
                    <Divider />
                    <div>
                      <div className="flex items-center justify-between mb-1"><span className="text-sm font-medium">Deductions (Pre-tax)</span><Button size="sm" variant="flat" onPress={addDeduction}>+ Add</Button></div>
                      <div className="space-y-2">
                        {(editableConfig.deductions || []).map((d: any, idx: number) => (
                          <div key={idx} className="grid grid-cols-6 gap-2 items-start">
                            <Select selectedKeys={[(() => { const m = deductionOptions.find(o => o.name === d.name || o.key === d.name); return m?.name || d.name || ''; })()]} onSelectionChange={(k) => {
                              const key = String(Array.from(k)[0] || '');
                              const preset = deductionOptions.find(o => o.name === key || o.key === key);
                              const next = { ...editableConfig } as any;
                              next.deductions[idx] = { ...(next.deductions[idx] || {}), name: key, calculationType: preset?.calculationType || next.deductions[idx]?.calculationType || 'percentage', rate: preset?.rate ?? next.deductions[idx]?.rate ?? 0, amount: preset?.amount ?? next.deductions[idx]?.amount ?? 0, base: preset?.base || next.deductions[idx]?.base || 'gross' };
                              setEditableConfig(next);
                            }} variant="bordered">
                              {deductionOptions.map(opt => (<SelectItem key={opt.name}>{opt.name}</SelectItem>))}
                            </Select>
                            <Input type="number" value={String(d.rate || 0)} onChange={(ev) => updateDeduction(idx, 'rate', parseFloat(ev.target.value || '0'))} variant="bordered" />
                            <Select selectedKeys={[d.base || 'gross']} onSelectionChange={(k) => updateDeduction(idx, 'base', Array.from(k)[0])} variant="bordered">
                              <SelectItem key="gross">Gross</SelectItem>
                              <SelectItem key="taxable">Taxable</SelectItem>
                              <SelectItem key="net">Net</SelectItem>
                            </Select>
                            <div className="col-span-2"></div>
                            <Button size="sm" variant="flat" color="danger" onPress={() => removeDeduction(idx)}>Remove</Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardBody>
              </Card>

            {/* Results */}
            <Divider />
            {!result && (
              <div className="text-sm text-gray-600">Click Run Payroll to see results.</div>
            )}
        {result && (
            <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="p-3 bg-gray-50 rounded">
                <div className="text-xs text-gray-500">Gross</div>
                <div className="text-xl font-semibold">{result.summary.gross.toFixed(2)}</div>
              </div>
              <div className="p-3 bg-gray-50 rounded">
                <div className="text-xs text-gray-500">Taxable</div>
                <div className="text-xl font-semibold">{result.summary.taxable.toFixed(2)}</div>
              </div>
              <div className="p-3 bg-gray-50 rounded">
                <div className="text-xs text-gray-500">Employee Tax</div>
                <div className="text-xl font-semibold text-red-600">{result.taxes.employee.toFixed(2)}</div>
              </div>
              <div className="p-3 bg-gray-50 rounded">
                <div className="text-xs text-gray-500">Net Pay</div>
                <div className="text-xl font-semibold text-green-600">{result.summary.net.toFixed(2)}</div>
              </div>
            </div>

            {/* Consolidated summary aligned with HR columns */}
            {(() => {
              const currency = (editableConfig?.currency || editableConfig?.countryCurrency || 'GHS');
              const findEarning = (name: string) => (result.earnings.items.find((x: any) => x.component?.name === name)?.amount || 0);
              const basic = findEarning('Basic Salary');
              const vehicle = findEarning('Vehicle Benefit');
              const housing = findEarning('Housing Benefit');
              const otherNonCash = findEarning('Other Non-Cash Benefits');
              const allowances = result.earnings.items
                .filter((x: any) => x.component?.name?.toLowerCase().includes('allowance'))
                .reduce((sum: number, x: any) => sum + (x.amount || 0), 0);
              const socialSecurity = result.taxes.items
                .filter((t: any) => t.type === 'social' && String(t.name).toLowerCase().includes('ssnit'))
                .reduce((sum: number, t: any) => sum + (t.amount || 0), 0);
              // Tier 2 is a reporting split of the same SSNIT contribution above (see
              // calculateTaxes' tier2Amount), not an extra deduction — the old code tried to
              // match an item literally named 'pension', which never existed, so this was
              // always 0. Tier 3 is a real, separate voluntary deduction (see the
              // TIER3_EMP entry injected above) and now genuinely reflects what was withheld.
              const tier2 = result.taxes.items
                .filter((t: any) => t.type === 'social')
                .reduce((sum: number, t: any) => sum + (t.tier2Amount || 0), 0);
              const tier3 = (result.deductions.items || [])
                .filter((d: any) => d.component?.code === 'TIER3_EMP')
                .reduce((sum: number, d: any) => sum + (d.amount || 0), 0);
              const incomeTax = result.taxes.items
                .filter((t: any) => t.type === 'income')
                .reduce((sum: number, t: any) => sum + (t.amount || 0), 0);
              const fmt = (n: number) => new Intl.NumberFormat('en-GH', { style: 'currency', currency }).format(n || 0);
              return (
                <div className="mt-4">
                  <h5 className="font-medium mb-2">Payroll Summary</h5>
                  <Table aria-label="payroll-summary">
                    <TableHeader>
                      <TableColumn>BASIC SALARY</TableColumn>
                      <TableColumn>Social Security</TableColumn>
                      <TableColumn>TIER 2</TableColumn>
                      <TableColumn>TIER 3</TableColumn>
                      <TableColumn>ALLOWANCES</TableColumn>
                      <TableColumn>VEHICLE BENEFIT</TableColumn>
                      <TableColumn>HOUSING BENEFIT</TableColumn>
                      <TableColumn>OTHER NON-CASH BENEFITS</TableColumn>
                      <TableColumn>INCOME TAX</TableColumn>
                      <TableColumn>NET PAY</TableColumn>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell>{fmt(basic)}</TableCell>
                        <TableCell>{fmt(socialSecurity)}</TableCell>
                        <TableCell>{fmt(tier2)}</TableCell>
                        <TableCell>{fmt(tier3)}</TableCell>
                        <TableCell>{fmt(allowances)}</TableCell>
                        <TableCell>{fmt(vehicle)}</TableCell>
                        <TableCell>{fmt(housing)}</TableCell>
                        <TableCell>{fmt(otherNonCash)}</TableCell>
                        <TableCell>{fmt(incomeTax)}</TableCell>
                        <TableCell>{fmt(result.summary.net)}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              );
            })()}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h5 className="font-medium mb-2">Earnings</h5>
                <Table aria-label="earnings">
                  <TableHeader>
                    <TableColumn>NAME</TableColumn>
                    <TableColumn>AMOUNT</TableColumn>
                    <TableColumn>TAXABLE</TableColumn>
                  </TableHeader>
                  <TableBody>
                    {result.earnings.items.map((e: any, idx: number) => (
                      <TableRow key={idx}>
                        <TableCell>{e.component.name}</TableCell>
                        <TableCell>{e.amount.toFixed(2)}</TableCell>
                        <TableCell><Chip size="sm" variant="flat" color={e.taxable ? 'success' : 'default'}>{e.taxable ? 'Yes' : 'No'}</Chip></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div>
                <h5 className="font-medium mb-2">Taxes & Deductions</h5>
                <Table aria-label="taxes">
                  <TableHeader>
                    <TableColumn>TYPE</TableColumn>
                    <TableColumn>NAME</TableColumn>
                    <TableColumn>EMPLOYEE</TableColumn>
                    <TableColumn>EMPLOYER</TableColumn>
                  </TableHeader>
                  <TableBody>
                    {result.taxes.items.map((t: any, idx: number) => (
                      <TableRow key={idx}>
                        <TableCell>{t.type}</TableCell>
                        <TableCell>{t.name}</TableCell>
                        <TableCell>{(t.amount || 0).toFixed(2)}</TableCell>
                        <TableCell>{(t.employerAmount || 0).toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </>
        )}
        </div>
        )}
      </CardBody>
    </Card>
  );
}

