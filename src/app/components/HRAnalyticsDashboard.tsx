'use client';

import React, { useState, useMemo } from 'react';
import { 
  Card, CardBody, CardHeader, Tabs, Tab, Button, Input, Select, SelectItem, 
  Progress, Chip, Badge, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell,
  Divider
} from "@heroui/react";
import { useEmployeeStore } from '../lib/hr/employeeStore';
import { usePayrollStore } from '../lib/hr/payrollStore';

export default function HRAnalyticsDashboard() {
  const [selectedPeriod, setSelectedPeriod] = useState<'daily' | 'weekly' | 'monthly'>('monthly');
  const [startDate, setStartDate] = useState(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
  const [endDate, setEndDate] = useState(new Date());

  const employeeStore = useEmployeeStore();
  const payrollStore = usePayrollStore();

  // Generate reports using useMemo for performance
  const employeeAnalytics = useMemo(() => 
    employeeStore.getEmployeeAnalytics(selectedPeriod), [selectedPeriod, employeeStore]
  );

  const payrollAnalytics = useMemo(() => 
    payrollStore.getPayrollAnalytics(selectedPeriod), [selectedPeriod, payrollStore]
  );

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">👥 HR & Payroll Analytics Dashboard</h1>
        <p className="text-gray-600 mt-2">
          Comprehensive human resources monitoring, employee analytics, and payroll management
        </p>
      </div>

      {/* Period Selection */}
      <div className="mb-6 flex gap-4 items-center">
        <Select
          placeholder="Select Period"
          selectedKeys={[selectedPeriod]}
          onSelectionChange={(keys) => setSelectedPeriod(Array.from(keys)[0] as 'daily' | 'weekly' | 'monthly')}
          className="w-40"
        >
          <SelectItem key="daily">Daily</SelectItem>
          <SelectItem key="weekly">Weekly</SelectItem>
          <SelectItem key="monthly">Monthly</SelectItem>
        </Select>
        
        <Input
          type="date"
          value={startDate.toISOString().split('T')[0]}
          onChange={(e) => setStartDate(new Date(e.target.value))}
          className="w-40"
        />
        
        <Input
          type="date"
          value={endDate.toISOString().split('T')[0]}
          onChange={(e) => setEndDate(new Date(e.target.value))}
          className="w-40"
        />
      </div>

      <Card>
        <CardBody className="p-0">
          <Tabs 
            selectedKey="overview" 
            className="w-full"
          >
            <Tab key="overview" title="📊 Overview">
              <div className="p-6">
                {/* Key Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                  <Card>
                    <CardBody className="text-center">
                      <div className="text-2xl font-bold text-blue-600">{employeeAnalytics.totalEmployees}</div>
                      <div className="text-sm text-gray-600">Total Employees</div>
                      <Progress 
                        value={(employeeAnalytics.activeEmployees / employeeAnalytics.totalEmployees) * 100} 
                        size="sm" 
                        color="success"
                        className="mt-2"
                      />
                    </CardBody>
                  </Card>
                  
                  <Card>
                    <CardBody className="text-center">
                      <div className="text-2xl font-bold text-green-600">₵{payrollAnalytics.totalPayroll.toLocaleString()}</div>
                      <div className="text-sm text-gray-600">Total Payroll</div>
                      <Progress 
                        value={100} 
                        size="sm" 
                        color="success"
                        className="mt-2"
                      />
                    </CardBody>
                  </Card>
                  
                  <Card>
                    <CardBody className="text-center">
                      <div className="text-2xl font-bold text-purple-600">₵{employeeAnalytics.averageSalary.toLocaleString()}</div>
                      <div className="text-sm text-gray-600">Average Salary</div>
                      <Progress 
                        value={100} 
                        size="sm" 
                        color="success"
                        className="mt-2"
                      />
                    </CardBody>
                  </Card>
                  
                  <Card>
                    <CardBody className="text-center">
                      <div className="text-2xl font-bold text-orange-600">{employeeAnalytics.turnoverRate.toFixed(1)}%</div>
                      <div className="text-sm text-gray-600">Turnover Rate</div>
                      <Progress 
                        value={100 - employeeAnalytics.turnoverRate} 
                        size="sm" 
                        color={employeeAnalytics.turnoverRate < 10 ? "success" : employeeAnalytics.turnoverRate < 20 ? "warning" : "danger"}
                        className="mt-2"
                      />
                    </CardBody>
                  </Card>
                </div>

                {/* HR Status Summary */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <h3 className="text-lg font-semibold">👥 Employee Status</h3>
                    </CardHeader>
                    <CardBody>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span>Active Employees</span>
                          <Badge color="success">{employeeAnalytics.activeEmployees}</Badge>
                        </div>
                        <div className="flex justify-between items-center">
                          <span>On Leave</span>
                          <Badge color="warning">{employeeStore.getEmployeesOnLeave().length}</Badge>
                        </div>
                        <div className="flex justify-between items-center">
                          <span>Terminated</span>
                          <Badge color="danger">{employeeAnalytics.terminations}</Badge>
                        </div>
                      </div>
                    </CardBody>
                  </Card>

                  <Card>
                    <CardHeader>
                      <h3 className="text-lg font-semibold">💰 Payroll Status</h3>
                    </CardHeader>
                    <CardBody>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span>Total Payroll</span>
                          <span className="font-medium">₵{payrollAnalytics.totalPayroll.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span>Total Deductions</span>
                          <span className="font-medium">₵{payrollAnalytics.totalDeductions.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span>Average Salary</span>
                          <span className="font-medium">₵{payrollAnalytics.averageSalary.toLocaleString()}</span>
                        </div>
                      </div>
                    </CardBody>
                  </Card>
                </div>
              </div>
            </Tab>
            
            <Tab key="employees" title="👥 Employee Reports">
              <div className="p-6">
                <h3 className="text-lg font-semibold mb-4">Employee Analytics</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <Card>
                    <CardBody className="text-center">
                      <div className="text-2xl font-bold text-blue-600">{employeeAnalytics.totalEmployees}</div>
                      <div className="text-sm text-gray-600">Total Employees</div>
                    </CardBody>
                  </Card>
                  
                  <Card>
                    <CardBody className="text-center">
                      <div className="text-2xl font-bold text-green-600">{employeeAnalytics.newHires}</div>
                      <div className="text-sm text-gray-600">New Hires</div>
                    </CardBody>
                  </Card>
                  
                  <Card>
                    <CardBody className="text-center">
                      <div className="text-2xl font-bold text-red-600">{employeeAnalytics.turnoverRate.toFixed(1)}%</div>
                      <div className="text-sm text-gray-600">Turnover Rate</div>
                    </CardBody>
                  </Card>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <h4 className="text-md font-semibold">Employees by Department</h4>
                    </CardHeader>
                    <CardBody>
                      {Object.entries(employeeAnalytics.employeesByDepartment).map(([department, count]) => (
                        <div key={department} className="flex justify-between items-center py-2">
                          <span>{department}</span>
                          <span className="font-medium">{count}</span>
                        </div>
                      ))}
                    </CardBody>
                  </Card>
                  
                  <Card>
                    <CardHeader>
                      <h4 className="text-md font-semibold">Employees by Position</h4>
                    </CardHeader>
                    <CardBody>
                      {Object.entries(employeeAnalytics.employeesByPosition).map(([position, count]) => (
                        <div key={position} className="flex justify-between items-center py-2">
                          <span>{position}</span>
                          <span className="font-medium">{count}</span>
                        </div>
                      ))}
                    </CardBody>
                  </Card>
                </div>
              </div>
            </Tab>
            
            <Tab key="payroll" title="💰 Payroll Reports">
              <div className="p-6">
                <h3 className="text-lg font-semibold mb-4">Payroll Analytics</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                  <Card>
                    <CardBody className="text-center">
                      <div className="text-2xl font-bold text-blue-600">₵{payrollAnalytics.totalPayroll.toLocaleString()}</div>
                      <div className="text-sm text-gray-600">Total Payroll</div>
                    </CardBody>
                  </Card>
                  
                  <Card>
                    <CardBody className="text-center">
                      <div className="text-2xl font-bold text-green-600">₵{payrollAnalytics.totalGrossPay.toLocaleString()}</div>
                      <div className="text-sm text-gray-600">Gross Pay</div>
                    </CardBody>
                  </Card>
                  
                  <Card>
                    <CardBody className="text-center">
                      <div className="text-2xl font-bold text-red-600">₵{payrollAnalytics.totalDeductions.toLocaleString()}</div>
                      <div className="text-sm text-gray-600">Total Deductions</div>
                    </CardBody>
                  </Card>
                  
                  <Card>
                    <CardBody className="text-center">
                      <div className="text-2xl font-bold text-purple-600">₵{payrollAnalytics.averageSalary.toLocaleString()}</div>
                      <div className="text-sm text-gray-600">Average Salary</div>
                    </CardBody>
                  </Card>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <h4 className="text-md font-semibold">Payroll by Department</h4>
                    </CardHeader>
                    <CardBody>
                      {Object.entries(payrollAnalytics.payrollByDepartment).map(([department, amount]) => (
                        <div key={department} className="flex justify-between items-center py-2">
                          <span>{department}</span>
                          <span className="font-medium">₵{amount.toLocaleString()}</span>
                        </div>
                      ))}
                    </CardBody>
                  </Card>
                  
                  <Card>
                    <CardHeader>
                      <h4 className="text-md font-semibold">Deductions Breakdown</h4>
                    </CardHeader>
                    <CardBody>
                      {Object.entries(payrollAnalytics.deductionsBreakdown).map(([type, amount]) => (
                        <div key={type} className="flex justify-between items-center py-2">
                          <span className="capitalize">{type.replace(/([A-Z])/g, ' $1')}</span>
                          <span className="font-medium">₵{amount.toLocaleString()}</span>
                        </div>
                      ))}
                    </CardBody>
                  </Card>
                </div>
              </div>
            </Tab>

            <Tab key="performance" title="📊 Performance Metrics">
              <div className="p-6">
                <h3 className="text-lg font-semibold mb-4">Key Performance Indicators</h3>
                
                {/* Performance KPIs */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
                  {/* Employee Turnover */}
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <span className="text-2xl">👥</span>
                      <span className="text-sm font-medium text-gray-600">Employee Turnover</span>
                    </div>
                    <div className="text-2xl font-bold text-ghana-black mb-2">0%</div>
                    <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                      <span>Target: &lt;5%</span>
                    </div>
                    <Progress value={0} color="success" size="sm" />
                  </div>

                  {/* Payroll Accuracy */}
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <span className="text-2xl">💰</span>
                      <span className="text-sm font-medium text-gray-600">Payroll Accuracy</span>
                    </div>
                    <div className="text-2xl font-bold text-ghana-black mb-2">0%</div>
                    <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                      <span>Target: 99%</span>
                    </div>
                    <Progress value={0} color="primary" size="sm" />
                  </div>

                  {/* Compliance Score */}
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <span className="text-2xl">📋</span>
                      <span className="text-sm font-medium text-gray-600">Compliance Score</span>
                    </div>
                    <div className="text-2xl font-bold text-ghana-black mb-2">0%</div>
                    <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                      <span>Target: 95%</span>
                    </div>
                    <Progress value={0} color="secondary" size="sm" />
                  </div>

                  {/* Training Completion */}
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <span className="text-2xl">🎓</span>
                      <span className="text-sm font-medium text-gray-600">Training Completion</span>
                    </div>
                    <div className="text-2xl font-bold text-ghana-black mb-2">0%</div>
                    <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                      <span>Target: 90%</span>
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
