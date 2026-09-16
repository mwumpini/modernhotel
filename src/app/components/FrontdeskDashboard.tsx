'use client';

import React, { useState, useRef, useEffect } from 'react';
import DeptNotices from './DeptNotices';
import RecentActivities from './RecentActivities';
import DeptMessenger from './DeptMessenger';
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
import OfflineIndicator from './OfflineIndicator';
import { housekeepingStore } from '../lib/housekeeping/store';
import { frontOfficeStore } from '../lib/frontoffice/store';
import { useSettingsStore } from '../lib/settings/store';
import { useRouter } from 'next/navigation';
import CustomizeViewControl, { HideCardButton } from './dashboard/CustomizeViewControl';
import { useDashboardVisibility, type DashboardSectionDef } from '../lib/dashboard/useDashboardVisibility';
import DepartmentStaffTab from './hr/DepartmentStaffTab';

// Hideable summary/widget cards on this dashboard — the "Operations Overview"
// tabs are core navigation, not clutter, so they're deliberately not included.
const FRONTDESK_DASHBOARD_SECTIONS: DashboardSectionDef[] = [
  { id: 'availableRooms', label: 'Available Rooms' },
  { id: 'occupiedRooms', label: 'Occupied Rooms' },
  { id: 'maintenance', label: 'Maintenance & Cleaning' },
  { id: 'todayOps', label: "Today's Room Operations" },
  { id: 'recentActivities', label: 'Recent Activities' },
  { id: 'notices', label: 'Front Desk Notices' },
];

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

export default function FrontdeskDashboard() {
  const [selectedTab, setSelectedTab] = useState("overview");
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const router = useRouter();

  const { isHidden, hide, toggle: toggleSection, showAll, hiddenCount } = useDashboardVisibility('dashboard.hidden.frontdesk', FRONTDESK_DASHBOARD_SECTIONS);

  const settings = useSettingsStore();
  const reservations = frontOfficeStore.reservations;
  const rooms = frontOfficeStore.rooms;
  const hkAllRooms = housekeepingStore.getAllRooms();

  // Subscribe to store changes to update client count
  useEffect(() => {
    const unsubscribe = frontOfficeStore.subscribe(() => {
      setRefreshTrigger(prev => prev + 1);
    });
    return unsubscribe;
  }, []);
  const settingsRoomsCount = (settings as any)?.roomManagement?.rooms?.length || 0;
  const totalRooms = settingsRoomsCount || rooms.length || hkAllRooms.length;
  const availableTotal = hkAllRooms.filter(r => ['vacant', 'clean', 'inspected'].includes(r.status as any)).length;
  const occupiedTotal = hkAllRooms.filter(r => r.status === 'occupied').length;
  const dirtyRooms = hkAllRooms.filter(r => r.status === 'dirty').length;
  const maintenanceOpen = housekeepingStore.getMaintenanceRequests().filter(m => m.status !== 'completed').length;
  const readySoon = hkAllRooms.filter(r => r.status === 'inspected').length;
  const todayIso = new Date().toISOString().slice(0,10);
  const checkingOutToday = reservations.filter(r => r.status === 'checked-in' && r.departure.slice(0,10) === todayIso).length;
  // "Extended" = still checked-in past their scheduled departure date (not today's departures).
  const extendedStays = reservations.filter(r => r.status === 'checked-in' && r.departure.slice(0,10) < todayIso).length;
  const roomTypes = (settings as any)?.roomManagement?.roomTypes || [];
  const availableByType = (typeId: string) =>
    hkAllRooms.filter(r => r.roomTypeId === typeId && ['vacant', 'clean', 'inspected'].includes(r.status as any)).length;
  const todayCheckIns = reservations.filter(r => (r.status === 'confirmed' || r.status === 'pending') && r.arrival.slice(0,10) === todayIso).length;
  const todayCheckOuts = checkingOutToday;

  const operationalItems = [
    {
      category: 'Reservations & Bookings',
      items: [
        { title: 'Reservations', icon: '📅', description: 'Manage room reservations and bookings', status: 'active', count: reservations.length },
        { title: 'Rooms & Bookings', icon: '🏠', description: 'View and manage room assignments', status: 'active', count: totalRooms },
        { title: 'Room Management', icon: '📋', description: 'Room status and maintenance tracking', status: 'active', count: totalRooms },
        { title: 'Client Management', icon: '👥', description: 'Manage client profiles, search, and preferences', status: 'active', count: frontOfficeStore.guests.length },
      ]
    },
    {
      category: 'Guest Services',
      items: [
        { title: 'Check-ins', icon: '✅', description: 'Guest check-in and check-ins management', status: 'active', count: todayCheckIns + occupiedTotal },
        { title: 'Check-outs', icon: '🚪', description: 'Guest check-out processing', status: 'active', count: todayCheckOuts },
        { title: 'Invoices & Payments', icon: '📄', description: 'Billing and payment processing', status: 'active', count: 0 }, // Clean slate - no invoices
      ]
    },
    {
      category: 'Operations & Reports',
      items: [
        { title: 'Cashiering', icon: '💵', description: 'Open/close till shifts and reconcile cash against real payments', status: 'active', count: 0 },
        { title: 'Night Audit', icon: '🌙', description: 'Run and review the nightly revenue/room reconciliation', status: 'active', count: 0 },
        { title: 'Reports & Analysis', icon: '📊', description: 'Occupancy, arrivals, departures, and front office analytics', status: 'active', count: 0 },
      ]
    },


  ];

  return (
    <div className="p-6">
      <DeptMessenger from="frontdesk" mode="drawer" />
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-ghana-black">🏨 Front Office Operations</h2>
        <div className="flex items-center gap-2">
          <CustomizeViewControl
            sections={FRONTDESK_DASHBOARD_SECTIONS}
            isHidden={isHidden}
            toggle={toggleSection}
            showAll={showAll}
            hiddenCount={hiddenCount}
          />
          <OfflineIndicator />
        </div>
      </div>

      {/* Room Status Overview */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold text-ghana-black flex items-center gap-2">
            🏠 Room Status Overview ({totalRooms} Rooms)
          </h3>
        </div>

        {/* Status Cards */}
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
              <div className="text-3xl font-bold text-green-600 mb-3">{availableTotal}</div>
              <div className="space-y-1 text-sm text-gray-600">
                {roomTypes.map((rt: any) => (
                  <div key={rt.id} className="flex justify-between">
                    <span>{rt.name}</span>
                    <span className="font-medium">{availableByType(rt.id)}</span>
                  </div>
                ))}
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
              <div className="text-3xl font-bold text-red-600 mb-3">{occupiedTotal}</div>
              <div className="space-y-1 text-sm text-gray-600">
                <div className="flex justify-between">
                  <span>Checking Out Today</span>
                  <span className="font-medium">{checkingOutToday}</span>
                </div>
                <div className="flex justify-between">
                  <span>Extended Stays</span>
                  <span className="font-medium">{extendedStays}</span>
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
              <div className="text-3xl font-bold text-yellow-600 mb-3">{maintenanceOpen + dirtyRooms}</div>
              <div className="space-y-1 text-sm text-gray-600">
                <div className="flex justify-between">
                  <span>Under Maintenance</span>
                  <span className="font-medium">{maintenanceOpen}</span>
                </div>
                <div className="flex justify-between">
                  <span>Deep Cleaning</span>
                  <span className="font-medium">{dirtyRooms}</span>
                </div>
                <div className="flex justify-between">
                  <span>Ready Soon</span>
                  <span className="font-medium">{readySoon}</span>
                </div>
              </div>
            </CardBody>
          </Card>
          )}
        </div>
        )}

        {/* Today's Room Operations */}
        {!isHidden('todayOps') && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-lg">📅</span>
              <h4 className="text-lg font-semibold text-ghana-black">Today's Room Operations</h4>
            </div>
            <div className="flex items-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-green-600 font-medium">{todayCheckIns} Check-ins</span>
                <span className="text-gray-500">Starting 2:00 PM</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-blue-600 font-medium">{todayCheckOuts} Check-outs</span>
                <span className="text-gray-500">By 12:00 PM</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-orange-600 font-medium">{maintenanceOpen} Maintenance</span>
                <span className="text-gray-500">Scheduled</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              color="success"
              variant="solid"
              className="bg-green-600 hover:bg-green-700"
              onClick={() => router.push('/room-assignments')}
            >
              🏢 View Full Status
            </Button>
            <HideCardButton onHide={() => hide('todayOps')} label="Today's Room Operations" />
          </div>
        </div>
        )}
      </div>

      {/* Main Operations Interface */}
      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-3">
          <h3 className="text-xl font-semibold text-ghana-black">📊 Operations Overview</h3>
        </CardHeader>
        <CardBody>
          <Tabs 
            selectedKey={selectedTab} 
            onSelectionChange={(key) => {
              console.log(`[GUEST-SERVICES] Tab changed from ${selectedTab} to ${key}`);
              setSelectedTab(key as string);
            }}
            className="w-full"
          >
            <Tab key="overview" title="📊 Overview">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-4">
                {operationalItems.slice(0, 5).map((category, categoryIndex) => (
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
                              if (item.title.includes('Reservations')) {
                                router.push('/guest-services/check-ins?tab=reservations');
                              } else if (item.title.includes('Rooms & Bookings')) {
                                router.push('/room-assignments');
                              } else if (item.title.includes('Room Management')) {
                                router.push('/room-status');
                              } else if (item.title.includes('Check-ins')) {
                                router.push('/guest-services/check-ins?tab=checkins');
                              } else if (item.title.includes('Check-outs')) {
                                router.push('/guest-services/check-ins?tab=checkouts');
                              } else if (item.title.includes('Invoices & Payments')) {
                                router.push('/guest-services/check-ins?tab=billing');
                              } else if (item.title.includes('Cashiering')) {
                                router.push('/cashiering');
                              } else if (item.title.includes('Night Audit')) {
                                router.push('/night-audit');
                              } else if (item.title.includes('Reports & Analysis')) {
                                router.push('/reports');
                              } else if (item.title.includes('Client Management')) {
                                router.push('/guest-services/client-services/clients-services');
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
            <Tab key="guest-services" title="👥 Guest Services">
              <div className="mt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* 1. Check-ins */}
                  <Card className="border border-gray-200">
                      <CardBody className="p-4">
                        <div className="flex items-center space-x-3 mb-3">
                        <span className="text-2xl">✅</span>
                          <div>
                            <div className="flex items-center">
                            <InfoIcon description="Guest arrival and registration" />
                            <h4 className="font-semibold text-ghana-black">Check-ins</h4>
                          </div>
                          </div>
                        </div>
                        <div className="flex items-center justify-between mb-3">
                        <Badge color="success" variant="flat">active</Badge>
                        <Chip size="sm" variant="flat" color="primary">0</Chip>
                        </div>
                        <div className="mt-3">
                          <Button
                            size="sm"
                            color="primary"
                            variant="flat"
                            className="w-full"
                          onClick={() => router.push('/guest-services/check-ins?tab=reservations')}
                        >
                          ➕ New Reservation
                        </Button>
                        <Button
                          size="sm"
                          color="primary"
                          variant="flat"
                          className="w-full mt-2"
                          onClick={() => router.push('/guest-services/check-ins?tab=checkins')}
                        >
                          ✅ Process Check-ins
                        </Button>
                      </div>
                    </CardBody>
                  </Card>

                  {/* 2. Check-ins */}
                  <Card className="border border-gray-200">
                    <CardBody className="p-4">
                      <div className="flex items-center space-x-3 mb-3">
                        <span className="text-2xl">🏠</span>
                        <div>
                          <div className="flex items-center">
                            <InfoIcon description="Manage guests during their stay" />
                            <h4 className="font-semibold text-ghana-black">Check-ins</h4>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between mb-3">
                        <Badge color="success" variant="flat">active</Badge>
                        <Chip size="sm" variant="flat" color="primary">0</Chip>
                      </div>
                      <div className="mt-3">
                        <Button
                          size="sm"
                          color="primary"
                          variant="flat"
                          className="w-full"
                          onClick={() => router.push('/guest-services/check-ins?tab=checkins')}
                        >
                          🏠 Manage Guests
                        </Button>
                        </div>
                      </CardBody>
                    </Card>

                  {/* 3. Check-outs */}
                  <Card className="border border-gray-200">
                    <CardBody className="p-4">
                      <div className="flex items-center space-x-3 mb-3">
                        <span className="text-2xl">🚪</span>
                        <div>
                          <div className="flex items-center">
                            <InfoIcon description="Guest departure and final billing" />
                            <h4 className="font-semibold text-ghana-black">Check-outs</h4>
                          </div>
                </div>
              </div>
                      <div className="flex items-center justify-between mb-3">
                        <Badge color="success" variant="flat">active</Badge>
                        <Chip size="sm" variant="flat" color="primary">0</Chip>
                      </div>
                      <div className="mt-3">
                        <Button
                          size="sm"
                          color="primary"
                          variant="flat"
                          className="w-full"
                          onClick={() => router.push('/guest-services/check-ins?tab=checkouts')}
                        >
                          🚪 Process Check-outs
                        </Button>
                      </div>
                    </CardBody>
                  </Card>

                  {/* 4. Invoices & Payments */}
                  <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow cursor-pointer" onClick={() => router.push('/guest-services/check-ins?tab=billing')}>
                  <CardBody className="p-4 text-center">
                    <div className="text-3xl mb-2">📄</div>
                    <h3 className="text-lg font-semibold text-gray-800">Invoices & Payments</h3>
                    <p className="text-sm text-gray-600">Billing and payment processing</p>
                      <Button
                        color="primary"
                        variant="flat"
                        size="sm"
                        className="mt-3"
                        onClick={() => router.push('/guest-services/check-ins?tab=billing')}
                      >
                        Manage
                      </Button>
                    </CardBody>
                  </Card>
                </div>
              </div>
            </Tab>

            <Tab key="staff" title="👥 Staff Management">
              <DepartmentStaffTab
                departmentLabel="Front Office"
                overtimePermissionId="frontdesk.log-overtime"
                departmentNameHints={['front', 'reception', 'desk']}
                emptyLabel="No Front Office staff found in HR records."
                helperText="Staff sourced from HR records for Front Office departments."
              />
            </Tab>
          </Tabs>
        </CardBody>
      </Card>

      {/* Recent Activities & Notices */}
      {(!isHidden('recentActivities') || !isHidden('notices')) && (
      <div className="mt-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Activities */}
          {!isHidden('recentActivities') && (
          <Card className="border-0 shadow-lg">
            <CardHeader className="pb-3 flex items-center justify-between">
              <h3 className="text-xl font-semibold text-ghana-black">📋 Recent Activities</h3>
              <HideCardButton onHide={() => hide('recentActivities')} label="Recent Activities" />
            </CardHeader>
            <CardBody>
              <RecentActivities area="frontdesk" />
            </CardBody>
          </Card>
          )}

          {/* Front Desk Notices placed beside Recent Activities */}
          {!isHidden('notices') && (
          <Card className="border-0 shadow-lg">
            <CardHeader className="pb-3 flex items-center justify-between">
              <h3 className="text-xl font-semibold text-ghana-black">🔔 Front Desk Notices</h3>
              <HideCardButton onHide={() => hide('notices')} label="Front Desk Notices" />
            </CardHeader>
            <CardBody>
              <DeptNotices dept="frontdesk" title="" defaultTab="alerts" />
            </CardBody>
          </Card>
          )}
        </div>
      </div>
      )}
    </div>
  );
}
