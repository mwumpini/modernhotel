'use client';

import React, { useState, useMemo } from 'react';
import { Card, CardBody, CardHeader, Tabs, Tab, Button, Input, Progress, Chip, Badge } from "@heroui/react";
import { reportingStore } from '../lib/fb/reportingStore';
import { inventoryStore } from '../lib/fb/inventoryStore';
import { customerStore } from '../lib/fb/customerStore';
import { supplierStore } from '../lib/fb/supplierStore';
import { employeeStore } from '../lib/fb/employeeStore';
import { ordersStore } from '../lib/fb/ordersStore';

export default function FoodBeverageAnalyticsDashboard() {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [startDate, setStartDate] = useState(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedTab, setSelectedTab] = useState('overview');

  // ordersStore starts empty and is hydrated async from the real, persisted order
  // history (see ordersStore.hydrateFromApi) — this tick forces the report
  // useMemos below to recompute once that real data actually arrives, instead of
  // permanently reflecting whatever (nothing, on a fresh page load) was in the
  // in-memory store at first render.
  const [ordersTick, setOrdersTick] = React.useState(0);
  React.useEffect(() => {
    ordersStore.hydrateFromApi().then(() => setOrdersTick((t) => t + 1));
    const unsub = ordersStore.subscribe(() => setOrdersTick((t) => t + 1));
    return unsub;
  }, []);

  // customerStore is likewise hydrated async from real, persisted customer
  // records — the customerData/customerAnalytics state below is already
  // subscribed to customerStore's change notifications (see below), so this
  // just needs to kick the initial fetch off.
  React.useEffect(() => {
    customerStore.hydrateFromApi();
  }, []);

  // Generate reports
  const dailySalesReport = useMemo(() =>
    reportingStore.generateDailySalesReport(selectedDate), [selectedDate, ordersTick]);

  const productMixReport = useMemo(() =>
    reportingStore.generateProductMixReport(startDate, endDate), [startDate, endDate, ordersTick]);

  const salesByEmployeeReport = useMemo(() =>
    reportingStore.generateSalesByEmployeeReport(startDate, endDate), [startDate, endDate, ordersTick]);

  const inventoryReport = useMemo(() =>
    reportingStore.generateInventoryReport(selectedDate), [selectedDate]);

  const wasteReport = useMemo(() =>
    reportingStore.generateWasteReport(startDate, endDate), [startDate, endDate]);

  const laborReport = useMemo(() =>
    reportingStore.generateLaborReport(startDate, endDate), [startDate, endDate, ordersTick]);

  const financialSummary = useMemo(() =>
    reportingStore.generateFinancialSummary(startDate, endDate), [startDate, endDate, ordersTick]);
  
  // Real-time data
  const [inventoryData, setInventoryData] = React.useState(inventoryStore.getAllIngredients());
  const [customerData, setCustomerData] = React.useState(customerStore.getAllCustomers());
  const [supplierData, setSupplierData] = React.useState(supplierStore.getAllSuppliers());
  const [employeeData, setEmployeeData] = React.useState(employeeStore.getAllEmployees());

  // Depend on customerData (already kept live via the subscription below) so
  // this recomputes once real customers actually arrive from hydrateFromApi,
  // instead of permanently reflecting the empty/pre-hydration snapshot.
  const customerAnalytics = useMemo(() =>
    reportingStore.generateCustomerAnalyticsReport(), [customerData]);

  const supplierAnalytics = useMemo(() =>
    reportingStore.generateSupplierAnalyticsReport(), [supplierData]);

  React.useEffect(() => {
    const unsubscribeInventory = inventoryStore.subscribe(() => 
      setInventoryData(inventoryStore.getAllIngredients()));
    const unsubscribeCustomer = customerStore.subscribe(() => 
      setCustomerData(customerStore.getAllCustomers()));
    const unsubscribeSupplier = supplierStore.subscribe(() => 
      setSupplierData(supplierStore.getAllSuppliers()));
    const unsubscribeEmployee = employeeStore.subscribe(() => 
      setEmployeeData(employeeStore.getAllEmployees()));

    return () => {
      unsubscribeInventory();
      unsubscribeCustomer();
      unsubscribeSupplier();
      unsubscribeEmployee();
    };
  }, []);

  const exportReport = (reportType: string, data: any) => {
    const csv = reportingStore.exportReport(reportType, data);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${reportType}_${selectedDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-ghana-black">F&B Analytics Dashboard</h1>
        <div className="flex gap-4">
          <Input
            type="date"
            label="Daily Reports Date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          />
          <Input
            type="date"
            label="Start Date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
          <Input
            type="date"
            label="End Date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
      </div>

      <Tabs selectedKey={selectedTab} onSelectionChange={(key) => setSelectedTab(key as string)}>
        <Tab key="overview" title="📊 Overview">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-6">
            {/* Key Metrics Cards */}
            <Card className="border-0 shadow-lg">
              <CardBody className="text-center">
                <div className="text-2xl font-bold text-ghana-black">₵{dailySalesReport.totalSales.toFixed(2)}</div>
                <div className="text-sm text-gray-600">Daily Sales</div>
                <div className="text-xs text-gray-500">{dailySalesReport.totalOrders} orders</div>
              </CardBody>
            </Card>

            <Card className="border-0 shadow-lg">
              <CardBody className="text-center">
                <div className="text-2xl font-bold text-ghana-black">₵{inventoryReport.totalValue.toFixed(2)}</div>
                <div className="text-sm text-gray-600">Inventory Value</div>
                <div className="text-xs text-gray-500">{inventoryData.length} items</div>
              </CardBody>
            </Card>

            <Card className="border-0 shadow-lg">
              <CardBody className="text-center">
                <div className="text-2xl font-bold text-ghana-black">{customerData.length}</div>
                <div className="text-sm text-gray-600">Total Customers</div>
                <div className="text-xs text-gray-500">{customerAnalytics.activeCustomers} active</div>
              </CardBody>
            </Card>

            <Card className="border-0 shadow-lg">
              <CardBody className="text-center">
                <div className="text-2xl font-bold text-ghana-black">{employeeData.length}</div>
                <div className="text-sm text-gray-600">Total Employees</div>
                <div className="text-xs text-gray-500">{employeeData.filter(e => e.isActive).length} active</div>
              </CardBody>
            </Card>
          </div>

          {/* Financial Summary */}
          <Card className="border-0 shadow-lg mt-6">
            <CardHeader className="flex items-center justify-between">
              <h3 className="text-xl font-semibold text-ghana-black">Financial Summary</h3>
              <Button size="sm" variant="flat" onClick={() => exportReport('financial', financialSummary)}>
                Export
              </Button>
            </CardHeader>
            <CardBody>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-lg font-semibold text-green-600">₵{financialSummary.totalRevenue.toFixed(2)}</div>
                  <div className="text-sm text-gray-600">Revenue</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-semibold text-blue-600">₵{financialSummary.grossProfit.toFixed(2)}</div>
                  <div className="text-sm text-gray-600">Gross Profit</div>
                  <div className="text-xs text-gray-500">{financialSummary.grossProfitMargin.toFixed(1)}% margin</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-semibold text-orange-600">₵{financialSummary.totalLaborCost.toFixed(2)}</div>
                  <div className="text-sm text-gray-600">Labor Cost</div>
                  <div className="text-xs text-gray-500">{financialSummary.laborPercentage.toFixed(1)}% of revenue</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-semibold text-red-600">₵{financialSummary.netProfit.toFixed(2)}</div>
                  <div className="text-sm text-gray-600">Net Profit</div>
                  <div className="text-xs text-gray-500">{financialSummary.netProfitMargin.toFixed(1)}% margin</div>
                </div>
              </div>
            </CardBody>
          </Card>
        </Tab>

        <Tab key="sales" title="💰 Sales Analytics">
          <div className="space-y-6 mt-6">
            {/* Daily Sales Report */}
            <Card className="border-0 shadow-lg">
              <CardHeader className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-ghana-black">Daily Sales Report - {selectedDate}</h3>
                <Button size="sm" variant="flat" onClick={() => exportReport('daily-sales', dailySalesReport)}>
                  Export
                </Button>
              </CardHeader>
              <CardBody>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-ghana-black">₵{dailySalesReport.totalSales.toFixed(2)}</div>
                    <div className="text-sm text-gray-600">Total Sales</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-ghana-black">{dailySalesReport.totalOrders}</div>
                    <div className="text-sm text-gray-600">Total Orders</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-ghana-black">₵{dailySalesReport.averageOrderValue.toFixed(2)}</div>
                    <div className="text-sm text-gray-600">Avg Order Value</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-ghana-black">{dailySalesReport.topSellingItems.length}</div>
                    <div className="text-sm text-gray-600">Items Sold</div>
                  </div>
                </div>

                {/* Payment Breakdown */}
                <div className="mb-6">
                  <h4 className="text-lg font-semibold mb-3">Payment Breakdown</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {Object.entries(dailySalesReport.paymentBreakdown).map(([method, amount]) => (
                      <div key={method} className="text-center p-3 bg-gray-50 rounded-lg">
                        <div className="text-lg font-semibold text-ghana-black">₵{amount.toFixed(2)}</div>
                        <div className="text-sm text-gray-600 capitalize">{method}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Top Selling Items */}
                <div>
                  <h4 className="text-lg font-semibold mb-3">Top Selling Items</h4>
                  <div className="space-y-2">
                    {dailySalesReport.topSellingItems.slice(0, 5).map((item, index) => (
                      <div key={item.itemId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <Badge color="primary" variant="flat">{index + 1}</Badge>
                          <span className="font-medium">{item.name}</span>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold">{item.quantity} sold</div>
                          <div className="text-sm text-gray-600">₵{item.revenue.toFixed(2)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardBody>
            </Card>

            {/* Product Mix Report */}
            <Card className="border-0 shadow-lg">
              <CardHeader className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-ghana-black">Product Mix Report - {productMixReport.period}</h3>
                <Button size="sm" variant="flat" onClick={() => exportReport('product-mix', productMixReport)}>
                  Export
                </Button>
              </CardHeader>
              <CardBody>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <h4 className="text-lg font-semibold mb-3">Category Breakdown</h4>
                    <div className="space-y-3">
                      {Object.entries(productMixReport.categoryBreakdown).map(([category, data]) => (
                        <div key={category} className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="font-medium capitalize">{category}</span>
                            <span>₵{data.revenue.toFixed(2)}</span>
                          </div>
                          <Progress 
                            value={data.percentage} 
                            className="w-full"
                            color={data.percentage > 20 ? "success" : data.percentage > 10 ? "warning" : "danger"}
                          />
                          <div className="text-xs text-gray-500 text-right">
                            {data.percentage.toFixed(1)}% of sales
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="md:col-span-2">
                    <h4 className="text-lg font-semibold mb-3">Top Performing Products</h4>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {productMixReport.productPerformance.slice(0, 10).map((product, index) => (
                        <div key={product.itemId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center gap-3">
                            <Badge color="primary" variant="flat">{index + 1}</Badge>
                            <div>
                              <div className="font-medium">{product.name}</div>
                              <div className="text-xs text-gray-500 capitalize">{product.category}</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-semibold">{product.quantity} sold</div>
                            <div className="text-sm text-gray-600">₵{product.revenue.toFixed(2)}</div>
                            <div className="text-xs text-gray-500">{product.percentageOfSales.toFixed(1)}%</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardBody>
            </Card>
          </div>
        </Tab>

        <Tab key="inventory" title="📦 Inventory Management">
          <div className="space-y-6 mt-6">
            {/* Inventory Overview */}
            <Card className="border-0 shadow-lg">
              <CardHeader className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-ghana-black">Inventory Overview</h3>
                <Button size="sm" variant="flat" onClick={() => exportReport('inventory', inventoryReport)}>
                  Export
                </Button>
              </CardHeader>
              <CardBody>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-ghana-black">₵{inventoryReport.totalValue.toFixed(2)}</div>
                    <div className="text-sm text-gray-600">Total Value</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600">{inventoryReport.lowStockItems.length}</div>
                    <div className="text-sm text-gray-600">Low Stock Items</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600">{inventoryReport.expiringItems.length}</div>
                    <div className="text-sm text-gray-600">Expiring Soon</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-ghana-black">{inventoryReport.stockTurnover.toFixed(2)}</div>
                    <div className="text-sm text-gray-600">Stock Turnover</div>
                  </div>
                </div>

                {/* Low Stock Alerts */}
                <div className="mb-6">
                  <h4 className="text-lg font-semibold mb-3 text-orange-600">⚠️ Low Stock Alerts</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {inventoryReport.lowStockItems.slice(0, 6).map(item => (
                      <div key={item.id} className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                        <div className="font-medium text-orange-800">{item.name}</div>
                        <div className="text-sm text-orange-600">
                          Stock: {item.currentStock} {item.unit} (Min: {item.minimumThreshold})
                        </div>
                        <div className="text-xs text-orange-500">Reorder Point: {item.reorderPoint}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Expiring Items */}
                <div>
                  <h4 className="text-lg font-semibold mb-3 text-red-600">🚨 Expiring Soon</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {inventoryReport.expiringItems.slice(0, 6).map(item => (
                      <div key={item.id} className="p-3 bg-red-50 border border-red-200 rounded-lg">
                        <div className="font-medium text-red-800">{item.name}</div>
                        <div className="text-sm text-red-600">
                          Stock: {item.currentStock} {item.unit}
                        </div>
                        <div className="text-xs text-red-500">
                          Expires: {item.expiryDate ? new Date(item.expiryDate).toLocaleDateString() : 'Unknown'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardBody>
            </Card>

            {/* Waste Report */}
            <Card className="border-0 shadow-lg">
              <CardHeader className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-ghana-black">Waste Analysis - {wasteReport.period}</h3>
                <Button size="sm" variant="flat" onClick={() => exportReport('waste', wasteReport)}>
                  Export
                </Button>
              </CardHeader>
              <CardBody>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="text-lg font-semibold mb-3">Waste by Reason</h4>
                    <div className="space-y-3">
                      {Object.entries(wasteReport.wasteByReason).map(([reason, data]) => (
                        <div key={reason} className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="font-medium capitalize">{reason}</span>
                            <span>₵{data.cost.toFixed(2)}</span>
                          </div>
                          <Progress 
                            value={data.percentage} 
                            className="w-full"
                            color="danger"
                          />
                          <div className="text-xs text-gray-500 text-right">
                            {data.percentage.toFixed(1)}% of total waste
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-lg font-semibold mb-3">Top Waste Items</h4>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {wasteReport.wasteByIngredient.slice(0, 8).map((item, index) => (
                        <div key={item.ingredientId} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                          <div className="flex items-center gap-2">
                            <Badge color="danger" variant="flat">{index + 1}</Badge>
                            <span className="font-medium">{item.name}</span>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-medium">₵{item.cost.toFixed(2)}</div>
                            <div className="text-xs text-gray-500 capitalize">{item.reason}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardBody>
            </Card>
          </div>
        </Tab>

        <Tab key="labor" title="👥 Labor Analytics">
          <div className="space-y-6 mt-6">
            {/* Labor Overview */}
            <Card className="border-0 shadow-lg">
              <CardHeader className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-ghana-black">Labor Cost Analysis - {laborReport.period}</h3>
                <Button size="sm" variant="flat" onClick={() => exportReport('labor', laborReport)}>
                  Export
                </Button>
              </CardHeader>
              <CardBody>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-ghana-black">{laborReport.totalHours.toFixed(1)}</div>
                    <div className="text-sm text-gray-600">Total Hours</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">₵{laborReport.totalPay.toFixed(2)}</div>
                    <div className="text-sm text-gray-600">Total Pay</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">₵{laborReport.averageHourlyRate.toFixed(2)}</div>
                    <div className="text-sm text-gray-600">Avg Hourly Rate</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600">{laborReport.laborPercentage.toFixed(1)}%</div>
                    <div className="text-sm text-gray-600">Labor % of Sales</div>
                  </div>
                </div>

                {/* Employee Performance by Role */}
                <div>
                  <h4 className="text-lg font-semibold mb-3">Performance by Role</h4>
                  <div className="space-y-3">
                    {laborReport.employeeBreakdown.map((role) => (
                      <div key={role.employeeId} className="p-4 bg-gray-50 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium">{role.name}</span>
                          <span className="text-lg font-semibold">₵{role.pay.toFixed(2)}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <span className="text-gray-600">Hours:</span>
                            <span className="ml-2 font-medium">{role.hours.toFixed(1)}</span>
                          </div>
                          <div>
                            <span className="text-gray-600">Efficiency:</span>
                            <span className="ml-2 font-medium">{role.efficiency.toFixed(1)}%</span>
                          </div>
                          <div>
                            <span className="text-gray-600">Avg Rate:</span>
                            <span className="ml-2 font-medium">₵{(role.pay / role.hours).toFixed(2)}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardBody>
            </Card>

            {/* Sales by Employee */}
            <Card className="border-0 shadow-lg">
              <CardHeader className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-ghana-black">Sales Performance by Employee - {salesByEmployeeReport.period}</h3>
                <Button size="sm" variant="flat" onClick={() => exportReport('sales-by-employee', salesByEmployeeReport)}>
                  Export
                </Button>
              </CardHeader>
              <CardBody>
                <div className="space-y-3">
                  {salesByEmployeeReport.employeePerformance.map((employee, index) => (
                    <div key={employee.employeeId} className="p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <Badge color="primary" variant="flat">{index + 1}</Badge>
                          <div>
                            <div className="font-medium">{employee.name}</div>
                            <div className="text-sm text-gray-500 capitalize">{employee.role}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-semibold">₵{employee.revenue.toFixed(2)}</div>
                          <div className="text-sm text-gray-600">{employee.orders} orders</div>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-gray-600">Avg Order:</span>
                          <span className="ml-2 font-medium">₵{employee.averageOrderValue.toFixed(2)}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">% of Sales:</span>
                          <span className="ml-2 font-medium">{employee.percentageOfSales.toFixed(1)}%</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Performance:</span>
                          <Chip 
                            color={employee.percentageOfSales > 20 ? "success" : employee.percentageOfSales > 10 ? "warning" : "danger"}
                            variant="flat"
                            size="sm"
                          >
                            {employee.percentageOfSales > 20 ? "High" : employee.percentageOfSales > 10 ? "Medium" : "Low"}
                          </Chip>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>
          </div>
        </Tab>

        <Tab key="customers" title="👥 Customer Analytics">
          <div className="space-y-6 mt-6">
            {/* Customer Overview */}
            <Card className="border-0 shadow-lg">
              <CardHeader className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-ghana-black">Customer Analytics</h3>
                <Button size="sm" variant="flat" onClick={() => exportReport('customer-analytics', customerAnalytics)}>
                  Export
                </Button>
              </CardHeader>
              <CardBody>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-ghana-black">{customerAnalytics.totalCustomers}</div>
                    <div className="text-sm text-gray-600">Total Customers</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{customerAnalytics.activeCustomers}</div>
                    <div className="text-sm text-gray-600">Active Customers</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">{customerAnalytics.customerRetentionRate.toFixed(1)}%</div>
                    <div className="text-sm text-gray-600">Retention Rate</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600">₵{customerAnalytics.averageCustomerLifetimeValue.toFixed(2)}</div>
                    <div className="text-sm text-gray-600">Avg Lifetime Value</div>
                  </div>
                </div>

                {/* Loyalty Tier Distribution */}
                <div className="mb-6">
                  <h4 className="text-lg font-semibold mb-3">Loyalty Tier Distribution</h4>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    {Object.entries(customerAnalytics.loyaltyTierDistribution).map(([tier, count]) => (
                      <div key={tier} className="text-center p-3 bg-gray-50 rounded-lg">
                        <div className="text-lg font-semibold text-ghana-black">{count}</div>
                        <div className="text-sm text-gray-600">{tier}</div>
                        <div className="text-xs text-gray-500">
                          {((count / customerAnalytics.totalCustomers) * 100).toFixed(1)}%
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Top Customers */}
                <div>
                  <h4 className="text-lg font-semibold mb-3">Top Customers by Spending</h4>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {customerAnalytics.topCustomers.map((customer, index) => (
                      <div key={customer.customerId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <Badge color="primary" variant="flat">{index + 1}</Badge>
                          <div>
                            <div className="font-medium">{customer.name}</div>
                            <div className="text-xs text-gray-500">{customer.tier} Tier</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold">₵{customer.totalSpent.toFixed(2)}</div>
                          <div className="text-sm text-gray-600">{customer.visitCount} visits</div>
                          <div className="text-xs text-gray-500">{customer.loyaltyPoints} points</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardBody>
            </Card>
          </div>
        </Tab>

        <Tab key="suppliers" title="🏭 Supplier Analytics">
          <div className="space-y-6 mt-6">
            {/* Supplier Overview */}
            <Card className="border-0 shadow-lg">
              <CardHeader className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-ghana-black">Supplier Performance</h3>
                <Button size="sm" variant="flat" onClick={() => exportReport('supplier-analytics', supplierAnalytics)}>
                  Export
                </Button>
              </CardHeader>
              <CardBody>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-ghana-black">{supplierAnalytics.totalSuppliers}</div>
                    <div className="text-sm text-gray-600">Total Suppliers</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{supplierAnalytics.activeSuppliers}</div>
                    <div className="text-sm text-gray-600">Active Suppliers</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">{supplierAnalytics.averageRating.toFixed(1)}</div>
                    <div className="text-sm text-gray-600">Avg Rating</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600">{supplierAnalytics.topProductCategory}</div>
                    <div className="text-sm text-gray-600">Top Category</div>
                  </div>
                </div>

                {/* Rating Distribution */}
                <div className="mb-6">
                  <h4 className="text-lg font-semibold mb-3">Supplier Rating Distribution</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {Object.entries(supplierAnalytics.supplierDistribution).map(([rating, count]) => (
                      <div key={rating} className="text-center p-3 bg-gray-50 rounded-lg">
                        <div className="text-lg font-semibold text-ghana-black">{count}</div>
                        <div className="text-sm text-gray-600">{rating}</div>
                        <div className="text-xs text-gray-500">
                          {((count / supplierAnalytics.totalSuppliers) * 100).toFixed(1)}%
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Top Rated Suppliers */}
                <div>
                  <h4 className="text-lg font-semibold mb-3">Top Rated Suppliers</h4>
                  <div className="space-y-3">
                    {supplierAnalytics.topRatedSuppliers.map((supplier, index) => (
                      <div key={supplier.supplierId} className="p-4 bg-gray-50 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-3">
                            <Badge color="primary" variant="flat">{index + 1}</Badge>
                            <div>
                              <div className="font-medium">{supplier.name}</div>
                              <div className="text-sm text-gray-500">{supplier.contactPerson}</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-semibold">{supplier.rating}/5</div>
                            <Chip 
                              color={supplier.rating >= 4.5 ? "success" : supplier.rating >= 4.0 ? "warning" : "danger"}
                              variant="flat"
                              size="sm"
                            >
                              {supplier.rating >= 4.5 ? "Excellent" : supplier.rating >= 4.0 ? "Good" : "Fair"}
                            </Chip>
                          </div>
                        </div>
                        <div className="text-sm text-gray-600">
                          <span className="font-medium">Products:</span> {supplier.products.join(', ')}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardBody>
            </Card>
          </div>
        </Tab>

        <Tab key="performance" title="📊 Performance Metrics">
          <div className="space-y-6 mt-6">
            {/* Performance KPIs */}
            <Card className="border-0 shadow-lg">
              <CardHeader className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-ghana-black">Key Performance Indicators</h3>
                <Button size="sm" variant="flat" onClick={() => exportReport('performance-metrics', {})}>
                  Export
                </Button>
              </CardHeader>
              <CardBody>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  {/* Today's Orders */}
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <span className="text-2xl">📊</span>
                      <span className="text-sm font-medium text-gray-600">Today's Orders</span>
                    </div>
                    <div className="text-2xl font-bold text-ghana-black mb-2">0</div>
                    <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                      <span>Target: 50</span>
                    </div>
                    <Progress value={0} color="success" size="sm" />
                  </div>

                  {/* Active Orders */}
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <span className="text-2xl">🔄</span>
                      <span className="text-sm font-medium text-gray-600">Active Orders</span>
                    </div>
                    <div className="text-2xl font-bold text-ghana-black mb-2">0</div>
                    <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                      <span>Target: 20</span>
                    </div>
                    <Progress value={0} color="primary" size="sm" />
                  </div>

                  {/* Today's Revenue */}
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <span className="text-2xl">💰</span>
                      <span className="text-sm font-medium text-gray-600">Today's Revenue</span>
                    </div>
                    <div className="text-2xl font-bold text-ghana-black mb-2">₵0.00</div>
                    <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                      <span>Target: ₵2,500</span>
                    </div>
                    <Progress value={0} color="secondary" size="sm" />
                  </div>

                  {/* Avg Order Value */}
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <span className="text-2xl">📈</span>
                      <span className="text-sm font-medium text-gray-600">Avg Order Value</span>
                    </div>
                    <div className="text-2xl font-bold text-ghana-black mb-2">₵0.00</div>
                    <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                      <span>Target: ₵50</span>
                    </div>
                    <Progress value={0} color="warning" size="sm" />
                  </div>
                </div>
              </CardBody>
            </Card>

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
    </div>
  );
}
