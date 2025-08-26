'use client';

import React, { useState, useEffect } from 'react';
import { 
  Card, CardBody, CardHeader, Button, Badge, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, 
  Input, Select, SelectItem, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Chip, Textarea,
  Tabs, Tab, Divider, Progress, Avatar, useDisclosure, Tooltip, Switch, Alert, DatePicker
} from '@heroui/react';
import { useSettingsStore } from '../lib/settings/store';
import { trackEvent } from '../lib/analytics/trackEvent';

interface Employee {
  id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  department: string;
  position: string;
  hireDate: string;
  salary: number;
  status: 'active' | 'inactive' | 'terminated' | 'on-leave';
  manager?: string;
  emergencyContact: string;
  emergencyPhone: string;
  bankAccount: string;
  bankName: string;
  ssnitNumber: string;
  taxId: string;
  photo?: string;
}

interface PayrollRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  period: string;
  basicSalary: number;
  allowances: number;
  deductions: number;
  netSalary: number;
  ssnitContribution: number;
  taxAmount: number;
  status: 'pending' | 'processed' | 'paid';
  paymentDate?: string;
  paymentMethod: string;
}

interface LeaveRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  leaveType: 'annual' | 'sick' | 'maternity' | 'paternity' | 'bereavement' | 'other';
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  approvedBy?: string;
  approvedDate?: string;
}

interface PerformanceReview {
  id: string;
  employeeId: string;
  employeeName: string;
  reviewPeriod: string;
  reviewer: string;
  reviewDate: string;
  overallRating: number;
  comments: string;
  goals: string[];
  nextReviewDate: string;
}

export default function HRPayrollManagementDashboard() {
  const [selectedTab, setSelectedTab] = useState('overview');
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [selectedPayroll, setSelectedPayroll] = useState<PayrollRecord | null>(null);
  const [selectedLeave, setSelectedLeave] = useState<LeaveRequest | null>(null);
  const [isEmployeeModalOpen, setIsEmployeeModalOpen] = useState(false);
  const [isPayrollModalOpen, setIsPayrollModalOpen] = useState(false);
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  
  const settings = useSettingsStore();

  // Sample data - in real app, this would come from stores
  const employees: Employee[] = [
    {
      id: '1',
      employeeId: 'EMP001',
      firstName: 'Kwame',
      lastName: 'Mensah',
      email: 'kwame.mensah@hotel.com',
      phone: '+233 24 123 4567',
      department: 'Front Office',
      position: 'Front Desk Manager',
      hireDate: '2023-01-15',
      salary: 3500.00,
      status: 'active',
      manager: 'General Manager',
      emergencyContact: 'Abena Mensah',
      emergencyPhone: '+233 20 987 6543',
      bankAccount: '1234567890',
      bankName: 'Ghana Commercial Bank',
      ssnitNumber: 'SSN123456789',
      taxId: 'TIN123456789'
    },
    {
      id: '2',
      employeeId: 'EMP002',
      firstName: 'Ama',
      lastName: 'Osei',
      email: 'ama.osei@hotel.com',
      phone: '+233 26 234 5678',
      department: 'Housekeeping',
      position: 'Housekeeping Supervisor',
      hireDate: '2023-03-20',
      salary: 2800.00,
      status: 'active',
      manager: 'Operations Manager',
      emergencyContact: 'Kofi Osei',
      emergencyPhone: '+233 24 876 5432',
      bankAccount: '0987654321',
      bankName: 'Ecobank Ghana',
      ssnitNumber: 'SSN987654321',
      taxId: 'TIN987654321'
    },
    {
      id: '3',
      employeeId: 'EMP003',
      firstName: 'Kofi',
      lastName: 'Addo',
      email: 'kofi.addo@hotel.com',
      phone: '+233 20 345 6789',
      department: 'Kitchen',
      position: 'Head Chef',
      hireDate: '2022-11-10',
      salary: 4200.00,
      status: 'active',
      manager: 'F&B Manager',
      emergencyContact: 'Efua Addo',
      emergencyPhone: '+233 26 765 4321',
      bankAccount: '1122334455',
      bankName: 'Standard Chartered Bank',
      ssnitNumber: 'SSN112233445',
      taxId: 'TIN112233445'
    }
  ];

  const payrollRecords: PayrollRecord[] = [
    {
      id: '1',
      employeeId: 'EMP001',
      employeeName: 'Kwame Mensah',
      period: 'January 2024',
      basicSalary: 3500.00,
      allowances: 500.00,
      deductions: 200.00,
      netSalary: 3800.00,
      ssnitContribution: 350.00,
      taxAmount: 450.00,
      status: 'paid',
      paymentDate: '2024-01-31',
      paymentMethod: 'Bank Transfer'
    },
    {
      id: '2',
      employeeId: 'EMP002',
      employeeName: 'Ama Osei',
      period: 'January 2024',
      basicSalary: 2800.00,
      allowances: 300.00,
      deductions: 150.00,
      netSalary: 2950.00,
      ssnitContribution: 280.00,
      taxAmount: 320.00,
      status: 'paid',
      paymentDate: '2024-01-31',
      paymentMethod: 'Bank Transfer'
    }
  ];

  const leaveRequests: LeaveRequest[] = [
    {
      id: '1',
      employeeId: 'EMP001',
      employeeName: 'Kwame Mensah',
      leaveType: 'annual',
      startDate: '2024-02-15',
      endDate: '2024-02-20',
      days: 5,
      reason: 'Family vacation',
      status: 'approved',
      approvedBy: 'General Manager',
      approvedDate: '2024-01-20'
    },
    {
      id: '2',
      employeeId: 'EMP002',
      employeeName: 'Ama Osei',
      leaveType: 'sick',
      startDate: '2024-01-25',
      endDate: '2024-01-27',
      days: 2,
      reason: 'Medical appointment',
      status: 'approved',
      approvedBy: 'Operations Manager',
      approvedDate: '2024-01-24'
    }
  ];

  const performanceReviews: PerformanceReview[] = [
    {
      id: '1',
      employeeId: 'EMP001',
      employeeName: 'Kwame Mensah',
      reviewPeriod: 'Q4 2023',
      reviewer: 'General Manager',
      reviewDate: '2023-12-15',
      overallRating: 4.5,
      comments: 'Excellent performance in managing front desk operations. Great customer service skills.',
      goals: ['Improve team training', 'Implement new check-in procedures', 'Reduce check-in time by 20%'],
      nextReviewDate: '2024-03-15'
    }
  ];

  // Calculate HR metrics
  const totalEmployees = employees.length;
  const activeEmployees = employees.filter(e => e.status === 'active').length;
  const totalSalary = employees.reduce((sum, e) => sum + e.salary, 0);
  const averageSalary = totalSalary / totalEmployees;
  const pendingLeaveRequests = leaveRequests.filter(l => l.status === 'pending').length;
  const totalPayroll = payrollRecords.reduce((sum, p) => sum + p.netSalary, 0);

  const handleEmployeeStatusToggle = (employeeId: string, status: Employee['status']) => {
    trackEvent('HR.EmployeeStatusChanged', { employeeId, status });
    // In real app, update the employee status in the store
  };

  const renderOverview = () => (
    <div className="space-y-6">
      {/* HR Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="border-0 shadow-lg">
          <CardBody className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Employees</p>
                <p className="text-2xl font-bold text-ghana-black">{totalEmployees}</p>
                <p className="text-sm text-green-600">+2 this month</p>
              </div>
              <div className="text-3xl">👥</div>
            </div>
          </CardBody>
        </Card>
        
        <Card className="border-0 shadow-lg">
          <CardBody className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Staff</p>
                <p className="text-2xl font-bold text-ghana-black">{activeEmployees}</p>
                <p className="text-sm text-blue-600">{((activeEmployees / totalEmployees) * 100).toFixed(1)}%</p>
              </div>
              <div className="text-3xl">✅</div>
            </div>
          </CardBody>
        </Card>
        
        <Card className="border-0 shadow-lg">
          <CardBody className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Payroll</p>
                <p className="text-2xl font-bold text-ghana-black">₵{totalPayroll.toLocaleString()}</p>
                <p className="text-sm text-green-600">This month</p>
              </div>
              <div className="text-3xl">💰</div>
            </div>
          </CardBody>
        </Card>
        
        <Card className="border-0 shadow-lg">
          <CardBody className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Pending Leave</p>
                <p className="text-2xl font-bold text-ghana-black">{pendingLeaveRequests}</p>
                <p className="text-sm text-orange-600">Requires approval</p>
              </div>
              <div className="text-3xl">📅</div>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-3">
          <h3 className="text-xl font-semibold text-ghana-black">🚀 Quick Actions</h3>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Button
              variant="flat"
              className="bg-ghana-green text-white h-20 flex flex-col items-center justify-center space-y-2"
              size="lg"
              onClick={() => setIsEmployeeModalOpen(true)}
            >
              <span className="text-2xl">👤</span>
              <span className="text-sm font-medium">Add Employee</span>
            </Button>
            <Button
              variant="flat"
              className="bg-ghana-gold text-white h-20 flex flex-col items-center justify-center space-y-2"
              size="lg"
              onClick={() => setIsPayrollModalOpen(true)}
            >
              <span className="text-2xl">💰</span>
              <span className="text-sm font-medium">Process Payroll</span>
            </Button>
            <Button
              variant="flat"
              className="bg-blue-500 text-white h-20 flex flex-col items-center justify-center space-y-2"
              size="lg"
              onClick={() => setIsLeaveModalOpen(true)}
            >
              <span className="text-2xl">📅</span>
              <span className="text-sm font-medium">Leave Request</span>
            </Button>
            <Button
              variant="flat"
              className="bg-purple-500 text-white h-20 flex flex-col items-center justify-center space-y-2"
              size="lg"
            >
              <span className="text-2xl">📊</span>
              <span className="text-sm font-medium">Performance Review</span>
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Recent Activities */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Leave Requests */}
        <Card className="border-0 shadow-lg">
          <CardHeader className="pb-3">
            <h3 className="text-xl font-semibold text-ghana-black">📅 Recent Leave Requests</h3>
          </CardHeader>
          <CardBody>
            <div className="space-y-3">
              {leaveRequests.slice(0, 3).map((request) => (
                <div key={request.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <Avatar 
                      name={request.employeeName} 
                      size="sm"
                      className="bg-ghana-green text-white"
                    />
                    <div>
                      <div className="font-medium">{request.employeeName}</div>
                      <div className="text-sm text-gray-600">
                        {request.leaveType} • {request.days} days
                      </div>
                    </div>
                  </div>
                  <Badge 
                    color={
                      request.status === 'approved' ? 'success' :
                      request.status === 'rejected' ? 'danger' :
                      'warning'
                    } 
                    size="sm"
                  >
                    {request.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>

        {/* Recent Payroll */}
        <Card className="border-0 shadow-lg">
          <CardHeader className="pb-3">
            <h3 className="text-xl font-semibold text-ghana-black">💰 Recent Payroll</h3>
          </CardHeader>
          <CardBody>
            <div className="space-y-3">
              {payrollRecords.slice(0, 3).map((record) => (
                <div key={record.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <Avatar 
                      name={record.employeeName} 
                      size="sm"
                      className="bg-ghana-gold text-white"
                    />
                    <div>
                      <div className="font-medium">{record.employeeName}</div>
                      <div className="text-sm text-gray-600">{record.period}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">₵{record.netSalary.toLocaleString()}</div>
                    <Badge 
                      color={
                        record.status === 'paid' ? 'success' :
                        record.status === 'processed' ? 'warning' :
                        'default'
                      } 
                      size="sm"
                    >
                      {record.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );

  const renderEmployeeManagement = () => (
    <div className="space-y-6">
      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold text-ghana-black">👥 Employee Management</h3>
            <Button
              color="primary"
              className="bg-ghana-green text-white"
              variant="flat"
              onClick={() => setIsEmployeeModalOpen(true)}
            >
              ➕ Add Employee
            </Button>
          </div>
        </CardHeader>
        <CardBody>
          <Table aria-label="Employees table">
            <TableHeader>
              <TableColumn>Employee ID</TableColumn>
              <TableColumn>Name</TableColumn>
              <TableColumn>Department</TableColumn>
              <TableColumn>Position</TableColumn>
              <TableColumn>Salary</TableColumn>
              <TableColumn>Status</TableColumn>
              <TableColumn>Actions</TableColumn>
            </TableHeader>
            <TableBody>
              {employees.map((employee) => (
                <TableRow key={employee.id}>
                  <TableCell className="font-mono font-semibold">{employee.employeeId}</TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-3">
                      <Avatar 
                        name={`${employee.firstName} ${employee.lastName}`} 
                        size="sm"
                        className="bg-ghana-green text-white"
                      />
                      <div>
                        <div className="font-semibold">{employee.firstName} {employee.lastName}</div>
                        <div className="text-sm text-gray-500">{employee.email}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Chip color="primary" size="sm" variant="flat">
                      {employee.department}
                    </Chip>
                  </TableCell>
                  <TableCell>{employee.position}</TableCell>
                  <TableCell className="font-semibold">
                    ₵{employee.salary.toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <Badge 
                      color={
                        employee.status === 'active' ? 'success' :
                        employee.status === 'inactive' ? 'warning' :
                        employee.status === 'terminated' ? 'danger' :
                        'default'
                      } 
                      size="sm"
                    >
                      {employee.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button size="sm" variant="flat" color="primary">
                        Edit
                      </Button>
                      <Button size="sm" variant="flat" color="secondary">
                        View
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardBody>
      </Card>
    </div>
  );

  const renderPayrollManagement = () => (
    <div className="space-y-6">
      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold text-ghana-black">💰 Payroll Management</h3>
            <Button
              color="primary"
              className="bg-ghana-green text-white"
              variant="flat"
              onClick={() => setIsPayrollModalOpen(true)}
            >
              💰 Process Payroll
            </Button>
          </div>
        </CardHeader>
        <CardBody>
          <Table aria-label="Payroll records table">
            <TableHeader>
              <TableColumn>Employee</TableColumn>
              <TableColumn>Period</TableColumn>
              <TableColumn>Basic Salary</TableColumn>
              <TableColumn>Allowances</TableColumn>
              <TableColumn>Deductions</TableColumn>
              <TableColumn>Net Salary</TableColumn>
              <TableColumn>Status</TableColumn>
              <TableColumn>Actions</TableColumn>
            </TableHeader>
            <TableBody>
              {payrollRecords.map((record) => (
                <TableRow key={record.id}>
                  <TableCell className="font-semibold">{record.employeeName}</TableCell>
                  <TableCell>{record.period}</TableCell>
                  <TableCell>₵{record.basicSalary.toLocaleString()}</TableCell>
                  <TableCell className="text-green-600">+₵{record.allowances.toLocaleString()}</TableCell>
                  <TableCell className="text-red-600">-₵{record.deductions.toLocaleString()}</TableCell>
                  <TableCell className="font-bold">₵{record.netSalary.toLocaleString()}</TableCell>
                  <TableCell>
                    <Badge 
                      color={
                        record.status === 'paid' ? 'success' :
                        record.status === 'processed' ? 'warning' :
                        'default'
                      } 
                      size="sm"
                    >
                      {record.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button size="sm" variant="flat" color="primary" onClick={() => {
                        setSelectedPayroll(record);
                        setIsPayrollModalOpen(true);
                      }}>
                        View
                      </Button>
                      {record.status === 'pending' && (
                        <Button size="sm" variant="flat" color="success">
                          Process
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardBody>
      </Card>
    </div>
  );

  const renderLeaveManagement = () => (
    <div className="space-y-6">
      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold text-ghana-black">📅 Leave Management</h3>
            <Button
              color="primary"
              className="bg-ghana-green text-white"
              variant="flat"
              onClick={() => setIsLeaveModalOpen(true)}
            >
              📅 New Leave Request
            </Button>
          </div>
        </CardHeader>
        <CardBody>
          <Table aria-label="Leave requests table">
            <TableHeader>
              <TableColumn>Employee</TableColumn>
              <TableColumn>Leave Type</TableColumn>
              <TableColumn>Duration</TableColumn>
              <TableColumn>Reason</TableColumn>
              <TableColumn>Status</TableColumn>
              <TableColumn>Actions</TableColumn>
            </TableHeader>
            <TableBody>
              {leaveRequests.map((request) => (
                <TableRow key={request.id}>
                  <TableCell className="font-semibold">{request.employeeName}</TableCell>
                  <TableCell>
                    <Badge 
                      color={
                        request.leaveType === 'annual' ? 'success' :
                        request.leaveType === 'sick' ? 'warning' :
                        request.leaveType === 'maternity' ? 'primary' :
                        'default'
                      } 
                      size="sm"
                    >
                      {request.leaveType}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <div>{new Date(request.startDate).toLocaleDateString()}</div>
                      <div className="text-gray-500">to {new Date(request.endDate).toLocaleDateString()}</div>
                      <div className="font-medium">{request.days} days</div>
                    </div>
                  </TableCell>
                  <TableCell className="max-w-xs truncate">{request.reason}</TableCell>
                  <TableCell>
                    <Badge 
                      color={
                        request.status === 'approved' ? 'success' :
                        request.status === 'rejected' ? 'danger' :
                        'warning'
                      } 
                      size="sm"
                    >
                      {request.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button size="sm" variant="flat" color="primary" onClick={() => {
                        setSelectedLeave(request);
                        setIsLeaveModalOpen(true);
                      }}>
                        View
                      </Button>
                      {request.status === 'pending' && (
                        <>
                          <Button size="sm" variant="flat" color="success">
                            Approve
                          </Button>
                          <Button size="sm" variant="flat" color="danger">
                            Reject
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardBody>
      </Card>
    </div>
  );

  const renderCompliance = () => (
    <div className="space-y-6">
      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-3">
          <h3 className="text-xl font-semibold text-ghana-black">⚖️ Ghana Tax & Compliance</h3>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* SSNIT Compliance */}
            <Card className="border border-gray-200">
              <CardHeader className="pb-2">
                <h4 className="text-lg font-semibold">SSNIT Compliance</h4>
                <p className="text-sm text-gray-600">Social Security Contributions</p>
              </CardHeader>
              <CardBody>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm">Employee Rate:</span>
                    <span className="font-semibold">5.5%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Employer Rate:</span>
                    <span className="font-semibold">13%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Total Contribution:</span>
                    <span className="font-semibold">18.5%</span>
                  </div>
                  <Divider />
                  <div className="flex justify-between">
                    <span className="font-semibold">Monthly Total:</span>
                    <span className="font-bold text-ghana-green">
                      ₵{(totalSalary * 0.185).toLocaleString()}
                    </span>
                  </div>
                </div>
              </CardBody>
            </Card>

            {/* Income Tax */}
            <Card className="border border-gray-200">
              <CardHeader className="pb-2">
                <h4 className="text-lg font-semibold">Income Tax</h4>
                <p className="text-sm text-gray-600">PAYE Calculations</p>
              </CardHeader>
              <CardBody>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm">Taxable Income:</span>
                    <span className="font-semibold">₵{totalSalary.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Tax Rate:</span>
                    <span className="font-semibold">Progressive</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Monthly Tax:</span>
                    <span className="font-semibold">₵{(totalSalary * 0.15).toLocaleString()}</span>
                  </div>
                </div>
              </CardBody>
            </Card>

            {/* Leave Entitlements */}
            <Card className="border border-gray-200">
              <CardHeader className="pb-2">
                <h4 className="text-lg font-semibold">Leave Entitlements</h4>
                <p className="text-sm text-gray-600">Ghana Labor Law Compliance</p>
              </CardHeader>
              <CardBody>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm">Annual Leave:</span>
                    <span className="font-semibold">21 days</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Sick Leave:</span>
                    <span className="font-semibold">12 days</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Maternity:</span>
                    <span className="font-semibold">12 weeks</span>
                  </div>
                </div>
              </CardBody>
            </Card>
          </div>
        </CardBody>
      </Card>
    </div>
  );

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-ghana-black">👥 HR & Payroll Management</h1>
          <p className="text-gray-600">Complete employee management with Ghana tax compliance</p>
        </div>
        <div className="flex items-center space-x-2">
          <Badge color="success">System Online</Badge>
          <Badge color="primary">SaaS Ready</Badge>
        </div>
      </div>

      <Tabs 
        selectedKey={selectedTab} 
        onSelectionChange={(key) => setSelectedTab(key as string)}
        className="w-full"
      >
        <Tab key="overview" title="Overview" />
        <Tab key="employees" title="Employee Management" />
        <Tab key="payroll" title="Payroll Management" />
        <Tab key="leave" title="Leave Management" />
        <Tab key="compliance" title="Tax & Compliance" />
      </Tabs>

      <div className="mt-6">
        {selectedTab === 'overview' && renderOverview()}
        {selectedTab === 'employees' && renderEmployeeManagement()}
        {selectedTab === 'payroll' && renderPayrollManagement()}
        {selectedTab === 'leave' && renderLeaveManagement()}
        {selectedTab === 'compliance' && renderCompliance()}
      </div>

      {/* Employee Modal */}
      <Modal isOpen={isEmployeeModalOpen} onClose={() => setIsEmployeeModalOpen(false)} size="4xl">
        <ModalContent>
          <ModalHeader>Add New Employee</ModalHeader>
          <ModalBody>
            <div className="text-center py-8 text-gray-500">
              <p>Employee form will be implemented here</p>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button color="danger" variant="light" onPress={() => setIsEmployeeModalOpen(false)}>
              Cancel
            </Button>
            <Button color="primary" onPress={() => setIsEmployeeModalOpen(false)}>
              Add Employee
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Payroll Modal */}
      <Modal isOpen={isPayrollModalOpen} onClose={() => setIsPayrollModalOpen(false)} size="4xl">
        <ModalContent>
          <ModalHeader>
            {selectedPayroll ? 'View Payroll Record' : 'Process Payroll'}
          </ModalHeader>
          <ModalBody>
            <div className="text-center py-8 text-gray-500">
              <p>Payroll form will be implemented here</p>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button color="danger" variant="light" onPress={() => setIsPayrollModalOpen(false)}>
              Cancel
            </Button>
            <Button color="primary" onPress={() => setIsPayrollModalOpen(false)}>
              {selectedPayroll ? 'Close' : 'Process Payroll'}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Leave Modal */}
      <Modal isOpen={isLeaveModalOpen} onClose={() => setIsLeaveModalOpen(false)} size="2xl">
        <ModalContent>
          <ModalHeader>
            {selectedLeave ? 'View Leave Request' : 'New Leave Request'}
          </ModalHeader>
          <ModalBody>
            <div className="text-center py-8 text-gray-500">
              <p>Leave request form will be implemented here</p>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button color="danger" variant="light" onPress={() => setIsLeaveModalOpen(false)}>
              Cancel
            </Button>
            <Button color="primary" onPress={() => setIsLeaveModalOpen(false)}>
              {selectedLeave ? 'Close' : 'Submit Request'}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
