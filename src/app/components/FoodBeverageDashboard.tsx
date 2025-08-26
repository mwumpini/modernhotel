'use client';

import React, { useState } from 'react';
import { 
  Card, 
  CardBody, 
  CardHeader, 
  Button, 
  Badge, 
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Input,
  Select,
  SelectItem,
  Chip,
  Progress,
  Avatar,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure
} from "@heroui/react";
import OfflineIndicator from './OfflineIndicator';
import { ordersStore } from '../lib/fb/ordersStore';
import FBPOS from './FBPOS';

interface KitchenOrder {
  id: string;
  table: string;
  items: string;
  status: 'urgent' | 'preparing' | 'ready';
  time: string;
  priority: 'high' | 'medium' | 'low';
}

interface BarOrder {
  id: string;
  table: string;
  items: string;
  status: 'mixing' | 'preparing' | 'ready';
  time: string;
  type: 'alcoholic' | 'non-alcoholic';
}

interface SmartAlert {
  title: string;
  description: string;
  status: 'critical' | 'optimize' | 'success';
  priority: 'high' | 'medium' | 'low';
}

interface StaffPerformance {
  team: string;
  details: string;
  efficiency: 'excellent' | 'good' | 'optimal';
  status: string;
  efficiencyMetric: string;
}

export default function FoodBeverageDashboard() {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [showPOS, setShowPOS] = useState(false);
  const [activeOrdersCount, setActiveOrdersCount] = useState(0);
  const [kitchenCount, setKitchenCount] = useState(0);
  const [barCount, setBarCount] = useState(0);

  React.useEffect(() => {
    const recompute = () => {
      const all = ordersStore.all();
      setActiveOrdersCount(all.filter(o => o.status !== 'paid').length);
      setKitchenCount(all.filter(o => o.items.some(i => i.route === 'kitchen') && o.status !== 'paid').length);
      setBarCount(all.filter(o => o.items.some(i => i.route === 'bar') && o.status !== 'paid').length);
    };
    recompute();
    const unsub = ordersStore.subscribe(recompute);
    return () => unsub();
  }, []);

  const kitchenOrders: KitchenOrder[] = [
    {
      id: '1234',
      table: '7',
      items: 'Jollof Rice, Grilled Chicken',
      status: 'urgent',
      time: '25 min',
      priority: 'high'
    },
    {
      id: '1235',
      table: '12',
      items: 'Banku, Tilapia, Pepper Sauce',
      status: 'preparing',
      time: '12 min',
      priority: 'medium'
    },
    {
      id: '1236',
      table: '3',
      items: 'Waakye, Beef Stew',
      status: 'ready',
      time: 'Just now',
      priority: 'low'
    }
  ];

  const barOrders: BarOrder[] = [
    {
      id: 'B001',
      table: '15',
      items: '2x Club Beer, 1x Cocktail',
      status: 'mixing',
      time: '3 min',
      type: 'alcoholic'
    },
    {
      id: 'B002',
      table: '8',
      items: 'Wine Selection, Whiskey',
      status: 'preparing',
      time: '5 min',
      type: 'alcoholic'
    },
    {
      id: 'B003',
      table: '22',
      items: 'Fresh Juice, Soft Drinks',
      status: 'ready',
      time: 'Just now',
      type: 'non-alcoholic'
    }
  ];

  const smartAlerts: SmartAlert[] = [
    {
      title: 'Chicken Breast - Critical Stock',
      description: 'Only 2kg remaining. Auto-reorder triggered.',
      status: 'critical',
      priority: 'high'
    },
    {
      title: 'Peak Hour Efficiency',
      description: 'Kitchen prep time 20% above target during rush.',
      status: 'optimize',
      priority: 'medium'
    },
    {
      title: 'Revenue Milestone',
      description: 'Daily target achieved 2 hours early!',
      status: 'success',
      priority: 'low'
    }
  ];

  const staffPerformance: StaffPerformance[] = [
    {
      team: 'Kitchen Team',
      details: '4 active, avg prep time: 15 min',
      efficiency: 'excellent',
      status: 'Excellent',
      efficiencyMetric: '+15% efficiency'
    },
    {
      team: 'Service Team',
      details: '6 active, avg table time: 45 min',
      efficiency: 'good',
      status: 'Good',
      efficiencyMetric: 'On target'
    },
    {
      team: 'Bar Team',
      details: '2 active, avg drink time: 4 min',
      efficiency: 'optimal',
      status: 'Optimal',
      efficiencyMetric: 'Peak performance'
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'urgent': return 'danger';
      case 'preparing': return 'warning';
      case 'ready': return 'success';
      case 'mixing': return 'secondary';
      case 'critical': return 'danger';
      case 'optimize': return 'warning';
      case 'success': return 'success';
      default: return 'default';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'urgent': return 'Urgent';
      case 'preparing': return 'Preparing';
      case 'ready': return 'Ready';
      case 'mixing': return 'Mixing';
      case 'critical': return 'Critical';
      case 'optimize': return 'Optimize';
      case 'success': return 'Success';
      default: return status;
    }
  };

  const getEfficiencyColor = (efficiency: string) => {
    switch (efficiency) {
      case 'excellent': return 'success';
      case 'good': return 'primary';
      case 'optimal': return 'secondary';
      default: return 'default';
    }
  };

  if (showPOS) {
    return <FBPOS onClose={() => setShowPOS(false)} />;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-ghana-black">🍽️ Food & Beverage Operations</h1>
              <p className="text-gray-600 mt-2">Real-time restaurant and bar management dashboard</p>
            </div>
            
            {/* System Status Indicators */}
            <div className="flex items-center space-x-4">
              <OfflineIndicator />
              <div className="flex items-center space-x-2">
                <div className="h-3 w-3 bg-green-500 rounded-full"></div>
                <span className="text-sm font-medium text-green-600">Restaurant Open</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="h-3 w-3 bg-blue-500 rounded-full"></div>
                <span className="text-sm font-medium text-blue-600">Bar Open</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="h-3 w-3 bg-purple-500 rounded-full">⭐</div>
                <span className="text-sm font-medium text-purple-600">Peak Hours</span>
              </div>
            </div>
          </div>
        </div>

        {/* Key Performance Indicators */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
            <CardBody className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Today's Revenue</p>
                  <p className="text-2xl font-bold text-ghana-black">GHC2,450</p>
                  <p className="text-sm text-green-600">+12% vs yesterday</p>
                </div>
                <div className="h-12 w-12 bg-green-100 rounded-full flex items-center justify-center">
                  <span className="text-2xl text-green-600">💰</span>
                </div>
              </div>
            </CardBody>
          </Card>
          
          <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
            <CardBody className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Active Orders</p>
                  <p className="text-2xl font-bold text-ghana-black">{activeOrdersCount}</p>
                  <p className="text-sm text-blue-600">Kitchen: {kitchenCount}, Bar: {barCount}</p>
                </div>
                <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-2xl text-blue-600">📋</span>
                </div>
              </div>
            </CardBody>
          </Card>
          
          <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
            <CardBody className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Tables Occupied</p>
                  <p className="text-2xl font-bold text-ghana-black">24/35</p>
                  <p className="text-sm text-orange-600">69% occupancy</p>
                </div>
                <div className="h-12 w-12 bg-orange-100 rounded-full flex items-center justify-center">
                  <span className="text-2xl text-orange-600">🪑</span>
                </div>
              </div>
            </CardBody>
          </Card>
          
          <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
            <CardBody className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Avg Order Time</p>
                  <p className="text-2xl font-bold text-ghana-black">18 min</p>
                  <p className="text-sm text-purple-600">-3 min from target</p>
                </div>
                <div className="h-12 w-12 bg-purple-100 rounded-full flex items-center justify-center">
                  <span className="text-2xl text-purple-600">⏱️</span>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>

        {/* Quick Actions and F&B Management Modules */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          {/* Quick Actions */}
          <div className="lg:col-span-1">
            <Card className="border-0 shadow-lg">
              <CardHeader className="pb-3">
                <h3 className="text-lg font-semibold text-ghana-black">🚀 Quick Actions</h3>
                <p className="text-sm text-gray-600">One-click operations</p>
              </CardHeader>
              <CardBody className="space-y-3">
                <Button
                  variant="flat"
                  className="w-full justify-start bg-ghana-green/10 text-ghana-green border border-ghana-green/20"
                  size="lg"
                  onClick={() => setShowPOS(true)}
                >
                  <span className="mr-3">🛒</span>
                  Open POS Terminal
                </Button>
                <Button
                  variant="flat"
                  className="w-full justify-start bg-orange-500/10 text-orange-600 border border-orange-500/20"
                  size="lg"
                >
                  <span className="mr-3">👨‍🍳</span>
                  Kitchen Display
                </Button>
                <Button
                  variant="flat"
                  className="w-full justify-start bg-purple-600/10 text-purple-600 border border-purple-600/20"
                  size="lg"
                >
                  <span className="mr-3">🍷</span>
                  Bar Management
                </Button>
                <Button
                  variant="flat"
                  className="w-full justify-start bg-yellow-500/10 text-yellow-600 border border-yellow-500/20"
                  size="lg"
                >
                  <span className="mr-3">📦</span>
                  Check Inventory
                </Button>
              </CardBody>
            </Card>
          </div>

          {/* F&B Management Modules */}
          <div className="lg:col-span-2">
            <Card className="border-0 shadow-lg">
              <CardHeader className="pb-3">
                <h3 className="text-lg font-semibold text-ghana-black">🏗️ F&B Management Modules</h3>
                <p className="text-sm text-gray-600">Access all restaurant and bar management features</p>
              </CardHeader>
              <CardBody>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="p-4 bg-green-50 rounded-lg border border-green-200 text-center hover:bg-green-100 transition-colors cursor-pointer">
                    <div className="text-3xl mb-2">🛒</div>
                    <h4 className="font-semibold text-ghana-black">Restaurant POS</h4>
                    <p className="text-sm text-gray-600">Order Management</p>
                  </div>
                  
                  <div className="p-4 bg-orange-50 rounded-lg border border-orange-200 text-center hover:bg-orange-100 transition-colors cursor-pointer">
                    <div className="text-3xl mb-2">👨‍🍳</div>
                    <h4 className="font-semibold text-ghana-black">Kitchen Display</h4>
                    <p className="text-sm text-gray-600">Order Preparation</p>
                  </div>
                  
                  <div className="p-4 bg-purple-50 rounded-lg border border-purple-200 text-center hover:bg-purple-100 transition-colors cursor-pointer">
                    <div className="text-3xl mb-2">🍷</div>
                    <h4 className="font-semibold text-ghana-black">Bar Management</h4>
                    <p className="text-sm text-gray-600">Drinks & Inventory</p>
                  </div>
                  
                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-200 text-center hover:bg-blue-100 transition-colors cursor-pointer">
                    <div className="text-3xl mb-2">🍽️</div>
                    <h4 className="font-semibold text-ghana-black">Menu & Recipes</h4>
                    <p className="text-sm text-gray-600">Menu Engineering</p>
                  </div>
                  
                  <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200 text-center hover:bg-yellow-100 transition-colors cursor-pointer">
                    <div className="text-3xl mb-2">📦</div>
                    <h4 className="font-semibold text-ghana-black">Inventory</h4>
                    <p className="text-sm text-gray-600">Stock Management</p>
                  </div>
                  
                  <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 text-center hover:bg-gray-100 transition-colors cursor-pointer">
                    <div className="text-3xl mb-2">📊</div>
                    <h4 className="font-semibold text-ghana-black">Analytics</h4>
                    <p className="text-sm text-gray-600">Reports & Insights</p>
                  </div>
                </div>
              </CardBody>
            </Card>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          {/* Kitchen Orders */}
          <Card className="border-0 shadow-lg">
            <CardHeader className="pb-3">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-semibold text-ghana-black">👨‍🍳 Kitchen Orders</h3>
                  <p className="text-sm text-gray-600">Live order preparation status</p>
                </div>
                <Badge color="primary" variant="flat">12 Active</Badge>
              </div>
            </CardHeader>
            <CardBody>
              <div className="space-y-4">
                {kitchenOrders.map((order) => (
                  <div key={order.id} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-3">
                        <span className="font-mono text-sm text-gray-600">#{order.id}</span>
                        <span className="font-semibold text-ghana-black">Table {order.table}</span>
                      </div>
                      <Badge 
                        color={getStatusColor(order.status)} 
                        variant="flat"
                        size="sm"
                      >
                        {getStatusText(order.status)}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-700 mb-2">{order.items}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">{order.time}</span>
                      <Chip 
                        variant="flat" 
                        color={order.priority === 'high' ? 'danger' : order.priority === 'medium' ? 'warning' : 'success'} 
                        size="sm"
                      >
                        {order.priority} priority
                      </Chip>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4">
                <Button 
                  color="primary" 
                  className="w-full bg-orange-500 text-white"
                  variant="flat"
                >
                  👁️ View Kitchen Display
                </Button>
              </div>
            </CardBody>
          </Card>

          {/* Bar Orders */}
          <Card className="border-0 shadow-lg">
            <CardHeader className="pb-3">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-semibold text-ghana-black">🍷 Bar Orders</h3>
                  <p className="text-sm text-gray-600">Live drink preparation status</p>
                </div>
                <Badge color="secondary" variant="flat">5 Active</Badge>
              </div>
            </CardHeader>
            <CardBody>
              <div className="space-y-4">
                {barOrders.map((order) => (
                  <div key={order.id} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-3">
                        <span className="font-mono text-sm text-gray-600">#{order.id}</span>
                        <span className="font-semibold text-ghana-black">Table {order.table}</span>
                      </div>
                      <Badge 
                        color={getStatusColor(order.status)} 
                        variant="flat"
                        size="sm"
                      >
                        {getStatusText(order.status)}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-700 mb-2">{order.items}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">{order.time}</span>
                      <Chip 
                        variant="flat" 
                        color={order.type === 'alcoholic' ? 'danger' : 'success'} 
                        size="sm"
                      >
                        {order.type}
                      </Chip>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4">
                <Button 
                  color="secondary" 
                  className="w-full bg-purple-600 text-white"
                  variant="flat"
                >
                  🍷 View Bar Management
                </Button>
              </div>
            </CardBody>
          </Card>

          {/* Smart Alerts */}
          <Card className="border-0 shadow-lg">
            <CardHeader className="pb-3">
              <h3 className="text-lg font-semibold text-ghana-black">🤖 Smart Alerts</h3>
              <p className="text-sm text-gray-600">AI-powered operational insights</p>
            </CardHeader>
            <CardBody>
              <div className="space-y-4">
                {smartAlerts.map((alert, index) => (
                  <div key={index} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-ghana-black">{alert.title}</span>
                      <Badge 
                        color={getStatusColor(alert.status)} 
                        variant="flat"
                        size="sm"
                      >
                        {getStatusText(alert.status)}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-700 mb-2">{alert.description}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">Priority: {alert.priority}</span>
                      <Chip 
                        variant="flat" 
                        color={alert.priority === 'high' ? 'danger' : alert.priority === 'medium' ? 'warning' : 'success'} 
                        size="sm"
                      >
                        {alert.priority}
                      </Chip>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4">
                <Button 
                  color="primary" 
                  className="w-full bg-yellow-500 text-white"
                  variant="flat"
                >
                  📦 Manage Inventory
                </Button>
              </div>
            </CardBody>
          </Card>
        </div>

        {/* Staff Performance */}
        <div className="grid grid-cols-1 lg:grid-cols-1 gap-8">
          <Card className="border-0 shadow-lg">
            <CardHeader className="pb-3">
              <h3 className="text-lg font-semibold text-ghana-black">👥 Staff Performance</h3>
              <p className="text-sm text-gray-600">Real-time team efficiency metrics</p>
            </CardHeader>
            <CardBody>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {staffPerformance.map((staff, index) => (
                  <div key={index} className="p-4 bg-gray-50 rounded-lg border border-gray-200 text-center">
                    <div className="mb-3">
                      <h4 className="font-semibold text-ghana-black mb-2">{staff.team}</h4>
                      <p className="text-sm text-gray-700 mb-2">{staff.details}</p>
                    </div>
                    <div className="space-y-2">
                      <Badge 
                        color={getEfficiencyColor(staff.efficiency)} 
                        variant="flat"
                        size="sm"
                      >
                        {staff.status}
                      </Badge>
                      <p className="text-sm text-gray-600">{staff.efficiencyMetric}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-6 text-center">
                <Button 
                  color="primary" 
                  className="bg-blue-600 text-white"
                  variant="flat"
                >
                  👥 Staff Management
                </Button>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
