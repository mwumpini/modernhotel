import { create } from 'zustand';
import { PayrollPeriod, PayrollRecord } from './models';

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
}

export const usePayrollStore = create<PayrollStore>((set, get) => ({
  payrollPeriods: [
    {
      id: '1',
      periodNumber: 'PP-2024-01',
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-01-31'),
      status: 'paid',
      totalGrossPay: 75000,
      totalNetPay: 60000,
      totalDeductions: 15000,
      totalTaxes: 10000,
      employeeCount: 25,
      processedAt: new Date('2024-02-01'),
      processedBy: 'HR001',
      approvedAt: new Date('2024-02-02'),
      approvedBy: 'MGMT001',
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-02-02')
    },
    {
      id: '2',
      periodNumber: 'PP-2024-02',
      startDate: new Date('2024-02-01'),
      endDate: new Date('2024-02-29'),
      status: 'paid',
      totalGrossPay: 72000,
      totalNetPay: 57600,
      totalDeductions: 14400,
      totalTaxes: 9600,
      employeeCount: 24,
      processedAt: new Date('2024-03-01'),
      processedBy: 'HR001',
      approvedAt: new Date('2024-03-02'),
      approvedBy: 'MGMT001',
      createdAt: new Date('2024-02-01'),
      updatedAt: new Date('2024-03-02')
    },
    {
      id: '3',
      periodNumber: 'PP-2024-03',
      startDate: new Date('2024-03-01'),
      endDate: new Date('2024-03-31'),
      status: 'draft',
      totalGrossPay: 0,
      totalNetPay: 0,
      totalDeductions: 0,
      totalTaxes: 0,
      employeeCount: 25,
      processedAt: undefined,
      processedBy: undefined,
      approvedAt: undefined,
      approvedBy: undefined,
      createdAt: new Date('2024-03-01'),
      updatedAt: new Date('2024-03-01')
    }
  ],

  payrollRecords: [
    {
      id: '1',
      payrollPeriodId: '1',
      employeeId: '1',
      employeeNumber: 'EMP001',
      employeeName: 'John Doe',
      department: 'Front Office',
      position: 'Front Office Manager',
      basicSalary: 2500,
      allowances: 180,
      overtimePay: 180,
      bonuses: 0,
      grossPay: 2680,
      deductions: {
        tax: 268,
        socialSecurity: 134,
        healthInsurance: 100,
        pension: 134,
        other: 0
      },
      netPay: 2044,
      bankAccount: '1234567890',
      paymentMethod: 'bank_transfer',
      status: 'paid',
      paidAt: new Date('2024-02-01'),
      notes: 'Regular monthly payroll',
      createdAt: new Date('2024-01-31'),
      updatedAt: new Date('2024-02-01')
    },
    {
      id: '2',
      payrollPeriodId: '1',
      employeeId: '2',
      employeeNumber: 'EMP002',
      employeeName: 'Sarah Johnson',
      department: 'Food & Beverage',
      position: 'Head Chef',
      basicSalary: 2800,
      allowances: 200,
      overtimePay: 324,
      bonuses: 0,
      grossPay: 3124,
      deductions: {
        tax: 312.4,
        socialSecurity: 156.2,
        healthInsurance: 100,
        pension: 156.2,
        other: 0
      },
      netPay: 2399.2,
      bankAccount: '0987654321',
      paymentMethod: 'bank_transfer',
      status: 'paid',
      paidAt: new Date('2024-02-01'),
      notes: 'Regular monthly payroll',
      createdAt: new Date('2024-01-31'),
      updatedAt: new Date('2024-02-01')
    },
    {
      id: '3',
      payrollPeriodId: '1',
      employeeId: '3',
      employeeNumber: 'EMP003',
      employeeName: 'Michael Chen',
      department: 'Housekeeping',
      position: 'Housekeeping Supervisor',
      basicSalary: 2200,
      allowances: 150,
      overtimePay: 84,
      bonuses: 0,
      grossPay: 2284,
      deductions: {
        tax: 228.4,
        socialSecurity: 114.2,
        healthInsurance: 100,
        pension: 114.2,
        other: 0
      },
      netPay: 1727.2,
      bankAccount: '1122334455',
      paymentMethod: 'bank_transfer',
      status: 'paid',
      paidAt: new Date('2024-02-01'),
      notes: 'Regular monthly payroll',
      createdAt: new Date('2024-01-31'),
      updatedAt: new Date('2024-02-01')
    }
  ],

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
    return newPeriod;
  },

  updatePayrollPeriod: (id, updates) => {
    set((state) => ({
      payrollPeriods: state.payrollPeriods.map(period =>
        period.id === id ? { ...period, ...updates, updatedAt: new Date() } : period
      )
    }));
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
  },

  updatePayrollRecord: (id, updates) => {
    set((state) => ({
      payrollRecords: state.payrollRecords.map(record =>
        record.id === id ? { ...record, ...updates, updatedAt: new Date() } : record
      )
    }));
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
    set((state) => ({
      payrollPeriods: state.payrollPeriods.map(period =>
        period.id === periodId 
          ? { 
              ...period, 
              status: 'processing', 
              processedAt: new Date(), 
              updatedAt: new Date() 
            } 
          : period
      )
    }));
  },

  approvePayroll: (periodId, approvedBy) => {
    set((state) => ({
      payrollPeriods: state.payrollPeriods.map(period =>
        period.id === periodId 
          ? { 
              ...period, 
              status: 'approved', 
              approvedAt: new Date(), 
              approvedBy, 
              updatedAt: new Date() 
            } 
          : period
      )
    }));
  },

  markAsPaid: (recordId) => {
    set((state) => ({
      payrollRecords: state.payrollRecords.map(record =>
        record.id === recordId 
          ? { 
              ...record, 
              status: 'paid', 
              paidAt: new Date(), 
              updatedAt: new Date() 
            } 
          : record
      )
    }));
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
  }
}));
