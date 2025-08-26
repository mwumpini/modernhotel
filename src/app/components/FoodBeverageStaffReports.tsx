'use client';

import React, { useState } from 'react';
import { Card, CardBody, CardHeader, Button, Input, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, Chip, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Select, SelectItem, Divider, Badge, Progress, Tabs, Tab } from "@heroui/react";

interface Staff {
  id: string;
  name: string;
  position: string;
  department: 'kitchen' | 'service' | 'management' | 'bar';
  status: 'active' | 'inactive' | 'on-leave';
  hireDate: Date;
  salary: number;
  performance: number;
  attendance: number;
  shift: 'morning' | 'afternoon' | 'evening' | 'night';
  phone: string;
  email: string;
  emergencyContact: string;
  certifications: string[];
  assignedTables?: string[];
  specializations?: string[];
}

interface Shift {
  id: string;
  staffId: string;
  staffName: string;
  date: Date;
  startTime: string;
  endTime: string;
  status: 'scheduled' | 'in-progress' | 'completed' | 'absent';
  hours: number;
  overtime: number;
  notes: string;
}

interface Performance {
  id: string;
  staffId: string;
  staffName: string;
  month: string;
  year: number;
  ordersHandled: number;
  customerSatisfaction: number;
  efficiency: number;
  attendance: number;
  punctuality: number;
  teamwork: number;
  overallScore: number;
  feedback: string;
}

interface Report {
  id: string;
  title: string;
  type: 'sales' | 'inventory' | 'staff' | 'customer' | 'financial';
  period: string;
  generatedDate: Date;
  status: 'generated' | 'pending' | 'error';
  fileSize: string;
  format: 'pdf' | 'excel' | 'csv';
}

interface Training {
  id: string;
  title: string;
  description: string;
  category: 'food-safety' | 'customer-service' | 'management' | 'technical';
  duration: number;
  instructor: string;
  scheduledDate: Date;
  status: 'scheduled' | 'in-progress' | 'completed' | 'cancelled';
  attendees: string[];
  maxAttendees: number;
}

export default function FoodBeverageStaffReports() {
  const [selectedTab, setSelectedTab] = useState('staff');
  const [isNewStaffModalOpen, setIsNewStaffModalOpen] = useState(false);
  const [isNewTrainingModalOpen, setIsNewTrainingModalOpen] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');

  // Sample data
  const staff: Staff[] = [
    {
      id: '1',
      name: 'Kwame Asante',
      position: 'Head Chef',
      department: 'kitchen',
      status: 'active',
      hireDate: new Date('2022-01-15'),
      salary: 3500,
      performance: 92,
      attendance: 95,
      shift: 'morning',
      phone: '+233 24 123 4567',
      email: 'kwame.asante@hotel.com',
      emergencyContact: '+233 20 987 6543',
      certifications: ['Food Safety', 'Culinary Arts', 'HACCP'],
      specializations: ['Ghanaian Cuisine', 'Grilling', 'Sauces']
    },
    {
      id: '2',
      name: 'Ama Osei',
      position: 'Server',
      department: 'service',
      status: 'active',
      hireDate: new Date('2022-03-20'),
      salary: 1800,
      performance: 88,
      attendance: 92,
      shift: 'evening',
      phone: '+233 20 987 6543',
      email: 'ama.osei@hotel.com',
      emergencyContact: '+233 26 555 1234',
      certifications: ['Customer Service', 'Food Safety'],
      assignedTables: ['T1', 'T2', 'T3']
    },
    {
      id: '3',
      name: 'Kofi Mensah',
      position: 'Bartender',
      department: 'bar',
      status: 'active',
      hireDate: new Date('2021-11-10'),
      salary: 2200,
      performance: 85,
      attendance: 90,
      shift: 'evening',
      phone: '+233 26 555 1234',
      email: 'kofi.mensah@hotel.com',
      emergencyContact: '+233 27 777 8888',
      certifications: ['Bartending', 'Food Safety'],
      specializations: ['Cocktails', 'Local Drinks', 'Wine Service']
    },
    {
      id: '4',
      name: 'Efua Addo',
      position: 'Kitchen Assistant',
      department: 'kitchen',
      status: 'active',
      hireDate: new Date('2023-02-05'),
      salary: 1500,
      performance: 78,
      attendance: 88,
      shift: 'morning',
      phone: '+233 27 777 8888',
      email: 'efua.addo@hotel.com',
      emergencyContact: '+233 24 123 4567',
      certifications: ['Food Safety'],
      specializations: ['Prep Work', 'Cleaning', 'Inventory']
    },
    {
      id: '5',
      name: 'Yaw Boateng',
      position: 'F&B Manager',
      department: 'management',
      status: 'active',
      hireDate: new Date('2020-08-12'),
      salary: 4500,
      performance: 95,
      attendance: 98,
      shift: 'morning',
      phone: '+233 28 999 0000',
      email: 'yaw.boateng@hotel.com',
      emergencyContact: '+233 29 111 2222',
      certifications: ['Management', 'Food Safety', 'HACCP', 'Leadership'],
      specializations: ['Operations', 'Staff Management', 'Financial Planning']
    }
  ];

  const shifts: Shift[] = [
    {
      id: '1',
      staffId: '1',
      staffName: 'Kwame Asante',
      date: new Date(),
      startTime: '06:00',
      endTime: '14:00',
      status: 'completed',
      hours: 8,
      overtime: 0,
      notes: 'Prepared breakfast and lunch menus'
    },
    {
      id: '2',
      staffId: '2',
      staffName: 'Ama Osei',
      date: new Date(),
      startTime: '16:00',
      endTime: '00:00',
      status: 'in-progress',
      hours: 8,
      overtime: 0,
      notes: 'Evening service shift'
    },
    {
      id: '3',
      staffId: '3',
      staffName: 'Kofi Mensah',
      date: new Date(),
      startTime: '14:00',
      endTime: '22:00',
      status: 'scheduled',
      hours: 8,
      overtime: 0,
      notes: 'Bar service'
    }
  ];

  const performances: Performance[] = [
    {
      id: '1',
      staffId: '1',
      staffName: 'Kwame Asante',
      month: 'December',
      year: 2024,
      ordersHandled: 245,
      customerSatisfaction: 94,
      efficiency: 92,
      attendance: 95,
      punctuality: 98,
      teamwork: 90,
      overallScore: 92,
      feedback: 'Excellent leadership in kitchen operations. Consistently maintains high quality standards.'
    },
    {
      id: '2',
      staffId: '2',
      staffName: 'Ama Osei',
      month: 'December',
      year: 2024,
      ordersHandled: 180,
      customerSatisfaction: 88,
      efficiency: 85,
      attendance: 92,
      punctuality: 90,
      teamwork: 88,
      overallScore: 88,
      feedback: 'Good customer service skills. Needs improvement in order accuracy.'
    }
  ];

  const reports: Report[] = [
    {
      id: '1',
      title: 'December 2024 Sales Report',
      type: 'sales',
      period: 'December 2024',
      generatedDate: new Date(),
      status: 'generated',
      fileSize: '2.3 MB',
      format: 'pdf'
    },
    {
      id: '2',
      title: 'Inventory Status Report',
      type: 'inventory',
      period: 'Current Month',
      generatedDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
      status: 'generated',
      fileSize: '1.8 MB',
      format: 'excel'
    },
    {
      id: '3',
      title: 'Staff Performance Report',
      type: 'staff',
      period: 'Q4 2024',
      generatedDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      status: 'generated',
      fileSize: '3.1 MB',
      format: 'pdf'
    },
    {
      id: '4',
      title: 'Customer Satisfaction Report',
      type: 'customer',
      period: 'December 2024',
      generatedDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      status: 'generated',
      fileSize: '1.5 MB',
      format: 'excel'
    }
  ];

  const trainings: Training[] = [
    {
      id: '1',
      title: 'Food Safety & Hygiene Training',
      description: 'Comprehensive training on food safety standards and hygiene practices',
      category: 'food-safety',
      duration: 4,
      instructor: 'Dr. Sarah Johnson',
      scheduledDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      status: 'scheduled',
      attendees: ['1', '2', '3', '4'],
      maxAttendees: 15
    },
    {
      id: '2',
      title: 'Customer Service Excellence',
      description: 'Advanced customer service techniques and conflict resolution',
      category: 'customer-service',
      duration: 3,
      instructor: 'Ama Serwaa',
      scheduledDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      status: 'scheduled',
      attendees: ['2', '3'],
      maxAttendees: 10
    },
    {
      id: '3',
      title: 'Ghanaian Cuisine Masterclass',
      description: 'Advanced techniques in traditional Ghanaian cooking',
      category: 'technical',
      duration: 6,
      instructor: 'Chef Kwame Asante',
      scheduledDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      status: 'completed',
      attendees: ['1', '4'],
      maxAttendees: 8
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'success';
      case 'inactive': return 'danger';
      case 'on-leave': return 'warning';
      default: return 'default';
    }
  };

  const getShiftStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return 'primary';
      case 'in-progress': return 'warning';
      case 'completed': return 'success';
      case 'absent': return 'danger';
      default: return 'default';
    }
  };

  const getReportTypeColor = (type: string) => {
    switch (type) {
      case 'sales': return 'success';
      case 'inventory': return 'warning';
      case 'staff': return 'primary';
      case 'customer': return 'secondary';
      case 'financial': return 'danger';
      default: return 'default';
    }
  };

  const getTrainingCategoryColor = (category: string) => {
    switch (category) {
      case 'food-safety': return 'danger';
      case 'customer-service': return 'primary';
      case 'management': return 'success';
      case 'technical': return 'warning';
      default: return 'default';
    }
  };

  const getPerformanceColor = (score: number) => {
    if (score >= 90) return 'success';
    if (score >= 80) return 'primary';
    if (score >= 70) return 'warning';
    return 'danger';
  };

  const filteredStaff = selectedDepartment === 'all' 
    ? staff 
    : staff.filter(member => member.department === selectedDepartment);

  const filteredStaffByStatus = selectedStatus === 'all' 
    ? filteredStaff 
    : filteredStaff.filter(member => member.status === selectedStatus);

  const getTotalSalary = () => {
    return staff.reduce((total, member) => total + member.salary, 0);
  };

  const getAveragePerformance = () => {
    return staff.reduce((total, member) => total + member.performance, 0) / staff.length;
  };

  const getActiveStaffCount = () => {
    return staff.filter(member => member.status === 'active').length;
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-ghana-black">🍽️ Food & Beverage - Staff & Reports</h2>
          <p className="text-gray-600">Manage staff, shifts, performance, training, and reports</p>
        </div>
        <div className="flex gap-3">
          <Button 
            color="primary" 
            className="bg-ghana-green text-white"
            onClick={() => setIsNewStaffModalOpen(true)}
          >
            + Add Staff
          </Button>
          <Button 
            color="secondary" 
            className="bg-ghana-gold text-white"
            onClick={() => setIsNewTrainingModalOpen(true)}
          >
            + Schedule Training
          </Button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card className="border-0 shadow-lg">
          <CardBody className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Staff</p>
                <p className="text-2xl font-bold text-ghana-black">{staff.length}</p>
                <p className="text-sm text-green-600">{getActiveStaffCount()} active</p>
              </div>
              <div className="text-3xl">👥</div>
            </div>
          </CardBody>
        </Card>
        
        <Card className="border-0 shadow-lg">
          <CardBody className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Monthly Salary</p>
                <p className="text-2xl font-bold text-ghana-black">₵{getTotalSalary().toLocaleString()}</p>
                <p className="text-sm text-blue-600">Total payroll</p>
              </div>
              <div className="text-3xl">💰</div>
            </div>
          </CardBody>
        </Card>
        
        <Card className="border-0 shadow-lg">
          <CardBody className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Avg Performance</p>
                <p className="text-2xl font-bold text-ghana-black">{getAveragePerformance().toFixed(1)}%</p>
                <p className="text-sm text-green-600">+2.5% from last month</p>
              </div>
              <div className="text-3xl">📈</div>
            </div>
          </CardBody>
        </Card>
        
        <Card className="border-0 shadow-lg">
          <CardBody className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Today's Shifts</p>
                <p className="text-2xl font-bold text-ghana-black">{shifts.length}</p>
                <p className="text-sm text-blue-600">{shifts.filter(s => s.status === 'in-progress').length} active</p>
              </div>
              <div className="text-3xl">⏰</div>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Card className="border-0 shadow-lg">
        <CardBody className="p-0">
          <Tabs 
            selectedKey={selectedTab} 
            onSelectionChange={(key) => setSelectedTab(key as string)}
            className="w-full"
          >
            <Tab key="staff" title="👥 Staff Management">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex gap-4">
                    <Select
                      label="Filter by Department"
                      placeholder="All Departments"
                      value={selectedDepartment}
                      onChange={(e) => setSelectedDepartment(e.target.value)}
                      className="w-48"
                    >
                      <SelectItem key="all" value="all">All Departments</SelectItem>
                      <SelectItem key="kitchen" value="kitchen">Kitchen</SelectItem>
                      <SelectItem key="service" value="service">Service</SelectItem>
                      <SelectItem key="bar" value="bar">Bar</SelectItem>
                      <SelectItem key="management" value="management">Management</SelectItem>
                    </Select>
                    <Select
                      label="Filter by Status"
                      placeholder="All Status"
                      value={selectedStatus}
                      onChange={(e) => setSelectedStatus(e.target.value)}
                      className="w-48"
                    >
                      <SelectItem key="all" value="all">All Status</SelectItem>
                      <SelectItem key="active" value="active">Active</SelectItem>
                      <SelectItem key="inactive" value="inactive">Inactive</SelectItem>
                      <SelectItem key="on-leave" value="on-leave">On Leave</SelectItem>
                    </Select>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredStaffByStatus.map((member) => (
                    <Card key={member.id} className="border border-gray-200 hover:border-ghana-green transition-colors">
                      <CardBody className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-semibold text-ghana-black">{member.name}</h4>
                          <Chip color={getStatusColor(member.status)} size="sm">
                            {member.status.charAt(0).toUpperCase() + member.status.slice(1)}
                          </Chip>
                        </div>
                        
                        <div className="space-y-2 mb-3">
                          <div className="text-sm">
                            <span className="font-medium">Position:</span> {member.position}
                          </div>
                          <div className="text-sm">
                            <span className="font-medium">Department:</span> 
                            <Badge color="primary" variant="flat" className="ml-1">{member.department}</Badge>
                          </div>
                          <div className="text-sm">
                            <span className="font-medium">Shift:</span> 
                            <Badge color="secondary" variant="flat" className="ml-1">{member.shift}</Badge>
                          </div>
                          <div className="text-sm">
                            <span className="font-medium">Salary:</span> ₵{member.salary.toLocaleString()}
                          </div>
                          <div className="text-sm">
                            <span className="font-medium">Hired:</span> {member.hireDate.toLocaleDateString()}
                          </div>
                        </div>
                        
                        <div className="mb-3">
                          <div className="flex items-center justify-between text-sm mb-1">
                            <span>Performance:</span>
                            <span>{member.performance}%</span>
                          </div>
                          <Progress 
                            value={member.performance} 
                            color={getPerformanceColor(member.performance)}
                            className="w-full"
                          />
                        </div>
                        
                        <div className="mb-3">
                          <div className="flex items-center justify-between text-sm mb-1">
                            <span>Attendance:</span>
                            <span>{member.attendance}%</span>
                          </div>
                          <Progress 
                            value={member.attendance} 
                            color={member.attendance >= 90 ? 'success' : 'warning'}
                            className="w-full"
                          />
                        </div>
                        
                        <div className="mb-3">
                          <p className="text-sm font-medium text-gray-700 mb-1">Certifications:</p>
                          <div className="flex flex-wrap gap-1">
                            {member.certifications.slice(0, 2).map((cert, index) => (
                              <Chip key={index} size="sm" variant="flat" color="secondary">
                                {cert}
                              </Chip>
                            ))}
                            {member.certifications.length > 2 && (
                              <Chip size="sm" variant="flat" color="default">
                                +{member.certifications.length - 2} more
                              </Chip>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex gap-2">
                          <Button size="sm" color="primary" variant="flat">View Details</Button>
                          <Button size="sm" color="success" variant="flat">Edit</Button>
                          <Button size="sm" color="secondary" variant="flat">Schedule</Button>
                        </div>
                      </CardBody>
                    </Card>
                  ))}
                </div>
              </div>
            </Tab>

            <Tab key="shifts" title="⏰ Shift Management">
              <div className="p-6">
                <Table aria-label="Shifts table">
                  <TableHeader>
                    <TableColumn>STAFF</TableColumn>
                    <TableColumn>DATE</TableColumn>
                    <TableColumn>TIME</TableColumn>
                    <TableColumn>HOURS</TableColumn>
                    <TableColumn>STATUS</TableColumn>
                    <TableColumn>OVERTIME</TableColumn>
                    <TableColumn>NOTES</TableColumn>
                    <TableColumn>ACTIONS</TableColumn>
                  </TableHeader>
                  <TableBody>
                    {shifts.map((shift) => (
                      <TableRow key={shift.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium text-ghana-black">{shift.staffName}</p>
                            <p className="text-sm text-gray-600">ID: {shift.staffId}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {shift.date.toLocaleDateString()}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <p className="font-medium">{shift.startTime} - {shift.endTime}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <p className="font-medium">{shift.hours}h</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Chip color={getShiftStatusColor(shift.status)} size="sm">
                            {shift.status.charAt(0).toUpperCase() + shift.status.slice(1)}
                          </Chip>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {shift.overtime > 0 ? `${shift.overtime}h` : '0h'}
                          </div>
                        </TableCell>
                        <TableCell>
                          <p className="text-sm text-gray-600 max-w-xs truncate">
                            {shift.notes}
                          </p>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button size="sm" color="primary" variant="flat">Edit</Button>
                            <Button size="sm" color="success" variant="flat">Update</Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Tab>

            <Tab key="performance" title="📊 Performance Management">
              <div className="p-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {performances.map((perf) => (
                    <Card key={perf.id} className="border border-gray-200">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <h3 className="text-lg font-semibold text-ghana-black">{perf.staffName}</h3>
                          <Chip color={getPerformanceColor(perf.overallScore)} size="sm">
                            {perf.overallScore}%
                          </Chip>
                        </div>
                        <p className="text-sm text-gray-600">{perf.month} {perf.year}</p>
                      </CardHeader>
                      <CardBody>
                        <div className="space-y-3">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-sm font-medium text-gray-700">Orders Handled</p>
                              <p className="text-lg font-bold text-ghana-black">{perf.ordersHandled}</p>
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-700">Customer Satisfaction</p>
                              <p className="text-lg font-bold text-ghana-black">{perf.customerSatisfaction}%</p>
                            </div>
                          </div>
                          
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                              <span>Efficiency:</span>
                              <span>{perf.efficiency}%</span>
                            </div>
                            <Progress value={perf.efficiency} color="success" className="w-full" />
                          </div>
                          
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                              <span>Attendance:</span>
                              <span>{perf.attendance}%</span>
                            </div>
                            <Progress value={perf.attendance} color="primary" className="w-full" />
                          </div>
                          
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                              <span>Punctuality:</span>
                              <span>{perf.punctuality}%</span>
                            </div>
                            <Progress value={perf.punctuality} color="secondary" className="w-full" />
                          </div>
                          
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                              <span>Teamwork:</span>
                              <span>{perf.teamwork}%</span>
                            </div>
                            <Progress value={perf.teamwork} color="warning" className="w-full" />
                          </div>
                          
                          <div className="mt-4 p-3 bg-gray-50 rounded">
                            <p className="text-sm text-gray-700">{perf.feedback}</p>
                          </div>
                          
                          <div className="flex gap-2">
                            <Button size="sm" color="primary" variant="flat">View Details</Button>
                            <Button size="sm" color="success" variant="flat">Edit Review</Button>
                          </div>
                        </div>
                      </CardBody>
                    </Card>
                  ))}
                </div>
              </div>
            </Tab>

            <Tab key="training" title="🎓 Training Management">
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {trainings.map((training) => (
                    <Card key={training.id} className="border border-gray-200 hover:border-ghana-green transition-colors">
                      <CardBody className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-semibold text-ghana-black">{training.title}</h4>
                          <Chip color={getTrainingCategoryColor(training.category)} size="sm">
                            {training.category.replace('-', ' ').toUpperCase()}
                          </Chip>
                        </div>
                        
                        <p className="text-sm text-gray-600 mb-3">{training.description}</p>
                        
                        <div className="space-y-2 mb-3">
                          <div className="flex items-center justify-between text-sm">
                            <span>Duration:</span>
                            <span className="font-medium">{training.duration}h</span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span>Instructor:</span>
                            <span className="font-medium">{training.instructor}</span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span>Date:</span>
                            <span className="font-medium">{training.scheduledDate.toLocaleDateString()}</span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span>Attendees:</span>
                            <span className="font-medium">{training.attendees.length}/{training.maxAttendees}</span>
                          </div>
                        </div>
                        
                        <div className="mb-3">
                          <Chip color={getStatusColor(training.status)} size="sm" className="mb-2">
                            {training.status.charAt(0).toUpperCase() + training.status.slice(1)}
                          </Chip>
                        </div>
                        
                        <div className="flex gap-2">
                          <Button size="sm" color="primary" variant="flat">View Details</Button>
                          <Button size="sm" color="success" variant="flat">Manage</Button>
                        </div>
                      </CardBody>
                    </Card>
                  ))}
                </div>
              </div>
            </Tab>

            <Tab key="reports" title="📋 Reports">
              <div className="p-6">
                <Table aria-label="Reports table">
                  <TableHeader>
                    <TableColumn>REPORT</TableColumn>
                    <TableColumn>TYPE</TableColumn>
                    <TableColumn>PERIOD</TableColumn>
                    <TableColumn>GENERATED</TableColumn>
                    <TableColumn>STATUS</TableColumn>
                    <TableColumn>FILE SIZE</TableColumn>
                    <TableColumn>FORMAT</TableColumn>
                    <TableColumn>ACTIONS</TableColumn>
                  </TableHeader>
                  <TableBody>
                    {reports.map((report) => (
                      <TableRow key={report.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium text-ghana-black">{report.title}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Chip color={getReportTypeColor(report.type)} size="sm">
                            {report.type.charAt(0).toUpperCase() + report.type.slice(1)}
                          </Chip>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {report.period}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {report.generatedDate.toLocaleDateString()}
                            <p className="text-gray-500">{report.generatedDate.toLocaleTimeString()}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Chip color={report.status === 'generated' ? 'success' : 'warning'} size="sm">
                            {report.status.charAt(0).toUpperCase() + report.status.slice(1)}
                          </Chip>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {report.fileSize}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge color="primary" variant="flat">{report.format.toUpperCase()}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button size="sm" color="primary" variant="flat">Download</Button>
                            <Button size="sm" color="success" variant="flat">Share</Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Tab>
          </Tabs>
        </CardBody>
      </Card>

      {/* New Staff Modal */}
      <Modal isOpen={isNewStaffModalOpen} onClose={() => setIsNewStaffModalOpen(false)} size="2xl">
        <ModalContent>
          <ModalHeader>Add New Staff Member</ModalHeader>
          <ModalBody>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input label="Full Name" placeholder="Enter full name" />
                <Select label="Position" placeholder="Select position">
                  <SelectItem key="head-chef" value="head-chef">Head Chef</SelectItem>
                  <SelectItem key="chef" value="chef">Chef</SelectItem>
                  <SelectItem key="kitchen-assistant" value="kitchen-assistant">Kitchen Assistant</SelectItem>
                  <SelectItem key="server" value="server">Server</SelectItem>
                  <SelectItem key="bartender" value="bartender">Bartender</SelectItem>
                  <SelectItem key="manager" value="manager">Manager</SelectItem>
                </Select>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Select label="Department" placeholder="Select department">
                  <SelectItem key="kitchen" value="kitchen">Kitchen</SelectItem>
                  <SelectItem key="service" value="service">Service</SelectItem>
                  <SelectItem key="bar" value="bar">Bar</SelectItem>
                  <SelectItem key="management" value="management">Management</SelectItem>
                </Select>
                <Select label="Shift" placeholder="Select shift">
                  <SelectItem key="morning" value="morning">Morning</SelectItem>
                  <SelectItem key="afternoon" value="afternoon">Afternoon</SelectItem>
                  <SelectItem key="evening" value="evening">Evening</SelectItem>
                  <SelectItem key="night" value="night">Night</SelectItem>
                </Select>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input label="Phone Number" placeholder="Enter phone number" />
                <Input label="Email" placeholder="Enter email address" />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input label="Salary (₵)" type="number" placeholder="0" />
                <Input label="Emergency Contact" placeholder="Emergency contact number" />
              </div>
              
              <Input label="Certifications" placeholder="e.g., Food Safety, Culinary Arts" />
            </div>
          </ModalBody>
          <ModalFooter>
            <Button color="danger" variant="light" onPress={() => setIsNewStaffModalOpen(false)}>
              Cancel
            </Button>
            <Button color="primary" className="bg-ghana-green text-white" onPress={() => setIsNewStaffModalOpen(false)}>
              Add Staff Member
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* New Training Modal */}
      <Modal isOpen={isNewTrainingModalOpen} onClose={() => setIsNewTrainingModalOpen(false)} size="2xl">
        <ModalContent>
          <ModalHeader>Schedule New Training</ModalHeader>
          <ModalBody>
            <div className="space-y-4">
              <Input label="Training Title" placeholder="Enter training title" />
              
              <Input label="Description" placeholder="Enter training description" />
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Select label="Category" placeholder="Select category">
                  <SelectItem key="food-safety" value="food-safety">Food Safety</SelectItem>
                  <SelectItem key="customer-service" value="customer-service">Customer Service</SelectItem>
                  <SelectItem key="management" value="management">Management</SelectItem>
                  <SelectItem key="technical" value="technical">Technical</SelectItem>
                </Select>
                <Input label="Duration (hours)" type="number" placeholder="4" />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input label="Instructor" placeholder="Enter instructor name" />
                <Input label="Scheduled Date" type="date" />
              </div>
              
              <Input label="Maximum Attendees" type="number" placeholder="15" />
              
              <Select label="Staff Members" placeholder="Select staff members" selectionMode="multiple">
                {staff.map((member) => (
                  <SelectItem key={member.id} value={member.name}>
                    {member.name} - {member.position}
                  </SelectItem>
                ))}
              </Select>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button color="danger" variant="light" onPress={() => setIsNewTrainingModalOpen(false)}>
              Cancel
            </Button>
            <Button color="primary" className="bg-ghana-green text-white" onPress={() => setIsNewTrainingModalOpen(false)}>
              Schedule Training
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
