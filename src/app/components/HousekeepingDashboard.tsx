'use client';

import React, { useState } from 'react';
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
  Chip,
  Progress,
  Avatar,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure
} from "@heroui/react";

interface WorkOrder {
  id: string;
  location: string;
  description: string;
  status: 'urgent' | 'in-progress' | 'scheduled';
  time: string;
  priority: 'high' | 'medium' | 'low';
  type: 'maintenance' | 'repair' | 'preventive';
}

interface RoomStatus {
  range: string;
  status: 'complete' | 'in-progress' | 'pending';
  count: number;
  description: string;
}

interface SupplyAlert {
  item: string;
  description: string;
  status: 'critical' | 'low-stock' | 'reorder';
  quantity?: string;
}

interface StaffPerformance {
  team: string;
  details: string;
  efficiency: 'excellent' | 'good' | 'average';
  percentage: string;
  staffCount: number;
  roomsCleaned?: number;
  workOrdersCompleted?: number;
}

export default function HousekeepingDashboard() {
  const { isOpen, onOpen, onClose } = useDisclosure();

  const workOrders: WorkOrder[] = [
    {
      id: 'WO-001',
      location: 'Room 205',
      description: 'AC Not Working - Reported by guest, needs immediate attention',
      status: 'urgent',
      time: '2 hours ago',
      priority: 'high',
      type: 'repair'
    },
    {
      id: 'WO-002',
      location: 'Lobby',
      description: 'Light Fixture Replacement - Scheduled maintenance, parts ordered',
      status: 'in-progress',
      time: 'Started 1h ago',
      priority: 'medium',
      type: 'maintenance'
    },
    {
      id: 'WO-003',
      location: 'Room 108',
      description: 'Plumbing Check - Preventive maintenance scheduled',
      status: 'scheduled',
      time: 'Tomorrow 9 AM',
      priority: 'low',
      type: 'preventive'
    }
  ];

  const roomStatus: RoomStatus[] = [
    {
      range: 'Rooms 101-110',
      status: 'complete',
      count: 10,
      description: 'All rooms cleaned and inspected'
    },
    {
      range: 'Rooms 201-206',
      status: 'in-progress',
      count: 6,
      description: 'Currently being cleaned'
    },
    {
      range: 'Rooms 301-306',
      status: 'pending',
      count: 6,
      description: 'Awaiting checkout, then cleaning'
    }
  ];

  const supplyAlerts: SupplyAlert[] = [
    {
      item: 'Toilet Paper',
      description: 'Only 5 rolls remaining. Reorder immediately.',
      status: 'critical',
      quantity: '5 rolls'
    },
    {
      item: 'Towels',
      description: '15 clean towels available. Laundry in progress.',
      status: 'low-stock',
      quantity: '15 towels'
    },
    {
      item: 'Cleaning Supplies',
      description: 'All-purpose cleaner needs restocking.',
      status: 'reorder'
    }
  ];

  const staffPerformance: StaffPerformance[] = [
    {
      team: 'Housekeeping Team A',
      details: '4 staff, 12 rooms cleaned today',
      efficiency: 'excellent',
      percentage: '98% efficiency',
      staffCount: 4,
      roomsCleaned: 12
    },
    {
      team: 'Maintenance Team',
      details: '2 staff, 3 work orders completed',
      efficiency: 'good',
      percentage: '85% efficiency',
      staffCount: 2,
      workOrdersCompleted: 3
    },
    {
      team: 'Housekeeping Team B',
      details: '2 staff, 8 rooms cleaned today',
      efficiency: 'good',
      percentage: '92% efficiency',
      staffCount: 2,
      roomsCleaned: 8
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'urgent': return 'danger';
      case 'in-progress': return 'warning';
      case 'scheduled': return 'primary';
      case 'complete': return 'success';
      case 'pending': return 'warning';
      default: return 'default';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'urgent': return 'Urgent';
      case 'in-progress': return 'In Progress';
      case 'scheduled': return 'Scheduled';
      case 'complete': return 'Complete';
      case 'pending': return 'Pending';
      default: return status;
    }
  };

  const getAlertColor = (status: string) => {
    switch (status) {
      case 'critical': return 'danger';
      case 'low-stock': return 'warning';
      case 'reorder': return 'secondary';
      default: return 'default';
    }
  };

  const getEfficiencyColor = (efficiency: string) => {
    switch (efficiency) {
      case 'excellent': return 'success';
      case 'good': return 'primary';
      case 'average': return 'warning';
      default: return 'default';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-ghana-black">🛏️ Housekeeping & Maintenance Operations</h1>
              <p className="text-gray-600 mt-2">Real-time facility management and room operations</p>
            </div>
            
            {/* Overall Metrics */}
            <div className="flex items-center space-x-6">
              <div className="text-center">
                <div className="flex items-center space-x-2">
                  <div className="h-3 w-3 bg-green-500 rounded-full"></div>
                  <span className="text-sm font-medium text-green-600">92% Efficiency</span>
                </div>
              </div>
              <div className="text-center">
                <div className="flex items-center space-x-2">
                  <div className="h-3 w-3 bg-blue-500 rounded-full">👥</div>
                  <span className="text-sm font-medium text-blue-600">8 Staff On Duty</span>
                </div>
              </div>
              <div className="text-center">
                <div className="flex items-center space-x-2">
                  <div className="h-3 w-3 bg-purple-500 rounded-full">⏱️</div>
                  <span className="text-sm font-medium text-purple-600">35 min avg</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Key Performance Indicators */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
            <CardBody className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Rooms Cleaned</p>
                  <p className="text-2xl font-bold text-ghana-black">28</p>
                  <p className="text-sm text-green-600">+5 since morning</p>
                </div>
                <div className="h-12 w-12 bg-green-100 rounded-full flex items-center justify-center">
                  <span className="text-2xl text-green-600">🧹</span>
                </div>
              </div>
            </CardBody>
          </Card>
          
          <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
            <CardBody className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Pending Rooms</p>
                  <p className="text-2xl font-bold text-ghana-black">12</p>
                  <p className="text-sm text-blue-600">In progress 6</p>
                </div>
                <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-2xl text-blue-600">⏰</span>
                </div>
              </div>
            </CardBody>
          </Card>
          
          <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
            <CardBody className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Maintenance Orders</p>
                  <p className="text-2xl font-bold text-ghana-black">5</p>
                  <p className="text-sm text-red-600">2 urgent</p>
                </div>
                <div className="h-12 w-12 bg-orange-100 rounded-full flex items-center justify-center">
                  <span className="text-2xl text-orange-600">🔧</span>
                </div>
              </div>
            </CardBody>
          </Card>
          
          <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
            <CardBody className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Staff Efficiency</p>
                  <p className="text-2xl font-bold text-ghana-black">92%</p>
                  <p className="text-sm text-green-600">Above target</p>
                </div>
                <div className="h-12 w-12 bg-purple-100 rounded-full flex items-center justify-center">
                  <span className="text-2xl text-purple-600">👥</span>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>

        {/* Quick Actions and Management Modules */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          {/* Quick Actions */}
          <div className="lg:col-span-1">
            <Card className="border-0 shadow-lg">
              <CardHeader className="pb-3">
                <h3 className="text-lg font-semibold text-ghana-black">🚀 Quick Actions</h3>
                <p className="text-sm text-gray-600">Common housekeeping operations</p>
              </CardHeader>
              <CardBody className="space-y-3">
                <Button
                  variant="flat"
                  className="w-full justify-start bg-ghana-green/10 text-ghana-green border border-ghana-green/20"
                  size="lg"
                >
                  <span className="mr-3">🛏️</span>
                  Room Status
                </Button>
                <Button
                  variant="flat"
                  className="w-full justify-start bg-orange-500/10 text-orange-600 border border-orange-500/20"
                  size="lg"
                >
                  <span className="mr-3">📝</span>
                  Create Work Order
                </Button>
                <Button
                  variant="flat"
                  className="w-full justify-start bg-blue-500/10 text-blue-600 border border-blue-500/20"
                  size="lg"
                >
                  <span className="mr-3">👥</span>
                  Assign Tasks
                </Button>
                <Button
                  variant="flat"
                  className="w-full justify-start bg-purple-600/10 text-purple-600 border border-purple-600/20"
                  size="lg"
                >
                  <span className="mr-3">📦</span>
                  Check Inventory
                </Button>
              </CardBody>
            </Card>
          </div>

          {/* Housekeeping & Maintenance Modules */}
          <div className="lg:col-span-2">
            <Card className="border-0 shadow-lg">
              <CardHeader className="pb-3">
                <h3 className="text-lg font-semibold text-ghana-black">🏗️ Housekeeping & Maintenance Modules</h3>
                <p className="text-sm text-gray-600">Access all facility management features</p>
              </CardHeader>
              <CardBody>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="p-4 bg-green-50 rounded-lg border border-green-200 text-center hover:bg-green-100 transition-colors cursor-pointer">
                    <div className="text-3xl mb-2">🧹</div>
                    <h4 className="font-semibold text-ghana-black">Room Management</h4>
                    <p className="text-sm text-gray-600">Cleaning & Status</p>
                  </div>
                  
                  <div className="p-4 bg-orange-50 rounded-lg border border-orange-200 text-center hover:bg-orange-100 transition-colors cursor-pointer">
                    <div className="text-3xl mb-2">🔧</div>
                    <h4 className="font-semibold text-ghana-black">Maintenance</h4>
                    <p className="text-sm text-gray-600">Work Orders</p>
                  </div>
                  
                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-200 text-center hover:bg-blue-100 transition-colors cursor-pointer">
                    <div className="text-3xl mb-2">👥</div>
                    <h4 className="font-semibold text-ghana-black">Staff Management</h4>
                    <p className="text-sm text-gray-600">Scheduling & Tasks</p>
                  </div>
                  
                  <div className="p-4 bg-purple-50 rounded-lg border border-purple-200 text-center hover:bg-purple-100 transition-colors cursor-pointer">
                    <div className="text-3xl mb-2">📦</div>
                    <h4 className="font-semibold text-ghana-black">Inventory</h4>
                    <p className="text-sm text-gray-600">Supplies & Equipment</p>
                  </div>
                  
                  <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200 text-center hover:bg-yellow-100 transition-colors cursor-pointer">
                    <div className="text-3xl mb-2">✅</div>
                    <h4 className="font-semibold text-ghana-black">Inspections</h4>
                    <p className="text-sm text-gray-600">Quality Control</p>
                  </div>
                  
                  <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 text-center hover:bg-gray-100 transition-colors cursor-pointer">
                    <div className="text-3xl mb-2">📊</div>
                    <h4 className="font-semibold text-ghana-black">Reports</h4>
                    <p className="text-sm text-gray-600">Analytics & Metrics</p>
                  </div>
                </div>
              </CardBody>
            </Card>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Active Work Orders */}
          <Card className="border-0 shadow-lg">
            <CardHeader className="pb-3">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-semibold text-ghana-black">🔧 Active Work Orders</h3>
                  <p className="text-sm text-gray-600">Current maintenance requests and repairs</p>
                </div>
                <Badge color="primary" variant="flat">5 Active</Badge>
              </div>
            </CardHeader>
            <CardBody>
              <div className="space-y-4">
                {workOrders.map((order) => (
                  <div key={order.id} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-3">
                        <span className="font-mono text-sm text-gray-600">#{order.id}</span>
                        <span className="font-semibold text-ghana-black">{order.location}</span>
                      </div>
                      <Badge 
                        color={getStatusColor(order.status)} 
                        variant="flat"
                        size="sm"
                      >
                        {getStatusText(order.status)}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-700 mb-2">{order.description}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">{order.time}</span>
                      <div className="flex space-x-2">
                        <Chip 
                          variant="flat" 
                          color={order.priority === 'high' ? 'danger' : order.priority === 'medium' ? 'warning' : 'success'} 
                          size="sm"
                        >
                          {order.priority} priority
                        </Chip>
                        <Chip 
                          variant="flat" 
                          color="secondary" 
                          size="sm"
                        >
                          {order.type}
                        </Chip>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4">
                <Button 
                  color="primary" 
                  className="w-full bg-orange-500 text-white"
                  variant="flat"
                >
                  🔧 Manage Work Orders
                </Button>
              </div>
            </CardBody>
          </Card>

          {/* Room Cleaning Status */}
          <Card className="border-0 shadow-lg">
            <CardHeader className="pb-3">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-semibold text-ghana-black">🛏️ Room Cleaning Status</h3>
                  <p className="text-sm text-gray-600">Current room cleaning progress</p>
                </div>
                <Badge color="warning" variant="flat">12 Pending</Badge>
              </div>
            </CardHeader>
            <CardBody>
              <div className="space-y-4">
                {roomStatus.map((room, index) => (
                  <div key={index} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-ghana-black">{room.range}</span>
                      <Badge 
                        color={getStatusColor(room.status)} 
                        variant="flat"
                        size="sm"
                      >
                        {getStatusText(room.status)}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-700 mb-2">{room.description}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">{room.count} rooms</span>
                      <Progress 
                        value={room.status === 'complete' ? 100 : room.status === 'in-progress' ? 60 : 0} 
                        color={getStatusColor(room.status)}
                        size="sm"
                        className="w-24"
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4">
                <Button 
                  color="primary" 
                  className="w-full bg-ghana-green text-white"
                  variant="flat"
                >
                  🛏️ View Room Status
                </Button>
              </div>
            </CardBody>
          </Card>
        </div>

        {/* Bottom Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Supply Alerts */}
          <Card className="border-0 shadow-lg">
            <CardHeader className="pb-3">
              <h3 className="text-lg font-semibold text-ghana-black">⚠️ Supply Alerts</h3>
              <p className="text-sm text-gray-600">Low stock and inventory warnings</p>
            </CardHeader>
            <CardBody>
              <div className="space-y-4">
                {supplyAlerts.map((supply, index) => (
                  <div key={index} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-ghana-black">{supply.item}</span>
                      <Badge 
                        color={getAlertColor(supply.status)} 
                        variant="flat"
                        size="sm"
                      >
                        {supply.status === 'critical' ? 'Critical' : supply.status === 'low-stock' ? 'Low Stock' : 'Reorder'}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-700 mb-2">{supply.description}</p>
                    {supply.quantity && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500">Quantity: {supply.quantity}</span>
                        <Button size="sm" color="primary" variant="light">Reorder</Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="mt-4">
                <Button 
                  color="primary" 
                  className="w-full bg-purple-600 text-white"
                  variant="flat"
                >
                  📦 Manage Inventory
                </Button>
              </div>
            </CardBody>
          </Card>

          {/* Staff Performance */}
          <Card className="border-0 shadow-lg">
            <CardHeader className="pb-3">
              <h3 className="text-lg font-semibold text-ghana-black">👥 Staff Performance</h3>
              <p className="text-sm text-gray-600">Team efficiency and task completion</p>
            </CardHeader>
            <CardBody>
              <div className="space-y-4">
                {staffPerformance.map((staff, index) => (
                  <div key={index} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-ghana-black">{staff.team}</span>
                      <Badge 
                        color={getEfficiencyColor(staff.efficiency)} 
                        variant="flat"
                        size="sm"
                      >
                        {staff.efficiency === 'excellent' ? 'Excellent' : staff.efficiency === 'good' ? 'Good' : 'Average'}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-700 mb-2">{staff.details}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">{staff.percentage}</span>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs text-gray-500">{staff.staffCount} staff</span>
                        {staff.roomsCleaned && (
                          <span className="text-xs text-gray-500">• {staff.roomsCleaned} rooms</span>
                        )}
                        {staff.workOrdersCompleted && (
                          <span className="text-xs text-gray-500">• {staff.workOrdersCompleted} orders</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4">
                <Button 
                  color="primary" 
                  className="w-full bg-blue-600 text-white"
                  variant="flat"
                >
                  👥 Staff Management
                </Button>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
