'use client';

import React, { useState, useEffect } from 'react';
import { 
  Card, 
  CardBody, 
  Button, 
  Input, 
  Select, 
  SelectItem, 
  Chip, 
  Badge, 
  Modal, 
  ModalContent, 
  ModalHeader, 
  ModalBody, 
  ModalFooter,
  Textarea,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Progress,
  Avatar,
  Tooltip,
  Tabs,
  Tab
} from "@heroui/react";
import { housekeepingStore } from '../../lib/housekeeping/store';
import { trackEvent } from '../../lib/analytics/trackEvent';
import { 
  HousekeepingStaff, 
  HousekeepingTask 
} from '../../lib/housekeeping/types';

export default function StaffManagementPanel() {
  const [staff, setStaff] = useState<HousekeepingStaff[]>([]);
  const [tasks, setTasks] = useState<HousekeepingTask[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<HousekeepingStaff | null>(null);
  const [staffModalOpen, setStaffModalOpen] = useState(false);
  const [isCreatingStaff, setIsCreatingStaff] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Form state
  const [staffForm, setStaffForm] = useState({
    name: '',
    role: 'housekeeper' as HousekeepingStaff['role'],
    dailyTarget: 15,
    notes: ''
  });

  useEffect(() => {
    loadData();
    const unsubscribe = housekeepingStore.subscribe(loadData);
    return unsubscribe;
  }, []);

  const loadData = () => {
    setStaff(housekeepingStore.getAllStaff());
    setTasks(housekeepingStore.getAllTasks());
  };

  const handleCreateStaff = () => {
    setIsCreatingStaff(true);
    setStaffForm({
      name: '',
      role: 'housekeeper',
      dailyTarget: 15,
      notes: ''
    });
    setStaffModalOpen(true);
  };

  const handleEditStaff = (member: HousekeepingStaff) => {
    setIsCreatingStaff(false);
    setSelectedStaff(member);
    setStaffForm({
      name: member.name,
      role: member.role,
      dailyTarget: member.dailyTarget,
      notes: ''
    });
    setStaffModalOpen(true);
  };

  const handleSaveStaff = () => {
    if (!staffForm.name) return;

    if (isCreatingStaff) {
      housekeepingStore.addStaff({
        name: staffForm.name,
        role: staffForm.role,
        dailyTarget: staffForm.dailyTarget,
      });
    } else if (selectedStaff) {
      housekeepingStore.updateStaff(selectedStaff.id, {
        name: staffForm.name,
        role: staffForm.role,
        dailyTarget: staffForm.dailyTarget,
      });
    }

    setStaffModalOpen(false);
    loadData();
  };

  const handleToggleStaffStatus = (staffId: string, active: boolean) => {
    housekeepingStore.updateStaff(staffId, { active });
    loadData();
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'housekeeper': return 'primary';
      case 'supervisor': return 'secondary';
      case 'inspector': return 'success';
      case 'maintenance': return 'warning';
      default: return 'default';
    }
  };

  const getStatusColor = (active: boolean) => {
    return active ? 'success' : 'default';
  };

  const getEfficiencyColor = (efficiency: number) => {
    if (efficiency >= 90) return 'success';
    if (efficiency >= 70) return 'warning';
    return 'danger';
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'housekeeper': return '🧹';
      case 'supervisor': return '👔';
      case 'inspector': return '🔍';
      case 'maintenance': return '🔧';
      default: return '👤';
    }
  };

  const filteredStaff = staff.filter(member => {
    if (searchTerm && !member.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    if (roleFilter !== 'all' && member.role !== roleFilter) return false;
    if (statusFilter !== 'all' && member.active !== (statusFilter === 'active')) return false;
    return true;
  });

  const getStaffTasks = (staffId: string) => {
    return tasks.filter(task => task.assignedTo === staffId);
  };

  const getStaffEfficiency = (member: HousekeepingStaff) => {
    if (member.dailyTarget === 0) return 0;
    return Math.round((member.completedToday / member.dailyTarget) * 100);
  };

  const getRoleName = (role: string) => {
    return role.charAt(0).toUpperCase() + role.slice(1);
  };

  return (
    <div className="p-6 space-y-4">
      {/* Header and Actions */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-ghana-black">👥 Staff Management</h2>
          <p className="text-gray-600">Manage housekeeping staff, assignments, and performance</p>
        </div>
        <Button 
          color="primary" 
          className="bg-ghana-green text-white"
          onClick={handleCreateStaff}
        >
          + Add Staff Member
        </Button>
      </div>

      {/* Staff Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-0 shadow-lg">
          <CardBody className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Staff</p>
                <p className="text-2xl font-bold text-ghana-black">{staff.length}</p>
              </div>
              <span className="text-2xl">👥</span>
            </div>
          </CardBody>
        </Card>
        
        <Card className="border-0 shadow-lg">
          <CardBody className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Staff</p>
                <p className="text-2xl font-bold text-green-600">{staff.filter(s => s.active).length}</p>
              </div>
              <span className="text-2xl">🟢</span>
            </div>
          </CardBody>
        </Card>
        
        <Card className="border-0 shadow-lg">
          <CardBody className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Housekeepers</p>
                <p className="text-2xl font-bold text-blue-600">{staff.filter(s => s.role === 'housekeeper').length}</p>
              </div>
              <span className="text-2xl">🧹</span>
            </div>
          </CardBody>
        </Card>
        
        <Card className="border-0 shadow-lg">
          <CardBody className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Avg Efficiency</p>
                <p className="text-2xl font-bold text-purple-600">
                  {staff.length > 0 ? Math.round(staff.reduce((sum, s) => sum + s.efficiency, 0) / staff.length) : 0}%
                </p>
              </div>
              <span className="text-2xl">📊</span>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Filters */}
      <Card className="border-0 shadow-lg">
        <CardBody className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Input
              placeholder="Search staff names..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              startContent={<span className="text-gray-400">🔍</span>}
            />
            <Select
              placeholder="Filter by role"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
            >
              <SelectItem key="all">All Roles</SelectItem>
              <SelectItem key="housekeeper">🧹 Housekeeper</SelectItem>
              <SelectItem key="supervisor">👔 Supervisor</SelectItem>
              <SelectItem key="inspector">🔍 Inspector</SelectItem>
              <SelectItem key="maintenance">🔧 Maintenance</SelectItem>
            </Select>
            <Select
              placeholder="Filter by status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <SelectItem key="all">All Statuses</SelectItem>
              <SelectItem key="active">🟢 Active</SelectItem>
              <SelectItem key="inactive">⚪ Inactive</SelectItem>
            </Select>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">Filtered:</span>
              <Badge color="primary" variant="flat">{filteredStaff.length}</Badge>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Staff Management Tabs */}
      <Card className="border-0 shadow-lg">
        <CardBody className="p-0">
          <Tabs aria-label="Staff management tabs" className="w-full">
            <Tab key="overview" title="📊 Overview">
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredStaff.map((member) => (
                    <Card key={member.id} className="border border-gray-200 hover:border-ghana-green transition-colors">
                      <CardBody className="p-4">
                        <div className="text-center">
                          {/* Staff Header */}
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <span className="text-xl">{getRoleIcon(member.role)}</span>
                              <h4 className="font-semibold text-ghana-black">{member.name}</h4>
                            </div>
                            <div className="flex gap-1">
                              <Badge 
                                color={getStatusColor(member.active)}
                                size="sm"
                              >
                                {member.active ? 'Active' : 'Inactive'}
                              </Badge>
                              <Badge 
                                color={getRoleColor(member.role) as any}
                                variant="flat"
                                size="sm"
                              >
                                {getRoleName(member.role)}
                              </Badge>
                            </div>
                          </div>
                          
                          {/* Performance Metrics */}
                          <div className="space-y-3 mb-4">
                            <div className="flex items-center justify-between text-sm">
                              <span>Today's Progress</span>
                              <span className="font-medium">{member.completedToday}/{member.dailyTarget}</span>
                            </div>
                            <Progress 
                              value={getStaffEfficiency(member)} 
                              color={getEfficiencyColor(getStaffEfficiency(member)) as any}
                              size="sm"
                            />
                            <div className="flex items-center justify-between text-xs text-gray-600">
                              <span>Efficiency</span>
                              <span>{member.efficiency}%</span>
                            </div>
                          </div>
                          
                          {/* Current Tasks */}
                          <div className="mb-4">
                            <p className="text-sm font-medium text-gray-700 mb-2">Current Tasks</p>
                            <div className="flex flex-wrap gap-1 justify-center">
                              {member.currentTasks.length > 0 ? (
                                member.currentTasks.map((taskId) => {
                                  const task = tasks.find(t => t.id === taskId);
                                  return task ? (
                                    <Badge key={taskId} color="secondary" variant="flat" size="sm">
                                      {task.roomNumber}
                                    </Badge>
                                  ) : null;
                                })
                              ) : (
                                <span className="text-gray-500 text-sm">No tasks</span>
                              )}
                            </div>
                          </div>
                          
                          {/* Last Active */}
                          <div className="text-xs text-gray-500 mb-4">
                            Last active: {new Date(member.lastActive).toLocaleTimeString()}
                          </div>
                          
                          {/* Actions */}
                          <div className="flex gap-2">
                            <Button 
                              size="sm" 
                              color="primary" 
                              variant="flat"
                              onClick={() => handleEditStaff(member)}
                            >
                              Edit
                            </Button>
                            <Button 
                              size="sm" 
                              color={member.active ? 'warning' : 'success'} 
                              variant="flat"
                              onClick={() => handleToggleStaffStatus(member.id, !member.active)}
                            >
                              {member.active ? 'Deactivate' : 'Activate'}
                            </Button>
                          </div>
                        </div>
                      </CardBody>
                    </Card>
                  ))}
                </div>
              </div>
            </Tab>

            <Tab key="detailed" title="📋 Detailed View">
              <div className="p-6">
                <Table aria-label="Staff detailed table">
                  <TableHeader>
                    <TableColumn>Staff Member</TableColumn>
                    <TableColumn>Role</TableColumn>
                    <TableColumn>Status</TableColumn>
                    <TableColumn>Today's Progress</TableColumn>
                    <TableColumn>Efficiency</TableColumn>
                    <TableColumn>Current Tasks</TableColumn>
                    <TableColumn>Last Active</TableColumn>
                    <TableColumn>Actions</TableColumn>
                  </TableHeader>
                  <TableBody>
                    {filteredStaff.map((member) => (
                      <TableRow key={member.id} className="hover:bg-gray-50">
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar size="sm" name={member.name} />
                            <div>
                              <p className="font-medium text-ghana-black">{member.name}</p>
                              <p className="text-sm text-gray-500">ID: {member.id}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Chip 
                            size="sm" 
                            variant="flat" 
                            color={getRoleColor(member.role) as any}
                          >
                            <span className="mr-1">{getRoleIcon(member.role)}</span>
                            {getRoleName(member.role)}
                          </Chip>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            color={getStatusColor(member.active)}
                            variant="flat"
                            size="sm"
                          >
                            {member.active ? '🟢 Active' : '⚪ Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="w-full">
                            <div className="flex items-center justify-between text-sm mb-1">
                              <span>{member.completedToday}/{member.dailyTarget}</span>
                              <span>{getStaffEfficiency(member)}%</span>
                            </div>
                            <Progress 
                              value={getStaffEfficiency(member)} 
                              color={getEfficiencyColor(getStaffEfficiency(member)) as any}
                              size="sm"
                            />
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            color={getEfficiencyColor(member.efficiency) as any}
                            variant="flat"
                            size="sm"
                          >
                            {member.efficiency}%
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {member.currentTasks.length > 0 ? (
                              member.currentTasks.map((taskId) => {
                                const task = tasks.find(t => t.id === taskId);
                                return task ? (
                                  <Badge key={taskId} color="secondary" variant="flat" size="sm">
                                    {task.roomNumber}
                                  </Badge>
                                ) : null;
                              })
                            ) : (
                              <span className="text-gray-400 text-sm">No tasks</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-gray-600">
                            {new Date(member.lastActive).toLocaleString()}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Tooltip content="Edit staff member">
                              <Button
                                size="sm"
                                color="primary"
                                variant="flat"
                                isIconOnly
                                onClick={() => handleEditStaff(member)}
                              >
                                ✏️
                              </Button>
                            </Tooltip>
                            
                            <Tooltip content={member.active ? 'Deactivate' : 'Activate'}>
                              <Button
                                size="sm"
                                color={member.active ? 'warning' : 'success'}
                                variant="flat"
                                isIconOnly
                                onClick={() => handleToggleStaffStatus(member.id, !member.active)}
                              >
                                {member.active ? '⏸️' : '▶️'}
                              </Button>
                            </Tooltip>
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

      {/* Staff Modal */}
      <Modal isOpen={staffModalOpen} onClose={() => setStaffModalOpen(false)} size="2xl">
        <ModalContent>
          <ModalHeader>
            {isCreatingStaff ? 'Add New Staff Member' : 'Edit Staff Member'}
          </ModalHeader>
          <ModalBody>
            <div className="space-y-4">
              {/* Basic Information */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Name *</label>
                  <Input
                    value={staffForm.name}
                    onChange={(e) => setStaffForm({...staffForm, name: e.target.value})}
                    placeholder="Staff member name"
                    isRequired
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Role *</label>
                  <Select
                    value={staffForm.role}
                    onChange={(e) => setStaffForm({...staffForm, role: e.target.value as any})}
                    placeholder="Select role"
                    isRequired
                  >
                    <SelectItem key="housekeeper">🧹 Housekeeper</SelectItem>
                    <SelectItem key="supervisor">👔 Supervisor</SelectItem>
                    <SelectItem key="inspector">🔍 Inspector</SelectItem>
                    <SelectItem key="maintenance">🔧 Maintenance</SelectItem>
                  </Select>
                </div>
              </div>

              {/* Performance Settings */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Daily Target</label>
                <Input
                  type="number"
                  value={String(staffForm.dailyTarget)}
                  onChange={(e) => setStaffForm({...staffForm, dailyTarget: parseInt(e.target.value) || 15})}
                  placeholder="15"
                  min="1"
                  max="50"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Number of tasks to complete per day
                </p>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
                <Textarea
                  value={staffForm.notes}
                  onChange={(e) => setStaffForm({...staffForm, notes: e.target.value})}
                  placeholder="Additional notes about this staff member"
                  rows={3}
                />
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onClick={() => setStaffModalOpen(false)}>
              Cancel
            </Button>
            <Button 
              color="primary" 
              onClick={handleSaveStaff}
              isDisabled={!staffForm.name}
            >
              {isCreatingStaff ? 'Add Staff Member' : 'Update Staff Member'}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
