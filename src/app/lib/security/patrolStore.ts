import { create } from 'zustand';
import { PatrolLog, PatrolCheckpoint } from './models';

interface PatrolStore {
  patrols: PatrolLog[];
  selectedPatrol: PatrolLog | null;
  
  // Patrol Management
  startPatrol: (patrol: Omit<PatrolLog, 'id' | 'createdAt' | 'updatedAt' | 'status'>) => void;
  endPatrol: (id: string) => void;
  updatePatrol: (id: string, updates: Partial<PatrolLog>) => void;
  deletePatrol: (id: string) => void;
  getPatrol: (id: string) => PatrolLog | undefined;
  
  // Checkpoint Management
  addCheckpoint: (patrolId: string, checkpoint: Omit<PatrolCheckpoint, 'id'>) => void;
  updateCheckpoint: (patrolId: string, checkpointId: string, updates: Partial<PatrolCheckpoint>) => void;
  completeCheckpoint: (patrolId: string, checkpointId: string, notes?: string) => void;
  missCheckpoint: (patrolId: string, checkpointId: string, reason: string) => void;
  
  // Route Management
  getPatrolRoutes: () => string[];
  getPatrolsByRoute: (route: string) => PatrolLog[];
  getPatrolsByOfficer: (officerId: string) => PatrolLog[];
  getPatrolsByDateRange: (startDate: Date, endDate: Date) => PatrolLog[];
  
  // Status Management
  getActivePatrols: () => PatrolLog[];
  getCompletedPatrols: () => PatrolLog[];
  getInterruptedPatrols: () => PatrolLog[];
  getOverduePatrols: () => PatrolLog[];
  
  // Analytics
  getPatrolAnalytics: (period: 'daily' | 'weekly' | 'monthly') => {
    totalPatrols: number;
    completedPatrols: number;
    missedPatrols: number;
    averageDuration: number; // in minutes
    checkpointsCompleted: number;
    checkpointsMissed: number;
    complianceRate: number;
    routesCovered: string[];
    officerPerformance: Record<string, {
      patrolsCompleted: number;
      checkpointsCompleted: number;
      averageDuration: number;
      complianceRate: number;
    }>;
  };
  
  // Selection
  selectPatrol: (patrol: PatrolLog | null) => void;
}

// Sample data
const samplePatrols: PatrolLog[] = [
  {
    id: '1',
    patrolNumber: 'PAT-2024-001',
    officerId: 'officer1',
    officerName: 'Security Officer John',
    startTime: new Date('2024-01-15T08:00:00'),
    endTime: new Date('2024-01-15T10:00:00'),
    route: 'Main Building Perimeter',
    checkpoints: [
      {
        id: 'cp1',
        location: 'Main Entrance',
        scheduledTime: new Date('2024-01-15T08:15:00'),
        actualTime: new Date('2024-01-15T08:16:00'),
        status: 'completed',
        notes: 'All clear, entrance secure'
      },
      {
        id: 'cp2',
        location: 'Loading Dock',
        scheduledTime: new Date('2024-01-15T08:45:00'),
        actualTime: new Date('2024-01-15T08:47:00'),
        status: 'completed',
        notes: 'Dock area secure, no unauthorized access'
      },
      {
        id: 'cp3',
        location: 'Parking Lot A',
        scheduledTime: new Date('2024-01-15T09:15:00'),
        actualTime: new Date('2024-01-15T09:18:00'),
        status: 'completed',
        notes: 'Vehicle check completed, all vehicles accounted for'
      }
    ],
    incidents: [],
    notes: 'Routine perimeter patrol completed without issues',
    status: 'completed',
    createdAt: new Date('2024-01-15T08:00:00'),
    updatedAt: new Date('2024-01-15T10:00:00')
  },
  {
    id: '2',
    patrolNumber: 'PAT-2024-002',
    officerId: 'officer2',
    officerName: 'Security Officer Sarah',
    startTime: new Date('2024-01-15T10:00:00'),
    route: 'Internal Building Check',
    checkpoints: [
      {
        id: 'cp4',
        location: 'Lobby Area',
        scheduledTime: new Date('2024-01-15T10:15:00'),
        status: 'pending'
      },
      {
        id: 'cp5',
        location: 'Conference Rooms',
        scheduledTime: new Date('2024-01-15T10:45:00'),
        status: 'pending'
      },
      {
        id: 'cp6',
        location: 'Staff Break Room',
        scheduledTime: new Date('2024-01-15T11:15:00'),
        status: 'pending'
      }
    ],
    incidents: [],
    notes: 'Internal building security check in progress',
    status: 'active',
    createdAt: new Date('2024-01-15T10:00:00'),
    updatedAt: new Date('2024-01-15T10:00:00')
  }
];

export const usePatrolStore = create<PatrolStore>((set, get) => ({
  patrols: samplePatrols,
  selectedPatrol: null,
  
  // Patrol Management
  startPatrol: (patrol) => {
    const newPatrol: PatrolLog = {
      ...patrol,
      id: Date.now().toString(),
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    set((state) => ({
      patrols: [...state.patrols, newPatrol]
    }));
  },
  
  endPatrol: (id) => {
    set((state) => ({
      patrols: state.patrols.map(patrol =>
        patrol.id === id
          ? { ...patrol, endTime: new Date(), status: 'completed', updatedAt: new Date() }
          : patrol
      )
    }));
  },
  
  updatePatrol: (id, updates) => {
    set((state) => ({
      patrols: state.patrols.map(patrol =>
        patrol.id === id
          ? { ...patrol, ...updates, updatedAt: new Date() }
          : patrol
      )
    }));
  },
  
  deletePatrol: (id) => {
    set((state) => ({
      patrols: state.patrols.filter(patrol => patrol.id !== id)
    }));
  },
  
  getPatrol: (id) => {
    return get().patrols.find(patrol => patrol.id === id);
  },
  
  // Checkpoint Management
  addCheckpoint: (patrolId, checkpoint) => {
    const newCheckpoint: PatrolCheckpoint = {
      ...checkpoint,
      id: Date.now().toString()
    };
    
    set((state) => ({
      patrols: state.patrols.map(patrol =>
        patrol.id === patrolId
          ? { ...patrol, checkpoints: [...patrol.checkpoints, newCheckpoint] }
          : patrol
      )
    }));
  },
  
  updateCheckpoint: (patrolId, checkpointId, updates) => {
    set((state) => ({
      patrols: state.patrols.map(patrol =>
        patrol.id === patrolId
          ? {
              ...patrol,
              checkpoints: patrol.checkpoints.map(checkpoint =>
                checkpoint.id === checkpointId
                  ? { ...checkpoint, ...updates }
                  : checkpoint
              )
            }
          : patrol
      )
    }));
  },
  
  completeCheckpoint: (patrolId, checkpointId, notes) => {
    get().updateCheckpoint(patrolId, checkpointId, {
      status: 'completed',
      actualTime: new Date(),
      notes: notes || 'Checkpoint completed successfully'
    });
  },
  
  missCheckpoint: (patrolId, checkpointId, reason) => {
    get().updateCheckpoint(patrolId, checkpointId, {
      status: 'missed',
      notes: `Missed: ${reason}`
    });
  },
  
  // Route Management
  getPatrolRoutes: () => {
    const routes = new Set(get().patrols.map(patrol => patrol.route));
    return Array.from(routes);
  },
  
  getPatrolsByRoute: (route) => {
    return get().patrols.filter(patrol => patrol.route === route);
  },
  
  getPatrolsByOfficer: (officerId) => {
    return get().patrols.filter(patrol => patrol.officerId === officerId);
  },
  
  getPatrolsByDateRange: (startDate, endDate) => {
    return get().patrols.filter(patrol => 
      patrol.startTime >= startDate && patrol.startTime <= endDate
    );
  },
  
  // Status Management
  getActivePatrols: () => {
    return get().patrols.filter(patrol => patrol.status === 'active');
  },
  
  getCompletedPatrols: () => {
    return get().patrols.filter(patrol => patrol.status === 'completed');
  },
  
  getInterruptedPatrols: () => {
    return get().patrols.filter(patrol => patrol.status === 'interrupted');
  },
  
  getOverduePatrols: () => {
    const now = new Date();
    const overdueThreshold = 30 * 60 * 1000; // 30 minutes in milliseconds
    
    return get().patrols.filter(patrol => {
      if (patrol.status !== 'active') return false;
      
      const lastCheckpoint = patrol.checkpoints
        .filter(cp => cp.status === 'completed')
        .sort((a, b) => b.actualTime!.getTime() - a.actualTime!.getTime())[0];
      
      if (!lastCheckpoint) return false;
      
      const timeSinceLastCheckpoint = now.getTime() - lastCheckpoint.actualTime!.getTime();
      return timeSinceLastCheckpoint > overdueThreshold;
    });
  },
  
  // Analytics
  getPatrolAnalytics: (period) => {
    const patrols = get().patrols;
    const now = new Date();
    let filteredPatrols = patrols;
    
    // Filter by period
    if (period === 'daily') {
      const startOfDay = new Date(now);
      startOfDay.setHours(0, 0, 0, 0);
      filteredPatrols = patrols.filter(patrol => patrol.startTime >= startOfDay);
    } else if (period === 'weekly') {
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - 7);
      filteredPatrols = patrols.filter(patrol => patrol.startTime >= startOfWeek);
    } else if (period === 'monthly') {
      const startOfMonth = new Date(now);
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      filteredPatrols = patrols.filter(patrol => patrol.startTime >= startOfMonth);
    }
    
    // Calculate analytics
    const totalPatrols = filteredPatrols.length;
    const completedPatrols = filteredPatrols.filter(patrol => patrol.status === 'completed').length;
    const missedPatrols = filteredPatrols.filter(patrol => patrol.status === 'interrupted').length;
    
    let totalDuration = 0;
    let checkpointsCompleted = 0;
    let checkpointsMissed = 0;
    const routesCovered = new Set<string>();
    const officerPerformance: Record<string, any> = {};
    
    filteredPatrols.forEach(patrol => {
      routesCovered.add(patrol.route);
      
      // Duration calculation
      if (patrol.endTime && patrol.startTime) {
        const duration = patrol.endTime.getTime() - patrol.startTime.getTime();
        totalDuration += duration;
      }
      
      // Checkpoint analysis
      patrol.checkpoints.forEach(checkpoint => {
        if (checkpoint.status === 'completed') {
          checkpointsCompleted++;
        } else if (checkpoint.status === 'missed') {
          checkpointsMissed++;
        }
      });
      
      // Officer performance
      if (!officerPerformance[patrol.officerId]) {
        officerPerformance[patrol.officerId] = {
          patrolsCompleted: 0,
          checkpointsCompleted: 0,
          totalDuration: 0,
          complianceRate: 0
        };
      }
      
      if (patrol.status === 'completed') {
        officerPerformance[patrol.officerId].patrolsCompleted++;
      }
      
      const officerCheckpoints = patrol.checkpoints.filter(cp => cp.status === 'completed').length;
      officerPerformance[patrol.officerId].checkpointsCompleted += officerCheckpoints;
      
      if (patrol.endTime && patrol.startTime) {
        const duration = patrol.endTime.getTime() - patrol.startTime.getTime();
        officerPerformance[patrol.officerId].totalDuration += duration;
      }
    });
    
    // Calculate officer compliance rates
    Object.keys(officerPerformance).forEach(officerId => {
      const officer = officerPerformance[officerId];
      const officerPatrols = filteredPatrols.filter(patrol => patrol.officerId === officerId);
      const totalCheckpoints = officerPatrols.reduce((sum, patrol) => sum + patrol.checkpoints.length, 0);
      
      officer.complianceRate = totalCheckpoints > 0 ? (officer.checkpointsCompleted / totalCheckpoints) * 100 : 0;
      officer.averageDuration = officer.patrolsCompleted > 0 ? officer.totalDuration / officer.patrolsCompleted / (1000 * 60) : 0; // Convert to minutes
    });
    
    return {
      totalPatrols,
      completedPatrols,
      missedPatrols,
      averageDuration: totalPatrols > 0 ? totalDuration / totalPatrols / (1000 * 60) : 0, // Convert to minutes
      checkpointsCompleted,
      checkpointsMissed,
      complianceRate: (checkpointsCompleted + checkpointsMissed) > 0 ? (checkpointsCompleted / (checkpointsCompleted + checkpointsMissed)) * 100 : 0,
      routesCovered: Array.from(routesCovered),
      officerPerformance
    };
  },
  
  // Selection
  selectPatrol: (patrol) => {
    set({ selectedPatrol: patrol });
  }
}));
