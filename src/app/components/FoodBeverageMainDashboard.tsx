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
import { ordersStore } from '../lib/fb/ordersStore';
import { trackEvent } from '../lib/analytics/trackEvent';
import { useRouter } from 'next/navigation';
import OfflineIndicator from './OfflineIndicator';
import DeptNotices from './DeptNotices';
import DeptMessenger from './DeptMessenger';
import RecentActivities from './RecentActivities';

// Import specialized F&B components
import FBPOS from './FBPOS';
import FoodBeverageRestaurantBar from './FoodBeverageRestaurantBar';
import FoodBeverageKitchen from './FoodBeverageKitchen';
import FoodBeverageMenuInventory from './FoodBeverageMenuInventory';
import FoodBeverageStaffReports from './FoodBeverageStaffReports';
import FoodBeverageAnalyticsDashboard from './FoodBeverageAnalyticsDashboard';

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

export default function FoodBeverageMainDashboard() {
  const [tick, setTick] = useState(0);
  const [selectedTab, setSelectedTab] = useState('overview');
  const [showPOS, setShowPOS] = useState(false);
  const router = useRouter();
  
  useEffect(() => {
    const unsubscribe = ordersStore.subscribe(() => setTick(t => t + 1));
    return unsubscribe;
  }, []);

  // Get data from stores
  const allOrders = ordersStore.all();
  const activeOrders = allOrders.filter(o => o.status !== 'paid');
  const kitchenOrders = activeOrders.filter(o => o.items.some(i => i.route === 'kitchen'));
  const barOrders = activeOrders.filter(o => o.items.some(i => i.route === 'bar'));
  const completedOrders = allOrders.filter(o => o.status === 'paid');

  // Calculate key metrics
  const totalRevenue = completedOrders.reduce((sum, order) => sum + (order.total || 0), 0);
  const averageOrderValue = completedOrders.length > 0 ? totalRevenue / completedOrders.length : 0;
  const pendingOrders = activeOrders.filter(o => o.status === 'pending').length;
  const preparingOrders = activeOrders.filter(o => o.status === 'preparing').length;

  // Today's operations
  const today = new Date().toISOString().slice(0, 10);
  const todayOrders = completedOrders.filter(o => o.createdAt?.startsWith(today));
  const todayRevenue = todayOrders.reduce((sum, order) => sum + (order.total || 0), 0);

  // Operational items following the uniform pattern
  const operationalItems = [
    {
      category: 'Order Management',
      items: [
        { title: 'POS Terminal', icon: '💳', description: 'Point of sale and order processing', status: 'active', count: activeOrders.length },
        { title: 'Restaurant & Bar', icon: '🍽️', description: 'Table management and reservations', status: 'active', count: 12 },
        { title: 'Kitchen Operations', icon: '👨‍🍳', description: 'Kitchen display and order tracking', status: 'active', count: kitchenOrders.length },
        { title: 'Menu & Inventory', icon: '📋', description: 'Menu management and stock control', status: 'active', count: 45 },
      ]
    },
    {
      category: 'Staff & Performance',
      items: [
        { title: 'Staff Reports', icon: '👥', description: 'Employee performance tracking', status: 'active', count: 8 },
        { title: 'Analytics Dashboard', icon: '📊', description: 'Sales and performance insights', status: 'active', count: 0 },
        { title: 'Shift Management', icon: '⏰', description: 'Staff scheduling and time tracking', status: 'active', count: 3 },
        { title: 'Performance Metrics', icon: '🎯', description: 'KPI tracking and optimization', status: 'active', count: 100 },
      ]
    },
    {
      category: 'Customer Experience',
      items: [
        { title: 'Table Reservations', icon: '🪑', description: 'Reservation management system', status: 'active', count: 5 },
        { title: 'Customer Orders', icon: '📱', description: 'Online and mobile ordering', status: 'active', count: 15 },
        { title: 'Customer Feedback', icon: '⭐', description: 'Reviews and satisfaction tracking', status: 'active', count: 0 },
        { title: 'Loyalty Program', icon: '🎁', description: 'Customer rewards and promotions', status: 'active', count: 0 },
      ]
    },
    {
      category: 'Financial Operations',
      items: [
        { title: 'Sales Tracking', icon: '💰', description: 'Real-time sales monitoring', status: 'active', count: todayOrders.length },
        { title: 'Revenue Analytics', icon: '📈', description: 'Financial performance insights', status: 'active', count: 0 },
        { title: 'Payment Processing', icon: '💳', description: 'Multiple payment methods', status: 'active', count: 4 },
        { title: 'Invoice Management', icon: '🧾', description: 'Billing and receipt generation', status: 'active', count: 0 },
      ]
    }
  ];

  // Quick action handlers
  const handleQuickAction = (action: string) => {
    trackEvent('FB.QuickAction', { action });
    
    switch (action) {
      case 'open-pos':
        setShowPOS(true);
        break;
      case 'new-order':
        setShowPOS(true);
        break;
      case 'table-management':
        setSelectedTab('restaurant');
        break;
      case 'kitchen-display':
        setSelectedTab('kitchen');
        break;
      case 'menu-management':
        setSelectedTab('menu');
        break;
    }
  };

  const quickActions = [
    { 
      title: 'Open POS', 
      icon: '💳', 
      color: 'primary', 
      action: 'open-pos',
      description: 'Access point of sale terminal'
    },
    { 
      title: 'New Order', 
      icon: '📝', 
      color: 'secondary', 
      action: 'new-order',
      description: 'Create new customer order'
    },
    { 
      title: 'Table Management', 
      icon: '🪑', 
      color: 'success', 
      action: 'table-management',
      description: 'Manage table assignments'
    },
    { 
      title: 'Kitchen Display', 
      icon: '👨‍🍳', 
      color: 'warning', 
      action: 'kitchen-display',
      description: 'View kitchen operations'
    },
    { 
      title: 'Menu Management', 
      icon: '📋', 
      color: 'default', 
      action: 'menu-management',
      description: 'Update menu and inventory'
    }
  ];

  const kpis = [
    { 
      label: 'Today\'s Orders', 
      value: todayOrders.length, 
      target: 50, 
      color: 'success',
      icon: '📊'
    },
    { 
      label: 'Active Orders', 
      value: activeOrders.length, 
      target: 20, 
      color: 'primary',
      icon: '🔄'
    },
    { 
      label: 'Today\'s Revenue', 
      value: `₵${todayRevenue.toFixed(2)}`, 
      target: 2500, 
      color: 'secondary',
      icon: '💰'
    },
    { 
      label: 'Avg Order Value', 
      value: `₵${averageOrderValue.toFixed(2)}`, 
      target: 50, 
      color: 'warning',
      icon: '📈'
    }
  ];

  if (showPOS) {
    return <FBPOS onClose={() => setShowPOS(false)} />;
  }

  return (
    <div className="p-6">
      <DeptMessenger from="f&b" mode="drawer" />
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-ghana-black">🍽️ Food & Beverage Operations</h2>
        <OfflineIndicator />
      </div>

      {/* Order Status Overview - Following Uniform Pattern */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold text-ghana-black flex items-center gap-2">
            📊 Order Status Overview ({activeOrders.length} Active Orders)
          </h3>
        </div>
        
        {/* Status Cards - Matching Uniform Design */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          {/* Active Orders */}
          <Card className="border-0 shadow-lg border-l-4 border-l-blue-500">
            <CardBody className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-lg font-semibold text-ghana-black">Active Orders</h4>
                <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
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
              </div>
            </CardBody>
          </Card>

          {/* Kitchen Orders */}
          <Card className="border-0 shadow-lg border-l-4 border-l-orange-500">
            <CardBody className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-lg font-semibold text-ghana-black">Kitchen Orders</h4>
                <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
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
              </div>
            </CardBody>
          </Card>

          {/* Bar Orders */}
          <Card className="border-0 shadow-lg border-l-4 border-l-purple-500">
            <CardBody className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-lg font-semibold text-ghana-black">Bar Orders</h4>
                <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
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
                <span className="text-green-600 font-medium">{todayOrders.length} Orders</span>
                <span className="text-gray-500">Completed today</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-blue-600 font-medium">₵{todayRevenue.toFixed(2)}</span>
                <span className="text-gray-500">Revenue today</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-orange-600 font-medium">{activeOrders.length} Active</span>
                <span className="text-gray-500">In progress</span>
              </div>
            </div>
          </div>
          <Button 
            color="success" 
            variant="solid"
            className="bg-green-600 hover:bg-green-700"
            onClick={() => setShowPOS(true)}
          >
            💳 Open POS Terminal
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
            aria-label="Food & Beverage operations"
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
                              if (item.title.includes('POS Terminal')) {
                                setShowPOS(true);
                              } else if (item.title.includes('Restaurant & Bar')) {
                                setSelectedTab('restaurant');
                              } else if (item.title.includes('Kitchen Operations')) {
                                setSelectedTab('kitchen');
                              } else if (item.title.includes('Menu & Inventory')) {
                                setSelectedTab('menu');
                              } else if (item.title.includes('Staff Reports')) {
                                setSelectedTab('staff');
                              } else if (item.title.includes('Analytics Dashboard')) {
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

            <Tab key="restaurant" title="🍽️ Restaurant & Bar">
              <FoodBeverageRestaurantBar />
            </Tab>

            <Tab key="kitchen" title="👨‍🍳 Kitchen Operations">
              <FoodBeverageKitchen />
            </Tab>

            <Tab key="menu" title="📋 Menu & Inventory">
              <FoodBeverageMenuInventory />
            </Tab>

            <Tab key="staff" title="👥 Staff Reports">
              <FoodBeverageStaffReports />
            </Tab>

            <Tab key="analytics" title="📊 Analytics Dashboard">
              <FoodBeverageAnalyticsDashboard />
            </Tab>
          </Tabs>
        </CardBody>
      </Card>

      {/* Bottom section: directly under Operations Overview */}
      <div className="mt-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="border-0 shadow-lg">
            <CardHeader className="pb-3"><h3 className="text-xl font-semibold text-ghana-black">📋 Recent Activities</h3></CardHeader>
            <CardBody>
              <RecentActivities area="f&b" />
            </CardBody>
          </Card>
          <Card className="border-0 shadow-lg">
            <CardHeader className="pb-3"><h3 className="text-xl font-semibold text-ghana-black">🔔 F&B Notices</h3></CardHeader>
            <CardBody>
              <DeptNotices dept="f&b" title="" defaultTab="alerts" />
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
