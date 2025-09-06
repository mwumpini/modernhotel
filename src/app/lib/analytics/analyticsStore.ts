'use client';

import { create } from 'zustand';
import { trackEvent } from './trackEvent';
import { useReportingStore } from '../frontoffice/reportingStore';

// Analytics Types
export interface AnalyticsPeriod {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  type: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
}

export interface AnalyticsMetric {
  id: string;
  name: string;
  value: number;
  previousValue: number;
  change: number;
  changePercentage: number;
  target: number;
  unit: string;
  category: 'financial' | 'operational' | 'guest-satisfaction' | 'staff-productivity';
  trend: 'up' | 'down' | 'stable';
  formula: string;
  description: string;
  lastUpdated: string;
}

export interface AnalyticsInsight {
  id: string;
  title: string;
  description: string;
  type: 'positive' | 'negative' | 'neutral' | 'warning';
  impact: 'high' | 'medium' | 'low';
  category: string;
  recommendations: string[];
  dataPoints: Array<{ label: string; value: number; unit: string }>;
}

export interface AnalyticsFilter {
  period: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  startDate: string;
  endDate: string;
  departments: string[];
  metrics: string[];
  includeHistorical: boolean;
}

interface AnalyticsStore {
  // State
  currentPeriod: AnalyticsPeriod;
  metrics: AnalyticsMetric[];
  insights: AnalyticsInsight[];
  filters: AnalyticsFilter;
  isLoading: boolean;
  lastRefresh: string | null;
  
  // Actions
  setPeriod: (period: AnalyticsPeriod) => void;
  updateFilters: (filters: Partial<AnalyticsFilter>) => void;
  refreshAnalytics: () => Promise<void>;
  generateInsights: () => AnalyticsInsight[];
  exportAnalytics: (format: 'pdf' | 'excel' | 'csv') => Promise<string>;
  
  // Calculations
  calculateKPIMetrics: () => AnalyticsMetric[];
  calculateRevenueAnalytics: () => any;
  calculateOccupancyAnalytics: () => any;
  calculateGuestAnalytics: () => any;
  calculateFinancialAnalytics: () => any;
  calculatePerformanceAnalytics: () => any;
  
  // Pricing & Revenue Analytics
  calculateDiscountAnalytics: () => any;
  calculateComplimentaryRoomAnalytics: () => any;
  calculatePricingStrategyAnalytics: () => any;
  
  // Additional Analytics Features
  calculateTrendAnalytics: () => any;
  calculateSeasonality: (trendData: any[]) => any;
  generateForecast: (trendData: any[]) => any;
  linearRegression: (x: number[], y: number[]) => { slope: number; intercept: number };
  calculateTrend: (recent: number[], previous: number[]) => { direction: string; percentage: number };
  calculateConfidence: (data: number[]) => number;
  
  // Export Methods
  exportToCSV: (data: any) => Promise<string>;
  exportToExcel: (data: any) => Promise<string>;
  exportToPDF: (data: any) => Promise<string>;
  convertToCSV: (data: any) => string;
}

const defaultFilters: AnalyticsFilter = {
  period: 'monthly',
  startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  endDate: new Date().toISOString().split('T')[0],
  departments: ['guest-services', 'housekeeping', 'food-beverage'],
  metrics: ['occupancy-rate', 'adr', 'revpar', 'guest-satisfaction', 'profit-margin'],
  includeHistorical: true
};

const defaultPeriod: AnalyticsPeriod = {
  id: 'current-month',
  name: 'Current Month',
  startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  endDate: new Date().toISOString().split('T')[0],
  type: 'monthly'
};

export const useAnalyticsStore = create<AnalyticsStore>((set, get) => ({
  // Initial State
  currentPeriod: defaultPeriod,
  metrics: [],
  insights: [],
  filters: defaultFilters,
  isLoading: false,
  lastRefresh: null,

  // Actions
  setPeriod: (period: AnalyticsPeriod) => {
    console.log(`[ANALYTICS STORE] Setting period to: ${period.name}`);
    set({ currentPeriod: period });
    trackEvent('Analytics.PeriodChanged', { period: period.type });
  },

  updateFilters: (filters: Partial<AnalyticsFilter>) => {
    console.log(`[ANALYTICS STORE] Updating filters:`, filters);
    set((state) => ({ 
      filters: { ...state.filters, ...filters } 
    }));
    trackEvent('Analytics.FiltersUpdated', { filters });
  },

  refreshAnalytics: async () => {
    console.log(`[ANALYTICS STORE] Refreshing analytics data`);
    set({ isLoading: true });
    
    try {
      // Calculate all metrics
      const metrics = get().calculateKPIMetrics();
      const insights = get().generateInsights();
      
      set({ 
        metrics, 
        insights, 
        lastRefresh: new Date().toISOString(),
        isLoading: false 
      });
      
      trackEvent('Analytics.Refreshed', { 
        metrics_count: metrics.length,
        insights_count: insights.length 
      });
      
      console.log(`[ANALYTICS STORE] Successfully refreshed analytics with ${metrics.length} metrics and ${insights.length} insights`);
    } catch (error) {
      console.error(`[ANALYTICS STORE] Error refreshing analytics:`, error);
      set({ isLoading: false });
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      trackEvent('Analytics.RefreshError', { error: errorMessage });
    }
  },

  generateInsights: () => {
    console.log(`[ANALYTICS STORE] Generating insights`);
    const metrics = get().metrics;
    const insights: AnalyticsInsight[] = [];

    // Occupancy insights
    const occupancyMetric = metrics.find(m => m.id === 'occupancy-rate');
    if (occupancyMetric) {
      if (occupancyMetric.value < 60) {
        insights.push({
          id: 'low-occupancy',
          title: 'Low Occupancy Rate',
          description: `Current occupancy rate of ${occupancyMetric.value.toFixed(1)}% is below optimal levels.`,
          type: 'warning',
          impact: 'high',
          category: 'operational',
          recommendations: [
            'Review pricing strategy',
            'Increase marketing efforts',
            'Consider promotional packages',
            'Analyze competitor rates'
          ],
          dataPoints: [
            { label: 'Current Occupancy', value: occupancyMetric.value, unit: '%' },
            { label: 'Target Occupancy', value: occupancyMetric.target, unit: '%' }
          ]
        });
      } else if (occupancyMetric.value > 90) {
        insights.push({
          id: 'high-occupancy',
          title: 'High Occupancy Rate',
          description: `Excellent occupancy rate of ${occupancyMetric.value.toFixed(1)}% indicates strong demand.`,
          type: 'positive',
          impact: 'high',
          category: 'operational',
          recommendations: [
            'Consider rate optimization',
            'Plan for peak season pricing',
            'Review capacity management',
            'Prepare for increased demand'
          ],
          dataPoints: [
            { label: 'Current Occupancy', value: occupancyMetric.value, unit: '%' },
            { label: 'Target Occupancy', value: occupancyMetric.target, unit: '%' }
          ]
        });
      }
    }

    // ADR insights
    const adrMetric = metrics.find(m => m.id === 'adr');
    if (adrMetric) {
      if (adrMetric.changePercentage < -5) {
        insights.push({
          id: 'declining-adr',
          title: 'Declining Average Daily Rate',
          description: `ADR has decreased by ${Math.abs(adrMetric.changePercentage).toFixed(1)}% compared to previous period.`,
          type: 'negative',
          impact: 'medium',
          category: 'financial',
          recommendations: [
            'Review pricing strategy',
            'Analyze market conditions',
            'Check competitor rates',
            'Consider value-added services'
          ],
          dataPoints: [
            { label: 'Current ADR', value: adrMetric.value, unit: 'GHS' },
            { label: 'Previous ADR', value: adrMetric.previousValue, unit: 'GHS' }
          ]
        });
      }
    }

    // Guest satisfaction insights
    const satisfactionMetric = metrics.find(m => m.id === 'guest-satisfaction');
    if (satisfactionMetric) {
      if (satisfactionMetric.value < 4.0) {
        insights.push({
          id: 'low-satisfaction',
          title: 'Low Guest Satisfaction',
          description: `Guest satisfaction score of ${satisfactionMetric.value.toFixed(1)}/5 needs attention.`,
          type: 'warning',
          impact: 'high',
          category: 'guest-satisfaction',
          recommendations: [
            'Review guest feedback',
            'Improve service training',
            'Address common complaints',
            'Enhance guest experience'
          ],
          dataPoints: [
            { label: 'Current Score', value: satisfactionMetric.value, unit: '/5' },
            { label: 'Target Score', value: satisfactionMetric.target, unit: '/5' }
          ]
        });
      }
    }

    console.log(`[ANALYTICS STORE] Generated ${insights.length} insights`);
    return insights;
  },

  exportAnalytics: async (format: 'pdf' | 'excel' | 'csv') => {
    console.log(`[ANALYTICS STORE] Exporting analytics in ${format} format`);
    
    const { metrics, insights, currentPeriod } = get();
    const trendAnalytics = get().calculateTrendAnalytics();
    
    const exportData = {
      period: currentPeriod,
      metrics,
      insights,
      trends: trendAnalytics.trends,
      seasonality: trendAnalytics.seasonality,
      forecast: trendAnalytics.forecast,
      generatedAt: new Date().toISOString()
    };

    try {
      let filename = '';
      
      if (format === 'csv') {
        filename = await get().exportToCSV(exportData);
      } else if (format === 'excel') {
        filename = await get().exportToExcel(exportData);
      } else {
        filename = await get().exportToPDF(exportData);
      }
      
      trackEvent('Analytics.Exported', { format, filename });
      return filename;
    } catch (error) {
      console.error(`[ANALYTICS STORE] Export error:`, error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      trackEvent('Analytics.ExportError', { format, error: errorMessage });
      throw error;
    }
  },

  exportToCSV: async (data: any) => {
    // Implementation for CSV export
    const csvContent = get().convertToCSV(data);
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analytics_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    return a.download;
  },

  exportToExcel: async (data: any) => {
    // Implementation for Excel export
    const filename = `analytics_${new Date().toISOString().split('T')[0]}.xlsx`;
    // This would typically use a library like xlsx
    console.log(`[ANALYTICS STORE] Excel export not yet implemented, returning filename: ${filename}`);
    return filename;
  },

  exportToPDF: async (data: any) => {
    // Implementation for PDF export
    const filename = `analytics_${new Date().toISOString().split('T')[0]}.pdf`;
    // This would typically use a library like jsPDF
    console.log(`[ANALYTICS STORE] PDF export not yet implemented, returning filename: ${filename}`);
    return filename;
  },

  convertToCSV: (data: any) => {
    // Simple CSV conversion
    const flatten = (obj: any, prefix = '') => {
      const result: string[] = [];
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          const value = obj[key];
          if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            result.push(...flatten(value, `${prefix}${key}_`));
          } else {
            result.push(`${prefix}${key},${value}`);
          }
        }
      }
      return result;
    };
    
    const flattened = flatten(data);
    return flattened.join('\n');
  },

  // Calculations
  calculateKPIMetrics: () => {
    console.log(`[ANALYTICS STORE] Calculating KPI metrics`);
    
    const reportingStore = useReportingStore.getState();
    const { currentPeriod } = get();
    
    const dailyFlashReport = reportingStore.generateDailyFlashReport(currentPeriod.endDate);
    const inHouseGuests = reportingStore.generateInHouseGuestReport(currentPeriod.endDate);
    
    // Calculate base values
    const totalRevenue = dailyFlashReport.revenue.totalRevenue;
    const roomRevenue = dailyFlashReport.revenue.roomRevenue;
    const occupiedRooms = dailyFlashReport.occupancy.occupiedRooms;
    const totalRooms = dailyFlashReport.occupancy.totalRooms;
    const totalGuests = inHouseGuests.length;
    
    // Calculate metrics with historical comparison (simplified)
    const metrics: AnalyticsMetric[] = [
      {
        id: 'occupancy-rate',
        name: 'Occupancy Rate',
        value: (occupiedRooms / totalRooms) * 100,
        previousValue: 75, // Example historical value
        change: ((occupiedRooms / totalRooms) * 100) - 75,
        changePercentage: (((occupiedRooms / totalRooms) * 100) - 75) / 75 * 100,
        target: 85,
        unit: '%',
        category: 'operational',
        trend: (occupiedRooms / totalRooms) * 100 > 75 ? 'up' : 'down',
        formula: '(Occupied Rooms / Total Rooms) × 100',
        description: 'Percentage of rooms occupied compared to total available rooms',
        lastUpdated: new Date().toISOString()
      },
      {
        id: 'adr',
        name: 'Average Daily Rate (ADR)',
        value: occupiedRooms > 0 ? roomRevenue / occupiedRooms : 0,
        previousValue: 750, // Example historical value
        change: (occupiedRooms > 0 ? roomRevenue / occupiedRooms : 0) - 750,
        changePercentage: ((occupiedRooms > 0 ? roomRevenue / occupiedRooms : 0) - 750) / 750 * 100,
        target: 800,
        unit: 'GHS',
        category: 'financial',
        trend: (occupiedRooms > 0 ? roomRevenue / occupiedRooms : 0) > 750 ? 'up' : 'down',
        formula: 'Room Revenue / Occupied Rooms',
        description: 'Average rate earned per occupied room per day',
        lastUpdated: new Date().toISOString()
      },
      {
        id: 'revpar',
        name: 'Revenue Per Available Room (RevPAR)',
        value: totalRevenue / totalRooms,
        previousValue: 600, // Example historical value
        change: (totalRevenue / totalRooms) - 600,
        changePercentage: ((totalRevenue / totalRooms) - 600) / 600 * 100,
        target: 650,
        unit: 'GHS',
        category: 'financial',
        trend: (totalRevenue / totalRooms) > 600 ? 'up' : 'down',
        formula: 'Total Revenue / Total Rooms',
        description: 'Revenue generated per available room, regardless of occupancy',
        lastUpdated: new Date().toISOString()
      },
      {
        id: 'guest-satisfaction',
        name: 'Guest Satisfaction Score',
        value: 4.6, // Example value - would come from actual guest feedback
        previousValue: 4.5,
        change: 4.6 - 4.5,
        changePercentage: (4.6 - 4.5) / 4.5 * 100,
        target: 4.5,
        unit: '/5',
        category: 'guest-satisfaction',
        trend: 4.6 > 4.5 ? 'up' : 'down',
        formula: 'Average of all guest satisfaction ratings',
        description: 'Average guest satisfaction rating from feedback surveys',
        lastUpdated: new Date().toISOString()
      },
      {
        id: 'profit-margin',
        name: 'Profit Margin',
        value: 28, // Example value - would be calculated from financial data
        previousValue: 25,
        change: 28 - 25,
        changePercentage: (28 - 25) / 25 * 100,
        target: 25,
        unit: '%',
        category: 'financial',
        trend: 28 > 25 ? 'up' : 'down',
        formula: '(Net Profit / Total Revenue) × 100',
        description: 'Percentage of revenue that becomes profit after expenses',
        lastUpdated: new Date().toISOString()
      },
      {
        id: 'staff-productivity',
        name: 'Staff Productivity',
        value: 85, // Example value - would come from task completion data
        previousValue: 82,
        change: 85 - 82,
        changePercentage: (85 - 82) / 82 * 100,
        target: 90,
        unit: '%',
        category: 'staff-productivity',
        trend: 85 > 82 ? 'up' : 'down',
        formula: '(Completed Tasks / Assigned Tasks) × 100',
        description: 'Percentage of assigned tasks completed by staff',
        lastUpdated: new Date().toISOString()
      }
    ];
    
    console.log(`[ANALYTICS STORE] Calculated ${metrics.length} KPI metrics`);
    return metrics;
  },

  calculateRevenueAnalytics: () => {
    console.log(`[ANALYTICS STORE] Calculating revenue analytics`);
    
    try {
      const reportingStore = useReportingStore.getState();
      const { currentPeriod } = get();
      
      const dailyFlashReport = reportingStore.generateDailyFlashReport(currentPeriod.endDate);
      
      if (!dailyFlashReport || !dailyFlashReport.revenue || !dailyFlashReport.occupancy) {
        console.warn('[ANALYTICS STORE] Daily flash report not available, using default values');
        return {
          totalRevenue: 50000,
          roomRevenue: 40000,
          fBRevenue: 7500,
          otherRevenue: 2500,
          averageDailyRate: 800,
          revenuePerAvailableRoom: 600,
          revenuePerOccupiedRoom: 800,
          revenueGrowthRate: 12.5,
          revenueBySource: [
            { source: 'Direct Bookings', amount: 20000, percentage: 40 },
            { source: 'Online Travel Agencies', amount: 17500, percentage: 35 },
            { source: 'Corporate', amount: 7500, percentage: 15 },
            { source: 'Walk-ins', amount: 5000, percentage: 10 }
          ],
          revenueBySegment: [
            { segment: 'Leisure', amount: 30000, percentage: 60 },
            { segment: 'Business', amount: 15000, percentage: 30 },
            { segment: 'Group', amount: 5000, percentage: 10 }
          ]
        };
      }
      
      const totalRevenue = dailyFlashReport.revenue.totalRevenue;
      const roomRevenue = dailyFlashReport.revenue.roomRevenue;
      const fBRevenue = dailyFlashReport.revenue.foodBeverageRevenue;
      const otherRevenue = dailyFlashReport.revenue.otherRevenue;
      const occupiedRooms = dailyFlashReport.occupancy.occupiedRooms;
      const totalRooms = dailyFlashReport.occupancy.totalRooms;
      
      return {
        totalRevenue,
        roomRevenue,
        fBRevenue,
        otherRevenue,
        averageDailyRate: occupiedRooms > 0 ? roomRevenue / occupiedRooms : 0,
        revenuePerAvailableRoom: totalRevenue / totalRooms,
        revenuePerOccupiedRoom: occupiedRooms > 0 ? totalRevenue / occupiedRooms : 0,
        revenueGrowthRate: 12.5, // Example value
        revenueBySource: [
          { source: 'Direct Bookings', amount: totalRevenue * 0.4, percentage: 40 },
          { source: 'Online Travel Agencies', amount: totalRevenue * 0.35, percentage: 35 },
          { source: 'Corporate', amount: totalRevenue * 0.15, percentage: 15 },
          { source: 'Walk-ins', amount: totalRevenue * 0.1, percentage: 10 }
        ],
        revenueBySegment: [
          { segment: 'Leisure', amount: totalRevenue * 0.6, percentage: 60 },
          { segment: 'Business', amount: totalRevenue * 0.3, percentage: 30 },
          { segment: 'Group', amount: totalRevenue * 0.1, percentage: 10 }
        ]
      };
    } catch (error) {
      console.error('[ANALYTICS STORE] Error calculating revenue analytics:', error);
      // Return default values on error
      return {
        totalRevenue: 50000,
        roomRevenue: 40000,
        fBRevenue: 7500,
        otherRevenue: 2500,
        averageDailyRate: 800,
        revenuePerAvailableRoom: 600,
        revenuePerOccupiedRoom: 800,
        revenueGrowthRate: 12.5,
        revenueBySource: [
          { source: 'Direct Bookings', amount: 20000, percentage: 40 },
          { source: 'Online Travel Agencies', amount: 17500, percentage: 35 },
          { source: 'Corporate', amount: 7500, percentage: 15 },
          { source: 'Walk-ins', amount: 5000, percentage: 10 }
        ],
        revenueBySegment: [
          { segment: 'Leisure', amount: 30000, percentage: 60 },
          { segment: 'Business', amount: 15000, percentage: 30 },
          { segment: 'Group', amount: 5000, percentage: 10 }
        ]
      };
    }
  },

  calculateOccupancyAnalytics: () => {
    console.log(`[ANALYTICS STORE] Calculating occupancy analytics`);
    
    const reportingStore = useReportingStore.getState();
    const { currentPeriod } = get();
    
    const dailyFlashReport = reportingStore.generateDailyFlashReport(currentPeriod.endDate);
    const totalRooms = dailyFlashReport.occupancy.totalRooms;
    const occupiedRooms = dailyFlashReport.occupancy.occupiedRooms;
    const outOfOrderRooms = dailyFlashReport.occupancy.outOfOrderRooms;
    const availableRooms = totalRooms - occupiedRooms - outOfOrderRooms;
    const occupancyRate = (occupiedRooms / totalRooms) * 100;
    
    return {
      occupancyRate,
      availableRooms,
      occupiedRooms,
      totalRooms,
      outOfOrderRooms,
      averageLengthOfStay: 2.5, // Example value
      roomNights: occupiedRooms * 2.5,
      occupancyByRoomType: [
        { type: 'Standard', occupied: Math.floor(occupiedRooms * 0.6), total: Math.floor(totalRooms * 0.6), rate: 85 },
        { type: 'Deluxe', occupied: Math.floor(occupiedRooms * 0.3), total: Math.floor(totalRooms * 0.3), rate: 78 },
        { type: 'Suite', occupied: Math.floor(occupiedRooms * 0.1), total: Math.floor(totalRooms * 0.1), rate: 92 }
      ],
      occupancyTrend: Array.from({ length: 7 }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - i);
        return {
          date: date.toISOString().split('T')[0],
          rate: 70 + Math.random() * 20
        };
      }).reverse()
    };
  },

  calculateGuestAnalytics: () => {
    console.log(`[ANALYTICS STORE] Calculating guest analytics`);
    
    const reportingStore = useReportingStore.getState();
    const { currentPeriod } = get();
    
    const inHouseGuests = reportingStore.generateInHouseGuestReport(currentPeriod.endDate);
    const totalGuests = inHouseGuests.length;
    const newGuests = Math.floor(totalGuests * 0.7);
    const returningGuests = totalGuests - newGuests;
    const vipGuests = inHouseGuests.filter(guest => guest.vipStatus !== 'regular').length;
    
    return {
      totalGuests,
      newGuests,
      returningGuests,
      guestSatisfactionScore: 4.6, // Example value
      averageGuestSpend: 1200, // Example value
      guestRetentionRate: 65, // Example value
      vipGuests,
      guestsByNationality: [
        { nationality: 'Ghanaian', count: Math.floor(totalGuests * 0.4), percentage: 40 },
        { nationality: 'Nigerian', count: Math.floor(totalGuests * 0.2), percentage: 20 },
        { nationality: 'American', count: Math.floor(totalGuests * 0.15), percentage: 15 },
        { nationality: 'British', count: Math.floor(totalGuests * 0.1), percentage: 10 },
        { nationality: 'Other', count: Math.floor(totalGuests * 0.15), percentage: 15 }
      ],
      guestsByPurpose: [
        { purpose: 'Business', count: Math.floor(totalGuests * 0.4), percentage: 40 },
        { purpose: 'Leisure', count: Math.floor(totalGuests * 0.35), percentage: 35 },
        { purpose: 'Conference', count: Math.floor(totalGuests * 0.15), percentage: 15 },
        { purpose: 'Other', count: Math.floor(totalGuests * 0.1), percentage: 10 }
      ]
    };
  },

  calculateFinancialAnalytics: () => {
    console.log(`[ANALYTICS STORE] Calculating financial analytics`);
    
    const revenueAnalytics = get().calculateRevenueAnalytics();
    const occupancyAnalytics = get().calculateOccupancyAnalytics();
    const guestAnalytics = get().calculateGuestAnalytics();
    
    const totalRevenue = revenueAnalytics.totalRevenue;
    const operatingExpenses = totalRevenue * 0.65; // Example: 65% of revenue
    const grossProfit = totalRevenue - operatingExpenses;
    const netProfit = grossProfit * 0.8; // Example: 80% of gross profit
    const profitMargin = (netProfit / totalRevenue) * 100;
    
    return {
      grossProfit,
      netProfit,
      profitMargin,
      operatingExpenses,
      costPerRoom: operatingExpenses / occupancyAnalytics.totalRooms,
      averageTransactionValue: totalRevenue / (guestAnalytics.totalGuests * 2),
      outstandingReceivables: totalRevenue * 0.1,
      cashFlow: totalRevenue - (totalRevenue * 0.1),
      financialRatios: {
        currentRatio: 1.8,
        quickRatio: 1.2,
        debtToEquity: 0.4,
        returnOnInvestment: 15.5
      }
    };
  },

  calculatePerformanceAnalytics: () => {
    console.log(`[ANALYTICS STORE] Calculating performance analytics`);
    
    return {
      staffProductivity: 85,
      averageCheckInTime: 3.5,
      averageCheckOutTime: 2.8,
      roomTurnoverRate: 0.4,
      maintenanceResponseTime: 15,
      guestComplaints: 5,
      resolutionTime: 2.5,
      staffEfficiency: [
        { staff: 'Front Desk Team', efficiency: 92, tasks: 45 },
        { staff: 'Housekeeping', efficiency: 88, tasks: 38 },
        { staff: 'Maintenance', efficiency: 85, tasks: 12 },
        { staff: 'Food & Beverage', efficiency: 90, tasks: 28 }
      ]
    };
  },

  calculateDiscountAnalytics: () => {
    console.log(`[ANALYTICS STORE] Calculating discount analytics`);
    
    try {
      const reportingStore = useReportingStore.getState();
      const { currentPeriod } = get();
      
      const discountReport = reportingStore.generateDiscountRequestReport(currentPeriod.startDate, currentPeriod.endDate);
      
      if (!discountReport || !discountReport.summary) {
        console.warn('[ANALYTICS STORE] Discount report not available, using default values');
        return {
          totalRequests: 15,
          approvalRate: 80,
          averageDiscountPercentage: 12.5,
          totalRevenueImpact: -2500,
          topReasons: [
            { reason: 'Corporate rate', count: 8, totalDiscount: 1200 },
            { reason: 'Long stay discount', count: 4, totalDiscount: 600 },
            { reason: 'VIP guest', count: 3, totalDiscount: 700 }
          ],
          marketSegmentImpact: [
            { segment: 'Corporate', totalDiscount: 1200, requestCount: 8, percentage: 48 },
            { segment: 'Leisure', totalDiscount: 600, requestCount: 4, percentage: 24 },
            { segment: 'VIP', totalDiscount: 700, requestCount: 3, percentage: 28 }
          ],
          roomTypeAnalysis: [
            { type: 'Standard', totalDiscount: 800, averageDiscount: 133, requestCount: 6 },
            { type: 'Deluxe', totalDiscount: 1200, averageDiscount: 200, requestCount: 6 },
            { type: 'Suite', totalDiscount: 500, averageDiscount: 250, requestCount: 2 }
          ]
        };
      }
      
      return {
        totalRequests: discountReport.summary.totalRequests,
        approvalRate: (discountReport.summary.approvedRequests / discountReport.summary.totalRequests) * 100,
        averageDiscountPercentage: discountReport.summary.averageDiscountPercentage,
        totalRevenueImpact: discountReport.summary.totalRevenueImpact,
        topReasons: discountReport.analysis.topReasons,
        marketSegmentImpact: discountReport.analysis.marketSegmentImpact,
        roomTypeAnalysis: discountReport.analysis.roomTypeAnalysis
      };
    } catch (error) {
      console.error('[ANALYTICS STORE] Error calculating discount analytics:', error);
      return {
        totalRequests: 0,
        approvalRate: 0,
        averageDiscountPercentage: 0,
        totalRevenueImpact: 0,
        topReasons: [],
        marketSegmentImpact: [],
        roomTypeAnalysis: []
      };
    }
  },

  calculateComplimentaryRoomAnalytics: () => {
    console.log(`[ANALYTICS STORE] Calculating complimentary room analytics`);
    
    try {
      const reportingStore = useReportingStore.getState();
      const { currentPeriod } = get();
      
      const complimentaryReport = reportingStore.generateComplimentaryRoomReport(currentPeriod.startDate, currentPeriod.endDate);
      
      if (!complimentaryReport || !complimentaryReport.summary) {
        console.warn('[ANALYTICS STORE] Complimentary room report not available, using default values');
        return {
          totalRooms: 8,
          totalNights: 16,
          totalRevenueLoss: 12000,
          averageRate: 1500,
          reasons: [
            { reason: 'VIP guest - loyalty program', count: 3, revenueLoss: 6000, percentage: 50 },
            { reason: 'Corporate partnership agreement', count: 3, revenueLoss: 3600, percentage: 30 },
            { reason: 'Media coverage and promotion', count: 2, revenueLoss: 2400, percentage: 20 }
          ],
          roomTypeImpact: [
            { type: 'Suite', count: 2, revenueLoss: 6000, percentage: 50 },
            { type: 'Deluxe', count: 4, revenueLoss: 4800, percentage: 40 },
            { type: 'Standard', count: 2, revenueLoss: 1200, percentage: 10 }
          ],
          approvalAnalysis: [
            { approver: 'General Manager', count: 4, totalRevenueLoss: 7200 },
            { approver: 'Sales Director', count: 3, totalRevenueLoss: 3600 },
            { approver: 'Marketing Manager', count: 1, totalRevenueLoss: 1200 }
          ]
        };
      }
      
      return {
        totalRooms: complimentaryReport.summary.totalComplimentaryRooms,
        totalNights: complimentaryReport.summary.totalNights,
        totalRevenueLoss: complimentaryReport.summary.totalRevenueLoss,
        averageRate: complimentaryReport.summary.averageRate,
        reasons: complimentaryReport.analysis.reasons,
        roomTypeImpact: complimentaryReport.analysis.roomTypeImpact,
        approvalAnalysis: complimentaryReport.analysis.approvalAnalysis
      };
    } catch (error) {
      console.error('[ANALYTICS STORE] Error calculating complimentary room analytics:', error);
      return {
        totalRooms: 0,
        totalNights: 0,
        totalRevenueLoss: 0,
        averageRate: 0,
        reasons: [],
        roomTypeImpact: [],
        approvalAnalysis: []
      };
    }
  },

  calculatePricingStrategyAnalytics: () => {
    console.log(`[ANALYTICS STORE] Calculating pricing strategy analytics`);
    
    try {
      const discountAnalytics = get().calculateDiscountAnalytics();
      const complimentaryAnalytics = get().calculateComplimentaryRoomAnalytics();
      const revenueAnalytics = get().calculateRevenueAnalytics();
      
      const totalRevenueImpact = (discountAnalytics.totalRevenueImpact || 0) + 
                                (complimentaryAnalytics.totalRevenueLoss || 0);
      
      const totalRevenue = revenueAnalytics.totalRevenue;
      const revenueImpactPercentage = totalRevenue > 0 ? (Math.abs(totalRevenueImpact) / totalRevenue) * 100 : 0;
      
      return {
        totalRevenueImpact,
        revenueImpactPercentage,
        discountImpact: Math.abs(discountAnalytics.totalRevenueImpact || 0),
        complimentaryImpact: complimentaryAnalytics.totalRevenueLoss || 0,
        pricingEfficiency: 100 - revenueImpactPercentage,
        recommendations: [
          {
            category: 'Discount Management',
            action: 'Review discount approval criteria',
            impact: revenueImpactPercentage > 15 ? 'High' : 'Medium',
            priority: revenueImpactPercentage > 15 ? 'Immediate' : 'Short-term'
          },
          {
            category: 'Complimentary Rooms',
            action: 'Establish clear approval guidelines',
            impact: complimentaryAnalytics.totalRevenueLoss > 10000 ? 'High' : 'Medium',
            priority: complimentaryAnalytics.totalRevenueLoss > 10000 ? 'Immediate' : 'Short-term'
          },
          {
            category: 'Revenue Optimization',
            action: 'Implement dynamic pricing strategy',
            impact: 'High',
            priority: 'Medium-term'
          }
        ],
        marketPositioning: {
          averageRate: revenueAnalytics.averageDailyRate,
          rateCompetitiveness: revenueAnalytics.averageDailyRate > 1000 ? 'Premium' : 'Competitive',
          pricingFlexibility: discountAnalytics.approvalRate > 70 ? 'High' : 'Low'
        }
      };
    } catch (error) {
      console.error('[ANALYTICS STORE] Error calculating pricing strategy analytics:', error);
      return {
        totalRevenueImpact: 0,
        revenueImpactPercentage: 0,
        discountImpact: 0,
        complimentaryImpact: 0,
        pricingEfficiency: 0,
        recommendations: [],
        marketPositioning: {
          averageRate: 0,
          rateCompetitiveness: 'Unknown',
          pricingFlexibility: 'Unknown'
        }
      };
    }
  },

  // Additional Analytics Features
  calculateTrendAnalytics: () => {
    console.log(`[ANALYTICS STORE] Calculating trend analytics`);
    
    const reportingStore = useReportingStore.getState();
    const { currentPeriod } = get();
    
    // Generate trend data for the last 30 days
    const trendData = Array.from({ length: 30 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      try {
        const dailyReport = reportingStore.generateDailyFlashReport(dateStr);
        return {
          date: dateStr,
          occupancy: dailyReport.occupancy.occupancyRate,
          revenue: dailyReport.revenue.totalRevenue,
          adr: dailyReport.revenue.averageDailyRate,
          revpar: dailyReport.revenue.revenuePerAvailableRoom
        };
      } catch (error) {
        // Return default values if report generation fails
        return {
          date: dateStr,
          occupancy: 70 + Math.random() * 20,
          revenue: 50000 + Math.random() * 20000,
          adr: 800 + Math.random() * 200,
          revpar: 600 + Math.random() * 150
        };
      }
    }).reverse();

    // Calculate trends
    const recentData = trendData.slice(-7);
    const previousData = trendData.slice(-14, -7);
    
    const occupancyTrend = get().calculateTrend(recentData.map(d => d.occupancy), previousData.map(d => d.revenue));
    const revenueTrend = get().calculateTrend(recentData.map(d => d.revenue), previousData.map(d => d.revenue));
    const adrTrend = get().calculateTrend(recentData.map(d => d.adr), previousData.map(d => d.adr));
    const revparTrend = get().calculateTrend(recentData.map(d => d.revpar), previousData.map(d => d.revpar));

    // Calculate seasonality and forecasting
    const seasonality = get().calculateSeasonality(trendData);
    const forecasting = get().generateForecast(trendData);

    return {
      trendData,
      trends: {
        occupancy: occupancyTrend,
        revenue: revenueTrend,
        adr: adrTrend,
        revpar: revparTrend
      },
      seasonality,
      forecasting
    };
  },

  calculateSeasonality: (trendData: any[]) => {
    console.log(`[ANALYTICS STORE] Calculating seasonality patterns`);
    
    // Group data by day of week
    const weeklyPattern = Array.from({ length: 7 }, (_, dayIndex) => {
      const dayData = trendData.filter((_, index) => index % 7 === dayIndex);
      const avgOccupancy = dayData.reduce((sum, d) => sum + d.occupancy, 0) / dayData.length;
      const avgRevenue = dayData.reduce((sum, d) => sum + d.revenue, 0) / dayData.length;
      
      return {
        day: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayIndex],
        avgOccupancy,
        avgRevenue
      };
    });

    // Group data by month
    const monthlyPattern = Array.from({ length: 12 }, (_, monthIndex) => {
      const monthData = trendData.filter(d => {
        const month = new Date(d.date).getMonth();
        return month === monthIndex;
      });
      
      if (monthData.length === 0) return { month: monthIndex + 1, avgOccupancy: 0, avgRevenue: 0 };
      
      const avgOccupancy = monthData.reduce((sum, d) => sum + d.occupancy, 0) / monthData.length;
      const avgRevenue = monthData.reduce((sum, d) => sum + d.revenue, 0) / monthData.length;
      
      return {
        month: monthIndex + 1,
        avgOccupancy,
        avgRevenue
      };
    });

    return {
      weeklyPattern,
      monthlyPattern,
      peakDays: weeklyPattern.filter(d => d.avgOccupancy > 80),
      lowDays: weeklyPattern.filter(d => d.avgOccupancy < 60)
    };
  },

  generateForecast: (trendData: any[]) => {
    console.log(`[ANALYTICS STORE] Generating forecasts`);
    
    // Simple linear regression for forecasting
    const forecastDays = 30;
    const recentData = trendData.slice(-14); // Use last 14 days for forecasting
    
    const occupancyForecast = get().linearRegression(
      recentData.map((_, i) => i),
      recentData.map(d => d.occupancy)
    );
    
    const revenueForecast = get().linearRegression(
      recentData.map((_, i) => i),
      recentData.map(d => d.revenue)
    );

    const forecast = Array.from({ length: forecastDays }, (_, i) => {
      const dayOffset = recentData.length + i;
      return {
        date: new Date(Date.now() + (i + 1) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        occupancy: Math.max(0, Math.min(100, occupancyForecast.slope * dayOffset + occupancyForecast.intercept)),
        revenue: Math.max(0, revenueForecast.slope * dayOffset + revenueForecast.intercept)
      };
    });

    return {
      forecast,
      confidence: {
        occupancy: get().calculateConfidence(recentData.map(d => d.occupancy)),
        revenue: get().calculateConfidence(recentData.map(d => d.revenue))
      }
    };
  },

  linearRegression: (x: number[], y: number[]) => {
    const n = x.length;
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((a, b, i) => a + b * y[i], 0);
    const sumXX = x.reduce((a, b) => a + b * b, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    
    return { slope, intercept };
  },

  calculateTrend: (recent: number[], previous: number[]) => {
    if (recent.length === 0 || previous.length === 0) return { direction: 'stable', percentage: 0 };
    
    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const previousAvg = previous.reduce((a, b) => a + b, 0) / previous.length;
    
    if (previousAvg === 0) return { direction: 'stable', percentage: 0 };
    
    const percentage = ((recentAvg - previousAvg) / previousAvg) * 100;
    const direction = percentage > 5 ? 'up' : percentage < -5 ? 'down' : 'stable';
    
    return { direction, percentage: Math.abs(percentage) };
  },

  calculateConfidence: (data: number[]) => {
    if (data.length < 2) return 0.5;
    
    const mean = data.reduce((a, b) => a + b, 0) / data.length;
    const variance = data.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (data.length - 1);
    const standardDeviation = Math.sqrt(variance);
    const coefficientOfVariation = standardDeviation / mean;
    
    // Higher CV means lower confidence
    return Math.max(0.1, Math.min(0.95, 1 - coefficientOfVariation));
  }
}));
