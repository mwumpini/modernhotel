// Security Operations Data Models

export interface SecurityIncident {
  id: string;
  incidentNumber: string;
  type: 'theft' | 'vandalism' | 'trespassing' | 'suspicious_activity' | 'medical_emergency' | 'fire_alarm' | 'power_outage' | 'water_leak' | 'equipment_failure' | 'other';
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'reported' | 'investigating' | 'resolved' | 'closed' | 'escalated';
  location: string;
  floor?: string;
  room?: string;
  description: string;
  reportedBy: string;
  reportedAt: Date;
  assignedTo?: string;
  assignedAt?: Date;
  resolvedAt?: Date;
  resolution?: string;
  witnesses?: string[];
  cost?: number;
  policeReport?: boolean;
  insuranceClaim?: boolean;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PatrolCheckpoint {
  id: string;
  location: string;
  scheduledTime: Date;
  actualTime?: Date;
  status: 'pending' | 'completed' | 'missed';
  notes?: string;
}

export interface PatrolLog {
  id: string;
  patrolNumber: string;
  officerId?: string;
  officerName: string;
  route: string;
  startTime: Date;
  endTime?: Date;
  status: 'active' | 'completed' | 'interrupted';
  checkpoints: PatrolCheckpoint[];
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Visitor {
  id: string;
  visitorNumber: string;
  name: string;
  phone?: string;
  idType?: 'ghana-card' | 'passport' | 'drivers-license' | 'other';
  idNumber?: string;
  purpose: string;
  hostName?: string;
  hostRoom?: string;
  checkInTime: Date;
  checkOutTime?: Date;
  expectedHours?: number;
  status: 'checked_in' | 'checked_out' | 'overdue';
  vehicleNumber?: string;
  escortRequired: boolean;
  escortName?: string;
  approvedBy?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ComplianceRequirement {
  id: string;
  title: string;
  category: 'fire_safety' | 'health_hygiene' | 'employment' | 'licensing' | 'other';
  frequency: 'once' | 'monthly' | 'quarterly' | 'annually';
  lastCompletedAt?: Date;
  nextDueDate: Date;
  responsiblePerson?: string;
  penaltyAmount?: number;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

/** A security guard without a real login/User account — most commonly outsourced/agency
 *  staff. Lets them be picked as a patrol officer without needing a system account. */
export interface SecurityPersonnel {
  id: string;
  name: string;
  phone?: string;
  agency?: string;
  role?: string;
  isActive: boolean;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

/** A reusable named checkpoint location, so building a patrol route is picking from a
 *  list instead of retyping the same location names every time. */
export interface CheckpointLocation {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** A reusable named patrol route, same idea as CheckpointLocation. */
export interface PatrolRoute {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** A duty shift (check-in/check-out) for a security person — real staff or
 *  outsourced/contracted personnel — so management knows who's on site and when. */
export interface SecurityShift {
  id: string;
  /** 'staff:<userId>' | 'person:<SecurityPersonnel id>' */
  personKey: string;
  personName: string;
  checkInTime: Date;
  checkOutTime?: Date;
  status: 'on_duty' | 'completed';
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}
