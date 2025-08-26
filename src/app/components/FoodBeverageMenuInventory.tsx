'use client';

import React, { useState } from 'react';
import { Card, CardBody, CardHeader, Button, Input, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, Chip, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Select, SelectItem, Divider, Badge, Progress, Tabs, Tab } from "@heroui/react";

interface MenuItem {
  id: string;
  name: string;
  description: string;
  category: string;
  price: number;
  cost: number;
  profitMargin: number;
  available: boolean;
  preparationTime: number;
  allergens: string[];
  ingredients: MenuIngredient[];
  image?: string;
  popularity: number;
  seasonal: boolean;
}

interface MenuIngredient {
  name: string;
  quantity: number;
  unit: string;
  cost: number;
}

interface InventoryItem {
  id: string;
  name: string;
  category: string;
  currentStock: number;
  minimumStock: number;
  maximumStock: number;
  unit: string;
  costPerUnit: number;
  supplier: string;
  status: 'sufficient' | 'low' | 'out' | 'overstock';
  lastUpdated: Date;
  expiryDate?: Date;
  location: string;
}

interface Supplier {
  id: string;
  name: string;
  contact: string;
  phone: string;
  email: string;
  rating: number;
  deliveryTime: number;
  paymentTerms: string;
  items: string[];
}

interface PurchaseOrder {
  id: string;
  supplier: string;
  items: PurchaseOrderItem[];
  totalCost: number;
  status: 'pending' | 'ordered' | 'delivered' | 'cancelled';
  orderDate: Date;
  expectedDelivery: Date;
  actualDelivery?: Date;
}

interface PurchaseOrderItem {
  item: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
}

export default function FoodBeverageMenuInventory() {
  const [selectedTab, setSelectedTab] = useState('menu');
  const [isNewMenuItemModalOpen, setIsNewMenuItemModalOpen] = useState(false);
  const [isNewInventoryItemModalOpen, setIsNewInventoryItemModalOpen] = useState(false);
  const [isNewPurchaseOrderModalOpen, setIsNewPurchaseOrderModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedInventoryStatus, setSelectedInventoryStatus] = useState('all');

  // Sample data
  const menuItems: MenuItem[] = [
    {
      id: '1',
      name: 'Jollof Rice',
      description: 'Traditional Ghanaian rice dish with tomatoes and spices',
      category: 'Main Course',
      price: 28.00,
      cost: 12.50,
      profitMargin: 55.4,
      available: true,
      preparationTime: 25,
      allergens: ['None'],
      ingredients: [
        { name: 'Rice', quantity: 2, unit: 'cups', cost: 4.00 },
        { name: 'Tomatoes', quantity: 6, unit: 'medium', cost: 3.00 },
        { name: 'Onions', quantity: 2, unit: 'medium', cost: 1.00 },
        { name: 'Palm Oil', quantity: 3, unit: 'tbsp', cost: 2.00 },
        { name: 'Chicken', quantity: 500, unit: 'g', cost: 2.50 }
      ],
      popularity: 95,
      seasonal: false
    },
    {
      id: '2',
      name: 'Banku & Tilapia',
      description: 'Fermented corn dough with grilled tilapia fish',
      category: 'Main Course',
      price: 35.00,
      cost: 18.00,
      profitMargin: 48.6,
      available: true,
      preparationTime: 30,
      allergens: ['Fish', 'Corn'],
      ingredients: [
        { name: 'Corn Dough', quantity: 2, unit: 'cups', cost: 3.00 },
        { name: 'Cassava Dough', quantity: 1, unit: 'cup', cost: 2.00 },
        { name: 'Tilapia', quantity: 1, unit: 'whole', cost: 12.00 },
        { name: 'Pepper', quantity: 3, unit: 'medium', cost: 1.00 }
      ],
      popularity: 88,
      seasonal: false
    },
    {
      id: '3',
      name: 'Kelewele',
      description: 'Spicy fried plantains with ginger and pepper',
      category: 'Appetizer',
      price: 12.00,
      cost: 4.50,
      profitMargin: 62.5,
      available: true,
      preparationTime: 10,
      allergens: ['None'],
      ingredients: [
        { name: 'Plantains', quantity: 3, unit: 'medium', cost: 3.00 },
        { name: 'Ginger', quantity: 1, unit: 'tbsp', cost: 0.50 },
        { name: 'Pepper', quantity: 2, unit: 'medium', cost: 1.00 }
      ],
      popularity: 92,
      seasonal: false
    },
    {
      id: '4',
      name: 'Palm Wine',
      description: 'Traditional palm wine from coconut palm',
      category: 'Beverage',
      price: 15.00,
      cost: 6.00,
      profitMargin: 60.0,
      available: true,
      preparationTime: 5,
      allergens: ['None'],
      ingredients: [
        { name: 'Palm Wine', quantity: 1, unit: 'bottle', cost: 6.00 }
      ],
      popularity: 78,
      seasonal: true
    }
  ];

  const inventoryItems: InventoryItem[] = [
    { id: '1', name: 'Rice', category: 'Grains', currentStock: 50, minimumStock: 20, maximumStock: 100, unit: 'kg', costPerUnit: 2.00, supplier: 'Ghana Foods Ltd', status: 'sufficient', lastUpdated: new Date(), location: 'Storage A' },
    { id: '2', name: 'Chicken', category: 'Meat', currentStock: 15, minimumStock: 25, maximumStock: 50, unit: 'kg', costPerUnit: 5.00, supplier: 'Fresh Meat Co', status: 'low', lastUpdated: new Date(), location: 'Freezer B' },
    { id: '3', name: 'Tilapia', category: 'Fish', currentStock: 8, minimumStock: 10, maximumStock: 30, unit: 'kg', costPerUnit: 12.00, supplier: 'Ocean Fresh', status: 'low', lastUpdated: new Date(), location: 'Freezer A' },
    { id: '4', name: 'Plantains', category: 'Vegetables', currentStock: 0, minimumStock: 5, maximumStock: 20, unit: 'kg', costPerUnit: 1.50, supplier: 'Local Market', status: 'out', lastUpdated: new Date(), location: 'Storage B' },
    { id: '5', name: 'Palm Oil', category: 'Oils', currentStock: 12, minimumStock: 8, maximumStock: 25, unit: 'L', costPerUnit: 3.00, supplier: 'Ghana Oils', status: 'sufficient', lastUpdated: new Date(), location: 'Storage A' },
    { id: '6', name: 'Tomatoes', category: 'Vegetables', currentStock: 30, minimumStock: 15, maximumStock: 40, unit: 'kg', costPerUnit: 2.50, supplier: 'Fresh Produce', status: 'sufficient', lastUpdated: new Date(), location: 'Storage B' }
  ];

  const suppliers: Supplier[] = [
    { id: '1', name: 'Ghana Foods Ltd', contact: 'Kwame Asante', phone: '+233 24 123 4567', email: 'info@ghanafoods.com', rating: 4.5, deliveryTime: 2, paymentTerms: 'Net 30', items: ['Rice', 'Palm Oil'] },
    { id: '2', name: 'Fresh Meat Co', contact: 'Ama Osei', phone: '+233 20 987 6543', email: 'orders@freshmeat.com', rating: 4.2, deliveryTime: 1, paymentTerms: 'Net 15', items: ['Chicken', 'Beef'] },
    { id: '3', name: 'Ocean Fresh', contact: 'Kofi Mensah', phone: '+233 26 555 1234', email: 'sales@oceanfresh.com', rating: 4.8, deliveryTime: 3, paymentTerms: 'Net 30', items: ['Tilapia', 'Salmon'] },
    { id: '4', name: 'Local Market', contact: 'Efua Addo', phone: '+233 27 777 8888', email: 'localmarket@gmail.com', rating: 4.0, deliveryTime: 1, paymentTerms: 'Cash on Delivery', items: ['Plantains', 'Tomatoes'] }
  ];

  const purchaseOrders: PurchaseOrder[] = [
    {
      id: 'PO001',
      supplier: 'Fresh Meat Co',
      items: [
        { item: 'Chicken', quantity: 20, unitCost: 5.00, totalCost: 100.00 },
        { item: 'Beef', quantity: 15, unitCost: 8.00, totalCost: 120.00 }
      ],
      totalCost: 220.00,
      status: 'ordered',
      orderDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      expectedDelivery: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000)
    },
    {
      id: 'PO002',
      supplier: 'Local Market',
      items: [
        { item: 'Plantains', quantity: 10, unitCost: 1.50, totalCost: 15.00 },
        { item: 'Tomatoes', quantity: 20, unitCost: 2.50, totalCost: 50.00 }
      ],
      totalCost: 65.00,
      status: 'delivered',
      orderDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      expectedDelivery: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      actualDelivery: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'sufficient': return 'success';
      case 'low': return 'warning';
      case 'out': return 'danger';
      case 'overstock': return 'secondary';
      default: return 'default';
    }
  };

  const getOrderStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'warning';
      case 'ordered': return 'primary';
      case 'delivered': return 'success';
      case 'cancelled': return 'danger';
      default: return 'default';
    }
  };

  const getPopularityColor = (popularity: number) => {
    if (popularity >= 90) return 'success';
    if (popularity >= 80) return 'primary';
    if (popularity >= 70) return 'warning';
    return 'danger';
  };

  const filteredMenuItems = selectedCategory === 'all' 
    ? menuItems 
    : menuItems.filter(item => item.category === selectedCategory);

  const filteredInventoryItems = selectedInventoryStatus === 'all' 
    ? inventoryItems 
    : inventoryItems.filter(item => item.status === selectedInventoryStatus);

  const getStockPercentage = (item: InventoryItem) => {
    return (item.currentStock / item.maximumStock) * 100;
  };

  const getTotalInventoryValue = () => {
    return inventoryItems.reduce((total, item) => total + (item.currentStock * item.costPerUnit), 0);
  };

  const getLowStockItems = () => {
    return inventoryItems.filter(item => item.status === 'low' || item.status === 'out');
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-ghana-black">🍽️ Food & Beverage - Menu & Inventory</h2>
          <p className="text-gray-600">Manage menu items, inventory, suppliers, and purchase orders</p>
        </div>
        <div className="flex gap-3">
          <Button 
            color="primary" 
            className="bg-ghana-green text-white"
            onClick={() => setIsNewMenuItemModalOpen(true)}
          >
            + Add Menu Item
          </Button>
          <Button 
            color="secondary" 
            className="bg-ghana-gold text-white"
            onClick={() => setIsNewInventoryItemModalOpen(true)}
          >
            + Add Inventory Item
          </Button>
          <Button 
            color="success" 
            className="bg-blue-500 text-white"
            onClick={() => setIsNewPurchaseOrderModalOpen(true)}
          >
            + New Purchase Order
          </Button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card className="border-0 shadow-lg">
          <CardBody className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Menu Items</p>
                <p className="text-2xl font-bold text-ghana-black">{menuItems.length}</p>
                <p className="text-sm text-green-600">{menuItems.filter(item => item.available).length} available</p>
              </div>
              <div className="text-3xl">🍽️</div>
            </div>
          </CardBody>
        </Card>
        
        <Card className="border-0 shadow-lg">
          <CardBody className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Inventory Items</p>
                <p className="text-2xl font-bold text-ghana-black">{inventoryItems.length}</p>
                <p className="text-sm text-warning">{getLowStockItems().length} need restocking</p>
              </div>
              <div className="text-3xl">📦</div>
            </div>
          </CardBody>
        </Card>
        
        <Card className="border-0 shadow-lg">
          <CardBody className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Inventory Value</p>
                <p className="text-2xl font-bold text-ghana-black">₵{getTotalInventoryValue().toFixed(2)}</p>
                <p className="text-sm text-blue-600">Current stock value</p>
              </div>
              <div className="text-3xl">💰</div>
            </div>
          </CardBody>
        </Card>
        
        <Card className="border-0 shadow-lg">
          <CardBody className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Suppliers</p>
                <p className="text-2xl font-bold text-ghana-black">{suppliers.length}</p>
                <p className="text-sm text-green-600">All reliable</p>
              </div>
              <div className="text-3xl">🏢</div>
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
            <Tab key="menu" title="🍽️ Menu Management">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <Select
                    label="Filter by Category"
                    placeholder="All Categories"
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="w-64"
                  >
                    <SelectItem key="all" value="all">All Categories</SelectItem>
                    <SelectItem key="Appetizer" value="Appetizer">Appetizer</SelectItem>
                    <SelectItem key="Main Course" value="Main Course">Main Course</SelectItem>
                    <SelectItem key="Beverage" value="Beverage">Beverage</SelectItem>
                    <SelectItem key="Dessert" value="Dessert">Dessert</SelectItem>
                  </Select>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredMenuItems.map((item) => (
                    <Card key={item.id} className="border border-gray-200 hover:border-ghana-green transition-colors">
                      <CardBody className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-semibold text-ghana-black">{item.name}</h4>
                          <Chip 
                            color={item.available ? 'success' : 'danger'} 
                            size="sm"
                          >
                            {item.available ? 'Available' : 'Unavailable'}
                          </Chip>
                        </div>
                        <p className="text-sm text-gray-600 mb-3">{item.description}</p>
                        
                        <div className="space-y-2 mb-3">
                          <div className="flex items-center justify-between text-sm">
                            <span>Price:</span>
                            <span className="font-bold text-ghana-black">₵{item.price.toFixed(2)}</span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span>Cost:</span>
                            <span className="text-gray-600">₵{item.cost.toFixed(2)}</span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span>Profit Margin:</span>
                            <span className="text-green-600 font-medium">{item.profitMargin.toFixed(1)}%</span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span>Prep Time:</span>
                            <span className="text-gray-600">⏱️ {item.preparationTime}min</span>
                          </div>
                        </div>
                        
                        <div className="mb-3">
                          <div className="flex items-center justify-between text-sm mb-1">
                            <span>Popularity:</span>
                            <span>{item.popularity}%</span>
                          </div>
                          <Progress 
                            value={item.popularity} 
                            color={getPopularityColor(item.popularity)}
                            className="w-full"
                          />
                        </div>
                        
                        <div className="mb-3">
                          <p className="text-sm font-medium text-gray-700 mb-1">Ingredients ({item.ingredients.length}):</p>
                          <div className="flex flex-wrap gap-1">
                            {item.ingredients.slice(0, 3).map((ingredient, index) => (
                              <Chip key={index} size="sm" variant="flat" color="secondary">
                                {ingredient.name}
                              </Chip>
                            ))}
                            {item.ingredients.length > 3 && (
                              <Chip size="sm" variant="flat" color="default">
                                +{item.ingredients.length - 3} more
                              </Chip>
                            )}
                          </div>
                        </div>
                        
                        {item.allergens.length > 0 && item.allergens[0] !== 'None' && (
                          <div className="mb-3">
                            <p className="text-sm font-medium text-gray-700 mb-1">Allergens:</p>
                            <div className="flex flex-wrap gap-1">
                              {item.allergens.map((allergen, index) => (
                                <Chip key={index} size="sm" variant="flat" color="warning">
                                  {allergen}
                                </Chip>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {item.seasonal && (
                          <Chip size="sm" variant="flat" color="primary" className="mb-3">
                            🌱 Seasonal Item
                          </Chip>
                        )}
                        
                        <div className="flex gap-2">
                          <Button size="sm" color="primary" variant="flat">Edit</Button>
                          <Button size="sm" color="secondary" variant="flat">Toggle</Button>
                          <Button size="sm" color="success" variant="flat">View Recipe</Button>
                        </div>
                      </CardBody>
                    </Card>
                  ))}
                </div>
              </div>
            </Tab>

            <Tab key="inventory" title="📦 Inventory Management">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <Select
                    label="Filter by Status"
                    placeholder="All Status"
                    value={selectedInventoryStatus}
                    onChange={(e) => setSelectedInventoryStatus(e.target.value)}
                    className="w-64"
                  >
                    <SelectItem key="all" value="all">All Status</SelectItem>
                    <SelectItem key="sufficient" value="sufficient">Sufficient</SelectItem>
                    <SelectItem key="low" value="low">Low Stock</SelectItem>
                    <SelectItem key="out" value="out">Out of Stock</SelectItem>
                    <SelectItem key="overstock" value="overstock">Overstock</SelectItem>
                  </Select>
                </div>
                
                <Table aria-label="Inventory table">
                  <TableHeader>
                    <TableColumn>ITEM</TableColumn>
                    <TableColumn>CATEGORY</TableColumn>
                    <TableColumn>STOCK LEVEL</TableColumn>
                    <TableColumn>COST</TableColumn>
                    <TableColumn>STATUS</TableColumn>
                    <TableColumn>SUPPLIER</TableColumn>
                    <TableColumn>LOCATION</TableColumn>
                    <TableColumn>ACTIONS</TableColumn>
                  </TableHeader>
                  <TableBody>
                    {filteredInventoryItems.map((item) => (
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
                            <p className="text-sm text-gray-600">Min: {item.minimumStock} | Max: {item.maximumStock}</p>
                            <Progress 
                              value={getStockPercentage(item)} 
                              color={getStatusColor(item.status)}
                              className="w-24 mt-1"
                            />
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">₵{item.costPerUnit.toFixed(2)}/{item.unit}</p>
                            <p className="text-sm text-gray-600">Total: ₵{(item.currentStock * item.costPerUnit).toFixed(2)}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Chip color={getStatusColor(item.status)} size="sm">
                            {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                          </Chip>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <p className="font-medium">{item.supplier}</p>
                            <p className="text-gray-600">Last updated: {item.lastUpdated.toLocaleDateString()}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge color="secondary" variant="flat">{item.location}</Badge>
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

            <Tab key="suppliers" title="🏢 Supplier Management">
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {suppliers.map((supplier) => (
                    <Card key={supplier.id} className="border border-gray-200 hover:border-ghana-green transition-colors">
                      <CardBody className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-semibold text-ghana-black">{supplier.name}</h4>
                          <div className="flex items-center gap-1">
                            <span className="text-yellow-500">⭐</span>
                            <span className="text-sm font-medium">{supplier.rating}</span>
                          </div>
                        </div>
                        
                        <div className="space-y-2 mb-3">
                          <div className="text-sm">
                            <span className="font-medium">Contact:</span> {supplier.contact}
                          </div>
                          <div className="text-sm">
                            <span className="font-medium">Phone:</span> {supplier.phone}
                          </div>
                          <div className="text-sm">
                            <span className="font-medium">Email:</span> {supplier.email}
                          </div>
                          <div className="text-sm">
                            <span className="font-medium">Delivery:</span> {supplier.deliveryTime} day(s)
                          </div>
                          <div className="text-sm">
                            <span className="font-medium">Payment:</span> {supplier.paymentTerms}
                          </div>
                        </div>
                        
                        <div className="mb-3">
                          <p className="text-sm font-medium text-gray-700 mb-1">Supplies:</p>
                          <div className="flex flex-wrap gap-1">
                            {supplier.items.map((item, index) => (
                              <Chip key={index} size="sm" variant="flat" color="secondary">
                                {item}
                              </Chip>
                            ))}
                          </div>
                        </div>
                        
                        <div className="flex gap-2">
                          <Button size="sm" color="primary" variant="flat">View Details</Button>
                          <Button size="sm" color="success" variant="flat">Place Order</Button>
                        </div>
                      </CardBody>
                    </Card>
                  ))}
                </div>
              </div>
            </Tab>

            <Tab key="purchase-orders" title="📋 Purchase Orders">
              <div className="p-6">
                <Table aria-label="Purchase orders table">
                  <TableHeader>
                    <TableColumn>ORDER ID</TableColumn>
                    <TableColumn>SUPPLIER</TableColumn>
                    <TableColumn>ITEMS</TableColumn>
                    <TableColumn>TOTAL COST</TableColumn>
                    <TableColumn>STATUS</TableColumn>
                    <TableColumn>ORDER DATE</TableColumn>
                    <TableColumn>EXPECTED DELIVERY</TableColumn>
                    <TableColumn>ACTIONS</TableColumn>
                  </TableHeader>
                  <TableBody>
                    {purchaseOrders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell className="font-medium">{order.id}</TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium text-ghana-black">{order.supplier}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {order.items.length} items
                            <p className="text-gray-500 text-xs">
                              {order.items.map(item => item.item).join(', ')}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="font-bold">₵{order.totalCost.toFixed(2)}</TableCell>
                        <TableCell>
                          <Chip color={getOrderStatusColor(order.status)} size="sm">
                            {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                          </Chip>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {order.orderDate.toLocaleDateString()}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {order.expectedDelivery.toLocaleDateString()}
                            {order.actualDelivery && (
                              <p className="text-green-600 text-xs">
                                Delivered: {order.actualDelivery.toLocaleDateString()}
                              </p>
                            )}
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
              </div>
            </Tab>
          </Tabs>
        </CardBody>
      </Card>

      {/* New Menu Item Modal */}
      <Modal isOpen={isNewMenuItemModalOpen} onClose={() => setIsNewMenuItemModalOpen(false)} size="3xl">
        <ModalContent>
          <ModalHeader>Add New Menu Item</ModalHeader>
          <ModalBody>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input label="Item Name" placeholder="Enter item name" />
                <Select label="Category" placeholder="Select category">
                  <SelectItem key="appetizer" value="appetizer">Appetizer</SelectItem>
                  <SelectItem key="main-course" value="main-course">Main Course</SelectItem>
                  <SelectItem key="beverage" value="beverage">Beverage</SelectItem>
                  <SelectItem key="dessert" value="dessert">Dessert</SelectItem>
                </Select>
              </div>
              
              <Input label="Description" placeholder="Enter item description" />
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Input label="Price (₵)" type="number" placeholder="0.00" />
                <Input label="Cost (₵)" type="number" placeholder="0.00" />
                <Input label="Preparation Time (min)" type="number" placeholder="15" />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input label="Allergens" placeholder="e.g., Peanuts, Fish, Gluten" />
                <Select label="Seasonal Item" placeholder="Select">
                  <SelectItem key="yes" value="yes">Yes</SelectItem>
                  <SelectItem key="no" value="no">No</SelectItem>
                </Select>
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button color="danger" variant="light" onPress={() => setIsNewMenuItemModalOpen(false)}>
              Cancel
            </Button>
            <Button color="primary" className="bg-ghana-green text-white" onPress={() => setIsNewMenuItemModalOpen(false)}>
              Add Menu Item
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* New Inventory Item Modal */}
      <Modal isOpen={isNewInventoryItemModalOpen} onClose={() => setIsNewInventoryItemModalOpen(false)} size="2xl">
        <ModalContent>
          <ModalHeader>Add New Inventory Item</ModalHeader>
          <ModalBody>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input label="Item Name" placeholder="Enter item name" />
                <Select label="Category" placeholder="Select category">
                  <SelectItem key="grains" value="grains">Grains</SelectItem>
                  <SelectItem key="meat" value="meat">Meat</SelectItem>
                  <SelectItem key="fish" value="fish">Fish</SelectItem>
                  <SelectItem key="vegetables" value="vegetables">Vegetables</SelectItem>
                  <SelectItem key="oils" value="oils">Oils</SelectItem>
                </Select>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Input label="Current Stock" type="number" placeholder="0" />
                <Input label="Minimum Stock" type="number" placeholder="0" />
                <Input label="Maximum Stock" type="number" placeholder="0" />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Input label="Unit" placeholder="e.g., kg, L, pcs" />
                <Input label="Cost per Unit (₵)" type="number" placeholder="0.00" />
                <Select label="Supplier" placeholder="Select supplier">
                  {suppliers.map((supplier) => (
                    <SelectItem key={supplier.id} value={supplier.name}>
                      {supplier.name}
                    </SelectItem>
                  ))}
                </Select>
              </div>
              
              <Input label="Storage Location" placeholder="e.g., Storage A, Freezer B" />
            </div>
          </ModalBody>
          <ModalFooter>
            <Button color="danger" variant="light" onPress={() => setIsNewInventoryItemModalOpen(false)}>
              Cancel
            </Button>
            <Button color="primary" className="bg-ghana-green text-white" onPress={() => setIsNewInventoryItemModalOpen(false)}>
              Add Inventory Item
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* New Purchase Order Modal */}
      <Modal isOpen={isNewPurchaseOrderModalOpen} onClose={() => setIsNewPurchaseOrderModalOpen(false)} size="2xl">
        <ModalContent>
          <ModalHeader>Create New Purchase Order</ModalHeader>
          <ModalBody>
            <div className="space-y-4">
              <Select label="Supplier" placeholder="Select supplier">
                {suppliers.map((supplier) => (
                  <SelectItem key={supplier.id} value={supplier.name}>
                    {supplier.name}
                  </SelectItem>
                ))}
              </Select>
              
              <Input label="Expected Delivery Date" type="date" />
              
              <div className="space-y-2">
                <p className="text-sm font-medium">Order Items:</p>
                <div className="space-y-2">
                  {inventoryItems.filter(item => item.status === 'low' || item.status === 'out').map((item) => (
                    <div key={item.id} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                      <input type="checkbox" className="rounded" />
                      <span className="flex-1 text-sm">{item.name}</span>
                      <span className="text-sm text-gray-600">Current: {item.currentStock} {item.unit}</span>
                      <Input size="sm" type="number" placeholder="Qty" className="w-20" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button color="danger" variant="light" onPress={() => setIsNewPurchaseOrderModalOpen(false)}>
              Cancel
            </Button>
            <Button color="primary" className="bg-ghana-green text-white" onPress={() => setIsNewPurchaseOrderModalOpen(false)}>
              Create Order
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
