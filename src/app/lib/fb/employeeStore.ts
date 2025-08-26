'use client';

import { Employee, WorkShift } from './models';

class EmployeeStore {
  private employees: Employee[] = [];
  private workShifts: WorkShift[] = [];
  private listeners: Array<() => void> = [];

  constructor() {
    this.initializeSampleData();
  }

  private initializeSampleData() {
    this.employees = [
      {
        id: 'EMP001',
        firstName: 'Kwame',
        lastName: 'Addo',
        email: 'kwame.addo@hotelgh.com',
        phone: '+233 24 123 4567',
        role: 'manager',
        hourlyRate: 25.00,
        isActive: true,
        hireDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(),
        department: 'management',
        permissions: ['discount_override', 'void_transaction', 'employee_management', 'inventory_management'],
        emergencyContact: {
          name: 'Ama Addo',
          relationship: 'Spouse',
          phone: '+233 24 123 4568'
        }
      },
      {
        id: 'EMP002',
        firstName: 'Ama',
        lastName: 'Osei',
        email: 'ama.osei@hotelgh.com',
        phone: '+233 26 987 6543',
        role: 'waiter',
        hourlyRate: 12.50,
        isActive: true,
        hireDate: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString(),
        department: 'front_of_house',
        permissions: ['basic_discount', 'view_reports'],
        emergencyContact: {
          name: 'Kofi Osei',
          relationship: 'Father',
          phone: '+233 26 987 6544'
        }
      },
      {
        id: 'EMP003',
        firstName: 'Efua',
        lastName: 'Mensah',
        email: 'efua.mensah@hotelgh.com',
        phone: '+233 20 555 7890',
        role: 'chef',
        hourlyRate: 18.75,
        isActive: true,
        hireDate: new Date(Date.now() - 240 * 24 * 60 * 60 * 1000).toISOString(),
        department: 'back_of_house',
        permissions: ['kitchen_management', 'inventory_usage', 'recipe_management'],
        emergencyContact: {
          name: 'Yaa Mensah',
          relationship: 'Sister',
          phone: '+233 20 555 7891'
        }
      },
      {
        id: 'EMP004',
        firstName: 'Kofi',
        lastName: 'Asante',
        email: 'kofi.asante@hotelgh.com',
        phone: '+233 26 111 2222',
        role: 'bartender',
        hourlyRate: 15.00,
        isActive: true,
        hireDate: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString(),
        department: 'front_of_house',
        permissions: ['bar_management', 'inventory_usage', 'basic_discount'],
        emergencyContact: {
          name: 'Abena Asante',
          relationship: 'Mother',
          phone: '+233 26 111 2223'
        }
      },
      {
        id: 'EMP005',
        firstName: 'Yaa',
        lastName: 'Owusu',
        email: 'yaa.owusu@hotelgh.com',
        phone: '+233 27 333 4444',
        role: 'cashier',
        hourlyRate: 13.50,
        isActive: true,
        hireDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
        department: 'front_of_house',
        permissions: ['payment_processing', 'refund_processing', 'view_reports'],
        emergencyContact: {
          name: 'Kwame Owusu',
          relationship: 'Brother',
          phone: '+233 27 333 4445'
        }
      }
    ];

    // Sample work shifts for the current week
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    
    this.workShifts = [
      {
        id: 'SHIFT001',
        employeeId: 'EMP001',
        date: startOfWeek.toISOString().split('T')[0],
        startTime: '08:00',
        endTime: '17:00',
        breakTime: 60,
        totalHours: 8,
        hourlyRate: 25.00,
        totalPay: 200.00,
        status: 'completed',
        notes: 'Regular management shift'
      },
      {
        id: 'SHIFT002',
        employeeId: 'EMP002',
        date: startOfWeek.toISOString().split('T')[0],
        startTime: '10:00',
        endTime: '18:00',
        breakTime: 30,
        totalHours: 7.5,
        hourlyRate: 12.50,
        totalPay: 93.75,
        status: 'completed',
        notes: 'Lunch service shift'
      },
      {
        id: 'SHIFT003',
        employeeId: 'EMP003',
        date: startOfWeek.toISOString().split('T')[0],
        startTime: '06:00',
        endTime: '15:00',
        breakTime: 45,
        totalHours: 8.25,
        hourlyRate: 18.75,
        totalPay: 154.69,
        status: 'completed',
        notes: 'Morning prep shift'
      }
    ];
  }

  // Employee CRUD operations
  addEmployee(employee: Omit<Employee, 'id'>): Employee {
    const id = `EMP${String(this.employees.length + 1).padStart(3, '0')}`;
    const newEmployee = { ...employee, id };
    this.employees.push(newEmployee);
    this.notifyListeners();
    return newEmployee;
  }

  updateEmployee(id: string, updates: Partial<Employee>): Employee | null {
    const index = this.employees.findIndex(e => e.id === id);
    if (index === -1) return null;
    
    this.employees[index] = { ...this.employees[index], ...updates };
    this.notifyListeners();
    return this.employees[index];
  }

  getEmployee(id: string): Employee | undefined {
    return this.employees.find(e => e.id === id);
  }

  getAllEmployees(): Employee[] {
    return [...this.employees];
  }

  getActiveEmployees(): Employee[] {
    return this.employees.filter(e => e.isActive);
  }

  getEmployeesByDepartment(department: string): Employee[] {
    return this.employees.filter(e => e.department === department);
  }

  getEmployeesByRole(role: string): Employee[] {
    return this.employees.filter(e => e.role === role);
  }

  // Employee search and filtering
  searchEmployees(query: string): Employee[] {
    const q = query.toLowerCase();
    return this.employees.filter(e => 
      e.firstName.toLowerCase().includes(q) ||
      e.lastName.toLowerCase().includes(q) ||
      e.email.toLowerCase().includes(q) ||
      e.role.toLowerCase().includes(q)
    );
  }

  // Employee permissions and security
  hasPermission(employeeId: string, permission: string): boolean {
    const employee = this.getEmployee(employeeId);
    return employee?.permissions.includes(permission) || false;
  }

  addPermission(employeeId: string, permission: string): boolean {
    const employee = this.getEmployee(employeeId);
    if (!employee || employee.permissions.includes(permission)) return false;
    
    employee.permissions.push(permission);
    this.notifyListeners();
    return true;
  }

  removePermission(employeeId: string, permission: string): boolean {
    const employee = this.getEmployee(employeeId);
    if (!employee) return false;
    
    const index = employee.permissions.indexOf(permission);
    if (index > -1) {
      employee.permissions.splice(index, 1);
      this.notifyListeners();
      return true;
    }
    return false;
  }

  // Work shift management
  addWorkShift(shift: Omit<WorkShift, 'id'>): WorkShift {
    const id = `SHIFT${String(this.workShifts.length + 1).padStart(3, '0')}`;
    const newShift = { ...shift, id };
    this.workShifts.push(newShift);
    this.notifyListeners();
    return newShift;
  }

  updateWorkShift(id: string, updates: Partial<WorkShift>): WorkShift | null {
    const index = this.workShifts.findIndex(s => s.id === id);
    if (index === -1) return null;
    
    this.workShifts[index] = { ...this.workShifts[index], ...updates };
    this.notifyListeners();
    return this.workShifts[index];
  }

  getWorkShift(id: string): WorkShift | undefined {
    return this.workShifts.find(s => s.id === id);
  }

  getWorkShiftsByEmployee(employeeId: string): WorkShift[] {
    return this.workShifts.filter(s => s.employeeId === employeeId);
  }

  getWorkShiftsByDate(date: string): WorkShift[] {
    return this.workShifts.filter(s => s.date === date);
  }

  getWorkShiftsByStatus(status: WorkShift['status']): WorkShift[] {
    return this.workShifts.filter(s => s.status === status);
  }

  // Employee performance and analytics
  getEmployeePerformance(employeeId: string, startDate: string, endDate: string): {
    totalHours: number;
    totalPay: number;
    averageHoursPerShift: number;
    shiftCount: number;
    efficiency: number;
  } {
    const shifts = this.workShifts.filter(s => {
      if (s.employeeId !== employeeId) return false;
      const shiftDate = new Date(s.date);
      const start = new Date(startDate);
      const end = new Date(endDate);
      return shiftDate >= start && shiftDate <= end && s.status === 'completed';
    });

    if (shifts.length === 0) {
      return {
        totalHours: 0,
        totalPay: 0,
        averageHoursPerShift: 0,
        shiftCount: 0,
        efficiency: 0
      };
    }

    const totalHours = shifts.reduce((sum, s) => sum + s.totalHours, 0);
    const totalPay = shifts.reduce((sum, s) => sum + s.totalPay, 0);
    const averageHoursPerShift = totalHours / shifts.length;
    const shiftCount = shifts.length;

    // Calculate efficiency based on role (this could be enhanced with actual metrics)
    const employee = this.getEmployee(employeeId);
    let efficiency = 0;
    if (employee) {
      switch (employee.role) {
        case 'waiter':
          efficiency = Math.min(100, (totalHours / 40) * 100); // Based on 40-hour week
          break;
        case 'chef':
          efficiency = Math.min(100, (totalHours / 45) * 100); // Based on 45-hour week
          break;
        default:
          efficiency = Math.min(100, (totalHours / 40) * 100);
      }
    }

    return {
      totalHours,
      totalPay,
      averageHoursPerShift,
      shiftCount,
      efficiency
    };
  }

  getDepartmentPerformance(department: string, startDate: string, endDate: string): {
    totalEmployees: number;
    totalHours: number;
    totalPay: number;
    averageHourlyRate: number;
    employeeBreakdown: Array<{
      employeeId: string;
      name: string;
      hours: number;
      pay: number;
      efficiency: number;
    }>;
  } {
    const departmentEmployees = this.getEmployeesByDepartment(department);
    const totalEmployees = departmentEmployees.length;
    
    let totalHours = 0;
    let totalPay = 0;
    const employeeBreakdown: Array<{
      employeeId: string;
      name: string;
      hours: number;
      pay: number;
      efficiency: number;
    }> = [];

    departmentEmployees.forEach(employee => {
      const performance = this.getEmployeePerformance(employee.id, startDate, endDate);
      totalHours += performance.totalHours;
      totalPay += performance.totalPay;
      
      employeeBreakdown.push({
        employeeId: employee.id,
        name: `${employee.firstName} ${employee.lastName}`,
        hours: performance.totalHours,
        pay: performance.totalPay,
        efficiency: performance.efficiency
      });
    });

    const averageHourlyRate = totalHours > 0 ? totalPay / totalHours : 0;

    return {
      totalEmployees,
      totalHours,
      totalPay,
      averageHourlyRate,
      employeeBreakdown
    };
  }

  // Labor cost analytics
  getLaborCosts(startDate: string, endDate: string): {
    totalHours: number;
    totalPay: number;
    averageHourlyRate: number;
    byDepartment: Record<string, { hours: number; pay: number; }>;
    byRole: Record<string, { hours: number; pay: number; }>;
  } {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    const relevantShifts = this.workShifts.filter(s => {
      const shiftDate = new Date(s.date);
      return shiftDate >= start && shiftDate <= end && s.status === 'completed';
    });

    let totalHours = 0;
    let totalPay = 0;
    const byDepartment: Record<string, { hours: number; pay: number; }> = {};
    const byRole: Record<string, { hours: number; pay: number; }> = {};

    relevantShifts.forEach(shift => {
      const employee = this.getEmployee(shift.employeeId);
      if (!employee) return;

      totalHours += shift.totalHours;
      totalPay += shift.totalPay;

      // Aggregate by department
      if (!byDepartment[employee.department]) {
        byDepartment[employee.department] = { hours: 0, pay: 0 };
      }
      byDepartment[employee.department].hours += shift.totalHours;
      byDepartment[employee.department].pay += shift.totalPay;

      // Aggregate by role
      if (!byRole[employee.role]) {
        byRole[employee.role] = { hours: 0, pay: 0 };
      }
      byRole[employee.role].hours += shift.totalHours;
      byRole[employee.role].pay += shift.totalPay;
    });

    const averageHourlyRate = totalHours > 0 ? totalPay / totalHours : 0;

    return {
      totalHours,
      totalPay,
      averageHourlyRate,
      byDepartment,
      byRole
    };
  }

  // Employee scheduling
  getUpcomingShifts(employeeId: string, days: number = 7): WorkShift[] {
    const today = new Date();
    const endDate = new Date();
    endDate.setDate(today.getDate() + days);

    return this.workShifts.filter(s => {
      if (s.employeeId !== employeeId) return false;
      const shiftDate = new Date(s.date);
      return shiftDate >= today && shiftDate <= endDate;
    }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }

  getAvailableEmployees(date: string, startTime: string, endTime: string, role?: string): Employee[] {
    const requestedDate = new Date(date);
    const requestedStart = new Date(`${date}T${startTime}`);
    const requestedEnd = new Date(`${date}T${endTime}`);

    return this.employees.filter(employee => {
      if (!employee.isActive) return false;
      if (role && employee.role !== role) return false;

      // Check if employee has conflicting shifts
      const conflictingShifts = this.workShifts.filter(shift => {
        if (shift.employeeId !== employee.id) return false;
        if (shift.date !== date) return false;
        if (shift.status === 'cancelled') return false;

        const shiftStart = new Date(`${shift.date}T${shift.startTime}`);
        const shiftEnd = new Date(`${shift.date}T${shift.endTime}`);

        // Check for overlap
        return !(requestedEnd <= shiftStart || requestedStart >= shiftEnd);
      });

      return conflictingShifts.length === 0;
    });
  }

  // Export and reporting
  exportEmployeeData(): string {
    const headers = ['ID', 'First Name', 'Last Name', 'Email', 'Phone', 'Role', 'Department', 'Hourly Rate', 'Hire Date', 'Status'];
    const rows = this.employees.map(e => [
      e.id,
      e.firstName,
      e.lastName,
      e.email,
      e.phone,
      e.role,
      e.department,
      e.hourlyRate.toFixed(2),
      new Date(e.hireDate).toLocaleDateString(),
      e.isActive ? 'Active' : 'Inactive'
    ]);
    
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    return csv;
  }

  exportWorkShiftData(): string {
    const headers = ['ID', 'Employee ID', 'Date', 'Start Time', 'End Time', 'Hours', 'Pay', 'Status'];
    const rows = this.workShifts.map(s => [
      s.id,
      s.employeeId,
      s.date,
      s.startTime,
      s.endTime,
      s.totalHours.toFixed(2),
      s.totalPay.toFixed(2),
      s.status
    ]);
    
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    return csv;
  }

  // Subscription management
  subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener());
  }
}

export const employeeStore = new EmployeeStore();
