import { create } from 'zustand';
import { Employee, Department, Position } from './models';
import { getClientTenantSubdomain } from '../api/clientTenant';
import { normalizeTenantSubdomain } from '../api/tenantSubdomain';

function hrTenantHeaders(): HeadersInit {
  const sub = normalizeTenantSubdomain(getClientTenantSubdomain());
  return { 'x-tenant-subdomain': sub, 'x-tenant-id': sub, 'Content-Type': 'application/json' };
}

// Best-effort background persistence — the store stays synchronous/in-memory for the UI
// (same interaction model as before), but every mutation now also durably persists
// tenant-scoped to the database, same pattern as supplierStore.ts/bankReconStore.ts.
function syncEmployeeToApi(employee: Employee) {
  if (typeof window === 'undefined') return;
  fetch('/api/hr/employees', { method: 'POST', headers: hrTenantHeaders(), body: JSON.stringify(employee) })
    .catch((e) => console.warn('[HR] Failed to sync employee to server:', e));
}
function deleteEmployeeFromApi(id: string) {
  if (typeof window === 'undefined') return;
  fetch(`/api/hr/employees?id=${encodeURIComponent(id)}`, { method: 'DELETE', headers: hrTenantHeaders() })
    .catch((e) => console.warn('[HR] Failed to delete employee on server:', e));
}
function syncDepartmentToApi(department: Department) {
  if (typeof window === 'undefined') return;
  fetch('/api/hr/departments', { method: 'POST', headers: hrTenantHeaders(), body: JSON.stringify(department) })
    .catch((e) => console.warn('[HR] Failed to sync department to server:', e));
}
function deleteDepartmentFromApi(id: string) {
  if (typeof window === 'undefined') return;
  fetch(`/api/hr/departments?id=${encodeURIComponent(id)}`, { method: 'DELETE', headers: hrTenantHeaders() })
    .catch((e) => console.warn('[HR] Failed to delete department on server:', e));
}
function syncPositionToApi(position: Position) {
  if (typeof window === 'undefined') return;
  fetch('/api/hr/positions', { method: 'POST', headers: hrTenantHeaders(), body: JSON.stringify(position) })
    .catch((e) => console.warn('[HR] Failed to sync position to server:', e));
}
function deletePositionFromApi(id: string) {
  if (typeof window === 'undefined') return;
  fetch(`/api/hr/positions?id=${encodeURIComponent(id)}`, { method: 'DELETE', headers: hrTenantHeaders() })
    .catch((e) => console.warn('[HR] Failed to delete position on server:', e));
}

interface EmployeeStore {
  employees: Employee[];
  departments: Department[];
  positions: Position[];
  selectedEmployee: Employee | null;

  // Employee Management
  addEmployee: (employee: Omit<Employee, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateEmployee: (id: string, updates: Partial<Employee>) => void;
  deleteEmployee: (id: string) => void;
  getEmployee: (id: string) => Employee | undefined;
  getEmployeeByNumber: (employeeNumber: string) => Employee | undefined;

  // Department Management
  addDepartment: (department: Omit<Department, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateDepartment: (id: string, updates: Partial<Department>) => void;
  deleteDepartment: (id: string) => void;
  getDepartment: (id: string) => Department | undefined;

  // Position Management
  addPosition: (position: Omit<Position, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updatePosition: (id: string, updates: Partial<Position>) => void;
  deletePosition: (id: string) => void;
  getPosition: (id: string) => Position | undefined;

  // Search and Filtering
  getEmployeesByDepartment: (departmentId: string) => Employee[];
  getEmployeesByPosition: (positionId: string) => Employee[];
  getEmployeesByStatus: (status: Employee['status']) => Employee[];
  getEmployeesByEmploymentType: (type: Employee['employmentType']) => Employee[];
  getActiveEmployees: () => Employee[];
  getTerminatedEmployees: () => Employee[];
  getEmployeesOnLeave: () => Employee[];

  // Analytics
  getEmployeeAnalytics: (period: 'daily' | 'weekly' | 'monthly') => {
    totalEmployees: number;
    activeEmployees: number;
    newHires: number;
    terminations: number;
    turnoverRate: number;
    averageSalary: number;
    employeesByDepartment: Record<string, number>;
    employeesByPosition: Record<string, number>;
    employeesByStatus: Record<string, number>;
    salaryDistribution: Record<string, number>;
  };

  // Selection
  selectEmployee: (employee: Employee | null) => void;

  // Persistence — pulls real data from the database, replacing the in-memory seed.
  hydrateFromApi: () => Promise<void>;
}

export const useEmployeeStore = create<EmployeeStore>((set, get) => ({
  // Empty initial state — hydrateFromApi() below replaces this with real data on mount.
  // Never seed with fake employees/departments/positions: a slow/failed fetch must show
  // an honest empty state, not fabricated staff records.
  employees: [],

  departments: [],

  positions: [],

  selectedEmployee: null,

  // Employee Management
  addEmployee: (employee) => {
    const newEmployee: Employee = {
      ...employee,
      id: Date.now().toString(),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    set((state) => ({
      employees: [...state.employees, newEmployee]
    }));
    syncEmployeeToApi(newEmployee);
  },

  updateEmployee: (id, updates) => {
    let updated: Employee | undefined;
    set((state) => ({
      employees: state.employees.map(emp => {
        if (emp.id !== id) return emp;
        updated = { ...emp, ...updates, updatedAt: new Date() };
        return updated;
      })
    }));
    if (updated) syncEmployeeToApi(updated);
  },

  deleteEmployee: (id) => {
    set((state) => ({
      employees: state.employees.filter(emp => emp.id !== id)
    }));
    deleteEmployeeFromApi(id);
  },

  getEmployee: (id) => {
    return get().employees.find(emp => emp.id === id);
  },

  getEmployeeByNumber: (employeeNumber) => {
    return get().employees.find(emp => emp.employeeNumber === employeeNumber);
  },

  // Department Management
  addDepartment: (department) => {
    const newDepartment: Department = {
      ...department,
      id: Date.now().toString(),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    set((state) => ({
      departments: [...state.departments, newDepartment]
    }));
    syncDepartmentToApi(newDepartment);
  },

  updateDepartment: (id, updates) => {
    let updated: Department | undefined;
    set((state) => ({
      departments: state.departments.map(dept => {
        if (dept.id !== id) return dept;
        updated = { ...dept, ...updates, updatedAt: new Date() };
        return updated;
      })
    }));
    if (updated) syncDepartmentToApi(updated);
  },

  deleteDepartment: (id) => {
    set((state) => ({
      departments: state.departments.filter(dept => dept.id !== id)
    }));
    deleteDepartmentFromApi(id);
  },

  getDepartment: (id) => {
    return get().departments.find(dept => dept.id === id);
  },

  // Position Management
  addPosition: (position) => {
    const newPosition: Position = {
      ...position,
      id: Date.now().toString(),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    set((state) => ({
      positions: [...state.positions, newPosition]
    }));
    syncPositionToApi(newPosition);
  },

  updatePosition: (id, updates) => {
    let updated: Position | undefined;
    set((state) => ({
      positions: state.positions.map(pos => {
        if (pos.id !== id) return pos;
        updated = { ...pos, ...updates, updatedAt: new Date() };
        return updated;
      })
    }));
    if (updated) syncPositionToApi(updated);
  },

  deletePosition: (id) => {
    set((state) => ({
      positions: state.positions.filter(pos => pos.id !== id)
    }));
    deletePositionFromApi(id);
  },

  getPosition: (id) => {
    return get().positions.find(pos => pos.id === id);
  },

  // Search and Filtering
  getEmployeesByDepartment: (departmentId) => {
    return get().employees.filter(emp => emp.departmentId === departmentId);
  },

  getEmployeesByPosition: (positionId) => {
    return get().employees.filter(emp => emp.positionId === positionId);
  },

  getEmployeesByStatus: (status) => {
    return get().employees.filter(emp => emp.status === status);
  },

  getEmployeesByEmploymentType: (type) => {
    return get().employees.filter(emp => emp.employmentType === type);
  },

  getActiveEmployees: () => {
    return get().employees.filter(emp => emp.status === 'active');
  },

  getTerminatedEmployees: () => {
    return get().employees.filter(emp => emp.status === 'terminated');
  },

  getEmployeesOnLeave: () => {
    return get().employees.filter(emp => emp.status === 'on_leave');
  },

  // Analytics
  getEmployeeAnalytics: (period) => {
    const employees = get().employees;
    const activeEmployees = employees.filter(emp => emp.status === 'active');
    const newHires = employees.filter(emp => {
      const hireDate = new Date(emp.hireDate);
      const now = new Date();
      const diffTime = Math.abs(now.getTime() - hireDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays <= 30; // Last 30 days
    });
    const terminations = employees.filter(emp => emp.status === 'terminated');
    
    const totalSalary = activeEmployees.reduce((sum, emp) => sum + emp.salary, 0);
    const averageSalary = activeEmployees.length > 0 ? totalSalary / activeEmployees.length : 0;
    
    const turnoverRate = employees.length > 0 ? (terminations.length / employees.length) * 100 : 0;
    
    const employeesByDepartment: Record<string, number> = {};
    const employeesByPosition: Record<string, number> = {};
    const employeesByStatus: Record<string, number> = {};
    const salaryDistribution: Record<string, number> = {};
    
    employees.forEach(emp => {
      const dept = get().getDepartment(emp.departmentId);
      const pos = get().getPosition(emp.positionId);
      
      if (dept) {
        employeesByDepartment[dept.name] = (employeesByDepartment[dept.name] || 0) + 1;
      }
      if (pos) {
        employeesByPosition[pos.title] = (employeesByPosition[pos.title] || 0) + 1;
      }
      
      employeesByStatus[emp.status] = (employeesByStatus[emp.status] || 0) + 1;
      
      const salaryRange = emp.salary < 2000 ? 'Low' : emp.salary < 3000 ? 'Medium' : 'High';
      salaryDistribution[salaryRange] = (salaryDistribution[salaryRange] || 0) + 1;
    });
    
    return {
      totalEmployees: employees.length,
      activeEmployees: activeEmployees.length,
      newHires: newHires.length,
      terminations: terminations.length,
      turnoverRate,
      averageSalary,
      employeesByDepartment,
      employeesByPosition,
      employeesByStatus,
      salaryDistribution
    };
  },

  // Selection
  selectEmployee: (employee) => {
    set({ selectedEmployee: employee });
  },

  // Dates come back over JSON as ISO strings (the wire format); the store's types expect
  // real Date objects — convert on the way in, mirroring the numeric-string handling the
  // inventory/bank-recon hydration functions do for Prisma Decimal fields.
  hydrateFromApi: async () => {
    if (typeof window === 'undefined') return;
    try {
      const headers = hrTenantHeaders();
      const [empRes, deptRes, posRes] = await Promise.all([
        fetch('/api/hr/employees', { headers, cache: 'no-store' }),
        fetch('/api/hr/departments', { headers, cache: 'no-store' }),
        fetch('/api/hr/positions', { headers, cache: 'no-store' }),
      ]);
      const dateFields = ['dateOfBirth', 'hireDate', 'terminationDate', 'contractEndDate', 'workPermitExpiryDate', 'createdAt', 'updatedAt'];
      const toDates = (row: any) => {
        const out = { ...row };
        for (const f of dateFields) if (out[f]) out[f] = new Date(out[f]);
        if (out.probation) {
          out.probation = { ...out.probation, startDate: new Date(out.probation.startDate), endDate: new Date(out.probation.endDate) };
        }
        return out;
      };
      if (empRes.ok) {
        const data = await empRes.json();
        if (Array.isArray(data.employees)) {
          set({ employees: data.employees.map(toDates) });
        }
      }
      if (deptRes.ok) {
        const data = await deptRes.json();
        if (Array.isArray(data.departments)) {
          set({ departments: data.departments.map(toDates) });
        }
      }
      if (posRes.ok) {
        const data = await posRes.json();
        if (Array.isArray(data.positions)) {
          set({ positions: data.positions.map(toDates) });
        }
      }
    } catch (e) {
      console.warn('[HR] Failed to hydrate employees/departments/positions from server:', e);
    }
  },
}));
