'use client';

export type RoomStatus = 
  | 'occupied' 
  | 'vacant' 
  | 'dirty' 
  | 'clean' 
  | 'inspected' 
  | 'out-of-order' 
  | 'maintenance';

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TaskStatus = 'pending' | 'in-progress' | 'completed' | 'verified' | 'cancelled' | 'void';

export interface HousekeepingTask {
  id: string;
  roomNumber: string;
  roomTypeId: string;
  taskType: 'daily' | 'turnover' | 'deep-clean' | 'maintenance' | 'inspection';
  priority: TaskPriority;
  status: TaskStatus;
  assignedTo?: string;
  assignedName?: string;
  assignedAt?: string;
  createdAt?: string;
  startedAt?: string;
  completedAt?: string;
  verifiedAt?: string;
  notes?: string;
  estimatedMinutes: number;
  actualMinutes?: number;
  checklist: string[];
  completedItems: string[];
  issues?: string[];
  photos?: string[];
  /** Supplies taken from housekeeping stock when the task was finished. */
  suppliesUsed?: { itemId: string; itemName: string; quantity: number }[];
  /** True once those supplies have been issued, so finishing again does not deduct twice. */
  suppliesIssued?: boolean;
}

export interface RoomInspection {
  id: string;
  roomNumber: string;
  inspectorId: string;
  inspectorName: string;
  inspectionDate: string;
  status: 'passed' | 'failed' | 'partial' | 'void';
  score: number; // 0-100
  categories: {
    cleanliness: number;
    amenities: number;
    maintenance: number;
    safety: number;
  };
  notes: string;
  photos: string[];
  followUpRequired: boolean;
  followUpNotes?: string;
}

export interface MaintenanceRequest {
  id: string;
  roomNumber: string;
  reportedBy: string;
  reportedAt: string;
  category: 'plumbing' | 'electrical' | 'hvac' | 'furniture' | 'appliances' | 'structural' | 'other';
  priority: TaskPriority;
  status: 'reported' | 'assigned' | 'in-progress' | 'completed' | 'verified' | 'void';
  description: string;
  assignedTo?: string;
  estimatedCost?: number;
  actualCost?: number;
  completedAt?: string;
  notes: string[];
  photos: string[];
}

export interface HousekeepingStaff {
  id: string;
  name: string;
  role: 'housekeeper' | 'supervisor' | 'inspector' | 'maintenance';
  active: boolean;
  currentTasks: string[];
  dailyTarget: number;
  completedToday: number;
  efficiency: number; // percentage
  lastActive: string;
}

export interface DailySchedule {
  id: string;
  date: string;
  staffId: string;
  assignedRooms: string[];
  startTime: string;
  endTime: string;
  breaks: Array<{ start: string; end: string }>;
  status: 'scheduled' | 'in-progress' | 'completed' | 'void';
  notes?: string;
}

export interface RoomStatusHistory {
  roomNumber: string;
  status: RoomStatus;
  timestamp: string;
  changedBy: string;
  reason?: string;
  previousStatus: RoomStatus;
}
