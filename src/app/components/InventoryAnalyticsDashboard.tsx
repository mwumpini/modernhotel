'use client';
import React, { useState, useMemo } from 'react';
import { Card, CardBody, CardHeader, Tabs, Tab, Button, Input, Select, SelectItem, Progress, Chip, Badge, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell } from "@heroui/react";
import { useInventoryReportingStore } from '../lib/inventory/reportingStore';
import { useStockStore } from '../lib/inventory/stockStore';
import { useSupplierStore } from '../lib/inventory/supplierStore';
import { InventoryReport } from '../lib/inventory/models';

export default function InventoryAnalyticsDashboard() {
  const [selectedPeriod, setSelectedPeriod] = useState<'daily' | 'weekly' | 'monthly'>('monthly');
  const [startDate, setStartDate] = useState(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)); // 30 days ago
  const [endDate, setEndDate] = useState(new Date());
  const [selectedReportType, setSelectedReportType] = useState<InventoryReport['type']>('monthly');

  const reportingStore = useInventoryReportingStore();
  const stockStore = useStockStore();
  const supplierStore = useSupplierStore();

  // Generate reports using useMemo for performance
  const inventoryReport = useMemo(() => 
    reportingStore.generateInventoryReport(selectedReportType, startDate, endDate), 
    [selectedReportType, startDate, endDate]
  );

  const inventoryAnalytics = useMemo(() => 
    reportingStore.generateInventoryAnalytics(selectedPeriod, new Date()), 
    [selectedPeriod]
  );

  const costAnalysis = useMemo(() => 
    reportingStore.generateCostAnalysis(selectedPeriod, startDate, endDate), 
    [selectedPeriod, startDate, endDate]
  );

  const lowStockReport = useMemo(() => 
    reportingStore.generateLowStockReport(), 
    []
  );

  const expiryReport = useMemo(() => 
    reportingStore.generateExpiryReport(30), 
    []
  );

  const movementReport = useMemo(() => 
    reportingStore.generateMovementReport(startDate, endDate), 
    [startDate, endDate]
  );

  const supplierReport = useMemo(() => 
    reportingStore.generateSupplierReport(), 
    []
  );

  const locationReport = useMemo(() => 
    reportingStore.generateLocationReport(), 
    []
  );

  const categoryReport = useMemo(() => 
    reportingStore.generateCategoryReport(), 
    []
  );

  const financialReport = useMemo(() => 
    reportingStore.generateFinancialReport(), 
    []
  );

  // Key metrics
  const totalInventoryValue = stockStore.getTotalInventoryValue();
  const totalItems = stockStore.stockItems.length;
  const lowStockItems = stockStore.getLowStockItems().length;
  const activeAlerts = stockStore.getActiveAlerts().length;
  const stockTurnoverRate = stockStore.getStockTurnoverRate();
  const daysInventoryOutstanding = stockStore.getDaysInventoryOutstanding();

  const formatCurrency = (amount: number) => `GHS ${amount.toLocaleString('en-GH', { minimumFractionDigits: 2 })}`;
  const formatPercentage = (value: number) => `${value.toFixed(1)}%`;

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">📦 Inventory & Stores Analytics Dashboard</h1>
        <div className="flex gap-4">
          <Select
            label="Period"
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value as 'daily' | 'weekly' | 'monthly')}
            className="w-32"
          >
            <SelectItem key="daily" value="daily">Daily</SelectItem>
            <SelectItem key="weekly" value="weekly">Weekly</SelectItem>
            <SelectItem key="monthly" value="monthly">Monthly</SelectItem>
          </Select>
          <Input
            type="date"
            label="Start Date"
            value={startDate.toISOString().split('T')[0]}
            onChange={(e) => setStartDate(new Date(e.target.value))}
            className="w-40"
          />
          <Input
            type="date"
            label="End Date"
            value={endDate.toISOString().split('T')[0]}
            onChange={(e) => setEndDate(new Date(e.target.value))}
            className="w-40"
          />
        </div>
      </div>

      {/* Key Metrics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-gradient-to-r from-blue-500 to-blue-600 text-white">
          <CardBody className="p-6">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-blue-100 text-sm">Total Inventory Value</p>
                <p className="text-2xl font-bold">{formatCurrency(totalInventoryValue)}</p>
              </div>
              <div className="text-4xl">📦</div>
            </div>
          </CardBody>
        </Card>

        <Card className="bg-gradient-to-r from-green-500 to-green-600 text-white">
          <CardBody className="p-6">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-green-100 text-sm">Total Items</p>
                <p className="text-2xl font-bold">{totalItems}</p>
              </div>
              <div className="text-4xl">🏷️</div>
            </div>
          </CardBody>
        </Card>

        <Card className="bg-gradient-to-r from-orange-500 to-orange-600 text-white">
          <CardBody className="p-6">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-orange-100 text-sm">Low Stock Items</p>
                <p className="text-2xl font-bold">{lowStockItems}</p>
              </div>
              <div className="text-4xl">⚠️</div>
            </div>
          </CardBody>
        </Card>

        <Card className="bg-gradient-to-r from-purple-500 to-purple-600 text-white">
          <CardBody className="p-6">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-purple-100 text-sm">Active Alerts</p>
                <p className="text-2xl font-bold">{activeAlerts}</p>
              </div>
              <div className="text-4xl">🔔</div>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Performance Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <h3 className="text-lg font-semibold">Stock Turnover Rate</h3>
          </CardHeader>
          <CardBody>
            <div className="text-center">
              <p className="text-3xl font-bold text-blue-600">{stockTurnoverRate.toFixed(2)}</p>
              <p className="text-sm text-gray-600">times per year</p>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <h3 className="text-lg font-semibold">Days Inventory Outstanding</h3>
          </CardHeader>
          <CardBody>
            <div className="text-center">
              <p className="text-3xl font-bold text-green-600">{daysInventoryOutstanding.toFixed(1)}</p>
              <p className="text-sm text-gray-600">days</p>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <h3 className="text-lg font-semibold">Low Stock Percentage</h3>
          </CardHeader>
          <CardBody>
            <div className="text-center">
              <p className="text-3xl font-bold text-orange-600">{formatPercentage(stockStore.getLowStockPercentage())}</p>
              <Progress 
                value={stockStore.getLowStockPercentage()} 
                color={stockStore.getLowStockPercentage() > 20 ? "danger" : "success"}
                className="mt-2"
              />
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Main Dashboard Tabs */}
      <Card>
        <CardBody className="p-0">
          <Tabs aria-label="Inventory Analytics Tabs" className="w-full">
            <Tab key="overview" title="📊 Overview">
              <div className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <h3 className="text-lg font-semibold">Category Distribution</h3>
                    </CardHeader>
                    <CardBody>
                      <div className="space-y-3">
                        {Object.entries(inventoryAnalytics.categoryDistribution).map(([category, data]) => (
                          <div key={category} className="flex justify-between items-center">
                            <span className="capitalize">{category}</span>
                            <div className="flex items-center gap-2">
                              <Progress 
                                value={(data.value / totalInventoryValue) * 100} 
                                className="w-20"
                                color="primary"
                              />
                              <span className="text-sm font-medium">{formatCurrency(data.value)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardBody>
                  </Card>

                  <Card>
                    <CardHeader>
                      <h3 className="text-lg font-semibold">Location Efficiency</h3>
                    </CardHeader>
                    <CardBody>
                      <div className="space-y-3">
                        {Object.entries(inventoryAnalytics.locationEfficiency).map(([location, data]) => (
                          <div key={location} className="flex justify-between items-center">
                            <span>{location}</span>
                            <div className="flex items-center gap-2">
                              <Progress 
                                value={(data.value / totalInventoryValue) * 100} 
                                className="w-20"
                                color="success"
                              />
                              <span className="text-sm font-medium">{formatCurrency(data.value)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardBody>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <h3 className="text-lg font-semibold">Top Items by Value</h3>
                  </CardHeader>
                  <CardBody>
                    <Table aria-label="Top items table">
                      <TableHeader>
                        <TableColumn>Item Code</TableColumn>
                        <TableColumn>Name</TableColumn>
                        <TableColumn>Category</TableColumn>
                        <TableColumn>Stock</TableColumn>
                        <TableColumn>Value</TableColumn>
                      </TableHeader>
                      <TableBody>
                        {inventoryReport.details.topItems.map((item) => (
                          <TableRow key={item.itemCode}>
                            <TableCell>{item.itemCode}</TableCell>
                            <TableCell>{item.name}</TableCell>
                            <TableCell>
                              <Chip size="sm" variant="flat" className="capitalize">
                                {stockStore.getStockItemByCode(item.itemCode)?.category}
                              </Chip>
                            </TableCell>
                            <TableCell>{item.quantity}</TableCell>
                            <TableCell className="font-medium">{formatCurrency(item.value)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardBody>
                </Card>
              </div>
            </Tab>

            <Tab key="low-stock" title="⚠️ Low Stock Alerts">
              <div className="p-6 space-y-6">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold">Low Stock Items</h3>
                  <div className="flex gap-2">
                    <Button 
                      color="primary" 
                      variant="flat"
                      onPress={() => reportingStore.exportLowStockReport('csv')}
                    >
                      Export CSV
                    </Button>
                    <Button 
                      color="primary" 
                      variant="flat"
                      onPress={() => reportingStore.exportLowStockReport('pdf')}
                    >
                      Export PDF
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <Card className="bg-red-50 border-red-200">
                    <CardBody className="text-center">
                      <p className="text-2xl font-bold text-red-600">{lowStockReport.summary.criticalItems}</p>
                      <p className="text-sm text-red-600">Critical</p>
                    </CardBody>
                  </Card>
                  <Card className="bg-orange-50 border-orange-200">
                    <CardBody className="text-center">
                      <p className="text-2xl font-bold text-orange-600">{lowStockReport.summary.highPriorityItems}</p>
                      <p className="text-sm text-orange-600">High Priority</p>
                    </CardBody>
                  </Card>
                  <Card className="bg-blue-50 border-blue-200">
                    <CardBody className="text-center">
                      <p className="text-2xl font-bold text-blue-600">{lowStockReport.summary.totalItems}</p>
                      <p className="text-sm text-blue-600">Total Items</p>
                    </CardBody>
                  </Card>
                  <Card className="bg-green-50 border-green-200">
                    <CardBody className="text-center">
                      <p className="text-2xl font-bold text-green-600">{formatCurrency(lowStockReport.summary.estimatedReorderValue)}</p>
                      <p className="text-sm text-green-600">Reorder Value</p>
                    </CardBody>
                  </Card>
                </div>

                <Table aria-label="Low stock items table">
                  <TableHeader>
                    <TableColumn>Item Code</TableColumn>
                    <TableColumn>Name</TableColumn>
                    <TableColumn>Category</TableColumn>
                    <TableColumn>Current Stock</TableColumn>
                    <TableColumn>Reorder Point</TableColumn>
                    <TableColumn>Supplier</TableColumn>
                    <TableColumn>Urgency</TableColumn>
                  </TableHeader>
                  <TableBody>
                    {lowStockReport.items.map((item) => (
                      <TableRow key={item.itemCode}>
                        <TableCell>{item.itemCode}</TableCell>
                        <TableCell>{item.name}</TableCell>
                        <TableCell>
                          <Chip size="sm" variant="flat" className="capitalize">
                            {item.category}
                          </Chip>
                        </TableCell>
                        <TableCell>
                          <Badge color={item.currentStock === 0 ? "danger" : "warning"}>
                            {item.currentStock}
                          </Badge>
                        </TableCell>
                        <TableCell>{item.reorderPoint}</TableCell>
                        <TableCell>{item.supplierName}</TableCell>
                        <TableCell>
                          <Chip 
                            size="sm" 
                            color={
                              item.urgency === 'critical' ? 'danger' :
                              item.urgency === 'high' ? 'warning' :
                              item.urgency === 'medium' ? 'secondary' : 'default'
                            }
                          >
                            {item.urgency.toUpperCase()}
                          </Chip>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Tab>

            <Tab key="expiry" title="⏰ Expiry Management">
              <div className="p-6 space-y-6">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold">Expiring Items (Next 30 Days)</h3>
                  <div className="flex gap-2">
                    <Button 
                      color="primary" 
                      variant="flat"
                      onPress={() => reportingStore.exportExpiryReport(30, 'csv')}
                    >
                      Export CSV
                    </Button>
                    <Button 
                      color="primary" 
                      variant="flat"
                      onPress={() => reportingStore.exportExpiryReport(30, 'pdf')}
                    >
                      Export PDF
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <Card className="bg-red-50 border-red-200">
                    <CardBody className="text-center">
                      <p className="text-2xl font-bold text-red-600">{expiryReport.summary.itemsExpiringToday}</p>
                      <p className="text-sm text-red-600">Expiring Today</p>
                    </CardBody>
                  </Card>
                  <Card className="bg-orange-50 border-orange-200">
                    <CardBody className="text-center">
                      <p className="text-2xl font-bold text-orange-600">{expiryReport.summary.itemsExpiringThisWeek}</p>
                      <p className="text-sm text-orange-600">This Week</p>
                    </CardBody>
                  </Card>
                  <Card className="bg-yellow-50 border-yellow-200">
                    <CardBody className="text-center">
                      <p className="text-2xl font-bold text-yellow-600">{expiryReport.summary.itemsExpiringThisMonth}</p>
                      <p className="text-sm text-yellow-600">This Month</p>
                    </CardBody>
                  </Card>
                  <Card className="bg-blue-50 border-blue-200">
                    <CardBody className="text-center">
                      <p className="text-2xl font-bold text-blue-600">{formatCurrency(expiryReport.summary.totalValue)}</p>
                      <p className="text-sm text-blue-600">Total Value</p>
                    </CardBody>
                  </Card>
                </div>

                <Table aria-label="Expiring items table">
                  <TableHeader>
                    <TableColumn>Item Code</TableColumn>
                    <TableColumn>Name</TableColumn>
                    <TableColumn>Category</TableColumn>
                    <TableColumn>Current Stock</TableColumn>
                    <TableColumn>Expiry Date</TableColumn>
                    <TableColumn>Days Until Expiry</TableColumn>
                    <TableColumn>Value</TableColumn>
                  </TableHeader>
                  <TableBody>
                    {expiryReport.items.map((item) => (
                      <TableRow key={item.itemCode}>
                        <TableCell>{item.itemCode}</TableCell>
                        <TableCell>{item.name}</TableCell>
                        <TableCell>
                          <Chip size="sm" variant="flat" className="capitalize">
                            {item.category}
                          </Chip>
                        </TableCell>
                        <TableCell>{item.currentStock}</TableCell>
                        <TableCell>{item.expiryDate.toLocaleDateString()}</TableCell>
                        <TableCell>
                          <Badge 
                            color={
                              item.daysUntilExpiry === 0 ? 'danger' :
                              item.daysUntilExpiry <= 7 ? 'warning' :
                              item.daysUntilExpiry <= 30 ? 'secondary' : 'default'
                            }
                          >
                            {item.daysUntilExpiry} days
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">{formatCurrency(item.totalValue)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Tab>

            <Tab key="suppliers" title="🤝 Supplier Performance">
              <div className="p-6 space-y-6">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold">Supplier Performance Analysis</h3>
                  <div className="flex gap-2">
                    <Button 
                      color="primary" 
                      variant="flat"
                      onPress={() => reportingStore.exportSupplierReport('csv')}
                    >
                      Export CSV
                    </Button>
                    <Button 
                      color="primary" 
                      variant="flat"
                      onPress={() => reportingStore.exportSupplierReport('pdf')}
                    >
                      Export PDF
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card>
                    <CardBody className="text-center">
                      <p className="text-2xl font-bold text-blue-600">{supplierReport.summary.totalSuppliers}</p>
                      <p className="text-sm text-gray-600">Total Suppliers</p>
                    </CardBody>
                  </Card>
                  <Card>
                    <CardBody className="text-center">
                      <p className="text-2xl font-bold text-green-600">{formatCurrency(supplierReport.summary.totalSpend)}</p>
                      <p className="text-sm text-gray-600">Total Spend</p>
                    </CardBody>
                  </Card>
                  <Card>
                    <CardBody className="text-center">
                      <p className="text-2xl font-bold text-purple-600">{supplierReport.summary.averageSupplierRating.toFixed(1)}</p>
                      <p className="text-sm text-gray-600">Avg Rating</p>
                    </CardBody>
                  </Card>
                </div>

                <Table aria-label="Supplier performance table">
                  <TableHeader>
                    <TableColumn>Name</TableColumn>
                    <TableColumn>Code</TableColumn>
                    <TableColumn>Categories</TableColumn>
                    <TableColumn>Orders</TableColumn>
                    <TableColumn>Total Spend</TableColumn>
                    <TableColumn>On-Time Delivery</TableColumn>
                    <TableColumn>Quality Rating</TableColumn>
                    <TableColumn>Performance</TableColumn>
                  </TableHeader>
                  <TableBody>
                    {supplierReport.suppliers.map((supplier) => (
                      <TableRow key={supplier.code}>
                        <TableCell className="font-medium">{supplier.name}</TableCell>
                        <TableCell>{supplier.code}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {supplier.categories.slice(0, 2).map((category) => (
                              <Chip key={category} size="sm" variant="flat" className="capitalize">
                                {category}
                              </Chip>
                            ))}
                            {supplier.categories.length > 2 && (
                              <Chip size="sm" variant="flat">+{supplier.categories.length - 2}</Chip>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{supplier.totalOrders}</TableCell>
                        <TableCell>{formatCurrency(supplier.totalSpend)}</TableCell>
                        <TableCell>
                          <Badge color={supplier.onTimeDelivery >= 95 ? 'success' : supplier.onTimeDelivery >= 85 ? 'warning' : 'danger'}>
                            {supplier.onTimeDelivery}%
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge color={supplier.qualityRating >= 4.5 ? 'success' : supplier.qualityRating >= 4.0 ? 'warning' : 'danger'}>
                            {supplier.qualityRating.toFixed(1)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Progress 
                            value={supplier.performance * 10} 
                            color={supplier.performance >= 8 ? 'success' : supplier.performance >= 6 ? 'warning' : 'danger'}
                            className="w-20"
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Tab>

            <Tab key="financial" title="💰 Financial Analysis">
              <div className="p-6 space-y-6">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold">Financial Performance</h3>
                  <div className="flex gap-2">
                    <Button 
                      color="primary" 
                      variant="flat"
                      onPress={() => reportingStore.exportFinancialReport('csv')}
                    >
                      Export CSV
                    </Button>
                    <Button 
                      color="primary" 
                      variant="flat"
                      onPress={() => reportingStore.exportFinancialReport('pdf')}
                    >
                      Export PDF
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <Card>
                    <CardBody className="text-center">
                      <p className="text-2xl font-bold text-blue-600">{formatCurrency(financialReport.summary.totalInventoryValue)}</p>
                      <p className="text-sm text-gray-600">Inventory Value</p>
                    </CardBody>
                  </Card>
                  <Card>
                    <CardBody className="text-center">
                      <p className="text-2xl font-bold text-green-600">{financialReport.summary.totalPurchaseOrders}</p>
                      <p className="text-sm text-gray-600">Purchase Orders</p>
                    </CardBody>
                  </Card>
                  <Card>
                    <CardBody className="text-center">
                      <p className="text-2xl font-bold text-purple-600">{formatCurrency(financialReport.summary.totalPurchaseValue)}</p>
                      <p className="text-sm text-gray-600">Purchase Value</p>
                    </CardBody>
                  </Card>
                  <Card>
                    <CardBody className="text-center">
                      <p className="text-2xl font-bold text-orange-600">{formatCurrency(financialReport.summary.averageOrderValue)}</p>
                      <p className="text-sm text-gray-600">Avg Order Value</p>
                    </CardBody>
                  </Card>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <h3 className="text-lg font-semibold">Category Breakdown</h3>
                    </CardHeader>
                    <CardBody>
                      <div className="space-y-3">
                        {Object.entries(financialReport.breakdown.byCategory).map(([category, data]) => (
                          <div key={category} className="flex justify-between items-center">
                            <span className="capitalize">{category}</span>
                            <div className="flex items-center gap-2">
                              <Progress 
                                value={data.percentage} 
                                className="w-20"
                                color="primary"
                              />
                              <span className="text-sm font-medium">{formatCurrency(data.value)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardBody>
                  </Card>

                  <Card>
                    <CardHeader>
                      <h3 className="text-lg font-semibold">Location Breakdown</h3>
                    </CardHeader>
                    <CardBody>
                      <div className="space-y-3">
                        {Object.entries(financialReport.breakdown.byLocation).map(([location, data]) => (
                          <div key={location} className="flex justify-between items-center">
                            <span>{location}</span>
                            <div className="flex items-center gap-2">
                              <Progress 
                                value={data.percentage} 
                                className="w-20"
                                color="success"
                              />
                              <span className="text-sm font-medium">{formatCurrency(data.value)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardBody>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <h3 className="text-lg font-semibold">Performance Trends</h3>
                  </CardHeader>
                  <CardBody>
                    <Table aria-label="Performance trends table">
                      <TableHeader>
                        <TableColumn>Period</TableColumn>
                        <TableColumn>Inventory Value</TableColumn>
                        <TableColumn>Purchase Value</TableColumn>
                        <TableColumn>Turnover Rate</TableColumn>
                        <TableColumn>Change</TableColumn>
                      </TableHeader>
                      <TableBody>
                        {financialReport.trends.map((trend) => (
                          <TableRow key={trend.period}>
                            <TableCell>{trend.period}</TableCell>
                            <TableCell>{formatCurrency(trend.inventoryValue)}</TableCell>
                            <TableCell>{formatCurrency(trend.purchaseValue)}</TableCell>
                            <TableCell>{trend.turnoverRate.toFixed(2)}</TableCell>
                            <TableCell>
                              <Badge color={trend.change >= 0 ? 'success' : 'danger'}>
                                {trend.change >= 0 ? '+' : ''}{trend.change}%
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardBody>
                </Card>
              </div>
            </Tab>

            <Tab key="reports" title="📋 Report Generator">
              <div className="p-6 space-y-6">
                <h3 className="text-lg font-semibold">Generate Custom Reports</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <h4 className="text-md font-semibold">Inventory Report</h4>
                    </CardHeader>
                    <CardBody className="space-y-4">
                      <Select
                        label="Report Type"
                        value={selectedReportType}
                        onChange={(e) => setSelectedReportType(e.target.value as InventoryReport['type'])}
                      >
                        <SelectItem key="daily" value="daily">Daily</SelectItem>
                        <SelectItem key="weekly" value="weekly">Weekly</SelectItem>
                        <SelectItem key="monthly" value="monthly">Monthly</SelectItem>
                        <SelectItem key="custom" value="custom">Custom</SelectItem>
                      </Select>
                      <div className="flex gap-2">
                        <Button 
                          color="primary" 
                          variant="flat"
                          onPress={() => reportingStore.exportInventoryReport(selectedReportType, startDate, endDate, 'csv')}
                        >
                          Export CSV
                        </Button>
                        <Button 
                          color="primary" 
                          variant="flat"
                          onPress={() => reportingStore.exportInventoryReport(selectedReportType, startDate, endDate, 'pdf')}
                        >
                          Export PDF
                        </Button>
                      </div>
                    </CardBody>
                  </Card>

                  <Card>
                    <CardHeader>
                      <h4 className="text-md font-semibold">Quick Reports</h4>
                    </CardHeader>
                    <CardBody className="space-y-3">
                      <Button 
                        color="primary" 
                        variant="flat" 
                        className="w-full justify-start"
                        onPress={() => reportingStore.exportMovementReport(startDate, endDate, 'csv')}
                      >
                        📊 Movement Report (CSV)
                      </Button>
                      <Button 
                        color="primary" 
                        variant="flat" 
                        className="w-full justify-start"
                        onPress={() => reportingStore.exportLocationReport('csv')}
                      >
                        📍 Location Report (CSV)
                      </Button>
                      <Button 
                        color="primary" 
                        variant="flat" 
                        className="w-full justify-start"
                        onPress={() => reportingStore.exportCategoryReport('csv')}
                      >
                        🏷️ Category Report (CSV)
                      </Button>
                    </CardBody>
                  </Card>
                </div>
              </div>
            </Tab>

            <Tab key="performance" title="📊 Performance Metrics">
              <div className="p-6 space-y-6">
                <h3 className="text-lg font-semibold">Key Performance Indicators</h3>
                
                {/* Performance KPIs */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
                  {/* Inventory Turnover */}
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <span className="text-2xl">🔄</span>
                      <span className="text-sm font-medium text-gray-600">Inventory Turnover</span>
                    </div>
                    <div className="text-2xl font-bold text-ghana-black mb-2">0</div>
                    <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                      <span>Target: 12x/year</span>
                    </div>
                    <Progress value={0} color="success" size="sm" />
                  </div>

                  {/* Stock Accuracy */}
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <span className="text-2xl">📊</span>
                      <span className="text-sm font-medium text-gray-600">Stock Accuracy</span>
                    </div>
                    <div className="text-2xl font-bold text-ghana-black mb-2">0%</div>
                    <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                      <span>Target: 98%</span>
                    </div>
                    <Progress value={0} color="primary" size="sm" />
                  </div>

                  {/* Order Fill Rate */}
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <span className="text-2xl">📦</span>
                      <span className="text-sm font-medium text-gray-600">Order Fill Rate</span>
                    </div>
                    <div className="text-2xl font-bold text-ghana-black mb-2">0%</div>
                    <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                      <span>Target: 95%</span>
                    </div>
                    <Progress value={0} color="secondary" size="sm" />
                  </div>

                  {/* Supplier Performance */}
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <span className="text-2xl">⭐</span>
                      <span className="text-sm font-medium text-gray-600">Supplier Rating</span>
                    </div>
                    <div className="text-2xl font-bold text-ghana-black mb-2">0/5</div>
                    <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                      <span>Target: 4.5/5</span>
                    </div>
                    <Progress value={0} color="warning" size="sm" />
                  </div>
                </div>

                {/* Performance Trends */}
                <Card className="border-0 shadow-lg">
                  <CardHeader>
                    <h3 className="text-xl font-semibold text-ghana-black">Performance Trends</h3>
                  </CardHeader>
                  <CardBody>
                    <div className="text-center py-12 text-gray-500">
                      <div className="text-4xl mb-4">📊</div>
                      <h4 className="text-lg font-medium mb-2">Performance Trends</h4>
                      <p className="text-sm">Historical performance data and trend analysis will be displayed here.</p>
                      <p className="text-xs mt-2">Connect to live data sources to see real-time trends</p>
                    </div>
                  </CardBody>
                </Card>
              </div>
            </Tab>
          </Tabs>
        </CardBody>
      </Card>
    </div>
  );
}
