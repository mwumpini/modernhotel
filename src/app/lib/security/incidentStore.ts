import { create } from 'zustand';
import { SecurityIncident } from './models';

interface IncidentStore {
  incidents: SecurityIncident[];
  selectedIncident: SecurityIncident | null;
  
  // Incident Management
  addIncident: (incident: Omit<SecurityIncident, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateIncident: (id: string, updates: Partial<SecurityIncident>) => void;
  deleteIncident: (id: string) => void;
  getIncident: (id: string) => SecurityIncident | undefined;
  getIncidentByNumber: (incidentNumber: string) => SecurityIncident | undefined;
  
  // Status Management
  updateIncidentStatus: (id: string, status: SecurityIncident['status']) => void;
  assignIncident: (id: string, assignedTo: string) => void;
  resolveIncident: (id: string, resolution: string) => void;
  escalateIncident: (id: string, reason: string) => void;
  
  // Filtering and Search
  getIncidentsByType: (type: SecurityIncident['type']) => SecurityIncident[];
  getIncidentsBySeverity: (severity: SecurityIncident['severity']) => SecurityIncident[];
  getIncidentsByStatus: (status: SecurityIncident['status']) => SecurityIncident[];
  getIncidentsByLocation: (location: string) => SecurityIncident[];
  getIncidentsByDateRange: (startDate: Date, endDate: Date) => SecurityIncident[];
  getActiveIncidents: () => SecurityIncident[];
  getOverdueIncidents: () => SecurityIncident[];
  
  // Analytics
  getIncidentAnalytics: (period: 'daily' | 'weekly' | 'monthly') => {
    totalIncidents: number;
    incidentsByType: Record<string, number>;
    incidentsBySeverity: Record<string, number>;
    incidentsByLocation: Record<string, number>;
    averageResponseTime: number;
    resolutionRate: number;
    costAnalysis: {
      totalCost: number;
      averageCost: number;
      costByType: Record<string, number>;
    };
  };
  
  // Selection
  selectIncident: (incident: SecurityIncident | null) => void;
}

// Sample data
const sampleIncidents: SecurityIncident[] = [
  {
    id: '1',
    incidentNumber: 'SEC-2024-001',
    type: 'suspicious_activity',
    severity: 'medium',
    priority: 'high',
    status: 'investigating',
    location: 'Main Lobby',
    floor: 'Ground Floor',
    description: 'Suspicious person loitering in the lobby area',
    reportedBy: 'Front Desk Staff',
    reportedAt: new Date('2024-01-15T10:30:00'),
    assignedTo: 'Security Officer John',
    assignedAt: new Date('2024-01-15T10:35:00'),
    witnesses: ['Receptionist Sarah', 'Bell Boy Mike'],
    notes: 'Person was escorted out after questioning',
    createdAt: new Date('2024-01-15T10:30:00'),
    updatedAt: new Date('2024-01-15T10:35:00')
  },
  {
    id: '2',
    incidentNumber: 'SEC-2024-002',
    type: 'theft',
    severity: 'high',
    priority: 'urgent',
    status: 'resolved',
    location: 'Room 205',
    floor: '2nd Floor',
    description: 'Guest reported missing laptop from room',
    reportedBy: 'Guest Services',
    reportedAt: new Date('2024-01-14T15:20:00'),
    assignedTo: 'Security Supervisor',
    assignedAt: new Date('2024-01-14T15:25:00'),
    resolvedAt: new Date('2024-01-14T18:00:00'),
    resolution: 'Laptop found in housekeeping cart, returned to guest',
    cost: 0,
    policeReport: false,
    notes: 'False alarm - item was misplaced',
    createdAt: new Date('2024-01-14T15:20:00'),
    updatedAt: new Date('2024-01-14T18:00:00')
  },
  {
    id: '3',
    incidentNumber: 'SEC-2024-003',
    type: 'fire_alarm',
    severity: 'critical',
    priority: 'urgent',
    status: 'resolved',
    location: 'Kitchen Area',
    floor: 'Ground Floor',
    description: 'Fire alarm triggered in kitchen area',
    reportedBy: 'Kitchen Staff',
    reportedAt: new Date('2024-01-13T12:15:00'),
    assignedTo: 'Fire Safety Officer',
    assignedAt: new Date('2024-01-13T12:15:00'),
    resolvedAt: new Date('2024-01-13T12:45:00'),
    resolution: 'False alarm due to cooking smoke, system reset',
    cost: 0,
    notes: 'Regular occurrence during peak cooking hours',
    createdAt: new Date('2024-01-13T12:15:00'),
    updatedAt: new Date('2024-01-13T12:45:00')
  }
];

export const useIncidentStore = create<IncidentStore>((set, get) => ({
  incidents: sampleIncidents,
  selectedIncident: null,
  
  // Incident Management
  addIncident: (incident) => {
    const newIncident: SecurityIncident = {
      ...incident,
      id: Date.now().toString(),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    set((state) => ({
      incidents: [...state.incidents, newIncident]
    }));
  },
  
  updateIncident: (id, updates) => {
    set((state) => ({
      incidents: state.incidents.map(incident =>
        incident.id === id
          ? { ...incident, ...updates, updatedAt: new Date() }
          : incident
      )
    }));
  },
  
  deleteIncident: (id) => {
    set((state) => ({
      incidents: state.incidents.filter(incident => incident.id !== id)
    }));
  },
  
  getIncident: (id) => {
    return get().incidents.find(incident => incident.id === id);
  },
  
  getIncidentByNumber: (incidentNumber) => {
    return get().incidents.find(incident => incident.incidentNumber === incidentNumber);
  },
  
  // Status Management
  updateIncidentStatus: (id, status) => {
    get().updateIncident(id, { status });
  },
  
  assignIncident: (id, assignedTo) => {
    get().updateIncident(id, { 
      assignedTo, 
      assignedAt: new Date(),
      status: 'investigating'
    });
  },
  
  resolveIncident: (id, resolution) => {
    get().updateIncident(id, { 
      resolution, 
      resolvedAt: new Date(),
      status: 'resolved'
    });
  },
  
  escalateIncident: (id, reason) => {
    get().updateIncident(id, { 
      status: 'escalated',
      notes: `${get().getIncident(id)?.notes || ''}\n\nEscalated: ${reason}`
    });
  },
  
  // Filtering and Search
  getIncidentsByType: (type) => {
    return get().incidents.filter(incident => incident.type === type);
  },
  
  getIncidentsBySeverity: (severity) => {
    return get().incidents.filter(incident => incident.severity === severity);
  },
  
  getIncidentsByStatus: (status) => {
    return get().incidents.filter(incident => incident.status === status);
  },
  
  getIncidentsByLocation: (location) => {
    return get().incidents.filter(incident => 
      incident.location.toLowerCase().includes(location.toLowerCase()) ||
      incident.floor?.toLowerCase().includes(location.toLowerCase())
    );
  },
  
  getIncidentsByDateRange: (startDate, endDate) => {
    return get().incidents.filter(incident => 
      incident.reportedAt >= startDate && incident.reportedAt <= endDate
    );
  },
  
  getActiveIncidents: () => {
    return get().incidents.filter(incident => 
      ['reported', 'investigating', 'escalated'].includes(incident.status)
    );
  },
  
  getOverdueIncidents: () => {
    const now = new Date();
    const overdueThreshold = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
    
    return get().incidents.filter(incident => {
      if (incident.status === 'resolved' || incident.status === 'closed') return false;
      
      const timeSinceReport = now.getTime() - incident.reportedAt.getTime();
      return timeSinceReport > overdueThreshold;
    });
  },
  
  // Analytics
  getIncidentAnalytics: (period) => {
    const incidents = get().incidents;
    const now = new Date();
    let filteredIncidents = incidents;
    
    // Filter by period
    if (period === 'daily') {
      const startOfDay = new Date(now);
      startOfDay.setHours(0, 0, 0, 0);
      filteredIncidents = incidents.filter(incident => incident.reportedAt >= startOfDay);
    } else if (period === 'weekly') {
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - 7);
      filteredIncidents = incidents.filter(incident => incident.reportedAt >= startOfWeek);
    } else if (period === 'monthly') {
      const startOfMonth = new Date(now);
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      filteredIncidents = incidents.filter(incident => incident.reportedAt >= startOfMonth);
    }
    
    // Calculate analytics
    const incidentsByType: Record<string, number> = {};
    const incidentsBySeverity: Record<string, number> = {};
    const incidentsByLocation: Record<string, number> = {};
    let totalCost = 0;
    let resolvedCount = 0;
    
    filteredIncidents.forEach(incident => {
      // Type breakdown
      incidentsByType[incident.type] = (incidentsByType[incident.type] || 0) + 1;
      
      // Severity breakdown
      incidentsBySeverity[incident.severity] = (incidentsBySeverity[incident.severity] || 0) + 1;
      
      // Location breakdown
      incidentsByLocation[incident.location] = (incidentsByLocation[incident.location] || 0) + 1;
      
      // Cost analysis
      if (incident.cost) totalCost += incident.cost;
      
      // Resolution rate
      if (incident.status === 'resolved' || incident.status === 'closed') resolvedCount++;
    });
    
    const costByType: Record<string, number> = {};
    filteredIncidents.forEach(incident => {
      if (incident.cost) {
        costByType[incident.type] = (costByType[incident.type] || 0) + incident.cost;
      }
    });
    
    return {
      totalIncidents: filteredIncidents.length,
      incidentsByType,
      incidentsBySeverity,
      incidentsByLocation,
      averageResponseTime: 45, // Placeholder - would need actual response time data
      resolutionRate: filteredIncidents.length > 0 ? (resolvedCount / filteredIncidents.length) * 100 : 0,
      costAnalysis: {
        totalCost,
        averageCost: filteredIncidents.length > 0 ? totalCost / filteredIncidents.length : 0,
        costByType
      }
    };
  },
  
  // Selection
  selectIncident: (incident) => {
    set({ selectedIncident: incident });
  }
}));
