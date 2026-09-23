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
import { housekeepingStore } from '../lib/housekeeping/store';
import { useSettingsStore } from '../lib/settings/store';
import { buildOrgProfile } from '../lib/print/buildOrgProfile';
import { reportDataToSections, sectionsToCSV, sectionsToExcelHtml, sectionsToPdfBlob } from '../lib/frontoffice/reportExportFormat';
import type { HousekeepingTask, MaintenanceRequest, RoomInspection } from '../lib/housekeeping/types';

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
  return `GH₵ ${value.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function inDateRange(day: string, startDate: string, endDate: string) {
  return Boolean(day) && day >= startDate && day <= endDate;
}

function dayOf(iso?: string) {
  return (iso || '').slice(0, 10);
}

function formatWhen(iso?: string) {
  return iso ? new Date(iso).toLocaleString('en-GH') : '—';
}

function taskDay(task: HousekeepingTask) {
  return dayOf(task.completedAt || task.startedAt || task.assignedAt);
}

function taskInRange(task: HousekeepingTask, startDate: string, endDate: string) {
  const day = taskDay(task);
  return day ? inDateRange(day, startDate, endDate) : true;
}

const RANGE_REPORT_KEYS = new Set(['tasks', 'inspections', 'maintenance']);
const NO_DATE_REPORT_KEYS = new Set(['rooms', 'staff']);

const REPORT_GROUPS = {
  rooms: {
    title: 'Rooms',
    description: 'Floor status and cleaning tasks.',
    reports: [
      ['rooms', 'Room Status'],
      ['tasks', 'Tasks'],
    ],
  },
  quality: {
    title: 'Quality',
    description: 'Room inspections and scores on file.',
    reports: [
      ['inspections', 'Inspections'],
    ],
  },
  maintenance: {
    title: 'Maintenance',
    description: 'Work orders and recorded cost.',
    reports: [
      ['maintenance', 'Work Orders'],
    ],
  },
  staff: {
    title: 'Staff',
    description: 'Housekeeping roster and today\'s throughput.',
    reports: [
      ['staff', 'Staff'],
    ],
  },
} as const;

type ReportGroupKey = keyof typeof REPORT_GROUPS;
type ReportFilters = {
  query: string;
  status: string;
  roomType: string;
  staff: string;
  category: string;
  priority: string;
};

const EMPTY_REPORT_FILTERS: ReportFilters = {
  query: '',
  status: 'all',
  roomType: 'all',
  staff: 'all',
  category: 'all',
  priority: 'all',
};

const REPORT_DESCRIPTIONS: Record<string, string> = {
  rooms: 'Current housekeeping condition of every configured room.',
  tasks: 'Cleaning and turnover tasks for the selected period.',
  inspections: 'Recorded room inspections, scores and follow-up.',
  maintenance: 'Maintenance work orders, status and recorded cost.',
  staff: 'Active roster, today\'s completed tasks and stored efficiency.',
};

type ReportColumnDefinition = { key: string; label: string; defaultVisible?: boolean };

const REPORT_COLUMNS: Record<string, ReportColumnDefinition[]> = {
  rooms: [
    { key: 'roomNumber', label: 'Room' },
    { key: 'roomType', label: 'Room type' },
    { key: 'status', label: 'Status' },
    { key: 'currentGuest', label: 'Guest' },
    { key: 'checkOutDate', label: 'Departure', defaultVisible: false },
    { key: 'lastUpdated', label: 'Last updated' },
    { key: 'notes', label: 'Notes', defaultVisible: false },
  ],
  tasks: [
    { key: 'id', label: 'Task' },
    { key: 'roomNumber', label: 'Room' },
    { key: 'taskType', label: 'Type' },
    { key: 'priority', label: 'Priority' },
    { key: 'status', label: 'Status' },
    { key: 'assignedTo', label: 'Assigned' },
    { key: 'estimatedMinutes', label: 'Est. min' },
    { key: 'actualMinutes', label: 'Actual min' },
    { key: 'startedAt', label: 'Started', defaultVisible: false },
    { key: 'completedAt', label: 'Completed' },
  ],
  inspections: [
    { key: 'id', label: 'Inspection' },
    { key: 'roomNumber', label: 'Room' },
    { key: 'inspectorName', label: 'Inspector' },
    { key: 'inspectionDate', label: 'Date' },
    { key: 'status', label: 'Result' },
    { key: 'score', label: 'Score' },
    { key: 'followUpRequired', label: 'Follow-up' },
    { key: 'notes', label: 'Notes', defaultVisible: false },
  ],
  maintenance: [
    { key: 'id', label: 'Work order' },
    { key: 'roomNumber', label: 'Room' },
    { key: 'category', label: 'Category' },
    { key: 'priority', label: 'Priority' },
    { key: 'status', label: 'Status' },
    { key: 'reportedBy', label: 'Reported by' },
    { key: 'reportedAt', label: 'Reported' },
    { key: 'assignedTo', label: 'Assigned', defaultVisible: false },
    { key: 'cost', label: 'Cost' },
    { key: 'completedAt', label: 'Completed', defaultVisible: false },
    { key: 'description', label: 'Description' },
  ],
  staff: [
    { key: 'name', label: 'Name' },
    { key: 'role', label: 'Role' },
    { key: 'active', label: 'Active' },
    { key: 'completedToday', label: 'Completed today' },
    { key: 'dailyTarget', label: 'Daily target' },
    { key: 'efficiency', label: 'Efficiency' },
    { key: 'currentTasks', label: 'Open tasks' },
  ],
};

export default function HousekeepingReportsAnalysis() {
  const [selectedTab, setSelectedTab] = useState<ReportGroupKey>('rooms');
  const [selectedReport, setSelectedReport] = useState('rooms');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
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
  const [storeTick, setStoreTick] = useState(0);

  const settings = useSettingsStore();
  const orgProfile = buildOrgProfile(settings);
  const currentUserLabel = settings.currentUser
    ? `${settings.currentUser.firstName} ${settings.currentUser.lastName}`.trim() || settings.currentUser.email
    : 'System';

  const roomTypeName = (typeId?: string) =>
    settings.roomManagement.roomTypes.find((type) => type.id === typeId)?.name || typeId || '—';

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('housekeeping.report-summary-preferences');
      if (saved) setHiddenKpisByReport(JSON.parse(saved));
      const savedColumns = localStorage.getItem('housekeeping.report-column-preferences');
      if (savedColumns) setHiddenColumnsByReport(JSON.parse(savedColumns));
    } catch {
      // A blocked or malformed local preference should never prevent reporting.
    }
  }, []);

  useEffect(() => {
    housekeepingStore.hydrateFromApi();
    const unsub = housekeepingStore.subscribe(() => setStoreTick((tick) => tick + 1));
    return unsub;
  }, []);

  useEffect(() => {
    setGeneratedAt(new Date().toLocaleString('en-GH'));
  }, [selectedReport, selectedTab, startDate, endDate, refreshVersion, storeTick]);

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
    housekeepingStore.hydrateFromApi().then(() => {
      setRefreshVersion((version) => version + 1);
      setGeneratedAt(new Date().toLocaleString('en-GH'));
    });
  };

  const getCurrentReportData = () => {
    switch (selectedReport) {
      case 'rooms':
        return housekeepingStore.getAllRooms().map((room) => ({
          roomNumber: room.roomNumber,
          roomType: roomTypeName(room.roomTypeId),
          status: room.status,
          currentGuest: room.currentGuest || '—',
          checkOutDate: room.checkOutDate ? dayOf(room.checkOutDate) : '—',
          lastUpdated: formatWhen(room.lastUpdated),
          notes: room.notes || '—',
        }));
      case 'tasks':
        return housekeepingStore.getAllTasks()
          .filter((task) => taskInRange(task, startDate, endDate))
          .map((task) => ({
            id: task.id,
            roomNumber: task.roomNumber,
            taskType: task.taskType,
            priority: task.priority,
            status: task.status,
            assignedTo: task.assignedTo || 'Unassigned',
            estimatedMinutes: task.estimatedMinutes,
            actualMinutes: task.actualMinutes ?? null,
            startedAt: formatWhen(task.startedAt),
            completedAt: formatWhen(task.completedAt),
          }));
      case 'inspections':
        return housekeepingStore.getAllInspections()
          .filter((row: RoomInspection) => {
            const day = dayOf(row.inspectionDate);
            return day ? inDateRange(day, startDate, endDate) : true;
          })
          .map((row) => ({
            id: row.id,
            roomNumber: row.roomNumber,
            inspectorName: row.inspectorName,
            inspectionDate: formatWhen(row.inspectionDate),
            status: row.status,
            score: row.score,
            followUpRequired: row.followUpRequired,
            notes: row.notes || '—',
          }));
      case 'maintenance':
        return housekeepingStore.getAllMaintenanceRequests()
          .filter((row: MaintenanceRequest) => {
            const day = dayOf(row.reportedAt);
            return day ? inDateRange(day, startDate, endDate) : true;
          })
          .map((row) => ({
            id: row.id,
            roomNumber: row.roomNumber,
            category: row.category,
            priority: row.priority,
            status: row.status,
            reportedBy: row.reportedBy || '—',
            reportedAt: formatWhen(row.reportedAt),
            assignedTo: row.assignedTo || 'Unassigned',
            cost: row.actualCost ?? row.estimatedCost ?? null,
            completedAt: formatWhen(row.completedAt),
            description: row.description || '—',
          }));
      case 'staff':
        return housekeepingStore.getAllStaff().map((member) => ({
          name: member.name,
          role: member.role,
          active: member.active,
          completedToday: member.completedToday,
          dailyTarget: member.dailyTarget,
          efficiency: member.efficiency,
          currentTasks: member.currentTasks?.length || 0,
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
    roomType: uniqueValues(['roomType', 'taskType']),
    staff: uniqueValues(['assignedTo', 'inspectorName', 'name', 'reportedBy']),
    category: uniqueValues(['category', 'role']),
    priority: uniqueValues(['priority']),
  };
  const rows = rawRows.filter((row) => {
    const query = filters.query.trim().toLocaleLowerCase();
    const matchesQuery = !query || Object.values(row).some((value) => {
      const searchable = typeof value === 'object' ? JSON.stringify(value) : String(value ?? '');
      return searchable.toLocaleLowerCase().includes(query);
    });
    return matchesQuery
      && (filters.status === 'all' || fieldValue(row, ['status']) === filters.status)
      && (filters.roomType === 'all' || fieldValue(row, ['roomType', 'taskType']) === filters.roomType)
      && (filters.staff === 'all' || fieldValue(row, ['assignedTo', 'inspectorName', 'name', 'reportedBy']) === filters.staff)
      && (filters.category === 'all' || fieldValue(row, ['category', 'role']) === filters.category)
      && (filters.priority === 'all' || fieldValue(row, ['priority']) === filters.priority);
  });
  const filteredReportData = Array.isArray(reportData) ? rows : reportData;
  const activeFilterCount = Object.entries(filters).filter(([key, value]) => key === 'query' ? Boolean(value.trim()) : value !== 'all').length;
  const facetDefinitions = ([
    { key: 'status', label: 'Status', options: filterOptions.status },
    { key: 'roomType', label: 'Type', options: filterOptions.roomType },
    { key: 'staff', label: 'Staff', options: filterOptions.staff },
    { key: 'category', label: 'Category', options: filterOptions.category },
    { key: 'priority', label: 'Priority', options: filterOptions.priority },
  ] satisfies { key: Exclude<keyof ReportFilters, 'query'>; label: string; options: string[] }[])
    .filter((definition) => definition.options.length > 0);

  const availableColumns = REPORT_COLUMNS[selectedReport]
    || Object.keys(rawRows[0] || {}).map((key) => ({ key, label: labelize(key) }));
  const hasSavedColumnPreference = Object.prototype.hasOwnProperty.call(hiddenColumnsByReport, selectedReport);
  const hiddenColumnKeys = hasSavedColumnPreference
    ? hiddenColumnsByReport[selectedReport]
    : availableColumns.filter((column) => column.defaultVisible === false).map((column) => column.key);
  const visibleColumns = availableColumns.filter((column) => !hiddenColumnKeys.includes(column.key));
  const saveColumnPreferences = (hiddenKeys: string[]) => {
    const next = { ...hiddenColumnsByReport, [selectedReport]: hiddenKeys };
    setHiddenColumnsByReport(next);
    try {
      localStorage.setItem('housekeeping.report-column-preferences', JSON.stringify(next));
    } catch {
      // Column choices remain active for this session if storage is blocked.
    }
  };
  const exportableReportData = Array.isArray(filteredReportData)
    ? rows.map((row) => Object.fromEntries(visibleColumns.map((column) => [column.label, row[column.key]])))
    : filteredReportData;
  const reportLabel = REPORT_GROUPS[selectedTab].reports.find(([key]) => key === selectedReport)?.[1]
    || selectedReport.replace(/-/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

  const reportKpis = useMemo(() => {
    const count = rows.length;
    if (selectedReport === 'rooms') {
      return [
        { label: 'Rooms', value: count.toLocaleString(), hint: 'Configured inventory' },
        { label: 'Dirty', value: rows.filter((row) => row.status === 'dirty').length.toLocaleString(), hint: 'Need cleaning' },
        { label: 'Clean / inspected', value: rows.filter((row) => row.status === 'clean' || row.status === 'inspected').length.toLocaleString(), hint: 'Ready for sale' },
        { label: 'Out of order', value: rows.filter((row) => row.status === 'out-of-order' || row.status === 'maintenance').length.toLocaleString(), hint: 'Blocked' },
      ];
    }
    if (selectedReport === 'tasks') {
      return [
        { label: 'Tasks', value: count.toLocaleString(), hint: 'In period' },
        { label: 'Pending', value: rows.filter((row) => row.status === 'pending').length.toLocaleString(), hint: 'Not started' },
        { label: 'In progress', value: rows.filter((row) => row.status === 'in-progress').length.toLocaleString(), hint: 'On the floor' },
        { label: 'Completed', value: rows.filter((row) => row.status === 'completed' || row.status === 'verified').length.toLocaleString(), hint: 'Done' },
      ];
    }
    if (selectedReport === 'inspections') {
      const scores = rows.map((row) => Number(row.score || 0)).filter((value) => value > 0);
      const avg = scores.length ? scores.reduce((sum, value) => sum + value, 0) / scores.length : 0;
      return [
        { label: 'Inspections', value: count.toLocaleString(), hint: 'In period' },
        { label: 'Passed', value: rows.filter((row) => row.status === 'passed').length.toLocaleString(), hint: 'Clear' },
        { label: 'Failed', value: rows.filter((row) => row.status === 'failed').length.toLocaleString(), hint: 'Need re-clean' },
        { label: 'Avg score', value: scores.length ? avg.toLocaleString(undefined, { maximumFractionDigits: 1 }) : '—', hint: 'Recorded score' },
      ];
    }
    if (selectedReport === 'maintenance') {
      const cost = rows.reduce((sum, row) => sum + Number(row.cost || 0), 0);
      return [
        { label: 'Work orders', value: count.toLocaleString(), hint: 'In period' },
        { label: 'Open', value: rows.filter((row) => row.status === 'reported' || row.status === 'assigned' || row.status === 'in-progress').length.toLocaleString(), hint: 'Not finished' },
        { label: 'Completed', value: rows.filter((row) => row.status === 'completed' || row.status === 'verified').length.toLocaleString(), hint: 'Closed' },
        { label: 'Recorded cost', value: money(cost), hint: 'Actual, else estimate' },
      ];
    }
    if (selectedReport === 'staff') {
      return [
        { label: 'Staff', value: count.toLocaleString(), hint: 'On the roster' },
        { label: 'Active', value: rows.filter((row) => row.active).length.toLocaleString(), hint: 'On duty file' },
        { label: 'Completed today', value: rows.reduce((sum, row) => sum + Number(row.completedToday || 0), 0).toLocaleString(), hint: 'Stored throughput' },
        { label: 'Open tasks', value: rows.reduce((sum, row) => sum + Number(row.currentTasks || 0), 0).toLocaleString(), hint: 'Currently assigned' },
      ];
    }
    return [
      { label: 'Records', value: count.toLocaleString(), hint: 'Matching the filters' },
      { label: 'Period start', value: NO_DATE_REPORT_KEYS.has(selectedReport) ? '—' : startDate, hint: 'Business date' },
      { label: 'Period end', value: NO_DATE_REPORT_KEYS.has(selectedReport) ? '—' : endDate, hint: reportDateMode === 'range' ? 'Inclusive' : 'Single day' },
      { label: 'Status', value: 'Current', hint: generatedAt ? `Refreshed ${generatedAt}` : 'Preparing report' },
    ];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedReport, startDate, endDate, reportDateMode, generatedAt, refreshVersion, mounted, filters, storeTick]);

  const hiddenKpiLabels = hiddenKpisByReport[selectedReport] || [];
  const visibleReportKpis = reportKpis.filter((kpi) => !hiddenKpiLabels.includes(kpi.label));
  const saveKpiPreferences = (hiddenLabels: string[]) => {
    const next = { ...hiddenKpisByReport, [selectedReport]: hiddenLabels };
    setHiddenKpisByReport(next);
    try {
      localStorage.setItem('housekeeping.report-summary-preferences', JSON.stringify(next));
    } catch {
      // Keep the in-session preference even when storage is unavailable.
    }
  };
  const summaryCustomizationControls = (
    <>
      {hiddenKpiLabels.length > 0 && (
        <Button size="sm" variant="light" startContent={<RotateCcw size={14} />} onPress={() => saveKpiPreferences([])}>
          Restore metrics
        </Button>
      )}
      <Dropdown closeOnSelect={false}>
        <DropdownTrigger>
          <Button size="sm" variant="bordered" startContent={<SlidersHorizontal size={14} />}>
            Customize summary
          </Button>
        </DropdownTrigger>
        <DropdownMenu
          aria-label="Choose summary metrics"
          selectionMode="multiple"
          selectedKeys={new Set(visibleReportKpis.map((kpi) => kpi.label))}
          onSelectionChange={(keys) => {
            const visibleLabels = keys === 'all'
              ? reportKpis.map((kpi) => kpi.label)
              : Array.from(keys).map(String);
            saveKpiPreferences(reportKpis.filter((kpi) => !visibleLabels.includes(kpi.label)).map((kpi) => kpi.label));
          }}
        >
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
    } catch (error) {
      console.error('[HK REPORTS] Error exporting report:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const renderReportTable = () => {
    if (!mounted || reportData === null) {
      return (
        <div className="py-8 text-center">
          <p className="text-gray-500">Preparing report…</p>
        </div>
      );
    }
    if (rows.length === 0) {
      return (
        <div className="py-8 text-center">
          <p className="text-gray-500">
            {activeFilterCount > 0
              ? 'No records match the active filters. Clear or adjust the filters to continue.'
              : 'No data available for the selected report and date.'}
          </p>
        </div>
      );
    }
    return (
      <Table aria-label={`${selectedReport} report table`} classNames={{ base: 'overflow-x-auto', table: 'min-w-max' }}>
        <TableHeader>
          {visibleColumns.map((column) => (
            <TableColumn key={column.key}>{column.label}</TableColumn>
          ))}
        </TableHeader>
        <TableBody>
          {rows.map((row: any, index: number) => (
            <TableRow key={index}>
              {visibleColumns.map((column) => (
                <TableCell key={column.key}>
                  {typeof row[column.key] === 'number' && /(cost|amount|value|price)/i.test(column.key)
                    ? money(row[column.key])
                    : typeof row[column.key] === 'number' && /(efficiency)/i.test(column.key)
                    ? `${row[column.key].toLocaleString('en-GH', { maximumFractionDigits: 1 })}%`
                    : typeof row[column.key] === 'boolean'
                    ? (row[column.key] ? 'Yes' : 'No')
                    : row[column.key] === null || row[column.key] === undefined
                    ? '—'
                    : formatReportValue(row[column.key])}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50/70 p-4 md:p-6">
      <div className="mx-auto max-w-[1600px] space-y-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-blue-700">
              <BarChart3 size={18} />
              HOUSEKEEPING INTELLIGENCE
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-950">Reports & Analysis</h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-600">
              Room status, tasks, inspections and maintenance from one workspace.
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
            <Tabs
              selectedKey={selectedTab}
              onSelectionChange={handleTabChange}
              aria-label="Report categories"
              color="primary"
              variant="underlined"
              classNames={{ tabList: 'gap-5', cursor: 'w-full', tab: 'px-0 h-10' }}
            >
              {Object.entries(REPORT_GROUPS).map(([key, group]) => (
                <Tab key={key} title={group.title} />
              ))}
            </Tabs>

            <div className="grid gap-4 lg:grid-cols-[minmax(260px,1fr)_2fr]">
              <Select
                label="Report"
                selectedKeys={[selectedReport]}
                onSelectionChange={(keys) => {
                  const next = Array.from(keys)[0] as string;
                  if (next) setSelectedReport(next);
                }}
                startContent={<TrendingUp size={16} className="text-slate-400" />}
              >
                {REPORT_GROUPS[selectedTab].reports.map(([key, label]) => (
                  <SelectItem key={key}>{label}</SelectItem>
                ))}
              </Select>

              {!NO_DATE_REPORT_KEYS.has(selectedReport) && (
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
                        disabled={mode === 'range' && !RANGE_REPORT_KEYS.has(selectedReport)}
                        className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                          reportDateMode === mode
                            ? 'border-blue-600 bg-blue-600 text-white'
                            : mode === 'range' && !RANGE_REPORT_KEYS.has(selectedReport)
                            ? 'cursor-not-allowed border-slate-200 bg-slate-50 text-slate-300'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-blue-400'
                        }`}
                      >
                        {mode === 'today' ? 'Today' : mode === 'specific' ? 'Specific date' : 'Date range'}
                      </button>
                    ))}
                    {reportDateMode === 'specific' && (
                      <Input
                        aria-label="Report date"
                        type="date"
                        value={startDate}
                        onChange={(event) => {
                          setStartDate(event.target.value);
                          setEndDate(event.target.value);
                        }}
                        className="w-44"
                        size="sm"
                      />
                    )}
                    {reportDateMode === 'range' && RANGE_REPORT_KEYS.has(selectedReport) && (
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
                  <Input
                    aria-label="Search report results"
                    placeholder="Room, staff, task..."
                    value={filters.query}
                    onValueChange={(query) => setFilters((current) => ({ ...current, query }))}
                    startContent={<Search size={16} className="text-slate-400" />}
                    size="sm"
                    className="w-full sm:w-64 lg:w-72"
                  />
                  {facetDefinitions.length > 0 && (
                    <Button
                      size="sm"
                      variant={filtersExpanded ? 'solid' : 'bordered'}
                      color={filtersExpanded ? 'primary' : 'default'}
                      startContent={<Filter size={14} />}
                      onPress={() => setFiltersExpanded((expanded) => !expanded)}
                    >
                      Filters{activeFilterCount > (filters.query ? 1 : 0) ? ` (${activeFilterCount - (filters.query ? 1 : 0)})` : ''}
                    </Button>
                  )}
                  {facetDefinitions
                    .filter((definition) => filters[definition.key] !== 'all')
                    .map((definition) => (
                      <Chip
                        key={definition.key}
                        size="sm"
                        variant="flat"
                        color="primary"
                        onClose={() => setFilters((current) => ({ ...current, [definition.key]: 'all' }))}
                      >
                        {definition.label}: {filters[definition.key]}
                      </Chip>
                    ))}
                  <span className="ml-auto text-xs text-slate-500">Showing {rows.length} of {rawRows.length}</span>
                  {activeFilterCount > 0 && (
                    <Button size="sm" variant="light" color="danger" startContent={<X size={14} />} onPress={() => { setFilters(EMPTY_REPORT_FILTERS); setFiltersExpanded(false); }}>
                      Clear
                    </Button>
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
                )) : (
                  <p className="pr-4 text-sm text-slate-500">All summary metrics are hidden.</p>
                )}
              </div>
              <div className="ml-auto flex shrink-0 items-center gap-2 border-l border-slate-200 pl-4">
                {summaryCustomizationControls}
              </div>
            </div>
          </CardBody>
        </Card>

        <Card id="report-print-area" className="border border-slate-200 shadow-sm">
          <CardHeader className="flex flex-col items-start gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="hidden print:block">
                <h2 className="text-xl font-bold">{orgProfile.name}</h2>
                {(orgProfile.address || orgProfile.phone || orgProfile.email) && (
                  <p className="text-xs text-slate-500">
                    {[orgProfile.address, orgProfile.phone, orgProfile.email].filter(Boolean).join(' · ')}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-bold text-slate-950">{reportLabel}</h2>
                <Chip size="sm" color="primary" variant="flat">{REPORT_GROUPS[selectedTab].title}</Chip>
              </div>
              <p className="mt-1 text-sm text-slate-500">{REPORT_DESCRIPTIONS[selectedReport]}</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-left text-xs text-slate-500 sm:text-right">
                <div>{NO_DATE_REPORT_KEYS.has(selectedReport) ? 'Current snapshot' : startDate === endDate ? startDate : `${startDate} – ${endDate}`}</div>
                <div>Generated {generatedAt ?? '…'} by {currentUserLabel}</div>
              </div>
              {Array.isArray(reportData) && availableColumns.length > 0 && (
                <Dropdown closeOnSelect={false}>
                  <DropdownTrigger>
                    <Button size="sm" variant="bordered" startContent={<SlidersHorizontal size={14} />}>Columns</Button>
                  </DropdownTrigger>
                  <DropdownMenu
                    aria-label="Choose table columns"
                    selectionMode="multiple"
                    disallowEmptySelection
                    selectedKeys={new Set(visibleColumns.map((column) => column.key))}
                    onSelectionChange={(keys) => {
                      const selected = keys === 'all'
                        ? availableColumns.map((column) => column.key)
                        : Array.from(keys).map(String);
                      saveColumnPreferences(availableColumns.filter((column) => !selected.includes(column.key)).map((column) => column.key));
                    }}
                  >
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
            <Textarea
              label="Report Notes"
              placeholder="Add any additional notes or observations about this report..."
              value={reportNotes}
              onChange={(event) => setReportNotes(event.target.value)}
              minRows={4}
            />
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
