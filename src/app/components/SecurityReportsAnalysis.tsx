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
import { useIncidentStore } from '../lib/security/incidentStore';
import { usePatrolStore } from '../lib/security/patrolStore';
import { useVisitorStore } from '../lib/security/visitorStore';
import { useShiftStore } from '../lib/security/shiftStore';
import { usePersonnelStore } from '../lib/security/personnelStore';
import { useComplianceStore } from '../lib/security/complianceStore';
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

function clockTime(value?: Date | string | null) {
  if (!value) return '—';
  if (typeof value === 'string' && /^\d{1,2}:\d{2}/.test(value) && !value.includes('T')) {
    const [hour, minute] = value.split(':');
    return `${hour.padStart(2, '0')}:${minute.slice(0, 2)}`;
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const RANGE_REPORT_KEYS = new Set(['incidents', 'patrols', 'checkpoints', 'visitors', 'shifts']);
const NO_DATE_REPORT_KEYS = new Set(['personnel', 'compliance']);

const REPORT_GROUPS = {
  watch: {
    title: 'Watch & Patrols',
    description: 'Incidents, patrol logs and the checkpoints on those patrols.',
    reports: [
      ['incidents', 'Incidents'],
      ['patrols', 'Patrols'],
      ['checkpoints', 'Checkpoints'],
    ],
  },
  access: {
    title: 'Access',
    description: 'Visitor and duty-shift records on file.',
    reports: [
      ['visitors', 'Visitors'],
      ['shifts', 'Shifts'],
    ],
  },
  roster: {
    title: 'Roster',
    description: 'Listed security personnel and compliance obligations.',
    reports: [
      ['personnel', 'Personnel'],
      ['compliance', 'Compliance'],
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
  incidents: 'Incidents whose report date falls in the selected period. Cost is only shown when it was entered.',
  patrols: 'Patrols that started in the selected period. Checkpoint counts come from the stored log.',
  checkpoints: 'Each checkpoint on a patrol that started in the selected period.',
  compliance: 'Compliance obligations on file, with the next due date and any stored penalty.',
  visitors: 'Visitors who checked in during the selected period.',
  shifts: 'Duty shifts whose check-in falls in the selected period.',
  personnel: 'Security personnel currently listed. Not a computed roster score.',
};

type ReportColumnDefinition = { key: string; label: string; defaultVisible?: boolean };

const REPORT_COLUMNS: Record<string, ReportColumnDefinition[]> = {
  incidents: [
    { key: 'incidentNumber', label: 'Incident' },
    { key: 'reportedAt', label: 'Reported' },
    { key: 'type', label: 'Type' },
    { key: 'severity', label: 'Severity' },
    { key: 'location', label: 'Location' },
    { key: 'status', label: 'Status' },
    { key: 'reportedBy', label: 'Reported by' },
    { key: 'assignedTo', label: 'Assigned', defaultVisible: false },
    { key: 'cost', label: 'Cost', defaultVisible: false },
  ],
  patrols: [
    { key: 'patrolNumber', label: 'Patrol' },
    { key: 'startDate', label: 'Date' },
    { key: 'officerName', label: 'Officer' },
    { key: 'route', label: 'Route' },
    { key: 'status', label: 'Status' },
    { key: 'checkpoints', label: 'Stops' },
    { key: 'completed', label: 'Done' },
    { key: 'missed', label: 'Missed' },
  ],
  checkpoints: [
    { key: 'patrolNumber', label: 'Patrol' },
    { key: 'startDate', label: 'Date' },
    { key: 'officerName', label: 'Officer' },
    { key: 'route', label: 'Route' },
    { key: 'location', label: 'Checkpoint' },
    { key: 'scheduledTime', label: 'Due' },
    { key: 'actualTime', label: 'Checked' },
    { key: 'status', label: 'Status' },
    { key: 'notes', label: 'Notes', defaultVisible: false },
  ],
  visitors: [
    { key: 'visitorNumber', label: 'Visitor' },
    { key: 'name', label: 'Name' },
    { key: 'checkInDate', label: 'In date' },
    { key: 'checkInTime', label: 'In' },
    { key: 'checkOutTime', label: 'Out' },
    { key: 'purpose', label: 'Purpose' },
    { key: 'hostName', label: 'Host' },
    { key: 'status', label: 'Status' },
    { key: 'escortRequired', label: 'Escort' },
  ],
  shifts: [
    { key: 'personName', label: 'Person' },
    { key: 'checkInDate', label: 'Date' },
    { key: 'checkInTime', label: 'In' },
    { key: 'checkOutTime', label: 'Out' },
    { key: 'status', label: 'Status' },
    { key: 'notes', label: 'Notes', defaultVisible: false },
  ],
  personnel: [
    { key: 'name', label: 'Name' },
    { key: 'role', label: 'Role' },
    { key: 'agency', label: 'Agency' },
    { key: 'phone', label: 'Phone' },
    { key: 'isActive', label: 'Active' },
  ],
  compliance: [
    { key: 'title', label: 'Requirement' },
    { key: 'category', label: 'Category' },
    { key: 'frequency', label: 'Frequency' },
    { key: 'lastCompletedAt', label: 'Last done' },
    { key: 'nextDueDate', label: 'Next due' },
    { key: 'responsiblePerson', label: 'Responsible' },
    { key: 'penaltyAmount', label: 'Penalty' },
    { key: 'overdue', label: 'Overdue' },
  ],
};

export default function SecurityReportsAnalysis({ embedded = false }: { embedded?: boolean } = {}) {
  const [selectedTab, setSelectedTab] = useState<ReportGroupKey>('watch');
  const [selectedReport, setSelectedReport] = useState('incidents');
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

  const settings = useSettingsStore();
  const orgProfile = buildOrgProfile(settings);
  const currentUserLabel = settings.currentUser
    ? `${settings.currentUser.firstName} ${settings.currentUser.lastName}`.trim() || settings.currentUser.email
    : 'System';

  const incidents = useIncidentStore((s) => s.incidents);
  const hydrateIncidents = useIncidentStore((s) => s.hydrateFromApi);
  const patrols = usePatrolStore((s) => s.patrols);
  const hydratePatrols = usePatrolStore((s) => s.hydrateFromApi);
  const visitors = useVisitorStore((s) => s.visitors);
  const hydrateVisitors = useVisitorStore((s) => s.hydrateFromApi);
  const shifts = useShiftStore((s) => s.shifts);
  const hydrateShifts = useShiftStore((s) => s.hydrateFromApi);
  const personnel = usePersonnelStore((s) => s.personnel);
  const hydratePersonnel = usePersonnelStore((s) => s.hydrateFromApi);
  const requirements = useComplianceStore((s) => s.requirements);
  const hydrateCompliance = useComplianceStore((s) => s.hydrateFromApi);

  const hydrateAll = () => Promise.all([hydrateIncidents(), hydratePatrols(), hydrateVisitors(), hydrateShifts(), hydratePersonnel(), hydrateCompliance()]);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    try {
      const saved = localStorage.getItem('security.report-summary-preferences');
      if (saved) setHiddenKpisByReport(JSON.parse(saved));
      const savedColumns = localStorage.getItem('security.report-column-preferences');
      if (savedColumns) setHiddenColumnsByReport(JSON.parse(savedColumns));
    } catch { /* ignore */ }
  }, []);
  useEffect(() => {
    hydrateAll().catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrateIncidents, hydratePatrols, hydrateVisitors, hydrateShifts, hydratePersonnel, hydrateCompliance]);
  useEffect(() => {
    setGeneratedAt(new Date().toLocaleString('en-GH'));
  }, [selectedReport, selectedTab, startDate, endDate, refreshVersion, incidents, patrols, visitors, shifts, requirements]);
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
      case 'incidents':
        return incidents
          .filter((row) => inDateRange(dayOf(row.reportedAt), startDate, endDate))
          .map((row) => ({
            incidentNumber: row.incidentNumber,
            reportedAt: dayOf(row.reportedAt),
            type: row.type,
            severity: row.severity,
            location: row.location,
            status: row.status,
            reportedBy: row.reportedBy,
            assignedTo: row.assignedTo || '—',
            cost: row.cost,
          }));
      case 'patrols':
        return patrols
          .filter((row) => inDateRange(dayOf(row.startTime), startDate, endDate))
          .map((row) => {
            const checkpoints = row.checkpoints || [];
            return {
              patrolNumber: row.patrolNumber,
              startDate: dayOf(row.startTime),
              officerName: row.officerName,
              route: row.route,
              status: row.status,
              checkpoints: checkpoints.length,
              completed: checkpoints.filter((checkpoint) => checkpoint.status === 'completed').length,
              missed: checkpoints.filter((checkpoint) => checkpoint.status === 'missed').length,
            };
          });
      case 'checkpoints':
        return patrols
          .filter((row) => inDateRange(dayOf(row.startTime), startDate, endDate))
          .flatMap((row) => (row.checkpoints || []).map((checkpoint) => ({
            patrolNumber: row.patrolNumber,
            startDate: dayOf(row.startTime),
            officerName: row.officerName || '—',
            route: row.route || '—',
            location: checkpoint.location || '—',
            scheduledTime: clockTime(checkpoint.scheduledTime),
            actualTime: clockTime(checkpoint.actualTime),
            status: checkpoint.status,
            notes: checkpoint.notes || '—',
          })));
      case 'visitors':
        return visitors
          .filter((row) => inDateRange(dayOf(row.checkInTime), startDate, endDate))
          .map((row) => ({
            visitorNumber: row.visitorNumber,
            name: row.name,
            checkInDate: dayOf(row.checkInTime),
            checkInTime: clockTime(row.checkInTime),
            checkOutTime: clockTime(row.checkOutTime),
            purpose: row.purpose,
            hostName: row.hostName || '—',
            status: row.status,
            escortRequired: row.escortRequired,
          }));
      case 'shifts':
        return shifts
          .filter((row) => inDateRange(dayOf(row.checkInTime), startDate, endDate))
          .map((row) => ({
            personName: row.personName,
            checkInDate: dayOf(row.checkInTime),
            checkInTime: clockTime(row.checkInTime),
            checkOutTime: clockTime(row.checkOutTime),
            status: row.status,
            notes: row.notes || '—',
          }));
      case 'personnel':
        return personnel.map((row) => ({
          name: row.name,
          role: row.role || '—',
          agency: row.agency || '—',
          phone: row.phone || '—',
          isActive: row.isActive,
        }));
      case 'compliance': {
        const today = new Date().toISOString().split('T')[0];
        return requirements.map((row) => ({
          title: row.title,
          category: row.category,
          frequency: row.frequency,
          lastCompletedAt: row.lastCompletedAt ? dayOf(row.lastCompletedAt) : '—',
          nextDueDate: dayOf(row.nextDueDate) || '—',
          responsiblePerson: row.responsiblePerson || '—',
          penaltyAmount: row.penaltyAmount ?? null,
          overdue: Boolean(dayOf(row.nextDueDate) && dayOf(row.nextDueDate) < today),
        }));
      }
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
    type: uniqueValues(['type', 'severity']),
    staff: uniqueValues(['reportedBy', 'officerName', 'personName', 'name', 'hostName', 'responsiblePerson']),
    category: uniqueValues(['location', 'route', 'agency', 'category']),
    method: uniqueValues(['purpose']),
  };
  const rows = rawRows.filter((row) => {
    const query = filters.query.trim().toLocaleLowerCase();
    const matchesQuery = !query || Object.values(row).some((value) => {
      const searchable = typeof value === 'object' ? JSON.stringify(value) : String(value ?? '');
      return searchable.toLocaleLowerCase().includes(query);
    });
    return matchesQuery
      && (filters.status === 'all' || fieldValue(row, ['status']) === filters.status)
      && (filters.type === 'all' || fieldValue(row, ['type', 'severity']) === filters.type)
      && (filters.staff === 'all' || fieldValue(row, ['reportedBy', 'officerName', 'personName', 'name', 'hostName', 'responsiblePerson']) === filters.staff)
      && (filters.category === 'all' || fieldValue(row, ['location', 'route', 'agency', 'category']) === filters.category)
      && (filters.method === 'all' || fieldValue(row, ['purpose']) === filters.method);
  });
  const filteredReportData = Array.isArray(reportData) ? rows : reportData;
  const activeFilterCount = Object.entries(filters).filter(([key, value]) => key === 'query' ? Boolean(value.trim()) : value !== 'all').length;
  const facetDefinitions = ([
    { key: 'status', label: 'Status', options: filterOptions.status },
    { key: 'type', label: 'Type', options: filterOptions.type },
    { key: 'staff', label: 'Person', options: filterOptions.staff },
    { key: 'category', label: 'Place', options: filterOptions.category },
    { key: 'method', label: 'Purpose', options: filterOptions.method },
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
    try { localStorage.setItem('security.report-column-preferences', JSON.stringify(next)); } catch { /* ignore */ }
  };
  const exportableReportData = Array.isArray(filteredReportData)
    ? rows.map((row) => Object.fromEntries(visibleColumns.map((column) => [column.label, row[column.key]])))
    : filteredReportData;
  const reportLabel = REPORT_GROUPS[selectedTab].reports.find(([key]) => key === selectedReport)?.[1]
    || selectedReport.replace(/-/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

  const reportKpis = useMemo(() => {
    const count = rows.length;
    if (selectedReport === 'incidents') {
      const closed = rows.filter((row) => row.status === 'resolved' || row.status === 'closed');
      return [
        { label: 'Incidents', value: count.toLocaleString(), hint: 'In period' },
        { label: 'Open', value: rows.filter((row) => row.status === 'reported' || row.status === 'investigating' || row.status === 'escalated').length.toLocaleString(), hint: 'Not closed' },
        { label: 'Critical', value: rows.filter((row) => row.severity === 'critical').length.toLocaleString(), hint: 'Stored severity' },
        { label: 'Closed', value: closed.length.toLocaleString(), hint: 'Resolved or closed' },
      ];
    }
    if (selectedReport === 'patrols') {
      const stops = rows.reduce((sum, row) => sum + Number(row.checkpoints || 0), 0);
      const done = rows.reduce((sum, row) => sum + Number(row.completed || 0), 0);
      return [
        { label: 'Patrols', value: count.toLocaleString(), hint: 'Started in period' },
        { label: 'Completed', value: rows.filter((row) => row.status === 'completed').length.toLocaleString(), hint: 'Patrol status' },
        { label: 'Stops done', value: `${done}/${stops || 0}`, hint: 'Stored checkpoints' },
        { label: 'Missed', value: rows.reduce((sum, row) => sum + Number(row.missed || 0), 0).toLocaleString(), hint: 'Marked missed' },
      ];
    }
    if (selectedReport === 'checkpoints') {
      return [
        { label: 'Stops', value: count.toLocaleString(), hint: 'On patrols in the period' },
        { label: 'Completed', value: rows.filter((row) => row.status === 'completed').length.toLocaleString(), hint: 'Checked' },
        { label: 'Missed', value: rows.filter((row) => row.status === 'missed').length.toLocaleString(), hint: 'Marked missed' },
        { label: 'Pending', value: rows.filter((row) => row.status === 'pending').length.toLocaleString(), hint: 'Not yet checked' },
      ];
    }
    if (selectedReport === 'visitors') {
      return [
        { label: 'Visitors', value: count.toLocaleString(), hint: 'Checked in' },
        { label: 'On site', value: rows.filter((row) => row.status === 'checked_in').length.toLocaleString(), hint: 'Still in' },
        { label: 'Out', value: rows.filter((row) => row.status === 'checked_out').length.toLocaleString(), hint: 'Checked out' },
        { label: 'Escort', value: rows.filter((row) => row.escortRequired).length.toLocaleString(), hint: 'Required escort' },
      ];
    }
    if (selectedReport === 'shifts') {
      return [
        { label: 'Shifts', value: count.toLocaleString(), hint: 'In period' },
        { label: 'On duty', value: rows.filter((row) => row.status === 'on_duty').length.toLocaleString(), hint: 'Still open' },
        { label: 'Completed', value: rows.filter((row) => row.status === 'completed').length.toLocaleString(), hint: 'Checked out' },
        { label: 'Period', value: startDate === endDate ? startDate : `${startDate} – ${endDate}`, hint: 'Selected' },
      ];
    }
    if (selectedReport === 'personnel') {
      return [
        { label: 'Personnel', value: count.toLocaleString(), hint: 'On file' },
        { label: 'Active', value: rows.filter((row) => row.isActive).length.toLocaleString(), hint: 'Available for duty' },
        { label: 'Inactive', value: rows.filter((row) => row.isActive === false).length.toLocaleString(), hint: 'Not on the active list' },
        { label: 'Agencies', value: new Set(rows.map((row) => row.agency).filter((value) => value && value !== '—')).size.toLocaleString(), hint: 'Listed agencies' },
      ];
    }
    if (selectedReport === 'compliance') {
      const today = new Date().toISOString().split('T')[0];
      return [
        { label: 'Requirements', value: count.toLocaleString(), hint: 'On file' },
        { label: 'Overdue', value: rows.filter((row) => row.overdue).length.toLocaleString(), hint: 'Next due before today' },
        { label: 'Due today', value: rows.filter((row) => row.nextDueDate === today).length.toLocaleString(), hint: 'Next due is today' },
        { label: 'Penalties', value: money(rows.reduce((sum, row) => sum + Number(row.penaltyAmount || 0), 0)), hint: 'Stored penalty amounts' },
      ];
    }
    return [
      { label: 'Records', value: count.toLocaleString(), hint: 'Matching the filters' },
      { label: 'Active', value: rows.filter((row) => row.isActive !== false).length.toLocaleString(), hint: 'On the list' },
      { label: 'Period', value: NO_DATE_REPORT_KEYS.has(selectedReport) ? 'Current' : startDate, hint: 'Selected' },
      { label: 'Status', value: 'Current', hint: generatedAt ? `Refreshed ${generatedAt}` : 'Preparing report' },
    ];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedReport, startDate, endDate, reportDateMode, generatedAt, refreshVersion, mounted, filters, incidents, patrols, visitors, shifts, personnel, requirements]);

  const hiddenKpiLabels = hiddenKpisByReport[selectedReport] || [];
  const visibleReportKpis = reportKpis.filter((kpi) => !hiddenKpiLabels.includes(kpi.label));
  const saveKpiPreferences = (hiddenLabels: string[]) => {
    const next = { ...hiddenKpisByReport, [selectedReport]: hiddenLabels };
    setHiddenKpisByReport(next);
    try { localStorage.setItem('security.report-summary-preferences', JSON.stringify(next)); } catch { /* ignore */ }
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
          typeof row[column.key] === 'number' && /(cost|amount)/i.test(column.key)
            ? money(row[column.key] as number)
            : typeof row[column.key] === 'boolean'
            ? (row[column.key] ? 'Yes' : 'No')
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
              SECURITY INTELLIGENCE
            </div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-2xl font-bold tracking-tight text-slate-950 md:text-3xl">Reports & Analysis</h1>
              <ReportPageInfoTip text="Incidents, patrols, checkpoints, visitors, shifts, personnel and compliance obligations on file." />
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
                onSelectionChange={(keys) => { const next = Array.from(keys)[0] as string; if (next) setSelectedReport(next); }}
                startContent={<TrendingUp size={15} className="text-slate-400" />}
              >
                {REPORT_GROUPS[selectedTab].reports.map(([key, label]) => <SelectItem key={key}>{label}</SelectItem>)}
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
                  <Input aria-label="Search report results" placeholder="Incident, officer, visitor, location..." value={filters.query} onValueChange={(query) => setFilters((current) => ({ ...current, query }))} startContent={<Search size={16} className="text-slate-400" />} size="sm" className="w-full sm:w-64 lg:w-72" />
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
