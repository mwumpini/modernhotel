'use client';

import React, { useState, useEffect, useRef, Suspense, lazy } from 'react';
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

// Import specialized Stores/Inventory components - lazy load heavy components
const InventorySupplyChainDashboard = lazy(() => import('./InventorySupplyChainDashboard'));
import InventoryAnalyticsDashboard from './InventoryAnalyticsDashboard';
import DeptNotices from './DeptNotices';
import DeptMessenger from './DeptMessenger';
import RecentActivities from './RecentActivities';

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

export default function StoresMainDashboard() {
  const [selectedTab, setSelectedTab] = useState('overview');
  const router = useRouter();
  
  // Sample Stores/Inventory data - in real app, this would come from stores
  const totalItems = 1250;
  const lowStockItems = 45;
  const outOfStockItems = 12;
  const overstockItems = 8;
  
  // Inventory value data
  const totalInventoryValue = 125000;
  const lowStockValue = 8500;
  const outOfStockValue = 3200;
  const overstockValue = 5600;
  
  // Supplier data
  const totalSuppliers = 28;
  const activeSuppliers = 25;
  const pendingSuppliers = 3;
  const supplierRating = 4.2;
  
  // Purchase order data
  const totalPurchaseOrders = 15;
  const pendingOrders = 8;
  const confirmedOrders = 5;
  const deliveredOrders = 2;

  // Today's operations
  const today = new Date().toISOString().slice(0, 10);
  const itemsReceivedToday = 45;
  const itemsIssuedToday = 32;
  const purchaseOrdersCreatedToday = 3;

  // Operational items following the uniform pattern
  const operationalItems = [
    {
      category: 'Inventory Management',
      items: [
        { title: 'Stock Items', icon: '📦', description: 'Complete inventory database', status: 'active', count: totalItems },
        { title: 'Low Stock Alerts', icon: '⚠️', description: 'Items below reorder level', status: 'active', count: lowStockItems },
        { title: 'Out of Stock', icon: '❌', description: 'Items requiring immediate restock', status: 'active', count: outOfStockItems },
        { title: 'Overstock Items', icon: '📈', description: 'Items exceeding optimal levels', status: 'active', count: overstockItems },
      ]
    },
    {
      category: 'Procurement & Suppliers',
      items: [
        { title: 'Supplier Management', icon: '🏢', description: 'Vendor database and ratings', status: 'active', count: totalSuppliers },
        { title: 'Purchase Orders', icon: '📋', description: 'Procurement and ordering', status: 'active', count: totalPurchaseOrders },
        { title: 'Delivery Tracking', icon: '🚚', description: 'Order delivery monitoring', status: 'active', count: deliveredOrders },
        { title: 'Cost Analysis', icon: '💰', description: 'Price and cost optimization', status: 'active', count: 0 },
      ]
    },
    {
      category: 'Stock Operations',
      items: [
        { title: 'Goods Receipt', icon: '📥', description: 'Incoming stock processing', status: 'active', count: itemsReceivedToday },
        { title: 'Goods Issue', icon: '📤', description: 'Stock distribution and usage', status: 'active', count: itemsIssuedToday },
        { title: 'Stock Transfers', icon: '🔄', description: 'Internal stock movements', status: 'active', count: 0 },
        { title: 'Stock Counts', icon: '🔍', description: 'Physical inventory verification', status: 'active', count: 0 },
      ]
    },
    {
      category: 'Compliance & Reporting',
      items: [
        { title: 'Inventory Reports', icon: '📊', description: 'Stock level and value reports', status: 'active', count: 0 },
        { title: 'Ghana Compliance', icon: '🔒', description: 'Import/export regulations', status: 'active', count: 100 },
        { title: 'VAT Management', icon: '🧾', description: 'Tax compliance and reporting', status: 'active', count: 0 },
        { title: 'Analytics Dashboard', icon: '📈', description: 'Performance insights', status: 'active', count: 0 },
      ]
    }
  ];

  // Quick action handlers
  const handleQuickAction = (action: string) => {
    trackEvent('Stores.QuickAction', { action });
    
    switch (action) {
      case 'add-item':
        setSelectedTab('inventory');
        break;
      case 'create-po':
        setSelectedTab('purchase-orders');
        break;
      case 'add-supplier':
        setSelectedTab('suppliers');
        break;
      case 'stock-count':
        setSelectedTab('operations');
        break;
      case 'low-stock-report':
        setSelectedTab('reports');
        break;
    }
  };

  const quickActions = [
    { 
      title: 'Add Item', 
      icon: '➕', 
      color: 'primary', 
      action: 'add-item',
      description: 'Add new inventory item'
    },
    { 
      title: 'Create PO', 
      icon: '📋', 
      color: 'secondary', 
      action: 'create-po',
      description: 'Create purchase order'
    },
    { 
      title: 'Add Supplier', 
      icon: '🏢', 
      color: 'success', 
      action: 'add-supplier',
      description: 'Register new supplier'
    },
    { 
      title: 'Stock Count', 
      icon: '🔍', 
      color: 'warning', 
      action: 'stock-count',
      description: 'Physical inventory count'
    },
    { 
      title: 'Low Stock Report', 
      icon: '⚠️', 
      color: 'danger', 
      action: 'low-stock-report',
      description: 'View reorder alerts'
    }
  ];

  const kpis = [
    { 
      label: 'Total Items', 
      value: totalItems, 
      target: 1500, 
      color: 'success',
      icon: '📦'
    },
    { 
      label: 'Low Stock Items', 
      value: lowStockItems, 
      target: 30, 
      color: 'warning',
      icon: '⚠️'
    },
    { 
      label: 'Inventory Value', 
      value: `₵${(totalInventoryValue / 1000).toFixed(0)}K`, 
      target: 150, 
      color: 'primary',
      icon: '💰'
    },
    { 
      label: 'Supplier Rating', 
      value: `${supplierRating}/5`, 
      target: 4.5, 
      color: 'secondary',
      icon: '⭐'
    }
  ];

  return (
    <div className="p-6">
      <DeptMessenger from="inventory" mode="drawer" />
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-ghana-black">📦 Inventory & Stores</h2>
        <div className="flex items-center gap-2">
          <Badge color="success" variant="flat">Reorder System</Badge>
          <Badge color="primary" variant="flat">Suppliers Active</Badge>
        </div>
      </div>

      {/* Inventory Status Overview - Following Uniform Pattern */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold text-ghana-black flex items-center gap-2">
            📊 Inventory Status Overview ({totalItems} Total Items)
          </h3>
        </div>
        
        {/* Status Cards - Matching Uniform Design */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          {/* Stock Levels */}
          <Card className="border-0 shadow-lg border-l-4 border-l-green-500">
            <CardBody className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-lg font-semibold text-ghana-black">Stock Levels</h4>
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              </div>
              <div className="text-3xl font-bold text-green-600 mb-3">{totalItems - lowStockItems - outOfStockItems}</div>
              <div className="space-y-1 text-sm text-gray-600">
                <div className="flex justify-between">
                  <span>Optimal</span>
                  <span className="font-medium">{totalItems - lowStockItems - outOfStockItems}</span>
                </div>
                <div className="flex justify-between">
                  <span>Low Stock</span>
                  <span className="font-medium">{lowStockItems}</span>
                </div>
                <div className="flex justify-between">
                  <span>Out of Stock</span>
                  <span className="font-medium">{outOfStockItems}</span>
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Inventory Value */}
          <Card className="border-0 shadow-lg border-l-4 border-l-blue-500">
            <CardBody className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-lg font-semibold text-ghana-black">Inventory Value</h4>
                <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
              </div>
              <div className="text-3xl font-bold text-blue-600 mb-3">₵{(totalInventoryValue / 1000).toFixed(0)}K</div>
              <div className="space-y-1 text-sm text-gray-600">
                <div className="flex justify-between">
                  <span>Total Value</span>
                  <span className="font-medium">₵{(totalInventoryValue / 1000).toFixed(0)}K</span>
                </div>
                <div className="flex justify-between">
                  <span>Low Stock Value</span>
                  <span className="font-medium">₵{(lowStockValue / 1000).toFixed(0)}K</span>
                </div>
                <div className="flex justify-between">
                  <span>Out of Stock Value</span>
                  <span className="font-medium">₵{(outOfStockValue / 1000).toFixed(0)}K</span>
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Purchase Orders */}
          <Card className="border-0 shadow-lg border-l-4 border-l-orange-500">
            <CardBody className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-lg font-semibold text-ghana-black">Purchase Orders</h4>
                <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
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
                <span className="text-green-600 font-medium">{itemsReceivedToday} Items</span>
                <span className="text-gray-500">Received today</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-blue-600 font-medium">{itemsIssuedToday} Items</span>
                <span className="text-gray-500">Issued today</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-orange-600 font-medium">{purchaseOrdersCreatedToday} POs</span>
                <span className="text-gray-500">Created today</span>
              </div>
            </div>
          </div>
          <Button 
            color="success" 
            variant="solid"
            className="bg-green-600 hover:bg-green-700"
            onClick={() => setSelectedTab('inventory')}
          >
            📦 Manage Inventory
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
            aria-label="Stores operations"
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
                              if (item.title.includes('Stock Items') || item.title.includes('Low Stock Alerts')) {
                                setSelectedTab('inventory');
                              } else if (item.title.includes('Supplier Management') || item.title.includes('Purchase Orders')) {
                                setSelectedTab('suppliers');
                              } else if (item.title.includes('Goods Receipt') || item.title.includes('Goods Issue')) {
                                setSelectedTab('operations');
                              } else if (item.title.includes('Inventory Reports') || item.title.includes('Analytics Dashboard')) {
                                setSelectedTab('analytics');
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

            <Tab key="inventory" title="📦 Inventory Management">
              <Suspense fallback={<div className="p-6 text-center">Loading Inventory Dashboard...</div>}>
                <InventorySupplyChainDashboard />
              </Suspense>
            </Tab>

            <Tab key="suppliers" title="🏢 Supplier Management">
              <Suspense fallback={<div className="p-6 text-center">Loading Inventory Dashboard...</div>}>
                <InventorySupplyChainDashboard />
              </Suspense>
            </Tab>

            <Tab key="purchase-orders" title="📋 Purchase Orders">
              <Suspense fallback={<div className="p-6 text-center">Loading Inventory Dashboard...</div>}>
                <InventorySupplyChainDashboard />
              </Suspense>
            </Tab>

            <Tab key="operations" title="🔄 Stock Operations">
              <Suspense fallback={<div className="p-6 text-center">Loading Inventory Dashboard...</div>}>
                <InventorySupplyChainDashboard />
              </Suspense>
            </Tab>

            <Tab key="reports" title="📊 Reports & Analytics">
              <Suspense fallback={<div className="p-6 text-center">Loading Inventory Dashboard...</div>}>
                <InventorySupplyChainDashboard />
              </Suspense>
            </Tab>

            <Tab key="analytics" title="📈 Analytics Dashboard">
              <InventoryAnalyticsDashboard />
            </Tab>
          </Tabs>
        </CardBody>
      </Card>

      {/* Recent Activities & Notices - directly under Operations Overview */}
      <div className="mt-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Activities */}
          <Card className="border-0 shadow-lg">
            <CardHeader className="pb-3">
              <h3 className="text-xl font-semibold text-ghana-black">📋 Recent Activities</h3>
            </CardHeader>
            <CardBody>
              <RecentActivities area="inventory" />
            </CardBody>
          </Card>

          {/* Inventory Notices */}
          <Card className="border-0 shadow-lg">
            <CardHeader className="pb-3">
              <h3 className="text-xl font-semibold text-ghana-black">🔔 Inventory Notices</h3>
            </CardHeader>
            <CardBody>
              <DeptNotices dept="inventory" title="" defaultTab="alerts" />
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
