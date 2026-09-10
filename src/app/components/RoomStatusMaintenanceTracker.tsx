'use client';

import React, { useState, useEffect } from 'react';
import { 
  Card, 
  CardBody, 
  CardHeader, 
  Button, 
  Badge, 
  Table, 
  TableHeader, 
  TableColumn, 
  TableBody, 
  TableRow, 
  TableCell,
  Input,
  Select,
  SelectItem,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Chip,
  Textarea,
  Tabs,
  Tab,
  Progress,
  Avatar,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem
} from "@heroui/react";
import { housekeepingStore } from '../lib/housekeeping/store';
import { frontOfficeStore } from '../lib/frontoffice/store';
import { trackEvent } from '../lib/analytics/trackEvent';
import { 
  RoomStatus, 
  HousekeepingTask, 
  MaintenanceRequest, 
  HousekeepingStaff,
  TaskPriority,
  TaskStatus 
} from '../lib/housekeeping/types';

interface RoomStatusData {
  roomNumber: string;
  roomTypeId: string;
  status: RoomStatus;
  lastUpdated: string;
  currentGuest?: string;
  checkInDate?: string;
  checkOutDate?: string;
  notes?: string;
  blockedUntil?: string;
}

export default function RoomStatusMaintenanceTracker() {
  const [rooms, setRooms] = useState<RoomStatusData[]>([]);
  const [tasks, setTasks] = useState<HousekeepingTask[]>([]);
  const [maintenanceRequests, setMaintenanceRequests] = useState<MaintenanceRequest[]>([]);
  const [staff, setStaff] = useState<HousekeepingStaff[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<RoomStatusData | null>(null);
  const [selectedTask, setSelectedTask] = useState<HousekeepingTask | null>(null);
  const [selectedMaintenance, setSelectedMaintenance] = useState<MaintenanceRequest | null>(null);
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  const [isCreatingMaintenance, setIsCreatingMaintenance] = useState(false);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [maintenanceModalOpen, setMaintenanceModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [taskFilter, setTaskFilter] = useState<string>('all');

  useEffect(() => {
    loadData();
    const unsubscribe = housekeepingStore.subscribe(loadData);
    return unsubscribe;
  }, []);

  const loadData = () => {
    setRooms(housekeepingStore.getAllRooms());
    setTasks(housekeepingStore.getAllTasks());
    setMaintenanceRequests(housekeepingStore.getAllMaintenanceRequests());
    setStaff(housekeepingStore.getAllStaff());
  };

  const handleRoomClick = (room: RoomStatusData) => {
    setSelectedRoom(room);
    setStatusModalOpen(true);
  };

  const handleTaskClick = (task: HousekeepingTask) => {
    setSelectedTask(task);
    setTaskModalOpen(true);
  };

  const handleMaintenanceClick = (maintenance: MaintenanceRequest) => {
    setSelectedMaintenance(maintenance);
    setMaintenanceModalOpen(true);
  };

  const handleCreateTask = () => {
    setIsCreatingTask(true);
    setSelectedTask({
      id: '',
      roomNumber: '',
      roomTypeId: '',
      taskType: 'daily',
      priority: 'medium',
      status: 'pending',
      estimatedMinutes: 30,
      checklist: [],
      completedItems: [],
      notes: ''
    });
    setTaskModalOpen(true);
  };

  const handleCreateMaintenance = () => {
    setIsCreatingMaintenance(true);
    setSelectedMaintenance({
      id: '',
      roomNumber: '',
      reportedBy: 'Front Desk',
      reportedAt: new Date().toISOString(),
      category: 'other',
      priority: 'medium',
      status: 'reported',
      description: '',
      notes: [],
      photos: []
    });
    setMaintenanceModalOpen(true);
  };

  const handleSaveTask = () => {
    if (!selectedTask) return;

    if (isCreatingTask) {
      housekeepingStore.createTask({
        roomNumber: selectedTask.roomNumber,
        roomTypeId: selectedTask.roomTypeId,
        taskType: selectedTask.taskType,
        priority: selectedTask.priority,
        estimatedMinutes: selectedTask.estimatedMinutes,
        checklist: selectedTask.checklist,
        notes: selectedTask.notes
      });
    } else {
      housekeepingStore.updateTask(selectedTask.id, selectedTask);
    }

    trackEvent('HK.Task.Updated', {
      taskId: selectedTask.id,
      roomNumber: selectedTask.roomNumber,
      status: selectedTask.status
    });

    setTaskModalOpen(false);
    loadData();
  };

  const handleSaveMaintenance = () => {
    if (!selectedMaintenance) return;

    if (isCreatingMaintenance) {
      housekeepingStore.createMaintenanceRequest({
        roomNumber: selectedMaintenance.roomNumber,
        reportedBy: selectedMaintenance.reportedBy,
        category: selectedMaintenance.category,
        priority: selectedMaintenance.priority,
        description: selectedMaintenance.description
      });
    } else {
      housekeepingStore.updateMaintenanceRequest(selectedMaintenance.id, selectedMaintenance);
    }

    trackEvent('HK.Maintenance.Updated', {
      requestId: selectedMaintenance.id,
      roomNumber: selectedMaintenance.roomNumber,
      status: selectedMaintenance.status
    });

    setMaintenanceModalOpen(false);
    loadData();
  };

  const handleQuickAction = (action: string, room: RoomStatusData) => {
    switch (action) {
      case 'clean':
        housekeepingStore.updateRoomStatus(room.roomNumber, 'dirty', 'Front Desk', 'Marked for cleaning');
        break;
      case 'maintenance':
        housekeepingStore.updateRoomStatus(room.roomNumber, 'out-of-order', 'Front Desk', 'Maintenance requested');
        break;
      case 'inspect':
        housekeepingStore.updateRoomStatus(room.roomNumber, 'clean', 'Front Desk', 'Ready for inspection');
        break;
      case 'block':
        housekeepingStore.updateRoomStatus(room.roomNumber, 'out-of-order', 'Front Desk', 'Room blocked');
        break;
    }
    
    trackEvent('HK.RoomStatus.QuickAction', {
      action,
      roomNumber: room.roomNumber,
      status: room.status
    });
    
    loadData();
  };

  const getStatusColor = (status: RoomStatus) => {
    switch (status) {
      case 'occupied': return 'success';
      case 'vacant': return 'default';
      case 'dirty': return 'warning';
      case 'clean': return 'primary';
      case 'inspected': return 'secondary';
      case 'out-of-order': return 'danger';
      case 'maintenance': return 'warning';
      default: return 'default';
    }
  };

  const getStatusIcon = (status: RoomStatus) => {
    switch (status) {
      case 'occupied': return '🟢';
      case 'vacant': return '⚪';
      case 'dirty': return '🟡';
      case 'clean': return '🔵';
      case 'inspected': return '🟣';
      case 'out-of-order': return '🔴';
      case 'maintenance': return '🟠';
      default: return '⚪';
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

  const getTaskStatusColor = (status: TaskStatus) => {
    switch (status) {
      case 'pending': return 'default';
      case 'in-progress': return 'warning';
      case 'completed': return 'success';
      case 'verified': return 'secondary';
      default: return 'default';
    }
  };

  const getMaintenanceStatusColor = (status: string) => {
    switch (status) {
      case 'reported': return 'default';
      case 'assigned': return 'warning';
      case 'in-progress': return 'primary';
      case 'completed': return 'success';
      case 'verified': return 'secondary';
      default: return 'default';
    }
  };

  const filteredRooms = rooms.filter(room => {
    if (searchTerm && !room.roomNumber.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    if (statusFilter !== 'all' && room.status !== statusFilter) return false;
    return true;
  });

  const filteredTasks = tasks.filter(task => {
    if (taskFilter !== 'all' && task.status !== taskFilter) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-ghana-black">📋 Room Status & Maintenance Tracking</h2>
          <p className="text-gray-600">Monitor room statuses, housekeeping tasks, and maintenance requests</p>
        </div>
        <div className="flex items-center space-x-4">
          <Button
            color="primary"
            variant="flat"
            onClick={handleCreateTask}
          >
            🧹 New Task
          </Button>
          <Button
            color="warning"
            variant="flat"
            onClick={handleCreateMaintenance}
          >
            🔧 New Maintenance
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card className="border-0 shadow-lg">
          <CardBody className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Rooms</p>
                <p className="text-2xl font-bold text-ghana-black">{rooms.length}</p>
              </div>
              <span className="text-2xl">🏠</span>
            </div>
          </CardBody>
        </Card>
        <Card className="border-0 shadow-lg">
          <CardBody className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Available</p>
                <p className="text-2xl font-bold text-green-600">
                  {rooms.filter(r => r.status === 'vacant').length}
                </p>
              </div>
              <span className="text-2xl">🆓</span>
            </div>
          </CardBody>
        </Card>
        <Card className="border-0 shadow-lg">
          <CardBody className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Pending Tasks</p>
                <p className="text-2xl font-bold text-yellow-600">
                  {tasks.filter(t => t.status === 'pending').length}
                </p>
              </div>
              <span className="text-2xl">⏳</span>
            </div>
          </CardBody>
        </Card>
        <Card className="border-0 shadow-lg">
          <CardBody className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Maintenance</p>
                <p className="text-2xl font-bold text-red-600">
                  {maintenanceRequests.filter(m => m.status !== 'completed').length}
                </p>
              </div>
              <span className="text-2xl">🔧</span>
            </div>
          </CardBody>
        </Card>
        <Card className="border-0 shadow-lg">
          <CardBody className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Staff Active</p>
                <p className="text-2xl font-bold text-blue-600">
                  {staff.filter(s => s.active).length}
                </p>
              </div>
              <span className="text-2xl">👥</span>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs aria-label="Room management tabs" className="w-full">
        <Tab key="rooms" title="🏠 Room Status">
          <div className="space-y-4">
            {/* Room Filters */}
            <Card className="border-0 shadow-lg">
              <CardBody className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                    <SelectItem key="all">All Statuses</SelectItem>
                    <SelectItem key="occupied">🟢 Occupied</SelectItem>
                    <SelectItem key="vacant">⚪ Vacant</SelectItem>
                    <SelectItem key="dirty">🟡 Dirty</SelectItem>
                    <SelectItem key="clean">🔵 Clean</SelectItem>
                    <SelectItem key="inspected">🟣 Inspected</SelectItem>
                    <SelectItem key="out-of-order">🔴 Out of Order</SelectItem>
                    <SelectItem key="maintenance">🟠 Maintenance</SelectItem>
                  </Select>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-600">Filtered:</span>
                    <Badge color="primary" variant="flat">{filteredRooms.length}</Badge>
                  </div>
                </div>
              </CardBody>
            </Card>

            {/* Room Status Table */}
            <Card className="border-0 shadow-lg">
              <CardHeader className="pb-3">
                <h3 className="text-xl font-semibold text-ghana-black">Room Status Overview</h3>
              </CardHeader>
              <CardBody className="p-0">
                <Table aria-label="Room status table">
                  <TableHeader>
                    <TableColumn>Room</TableColumn>
                    <TableColumn>Type</TableColumn>
                    <TableColumn>Status</TableColumn>
                    <TableColumn>Guest</TableColumn>
                    <TableColumn>Last Updated</TableColumn>
                    <TableColumn>Notes</TableColumn>
                    <TableColumn>Actions</TableColumn>
                  </TableHeader>
                  <TableBody>
                    {filteredRooms.map((room) => (
                      <TableRow 
                        key={room.roomNumber}
                        className="cursor-pointer hover:bg-gray-50"
                        onClick={() => handleRoomClick(room)}
                      >
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <span className="font-semibold text-ghana-black">{room.roomNumber}</span>
                            <span className="text-xs text-gray-500">Floor {room.roomNumber.charAt(0)}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Chip size="sm" variant="flat" color="secondary">
                            {frontOfficeStore.roomTypes.find(rt => rt.id === room.roomTypeId)?.name || 'Unknown'}
                          </Chip>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <span>{getStatusIcon(room.status)}</span>
                            <Badge 
                              color={getStatusColor(room.status) as any}
                              variant="flat"
                              size="sm"
                            >
                              {room.status}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          {room.currentGuest ? (
                            <span className="font-medium text-ghana-black">{room.currentGuest}</span>
                          ) : (
                            <span className="text-gray-400">No guest</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">
                            {new Date(room.lastUpdated).toLocaleString()}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-gray-600 max-w-[200px] truncate">
                            {room.notes || '-'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Dropdown>
                            <DropdownTrigger>
                              <Button size="sm" variant="light" isIconOnly>
                                ⚙️
                              </Button>
                            </DropdownTrigger>
                            <DropdownMenu aria-label="Quick actions">
                              <DropdownItem 
                                key="clean"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleQuickAction('clean', room);
                                }}
                              >
                                🧹 Mark for Cleaning
                              </DropdownItem>
                              <DropdownItem 
                                key="maintenance"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleQuickAction('maintenance', room);
                                }}
                              >
                                🔧 Report Issue
                              </DropdownItem>
                              <DropdownItem 
                                key="inspect"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleQuickAction('inspect', room);
                                }}
                              >
                                🔍 Ready for Inspection
                              </DropdownItem>
                              <DropdownItem 
                                key="block"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleQuickAction('block', room);
                                }}
                              >
                                🚫 Block Room
                              </DropdownItem>
                            </DropdownMenu>
                          </Dropdown>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardBody>
            </Card>
          </div>
        </Tab>

        <Tab key="tasks" title="🧹 Housekeeping Tasks">
          <div className="space-y-4">
            {/* Task Filters */}
            <Card className="border-0 shadow-lg">
              <CardBody className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Select
                    placeholder="Filter by status"
                    value={taskFilter}
                    onChange={(e) => setTaskFilter(e.target.value)}
                  >
                    <SelectItem key="all">All Statuses</SelectItem>
                    <SelectItem key="pending">⏳ Pending</SelectItem>
                    <SelectItem key="in-progress">🔄 In Progress</SelectItem>
                    <SelectItem key="completed">✅ Completed</SelectItem>
                    <SelectItem key="verified">🔍 Verified</SelectItem>
                  </Select>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-600">Total Tasks:</span>
                    <Badge color="primary" variant="flat">{filteredTasks.length}</Badge>
                  </div>
                </div>
              </CardBody>
            </Card>

            {/* Tasks Table */}
            <Card className="border-0 shadow-lg">
              <CardHeader className="pb-3">
                <h3 className="text-xl font-semibold text-ghana-black">Housekeeping Tasks</h3>
              </CardHeader>
              <CardBody className="p-0">
                <div className="max-h-[560px] overflow-y-auto">
                <Table aria-label="Tasks table">
                  <TableHeader>
                    <TableColumn>Task ID</TableColumn>
                    <TableColumn>Room</TableColumn>
                    <TableColumn>Type</TableColumn>
                    <TableColumn>Priority</TableColumn>
                    <TableColumn>Status</TableColumn>
                    <TableColumn>Assigned To</TableColumn>
                    <TableColumn>Progress</TableColumn>
                    <TableColumn>Actions</TableColumn>
                  </TableHeader>
                  <TableBody>
                    {filteredTasks.map((task) => (
                      <TableRow 
                        key={task.id}
                        className="cursor-pointer hover:bg-gray-50"
                        onClick={() => handleTaskClick(task)}
                      >
                        <TableCell>
                          <span className="font-semibold text-ghana-black">{task.id}</span>
                        </TableCell>
                        <TableCell>
                          <Chip size="sm" variant="flat" color="secondary">
                            {task.roomNumber}
                          </Chip>
                        </TableCell>
                        <TableCell>
                          <Chip size="sm" variant="flat" color="primary">
                            {task.taskType}
                          </Chip>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            color={getPriorityColor(task.priority) as any}
                            variant="flat"
                            size="sm"
                          >
                            {task.priority}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            color={getTaskStatusColor(task.status) as any}
                            variant="flat"
                            size="sm"
                          >
                            {task.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {task.assignedTo ? (
                            <div className="flex items-center space-x-2">
                              <Avatar size="sm" name={staff.find(s => s.id === task.assignedTo)?.name || 'Unknown'} />
                              <span className="text-sm">{staff.find(s => s.id === task.assignedTo)?.name || 'Unknown'}</span>
                            </div>
                          ) : (
                            <span className="text-gray-400">Unassigned</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="w-full">
                            <Progress 
                              value={(task.completedItems.length / task.checklist.length) * 100} 
                              color="primary"
                              size="sm"
                            />
                            <span className="text-xs text-gray-500">
                              {task.completedItems.length}/{task.checklist.length} items
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            color="primary"
                            variant="flat"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleTaskClick(task);
                            }}
                          >
                            👁️ View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
              </CardBody>
            </Card>
          </div>
        </Tab>

        <Tab key="maintenance" title="🔧 Maintenance Requests">
          <div className="space-y-4">
            {/* Maintenance Table */}
            <Card className="border-0 shadow-lg">
              <CardHeader className="pb-3">
                <h3 className="text-xl font-semibold text-ghana-black">Maintenance Requests</h3>
              </CardHeader>
              <CardBody className="p-0">
                <div className="max-h-[560px] overflow-y-auto">
                <Table aria-label="Maintenance requests table">
                  <TableHeader>
                    <TableColumn>Request ID</TableColumn>
                    <TableColumn>Room</TableColumn>
                    <TableColumn>Category</TableColumn>
                    <TableColumn>Priority</TableColumn>
                    <TableColumn>Status</TableColumn>
                    <TableColumn>Reported By</TableColumn>
                    <TableColumn>Reported At</TableColumn>
                    <TableColumn>Actions</TableColumn>
                  </TableHeader>
                  <TableBody>
                    {maintenanceRequests.map((request) => (
                      <TableRow 
                        key={request.id}
                        className="cursor-pointer hover:bg-gray-50"
                        onClick={() => handleMaintenanceClick(request)}
                      >
                        <TableCell>
                          <span className="font-semibold text-ghana-black">{request.id}</span>
                        </TableCell>
                        <TableCell>
                          <Chip size="sm" variant="flat" color="secondary">
                            {request.roomNumber}
                          </Chip>
                        </TableCell>
                        <TableCell>
                          <Chip size="sm" variant="flat" color="primary">
                            {request.category}
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
                            color={getMaintenanceStatusColor(request.status) as any}
                            variant="flat"
                            size="sm"
                          >
                            {request.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">{request.reportedBy}</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">
                            {new Date(request.reportedAt).toLocaleDateString()}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            color="primary"
                            variant="flat"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMaintenanceClick(request);
                            }}
                          >
                            👁️ View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
              </CardBody>
            </Card>
          </div>
        </Tab>
      </Tabs>

      {/* Room Status Modal */}
      <Modal isOpen={statusModalOpen} onClose={() => setStatusModalOpen(false)} size="2xl">
        <ModalContent>
          <ModalHeader>Room Status Details</ModalHeader>
          <ModalBody>
            {selectedRoom && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Room Number</label>
                    <Input value={selectedRoom.roomNumber} isReadOnly />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Room Type</label>
                    <Input 
                      value={frontOfficeStore.roomTypes.find(rt => rt.id === selectedRoom.roomTypeId)?.name || 'Unknown'} 
                      isReadOnly 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Current Status</label>
                    <div className="flex items-center space-x-2">
                      <span>{getStatusIcon(selectedRoom.status)}</span>
                      <Badge color={getStatusColor(selectedRoom.status) as any} variant="flat">
                        {selectedRoom.status}
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Last Updated</label>
                    <Input value={new Date(selectedRoom.lastUpdated).toLocaleString()} isReadOnly />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Current Guest</label>
                  <Input 
                    value={selectedRoom.currentGuest || 'No guest'} 
                    isReadOnly 
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <Textarea 
                    value={selectedRoom.notes || 'No notes'} 
                    isReadOnly 
                    rows={3}
                  />
                </div>

                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-medium text-gray-900 mb-2">Quick Actions</h4>
                  <div className="flex space-x-2">
                    <Button
                      size="sm"
                      color="warning"
                      variant="flat"
                      onClick={() => handleQuickAction('maintenance', selectedRoom)}
                    >
                      🔧 Report Issue
                    </Button>
                    <Button
                      size="sm"
                      color="primary"
                      variant="flat"
                      onClick={() => handleQuickAction('clean', selectedRoom)}
                    >
                      🧹 Mark for Cleaning
                    </Button>
                    <Button
                      size="sm"
                      color="secondary"
                      variant="flat"
                      onClick={() => handleQuickAction('inspect', selectedRoom)}
                    >
                      🔍 Ready for Inspection
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onClick={() => setStatusModalOpen(false)}>
              Close
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Task Modal */}
      <Modal isOpen={taskModalOpen} onClose={() => setTaskModalOpen(false)} size="2xl">
        <ModalContent>
          <ModalHeader>
            {isCreatingTask ? 'Create New Task' : 'Task Details'}
          </ModalHeader>
          <ModalBody>
            {selectedTask && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Room Number *</label>
                    <Input
                      value={selectedTask.roomNumber}
                      onChange={(e) => setSelectedTask({...selectedTask, roomNumber: e.target.value})}
                      placeholder="Room number"
                      isRequired
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Task Type *</label>
                    <Select
                      value={selectedTask.taskType}
                      onChange={(e) => setSelectedTask({...selectedTask, taskType: e.target.value as any})}
                      placeholder="Select task type"
                      isRequired
                    >
                      <SelectItem key="daily">Daily Cleaning</SelectItem>
                      <SelectItem key="turnover">Turnover</SelectItem>
                      <SelectItem key="deep-clean">Deep Clean</SelectItem>
                      <SelectItem key="maintenance">Maintenance</SelectItem>
                      <SelectItem key="inspection">Inspection</SelectItem>
                    </Select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Priority *</label>
                    <Select
                      value={selectedTask.priority}
                      onChange={(e) => setSelectedTask({...selectedTask, priority: e.target.value as any})}
                      placeholder="Select priority"
                      isRequired
                    >
                      <SelectItem key="low">Low</SelectItem>
                      <SelectItem key="medium">Medium</SelectItem>
                      <SelectItem key="high">High</SelectItem>
                      <SelectItem key="urgent">Urgent</SelectItem>
                    </Select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Estimated Minutes *</label>
                    <Input
                      type="number"
                      value={String(selectedTask.estimatedMinutes)}
                      onChange={(e) => setSelectedTask({...selectedTask, estimatedMinutes: parseInt(e.target.value) || 30})}
                      placeholder="30"
                      isRequired
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Checklist Items</label>
                  <Textarea
                    value={selectedTask.checklist.join('\n')}
                    onChange={(e) => setSelectedTask({
                      ...selectedTask, 
                      checklist: e.target.value.split('\n').filter(item => item.trim())
                    })}
                    placeholder="Enter checklist items, one per line"
                    rows={4}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <Textarea
                    value={selectedTask.notes || ''}
                    onChange={(e) => setSelectedTask({...selectedTask, notes: e.target.value})}
                    placeholder="Additional notes about this task"
                    rows={3}
                  />
                </div>
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            <Button color="primary" onClick={handleSaveTask}>
              {isCreatingTask ? '💾 Create Task' : '💾 Update Task'}
            </Button>
            <Button variant="light" onClick={() => setTaskModalOpen(false)}>
              Cancel
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Maintenance Modal */}
      <Modal isOpen={maintenanceModalOpen} onClose={() => setMaintenanceModalOpen(false)} size="2xl">
        <ModalContent>
          <ModalHeader>
            {isCreatingMaintenance ? 'Create Maintenance Request' : 'Maintenance Request Details'}
          </ModalHeader>
          <ModalBody>
            {selectedMaintenance && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Room Number *</label>
                    <Input
                      value={selectedMaintenance.roomNumber}
                      onChange={(e) => setSelectedMaintenance({...selectedMaintenance, roomNumber: e.target.value})}
                      placeholder="Room number"
                      isRequired
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
                    <Select
                      value={selectedMaintenance.category}
                      onChange={(e) => setSelectedMaintenance({...selectedMaintenance, category: e.target.value as any})}
                      placeholder="Select category"
                      isRequired
                    >
                      <SelectItem key="plumbing">Plumbing</SelectItem>
                      <SelectItem key="electrical">Electrical</SelectItem>
                      <SelectItem key="hvac">HVAC</SelectItem>
                      <SelectItem key="furniture">Furniture</SelectItem>
                      <SelectItem key="appliances">Appliances</SelectItem>
                      <SelectItem key="structural">Structural</SelectItem>
                      <SelectItem key="other">Other</SelectItem>
                    </Select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Priority *</label>
                    <Select
                      value={selectedMaintenance.priority}
                      onChange={(e) => setSelectedMaintenance({...selectedMaintenance, priority: e.target.value as any})}
                      placeholder="Select priority"
                      isRequired
                    >
                      <SelectItem key="low">Low</SelectItem>
                      <SelectItem key="medium">Medium</SelectItem>
                      <SelectItem key="high">High</SelectItem>
                      <SelectItem key="urgent">Urgent</SelectItem>
                    </Select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                    <Input value={selectedMaintenance.status} isReadOnly />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
                  <Textarea
                    value={selectedMaintenance.description}
                    onChange={(e) => setSelectedMaintenance({...selectedMaintenance, description: e.target.value})}
                    placeholder="Describe the issue in detail"
                    rows={4}
                    isRequired
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Reported By</label>
                  <Input value={selectedMaintenance.reportedBy} isReadOnly />
                </div>
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            <Button color="primary" onClick={handleSaveMaintenance}>
              {isCreatingMaintenance ? '💾 Create Request' : '💾 Update Request'}
            </Button>
            <Button variant="light" onClick={() => setMaintenanceModalOpen(false)}>
              Cancel
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
