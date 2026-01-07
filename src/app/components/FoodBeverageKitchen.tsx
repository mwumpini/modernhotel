'use client';

import React, { useState } from 'react';
import { Card, CardBody, CardHeader, Button, Input, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, Chip, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Select, SelectItem, Divider, Badge, Progress, Tabs, Tab } from "@heroui/react";
import { ordersStore, FBOrder, OrderItem as FBOrderItem } from '../lib/fb/ordersStore';
import { kitchenOpsStore, KitchenOpRecord } from '../lib/fb/kitchenOpsStore';
import { trackEvent } from '../lib/analytics/trackEvent';
import { logAudit } from '../lib/analytics/auditLogStore';
import { dmStore } from '../lib/communications/dmStore';

interface Order {
  id: string;
  tableNumber: string;
  items: OrderItem[];
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'preparing' | 'ready' | 'served';
  timestamp: Date;
  estimatedTime: number;
  actualTime?: number;
  notes: string;
  server: string;
}

interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  preparationTime: number;
  status: 'pending' | 'preparing' | 'ready' | 'served';
  specialInstructions: string;
  allergens: string[];
}

interface KitchenStation {
  id: string;
  name: string;
  chef: string;
  status: 'available' | 'busy' | 'maintenance';
  currentOrders: string[];
  efficiency: number;
  specializations: string[];
}

interface InventoryItem {
  id: string;
  name: string;
  category: string;
  currentStock: number;
  minimumStock: number;
  unit: string;
  status: 'sufficient' | 'low' | 'out';
  lastUpdated: Date;
}

interface Recipe {
  id: string;
  name: string;
  category: string;
  ingredients: RecipeIngredient[];
  instructions: string[];
  preparationTime: number;
  difficulty: 'easy' | 'medium' | 'hard';
  allergens: string[];
}

type PriorityFilter = 'all' | 'low' | 'medium' | 'high' | 'urgent';

interface RecipeIngredient {
  name: string;
  quantity: number;
  unit: string;
}

export default function FoodBeverageKitchen() {
  const [selectedTab, setSelectedTab] = useState('orders');
  const [isNewOrderModalOpen, setIsNewOrderModalOpen] = useState(false);
  const [isRecipeModalOpen, setIsRecipeModalOpen] = useState(false);
  const [selectedPriority, setSelectedPriority] = useState<PriorityFilter>(() => {
    try {
      return (localStorage.getItem('kitchen.priority.filter') as PriorityFilter) || 'high';
    } catch {
      return 'high';
    }
  });
  const [storeOrders, setStoreOrders] = useState<FBOrder[]>([]);
  const [rejectModal, setRejectModal] = useState<{ open: boolean; orderId: string | null; itemId?: string | null; reason: string }>(
    { open: false, orderId: null, itemId: null, reason: '' }
  );
  const kitchenStaff = [
    { id: 'chef-kwame', name: 'Chef Kwame' },
    { id: 'chef-ama', name: 'Chef Ama' },
    { id: 'sous-efua', name: 'Sous Chef Efua' },
    { id: 'cook-kofi', name: 'Cook Kofi' },
  ];

  React.useEffect(() => {
    const sync = () => setStoreOrders(ordersStore.all());
    sync();
    return ordersStore.subscribe(sync);
  }, []);

  // Sample data
  const orders: Order[] = [
    {
      id: 'ORD001',
      tableNumber: 'T1',
      items: [
        { id: '1', name: 'Jollof Rice', quantity: 2, preparationTime: 15, status: 'preparing', specialInstructions: 'Extra spicy', allergens: ['None'] },
        { id: '2', name: 'Grilled Chicken', quantity: 1, preparationTime: 20, status: 'pending', specialInstructions: 'Well done', allergens: ['None'] }
      ],
      priority: 'high',
      status: 'preparing',
      timestamp: new Date(Date.now() - 10 * 60000),
      estimatedTime: 25,
      notes: 'Customer in a hurry',
      server: 'Kwame'
    },
    {
      id: 'ORD002',
      tableNumber: 'T3',
      items: [
        { id: '3', name: 'Banku & Tilapia', quantity: 1, preparationTime: 25, status: 'ready', specialInstructions: 'Fresh fish', allergens: ['Fish'] },
        { id: '4', name: 'Kelewele', quantity: 1, preparationTime: 8, status: 'ready', specialInstructions: 'Extra crispy', allergens: ['None'] }
      ],
      priority: 'medium',
      status: 'ready',
      timestamp: new Date(Date.now() - 20 * 60000),
      estimatedTime: 25,
      actualTime: 23,
      notes: '',
      server: 'Ama'
    },
    {
      id: 'ORD003',
      tableNumber: 'T5',
      items: [
        { id: '5', name: 'Fufu & Light Soup', quantity: 2, preparationTime: 18, status: 'pending', specialInstructions: '', allergens: ['None'] }
      ],
      priority: 'low',
      status: 'pending',
      timestamp: new Date(Date.now() - 5 * 60000),
      estimatedTime: 18,
      notes: '',
      server: 'Kofi'
    }
  ];

  const kitchenStations: KitchenStation[] = [
    {
      id: '1',
      name: 'Main Grill',
      chef: 'Chef Kwame',
      status: 'busy',
      currentOrders: ['ORD001'],
      efficiency: 85,
      specializations: ['Grilled Meats', 'Fish']
    },
    {
      id: '2',
      name: 'Rice Station',
      chef: 'Chef Ama',
      status: 'available',
      currentOrders: [],
      efficiency: 92,
      specializations: ['Jollof Rice', 'Waakye']
    },
    {
      id: '3',
      name: 'Soup Station',
      chef: 'Chef Kofi',
      status: 'busy',
      currentOrders: ['ORD003'],
      efficiency: 78,
      specializations: ['Light Soup', 'Groundnut Soup']
    },
    {
      id: '4',
      name: 'Appetizer Station',
      chef: 'Chef Efua',
      status: 'available',
      currentOrders: [],
      efficiency: 95,
      specializations: ['Kelewele', 'Bofrot']
    }
  ];

  const inventoryItems: InventoryItem[] = [
    { id: '1', name: 'Rice', category: 'Grains', currentStock: 50, minimumStock: 20, unit: 'kg', status: 'sufficient', lastUpdated: new Date() },
    { id: '2', name: 'Chicken', category: 'Meat', currentStock: 15, minimumStock: 25, unit: 'kg', status: 'low', lastUpdated: new Date() },
    { id: '3', name: 'Tilapia', category: 'Fish', currentStock: 8, minimumStock: 10, unit: 'kg', status: 'low', lastUpdated: new Date() },
    { id: '4', name: 'Plantains', category: 'Vegetables', currentStock: 0, minimumStock: 5, unit: 'kg', status: 'out', lastUpdated: new Date() },
    { id: '5', name: 'Palm Oil', category: 'Oils', currentStock: 12, minimumStock: 8, unit: 'L', status: 'sufficient', lastUpdated: new Date() },
    { id: '6', name: 'Tomatoes', category: 'Vegetables', currentStock: 30, minimumStock: 15, unit: 'kg', status: 'sufficient', lastUpdated: new Date() }
  ];

  const recipes: Recipe[] = [
    {
      id: '1',
      name: 'Jollof Rice',
      category: 'Main Course',
      ingredients: [
        { name: 'Rice', quantity: 2, unit: 'cups' },
        { name: 'Tomatoes', quantity: 6, unit: 'medium' },
        { name: 'Onions', quantity: 2, unit: 'medium' },
        { name: 'Palm Oil', quantity: 3, unit: 'tbsp' },
        { name: 'Chicken', quantity: 500, unit: 'g' }
      ],
      instructions: [
        'Wash and parboil rice',
        'Blend tomatoes and onions',
        'Fry chicken in palm oil',
        'Add blended mixture and cook',
        'Add rice and cook until done'
      ],
      preparationTime: 45,
      difficulty: 'medium',
      allergens: ['None']
    },
    {
      id: '2',
      name: 'Banku & Tilapia',
      category: 'Main Course',
      ingredients: [
        { name: 'Corn Dough', quantity: 2, unit: 'cups' },
        { name: 'Cassava Dough', quantity: 1, unit: 'cup' },
        { name: 'Tilapia', quantity: 1, unit: 'whole' },
        { name: 'Pepper', quantity: 3, unit: 'medium' },
        { name: 'Onions', quantity: 1, unit: 'medium' }
      ],
      instructions: [
        'Mix corn and cassava dough',
        'Cook until smooth consistency',
        'Clean and season fish',
        'Grill fish until done',
        'Serve with pepper sauce'
      ],
      preparationTime: 35,
      difficulty: 'hard',
      allergens: ['Fish', 'Corn']
    }
  ];

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'danger';
      case 'high': return 'warning';
      case 'medium': return 'primary';
      case 'low': return 'success';
      default: return 'default';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'warning';
      case 'preparing': return 'primary';
      case 'ready': return 'success';
      case 'served': return 'secondary';
      default: return 'default';
    }
  };

  const mapStoreStatusToKitchen = (status: FBOrder['status']) => {
    if (status === 'pending') return 'pending';
    if (status === 'sent') return 'preparing';
    if (status === 'served') return 'ready';
    return 'served'; // paid
  };

  const getNextStoreStatus = (status: FBOrder['status']): FBOrder['status'] => {
    if (status === 'pending') return 'sent';
    if (status === 'sent') return 'served';
    if (status === 'served') return 'paid';
    return 'paid';
  };

  const storeFiltered = selectedPriority === 'all' 
    ? storeOrders 
    : storeOrders.filter(o => (o.priority || (o.urgent ? 'urgent' : 'low')) === selectedPriority);

  const getStationStatusColor = (status: string) => {
    switch (status) {
      case 'available': return 'success';
      case 'busy': return 'warning';
      case 'maintenance': return 'danger';
      default: return 'default';
    }
  };

  const getInventoryStatusColor = (status: string) => {
    switch (status) {
      case 'sufficient': return 'success';
      case 'low': return 'warning';
      case 'out': return 'danger';
      default: return 'default';
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return 'success';
      case 'medium': return 'warning';
      case 'hard': return 'danger';
      default: return 'default';
    }
  };

  const filteredOrders = selectedPriority === 'all' 
    ? orders 
    : orders.filter(order => order.priority === selectedPriority);

  const getOrderProgressFromStore = (order: FBOrder) => {
    const totalItems = order.items.length;
    const completedItems = order.items.filter(i => i.status === 'ready' || i.status === 'served').length;
    return totalItems === 0 ? 0 : (completedItems / totalItems) * 100;
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-ghana-black">🍽️ Food & Beverage - Kitchen Operations</h2>
          <p className="text-gray-600">Manage orders, kitchen stations, inventory, and recipes</p>
        </div>
        <div className="flex gap-3">
          <Button 
            color="primary" 
            className="bg-ghana-green text-white"
            onClick={() => setIsNewOrderModalOpen(true)}
          >
            + New Order
          </Button>
          <Button 
            color="secondary" 
            className="bg-ghana-gold text-white"
            onClick={() => setIsRecipeModalOpen(true)}
          >
            + Add Recipe
          </Button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card className="border-0 shadow-lg">
          <CardBody className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Orders</p>
                <p className="text-2xl font-bold text-ghana-black">8</p>
                <p className="text-sm text-blue-600">3 pending</p>
              </div>
              <div className="text-3xl">📋</div>
            </div>
          </CardBody>
        </Card>
        
        <Card className="border-0 shadow-lg">
          <CardBody className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Avg Prep Time</p>
                <p className="text-2xl font-bold text-ghana-black">18min</p>
                <p className="text-sm text-green-600">-2min from avg</p>
              </div>
              <div className="text-3xl">⏱️</div>
            </div>
          </CardBody>
        </Card>
        
        <Card className="border-0 shadow-lg">
          <CardBody className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Kitchen Efficiency</p>
                <p className="text-2xl font-bold text-ghana-black">87%</p>
                <p className="text-sm text-green-600">+5% from yesterday</p>
              </div>
              <div className="text-3xl">🔥</div>
            </div>
          </CardBody>
        </Card>
        
        <Card className="border-0 shadow-lg">
          <CardBody className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Low Stock Items</p>
                <p className="text-2xl font-bold text-ghana-black">3</p>
                <p className="text-sm text-warning">Needs attention</p>
              </div>
              <div className="text-3xl">⚠️</div>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Card className="border-0 shadow-lg">
        <CardBody className="p-0">
          <Tabs 
            selectedKey={selectedTab} 
            onSelectionChange={(key) => setSelectedTab(key as string)}
            className="w-full"
          >
            <Tab key="orders" title="📋 Order Management">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <Select
                    label="Filter by Priority"
                    selectedKeys={new Set([selectedPriority])}
                    onSelectionChange={(keys) => {
                      const next = (Array.from(keys)[0] as PriorityFilter) || 'all';
                      setSelectedPriority(next);
                      try { localStorage.setItem('kitchen.priority.filter', next); } catch {}
                    }}
                    className="w-64"
                  >
                    <SelectItem key="all">All Priorities</SelectItem>
                    <SelectItem key="urgent">Urgent</SelectItem>
                    <SelectItem key="high">High</SelectItem>
                    <SelectItem key="medium">Medium</SelectItem>
                    <SelectItem key="low">Low</SelectItem>
                  </Select>
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {storeFiltered.map((order) => (
                    <Card key={order.id} className="border border-gray-200 hover:border-ghana-green transition-colors">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="text-lg font-semibold text-ghana-black">Order {order.id}</h3>
                            <p className="text-sm text-gray-600">Table {order.table} • Waiter: {order.waiterId}</p>
                          </div>
                          <div className="flex gap-2">
                            <Chip color={getPriorityColor(order.priority || (order.urgent ? 'urgent' : 'low'))} size="sm">
                              {(order.priority || (order.urgent ? 'urgent' : 'low')).toUpperCase()}
                            </Chip>
                            <Chip color={getStatusColor(mapStoreStatusToKitchen(order.status))} size="sm">
                              {mapStoreStatusToKitchen(order.status).charAt(0).toUpperCase() + mapStoreStatusToKitchen(order.status).slice(1)}
                            </Chip>
                          </div>
                        </div>
                      </CardHeader>
                      <CardBody>
                        <div className="space-y-3">
                          {order.items.map((item) => (
                            <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                              <div className="flex-1">
                                <h4 className="font-medium text-ghana-black">{item.name}</h4>
                                <p className="text-sm text-gray-600">Qty: {item.qty} • ⏱️ {item.prepMinutes || 0}min</p>
                                {item.assignedToName && (
                                  <p className="text-xs text-gray-500">Assigned: {item.assignedToName}</p>
                                )}
                                {item.preparedByName && (
                                  <p className="text-xs text-gray-500">Prepared by: {item.preparedByName}</p>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <Chip color={getStatusColor((item.status || 'pending') as any)} size="sm">
                                  {(item.status || 'pending').toString().charAt(0).toUpperCase() + (item.status || 'pending').toString().slice(1)}
                                </Chip>
                                <Select size="sm" selectedKeys={[item.status || 'pending']} onSelectionChange={(k) => {
                                  const next = Array.from(k as Set<string>)[0] as 'pending' | 'preparing' | 'ready' | 'served';
                                  kitchenOpsStore.add({
                                    orderId: order.id,
                                    table: order.table,
                                    waiterId: order.waiterId,
                                    itemId: item.id,
                                    itemName: item.name,
                                    action: 'status',
                                    fromStatus: (item.status || 'pending') as any,
                                    toStatus: next,
                                    priority: (order.priority || (order.urgent ? 'urgent' : 'low')) as any,
                                    prepMinutes: item.prepMinutes,
                                  });
                                  const updatedItems: FBOrderItem[] = order.items.map((it): FBOrderItem =>
                                    it.id === item.id
                                      ? {
                                          ...it,
                                          status: next,
                                          startedAt: next === 'preparing' ? new Date().toISOString() : it.startedAt,
                                          readyAt: next === 'ready' ? new Date().toISOString() : it.readyAt,
                                        }
                                      : it
                                  );
                                  ordersStore.update({ ...order, items: updatedItems });
                                }}>
                                  <SelectItem key="pending">Pending</SelectItem>
                                  <SelectItem key="preparing">Preparing</SelectItem>
                                  <SelectItem key="ready">Ready</SelectItem>
                                  <SelectItem key="served">Served</SelectItem>
                                </Select>
                                <Select size="sm" label="Assign" placeholder="Assign" selectedKeys={[item.assignedToId || '']} onSelectionChange={(k) => {
                                  const staffId = Array.from(k as Set<string>)[0] as string;
                                  const staff = kitchenStaff.find(s => s.id === staffId);
                                  kitchenOpsStore.add({
                                    orderId: order.id,
                                    table: order.table,
                                    waiterId: order.waiterId,
                                    itemId: item.id,
                                    itemName: item.name,
                                    action: 'assigned',
                                    assignedToId: staff?.id,
                                    assignedToName: staff?.name,
                                    priority: (order.priority || (order.urgent ? 'urgent' : 'low')) as any,
                                    prepMinutes: item.prepMinutes,
                                  });
                                  const updatedItems: FBOrderItem[] = order.items.map((it): FBOrderItem =>
                                    it.id === item.id ? { ...it, assignedToId: staff?.id, assignedToName: staff?.name } : it
                                  );
                                  ordersStore.update({ ...order, items: updatedItems });
                                }} className="w-64">
                                  {kitchenStaff.map(s => (
                                    <SelectItem key={s.id}>{s.name}</SelectItem>
                                  ))}
                                </Select>
                                <Button size="sm" variant="flat" color="success" onClick={() => {
                                  kitchenOpsStore.add({
                                    orderId: order.id,
                                    table: order.table,
                                    waiterId: order.waiterId,
                                    itemId: item.id,
                                    itemName: item.name,
                                    action: 'prepared',
                                    preparedById: item.assignedToId,
                                    preparedByName: item.assignedToName,
                                    priority: (order.priority || (order.urgent ? 'urgent' : 'low')) as any,
                                    prepMinutes: item.prepMinutes,
                                  });
                                  const updatedItems: FBOrderItem[] = order.items.map((it): FBOrderItem =>
                                    it.id === item.id
                                      ? {
                                          ...it,
                                          status: 'ready',
                                          preparedById: item.assignedToId,
                                          preparedByName: item.assignedToName,
                                          preparedAt: new Date().toISOString(),
                                          readyAt: new Date().toISOString(),
                                        }
                                      : it
                                  );
                                  ordersStore.update({ ...order, items: updatedItems });
                                }}>Mark Ready</Button>
                                <Button size="sm" variant="flat" color="danger" onClick={() => setRejectModal({ open: true, orderId: order.id, itemId: item.id, reason: '' })}>Reject</Button>
                                <Button size="sm" variant="flat" color="warning" onClick={() => {
                                  // Notify Restaurant/Bar (simulate team IDs)
                                  try { dmStore.getState().send('kitchen', 'restaurant', `Order ${order.id} item ${item.name} is delayed`); } catch {}
                                }}>Notify Delay</Button>
                              </div>
                            </div>
                          ))}
                          
                          <Divider />
                          
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium">Progress:</span>
                              <span className="text-sm text-gray-600">{Math.round(getOrderProgressFromStore(order))}%</span>
                            </div>
                            <Progress value={getOrderProgressFromStore(order)} color={getOrderProgressFromStore(order) === 100 ? 'success' : 'primary'} className="w-full" />
                            <div className="flex items-center justify-between text-sm text-gray-600">
                              <span>Priority: {(order.priority || (order.urgent ? 'urgent' : 'low')).toUpperCase()}</span>
                              <span>Items: {order.items.length}</span>
                            </div>
                          </div>
                          
                          {order.notes && (
                            <div className="p-2 bg-yellow-50 border border-yellow-200 rounded">
                              <p className="text-sm text-yellow-800">📝 {order.notes}</p>
                            </div>
                          )}
                          
                          <div className="flex gap-2">
                            <Button size="sm" color="primary" variant="flat" onClick={() => ordersStore.update({ ...order, status: getNextStoreStatus(order.status) })}>Advance Status</Button>
                            <Button size="sm" color="success" variant="flat" onClick={() => ordersStore.update({ ...order, status: 'served' })}>Mark Ready</Button>
                            <Button size="sm" color="danger" variant="flat" onClick={() => setRejectModal({ open: true, orderId: order.id, itemId: null, reason: '' })}>Reject Order</Button>
                            <Button size="sm" color="danger" onClick={() => {
                              ordersStore.remove(order.id);
                              trackEvent('FB.OrderStatusChanged', { id: order.id, status: 'deleted' });
                              try { logAudit({ area: 'kitchen', action: 'delete', entity: 'Order', entityId: order.id, details: 'Kitchen deleted order', severity: 'high' }); } catch {}
                              try { dmStore.getState().send('kitchen', 'restaurant', `Order ${order.id} was deleted by Kitchen`); } catch {}
                            }}>Delete Order</Button>
                          </div>
                        </div>
                      </CardBody>
                    </Card>
                  ))}
                </div>
              </div>
            </Tab>

            <Tab key="log" title="🧾 Kitchen Operations Log">
              <div className="p-6">
                <KitchenOpsLog />
              </div>
            </Tab>

            <Tab key="stations" title="🔥 Kitchen Stations">
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {kitchenStations.map((station) => (
                    <Card key={station.id} className={`border-2 transition-colors ${
                      station.status === 'available' ? 'border-green-200 hover:border-green-400' :
                      station.status === 'busy' ? 'border-yellow-200 hover:border-yellow-400' :
                      'border-red-200 hover:border-red-400'
                    }`}>
                      <CardBody className="p-4">
                        <div className="text-center">
                          <h3 className="text-lg font-bold text-ghana-black mb-2">{station.name}</h3>
                          <Chip color={getStationStatusColor(station.status)} size="sm" className="mb-3">
                            {station.status.charAt(0).toUpperCase() + station.status.slice(1)}
                          </Chip>
                          <p className="text-sm text-gray-600 mb-2">Chef: {station.chef}</p>
                          <div className="mb-3">
                            <div className="flex items-center justify-between text-sm mb-1">
                              <span>Efficiency:</span>
                              <span>{station.efficiency}%</span>
                            </div>
                            <Progress value={station.efficiency} color="success" className="w-full" />
                          </div>
                          <div className="mb-3">
                            <p className="text-sm font-medium text-gray-700 mb-1">Current Orders:</p>
                            <div className="flex flex-wrap gap-1 justify-center">
                              {station.currentOrders.length > 0 ? (
                                station.currentOrders.map((order) => (
                                  <Badge key={order} color="primary" variant="flat" size="sm">
                                    {order}
                                  </Badge>
                                ))
                              ) : (
                                <span className="text-gray-500 text-sm">None</span>
                              )}
                            </div>
                          </div>
                          <div className="mb-3">
                            <p className="text-sm font-medium text-gray-700 mb-1">Specializations:</p>
                            <div className="flex flex-wrap gap-1 justify-center">
                              {station.specializations.map((spec, index) => (
                                <Chip key={index} size="sm" variant="flat" color="secondary">
                                  {spec}
                                </Chip>
                              ))}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" color="primary" variant="flat">View Details</Button>
                            <Button size="sm" color="success" variant="flat">Assign Order</Button>
                          </div>
                        </div>
                      </CardBody>
                    </Card>
                  ))}
                </div>
              </div>
            </Tab>

            <Tab key="inventory" title="📦 Kitchen Inventory">
              <div className="p-6">
                <Table aria-label="Kitchen inventory table">
                  <TableHeader>
                    <TableColumn>ITEM</TableColumn>
                    <TableColumn>CATEGORY</TableColumn>
                    <TableColumn>STOCK LEVEL</TableColumn>
                    <TableColumn>STATUS</TableColumn>
                    <TableColumn>LAST UPDATED</TableColumn>
                    <TableColumn>ACTIONS</TableColumn>
                  </TableHeader>
                  <TableBody>
                    {inventoryItems.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium text-ghana-black">{item.name}</p>
                            <p className="text-sm text-gray-600">ID: {item.id}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge color="primary" variant="flat">{item.category}</Badge>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{item.currentStock} {item.unit}</p>
                            <p className="text-sm text-gray-600">Min: {item.minimumStock} {item.unit}</p>
                            <Progress 
                              value={(item.currentStock / item.minimumStock) * 100} 
                              color={getInventoryStatusColor(item.status)}
                              className="w-24 mt-1"
                            />
                          </div>
                        </TableCell>
                        <TableCell>
                          <Chip color={getInventoryStatusColor(item.status)} size="sm">
                            {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                          </Chip>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {item.lastUpdated.toLocaleDateString()}
                            <p className="text-gray-500">{item.lastUpdated.toLocaleTimeString()}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button size="sm" color="primary" variant="flat">Update</Button>
                            <Button size="sm" color="success" variant="flat">Order</Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Tab>

            <Tab key="recipes" title="📖 Recipe Management">
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {recipes.map((recipe) => (
                    <Card key={recipe.id} className="border border-gray-200 hover:border-ghana-green transition-colors">
                      <CardBody className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-semibold text-ghana-black">{recipe.name}</h4>
                          <Chip color={getDifficultyColor(recipe.difficulty)} size="sm">
                            {recipe.difficulty.charAt(0).toUpperCase() + recipe.difficulty.slice(1)}
                          </Chip>
                        </div>
                        <p className="text-sm text-gray-600 mb-3">{recipe.category}</p>
                        
                        <div className="space-y-2 mb-3">
                          <div className="flex items-center justify-between text-sm">
                            <span>Prep Time:</span>
                            <span className="font-medium">⏱️ {recipe.preparationTime}min</span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span>Ingredients:</span>
                            <span className="font-medium">{recipe.ingredients.length} items</span>
                          </div>
                        </div>
                        
                        <div className="mb-3">
                          <p className="text-sm font-medium text-gray-700 mb-1">Key Ingredients:</p>
                          <div className="flex flex-wrap gap-1">
                            {recipe.ingredients.slice(0, 3).map((ingredient, index) => (
                              <Chip key={index} size="sm" variant="flat" color="secondary">
                                {ingredient.name}
                              </Chip>
                            ))}
                            {recipe.ingredients.length > 3 && (
                              <Chip size="sm" variant="flat" color="default">
                                +{recipe.ingredients.length - 3} more
                              </Chip>
                            )}
                          </div>
                        </div>
                        
                        {recipe.allergens.length > 0 && recipe.allergens[0] !== 'None' && (
                          <div className="mb-3">
                            <p className="text-sm font-medium text-gray-700 mb-1">Allergens:</p>
                            <div className="flex flex-wrap gap-1">
                              {recipe.allergens.map((allergen, index) => (
                                <Chip key={index} size="sm" variant="flat" color="warning">
                                  {allergen}
                                </Chip>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        <div className="flex gap-2">
                          <Button size="sm" color="primary" variant="flat">View Recipe</Button>
                          <Button size="sm" color="secondary" variant="flat">Edit</Button>
                        </div>
                      </CardBody>
                    </Card>
                  ))}
                </div>
              </div>
            </Tab>
          </Tabs>
        </CardBody>
      </Card>

      {/* New Order Modal */}
      <Modal isOpen={isNewOrderModalOpen} onClose={() => setIsNewOrderModalOpen(false)} size="2xl">
        <ModalContent>
          <ModalHeader>Create New Kitchen Order</ModalHeader>
          <ModalBody>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input label="Table Number" placeholder="e.g., T1" />
                <Select label="Priority" placeholder="Select priority">
                  <SelectItem key="low">Low</SelectItem>
                  <SelectItem key="medium">Medium</SelectItem>
                  <SelectItem key="high">High</SelectItem>
                  <SelectItem key="urgent">Urgent</SelectItem>
                </Select>
              </div>
              
              <Select label="Menu Items" placeholder="Select items" selectionMode="multiple">
                {recipes.map((recipe) => (
                  <SelectItem key={recipe.id}>
                    {recipe.name} ({recipe.preparationTime}min)
                  </SelectItem>
                ))}
              </Select>
              
              <Input label="Special Instructions" placeholder="Any special cooking instructions" />
              <Input label="Server Name" placeholder="Enter server name" />
            </div>
          </ModalBody>
          <ModalFooter>
            <Button color="danger" variant="light" onPress={() => setIsNewOrderModalOpen(false)}>
              Cancel
            </Button>
            <Button color="primary" className="bg-ghana-green text-white" onPress={() => setIsNewOrderModalOpen(false)}>
              Create Order
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* New Recipe Modal */}
      <Modal isOpen={isRecipeModalOpen} onClose={() => setIsRecipeModalOpen(false)} size="3xl">
        <ModalContent>
          <ModalHeader>Add New Recipe</ModalHeader>
          <ModalBody>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input label="Recipe Name" placeholder="Enter recipe name" />
                <Select label="Category" placeholder="Select category">
                  <SelectItem key="appetizer">Appetizer</SelectItem>
                  <SelectItem key="main-course">Main Course</SelectItem>
                  <SelectItem key="dessert">Dessert</SelectItem>
                  <SelectItem key="beverage">Beverage</SelectItem>
                </Select>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Input label="Preparation Time (min)" type="number" placeholder="30" />
                <Select label="Difficulty" placeholder="Select difficulty">
                  <SelectItem key="easy">Easy</SelectItem>
                  <SelectItem key="medium">Medium</SelectItem>
                  <SelectItem key="hard">Hard</SelectItem>
                </Select>
                <Input label="Allergens" placeholder="e.g., Peanuts, Fish, Gluten" />
              </div>
              
              <Input label="Instructions" placeholder="Enter cooking instructions (one per line)" />
            </div>
          </ModalBody>
          <ModalFooter>
            <Button color="danger" variant="light" onPress={() => setIsRecipeModalOpen(false)}>
              Cancel
            </Button>
            <Button color="primary" className="bg-ghana-green text-white" onPress={() => setIsRecipeModalOpen(false)}>
              Add Recipe
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Reject Modal */}
      <Modal isOpen={rejectModal.open} onClose={() => setRejectModal({ open: false, orderId: null, itemId: null, reason: '' })}>
        <ModalContent>
          <ModalHeader>Reject {rejectModal.itemId ? 'Item' : 'Order'}</ModalHeader>
          <ModalBody>
            <Input label="Reason" placeholder="Out of stock, cannot prepare, etc." value={rejectModal.reason} onChange={(e) => setRejectModal({ ...rejectModal, reason: e.target.value })} />
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onClick={() => setRejectModal({ open: false, orderId: null, itemId: null, reason: '' })}>Cancel</Button>
            <Button color="danger" onClick={() => {
              if (!rejectModal.orderId) { setRejectModal({ open: false, orderId: null, itemId: null, reason: '' }); return; }
              const order = storeOrders.find(o => o.id === rejectModal.orderId);
              if (!order) { setRejectModal({ open: false, orderId: null, itemId: null, reason: '' }); return; }
              if (rejectModal.itemId) {
                const name = order.items.find(i => i.id === rejectModal.itemId)?.name || '';
                const updatedItems: FBOrderItem[] = order.items.map((i): FBOrderItem =>
                  i.id === rejectModal.itemId ? { ...i, status: 'pending' } : i
                );
                const rejectionNote = `REJECTED: ${rejectModal.reason}`;
                ordersStore.update({ ...order, items: updatedItems, notes: order.notes ? `${order.notes}\n${rejectionNote}` : rejectionNote });
                kitchenOpsStore.add({ orderId: order.id, table: order.table, waiterId: order.waiterId, itemId: rejectModal.itemId, itemName: name, action: 'status', fromStatus: 'preparing', toStatus: 'pending', notes: `Rejected: ${rejectModal.reason}` });
              } else {
                ordersStore.update({ ...order, status: 'pending', notes: `REJECTED: ${rejectModal.reason}` });
              }
              trackEvent('FB.OrderUpdated', { id: rejectModal.orderId, action: 'rejected', reason: rejectModal.reason });
              try { logAudit({ area: 'kitchen', action: 'update', entity: rejectModal.itemId ? 'OrderItem' : 'Order', entityId: rejectModal.orderId, details: `Rejected ${rejectModal.itemId ? 'item' : 'order'}: ${rejectModal.reason}`, severity: 'medium' }); } catch {}
              setRejectModal({ open: false, orderId: null, itemId: null, reason: '' });
            }}>Confirm</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}

function KitchenOpsLog() {
  const [rows, setRows] = React.useState<KitchenOpRecord[]>([]);
  React.useEffect(() => {
    const sync = () => setRows(kitchenOpsStore.all());
    sync();
    return kitchenOpsStore.subscribe(sync);
  }, []);
  return (
    <Card className="border-0 shadow-lg">
      <CardHeader className="pb-3">
        <h3 className="text-xl font-semibold text-ghana-black">Kitchen Operations Log</h3>
      </CardHeader>
      <CardBody>
        <Table aria-label="Kitchen operations log">
          <TableHeader>
            <TableColumn>TIME</TableColumn>
            <TableColumn>ORDER</TableColumn>
            <TableColumn>TABLE</TableColumn>
            <TableColumn>ITEM</TableColumn>
            <TableColumn>ACTION</TableColumn>
            <TableColumn>FROM → TO</TableColumn>
            <TableColumn>ASSIGNEE</TableColumn>
            <TableColumn>PREPARED BY</TableColumn>
            <TableColumn>PRIORITY</TableColumn>
          </TableHeader>
          <TableBody>
            {rows.map(r => (
              <TableRow key={r.id}>
                <TableCell>{new Date(r.at).toLocaleString()}</TableCell>
                <TableCell>{r.orderId}</TableCell>
                <TableCell>{r.table}</TableCell>
                <TableCell>{r.itemName}</TableCell>
                <TableCell>{r.action}</TableCell>
                <TableCell>{r.fromStatus || '-'} → {r.toStatus || '-'}</TableCell>
                <TableCell>{r.assignedToName || '-'}</TableCell>
                <TableCell>{r.preparedByName || '-'}</TableCell>
                <TableCell>{(r.priority || '-').toString().toUpperCase()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardBody>
    </Card>
  );
}
