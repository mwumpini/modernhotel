'use client';

import React, { useState } from 'react';
import { Card, CardBody, CardHeader, Button, Input, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, Chip, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Select, SelectItem, Divider, Badge, Progress } from "@heroui/react";

interface MenuItem {
  id: string;
  name: string;
  category: string;
  price: number;
  available: boolean;
  preparationTime: number;
}

interface Order {
  id: string;
  tableNumber: string;
  items: OrderItem[];
  total: number;
  status: 'pending' | 'preparing' | 'ready' | 'served' | 'paid';
  timestamp: Date;
  paymentMethod: string;
}

interface OrderItem {
  menuItem: MenuItem;
  quantity: number;
  notes: string;
  price: number;
}

export default function FoodBeveragePOS() {
  const [selectedTab, setSelectedTab] = useState('pos');
  const [isNewOrderModalOpen, setIsNewOrderModalOpen] = useState(false);
  const [selectedTable, setSelectedTable] = useState('');
  const [cartItems, setCartItems] = useState<OrderItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Sample data
  const menuItems: MenuItem[] = [
    { id: '1', name: 'Jollof Rice', category: 'Main Course', price: 25.00, available: true, preparationTime: 15 },
    { id: '2', name: 'Banku & Tilapia', category: 'Main Course', price: 35.00, available: true, preparationTime: 20 },
    { id: '3', name: 'Fufu & Light Soup', category: 'Main Course', price: 30.00, available: true, preparationTime: 18 },
    { id: '4', name: 'Waakye', category: 'Main Course', price: 20.00, available: true, preparationTime: 12 },
    { id: '5', name: 'Grilled Chicken', category: 'Main Course', price: 40.00, available: true, preparationTime: 25 },
    { id: '6', name: 'Palm Wine', category: 'Beverages', price: 15.00, available: true, preparationTime: 5 },
    { id: '7', name: 'Fresh Coconut', category: 'Beverages', price: 8.00, available: true, preparationTime: 3 },
    { id: '8', name: 'Ghanaian Coffee', category: 'Beverages', price: 12.00, available: true, preparationTime: 8 },
    { id: '9', name: 'Kelewele', category: 'Appetizers', price: 10.00, available: true, preparationTime: 10 },
    { id: '10', name: 'Bofrot', category: 'Desserts', price: 5.00, available: true, preparationTime: 5 },
  ];

  const orders: Order[] = [
    {
      id: 'ORD001',
      tableNumber: 'T1',
      items: [
        { menuItem: menuItems[0], quantity: 2, notes: 'Extra spicy', price: 50.00 },
        { menuItem: menuItems[5], quantity: 1, notes: '', price: 15.00 }
      ],
      total: 65.00,
      status: 'preparing',
      timestamp: new Date(Date.now() - 15 * 60000),
      paymentMethod: 'Mobile Money'
    },
    {
      id: 'ORD002',
      tableNumber: 'T3',
      items: [
        { menuItem: menuItems[1], quantity: 1, notes: 'Fresh fish', price: 35.00 },
        { menuItem: menuItems[6], quantity: 2, notes: '', price: 16.00 }
      ],
      total: 51.00,
      status: 'ready',
      timestamp: new Date(Date.now() - 8 * 60000),
      paymentMethod: 'Cash'
    },
    {
      id: 'ORD003',
      tableNumber: 'T5',
      items: [
        { menuItem: menuItems[4], quantity: 1, notes: 'Well done', price: 40.00 },
        { menuItem: menuItems[8], quantity: 1, notes: 'Extra crispy', price: 10.00 }
      ],
      total: 50.00,
      status: 'served',
      timestamp: new Date(Date.now() - 25 * 60000),
      paymentMethod: 'Card'
    }
  ];

  const tables = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10'];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'warning';
      case 'preparing': return 'primary';
      case 'ready': return 'success';
      case 'served': return 'secondary';
      case 'paid': return 'default';
      default: return 'default';
    }
  };

  const getPaymentMethodColor = (method: string) => {
    switch (method) {
      case 'Mobile Money': return 'success';
      case 'Cash': return 'warning';
      case 'Card': return 'primary';
      default: return 'default';
    }
  };

  const addToCart = (item: MenuItem) => {
    const existingItem = cartItems.find(cartItem => cartItem.menuItem.id === item.id);
    if (existingItem) {
      setCartItems(cartItems.map(cartItem => 
        cartItem.menuItem.id === item.id 
          ? { ...cartItem, quantity: cartItem.quantity + 1, price: item.price * (cartItem.quantity + 1) }
          : cartItem
      ));
    } else {
      setCartItems([...cartItems, { menuItem: item, quantity: 1, notes: '', price: item.price }]);
    }
  };

  const removeFromCart = (itemId: string) => {
    setCartItems(cartItems.filter(item => item.menuItem.id !== itemId));
  };

  const updateCartItemQuantity = (itemId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(itemId);
    } else {
      setCartItems(cartItems.map(item => 
        item.menuItem.id === itemId 
          ? { ...item, quantity, price: item.menuItem.price * quantity }
          : item
      ));
    }
  };

  const getCartTotal = () => {
    return cartItems.reduce((total, item) => total + item.price, 0);
  };

  const filteredMenuItems = menuItems.filter(item => 
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-ghana-black">🍽️ Food & Beverage - Point of Sale</h2>
          <p className="text-gray-600">Manage orders, payments, and menu items</p>
        </div>
        <Button 
          color="primary" 
          className="bg-ghana-green text-white"
          onClick={() => setIsNewOrderModalOpen(true)}
        >
          + New Order
        </Button>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card className="border-0 shadow-lg">
          <CardBody className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Today's Orders</p>
                <p className="text-2xl font-bold text-ghana-black">24</p>
                <p className="text-sm text-green-600">+8 from yesterday</p>
              </div>
              <div className="text-3xl">📋</div>
            </div>
          </CardBody>
        </Card>
        
        <Card className="border-0 shadow-lg">
          <CardBody className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Revenue Today</p>
                <p className="text-2xl font-bold text-ghana-black">₵1,245</p>
                <p className="text-sm text-green-600">+15% from yesterday</p>
              </div>
              <div className="text-3xl">💰</div>
            </div>
          </CardBody>
        </Card>
        
        <Card className="border-0 shadow-lg">
          <CardBody className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Tables</p>
                <p className="text-2xl font-bold text-ghana-black">7/10</p>
                <p className="text-sm text-blue-600">70% occupancy</p>
              </div>
              <div className="text-3xl">🪑</div>
            </div>
          </CardBody>
        </Card>
        
        <Card className="border-0 shadow-lg">
          <CardBody className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Avg Order Time</p>
                <p className="text-2xl font-bold text-ghana-black">18min</p>
                <p className="text-sm text-green-600">-2min from avg</p>
              </div>
              <div className="text-3xl">⏱️</div>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Menu Items */}
        <div className="lg:col-span-2">
          <Card className="border-0 shadow-lg">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-ghana-black">🍽️ Menu Items</h3>
                <Input
                  placeholder="Search menu items..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-64"
                  startContent={<span className="text-gray-400">🔍</span>}
                />
              </div>
            </CardHeader>
            <CardBody>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredMenuItems.map((item) => (
                  <Card key={item.id} className="border border-gray-200 hover:border-ghana-green transition-colors">
                    <CardBody className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-semibold text-ghana-black">{item.name}</h4>
                        <Chip 
                          color={item.available ? 'success' : 'danger'} 
                          size="sm"
                        >
                          {item.available ? 'Available' : 'Unavailable'}
                        </Chip>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{item.category}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-lg font-bold text-ghana-black">₵{item.price.toFixed(2)}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500">⏱️ {item.preparationTime}min</span>
                          <Button
                            size="sm"
                            color="primary"
                            className="bg-ghana-green text-white"
                            onClick={() => addToCart(item)}
                            isDisabled={!item.available}
                          >
                            Add
                          </Button>
                        </div>
                      </div>
                    </CardBody>
                  </Card>
                ))}
              </div>
            </CardBody>
          </Card>
        </div>

        {/* Cart */}
        <div>
          <Card className="border-0 shadow-lg sticky top-6">
            <CardHeader className="pb-3">
              <h3 className="text-xl font-semibold text-ghana-black">🛒 Current Order</h3>
            </CardHeader>
            <CardBody>
              {cartItems.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <span className="text-4xl mb-4 block">🛒</span>
                  <p>Your cart is empty</p>
                  <p className="text-sm">Add items from the menu</p>
                </div>
              ) : (
                <>
                  <div className="space-y-3 mb-4">
                    {cartItems.map((item) => (
                      <div key={item.menuItem.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex-1">
                          <h4 className="font-medium text-ghana-black">{item.menuItem.name}</h4>
                          <p className="text-sm text-gray-600">₵{item.menuItem.price.toFixed(2)} each</p>
                          {item.notes && <p className="text-xs text-gray-500">Note: {item.notes}</p>}
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="light"
                            onClick={() => updateCartItemQuantity(item.menuItem.id, item.quantity - 1)}
                          >
                            -
                          </Button>
                          <span className="w-8 text-center font-medium">{item.quantity}</span>
                          <Button
                            size="sm"
                            variant="light"
                            onClick={() => updateCartItemQuantity(item.menuItem.id, item.quantity + 1)}
                          >
                            +
                          </Button>
                          <span className="font-bold text-ghana-black">₵{item.price.toFixed(2)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <Divider />
                  
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-lg font-bold text-ghana-black">Total:</span>
                    <span className="text-xl font-bold text-ghana-black">₵{getCartTotal().toFixed(2)}</span>
                  </div>
                  
                  <Button
                    color="success"
                    className="w-full bg-ghana-green text-white"
                    size="lg"
                  >
                    💳 Process Payment
                  </Button>
                </>
              )}
            </CardBody>
          </Card>
        </div>
      </div>

      {/* Recent Orders */}
      <Card className="border-0 shadow-lg mt-8">
        <CardHeader className="pb-3">
          <h3 className="text-xl font-semibold text-ghana-black">📋 Recent Orders</h3>
        </CardHeader>
        <CardBody>
          <Table aria-label="Recent orders table">
            <TableHeader>
              <TableColumn>ORDER ID</TableColumn>
              <TableColumn>TABLE</TableColumn>
              <TableColumn>ITEMS</TableColumn>
              <TableColumn>TOTAL</TableColumn>
              <TableColumn>STATUS</TableColumn>
              <TableColumn>PAYMENT</TableColumn>
              <TableColumn>TIME</TableColumn>
              <TableColumn>ACTIONS</TableColumn>
            </TableHeader>
            <TableBody>
              {orders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="font-medium">{order.id}</TableCell>
                  <TableCell>
                    <Badge color="primary" variant="flat">{order.tableNumber}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {order.items.length} items
                      <p className="text-gray-500 text-xs">
                        {order.items.map(item => item.menuItem.name).join(', ')}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell className="font-bold">₵{order.total.toFixed(2)}</TableCell>
                  <TableCell>
                    <Chip color={getStatusColor(order.status)} size="sm">
                      {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                    </Chip>
                  </TableCell>
                  <TableCell>
                    <Chip color={getPaymentMethodColor(order.paymentMethod)} size="sm">
                      {order.paymentMethod}
                    </Chip>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {Math.floor((Date.now() - order.timestamp.getTime()) / 60000)}min ago
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button size="sm" color="primary" variant="flat">View</Button>
                      <Button size="sm" color="success" variant="flat">Update</Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardBody>
      </Card>

      {/* New Order Modal */}
      <Modal isOpen={isNewOrderModalOpen} onClose={() => setIsNewOrderModalOpen(false)} size="2xl">
        <ModalContent>
          <ModalHeader>Create New Order</ModalHeader>
          <ModalBody>
            <div className="space-y-4">
              <Select
                label="Select Table"
                placeholder="Choose a table"
                value={selectedTable}
                onChange={(e) => setSelectedTable(e.target.value)}
              >
                {tables.map((table) => (
                  <SelectItem key={table} value={table}>
                    {table}
                  </SelectItem>
                ))}
              </Select>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input label="Customer Name" placeholder="Enter customer name" />
                <Input label="Phone Number" placeholder="Enter phone number" />
              </div>
              
              <Input label="Special Instructions" placeholder="Any special requests or notes" />
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
    </div>
  );
}
