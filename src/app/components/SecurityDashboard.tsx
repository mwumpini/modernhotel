'use client';

import React from 'react';
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
  Chip,
  Progress
} from "@heroui/react";
import { useIncidentStore } from '../lib/security/incidentStore';
import { usePatrolStore } from '../lib/security/patrolStore';
import { useVisitorStore } from '../lib/security/visitorStore';

// Helper functions for status colors and text
const getStatusColor = (status: string) => {
  switch (status) {
    case 'reported':
    case 'investigating':
      return 'warning';
    case 'resolved':
      return 'success';
    case 'closed':
      return 'default';
    case 'online':
      return 'success';
    case 'maintenance':
      return 'warning';
    case 'offline':
      return 'danger';
    case 'active':
      return 'success';
    case 'in-progress':
      return 'warning';
    case 'stationed':
      return 'primary';
    default:
      return 'default';
  }
};

const getStatusText = (status: string) => {
  switch (status) {
    case 'reported':
      return 'Reported';
    case 'investigating':
      return 'Investigating';
    case 'resolved':
      return 'Resolved';
    case 'closed':
      return 'Closed';
    case 'online':
      return 'Online';
    case 'maintenance':
      return 'Maintenance';
    case 'offline':
      return 'Offline';
    case 'active':
      return 'Active';
    case 'in-progress':
      return 'In Progress';
    case 'stationed':
      return 'Stationed';
    default:
      return status;
  }
};

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case 'low':
      return 'default';
    case 'medium':
      return 'warning';
    case 'high':
      return 'danger';
    case 'urgent':
      return 'danger';
    default:
      return 'default';
  }
};

export default function SecurityDashboard() {
  const incidentStore = useIncidentStore();
  const patrolStore = usePatrolStore();
  const visitorStore = useVisitorStore();

  const incidents = incidentStore.incidents;
  const activePatrols = patrolStore.getActivePatrols();
  const activeVisitors = visitorStore.getActiveVisitors();
  const overdueVisitors = visitorStore.getOverdueVisitors();
  const patrolLogs = patrolStore.patrols;

  // Calculate camera system status (simulated from store data)
  const totalCameras = 26;
  const operationalCameras = 24; // Based on store data patterns
  const cameraGroups = [
    {
      name: 'Lobby & Reception',
      cameraCount: 6,
      status: 'online' as const,
      uptime: '100% uptime',
      operational: 6,
      total: 6
    },
    {
      name: 'Corridors & Elevators',
      cameraCount: 12,
      status: 'online' as const,
      uptime: '100% uptime',
      operational: 12,
      total: 12
    },
    {
      name: 'Parking & Exterior',
      cameraCount: 8,
      status: 'maintenance' as const,
      uptime: '75% uptime',
      operational: 6,
      total: 8
    }
  ];

  // Convert store patrol data to display format
  const securityPatrols = activePatrols.map(patrol => ({
    id: patrol.id,
    name: `Patrol - ${patrol.routeName}`,
    description: patrol.notes || 'Security patrol in progress',
    status: patrol.status as 'active' | 'in-progress' | 'stationed',
            currentLocation: patrol.route || 'Unknown',
    progress: patrol.status === 'completed' ? '100% complete' : 
              patrol.status === 'in-progress' ? 'In Progress' : 'Active'
  }));

  // Access control summary (simulated data)
  const accessControl = [
    {
      category: 'Guest Key Cards',
      count: 15,
      status: 'active' as const,
      details: '15 active guest cards',
      badgeColor: 'success' as const
    },
    {
      category: 'Staff Access Cards',
      count: 28,
      status: 'active' as const,
      details: '28 staff members with access',
      badgeColor: 'success' as const
    },
    {
      category: 'Available Keys',
      count: 12,
      status: 'pending' as const,
      details: '12 keys available for assignment',
      badgeColor: 'warning' as const
    }
  ];

  const stats = [
    { label: 'Active Incidents', value: incidents.filter(i => i.status === 'reported' || i.status === 'investigating').length.toString(), change: '+1', changeType: 'negative', icon: '⚠️' },
    { label: 'Active Visitors', value: activeVisitors.length.toString(), change: '+2', changeType: 'positive', icon: '👥' },
    { label: 'Patrols Today', value: activePatrols.length.toString(), change: '+0', changeType: 'neutral', icon: '🛡️' },
    { label: 'Active Alerts', value: incidents.filter(i => i.priority === 'urgent').length.toString(), change: '+1', changeType: 'negative', icon: '🚨' },
  ] as const;

  const quickActions = [
    { title: 'Report Incident', icon: '⚠️', color: 'danger', href: '#' },
    { title: 'Visitor Check-in', icon: '👥', color: 'primary', href: '#' },
    { title: 'Start Patrol', icon: '🛡️', color: 'success', href: '#' },
    { title: 'Key Management', icon: '🔑', color: 'warning', href: '#' },
    { title: 'Emergency Contacts', icon: '📞', color: 'secondary', href: '#' },
    { title: 'Security Reports', icon: '📋', color: 'default', href: '#' },
  ] as const;

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">🛡️ Security Operations</h1>
        <p className="text-gray-600 mt-2">
          Real-time security monitoring, incident management, and visitor control
        </p>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {stats.map((stat, index) => (
          <Card key={index}>
            <CardBody className="text-center">
              <div className="text-2xl font-bold text-blue-600">{stat.value}</div>
              <div className="text-sm text-gray-600">{stat.label}</div>
              <div className="flex items-center justify-center mt-2">
                <span className={`text-xs ${stat.changeType === 'positive' ? 'text-green-600' : stat.changeType === 'negative' ? 'text-red-600' : 'text-gray-600'}`}>
                  {stat.change}
                </span>
                <span className="ml-1">{stat.icon}</span>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-3">Quick Actions</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {quickActions.map((action, index) => (
            <Button
              key={index}
              color={action.color as any}
              variant="flat"
              className="h-20 flex flex-col items-center justify-center"
            >
              <span className="text-2xl mb-1">{action.icon}</span>
              <span className="text-xs text-center">{action.title}</span>
            </Button>
          ))}
        </div>
      </div>

        {/* Key Performance Indicators */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
            <CardBody className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Active Cameras</p>
                  <p className="text-2xl font-bold text-ghana-black">{operationalCameras}/{totalCameras}</p>
                  <p className="text-sm text-green-600">{Math.round((operationalCameras/totalCameras)*100)}% operational</p>
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
                  <p className="text-sm font-medium text-gray-600">Assigned Keys</p>
                  <p className="text-2xl font-bold text-ghana-black">43</p>
                  <p className="text-sm text-green-600">12 available</p>
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
                  <p className="text-2xl font-bold text-ghana-black">{incidents.filter(i => i.status === 'reported' || i.status === 'investigating').length}</p>
                  <p className="text-sm text-orange-600">{incidents.filter(i => i.priority === 'high' || i.priority === 'urgent').length} high priority</p>
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
                  <p className="text-2xl font-bold text-ghana-black">{activeVisitors.length}</p>
                  <p className="text-sm text-blue-600">{activeVisitors.filter(v => v.isVIP).length} VIP guests</p>
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
                {incidents
                  .filter(incident => incident.status === 'reported' || incident.status === 'investigating')
                  .slice(0, 5)
                  .map((incident) => (
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
                      <span className="text-xs text-gray-500">{incident.reportedAt}</span>
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
                {incidents.filter(incident => incident.status === 'reported' || incident.status === 'investigating').length === 0 && (
                  <div className="p-4 bg-green-50 rounded-lg border border-green-200 text-center">
                    <p className="text-green-700">No active incidents</p>
                  </div>
                )}
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
                <Badge color="success" variant="flat">{operationalCameras} Online</Badge>
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
                {securityPatrols.length > 0 ? (
                  securityPatrols.map((patrol) => (
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
                        <span className="text-sm text-gray-600">Route: {patrol.route}</span>
                        <span className="text-xs text-gray-500">{patrol.progress}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-200 text-center">
                    <p className="text-blue-700">No active patrols</p>
                  </div>
                )}
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
                        {access.count} {access.category.includes('Cards') ? 'cards' : access.category.includes('Attempts') ? 'attempts' : 'items'}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-700 mb-2">{access.details}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">Status: {access.status}</span>
                      {access.status === 'pending' && (
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
  );
}
