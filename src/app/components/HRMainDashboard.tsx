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
  Tooltip
} from "@heroui/react";
import { trackEvent } from '../lib/analytics/trackEvent';
import { useRouter } from 'next/navigation';
import DeptNotices from './DeptNotices';
import DeptMessenger from './DeptMessenger';
import CustomizeViewControl, { HideCardButton } from './dashboard/CustomizeViewControl';
import { useDashboardVisibility, type DashboardSectionDef } from '../lib/dashboard/useDashboardVisibility';

// Hideable summary/widget cards on this dashboard — the "Operations Overview"
// tabs are core navigation, not clutter, so they're deliberately not included.
const HR_DASHBOARD_SECTIONS: DashboardSectionDef[] = [
  { id: 'activeEmployees', label: 'Active Employees' },
  { id: 'onLeave', label: 'On Leave' },
  { id: 'payrollStatus', label: 'Payroll Status' },
  { id: 'todayOps', label: "Today's Operations" },
  { id: 'quickActions', label: 'Quick Actions' },
  { id: 'recentActivities', label: 'Recent Activities' },
  { id: 'notices', label: 'HR Notices' },
];

// Import specialized HR components
import HRAnalyticsDashboard from './HRAnalyticsDashboard';
import EmployeeManagementDashboard from './hr/EmployeeManagementDashboard';
import EmployeeRecordsPanel from './hr/EmployeeRecordsPanel';
import NewHiresPanel from './hr/NewHiresPanel';
import EmployeeChangesPanel from './hr/EmployeeChangesPanel';
import PerformanceReviewsPanel from './hr/PerformanceReviewsPanel';
import DepartmentsPositionsPanel from './hr/DepartmentsPositionsPanel';
import LeaveAttendanceDashboard from './hr/LeaveAttendanceDashboard';
import LeaveManagementPanel from './hr/LeaveManagementPanel';
import TimeTrackingPanel from './hr/TimeTrackingPanel';
import ShiftSchedulingPanel from './hr/ShiftSchedulingPanel';
import OvertimeManagementPanel from './hr/OvertimeManagementPanel';
import ComplianceDashboard from './hr/ComplianceDashboard';
import TaxCompliancePanel from './hr/TaxCompliancePanel';
import TrainingProgramsPanel from './hr/TrainingProgramsPanel';
import LaborCompliancePanel from './hr/LaborCompliancePanel';
import ComplianceReportsPanel from './hr/ComplianceReportsPanel';
import PayrollManagementDashboard from './hr/PayrollManagementDashboard';
import PayrollProcessingPanel from './hr/PayrollProcessingPanel';
import PayslipGenerationPanel from './hr/PayslipGenerationPanel';
import BenefitsManagementPanel from './hr/BenefitsManagementPanel';
import SalaryAnalyticsPanel from './hr/SalaryAnalyticsPanel';
import RecentActivities from './RecentActivities';
import { useEmployeeStore } from '../lib/hr/employeeStore';
import { usePayrollStore } from '../lib/hr/payrollStore';
import { useLeaveAttendanceStore } from '../lib/hr/leaveAttendanceStore';
import { useTrainingStore } from '../lib/hr/trainingStore';
import { usePerformanceStore } from '../lib/hr/performanceStore';
import { useEmployeeChangesStore } from '../lib/hr/employeeChangesStore';
import { useBenefitsStore } from '../lib/hr/benefitsStore';
import { useOnboardingStore } from '../lib/hr/onboardingStore';
import { computeLaborCompliance } from '../lib/hr/laborCompliance';

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
  const { isHidden, hide, toggle: toggleSection, showAll, hiddenCount } = useDashboardVisibility('dashboard.hidden.hr', HR_DASHBOARD_SECTIONS);
  const [employeeView, setEmployeeView] = useState<'dashboard' | 'records' | 'newHires' | 'changes' | 'reviews' | 'departments'>('dashboard');
  const [leaveView, setLeaveView] = useState<'dashboard' | 'leave' | 'time' | 'shifts' | 'overtime'>('dashboard');
  const [complianceView, setComplianceView] = useState<'dashboard' | 'tax' | 'training' | 'labor' | 'reports'>('dashboard');
  const [payrollView, setPayrollView] = useState<'dashboard' | 'processing' | 'payslips' | 'benefits' | 'analytics'>('dashboard');
  const router = useRouter();

  // Real HR data — hydrated from the DB on mount below.
  const employees = useEmployeeStore((s) => s.employees);
  const hydrateEmployees = useEmployeeStore((s) => s.hydrateFromApi);
  const payrollPeriods = usePayrollStore((s) => s.payrollPeriods);
  const payrollRecords = usePayrollStore((s) => s.payrollRecords);
  const hydratePayroll = usePayrollStore((s) => s.hydrateFromApi);
  const leaveRequests = useLeaveAttendanceStore((s) => s.leaveRequests);
  const shifts = useLeaveAttendanceStore((s) => s.shifts);
  const attendances = useLeaveAttendanceStore((s) => s.attendances);
  const hydrateLeave = useLeaveAttendanceStore((s) => s.hydrateFromApi);
  const employeeChanges = useEmployeeChangesStore((s) => s.changes);
  const hydrateEmployeeChanges = useEmployeeChangesStore((s) => s.hydrateFromApi);
  const benefitsEnrollments = useBenefitsStore((s) => s.enrollments);
  const hydrateBenefits = useBenefitsStore((s) => s.hydrateFromApi);
  const trainingPrograms = useTrainingStore((s) => s.programs);
  const trainingEnrollments = useTrainingStore((s) => s.enrollments);
  const hydrateTraining = useTrainingStore((s) => s.hydrateFromApi);
  const performanceReviewsList = usePerformanceStore((s) => s.reviews);
  const hydratePerformance = usePerformanceStore((s) => s.hydrateFromApi);
  const hydrateOnboarding = useOnboardingStore((s) => s.hydrateFromApi);

  useEffect(() => {
    hydrateEmployees();
    hydratePayroll();
    hydrateLeave();
    hydrateTraining();
    hydrateBenefits();
    hydratePerformance();
    hydrateEmployeeChanges();
    hydrateOnboarding();
  }, [hydrateEmployees, hydratePayroll, hydrateLeave, hydrateTraining, hydrateBenefits, hydratePerformance, hydrateEmployeeChanges, hydrateOnboarding]);

  const today = new Date().toISOString().slice(0, 10);
  const isSameMonth = (d: Date | string) => {
    const date = new Date(d);
    const now = new Date();
    return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
  };

  const totalEmployees = employees.length;
  const activeEmployees = employees.filter((e) => e.status === 'active').length;
  const onLeaveEmployees = employees.filter((e) => e.status === 'on_leave').length;
  const fullTimeCount = employees.filter((e) => e.employmentType === 'full_time').length;
  const partTimeCount = employees.filter((e) => e.employmentType === 'part_time').length;
  const contractCount = employees.filter((e) => e.employmentType === 'contract').length;

  // "Currently on leave" = approved leave requests whose date range spans today.
  const activeLeave = leaveRequests.filter(
    (r) => r.status === 'approved' && new Date(r.startDate).getTime() <= Date.now() && new Date(r.endDate).getTime() >= Date.now()
  );
  const vacationOnLeave = activeLeave.filter((r) => r.leaveType === 'annual').length;
  const sickOnLeave = activeLeave.filter((r) => r.leaveType === 'sick').length;
  const maternityOnLeave = activeLeave.filter((r) => r.leaveType === 'maternity' || r.leaveType === 'paternity').length;

  const currentMonthPeriods = payrollPeriods.filter((p) => isSameMonth(p.startDate));
  const monthlyPayroll = currentMonthPeriods.reduce((sum, p) => sum + (p.totalNetPay || 0), 0);
  const processedPayroll = currentMonthPeriods
    .filter((p) => p.status === 'approved' || p.status === 'paid' || p.status === 'closed')
    .reduce((sum, p) => sum + (p.totalNetPay || 0), 0);
  const pendingPayroll = currentMonthPeriods
    .filter((p) => p.status === 'draft' || p.status === 'processing')
    .reduce((sum, p) => sum + (p.totalNetPay || 0), 0);

  const pendingLeaveRequests = leaveRequests.filter((r) => r.status === 'pending').length;

  const performanceReviews = performanceReviewsList.length;
  const pendingReviews = performanceReviewsList.filter((r: any) => r.status !== 'completed' && r.status !== 'acknowledged').length;
  const completedReviews = performanceReviews - pendingReviews;

  const { checklist: complianceChecklist, score: laborCompliance } = computeLaborCompliance(employees, trainingPrograms, trainingEnrollments);
  const tinCheck = complianceChecklist.find((c) => c.id === 'tin');
  const taxCompliance = tinCheck && tinCheck.total > 0 ? Math.round((tinCheck.compliant / tinCheck.total) * 100) : 100;

  const newHiresToday = employees.filter((e) => e.hireDate && new Date(e.hireDate).toISOString().slice(0, 10) === today).length;
  const payrollProcessedToday = payrollRecords.filter((r) => r.createdAt && new Date(r.createdAt).toISOString().slice(0, 10) === today).length;

  const activeBenefitsEnrollments = benefitsEnrollments.filter((e) => e.status === 'active').length;
  const overtimeRecordsCount = attendances.filter((a) => (a.overtimeHours || 0) > 0).length;

  // Operational items following the uniform pattern
  const operationalItems = [
    {
      category: 'Employee Management',
      items: [
        { title: 'Employee Records', icon: '👥', description: 'Complete employee database and profiles', status: 'active', count: totalEmployees },
        { title: 'New Hires', icon: '📝', description: 'Onboarding and recruitment management', status: 'active', count: newHiresToday },
        { title: 'Employee Changes', icon: '🔄', description: 'Promotions, transfers, and updates', status: 'active', count: employeeChanges.length },
        { title: 'Performance Reviews', icon: '📊', description: 'Employee evaluation and feedback', status: 'active', count: pendingReviews },
      ]
    },
    {
      category: 'Payroll & Benefits',
      items: [
        { title: 'Payroll Processing', icon: '💰', description: 'Salary calculation and payment', status: 'active', count: payrollProcessedToday },
        { title: 'Payslip Generation', icon: '🧾', description: 'Employee payment documentation', status: 'active', count: 0 },
        { title: 'Benefits Management', icon: '💳', description: 'Health, insurance, and perks', status: 'active', count: activeBenefitsEnrollments },
        { title: 'Salary Analytics', icon: '📈', description: 'Compensation analysis and planning', status: 'active', count: 0 },
      ]
    },
    {
      category: 'Leave & Attendance',
      items: [
        { title: 'Leave Management', icon: '🌴', description: 'Vacation and time-off requests', status: 'active', count: pendingLeaveRequests },
        { title: 'Time Tracking', icon: '⏰', description: 'Work hours and attendance monitoring', status: 'active', count: activeEmployees },
        { title: 'Shift Scheduling', icon: '📅', description: 'Work schedule management', status: 'active', count: shifts.length },
        { title: 'Overtime Management', icon: '🚨', description: 'Extra hours tracking and approval', status: 'active', count: overtimeRecordsCount },
      ]
    },
    {
      category: 'Compliance & Training',
      items: [
        { title: 'Tax Compliance', icon: '📋', description: 'PAYE, SSNIT, and tax reporting', status: 'active', count: taxCompliance },
        { title: 'Training Programs', icon: '🎓', description: 'Employee development and skills', status: 'active', count: trainingPrograms.length },
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

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-ghana-black">👥 HR & Payroll</h2>
        <div className="flex items-center gap-2">
          <Badge color="success" variant="flat">System Online</Badge>
          <Badge color="primary" variant="flat">Ghana Compliant</Badge>
          <CustomizeViewControl
            sections={HR_DASHBOARD_SECTIONS}
            isHidden={isHidden}
            toggle={toggleSection}
            showAll={showAll}
            hiddenCount={hiddenCount}
          />
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
        {(!isHidden('activeEmployees') || !isHidden('onLeave') || !isHidden('payrollStatus')) && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          {/* Active Employees */}
          {!isHidden('activeEmployees') && (
          <Card className="border-0 shadow-lg border-l-4 border-l-green-500">
            <CardBody className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-lg font-semibold text-ghana-black">Active Employees</h4>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <HideCardButton onHide={() => hide('activeEmployees')} label="Active Employees" />
                </div>
              </div>
              <div className="text-3xl font-bold text-green-600 mb-3">{activeEmployees}</div>
              <div className="space-y-1 text-sm text-gray-600">
                <div className="flex justify-between">
                  <span>Full-time</span>
                  <span className="font-medium">{fullTimeCount}</span>
                </div>
                <div className="flex justify-between">
                  <span>Part-time</span>
                  <span className="font-medium">{partTimeCount}</span>
                </div>
                <div className="flex justify-between">
                  <span>Contract</span>
                  <span className="font-medium">{contractCount}</span>
                </div>
              </div>
            </CardBody>
          </Card>
          )}

          {/* On Leave */}
          {!isHidden('onLeave') && (
          <Card className="border-0 shadow-lg border-l-4 border-l-orange-500">
            <CardBody className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-lg font-semibold text-ghana-black">On Leave</h4>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                  <HideCardButton onHide={() => hide('onLeave')} label="On Leave" />
                </div>
              </div>
              <div className="text-3xl font-bold text-orange-600 mb-3">{onLeaveEmployees}</div>
              <div className="space-y-1 text-sm text-gray-600">
                <div className="flex justify-between">
                  <span>Vacation</span>
                  <span className="font-medium">{vacationOnLeave}</span>
                </div>
                <div className="flex justify-between">
                  <span>Sick Leave</span>
                  <span className="font-medium">{sickOnLeave}</span>
                </div>
                <div className="flex justify-between">
                  <span>Maternity</span>
                  <span className="font-medium">{maternityOnLeave}</span>
                </div>
              </div>
            </CardBody>
          </Card>
          )}

          {/* Payroll Status */}
          {!isHidden('payrollStatus') && (
          <Card className="border-0 shadow-lg border-l-4 border-l-blue-500">
            <CardBody className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-lg font-semibold text-ghana-black">Payroll Status</h4>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                  <HideCardButton onHide={() => hide('payrollStatus')} label="Payroll Status" />
                </div>
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
          )}
        </div>
        )}

        {/* Today's Operations - Matching Uniform Pattern */}
        {!isHidden('todayOps') && (
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
          <div className="flex items-center gap-2">
            <Button
              color="success"
              variant="solid"
              className="bg-green-600 hover:bg-green-700"
              onClick={() => setSelectedTab('employees')}
            >
              👥 Manage Employees
            </Button>
            <HideCardButton onHide={() => hide('todayOps')} label="Today's Operations" />
          </div>
        </div>
        )}
      </div>

      {/* Quick Actions */}
      {!isHidden('quickActions') && (
      <Card className="border-0 shadow-lg mb-6">
        <CardHeader className="pb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">🚀</span>
            <h3 className="text-lg font-semibold text-ghana-black">Quick Actions</h3>
          </div>
          <HideCardButton onHide={() => hide('quickActions')} label="Quick Actions" />
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
      )}

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
                              if (item.title.includes('Employee Records')) {
                                setSelectedTab('employees');
                                setEmployeeView('records');
                              } else if (item.title.includes('New Hires')) {
                                setSelectedTab('employees');
                                setEmployeeView('newHires');
                              } else if (item.title.includes('Employee Changes')) {
                                setSelectedTab('employees');
                                setEmployeeView('changes');
                              } else if (item.title.includes('Performance Reviews')) {
                                setSelectedTab('employees');
                                setEmployeeView('reviews');
                              } else if (item.title.includes('Payroll Processing')) {
                                setSelectedTab('payroll');
                                setPayrollView('processing');
                              } else if (item.title.includes('Payslip')) {
                                setSelectedTab('payroll');
                                setPayrollView('payslips');
                              } else if (item.title.includes('Benefits Management')) {
                                setSelectedTab('payroll');
                                setPayrollView('benefits');
                              } else if (item.title.includes('Salary Analytics')) {
                                setSelectedTab('payroll');
                                setPayrollView('analytics');
                              } else if (item.title.includes('Leave Management') || item.title.includes('Time Tracking')) {
                                setSelectedTab('leave');
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
              <div className="p-6 space-y-4">
                {employeeView !== 'dashboard' && (
                  <div className="flex items-center justify-between">
                    <Button variant="flat" onPress={() => setEmployeeView('dashboard')}>← Back to Employee Dashboard</Button>
                  </div>
                )}
                {employeeView === 'dashboard' && (
                  <EmployeeManagementDashboard onSelect={(k) => setEmployeeView(k)} />
                )}
                {employeeView === 'records' && <EmployeeRecordsPanel />}
                {employeeView === 'newHires' && <NewHiresPanel />}
                {employeeView === 'changes' && <EmployeeChangesPanel />}
                {employeeView === 'reviews' && <PerformanceReviewsPanel />}
                {employeeView === 'departments' && <DepartmentsPositionsPanel />}
              </div>
            </Tab>

            <Tab key="payroll" title="💰 Payroll Management">
              <div className="p-6 space-y-4">
                {payrollView !== 'dashboard' && (
                  <div className="flex items-center justify-between">
                    <Button variant="flat" onPress={() => setPayrollView('dashboard')}>← Back to Payroll Dashboard</Button>
                  </div>
                )}
                {payrollView === 'dashboard' && (
                  <PayrollManagementDashboard onSelect={(k) => setPayrollView(k)} />
                )}
                {payrollView === 'processing' && <PayrollProcessingPanel />}
                {payrollView === 'payslips' && <PayslipGenerationPanel />}
                {payrollView === 'benefits' && <BenefitsManagementPanel />}
                {payrollView === 'analytics' && <SalaryAnalyticsPanel />}
              </div>
            </Tab>

            <Tab key="leave" title="🌴 Leave Management">
              <div className="p-6 space-y-4">
                {leaveView !== 'dashboard' && (
                  <div className="flex items-center justify-between">
                    <Button variant="flat" onPress={() => setLeaveView('dashboard')}>← Back to Leave & Attendance</Button>
                  </div>
                )}
                {leaveView === 'dashboard' && (
                  <LeaveAttendanceDashboard onSelect={(k) => setLeaveView(k)} />
                )}
                {leaveView === 'leave' && <LeaveManagementPanel />}
                {leaveView === 'time' && <TimeTrackingPanel />}
                {leaveView === 'shifts' && <ShiftSchedulingPanel />}
                {leaveView === 'overtime' && <OvertimeManagementPanel />}
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
                        {/* Performance Reviews is the only real performance screen in HR --
                            there's no separate goal-setting or reporting UI, so all three
                            actions open it (goals live on each review record; the review
                            table itself is the report). */}
                        <Button color="primary" variant="flat" className="w-full" onPress={() => { setSelectedTab('employees'); setEmployeeView('reviews'); }}>
                          📊 New Performance Review
                        </Button>
                        <Button color="secondary" variant="flat" className="w-full" onPress={() => { setSelectedTab('employees'); setEmployeeView('reviews'); }}>
                          🎯 Set Goals
                        </Button>
                        <Button color="success" variant="flat" className="w-full" onPress={() => { setSelectedTab('employees'); setEmployeeView('reviews'); }}>
                          📈 Performance Reports
                        </Button>
                      </div>
                    </CardBody>
                  </Card>
                </div>
              </div>
            </Tab>

            <Tab key="compliance" title="📋 Compliance & Training">
              <div className="p-6 space-y-4">
                {complianceView !== 'dashboard' && (
                  <div className="flex items-center justify-between">
                    <Button variant="flat" onPress={() => setComplianceView('dashboard')}>← Back to Compliance & Training</Button>
                  </div>
                )}
                {complianceView === 'dashboard' && (
                  <ComplianceDashboard onSelect={(k) => setComplianceView(k)} />
                )}
                {complianceView === 'tax' && <TaxCompliancePanel />}
                {complianceView === 'training' && <TrainingProgramsPanel />}
                {complianceView === 'labor' && <LaborCompliancePanel />}
                {complianceView === 'reports' && <ComplianceReportsPanel />}
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
      {(!isHidden('recentActivities') || !isHidden('notices')) && (
      <div className="mt-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Activities */}
          {!isHidden('recentActivities') && (
          <Card className="border-0 shadow-lg">
            <CardHeader className="pb-3 flex items-center justify-between">
              <h3 className="text-xl font-semibold text-ghana-black">📋 Recent Activities</h3>
              <HideCardButton onHide={() => hide('recentActivities')} label="Recent Activities" />
            </CardHeader>
            <CardBody>
              <RecentActivities area="hr" />
            </CardBody>
          </Card>
          )}

          {/* HR Notices */}
          {!isHidden('notices') && (
          <Card className="border-0 shadow-lg">
            <CardHeader className="pb-3 flex items-center justify-between">
              <h3 className="text-xl font-semibold text-ghana-black">🔔 HR Notices</h3>
              <HideCardButton onHide={() => hide('notices')} label="HR Notices" />
            </CardHeader>
            <CardBody>
              <DeptNotices dept="hr" title="" defaultTab="alerts" />
            </CardBody>
          </Card>
          )}
        </div>
      </div>
      )}
    </div>
  );
}
