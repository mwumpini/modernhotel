'use client';

import React, { useState, useMemo } from 'react';
import { Card, CardBody, CardHeader, Tabs, Tab, Button, Input, Select, SelectItem, Progress, Chip, Badge, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell } from "@heroui/react";
import { useHousekeepingReportingStore } from '../lib/housekeeping/reportingStore';
import { useRoomStore } from '../lib/housekeeping/roomStore';
import { useMaintenanceStore } from '../lib/housekeeping/maintenanceStore';
import { useSupplyStore } from '../lib/housekeeping/supplyStore';

export default function HousekeepingAnalyticsDashboard() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedPeriod, setSelectedPeriod] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [selectedTab, setSelectedTab] = useState('overview');
  
  const reportingStore = useHousekeepingReportingStore();
  const roomStore = useRoomStore();
  const maintenanceStore = useMaintenanceStore();
  const supplyStore = useSupplyStore();

  // Generate reports based on selected date/period
  const dailyReport = useMemo(() => {
    return reportingStore.generateDailyReport(selectedDate);
  }, [selectedDate, reportingStore]);

  const weeklyReport = useMemo(() => {
    if (selectedPeriod === 'weekly') {
      const startDate = new Date(selectedDate);
      startDate.setDate(startDate.getDate() - selectedDate.getDay());
      const endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 6);
      return reportingStore.generateWeeklyReport(startDate, endDate);
    }
    return null;
  }, [selectedDate, selectedPeriod, reportingStore]);

  const monthlyReport = useMemo(() => {
    if (selectedPeriod === 'monthly') {
      return reportingStore.generateMonthlyReport(selectedDate.getFullYear(), selectedDate.getMonth() + 1);
    }
    return null;
  }, [selectedDate, selectedPeriod, reportingStore]);

  const currentReport = selectedPeriod === 'daily' ? dailyReport : selectedPeriod === 'weekly' ? weeklyReport : monthlyReport;

  // Key metrics
  const roomOccupancyRate = roomStore.getRoomOccupancyRate();
  const cleaningEfficiency = roomStore.getCleaningEfficiency();
  const pendingTasksCount = roomStore.getPendingTasksCount();
  const overdueTasks = roomStore.getOverdueTasks();
  const maintenanceCosts = maintenanceStore.getMaintenanceCosts(selectedPeriod);
  const inventoryValue = supplyStore.getInventoryValue();
  const lowStockSupplies = supplyStore.getLowStockSupplies();
  const restockAlerts = supplyStore.getRestockAlerts();

  // Operational reports
  const roomStatusReport = reportingStore.generateRoomStatusReport();
  const cleaningEfficiencyReport = reportingStore.generateCleaningEfficiencyReport();
  const maintenanceCostReport = reportingStore.generateMaintenanceCostReport(selectedPeriod);
  const supplyInventoryReport = reportingStore.generateSupplyInventoryReport();
  const staffPerformanceReport = reportingStore.generateStaffPerformanceReport();

  // Financial reports
  const costAnalysis = reportingStore.generateCostAnalysis(selectedPeriod);
  const budgetVariance = reportingStore.generateBudgetVariance(selectedPeriod);

  const handleExport = (report: any, format: 'csv' | 'pdf' | 'excel') => {
    reportingStore.exportReport(report, format);
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'good': return 'success';
      case 'warning': return 'warning';
      case 'critical': return 'danger';
      default: return 'default';
    }
  };

  const getRoomStatusColor = (status: string) => {
    switch (status) {
      case 'clean': return 'success';
      case 'occupied': return 'primary';
      case 'dirty': return 'warning';
      case 'maintenance': return 'danger';
      case 'out-of-order': return 'danger';
      default: return 'default';
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ghana-black">🛏️ Housekeeping Analytics Dashboard</h1>
          <p className="text-gray-600">Comprehensive insights into housekeeping operations and performance</p>
        </div>
        <div className="flex gap-2">
          <Input
            type="date"
            value={selectedDate.toISOString().split('T')[0]}
            onChange={(e) => setSelectedDate(new Date(e.target.value))}
            className="w-40"
          />
          <Select
            selectedKeys={[selectedPeriod]}
            onSelectionChange={(keys) => setSelectedPeriod(Array.from(keys)[0] as 'daily' | 'weekly' | 'monthly')}
            className="w-32"
          >
            <SelectItem key="daily">Daily</SelectItem>
            <SelectItem key="weekly">Weekly</SelectItem>
            <SelectItem key="monthly">Monthly</SelectItem>
          </Select>
        </div>
      </div>

      {/* Key Metrics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardBody className="text-center">
            <div className="text-2xl font-bold text-blue-600">{formatPercentage(roomOccupancyRate)}</div>
            <div className="text-sm text-gray-600">Room Occupancy Rate</div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="text-center">
            <div className="text-2xl font-bold text-green-600">{formatPercentage(cleaningEfficiency.completionRate)}</div>
            <div className="text-sm text-gray-600">Task Completion Rate</div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="text-center">
            <div className="text-2xl font-bold text-orange-600">{pendingTasksCount}</div>
            <div className="text-sm text-gray-600">Pending Tasks</div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="text-center">
            <div className="text-2xl font-bold text-purple-600">{formatCurrency(inventoryValue)}</div>
            <div className="text-sm text-gray-600">Inventory Value</div>
          </CardBody>
        </Card>
      </div>

      <Tabs 
        selectedKey={selectedTab} 
        onSelectionChange={(key) => setSelectedTab(key as string)}
        className="w-full"
      >
        <Tab key="overview" title="📊 Overview">
          <div className="space-y-6">
            {/* Room Status Overview */}
            <Card>
              <CardHeader>
                <h3 className="text-lg font-semibold">Room Status Overview</h3>
              </CardHeader>
              <CardBody>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  {roomStatusReport.map((status) => (
                    <div key={status.status} className="text-center">
                      <div className={`text-2xl font-bold text-${getRoomStatusColor(status.status)}-600`}>
                        {status.count}
                      </div>
                      <div className="text-sm text-gray-600 capitalize">{status.status}</div>
                      <div className="text-xs text-gray-500">{formatPercentage(status.percentage)}</div>
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>

            {/* Cleaning Efficiency Metrics */}
            <Card>
              <CardHeader>
                <h3 className="text-lg font-semibold">Cleaning Efficiency Metrics</h3>
              </CardHeader>
              <CardBody>
                <div className="space-y-4">
                  {cleaningEfficiencyReport.map((metric) => (
                    <div key={metric.metric} className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex justify-between mb-1">
                          <span className="text-sm font-medium">{metric.metric}</span>
                          <span className="text-sm text-gray-600">
                            {metric.value} / {metric.target}
                          </span>
                        </div>
                        <Progress 
                          value={(metric.value / metric.target) * 100} 
                          color={getStatusColor(metric.status)}
                          className="w-full"
                        />
                      </div>
                      <Chip color={getStatusColor(metric.status)} className="ml-4">
                        {metric.status}
                      </Chip>
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>

            {/* Alerts and Notifications */}
            <Card>
              <CardHeader>
                <h3 className="text-lg font-semibold">Alerts & Notifications</h3>
              </CardHeader>
              <CardBody>
                <div className="space-y-4">
                  {overdueTasks.length > 0 && (
                    <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                      <Badge color="danger">{overdueTasks.length}</Badge>
                      <span className="text-red-700">Overdue cleaning tasks</span>
                    </div>
                  )}
                  {lowStockSupplies.length > 0 && (
                    <div className="flex items-center gap-2 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                      <Badge color="warning">{lowStockSupplies.length}</Badge>
                      <span className="text-orange-700">Supplies running low</span>
                    </div>
                  )}
                  {restockAlerts.length > 0 && (
                    <div className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <Badge color="warning">{restockAlerts.length}</Badge>
                      <span className="text-yellow-700">Supplies need restocking</span>
                    </div>
                  )}
                </div>
              </CardBody>
            </Card>
          </div>
        </Tab>

        <Tab key="operations" title="⚙️ Operations">
          <div className="space-y-6">
            {/* Staff Performance */}
            <Card>
              <CardHeader className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Staff Performance</h3>
                <Button size="sm" variant="flat" onClick={() => handleExport(staffPerformanceReport, 'csv')}>
                  Export CSV
                </Button>
              </CardHeader>
              <CardBody>
                <Table aria-label="Staff Performance Table">
                  <TableHeader>
                    <TableColumn>Staff ID</TableColumn>
                    <TableColumn>Name</TableColumn>
                    <TableColumn>Position</TableColumn>
                    <TableColumn>Tasks Completed</TableColumn>
                    <TableColumn>Quality Score</TableColumn>
                    <TableColumn>Efficiency</TableColumn>
                  </TableHeader>
                  <TableBody>
                    {staffPerformanceReport.map((staff) => (
                      <TableRow key={staff.staffId}>
                        <TableCell>{staff.staffId}</TableCell>
                        <TableCell>{staff.name}</TableCell>
                        <TableCell className="capitalize">{staff.position}</TableCell>
                        <TableCell>{staff.tasksCompleted}</TableCell>
                        <TableCell>
                          <Chip color={staff.qualityScore >= 8 ? 'success' : staff.qualityScore >= 6 ? 'warning' : 'danger'}>
                            {staff.qualityScore.toFixed(1)}
                          </Chip>
                        </TableCell>
                        <TableCell>
                          <Chip color={staff.efficiency >= 90 ? 'success' : staff.efficiency >= 75 ? 'warning' : 'danger'}>
                            {formatPercentage(staff.efficiency)}
                          </Chip>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardBody>
            </Card>

            {/* Supply Inventory Status */}
            <Card>
              <CardHeader className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Supply Inventory Status</h3>
                <Button size="sm" variant="flat" onClick={() => handleExport(supplyInventoryReport, 'csv')}>
                  Export CSV
                </Button>
              </CardHeader>
              <CardBody>
                <Table aria-label="Supply Inventory Table">
                  <TableHeader>
                    <TableColumn>Category</TableColumn>
                    <TableColumn>Total Items</TableColumn>
                    <TableColumn>Total Value</TableColumn>
                    <TableColumn>Low Stock</TableColumn>
                    <TableColumn>Expiring Soon</TableColumn>
                  </TableHeader>
                  <TableBody>
                    {supplyInventoryReport.map((category) => (
                      <TableRow key={category.category}>
                        <TableCell className="capitalize">{category.category}</TableCell>
                        <TableCell>{category.totalItems}</TableCell>
                        <TableCell>{formatCurrency(category.totalValue)}</TableCell>
                        <TableCell>
                          {category.lowStockCount > 0 && (
                            <Badge color="warning">{category.lowStockCount}</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {category.expiringCount > 0 && (
                            <Badge color="danger">{category.expiringCount}</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardBody>
            </Card>
          </div>
        </Tab>

        <Tab key="maintenance" title="🔧 Maintenance">
          <div className="space-y-6">
            {/* Maintenance Costs */}
            <Card>
              <CardHeader className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Maintenance Costs by Category</h3>
                <Button size="sm" variant="flat" onClick={() => handleExport(maintenanceCostReport, 'csv')}>
                  Export CSV
                </Button>
              </CardHeader>
              <CardBody>
                <Table aria-label="Maintenance Costs Table">
                  <TableHeader>
                    <TableColumn>Category</TableColumn>
                    <TableColumn>Cost</TableColumn>
                    <TableColumn>Count</TableColumn>
                    <TableColumn>Percentage</TableColumn>
                  </TableHeader>
                  <TableBody>
                    {maintenanceCostReport.map((category) => (
                      <TableRow key={category.category}>
                        <TableCell className="capitalize">{category.category}</TableCell>
                        <TableCell>{formatCurrency(category.cost)}</TableCell>
                        <TableCell>{category.count}</TableCell>
                        <TableCell>{formatPercentage(category.percentage)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardBody>
            </Card>

            {/* Work Order Efficiency */}
            <Card>
              <CardHeader>
                <h3 className="text-lg font-semibold">Work Order Efficiency</h3>
              </CardHeader>
              <CardBody>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">
                      {maintenanceStore.getWorkOrderEfficiency().averageDuration.toFixed(1)}
                    </div>
                    <div className="text-sm text-gray-600">Avg Duration (hours)</div>
                  </div>
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">
                      {formatPercentage(maintenanceStore.getWorkOrderEfficiency().completionRate)}
                    </div>
                    <div className="text-sm text-gray-600">Completion Rate</div>
                  </div>
                  <div className="text-center p-4 bg-purple-50 rounded-lg">
                    <div className="text-2xl font-bold text-purple-600">
                      {formatPercentage(maintenanceStore.getWorkOrderEfficiency().onTimeRate)}
                    </div>
                    <div className="text-sm text-gray-600">On-Time Rate</div>
                  </div>
                </div>
              </CardBody>
            </Card>
          </div>
        </Tab>

        <Tab key="financial" title="💰 Financial">
          <div className="space-y-6">
            {/* Cost Analysis */}
            <Card>
              <CardHeader className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Cost Analysis</h3>
                <Button size="sm" variant="flat" onClick={() => handleExport(costAnalysis, 'csv')}>
                  Export CSV
                </Button>
              </CardHeader>
              <CardBody>
                <Table aria-label="Cost Analysis Table">
                  <TableHeader>
                    <TableColumn>Category</TableColumn>
                    <TableColumn>Labor Cost</TableColumn>
                    <TableColumn>Material Cost</TableColumn>
                    <TableColumn>Total Cost</TableColumn>
                    <TableColumn>Percentage</TableColumn>
                  </TableHeader>
                  <TableBody>
                    {costAnalysis.map((category) => (
                      <TableRow key={category.category}>
                        <TableCell>{category.category}</TableCell>
                        <TableCell>{formatCurrency(category.laborCost)}</TableCell>
                        <TableCell>{formatCurrency(category.materialCost)}</TableCell>
                        <TableCell>{formatCurrency(category.totalCost)}</TableCell>
                        <TableCell>{formatPercentage(category.percentage)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardBody>
            </Card>

            {/* Budget Variance */}
            <Card>
              <CardHeader className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Budget Variance</h3>
                <Button size="sm" variant="flat" onClick={() => handleExport(budgetVariance, 'csv')}>
                  Export CSV
                </Button>
              </CardHeader>
              <CardBody>
                <Table aria-label="Budget Variance Table">
                  <TableHeader>
                    <TableColumn>Category</TableColumn>
                    <TableColumn>Budgeted</TableColumn>
                    <TableColumn>Actual</TableColumn>
                    <TableColumn>Variance</TableColumn>
                    <TableColumn>Percentage</TableColumn>
                  </TableHeader>
                  <TableBody>
                    {budgetVariance.map((category) => (
                      <TableRow key={category.category}>
                        <TableCell>{category.category}</TableCell>
                        <TableCell>{formatCurrency(category.budgeted)}</TableCell>
                        <TableCell>{formatCurrency(category.actual)}</TableCell>
                        <TableCell>
                          <Chip color={category.variance <= 0 ? 'success' : 'danger'}>
                            {formatCurrency(category.variance)}
                          </Chip>
                        </TableCell>
                        <TableCell>
                          <Chip color={category.percentage <= 0 ? 'success' : 'danger'}>
                            {formatPercentage(category.percentage)}
                          </Chip>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardBody>
            </Card>
          </div>
        </Tab>

        <Tab key="reports" title="📋 Reports">
          <div className="space-y-6">
            {/* Report Generation */}
            <Card>
              <CardHeader>
                <h3 className="text-lg font-semibold">Generate Reports</h3>
              </CardHeader>
              <CardBody>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-4">
                    <h4 className="font-medium">Operational Reports</h4>
                    <div className="space-y-2">
                      <Button 
                        variant="flat" 
                        onClick={() => handleExport(roomStatusReport, 'csv')}
                        className="w-full justify-start"
                      >
                        📊 Room Status Report
                      </Button>
                      <Button 
                        variant="flat" 
                        onClick={() => handleExport(cleaningEfficiencyReport, 'csv')}
                        className="w-full justify-start"
                      >
                        ⚡ Cleaning Efficiency Report
                      </Button>
                      <Button 
                        variant="flat" 
                        onClick={() => handleExport(supplyInventoryReport, 'csv')}
                        className="w-full justify-start"
                      >
                        📦 Supply Inventory Report
                      </Button>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <h4 className="font-medium">Financial Reports</h4>
                    <div className="space-y-2">
                      <Button 
                        variant="flat" 
                        onClick={() => handleExport(costAnalysis, 'csv')}
                        className="w-full justify-start"
                      >
                        💰 Cost Analysis Report
                      </Button>
                      <Button 
                        variant="flat" 
                        onClick={() => handleExport(budgetVariance, 'csv')}
                        className="w-full justify-start"
                      >
                        📈 Budget Variance Report
                      </Button>
                      <Button 
                        variant="flat" 
                        onClick={() => handleExport(maintenanceCostReport, 'csv')}
                        className="w-full justify-start"
                      >
                        🔧 Maintenance Cost Report
                      </Button>
                    </div>
                  </div>
                </div>
              </CardBody>
            </Card>

            {/* Current Report Summary */}
            {currentReport && (
              <Card>
                <CardHeader className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold">
                    {selectedPeriod.charAt(0).toUpperCase() + selectedPeriod.slice(1)} Report Summary
                  </h3>
                  <div className="flex gap-2">
                    <Button size="sm" variant="flat" onClick={() => handleExport(currentReport, 'csv')}>
                      Export CSV
                    </Button>
                    <Button size="sm" variant="flat" onClick={() => handleExport(currentReport, 'pdf')}>
                      Export PDF
                    </Button>
                  </div>
                </CardHeader>
                <CardBody>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center">
                      <div className="text-lg font-semibold text-blue-600">{currentReport.summary.totalRooms}</div>
                      <div className="text-sm text-gray-600">Total Rooms</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-semibold text-green-600">{currentReport.summary.roomsCleaned}</div>
                      <div className="text-sm text-gray-600">Rooms Cleaned</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-semibold text-orange-600">{currentReport.summary.pendingTasks}</div>
                      <div className="text-sm text-gray-600">Pending Tasks</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-semibold text-purple-600">{currentReport.summary.qualityScore.toFixed(1)}</div>
                      <div className="text-sm text-gray-600">Quality Score</div>
                    </div>
                  </div>
                  
                  {currentReport.recommendations.length > 0 && (
                    <div className="mt-4">
                      <h4 className="font-medium mb-2">Recommendations</h4>
                      <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
                        {currentReport.recommendations.map((rec, index) => (
                          <li key={index}>{rec}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardBody>
              </Card>
            )}
          </div>
        </Tab>
      </Tabs>
    </div>
  );
}
