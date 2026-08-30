import { create } from 'zustand';
import { PayrollPeriod, PayrollRecord } from './models';
import { getClientTenantSubdomain } from '../api/clientTenant';
import { normalizeTenantSubdomain } from '../api/tenantSubdomain';

function hrTenantHeaders(): HeadersInit {
  const sub = normalizeTenantSubdomain(getClientTenantSubdomain());
  return { 'x-tenant-subdomain': sub, 'x-tenant-id': sub, 'Content-Type': 'application/json' };
}
function syncPayrollPeriodToApi(period: PayrollPeriod) {
  if (typeof window === 'undefined') return;
  fetch('/api/hr/payroll-periods', { method: 'POST', headers: hrTenantHeaders(), body: JSON.stringify(period) })
    .catch((e) => console.warn('[HR] Failed to sync payroll period to server:', e));
}
function syncPayrollRecordToApi(record: PayrollRecord) {
  if (typeof window === 'undefined') return;
  fetch('/api/hr/payroll-records', { method: 'POST', headers: hrTenantHeaders(), body: JSON.stringify(record) })
    .catch((e) => console.warn('[HR] Failed to sync payroll record to server:', e));
}

interface PayrollStore {
  payrollPeriods: PayrollPeriod[];
  payrollRecords: PayrollRecord[];
  selectedPeriod: PayrollPeriod | null;
  selectedRecord: PayrollRecord | null;

  // Payroll Period Management
  createPayrollPeriod: (period: Omit<PayrollPeriod, 'id' | 'createdAt' | 'updatedAt'>) => PayrollPeriod;
  updatePayrollPeriod: (id: string, updates: Partial<PayrollPeriod>) => void;
  deletePayrollPeriod: (id: string) => void;
  getPayrollPeriod: (id: string) => PayrollPeriod | undefined;

  // Payroll Record Management
  createPayrollRecord: (record: Omit<PayrollRecord, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updatePayrollRecord: (id: string, updates: Partial<PayrollRecord>) => void;
  deletePayrollRecord: (id: string) => void;
  getPayrollRecord: (id: string) => PayrollRecord | undefined;

  // Payroll Processing
  processPayroll: (periodId: string) => void;
  approvePayroll: (periodId: string, approvedBy: string) => void;
  markAsPaid: (recordId: string) => void;

  // Search and Filtering
  getPayrollRecordsByPeriod: (periodId: string) => PayrollRecord[];
  getPayrollRecordsByEmployee: (employeeId: string) => PayrollRecord[];
  getPayrollRecordsByStatus: (status: PayrollRecord['status']) => PayrollRecord[];
  getPayrollRecordsByDateRange: (startDate: Date, endDate: Date) => PayrollRecord[];

  // Analytics
  getPayrollAnalytics: (period: 'daily' | 'weekly' | 'monthly') => {
    totalPayroll: number;
    totalGrossPay: number;
    totalNetPay: number;
    totalDeductions: number;
    totalTaxes: number;
    averageSalary: number;
    payrollByDepartment: Record<string, number>;
    payrollByStatus: Record<string, number>;
    deductionsBreakdown: Record<string, number>;
    trends: Array<{
      date: Date;
      totalPayroll: number;
      employeeCount: number;
      averageSalary: number;
    }>;
  };

  // Selection
  selectPayrollPeriod: (period: PayrollPeriod | null) => void;
  selectPayrollRecord: (record: PayrollRecord | null) => void;

  hydrateFromApi: () => Promise<void>;
}

export const usePayrollStore = create<PayrollStore>((set, get) => ({
  // Empty initial state — hydrateFromApi() below replaces this with real data on mount.
  // Never seed with fake records: a slow/failed fetch must show an honest empty state,
  // not fabricated payroll history.
  payrollPeriods: [],

  payrollRecords: [],

  selectedPeriod: null,
  selectedRecord: null,

  // Payroll Period Management
  createPayrollPeriod: (period) => {
    const newPeriod: PayrollPeriod = {
      ...period,
      id: Date.now().toString(),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    console.log('[HR][Payroll][Store] createPayrollPeriod: Creating new period', {
      id: newPeriod.id,
      periodNumber: newPeriod.periodNumber,
      startDate: newPeriod.startDate,
      endDate: newPeriod.endDate,
      status: newPeriod.status
    });
    set((state) => ({
      payrollPeriods: [...state.payrollPeriods, newPeriod]
    }));
    console.log('[HR][Payroll][Store] createPayrollPeriod: Period created successfully', newPeriod.id);
    syncPayrollPeriodToApi(newPeriod);
    return newPeriod;
  },

  updatePayrollPeriod: (id, updates) => {
    let updated: PayrollPeriod | undefined;
    set((state) => ({
      payrollPeriods: state.payrollPeriods.map(period => {
        if (period.id !== id) return period;
        updated = { ...period, ...updates, updatedAt: new Date() };
        return updated;
      })
    }));
    if (updated) syncPayrollPeriodToApi(updated);
  },

  deletePayrollPeriod: (id) => {
    set((state) => ({
      payrollPeriods: state.payrollPeriods.filter(period => period.id !== id)
    }));
  },

  getPayrollPeriod: (id) => {
    return get().payrollPeriods.find(period => period.id === id);
  },

  // Payroll Record Management
  createPayrollRecord: (record) => {
    const newRecord: PayrollRecord = {
      ...record,
      id: Date.now().toString(),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    set((state) => ({
      payrollRecords: [...state.payrollRecords, newRecord]
    }));
    syncPayrollRecordToApi(newRecord);
  },

  updatePayrollRecord: (id, updates) => {
    let updated: PayrollRecord | undefined;
    set((state) => ({
      payrollRecords: state.payrollRecords.map(record => {
        if (record.id !== id) return record;
        updated = { ...record, ...updates, updatedAt: new Date() };
        return updated;
      })
    }));
    if (updated) syncPayrollRecordToApi(updated);
  },

  deletePayrollRecord: (id) => {
    set((state) => ({
      payrollRecords: state.payrollRecords.filter(record => record.id !== id)
    }));
  },

  getPayrollRecord: (id) => {
    return get().payrollRecords.find(record => record.id === id);
  },

  // Payroll Processing
  processPayroll: (periodId) => {
    let updated: PayrollPeriod | undefined;
    set((state) => ({
      payrollPeriods: state.payrollPeriods.map(period => {
        if (period.id !== periodId) return period;
        updated = { ...period, status: 'processing', processedAt: new Date(), updatedAt: new Date() };
        return updated;
      })
    }));
    if (updated) syncPayrollPeriodToApi(updated);
  },

  approvePayroll: (periodId, approvedBy) => {
    let updated: PayrollPeriod | undefined;
    set((state) => ({
      payrollPeriods: state.payrollPeriods.map(period => {
        if (period.id !== periodId) return period;
        updated = { ...period, status: 'approved', approvedAt: new Date(), approvedBy, updatedAt: new Date() };
        return updated;
      })
    }));
    if (updated) syncPayrollPeriodToApi(updated);
  },

  markAsPaid: (recordId) => {
    let updated: PayrollRecord | undefined;
    set((state) => ({
      payrollRecords: state.payrollRecords.map(record => {
        if (record.id !== recordId) return record;
        updated = { ...record, status: 'paid', paidAt: new Date(), updatedAt: new Date() };
        return updated;
      })
    }));
    if (updated) syncPayrollRecordToApi(updated);
  },

  // Search and Filtering
  getPayrollRecordsByPeriod: (periodId) => {
    return get().payrollRecords.filter(record => record.payrollPeriodId === periodId);
  },

  getPayrollRecordsByEmployee: (employeeId) => {
    return get().payrollRecords.filter(record => record.employeeId === employeeId);
  },

  getPayrollRecordsByStatus: (status) => {
    return get().payrollRecords.filter(record => record.status === status);
  },

  getPayrollRecordsByDateRange: (startDate, endDate) => {
    return get().payrollRecords.filter(record => {
      if (!record.paidAt) return false;
      const paymentDate = new Date(record.paidAt);
      return paymentDate >= startDate && paymentDate <= endDate;
    });
  },

  // Analytics
  getPayrollAnalytics: (period) => {
    const records = get().payrollRecords.filter(record => record.status === 'paid');
    
    const totalPayroll = records.reduce((sum, record) => sum + record.netPay, 0);
    const totalGrossPay = records.reduce((sum, record) => sum + record.grossPay, 0);
    const totalNetPay = records.reduce((sum, record) => sum + record.netPay, 0);
    const totalDeductions = records.reduce((sum, record) => {
      const recordDeductions = Object.values(record.deductions).reduce((a, b) => a + b, 0);
      return sum + recordDeductions;
    }, 0);
    const totalTaxes = records.reduce((sum, record) => sum + record.deductions.tax, 0);
    const averageSalary = records.length > 0 ? totalGrossPay / records.length : 0;
    
    const payrollByDepartment: Record<string, number> = {};
    const payrollByStatus: Record<string, number> = {};
    const deductionsBreakdown: Record<string, number> = {};
    
    records.forEach(record => {
      payrollByDepartment[record.department] = (payrollByDepartment[record.department] || 0) + record.netPay;
      payrollByStatus[record.status] = (payrollByStatus[record.status] || 0) + record.netPay;
      
      Object.entries(record.deductions).forEach(([key, value]) => {
        deductionsBreakdown[key] = (deductionsBreakdown[key] || 0) + value;
      });
    });
    
    // Generate trends for the last 6 months
    const trends = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthRecords = records.filter(record => {
        if (!record.paidAt) return false;
        const recordDate = new Date(record.paidAt);
        return recordDate.getMonth() === date.getMonth() && recordDate.getFullYear() === date.getFullYear();
      });
      
      const monthTotal = monthRecords.reduce((sum, record) => sum + record.netPay, 0);
      const monthAverage = monthRecords.length > 0 ? monthTotal / monthRecords.length : 0;
      
      trends.push({
        date,
        totalPayroll: monthTotal,
        employeeCount: monthRecords.length,
        averageSalary: monthAverage
      });
    }
    
    return {
      totalPayroll,
      totalGrossPay,
      totalNetPay,
      totalDeductions,
      totalTaxes,
      averageSalary,
      payrollByDepartment,
      payrollByStatus,
      deductionsBreakdown,
      trends
    };
  },

  // Selection
  selectPayrollPeriod: (period) => {
    set({ selectedPeriod: period });
  },

  selectPayrollRecord: (record) => {
    set({ selectedRecord: record });
  },

  hydrateFromApi: async () => {
    if (typeof window === 'undefined') return;
    try {
      const headers = hrTenantHeaders();
      const dateFields = ['startDate', 'endDate', 'processedAt', 'approvedAt', 'paidAt', 'createdAt', 'updatedAt'];
      const toDates = (row: any) => {
        const out = { ...row };
        for (const f of dateFields) if (out[f]) out[f] = new Date(out[f]);
        return out;
      };
      const [periodsRes, recordsRes] = await Promise.all([
        fetch('/api/hr/payroll-periods', { headers, cache: 'no-store' }),
        fetch('/api/hr/payroll-records', { headers, cache: 'no-store' }),
      ]);
      if (periodsRes.ok) {
        const data = await periodsRes.json();
        if (Array.isArray(data.payrollPeriods)) {
          set({ payrollPeriods: data.payrollPeriods.map(toDates) });
        }
      }
      if (recordsRes.ok) {
        const data = await recordsRes.json();
        if (Array.isArray(data.payrollRecords)) {
          set({ payrollRecords: data.payrollRecords.map(toDates) });
        }
      }
    } catch (e) {
      console.warn('[HR] Failed to hydrate payroll periods/records from server:', e);
    }
  },
}));
