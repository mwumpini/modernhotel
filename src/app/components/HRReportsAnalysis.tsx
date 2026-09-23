'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Card, CardBody, CardHeader, Button, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell,
  Tabs, Tab, Select, SelectItem, Input, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter,
  useDisclosure, Textarea, Dropdown, DropdownTrigger, DropdownMenu, DropdownItem, Chip
} from '@heroui/react';
import {
  ArrowDownToLine, BarChart3, CalendarDays, FileSpreadsheet, FileText,
  Filter, Printer, RefreshCw, RotateCcw, Search, SlidersHorizontal, StickyNote, TrendingUp, X
} from 'lucide-react';
import { useEmployeeStore } from '../lib/hr/employeeStore';
import { usePayrollStore } from '../lib/hr/payrollStore';
import { useLeaveAttendanceStore } from '../lib/hr/leaveAttendanceStore';
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
  return `₵${Number(value || 0).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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

function employeeName(employees: { id: string; firstName: string; lastName: string }[], id?: string) {
  const employee = employees.find((row) => row.id === id);
  return employee ? `${employee.firstName} ${employee.lastName}`.trim() : id || '—';
}

const RANGE_REPORT_KEYS = new Set(['payroll-records', 'payroll-periods', 'leave', 'attendance', 'shifts']);
const NO_DATE_REPORT_KEYS = new Set(['employees']);

const REPORT_GROUPS = {
  people: {
    title: 'People',
    description: 'Staff on the HR file, as recorded.',
    reports: [
      ['employees', 'Employees'],
    ],
  },
  payroll: {
    title: 'Payroll',
    description: 'Payroll periods and payslips on file — no reconstructed PAYE or SSNIT.',
    reports: [
      ['payroll-records', 'Payroll Records'],
      ['payroll-periods', 'Payroll Periods'],
    ],
  },
  time: {
    title: 'Time',
    description: 'Leave, attendance and shifts already captured.',
    reports: [
      ['leave', 'Leave Requests'],
      ['attendance', 'Attendance'],
      ['shifts', 'Shifts'],
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
  'payroll-records': 'Payslip lines saved for the selected period. Tax and SSNIT are the amounts already stored on each record.',
  'payroll-periods': 'Payroll runs on file, with the totals saved when the period was processed.',
  leave: 'Leave requests whose start date falls in the selected period.',
  attendance: 'Clock records for the selected period.',
  shifts: 'Scheduled shifts for the selected period.',
};

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
    { key: 'grossPay', label: 'Gross' },
    { key: 'tax', label: 'Tax' },
    { key: 'socialSecurity', label: 'SSNIT' },
    { key: 'netPay', label: 'Net' },
    { key: 'status', label: 'Status' },
    { key: 'paymentMethod', label: 'Method', defaultVisible: false },
  ],
  'payroll-periods': [
    { key: 'periodNumber', label: 'Period' },
    { key: 'startDate', label: 'Start' },
    { key: 'endDate', label: 'End' },
    { key: 'employeeCount', label: 'Staff' },
    { key: 'totalGrossPay', label: 'Gross' },
    { key: 'totalDeductions', label: 'Deductions' },
    { key: 'totalNetPay', label: 'Net' },
    { key: 'status', label: 'Status' },
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
};

export default function HRReportsAnalysis() {
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

  const departmentName = (id?: string) => departments.find((row) => row.id === id)?.name || id || '—';
  const positionTitle = (id?: string) => positions.find((row) => row.id === id)?.title || id || '—';
  const periodLabel = (id?: string) => payrollPeriods.find((row) => row.id === id)?.periodNumber || id || '—';
  const clockTime = (value?: Date | string) => {
    if (!value) return '—';
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? '—' : date.toLocaleTimeString('en-GH', { hour: '2-digit', minute: '2-digit' });
  };

  const hydrateAll = () => Promise.all([hydrateEmployees(), hydratePayroll(), hydrateLeave()]);

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
  }, [hydrateEmployees, hydratePayroll, hydrateLeave]);
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
            const day = dayOf(period?.startDate) || dayOf(record.createdAt);
            return inDateRange(day, startDate, endDate);
          })
          .map((record) => ({
            employeeNumber: record.employeeNumber,
            employeeName: record.employeeName,
            department: record.department,
            period: periodLabel(record.payrollPeriodId),
            grossPay: record.grossPay,
            tax: record.deductions?.tax || 0,
            socialSecurity: record.deductions?.socialSecurity || 0,
            netPay: record.netPay,
            status: record.status,
            paymentMethod: record.paymentMethod,
          }));
      case 'payroll-periods':
        return payrollPeriods
          .filter((period) => inDateRange(dayOf(period.startDate), startDate, endDate))
          .map((period) => ({
            periodNumber: period.periodNumber,
            startDate: dayOf(period.startDate),
            endDate: dayOf(period.endDate),
            employeeCount: period.employeeCount,
            totalGrossPay: period.totalGrossPay,
            totalDeductions: period.totalDeductions,
            totalNetPay: period.totalNetPay,
            status: period.status,
          }));
      case 'leave':
        return leaveRequests
          .filter((request) => inDateRange(dayOf(request.startDate), startDate, endDate))
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
    type: uniqueValues(['employmentType', 'leaveType']),
    staff: uniqueValues(['name', 'employeeName', 'employee']),
    category: uniqueValues(['department', 'position']),
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
      && (filters.type === 'all' || fieldValue(row, ['employmentType', 'leaveType']) === filters.type)
      && (filters.staff === 'all' || fieldValue(row, ['name', 'employeeName', 'employee']) === filters.staff)
      && (filters.category === 'all' || fieldValue(row, ['department', 'position']) === filters.category)
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
      ];
    }
    if (selectedReport === 'payroll-periods') {
      return [
        { label: 'Periods', value: count.toLocaleString(), hint: 'In range' },
        { label: 'Gross', value: money(rows.reduce((sum, row) => sum + Number(row.totalGrossPay || 0), 0)), hint: 'Period totals' },
        { label: 'Net', value: money(rows.reduce((sum, row) => sum + Number(row.totalNetPay || 0), 0)), hint: 'Period totals' },
        { label: 'Staff lines', value: rows.reduce((sum, row) => sum + Number(row.employeeCount || 0), 0).toLocaleString(), hint: 'Saved counts' },
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
  }, [selectedReport, startDate, endDate, reportDateMode, generatedAt, refreshVersion, mounted, filters, employees, payrollRecords, payrollPeriods, leaveRequests, attendances, shifts]);

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
      <Table aria-label={`${selectedReport} report table`} classNames={{ base: 'overflow-x-auto', table: 'min-w-max' }}>
        <TableHeader>
          {visibleColumns.map((column) => <TableColumn key={column.key}>{column.label}</TableColumn>)}
        </TableHeader>
        <TableBody>
          {rows.map((row: any, index: number) => (
            <TableRow key={index}>
              {visibleColumns.map((column) => (
                <TableCell key={column.key}>
                  {typeof row[column.key] === 'number' && /(pay|salary|tax|social|deduction|gross|net|amount)/i.test(column.key)
                    ? money(row[column.key])
                    : formatReportValue(row[column.key])}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  };

  const showDateControls = !NO_DATE_REPORT_KEYS.has(selectedReport);
  const rangeAllowed = RANGE_REPORT_KEYS.has(selectedReport);

  return (
    <div className="min-h-screen bg-slate-50/70 p-4 md:p-6">
      <div className="mx-auto max-w-[1600px] space-y-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-blue-700">
              <BarChart3 size={18} />
              HR INTELLIGENCE
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-950">Reports & Analysis</h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-600">
              Employees, payroll and time records on file. Statutory filings stay in Compliance Reports.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="flat" startContent={<RefreshCw size={16} />} onPress={handleRefresh}>Refresh</Button>
            <Button variant="bordered" startContent={<StickyNote size={16} />} onPress={onOpen}>Notes</Button>
            <Button variant="bordered" startContent={<Printer size={16} />} onPress={() => window.print()}>Print</Button>
            <Dropdown>
              <DropdownTrigger>
                <Button color="primary" startContent={<ArrowDownToLine size={16} />} isLoading={isGenerating}>Export</Button>
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
          <CardBody className="gap-4 p-4">
            <Tabs selectedKey={selectedTab} onSelectionChange={handleTabChange} aria-label="Report categories" color="primary" variant="underlined" classNames={{ tabList: 'gap-5', cursor: 'w-full', tab: 'px-0 h-10' }}>
              {Object.entries(REPORT_GROUPS).map(([key, group]) => <Tab key={key} title={group.title} />)}
            </Tabs>
            <div className="grid gap-4 lg:grid-cols-[minmax(260px,1fr)_2fr]">
              <Select label="Report" selectedKeys={[selectedReport]} onSelectionChange={(keys) => {
                const next = Array.from(keys)[0] as string;
                const allowed = REPORT_GROUPS[selectedTab].reports.map(([key]) => key);
                if (next && allowed.includes(next)) setSelectedReport(next);
              }} startContent={<TrendingUp size={16} className="text-slate-400" />}>
                {REPORT_GROUPS[selectedTab].reports.map(([key, label]) => <SelectItem key={key} textValue={label}>{label}</SelectItem>)}
              </Select>
              {showDateControls && (
                <div>
                  <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <CalendarDays size={14} /> Reporting period
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
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
                        className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${
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
                      <Input aria-label="Report date" type="date" value={startDate} onChange={(event) => { setStartDate(event.target.value); setEndDate(event.target.value); }} className="w-44" size="sm" />
                    )}
                    {reportDateMode === 'range' && rangeAllowed && (
                      <>
                        <Input aria-label="Start date" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="w-44" size="sm" />
                        <span className="text-sm text-slate-400">to</span>
                        <Input aria-label="End date" type="date" value={endDate} min={startDate} onChange={(event) => setEndDate(event.target.value)} className="w-44" size="sm" />
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
            {rawRows.length > 0 && (
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
          <CardBody className="overflow-x-auto px-4 py-3">
            <div className="flex min-w-max items-center gap-4">
              <div className="flex flex-1 items-center divide-x divide-slate-200">
                {visibleReportKpis.length > 0 ? visibleReportKpis.map((kpi) => (
                  <div key={kpi.label} className="flex items-baseline gap-2 px-4 first:pl-0 last:pr-0">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{kpi.label}</span>
                    <span className="text-base font-bold text-slate-950">{kpi.value}</span>
                  </div>
                )) : <p className="pr-4 text-sm text-slate-500">All summary metrics are hidden.</p>}
              </div>
              <div className="ml-auto flex shrink-0 items-center gap-2 border-l border-slate-200 pl-4">{summaryCustomizationControls}</div>
            </div>
          </CardBody>
        </Card>

        <Card id="report-print-area" className="border border-slate-200 shadow-sm">
          <CardHeader className="flex flex-col items-start gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-bold text-slate-950">{reportLabel}</h2>
                <Chip size="sm" color="primary" variant="flat">{REPORT_GROUPS[selectedTab].title}</Chip>
              </div>
              <p className="mt-1 text-sm text-slate-500">{REPORT_DESCRIPTIONS[selectedReport]}</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-left text-xs text-slate-500 sm:text-right">
                <div>{NO_DATE_REPORT_KEYS.has(selectedReport) ? 'Current file' : startDate === endDate ? startDate : `${startDate} – ${endDate}`}</div>
                <div>Generated {generatedAt ?? '…'} by {currentUserLabel}</div>
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
          <CardBody className="p-5">
            {renderReportTable()}
            {reportNotes && (
              <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-amber-800">Report notes</div>
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
