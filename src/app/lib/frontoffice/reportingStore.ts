'use client';

import { create } from 'zustand';
import { frontOfficeStore } from './store';
import { housekeepingStore } from '../housekeeping/store';
import { trackEvent } from '../analytics/trackEvent';

// Report Types
export interface ReportConfig {
  id: string;
  name: string;
  category: 'daily-operations' | 'financial-auditing' | 'management-strategy' | 'internal-communication';
  description: string;
  schedule?: 'daily' | 'weekly' | 'monthly' | 'on-demand';
  recipients?: string[];
  autoGenerate?: boolean;
  exportFormats: ('pdf' | 'excel' | 'csv')[];
}

export interface ReportExecution {
  id: string;
  reportId: string;
  executedAt: string;
  executedBy: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  data?: any;
  error?: string;
  exportFormat?: 'pdf' | 'excel' | 'csv';
  fileUrl?: string;
  notes?: string;
}

export interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  template: any;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ReportingStore {
  // State
  reportConfigs: ReportConfig[];
  reportExecutions: ReportExecution[];
  reportTemplates: ReportTemplate[];
  selectedReport: ReportConfig | null;
  isGenerating: boolean;
  error: string | null;
  
  // Actions
  // Report Configuration
  addReportConfig: (config: Omit<ReportConfig, 'id'>) => void;
  updateReportConfig: (id: string, updates: Partial<ReportConfig>) => void;
  deleteReportConfig: (id: string) => void;
  getReportConfig: (id: string) => ReportConfig | undefined;
  getReportsByCategory: (category: ReportConfig['category']) => ReportConfig[];
  
  // Report Execution
  executeReport: (reportId: string, date: string, userId: string) => Promise<ReportExecution>;
  getReportExecution: (id: string) => ReportExecution | undefined;
  getExecutionsByReport: (reportId: string) => ReportExecution[];
  getExecutionsByDate: (date: string) => ReportExecution[];
  
  // Report Templates
  addReportTemplate: (template: Omit<ReportTemplate, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateReportTemplate: (id: string, updates: Partial<ReportTemplate>) => void;
  deleteReportTemplate: (id: string) => void;
  getReportTemplate: (id: string) => ReportTemplate | undefined;
  getActiveTemplates: () => ReportTemplate[];
  
  // Report Generation Methods
  generateArrivalsReport: (date: string) => any[];
  generateDeparturesReport: (date: string) => any[];
  generateRoomStatusReport: (date: string) => any[];
  generateCheckInGuestReport: (date: string) => any[];
  generateHighBalanceReport: (date: string) => any[];
  generateWakeUpCallReport: (date: string) => any[];
  generateDailyTransactionReport: (date: string) => any[];
  generateCashierReport: (date: string, cashierId: string) => any;
  generateCreditCardReconciliationReport: (date: string) => any[];
  generateGuestLedgerReport: (date: string) => any[];
  generateDailyFlashReport: (date: string) => any;
  generateOccupancyReport: (date: string) => any;
  generatePaceReport: (date: string) => any[];
  generateNoShowReport: (date: string) => any[];
  generateSourceOfBusinessReport: (startDate: string, endDate: string) => any[];
  generateMarketSegmentationReport: (startDate: string, endDate: string) => any[];
  generateGuestCountMealPlanReport: (date: string) => any[];
  generateVIPReport: (date: string) => any[];
  generateGuestHistoryReport: (guestId: string) => any;
  generateDiscountRequestReport: (startDate: string, endDate: string) => any;
  generateComplimentaryRoomReport: (startDate: string, endDate: string) => any;
  generatePricingAnalyticsReport: (startDate: string, endDate: string) => any;
  
  // Export and Print
  exportReport: (reportData: any, format: 'pdf' | 'excel' | 'csv', filename: string) => Promise<string>;
  printReport: (reportData: any, template: string) => void;
  
  // Selection
  selectReport: (report: ReportConfig | null) => void;
  setGenerating: (generating: boolean) => void;
  setError: (error: string | null) => void;
}

// Default report configurations
const defaultReportConfigs: ReportConfig[] = [
  {
    id: 'arrivals-report',
    name: 'Arrivals Report',
    category: 'daily-operations',
    description: 'List of all expected guests for the day',
    schedule: 'daily',
    autoGenerate: true,
    exportFormats: ['pdf', 'excel', 'csv']
  },
  {
    id: 'departures-report',
    name: 'Departures Report',
    category: 'daily-operations',
    description: 'List of all guests scheduled to check out',
    schedule: 'daily',
    autoGenerate: true,
    exportFormats: ['pdf', 'excel', 'csv']
  },
  {
    id: 'room-status-report',
    name: 'Room Status Report',
    category: 'daily-operations',
    description: 'Real-time overview of room cleanliness and occupancy status',
    schedule: 'daily',
    autoGenerate: true,
    exportFormats: ['pdf', 'excel', 'csv']
  },
  {
    id: 'check-in-guest-list',
    name: 'Check-In Guest List',
    category: 'daily-operations',
    description: 'Complete list of all guests currently staying at the hotel',
    schedule: 'daily',
    autoGenerate: true,
    exportFormats: ['pdf', 'excel', 'csv']
  },
  {
    id: 'high-balance-report',
    name: 'High Balance Guest Report',
    category: 'daily-operations',
    description: 'Flags guests whose account balance has exceeded credit limit',
    schedule: 'daily',
    autoGenerate: true,
    exportFormats: ['pdf', 'excel', 'csv']
  },
  {
    id: 'wake-up-call-sheet',
    name: 'Wake-up Call Sheet',
    category: 'daily-operations',
    description: 'Schedule of all requested wake-up calls',
    schedule: 'daily',
    autoGenerate: true,
    exportFormats: ['pdf', 'excel', 'csv']
  },
  {
    id: 'daily-transaction-report',
    name: 'Daily Transaction Report',
    category: 'financial-auditing',
    description: 'Log of all cash, credit, and folio transactions for the day',
    schedule: 'daily',
    autoGenerate: true,
    exportFormats: ['pdf', 'excel', 'csv']
  },
  {
    id: 'cashier-report',
    name: 'Cashier\'s Report',
    category: 'financial-auditing',
    description: 'Summary of all transactions handled by a specific front desk agent',
    schedule: 'daily',
    autoGenerate: true,
    exportFormats: ['pdf', 'excel', 'csv']
  },
  {
    id: 'credit-card-reconciliation',
    name: 'Credit Card Reconciliation Report',
    category: 'financial-auditing',
    description: 'Summary of all credit card transactions to be reconciled with the bank',
    schedule: 'daily',
    autoGenerate: true,
    exportFormats: ['pdf', 'excel', 'csv']
  },
  {
    id: 'guest-ledger-report',
    name: 'Guest Ledger Report',
    category: 'financial-auditing',
    description: 'Summary of all outstanding guest folios',
    schedule: 'daily',
    autoGenerate: true,
    exportFormats: ['pdf', 'excel', 'csv']
  },
  {
    id: 'daily-flash-report',
    name: 'Daily Flash Report (Manager\'s Report)',
    category: 'management-strategy',
    description: 'Comprehensive summary of the previous day\'s financial and operational performance',
    schedule: 'daily',
    autoGenerate: true,
    exportFormats: ['pdf', 'excel', 'csv']
  },
  {
    id: 'occupancy-report',
    name: 'Daily Occupancy Report',
    category: 'management-strategy',
    description: 'Simple report with rooms sold, total available rooms, and occupancy percentage',
    schedule: 'daily',
    autoGenerate: true,
    exportFormats: ['pdf', 'excel', 'csv']
  },
  {
    id: 'pace-report',
    name: 'Pace Report',
    category: 'management-strategy',
    description: 'Comparison of current and future booking trends to historical data',
    schedule: 'weekly',
    autoGenerate: true,
    exportFormats: ['pdf', 'excel', 'csv']
  },
  {
    id: 'no-show-report',
    name: 'No-Show Report',
    category: 'management-strategy',
    description: 'List of reservations that were not claimed',
    schedule: 'daily',
    autoGenerate: true,
    exportFormats: ['pdf', 'excel', 'csv']
  },
  {
    id: 'source-business-report',
    name: 'Source of Business Report',
    category: 'management-strategy',
    description: 'Breaks down reservations by how they were booked',
    schedule: 'weekly',
    autoGenerate: true,
    exportFormats: ['pdf', 'excel', 'csv']
  },
  {
    id: 'market-segmentation-report',
    name: 'Market Segmentation Report',
    category: 'management-strategy',
    description: 'Categorizes guests by type (leisure, business, group)',
    schedule: 'weekly',
    autoGenerate: true,
    exportFormats: ['pdf', 'excel', 'csv']
  },
  {
    id: 'guest-count-meal-plan',
    name: 'Guest Count & Meal Plan Report',
    category: 'internal-communication',
    description: 'Report for kitchen showing guest count by meal plan and dietary restrictions',
    schedule: 'daily',
    autoGenerate: true,
    exportFormats: ['pdf', 'excel', 'csv']
  },
  {
    id: 'vip-report',
    name: 'VIP Report',
    category: 'internal-communication',
    description: 'List of special guests who require personalized service',
    schedule: 'daily',
    autoGenerate: true,
    exportFormats: ['pdf', 'excel', 'csv']
  },
  {
    id: 'guest-history-report',
    name: 'Guest History Report',
    category: 'internal-communication',
    description: 'Record of a guest\'s past stays and preferences',
    schedule: 'on-demand',
    autoGenerate: false,
    exportFormats: ['pdf', 'excel', 'csv']
  },
  {
    id: 'discount-request-report',
    name: 'Discount Request Report',
    category: 'management-strategy',
    description: 'Analysis of discount requests and their impact on pricing strategy',
    schedule: 'weekly',
    autoGenerate: true,
    exportFormats: ['pdf', 'excel', 'csv']
  },
  {
    id: 'complimentary-room-report',
    name: 'Complimentary Room Report',
    category: 'management-strategy',
    description: 'Tracking of complimentary room usage and revenue impact',
    schedule: 'weekly',
    autoGenerate: true,
    exportFormats: ['pdf', 'excel', 'csv']
  },
  {
    id: 'pricing-analytics-report',
    name: 'Pricing Analytics Report',
    category: 'management-strategy',
    description: 'Comprehensive analysis of pricing strategies and market positioning',
    schedule: 'monthly',
    autoGenerate: true,
    exportFormats: ['pdf', 'excel', 'csv']
  }
];

export const useReportingStore = create<ReportingStore>((set, get) => ({
  // Initial state
  reportConfigs: defaultReportConfigs,
  reportExecutions: [],
  reportTemplates: [],
  selectedReport: null,
  isGenerating: false,
  error: null,

  // Report Configuration Actions
  addReportConfig: (config) => {
    const newConfig = { ...config, id: `report-${Date.now()}` };
    set(state => ({
      reportConfigs: [...state.reportConfigs, newConfig]
    }));
    
    trackEvent('report_config_added', { 
      report_id: newConfig.id, 
      category: newConfig.category 
    });
    console.log(`[REPORTS] Added new report config: ${newConfig.name}`);
  },

  updateReportConfig: (id, updates) => {
    set(state => ({
      reportConfigs: state.reportConfigs.map(config => 
        config.id === id ? { ...config, ...updates } : config
      )
    }));
    
    trackEvent('report_config_updated', { report_id: id });
    console.log(`[REPORTS] Updated report config: ${id}`);
  },

  deleteReportConfig: (id) => {
    set(state => ({
      reportConfigs: state.reportConfigs.filter(config => config.id !== id)
    }));
    
    trackEvent('report_config_deleted', { report_id: id });
    console.log(`[REPORTS] Deleted report config: ${id}`);
  },

  getReportConfig: (id) => {
    return get().reportConfigs.find(config => config.id === id);
  },

  getReportsByCategory: (category) => {
    return get().reportConfigs.filter(config => config.category === category);
  },

  // Report Execution Actions
  executeReport: async (reportId, date, userId) => {
    const execution: ReportExecution = {
      id: `exec-${Date.now()}`,
      reportId,
      executedAt: new Date().toISOString(),
      executedBy: userId,
      status: 'running'
    };

    set(state => ({
      reportExecutions: [...state.reportExecutions, execution],
      isGenerating: true,
      error: null
    }));

    trackEvent('report_execution_started', { 
      report_id: reportId, 
      date,
      user_id: userId 
    });
    console.log(`[REPORTS] Started executing report: ${reportId} for date: ${date}`);

    try {
      let data;
      const config = get().getReportConfig(reportId);
      
      if (!config) {
        throw new Error(`Report configuration not found: ${reportId}`);
      }

      // Generate report data based on report type
      switch (reportId) {
        case 'arrivals-report':
          data = get().generateArrivalsReport(date);
          break;
        case 'departures-report':
          data = get().generateDeparturesReport(date);
          break;
        case 'room-status-report':
          data = get().generateRoomStatusReport(date);
          break;
        case 'check-in-guest-list':
          data = get().generateCheckInGuestReport(date);
          break;
        case 'high-balance-report':
          data = get().generateHighBalanceReport(date);
          break;
        case 'wake-up-call-sheet':
          data = get().generateWakeUpCallReport(date);
          break;
        case 'daily-transaction-report':
          data = get().generateDailyTransactionReport(date);
          break;
        case 'cashier-report':
          data = get().generateCashierReport(date, userId);
          break;
        case 'credit-card-reconciliation':
          data = get().generateCreditCardReconciliationReport(date);
          break;
        case 'guest-ledger-report':
          data = get().generateGuestLedgerReport(date);
          break;
        case 'daily-flash-report':
          data = get().generateDailyFlashReport(date);
          break;
        case 'occupancy-report':
          data = get().generateOccupancyReport(date);
          break;
        case 'pace-report':
          data = get().generatePaceReport(date);
          break;
        case 'no-show-report':
          data = get().generateNoShowReport(date);
          break;
        case 'source-business-report':
          data = get().generateSourceOfBusinessReport(date, date);
          break;
        case 'market-segmentation-report':
          data = get().generateMarketSegmentationReport(date, date);
          break;
        case 'guest-count-meal-plan':
          data = get().generateGuestCountMealPlanReport(date);
          break;
        case 'vip-report':
          data = get().generateVIPReport(date);
          break;
        default:
          throw new Error(`Unknown report type: ${reportId}`);
      }

      const completedExecution: ReportExecution = {
        ...execution,
        status: 'completed',
        data
      };

      set(state => ({
        reportExecutions: state.reportExecutions.map(exec => 
          exec.id === execution.id ? completedExecution : exec
        ),
        isGenerating: false
      }));

      trackEvent('report_execution_completed', { 
        report_id: reportId, 
        date,
        user_id: userId,
        data_points: Array.isArray(data) ? data.length : 1
      });
      console.log(`[REPORTS] Successfully executed report: ${reportId} with ${Array.isArray(data) ? data.length : 1} data points`);

      return completedExecution;

    } catch (error) {
      const failedExecution: ReportExecution = {
        ...execution,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      };

      set(state => ({
        reportExecutions: state.reportExecutions.map(exec => 
          exec.id === execution.id ? failedExecution : exec
        ),
        isGenerating: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }));

      trackEvent('report_execution_failed', { 
        report_id: reportId, 
        date,
        user_id: userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      console.error(`[REPORTS] Failed to execute report: ${reportId}`, error);

      throw error;
    }
  },

  getReportExecution: (id) => {
    return get().reportExecutions.find(exec => exec.id === id);
  },

  getExecutionsByReport: (reportId) => {
    return get().reportExecutions.filter(exec => exec.reportId === reportId);
  },

  getExecutionsByDate: (date) => {
    return get().reportExecutions.filter(exec => 
      exec.executedAt.startsWith(date)
    );
  },

  // Report Template Actions
  addReportTemplate: (template) => {
    const newTemplate: ReportTemplate = {
      ...template,
      id: `template-${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    set(state => ({
      reportTemplates: [...state.reportTemplates, newTemplate]
    }));
    
    trackEvent('report_template_added', { template_id: newTemplate.id });
    console.log(`[REPORTS] Added new report template: ${newTemplate.name}`);
  },

  updateReportTemplate: (id, updates) => {
    set(state => ({
      reportTemplates: state.reportTemplates.map(template => 
        template.id === id 
          ? { ...template, ...updates, updatedAt: new Date().toISOString() }
          : template
      )
    }));
    
    trackEvent('report_template_updated', { template_id: id });
    console.log(`[REPORTS] Updated report template: ${id}`);
  },

  deleteReportTemplate: (id) => {
    set(state => ({
      reportTemplates: state.reportTemplates.filter(template => template.id !== id)
    }));
    
    trackEvent('report_template_deleted', { template_id: id });
    console.log(`[REPORTS] Deleted report template: ${id}`);
  },

  getReportTemplate: (id) => {
    return get().reportTemplates.find(template => template.id === id);
  },

  getActiveTemplates: () => {
    return get().reportTemplates.filter(template => template.isActive);
  },

  // Report Generation Methods
  generateArrivalsReport: (date) => {
    console.log(`[REPORTS] Generating arrivals report for ${date}`);
    
    return frontOfficeStore.reservations
      .filter(reservation => reservation.arrival === date && reservation.status === 'confirmed')
      .map(reservation => {
        const guest = frontOfficeStore.guests.find(g => g.id === reservation.guestId);
        const room = frontOfficeStore.rooms.find(r => r.id === reservation.roomId);
        const roomType = frontOfficeStore.roomTypes.find(rt => rt.id === reservation.roomTypeId);
        
        return {
          guestName: reservation.guestName,
          roomNumber: room?.id || 'TBD',
          roomType: roomType?.name || 'Unknown',
          arrivalTime: '14:00',
          departureDate: reservation.departure,
          adults: reservation.adults || 1,
          children: reservation.children || 0,
          specialRequests: guest?.specialRequests || [],
          vipStatus: guest?.vipStatus || 'regular',
          source: reservation.source || 'Direct',
          rate: reservation.rateBreakdown?.[0]?.total || roomType?.baseRate || 0,
          deposit: reservation.deposit?.amount || 0,
          paymentMethod: reservation.deposit?.method || 'Not specified'
        };
      });
  },

  generateDeparturesReport: (date) => {
    console.log(`[REPORTS] Generating departures report for ${date}`);
    
    return frontOfficeStore.reservations
      .filter(reservation => reservation.departure === date && reservation.status === 'checked-in')
      .map(reservation => {
        const guest = frontOfficeStore.guests.find(g => g.id === reservation.guestId);
        const room = frontOfficeStore.rooms.find(r => r.id === reservation.roomId);
        const folio = frontOfficeStore.folios.find(f => f.reservationId === reservation.id);
        
        const totalCharges = folio?.charges?.reduce((sum, charge) => sum + charge.amount, 0) || 0;
        const totalPayments = folio?.payments?.reduce((sum, payment) => sum + payment.amount, 0) || 0;
        
        return {
          guestName: reservation.guestName,
          roomNumber: room?.id || 'Unknown',
          checkoutTime: '11:00',
          totalCharges,
          totalPayments,
          balance: totalCharges - totalPayments,
          lateCheckout: false,
          folioStatus: folio?.status || 'open',
          housekeepingStatus: 'pending'
        };
      });
  },

  generateRoomStatusReport: (date) => {
    console.log(`[REPORTS] Generating room status report for ${date}`);
    
    return frontOfficeStore.rooms.map(room => {
      const reservation = frontOfficeStore.reservations.find(r => r.roomId === room.id && r.status === 'checked-in');
      const guest = reservation ? frontOfficeStore.guests.find(g => g.id === reservation.guestId) : null;
      
      return {
        roomNumber: room.id,
        status: reservation ? 'occupied' : 'vacant',
        guestName: guest?.name || undefined,
        checkInDate: reservation?.arrival || undefined,
        checkOutDate: reservation?.departure || undefined,
        housekeepingStatus: 'completed',
        maintenanceIssues: [],
        lastCleaned: new Date().toISOString().split('T')[0],
        nextCleaning: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      };
    });
  },

  generateCheckInGuestReport: (date) => {
    console.log(`[REPORTS] Generating check-in guest report for ${date}`);
    
    return frontOfficeStore.reservations
      .filter(reservation => 
        reservation.status === 'checked-in' && 
        reservation.arrival <= date && 
        reservation.departure > date
      )
      .map(reservation => {
        const guest = frontOfficeStore.guests.find(g => g.id === reservation.guestId);
        const room = frontOfficeStore.rooms.find(r => r.id === reservation.roomId);
        const folio = frontOfficeStore.folios.find(f => f.reservationId === reservation.id);
        
        const totalCharges = folio?.charges?.reduce((sum, charge) => sum + charge.amount, 0) || 0;
        const totalPayments = folio?.payments?.reduce((sum, payment) => sum + payment.amount, 0) || 0;
        const nightsStayed = Math.ceil((new Date(date).getTime() - new Date(reservation.arrival).getTime()) / (1000 * 60 * 60 * 24));
        
        return {
          guestName: reservation.guestName,
          roomNumber: room?.id || 'Unknown',
          checkInDate: reservation.arrival,
          checkOutDate: reservation.departure,
          nightsStayed,
          totalCharges,
          totalPayments,
          currentBalance: totalCharges - totalPayments,
          vipStatus: guest?.vipStatus || 'regular',
          specialRequests: guest?.specialRequests || [],
          lastActivity: new Date().toISOString()
        };
      });
  },

  generateHighBalanceReport: (date) => {
    console.log(`[REPORTS] Generating high balance report for ${date}`);
    
    const creditLimit = 5000; // Default credit limit
    
    return frontOfficeStore.reservations
      .filter(reservation => 
        reservation.status === 'checked-in' && 
        reservation.arrival <= date && 
        reservation.departure > date
      )
      .map(reservation => {
        const room = frontOfficeStore.rooms.find(r => r.id === reservation.roomId);
        const folio = frontOfficeStore.folios.find(f => f.reservationId === reservation.id);
        
        const totalCharges = folio?.charges?.reduce((sum, charge) => sum + charge.amount, 0) || 0;
        const totalPayments = folio?.payments?.reduce((sum, payment) => sum + payment.amount, 0) || 0;
        const currentBalance = totalCharges - totalPayments;
        
        const daysOverdue = Math.max(0, Math.ceil((new Date().getTime() - new Date(reservation.arrival).getTime()) / (1000 * 60 * 60 * 24)));
        
        let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
        if (currentBalance > creditLimit * 2) riskLevel = 'critical';
        else if (currentBalance > creditLimit * 1.5) riskLevel = 'high';
        else if (currentBalance > creditLimit) riskLevel = 'medium';
        
        return {
          guestName: reservation.guestName,
          roomNumber: room?.id || 'Unknown',
          currentBalance,
          creditLimit,
          daysOverdue,
          lastPayment: folio?.payments?.[folio.payments.length - 1]?.date || 'No payments',
          paymentMethod: reservation.deposit?.method || 'Not specified',
          riskLevel
        };
      })
      .filter(guest => guest.currentBalance > creditLimit);
  },

  generateWakeUpCallReport: (date) => {
    console.log(`[REPORTS] Generating wake-up call report for ${date}`);
    
    // This would typically come from a wake-up call system
    // For now, we'll return sample data
    return [
      {
        guestName: 'John Doe',
        roomNumber: '101',
        wakeUpTime: '06:00',
        date,
        status: 'scheduled' as const,
        notes: 'Early flight',
        completedBy: ''
      }
    ];
  },

  generateDailyTransactionReport: (date) => {
    console.log(`[REPORTS] Generating daily transaction report for ${date}`);
    
    const transactions: any[] = [];
    
    frontOfficeStore.folios.forEach(folio => {
      const reservation = frontOfficeStore.reservations.find(r => r.id === folio.reservationId);
      if (!reservation) return;
      
      // Add charges
      folio.charges?.forEach(charge => {
        if (charge.date === date) {
          transactions.push({
            transactionId: `charge-${charge.id}`,
            guestName: reservation.guestName,
            roomNumber: frontOfficeStore.rooms.find(r => r.id === reservation.roomId)?.id || 'Unknown',
            transactionType: 'charge' as const,
            amount: charge.amount,
            description: charge.description,
            timestamp: charge.date,
            cashier: 'System',
            paymentMethod: 'Folio',
            folioNumber: folio.id
          });
        }
      });
      
      // Add payments
      folio.payments?.forEach(payment => {
        if (payment.date === date) {
          transactions.push({
            transactionId: `payment-${payment.id}`,
            guestName: reservation.guestName,
            roomNumber: frontOfficeStore.rooms.find(r => r.id === reservation.roomId)?.id || 'Unknown',
            transactionType: 'payment' as const,
            amount: payment.amount,
            description: payment.description,
            timestamp: payment.date,
            cashier: 'System',
            paymentMethod: payment.method,
            folioNumber: folio.id
          });
        }
      });
    });
    
    return transactions;
  },

  generateCashierReport: (date, cashierId) => {
    console.log(`[REPORTS] Generating cashier report for ${date} and cashier ${cashierId}`);
    
    const transactions = get().generateDailyTransactionReport(date);
    const cashierTransactions = transactions.filter(t => t.cashier === cashierId);
    
    const totalCash = cashierTransactions
      .filter(t => t.paymentMethod === 'Cash')
      .reduce((sum, t) => sum + t.amount, 0);
    
    const totalCard = cashierTransactions
      .filter(t => t.paymentMethod === 'Card')
      .reduce((sum, t) => sum + t.amount, 0);
    
    const totalMobileMoney = cashierTransactions
      .filter(t => t.paymentMethod === 'Mobile Money')
      .reduce((sum, t) => sum + t.amount, 0);
    
    return {
      cashierName: cashierId,
      shiftStart: '08:00',
      shiftEnd: '16:00',
      totalTransactions: cashierTransactions.length,
      totalCash,
      totalCard,
      totalMobileMoney,
      totalAdjustments: 0,
      openingBalance: 1000,
      closingBalance: 1000 + totalCash,
      variance: 0
    };
  },

  generateCreditCardReconciliationReport: (date) => {
    console.log(`[REPORTS] Generating credit card reconciliation report for ${date}`);
    
    const transactions = get().generateDailyTransactionReport(date);
    const cardTransactions = transactions.filter(t => t.paymentMethod === 'Card');
    
    // Group by card type (this would come from actual payment processing)
    const cardTypes = ['Visa', 'Mastercard', 'American Express'];
    
    return cardTypes.map(cardType => ({
      cardType,
      transactionCount: Math.floor(Math.random() * 10) + 1,
      totalAmount: Math.floor(Math.random() * 10000) + 1000,
      batchNumber: `BATCH-${date}-${cardType}`,
      settlementDate: date,
      status: 'pending' as const,
      merchantId: 'MERCHANT001',
      terminalId: 'TERMINAL001'
    }));
  },

  generateGuestLedgerReport: (date) => {
    console.log(`[REPORTS] Generating guest ledger report for ${date}`);
    
    return frontOfficeStore.reservations
      .filter(reservation => 
        reservation.status === 'checked-in' && 
        reservation.arrival <= date && 
        reservation.departure > date
      )
      .map(reservation => {
        const room = frontOfficeStore.rooms.find(r => r.id === reservation.roomId);
        const folio = frontOfficeStore.folios.find(f => f.reservationId === reservation.id);
        
        const totalCharges = folio?.charges?.reduce((sum, charge) => sum + charge.amount, 0) || 0;
        const totalPayments = folio?.payments?.reduce((sum, payment) => sum + payment.amount, 0) || 0;
        const outstandingBalance = totalCharges - totalPayments;
        
        const agingDays = Math.ceil((new Date().getTime() - new Date(reservation.arrival).getTime()) / (1000 * 60 * 60 * 24));
        
        return {
          guestName: reservation.guestName,
          roomNumber: room?.id || 'Unknown',
          folioNumber: folio?.id || 'Unknown',
          checkInDate: reservation.arrival,
          checkOutDate: reservation.departure,
          totalCharges,
          totalPayments,
          outstandingBalance,
          agingDays,
          lastActivity: new Date().toISOString()
        };
      });
  },

  generateDailyFlashReport: (date) => {
    console.log(`[REPORTS] Generating daily flash report for ${date}`);
    
    const totalRooms = frontOfficeStore.rooms.length;
    const occupiedRooms = frontOfficeStore.reservations.filter(r => 
      r.status === 'checked-in' && 
      r.arrival <= date && 
      r.departure > date
    ).length;
    
    const arrivals = frontOfficeStore.reservations.filter(r => 
      r.arrival === date && r.status === 'confirmed'
    ).length;
    
    const departures = frontOfficeStore.reservations.filter(r => 
      r.departure === date && r.status === 'checked-in'
    ).length;
    
    const totalRevenue = frontOfficeStore.folios
      .filter(f => {
        const reservation = frontOfficeStore.reservations.find(r => r.id === f.reservationId);
        return reservation && reservation.arrival <= date && reservation.departure > date;
      })
      .reduce((sum, folio) => sum + (folio.charges?.reduce((cSum, charge) => cSum + charge.amount, 0) || 0), 0);
    
    return {
      date,
      occupancy: {
        totalRooms,
        occupiedRooms,
        occupancyRate: (occupiedRooms / totalRooms) * 100,
        availableRooms: totalRooms - occupiedRooms,
        outOfOrderRooms: 0
      },
      revenue: {
        roomRevenue: totalRevenue * 0.8,
        foodBeverageRevenue: totalRevenue * 0.15,
        otherRevenue: totalRevenue * 0.05,
        totalRevenue,
        averageDailyRate: occupiedRooms > 0 ? totalRevenue / occupiedRooms : 0,
        revenuePerAvailableRoom: totalRevenue / totalRooms
      },
      arrivals: {
        total: arrivals,
        confirmed: arrivals,
        guaranteed: Math.floor(arrivals * 0.7),
        walkIns: 0
      },
      departures: {
        total: departures,
        early: Math.floor(departures * 0.1),
        onTime: Math.floor(departures * 0.8),
        late: Math.floor(departures * 0.1)
      },
      financial: {
        totalCharges: totalRevenue,
        totalPayments: totalRevenue * 0.9,
        outstandingBalance: totalRevenue * 0.1,
        cashOnHand: totalRevenue * 0.3
      }
    };
  },

  generateOccupancyReport: (date) => {
    console.log(`[REPORTS] Generating occupancy report for ${date}`);
    
    const totalRooms = frontOfficeStore.rooms.length;
    const occupiedRooms = frontOfficeStore.reservations.filter(r => 
      r.status === 'checked-in' && 
      r.arrival <= date && 
      r.departure > date
    ).length;
    
    return {
      date,
      totalRooms,
      occupiedRooms,
      availableRooms: totalRooms - occupiedRooms,
      occupancyRate: (occupiedRooms / totalRooms) * 100
    };
  },

  generatePaceReport: (date) => {
    console.log(`[REPORTS] Generating pace report for ${date}`);
    
    // This would compare current bookings to historical data
    // For now, return sample data
    return [
      {
        date,
        currentBookings: 15,
        historicalBookings: 12,
        pacePercentage: 125,
        projectedOccupancy: 75,
        revenuePace: 120,
        marketSegment: 'Leisure'
      }
    ];
  },

  generateNoShowReport: (date) => {
    console.log(`[REPORTS] Generating no-show report for ${date}`);
    
    return frontOfficeStore.reservations
      .filter(reservation => 
        reservation.arrival === date && 
        reservation.status === 'confirmed' &&
        !frontOfficeStore.reservations.some(r => 
          r.id === reservation.id && r.status === 'checked-in'
        )
      )
      .map(reservation => ({
        guestName: reservation.guestName,
        roomType: frontOfficeStore.roomTypes.find(rt => rt.id === reservation.roomTypeId)?.name || 'Unknown',
        arrivalDate: reservation.arrival,
        reservationSource: reservation.source || 'Direct',
        guaranteed: reservation.isGuaranteed || false,
        depositAmount: reservation.deposit?.amount || 0,
        noShowReason: 'No communication',
        followUpRequired: true
      }));
  },

  generateSourceOfBusinessReport: (startDate, endDate) => {
    console.log(`[REPORTS] Generating source of business report from ${startDate} to ${endDate}`);
    
    const sources = ['Direct', 'Booking.com', 'Expedia', 'Corporate', 'Travel Agent'];
    
    return sources.map(source => {
      const bookings = frontOfficeStore.reservations.filter(r => 
        r.source === source &&
        r.arrival >= startDate &&
        r.arrival <= endDate
      ).length;
      
      const revenue = bookings * 800; // Average rate
      
      return {
        source,
        bookings,
        revenue,
        averageRate: 800,
        percentageOfTotal: (bookings / frontOfficeStore.reservations.length) * 100,
        trend: 'stable' as const
      };
    });
  },

  generateMarketSegmentationReport: (startDate, endDate) => {
    console.log(`[REPORTS] Generating market segmentation report from ${startDate} to ${endDate}`);
    
    const segments = ['Leisure', 'Business', 'Group', 'Corporate'];
    
    return segments.map(segment => {
      const bookings = Math.floor(Math.random() * 20) + 5;
      const revenue = bookings * 800;
      
      return {
        segment,
        bookings,
        revenue,
        averageRate: 800,
        averageLengthOfStay: 2.5,
        percentageOfTotal: (bookings / 50) * 100
      };
    });
  },

  generateGuestCountMealPlanReport: (date) => {
    console.log(`[REPORTS] Generating guest count meal plan report for ${date}`);
    
    const mealPlans = ['Bed & Breakfast', 'Half Board', 'Full Board', 'Room Only'];
    
    return mealPlans.map(plan => ({
      mealPlan: plan,
      guestCount: Math.floor(Math.random() * 10) + 1,
      dietaryRestrictions: ['Vegetarian', 'Gluten-Free'],
      specialRequests: ['Late breakfast', 'Room service'],
      mealTimes: {
        breakfast: Math.floor(Math.random() * 5) + 1,
        lunch: Math.floor(Math.random() * 3) + 1,
        dinner: Math.floor(Math.random() * 4) + 1
      }
    }));
  },

  generateVIPReport: (date) => {
    console.log(`[REPORTS] Generating VIP report for ${date}`);
    
    return frontOfficeStore.reservations
      .filter(reservation => 
        reservation.status === 'checked-in' && 
        reservation.arrival <= date && 
        reservation.departure > date
      )
      .map(reservation => {
        const guest = frontOfficeStore.guests.find(g => g.id === reservation.guestId);
        const room = frontOfficeStore.rooms.find(r => r.id === reservation.roomId);
        
        if (guest?.vipStatus === 'regular') return null;
        
        return {
          guestName: reservation.guestName,
          roomNumber: room?.id || 'Unknown',
          vipLevel: guest?.vipStatus || 'regular',
          specialRequests: guest?.specialRequests || [],
          preferences: guest?.preferences || [],
          arrivalDate: reservation.arrival,
          departureDate: reservation.departure,
          assignedButler: 'Butler Service',
          notes: 'VIP guest - special attention required'
        };
      })
      .filter(Boolean);
  },

  generateGuestHistoryReport: (guestId) => {
    console.log(`[REPORTS] Generating guest history report for ${guestId}`);
    
    const guest = frontOfficeStore.guests.find(g => g.id === guestId);
    if (!guest) return null;
    
    const guestReservations = frontOfficeStore.reservations.filter(r => r.guestId === guestId);
    const totalStays = guestReservations.length;
    const totalNights = guestReservations.reduce((sum, r) => {
      const nights = Math.ceil((new Date(r.departure).getTime() - new Date(r.arrival).getTime()) / (1000 * 60 * 60 * 24));
      return sum + nights;
    }, 0);
    
    const totalSpent = guestReservations.reduce((sum, r) => {
      const folio = frontOfficeStore.folios.find(f => f.reservationId === r.id);
      return sum + (folio?.charges?.reduce((cSum, charge) => cSum + charge.amount, 0) || 0);
    }, 0);
    
    return {
      guestName: guest.name,
      totalStays,
      totalNights,
      totalSpent,
      averageRate: totalNights > 0 ? totalSpent / totalNights : 0,
      lastVisit: guestReservations[guestReservations.length - 1]?.arrival || 'Never',
      preferences: guest.preferences || [],
      specialRequests: guest.specialRequests || [],
      loyaltyPoints: totalSpent * 0.1, // 10% of spend as points
      vipStatus: guest.vipStatus || 'regular'
    };
  },

  generateDiscountRequestReport: (startDate, endDate) => {
    console.log(`[REPORTS] Generating discount request report from ${startDate} to ${endDate}`);
    
    // Simulate discount request data - in real implementation, this would come from actual discount requests
    const discountRequests = [
      {
        id: 'DR001',
        guestName: 'John Smith',
        roomType: 'Deluxe',
        originalRate: 1200,
        requestedRate: 1000,
        discountAmount: 200,
        discountPercentage: 16.67,
        requestReason: 'Corporate rate',
        requestDate: '2024-01-15',
        status: 'approved',
        approvedBy: 'Manager',
        approvedDate: '2024-01-15',
        revenueImpact: -200,
        marketSegment: 'Corporate'
      },
      {
        id: 'DR002',
        guestName: 'Sarah Johnson',
        roomType: 'Standard',
        originalRate: 800,
        requestedRate: 700,
        discountAmount: 100,
        discountPercentage: 12.5,
        requestReason: 'Long stay discount',
        requestDate: '2024-01-14',
        status: 'approved',
        approvedBy: 'Supervisor',
        approvedDate: '2024-01-14',
        revenueImpact: -100,
        marketSegment: 'Leisure'
      },
      {
        id: 'DR003',
        guestName: 'Mike Wilson',
        roomType: 'Suite',
        originalRate: 2000,
        requestedRate: 1800,
        discountAmount: 200,
        discountPercentage: 10,
        requestReason: 'VIP guest',
        requestDate: '2024-01-13',
        status: 'approved',
        approvedBy: 'Manager',
        approvedDate: '2024-01-13',
        revenueImpact: -200,
        marketSegment: 'VIP'
      }
    ];

    // Filter by date range
    const filteredRequests = discountRequests.filter(req => 
      req.requestDate >= startDate && req.requestDate <= endDate
    );

    return {
      summary: {
        totalRequests: filteredRequests.length,
        approvedRequests: filteredRequests.filter(req => req.status === 'approved').length,
        rejectedRequests: filteredRequests.filter(req => req.status === 'rejected').length,
        pendingRequests: filteredRequests.filter(req => req.status === 'pending').length,
        totalRevenueImpact: filteredRequests.reduce((sum, req) => sum + req.revenueImpact, 0),
        averageDiscountPercentage: filteredRequests.reduce((sum, req) => sum + req.discountPercentage, 0) / filteredRequests.length
      },
      requests: filteredRequests,
      analysis: {
        topReasons: [
          { reason: 'Corporate rate', count: 2, totalDiscount: 400 },
          { reason: 'Long stay discount', count: 1, totalDiscount: 100 },
          { reason: 'VIP guest', count: 1, totalDiscount: 200 }
        ],
        marketSegmentImpact: [
          { segment: 'Corporate', totalDiscount: 400, requestCount: 2 },
          { segment: 'Leisure', totalDiscount: 100, requestCount: 1 },
          { segment: 'VIP', totalDiscount: 200, requestCount: 1 }
        ],
        roomTypeAnalysis: [
          { type: 'Deluxe', totalDiscount: 200, averageDiscount: 200 },
          { type: 'Standard', totalDiscount: 100, averageDiscount: 100 },
          { type: 'Suite', totalDiscount: 200, averageDiscount: 200 }
        ]
      }
    };
  },

  generateComplimentaryRoomReport: (startDate, endDate) => {
    console.log(`[REPORTS] Generating complimentary room report from ${startDate} to ${endDate}`);
    
    // Simulate complimentary room data
    const complimentaryRooms = [
      {
        id: 'CR001',
        guestName: 'VIP Guest 1',
        roomType: 'Suite',
        roomNumber: '101',
        originalRate: 2000,
        complimentaryReason: 'VIP guest - loyalty program',
        checkIn: '2024-01-15',
        checkOut: '2024-01-17',
        nights: 2,
        revenueLoss: 4000,
        approvedBy: 'General Manager',
        approvedDate: '2024-01-14',
        notes: 'High-value customer retention'
      },
      {
        id: 'CR002',
        guestName: 'Corporate Partner',
        roomType: 'Deluxe',
        roomNumber: '205',
        originalRate: 1200,
        complimentaryReason: 'Corporate partnership agreement',
        checkIn: '2024-01-16',
        checkOut: '2024-01-18',
        nights: 2,
        revenueLoss: 2400,
        approvedBy: 'Sales Director',
        approvedDate: '2024-01-15',
        notes: 'Strategic partnership benefit'
      },
      {
        id: 'CR003',
        guestName: 'Media Representative',
        roomType: 'Standard',
        roomNumber: '310',
        originalRate: 800,
        complimentaryReason: 'Media coverage and promotion',
        checkIn: '2024-01-17',
        checkOut: '2024-01-19',
        nights: 2,
        revenueLoss: 1600,
        approvedBy: 'Marketing Manager',
        approvedDate: '2024-01-16',
        notes: 'Publicity and marketing value'
      }
    ];

    // Filter by date range
    const filteredRooms = complimentaryRooms.filter(room => 
      room.checkIn >= startDate && room.checkIn <= endDate
    );

    return {
      summary: {
        totalComplimentaryRooms: filteredRooms.length,
        totalNights: filteredRooms.reduce((sum, room) => sum + room.nights, 0),
        totalRevenueLoss: filteredRooms.reduce((sum, room) => sum + room.revenueLoss, 0),
        averageRate: filteredRooms.reduce((sum, room) => sum + room.originalRate, 0) / filteredRooms.length
      },
      rooms: filteredRooms,
      analysis: {
        reasons: [
          { reason: 'VIP guest - loyalty program', count: 1, revenueLoss: 4000, percentage: 50 },
          { reason: 'Corporate partnership agreement', count: 1, revenueLoss: 2400, percentage: 30 },
          { reason: 'Media coverage and promotion', count: 1, revenueLoss: 1600, percentage: 20 }
        ],
        roomTypeImpact: [
          { type: 'Suite', count: 1, revenueLoss: 4000, percentage: 50 },
          { type: 'Deluxe', count: 1, revenueLoss: 2400, percentage: 30 },
          { type: 'Standard', count: 1, revenueLoss: 1600, percentage: 20 }
        ],
        approvalAnalysis: [
          { approver: 'General Manager', count: 1, totalRevenueLoss: 4000 },
          { approver: 'Sales Director', count: 1, totalRevenueLoss: 2400 },
          { approver: 'Marketing Manager', count: 1, totalRevenueLoss: 1600 }
        ]
      }
    };
  },

  generatePricingAnalyticsReport: (startDate, endDate) => {
    console.log(`[REPORTS] Generating pricing analytics report from ${startDate} to ${endDate}`);
    
    // Combine discount requests and complimentary rooms for comprehensive pricing analysis
    const discountReport = get().generateDiscountRequestReport(startDate, endDate);
    const complimentaryReport = get().generateComplimentaryRoomReport(startDate, endDate);
    
    const totalRevenueImpact = (discountReport.summary.totalRevenueImpact || 0) + 
                              (complimentaryReport.summary.totalRevenueLoss || 0);
    
    const averageRoomRate = 1000; // This would come from actual room rate data
    const totalRooms = 50; // This would come from actual room inventory
    
    return {
      period: { startDate, endDate },
      summary: {
        totalRevenueImpact,
        totalDiscounts: Math.abs(discountReport.summary.totalRevenueImpact || 0),
        totalComplimentaryRooms: complimentaryReport.summary.totalRevenueLoss || 0,
        averageRoomRate,
        totalRooms,
        revenuePerAvailableRoom: (averageRoomRate * totalRooms * 30) - totalRevenueImpact // Monthly calculation
      },
      discountAnalysis: {
        totalRequests: discountReport.summary.totalRequests,
        approvalRate: (discountReport.summary.approvedRequests / discountReport.summary.totalRequests) * 100,
        averageDiscountPercentage: discountReport.summary.averageDiscountPercentage,
        topReasons: discountReport.analysis.topReasons,
        marketSegmentImpact: discountReport.analysis.marketSegmentImpact
      },
      complimentaryAnalysis: {
        totalRooms: complimentaryReport.summary.totalComplimentaryRooms,
        totalNights: complimentaryReport.summary.totalNights,
        averageRate: complimentaryReport.summary.averageRate,
        reasons: complimentaryReport.analysis.reasons,
        roomTypeImpact: complimentaryReport.analysis.roomTypeImpact
      },
      pricingRecommendations: [
        {
          category: 'Discount Strategy',
          recommendation: 'Implement tiered discount structure based on market segment',
          impact: 'Medium',
          implementation: 'Short-term'
        },
        {
          category: 'Complimentary Rooms',
          recommendation: 'Establish clear criteria for complimentary room approvals',
          impact: 'High',
          implementation: 'Immediate'
        },
        {
          category: 'Revenue Optimization',
          recommendation: 'Review pricing strategy for high-demand periods',
          impact: 'High',
          implementation: 'Medium-term'
        }
      ]
    };
  },

  // Export and Print
  exportReport: async (reportData, format, filename) => {
    console.log(`[REPORTS] Exporting report in ${format} format: ${filename}`);
    
    trackEvent('report_exported', { 
      format,
      filename 
    });
    
    // Simulate export process
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // In a real implementation, this would generate and return the file URL
    const blob = new Blob([JSON.stringify(reportData, null, 2)], { 
      type: format === 'pdf' ? 'application/pdf' : format === 'excel' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'text/csv' 
    });
    const url = URL.createObjectURL(blob);
    
    console.log(`[REPORTS] Successfully exported report: ${filename}`);
    return url;
  },

  printReport: (reportData, template) => {
    console.log(`[REPORTS] Printing report with template: ${template}`);
    
    trackEvent('report_printed', { 
      template 
    });
    
    // In a real implementation, this would format and print the report
    window.print();
  },

  // Selection
  selectReport: (report) => {
    set({ selectedReport: report });
    
    if (report) {
      trackEvent('report_selected', { 
        report_id: report.id,
        category: report.category 
      });
      console.log(`[REPORTS] Selected report: ${report.name}`);
    }
  },

  setGenerating: (generating) => {
    set({ isGenerating: generating });
  },

  setError: (error) => {
    set({ error });
  }
}));
