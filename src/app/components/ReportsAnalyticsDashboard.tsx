'use client';

import React, { useState } from 'react';
import { 
  Card, CardBody, CardHeader, Button, Badge, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, 
  Tabs, Tab, Chip, Progress, Select, SelectItem
} from '@heroui/react';
import { useSettingsStore } from '../lib/settings/store';

interface KPIMetric {
  id: string;
  name: string;
  value: number;
  target: number;
  unit: string;
  trend: 'up' | 'down' | 'stable';
  percentageChange: number;
  category: 'financial' | 'operational' | 'guest-satisfaction' | 'staff-productivity';
}

interface FinancialMetric {
  id: string;
  period: string;
  revenue: number;
  expenses: number;
  profit: number;
  profitMargin: number;
  occupancyRate: number;
  averageDailyRate: number;
  revPAR: number; // Revenue Per Available Room
  ghanaTaxes: {
    vat: number;
    nhil: number;
    tourismLevy: number;
    corporateTax: number;
  };
}

interface GuestSatisfaction {
  id: string;
  category: 'overall' | 'cleanliness' | 'service' | 'facilities' | 'value';
  score: number;
  totalReviews: number;
  positiveReviews: number;
  negativeReviews: number;
  trend: 'up' | 'down' | 'stable';
  ghanaSpecific: {
    localCuisineRating: number;
    culturalExperienceRating: number;
    languageSupportRating: number;
  };
}

interface MarketInsight {
  id: string;
  category: 'seasonal' | 'competitive' | 'economic' | 'cultural';
  title: string;
  description: string;
  impact: 'positive' | 'negative' | 'neutral';
  confidence: number;
  dataSource: string;
  lastUpdated: string;
  recommendations: string[];
}

interface OperationalReport {
  id: string;
  type: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  period: string;
  generatedAt: string;
  generatedBy: string;
  status: 'draft' | 'final' | 'archived';
  sections: string[];
  totalPages: number;
  recipients: string[];
}

export default function ReportsAnalyticsDashboard() {
  const [selectedTab, setSelectedTab] = useState('overview');
  const [selectedPeriod, setSelectedPeriod] = useState('current-month');
  const [selectedReport, setSelectedReport] = useState('financial');
  
  const settings = useSettingsStore();

  // Sample data
  const kpiMetrics: KPIMetric[] = [
    {
      id: '1',
      name: 'Revenue Growth',
      value: 1250000,
      target: 1200000,
      unit: 'GHS',
      trend: 'up',
      percentageChange: 4.2,
      category: 'financial'
    },
    {
      id: '2',
      name: 'Occupancy Rate',
      value: 78.5,
      target: 80,
      unit: '%',
      trend: 'up',
      percentageChange: 2.1,
      category: 'operational'
    },
    {
      id: '3',
      name: 'Guest Satisfaction',
      value: 4.6,
      target: 4.5,
      unit: '/5',
      trend: 'up',
      percentageChange: 2.2,
      category: 'guest-satisfaction'
    },
    {
      id: '4',
      name: 'Staff Productivity',
      value: 85.2,
      target: 82,
      unit: '%',
      trend: 'up',
      percentageChange: 3.9,
      category: 'staff-productivity'
    }
  ];

  const financialMetrics: FinancialMetric[] = [
    {
      id: '1',
      period: 'January 2024',
      revenue: 1250000,
      expenses: 875000,
      profit: 375000,
      profitMargin: 30.0,
      occupancyRate: 78.5,
      averageDailyRate: 450,
      revPAR: 353.25,
      ghanaTaxes: {
        vat: 156250,
        nhil: 31250,
        tourismLevy: 18750,
        corporateTax: 93750
      }
    },
    {
      id: '2',
      period: 'December 2023',
      revenue: 1180000,
      expenses: 826000,
      profit: 354000,
      profitMargin: 30.0,
      occupancyRate: 75.2,
      averageDailyRate: 435,
      revPAR: 327.12,
      ghanaTaxes: {
        vat: 147500,
        nhil: 29500,
        tourismLevy: 17700,
        corporateTax: 88500
      }
    }
  ];

  const guestSatisfaction: GuestSatisfaction[] = [
    {
      id: '1',
      category: 'overall',
      score: 4.6,
      totalReviews: 1250,
      positiveReviews: 1150,
      negativeReviews: 100,
      trend: 'up',
      ghanaSpecific: {
        localCuisineRating: 4.7,
        culturalExperienceRating: 4.8,
        languageSupportRating: 4.5
      }
    },
    {
      id: '2',
      category: 'cleanliness',
      score: 4.7,
      totalReviews: 1250,
      positiveReviews: 1180,
      negativeReviews: 70,
      trend: 'up',
      ghanaSpecific: {
        localCuisineRating: 4.7,
        culturalExperienceRating: 4.8,
        languageSupportRating: 4.5
      }
    }
  ];

  const marketInsights: MarketInsight[] = [
    {
      id: '1',
      category: 'seasonal',
      title: 'Peak Tourist Season (Dec-Mar)',
      description: 'Ghana experiences peak tourism during dry season with festivals and cultural events',
      impact: 'positive',
      confidence: 85,
      dataSource: 'Ghana Tourism Authority',
      lastUpdated: '2024-01-15',
      recommendations: [
        'Increase room rates by 15-20%',
        'Prepare for higher occupancy',
        'Stock up on local cultural items'
      ]
    },
    {
      id: '2',
      category: 'competitive',
      title: 'New Luxury Hotel Opening',
      description: 'Competitor opening 5-star property in Accra business district',
      impact: 'negative',
      confidence: 75,
      dataSource: 'Market Intelligence',
      lastUpdated: '2024-01-10',
      recommendations: [
        'Enhance unique selling propositions',
        'Focus on local cultural experiences',
        'Improve service quality'
      ]
    }
  ];

  const operationalReports: OperationalReport[] = [
    {
      id: '1',
      type: 'monthly',
      period: 'January 2024',
      generatedAt: '2024-01-31T23:59:59Z',
      generatedBy: 'System Auto-Generation',
      status: 'final',
      sections: ['Financial Summary', 'Operational Metrics', 'Guest Satisfaction', 'Staff Performance'],
      totalPages: 25,
      recipients: ['General Manager', 'Department Heads', 'Board Members']
    },
    {
      id: '2',
      type: 'weekly',
      period: 'Week 4, January 2024',
      generatedAt: '2024-01-28T23:59:59Z',
      generatedBy: 'Operations Manager',
      status: 'final',
      sections: ['Weekly Summary', 'Key Metrics', 'Issues & Actions'],
      totalPages: 8,
      recipients: ['Department Heads', 'Supervisors']
    }
  ];

  const renderOverview = () => (
    <div className="space-y-6">
      {/* KPI Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {kpiMetrics.map((metric) => (
          <Card key={metric.id} className="border-0 shadow-lg">
            <CardBody className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="text-sm font-medium text-gray-600">{metric.category}</div>
                <div className={`text-lg ${metric.trend === 'up' ? 'text-green-500' : metric.trend === 'down' ? 'text-red-500' : 'text-gray-500'}`}>
                  {metric.trend === 'up' ? '↗' : metric.trend === 'down' ? '↘' : '→'}
                </div>
              </div>
              <div className="mb-2">
                <p className="text-2xl font-bold text-ghana-black">
                  {metric.unit === 'GHS' ? `₵${metric.value.toLocaleString()}` : 
                   metric.unit === '%' ? `${metric.value}%` : 
                   metric.unit === '/5' ? `${metric.value}/5` : metric.value}
                </p>
                <p className="text-sm text-gray-600">{metric.name}</p>
              </div>
              <div className="flex items-center justify-between">
                <div className="text-sm">
                  <span className={`font-medium ${metric.trend === 'up' ? 'text-green-600' : metric.trend === 'down' ? 'text-red-600' : 'text-gray-600'}`}>
                    {metric.percentageChange > 0 ? '+' : ''}{metric.percentageChange}%
                  </span>
                  <span className="text-gray-500"> vs target</span>
                </div>
                <div className="text-xs text-gray-500">
                  Target: {metric.unit === 'GHS' ? `₵${metric.target.toLocaleString()}` : 
                          metric.unit === '%' ? `${metric.target}%` : 
                          metric.unit === '/5' ? `${metric.target}/5` : metric.target}
                </div>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      {/* Financial Performance */}
      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-3">
          <h3 className="text-xl font-semibold text-ghana-black">💰 Financial Performance</h3>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Revenue vs Expenses */}
            <div>
              <h4 className="text-lg font-semibold mb-4">Revenue vs Expenses</h4>
              <div className="space-y-3">
                {financialMetrics.slice(0, 2).map((metric) => (
                  <div key={metric.id} className="p-4 bg-gray-50 rounded-lg">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium">{metric.period}</span>
                      <span className="text-sm text-gray-500">₵{metric.revenue.toLocaleString()}</span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Revenue:</span>
                        <span className="font-medium text-green-600">₵{metric.revenue.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Expenses:</span>
                        <span className="font-medium text-red-600">₵{metric.expenses.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Profit:</span>
                        <span className="font-medium text-ghana-green">₵{metric.profit.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Margin:</span>
                        <span className="font-medium text-ghana-green">{metric.profitMargin}%</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Ghana Tax Breakdown */}
            <div>
              <h4 className="text-lg font-semibold mb-4">🇬🇭 Ghana Tax Breakdown</h4>
              <div className="space-y-3">
                {financialMetrics.slice(0, 1).map((metric) => (
                  <div key={metric.id} className="p-4 bg-gray-50 rounded-lg">
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>VAT:</span>
                        <span className="font-medium">₵{metric.ghanaTaxes.vat.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>NHIL (2.5%):</span>
                        <span className="font-medium">₵{metric.ghanaTaxes.nhil.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Tourism Levy (1%):</span>
                        <span className="font-medium">₵{metric.ghanaTaxes.tourismLevy.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Corporate Tax (25%):</span>
                        <span className="font-medium">₵{metric.ghanaTaxes.corporateTax.toLocaleString()}</span>
                      </div>
                      <div className="pt-2 border-t border-gray-200">
                        <div className="flex justify-between text-sm font-medium">
                          <span>Total Taxes:</span>
                          <span>₵{(metric.ghanaTaxes.vat + metric.ghanaTaxes.nhil + metric.ghanaTaxes.tourismLevy + metric.ghanaTaxes.corporateTax).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Market Insights */}
      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-3">
          <h3 className="text-xl font-semibold text-ghana-black">📊 Ghana Market Insights</h3>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {marketInsights.map((insight) => (
              <div key={insight.id} className="p-4 border rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <Chip 
                    color={
                      insight.category === 'seasonal' ? 'success' :
                      insight.category === 'competitive' ? 'warning' :
                      insight.category === 'economic' ? 'primary' :
                      'default'
                    } 
                    size="sm" 
                    variant="flat"
                  >
                    {insight.category}
                  </Chip>
                  <Badge 
                    color={
                      insight.impact === 'positive' ? 'success' :
                      insight.impact === 'negative' ? 'danger' :
                      'default'
                    } 
                    size="sm"
                  >
                    {insight.impact}
                  </Badge>
                </div>
                <h4 className="font-semibold mb-2">{insight.title}</h4>
                <p className="text-sm text-gray-600 mb-3">{insight.description}</p>
                <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
                  <span>Confidence: {insight.confidence}%</span>
                  <span>Updated: {new Date(insight.lastUpdated).toLocaleDateString()}</span>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-gray-700">Recommendations:</p>
                  {insight.recommendations.map((rec, index) => (
                    <div key={index} className="text-xs text-gray-600">• {rec}</div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>
    </div>
  );

  const renderFinancialAnalytics = () => (
    <div className="space-y-6">
      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-3">
          <h3 className="text-xl font-semibold text-ghana-black">📈 Financial Analytics</h3>
        </CardHeader>
        <CardBody>
          <Table aria-label="Financial metrics table">
            <TableHeader>
              <TableColumn>Period</TableColumn>
              <TableColumn>Revenue</TableColumn>
              <TableColumn>Expenses</TableColumn>
              <TableColumn>Profit</TableColumn>
              <TableColumn>Margin</TableColumn>
              <TableColumn>Occupancy</TableColumn>
              <TableColumn>ADR</TableColumn>
              <TableColumn>RevPAR</TableColumn>
            </TableHeader>
            <TableBody>
              {financialMetrics.map((metric) => (
                <TableRow key={metric.id}>
                  <TableCell className="font-semibold">{metric.period}</TableCell>
                  <TableCell className="text-green-600 font-semibold">₵{metric.revenue.toLocaleString()}</TableCell>
                  <TableCell className="text-red-600">₵{metric.expenses.toLocaleString()}</TableCell>
                  <TableCell className="text-ghana-green font-semibold">₵{metric.profit.toLocaleString()}</TableCell>
                  <TableCell>
                    <Badge color="success" size="sm">
                      {metric.profitMargin}%
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <span>{metric.occupancyRate}%</span>
                      <Progress 
                        value={metric.occupancyRate} 
                        size="sm"
                        className="w-16"
                        color={metric.occupancyRate >= 80 ? 'success' : metric.occupancyRate >= 60 ? 'warning' : 'danger'}
                      />
                    </div>
                  </TableCell>
                  <TableCell>₵{metric.averageDailyRate}</TableCell>
                  <TableCell className="font-semibold">₵{metric.revPAR}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardBody>
      </Card>
    </div>
  );

  const renderOperationalReports = () => (
    <div className="space-y-6">
      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-3">
          <h3 className="text-xl font-semibold text-ghana-black">📋 Operational Reports</h3>
        </CardHeader>
        <CardBody>
          <Table aria-label="Operational reports table">
            <TableHeader>
              <TableColumn>Report Type</TableColumn>
              <TableColumn>Period</TableColumn>
              <TableColumn>Generated</TableColumn>
              <TableColumn>Generated By</TableColumn>
              <TableColumn>Status</TableColumn>
              <TableColumn>Sections</TableColumn>
              <TableColumn>Actions</TableColumn>
            </TableHeader>
            <TableBody>
              {operationalReports.map((report) => (
                <TableRow key={report.id}>
                  <TableCell>
                    <Chip 
                      color={
                        report.type === 'monthly' ? 'primary' :
                        report.type === 'weekly' ? 'secondary' :
                        report.type === 'daily' ? 'success' :
                        'default'
                      } 
                      size="sm" 
                      variant="flat"
                    >
                      {report.type}
                    </Chip>
                  </TableCell>
                  <TableCell className="font-semibold">{report.period}</TableCell>
                  <TableCell>{new Date(report.generatedAt).toLocaleDateString()}</TableCell>
                  <TableCell>{report.generatedBy}</TableCell>
                  <TableCell>
                    <Badge 
                      color={
                        report.status === 'final' ? 'success' :
                        report.status === 'draft' ? 'warning' :
                        'default'
                      } 
                      size="sm"
                    >
                      {report.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm text-gray-600">
                      {report.sections.length} sections • {report.totalPages} pages
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button size="sm" variant="flat" color="primary">
                        View
                      </Button>
                      <Button size="sm" variant="flat" color="secondary">
                        Download
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardBody>
      </Card>
    </div>
  );

  const renderGhanaMarketInsights = () => (
    <div className="space-y-6">
      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-3">
          <h3 className="text-xl font-semibold text-ghana-black">🇬🇭 Ghana Market Insights</h3>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Seasonal Trends */}
            <div className="p-4 border rounded-lg">
              <h4 className="text-lg font-semibold mb-4">🌤️ Seasonal Trends</h4>
              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                  <div>
                    <div className="font-medium">Peak Season (Dec-Mar)</div>
                    <div className="text-sm text-gray-600">Dry season, festivals, cultural events</div>
                  </div>
                  <Badge color="success" size="sm">+25% Revenue</Badge>
                </div>
                <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                  <div>
                    <div className="font-medium">Shoulder Season (Apr-Jun)</div>
                    <div className="text-sm text-gray-600">Moderate weather, business travel</div>
                  </div>
                  <Badge color="primary" size="sm">+10% Revenue</Badge>
                </div>
                <div className="flex justify-between items-center p-3 bg-orange-50 rounded-lg">
                  <div>
                    <div className="font-medium">Low Season (Jul-Nov)</div>
                    <div className="text-sm text-gray-600">Rainy season, fewer tourists</div>
                  </div>
                  <Badge color="warning" size="sm">-15% Revenue</Badge>
                </div>
              </div>
            </div>

            {/* Cultural Events Impact */}
            <div className="p-4 border rounded-lg">
              <h4 className="text-lg font-semibold mb-4">🎭 Cultural Events Impact</h4>
              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 bg-purple-50 rounded-lg">
                  <div>
                    <div className="font-medium">Ghana Independence Day</div>
                    <div className="text-sm text-gray-600">March 6th - National celebration</div>
                  </div>
                  <Badge color="secondary" size="sm">+30% Occupancy</Badge>
                </div>
                <div className="flex justify-between items-center p-3 bg-yellow-50 rounded-lg">
                  <div>
                    <div className="font-medium">Homowo Festival</div>
                    <div className="text-sm text-gray-600">August - Ga people celebration</div>
                  </div>
                  <Badge color="warning" size="sm">+20% Occupancy</Badge>
                </div>
                <div className="flex justify-between items-center p-3 bg-red-50 rounded-lg">
                  <div>
                    <div className="font-medium">Christmas & New Year</div>
                    <div className="text-sm text-gray-600">December - Family gatherings</div>
                  </div>
                  <Badge color="danger" size="sm">+40% Occupancy</Badge>
                </div>
              </div>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-ghana-black">📊 Reports & Analytics Dashboard</h1>
          <p className="text-gray-600">Business intelligence with Ghana market insights and performance analytics</p>
        </div>
        <div className="flex items-center space-x-2">
          <Badge color="success">System Online</Badge>
          <Badge color="primary">SaaS Ready</Badge>
        </div>
      </div>

      {/* Period Selector */}
      <div className="mb-6 flex items-center space-x-4">
        <Select
          label="Report Period"
          selectedKeys={[selectedPeriod]}
          onSelectionChange={(keys) => setSelectedPeriod(Array.from(keys)[0] as string)}
          className="w-48"
        >
          <SelectItem key="current-month">Current Month</SelectItem>
          <SelectItem key="last-month">Last Month</SelectItem>
          <SelectItem key="current-quarter">Current Quarter</SelectItem>
          <SelectItem key="last-quarter">Last Quarter</SelectItem>
          <SelectItem key="current-year">Current Year</SelectItem>
          <SelectItem key="custom">Custom Range</SelectItem>
        </Select>
        
        <Select
          label="Report Type"
          selectedKeys={[selectedReport]}
          onSelectionChange={(keys) => setSelectedReport(Array.from(keys)[0] as string)}
          className="w-48"
        >
          <SelectItem key="financial">Financial Reports</SelectItem>
          <SelectItem key="operational">Operational Reports</SelectItem>
          <SelectItem key="guest-satisfaction">Guest Satisfaction</SelectItem>
          <SelectItem key="staff-performance">Staff Performance</SelectItem>
        </Select>
      </div>

      <Tabs 
        selectedKey={selectedTab} 
        onSelectionChange={(key) => setSelectedTab(key as string)}
        className="w-full"
      >
        <Tab key="overview" title="Overview" />
        <Tab key="financial" title="Financial Analytics" />
        <Tab key="operational" title="Operational Reports" />
        <Tab key="ghana-insights" title="Ghana Market Insights" />
      </Tabs>

      <div className="mt-6">
        {selectedTab === 'overview' && renderOverview()}
        {selectedTab === 'financial' && renderFinancialAnalytics()}
        {selectedTab === 'operational' && renderOperationalReports()}
        {selectedTab === 'ghana-insights' && renderGhanaMarketInsights()}
      </div>
    </div>
  );
}


