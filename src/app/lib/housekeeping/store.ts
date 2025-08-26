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
    this.initializeDemoData();
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
      id: `TASK-${Date.now().toString().slice(-6)}`,
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
  }

  // Staff Management
  getStaffByRole(role: HousekeepingStaff['role']): HousekeepingStaff[] {
    return this.staff.filter(s => s.role === role);
  }

  updateStaffEfficiency(staffId: string, completedToday: number) {
    const staff = this.staff.find(s => s.id === staffId);
    if (!staff) return;

    staff.completedToday = completedToday;
    staff.efficiency = Math.round((completedToday / staff.dailyTarget) * 100);
    staff.lastActive = new Date().toISOString();

    this.notify();
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
  }

  updateMaintenanceRequest(requestId: string, updatedRequest: Partial<MaintenanceRequest>) {
    const request = this.maintenanceRequests.find(r => r.id === requestId);
    if (!request) return;

    Object.assign(request, updatedRequest);
    this.notify();
    trackEvent('HK.MaintenanceRequest.Updated', { requestId, roomNumber: request.roomNumber });
  }

  private notify() {
    this.listeners.forEach(listener => listener());
  }
}

export const housekeepingStore = new HousekeepingStore();
