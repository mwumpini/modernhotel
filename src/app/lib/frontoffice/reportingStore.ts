'use client';

import { create } from 'zustand';
import { frontOfficeStore } from './store';
import { trackEvent } from '../analytics/trackEvent';
import { getFolioDisplayTotals, folioChargeGlCode, findMainFolio, stayFolio, allStayFolios } from './helpers/folio';
import { housekeepingStore } from '../housekeeping/store';
import { reportDataToSections, sectionsToCSV, sectionsToExcelHtml, sectionsToPdfBlob, type ReportOrgInfo } from './reportExportFormat';
import { useSettingsStore } from '../settings/store';
import { buildOrgProfile } from '../print/buildOrgProfile';

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
  // endDate is optional on the reports that now support a period, not just a
  // single day — omitted (or equal to date) means "just this one day", the
  // same as before this was added.
  generateArrivalsReport: (date: string, endDate?: string) => any[];
  generateDeparturesReport: (date: string, endDate?: string) => any[];
  generateRoomStatusReport: (date: string) => any[];
  generateCheckInGuestReport: (date: string, endDate?: string) => any[];
  generateHighBalanceReport: (date: string, endDate?: string) => any[];
  generateWakeUpCallReport: (date: string, endDate?: string) => any[];
  generateDailyTransactionReport: (date: string, endDate?: string) => any[];
  generateCashierReport: (date: string, cashierId: string, endDate?: string) => any;
  generateCreditCardReconciliationReport: (date: string, endDate?: string) => any[];
  generateGuestLedgerReport: (date: string, endDate?: string) => any[];
  generateDailyFlashReport: (date: string) => any;
  generateOccupancyReport: (date: string, endDate?: string) => any;
  generateRoomPerformanceReport: (startDate: string, endDate: string, roomId?: string) => any;
  generatePaceReport: (date: string, endDate?: string) => any[];
  generateNoShowReport: (date: string, endDate?: string) => any[];
  generateSourceOfBusinessReport: (startDate: string, endDate: string) => any[];
  generateMarketSegmentationReport: (startDate: string, endDate: string) => any[];
  generateGuestCountMealPlanReport: (date: string) => any[];
  generateVIPReport: (date: string) => any[];
  generateGuestHistoryReport: (guestId: string) => any;
  generateDiscountRequestReport: (startDate: string, endDate: string) => any;
  generateComplimentaryRoomReport: (startDate: string, endDate: string) => any;
  generatePricingAnalyticsReport: (startDate: string, endDate: string) => any;
  
  // Export and Print
  exportReport: (reportData: any, format: 'pdf' | 'excel' | 'csv', filename: string, generatedLabel?: string) => Promise<string>;
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

// --- Historical in-house resolution --------------------------------------
// checkedInAt/checkedOutAt are real, permanent event timestamps recorded
// going forward. Reservations checked in/out before that field started
// being persisted have neither, so as a one-time fallback for those older
// records we approximate: arrival date for check-in, updatedAt (falling
// back to departure) for check-out. New stays get the real event time;
// old ones get the closest honest approximation rather than being silently
// dropped from historical reports.
function resolveCheckedInAt(r: import('./types').Reservation): string | undefined {
  if (r.checkedInAt) return r.checkedInAt;
  return (r.status === 'checked-in' || r.status === 'checked-out') ? r.arrival : undefined;
}
function resolveCheckedOutAt(r: import('./types').Reservation): string | undefined {
  if (r.checkedOutAt) return r.checkedOutAt;
  return r.status === 'checked-out' ? (r.updatedAt || r.departure) : undefined;
}
// Matches a stored date/ISO-timestamp string against a [start, end] window
// (inclusive) — the shared building block for every "date" param that grew
// an optional "endDate" to become a period instead of a single day.
function dateInRange(value: string | undefined, start: string, end: string): boolean {
  if (!value) return false;
  const d = value.slice(0, 10);
  return d >= start && d <= end;
}
// True if the reservation's actual stay (check-in through check-out, or
// through now if still in-house) overlaps the [startDate, endDate] window at
// all — startDate === endDate is "was in-house on this one specific day",
// for any date past or present, not just "currently checked in".
function wasInHouseDuring(r: import('./types').Reservation, startDate: string, endDate: string): boolean {
  const inAt = resolveCheckedInAt(r);
  if (!inAt || inAt.slice(0, 10) > endDate) return false;
  const outAt = resolveCheckedOutAt(r);
  return !outAt || outAt.slice(0, 10) > startDate;
}

// Every calendar day from startDate to endDate inclusive, as YYYY-MM-DD. Built with
// Date.UTC/setUTCDate rather than local-time Date construction — `new Date('2026-09-12T00:00:00')`
// is LOCAL midnight, so in any timezone ahead of UTC, .toISOString() reads back as the previous
// day, shifting the whole range back by one.
function eachDay(startDate: string, endDate: string): string[] {
  const days: string[] = [];
  const [sy, sm, sd] = startDate.split('-').map(Number);
  const [ey, em, ed] = endDate.split('-').map(Number);
  const cursor = new Date(Date.UTC(sy, sm - 1, sd));
  const last = new Date(Date.UTC(ey, em - 1, ed));
  for (let guard = 0; cursor.getTime() <= last.getTime() && guard < 3660; guard++) {
    days.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}

// Shown in place of a misleading 0 for a figure the system doesn't record.
const NOT_TRACKED = 'Not tracked';

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
  generateArrivalsReport: (date, endDate = date) => {
    console.log(`[REPORTS] Generating arrivals report for ${date}${endDate !== date ? ` to ${endDate}` : ''}`);

    return frontOfficeStore.reservations
      // status !== 'confirmed' would drop anyone who has already checked in
      // (their status has since moved on) or, for a past date, anyone who's
      // since checked out — neither means they didn't arrive. Only
      // cancelled/no-show reservations genuinely never arrived.
      .filter(reservation => dateInRange(reservation.arrival, date, endDate) && reservation.status !== 'cancelled' && reservation.status !== 'no-show')
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

  generateDeparturesReport: (date, endDate = date) => {
    console.log(`[REPORTS] Generating departures report for ${date}${endDate !== date ? ` to ${endDate}` : ''}`);

    return frontOfficeStore.reservations
      // status === 'checked-in' only shows guests still awaiting checkout —
      // once they actually complete it, status flips to 'checked-out' and
      // they'd vanish, which is backwards for a report meant to answer "who
      // departed on this date" (past or present).
      .filter(reservation => dateInRange(reservation.departure, date, endDate) && reservation.status !== 'cancelled' && reservation.status !== 'no-show')
      .map(reservation => {
        const guest = frontOfficeStore.guests.find(g => g.id === reservation.guestId);
        const room = frontOfficeStore.rooms.find(r => r.id === reservation.roomId);
        const folio = findMainFolio(frontOfficeStore.folios, reservation.id);
        
        const { totalCharges, totalPayments, balance } = folio
          ? getFolioDisplayTotals(folio, endDate)
          : { totalCharges: 0, totalPayments: 0, balance: 0 };

        return {
          guestName: reservation.guestName,
          roomNumber: room?.id || 'Unknown',
          checkoutTime: '11:00',
          totalCharges,
          totalPayments,
          balance,
          lateCheckout: false,
          folioStatus: folio?.status || 'open',
          housekeepingStatus: 'pending'
        };
      });
  },

  generateRoomStatusReport: (date) => {
    console.log(`[REPORTS] Generating room status report for ${date}`);
    // Occupancy (who was in which room) is reconstructed from real reservation
    // history via wasInHouseDuring, so it's accurate for any past date. Housekeeping
    // state (clean/dirty/inspected) isn't logged with per-day history anywhere
    // yet — only today's live state is real, so it's only included for today;
    // for a past date it's honestly left out rather than shown as if it were
    // known for that day.
    const today = new Date().toISOString().split('T')[0];
    const isToday = date === today;

    return frontOfficeStore.rooms.map(room => {
      const reservation = frontOfficeStore.reservations.find(r => r.roomId === room.id && wasInHouseDuring(r, date, date));
      const guest = reservation ? frontOfficeStore.guests.find(g => g.id === reservation.guestId) : null;
      const hk = isToday ? housekeepingStore.getRoomStatus(room.id) : undefined;

      return {
        roomNumber: room.id,
        status: reservation ? 'occupied' : 'vacant',
        guestName: guest?.name || undefined,
        checkInDate: reservation?.arrival || undefined,
        checkOutDate: reservation?.departure || undefined,
        housekeepingStatus: hk?.status,
        lastCleaned: hk?.lastUpdated,
      };
    });
  },

  generateCheckInGuestReport: (date, endDate = date) => {
    console.log(`[REPORTS] Generating check-in guest report for ${date}${endDate !== date ? ` to ${endDate}` : ''}`);

    return frontOfficeStore.reservations
      .filter(reservation => wasInHouseDuring(reservation, date, endDate))
      .map(reservation => {
        const guest = frontOfficeStore.guests.find(g => g.id === reservation.guestId);
        const room = frontOfficeStore.rooms.find(r => r.id === reservation.roomId);
        const folio = findMainFolio(frontOfficeStore.folios, reservation.id);

        const { totalCharges, totalPayments, balance } = folio
          ? getFolioDisplayTotals(folio, endDate)
          : { totalCharges: 0, totalPayments: 0, balance: 0 };
        const nightsStayed = Math.ceil((new Date(endDate).getTime() - new Date(reservation.arrival).getTime()) / (1000 * 60 * 60 * 24));

        return {
          guestName: reservation.guestName,
          roomNumber: room?.id || 'Unknown',
          checkInDate: reservation.arrival,
          checkOutDate: reservation.departure,
          nightsStayed,
          totalCharges,
          totalPayments,
          currentBalance: balance,
          vipStatus: guest?.vipStatus || 'regular',
          specialRequests: guest?.specialRequests || [],
          lastActivity: reservation.updatedAt
        };
      });
  },

  generateHighBalanceReport: (date, endDate = date) => {
    console.log(`[REPORTS] Generating high balance report for ${date}${endDate !== date ? ` to ${endDate}` : ''}`);

    const defaultCreditLimit = 5000; // Fallback when the guest has no creditLimit on file

    return frontOfficeStore.reservations
      .filter(reservation => wasInHouseDuring(reservation, date, endDate))
      .map(reservation => {
        const room = frontOfficeStore.rooms.find(r => r.id === reservation.roomId);
        const folio = findMainFolio(frontOfficeStore.folios, reservation.id);
        const guest = frontOfficeStore.guests.find(g => g.id === reservation.guestId);
        const creditLimit = guest?.creditLimit || defaultCreditLimit;

        const { balance: currentBalance } = folio
          ? getFolioDisplayTotals(folio, endDate)
          : { balance: 0 };

        // "As of" the report's end date, not today — otherwise a report run
        // for a past period would show today's overdue count instead of what
        // was actually overdue back then.
        const daysOverdue = Math.max(0, Math.ceil((new Date(endDate).getTime() - new Date(reservation.arrival).getTime()) / (1000 * 60 * 60 * 24)));
        
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
      .filter(guest => guest.currentBalance > guest.creditLimit);
  },

  generateWakeUpCallReport: (date, endDate = date) => {
    console.log(`[REPORTS] Generating wake-up call report for ${date}${endDate !== date ? ` to ${endDate}` : ''}`);

    return frontOfficeStore.wakeUpCalls
      .filter(c => dateInRange(c.date, date, endDate))
      .map(c => ({
        guestName: c.guestName,
        roomNumber: c.roomNumber,
        wakeUpTime: c.time,
        date: c.date,
        status: c.status,
        notes: c.notes || '',
        completedBy: c.completedBy || ''
      }));
  },

  generateDailyTransactionReport: (date, endDate = date) => {
    console.log(`[REPORTS] Generating daily transaction report for ${date}${endDate !== date ? ` to ${endDate}` : ''}`);

    const transactions: any[] = [];

    frontOfficeStore.folios.forEach(folio => {
      const reservation = frontOfficeStore.reservations.find(r => r.id === folio.reservationId);
      if (!reservation) return;

      // Add charges
      folio.charges?.forEach(charge => {
        if (dateInRange(charge.date, date, endDate)) {
          transactions.push({
            transactionId: `charge-${charge.id}`,
            guestName: reservation.guestName,
            roomNumber: frontOfficeStore.rooms.find(r => r.id === reservation.roomId)?.id || 'Unknown',
            transactionType: 'charge' as const,
            amount: charge.amount,
            description: charge.description,
            timestamp: charge.date,
            cashier: (charge as any).staffName || 'Front Desk',
            paymentMethod: 'Folio',
            folioNumber: folio.id,
            category: charge.category || 'other',
            // Charges don't have a lifecycle status like payments (pending/failed/
            // refunded) — they're posted once and stay posted — but a uniform
            // 'posted' label lets the Status breakdown include them consistently
            // instead of silently dropping every charge row.
            status: 'posted'
          });
        }
      });

      // Add payments
      folio.payments?.forEach(payment => {
        if (dateInRange(payment.date, date, endDate)) {
          transactions.push({
            transactionId: `payment-${payment.id}`,
            guestName: reservation.guestName,
            roomNumber: frontOfficeStore.rooms.find(r => r.id === reservation.roomId)?.id || 'Unknown',
            transactionType: 'payment' as const,
            amount: payment.amount,
            description: payment.description,
            timestamp: payment.date,
            cashier: payment.processedBy || 'Front Desk',
            paymentMethod: payment.method,
            folioNumber: folio.id,
            category: 'payment',
            status: payment.status
          });
        }
      });
    });
    
    return transactions;
  },

  generateCashierReport: (date, cashierId, endDate = date) => {
    console.log(`[REPORTS] Generating cashier report for ${date}${endDate !== date ? ` to ${endDate}` : ''} and cashier ${cashierId}`);

    const transactions = get().generateDailyTransactionReport(date, endDate);
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
    
    // Shift start/end and a declared opening float aren't tracked anywhere in this
    // system (no clock-in/till-declaration feature exists) — reporting a fabricated
    // shift window or balance would be actively misleading for a cash reconciliation
    // report, so those fields are omitted (null) rather than invented. The renderer
    // filters null fields out of the summary rather than showing a false "0"/"08:00".
    return {
      cashierName: cashierId,
      shiftStart: null,
      shiftEnd: null,
      totalTransactions: cashierTransactions.length,
      totalCash,
      totalCard,
      totalMobileMoney,
      totalAdjustments: 0,
      openingBalance: null,
      closingBalance: null,
      variance: null
    };
  },

  generateCreditCardReconciliationReport: (date, endDate = date) => {
    console.log(`[REPORTS] Generating credit card reconciliation report for ${date}${endDate !== date ? ` to ${endDate}` : ''}`);

    const transactions = get().generateDailyTransactionReport(date, endDate);
    const cardTransactions = transactions.filter(t => t.paymentMethod === 'Card' && t.transactionType === 'payment');

    // Card network (Visa/Mastercard/Amex) isn't captured anywhere on a payment
    // today — FolioPayment.method only distinguishes 'Card' generically — so this
    // reports one real aggregate row rather than fabricating a network breakdown.
    if (cardTransactions.length === 0) return [];
    const totalAmount = cardTransactions.reduce((s, t) => s + t.amount, 0);
    return [{
      cardType: 'Card',
      transactionCount: cardTransactions.length,
      totalAmount,
      batchNumber: `BATCH-${date}${endDate !== date ? `_${endDate}` : ''}`,
      settlementDate: endDate,
      status: 'pending' as const,
      merchantId: 'N/A',
      terminalId: 'N/A'
    }];
  },

  generateGuestLedgerReport: (date, endDate = date) => {
    console.log(`[REPORTS] Generating guest ledger report for ${date}${endDate !== date ? ` to ${endDate}` : ''}`);

    return frontOfficeStore.reservations
      .filter(reservation => wasInHouseDuring(reservation, date, endDate))
      .map(reservation => {
        const room = frontOfficeStore.rooms.find(r => r.id === reservation.roomId);
        const folio = findMainFolio(frontOfficeStore.folios, reservation.id);

        const { totalCharges, totalPayments, balance: outstandingBalance } = folio
          ? getFolioDisplayTotals(folio, endDate)
          : { totalCharges: 0, totalPayments: 0, balance: 0 };

        // "As of" the report's end date, not today — see generateHighBalanceReport.
        const agingDays = Math.ceil((new Date(endDate).getTime() - new Date(reservation.arrival).getTime()) / (1000 * 60 * 60 * 24));

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
          lastActivity: reservation.updatedAt
        };
      });
  },

  generateDailyFlashReport: (date) => {
    console.log(`[REPORTS] Generating daily flash report for ${date}`);

    const totalRooms = frontOfficeStore.rooms.length;
    const inHouse = frontOfficeStore.reservations.filter(r => wasInHouseDuring(r, date, date));
    const occupiedRooms = inHouse.length;
    // Headcount (adults + children), same as the Occupancy report — a room can hold more than one guest.
    const guestsInHouse = inHouse.reduce((sum, r) => sum + (r.adults || 0) + (r.children || 0), 0);

    const arrivalReservations = frontOfficeStore.reservations.filter(r =>
      r.arrival === date && r.status !== 'cancelled' && r.status !== 'no-show'
    );
    const arrivals = arrivalReservations.length;
    const guaranteedArrivals = arrivalReservations.filter(r => r.isGuaranteed).length;
    // Walk-ins are marked on the reservation itself (its source or the WALK IN market code).
    const walkInArrivals = arrivalReservations.filter(r =>
      /walk.?in/i.test(r.source || '') || (r.marketCodes || []).some(c => /walk.?in/i.test(c))
    ).length;

    const departures = frontOfficeStore.reservations.filter(r =>
      r.departure === date && r.status !== 'cancelled' && r.status !== 'no-show'
    ).length;

    // Only charges/payments actually posted ON this date (not every charge that
    // has ever accumulated on a folio whose stay happens to overlap the date).
    const billing = allStayFolios(frontOfficeStore.folios);
    const chargesToday = billing.flatMap(f =>
      (f.charges || []).filter(c => (c.date || '').slice(0, 10) === date)
    );
    const paymentsToday = billing.flatMap(f =>
      (f.payments || []).filter(p => p.status === 'completed' && (p.date || '').slice(0, 10) === date)
    );

    const roomRevenue = chargesToday
      .filter(c => folioChargeGlCode(c) === '4100')
      .reduce((s, c) => s + c.amount + (c.tax || 0), 0);
    const foodBeverageRevenue = chargesToday
      .filter(c => folioChargeGlCode(c) === '4200')
      .reduce((s, c) => s + c.amount + (c.tax || 0), 0);
    const otherRevenue = chargesToday
      .filter(c => folioChargeGlCode(c) !== '4100' && folioChargeGlCode(c) !== '4200')
      .reduce((s, c) => s + c.amount + (c.tax || 0), 0);
    const totalRevenue = roomRevenue + foodBeverageRevenue + otherRevenue;
    const totalPayments = paymentsToday.reduce((s, p) => s + p.amount, 0);
    // What the guests in the house owe as of the end of this date (balances still due, credits not
    // netted off) — the guest ledger total. Charges less payments for the day alone says nothing about that.
    const inHouseBalanceDue = Math.round(
      frontOfficeStore.reservations
        .filter(r => wasInHouseDuring(r, date, date))
        .map(r => stayFolio(frontOfficeStore.folios, r.id))
        .reduce((sum, f) => sum + (f ? getFolioDisplayTotals(f, date).outstandingBalance : 0), 0) * 100
    ) / 100;
    // Like Room Status's housekeeping fields, out-of-order is only known live —
    // nothing logs a historical out-of-order count per day, so a past date
    // can't honestly report one. Omit it (not fabricate today's count under a
    // past-date label) and don't subtract an unknown quantity from
    // availableRooms either.
    const today = new Date().toISOString().split('T')[0];
    const outOfOrderRooms = date === today ? housekeepingStore.getRoomsByStatus('out-of-order').length : undefined;

    return {
      date,
      occupancy: {
        totalRooms,
        occupiedRooms,
        guestsInHouse,
        occupancyRate: totalRooms > 0 ? (occupiedRooms / totalRooms) * 100 : 0,
        availableRooms: Math.max(0, totalRooms - occupiedRooms - (outOfOrderRooms ?? 0)),
        outOfOrderRooms
      },
      revenue: {
        roomRevenue,
        foodBeverageRevenue,
        otherRevenue,
        totalRevenue,
        averageDailyRate: occupiedRooms > 0 ? roomRevenue / occupiedRooms : 0,
        revenuePerAvailableRoom: totalRooms > 0 ? roomRevenue / totalRooms : 0
      },
      arrivals: {
        total: arrivals,
        guaranteed: guaranteedArrivals,
        walkIns: walkInArrivals
      },
      departures: {
        // Actual-vs-scheduled checkout timing isn't classified per guest anywhere, so the
        // split is marked as not tracked rather than shown as a row of zeros.
        total: departures,
        early: NOT_TRACKED,
        onTime: NOT_TRACKED,
        late: NOT_TRACKED
      },
      financial: {
        totalCharges: totalRevenue,
        totalPayments,
        inHouseBalanceDue,
        cashOnHand: paymentsToday.filter(p => p.method === 'Cash').reduce((s, p) => s + p.amount, 0)
      }
    };
  },

  generateOccupancyReport: (date, endDate = date) => {
    console.log(`[REPORTS] Generating occupancy report for ${date}${endDate !== date ? ` to ${endDate}` : ''}`);

    const totalRooms = frontOfficeStore.rooms.length;
    // Room occupancy tells you business performance; actual headcount is what
    // matters for fire/evacuation safety, security, and kitchen/housekeeping
    // staffing — a different question, so reported alongside rather than
    // inferred from room counts (a room can hold more than one guest).
    const snapshotFor = (d: string) => {
      const inHouse = frontOfficeStore.reservations.filter(r => wasInHouseDuring(r, d, d));
      const occupiedRooms = inHouse.length;
      const adultsInHouse = inHouse.reduce((sum, r) => sum + (r.adults || 0), 0);
      const childrenInHouse = inHouse.reduce((sum, r) => sum + (r.children || 0), 0);
      return {
        date: d,
        totalRooms,
        occupiedRooms,
        availableRooms: totalRooms - occupiedRooms,
        occupancyRate: totalRooms > 0 ? (occupiedRooms / totalRooms) * 100 : 0,
        adultsInHouse,
        childrenInHouse,
        totalGuestsInHouse: adultsInHouse + childrenInHouse
      };
    };

    if (endDate === date) return snapshotFor(date);

    // Ranged: one row per day in the window — a trend, not a single
    // aggregate, since "average occupancy over a week" hides more than it
    // shows.
    return eachDay(date, endDate).map(snapshotFor);
  },

  generateRoomPerformanceReport: (startDate, endDate, roomId) => {
    console.log(`[REPORTS] Generating room performance report for ${startDate} to ${endDate}${roomId ? ` (room ${roomId})` : ''}`);

    // Rebuilt from real stay history and dated folio charges, so it holds for any past period.
    // A stay counts toward the room it ended up in (room moves aren't recorded, so a stay is never
    // split across rooms). Money is gross of tax, the same basis as the Daily Flash report.
    const days = eachDay(startDate, endDate);
    const round2 = (n: number) => Math.round(n * 100) / 100;
    const typeName = (typeId: string) => frontOfficeStore.roomTypes.find(rt => rt.id === typeId)?.name || 'Unknown';

    const summarise = (room: import('./types').RoomEntity) => {
      const stays = frontOfficeStore.reservations
        .filter(r => r.roomId === room.id && wasInHouseDuring(r, startDate, endDate))
        .map(r => {
          const charges = (stayFolio(frontOfficeStore.folios, r.id)?.charges || [])
            .filter(c => dateInRange(c.date, startDate, endDate));
          const gross = (match: (glCode: string) => boolean) =>
            round2(charges.filter(c => match(folioChargeGlCode(c))).reduce((sum, c) => sum + c.amount + (c.tax || 0), 0));
          return {
            reservation: r,
            guests: (r.adults || 0) + (r.children || 0),
            nights: days.filter(d => wasInHouseDuring(r, d, d)).length,
            roomRevenue: gross(g => g === '4100'),
            foodBeverage: gross(g => g === '4200'),
            otherCharges: gross(g => g !== '4100' && g !== '4200'),
          };
        });
      const total = (key: 'roomRevenue' | 'foodBeverage' | 'otherCharges') => round2(stays.reduce((sum, st) => sum + st[key], 0));
      const nightsOccupied = days.filter(d => stays.some(st => wasInHouseDuring(st.reservation, d, d))).length;
      const roomRevenue = total('roomRevenue');
      const foodBeverage = total('foodBeverage');
      const otherCharges = total('otherCharges');
      return {
        room,
        stays,
        guests: stays.reduce((sum, st) => sum + st.guests, 0),
        nightsOccupied,
        roomRevenue,
        foodBeverage,
        otherCharges,
        totalSales: round2(roomRevenue + foodBeverage + otherCharges),
      };
    };
    const rowOf = (x: ReturnType<typeof summarise>) => ({
      room: x.room.id,
      roomType: typeName(x.room.roomTypeId),
      nightsOccupied: x.nightsOccupied,
      occupancyRate: days.length > 0 ? round2((x.nightsOccupied / days.length) * 100) : 0,
      stays: x.stays.length,
      guests: x.guests,
      roomRevenue: x.roomRevenue,
      foodBeverage: x.foodBeverage,
      otherCharges: x.otherCharges,
      totalSales: x.totalSales,
      averageDailyRate: x.nightsOccupied > 0 ? round2(x.roomRevenue / x.nightsOccupied) : 0,
    });

    // One room: its summary plus every stay in the period.
    if (roomId) {
      const room = frontOfficeStore.rooms.find(r => r.id === roomId);
      if (!room) return [];
      const x = summarise(room);
      return {
        ...rowOf(x),
        daysInPeriod: days.length,
        stayDetails: x.stays.map(st => ({
          guest: st.reservation.guestName,
          arrival: st.reservation.arrival.slice(0, 10),
          departure: st.reservation.departure.slice(0, 10),
          status: st.reservation.status,
          nightsInPeriod: st.nights,
          roomRevenue: st.roomRevenue,
          foodBeverage: st.foodBeverage,
          otherCharges: st.otherCharges,
          total: round2(st.roomRevenue + st.foodBeverage + st.otherCharges),
        })),
      };
    }

    // Every room, best seller first (rooms nobody stayed in still appear, at the bottom),
    // with a totals row.
    const summaries = frontOfficeStore.rooms
      .map(summarise)
      .sort((a, b) => b.totalSales - a.totalSales || a.room.id.localeCompare(b.room.id, undefined, { numeric: true }));
    if (summaries.length === 0) return [];
    const sumOf = (pick: (x: ReturnType<typeof summarise>) => number) => summaries.reduce((t, x) => t + pick(x), 0);
    const nights = sumOf(x => x.nightsOccupied);
    const roomRevenue = round2(sumOf(x => x.roomRevenue));
    return [
      ...summaries.map((x, i) => ({ rank: i + 1, ...rowOf(x) })),
      {
        rank: '',
        room: 'Total',
        roomType: '',
        nightsOccupied: nights,
        occupancyRate: days.length > 0 ? round2((nights / (summaries.length * days.length)) * 100) : 0,
        stays: sumOf(x => x.stays.length),
        guests: sumOf(x => x.guests),
        roomRevenue,
        foodBeverage: round2(sumOf(x => x.foodBeverage)),
        otherCharges: round2(sumOf(x => x.otherCharges)),
        totalSales: round2(sumOf(x => x.totalSales)),
        averageDailyRate: nights > 0 ? round2(roomRevenue / nights) : 0,
      },
    ];
  },

  generatePaceReport: (date, endDate = date) => {
    console.log(`[REPORTS] Generating pace report for ${date}${endDate !== date ? ` to ${endDate}` : ''}`);

    // A true pace report compares bookings-on-the-books today to the equivalent
    // point last year — that needs daily historical snapshots, which nothing in
    // this system captures yet. What's reported here is real: bookings on the
    // books for each arrival date in range, segmented by RatePlan.marketSegment.
    // historicalBookings/pacePercentage are explicitly null rather than a
    // fabricated comparison — there is no baseline to compare against.
    // Excludes only cancelled/no-show — a reservation whose current status has
    // since moved on to checked-in/checked-out still genuinely arrived that day.
    const arrivals = frontOfficeStore.reservations.filter(r =>
      dateInRange(r.arrival, date, endDate) && r.status !== 'cancelled' && r.status !== 'no-show'
    );
    if (arrivals.length === 0) return [];

    const segmentOf = (r: typeof arrivals[number]) => {
      const plan = r.ratePlanId ? frontOfficeStore.ratePlans.find(rp => rp.id === r.ratePlanId) : undefined;
      return plan?.marketSegment || 'Unclassified';
    };
    const totalRooms = frontOfficeStore.rooms.length;

    // Grouped by (arrival date, segment) rather than segment alone — a
    // ranged query spans multiple distinct arrival dates, each of which
    // needs its own occupancy-as-of-that-day figure, not one figure for
    // the whole window.
    const groups = new Map<string, typeof arrivals>();
    for (const r of arrivals) {
      const key = `${r.arrival}::${segmentOf(r)}`;
      const existing = groups.get(key);
      if (existing) existing.push(r); else groups.set(key, [r]);
    }

    return Array.from(groups.entries()).map(([key, segReservations]) => {
      const [arrivalDate, marketSegment] = key.split('::');
      const occupiedRooms = frontOfficeStore.reservations.filter(r => wasInHouseDuring(r, arrivalDate, arrivalDate)).length;
      const projectedOccupancy = totalRooms > 0 ? (occupiedRooms / totalRooms) * 100 : 0;
      const revenuePace = segReservations.reduce((sum, r) => {
        const quote = frontOfficeStore.getReservationQuote(r);
        return sum + quote.grandTotal;
      }, 0);

      return {
        date: arrivalDate,
        currentBookings: segReservations.length,
        historicalBookings: null,
        pacePercentage: null,
        projectedOccupancy,
        revenuePace,
        marketSegment
      };
    });
  },

  generateNoShowReport: (date, endDate = date) => {
    console.log(`[REPORTS] Generating no-show report for ${date}${endDate !== date ? ` to ${endDate}` : ''}`);

    // Actual no-shows — reservations the night audit already flagged 'no-show'
    // (frontoffice/store.ts markNoShow / the night-audit cron), not merely
    // reservations still sitting in 'confirmed' for the date.
    return frontOfficeStore.reservations
      .filter(reservation =>
        dateInRange(reservation.arrival, date, endDate) &&
        reservation.status === 'no-show'
      )
      .map(reservation => ({
        guestName: reservation.guestName,
        roomType: frontOfficeStore.roomTypes.find(rt => rt.id === reservation.roomTypeId)?.name || 'Unknown',
        arrivalDate: reservation.arrival,
        reservationSource: reservation.source || 'Direct',
        guaranteed: reservation.isGuaranteed || false,
        depositAmount: reservation.deposit?.amount || 0,
        noShowReason: 'Not recorded',
        followUpRequired: true
      }));
  },

  generateSourceOfBusinessReport: (startDate, endDate) => {
    console.log(`[REPORTS] Generating source of business report from ${startDate} to ${endDate}`);
    
    const sources = ['Direct', 'Booking.com', 'Expedia', 'Corporate', 'Travel Agent'];
    
    const inRange = frontOfficeStore.reservations.filter(r => r.arrival >= startDate && r.arrival <= endDate);
    return sources.map(source => {
      const sourceReservations = inRange.filter(r => r.source === source);
      const bookings = sourceReservations.length;
      const revenue = sourceReservations.reduce((sum, r) => {
        const folio = findMainFolio(frontOfficeStore.folios, r.id);
        return sum + (folio ? getFolioDisplayTotals(folio, endDate).totalCharges : 0);
      }, 0);

      return {
        source,
        bookings,
        revenue,
        averageRate: bookings > 0 ? revenue / bookings : 0,
        percentageOfTotal: inRange.length > 0 ? (bookings / inRange.length) * 100 : 0,
        trend: 'stable' as const
      };
    });
  },

  generateMarketSegmentationReport: (startDate, endDate) => {
    console.log(`[REPORTS] Generating market segmentation report from ${startDate} to ${endDate}`);

    // Segment comes from the reservation's rate plan (RatePlan.marketSegment is a
    // real, staff-configured field — see Settings > Room Management > Rate Plans),
    // falling back to 'Unclassified' when no rate plan/segment was set.
    const inRange = frontOfficeStore.reservations.filter(r => r.arrival >= startDate && r.arrival <= endDate);
    const segmentOf = (r: typeof inRange[number]) => {
      const plan = r.ratePlanId ? frontOfficeStore.ratePlans.find(rp => rp.id === r.ratePlanId) : undefined;
      return plan?.marketSegment || 'Unclassified';
    };
    const segments = Array.from(new Set(inRange.map(segmentOf)));
    if (segments.length === 0) return [];

    return segments.map(segment => {
      const segReservations = inRange.filter(r => segmentOf(r) === segment);
      const bookings = segReservations.length;
      let revenue = 0;
      let totalNights = 0;
      for (const r of segReservations) {
        const folio = findMainFolio(frontOfficeStore.folios, r.id);
        revenue += folio ? getFolioDisplayTotals(folio, endDate).totalCharges : 0;
        totalNights += Math.max(0, Math.ceil((new Date(r.departure).getTime() - new Date(r.arrival).getTime()) / (1000 * 60 * 60 * 24)));
      }

      return {
        segment,
        bookings,
        revenue,
        averageRate: bookings > 0 ? revenue / bookings : 0,
        averageLengthOfStay: bookings > 0 ? totalNights / bookings : 0,
        percentageOfTotal: inRange.length > 0 ? (bookings / inRange.length) * 100 : 0
      };
    });
  },

  generateGuestCountMealPlanReport: (date) => {
    console.log(`[REPORTS] Generating guest count meal plan report for ${date}`);

    const mealPlanLabels: Record<string, string> = {
      room_only: 'Room Only',
      bed_breakfast: 'Bed & Breakfast',
      half_board: 'Half Board',
      full_board: 'Full Board',
    };

    const inHouse = frontOfficeStore.reservations.filter(r =>
      r.status === 'checked-in' && r.arrival <= date && r.departure > date
    );
    if (inHouse.length === 0) return [];

    const mealPlanOf = (r: typeof inHouse[number]) => {
      const plan = r.ratePlanId ? frontOfficeStore.ratePlans.find(rp => rp.id === r.ratePlanId) : undefined;
      return (plan as any)?.mealPlan || 'room_only';
    };

    const buckets = Array.from(new Set(inHouse.map(mealPlanOf)));
    // Per-meal (breakfast/lunch/dinner) attendance and dietary restrictions aren't
    // tracked anywhere in this system — omitted rather than reported as
    // fabricated zeros/empties, so only the real guest count per meal plan shows.
    return buckets.map(key => ({
      mealPlan: mealPlanLabels[key] || key,
      guestCount: inHouse.filter(r => mealPlanOf(r) === key).reduce((sum, r) => sum + (r.adults || 0) + (r.children || 0), 0),
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
      const folio = findMainFolio(frontOfficeStore.folios, r.id);
      return sum + (folio ? getFolioDisplayTotals(folio).totalCharges : 0);
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

    // Real discounts, sourced from folio charges tagged "Discount: <reason>" —
    // the actual mechanism staff use in Guest Services > Invoices & Payments >
    // Folio Adjustments. Discounts apply immediately (no separate request/approval
    // step exists in this system), so every one reported here is already "applied";
    // approvedBy isn't tracked per-charge, so it's reported honestly as unknown
    // rather than a fabricated name.
    type Req = { id: string; guestName: string; roomType: string; originalRate: number; requestedRate: number; discountAmount: number; discountPercentage: number; requestReason: string; requestDate: string; status: 'approved'; approvedBy: string; approvedDate: string; revenueImpact: number; marketSegment: string };
    const requests: Req[] = [];
    for (const folio of frontOfficeStore.folios) {
      const reservation = frontOfficeStore.reservations.find(r => r.id === folio.reservationId);
      if (!reservation) continue;
      const roomType = frontOfficeStore.roomTypes.find(rt => rt.id === reservation.roomTypeId)?.name || 'Unknown';
      const plan = reservation.ratePlanId ? frontOfficeStore.ratePlans.find(rp => rp.id === reservation.ratePlanId) : undefined;
      const roomCharges = folio.charges.filter(c => (c.description || '').toLowerCase().includes('room'));
      const originalRate = roomCharges.reduce((s, c) => s + c.amount, 0);
      for (const c of folio.charges) {
        if (!c.description?.startsWith('Discount: ')) continue;
        const chargeDate = (c.date || '').slice(0, 10);
        if (chargeDate < startDate || chargeDate > endDate) continue;
        const discountAmount = Math.abs(c.amount);
        requests.push({
          id: c.id,
          guestName: reservation.guestName,
          roomType,
          originalRate,
          requestedRate: Math.max(0, originalRate - discountAmount),
          discountAmount,
          discountPercentage: originalRate > 0 ? (discountAmount / originalRate) * 100 : 0,
          requestReason: c.description.slice('Discount: '.length),
          requestDate: chargeDate,
          status: 'approved',
          approvedBy: (c as any).staffName || 'Not tracked',
          approvedDate: chargeDate,
          revenueImpact: -discountAmount,
          marketSegment: plan?.marketSegment || 'Unclassified',
        });
      }
    }

    const byReason = new Map<string, { count: number; totalDiscount: number }>();
    const bySegment = new Map<string, { totalDiscount: number; requestCount: number }>();
    const byRoomType = new Map<string, { totalDiscount: number; requestCount: number }>();
    for (const r of requests) {
      const rr = byReason.get(r.requestReason) || { count: 0, totalDiscount: 0 };
      rr.count++; rr.totalDiscount += r.discountAmount; byReason.set(r.requestReason, rr);
      const rs = bySegment.get(r.marketSegment) || { totalDiscount: 0, requestCount: 0 };
      rs.totalDiscount += r.discountAmount; rs.requestCount++; bySegment.set(r.marketSegment, rs);
      const rt = byRoomType.get(r.roomType) || { totalDiscount: 0, requestCount: 0 };
      rt.totalDiscount += r.discountAmount; rt.requestCount++; byRoomType.set(r.roomType, rt);
    }

    return {
      summary: {
        totalRequests: requests.length,
        approvedRequests: requests.length,
        rejectedRequests: 0,
        pendingRequests: 0,
        totalRevenueImpact: requests.reduce((sum, req) => sum + req.revenueImpact, 0),
        averageDiscountPercentage: requests.length > 0 ? requests.reduce((sum, req) => sum + req.discountPercentage, 0) / requests.length : 0
      },
      requests,
      analysis: {
        topReasons: Array.from(byReason.entries()).map(([reason, v]) => ({ reason, ...v })),
        marketSegmentImpact: Array.from(bySegment.entries()).map(([segment, v]) => ({ segment, ...v })),
        roomTypeAnalysis: Array.from(byRoomType.entries()).map(([type, v]) => ({ type, totalDiscount: v.totalDiscount, averageDiscount: v.requestCount > 0 ? v.totalDiscount / v.requestCount : 0 }))
      }
    };
  },

  generateComplimentaryRoomReport: (startDate, endDate) => {
    console.log(`[REPORTS] Generating complimentary room report from ${startDate} to ${endDate}`);

    // Real comps, sourced from folio charges tagged "Complimentary: <reason>" —
    // applied the same way as discounts, via Guest Services > Invoices & Payments
    // > Folio Adjustments. approvedBy isn't tracked per-charge (no separate
    // approval workflow exists), so it's reported honestly as unknown.
    type Room = { id: string; guestName: string; roomType: string; roomNumber: string; originalRate: number; complimentaryReason: string; checkIn: string; checkOut: string; nights: number; revenueLoss: number; approvedBy: string; approvedDate: string; notes: string };
    const rooms: Room[] = [];
    for (const folio of frontOfficeStore.folios) {
      const reservation = frontOfficeStore.reservations.find(r => r.id === folio.reservationId);
      if (!reservation) continue;
      const roomType = frontOfficeStore.roomTypes.find(rt => rt.id === reservation.roomTypeId)?.name || 'Unknown';
      const roomChargesTotal = folio.charges.filter(c => (c.description || '').toLowerCase().includes('room')).reduce((s, c) => s + c.amount, 0);
      const nights = Math.max(1, Math.ceil((new Date(reservation.departure).getTime() - new Date(reservation.arrival).getTime()) / (1000 * 60 * 60 * 24)));
      for (const c of folio.charges) {
        if (!c.description?.startsWith('Complimentary: ')) continue;
        const chargeDate = (c.date || '').slice(0, 10);
        if (chargeDate < startDate || chargeDate > endDate) continue;
        rooms.push({
          id: c.id,
          guestName: reservation.guestName,
          roomType,
          roomNumber: reservation.roomId || 'TBD',
          originalRate: roomChargesTotal,
          complimentaryReason: c.description.slice('Complimentary: '.length),
          checkIn: reservation.arrival.slice(0, 10),
          checkOut: reservation.departure.slice(0, 10),
          nights,
          revenueLoss: Math.abs(c.amount),
          approvedBy: (c as any).staffName || 'Not tracked',
          approvedDate: chargeDate,
          notes: '',
        });
      }
    }

    const byReason = new Map<string, { count: number; revenueLoss: number }>();
    const byRoomType = new Map<string, { count: number; revenueLoss: number }>();
    const byApprover = new Map<string, { count: number; totalRevenueLoss: number }>();
    for (const r of rooms) {
      const rr = byReason.get(r.complimentaryReason) || { count: 0, revenueLoss: 0 };
      rr.count++; rr.revenueLoss += r.revenueLoss; byReason.set(r.complimentaryReason, rr);
      const rt = byRoomType.get(r.roomType) || { count: 0, revenueLoss: 0 };
      rt.count++; rt.revenueLoss += r.revenueLoss; byRoomType.set(r.roomType, rt);
      const ra = byApprover.get(r.approvedBy) || { count: 0, totalRevenueLoss: 0 };
      ra.count++; ra.totalRevenueLoss += r.revenueLoss; byApprover.set(r.approvedBy, ra);
    }
    const totalRevenueLoss = rooms.reduce((sum, room) => sum + room.revenueLoss, 0);
    const pct = (loss: number) => totalRevenueLoss > 0 ? (loss / totalRevenueLoss) * 100 : 0;

    return {
      summary: {
        totalComplimentaryRooms: rooms.length,
        totalNights: rooms.reduce((sum, room) => sum + room.nights, 0),
        totalRevenueLoss,
        averageRate: rooms.length > 0 ? rooms.reduce((sum, room) => sum + room.originalRate, 0) / rooms.length : 0
      },
      rooms,
      analysis: {
        reasons: Array.from(byReason.entries()).map(([reason, v]) => ({ reason, count: v.count, revenueLoss: v.revenueLoss, percentage: pct(v.revenueLoss) })),
        roomTypeImpact: Array.from(byRoomType.entries()).map(([type, v]) => ({ type, count: v.count, revenueLoss: v.revenueLoss, percentage: pct(v.revenueLoss) })),
        approvalAnalysis: Array.from(byApprover.entries()).map(([approver, v]) => ({ approver, ...v }))
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

    const totalRooms = frontOfficeStore.rooms.length;
    const arrivalsInRange = frontOfficeStore.reservations.filter(r => r.arrival >= startDate && r.arrival <= endDate);
    const averageRoomRate = arrivalsInRange.length > 0
      ? arrivalsInRange.reduce((sum, r) => sum + frontOfficeStore.getReservationQuote(r).nightlyGross, 0) / arrivalsInRange.length
      : 0;

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
        approvalRate: discountReport.summary.totalRequests > 0 ? (discountReport.summary.approvedRequests / discountReport.summary.totalRequests) * 100 : 0,
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
      }
      // No pricingRecommendations here — nothing in this system evaluates
      // pricing strategy, so generic advice text ("implement tiered
      // discounts", "review pricing for high-demand periods") would be
      // fabricated, not derived from the actual discount/comp data above.
    };
  },

  // Export and Print
  exportReport: async (reportData, format, filename, generatedLabel) => {
    console.log(`[REPORTS] Exporting report in ${format} format: ${filename}`);

    trackEvent('report_exported', {
      format,
      filename
    });

    // Real files for all three formats, shaped from the same row/section
    // logic the on-screen table uses — not a JSON dump mislabeled with a
    // spreadsheet/PDF mime type. PDF reuses the same jsPDF + jspdf-autotable
    // pair RoomConfigurationDashboard.tsx already uses for the Rooms table's
    // Download PDF, rather than a print-dialog workaround.
    const sections = reportDataToSections(reportData);
    const org: ReportOrgInfo = buildOrgProfile(useSettingsStore.getState());
    // filename is the actual file name (extension and all, e.g.
    // "arrivals_report_2026-09-17.xls") — not fit for display inside the
    // document itself, so derive a readable title from it separately.
    const title = filename.replace(/\.[^.]+$/, '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    const blob = format === 'csv'
      ? new Blob([sectionsToCSV(sections, org, generatedLabel)], { type: 'text/csv' })
      : format === 'excel'
      ? new Blob([sectionsToExcelHtml(title, sections, org, generatedLabel)], { type: 'application/vnd.ms-excel' })
      : await sectionsToPdfBlob(title, sections, org, generatedLabel);
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
