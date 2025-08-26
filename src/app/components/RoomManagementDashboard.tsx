'use client';

import React, { useState, useEffect } from 'react';
import { 
  Card, CardBody, CardHeader, Button, Badge, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, 
  Input, Select, SelectItem, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Chip, Textarea,
  Tabs, Tab, Divider, Progress, Avatar, useDisclosure, Tooltip, Switch
} from '@heroui/react';
import { useSettingsStore } from '../lib/settings/store';
import { frontOfficeStore } from '../lib/frontoffice/store';
import { housekeepingStore } from '../lib/housekeeping/store';
import { trackEvent } from '../lib/analytics/trackEvent';

interface Room {
  id: string;
  number: string;
  type: string;
  floor: string;
  status: string;
  housekeepingStatus: string;
  currentGuest?: string;
  checkInDate?: string;
  checkOutDate?: string;
  lastCleaned?: string;
  nextCleaning?: string;
  notes: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
}

interface RoomAction {
  id: string;
  roomId: string;
  action: string;
  status: string;
  assignedTo?: string;
  priority: string;
  createdAt: string;
  dueDate?: string;
  notes?: string;
}

export default function RoomManagementDashboard() {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [selectedTab, setSelectedTab] = useState('overview');
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [selectedAction, setSelectedAction] = useState<RoomAction | null>(null);
  const [isActionModalOpen, setIsActionModalOpen] = useState(false);
  const [isRoomModalOpen, setIsRoomModalOpen] = useState(false);
  
  const settings = useSettingsStore();
  const [tick, setTick] = useState(0);
  
  // Subscribe to store updates
  useEffect(() => {
    const unsubscribe = frontOfficeStore.subscribe(() => setTick(t => t + 1));
    return unsubscribe;
  }, []);

  // Sample data - in real app, this would come from the stores
  const rooms: Room[] = [
    {
      id: '101',
      number: '101',
      type: 'Standard',
      floor: '1',
      status: 'occupied',
      housekeepingStatus: 'dirty',
      currentGuest: 'Kwame Asante',
      checkInDate: '2024-01-15',
      checkOutDate: '2024-01-17',
      lastCleaned: '2024-01-14',
      nextCleaning: '2024-01-17',
      notes: 'Guest requested extra towels',
      priority: 'medium'
    },
    {
      id: '102',
      number: '102',
      type: 'Standard',
      floor: '1',
      status: 'clean',
      housekeepingStatus: 'clean',
      lastCleaned: '2024-01-16',
      nextCleaning: '2024-01-17',
      notes: 'Ready for next guest',
      priority: 'low'
    },
    {
      id: '201',
      number: '201',
      type: 'Deluxe',
      floor: '2',
      status: 'maintenance',
      housekeepingStatus: 'out-of-order',
      notes: 'AC unit needs repair',
      priority: 'high'
    },
    {
      id: '202',
      number: '202',
      type: 'Deluxe',
      floor: '2',
      status: 'clean',
      housekeepingStatus: 'inspected',
      lastCleaned: '2024-01-16',
      nextCleaning: '2024-01-17',
      notes: 'Quality checked and approved',
      priority: 'low'
    }
  ];

  const roomActions: RoomAction[] = [
    {
      id: '1',
      roomId: '101',
      action: 'cleaning',
      status: 'pending',
      assignedTo: 'Efua Addo',
      priority: 'medium',
      createdAt: '2024-01-16T10:00:00Z',
      dueDate: '2024-01-16T14:00:00Z',
      notes: 'Standard turnover cleaning'
    },
    {
      id: '2',
      roomId: '201',
      action: 'maintenance',
      status: 'in-progress',
      assignedTo: 'Kofi Mensah',
      priority: 'high',
      createdAt: '2024-01-16T08:00:00Z',
      dueDate: '2024-01-16T16:00:00Z',
      notes: 'AC unit repair in progress'
    }
  ];

  const getStatusColor = (status: string) => {
    const statusConfig = settings.roomManagement.roomStatuses.find(s => s.id === status);
    if (statusConfig) {
      switch (statusConfig.color) {
        case 'success': return 'success';
        case 'warning': return 'warning';
        case 'danger': return 'danger';
        case 'primary': return 'primary';
        case 'secondary': return 'secondary';
        default: return 'default';
      }
    }
    return 'default';
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'danger';
      case 'high': return 'warning';
      case 'medium': return 'primary';
      case 'low': return 'success';
      default: return 'default';
    }
  };

  const getActionStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'warning';
      case 'in-progress': return 'primary';
      case 'completed': return 'success';
      case 'verified': return 'secondary';
      default: return 'default';
    }
  };

  const handleStatusChange = (roomId: string, newStatus: string, reason?: string) => {
    // Check if status change is allowed based on rules
    const currentRoom = rooms.find(r => r.id === roomId);
    if (!currentRoom) return;

    const rule = settings.roomManagement.statusChangeRules.find(
      r => r.fromStatus === currentRoom.status && r.toStatus === newStatus
    );

    if (rule) {
      // Apply auto-actions
      if (rule.autoActions.includes('create-cleaning-task') && newStatus === 'dirty') {
        // Create cleaning task
        trackEvent('RM.RoomStatusChanged', { roomId, fromStatus: currentRoom.status, toStatus: newStatus, reason });
      }
      
      if (rule.autoActions.includes('block-booking') && newStatus === 'out-of-order') {
        // Block room from booking
        trackEvent('RM.RoomBlocked', { roomId, reason: 'Maintenance required' });
      }
    }

    // Update room status
    trackEvent('RM.RoomStatusChanged', { roomId, fromStatus: currentRoom.status, toStatus: newStatus, reason });
  };

  const renderOverview = () => (
    <div className="space-y-6">
      {/* Room Status Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {settings.roomManagement.roomStatuses.filter(s => s.isActive).map(status => {
          const count = rooms.filter(r => r.status === status.id).length;
          return (
            <Card key={status.id} className="border-0 shadow-lg">
              <CardBody className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">{status.name}</p>
                    <p className="text-2xl font-bold text-ghana-black">{count}</p>
                  </div>
                  <Badge color={getStatusColor(status.id)} size="lg">
                    {status.id}
                  </Badge>
                </div>
                <p className="text-xs text-gray-500 mt-2">{status.description}</p>
              </CardBody>
            </Card>
          );
        })}
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
              onClick={() => setIsRoomModalOpen(true)}
            >
              <span className="text-2xl">🏠</span>
              <span className="text-sm font-medium">Add Room</span>
            </Button>
            <Button
              variant="flat"
              className="bg-ghana-gold text-white h-20 flex flex-col items-center justify-center space-y-2"
              size="lg"
              onClick={() => setIsActionModalOpen(true)}
            >
              <span className="text-2xl">📋</span>
              <span className="text-sm font-medium">Create Task</span>
            </Button>
            <Button
              variant="flat"
              className="bg-blue-500 text-white h-20 flex flex-col items-center justify-center space-y-2"
              size="lg"
            >
              <span className="text-2xl">🔍</span>
              <span className="text-sm font-medium">Room Inspection</span>
            </Button>
            <Button
              variant="flat"
              className="bg-purple-500 text-white h-20 flex flex-col items-center justify-center space-y-2"
              size="lg"
            >
              <span className="text-2xl">📊</span>
              <span className="text-sm font-medium">Reports</span>
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Recent Activity */}
      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-3">
          <h3 className="text-xl font-semibold text-ghana-black">📋 Recent Activity</h3>
        </CardHeader>
        <CardBody>
          <div className="space-y-4">
            {roomActions.slice(0, 5).map(action => (
              <div key={action.id} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                <div className={`h-3 w-3 rounded-full ${
                  action.status === 'completed' ? 'bg-green-500' :
                  action.status === 'in-progress' ? 'bg-blue-500' :
                  'bg-yellow-500'
                }`}></div>
                <span className="text-sm text-gray-800">
                  {action.action} task for Room {action.roomId} - {action.status} 
                  {action.assignedTo && ` (${action.assignedTo})`}
                </span>
                <span className="text-xs text-gray-500">
                  {new Date(action.createdAt).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>
    </div>
  );

  const renderRoomGrid = () => (
    <div className="space-y-6">
      {/* Room Grid */}
      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold text-ghana-black">🏠 Room Status Grid</h3>
            <div className="flex gap-2">
              <Select
                label="Floor"
                placeholder="All Floors"
                className="w-32"
              >
                <SelectItem key="all" value="all">All Floors</SelectItem>
                <SelectItem key="1" value="1">Floor 1</SelectItem>
                <SelectItem key="2" value="2">Floor 2</SelectItem>
                <SelectItem key="3" value="3">Floor 3</SelectItem>
              </Select>
              <Select
                label="Status"
                placeholder="All Statuses"
                className="w-40"
              >
                <SelectItem key="all" value="all">All Statuses</SelectItem>
                {settings.roomManagement.roomStatuses.filter(s => s.isActive).map(status => (
                  <SelectItem key={status.id} value={status.id}>{status.name}</SelectItem>
                ))}
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {rooms.map((room) => (
              <Tooltip key={room.id} content={`Room ${room.number} - ${room.status}`} placement="top">
                <div
                  className={`p-3 rounded-lg border-2 cursor-pointer transition-all hover:shadow-md ${
                    room.status === 'clean' ? 'bg-green-50 border-green-200' :
                    room.status === 'occupied' ? 'bg-blue-50 border-blue-200' :
                    room.status === 'dirty' ? 'bg-red-50 border-red-200' :
                    room.status === 'maintenance' ? 'bg-yellow-50 border-yellow-200' :
                    room.status === 'out-of-order' ? 'bg-orange-50 border-orange-200' :
                    'bg-gray-50 border-gray-200'
                  }`}
                  onClick={() => {
                    setSelectedRoom(room);
                    setIsRoomModalOpen(true);
                  }}
                >
                  <div className="text-center">
                    <div className="font-bold text-ghana-black">{room.number}</div>
                    <div className="text-xs text-gray-600">{room.type}</div>
                    <div className="mt-1 flex items-center justify-center gap-1">
                      <Badge size="sm" variant="flat" color={getStatusColor(room.status)}>
                        {room.status}
                      </Badge>
                    </div>
                    {room.currentGuest && (
                      <div className="text-xs text-gray-500 mt-1 truncate">
                        {room.currentGuest}
                      </div>
                    )}
                  </div>
                </div>
              </Tooltip>
            ))}
          </div>
        </CardBody>
      </Card>
    </div>
  );

  const renderTasks = () => (
    <div className="space-y-6">
      {/* Task Management */}
      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold text-ghana-black">📋 Task Management</h3>
            <Button
              color="primary"
              className="bg-ghana-green text-white"
              variant="flat"
              onClick={() => setIsActionModalOpen(true)}
            >
              ➕ Create Task
            </Button>
          </div>
        </CardHeader>
        <CardBody>
          <Table aria-label="Room tasks table">
            <TableHeader>
              <TableColumn>Room</TableColumn>
              <TableColumn>Action</TableColumn>
              <TableColumn>Status</TableColumn>
              <TableColumn>Assigned To</TableColumn>
              <TableColumn>Priority</TableColumn>
              <TableColumn>Due Date</TableColumn>
              <TableColumn>Actions</TableColumn>
            </TableHeader>
            <TableBody>
              {roomActions.map((action) => (
                <TableRow key={action.id}>
                  <TableCell className="font-semibold">{action.roomId}</TableCell>
                  <TableCell>
                    <Chip color="primary" size="sm" variant="flat">
                      {action.action}
                    </Chip>
                  </TableCell>
                  <TableCell>
                    <Badge color={getActionStatusColor(action.status)} size="sm">
                      {action.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{action.assignedTo || 'Unassigned'}</TableCell>
                  <TableCell>
                    <Badge color={getPriorityColor(action.priority)} size="sm">
                      {action.priority}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {action.dueDate ? new Date(action.dueDate).toLocaleDateString() : '-'}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button size="sm" variant="flat" color="primary">
                        Edit
                      </Button>
                      <Button size="sm" variant="flat" color="success">
                        Complete
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

  const renderSettings = () => (
    <div className="space-y-6">
      {/* Module Activation */}
      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-3">
          <h3 className="text-xl font-semibold text-ghana-black">⚙️ Module Configuration</h3>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold mb-3">Core Modules</h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Front Office</span>
                  <Switch isSelected={settings.moduleSettings.frontOffice} isDisabled />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Room Management</span>
                  <Switch isSelected={true} isDisabled />
                </div>
              </div>
            </div>
            <div>
              <h4 className="font-semibold mb-3">Optional Modules</h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Housekeeping</span>
                  <Switch 
                    isSelected={settings.moduleSettings.housekeeping}
                    onValueChange={() => settings.toggleModule('housekeeping')}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Maintenance</span>
                  <Switch 
                    isSelected={settings.moduleSettings.maintenance}
                    onValueChange={() => settings.toggleModule('maintenance')}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Analytics</span>
                  <Switch 
                    isSelected={settings.moduleSettings.analytics}
                    onValueChange={() => settings.toggleModule('analytics')}
                  />
                </div>
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Room Configuration */}
      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-3">
          <h3 className="text-xl font-semibold text-ghana-black">🏠 Room Configuration</h3>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold mb-3">Room Types</h4>
              <div className="space-y-2">
                {settings.roomManagement.roomTypes.map(type => (
                  <div key={type.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <span className="text-sm">{type.name}</span>
                    <Badge color={type.isActive ? 'success' : 'default'} size="sm">
                      {type.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h4 className="font-semibold mb-3">Status Configuration</h4>
              <div className="space-y-2">
                {settings.roomManagement.roomStatuses.map(status => (
                  <div key={status.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <span className="text-sm">{status.name}</span>
                    <div className="flex gap-2">
                      <Badge color={status.canBook ? 'success' : 'default'} size="sm">
                        {status.canBook ? 'Bookable' : 'Not Bookable'}
                      </Badge>
                      <Badge color={status.requiresAction ? 'warning' : 'default'} size="sm">
                        {status.requiresAction ? 'Action Required' : 'No Action'}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-ghana-black">🏠 Room Management</h1>
          <p className="text-gray-600">Complete lifecycle management for all rooms and facilities</p>
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
        <Tab key="grid" title="Room Grid" />
        <Tab key="tasks" title="Tasks" />
        <Tab key="settings" title="Configuration" />
      </Tabs>

      <div className="mt-6">
        {selectedTab === 'overview' && renderOverview()}
        {selectedTab === 'grid' && renderRoomGrid()}
        {selectedTab === 'tasks' && renderTasks()}
        {selectedTab === 'settings' && renderSettings()}
      </div>

      {/* Room Details Modal */}
      <Modal isOpen={isRoomModalOpen} onClose={() => setIsRoomModalOpen(false)} size="2xl">
        <ModalContent>
          <ModalHeader>Room Details - {selectedRoom?.number}</ModalHeader>
          <ModalBody>
            {selectedRoom && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Room Number</label>
                    <Input value={selectedRoom.number} readOnly />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Type</label>
                    <Input value={selectedRoom.type} readOnly />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Floor</label>
                    <Input value={selectedRoom.floor} readOnly />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Status</label>
                    <Select
                      selectedKeys={[selectedRoom.status]}
                      onChange={(e) => handleStatusChange(selectedRoom.id, e.target.value)}
                    >
                      {settings.roomManagement.roomStatuses.filter(s => s.isActive).map(status => (
                        <SelectItem key={status.id} value={status.id}>{status.name}</SelectItem>
                      ))}
                    </Select>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">Notes</label>
                  <Textarea value={selectedRoom.notes} placeholder="Add notes about this room..." />
                </div>
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            <Button color="danger" variant="light" onPress={() => setIsRoomModalOpen(false)}>
              Close
            </Button>
            <Button color="primary" onPress={() => setIsRoomModalOpen(false)}>
              Save Changes
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Task Creation Modal */}
      <Modal isOpen={isActionModalOpen} onClose={() => setIsActionModalOpen(false)} size="2xl">
        <ModalContent>
          <ModalHeader>Create New Task</ModalHeader>
          <ModalBody>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Room</label>
                  <Select placeholder="Select room">
                    {rooms.map(room => (
                      <SelectItem key={room.id} value={room.id}>{room.number}</SelectItem>
                    ))}
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Action Type</label>
                  <Select placeholder="Select action">
                    <SelectItem key="cleaning" value="cleaning">Cleaning</SelectItem>
                    <SelectItem key="maintenance" value="maintenance">Maintenance</SelectItem>
                    <SelectItem key="inspection" value="inspection">Inspection</SelectItem>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Priority</label>
                  <Select placeholder="Select priority">
                    <SelectItem key="low" value="low">Low</SelectItem>
                    <SelectItem key="medium" value="medium">Medium</SelectItem>
                    <SelectItem key="high" value="high">High</SelectItem>
                    <SelectItem key="urgent" value="urgent">Urgent</SelectItem>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Due Date</label>
                  <Input type="datetime-local" />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Notes</label>
                <Textarea placeholder="Describe the task..." />
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button color="danger" variant="light" onPress={() => setIsActionModalOpen(false)}>
              Cancel
            </Button>
            <Button color="primary" onPress={() => setIsActionModalOpen(false)}>
              Create Task
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
