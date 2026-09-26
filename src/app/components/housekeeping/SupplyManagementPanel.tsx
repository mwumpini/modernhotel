'use client';

import React, { useState, useEffect } from 'react';
import HeadingInfo from '../HeadingInfo';
import { 
  Card, 
  CardBody, 
  Button, 
  Input, 
  Select, 
  SelectItem, 
  Chip, 
  Badge, 
  Modal, 
  ModalContent, 
  ModalHeader, 
  ModalBody, 
  ModalFooter,
  Textarea,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Progress,
  Tooltip,
  Tabs,
  Tab
} from "@heroui/react";
import { trackEvent } from '../../lib/analytics/trackEvent';

interface SupplyItem {
  id: string;
  name: string;
  category: string;
  currentStock: number;
  minimumStock: number;
  maximumStock: number;
  unit: string;
  costPerUnit: number;
  supplier: string;
  lastRestocked: string;
  expiryDate?: string;
  location: string;
  notes?: string;
}

export default function SupplyManagementPanel() {
  const [supplies, setSupplies] = useState<SupplyItem[]>([]);
  const [selectedSupply, setSelectedSupply] = useState<SupplyItem | null>(null);
  const [supplyModalOpen, setSupplyModalOpen] = useState(false);
  const [isCreatingSupply, setIsCreatingSupply] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [stockFilter, setStockFilter] = useState<string>('all');

  // Form state
  const [supplyForm, setSupplyForm] = useState({
    name: '',
    category: 'cleaning',
    currentStock: 0,
    minimumStock: 10,
    maximumStock: 100,
    unit: 'pieces',
    costPerUnit: 0,
    supplier: '',
    location: '',
    notes: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    // Mock data - in real app this would come from the store
    setSupplies([
      {
        id: 'SUP001',
        name: 'Toilet Paper',
        category: 'bathroom',
        currentStock: 45,
        minimumStock: 20,
        maximumStock: 100,
        unit: 'rolls',
        costPerUnit: 0.50,
        supplier: 'Ghana Supplies Ltd',
        lastRestocked: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        location: 'Storage Room A',
        notes: 'Premium quality, 2-ply'
      },
      {
        id: 'SUP002',
        name: 'Cleaning Solution',
        category: 'cleaning',
        currentStock: 8,
        minimumStock: 15,
        maximumStock: 50,
        unit: 'bottles',
        costPerUnit: 2.50,
        supplier: 'CleanPro Ghana',
        lastRestocked: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        location: 'Storage Room B',
        notes: 'Eco-friendly formula'
      },
      {
        id: 'SUP003',
        name: 'Towels',
        category: 'linens',
        currentStock: 120,
        minimumStock: 50,
        maximumStock: 200,
        unit: 'pieces',
        costPerUnit: 3.00,
        supplier: 'Textile Ghana',
        lastRestocked: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        location: 'Linen Room',
        notes: 'White, 100% cotton'
      },
      {
        id: 'SUP004',
        name: 'Soap Bars',
        category: 'bathroom',
        currentStock: 5,
        minimumStock: 25,
        maximumStock: 100,
        unit: 'pieces',
        costPerUnit: 0.75,
        supplier: 'Ghana Supplies Ltd',
        lastRestocked: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        location: 'Storage Room A',
        notes: 'Lavender scented'
      }
    ]);
  };

  const handleCreateSupply = () => {
    setIsCreatingSupply(true);
    setSupplyForm({
      name: '',
      category: 'cleaning',
      currentStock: 0,
      minimumStock: 10,
      maximumStock: 100,
      unit: 'pieces',
      costPerUnit: 0,
      supplier: '',
      location: '',
      notes: ''
    });
    setSupplyModalOpen(true);
  };

  const handleEditSupply = (supply: SupplyItem) => {
    setIsCreatingSupply(false);
    setSelectedSupply(supply);
    setSupplyForm({
      name: supply.name,
      category: supply.category,
      currentStock: supply.currentStock,
      minimumStock: supply.minimumStock,
      maximumStock: supply.maximumStock,
      unit: supply.unit,
      costPerUnit: supply.costPerUnit,
      supplier: supply.supplier,
      location: supply.location,
      notes: supply.notes || ''
    });
    setSupplyModalOpen(true);
  };

  const handleSaveSupply = () => {
    if (!supplyForm.name) return;

    if (isCreatingSupply) {
      const newSupply: SupplyItem = {
        id: `SUP${Date.now().toString().slice(-6)}`,
        ...supplyForm,
        lastRestocked: new Date().toISOString()
      };
      setSupplies([...supplies, newSupply]);

      trackEvent('HK.Supply.Created', {
        name: supplyForm.name,
        category: supplyForm.category
      });
    } else if (selectedSupply) {
      const updatedSupplies = supplies.map(s => 
        s.id === selectedSupply.id 
          ? { ...s, ...supplyForm, lastRestocked: new Date().toISOString() }
          : s
      );
      setSupplies(updatedSupplies);

      trackEvent('HK.Supply.Updated', {
        supplyId: selectedSupply.id,
        name: supplyForm.name
      });
    }

    setSupplyModalOpen(false);
    loadData();
  };

  const handleRestock = (supplyId: string, quantity: number) => {
    const updatedSupplies = supplies.map(s => 
      s.id === supplyId 
        ? { ...s, currentStock: s.currentStock + quantity, lastRestocked: new Date().toISOString() }
        : s
    );
    setSupplies(updatedSupplies);

    trackEvent('HK.Supply.Restocked', { supplyId, quantity });
  };

  const getStockStatus = (supply: SupplyItem) => {
    const percentage = (supply.currentStock / supply.maximumStock) * 100;
    if (supply.currentStock <= supply.minimumStock) return 'low';
    if (percentage >= 80) return 'high';
    return 'normal';
  };

  const getStockStatusColor = (status: string) => {
    switch (status) {
      case 'low': return 'danger';
      case 'normal': return 'success';
      case 'high': return 'warning';
      default: return 'default';
    }
  };

  const getStockStatusIcon = (status: string) => {
    switch (status) {
      case 'low': return '⚠️';
      case 'normal': return '✅';
      case 'high': return '📦';
      default: return '❓';
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'cleaning': return 'primary';
      case 'bathroom': return 'secondary';
      case 'linens': return 'success';
      case 'amenities': return 'warning';
      case 'tools': return 'default';
      default: return 'default';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'cleaning': return '🧹';
      case 'bathroom': return '🚽';
      case 'linens': return '🛏️';
      case 'amenities': return '🛁';
      case 'tools': return '🔧';
      default: return '📦';
    }
  };

  const filteredSupplies = supplies.filter(supply => {
    if (searchTerm && !supply.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    if (categoryFilter !== 'all' && supply.category !== categoryFilter) return false;
    if (stockFilter !== 'all') {
      const status = getStockStatus(supply);
      if (stockFilter === 'low' && status !== 'low') return false;
      if (stockFilter === 'normal' && status !== 'normal') return false;
      if (stockFilter === 'high' && status !== 'high') return false;
    }
    return true;
  });

  const getCategoryName = (category: string) => {
    return category.charAt(0).toUpperCase() + category.slice(1);
  };

  const getStockPercentage = (supply: SupplyItem) => {
    return (supply.currentStock / supply.maximumStock) * 100;
  };

  const getTotalValue = () => {
    return supplies.reduce((sum, supply) => sum + (supply.currentStock * supply.costPerUnit), 0);
  };

  const getLowStockCount = () => {
    return supplies.filter(supply => getStockStatus(supply) === 'low').length;
  };

  return (
    <div className="p-6 space-y-4">
      {/* Header and Actions */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-1.5">
            <h2 className="text-xl font-semibold text-ghana-black">📦 Supply Management</h2>
            <HeadingInfo label="About supplies">Track inventory, manage supplies, and monitor stock levels</HeadingInfo>
          </div>
        </div>
        <Button 
          color="primary" 
          className="bg-ghana-green text-white"
          onClick={handleCreateSupply}
        >
          + Add Supply Item
        </Button>
      </div>

      {/* Supply Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card className="border-0 shadow-lg">
          <CardBody className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Items</p>
                <p className="text-2xl font-bold text-ghana-black">{supplies.length}</p>
              </div>
              <span className="text-2xl">📦</span>
            </div>
          </CardBody>
        </Card>
        
        <Card className="border-0 shadow-lg">
          <CardBody className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Low Stock</p>
                <p className="text-2xl font-bold text-red-600">{getLowStockCount()}</p>
              </div>
              <span className="text-2xl">⚠️</span>
            </div>
          </CardBody>
        </Card>
        
        <Card className="border-0 shadow-lg">
          <CardBody className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Categories</p>
                <p className="text-2xl font-bold text-blue-600">
                  {new Set(supplies.map(s => s.category)).size}
                </p>
              </div>
              <span className="text-2xl">🏷️</span>
            </div>
          </CardBody>
        </Card>
        
        <Card className="border-0 shadow-lg">
          <CardBody className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Value</p>
                <p className="text-2xl font-bold text-green-600">
                  ${getTotalValue().toFixed(2)}
                </p>
              </div>
              <span className="text-2xl">💰</span>
            </div>
          </CardBody>
        </Card>
        
        <Card className="border-0 shadow-lg">
          <CardBody className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Suppliers</p>
                <p className="text-2xl font-bold text-purple-600">
                  {new Set(supplies.map(s => s.supplier)).size}
                </p>
              </div>
              <span className="text-2xl">🏢</span>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Filters */}
      <Card className="border-0 shadow-lg">
        <CardBody className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Input
              placeholder="Search supply names..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              startContent={<span className="text-gray-400">🔍</span>}
            />
            <Select
              placeholder="Filter by category"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <SelectItem key="all">All Categories</SelectItem>
              <SelectItem key="cleaning">🧹 Cleaning</SelectItem>
              <SelectItem key="bathroom">🚽 Bathroom</SelectItem>
              <SelectItem key="linens">🛏️ Linens</SelectItem>
              <SelectItem key="amenities">🛁 Amenities</SelectItem>
              <SelectItem key="tools">🔧 Tools</SelectItem>
            </Select>
            <Select
              placeholder="Filter by stock level"
              value={stockFilter}
              onChange={(e) => setStockFilter(e.target.value)}
            >
              <SelectItem key="all">All Stock Levels</SelectItem>
              <SelectItem key="low">⚠️ Low Stock</SelectItem>
              <SelectItem key="normal">✅ Normal Stock</SelectItem>
              <SelectItem key="high">📦 High Stock</SelectItem>
            </Select>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">Filtered:</span>
              <Badge color="primary" variant="flat">{filteredSupplies.length}</Badge>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Supplies Management Tabs */}
      <Card className="border-0 shadow-lg">
        <CardBody className="p-0">
          <Tabs aria-label="Supply management tabs" className="w-full">
            <Tab key="overview" title="📊 Overview">
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredSupplies.map((supply) => (
                    <Card key={supply.id} className="border border-gray-200 hover:border-ghana-green transition-colors">
                      <CardBody className="p-4">
                        <div className="text-center">
                          {/* Supply Header */}
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <span className="text-xl">{getCategoryIcon(supply.category)}</span>
                              <h4 className="font-semibold text-ghana-black">{supply.name}</h4>
                            </div>
                            <Badge 
                              color={getStockStatusColor(getStockStatus(supply)) as any}
                              size="sm"
                            >
                              {getStockStatusIcon(getStockStatus(supply))} {getStockStatus(supply).charAt(0).toUpperCase() + getStockStatus(supply).slice(1)}
                            </Badge>
                          </div>
                          
                          {/* Stock Information */}
                          <div className="space-y-3 mb-4">
                            <div className="flex items-center justify-between text-sm">
                              <span>Current Stock</span>
                              <span className="font-medium">{supply.currentStock} {supply.unit}</span>
                            </div>
                            <Progress 
                              value={getStockPercentage(supply)} 
                              color={getStockStatusColor(getStockStatus(supply)) as any}
                              size="sm"
                            />
                            <div className="flex items-center justify-between text-xs text-gray-600">
                              <span>Min: {supply.minimumStock}</span>
                              <span>Max: {supply.maximumStock}</span>
                            </div>
                          </div>
                          
                          {/* Additional Info */}
                          <div className="space-y-2 mb-4 text-sm">
                            <div className="flex items-center justify-between">
                              <span className="text-gray-600">Category:</span>
                              <Badge color={getCategoryColor(supply.category) as any} variant="flat" size="sm">
                                {getCategoryName(supply.category)}
                              </Badge>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-gray-600">Cost:</span>
                              <span className="font-medium">${supply.costPerUnit}/{supply.unit}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-gray-600">Location:</span>
                              <span className="text-xs">{supply.location}</span>
                            </div>
                          </div>
                          
                          {/* Last Restocked */}
                          <div className="text-xs text-gray-500 mb-4">
                            Last restocked: {new Date(supply.lastRestocked).toLocaleDateString()}
                          </div>
                          
                          {/* Actions */}
                          <div className="flex gap-2">
                            <Button 
                              size="sm" 
                              color="primary" 
                              variant="flat"
                              onClick={() => handleEditSupply(supply)}
                            >
                              Edit
                            </Button>
                            <Button 
                              size="sm" 
                              color="success" 
                              variant="flat"
                              onClick={() => handleRestock(supply.id, 20)}
                            >
                              +20
                            </Button>
                          </div>
                        </div>
                      </CardBody>
                    </Card>
                  ))}
                </div>
              </div>
            </Tab>

            <Tab key="detailed" title="📋 Detailed View">
              <div className="p-6">
                <Table aria-label="Supplies detailed table">
                  <TableHeader>
                    <TableColumn>Supply Item</TableColumn>
                    <TableColumn>Category</TableColumn>
                    <TableColumn>Stock Level</TableColumn>
                    <TableColumn>Cost</TableColumn>
                    <TableColumn>Supplier</TableColumn>
                    <TableColumn>Location</TableColumn>
                    <TableColumn>Last Restocked</TableColumn>
                    <TableColumn>Actions</TableColumn>
                  </TableHeader>
                  <TableBody>
                    {filteredSupplies.map((supply) => (
                      <TableRow key={supply.id} className="hover:bg-gray-50">
                        <TableCell>
                          <div>
                            <p className="font-medium text-ghana-black">{supply.name}</p>
                            <p className="text-sm text-gray-500">ID: {supply.id}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Chip 
                            size="sm" 
                            variant="flat" 
                            color={getCategoryColor(supply.category) as any}
                          >
                            <span className="mr-1">{getCategoryIcon(supply.category)}</span>
                            {getCategoryName(supply.category)}
                          </Chip>
                        </TableCell>
                        <TableCell>
                          <div className="w-full">
                            <div className="flex items-center justify-between text-sm mb-1">
                              <span>{supply.currentStock}/{supply.maximumStock} {supply.unit}</span>
                              <span>{Math.round(getStockPercentage(supply))}%</span>
                            </div>
                            <Progress 
                              value={getStockPercentage(supply)} 
                              color={getStockStatusColor(getStockStatus(supply)) as any}
                              size="sm"
                            />
                            <div className="flex items-center justify-between text-xs text-gray-500 mt-1">
                              <span>Min: {supply.minimumStock}</span>
                              <Badge 
                                color={getStockStatusColor(getStockStatus(supply)) as any}
                                variant="flat"
                                size="sm"
                              >
                                {getStockStatusIcon(getStockStatus(supply))} {getStockStatus(supply)}
                              </Badge>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <div className="font-medium">${supply.costPerUnit}/{supply.unit}</div>
                            <div className="text-gray-500">
                              Total: ${(supply.currentStock * supply.costPerUnit).toFixed(2)}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-gray-600">{supply.supplier}</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-gray-600">{supply.location}</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-gray-600">
                            {new Date(supply.lastRestocked).toLocaleDateString()}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Tooltip content="Edit supply item">
                              <Button
                                size="sm"
                                color="primary"
                                variant="flat"
                                isIconOnly
                                onClick={() => handleEditSupply(supply)}
                              >
                                ✏️
                              </Button>
                            </Tooltip>
                            
                            <Tooltip content="Quick restock (+20)">
                              <Button
                                size="sm"
                                color="success"
                                variant="flat"
                                isIconOnly
                                onClick={() => handleRestock(supply.id, 20)}
                              >
                                +20
                              </Button>
                            </Tooltip>
                            
                            {getStockStatus(supply) === 'low' && (
                              <Tooltip content="Low stock warning">
                                <Button
                                  size="sm"
                                  color="warning"
                                  variant="flat"
                                  isIconOnly
                                >
                                  ⚠️
                                </Button>
                              </Tooltip>
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

      {/* Supply Modal */}
      <Modal isOpen={supplyModalOpen} onClose={() => setSupplyModalOpen(false)} size="2xl">
        <ModalContent>
          <ModalHeader>
            {isCreatingSupply ? 'Add New Supply Item' : 'Edit Supply Item'}
          </ModalHeader>
          <ModalBody>
            <div className="space-y-4">
              {/* Basic Information */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Name *</label>
                  <Input
                    value={supplyForm.name}
                    onChange={(e) => setSupplyForm({...supplyForm, name: e.target.value})}
                    placeholder="Supply item name"
                    isRequired
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Category *</label>
                  <Select
                    value={supplyForm.category}
                    onChange={(e) => setSupplyForm({...supplyForm, category: e.target.value})}
                    placeholder="Select category"
                    isRequired
                  >
                    <SelectItem key="cleaning">🧹 Cleaning</SelectItem>
                    <SelectItem key="bathroom">🚽 Bathroom</SelectItem>
                    <SelectItem key="linens">🛏️ Linens</SelectItem>
                    <SelectItem key="amenities">🛁 Amenities</SelectItem>
                    <SelectItem key="tools">🔧 Tools</SelectItem>
                  </Select>
                </div>
              </div>

              {/* Stock Levels */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Current Stock</label>
                  <Input
                    type="number"
                    value={String(supplyForm.currentStock)}
                    onChange={(e) => setSupplyForm({...supplyForm, currentStock: parseInt(e.target.value) || 0})}
                    placeholder="0"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Minimum Stock</label>
                  <Input
                    type="number"
                    value={String(supplyForm.minimumStock)}
                    onChange={(e) => setSupplyForm({...supplyForm, minimumStock: parseInt(e.target.value) || 10})}
                    placeholder="10"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Maximum Stock</label>
                  <Input
                    type="number"
                    value={String(supplyForm.maximumStock)}
                    onChange={(e) => setSupplyForm({...supplyForm, maximumStock: parseInt(e.target.value) || 100})}
                    placeholder="100"
                    min="0"
                  />
                </div>
              </div>

              {/* Unit and Cost */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Unit</label>
                  <Select
                    value={supplyForm.unit}
                    onChange={(e) => setSupplyForm({...supplyForm, unit: e.target.value})}
                    placeholder="Select unit"
                  >
                    <SelectItem key="pieces">Pieces</SelectItem>
                    <SelectItem key="rolls">Rolls</SelectItem>
                    <SelectItem key="bottles">Bottles</SelectItem>
                    <SelectItem key="boxes">Boxes</SelectItem>
                    <SelectItem key="packs">Packs</SelectItem>
                  </Select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Cost per Unit</label>
                  <Input
                    type="number"
                    value={String(supplyForm.costPerUnit)}
                    onChange={(e) => setSupplyForm({...supplyForm, costPerUnit: parseFloat(e.target.value) || 0})}
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                    startContent={<span className="text-gray-400">$</span>}
                  />
                </div>
              </div>

              {/* Supplier and Location */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Supplier</label>
                  <Input
                    value={supplyForm.supplier}
                    onChange={(e) => setSupplyForm({...supplyForm, supplier: e.target.value})}
                    placeholder="Supplier name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Storage Location</label>
                  <Input
                    value={supplyForm.location}
                    onChange={(e) => setSupplyForm({...supplyForm, location: e.target.value})}
                    placeholder="Storage location"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
                <Textarea
                  value={supplyForm.notes}
                  onChange={(e) => setSupplyForm({...supplyForm, notes: e.target.value})}
                  placeholder="Additional notes about this supply item..."
                  rows={3}
                />
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onClick={() => setSupplyModalOpen(false)}>
              Cancel
            </Button>
            <Button 
              color="primary" 
              onClick={handleSaveSupply}
              isDisabled={!supplyForm.name}
            >
              {isCreatingSupply ? 'Add Supply Item' : 'Update Supply Item'}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
