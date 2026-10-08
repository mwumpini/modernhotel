'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { HideCardButton } from '../dashboard/CustomizeViewControl';
import { 
  Card, 
  CardBody, 
  Button, 
  Input, 
  Select, 
  SelectItem, 
  Chip, 
  Badge, 
  Modal, 
  ModalContent, 
  ModalHeader, 
  ModalBody, 
  ModalFooter,
  Textarea,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Pagination,
} from "@heroui/react";
import { housekeepingStore } from '../../lib/housekeeping/store';
import { sequenceOf, useSettingsStore } from '../../lib/settings/store';
import { getClientTenantSubdomain } from '../../lib/api/clientTenant';

function hkHeaders() {
  return { 'Content-Type': 'application/json', 'x-tenant-subdomain': getClientTenantSubdomain() };
}

function jobLabel(type: string) {
  const text = type.replace(/[_-]/g, ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function ticketOf(task: HousekeepingTask): string {
  if (task.ticketNumber) return task.ticketNumber;
  const pattern = useSettingsStore.getState().moduleNumbering?.frontOffice?.housekeepingTicket;
  if (pattern && sequenceOf(task.id, pattern) != null) return task.id;
  return '';
}
import { frontOfficeStore } from '../../lib/frontoffice/store';
import { trackEvent } from '../../lib/analytics/trackEvent';
import { 
  HousekeepingTask, 
  TaskPriority, 
  TaskStatus,
  HousekeepingStaff 
} from '../../lib/housekeeping/types';
import {
  currentResponsibilityShift,
  findResponsibleForRoom,
  type RoomResponsibility,
  RESPONSIBILITY_SHIFTS,
} from '../../lib/housekeeping/roomResponsibilities';
import { AREA_ROOM_TYPE_ID, type CleaningArea } from '../../lib/housekeeping/cleaningAreas';
import { sizedTableClassNames, useResizableColumns } from '../frontoffice/columnResize';
import { deskTableCardBodyClassName, deskTableCardClassName, deskTableClassNames, SortHeader, toggleColumnSort, DESK_PAGE_SIZE, type ColumnSort } from '../dashboard/deskTableUi';

// Task Templates for quick creation
const TASK_TEMPLATES = {
  'daily-cleaning': {
    name: 'Daily Room Cleaning',
    description: 'Standard daily cleaning for occupied rooms',
    taskType: 'daily' as const,
    locationKind: 'room' as const,
    estimatedMinutes: 25,
    checklist: [
      'Make bed and change linens if needed',
      'Clean bathroom and restock amenities',
      'Empty trash and replace liners',
      'Dust surfaces and vacuum floor',
      'Check and restock minibar',
      'Report any maintenance issues'
    ],
    priority: 'medium' as TaskPriority,
    icon: '🧹'
  },
  'turnover': {
    name: 'Room Turnover',
    description: 'Complete cleaning after guest check-out',
    taskType: 'turnover' as const,
    locationKind: 'room' as const,
    estimatedMinutes: 45,
    checklist: [
      'Strip all bedding and replace with fresh linens',
      'Deep clean bathroom and sanitize surfaces',
      'Vacuum and mop floors thoroughly',
      'Clean all surfaces and fixtures',
      'Restock all amenities and supplies',
      'Check appliances and report issues',
      'Final inspection and quality check'
    ],
    priority: 'high' as TaskPriority,
    icon: '🔄'
  },
  'deep-clean': {
    name: 'Deep Cleaning',
    description: 'Weekly deep cleaning for rooms or areas',
    taskType: 'deep-clean' as const,
    locationKind: 'room' as const,
    estimatedMinutes: 60,
    checklist: [
      'Move furniture and clean underneath',
      'Deep clean carpets and upholstery',
      'Clean windows and window sills',
      'Sanitize all touch points',
      'Clean air vents and filters',
      'Polish fixtures and hardware',
      'Complete quality inspection'
    ],
    priority: 'medium' as TaskPriority,
    icon: '✨'
  },
  'maintenance-support': {
    name: 'Maintenance Support',
    description: 'Support tasks for maintenance work',
    taskType: 'maintenance' as const,
    locationKind: 'room' as const,
    estimatedMinutes: 30,
    checklist: [
      'Prepare area for maintenance work',
      'Cover furniture and protect surfaces',
      'Assist with cleaning after repairs',
      'Restore area to guest-ready condition',
      'Final quality check'
    ],
    priority: 'high' as TaskPriority,
    icon: '🔧'
  },
  'lobby-public': {
    name: 'Public area',
    description: 'Lobby, corridors, and other public spaces',
    taskType: 'daily' as const,
    locationKind: 'area' as const,
    defaultArea: 'Lobby',
    estimatedMinutes: 40,
    checklist: [
      'Sweep / vacuum floors and entrance mats',
      'Dust furniture, desks, and displays',
      'Polish glass doors and mirrors',
      'Empty bins and replace liners',
      'Straighten chairs and magazines',
      'Wipe high-touch surfaces (handles, railings)',
      'Report spills or maintenance issues'
    ],
    priority: 'medium' as TaskPriority,
    icon: '🏛️'
  },
};

const TASK_TYPE_TO_TEMPLATE: Record<string, keyof typeof TASK_TEMPLATES> = {
  daily: 'daily-cleaning',
  turnover: 'turnover',
  'deep-clean': 'deep-clean',
  maintenance: 'maintenance-support',
};

function templateForTaskType(taskType: string) {
  const key = TASK_TYPE_TO_TEMPLATE[taskType];
  return key ? TASK_TEMPLATES[key] : null;
}

function suggestedJobForRoomStatus(status?: string): keyof typeof TASK_TEMPLATES {
  if (status === 'dirty' || status === 'maintenance' || status === 'out-of-order') return 'turnover';
  if (status === 'occupied') return 'daily-cleaning';
  if (status === 'clean' || status === 'inspected') return 'deep-clean';
  return 'turnover';
}

export default function TaskManagementPanel({
  hideQuickCreate = false,
  onHideQuickCreate,
}: {
  hideQuickCreate?: boolean;
  onHideQuickCreate?: () => void;
} = {}) {
  const [tasks, setTasks] = useState<HousekeepingTask[]>([]);
  const [staff, setStaff] = useState<HousekeepingStaff[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [selectedTask, setSelectedTask] = useState<HousekeepingTask | null>(null);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [bulkTaskModalOpen, setBulkTaskModalOpen] = useState(false);
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [taskLayout, setTaskLayout] = useState<'cards' | 'table'>('table');
  const [sort, setSort] = useState<ColumnSort>({ column: 'number', direction: 'desc' });
  const [page, setPage] = useState(1);
  const cols = useResizableColumns({
    number: 120,
    room: 80,
    job: 120,
    status: 120,
    assigned: 150,
    action: 90,
  });
  const [finishTask, setFinishTask] = useState<HousekeepingTask | null>(null);
  const [finishPreview, setFinishPreview] = useState<{ label: string; lines: { itemId: string; itemName: string; quantity: number }[] } | null>(null);
  const [finishItems, setFinishItems] = useState<{ id: string; name: string }[]>([]);
  const [finishExtras, setFinishExtras] = useState<{ itemId: string; quantity: string }[]>([]);
  const [finishError, setFinishError] = useState('');
  const [finishWarnings, setFinishWarnings] = useState<string[]>([]);
  const [finishSaving, setFinishSaving] = useState(false);
  const [responsibilities, setResponsibilities] = useState<RoomResponsibility[]>([]);
  const [cleaningAreas, setCleaningAreas] = useState<CleaningArea[]>([]);
  const [responsibleHint, setResponsibleHint] = useState<{ name: string; shift: string; matchedStaffId?: string } | null>(null);

  // Form state
  const [taskForm, setTaskForm] = useState({
    locationKind: 'room' as 'room' | 'area',
    roomNumber: '',
    roomTypeId: '',
    customArea: '',
    taskType: 'daily' as HousekeepingTask['taskType'],
    priority: 'medium' as TaskPriority,
    estimatedMinutes: 30,
    checklist: [] as string[],
    notes: '',
    assignedTo: ''
  });

  // Bulk task creation state
  const [bulkTaskForm, setBulkTaskForm] = useState({
    template: 'turnover' as keyof typeof TASK_TEMPLATES,
    selectedRooms: [] as string[],
    roomStatusFilter: 'dirty' as string,
    assignedTo: '',
    priority: 'high' as TaskPriority,
    notes: ''
  });
  const [formError, setFormError] = useState('');

  useEffect(() => {
    loadData();
    const unsubscribe = housekeepingStore.subscribe(loadData);
    fetch('/api/housekeeping/room-responsibilities?active=1', {
      headers: hkHeaders(),
      cache: 'no-store',
    })
      .then((r) => (r.ok ? r.json() : { responsibilities: [] }))
      .then((data) => setResponsibilities(data.responsibilities || []))
      .catch(() => setResponsibilities([]));
    fetch('/api/housekeeping/cleaning-areas?active=1', {
      headers: hkHeaders(),
      cache: 'no-store',
    })
      .then((r) => (r.ok ? r.json() : { areas: [] }))
      .then((data) => setCleaningAreas(data.areas || []))
      .catch(() => setCleaningAreas([]));
    return unsubscribe;
  }, []);

  const resolveResponsible = (roomNumber: string, attendants: HousekeepingStaff[]) => {
    if (!roomNumber) {
      setResponsibleHint(null);
      return { assignedTo: '' as string, hint: null as typeof responsibleHint };
    }
    const shift = currentResponsibilityShift();
    const rec = findResponsibleForRoom(responsibilities, roomNumber, shift);
    if (!rec) {
      setResponsibleHint(null);
      return { assignedTo: '', hint: null };
    }
    const shiftLabel = RESPONSIBILITY_SHIFTS.find((s) => s.key === rec.shift)?.label || rec.shift;
    const match = attendants.find(
      (s) => s.active && s.name.trim().toLowerCase() === rec.staffName.trim().toLowerCase()
    );
    const hint = { name: rec.staffName, shift: shiftLabel, matchedStaffId: match?.id };
    setResponsibleHint(hint);
    return { assignedTo: match?.id || '', hint };
  };

  const loadData = () => {
    setTasks(housekeepingStore.getAllTasks());
    setStaff(housekeepingStore.getAllStaff());
    setRooms(housekeepingStore.getAllRooms());
  };

  const numberedTickets = useRef(new Set<string>());
  useEffect(() => {
    const pattern = useSettingsStore.getState().moduleNumbering?.frontOffice?.housekeepingTicket;
    if (!pattern) return;
    for (const task of tasks) {
      if (task.ticketNumber || sequenceOf(task.id, pattern) != null || numberedTickets.current.has(task.id)) continue;
      numberedTickets.current.add(task.id);
      const ticketNumber = useSettingsStore.getState().getNextModuleNumber('frontOffice', 'housekeepingTicket');
      housekeepingStore.updateTask(task.id, { ticketNumber });
    }
  }, [tasks]);

  // Quick task creation from template
  const handleQuickTask = (templateKey: string, roomNumber?: string) => {
    const template = TASK_TEMPLATES[templateKey as keyof typeof TASK_TEMPLATES];
    if (!template) return;

    const locationKind = template.locationKind || 'room';
    const room = locationKind === 'room' ? rooms.find((r) => r.roomNumber === roomNumber) : undefined;
    const areaDefault =
      locationKind === 'area'
        ? (('defaultArea' in template && (template as { defaultArea?: string }).defaultArea) ||
            cleaningAreas[0]?.name ||
            '')
        : '';
    setTaskForm({
      locationKind,
      roomNumber: locationKind === 'room' ? (roomNumber || '') : areaDefault,
      roomTypeId: room?.roomTypeId || (locationKind === 'area' ? AREA_ROOM_TYPE_ID : ''),
      customArea: '',
      taskType: template.taskType,
      priority: template.priority,
      estimatedMinutes: template.estimatedMinutes,
      checklist: [...template.checklist],
      notes: '',
      assignedTo: ''
    });
    setFormError('');
    setResponsibleHint(null);
    setIsCreatingTask(true);
    setTaskModalOpen(true);
  };

  // Bulk task creation
  const handleBulkTaskCreation = () => {
    const template = TASK_TEMPLATES[bulkTaskForm.template];
    if (!template || bulkTaskForm.selectedRooms.length === 0) return;

    bulkTaskForm.selectedRooms.forEach((roomNumber) => {
      const room = rooms.find((r) => r.roomNumber === roomNumber);
      if (!room) return;
      const task = housekeepingStore.createTask({
        roomNumber,
        roomTypeId: room.roomTypeId,
        taskType: template.taskType,
        priority: bulkTaskForm.priority,
        estimatedMinutes: template.estimatedMinutes,
        checklist: [...template.checklist],
        notes: bulkTaskForm.notes,
      });
      if (bulkTaskForm.assignedTo) {
        housekeepingStore.assignTask(task.id, bulkTaskForm.assignedTo);
      }
    });

    trackEvent('HK.BulkTasks.Created', {
      count: bulkTaskForm.selectedRooms.length,
      template: bulkTaskForm.template,
      assignedTo: bulkTaskForm.assignedTo,
    });

    setBulkTaskModalOpen(false);
    setBulkTaskForm({
      template: 'turnover',
      selectedRooms: [],
      roomStatusFilter: 'dirty',
      assignedTo: '',
      priority: 'high',
      notes: '',
    });
    loadData();
  };

  const openBulkTaskModal = () => {
    const dirtyRooms = rooms.filter((r) => r.status === 'dirty').map((r) => r.roomNumber);
    setBulkTaskForm({
      template: dirtyRooms.length ? 'turnover' : 'daily-cleaning',
      selectedRooms: dirtyRooms,
      roomStatusFilter: dirtyRooms.length ? 'dirty' : 'occupied',
      assignedTo: '',
      priority: dirtyRooms.length ? 'high' : 'medium',
      notes: '',
    });
    setBulkTaskModalOpen(true);
  };

  const handleCreateTask = () => {
    setIsCreatingTask(true);
    setFormError('');
    setResponsibleHint(null);
    setTaskForm({
      locationKind: 'room',
      roomNumber: '',
      roomTypeId: '',
      customArea: '',
      taskType: 'daily',
      priority: 'medium',
      estimatedMinutes: 25,
      checklist: [...TASK_TEMPLATES['daily-cleaning'].checklist],
      notes: '',
      assignedTo: ''
    });
    setTaskModalOpen(true);
  };

  const handleEditTask = (task: HousekeepingTask) => {
    setIsCreatingTask(false);
    setSelectedTask(task);
    const isKnownRoom = rooms.some((r) => r.roomNumber === task.roomNumber);
    const isConfiguredArea = cleaningAreas.some((a) => a.name === task.roomNumber);
    const isArea =
      task.roomTypeId === AREA_ROOM_TYPE_ID ||
      (!isKnownRoom && !!task.roomNumber);
    setTaskForm({
      locationKind: isArea ? 'area' : 'room',
      roomNumber: isArea && !isConfiguredArea ? '__custom__' : task.roomNumber,
      roomTypeId: task.roomTypeId,
      customArea: isArea && !isConfiguredArea ? task.roomNumber : '',
      taskType: task.taskType,
      priority: task.priority,
      estimatedMinutes: task.estimatedMinutes,
      checklist: task.checklist,
      notes: task.notes || '',
      assignedTo: task.assignedTo || ''
    });
    setFormError('');
    setTaskModalOpen(true);
  };

  const resolvedLocationLabel = () => {
    if (taskForm.locationKind === 'area') {
      if (taskForm.roomNumber === '__custom__') return taskForm.customArea.trim();
      return taskForm.roomNumber.trim();
    }
    return taskForm.roomNumber.trim();
  };

  const handleSaveTask = () => {
    const location = resolvedLocationLabel();
    if (!location) {
      setFormError(
        taskForm.locationKind === 'area'
          ? cleaningAreas.length
            ? 'Pick an area (or Custom and name it).'
            : 'Add areas under Work → Cleaning areas first.'
          : 'Pick a room.'
      );
      return;
    }
    const room = rooms.find((r) => r.roomNumber === location);
    const roomTypeId =
      taskForm.locationKind === 'area'
        ? AREA_ROOM_TYPE_ID
        : taskForm.roomTypeId || room?.roomTypeId || '';
    if (taskForm.locationKind === 'room' && !roomTypeId) {
      setFormError('This room has no room type on file.');
      return;
    }
    if (!taskForm.checklist.length) {
      setFormError('Add at least one checklist step for the attendant.');
      return;
    }

    if (isCreatingTask) {
      const task = housekeepingStore.createTask({
        roomNumber: location,
        roomTypeId: roomTypeId || AREA_ROOM_TYPE_ID,
        taskType: taskForm.taskType,
        priority: taskForm.priority,
        estimatedMinutes: taskForm.estimatedMinutes,
        checklist: taskForm.checklist.filter((item) => item.trim()),
        notes: taskForm.notes
      });

      if (taskForm.assignedTo) {
        housekeepingStore.assignTask(task.id, taskForm.assignedTo);
      }

      trackEvent('HK.Task.Created', {
        roomNumber: location,
        taskType: taskForm.taskType,
        priority: taskForm.priority
      });
    } else if (selectedTask) {
      housekeepingStore.updateTask(selectedTask.id, {
        roomNumber: location,
        roomTypeId: roomTypeId || AREA_ROOM_TYPE_ID,
        taskType: taskForm.taskType,
        priority: taskForm.priority,
        estimatedMinutes: taskForm.estimatedMinutes,
        notes: taskForm.notes,
        checklist: taskForm.checklist.filter((item) => item.trim()),
        status: selectedTask.status
      });

      if (taskForm.assignedTo && taskForm.assignedTo !== selectedTask.assignedTo) {
        housekeepingStore.assignTask(selectedTask.id, taskForm.assignedTo);
      }

      trackEvent('HK.Task.Updated', {
        taskId: selectedTask.id,
        roomNumber: location
      });
    }

    setFormError('');
    setTaskModalOpen(false);
    loadData();
  };

  const handleAssignTask = (taskId: string, staffId: string) => {
    housekeepingStore.assignTask(taskId, staffId);
    trackEvent('HK.Task.Assigned', { taskId, staffId });
    loadData();
  };

  const handleUpdateTaskStatus = (taskId: string, status: TaskStatus) => {
    if (status === 'completed') {
      const task = tasks.find((t) => t.id === taskId);
      if (task && !task.suppliesIssued) {
        setFinishError('');
        setFinishWarnings([]);
        setFinishExtras([]);
        setFinishPreview(null);
        setFinishTask(task);
        fetch(`/api/housekeeping/tasks/${encodeURIComponent(taskId)}/finish`, { headers: hkHeaders() })
          .then((r) => (r.ok ? r.json() : null))
          .then((data) => {
            if (!data) {
              setFinishError('Could not check the room kit.');
              return;
            }
            setFinishPreview({ label: data.label, lines: data.lines || [] });
          })
          .catch(() => setFinishError('Could not check the room kit.'));
        fetch('/api/housekeeping/cleaning-kits', { headers: hkHeaders() })
          .then((r) => (r.ok ? r.json() : { items: [] }))
          .then((data) => setFinishItems(data.items || []));
        return;
      }
    }
    housekeepingStore.updateTaskStatus(taskId, status);
    trackEvent('HK.Task.StatusUpdated', { taskId, status });
    loadData();
  };

  const finishTaskWithKit = async () => {
    if (!finishTask) return;
    const extras = finishExtras
      .map((row) => ({ itemId: row.itemId, quantity: Math.floor(Number(row.quantity) || 0) }))
      .filter((row) => row.itemId && row.quantity > 0);
    setFinishSaving(true);
    setFinishError('');
    try {
      const res = await fetch(`/api/housekeeping/tasks/${encodeURIComponent(finishTask.id)}/finish`, {
        method: 'POST',
        headers: hkHeaders(),
        body: JSON.stringify({ extras }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFinishError(data.error || 'Could not finish the task.');
        return;
      }
      await housekeepingStore.hydrateFromApi();
      trackEvent('HK.Task.StatusUpdated', { taskId: finishTask.id, status: 'completed', kit: true });
      const warnings = (data.warnings || []).map((row: { itemName: string; needed: number; onHand: number }) =>
        `${row.itemName}: kit asks for ${row.needed}, only ${row.onHand} on hand.`);
      if (warnings.length > 0) {
        setFinishWarnings(warnings);
        return;
      }
      setFinishTask(null);
      loadData();
    } finally {
      setFinishSaving(false);
    }
  };

  const handleChecklistUpdate = (taskId: string, completedItems: string[]) => {
    housekeepingStore.updateTaskStatus(taskId, 'in-progress', completedItems);
    trackEvent('HK.Task.ChecklistUpdated', { taskId, completedItems });
    loadData();
  };

  const statusLabel = (status: TaskStatus) =>
    status === 'in-progress' ? 'In Progress' :
    status === 'completed' ? 'Completed' :
    status === 'verified' ? 'Verified' :
    status === 'cancelled' ? 'Cancelled' : 'Pending';

  const getStatusColor = (status: TaskStatus) => {
    switch (status) {
      case 'pending': return 'default';
      case 'in-progress': return 'warning';
      case 'completed': return 'success';
      case 'verified': return 'secondary';
      case 'cancelled': return 'danger';
      default: return 'default';
    }
  };

  const filteredTasks = tasks.filter(task => {
    if (searchTerm) {
      const needle = searchTerm.toLowerCase();
      const hay = `${task.roomNumber} ${ticketOf(task)} ${jobLabel(task.taskType)}`.toLowerCase();
      if (!hay.includes(needle)) return false;
    }
    if (statusFilter === 'all') {
      if (task.status === 'cancelled') return false;
    } else if (task.status !== statusFilter) {
      return false;
    }
    if (priorityFilter !== 'all' && task.priority !== priorityFilter) return false;
    return true;
  });

  const sortedTasks = useMemo(() => {
    const dir = sort.direction === 'asc' ? 1 : -1;
    return [...filteredTasks].sort((a, b) => {
      switch (sort.column) {
        case 'room':
          return a.roomNumber.localeCompare(b.roomNumber, undefined, { numeric: true }) * dir;
        case 'job':
          return jobLabel(a.taskType).localeCompare(jobLabel(b.taskType)) * dir;
        case 'status':
          return a.status.localeCompare(b.status) * dir;
        case 'assigned':
          return (a.assignedName || a.assignedTo || '').localeCompare(b.assignedName || b.assignedTo || '') * dir;
        case 'number':
        default:
          return (ticketOf(a) || a.id).localeCompare(ticketOf(b) || b.id, undefined, { numeric: true }) * dir;
      }
    });
  }, [filteredTasks, sort]);

  const pages = Math.max(1, Math.ceil(sortedTasks.length / DESK_PAGE_SIZE));
  const pageSafe = Math.min(page, pages);
  const pagedTasks = sortedTasks.slice((pageSafe - 1) * DESK_PAGE_SIZE, pageSafe * DESK_PAGE_SIZE);

  useEffect(() => { setPage(1); }, [searchTerm, statusFilter, priorityFilter]);

  const getRoomTypeName = (typeId: string) => {
    return frontOfficeStore.roomTypes.find(rt => rt.id === typeId)?.name || 'Unknown';
  };

  const getStaffName = (staffId: string) => {
    return staff.find(s => s.id === staffId)?.name || 'Unassigned';
  };

  // Rooms for bulk: floor work is usually dirty (turnover) or occupied (daily)
  const roomsForBulk = rooms.filter((r) => {
    if (bulkTaskForm.roomStatusFilter === 'all') {
      return ['dirty', 'occupied', 'vacant', 'clean', 'inspected'].includes(r.status);
    }
    return r.status === bulkTaskForm.roomStatusFilter;
  });

  const activeAttendants = staff.filter((s) => s.active && (s.role === 'housekeeper' || s.role === 'supervisor'));
  const selectedRoom = rooms.find((r) => r.roomNumber === taskForm.roomNumber);

  return (
    <div className="space-y-3">
      {/* Header and Actions */}
      <div className="mb-[18px] flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-ghana-black shrink-0">Cleaning tasks</h2>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button
            size="sm"
            color="secondary"
            variant="flat"
            className="min-h-10"
            onClick={openBulkTaskModal}
          >
            Bulk Rooms
          </Button>
          <Button
            size="sm"
            color="primary"
            className="min-h-10 bg-ghana-green text-white"
            onClick={handleCreateTask}
          >
            + New Task
          </Button>
        </div>
      </div>

      {/* Quick Task Templates — compact strip (hideable via Customize) */}
      {!hideQuickCreate && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-gray-500 shrink-0">Quick create</span>
          {Object.entries(TASK_TEMPLATES).map(([key, template]) => (
            <button
              key={key}
              type="button"
              title={template.description}
              onClick={() => handleQuickTask(key)}
              className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-sm text-ghana-black transition-colors hover:border-ghana-gold hover:bg-gray-50"
            >
              <span aria-hidden>{template.icon}</span>
              <span className="font-medium">{template.name}</span>
              <span className="tabular-nums text-xs text-gray-500">{template.estimatedMinutes}m</span>
            </button>
          ))}
          {onHideQuickCreate && (
            <HideCardButton onHide={onHideQuickCreate} label="Quick create templates" />
          )}
        </div>
      )}

      {/* Filters — wrap on phone / zoomed screens */}
      <div className="mb-[18px] flex flex-wrap items-center gap-2">
        <Input
          size="sm"
          aria-label="Search room or area"
          placeholder="Search room or area..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          startContent={<span className="text-gray-400">🔍</span>}
          className="w-full max-w-full sm:w-56 sm:max-w-[14rem] shrink-0"
        />
        <Select
          size="sm"
          aria-label="Filter by status"
          placeholder="Filter by status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="w-full max-w-full sm:w-44 sm:max-w-[11rem] shrink-0"
        >
          <SelectItem key="all">All Statuses</SelectItem>
          <SelectItem key="pending">⏳ Pending</SelectItem>
          <SelectItem key="in-progress">🔄 In Progress</SelectItem>
          <SelectItem key="completed">✅ Completed</SelectItem>
          <SelectItem key="verified">🔍 Verified</SelectItem>
          <SelectItem key="cancelled">🚫 Cancelled</SelectItem>
        </Select>
        <Select
          size="sm"
          aria-label="Filter by priority"
          placeholder="Filter by priority"
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="w-full max-w-full sm:w-40 sm:max-w-[10rem] shrink-0"
        >
          <SelectItem key="all">All Priorities</SelectItem>
          <SelectItem key="low">Low</SelectItem>
          <SelectItem key="medium">Medium</SelectItem>
          <SelectItem key="high">High</SelectItem>
          <SelectItem key="urgent">Urgent</SelectItem>
        </Select>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-sm text-gray-600">Total:</span>
          <Badge color="primary" variant="flat">{filteredTasks.length}</Badge>
        </div>
        <div className="ml-auto flex shrink-0 rounded-lg border border-gray-200 bg-gray-50 p-0.5">
          <button
            type="button"
            className={`rounded-md px-3 min-h-8 text-sm ${taskLayout === 'cards' ? 'bg-white font-semibold text-ghana-black shadow-sm' : 'text-gray-600'}`}
            onClick={() => setTaskLayout('cards')}
          >
            Cards
          </button>
          <button
            type="button"
            className={`rounded-md px-3 min-h-8 text-sm ${taskLayout === 'table' ? 'bg-white font-semibold text-ghana-black shadow-sm' : 'text-gray-600'}`}
            onClick={() => setTaskLayout('table')}
          >
            Table
          </button>
        </div>
      </div>

      {/* Tasks */}
      <Card className={deskTableCardClassName}>
        <CardBody className={deskTableCardBodyClassName}>
          {taskLayout === 'cards' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
              {pagedTasks.length === 0 && <p className="text-sm text-gray-500 col-span-full text-center py-8">No tasks match.</p>}
              {pagedTasks.map((task) => {
                const number = ticketOf(task);
                const open = task.status === 'pending' || task.status === 'in-progress';
                return (
                <div
                  key={task.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleEditTask(task)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleEditTask(task); }}
                  className={`cursor-pointer rounded-xl border bg-white p-3 text-left shadow-none transition-colors hover:border-ghana-gold ${
                    task.status === 'in-progress' ? 'border-blue-200' :
                    task.status === 'completed' || task.status === 'verified' ? 'border-green-200' :
                    'border-gray-200'
                  }`}
                >
                  <div className="flex flex-col gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-[15px] font-semibold leading-tight text-ghana-black">{task.roomNumber}</p>
                      <p className="truncate text-xs leading-tight text-gray-500">
                        {jobLabel(task.taskType)}{number ? ` · ${number}` : ''}
                      </p>
                    </div>
                    <Chip size="sm" variant="flat" color={getStatusColor(task.status) as any} className="h-6 max-w-full">
                      {statusLabel(task.status)}
                    </Chip>
                    <p className="truncate text-xs text-blue-700">
                      {task.assignedName || (task.assignedTo ? getStaffName(task.assignedTo) : 'Unassigned')}
                    </p>
                    {open && (
                      <button
                        type="button"
                        className="mt-auto min-h-10 cursor-pointer rounded-lg bg-green-100 text-[11px] font-medium text-green-900"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleUpdateTaskStatus(task.id, 'completed');
                        }}
                      >
                        Finish
                      </button>
                    )}
                  </div>
                </div>
                );
              })}
            </div>
          ) : (
          <div ref={cols.frameRef} style={cols.frameStyle}>
          <Table aria-label="Tasks table" removeWrapper classNames={sizedTableClassNames(deskTableClassNames)}>
            <TableHeader>
              <TableColumn className="relative" style={cols.style('number')}>{<SortHeader label="Number" column="number" sort={sort} onSort={(c) => setSort((p) => toggleColumnSort(p, c))} />}{cols.sizer('number', 'Number')}</TableColumn>
              <TableColumn className="relative" style={cols.style('room')}>{<SortHeader label="Room" column="room" sort={sort} onSort={(c) => setSort((p) => toggleColumnSort(p, c))} />}{cols.sizer('room', 'Room')}</TableColumn>
              <TableColumn className="relative" style={cols.style('job')}>{<SortHeader label="Job" column="job" sort={sort} onSort={(c) => setSort((p) => toggleColumnSort(p, c))} />}{cols.sizer('job', 'Job')}</TableColumn>
              <TableColumn className="relative" style={cols.style('status')}>{<SortHeader label="Status" column="status" sort={sort} onSort={(c) => setSort((p) => toggleColumnSort(p, c))} />}{cols.sizer('status', 'Status')}</TableColumn>
              <TableColumn className="relative" style={cols.style('assigned')}>{<SortHeader label="Assigned" column="assigned" sort={sort} onSort={(c) => setSort((p) => toggleColumnSort(p, c))} />}{cols.sizer('assigned', 'Assigned')}</TableColumn>
              <TableColumn className="relative" style={cols.style('action')}>Action{cols.sizer('action', 'Action')}</TableColumn>
            </TableHeader>
            <TableBody emptyContent="No tasks match.">
              {pagedTasks.map((task) => (
                <TableRow
                  key={task.id}
                  className="cursor-pointer hover:bg-gray-50"
                  onClick={() => handleEditTask(task)}
                >
                  <TableCell>
                    <span className="font-medium tabular-nums text-ghana-black">{ticketOf(task) || '—'}</span>
                  </TableCell>
                  <TableCell>
                    <span className="font-semibold text-ghana-black">{task.roomNumber}</span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-gray-700">{jobLabel(task.taskType)}</span>
                  </TableCell>
                  <TableCell>
                    <Chip size="sm" variant="flat" color={getStatusColor(task.status) as any}>
                      {statusLabel(task.status)}
                    </Chip>
                  </TableCell>
                  <TableCell>
                    <span className="truncate text-sm text-gray-700">
                      {task.assignedName || (task.assignedTo ? getStaffName(task.assignedTo) : 'Unassigned')}
                    </span>
                  </TableCell>
                  <TableCell>
                    {(task.status === 'pending' || task.status === 'in-progress') && (
                      <button
                        type="button"
                        className="min-h-8 cursor-pointer rounded-lg bg-green-100 px-2 text-[11px] font-medium text-green-900"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleUpdateTaskStatus(task.id, 'completed');
                        }}
                      >
                        Finish
                      </button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
          )}
          <div className="mt-3 flex justify-end">
            <Pagination page={pageSafe} total={pages} onChange={setPage} showControls size="sm" />
          </div>
        </CardBody>
      </Card>

      {/* Task Creation/Edit Modal */}
      <Modal
        isOpen={taskModalOpen}
        onClose={() => setTaskModalOpen(false)}
        size="2xl"
        scrollBehavior="inside"
        classNames={{
          base: 'max-h-[90dvh]',
          body: 'gap-3 py-3',
        }}
      >
        <ModalContent>
          <ModalHeader className="flex flex-col gap-0.5 py-3">
            <span>{isCreatingTask ? 'Create cleaning task' : 'Edit cleaning task'}</span>
            <span className="text-xs font-normal text-gray-500">
              Rooms or public areas. Finishing a real clean takes the room kit, not a quantity the attendant types.
            </span>
          </ModalHeader>
          <ModalBody>
            {formError && <p className="text-sm text-danger">{formError}</p>}
            <div className="flex flex-wrap gap-1.5">
              {([
                { key: 'room' as const, label: 'Guest room' },
                { key: 'area' as const, label: 'Public / other area' },
              ]).map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => {
                    if (opt.key === taskForm.locationKind) return;
                    setResponsibleHint(null);
                    if (opt.key === 'area') {
                      void fetch('/api/housekeeping/cleaning-areas?active=1', {
                        headers: hkHeaders(),
                        cache: 'no-store',
                      })
                        .then((r) => (r.ok ? r.json() : { areas: [] }))
                        .then((data) => {
                          const list: CleaningArea[] = data.areas || [];
                          setCleaningAreas(list);
                          const firstArea = list[0]?.name || '';
                          setTaskForm((prev) => ({
                            ...prev,
                            locationKind: 'area',
                            roomNumber: firstArea || '__custom__',
                            roomTypeId: AREA_ROOM_TYPE_ID,
                            customArea: '',
                            taskType: prev.taskType === 'turnover' ? 'daily' : prev.taskType,
                            checklist:
                              prev.taskType === 'turnover'
                                ? [...TASK_TEMPLATES['lobby-public'].checklist]
                                : prev.checklist,
                            assignedTo: '',
                          }));
                        })
                        .catch(() => {
                          setTaskForm((prev) => ({
                            ...prev,
                            locationKind: 'area',
                            roomNumber: '__custom__',
                            roomTypeId: AREA_ROOM_TYPE_ID,
                            customArea: '',
                            assignedTo: '',
                          }));
                        });
                      setResponsibleHint(null);
                    } else {
                      setTaskForm({
                        ...taskForm,
                        locationKind: 'room',
                        roomNumber: '',
                        roomTypeId: '',
                        customArea: '',
                        assignedTo: '',
                      });
                    }
                  }}
                  className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                    taskForm.locationKind === opt.key
                      ? 'bg-ghana-black text-white'
                      : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {taskForm.locationKind === 'room' ? (
                <Select
                  label="Room"
                  size="sm"
                  placeholder="Select room"
                  selectedKeys={taskForm.roomNumber ? [taskForm.roomNumber] : []}
                  description={
                    selectedRoom
                      ? `${getRoomTypeName(selectedRoom.roomTypeId)} · ${selectedRoom.status}`
                      : undefined
                  }
                  onSelectionChange={(keys) => {
                    const roomNumber = Array.from(keys)[0] as string;
                    if (!roomNumber) return;
                    const room = rooms.find((r) => r.roomNumber === roomNumber);
                    const templateKey = suggestedJobForRoomStatus(room?.status);
                    const template = TASK_TEMPLATES[templateKey];
                    const { assignedTo } = resolveResponsible(roomNumber, activeAttendants);
                    setTaskForm({
                      ...taskForm,
                      locationKind: 'room',
                      roomNumber,
                      roomTypeId: room?.roomTypeId || '',
                      taskType: template.taskType,
                      priority: template.priority,
                      estimatedMinutes: template.estimatedMinutes,
                      checklist: [...template.checklist],
                      assignedTo,
                    });
                  }}
                  isRequired
                >
                  {[...rooms]
                    .sort((a, b) => a.roomNumber.localeCompare(b.roomNumber, undefined, { numeric: true }))
                    .map((room) => (
                      <SelectItem key={room.roomNumber} textValue={`${room.roomNumber} ${room.status}`}>
                        {room.roomNumber} · {room.status}
                      </SelectItem>
                    ))}
                </Select>
              ) : (
                <div className="flex flex-col gap-2">
                  <Select
                    label="Area"
                    size="sm"
                    placeholder={cleaningAreas.length ? 'Select area' : 'No areas set up'}
                    selectedKeys={taskForm.roomNumber ? [taskForm.roomNumber] : []}
                    description={
                      cleaningAreas.length
                        ? undefined
                        : 'Set up under Work → Cleaning areas'
                    }
                    onSelectionChange={(keys) => {
                      const area = Array.from(keys)[0] as string;
                      if (!area) return;
                      setTaskForm({
                        ...taskForm,
                        locationKind: 'area',
                        roomNumber: area,
                        roomTypeId: AREA_ROOM_TYPE_ID,
                        customArea: area === '__custom__' ? taskForm.customArea : '',
                        assignedTo: '',
                      });
                      setResponsibleHint(null);
                    }}
                    isRequired
                  >
                    {[
                      ...cleaningAreas.map((area) => (
                        <SelectItem key={area.name} textValue={area.name}>
                          {area.name}
                        </SelectItem>
                      )),
                      <SelectItem key="__custom__" textValue="Custom area">
                        Custom area…
                      </SelectItem>,
                    ]}
                  </Select>
                </div>
              )}
              <Select
                label="Job"
                size="sm"
                selectedKeys={[taskForm.taskType]}
                onSelectionChange={(keys) => {
                  const taskType = Array.from(keys)[0] as HousekeepingTask['taskType'];
                  if (!taskType) return;
                  const template = templateForTaskType(taskType);
                  if (template) {
                    setTaskForm({
                      ...taskForm,
                      taskType,
                      priority: template.priority,
                      estimatedMinutes: template.estimatedMinutes,
                      checklist: [...template.checklist],
                    });
                  } else {
                    setTaskForm({ ...taskForm, taskType });
                  }
                }}
                isRequired
              >
                {[
                  ...(taskForm.locationKind === 'room'
                    ? [<SelectItem key="turnover">🔄 Turnover — after check-out / dirty</SelectItem>]
                    : []),
                  <SelectItem key="daily">
                    {taskForm.locationKind === 'room' ? '🧹 Daily clean — occupied room' : '🧹 Daily / scheduled clean'}
                  </SelectItem>,
                  <SelectItem key="deep-clean">✨ Deep clean</SelectItem>,
                  <SelectItem key="maintenance">🔧 Maintenance support</SelectItem>,
                  ...(taskForm.locationKind === 'room'
                    ? [<SelectItem key="inspection">🔍 Inspection prep</SelectItem>]
                    : []),
                ]}
              </Select>
              {taskForm.locationKind === 'area' && taskForm.roomNumber === '__custom__' && (
                <Input
                  label="Area name"
                  size="sm"
                  className="md:col-span-2"
                  placeholder="e.g. Banquet foyer, Staff canteen"
                  value={taskForm.customArea}
                  onChange={(e) => setTaskForm({ ...taskForm, customArea: e.target.value })}
                  isRequired
                />
              )}
              <Select
                label="Priority"
                size="sm"
                selectedKeys={[taskForm.priority]}
                onSelectionChange={(keys) => {
                  const priority = Array.from(keys)[0] as TaskPriority;
                  if (priority) setTaskForm({ ...taskForm, priority });
                }}
              >
                <SelectItem key="low">Low</SelectItem>
                <SelectItem key="medium">Medium</SelectItem>
                <SelectItem key="high">High</SelectItem>
                <SelectItem key="urgent">Urgent</SelectItem>
              </Select>
              <Input
                label="Estimated minutes"
                size="sm"
                type="number"
                min={5}
                value={String(taskForm.estimatedMinutes)}
                onChange={(e) => setTaskForm({ ...taskForm, estimatedMinutes: parseInt(e.target.value, 10) || 0 })}
              />
              <Select
                label="Assign attendant"
                size="sm"
                className="md:col-span-2"
                selectedKeys={[taskForm.assignedTo || 'unassigned']}
                onSelectionChange={(keys) => {
                  const value = Array.from(keys)[0] as string;
                  setTaskForm({ ...taskForm, assignedTo: value === 'unassigned' ? '' : value });
                }}
                description={
                  taskForm.locationKind === 'room' && responsibleHint
                    ? `Responsible (${responsibleHint.shift}): ${responsibleHint.name}${
                        responsibleHint.matchedStaffId ? ' — pre-filled' : ' — assign manually if listed'
                      }`
                    : taskForm.locationKind === 'room'
                      ? 'Optional. Set “Responsible for” under Staff to auto-suggest rooms.'
                      : 'Optional — assign who will clean this area.'
                }
              >
                {[
                  <SelectItem key="unassigned">Unassigned — assign later</SelectItem>,
                  ...activeAttendants.map((s) => (
                    <SelectItem key={s.id}>{s.name} ({s.role})</SelectItem>
                  )),
                ]}
              </Select>
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <label className="text-sm font-medium text-gray-700">Checklist</label>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="flat"
                    onPress={() => {
                      const template = templateForTaskType(taskForm.taskType);
                      if (template) setTaskForm({ ...taskForm, checklist: [...template.checklist] });
                    }}
                  >
                    Reset
                  </Button>
                  <Button
                    size="sm"
                    color="secondary"
                    variant="flat"
                    onPress={() => setTaskForm({ ...taskForm, checklist: [...taskForm.checklist, ''] })}
                  >
                    + Step
                  </Button>
                </div>
              </div>
              <div className="max-h-36 space-y-1.5 overflow-y-auto pr-0.5">
                {taskForm.checklist.map((item, index) => (
                  <div key={index} className="flex gap-1.5">
                    <Input
                      size="sm"
                      value={item}
                      onChange={(e) => {
                        const newChecklist = [...taskForm.checklist];
                        newChecklist[index] = e.target.value;
                        setTaskForm({ ...taskForm, checklist: newChecklist });
                      }}
                      placeholder="Checklist step"
                    />
                    <Button
                      size="sm"
                      color="danger"
                      variant="flat"
                      isIconOnly
                      aria-label="Remove step"
                      onPress={() => setTaskForm({ ...taskForm, checklist: taskForm.checklist.filter((_, i) => i !== index) })}
                    >
                      ✕
                    </Button>
                  </div>
                ))}
                {taskForm.checklist.length === 0 && (
                  <p className="text-xs text-gray-500 py-1">No steps — add one or reset to the job checklist.</p>
                )}
              </div>
            </div>

            <Textarea
              label="Notes for attendant"
              size="sm"
              minRows={2}
              maxRows={3}
              placeholder="Guest still in room, focus on bathroom, etc."
              value={taskForm.notes}
              onChange={(e) => setTaskForm({ ...taskForm, notes: e.target.value })}
            />
          </ModalBody>
          <ModalFooter className="py-3">
            {!isCreatingTask && selectedTask?.status === 'pending' && (
              <Button color="danger" variant="light" onPress={async () => {
                const { confirmDelete } = await import('../DangerConfirm');
                if (!(await confirmDelete('this task', 'A task that was never started will be permanently removed.'))) return;
                housekeepingStore.removeTask(selectedTask.id);
                setTaskModalOpen(false);
              }}>Delete</Button>
            )}
            {!isCreatingTask && selectedTask && selectedTask.status !== 'pending' && selectedTask.status !== 'void' && (
              <Button color="warning" variant="flat" onPress={async () => {
                const { confirmVoid } = await import('../DangerConfirm');
                if (!(await confirmVoid('this task', 'The task stays on file as Void.'))) return;
                housekeepingStore.updateTask(selectedTask.id, { status: 'void' });
                setTaskModalOpen(false);
              }}>Void</Button>
            )}
            <Button variant="flat" onPress={() => setTaskModalOpen(false)}>
              Cancel
            </Button>
            {!isCreatingTask && selectedTask && (selectedTask.status === 'pending' || selectedTask.status === 'in-progress') && (
              <button
                type="button"
                className="cursor-pointer rounded-lg bg-green-700 px-3 py-2 text-sm font-medium text-white"
                onClick={() => {
                  const id = selectedTask.id;
                  setTaskModalOpen(false);
                  handleUpdateTaskStatus(id, 'completed');
                }}
              >
                Finish
              </button>
            )}
            <Button color="primary" onPress={handleSaveTask}>
              {isCreatingTask ? 'Create task' : 'Save task'}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Bulk Task Creation Modal */}
      <Modal isOpen={bulkTaskModalOpen} onClose={() => setBulkTaskModalOpen(false)} size="3xl">
        <ModalContent>
          <ModalHeader>
            <div>
              <h3 className="text-lg font-semibold">Create tasks for several rooms</h3>
              <p className="text-sm font-normal text-gray-600">
                Same job and checklist on each selected room. Dirty rooms usually need turnover; occupied rooms need daily clean.
              </p>
            </div>
          </ModalHeader>
          <ModalBody>
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Job</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {Object.entries(TASK_TEMPLATES).map(([key, template]) => (
                    <button
                      key={key}
                      type="button"
                      className={`p-3 border rounded-lg text-left transition-all ${
                        bulkTaskForm.template === key
                          ? 'border-ghana-gold bg-ghana-gold/10'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => {
                        const nextFilter =
                          key === 'turnover' ? 'dirty' : key === 'daily-cleaning' ? 'occupied' : bulkTaskForm.roomStatusFilter;
                        const matching = rooms
                          .filter((r) => (nextFilter === 'all' ? true : r.status === nextFilter))
                          .map((r) => r.roomNumber);
                        setBulkTaskForm({
                          ...bulkTaskForm,
                          template: key as keyof typeof TASK_TEMPLATES,
                          priority: template.priority,
                          roomStatusFilter: nextFilter,
                          selectedRooms: matching,
                        });
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{template.icon}</span>
                        <div>
                          <div className="font-medium">{template.name}</div>
                          <div className="text-xs text-gray-600">{template.description}</div>
                          <div className="text-xs text-gray-500 mt-1">{template.estimatedMinutes} min · {template.checklist.length} steps</div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Rooms ({bulkTaskForm.selectedRooms.length} selected)
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {([
                      ['dirty', 'Dirty'],
                      ['occupied', 'Occupied'],
                      ['vacant', 'Vacant'],
                      ['clean', 'Clean'],
                      ['all', 'All'],
                    ] as const).map(([key, label]) => (
                      <Button
                        key={key}
                        size="sm"
                        variant={bulkTaskForm.roomStatusFilter === key ? 'solid' : 'flat'}
                        color={bulkTaskForm.roomStatusFilter === key ? 'primary' : 'default'}
                        onPress={() => {
                          const matching = rooms
                            .filter((r) => (key === 'all' ? ['dirty', 'occupied', 'vacant', 'clean', 'inspected'].includes(r.status) : r.status === key))
                            .map((r) => r.roomNumber);
                          setBulkTaskForm({
                            ...bulkTaskForm,
                            roomStatusFilter: key,
                            selectedRooms: matching,
                          });
                        }}
                      >
                        {label}
                      </Button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 max-h-48 overflow-y-auto border rounded-lg p-3">
                  {roomsForBulk.length === 0 ? (
                    <p className="col-span-full text-sm text-gray-500">No rooms in this status right now.</p>
                  ) : (
                    roomsForBulk.map((room) => {
                      const selected = bulkTaskForm.selectedRooms.includes(room.roomNumber);
                      return (
                        <button
                          key={room.roomNumber}
                          type="button"
                          className={`p-2 border rounded text-left text-sm transition-all ${
                            selected ? 'border-ghana-gold bg-ghana-gold/10' : 'border-gray-200 hover:border-gray-300'
                          }`}
                          onClick={() => {
                            setBulkTaskForm({
                              ...bulkTaskForm,
                              selectedRooms: selected
                                ? bulkTaskForm.selectedRooms.filter((r) => r !== room.roomNumber)
                                : [...bulkTaskForm.selectedRooms, room.roomNumber],
                            });
                          }}
                        >
                          <div className="font-medium">{room.roomNumber}</div>
                          <div className="text-xs text-gray-600">{room.status}</div>
                        </button>
                      );
                    })
                  )}
                </div>
                <div className="mt-2 flex gap-2">
                  <Button
                    size="sm"
                    variant="flat"
                    onPress={() => setBulkTaskForm({ ...bulkTaskForm, selectedRooms: roomsForBulk.map((r) => r.roomNumber) })}
                  >
                    Select listed
                  </Button>
                  <Button
                    size="sm"
                    variant="flat"
                    onPress={() => setBulkTaskForm({ ...bulkTaskForm, selectedRooms: [] })}
                  >
                    Clear
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Select
                  label="Assign attendant"
                  selectedKeys={[bulkTaskForm.assignedTo || 'unassigned']}
                  onSelectionChange={(keys) => {
                    const value = Array.from(keys)[0] as string;
                    setBulkTaskForm({ ...bulkTaskForm, assignedTo: value === 'unassigned' ? '' : value });
                  }}
                >
                  {[
                    <SelectItem key="unassigned">Unassigned — assign later</SelectItem>,
                    ...activeAttendants.map((s) => (
                      <SelectItem key={s.id}>{s.name} ({s.role})</SelectItem>
                    )),
                  ]}
                </Select>
                <Select
                  label="Priority"
                  selectedKeys={[bulkTaskForm.priority]}
                  onSelectionChange={(keys) => {
                    const priority = Array.from(keys)[0] as TaskPriority;
                    if (priority) setBulkTaskForm({ ...bulkTaskForm, priority });
                  }}
                >
                  <SelectItem key="low">Low</SelectItem>
                  <SelectItem key="medium">Medium</SelectItem>
                  <SelectItem key="high">High</SelectItem>
                  <SelectItem key="urgent">Urgent</SelectItem>
                </Select>
              </div>

              <Textarea
                label="Notes for all rooms"
                placeholder="Same note on every task created here..."
                value={bulkTaskForm.notes}
                onChange={(e) => setBulkTaskForm({ ...bulkTaskForm, notes: e.target.value })}
              />

              <div className="bg-gray-50 p-4 rounded-lg text-sm">
                <h4 className="font-medium mb-2">Will create</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <span className="text-gray-600">Job</span>
                    <div className="font-medium">{TASK_TEMPLATES[bulkTaskForm.template]?.name}</div>
                  </div>
                  <div>
                    <span className="text-gray-600">Rooms</span>
                    <div className="font-medium">{bulkTaskForm.selectedRooms.length}</div>
                  </div>
                  <div>
                    <span className="text-gray-600">Attendant</span>
                    <div className="font-medium">
                      {bulkTaskForm.assignedTo
                        ? staff.find((s) => s.id === bulkTaskForm.assignedTo)?.name
                        : 'Unassigned'}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-600">Checklist</span>
                    <div className="font-medium">{TASK_TEMPLATES[bulkTaskForm.template]?.checklist.length} steps</div>
                  </div>
                </div>
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={() => setBulkTaskModalOpen(false)}>
              Cancel
            </Button>
            <Button
              color="primary"
              onPress={handleBulkTaskCreation}
              isDisabled={bulkTaskForm.selectedRooms.length === 0}
            >
              Create {bulkTaskForm.selectedRooms.length || ''} {bulkTaskForm.selectedRooms.length === 1 ? 'task' : 'tasks'}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal
        isOpen={!!finishTask}
        onClose={() => setFinishTask(null)}
        size="lg"
        placement="center"
        scrollBehavior="inside"
        classNames={{ base: 'dialog-fit' }}
      >
        <ModalContent>
          <ModalHeader>Finish clean — room {finishTask?.roomNumber}</ModalHeader>
          <ModalBody>
            <p className="text-sm text-gray-600">{finishPreview?.label || 'Checking the room kit…'}</p>
            {finishPreview && finishPreview.lines.length > 0 && (
              <div className="space-y-1">
                {finishPreview.lines.map((line) => (
                  <div key={line.itemId} className="flex justify-between text-sm">
                    <span>{line.itemName}</span>
                    <span className="font-mono">{line.quantity}</span>
                  </div>
                ))}
              </div>
            )}
            {finishPreview && finishPreview.lines.length === 0 && (
              <p className="text-sm text-gray-500">Nothing will come off stock for this clean.</p>
            )}
            <div className="space-y-2 pt-2">
              <p className="text-sm text-gray-600">Need more than the kit? Request it. Stock stays put until a supervisor approves.</p>
              {finishExtras.map((row, index) => (
                <div key={index} className="keep-cols grid grid-cols-[1fr_88px_auto] gap-2 items-center">
                  <Select
                    aria-label="Extra supply"
                    size="sm"
                    selectedKeys={row.itemId ? [row.itemId] : []}
                    onSelectionChange={(keys) => {
                      const itemId = String(Array.from(keys)[0] || '');
                      setFinishExtras((rows) => rows.map((item, i) => (i === index ? { ...item, itemId } : item)));
                    }}
                  >
                    {finishItems.map((item) => (
                      <SelectItem key={item.id}>{item.name}</SelectItem>
                    ))}
                  </Select>
                  <Input
                    aria-label="Extra quantity"
                    type="number"
                    size="sm"
                    min={1}
                    value={row.quantity}
                    onChange={(e) => setFinishExtras((rows) => rows.map((item, i) => (i === index ? { ...item, quantity: e.target.value } : item)))}
                  />
                  <Button size="sm" variant="light" onPress={() => setFinishExtras((rows) => rows.filter((_, i) => i !== index))}>Remove</Button>
                </div>
              ))}
              <Button size="sm" variant="flat" onPress={() => setFinishExtras((rows) => [...rows, { itemId: '', quantity: '1' }])}>
                Request extra
              </Button>
            </div>
            {finishWarnings.length > 0 && (
              <div className="text-sm text-warning space-y-1">
                {finishWarnings.map((warning) => <p key={warning}>{warning}</p>)}
                <p>The task is finished. Only what was on hand was taken.</p>
              </div>
            )}
            {finishError && <p className="text-sm text-danger">{finishError}</p>}
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={() => setFinishTask(null)}>{finishWarnings.length > 0 ? 'Close' : 'Cancel'}</Button>
            {finishWarnings.length === 0 && (
              <Button color="primary" onPress={finishTaskWithKit} isLoading={finishSaving}>Finish task</Button>
            )}
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
