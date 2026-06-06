'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  Card, 
  CardBody, 
  CardHeader, 
  Button, 
  Badge, 
  Tabs, 
  Tab, 
  Chip,
  Tooltip
} from "@heroui/react";
import { trackEvent } from '../lib/analytics/trackEvent';
import { useRouter } from 'next/navigation';
import RecentActivities from './RecentActivities';
import DeptNotices from './DeptNotices';
import DeptMessenger from './DeptMessenger';

// Import specialized Security components
import SecurityComplianceDashboard from './SecurityComplianceDashboard';
import SecurityAnalyticsDashboard from './SecurityAnalyticsDashboard';

// Info Icon Component with Tooltip
const InfoIcon = ({ description }: { description: string }) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      setShowTooltip(true);
    }, 2000); // 2 second delay
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setShowTooltip(false);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <Tooltip
      content={description}
      isOpen={showTooltip}
      onOpenChange={setShowTooltip}
      placement="top"
      showArrow
      color="primary"
      delay={0}
    >
      <div
        className="inline-flex items-center justify-center w-4 h-4 mr-2 text-xs text-blue-500 bg-blue-100 rounded-full cursor-help hover:bg-blue-200 transition-colors"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        title={description}
      >
        ℹ
      </div>
    </Tooltip>
  );
};

export default function SecurityMainDashboard() {
  const [selectedTab, setSelectedTab] = useState('overview');
  const router = useRouter();
  
  // Sample Security data - in real app, this would come from stores
  const totalIncidents = 15;
  const activeIncidents = 3;
  const resolvedIncidents = 12;
  const criticalIncidents = 1;
  
  // Patrol data
  const totalPatrols = 8;
  const activePatrols = 5;
  const completedPatrols = 3;
  const scheduledPatrols = 2;
  
  // Visitor data
  const totalVisitors = 45;
  const activeVisitors = 12;
  const overdueVisitors = 2;
  const expectedVisitors = 8;
  
  // Camera system data
  const totalCameras = 26;
  const operationalCameras = 24;
  const maintenanceCameras = 2;
  const cameraUptime = 92.3;

  // Today's operations
  const today = new Date().toISOString().slice(0, 10);
  const incidentsToday = 2;
  const visitorsToday = 15;
  const patrolsCompletedToday = 6;

  // Operational items following the uniform pattern
  const operationalItems = [
    {
      category: 'Incident Management',
      items: [
        { title: 'Security Incidents', icon: '🚨', description: 'Report and track security events', status: 'active', count: activeIncidents },
        { title: 'Incident Reports', icon: '📋', description: 'Documentation and investigation', status: 'active', count: totalIncidents },
        { title: 'Investigations', icon: '🔍', description: 'Ongoing security investigations', status: 'active', count: 2 },
        { title: 'Resolutions', icon: '✅', description: 'Completed incident resolutions', status: 'active', count: resolvedIncidents },
      ]
    },
    {
      category: 'Patrol & Monitoring',
      items: [
        { title: 'Security Patrols', icon: '🚶', description: 'Regular security rounds', status: 'active', count: activePatrols },
        { title: 'Camera Systems', icon: '📹', description: 'CCTV monitoring and control', status: 'active', count: operationalCameras },
        { title: 'Access Control', icon: '🚪', description: 'Entry and exit management', status: 'active', count: 8 },
        { title: 'Location Tracking', icon: '📍', description: 'Staff and visitor locations', status: 'active', count: 0 },
      ]
    },
    {
      category: 'Visitor Management',
      items: [
        { title: 'Visitor Registration', icon: '👥', description: 'Guest check-in and check-out', status: 'active', count: activeVisitors },
        { title: 'ID Verification', icon: '🆔', description: 'Identity and credential checks', status: 'active', count: 0 },
        { title: 'Time Tracking', icon: '⏰', description: 'Visitor duration monitoring', status: 'active', count: overdueVisitors },
        { title: 'Digital Badges', icon: '📱', description: 'Electronic visitor passes', status: 'active', count: 0 },
      ]
    },
    {
      category: 'Compliance & Training',
      items: [
        { title: 'Security Policies', icon: '📋', description: 'Policy management and updates', status: 'active', count: 12 },
        { title: 'Training Programs', icon: '🎓', description: 'Security awareness training', status: 'active', count: 8 },
        { title: 'Compliance Monitoring', icon: '🔒', description: 'Regulatory compliance checks', status: 'active', count: 95 },
        { title: 'Audit Reports', icon: '📊', description: 'Security audit documentation', status: 'active', count: 0 },
      ]
    }
  ];

  // Quick action handlers
  const handleQuickAction = (action: string) => {
    trackEvent('Security.IncidentReported', { action });
    
    switch (action) {
      case 'report-incident':
        setSelectedTab('incidents');
        break;
      case 'visitor-checkin':
        setSelectedTab('visitors');
        break;
      case 'start-patrol':
        setSelectedTab('patrols');
        break;
      case 'camera-monitor':
        setSelectedTab('monitoring');
        break;
      case 'compliance-check':
        setSelectedTab('compliance');
        break;
    }
  };

  const quickActions = [
    { 
      title: 'Report Incident', 
      icon: '🚨', 
      color: 'danger', 
      action: 'report-incident',
      description: 'Report security issue'
    },
    { 
      title: 'Visitor Check-in', 
      icon: '👥', 
      color: 'primary', 
      action: 'visitor-checkin',
      description: 'Register new visitor'
    },
    { 
      title: 'Start Patrol', 
      icon: '🚶', 
      color: 'secondary', 
      action: 'start-patrol',
      description: 'Begin security round'
    },
    { 
      title: 'Camera Monitor', 
      icon: '📹', 
      color: 'success', 
      action: 'camera-monitor',
      description: 'View camera feeds'
    },
    { 
      title: 'Compliance Check', 
      icon: '📋', 
      color: 'warning', 
      action: 'compliance-check',
      description: 'Run compliance audit'
    }
  ];

  const kpis = [
    { 
      label: 'Active Incidents', 
      value: activeIncidents, 
      target: 5, 
      color: 'warning',
      icon: '🚨'
    },
    { 
      label: 'Camera Uptime', 
      value: `${cameraUptime}%`, 
      target: 95, 
      color: 'success',
      icon: '📹'
    },
    { 
      label: 'Active Patrols', 
      value: activePatrols, 
      target: 8, 
      color: 'primary',
      icon: '🚶'
    },
    { 
      label: 'Visitor Count', 
      value: activeVisitors, 
      target: 20, 
      color: 'secondary',
      icon: '👥'
    }
  ];

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-ghana-black">🛡️ Security & Compliance</h2>
        <div className="flex items-center gap-2">
          <Badge color="success" variant="flat">System Online</Badge>
          <Badge color="warning" variant="flat">Active Monitoring</Badge>
        </div>
      </div>
      {/* Notices moved to bottom alongside Recent Activities */}
      <DeptMessenger from="security" mode="drawer" />

      {/* Security Status Overview - Following Uniform Pattern */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold text-ghana-black flex items-center gap-2">
            📊 Security Status Overview ({totalIncidents} Total Incidents)
          </h3>
        </div>
        
        {/* Status Cards - Matching Uniform Design */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          {/* Active Incidents */}
          <Card className="border-0 shadow-lg border-l-4 border-l-red-500">
            <CardBody className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-lg font-semibold text-ghana-black">Active Incidents</h4>
                <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              </div>
              <div className="text-3xl font-bold text-red-600 mb-3">{activeIncidents}</div>
              <div className="space-y-1 text-sm text-gray-600">
                <div className="flex justify-between">
                  <span>Critical</span>
                  <span className="font-medium">{criticalIncidents}</span>
                </div>
                <div className="flex justify-between">
                  <span>High</span>
                  <span className="font-medium">1</span>
                </div>
                <div className="flex justify-between">
                  <span>Medium</span>
                  <span className="font-medium">1</span>
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Camera Systems */}
          <Card className="border-0 shadow-lg border-l-4 border-l-green-500">
            <CardBody className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-lg font-semibold text-ghana-black">Camera Systems</h4>
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              </div>
              <div className="text-3xl font-bold text-green-600 mb-3">{operationalCameras}/{totalCameras}</div>
              <div className="space-y-1 text-sm text-gray-600">
                <div className="flex justify-between">
                  <span>Operational</span>
                  <span className="font-medium">{operationalCameras}</span>
                </div>
                <div className="flex justify-between">
                  <span>Maintenance</span>
                  <span className="font-medium">{maintenanceCameras}</span>
                </div>
                <div className="flex justify-between">
                  <span>Uptime</span>
                  <span className="font-medium">{cameraUptime}%</span>
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Security Patrols */}
          <Card className="border-0 shadow-lg border-l-4 border-l-blue-500">
            <CardBody className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-lg font-semibold text-ghana-black">Security Patrols</h4>
                <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
              </div>
              <div className="text-3xl font-bold text-blue-600 mb-3">{activePatrols}/{totalPatrols}</div>
              <div className="space-y-1 text-sm text-gray-600">
                <div className="flex justify-between">
                  <span>Active</span>
                  <span className="font-medium">{activePatrols}</span>
                </div>
                <div className="flex justify-between">
                  <span>Completed</span>
                  <span className="font-medium">{completedPatrols}</span>
                </div>
                <div className="flex justify-between">
                  <span>Scheduled</span>
                  <span className="font-medium">{scheduledPatrols}</span>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>

        {/* Today's Operations - Matching Uniform Pattern */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-lg">📅</span>
              <h4 className="text-lg font-semibold text-ghana-black">Today's Operations</h4>
            </div>
            <div className="flex items-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-red-600 font-medium">{incidentsToday} Incidents</span>
                <span className="text-gray-500">Reported today</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-blue-600 font-medium">{visitorsToday} Visitors</span>
                <span className="text-gray-500">Checked in today</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-green-600 font-medium">{patrolsCompletedToday} Patrols</span>
                <span className="text-gray-500">Completed today</span>
              </div>
            </div>
          </div>
          <Button 
            color="danger" 
            variant="solid"
            className="bg-red-600 hover:bg-red-700"
            onClick={() => setSelectedTab('incidents')}
          >
            🚨 Report Incident
          </Button>
        </div>
      </div>

      {/* Quick Actions */}
      <Card className="border-0 shadow-lg mb-6">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">🚀</span>
            <h3 className="text-lg font-semibold text-ghana-black">Quick Actions</h3>
          </div>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {quickActions.map((action) => (
              <Button
                key={action.action}
                color={action.color as any}
                variant="flat"
                className="h-24 flex flex-col items-center justify-center gap-2 p-4"
                onClick={() => handleQuickAction(action.action)}
              >
                <span className="text-2xl">{action.icon}</span>
                <span className="font-medium">{action.title}</span>
                <span className="text-xs text-center opacity-80">{action.description}</span>
              </Button>
            ))}
          </div>
        </CardBody>
      </Card>



      {/* Main Operations Interface - Following Uniform Pattern */}
      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-3">
          <h3 className="text-xl font-semibold text-ghana-black">📊 Operations Overview</h3>
        </CardHeader>
        <CardBody>
          <Tabs 
            selectedKey={selectedTab} 
            onSelectionChange={(key) => setSelectedTab(key as string)}
            className="w-full"
            aria-label="Security operations"
          >
            <Tab key="overview" title="📊 Overview">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-4">
                {operationalItems.map((category, categoryIndex) => (
                  <Card key={categoryIndex} className="border border-gray-200 shadow-md">
                    <CardHeader className="pb-3">
                      <h4 className="text-lg font-semibold text-ghana-black">{category.category}</h4>
                    </CardHeader>
                    <CardBody className="pt-0">
                      <div className="space-y-3">
                        {category.items.map((item, itemIndex) => (
                          <div 
                            key={itemIndex}
                            className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-ghana-gold/10 cursor-pointer transition-colors"
                            onClick={() => {
                              // Handle navigation based on item type
                              if (item.title.includes('Security Incidents') || item.title.includes('Incident Reports')) {
                                setSelectedTab('incidents');
                              } else if (item.title.includes('Security Patrols') || item.title.includes('Camera Systems')) {
                                setSelectedTab('patrols');
                              } else if (item.title.includes('Visitor Registration') || item.title.includes('ID Verification')) {
                                setSelectedTab('visitors');
                              } else if (item.title.includes('Security Policies') || item.title.includes('Compliance Monitoring')) {
                                setSelectedTab('compliance');
                              }
                            }}
                          >
                            <div className="flex items-center space-x-3">
                              <span className="text-xl">{item.icon}</span>
                              <div>
                                <div className="flex items-center">
                                  <InfoIcon description={item.description} />
                                  <p className="font-medium text-ghana-black">{item.title}</p>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Badge 
                                color={item.status === 'active' ? 'success' : 'default'}
                                variant="flat"
                              >
                                {item.status}
                              </Badge>
                              <Chip size="sm" variant="flat" color="primary">
                                {item.count}
                              </Chip>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardBody>
                  </Card>
                ))}
              </div>
            </Tab>

                          <Tab key="incidents" title="🚨 Incident Management">
                <SecurityComplianceDashboard />
              </Tab>

              <Tab key="patrols" title="🚶 Patrol & Monitoring">
                <SecurityComplianceDashboard />
              </Tab>

              <Tab key="visitors" title="👥 Visitor Management">
                <SecurityComplianceDashboard />
              </Tab>

              <Tab key="monitoring" title="📹 Camera Monitoring">
                <SecurityComplianceDashboard />
              </Tab>

              <Tab key="compliance" title="📋 Compliance & Training">
                <SecurityComplianceDashboard />
              </Tab>

              <Tab key="analytics" title="📈 Security Analytics">
                <SecurityAnalyticsDashboard />
              </Tab>
          </Tabs>
        </CardBody>
      </Card>
      {/* Recent Activities & Notices */}
      <div className="mt-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Activities */}
          <Card className="border-0 shadow-lg">
            <CardHeader className="pb-3">
              <h3 className="text-xl font-semibold text-ghana-black">📋 Recent Activities</h3>
            </CardHeader>
            <CardBody>
              <RecentActivities area="security" />
            </CardBody>
          </Card>

          {/* Security Notices */}
          <Card className="border-0 shadow-lg">
            <CardHeader className="pb-3">
              <h3 className="text-xl font-semibold text-ghana-black">🔔 Security Notices</h3>
            </CardHeader>
            <CardBody>
              <DeptNotices dept="security" title="" defaultTab="alerts" />
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
