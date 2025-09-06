'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { 
  Card, 
  CardBody, 
  CardHeader, 
  Button, 
  Badge, 
  Tabs, 
  Tab, 
  Chip,
  Progress,
  Avatar,
  Tooltip,
  Divider,
  Switch
} from "@heroui/react";
import { useSettingsStore } from '../lib/settings/store';
import { trackEvent } from '../lib/analytics/trackEvent';
import { useRouter } from 'next/navigation';

// Import specialized components
import RoomConfigurationDashboard from './RoomConfigurationDashboard';
import UserManagementUnified from './UserManagementUnified';
import UnifiedRateManagement from './UnifiedRateManagement';

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

export default function SystemSettingsMainDashboard() {
  const searchParams = useSearchParams();
  const [selectedTab, setSelectedTab] = useState(searchParams.get('tab') || 'overview');
  const [showRateManagement, setShowRateManagement] = useState(false);
  const router = useRouter();
  const settings = useSettingsStore();
  
  // Sample system data - in real app, this would come from stores
  const totalUsers = 45;
  const activeUsers = 38;
  const systemUptime = 99.8;
  const securityScore = 96;
  
  // Configuration metrics
  const totalRooms = 156;
  const configuredRoomTypes = 12;
  const activeAmenities = 24;
  const systemModules = 8;
  
  // System health indicators
  const databaseHealth = 98;
  const apiHealth = 97;
  const storageHealth = 94;
  const networkHealth = 99;
  
  // Today's operations
  const today = new Date().toISOString().slice(0, 10);
  const newUsersCreated = 2;
  const settingsChanged = 8;
  const backupsCompleted = 3;
  const securityChecks = 12;

  // Operational items following the uniform pattern
  const operationalItems = [
    {
      category: 'User Management',
      items: [
        { title: 'User Accounts', icon: '👥', description: 'User creation, roles, and permissions', status: 'active', count: totalUsers },
        { title: 'Access Control', icon: '🔐', description: 'Role-based access and security', status: 'active', count: activeUsers },
        { title: 'User Preferences', icon: '👤', description: 'Personal settings and customization', status: 'active', count: 0 },
        { title: 'User Analytics', icon: '📊', description: 'User activity and performance metrics', status: 'active', count: 0 },
      ]
    },
    {
      category: 'System Configuration',
      items: [
        { title: 'Room Management', icon: '🏠', description: 'Room types, rates, and configuration', status: 'active', count: totalRooms },
        { title: 'Room Types', icon: '🏷️', description: 'Room categories and amenities', status: 'active', count: configuredRoomTypes },
        { title: 'Amenities', icon: '✨', description: 'Hotel facilities and services', status: 'active', count: activeAmenities },
        { title: 'System Modules', icon: '⚙️', description: 'Active system components', status: 'active', count: systemModules },
      ]
    },
    {
      category: 'System Health',
      items: [
        { title: 'Database Health', icon: '🗄️', description: 'Database performance and status', status: 'active', count: databaseHealth },
        { title: 'API Health', icon: '🔌', description: 'API endpoints and services', status: 'active', count: apiHealth },
        { title: 'Storage Health', icon: '💾', description: 'File storage and backup systems', status: 'active', count: storageHealth },
        { title: 'Network Health', icon: '🌐', description: 'Network connectivity and security', status: 'active', count: networkHealth },
      ]
    },
    {
      category: 'Security & Maintenance',
      items: [
        { title: 'Security Score', icon: '🔒', description: 'Overall system security rating', status: 'active', count: securityScore },
        { title: 'System Uptime', icon: '🔄', description: 'System availability and reliability', status: 'active', count: systemUptime },
        { title: 'Backup Status', icon: '💾', description: 'Data backup and recovery', status: 'active', count: backupsCompleted },
        { title: 'Maintenance Logs', icon: '📋', description: 'System maintenance history', status: 'active', count: 0 },
      ]
    }
  ];

  const handleQuickAction = (action: string) => {
    trackEvent('Analytics.ActionClicked', { action: `settings.${action}` });
    switch (action) {
      case 'add_user':
        setSelectedTab('users');
        break;
      case 'configure_rooms':
        setSelectedTab('rooms');
        break;
      case 'system_health':
        setSelectedTab('health');
        break;
      case 'security_settings':
        setSelectedTab('security');
        break;
    }
  };

  const handleTabChange = (key: string) => {
    setSelectedTab(key);
    const params = new URLSearchParams(searchParams);
    params.set('tab', key);
    router.replace(`?${params.toString()}`);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'success';
      case 'warning': return 'warning';
      case 'error': return 'danger';
      default: return 'default';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return '✅';
      case 'warning': return '⚠️';
      case 'error': return '❌';
      default: return '⚪';
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-ghana-black">⚙️ System Settings & Configuration</h2>
        <Badge color="primary" variant="flat">System Admin</Badge>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        {/* User Management */}
        <Card className="border-0 shadow-lg border-l-4 border-l-blue-500">
          <CardBody className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-lg font-semibold text-ghana-black">User Management</h4>
              <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
            </div>
            <div className="text-3xl font-bold text-blue-600 mb-3">{totalUsers}</div>
            <div className="space-y-1 text-sm text-gray-600">
              <div className="flex justify-between">
                <span>Active Users</span>
                <span className="font-medium">{activeUsers}</span>
              </div>
              <div className="flex justify-between">
                <span>System Admins</span>
                <span className="font-medium">3</span>
              </div>
              <div className="flex justify-between">
                <span>Department Managers</span>
                <span className="font-medium">8</span>
              </div>
            </div>
          </CardBody>
        </Card>

        {/* System Health */}
        <Card className="border-0 shadow-lg border-l-4 border-l-green-500">
          <CardBody className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-lg font-semibold text-ghana-black">System Health</h4>
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            </div>
            <div className="text-3xl font-bold text-green-600 mb-3">{systemUptime}%</div>
            <div className="space-y-1 text-sm text-gray-600">
              <div className="flex justify-between">
                <span>Database</span>
                <span className="font-medium">{databaseHealth}%</span>
              </div>
              <div className="flex justify-between">
                <span>API Services</span>
                <span className="font-medium">{apiHealth}%</span>
              </div>
              <div className="flex justify-between">
                <span>Storage</span>
                <span className="font-medium">{storageHealth}%</span>
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Security & Compliance */}
        <Card className="border-0 shadow-lg border-l-4 border-l-purple-500">
          <CardBody className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-lg font-semibold text-ghana-black">Security & Compliance</h4>
              <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
            </div>
            <div className="text-3xl font-bold text-purple-600 mb-3">{securityScore}%</div>
            <div className="space-y-1 text-sm text-gray-600">
              <div className="flex justify-between">
                <span>Security Score</span>
                <span className="font-medium">{securityScore}%</span>
              </div>
              <div className="flex justify-between">
                <span>Compliance</span>
                <span className="font-medium">98%</span>
              </div>
              <div className="flex justify-between">
                <span>Audit Status</span>
                <span className="font-medium">Passed</span>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Today's System Operations */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-lg">⚙️</span>
            <h4 className="text-lg font-semibold text-ghana-black">Today's System Operations</h4>
          </div>
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-blue-600 font-medium">{newUsersCreated} New Users</span>
              <span className="text-gray-500">Created</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-green-600 font-medium">{settingsChanged} Settings</span>
              <span className="text-gray-500">Modified</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-purple-600 font-medium">{backupsCompleted} Backups</span>
              <span className="text-gray-500">Completed</span>
            </div>
          </div>
        </div>
        <Button 
          color="success" 
          variant="solid"
          className="bg-green-600 hover:bg-green-700"
          onClick={() => handleTabChange('health')}
        >
          💚 View System Health
        </Button>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Button 
          color="primary" 
          variant="flat" 
          className="h-20 flex flex-col items-center justify-center gap-2"
          onClick={() => handleQuickAction('add_user')}
        >
          <span className="text-2xl">👤</span>
          <span className="text-sm">Add User</span>
        </Button>
        <Button 
          color="secondary" 
          variant="flat" 
          className="h-20 flex flex-col items-center justify-center gap-2"
          onClick={() => handleQuickAction('configure_rooms')}
        >
          <span className="text-2xl">🏠</span>
          <span className="text-sm">Configure Rooms</span>
        </Button>
        <Button 
          color="success" 
          variant="flat" 
          className="h-20 flex flex-col items-center justify-center gap-2"
          onClick={() => handleQuickAction('system_health')}
        >
          <span className="text-2xl">💚</span>
          <span className="text-sm">System Health</span>
        </Button>
        <Button 
          color="warning" 
          variant="flat" 
          className="h-20 flex flex-col items-center justify-center gap-2"
          onClick={() => handleQuickAction('security_settings')}
        >
          <span className="text-2xl">🔒</span>
          <span className="text-sm">Security</span>
        </Button>
      </div>

      {/* Main Operations Interface */}
      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-3">
          <h3 className="text-xl font-semibold text-ghana-black">📊 Operations Overview</h3>
        </CardHeader>
        <CardBody>
          <Tabs 
            selectedKey={selectedTab} 
            onSelectionChange={(key) => handleTabChange(key as string)}
            className="w-full"
          >
            <Tab key="overview" title="📊 Overview">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-4">
                {operationalItems.slice(0, 4).map((category, categoryIndex) => (
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
                              if (item.title.includes('User Accounts')) {
                                handleTabChange('users');
                              } else if (item.title.includes('Room Management')) {
                                handleTabChange('rooms');
                              } else if (item.title.includes('System Health')) {
                                handleTabChange('health');
                              } else if (item.title.includes('Security Score')) {
                                handleTabChange('security');
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

            <Tab key="users" title="👥 User Management">
              <UserManagementUnified />
            </Tab>

            <Tab key="rooms" title="🏠 Room Configuration">
              <RoomConfigurationDashboard />
            </Tab>

            <Tab key="rate-management" title="💰 Rate Management">
              <div className="space-y-6 mt-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-xl font-semibold">Rate Management System</h3>
                  <Button 
                    color="primary" 
                    size="lg"
                    onPress={() => setShowRateManagement(true)}
                  >
                    Open Rate Management
                  </Button>
                </div>
                <div className="text-center py-12">
                  <h3 className="text-xl font-semibold mb-4">Rate Management System</h3>
                  <p className="text-gray-600 mb-6">
                    Manage all pricing: room rates, corporate rates, event packages, and seasonal adjustments
                  </p>
                  <p className="text-sm text-gray-500">
                    Click "Open Rate Management" to access the full system
                  </p>
                </div>
              </div>
            </Tab>

            

            <Tab key="health" title="💚 System Health">
              <div className="space-y-6 mt-4">
                <h3 className="text-xl font-semibold">System Health Monitoring</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <h4 className="font-semibold">Database Performance</h4>
                    </CardHeader>
                    <CardBody>
                      <Progress value={databaseHealth} color="success" className="mb-2" />
                      <p className="text-sm text-gray-600">Response time: 45ms</p>
                    </CardBody>
                  </Card>
                  <Card>
                    <CardHeader>
                      <h4 className="font-semibold">API Endpoints</h4>
                    </CardHeader>
                    <CardBody>
                      <Progress value={apiHealth} color="success" className="mb-2" />
                      <p className="text-sm text-gray-600">Uptime: 99.7%</p>
                    </CardBody>
                  </Card>
                </div>
              </div>
            </Tab>

            <Tab key="security" title="🔒 Security Settings">
              <div className="space-y-6 mt-4">
                <h3 className="text-xl font-semibold">Security Settings</h3>
                <div className="space-y-4">
                                     <div className="flex items-center justify-between p-4 border rounded-lg">
                     <div>
                       <h4 className="font-medium">Two-Factor Authentication</h4>
                       <p className="text-sm text-gray-600">Require 2FA for all users</p>
                     </div>
                     <Switch defaultSelected />
                   </div>
                                     <div className="flex items-center justify-between p-4 border rounded-lg">
                     <div>
                       <h4 className="font-medium">Session Timeout</h4>
                       <p className="text-sm text-gray-600">Auto-logout after inactivity</p>
                     </div>
                     <Switch defaultSelected />
                   </div>
                </div>
              </div>
            </Tab>
          </Tabs>
        </CardBody>
      </Card>
      {/* Rate Management Modal */}
      {showRateManagement && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-6xl h-5/6 overflow-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Rate Management System</h2>
              <Button 
                color="default" 
                variant="flat"
                onPress={() => setShowRateManagement(false)}
              >
                Close
              </Button>
            </div>
            <UnifiedRateManagement onClose={() => setShowRateManagement(false)} />
          </div>
        </div>
      )}
      
    </div>
  );
}
