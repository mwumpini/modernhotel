import { create } from 'zustand';
import { Employee, Department, Position } from './models';

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
}

export const useEmployeeStore = create<EmployeeStore>((set, get) => ({
  employees: [
    {
      id: '1',
      employeeNumber: 'EMP001',
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@hotel.com',
      phone: '+233 20 123 4567',
      dateOfBirth: new Date('1990-05-15'),
      hireDate: new Date('2020-03-01'),
      departmentId: '1',
      positionId: '1',
      status: 'active',
      employmentType: 'full_time',
      salary: 2500,
      hourlyRate: 15,
      address: {
        street: '123 Main St',
        city: 'Accra',
        state: 'Greater Accra',
        postalCode: '00233',
        country: 'Ghana'
      },
      bankAccount: {
        accountNumber: '1234567890',
        bankName: 'Ghana Commercial Bank',
        branchCode: 'GCB001'
      },
      emergencyContact: {
        name: 'Jane Doe',
        relationship: 'Spouse',
        phone: '+233 20 123 4568'
      },
      documents: ['cert1', 'cert2'],
      notes: 'Experienced front office manager with strong leadership skills',
      createdAt: new Date('2020-03-01'),
      updatedAt: new Date('2024-01-15')
    },
    {
      id: '2',
      employeeNumber: 'EMP002',
      firstName: 'Sarah',
      lastName: 'Johnson',
      email: 'sarah.johnson@hotel.com',
      phone: '+233 20 123 4569',
      dateOfBirth: new Date('1988-12-10'),
      hireDate: new Date('2019-08-15'),
      departmentId: '2',
      positionId: '2',
      status: 'active',
      employmentType: 'full_time',
      salary: 2800,
      hourlyRate: 18,
      address: {
        street: '456 Oak Ave',
        city: 'Accra',
        state: 'Greater Accra',
        postalCode: '00233',
        country: 'Ghana'
      },
      bankAccount: {
        accountNumber: '0987654321',
        bankName: 'Ghana Commercial Bank',
        branchCode: 'GCB002'
      },
      emergencyContact: {
        name: 'Mike Johnson',
        relationship: 'Spouse',
        phone: '+233 20 123 4570'
      },
      documents: ['Food Safety Certificate', 'Culinary Arts Diploma'],
      notes: 'Experienced chef with strong kitchen management skills',
      createdAt: new Date('2019-08-15'),
      updatedAt: new Date('2024-01-20')
    },
    {
      id: '3',
      employeeNumber: 'EMP003',
      firstName: 'Michael',
      lastName: 'Chen',
      email: 'michael.chen@hotel.com',
      phone: '+233 20 123 4571',
      dateOfBirth: new Date('1992-07-22'),
      hireDate: new Date('2021-01-10'),
      departmentId: '3',
      positionId: '3',
      status: 'active',
      employmentType: 'full_time',
      salary: 2200,
      hourlyRate: 14,
      address: {
        street: '789 Pine St',
        city: 'Accra',
        state: 'Greater Accra',
        postalCode: '00233',
        country: 'Ghana'
      },
      bankAccount: {
        accountNumber: '1122334455',
        bankName: 'Ghana Commercial Bank',
        branchCode: 'GCB003'
      },
      emergencyContact: {
        name: 'Lisa Chen',
        relationship: 'Sister',
        phone: '+233 20 123 4572'
      },
      documents: ['Housekeeping Certificate'],
      notes: 'Experienced housekeeping supervisor with attention to detail',
      createdAt: new Date('2021-01-10'),
      updatedAt: new Date('2024-01-10')
    }
  ],

  departments: [
    {
      id: '1',
      name: 'Front Office',
      description: 'Guest services and front desk operations',
      managerId: '1',
      location: 'Main Lobby',
      budget: 150000,
      employeeCount: 12,
      status: 'active',
      createdAt: new Date('2020-01-01'),
      updatedAt: new Date('2024-01-01')
    },
    {
      id: '2',
      name: 'Food & Beverage',
      description: 'Restaurant, bar, and catering services',
      managerId: '2',
      location: 'Ground Floor',
      budget: 200000,
      employeeCount: 25,
      status: 'active',
      createdAt: new Date('2020-01-01'),
      updatedAt: new Date('2024-01-01')
    },
    {
      id: '3',
      name: 'Housekeeping',
      description: 'Room cleaning and maintenance',
      managerId: '3',
      location: 'All Floors',
      budget: 120000,
      employeeCount: 18,
      status: 'active',
      createdAt: new Date('2020-01-01'),
      updatedAt: new Date('2024-01-01')
    }
  ],

  positions: [
    {
      id: '1',
      title: 'Front Office Manager',
      departmentId: '1',
      description: 'Manages front desk operations and guest services',
      baseSalary: 2500,
      requirements: ['Bachelor\'s degree', '3+ years experience', 'Leadership skills'],
      status: 'active',
      createdAt: new Date('2020-01-01'),
      updatedAt: new Date('2024-01-01')
    },
    {
      id: '2',
      title: 'Head Chef',
      departmentId: '2',
      description: 'Leads kitchen operations and menu development',
      baseSalary: 2800,
      requirements: ['Culinary degree', '5+ years experience', 'Kitchen management'],
      status: 'active',
      createdAt: new Date('2020-01-01'),
      updatedAt: new Date('2024-01-01')
    },
    {
      id: '3',
      title: 'Housekeeping Supervisor',
      departmentId: '3',
      description: 'Supervises cleaning staff and quality control',
      baseSalary: 2200,
      requirements: ['High school diploma', '2+ years experience', 'Supervisory skills'],
      status: 'active',
      createdAt: new Date('2020-01-01'),
      updatedAt: new Date('2024-01-01')
    }
  ],

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
  },

  updateEmployee: (id, updates) => {
    set((state) => ({
      employees: state.employees.map(emp =>
        emp.id === id ? { ...emp, ...updates, updatedAt: new Date() } : emp
      )
    }));
  },

  deleteEmployee: (id) => {
    set((state) => ({
      employees: state.employees.filter(emp => emp.id !== id)
    }));
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
  },

  updateDepartment: (id, updates) => {
    set((state) => ({
      departments: state.departments.map(dept =>
        dept.id === id ? { ...dept, ...updates, updatedAt: new Date() } : dept
      )
    }));
  },

  deleteDepartment: (id) => {
    set((state) => ({
      departments: state.departments.filter(dept => dept.id !== id)
    }));
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
  },

  updatePosition: (id, updates) => {
    set((state) => ({
      positions: state.positions.map(pos =>
        pos.id === id ? { ...pos, ...updates, updatedAt: new Date() } : pos
      )
    }));
  },

  deletePosition: (id) => {
    set((state) => ({
      positions: state.positions.filter(pos => pos.id !== id)
    }));
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
  }
}));
