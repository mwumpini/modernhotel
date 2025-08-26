'use client';

export type IncidentSeverity = 'low' | 'medium' | 'high' | 'critical';
export type IncidentStatus = 'reported' | 'investigating' | 'resolved' | 'closed';
export type PatrolStatus = 'scheduled' | 'in-progress' | 'completed' | 'missed';
export type VisitorStatus = 'checked-in' | 'checked-out' | 'expired';

export interface SecurityIncident {
  id: string;
  incidentNumber: string;
  title: string;
  description: string;
  location: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  category: 'theft' | 'vandalism' | 'trespassing' | 'fire' | 'medical' | 'noise' | 'suspicious' | 'other';
  reportedBy: string;
  reportedAt: string;
  assignedTo?: string;
  assignedAt?: string;
  resolvedAt?: string;
  resolution?: string;
  witnesses?: string[];
  evidence?: string[]; // photo/video URLs
  guestInvolved?: string; // guest ID if applicable
  roomInvolved?: string; // room number if applicable
  policeNotified: boolean;
  policeReportNumber?: string;
  estimatedLoss?: number;
  insuranceClaim?: boolean;
  followUpRequired: boolean;
  followUpDate?: string;
  notes: string[];
}

export interface Visitor {
  id: string;
  visitorId: string;
  name: string;
  phone: string;
  idType: 'ghana-card' | 'passport' | 'drivers-license' | 'other';
  idNumber: string;
  purpose: string;
  hostName: string;
  hostRoom?: string;
  hostPhone: string;
  checkInTime: string;
  checkOutTime?: string;
  expectedDuration: number; // hours
  status: VisitorStatus;
  vehicleNumber?: string;
  items?: string[]; // items brought in
  notes?: string;
  photo?: string; // visitor photo URL
  approvedBy: string;
  escortRequired: boolean;
  escortName?: string;
}

export interface PatrolRoute {
  id: string;
  name: string;
  description: string;
  checkpoints: PatrolCheckpoint[];
  estimatedDuration: number; // minutes
  frequency: 'hourly' | '2-hourly' | '4-hourly' | 'daily' | 'custom';
  customSchedule?: string[];
  isActive: boolean;
  assignedGuards: string[];
}

export interface PatrolCheckpoint {
  id: string;
  name: string;
  location: string;
  description: string;
  qrCode?: string;
  nfcTag?: string;
  requiredActions: string[];
  estimatedTime: number; // minutes
  isCritical: boolean;
}

export interface PatrolLog {
  id: string;
  routeId: string;
  routeName: string;
  guardId: string;
  guardName: string;
  scheduledStart: string;
  actualStart?: string;
  actualEnd?: string;
  status: PatrolStatus;
  checkpoints: PatrolCheckpointLog[];
  issues?: string[];
  weather?: string;
  notes?: string;
  supervisorApproved?: boolean;
  supervisorId?: string;
  supervisorNotes?: string;
}

export interface PatrolCheckpointLog {
  checkpointId: string;
  checkpointName: string;
  scheduledTime: string;
  actualTime?: string;
  status: 'completed' | 'missed' | 'delayed';
  actions: string[];
  issues?: string[];
  photos?: string[];
  notes?: string;
}

export interface KeyControl {
  id: string;
  keyNumber: string;
  keyType: 'master' | 'floor' | 'room' | 'service' | 'emergency' | 'other';
  description: string;
  location: string;
  assignedTo?: string;
  assignedAt?: string;
  returnedAt?: string;
  status: 'available' | 'assigned' | 'lost' | 'damaged';
  lastAudit: string;
  nextAudit: string;
  notes?: string;
  duplicateKeys: number;
  securityLevel: 'low' | 'medium' | 'high' | 'critical';
}

export interface SecurityStaff {
  id: string;
  name: string;
  badgeNumber: string;
  role: 'guard' | 'supervisor' | 'manager' | 'cctv-operator';
  shift: 'morning' | 'afternoon' | 'night' | 'flexible';
  status: 'active' | 'off-duty' | 'sick' | 'suspended';
  currentLocation?: string;
  lastSeen: string;
  contactNumber: string;
  emergencyContact: string;
  certifications: string[];
  trainingExpiry: string;
  performanceRating: number; // 1-5
  incidentsHandled: number;
  commendations: number;
  warnings: number;
}

export interface EmergencyContact {
  id: string;
  name: string;
  organization: string;
  phone: string;
  email?: string;
  category: 'police' | 'fire' | 'medical' | 'management' | 'maintenance' | 'other';
  responseTime: number; // minutes
  isActive: boolean;
  notes?: string;
}

export interface SecurityReport {
  id: string;
  reportNumber: string;
  title: string;
  type: 'daily' | 'incident' | 'patrol' | 'visitor' | 'key-audit' | 'monthly';
  date: string;
  preparedBy: string;
  approvedBy?: string;
  approvedAt?: string;
  content: string;
  attachments?: string[];
  isConfidential: boolean;
  distribution: string[];
  status: 'draft' | 'submitted' | 'approved' | 'distributed';
}

export interface SecurityAlert {
  id: string;
  title: string;
  message: string;
  severity: IncidentSeverity;
  category: 'incident' | 'patrol' | 'visitor' | 'system' | 'weather' | 'other';
  location?: string;
  isActive: boolean;
  createdAt: string;
  expiresAt?: string;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  actionRequired: boolean;
  actionTaken?: string;
}
