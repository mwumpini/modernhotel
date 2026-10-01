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
import { housekeepingStore } from '../lib/housekeeping/store';
import { useSettingsStore } from '../lib/settings/store';
import { buildOrgProfile } from '../lib/print/buildOrgProfile';
import { reportDataToSections, sectionsToCSV, sectionsToExcelHtml, sectionsToPdfBlob } from '../lib/frontoffice/reportExportFormat';
import { getClientTenantSubdomain } from '../lib/api/clientTenant';
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

/** Local calendar day, plus the clock when the record has a real time. Date-only values stay as written. */
function formatWhen(value?: string | null) {
  if (!value) return '—';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  const pad = (n: number) => String(n).padStart(2, '0');
  const day = `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}`;
  const clock = `${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`;
  return clock === '00:00' ? day : `${day} ${clock}`;
}

function taskDay(task: HousekeepingTask) {
  return dayOf(task.completedAt || task.startedAt || task.assignedAt || task.createdAt);
}

function suppliesLabel(task: HousekeepingTask) {
  const used = task.suppliesUsed || [];
  if (!used.length) return '—';
  return used.map((line) => `${line.itemName} ×${line.quantity}`).join(', ');
}

function staffName(id?: string, name?: string) {
  if (name) return name;
  if (!id) return 'Unassigned';
  return housekeepingStore.getAllStaff().find((member) => member.id === id)?.name || id;
}

const RANGE_REPORT_KEYS = new Set([
  'room-work', 'room-history', 'tasks', 'attendants', 'usage', 'usage-items', 'inspections', 'maintenance', 'requisitions',
]);
const NO_DATE_REPORT_KEYS = new Set(['rooms', 'onhand', 'inventory']);

const REPORT_GROUPS = {
  rooms: {
    title: 'Rooms',
    description: 'What happened in each room.',
    reports: [
      ['room-work', 'Room work'],
      ['room-history', 'Room history'],
      ['rooms', 'Room status'],
    ],
  },
  work: {
    title: 'Works & Quality',
    description: 'Tasks, who did them, inspections and maintenance orders.',
    reports: [
      ['tasks', 'Task history'],
      ['attendants', 'Who did the work'],
      ['inspections', 'Inspections'],
      ['maintenance', 'Maintenance orders'],
    ],
  },
  supplies: {
    title: 'Supplies',
    description: 'What rooms used, what is on hand, and what Housekeeping asked Stores for.',
    reports: [
      ['usage', 'Usage by room'],
      ['usage-items', 'Usage by item'],
      ['onhand', 'On hand'],
      ['inventory', 'Inventory'],
      ['requisitions', 'Requisitions'],
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
  'room-work': 'One row per room: tasks done, last clean, open work, and supplies used.',
  'room-history': 'Every status change, task, inspection and work order, newest first.',
  rooms: 'Current housekeeping condition of every configured room.',
  tasks: 'Every cleaning and turnover task, including supplies taken off inventory.',
  attendants: 'Tasks, rooms and supplies grouped by the person the work was assigned to.',
  usage: 'Each supply a finished task took from housekeeping stock, room by room.',
  'usage-items': 'How much of each item rooms have used.',
  onhand: 'Soap, towels and the rest currently sitting in housekeeping.',
  inventory: 'Housekeeping catalog with on-hand quantity, unit cost and stock value.',
  requisitions: 'Stock requests Housekeeping sent to Stores, with status.',
  inspections: 'Recorded room inspections, scores and follow-up.',
  maintenance: 'Maintenance orders, status and recorded cost.',
};

const EMPTY_REPORT_COPY: Record<string, string> = {
  'room-work': 'No rooms are on file yet.',
  'room-history': 'No room activity in this period.',
  tasks: 'No tasks in this period.',
  attendants: 'No assigned work in this period.',
  usage: 'No supplies have been recorded on finished tasks in this period. Marking a task completed and entering what the room used fills this table.',
  'usage-items': 'No supply usage in this period.',
  onhand: 'Nothing is on hand. Stock appears here after Stores marks a housekeeping requisition Ready.',
  inventory: 'No housekeeping stock is on file.',
  requisitions: 'No housekeeping requisitions in this period.',
  inspections: 'No inspections in this period.',
  maintenance: 'No maintenance orders in this period.',
  rooms: 'No rooms are on file yet.',
};

type ReportColumnDefinition = { key: string; label: string; defaultVisible?: boolean };

const REPORT_COLUMNS: Record<string, ReportColumnDefinition[]> = {
  'room-work': [
    { key: 'roomNumber', label: 'Room' },
    { key: 'roomType', label: 'Room type' },
    { key: 'status', label: 'Status' },
    { key: 'tasks', label: 'Tasks' },
    { key: 'completed', label: 'Completed' },
    { key: 'open', label: 'Still open' },
    { key: 'lastCleaned', label: 'Last cleaned' },
    { key: 'lastType', label: 'Last type' },
    { key: 'assignedTo', label: 'Last attendant' },
    { key: 'inspections', label: 'Inspections' },
    { key: 'avgScore', label: 'Avg score' },
    { key: 'openMaintenance', label: 'Open maintenance' },
    { key: 'suppliesUsed', label: 'Supplies used' },
  ],
  'room-history': [
    { key: 'when', label: 'When' },
    { key: 'roomNumber', label: 'Room' },
    { key: 'event', label: 'What' },
    { key: 'detail', label: 'Detail' },
    { key: 'assignedTo', label: 'Who' },
    { key: 'suppliesUsed', label: 'Supplies' },
    { key: 'status', label: 'Result' },
  ],
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
    { key: 'suppliesUsed', label: 'Supplies used' },
  ],
  attendants: [
    { key: 'name', label: 'Person' },
    { key: 'tasks', label: 'Tasks' },
    { key: 'completed', label: 'Completed' },
    { key: 'open', label: 'Still open' },
    { key: 'rooms', label: 'Rooms' },
    { key: 'minutes', label: 'Minutes' },
    { key: 'supplies', label: 'Supplies used' },
  ],
  usage: [
    { key: 'when', label: 'When' },
    { key: 'roomNumber', label: 'Room' },
    { key: 'taskType', label: 'Task' },
    { key: 'itemName', label: 'Item' },
    { key: 'quantity', label: 'Quantity' },
    { key: 'assignedTo', label: 'Attendant' },
    { key: 'taskId', label: 'Task id', defaultVisible: false },
  ],
  'usage-items': [
    { key: 'itemName', label: 'Item' },
    { key: 'quantity', label: 'Quantity used' },
    { key: 'rooms', label: 'Rooms' },
    { key: 'tasks', label: 'Tasks' },
    { key: 'lastUsed', label: 'Last used' },
  ],
  onhand: [
    { key: 'name', label: 'Item' },
    { key: 'code', label: 'Code' },
    { key: 'category', label: 'Category' },
    { key: 'onHand', label: 'On hand' },
    { key: 'unit', label: 'Unit' },
  ],
  inventory: [
    { key: 'code', label: 'Code' },
    { key: 'name', label: 'Item' },
    { key: 'category', label: 'Category' },
    { key: 'onHand', label: 'On hand' },
    { key: 'unit', label: 'Unit' },
    { key: 'unitCost', label: 'Unit cost' },
    { key: 'stockValue', label: 'Value' },
  ],
  requisitions: [
    { key: 'requisitionNumber', label: 'Requisition' },
    { key: 'requestedDate', label: 'Requested' },
    { key: 'requestedBy', label: 'Requested by' },
    { key: 'status', label: 'Status' },
    { key: 'itemCount', label: 'Lines' },
    { key: 'items', label: 'Items' },
    { key: 'notes', label: 'Notes', defaultVisible: false },
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
    { key: 'id', label: 'Maintenance order' },
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
};

export default function HousekeepingReportsAnalysis({ embedded = false }: { embedded?: boolean } = {}) {
  const [selectedTab, setSelectedTab] = useState<ReportGroupKey>('rooms');
  const [selectedReport, setSelectedReport] = useState('room-work');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [reportDateMode, setReportDateMode] = useState<'all' | 'today' | 'specific' | 'range'>('all');
  const [stockRows, setStockRows] = useState<{ code: string; name: string; category: string; unit: string; onHand: number; unitCost: number }[]>([]);
  const [requisitionRows, setRequisitionRows] = useState<{
    requisitionNumber: string;
    requestedDate: string;
    requestedBy: string;
    status: string;
    notes: string;
    items: { itemName: string; quantity: number }[];
  }[]>([]);
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

  const loadSupplies = () => {
    const headers = { 'x-tenant-subdomain': getClientTenantSubdomain() };
    fetch('/api/inventory/stock-levels?department=housekeeping', { headers, cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : { items: [] }))
      .then((data) => {
        setStockRows(
          (data.items || []).map((item: any) => ({
            code: item.code || '—',
            name: item.name || '—',
            category: item.category || '—',
            unit: item.unit || '—',
            onHand: Number(item.onHand || 0),
            unitCost: Number(item.defaultCost || 0),
          })),
        );
      })
      .catch(() => setStockRows([]));
    fetch('/api/inventory/requisitions?department=housekeeping', { headers, cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : { requisitions: [] }))
      .then((data) => {
        setRequisitionRows(
          (data.requisitions || []).map((req: any) => ({
            requisitionNumber: req.requisitionNumber,
            requestedDate: req.requestedDate || req.createdAt || '',
            requestedBy: req.requestedBy || '—',
            status: req.status,
            notes: req.notes || '',
            items: (req.items || []).map((item: any) => ({ itemName: item.itemName, quantity: Number(item.quantity) })),
          })),
        );
      })
      .catch(() => setRequisitionRows([]));
  };

  useEffect(() => {
    housekeepingStore.hydrateFromApi();
    loadSupplies();
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
    loadSupplies();
    housekeepingStore.hydrateFromApi().then(() => {
      setRefreshVersion((version) => version + 1);
      setGeneratedAt(new Date().toLocaleString('en-GH'));
    });
  };

  const inPeriod = (day: string) => reportDateMode === 'all' || (day ? inDateRange(day, startDate, endDate) : true);

  const tasksInPeriod = () => housekeepingStore.getAllTasks().filter((task) => inPeriod(taskDay(task)));
  const inspectionsInPeriod = () => housekeepingStore.getAllInspections().filter((row: RoomInspection) => inPeriod(dayOf(row.inspectionDate)));
  const maintenanceInPeriod = () => housekeepingStore.getAllMaintenanceRequests().filter((row: MaintenanceRequest) => inPeriod(dayOf(row.reportedAt)));

  const getCurrentReportData = () => {
    const tasks = tasksInPeriod();
    const inspections = inspectionsInPeriod();
    const maintenance = maintenanceInPeriod();
    const done = (status: string) => status === 'completed' || status === 'verified';

    switch (selectedReport) {
      case 'room-work':
        return housekeepingStore.getAllRooms()
          .slice()
          .sort((a, b) => a.roomNumber.localeCompare(b.roomNumber, undefined, { numeric: true }))
          .map((room) => {
            const roomTasks = tasks.filter((task) => task.roomNumber === room.roomNumber);
            const completed = roomTasks.filter((task) => done(task.status));
            const last = [...completed].sort((a, b) => (b.completedAt || '').localeCompare(a.completedAt || ''))[0];
            const latest = [...roomTasks].sort((a, b) => (b.completedAt || b.startedAt || b.assignedAt || b.createdAt || '').localeCompare(a.completedAt || a.startedAt || a.assignedAt || a.createdAt || ''))[0];
            const roomInspections = inspections.filter((row) => row.roomNumber === room.roomNumber);
            const scores = roomInspections.map((row) => Number(row.score || 0)).filter((value) => value > 0);
            const openMaint = maintenance.filter((row) => row.roomNumber === room.roomNumber && !done(row.status));
            return {
              roomNumber: room.roomNumber,
              roomType: roomTypeName(room.roomTypeId),
              status: room.status,
              tasks: roomTasks.length,
              completed: completed.length,
              open: roomTasks.length - completed.length,
              lastCleaned: last?.completedAt ? formatWhen(last.completedAt) : '—',
              lastType: latest?.taskType || '—',
              assignedTo: latest ? staffName(latest.assignedTo, latest.assignedName) : '—',
              inspections: roomInspections.length,
              avgScore: scores.length ? Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length) : '—',
              openMaintenance: openMaint.length,
              suppliesUsed: roomTasks.some((task) => (task.suppliesUsed || []).length)
                ? roomTasks.map(suppliesLabel).filter((label) => label !== '—').join('; ')
                : '—',
            };
          });
      case 'room-history': {
        const events = [
          ...housekeepingStore.getStatusHistory()
            .filter((row) => inPeriod(dayOf(row.timestamp)))
            .map((row) => ({
              sort: row.timestamp,
              when: formatWhen(row.timestamp),
              roomNumber: row.roomNumber,
              event: 'Status',
              detail: `${row.previousStatus} → ${row.status}${row.reason ? ` · ${row.reason}` : ''}`,
              assignedTo: row.changedBy || '—',
              suppliesUsed: '—',
              status: row.status,
            })),
          ...tasks.map((task) => ({
            sort: task.completedAt || task.startedAt || task.assignedAt || '',
            when: formatWhen(task.completedAt || task.startedAt || task.assignedAt || task.createdAt),
            roomNumber: task.roomNumber,
            event: 'Task',
            detail: `${task.taskType} · ${task.priority}`,
            assignedTo: staffName(task.assignedTo, task.assignedName),
            suppliesUsed: suppliesLabel(task),
            status: task.status,
          })),
          ...inspections.map((row) => ({
            sort: row.inspectionDate,
            when: formatWhen(row.inspectionDate),
            roomNumber: row.roomNumber,
            event: 'Inspection',
            detail: `Score ${row.score}`,
            assignedTo: row.inspectorName || '—',
            suppliesUsed: '—',
            status: row.status,
          })),
          ...maintenance.map((row) => ({
            sort: row.reportedAt,
            when: formatWhen(row.reportedAt),
            roomNumber: row.roomNumber,
            event: 'Maintenance',
            detail: `${row.category} · ${row.description || '—'}`,
            assignedTo: row.reportedBy || '—',
            suppliesUsed: '—',
            status: row.status,
          })),
        ];
        return events
          .sort((a, b) => b.sort.localeCompare(a.sort))
          .map(({ sort: _sort, ...row }) => row);
      }
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
        return tasks.map((task) => ({
          id: task.id,
          roomNumber: task.roomNumber,
          taskType: task.taskType,
          priority: task.priority,
          status: task.status,
          assignedTo: staffName(task.assignedTo, task.assignedName),
          estimatedMinutes: task.estimatedMinutes,
          actualMinutes: task.actualMinutes ?? null,
          startedAt: formatWhen(task.startedAt),
          completedAt: formatWhen(task.completedAt),
          suppliesUsed: suppliesLabel(task),
        }));
      case 'attendants': {
        const grouped = new Map<string, { name: string; tasks: HousekeepingTask[] }>();
        tasks.forEach((task) => {
          const key = task.assignedTo || task.assignedName || 'unassigned';
          const current = grouped.get(key) || { name: key === 'unassigned' ? 'Unassigned' : staffName(task.assignedTo, task.assignedName), tasks: [] };
          current.tasks.push(task);
          grouped.set(key, current);
        });
        return Array.from(grouped.values()).map(({ name, tasks: rows }) => ({
          name,
          tasks: rows.length,
          completed: rows.filter((task) => done(task.status)).length,
          open: rows.filter((task) => !done(task.status)).length,
          rooms: new Set(rows.map((task) => task.roomNumber)).size,
          minutes: rows.reduce((sum, task) => sum + Number(task.actualMinutes || task.estimatedMinutes || 0), 0),
          supplies: rows.reduce((sum, task) => sum + (task.suppliesUsed || []).reduce((qty, line) => qty + Number(line.quantity || 0), 0), 0),
        }));
      }
      case 'usage':
        return tasks.flatMap((task) => (task.suppliesUsed || []).map((line) => ({
          when: formatWhen(task.completedAt || task.startedAt || task.createdAt),
          roomNumber: task.roomNumber,
          taskType: task.taskType,
          itemName: line.itemName,
          quantity: line.quantity,
          assignedTo: staffName(task.assignedTo, task.assignedName),
          taskId: task.id,
          sort: task.completedAt || task.startedAt || '',
        })))
          .sort((a, b) => b.sort.localeCompare(a.sort))
          .map(({ sort: _sort, ...row }) => row);
      case 'usage-items': {
        const byItem = new Map<string, { quantity: number; rooms: Set<string>; tasks: number; lastUsed: string }>();
        tasks.forEach((task) => {
          (task.suppliesUsed || []).forEach((line) => {
            const current = byItem.get(line.itemName) || { quantity: 0, rooms: new Set<string>(), tasks: 0, lastUsed: '' };
            current.quantity += Number(line.quantity || 0);
            current.rooms.add(task.roomNumber);
            current.tasks += 1;
            const when = task.completedAt || task.startedAt || '';
            if (when > current.lastUsed) current.lastUsed = when;
            byItem.set(line.itemName, current);
          });
        });
        return Array.from(byItem.entries()).map(([itemName, row]) => ({
          itemName,
          quantity: row.quantity,
          rooms: row.rooms.size,
          tasks: row.tasks,
          lastUsed: formatWhen(row.lastUsed),
        }));
      }
      case 'onhand':
        return stockRows
          .filter((row) => row.onHand > 0)
          .map((row) => ({
            name: row.name,
            code: row.code,
            category: row.category,
            onHand: row.onHand,
            unit: row.unit,
          }));
      case 'inventory':
        return stockRows.map((row) => ({
          code: row.code,
          name: row.name,
          category: row.category,
          onHand: row.onHand,
          unit: row.unit,
          unitCost: row.unitCost,
          stockValue: row.onHand * row.unitCost,
        }));
      case 'requisitions':
        return requisitionRows
          .filter((row) => inPeriod(dayOf(row.requestedDate)))
          .map((row) => ({
            requisitionNumber: row.requisitionNumber,
            requestedDate: formatWhen(row.requestedDate),
            requestedBy: row.requestedBy || '—',
            status: row.status,
            itemCount: row.items.length,
            items: row.items.map((item) => `${item.quantity}× ${item.itemName}`).join(', ') || '—',
            notes: row.notes || '—',
          }));
      case 'inspections':
        return inspections.map((row) => ({
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
        return maintenance.map((row) => ({
          id: row.id,
          roomNumber: row.roomNumber,
          category: row.category,
          priority: row.priority,
          status: row.status,
          reportedBy: row.reportedBy || '—',
          reportedAt: formatWhen(row.reportedAt),
          assignedTo: row.assignedTo ? staffName(row.assignedTo) : 'Unassigned',
          cost: row.actualCost ?? row.estimatedCost ?? null,
          completedAt: formatWhen(row.completedAt),
          description: row.description || '—',
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
    staff: uniqueValues(['assignedTo', 'inspectorName', 'name', 'reportedBy', 'requestedBy']),
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
      && (filters.staff === 'all' || fieldValue(row, ['assignedTo', 'inspectorName', 'name', 'reportedBy', 'requestedBy']) === filters.staff)
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
        { label: 'Maintenance orders', value: count.toLocaleString(), hint: 'In period' },
        { label: 'Open', value: rows.filter((row) => row.status === 'reported' || row.status === 'assigned' || row.status === 'in-progress').length.toLocaleString(), hint: 'Not finished' },
        { label: 'Completed', value: rows.filter((row) => row.status === 'completed' || row.status === 'verified').length.toLocaleString(), hint: 'Closed' },
        { label: 'Recorded cost', value: money(cost), hint: 'Actual, else estimate' },
      ];
    }
    if (selectedReport === 'room-work') {
      return [
        { label: 'Rooms', value: count.toLocaleString(), hint: 'On the floor' },
        { label: 'With work', value: rows.filter((row) => Number(row.tasks) > 0).length.toLocaleString(), hint: 'Had a task in the period' },
        { label: 'Completed', value: rows.reduce((sum, row) => sum + Number(row.completed || 0), 0).toLocaleString(), hint: 'Tasks finished' },
        { label: 'Still open', value: rows.reduce((sum, row) => sum + Number(row.open || 0), 0).toLocaleString(), hint: 'Not finished' },
      ];
    }
    if (selectedReport === 'room-history') {
      return [
        { label: 'Events', value: count.toLocaleString(), hint: 'In the period' },
        { label: 'Rooms', value: new Set(rows.map((row) => row.roomNumber)).size.toLocaleString(), hint: 'Touched' },
        { label: 'Tasks', value: rows.filter((row) => row.event === 'Task').length.toLocaleString(), hint: 'Cleaning and turnover' },
        { label: 'Status changes', value: rows.filter((row) => row.event === 'Status').length.toLocaleString(), hint: 'Room condition log' },
      ];
    }
    if (selectedReport === 'attendants') {
      return [
        { label: 'People', value: count.toLocaleString(), hint: 'With work in the period' },
        { label: 'Tasks', value: rows.reduce((sum, row) => sum + Number(row.tasks || 0), 0).toLocaleString(), hint: 'Assigned' },
        { label: 'Completed', value: rows.reduce((sum, row) => sum + Number(row.completed || 0), 0).toLocaleString(), hint: 'Finished' },
        { label: 'Supplies', value: rows.reduce((sum, row) => sum + Number(row.supplies || 0), 0).toLocaleString(), hint: 'Units used' },
      ];
    }
    if (selectedReport === 'usage') {
      return [
        { label: 'Lines', value: count.toLocaleString(), hint: 'One row per item a room used' },
        { label: 'Quantity', value: rows.reduce((sum, row) => sum + Number(row.quantity || 0), 0).toLocaleString(), hint: 'Units used' },
        { label: 'Rooms', value: new Set(rows.map((row) => row.roomNumber).filter(Boolean)).size.toLocaleString(), hint: 'Where it was used' },
        { label: 'Tasks', value: new Set(rows.map((row) => row.taskId)).size.toLocaleString(), hint: 'That recorded usage' },
      ];
    }
    if (selectedReport === 'usage-items') {
      return [
        { label: 'Items', value: count.toLocaleString(), hint: 'Used in the period' },
        { label: 'Quantity', value: rows.reduce((sum, row) => sum + Number(row.quantity || 0), 0).toLocaleString(), hint: 'Units used' },
        { label: 'Tasks', value: rows.reduce((sum, row) => sum + Number(row.tasks || 0), 0).toLocaleString(), hint: 'That recorded the item' },
        { label: 'Rooms', value: rows.reduce((sum, row) => sum + Number(row.rooms || 0), 0).toLocaleString(), hint: 'Room uses, counted per item' },
      ];
    }
    if (selectedReport === 'onhand') {
      return [
        { label: 'Items', value: count.toLocaleString(), hint: 'With stock' },
        { label: 'Units', value: rows.reduce((sum, row) => sum + Number(row.onHand || 0), 0).toLocaleString(), hint: 'On hand' },
        { label: 'Categories', value: new Set(rows.map((row) => row.category)).size.toLocaleString(), hint: 'In housekeeping' },
        { label: 'Source', value: 'Ready requisitions', hint: 'Stores marks them Ready' },
      ];
    }
    if (selectedReport === 'inventory') {
      return [
        { label: 'Catalog items', value: count.toLocaleString(), hint: 'Housekeeping floor' },
        { label: 'In stock', value: rows.filter((row) => Number(row.onHand || 0) > 0).length.toLocaleString(), hint: 'On-hand above zero' },
        { label: 'Zero stock', value: rows.filter((row) => Number(row.onHand || 0) <= 0).length.toLocaleString(), hint: 'Nothing on the floor' },
        { label: 'Stock value', value: money(rows.reduce((sum, row) => sum + Number(row.stockValue || 0), 0)), hint: 'On-hand cost' },
      ];
    }
    if (selectedReport === 'requisitions') {
      return [
        { label: 'Requisitions', value: count.toLocaleString(), hint: 'Sent to Stores' },
        { label: 'Pending', value: rows.filter((row) => row.status === 'pending').length.toLocaleString(), hint: 'Awaiting approval' },
        { label: 'Approved', value: rows.filter((row) => row.status === 'approved' || row.status === 'ready').length.toLocaleString(), hint: 'Approved or ready' },
        { label: 'Lines', value: rows.reduce((sum, row) => sum + Number(row.itemCount || 0), 0).toLocaleString(), hint: 'Requested items' },
      ];
    }
    return [
      { label: 'Records', value: count.toLocaleString(), hint: 'Matching the filters' },
      { label: 'Period start', value: NO_DATE_REPORT_KEYS.has(selectedReport) ? '—' : startDate, hint: 'Business date' },
      { label: 'Period end', value: NO_DATE_REPORT_KEYS.has(selectedReport) ? '—' : endDate, hint: reportDateMode === 'range' ? 'Inclusive' : 'Single day' },
      { label: 'Status', value: 'Current', hint: generatedAt ? `Refreshed ${generatedAt}` : 'Preparing report' },
    ];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedReport, startDate, endDate, reportDateMode, generatedAt, refreshVersion, mounted, filters, storeTick, stockRows, requisitionRows]);

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
              : (EMPTY_REPORT_COPY[selectedReport] || 'No data available for the selected report and date.')}
          </p>
        </div>
      );
    }
    return (
      <SortableReportTable
        ariaLabel={`${selectedReport} report table`}
        columns={visibleColumns}
        rows={rows}
        renderCell={(row, column) => (
          typeof row[column.key] === 'number' && /(cost|amount|value|price)/i.test(column.key)
            ? money(row[column.key] as number)
            : typeof row[column.key] === 'number' && /(efficiency)/i.test(column.key)
            ? `${(row[column.key] as number).toLocaleString('en-GH', { maximumFractionDigits: 1 })}%`
            : typeof row[column.key] === 'boolean'
            ? (row[column.key] ? 'Yes' : 'No')
            : row[column.key] === null || row[column.key] === undefined
            ? '—'
            : formatReportValue(row[column.key])
        )}
      />
    );
  };

  return (
    <div className={embedded ? 'p-2' : 'min-h-screen bg-slate-50/70 p-4 md:p-6'}>
      <div className="mx-auto max-w-[1600px] space-y-3">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-blue-700">
              <BarChart3 size={16} />
              HOUSEKEEPING INTELLIGENCE
            </div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-2xl font-bold tracking-tight text-slate-950 md:text-3xl">Reports & Analysis</h1>
              <ReportPageInfoTip text="Room-by-room history, who did the work, and the supplies each task took off housekeeping stock." />
            </div>
          </div>
          <div className="flex flex-nowrap items-center gap-1.5 overflow-x-auto shrink-0">
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
          <CardBody className="gap-2 p-3">
            <Tabs
              selectedKey={selectedTab}
              onSelectionChange={handleTabChange}
              aria-label="Report categories"
              color="primary"
              variant="underlined"
              classNames={{ tabList: 'gap-3', cursor: 'w-full', tab: 'px-0 h-8' }}
            >
              {Object.entries(REPORT_GROUPS).map(([key, group]) => (
                <Tab key={key} title={group.title} />
              ))}
            </Tabs>

            <div className="grid gap-3 lg:grid-cols-[minmax(180px,0.75fr)_2fr]">
              <Select label="Report" className="w-full max-w-[75%]" selectedKeys={[selectedReport]}
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
                  <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    <CalendarDays size={14} /> Reporting period
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {(['all', 'today', 'specific', 'range'] as const).map((mode) => (
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
                        {mode === 'all' ? 'All history' : mode === 'today' ? 'Today' : mode === 'specific' ? 'Specific date' : 'Date range'}
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
          <CardBody className="overflow-x-auto px-3 py-1.5">
            <div className="flex min-w-max items-center gap-3">
              <div className="flex flex-1 items-center divide-x divide-slate-200">
                {visibleReportKpis.length > 0 ? visibleReportKpis.map((kpi) => (
                  <div key={kpi.label} className="flex items-baseline gap-1.5 px-3 first:pl-0 last:pr-0">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{kpi.label}</span>
                    <span className="text-sm font-bold text-slate-950">{kpi.value}</span>
                  </div>
                )) : (
                  <p className="pr-3 text-sm text-slate-500">All summary metrics are hidden.</p>
                )}
              </div>
              <div className="ml-auto flex shrink-0 items-center gap-1.5 border-l border-slate-200 pl-3">
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
              </div>
              <p className="mt-1 text-sm text-slate-500">{REPORT_DESCRIPTIONS[selectedReport]}</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-left text-xs text-slate-500 sm:text-right">
                <div>{NO_DATE_REPORT_KEYS.has(selectedReport) ? 'Current snapshot' : reportDateMode === 'all' ? 'All history' : startDate === endDate ? startDate : `${startDate} – ${endDate}`}</div>
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
