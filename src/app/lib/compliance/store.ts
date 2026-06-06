import { create } from 'zustand';
import { TaxRule, ReportingRule, ComplianceTransaction, ComplianceReport, TaxType } from '../models';
import { computeSalesTax } from '../tax/engine';

export interface TaxLineItem {
  name: string;
  amount: number;
  glCode: string;
  rate: number;
  isExempt?: boolean;
  exemptionReason?: string;
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
  getActiveRules: () => TaxRule[];
  getTaxTypesByContext: (domain?: TaxType['domain'], operation?: TaxType['operation']) => TaxType[];
  getActiveReports: () => ComplianceReport[];
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
  country: 'GH', // Default to Ghana
  taxRules: [],
  taxTypes: [],
  reportingRules: [],
  transactions: [],
  reports: [],
  isLoading: false,
  error: null,

  setCountry: async (code) => {
    set({ isLoading: true, error: null });
    
    try {
      const [taxRes, typeRes, reportRes] = await Promise.all([
        fetch(`/api/compliance/taxes?country=${code}`),
        fetch(`/api/compliance/tax-types?country=${code}`),
        fetch(`/api/compliance/reports?country=${code}`)
      ]);
      
      if (!taxRes.ok || !typeRes.ok || !reportRes.ok) {
        throw new Error('Failed to fetch compliance data');
      }
      
      const [taxRules, taxTypes, reportingRules] = await Promise.all([
        taxRes.json(),
        typeRes.json(),
        reportRes.json()
      ]);
      
      set({
        country: code,
        taxRules,
        taxTypes,
        reportingRules,
        isLoading: false
      });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        isLoading: false 
      });
    }
  },

  getActiveRules: () => {
    return get().taxRules.filter(rule => rule.countryCode === get().country);
  },

  getActiveReports: () => {
    return get().reports.filter(report => report.countryCode === get().country);
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
    const country = get().country;
    
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
    
    if (country === 'GH') {
      const { lines, totalTax, gross } = computeSalesTax(amount);
      const taxes: TaxLineItem[] = lines.map((l) => ({
        name: l.name,
        amount: l.amount,
        glCode: l.glAccountCode,
        rate: l.rate,
      }));
      return { taxes, total: gross };
    } else {
      // General rule engine: respects calculationBase, method, tiers, stacking, rounding, and effect
      let runningBase = amount;
      const taxes: TaxLineItem[] = [];
      let addTotal = 0;
      let subtractTotal = 0;
      for (const rule of activeRules) {
        const baseType = rule.calculationBase || 'subtotal';
        const base = computeBase(baseType, amount, runningBase, context);
        let raw = 0;
        const method = rule.method || 'rate';
        if (method === 'fixed') {
          raw = rule.fixedAmount ?? 0;
        } else if (method === 'tiered' && Array.isArray(rule.tiers) && rule.tiers.length) {
          raw = computeTiered(base, rule.tiers, rule.rounding, rule.roundTo);
        } else {
          raw = base * ((rule.rate ?? 0) / 100);
        }
        // Optional rounding
        if (rule.rounding && rule.roundTo) {
          const m = 1 / rule.roundTo;
          if (rule.rounding === 'nearest') raw = Math.round(raw * m) / m;
          if (rule.rounding === 'down') raw = Math.floor(raw * m) / m;
          if (rule.rounding === 'up') raw = Math.ceil(raw * m) / m;
        }
        taxes.push({ name: rule.name, amount: raw, glCode: rule.glCode, rate: rule.rate ?? 0 });
        const effect = rule.effect || 'add';
        if (effect === 'add') addTotal += raw;
        else if (effect === 'subtract') subtractTotal += raw;
        // exclude_total and informational do not alter totals
        if ((rule.stacking || 'additive') === 'compound' && effect === 'add') {
          runningBase += raw;
        }
      }
      const total = amount + addTotal - subtractTotal;
      return { taxes, total };
    }
  },

  getComplianceScore: () => {
    const reports = get().getActiveReports();
    if (reports.length === 0) return 100;
    
    const submittedReports = reports.filter(r => r.status === 'submitted' || r.status === 'approved').length;
    const pendingReports = reports.filter(r => r.status === 'pending').length;
    
    let score = (submittedReports / reports.length) * 80;
    if (pendingReports > 0) {
      score += (pendingReports / reports.length) * 20;
    }
    
    return Math.round(score);
  }
}));
