'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { 
  Card, CardBody, CardHeader, Button, Badge, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, 
  Tabs, Tab, Chip, Progress, Select, SelectItem, Input, DatePicker, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter,
  useDisclosure, Textarea, Divider, Spinner, Alert, Avatar, Tooltip, Dropdown, DropdownTrigger, DropdownMenu, DropdownItem
} from '@heroui/react';
import { useAnalyticsStore } from '../lib/analytics/analyticsStore';
import { trackEvent } from '../lib/analytics/trackEvent';
import { useSettingsStore } from '../lib/settings/store';

export default function FrontOfficeAnalyticsDashboard() {
  const [selectedTab, setSelectedTab] = useState('overview');
  const [analyticsPeriod, setAnalyticsPeriod] = useState<'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly'>('monthly');
  const [isGenerating, setIsGenerating] = useState(false);
  const [exportFormat, setExportFormat] = useState<'pdf' | 'excel' | 'csv'>('pdf');

  const settings = useSettingsStore();
  const analyticsStore = useAnalyticsStore();

  // Initialize analytics on component mount
  useEffect(() => {
    console.log(`[ANALYTICS] Initializing analytics dashboard`);
    const initializeAnalytics = async () => {
      try {
        await analyticsStore.refreshAnalytics();
      } catch (error) {
        console.error('[ANALYTICS] Error initializing analytics:', error);
      }
    };
    initializeAnalytics();
  }, []); // Only run once on mount

  // Analytics calculations
  const kpiMetrics = useMemo(() => {
    try {
      return analyticsStore.calculateKPIMetrics();
    } catch (error) {
      console.error('[ANALYTICS] Error calculating KPI metrics:', error);
      return [];
    }
  }, [analyticsStore.metrics, analyticsStore.lastRefresh]);

  const revenueAnalytics = useMemo(() => {
    try {
      return analyticsStore.calculateRevenueAnalytics();
    } catch (error) {
      console.error('[ANALYTICS] Error calculating revenue analytics:', error);
      return {};
    }
  }, [analyticsStore.metrics, analyticsStore.lastRefresh]);

  const occupancyAnalytics = useMemo(() => {
    try {
      return analyticsStore.calculateOccupancyAnalytics();
    } catch (error) {
      console.error('[ANALYTICS] Error calculating occupancy analytics:', error);
      return {};
    }
  }, [analyticsStore.metrics, analyticsStore.lastRefresh]);

  const guestAnalytics = useMemo(() => {
    try {
      return analyticsStore.calculateGuestAnalytics();
    } catch (error) {
      console.error('[ANALYTICS] Error calculating guest analytics:', error);
      return {};
    }
  }, [analyticsStore.metrics, analyticsStore.lastRefresh]);

  const financialAnalytics = useMemo(() => {
    try {
      return analyticsStore.calculateFinancialAnalytics();
    } catch (error) {
      console.error('[ANALYTICS] Error calculating financial analytics:', error);
      return {};
    }
  }, [analyticsStore.metrics, analyticsStore.lastRefresh]);

  const performanceAnalytics = useMemo(() => {
    try {
      return analyticsStore.calculatePerformanceAnalytics();
    } catch (error) {
      console.error('[ANALYTICS] Error calculating performance analytics:', error);
      return {};
    }
  }, [analyticsStore.metrics, analyticsStore.lastRefresh]);

  const handleExportAnalytics = async (format: 'pdf' | 'excel' | 'csv') => {
    setIsGenerating(true);
    try {
      console.log(`[ANALYTICS] Exporting analytics in ${format} format`);
      const filename = await analyticsStore.exportAnalytics(format);
      console.log(`[ANALYTICS] Successfully exported analytics report: ${filename}`);
    } catch (error) {
      console.error(`[ANALYTICS] Error exporting analytics:`, error);
    } finally {
      setIsGenerating(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GH', {
      style: 'currency',
      currency: 'GHS'
    }).format(amount);
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  const getTrendColor = (trend: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up': return 'success';
      case 'down': return 'danger';
      case 'stable': return 'warning';
      default: return 'default';
    }
  };

  const getTrendIcon = (trend: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up': return '📈';
      case 'down': return '📉';
      case 'stable': return '➡️';
      default: return '➡️';
    }
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-ghana-black mb-2">📊 Analytics Dashboard</h1>
        <p className="text-gray-600">
          Comprehensive analytics and insights for hotel performance optimization
        </p>
        
        {/* Loading and Error States */}
        {analyticsStore.isLoading && (
          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center space-x-3">
              <Spinner size="sm" />
              <span className="text-blue-700">Loading analytics data...</span>
            </div>
          </div>
        )}
        
        {analyticsStore.error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center space-x-3">
              <span className="text-red-700">⚠️ Error: {analyticsStore.error}</span>
              <Button 
                size="sm" 
                color="danger" 
                variant="flat"
                onClick={() => analyticsStore.refreshAnalytics()}
              >
                Retry
              </Button>
            </div>
          </div>
        )}
        
        {/* Manual Refresh Button */}
        <div className="mt-4 flex items-center space-x-4">
          <Button 
            color="primary" 
            variant="flat"
            onClick={() => analyticsStore.refreshAnalytics()}
            isLoading={analyticsStore.isLoading}
            disabled={analyticsStore.isLoading}
          >
            🔄 Refresh Analytics
          </Button>
          <span className="text-sm text-gray-500">
            Last updated: {analyticsStore.lastRefresh ? new Date(analyticsStore.lastRefresh).toLocaleString() : 'Never'}
          </span>
        </div>
      </div>

      {/* Controls */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Analytics Period
          </label>
          <Select
            selectedKeys={[analyticsPeriod]}
            onSelectionChange={(keys) => setAnalyticsPeriod(Array.from(keys)[0] as any)}
            className="w-full"
          >
            <SelectItem key="daily">Daily</SelectItem>
            <SelectItem key="weekly">Weekly</SelectItem>
            <SelectItem key="monthly">Monthly</SelectItem>
            <SelectItem key="quarterly">Quarterly</SelectItem>
            <SelectItem key="yearly">Yearly</SelectItem>
          </Select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Start Date
          </label>
          <Input
            type="date"
            value={analyticsStore.currentPeriod.startDate}
            onChange={(e) => analyticsStore.setPeriod({
              ...analyticsStore.currentPeriod,
              startDate: e.target.value
            })}
            className="w-full"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            End Date
          </label>
          <Input
            type="date"
            value={analyticsStore.currentPeriod.endDate}
            onChange={(e) => analyticsStore.setPeriod({
              ...analyticsStore.currentPeriod,
              endDate: e.target.value
            })}
            className="w-full"
          />
        </div>
        <div className="flex items-end space-x-2">
          <Button
            color="primary"
            variant="flat"
            onClick={() => {
              analyticsStore.refreshAnalytics();
              console.log(`[ANALYTICS] Refreshed analytics for period: ${analyticsPeriod}`);
            }}
            isLoading={analyticsStore.isLoading}
          >
            🔄 Refresh
          </Button>
          <Dropdown>
            <DropdownTrigger>
              <Button variant="bordered" isLoading={isGenerating}>
                📥 Export
              </Button>
            </DropdownTrigger>
            <DropdownMenu 
              selectedKeys={[exportFormat]} 
              onSelectionChange={(keys) => setExportFormat(Array.from(keys)[0] as 'pdf' | 'excel' | 'csv')}
            >
              <DropdownItem key="pdf">PDF</DropdownItem>
              <DropdownItem key="excel">Excel</DropdownItem>
              <DropdownItem key="csv">CSV</DropdownItem>
            </DropdownMenu>
          </Dropdown>
        </div>
      </div>

      {/* KPI Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {kpiMetrics.map((metric) => (
          <Card key={metric.id} className="border-0 shadow-lg">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-ghana-black">{metric.name}</h3>
                <Chip 
                  color={getTrendColor(metric.trend)} 
                  variant="flat" 
                  size="sm"
                >
                  {getTrendIcon(metric.trend)} {metric.changePercentage > 0 ? '+' : ''}{metric.changePercentage.toFixed(1)}%
                </Chip>
              </div>
            </CardHeader>
            <CardBody>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold text-ghana-black">
                    {metric.value.toFixed(1)}{metric.unit}
                  </span>
                  <span className="text-sm text-gray-500">Target: {metric.target}{metric.unit}</span>
                </div>
                <Progress 
                  value={(metric.value / metric.target) * 100} 
                  color={metric.value >= metric.target ? 'success' : 'warning'}
                  className="mt-2"
                />
                <div className="text-xs text-gray-600">
                  <p><strong>Formula:</strong> {metric.formula}</p>
                  <p><strong>Description:</strong> {metric.description}</p>
                </div>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      {/* Analytics Tabs */}
      <Tabs 
        selectedKey={selectedTab} 
        onSelectionChange={(key) => setSelectedTab(key as string)}
        className="mb-6"
      >
        <Tab key="overview" title="Overview">
          <div className="space-y-6">
            {/* Quick Insights */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="border-0 shadow-lg">
                <CardHeader>
                  <h3 className="text-xl font-semibold text-ghana-black">💰 Revenue Insights</h3>
                </CardHeader>
                <CardBody>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span>Total Revenue:</span>
                      <span className="font-semibold">{formatCurrency(revenueAnalytics.totalRevenue || 0)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Room Revenue:</span>
                      <span className="font-semibold">{formatCurrency(revenueAnalytics.roomRevenue || 0)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>F&B Revenue:</span>
                      <span className="font-semibold">{formatCurrency(revenueAnalytics.fBRevenue || 0)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Growth Rate:</span>
                      <span className="font-semibold text-green-600">+{(revenueAnalytics.revenueGrowthRate || 0).toFixed(1)}%</span>
                    </div>
                  </div>
                </CardBody>
              </Card>

              <Card className="border-0 shadow-lg">
                <CardHeader>
                  <h3 className="text-xl font-semibold text-ghana-black">👥 Guest Insights</h3>
                </CardHeader>
                <CardBody>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span>Total Guests:</span>
                      <span className="font-semibold">{guestAnalytics.totalGuests || 0}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>VIP Guests:</span>
                      <span className="font-semibold">{guestAnalytics.vipGuests || 0}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Satisfaction Score:</span>
                      <span className="font-semibold">{(guestAnalytics.guestSatisfactionScore || 0).toFixed(1)}/5</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Retention Rate:</span>
                      <span className="font-semibold">{(guestAnalytics.guestRetentionRate || 0).toFixed(1)}%</span>
                    </div>
                  </div>
                </CardBody>
              </Card>
            </div>
          </div>
        </Tab>

        <Tab key="revenue" title="Revenue Analytics">
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="border-0 shadow-lg">
                <CardHeader>
                  <h3 className="text-xl font-semibold text-ghana-black">📊 Revenue Breakdown</h3>
                </CardHeader>
                <CardBody>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span>Total Revenue:</span>
                      <span className="font-semibold">{formatCurrency(revenueAnalytics.totalRevenue || 0)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Room Revenue:</span>
                      <span className="font-semibold">{formatCurrency(revenueAnalytics.roomRevenue || 0)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>F&B Revenue:</span>
                      <span className="font-semibold">{formatCurrency(revenueAnalytics.fBRevenue || 0)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Other Revenue:</span>
                      <span className="font-semibold">{formatCurrency(revenueAnalytics.otherRevenue || 0)}</span>
                    </div>
                    <Divider />
                    <div className="flex justify-between items-center">
                      <span>ADR:</span>
                      <span className="font-semibold">{formatCurrency(revenueAnalytics.averageDailyRate || 0)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>RevPAR:</span>
                      <span className="font-semibold">{formatCurrency(revenueAnalytics.revenuePerAvailableRoom || 0)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Revenue per Occupied Room:</span>
                      <span className="font-semibold">{formatCurrency(revenueAnalytics.revenuePerOccupiedRoom || 0)}</span>
                    </div>
                  </div>
                </CardBody>
              </Card>

              <Card className="border-0 shadow-lg">
                <CardHeader>
                  <h3 className="text-xl font-semibold text-ghana-black">📈 Revenue by Source</h3>
                </CardHeader>
                <CardBody>
                  <div className="space-y-3">
                    {(revenueAnalytics.revenueBySource || []).map((source, index) => (
                      <div key={index} className="flex justify-between items-center">
                        <span>{source.source}:</span>
                        <div className="text-right">
                          <div className="font-semibold">{formatCurrency(source.amount)}</div>
                          <div className="text-sm text-gray-500">{source.percentage}%</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardBody>
              </Card>
            </div>
          </div>
        </Tab>

        <Tab key="occupancy" title="Occupancy Analytics">
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="border-0 shadow-lg">
                <CardHeader>
                  <h3 className="text-xl font-semibold text-ghana-black">🏠 Room Status Overview</h3>
                </CardHeader>
                <CardBody>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span>Total Rooms:</span>
                      <span className="font-semibold">{occupancyAnalytics.totalRooms || 0}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Occupied Rooms:</span>
                      <span className="font-semibold">{occupancyAnalytics.occupiedRooms || 0}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Available Rooms:</span>
                      <span className="font-semibold">{occupancyAnalytics.availableRooms || 0}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Out of Order:</span>
                      <span className="font-semibold">{occupancyAnalytics.outOfOrderRooms || 0}</span>
                    </div>
                    <Divider />
                    <div className="flex justify-between items-center">
                      <span>Occupancy Rate:</span>
                      <span className="font-semibold">{formatPercentage(occupancyAnalytics.occupancyRate || 0)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Average Length of Stay:</span>
                      <span className="font-semibold">{(occupancyAnalytics.averageLengthOfStay || 0).toFixed(1)} nights</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Room Nights:</span>
                      <span className="font-semibold">{(occupancyAnalytics.roomNights || 0).toFixed(0)}</span>
                    </div>
                  </div>
                </CardBody>
              </Card>

              <Card className="border-0 shadow-lg">
                <CardHeader>
                  <h3 className="text-xl font-semibold text-ghana-black">📊 Occupancy by Room Type</h3>
                </CardHeader>
                <CardBody>
                  <div className="space-y-3">
                    {(occupancyAnalytics.occupancyByRoomType || []).map((type, index) => (
                      <div key={index} className="flex justify-between items-center">
                        <span>{type.type}:</span>
                        <div className="text-right">
                          <div className="font-semibold">{type.occupied}/{type.total}</div>
                          <div className="text-sm text-gray-500">{formatPercentage(type.rate)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardBody>
              </Card>
            </div>
          </div>
        </Tab>

        <Tab key="financial" title="Financial Analytics">
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="border-0 shadow-lg">
                <CardHeader>
                  <h3 className="text-xl font-semibold text-ghana-black">💰 Profitability Analysis</h3>
                </CardHeader>
                <CardBody>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span>Total Revenue:</span>
                      <span className="font-semibold">{formatCurrency(revenueAnalytics.totalRevenue || 0)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Operating Expenses:</span>
                      <span className="font-semibold">{formatCurrency(financialAnalytics.operatingExpenses || 0)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Gross Profit:</span>
                      <span className="font-semibold">{formatCurrency(financialAnalytics.grossProfit || 0)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Net Profit:</span>
                      <span className="font-semibold">{formatCurrency(financialAnalytics.netProfit || 0)}</span>
                    </div>
                    <Divider />
                    <div className="flex justify-between items-center">
                      <span>Profit Margin:</span>
                      <span className="font-semibold">{formatPercentage(financialAnalytics.profitMargin || 0)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Cost per Room:</span>
                      <span className="font-semibold">{formatCurrency(financialAnalytics.costPerRoom || 0)}</span>
                    </div>
                  </div>
                </CardBody>
              </Card>

              <Card className="border-0 shadow-lg">
                <CardHeader>
                  <h3 className="text-xl font-semibold text-ghana-black">📊 Financial Ratios</h3>
                </CardHeader>
                <CardBody>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span>Current Ratio:</span>
                      <span className="font-semibold">{(financialAnalytics.financialRatios?.currentRatio || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Quick Ratio:</span>
                      <span className="font-semibold">{(financialAnalytics.financialRatios?.quickRatio || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Debt to Equity:</span>
                      <span className="font-semibold">{(financialAnalytics.financialRatios?.debtToEquity || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Return on Investment:</span>
                      <span className="font-semibold">{formatPercentage(financialAnalytics.financialRatios?.returnOnInvestment || 0)}</span>
                    </div>
                  </div>
                </CardBody>
              </Card>
            </div>
          </div>
        </Tab>

        <Tab key="performance" title="Performance Analytics">
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="border-0 shadow-lg">
                <CardHeader>
                  <h3 className="text-xl font-semibold text-ghana-black">⚡ Operational Performance</h3>
                </CardHeader>
                <CardBody>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span>Staff Productivity:</span>
                      <span className="font-semibold">{formatPercentage(performanceAnalytics.staffProductivity || 0)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Average Check-in Time:</span>
                      <span className="font-semibold">{(performanceAnalytics.averageCheckInTime || 0).toFixed(1)} min</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Average Check-out Time:</span>
                      <span className="font-semibold">{(performanceAnalytics.averageCheckOutTime || 0).toFixed(1)} min</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Room Turnover Rate:</span>
                      <span className="font-semibold">{formatPercentage((performanceAnalytics.roomTurnoverRate || 0) * 100)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Maintenance Response Time:</span>
                      <span className="font-semibold">{(performanceAnalytics.maintenanceResponseTime || 0).toFixed(1)} min</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Guest Complaints:</span>
                      <span className="font-semibold">{(performanceAnalytics.guestComplaints || 0).toFixed(1)}/day</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Resolution Time:</span>
                      <span className="font-semibold">{(performanceAnalytics.resolutionTime || 0).toFixed(1)} hours</span>
                    </div>
                  </div>
                </CardBody>
              </Card>

              <Card className="border-0 shadow-lg">
                <CardHeader>
                  <h3 className="text-xl font-semibold text-ghana-black">👥 Staff Efficiency</h3>
                </CardHeader>
                <CardBody>
                  <div className="space-y-3">
                    {(performanceAnalytics.staffEfficiency || []).map((staff, index) => (
                      <div key={index} className="flex justify-between items-center">
                        <span>{staff.staff}:</span>
                        <div className="text-right">
                          <div className="font-semibold">{formatPercentage(staff.efficiency)}</div>
                          <div className="text-sm text-gray-500">{staff.tasks} tasks</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardBody>
              </Card>
            </div>
          </div>
        </Tab>

        <Tab key="trends" title="Trends & Forecasting">
          <div className="space-y-6">
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <h3 className="text-xl font-semibold text-ghana-black">📈 Trend Analysis & Forecasting</h3>
                <p className="text-gray-600">Historical trends, seasonality patterns, and future predictions</p>
              </CardHeader>
              <CardBody>
                <div className="space-y-6">
                  {/* Trend Overview */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div>
                      <h4 className="font-semibold text-lg mb-4">📊 Key Trends (Last 7 Days vs Previous 7 Days)</h4>
                      <div className="space-y-3">
                        {(() => {
                          try {
                            const trendAnalytics = analyticsStore.calculateTrendAnalytics();
                            if (!trendAnalytics || !trendAnalytics.trends) {
                              return (
                                <div className="text-center py-4 text-gray-500">
                                  <p>Trend data not available</p>
                                </div>
                              );
                            }
                            const trends = trendAnalytics.trends;
                            return [
                              { name: 'Occupancy Rate', trend: trends.occupancy, icon: '🏠' },
                              { name: 'Revenue', trend: trends.revenue, icon: '💰' },
                              { name: 'ADR', trend: trends.adr, icon: '📊' },
                              { name: 'RevPAR', trend: trends.revpar, icon: '📈' }
                            ].map((item, index) => (
                              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                <div className="flex items-center space-x-3">
                                  <span className="text-2xl">{item.icon}</span>
                                  <span className="font-medium">{item.name}</span>
                                </div>
                                <div className="text-right">
                                  <div className={`font-semibold ${item.trend.direction === 'up' ? 'text-green-600' : item.trend.direction === 'down' ? 'text-red-600' : 'text-yellow-600'}`}>
                                    {item.trend.direction === 'up' ? '↗️' : item.trend.direction === 'down' ? '↘️' : '➡️'} {item.trend.percentage.toFixed(1)}%
                                  </div>
                                  <div className="text-sm text-gray-500">{item.trend.direction}</div>
                                </div>
                              </div>
                            ));
                          } catch (error) {
                            console.error('[ANALYTICS] Error calculating trends:', error);
                            return (
                              <div className="text-center py-4 text-gray-500">
                                <p>Error loading trend data</p>
                              </div>
                            );
                          }
                        })()}
                      </div>
                    </div>

                    <div>
                      <h4 className="font-semibold text-lg mb-4">📅 Seasonality Patterns</h4>
                      <div className="space-y-3">
                        {(() => {
                          try {
                            const trendAnalytics = analyticsStore.calculateTrendAnalytics();
                            if (!trendAnalytics || !trendAnalytics.seasonality) {
                              return (
                                <div className="text-center py-4 text-gray-500">
                                  <p>Seasonality data not available</p>
                                </div>
                              );
                            }
                            const seasonality = trendAnalytics.seasonality;
                            return (
                              <>
                                <div className="p-3 bg-blue-50 rounded-lg">
                                  <h5 className="font-medium text-blue-800 mb-2">Peak Days</h5>
                                  <div className="space-y-1">
                                    {seasonality.peakDays.map((day, index) => (
                                      <div key={index} className="flex justify-between text-sm">
                                        <span>{day.day}</span>
                                        <span className="font-semibold">{day.avgOccupancy.toFixed(1)}% occupancy</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                                <div className="p-3 bg-orange-50 rounded-lg">
                                  <h5 className="font-medium text-orange-800 mb-2">Low Days</h5>
                                  <div className="space-y-1">
                                    {seasonality.lowDays.map((day, index) => (
                                      <div key={index} className="flex justify-between text-sm">
                                        <span>{day.day}</span>
                                        <span className="font-semibold">{day.avgOccupancy.toFixed(1)}% occupancy</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </>
                            );
                          } catch (error) {
                            console.error('[ANALYTICS] Error calculating seasonality:', error);
                            return (
                              <div className="text-center py-4 text-gray-500">
                                <p>Error loading seasonality data</p>
                              </div>
                            );
                          }
                        })()}
                      </div>
                    </div>
                  </div>

                  {/* Forecasting */}
                  <div>
                    <h4 className="font-semibold text-lg mb-4">🔮 30-Day Forecast</h4>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                             {(() => {
                         try {
                           const trendAnalytics = analyticsStore.calculateTrendAnalytics();
                           if (!trendAnalytics || !trendAnalytics.forecast) {
                             return (
                               <div className="text-center py-4 text-gray-500">
                                 <p>Forecast data not available</p>
                               </div>
                             );
                           }
                           const forecast = trendAnalytics.forecast;
                           return (
                             <>
                               <div className="p-4 bg-green-50 rounded-lg">
                                 <h5 className="font-medium text-green-800 mb-3">Occupancy Forecast</h5>
                                 <div className="space-y-2">
                                   <div className="flex justify-between">
                                     <span>Confidence Level:</span>
                                     <span className="font-semibold">{(forecast.confidence.occupancy * 100).toFixed(1)}%</span>
                                   </div>
                                   <div className="flex justify-between">
                                     <span>Next 7 Days Avg:</span>
                                     <span className="font-semibold">
                                       {(forecast.forecast.slice(0, 7).reduce((sum, d) => sum + d.occupancy, 0) / 7).toFixed(1)}%
                                     </span>
                                   </div>
                                   <div className="flex justify-between">
                                     <span>Next 30 Days Avg:</span>
                                     <span className="font-semibold">
                                       {(forecast.forecast.reduce((sum, d) => sum + d.occupancy, 0) / forecast.forecast.length).toFixed(1)}%
                                     </span>
                                   </div>
                                 </div>
                               </div>

                               <div className="p-4 bg-purple-50 rounded-lg">
                                 <h5 className="font-medium text-purple-800 mb-3">Revenue Forecast</h5>
                                 <div className="space-y-2">
                                   <div className="flex justify-between">
                                     <span>Confidence Level:</span>
                                     <span className="font-semibold">{(forecast.confidence.revenue * 100).toFixed(1)}%</span>
                                   </div>
                                   <div className="flex justify-between">
                                     <span>Next 7 Days Avg:</span>
                                     <span className="font-semibold">
                                       {formatCurrency(forecast.forecast.slice(0, 7).reduce((sum, d) => sum + d.revenue, 0) / 7)}
                                     </span>
                                   </div>
                                   <div className="flex justify-between">
                                     <span>Next 30 Days Avg:</span>
                                     <span className="font-semibold">
                                       {formatCurrency(forecast.forecast.reduce((sum, d) => sum + d.revenue, 0) / forecast.forecast.length)}
                                     </span>
                                   </div>
                                 </div>
                               </div>
                             </>
                           );
                         } catch (error) {
                           console.error('[ANALYTICS] Error calculating forecast:', error);
                           return (
                             <div className="text-center py-4 text-gray-500">
                               <p>Error loading forecast data</p>
                             </div>
                           );
                         }
                       })()}
                    </div>
                  </div>
                </div>
              </CardBody>
            </Card>
          </div>
        </Tab>

        <Tab key="pricing" title="Pricing Analytics">
          <div className="space-y-6">
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <h3 className="text-xl font-semibold text-ghana-black">💰 Pricing Strategy & Revenue Impact</h3>
                <p className="text-gray-600">Analysis of discounts, complimentary rooms, and pricing strategies</p>
              </CardHeader>
              <CardBody>
                <div className="space-y-6">
                  {/* Discount Analytics */}
                  <div>
                    <h4 className="font-semibold text-lg mb-4">🎯 Discount Request Analysis</h4>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {(() => {
                        try {
                          const discountAnalytics = analyticsStore.calculateDiscountAnalytics();
                          return (
                            <>
                              <div className="p-4 bg-blue-50 rounded-lg">
                                <h5 className="font-medium text-blue-800 mb-3">Discount Overview</h5>
                                <div className="space-y-2">
                                  <div className="flex justify-between">
                                    <span>Total Requests:</span>
                                    <span className="font-semibold">{discountAnalytics.totalRequests}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span>Approval Rate:</span>
                                    <span className="font-semibold">{discountAnalytics.approvalRate.toFixed(1)}%</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span>Average Discount:</span>
                                    <span className="font-semibold">{discountAnalytics.averageDiscountPercentage.toFixed(1)}%</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span>Revenue Impact:</span>
                                    <span className="font-semibold text-red-600">
                                      {formatCurrency(Math.abs(discountAnalytics.totalRevenueImpact))}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <div className="p-4 bg-green-50 rounded-lg">
                                <h5 className="font-medium text-green-800 mb-3">Top Reasons</h5>
                                <div className="space-y-2">
                                  {discountAnalytics.topReasons.slice(0, 3).map((reason, index) => (
                                    <div key={index} className="flex justify-between text-sm">
                                      <span>{reason.reason}:</span>
                                      <span className="font-semibold">
                                        {reason.count} requests ({formatCurrency(reason.totalDiscount)})
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </>
                          );
                        } catch (error) {
                          console.error('[ANALYTICS] Error calculating discount analytics:', error);
                          return (
                            <div className="text-center py-4 text-gray-500">
                              <p>Error loading discount analytics</p>
                            </div>
                          );
                        }
                      })()}
                    </div>
                  </div>

                  {/* Complimentary Room Analytics */}
                  <div>
                    <h4 className="font-semibold text-lg mb-4">🏠 Complimentary Room Analysis</h4>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {(() => {
                        try {
                          const complimentaryAnalytics = analyticsStore.calculateComplimentaryRoomAnalytics();
                          return (
                            <>
                              <div className="p-4 bg-purple-50 rounded-lg">
                                <h5 className="font-medium text-purple-800 mb-3">Complimentary Overview</h5>
                                <div className="space-y-2">
                                  <div className="flex justify-between">
                                    <span>Total Rooms:</span>
                                    <span className="font-semibold">{complimentaryAnalytics.totalRooms}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span>Total Nights:</span>
                                    <span className="font-semibold">{complimentaryAnalytics.totalNights}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span>Average Rate:</span>
                                    <span className="font-semibold">{formatCurrency(complimentaryAnalytics.averageRate)}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span>Revenue Loss:</span>
                                    <span className="font-semibold text-red-600">
                                      {formatCurrency(complimentaryAnalytics.totalRevenueLoss)}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <div className="p-4 bg-orange-50 rounded-lg">
                                <h5 className="font-medium text-orange-800 mb-3">Top Reasons</h5>
                                <div className="space-y-2">
                                  {complimentaryAnalytics.reasons.slice(0, 3).map((reason, index) => (
                                    <div key={index} className="flex justify-between text-sm">
                                      <span>{reason.reason}:</span>
                                      <span className="font-semibold">
                                        {reason.count} rooms ({formatCurrency(reason.revenueLoss)})
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </>
                          );
                        } catch (error) {
                          console.error('[ANALYTICS] Error calculating complimentary room analytics:', error);
                          return (
                            <div className="text-center py-4 text-gray-500">
                              <p>Error loading complimentary room analytics</p>
                            </div>
                          );
                        }
                      })()}
                    </div>
                  </div>

                  {/* Pricing Strategy Recommendations */}
                  <div>
                    <h4 className="font-semibold text-lg mb-4">📊 Pricing Strategy Recommendations</h4>
                    <div className="p-4 bg-yellow-50 rounded-lg">
                      {(() => {
                        try {
                          const pricingStrategy = analyticsStore.calculatePricingStrategyAnalytics();
                          return (
                            <div className="space-y-4">
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                <div className="text-center">
                                  <div className="text-2xl font-bold text-blue-600">
                                    {pricingStrategy.pricingEfficiency.toFixed(1)}%
                                  </div>
                                  <div className="text-sm text-gray-600">Pricing Efficiency</div>
                                </div>
                                <div className="text-center">
                                  <div className="text-2xl font-bold text-green-600">
                                    {pricingStrategy.marketPositioning.rateCompetitiveness}
                                  </div>
                                  <div className="text-sm text-gray-600">Market Position</div>
                                </div>
                                <div className="text-center">
                                  <div className="text-2xl font-bold text-purple-600">
                                    {pricingStrategy.marketPositioning.pricingFlexibility}
                                  </div>
                                  <div className="text-sm text-gray-600">Pricing Flexibility</div>
                                </div>
                              </div>

                              <div>
                                <h6 className="font-medium text-gray-800 mb-2">Key Recommendations:</h6>
                                <div className="space-y-2">
                                  {pricingStrategy.recommendations.map((rec, index) => (
                                    <div key={index} className="flex items-start space-x-3 p-2 bg-white rounded">
                                      <Chip 
                                        color={rec.priority === 'Immediate' ? 'danger' : rec.priority === 'Short-term' ? 'warning' : 'success'} 
                                        variant="flat" 
                                        size="sm"
                                      >
                                        {rec.priority}
                                      </Chip>
                                      <div>
                                        <div className="font-medium">{rec.category}</div>
                                        <div className="text-sm text-gray-600">{rec.action}</div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          );
                        } catch (error) {
                          console.error('[ANALYTICS] Error calculating pricing strategy analytics:', error);
                          return (
                            <div className="text-center py-4 text-gray-500">
                              <p>Error loading pricing strategy analytics</p>
                            </div>
                          );
                        }
                      })()}
                    </div>
                  </div>
                </div>
              </CardBody>
            </Card>
          </div>
        </Tab>

        <Tab key="insights" title="AI Insights">
          <div className="space-y-6">
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <h3 className="text-xl font-semibold text-ghana-black">🤖 AI-Powered Insights & Recommendations</h3>
                <p className="text-gray-600">Intelligent analysis of your hotel performance with actionable recommendations</p>
              </CardHeader>
              <CardBody>
                <div className="space-y-4">
                  {analyticsStore.insights.map((insight) => (
                    <div key={insight.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h4 className="font-semibold text-lg">{insight.title}</h4>
                          <p className="text-gray-600">{insight.description}</p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Chip 
                            color={insight.type === 'positive' ? 'success' : insight.type === 'warning' ? 'warning' : insight.type === 'negative' ? 'danger' : 'default'} 
                            variant="flat" 
                            size="sm"
                          >
                            {insight.type.toUpperCase()}
                          </Chip>
                          <Chip 
                            color={insight.impact === 'high' ? 'danger' : insight.impact === 'medium' ? 'warning' : 'success'} 
                            variant="flat" 
                            size="sm"
                          >
                            {insight.impact.toUpperCase()} IMPACT
                          </Chip>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                        <div>
                          <h5 className="font-medium text-sm text-gray-700 mb-2">Key Data Points:</h5>
                          <div className="space-y-1">
                            {insight.dataPoints.map((point, index) => (
                              <div key={index} className="flex justify-between text-sm">
                                <span>{point.label}:</span>
                                <span className="font-semibold">{point.value}{point.unit}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div>
                          <h5 className="font-medium text-sm text-gray-700 mb-2">Recommendations:</h5>
                          <ul className="text-sm space-y-1">
                            {insight.recommendations.map((rec, index) => (
                              <li key={index} className="flex items-start">
                                <span className="text-green-500 mr-2">•</span>
                                <span>{rec}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                      
                      <div className="flex justify-between items-center text-xs text-gray-500">
                        <span>Category: {insight.category}</span>
                        <span>Generated: {new Date().toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))}
                  
                  {analyticsStore.insights.length === 0 && (
                    <div className="text-center py-8">
                      <p className="text-gray-500">No insights available. Click "Refresh" to generate new insights.</p>
                    </div>
                  )}
                </div>
              </CardBody>
            </Card>
          </div>
        </Tab>
      </Tabs>
    </div>
  );
}
