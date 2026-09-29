'use client';

import React, { useState, useEffect } from 'react';
import { 
  Card, 
  CardBody, 
  CardHeader, 
  Button, 
  Tabs, 
  Tab, 
} from "@heroui/react";
import DeptNotices from './DeptNotices';
import DeptMessenger from './DeptMessenger';
import CustomizeViewControl, { HideCardButton } from './dashboard/CustomizeViewControl';
import ModuleExpandButton from './ModuleExpandButton';
import { useDashboardVisibility, type DashboardSectionDef } from '../lib/dashboard/useDashboardVisibility';
import { deskBookTabsClassNames, deskBookTabPanelClassName } from './dashboard/deskTabsUi';

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
import EmployeeRecordsPanel from './hr/EmployeeRecordsPanel';
import NewHiresPanel from './hr/NewHiresPanel';
import EmployeeChangesPanel from './hr/EmployeeChangesPanel';
import PerformanceReviewsPanel from './hr/PerformanceReviewsPanel';
import PerformanceLogPanel from './hr/PerformanceLogPanel';
import DepartmentsPositionsPanel from './hr/DepartmentsPositionsPanel';
import LeaveManagementPanel from './hr/LeaveManagementPanel';
import LeaveBalancesTab from './hr/LeaveBalancesTab';
import LeaveCalendarTab from './hr/LeaveCalendarTab';
import TimeTrackingPanel from './hr/TimeTrackingPanel';
import ShiftSchedulingPanel from './hr/ShiftSchedulingPanel';
import OvertimeManagementPanel from './hr/OvertimeManagementPanel';
import TaxCompliancePanel from './hr/TaxCompliancePanel';
import TrainingProgramsPanel from './hr/TrainingProgramsPanel';
import LaborCompliancePanel from './hr/LaborCompliancePanel';
import ComplianceReportsPanel from './hr/ComplianceReportsPanel';
import PayrollProcessingPanel from './hr/PayrollProcessingPanel';
import BenefitsManagementPanel from './hr/BenefitsManagementPanel';
import SalaryAnalyticsPanel from './hr/SalaryAnalyticsPanel';
import StaffDebtsPanel from './hr/StaffDebtsPanel';
import HRReportsAnalysis from './HRReportsAnalysis';
import RecentActivities from './RecentActivities';
import { useEmployeeStore } from '../lib/hr/employeeStore';
import { getExpiryAlerts } from '../lib/hr/expiryAlerts';
import { usePayrollStore } from '../lib/hr/payrollStore';
import { useLeaveAttendanceStore } from '../lib/hr/leaveAttendanceStore';
import { useTrainingStore } from '../lib/hr/trainingStore';
import { usePerformanceStore } from '../lib/hr/performanceStore';
import { useEmployeeChangesStore } from '../lib/hr/employeeChangesStore';
import { useBenefitsStore } from '../lib/hr/benefitsStore';
import { useOnboardingStore } from '../lib/hr/onboardingStore';
import { useStaffDebtStore } from '../lib/hr/staffDebtStore';

type HrBook = 'employees' | 'leave' | 'time' | 'payroll' | 'benefits' | 'performance' | 'training' | 'compliance' | 'departments' | 'reports';

const DEFAULT_PANEL: Record<HrBook, string> = {
  employees: 'records',
  leave: 'requests',
  time: 'attendance',
  payroll: 'payroll',
  benefits: 'benefits',
  performance: 'reviews',
  training: 'training',
  compliance: 'tax',
  departments: 'departments',
  reports: 'analysis',
};

const HR_TARGETS: Record<string, { book: HrBook; panel: string }> = {
  overview: { book: 'employees', panel: 'records' },
  employees: { book: 'employees', panel: 'records' },
  records: { book: 'employees', panel: 'records' },
  hires: { book: 'employees', panel: 'hires' },
  'new-hires': { book: 'employees', panel: 'hires' },
  newhires: { book: 'employees', panel: 'hires' },
  changes: { book: 'employees', panel: 'changes' },
  leave: { book: 'leave', panel: 'requests' },
  requests: { book: 'leave', panel: 'requests' },
  balances: { book: 'leave', panel: 'balances' },
  calendar: { book: 'leave', panel: 'calendar' },
  'whos-off': { book: 'leave', panel: 'calendar' },
  time: { book: 'time', panel: 'attendance' },
  attendance: { book: 'time', panel: 'attendance' },
  shifts: { book: 'time', panel: 'shifts' },
  overtime: { book: 'time', panel: 'overtime' },
  payroll: { book: 'payroll', panel: 'payroll' },
  // Legacy deep-links: payslips folded into Staff Payroll (print from a line); salary under Reports.
  payslips: { book: 'payroll', panel: 'payroll' },
  salary: { book: 'reports', panel: 'salary' },
  debts: { book: 'payroll', panel: 'debts' },
  'staff-debts': { book: 'payroll', panel: 'debts' },
  benefits: { book: 'benefits', panel: 'benefits' },
  reviews: { book: 'performance', panel: 'reviews' },
  performance: { book: 'performance', panel: 'reviews' },
  'performance-log': { book: 'performance', panel: 'log' },
  training: { book: 'training', panel: 'training' },
  tax: { book: 'compliance', panel: 'tax' },
  compliance: { book: 'compliance', panel: 'tax' },
  labor: { book: 'compliance', panel: 'labor' },
  'compliance-reports': { book: 'compliance', panel: 'reports' },
  departments: { book: 'departments', panel: 'departments' },
  reports: { book: 'reports', panel: 'analysis' },
  analytics: { book: 'reports', panel: 'analysis' },
};

function resolveHrTarget(value: string | null | undefined) {
  if (!value) return { book: 'employees' as HrBook, panel: 'records' };
  return HR_TARGETS[value.trim().toLowerCase()] || { book: 'employees' as HrBook, panel: 'records' };
}

function SectionTabs({
  label,
  selected,
  onChange,
  tabs,
}: {
  label: string;
  selected: string;
  onChange: (key: string) => void;
  tabs: { key: string; title: string }[];
}) {
  return (
    <Tabs
      selectedKey={selected}
      onSelectionChange={(key) => onChange(String(key))}
      size="sm"
      variant="solid"
      className="w-full"
      classNames={deskBookTabsClassNames}
      aria-label={label}
    >
      {tabs.map((tab) => (
        <Tab key={tab.key} title={tab.title} />
      ))}
    </Tabs>
  );
}

export default function HRMainDashboard({
  initialTab = 'records',
  fullPage = false,
}: {
  initialTab?: string;
  fullPage?: boolean;
} = {}) {
  const initialTarget = resolveHrTarget(initialTab);
  const [book, setBook] = useState<HrBook>(initialTarget.book);
  const [panel, setPanel] = useState(initialTarget.panel);
  const { isHidden, hide, toggle: toggleSection, showAll, hiddenCount } = useDashboardVisibility('dashboard.hidden.hr', HR_DASHBOARD_SECTIONS);

  useEffect(() => {
    const apply = () => {
      try {
        const stored = localStorage.getItem('hr.tab');
        if (!stored) return;
        const next = resolveHrTarget(stored);
        setBook(next.book);
        setPanel(next.panel);
        localStorage.removeItem('hr.tab');
      } catch {
        /* ignore */
      }
    };
    apply();
    window.addEventListener('hr-navigate', apply);
    return () => window.removeEventListener('hr-navigate', apply);
  }, []);

  // Real HR data — hydrated from the DB on mount below.
  const employees = useEmployeeStore((s) => s.employees);
  const [docsReady, setDocsReady] = useState(false);
  useEffect(() => setDocsReady(true), []);
  const documentAlerts = React.useMemo(() => {
    if (!docsReady) return [];
    return getExpiryAlerts(employees).map((alert) => {
      const when = alert.daysLeft < 0
        ? `${-alert.daysLeft} day${alert.daysLeft === -1 ? '' : 's'} overdue`
        : alert.daysLeft === 0
          ? 'due today'
          : `due in ${alert.daysLeft} day${alert.daysLeft === 1 ? '' : 's'}`;
      return {
        id: `${alert.employeeId}-${alert.kind}`,
        level: (alert.daysLeft < 0 ? 'urgent' : 'normal') as 'urgent' | 'normal',
        message: `${alert.name} — ${alert.kind} ${when}`,
      };
    });
  }, [docsReady, employees]);
  const hydrateEmployees = useEmployeeStore((s) => s.hydrateFromApi);
  const payrollPeriods = usePayrollStore((s) => s.payrollPeriods);
  const payrollRecords = usePayrollStore((s) => s.payrollRecords);
  const hydratePayroll = usePayrollStore((s) => s.hydrateFromApi);
  const leaveRequests = useLeaveAttendanceStore((s) => s.leaveRequests);
  const hydrateLeave = useLeaveAttendanceStore((s) => s.hydrateFromApi);
  const hydrateEmployeeChanges = useEmployeeChangesStore((s) => s.hydrateFromApi);
  const hydrateBenefits = useBenefitsStore((s) => s.hydrateFromApi);
  const hydrateTraining = useTrainingStore((s) => s.hydrateFromApi);
  const hydratePerformance = usePerformanceStore((s) => s.hydrateFromApi);
  const hydrateOnboarding = useOnboardingStore((s) => s.hydrateFromApi);
  const hydrateStaffDebts = useStaffDebtStore((s) => s.hydrateFromApi);

  useEffect(() => {
    hydrateEmployees();
    hydratePayroll();
    hydrateLeave();
    hydrateTraining();
    hydrateBenefits();
    hydratePerformance();
    hydrateEmployeeChanges();
    hydrateOnboarding();
    hydrateStaffDebts();
  }, [hydrateEmployees, hydratePayroll, hydrateLeave, hydrateTraining, hydrateBenefits, hydratePerformance, hydrateEmployeeChanges, hydrateOnboarding, hydrateStaffDebts]);

  const today = new Date().toISOString().slice(0, 10);
  const isSameMonth = (d: Date | string) => {
    const date = new Date(d);
    const now = new Date();
    return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
  };

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

  const newHiresToday = employees.filter((e) => e.hireDate && new Date(e.hireDate).toISOString().slice(0, 10) === today).length;
  const payrollProcessedToday = payrollRecords.filter((r) => r.createdAt && new Date(r.createdAt).toISOString().slice(0, 10) === today).length;

  const openBook = (value: string) => {
    const next = resolveHrTarget(value);
    setBook(next.book);
    setPanel(next.panel);
  };

  return (
    <>
    {!fullPage && <DeptMessenger from="hr" mode="drawer" />}
    <div className={fullPage ? 'px-3 pt-1 pb-3' : 'p-6'}>
      <div>
      <div className={`flex items-center justify-between ${fullPage ? 'mb-2' : 'mb-6'}`}>
        <h2 className={`${fullPage ? 'text-xl' : 'text-2xl'} font-bold text-ghana-black`}>
          {fullPage ? '👥 HR' : '👥 HR & Payroll'}
        </h2>
        <div className="flex items-center gap-2">
          <CustomizeViewControl
            sections={HR_DASHBOARD_SECTIONS}
            isHidden={isHidden}
            toggle={toggleSection}
            showAll={showAll}
            hiddenCount={hiddenCount}
          />
          {!fullPage && (
            <ModuleExpandButton
              href={book === 'reports' ? '/hr/reports' : '/hr/ops'}
              label={book === 'reports' ? 'Open reports full page' : 'Open HR & payroll full page'}
            />
          )}
        </div>
      </div>

      {!fullPage && (
      <>
      <div className="mb-6">

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
          <HideCardButton onHide={() => hide('todayOps')} label="Today's Operations" />
        </div>
        )}
      </div>

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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button color="primary" variant="flat" className="h-24 flex flex-col items-center justify-center gap-2 p-4" onClick={() => openBook('records')}>
              <span className="text-2xl">👥</span>
              <span className="font-medium">Employees</span>
              <span className="text-xs text-center opacity-80">Open the staff file</span>
            </Button>
            <Button color="warning" variant="flat" className="h-24 flex flex-col items-center justify-center gap-2 p-4" onClick={() => openBook('leave')}>
              <span className="text-2xl">🌴</span>
              <span className="font-medium">Leave</span>
              <span className="text-xs text-center opacity-80">Review time-off requests</span>
            </Button>
            <Button color="secondary" variant="flat" className="h-24 flex flex-col items-center justify-center gap-2 p-4" onClick={() => openBook('payroll')}>
              <span className="text-2xl">💰</span>
              <span className="font-medium">Run Payroll</span>
              <span className="text-xs text-center opacity-80">Prepare this month’s pay</span>
            </Button>
          </div>
        </CardBody>
      </Card>
      )}
      </>
      )}

      <Card className="border-0 shadow-lg">
        <CardBody className="p-0">
          <Tabs
            selectedKey={book}
            onSelectionChange={(key) => {
              const next = String(key) as HrBook;
              setBook(next);
              setPanel(DEFAULT_PANEL[next]);
            }}
            className="w-full"
            size="sm"
            variant="solid"
            classNames={deskBookTabsClassNames}
            aria-label="HR operations"
          >
            <Tab key="employees" title="👥 Employees">
              {book === 'employees' && (
                <div className={`${deskBookTabPanelClassName} space-y-3`}>
                  <SectionTabs
                    label="Employee sections"
                    selected={panel}
                    onChange={setPanel}
                    tabs={[
                      { key: 'records', title: 'Records' },
                      { key: 'hires', title: 'New Hires' },
                      { key: 'changes', title: 'Changes' },
                    ]}
                  />
                  {panel === 'records' && <EmployeeRecordsPanel />}
                  {panel === 'hires' && <NewHiresPanel />}
                  {panel === 'changes' && <EmployeeChangesPanel />}
                </div>
              )}
            </Tab>
            <Tab key="leave" title="🌴 Leave">
              {book === 'leave' && (
                <div className={`${deskBookTabPanelClassName} space-y-3`}>
                  <SectionTabs
                    label="Leave sections"
                    selected={panel}
                    onChange={setPanel}
                    tabs={[
                      { key: 'requests', title: 'Requests' },
                      { key: 'balances', title: 'Balances' },
                      { key: 'calendar', title: "Who's Off" },
                    ]}
                  />
                  {panel === 'requests' && <LeaveManagementPanel />}
                  {panel === 'balances' && <LeaveBalancesTab />}
                  {panel === 'calendar' && <LeaveCalendarTab />}
                </div>
              )}
            </Tab>
            <Tab key="time" title="⏰ Time">
              {book === 'time' && (
                <div className={`${deskBookTabPanelClassName} space-y-3`}>
                  <SectionTabs
                    label="Time sections"
                    selected={panel}
                    onChange={setPanel}
                    tabs={[
                      { key: 'attendance', title: 'Attendance' },
                      { key: 'shifts', title: 'Shifts' },
                      { key: 'overtime', title: 'Overtime' },
                    ]}
                  />
                  {panel === 'attendance' && <TimeTrackingPanel />}
                  {panel === 'shifts' && <ShiftSchedulingPanel />}
                  {panel === 'overtime' && <OvertimeManagementPanel />}
                </div>
              )}
            </Tab>
            <Tab key="payroll" title="💰 Payroll">
              {book === 'payroll' && (
                <div className={`${deskBookTabPanelClassName} space-y-3`}>
                  <SectionTabs
                    label="Payroll sections"
                    selected={panel === 'debts' ? 'debts' : 'payroll'}
                    onChange={setPanel}
                    tabs={[
                      { key: 'payroll', title: 'Run' },
                      { key: 'debts', title: 'Staff debts' },
                    ]}
                  />
                  {panel === 'debts' ? <StaffDebtsPanel /> : <PayrollProcessingPanel />}
                </div>
              )}
            </Tab>
            <Tab key="benefits" title="💳 Benefits">
              {book === 'benefits' && <div className={deskBookTabPanelClassName}><BenefitsManagementPanel /></div>}
            </Tab>
            <Tab key="performance" title="📊 Performance">
              {book === 'performance' && (
                <div className={`${deskBookTabPanelClassName} space-y-3`}>
                  <SectionTabs
                    label="Performance sections"
                    selected={panel}
                    onChange={setPanel}
                    tabs={[
                      { key: 'reviews', title: 'Reviews' },
                      { key: 'log', title: 'Log' },
                    ]}
                  />
                  {panel === 'reviews' && <PerformanceReviewsPanel />}
                  {panel === 'log' && <PerformanceLogPanel />}
                </div>
              )}
            </Tab>
            <Tab key="training" title="🎓 Training">
              {book === 'training' && <div className={deskBookTabPanelClassName}><TrainingProgramsPanel /></div>}
            </Tab>
            <Tab key="compliance" title="📋 Compliance">
              {book === 'compliance' && (
                <div className={`${deskBookTabPanelClassName} space-y-3`}>
                  <SectionTabs
                    label="Compliance sections"
                    selected={panel}
                    onChange={setPanel}
                    tabs={[
                      { key: 'tax', title: 'Tax' },
                      { key: 'labor', title: 'Labor' },
                      { key: 'reports', title: 'Filings' },
                    ]}
                  />
                  {panel === 'tax' && <TaxCompliancePanel />}
                  {panel === 'labor' && <LaborCompliancePanel />}
                  {panel === 'reports' && <ComplianceReportsPanel />}
                </div>
              )}
            </Tab>
            <Tab key="departments" title="🏢 Departments">
              {book === 'departments' && <div className={deskBookTabPanelClassName}><DepartmentsPositionsPanel /></div>}
            </Tab>
            <Tab key="reports" title="📈 Reports & Analysis">
              {book === 'reports' && (
                <div className={`${deskBookTabPanelClassName} space-y-3`}>
                  <SectionTabs
                    label="Reports sections"
                    selected={panel === 'salary' ? 'salary' : 'analysis'}
                    onChange={setPanel}
                    tabs={[
                      { key: 'analysis', title: 'Analysis' },
                      { key: 'salary', title: 'Salary' },
                    ]}
                  />
                  {(panel === 'analysis' || panel === 'reports') && <HRReportsAnalysis embedded />}
                  {panel === 'salary' && <SalaryAnalyticsPanel />}
                </div>
              )}
            </Tab>
          </Tabs>
        </CardBody>
      </Card>

      {/* Recent Activities & Notices */}
      {!fullPage && (!isHidden('recentActivities') || !isHidden('notices')) && (
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
              <DeptNotices dept="hr" title="" defaultTab="alerts" pinnedAlerts={documentAlerts} />
            </CardBody>
          </Card>
          )}
        </div>
      </div>
      )}
      </div>
    </div>
    </>
  );
}
