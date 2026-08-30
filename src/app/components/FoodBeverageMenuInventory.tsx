'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardBody, Button, Input, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, Chip, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Select, SelectItem, Badge, Tabs, Tab } from "@heroui/react";
import { getClientTenantSubdomain } from '../lib/api/clientTenant';

function fbHeaders() {
  return { 'Content-Type': 'application/json', 'x-tenant-subdomain': getClientTenantSubdomain() };
}

interface MenuItem {
  id: string;
  code: string;
  name: string;
  description: string;
  category: string;
  venue: string;
  price: number;
  cost: number;
  profitMargin: number;
  available: boolean;
  preparationTime: number;
  allergens: string[];
}

interface InventoryItem {
  id: string;
  code: string;
  name: string;
  description: string;
  category: string;
  unit: string;
  defaultCost: number;
  sellingPrice: number;
  isActive: boolean;
}

interface Supplier {
  id: string;
  code: string;
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
}

interface PurchaseOrder {
  id: string;
  poNumber: string;
  supplierId: string;
  supplierName: string;
  items: PurchaseOrderItem[];
  totalCost: number;
  status: 'draft' | 'sent' | 'confirmed' | 'in-transit' | 'delivered' | 'cancelled' | 'closed';
  orderDate: Date;
  expectedDelivery?: Date;
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
  const [isNewSupplierModalOpen, setIsNewSupplierModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedInventoryStatus, setSelectedInventoryStatus] = useState('all');

  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const reloadMenu = () => {
    fetch('/api/fb/menu', { headers: fbHeaders() })
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((data) => setMenuItems((data.items || []).map((i: any) => {
        const price = Number(i.unitPrice || 0);
        const cost = Number(i.costPrice || 0);
        return {
          id: i.id,
          code: i.code,
          name: i.name,
          description: i.description || '',
          category: i.category,
          venue: i.venue,
          price,
          cost,
          profitMargin: price > 0 ? ((price - cost) / price) * 100 : 0,
          available: i.isAvailable,
          preparationTime: i.prepMinutes,
          allergens: i.allergens ? i.allergens.split(',').map((a: string) => a.trim()).filter(Boolean) : [],
        };
      })));
  };
  useEffect(() => { reloadMenu(); }, []);

  const [menuForm, setMenuForm] = useState({ name: '', category: 'main-course', venue: 'restaurant', description: '', price: '0', cost: '0', prepTime: '15', allergens: '' });
  const submitMenuItem = async () => {
    if (!menuForm.name) return;
    const code = menuForm.name.toUpperCase().replace(/[^A-Z0-9]+/g, '-').slice(0, 20) + '-' + Date.now().toString().slice(-4);
    const res = await fetch('/api/fb/menu', {
      method: 'POST',
      headers: fbHeaders(),
      body: JSON.stringify({
        code,
        name: menuForm.name,
        description: menuForm.description,
        category: menuForm.category,
        venue: menuForm.venue,
        unitPrice: Number(menuForm.price) || 0,
        costPrice: Number(menuForm.cost) || 0,
        prepMinutes: Number(menuForm.prepTime) || 10,
        allergens: menuForm.allergens || undefined,
      }),
    });
    if (res.ok) {
      setMenuForm({ name: '', category: 'main-course', venue: 'restaurant', description: '', price: '0', cost: '0', prepTime: '15', allergens: '' });
      setIsNewMenuItemModalOpen(false);
      reloadMenu();
    }
  };
  const toggleMenuItemAvailability = async (item: MenuItem) => {
    await fetch('/api/fb/menu', {
      method: 'PATCH',
      headers: fbHeaders(),
      body: JSON.stringify({ id: item.id, isAvailable: !item.available }),
    });
    reloadMenu();
  };


  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const reloadInventoryItems = () => {
    fetch('/api/inventory/items', { headers: fbHeaders() })
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((data) => setInventoryItems((data.items || []).map((i: any) => ({
        id: i.id,
        code: i.code,
        name: i.name,
        description: i.description || '',
        category: i.category?.name || '—',
        unit: i.unit?.name || '—',
        defaultCost: Number(i.defaultCost || 0),
        sellingPrice: Number(i.sellingPrice || 0),
        isActive: i.isActive,
      }))));
  };

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const reloadSuppliers = () => {
    fetch('/api/inventory/suppliers', { headers: fbHeaders() })
      .then((r) => (r.ok ? r.json() : { suppliers: [] }))
      .then((data) => setSuppliers((data.suppliers || []).map((s: any) => ({
        id: s.id,
        code: s.code,
        name: s.name,
        contactPerson: s.contactPerson || '',
        phone: s.phone || '',
        email: s.email || '',
      }))));
  };

  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const reloadPurchaseOrders = () => {
    fetch('/api/inventory/purchase-orders', { headers: fbHeaders() })
      .then((r) => (r.ok ? r.json() : { orders: [] }))
      .then((data) => setPurchaseOrders((data.orders || []).map((o: any) => ({
        id: o.id,
        poNumber: o.poNumber,
        supplierId: o.supplierId,
        supplierName: o.supplierName,
        items: (o.items || []).map((it: any) => ({ item: it.itemName, quantity: it.quantity, unitCost: Number(it.unitCost), totalCost: Number(it.totalCost) })),
        totalCost: Number(o.finalAmount ?? o.totalAmount ?? 0),
        status: o.status,
        orderDate: new Date(o.orderDate || o.createdAt),
        expectedDelivery: o.expectedDeliveryDate ? new Date(o.expectedDeliveryDate) : undefined,
        actualDelivery: o.actualDeliveryDate ? new Date(o.actualDeliveryDate) : undefined,
      }))));
  };

  useEffect(() => { reloadInventoryItems(); reloadSuppliers(); reloadPurchaseOrders(); }, []);

  const [inventoryForm, setInventoryForm] = useState({ name: '', description: '', defaultCost: '0', sellingPrice: '0' });
  const submitInventoryItem = async () => {
    if (!inventoryForm.name) return;
    const code = inventoryForm.name.toUpperCase().replace(/[^A-Z0-9]+/g, '-').slice(0, 20) + '-' + Date.now().toString().slice(-4);
    const res = await fetch('/api/inventory/items', {
      method: 'POST',
      headers: fbHeaders(),
      body: JSON.stringify({ code, name: inventoryForm.name, description: inventoryForm.description, defaultCost: Number(inventoryForm.defaultCost) || 0, sellingPrice: Number(inventoryForm.sellingPrice) || 0 }),
    });
    if (res.ok) {
      setInventoryForm({ name: '', description: '', defaultCost: '0', sellingPrice: '0' });
      setIsNewInventoryItemModalOpen(false);
      reloadInventoryItems();
    }
  };

  const [supplierForm, setSupplierForm] = useState({ name: '', contactPerson: '', phone: '', email: '' });
  const submitSupplier = async () => {
    if (!supplierForm.name) return;
    const id = `SUP-${Date.now().toString().slice(-8)}`;
    const res = await fetch('/api/inventory/suppliers', { method: 'POST', headers: fbHeaders(), body: JSON.stringify({ id, ...supplierForm }) });
    if (res.ok) {
      setSupplierForm({ name: '', contactPerson: '', phone: '', email: '' });
      setIsNewSupplierModalOpen(false);
      reloadSuppliers();
    }
  };

  const [poSupplierId, setPoSupplierId] = useState('');
  const [poExpectedDelivery, setPoExpectedDelivery] = useState('');
  const [poQuantities, setPoQuantities] = useState<Record<string, string>>({});
  const submitPurchaseOrder = async () => {
    const supplier = suppliers.find((s) => s.id === poSupplierId);
    if (!supplier) return;
    const items = inventoryItems
      .filter((it) => Number(poQuantities[it.id]) > 0)
      .map((it) => ({ itemId: it.id, itemCode: it.code, itemName: it.name, quantity: Number(poQuantities[it.id]), unitCost: it.defaultCost }));
    if (items.length === 0) return;
    const res = await fetch('/api/inventory/purchase-orders', {
      method: 'POST',
      headers: fbHeaders(),
      body: JSON.stringify({ supplierId: supplier.id, supplierName: supplier.name, expectedDeliveryDate: poExpectedDelivery || undefined, items }),
    });
    if (res.ok) {
      setPoSupplierId('');
      setPoExpectedDelivery('');
      setPoQuantities({});
      setIsNewPurchaseOrderModalOpen(false);
      reloadPurchaseOrders();
    }
  };

  const getOrderStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'default';
      case 'sent': return 'warning';
      case 'confirmed': return 'primary';
      case 'in-transit': return 'secondary';
      case 'delivered': return 'success';
      case 'closed': return 'success';
      case 'cancelled': return 'danger';
      default: return 'default';
    }
  };

  const filteredMenuItems = selectedCategory === 'all'
    ? menuItems 
    : menuItems.filter(item => item.category === selectedCategory);

  // Stock quantity isn't tracked anywhere real yet (see the Inventory & Stores
  // module's stockStore.ts — same gap, flagged separately), so this view is
  // scoped to the real item catalog (code/name/cost) rather than live stock
  // levels/status, which this session confirmed have no backing data.
  const filteredInventoryItems = selectedInventoryStatus === 'all'
    ? inventoryItems
    : inventoryItems.filter(item => (selectedInventoryStatus === 'active' ? item.isActive : !item.isActive));

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
                <p className="text-sm text-gray-500">{inventoryItems.filter(i => i.isActive).length} active</p>
              </div>
              <div className="text-3xl">📦</div>
            </div>
          </CardBody>
        </Card>

        <Card className="border-0 shadow-lg">
          <CardBody className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Purchase Orders</p>
                <p className="text-2xl font-bold text-ghana-black">{purchaseOrders.length}</p>
                <p className="text-sm text-blue-600">₵{purchaseOrders.reduce((s, o) => s + o.totalCost, 0).toFixed(2)} total</p>
              </div>
              <div className="text-3xl">📋</div>
            </div>
          </CardBody>
        </Card>

        <Card className="border-0 shadow-lg">
          <CardBody className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Suppliers</p>
                <p className="text-2xl font-bold text-ghana-black">{suppliers.length}</p>
                <p className="text-sm text-gray-500">On file</p>
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
                    <SelectItem key="all">All Categories</SelectItem>
                    <SelectItem key="food">Food</SelectItem>
                    <SelectItem key="beverage">Beverage</SelectItem>
                    <SelectItem key="dessert">Dessert</SelectItem>
                    <SelectItem key="snack">Snack</SelectItem>
                    <SelectItem key="special">Special</SelectItem>
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

                        <div className="flex gap-2">
                          <Button size="sm" color="secondary" variant="flat" onPress={() => toggleMenuItemAvailability(item)}>
                            {item.available ? 'Mark Unavailable' : 'Mark Available'}
                          </Button>
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
                    placeholder="All Items"
                    value={selectedInventoryStatus}
                    onChange={(e) => setSelectedInventoryStatus(e.target.value)}
                    className="w-64"
                  >
                    <SelectItem key="all">All Items</SelectItem>
                    <SelectItem key="active">Active</SelectItem>
                    <SelectItem key="inactive">Inactive</SelectItem>
                  </Select>
                </div>
                <p className="text-xs text-gray-500 mb-3">
                  Stock quantity isn't tracked yet — this is the real item catalog (code, name, cost). Full stock-level tracking is a separate, larger fix.
                </p>

                <Table aria-label="Inventory table">
                  <TableHeader>
                    <TableColumn>ITEM</TableColumn>
                    <TableColumn>CATEGORY</TableColumn>
                    <TableColumn>UNIT</TableColumn>
                    <TableColumn>DEFAULT COST</TableColumn>
                    <TableColumn>SELLING PRICE</TableColumn>
                    <TableColumn>STATUS</TableColumn>
                  </TableHeader>
                  <TableBody>
                    {filteredInventoryItems.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium text-ghana-black">{item.name}</p>
                            <p className="text-sm text-gray-600">{item.code}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge color="primary" variant="flat">{item.category}</Badge>
                        </TableCell>
                        <TableCell>{item.unit}</TableCell>
                        <TableCell>₵{item.defaultCost.toFixed(2)}</TableCell>
                        <TableCell>₵{item.sellingPrice.toFixed(2)}</TableCell>
                        <TableCell>
                          <Chip color={item.isActive ? 'success' : 'default'} size="sm">
                            {item.isActive ? 'Active' : 'Inactive'}
                          </Chip>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Tab>

            <Tab key="suppliers" title="🏢 Supplier Management">
              <div className="p-6">
                <div className="flex justify-end mb-4">
                  <Button color="success" className="bg-blue-500 text-white" onClick={() => setIsNewSupplierModalOpen(true)}>
                    + Add Supplier
                  </Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {suppliers.map((supplier) => (
                    <Card key={supplier.id} className="border border-gray-200 hover:border-ghana-green transition-colors">
                      <CardBody className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-semibold text-ghana-black">{supplier.name}</h4>
                          <Chip size="sm" variant="flat">{supplier.code}</Chip>
                        </div>

                        <div className="space-y-2 mb-3">
                          <div className="text-sm">
                            <span className="font-medium">Contact:</span> {supplier.contactPerson || '—'}
                          </div>
                          <div className="text-sm">
                            <span className="font-medium">Phone:</span> {supplier.phone || '—'}
                          </div>
                          <div className="text-sm">
                            <span className="font-medium">Email:</span> {supplier.email || '—'}
                          </div>
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
                    <TableColumn>ORDER #</TableColumn>
                    <TableColumn>SUPPLIER</TableColumn>
                    <TableColumn>ITEMS</TableColumn>
                    <TableColumn>TOTAL COST</TableColumn>
                    <TableColumn>STATUS</TableColumn>
                    <TableColumn>ORDER DATE</TableColumn>
                    <TableColumn>EXPECTED DELIVERY</TableColumn>
                  </TableHeader>
                  <TableBody>
                    {purchaseOrders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell className="font-medium">{order.poNumber}</TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium text-ghana-black">{order.supplierName}</p>
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
                            {order.expectedDelivery ? order.expectedDelivery.toLocaleDateString() : '—'}
                            {order.actualDelivery && (
                              <p className="text-green-600 text-xs">
                                Delivered: {order.actualDelivery.toLocaleDateString()}
                              </p>
                            )}
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
                <Input label="Item Name" placeholder="Enter item name" value={menuForm.name} onChange={(e) => setMenuForm({ ...menuForm, name: e.target.value })} />
                <Select label="Category" selectedKeys={[menuForm.category]} onSelectionChange={(k) => setMenuForm({ ...menuForm, category: (Array.from(k)[0] as string) || 'food' })}>
                  <SelectItem key="food">Food</SelectItem>
                  <SelectItem key="beverage">Beverage</SelectItem>
                  <SelectItem key="dessert">Dessert</SelectItem>
                  <SelectItem key="snack">Snack</SelectItem>
                  <SelectItem key="special">Special</SelectItem>
                </Select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Select label="Venue" selectedKeys={[menuForm.venue]} onSelectionChange={(k) => setMenuForm({ ...menuForm, venue: (Array.from(k)[0] as string) || 'restaurant' })}>
                  <SelectItem key="restaurant">Restaurant</SelectItem>
                  <SelectItem key="bar">Bar</SelectItem>
                  <SelectItem key="room_service">Room Service</SelectItem>
                  <SelectItem key="all">All Venues</SelectItem>
                </Select>
                <Input label="Description" placeholder="Enter item description" value={menuForm.description} onChange={(e) => setMenuForm({ ...menuForm, description: e.target.value })} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Input label="Price (₵)" type="number" placeholder="0.00" value={menuForm.price} onChange={(e) => setMenuForm({ ...menuForm, price: e.target.value })} />
                <Input label="Cost (₵)" type="number" placeholder="0.00" value={menuForm.cost} onChange={(e) => setMenuForm({ ...menuForm, cost: e.target.value })} />
                <Input label="Preparation Time (min)" type="number" placeholder="15" value={menuForm.prepTime} onChange={(e) => setMenuForm({ ...menuForm, prepTime: e.target.value })} />
              </div>

              <Input label="Allergens" placeholder="e.g., Peanuts, Fish, Gluten" value={menuForm.allergens} onChange={(e) => setMenuForm({ ...menuForm, allergens: e.target.value })} />
            </div>
          </ModalBody>
          <ModalFooter>
            <Button color="danger" variant="light" onPress={() => setIsNewMenuItemModalOpen(false)}>
              Cancel
            </Button>
            <Button color="primary" className="bg-ghana-green text-white" onPress={submitMenuItem} isDisabled={!menuForm.name}>
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
              <Input label="Item Name" placeholder="Enter item name" value={inventoryForm.name} onChange={(e) => setInventoryForm({ ...inventoryForm, name: e.target.value })} />
              <Input label="Description" placeholder="Optional" value={inventoryForm.description} onChange={(e) => setInventoryForm({ ...inventoryForm, description: e.target.value })} />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input label="Default Cost (₵)" type="number" placeholder="0.00" value={inventoryForm.defaultCost} onChange={(e) => setInventoryForm({ ...inventoryForm, defaultCost: e.target.value })} />
                <Input label="Selling Price (₵)" type="number" placeholder="0.00" value={inventoryForm.sellingPrice} onChange={(e) => setInventoryForm({ ...inventoryForm, sellingPrice: e.target.value })} />
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button color="danger" variant="light" onPress={() => setIsNewInventoryItemModalOpen(false)}>
              Cancel
            </Button>
            <Button color="primary" className="bg-ghana-green text-white" onPress={submitInventoryItem} isDisabled={!inventoryForm.name}>
              Add Inventory Item
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* New Supplier Modal */}
      <Modal isOpen={isNewSupplierModalOpen} onClose={() => setIsNewSupplierModalOpen(false)} size="lg">
        <ModalContent>
          <ModalHeader>Add Supplier</ModalHeader>
          <ModalBody>
            <div className="space-y-4">
              <Input label="Supplier Name" value={supplierForm.name} onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })} />
              <Input label="Contact Person" value={supplierForm.contactPerson} onChange={(e) => setSupplierForm({ ...supplierForm, contactPerson: e.target.value })} />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input label="Phone" value={supplierForm.phone} onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })} />
                <Input label="Email" type="email" value={supplierForm.email} onChange={(e) => setSupplierForm({ ...supplierForm, email: e.target.value })} />
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button color="danger" variant="light" onPress={() => setIsNewSupplierModalOpen(false)}>
              Cancel
            </Button>
            <Button color="primary" className="bg-ghana-green text-white" onPress={submitSupplier} isDisabled={!supplierForm.name}>
              Add Supplier
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
              <Select label="Supplier" placeholder="Select supplier" selectedKeys={poSupplierId ? [poSupplierId] : []} onSelectionChange={(k) => setPoSupplierId((Array.from(k)[0] as string) || '')}>
                {suppliers.map((supplier) => (
                  <SelectItem key={supplier.id}>
                    {supplier.name}
                  </SelectItem>
                ))}
              </Select>

              <Input label="Expected Delivery Date" type="date" value={poExpectedDelivery} onChange={(e) => setPoExpectedDelivery(e.target.value)} />

              <div className="space-y-2">
                <p className="text-sm font-medium">Order Items (enter quantity to include):</p>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {inventoryItems.map((item) => (
                    <div key={item.id} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                      <span className="flex-1 text-sm">{item.name}</span>
                      <span className="text-sm text-gray-600">₵{item.defaultCost.toFixed(2)}/{item.unit}</span>
                      <Input
                        size="sm"
                        type="number"
                        placeholder="Qty"
                        className="w-20"
                        value={poQuantities[item.id] || ''}
                        onChange={(e) => setPoQuantities({ ...poQuantities, [item.id]: e.target.value })}
                      />
                    </div>
                  ))}
                  {inventoryItems.length === 0 && (
                    <p className="text-sm text-gray-500">No inventory items yet — add some in the Inventory Management tab first.</p>
                  )}
                </div>
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button color="danger" variant="light" onPress={() => setIsNewPurchaseOrderModalOpen(false)}>
              Cancel
            </Button>
            <Button color="primary" className="bg-ghana-green text-white" onPress={submitPurchaseOrder} isDisabled={!poSupplierId}>
              Create Order
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
