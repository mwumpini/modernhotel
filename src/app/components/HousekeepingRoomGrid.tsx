'use client';

import React, { useState } from 'react';
import { Card, CardBody, CardHeader, Button, Input, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, Chip, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Select, SelectItem, Divider, Badge, Progress, Tabs, Tab } from "@heroui/react";

interface Room {
  id: string;
  number: string;
  type: 'standard' | 'deluxe' | 'suite' | 'presidential';
  floor: number;
  status: 'occupied' | 'vacant' | 'cleaning' | 'maintenance' | 'reserved' | 'out-of-order';
  housekeepingStatus: 'clean' | 'dirty' | 'inspected' | 'cleaning-in-progress';
  lastCleaned: Date;
  nextCleaning: Date;
  currentGuest?: string;
  checkInDate?: Date;
  checkOutDate?: Date;
  notes: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
}

interface CleaningTask {
  id: string;
  roomNumber: string;
  assignedTo: string;
  type: 'daily' | 'deep' | 'turnover' | 'maintenance';
  status: 'pending' | 'in-progress' | 'completed' | 'verified';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  estimatedTime: number;
  actualTime?: number;
  startTime?: Date;
  completionTime?: Date;
  notes: string;
  checklist: CleaningChecklistItem[];
}

interface CleaningChecklistItem {
  id: string;
  task: string;
  completed: boolean;
  verified: boolean;
  notes: string;
}

interface Housekeeper {
  id: string;
  name: string;
  status: 'available' | 'busy' | 'on-break' | 'off-duty';
  assignedRooms: string[];
  currentTask?: string;
  efficiency: number;
  completedTasks: number;
  shift: 'morning' | 'afternoon' | 'evening';
}

export default function HousekeepingRoomGrid() {
  const [selectedTab, setSelectedTab] = useState('grid');
  const [isNewTaskModalOpen, setIsNewTaskModalOpen] = useState(false);
  const [selectedFloor, setSelectedFloor] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);

  // Sample data
  const rooms: Room[] = [
    {
      id: '1',
      number: '101',
      type: 'standard',
      floor: 1,
      status: 'occupied',
      housekeepingStatus: 'dirty',
      lastCleaned: new Date(Date.now() - 24 * 60 * 60 * 1000),
      nextCleaning: new Date(Date.now() + 24 * 60 * 60 * 1000),
      currentGuest: 'Kwame Asante',
      checkInDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      checkOutDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
      notes: 'Guest requested extra towels',
      priority: 'medium'
    },
    {
      id: '2',
      number: '102',
      type: 'standard',
      floor: 1,
      status: 'vacant',
      housekeepingStatus: 'clean',
      lastCleaned: new Date(Date.now() - 2 * 60 * 60 * 1000),
      nextCleaning: new Date(Date.now() + 22 * 60 * 60 * 1000),
      notes: 'Ready for next guest',
      priority: 'low'
    },
    {
      id: '3',
      number: '103',
      type: 'deluxe',
      floor: 1,
      status: 'cleaning',
      housekeepingStatus: 'cleaning-in-progress',
      lastCleaned: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      nextCleaning: new Date(Date.now()),
      notes: 'Deep cleaning in progress',
      priority: 'high'
    },
    {
      id: '4',
      number: '201',
      type: 'suite',
      floor: 2,
      status: 'occupied',
      housekeepingStatus: 'clean',
      lastCleaned: new Date(Date.now() - 12 * 60 * 60 * 1000),
      nextCleaning: new Date(Date.now() + 12 * 60 * 60 * 1000),
      currentGuest: 'Ama Osei',
      checkInDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      checkOutDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      notes: 'VIP guest - special attention required',
      priority: 'high'
    },
    {
      id: '5',
      number: '202',
      type: 'standard',
      floor: 2,
      status: 'maintenance',
      housekeepingStatus: 'dirty',
      lastCleaned: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      nextCleaning: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
      notes: 'AC repair needed',
      priority: 'urgent'
    },
    {
      id: '6',
      number: '301',
      type: 'presidential',
      floor: 3,
      status: 'reserved',
      housekeepingStatus: 'inspected',
      lastCleaned: new Date(Date.now() - 1 * 60 * 60 * 1000),
      nextCleaning: new Date(Date.now() + 23 * 60 * 60 * 1000),
      notes: 'Reserved for tomorrow - final inspection done',
      priority: 'high'
    }
  ];

  const cleaningTasks: CleaningTask[] = [
    {
      id: '1',
      roomNumber: '103',
      assignedTo: 'Efua Addo',
      type: 'deep',
      status: 'in-progress',
      priority: 'high',
      estimatedTime: 45,
      startTime: new Date(Date.now() - 30 * 60 * 1000),
      notes: 'Deep cleaning after long-term guest',
      checklist: [
        { id: '1', task: 'Change bed linens', completed: true, verified: false, notes: '' },
        { id: '2', task: 'Clean bathroom', completed: true, verified: false, notes: '' },
        { id: '3', task: 'Vacuum carpet', completed: false, verified: false, notes: '' },
        { id: '4', task: 'Dust surfaces', completed: false, verified: false, notes: '' },
        { id: '5', task: 'Restock amenities', completed: false, verified: false, notes: '' }
      ]
    },
    {
      id: '2',
      roomNumber: '101',
      assignedTo: 'Kofi Mensah',
      type: 'daily',
      status: 'pending',
      priority: 'medium',
      estimatedTime: 20,
      notes: 'Regular daily cleaning',
      checklist: [
        { id: '1', task: 'Make bed', completed: false, verified: false, notes: '' },
        { id: '2', task: 'Clean bathroom', completed: false, verified: false, notes: '' },
        { id: '3', task: 'Empty trash', completed: false, verified: false, notes: '' },
        { id: '4', task: 'Restock towels', completed: false, verified: false, notes: '' }
      ]
    }
  ];

  const housekeepers: Housekeeper[] = [
    {
      id: '1',
      name: 'Efua Addo',
      status: 'busy',
      assignedRooms: ['103', '104'],
      currentTask: 'Deep cleaning Room 103',
      efficiency: 92,
      completedTasks: 8,
      shift: 'morning'
    },
    {
      id: '2',
      name: 'Kofi Mensah',
      status: 'available',
      assignedRooms: ['101', '102'],
      efficiency: 88,
      completedTasks: 6,
      shift: 'morning'
    },
    {
      id: '3',
      name: 'Ama Serwaa',
      status: 'on-break',
      assignedRooms: ['201', '202'],
      efficiency: 95,
      completedTasks: 10,
      shift: 'afternoon'
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'occupied': return 'warning';
      case 'vacant': return 'success';
      case 'cleaning': return 'primary';
      case 'maintenance': return 'danger';
      case 'reserved': return 'secondary';
      case 'out-of-order': return 'danger';
      default: return 'default';
    }
  };

  const getHousekeepingStatusColor = (status: string) => {
    switch (status) {
      case 'clean': return 'success';
      case 'dirty': return 'danger';
      case 'inspected': return 'primary';
      case 'cleaning-in-progress': return 'warning';
      default: return 'default';
    }
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

  const getTaskStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'warning';
      case 'in-progress': return 'primary';
      case 'completed': return 'success';
      case 'verified': return 'secondary';
      default: return 'default';
    }
  };

  const getHousekeeperStatusColor = (status: string) => {
    switch (status) {
      case 'available': return 'success';
      case 'busy': return 'warning';
      case 'on-break': return 'secondary';
      case 'off-duty': return 'danger';
      default: return 'default';
    }
  };

  const getRoomTypeColor = (type: string) => {
    switch (type) {
      case 'standard': return 'primary';
      case 'deluxe': return 'secondary';
      case 'suite': return 'success';
      case 'presidential': return 'warning';
      default: return 'default';
    }
  };

  const filteredRooms = rooms.filter(room => {
    const floorMatch = selectedFloor === 'all' || room.floor.toString() === selectedFloor;
    const statusMatch = selectedStatus === 'all' || room.status === selectedStatus;
    return floorMatch && statusMatch;
  });

  const getCleaningProgress = (task: CleaningTask) => {
    const completedItems = task.checklist.filter(item => item.completed).length;
    return (completedItems / task.checklist.length) * 100;
  };

  const getTimeElapsed = (startTime: Date) => {
    return Math.floor((Date.now() - startTime.getTime()) / 60000);
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-ghana-black">🛏️ Housekeeping - Room Status Grid</h2>
          <p className="text-gray-600">Monitor room status, cleaning tasks, and housekeeping operations</p>
        </div>
        <Button 
          color="primary" 
          className="bg-ghana-green text-white"
          onClick={() => setIsNewTaskModalOpen(true)}
        >
          + New Cleaning Task
        </Button>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card className="border-0 shadow-lg">
          <CardBody className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Rooms</p>
                <p className="text-2xl font-bold text-ghana-black">{rooms.length}</p>
                <p className="text-sm text-blue-600">{rooms.filter(r => r.status === 'occupied').length} occupied</p>
              </div>
              <div className="text-3xl">🏠</div>
            </div>
          </CardBody>
        </Card>
        
        <Card className="border-0 shadow-lg">
          <CardBody className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Need Cleaning</p>
                <p className="text-2xl font-bold text-ghana-black">{rooms.filter(r => r.housekeepingStatus === 'dirty').length}</p>
                <p className="text-sm text-warning">Priority attention</p>
              </div>
              <div className="text-3xl">🧹</div>
            </div>
          </CardBody>
        </Card>
        
        <Card className="border-0 shadow-lg">
          <CardBody className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Tasks</p>
                <p className="text-2xl font-bold text-ghana-black">{cleaningTasks.filter(t => t.status === 'in-progress').length}</p>
                <p className="text-sm text-green-600">In progress</p>
              </div>
              <div className="text-3xl">📋</div>
            </div>
          </CardBody>
        </Card>
        
        <Card className="border-0 shadow-lg">
          <CardBody className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Available Staff</p>
                <p className="text-2xl font-bold text-ghana-black">{housekeepers.filter(h => h.status === 'available').length}</p>
                <p className="text-sm text-green-600">Ready for tasks</p>
              </div>
              <div className="text-3xl">👥</div>
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
            <Tab key="grid" title="🏠 Room Grid">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex gap-4">
                    <Select
                      label="Filter by Floor"
                      placeholder="All Floors"
                      value={selectedFloor}
                      onChange={(e) => setSelectedFloor(e.target.value)}
                      className="w-32"
                    >
                      <SelectItem key="all" value="all">All</SelectItem>
                      <SelectItem key="1" value="1">Floor 1</SelectItem>
                      <SelectItem key="2" value="2">Floor 2</SelectItem>
                      <SelectItem key="3" value="3">Floor 3</SelectItem>
                    </Select>
                    <Select
                      label="Filter by Status"
                      placeholder="All Status"
                      value={selectedStatus}
                      onChange={(e) => setSelectedStatus(e.target.value)}
                      className="w-40"
                    >
                      <SelectItem key="all" value="all">All Status</SelectItem>
                      <SelectItem key="occupied" value="occupied">Occupied</SelectItem>
                      <SelectItem key="vacant" value="vacant">Vacant</SelectItem>
                      <SelectItem key="cleaning" value="cleaning">Cleaning</SelectItem>
                      <SelectItem key="maintenance" value="maintenance">Maintenance</SelectItem>
                      <SelectItem key="reserved" value="reserved">Reserved</SelectItem>
                    </Select>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {filteredRooms.map((room) => (
                    <Card 
                      key={room.id} 
                      className={`border-2 cursor-pointer transition-colors hover:shadow-lg ${
                        room.housekeepingStatus === 'dirty' ? 'border-red-200 hover:border-red-400' :
                        room.housekeepingStatus === 'cleaning-in-progress' ? 'border-yellow-200 hover:border-yellow-400' :
                        room.housekeepingStatus === 'clean' ? 'border-green-200 hover:border-green-400' :
                        'border-blue-200 hover:border-blue-400'
                      }`}
                      onClick={() => setSelectedRoom(room)}
                    >
                      <CardBody className="p-4">
                        <div className="text-center">
                          <div className="flex items-center justify-between mb-2">
                            <h3 className="text-lg font-bold text-ghana-black">Room {room.number}</h3>
                            <Chip color={getPriorityColor(room.priority)} size="sm">
                              {room.priority.toUpperCase()}
                            </Chip>
                          </div>
                          
                          <div className="space-y-2 mb-3">
                            <div className="flex items-center justify-between text-sm">
                              <span>Type:</span>
                              <Badge color={getRoomTypeColor(room.type)} variant="flat" size="sm">
                                {room.type.charAt(0).toUpperCase() + room.type.slice(1)}
                              </Badge>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                              <span>Status:</span>
                              <Chip color={getStatusColor(room.status)} size="sm">
                                {room.status.charAt(0).toUpperCase() + room.status.slice(1)}
                              </Chip>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                              <span>Housekeeping:</span>
                              <Chip color={getHousekeepingStatusColor(room.housekeepingStatus)} size="sm">
                                {room.housekeepingStatus.replace('-', ' ').charAt(0).toUpperCase() + room.housekeepingStatus.replace('-', ' ').slice(1)}
                              </Chip>
                            </div>
                          </div>
                          
                          {room.currentGuest && (
                            <div className="mb-3 p-2 bg-blue-50 rounded">
                              <p className="text-sm font-medium text-blue-800">Guest: {room.currentGuest}</p>
                              <p className="text-xs text-blue-600">
                                Check-out: {room.checkOutDate?.toLocaleDateString()}
                              </p>
                            </div>
                          )}
                          
                          {room.notes && (
                            <div className="mb-3 p-2 bg-yellow-50 rounded">
                              <p className="text-xs text-yellow-800">{room.notes}</p>
                            </div>
                          )}
                          
                          <div className="text-xs text-gray-500 mb-3">
                            <p>Last cleaned: {room.lastCleaned.toLocaleDateString()}</p>
                            <p>Next cleaning: {room.nextCleaning.toLocaleDateString()}</p>
                          </div>
                          
                          <div className="flex gap-2">
                            <Button size="sm" color="primary" variant="flat">View Details</Button>
                            <Button size="sm" color="success" variant="flat">Assign Task</Button>
                          </div>
                        </div>
                      </CardBody>
                    </Card>
                  ))}
                </div>
              </div>
            </Tab>

            <Tab key="tasks" title="📋 Cleaning Tasks">
              <div className="p-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {cleaningTasks.map((task) => (
                    <Card key={task.id} className="border border-gray-200 hover:border-ghana-green transition-colors">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="text-lg font-semibold text-ghana-black">Room {task.roomNumber}</h3>
                            <p className="text-sm text-gray-600">Assigned to: {task.assignedTo}</p>
                          </div>
                          <div className="flex gap-2">
                            <Chip color={getTaskStatusColor(task.status)} size="sm">
                              {task.status.charAt(0).toUpperCase() + task.status.slice(1)}
                            </Chip>
                            <Chip color={getPriorityColor(task.priority)} size="sm">
                              {task.priority.toUpperCase()}
                            </Chip>
                          </div>
                        </div>
                      </CardHeader>
                      <CardBody>
                        <div className="space-y-3">
                          <div className="flex items-center justify-between text-sm">
                            <span>Type: {task.type.charAt(0).toUpperCase() + task.type.slice(1)} Cleaning</span>
                            <span>Est. Time: {task.estimatedTime}min</span>
                          </div>
                          
                          {task.startTime && (
                            <div className="text-sm text-gray-600">
                              Started: {task.startTime.toLocaleTimeString()} 
                              ({getTimeElapsed(task.startTime)}min ago)
                            </div>
                          )}
                          
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                              <span>Progress:</span>
                              <span>{Math.round(getCleaningProgress(task))}%</span>
                            </div>
                            <Progress 
                              value={getCleaningProgress(task)} 
                              color={getCleaningProgress(task) === 100 ? 'success' : 'primary'}
                              className="w-full"
                            />
                          </div>
                          
                          <div className="space-y-2">
                            <p className="text-sm font-medium text-gray-700">Checklist:</p>
                            {task.checklist.map((item) => (
                              <div key={item.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                                <span className="text-sm">{item.task}</span>
                                <div className="flex gap-2">
                                  <Chip 
                                    color={item.completed ? 'success' : 'default'} 
                                    size="sm"
                                  >
                                    {item.completed ? '✓' : '○'}
                                  </Chip>
                                  {item.completed && (
                                    <Chip 
                                      color={item.verified ? 'success' : 'warning'} 
                                      size="sm"
                                    >
                                      {item.verified ? '✓' : '!'}
                                    </Chip>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                          
                          {task.notes && (
                            <div className="p-2 bg-yellow-50 border border-yellow-200 rounded">
                              <p className="text-sm text-yellow-800">📝 {task.notes}</p>
                            </div>
                          )}
                          
                          <div className="flex gap-2">
                            <Button size="sm" color="primary" variant="flat">Update Progress</Button>
                            <Button size="sm" color="success" variant="flat">Mark Complete</Button>
                          </div>
                        </div>
                      </CardBody>
                    </Card>
                  ))}
                </div>
              </div>
            </Tab>

            <Tab key="staff" title="👥 Housekeeping Staff">
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {housekeepers.map((housekeeper) => (
                    <Card key={housekeeper.id} className="border border-gray-200 hover:border-ghana-green transition-colors">
                      <CardBody className="p-4">
                        <div className="text-center">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="font-semibold text-ghana-black">{housekeeper.name}</h4>
                            <Chip color={getHousekeeperStatusColor(housekeeper.status)} size="sm">
                              {housekeeper.status.replace('-', ' ').charAt(0).toUpperCase() + housekeeper.status.replace('-', ' ').slice(1)}
                            </Chip>
                          </div>
                          
                          <div className="space-y-2 mb-3">
                            <div className="text-sm">
                              <span className="font-medium">Shift:</span> 
                              <Badge color="primary" variant="flat" className="ml-1">{housekeeper.shift}</Badge>
                            </div>
                            <div className="text-sm">
                              <span className="font-medium">Efficiency:</span> {housekeeper.efficiency}%
                            </div>
                            <div className="text-sm">
                              <span className="font-medium">Completed Today:</span> {housekeeper.completedTasks}
                            </div>
                          </div>
                          
                          <div className="mb-3">
                            <div className="flex items-center justify-between text-sm mb-1">
                              <span>Efficiency:</span>
                              <span>{housekeeper.efficiency}%</span>
                            </div>
                            <Progress value={housekeeper.efficiency} color="success" className="w-full" />
                          </div>
                          
                          <div className="mb-3">
                            <p className="text-sm font-medium text-gray-700 mb-1">Assigned Rooms:</p>
                            <div className="flex flex-wrap gap-1 justify-center">
                              {housekeeper.assignedRooms.length > 0 ? (
                                housekeeper.assignedRooms.map((room) => (
                                  <Badge key={room} color="secondary" variant="flat" size="sm">
                                    {room}
                                  </Badge>
                                ))
                              ) : (
                                <span className="text-gray-500 text-sm">None</span>
                              )}
                            </div>
                          </div>
                          
                          {housekeeper.currentTask && (
                            <div className="mb-3 p-2 bg-blue-50 rounded">
                              <p className="text-sm font-medium text-blue-800">Current Task:</p>
                              <p className="text-xs text-blue-600">{housekeeper.currentTask}</p>
                            </div>
                          )}
                          
                          <div className="flex gap-2">
                            <Button size="sm" color="primary" variant="flat">View Details</Button>
                            <Button size="sm" color="success" variant="flat">Assign Task</Button>
                          </div>
                        </div>
                      </CardBody>
                    </Card>
                  ))}
                </div>
              </div>
            </Tab>
          </Tabs>
        </CardBody>
      </Card>

      {/* Room Details Modal */}
      <Modal isOpen={!!selectedRoom} onClose={() => setSelectedRoom(null)} size="2xl">
        <ModalContent>
          <ModalHeader>Room {selectedRoom?.number} Details</ModalHeader>
          <ModalBody>
            {selectedRoom && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-700">Room Information</p>
                    <div className="space-y-2 mt-2">
                      <div className="flex justify-between">
                        <span className="text-sm">Room Number:</span>
                        <span className="text-sm font-medium">{selectedRoom.number}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm">Type:</span>
                        <Badge color={getRoomTypeColor(selectedRoom.type)} variant="flat" size="sm">
                          {selectedRoom.type.charAt(0).toUpperCase() + selectedRoom.type.slice(1)}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm">Floor:</span>
                        <span className="text-sm font-medium">{selectedRoom.floor}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm">Status:</span>
                        <Chip color={getStatusColor(selectedRoom.status)} size="sm">
                          {selectedRoom.status.charAt(0).toUpperCase() + selectedRoom.status.slice(1)}
                        </Chip>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm">Housekeeping:</span>
                        <Chip color={getHousekeepingStatusColor(selectedRoom.housekeepingStatus)} size="sm">
                          {selectedRoom.housekeepingStatus.replace('-', ' ').charAt(0).toUpperCase() + selectedRoom.housekeepingStatus.replace('-', ' ').slice(1)}
                        </Chip>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm">Priority:</span>
                        <Chip color={getPriorityColor(selectedRoom.priority)} size="sm">
                          {selectedRoom.priority.toUpperCase()}
                        </Chip>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <p className="text-sm font-medium text-gray-700">Cleaning Schedule</p>
                    <div className="space-y-2 mt-2">
                      <div className="flex justify-between">
                        <span className="text-sm">Last Cleaned:</span>
                        <span className="text-sm font-medium">{selectedRoom.lastCleaned.toLocaleDateString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm">Next Cleaning:</span>
                        <span className="text-sm font-medium">{selectedRoom.nextCleaning.toLocaleDateString()}</span>
                      </div>
                    </div>
                    
                    {selectedRoom.currentGuest && (
                      <div className="mt-4">
                        <p className="text-sm font-medium text-gray-700">Current Guest</p>
                        <div className="space-y-2 mt-2">
                          <div className="flex justify-between">
                            <span className="text-sm">Name:</span>
                            <span className="text-sm font-medium">{selectedRoom.currentGuest}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm">Check-in:</span>
                            <span className="text-sm font-medium">{selectedRoom.checkInDate?.toLocaleDateString()}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm">Check-out:</span>
                            <span className="text-sm font-medium">{selectedRoom.checkOutDate?.toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                
                {selectedRoom.notes && (
                  <div>
                    <p className="text-sm font-medium text-gray-700">Notes</p>
                    <p className="text-sm text-gray-600 mt-1">{selectedRoom.notes}</p>
                  </div>
                )}
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            <Button color="danger" variant="light" onPress={() => setSelectedRoom(null)}>
              Close
            </Button>
            <Button color="primary" className="bg-ghana-green text-white" onPress={() => setSelectedRoom(null)}>
              Assign Task
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* New Cleaning Task Modal */}
      <Modal isOpen={isNewTaskModalOpen} onClose={() => setIsNewTaskModalOpen(false)} size="2xl">
        <ModalContent>
          <ModalHeader>Create New Cleaning Task</ModalHeader>
          <ModalBody>
            <div className="space-y-4">
              <Select label="Select Room" placeholder="Choose a room">
                {rooms.filter(r => r.housekeepingStatus === 'dirty').map((room) => (
                  <SelectItem key={room.id} value={room.number}>
                    Room {room.number} - {room.type.charAt(0).toUpperCase() + room.type.slice(1)}
                  </SelectItem>
                ))}
              </Select>
              
              <Select label="Assign To" placeholder="Select housekeeper">
                {housekeepers.filter(h => h.status === 'available').map((housekeeper) => (
                  <SelectItem key={housekeeper.id} value={housekeeper.name}>
                    {housekeeper.name} (Efficiency: {housekeeper.efficiency}%)
                  </SelectItem>
                ))}
              </Select>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Select label="Cleaning Type" placeholder="Select type">
                  <SelectItem key="daily" value="daily">Daily Cleaning</SelectItem>
                  <SelectItem key="deep" value="deep">Deep Cleaning</SelectItem>
                  <SelectItem key="turnover" value="turnover">Turnover Cleaning</SelectItem>
                  <SelectItem key="maintenance" value="maintenance">Maintenance Cleaning</SelectItem>
                </Select>
                <Select label="Priority" placeholder="Select priority">
                  <SelectItem key="low" value="low">Low</SelectItem>
                  <SelectItem key="medium" value="medium">Medium</SelectItem>
                  <SelectItem key="high" value="high">High</SelectItem>
                  <SelectItem key="urgent" value="urgent">Urgent</SelectItem>
                </Select>
              </div>
              
              <Input label="Estimated Time (minutes)" type="number" placeholder="30" />
              <Input label="Notes" placeholder="Any special instructions or notes" />
            </div>
          </ModalBody>
          <ModalFooter>
            <Button color="danger" variant="light" onPress={() => setIsNewTaskModalOpen(false)}>
              Cancel
            </Button>
            <Button color="primary" className="bg-ghana-green text-white" onPress={() => setIsNewTaskModalOpen(false)}>
              Create Task
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
