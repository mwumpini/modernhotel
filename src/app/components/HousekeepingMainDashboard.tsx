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
  Tooltip
} from "@heroui/react";
import { housekeepingStore } from '../lib/housekeeping/store';
import { frontOfficeStore } from '../lib/frontoffice/store';
import { useSettingsStore } from '../lib/settings/store';
import { trackEvent } from '../lib/analytics/trackEvent';
import { useRouter } from 'next/navigation';
import OfflineIndicator from './OfflineIndicator';
import DeptNotices from './DeptNotices';
import DeptMessenger from './DeptMessenger';
import RecentActivities from './RecentActivities';
import CustomizeViewControl, { HideCardButton } from './dashboard/CustomizeViewControl';
import { useDashboardVisibility, type DashboardSectionDef } from '../lib/dashboard/useDashboardVisibility';
import RequestOvertimeButton from './hr/RequestOvertimeButton';

// Hideable summary/widget cards on this dashboard — the "Operations Overview"
// tabs are core navigation, not clutter, so they're deliberately not included.
const HOUSEKEEPING_DASHBOARD_SECTIONS: DashboardSectionDef[] = [
  { id: 'availableRooms', label: 'Available Rooms' },
  { id: 'occupiedRooms', label: 'Occupied Rooms' },
  { id: 'maintenance', label: 'Maintenance & Cleaning' },
  { id: 'todayOps', label: "Today's Operations" },
  { id: 'quickActions', label: 'Quick Actions' },
  { id: 'recentActivities', label: 'Recent Activities' },
  { id: 'notices', label: 'Housekeeping Notices' },
];

// Import specialized components
import RoomStatusGrid from './housekeeping/RoomStatusGrid';
import TaskManagementPanel from './housekeeping/TaskManagementPanel';
import StaffManagementPanel from './housekeeping/StaffManagementPanel';
import MaintenancePanel from './housekeeping/MaintenancePanel';

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

export default function HousekeepingMainDashboard() {
  const [tick, setTick] = useState(0);
  const [selectedTab, setSelectedTab] = useState('overview');
  const searchParams = useSearchParams();
  const router = useRouter();

  const { isHidden, hide, toggle: toggleSection, showAll, hiddenCount } = useDashboardVisibility('dashboard.hidden.housekeeping', HOUSEKEEPING_DASHBOARD_SECTIONS);

  // Get stores
  const settings = useSettingsStore();
  const reservations = frontOfficeStore.reservations;
  const rooms = frontOfficeStore.rooms;
  
  useEffect(() => {
    const unsubscribe = housekeepingStore.subscribe(() => setTick(t => t + 1));
    // Pulls in real persisted tasks/maintenance/staff/room-status history —
    // setTick above re-renders once this resolves and notifies listeners.
    housekeepingStore.hydrateFromApi();
    return unsubscribe;
  }, []);

  // Handle URL query parameter for direct tab navigation
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam && ['rooms', 'tasks', 'staff', 'maintenance', 'inspections', 'supplies'].includes(tabParam)) {
      setSelectedTab(tabParam);
    }
  }, [searchParams]);

  // Get data from stores
  const allRooms = housekeepingStore.getAllRooms();
  const stats = housekeepingStore.getDailyStats();
  const staff = housekeepingStore.getAllStaff();
  const pendingTasks = housekeepingStore.getTasksByStatus('pending');
  const inProgressTasks = housekeepingStore.getTasksByStatus('in-progress');
  const maintenanceRequests = housekeepingStore.getMaintenanceRequests();

  // Calculate key metrics
  const availableRooms = allRooms.filter(r => r.status === 'clean' || r.status === 'inspected').length;
  const dirtyRooms = allRooms.filter(r => r.status === 'dirty').length;
  const occupiedRooms = allRooms.filter(r => r.status === 'occupied').length;
  const maintenanceRooms = allRooms.filter(r => r.status === 'maintenance' || r.status === 'out-of-order').length;
  const activeStaff = staff.filter(s => s.active).length;
  const totalRooms = allRooms.length;
  const activeStaffList = staff.filter(s => s.active);
  const avgStaffEfficiency = activeStaffList.length > 0
    ? Math.round(activeStaffList.reduce((sum, s) => sum + s.efficiency, 0) / activeStaffList.length)
    : 0;

  // Today's operations
  const todayIso = new Date().toISOString().slice(0,10);
  const checkingOutToday = reservations.filter(r => r.status === 'checked-in' && r.departure.slice(0,10) === todayIso).length;
  const todayCheckIns = reservations.filter(r => (r.status === 'confirmed' || r.status === 'pending') && r.arrival.slice(0,10) === todayIso).length;

  // Operational items following front desk pattern
  const operationalItems = [
    {
      category: 'Room Operations',
      items: [
        { title: 'Room Management', icon: '🏠', description: 'Monitor and update room statuses', status: 'active', count: totalRooms },
        { title: 'Task Management', icon: '🧹', description: 'Create and assign cleaning tasks', status: 'active', count: pendingTasks.length + inProgressTasks.length },
        { title: 'Staff Management', icon: '👥', description: 'Manage housekeeping staff', status: 'active', count: activeStaff },
        { title: 'Maintenance', icon: '🔧', description: 'Track maintenance requests', status: 'active', count: maintenanceRequests.filter(m => m.status !== 'completed').length },
      ]
    },
    {
      category: 'Quality Control',
      items: [
        { title: 'Room Inspections', icon: '✅', description: 'Conduct quality inspections', status: 'active', count: stats.inspectionsCompleted },
        { title: 'Performance Metrics', icon: '📊', description: 'Staff efficiency tracking', status: 'active', count: activeStaff },
        { title: 'Daily Schedules', icon: '📋', description: 'Staff work schedules', status: 'active', count: staff.length },
        { title: 'Quality Standards', icon: '🎯', description: 'Maintain service standards', status: 'active', count: 0 },
      ]
    },
    {
      // Cleaning-supplies inventory isn't tracked anywhere yet — no Prisma model exists
      // for it (a separate, larger fix). Honest zeros rather than fabricated stock counts.
      category: 'Inventory & Supplies',
      items: [
        { title: 'Supply Management', icon: '📦', description: 'Manage cleaning supplies', status: 'active', count: 0 },
        { title: 'Stock Monitoring', icon: '🔄', description: 'Track inventory levels', status: 'active', count: 0 },
        { title: 'Purchase Orders', icon: '📝', description: 'Order new supplies', status: 'active', count: 0 },
        { title: 'Cost Control', icon: '💰', description: 'Monitor supply costs', status: 'active', count: 0 },
      ]
    },
    {
      category: 'Communication & Reports',
      items: [
        { title: 'Staff Communication', icon: '📱', description: 'Team coordination tools', status: 'active', count: activeStaff },
        { title: 'Daily Reports', icon: '📊', description: 'Generate daily summaries', status: 'active', count: 0 },
        { title: 'Performance Analytics', icon: '📈', description: 'Staff performance insights', status: 'active', count: 0 },
        { title: 'Notifications', icon: '🔔', description: 'Alert system', status: 'active', count: 0 },
      ]
    }
  ];

  // Quick action handlers
  const handleQuickAction = (action: string) => {
    trackEvent('HK.TaskCreated', { action });
    
    switch (action) {
      case 'create-task':
        setSelectedTab('tasks');
        const url = new URL(window.location.href);
        url.searchParams.set('tab', 'tasks');
        window.history.replaceState({}, '', url.toString());
        break;
      case 'assign-tasks':
        setSelectedTab('staff');
        const url2 = new URL(window.location.href);
        url2.searchParams.set('tab', 'staff');
        window.history.replaceState({}, '', url2.toString());
        break;
      case 'room-inspection':
        setSelectedTab('inspections');
        const url3 = new URL(window.location.href);
        url3.searchParams.set('tab', 'inspections');
        window.history.replaceState({}, '', url3.toString());
        break;
      case 'maintenance-request':
        setSelectedTab('maintenance');
        const url4 = new URL(window.location.href);
        url4.searchParams.set('tab', 'maintenance');
        window.history.replaceState({}, '', url4.toString());
        break;
      case 'supply-check':
        setSelectedTab('supplies');
        const url5 = new URL(window.location.href);
        url5.searchParams.set('tab', 'supplies');
        window.history.replaceState({}, '', url5.toString());
        break;
    }
  };

  const quickActions = [
    { 
      title: 'Create Task', 
      icon: '🧹', 
      color: 'primary', 
      action: 'create-task',
      description: 'Create new cleaning tasks'
    },
    { 
      title: 'Assign Tasks', 
      icon: '👥', 
      color: 'secondary', 
      action: 'assign-tasks',
      description: 'Assign tasks to staff members'
    },
    { 
      title: 'Room Inspection', 
      icon: '🔍', 
      color: 'success', 
      action: 'room-inspection',
      description: 'Conduct room quality inspections'
    },
    { 
      title: 'Maintenance Request', 
      icon: '🔧', 
      color: 'warning', 
      action: 'maintenance-request',
      description: 'Report maintenance issues'
    },
    { 
      title: 'Supply Check', 
      icon: '📦', 
      color: 'default', 
      action: 'supply-check',
      description: 'Check supplies and inventory'
    }
  ];

  const kpis = [
    { 
      label: 'Tasks Completed', 
      value: stats.tasksCompleted, 
      target: 50, 
      color: 'success',
      icon: '✅'
    },
    { 
      label: 'Inspections', 
      value: stats.inspectionsCompleted, 
      target: 20, 
      color: 'primary',
      icon: '🔍'
    },
    { 
      label: 'Avg Task Time', 
      value: `${stats.averageTaskTime}m`, 
      target: 30, 
      color: 'secondary',
      icon: '⏱️'
    },
    { 
      label: 'Quality Score', 
      value: `${stats.averageInspectionScore}%`, 
      target: 90, 
      color: 'warning',
      icon: '📊'
    }
  ];

  return (
    <div className="p-6">
      <DeptMessenger from="housekeeping" mode="drawer" />
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-ghana-black">🛏️ Housekeeping & Maintenance Operations</h2>
        <div className="flex items-center gap-2">
          <RequestOvertimeButton
            departmentLabel="Housekeeping"
            permissionId="housekeeping.log-overtime"
            departmentNameHints={['housekeeping', 'maintenance']}
          />
          <CustomizeViewControl
            sections={HOUSEKEEPING_DASHBOARD_SECTIONS}
            isHidden={isHidden}
            toggle={toggleSection}
            showAll={showAll}
            hiddenCount={hiddenCount}
          />
          <OfflineIndicator />
        </div>
      </div>

      {/* Room Status Overview - Following Front Desk Pattern */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold text-ghana-black flex items-center gap-2">
            🏠 Room Status Overview ({totalRooms} Rooms)
          </h3>
        </div>

        {/* Status Cards - Matching Front Desk Design */}
        {(!isHidden('availableRooms') || !isHidden('occupiedRooms') || !isHidden('maintenance')) && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          {/* Available Rooms */}
          {!isHidden('availableRooms') && (
          <Card className="border-0 shadow-lg border-l-4 border-l-green-500">
            <CardBody className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-lg font-semibold text-ghana-black">Available Rooms</h4>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <HideCardButton onHide={() => hide('availableRooms')} label="Available Rooms" />
                </div>
              </div>
              <div className="text-3xl font-bold text-green-600 mb-3">{availableRooms}</div>
              <div className="space-y-1 text-sm text-gray-600">
                <div className="flex justify-between">
                  <span>Clean & Ready</span>
                  <span className="font-medium">{availableRooms}</span>
                </div>
                <div className="flex justify-between">
                  <span>Inspected</span>
                  <span className="font-medium">{allRooms.filter(r => r.status === 'inspected').length}</span>
                </div>
                <div className="flex justify-between">
                  <span>Vacant</span>
                  <span className="font-medium">{allRooms.filter(r => r.status === 'vacant').length}</span>
                </div>
              </div>
            </CardBody>
          </Card>
          )}

          {/* Occupied Rooms */}
          {!isHidden('occupiedRooms') && (
          <Card className="border-0 shadow-lg border-l-4 border-l-red-500">
            <CardBody className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-lg font-semibold text-ghana-black">Occupied Rooms</h4>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                  <HideCardButton onHide={() => hide('occupiedRooms')} label="Occupied Rooms" />
                </div>
              </div>
              <div className="text-3xl font-bold text-red-600 mb-3">{occupiedRooms}</div>
              <div className="space-y-1 text-sm text-gray-600">
                <div className="flex justify-between">
                  <span>Checking Out Today</span>
                  <span className="font-medium">{checkingOutToday}</span>
                </div>
                <div className="flex justify-between">
                  <span>Extended Stays</span>
                  <span className="font-medium">0</span>
                </div>
                <div className="flex justify-between">
                  <span>VIP Guests</span>
                  <span className="font-medium">0</span>
                </div>
              </div>
            </CardBody>
          </Card>
          )}

          {/* Maintenance & Cleaning */}
          {!isHidden('maintenance') && (
          <Card className="border-0 shadow-lg border-l-4 border-l-yellow-500">
            <CardBody className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-lg font-semibold text-ghana-black">Maintenance & Cleaning</h4>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                  <HideCardButton onHide={() => hide('maintenance')} label="Maintenance & Cleaning" />
                </div>
              </div>
              <div className="text-3xl font-bold text-yellow-600 mb-3">{maintenanceRooms + dirtyRooms}</div>
              <div className="space-y-1 text-sm text-gray-600">
                <div className="flex justify-between">
                  <span>Under Maintenance</span>
                  <span className="font-medium">{maintenanceRooms}</span>
                </div>
                <div className="flex justify-between">
                  <span>Need Cleaning</span>
                  <span className="font-medium">{dirtyRooms}</span>
                </div>
                <div className="flex justify-between">
                  <span>Ready Soon</span>
                  <span className="font-medium">{allRooms.filter(r => r.status === 'inspected').length}</span>
                </div>
              </div>
            </CardBody>
          </Card>
          )}
        </div>
        )}

        {/* Today's Operations - Matching Front Desk */}
        {!isHidden('todayOps') && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-lg">📅</span>
              <h4 className="text-lg font-semibold text-ghana-black">Today's Operations</h4>
            </div>
            <div className="flex items-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-green-600 font-medium">{todayCheckIns} Check-ins</span>
                <span className="text-gray-500">Starting 2:00 PM</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-blue-600 font-medium">{checkingOutToday} Check-outs</span>
                <span className="text-gray-500">By 12:00 PM</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-orange-600 font-medium">{pendingTasks.length} Pending Tasks</span>
                <span className="text-gray-500">To be assigned</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              color="success"
              variant="solid"
              className="bg-green-600 hover:bg-green-700"
              onClick={() => setSelectedTab('rooms')}
            >
              🏢 View Full Status
            </Button>
            <HideCardButton onHide={() => hide('todayOps')} label="Today's Operations" />
          </div>
        </div>
        )}
      </div>

      {/* Quick Actions */}
      {!isHidden('quickActions') && (
      <Card className="border-0 shadow-lg mb-6">
        <CardHeader className="pb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">🚀</span>
            <h3 className="text-lg font-semibold text-ghana-black">Quick Actions</h3>
          </div>
          <HideCardButton onHide={() => hide('quickActions')} label="Quick Actions" />
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
      )}

      {/* Main Operations Interface - Following Front Desk Pattern */}
      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-3">
          <h3 className="text-xl font-semibold text-ghana-black">📊 Operations Overview</h3>
        </CardHeader>
        <CardBody>
          <Tabs 
            selectedKey={selectedTab} 
            onSelectionChange={(key) => {
              setSelectedTab(key as string);
              // Update URL without page reload
              const url = new URL(window.location.href);
              if (key === 'overview') {
                url.searchParams.delete('tab');
              } else {
                url.searchParams.set('tab', key as string);
              }
              window.history.replaceState({}, '', url.toString());
            }}
            className="w-full"
            aria-label="Housekeeping operations"
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
                              if (item.title.includes('Room Management')) {
                                setSelectedTab('rooms');
                              } else if (item.title.includes('Task Management')) {
                                setSelectedTab('tasks');
                              } else if (item.title.includes('Staff Management')) {
                                setSelectedTab('staff');
                              } else if (item.title.includes('Maintenance')) {
                                setSelectedTab('maintenance');
                              } else if (item.title.includes('Room Inspections')) {
                                setSelectedTab('inspections');
                              } else if (item.title.includes('Supply Management')) {
                                setSelectedTab('supplies');
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

            <Tab key="rooms" title="🏠 Room Management">
              <RoomStatusGrid />
            </Tab>

            <Tab key="tasks" title="🧹 Task Management">
              <TaskManagementPanel />
            </Tab>

            <Tab key="staff" title="👥 Staff Management">
              <StaffManagementPanel />
            </Tab>

            <Tab key="maintenance" title="🔧 Maintenance">
              <MaintenancePanel />
            </Tab>
            <Tab key="inspections" title="🔍 Room Inspections">
              <div className="p-4">
                <p className="text-gray-600">Room Inspection Panel - Coming Soon</p>
              </div>
            </Tab>

            <Tab key="supplies" title="📦 Supplies & Inventory">
              <div className="p-4">
                <p className="text-gray-600">Supply Management Panel - Coming Soon</p>
              </div>
            </Tab>

            <Tab key="analytics" title="📊 Analytics & Reports">
              <div className="space-y-6 mt-6">
                {/* Performance KPIs */}
                <Card className="border-0 shadow-lg">
                  <CardHeader className="flex items-center justify-between">
                    <h3 className="text-xl font-semibold text-ghana-black">Key Performance Indicators</h3>
                    <Button size="sm" variant="flat">
                      Export
                    </Button>
                  </CardHeader>
                  <CardBody>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                      {/* Rooms Cleaned */}
                      <div className="text-center p-4 bg-gray-50 rounded-lg">
                        <div className="flex items-center justify-center gap-2 mb-2">
                          <span className="text-2xl">🏠</span>
                          <span className="text-sm font-medium text-gray-600">Rooms Cleaned</span>
                        </div>
                        <div className="text-2xl font-bold text-ghana-black mb-2">{stats.tasksCompleted}</div>
                        <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                          <span>Target: 50</span>
                        </div>
                        <Progress value={Math.min(100, (stats.tasksCompleted / 50) * 100)} color="success" size="sm" />
                      </div>

                      {/* Quality Score */}
                      <div className="text-center p-4 bg-gray-50 rounded-lg">
                        <div className="flex items-center justify-center gap-2 mb-2">
                          <span className="text-2xl">⭐</span>
                          <span className="text-sm font-medium text-gray-600">Quality Score</span>
                        </div>
                        <div className="text-2xl font-bold text-ghana-black mb-2">{stats.averageInspectionScore}%</div>
                        <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                          <span>Target: 95%</span>
                        </div>
                        <Progress value={stats.averageInspectionScore} color="primary" size="sm" />
                      </div>

                      {/* Avg Task Time */}
                      <div className="text-center p-4 bg-gray-50 rounded-lg">
                        <div className="flex items-center justify-center gap-2 mb-2">
                          <span className="text-2xl">⏱️</span>
                          <span className="text-sm font-medium text-gray-600">Avg Task Time</span>
                        </div>
                        <div className="text-2xl font-bold text-ghana-black mb-2">{stats.averageTaskTime} min</div>
                        <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                          <span>Target: 30 min</span>
                        </div>
                        <Progress value={Math.min(100, (stats.averageTaskTime / 30) * 100)} color="secondary" size="sm" />
                      </div>

                      {/* Staff Efficiency */}
                      <div className="text-center p-4 bg-gray-50 rounded-lg">
                        <div className="flex items-center justify-center gap-2 mb-2">
                          <span className="text-2xl">👥</span>
                          <span className="text-sm font-medium text-gray-600">Staff Efficiency</span>
                        </div>
                        <div className="text-2xl font-bold text-ghana-black mb-2">{avgStaffEfficiency}%</div>
                        <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                          <span>Target: 90%</span>
                        </div>
                        <Progress value={avgStaffEfficiency} color="warning" size="sm" />
                      </div>
                    </div>
                  </CardBody>
                </Card>

                {/* Performance Trends */}
                <Card className="border-0 shadow-lg">
                  <CardHeader>
                    <h3 className="text-xl font-semibold text-ghana-black">Performance Trends</h3>
                  </CardHeader>
                  <CardBody>
                    <div className="text-center py-12 text-gray-500">
                      <div className="text-4xl mb-4">📊</div>
                      <h4 className="text-lg font-medium mb-2">Performance Trends</h4>
                      <p className="text-sm">Historical performance data and trend analysis will be displayed here.</p>
                      <p className="text-xs mt-2">Connect to live data sources to see real-time trends</p>
                    </div>
                  </CardBody>
                </Card>
              </div>
            </Tab>
          </Tabs>
        </CardBody>
      </Card>

      {/* Bottom section: directly under Operations Overview */}
      {(!isHidden('recentActivities') || !isHidden('notices')) && (
      <div className="mt-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {!isHidden('recentActivities') && (
          <Card className="border-0 shadow-lg">
            <CardHeader className="pb-3 flex items-center justify-between">
              <h3 className="text-xl font-semibold text-ghana-black">📋 Recent Activities</h3>
              <HideCardButton onHide={() => hide('recentActivities')} label="Recent Activities" />
            </CardHeader>
            <CardBody>
              <RecentActivities area="housekeeping" />
            </CardBody>
          </Card>
          )}
          {!isHidden('notices') && (
          <Card className="border-0 shadow-lg">
            <CardHeader className="pb-3 flex items-center justify-between">
              <h3 className="text-xl font-semibold text-ghana-black">🔔 Housekeeping Notices</h3>
              <HideCardButton onHide={() => hide('notices')} label="Housekeeping Notices" />
            </CardHeader>
            <CardBody>
              <DeptNotices dept="housekeeping" title="" defaultTab="alerts" />
            </CardBody>
          </Card>
          )}
        </div>
      </div>
      )}
    </div>
  );
}
