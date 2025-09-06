'use client';

import React, { useState, useMemo } from 'react';
import { 
  Card, CardBody, Button, Input, Select, SelectItem, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, 
  Badge, Chip, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, useDisclosure, Textarea, Pagination,
  Dropdown, DropdownTrigger, DropdownMenu, DropdownItem, Progress, Divider
} from '@heroui/react';
// Icons removed - not available in @heroui/react

interface RevenueData {
  id: string;
  date: string;
  roomRevenue: number;
  foodRevenue: number;
  serviceRevenue: number;
  totalRevenue: number;
  occupancyRate: number;
  averageRoomRate: number;
  guestCount: number;
  category: 'daily' | 'weekly' | 'monthly';
}

interface RevenueTrend {
  period: string;
  revenue: number;
  change: number;
  changePercent: number;
  trend: 'up' | 'down' | 'stable';
}

interface TopRevenueSource {
  source: string;
  revenue: number;
  percentage: number;
  growth: number;
}

export default function RevenueAnalyticsPage() {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const { isOpen: isReportOpen, onOpen: onReportOpen, onClose: onReportClose } = useDisclosure();
  const [selectedPeriod, setSelectedPeriod] = useState('month');
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  
  // Report generation state
  const [reportConfig, setReportConfig] = useState({
    reportType: 'revenue',
    dateRange: 'month',
    includeCharts: true,
    includeDetails: true,
    format: 'pdf'
  });

  const itemsPerPage = 10;

  // Mock data
  const revenueData: RevenueData[] = [
    {
      id: '1',
      date: '2024-01-01',
      roomRevenue: 2500.00,
      foodRevenue: 800.00,
      serviceRevenue: 300.00,
      totalRevenue: 3600.00,
      occupancyRate: 85,
      averageRoomRate: 150.00,
      guestCount: 45,
      category: 'daily'
    },
    {
      id: '2',
      date: '2024-01-02',
      roomRevenue: 2800.00,
      foodRevenue: 950.00,
      serviceRevenue: 350.00,
      totalRevenue: 4100.00,
      occupancyRate: 92,
      averageRoomRate: 155.00,
      guestCount: 52,
      category: 'daily'
    },
    {
      id: '3',
      date: '2024-01-03',
      roomRevenue: 2200.00,
      foodRevenue: 700.00,
      serviceRevenue: 250.00,
      totalRevenue: 3150.00,
      occupancyRate: 78,
      averageRoomRate: 145.00,
      guestCount: 38,
      category: 'daily'
    }
  ];

  const revenueTrends: RevenueTrend[] = [
    {
      period: 'This Week',
      revenue: 28500.00,
      change: 2500.00,
      changePercent: 9.6,
      trend: 'up'
    },
    {
      period: 'This Month',
      revenue: 125000.00,
      change: -5000.00,
      changePercent: -3.8,
      trend: 'down'
    },
    {
      period: 'This Quarter',
      revenue: 380000.00,
      change: 15000.00,
      changePercent: 4.1,
      trend: 'up'
    },
    {
      period: 'This Year',
      revenue: 1450000.00,
      change: 125000.00,
      changePercent: 9.4,
      trend: 'up'
    }
  ];

  const topRevenueSources: TopRevenueSource[] = [
    {
      source: 'Room Revenue',
      revenue: 85000.00,
      percentage: 68,
      growth: 12.5
    },
    {
      source: 'Food & Beverage',
      revenue: 25000.00,
      percentage: 20,
      growth: 8.2
    },
    {
      source: 'Services',
      revenue: 15000.00,
      percentage: 12,
      growth: 15.8
    }
  ];

  // Filter and sort data
  const filteredData = useMemo(() => {
    let data = revenueData;
    
    // Search filter
    if (searchTerm) {
      data = data.filter(item => 
        item.date.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Category filter
    if (categoryFilter !== 'all') {
      data = data.filter(item => item.category === categoryFilter);
    }

    // Sort
    data.sort((a, b) => {
      let aValue: any, bValue: any;
      
      switch (sortBy) {
        case 'date':
          aValue = new Date(a.date);
          bValue = new Date(b.date);
          break;
        case 'totalRevenue':
          aValue = a.totalRevenue;
          bValue = b.totalRevenue;
          break;
        case 'occupancyRate':
          aValue = a.occupancyRate;
          bValue = b.occupancyRate;
          break;
        case 'guestCount':
          aValue = a.guestCount;
          bValue = b.guestCount;
          break;
        default:
          aValue = new Date(a.date);
          bValue = new Date(b.date);
      }

      if (aValue instanceof Date) {
        return sortOrder === 'asc' 
          ? aValue.getTime() - bValue.getTime()
          : bValue.getTime() - aValue.getTime();
      } else {
        return sortOrder === 'asc' 
          ? aValue - bValue
          : bValue - aValue;
      }
    });

    return data;
  }, [searchTerm, categoryFilter, sortBy, sortOrder, revenueData]);

  // Pagination
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const paginatedData = filteredData.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Stats
  const stats = useMemo(() => {
    const totalRevenue = revenueData.reduce((sum, item) => sum + item.totalRevenue, 0);
    const avgRevenue = totalRevenue / revenueData.length;
    const avgOccupancy = revenueData.reduce((sum, item) => sum + item.occupancyRate, 0) / revenueData.length;
    const totalGuests = revenueData.reduce((sum, item) => sum + item.guestCount, 0);

    return {
      totalRevenue,
      avgRevenue,
      avgOccupancy,
      totalGuests
    };
  }, [revenueData]);

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up':
        return <span className="text-green-500">↗</span>;
      case 'down':
        return <span className="text-red-500">↘</span>;
      default:
        return <span className="text-gray-500">→</span>;
    }
  };

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'up':
        return 'success';
      case 'down':
        return 'danger';
      default:
        return 'default';
    }
  };

  const handleExport = () => {
    setIsLoading(true);
    // Simulate export process
    setTimeout(() => {
      console.log('Exporting revenue data...');
      setIsLoading(false);
    }, 2000);
  };

  const handleGenerateReport = () => {
    console.log('Generating revenue report...');
  };

  return (
    <div className="w-full max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">📈 Revenue Analytics</h1>
          <p className="text-gray-600">Financial reporting and analysis</p>
        </div>
        <div className="flex gap-2">
          <Button 
            color="primary" 
            variant="flat"
            startContent="📥"
            onPress={handleExport}
            isLoading={isLoading}
          >
            Export
          </Button>
          <Button color="primary" onPress={onReportOpen}>
            Generate Report
          </Button>
        </div>
      </div>

      {/* Period Selector */}
      <div className="flex gap-4">
        <Button
          variant={selectedPeriod === 'week' ? 'solid' : 'light'}
          color="primary"
          onPress={() => setSelectedPeriod('week')}
        >
          This Week
        </Button>
        <Button
          variant={selectedPeriod === 'month' ? 'solid' : 'light'}
          color="primary"
          onPress={() => setSelectedPeriod('month')}
        >
          This Month
        </Button>
        <Button
          variant={selectedPeriod === 'quarter' ? 'solid' : 'light'}
          color="primary"
          onPress={() => setSelectedPeriod('quarter')}
        >
          This Quarter
        </Button>
        <Button
          variant={selectedPeriod === 'year' ? 'solid' : 'light'}
          color="primary"
          onPress={() => setSelectedPeriod('year')}
        >
          This Year
        </Button>
      </div>

      {/* Revenue Trends */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {revenueTrends.map((trend) => (
          <Card key={trend.period}>
            <CardBody>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">{trend.period}</p>
                  <p className="text-2xl font-bold">₵{trend.revenue.toLocaleString()}</p>
                  <div className="flex items-center gap-1 mt-1">
                    {getTrendIcon(trend.trend)}
                    <span className={`text-sm ${trend.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {trend.change >= 0 ? '+' : ''}{trend.changePercent}%
                    </span>
                  </div>
                </div>
                <Badge color={getTrendColor(trend.trend)} variant="flat">
                  {trend.trend}
                </Badge>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardBody className="text-center">
            <p className="text-2xl font-bold text-blue-600">₵{stats.totalRevenue.toLocaleString()}</p>
            <p className="text-sm text-gray-600">Total Revenue</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="text-center">
            <p className="text-2xl font-bold text-green-600">₵{stats.avgRevenue.toFixed(2)}</p>
            <p className="text-sm text-gray-600">Average Daily Revenue</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="text-center">
            <p className="text-2xl font-bold text-purple-600">{stats.avgOccupancy.toFixed(1)}%</p>
            <p className="text-sm text-gray-600">Average Occupancy</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="text-center">
            <p className="text-2xl font-bold text-orange-600">{stats.totalGuests}</p>
            <p className="text-sm text-gray-600">Total Guests</p>
          </CardBody>
        </Card>
      </div>

      {/* Revenue Sources */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardBody>
            <h3 className="text-lg font-semibold mb-4">Revenue Sources</h3>
            <div className="space-y-4">
              {topRevenueSources.map((source) => (
                <div key={source.source}>
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-medium">{source.source}</span>
                    <span className="text-sm text-gray-600">₵{source.revenue.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Progress 
                      value={source.percentage} 
                      className="flex-1"
                      color="primary"
                    />
                    <span className="text-sm text-gray-600">{source.percentage}%</span>
                  </div>
                  <div className="flex items-center gap-1 mt-1">
                    <span className="text-green-500">↗</span>
                    <span className="text-sm text-green-600">+{source.growth}%</span>
                  </div>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <h3 className="text-lg font-semibold mb-4">Revenue Breakdown</h3>
            <div className="space-y-4">
              <div className="flex justify-between">
                <span>Room Revenue</span>
                <span className="font-medium">₵{topRevenueSources[0].revenue.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Food & Beverage</span>
                <span className="font-medium">₵{topRevenueSources[1].revenue.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Services</span>
                <span className="font-medium">₵{topRevenueSources[2].revenue.toLocaleString()}</span>
              </div>
              <Divider />
              <div className="flex justify-between font-bold">
                <span>Total</span>
                <span>₵{(topRevenueSources[0].revenue + topRevenueSources[1].revenue + topRevenueSources[2].revenue).toLocaleString()}</span>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Revenue Data Table */}
      <Card>
        <CardBody>
          <h3 className="text-lg font-semibold mb-4">Revenue Data</h3>

          {/* Filters and Search */}
          <div className="flex flex-col md:flex-row gap-4 mb-4">
            <Input
              placeholder="Search by date..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              startContent="🔍"
              className="md:w-64"
            />
            <Select
              placeholder="Category"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="md:w-32"
            >
              <SelectItem key="all">All</SelectItem>
              <SelectItem key="daily">Daily</SelectItem>
              <SelectItem key="weekly">Weekly</SelectItem>
              <SelectItem key="monthly">Monthly</SelectItem>
            </Select>
            <Dropdown>
              <DropdownTrigger>
                <Button variant="flat" startContent="🔄">
                  Sort
                </Button>
              </DropdownTrigger>
              <DropdownMenu
                selectedKeys={[sortBy]}
                onSelectionChange={(keys) => setSortBy(Array.from(keys)[0] as string)}
              >
                <DropdownItem key="date">Date</DropdownItem>
                <DropdownItem key="totalRevenue">Total Revenue</DropdownItem>
                <DropdownItem key="occupancyRate">Occupancy Rate</DropdownItem>
                <DropdownItem key="guestCount">Guest Count</DropdownItem>
              </DropdownMenu>
            </Dropdown>
            <Button
              variant="light"
              onPress={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            >
              {sortOrder === 'asc' ? '↑' : '↓'}
            </Button>
          </div>

          {/* Table */}
          <Table aria-label="Revenue data table">
            <TableHeader>
              <TableColumn>DATE</TableColumn>
              <TableColumn>ROOM REVENUE</TableColumn>
              <TableColumn>FOOD REVENUE</TableColumn>
              <TableColumn>SERVICE REVENUE</TableColumn>
              <TableColumn>TOTAL REVENUE</TableColumn>
              <TableColumn>OCCUPANCY</TableColumn>
              <TableColumn>GUESTS</TableColumn>
            </TableHeader>
            <TableBody>
              {paginatedData.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <span className="font-medium">{item.date}</span>
                  </TableCell>
                  <TableCell>
                    <span className="font-medium">₵{item.roomRevenue.toFixed(2)}</span>
                  </TableCell>
                  <TableCell>
                    <span className="font-medium">₵{item.foodRevenue.toFixed(2)}</span>
                  </TableCell>
                  <TableCell>
                    <span className="font-medium">₵{item.serviceRevenue.toFixed(2)}</span>
                  </TableCell>
                  <TableCell>
                    <span className="font-bold text-green-600">₵{item.totalRevenue.toFixed(2)}</span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Progress 
                        value={item.occupancyRate} 
                        className="w-16"
                        color="primary"
                        size="sm"
                      />
                      <span className="text-sm">{item.occupancyRate}%</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="font-medium">{item.guestCount}</span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center mt-4">
              <Pagination
                total={totalPages}
                page={currentPage}
                onChange={setCurrentPage}
                showControls
              />
            </div>
          )}
        </CardBody>
      </Card>

      {/* Revenue Forecast */}
      <Card>
        <CardBody>
          <h3 className="text-lg font-semibold mb-4">Revenue Forecast</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600">₵450,000</p>
              <p className="text-sm text-gray-600">Next Month</p>
              <div className="flex items-center justify-center gap-1 mt-1">
                <span className="text-green-500">↗</span>
                <span className="text-sm text-green-600">+8.5%</span>
              </div>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">₵1,350,000</p>
              <p className="text-sm text-gray-600">Next Quarter</p>
              <div className="flex items-center justify-center gap-1 mt-1">
                <span className="text-green-500">↗</span>
                <span className="text-sm text-green-600">+12.2%</span>
              </div>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-purple-600">₵5,200,000</p>
              <p className="text-sm text-gray-600">Next Year</p>
              <div className="flex items-center justify-center gap-1 mt-1">
                <span className="text-green-500">↗</span>
                <span className="text-sm text-green-600">+15.8%</span>
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Generate Report Modal */}
      <Modal isOpen={isReportOpen} onClose={onReportClose} size="2xl">
        <ModalContent>
          <ModalHeader>
            Generate Revenue Report
          </ModalHeader>
          <ModalBody>
            <div className="space-y-6">
              {/* Report Type */}
              <div>
                <h4 className="font-semibold mb-3">Report Type</h4>
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    variant={reportConfig.reportType === 'revenue' ? 'solid' : 'light'}
                    color="primary"
                    onPress={() => setReportConfig({...reportConfig, reportType: 'revenue'})}
                  >
                    Revenue Summary
                  </Button>
                  <Button
                    variant={reportConfig.reportType === 'detailed' ? 'solid' : 'light'}
                    color="primary"
                    onPress={() => setReportConfig({...reportConfig, reportType: 'detailed'})}
                  >
                    Detailed Analysis
                  </Button>
                </div>
              </div>

              {/* Date Range */}
              <div>
                <h4 className="font-semibold mb-3">Date Range</h4>
                <Select
                  placeholder="Select date range"
                  value={reportConfig.dateRange}
                  onChange={(e) => setReportConfig({...reportConfig, dateRange: e.target.value})}
                >
                  <SelectItem key="week">This Week</SelectItem>
                  <SelectItem key="month">This Month</SelectItem>
                  <SelectItem key="quarter">This Quarter</SelectItem>
                  <SelectItem key="year">This Year</SelectItem>
                  <SelectItem key="custom">Custom Range</SelectItem>
                </Select>
              </div>

              {/* Report Options */}
              <div>
                <h4 className="font-semibold mb-3">Report Options</h4>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={reportConfig.includeCharts}
                      onChange={(e) => setReportConfig({...reportConfig, includeCharts: e.target.checked})}
                      className="rounded"
                    />
                    <span>Include Charts & Graphs</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={reportConfig.includeDetails}
                      onChange={(e) => setReportConfig({...reportConfig, includeDetails: e.target.checked})}
                      className="rounded"
                    />
                    <span>Include Detailed Data</span>
                  </div>
                </div>
              </div>

              {/* Export Format */}
              <div>
                <h4 className="font-semibold mb-3">Export Format</h4>
                <div className="grid grid-cols-3 gap-3">
                  <Button
                    variant={reportConfig.format === 'pdf' ? 'solid' : 'light'}
                    color="primary"
                    onPress={() => setReportConfig({...reportConfig, format: 'pdf'})}
                  >
                    PDF
                  </Button>
                  <Button
                    variant={reportConfig.format === 'excel' ? 'solid' : 'light'}
                    color="primary"
                    onPress={() => setReportConfig({...reportConfig, format: 'excel'})}
                  >
                    Excel
                  </Button>
                  <Button
                    variant={reportConfig.format === 'csv' ? 'solid' : 'light'}
                    color="primary"
                    onPress={() => setReportConfig({...reportConfig, format: 'csv'})}
                  >
                    CSV
                  </Button>
                </div>
              </div>

              {/* Preview */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-semibold mb-2">Report Preview</h4>
                <div className="text-sm text-gray-600">
                  <p><strong>Type:</strong> {reportConfig.reportType === 'revenue' ? 'Revenue Summary' : 'Detailed Analysis'}</p>
                  <p><strong>Period:</strong> {reportConfig.dateRange === 'week' ? 'This Week' : 
                                               reportConfig.dateRange === 'month' ? 'This Month' :
                                               reportConfig.dateRange === 'quarter' ? 'This Quarter' :
                                               reportConfig.dateRange === 'year' ? 'This Year' : 'Custom Range'}</p>
                  <p><strong>Format:</strong> {reportConfig.format.toUpperCase()}</p>
                  <p><strong>Charts:</strong> {reportConfig.includeCharts ? 'Included' : 'Not included'}</p>
                  <p><strong>Details:</strong> {reportConfig.includeDetails ? 'Included' : 'Not included'}</p>
                </div>
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={onReportClose}>
              Cancel
            </Button>
            <Button 
              color="primary" 
              onPress={() => {
                setIsLoading(true);
                // Simulate report generation
                setTimeout(() => {
                  console.log('Generating report with config:', reportConfig);
                  setIsLoading(false);
                  onReportClose();
                }, 2000);
              }}
              isLoading={isLoading}
            >
              Generate Report
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
