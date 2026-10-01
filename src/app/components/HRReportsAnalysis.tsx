'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Card, CardBody, CardHeader, Button,
  Tabs, Tab, Select, SelectItem, Input, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter,
  useDisclosure, Textarea, Dropdown, DropdownTrigger, DropdownMenu, DropdownItem, Chip
} from '@heroui/react';
import {
  ArrowDownToLine, BarChart3, CalendarDays, FileSpreadsheet, FileText,
  Filter, Printer, RefreshCw, RotateCcw, Search, SlidersHorizontal, StickyNote, TrendingUp, X
} from 'lucide-react';
import ReportPageInfoTip from './dashboard/ReportPageInfoTip';
import { SortableReportTable } from './reports/SortableReportTable';
import { useEmployeeStore } from '../lib/hr/employeeStore';
import { usePayrollStore } from '../lib/hr/payrollStore';
import { useLeaveAttendanceStore, DEFAULT_LEAVE_ENTITLEMENTS } from '../lib/hr/leaveAttendanceStore';
import { useStaffDebtStore } from '../lib/hr/staffDebtStore';
import { useOnboardingStore } from '../lib/hr/onboardingStore';
import { usePerformanceLogStore } from '../lib/hr/performanceLogStore';
import { useEmployeeChangesStore } from '../lib/hr/employeeChangesStore';
import { computeLaborCompliance } from '../lib/hr/laborCompliance';
import { categoryLabel } from '../lib/hr/performanceLog';
import { useBenefitsStore } from '../lib/hr/benefitsStore';
import { useTrainingStore } from '../lib/hr/trainingStore';
import { usePerformanceStore } from '../lib/hr/performanceStore';
import { useSettingsStore } from '../lib/settings/store';
import { buildOrgProfile } from '../lib/print/buildOrgProfile';
import { reportDataToSections, sectionsToCSV, sectionsToExcelHtml, sectionsToPdfBlob } from '../lib/frontoffice/reportExportFormat';

function labelize(key: string): string {
  return key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase());
}

function formatReportValue(value: unknown): React.ReactNode {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return String(value);
}

function money(value: number) {
  return `GH₵ ${Number(value || 0).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function dayOf(value?: Date | string | null) {
  if (!value) return '';
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  const raw = String(value);
  if (raw.length >= 10) return raw.slice(0, 10);
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString().slice(0, 10);
}

function inDateRange(day: string, startDate: string, endDate: string) {
  return Boolean(day) && day >= startDate && day <= endDate;
}

/** A stay, leave, or payroll month counts when it overlaps the selected dates, so "Today"
 * still shows the month or request that covers today. */
function rangesOverlap(rowStart: string, rowEnd: string, filterStart: string, filterEnd: string) {
  if (!rowStart || !filterStart || !filterEnd) return false;
  const end = rowEnd || rowStart;
  return rowStart <= filterEnd && end >= filterStart;
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

/** Employer statutory cost saved with the payroll month. Payslips only store the employee's side. */
function savedEmployerContribution(notes?: string) {
  if (!notes) return undefined;
  try {
    const parsed = JSON.parse(notes);
    return typeof parsed?.employerContribution === 'number' ? parsed.employerContribution : undefined;
  } catch {
    return undefined;
  }
}

type CostRecord = {
  id: string;
  payrollPeriodId: string;
  employeeId?: string;
  employeeNumber?: string;
  employeeName?: string;
  department?: string;
  basicSalary?: number;
  grossPay?: number;
};

/** Split a month's saved employer contribution across its payslips by basic salary, so the shares add back to the stored total. */
function payrollCostLines(
  records: CostRecord[],
  periods: { id: string; startDate?: Date | string | null; endDate?: Date | string | null; notes?: string }[],
  startDate: string,
  endDate: string,
) {
  const inRange = periods.filter((period) => rangesOverlap(dayOf(period.startDate), dayOf(period.endDate), startDate, endDate));
  const periodIds = new Set(inRange.map((period) => period.id));
  const lines = records.filter((record) => periodIds.has(record.payrollPeriodId));
  const employerByRecord = new Map<string, number>();
  inRange.forEach((period) => {
    const group = lines.filter((record) => record.payrollPeriodId === period.id);
    const saved = savedEmployerContribution(period.notes);
    const basic = group.reduce((sum, record) => sum + Number(record.basicSalary || 0), 0);
    let assigned = 0;
    group.forEach((record, index) => {
      let share = 0;
      if (saved !== undefined && basic > 0) {
        share = index === group.length - 1
          ? round2(saved - assigned)
          : round2(saved * (Number(record.basicSalary || 0) / basic));
        assigned = round2(assigned + share);
      }
      employerByRecord.set(record.id, share);
    });
  });
  return lines.map((record) => {
    const gross = Number(record.grossPay || 0);
    const employer = employerByRecord.get(record.id) || 0;
    return { record, gross, employer, cost: round2(gross + employer) };
  });
}

function employeeName(employees: { id: string; firstName: string; lastName: string }[], id?: string) {
  const employee = employees.find((row) => row.id === id);
  return employee ? `${employee.firstName} ${employee.lastName}`.trim() : id || '—';
}

const RANGE_REPORT_KEYS = new Set(['payroll-records', 'payroll-periods', 'payroll-cost-staff', 'payroll-cost-department', 'leave', 'attendance', 'shifts', 'benefits', 'training', 'performance', 'staff-changes', 'performance-log']);
const NO_DATE_REPORT_KEYS = new Set(['employees', 'departments', 'positions', 'onboarding', 'leave-balances', 'staff-debts', 'labour-compliance']);
const LEAVE_BALANCE_TYPES = (Object.keys(DEFAULT_LEAVE_ENTITLEMENTS) as Array<keyof typeof DEFAULT_LEAVE_ENTITLEMENTS>).filter((type) => type !== 'other');

const REPORT_GROUPS = {
  people: {
    title: 'People',
    description: 'Staff on the HR file, as recorded.',
    reports: [
      ['employees', 'Employees'],
      ['departments', 'Departments'],
      ['positions', 'Positions'],
      ['onboarding', 'Onboarding'],
      ['staff-changes', 'Staff changes'],
    ],
  },
  payroll: {
    title: 'Payroll',
    description: 'Payslips, payroll months, and what those months cost by staff member and department.',
    reports: [
      ['payroll-records', 'Payroll Records'],
      ['payroll-periods', 'Payroll Periods'],
      ['payroll-cost-staff', 'Cost by staff'],
      ['payroll-cost-department', 'Cost by department'],
      ['staff-debts', 'Staff debts'],
    ],
  },
  time: {
    title: 'Time',
    description: 'Leave, balances, attendance and shifts already captured.',
    reports: [
      ['leave', 'Leave Requests'],
      ['leave-balances', 'Leave balances'],
      ['attendance', 'Attendance'],
      ['shifts', 'Shifts'],
    ],
  },
  activity: {
    title: 'Activity',
    description: 'Benefits, training, reviews and the performance log.',
    reports: [
      ['benefits', 'Benefits'],
      ['training', 'Training'],
      ['performance', 'Performance'],
      ['performance-log', 'Performance log'],
    ],
  },
  compliance: {
    title: 'Compliance',
    description: 'Labour checks already used on the HR compliance score.',
    reports: [
      ['labour-compliance', 'Labour compliance'],
    ],
  },
} as const;

type ReportGroupKey = keyof typeof REPORT_GROUPS;
type ReportFilters = {
  query: string;
  status: string;
  type: string;
  staff: string;
  category: string;
  method: string;
};

const EMPTY_REPORT_FILTERS: ReportFilters = {
  query: '',
  status: 'all',
  type: 'all',
  staff: 'all',
  category: 'all',
  method: 'all',
};

const REPORT_DESCRIPTIONS: Record<string, string> = {
  employees: 'Employee roster currently on file. Salary is the stored figure, not a calculated package.',
  'payroll-records': 'Payslip lines whose payroll month overlaps the selected dates. Tax and SSNIT are the amounts already stored on each record.',
  'payroll-periods': 'Payroll runs whose month overlaps the selected dates. Cost is the saved gross plus the employer contribution saved on that month.',
  'payroll-cost-staff': 'Each staff member’s payslip gross in the selected dates, plus their share of the employer contribution saved on those months. The share follows basic salary and adds back to the month total.',
  'payroll-cost-department': 'Payslip gross and the employer contribution from the selected months, rolled up by the department on each payslip.',
  leave: 'Leave requests that overlap the selected dates.',
  attendance: 'Clock records for the selected period.',
  shifts: 'Scheduled shifts for the selected period.',
  departments: 'Departments on the HR file, with headcount from current staff records.',
  positions: 'Positions on file, with the department and the stored salary band.',
  onboarding: 'New-hire checklists currently open or finished.',
  'staff-changes': 'Promotions, transfers, salary and status changes logged in the selected period.',
  'leave-balances': 'Entitlement, used and remaining leave for active staff in the current year.',
  'staff-debts': 'Loans, IOUs and surcharges still on the staff debt file.',
  'performance-log': 'Commendations and concerns recorded in the selected period.',
  'labour-compliance': 'The same labour checklist the HR compliance score is built from.',
  benefits: 'Benefit enrollments whose effective date falls in the selected period.',
  training: 'Training enrollments whose enrollment date falls in the selected period.',
  performance: 'Performance reviews whose review date falls in the selected period.',
};

function payslipTies(row: { grossPay?: number; tax?: number; socialSecurity?: number; pension?: number; tier3?: number; other?: number; netPay?: number }) {
  const withheld = Number(row.tax || 0) + Number(row.socialSecurity || 0) + Number(row.pension || 0) + Number(row.tier3 || 0) + Number(row.other || 0);
  const expected = Math.round((Number(row.grossPay || 0) - withheld) * 100) / 100;
  return Math.abs(expected - Number(row.netPay || 0)) < 0.02;
}

type ReportColumnDefinition = { key: string; label: string; defaultVisible?: boolean };

const REPORT_COLUMNS: Record<string, ReportColumnDefinition[]> = {
  employees: [
    { key: 'employeeNumber', label: 'Staff no.' },
    { key: 'name', label: 'Name' },
    { key: 'department', label: 'Department' },
    { key: 'position', label: 'Position' },
    { key: 'employmentType', label: 'Type' },
    { key: 'status', label: 'Status' },
    { key: 'hireDate', label: 'Hired' },
    { key: 'salary', label: 'Salary' },
    { key: 'phone', label: 'Phone', defaultVisible: false },
    { key: 'email', label: 'Email', defaultVisible: false },
  ],
  'payroll-records': [
    { key: 'employeeNumber', label: 'Staff no.' },
    { key: 'employeeName', label: 'Name' },
    { key: 'department', label: 'Department' },
    { key: 'period', label: 'Period' },
    { key: 'basicSalary', label: 'Basic' },
    { key: 'allowances', label: 'Allowances' },
    { key: 'overtimePay', label: 'Overtime' },
    { key: 'bonuses', label: 'Bonus' },
    { key: 'grossPay', label: 'Gross' },
    { key: 'tax', label: 'PAYE' },
    { key: 'socialSecurity', label: 'Tier 1' },
    { key: 'pension', label: 'Tier 2' },
    { key: 'tier3', label: 'Tier 3' },
    { key: 'other', label: 'Other' },
    { key: 'netPay', label: 'Net' },
    { key: 'ties', label: 'Ties' },
    { key: 'status', label: 'Status' },
    { key: 'paymentMethod', label: 'Method', defaultVisible: false },
  ],
  'payroll-periods': [
    { key: 'periodNumber', label: 'Period' },
    { key: 'startDate', label: 'Start' },
    { key: 'endDate', label: 'End' },
    { key: 'employeeCount', label: 'Staff' },
    { key: 'totalGrossPay', label: 'Gross' },
    { key: 'employerContribution', label: 'Employer' },
    { key: 'totalCost', label: 'Cost' },
    { key: 'totalDeductions', label: 'Deductions' },
    { key: 'totalNetPay', label: 'Net' },
    { key: 'status', label: 'Status' },
  ],
  'payroll-cost-staff': [
    { key: 'employeeNumber', label: 'Staff no.' },
    { key: 'employeeName', label: 'Name' },
    { key: 'department', label: 'Department' },
    { key: 'runCount', label: 'Periods' },
    { key: 'gross', label: 'Gross' },
    { key: 'employer', label: 'Employer' },
    { key: 'cost', label: 'Cost' },
  ],
  'payroll-cost-department': [
    { key: 'department', label: 'Department' },
    { key: 'staffCount', label: 'Staff' },
    { key: 'runCount', label: 'Periods' },
    { key: 'gross', label: 'Gross' },
    { key: 'employer', label: 'Employer' },
    { key: 'cost', label: 'Cost' },
  ],
  leave: [
    { key: 'employee', label: 'Employee' },
    { key: 'leaveType', label: 'Type' },
    { key: 'startDate', label: 'Start' },
    { key: 'endDate', label: 'End' },
    { key: 'totalDays', label: 'Days' },
    { key: 'status', label: 'Status' },
    { key: 'reason', label: 'Reason', defaultVisible: false },
  ],
  attendance: [
    { key: 'employee', label: 'Employee' },
    { key: 'date', label: 'Date' },
    { key: 'checkIn', label: 'In' },
    { key: 'checkOut', label: 'Out' },
    { key: 'totalHours', label: 'Hours' },
    { key: 'overtimeHours', label: 'OT' },
    { key: 'status', label: 'Status' },
    { key: 'shift', label: 'Shift', defaultVisible: false },
  ],
  shifts: [
    { key: 'employee', label: 'Employee' },
    { key: 'date', label: 'Date' },
    { key: 'startTime', label: 'Start' },
    { key: 'endTime', label: 'End' },
    { key: 'location', label: 'Location' },
  ],
  departments: [
    { key: 'name', label: 'Department' },
    { key: 'code', label: 'Code' },
    { key: 'headcount', label: 'Staff' },
    { key: 'active', label: 'Active' },
    { key: 'status', label: 'Status' },
  ],
  positions: [
    { key: 'title', label: 'Position' },
    { key: 'code', label: 'Code' },
    { key: 'department', label: 'Department' },
    { key: 'headcount', label: 'Staff' },
    { key: 'minSalary', label: 'Min salary' },
    { key: 'maxSalary', label: 'Max salary' },
    { key: 'status', label: 'Status' },
  ],
  onboarding: [
    { key: 'employee', label: 'Employee' },
    { key: 'department', label: 'Department' },
    { key: 'startedAt', label: 'Started' },
    { key: 'completed', label: 'Done' },
    { key: 'total', label: 'Tasks' },
    { key: 'status', label: 'Status' },
    { key: 'openTasks', label: 'Still open' },
  ],
  'staff-changes': [
    { key: 'timestamp', label: 'When' },
    { key: 'employee', label: 'Employee' },
    { key: 'type', label: 'Change' },
    { key: 'field', label: 'Field' },
    { key: 'previousValue', label: 'From' },
    { key: 'newValue', label: 'To' },
    { key: 'changedBy', label: 'By' },
  ],
  'leave-balances': [
    { key: 'employee', label: 'Employee' },
    { key: 'department', label: 'Department' },
    { key: 'leaveType', label: 'Type' },
    { key: 'year', label: 'Year' },
    { key: 'entitlement', label: 'Entitled' },
    { key: 'used', label: 'Used' },
    { key: 'remaining', label: 'Remaining' },
  ],
  'staff-debts': [
    { key: 'employee', label: 'Employee' },
    { key: 'type', label: 'Type' },
    { key: 'issuedDate', label: 'Issued' },
    { key: 'originalAmount', label: 'Original' },
    { key: 'remainingBalance', label: 'Remaining' },
    { key: 'monthlyInstallment', label: 'Installment' },
    { key: 'status', label: 'Status' },
    { key: 'reason', label: 'Reason', defaultVisible: false },
  ],
  'performance-log': [
    { key: 'date', label: 'Date' },
    { key: 'employee', label: 'Employee' },
    { key: 'category', label: 'Category' },
    { key: 'score', label: 'Score' },
    { key: 'note', label: 'Note' },
    { key: 'status', label: 'Status' },
    { key: 'recordedBy', label: 'Recorded by' },
  ],
  'labour-compliance': [
    { key: 'label', label: 'Check' },
    { key: 'compliant', label: 'Met' },
    { key: 'total', label: 'Applicable' },
    { key: 'gap', label: 'Gap' },
  ],
  benefits: [
    { key: 'employee', label: 'Employee' },
    { key: 'packageName', label: 'Package' },
    { key: 'status', label: 'Status' },
    { key: 'effectiveDate', label: 'Effective' },
    { key: 'totalCost', label: 'Cost' },
    { key: 'employeeContribution', label: 'Employee' },
    { key: 'employerContribution', label: 'Employer' },
  ],
  training: [
    { key: 'employee', label: 'Employee' },
    { key: 'program', label: 'Program' },
    { key: 'status', label: 'Status' },
    { key: 'enrollmentDate', label: 'Enrolled' },
    { key: 'score', label: 'Score' },
    { key: 'cost', label: 'Cost' },
  ],
  performance: [
    { key: 'employee', label: 'Employee' },
    { key: 'period', label: 'Period' },
    { key: 'reviewDate', label: 'Reviewed' },
    { key: 'rating', label: 'Rating' },
    { key: 'status', label: 'Status' },
    { key: 'reviewer', label: 'Reviewer' },
  ],
};

export default function HRReportsAnalysis({ embedded = false }: { embedded?: boolean } = {}) {
  const [selectedTab, setSelectedTab] = useState<ReportGroupKey>('people');
  const [selectedReport, setSelectedReport] = useState('employees');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reportDateMode, setReportDateMode] = useState<'today' | 'specific' | 'range'>('today');
  const [isGenerating, setIsGenerating] = useState(false);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [reportNotes, setReportNotes] = useState('');
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [filters, setFilters] = useState<ReportFilters>(EMPTY_REPORT_FILTERS);
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [hiddenKpisByReport, setHiddenKpisByReport] = useState<Record<string, string[]>>({});
  const [hiddenColumnsByReport, setHiddenColumnsByReport] = useState<Record<string, string[]>>({});
  const [mounted, setMounted] = useState(false);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);

  const settings = useSettingsStore();
  const orgProfile = buildOrgProfile(settings);
  const currentUserLabel = settings.currentUser
    ? `${settings.currentUser.firstName} ${settings.currentUser.lastName}`.trim() || settings.currentUser.email
    : 'System';

  const employees = useEmployeeStore((s) => s.employees);
  const departments = useEmployeeStore((s) => s.departments);
  const positions = useEmployeeStore((s) => s.positions);
  const hydrateEmployees = useEmployeeStore((s) => s.hydrateFromApi);
  const payrollRecords = usePayrollStore((s) => s.payrollRecords);
  const payrollPeriods = usePayrollStore((s) => s.payrollPeriods);
  const hydratePayroll = usePayrollStore((s) => s.hydrateFromApi);
  const leaveRequests = useLeaveAttendanceStore((s) => s.leaveRequests);
  const attendances = useLeaveAttendanceStore((s) => s.attendances);
  const shifts = useLeaveAttendanceStore((s) => s.shifts);
  const hydrateLeave = useLeaveAttendanceStore((s) => s.hydrateFromApi);
  const benefitEnrollments = useBenefitsStore((s) => s.enrollments);
  const benefitPackages = useBenefitsStore((s) => s.packages);
  const hydrateBenefits = useBenefitsStore((s) => s.hydrateFromApi);
  const trainingEnrollments = useTrainingStore((s) => s.enrollments);
  const trainingPrograms = useTrainingStore((s) => s.programs);
  const hydrateTraining = useTrainingStore((s) => s.hydrateFromApi);
  const performanceReviews = usePerformanceStore((s) => s.reviews);
  const hydratePerformance = usePerformanceStore((s) => s.hydrateFromApi);
  const getLeaveBalance = useLeaveAttendanceStore((s) => s.getLeaveBalance);
  const staffDebts = useStaffDebtStore((s) => s.debts);
  const hydrateDebts = useStaffDebtStore((s) => s.hydrateFromApi);
  const onboardingChecklists = useOnboardingStore((s) => s.checklists);
  const hydrateOnboarding = useOnboardingStore((s) => s.hydrateFromApi);
  const performanceLog = usePerformanceLogStore((s) => s.entries);
  const hydratePerformanceLog = usePerformanceLogStore((s) => s.hydrateFromApi);
  const staffChanges = useEmployeeChangesStore((s) => s.changes);
  const hydrateChanges = useEmployeeChangesStore((s) => s.hydrateFromApi);

  const departmentName = (id?: string) => departments.find((row) => row.id === id)?.name || id || '—';
  const positionTitle = (id?: string) => positions.find((row) => row.id === id)?.title || id || '—';
  const periodLabel = (id?: string) => payrollPeriods.find((row) => row.id === id)?.periodNumber || id || '—';
  const clockTime = (value?: Date | string) => {
    if (!value) return '—';
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? '—' : date.toLocaleTimeString('en-GH', { hour: '2-digit', minute: '2-digit' });
  };

  const hydrateAll = () => Promise.all([
    hydrateEmployees(), hydratePayroll(), hydrateLeave(), hydrateBenefits(), hydrateTraining(), hydratePerformance(),
    hydrateDebts(), hydrateOnboarding(), hydratePerformanceLog(), hydrateChanges(),
  ]);

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    setStartDate(today);
    setEndDate(today);
    setMounted(true);
  }, []);
  useEffect(() => {
    try {
      const saved = localStorage.getItem('hr.report-summary-preferences');
      if (saved) setHiddenKpisByReport(JSON.parse(saved));
      const savedColumns = localStorage.getItem('hr.report-column-preferences');
      if (savedColumns) setHiddenColumnsByReport(JSON.parse(savedColumns));
    } catch { /* ignore */ }
  }, []);
  useEffect(() => {
    hydrateAll().catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrateEmployees, hydratePayroll, hydrateLeave, hydrateBenefits, hydrateTraining, hydratePerformance, hydrateDebts, hydrateOnboarding, hydratePerformanceLog, hydrateChanges]);
  useEffect(() => {
    setGeneratedAt(new Date().toLocaleString('en-GH'));
  }, [selectedReport, selectedTab, startDate, endDate, refreshVersion, employees, payrollRecords, leaveRequests, attendances]);
  useEffect(() => {
    if (reportDateMode === 'range' && !RANGE_REPORT_KEYS.has(selectedReport)) {
      const today = new Date().toISOString().split('T')[0];
      setReportDateMode('today');
      setStartDate(today);
      setEndDate(today);
    }
  }, [selectedReport, reportDateMode]);
  useEffect(() => {
    setFilters(EMPTY_REPORT_FILTERS);
    setFiltersExpanded(false);
  }, [selectedReport]);

  const handleTabChange = (key: React.Key) => {
    const groupKey = key as ReportGroupKey;
    setSelectedTab(groupKey);
    setSelectedReport(REPORT_GROUPS[groupKey].reports[0][0]);
  };
  const handleRefresh = () => {
    hydrateAll().then(() => {
      setRefreshVersion((v) => v + 1);
      setGeneratedAt(new Date().toLocaleString('en-GH'));
    }).catch(() => setRefreshVersion((v) => v + 1));
  };

  const getCurrentReportData = () => {
    switch (selectedReport) {
      case 'employees':
        return employees.map((employee) => ({
          employeeNumber: employee.employeeNumber,
          name: `${employee.firstName} ${employee.lastName}`.trim(),
          department: departmentName(employee.departmentId),
          position: positionTitle(employee.positionId),
          employmentType: employee.employmentType,
          status: employee.status,
          hireDate: dayOf(employee.hireDate) || '—',
          salary: employee.salary || employee.basicSalary || 0,
          phone: employee.phone || '—',
          email: employee.email || '—',
        }));
      case 'payroll-records':
        return payrollRecords
          .filter((record) => {
            const period = payrollPeriods.find((row) => row.id === record.payrollPeriodId);
            if (period) return rangesOverlap(dayOf(period.startDate), dayOf(period.endDate), startDate, endDate);
            return inDateRange(dayOf(record.createdAt), startDate, endDate);
          })
          .map((record) => ({
            employeeNumber: record.employeeNumber,
            employeeName: record.employeeName,
            department: record.department,
            period: periodLabel(record.payrollPeriodId),
            basicSalary: record.basicSalary || 0,
            allowances: record.allowances || 0,
            overtimePay: record.overtimePay || 0,
            bonuses: record.bonuses || 0,
            grossPay: record.grossPay,
            tax: record.deductions?.tax || 0,
            socialSecurity: record.deductions?.socialSecurity || 0,
            pension: record.deductions?.pension || 0,
            tier3: record.deductions?.tier3 || 0,
            other: record.deductions?.other || 0,
            netPay: record.netPay,
            ties: payslipTies({
              grossPay: record.grossPay,
              tax: record.deductions?.tax,
              socialSecurity: record.deductions?.socialSecurity,
              pension: record.deductions?.pension,
              tier3: record.deductions?.tier3,
              other: record.deductions?.other,
              netPay: record.netPay,
            }) ? 'Yes' : 'No',
            status: record.status,
            paymentMethod: record.paymentMethod,
          }));
      case 'payroll-periods':
        return payrollPeriods
          .filter((period) => rangesOverlap(dayOf(period.startDate), dayOf(period.endDate), startDate, endDate))
          .map((period) => {
            const employer = savedEmployerContribution(period.notes) ?? 0;
            const gross = Number(period.totalGrossPay || 0);
            return {
              periodNumber: period.periodNumber,
              startDate: dayOf(period.startDate),
              endDate: dayOf(period.endDate),
              employeeCount: period.employeeCount,
              totalGrossPay: gross,
              employerContribution: employer,
              totalCost: round2(gross + employer),
              totalDeductions: period.totalDeductions,
              totalNetPay: period.totalNetPay,
              status: period.status,
            };
          });
      case 'payroll-cost-staff': {
        const lines = payrollCostLines(payrollRecords, payrollPeriods, startDate, endDate);
        const grouped = new Map<string, { employeeNumber: string; employeeName: string; department: string; periods: Set<string>; gross: number; employer: number }>();
        lines.forEach(({ record, gross, employer }) => {
          const key = record.employeeId || record.employeeNumber || record.employeeName || record.id;
          const current = grouped.get(key) || {
            employeeNumber: record.employeeNumber || '—',
            employeeName: record.employeeName || '—',
            department: record.department || '—',
            periods: new Set<string>(),
            gross: 0,
            employer: 0,
          };
          current.periods.add(record.payrollPeriodId);
          current.gross = round2(current.gross + gross);
          current.employer = round2(current.employer + employer);
          grouped.set(key, current);
        });
        return Array.from(grouped.values()).map((row) => ({
          employeeNumber: row.employeeNumber,
          employeeName: row.employeeName,
          department: row.department,
          runCount: row.periods.size,
          gross: row.gross,
          employer: row.employer,
          cost: round2(row.gross + row.employer),
        }));
      }
      case 'payroll-cost-department': {
        const lines = payrollCostLines(payrollRecords, payrollPeriods, startDate, endDate);
        const grouped = new Map<string, { staff: Set<string>; periods: Set<string>; gross: number; employer: number }>();
        lines.forEach(({ record, gross, employer }) => {
          const department = record.department || '—';
          const current = grouped.get(department) || { staff: new Set<string>(), periods: new Set<string>(), gross: 0, employer: 0 };
          current.staff.add(record.employeeId || record.employeeNumber || record.employeeName || record.id);
          current.periods.add(record.payrollPeriodId);
          current.gross = round2(current.gross + gross);
          current.employer = round2(current.employer + employer);
          grouped.set(department, current);
        });
        return Array.from(grouped.entries()).map(([department, row]) => ({
          department,
          staffCount: row.staff.size,
          runCount: row.periods.size,
          gross: row.gross,
          employer: row.employer,
          cost: round2(row.gross + row.employer),
        }));
      }
      case 'leave':
        return leaveRequests
          .filter((request) => rangesOverlap(dayOf(request.startDate), dayOf(request.endDate), startDate, endDate))
          .map((request) => ({
            employee: employeeName(employees, request.employeeId),
            leaveType: request.leaveType,
            startDate: dayOf(request.startDate),
            endDate: dayOf(request.endDate),
            totalDays: request.totalDays,
            status: request.status,
            reason: request.reason || '—',
          }));
      case 'attendance':
        return attendances
          .filter((row) => inDateRange(dayOf(row.date), startDate, endDate))
          .map((row) => ({
            employee: employeeName(employees, row.employeeId),
            date: dayOf(row.date),
            checkIn: clockTime(row.checkInTime),
            checkOut: clockTime(row.checkOutTime),
            totalHours: row.totalHours,
            overtimeHours: row.overtimeHours,
            status: row.status,
            shift: row.shift,
          }));
      case 'shifts':
        return shifts
          .filter((shift) => inDateRange(shift.date, startDate, endDate))
          .map((shift) => ({
            employee: employeeName(employees, shift.employeeId),
            date: shift.date,
            startTime: shift.startTime,
            endTime: shift.endTime,
            location: shift.location || '—',
          }));
      case 'departments':
        return departments.map((department) => {
          const staff = employees.filter((employee) => employee.departmentId === department.id);
          return {
            name: department.name,
            code: department.code || '—',
            headcount: staff.length,
            active: staff.filter((employee) => employee.status === 'active').length,
            status: department.status || (department.isActive ? 'active' : 'inactive'),
          };
        });
      case 'positions':
        return positions.map((position) => ({
          title: position.title,
          code: position.code || '—',
          department: departmentName(position.departmentId),
          headcount: employees.filter((employee) => employee.positionId === position.id).length,
          minSalary: position.minSalary ?? null,
          maxSalary: position.maxSalary ?? null,
          status: position.status || (position.isActive === false ? 'inactive' : 'active'),
        }));
      case 'onboarding':
        return Object.values(onboardingChecklists).map((checklist) => {
          const employee = employees.find((row) => row.id === checklist.employeeId);
          const open = (checklist.tasks || []).filter((task) => !task.completed);
          const done = (checklist.tasks || []).filter((task) => task.completed).length;
          return {
            employee: employee ? `${employee.firstName} ${employee.lastName}`.trim() : checklist.employeeId,
            department: departmentName(employee?.departmentId),
            startedAt: dayOf(checklist.startedAt) || '—',
            completed: done,
            total: checklist.tasks?.length || 0,
            status: checklist.completedAt ? 'complete' : 'open',
            openTasks: open.map((task) => task.label).join(', ') || '—',
          };
        });
      case 'staff-changes':
        return staffChanges
          .filter((change) => inDateRange(dayOf(change.timestamp), startDate, endDate))
          .map((change) => ({
            timestamp: change.timestamp ? new Date(change.timestamp).toLocaleString('en-GH') : '—',
            employee: change.employeeName || employeeName(employees, change.employeeId),
            type: change.type,
            field: change.field || '—',
            previousValue: change.previousValue == null || change.previousValue === '' ? '—' : String(change.previousValue),
            newValue: change.newValue == null || change.newValue === '' ? '—' : String(change.newValue),
            changedBy: change.changedBy || '—',
          }));
      case 'leave-balances': {
        const year = new Date().getFullYear();
        return employees
          .filter((employee) => employee.status === 'active')
          .flatMap((employee) => LEAVE_BALANCE_TYPES.map((leaveType) => {
            const balance = getLeaveBalance(employee.id, leaveType, year);
            return {
              employee: `${employee.firstName} ${employee.lastName}`.trim(),
              department: departmentName(employee.departmentId),
              leaveType,
              year,
              entitlement: balance.entitlement,
              used: balance.used,
              remaining: balance.remaining,
            };
          }))
          .filter((row) => row.entitlement > 0 || row.used > 0);
      }
      case 'staff-debts':
        return staffDebts.map((debt) => ({
          employee: employeeName(employees, debt.employeeId),
          type: debt.type,
          issuedDate: dayOf(debt.issuedDate) || '—',
          originalAmount: debt.originalAmount,
          remainingBalance: debt.remainingBalance,
          monthlyInstallment: debt.monthlyInstallment,
          status: debt.status,
          reason: debt.reason || '—',
        }));
      case 'performance-log':
        return performanceLog
          .filter((entry) => inDateRange(dayOf(entry.date), startDate, endDate))
          .map((entry) => ({
            date: dayOf(entry.date),
            employee: employeeName(employees, entry.employeeId),
            category: categoryLabel(entry.category),
            score: entry.score,
            note: entry.note || '—',
            status: entry.status,
            recordedBy: entry.recordedByName || '—',
          }));
      case 'labour-compliance':
        return computeLaborCompliance(employees, trainingPrograms, trainingEnrollments).checklist.map((item) => ({
          label: item.label,
          compliant: item.compliant,
          total: item.total,
          gap: Math.max(0, item.total - item.compliant),
        }));
      case 'benefits':
        return benefitEnrollments
          .filter((row) => inDateRange(dayOf(row.effectiveDate), startDate, endDate))
          .map((row) => ({
            employee: employeeName(employees, row.employeeId),
            packageName: benefitPackages.find((pkg) => pkg.id === row.benefitsPackageId)?.name || row.benefitsPackageId,
            status: row.status,
            effectiveDate: dayOf(row.effectiveDate),
            totalCost: row.totalCost || 0,
            employeeContribution: row.employeeContribution || 0,
            employerContribution: row.employerContribution || 0,
          }));
      case 'training':
        return trainingEnrollments
          .filter((row) => inDateRange(dayOf(row.enrollmentDate), startDate, endDate))
          .map((row) => ({
            employee: employeeName(employees, row.employeeId),
            program: trainingPrograms.find((program) => program.id === row.trainingProgramId)?.title || row.trainingProgramId,
            status: row.status,
            enrollmentDate: dayOf(row.enrollmentDate),
            score: row.score ?? '—',
            cost: row.cost || 0,
          }));
      case 'performance':
        return performanceReviews
          .filter((row) => inDateRange(dayOf(row.reviewDate), startDate, endDate))
          .map((row) => ({
            employee: employeeName(employees, row.employeeId),
            period: row.reviewPeriod,
            reviewDate: dayOf(row.reviewDate),
            rating: row.overallRating,
            status: row.status,
            reviewer: row.reviewerName || '—',
          }));
      default:
        return [];
    }
  };

  const reportData = mounted ? getCurrentReportData() : null;
  const rawRows = (Array.isArray(reportData) ? reportData : []) as Record<string, any>[];
  const fieldValue = (row: Record<string, any>, keys: string[]) => {
    const value = keys.map((key) => row[key]).find((candidate) => candidate !== undefined && candidate !== null && candidate !== '');
    return value === undefined ? '' : String(value);
  };
  const uniqueValues = (keys: string[]) =>
    Array.from(new Set(rawRows.map((row) => fieldValue(row, keys)).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  const filterOptions = {
    status: uniqueValues(['status']),
    type: uniqueValues(['employmentType', 'leaveType', 'type']),
    staff: uniqueValues(['name', 'employeeName', 'employee', 'changedBy', 'recordedBy']),
    category: uniqueValues(['department', 'position', 'category']),
    method: uniqueValues(['paymentMethod']),
  };
  const rows = rawRows.filter((row) => {
    const query = filters.query.trim().toLocaleLowerCase();
    const matchesQuery = !query || Object.values(row).some((value) => {
      const searchable = typeof value === 'object' ? JSON.stringify(value) : String(value ?? '');
      return searchable.toLocaleLowerCase().includes(query);
    });
    return matchesQuery
      && (filters.status === 'all' || fieldValue(row, ['status']) === filters.status)
      && (filters.type === 'all' || fieldValue(row, ['employmentType', 'leaveType', 'type']) === filters.type)
      && (filters.staff === 'all' || fieldValue(row, ['name', 'employeeName', 'employee', 'changedBy', 'recordedBy']) === filters.staff)
      && (filters.category === 'all' || fieldValue(row, ['department', 'position', 'category']) === filters.category)
      && (filters.method === 'all' || fieldValue(row, ['paymentMethod']) === filters.method);
  });
  const filteredReportData = Array.isArray(reportData) ? rows : reportData;
  const activeFilterCount = Object.entries(filters).filter(([key, value]) => key === 'query' ? Boolean(value.trim()) : value !== 'all').length;
  const facetDefinitions = ([
    { key: 'status', label: 'Status', options: filterOptions.status },
    { key: 'type', label: 'Type', options: filterOptions.type },
    { key: 'staff', label: 'Staff', options: filterOptions.staff },
    { key: 'category', label: 'Department', options: filterOptions.category },
    { key: 'method', label: 'Method', options: filterOptions.method },
  ] satisfies { key: Exclude<keyof ReportFilters, 'query'>; label: string; options: string[] }[])
    .filter((definition) => definition.options.length > 0);

  const availableColumns = REPORT_COLUMNS[selectedReport] || Object.keys(rawRows[0] || {}).map((key) => ({ key, label: labelize(key) }));
  const hasSavedColumnPreference = Object.prototype.hasOwnProperty.call(hiddenColumnsByReport, selectedReport);
  const hiddenColumnKeys = hasSavedColumnPreference
    ? hiddenColumnsByReport[selectedReport]
    : availableColumns.filter((column) => column.defaultVisible === false).map((column) => column.key);
  const visibleColumns = availableColumns.filter((column) => !hiddenColumnKeys.includes(column.key));
  const saveColumnPreferences = (hiddenKeys: string[]) => {
    const next = { ...hiddenColumnsByReport, [selectedReport]: hiddenKeys };
    setHiddenColumnsByReport(next);
    try { localStorage.setItem('hr.report-column-preferences', JSON.stringify(next)); } catch { /* ignore */ }
  };
  const exportableReportData = Array.isArray(filteredReportData)
    ? rows.map((row) => Object.fromEntries(visibleColumns.map((column) => [column.label, row[column.key]])))
    : filteredReportData;
  const reportLabel = REPORT_GROUPS[selectedTab].reports.find(([key]) => key === selectedReport)?.[1]
    || selectedReport.replace(/-/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

  const reportKpis = useMemo(() => {
    const count = rows.length;
    if (selectedReport === 'employees') {
      return [
        { label: 'Staff', value: count.toLocaleString(), hint: 'On file' },
        { label: 'Active', value: rows.filter((row) => row.status === 'active').length.toLocaleString(), hint: 'Current roster' },
        { label: 'On leave', value: rows.filter((row) => row.status === 'on_leave').length.toLocaleString(), hint: 'Employee status' },
        { label: 'Stored salary', value: money(rows.reduce((sum, row) => sum + Number(row.salary || 0), 0)), hint: 'Sum of file salaries' },
      ];
    }
    if (selectedReport === 'payroll-records') {
      const paid = rows.filter((row) => row.status === 'paid');
      return [
        { label: 'Payslips', value: count.toLocaleString(), hint: 'In period' },
        { label: 'Gross', value: money(rows.reduce((sum, row) => sum + Number(row.grossPay || 0), 0)), hint: 'Stored totals' },
        { label: 'Net', value: money(rows.reduce((sum, row) => sum + Number(row.netPay || 0), 0)), hint: 'Stored totals' },
        { label: 'Paid', value: paid.length.toLocaleString(), hint: 'Marked paid' },
        { label: 'Untied', value: rows.filter((row) => row.ties === 'No').length.toLocaleString(), hint: 'Gross minus deductions ≠ net' },
      ];
    }
    if (selectedReport === 'payroll-periods') {
      return [
        { label: 'Periods', value: count.toLocaleString(), hint: 'In range' },
        { label: 'Gross', value: money(rows.reduce((sum, row) => sum + Number(row.totalGrossPay || 0), 0)), hint: 'Period totals' },
        { label: 'Employer', value: money(rows.reduce((sum, row) => sum + Number(row.employerContribution || 0), 0)), hint: 'Saved on the month' },
        { label: 'Total cost', value: money(rows.reduce((sum, row) => sum + Number(row.totalCost || 0), 0)), hint: 'Gross plus employer' },
      ];
    }
    if (selectedReport === 'payroll-cost-staff' || selectedReport === 'payroll-cost-department') {
      return [
        { label: selectedReport === 'payroll-cost-staff' ? 'Staff' : 'Departments', value: count.toLocaleString(), hint: 'With a payslip in range' },
        { label: 'Gross', value: money(rows.reduce((sum, row) => sum + Number(row.gross || 0), 0)), hint: 'Payslip gross' },
        { label: 'Employer', value: money(rows.reduce((sum, row) => sum + Number(row.employer || 0), 0)), hint: 'Share of the saved month total' },
        { label: 'Total cost', value: money(rows.reduce((sum, row) => sum + Number(row.cost || 0), 0)), hint: 'Gross plus employer' },
      ];
    }
    if (selectedReport === 'leave') {
      return [
        { label: 'Requests', value: count.toLocaleString(), hint: 'Starting in period' },
        { label: 'Approved', value: rows.filter((row) => row.status === 'approved').length.toLocaleString(), hint: 'On file' },
        { label: 'Pending', value: rows.filter((row) => row.status === 'pending').length.toLocaleString(), hint: 'Awaiting decision' },
        { label: 'Days', value: rows.reduce((sum, row) => sum + Number(row.totalDays || 0), 0).toLocaleString(), hint: 'Requested days' },
      ];
    }
    if (selectedReport === 'positions') {
      return [
        { label: 'Positions', value: count.toLocaleString(), hint: 'On file' },
        { label: 'Active', value: rows.filter((row) => row.status === 'active').length.toLocaleString(), hint: 'Open on the file' },
        { label: 'Filled', value: rows.filter((row) => Number(row.headcount) > 0).length.toLocaleString(), hint: 'Have staff' },
        { label: 'Vacant', value: rows.filter((row) => Number(row.headcount) === 0).length.toLocaleString(), hint: 'No one assigned' },
      ];
    }
    if (selectedReport === 'onboarding') {
      return [
        { label: 'Checklists', value: count.toLocaleString(), hint: 'Started' },
        { label: 'Open', value: rows.filter((row) => row.status === 'open').length.toLocaleString(), hint: 'Not finished' },
        { label: 'Complete', value: rows.filter((row) => row.status === 'complete').length.toLocaleString(), hint: 'All tasks done' },
        { label: 'Open tasks', value: rows.reduce((sum, row) => sum + Math.max(0, Number(row.total || 0) - Number(row.completed || 0)), 0).toLocaleString(), hint: 'Still outstanding' },
      ];
    }
    if (selectedReport === 'staff-changes') {
      return [
        { label: 'Changes', value: count.toLocaleString(), hint: 'In period' },
        { label: 'Promotions', value: rows.filter((row) => row.type === 'promotion').length.toLocaleString(), hint: 'Logged type' },
        { label: 'Transfers', value: rows.filter((row) => row.type === 'transfer' || row.type === 'department_change').length.toLocaleString(), hint: 'Department or transfer' },
        { label: 'Salary', value: rows.filter((row) => row.type === 'salary_change').length.toLocaleString(), hint: 'Pay changes' },
      ];
    }
    if (selectedReport === 'leave-balances') {
      return [
        { label: 'Lines', value: count.toLocaleString(), hint: 'Staff and leave type' },
        { label: 'Entitled', value: rows.reduce((sum, row) => sum + Number(row.entitlement || 0), 0).toLocaleString(), hint: 'Current year' },
        { label: 'Used', value: rows.reduce((sum, row) => sum + Number(row.used || 0), 0).toLocaleString(), hint: 'Approved leave' },
        { label: 'Remaining', value: rows.reduce((sum, row) => sum + Number(row.remaining || 0), 0).toLocaleString(), hint: 'Still available' },
      ];
    }
    if (selectedReport === 'staff-debts') {
      return [
        { label: 'Debts', value: count.toLocaleString(), hint: 'On file' },
        { label: 'Active', value: rows.filter((row) => row.status === 'active').length.toLocaleString(), hint: 'Still owing' },
        { label: 'Remaining', value: money(rows.reduce((sum, row) => sum + Number(row.remainingBalance || 0), 0)), hint: 'Outstanding' },
        { label: 'Installments', value: money(rows.filter((row) => row.status === 'active').reduce((sum, row) => sum + Number(row.monthlyInstallment || 0), 0)), hint: 'Active monthly' },
      ];
    }
    if (selectedReport === 'performance-log') {
      return [
        { label: 'Entries', value: count.toLocaleString(), hint: 'In period' },
        { label: 'Commendations', value: rows.filter((row) => Number(row.score) > 0 && row.status !== 'voided').length.toLocaleString(), hint: 'Positive scores' },
        { label: 'Concerns', value: rows.filter((row) => Number(row.score) < 0 && row.status !== 'voided').length.toLocaleString(), hint: 'Negative scores' },
        { label: 'Voided', value: rows.filter((row) => row.status === 'voided').length.toLocaleString(), hint: 'Withdrawn' },
      ];
    }
    if (selectedReport === 'labour-compliance') {
      const met = rows.reduce((sum, row) => sum + Number(row.compliant || 0), 0);
      const applicable = rows.reduce((sum, row) => sum + Number(row.total || 0), 0);
      const score = computeLaborCompliance(employees, trainingPrograms, trainingEnrollments).score;
      return [
        { label: 'Checks', value: count.toLocaleString(), hint: 'On the labour list' },
        { label: 'Score', value: `${score}%`, hint: 'Same figure as the HR desk' },
        { label: 'Met', value: met.toLocaleString(), hint: 'Staff who pass a check' },
        { label: 'Gap', value: rows.reduce((sum, row) => sum + Number(row.gap || 0), 0).toLocaleString(), hint: applicable ? `Of ${applicable.toLocaleString()} applicable` : 'Nothing applicable' },
      ];
    }
    if (selectedReport === 'attendance') {
      return [
        { label: 'Records', value: count.toLocaleString(), hint: 'In period' },
        { label: 'Present', value: rows.filter((row) => row.status === 'present' || row.status === 'late').length.toLocaleString(), hint: 'On file' },
        { label: 'Hours', value: rows.reduce((sum, row) => sum + Number(row.totalHours || 0), 0).toLocaleString(undefined, { maximumFractionDigits: 1 }), hint: 'Logged hours' },
        { label: 'Overtime', value: rows.reduce((sum, row) => sum + Number(row.overtimeHours || 0), 0).toLocaleString(undefined, { maximumFractionDigits: 1 }), hint: 'Logged OT' },
      ];
    }
    return [
      { label: 'Records', value: count.toLocaleString(), hint: 'Matching the filters' },
      { label: 'Period start', value: NO_DATE_REPORT_KEYS.has(selectedReport) ? '—' : startDate, hint: 'Selected' },
      { label: 'Period end', value: NO_DATE_REPORT_KEYS.has(selectedReport) ? '—' : endDate, hint: reportDateMode === 'range' ? 'Inclusive' : 'Single day' },
      { label: 'Status', value: 'Current', hint: generatedAt ? `Refreshed ${generatedAt}` : 'Preparing report' },
    ];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedReport, startDate, endDate, reportDateMode, generatedAt, refreshVersion, mounted, filters, employees, payrollRecords, payrollPeriods, leaveRequests, attendances, shifts, positions, onboardingChecklists, staffChanges, staffDebts, performanceLog, trainingPrograms, trainingEnrollments]);

  const hiddenKpiLabels = hiddenKpisByReport[selectedReport] || [];
  const visibleReportKpis = reportKpis.filter((kpi) => !hiddenKpiLabels.includes(kpi.label));
  const saveKpiPreferences = (hiddenLabels: string[]) => {
    const next = { ...hiddenKpisByReport, [selectedReport]: hiddenLabels };
    setHiddenKpisByReport(next);
    try { localStorage.setItem('hr.report-summary-preferences', JSON.stringify(next)); } catch { /* ignore */ }
  };
  const summaryCustomizationControls = (
    <>
      {hiddenKpiLabels.length > 0 && (
        <Button size="sm" variant="light" startContent={<RotateCcw size={14} />} onPress={() => saveKpiPreferences([])}>Restore metrics</Button>
      )}
      <Dropdown closeOnSelect={false}>
        <DropdownTrigger>
          <Button size="sm" variant="bordered" startContent={<SlidersHorizontal size={14} />}>Customize summary</Button>
        </DropdownTrigger>
        <DropdownMenu aria-label="Choose summary metrics" selectionMode="multiple" selectedKeys={new Set(visibleReportKpis.map((kpi) => kpi.label))} onSelectionChange={(keys) => {
          const visibleLabels = keys === 'all' ? reportKpis.map((kpi) => kpi.label) : Array.from(keys).map(String);
          saveKpiPreferences(reportKpis.filter((kpi) => !visibleLabels.includes(kpi.label)).map((kpi) => kpi.label));
        }}>
          {reportKpis.map((kpi) => <DropdownItem key={kpi.label}>{kpi.label}</DropdownItem>) as any}
        </DropdownMenu>
      </Dropdown>
    </>
  );

  const handleExportReport = async (data: unknown, format: 'pdf' | 'excel' | 'csv') => {
    setIsGenerating(true);
    try {
      const extension = format === 'excel' ? 'xls' : format;
      const filename = `${selectedReport}_report_${startDate}.${extension}`;
      const generatedLabel = generatedAt ? `Generated on ${generatedAt} by ${currentUserLabel}` : undefined;
      const sections = reportDataToSections(data);
      const blob = format === 'csv'
        ? new Blob([sectionsToCSV(sections, orgProfile, generatedLabel)], { type: 'text/csv' })
        : format === 'excel'
        ? new Blob([sectionsToExcelHtml(reportLabel, sections, orgProfile, generatedLabel)], { type: 'application/vnd.ms-excel' })
        : await sectionsToPdfBlob(reportLabel, sections, orgProfile, generatedLabel);
      const fileUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = fileUrl;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(fileUrl);
    } finally {
      setIsGenerating(false);
    }
  };

  const renderReportTable = () => {
    if (!mounted || reportData === null) {
      return <div className="py-8 text-center"><p className="text-gray-500">Preparing report…</p></div>;
    }
    if (rows.length === 0) {
      return (
        <div className="py-8 text-center">
          <p className="text-gray-500">{activeFilterCount > 0 ? 'No records match the active filters. Clear or adjust the filters to continue.' : 'No data available for the selected report and date.'}</p>
        </div>
      );
    }
    return (
      <SortableReportTable
        ariaLabel={`${selectedReport} report table`}
        columns={visibleColumns}
        rows={rows}
        renderCell={(row, column) => (
          typeof row[column.key] === 'number' && /(pay|salary|tax|social|deduction|gross|net|amount|cost|balance|installment|allowance|bonus|pension|employer|^tier3$|^other$)/i.test(column.key)
            ? money(row[column.key] as number)
            : formatReportValue(row[column.key])
        )}
      />
    );
  };

  const showDateControls = !NO_DATE_REPORT_KEYS.has(selectedReport);
  const rangeAllowed = RANGE_REPORT_KEYS.has(selectedReport);

  return (
    <div className={embedded ? 'px-2 py-1' : 'min-h-screen bg-slate-50/70 p-4 md:p-6'}>
      <div className="mx-auto max-w-[1600px] space-y-2">
        <div className="flex flex-col gap-1.5 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="mb-0.5 flex items-center gap-2 text-sm font-semibold text-blue-700">
              <BarChart3 size={16} />
              HR INTELLIGENCE
            </div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-2xl font-bold tracking-tight text-slate-950 md:text-3xl">Reports & Analysis</h1>
              <ReportPageInfoTip text="Staff, positions, onboarding, payroll, leave, debts, training, performance and the labour checklist on file." />
            </div>
          </div>
          <div className="flex shrink-0 flex-nowrap items-center gap-1.5 overflow-x-auto">
            <Button size="sm" variant="flat" className="shrink-0" startContent={<RefreshCw size={16} />} onPress={handleRefresh}>Refresh</Button>
            <Button size="sm" variant="bordered" className="shrink-0" startContent={<StickyNote size={16} />} onPress={onOpen}>Notes</Button>
            <Button size="sm" variant="bordered" className="shrink-0" startContent={<Printer size={16} />} onPress={() => window.print()}>Print</Button>
            <Dropdown>
              <DropdownTrigger>
                <Button size="sm" color="primary" className="shrink-0" startContent={<ArrowDownToLine size={16} />} isLoading={isGenerating}>Export</Button>
              </DropdownTrigger>
              <DropdownMenu aria-label="Export report">
                <DropdownItem key="pdf" startContent={<FileText size={16} />} onPress={() => handleExportReport(exportableReportData, 'pdf')}>Download PDF</DropdownItem>
                <DropdownItem key="excel" startContent={<FileSpreadsheet size={16} />} onPress={() => handleExportReport(exportableReportData, 'excel')}>Download Excel</DropdownItem>
                <DropdownItem key="csv" startContent={<ArrowDownToLine size={16} />} onPress={() => handleExportReport(exportableReportData, 'csv')}>Download CSV</DropdownItem>
              </DropdownMenu>
            </Dropdown>
          </div>
        </div>

        <Card className="border border-slate-200 shadow-sm">
          <CardBody className="gap-2 px-3 py-2">
            <Tabs selectedKey={selectedTab} onSelectionChange={handleTabChange} aria-label="Report categories" color="primary" variant="underlined" classNames={{ tabList: 'gap-3', cursor: 'w-full', tab: 'px-0 h-8' }}>
              {Object.entries(REPORT_GROUPS).map(([key, group]) => <Tab key={key} title={group.title} />)}
            </Tabs>
            <div className="flex flex-col gap-2 min-[900px]:flex-row min-[900px]:items-end min-[900px]:justify-between min-[900px]:gap-3">
              <Select
                label="Report"
                className="w-full max-w-full min-[900px]:w-64 min-[900px]:max-w-[16rem] min-[900px]:shrink-0"
                classNames={{ trigger: 'min-h-[48px] h-[48px] py-1', label: 'text-xs', value: 'text-sm' }}
                selectedKeys={[selectedReport]}
                onSelectionChange={(keys) => {
                  const next = Array.from(keys)[0] as string;
                  const allowed: string[] = REPORT_GROUPS[selectedTab].reports.map(([key]) => key);
                  if (next && allowed.includes(next)) setSelectedReport(next);
                }}
                startContent={<TrendingUp size={15} className="text-slate-400" />}
              >
                {REPORT_GROUPS[selectedTab].reports.map(([key, label]) => <SelectItem key={key} textValue={label}>{label}</SelectItem>)}
              </Select>
              {showDateControls && (
                <div className="flex min-w-0 flex-col items-stretch min-[900px]:items-end">
                  <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500 min-[900px]:justify-end">
                    <CalendarDays size={14} /> Reporting period
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 min-[900px]:flex-nowrap min-[900px]:justify-end">
                    {(['today', 'specific', 'range'] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => {
                          if (mode === 'today') {
                            const today = new Date().toISOString().split('T')[0];
                            setStartDate(today);
                            setEndDate(today);
                          }
                          setReportDateMode(mode);
                        }}
                        disabled={mode === 'range' && !rangeAllowed}
                        className={`shrink-0 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition ${
                          reportDateMode === mode
                            ? 'border-blue-600 bg-blue-600 text-white'
                            : mode === 'range' && !rangeAllowed
                            ? 'cursor-not-allowed border-slate-200 bg-slate-50 text-slate-300'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-blue-400'
                        }`}
                      >
                        {mode === 'today' ? 'Today' : mode === 'specific' ? 'Specific date' : 'Date range'}
                      </button>
                    ))}
                    {reportDateMode === 'specific' && (
                      <Input aria-label="Report date" type="date" value={startDate} onChange={(event) => { setStartDate(event.target.value); setEndDate(event.target.value); }} className="w-[8.5rem] max-w-[8.5rem] shrink-0" classNames={{ inputWrapper: 'w-[8.5rem] max-w-[8.5rem]', input: 'text-xs' }} size="sm" />
                    )}
                    {reportDateMode === 'range' && rangeAllowed && (
                      <>
                        <Input aria-label="Start date" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="w-[8.5rem] max-w-[8.5rem] shrink-0" classNames={{ inputWrapper: 'w-[8.5rem] max-w-[8.5rem]', input: 'text-xs' }} size="sm" />
                        <span className="shrink-0 text-sm text-slate-400">to</span>
                        <Input aria-label="End date" type="date" value={endDate} min={startDate} onChange={(event) => setEndDate(event.target.value)} className="w-[8.5rem] max-w-[8.5rem] shrink-0" classNames={{ inputWrapper: 'w-[8.5rem] max-w-[8.5rem]', input: 'text-xs' }} size="sm" />
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
            {(rawRows.length > 0 || facetDefinitions.length > 0) && (
              <div className="border-t border-slate-100 pt-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Input aria-label="Search report results" placeholder="Name, staff no., department..." value={filters.query} onValueChange={(query) => setFilters((current) => ({ ...current, query }))} startContent={<Search size={16} className="text-slate-400" />} size="sm" className="w-full sm:w-64 lg:w-72" />
                  {facetDefinitions.length > 0 && (
                    <Button size="sm" variant={filtersExpanded ? 'solid' : 'bordered'} color={filtersExpanded ? 'primary' : 'default'} startContent={<Filter size={14} />} onPress={() => setFiltersExpanded((expanded) => !expanded)}>
                      Filters{activeFilterCount > (filters.query ? 1 : 0) ? ` (${activeFilterCount - (filters.query ? 1 : 0)})` : ''}
                    </Button>
                  )}
                  {facetDefinitions.filter((definition) => filters[definition.key] !== 'all').map((definition) => (
                    <Chip key={definition.key} size="sm" variant="flat" color="primary" onClose={() => setFilters((current) => ({ ...current, [definition.key]: 'all' }))}>
                      {definition.label}: {filters[definition.key]}
                    </Chip>
                  ))}
                  <span className="ml-auto text-xs text-slate-500">Showing {rows.length} of {rawRows.length}</span>
                  {activeFilterCount > 0 && (
                    <Button size="sm" variant="light" color="danger" startContent={<X size={14} />} onPress={() => { setFilters(EMPTY_REPORT_FILTERS); setFiltersExpanded(false); }}>Clear</Button>
                  )}
                </div>
                {filtersExpanded && facetDefinitions.length > 0 && (
                  <div className="mt-3 grid gap-2 border-t border-slate-100 pt-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
                    {facetDefinitions.map((definition) => (
                      <Select
                        key={definition.key}
                        aria-label={definition.label}
                        label={definition.label}
                        size="sm"
                        selectedKeys={[filters[definition.key]]}
                        onSelectionChange={(keys) => {
                          const value = (Array.from(keys)[0] as string) || 'all';
                          setFilters((current) => ({ ...current, [definition.key]: value }));
                          setFiltersExpanded(false);
                        }}
                      >
                        <SelectItem key="all">All {definition.label.toLocaleLowerCase()}s</SelectItem>
                        {definition.options.map((option) => <SelectItem key={option}>{option}</SelectItem>) as any}
                      </Select>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardBody>
        </Card>

        <Card className="border border-slate-200 shadow-sm">
          <CardBody className="overflow-x-auto px-3 py-1.5">
            <div className="flex min-w-max items-center gap-3">
              <div className="flex flex-1 items-center divide-x divide-slate-200">
                {visibleReportKpis.length > 0 ? visibleReportKpis.map((kpi) => (
                  <div key={kpi.label} className="flex items-baseline gap-1.5 px-3 first:pl-0 last:pr-0">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{kpi.label}</span>
                    <span className="text-sm font-bold text-slate-950">{kpi.value}</span>
                  </div>
                )) : <p className="pr-3 text-sm text-slate-500">All summary metrics are hidden.</p>}
              </div>
              <div className="ml-auto flex shrink-0 items-center gap-1.5 border-l border-slate-200 pl-3">{summaryCustomizationControls}</div>
            </div>
          </CardBody>
        </Card>

        <Card id="report-print-area" className="border border-slate-200 shadow-sm">
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-slate-100 px-4 py-1.5">
            <div className="min-w-0">
              <div className="hidden print:block">
                <h2 className="text-xl font-bold">{orgProfile.name}</h2>
                {(orgProfile.address || orgProfile.phone || orgProfile.email) && (
                  <p className="text-xs text-slate-500">
                    {[orgProfile.address, orgProfile.phone, orgProfile.email].filter(Boolean).join(' · ')}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <h2 className="text-lg font-bold text-slate-950">{reportLabel}</h2>
                <ReportPageInfoTip text={REPORT_DESCRIPTIONS[selectedReport] || REPORT_GROUPS[selectedTab].description} label={`About ${reportLabel}`} />
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <div className="whitespace-nowrap text-[11px] text-slate-500">
                {NO_DATE_REPORT_KEYS.has(selectedReport) ? 'Current snapshot' : startDate === endDate ? startDate : `${startDate} – ${endDate}`}
                <span className="mx-1.5 text-slate-300">·</span>
                Generated {generatedAt ?? '…'} by {currentUserLabel}
              </div>
              {Array.isArray(reportData) && availableColumns.length > 0 && (
                <Dropdown closeOnSelect={false}>
                  <DropdownTrigger>
                    <Button size="sm" variant="bordered" startContent={<SlidersHorizontal size={14} />}>Columns</Button>
                  </DropdownTrigger>
                  <DropdownMenu aria-label="Choose table columns" selectionMode="multiple" disallowEmptySelection selectedKeys={new Set(visibleColumns.map((column) => column.key))} onSelectionChange={(keys) => {
                    const selected = keys === 'all' ? availableColumns.map((column) => column.key) : Array.from(keys).map(String);
                    saveColumnPreferences(availableColumns.filter((column) => !selected.includes(column.key)).map((column) => column.key));
                  }}>
                    {availableColumns.map((column) => <DropdownItem key={column.key}>{column.label}</DropdownItem>) as any}
                  </DropdownMenu>
                </Dropdown>
              )}
            </div>
          </CardHeader>
          <CardBody className="p-3 sm:p-5">
            {renderReportTable()}
            {reportNotes && (
              <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">Notes</p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-amber-950">{reportNotes}</p>
              </div>
            )}
          </CardBody>
        </Card>
      </div>
      <Modal isOpen={isOpen} onClose={onClose} size="2xl">
        <ModalContent>
          <ModalHeader>Add Report Notes</ModalHeader>
          <ModalBody>
            <Textarea label="Report Notes" placeholder="Add any additional notes or observations about this report..." value={reportNotes} onChange={(event) => setReportNotes(event.target.value)} minRows={4} />
          </ModalBody>
          <ModalFooter>
            <Button variant="bordered" onPress={onClose}>Cancel</Button>
            <Button color="primary" onPress={onClose}>Save Notes</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
