'use client';

import React, { useEffect, useState } from 'react';
import { 
  Card, CardBody, CardHeader, Tabs, Tab, Button, Input, Select, SelectItem,
  Table, TableHeader, TableColumn, TableBody, TableRow, TableCell,
  Chip, Badge, Progress, Divider, Spinner, Alert
} from "@heroui/react";
import { useStockStore } from '@/app/lib/inventory/stockStore';
import { useSupplierStore } from '@/app/lib/inventory/supplierStore';
import { useAccountingStore } from '@/app/lib/accounting/store';

import { auditLogStore, logAudit } from '@/app/lib/analytics/auditLogStore';

export default function InventoryDashboard() {
  const {
    stockItems: inventoryItems,
    getLowStockItems,
    getOverstockItems: getOutOfStockItems,
    getTotalInventoryValue: calculateInventoryValue
  } = useStockStore();

  const {
    purchaseOrders,
    suppliers
  } = useSupplierStore();

  // Create categories from available stock items
  const itemCategories = Array.from(new Set(inventoryItems.map(item => item.category))).map(category => ({
    id: category,
    name: category.charAt(0).toUpperCase() + category.slice(1)
  }));

  const { initializeAccounting } = useAccountingStore();

  const [selectedTab, setSelectedTab] = useState("overview");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  useEffect(() => {
    const initializeData = async () => {
      await initializeAccounting();
    };
    initializeData();
  }, [initializeAccounting]);

  const lowStockItems = getLowStockItems();
  const outOfStockItems = getOutOfStockItems();
  const totalInventoryValue = calculateInventoryValue();

  const filteredItems = inventoryItems.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         item.itemCode.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === "all" || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const renderOverview = () => (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardBody className="text-center">
            <div className="text-2xl font-bold text-blue-600">{inventoryItems.length}</div>
            <div className="text-sm text-gray-600">Total Items</div>
          </CardBody>
        </Card>
        
        <Card>
          <CardBody className="text-center">
            <div className="text-2xl font-bold text-red-600">{lowStockItems.length}</div>
            <div className="text-sm text-gray-600">Low Stock Items</div>
          </CardBody>
        </Card>
        
        <Card>
          <CardBody className="text-center">
            <div className="text-2xl font-bold text-orange-600">{outOfStockItems.length}</div>
            <div className="text-sm text-gray-600">Out of Stock</div>
          </CardBody>
        </Card>
        
        <Card>
          <CardBody className="text-center">
            <div className="text-2xl font-bold text-green-600">₵{totalInventoryValue.toFixed(2)}</div>
            <div className="text-sm text-gray-600">Total Value</div>
          </CardBody>
        </Card>
      </div>

      {/* Low Stock Alerts */}
      {lowStockItems.length > 0 && (
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold text-red-600">⚠️ Low Stock Alerts</h3>
          </CardHeader>
          <CardBody>
            <div className="space-y-2">
              {lowStockItems.slice(0, 5).map(item => (
                <div key={item.id} className="flex justify-between items-center p-2 bg-red-50 rounded">
                  <div>
                    <div className="font-medium">{item.name}</div>
                    <div className="text-sm text-gray-600">{item.itemCode}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-red-600 font-bold">{item.currentStock} {item.unit}</div>
                    <div className="text-xs text-gray-500">Reorder: {item.reorderPoint}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      )}

      {/* Recent Purchase Orders */}
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">📋 Recent Purchase Orders</h3>
        </CardHeader>
        <CardBody>
          <Table aria-label="Recent purchase orders">
            <TableHeader>
              <TableColumn>Order #</TableColumn>
              <TableColumn>Supplier</TableColumn>
              <TableColumn>Date</TableColumn>
              <TableColumn>Status</TableColumn>
              <TableColumn>Total</TableColumn>
            </TableHeader>
            <TableBody>
              {purchaseOrders.slice(0, 5).map(order => (
                <TableRow key={order.id}>
                  <TableCell>{order.poNumber}</TableCell>
                  <TableCell>{order.supplierName}</TableCell>
                  <TableCell>{new Date(order.orderDate).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <Chip 
                      color={order.status === 'draft' ? 'default' : 
                             order.status === 'sent' ? 'primary' : 
                             order.status === 'delivered' ? 'success' : 'danger'}
                      size="sm"
                    >
                      {order.status}
                    </Chip>
                  </TableCell>
                  <TableCell>₵{order.totalAmount.toFixed(2)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardBody>
      </Card>
    </div>
  );

  const renderInventoryItems = () => (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex gap-4 items-center">
        <Input
          placeholder="Search items..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="max-w-xs"
        />
        <Select
          placeholder="Select Category"
          selectedKeys={selectedCategory === "all" ? [] : [selectedCategory]}
          onSelectionChange={(keys) => setSelectedCategory(Array.from(keys)[0] as string || "all")}
          className="max-w-xs"
        >
          <SelectItem key="all" value="all">All Categories</SelectItem>
          {itemCategories.map(category => (
            <SelectItem key={category.id} value={category.id}>
              {category.name}
            </SelectItem>
          ))}
        </Select>
        <Button color="primary">Add New Item</Button>
      </div>

      {/* Inventory Items Table */}
      <Card>
        <CardBody>
          <Table aria-label="Inventory items">
            <TableHeader>
              <TableColumn>Item Code</TableColumn>
              <TableColumn>Name</TableColumn>
              <TableColumn>Category</TableColumn>
              <TableColumn>Stock</TableColumn>
              <TableColumn>Unit Cost</TableColumn>
              <TableColumn>Value</TableColumn>
              <TableColumn>Status</TableColumn>
              <TableColumn>Actions</TableColumn>
            </TableHeader>
            <TableBody>
              {filteredItems.map(item => (
                <TableRow key={item.id}>
                  <TableCell>{item.itemCode}</TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{item.name}</div>
                      <div className="text-sm text-gray-500">{item.description}</div>
                    </div>
                  </TableCell>
                  <TableCell>{item.category}</TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{item.currentStock} {item.unit}</div>
                      <Progress 
                        value={(item.currentStock / item.maximumStock) * 100} 
                        size="sm" 
                        color={item.currentStock <= item.reorderPoint ? "danger" : "success"}
                      />
                    </div>
                  </TableCell>
                  <TableCell>₵{item.unitCost.toFixed(2)}</TableCell>
                  <TableCell>₵{(item.currentStock * item.unitCost).toFixed(2)}</TableCell>
                  <TableCell>
                    <Chip 
                      color={item.currentStock === 0 ? "danger" : 
                             item.currentStock <= item.reorderPoint ? "warning" : "success"}
                      size="sm"
                    >
                      {item.currentStock === 0 ? "Out of Stock" :
                       item.currentStock <= item.reorderPoint ? "Low Stock" : "In Stock"}
                    </Chip>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button size="sm" color="primary">Edit</Button>
                      <Button size="sm" color="secondary">View</Button>
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
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Purchase Orders</h3>
        <Button color="primary">Create New PO</Button>
      </div>

      <Card>
        <CardBody>
          <Table aria-label="Purchase orders">
            <TableHeader>
              <TableColumn>Order #</TableColumn>
              <TableColumn>Supplier</TableColumn>
              <TableColumn>Order Date</TableColumn>
              <TableColumn>Expected Delivery</TableColumn>
              <TableColumn>Status</TableColumn>
              <TableColumn>Total Amount</TableColumn>
              <TableColumn>Actions</TableColumn>
            </TableHeader>
            <TableBody>
              {purchaseOrders.map(order => (
                <TableRow key={order.id}>
                  <TableCell>{order.poNumber}</TableCell>
                  <TableCell>{order.supplierName}</TableCell>
                  <TableCell>{new Date(order.orderDate).toLocaleDateString()}</TableCell>
                  <TableCell>{new Date(order.expectedDeliveryDate).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <Chip 
                      color={order.status === 'draft' ? 'default' : 
                             order.status === 'sent' ? 'primary' : 
                             order.status === 'delivered' ? 'success' : 'danger'}
                      size="sm"
                    >
                      {order.status}
                    </Chip>
                  </TableCell>
                  <TableCell>₵{order.totalAmount.toFixed(2)}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button size="sm" color="primary">View</Button>
                      {order.status === 'draft' && (
                        <Button size="sm" color="success">Send</Button>
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

  const renderStockMovements = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Stock Movements</h3>
        <div className="flex gap-2">
          <Button color="primary">Stock Transfer</Button>
          <Button color="secondary">Stock Adjustment</Button>
          <Button color="success">Inventory Count</Button>
        </div>
      </div>

      <Card>
        <CardBody>
          <div className="text-center py-8 text-gray-500">
            <div className="text-4xl mb-4">📦</div>
            <div className="text-lg font-medium">Stock Movement History</div>
            <div className="text-sm">Track all inventory movements, transfers, and adjustments</div>
          </div>
        </CardBody>
      </Card>
    </div>
  );

  const renderReports = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold">📊 Stock Value Report</h3>
          </CardHeader>
          <CardBody>
            <div className="space-y-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600">₵{totalInventoryValue.toFixed(2)}</div>
                <div className="text-sm text-gray-600">Total Inventory Value</div>
              </div>
              <Divider />
              <div className="space-y-2">
                {itemCategories.map(category => {
                  const categoryItems = inventoryItems.filter(item => item.category === category.id);
                      const categoryValue = categoryItems.reduce((sum, item) => 
      sum + (item.currentStock * item.unitCost), 0
    );
                  return (
                    <div key={category.id} className="flex justify-between">
                      <span>{category.name}</span>
                      <span className="font-medium">₵{categoryValue.toFixed(2)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold">📈 Stock Levels</h3>
          </CardHeader>
          <CardBody>
            <div className="space-y-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-600">{inventoryItems.length}</div>
                <div className="text-sm text-gray-600">Total Items</div>
              </div>
              <Divider />
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>In Stock</span>
                  <span className="font-medium text-green-600">
                    {inventoryItems.filter(item => item.currentStock > item.reorderPoint).length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Low Stock</span>
                  <span className="font-medium text-orange-600">{lowStockItems.length}</span>
                </div>
                <div className="flex justify-between">
                  <span>Out of Stock</span>
                  <span className="font-medium text-red-600">{outOfStockItems.length}</span>
                </div>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );



  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">🏪 Inventory Management</h1>
        <p className="text-gray-600 mt-2">
          Manage hotel inventory, track stock levels, and handle procurement
        </p>
      </div>

      <Card>
        <CardBody className="p-0">
          <Tabs 
            selectedKey={selectedTab} 
            onSelectionChange={(key) => setSelectedTab(key as string)}
            className="w-full"
          >
            <Tab key="overview" title="📊 Overview">
              <div className="p-6">
                {renderOverview()}
              </div>
            </Tab>

            <Tab key="items" title="📦 Inventory Items">
              <div className="p-6">
                {renderInventoryItems()}
              </div>
            </Tab>

            <Tab key="purchase-orders" title="📋 Purchase Orders">
              <div className="p-6">
                {renderPurchaseOrders()}
              </div>
            </Tab>

            <Tab key="movements" title="🔄 Stock Movements">
              <div className="p-6">
                {renderStockMovements()}
              </div>
            </Tab>

            <Tab key="reports" title="📈 Reports">
              <div className="p-6">
                {renderReports()}
              </div>
            </Tab>
            <Tab key="opslog" title="🧾 Operations Log">
              <div className="p-6">
                <Card>
                  <CardHeader>
                    <h3 className="text-lg font-semibold">Inventory Operations Log</h3>
                  </CardHeader>
                  <CardBody>
                    <Table aria-label="Inventory operations log">
                      <TableHeader>
                        <TableColumn>TIME</TableColumn>
                        <TableColumn>ACTION</TableColumn>
                        <TableColumn>ENTITY</TableColumn>
                        <TableColumn>DETAILS</TableColumn>
                      </TableHeader>
                      <TableBody>
                        {auditLogStore.byArea('inventory').map(r => (
                          <TableRow key={r.id}>
                            <TableCell>{new Date(r.at).toLocaleString()}</TableCell>
                            <TableCell>{r.action}</TableCell>
                            <TableCell>{r.entity || '-'}</TableCell>
                            <TableCell>{r.details || '-'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardBody>
                </Card>
              </div>
            </Tab>
          </Tabs>
        </CardBody>
      </Card>
    </div>
  );
}
