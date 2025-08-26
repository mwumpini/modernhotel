'use client';

import React, { useState, useEffect } from 'react';
import { 
  Card, CardBody, CardHeader, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, 
  Badge, Button, Input, Select, SelectItem, Modal, ModalContent, ModalHeader, ModalBody, 
  ModalFooter, useDisclosure, Tabs, Tab, Textarea, Chip, Divider, Progress
} from '@heroui/react';
import DashboardWrapper from './DashboardWrapper';
import { storesStore } from '../lib/stores/store';
import { StockStatus } from '../lib/stores/types';
import { useAccountingStore } from '../lib/accounting/store';
import { trackEvent } from '../lib/analytics/trackEvent';

export default function StoresManagement() {
  const [tick, setTick] = React.useState(0);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [selectedCategory, setSelectedCategory] = React.useState('all');
  const [selectedSupplier, setSelectedSupplier] = React.useState('all');
  const [viewMode, setViewMode] = useState<'stock' | 'purchasing' | 'compliance' | 'analytics'>('stock');
  
  // Modal states
  const { isOpen: isPOOpen, onOpen: onPOOpen, onClose: onPOClose } = useDisclosure();
  const { isOpen: isGRNOpen, onOpen: onGRNOpen, onClose: onGRNClose } = useDisclosure();
  const { isOpen: isIssueOpen, onOpen: onIssueOpen, onClose: onIssueClose } = useDisclosure();
  const { isOpen: isSupplierOpen, onOpen: onSupplierOpen, onClose: onSupplierClose } = useDisclosure();
  
  // Form states
  const [poForm, setPOForm] = useState({
    supplierId: '',
    expectedDelivery: '',
    items: [] as Array<{itemId: string, quantity: number, unitPrice: number}>
  });
  
  const [grnForm, setGRNForm] = useState({
    poId: '',
    actualDeliveryDate: '',
    items: [] as Array<{itemId: string, actualQuantity: number, actualUnitPrice: number, notes: string}>
  });
  
  const [issueForm, setIssueForm] = useState({
    department: '',
    costCenter: '',
    items: [] as Array<{itemId: string, quantity: number, purpose: string}>
  });
  
  const [supplierForm, setSupplierForm] = useState({
    name: '',
    contactPerson: '',
    email: '',
    phone: '',
    address: '',
    taxId: '',
    vatNumber: '',
    paymentTerms: 30,
    creditLimit: 0
  });

  const accountingStore = useAccountingStore();
  
  React.useEffect(() => {
    const unsubscribe = storesStore.subscribe(() => setTick(t => t + 1));
    return unsubscribe;
  }, []);

  const allItems = storesStore.getAllItems();
  const lowStockItems = storesStore.getLowStockItems();
  const purchaseOrders = storesStore.getPurchaseOrders();
  const stockMovements = storesStore.getStockMovements();
  const alerts = storesStore.getAlerts();
  const categories = storesStore.getCategories();
  const costCenters = storesStore.getCostCenters();
  const inventoryValue = storesStore.getInventoryValue();
  const suppliers = storesStore.getSuppliers();

  const filteredItems = allItems.filter(item => {
    const matchesSearch = !searchTerm || 
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.code.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
    const matchesSupplier = selectedSupplier === 'all' || item.supplierId === selectedSupplier;
    return matchesSearch && matchesCategory && matchesSupplier;
  });

  const stats = [
    { label: 'Total Items', value: allItems.length.toString(), change: '+2', changeType: 'positive', icon: '📦' },
    { label: 'Low Stock Alerts', value: lowStockItems.length.toString(), change: '+1', changeType: 'negative', icon: '⚠️' },
    { label: 'Open POs', value: purchaseOrders.filter(po => po.status === 'draft' || po.status === 'sent').length.toString(), change: '+0', changeType: 'neutral', icon: '🧾' },
    { label: 'Inventory Value', value: `₵${inventoryValue.toLocaleString()}`, change: '+5%', changeType: 'positive', icon: '💰' },
    { label: 'VAT Liability', value: `₵${(inventoryValue * 0.15).toLocaleString()}`, change: '+5%', changeType: 'neutral', icon: '🏛️' },
  ] as const;

  const quickActions = [
    { title: 'New Item', icon: '➕', color: 'primary', onClick: () => {} },
    { title: 'Purchase Order', icon: '🧾', color: 'secondary', onClick: onPOOpen },
    { title: 'Receive Goods', icon: '📥', color: 'success', onClick: onGRNOpen },
    { title: 'Issue Stock', icon: '📤', color: 'warning', onClick: onIssueOpen },
    { title: 'Stock Count', icon: '🧮', color: 'danger', onClick: () => {} },
    { title: 'Suppliers', icon: '🤝', color: 'default', onClick: onSupplierOpen },
  ] as const;

  const handleCreatePO = () => {
    if (poForm.supplierId && poForm.items.length > 0) {
      const po = storesStore.createPurchaseOrder({
        supplierId: poForm.supplierId,
        supplierName: suppliers.find(s => s.id === poForm.supplierId)?.name || '',
        expectedDelivery: poForm.expectedDelivery,
        items: poForm.items.map(item => ({
          itemId: item.itemId,
          itemName: allItems.find(i => i.id === item.itemId)?.name || '',
          quantity: item.quantity,
          unitPrice: item.unitPrice
        }))
      });
      
      // Create accounting journal entry for PO commitment
      accountingStore.addJournalEntry({
        id: `po-${po.id}`,
        entryNumber: `PO-${po.poNumber}`,
        date: new Date().toISOString(),
        reference: `Purchase Order ${po.poNumber}`,
        description: `PO commitment for ${poForm.items.length} items`,
        status: 'draft',
        lines: poForm.items.map(item => ({
          accountCode: '2100', // Accounts Payable
          description: `PO ${po.poNumber} - ${allItems.find(i => i.id === item.itemId)?.name}`,
          debit: 0,
          credit: item.quantity * item.unitPrice,
          costCenter: 'PURCHASING'
        }))
      });
      
      trackEvent('purchase_order_created', { poId: po.id, supplierId: poForm.supplierId, totalAmount: po.totalAmount });
      onPOClose();
      setPOForm({ supplierId: '', expectedDelivery: '', items: [] });
    }
  };

  const handleCreateGRN = () => {
    if (grnForm.poId && grnForm.items.length > 0) {
      const po = purchaseOrders.find(p => p.id === grnForm.poId);
      if (po) {
        // Update inventory and create accounting entries
        grnForm.items.forEach(item => {
          const inventoryItem = allItems.find(i => i.id === item.itemId);
          if (inventoryItem) {
            // Update stock levels
            storesStore.updateItemStock(item.itemId, item.actualQuantity);
            
            // Create journal entry for inventory receipt
            const totalValue = item.actualQuantity * item.actualUnitPrice;
            const vatAmount = totalValue * 0.15; // Ghana VAT rate
            
            accountingStore.addJournalEntry({
              id: `grn-${Date.now()}-${item.itemId}`,
              entryNumber: `GRN-${Date.now()}`,
              date: new Date().toISOString(),
              reference: `GRN for PO ${po.poNumber}`,
              description: `Goods received: ${inventoryItem.name}`,
              status: 'posted',
              lines: [
                {
                  accountCode: '1500', // Inventory Asset
                  description: `Inventory receipt - ${inventoryItem.name}`,
                  debit: totalValue,
                  credit: 0,
                  costCenter: 'PURCHASING'
                },
                {
                  accountCode: '2200', // VAT Payable
                  description: `Input VAT on ${inventoryItem.name}`,
                  debit: 0,
                  credit: vatAmount,
                  costCenter: 'PURCHASING'
                },
                {
                  accountCode: '2100', // Accounts Payable
                  description: `GRN for PO ${po.poNumber}`,
                  debit: 0,
                  credit: totalValue + vatAmount,
                  costCenter: 'PURCHASING'
                }
              ]
            });
          }
        });
        
        trackEvent('goods_received', { poId: grnForm.poId, itemsCount: grnForm.items.length });
        onGRNClose();
        setGRNForm({ poId: '', actualDeliveryDate: '', items: [] });
      }
    }
  };

  const handleIssueStock = () => {
    if (issueForm.department && issueForm.items.length > 0) {
      issueForm.items.forEach(item => {
        const inventoryItem = allItems.find(i => i.id === item.itemId);
        if (inventoryItem) {
          // Update stock levels
          storesStore.updateItemStock(item.itemId, -item.quantity);
          
          // Create journal entry for stock issue (COGS)
          const totalValue = item.quantity * inventoryItem.costPrice;
          
          accountingStore.addJournalEntry({
            id: `issue-${Date.now()}-${item.itemId}`,
            entryNumber: `ISSUE-${Date.now()}`,
            date: new Date().toISOString(),
            reference: `Stock issue to ${issueForm.department}`,
            description: `Stock issued: ${inventoryItem.name} for ${item.purpose}`,
            status: 'posted',
            lines: [
              {
                accountCode: '5100', // Cost of Goods Sold
                description: `Stock issue - ${inventoryItem.name}`,
                debit: totalValue,
                credit: 0,
                costCenter: issueForm.costCenter
              },
              {
                accountCode: '1500', // Inventory Asset
                description: `Stock issue - ${inventoryItem.name}`,
                debit: 0,
                credit: totalValue,
                costCenter: issueForm.costCenter
              }
            ]
          });
        }
      });
      
      trackEvent('stock_issued', { department: issueForm.department, itemsCount: issueForm.items.length });
      onIssueClose();
      setIssueForm({ department: '', costCenter: '', items: [] });
    }
  };

  const renderStockManagement = () => (
    <div className="space-y-6">
      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-2 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-ghana-black">📦 Stock Items</h3>
          <div className="flex items-center gap-2">
            <Input size="sm" label="Search" value={searchTerm} onChange={(e)=> setSearchTerm(e.target.value)} />
            <Select size="sm" label="Category" selectedKeys={[selectedCategory]} onSelectionChange={(k)=> setSelectedCategory(Array.from(k as Set<string>)[0] || 'all')}>
              <SelectItem key="all">All Categories</SelectItem>
              {categories.map(c => <SelectItem key={c.name}>{c.name}</SelectItem>)}
            </Select>
            <Select size="sm" label="Supplier" selectedKeys={[selectedSupplier]} onSelectionChange={(k)=> setSelectedSupplier(Array.from(k as Set<string>)[0] || 'all')}>
              <SelectItem key="all">All Suppliers</SelectItem>
              {suppliers.map(s => <SelectItem key={s.id}>{s.name}</SelectItem>)}
            </Select>
          </div>
        </CardHeader>
        <CardBody>
          <Table aria-label="Stock list">
            <TableHeader>
              <TableColumn>Code</TableColumn>
              <TableColumn>Item Name</TableColumn>
              <TableColumn>Category</TableColumn>
              <TableColumn>Unit</TableColumn>
              <TableColumn>On Hand</TableColumn>
              <TableColumn>Cost Price</TableColumn>
              <TableColumn>VAT Status</TableColumn>
              <TableColumn>Status</TableColumn>
              <TableColumn>Actions</TableColumn>
            </TableHeader>
            <TableBody>
              {filteredItems.map(item => (
                <TableRow key={item.id}>
                  <TableCell className="font-mono">{item.code}</TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{item.name}</div>
                      {item.description && <div className="text-sm text-gray-500">{item.description}</div>}
                    </div>
                  </TableCell>
                  <TableCell>{item.category}</TableCell>
                  <TableCell>{item.unit}</TableCell>
                  <TableCell>
                    <div className="text-right">
                      <div className="font-medium">{item.currentStock}</div>
                      <div className="text-xs text-gray-500">Min: {item.minStockLevel}</div>
                      <Progress 
                        size="sm" 
                        value={((item.currentStock - item.minStockLevel) / (item.maxStockLevel - item.minStockLevel)) * 100} 
                        color={item.currentStock <= item.minStockLevel ? 'danger' : item.currentStock <= item.reorderPoint ? 'warning' : 'success'}
                        className="mt-1"
                      />
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">₵{item.costPrice.toFixed(2)}</div>
                      <div className="text-xs text-gray-500">VAT: ₵{(item.costPrice * 0.15).toFixed(2)}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Chip size="sm" color={item.taxRate > 0 ? 'primary' : 'default'}>
                      {item.taxRate > 0 ? 'VAT-able' : 'Non-VAT'}
                    </Chip>
                  </TableCell>
                  <TableCell>
                    <Badge 
                      size="sm" 
                      variant="flat" 
                      color={
                        item.status === 'out-of-stock' ? 'danger' : 
                        item.status === 'low-stock' ? 'warning' : 'success'
                      }
                    >
                      {item.status.replace('-', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="sm" variant="flat" color="primary" onClick={() => {
                        setIssueForm(prev => ({ ...prev, items: [{ itemId: item.id, quantity: 1, purpose: '' }] }));
                        onIssueOpen();
                      }}>Issue</Button>
                      <Button size="sm" variant="bordered">Edit</Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardBody>
      </Card>

      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-2"><h3 className="text-lg font-semibold text-ghana-black">⚠️ Low Stock Alerts</h3></CardHeader>
        <CardBody>
          <div className="space-y-2">
            {lowStockItems.map(item => (
              <div key={item.id} className="p-3 rounded-lg border border-yellow-200 bg-yellow-50 flex items-center justify-between">
                <div className="text-sm text-ghana-black">
                  {item.name} • On hand {item.currentStock} {item.unit} • Reorder point {item.reorderPoint} {item.unit}
                </div>
                <Button size="sm" variant="flat" color="warning" onClick={() => {
                  setPOForm(prev => ({ 
                    ...prev, 
                    items: [{ itemId: item.id, quantity: item.maxStockLevel - item.currentStock, unitPrice: item.costPrice }]
                  }));
                  onPOOpen();
                }}>Create PO</Button>
              </div>
            ))}
            {lowStockItems.length === 0 && (
              <div className="text-sm text-gray-500">No items below reorder point.</div>
            )}
          </div>
        </CardBody>
      </Card>
    </div>
  );

  const renderPurchasing = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-0 shadow-lg">
          <CardHeader className="pb-2"><h3 className="text-lg font-semibold text-ghana-black">📤 Recent Stock Movements</h3></CardHeader>
          <CardBody>
            <Table aria-label="Recent movements">
              <TableHeader>
                <TableColumn>Date</TableColumn>
                <TableColumn>Item</TableColumn>
                <TableColumn>Type</TableColumn>
                <TableColumn>Qty</TableColumn>
                <TableColumn>Value</TableColumn>
                <TableColumn>Reference</TableColumn>
              </TableHeader>
              <TableBody>
                {stockMovements.slice(0, 5).map(movement => (
                  <TableRow key={movement.id}>
                    <TableCell>{new Date(movement.date).toLocaleDateString()}</TableCell>
                    <TableCell>{movement.itemName}</TableCell>
                    <TableCell>
                      <Badge 
                        size="sm" 
                        variant="flat" 
                        color={
                          movement.movementType === 'purchase' ? 'success' :
                          movement.movementType === 'issue' ? 'warning' : 'default'
                        }
                      >
                        {movement.movementType}
                      </Badge>
                    </TableCell>
                    <TableCell>{movement.quantity}</TableCell>
                    <TableCell>₵{movement.totalValue.toFixed(2)}</TableCell>
                    <TableCell>{movement.reference}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardBody>
        </Card>

        <Card className="border-0 shadow-lg">
          <CardHeader className="pb-2"><h3 className="text-lg font-semibold text-ghana-black">🧾 Purchase Orders</h3></CardHeader>
          <CardBody>
            <Table aria-label="Purchase orders">
              <TableHeader>
                <TableColumn>PO Number</TableColumn>
                <TableColumn>Supplier</TableColumn>
                <TableColumn>Status</TableColumn>
                <TableColumn>Total</TableColumn>
                <TableColumn>Date</TableColumn>
              </TableHeader>
              <TableBody>
                {purchaseOrders.slice(0, 5).map(po => (
                  <TableRow key={po.id}>
                    <TableCell className="font-mono">{po.poNumber}</TableCell>
                    <TableCell>{po.supplierName}</TableCell>
                    <TableCell>
                      <Badge 
                        size="sm" 
                        variant="flat" 
                        color={
                          po.status === 'received' ? 'success' :
                          po.status === 'confirmed' ? 'primary' :
                          po.status === 'sent' ? 'warning' : 'default'
                        }
                      >
                        {po.status}
                      </Badge>
                    </TableCell>
                    <TableCell>₵{po.totalAmount.toFixed(2)}</TableCell>
                    <TableCell>{new Date(po.orderDate).toLocaleDateString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardBody>
        </Card>
      </div>
    </div>
  );

  const renderCompliance = () => (
    <div className="space-y-6">
      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-2"><h3 className="text-lg font-semibold text-ghana-black">🏛️ Ghana Tax Compliance</h3></CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <h4 className="font-semibold text-blue-800 mb-2">VAT Management</h4>
              <p className="text-sm text-blue-600">Input VAT: ₵{(inventoryValue * 0.15).toFixed(2)}</p>
              <p className="text-sm text-blue-600">VAT-able Items: {allItems.filter(i => i.taxRate > 0).length}</p>
            </div>
            <div className="p-4 bg-green-50 rounded-lg border border-green-200">
              <h4 className="font-semibold text-green-800 mb-2">Inventory Valuation</h4>
              <p className="text-sm text-green-600">Total Value: ₵{inventoryValue.toFixed(2)}</p>
              <p className="text-sm text-green-600">Items Count: {allItems.length}</p>
            </div>
            <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
              <h4 className="font-semibold text-purple-800 mb-2">Supplier Compliance</h4>
              <p className="text-sm text-purple-600">Tax IDs Verified: {suppliers.filter(s => s.taxId).length}</p>
              <p className="text-sm text-purple-600">VAT Numbers: {suppliers.filter(s => s.vatNumber).length}</p>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );

  const renderAnalytics = () => (
    <div className="space-y-6">
      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-2"><h3 className="text-lg font-semibold text-ghana-black">📊 Inventory Analytics</h3></CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold mb-3">Category Distribution</h4>
              {categories.map(category => {
                const categoryItems = allItems.filter(item => item.category === category.name);
                const categoryValue = categoryItems.reduce((sum, item) => sum + (item.currentStock * item.costPrice), 0);
                const percentage = (categoryValue / inventoryValue) * 100;
                return (
                  <div key={category.id} className="mb-3">
                    <div className="flex justify-between text-sm mb-1">
                      <span>{category.name}</span>
                      <span>₵{categoryValue.toFixed(2)} ({percentage.toFixed(1)}%)</span>
                    </div>
                    <Progress size="sm" value={percentage} color="primary" />
                  </div>
                );
              })}
            </div>
            <div>
              <h4 className="font-semibold mb-3">Stock Status Overview</h4>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm">In Stock</span>
                  <Badge color="success">{allItems.filter(i => i.status === 'in-stock').length}</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Low Stock</span>
                  <Badge color="warning">{allItems.filter(i => i.status === 'low-stock').length}</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Out of Stock</span>
                  <Badge color="danger">{allItems.filter(i => i.status === 'out-of-stock').length}</Badge>
                </div>
              </div>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );

  return (
    <DashboardWrapper
      title="Stores & Inventory"
      subtitle="Centralized stock, purchasing, and issues across all departments with Ghanaian compliance"
      icon="🏬"
      stats={stats as any}
      quickActions={quickActions as any}
    >
      <div className="space-y-6">
        <Card className="border-0 shadow-lg">
          <CardHeader className="pb-2">
            <Tabs 
              selectedKey={viewMode} 
              onSelectionChange={(key) => setViewMode(key as any)}
              className="w-full"
            >
              <Tab key="stock" title="Stock Management" />
              <Tab key="purchasing" title="Purchasing" />
              <Tab key="compliance" title="Ghana Compliance" />
              <Tab key="analytics" title="Analytics" />
            </Tabs>
          </CardHeader>
          <CardBody>
            {viewMode === 'stock' && renderStockManagement()}
            {viewMode === 'purchasing' && renderPurchasing()}
            {viewMode === 'compliance' && renderCompliance()}
            {viewMode === 'analytics' && renderAnalytics()}
          </CardBody>
        </Card>
      </div>

      {/* Purchase Order Modal */}
      <Modal isOpen={isPOOpen} onClose={onPOClose} size="3xl">
        <ModalContent>
          <ModalHeader>Create Purchase Order</ModalHeader>
          <ModalBody>
            <div className="space-y-4">
              <Select label="Supplier" selectedKeys={[poForm.supplierId]} onSelectionChange={(k) => setPOForm(prev => ({ ...prev, supplierId: Array.from(k as Set<string>)[0] || '' }))}>
                {suppliers.map(s => <SelectItem key={s.id}>{s.name}</SelectItem>)}
              </Select>
              <Input 
                type="date" 
                label="Expected Delivery" 
                value={poForm.expectedDelivery} 
                onChange={(e) => setPOForm(prev => ({ ...prev, expectedDelivery: e.target.value }))} 
              />
              <div>
                <h4 className="font-semibold mb-2">Items</h4>
                {poForm.items.map((item, index) => (
                  <div key={index} className="flex gap-2 mb-2">
                    <Select 
                      label="Item" 
                      selectedKeys={[item.itemId]} 
                      onSelectionChange={(k) => {
                        const newItems = [...poForm.items];
                        newItems[index].itemId = Array.from(k as Set<string>)[0] || '';
                        setPOForm(prev => ({ ...prev, items: newItems }));
                      }}
                    >
                      {allItems.map(i => <SelectItem key={i.id}>{i.name}</SelectItem>)}
                    </Select>
                    <Input 
                      type="number" 
                      label="Quantity" 
                      value={item.quantity} 
                      onChange={(e) => {
                        const newItems = [...poForm.items];
                        newItems[index].quantity = parseInt(e.target.value) || 0;
                        setPOForm(prev => ({ ...prev, items: newItems }));
                      }} 
                    />
                    <Input 
                      type="number" 
                      label="Unit Price" 
                      value={item.unitPrice} 
                      onChange={(e) => {
                        const newItems = [...poForm.items];
                        newItems[index].unitPrice = parseFloat(e.target.value) || 0;
                        setPOForm(prev => ({ ...prev, items: newItems }));
                      }} 
                    />
                    <Button 
                      size="sm" 
                      color="danger" 
                      variant="flat"
                      onClick={() => {
                        const newItems = poForm.items.filter((_, i) => i !== index);
                        setPOForm(prev => ({ ...prev, items: newItems }));
                      }}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
                <Button 
                  size="sm" 
                  variant="flat" 
                  onClick={() => setPOForm(prev => ({ ...prev, items: [...prev.items, { itemId: '', quantity: 0, unitPrice: 0 }] }))}
                >
                  Add Item
                </Button>
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onClick={onPOClose}>Cancel</Button>
            <Button color="primary" onClick={handleCreatePO}>Create PO</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Goods Received Note Modal */}
      <Modal isOpen={isGRNOpen} onClose={onGRNClose} size="3xl">
        <ModalContent>
          <ModalHeader>Create Goods Received Note</ModalHeader>
          <ModalBody>
            <div className="space-y-4">
              <Select label="Purchase Order" selectedKeys={[grnForm.poId]} onSelectionChange={(k) => setGRNForm(prev => ({ ...prev, poId: Array.from(k as Set<string>)[0] || '' }))}>
                {purchaseOrders.filter(po => po.status === 'sent' || po.status === 'confirmed').map(po => <SelectItem key={po.id}>{po.poNumber}</SelectItem>)}
              </Select>
              <Input 
                type="date" 
                label="Actual Delivery Date" 
                value={grnForm.actualDeliveryDate} 
                onChange={(e) => setGRNForm(prev => ({ ...prev, actualDeliveryDate: e.target.value }))} 
              />
              <div>
                <h4 className="font-semibold mb-2">Received Items</h4>
                {grnForm.items.map((item, index) => (
                  <div key={index} className="flex gap-2 mb-2">
                    <Select 
                      label="Item" 
                      selectedKeys={[item.itemId]} 
                      onSelectionChange={(k) => {
                        const newItems = [...grnForm.items];
                        newItems[index].itemId = Array.from(k as Set<string>)[0] || '';
                        setGRNForm(prev => ({ ...prev, items: newItems }));
                      }}
                    >
                      {allItems.map(i => <SelectItem key={i.id}>{i.name}</SelectItem>)}
                    </Select>
                    <Input 
                      type="number" 
                      label="Actual Quantity" 
                      value={item.actualQuantity} 
                      onChange={(e) => {
                        const newItems = [...grnForm.items];
                        newItems[index].actualQuantity = parseInt(e.target.value) || 0;
                        setGRNForm(prev => ({ ...prev, items: newItems }));
                      }} 
                    />
                    <Input 
                      type="number" 
                      label="Actual Unit Price" 
                      value={item.actualUnitPrice} 
                      onChange={(e) => {
                        const newItems = [...grnForm.items];
                        newItems[index].actualUnitPrice = parseFloat(e.target.value) || 0;
                        setGRNForm(prev => ({ ...prev, items: newItems }));
                      }} 
                    />
                    <Input 
                      label="Notes" 
                      value={item.notes} 
                      onChange={(e) => {
                        const newItems = [...grnForm.items];
                        newItems[index].notes = e.target.value;
                        setGRNForm(prev => ({ ...prev, items: newItems }));
                      }} 
                    />
                    <Button 
                      size="sm" 
                      color="danger" 
                      variant="flat"
                      onClick={() => {
                        const newItems = grnForm.items.filter((_, i) => i !== index);
                        setGRNForm(prev => ({ ...prev, items: newItems }));
                      }}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
                <Button 
                  size="sm" 
                  variant="flat" 
                  onClick={() => setGRNForm(prev => ({ ...prev, items: [...prev.items, { itemId: '', actualQuantity: 0, actualUnitPrice: 0, notes: '' }] }))}
                >
                  Add Item
                </Button>
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onClick={onGRNClose}>Cancel</Button>
            <Button color="primary" onClick={handleCreateGRN}>Create GRN</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Issue Stock Modal */}
      <Modal isOpen={isIssueOpen} onClose={onIssueClose} size="3xl">
        <ModalContent>
          <ModalHeader>Issue Stock to Department</ModalHeader>
          <ModalBody>
            <div className="space-y-4">
              <Select label="Department" selectedKeys={[issueForm.department]} onSelectionChange={(k) => setIssueForm(prev => ({ ...prev, department: Array.from(k as Set<string>)[0] || '' }))}>
                <SelectItem key="F&B">Food & Beverage</SelectItem>
                <SelectItem key="Housekeeping">Housekeeping</SelectItem>
                <SelectItem key="Maintenance">Maintenance</SelectItem>
                <SelectItem key="Office">Office</SelectItem>
              </Select>
              <Select label="Cost Center" selectedKeys={[issueForm.costCenter]} onSelectionChange={(k) => setIssueForm(prev => ({ ...prev, costCenter: Array.from(k as Set<string>)[0] || '' }))}>
                {costCenters.map(cc => <SelectItem key={cc.code}>{cc.name}</SelectItem>)}
              </Select>
              <div>
                <h4 className="font-semibold mb-2">Items to Issue</h4>
                {issueForm.items.map((item, index) => (
                  <div key={index} className="flex gap-2 mb-2">
                    <Select 
                      label="Item" 
                      selectedKeys={[item.itemId]} 
                      onSelectionChange={(k) => {
                        const newItems = [...issueForm.items];
                        newItems[index].itemId = Array.from(k as Set<string>)[0] || '';
                        setIssueForm(prev => ({ ...prev, items: newItems }));
                      }}
                    >
                      {allItems.map(i => <SelectItem key={i.id}>{i.name}</SelectItem>)}
                    </Select>
                    <Input 
                      type="number" 
                      label="Quantity" 
                      value={item.quantity} 
                      onChange={(e) => {
                        const newItems = [...issueForm.items];
                        newItems[index].quantity = parseInt(e.target.value) || 0;
                        setIssueForm(prev => ({ ...prev, items: newItems }));
                      }} 
                    />
                    <Input 
                      label="Purpose" 
                      value={item.purpose} 
                      onChange={(e) => {
                        const newItems = [...issueForm.items];
                        newItems[index].purpose = e.target.value;
                        setIssueForm(prev => ({ ...prev, items: newItems }));
                      }} 
                    />
                    <Button 
                      size="sm" 
                      color="danger" 
                      variant="flat"
                      onClick={() => {
                        const newItems = issueForm.items.filter((_, i) => i !== index);
                        setIssueForm(prev => ({ ...prev, items: newItems }));
                      }}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
                <Button 
                  size="sm" 
                  variant="flat" 
                  onClick={() => setIssueForm(prev => ({ ...prev, items: [...prev.items, { itemId: '', quantity: 0, purpose: '' }] }))}
                >
                  Add Item
                </Button>
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onClick={onIssueClose}>Cancel</Button>
            <Button color="primary" onClick={handleIssueStock}>Issue Stock</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Supplier Management Modal */}
      <Modal isOpen={isSupplierOpen} onClose={onSupplierClose} size="2xl">
        <ModalContent>
          <ModalHeader>Add New Supplier</ModalHeader>
          <ModalBody>
            <div className="space-y-4">
              <Input 
                label="Company Name" 
                value={supplierForm.name} 
                onChange={(e) => setSupplierForm(prev => ({ ...prev, name: e.target.value }))} 
              />
              <Input 
                label="Contact Person" 
                value={supplierForm.contactPerson} 
                onChange={(e) => setSupplierForm(prev => ({ ...prev, contactPerson: e.target.value }))} 
              />
              <Input 
                label="Email" 
                type="email" 
                value={supplierForm.email} 
                onChange={(e) => setSupplierForm(prev => ({ ...prev, email: e.target.value }))} 
              />
              <Input 
                label="Phone" 
                value={supplierForm.phone} 
                onChange={(e) => setSupplierForm(prev => ({ ...prev, phone: e.target.value }))} 
              />
              <Textarea 
                label="Address" 
                value={supplierForm.address} 
                onChange={(e) => setSupplierForm(prev => ({ ...prev, address: e.target.value }))} 
              />
              <Input 
                label="Tax ID (TIN)" 
                value={supplierForm.taxId} 
                onChange={(e) => setSupplierForm(prev => ({ ...prev, taxId: e.target.value }))} 
              />
              <Input 
                label="VAT Number" 
                value={supplierForm.vatNumber} 
                onChange={(e) => setSupplierForm(prev => ({ ...prev, vatNumber: e.target.value }))} 
              />
              <Input 
                label="Payment Terms (days)" 
                type="number" 
                value={supplierForm.paymentTerms} 
                onChange={(e) => setSupplierForm(prev => ({ ...prev, paymentTerms: parseInt(e.target.value) || 0 }))} 
              />
              <Input 
                label="Credit Limit" 
                type="number" 
                value={supplierForm.creditLimit} 
                onChange={(e) => setSupplierForm(prev => ({ ...prev, creditLimit: parseFloat(e.target.value) || 0 }))} 
              />
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onClick={onSupplierClose}>Cancel</Button>
            <Button color="primary" onClick={() => {
              // Add supplier logic here
              onSupplierClose();
            }}>Add Supplier</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </DashboardWrapper>
  );
}
