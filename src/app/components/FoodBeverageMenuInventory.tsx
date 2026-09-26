'use client';

import React, { useState, useEffect } from 'react';
import HeadingInfo from './HeadingInfo';
import { Card, CardBody, Button, Input, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, Chip, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Select, SelectItem, Badge, Tabs, Tab } from "@heroui/react";
import { getClientTenantSubdomain } from '../lib/api/clientTenant';
import DepartmentRequisitionModal from './inventory/DepartmentRequisitionModal';

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
  usedCount: number;
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

interface Requisition {
  id: string;
  requisitionNumber: string;
  requestedBy: string;
  requestedDate: Date;
  status: 'pending' | 'approved' | 'ready' | 'rejected' | 'converted-to-po' | 'cancelled';
  notes: string;
  items: { itemName: string; quantity: number }[];
}

export default function FoodBeverageMenuInventory({ panel }: { panel?: 'menu' | 'inventory' | 'requisitions' }) {
  const [selectedTab, setSelectedTab] = useState('menu');
  const [isNewMenuItemModalOpen, setIsNewMenuItemModalOpen] = useState(false);
  const [viewingMenuId, setViewingMenuId] = useState<string | null>(null);
  const [isNewInventoryItemModalOpen, setIsNewInventoryItemModalOpen] = useState(false);
  const [isNewRequisitionModalOpen, setIsNewRequisitionModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedInventoryStatus, setSelectedInventoryStatus] = useState('all');

  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const reloadMenu = () => {
    fetch('/api/fb/menu?includeUsage=true', { headers: fbHeaders() })
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
          usedCount: Number(i.usedCount || 0),
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

  const handleRemoveMenuItem = async (item: MenuItem) => {
    if (item.usedCount > 0) {
      if (!item.available) {
        alert(`${item.name} has ${item.usedCount} order line${item.usedCount === 1 ? '' : 's'} and cannot be deleted. It is already unavailable.`);
        return;
      }
      if (
        !confirm(
          `${item.name} has ${item.usedCount} order line${item.usedCount === 1 ? '' : 's'} and cannot be deleted. Mark it Unavailable so it stays off new orders but history is kept?`
        )
      ) {
        return;
      }
      await fetch('/api/fb/menu', {
        method: 'PATCH',
        headers: fbHeaders(),
        body: JSON.stringify({ id: item.id, isAvailable: false }),
      });
      reloadMenu();
      return;
    }
    if (!confirm(`Delete ${item.name}? This action cannot be undone.`)) return;
    await fetch(`/api/fb/menu?id=${encodeURIComponent(item.id)}`, { method: 'DELETE', headers: fbHeaders() });
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

  const [requisitions, setRequisitions] = useState<Requisition[]>([]);
  const [requisitionStatusFilter, setRequisitionStatusFilter] = useState('all');
  const reloadRequisitions = () => {
    fetch('/api/inventory/requisitions?department=restaurant', { headers: fbHeaders() })
      .then((r) => (r.ok ? r.json() : { requisitions: [] }))
      .then((data) => setRequisitions((data.requisitions || []).map((req: any) => ({
        id: req.id,
        requisitionNumber: req.requisitionNumber,
        requestedBy: req.requestedBy,
        requestedDate: new Date(req.requestedDate || req.createdAt),
        status: req.status,
        notes: req.notes || '',
        items: (req.items || []).map((it: any) => ({ itemName: it.itemName, quantity: Number(it.quantity) })),
      }))));
  };

  // Real, ledger-derived on-hand for THIS department — see getLocationStockLevels.
  // Populated by requisitions Stores has approved and fulfilled (transfers stock
  // from the shared central pool into Restaurant & Bar's own location).
  const [stockOnHand, setStockOnHand] = useState<Record<string, number>>({});
  const reloadStockLevels = () => {
    fetch('/api/inventory/stock-levels?department=restaurant', { headers: fbHeaders() })
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((data) => setStockOnHand(Object.fromEntries((data.items || []).map((i: any) => [i.id, Number(i.onHand || 0)]))));
  };

  useEffect(() => { reloadInventoryItems(); reloadRequisitions(); reloadStockLevels(); }, []);

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

  const getRequisitionStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'warning';
      case 'approved': return 'primary';
      case 'ready': return 'success';
      case 'converted-to-po': return 'secondary';
      case 'rejected': return 'danger';
      case 'cancelled': return 'default';
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

  const embedded = Boolean(panel);
  const openMenuItem = viewingMenuId ? menuItems.find((item) => item.id === viewingMenuId) ?? null : null;

  return (
    <div className={embedded ? 'p-2' : 'p-6'}>
      {/* Header */}
      {!embedded && (
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-1.5">
            <h2 className="text-2xl font-bold text-ghana-black">🍽️ Restaurant & Bar - Menu & Inventory</h2>
            <HeadingInfo label="About menu and inventory">Manage menu items, inventory items, and stock requisitions to Stores</HeadingInfo>
          </div>
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
            onClick={() => setIsNewRequisitionModalOpen(true)}
          >
            + Request Stock
          </Button>
        </div>
      </div>
      )}

      {/* Stats Overview */}
      {!embedded && (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
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
                <p className="text-sm font-medium text-gray-600">Requisitions</p>
                <p className="text-2xl font-bold text-ghana-black">{requisitions.length}</p>
                <p className="text-sm text-amber-600">{requisitions.filter(r => r.status === 'pending').length} pending</p>
              </div>
              <div className="text-3xl">📝</div>
            </div>
          </CardBody>
        </Card>
      </div>
      )}

      {/* Main Content Tabs */}
      <Card className="border-0 shadow-lg">
        <CardBody className="p-0">
          <Tabs 
            selectedKey={panel || selectedTab} 
            onSelectionChange={(key) => { if (!embedded) setSelectedTab(key as string); }}
            className="w-full"
            classNames={embedded ? { tabList: 'hidden', panel: 'p-0' } : undefined}
          >
            {(!embedded || panel === 'menu') && (
            <Tab key="menu" title="🍽️ Menu Management">
              <div className="p-6">
                {embedded && (
                  <div className="flex justify-end mb-4">
                    <Button color="primary" className="bg-ghana-green text-white" onClick={() => setIsNewMenuItemModalOpen(true)}>
                      + Add Menu Item
                    </Button>
                  </div>
                )}
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

                        <Button size="sm" variant="flat" onPress={() => setViewingMenuId(item.id)}>View</Button>
                      </CardBody>
                    </Card>
                  ))}
                </div>
              </div>
            </Tab>
            )}

            {(!embedded || panel === 'inventory') && (
            <Tab key="inventory" title="📦 Inventory Management">
              <div className="p-6">
                {embedded && (
                  <div className="flex justify-end mb-4">
                    <Button color="secondary" className="bg-ghana-gold text-white" onClick={() => setIsNewInventoryItemModalOpen(true)}>
                      + Add Inventory Item
                    </Button>
                  </div>
                )}
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
                  On Hand is Restaurant & Bar's own real stock — built up from requisitions Stores has approved and fulfilled. It's separate from what Stores or Kitchen hold; request more via the Requisitions tab.
                </p>

                <Table aria-label="Inventory table">
                  <TableHeader>
                    <TableColumn>ITEM</TableColumn>
                    <TableColumn>CATEGORY</TableColumn>
                    <TableColumn>ON HAND</TableColumn>
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
                        <TableCell>
                          <span className={(stockOnHand[item.id] ?? 0) <= 0 ? 'text-danger font-semibold' : 'font-semibold'}>
                            {stockOnHand[item.id] ?? 0}
                          </span>
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
            )}

            {(!embedded || panel === 'requisitions') && (
            <Tab key="requisitions" title="📝 Requisitions">
              <div className="p-6">
                <p className="text-xs text-gray-500 mb-3">
                  Request stock from Stores — Restaurant & Bar doesn't manage suppliers or purchase orders directly. Stores approves it, then marks it <strong>Ready</strong> once it's pulled and staged for pickup (that's also when it lands in your Inventory Management on-hand); until then it's still just approved and you're waiting on it.
                </p>
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <Select
                    aria-label="Filter requisitions by status"
                    label="Status"
                    size="sm"
                    className="w-44"
                    selectedKeys={[requisitionStatusFilter]}
                    onSelectionChange={(keys) => {
                      const next = Array.from(keys)[0] as string;
                      if (next) setRequisitionStatusFilter(next);
                    }}
                  >
                    <SelectItem key="all">All statuses</SelectItem>
                    <SelectItem key="pending">Pending</SelectItem>
                    <SelectItem key="approved">Approved</SelectItem>
                    <SelectItem key="ready">Ready</SelectItem>
                    <SelectItem key="rejected">Rejected</SelectItem>
                  </Select>
                  <Button color="success" className="bg-blue-500 text-white" onClick={() => setIsNewRequisitionModalOpen(true)}>
                    + Request Stock
                  </Button>
                </div>
                <Table aria-label="Requisitions table">
                  <TableHeader>
                    <TableColumn>REQUISITION #</TableColumn>
                    <TableColumn>ITEMS</TableColumn>
                    <TableColumn>REQUESTED BY</TableColumn>
                    <TableColumn>REQUESTED DATE</TableColumn>
                    <TableColumn>STATUS</TableColumn>
                  </TableHeader>
                  <TableBody emptyContent={requisitions.length === 0 ? 'No requisitions yet — request stock from Stores using the button above.' : 'No requisitions match this status.'}>
                    {[...(requisitionStatusFilter === 'all' ? requisitions : requisitions.filter((req) => req.status === requisitionStatusFilter))]
                      .sort((a, b) => b.requestedDate.getTime() - a.requestedDate.getTime())
                      .map((req) => (
                      <TableRow key={req.id}>
                        <TableCell className="font-medium">{req.requisitionNumber}</TableCell>
                        <TableCell>
                          <div className="text-sm max-w-xs">
                            <p className="font-medium">
                              {req.items.length} {req.items.length === 1 ? 'item' : 'items'}
                            </p>
                            <p className="text-gray-500 text-xs" title={req.items.map(item => `${item.itemName} (${item.quantity})`).join(', ')}>
                              {req.items.slice(0, 2).map(item => `${item.itemName} (${item.quantity})`).join(', ')}
                              {req.items.length > 2 ? ` +${req.items.length - 2} more` : ''}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>{req.requestedBy}</TableCell>
                        <TableCell>
                          <div className="text-sm">{req.requestedDate.toLocaleDateString()}</div>
                        </TableCell>
                        <TableCell>
                          <Chip color={getRequisitionStatusColor(req.status)} size="sm">
                            {req.status.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                          </Chip>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {requisitions.length === 0 && (
                  <p className="text-sm text-gray-500 text-center py-6">No requisitions yet — request stock from Stores using the button above.</p>
                )}
              </div>
            </Tab>
            )}
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

      <Modal isOpen={!!openMenuItem} onClose={() => setViewingMenuId(null)} size="lg">
        <ModalContent>
          <ModalHeader>{openMenuItem?.name}</ModalHeader>
          <ModalBody>
            {openMenuItem && (
              <div className="space-y-2 text-sm">
                <p><span className="text-gray-500">Status</span> · {openMenuItem.available ? 'Available' : 'Unavailable'}</p>
                <p><span className="text-gray-500">Price</span> · ₵{openMenuItem.price.toFixed(2)}</p>
                <p><span className="text-gray-500">Cost</span> · ₵{openMenuItem.cost.toFixed(2)}</p>
                <p><span className="text-gray-500">Margin</span> · {openMenuItem.profitMargin.toFixed(1)}%</p>
                <p><span className="text-gray-500">Prep</span> · {openMenuItem.preparationTime} min</p>
                <p><span className="text-gray-500">Orders</span> · {openMenuItem.usedCount}</p>
                {openMenuItem.description && <p>{openMenuItem.description}</p>}
                {openMenuItem.allergens.length > 0 && openMenuItem.allergens[0] !== 'None' && (
                  <p><span className="text-gray-500">Allergens</span> · {openMenuItem.allergens.join(', ')}</p>
                )}
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            {openMenuItem && (
              <Button color="secondary" variant="flat" onPress={() => toggleMenuItemAvailability(openMenuItem)}>
                {openMenuItem.available ? 'Mark Unavailable' : 'Mark Available'}
              </Button>
            )}
            {openMenuItem && (
              <Button
                color={openMenuItem.usedCount > 0 ? 'warning' : 'danger'}
                variant="flat"
                onPress={() => handleRemoveMenuItem(openMenuItem)}
              >
                {openMenuItem.usedCount > 0 ? (openMenuItem.available ? 'Deactivate' : 'Already inactive') : 'Delete'}
              </Button>
            )}
            <Button variant="light" onPress={() => setViewingMenuId(null)}>Close</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <DepartmentRequisitionModal
        isOpen={isNewRequisitionModalOpen}
        onClose={() => setIsNewRequisitionModalOpen(false)}
        department="restaurant"
        departmentLabel="Restaurant & Bar"
        inventoryItems={inventoryItems}
        onCreated={() => { reloadRequisitions(); reloadStockLevels(); }}
      />
    </div>
  );
}
