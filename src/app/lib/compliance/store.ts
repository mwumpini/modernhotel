import { create } from 'zustand';
import { TaxRule, ReportingRule, ComplianceTransaction, ComplianceReport } from '../models';

interface ComplianceState {
  country: string;
  taxRules: TaxRule[];
  reportingRules: ReportingRule[];
  transactions: ComplianceTransaction[];
  reports: ComplianceReport[];
  isLoading: boolean;
  error: string | null;
  
  // Actions
  setCountry: (code: string) => Promise<void>;
  getActiveRules: () => TaxRule[];
  getActiveReports: () => ComplianceReport[];
  addTransaction: (transaction: Omit<ComplianceTransaction, 'id'>) => void;
  updateReport: (id: string, updates: Partial<ComplianceReport>) => void;
  calculateTax: (amount: number, category?: string) => { taxes: Array<{ name: string; amount: number; glCode: string }>; total: number };
  getComplianceScore: () => number;
}

export const useComplianceStore = create<ComplianceState>((set, get) => ({
  country: 'GH', // Default to Ghana
  taxRules: [],
  reportingRules: [],
  transactions: [],
  reports: [],
  isLoading: false,
  error: null,

  setCountry: async (code) => {
    set({ isLoading: true, error: null });
    
    try {
      const [taxRes, reportRes] = await Promise.all([
        fetch(`/api/compliance/taxes?country=${code}`),
        fetch(`/api/compliance/reports?country=${code}`)
      ]);
      
      if (!taxRes.ok || !reportRes.ok) {
        throw new Error('Failed to fetch compliance data');
      }
      
      const [taxRules, reportingRules] = await Promise.all([
        taxRes.json(),
        reportRes.json()
      ]);
      
      set({
        country: code,
        taxRules,
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

  calculateTax: (amount, category = 'ALL') => {
    const rules = get().getActiveRules();
    const country = get().country;
    
    if (country === 'GH') {
      // Ghana-specific calculation order
      const subtotal = amount;
      
      // Step 1: Calculate levies on subtotal (NHIL, GETFund, COVID-19)
      const levyRules = rules.filter(rule => 
        ['NHIL', 'GETFund Levy', 'COVID-19 Levy'].includes(rule.name)
      );
      
      const levies = levyRules.map(rule => ({
        name: rule.name,
        amount: subtotal * (rule.rate / 100),
        glCode: rule.glCode
      }));
      
      const totalLevies = levies.reduce((sum, levy) => sum + levy.amount, 0);
      const amountAfterLevies = subtotal + totalLevies; // 106 for 100 subtotal
      
      // Step 2: Calculate VAT on amount after levies
      const vatRule = rules.find(rule => rule.name === 'VAT (Standard Rate)');
      const vatAmount = vatRule ? amountAfterLevies * (vatRule.rate / 100) : 0;
      const vatTax = vatRule ? {
        name: vatRule.name,
        amount: vatAmount,
        glCode: vatRule.glCode
      } : null;
      
      // Step 3: Calculate Tourism Levy on original subtotal
      const tourismRule = rules.find(rule => rule.name === 'Tourism Levy');
      const tourismAmount = tourismRule ? subtotal * (tourismRule.rate / 100) : 0;
      const tourismTax = tourismRule ? {
        name: tourismRule.name,
        amount: tourismAmount,
        glCode: tourismRule.glCode
      } : null;
      
      // Combine all taxes
      const allTaxes = [...levies];
      if (vatTax) allTaxes.push(vatTax);
      if (tourismTax) allTaxes.push(tourismTax);
      
      const totalTax = allTaxes.reduce((sum, tax) => sum + tax.amount, 0);
      const total = subtotal + totalTax;
      
      return { taxes: allTaxes, total };
    } else {
      // Standard calculation for other countries
      const applicableRules = rules.filter(rule => 
        !rule.appliesTo || rule.appliesTo.includes('ALL') || rule.appliesTo.includes(category)
      );
      
      const taxes = applicableRules.map(rule => ({
        name: rule.name,
        amount: amount * (rule.rate / 100),
        glCode: rule.glCode
      }));

      const totalTax = taxes.reduce((sum, tax) => sum + tax.amount, 0);
      return { taxes, total: amount + totalTax };
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
