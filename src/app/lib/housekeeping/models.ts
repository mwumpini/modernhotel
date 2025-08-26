// Housekeeping & Maintenance Data Models

export interface Room {
  id: string;
  number: string;
  type: 'standard' | 'deluxe' | 'suite' | 'presidential';
  floor: number;
  status: 'occupied' | 'vacant' | 'dirty' | 'clean' | 'maintenance' | 'out-of-order';
  lastCleaned: Date;
  nextCleaning: Date;
  cleaningType: 'daily' | 'deep-clean' | 'turnover' | 'maintenance';
  notes?: string;
  amenities: string[];
  capacity: number;
  rate: number;
  isActive: boolean;
}

export interface CleaningTask {
  id: string;
  roomId: string;
  roomNumber: string;
  assignedToId: string;
  assignedToName: string;
  type: 'daily' | 'deep-clean' | 'turnover' | 'maintenance' | 'inspection';
  status: 'pending' | 'in-progress' | 'completed' | 'verified' | 'failed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  startTime?: Date;
  completedTime?: Date;
  duration: number; // in minutes
  checklist: CleaningChecklistItem[];
  supplies: CleaningSupply[];
  notes?: string;
  supervisorId?: string;
  supervisorName?: string;
  qualityScore?: number; // 1-10
  photos?: string[]; // URLs to photos
  createdAt: Date;
  updatedAt: Date;
}

export interface CleaningChecklistItem {
  id: string;
  description: string;
  isCompleted: boolean;
  completedAt?: Date;
  completedBy?: string;
  notes?: string;
}

export interface CleaningSupply {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  cost: number;
  supplier?: string;
}

export interface MaintenanceRequest {
  id: string;
  roomId: string;
  roomNumber: string;
  reportedBy: string;
  reportedAt: Date;
  category: 'plumbing' | 'electrical' | 'hvac' | 'furniture' | 'appliances' | 'structural' | 'other';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'reported' | 'assigned' | 'in-progress' | 'completed' | 'verified' | 'closed';
  description: string;
  assignedToId?: string;
  assignedToName?: string;
  estimatedCost: number;
  actualCost?: number;
  startDate?: Date;
  completionDate?: Date;
  parts: MaintenancePart[];
  laborHours: number;
  laborRate: number;
  totalCost: number;
  notes?: string;
  photos?: string[];
  isUrgent: boolean;
  guestImpact: 'none' | 'low' | 'medium' | 'high';
}

export interface MaintenancePart {
  id: string;
  name: string;
  partNumber: string;
  quantity: number;
  unitCost: number;
  supplier: string;
  warranty?: string;
}

export interface HousekeepingStaff {
  id: string;
  name: string;
  employeeId: string;
  position: 'housekeeper' | 'supervisor' | 'manager' | 'maintenance' | 'inspector';
  department: 'housekeeping' | 'maintenance' | 'inspection';
  shift: 'morning' | 'afternoon' | 'night';
  isActive: boolean;
  skills: string[];
  certifications: string[];
  hireDate: Date;
  hourlyRate: number;
  performance: {
    averageQualityScore: number;
    tasksCompleted: number;
    averageTaskTime: number;
    customerSatisfaction: number;
  };
}

export interface WorkOrder {
  id: string;
  type: 'cleaning' | 'maintenance' | 'inspection' | 'supply-restock';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'created' | 'assigned' | 'in-progress' | 'completed' | 'verified' | 'closed';
  title: string;
  description: string;
  location: string;
  assignedToId?: string;
  assignedToName?: string;
  createdBy: string;
  createdAt: Date;
  dueDate: Date;
  completedAt?: Date;
  estimatedDuration: number; // in minutes
  actualDuration?: number;
  materials: WorkOrderMaterial[];
  laborCost: number;
  materialCost: number;
  totalCost: number;
  notes?: string;
  attachments?: string[];
}

export interface WorkOrderMaterial {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  cost: number;
  supplier?: string;
}

export interface InspectionReport {
  id: string;
  roomId: string;
  roomNumber: string;
  inspectorId: string;
  inspectorName: string;
  inspectionDate: Date;
  type: 'daily' | 'weekly' | 'monthly' | 'pre-arrival' | 'post-departure';
  status: 'passed' | 'failed' | 'conditional';
  score: number; // 1-100
  checklist: InspectionChecklistItem[];
  issues: InspectionIssue[];
  recommendations: string[];
  photos?: string[];
  nextInspectionDate: Date;
  notes?: string;
}

export interface InspectionChecklistItem {
  id: string;
  category: string;
  item: string;
  standard: string;
  score: number; // 1-10
  isPassed: boolean;
  notes?: string;
}

export interface InspectionIssue {
  id: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: 'cleaning' | 'maintenance' | 'safety' | 'aesthetics';
  isResolved: boolean;
  resolutionDate?: Date;
  resolutionNotes?: string;
}

export interface SupplyInventory {
  id: string;
  name: string;
  category: 'cleaning' | 'maintenance' | 'amenities' | 'linens' | 'toiletries';
  currentStock: number;
  minimumStock: number;
  maximumStock: number;
  unit: string;
  unitCost: number;
  supplier: string;
  lastRestocked: Date;
  nextRestockDate: Date;
  expiryDate?: Date;
  location: string;
  isActive: boolean;
  notes?: string;
}

export interface HousekeepingReport {
  id: string;
  type: 'daily' | 'weekly' | 'monthly' | 'custom';
  startDate: Date;
  endDate: Date;
  generatedBy: string;
  generatedAt: Date;
  summary: {
    totalRooms: number;
    roomsCleaned: number;
    roomsMaintained: number;
    pendingTasks: number;
    completedTasks: number;
    averageCleaningTime: number;
    qualityScore: number;
    maintenanceRequests: number;
    resolvedMaintenance: number;
  };
  details: {
    roomStatusBreakdown: Record<string, number>;
    taskCompletionRates: Record<string, number>;
    staffPerformance: Record<string, any>;
    maintenanceCosts: Record<string, number>;
    supplyUsage: Record<string, number>;
  };
  recommendations: string[];
}

export interface LaborReport {
  id: string;
  period: 'daily' | 'weekly' | 'monthly';
  startDate: Date;
  endDate: Date;
  totalHours: number;
  totalCost: number;
  staffBreakdown: {
    employeeId: string;
    name: string;
    hours: number;
    cost: number;
    tasksCompleted: number;
    qualityScore: number;
  }[];
  departmentBreakdown: {
    department: string;
    hours: number;
    cost: number;
    tasksCompleted: number;
  }[];
  efficiency: {
    averageTaskTime: number;
    tasksPerHour: number;
    costPerTask: number;
    qualityTrend: number;
  };
}

export interface QualityMetrics {
  id: string;
  period: 'daily' | 'weekly' | 'monthly';
  date: Date;
  overallScore: number;
  cleanlinessScore: number;
  maintenanceScore: number;
  inspectionScore: number;
  guestSatisfaction: number;
  supervisorRating: number;
  areas: {
    category: string;
    score: number;
    issues: number;
    improvements: number;
  }[];
  trends: {
    period: string;
    score: number;
    change: number;
  }[];
}
