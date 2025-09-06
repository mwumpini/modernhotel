'use client';

import React, { useState, useEffect } from 'react';
import { 
  Card, 
  CardBody, 
  CardHeader, 
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
  Avatar,
  Tooltip,
  Tabs,
  Tab
} from "@heroui/react";
import { housekeepingStore } from '../../lib/housekeeping/store';
import { trackEvent } from '../../lib/analytics/trackEvent';
import { 
  MaintenanceRequest, 
  TaskPriority,
  HousekeepingStaff 
} from '../../lib/housekeeping/types';

export default function MaintenancePanel() {
  const [maintenanceRequests, setMaintenanceRequests] = useState<MaintenanceRequest[]>([]);
  const [staff, setStaff] = useState<HousekeepingStaff[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<MaintenanceRequest | null>(null);
  const [maintenanceModalOpen, setMaintenanceModalOpen] = useState(false);
  const [isCreatingRequest, setIsCreatingRequest] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Form state
  const [maintenanceForm, setMaintenanceForm] = useState({
    roomNumber: '',
    category: 'other' as MaintenanceRequest['category'],
    priority: 'medium' as TaskPriority,
    description: '',
    estimatedCost: 0,
    assignedTo: ''
  });

  useEffect(() => {
    loadData();
    const unsubscribe = housekeepingStore.subscribe(loadData);
    return unsubscribe;
  }, []);

  const loadData = () => {
    setMaintenanceRequests(housekeepingStore.getAllMaintenanceRequests());
    setStaff(housekeepingStore.getAllStaff());
    setRooms(housekeepingStore.getAllRooms());
  };

  const handleCreateRequest = () => {
    setIsCreatingRequest(true);
    setMaintenanceForm({
      roomNumber: '',
      category: 'other',
      priority: 'medium',
      description: '',
      estimatedCost: 0,
      assignedTo: ''
    });
    setMaintenanceModalOpen(true);
  };

  const handleEditRequest = (request: MaintenanceRequest) => {
    setIsCreatingRequest(false);
    setSelectedRequest(request);
    setMaintenanceForm({
      roomNumber: request.roomNumber,
      category: request.category,
      priority: request.priority,
      description: request.description,
      estimatedCost: request.estimatedCost || 0,
      assignedTo: request.assignedTo || ''
    });
    setMaintenanceModalOpen(true);
  };

  const handleSaveRequest = () => {
    if (!maintenanceForm.roomNumber || !maintenanceForm.description) return;

    if (isCreatingRequest) {
      housekeepingStore.createMaintenanceRequest({
        roomNumber: maintenanceForm.roomNumber,
        reportedBy: 'Housekeeping Staff',
        category: maintenanceForm.category,
        priority: maintenanceForm.priority,
        description: maintenanceForm.description
      });

      trackEvent('HK.Maintenance.Created', {
        roomNumber: maintenanceForm.roomNumber,
        category: maintenanceForm.category,
        priority: maintenanceForm.priority
      });
    } else if (selectedRequest) {
      housekeepingStore.updateMaintenanceRequest(selectedRequest.id, {
        ...maintenanceForm,
        status: selectedRequest.status
      });

      trackEvent('HK.Maintenance.Updated', {
        requestId: selectedRequest.id,
        roomNumber: maintenanceForm.roomNumber
      });
    }

    setMaintenanceModalOpen(false);
    loadData();
  };

  const handleUpdateStatus = (requestId: string, status: MaintenanceRequest['status'], assignedTo?: string) => {
    housekeepingStore.updateMaintenanceStatus(requestId, status, assignedTo);
    trackEvent('HK.Maintenance.StatusUpdated', { requestId, status, assignedTo });
    loadData();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'reported': return 'default';
      case 'assigned': return 'warning';
      case 'in-progress': return 'primary';
      case 'completed': return 'success';
      case 'verified': return 'secondary';
      default: return 'default';
    }
  };

  const getPriorityColor = (priority: TaskPriority) => {
    switch (priority) {
      case 'urgent': return 'danger';
      case 'high': return 'warning';
      case 'medium': return 'primary';
      case 'low': return 'default';
      default: return 'default';
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'plumbing': return 'primary';
      case 'electrical': return 'warning';
      case 'hvac': return 'secondary';
      case 'furniture': return 'success';
      case 'appliances': return 'default';
      case 'structural': return 'danger';
      case 'other': return 'default';
      default: return 'default';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'plumbing': return '🚰';
      case 'electrical': return '⚡';
      case 'hvac': return '❄️';
      case 'furniture': return '🪑';
      case 'appliances': return '🔌';
      case 'structural': return '🏗️';
      case 'other': return '🔧';
      default: return '🔧';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'reported': return '📝';
      case 'assigned': return '👥';
      case 'in-progress': return '🔄';
      case 'completed': return '✅';
      case 'verified': return '🔍';
      default: return '📝';
    }
  };

  const filteredRequests = maintenanceRequests.filter(request => {
    if (searchTerm && !request.roomNumber.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    if (statusFilter !== 'all' && request.status !== statusFilter) return false;
    if (priorityFilter !== 'all' && request.priority !== priorityFilter) return false;
    if (categoryFilter !== 'all' && request.category !== categoryFilter) return false;
    return true;
  });

  const getStaffName = (staffId: string) => {
    return staff.find(s => s.id === staffId)?.name || 'Unassigned';
  };

  const getCategoryName = (category: string) => {
    return category.charAt(0).toUpperCase() + category.slice(1);
  };

  return (
    <div className="p-6 space-y-4">
      {/* Header and Actions */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-ghana-black">🔧 Maintenance Management</h2>
          <p className="text-gray-600">Track and manage maintenance requests and repairs</p>
        </div>
        <Button 
          color="primary" 
          className="bg-ghana-green text-white"
          onClick={handleCreateRequest}
        >
          + New Maintenance Request
        </Button>
      </div>

      {/* Maintenance Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card className="border-0 shadow-lg">
          <CardBody className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Requests</p>
                <p className="text-2xl font-bold text-ghana-black">{maintenanceRequests.length}</p>
              </div>
              <span className="text-2xl">🔧</span>
            </div>
          </CardBody>
        </Card>
        
        <Card className="border-0 shadow-lg">
          <CardBody className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Open Requests</p>
                <p className="text-2xl font-bold text-yellow-600">
                  {maintenanceRequests.filter(r => r.status !== 'completed').length}
                </p>
              </div>
              <span className="text-2xl">⚠️</span>
            </div>
          </CardBody>
        </Card>
        
        <Card className="border-0 shadow-lg">
          <CardBody className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">In Progress</p>
                <p className="text-2xl font-bold text-blue-600">
                  {maintenanceRequests.filter(r => r.status === 'in-progress').length}
                </p>
              </div>
              <span className="text-2xl">🔄</span>
            </div>
          </CardBody>
        </Card>
        
        <Card className="border-0 shadow-lg">
          <CardBody className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Completed</p>
                <p className="text-2xl font-bold text-green-600">
                  {maintenanceRequests.filter(r => r.status === 'completed').length}
                </p>
              </div>
              <span className="text-2xl">✅</span>
            </div>
          </CardBody>
        </Card>
        
        <Card className="border-0 shadow-lg">
          <CardBody className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Urgent</p>
                <p className="text-2xl font-bold text-red-600">
                  {maintenanceRequests.filter(r => r.priority === 'urgent').length}
                </p>
              </div>
              <span className="text-2xl">🚨</span>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Filters */}
      <Card className="border-0 shadow-lg">
        <CardBody className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <Input
              placeholder="Search room numbers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              startContent={<span className="text-gray-400">🔍</span>}
            />
            <Select
              placeholder="Filter by status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <SelectItem key="all" value="all">All Statuses</SelectItem>
              <SelectItem key="reported" value="reported">📝 Reported</SelectItem>
              <SelectItem key="assigned" value="assigned">👥 Assigned</SelectItem>
              <SelectItem key="in-progress" value="in-progress">🔄 In Progress</SelectItem>
              <SelectItem key="completed" value="completed">✅ Completed</SelectItem>
              <SelectItem key="verified" value="verified">🔍 Verified</SelectItem>
            </Select>
            <Select
              placeholder="Filter by priority"
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
            >
              <SelectItem key="all" value="all">All Priorities</SelectItem>
              <SelectItem key="low" value="low">Low</SelectItem>
              <SelectItem key="medium" value="medium">Medium</SelectItem>
              <SelectItem key="high" value="high">High</SelectItem>
              <SelectItem key="urgent" value="urgent">Urgent</SelectItem>
            </Select>
            <Select
              placeholder="Filter by category"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <SelectItem key="all" value="all">All Categories</SelectItem>
              <SelectItem key="plumbing" value="plumbing">🚰 Plumbing</SelectItem>
              <SelectItem key="electrical" value="electrical">⚡ Electrical</SelectItem>
              <SelectItem key="hvac" value="hvac">❄️ HVAC</SelectItem>
              <SelectItem key="furniture" value="furniture">🪑 Furniture</SelectItem>
              <SelectItem key="appliances" value="appliances">🔌 Appliances</SelectItem>
              <SelectItem key="structural" value="structural">🏗️ Structural</SelectItem>
              <SelectItem key="other" value="other">🔧 Other</SelectItem>
            </Select>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">Filtered:</span>
              <Badge color="primary" variant="flat">{filteredRequests.length}</Badge>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Maintenance Requests Table */}
      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-3">
          <h3 className="text-lg font-semibold text-ghana-black">Maintenance Requests</h3>
        </CardHeader>
        <CardBody className="p-0">
          <Table aria-label="Maintenance requests table">
            <TableHeader>
              <TableColumn>Request ID</TableColumn>
              <TableColumn>Room</TableColumn>
              <TableColumn>Category</TableColumn>
              <TableColumn>Priority</TableColumn>
              <TableColumn>Status</TableColumn>
              <TableColumn>Description</TableColumn>
              <TableColumn>Assigned To</TableColumn>
              <TableColumn>Reported</TableColumn>
              <TableColumn>Actions</TableColumn>
            </TableHeader>
            <TableBody>
              {filteredRequests.map((request) => (
                <TableRow key={request.id} className="hover:bg-gray-50">
                  <TableCell>
                    <span className="font-semibold text-ghana-black">{request.id}</span>
                  </TableCell>
                  <TableCell>
                    <Chip size="sm" variant="flat" color="secondary">
                      {request.roomNumber}
                    </Chip>
                  </TableCell>
                  <TableCell>
                    <Chip 
                      size="sm" 
                      variant="flat" 
                      color={getCategoryColor(request.category) as any}
                    >
                      <span className="mr-1">{getCategoryIcon(request.category)}</span>
                      {getCategoryName(request.category)}
                    </Chip>
                  </TableCell>
                  <TableCell>
                    <Badge 
                      color={getPriorityColor(request.priority) as any}
                      variant="flat"
                      size="sm"
                    >
                      {request.priority}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge 
                      color={getStatusColor(request.status) as any}
                      variant="flat"
                      size="sm"
                    >
                      <span className="mr-1">{getStatusIcon(request.status)}</span>
                      {request.status.replace('-', ' ').charAt(0).toUpperCase() + request.status.replace('-', ' ').slice(1)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-gray-700 max-w-[200px] truncate block">
                      {request.description}
                    </span>
                  </TableCell>
                  <TableCell>
                    {request.assignedTo ? (
                      <div className="flex items-center gap-2">
                        <Avatar size="sm" name={getStaffName(request.assignedTo)} />
                        <span className="text-sm">{getStaffName(request.assignedTo)}</span>
                      </div>
                    ) : (
                      <span className="text-gray-400 text-sm">Unassigned</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-gray-600">
                      {new Date(request.reportedAt).toLocaleDateString()}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Tooltip content="View details">
                        <Button
                          size="sm"
                          color="primary"
                          variant="flat"
                          isIconOnly
                          onClick={() => handleEditRequest(request)}
                        >
                          👁️
                        </Button>
                      </Tooltip>
                      
                      {request.status === 'reported' && (
                        <Tooltip content="Assign request">
                          <Button
                            size="sm"
                            color="secondary"
                            variant="flat"
                            isIconOnly
                            onClick={() => {
                              // This would open an assignment modal
                              console.log('Assign request:', request.id);
                            }}
                          >
                            👥
                          </Button>
                        </Tooltip>
                      )}
                      
                      {request.status === 'assigned' && (
                        <Tooltip content="Start work">
                          <Button
                            size="sm"
                            color="success"
                            variant="flat"
                            isIconOnly
                            onClick={() => handleUpdateStatus(request.id, 'in-progress')}
                          >
                            ▶️
                          </Button>
                        </Tooltip>
                      )}
                      
                      {request.status === 'in-progress' && (
                        <Tooltip content="Mark complete">
                          <Button
                            size="sm"
                            color="success"
                            variant="flat"
                            isIconOnly
                            onClick={() => handleUpdateStatus(request.id, 'completed')}
                          >
                            ✅
                          </Button>
                        </Tooltip>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardBody>
      </Card>

      {/* Maintenance Request Modal */}
      <Modal isOpen={maintenanceModalOpen} onClose={() => setMaintenanceModalOpen(false)} size="2xl">
        <ModalContent>
          <ModalHeader>
            {isCreatingRequest ? 'Create Maintenance Request' : 'Maintenance Request Details'}
          </ModalHeader>
          <ModalBody>
            <div className="space-y-4">
              {/* Room Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Room Number *</label>
                <Select
                  value={maintenanceForm.roomNumber}
                  onChange={(e) => setMaintenanceForm({...maintenanceForm, roomNumber: e.target.value})}
                  placeholder="Select room"
                  isRequired
                >
                  {rooms.map((room) => (
                    <SelectItem key={room.roomNumber} value={room.roomNumber}>
                      Room {room.roomNumber}
                    </SelectItem>
                  ))}
                </Select>
              </div>

              {/* Category and Priority */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Category *</label>
                  <Select
                    value={maintenanceForm.category}
                    onChange={(e) => setMaintenanceForm({...maintenanceForm, category: e.target.value as any})}
                    placeholder="Select category"
                    isRequired
                  >
                    <SelectItem key="plumbing" value="plumbing">🚰 Plumbing</SelectItem>
                    <SelectItem key="electrical" value="electrical">⚡ Electrical</SelectItem>
                    <SelectItem key="hvac" value="hvac">❄️ HVAC</SelectItem>
                    <SelectItem key="furniture" value="furniture">🪑 Furniture</SelectItem>
                    <SelectItem key="appliances" value="appliances">🔌 Appliances</SelectItem>
                    <SelectItem key="structural" value="structural">🏗️ Structural</SelectItem>
                    <SelectItem key="other" value="other">🔧 Other</SelectItem>
                  </Select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Priority *</label>
                  <Select
                    value={maintenanceForm.priority}
                    onChange={(e) => setMaintenanceForm({...maintenanceForm, priority: e.target.value as any})}
                    placeholder="Select priority"
                    isRequired
                  >
                    <SelectItem key="low" value="low">Low</SelectItem>
                    <SelectItem key="medium" value="medium">Medium</SelectItem>
                    <SelectItem key="high" value="high">High</SelectItem>
                    <SelectItem key="urgent" value="urgent">Urgent</SelectItem>
                  </Select>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Description *</label>
                <Textarea
                  value={maintenanceForm.description}
                  onChange={(e) => setMaintenanceForm({...maintenanceForm, description: e.target.value})}
                  placeholder="Describe the maintenance issue in detail"
                  rows={4}
                  isRequired
                />
              </div>

              {/* Cost and Assignment */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Estimated Cost</label>
                  <Input
                    type="number"
                    value={maintenanceForm.estimatedCost}
                    onChange={(e) => setMaintenanceForm({...maintenanceForm, estimatedCost: parseFloat(e.target.value) || 0})}
                    placeholder="0.00"
                    startContent={<span className="text-gray-400">$</span>}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Assign To</label>
                  <Select
                    value={maintenanceForm.assignedTo}
                    onChange={(e) => setMaintenanceForm({...maintenanceForm, assignedTo: e.target.value})}
                    placeholder="Select staff member"
                  >
                    {staff.filter(s => s.active && s.role === 'maintenance').map((member) => (
                      <SelectItem key={member.id} value={member.id}>
                        {member.name} ({member.role})
                      </SelectItem>
                    ))}
                  </Select>
                </div>
              </div>

              {/* Current Status Display (for editing) */}
              {!isCreatingRequest && selectedRequest && (
                <div className="p-4 bg-gray-50 rounded-lg">
                  <h4 className="font-medium text-gray-900 mb-2">Current Status</h4>
                  <div className="flex items-center gap-2">
                    <Badge color={getStatusColor(selectedRequest.status) as any} variant="flat">
                      {getStatusIcon(selectedRequest.status)} {selectedRequest.status.replace('-', ' ').charAt(0).toUpperCase() + selectedRequest.status.replace('-', ' ').slice(1)}
                    </Badge>
                    <span className="text-sm text-gray-600">
                      Reported: {new Date(selectedRequest.reportedAt).toLocaleString()}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onClick={() => setMaintenanceModalOpen(false)}>
              Cancel
            </Button>
            <Button 
              color="primary" 
              onClick={handleSaveRequest}
              isDisabled={!maintenanceForm.roomNumber || !maintenanceForm.description}
            >
              {isCreatingRequest ? 'Create Request' : 'Update Request'}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
