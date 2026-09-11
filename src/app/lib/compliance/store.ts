import { create } from 'zustand';
import { TaxRule, ReportingRule, ComplianceTransaction, ComplianceReport, TaxType } from '../models';
import { DEFAULT_COMPLIANCE_COUNTRY, getSeedReports, getSeedTaxes } from './config';
import { resolveComplianceCountry } from './resolveCountry';
import { getClientTenantSubdomain } from '../api/clientTenant';
import { normalizeTenantSubdomain } from '../api/tenantSubdomain';
import { computeTaxStack, TaxLineItem } from './calcEngine';

function complianceTenantHeaders(): HeadersInit {
  const sub = normalizeTenantSubdomain(getClientTenantSubdomain());
  return { 'x-tenant-subdomain': sub, 'x-tenant-id': sub, 'Content-Type': 'application/json' };
}

// Best-effort background persistence -- filing status (this tenant's real submitted/approved
// VAT/PAYE/SSNIT returns) previously lived only in this in-memory store, so both the
// auto-synced entries from payroll/tax-remittance sync and manual Submit/Approve clicks in
// ComplianceReportsPanel.tsx vanished on reload.
function syncReportUpsertToApi(report: Omit<ComplianceReport, 'id'>) {
  if (typeof window === 'undefined') return;
  fetch('/api/compliance/report-filings', {
    method: 'POST',
    headers: complianceTenantHeaders(),
    body: JSON.stringify(report),
  }).catch((e) => console.warn('[Compliance] Failed to sync report filing to server:', e));
}

function syncReportUpdateToApi(id: string, updates: Partial<ComplianceReport>) {
  if (typeof window === 'undefined') return;
  fetch('/api/compliance/report-filings', {
    method: 'PATCH',
    headers: complianceTenantHeaders(),
    body: JSON.stringify({ id, updates }),
  }).catch((e) => console.warn('[Compliance] Failed to sync report filing update to server:', e));
}

export type { TaxLineItem };

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
  upsertReport: (report: Omit<ComplianceReport, 'id'>) => void;
  hydrateReportFilingsFromApi: () => Promise<void>;
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
        fetch(`/api/compliance/taxes?country=${code}`, { headers: complianceTenantHeaders() }),
        fetch(`/api/compliance/tax-types?country=${code}`, { headers: complianceTenantHeaders() }),
        fetch(`/api/compliance/reports?country=${code}`, { headers: complianceTenantHeaders() }),
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
    syncReportUpdateToApi(id, updates);
  },

  // Find-by-(country, reportType, period) then update-or-create — the one place this pattern
  // lives, shared by payroll's PAYE/SSNIT sync and tax remittance's filing sync, instead of
  // each duplicating its own find/patch/push logic.
  upsertReport: (report) => {
    set((state) => {
      const idx = state.reports.findIndex(
        (r) =>
          r.countryCode === report.countryCode &&
          r.reportType === report.reportType &&
          r.period === report.period
      );
      if (idx >= 0) {
        const next = [...state.reports];
        next[idx] = { ...next[idx], ...report };
        return { reports: next };
      }
      const id = `CR-${report.reportType}-${report.period}-${Date.now()}`;
      return { reports: [...state.reports, { id, ...report }] };
    });
    syncReportUpsertToApi(report);
  },

  hydrateReportFilingsFromApi: async () => {
    if (typeof window === 'undefined') return;
    try {
      const res = await fetch('/api/compliance/report-filings', { headers: complianceTenantHeaders(), cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.filings)) {
        set({ reports: data.filings });
      }
    } catch (e) {
      console.warn('[Compliance] Failed to hydrate report filings from server:', e);
    }
  },

  calculateTax: (amount, category = 'ALL', context = {}) => {
    return computeTaxStack(get().getActiveRules(), amount, category, context);
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
