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

interface SecurityIncident {
  id: string;
  title: string;
  description: string;
  status: 'high-priority' | 'monitoring' | 'resolved';
  time: string;
  location: string;
  priority: 'high' | 'medium' | 'low';
}

interface CameraGroup {
  name: string;
  cameraCount: number;
  status: 'online' | 'maintenance' | 'offline';
  uptime: string;
  operational: number;
  total: number;
}

interface SecurityPatrol {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'in-progress' | 'stationed';
  currentLocation: string;
  progress: string;
}

interface AccessControl {
  category: string;
  count: number;
  status: 'active' | 'pending' | 'monitor';
  details: string;
  badgeColor: 'success' | 'warning' | 'danger';
}

export default function SecurityDashboard() {
  const { isOpen, onOpen, onClose } = useDisclosure();

  const incidents: SecurityIncident[] = [
    {
      id: 'INC-001',
      title: 'Unauthorized Access Attempt',
      description: 'Room 205 - Multiple failed key card attempts',
      status: 'high-priority',
      time: '5 min ago',
      location: 'Room 205',
      priority: 'high'
    },
    {
      id: 'INC-002',
      title: 'Suspicious Activity',
      description: 'Lobby - Person loitering near reception',
      status: 'monitoring',
      time: '15 min ago',
      location: 'Lobby',
      priority: 'medium'
    },
    {
      id: 'INC-003',
      title: 'Fire Alarm Test',
      description: 'Scheduled maintenance completed successfully',
      status: 'resolved',
      time: '1 hour ago',
      location: 'System-wide',
      priority: 'low'
    }
  ];

  const cameraGroups: CameraGroup[] = [
    {
      name: 'Lobby & Reception',
      cameraCount: 6,
      status: 'online',
      uptime: '100% uptime',
      operational: 6,
      total: 6
    },
    {
      name: 'Corridors & Elevators',
      cameraCount: 12,
      status: 'online',
      uptime: '100% uptime',
      operational: 12,
      total: 12
    },
    {
      name: 'Parking & Exterior',
      cameraCount: 8,
      status: 'maintenance',
      uptime: '75% uptime',
      operational: 6,
      total: 8
    }
  ];

  const securityPatrols: SecurityPatrol[] = [
    {
      id: 'PAT-001',
      name: 'Night Patrol - Guard A',
      description: 'Floors 1-2 completed, currently on Floor 3',
      status: 'active',
      currentLocation: 'Floor 3',
      progress: '75% complete'
    },
    {
      id: 'PAT-002',
      name: 'Perimeter Check - Guard B',
      description: 'Exterior grounds and parking area patrol',
      status: 'in-progress',
      currentLocation: 'Parking Area',
      progress: '45% complete'
    },
    {
      id: 'PAT-003',
      name: 'Lobby Security - Guard C',
      description: 'Stationed at main entrance and reception',
      status: 'stationed',
      currentLocation: 'Main Lobby',
      progress: 'Stationed'
    }
  ];

  const accessControl: AccessControl[] = [
    {
      category: 'Guest Key Cards',
      count: 42,
      status: 'active',
      details: '42 active cards, 8 pending checkout',
      badgeColor: 'success'
    },
    {
      category: 'Staff Access Cards',
      count: 15,
      status: 'active',
      details: '15 staff members with active access',
      badgeColor: 'success'
    },
    {
      category: 'Failed Access Attempts',
      count: 3,
      status: 'monitor',
      details: '3 failed attempts in last hour',
      badgeColor: 'warning'
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'high-priority': return 'danger';
      case 'monitoring': return 'warning';
      case 'resolved': return 'success';
      case 'online': return 'success';
      case 'maintenance': return 'danger';
      case 'offline': return 'default';
      case 'active': return 'success';
      case 'in-progress': return 'primary';
      case 'stationed': return 'warning';
      default: return 'default';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'high-priority': return 'High Priority';
      case 'monitoring': return 'Monitoring';
      case 'resolved': return 'Resolved';
      case 'online': return 'Online';
      case 'maintenance': return 'Maintenance';
      case 'offline': return 'Offline';
      case 'active': return 'Active';
      case 'in-progress': return 'In Progress';
      case 'stationed': return 'Stationed';
      default: return status;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'danger';
      case 'medium': return 'warning';
      case 'low': return 'success';
      default: return 'default';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Top Header Summary Bar */}
        <div className="bg-white rounded-2xl shadow-lg p-4 mb-6">
          <div className="flex items-center justify-center space-x-12">
            <div className="text-center">
              <div className="flex items-center space-x-2">
                <span className="text-2xl">📹</span>
                <span className="text-lg font-semibold text-ghana-black">24/26 Cameras</span>
              </div>
            </div>
            <div className="text-center">
              <div className="flex items-center space-x-2">
                <span className="text-2xl">🛡️</span>
                <span className="text-lg font-semibold text-ghana-black">8 Guards On Duty</span>
              </div>
            </div>
            <div className="text-center">
              <div className="flex items-center space-x-2">
                <span className="text-2xl">🚶‍♂️</span>
                <span className="text-lg font-semibold text-ghana-black">12 Patrols Today</span>
              </div>
            </div>
          </div>
        </div>

        {/* Header */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-ghana-black">🛡️ Security Management Center</h1>
              <p className="text-gray-600 mt-2">Real-time security monitoring and incident management</p>
            </div>
            
            {/* System Status Indicators */}
            <div className="flex items-center space-x-4">
              <div className="text-center">
                <div className="h-3 w-3 bg-green-500 rounded-full mb-1"></div>
                <span className="text-xs text-gray-600">All Systems</span>
              </div>
              <div className="text-center">
                <div className="h-3 w-3 bg-green-500 rounded-full mb-1"></div>
                <span className="text-xs text-gray-600">Secure</span>
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
                  <p className="text-sm font-medium text-gray-600">Active Cameras</p>
                  <p className="text-2xl font-bold text-ghana-black">24/26</p>
                  <p className="text-sm text-green-600">92% operational</p>
                </div>
                <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-2xl text-blue-600">📹</span>
                </div>
              </div>
            </CardBody>
          </Card>
          
          <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
            <CardBody className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Access Attempts</p>
                  <p className="text-2xl font-bold text-ghana-black">1,248</p>
                  <p className="text-sm text-green-600">+15% vs yesterday</p>
                </div>
                <div className="h-12 w-12 bg-green-100 rounded-full flex items-center justify-center">
                  <span className="text-2xl text-green-600">🔑</span>
                </div>
              </div>
            </CardBody>
          </Card>
          
          <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
            <CardBody className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Active Incidents</p>
                  <p className="text-2xl font-bold text-ghana-black">2</p>
                  <p className="text-sm text-orange-600">1 high priority</p>
                </div>
                <div className="h-12 w-12 bg-orange-100 rounded-full flex items-center justify-center">
                  <span className="text-2xl text-orange-600">⚠️</span>
                </div>
              </div>
            </CardBody>
          </Card>
          
          <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
            <CardBody className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Current Visitors</p>
                  <p className="text-2xl font-bold text-ghana-black">20</p>
                  <p className="text-sm text-blue-600">2 VIP guests</p>
                </div>
                <div className="h-12 w-12 bg-purple-100 rounded-full flex items-center justify-center">
                  <span className="text-2xl text-purple-600">👥</span>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>

        {/* Quick Actions and Security Management Modules */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          {/* Quick Actions */}
          <div className="lg:col-span-1">
            <Card className="border-0 shadow-lg">
              <CardHeader className="pb-3">
                <h3 className="text-lg font-semibold text-ghana-black">🚨 Quick Actions</h3>
                <p className="text-sm text-gray-600">Emergency and security operations</p>
              </CardHeader>
              <CardBody className="space-y-3">
                <Button
                  variant="flat"
                  className="w-full justify-start bg-orange-500/10 text-orange-600 border border-orange-500/20"
                  size="lg"
                >
                  <span className="mr-3">⚠️</span>
                  Report Incident
                </Button>
                <Button
                  variant="flat"
                  className="w-full justify-start bg-blue-500/10 text-blue-600 border border-blue-500/20"
                  size="lg"
                >
                  <span className="mr-3">📹</span>
                  Live Monitoring
                </Button>
                <Button
                  variant="flat"
                  className="w-full justify-start bg-green-500/10 text-green-600 border border-green-500/20"
                  size="lg"
                >
                  <span className="mr-3">🔑</span>
                  Manage Access
                </Button>
                <Button
                  variant="flat"
                  className="w-full justify-start bg-red-500/10 text-red-600 border border-red-500/20"
                  size="lg"
                >
                  <span className="mr-3">🚨</span>
                  Emergency Alert
                </Button>
              </CardBody>
            </Card>
          </div>

          {/* Security Management Modules */}
          <div className="lg:col-span-2">
            <Card className="border-0 shadow-lg">
              <CardHeader className="pb-3">
                <h3 className="text-lg font-semibold text-ghana-black">🛡️ Security Management Modules</h3>
                <p className="text-sm text-gray-600">Access all security and safety features</p>
              </CardHeader>
              <CardBody>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="p-4 bg-green-50 rounded-lg border border-green-200 text-center hover:bg-green-100 transition-colors cursor-pointer">
                    <div className="text-3xl mb-2">🔑</div>
                    <h4 className="font-semibold text-ghana-black">Access Control</h4>
                    <p className="text-sm text-gray-600">Key Cards & Logs</p>
                  </div>
                  
                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-200 text-center hover:bg-blue-100 transition-colors cursor-pointer">
                    <div className="text-3xl mb-2">📹</div>
                    <h4 className="font-semibold text-ghana-black">Surveillance</h4>
                    <p className="text-sm text-gray-600">CCTV & Monitoring</p>
                  </div>
                  
                  <div className="p-4 bg-orange-50 rounded-lg border border-orange-200 text-center hover:bg-orange-100 transition-colors cursor-pointer">
                    <div className="text-3xl mb-2">⚠️</div>
                    <h4 className="font-semibold text-ghana-black">Incidents</h4>
                    <p className="text-sm text-gray-600">Reports & Response</p>
                  </div>
                  
                  <div className="p-4 bg-purple-50 rounded-lg border border-purple-200 text-center hover:bg-purple-100 transition-colors cursor-pointer">
                    <div className="text-3xl mb-2">👥</div>
                    <h4 className="font-semibold text-ghana-black">Visitor Management</h4>
                    <p className="text-sm text-gray-600">Registration & Screening</p>
                  </div>
                  
                  <div className="p-4 bg-indigo-50 rounded-lg border border-indigo-200 text-center hover:bg-indigo-100 transition-colors cursor-pointer">
                    <div className="text-3xl mb-2">🛡️</div>
                    <h4 className="font-semibold text-ghana-black">Security Patrols</h4>
                    <p className="text-sm text-gray-600">Schedules & Logs</p>
                  </div>
                  
                  <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 text-center hover:bg-gray-100 transition-colors cursor-pointer">
                    <div className="text-3xl mb-2">👁️</div>
                    <h4 className="font-semibold text-ghana-black">Reports</h4>
                    <p className="text-sm text-gray-600">Analytics & Compliance</p>
                  </div>
                </div>
              </CardBody>
            </Card>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Active Incidents */}
          <Card className="border-0 shadow-lg">
            <CardHeader className="pb-3">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-semibold text-ghana-black">⚠️ Active Incidents</h3>
                  <p className="text-sm text-gray-600">Current security incidents and alerts</p>
                </div>
                <Badge color="warning" variant="flat">{incidents.length} Active</Badge>
              </div>
            </CardHeader>
            <CardBody>
              <div className="space-y-4">
                {incidents.map((incident) => (
                  <div key={incident.id} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-3">
                        <span className="font-mono text-sm text-gray-600">#{incident.id}</span>
                        <span className="font-semibold text-ghana-black">{incident.title}</span>
                      </div>
                      <Badge 
                        color={getStatusColor(incident.status)} 
                        variant="flat"
                        size="sm"
                      >
                        {getStatusText(incident.status)}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-700 mb-2">{incident.description}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">{incident.time}</span>
                      <div className="flex space-x-2">
                        <Chip 
                          variant="flat" 
                          color={getPriorityColor(incident.priority)} 
                          size="sm"
                        >
                          {incident.priority} priority
                        </Chip>
                        <span className="text-xs text-gray-500">{incident.location}</span>
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
                  ⚠️ Manage Incidents
                </Button>
              </div>
            </CardBody>
          </Card>

          {/* Camera System Status */}
          <Card className="border-0 shadow-lg">
            <CardHeader className="pb-3">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-semibold text-ghana-black">📹 Camera System Status</h3>
                  <p className="text-sm text-gray-600">CCTV surveillance system monitoring</p>
                </div>
                <Badge color="success" variant="flat">24 Online</Badge>
              </div>
            </CardHeader>
            <CardBody>
              <div className="space-y-4">
                {cameraGroups.map((group, index) => (
                  <div key={index} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-ghana-black">{group.name}</span>
                      <Badge 
                        color={getStatusColor(group.status)} 
                        variant="flat"
                        size="sm"
                      >
                        {getStatusText(group.status)}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-700 mb-2">{group.cameraCount} cameras - {group.operational === group.total ? 'All operational' : `${group.operational}/${group.total} operational`}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">{group.uptime}</span>
                      <Progress 
                        value={(group.operational / group.total) * 100} 
                        color={getStatusColor(group.status)}
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
                  className="w-full bg-blue-600 text-white"
                  variant="flat"
                >
                  📹 View Live Feed
                </Button>
              </div>
            </CardBody>
          </Card>
        </div>

        {/* Bottom Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Security Patrols */}
          <Card className="border-0 shadow-lg">
            <CardHeader className="pb-3">
              <h3 className="text-lg font-semibold text-ghana-black">🛡️ Security Patrols</h3>
              <p className="text-sm text-gray-600">Guard patrol schedules and status</p>
            </CardHeader>
            <CardBody>
              <div className="space-y-4">
                {securityPatrols.map((patrol) => (
                  <div key={patrol.id} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-ghana-black">{patrol.name}</span>
                      <Badge 
                        color={getStatusColor(patrol.status)} 
                        variant="flat"
                        size="sm"
                      >
                        {getStatusText(patrol.status)}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-700 mb-2">{patrol.description}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Location: {patrol.currentLocation}</span>
                      <span className="text-xs text-gray-500">{patrol.progress}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4">
                <Button 
                  color="primary" 
                  className="w-full bg-indigo-600 text-white"
                  variant="flat"
                >
                  🛡️ Patrol Management
                </Button>
              </div>
            </CardBody>
          </Card>

          {/* Access Control Summary */}
          <Card className="border-0 shadow-lg">
            <CardHeader className="pb-3">
              <h3 className="text-lg font-semibold text-ghana-black">🔑 Access Control Summary</h3>
              <p className="text-sm text-gray-600">Key card and access management overview</p>
            </CardHeader>
            <CardBody>
              <div className="space-y-4">
                {accessControl.map((access, index) => (
                  <div key={index} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-ghana-black">{access.category}</span>
                      <Badge 
                        color={access.badgeColor} 
                        variant="flat"
                        size="sm"
                      >
                        {access.count} {access.category.includes('Cards') ? 'cards' : access.category.includes('Attempts') ? 'attempts' : ''}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-700 mb-2">{access.details}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">Status: {access.status}</span>
                      {access.status === 'monitor' && (
                        <Chip variant="flat" color="warning" size="sm">Monitor</Chip>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4">
                <Button 
                  color="primary" 
                  className="w-full bg-green-600 text-white"
                  variant="flat"
                >
                  🔑 Access Management
                </Button>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
