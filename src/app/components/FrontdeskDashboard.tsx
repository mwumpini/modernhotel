'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import dynamic from 'next/dynamic';
import DeptNotices from './DeptNotices';
import RecentActivities from './RecentActivities';
import DeptMessenger from './DeptMessenger';
import { 
  Card, 
  CardBody, 
  CardHeader, 
  Tabs, 
  Tab,
} from "@heroui/react";
import OfflineIndicator from './OfflineIndicator';
import { housekeepingStore } from '../lib/housekeeping/store';
import { frontOfficeStore } from '../lib/frontoffice/store';
import { useFrontOfficeLiveRefresh } from '../lib/frontoffice/useLiveRefresh';
import { useSettingsStore } from '../lib/settings/store';
import { useComplianceStore } from '../lib/compliance/store';
import { HideCardButton } from './dashboard/CustomizeViewControl';
import ModuleExpandButton from './ModuleExpandButton';
import {
  ALL_FO_DESK_SECTIONS,
  FO_KPI_SECTIONS_BY_TAB,
  FO_OVERVIEW_SECTIONS,
  FoDeskKpiCustomize,
  FrontOfficeDeskVisibilityProvider,
  FrontOfficeDeskPeriodProvider,
  useFrontOfficeDeskVisibility,
} from './frontoffice/foDeskKpi';
import { useDashboardPeriod, isInPeriod } from '../lib/dashboard/useDashboardPeriod';
import { deskBookTabsClassNames, deskBookTabPanelClassName } from './dashboard/deskTabsUi';
import { SummaryCollapsedProvider, useSummaryCollapsed } from '../lib/dashboard/useSummaryCollapsed';
import { SummaryToggle } from './dashboard/SummaryToggle';
const panelFallback = <div className="p-6 text-center text-gray-500">Loading...</div>;
const ReservationsBookingsManager = dynamic(() => import('./ReservationsBookingsManager'), { ssr: false, loading: () => panelFallback });
const ServiceChargesPage = dynamic(() => import('../guest-services/service-charges/page'), { ssr: false, loading: () => panelFallback });
const InvoicesPaymentsPage = dynamic(() => import('../guest-services/client-services/invoices-payments/page'), { ssr: false, loading: () => panelFallback });
const RoomAssignmentsManager = dynamic(() => import('./RoomAssignmentsManager'), { ssr: false, loading: () => panelFallback });
const FrontDeskCounter = dynamic(() => import('./FrontDeskCounter'), { ssr: false, loading: () => panelFallback });
const RoomTransferPanel = dynamic(() => import('./RoomTransferPanel'), { ssr: false, loading: () => panelFallback });
const ClientsServicesContent = dynamic(() => import('../guest-services/client-services/clients-services/ClientsServicesContent').then((m) => ({ default: m.ClientsServicesContent })), { ssr: false, loading: () => panelFallback });
const CashierShiftPanel = dynamic(() => import('./CashierShiftPanel'), { ssr: false, loading: () => panelFallback });
const FrontofficeNightAudit = dynamic(() => import('./FrontofficeNightAudit'), { ssr: false, loading: () => panelFallback });
const FrontOfficeReportsAnalysis = dynamic(() => import('./FrontOfficeReportsAnalysis'), { ssr: false, loading: () => panelFallback });

const FO_TABS = new Set(['reservations', 'rooms', 'desk', 'transfer', 'servicecharges', 'billing', 'cashiering', 'clients', 'night-audit', 'reports']);
const FO_TAB_ALIASES: Record<string, string> = {
  overview: 'reservations',
  guests: 'reservations',
  'guest-services': 'desk',
  checkins: 'desk',
  checkouts: 'desk',
  staff: 'reservations',
  night: 'night-audit',
};

function resolveFoTab(raw: string | null) {
  if (!raw) return null;
  const mapped = FO_TAB_ALIASES[raw] || raw;
  return FO_TABS.has(mapped) ? mapped : null;
}

export default function FrontdeskDashboard({
  initialTab,
  fullPage = false,
}: {
  initialTab?: string;
  fullPage?: boolean;
} = {}) {
  const [selectedTab, setSelectedTab] = useState(resolveFoTab(initialTab || null) || 'reservations');
  const { collapsed: summaryCollapsed, toggle: toggleSummary } = useSummaryCollapsed('frontdesk.summaryCollapsed');
  const [openNewReservation, setOpenNewReservation] = useState(false);
  const [, setRefreshTrigger] = useState(0);

  const { isHidden, hide, show, toggle: toggleSection, showAll, hiddenCount } = useFrontOfficeDeskVisibility(
    ALL_FO_DESK_SECTIONS,
    'dashboard.hidden.frontoffice',
  );
  const deskPeriod = useDashboardPeriod('dashboard.period.frontoffice', 'today');

  const deskVisibility = useMemo(
    () => ({ isHidden, hide, show, toggle: toggleSection, showAll, hiddenCount }),
    [isHidden, hide, show, toggleSection, showAll, hiddenCount],
  );
  const deskPeriodApi = useMemo(
    () => ({
      period: deskPeriod.period,
      setPeriod: deskPeriod.setPeriod,
      defaultPeriod: deskPeriod.defaultPeriod,
      todayISO: deskPeriod.todayISO,
      label: deskPeriod.label,
      isDefault: deskPeriod.isDefault,
    }),
    [deskPeriod.period, deskPeriod.setPeriod, deskPeriod.defaultPeriod, deskPeriod.todayISO, deskPeriod.label, deskPeriod.isDefault],
  );

  const customizeSections = FO_KPI_SECTIONS_BY_TAB[selectedTab]
    ?? (!fullPage ? FO_OVERVIEW_SECTIONS : []);

  useFrontOfficeLiveRefresh();
  const settings = useSettingsStore();
  const reservations = frontOfficeStore.reservations;
  const rooms = frontOfficeStore.rooms;
  const hkAllRooms = housekeepingStore.getAllRooms();
  useEffect(() => {
    void useComplianceStore.getState().syncCountryFromSetup();
  }, []);

  useEffect(() => {
    const applyStoredTab = () => {
      try {
        const tab = resolveFoTab(localStorage.getItem('fo.tab'));
        if (tab) {
          setSelectedTab(tab);
          localStorage.removeItem('fo.tab');
        }
      } catch {
        /* ignore */
      }
    };
    applyStoredTab();
    window.addEventListener('fo-navigate', applyStoredTab);
    return () => window.removeEventListener('fo-navigate', applyStoredTab);
  }, []);

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
  const todayIso = deskPeriod.todayISO;
  const checkingOutToday = reservations.filter((r) => r.status === 'checked-in' && isInPeriod(r.departure, deskPeriod.period, todayIso)).length;
  // "Extended" = still checked-in past their scheduled departure date (not period departures).
  const extendedStays = reservations.filter((r) => r.status === 'checked-in' && r.departure.slice(0, 10) < todayIso).length;
  const roomTypes = (settings as any)?.roomManagement?.roomTypes || [];
  const availableByType = (typeId: string) =>
    hkAllRooms.filter((r) => r.roomTypeId === typeId && ['vacant', 'clean', 'inspected'].includes(r.status as any)).length;
  const todayCheckIns = reservations.filter(
    (r) => (r.status === 'confirmed' || r.status === 'pending') && isInPeriod(r.arrival, deskPeriod.period, todayIso),
  ).length;
  const todayCheckOuts = checkingOutToday;
  return (
    <FrontOfficeDeskVisibilityProvider value={deskVisibility}>
    <FrontOfficeDeskPeriodProvider value={deskPeriodApi}>
    <SummaryCollapsedProvider collapsed={!fullPage && summaryCollapsed}>
    <div className={fullPage ? 'px-3 pt-1 pb-3' : 'p-6'}>
      {!fullPage && <DeptMessenger from="frontdesk" mode="drawer" />}
      <div className={`flex flex-wrap items-center justify-between gap-2 ${fullPage ? 'mb-2' : 'mb-6'}`}>
        <h2 className={`${fullPage ? 'text-xl' : 'text-2xl'} font-bold text-ghana-black`}>
          {fullPage ? '🏨 Front Office' : '🏨 Front Office Operations'}
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          {!fullPage && <SummaryToggle collapsed={summaryCollapsed} onToggle={toggleSummary} />}
          <FoDeskKpiCustomize sections={customizeSections} />
          {!fullPage && (
            <ModuleExpandButton
              href="/frontoffice/ops"
              label="Open front office full page"
            />
          )}
          {!fullPage && <OfflineIndicator />}
        </div>
      </div>

      {/* Room Status Overview */}
      {!fullPage && !summaryCollapsed && (
      <div className="mb-4">
        {(!isHidden('availableRooms') || !isHidden('occupiedRooms') || !isHidden('maintenance')) && (
        <>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xl font-semibold text-ghana-black flex items-center gap-2">
            🏠 Room Status Overview ({totalRooms} Rooms)
          </h3>
        </div>

        <div className="mb-3 grid grid-cols-1 gap-2 md:grid-cols-3">
          {/* Available Rooms */}
          {!isHidden('availableRooms') && (
          <Card className="border border-gray-200 border-l-2 border-l-green-500 shadow-none">
            <CardBody className="px-3 py-2">
              <div className="mb-1 flex items-center justify-between">
                <h4 className="text-sm font-semibold text-ghana-black">Available Rooms</h4>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <HideCardButton onHide={() => hide('availableRooms')} label="Available Rooms" />
                </div>
              </div>
              <div className="mb-1 text-base font-semibold tabular-nums text-green-700">{availableTotal}</div>
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
          <Card className="border border-gray-200 border-l-2 border-l-red-500 shadow-none">
            <CardBody className="px-3 py-2">
              <div className="mb-1 flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-ghana-black">Occupied Rooms</h4>
                  <span className="text-[11px] text-gray-500">House now · departures {deskPeriod.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                  <HideCardButton onHide={() => hide('occupiedRooms')} label="Occupied Rooms" />
                </div>
              </div>
              <div className="mb-1 text-base font-semibold tabular-nums text-red-700">{occupiedTotal}</div>
              <div className="space-y-1 text-sm text-gray-600">
                <div className="flex justify-between">
                  <span>Checking out ({deskPeriod.label})</span>
                  <span className="font-medium">{checkingOutToday}</span>
                </div>
                <div className="flex justify-between">
                  <span>Extended Stays</span>
                  <span className="font-medium">{extendedStays}</span>
                </div>
                <div className="flex justify-between">
                  <span>Arrivals ({deskPeriod.label})</span>
                  <span className="font-medium">{todayCheckIns}</span>
                </div>
              </div>
            </CardBody>
          </Card>
          )}

          {/* Maintenance & Cleaning */}
          {!isHidden('maintenance') && (
          <Card className="border border-gray-200 border-l-2 border-l-yellow-500 shadow-none">
            <CardBody className="px-3 py-2">
              <div className="mb-1 flex items-center justify-between">
                <h4 className="text-sm font-semibold text-ghana-black">Maintenance & Cleaning</h4>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                  <HideCardButton onHide={() => hide('maintenance')} label="Maintenance & Cleaning" />
                </div>
              </div>
              <div className="mb-1 text-base font-semibold tabular-nums text-yellow-700">{maintenanceOpen + dirtyRooms}</div>
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
        </>
        )}

        {/* Today's Room Operations */}
        {!isHidden('todayOps') && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
            <div className="flex items-center gap-1.5">
              <span className="text-base">📅</span>
              <h4 className="text-sm font-semibold text-ghana-black lg:text-base">Room Operations · {deskPeriod.label}</h4>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-green-600 font-medium">{todayCheckIns} Check-ins</span>
                <span className="text-gray-500">Arrivals</span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-blue-600 font-medium">{todayCheckOuts} Check-outs</span>
                <span className="text-gray-500">Departures</span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-orange-600 font-medium">{maintenanceOpen} Maintenance</span>
                <span className="text-gray-500">Open</span>
              </div>
            </div>
          </div>
          <HideCardButton onHide={() => hide('todayOps')} label="Today's Room Operations" />
        </div>
        )}
      </div>
      )}

      <Card className="border-0 shadow-lg">
        <CardBody className="p-0">
          <Tabs
            selectedKey={selectedTab}
            onSelectionChange={(key) => setSelectedTab(key as string)}
            className="w-full"
            size="sm"
            variant="solid"
            classNames={deskBookTabsClassNames}
            aria-label="Front office operations"
          >
            <Tab key="rooms" title="🛏️ Rooms" />
            <Tab key="reservations" title="📅 Reservations" />
            <Tab key="desk" title="🛎️ Desk" />
            <Tab key="transfer" title="🔄 Room Transfer" />
            <Tab key="servicecharges" title="🏊 Service Charges" />
            <Tab key="billing" title="💳 Invoices & Payments" />
            <Tab key="cashiering" title="💵 Cashiering" />
            <Tab key="clients" title="👥 Clients" />
            <Tab key="night-audit" title="🌙 Night Audit" />
            <Tab key="reports" title="📈 Reports & Analysis" />
          </Tabs>
          <div className={deskBookTabPanelClassName}>
            {selectedTab === 'reservations' && (
              <ReservationsBookingsManager
                autoOpenNew={openNewReservation}
                onAutoOpenConsumed={() => setOpenNewReservation(false)}
              />
            )}
            {selectedTab === 'rooms' && (
              <RoomAssignmentsManager
                onNewReservation={() => {
                  setOpenNewReservation(true);
                  setSelectedTab('reservations');
                }}
              />
            )}
            {selectedTab === 'desk' && <FrontDeskCounter />}
            {selectedTab === 'transfer' && <RoomTransferPanel />}
            {selectedTab === 'servicecharges' && <ServiceChargesPage />}
            {selectedTab === 'billing' && <InvoicesPaymentsPage />}
            {selectedTab === 'cashiering' && <CashierShiftPanel />}
            {selectedTab === 'clients' && (
              <Suspense fallback={panelFallback}>
                <ClientsServicesContent embedded />
              </Suspense>
            )}
            {selectedTab === 'night-audit' && <FrontofficeNightAudit />}
            {selectedTab === 'reports' && <FrontOfficeReportsAnalysis embedded />}
          </div>
        </CardBody>
      </Card>

      {/* Recent Activities & Notices */}
      {!fullPage && (!isHidden('recentActivities') || !isHidden('notices')) && (
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
    </SummaryCollapsedProvider>
    </FrontOfficeDeskPeriodProvider>
    </FrontOfficeDeskVisibilityProvider>
  );
}
