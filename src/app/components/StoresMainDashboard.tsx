'use client';

import React, { useState, useEffect, Suspense, lazy } from 'react';
import {
  Card,
  CardBody,
  CardHeader,
  Button,
  Tabs,
  Tab,
} from '@heroui/react';
import { trackEvent } from '../lib/analytics/trackEvent';
import { useStockStore } from '../lib/inventory/stockStore';
import { useSupplierStore } from '../lib/inventory/supplierStore';
import DeptNotices from './DeptNotices';
import DeptMessenger from './DeptMessenger';
import RecentActivities from './RecentActivities';
import CustomizeViewControl, { HideCardButton } from './dashboard/CustomizeViewControl';
import ModuleExpandButton from './ModuleExpandButton';
import { useDashboardVisibility, type DashboardSectionDef } from '../lib/dashboard/useDashboardVisibility';
import DepartmentStaffTab from './hr/DepartmentStaffTab';
import InventoryReportsAnalysis from './InventoryReportsAnalysis';
import { deskBookTabsClassNames, deskBookTabPanelClassName } from './dashboard/deskTabsUi';

const InventorySupplyChainDashboard = lazy(() => import('./InventorySupplyChainDashboard'));

const STORES_DASHBOARD_SECTIONS: DashboardSectionDef[] = [
  { id: 'stockLevels', label: 'Stock Levels' },
  { id: 'inventoryValue', label: 'Inventory Value' },
  { id: 'purchaseOrders', label: 'Purchase Orders' },
  { id: 'todayOps', label: "Today's Operations" },
  { id: 'quickActions', label: 'Quick Actions' },
  { id: 'recentActivities', label: 'Recent Activities' },
  { id: 'notices', label: 'Inventory Notices' },
];

const INV_TABS = ['items', 'staff', 'reports'] as const;

function resolveInvTab(raw?: string | null): string {
  const key = String(raw || '').toLowerCase();
  if (key === 'inventory' || key === 'operations' || key === 'overview') return 'items';
  if ((INV_TABS as readonly string[]).includes(key)) return key;
  return 'items';
}

/**
 * Lean Inventory & Stores shell — status at a glance, then real ops
 * (items / suppliers / requisitions / POs / stock ops + reconciliation),
 * staff, and full Reports & Analysis. No fake overview menu.
 *
 * Need more room? Use Expand on the Operations card — opens `/inventory` or
 * `/inventory/reports` as a full page (sidebar-free), with Back to Inventory.
 */
export default function StoresMainDashboard() {
  const [selectedTab, setSelectedTab] = useState('items');

  const { isHidden, hide, toggle: toggleSection, showAll, hiddenCount } = useDashboardVisibility(
    'dashboard.hidden.stores',
    STORES_DASHBOARD_SECTIONS
  );

  const stockItems = useStockStore((s) => s.stockItems);
  const stockMovements = useStockStore((s) => s.stockMovements);
  const getLowStockItems = useStockStore((s) => s.getLowStockItems);
  const getOutOfStockItems = useStockStore((s) => s.getOutOfStockItems);
  const getTotalInventoryValue = useStockStore((s) => s.getTotalInventoryValue);
  const hydrateStock = useStockStore((s) => s.hydrateFromApi);
  const purchaseOrders = useSupplierStore((s) => s.purchaseOrders);
  const hydrateSuppliers = useSupplierStore((s) => s.hydrateSuppliersFromApi);
  const hydratePOs = useSupplierStore((s) => s.hydratePurchaseOrdersFromApi);

  useEffect(() => {
    hydrateStock();
    hydrateSuppliers();
    hydratePOs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const apply = (e: Event) => {
      const detail = (e as CustomEvent).detail || {};
      if (detail.tab) setSelectedTab(resolveInvTab(detail.tab));
    };
    window.addEventListener('inv-navigate', apply);
    return () => window.removeEventListener('inv-navigate', apply);
  }, []);

  const today = new Date().toISOString().slice(0, 10);
  const isToday = (d: Date) => new Date(d).toISOString().slice(0, 10) === today;

  const lowStockItemsList = getLowStockItems();
  const outOfStockItemsList = getOutOfStockItems();
  const valueOf = (items: typeof stockItems) => items.reduce((sum, i) => sum + i.currentStock * i.unitCost, 0);

  const totalItems = stockItems.length;
  const lowStockItems = lowStockItemsList.length;
  const outOfStockItems = outOfStockItemsList.length;
  const totalInventoryValue = getTotalInventoryValue();
  const lowStockValue = valueOf(lowStockItemsList);
  const outOfStockValue = valueOf(outOfStockItemsList);

  const totalPurchaseOrders = purchaseOrders.length;
  const pendingOrders = purchaseOrders.filter((p) => p.status === 'draft' || p.status === 'sent').length;
  const confirmedOrders = purchaseOrders.filter((p) => p.status === 'confirmed' || p.status === 'in-transit').length;
  const deliveredOrders = purchaseOrders.filter((p) => p.status === 'delivered' || p.status === 'closed').length;

  const itemsReceivedToday = stockMovements.filter((m) => m.movementType === 'in' && isToday(m.createdAt)).length;
  const itemsIssuedToday = stockMovements.filter((m) => m.movementType === 'out' && isToday(m.createdAt)).length;
  const purchaseOrdersCreatedToday = purchaseOrders.filter((p) => isToday(p.createdAt)).length;

  const goOps = (inner?: { tab?: string; stockOp?: string }) => {
    setSelectedTab('items');
    if (inner?.tab || inner?.stockOp) {
      window.dispatchEvent(new CustomEvent('inv-ops-navigate', { detail: inner }));
    }
  };

  const handleQuickAction = (action: string) => {
    trackEvent('Stores.QuickAction', { action });
    switch (action) {
      case 'add-item':
        goOps({ tab: 'inventory' });
        break;
      case 'create-po':
        goOps({ tab: 'purchase-orders' });
        break;
      case 'add-supplier':
        goOps({ tab: 'suppliers' });
        break;
      case 'stock-count':
        goOps({ tab: 'stock-operations', stockOp: 'stock-counts' });
        break;
      case 'low-stock-report':
        setSelectedTab('reports');
        break;
      case 'reports':
        setSelectedTab('reports');
        break;
    }
  };

  const quickActions = [
    { title: 'Add Item', icon: '➕', color: 'primary', action: 'add-item', description: 'New stock item' },
    { title: 'Create PO', icon: '📋', color: 'secondary', action: 'create-po', description: 'Purchase order' },
    { title: 'Add Supplier', icon: '🏢', color: 'success', action: 'add-supplier', description: 'Vendor on file' },
    { title: 'Stock Count', icon: '🔍', color: 'warning', action: 'stock-count', description: 'Reconcile physical' },
    { title: 'Reports', icon: '📊', color: 'danger', action: 'reports', description: 'Usage & stock file' },
  ];

  return (
    <div className="p-6">
      <DeptMessenger from="inventory" mode="drawer" />
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-ghana-black">📦 Inventory & Stores</h2>
        <div className="flex items-center gap-2">
          <CustomizeViewControl
            sections={STORES_DASHBOARD_SECTIONS}
            isHidden={isHidden}
            toggle={toggleSection}
            showAll={showAll}
            hiddenCount={hiddenCount}
          />
          {(selectedTab === 'items' || selectedTab === 'reports') && (
            <ModuleExpandButton
              href={selectedTab === 'reports' ? '/inventory/reports' : '/inventory'}
              label={selectedTab === 'reports' ? 'Open reports full page' : 'Open stock & supply full page'}
            />
          )}
        </div>
      </div>

      {(!isHidden('stockLevels') || !isHidden('inventoryValue') || !isHidden('purchaseOrders')) && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          {!isHidden('stockLevels') && (
            <Card className="border-0 shadow-lg border-l-4 border-l-green-500">
              <CardBody className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-lg font-semibold text-ghana-black">Stock Levels</h4>
                  <HideCardButton onHide={() => hide('stockLevels')} label="Stock Levels" />
                </div>
                <div className="text-3xl font-bold text-green-600 mb-3">
                  {Math.max(0, totalItems - lowStockItems - outOfStockItems)}
                </div>
                <div className="space-y-1 text-sm text-gray-600">
                  <div className="flex justify-between">
                    <span>On file</span>
                    <span className="font-medium">{totalItems}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Low stock</span>
                    <span className="font-medium">{lowStockItems}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Out of stock</span>
                    <span className="font-medium">{outOfStockItems}</span>
                  </div>
                </div>
              </CardBody>
            </Card>
          )}

          {!isHidden('inventoryValue') && (
            <Card className="border-0 shadow-lg border-l-4 border-l-blue-500">
              <CardBody className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-lg font-semibold text-ghana-black">Inventory Value</h4>
                  <HideCardButton onHide={() => hide('inventoryValue')} label="Inventory Value" />
                </div>
                <div className="text-3xl font-bold text-blue-600 mb-3">
                  ₵{(totalInventoryValue / 1000).toFixed(0)}K
                </div>
                <div className="space-y-1 text-sm text-gray-600">
                  <div className="flex justify-between">
                    <span>Total</span>
                    <span className="font-medium">₵{totalInventoryValue.toLocaleString('en-GH', { maximumFractionDigits: 0 })}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Low stock value</span>
                    <span className="font-medium">₵{(lowStockValue / 1000).toFixed(0)}K</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Out of stock value</span>
                    <span className="font-medium">₵{(outOfStockValue / 1000).toFixed(0)}K</span>
                  </div>
                </div>
              </CardBody>
            </Card>
          )}

          {!isHidden('purchaseOrders') && (
            <Card className="border-0 shadow-lg border-l-4 border-l-orange-500">
              <CardBody className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-lg font-semibold text-ghana-black">Purchase Orders</h4>
                  <HideCardButton onHide={() => hide('purchaseOrders')} label="Purchase Orders" />
                </div>
                <div className="text-3xl font-bold text-orange-600 mb-3">{totalPurchaseOrders}</div>
                <div className="space-y-1 text-sm text-gray-600">
                  <div className="flex justify-between">
                    <span>Pending</span>
                    <span className="font-medium">{pendingOrders}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Confirmed</span>
                    <span className="font-medium">{confirmedOrders}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Delivered</span>
                    <span className="font-medium">{deliveredOrders}</span>
                  </div>
                </div>
              </CardBody>
            </Card>
          )}
        </div>
      )}

      {!isHidden('todayOps') && (
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div className="flex items-center gap-4 flex-wrap">
            <h4 className="text-lg font-semibold text-ghana-black">Today&apos;s Operations</h4>
            <div className="flex items-center gap-6 text-sm">
              <span>
                <span className="text-green-600 font-medium">{itemsReceivedToday}</span>
                <span className="text-gray-500"> received</span>
              </span>
              <span>
                <span className="text-blue-600 font-medium">{itemsIssuedToday}</span>
                <span className="text-gray-500"> issued</span>
              </span>
              <span>
                <span className="text-orange-600 font-medium">{purchaseOrdersCreatedToday}</span>
                <span className="text-gray-500"> POs created</span>
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button color="success" className="bg-green-600" onPress={() => goOps({ tab: 'inventory' })}>
              Open stock file
            </Button>
            <HideCardButton onHide={() => hide('todayOps')} label="Today's Operations" />
          </div>
        </div>
      )}

      {!isHidden('quickActions') && (
        <Card className="border-0 shadow-lg mb-6">
          <CardHeader className="pb-3 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-ghana-black">Quick Actions</h3>
            <HideCardButton onHide={() => hide('quickActions')} label="Quick Actions" />
          </CardHeader>
          <CardBody>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {quickActions.map((action) => (
                <Button
                  key={action.action}
                  color={action.color as any}
                  variant="flat"
                  className="h-20 flex flex-col items-center justify-center gap-1"
                  onPress={() => handleQuickAction(action.action)}
                >
                  <span className="text-xl">{action.icon}</span>
                  <span className="font-medium text-sm">{action.title}</span>
                </Button>
              ))}
            </div>
          </CardBody>
        </Card>
      )}

      <Card className="border-0 shadow-lg">
        <CardBody className="p-0">
          <Tabs
            selectedKey={selectedTab}
            onSelectionChange={(key) => setSelectedTab(String(key))}
            className="w-full"
            size="sm"
            variant="solid"
            classNames={deskBookTabsClassNames}
            aria-label="Inventory operations"
          >
            <Tab key="items" title="📦 Stock & Supply">
              {selectedTab === 'items' && (
                <Suspense fallback={<div className="p-6 text-center text-slate-500">Loading stock & supply…</div>}>
                  <InventorySupplyChainDashboard embedded />
                </Suspense>
              )}
            </Tab>
            <Tab key="staff" title="👥 Staff Management">
              {selectedTab === 'staff' && (
                <div className={deskBookTabPanelClassName}>
                  <DepartmentStaffTab
                    departmentLabel="Inventory & Stores"
                    overtimePermissionId="inventory.log-overtime"
                    departmentNameHints={['stores', 'inventory', 'warehouse']}
                  />
                </div>
              )}
            </Tab>
            <Tab key="reports" title="📈 Reports & Analysis">
              {selectedTab === 'reports' && (
                <div className={deskBookTabPanelClassName}>
                  <InventoryReportsAnalysis embedded />
                </div>
              )}
            </Tab>
          </Tabs>
        </CardBody>
      </Card>

      {(!isHidden('recentActivities') || !isHidden('notices')) && (
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
          {!isHidden('recentActivities') && (
            <Card className="border-0 shadow-lg">
              <CardHeader className="pb-3 flex items-center justify-between">
                <h3 className="text-xl font-semibold text-ghana-black">Recent Activities</h3>
                <HideCardButton onHide={() => hide('recentActivities')} label="Recent Activities" />
              </CardHeader>
              <CardBody>
                <RecentActivities area="inventory" />
              </CardBody>
            </Card>
          )}
          {!isHidden('notices') && (
            <Card className="border-0 shadow-lg">
              <CardHeader className="pb-3 flex items-center justify-between">
                <h3 className="text-xl font-semibold text-ghana-black">Inventory Notices</h3>
                <HideCardButton onHide={() => hide('notices')} label="Inventory Notices" />
              </CardHeader>
              <CardBody>
                <DeptNotices dept="inventory" title="" defaultTab="alerts" />
              </CardBody>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
