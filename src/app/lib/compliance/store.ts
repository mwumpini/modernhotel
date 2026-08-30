import { create } from 'zustand';
import { TaxRule, ReportingRule, ComplianceTransaction, ComplianceReport, TaxType } from '../models';
import { DEFAULT_COMPLIANCE_COUNTRY, getSeedReports, getSeedTaxes } from './config';
import { resolveComplianceCountry } from './resolveCountry';

export interface TaxLineItem {
  // Stable identity of the rule that produced this line — use this (never `name`) to find
  // "the Tier 2 amount" etc. in code, since `name` is a user-editable display label and
  // will not match after a rename.
  ruleId: string;
  name: string;
  amount: number;
  glCode: string;
  rate: number;
  isExempt?: boolean;
  exemptionReason?: string;
  // Employer-side contribution amount, when the rule declares an `employerRate`.
  employerAmount?: number;
}

function evalCondition(context: Record<string, any>, cond: NonNullable<TaxRule['condition']>): boolean {
  const lhs = context?.[cond.field];
  const rhs = cond.value;
  switch (cond.op) {
    case 'eq': return lhs === rhs;
    case 'ne': return lhs !== rhs;
    case 'gt': return Number(lhs) > Number(rhs);
    case 'lt': return Number(lhs) < Number(rhs);
    case 'gte': return Number(lhs) >= Number(rhs);
    case 'lte': return Number(lhs) <= Number(rhs);
    case 'in': return Array.isArray(rhs) ? rhs.includes(lhs) : false;
    default: return true;
  }
}

function computeBase(
  baseType: NonNullable<TaxRule['calculationBase']> | undefined,
  subtotal: number,
  runningBase: number,
  context: Record<string, any>
): number {
  switch (baseType) {
    case 'subtotal_plus_applied':
      return runningBase;
    case 'per_person':
      return subtotal * Number(context?.numPersons ?? 1);
    case 'per_night':
      return subtotal * Number(context?.numNights ?? 1);
    case 'per_person_night':
      return subtotal * Number(context?.numPersons ?? 1) * Number(context?.numNights ?? 1);
    case 'subtotal':
    default:
      return subtotal;
  }
}

function computeTiered(
  base: number,
  tiers: NonNullable<TaxRule['tiers']>,
  rounding?: TaxRule['rounding'],
  roundTo?: number
): number {
  let remaining = base;
  let total = 0;
  for (const tier of tiers) {
    if (remaining <= 0) break;
    const tierBase = tier.upto != null ? Math.min(remaining, tier.upto) : remaining;
    let amt = 0;
    if (tier.rate != null) amt += tierBase * (tier.rate / 100);
    if (tier.fixed != null) amt += tier.fixed;
    if (rounding && roundTo) {
      const m = 1 / roundTo;
      if (rounding === 'nearest') amt = Math.round(amt * m) / m;
      if (rounding === 'down') amt = Math.floor(amt * m) / m;
      if (rounding === 'up') amt = Math.ceil(amt * m) / m;
    }
    total += amt;
    remaining -= tierBase;
  }
  return total;
}

interface ComplianceState {
  country: string;
  taxRules: TaxRule[];
  taxTypes: TaxType[];
  reportingRules: ReportingRule[];
  transactions: ComplianceTransaction[];
  reports: ComplianceReport[];
  isLoading: boolean;
  error: string | null;
  
  // Actions
  setCountry: (code: string) => Promise<void>;
  syncCountryFromSetup: () => Promise<void>;
  getActiveRules: () => TaxRule[];
  getTaxTypesByContext: (domain?: TaxType['domain'], operation?: TaxType['operation']) => TaxType[];
  getActiveReports: () => ReportingRule[];
  addTransaction: (transaction: Omit<ComplianceTransaction, 'id'>) => void;
  updateReport: (id: string, updates: Partial<ComplianceReport>) => void;
  calculateTax: (
    amount: number,
    category?: string,
    context?: Record<string, any>
  ) => { taxes: TaxLineItem[]; total: number };
  getComplianceScore: () => number;
}

export const useComplianceStore = create<ComplianceState>((set, get) => ({
  country: typeof window !== 'undefined' ? resolveComplianceCountry() : DEFAULT_COMPLIANCE_COUNTRY,
  taxRules: [],
  taxTypes: [],
  reportingRules: [],
  transactions: [],
  reports: [],
  isLoading: false,
  error: null,

  setCountry: async (code) => {
    set({ isLoading: true, error: null });

    const applySeedFallback = (reason: string) => {
      const taxRules = getSeedTaxes().filter((t) => t.countryCode === code) as unknown as TaxRule[];
      const reportingRules = getSeedReports().filter((r) => r.countryCode === code) as unknown as ReportingRule[];
      set({
        country: code,
        taxRules,
        taxTypes: [],
        reportingRules,
        isLoading: false,
        error: reason,
      });
      void import('../accounting/taxRuleAccountingSync').then(({ resyncCountryTaxRulesToAccounting }) => {
        resyncCountryTaxRulesToAccounting(taxRules, code);
      });
    };

    try {
      const [taxRes, typeRes, reportRes] = await Promise.all([
        fetch(`/api/compliance/taxes?country=${code}`),
        fetch(`/api/compliance/tax-types?country=${code}`),
        fetch(`/api/compliance/reports?country=${code}`),
      ]);

      const unauthorized =
        taxRes.status === 401 || typeRes.status === 401 || reportRes.status === 401;

      if (unauthorized) {
        applySeedFallback('Using default tax schedules (log in to save changes).');
        return;
      }

      if (!taxRes.ok || !typeRes.ok || !reportRes.ok) {
        const parts = [
          !taxRes.ok ? `tax rules (${taxRes.status})` : null,
          !typeRes.ok ? `tax types (${typeRes.status})` : null,
          !reportRes.ok ? `filing schedules (${reportRes.status})` : null,
        ].filter(Boolean);
        throw new Error(`Failed to fetch compliance data: ${parts.join(', ')}`);
      }

      const [taxRules, taxTypes, reportingRules] = await Promise.all([
        taxRes.json(),
        typeRes.json(),
        reportRes.json(),
      ]);

      set({
        country: code,
        taxRules,
        taxTypes,
        reportingRules,
        isLoading: false,
        error: null,
      });

      void import('../accounting/taxRuleAccountingSync').then(({ resyncCountryTaxRulesToAccounting }) => {
        resyncCountryTaxRulesToAccounting(taxRules as TaxRule[], code);
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      if (getSeedTaxes().some((t) => t.countryCode === code)) {
        applySeedFallback(`${msg} — showing default schedules.`);
      } else {
        set({
          error: msg,
          isLoading: false,
        });
      }
    }
  },

  syncCountryFromSetup: async () => {
    const state = get();
    if (state.isLoading) return;
    const code = resolveComplianceCountry();
    const current = state.country;
    const countryTaxRules = state.taxRules.filter((r) => r.countryCode === code);
    const countryReports = state.reportingRules.filter((r) => r.countryCode === code);
    const needsLoad =
      code !== current || countryTaxRules.length === 0 || countryReports.length === 0;
    if (needsLoad) {
      await get().setCountry(code);
    } else if (countryTaxRules.length > 0) {
      void import('../accounting/taxRuleAccountingSync').then(({ resyncCountryTaxRulesToAccounting }) => {
        resyncCountryTaxRulesToAccounting(countryTaxRules, code);
      });
    }
  },

  getActiveRules: () => {
    return get().taxRules.filter(rule => rule.countryCode === get().country);
  },

  getActiveReports: () => {
    return get().reportingRules.filter(
      (report) => report.countryCode === get().country && report.isActive !== false
    );
  },

  getTaxTypesByContext: (domain, operation) => {
    const types = get().taxTypes.filter(t => t.countryCode === get().country);
    return types.filter(t => {
      const domainOk = !domain || !t.domain || t.domain === domain || t.domain === 'custom';
      const opKind = operation || 'external';
      const op = t.operation || 'both';
      const operationOk = op === 'both' || op === opKind;
      return domainOk && operationOk;
    });
  },

  addTransaction: (transaction) => {
    const newTransaction: ComplianceTransaction = {
      ...transaction,
      id: Date.now().toString(),
      timestamp: new Date().toISOString()
    };
    
    set(state => ({
      transactions: [...state.transactions, newTransaction]
    }));
  },

  updateReport: (id, updates) => {
    set(state => ({
      reports: state.reports.map(report => 
        report.id === id ? { ...report, ...updates } : report
      )
    }));
  },

  calculateTax: (amount, category = 'ALL', context = {}) => {
    const rules = get().getActiveRules();
    
    // Sort by priority; default to 100 if undefined
    const sortedRules = [...rules].sort((a, b) => (a.priority ?? 100) - (b.priority ?? 100));
    
    // Filter by enabled, time window, appliesTo, and optional condition
    const now = new Date();
    const isEffective = (r: TaxRule) => {
      const fromOk = !r.effectiveFrom || new Date(r.effectiveFrom) <= now;
      const toOk = !r.effectiveTo || new Date(r.effectiveTo) >= now;
      return fromOk && toOk && (r.enabled !== false);
    };
    const inScope = (r: TaxRule) => {
      const applies = !r.appliesTo || r.appliesTo.includes('ALL') || r.appliesTo.includes(category);
      const roomOk = !r.scope?.roomTypes || !context.roomType || r.scope.roomTypes.includes(context.roomType);
      const guestOk = !r.scope?.guestTypes || !context.guestType || r.scope.guestTypes.includes(context.guestType);
      const domainOk = !r.domain || r.domain === (context.domain || 'sales') || r.domain === 'custom';
      const op = (r.operation || 'both');
      const opKind = (context.operation || 'external');
      const operationOk = op === 'both' || op === opKind;
      const typeOk = !context?.typeId || (r as any).typeId === context.typeId;
      const condOk = !r.condition || evalCondition(context, r.condition);
      return applies && roomOk && guestOk && domainOk && operationOk && typeOk && condOk;
    };
    
    const activeRules = sortedRules.filter(r => isEffective(r) && inScope(r));

    let runningBase = amount;
    const taxes: TaxLineItem[] = [];
    let addTotal = 0;
    let subtractTotal = 0;
    for (const rule of activeRules) {
      const baseType = rule.calculationBase || 'subtotal';
      const base = computeBase(baseType, amount, runningBase, context);
      let raw = 0;
      let employerAmount: number | undefined;
      const method = rule.method || 'rate';
      if (method === 'fixed') {
        raw = rule.fixedAmount ?? 0;
      } else if (method === 'tiered' && Array.isArray(rule.tiers) && rule.tiers.length) {
        raw = computeTiered(base, rule.tiers, rule.rounding, rule.roundTo);
      } else {
        // Clamp the base for statutory schemes with an insurable-earnings floor/ceiling
        // (e.g. SSNIT). Undefined on every rule that doesn't declare them, so this is a
        // no-op for existing sales/purchases tax rules.
        let clampedBase = base;
        if (typeof rule.floor === 'number' && clampedBase > 0) clampedBase = Math.max(clampedBase, rule.floor);
        if (typeof rule.ceiling === 'number') clampedBase = Math.min(clampedBase, rule.ceiling);
        raw = clampedBase * ((rule.rate ?? 0) / 100);
        if (typeof rule.employerRate === 'number') {
          employerAmount = clampedBase * (rule.employerRate / 100);
        }
      }
      if (rule.rounding && rule.roundTo) {
        const m = 1 / rule.roundTo;
        if (rule.rounding === 'nearest') raw = Math.round(raw * m) / m;
        if (rule.rounding === 'down') raw = Math.floor(raw * m) / m;
        if (rule.rounding === 'up') raw = Math.ceil(raw * m) / m;
      }
      // Final safety-net rounding to the cent — currency amounts are never fractions of a
      // pesewa, and without this, chained percentage math accumulates float artifacts like
      // 123.44999999999998 by the time it reaches a payslip or invoice line.
      raw = Math.round(raw * 100) / 100;
      if (typeof employerAmount === 'number') employerAmount = Math.round(employerAmount * 100) / 100;
      taxes.push({
        ruleId: rule.id,
        name: rule.name,
        amount: raw,
        glCode: rule.glCode,
        rate: rule.rate ?? 0,
        employerAmount,
      });
      const effect = rule.effect || 'add';
      if (effect === 'add') addTotal += raw;
      else if (effect === 'subtract') subtractTotal += raw;
      if ((rule.stacking || 'additive') === 'compound' && effect === 'add') {
        runningBase += raw;
      }
    }
    const total = Math.round((amount + addTotal - subtractTotal) * 100) / 100;
    return { taxes, total };
  },

  getComplianceScore: () => {
    const schedules = get().reportingRules.filter(
      (r) => r.countryCode === get().country && r.isActive !== false
    );
    if (schedules.length === 0) return 100;

    const filings = get().reports.filter((r) => r.countryCode === get().country);
    // Active schedules exist but nothing has ever been filed/tracked against them — that's the
    // opposite of "fully compliant", not a reason to show 100%.
    if (filings.length === 0) return 0;

    const submittedReports = filings.filter((r) => r.status === 'submitted' || r.status === 'approved').length;
    const pendingReports = filings.filter((r) => r.status === 'pending').length;

    let score = (submittedReports / filings.length) * 80;
    if (pendingReports > 0) {
      score += (pendingReports / filings.length) * 20;
    }

    return Math.round(score);
  },
}));
