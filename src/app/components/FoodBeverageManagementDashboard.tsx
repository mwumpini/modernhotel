'use client';

import React, { useState, useEffect } from 'react';
import { 
  Card, CardBody, CardHeader, Button, Badge, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, 
  Input, Select, SelectItem, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Chip, Textarea,
  Tabs, Tab, Divider, Progress, Avatar, useDisclosure, Tooltip, Switch, Alert
} from '@heroui/react';
import { useSettingsStore } from '../lib/settings/store';
import DepartmentActivityLog from './DepartmentActivityLog';
import POSActivityTable from './POSActivityTable';
import { trackEvent } from '../lib/analytics/trackEvent';
import FBPOS from './FBPOS';

interface MenuItem {
  id: string;
  name: string;
  category: string;
  price: number;
  cost: number;
  isAvailable: boolean;
  description: string;
  allergens: string[];
  preparationTime: number;
  image?: string;
}

interface Order {
  id: string;
  tableNumber: string;
  items: OrderItem[];
  status: 'pending' | 'preparing' | 'ready' | 'served' | 'cancelled';
  total: number;
  createdAt: string;
  servedAt?: string;
  notes?: string;
  server: string;
}

interface OrderItem {
  id: string;
  menuItemId: string;
  name: string;
  quantity: number;
  price: number;
  total: number;
  notes?: string;
  status: 'pending' | 'preparing' | 'ready' | 'served';
}

interface Table {
  id: string;
  number: string;
  capacity: number;
  status: 'available' | 'occupied' | 'reserved' | 'cleaning';
  currentOrder?: string;
  server?: string;
}

export default function FoodBeverageManagementDashboard() {
  const [selectedTab, setSelectedTab] = useState('overview');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [isMenuItemModalOpen, setIsMenuItemModalOpen] = useState(false);
  const [isTableModalOpen, setIsTableModalOpen] = useState(false);
  const [showPOS, setShowPOS] = useState(false);
  
  const settings = useSettingsStore();
  const [tick, setTick] = useState(0);

  // Sample data - in real app, this would come from stores
  const menuItems: MenuItem[] = [
    {
      id: '1',
      name: 'Jollof Rice',
      category: 'Main Course',
      price: 45.00,
      cost: 15.00,
      isAvailable: true,
      description: 'Traditional Ghanaian Jollof rice with chicken',
      allergens: ['Gluten'],
      preparationTime: 20
    },
    {
      id: '2',
      name: 'Banku & Tilapia',
      category: 'Main Course',
      price: 55.00,
      cost: 20.00,
      isAvailable: true,
      description: 'Fermented corn and cassava dough with grilled tilapia',
      allergens: ['Fish'],
      preparationTime: 25
    },
    {
      id: '3',
      name: 'Fufu & Light Soup',
      category: 'Main Course',
      price: 40.00,
      cost: 12.00,
      isAvailable: true,
      description: 'Pounded cassava and plantain with light soup',
      allergens: [],
      preparationTime: 15
    },
    {
      id: '4',
      name: 'Kelewele',
      category: 'Appetizer',
      price: 15.00,
      cost: 5.00,
      isAvailable: true,
      description: 'Spiced fried plantains',
      allergens: [],
      preparationTime: 10
    },
    {
      id: '5',
      name: 'Bissap Juice',
      category: 'Beverage',
      price: 12.00,
      cost: 3.00,
      isAvailable: true,
      description: 'Refreshing hibiscus juice',
      allergens: [],
      preparationTime: 5
    }
  ];

  const orders: Order[] = [
    {
      id: '1',
      tableNumber: 'T1',
      items: [
        { id: '1', menuItemId: '1', name: 'Jollof Rice', quantity: 2, price: 45.00, total: 90.00, status: 'ready' },
        { id: '2', menuItemId: '5', name: 'Bissap Juice', quantity: 2, price: 12.00, total: 24.00, status: 'ready' }
      ],
      status: 'ready',
      total: 114.00,
      createdAt: '2024-01-16T12:00:00Z',
      server: 'Ama Serwaa'
    },
    {
      id: '2',
      tableNumber: 'T3',
      items: [
        { id: '3', menuItemId: '2', name: 'Banku & Tilapia', quantity: 1, price: 55.00, total: 55.00, status: 'preparing' },
        { id: '4', menuItemId: '4', name: 'Kelewele', quantity: 1, price: 15.00, total: 15.00, status: 'ready' }
      ],
      status: 'preparing',
      total: 70.00,
      createdAt: '2024-01-16T12:15:00Z',
      server: 'Kofi Mensah'
    }
  ];

  const tables: Table[] = [
    { id: '1', number: 'T1', capacity: 4, status: 'occupied', currentOrder: '1', server: 'Ama Serwaa' },
    { id: '2', number: 'T2', capacity: 6, status: 'available' },
    { id: '3', number: 'T3', capacity: 4, status: 'occupied', currentOrder: '2', server: 'Kofi Mensah' },
    { id: '4', number: 'T4', capacity: 2, status: 'reserved' },
    { id: '5', number: 'T5', capacity: 8, status: 'available' }
  ];

  // Calculate metrics
  const totalOrders = orders.length;
  const pendingOrders = orders.filter(o => o.status === 'pending' || o.status === 'preparing').length;
  const readyOrders = orders.filter(o => o.status === 'ready').length;
  const totalRevenue = orders.reduce((sum, o) => sum + o.total, 0);
  const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  if (showPOS) {
    return <FBPOS onClose={() => setShowPOS(false)} />;
  }

  const handleOrderStatusUpdate = (orderId: string, newStatus: Order['status']) => {
    trackEvent('FB.OrderStatusChanged', { orderId, newStatus });
    // In real app, update the order status in the store
  };

  const renderOverview = () => (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="border-0 shadow-lg">
          <CardBody className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Orders</p>
                <p className="text-2xl font-bold text-ghana-black">{totalOrders}</p>
              </div>
              <div className="text-3xl">📋</div>
            </div>
          </CardBody>
        </Card>
        
        <Card className="border-0 shadow-lg">
          <CardBody className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Pending Orders</p>
                <p className="text-2xl font-bold text-ghana-black">{pendingOrders}</p>
              </div>
              <div className="text-3xl">⏳</div>
            </div>
          </CardBody>
        </Card>
        
        <Card className="border-0 shadow-lg">
          <CardBody className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Ready to Serve</p>
                <p className="text-2xl font-bold text-ghana-black">{readyOrders}</p>
              </div>
              <div className="text-3xl">✅</div>
            </div>
          </CardBody>
        </Card>
        
        <Card className="border-0 shadow-lg">
          <CardBody className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Revenue</p>
                <p className="text-2xl font-bold text-ghana-black">₵{totalRevenue.toFixed(2)}</p>
              </div>
              <div className="text-3xl">💰</div>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-3">
          <h3 className="text-xl font-semibold text-ghana-black">🚀 Quick Actions</h3>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
              className="bg-ghana-green text-white h-20 flex flex-col items-center justify-center space-y-2"
              size="lg"
              onClick={() => setIsOrderModalOpen(true)}
            >
              <span className="text-2xl">📝</span>
              <span className="text-sm font-medium">New Order</span>
            </Button>
            <Button
              variant="flat"
              className="bg-ghana-gold text-white h-20 flex flex-col items-center justify-center space-y-2"
              size="lg"
              onClick={() => setIsMenuItemModalOpen(true)}
            >
              <span className="text-2xl">🍽️</span>
              <span className="text-sm font-medium">Add Menu Item</span>
            </Button>
            <Button
              variant="flat"
              className="bg-blue-500 text-white h-20 flex flex-col items-center justify-center space-y-2"
              size="lg"
              onClick={() => setIsTableModalOpen(true)}
            >
              <span className="text-2xl">🪑</span>
              <span className="text-sm font-medium">Manage Tables</span>
            </Button>
            <Button
              variant="flat"
              className="bg-purple-500 text-white h-20 flex flex-col items-center justify-center space-y-2"
              size="lg"
            >
              <span className="text-2xl">📊</span>
              <span className="text-sm font-medium">Reports</span>
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Recent Orders */}
      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-3">
          <h3 className="text-xl font-semibold text-ghana-black">📋 Recent Orders</h3>
        </CardHeader>
        <CardBody>
          <div className="space-y-4">
            {orders.slice(0, 5).map((order) => (
              <div key={order.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className={`h-3 w-3 rounded-full ${
                    order.status === 'ready' ? 'bg-green-500' :
                    order.status === 'preparing' ? 'bg-blue-500' :
                    order.status === 'pending' ? 'bg-yellow-500' :
                    'bg-gray-500'
                  }`}></div>
                  <span className="text-sm text-gray-800">
                    Table {order.tableNumber} - {order.status} 
                    ({order.items.length} items) - ₵{order.total.toFixed(2)}
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-gray-500">
                    {new Date(order.createdAt).toLocaleTimeString()}
                  </span>
                  <Button
                    size="sm"
                    variant="flat"
                    color="primary"
                    onClick={() => {
                      setSelectedOrder(order);
                      setIsOrderModalOpen(true);
                    }}
                  >
                    View
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>
    </div>
  );

  const renderOrders = () => (
    <div className="space-y-6">
      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold text-ghana-black">📋 Order Management</h3>
            <Button
              color="primary"
              className="bg-ghana-green text-white"
              variant="flat"
              onClick={() => setIsOrderModalOpen(true)}
            >
              ➕ New Order
            </Button>
          </div>
        </CardHeader>
        <CardBody>
          <Table aria-label="Orders table">
            <TableHeader>
              <TableColumn>Table</TableColumn>
              <TableColumn>Items</TableColumn>
              <TableColumn>Total</TableColumn>
              <TableColumn>Status</TableColumn>
              <TableColumn>Server</TableColumn>
              <TableColumn>Time</TableColumn>
              <TableColumn>Actions</TableColumn>
            </TableHeader>
            <TableBody>
              {orders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="font-semibold">Table {order.tableNumber}</TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      {order.items.map(item => (
                        <div key={item.id} className="text-sm">
                          {item.quantity}x {item.name}
                          <Badge 
                            size="sm" 
                            color={
                              item.status === 'ready' ? 'success' :
                              item.status === 'preparing' ? 'primary' :
                              'warning'
                            }
                            className="ml-2"
                          >
                            {item.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="font-semibold">₵{order.total.toFixed(2)}</TableCell>
                  <TableCell>
                    <Badge 
                      color={
                        order.status === 'ready' ? 'success' :
                        order.status === 'preparing' ? 'primary' :
                        order.status === 'pending' ? 'warning' :
                        'default'
                      } 
                      size="sm"
                    >
                      {order.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{order.server}</TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {new Date(order.createdAt).toLocaleTimeString()}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      {order.status === 'pending' && (
                        <Button size="sm" variant="flat" color="primary" onClick={() => handleOrderStatusUpdate(order.id, 'preparing')}>
                          Start Preparing
                        </Button>
                      )}
                      {order.status === 'preparing' && (
                        <Button size="sm" variant="flat" color="success" onClick={() => handleOrderStatusUpdate(order.id, 'ready')}>
                          Mark Ready
                        </Button>
                      )}
                      {order.status === 'ready' && (
                        <Button size="sm" variant="flat" color="success" onClick={() => handleOrderStatusUpdate(order.id, 'served')}>
                          Mark Served
                        </Button>
                      )}
                      <Button size="sm" variant="flat" color="secondary" onClick={() => {
                        setSelectedOrder(order);
                        setIsOrderModalOpen(true);
                      }}>
                        View
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardBody>
      </Card>
    </div>
  );

  const renderMenu = () => (
    <div className="space-y-6">
      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold text-ghana-black">🍽️ Menu Management</h3>
            <Button
              color="primary"
              className="bg-ghana-green text-white"
              variant="flat"
              onClick={() => setIsMenuItemModalOpen(true)}
            >
              ➕ Add Menu Item
            </Button>
          </div>
        </CardHeader>
        <CardBody>
          <Table aria-label="Menu items table">
            <TableHeader>
              <TableColumn>Name</TableColumn>
              <TableColumn>Category</TableColumn>
              <TableColumn>Price</TableColumn>
              <TableColumn>Cost</TableColumn>
              <TableColumn>Margin</TableColumn>
              <TableColumn>Status</TableColumn>
              <TableColumn>Actions</TableColumn>
            </TableHeader>
            <TableBody>
              {menuItems.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <div>
                      <div className="font-semibold">{item.name}</div>
                      <div className="text-sm text-gray-500">{item.description}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Chip color="primary" size="sm" variant="flat">
                      {item.category}
                    </Chip>
                  </TableCell>
                  <TableCell className="font-semibold">₵{item.price.toFixed(2)}</TableCell>
                  <TableCell>₵{item.cost.toFixed(2)}</TableCell>
                  <TableCell>
                    <Badge color="success" size="sm">
                      {((item.price - item.cost) / item.price * 100).toFixed(0)}%
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Switch
                      isSelected={item.isAvailable}
                      onValueChange={() => {
                        trackEvent('FB.MenuItemStatusChanged', { itemId: item.id, available: !item.isAvailable });
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button size="sm" variant="flat" color="primary">
                        Edit
                      </Button>
                      <Button size="sm" variant="flat" color="danger">
                        Remove
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardBody>
      </Card>
    </div>
  );

  const renderTables = () => (
    <div className="space-y-6">
      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold text-ghana-black">🪑 Table Management</h3>
            <Button
              color="primary"
              className="bg-ghana-green text-white"
              variant="flat"
              onClick={() => setIsTableModalOpen(true)}
            >
              ➕ Add Table
            </Button>
          </div>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {tables.map((table) => (
              <div
                key={table.id}
                className={`p-4 rounded-lg border-2 cursor-pointer transition-all hover:shadow-md ${
                  table.status === 'available' ? 'bg-green-50 border-green-200' :
                  table.status === 'occupied' ? 'bg-blue-50 border-blue-200' :
                  table.status === 'reserved' ? 'bg-yellow-50 border-yellow-200' :
                  'bg-gray-50 border-gray-200'
                }`}
                onClick={() => {
                  // Handle table selection
                }}
              >
                <div className="text-center">
                  <div className="font-bold text-ghana-black">Table {table.number}</div>
                  <div className="text-xs text-gray-600">{table.capacity} seats</div>
                  <div className="mt-2">
                    <Badge 
                      color={
                        table.status === 'available' ? 'success' :
                        table.status === 'occupied' ? 'primary' :
                        table.status === 'reserved' ? 'warning' :
                        'default'
                      } 
                      size="sm"
                    >
                      {table.status}
                    </Badge>
                  </div>
                  {table.server && (
                    <div className="text-xs text-gray-500 mt-1">
                      Server: {table.server}
                    </div>
                  )}
                  {table.currentOrder && (
                    <div className="text-xs text-blue-600 mt-1">
                      Order #{table.currentOrder}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>
    </div>
  );

  // POS terminal is exclusively handled via FBPOS and the Quick Action in overview

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-ghana-black">🍽️ Food & Beverage Management</h1>
          <p className="text-gray-600">Complete F&B operations with integrated POS terminal, kitchen, and menu management</p>
        </div>
        <div className="flex items-center space-x-2">
          <Badge color="success">System Online</Badge>
          <Badge color="primary">SaaS Ready</Badge>
        </div>
      </div>

      <Tabs 
        selectedKey={selectedTab} 
        onSelectionChange={(key) => setSelectedTab(key as string)}
        className="w-full"
      >
        <Tab key="overview" title="Overview" />
        <Tab key="pos" title="💳 POS Terminal" />
        <Tab key="pos-activity" title="POS Activity Table" />
        <Tab key="orders" title="Orders" />
        <Tab key="menu" title="Menu" />
        <Tab key="tables" title="Tables" />
      </Tabs>

      <div className="mt-6">
        {selectedTab === 'overview' && renderOverview()}
        {selectedTab === 'pos' && (
          <FBPOS onClose={() => setSelectedTab('overview')} />
        )}
        {selectedTab === 'pos-activity' && <POSActivityTable />}
        {selectedTab === 'orders' && renderOrders()}
        {selectedTab === 'menu' && renderMenu()}
        {selectedTab === 'tables' && renderTables()}
      </div>

      {/* Order Modal */}
      <Modal isOpen={isOrderModalOpen} onClose={() => setIsOrderModalOpen(false)} size="4xl">
        <ModalContent>
          <ModalHeader>
            {selectedOrder ? 'Edit Order' : 'New Order'}
          </ModalHeader>
          <ModalBody>
            <div className="text-center py-8 text-gray-500">
              <p>Order form will be implemented here</p>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button color="danger" variant="light" onPress={() => setIsOrderModalOpen(false)}>
              Cancel
            </Button>
            <Button color="primary" onPress={() => setIsOrderModalOpen(false)}>
              {selectedOrder ? 'Update' : 'Create'}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Menu Item Modal */}
      <Modal isOpen={isMenuItemModalOpen} onClose={() => setIsMenuItemModalOpen(false)} size="2xl">
        <ModalContent>
          <ModalHeader>Add Menu Item</ModalHeader>
          <ModalBody>
            <div className="text-center py-8 text-gray-500">
              <p>Menu item form will be implemented here</p>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button color="danger" variant="light" onPress={() => setIsMenuItemModalOpen(false)}>
              Cancel
            </Button>
            <Button color="primary" onPress={() => setIsMenuItemModalOpen(false)}>
              Add Item
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Table Modal */}
      <Modal isOpen={isTableModalOpen} onClose={() => setIsTableModalOpen(false)} size="2xl">
        <ModalContent>
          <ModalHeader>Add Table</ModalHeader>
          <ModalBody>
            <div className="text-center py-8 text-gray-500">
              <p>Table form will be implemented here</p>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button color="danger" variant="light" onPress={() => setIsTableModalOpen(false)}>
              Cancel
            </Button>
            <Button color="primary" onPress={() => setIsTableModalOpen(false)}>
              Add Table
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
