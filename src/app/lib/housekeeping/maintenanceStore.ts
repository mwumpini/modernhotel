import { create } from 'zustand';
import { MaintenanceRequest, WorkOrder, InspectionReport, HousekeepingStaff, MaintenancePart, WorkOrderMaterial } from './models';

interface MaintenanceStore {
  maintenanceRequests: MaintenanceRequest[];
  workOrders: WorkOrder[];
  inspectionReports: InspectionReport[];
  staff: HousekeepingStaff[];
  selectedRequest: MaintenanceRequest | null;
  selectedWorkOrder: WorkOrder | null;
  selectedInspection: InspectionReport | null;
  
  // Maintenance Request Management
  createMaintenanceRequest: (request: Omit<MaintenanceRequest, 'id' | 'totalCost'>) => void;
  updateMaintenanceRequest: (id: string, updates: Partial<MaintenanceRequest>) => void;
  deleteMaintenanceRequest: (id: string) => void;
  getMaintenanceRequest: (id: string) => MaintenanceRequest | undefined;
  getRequestsByStatus: (status: MaintenanceRequest['status']) => MaintenanceRequest[];
  getRequestsByPriority: (priority: MaintenanceRequest['priority']) => MaintenanceRequest[];
  getRequestsByCategory: (category: MaintenanceRequest['category']) => MaintenanceRequest[];
  getRequestsByRoom: (roomId: string) => MaintenanceRequest[];
  
  // Work Order Management
  createWorkOrder: (order: Omit<WorkOrder, 'id' | 'totalCost'>) => void;
  updateWorkOrder: (id: string, updates: Partial<WorkOrder>) => void;
  deleteWorkOrder: (id: string) => void;
  getWorkOrder: (id: string) => WorkOrder | undefined;
  getWorkOrdersByStatus: (status: WorkOrder['status']) => WorkOrder[];
  getWorkOrdersByType: (type: WorkOrder['type']) => WorkOrder[];
  getWorkOrdersByPriority: (priority: WorkOrder['priority']) => WorkOrder[];
  getWorkOrdersByStaff: (staffId: string) => WorkOrder[];
  
  // Inspection Management
  createInspectionReport: (inspection: Omit<InspectionReport, 'id'>) => void;
  updateInspectionReport: (id: string, updates: Partial<InspectionReport>) => void;
  deleteInspectionReport: (id: string) => void;
  getInspectionReport: (id: string) => InspectionReport | undefined;
  getInspectionsByStatus: (status: InspectionReport['status']) => InspectionReport[];
  getInspectionsByType: (type: InspectionReport['type']) => InspectionReport[];
  getInspectionsByRoom: (roomId: string) => InspectionReport[];
  getInspectionsByInspector: (inspectorId: string) => InspectionReport[];
  
  // Staff Management
  addStaff: (staff: Omit<HousekeepingStaff, 'id' | 'performance'>) => void;
  updateStaff: (id: string, updates: Partial<HousekeepingStaff>) => void;
  deleteStaff: (id: string) => void;
  getStaff: (id: string) => HousekeepingStaff | undefined;
  getStaffByPosition: (position: HousekeepingStaff['position']) => HousekeepingStaff[];
  getStaffByDepartment: (department: HousekeepingStaff['department']) => HousekeepingStaff[];
  getAvailableStaff: () => HousekeepingStaff[];
  
  // Assignment and Status Updates
  assignMaintenanceRequest: (requestId: string, staffId: string, staffName: string) => void;
  startMaintenanceWork: (requestId: string) => void;
  completeMaintenanceWork: (requestId: string, actualCost: number, notes?: string) => void;
  verifyMaintenanceWork: (requestId: string, supervisorId: string, supervisorName: string) => void;
  
  assignWorkOrder: (orderId: string, staffId: string, staffName: string) => void;
  startWorkOrder: (orderId: string) => void;
  completeWorkOrder: (orderId: string, actualDuration: number, notes?: string) => void;
  verifyWorkOrder: (orderId: string, supervisorId: string, supervisorName: string) => void;
  
  // Selection
  selectMaintenanceRequest: (request: MaintenanceRequest | null) => void;
  selectWorkOrder: (order: WorkOrder | null) => void;
  selectInspection: (inspection: InspectionReport | null) => void;
  
  // Analytics
  getMaintenanceCosts: (period: 'daily' | 'weekly' | 'monthly') => { total: number; byCategory: Record<string, number> };
  getWorkOrderEfficiency: () => { averageDuration: number; completionRate: number; onTimeRate: number };
  getInspectionQuality: () => { averageScore: number; passRate: number; criticalIssues: number };
  getStaffWorkload: () => { staffId: string; name: string; activeRequests: number; activeWorkOrders: number }[];
  getPendingMaintenanceCount: () => number;
  getOverdueWorkOrders: () => WorkOrder[];
}

// Sample data
const sampleStaff: HousekeepingStaff[] = [
  {
    id: 'staff1',
    name: 'John Smith',
    employeeId: 'EMP001',
    position: 'maintenance',
    department: 'maintenance',
    shift: 'morning',
    isActive: true,
    skills: ['plumbing', 'electrical', 'carpentry'],
    certifications: ['HVAC Certified', 'Electrical Safety'],
    hireDate: new Date('2022-01-15'),
    hourlyRate: 25,
    performance: {
      averageQualityScore: 8.5,
      tasksCompleted: 45,
      averageTaskTime: 2.5,
      customerSatisfaction: 9.0
    }
  },
  {
    id: 'staff2',
    name: 'Maria Garcia',
    employeeId: 'EMP002',
    position: 'inspector',
    department: 'inspection',
    shift: 'morning',
    isActive: true,
    skills: ['quality control', 'safety inspection', 'documentation'],
    certifications: ['Quality Inspector', 'Safety Officer'],
    hireDate: new Date('2022-03-20'),
    hourlyRate: 22,
    performance: {
      averageQualityScore: 9.2,
      tasksCompleted: 38,
      averageTaskTime: 1.8,
      customerSatisfaction: 9.5
    }
  }
];

const sampleMaintenanceRequests: MaintenanceRequest[] = [
  {
    id: '1',
    roomId: '4',
    roomNumber: '301',
    reportedBy: 'Front Desk',
    reportedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
    category: 'hvac',
    priority: 'high',
    status: 'assigned',
    description: 'Air conditioning not working properly, room temperature is too high',
    assignedToId: 'staff1',
    assignedToName: 'John Smith',
    estimatedCost: 150,
    parts: [
      { id: '1', name: 'AC Filter', partNumber: 'ACF-001', quantity: 1, unitCost: 25, supplier: 'HVAC Supplies' },
      { id: '2', name: 'Refrigerant', partNumber: 'REF-001', quantity: 2, unitCost: 35, supplier: 'HVAC Supplies' }
    ],
    laborHours: 3,
    laborRate: 25,
    totalCost: 150,
    isUrgent: true,
    guestImpact: 'high'
  },
  {
    id: '2',
    roomId: '2',
    roomNumber: '102',
    reportedBy: 'Housekeeping',
    reportedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
    category: 'plumbing',
    priority: 'medium',
    status: 'reported',
    description: 'Bathroom sink drain is slow, needs cleaning',
    estimatedCost: 75,
    parts: [
      { id: '1', name: 'Drain Cleaner', partNumber: 'DC-001', quantity: 1, unitCost: 15, supplier: 'Plumbing World' }
    ],
    laborHours: 1,
    laborRate: 25,
    totalCost: 75,
    isUrgent: false,
    guestImpact: 'low'
  }
];

const sampleWorkOrders: WorkOrder[] = [
  {
    id: '1',
    type: 'maintenance',
    priority: 'high',
    status: 'in-progress',
    title: 'Fix AC in Room 301',
    description: 'Replace AC filter and recharge refrigerant',
    location: 'Room 301',
    assignedToId: 'staff1',
    assignedToName: 'John Smith',
    createdBy: 'System',
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    dueDate: new Date(Date.now() + 6 * 60 * 60 * 1000), // 6 hours from now
    estimatedDuration: 180, // 3 hours
    materials: [
      { id: '1', name: 'AC Filter', quantity: 1, unit: 'piece', cost: 25, supplier: 'HVAC Supplies' },
      { id: '2', name: 'Refrigerant', quantity: 2, unit: 'cans', cost: 35, supplier: 'HVAC Supplies' }
    ],
    laborCost: 75,
    materialCost: 95,
    totalCost: 170
  }
];

const sampleInspectionReports: InspectionReport[] = [
  {
    id: '1',
    roomId: '3',
    roomNumber: '201',
    inspectorId: 'staff2',
    inspectorName: 'Maria Garcia',
    inspectionDate: new Date(Date.now() - 6 * 60 * 60 * 1000), // 6 hours ago
    type: 'post-departure',
    status: 'passed',
    score: 92,
    checklist: [
      { id: '1', category: 'Cleaning', item: 'Bed linens', standard: 'Fresh and properly made', score: 9, isPassed: true },
      { id: '2', category: 'Cleaning', item: 'Bathroom', standard: 'Spotless with fresh towels', score: 9, isPassed: true },
      { id: '3', category: 'Maintenance', item: 'All fixtures working', standard: 'No leaks or malfunctions', score: 10, isPassed: true },
      { id: '4', category: 'Amenities', item: 'Supplies restocked', standard: 'All items present and fresh', score: 8, isPassed: true }
    ],
    issues: [],
    recommendations: ['Consider upgrading bathroom fixtures for better guest experience'],
    nextInspectionDate: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours from now
  }
];

export const useMaintenanceStore = create<MaintenanceStore>((set, get) => ({
  maintenanceRequests: sampleMaintenanceRequests,
  workOrders: sampleWorkOrders,
  inspectionReports: sampleInspectionReports,
  staff: sampleStaff,
  selectedRequest: null,
  selectedWorkOrder: null,
  selectedInspection: null,

  // Maintenance Request Management
  createMaintenanceRequest: (requestData) => {
    const totalCost = (requestData.laborHours * requestData.laborRate) + 
                     requestData.parts.reduce((sum, part) => sum + (part.quantity * part.unitCost), 0);
    
    const newRequest: MaintenanceRequest = {
      ...requestData,
      id: Date.now().toString(),
      totalCost
    };
    set(state => ({ maintenanceRequests: [...state.maintenanceRequests, newRequest] }));
  },

  updateMaintenanceRequest: (id, updates) => {
    set(state => ({
      maintenanceRequests: state.maintenanceRequests.map(request => 
        request.id === id 
          ? { ...request, ...updates }
          : request
      )
    }));
  },

  deleteMaintenanceRequest: (id) => {
    set(state => ({ maintenanceRequests: state.maintenanceRequests.filter(request => request.id !== id) }));
  },

  getMaintenanceRequest: (id) => get().maintenanceRequests.find(request => request.id === id),

  getRequestsByStatus: (status) => get().maintenanceRequests.filter(request => request.status === status),

  getRequestsByPriority: (priority) => get().maintenanceRequests.filter(request => request.priority === priority),

  getRequestsByCategory: (category) => get().maintenanceRequests.filter(request => request.category === category),

  getRequestsByRoom: (roomId) => get().maintenanceRequests.filter(request => request.roomId === roomId),

  // Work Order Management
  createWorkOrder: (orderData) => {
    const totalCost = orderData.laborCost + orderData.materialCost;
    
    const newOrder: WorkOrder = {
      ...orderData,
      id: Date.now().toString(),
      totalCost
    };
    set(state => ({ workOrders: [...state.workOrders, newOrder] }));
  },

  updateWorkOrder: (id, updates) => {
    set(state => ({
      workOrders: state.workOrders.map(order => 
        order.id === id 
          ? { ...order, ...updates }
          : order
      )
    }));
  },

  deleteWorkOrder: (id) => {
    set(state => ({ workOrders: state.workOrders.filter(order => order.id !== id) }));
  },

  getWorkOrder: (id) => get().workOrders.find(order => order.id === id),

  getWorkOrdersByStatus: (status) => get().workOrders.filter(order => order.status === status),

  getWorkOrdersByType: (type) => get().workOrders.filter(order => order.type === type),

  getWorkOrdersByPriority: (priority) => get().workOrders.filter(order => order.priority === priority),

  getWorkOrdersByStaff: (staffId) => get().workOrders.filter(order => order.assignedToId === staffId),

  // Inspection Management
  createInspectionReport: (inspectionData) => {
    const newInspection: InspectionReport = {
      ...inspectionData,
      id: Date.now().toString()
    };
    set(state => ({ inspectionReports: [...state.inspectionReports, newInspection] }));
  },

  updateInspectionReport: (id, updates) => {
    set(state => ({
      inspectionReports: state.inspectionReports.map(inspection => 
        inspection.id === id 
          ? { ...inspection, ...updates }
          : inspection
      )
    }));
  },

  deleteInspectionReport: (id) => {
    set(state => ({ inspectionReports: state.inspectionReports.filter(inspection => inspection.id !== id) }));
  },

  getInspectionReport: (id) => get().inspectionReports.find(inspection => inspection.id === id),

  getInspectionsByStatus: (status) => get().inspectionReports.filter(inspection => inspection.status === status),

  getInspectionsByType: (type) => get().inspectionReports.filter(inspection => inspection.type === type),

  getInspectionsByRoom: (roomId) => get().inspectionReports.filter(inspection => inspection.roomId === roomId),

  getInspectionsByInspector: (inspectorId) => get().inspectionReports.filter(inspection => inspection.inspectorId === inspectorId),

  // Staff Management
  addStaff: (staffData) => {
    const newStaff: HousekeepingStaff = {
      ...staffData,
      id: Date.now().toString(),
      performance: {
        averageQualityScore: 0,
        tasksCompleted: 0,
        averageTaskTime: 0,
        customerSatisfaction: 0
      }
    };
    set(state => ({ staff: [...state.staff, newStaff] }));
  },

  updateStaff: (id, updates) => {
    set(state => ({
      staff: state.staff.map(staff => 
        staff.id === id 
          ? { ...staff, ...updates }
          : staff
      )
    }));
  },

  deleteStaff: (id) => {
    set(state => ({ staff: state.staff.filter(staff => staff.id !== id) }));
  },

  getStaff: (id) => get().staff.find(staff => staff.id === id),

  getStaffByPosition: (position) => get().staff.filter(staff => staff.position === position),

  getStaffByDepartment: (department) => get().staff.filter(staff => staff.department === department),

  getAvailableStaff: () => get().staff.filter(staff => staff.isActive),

  // Assignment and Status Updates
  assignMaintenanceRequest: (requestId, staffId, staffName) => {
    get().updateMaintenanceRequest(requestId, { 
      assignedToId: staffId, 
      assignedToName: staffName,
      status: 'assigned'
    });
  },

  startMaintenanceWork: (requestId) => {
    get().updateMaintenanceRequest(requestId, { 
      status: 'in-progress',
      startDate: new Date()
    });
  },

  completeMaintenanceWork: (requestId, actualCost, notes) => {
    get().updateMaintenanceRequest(requestId, { 
      status: 'completed',
      completionDate: new Date(),
      actualCost,
      notes: notes || undefined
    });
    
    // Record expense to Maintenance cost center
    try {
      const { useAccountingStore } = require('../accounting/store');
      const { recordExpense } = useAccountingStore.getState();
      recordExpense('MT', actualCost);
    } catch {}
  },

  verifyMaintenanceWork: (requestId, supervisorId, supervisorName) => {
    get().updateMaintenanceRequest(requestId, { 
      status: 'verified'
    });
  },

  assignWorkOrder: (orderId, staffId, staffName) => {
    get().updateWorkOrder(orderId, { 
      assignedToId: staffId, 
      assignedToName: staffName,
      status: 'assigned'
    });
  },

  startWorkOrder: (orderId) => {
    get().updateWorkOrder(orderId, { 
      status: 'in-progress'
    });
  },

  completeWorkOrder: (orderId, actualDuration, notes) => {
    get().updateWorkOrder(orderId, { 
      status: 'completed',
      completedAt: new Date(),
      actualDuration,
      notes: notes || undefined
    });
  },

  verifyWorkOrder: (orderId, supervisorId, supervisorName) => {
    get().updateWorkOrder(orderId, { 
      status: 'verified'
    });
  },

  // Selection
  selectMaintenanceRequest: (request) => set({ selectedRequest: request }),

  selectWorkOrder: (order) => set({ selectedWorkOrder: order }),

  selectInspection: (inspection) => set({ selectedInspection: inspection }),

  // Analytics
  getMaintenanceCosts: (period) => {
    const state = get();
    const now = new Date();
    let startDate: Date;
    
    switch (period) {
      case 'daily':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'weekly':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'monthly':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
    }
    
    const requests = state.maintenanceRequests.filter(request => 
      request.reportedAt >= startDate && request.status === 'completed'
    );
    
    const total = requests.reduce((sum, request) => sum + (request.actualCost || request.totalCost), 0);
    const byCategory: Record<string, number> = {};
    
    requests.forEach(request => {
      byCategory[request.category] = (byCategory[request.category] || 0) + (request.actualCost || request.totalCost);
    });
    
    return { total, byCategory };
  },

  getWorkOrderEfficiency: () => {
    const state = get();
    const completedOrders = state.workOrders.filter(order => order.status === 'completed');
    
    if (completedOrders.length === 0) return { averageDuration: 0, completionRate: 0, onTimeRate: 0 };
    
    const totalDuration = completedOrders.reduce((sum, order) => sum + (order.actualDuration || 0), 0);
    const averageDuration = totalDuration / completedOrders.length;
    
    const completionRate = (completedOrders.length / state.workOrders.length) * 100;
    
    const onTimeOrders = completedOrders.filter(order => 
      order.completedAt && order.completedAt <= order.dueDate
    );
    const onTimeRate = (onTimeOrders.length / completedOrders.length) * 100;
    
    return { averageDuration, completionRate, onTimeRate };
  },

  getInspectionQuality: () => {
    const state = get();
    const inspections = state.inspectionReports;
    
    if (inspections.length === 0) return { averageScore: 0, passRate: 0, criticalIssues: 0 };
    
    const totalScore = inspections.reduce((sum, inspection) => sum + inspection.score, 0);
    const averageScore = totalScore / inspections.length;
    
    const passedInspections = inspections.filter(inspection => inspection.status === 'passed');
    const passRate = (passedInspections.length / inspections.length) * 100;
    
    const criticalIssues = inspections.reduce((sum, inspection) => 
      sum + inspection.issues.filter(issue => issue.severity === 'critical').length, 0
    );
    
    return { averageScore, passRate, criticalIssues };
  },

  getStaffWorkload: () => {
    const state = get();
    return state.staff.map(staff => ({
      staffId: staff.id,
      name: staff.name,
      activeRequests: state.maintenanceRequests.filter(request => 
        request.assignedToId === staff.id && ['assigned', 'in-progress'].includes(request.status)
      ).length,
      activeWorkOrders: state.workOrders.filter(order => 
        order.assignedToId === staff.id && ['assigned', 'in-progress'].includes(order.status)
      ).length
    }));
  },

  getPendingMaintenanceCount: () => {
    return get().maintenanceRequests.filter(request => request.status === 'reported').length;
  },

  getOverdueWorkOrders: () => {
    const now = new Date();
    return get().workOrders.filter(order => 
      order.status === 'assigned' && order.dueDate < now
    );
  }
}));
