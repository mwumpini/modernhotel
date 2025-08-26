'use client';

import { 
  SecurityIncident, 
  Visitor, 
  PatrolRoute, 
  PatrolLog,
  KeyControl,
  SecurityStaff,
  EmergencyContact,
  SecurityReport,
  SecurityAlert,
  IncidentSeverity,
  IncidentStatus,
  PatrolStatus,
  VisitorStatus
} from './types';
import { trackEvent } from '../analytics/trackEvent';

class SecurityStore {
  private incidents: SecurityIncident[] = [];
  private visitors: Visitor[] = [];
  private patrolRoutes: PatrolRoute[] = [];
  private patrolLogs: PatrolLog[] = [];
  private keys: KeyControl[] = [];
  private staff: SecurityStaff[] = [];
  private emergencyContacts: EmergencyContact[] = [];
  private reports: SecurityReport[] = [];
  private alerts: SecurityAlert[] = [];
  private listeners: Array<() => void> = [];

  constructor() {
    this.initializeDemoData();
  }

  private initializeDemoData() {
    // Initialize security staff
    this.staff = [
      {
        id: 'SEC001',
        name: 'Kwame Mensah',
        badgeNumber: 'SEC-001',
        role: 'supervisor',
        shift: 'morning',
        status: 'active',
        currentLocation: 'Main Gate',
        lastSeen: new Date().toISOString(),
        contactNumber: '+233 20 123 4567',
        emergencyContact: '+233 24 987 6543',
        certifications: ['Security Guard License', 'First Aid', 'Fire Safety'],
        trainingExpiry: new Date(Date.now() + 6 * 30 * 24 * 60 * 60 * 1000).toISOString(),
        performanceRating: 4.5,
        incidentsHandled: 12,
        commendations: 3,
        warnings: 0
      },
      {
        id: 'SEC002',
        name: 'Ama Osei',
        badgeNumber: 'SEC-002',
        role: 'guard',
        shift: 'night',
        status: 'active',
        currentLocation: 'Parking Lot',
        lastSeen: new Date().toISOString(),
        contactNumber: '+233 24 555 1234',
        emergencyContact: '+233 20 777 8888',
        certifications: ['Security Guard License'],
        trainingExpiry: new Date(Date.now() + 3 * 30 * 24 * 60 * 60 * 1000).toISOString(),
        performanceRating: 4.2,
        incidentsHandled: 8,
        commendations: 1,
        warnings: 1
      }
    ];

    // Initialize emergency contacts
    this.emergencyContacts = [
      {
        id: 'EC001',
        name: 'Accra Central Police',
        organization: 'Ghana Police Service',
        phone: '+233 30 222 2222',
        category: 'police',
        responseTime: 10,
        isActive: true
      },
      {
        id: 'EC002',
        name: 'Accra Fire Service',
        organization: 'Ghana National Fire Service',
        phone: '+233 30 333 3333',
        category: 'fire',
        responseTime: 8,
        isActive: true
      },
      {
        id: 'EC003',
        name: 'Korle Bu Emergency',
        organization: 'Korle Bu Teaching Hospital',
        phone: '+233 30 444 4444',
        category: 'medical',
        responseTime: 15,
        isActive: true
      }
    ];

    // Initialize patrol routes
    this.patrolRoutes = [
      {
        id: 'PR001',
        name: 'Main Building Patrol',
        description: 'Complete building perimeter and internal areas',
        checkpoints: [
          {
            id: 'CP001',
            name: 'Main Entrance',
            location: 'Ground Floor - Main Entrance',
            description: 'Check main entrance security',
            requiredActions: ['Check door locks', 'Verify CCTV cameras', 'Inspect lighting'],
            estimatedTime: 5,
            isCritical: true
          },
          {
            id: 'CP002',
            name: 'Parking Lot',
            location: 'Ground Floor - Parking Area',
            description: 'Monitor parking area',
            requiredActions: ['Check vehicle security', 'Inspect lighting', 'Look for suspicious activity'],
            estimatedTime: 8,
            isCritical: false
          },
          {
            id: 'CP003',
            name: 'Back Entrance',
            location: 'Ground Floor - Service Entrance',
            description: 'Check service entrance',
            requiredActions: ['Check door locks', 'Verify access control', 'Inspect area'],
            estimatedTime: 5,
            isCritical: true
          }
        ],
        estimatedDuration: 30,
        frequency: '2-hourly',
        isActive: true,
        assignedGuards: ['SEC001', 'SEC002']
      }
    ];

    // Initialize key control
    this.keys = [
      {
        id: 'KEY001',
        keyNumber: 'MASTER-001',
        keyType: 'master',
        description: 'Master key for all rooms',
        location: 'Security Office',
        status: 'available',
        lastAudit: new Date().toISOString(),
        nextAudit: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        duplicateKeys: 1,
        securityLevel: 'critical'
      },
      {
        id: 'KEY002',
        keyNumber: 'FLOOR-1',
        keyType: 'floor',
        description: 'Floor 1 master key',
        location: 'Security Office',
        assignedTo: 'SEC001',
        assignedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        status: 'assigned',
        lastAudit: new Date().toISOString(),
        nextAudit: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        duplicateKeys: 2,
        securityLevel: 'high'
      }
    ];

    // Initialize some incidents
    this.createIncident({
      title: 'Suspicious Person in Parking Lot',
      description: 'Unknown person loitering in parking area',
      location: 'Parking Lot',
      severity: 'medium',
      category: 'suspicious',
      reportedBy: 'Front Desk'
    });

    // Initialize some visitors
    this.createVisitor({
      name: 'John Smith',
      phone: '+233 20 111 2222',
      idType: 'passport',
      idNumber: 'P123456789',
      purpose: 'Meeting with guest',
      hostName: 'Sarah Johnson',
      hostRoom: '201',
      hostPhone: '+233 24 333 4444',
      expectedDuration: 2,
      approvedBy: 'SEC001'
    });

    // Generate some alerts
    this.generateAlerts();
  }

  // Incident Management
  createIncident(data: {
    title: string;
    description: string;
    location: string;
    severity: IncidentSeverity;
    category: SecurityIncident['category'];
    reportedBy: string;
    guestInvolved?: string;
    roomInvolved?: string;
  }): SecurityIncident {
    const incident: SecurityIncident = {
      id: `INC-${Date.now().toString().slice(-6)}`,
      incidentNumber: `INC-${new Date().getFullYear()}-${String(this.incidents.length + 1).padStart(4, '0')}`,
      ...data,
      status: 'reported',
      reportedAt: new Date().toISOString(),
      policeNotified: false,
      followUpRequired: false,
      notes: []
    };

    this.incidents.unshift(incident);
    this.notify();
    trackEvent('Security.IncidentReported', { incidentId: incident.id, severity: incident.severity, category: incident.category });
    return incident;
  }

  updateIncidentStatus(incidentId: string, status: IncidentStatus, assignedTo?: string, resolution?: string) {
    const incident = this.incidents.find(i => i.id === incidentId);
    if (!incident) return;

    incident.status = status;
    
    if (status === 'investigating' && assignedTo) {
      incident.assignedTo = assignedTo;
      incident.assignedAt = new Date().toISOString();
    }
    
    if (status === 'resolved') {
      incident.resolvedAt = new Date().toISOString();
      incident.resolution = resolution;
    }

    this.notify();
    trackEvent('Security.IncidentStatusUpdated', { incidentId, status });
  }

  // Visitor Management
  createVisitor(data: {
    name: string;
    phone: string;
    idType: Visitor['idType'];
    idNumber: string;
    purpose: string;
    hostName: string;
    hostRoom?: string;
    hostPhone: string;
    expectedDuration: number;
    approvedBy: string;
    escortRequired?: boolean;
  }): Visitor {
    const visitor: Visitor = {
      id: `VIS-${Date.now().toString().slice(-6)}`,
      visitorId: `VIS-${new Date().getFullYear()}-${String(this.visitors.length + 1).padStart(4, '0')}`,
      ...data,
      checkInTime: new Date().toISOString(),
      status: 'checked-in',
      escortRequired: data.escortRequired || false
    };

    this.visitors.unshift(visitor);
    this.notify();
    trackEvent('Security.VisitorCheckedIn', { visitorId: visitor.id, hostRoom: visitor.hostRoom });
    return visitor;
  }

  checkOutVisitor(visitorId: string) {
    const visitor = this.visitors.find(v => v.id === visitorId);
    if (!visitor) return;

    visitor.checkOutTime = new Date().toISOString();
    visitor.status = 'checked-out';
    this.notify();
    trackEvent('Security.VisitorCheckedOut', { visitorId });
  }

  // Patrol Management
  createPatrolLog(data: {
    routeId: string;
    routeName: string;
    guardId: string;
    guardName: string;
    scheduledStart: string;
  }): PatrolLog {
    const route = this.patrolRoutes.find(r => r.id === data.routeId);
    if (!route) throw new Error('Patrol route not found');

    const log: PatrolLog = {
      id: `PAT-${Date.now().toString().slice(-6)}`,
      ...data,
      status: 'scheduled',
      checkpoints: route.checkpoints.map(cp => ({
        checkpointId: cp.id,
        checkpointName: cp.name,
        scheduledTime: new Date().toISOString(),
        status: 'missed',
        actions: []
      }))
    };

    this.patrolLogs.unshift(log);
    this.notify();
    trackEvent('Security.PatrolScheduled', { patrolId: log.id, routeId: data.routeId });
    return log;
  }

  startPatrol(patrolId: string) {
    const patrol = this.patrolLogs.find(p => p.id === patrolId);
    if (!patrol) return;

    patrol.status = 'in-progress';
    patrol.actualStart = new Date().toISOString();
    this.notify();
    trackEvent('Security.PatrolStarted', { patrolId });
  }

  completePatrol(patrolId: string, issues?: string[], notes?: string) {
    const patrol = this.patrolLogs.find(p => p.id === patrolId);
    if (!patrol) return;

    patrol.status = 'completed';
    patrol.actualEnd = new Date().toISOString();
    patrol.issues = issues;
    patrol.notes = notes;
    this.notify();
    trackEvent('Security.PatrolCompleted', { patrolId });
  }

  // Key Control Management
  assignKey(keyId: string, assignedTo: string) {
    const key = this.keys.find(k => k.id === keyId);
    if (!key) return;

    key.assignedTo = assignedTo;
    key.assignedAt = new Date().toISOString();
    key.status = 'assigned';
    this.notify();
    trackEvent('Security.KeyAssigned', { keyId, assignedTo });
  }

  returnKey(keyId: string) {
    const key = this.keys.find(k => k.id === keyId);
    if (!key) return;

    key.assignedTo = undefined;
    key.assignedAt = undefined;
    key.returnedAt = new Date().toISOString();
    key.status = 'available';
    this.notify();
    trackEvent('Security.KeyReturned', { keyId });
  }

  // Alert Management
  private generateAlerts() {
    // Check for overdue patrols
    const now = new Date();
    this.patrolLogs.forEach(patrol => {
      if (patrol.status === 'scheduled' && new Date(patrol.scheduledStart) < now) {
        this.createAlert({
          title: 'Overdue Patrol',
          message: `Patrol ${patrol.routeName} is overdue`,
          severity: 'medium',
          category: 'patrol',
          location: patrol.routeName
        });
      }
    });

    // Check for expired visitors
    this.visitors.forEach(visitor => {
      if (visitor.status === 'checked-in') {
        const checkInTime = new Date(visitor.checkInTime);
        const expectedEnd = new Date(checkInTime.getTime() + visitor.expectedDuration * 60 * 60 * 1000);
        
        if (now > expectedEnd) {
          this.createAlert({
            title: 'Visitor Overstay',
            message: `Visitor ${visitor.name} has exceeded expected duration`,
            severity: 'low',
            category: 'visitor',
            location: visitor.hostRoom || 'Unknown'
          });
        }
      }
    });
  }

  createAlert(data: {
    title: string;
    message: string;
    severity: IncidentSeverity;
    category: SecurityAlert['category'];
    location?: string;
  }): SecurityAlert {
    const alert: SecurityAlert = {
      id: `ALERT-${Date.now().toString().slice(-6)}`,
      ...data,
      isActive: true,
      createdAt: new Date().toISOString(),
      actionRequired: data.severity === 'high' || data.severity === 'critical'
    };

    this.alerts.unshift(alert);
    this.notify();
    return alert;
  }

  acknowledgeAlert(alertId: string, acknowledgedBy: string) {
    const alert = this.alerts.find(a => a.id === alertId);
    if (!alert) return;

    alert.acknowledgedBy = acknowledgedBy;
    alert.acknowledgedAt = new Date().toISOString();
    this.notify();
  }

  // Analytics and Reporting
  getIncidentsByStatus(status: IncidentStatus): SecurityIncident[] {
    return this.incidents.filter(incident => incident.status === status);
  }

  getIncidentsBySeverity(severity: IncidentSeverity): SecurityIncident[] {
    return this.incidents.filter(incident => incident.severity === severity);
  }

  getActiveVisitors(): Visitor[] {
    return this.visitors.filter(visitor => visitor.status === 'checked-in');
  }

  getPatrolsByStatus(status: PatrolStatus): PatrolLog[] {
    return this.patrolLogs.filter(patrol => patrol.status === status);
  }

  getAssignedKeys(): KeyControl[] {
    return this.keys.filter(key => key.status === 'assigned');
  }

  getDailyStats() {
    const today = new Date().toISOString().split('T')[0];
    const todayIncidents = this.incidents.filter(i => i.reportedAt.startsWith(today));
    const todayVisitors = this.visitors.filter(v => v.checkInTime.startsWith(today));
    const todayPatrols = this.patrolLogs.filter(p => p.scheduledStart.startsWith(today));

    return {
      incidentsReported: todayIncidents.length,
      visitorsCheckedIn: todayVisitors.length,
      patrolsCompleted: todayPatrols.filter(p => p.status === 'completed').length,
      activeAlerts: this.alerts.filter(a => a.isActive).length
    };
  }

  // Store interface
  subscribe(listener: () => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  // Getters
  getAllIncidents(): SecurityIncident[] {
    return [...this.incidents];
  }

  getAllVisitors(): Visitor[] {
    return [...this.visitors];
  }

  getAllPatrolRoutes(): PatrolRoute[] {
    return [...this.patrolRoutes];
  }

  getAllPatrolLogs(): PatrolLog[] {
    return [...this.patrolLogs];
  }

  getAllKeys(): KeyControl[] {
    return [...this.keys];
  }

  getAllStaff(): SecurityStaff[] {
    return [...this.staff];
  }

  getAllEmergencyContacts(): EmergencyContact[] {
    return [...this.emergencyContacts];
  }

  getAllAlerts(): SecurityAlert[] {
    return [...this.alerts];
  }

  private notify() {
    this.listeners.forEach(listener => listener());
  }
}

export const securityStore = new SecurityStore();
