// Security Operations Data Models

export interface SecurityIncident {
  id: string;
  incidentNumber: string;
  type: 'theft' | 'vandalism' | 'trespassing' | 'suspicious_activity' | 'medical_emergency' | 'fire_alarm' | 'power_outage' | 'water_leak' | 'equipment_failure' | 'other';
  severity: 'low' | 'medium' | 'high' | 'critical';
  priority: 'low' | 'medium' | 'high' | 'urgent';
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
  evidence?: string[];
  cost?: number;
  insuranceClaim?: boolean;
  policeReport?: boolean;
  attachments?: string[];
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PatrolLog {
  id: string;
  patrolNumber: string;
  officerId: string;
  officerName: string;
  startTime: Date;
  endTime?: Date;
  route: string;
  checkpoints: PatrolCheckpoint[];
  incidents: string[]; // SecurityIncident IDs
  notes?: string;
  status: 'active' | 'completed' | 'interrupted';
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
  photo?: string;
}

export interface AccessControl {
  id: string;
  cardNumber: string;
  employeeId: string;
  employeeName: string;
  department: string;
  accessLevel: 'restricted' | 'standard' | 'elevated' | 'admin';
  areas: string[];
  issuedDate: Date;
  expiryDate?: Date;
  isActive: boolean;
  lastUsed?: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Visitor {
  id: string;
  visitorNumber: string;
  firstName: string;
  lastName: string;
  company?: string;
  purpose: string;
  hostEmployee: string;
  hostDepartment: string;
  checkInTime: Date;
  checkOutTime?: Date;
  badgeNumber?: string;
  areas: string[];
  isVIP: boolean;
  vehicleInfo?: {
    make: string;
    model: string;
    color: string;
    plateNumber: string;
  };
  status: 'checked_in' | 'checked_out' | 'escorted' | 'overdue';
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SecurityEquipment {
  id: string;
  equipmentCode: string;
  name: string;
  type: 'camera' | 'sensor' | 'alarm' | 'lock' | 'monitor' | 'other';
  location: string;
  status: 'operational' | 'maintenance' | 'faulty' | 'offline';
  lastMaintenance?: Date;
  nextMaintenance?: Date;
  manufacturer: string;
  model: string;
  serialNumber: string;
  warrantyExpiry?: Date;
  cost: number;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SecurityTraining {
  id: string;
  trainingCode: string;
  title: string;
  type: 'fire_safety' | 'first_aid' | 'evacuation' | 'security_protocol' | 'emergency_response' | 'other';
  duration: number; // in hours
  required: boolean;
  frequency: 'once' | 'annually' | 'biannually' | 'quarterly';
  lastConducted?: Date;
  nextDue?: Date;
  instructor: string;
  materials: string[];
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SecurityReport {
  id: string;
  reportNumber: string;
  type: 'daily' | 'weekly' | 'monthly' | 'incident' | 'patrol' | 'access' | 'visitor' | 'equipment' | 'training';
  period: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  startDate: Date;
  endDate: Date;
  generatedBy: string;
  generatedAt: Date;
  summary: string;
  details: any;
  attachments?: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface SecurityAnalytics {
  id: string;
  period: 'daily' | 'weekly' | 'monthly';
  date: Date;
  totalIncidents: number;
  incidentsByType: Record<string, number>;
  incidentsBySeverity: Record<string, number>;
  incidentsByLocation: Record<string, number>;
  averageResponseTime: number; // in minutes
  patrolsCompleted: number;
  patrolsMissed: number;
  accessViolations: number;
  visitorsProcessed: number;
  equipmentOperational: number;
  equipmentMaintenance: number;
  trainingCompliance: number;
  trends: Array<{
    date: Date;
    incidents: number;
    patrols: number;
    violations: number;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

export interface CostAnalysis {
  id: string;
  period: 'monthly' | 'quarterly' | 'yearly';
  startDate: Date;
  endDate: Date;
  totalCost: number;
  incidentCosts: number;
  equipmentCosts: number;
  trainingCosts: number;
  personnelCosts: number;
  maintenanceCosts: number;
  insuranceCosts: number;
  costBreakdown: Record<string, number>;
  budgetVariance: number;
  costPerIncident: number;
  costPerPatrol: number;
  recommendations: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface EmergencyContact {
  id: string;
  name: string;
  role: string;
  department: string;
  phone: string;
  email: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  availability: '24/7' | 'business_hours' | 'on_call' | 'weekends';
  isActive: boolean;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SecurityPolicy {
  id: string;
  policyCode: string;
  title: string;
  category: 'access_control' | 'visitor_management' | 'incident_response' | 'patrol_procedures' | 'emergency_protocols' | 'other';
  version: string;
  effectiveDate: Date;
  reviewDate: Date;
  status: 'draft' | 'active' | 'under_review' | 'archived';
  content: string;
  attachments?: string[];
  approvedBy?: string;
  approvedAt?: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}
