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
  { id: 'quickCreate', label: 'Quick create templates' },
  { id: 'inspectionStats', label: 'Inspections summary' },
  { id: 'maintenanceStats', label: 'Maintenance summary' },
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
import DepartmentStockCountPanel from './inventory/DepartmentStockCountPanel';
import {
  STOCK_KPI_SECTIONS,
  deptInventoryVisibilityKey,
} from './inventory/DepartmentInventoryPanel';
import HousekeepingReportsAnalysis from './HousekeepingReportsAnalysis';
import DepartmentStaffTab from './hr/DepartmentStaffTab';
import RoomResponsibilitiesPanel from './housekeeping/RoomResponsibilitiesPanel';
import CleaningAreasPanel from './housekeeping/CleaningAreasPanel';
import PublicSpacesStatusGrid from './housekeeping/PublicSpacesStatusGrid';
import SubViewPills from './dashboard/SubViewPills';
import { deskBookTabsClassNames, deskBookTabPanelClassName } from './dashboard/deskTabsUi';

/** Slim top-level tabs — Desk/Events style. Legacy keys remap below. */
const HK_PRIMARY = ['floor', 'work', 'supplies', 'staff', 'reports'] as const;
type HkPrimary = (typeof HK_PRIMARY)[number];

type FloorView = 'rooms' | 'spaces' | 'inspections';
type WorkView = 'tasks' | 'maintenance' | 'areas';
type SuppliesView = 'inventory' | 'stock-count' | 'requisitions';

const FLOOR_VIEWS: { key: FloorView; label: string }[] = [
  { key: 'rooms', label: '🏠 Rooms' },
  { key: 'spaces', label: '📍 Public spaces' },
  { key: 'inspections', label: '✅ Inspections' },
];
const WORK_VIEWS: { key: WorkView; label: string }[] = [
  { key: 'tasks', label: '🧹 Cleaning' },
  { key: 'maintenance', label: '🔧 Maintenance' },
  { key: 'areas', label: '📍 Cleaning areas' },
];
const SUPPLIES_VIEWS: { key: SuppliesView; label: string }[] = [
  { key: 'inventory', label: '📦 Inventory' },
  { key: 'stock-count', label: '🔍 Stock Count' },
  { key: 'requisitions', label: '📝 Requisitions' },
];

function resolveHkNav(value: string | null | undefined): {
  primary: HkPrimary;
  floor?: FloorView;
  work?: WorkView;
  supplies?: SuppliesView;
} {
  if (!value) return { primary: 'floor', floor: 'rooms' };
  const key = value.trim().toLowerCase();
  if ((HK_PRIMARY as readonly string[]).includes(key)) {
    return {
      primary: key as HkPrimary,
      floor: key === 'floor' ? 'rooms' : undefined,
      work: key === 'work' ? 'tasks' : undefined,
      supplies: key === 'supplies' ? 'inventory' : undefined,
    };
  }
  switch (key) {
    case 'rooms':
    case 'overview':
      return { primary: 'floor', floor: 'rooms' };
    case 'inspections':
      return { primary: 'floor', floor: 'inspections' };
    case 'spaces':
    case 'public-spaces':
    case 'publicspaces':
      return { primary: 'floor', floor: 'spaces' };
    case 'tasks':
      return { primary: 'work', work: 'tasks' };
    case 'maintenance':
      return { primary: 'work', work: 'maintenance' };
    case 'areas':
    case 'cleaning-areas':
    case 'cleaningareas':
      return { primary: 'work', work: 'areas' };
    case 'inventory':
      return { primary: 'supplies', supplies: 'inventory' };
    case 'stock-count':
      return { primary: 'supplies', supplies: 'stock-count' };
    case 'requisitions':
      return { primary: 'supplies', supplies: 'requisitions' };
    case 'staff':
      return { primary: 'staff' };
    case 'reports':
    case 'analytics':
      return { primary: 'reports' };
    default:
      return { primary: 'floor', floor: 'rooms' };
  }
}

export default function HousekeepingMainDashboard({
  initialTab = 'rooms',
  fullPage = false,
}: {
  initialTab?: string;
  fullPage?: boolean;
} = {}) {
  const boot = resolveHkNav(initialTab);
  const [, setTick] = useState(0);
  const [selectedTab, setSelectedTab] = useState<HkPrimary>(boot.primary);
  const [floorView, setFloorView] = useState<FloorView>(boot.floor || 'rooms');
  const [workView, setWorkView] = useState<WorkView>(boot.work || 'tasks');
  const [suppliesView, setSuppliesView] = useState<SuppliesView>(boot.supplies || 'inventory');
  const searchParams = useSearchParams();

  const { isHidden, hide, toggle: toggleSection, showAll, hiddenCount } = useDashboardVisibility('dashboard.hidden.housekeeping', HOUSEKEEPING_DASHBOARD_SECTIONS);
  const stockVisibility = useDashboardVisibility(deptInventoryVisibilityKey('housekeeping'), STOCK_KPI_SECTIONS);
  const onInventoryKpis = selectedTab === 'supplies' && suppliesView === 'inventory';
  const customizeSections = onInventoryKpis ? STOCK_KPI_SECTIONS : HOUSEKEEPING_DASHBOARD_SECTIONS;
  const customizeApi = onInventoryKpis ? stockVisibility : { isHidden, toggle: toggleSection, showAll, hiddenCount };

  const reservations = frontOfficeStore.reservations;

  const applyNav = (raw: string) => {
    const nav = resolveHkNav(raw);
    setSelectedTab(nav.primary);
    if (nav.floor) setFloorView(nav.floor);
    if (nav.work) setWorkView(nav.work);
    if (nav.supplies) setSuppliesView(nav.supplies);
  };

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
        applyNav(stored);
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
    if (tabParam) applyNav(tabParam);
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
    <div className={fullPage ? 'px-3 pt-1 pb-3' : 'p-6'}>
      {!fullPage && <DeptMessenger from="housekeeping" mode="drawer" />}
      <div className={`flex flex-wrap items-center justify-between gap-2 ${fullPage ? 'mb-2' : 'mb-6'}`}>
        <h2 className={`${fullPage ? 'text-xl' : 'text-2xl'} font-bold text-ghana-black`}>
          {fullPage ? '🛏️ Housekeeping' : '🛏️ Housekeeping & Maintenance'}
        </h2>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <CustomizeViewControl
            sections={customizeSections}
            isHidden={customizeApi.isHidden}
            toggle={customizeApi.toggle}
            showAll={customizeApi.showAll}
            hiddenCount={customizeApi.hiddenCount}
          />
          {!fullPage && (
            <ModuleExpandButton
              href={selectedTab === 'reports' ? '/housekeeping/reports' : '/housekeeping/ops'}
              label={selectedTab === 'reports' ? 'Open reports full page' : 'Open housekeeping full page'}
            />
          )}
          {!fullPage && <OfflineIndicator />}
        </div>
      </div>

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
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
            <div className="flex items-center gap-2">
              <span className="text-lg">📅</span>
              <h4 className="text-lg font-semibold text-ghana-black">Today's Operations</h4>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-green-600 font-medium">{todayCheckIns} Check-ins</span>
                <span className="text-gray-500">Starting 2:00 PM</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-blue-600 font-medium">{checkingOutToday} Check-outs</span>
                <span className="text-gray-500">By 12:00 PM</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
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
        <CardBody className="p-0">
          <Tabs
            selectedKey={selectedTab}
            onSelectionChange={(key) => setSelectedTab(String(key) as HkPrimary)}
            className="w-full"
            size="sm"
            variant="solid"
            classNames={deskBookTabsClassNames}
            aria-label="Housekeeping operations"
          >
            <Tab key="floor" title="🏠 Floor" />
            <Tab key="work" title="🧹 Work" />
            <Tab key="supplies" title="📦 Supplies" />
            <Tab key="staff" title="👥 Staff" />
            <Tab key="reports" title="📈 Reports" />
          </Tabs>

          <div className={deskBookTabPanelClassName}>
            {selectedTab === 'floor' && (
              <div>
                <SubViewPills
                  views={FLOOR_VIEWS}
                  selected={floorView}
                  onSelect={setFloorView}
                  ariaLabel="Floor views"
                />
                {floorView === 'rooms' && <RoomStatusGrid />}
                {floorView === 'spaces' && <PublicSpacesStatusGrid />}
                {floorView === 'inspections' && (
                  <RoomInspectionPanel
                    hideStats={isHidden('inspectionStats')}
                    onHideStats={() => hide('inspectionStats')}
                  />
                )}
              </div>
            )}

            {selectedTab === 'work' && (
              <div>
                <SubViewPills
                  views={WORK_VIEWS}
                  selected={workView}
                  onSelect={setWorkView}
                  ariaLabel="Work views"
                />
                {workView === 'tasks' && (
                  <TaskManagementPanel
                    hideQuickCreate={isHidden('quickCreate')}
                    onHideQuickCreate={() => hide('quickCreate')}
                  />
                )}
                {workView === 'maintenance' && (
                  <MaintenancePanel
                    hideStats={isHidden('maintenanceStats')}
                    onHideStats={() => hide('maintenanceStats')}
                  />
                )}
                {workView === 'areas' && <CleaningAreasPanel />}
              </div>
            )}

            {selectedTab === 'supplies' && (
              <div>
                <SubViewPills
                  views={SUPPLIES_VIEWS}
                  selected={suppliesView}
                  onSelect={setSuppliesView}
                  ariaLabel="Supplies views"
                />
                {suppliesView === 'inventory' && <HousekeepingInventoryPanel />}
                {suppliesView === 'stock-count' && (
                  <DepartmentStockCountPanel department="housekeeping" />
                )}
                {suppliesView === 'requisitions' && <HousekeepingRequisitionsPanel />}
              </div>
            )}

            {selectedTab === 'staff' && (
              <DepartmentStaffTab
                departmentLabel="Housekeeping"
                overtimePermissionId="housekeeping.log-overtime"
                departmentNameHints={['housekeeping', 'house keeping', 'hk', 'maintenance']}
                extraTabs={[
                  {
                    key: 'rooms',
                    title: '🛏️ Responsible for',
                    render: (hkStaff) => <RoomResponsibilitiesPanel staff={hkStaff} />,
                  },
                ]}
              />
            )}

            {selectedTab === 'reports' && <HousekeepingReportsAnalysis embedded />}
          </div>
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
