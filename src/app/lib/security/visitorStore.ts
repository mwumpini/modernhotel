import { create } from 'zustand';
import { Visitor } from './models';

interface VisitorStore {
  visitors: Visitor[];
  selectedVisitor: Visitor | null;
  
  // Visitor Management
  addVisitor: (visitor: Omit<Visitor, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateVisitor: (id: string, updates: Partial<Visitor>) => void;
  deleteVisitor: (id: string) => void;
  getVisitor: (id: string) => Visitor | undefined;
  getVisitorByNumber: (visitorNumber: string) => Visitor | undefined;
  
  // Check-in/Check-out Management
  checkInVisitor: (id: string, badgeNumber?: string) => void;
  checkOutVisitor: (id: string) => void;
  extendVisit: (id: string, additionalHours: number) => void;
  markOverdue: (id: string) => void;
  
  // Search and Filtering
  getVisitorsByStatus: (status: Visitor['status']) => Visitor[];
  getVisitorsByHost: (hostEmployee: string) => Visitor[];
  getVisitorsByDepartment: (department: string) => Visitor[];
  getVisitorsByDateRange: (startDate: Date, endDate: Date) => Visitor[];
  getActiveVisitors: () => Visitor[];
  getOverdueVisitors: () => Visitor[];
  getVIPVisitors: () => Visitor[];
  
  // Analytics
  getVisitorAnalytics: (period: 'daily' | 'weekly' | 'monthly') => {
    totalVisitors: number;
    checkedIn: number;
    checkedOut: number;
    overdue: number;
    vipVisitors: number;
    averageVisitDuration: number; // in hours
    visitorsByDepartment: Record<string, number>;
    visitorsByPurpose: Record<string, number>;
    peakHours: Record<string, number>;
    trends: Array<{
      date: Date;
      checkIns: number;
      checkOuts: number;
      activeVisitors: number;
    }>;
  };
  
  // Selection
  selectVisitor: (visitor: Visitor | null) => void;
}

// Sample data
const sampleVisitors: Visitor[] = [
  {
    id: '1',
    visitorNumber: 'VIS-2024-001',
    firstName: 'John',
    lastName: 'Smith',
    company: 'Tech Solutions Ltd',
    purpose: 'Business Meeting',
    hostEmployee: 'Sarah Johnson',
    hostDepartment: 'Sales',
    checkInTime: new Date('2024-01-15T09:00:00'),
    checkOutTime: new Date('2024-01-15T17:00:00'),
    badgeNumber: 'VB001',
    areas: ['Conference Room A', 'Lobby', 'Cafeteria'],
    isVIP: false,
    status: 'checked_out',
    notes: 'Regular business visitor',
    createdAt: new Date('2024-01-15T09:00:00'),
    updatedAt: new Date('2024-01-15T17:00:00')
  },
  {
    id: '2',
    visitorNumber: 'VIS-2024-002',
    firstName: 'Maria',
    lastName: 'Garcia',
    company: 'Global Consulting',
    purpose: 'Contract Negotiation',
    hostEmployee: 'Michael Chen',
    hostDepartment: 'Legal',
    checkInTime: new Date('2024-01-15T10:30:00'),
    badgeNumber: 'VB002',
    areas: ['Legal Department', 'Conference Room B', 'Executive Lounge'],
    isVIP: true,
    status: 'checked_in',
    vehicleInfo: {
      make: 'BMW',
      model: 'X5',
      color: 'Black',
      plateNumber: 'GH-1234-AB'
    },
    notes: 'VIP client, provide premium service',
    createdAt: new Date('2024-01-15T10:30:00'),
    updatedAt: new Date('2024-01-15T10:30:00')
  },
  {
    id: '3',
    visitorNumber: 'VIS-2024-003',
    firstName: 'David',
    lastName: 'Wilson',
    company: 'Maintenance Co',
    purpose: 'Equipment Repair',
    hostEmployee: 'Engineering Team',
    hostDepartment: 'Facilities',
    checkInTime: new Date('2024-01-15T08:00:00'),
    badgeNumber: 'VB003',
    areas: ['Equipment Room', 'Basement', 'Service Areas'],
    isVIP: false,
    status: 'checked_in',
    notes: 'Contractor for HVAC maintenance',
    createdAt: new Date('2024-01-15T08:00:00'),
    updatedAt: new Date('2024-01-15T08:00:00')
  }
];

export const useVisitorStore = create<VisitorStore>((set, get) => ({
  visitors: sampleVisitors,
  selectedVisitor: null,
  
  // Visitor Management
  addVisitor: (visitor) => {
    const newVisitor: Visitor = {
      ...visitor,
      id: Date.now().toString(),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    set((state) => ({
      visitors: [...state.visitors, newVisitor]
    }));
  },
  
  updateVisitor: (id, updates) => {
    set((state) => ({
      visitors: state.visitors.map(visitor =>
        visitor.id === id
          ? { ...visitor, ...updates, updatedAt: new Date() }
          : visitor
      )
    }));
  },
  
  deleteVisitor: (id) => {
    set((state) => ({
      visitors: state.visitors.filter(visitor => visitor.id !== id)
    }));
  },
  
  getVisitor: (id) => {
    return get().visitors.find(visitor => visitor.id === id);
  },
  
  getVisitorByNumber: (visitorNumber) => {
    return get().visitors.find(visitor => visitor.visitorNumber === visitorNumber);
  },
  
  // Check-in/Check-out Management
  checkInVisitor: (id, badgeNumber) => {
    get().updateVisitor(id, {
      status: 'checked_in',
      badgeNumber: badgeNumber || `VB${Date.now().toString().slice(-3)}`
    });
  },
  
  checkOutVisitor: (id) => {
    get().updateVisitor(id, {
      status: 'checked_out',
      checkOutTime: new Date()
    });
  },
  
  extendVisit: (id, additionalHours) => {
    const visitor = get().getVisitor(id);
    if (visitor && visitor.checkOutTime) {
      const newCheckOutTime = new Date(visitor.checkOutTime.getTime() + (additionalHours * 60 * 60 * 1000));
      get().updateVisitor(id, {
        checkOutTime: newCheckOutTime,
        notes: `${visitor.notes || ''}\n\nVisit extended by ${additionalHours} hours`
      });
    }
  },
  
  markOverdue: (id) => {
    get().updateVisitor(id, { status: 'overdue' });
  },
  
  // Search and Filtering
  getVisitorsByStatus: (status) => {
    return get().visitors.filter(visitor => visitor.status === status);
  },
  
  getVisitorsByHost: (hostEmployee) => {
    return get().visitors.filter(visitor => visitor.hostEmployee === hostEmployee);
  },
  
  getVisitorsByDepartment: (department) => {
    return get().visitors.filter(visitor => visitor.hostDepartment === department);
  },
  
  getVisitorsByDateRange: (startDate, endDate) => {
    return get().visitors.filter(visitor => 
      visitor.checkInTime >= startDate && visitor.checkInTime <= endDate
    );
  },
  
  getActiveVisitors: () => {
    return get().visitors.filter(visitor => visitor.status === 'checked_in');
  },
  
  getOverdueVisitors: () => {
    const now = new Date();
    const overdueThreshold = 8 * 60 * 60 * 1000; // 8 hours in milliseconds
    
    return get().visitors.filter(visitor => {
      if (visitor.status !== 'checked_in') return false;
      
      const visitDuration = now.getTime() - visitor.checkInTime.getTime();
      return visitDuration > overdueThreshold;
    });
  },
  
  getVIPVisitors: () => {
    return get().visitors.filter(visitor => visitor.isVIP);
  },
  
  // Analytics
  getVisitorAnalytics: (period) => {
    const visitors = get().visitors;
    const now = new Date();
    let filteredVisitors = visitors;
    
    // Filter by period
    if (period === 'daily') {
      const startOfDay = new Date(now);
      startOfDay.setHours(0, 0, 0, 0);
      filteredVisitors = visitors.filter(visitor => visitor.checkInTime >= startOfDay);
    } else if (period === 'weekly') {
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - 7);
      filteredVisitors = visitors.filter(visitor => visitor.checkInTime >= startOfWeek);
    } else if (period === 'monthly') {
      const startOfMonth = new Date(now);
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      filteredVisitors = visitors.filter(visitor => visitor.checkInTime >= startOfMonth);
    }
    
    // Calculate analytics
    const totalVisitors = filteredVisitors.length;
    const checkedIn = filteredVisitors.filter(visitor => visitor.status === 'checked_in').length;
    const checkedOut = filteredVisitors.filter(visitor => visitor.status === 'checked_out').length;
    const overdue = filteredVisitors.filter(visitor => visitor.status === 'overdue').length;
    const vipVisitors = filteredVisitors.filter(visitor => visitor.isVIP).length;
    
    const visitorsByDepartment: Record<string, number> = {};
    const visitorsByPurpose: Record<string, number> = {};
    const peakHours: Record<string, number> = {};
    let totalVisitDuration = 0;
    let completedVisits = 0;
    
    filteredVisitors.forEach(visitor => {
      // Department breakdown
      visitorsByDepartment[visitor.hostDepartment] = (visitorsByDepartment[visitor.hostDepartment] || 0) + 1;
      
      // Purpose breakdown
      visitorsByPurpose[visitor.purpose] = (visitorsByPurpose[visitor.purpose] || 0) + 1;
      
      // Peak hours analysis
      const hour = visitor.checkInTime.getHours();
      const hourKey = `${hour}:00`;
      peakHours[hourKey] = (peakHours[hourKey] || 0) + 1;
      
      // Visit duration calculation
      if (visitor.checkOutTime) {
        const duration = visitor.checkOutTime.getTime() - visitor.checkInTime.getTime();
        totalVisitDuration += duration;
        completedVisits++;
      }
    });
    
    // Calculate trends (simplified - would need more sophisticated date handling)
    const trends = Array.from({ length: 7 }, (_, i) => {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dayVisitors = visitors.filter(visitor => 
        visitor.checkInTime.toDateString() === date.toDateString()
      );
      
      return {
        date,
        checkIns: dayVisitors.length,
        checkOuts: dayVisitors.filter(v => v.status === 'checked_out').length,
        activeVisitors: dayVisitors.filter(v => v.status === 'checked_in').length
      };
    }).reverse();
    
    return {
      totalVisitors,
      checkedIn,
      checkedOut,
      overdue,
      vipVisitors,
      averageVisitDuration: completedVisits > 0 ? totalVisitDuration / completedVisits / (1000 * 60 * 60) : 0, // Convert to hours
      visitorsByDepartment,
      visitorsByPurpose,
      peakHours,
      trends
    };
  },
  
  // Selection
  selectVisitor: (visitor) => {
    set({ selectedVisitor: visitor });
  }
}));
