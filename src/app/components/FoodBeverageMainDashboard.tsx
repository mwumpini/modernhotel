'use client';

import React, { useState, useEffect } from 'react';
import {
  Card,
  CardBody,
  CardHeader,
  Button,
  Tabs,
  Tab,
} from "@heroui/react";
import { ordersStore } from '../lib/fb/ordersStore';
import OfflineIndicator from './OfflineIndicator';
import DeptNotices from './DeptNotices';
import DeptMessenger from './DeptMessenger';
import RecentActivities from './RecentActivities';
import CustomizeViewControl, { HideCardButton } from './dashboard/CustomizeViewControl';
import { useDashboardVisibility, type DashboardSectionDef } from '../lib/dashboard/useDashboardVisibility';
import { useDashboardPeriod, isInPeriod } from '../lib/dashboard/useDashboardPeriod';
import {
  STOCK_KPI_SECTIONS,
  deptInventoryVisibilityKey,
} from './inventory/DepartmentInventoryPanel';
import { deskBookTabsClassNames, deskBookTabPanelClassName } from './dashboard/deskTabsUi';
import { SummaryCollapsedProvider, useSummaryCollapsed } from '../lib/dashboard/useSummaryCollapsed';
import { SummaryToggle } from './dashboard/SummaryToggle';

// Hideable summary cards. The service tabs (tables, reservations, menu,
// stock, requisitions, reports) stay visible.
const FB_DASHBOARD_SECTIONS: DashboardSectionDef[] = [
  { id: 'activeOrders', label: 'Active Orders' },
  { id: 'kitchenOrders', label: 'Kitchen Orders' },
  { id: 'barOrders', label: 'Bar Orders' },
  { id: 'todayOps', label: "Today's Operations" },
  { id: 'recentActivities', label: 'Recent Activities' },
  { id: 'notices', label: 'F&B Notices' },
];

const FB_TAB_OPTIONS = [
  { key: 'activity', label: '💳 Transactions' },
  { key: 'tables', label: '🪑 Tables' },
  { key: 'reservations', label: '📅 Reservations' },
  { key: 'ready', label: '🍽️ Ready now' },
  { key: 'menu', label: '🍽️ Menu' },
  { key: 'cashiering', label: '💵 Cashiering' },
  { key: 'supplies', label: '📦 Supplies' },
  { key: 'reports', label: '📈 Reports & Analysis' },
] as const;

type SuppliesView = 'inventory' | 'stock-count' | 'requisitions';

const SUPPLIES_VIEWS: { key: SuppliesView; label: string }[] = [
  { key: 'inventory', label: '📦 Inventory' },
  { key: 'stock-count', label: '🔍 Stock Count' },
  { key: 'requisitions', label: '📝 Requisitions' },
];

const FB_TABS = new Set<string>([
  ...FB_TAB_OPTIONS.map((tab) => tab.key),
  'inventory',
  'stock-count',
  'requisitions',
]);
const FB_TAB_ALIASES: Record<string, string> = {
  overview: 'tables',
  restaurant: 'tables',
  staff: 'tables',
  analytics: 'reports',
  inventory: 'supplies',
  'stock-count': 'supplies',
  requisitions: 'supplies',
};

function resolveFbTab(raw: string | null) {
  if (!raw) return null;
  const mapped = FB_TAB_ALIASES[raw] || raw;
  return FB_TABS.has(mapped) ? mapped : null;
}

function resolveSuppliesView(raw: string | null | undefined): SuppliesView {
  if (raw === 'stock-count' || raw === 'requisitions' || raw === 'inventory') return raw;
  return 'inventory';
}

import ModuleExpandButton from './ModuleExpandButton';
import SubViewPills from './dashboard/SubViewPills';
import FBPOS from './FBPOS';
import { ReadyNowPage } from './fb/ReadyNowBoard';
import FoodBeveragePosActivity from './FoodBeveragePosActivity';
import FoodBeverageRestaurantBar from './FoodBeverageRestaurantBar';
import FoodBeverageMenuInventory from './FoodBeverageMenuInventory';
import FoodBeverageAnalyticsDashboard from './FoodBeverageAnalyticsDashboard';
import DepartmentStockCountPanel from './inventory/DepartmentStockCountPanel';
import CashierShiftPanel from './CashierShiftPanel';

export default function FoodBeverageMainDashboard({
  initialTab,
  fullPage = false,
}: {
  initialTab?: string;
  fullPage?: boolean;
} = {}) {
  const [, setTick] = useState(0);
  const [selectedTab, setSelectedTab] = useState(resolveFbTab(initialTab || null) || 'tables');
  const { collapsed: summaryCollapsed, toggle: toggleSummary } = useSummaryCollapsed('restaurant.summaryCollapsed');
  const [suppliesView, setSuppliesView] = useState<SuppliesView>(() => resolveSuppliesView(initialTab));
  const [showPOS, setShowPOS] = useState(false);
  const [posEditOrderId, setPosEditOrderId] = useState<string | null>(null);

  const { isHidden, hide, toggle: toggleSection, showAll, hiddenCount } = useDashboardVisibility('dashboard.hidden.restaurantBar', FB_DASHBOARD_SECTIONS);
  const stockVisibility = useDashboardVisibility(deptInventoryVisibilityKey('restaurant'), STOCK_KPI_SECTIONS);
  const deskPeriod = useDashboardPeriod('dashboard.period.restaurantBar', 'today');
  const onInventoryKpis = selectedTab === 'supplies' && suppliesView === 'inventory';
  const customizeSections = onInventoryKpis ? STOCK_KPI_SECTIONS : FB_DASHBOARD_SECTIONS;
  const customizeApi = onInventoryKpis ? stockVisibility : { isHidden, toggle: toggleSection, showAll, hiddenCount };

  useEffect(() => {
    const applyStoredTab = () => {
      try {
        const tab = localStorage.getItem('fb.tab');
        if (!tab) return;
        const resolved = resolveFbTab(tab);
        if (resolved) setSelectedTab(resolved);
        if (tab === 'inventory' || tab === 'stock-count' || tab === 'requisitions') {
          setSuppliesView(resolveSuppliesView(tab));
        }
        localStorage.removeItem('fb.tab');
      } catch {
        /* ignore */
      }
    };
    applyStoredTab();
    window.addEventListener('fb-navigate', applyStoredTab);
    return () => window.removeEventListener('fb-navigate', applyStoredTab);
  }, []);
  
  useEffect(() => {
    const unsubscribe = ordersStore.subscribe(() => setTick(t => t + 1));
    // Pulls in real persisted order history — the subscribe above bumps `tick`
    // once this resolves and notifies listeners.
    ordersStore.hydrateFromApi();
    return unsubscribe;
  }, []);

  // Get data from stores
  const allOrders = ordersStore.all();
  const activeOrders = allOrders.filter(o => o.status !== 'paid');
  const kitchenOrders = activeOrders.filter(o => o.items.some(i => i.route === 'kitchen'));
  const barOrders = activeOrders.filter(o => o.items.some(i => i.route === 'bar'));
  const completedOrders = allOrders.filter(o => o.status === 'paid');

  const pendingOrders = activeOrders.filter(o => o.status === 'pending').length;
  const preparingOrders = activeOrders.filter(o => o.status === 'preparing').length;

  // Period-scoped completed orders (Customize → KPI period)
  const periodOrders = completedOrders.filter((o) => isInPeriod(o.createdAt, deskPeriod.period, deskPeriod.todayISO));
  const periodRevenue = periodOrders.reduce((sum, order) => sum + (order.total || 0), 0);
  const periodKitchenDone = periodOrders.filter((o) => o.items.some((i) => i.route === 'kitchen')).length;
  const periodBarDone = periodOrders.filter((o) => o.items.some((i) => i.route === 'bar')).length;

  if (showPOS) {
    return (
      <FBPOS
        editOrderId={posEditOrderId}
        onClose={() => {
          setShowPOS(false);
          setPosEditOrderId(null);
        }}
      />
    );
  }

  return (
    <SummaryCollapsedProvider collapsed={!fullPage && summaryCollapsed}>
    <div className={fullPage ? 'px-3 pt-1 pb-3' : 'p-6'}>
      {!fullPage && <DeptMessenger from="f&b" mode="drawer" />}
      <div className={`flex items-center justify-between ${fullPage ? 'mb-2' : 'mb-6'}`}>
        <h2 className={`${fullPage ? 'text-xl' : 'text-2xl'} font-bold text-ghana-black`}>🍽️ Restaurant & Bar</h2>
        <div className="flex items-center gap-2">
          {!fullPage && <SummaryToggle collapsed={summaryCollapsed} onToggle={toggleSummary} />}
          {!fullPage && (
            <Button
              color="success"
              size="sm"
              className="bg-green-600 text-white"
              onClick={() => {
                setPosEditOrderId(null);
                setShowPOS(true);
              }}
            >
              Open POS
            </Button>
          )}
          <CustomizeViewControl
            sections={customizeSections}
            isHidden={customizeApi.isHidden}
            toggle={customizeApi.toggle}
            showAll={customizeApi.showAll}
            hiddenCount={customizeApi.hiddenCount}
            period={deskPeriod.period}
            onPeriodChange={deskPeriod.setPeriod}
            defaultPeriod={deskPeriod.defaultPeriod}
          />
          {!fullPage && (
            <ModuleExpandButton
              href={selectedTab === 'reports' ? '/fb/reports' : '/fb/ops'}
              label={selectedTab === 'reports' ? 'Open reports full page' : 'Open restaurant & bar full page'}
            />
          )}
          {!fullPage && <OfflineIndicator />}
        </div>
      </div>

      {/* Order Status Overview - Following Uniform Pattern */}
      {!fullPage && !summaryCollapsed && (
      <div className="mb-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xl font-semibold text-ghana-black flex items-center gap-2">
            📊 Order Status Overview ({activeOrders.length} Active Orders)
          </h3>
          <span className="text-xs text-gray-500">Live queue · completed {deskPeriod.label}</span>
        </div>

        {/* Status Cards - Matching Uniform Design */}
        {(!isHidden('activeOrders') || !isHidden('kitchenOrders') || !isHidden('barOrders')) && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-3">
          {/* Active Orders */}
          {!isHidden('activeOrders') && (
          <Card className="border-0 shadow-lg border-l-4 border-l-blue-500">
            <CardBody className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-lg font-semibold text-ghana-black">Active Orders</h4>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                  <HideCardButton onHide={() => hide('activeOrders')} label="Active Orders" />
                </div>
              </div>
              <div className="text-3xl font-bold text-blue-600 mb-3">{activeOrders.length}</div>
              <div className="space-y-1 text-sm text-gray-600">
                <div className="flex justify-between">
                  <span>Pending</span>
                  <span className="font-medium">{pendingOrders}</span>
                </div>
                <div className="flex justify-between">
                  <span>Preparing</span>
                  <span className="font-medium">{preparingOrders}</span>
                </div>
                <div className="flex justify-between">
                  <span>Ready</span>
                  <span className="font-medium">{activeOrders.filter(o => o.status === 'ready').length}</span>
                </div>
                <div className="flex justify-between">
                  <span>Completed ({deskPeriod.label})</span>
                  <span className="font-medium text-green-700">{periodOrders.length}</span>
                </div>
              </div>
            </CardBody>
          </Card>
          )}

          {/* Kitchen Orders */}
          {!isHidden('kitchenOrders') && (
          <Card className="border-0 shadow-lg border-l-4 border-l-orange-500">
            <CardBody className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-lg font-semibold text-ghana-black">Kitchen Orders</h4>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                  <HideCardButton onHide={() => hide('kitchenOrders')} label="Kitchen Orders" />
                </div>
              </div>
              <div className="text-3xl font-bold text-orange-600 mb-3">{kitchenOrders.length}</div>
              <div className="space-y-1 text-sm text-gray-600">
                <div className="flex justify-between">
                  <span>Urgent</span>
                  <span className="font-medium">{kitchenOrders.filter(o => o.priority === 'urgent').length}</span>
                </div>
                <div className="flex justify-between">
                  <span>Preparing</span>
                  <span className="font-medium">{kitchenOrders.filter(o => o.status === 'preparing').length}</span>
                </div>
                <div className="flex justify-between">
                  <span>Ready</span>
                  <span className="font-medium">{kitchenOrders.filter(o => o.status === 'ready').length}</span>
                </div>
                <div className="flex justify-between">
                  <span>Completed ({deskPeriod.label})</span>
                  <span className="font-medium text-green-700">{periodKitchenDone}</span>
                </div>
              </div>
            </CardBody>
          </Card>
          )}

          {/* Bar Orders */}
          {!isHidden('barOrders') && (
          <Card className="border-0 shadow-lg border-l-4 border-l-purple-500">
            <CardBody className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-lg font-semibold text-ghana-black">Bar Orders</h4>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                  <HideCardButton onHide={() => hide('barOrders')} label="Bar Orders" />
                </div>
              </div>
              <div className="text-3xl font-bold text-purple-600 mb-3">{barOrders.length}</div>
              <div className="space-y-1 text-sm text-gray-600">
                <div className="flex justify-between">
                  <span>Alcoholic</span>
                  <span className="font-medium">{barOrders.filter(o => o.items.some(i => i.category === 'alcoholic')).length}</span>
                </div>
                <div className="flex justify-between">
                  <span>Non-Alcoholic</span>
                  <span className="font-medium">{barOrders.filter(o => o.items.some(i => i.category === 'non-alcoholic')).length}</span>
                </div>
                <div className="flex justify-between">
                  <span>Ready</span>
                  <span className="font-medium">{barOrders.filter(o => o.status === 'ready').length}</span>
                </div>
                <div className="flex justify-between">
                  <span>Completed ({deskPeriod.label})</span>
                  <span className="font-medium text-green-700">{periodBarDone}</span>
                </div>
              </div>
            </CardBody>
          </Card>
          )}
        </div>
        )}

        {/* Today's Operations - Matching Uniform Pattern */}
        {!isHidden('todayOps') && (
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
            <div className="flex items-center gap-1.5">
              <span className="text-base">📅</span>
              <h4 className="text-sm font-semibold text-ghana-black lg:text-base">Operations · {deskPeriod.label}</h4>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <div className="flex items-center gap-1.5">
                <span className="text-green-600 font-medium">{periodOrders.length} Orders</span>
                <span className="text-gray-500">Completed</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-blue-600 font-medium">₵{periodRevenue.toFixed(2)}</span>
                <span className="text-gray-500">Revenue</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-orange-600 font-medium">{activeOrders.length} Active</span>
                <span className="text-gray-500">In progress</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <HideCardButton onHide={() => hide('todayOps')} label="Today's Operations" />
          </div>
        </div>
        )}
      </div>
      )}

      <Card className="border-0 shadow-lg">
        {fullPage && (
          <div className="flex justify-end px-3 pt-2">
            <Button
              color="success"
              size="sm"
              className="bg-green-600 text-white"
              onClick={() => {
                setPosEditOrderId(null);
                setShowPOS(true);
              }}
            >
              Open POS
            </Button>
          </div>
        )}
        <CardBody className="p-0">
          <Tabs
            selectedKey={selectedTab}
            onSelectionChange={(key) => setSelectedTab(String(key))}
            className="w-full"
            size="sm"
            variant="solid"
            classNames={deskBookTabsClassNames}
            aria-label="Restaurant and bar operations"
          >
            {FB_TAB_OPTIONS.map((tab) => (
              <Tab key={tab.key} title={tab.label} />
            ))}
          </Tabs>
          <div className={deskBookTabPanelClassName}>
            {selectedTab === 'activity' && (
              <FoodBeveragePosActivity
                onEditInPos={(orderId) => {
                  setPosEditOrderId(orderId);
                  setShowPOS(true);
                }}
              />
            )}
            {selectedTab === 'tables' && <FoodBeverageRestaurantBar panel="tables" />}
            {selectedTab === 'reservations' && <FoodBeverageRestaurantBar panel="reservations" />}
            {selectedTab === 'ready' && <ReadyNowPage />}
            {selectedTab === 'menu' && <FoodBeverageMenuInventory panel="menu" />}
            {selectedTab === 'cashiering' && <CashierShiftPanel outlet="restaurant" />}
            {selectedTab === 'supplies' && (
              <div>
                <SubViewPills
                  views={SUPPLIES_VIEWS}
                  selected={suppliesView}
                  onSelect={setSuppliesView}
                  ariaLabel="Restaurant supplies views"
                />
                {suppliesView === 'inventory' && <FoodBeverageMenuInventory panel="inventory" />}
                {suppliesView === 'stock-count' && (
                  <DepartmentStockCountPanel department="restaurant" />
                )}
                {suppliesView === 'requisitions' && <FoodBeverageMenuInventory panel="requisitions" />}
              </div>
            )}
            {selectedTab === 'reports' && <FoodBeverageAnalyticsDashboard />}
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
              <RecentActivities area="f&b" />
            </CardBody>
          </Card>
          )}
          {!isHidden('notices') && (
          <Card className="border-0 shadow-lg">
            <CardHeader className="pb-3 flex items-center justify-between">
              <h3 className="text-xl font-semibold text-ghana-black">🔔 F&B Notices</h3>
              <HideCardButton onHide={() => hide('notices')} label="F&B Notices" />
            </CardHeader>
            <CardBody>
              <DeptNotices dept="f&b" title="" defaultTab="alerts" />
            </CardBody>
          </Card>
          )}
        </div>
      </div>
      )}
    </div>
    </SummaryCollapsedProvider>
  );
}
