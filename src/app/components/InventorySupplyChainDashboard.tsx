'use client';

import React, { useState } from 'react';
import { 
  Card, CardBody, CardHeader, Button, Badge, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, 
  Tabs, Tab, Chip
} from '@heroui/react';
import { useSettingsStore } from '../lib/settings/store';
import { trackEvent } from '../lib/analytics/trackEvent';

interface InventoryItem {
  id: string;
  itemCode: string;
  name: string;
  category: 'food-beverage' | 'housekeeping' | 'maintenance' | 'office-supplies' | 'uniforms' | 'other';
  currentStock: number;
  reorderPoint: number;
  costPrice: number;
  supplier: string;
  status: 'active' | 'inactive' | 'discontinued';
}

interface Supplier {
  id: string;
  supplierCode: string;
  name: string;
  contactPerson: string;
  email: string;
  phone: string;
  rating: number;
  status: 'active' | 'inactive' | 'blacklisted';
  categories: string[];
}

interface PurchaseOrder {
  id: string;
  poNumber: string;
  supplierName: string;
  orderDate: string;
  expectedDelivery: string;
  status: 'draft' | 'sent' | 'confirmed' | 'partially-received' | 'received' | 'cancelled';
  totalAmount: number;
  totalWithTax: number;
}

export default function InventorySupplyChainDashboard() {
  const [selectedTab, setSelectedTab] = useState('overview');
  const settings = useSettingsStore();

  // Sample data
  const inventoryItems: InventoryItem[] = [
    {
      id: '1',
      itemCode: 'FB-001',
      name: 'Premium Coffee Beans',
      category: 'food-beverage',
      currentStock: 45.5,
      reorderPoint: 20,
      costPrice: 25.00,
      supplier: 'Coffee Suppliers Ltd',
      status: 'active'
    },
    {
      id: '2',
      itemCode: 'HK-001',
      name: 'Luxury Bed Linens',
      category: 'housekeeping',
      currentStock: 120,
      reorderPoint: 50,
      costPrice: 45.00,
      supplier: 'Textile Importers Ghana',
      status: 'active'
    }
  ];

  const suppliers: Supplier[] = [
    {
      id: '1',
      supplierCode: 'SUP-001',
      name: 'Coffee Suppliers Ltd',
      contactPerson: 'Kwame Addo',
      email: 'kwame@coffeesuppliers.com',
      phone: '+233 24 123 4567',
      rating: 4.5,
      status: 'active',
      categories: ['food-beverage']
    },
    {
      id: '2',
      supplierCode: 'SUP-002',
      name: 'Textile Importers Ghana',
      contactPerson: 'Ama Osei',
      email: 'ama@textileimporters.com',
      phone: '+233 26 234 5678',
      rating: 4.2,
      status: 'active',
      categories: ['housekeeping', 'uniforms']
    }
  ];

  const purchaseOrders: PurchaseOrder[] = [
    {
      id: '1',
      poNumber: 'PO-2024-001',
      supplierName: 'Coffee Suppliers Ltd',
      orderDate: '2024-01-15',
      expectedDelivery: '2024-01-22',
      status: 'confirmed',
      totalAmount: 2500.00,
      totalWithTax: 2875.00
    },
    {
      id: '2',
      poNumber: 'PO-2024-002',
      supplierName: 'Textile Importers Ghana',
      orderDate: '2024-01-16',
      expectedDelivery: '2024-01-30',
      status: 'sent',
      totalAmount: 4500.00,
      totalWithTax: 5175.00
    }
  ];

  // Calculate metrics
  const totalItems = inventoryItems.length;
  const lowStockItems = inventoryItems.filter(item => item.currentStock <= item.reorderPoint).length;
  const totalStockValue = inventoryItems.reduce((sum, item) => sum + (item.currentStock * item.costPrice), 0);
  const activeSuppliers = suppliers.filter(s => s.status === 'active').length;
  const pendingPOs = purchaseOrders.filter(po => po.status === 'sent' || po.status === 'confirmed').length;

  const renderOverview = () => (
    <div className="space-y-6">
      {/* Inventory Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="border-0 shadow-lg">
          <CardBody className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Items</p>
                <p className="text-2xl font-bold text-ghana-black">{totalItems}</p>
                <p className="text-sm text-blue-600">In inventory</p>
              </div>
              <div className="text-3xl">📦</div>
            </div>
          </CardBody>
        </Card>
        
        <Card className="border-0 shadow-lg">
          <CardBody className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Low Stock Items</p>
                <p className="text-2xl font-bold text-orange-600">{lowStockItems}</p>
                <p className="text-sm text-orange-600">Need reordering</p>
              </div>
              <div className="text-3xl">⚠️</div>
            </div>
          </CardBody>
        </Card>
        
        <Card className="border-0 shadow-lg">
          <CardBody className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Stock Value</p>
                <p className="text-2xl font-bold text-ghana-black">₵{totalStockValue.toLocaleString()}</p>
                <p className="text-sm text-green-600">Current value</p>
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
                <p className="text-2xl font-bold text-ghana-black">{activeSuppliers}</p>
                <p className="text-sm text-green-600">Partnerships</p>
              </div>
              <div className="text-3xl">🤝</div>
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
              className="bg-ghana-green text-white h-20 flex flex-col items-center justify-center space-y-2"
              size="lg"
            >
              <span className="text-2xl">📦</span>
              <span className="text-sm font-medium">Add Item</span>
            </Button>
            <Button
              variant="flat"
              className="bg-blue-500 text-white h-20 flex flex-col items-center justify-center space-y-2"
              size="lg"
            >
              <span className="text-2xl">🤝</span>
              <span className="text-sm font-medium">Add Supplier</span>
            </Button>
            <Button
              variant="flat"
              className="bg-ghana-gold text-white h-20 flex flex-col items-center justify-center space-y-2"
              size="lg"
            >
              <span className="text-2xl">📋</span>
              <span className="text-sm font-medium">Create PO</span>
            </Button>
            <Button
              variant="flat"
              className="bg-purple-500 text-white h-20 flex flex-col items-center justify-center space-y-2"
              size="lg"
            >
              <span className="text-2xl">📊</span>
              <span className="text-sm font-medium">Stock Count</span>
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );

  const renderInventoryManagement = () => (
    <div className="space-y-6">
      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold text-ghana-black">📦 Inventory Management</h3>
            <Button
              color="primary"
              className="bg-ghana-green text-white"
              variant="flat"
            >
              ➕ Add Item
            </Button>
          </div>
        </CardHeader>
        <CardBody>
          <Table aria-label="Inventory items table">
            <TableHeader>
              <TableColumn>Item Code</TableColumn>
              <TableColumn>Name</TableColumn>
              <TableColumn>Category</TableColumn>
              <TableColumn>Current Stock</TableColumn>
              <TableColumn>Reorder Point</TableColumn>
              <TableColumn>Cost Price</TableColumn>
              <TableColumn>Status</TableColumn>
              <TableColumn>Actions</TableColumn>
            </TableHeader>
            <TableBody>
              {inventoryItems.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-mono font-semibold">{item.itemCode}</TableCell>
                  <TableCell className="font-semibold">{item.name}</TableCell>
                  <TableCell>
                    <Chip 
                      color={
                        item.category === 'food-beverage' ? 'success' :
                        item.category === 'housekeeping' ? 'primary' :
                        item.category === 'maintenance' ? 'warning' :
                        'default'
                      } 
                      size="sm" 
                      variant="flat"
                    >
                      {item.category}
                    </Chip>
                  </TableCell>
                  <TableCell>
                    <div className={`font-semibold ${
                      item.currentStock <= item.reorderPoint ? 'text-red-600' :
                      item.currentStock <= item.reorderPoint * 1.5 ? 'text-orange-600' :
                      'text-green-600'
                    }`}>
                      {item.currentStock}
                    </div>
                  </TableCell>
                  <TableCell>{item.reorderPoint}</TableCell>
                  <TableCell className="font-semibold">₵{item.costPrice.toLocaleString()}</TableCell>
                  <TableCell>
                    <Badge 
                      color={
                        item.status === 'active' ? 'success' :
                        item.status === 'inactive' ? 'warning' :
                        'default'
                      } 
                      size="sm"
                    >
                      {item.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button size="sm" variant="flat" color="primary">
                        Edit
                      </Button>
                      <Button size="sm" variant="flat" color="secondary">
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

  const renderSupplierManagement = () => (
    <div className="space-y-6">
      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold text-ghana-black">🤝 Supplier Management</h3>
            <Button
              color="primary"
              className="bg-blue-500 text-white"
              variant="flat"
            >
              ➕ Add Supplier
            </Button>
          </div>
        </CardHeader>
        <CardBody>
          <Table aria-label="Suppliers table">
            <TableHeader>
              <TableColumn>Supplier Code</TableColumn>
              <TableColumn>Name</TableColumn>
              <TableColumn>Contact</TableColumn>
              <TableColumn>Categories</TableColumn>
              <TableColumn>Rating</TableColumn>
              <TableColumn>Status</TableColumn>
              <TableColumn>Actions</TableColumn>
            </TableHeader>
            <TableBody>
              {suppliers.map((supplier) => (
                <TableRow key={supplier.id}>
                  <TableCell className="font-mono font-semibold">{supplier.supplierCode}</TableCell>
                  <TableCell className="font-semibold">{supplier.name}</TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <div>{supplier.contactPerson}</div>
                      <div className="text-gray-500">{supplier.phone}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {supplier.categories.map((category) => (
                        <Chip key={category} color="primary" size="sm" variant="flat">
                          {category}
                        </Chip>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <span className="font-semibold">{supplier.rating}</span>
                      <div className="flex">
                        {[...Array(5)].map((_, i) => (
                          <span key={i} className={`text-lg ${i < supplier.rating ? 'text-yellow-500' : 'text-gray-300'}`}>
                            ★
                          </span>
                        ))}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge 
                      color={
                        supplier.status === 'active' ? 'success' :
                        supplier.status === 'inactive' ? 'warning' :
                        'danger'
                      } 
                      size="sm"
                    >
                      {supplier.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button size="sm" variant="flat" color="primary">
                        Edit
                      </Button>
                      <Button size="sm" variant="flat" color="secondary">
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

  const renderPurchaseOrders = () => (
    <div className="space-y-6">
      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold text-ghana-black">📋 Purchase Orders</h3>
            <Button
              color="primary"
              className="bg-ghana-gold text-white"
              variant="flat"
            >
              📋 Create PO
            </Button>
          </div>
        </CardHeader>
        <CardBody>
          <Table aria-label="Purchase orders table">
            <TableHeader>
              <TableColumn>PO Number</TableColumn>
              <TableColumn>Supplier</TableColumn>
              <TableColumn>Order Date</TableColumn>
              <TableColumn>Expected Delivery</TableColumn>
              <TableColumn>Total Amount</TableColumn>
              <TableColumn>Status</TableColumn>
              <TableColumn>Actions</TableColumn>
            </TableHeader>
            <TableBody>
              {purchaseOrders.map((po) => (
                <TableRow key={po.id}>
                  <TableCell className="font-mono font-semibold">{po.poNumber}</TableCell>
                  <TableCell className="font-semibold">{po.supplierName}</TableCell>
                  <TableCell>{new Date(po.orderDate).toLocaleDateString()}</TableCell>
                  <TableCell>{new Date(po.expectedDelivery).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <div className="text-right">
                      <div className="font-semibold">₵{po.totalWithTax.toLocaleString()}</div>
                      <div className="text-sm text-gray-500">Base: ₵{po.totalAmount.toLocaleString()}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge 
                      color={
                        po.status === 'received' ? 'success' :
                        po.status === 'confirmed' ? 'warning' :
                        po.status === 'sent' ? 'primary' :
                        po.status === 'draft' ? 'default' :
                        'danger'
                      } 
                      size="sm"
                    >
                      {po.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button size="sm" variant="flat" color="primary">
                        View
                      </Button>
                      {po.status === 'draft' && (
                        <Button size="sm" variant="flat" color="success">
                          Send
                        </Button>
                      )}
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

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-ghana-black">📦 Inventory & Supply Chain Management</h1>
          <p className="text-gray-600">Complete inventory control with Ghana import/export compliance</p>
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
        <Tab key="inventory" title="Inventory Management" />
        <Tab key="suppliers" title="Supplier Management" />
        <Tab key="purchase-orders" title="Purchase Orders" />
      </Tabs>

      <div className="mt-6">
        {selectedTab === 'overview' && renderOverview()}
        {selectedTab === 'inventory' && renderInventoryManagement()}
        {selectedTab === 'suppliers' && renderSupplierManagement()}
        {selectedTab === 'purchase-orders' && renderPurchaseOrders()}
      </div>
    </div>
  );
}
