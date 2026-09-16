'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardBody, Button, Input, Chip, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Select, SelectItem, Badge, Tabs, Tab } from "@heroui/react";
import { getClientTenantSubdomain } from '../lib/api/clientTenant';

function fbHeaders() {
  return { 'Content-Type': 'application/json', 'x-tenant-subdomain': getClientTenantSubdomain() };
}

interface StaffMember {
  id: string;
  name: string;
  position: string;
  department: string;
  status: string;
  employmentType: string;
  hireDate?: string;
  salary: number;
  emergencyContact?: { name: string; relationship: string; phone: string };
  qualifications: Array<{ type: string; title: string; institution?: string; year?: number }>;
}

interface TrainingProgram {
  id: string;
  title: string;
  description: string;
  category: string;
  duration: number;
  instructor: string;
  startDate?: string;
  status: string;
  mandatory: boolean;
  maxParticipants?: number;
  enrolledCount: number;
}

export default function FoodBeverageStaffReports() {
  const [selectedTab, setSelectedTab] = useState('staff');
  const [isNewTrainingModalOpen, setIsNewTrainingModalOpen] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');

  // -------------------------------------------------------------------------
  // Staff — sourced from real HR employee/department/position records,
  // filtered to F&B-relevant departments (same pattern as
  // FoodBeverageRestaurantBar.tsx's Staff tab). Performance scores, attendance
  // percentages, and shift assignments aren't tracked anywhere in the system
  // yet — rather than fabricate them, this view only shows fields that are
  // real: position, department, status, salary, hire date, emergency contact,
  // and qualifications/certifications on file.
  // -------------------------------------------------------------------------
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const reloadStaff = () => {
    Promise.all([
      fetch('/api/hr/employees', { headers: fbHeaders() }).then((r) => (r.ok ? r.json() : { employees: [] })),
      fetch('/api/hr/departments', { headers: fbHeaders() }).then((r) => (r.ok ? r.json() : { departments: [] })),
      fetch('/api/hr/positions', { headers: fbHeaders() }).then((r) => (r.ok ? r.json() : { positions: [] })),
    ]).then(([empData, deptData, posData]) => {
      const allDepartments = deptData.departments || [];
      const positions = posData.positions || [];
      // Kitchen is deliberately excluded — it has its own Staff Management tab
      // (FoodBeverageKitchen.tsx) now, separate from Restaurant & Bar.
      const fbDepartments = allDepartments.filter((d: any) => /food|beverage|restaurant|bar/i.test(d.name || '') && !/kitchen/i.test(d.name || ''));
      const fbDeptIds = new Set(fbDepartments.map((d: any) => d.id));
      setDepartments(fbDepartments);
      const deptById = new Map<string, string>(allDepartments.map((d: any) => [d.id, d.name]));
      const posById = new Map<string, string>(positions.map((p: any) => [p.id, p.title]));
      const employees = (empData.employees || []) as any[];
      setStaff(
        employees
          .filter((e) => fbDeptIds.has(e.departmentId))
          .map((e) => ({
            id: e.id,
            name: `${e.firstName} ${e.lastName}`,
            position: posById.get(e.positionId) || 'Unassigned',
            department: deptById.get(e.departmentId) || 'Unknown',
            status: e.status,
            employmentType: e.employmentType,
            hireDate: e.hireDate,
            salary: Number(e.salary || 0),
            emergencyContact: e.emergencyContact,
            qualifications: e.qualifications || [],
          }))
      );
    });
  };
  useEffect(() => { reloadStaff(); }, []);

  // -------------------------------------------------------------------------
  // Training — real HrTrainingProgram / HrTrainingRecord data. Scoped to
  // programs relevant to F&B (mandatory programs apply hotel-wide; others are
  // shown regardless of category since training isn't department-scoped in
  // the schema, only enrollment is).
  // -------------------------------------------------------------------------
  const [trainingPrograms, setTrainingPrograms] = useState<TrainingProgram[]>([]);
  const reloadTraining = () => {
    Promise.all([
      fetch('/api/hr/training-programs', { headers: fbHeaders() }).then((r) => (r.ok ? r.json() : { programs: [] })),
      fetch('/api/hr/training-records', { headers: fbHeaders() }).then((r) => (r.ok ? r.json() : { records: [] })),
    ]).then(([progData, recData]) => {
      const records = (recData.records || []) as any[];
      setTrainingPrograms((progData.programs || []).map((p: any) => ({
        id: p.id,
        title: p.title,
        description: p.description || '',
        category: p.category,
        duration: Number(p.duration || 0),
        instructor: p.instructor || 'TBD',
        startDate: p.startDate || undefined,
        status: p.status,
        mandatory: p.mandatory,
        maxParticipants: p.maxParticipants || undefined,
        enrolledCount: records.filter((r) => r.trainingProgramId === p.id).length,
      })));
    });
  };
  useEffect(() => { reloadTraining(); }, []);

  const [trainingForm, setTrainingForm] = useState({
    title: '', description: '', category: 'technical', duration: '4', instructor: '', startDate: '', maxParticipants: '15', mandatory: false,
  });
  const submitTraining = async () => {
    if (!trainingForm.title) return;
    const res = await fetch('/api/hr/training-programs', {
      method: 'POST',
      headers: fbHeaders(),
      body: JSON.stringify({
        id: `training-${Date.now()}`,
        title: trainingForm.title,
        description: trainingForm.description,
        category: trainingForm.category,
        duration: Number(trainingForm.duration) || 0,
        instructor: trainingForm.instructor || undefined,
        startDate: trainingForm.startDate || undefined,
        maxParticipants: Number(trainingForm.maxParticipants) || undefined,
        mandatory: trainingForm.mandatory,
        status: 'scheduled',
      }),
    });
    if (res.ok) {
      setTrainingForm({ title: '', description: '', category: 'technical', duration: '4', instructor: '', startDate: '', maxParticipants: '15', mandatory: false });
      setIsNewTrainingModalOpen(false);
      reloadTraining();
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'success';
      case 'inactive': return 'danger';
      case 'terminated': return 'danger';
      case 'suspended': return 'danger';
      case 'on_leave': return 'warning';
      default: return 'default';
    }
  };

  const getTrainingCategoryColor = (category: string) => {
    switch (category) {
      case 'safety': return 'danger';
      case 'soft_skills': return 'primary';
      case 'leadership': return 'success';
      case 'technical': return 'warning';
      case 'compliance': return 'danger';
      default: return 'default';
    }
  };

  const getTrainingStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return 'primary';
      case 'in_progress': return 'warning';
      case 'completed': return 'success';
      case 'cancelled': return 'danger';
      default: return 'default';
    }
  };

  const filteredStaff = staff
    .filter((member) => selectedDepartment === 'all' || member.department === selectedDepartment)
    .filter((member) => selectedStatus === 'all' || member.status === selectedStatus);

  const totalPayroll = staff.reduce((total, member) => total + member.salary, 0);
  const activeStaffCount = staff.filter((member) => member.status === 'active').length;
  const avgTenureYears = staff.length > 0
    ? staff.reduce((total, member) => {
        if (!member.hireDate) return total;
        const years = (Date.now() - new Date(member.hireDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000);
        return total + years;
      }, 0) / staff.length
    : 0;

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-ghana-black">🍽️ Food & Beverage - Staff & Training</h2>
          <p className="text-gray-600">Staff on record and training programs</p>
        </div>
        <div className="flex gap-3">
          <Button
            color="secondary"
            className="bg-ghana-gold text-white"
            onClick={() => setIsNewTrainingModalOpen(true)}
          >
            + Schedule Training
          </Button>
        </div>
      </div>

      <p className="text-sm text-gray-500 mb-4">
        Full staff onboarding and edits happen in HR &amp; Payroll — this view is a Food &amp; Beverage-scoped read on
        the same real records.
      </p>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card className="border-0 shadow-lg">
          <CardBody className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Staff</p>
                <p className="text-2xl font-bold text-ghana-black">{staff.length}</p>
                <p className="text-sm text-green-600">{activeStaffCount} active</p>
              </div>
              <div className="text-3xl">👥</div>
            </div>
          </CardBody>
        </Card>

        <Card className="border-0 shadow-lg">
          <CardBody className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Monthly Payroll</p>
                <p className="text-2xl font-bold text-ghana-black">₵{totalPayroll.toLocaleString()}</p>
                <p className="text-sm text-blue-600">F&amp;B staff on record</p>
              </div>
              <div className="text-3xl">💰</div>
            </div>
          </CardBody>
        </Card>

        <Card className="border-0 shadow-lg">
          <CardBody className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Avg Tenure</p>
                <p className="text-2xl font-bold text-ghana-black">{avgTenureYears.toFixed(1)}y</p>
                <p className="text-sm text-gray-500">from hire date</p>
              </div>
              <div className="text-3xl">📅</div>
            </div>
          </CardBody>
        </Card>

        <Card className="border-0 shadow-lg">
          <CardBody className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Training Programs</p>
                <p className="text-2xl font-bold text-ghana-black">{trainingPrograms.length}</p>
                <p className="text-sm text-warning">{trainingPrograms.filter((p) => p.mandatory).length} mandatory</p>
              </div>
              <div className="text-3xl">🎓</div>
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
            <Tab key="staff" title="👥 Staff">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex gap-4">
                    <Select
                      label="Filter by Department"
                      placeholder="All Departments"
                      selectedKeys={[selectedDepartment]}
                      onChange={(e) => setSelectedDepartment(e.target.value)}
                      className="w-56"
                    >
                      {[{ id: 'all', name: 'All Departments' }, ...departments].map((d) => (
                        <SelectItem key={d.id === 'all' ? 'all' : d.name}>{d.name}</SelectItem>
                      ))}
                    </Select>
                    <Select
                      label="Filter by Status"
                      placeholder="All Status"
                      selectedKeys={[selectedStatus]}
                      onChange={(e) => setSelectedStatus(e.target.value)}
                      className="w-48"
                    >
                      <SelectItem key="all">All Status</SelectItem>
                      <SelectItem key="active">Active</SelectItem>
                      <SelectItem key="on_leave">On Leave</SelectItem>
                      <SelectItem key="suspended">Suspended</SelectItem>
                      <SelectItem key="terminated">Terminated</SelectItem>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredStaff.map((member) => (
                    <Card key={member.id} className="border border-gray-200 hover:border-ghana-green transition-colors">
                      <CardBody className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-semibold text-ghana-black">{member.name}</h4>
                          <Chip color={getStatusColor(member.status)} size="sm">
                            {member.status.charAt(0).toUpperCase() + member.status.slice(1).replace('_', ' ')}
                          </Chip>
                        </div>

                        <div className="space-y-2 mb-3">
                          <div className="text-sm">
                            <span className="font-medium">Position:</span> {member.position}
                          </div>
                          <div className="text-sm">
                            <span className="font-medium">Department:</span>{' '}
                            <Badge color="primary" variant="flat" className="ml-1">{member.department}</Badge>
                          </div>
                          <div className="text-sm">
                            <span className="font-medium">Employment:</span>{' '}
                            <Badge color="secondary" variant="flat" className="ml-1">{member.employmentType}</Badge>
                          </div>
                          <div className="text-sm">
                            <span className="font-medium">Salary:</span> ₵{member.salary.toLocaleString()}
                          </div>
                          {member.hireDate && (
                            <div className="text-sm">
                              <span className="font-medium">Hired:</span> {new Date(member.hireDate).toLocaleDateString()}
                            </div>
                          )}
                          {member.emergencyContact?.phone && (
                            <div className="text-sm">
                              <span className="font-medium">Emergency:</span> {member.emergencyContact.name} ({member.emergencyContact.phone})
                            </div>
                          )}
                        </div>

                        {member.qualifications.length > 0 && (
                          <div className="mb-3">
                            <p className="text-sm font-medium text-gray-700 mb-1">Qualifications:</p>
                            <div className="flex flex-wrap gap-1">
                              {member.qualifications.slice(0, 3).map((q, index) => (
                                <Chip key={index} size="sm" variant="flat" color="secondary">
                                  {q.title}
                                </Chip>
                              ))}
                              {member.qualifications.length > 3 && (
                                <Chip size="sm" variant="flat" color="default">
                                  +{member.qualifications.length - 3} more
                                </Chip>
                              )}
                            </div>
                          </div>
                        )}
                      </CardBody>
                    </Card>
                  ))}
                  {filteredStaff.length === 0 && (
                    <p className="text-gray-500 col-span-full text-center py-8">No F&amp;B staff found in HR records.</p>
                  )}
                </div>
              </div>
            </Tab>

            <Tab key="training" title="🎓 Training Programs">
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {trainingPrograms.map((training) => (
                    <Card key={training.id} className="border border-gray-200 hover:border-ghana-green transition-colors">
                      <CardBody className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-semibold text-ghana-black">{training.title}</h4>
                          <Chip color={getTrainingCategoryColor(training.category)} size="sm">
                            {training.category.replace('_', ' ').toUpperCase()}
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
                          {training.startDate && (
                            <div className="flex items-center justify-between text-sm">
                              <span>Date:</span>
                              <span className="font-medium">{new Date(training.startDate).toLocaleDateString()}</span>
                            </div>
                          )}
                          <div className="flex items-center justify-between text-sm">
                            <span>Enrolled:</span>
                            <span className="font-medium">{training.enrolledCount}{training.maxParticipants ? `/${training.maxParticipants}` : ''}</span>
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <Chip color={getTrainingStatusColor(training.status)} size="sm">
                            {training.status.replace('_', ' ')}
                          </Chip>
                          {training.mandatory && (
                            <Chip color="danger" size="sm" variant="flat">Mandatory</Chip>
                          )}
                        </div>
                      </CardBody>
                    </Card>
                  ))}
                  {trainingPrograms.length === 0 && (
                    <p className="text-gray-500 col-span-full text-center py-8">No training programs scheduled yet.</p>
                  )}
                </div>
              </div>
            </Tab>
          </Tabs>
        </CardBody>
      </Card>

      {/* New Training Modal */}
      <Modal isOpen={isNewTrainingModalOpen} onClose={() => setIsNewTrainingModalOpen(false)} size="2xl">
        <ModalContent>
          <ModalHeader>Schedule New Training</ModalHeader>
          <ModalBody>
            <div className="space-y-4">
              <Input label="Training Title" placeholder="Enter training title" value={trainingForm.title} onChange={(e) => setTrainingForm({ ...trainingForm, title: e.target.value })} />

              <Input label="Description" placeholder="Enter training description" value={trainingForm.description} onChange={(e) => setTrainingForm({ ...trainingForm, description: e.target.value })} />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Select
                  label="Category"
                  selectedKeys={[trainingForm.category]}
                  onChange={(e) => setTrainingForm({ ...trainingForm, category: e.target.value })}
                >
                  <SelectItem key="safety">Food Safety</SelectItem>
                  <SelectItem key="soft_skills">Customer Service</SelectItem>
                  <SelectItem key="leadership">Leadership</SelectItem>
                  <SelectItem key="technical">Technical</SelectItem>
                  <SelectItem key="compliance">Compliance</SelectItem>
                </Select>
                <Input label="Duration (hours)" type="number" value={trainingForm.duration} onChange={(e) => setTrainingForm({ ...trainingForm, duration: e.target.value })} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input label="Instructor" placeholder="Enter instructor name" value={trainingForm.instructor} onChange={(e) => setTrainingForm({ ...trainingForm, instructor: e.target.value })} />
                <Input label="Scheduled Date" type="date" value={trainingForm.startDate} onChange={(e) => setTrainingForm({ ...trainingForm, startDate: e.target.value })} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input label="Maximum Attendees" type="number" value={trainingForm.maxParticipants} onChange={(e) => setTrainingForm({ ...trainingForm, maxParticipants: e.target.value })} />
                <Select
                  label="Mandatory?"
                  selectedKeys={[trainingForm.mandatory ? 'yes' : 'no']}
                  onChange={(e) => setTrainingForm({ ...trainingForm, mandatory: e.target.value === 'yes' })}
                >
                  <SelectItem key="no">Optional</SelectItem>
                  <SelectItem key="yes">Mandatory</SelectItem>
                </Select>
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button color="danger" variant="light" onPress={() => setIsNewTrainingModalOpen(false)}>
              Cancel
            </Button>
            <Button color="primary" className="bg-ghana-green text-white" onPress={submitTraining}>
              Schedule Training
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
