'use client';

import { 
  RoomStatus, 
  HousekeepingTask, 
  RoomInspection, 
  MaintenanceRequest, 
  HousekeepingStaff, 
  DailySchedule,
  RoomStatusHistory,
  TaskPriority,
  TaskStatus 
} from './types';
import { trackEvent } from '../analytics/trackEvent';
import { useSettingsStore } from '../settings/store';
import { frontOfficeStore } from '../frontoffice/store';
import { getClientTenantSubdomain } from '../api/clientTenant';

function hkHeaders(): HeadersInit {
  return { 'Content-Type': 'application/json', 'x-tenant-subdomain': getClientTenantSubdomain() };
}

interface RoomStatusData {
  roomNumber: string;
  roomTypeId: string;
  status: RoomStatus;
  lastUpdated: string;
  currentGuest?: string;
  checkInDate?: string;
  checkOutDate?: string;
  notes?: string;
  blockedUntil?: string;
}

class HousekeepingStore {
  private rooms: Map<string, RoomStatusData> = new Map();
  private tasks: HousekeepingTask[] = [];
  private inspections: RoomInspection[] = [];
  private maintenanceRequests: MaintenanceRequest[] = [];
  private staff: HousekeepingStaff[] = [];
  private schedules: DailySchedule[] = [];
  private statusHistory: RoomStatusHistory[] = [];
  private listeners: Array<() => void> = [];

  constructor() {
    // Start empty; will sync from Settings
    // this.initializeDemoData();
    // Sync rooms from Settings so overview reflects configured rooms
    try {
      this.syncRoomsFromSettings();
      // Subscribe to settings changes so rooms reflect Settings in real-time
      useSettingsStore.subscribe((state) => {
        if (state.roomManagement.rooms) {
          this.syncRoomsFromSettings();
        }
      });
    } catch (e) {
      console.warn('HK: Room sync subscription failed', e);
    }
  }

  /**
   * Pull real, Prisma-persisted tasks/maintenance requests/staff/room-status history
   * from the DB, replacing the in-memory state. The Task/Maintenance Prisma models
   * are plain String columns (not enums), so this store's existing status/taskType
   * vocabulary ('in-progress', 'deep-clean', etc.) round-trips through the API
   * unchanged — no translation layer needed.
   */
  async hydrateFromApi(): Promise<void> {
    if (typeof window === 'undefined') return;
    try {
      const [tasksRes, maintRes, staffRes, statusRes] = await Promise.all([
        fetch('/api/housekeeping/tasks', { headers: hkHeaders(), cache: 'no-store' }),
        fetch('/api/housekeeping/maintenance', { headers: hkHeaders(), cache: 'no-store' }),
        fetch('/api/housekeeping/staff', { headers: hkHeaders(), cache: 'no-store' }),
        fetch('/api/housekeeping/room-status', { headers: hkHeaders(), cache: 'no-store' }),
      ]);

      if (tasksRes.ok) {
        const data = await tasksRes.json();
        this.tasks = (data.tasks || []).map((t: any): HousekeepingTask => {
          const details = t.details || {};
          return {
            id: t.id,
            roomNumber: t.roomNumber || '',
            roomTypeId: details.roomTypeId || '',
            taskType: t.taskType,
            priority: t.priority,
            status: t.status,
            assignedTo: t.assignedTo || undefined,
            assignedAt: details.assignedAt || undefined,
            startedAt: t.startedAt || undefined,
            completedAt: t.completedAt || undefined,
            verifiedAt: details.verifiedAt || undefined,
            notes: t.notes || undefined,
            estimatedMinutes: details.estimatedMinutes || 0,
            actualMinutes: details.actualMinutes || undefined,
            checklist: details.checklist || [],
            completedItems: details.completedItems || [],
            issues: details.issues || [],
            photos: details.photos || [],
          };
        });
      }

      if (maintRes.ok) {
        const data = await maintRes.json();
        this.maintenanceRequests = (data.requests || []).map((r: any): MaintenanceRequest => ({
          id: r.id,
          roomNumber: r.roomNumber || '',
          reportedBy: r.reportedBy || '',
          reportedAt: r.createdAt,
          category: r.category,
          priority: r.priority,
          status: r.status === 'open' ? 'reported' : r.status,
          description: r.description,
          assignedTo: r.assignedTo || undefined,
          estimatedCost: r.estimatedCost != null ? Number(r.estimatedCost) : undefined,
          actualCost: r.actualCost != null ? Number(r.actualCost) : undefined,
          completedAt: r.resolvedAt || undefined,
          notes: r.notes ? [r.notes] : [],
          photos: [],
        }));
      }

      if (staffRes.ok) {
        const data = await staffRes.json();
        this.staff = (data.staff || []).map((s: any): HousekeepingStaff => ({
          id: s.id,
          name: s.name,
          role: s.role,
          active: s.isActive,
          currentTasks: this.tasks.filter((t) => t.assignedTo === s.id && t.status !== 'completed').map((t) => t.id),
          dailyTarget: s.dailyTarget,
          completedToday: s.completedToday,
          efficiency: s.dailyTarget > 0 ? Math.round((s.completedToday / s.dailyTarget) * 100) : 0,
          lastActive: s.updatedAt,
        }));
      }

      if (statusRes.ok) {
        const data = await statusRes.json();
        const logs = (data.logs || []) as Array<{ roomNumber: string; toStatus: string; createdAt: string }>;
        // logs are ordered desc by createdAt — first occurrence per room is the latest.
        const latestByRoom = new Map<string, string>();
        for (const log of logs) {
          if (!latestByRoom.has(log.roomNumber)) latestByRoom.set(log.roomNumber, log.toStatus);
        }
        latestByRoom.forEach((status, roomNumber) => {
          const room = this.rooms.get(roomNumber);
          if (room) room.status = status as RoomStatus;
        });
      }

      this.notify();
    } catch (e) {
      console.warn('HK: hydrateFromApi failed:', e);
    }
  }

  private initializeDemoData() {
    // Initialize room statuses
    const roomTypes = ['standard', 'deluxe', 'suite'];
    for (let floor = 1; floor <= 3; floor++) {
      for (let room = 1; room <= 5; room++) {
        const roomNumber = `${floor}${room.toString().padStart(2, '0')}`;
        const roomTypeId = roomTypes[Math.floor(Math.random() * roomTypes.length)];
        const statuses: RoomStatus[] = ['occupied', 'vacant', 'dirty', 'clean', 'inspected'];
        const status = statuses[Math.floor(Math.random() * statuses.length)];
        
        this.rooms.set(roomNumber, {
          roomNumber,
          roomTypeId,
          status,
          lastUpdated: new Date().toISOString(),
          currentGuest: status === 'occupied' ? `Guest ${roomNumber}` : undefined,
          checkInDate: status === 'occupied' ? new Date().toISOString() : undefined,
          checkOutDate: status === 'occupied' ? new Date(Date.now() + 86400000).toISOString() : undefined,
        });
      }
    }

    // Initialize staff
    this.staff = [
      { id: 'HK001', name: 'Sarah Johnson', role: 'housekeeper', active: true, currentTasks: [], dailyTarget: 15, completedToday: 8, efficiency: 85, lastActive: new Date().toISOString() },
      { id: 'HK002', name: 'Michael Chen', role: 'housekeeper', active: true, currentTasks: [], dailyTarget: 15, completedToday: 12, efficiency: 92, lastActive: new Date().toISOString() },
      { id: 'SUP001', name: 'Maria Rodriguez', role: 'supervisor', active: true, currentTasks: [], dailyTarget: 0, completedToday: 0, efficiency: 95, lastActive: new Date().toISOString() },
      { id: 'INS001', name: 'David Wilson', role: 'inspector', active: true, currentTasks: [], dailyTarget: 20, completedToday: 15, efficiency: 88, lastActive: new Date().toISOString() },
      { id: 'MT001', name: 'James Brown', role: 'maintenance', active: true, currentTasks: [], dailyTarget: 8, completedToday: 5, efficiency: 78, lastActive: new Date().toISOString() },
    ];

    // Initialize some tasks
    this.createTask({
      roomNumber: '101',
      roomTypeId: 'standard',
      taskType: 'turnover',
      priority: 'high',
      estimatedMinutes: 45,
      checklist: ['Change linens', 'Clean bathroom', 'Vacuum floor', 'Restock amenities', 'Check appliances']
    });

    this.createTask({
      roomNumber: '205',
      roomTypeId: 'deluxe',
      taskType: 'daily',
      priority: 'medium',
      estimatedMinutes: 30,
      checklist: ['Make bed', 'Clean bathroom', 'Empty trash', 'Restock towels']
    });

    // Initialize some maintenance requests
    this.createMaintenanceRequest({
      roomNumber: '302',
      reportedBy: 'Front Desk',
      category: 'plumbing',
      priority: 'high',
      description: 'Leaking faucet in bathroom',
    });
  }

  // Room Status Management
  updateRoomStatus(roomNumber: string, status: RoomStatus, changedBy: string, reason?: string) {
    const room = this.rooms.get(roomNumber);
    if (!room) return;

    const previousStatus = room.status;
    room.status = status;
    room.lastUpdated = new Date().toISOString();

    // Add to history
    this.statusHistory.unshift({
      roomNumber,
      status,
      timestamp: new Date().toISOString(),
      changedBy,
      reason,
      previousStatus
    });

    this.notify();
    trackEvent('HK.RoomStatusChanged', { roomNumber, status, previousStatus, changedBy });

    fetch('/api/housekeeping/room-status', {
      method: 'POST',
      headers: hkHeaders(),
      body: JSON.stringify({ roomNumber, fromStatus: previousStatus, toStatus: status, changedBy, reason }),
    }).catch((e) => console.warn('HK: Failed to sync room status:', e));
  }

  getRoomStatus(roomNumber: string): RoomStatusData | undefined {
    return this.rooms.get(roomNumber);
  }

  getAllRooms(): RoomStatusData[] {
    return Array.from(this.rooms.values());
  }

  getRoomsByStatus(status: RoomStatus): RoomStatusData[] {
    return Array.from(this.rooms.values()).filter(room => room.status === status);
  }

  // Mirror Settings rooms -> housekeeping room status map (non-destructive)
  private syncRoomsFromSettings() {
    try {
      const settings = useSettingsStore.getState();
      const cfgRooms = settings.roomManagement.rooms || [];
      for (const r of cfgRooms) {
        if (!this.rooms.has(r.number)) {
          this.rooms.set(r.number, {
            roomNumber: r.number,
            roomTypeId: r.typeId,
            status: 'vacant',
            lastUpdated: new Date().toISOString()
          });
        }
      }
      this.notify();
      trackEvent('HK.Rooms.SyncedFromSettings', { count: cfgRooms.length });
    } catch (e) {
      console.error('HK: Failed to sync rooms from settings', e);
    }
  }

  // Task Management
  createTask(data: {
    roomNumber: string;
    roomTypeId: string;
    taskType: HousekeepingTask['taskType'];
    priority: TaskPriority;
    estimatedMinutes: number;
    checklist: string[];
    notes?: string;
  }): HousekeepingTask {
    const task: HousekeepingTask = {
      id: `TASK-${Date.now().toString().slice(-6)}-${Math.floor(Math.random()*1000)}`,
      ...data,
      status: 'pending',
      completedItems: [],
      assignedAt: undefined,
      startedAt: undefined,
      completedAt: undefined,
      verifiedAt: undefined,
      actualMinutes: undefined,
      issues: [],
      photos: []
    };

    this.tasks.unshift(task);
    this.notify();
    trackEvent('HK.TaskCreated', { taskId: task.id, roomNumber: task.roomNumber, taskType: task.taskType });

    // Send the client-generated id as-is so the server creates the row under the same
    // id — callers (e.g. TaskManagementPanel) call assignTask(task.id, ...) synchronously
    // right after createTask() returns, before this POST could otherwise resolve.
    fetch('/api/housekeeping/tasks', {
      method: 'POST',
      headers: hkHeaders(),
      body: JSON.stringify({
        id: task.id,
        roomNumber: task.roomNumber,
        taskType: task.taskType,
        status: task.status,
        priority: task.priority,
        notes: task.notes,
        details: { roomTypeId: task.roomTypeId, estimatedMinutes: task.estimatedMinutes, checklist: task.checklist },
      }),
    }).catch((e) => console.warn('HK: Failed to sync new task:', e));

    return task;
  }

  assignTask(taskId: string, staffId: string) {
    const task = this.tasks.find(t => t.id === taskId);
    if (!task) return;

    task.assignedTo = staffId;
    task.assignedAt = new Date().toISOString();
    task.status = 'in-progress';

    // Update staff current tasks
    const staff = this.staff.find(s => s.id === staffId);
    if (staff) {
      staff.currentTasks.push(taskId);
    }

    this.notify();
    trackEvent('HK.TaskAssigned', { taskId, staffId });

    fetch(`/api/housekeeping/tasks/${encodeURIComponent(taskId)}`, {
      method: 'PATCH',
      headers: hkHeaders(),
      body: JSON.stringify({ status: 'in-progress', assignedTo: staffId, assignedName: staff?.name }),
    }).catch((e) => console.warn('HK: Failed to sync task assignment:', e));
  }

  updateTaskStatus(taskId: string, status: TaskStatus, completedItems?: string[]) {
    const task = this.tasks.find(t => t.id === taskId);
    if (!task) return;

    task.status = status;
    
    if (status === 'in-progress' && !task.startedAt) {
      task.startedAt = new Date().toISOString();
    }
    
    if (status === 'completed') {
      task.completedAt = new Date().toISOString();
      task.actualMinutes = Math.floor((Date.now() - new Date(task.startedAt || task.assignedAt || '').getTime()) / 60000);
    }

    if (completedItems) {
      task.completedItems = completedItems;
    }

    this.notify();
    trackEvent('HK.TaskStatusUpdated', { taskId, status });

    fetch(`/api/housekeeping/tasks/${encodeURIComponent(taskId)}`, {
      method: 'PATCH',
      headers: hkHeaders(),
      body: JSON.stringify({
        status,
        details: { roomTypeId: task.roomTypeId, estimatedMinutes: task.estimatedMinutes, checklist: task.checklist, completedItems: task.completedItems, actualMinutes: task.actualMinutes },
      }),
    }).catch((e) => console.warn('HK: Failed to sync task status:', e));
  }

  getTasksByStatus(status: TaskStatus): HousekeepingTask[] {
    return this.tasks.filter(task => task.status === status);
  }

  getTasksByStaff(staffId: string): HousekeepingTask[] {
    return this.tasks.filter(task => task.assignedTo === staffId);
  }

  // Maintenance Requests
  createMaintenanceRequest(data: {
    roomNumber: string;
    reportedBy: string;
    category: MaintenanceRequest['category'];
    priority: TaskPriority;
    description: string;
  }): MaintenanceRequest {
    const request: MaintenanceRequest = {
      id: `MR-${Date.now().toString().slice(-6)}`,
      ...data,
      status: 'reported',
      reportedAt: new Date().toISOString(),
      notes: [],
      photos: []
    };

    this.maintenanceRequests.unshift(request);
    this.notify();
    trackEvent('HK.MaintenanceRequestCreated', { requestId: request.id, roomNumber: request.roomNumber, category: request.category });

    // Real POST always sets status='open' on create (mapped back to 'reported' by
    // hydrateFromApi) — client-generated id sent through so it matches immediately,
    // same reasoning as createTask.
    fetch('/api/housekeeping/maintenance', {
      method: 'POST',
      headers: hkHeaders(),
      body: JSON.stringify({
        id: request.id,
        roomNumber: request.roomNumber,
        reportedBy: request.reportedBy,
        category: request.category,
        priority: request.priority,
        description: request.description,
      }),
    }).catch((e) => console.warn('HK: Failed to sync maintenance request:', e));

    return request;
  }

  updateMaintenanceStatus(requestId: string, status: MaintenanceRequest['status'], assignedTo?: string) {
    const request = this.maintenanceRequests.find(r => r.id === requestId);
    if (!request) return;

    request.status = status;
    if (assignedTo) request.assignedTo = assignedTo;
    if (status === 'completed') request.completedAt = new Date().toISOString();

    this.notify();
    trackEvent('HK.MaintenanceStatusUpdated', { requestId, status });

    fetch('/api/housekeeping/maintenance', {
      method: 'PATCH',
      headers: hkHeaders(),
      body: JSON.stringify({ id: requestId, status, assignedTo }),
    }).catch((e) => console.warn('HK: Failed to sync maintenance status:', e));
  }

  // Staff Management
  getStaffByRole(role: HousekeepingStaff['role']): HousekeepingStaff[] {
    return this.staff.filter(s => s.role === role);
  }

  addStaff(data: { name: string; role: HousekeepingStaff['role']; dailyTarget: number }): HousekeepingStaff {
    const member: HousekeepingStaff = {
      id: `HK-${Date.now().toString().slice(-6)}`,
      name: data.name,
      role: data.role,
      active: true,
      currentTasks: [],
      dailyTarget: data.dailyTarget,
      completedToday: 0,
      efficiency: 0,
      lastActive: new Date().toISOString(),
    };
    this.staff.push(member);
    this.notify();
    trackEvent('HK.StaffAdded', { staffId: member.id, role: member.role });

    fetch('/api/housekeeping/staff', {
      method: 'POST',
      headers: hkHeaders(),
      body: JSON.stringify({ id: member.id, name: member.name, role: member.role, dailyTarget: member.dailyTarget, isActive: true }),
    }).catch((e) => console.warn('HK: Failed to sync new staff member:', e));

    return member;
  }

  updateStaff(staffId: string, updates: Partial<Pick<HousekeepingStaff, 'name' | 'role' | 'dailyTarget' | 'active'>>) {
    const staff = this.staff.find(s => s.id === staffId);
    if (!staff) return;

    Object.assign(staff, updates);
    staff.lastActive = new Date().toISOString();
    this.notify();
    trackEvent('HK.StaffUpdated', { staffId });

    fetch('/api/housekeeping/staff', {
      method: 'POST',
      headers: hkHeaders(),
      body: JSON.stringify({ id: staffId, name: staff.name, role: staff.role, dailyTarget: staff.dailyTarget, isActive: staff.active }),
    }).catch((e) => console.warn('HK: Failed to sync staff update:', e));
  }

  toggleStaffStatus(staffId: string) {
    const staff = this.staff.find(s => s.id === staffId);
    if (!staff) return;
    this.updateStaff(staffId, { active: !staff.active });
  }

  updateStaffEfficiency(staffId: string, completedToday: number) {
    const staff = this.staff.find(s => s.id === staffId);
    if (!staff) return;

    staff.completedToday = completedToday;
    staff.efficiency = staff.dailyTarget > 0 ? Math.round((completedToday / staff.dailyTarget) * 100) : 0;
    staff.lastActive = new Date().toISOString();

    this.notify();

    fetch('/api/housekeeping/staff', {
      method: 'POST',
      headers: hkHeaders(),
      body: JSON.stringify({ id: staffId, name: staff.name, role: staff.role, dailyTarget: staff.dailyTarget, completedToday, isActive: staff.active }),
    }).catch((e) => console.warn('HK: Failed to sync staff efficiency:', e));
  }

  // Inspections
  createInspection(data: {
    roomNumber: string;
    inspectorId: string;
    inspectorName: string;
    categories: RoomInspection['categories'];
    notes: string;
  }): RoomInspection {
    const totalScore = Object.values(data.categories).reduce((sum, score) => sum + score, 0) / 4;
    const status: RoomInspection['status'] = totalScore >= 90 ? 'passed' : totalScore >= 70 ? 'partial' : 'failed';

    const inspection: RoomInspection = {
      id: `INS-${Date.now().toString().slice(-6)}`,
      ...data,
      inspectionDate: new Date().toISOString(),
      status,
      score: Math.round(totalScore),
      photos: [],
      followUpRequired: status !== 'passed'
    };

    this.inspections.unshift(inspection);
    this.notify();
    trackEvent('HK.InspectionCompleted', { inspectionId: inspection.id, roomNumber: inspection.roomNumber, score: inspection.score });
    return inspection;
  }

  // Analytics
  getDailyStats() {
    const today = new Date().toISOString().split('T')[0];
    const todayTasks = this.tasks.filter(t => t.completedAt?.startsWith(today));
    const todayInspections = this.inspections.filter(i => i.inspectionDate.startsWith(today));
    const todayMaintenance = this.maintenanceRequests.filter(m => m.completedAt?.startsWith(today));

    return {
      tasksCompleted: todayTasks.length,
      inspectionsCompleted: todayInspections.length,
      maintenanceCompleted: todayMaintenance.length,
      averageTaskTime: todayTasks.length > 0 ? 
        Math.round(todayTasks.reduce((sum, t) => sum + (t.actualMinutes || 0), 0) / todayTasks.length) : 0,
      averageInspectionScore: todayInspections.length > 0 ?
        Math.round(todayInspections.reduce((sum, i) => sum + i.score, 0) / todayInspections.length) : 0
    };
  }

  // Store interface
  subscribe(listener: () => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  getAllMaintenanceRequests(): MaintenanceRequest[] {
    return [...this.maintenanceRequests];
  }

  getAllTasks(): HousekeepingTask[] {
    return [...this.tasks];
  }

  getAllInspections(): RoomInspection[] {
    return [...this.inspections];
  }

  getAllStaff(): HousekeepingStaff[] {
    return [...this.staff];
  }

  getMaintenanceRequests(): MaintenanceRequest[] {
    return [...this.maintenanceRequests];
  }

  getTasks(): HousekeepingTask[] {
    return [...this.tasks];
  }

  getInspections(): RoomInspection[] {
    return [...this.inspections];
  }

  getStaff(): HousekeepingStaff[] {
    return [...this.staff];
  }

  updateTask(taskId: string, updatedTask: Partial<HousekeepingTask>) {
    const task = this.tasks.find(t => t.id === taskId);
    if (!task) return;

    Object.assign(task, updatedTask);
    this.notify();
    trackEvent('HK.Task.Updated', { taskId, roomNumber: task.roomNumber });

    fetch(`/api/housekeeping/tasks/${encodeURIComponent(taskId)}`, {
      method: 'PATCH',
      headers: hkHeaders(),
      body: JSON.stringify({
        status: task.status,
        assignedTo: task.assignedTo,
        notes: task.notes,
        priority: task.priority,
        details: { roomTypeId: task.roomTypeId, estimatedMinutes: task.estimatedMinutes, checklist: task.checklist, completedItems: task.completedItems, actualMinutes: task.actualMinutes, issues: task.issues },
      }),
    }).catch((e) => console.warn('HK: Failed to sync task update:', e));
  }

  updateMaintenanceRequest(requestId: string, updatedRequest: Partial<MaintenanceRequest>) {
    const request = this.maintenanceRequests.find(r => r.id === requestId);
    if (!request) return;

    Object.assign(request, updatedRequest);
    this.notify();
    trackEvent('HK.MaintenanceRequest.Updated', { requestId, roomNumber: request.roomNumber });

    fetch('/api/housekeeping/maintenance', {
      method: 'PATCH',
      headers: hkHeaders(),
      body: JSON.stringify({ id: requestId, status: request.status, assignedTo: request.assignedTo, priority: request.priority, notes: request.notes?.[0], estimatedCost: request.estimatedCost, actualCost: request.actualCost }),
    }).catch((e) => console.warn('HK: Failed to sync maintenance update:', e));
  }

  private notify() {
    this.listeners.forEach(listener => listener());
  }

  // Communication with Front Office Store
  syncWithFrontOffice() {
    try {
      // Get current reservations from front office
      const reservations = frontOfficeStore.reservations;
      
      // Update room statuses based on reservations
      reservations.forEach(reservation => {
        if (reservation.roomId) {
          const room = this.rooms.get(reservation.roomId);
          if (room) {
            if (reservation.status === 'checked-in') {
              this.updateRoomStatus(reservation.roomId, 'occupied', 'Front Office', 'Guest checked in');
            } else if (reservation.status === 'checked-out') {
              this.updateRoomStatus(reservation.roomId, 'dirty', 'Front Office', 'Guest checked out');
            }
          }
        }
      });

      // Notify listeners of changes
      this.notify();
      trackEvent('HK.SyncedWithFrontOffice', { reservationCount: reservations.length });
    } catch (e) {
      console.error('HK: Failed to sync with front office', e);
    }
  }

  // Get rooms that need attention for front office
  getRoomsNeedingAttention() {
    return {
      dirty: this.getRoomsByStatus('dirty'),
      maintenance: this.getRoomsByStatus('maintenance'),
      outOfOrder: this.getRoomsByStatus('out-of-order'),
      readyForInspection: this.getRoomsByStatus('clean'),
      total: this.getAllRooms().length
    };
  }

  // Update room status from front office
  updateRoomStatusFromFrontOffice(roomNumber: string, status: RoomStatus, reason: string) {
    this.updateRoomStatus(roomNumber, status, 'Front Office', reason);
    
    // If room is marked as dirty (check-out), create cleaning task
    if (status === 'dirty') {
      this.createTask({
        roomNumber,
        roomTypeId: this.rooms.get(roomNumber)?.roomTypeId || 'standard',
        taskType: 'turnover',
        priority: 'high',
        estimatedMinutes: 45,
        checklist: ['Change linens', 'Clean bathroom', 'Vacuum floor', 'Restock amenities', 'Check appliances']
      });
    }
  }
}

export const housekeepingStore = new HousekeepingStore();
