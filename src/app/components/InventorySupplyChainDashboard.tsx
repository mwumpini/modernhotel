'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { 
  Card, CardBody, CardHeader, Button, Badge, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, 
  Tabs, Tab, Chip, Input, Select, SelectItem, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter,
  useDisclosure, Pagination, Progress, Tooltip, Textarea, Divider, Autocomplete, AutocompleteItem
} from '@heroui/react';
import { useSettingsStore } from '../lib/settings/store';
import { trackEvent } from '../lib/analytics/trackEvent';
import { useStockStore } from '../lib/inventory/stockStore';
import { useSupplierStore } from '../lib/inventory/supplierStore';
import { useAccountingStore } from '../lib/accounting/store';
import { StockItem, Supplier, PurchaseOrder, PurchaseOrderItem, Requisition, RequisitionItem, StockTransfer, StockTransferItem, StockCount, StockCountItem, GoodsReceiptNote, GRNItem, SupplierInvoice, InvoiceItem, QualityCheck } from '../lib/inventory/models';
import { BusinessPartner } from '../lib/accounting/models';

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

// Supplier interface removed - using imported Supplier from models.ts
// PurchaseOrder interface removed - using imported PurchaseOrder from models.ts

export default function InventorySupplyChainDashboard() {
  const [selectedTab, setSelectedTab] = useState('overview');
  const settings = useSettingsStore();

  // Inventory Management Hooks - moved to top level to comply with Rules of Hooks
  const {
    stockItems,
    stockMovements,
    getLowStockItems,
    getOutOfStockItems,
    getOverstockItems,
    getTotalInventoryValue,
    addStockItem,
    updateStockItem,
    deleteStockItem,
    selectStockItem,
    updateStockLevel,
    addStockMovement
  } = useStockStore();

  // Supplier Management Hooks - Linked with Accounting
  const {
    suppliers: supplierStoreSuppliers,
    purchaseOrders: supplierStorePurchaseOrders,
    addSupplier,
    updateSupplier,
    deleteSupplier,
    getActiveSuppliers,
    selectSupplier,
    generateNextSupplierCode,
    createPurchaseOrder,
    updatePurchaseOrder,
    deletePurchaseOrder,
    sendPurchaseOrder,
    confirmPurchaseOrder,
    markInTransit,
    markDelivered,
    cancelPurchaseOrder,
    addPurchaseOrderItem,
    updatePurchaseOrderItem,
    removePurchaseOrderItem,
    selectPurchaseOrder,
    requisitions: supplierStoreRequisitions,
    createRequisition,
    updateRequisition,
    deleteRequisition,
    approveRequisition,
    rejectRequisition,
    convertRequisitionToPO,
    getRequisitionsByStatus,
    selectRequisition,
    goodsReceiptNotes,
    supplierInvoices,
    qualityChecks,
    createGRN,
    updateGRN,
    getGRN,
    getGRNsByPO,
    getGRNsByStatus,
    approveGRN,
    rejectGRN,
    createSupplierInvoice,
    updateSupplierInvoice,
    getSupplierInvoice,
    getInvoicesByPO,
    getInvoicesByStatus,
    performThreeWayMatch,
    approveInvoice,
    rejectInvoice,
    markInvoicePaid,
    createQualityCheck,
    updateQualityCheck,
    getQualityCheck,
    getQualityChecksByGRN,
    completeQualityCheck
  } = useSupplierStore();

  // Accounting Store - for syncing suppliers
  const {
    businessPartners,
    addBusinessPartner,
    updateBusinessPartner,
    deleteBusinessPartner
  } = useAccountingStore();

  // Get suppliers from accounting store (BusinessPartners with type Supplier)
  const accountingSuppliers = useMemo(() => {
    return businessPartners.filter(partner => 
      partner.type === 'Supplier' || partner.type === 'Both'
    );
  }, [businessPartners]);

  // Sync supplier between inventory and accounting stores
  const syncSupplierToAccounting = useCallback((supplier: Supplier, action: 'add' | 'update' | 'delete') => {
    // Convert Supplier (inventory) to BusinessPartner (accounting)
    const businessPartner: Partial<BusinessPartner> = {
      id: supplier.id,
      code: supplier.code,
      name: supplier.name,
      type: 'Supplier',
      taxNumber: supplier.taxId,
      address: supplier.address,
      phone: supplier.phone,
      email: supplier.email,
      contactPerson: supplier.contactPerson,
      creditLimit: supplier.creditLimit,
      paymentTerms: supplier.paymentTerms === 'immediate' ? 0 :
                     supplier.paymentTerms === 'net30' ? 30 :
                     supplier.paymentTerms === 'net60' ? 60 :
                     supplier.paymentTerms === 'net90' ? 90 : 30,
      balance: supplier.currentBalance,
      isActive: supplier.isActive,
      countryCode: supplier.country === 'Ghana' ? 'GH' : 'US',
      currency: 'GHS',
      glAccountCode: '2100', // Accounts Payable default account
      createdAt: supplier.createdAt.toISOString(),
      updatedAt: supplier.updatedAt.toISOString()
    };

    if (action === 'add') {
      // Check if already exists in accounting
      const exists = accountingSuppliers.find(bp => bp.id === supplier.id || bp.code === supplier.code);
      if (!exists) {
        addBusinessPartner(businessPartner as BusinessPartner);
        trackEvent('Stores.Issued', { 
          action: 'sync_supplier_to_accounting', 
          supplierCode: supplier.code 
        });
      }
    } else if (action === 'update') {
      const existing = accountingSuppliers.find(bp => bp.id === supplier.id || bp.code === supplier.code);
      if (existing) {
        updateBusinessPartner(existing.id, businessPartner);
        trackEvent('Stores.Issued', { 
          action: 'update_supplier_in_accounting', 
          supplierCode: supplier.code 
        });
      } else {
        // If doesn't exist, add it
        addBusinessPartner(businessPartner as BusinessPartner);
        trackEvent('Stores.Issued', { 
          action: 'add_supplier_to_accounting', 
          supplierCode: supplier.code 
        });
      }
    } else if (action === 'delete') {
      const existing = accountingSuppliers.find(bp => bp.id === supplier.id || bp.code === supplier.code);
      if (existing) {
        deleteBusinessPartner(existing.id);
        trackEvent('Stores.Issued', { 
          action: 'delete_supplier_from_accounting', 
          supplierCode: supplier.code 
        });
      }
    }
  }, [businessPartners, accountingSuppliers, addBusinessPartner, updateBusinessPartner, deleteBusinessPartner]);

  // Sync accounting supplier to inventory store
  const syncAccountingToInventory = useCallback((businessPartner: BusinessPartner) => {
    if (businessPartner.type !== 'Supplier' && businessPartner.type !== 'Both') return;

    const supplier: Omit<Supplier, 'id' | 'createdAt' | 'updatedAt'> = {
      code: businessPartner.code,
      name: businessPartner.name,
      contactPerson: businessPartner.contactPerson || '',
      email: businessPartner.email || '',
      phone: businessPartner.phone || '',
      address: businessPartner.address || '',
      city: '', // Accounting model doesn't have city, will need to parse from address
      country: businessPartner.countryCode === 'GH' ? 'Ghana' : businessPartner.countryCode,
      postalCode: '',
      taxId: businessPartner.taxNumber || '',
      paymentTerms: businessPartner.paymentTerms === 0 ? 'immediate' :
                    businessPartner.paymentTerms === 30 ? 'net30' :
                    businessPartner.paymentTerms === 60 ? 'net60' :
                    businessPartner.paymentTerms === 90 ? 'net90' : 'net30',
      creditLimit: businessPartner.creditLimit || 0,
      currentBalance: businessPartner.balance || 0,
      rating: 0, // Accounting doesn't track rating
      categories: [], // Accounting doesn't track categories
      isActive: businessPartner.isActive,
      contractStartDate: new Date(businessPartner.createdAt),
      performance: {
        onTimeDelivery: 0,
        qualityRating: 0,
        responseTime: 0,
        totalOrders: 0
      }
    };

    // Check if supplier already exists
    const exists = supplierStoreSuppliers.find(s => s.id === businessPartner.id || s.code === businessPartner.code);
    if (exists) {
      updateSupplier(exists.id, supplier as Partial<Supplier>, true); // Skip sync to avoid circular update
    } else {
      // Preserve the accounting ID when syncing
      addSupplier({
        ...supplier,
        id: businessPartner.id,
        createdAt: new Date(businessPartner.createdAt)
      }, true); // Skip sync back to accounting since we're syncing FROM accounting
    }
  }, [supplierStoreSuppliers, addSupplier, updateSupplier]);

  // Inventory search and filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterLocation, setFilterLocation] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [page, setPage] = useState(1);
  const rowsPerPage = 10;

  // Supplier Management state
  const [supplierSearchTerm, setSupplierSearchTerm] = useState('');
  const [supplierFilterStatus, setSupplierFilterStatus] = useState<string>('all');
  const [supplierFilterCategory, setSupplierFilterCategory] = useState<string>('all');
  const [supplierFilterPaymentTerms, setSupplierFilterPaymentTerms] = useState<string>('all');
  const [supplierPage, setSupplierPage] = useState(1);
  const supplierRowsPerPage = 10;
  
  // Inventory modals
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [viewOpen, setViewOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<StockItem | null>(null);
  const [formData, setFormData] = useState<Partial<StockItem>>({});
  const [viewingItem, setViewingItem] = useState<StockItem | null>(null);

  // Supplier modals
  const { isOpen: isSupplierModalOpen, onOpen: onSupplierModalOpen, onClose: onSupplierModalClose } = useDisclosure();
  const [supplierViewOpen, setSupplierViewOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [supplierFormData, setSupplierFormData] = useState<Partial<Supplier>>({});
  const [viewingSupplier, setViewingSupplier] = useState<Supplier | null>(null);

  // Get unique values for filters
  const categories = useMemo(() => {
    const cats = [...new Set(stockItems.map(item => item.category))];
    return cats.sort();
  }, [stockItems]);

  const inventoryLocations = useMemo(() => {
    const locs = [...new Set(stockItems.map(item => item.location))];
    return locs.sort();
  }, [stockItems]);

  // Filter and search stock items
  const filteredItems = useMemo(() => {
    return stockItems.filter(item => {
      const matchesSearch = 
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.itemCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.description?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesCategory = filterCategory === 'all' || item.category === filterCategory;
      const matchesLocation = filterLocation === 'all' || item.location === filterLocation;
      const matchesStatus = filterStatus === 'all' || 
        (filterStatus === 'active' && item.isActive) ||
        (filterStatus === 'inactive' && !item.isActive) ||
        (filterStatus === 'low-stock' && item.isActive && item.currentStock > 0 && item.currentStock <= item.reorderPoint) ||
        (filterStatus === 'out-of-stock' && item.isActive && (item.currentStock === 0 || item.currentStock < item.minimumStock)) ||
        (filterStatus === 'overstock' && item.isActive && item.currentStock > item.maximumStock * 0.8);
      
      return matchesSearch && matchesCategory && matchesLocation && matchesStatus;
    });
  }, [stockItems, searchTerm, filterCategory, filterLocation, filterStatus]);

  // Pagination
  const pages = Math.ceil(filteredItems.length / rowsPerPage);
  const paginatedItems = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    return filteredItems.slice(start, start + rowsPerPage);
  }, [filteredItems, page]);

  // Calculate summary metrics for inventory management
  const stockItemsTotal = stockItems.length;
  const lowStockItems = getLowStockItems();
  const outOfStockItems = getOutOfStockItems();
  const overstockItems = getOverstockItems();
  const lowStockCount = lowStockItems.length;
  const outOfStockCount = outOfStockItems.length;
  const overstockCount = overstockItems.length;
  const totalValue = getTotalInventoryValue();

  // Handle form operations
  const handleAddItem = () => {
    setEditingItem(null);
    setFormData({
      itemCode: '',
      name: '',
      description: '',
      category: 'food',
      subcategory: '',
      unit: '',
      unitCost: 0,
      currentStock: 0,
      minimumStock: 0,
      maximumStock: 0,
      reorderPoint: 0,
      location: '',
      isActive: true,
      isPerishable: false,
      isSerialized: false
    });
    onOpen();
  };

  const handleEditItem = (item: StockItem) => {
    setEditingItem(item);
    setFormData({ ...item });
    onOpen();
  };

  const handleViewItem = (item: StockItem) => {
    setViewingItem(item);
    selectStockItem(item);
    setViewOpen(true);
  };

  const handleSaveItem = () => {
    if (editingItem) {
      updateStockItem(editingItem.id, formData as Partial<StockItem>);
      trackEvent('Stores.Issued', { action: 'update_item', itemCode: editingItem.itemCode });
    } else {
      addStockItem({
        ...formData,
        supplierId: formData.supplierId || undefined,
        supplierName: formData.supplierName || undefined,
        id: '',
        createdAt: new Date(),
        updatedAt: new Date()
      } as Omit<StockItem, 'id' | 'createdAt' | 'updatedAt'>);
      trackEvent('Stores.Issued', { action: 'add_item', itemCode: formData.itemCode });
    }
    onClose();
    setFormData({});
    setEditingItem(null);
  };

  const handleDeleteItem = (itemId: string) => {
    if (confirm('Are you sure you want to delete this item?')) {
      deleteStockItem(itemId);
      trackEvent('Stores.Issued', { action: 'delete_item', itemId });
    }
  };

  const getStockStatus = (item: StockItem) => {
    if (item.currentStock <= item.reorderPoint) return { label: 'Low Stock', color: 'danger' };
    if (item.currentStock > item.maximumStock * 0.8) return { label: 'Overstock', color: 'warning' };
    if (!item.isActive) return { label: 'Inactive', color: 'default' };
    return { label: 'In Stock', color: 'success' };
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, 'success' | 'primary' | 'warning' | 'secondary' | 'danger' | 'default'> = {
      food: 'success',
      beverage: 'primary',
      cleaning: 'warning',
      maintenance: 'secondary',
      office: 'default',
      linens: 'primary',
      amenities: 'secondary',
      electronics: 'warning',
      furniture: 'default',
      other: 'default'
    };
    return colors[category] || 'default';
  };

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

  // Using suppliers and purchase orders from store - no local array needed

  // Purchase Order state
  const { isOpen: isPOModalOpen, onOpen: onPOModalOpen, onClose: onPOModalClose } = useDisclosure();
  const { isOpen: isPOViewOpen, onOpen: onPOViewOpen, onClose: onPOViewClose } = useDisclosure();
  const [editingPO, setEditingPO] = useState<PurchaseOrder | null>(null);
  const [viewingPO, setViewingPO] = useState<PurchaseOrder | null>(null);
  const [poFormData, setPOFormData] = useState<Partial<PurchaseOrder> & { items?: PurchaseOrderItem[]; taxType?: string; taxRate?: number }>({
    status: 'draft',
    priority: 'medium',
    currency: 'GHS',
    taxAmount: 0,
    shippingAmount: 0,
    discountAmount: 0,
    items: [],
    paymentTerms: '[N/30]',
    taxType: 'none',
    taxRate: 0
  });

  // Tax type options
  const taxOptions = [
    { value: 'none', label: 'None', rate: 0 },
    { value: 'vat', label: 'VAT (15%)', rate: 15 },
    { value: 'nhil', label: 'NHIL (2.5%)', rate: 2.5 },
    { value: 'getfund', label: 'GETFund (2.5%)', rate: 2.5 },
    { value: 'tourism', label: 'Tourism Levy (1%)', rate: 1 },
    { value: 'custom', label: 'Custom Rate', rate: 0 }
  ];
  const [poSearchTerm, setPOSearchTerm] = useState('');
  const [poFilterStatus, setPOFilterStatus] = useState<string>('all');
  const [poPage, setPOPage] = useState(1);
  const poRowsPerPage = 10;

  // Requisition state
  const { isOpen: isRequisitionModalOpen, onOpen: onRequisitionModalOpen, onClose: onRequisitionModalClose } = useDisclosure();
  const { isOpen: isRequisitionViewOpen, onOpen: onRequisitionViewOpen, onClose: onRequisitionViewClose } = useDisclosure();
  const [editingRequisition, setEditingRequisition] = useState<Requisition | null>(null);
  const [viewingRequisition, setViewingRequisition] = useState<Requisition | null>(null);
  const [requisitionFormData, setRequisitionFormData] = useState<Partial<Requisition> & { requestedItems?: RequisitionItem[] }>({
    status: 'pending',
    requestedItems: [],
    requestedDate: new Date(),
    requestedBy: 'Current User' // TODO: Get from auth context
  });
  const [requisitionSearchTerm, setRequisitionSearchTerm] = useState('');
  const [requisitionFilterStatus, setRequisitionFilterStatus] = useState<string>('all');
  const [requisitionPage, setRequisitionPage] = useState(1);
  const requisitionRowsPerPage = 10;

  // Calculate metrics for overview
  const overviewTotalItems = stockItems.length;
  const activeSuppliersOverview = getActiveSuppliers().length;
  const pendingPOs = supplierStorePurchaseOrders.filter(po => po.status === 'sent' || po.status === 'confirmed' || po.status === 'in-transit').length;

  // Alert click handlers - navigate to inventory tab with filters
  const handleLowStockClick = () => {
    setSelectedTab('inventory');
    setFilterStatus('low-stock');
  };

  const handleOutOfStockClick = () => {
    setSelectedTab('inventory');
    setFilterStatus('out-of-stock');
  };

  const handleOverstockClick = () => {
    setSelectedTab('inventory');
    setFilterStatus('overstock');
  };

  const renderOverview = () => (
    <div className="space-y-6">
    </div>
  );

  const renderInventoryManagement = () => {
    return (
    <div className="space-y-6">
        {/* Stock Alert Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card 
            className="border-0 shadow-lg hover:shadow-xl transition-shadow cursor-pointer border-l-4 border-l-orange-500"
            isPressable
            onPress={handleLowStockClick}
          >
            <CardBody className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-2xl">⚠️</span>
                    <p className="text-sm font-medium text-gray-600">Low Stock Alerts</p>
                  </div>
                  <p className="text-3xl font-bold text-orange-600">{lowStockCount}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <Chip size="sm" color="success" variant="flat">active</Chip>
                    <p className="text-xs text-gray-500">Click to view items</p>
                  </div>
                </div>
              </div>
            </CardBody>
          </Card>
          
          <Card 
            className="border-0 shadow-lg hover:shadow-xl transition-shadow cursor-pointer border-l-4 border-l-red-500"
            isPressable
            onPress={handleOutOfStockClick}
          >
            <CardBody className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-2xl">❌</span>
                    <p className="text-sm font-medium text-gray-600">Out of Stock</p>
                  </div>
                  <p className="text-3xl font-bold text-red-600">{outOfStockCount}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <Chip size="sm" color="success" variant="flat">active</Chip>
                    <p className="text-xs text-gray-500">Click to view items</p>
                  </div>
                </div>
              </div>
            </CardBody>
          </Card>
          
          <Card 
            className="border-0 shadow-lg hover:shadow-xl transition-shadow cursor-pointer border-l-4 border-l-yellow-500"
            isPressable
            onPress={handleOverstockClick}
          >
            <CardBody className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-2xl">📈</span>
                    <p className="text-sm font-medium text-gray-600">Overstock Items</p>
                  </div>
                  <p className="text-3xl font-bold text-yellow-600">{overstockCount}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <Chip size="sm" color="success" variant="flat">active</Chip>
                    <p className="text-xs text-gray-500">Click to view items</p>
                  </div>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="border-0 shadow-lg">
            <CardBody className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Items</p>
                  <p className="text-2xl font-bold text-ghana-black">{stockItemsTotal}</p>
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
                  <p className="text-2xl font-bold text-red-600">{lowStockCount}</p>
                </div>
                <div className="text-3xl">⚠️</div>
              </div>
            </CardBody>
          </Card>
          
          <Card className="border-0 shadow-lg">
            <CardBody className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Inventory Value</p>
                  <p className="text-2xl font-bold text-green-600">₵{totalValue.toLocaleString()}</p>
                </div>
                <div className="text-3xl">💰</div>
              </div>
            </CardBody>
          </Card>
          
          <Card className="border-0 shadow-lg">
            <CardBody className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Categories</p>
                  <p className="text-2xl font-bold text-blue-600">{categories.length}</p>
                </div>
                <div className="text-3xl">📊</div>
              </div>
            </CardBody>
          </Card>
        </div>

        {/* Filters and Search */}
        <Card className="border-0 shadow-lg">
          <CardBody>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <Input
                placeholder="Search items..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                startContent={<span className="text-gray-400">🔍</span>}
                className="md:col-span-2"
              />
              
              <Select
                placeholder="Category"
                selectedKeys={[filterCategory]}
                onSelectionChange={(keys) => setFilterCategory(Array.from(keys)[0] as string)}
              >
                <SelectItem key="all">All Categories</SelectItem>
                <>
                  {categories.map(cat => (
                    <SelectItem key={cat}>{cat}</SelectItem>
                  ))}
                </>
              </Select>

              <Select
                placeholder="Location"
                selectedKeys={[filterLocation]}
                onSelectionChange={(keys) => setFilterLocation(Array.from(keys)[0] as string)}
              >
                <SelectItem key="all">All Locations</SelectItem>
                <>
                  {inventoryLocations.map(loc => (
                    <SelectItem key={loc}>{loc}</SelectItem>
                  ))}
                </>
              </Select>

              <Select
                placeholder="Status"
                selectedKeys={[filterStatus]}
                onSelectionChange={(keys) => setFilterStatus(Array.from(keys)[0] as string)}
              >
                <SelectItem key="all">All Status</SelectItem>
                <SelectItem key="active">Active</SelectItem>
                <SelectItem key="inactive">Inactive</SelectItem>
                <SelectItem key="low-stock">Low Stock</SelectItem>
                <SelectItem key="out-of-stock">Out of Stock</SelectItem>
                <SelectItem key="overstock">Overstock</SelectItem>
              </Select>
            </div>
          </CardBody>
        </Card>

        {/* Main Table */}
      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-3">
            <div className="flex items-center justify-between w-full">
              <h3 className="text-xl font-semibold text-ghana-black">📦 Stock Items ({filteredItems?.length || 0})</h3>
            <Button
              color="primary"
              className="bg-ghana-green text-white"
              variant="flat"
                startContent={<span>➕</span>}
                onClick={handleAddItem}
            >
                Add Item
            </Button>
          </div>
        </CardHeader>
        <CardBody>
            <Table aria-label="Stock items table">
            <TableHeader>
                <TableColumn>ITEM CODE</TableColumn>
                <TableColumn>NAME</TableColumn>
                <TableColumn>CATEGORY</TableColumn>
                <TableColumn>UNIT</TableColumn>
                <TableColumn className="text-right">CURRENT STOCK</TableColumn>
                <TableColumn className="text-right">REORDER POINT</TableColumn>
                <TableColumn className="text-right">UNIT COST</TableColumn>
                <TableColumn className="text-right">STOCK VALUE</TableColumn>
                <TableColumn>LOCATION</TableColumn>
                <TableColumn>STATUS</TableColumn>
                <TableColumn>ACTIONS</TableColumn>
            </TableHeader>
              <TableBody emptyContent="No stock items found.">
                {paginatedItems.map((item) => {
                  const stockStatus = getStockStatus(item);
                  const stockValue = item.currentStock * item.unitCost;
                  const stockPercentage = (item.currentStock / item.maximumStock) * 100;
                  
                  return (
                <TableRow key={item.id}>
                      <TableCell>
                        <span className="font-mono font-semibold">{item.itemCode}</span>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-semibold">{item.name}</div>
                          {item.description && (
                            <div className="text-xs text-gray-500 truncate max-w-xs">{item.description}</div>
                          )}
                        </div>
                      </TableCell>
                  <TableCell>
                    <Chip 
                          color={getCategoryColor(item.category)} 
                      size="sm" 
                      variant="flat"
                    >
                      {item.category}
                    </Chip>
                  </TableCell>
                  <TableCell>
                        <span className="font-mono text-sm">{item.unit}</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-col items-end">
                    <div className={`font-semibold ${
                      item.currentStock <= item.reorderPoint ? 'text-red-600' :
                      item.currentStock <= item.reorderPoint * 1.5 ? 'text-orange-600' :
                      'text-green-600'
                    }`}>
                            {item.currentStock.toLocaleString()}
                          </div>
                          <Progress 
                            value={stockPercentage} 
                            size="sm" 
                            color={
                              item.currentStock <= item.reorderPoint ? 'danger' :
                              item.currentStock <= item.reorderPoint * 1.5 ? 'warning' :
                              'success'
                            }
                            className="w-16 mt-1"
                          />
                          <div className="text-xs text-gray-500 mt-1">
                            Max: {item.maximumStock}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="font-medium">{item.reorderPoint}</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="font-semibold">₵{item.unitCost.toLocaleString()}</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="font-semibold text-blue-600">
                          ₵{stockValue.toLocaleString()}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div>{item.location}</div>
                          {item.binLocation && (
                            <div className="text-xs text-gray-500">Bin: {item.binLocation}</div>
                          )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge 
                          color={stockStatus.color as any}
                      size="sm"
                          variant="flat"
                    >
                          {stockStatus.label}
                    </Badge>
                        {item.isPerishable && (
                          <Chip size="sm" variant="flat" color="warning" className="ml-1 mt-1">
                            🍃 Perishable
                          </Chip>
                        )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                          <Tooltip content="View Details">
                            <Button 
                              size="sm" 
                              variant="flat" 
                              color="primary"
                              onClick={() => handleViewItem(item)}
                            >
                              👁️
                            </Button>
                          </Tooltip>
                          <Tooltip content="Edit">
                            <Button 
                              size="sm" 
                              variant="flat" 
                              color="warning"
                              onClick={() => handleEditItem(item)}
                            >
                              ✏️
                      </Button>
                          </Tooltip>
                          <Tooltip content="Delete">
                            <Button 
                              size="sm" 
                              variant="flat" 
                              color="danger"
                              onClick={() => handleDeleteItem(item.id)}
                            >
                              🗑️
                      </Button>
                          </Tooltip>
                    </div>
                  </TableCell>
                </TableRow>
                  );
                })}
            </TableBody>
          </Table>
            
            {pages > 1 && (
              <div className="flex justify-center mt-4">
                <Pagination 
                  total={pages} 
                  page={page} 
                  onChange={setPage}
                  showControls
                />
              </div>
            )}
          </CardBody>
      </Card>
    </div>
  );
  };

  // Sync accounting suppliers to inventory store (side effect - use useEffect)
  useEffect(() => {
    accountingSuppliers.forEach(bp => {
      if (bp.type !== 'Supplier' && bp.type !== 'Both') return;
      
      const exists = supplierStoreSuppliers.find(
        s => s.id === bp.id || s.code === bp.code
      );
      
      if (!exists) {
        syncAccountingToInventory(bp);
      }
    });
  }, [accountingSuppliers, supplierStoreSuppliers, syncAccountingToInventory]);

  // Merge suppliers from both stores, prioritizing inventory store data
  const mergedSuppliers = useMemo(() => {
    // Use a Map to ensure unique suppliers by ID
    const suppliersMap = new Map<string, Supplier>();
    
    // First, add all inventory suppliers
    supplierStoreSuppliers.forEach(supplier => {
      suppliersMap.set(supplier.id, supplier);
    });
    
    // Then merge in accounting suppliers, updating existing ones
    accountingSuppliers.forEach(bp => {
      if (bp.type !== 'Supplier' && bp.type !== 'Both') return;
      
      // Check if supplier exists by ID or code
      const existingSupplier = Array.from(suppliersMap.values()).find(
        s => s.id === bp.id || s.code === bp.code
      );
      
      if (existingSupplier) {
        // Update existing supplier with accounting data (source of truth for financial data)
        suppliersMap.set(existingSupplier.id, {
          ...existingSupplier,
          currentBalance: bp.balance ?? existingSupplier.currentBalance,
          creditLimit: bp.creditLimit ?? existingSupplier.creditLimit,
          isActive: bp.isActive !== undefined ? bp.isActive : existingSupplier.isActive
        });
      }
      // If supplier doesn't exist, it will be synced by useEffect and will appear on next render
    });
    
    // Convert map to array and ensure no duplicates by ID (final safety check)
    const merged = Array.from(suppliersMap.values());
    
    // Final deduplication check - keep only first occurrence of each ID
    const seenIds = new Set<string>();
    const uniqueSuppliers = merged.filter(supplier => {
      if (seenIds.has(supplier.id)) {
        return false;
      }
      seenIds.add(supplier.id);
      return true;
    });
    
    return uniqueSuppliers;
  }, [supplierStoreSuppliers, accountingSuppliers]);

  // Supplier filter and search logic
  const supplierCategories = useMemo(() => {
    const cats = new Set<string>();
    mergedSuppliers.forEach(s => s.categories.forEach(c => cats.add(c)));
    return Array.from(cats).sort();
  }, [mergedSuppliers]);

  const filteredSuppliers = useMemo(() => {
    // First ensure no duplicates in mergedSuppliers (safety check)
    const seenIds = new Set<string>();
    const uniqueMerged = mergedSuppliers.filter(supplier => {
      if (seenIds.has(supplier.id)) {
        console.warn(`Duplicate supplier detected with ID: ${supplier.id}, removing duplicate`);
        return false;
      }
      seenIds.add(supplier.id);
      return true;
    });
    
    return uniqueMerged.filter(supplier => {
      const matchesSearch = 
        supplier.name.toLowerCase().includes(supplierSearchTerm.toLowerCase()) ||
        supplier.code.toLowerCase().includes(supplierSearchTerm.toLowerCase()) ||
        supplier.contactPerson.toLowerCase().includes(supplierSearchTerm.toLowerCase()) ||
        supplier.email.toLowerCase().includes(supplierSearchTerm.toLowerCase()) ||
        supplier.phone.toLowerCase().includes(supplierSearchTerm.toLowerCase()) ||
        supplier.city.toLowerCase().includes(supplierSearchTerm.toLowerCase());
      
      const matchesStatus = supplierFilterStatus === 'all' || 
        (supplierFilterStatus === 'active' && supplier.isActive) ||
        (supplierFilterStatus === 'inactive' && !supplier.isActive);
      
      const matchesCategory = supplierFilterCategory === 'all' || 
        supplier.categories.includes(supplierFilterCategory);
      
      const matchesPaymentTerms = supplierFilterPaymentTerms === 'all' || 
        supplier.paymentTerms === supplierFilterPaymentTerms;
      
      return matchesSearch && matchesStatus && matchesCategory && matchesPaymentTerms;
    });
  }, [mergedSuppliers, supplierSearchTerm, supplierFilterStatus, supplierFilterCategory, supplierFilterPaymentTerms]);

  const supplierPages = Math.ceil(filteredSuppliers.length / supplierRowsPerPage);
  const paginatedSuppliers = useMemo(() => {
    const start = (supplierPage - 1) * supplierRowsPerPage;
    return filteredSuppliers.slice(start, start + supplierRowsPerPage);
  }, [filteredSuppliers, supplierPage]);

  // Calculate supplier metrics
  const totalSuppliers = mergedSuppliers.length;
  const activeSuppliersCount = mergedSuppliers.filter(s => s.isActive).length;
  const totalCreditLimit = useMemo(() => 
    mergedSuppliers.reduce((sum, s) => sum + s.creditLimit, 0), 
    [mergedSuppliers]
  );
  const totalCurrentBalance = useMemo(() => 
    mergedSuppliers.reduce((sum, s) => sum + s.currentBalance, 0), 
    [mergedSuppliers]
  );
  const averageRating = useMemo(() => {
    if (mergedSuppliers.length === 0) return 0;
    const sum = mergedSuppliers.reduce((acc, s) => acc + s.rating, 0);
    return sum / mergedSuppliers.length;
  }, [mergedSuppliers]);

  // Supplier handlers
  const handleAddSupplier = () => {
    setEditingSupplier(null);
    const nextCode = generateNextSupplierCode();
    setSupplierFormData({
      code: nextCode,
      name: '',
      contactPerson: '',
      email: '',
      phone: '',
      address: '',
      city: '',
      country: 'Ghana',
      postalCode: '',
      taxId: '',
      paymentTerms: 'net30',
      creditLimit: 0,
      currentBalance: 0,
      rating: 0,
      categories: [],
      isActive: true,
      contractStartDate: new Date(),
      performance: {
        onTimeDelivery: 0,
        qualityRating: 0,
        responseTime: 0,
        totalOrders: 0
      }
    });
    onSupplierModalOpen();
  };

  const handleEditSupplier = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setSupplierFormData({ ...supplier });
    onSupplierModalOpen();
  };

  const handleViewSupplier = (supplier: Supplier) => {
    setViewingSupplier(supplier);
    selectSupplier(supplier);
    setSupplierViewOpen(true);
  };

  const handleSaveSupplier = () => {
    if (editingSupplier) {
      // Update in inventory store
      const updatedSupplier = { ...editingSupplier, ...supplierFormData, updatedAt: new Date() } as Supplier;
      updateSupplier(editingSupplier.id, supplierFormData as Partial<Supplier>);
      
      // Sync to accounting store
      syncSupplierToAccounting(updatedSupplier, 'update');
      
      trackEvent('Stores.Issued', { action: 'update_supplier', supplierCode: editingSupplier.code });
    } else {
      // Add new supplier
      const newSupplier: Supplier = {
        ...supplierFormData,
        id: Date.now().toString(),
        createdAt: new Date(),
        updatedAt: new Date(),
        code: supplierFormData.code || '',
        name: supplierFormData.name || '',
        contactPerson: supplierFormData.contactPerson || '',
        email: supplierFormData.email || '',
        phone: supplierFormData.phone || '',
        address: supplierFormData.address || '',
        city: supplierFormData.city || '',
        country: supplierFormData.country || 'Ghana',
        postalCode: supplierFormData.postalCode || '',
        taxId: supplierFormData.taxId || '',
        paymentTerms: supplierFormData.paymentTerms || 'net30',
        creditLimit: supplierFormData.creditLimit || 0,
        currentBalance: supplierFormData.currentBalance || 0,
        rating: supplierFormData.rating || 0,
        categories: supplierFormData.categories || [],
        isActive: supplierFormData.isActive !== undefined ? supplierFormData.isActive : true,
        contractStartDate: supplierFormData.contractStartDate || new Date(),
        performance: supplierFormData.performance || {
          onTimeDelivery: 0,
          qualityRating: 0,
          responseTime: 0,
          totalOrders: 0
        }
      } as Supplier;

      // Add new supplier (we're in the else block, so editingSupplier is null)
      addSupplier(newSupplier);
      
      // Sync to accounting store
      syncSupplierToAccounting(newSupplier, 'add');
      
      trackEvent('Stores.Issued', { action: 'add_supplier', supplierCode: supplierFormData.code });
    }
    onSupplierModalClose();
    setSupplierFormData({});
    setEditingSupplier(null);
  };

  // Purchase Order handlers
  const generatePONumber = () => {
    const year = new Date().getFullYear();
    const count = supplierStorePurchaseOrders.length + 1;
    return `PO-${year}-${String(count).padStart(3, '0')}`;
  };

  const handleAddPO = () => {
    setEditingPO(null);
    const poNumber = generatePONumber();
    setPOFormData({
      poNumber,
      supplierId: '',
      supplierName: '',
      orderDate: new Date(),
      expectedDeliveryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      status: 'draft',
      priority: 'medium',
      totalAmount: 0,
      taxAmount: 0,
      shippingAmount: 0,
      discountAmount: 0,
      finalAmount: 0,
      currency: 'GHS',
      paymentTerms: '[N/30]',
      notes: '',
      items: [],
      createdBy: 'Current User', // TODO: Get from auth context
      taxType: 'none',
      taxRate: 0
    });
    onPOModalOpen();
  };

  const handleEditPO = (po: PurchaseOrder) => {
    setEditingPO(po);
    // Calculate taxRate from existing taxAmount if taxType is not set
    let taxType = (po as any).taxType || 'none';
    let taxRate = (po as any).taxRate || 0;
    
    if (taxType === 'none' && po.taxAmount > 0 && po.totalAmount > 0) {
      // Calculate rate from existing tax amount (backward compatibility)
      taxRate = (po.taxAmount / po.totalAmount) * 100;
      // Find closest matching tax type
      const closestTax = taxOptions.find(opt => Math.abs(opt.rate - taxRate) < 0.1);
      taxType = closestTax?.value || 'custom';
    }
    
    setPOFormData({ 
      ...po, 
      taxType,
      taxRate,
      items: po.items || []
    });
    onPOModalOpen();
  };

  const handleViewPO = (po: PurchaseOrder) => {
    setViewingPO(po);
    selectPurchaseOrder(po);
    onPOViewOpen();
  };

  const handleSavePO = () => {
    if (!poFormData.supplierId || !poFormData.supplierName) {
      alert('Please select a supplier');
      return;
    }

    if (!poFormData.items || poFormData.items.length === 0) {
      alert('Please add at least one item to the purchase order');
      return;
    }

    // Calculate totals
    const subtotal = poFormData.items.reduce((sum, item) => sum + (item.quantity * item.unitCost), 0);
    const taxRate = poFormData.taxRate || 0;
    const tax = (subtotal * taxRate) / 100; // Calculate tax based on selected rate
    const shipping = poFormData.shippingAmount || 0;
    const discount = poFormData.discountAmount || 0;
    const finalAmount = subtotal + tax + shipping - discount;

    const poData: Omit<PurchaseOrder, 'id' | 'createdAt' | 'updatedAt'> = {
      poNumber: poFormData.poNumber || generatePONumber(),
      supplierId: poFormData.supplierId,
      supplierName: poFormData.supplierName,
      orderDate: poFormData.orderDate || new Date(),
      expectedDeliveryDate: poFormData.expectedDeliveryDate || new Date(),
      status: poFormData.status || 'draft',
      priority: poFormData.priority || 'medium',
      totalAmount: subtotal,
      taxAmount: tax,
      shippingAmount: shipping,
      discountAmount: discount,
      finalAmount: finalAmount,
      currency: poFormData.currency || 'GHS',
      paymentTerms: poFormData.paymentTerms || 'net30',
      notes: poFormData.notes,
      items: poFormData.items,
      createdBy: poFormData.createdBy || 'Current User',
    };

    if (editingPO) {
      updatePurchaseOrder(editingPO.id, poData);
      trackEvent('Stores.Issued', { action: 'update_po', poNumber: editingPO.poNumber });
    } else {
      createPurchaseOrder(poData);
      trackEvent('Stores.Issued', { action: 'create_po', poNumber: poData.poNumber });
    }
    
    onPOModalClose();
    setPOFormData({
      status: 'draft',
      priority: 'medium',
      currency: 'GHS',
      taxAmount: 0,
      shippingAmount: 0,
      discountAmount: 0,
      items: [],
      paymentTerms: '[N/30]',
      taxType: 'none',
      taxRate: 0
    });
    setEditingPO(null);
  };

  const handleAddPOItem = () => {
    const newItem: PurchaseOrderItem = {
      id: Date.now().toString(),
      itemId: '',
      itemCode: '',
      itemName: '',
      quantity: 1,
      unitCost: 0,
      totalCost: 0,
      receivedQuantity: 0,
      notes: ''
    };
    setPOFormData({
      ...poFormData,
      items: [...(poFormData.items || []), newItem]
    });
  };

  const handleUpdatePOItem = (itemId: string, updates: Partial<PurchaseOrderItem>) => {
    const updatedItems = (poFormData.items || []).map(item => {
      if (item.id === itemId) {
        const updated = { ...item, ...updates };
        updated.totalCost = updated.quantity * updated.unitCost;
        return updated;
      }
      return item;
    });
    setPOFormData({ ...poFormData, items: updatedItems });
  };

  const handleRemovePOItem = (itemId: string) => {
    setPOFormData({
      ...poFormData,
      items: (poFormData.items || []).filter(item => item.id !== itemId)
    });
  };

  const handlePOSupplierChange = (supplierId: string) => {
    const supplier = supplierStoreSuppliers.find(s => s.id === supplierId);
    if (supplier) {
      setPOFormData({
        ...poFormData,
        supplierId: supplier.id,
        supplierName: supplier.name,
        paymentTerms: supplier.paymentTerms || 'net30'
      });
    }
  };

  const handlePOItemChange = (itemCode: string, itemIndex: number) => {
    const item = stockItems.find(i => i.itemCode === itemCode);
    if (item) {
      const currentItems = [...(poFormData.items || [])];
      currentItems[itemIndex] = {
        ...currentItems[itemIndex],
        itemId: item.id,
        itemCode: item.itemCode,
        itemName: item.name,
        unitCost: item.unitCost
      };
      currentItems[itemIndex].totalCost = currentItems[itemIndex].quantity * currentItems[itemIndex].unitCost;
      setPOFormData({ ...poFormData, items: currentItems });
      
      // Clear the search term for this index after selection to show the selected item
      setPOItemSearchTerms((prev: Record<number, string>) => {
        const updated = { ...prev };
        delete updated[itemIndex];
        return updated;
      });
    }
  };

  // Item search state for PO form
  const [poItemSearchTerms, setPOItemSearchTerms] = useState<Record<number, string>>({});

  const getFilteredPOItemsForIndex = (index: number) => {
    const searchTerm = (poItemSearchTerms[index] || '').toLowerCase();
    if (!searchTerm) return stockItems.slice(0, 20); // Limit results when no search
    
    return stockItems.filter(item => 
      item.itemCode.toLowerCase().includes(searchTerm) ||
      item.name.toLowerCase().includes(searchTerm) ||
      item.description?.toLowerCase().includes(searchTerm)
    ).slice(0, 20);
  };

  const handleGeneratePOPDF = () => {
    if (!poFormData.items || poFormData.items.length === 0) {
      alert('Please add items to generate PDF');
      return;
    }

    // Generate PDF content
    const subtotal = (poFormData.items || []).reduce((sum, item) => sum + item.totalCost, 0);
    const taxRate = poFormData.taxRate || 0;
    const taxAmount = (subtotal * taxRate) / 100;
    const shipping = poFormData.shippingAmount || 0;
    const discount = poFormData.discountAmount || 0;
    const totalAmount = subtotal + taxAmount + shipping - discount;
    const poNumber = poFormData.poNumber || generatePONumber();
    const selectedTaxOption = taxOptions.find(opt => opt.value === poFormData.taxType);
    
    // Create PDF HTML content
    const pdfContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Purchase Order ${poNumber}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            .header { border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px; }
            .header h1 { margin: 0; }
            .details { margin-bottom: 20px; }
            .details table { width: 100%; border-collapse: collapse; }
            .details td { padding: 5px; border-bottom: 1px solid #ddd; }
            .items-table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            .items-table th, .items-table td { padding: 8px; border: 1px solid #ddd; text-align: left; }
            .items-table th { background-color: #f2f2f2; }
            .total { margin-top: 20px; text-align: right; font-size: 18px; font-weight: bold; }
            .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>PURCHASE ORDER</h1>
            <p><strong>PO Number:</strong> ${poNumber}</p>
          </div>
          
          <div class="details">
            <table>
              <tr><td><strong>Supplier:</strong></td><td>${poFormData.supplierName || 'N/A'}</td></tr>
              <tr><td><strong>Order Date:</strong></td><td>${poFormData.orderDate instanceof Date 
                ? poFormData.orderDate.toLocaleDateString()
                : poFormData.orderDate 
                  ? new Date(poFormData.orderDate).toLocaleDateString()
                  : new Date().toLocaleDateString()}</td></tr>
              <tr><td><strong>Expected Delivery:</strong></td><td>${poFormData.expectedDeliveryDate instanceof Date 
                ? poFormData.expectedDeliveryDate.toLocaleDateString()
                : poFormData.expectedDeliveryDate 
                  ? new Date(poFormData.expectedDeliveryDate).toLocaleDateString()
                  : 'N/A'}</td></tr>
              <tr><td><strong>Priority:</strong></td><td>${poFormData.priority || 'Medium'}</td></tr>
              <tr><td><strong>Payment Terms:</strong></td><td>${poFormData.paymentTerms || 'N/A'}</td></tr>
            </table>
          </div>

          <table class="items-table">
            <thead>
              <tr>
                <th>Item Code</th>
                <th>Item Name</th>
                <th>Quantity</th>
                <th>Unit Cost</th>
                <th>Total Cost</th>
              </tr>
            </thead>
            <tbody>
              ${(poFormData.items || []).map(item => `
                <tr>
                  <td>${item.itemCode}</td>
                  <td>${item.itemName}</td>
                  <td>${item.quantity}</td>
                  <td>₵${item.unitCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td>₵${item.totalCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="total">
            <div style="text-align: right; margin-top: 20px;">
              <p><strong>Subtotal:</strong> ₵${subtotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              ${taxAmount > 0 ? `<p><strong>Tax (${selectedTaxOption?.label || `${taxRate}%`}):</strong> ₵${taxAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>` : ''}
              ${shipping > 0 ? `<p><strong>Shipping:</strong> ₵${shipping.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>` : ''}
              ${discount > 0 ? `<p><strong>Discount:</strong> -₵${discount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>` : ''}
              <p style="font-size: 20px; margin-top: 10px;"><strong>Total Amount:</strong> ₵${totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </div>
          </div>

          ${poFormData.notes ? `
            <div class="footer">
              <p><strong>Notes:</strong></p>
              <p>${poFormData.notes}</p>
            </div>
          ` : ''}
        </body>
      </html>
    `;

    // Open print window
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(pdfContent);
      printWindow.document.close();
      printWindow.onload = () => {
        printWindow.print();
      };
    }
    
    trackEvent('Stores.Issued', { action: 'export_po_pdf', poNumber });
  };

  // Filter and paginate purchase orders
  const filteredPOs = useMemo(() => {
    return supplierStorePurchaseOrders.filter(po => {
      const matchesSearch = 
        po.poNumber.toLowerCase().includes(poSearchTerm.toLowerCase()) ||
        po.supplierName.toLowerCase().includes(poSearchTerm.toLowerCase());
      
      const matchesStatus = poFilterStatus === 'all' || po.status === poFilterStatus;
      
      return matchesSearch && matchesStatus;
    });
  }, [supplierStorePurchaseOrders, poSearchTerm, poFilterStatus]);

  const poPages = Math.ceil(filteredPOs.length / poRowsPerPage);
  const paginatedPOs = useMemo(() => {
    const start = (poPage - 1) * poRowsPerPage;
    return filteredPOs.slice(start, start + poRowsPerPage);
  }, [filteredPOs, poPage]);

  // Requisition handlers
  const generateRequisitionNumber = () => {
    const year = new Date().getFullYear();
    const count = supplierStoreRequisitions.length + 1;
    return `REQ-${year}-${String(count).padStart(3, '0')}`;
  };

  const handleAddRequisition = () => {
    setEditingRequisition(null);
    const reqNumber = generateRequisitionNumber();
    setRequisitionFormData({
      requisitionNumber: reqNumber,
      requestedBy: 'Current User', // TODO: Get from auth context
      requestedDate: new Date(),
      status: 'pending',
      requestedItems: [],
      notes: ''
    });
    onRequisitionModalOpen();
  };

  const handleEditRequisition = (req: Requisition) => {
    if (req.status !== 'pending') {
      alert('Only pending requisitions can be edited');
      return;
    }
    setEditingRequisition(req);
    setRequisitionFormData({ ...req });
    onRequisitionModalOpen();
  };

  const handleViewRequisition = (req: Requisition) => {
    setViewingRequisition(req);
    selectRequisition(req);
    onRequisitionViewOpen();
  };

  const handleSaveRequisition = () => {
    if (!requisitionFormData.requestedItems || requisitionFormData.requestedItems.length === 0) {
      alert('Please add at least one item to the requisition');
      return;
    }

    const reqData: Omit<Requisition, 'id' | 'createdAt' | 'updatedAt'> = {
      requisitionNumber: requisitionFormData.requisitionNumber || generateRequisitionNumber(),
      requestedBy: requisitionFormData.requestedBy || 'Current User',
      requestedDate: requisitionFormData.requestedDate || new Date(),
      requestedItems: requisitionFormData.requestedItems || [],
      status: requisitionFormData.status || 'pending',
      notes: requisitionFormData.notes
    };

    if (editingRequisition) {
      updateRequisition(editingRequisition.id, reqData);
      trackEvent('Stores.Issued', { action: 'update_requisition', requisitionNumber: editingRequisition.requisitionNumber });
    } else {
      createRequisition(reqData);
      trackEvent('Stores.Issued', { action: 'create_requisition', requisitionNumber: reqData.requisitionNumber });
    }
    
    onRequisitionModalClose();
    setRequisitionFormData({
      status: 'pending',
      requestedItems: [],
      requestedDate: new Date(),
      requestedBy: 'Current User'
    });
    setEditingRequisition(null);
  };

  const handleAddRequisitionItem = () => {
    const newItem: RequisitionItem = {
      id: Date.now().toString(),
      itemId: '',
      itemCode: '',
      itemName: '',
      quantity: 1,
      estimatedPrice: 0,
      totalCost: 0,
      notes: ''
    };
    setRequisitionFormData({
      ...requisitionFormData,
      requestedItems: [...(requisitionFormData.requestedItems || []), newItem]
    } as typeof requisitionFormData);
  };

  const handleUpdateRequisitionItem = (itemId: string, updates: Partial<RequisitionItem>) => {
    const updatedItems = (requisitionFormData.requestedItems || []).map((item: RequisitionItem) => {
      if (item.id === itemId) {
        const updated = { ...item, ...updates };
        updated.totalCost = updated.quantity * updated.estimatedPrice;
        return updated;
      }
      return item;
    });
    setRequisitionFormData({ ...requisitionFormData, requestedItems: updatedItems } as typeof requisitionFormData);
  };

  const handleRemoveRequisitionItem = (itemId: string) => {
    setRequisitionFormData({
      ...requisitionFormData,
      requestedItems: (requisitionFormData.requestedItems || []).filter((item: RequisitionItem) => item.id !== itemId)
    } as typeof requisitionFormData);
  };

  const handleRequisitionItemChange = (itemCode: string, itemIndex: number) => {
    const item = stockItems.find(i => i.itemCode === itemCode);
    if (item) {
      const currentItems = [...(requisitionFormData.requestedItems || [])];
      currentItems[itemIndex] = {
        ...currentItems[itemIndex],
        itemId: item.id,
        itemCode: item.itemCode,
        itemName: item.name,
        estimatedPrice: item.unitCost
      };
      currentItems[itemIndex].totalCost = currentItems[itemIndex].quantity * currentItems[itemIndex].estimatedPrice;
      setRequisitionFormData({ ...requisitionFormData, requestedItems: currentItems } as typeof requisitionFormData);
      
      // Clear the search term for this index after selection to show the selected item
      setItemSearchTerms((prev: Record<number, string>) => {
        const updated = { ...prev };
        delete updated[itemIndex];
        return updated;
      });
    }
  };

  // Item search state for requisition form
  const [itemSearchTerms, setItemSearchTerms] = useState<Record<number, string>>({});

  const getFilteredItemsForIndex = (index: number) => {
    const searchTerm = (itemSearchTerms[index] || '').toLowerCase();
    if (!searchTerm) return stockItems.slice(0, 20); // Limit results when no search
    
    return stockItems.filter(item => 
      item.itemCode.toLowerCase().includes(searchTerm) ||
      item.name.toLowerCase().includes(searchTerm) ||
      item.description?.toLowerCase().includes(searchTerm)
    ).slice(0, 20);
  };

  const handleGenerateRequisitionPDF = () => {
    if (!requisitionFormData.requestedItems || requisitionFormData.requestedItems.length === 0) {
      alert('Please add items to generate PDF');
      return;
    }

    // Generate PDF content
    const totalAmount = (requisitionFormData.requestedItems || []).reduce((sum, item) => sum + item.totalCost, 0);
    const requisitionNumber = requisitionFormData.requisitionNumber || generateRequisitionNumber();
    
    // Create PDF HTML content
    const pdfContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Requisition ${requisitionNumber}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            .header { border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px; }
            .header h1 { margin: 0; }
            .details { margin-bottom: 20px; }
            .details table { width: 100%; border-collapse: collapse; }
            .details td { padding: 5px; border-bottom: 1px solid #ddd; }
            .items-table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            .items-table th, .items-table td { padding: 8px; border: 1px solid #ddd; text-align: left; }
            .items-table th { background-color: #f2f2f2; }
            .total { margin-top: 20px; text-align: right; font-size: 18px; font-weight: bold; }
            .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>REQUISITION FORM</h1>
            <p><strong>Requisition Number:</strong> ${requisitionNumber}</p>
          </div>
          
          <div class="details">
            <table>
              <tr><td><strong>Requested By:</strong></td><td>${requisitionFormData.requestedBy || 'N/A'}</td></tr>
              <tr><td><strong>Requested Date:</strong></td><td>${requisitionFormData.requestedDate instanceof Date 
                ? requisitionFormData.requestedDate.toLocaleDateString()
                : requisitionFormData.requestedDate 
                  ? new Date(requisitionFormData.requestedDate).toLocaleDateString()
                  : new Date().toLocaleDateString()}</td></tr>
              <tr><td><strong>Status:</strong></td><td>${requisitionFormData.status || 'Pending'}</td></tr>
            </table>
          </div>

          <table class="items-table">
            <thead>
              <tr>
                <th>Item Code</th>
                <th>Item Name</th>
                <th>Quantity</th>
                <th>Estimated Price</th>
                <th>Total Cost</th>
              </tr>
            </thead>
            <tbody>
              ${(requisitionFormData.requestedItems || []).map(item => `
                <tr>
                  <td>${item.itemCode}</td>
                  <td>${item.itemName}</td>
                  <td>${item.quantity}</td>
                  <td>₵${item.estimatedPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td>₵${item.totalCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="total">
            <strong>Total Amount: ₵${totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
          </div>

          ${requisitionFormData.notes ? `
            <div class="footer">
              <p><strong>Notes:</strong></p>
              <p>${requisitionFormData.notes}</p>
            </div>
          ` : ''}
        </body>
      </html>
    `;

    // Open print window
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(pdfContent);
      printWindow.document.close();
      printWindow.onload = () => {
        printWindow.print();
      };
    }
    
    trackEvent('Stores.Issued', { action: 'export_requisition_pdf', requisitionNumber });
  };

  // Filter and paginate requisitions
  const filteredRequisitions = useMemo(() => {
    return supplierStoreRequisitions.filter(req => {
      const matchesSearch = 
        req.requisitionNumber.toLowerCase().includes(requisitionSearchTerm.toLowerCase()) ||
        req.requestedBy.toLowerCase().includes(requisitionSearchTerm.toLowerCase());
      
      const matchesStatus = requisitionFilterStatus === 'all' || req.status === requisitionFilterStatus;
      
      return matchesSearch && matchesStatus;
    });
  }, [supplierStoreRequisitions, requisitionSearchTerm, requisitionFilterStatus]);

  const requisitionPages = Math.ceil(filteredRequisitions.length / requisitionRowsPerPage);
  const paginatedRequisitions = useMemo(() => {
    const start = (requisitionPage - 1) * requisitionRowsPerPage;
    return filteredRequisitions.slice(start, start + requisitionRowsPerPage);
  }, [filteredRequisitions, requisitionPage]);

  const handleDeleteSupplier = (supplierId: string) => {
    if (confirm('Are you sure you want to delete this supplier? This will also remove it from accounting.')) {
      const supplier = mergedSuppliers.find(s => s.id === supplierId);
      if (supplier) {
        // Delete from inventory store
        deleteSupplier(supplierId);
        
        // Sync deletion to accounting store
        syncSupplierToAccounting(supplier, 'delete');
        
        trackEvent('Stores.Issued', { action: 'delete_supplier', supplierId });
      }
    }
  };

  const renderSupplierManagement = () => {
    return (
      <div className="space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="border-0 shadow-lg">
            <CardBody className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Suppliers</p>
                  <p className="text-2xl font-bold text-ghana-black">{totalSuppliers}</p>
                </div>
                <div className="text-3xl">🤝</div>
              </div>
            </CardBody>
          </Card>
          
          <Card className="border-0 shadow-lg">
            <CardBody className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Active Suppliers</p>
                  <p className="text-2xl font-bold text-green-600">{activeSuppliersCount}</p>
                </div>
                <div className="text-3xl">✅</div>
              </div>
            </CardBody>
          </Card>
          
          <Card className="border-0 shadow-lg">
            <CardBody className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Credit Limit</p>
                  <p className="text-2xl font-bold text-blue-600">₵{totalCreditLimit.toLocaleString()}</p>
                </div>
                <div className="text-3xl">💳</div>
              </div>
            </CardBody>
          </Card>
          
          <Card className="border-0 shadow-lg">
            <CardBody className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Average Rating</p>
                  <p className="text-2xl font-bold text-yellow-600">{averageRating.toFixed(1)} ⭐</p>
                </div>
                <div className="text-3xl">⭐</div>
              </div>
            </CardBody>
          </Card>
        </div>

        {/* Filters and Search */}
        <Card className="border-0 shadow-lg">
          <CardBody>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <Input
                placeholder="Search suppliers..."
                value={supplierSearchTerm}
                onChange={(e) => setSupplierSearchTerm(e.target.value)}
                startContent={<span className="text-gray-400">🔍</span>}
                className="md:col-span-2"
              />
              
              <Select
                placeholder="Status"
                selectedKeys={[supplierFilterStatus]}
                onSelectionChange={(keys) => setSupplierFilterStatus(Array.from(keys)[0] as string)}
              >
                <SelectItem key="all">All Status</SelectItem>
                <SelectItem key="active">Active</SelectItem>
                <SelectItem key="inactive">Inactive</SelectItem>
              </Select>

              <Select
                placeholder="Category"
                selectedKeys={[supplierFilterCategory]}
                onSelectionChange={(keys) => setSupplierFilterCategory(Array.from(keys)[0] as string)}
              >
                <SelectItem key="all">All Categories</SelectItem>
                <React.Fragment>
                  {supplierCategories.map(cat => (
                    <SelectItem key={cat}>{cat}</SelectItem>
                  ))}
                </React.Fragment>
              </Select>

              <Select
                placeholder="Payment Terms"
                selectedKeys={[supplierFilterPaymentTerms]}
                onSelectionChange={(keys) => setSupplierFilterPaymentTerms(Array.from(keys)[0] as string)}
              >
                <SelectItem key="all">All Terms</SelectItem>
                <SelectItem key="immediate">Immediate</SelectItem>
                <SelectItem key="net30">Net 30</SelectItem>
                <SelectItem key="net60">Net 60</SelectItem>
                <SelectItem key="net90">Net 90</SelectItem>
              </Select>
            </div>
          </CardBody>
        </Card>

        {/* Main Table */}
        <Card className="border-0 shadow-lg">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between w-full">
              <h3 className="text-xl font-semibold text-ghana-black">🤝 Suppliers ({filteredSuppliers.length})</h3>
              <Button
                color="primary"
                className="bg-blue-500 text-white"
                variant="flat"
                startContent={<span>➕</span>}
                onClick={handleAddSupplier}
              >
                Add Supplier
              </Button>
            </div>
          </CardHeader>
          <CardBody>
            <Table aria-label="Suppliers table">
              <TableHeader>
                <TableColumn>CODE</TableColumn>
                <TableColumn>SUPPLIER NAME</TableColumn>
                <TableColumn>CONTACT</TableColumn>
                <TableColumn>LOCATION</TableColumn>
                <TableColumn>CATEGORIES</TableColumn>
                <TableColumn>RATING</TableColumn>
                <TableColumn className="text-right">CREDIT LIMIT</TableColumn>
                <TableColumn className="text-right">BALANCE</TableColumn>
                <TableColumn>PAYMENT TERMS</TableColumn>
                <TableColumn>PERFORMANCE</TableColumn>
                <TableColumn>STATUS</TableColumn>
                <TableColumn>ACTIONS</TableColumn>
              </TableHeader>
              <TableBody emptyContent="No suppliers found.">
                {paginatedSuppliers.map((supplier) => {
                  const creditUsagePercent = supplier.creditLimit > 0 
                    ? (supplier.currentBalance / supplier.creditLimit) * 100 
                    : 0;
                  const onTimeDeliveryPercent = supplier.performance.onTimeDelivery;
                  
                  return (
                    <TableRow key={supplier.id}>
                      <TableCell>
                        <div>
                          <span className="font-mono font-semibold">{supplier.code}</span>
                          {accountingSuppliers.some(bp => bp.id === supplier.id || bp.code === supplier.code) && (
                            <Tooltip content="Linked to Accounting">
                              <Badge color="success" size="sm" variant="flat" className="ml-2">
                                💼
                              </Badge>
                            </Tooltip>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-semibold">{supplier.name}</div>
                          <div className="text-xs text-gray-500">{supplier.email}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div className="font-medium">{supplier.contactPerson}</div>
                          <div className="text-gray-500">{supplier.phone}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div>{supplier.city}</div>
                          <div className="text-xs text-gray-500">{supplier.country}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {supplier.categories.slice(0, 2).map((category) => (
                            <Chip key={category} color="primary" size="sm" variant="flat">
                              {category}
                            </Chip>
                          ))}
                          {supplier.categories.length > 2 && (
                            <Chip size="sm" variant="flat" color="default">
                              +{supplier.categories.length - 2}
                            </Chip>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <span className="font-semibold">{supplier.rating.toFixed(1)}</span>
                          <div className="flex">
                            {[...Array(5)].map((_, i) => (
                              <span 
                                key={i} 
                                className={`text-sm ${i < Math.floor(supplier.rating) ? 'text-yellow-500' : 'text-gray-300'}`}
                              >
                                ★
                              </span>
                            ))}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-col items-end">
                          <span className="font-semibold">₵{supplier.creditLimit.toLocaleString()}</span>
                          <Progress 
                            value={creditUsagePercent} 
                            size="sm" 
                            color={creditUsagePercent > 80 ? 'danger' : creditUsagePercent > 60 ? 'warning' : 'success'}
                            className="w-16 mt-1"
                          />
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={`font-semibold ${
                          supplier.currentBalance > supplier.creditLimit * 0.8 ? 'text-red-600' :
                          supplier.currentBalance > supplier.creditLimit * 0.6 ? 'text-orange-600' :
                          'text-green-600'
                        }`}>
                          ₵{supplier.currentBalance.toLocaleString()}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Chip size="sm" variant="flat" color="secondary">
                          {supplier.paymentTerms.toUpperCase()}
                        </Chip>
                      </TableCell>
                      <TableCell>
                        <div className="text-xs">
                          <div>On-Time: {onTimeDeliveryPercent}%</div>
                          <div>Orders: {supplier.performance.totalOrders}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          color={supplier.isActive ? 'success' : 'default'}
                          size="sm"
                          variant="flat"
                        >
                          {supplier.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Tooltip content="View Details">
                            <Button 
                              size="sm" 
                              variant="flat" 
                              color="primary"
                              onClick={() => handleViewSupplier(supplier)}
                            >
                              👁️
                            </Button>
                          </Tooltip>
                          <Tooltip content="Edit">
                            <Button 
                              size="sm" 
                              variant="flat" 
                              color="warning"
                              onClick={() => handleEditSupplier(supplier)}
                            >
                              ✏️
                            </Button>
                          </Tooltip>
                          <Tooltip content="Delete">
                            <Button 
                              size="sm" 
                              variant="flat" 
                              color="danger"
                              onClick={() => handleDeleteSupplier(supplier.id)}
                            >
                              🗑️
                            </Button>
                          </Tooltip>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            
            {supplierPages > 1 && (
              <div className="flex justify-center mt-4">
                <Pagination 
                  total={supplierPages} 
                  page={supplierPage} 
                  onChange={setSupplierPage}
                  showControls
                />
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    );
  };

  const renderPurchaseOrders = () => (
    <div className="space-y-6">
      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between w-full">
            <h3 className="text-xl font-semibold text-ghana-black">📋 Purchase Orders</h3>
            <Button
              color="primary"
              className="bg-ghana-gold text-white"
              variant="flat"
              onPress={handleAddPO}
            >
              📋 Create PO
            </Button>
          </div>
        </CardHeader>
        <CardBody>
          {/* Filters and Search */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Input
              placeholder="Search PO number or supplier..."
              value={poSearchTerm}
              onChange={(e) => setPOSearchTerm(e.target.value)}
              startContent={<span className="text-gray-400">🔍</span>}
              className="md:col-span-2"
            />
            <Select
              placeholder="Filter by Status"
              selectedKeys={[poFilterStatus]}
              onSelectionChange={(keys) => setPOFilterStatus(Array.from(keys)[0] as string)}
            >
              <SelectItem key="all">All Status</SelectItem>
              <SelectItem key="draft">Draft</SelectItem>
              <SelectItem key="sent">Sent</SelectItem>
              <SelectItem key="confirmed">Confirmed</SelectItem>
              <SelectItem key="in-transit">In Transit</SelectItem>
              <SelectItem key="delivered">Delivered</SelectItem>
              <SelectItem key="cancelled">Cancelled</SelectItem>
              <SelectItem key="closed">Closed</SelectItem>
            </Select>
          </div>

          <Table aria-label="Purchase orders table">
            <TableHeader>
              <TableColumn>PO Number</TableColumn>
              <TableColumn>Supplier</TableColumn>
              <TableColumn>Order Date</TableColumn>
              <TableColumn>Expected Delivery</TableColumn>
              <TableColumn>Priority</TableColumn>
              <TableColumn className="text-right">Total Amount</TableColumn>
              <TableColumn>Status</TableColumn>
              <TableColumn>Actions</TableColumn>
            </TableHeader>
            <TableBody emptyContent="No purchase orders found.">
              {paginatedPOs.map((po) => {
                const getStatusColor = (status: PurchaseOrder['status']) => {
                  switch (status) {
                    case 'delivered': return 'success';
                    case 'confirmed': case 'in-transit': return 'warning';
                    case 'sent': return 'primary';
                    case 'draft': return 'default';
                    case 'cancelled': return 'danger';
                    case 'closed': return 'secondary';
                    default: return 'default';
                  }
                };

                const getPriorityColor = (priority: PurchaseOrder['priority']) => {
                  switch (priority) {
                    case 'urgent': return 'danger';
                    case 'high': return 'warning';
                    case 'medium': return 'primary';
                    case 'low': return 'default';
                    default: return 'default';
                  }
                };

                return (
                  <TableRow key={po.id}>
                    <TableCell className="font-mono font-semibold">{po.poNumber}</TableCell>
                    <TableCell className="font-semibold">{po.supplierName}</TableCell>
                    <TableCell>{po.orderDate instanceof Date ? po.orderDate.toLocaleDateString() : new Date(po.orderDate).toLocaleDateString()}</TableCell>
                    <TableCell>
                      {po.expectedDeliveryDate instanceof Date 
                        ? po.expectedDeliveryDate.toLocaleDateString() 
                        : new Date(po.expectedDeliveryDate).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Badge color={getPriorityColor(po.priority)} size="sm" variant="flat">
                        {po.priority}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-right">
                        <div className="font-semibold">₵{po.finalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                        <div className="text-sm text-gray-500">
                          Base: ₵{po.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        {po.taxAmount > 0 && (
                          <div className="text-xs text-gray-400">Tax: ₵{po.taxAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge color={getStatusColor(po.status)} size="sm">
                        {po.status.replace('-', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Tooltip content="View Details">
                          <Button 
                            size="sm" 
                            variant="flat" 
                            color="primary"
                            onPress={() => handleViewPO(po)}
                          >
                            👁️
                          </Button>
                        </Tooltip>
                        {po.status === 'draft' && (
                          <>
                            <Tooltip content="Edit">
                              <Button 
                                size="sm" 
                                variant="flat" 
                                color="secondary"
                                onPress={() => handleEditPO(po)}
                              >
                                ✏️
                              </Button>
                            </Tooltip>
                            <Tooltip content="Send to Supplier">
                              <Button 
                                size="sm" 
                                variant="flat" 
                                color="success"
                                onPress={() => {
                                  sendPurchaseOrder(po.id);
                                  trackEvent('Stores.Issued', { action: 'send_po', poNumber: po.poNumber });
                                }}
                              >
                                📤
                              </Button>
                            </Tooltip>
                          </>
                        )}
                        {po.status === 'sent' && (
                          <Tooltip content="Mark as Confirmed">
                            <Button 
                              size="sm" 
                              variant="flat" 
                              color="success"
                              onPress={() => {
                                confirmPurchaseOrder(po.id, po.supplierId);
                                trackEvent('Stores.Issued', { action: 'confirm_po', poNumber: po.poNumber });
                              }}
                            >
                              ✓
                            </Button>
                          </Tooltip>
                        )}
                        {(po.status === 'confirmed' || po.status === 'sent') && (
                          <Tooltip content="Mark In Transit">
                            <Button 
                              size="sm" 
                              variant="flat" 
                              color="warning"
                              onPress={() => {
                                markInTransit(po.id);
                                trackEvent('Stores.Issued', { action: 'mark_in_transit_po', poNumber: po.poNumber });
                              }}
                            >
                              🚚
                            </Button>
                          </Tooltip>
                        )}
                        {(po.status === 'in-transit' || po.status === 'confirmed') && (
                          <Tooltip content="Mark Delivered">
                            <Button 
                              size="sm" 
                              variant="flat" 
                              color="success"
                              onPress={() => {
                                markDelivered(po.id, new Date());
                                trackEvent('Stores.Issued', { action: 'mark_delivered_po', poNumber: po.poNumber });
                              }}
                            >
                              ✅
                            </Button>
                          </Tooltip>
                        )}
                        {(po.status === 'draft' || po.status === 'sent' || po.status === 'confirmed') && (
                          <Tooltip content="Cancel">
                            <Button 
                              size="sm" 
                              variant="flat" 
                              color="danger"
                              onPress={() => {
                                if (confirm('Are you sure you want to cancel this purchase order?')) {
                                  cancelPurchaseOrder(po.id, 'Cancelled by user');
                                  trackEvent('Stores.Issued', { action: 'cancel_po', poNumber: po.poNumber });
                                }
                              }}
                            >
                              ❌
                            </Button>
                          </Tooltip>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          {poPages > 1 && (
            <div className="flex justify-center mt-4">
              <Pagination
                total={poPages}
                page={poPage}
                onChange={setPOPage}
                showControls
              />
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );

  const renderRequisitions = () => (
    <div className="space-y-6">
      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between w-full">
            <h3 className="text-xl font-semibold text-ghana-black">📝 Requisitions</h3>
            <Button
              color="primary"
              className="bg-ghana-green text-white"
              variant="flat"
              onPress={handleAddRequisition}
            >
              📝 Create Requisition
            </Button>
          </div>
        </CardHeader>
        <CardBody>
          {/* Filters and Search */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Input
              placeholder="Search requisition number or requester..."
              value={requisitionSearchTerm}
              onChange={(e) => setRequisitionSearchTerm(e.target.value)}
              startContent={<span className="text-gray-400">🔍</span>}
              className="md:col-span-2"
            />
            <Select
              placeholder="Filter by Status"
              selectedKeys={[requisitionFilterStatus]}
              onSelectionChange={(keys) => setRequisitionFilterStatus(Array.from(keys)[0] as string)}
            >
              <SelectItem key="all">All Status</SelectItem>
              <SelectItem key="pending">Pending</SelectItem>
              <SelectItem key="approved">Approved</SelectItem>
              <SelectItem key="rejected">Rejected</SelectItem>
              <SelectItem key="converted-to-po">Converted to PO</SelectItem>
              <SelectItem key="cancelled">Cancelled</SelectItem>
            </Select>
          </div>

          <Table aria-label="Requisitions table">
            <TableHeader>
              <TableColumn>Req Number</TableColumn>
              <TableColumn>Requested By</TableColumn>
              <TableColumn>Requested Date</TableColumn>
              <TableColumn>Items Count</TableColumn>
              <TableColumn className="text-right">Total Amount</TableColumn>
              <TableColumn>Status</TableColumn>
              <TableColumn>Actions</TableColumn>
            </TableHeader>
            <TableBody emptyContent="No requisitions found.">
              {paginatedRequisitions.map((req) => {
                const getStatusColor = (status: string) => {
                  switch (status) {
                    case 'approved': return 'success';
                    case 'rejected': case 'cancelled': return 'danger';
                    case 'converted-to-po': return 'primary';
                    case 'pending': return 'warning';
                    default: return 'default';
                  }
                };

                const totalAmount = req.requestedItems.reduce((sum, item) => sum + item.totalCost, 0);

                return (
                  <TableRow key={req.id}>
                    <TableCell className="font-mono font-semibold">{req.requisitionNumber}</TableCell>
                    <TableCell className="font-semibold">{req.requestedBy}</TableCell>
                    <TableCell>
                      {req.requestedDate instanceof Date 
                        ? req.requestedDate.toLocaleDateString()
                        : new Date(req.requestedDate).toLocaleDateString()}
                    </TableCell>
                    <TableCell>{req.requestedItems.length} items</TableCell>
                    <TableCell className="text-right font-semibold">
                      ₵{totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell>
                      <Badge color={getStatusColor(req.status)} size="sm">
                        {req.status.replace('-', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Tooltip content="View Details">
                          <Button 
                            size="sm" 
                            variant="flat" 
                            color="primary"
                            onPress={() => handleViewRequisition(req)}
                          >
                            👁️
                          </Button>
                        </Tooltip>
                        {req.status === 'pending' && (
                          <>
                            <Tooltip content="Edit">
                              <Button 
                                size="sm" 
                                variant="flat" 
                                color="secondary"
                                onPress={() => handleEditRequisition(req)}
                              >
                                ✏️
                              </Button>
                            </Tooltip>
                            <Tooltip content="Approve">
                              <Button 
                                size="sm" 
                                variant="flat" 
                                color="success"
                                onPress={() => {
                                  if (confirm('Approve this requisition?')) {
                                    approveRequisition(req.id, 'Director/GM'); // TODO: Get from auth context
                                    trackEvent('Stores.Issued', { action: 'approve_requisition', requisitionNumber: req.requisitionNumber });
                                  }
                                }}
                              >
                                ✓
                              </Button>
                            </Tooltip>
                            <Tooltip content="Reject">
                              <Button 
                                size="sm" 
                                variant="flat" 
                                color="danger"
                                onPress={() => {
                                  const reason = prompt('Enter rejection reason (optional):');
                                  rejectRequisition(req.id, 'Director/GM', reason || undefined); // TODO: Get from auth context
                                  trackEvent('Stores.Issued', { action: 'reject_requisition', requisitionNumber: req.requisitionNumber });
                                }}
                              >
                                ❌
                              </Button>
                            </Tooltip>
                          </>
                        )}
                        {req.status === 'approved' && (
                          <Tooltip content="Convert to Purchase Order">
                            <Button 
                              size="sm" 
                              variant="flat" 
                              color="primary"
                              onPress={() => {
                                const supplier = mergedSuppliers.find(s => s.isActive);
                                if (!supplier) {
                                  alert('Please add a supplier first before converting to PO');
                                  return;
                                }
                                if (confirm(`Convert this requisition to a Purchase Order with ${supplier.name}?`)) {
                                  const newPO = convertRequisitionToPO(req.id, supplier.id);
                                  if (newPO) {
                                    alert(`Requisition converted to PO: ${newPO.poNumber}`);
                                    setSelectedTab('purchase-orders');
                                    trackEvent('Stores.Issued', { action: 'convert_requisition_to_po', requisitionNumber: req.requisitionNumber, poNumber: newPO.poNumber });
                                  }
                                }
                              }}
                            >
                              📋 Convert to PO
                            </Button>
                          </Tooltip>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          {requisitionPages > 1 && (
            <div className="flex justify-center mt-4">
              <Pagination
                total={requisitionPages}
                page={requisitionPage}
                onChange={setRequisitionPage}
                showControls
              />
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );

  // GRN Management State
  const [grnSearchTerm, setGRNSearchTerm] = useState('');
  const [grnFilterStatus, setGRNFilterStatus] = useState<string>('all');
  const [grnPage, setGRNPage] = useState(1);
  const grnRowsPerPage = 10;
  const { isOpen: isGRNViewOpen, onOpen: onGRNViewOpen, onClose: onGRNViewClose } = useDisclosure();
  const { isOpen: isQualityCheckOpen, onOpen: onQualityCheckOpen, onClose: onQualityCheckClose } = useDisclosure();
  const [viewingGRN, setViewingGRN] = useState<GoodsReceiptNote | null>(null);
  const [selectedGRNForQC, setSelectedGRNForQC] = useState<GoodsReceiptNote | null>(null);
  const [qualityCheckFormData, setQualityCheckFormData] = useState<Partial<QualityCheck> & { items?: any[] }>({});

  // Invoice Management State
  const [invoiceSearchTerm, setInvoiceSearchTerm] = useState('');
  const [invoiceFilterStatus, setInvoiceFilterStatus] = useState<string>('all');
  const [invoicePage, setInvoicePage] = useState(1);
  const invoiceRowsPerPage = 10;
  const { isOpen: isInvoiceModalOpen, onOpen: onInvoiceModalOpen, onClose: onInvoiceModalClose } = useDisclosure();
  const { isOpen: isInvoiceViewOpen, onOpen: onInvoiceViewOpen, onClose: onInvoiceViewClose } = useDisclosure();
  const { isOpen: isThreeWayMatchOpen, onOpen: onThreeWayMatchOpen, onClose: onThreeWayMatchClose } = useDisclosure();
  const [editingInvoice, setEditingInvoice] = useState<SupplierInvoice | null>(null);
  const [viewingInvoice, setViewingInvoice] = useState<SupplierInvoice | null>(null);
  const [selectedPOForInvoice, setSelectedPOForInvoice] = useState<PurchaseOrder | null>(null);
  const [invoiceFormData, setInvoiceFormData] = useState<Partial<SupplierInvoice> & { items?: InvoiceItem[] }>({
    items: []
  });

  // Stock Operations State
  const [stockOpSubTab, setStockOpSubTab] = useState('goods-receipt');
  const [stockTransferSearchTerm, setStockTransferSearchTerm] = useState('');
  const [stockTransferFilterStatus, setStockTransferFilterStatus] = useState<string>('all');
  const [stockCountSearchTerm, setStockCountSearchTerm] = useState('');
  const [stockCountFilterStatus, setStockCountFilterStatus] = useState<string>('all');

  // Goods Receipt State
  const { isOpen: isGoodsReceiptOpen, onOpen: onGoodsReceiptOpen, onClose: onGoodsReceiptClose } = useDisclosure();
  const [selectedPOForReceipt, setSelectedPOForReceipt] = useState<PurchaseOrder | null>(null);
  const [receiptItems, setReceiptItems] = useState<Array<{ itemId: string; itemCode: string; itemName: string; orderedQty: number; receivedQty: number; unitCost: number; batchNumber?: string; expiryDate?: Date; notes?: string }>>([]);

  // Goods Issue State
  const { isOpen: isGoodsIssueOpen, onOpen: onGoodsIssueOpen, onClose: onGoodsIssueClose } = useDisclosure();
  const [issueFormData, setIssueFormData] = useState<{ department: string; issuedTo: string; items: Array<{ itemId: string; itemCode: string; itemName: string; quantity: number; unitCost: number; reason?: string }>; notes?: string }>({
    department: '',
    issuedTo: '',
    items: [],
    notes: ''
  });

  // Stock Transfer State
  const { isOpen: isStockTransferOpen, onOpen: onStockTransferOpen, onClose: onStockTransferClose } = useDisclosure();
  const { isOpen: isStockTransferViewOpen, onOpen: onStockTransferViewOpen, onClose: onStockTransferViewClose } = useDisclosure();
  const [editingStockTransfer, setEditingStockTransfer] = useState<StockTransfer | null>(null);
  const [viewingStockTransfer, setViewingStockTransfer] = useState<StockTransfer | null>(null);
  const [stockTransferFormData, setStockTransferFormData] = useState<Partial<StockTransfer> & { items?: StockTransferItem[] }>({
    fromLocation: '',
    toLocation: '',
    transferDate: new Date(),
    expectedDeliveryDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
    status: 'pending',
    priority: 'medium',
      items: [],
      createdBy: 'Current User'
    });

  // Stock Count State
  const { isOpen: isStockCountOpen, onOpen: onStockCountOpen, onClose: onStockCountClose } = useDisclosure();
  const { isOpen: isStockCountViewOpen, onOpen: onStockCountViewOpen, onClose: onStockCountViewClose } = useDisclosure();
  const [editingStockCount, setEditingStockCount] = useState<StockCount | null>(null);
  const [viewingStockCount, setViewingStockCount] = useState<StockCount | null>(null);
  const [stockCountFormData, setStockCountFormData] = useState<Partial<StockCount> & { items?: StockCountItem[] }>({
    countType: 'full',
      location: '',
      startDate: new Date(),
      status: 'planned',
    items: [],
    createdBy: 'Current User'
  });

  // Temporary storage for transfers and counts (until we add to store)
  const [stockTransfers, setStockTransfers] = useState<StockTransfer[]>([]);
  const [stockCounts, setStockCounts] = useState<StockCount[]>([]);

  // Goods Receipt Handlers
  const handleOpenGoodsReceipt = (po: PurchaseOrder) => {
    setSelectedPOForReceipt(po);
    setReceiptItems(po.items.map(item => ({
      itemId: item.itemId,
      itemCode: item.itemCode,
      itemName: item.itemName,
      orderedQty: item.quantity,
      receivedQty: item.receivedQuantity || 0,
      unitCost: item.unitCost,
      notes: ''
    })));
    onGoodsReceiptOpen();
  };

  const handleReceiveGoods = () => {
    if (!selectedPOForReceipt) return;
    
    // Validate that we have items to receive
    const itemsToReceive = receiptItems.filter(item => item.receivedQty > 0);
    if (itemsToReceive.length === 0) {
      alert('No items to receive. Please enter quantities.');
      return;
    }

    const po = supplierStorePurchaseOrders.find(p => p.id === selectedPOForReceipt.id);
    if (!po) {
      alert('Purchase Order not found');
      return;
    }

    // Create GRN Items
    const grnItems: GRNItem[] = receiptItems
      .filter(item => item.receivedQty > 0)
      .map(receiptItem => {
        const poItem = po.items.find(i => i.itemId === receiptItem.itemId);
        return {
          id: Date.now().toString() + Math.random(),
          poItemId: poItem?.id || '',
          itemId: receiptItem.itemId,
          itemCode: receiptItem.itemCode,
          itemName: receiptItem.itemName,
          orderedQuantity: receiptItem.orderedQty,
          receivedQuantity: receiptItem.receivedQty,
          acceptedQuantity: receiptItem.receivedQty, // Initially accept all, can be adjusted in quality check
          rejectedQuantity: 0,
          unitCost: receiptItem.unitCost,
          totalValue: receiptItem.receivedQty * receiptItem.unitCost,
          batchNumber: receiptItem.batchNumber,
          expiryDate: receiptItem.expiryDate,
          qualityStatus: 'pending' as const,
          notes: receiptItem.notes
        };
      });

    // Create GRN
    const grn = createGRN({
      poId: selectedPOForReceipt.id,
      poNumber: selectedPOForReceipt.poNumber,
      supplierId: selectedPOForReceipt.supplierId,
      supplierName: selectedPOForReceipt.supplierName,
      receiptDate: new Date(),
      receivedBy: 'Current User',
      items: grnItems,
      totalItems: grnItems.length,
      totalValue: grnItems.reduce((sum, item) => sum + item.totalValue, 0),
      status: 'pending',
      notes: `Received goods for PO ${selectedPOForReceipt.poNumber}`
    });

    // Update PO item received quantities and stock
    receiptItems.forEach(receiptItem => {
      const poItem = po.items.find(i => i.itemId === receiptItem.itemId);
      if (poItem && receiptItem.receivedQty > 0) {
        const currentReceived = poItem.receivedQuantity || 0;
        const additionalQty = receiptItem.receivedQty - currentReceived;
        if (additionalQty > 0) {
          poItem.receivedQuantity = receiptItem.receivedQty;
          
          // Update stock level
          updateStockLevel(receiptItem.itemId, additionalQty, 'add');
          
          // Create stock movement with GRN reference
          addStockMovement({
            itemId: receiptItem.itemId,
            itemCode: receiptItem.itemCode,
            itemName: receiptItem.itemName,
            movementType: 'in',
            quantity: additionalQty,
            unitCost: receiptItem.unitCost,
            totalValue: additionalQty * receiptItem.unitCost,
            toLocation: stockItems.find(i => i.id === receiptItem.itemId)?.location || '',
            referenceType: 'purchase',
            referenceId: grn.id,
            referenceNumber: grn.grnNumber,
            batchNumber: receiptItem.batchNumber,
            expiryDate: receiptItem.expiryDate,
            performedBy: 'Current User',
            notes: receiptItem.notes || `Received from ${selectedPOForReceipt.poNumber} - GRN ${grn.grnNumber}`
          });
        }
      }
    });

    // Update PO status
    const allReceived = po.items.every(item => (item.receivedQuantity || 0) >= item.quantity);
    if (allReceived) {
      updatePurchaseOrder(po.id, { status: 'delivered', actualDeliveryDate: new Date() });
    } else {
      updatePurchaseOrder(po.id, { status: 'in-transit' });
    }
    
    alert(`Goods Receipt Note ${grn.grnNumber} created successfully!`);
    onGoodsReceiptClose();
    trackEvent('Stores.Issued', { action: 'goods_receipt', poNumber: selectedPOForReceipt.poNumber, grnNumber: grn.grnNumber });
  };

  // Goods Issue Handlers
  const handleAddIssueItem = () => {
    setIssueFormData({
      ...issueFormData,
      items: [...issueFormData.items, {
        itemId: '',
        itemCode: '',
        itemName: '',
        quantity: 0,
        unitCost: 0
      }]
    });
  };

  const handleIssueGoods = () => {
    if (!issueFormData.department || !issueFormData.issuedTo || issueFormData.items.length === 0) {
      alert('Please fill all required fields and add at least one item');
      return;
    }

    issueFormData.items.forEach(item => {
      if (item.quantity > 0 && item.itemId) {
        const stockItem = stockItems.find(i => i.id === item.itemId);
        if (!stockItem) {
          alert(`Item ${item.itemCode} not found`);
          return;
        }
        
        if (stockItem.currentStock < item.quantity) {
          alert(`Insufficient stock for ${item.itemName}. Available: ${stockItem.currentStock}`);
          return;
        }

        // Update stock level
        updateStockLevel(item.itemId, item.quantity, 'remove');
        
        // Create stock movement
        addStockMovement({
          itemId: item.itemId,
          itemCode: item.itemCode,
          itemName: item.itemName,
          movementType: 'out',
          quantity: item.quantity,
          unitCost: item.unitCost || stockItem.unitCost,
          totalValue: item.quantity * (item.unitCost || stockItem.unitCost),
          fromLocation: stockItem.location,
          referenceType: 'sale',
          referenceId: Date.now().toString(),
          referenceNumber: `ISSUE-${Date.now()}`,
          reason: item.reason || `Issued to ${issueFormData.department}`,
          performedBy: 'Current User',
          notes: `Issued to ${issueFormData.issuedTo} - ${issueFormData.department}. ${issueFormData.notes || ''}`
        });
      }
    });

    alert('Goods issued successfully!');
    onGoodsIssueClose();
    setIssueFormData({ department: '', issuedTo: '', items: [], notes: '' });
    trackEvent('Stores.Issued', { action: 'goods_issue', department: issueFormData.department });
  };

  // Stock Transfer Handlers
  const generateTransferNumber = () => {
    const year = new Date().getFullYear();
    const count = stockTransfers.length + 1;
    return `TRF-${year}-${String(count).padStart(3, '0')}`;
  };

  const handleAddStockTransfer = () => {
    setEditingStockTransfer(null);
    const transferNumber = generateTransferNumber();
    setStockTransferFormData({
      transferNumber,
      fromLocation: '',
      toLocation: '',
      transferDate: new Date(),
      expectedDeliveryDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      status: 'pending',
      priority: 'medium',
      totalItems: 0,
      totalValue: 0,
      items: [],
      createdBy: 'Current User'
    });
    onStockTransferOpen();
  };

  const handleSaveStockTransfer = () => {
    if (!stockTransferFormData.fromLocation || !stockTransferFormData.toLocation || !stockTransferFormData.items || stockTransferFormData.items.length === 0) {
      alert('Please fill all required fields and add at least one item');
      return;
    }

    const transferData: StockTransfer = {
      id: editingStockTransfer?.id || Date.now().toString(),
      transferNumber: stockTransferFormData.transferNumber || generateTransferNumber(),
      fromLocation: stockTransferFormData.fromLocation,
      toLocation: stockTransferFormData.toLocation,
      transferDate: stockTransferFormData.transferDate || new Date(),
      expectedDeliveryDate: stockTransferFormData.expectedDeliveryDate || new Date(),
      status: stockTransferFormData.status || 'pending',
      priority: stockTransferFormData.priority || 'medium',
      totalItems: stockTransferFormData.items.length,
      totalValue: stockTransferFormData.items.reduce((sum, item) => sum + item.totalValue, 0),
      items: stockTransferFormData.items,
      notes: stockTransferFormData.notes,
      createdBy: stockTransferFormData.createdBy || 'Current User',
      createdAt: editingStockTransfer?.createdAt || new Date(),
      updatedAt: new Date()
    };

    // Execute transfers and update stock
    if (transferData.status === 'delivered') {
      transferData.items.forEach(item => {
        const stockItem = stockItems.find(i => i.id === item.itemId);
        if (stockItem) {
          // Remove from source location
          if (stockItem.location === transferData.fromLocation) {
            updateStockLevel(item.itemId, item.quantity, 'remove');
          }
          
          // Add to destination (or update location)
          if (stockItem.location === transferData.toLocation) {
            updateStockLevel(item.itemId, item.quantity, 'add');
          } else {
            // Transfer to different location - create new item record or update location
            updateStockItem(item.itemId, { location: transferData.toLocation });
          }

          // Create stock movement
          addStockMovement({
            itemId: item.itemId,
            itemCode: item.itemCode,
            itemName: item.itemName,
            movementType: 'transfer',
            quantity: item.quantity,
            unitCost: item.unitCost,
            totalValue: item.totalValue,
            fromLocation: transferData.fromLocation,
            toLocation: transferData.toLocation,
            referenceType: 'transfer',
            referenceId: transferData.id,
            referenceNumber: transferData.transferNumber,
            performedBy: transferData.createdBy,
            notes: item.notes || `Transferred from ${transferData.fromLocation} to ${transferData.toLocation}`
          });
        }
      });
    }

    if (editingStockTransfer) {
      setStockTransfers(stockTransfers.map(t => t.id === transferData.id ? transferData : t));
    } else {
      setStockTransfers([...stockTransfers, transferData]);
    }

    onStockTransferClose();
    trackEvent('Stores.Issued', { action: editingStockTransfer ? 'update_stock_transfer' : 'create_stock_transfer', transferNumber: transferData.transferNumber });
  };

  // Stock Count Handlers
  const generateCountNumber = () => {
    const year = new Date().getFullYear();
    const count = stockCounts.length + 1;
    return `CNT-${year}-${String(count).padStart(3, '0')}`;
  };

  const handleAddStockCount = () => {
    setEditingStockCount(null);
    const countNumber = generateCountNumber();
    setStockCountFormData({
      countNumber,
      countType: 'full',
      location: '',
      startDate: new Date(),
      status: 'planned',
      totalItems: 0,
      countedItems: 0,
      varianceItems: 0,
      totalValue: 0,
      varianceValue: 0,
      items: [],
      createdBy: 'Current User'
    });
    onStockCountOpen();
  };

  const handleCompleteStockCount = (count: StockCount) => {
    if (!count.items || count.items.length === 0) {
      alert('No items counted');
      return;
    }

    let varianceValue = 0;
    count.items.forEach(countItem => {
      if (countItem.variance !== 0) {
        const stockItem = stockItems.find(i => i.id === countItem.itemId);
        if (stockItem) {
          varianceValue += countItem.varianceValue;
          
          // Adjust stock to counted quantity
          updateStockLevel(countItem.itemId, countItem.countedQuantity, 'set');
          
          // Create adjustment movement
          addStockMovement({
            itemId: countItem.itemId,
            itemCode: countItem.itemCode,
            itemName: countItem.itemName,
            movementType: 'adjustment',
            quantity: Math.abs(countItem.variance),
            unitCost: countItem.unitCost,
            totalValue: countItem.varianceValue,
            fromLocation: stockItem.location,
            referenceType: 'adjustment',
            referenceId: count.id,
            referenceNumber: count.countNumber,
            reason: countItem.variance > 0 ? 'Overcount' : 'Undercount',
            performedBy: count.performedBy || 'Current User',
            notes: `Stock count adjustment. ${countItem.notes || ''}`
          });
        }
      }
    });

    const updatedCount: StockCount = {
      ...count,
      status: 'completed',
      endDate: new Date(),
      varianceValue: Math.abs(varianceValue),
      varianceItems: count.items.filter(i => i.variance !== 0).length,
      updatedAt: new Date()
    };

    setStockCounts(stockCounts.map(c => c.id === updatedCount.id ? updatedCount : c));
    alert('Stock count completed and adjustments applied!');
    trackEvent('Stores.Issued', { action: 'complete_stock_count', countNumber: count.countNumber });
  };

  // Get unique locations from stock items
  const availableLocations = useMemo(() => {
    const locSet = new Set<string>();
    stockItems.forEach(item => {
      if (item.location) locSet.add(item.location);
    });
    return Array.from(locSet);
  }, [stockItems]);

  const departments = ['F&B', 'Housekeeping', 'Maintenance', 'Front Office', 'Accounting', 'Other'];

  // Render GRN Management Function
  const renderGRNManagement = () => {
    const filteredGRNs = goodsReceiptNotes.filter(grn => {
      const matchesSearch = grnSearchTerm === '' || 
        grn.grnNumber.toLowerCase().includes(grnSearchTerm.toLowerCase()) ||
        grn.poNumber.toLowerCase().includes(grnSearchTerm.toLowerCase()) ||
        grn.supplierName.toLowerCase().includes(grnSearchTerm.toLowerCase());
      const matchesStatus = grnFilterStatus === 'all' || grn.status === grnFilterStatus;
      return matchesSearch && matchesStatus;
    });

    const totalGRNPages = Math.ceil(filteredGRNs.length / grnRowsPerPage);
    const paginatedGRNs = filteredGRNs.slice((grnPage - 1) * grnRowsPerPage, grnPage * grnRowsPerPage);

    return (
      <div className="space-y-6">
        <Card className="border-0 shadow-lg">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between w-full">
              <h3 className="text-xl font-semibold text-ghana-black">📥 Goods Receipt Notes (GRN)</h3>
              <Badge color="primary" variant="flat">
                {goodsReceiptNotes.length} GRNs
              </Badge>
            </div>
          </CardHeader>
          <CardBody>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <Input
                placeholder="Search GRN, PO number or supplier..."
                value={grnSearchTerm}
                onChange={(e) => setGRNSearchTerm(e.target.value)}
                startContent={<span className="text-gray-400">🔍</span>}
                className="md:col-span-2"
              />
              <Select
                placeholder="Filter by Status"
                selectedKeys={[grnFilterStatus]}
                onSelectionChange={(keys) => setGRNFilterStatus(Array.from(keys)[0] as string)}
              >
                <SelectItem key="all">All Status</SelectItem>
                <SelectItem key="pending">Pending</SelectItem>
                <SelectItem key="quality-check">Quality Check</SelectItem>
                <SelectItem key="approved">Approved</SelectItem>
                <SelectItem key="rejected">Rejected</SelectItem>
                <SelectItem key="completed">Completed</SelectItem>
              </Select>
            </div>

            <Table>
              <TableHeader>
                <TableColumn>GRN Number</TableColumn>
                <TableColumn>PO Number</TableColumn>
                <TableColumn>Supplier</TableColumn>
                <TableColumn>Receipt Date</TableColumn>
                <TableColumn>Items</TableColumn>
                <TableColumn>Total Value</TableColumn>
                <TableColumn>Quality Status</TableColumn>
                <TableColumn>Status</TableColumn>
                <TableColumn>Actions</TableColumn>
              </TableHeader>
              <TableBody emptyContent="No GRNs found.">
                {paginatedGRNs.map((grn: GoodsReceiptNote) => (
                  <TableRow key={grn.id}>
                    <TableCell className="font-mono font-semibold">{grn.grnNumber}</TableCell>
                    <TableCell className="font-mono">{grn.poNumber}</TableCell>
                    <TableCell>{grn.supplierName}</TableCell>
                    <TableCell>{grn.receiptDate instanceof Date ? grn.receiptDate.toLocaleDateString() : new Date(grn.receiptDate).toLocaleDateString()}</TableCell>
                    <TableCell>{grn.totalItems} items</TableCell>
                    <TableCell className="font-semibold">₵{grn.totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                    <TableCell>
                      {grn.qualityStatus ? (
                        <Badge 
                          color={grn.qualityStatus === 'passed' ? 'success' : grn.qualityStatus === 'partial' ? 'warning' : 'danger'} 
                          variant="flat"
                        >
                          {grn.qualityStatus}
                        </Badge>
                      ) : (
                        <Badge color="default" variant="flat">Pending</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge 
                        color={
                          grn.status === 'completed' ? 'success' :
                          grn.status === 'approved' ? 'primary' :
                          grn.status === 'quality-check' ? 'warning' :
                          grn.status === 'rejected' ? 'danger' : 'default'
                        } 
                        variant="flat"
                      >
                        {grn.status.replace('-', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Tooltip content="View Details">
                          <Button 
                            size="sm" 
                            variant="flat" 
                            color="primary"
                            onPress={() => {
                              setViewingGRN(grn);
                              onGRNViewOpen();
                            }}
                          >
                            👁️
                          </Button>
                        </Tooltip>
                        {grn.status === 'pending' && (
                          <Tooltip content="Perform Quality Check">
                            <Button 
                              size="sm" 
                              variant="flat" 
                              color="warning"
                              onPress={() => {
                                setSelectedGRNForQC(grn);
                                setQualityCheckFormData({
                                  grnId: grn.id,
                                  grnNumber: grn.grnNumber,
                                  poId: grn.poId,
                                  poNumber: grn.poNumber,
                                  supplierId: grn.supplierId,
                                  supplierName: grn.supplierName,
                                  checkedBy: 'Current User',
                                  checkedDate: new Date(),
                                  items: grn.items.map((item: GRNItem) => ({
                                    id: Date.now().toString() + Math.random(),
                                    grnItemId: item.id,
                                    itemId: item.itemId,
                                    itemCode: item.itemCode,
                                    itemName: item.itemName,
                                    receivedQuantity: item.receivedQuantity,
                                    checkedQuantity: item.receivedQuantity,
                                    passedQuantity: item.receivedQuantity,
                                    failedQuantity: 0,
                                    qualityStatus: 'pending' as const
                                  }))
                                });
                                onQualityCheckOpen();
                              }}
                            >
                              🔍 QC
                            </Button>
                          </Tooltip>
                        )}
                        {grn.status === 'quality-check' && (
                          <>
                            <Tooltip content="Approve GRN">
                              <Button 
                                size="sm" 
                                variant="flat" 
                                color="success"
                                onPress={() => {
                                  if (confirm('Approve this GRN?')) {
                                    approveGRN(grn.id, 'Current User');
                                    trackEvent('Stores.Issued', { action: 'approve_grn', grnNumber: grn.grnNumber });
                                  }
                                }}
                              >
                                ✓
                              </Button>
                            </Tooltip>
                            <Tooltip content="Reject GRN">
                              <Button 
                                size="sm" 
                                variant="flat" 
                                color="danger"
                                onPress={() => {
                                  const reason = prompt('Enter rejection reason:');
                                  if (reason) {
                                    rejectGRN(grn.id, 'Current User', reason);
                                    trackEvent('Stores.Issued', { action: 'reject_grn', grnNumber: grn.grnNumber });
                                  }
                                }}
                              >
                                ✗
                              </Button>
                            </Tooltip>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {totalGRNPages > 1 && (
              <div className="flex justify-center mt-4">
                <Pagination
                  total={totalGRNPages}
                  page={grnPage}
                  onChange={setGRNPage}
                  showControls
                />
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    );
  };

  // Render Invoice Management Function
  const renderInvoiceManagement = () => {
    const filteredInvoices = supplierInvoices.filter(inv => {
      const matchesSearch = invoiceSearchTerm === '' || 
        inv.invoiceNumber.toLowerCase().includes(invoiceSearchTerm.toLowerCase()) ||
        inv.poNumber.toLowerCase().includes(invoiceSearchTerm.toLowerCase()) ||
        inv.supplierName.toLowerCase().includes(invoiceSearchTerm.toLowerCase());
      const matchesStatus = invoiceFilterStatus === 'all' || inv.status === invoiceFilterStatus;
      return matchesSearch && matchesStatus;
    });

    const totalInvoicePages = Math.ceil(filteredInvoices.length / invoiceRowsPerPage);
    const paginatedInvoices = filteredInvoices.slice((invoicePage - 1) * invoiceRowsPerPage, invoicePage * invoiceRowsPerPage);

    return (
      <div className="space-y-6">
        <Card className="border-0 shadow-lg">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between w-full">
              <h3 className="text-xl font-semibold text-ghana-black">🧾 Supplier Invoices</h3>
              <div className="flex gap-2">
                <Badge color="primary" variant="flat">
                  {supplierInvoices.length} Invoices
                </Badge>
                <Button
                  color="primary"
                  className="bg-ghana-gold text-white"
                  variant="flat"
                  onPress={() => {
                    setEditingInvoice(null);
                    setInvoiceFormData({ items: [] });
                    onInvoiceModalOpen();
                  }}
                >
                  + Create Invoice
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardBody>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <Input
                placeholder="Search invoice, PO number or supplier..."
                value={invoiceSearchTerm}
                onChange={(e) => setInvoiceSearchTerm(e.target.value)}
                startContent={<span className="text-gray-400">🔍</span>}
                className="md:col-span-2"
              />
              <Select
                placeholder="Filter by Status"
                selectedKeys={[invoiceFilterStatus]}
                onSelectionChange={(keys) => setInvoiceFilterStatus(Array.from(keys)[0] as string)}
              >
                <SelectItem key="all">All Status</SelectItem>
                <SelectItem key="pending">Pending</SelectItem>
                <SelectItem key="matched">Matched</SelectItem>
                <SelectItem key="approved">Approved</SelectItem>
                <SelectItem key="rejected">Rejected</SelectItem>
                <SelectItem key="paid">Paid</SelectItem>
                <SelectItem key="cancelled">Cancelled</SelectItem>
              </Select>
            </div>

            <Table>
              <TableHeader>
                <TableColumn>Invoice #</TableColumn>
                <TableColumn>PO Number</TableColumn>
                <TableColumn>GRN Number</TableColumn>
                <TableColumn>Supplier</TableColumn>
                <TableColumn>Invoice Date</TableColumn>
                <TableColumn>Total Amount</TableColumn>
                <TableColumn>Matching</TableColumn>
                <TableColumn>Status</TableColumn>
                <TableColumn>Actions</TableColumn>
              </TableHeader>
              <TableBody emptyContent="No invoices found.">
                {paginatedInvoices.map((inv: SupplierInvoice) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-mono font-semibold">{inv.invoiceNumber}</TableCell>
                    <TableCell className="font-mono">{inv.poNumber}</TableCell>
                    <TableCell className="font-mono">{inv.grnNumber || 'N/A'}</TableCell>
                    <TableCell>{inv.supplierName}</TableCell>
                    <TableCell>{inv.invoiceDate instanceof Date ? inv.invoiceDate.toLocaleDateString() : new Date(inv.invoiceDate).toLocaleDateString()}</TableCell>
                    <TableCell className="font-semibold">₵{inv.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                    <TableCell>
                      {inv.matchingStatus.isQuantityMatched && inv.matchingStatus.isPriceMatched && inv.matchingStatus.isTermsMatched ? (
                        <Badge color="success" variant="flat">✓ Matched</Badge>
                      ) : inv.status === 'matched' ? (
                        <Badge color="warning" variant="flat">⚠ Partial</Badge>
                      ) : (
                        <Badge color="default" variant="flat">Pending</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge 
                        color={
                          inv.status === 'paid' ? 'success' :
                          inv.status === 'approved' ? 'primary' :
                          inv.status === 'matched' ? 'warning' :
                          inv.status === 'rejected' || inv.status === 'cancelled' ? 'danger' : 'default'
                        } 
                        variant="flat"
                      >
                        {inv.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Tooltip content="View Details">
                          <Button 
                            size="sm" 
                            variant="flat" 
                            color="primary"
                            onPress={() => {
                              setViewingInvoice(inv);
                              onInvoiceViewOpen();
                            }}
                          >
                            👁️
                          </Button>
                        </Tooltip>
                        {inv.status === 'pending' && (
                          <Tooltip content="3-Way Match">
                            <Button 
                              size="sm" 
                              variant="flat" 
                              color="warning"
                              onPress={() => {
                                setViewingInvoice(inv);
                                onThreeWayMatchOpen();
                              }}
                            >
                              🔗 Match
                            </Button>
                          </Tooltip>
                        )}
                        {inv.status === 'matched' && (
                          <>
                            <Tooltip content="Approve Invoice">
                              <Button 
                                size="sm" 
                                variant="flat" 
                                color="success"
                                onPress={() => {
                                  if (confirm('Approve this invoice for payment?')) {
                                    approveInvoice(inv.id, 'Current User');
                                    trackEvent('Stores.Issued', { action: 'approve_invoice', invoiceNumber: inv.invoiceNumber });
                                  }
                                }}
                              >
                                ✓
                              </Button>
                            </Tooltip>
                            <Tooltip content="Reject Invoice">
                              <Button 
                                size="sm" 
                                variant="flat" 
                                color="danger"
                                onPress={() => {
                                  const reason = prompt('Enter rejection reason:');
                                  if (reason) {
                                    rejectInvoice(inv.id, 'Current User', reason);
                                    trackEvent('Stores.Issued', { action: 'reject_invoice', invoiceNumber: inv.invoiceNumber });
                                  }
                                }}
                              >
                                ✗
                              </Button>
                            </Tooltip>
                          </>
                        )}
                        {inv.status === 'approved' && (
                          <Tooltip content="Mark as Paid">
                            <Button 
                              size="sm" 
                              variant="flat" 
                              color="success"
                              onPress={() => {
                                const method = prompt('Enter payment method (e.g., Bank Transfer, Check, Cash):');
                                const ref = prompt('Enter payment reference:');
                                if (method && ref) {
                                  markInvoicePaid(inv.id, 'Current User', method, ref);
                                  trackEvent('Stores.Issued', { action: 'mark_invoice_paid', invoiceNumber: inv.invoiceNumber });
                                }
                              }}
                            >
                              💰 Pay
                            </Button>
                          </Tooltip>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {totalInvoicePages > 1 && (
              <div className="flex justify-center mt-4">
                <Pagination
                  total={totalInvoicePages}
                  page={invoicePage}
                  onChange={setInvoicePage}
                  showControls
                />
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    );
  };

  // Render Reports & Analytics Function (merged with Analytics Dashboard)
  const renderReportsAndAnalytics = () => {
    // Use component-level metrics (already computed above)
    const reportTotalInventoryValue = getTotalInventoryValue();
    const reportTotalItems = stockItems.length;
    const reportLowStockCount = getLowStockItems().length;
    const reportOutOfStockCount = getOutOfStockItems().length;
    
    return (
      <div className="space-y-6">
        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="border-0 shadow-lg">
            <CardBody className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Inventory Value</p>
                  <p className="text-2xl font-bold text-green-600">₵{reportTotalInventoryValue.toLocaleString()}</p>
                </div>
                <div className="text-3xl">💰</div>
              </div>
            </CardBody>
          </Card>
          
          <Card className="border-0 shadow-lg">
            <CardBody className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Items</p>
                  <p className="text-2xl font-bold text-blue-600">{reportTotalItems}</p>
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
                  <p className="text-2xl font-bold text-orange-600">{reportLowStockCount}</p>
                </div>
                <div className="text-3xl">⚠️</div>
              </div>
            </CardBody>
          </Card>
          
          <Card className="border-0 shadow-lg">
            <CardBody className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Out of Stock</p>
                  <p className="text-2xl font-bold text-red-600">{reportOutOfStockCount}</p>
                </div>
                <div className="text-3xl">❌</div>
              </div>
            </CardBody>
          </Card>
        </div>

        {/* Reports */}
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <h3 className="text-xl font-semibold text-ghana-black">📊 Reports & Analytics</h3>
          </CardHeader>
          <CardBody>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="border-0 shadow-md hover:shadow-lg transition-shadow cursor-pointer" isPressable>
                <CardBody className="p-6">
                  <div className="text-center">
                    <div className="text-4xl mb-2">📈</div>
                    <h4 className="font-semibold mb-2">Inventory Valuation Report</h4>
                    <p className="text-sm text-gray-500">Total inventory value by category</p>
                  </div>
                </CardBody>
              </Card>
              
              <Card className="border-0 shadow-md hover:shadow-lg transition-shadow cursor-pointer" isPressable>
                <CardBody className="p-6">
                  <div className="text-center">
                    <div className="text-4xl mb-2">📊</div>
                    <h4 className="font-semibold mb-2">Stock Movement Report</h4>
                    <p className="text-sm text-gray-500">Inbound and outbound movements</p>
                  </div>
                </CardBody>
              </Card>
              
              <Card className="border-0 shadow-md hover:shadow-lg transition-shadow cursor-pointer" isPressable>
                <CardBody className="p-6">
                  <div className="text-center">
                    <div className="text-4xl mb-2">📋</div>
                    <h4 className="font-semibold mb-2">Purchase Order Report</h4>
                    <p className="text-sm text-gray-500">PO status and tracking</p>
                  </div>
                </CardBody>
              </Card>
              
              <Card className="border-0 shadow-md hover:shadow-lg transition-shadow cursor-pointer" isPressable>
                <CardBody className="p-6">
                  <div className="text-center">
                    <div className="text-4xl mb-2">⚠️</div>
                    <h4 className="font-semibold mb-2">Low Stock Report</h4>
                    <p className="text-sm text-gray-500">Items below reorder point</p>
                  </div>
                </CardBody>
              </Card>
              
              <Card className="border-0 shadow-md hover:shadow-lg transition-shadow cursor-pointer" isPressable>
                <CardBody className="p-6">
                  <div className="text-center">
                    <div className="text-4xl mb-2">🤝</div>
                    <h4 className="font-semibold mb-2">Supplier Performance</h4>
                    <p className="text-sm text-gray-500">Supplier ratings and metrics</p>
                  </div>
                </CardBody>
              </Card>
              
              <Card className="border-0 shadow-md hover:shadow-lg transition-shadow cursor-pointer" isPressable>
                <CardBody className="p-6">
                  <div className="text-center">
                    <div className="text-4xl mb-2">💾</div>
                    <h4 className="font-semibold mb-2">Export Report</h4>
                    <p className="text-sm text-gray-500">Download reports in various formats</p>
                  </div>
                </CardBody>
              </Card>
            </div>
          </CardBody>
        </Card>

        {/* Analytics Dashboard */}
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <h3 className="text-xl font-semibold text-ghana-black">📈 Inventory Analytics</h3>
          </CardHeader>
          <CardBody>
            <div className="text-center py-12 text-gray-500">
              <div className="text-6xl mb-4">📊</div>
              <p className="text-lg">Analytics dashboard coming soon</p>
              <p className="text-sm">Charts and visualizations will be displayed here</p>
            </div>
          </CardBody>
        </Card>
      </div>
    );
  };

  // Render Stock Operations Function
  const renderStockOperations = () => {
    // Get POs ready for receipt (confirmed or in-transit)
    const posForReceipt = supplierStorePurchaseOrders.filter(po => 
      po.status === 'confirmed' || po.status === 'in-transit'
    );
    
    // Get today's receipts and issues
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayReceipts = stockMovements.filter(m => {
      const mDate = new Date(m.createdAt);
      mDate.setHours(0, 0, 0, 0);
      return mDate.getTime() === today.getTime() && m.movementType === 'in';
    });
    const todayIssues = stockMovements.filter(m => {
      const mDate = new Date(m.createdAt);
      mDate.setHours(0, 0, 0, 0);
      return mDate.getTime() === today.getTime() && m.movementType === 'out';
    });

    return (
      <div className="space-y-6">
        {/* Sub-tabs for Stock Operations */}
        <Tabs
          selectedKey={stockOpSubTab}
          onSelectionChange={(key) => setStockOpSubTab(key as string)}
        >
          <Tab key="goods-receipt" title="📥 Goods Receipt" />
          <Tab key="goods-issue" title="📤 Goods Issue" />
          <Tab key="stock-transfers" title="🔄 Stock Transfers" />
          <Tab key="stock-counts" title="🔍 Stock Counts" />
        </Tabs>

        {/* Goods Receipt Tab */}
        {stockOpSubTab === 'goods-receipt' && (
          <div className="space-y-6">
            <Card className="border-0 shadow-lg">
              <CardHeader className="flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-bold">Goods Receipt</h3>
                  <p className="text-sm text-gray-500">Receive goods from Purchase Orders</p>
                </div>
                <Badge color="primary" variant="flat">
                  {posForReceipt.length} POs Ready
                </Badge>
              </CardHeader>
              <CardBody>
                <div className="space-y-4">
                  <Input
                    placeholder="Та Search PO by number..."
                    value={poSearchTerm}
                    onChange={(e) => setPOSearchTerm(e.target.value)}
                    startContent={<span>🔍</span>}
                  />
                  {posForReceipt.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableColumn>PO Number</TableColumn>
                        <TableColumn>Supplier</TableColumn>
                        <TableColumn>Order Date</TableColumn>
                        <TableColumn>Expected Delivery</TableColumn>
                        <TableColumn>Items</TableColumn>
                        <TableColumn>Status</TableColumn>
                        <TableColumn>Actions</TableColumn>
                      </TableHeader>
                      <TableBody>
                        {posForReceipt
                          .filter(po => 
                            po.poNumber.toLowerCase().includes(poSearchTerm.toLowerCase()) ||
                            po.supplierName.toLowerCase().includes(poSearchTerm.toLowerCase())
                          )
                          .map(po => (
                            <TableRow key={po.id}>
                              <TableCell className="font-mono font-semibold">{po.poNumber}</TableCell>
                              <TableCell>{po.supplierName}</TableCell>
                              <TableCell>{po.orderDate instanceof Date ? po.orderDate.toLocaleDateString() : new Date(po.orderDate).toLocaleDateString()}</TableCell>
                              <TableCell>{po.expectedDeliveryDate instanceof Date ? po.expectedDeliveryDate.toLocaleDateString() : new Date(po.expectedDeliveryDate).toLocaleDateString()}</TableCell>
                              <TableCell>{po.items.length} items</TableCell>
                              <TableCell>
                                <Badge color={po.status === 'confirmed' ? 'warning' : 'primary'} variant="flat">
                                  {po.status}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Button
                                  size="sm"
                                  color="primary"
                                  onPress={() => handleOpenGoodsReceipt(po)}
                                >
                                  Receive Goods
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      No Purchase Orders ready for receipt
                    </div>
                  )}
                </div>
              </CardBody>
            </Card>
          </div>
        )}

        {/* Goods Issue Tab */}
        {stockOpSubTab === 'goods-issue' && (
          <div className="space-y-6">
            <Card className="border-0 shadow-lg">
              <CardHeader className="flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-bold">Goods Issue</h3>
                  <p className="text-sm text-gray-500">Issue stock to departments</p>
                </div>
                <div className="flex gap-2">
                  <Badge color="success" variant="flat">
                    {todayIssues.length} Issues Today
                  </Badge>
                  <Button color="primary" onPress={onGoodsIssueOpen}>
                    + New Issue
                  </Button>
                </div>
              </CardHeader>
              <CardBody>
                <div className="text-center py-8 text-gray-500">
                  Issue history will be displayed here
                </div>
              </CardBody>
            </Card>
          </div>
        )}

        {/* Stock Transfers Tab */}
        {stockOpSubTab === 'stock-transfers' && (
          <div className="space-y-6">
            <Card className="border-0 shadow-lg">
              <CardHeader className="flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-bold">Stock Transfers</h3>
                  <p className="text-sm text-gray-500">Transfer stock between locations</p>
                </div>
                <Button color="primary" onPress={handleAddStockTransfer}>
                  + New Transfer
                </Button>
              </CardHeader>
              <CardBody>
                <div className="flex gap-4 mb-4">
                  <Input
                    placeholder="Search transfers..."
                    value={stockTransferSearchTerm}
                    onChange={(e) => setStockTransferSearchTerm(e.target.value)}
                    startContent={<span>🔍</span>}
                    className="flex-1"
                  />
                  <Select
                    selectedKeys={stockTransferFilterStatus ? [stockTransferFilterStatus] : ['all']}
                    onSelectionChange={(keys) => setStockTransferFilterStatus(Array.from(keys)[0] as string)}
                    className="w-40"
                  >
                    <SelectItem key="all">All Status</SelectItem>
                    <SelectItem key="pending">Pending</SelectItem>
                    <SelectItem key="in-transit">In Transit</SelectItem>
                    <SelectItem key="delivered">Delivered</SelectItem>
                    <SelectItem key="cancelled">Cancelled</SelectItem>
                  </Select>
                </div>
                {stockTransfers.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableColumn>Transfer #</TableColumn>
                      <TableColumn>From Location</TableColumn>
                      <TableColumn>To Location</TableColumn>
                      <TableColumn>Transfer Date</TableColumn>
                      <TableColumn>Items</TableColumn>
                      <TableColumn>Status</TableColumn>
                      <TableColumn>Actions</TableColumn>
                    </TableHeader>
                    <TableBody>
                      {stockTransfers
                        .filter(t => 
                          (stockTransferSearchTerm === '' || t.transferNumber.toLowerCase().includes(stockTransferSearchTerm.toLowerCase())) &&
                          (stockTransferFilterStatus === 'all' || t.status === stockTransferFilterStatus)
                        )
                        .map(transfer => (
                          <TableRow key={transfer.id}>
                            <TableCell className="font-mono font-semibold">{transfer.transferNumber}</TableCell>
                            <TableCell>{transfer.fromLocation}</TableCell>
                            <TableCell>{transfer.toLocation}</TableCell>
                            <TableCell>{transfer.transferDate instanceof Date ? transfer.transferDate.toLocaleDateString() : new Date(transfer.transferDate).toLocaleDateString()}</TableCell>
                            <TableCell>{transfer.items.length} items</TableCell>
                            <TableCell>
                              <Badge 
                                color={
                                  transfer.status === 'delivered' ? 'success' :
                                  transfer.status === 'in-transit' ? 'warning' :
                                  transfer.status === 'cancelled' ? 'danger' : 'default'
                                }
                                variant="flat"
                              >
                                {transfer.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="flat"
                                  color="primary"
                                  onPress={() => {
                                    setViewingStockTransfer(transfer);
                                    onStockTransferViewOpen();
                                  }}
                                >
                                  View
                                </Button>
                                {transfer.status === 'pending' && (
                                  <Button
                                    size="sm"
                                    variant="flat"
                                    color="success"
                                    onPress={() => {
                                      setEditingStockTransfer(transfer);
                                      setStockTransferFormData({ ...transfer, items: transfer.items });
                                      onStockTransferOpen();
                                    }}
                                  >
                                    Edit
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    No stock transfers found. Create a new transfer to get started.
                  </div>
                )}
              </CardBody>
            </Card>
          </div>
        )}

        {/* Stock Counts Tab */}
        {stockOpSubTab === 'stock-counts' && (
          <div className="space-y-6">
            <Card className="border-0 shadow-lg">
              <CardHeader className="flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-bold">Stock Counts</h3>
                  <p className="text-sm text-gray-500">Physical inventory verification</p>
                </div>
                <Button color="primary" onPress={handleAddStockCount}>
                  + New Stock Count
                </Button>
              </CardHeader>
              <CardBody>
                <div className="flex gap-4 mb-4">
                  <Input
                    placeholder="Search counts..."
                    value={stockCountSearchTerm}
                    onChange={(e) => setStockCountSearchTerm(e.target.value)}
                    startContent={<span>🔍</span>}
                    className="flex-1"
                  />
                  <Select
                    selectedKeys={stockCountFilterStatus ? [stockCountFilterStatus] : ['all']}
                    onSelectionChange={(keys) => setStockCountFilterStatus(Array.from(keys)[0] as string)}
                    className="w-40"
                  >
                    <SelectItem key="all">All Status</SelectItem>
                    <SelectItem key="planned">Planned</SelectItem>
                    <SelectItem key="in-progress">In Progress</SelectItem>
                    <SelectItem key="completed">Completed</SelectItem>
                    <SelectItem key="cancelled">Cancelled</SelectItem>
                  </Select>
                </div>
                {stockCounts.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableColumn>Count #</TableColumn>
                      <TableColumn>Type</TableColumn>
                      <TableColumn>Location</TableColumn>
                      <TableColumn>Start Date</TableColumn>
                      <TableColumn>Items</TableColumn>
                      <TableColumn>Status</TableColumn>
                      <TableColumn>Actions</TableColumn>
                    </TableHeader>
                    <TableBody>
                      {stockCounts
                        .filter(c => 
                          (stockCountSearchTerm === '' || c.countNumber.toLowerCase().includes(stockCountSearchTerm.toLowerCase())) &&
                          (stockCountFilterStatus === 'all' || c.status === stockCountFilterStatus)
                        )
                        .map(count => (
                          <TableRow key={count.id}>
                            <TableCell className="font-mono font-semibold">{count.countNumber}</TableCell>
                            <TableCell>
                              <Chip size="sm" variant="flat">
                                {count.countType}
                              </Chip>
                            </TableCell>
                            <TableCell>{count.location}</TableCell>
                            <TableCell>{count.startDate instanceof Date ? count.startDate.toLocaleDateString() : new Date(count.startDate).toLocaleDateString()}</TableCell>
                            <TableCell>{count.items.length} items</TableCell>
                            <TableCell>
                              <Badge 
                                color={
                                  count.status === 'completed' ? 'success' :
                                  count.status === 'in-progress' ? 'warning' :
                                  count.status === 'cancelled' ? 'danger' : 'default'
                                }
                                variant="flat"
                              >
                                {count.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="flat"
                                  color="primary"
                                  onPress={() => {
                                    setViewingStockCount(count);
                                    onStockCountViewOpen();
                                  }}
                                >
                                  View
                                </Button>
                                {count.status === 'in-progress' && (
                                  <Button
                                    size="sm"
                                    variant="flat"
                                    color="success"
                                    onPress={() => {
                                      if (confirm('Complete this stock count? This will apply adjustments to stock levels.')) {
                                        handleCompleteStockCount(count);
                                      }
                                    }}
                                  >
                                    Complete
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    No stock counts found. Create a new count to get started.
                  </div>
                )}
              </CardBody>
            </Card>
          </div>
        )}
      </div>
    );
  };

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
        <Tab key="overview" title="📊 Overview" />
        <Tab key="inventory" title="📦 Inventory Management" />
        <Tab key="suppliers" title="🏢 Supplier Management" />
        <Tab key="purchase-orders" title="📋 Purchase Orders" />
        <Tab key="stock-operations" title="🔄 Stock Operations" />
        <Tab key="reports" title="📊 Reports & Analytics" />
      </Tabs>

      <div className="mt-6">
        {selectedTab === 'overview' && renderOverview()}
        {selectedTab === 'inventory' && renderInventoryManagement()}
        {selectedTab === 'suppliers' && renderSupplierManagement()}
        {selectedTab === 'purchase-orders' && renderPurchaseOrders()}
        {selectedTab === 'stock-operations' && renderStockOperations()}
        {selectedTab === 'reports' && renderReportsAndAnalytics()}
      </div>
      
      {/* Modals for Inventory Management - rendered outside conditional to avoid hook issues */}
      {selectedTab === 'inventory' && (
        <>
          {/* Add/Edit Modal */}
          <Modal isOpen={isOpen} onClose={onClose} size="3xl" scrollBehavior="inside">
            <ModalContent>
              <ModalHeader>
                {editingItem ? 'Edit Stock Item' : 'Add Stock Item'}
              </ModalHeader>
              <ModalBody>
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Item Code"
                    value={formData.itemCode || ''}
                    onChange={(e) => setFormData({ ...formData, itemCode: e.target.value })}
                    placeholder="e.g., F001"
                    isRequired
                  />
                  <Input
                    label="Item Name"
                    value={formData.name || ''}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Enter item name"
                    isRequired
                  />
                  <Textarea
                    label="Description"
                    value={formData.description || ''}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Enter description"
                    className="col-span-2"
                  />
                  <Select
                    label="Category"
                    selectedKeys={formData.category ? [formData.category] : []}
                    onSelectionChange={(keys) => setFormData({ ...formData, category: Array.from(keys)[0] as any })}
                  >
                    {categories.map(cat => (
                      <SelectItem key={cat}>{cat}</SelectItem>
                    ))}
                  </Select>
                  <Input
                    label="Subcategory"
                    value={formData.subcategory || ''}
                    onChange={(e) => setFormData({ ...formData, subcategory: e.target.value })}
                    placeholder="Enter subcategory"
                  />
                  <Input
                    label="Unit of Measure"
                    value={formData.unit || ''}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    placeholder="e.g., kg, pieces, bottles"
                    isRequired
                  />
                  <Input
                    label="Unit Cost (₵)"
                    type="number"
                    value={formData.unitCost?.toString() || '0'}
                    onChange={(e) => setFormData({ ...formData, unitCost: parseFloat(e.target.value) || 0 })}
                    isRequired
                  />
                  <Input
                    label="Selling Price (₵)"
                    type="number"
                    value={formData.sellingPrice?.toString() || ''}
                    onChange={(e) => setFormData({ ...formData, sellingPrice: parseFloat(e.target.value) || undefined })}
                  />
                  <Input
                    label="Current Stock"
                    type="number"
                    value={formData.currentStock?.toString() || '0'}
                    onChange={(e) => setFormData({ ...formData, currentStock: parseFloat(e.target.value) || 0 })}
                    isRequired
                  />
                  <Input
                    label="Minimum Stock"
                    type="number"
                    value={formData.minimumStock?.toString() || '0'}
                    onChange={(e) => setFormData({ ...formData, minimumStock: parseFloat(e.target.value) || 0 })}
                    isRequired
                  />
                  <Input
                    label="Maximum Stock"
                    type="number"
                    value={formData.maximumStock?.toString() || '0'}
                    onChange={(e) => setFormData({ ...formData, maximumStock: parseFloat(e.target.value) || 0 })}
                    isRequired
                  />
                  <Input
                    label="Reorder Point"
                    type="number"
                    value={formData.reorderPoint?.toString() || '0'}
                    onChange={(e) => setFormData({ ...formData, reorderPoint: parseFloat(e.target.value) || 0 })}
                    isRequired
                  />
                  <Input
                    label="Location"
                    value={formData.location || ''}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    placeholder="e.g., Kitchen Store"
                    isRequired
                  />
                  <Input
                    label="Bin Location"
                    value={formData.binLocation || ''}
                    onChange={(e) => setFormData({ ...formData, binLocation: e.target.value })}
                    placeholder="e.g., A1-B2"
                  />
                  <div className="col-span-2 flex gap-4">
                    <Chip
                      color={formData.isActive ? 'success' : 'default'}
                      onClick={() => setFormData({ ...formData, isActive: !formData.isActive })}
                      className="cursor-pointer"
                    >
                      {formData.isActive ? '✓ Active' : 'Inactive'}
                    </Chip>
                    <Chip
                      color={formData.isPerishable ? 'warning' : 'default'}
                      onClick={() => setFormData({ ...formData, isPerishable: !formData.isPerishable })}
                      className="cursor-pointer"
                    >
                      {formData.isPerishable ? '✓ Perishable' : 'Non-Perishable'}
                    </Chip>
                    <Chip
                      color={formData.isSerialized ? 'primary' : 'default'}
                      onClick={() => setFormData({ ...formData, isSerialized: !formData.isSerialized })}
                      className="cursor-pointer"
                    >
                      {formData.isSerialized ? '✓ Serialized' : 'Not Serialized'}
                    </Chip>
                  </div>
                </div>
              </ModalBody>
              <ModalFooter>
                <Button variant="bordered" onPress={onClose}>Cancel</Button>
                <Button color="primary" onPress={handleSaveItem}>
                  {editingItem ? 'Update' : 'Add'} Item
                </Button>
              </ModalFooter>
            </ModalContent>
          </Modal>

          {/* View Details Modal */}
          <Modal isOpen={viewOpen} onClose={() => setViewOpen(false)} size="2xl" scrollBehavior="inside">
            <ModalContent>
              <ModalHeader>
                <div>
                  <div className="text-xl font-semibold">Stock Item Details</div>
                  <div className="text-sm text-gray-500 font-mono">{viewingItem?.itemCode}</div>
                </div>
              </ModalHeader>
              <ModalBody>
                {viewingItem && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Item Name</div>
                        <div className="font-semibold">{viewingItem.name}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Category</div>
                        <Chip color={getCategoryColor(viewingItem.category)} size="sm" variant="flat">
                          {viewingItem.category}
                        </Chip>
                      </div>
                      <div className="col-span-2">
                        <div className="text-xs text-gray-500 mb-1">Description</div>
                        <div className="text-sm">{viewingItem.description || 'N/A'}</div>
                      </div>
                    </div>
                    
                    <Divider />
                    
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Current Stock</div>
                        <div className="text-lg font-semibold text-blue-600">
                          {viewingItem.currentStock.toLocaleString()} {viewingItem.unit}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Reorder Point</div>
                        <div className="text-lg font-semibold">{viewingItem.reorderPoint}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Stock Value</div>
                        <div className="text-lg font-semibold text-green-600">
                          ₵{(viewingItem.currentStock * viewingItem.unitCost).toLocaleString()}
                        </div>
                      </div>
                    </div>
                    
                    <Divider />
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Unit Cost</div>
                        <div className="font-semibold">₵{viewingItem.unitCost.toLocaleString()}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Selling Price</div>
                        <div className="font-semibold">
                          {viewingItem.sellingPrice ? `₵${viewingItem.sellingPrice.toLocaleString()}` : 'N/A'}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Minimum Stock</div>
                        <div className="font-semibold">{viewingItem.minimumStock}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Maximum Stock</div>
                        <div className="font-semibold">{viewingItem.maximumStock}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Location</div>
                        <div className="font-semibold">{viewingItem.location}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Bin Location</div>
                        <div className="font-semibold">{viewingItem.binLocation || 'N/A'}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Status</div>
                        <Badge color={getStockStatus(viewingItem).color as any} size="sm">
                          {getStockStatus(viewingItem).label}
                        </Badge>
                      </div>
                    </div>
                  </div>
                )}
              </ModalBody>
              <ModalFooter>
                <Button variant="bordered" onPress={() => setViewOpen(false)}>Close</Button>
                {viewingItem && (
                  <Button color="primary" onPress={() => {
                    setViewOpen(false);
                    handleEditItem(viewingItem);
                  }}>
                    Edit
                  </Button>
                )}
              </ModalFooter>
            </ModalContent>
          </Modal>
        </>
      )}

      {/* Supplier Modals - rendered outside conditional to avoid hook issues */}
      {selectedTab === 'suppliers' && (
        <>
          {/* Add/Edit Supplier Modal */}
          <Modal isOpen={isSupplierModalOpen} onClose={onSupplierModalClose} size="3xl" scrollBehavior="inside">
            <ModalContent>
              <ModalHeader>
                {editingSupplier ? 'Edit Supplier' : 'Add Supplier'}
              </ModalHeader>
              <ModalBody>
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Supplier Code"
                    value={supplierFormData.code || ''}
                    onChange={(e) => setSupplierFormData({ ...supplierFormData, code: e.target.value })}
                    placeholder="Auto-generated"
                    isDisabled={!editingSupplier}
                    description={editingSupplier ? "Code can be edited" : "Code is auto-generated"}
                    isRequired
                  />
                  <Input
                    label="Supplier Name"
                    value={supplierFormData.name || ''}
                    onChange={(e) => setSupplierFormData({ ...supplierFormData, name: e.target.value })}
                    placeholder="Enter supplier name"
                    isRequired
                  />
                  <Input
                    label="Contact Person"
                    value={supplierFormData.contactPerson || ''}
                    onChange={(e) => setSupplierFormData({ ...supplierFormData, contactPerson: e.target.value })}
                    placeholder="Contact person name"
                    isRequired
                  />
                  <Input
                    label="Email"
                    type="email"
                    value={supplierFormData.email || ''}
                    onChange={(e) => setSupplierFormData({ ...supplierFormData, email: e.target.value })}
                    placeholder="supplier@email.com"
                    isRequired
                  />
                  <Input
                    label="Phone"
                    value={supplierFormData.phone || ''}
                    onChange={(e) => setSupplierFormData({ ...supplierFormData, phone: e.target.value })}
                    placeholder="+233 XX XXX XXXX"
                    isRequired
                  />
                  <Input
                    label="Tax ID"
                    value={supplierFormData.taxId || ''}
                    onChange={(e) => setSupplierFormData({ ...supplierFormData, taxId: e.target.value })}
                    placeholder="e.g., GH123456789"
                  />
                  <Textarea
                    label="Address"
                    value={supplierFormData.address || ''}
                    onChange={(e) => setSupplierFormData({ ...supplierFormData, address: e.target.value })}
                    placeholder="Street address"
                    className="col-span-2"
                    isRequired
                  />
                  <Input
                    label="City"
                    value={supplierFormData.city || ''}
                    onChange={(e) => setSupplierFormData({ ...supplierFormData, city: e.target.value })}
                    placeholder="City"
                    isRequired
                  />
                  <Input
                    label="Country"
                    value={supplierFormData.country || 'Ghana'}
                    onChange={(e) => setSupplierFormData({ ...supplierFormData, country: e.target.value })}
                    placeholder="Country"
                  />
                  <Input
                    label="Postal Code"
                    value={supplierFormData.postalCode || ''}
                    onChange={(e) => setSupplierFormData({ ...supplierFormData, postalCode: e.target.value })}
                    placeholder="Postal code"
                  />
                  <Select
                    label="Payment Terms"
                    selectedKeys={supplierFormData.paymentTerms ? [supplierFormData.paymentTerms] : []}
                    onSelectionChange={(keys) => setSupplierFormData({ ...supplierFormData, paymentTerms: Array.from(keys)[0] as any })}
                  >
                    <SelectItem key="immediate">Immediate</SelectItem>
                    <SelectItem key="net30">Net 30</SelectItem>
                    <SelectItem key="net60">Net 60</SelectItem>
                    <SelectItem key="net90">Net 90</SelectItem>
                  </Select>
                  <Input
                    label="Credit Limit (₵)"
                    type="number"
                    value={supplierFormData.creditLimit?.toString() || '0'}
                    onChange={(e) => setSupplierFormData({ ...supplierFormData, creditLimit: parseFloat(e.target.value) || 0 })}
                    isRequired
                  />
                  <Input
                    label="Rating (1-5)"
                    type="number"
                    min={0}
                    max={5}
                    step={0.1}
                    value={supplierFormData.rating?.toString() || '0'}
                    onChange={(e) => setSupplierFormData({ ...supplierFormData, rating: parseFloat(e.target.value) || 0 })}
                  />
                  <Input
                    label="Current Balance (₵)"
                    type="number"
                    value={supplierFormData.currentBalance?.toString() || '0'}
                    onChange={(e) => setSupplierFormData({ ...supplierFormData, currentBalance: parseFloat(e.target.value) || 0 })}
                  />
                  <Input
                    label="Categories (comma separated)"
                    value={supplierFormData.categories?.join(', ') || ''}
                    onChange={(e) => setSupplierFormData({ 
                      ...supplierFormData, 
                      categories: e.target.value.split(',').map(c => c.trim()).filter(c => c) 
                    })}
                    placeholder="e.g., food, beverage, cleaning"
                  />
                  <div className="col-span-2">
                    <Chip
                      color={supplierFormData.isActive ? 'success' : 'default'}
                      onClick={() => setSupplierFormData({ ...supplierFormData, isActive: !supplierFormData.isActive })}
                      className="cursor-pointer"
                    >
                      {supplierFormData.isActive ? '✓ Active' : 'Inactive'}
                    </Chip>
                  </div>
                </div>
              </ModalBody>
              <ModalFooter>
                <Button variant="bordered" onPress={onSupplierModalClose}>Cancel</Button>
                <Button color="primary" onPress={handleSaveSupplier}>
                  {editingSupplier ? 'Update' : 'Add'} Supplier
                </Button>
              </ModalFooter>
            </ModalContent>
          </Modal>

          {/* View Supplier Details Modal */}
          <Modal isOpen={supplierViewOpen} onClose={() => setSupplierViewOpen(false)} size="2xl" scrollBehavior="inside">
            <ModalContent>
              <ModalHeader>
                <div>
                  <div className="text-xl font-semibold">Supplier Details</div>
                  <div className="text-sm text-gray-500 font-mono">{viewingSupplier?.code}</div>
                </div>
              </ModalHeader>
              <ModalBody>
                {viewingSupplier && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Supplier Name</div>
                        <div className="font-semibold">{viewingSupplier.name}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Status</div>
                        <Badge color={viewingSupplier.isActive ? 'success' : 'default'} size="sm">
                          {viewingSupplier.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Contact Person</div>
                        <div className="font-semibold">{viewingSupplier.contactPerson}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Email</div>
                        <div className="text-sm">{viewingSupplier.email}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Phone</div>
                        <div className="text-sm">{viewingSupplier.phone}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Tax ID</div>
                        <div className="text-sm font-mono">{viewingSupplier.taxId}</div>
                      </div>
                    </div>
                    
                    <Divider />
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Address</div>
                        <div className="text-sm">{viewingSupplier.address}</div>
                        <div className="text-sm">{viewingSupplier.city}, {viewingSupplier.country}</div>
                        <div className="text-sm">{viewingSupplier.postalCode}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Payment Terms</div>
                        <Chip size="sm" variant="flat" color="secondary">
                          {viewingSupplier.paymentTerms.toUpperCase()}
                        </Chip>
                      </div>
                    </div>
                    
                    <Divider />
                    
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Credit Limit</div>
                        <div className="text-lg font-semibold text-blue-600">
                          ₵{viewingSupplier.creditLimit.toLocaleString()}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Current Balance</div>
                        <div className={`text-lg font-semibold ${
                          viewingSupplier.currentBalance > viewingSupplier.creditLimit * 0.8 ? 'text-red-600' :
                          viewingSupplier.currentBalance > viewingSupplier.creditLimit * 0.6 ? 'text-orange-600' :
                          'text-green-600'
                        }`}>
                          ₵{viewingSupplier.currentBalance.toLocaleString()}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Available Credit</div>
                        <div className="text-lg font-semibold text-green-600">
                          ₵{Math.max(0, viewingSupplier.creditLimit - viewingSupplier.currentBalance).toLocaleString()}
                        </div>
                      </div>
                    </div>
                    
                    <Divider />
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Rating</div>
                        <div className="flex items-center space-x-2">
                          <span className="text-lg font-semibold">{viewingSupplier.rating.toFixed(1)}</span>
                          <div className="flex">
                            {[...Array(5)].map((_, i) => (
                              <span 
                                key={i} 
                                className={`text-lg ${i < Math.floor(viewingSupplier.rating) ? 'text-yellow-500' : 'text-gray-300'}`}
                              >
                                ★
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Categories</div>
                        <div className="flex flex-wrap gap-1">
                          {viewingSupplier.categories.map((cat) => (
                            <Chip key={cat} size="sm" variant="flat" color="primary">
                              {cat}
                            </Chip>
                          ))}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500 mb-1">On-Time Delivery</div>
                        <div className="text-sm font-semibold">{viewingSupplier.performance.onTimeDelivery}%</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Total Orders</div>
                        <div className="text-sm font-semibold">{viewingSupplier.performance.totalOrders}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Quality Rating</div>
                        <div className="text-sm font-semibold">{viewingSupplier.performance.qualityRating.toFixed(1)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Avg Response Time</div>
                        <div className="text-sm font-semibold">{viewingSupplier.performance.responseTime} days</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Contract Start</div>
                        <div className="text-sm">
                          {new Date(viewingSupplier.contractStartDate).toLocaleDateString()}
                        </div>
                      </div>
                      {viewingSupplier.contractEndDate && (
                        <div>
                          <div className="text-xs text-gray-500 mb-1">Contract End</div>
                          <div className="text-sm">
                            {new Date(viewingSupplier.contractEndDate).toLocaleDateString()}
                          </div>
                        </div>
                      )}
                    </div>

                    {viewingSupplier.notes && (
                      <>
                        <Divider />
                        <div>
                          <div className="text-xs text-gray-500 mb-1">Notes</div>
                          <div className="text-sm">{viewingSupplier.notes}</div>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </ModalBody>
              <ModalFooter>
                <Button variant="bordered" onPress={() => setSupplierViewOpen(false)}>Close</Button>
                {viewingSupplier && (
                  <Button color="primary" onPress={() => {
                    setSupplierViewOpen(false);
                    handleEditSupplier(viewingSupplier);
                  }}>
                    Edit
                  </Button>
                )}
              </ModalFooter>
            </ModalContent>
          </Modal>
        </>
      )}

      {/* Purchase Order Modals */}
      <Modal isOpen={isPOModalOpen} onClose={onPOModalClose} size="5xl" scrollBehavior="inside">
        <ModalContent>
          <ModalHeader>
            {editingPO ? 'Edit Purchase Order' : 'Create Purchase Order'}
          </ModalHeader>
          <ModalBody>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="PO Number"
                  value={poFormData.poNumber || ''}
                  isDisabled
                  description="Auto-generated"
                />
                <Select
                  label="Supplier"
                  placeholder="Select Supplier"
                  selectedKeys={poFormData.supplierId ? [poFormData.supplierId] : []}
                  onSelectionChange={(keys) => handlePOSupplierChange(Array.from(keys)[0] as string)}
                  isRequired
                >
                  {mergedSuppliers.filter(s => s.isActive).map(supplier => (
                    <SelectItem key={supplier.id}>{supplier.name}</SelectItem>
                  ))}
                </Select>
                <Input
                  label="Order Date"
                  type="date"
                  value={poFormData.orderDate instanceof Date 
                    ? poFormData.orderDate.toISOString().split('T')[0]
                    : poFormData.orderDate 
                      ? new Date(poFormData.orderDate).toISOString().split('T')[0]
                      : new Date().toISOString().split('T')[0]}
                  onChange={(e) => setPOFormData({ 
                    ...poFormData, 
                    orderDate: new Date(e.target.value) 
                  })}
                  isRequired
                />
                <Input
                  label="Expected Delivery Date"
                  type="date"
                  value={poFormData.expectedDeliveryDate instanceof Date
                    ? poFormData.expectedDeliveryDate.toISOString().split('T')[0]
                    : poFormData.expectedDeliveryDate
                      ? new Date(poFormData.expectedDeliveryDate).toISOString().split('T')[0]
                      : ''}
                  onChange={(e) => setPOFormData({ 
                    ...poFormData, 
                    expectedDeliveryDate: new Date(e.target.value) 
                  })}
                  isRequired
                />
                <Select
                  label="Priority"
                  selectedKeys={poFormData.priority ? [poFormData.priority] : ['medium']}
                  onSelectionChange={(keys) => setPOFormData({ 
                    ...poFormData, 
                    priority: Array.from(keys)[0] as PurchaseOrder['priority'] 
                  })}
                >
                  <SelectItem key="low">Low</SelectItem>
                  <SelectItem key="medium">Medium</SelectItem>
                  <SelectItem key="high">High</SelectItem>
                  <SelectItem key="urgent">Urgent</SelectItem>
                </Select>
                <Select
                  label="Payment Terms"
                  selectedKeys={poFormData.paymentTerms ? [poFormData.paymentTerms] : ['net30']}
                  onSelectionChange={(keys) => setPOFormData({ 
                    ...poFormData, 
                    paymentTerms: Array.from(keys)[0] as string 
                  })}
                >
                  <SelectItem key="immediate">Immediate</SelectItem>
                  <SelectItem key="net30">Net 30</SelectItem>
                  <SelectItem key="net60">Net 60</SelectItem>
                  <SelectItem key="net90">Net 90</SelectItem>
                </Select>
              </div>

              <Divider />

              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold">Items</h4>
                  <Button size="sm" color="primary" onPress={handleAddPOItem}>
                    + Add Item
                  </Button>
                </div>
                {(poFormData.items || []).length > 0 ? (
                  <Table aria-label="PO Items" className="[&_thead]:hidden">
                    <TableHeader>
                      <TableColumn>Item</TableColumn>
                      <TableColumn>Quantity</TableColumn>
                      <TableColumn>Unit Cost</TableColumn>
                      <TableColumn>Total</TableColumn>
                      <TableColumn>Action</TableColumn>
                    </TableHeader>
                    <TableBody>
                      {(poFormData.items || []).map((item, index) => {
                        const filteredItems = getFilteredPOItemsForIndex(index);
                        return (
                          <TableRow key={item.id}>
                            <TableCell className="w-[40%]">
                              <Autocomplete
                                placeholder="🔍 Search item by code or name..."
                                selectedKey={item.itemCode || undefined}
                                defaultSelectedKey={item.itemCode || undefined}
                                onSelectionChange={(key) => {
                                  if (key) {
                                    handlePOItemChange(String(key), index);
                                  } else {
                                    // Clear item when selection is cleared
                                    handleUpdatePOItem(item.id, {
                                      itemId: '',
                                      itemCode: '',
                                      itemName: '',
                                      unitCost: 0,
                                      totalCost: 0
                                    });
                                    setPOItemSearchTerms((prev: Record<number, string>) => {
                                      const updated = { ...prev };
                                      delete updated[index];
                                      return updated;
                                    });
                                  }
                                }}
                                onInputChange={(value) => {
                                  // Always allow search, update search term
                                  setPOItemSearchTerms((prev: Record<number, string>) => ({ ...prev, [index]: value }));
                                }}
                                inputValue={
                                  // If user is actively searching (has search term), show search term
                                  // Otherwise, if item is selected, show the selected item
                                  poItemSearchTerms[index] !== undefined
                                    ? poItemSearchTerms[index]
                                    : item.itemCode
                                      ? `${item.itemCode} - ${item.itemName}`
                                      : ''
                                }
                                size="sm"
                                allowsCustomValue={false}
                                allowsEmptyCollection={false}
                              >
                                <>
                                  {filteredItems.map((stockItem: StockItem) => (
                                    <AutocompleteItem 
                                      key={stockItem.itemCode} 
                                      textValue={`${stockItem.itemCode} ${stockItem.name}`}
                                    >
                                      <div className="flex flex-col">
                                        <span className="font-semibold">{stockItem.itemCode}</span>
                                        <span className="text-sm text-gray-500">{stockItem.name}</span>
                                      </div>
                                    </AutocompleteItem>
                                  ))}
                                </>
                              </Autocomplete>
                            </TableCell>
                            <TableCell className="w-[15%]">
                              <Input
                                type="number"
                                value={String(item.quantity)}
                                onChange={(e) => handleUpdatePOItem(item.id, { 
                                  quantity: parseInt(e.target.value) || 0 
                                })}
                                size="sm"
                                min="1"
                                placeholder="Qty"
                              />
                            </TableCell>
                            <TableCell className="w-[20%]">
                              <Input
                                type="number"
                                value={String(item.unitCost)}
                                onChange={(e) => handleUpdatePOItem(item.id, { 
                                  unitCost: parseFloat(e.target.value) || 0 
                                })}
                                size="sm"
                                startContent="₵"
                                placeholder="Cost"
                              />
                            </TableCell>
                            <TableCell className="text-right font-semibold w-[15%]">
                              ₵{item.totalCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </TableCell>
                            <TableCell className="w-[10%]">
                              <Button 
                                size="sm" 
                                color="danger" 
                                variant="flat"
                                onPress={() => handleRemovePOItem(item.id)}
                              >
                                🗑️
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    No items added. Click "Add Item" to add items to this purchase order.
                  </div>
                )}
              </div>

              <Divider />

              <div className="grid grid-cols-2 gap-4">
                <Select
                  label="Tax Type"
                  selectedKeys={poFormData.taxType ? [poFormData.taxType] : ['none']}
                  onSelectionChange={(keys) => {
                    const selectedTaxType = Array.from(keys)[0] as string;
                    const selectedTaxOption = taxOptions.find(opt => opt.value === selectedTaxType);
                    setPOFormData({ 
                      ...poFormData, 
                      taxType: selectedTaxType,
                      taxRate: selectedTaxOption?.rate || 0
                    });
                  }}
                >
                  <>
                    {taxOptions.map(option => (
                      <SelectItem key={option.value}>{option.label}</SelectItem>
                    ))}
                  </>
                </Select>
                {poFormData.taxType === 'custom' ? (
                  <Input
                    label="Custom Tax Rate (%)"
                    type="number"
                    value={String(poFormData.taxRate || 0)}
                    onChange={(e) => setPOFormData({ 
                      ...poFormData, 
                      taxRate: parseFloat(e.target.value) || 0 
                    })}
                    endContent="%"
                  />
                ) : (
                  <Input
                    label="Shipping Amount"
                    type="number"
                    value={String(poFormData.shippingAmount || 0)}
                    onChange={(e) => setPOFormData({ 
                      ...poFormData, 
                      shippingAmount: parseFloat(e.target.value) || 0 
                    })}
                    startContent="₵"
                  />
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Discount Amount"
                  type="number"
                  value={String(poFormData.discountAmount || 0)}
                  onChange={(e) => setPOFormData({ 
                    ...poFormData, 
                    discountAmount: parseFloat(e.target.value) || 0 
                  })}
                  startContent="₵"
                />
                {poFormData.taxType !== 'custom' && (
                  <Input
                    label="Shipping Amount"
                    type="number"
                    value={String(poFormData.shippingAmount || 0)}
                    onChange={(e) => setPOFormData({ 
                      ...poFormData, 
                      shippingAmount: parseFloat(e.target.value) || 0 
                    })}
                    startContent="₵"
                  />
                )}
              </div>

              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex justify-between mb-2">
                  <span className="font-semibold">Subtotal:</span>
                  <span className="font-semibold">
                    ₵{((poFormData.items || []).reduce((sum, item) => sum + item.totalCost, 0)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                {poFormData.taxType && poFormData.taxType !== 'none' && (
                  <div className="flex justify-between mb-2 text-sm">
                    <span>Tax ({poFormData.taxRate}%):</span>
                    <span>
                      ₵{((poFormData.items || []).reduce((sum, item) => sum + item.totalCost, 0) * (poFormData.taxRate || 0) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                )}
                <div className="flex justify-between mb-2 text-sm">
                  <span>Shipping:</span>
                  <span>
                    ₵{(poFormData.shippingAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between mb-2 text-sm">
                  <span>Discount:</span>
                  <span>
                    -₵{(poFormData.discountAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <Divider className="my-2" />
                <div className="flex justify-between">
                  <span className="text-lg font-bold">Total Amount:</span>
                  <span className="text-lg font-bold">
                    ₵{(
                      (poFormData.items || []).reduce((sum, item) => sum + item.totalCost, 0) +
                      ((poFormData.items || []).reduce((sum, item) => sum + item.totalCost, 0) * (poFormData.taxRate || 0) / 100) +
                      (poFormData.shippingAmount || 0) -
                      (poFormData.discountAmount || 0)
                    ).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              <Textarea
                label="Notes"
                value={poFormData.notes || ''}
                onChange={(e) => setPOFormData({ ...poFormData, notes: e.target.value })}
                placeholder="Additional notes or instructions..."
              />
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="bordered" onPress={onPOModalClose}>Cancel</Button>
            <Button 
              variant="flat" 
              color="secondary" 
              onPress={handleGeneratePOPDF}
              startContent={<span>📄</span>}
            >
              PDF
            </Button>
            <Button color="primary" onPress={handleSavePO}>
              {editingPO ? 'Update' : 'Create'} Purchase Order
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* PO View Modal */}
      <Modal isOpen={isPOViewOpen} onClose={onPOViewClose} size="4xl" scrollBehavior="inside">
        <ModalContent>
          <ModalHeader>
            Purchase Order Details - {viewingPO?.poNumber}
          </ModalHeader>
          <ModalBody>
            {viewingPO && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-gray-500 mb-1">PO Number</div>
                    <div className="font-semibold font-mono">{viewingPO.poNumber}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Status</div>
                    <Badge color={
                      viewingPO.status === 'delivered' ? 'success' :
                      viewingPO.status === 'confirmed' || viewingPO.status === 'in-transit' ? 'warning' :
                      viewingPO.status === 'sent' ? 'primary' :
                      viewingPO.status === 'draft' ? 'default' :
                      viewingPO.status === 'cancelled' ? 'danger' : 'secondary'
                    }>
                      {viewingPO.status.replace('-', ' ')}
                    </Badge>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Supplier</div>
                    <div className="font-semibold">{viewingPO.supplierName}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Priority</div>
                    <Badge color={
                      viewingPO.priority === 'urgent' ? 'danger' :
                      viewingPO.priority === 'high' ? 'warning' :
                      viewingPO.priority === 'medium' ? 'primary' : 'default'
                    } variant="flat">
                      {viewingPO.priority}
                    </Badge>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Order Date</div>
                    <div>
                      {viewingPO.orderDate instanceof Date 
                        ? viewingPO.orderDate.toLocaleDateString()
                        : new Date(viewingPO.orderDate).toLocaleDateString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Expected Delivery</div>
                    <div>
                      {viewingPO.expectedDeliveryDate instanceof Date
                        ? viewingPO.expectedDeliveryDate.toLocaleDateString()
                        : new Date(viewingPO.expectedDeliveryDate).toLocaleDateString()}
                    </div>
                  </div>
                </div>

                <Divider />

                <div>
                  <h4 className="font-semibold mb-2">Items</h4>
                  <Table>
                    <TableHeader>
                      <TableColumn>Item Code</TableColumn>
                      <TableColumn>Item Name</TableColumn>
                      <TableColumn>Quantity</TableColumn>
                      <TableColumn>Unit Cost</TableColumn>
                      <TableColumn className="text-right">Total</TableColumn>
                    </TableHeader>
                    <TableBody>
                      {viewingPO.items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-mono">{item.itemCode}</TableCell>
                          <TableCell>{item.itemName}</TableCell>
                          <TableCell>{item.quantity}</TableCell>
                          <TableCell>₵{item.unitCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                          <TableCell className="text-right font-semibold">
                            ₵{item.totalCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <Divider />

                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="flex justify-between mb-2">
                    <span className="font-semibold">Subtotal:</span>
                    <span className="font-semibold">₵{viewingPO.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between mb-2 text-sm">
                    <span>Tax (15%):</span>
                    <span>₵{viewingPO.taxAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between mb-2 text-sm">
                    <span>Shipping:</span>
                    <span>₵{viewingPO.shippingAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  {viewingPO.discountAmount > 0 && (
                    <div className="flex justify-between mb-2 text-sm">
                      <span>Discount:</span>
                      <span>-₵{viewingPO.discountAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                  )}
                  <Divider className="my-2" />
                  <div className="flex justify-between">
                    <span className="text-lg font-bold">Total Amount:</span>
                    <span className="text-lg font-bold">₵{viewingPO.finalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                </div>

                {viewingPO.notes && (
                  <>
                    <Divider />
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Notes</div>
                      <div className="text-sm">{viewingPO.notes}</div>
                    </div>
                  </>
                )}
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="bordered" onPress={onPOViewClose}>Close</Button>
            {viewingPO && viewingPO.status === 'draft' && (
              <Button color="primary" onPress={() => {
                onPOViewClose();
                handleEditPO(viewingPO);
              }}>
                Edit
              </Button>
            )}
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Requisition Modals */}
      <Modal isOpen={isRequisitionModalOpen} onClose={onRequisitionModalClose} size="5xl" scrollBehavior="inside">
        <ModalContent>
          <ModalHeader>
            {editingRequisition ? 'Edit Requisition' : 'Create Requisition'}
          </ModalHeader>
          <ModalBody>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Requisition Number"
                  value={requisitionFormData.requisitionNumber || ''}
                  isDisabled
                  description="Auto-generated"
                />
                <Input
                  label="Requested By"
                  value={requisitionFormData.requestedBy || ''}
                  onChange={(e) => setRequisitionFormData({ ...requisitionFormData, requestedBy: e.target.value })}
                  isRequired
                />
                <Input
                  label="Requested Date"
                  type="date"
                  value={requisitionFormData.requestedDate instanceof Date
                    ? requisitionFormData.requestedDate.toISOString().split('T')[0]
                    : requisitionFormData.requestedDate
                      ? new Date(requisitionFormData.requestedDate).toISOString().split('T')[0]
                      : new Date().toISOString().split('T')[0]}
                  onChange={(e) => setRequisitionFormData({ 
                    ...requisitionFormData, 
                    requestedDate: new Date(e.target.value) 
                  })}
                  isRequired
                />
              </div>

              <Divider />

              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold">Requested Items</h4>
                  <Button size="sm" color="primary" onPress={handleAddRequisitionItem}>
                    + Add Item
                  </Button>
                </div>
                {(requisitionFormData.requestedItems || []).length > 0 ? (
                  <Table aria-label="Requested items" className="[&_thead]:hidden">
                    <TableHeader>
                      <TableColumn>Item</TableColumn>
                      <TableColumn>Quantity</TableColumn>
                      <TableColumn>Price</TableColumn>
                      <TableColumn>Total</TableColumn>
                      <TableColumn>Action</TableColumn>
                    </TableHeader>
                    <TableBody>
                      {(requisitionFormData.requestedItems || []).map((item, index) => {
                        const filteredItems = getFilteredItemsForIndex(index);
                        return (
                          <TableRow key={item.id}>
                            <TableCell className="w-[40%]">
                              <Autocomplete
                                placeholder="🔍 Search item by code or name..."
                                selectedKey={item.itemCode || undefined}
                                defaultSelectedKey={item.itemCode || undefined}
                                onSelectionChange={(key) => {
                                  if (key) {
                                    handleRequisitionItemChange(String(key), index);
                                  } else {
                                    // Clear item when selection is cleared
                                    handleUpdateRequisitionItem(item.id, {
                                      itemId: '',
                                      itemCode: '',
                                      itemName: '',
                                      estimatedPrice: 0,
                                      totalCost: 0
                                    });
                                    setItemSearchTerms((prev: Record<number, string>) => {
                                      const updated = { ...prev };
                                      delete updated[index];
                                      return updated;
                                    });
                                  }
                                }}
                                onInputChange={(value) => {
                                  // Always allow search, update search term
                                  setItemSearchTerms((prev: Record<number, string>) => ({ ...prev, [index]: value }));
                                }}
                                inputValue={
                                  // If user is actively searching (has search term), show search term
                                  // Otherwise, if item is selected, show the selected item
                                  itemSearchTerms[index] !== undefined
                                    ? itemSearchTerms[index]
                                    : item.itemCode
                                      ? `${item.itemCode} - ${item.itemName}`
                                      : ''
                                }
                                size="sm"
                                allowsCustomValue={false}
                                allowsEmptyCollection={false}
                              >
                                <>
                                  {filteredItems.map((stockItem: StockItem) => (
                                    <AutocompleteItem 
                                      key={stockItem.itemCode} 
                                      textValue={`${stockItem.itemCode} ${stockItem.name}`}
                                    >
                                      <div className="flex flex-col">
                                        <span className="font-semibold">{stockItem.itemCode}</span>
                                        <span className="text-sm text-gray-500">{stockItem.name}</span>
                                      </div>
                                    </AutocompleteItem>
                                  ))}
                                </>
                              </Autocomplete>
                            </TableCell>
                            <TableCell className="w-[15%]">
                              <Input
                                type="number"
                                value={String(item.quantity)}
                                onChange={(e) => handleUpdateRequisitionItem(item.id, { 
                                  quantity: parseInt(e.target.value) || 0 
                                })}
                                size="sm"
                                min="1"
                                placeholder="Qty"
                              />
                            </TableCell>
                            <TableCell className="w-[20%]">
                              <Input
                                type="number"
                                value={String(item.estimatedPrice)}
                                onChange={(e) => handleUpdateRequisitionItem(item.id, { 
                                  estimatedPrice: parseFloat(e.target.value) || 0 
                                })}
                                size="sm"
                                startContent="₵"
                                placeholder="Price"
                              />
                            </TableCell>
                            <TableCell className="text-right font-semibold w-[15%]">
                              ₵{item.totalCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </TableCell>
                            <TableCell className="w-[10%]">
                              <Button 
                                size="sm" 
                                color="danger" 
                                variant="flat"
                                onPress={() => handleRemoveRequisitionItem(item.id)}
                              >
                                🗑️
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    No items added. Click "Add Item" to add items to this requisition.
                  </div>
                )}
              </div>

              <Divider />

              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex justify-between">
                  <span className="text-lg font-bold">Total Amount:</span>
                  <span className="text-lg font-bold">
                    ₵{((requisitionFormData.requestedItems || []).reduce((sum, item) => sum + item.totalCost, 0)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              <Textarea
                label="Notes"
                value={requisitionFormData.notes || ''}
                onChange={(e) => setRequisitionFormData({ ...requisitionFormData, notes: e.target.value })}
                placeholder="Additional notes or justification..."
              />
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="bordered" onPress={onRequisitionModalClose}>Cancel</Button>
            <Button color="primary" onPress={handleSaveRequisition}>
              {editingRequisition ? 'Update' : 'Create'} Requisition
            </Button>
            <Button 
              variant="flat" 
              color="secondary" 
              onPress={handleGenerateRequisitionPDF}
              startContent={<span>📄</span>}
            >
              PDF
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Requisition View Modal */}
      <Modal isOpen={isRequisitionViewOpen} onClose={onRequisitionViewClose} size="4xl" scrollBehavior="inside">
        <ModalContent>
          <ModalHeader>
            Requisition Details - {viewingRequisition?.requisitionNumber}
          </ModalHeader>
          <ModalBody>
            {viewingRequisition && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Requisition Number</div>
                    <div className="font-semibold font-mono">{viewingRequisition.requisitionNumber}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Status</div>
                    <Badge color={
                      viewingRequisition.status === 'approved' ? 'success' :
                      viewingRequisition.status === 'rejected' || viewingRequisition.status === 'cancelled' ? 'danger' :
                      viewingRequisition.status === 'converted-to-po' ? 'primary' :
                      'warning'
                    }>
                      {viewingRequisition.status.replace('-', ' ')}
                    </Badge>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Requested By</div>
                    <div className="font-semibold">{viewingRequisition.requestedBy}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Requested Date</div>
                    <div>
                      {viewingRequisition.requestedDate instanceof Date 
                        ? viewingRequisition.requestedDate.toLocaleDateString()
                        : new Date(viewingRequisition.requestedDate).toLocaleDateString()}
                    </div>
                  </div>
                  {viewingRequisition.approvedBy && (
                    <>
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Approved By</div>
                        <div className="font-semibold">{viewingRequisition.approvedBy}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Approved At</div>
                        <div>
                          {viewingRequisition.approvedAt 
                            ? (viewingRequisition.approvedAt instanceof Date 
                                ? viewingRequisition.approvedAt.toLocaleDateString()
                                : new Date(viewingRequisition.approvedAt).toLocaleDateString())
                            : 'N/A'}
                        </div>
                      </div>
                    </>
                  )}
                  {viewingRequisition.rejectedBy && (
                    <>
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Rejected By</div>
                        <div className="font-semibold">{viewingRequisition.rejectedBy}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Rejection Reason</div>
                        <div className="text-sm">{viewingRequisition.rejectionReason || 'No reason provided'}</div>
                      </div>
                    </>
                  )}
                  {viewingRequisition.convertedToPONumber && (
                    <div className="col-span-2">
                      <div className="text-xs text-gray-500 mb-1">Converted to PO</div>
                      <div className="font-semibold font-mono">{viewingRequisition.convertedToPONumber}</div>
                    </div>
                  )}
                </div>

                <Divider />

                <div>
                  <h4 className="font-semibold mb-2">Requested Items</h4>
                  <Table>
                    <TableHeader>
                      <TableColumn>Item Code</TableColumn>
                      <TableColumn>Item Name</TableColumn>
                      <TableColumn>Quantity</TableColumn>
                      <TableColumn>Estimated Price</TableColumn>
                      <TableColumn className="text-right">Total</TableColumn>
                    </TableHeader>
                    <TableBody>
                      {viewingRequisition.requestedItems.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-mono">{item.itemCode}</TableCell>
                          <TableCell>{item.itemName}</TableCell>
                          <TableCell>{item.quantity}</TableCell>
                          <TableCell>₵{item.estimatedPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                          <TableCell className="text-right font-semibold">
                            ₵{item.totalCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <Divider />

                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="flex justify-between">
                    <span className="text-lg font-bold">Total Amount:</span>
                    <span className="text-lg font-bold">
                      ₵{viewingRequisition.requestedItems.reduce((sum, item) => sum + item.totalCost, 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                {viewingRequisition.notes && (
                  <>
                    <Divider />
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Notes</div>
                      <div className="text-sm">{viewingRequisition.notes}</div>
                    </div>
                  </>
                )}
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="bordered" onPress={onRequisitionViewClose}>Close</Button>
            {viewingRequisition && viewingRequisition.status === 'pending' && (
              <Button color="primary" onPress={() => {
                onRequisitionViewClose();
                handleEditRequisition(viewingRequisition);
              }}>
                Edit
              </Button>
            )}
            {viewingRequisition && viewingRequisition.status === 'pending' && (
              <>
                <Button 
                  color="success" 
                  onPress={() => {
                    if (confirm('Approve this requisition?')) {
                      approveRequisition(viewingRequisition.id, 'Director/GM');
                      onRequisitionViewClose();
                      trackEvent('Stores.Issued', { action: 'approve_requisition', requisitionNumber: viewingRequisition.requisitionNumber });
                    }
                  }}
                >
                  Approve
                </Button>
                <Button 
                  color="danger" 
                  variant="flat"
                  onPress={() => {
                    const reason = prompt('Enter rejection reason (optional):');
                    rejectRequisition(viewingRequisition.id, 'Director/GM', reason || undefined);
                    onRequisitionViewClose();
                    trackEvent('Stores.Issued', { action: 'reject_requisition', requisitionNumber: viewingRequisition.requisitionNumber });
                  }}
                >
                  Reject
                </Button>
              </>
            )}
            {viewingRequisition && viewingRequisition.status === 'approved' && (
              <Button 
                color="primary" 
                onPress={() => {
                  const supplier = mergedSuppliers.find(s => s.isActive);
                  if (!supplier) {
                    alert('Please add a supplier first before converting to PO');
                    return;
                  }
                  if (confirm(`Convert this requisition to a Purchase Order with ${supplier.name}?`)) {
                    const newPO = convertRequisitionToPO(viewingRequisition.id, supplier.id);
                    if (newPO) {
                      alert(`Requisition converted to PO: ${newPO.poNumber}`);
                      onRequisitionViewClose();
                      setSelectedTab('purchase-orders');
                      trackEvent('Stores.Issued', { action: 'convert_requisition_to_po', requisitionNumber: viewingRequisition.requisitionNumber, poNumber: newPO.poNumber });
                    }
                  }
                }}
              >
                Convert to PO
              </Button>
            )}
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Stock Operations Modals */}
      {/* Goods Receipt Modal */}
      <Modal isOpen={isGoodsReceiptOpen} onClose={onGoodsReceiptClose} size="4xl" scrollBehavior="inside">
        <ModalContent>
          <ModalHeader>
            <div>
              <div className="text-xl font-semibold">Receive Goods</div>
              <div className="text-sm text-gray-500 font-mono">{selectedPOForReceipt?.poNumber}</div>
            </div>
          </ModalHeader>
          <ModalBody>
            {selectedPOForReceipt && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Supplier</div>
                    <div className="font-semibold">{selectedPOForReceipt.supplierName}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Order Date</div>
                    <div>{selectedPOForReceipt.orderDate instanceof Date ? selectedPOForReceipt.orderDate.toLocaleDateString() : new Date(selectedPOForReceipt.orderDate).toLocaleDateString()}</div>
                  </div>
                </div>

                <Divider />

                <div>
                  <h4 className="font-semibold mb-2">Items to Receive</h4>
                  <Table className="[&_thead]:hidden">
                    <TableHeader>
                      <TableColumn>Item</TableColumn>
                      <TableColumn>Ordered</TableColumn>
                      <TableColumn>Received</TableColumn>
                      <TableColumn>Receive Now</TableColumn>
                      <TableColumn>Batch/Expiry</TableColumn>
                    </TableHeader>
                    <TableBody>
                      {receiptItems.map((item, index) => {
                        const remainingQty = item.orderedQty - item.receivedQty;
                        return (
                          <TableRow key={item.itemId}>
                            <TableCell className="w-[30%]">
                              <div>
                                <div className="font-semibold">{item.itemCode}</div>
                                <div className="text-sm text-gray-500">{item.itemName}</div>
                              </div>
                            </TableCell>
                            <TableCell className="w-[15%]">
                              <div className="text-sm">{item.orderedQty}</div>
                              <div className="text-xs text-gray-500">₵{item.unitCost.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
                            </TableCell>
                            <TableCell className="w-[15%]">
                              <div className="text-sm text-gray-500">Already: {item.receivedQty}</div>
                              <div className="text-xs text-gray-400">Remaining: {remainingQty}</div>
                            </TableCell>
                            <TableCell className="w-[20%]">
                              <Input
                                type="number"
                                value={String(item.receivedQty || '')}
                                onChange={(e) => {
                                  const newQty = parseInt(e.target.value) || 0;
                                  const updatedItems = [...receiptItems];
                                  updatedItems[index] = { ...item, receivedQty: Math.min(newQty, item.orderedQty) };
                                  setReceiptItems(updatedItems);
                                }}
                                min={0}
                                max={item.orderedQty}
                                size="sm"
                              />
                            </TableCell>
                            <TableCell className="w-[20%]">
                              <Input
                                placeholder="Batch #"
                                value={item.batchNumber || ''}
                                onChange={(e) => {
                                  const updatedItems = [...receiptItems];
                                  updatedItems[index] = { ...item, batchNumber: e.target.value };
                                  setReceiptItems(updatedItems);
                                }}
                                size="sm"
                                className="mb-2"
                              />
                              <Input
                                type="date"
                                placeholder="Expiry Date"
                                value={item.expiryDate ? (item.expiryDate instanceof Date ? item.expiryDate.toISOString().split('T')[0] : new Date(item.expiryDate).toISOString().split('T')[0]) : ''}
                                onChange={(e) => {
                                  const updatedItems = [...receiptItems];
                                  updatedItems[index] = { ...item, expiryDate: e.target.value ? new Date(e.target.value) : undefined };
                                  setReceiptItems(updatedItems);
                                }}
                                size="sm"
                              />
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="bordered" onPress={onGoodsReceiptClose}>Cancel</Button>
            <Button color="primary" onPress={handleReceiveGoods}>
              Receive Goods
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Goods Issue Modal */}
      <Modal isOpen={isGoodsIssueOpen} onClose={onGoodsIssueClose} size="4xl" scrollBehavior="inside">
        <ModalContent>
          <ModalHeader>
            <div className="text-xl font-semibold">Issue Goods</div>
          </ModalHeader>
          <ModalBody>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Select
                  label="Department"
                  selectedKeys={issueFormData.department ? [issueFormData.department] : []}
                  onSelectionChange={(keys) => setIssueFormData({ ...issueFormData, department: Array.from(keys)[0] as string })}
                  isRequired
                >
                  <>
                    {departments.map(dept => (
                      <SelectItem key={dept}>{dept}</SelectItem>
                    ))}
                  </>
                </Select>
                <Input
                  label="Issued To"
                  value={issueFormData.issuedTo}
                  onChange={(e) => setIssueFormData({ ...issueFormData, issuedTo: e.target.value })}
                  placeholder="Person name or ID"
                  isRequired
                />
              </div>

              <Divider />

              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold">Items</h4>
                  <Button size="sm" color="primary" onPress={handleAddIssueItem}>
                    + Add Item
                  </Button>
                </div>
                {issueFormData.items.length > 0 ? (
                  <Table className="[&_thead]:hidden">
                    <TableHeader>
                      <TableColumn>Item</TableColumn>
                      <TableColumn>Quantity</TableColumn>
                      <TableColumn>Reason</TableColumn>
                      <TableColumn>Action</TableColumn>
                    </TableHeader>
                    <TableBody>
                      {issueFormData.items.map((item, index) => {
                        return (
                          <TableRow key={index}>
                            <TableCell className="w-[40%]">
                              <Autocomplete
                                placeholder="🔍 Search item..."
                                selectedKey={item.itemCode || undefined}
                                onSelectionChange={(key) => {
                                  if (key) {
                                    const selectedItem = stockItems.find(i => i.itemCode === String(key));
                                    if (selectedItem) {
                                      const updatedItems = [...issueFormData.items];
                                      updatedItems[index] = {
                                        itemId: selectedItem.id,
                                        itemCode: selectedItem.itemCode,
                                        itemName: selectedItem.name,
                                        quantity: item.quantity,
                                        unitCost: selectedItem.unitCost,
                                        reason: item.reason
                                      };
                                      setIssueFormData({ ...issueFormData, items: updatedItems });
                                    }
                                  }
                                }}
                                inputValue={item.itemCode ? `${item.itemCode} - ${item.itemName}` : ''}
                                size="sm"
                                allowsCustomValue={false}
                              >
                                <>
                                  {stockItems.slice(0, 20).map((stockItem: StockItem) => (
                                    <AutocompleteItem key={stockItem.itemCode} textValue={`${stockItem.itemCode} ${stockItem.name}`}>
                                      <div className="flex flex-col">
                                        <span className="font-semibold">{stockItem.itemCode}</span>
                                        <span className="text-sm text-gray-500">Available: {stockItem.currentStock} {stockItem.unit}</span>
                                      </div>
                                    </AutocompleteItem>
                                  ))}
                                </>
                              </Autocomplete>
                            </TableCell>
                            <TableCell className="w-[20%]">
                              <Input
                                type="number"
                                value={String(item.quantity)}
                                onChange={(e) => {
                                  const updatedItems = [...issueFormData.items];
                                  updatedItems[index] = { ...item, quantity: parseInt(e.target.value) || 0 };
                                  setIssueFormData({ ...issueFormData, items: updatedItems });
                                }}
                                size="sm"
                                min="1"
                                placeholder="Qty"
                              />
                            </TableCell>
                            <TableCell className="w-[30%]">
                              <Input
                                value={item.reason || ''}
                                onChange={(e) => {
                                  const updatedItems = [...issueFormData.items];
                                  updatedItems[index] = { ...item, reason: e.target.value };
                                  setIssueFormData({ ...issueFormData, items: updatedItems });
                                }}
                                size="sm"
                                placeholder="Reason/purpose"
                              />
                            </TableCell>
                            <TableCell className="w-[10%]">
                              <Button
                                size="sm"
                                color="danger"
                                variant="flat"
                                onPress={() => {
                                  const updatedItems = issueFormData.items.filter((_, i) => i !== index);
                                  setIssueFormData({ ...issueFormData, items: updatedItems });
                                }}
                              >
                                🗑️
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    No items added. Click "Add Item" to add items to issue.
                  </div>
                )}
              </div>

              <Textarea
                label="Notes"
                value={issueFormData.notes || ''}
                onChange={(e) => setIssueFormData({ ...issueFormData, notes: e.target.value })}
                placeholder="Additional notes..."
              />
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="bordered" onPress={onGoodsIssueClose}>Cancel</Button>
            <Button color="primary" onPress={handleIssueGoods}>
              Issue Goods
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Stock Transfer Modal */}
      <Modal isOpen={isStockTransferOpen} onClose={onStockTransferClose} size="4xl" scrollBehavior="inside">
        <ModalContent>
          <ModalHeader>
            <div className="text-xl font-semibold">
              {editingStockTransfer ? 'Edit' : 'Create'} Stock Transfer
            </div>
          </ModalHeader>
          <ModalBody>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Select
                  label="From Location"
                  selectedKeys={stockTransferFormData.fromLocation ? [stockTransferFormData.fromLocation] : []}
                  onSelectionChange={(keys) => setStockTransferFormData({ 
                    ...stockTransferFormData, 
                    fromLocation: Array.from(keys)[0] as string 
                  })}
                  isRequired
                >
                  <>
                    {availableLocations.map(loc => (
                      <SelectItem key={loc}>{loc}</SelectItem>
                    ))}
                  </>
                </Select>
                <Select
                  label="To Location"
                  selectedKeys={stockTransferFormData.toLocation ? [stockTransferFormData.toLocation] : []}
                  onSelectionChange={(keys) => setStockTransferFormData({ 
                    ...stockTransferFormData, 
                    toLocation: Array.from(keys)[0] as string 
                  })}
                  isRequired
                >
                  <>
                    {availableLocations.map(loc => (
                      <SelectItem key={loc}>{loc}</SelectItem>
                    ))}
                  </>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Transfer Date"
                  type="date"
                  value={stockTransferFormData.transferDate instanceof Date 
                    ? stockTransferFormData.transferDate.toISOString().split('T')[0]
                    : stockTransferFormData.transferDate 
                      ? new Date(stockTransferFormData.transferDate).toISOString().split('T')[0]
                      : new Date().toISOString().split('T')[0]}
                  onChange={(e) => setStockTransferFormData({ 
                    ...stockTransferFormData, 
                    transferDate: new Date(e.target.value) 
                  })}
                />
                <Input
                  label="Expected Delivery Date"
                  type="date"
                  value={stockTransferFormData.expectedDeliveryDate instanceof Date 
                    ? stockTransferFormData.expectedDeliveryDate.toISOString().split('T')[0]
                    : stockTransferFormData.expectedDeliveryDate 
                      ? new Date(stockTransferFormData.expectedDeliveryDate).toISOString().split('T')[0]
                      : new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
                  onChange={(e) => setStockTransferFormData({ 
                    ...stockTransferFormData, 
                    expectedDeliveryDate: new Date(e.target.value) 
                  })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Select
                  label="Priority"
                  selectedKeys={stockTransferFormData.priority ? [stockTransferFormData.priority] : ['medium']}
                  onSelectionChange={(keys) => setStockTransferFormData({ 
                    ...stockTransferFormData, 
                    priority: Array.from(keys)[0] as 'low' | 'medium' | 'high' | 'urgent'
                  })}
                >
                  <SelectItem key="low">Low</SelectItem>
                  <SelectItem key="medium">Medium</SelectItem>
                  <SelectItem key="high">High</SelectItem>
                  <SelectItem key="urgent">Urgent</SelectItem>
                </Select>
                <Select
                  label="Status"
                  selectedKeys={stockTransferFormData.status ? [stockTransferFormData.status] : ['pending']}
                  onSelectionChange={(keys) => setStockTransferFormData({ 
                    ...stockTransferFormData, 
                    status: Array.from(keys)[0] as 'pending' | 'in-transit' | 'delivered' | 'cancelled'
                  })}
                >
                  <SelectItem key="pending">Pending</SelectItem>
                  <SelectItem key="in-transit">In Transit</SelectItem>
                  <SelectItem key="delivered">Delivered</SelectItem>
                  <SelectItem key="cancelled">Cancelled</SelectItem>
                </Select>
              </div>

              <Divider />

              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold">Transfer Items</h4>
                  <Button size="sm" color="primary" onPress={() => {
                    const newItem: StockTransferItem = {
                      id: Date.now().toString(),
                      itemId: '',
                      itemCode: '',
                      itemName: '',
                      quantity: 0,
                      unitCost: 0,
                      totalValue: 0,
                      transferredQuantity: 0
                    };
                    setStockTransferFormData({
                      ...stockTransferFormData,
                      items: [...(stockTransferFormData.items || []), newItem]
                    });
                  }}>
                    + Add Item
                  </Button>
                </div>
                {stockTransferFormData.items && stockTransferFormData.items.length > 0 ? (
                  <Table className="[&_thead]:hidden">
                    <TableHeader>
                      <TableColumn>Item</TableColumn>
                      <TableColumn>Quantity</TableColumn>
                      <TableColumn>Unit Cost</TableColumn>
                      <TableColumn>Total</TableColumn>
                      <TableColumn>Action</TableColumn>
                    </TableHeader>
                    <TableBody>
                      {stockTransferFormData.items.map((item, index) => (
                        <TableRow key={item.id}>
                          <TableCell className="w-[40%]">
                            <Autocomplete
                              placeholder="🔍 Search item..."
                              selectedKey={item.itemCode || undefined}
                              onSelectionChange={(key) => {
                                if (key && stockTransferFormData.fromLocation) {
                                  const selectedItem = stockItems.find(i => 
                                    i.itemCode === String(key) && i.location === stockTransferFormData.fromLocation
                                  );
                                  if (selectedItem) {
                                    const updatedItems = [...(stockTransferFormData.items || [])];
                                    updatedItems[index] = {
                                      ...item,
                                      itemId: selectedItem.id,
                                      itemCode: selectedItem.itemCode,
                                      itemName: selectedItem.name,
                                      unitCost: selectedItem.unitCost
                                    };
                                    updatedItems[index].totalValue = updatedItems[index].quantity * updatedItems[index].unitCost;
                                    setStockTransferFormData({ ...stockTransferFormData, items: updatedItems });
                                  }
                                }
                              }}
                              inputValue={item.itemCode ? `${item.itemCode} - ${item.itemName}` : ''}
                              size="sm"
                              allowsCustomValue={false}
                            >
                              <>
                                {stockItems
                                  .filter(i => stockTransferFormData.fromLocation ? i.location === stockTransferFormData.fromLocation : true)
                                  .slice(0, 20)
                                  .map((stockItem: StockItem) => (
                                    <AutocompleteItem key={stockItem.itemCode} textValue={`${stockItem.itemCode} ${stockItem.name}`}>
                                      <div className="flex flex-col">
                                        <span className="font-semibold">{stockItem.itemCode}</span>
                                        <span className="text-sm text-gray-500">Available: {stockItem.currentStock} {stockItem.unit}</span>
                                      </div>
                                    </AutocompleteItem>
                                  ))}
                              </>
                            </Autocomplete>
                          </TableCell>
                          <TableCell className="w-[20%]">
                            <Input
                              type="number"
                              value={String(item.quantity)}
                              onChange={(e) => {
                                const updatedItems = [...(stockTransferFormData.items || [])];
                                updatedItems[index] = {
                                  ...item,
                                  quantity: parseInt(e.target.value) || 0
                                };
                                updatedItems[index].totalValue = updatedItems[index].quantity * updatedItems[index].unitCost;
                                setStockTransferFormData({ ...stockTransferFormData, items: updatedItems });
                              }}
                              size="sm"
                              min="1"
                              placeholder="Qty"
                            />
                          </TableCell>
                          <TableCell className="w-[20%]">
                            <Input
                              type="number"
                              value={String(item.unitCost)}
                              readOnly
                              size="sm"
                              startContent="₵"
                            />
                          </TableCell>
                          <TableCell className="w-[15%]">
                            <div className="text-right font-semibold">
                              ₵{item.totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                          </TableCell>
                          <TableCell className="w-[5%]">
                            <Button
                              size="sm"
                              color="danger"
                              variant="flat"
                              onPress={() => {
                                const updatedItems = (stockTransferFormData.items || []).filter((_, i) => i !== index);
                                setStockTransferFormData({ ...stockTransferFormData, items: updatedItems });
                              }}
                            >
                              🗑️
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    No items added. Click "Add Item" to add items to transfer.
                  </div>
                )}
              </div>

              <Textarea
                label="Notes"
                value={stockTransferFormData.notes || ''}
                onChange={(e) => setStockTransferFormData({ ...stockTransferFormData, notes: e.target.value })}
                placeholder="Additional notes..."
              />
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="bordered" onPress={onStockTransferClose}>Cancel</Button>
            <Button color="primary" onPress={handleSaveStockTransfer}>
              {editingStockTransfer ? 'Update' : 'Create'} Transfer
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Stock Count Modal */}
      <Modal isOpen={isStockCountOpen} onClose={onStockCountClose} size="4xl" scrollBehavior="inside">
        <ModalContent>
          <ModalHeader>
            <div className="text-xl font-semibold">
              {editingStockCount ? 'Edit' : 'Create'} Stock Count
            </div>
          </ModalHeader>
          <ModalBody>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Select
                  label="Count Type"
                  selectedKeys={stockCountFormData.countType ? [stockCountFormData.countType] : ['full']}
                  onSelectionChange={(keys) => setStockCountFormData({ 
                    ...stockCountFormData, 
                    countType: Array.from(keys)[0] as 'full' | 'cycle' | 'spot' | 'random'
                  })}
                >
                  <SelectItem key="full">Full Count</SelectItem>
                  <SelectItem key="cycle">Cycle Count</SelectItem>
                  <SelectItem key="spot">Spot Count</SelectItem>
                  <SelectItem key="random">Random Count</SelectItem>
                </Select>
                <Select
                  label="Location"
                  selectedKeys={stockCountFormData.location ? [stockCountFormData.location] : []}
                  onSelectionChange={(keys) => {
                    const selectedLocation = Array.from(keys)[0] as string;
                    setStockCountFormData({ 
                      ...stockCountFormData, 
                      location: selectedLocation,
                      items: stockItems
                        .filter(i => i.location === selectedLocation)
                        .map(item => ({
                          id: Date.now().toString() + Math.random(),
                          itemId: item.id,
                          itemCode: item.itemCode,
                          itemName: item.name,
                          expectedQuantity: item.currentStock,
                          countedQuantity: item.currentStock,
                          variance: 0,
                          unitCost: item.unitCost,
                          varianceValue: 0
                        }))
                    });
                  }}
                  isRequired
                >
                  <>
                    {availableLocations.map(loc => (
                      <SelectItem key={loc}>{loc}</SelectItem>
                    ))}
                  </>
                </Select>
              </div>

              <Input
                label="Start Date"
                type="date"
                value={stockCountFormData.startDate instanceof Date 
                  ? stockCountFormData.startDate.toISOString().split('T')[0]
                  : stockCountFormData.startDate 
                    ? new Date(stockCountFormData.startDate).toISOString().split('T')[0]
                    : new Date().toISOString().split('T')[0]}
                onChange={(e) => setStockCountFormData({ 
                  ...stockCountFormData, 
                  startDate: new Date(e.target.value) 
                })}
              />

              {stockCountFormData.items && stockCountFormData.items.length > 0 && (
                <>
                  <Divider />
                  <div>
                    <h4 className="font-semibold mb-2">Count Items</h4>
                    <Table className="[&_thead]:hidden">
                      <TableHeader>
                        <TableColumn>Item</TableColumn>
                        <TableColumn>Expected</TableColumn>
                        <TableColumn>Counted</TableColumn>
                        <TableColumn>Variance</TableColumn>
                        <TableColumn>Variance Value</TableColumn>
                      </TableHeader>
                      <TableBody>
                        {stockCountFormData.items.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="w-[30%]">
                              <div>
                                <div className="font-semibold">{item.itemCode}</div>
                                <div className="text-sm text-gray-500">{item.itemName}</div>
                              </div>
                            </TableCell>
                            <TableCell className="w-[20%]">
                              <div className="font-semibold">{item.expectedQuantity}</div>
                            </TableCell>
                            <TableCell className="w-[20%]">
                              <Input
                                type="number"
                                value={String(item.countedQuantity)}
                                onChange={(e) => {
                                  const counted = parseInt(e.target.value) || 0;
                                  const variance = counted - item.expectedQuantity;
                                  const updatedItems = (stockCountFormData.items || []).map(i =>
                                    i.id === item.id
                                      ? {
                                          ...i,
                                          countedQuantity: counted,
                                          variance: variance,
                                          varianceValue: Math.abs(variance * i.unitCost)
                                        }
                                      : i
                                  );
                                  setStockCountFormData({ ...stockCountFormData, items: updatedItems });
                                }}
                                size="sm"
                                min="0"
                              />
                            </TableCell>
                            <TableCell className="w-[15%]">
                              <div className={`font-semibold ${item.variance > 0 ? 'text-green-600' : item.variance < 0 ? 'text-red-600' : 'text-gray-600'}`}>
                                {item.variance > 0 ? '+' : ''}{item.variance}
                              </div>
                            </TableCell>
                            <TableCell className="w-[15%]">
                              <div className={`text-right font-semibold ${item.varianceValue > 0 ? 'text-orange-600' : 'text-gray-600'}`}>
                                {item.varianceValue > 0 ? '₵' : ''}{item.varianceValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}

              <Textarea
                label="Notes"
                value={stockCountFormData.notes || ''}
                onChange={(e) => setStockCountFormData({ ...stockCountFormData, notes: e.target.value })}
                placeholder="Additional notes..."
              />
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="bordered" onPress={onStockCountClose}>Cancel</Button>
            <Button color="primary" onPress={() => {
              if (!stockCountFormData.location || !stockCountFormData.items || stockCountFormData.items.length === 0) {
                alert('Please select a location and ensure items are loaded');
                return;
              }
              const countData: StockCount = {
                id: editingStockCount?.id || Date.now().toString(),
                countNumber: stockCountFormData.countNumber || generateCountNumber(),
                countType: stockCountFormData.countType || 'full',
                location: stockCountFormData.location,
                startDate: stockCountFormData.startDate || new Date(),
                status: 'in-progress',
                totalItems: stockCountFormData.items.length,
                countedItems: stockCountFormData.items.filter(i => i.countedQuantity >= 0).length,
                varianceItems: stockCountFormData.items.filter(i => i.variance !== 0).length,
                totalValue: stockCountFormData.items.reduce((sum, i) => sum + (i.expectedQuantity * i.unitCost), 0),
                varianceValue: stockCountFormData.items.reduce((sum, i) => sum + Math.abs(i.varianceValue), 0),
                items: stockCountFormData.items,
                notes: stockCountFormData.notes,
                createdBy: stockCountFormData.createdBy || 'Current User',
                createdAt: editingStockCount?.createdAt || new Date(),
                updatedAt: new Date()
              };
              if (editingStockCount) {
                setStockCounts(stockCounts.map(c => c.id === countData.id ? countData : c));
              } else {
                setStockCounts([...stockCounts, countData]);
              }
              onStockCountClose();
              trackEvent('Stores.Issued', { action: editingStockCount ? 'update_stock_count' : 'create_stock_count', countNumber: countData.countNumber });
            }}>
              {editingStockCount ? 'Update' : 'Create'} Count
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Stock Transfer View Modal */}
      <Modal isOpen={isStockTransferViewOpen} onClose={onStockTransferViewClose} size="4xl" scrollBehavior="inside">
        <ModalContent>
          <ModalHeader>
            <div>
              <div className="text-xl font-semibold">Stock Transfer Details</div>
              <div className="text-sm text-gray-500 font-mono">{viewingStockTransfer?.transferNumber}</div>
            </div>
          </ModalHeader>
          <ModalBody>
            {viewingStockTransfer && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-gray-500 mb-1">From Location</div>
                    <div className="font-semibold">{viewingStockTransfer.fromLocation}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 mb-1">To Location</div>
                    <div className="font-semibold">{viewingStockTransfer.toLocation}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Transfer Date</div>
                    <div>{viewingStockTransfer.transferDate instanceof Date ? viewingStockTransfer.transferDate.toLocaleDateString() : new Date(viewingStockTransfer.transferDate).toLocaleDateString()}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Status</div>
                    <Badge color={viewingStockTransfer.status === 'delivered' ? 'success' : viewingStockTransfer.status === 'in-transit' ? 'warning' : 'default'} variant="flat">
                      {viewingStockTransfer.status}
                    </Badge>
                  </div>
                </div>

                <Divider />

                <div>
                  <h4 className="font-semibold mb-2">Transfer Items</h4>
                  <Table>
                    <TableHeader>
                      <TableColumn>Item Code</TableColumn>
                      <TableColumn>Item Name</TableColumn>
                      <TableColumn>Quantity</TableColumn>
                      <TableColumn>Unit Cost</TableColumn>
                      <TableColumn className="text-right">Total Value</TableColumn>
                    </TableHeader>
                    <TableBody>
                      {viewingStockTransfer.items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-mono">{item.itemCode}</TableCell>
                          <TableCell>{item.itemName}</TableCell>
                          <TableCell>{item.quantity}</TableCell>
                          <TableCell>₵{item.unitCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                          <TableCell className="text-right font-semibold">
                            ₵{item.totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <Divider />

                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="flex justify-between">
                    <span className="font-semibold">Total Value:</span>
                    <span className="font-semibold">
                      ₵{viewingStockTransfer.totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="bordered" onPress={onStockTransferViewClose}>Close</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Stock Count View Modal */}
      <Modal isOpen={isStockCountViewOpen} onClose={onStockCountViewClose} size="4xl" scrollBehavior="inside">
        <ModalContent>
          <ModalHeader>
            <div>
              <div className="text-xl font-semibold">Stock Count Details</div>
              <div className="text-sm text-gray-500 font-mono">{viewingStockCount?.countNumber}</div>
            </div>
          </ModalHeader>
          <ModalBody>
            {viewingStockCount && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Count Type</div>
                    <Chip size="sm" variant="flat">{viewingStockCount.countType}</Chip>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Location</div>
                    <div className="font-semibold">{viewingStockCount.location}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Start Date</div>
                    <div>{viewingStockCount.startDate instanceof Date ? viewingStockCount.startDate.toLocaleDateString() : new Date(viewingStockCount.startDate).toLocaleDateString()}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Status</div>
                    <Badge color={viewingStockCount.status === 'completed' ? 'success' : viewingStockCount.status === 'in-progress' ? 'warning' : 'default'} variant="flat">
                      {viewingStockCount.status}
                    </Badge>
                  </div>
                </div>

                <Divider />

                <div>
                  <h4 className="font-semibold mb-2">Count Results</h4>
                  <Table>
                    <TableHeader>
                      <TableColumn>Item Code</TableColumn>
                      <TableColumn>Item Name</TableColumn>
                      <TableColumn>Expected</TableColumn>
                      <TableColumn>Counted</TableColumn>
                      <TableColumn>Variance</TableColumn>
                      <TableColumn className="text-right">Variance Value</TableColumn>
                    </TableHeader>
                    <TableBody>
                      {viewingStockCount.items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-mono">{item.itemCode}</TableCell>
                          <TableCell>{item.itemName}</TableCell>
                          <TableCell>{item.expectedQuantity}</TableCell>
                          <TableCell>{item.countedQuantity}</TableCell>
                          <TableCell>
                            <span className={item.variance > 0 ? 'text-green-600' : item.variance < 0 ? 'text-red-600' : 'text-gray-600'}>
                              {item.variance > 0 ? '+' : ''}{item.variance}
                            </span>
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            ₵{Math.abs(item.varianceValue).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <Divider />

                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Total Items</div>
                      <div className="font-semibold">{viewingStockCount.totalItems}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Variance Items</div>
                      <div className="font-semibold text-orange-600">{viewingStockCount.varianceItems}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Total Value</div>
                      <div className="font-semibold">₵{viewingStockCount.totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Variance Value</div>
                      <div className="font-semibold text-orange-600">
                        ₵{viewingStockCount.varianceValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="bordered" onPress={onStockCountViewClose}>Close</Button>
            {viewingStockCount && viewingStockCount.status === 'in-progress' && (
              <Button
                color="success"
                onPress={() => {
                  if (confirm('Complete this stock count? This will apply adjustments to stock levels.')) {
                    handleCompleteStockCount(viewingStockCount);
                    onStockCountViewClose();
                  }
                }}
              >
                Complete Count
              </Button>
            )}
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
