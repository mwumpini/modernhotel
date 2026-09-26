'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { 
  Card, 
  CardBody, 
  CardHeader, 
  Tabs, 
  Tab, 
} from "@heroui/react";
import { housekeepingStore } from '../lib/housekeeping/store';
import { frontOfficeStore } from '../lib/frontoffice/store';
import OfflineIndicator from './OfflineIndicator';
import DeptNotices from './DeptNotices';
import DeptMessenger from './DeptMessenger';
import RecentActivities from './RecentActivities';
import CustomizeViewControl, { HideCardButton } from './dashboard/CustomizeViewControl';
import ModuleExpandButton from './ModuleExpandButton';
import { useDashboardVisibility, type DashboardSectionDef } from '../lib/dashboard/useDashboardVisibility';

// Hideable summary/widget cards on this dashboard — the "Operations Overview"
// tabs are core navigation, not clutter, so they're deliberately not included.
const HOUSEKEEPING_DASHBOARD_SECTIONS: DashboardSectionDef[] = [
  { id: 'availableRooms', label: 'Available Rooms' },
  { id: 'occupiedRooms', label: 'Occupied Rooms' },
  { id: 'maintenance', label: 'Maintenance & Cleaning' },
  { id: 'todayOps', label: "Today's Operations" },
  { id: 'recentActivities', label: 'Recent Activities' },
  { id: 'notices', label: 'Housekeeping Notices' },
];

// Import specialized components
import RoomStatusGrid from './housekeeping/RoomStatusGrid';
import TaskManagementPanel from './housekeeping/TaskManagementPanel';
import MaintenancePanel from './housekeeping/MaintenancePanel';
import RoomInspectionPanel from './housekeeping/RoomInspectionPanel';
import HousekeepingInventoryPanel from './housekeeping/HousekeepingInventoryPanel';
import HousekeepingRequisitionsPanel from './housekeeping/HousekeepingRequisitionsPanel';
import HousekeepingReportsAnalysis from './HousekeepingReportsAnalysis';
import DepartmentStaffTab from './hr/DepartmentStaffTab';
import RoomResponsibilitiesPanel from './housekeeping/RoomResponsibilitiesPanel';

const HK_TABS = ['rooms', 'tasks', 'maintenance', 'inspections', 'inventory', 'requisitions', 'staff', 'reports'] as const;

const HK_TAB_ALIASES: Record<string, string> = {
  overview: 'rooms',
  supplies: 'inventory',
  analytics: 'reports',
};

function resolveHkTab(value: string | null | undefined): string {
  if (!value) return 'rooms';
  const key = value.trim().toLowerCase();
  if ((HK_TABS as readonly string[]).includes(key)) return key;
  return HK_TAB_ALIASES[key] || 'rooms';
}

export default function HousekeepingMainDashboard({
  initialTab = 'rooms',
  fullPage = false,
}: {
  initialTab?: string;
  fullPage?: boolean;
} = {}) {
  const [, setTick] = useState(0);
  const [selectedTab, setSelectedTab] = useState(() => resolveHkTab(initialTab));
  const searchParams = useSearchParams();

  const { isHidden, hide, toggle: toggleSection, showAll, hiddenCount } = useDashboardVisibility('dashboard.hidden.housekeeping', HOUSEKEEPING_DASHBOARD_SECTIONS);

  const reservations = frontOfficeStore.reservations;

  useEffect(() => {
    const unsubscribe = housekeepingStore.subscribe(() => setTick(t => t + 1));
    housekeepingStore.hydrateFromApi();
    return unsubscribe;
  }, []);

  useEffect(() => {
    const apply = () => {
      try {
        const stored = localStorage.getItem('hk.tab');
        if (!stored) return;
        setSelectedTab(resolveHkTab(stored));
        localStorage.removeItem('hk.tab');
      } catch {
        /* ignore */
      }
    };
    apply();
    window.addEventListener('hk-navigate', apply);
    return () => window.removeEventListener('hk-navigate', apply);
  }, []);

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam) setSelectedTab(resolveHkTab(tabParam));
  }, [searchParams]);

  // Get data from stores
  const allRooms = housekeepingStore.getAllRooms();
  const pendingTasks = housekeepingStore.getTasksByStatus('pending');

  const availableRooms = allRooms.filter(r => r.status === 'clean' || r.status === 'inspected').length;
  const dirtyRooms = allRooms.filter(r => r.status === 'dirty').length;
  const occupiedRooms = allRooms.filter(r => r.status === 'occupied').length;
  const maintenanceRooms = allRooms.filter(r => r.status === 'maintenance' || r.status === 'out-of-order').length;
  const totalRooms = allRooms.length;

  // Today's operations
  const todayIso = new Date().toISOString().slice(0,10);
  const checkingOutToday = reservations.filter(r => r.status === 'checked-in' && r.departure.slice(0,10) === todayIso).length;
  const todayCheckIns = reservations.filter(r => (r.status === 'confirmed' || r.status === 'pending') && r.arrival.slice(0,10) === todayIso).length;


  return (
    <div className={fullPage ? 'p-6 pt-2' : 'p-6'}>
      {!fullPage && (
        <>
      <DeptMessenger from="housekeeping" mode="drawer" />
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-ghana-black">🛏️ Housekeeping & Maintenance</h2>
        <div className="flex items-center gap-2">
          <CustomizeViewControl
            sections={HOUSEKEEPING_DASHBOARD_SECTIONS}
            isHidden={isHidden}
            toggle={toggleSection}
            showAll={showAll}
            hiddenCount={hiddenCount}
          />
          <ModuleExpandButton
            href={selectedTab === 'reports' ? '/housekeeping/reports' : '/housekeeping/ops'}
            label={selectedTab === 'reports' ? 'Open reports full page' : 'Open housekeeping full page'}
          />
          <OfflineIndicator />
        </div>
      </div>
        </>
      )}

      {/* Room Status Overview - Following Front Desk Pattern */}
      {!fullPage && (
      <div className="mb-8">
        {(!isHidden('availableRooms') || !isHidden('occupiedRooms') || !isHidden('maintenance')) && (
        <>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold text-ghana-black flex items-center gap-2">
            🏠 Room Status Overview ({totalRooms} Rooms)
          </h3>
        </div>

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
        </>
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
          <HideCardButton onHide={() => hide('todayOps')} label="Today's Operations" />
        </div>
        )}
      </div>
      )}

      <Card className="border-0 shadow-lg">
        {fullPage && (
          <CardHeader className="pb-3">
            <h3 className="text-xl font-semibold text-ghana-black">Housekeeping</h3>
          </CardHeader>
        )}
        <CardBody>
          <Tabs
            selectedKey={selectedTab}
            onSelectionChange={(key) => setSelectedTab(String(key))}
            className="w-full"
            aria-label="Housekeeping operations"
          >
            <Tab key="rooms" title="🏠 Rooms">
              {selectedTab === 'rooms' && <div className="pt-4"><RoomStatusGrid /></div>}
            </Tab>
            <Tab key="tasks" title="🧹 Tasks">
              {selectedTab === 'tasks' && <div className="pt-4"><TaskManagementPanel /></div>}
            </Tab>
            <Tab key="maintenance" title="🔧 Maintenance">
              {selectedTab === 'maintenance' && <div className="pt-4"><MaintenancePanel /></div>}
            </Tab>
            <Tab key="inspections" title="🔍 Inspections">
              {selectedTab === 'inspections' && <div className="pt-4"><RoomInspectionPanel /></div>}
            </Tab>
            <Tab key="inventory" title="📦 Inventory">
              {selectedTab === 'inventory' && <div className="pt-4"><HousekeepingInventoryPanel /></div>}
            </Tab>
            <Tab key="requisitions" title="📝 Requisitions">
              {selectedTab === 'requisitions' && <div className="pt-4"><HousekeepingRequisitionsPanel /></div>}
            </Tab>
            <Tab key="staff" title="👥 Staff Management">
              {selectedTab === 'staff' && (
                <DepartmentStaffTab
                  departmentLabel="Housekeeping"
                  overtimePermissionId="housekeeping.log-overtime"
                  departmentNameHints={['housekeeping', 'house keeping', 'hk', 'maintenance']}
                  helperText="HR staff in a Housekeeping or Maintenance department. Weekly shifts and overtime sit here; hiring and payroll stay in HR. Names come from the HR file — this tab does not invent staff."
                  extraTabs={[
                    {
                      key: 'rooms',
                      title: '🛏️ Responsible for',
                      render: (hkStaff) => <RoomResponsibilitiesPanel staff={hkStaff} />,
                    },
                  ]}
                />
              )}
            </Tab>
            <Tab key="reports" title="📈 Reports & Analysis">
              {selectedTab === 'reports' && <div className="pt-4"><HousekeepingReportsAnalysis embedded /></div>}
            </Tab>
          </Tabs>
        </CardBody>
      </Card>


      {/* Bottom section: directly under Operations Overview */}
      {!fullPage && (!isHidden('recentActivities') || !isHidden('notices')) && (
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
