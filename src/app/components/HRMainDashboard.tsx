'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  Card, 
  CardBody, 
  CardHeader, 
  Button, 
  Badge, 
  Tabs, 
  Tab, 
  Chip,
  Progress,
  Avatar,
  Tooltip,
  Divider
} from "@heroui/react";
import { trackEvent } from '../lib/analytics/trackEvent';
import { useRouter } from 'next/navigation';
import DeptNotices from './DeptNotices';
import DeptMessenger from './DeptMessenger';

// Import specialized HR components
import HRAnalyticsDashboard from './HRAnalyticsDashboard';
import RecentActivities from './RecentActivities';

// Info Icon Component with Tooltip
const InfoIcon = ({ description }: { description: string }) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      setShowTooltip(true);
    }, 2000); // 2 second delay
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setShowTooltip(false);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <Tooltip
      content={description}
      isOpen={showTooltip}
      onOpenChange={setShowTooltip}
      placement="top"
      showArrow
      color="primary"
      delay={0}
    >
      <div
        className="inline-flex items-center justify-center w-4 h-4 mr-2 text-xs text-blue-500 bg-blue-100 rounded-full cursor-help hover:bg-blue-200 transition-colors"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        title={description}
      >
        ℹ
      </div>
    </Tooltip>
  );
};

export default function HRMainDashboard() {
  const [selectedTab, setSelectedTab] = useState('overview');
  const router = useRouter();
  
  // Sample HR data - in real app, this would come from stores
  const totalEmployees = 128;
  const activeEmployees = 115;
  const onLeaveEmployees = 8;
  const terminatedEmployees = 5;
  
  // Payroll data
  const monthlyPayroll = 186450;
  const pendingPayroll = 45230;
  const processedPayroll = 141220;
  
  // Leave data
  const pendingLeaveRequests = 12;
  const approvedLeaveRequests = 8;
  const rejectedLeaveRequests = 3;
  
  // Performance data
  const performanceReviews = 45;
  const pendingReviews = 23;
  const completedReviews = 22;
  
  // Compliance data
  const complianceScore = 92;
  const taxCompliance = 88;
  const ssnitCompliance = 95;
  const laborCompliance = 89;

  // Today's operations
  const today = new Date().toISOString().slice(0, 10);
  const newHiresToday = 2;
  const terminationsToday = 0;
  const payrollProcessedToday = 15;

  // Operational items following the uniform pattern
  const operationalItems = [
    {
      category: 'Employee Management',
      items: [
        { title: 'Employee Records', icon: '👥', description: 'Complete employee database and profiles', status: 'active', count: totalEmployees },
        { title: 'New Hires', icon: '📝', description: 'Onboarding and recruitment management', status: 'active', count: newHiresToday },
        { title: 'Employee Changes', icon: '🔄', description: 'Promotions, transfers, and updates', status: 'active', count: 5 },
        { title: 'Performance Reviews', icon: '📊', description: 'Employee evaluation and feedback', status: 'active', count: pendingReviews },
      ]
    },
    {
      category: 'Payroll & Benefits',
      items: [
        { title: 'Payroll Processing', icon: '💰', description: 'Salary calculation and payment', status: 'active', count: payrollProcessedToday },
        { title: 'Payslip Generation', icon: '🧾', description: 'Employee payment documentation', status: 'active', count: 0 },
        { title: 'Benefits Management', icon: '💳', description: 'Health, insurance, and perks', status: 'active', count: 8 },
        { title: 'Salary Analytics', icon: '📈', description: 'Compensation analysis and planning', status: 'active', count: 0 },
      ]
    },
    {
      category: 'Leave & Attendance',
      items: [
        { title: 'Leave Management', icon: '🌴', description: 'Vacation and time-off requests', status: 'active', count: pendingLeaveRequests },
        { title: 'Time Tracking', icon: '⏰', description: 'Work hours and attendance monitoring', status: 'active', count: activeEmployees },
        { title: 'Shift Scheduling', icon: '📅', description: 'Work schedule management', status: 'active', count: 3 },
        { title: 'Overtime Management', icon: '🚨', description: 'Extra hours tracking and approval', status: 'active', count: 25 },
      ]
    },
    {
      category: 'Compliance & Training',
      items: [
        { title: 'Tax Compliance', icon: '📋', description: 'PAYE, SSNIT, and tax reporting', status: 'active', count: taxCompliance },
        { title: 'Training Programs', icon: '🎓', description: 'Employee development and skills', status: 'active', count: 12 },
        { title: 'Labor Compliance', icon: '🔒', description: 'Ghana labor law adherence', status: 'active', count: laborCompliance },
        { title: 'Compliance Reports', icon: '📊', description: 'Regulatory reporting and audits', status: 'active', count: 0 },
      ]
    }
  ];

  // Quick action handlers
  const handleQuickAction = (action: string) => {
    trackEvent('HR.QuickAction', { action });
    
    switch (action) {
      case 'new-hire':
        setSelectedTab('employees');
        break;
      case 'run-payroll':
        setSelectedTab('payroll');
        break;
      case 'leave-request':
        setSelectedTab('leave');
        break;
      case 'performance-review':
        setSelectedTab('performance');
        break;
      case 'compliance-report':
        setSelectedTab('compliance');
        break;
    }
  };

  const quickActions = [
    { 
      title: 'New Hire', 
      icon: '➕', 
      color: 'primary', 
      action: 'new-hire',
      description: 'Add new employee'
    },
    { 
      title: 'Run Payroll', 
      icon: '💸', 
      color: 'secondary', 
      action: 'run-payroll',
      description: 'Process monthly payroll'
    },
    { 
      title: 'Leave Request', 
      icon: '🌴', 
      color: 'success', 
      action: 'leave-request',
      description: 'Approve leave requests'
    },
    { 
      title: 'Performance Review', 
      icon: '📊', 
      color: 'warning', 
      action: 'performance-review',
      description: 'Conduct reviews'
    },
    { 
      title: 'Compliance Report', 
      icon: '📋', 
      color: 'default', 
      action: 'compliance-report',
      description: 'Generate reports'
    }
  ];

  const kpis = [
    { 
      label: 'Total Employees', 
      value: totalEmployees, 
      target: 150, 
      color: 'success',
      icon: '👥'
    },
    { 
      label: 'Active Employees', 
      value: activeEmployees, 
      target: 140, 
      color: 'primary',
      icon: '✅'
    },
    { 
      label: 'Monthly Payroll', 
      value: `₵${(monthlyPayroll / 1000).toFixed(0)}K`, 
      target: 200, 
      color: 'secondary',
      icon: '💰'
    },
    { 
      label: 'Compliance Score', 
      value: `${complianceScore}%`, 
      target: 95, 
      color: 'warning',
      icon: '📊'
    }
  ];

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-ghana-black">👥 HR & Payroll</h2>
        <div className="flex items-center gap-2">
          <Badge color="success" variant="flat">System Online</Badge>
          <Badge color="primary" variant="flat">Ghana Compliant</Badge>
        </div>
      </div>

      {/* Employee Status Overview - Following Uniform Pattern */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold text-ghana-black flex items-center gap-2">
            📊 Employee Status Overview ({totalEmployees} Total Employees)
          </h3>
        </div>
        
        {/* Status Cards - Matching Uniform Design */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          {/* Active Employees */}
          <Card className="border-0 shadow-lg border-l-4 border-l-green-500">
            <CardBody className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-lg font-semibold text-ghana-black">Active Employees</h4>
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              </div>
              <div className="text-3xl font-bold text-green-600 mb-3">{activeEmployees}</div>
              <div className="space-y-1 text-sm text-gray-600">
                <div className="flex justify-between">
                  <span>Full-time</span>
                  <span className="font-medium">98</span>
                </div>
                <div className="flex justify-between">
                  <span>Part-time</span>
                  <span className="font-medium">12</span>
                </div>
                <div className="flex justify-between">
                  <span>Contract</span>
                  <span className="font-medium">5</span>
                </div>
              </div>
            </CardBody>
          </Card>

          {/* On Leave */}
          <Card className="border-0 shadow-lg border-l-4 border-l-orange-500">
            <CardBody className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-lg font-semibold text-ghana-black">On Leave</h4>
                <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
              </div>
              <div className="text-3xl font-bold text-orange-600 mb-3">{onLeaveEmployees}</div>
              <div className="space-y-1 text-sm text-gray-600">
                <div className="flex justify-between">
                  <span>Vacation</span>
                  <span className="font-medium">5</span>
                </div>
                <div className="flex justify-between">
                  <span>Sick Leave</span>
                  <span className="font-medium">2</span>
                </div>
                <div className="flex justify-between">
                  <span>Maternity</span>
                  <span className="font-medium">1</span>
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Payroll Status */}
          <Card className="border-0 shadow-lg border-l-4 border-l-blue-500">
            <CardBody className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-lg font-semibold text-ghana-black">Payroll Status</h4>
                <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
              </div>
              <div className="text-3xl font-bold text-blue-600 mb-3">₵{(monthlyPayroll / 1000).toFixed(0)}K</div>
              <div className="space-y-1 text-sm text-gray-600">
                <div className="flex justify-between">
                  <span>Processed</span>
                  <span className="font-medium">₵{(processedPayroll / 1000).toFixed(0)}K</span>
                </div>
                <div className="flex justify-between">
                  <span>Pending</span>
                  <span className="font-medium">₵{(pendingPayroll / 1000).toFixed(0)}K</span>
                </div>
                <div className="flex justify-between">
                  <span>This Month</span>
                  <span className="font-medium">₵{(monthlyPayroll / 1000).toFixed(0)}K</span>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>

        {/* Today's Operations - Matching Uniform Pattern */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-lg">📅</span>
              <h4 className="text-lg font-semibold text-ghana-black">Today's Operations</h4>
            </div>
            <div className="flex items-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-green-600 font-medium">{newHiresToday} New Hires</span>
                <span className="text-gray-500">Added today</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-blue-600 font-medium">{payrollProcessedToday} Payroll</span>
                <span className="text-gray-500">Processed today</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-orange-600 font-medium">{pendingLeaveRequests} Leave</span>
                <span className="text-gray-500">Pending approval</span>
              </div>
            </div>
          </div>
          <Button 
            color="success" 
            variant="solid"
            className="bg-green-600 hover:bg-green-700"
            onClick={() => setSelectedTab('employees')}
          >
            👥 Manage Employees
          </Button>
        </div>
      </div>

      {/* Quick Actions */}
      <Card className="border-0 shadow-lg mb-6">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">🚀</span>
            <h3 className="text-lg font-semibold text-ghana-black">Quick Actions</h3>
          </div>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {quickActions.map((action) => (
              <Button
                key={action.action}
                color={action.color as any}
                variant="flat"
                className="h-24 flex flex-col items-center justify-center gap-2 p-4"
                onClick={() => handleQuickAction(action.action)}
              >
                <span className="text-2xl">{action.icon}</span>
                <span className="font-medium">{action.title}</span>
                <span className="text-xs text-center opacity-80">{action.description}</span>
              </Button>
            ))}
          </div>
        </CardBody>
      </Card>



      {/* Main Operations Interface - Following Uniform Pattern */}
      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-3">
          <h3 className="text-xl font-semibold text-ghana-black">📊 Operations Overview</h3>
        </CardHeader>
        <CardBody>
          <Tabs 
            selectedKey={selectedTab} 
            onSelectionChange={(key) => setSelectedTab(key as string)}
            className="w-full"
            aria-label="HR operations"
          >
            <Tab key="overview" title="📊 Overview">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-4">
                {operationalItems.map((category, categoryIndex) => (
                  <Card key={categoryIndex} className="border border-gray-200 shadow-md">
                    <CardHeader className="pb-3">
                      <h4 className="text-lg font-semibold text-ghana-black">{category.category}</h4>
                    </CardHeader>
                    <CardBody className="pt-0">
                      <div className="space-y-3">
                        {category.items.map((item, itemIndex) => (
                          <div 
                            key={itemIndex}
                            className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-ghana-gold/10 cursor-pointer transition-colors"
                            onClick={() => {
                              // Handle navigation based on item type
                              if (item.title.includes('Employee Records') || item.title.includes('New Hires')) {
                                setSelectedTab('employees');
                              } else if (item.title.includes('Payroll Processing') || item.title.includes('Payslip')) {
                                setSelectedTab('payroll');
                              } else if (item.title.includes('Leave Management') || item.title.includes('Time Tracking')) {
                                setSelectedTab('leave');
                              } else if (item.title.includes('Performance Reviews')) {
                                setSelectedTab('performance');
                              } else if (item.title.includes('Tax Compliance') || item.title.includes('Labor Compliance')) {
                                setSelectedTab('compliance');
                              }
                            }}
                          >
                            <div className="flex items-center space-x-3">
                              <span className="text-xl">{item.icon}</span>
                              <div>
                                <div className="flex items-center">
                                  <InfoIcon description={item.description} />
                                  <p className="font-medium text-ghana-black">{item.title}</p>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Badge 
                                color={item.status === 'active' ? 'success' : 'default'}
                                variant="flat"
                              >
                                {item.status}
                              </Badge>
                              <Chip size="sm" variant="flat" color="primary">
                                {item.count}
                              </Chip>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardBody>
                  </Card>
                ))}
              </div>
            </Tab>

            <Tab key="employees" title="👥 Employee Management">
              <div className="p-6">
                <h4 className="text-lg font-semibold text-ghana-black mb-4">Employee Management Dashboard</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card className="border border-gray-200">
                    <CardHeader>
                      <h5 className="font-medium">Quick Actions</h5>
                    </CardHeader>
                    <CardBody>
                      <div className="space-y-3">
                        <Button color="primary" variant="flat" className="w-full">
                          📝 Add New Employee
                        </Button>
                        <Button color="secondary" variant="flat" className="w-full">
                          🔍 Search Employees
                        </Button>
                        <Button color="success" variant="flat" className="w-full">
                          📊 Employee Reports
                        </Button>
                      </div>
                    </CardBody>
                  </Card>
                  <Card className="border border-gray-200">
                    <CardHeader>
                      <h5 className="font-medium">Employee Statistics</h5>
                    </CardHeader>
                    <CardBody>
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span>Total Employees:</span>
                          <Badge color="primary">{totalEmployees}</Badge>
                        </div>
                        <div className="flex justify-between">
                          <span>Active:</span>
                          <Badge color="success">{activeEmployees}</Badge>
                        </div>
                        <div className="flex justify-between">
                          <span>On Leave:</span>
                          <Badge color="warning">{onLeaveEmployees}</Badge>
                        </div>
                      </div>
                    </CardBody>
                  </Card>
                </div>
              </div>
            </Tab>

            <Tab key="payroll" title="💰 Payroll Management">
              <div className="p-6">
                <h4 className="text-lg font-semibold text-ghana-black mb-4">Payroll Management Dashboard</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card className="border border-gray-200">
                    <CardHeader>
                      <h5 className="font-medium">Payroll Status</h5>
                    </CardHeader>
                    <CardBody>
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span>Monthly Payroll:</span>
                          <Badge color="primary">₵{monthlyPayroll.toLocaleString()}</Badge>
                        </div>
                        <div className="flex justify-between">
                          <span>Pending:</span>
                          <Badge color="warning">₵{pendingPayroll.toLocaleString()}</Badge>
                        </div>
                        <div className="flex justify-between">
                          <span>Processed:</span>
                          <Badge color="success">₵{processedPayroll.toLocaleString()}</Badge>
                        </div>
                      </div>
                    </CardBody>
                  </Card>
                  <Card className="border border-gray-200">
                    <CardHeader>
                      <h5 className="font-medium">Quick Actions</h5>
                    </CardHeader>
                    <CardBody>
                      <div className="space-y-3">
                        <Button color="primary" variant="flat" className="w-full">
                          💰 Process Payroll
                        </Button>
                        <Button color="secondary" variant="flat" className="w-full">
                          🧾 Generate Payslips
                        </Button>
                        <Button color="success" variant="flat" className="w-full">
                          📊 Payroll Reports
                        </Button>
                      </div>
                    </CardBody>
                  </Card>
                </div>
              </div>
            </Tab>

            <Tab key="leave" title="🌴 Leave Management">
              <div className="p-6">
                <h4 className="text-lg font-semibold text-ghana-black mb-4">Leave Management Dashboard</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card className="border border-gray-200">
                    <CardHeader>
                      <h5 className="font-medium">Leave Requests</h5>
                    </CardHeader>
                    <CardBody>
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span>Pending:</span>
                          <Badge color="warning">{pendingLeaveRequests}</Badge>
                        </div>
                        <div className="flex justify-between">
                          <span>Approved:</span>
                          <Badge color="success">{approvedLeaveRequests}</Badge>
                        </div>
                        <div className="flex justify-between">
                          <span>Rejected:</span>
                          <Badge color="danger">{rejectedLeaveRequests}</Badge>
                        </div>
                      </div>
                    </CardBody>
                  </Card>
                  <Card className="border border-gray-200">
                    <CardHeader>
                      <h5 className="font-medium">Quick Actions</h5>
                    </CardHeader>
                    <CardBody>
                      <div className="space-y-3">
                        <Button color="primary" variant="flat" className="w-full">
                          🌴 New Leave Request
                        </Button>
                        <Button color="secondary" variant="flat" className="w-full">
                          📅 Leave Calendar
                        </Button>
                        <Button color="success" variant="flat" className="w-full">
                          📊 Leave Reports
                        </Button>
                      </div>
                    </CardBody>
                  </Card>
                </div>
              </div>
            </Tab>

            <Tab key="performance" title="📊 Performance Management">
              <div className="p-6">
                <h4 className="text-lg font-semibold text-ghana-black mb-4">Performance Management Dashboard</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card className="border border-gray-200">
                    <CardHeader>
                      <h5 className="font-medium">Review Status</h5>
                    </CardHeader>
                    <CardBody>
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span>Total Reviews:</span>
                          <Badge color="primary">{performanceReviews}</Badge>
                        </div>
                        <div className="flex justify-between">
                          <span>Pending:</span>
                          <Badge color="warning">{pendingReviews}</Badge>
                        </div>
                        <div className="flex justify-between">
                          <span>Completed:</span>
                          <Badge color="success">{completedReviews}</Badge>
                        </div>
                      </div>
                    </CardBody>
                  </Card>
                  <Card className="border border-gray-200">
                    <CardHeader>
                      <h5 className="font-medium">Quick Actions</h5>
                    </CardHeader>
                    <CardBody>
                      <div className="space-y-3">
                        <Button color="primary" variant="flat" className="w-full">
                          📊 New Performance Review
                        </Button>
                        <Button color="secondary" variant="flat" className="w-full">
                          🎯 Set Goals
                        </Button>
                        <Button color="success" variant="flat" className="w-full">
                          📈 Performance Reports
                        </Button>
                      </div>
                    </CardBody>
                  </Card>
                </div>
              </div>
            </Tab>

            <Tab key="compliance" title="📋 Compliance & Training">
              <div className="p-6">
                <h4 className="text-lg font-semibold text-ghana-black mb-4">Compliance & Training Dashboard</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card className="border border-gray-200">
                    <CardHeader>
                      <h5 className="font-medium">Compliance Scores</h5>
                    </CardHeader>
                    <CardBody>
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span>Overall:</span>
                          <Badge color="success">{complianceScore}%</Badge>
                        </div>
                        <div className="flex justify-between">
                          <span>Tax:</span>
                          <Badge color={taxCompliance >= 90 ? 'success' : taxCompliance >= 80 ? 'warning' : 'danger'}>{taxCompliance}%</Badge>
                        </div>
                        <div className="flex justify-between">
                          <span>SSNIT:</span>
                          <Badge color={ssnitCompliance >= 90 ? 'success' : ssnitCompliance >= 80 ? 'warning' : 'danger'}>{ssnitCompliance}%</Badge>
                        </div>
                        <div className="flex justify-between">
                          <span>Labor:</span>
                          <Badge color={laborCompliance >= 90 ? 'success' : laborCompliance >= 80 ? 'warning' : 'danger'}>{laborCompliance}%</Badge>
                        </div>
                      </div>
                    </CardBody>
                  </Card>
                  <Card className="border border-gray-200">
                    <CardHeader>
                      <h5 className="font-medium">Quick Actions</h5>
                    </CardHeader>
                    <CardBody>
                      <div className="space-y-3">
                        <Button color="primary" variant="flat" className="w-full">
                          📋 Compliance Check
                        </Button>
                        <Button color="secondary" variant="flat" className="w-full">
                          🎓 Training Programs
                        </Button>
                        <Button color="success" variant="flat" className="w-full">
                          📊 Compliance Reports
                        </Button>
                      </div>
                    </CardBody>
                  </Card>
                </div>
              </div>
            </Tab>

            <Tab key="analytics" title="📈 HR Analytics">
              <HRAnalyticsDashboard />
            </Tab>
          </Tabs>
        </CardBody>
      </Card>

      <DeptMessenger from="hr" mode="drawer" />

      {/* Recent Activities & Notices */}
      <div className="mt-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Activities */}
          <Card className="border-0 shadow-lg">
            <CardHeader className="pb-3">
              <h3 className="text-xl font-semibold text-ghana-black">📋 Recent Activities</h3>
            </CardHeader>
            <CardBody>
              <RecentActivities area="hr" />
            </CardBody>
          </Card>

          {/* HR Notices */}
          <Card className="border-0 shadow-lg">
            <CardHeader className="pb-3">
              <h3 className="text-xl font-semibold text-ghana-black">🔔 HR Notices</h3>
            </CardHeader>
            <CardBody>
              <DeptNotices dept="hr" title="" defaultTab="alerts" />
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
