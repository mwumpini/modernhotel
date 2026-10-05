'use client';
// Screens for stock and supply live in ./inventory/. Open the file that matches the tab.
// ItemsPanel — stock items
// SuppliersPanel — suppliers
// RequisitionsPanel — requisitions
// PurchaseOrdersPanel — purchase orders
// TransfersPanel — stock transfers
// GoodsIssuePanel — issues to departments
// SupplierInvoicesPanel — supplier invoices
// ReceiveAndReconPanel — goods receipt and stock count
import { InventoryScreenProvider } from './inventory/inventoryScreenContext';
import type { InventoryScreen } from './inventory/inventoryScreenTypes';
import { ItemsTable, ItemModals } from './inventory/ItemsPanel';
import { SuppliersTable, SupplierModals } from './inventory/SuppliersPanel';
import { PurchaseOrdersTable, PurchaseOrderModals } from './inventory/PurchaseOrdersPanel';
import { RequisitionsTable, RequisitionModals } from './inventory/RequisitionsPanel';
import { SupplierInvoicesTable, SupplierInvoiceModals } from './inventory/SupplierInvoicesPanel';
import { ReceiveAndReconTable, GoodsReceiptModals, StockCountModal, StockCountViewModal } from './inventory/ReceiveAndReconPanel';
import { TransfersTable, StockTransferModal, StockTransferViewModal } from './inventory/TransfersPanel';
import { GoodsIssueTable, GoodsIssueModals } from './inventory/GoodsIssuePanel';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { 
  Card, CardBody, CardHeader, Button, Badge, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, 
  Tabs, Tab, Chip, Input, Select, SelectItem, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter,
  useDisclosure, Pagination, Progress, Tooltip, Textarea, Divider, Autocomplete, AutocompleteItem
} from '@heroui/react';
import { useSession } from 'next-auth/react';
import { useSettingsStore } from '../lib/settings/store';
import { trackEvent } from '../lib/analytics/trackEvent';
import { useStockStore } from '../lib/inventory/stockStore';
import { useSupplierStore } from '../lib/inventory/supplierStore';
import { useAccountingStore } from '../lib/accounting/store';
import { useComplianceStore } from '../lib/compliance/store';
import { useCalculateTax } from '../hooks/useCalculateTax';
import { openHtmlPrintWindow } from '../lib/print/engine';
import { StockItem, Supplier, PurchaseOrder, PurchaseOrderItem, Requisition, RequisitionItem, StockTransfer, StockTransferItem, StockCount, StockCountItem, GoodsIssue, GoodsReceiptNote, GRNItem, SupplierInvoice, InvoiceItem, QualityCheck } from '../lib/inventory/models';
import { BusinessPartner } from '../lib/accounting/models';
import { useRouter } from 'next/navigation';
import { GL_ACCOUNTS } from '../lib/accounting/glAccounts';
import { inventoryHeaders } from './inventory/inventoryHeaders';
import { DEPARTMENT_LOCATIONS } from '../lib/inventory/departmentLocations';
import { sizedTableClassNames, useResizableColumns } from './frontoffice/columnResize';
import {
  DESK_PAGE_SIZE,
  deskTableCardBodyClassName,
  deskTableCardClassName,
  deskTableClassNames,
  SortHeader,
  toggleColumnSort,
  type ColumnSort,
} from './dashboard/deskTableUi';
import { deskBookTabsClassNames, deskBookTabPanelClassName } from './dashboard/deskTabsUi';

// Supplier interface removed - using imported Supplier from models.ts
// PurchaseOrder interface removed - using imported PurchaseOrder from models.ts

export default function InventorySupplyChainDashboard({
  embedded = false,
  initialTab,
}: {
  embedded?: boolean;
  /** Deep-link into a section when opened as a full page (`/inventory?tab=transfers`). */
  initialTab?: string | null;
}) {
  const router = useRouter();
  const resolveTab = (raw?: string | null) => {
    const key = String(raw || '').toLowerCase();
    const allowed = [
      'inventory', 'suppliers', 'requisitions', 'purchase-orders',
      'transfers', 'goods-issue', 'supplier-invoices', 'stock-operations', 'recon',
    ];
    if (key === 'recon') return 'stock-operations';
    if (key === 'items') return 'inventory';
    return allowed.includes(key) ? key : 'inventory';
  };
  const [selectedTab, setSelectedTab] = useState(() => resolveTab(initialTab));
  const settings = useSettingsStore();
  const { data: session } = useSession();
  const currentUserName = session?.user?.name || 'User';
  const [masterLocations, setMasterLocations] = useState<{ id: string; code: string; name: string; isActive: boolean; department?: string | null }[]>([]);
  useEffect(() => {
    fetch('/api/inventory/stock-locations?activeOnly=1', { headers: inventoryHeaders() })
      .then((r) => (r.ok ? r.json() : { locations: [] }))
      .then((data) => setMasterLocations(data.locations || []))
      .catch(() => setMasterLocations([]));
  }, []);
  // Requisition action gates — mirrors the server-side requirePermission() checks in
  // /api/inventory/requisitions, so a user who can't act just doesn't see the button
  // rather than clicking it and hitting a 403 with no explanation.
  const canActOnRequisitions = settings.hasPermission('inventory.approve-requisition');
  const canEditProcessedRequisitions = settings.hasPermission('inventory.edit-processed-requisition');
  const canPrintInventoryDocs = settings.hasPermission('inventory.print');
  const canEditInventoryDocs = settings.hasPermission('inventory.edit');
  const canDeleteInventoryDocs = settings.hasPermission('inventory.delete');
  const canVoidInventoryDocs = settings.hasPermission('inventory.void');
  const canRunStockCount = settings.hasPermission('inventory.stock-count');

  // Inventory Management Hooks - moved to top level to comply with Rules of Hooks
  const {
    stockItems,
    stockMovements,
    stockTransfers,
    stockCounts,
    goodsIssues,
    addStockItem,
    updateStockItem,
    deleteStockItem,
    selectStockItem,
    updateStockLevel,
    addStockMovement,
    upsertStockTransfer,
    upsertStockCount,
    deleteStockCount,
    upsertGoodsIssue,
    hydrateFromApi: hydrateStockFromApi
  } = useStockStore();

  // Supplier Management Hooks - Linked with Accounting
  const {
    suppliers: supplierStoreSuppliers,
    purchaseOrders: supplierStorePurchaseOrders,
    addSupplier,
    updateSupplier,
    deleteSupplier,
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
    hydratePurchaseOrdersFromApi,
    hydrateSuppliersFromApi,
    requisitions: supplierStoreRequisitions,
    createRequisition,
    updateRequisition,
    deleteRequisition,
    approveRequisition,
    markRequisitionReady,
    rejectRequisition,
    convertRequisitionToPOs,
    getRequisitionsByStatus,
    selectRequisition,
    hydrateRequisitionsFromApi,
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
    hydrateGRNsFromApi,
    createSupplierInvoice,
    updateSupplierInvoice,
    hydrateInvoicesFromApi,
    generateNextInvoiceNumber,
    getSupplierInvoice,
    getInvoicesByPO,
    getInvoicesByStatus,
    performThreeWayMatch,
    approveInvoice,
    rejectInvoice,
    markInvoicePaid,
    createQualityCheck,
    updateQualityCheck,
    hydrateQualityChecksFromApi,
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
      glAccountCode: GL_ACCOUNTS.ACCOUNTS_PAYABLE, // '2100' is Tax Payables, not AP -- was wrong
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
  const [itemSort, setItemSort] = useState<ColumnSort>({ column: 'code', direction: 'asc' });
  const itemCols = useResizableColumns({
    code: 110,
    item: 220,
    category: 110,
    unit: 70,
    onHand: 120,
    reorder: 80,
    unitCost: 100,
    location: 130,
    status: 110,
  });
  const rowsPerPage = DESK_PAGE_SIZE;

  // Supplier Management state
  const [supplierSearchTerm, setSupplierSearchTerm] = useState('');
  const [supplierFilterStatus, setSupplierFilterStatus] = useState<string>('all');
  const [supplierFilterCategory, setSupplierFilterCategory] = useState<string>('all');
  const [supplierFilterPaymentTerms, setSupplierFilterPaymentTerms] = useState<string>('all');
  const [supplierPage, setSupplierPage] = useState(1);
  const [supplierSort, setSupplierSort] = useState<ColumnSort>({ column: 'code', direction: 'asc' });
  const supplierCols = useResizableColumns({
    code: 110,
    supplier: 180,
    contact: 140,
    address: 160,
    supplies: 140,
    terms: 90,
    status: 90,
  });
  const supplierRowsPerPage = DESK_PAGE_SIZE;
  
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
    const fromMaster = masterLocations.map((loc) => loc.name);
    if (fromMaster.length > 0) return fromMaster.sort((a, b) => a.localeCompare(b));
    const locs = [...new Set(stockItems.map((item) => item.location).filter(Boolean))];
    return locs.sort();
  }, [masterLocations, stockItems]);

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

  const itemStatusLabel = (item: StockItem) => {
    if (!item.isActive) return 'Inactive';
    if (item.currentStock <= item.reorderPoint) return 'Low Stock';
    if (item.currentStock > item.maximumStock * 0.8) return 'Overstock';
    return 'In Stock';
  };

  const sortedItems = useMemo(() => {
    const dir = itemSort.direction === 'asc' ? 1 : -1;
    return [...filteredItems].sort((a, b) => {
      switch (itemSort.column) {
        case 'item':
          return a.name.localeCompare(b.name) * dir;
        case 'category':
          return a.category.localeCompare(b.category) * dir;
        case 'unit':
          return (a.unit || '').localeCompare(b.unit || '') * dir;
        case 'onHand':
          return (a.currentStock - b.currentStock) * dir;
        case 'reorder':
          return (a.reorderPoint - b.reorderPoint) * dir;
        case 'unitCost':
          return (a.unitCost - b.unitCost) * dir;
        case 'location':
          return (a.location || '').localeCompare(b.location || '') * dir;
        case 'status':
          return itemStatusLabel(a).localeCompare(itemStatusLabel(b)) * dir;
        case 'code':
        default:
          return a.itemCode.localeCompare(b.itemCode) * dir;
      }
    });
  }, [filteredItems, itemSort]);

  // Pagination
  const pages = Math.max(1, Math.ceil(sortedItems.length / rowsPerPage));
  const pageSafe = Math.min(page, pages);
  const paginatedItems = useMemo(() => {
    const start = (pageSafe - 1) * rowsPerPage;
    return sortedItems.slice(start, start + rowsPerPage);
  }, [sortedItems, pageSafe]);

  useEffect(() => {
    setPage(1);
  }, [searchTerm, filterCategory, filterLocation, filterStatus, itemSort.column, itemSort.direction]);

  // Handle form operations
  const handleAddItem = () => {
    setEditingItem(null);
    const nextCode = settings.getNextModuleNumber('inventory', 'stockItem');
    setFormData({
      itemCode: nextCode,
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
      location: 'Main Store',
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
    if (!String(formData.itemCode || '').trim() || !String(formData.name || '').trim()) {
      alert('Item code and name are required.');
      return;
    }
    if (!String(formData.unit || '').trim()) {
      alert('Unit is required (e.g. pcs, kg).');
      return;
    }
    const payload = {
      ...formData,
      description: formData.description || '',
      subcategory: formData.subcategory || '',
      location: formData.location || 'Main Store',
      minimumStock: formData.minimumStock ?? formData.reorderPoint ?? 0,
      maximumStock: formData.maximumStock || Math.max(Number(formData.currentStock || 0) * 2, 100),
      reorderPoint: formData.reorderPoint ?? 0,
      isActive: formData.isActive !== false,
      isPerishable: !!formData.isPerishable,
      isSerialized: !!formData.isSerialized,
    };
    if (editingItem) {
      updateStockItem(editingItem.id, payload as Partial<StockItem>);
      trackEvent('Stores.Issued', { action: 'update_item', itemCode: editingItem.itemCode });
    } else {
      addStockItem({
        ...payload,
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

  const handleDeleteItem = async (itemId: string) => {
    const { confirmDelete } = await import('./DangerConfirm');
    if (await confirmDelete('this stock item', 'Only an item that has never moved can be removed. This cannot be undone.')) {
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

  const STOCK_CATEGORIES = [
    'food', 'beverage', 'cleaning', 'maintenance', 'office', 'linens', 'amenities', 'electronics', 'furniture', 'other',
  ] as const;

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
    paymentTerms: 'net30',
    taxType: 'none',
    taxRate: 0
  });

  // Tax type options — Tax Types configured for Purchases in Settings → Tax Rate
  // Builder (Compliance). A Tax Type is a named bundle of one or more compliance tax
  // rules (e.g. "Purchases Standard Tax" = NHIL + GETFund + VAT stacked, "Purchases
  // Flat Rate" = VFRS 3%) — not a single flat rate, so the amount is always computed
  // by summing whichever rules are assigned to the selected type (computePOTax
  // below), the same stacking engine the Compliance simulator uses.
  const complianceTaxTypes = useComplianceStore(s => s.taxTypes);
  const complianceTaxRules = useComplianceStore(s => s.taxRules);
  const complianceCountry = useComplianceStore(s => s.country);
  const calcTax = useCalculateTax();
  const taxOptions = useMemo(() => {
    const realOptions = complianceTaxTypes
      .filter(t => t.countryCode === complianceCountry && (t.domain || 'sales') === 'purchases')
      .map(t => ({ value: t.id, label: t.name }));
    return [
      { value: 'none', label: 'None' },
      ...realOptions,
      { value: 'custom', label: 'Custom Rate' },
    ];
  }, [complianceTaxTypes, complianceCountry]);

  // Signed tax amount for a purchase subtotal — 'none' is 0, 'custom' applies the
  // manually typed rate, and any real Tax Type sums every rule assigned to it via
  // the shared stacking engine (NHIL+GETFund+VAT compounding, WHT subtracting, etc).
  // Mirrors repository.ts's resolvePurchaseTax, which is what the server actually
  // persists — this is only an optimistic local preview.
  const computePOTax = useCallback((subtotal: number, taxTypeId: string | undefined, customRate: number): number => {
    if (!(subtotal > 0) || !taxTypeId || taxTypeId === 'none') return 0;
    if (taxTypeId === 'custom') return Math.round(subtotal * (customRate || 0) / 100 * 100) / 100;
    const { total } = calcTax(subtotal, 'ALL', { domain: 'purchases', operation: 'internal', typeId: taxTypeId });
    return Math.round((total - subtotal) * 100) / 100;
  }, [calcTax]);

  // Itemized breakdown for display — a Tax Type is a bundle of rules (e.g. NHIL,
  // GETFund Levy, VAT (Standard Rate)), so the UI should show each one separately
  // rather than collapsing them into one "Tax" line, matching how the Compliance
  // simulator (Settings → Tax Rate Builder) already presents the same calculation.
  // Signed per line (negative = withheld) using that rule's own `effect`.
  const computePOTaxLines = useCallback((subtotal: number, taxTypeId: string | undefined, customRate: number): Array<{ name: string; amount: number }> => {
    if (!(subtotal > 0) || !taxTypeId || taxTypeId === 'none') return [];
    if (taxTypeId === 'custom') {
      const amount = Math.round(subtotal * (customRate || 0) / 100 * 100) / 100;
      return amount !== 0 ? [{ name: 'Custom Rate', amount }] : [];
    }
    const { taxes } = calcTax(subtotal, 'ALL', { domain: 'purchases', operation: 'internal', typeId: taxTypeId });
    return taxes
      .filter(t => t.amount !== 0)
      .map(t => {
        const rule = complianceTaxRules.find(r => r.id === t.ruleId);
        const signed = rule?.effect === 'subtract' ? -t.amount : t.amount;
        return { name: t.name, amount: signed };
      });
  }, [calcTax, complianceTaxRules]);
  const [poSearchTerm, setPOSearchTerm] = useState('');
  const [poFilterStatus, setPOFilterStatus] = useState<string>('all');
  const [poPage, setPOPage] = useState(1);
  const [poSort, setPOSort] = useState<ColumnSort>({ column: 'orderDate', direction: 'desc' });
  const poCols = useResizableColumns({
    number: 130,
    supplier: 160,
    orderDate: 110,
    expected: 120,
    priority: 90,
    amount: 130,
    status: 110,
  });
  const poRowsPerPage = DESK_PAGE_SIZE;

  // Requisition state
  const { isOpen: isRequisitionModalOpen, onOpen: onRequisitionModalOpen, onClose: onRequisitionModalClose } = useDisclosure();
  const { isOpen: isRequisitionViewOpen, onOpen: onRequisitionViewOpen, onClose: onRequisitionViewClose } = useDisclosure();
  const [editingRequisition, setEditingRequisition] = useState<Requisition | null>(null);
  const [viewingRequisition, setViewingRequisition] = useState<Requisition | null>(null);
  const [requisitionFormData, setRequisitionFormData] = useState<Partial<Requisition> & { requestedItems?: RequisitionItem[] }>({
    status: 'pending',
    requestedItems: [],
    requestedDate: new Date(),
    requestedBy: currentUserName
  });
  const [requisitionSearchTerm, setRequisitionSearchTerm] = useState('');
  const [requisitionFilterStatus, setRequisitionFilterStatus] = useState<string>('all');
  const [requisitionPage, setRequisitionPage] = useState(1);
  const [requisitionSort, setRequisitionSort] = useState<ColumnSort>({ column: 'date', direction: 'desc' });
  const requisitionCols = useResizableColumns({
    number: 130,
    requestedBy: 140,
    date: 120,
    items: 90,
    amount: 130,
    status: 120,
  });
  const [transferSort, setTransferSort] = useState<ColumnSort>({ column: 'date', direction: 'desc' });
  const [transferPage, setTransferPage] = useState(1);
  const transferCols = useResizableColumns({
    number: 130,
    from: 140,
    to: 140,
    date: 110,
    items: 70,
    status: 100,
  });
  const [issueSort, setIssueSort] = useState<ColumnSort>({ column: 'date', direction: 'desc' });
  const [issuePage, setIssuePage] = useState(1);
  const issueCols = useResizableColumns({
    number: 130,
    date: 110,
    department: 130,
    issuedTo: 130,
    lines: 70,
    value: 120,
  });
  const [invoiceSort, setInvoiceSort] = useState<ColumnSort>({ column: 'date', direction: 'desc' });
  const invoiceCols = useResizableColumns({
    number: 120,
    po: 110,
    grn: 110,
    supplier: 140,
    date: 110,
    amount: 120,
    matching: 100,
    status: 100,
  });
  const [receiptSort, setReceiptSort] = useState<ColumnSort>({ column: 'expected', direction: 'asc' });
  const [receiptPage, setReceiptPage] = useState(1);
  const receiptCols = useResizableColumns({
    number: 130,
    supplier: 150,
    ordered: 110,
    expected: 110,
    lines: 70,
    status: 100,
  });
  const [countSort, setCountSort] = useState<ColumnSort>({ column: 'started', direction: 'desc' });
  const [countPage, setCountPage] = useState(1);
  const countCols = useResizableColumns({
    number: 130,
    type: 90,
    location: 140,
    started: 110,
    lines: 70,
    variance: 70,
    status: 110,
  });

  // Approve/Reject/Ready/Convert/Delete confirmation — an in-app modal instead of
  // native confirm()/prompt(), which some embedded/automated browser contexts
  // silently auto-dismiss (the action then looks like it "does nothing" when clicked).
  const [reqActionModal, setReqActionModal] = useState<{ type: 'approve' | 'reject' | 'ready' | 'convert' | 'delete'; requisitionId: string; requisitionNumber: string } | null>(null);
  const [reqRejectReason, setReqRejectReason] = useState('');
  /** Line id → supplier id for Convert-to-PO (supports multi-vendor split). */
  const [reqConvertSuppliers, setReqConvertSuppliers] = useState<Record<string, string>>({});
  const openReqAction = (type: 'approve' | 'reject' | 'ready' | 'convert' | 'delete', req: Requisition) => {
    setReqRejectReason('');
    if (type === 'convert') {
      const defaults: Record<string, string> = {};
      for (const item of req.requestedItems) {
        const vendors = (() => {
          const stock = stockItems.find((s) => s.id === item.itemId || s.itemCode === item.itemCode);
          const ids = new Set<string>();
          if (stock?.supplierId) ids.add(stock.supplierId);
          if (item.preferredSupplierId) ids.add(item.preferredSupplierId);
          const category = (stock?.category || '').toLowerCase();
          for (const s of mergedSuppliers.filter((x) => x.isActive)) {
            if (category) {
              const cats = (s.categories || []).map((c) => c.toLowerCase());
              if (cats.some((c) => c === category || c.includes(category) || category.includes(c))) ids.add(s.id);
            }
          }
          for (const po of supplierStorePurchaseOrders) {
            if (po.items.some((i) => i.itemId === item.itemId || i.itemCode === item.itemCode)) {
              ids.add(po.supplierId);
            }
          }
          return mergedSuppliers.filter((s) => s.isActive && ids.has(s.id));
        })();
        const fromLine = item.preferredSupplierId && vendors.some((v) => v.id === item.preferredSupplierId)
          ? item.preferredSupplierId
          : undefined;
        const fromStock = stockItems.find((s) => s.id === item.itemId || s.itemCode === item.itemCode)?.supplierId;
        const sid = fromLine || (fromStock && vendors.some((v) => v.id === fromStock) ? fromStock : undefined) || vendors[0]?.id;
        if (sid) defaults[item.id] = sid;
      }
      setReqConvertSuppliers(defaults);
    } else {
      setReqConvertSuppliers({});
    }
    setReqActionModal({ type, requisitionId: req.id, requisitionNumber: req.requisitionNumber });
  };
  const closeReqAction = () => {
    setReqActionModal(null);
    setReqConvertSuppliers({});
  };
  const confirmReqAction = () => {
    if (!reqActionModal) return;
    const { type, requisitionId, requisitionNumber } = reqActionModal;
    if (type === 'approve') {
      approveRequisition(requisitionId, currentUserName);
      trackEvent('Stores.Issued', { action: 'approve_requisition', requisitionNumber });
    } else if (type === 'ready') {
      markRequisitionReady(requisitionId, currentUserName);
      trackEvent('Stores.Issued', { action: 'ready_requisition', requisitionNumber });
    } else if (type === 'reject') {
      rejectRequisition(requisitionId, currentUserName, reqRejectReason || undefined);
      trackEvent('Stores.Issued', { action: 'reject_requisition', requisitionNumber });
    } else if (type === 'convert') {
      const req = supplierStoreRequisitions.find((r) => r.id === requisitionId);
      const missing = (req?.requestedItems || []).filter((i) => !reqConvertSuppliers[i.id]);
      if (missing.length > 0) {
        alert('Assign a supplier to every line before converting.');
        return;
      }
      const activeIds = new Set(mergedSuppliers.filter((s) => s.isActive).map((s) => s.id));
      const invalid = Object.values(reqConvertSuppliers).some((id) => !activeIds.has(id));
      if (invalid || Object.keys(reqConvertSuppliers).length === 0) {
        alert('Please add/select active suppliers before converting to PO.');
        return;
      }
      const newPOs = convertRequisitionToPOs(requisitionId, reqConvertSuppliers);
      if (newPOs.length === 0) {
        alert('Could not create purchase orders — check suppliers and try again.');
        return;
      }
      trackEvent('Stores.Issued', {
        action: 'convert_requisition_to_po',
        requisitionNumber,
        poNumbers: newPOs.map((p) => p.poNumber),
        poCount: newPOs.length,
      });
      setSelectedTab('purchase-orders');
    } else if (type === 'delete') {
      deleteRequisition(requisitionId);
      trackEvent('Stores.Issued', { action: 'delete_requisition', requisitionNumber });
    }
    if (isRequisitionViewOpen) onRequisitionViewClose();
    closeReqAction();
  };
  const requisitionRowsPerPage = DESK_PAGE_SIZE;

  // Empty placeholder removed — Overview tab no longer used.

  

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

  // Load real persisted purchase orders and stock items once on mount, replacing
  // the hardcoded sample seeds the stores initialize with.
  useEffect(() => {
    hydratePurchaseOrdersFromApi();
    hydrateStockFromApi();
    hydrateSuppliersFromApi();
    hydrateRequisitionsFromApi();
    hydrateGRNsFromApi();
    hydrateQualityChecksFromApi();
    hydrateInvoicesFromApi();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Parent Stores shell / quick actions can jump straight into an ops tab.
  useEffect(() => {
    const apply = (e: Event) => {
      const detail = (e as CustomEvent).detail || {};
      if (detail.tab) {
        const tab = String(detail.tab);
        if (tab === 'reports') {
          router.push('/inventory/reports');
          return;
        }
        if (['inventory', 'suppliers', 'requisitions', 'purchase-orders', 'transfers', 'goods-issue', 'supplier-invoices', 'stock-operations', 'recon'].includes(tab)) {
          setSelectedTab(tab === 'recon' ? 'stock-operations' : tab);
        }
      }
      if (detail.stockOp) {
        const op = String(detail.stockOp);
        // Ops that live on the main strip now
        if (op === 'stock-transfers' || op === 'transfers') {
          setSelectedTab('transfers');
        } else if (op === 'goods-issue') {
          setSelectedTab('goods-issue');
        } else if (op === 'supplier-invoices') {
          setSelectedTab('supplier-invoices');
        } else {
          setSelectedTab('stock-operations');
          setStockOpSubTab(op === 'grn-management' ? 'goods-receipt' : op);
        }
      }
    };
    window.addEventListener('inv-ops-navigate', apply);
    return () => window.removeEventListener('inv-ops-navigate', apply);
  }, [router]);

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

  /** Vendors allowed for a stock line: item's linked supplier, category matches, past PO vendors. */
  const getVendorsForStockItem = useCallback((stock?: StockItem | null, itemId?: string, itemCode?: string) => {
    const active = mergedSuppliers.filter((s) => s.isActive);
    if (!stock && !itemId && !itemCode) return active;

    const ids = new Set<string>();
    if (stock?.supplierId) ids.add(stock.supplierId);

    const category = (stock?.category || '').toLowerCase();
    if (category) {
      for (const s of active) {
        const cats = (s.categories || []).map((c) => c.toLowerCase());
        if (cats.some((c) => c === category || c.includes(category) || category.includes(c))) {
          ids.add(s.id);
        }
      }
    }

    const matchId = itemId || stock?.id;
    const matchCode = (itemCode || stock?.itemCode || '').toLowerCase();
    for (const po of supplierStorePurchaseOrders) {
      const hit = po.items.some(
        (i) => (matchId && i.itemId === matchId) || (matchCode && i.itemCode.toLowerCase() === matchCode)
      );
      if (hit && po.supplierId) ids.add(po.supplierId);
    }

    const filtered = active.filter((s) => ids.has(s.id));
    // If the product has at least one known vendor, only show those — never the full list.
    if (filtered.length > 0) return filtered;
    // No vendor on item / category / history: empty list so the user links a supplier on the item first.
    return [];
  }, [mergedSuppliers, supplierStorePurchaseOrders]);

  const getVendorsForRequisitionLine = useCallback((line: Pick<RequisitionItem, 'itemId' | 'itemCode'>) => {
    const stock = stockItems.find((s) => s.id === line.itemId || s.itemCode === line.itemCode);
    return getVendorsForStockItem(stock, line.itemId, line.itemCode);
  }, [stockItems, getVendorsForStockItem]);

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

  const sortedSuppliers = useMemo(() => {
    const dir = supplierSort.direction === 'asc' ? 1 : -1;
    return [...filteredSuppliers].sort((a, b) => {
      switch (supplierSort.column) {
        case 'supplier':
          return a.name.localeCompare(b.name) * dir;
        case 'contact':
          return (a.contactPerson || '').localeCompare(b.contactPerson || '') * dir;
        case 'address':
          return (a.address || a.city || '').localeCompare(b.address || b.city || '') * dir;
        case 'supplies':
          return (a.categories?.join(',') || '').localeCompare(b.categories?.join(',') || '') * dir;
        case 'terms':
          return (a.paymentTerms || '').localeCompare(b.paymentTerms || '') * dir;
        case 'status':
          return (Number(a.isActive) - Number(b.isActive)) * dir;
        case 'code':
        default:
          return a.code.localeCompare(b.code) * dir;
      }
    });
  }, [filteredSuppliers, supplierSort]);

  const supplierPages = Math.max(1, Math.ceil(sortedSuppliers.length / supplierRowsPerPage));
  const supplierPageSafe = Math.min(supplierPage, supplierPages);
  const paginatedSuppliers = useMemo(() => {
    const start = (supplierPageSafe - 1) * supplierRowsPerPage;
    return sortedSuppliers.slice(start, start + supplierRowsPerPage);
  }, [sortedSuppliers, supplierPageSafe]);

  useEffect(() => {
    setSupplierPage(1);
  }, [supplierSearchTerm, supplierFilterStatus, supplierFilterCategory, supplierFilterPaymentTerms, supplierSort.column, supplierSort.direction]);

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
    if (!String(supplierFormData.name || '').trim()) {
      alert('Supplier name is required.');
      return;
    }
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
    return settings.getNextModuleNumber('inventory', 'purchaseOrder');
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
      paymentTerms: 'net30',
      notes: '',
      items: [],
      createdBy: currentUserName,
      taxType: 'none',
      taxRate: 0
    });
    onPOModalOpen();
  };

  const handleEditPO = (po: PurchaseOrder) => {
    setEditingPO(po);
    let taxType = 'none';
    let taxRate = 0;

    if (po.taxTypeId) {
      const match = taxOptions.find(opt => opt.value === po.taxTypeId);
      taxType = match?.value || (po.taxTypeId === 'custom' ? 'custom' : 'none');
      // Only 'custom' has a single rate to re-populate — a real Tax Type is a bundle
      // of rules with no one rate (its amount is recomputed live from those rules).
      taxRate = taxType === 'custom'
        ? (po.customTaxRate ?? (po.totalAmount > 0 ? Math.abs(po.taxAmount / po.totalAmount) * 100 : 0))
        : 0;
    } else if (po.taxAmount !== 0 && po.totalAmount > 0) {
      // Legacy record saved before taxTypeId was tracked — taxAmount held the
      // (possibly signed) tax amount directly with no record of which type.
      taxType = 'custom';
      taxRate = Math.abs((po.taxAmount / po.totalAmount) * 100);
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

    // Calculate totals. The server is authoritative — it re-resolves the selected
    // tax type's rules itself (see repository.ts upsertPurchaseOrder/
    // resolvePurchaseTax), so this is just an optimistic local preview;
    // createPurchaseOrder/updatePurchaseOrder reconcile the store with the
    // server's real totals once the save round-trips.
    const subtotal = poFormData.items.reduce((sum, item) => sum + (item.quantity * item.unitCost), 0);
    const taxTypeId = poFormData.taxType && poFormData.taxType !== 'none' ? poFormData.taxType : undefined;
    const taxAmount = computePOTax(subtotal, taxTypeId, poFormData.taxRate || 0);
    const shipping = poFormData.shippingAmount || 0;
    const discount = poFormData.discountAmount || 0;
    const finalAmount = subtotal + taxAmount + shipping - discount;

    const poData: Omit<PurchaseOrder, 'id' | 'createdAt' | 'updatedAt'> = {
      poNumber: poFormData.poNumber || generatePONumber(),
      supplierId: poFormData.supplierId,
      supplierName: poFormData.supplierName,
      orderDate: poFormData.orderDate || new Date(),
      expectedDeliveryDate: poFormData.expectedDeliveryDate || new Date(),
      status: poFormData.status || 'draft',
      priority: poFormData.priority || 'medium',
      totalAmount: subtotal,
      taxAmount,
      taxTypeId,
      customTaxRate: taxTypeId === 'custom' ? (poFormData.taxRate || 0) : undefined,
      shippingAmount: shipping,
      discountAmount: discount,
      finalAmount: finalAmount,
      currency: poFormData.currency || 'GHS',
      paymentTerms: poFormData.paymentTerms || 'net30',
      notes: poFormData.notes,
      items: poFormData.items,
      createdBy: poFormData.createdBy || currentUserName,
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
      paymentTerms: 'net30',
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

  // PO print layout follows the standard purchase-order template (header with
  // issuer + vendor side by side, order details stacked top-right, itemized
  // table, notes/terms on the left with a totals box on the right) —
  // https://invoice-generator.com/purchase-order-template.
  const handleGeneratePOPDF = () => {
    if (!poFormData.items || poFormData.items.length === 0) {
      alert('Please add items to generate PDF');
      return;
    }

    const esc = (s: unknown) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const money = (n: number) => `₵${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const fmtDate = (d: Date | string | undefined, fallback?: Date) => {
      const val = d instanceof Date ? d : d ? new Date(d) : fallback;
      return val ? val.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A';
    };

    const subtotal = (poFormData.items || []).reduce((sum, item) => sum + item.totalCost, 0);
    const taxLines = computePOTaxLines(subtotal, poFormData.taxType, poFormData.taxRate || 0);
    const taxAmount = taxLines.reduce((sum, l) => sum + l.amount, 0);
    const shipping = poFormData.shippingAmount || 0;
    const discount = poFormData.discountAmount || 0;
    const totalAmount = subtotal + taxAmount + shipping - discount;
    const poNumber = poFormData.poNumber || generatePONumber();
    const paymentTermsLabels: Record<string, string> = { immediate: 'Immediate', net30: 'Net 30', net60: 'Net 60', net90: 'Net 90' };
    const paymentTermsLabel = paymentTermsLabels[poFormData.paymentTerms || ''] || poFormData.paymentTerms || 'N/A';

    const company = settings.companySettings;
    const companyName = company?.tradingName || company?.legalName || settings.tenant?.name || 'Company Name';
    const companyAddressLines = [
      company?.address?.line1,
      company?.address?.line2,
      [company?.address?.city, company?.address?.state, company?.address?.postalCode].filter(Boolean).join(', '),
      company?.address?.country,
    ].filter(Boolean) as string[];
    const companyContactLines = [
      company?.contact?.phone,
      company?.contact?.email,
      company?.taxId ? `TIN: ${company.taxId}` : undefined,
    ].filter(Boolean) as string[];

    const supplier = supplierStoreSuppliers.find(s => s.id === poFormData.supplierId);
    const supplierLines = [
      poFormData.supplierName || supplier?.name || 'N/A',
      supplier?.address,
      [supplier?.city, supplier?.country].filter(Boolean).join(', ') || undefined,
      supplier?.phone,
      supplier?.email,
    ].filter(Boolean) as string[];

    const taxRowsHtml = taxLines
      .map(l => `<tr><td>${esc(l.amount < 0 ? `${l.name} (withheld)` : l.name)}</td><td>${l.amount < 0 ? '-' : ''}${money(Math.abs(l.amount))}</td></tr>`)
      .join('');

    const pdfContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Purchase Order ${esc(poNumber)}</title>
          <style>
            * { box-sizing: border-box; }
            body { font-family: Arial, Helvetica, sans-serif; color: #1a1a1a; padding: 32px 40px; font-size: 13px; }
            .top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 28px; }
            .from-block .company-name { font-size: 16px; font-weight: 700; margin: 0 0 4px; }
            .from-block p { margin: 0; line-height: 1.45; color: #444; }
            .title-block { text-align: right; }
            .title-block h1 { margin: 0 0 8px; font-size: 26px; letter-spacing: 1px; color: #111; }
            .title-block table { border-collapse: collapse; margin-left: auto; }
            .title-block td { padding: 3px 0 3px 16px; text-align: right; white-space: nowrap; }
            .title-block td.label { color: #666; text-align: right; padding-left: 0; }
            .parties { display: flex; justify-content: space-between; gap: 32px; margin-bottom: 24px; padding-bottom: 20px; border-bottom: 1px solid #ddd; }
            .parties .block { flex: 1; }
            .parties h3 { margin: 0 0 6px; font-size: 11px; letter-spacing: 0.5px; text-transform: uppercase; color: #888; }
            .parties p { margin: 0; line-height: 1.45; }
            .items-table { width: 100%; border-collapse: collapse; margin-top: 8px; }
            .items-table th { background: #1a1a1a; color: #fff; text-align: left; padding: 8px 10px; font-size: 12px; font-weight: 600; }
            .items-table td { padding: 8px 10px; border-bottom: 1px solid #eee; }
            .items-table th:last-child, .items-table td:last-child,
            .items-table th:nth-child(3), .items-table td:nth-child(3),
            .items-table th:nth-child(4), .items-table td:nth-child(4) { text-align: right; }
            .bottom { display: flex; justify-content: space-between; gap: 32px; margin-top: 24px; }
            .notes-block { flex: 1; }
            .notes-block h3 { margin: 0 0 6px; font-size: 11px; letter-spacing: 0.5px; text-transform: uppercase; color: #888; }
            .notes-block p { margin: 0 0 14px; line-height: 1.5; white-space: pre-wrap; }
            .totals { width: 280px; }
            .totals table { width: 100%; border-collapse: collapse; }
            .totals td { padding: 5px 0; }
            .totals td:last-child { text-align: right; }
            .totals tr.grand td { border-top: 2px solid #1a1a1a; padding-top: 10px; font-size: 16px; font-weight: 700; }
            .footer-note { margin-top: 36px; padding-top: 14px; border-top: 1px solid #ddd; color: #888; font-size: 11px; }
          </style>
        </head>
        <body>
          <div class="top">
            <div class="from-block">
              <p class="company-name">${esc(companyName)}</p>
              ${companyAddressLines.map(l => `<p>${esc(l)}</p>`).join('')}
              ${companyContactLines.map(l => `<p>${esc(l)}</p>`).join('')}
            </div>
            <div class="title-block">
              <h1>PURCHASE ORDER</h1>
              <table>
                <tr><td class="label">PO #</td><td>${esc(poNumber)}</td></tr>
                <tr><td class="label">Date</td><td>${fmtDate(poFormData.orderDate, new Date())}</td></tr>
                <tr><td class="label">Required By</td><td>${fmtDate(poFormData.expectedDeliveryDate)}</td></tr>
                <tr><td class="label">Payment Terms</td><td>${esc(paymentTermsLabel)}</td></tr>
                <tr><td class="label">Priority</td><td>${esc(poFormData.priority || 'Medium')}</td></tr>
              </table>
            </div>
          </div>

          <div class="parties">
            <div class="block">
              <h3>Vendor</h3>
              ${supplierLines.map(l => `<p>${esc(l)}</p>`).join('')}
            </div>
          </div>

          <table class="items-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Description</th>
                <th>Qty</th>
                <th>Unit Cost</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              ${(poFormData.items || []).map(item => `
                <tr>
                  <td>${esc(item.itemCode)}</td>
                  <td>${esc(item.itemName)}</td>
                  <td>${esc(item.quantity)}</td>
                  <td>${money(item.unitCost)}</td>
                  <td>${money(item.totalCost)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="bottom">
            <div class="notes-block">
              ${poFormData.notes ? `<h3>Notes</h3><p>${esc(poFormData.notes)}</p>` : ''}
            </div>
            <div class="totals">
              <table>
                <tr><td>Subtotal</td><td>${money(subtotal)}</td></tr>
                ${taxRowsHtml}
                ${shipping > 0 ? `<tr><td>Shipping</td><td>${money(shipping)}</td></tr>` : ''}
                ${discount > 0 ? `<tr><td>Discount</td><td>-${money(discount)}</td></tr>` : ''}
                <tr class="grand"><td>Total</td><td>${money(totalAmount)}</td></tr>
              </table>
            </div>
          </div>

          <div class="footer-note">This purchase order is issued by ${esc(companyName)}. Please reference PO #${esc(poNumber)} on your invoice and delivery documents.</div>
        </body>
      </html>
    `;

    // Popup-blocker-safe: prints via a hidden iframe rather than window.open,
    // which silently does nothing when the browser (or the user) blocks popups.
    openHtmlPrintWindow(pdfContent);

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

  const sortedPOs = useMemo(() => {
    const dir = poSort.direction === 'asc' ? 1 : -1;
    const ms = (d: Date | string) => (d instanceof Date ? d : new Date(d)).getTime();
    return [...filteredPOs].sort((a, b) => {
      switch (poSort.column) {
        case 'supplier':
          return a.supplierName.localeCompare(b.supplierName) * dir;
        case 'orderDate':
          return (ms(a.orderDate) - ms(b.orderDate)) * dir;
        case 'expected':
          return (ms(a.expectedDeliveryDate) - ms(b.expectedDeliveryDate)) * dir;
        case 'priority':
          return a.priority.localeCompare(b.priority) * dir;
        case 'amount':
          return ((a.finalAmount || 0) - (b.finalAmount || 0)) * dir;
        case 'status':
          return a.status.localeCompare(b.status) * dir;
        case 'number':
        default:
          return a.poNumber.localeCompare(b.poNumber) * dir;
      }
    });
  }, [filteredPOs, poSort]);

  const poPages = Math.max(1, Math.ceil(sortedPOs.length / poRowsPerPage));
  const poPageSafe = Math.min(poPage, poPages);
  const paginatedPOs = useMemo(() => {
    const start = (poPageSafe - 1) * poRowsPerPage;
    return sortedPOs.slice(start, start + poRowsPerPage);
  }, [sortedPOs, poPageSafe]);

  useEffect(() => {
    setPOPage(1);
  }, [poSearchTerm, poFilterStatus, poSort.column, poSort.direction]);

  // Requisition handlers — uses the real configured numbering sequence (Settings → Document
  // Numbering → Inventory → Requisition) instead of `array.length + 1`, which reused an
  // already-issued number the moment any earlier requisition was deleted.
  const generateRequisitionNumber = () => {
    return settings.getNextModuleNumber('inventory', 'requisition');
  };

  const handleAddRequisition = () => {
    setEditingRequisition(null);
    const reqNumber = generateRequisitionNumber();
    setRequisitionFormData({
      requisitionNumber: reqNumber,
      requestedBy: currentUserName,
      requestedDate: new Date(),
      status: 'pending',
      requestedItems: [],
      notes: ''
    });
    onRequisitionModalOpen();
  };

  const handleEditRequisition = (req: Requisition) => {
    // Visibility of the Edit button already enforces this (pending, or
    // inventory.edit-processed-requisition for anything Stores has acted on) —
    // the server re-checks it too, so no extra gate needed here.
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
      requestedBy: requisitionFormData.requestedBy || currentUserName,
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
      requestedBy: currentUserName
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
      const preferredSupplier = item.supplierId
        ? mergedSuppliers.find((s) => s.id === item.supplierId)
        : undefined;
      currentItems[itemIndex] = {
        ...currentItems[itemIndex],
        itemId: item.id,
        itemCode: item.itemCode,
        itemName: item.name,
        estimatedPrice: item.unitCost,
        preferredSupplierId: preferredSupplier?.id || item.supplierId,
        preferredSupplierName: preferredSupplier?.name || item.supplierName,
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

  const sortedRequisitions = useMemo(() => {
    const dir = requisitionSort.direction === 'asc' ? 1 : -1;
    const ms = (d: Date | string) => (d instanceof Date ? d : new Date(d)).getTime();
    return [...filteredRequisitions].sort((a, b) => {
      const amountA = a.requestedItems.reduce((sum, item) => sum + item.totalCost, 0);
      const amountB = b.requestedItems.reduce((sum, item) => sum + item.totalCost, 0);
      switch (requisitionSort.column) {
        case 'requestedBy':
          return a.requestedBy.localeCompare(b.requestedBy) * dir;
        case 'date':
          return (ms(a.requestedDate) - ms(b.requestedDate)) * dir;
        case 'items':
          return (a.requestedItems.length - b.requestedItems.length) * dir;
        case 'amount':
          return (amountA - amountB) * dir;
        case 'status':
          return a.status.localeCompare(b.status) * dir;
        case 'number':
        default:
          return a.requisitionNumber.localeCompare(b.requisitionNumber) * dir;
      }
    });
  }, [filteredRequisitions, requisitionSort]);

  const requisitionPages = Math.max(1, Math.ceil(sortedRequisitions.length / requisitionRowsPerPage));
  const requisitionPageSafe = Math.min(requisitionPage, requisitionPages);
  const paginatedRequisitions = useMemo(() => {
    const start = (requisitionPageSafe - 1) * requisitionRowsPerPage;
    return sortedRequisitions.slice(start, start + requisitionRowsPerPage);
  }, [sortedRequisitions, requisitionPageSafe]);

  useEffect(() => {
    setRequisitionPage(1);
  }, [requisitionSearchTerm, requisitionFilterStatus, requisitionSort.column, requisitionSort.direction]);

  const handleDeleteSupplier = async (supplierId: string) => {
    const { confirmDelete } = await import('./DangerConfirm');
    if (await confirmDelete('this supplier', 'The supplier will be removed here and from accounting. This cannot be undone.')) {
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

  

  

  

  // GRN view / QC (opened from Goods Receipt flow — no separate list tab)
  const { isOpen: isGRNViewOpen, onOpen: onGRNViewOpen, onClose: onGRNViewClose } = useDisclosure();
  const { isOpen: isQualityCheckOpen, onOpen: onQualityCheckOpen, onClose: onQualityCheckClose } = useDisclosure();
  const [viewingGRN, setViewingGRN] = useState<GoodsReceiptNote | null>(null);
  const [selectedGRNForQC, setSelectedGRNForQC] = useState<GoodsReceiptNote | null>(null);
  const [qualityCheckFormData, setQualityCheckFormData] = useState<Partial<QualityCheck> & { items?: any[] }>({});

  // Invoice Management State
  const [invoiceSearchTerm, setInvoiceSearchTerm] = useState('');
  const [invoiceFilterStatus, setInvoiceFilterStatus] = useState<string>('all');
  const [invoicePage, setInvoicePage] = useState(1);
  const invoiceRowsPerPage = DESK_PAGE_SIZE;
  const { isOpen: isInvoiceModalOpen, onOpen: onInvoiceModalOpen, onClose: onInvoiceModalClose } = useDisclosure();
  const { isOpen: isInvoiceViewOpen, onOpen: onInvoiceViewOpen, onClose: onInvoiceViewClose } = useDisclosure();
  const { isOpen: isThreeWayMatchOpen, onOpen: onThreeWayMatchOpen, onClose: onThreeWayMatchClose } = useDisclosure();
  const [editingInvoice, setEditingInvoice] = useState<SupplierInvoice | null>(null);
  const [viewingInvoice, setViewingInvoice] = useState<SupplierInvoice | null>(null);
  const [selectedPOForInvoice, setSelectedPOForInvoice] = useState<PurchaseOrder | null>(null);
  const [invoiceFormData, setInvoiceFormData] = useState<Partial<SupplierInvoice> & { items?: InvoiceItem[] }>({
    items: []
  });
  const [matchResult, setMatchResult] = useState<{ matched: boolean; discrepancies: string[] } | null>(null);

  const handleInvoicePOChange = (poId: string) => {
    const po = supplierStorePurchaseOrders.find((p) => p.id === poId);
    if (!po) return;
    setSelectedPOForInvoice(po);
    const grn = goodsReceiptNotes.find(
      (g) => g.poId === po.id && (g.status === 'approved' || g.status === 'completed' || g.status === 'pending')
    );
    const items: InvoiceItem[] = po.items.map((item) => {
      const grnItem = grn?.items.find((gi) => gi.poItemId === item.id || gi.itemId === item.itemId);
      const qty = grnItem?.acceptedQuantity ?? grnItem?.receivedQuantity ?? item.quantity;
      const unitPrice = item.unitCost;
      return {
        id: `${Date.now()}-${item.id}`,
        poItemId: item.id,
        grnItemId: grnItem?.id,
        itemId: item.itemId,
        itemCode: item.itemCode,
        itemName: item.itemName,
        quantity: qty,
        unitPrice,
        totalPrice: qty * unitPrice,
      };
    });
    const subtotal = items.reduce((sum, i) => sum + i.totalPrice, 0);
    const taxAmount = Number(po.taxAmount || 0);
    const shippingAmount = Number(po.shippingAmount || 0);
    const discountAmount = Number(po.discountAmount || 0);
    setInvoiceFormData({
      supplierId: po.supplierId,
      supplierName: po.supplierName,
      poId: po.id,
      poNumber: po.poNumber,
      grnId: grn?.id,
      grnNumber: grn?.grnNumber,
      invoiceDate: new Date(),
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      items,
      subtotal,
      taxAmount,
      shippingAmount,
      discountAmount,
      totalAmount: subtotal + taxAmount + shippingAmount - discountAmount,
      currency: po.currency || 'GHS',
      status: 'pending',
      notes: '',
    });
  };

  const handleSaveInvoice = () => {
    if (!invoiceFormData.poId || !invoiceFormData.supplierId) {
      alert('Select a purchase order first.');
      return;
    }
    if (!invoiceFormData.items || invoiceFormData.items.length === 0) {
      alert('Invoice needs at least one line item.');
      return;
    }
    const created = createSupplierInvoice({
      supplierId: invoiceFormData.supplierId!,
      supplierName: invoiceFormData.supplierName || '',
      poId: invoiceFormData.poId!,
      poNumber: invoiceFormData.poNumber || '',
      grnId: invoiceFormData.grnId,
      grnNumber: invoiceFormData.grnNumber,
      invoiceDate: invoiceFormData.invoiceDate instanceof Date
        ? invoiceFormData.invoiceDate
        : new Date(invoiceFormData.invoiceDate || Date.now()),
      dueDate: invoiceFormData.dueDate instanceof Date
        ? invoiceFormData.dueDate
        : new Date(invoiceFormData.dueDate || Date.now() + 30 * 24 * 60 * 60 * 1000),
      items: invoiceFormData.items,
      subtotal: Number(invoiceFormData.subtotal || 0),
      taxAmount: Number(invoiceFormData.taxAmount || 0),
      shippingAmount: Number(invoiceFormData.shippingAmount || 0),
      discountAmount: Number(invoiceFormData.discountAmount || 0),
      totalAmount: Number(invoiceFormData.totalAmount || 0),
      currency: invoiceFormData.currency || 'GHS',
      status: 'pending',
      notes: invoiceFormData.notes,
      matchingStatus: {
        isQuantityMatched: false,
        isPriceMatched: false,
        isTermsMatched: false,
        discrepancies: [],
      },
    });
    trackEvent('Stores.Issued', { action: 'create_invoice', poNumber: created.poNumber, invoiceNumber: created.invoiceNumber });
    onInvoiceModalClose();
    setInvoiceFormData({ items: [] });
    setSelectedPOForInvoice(null);
    setEditingInvoice(null);
  };

  const handleRunThreeWayMatch = () => {
    if (!viewingInvoice) return;
    const result = performThreeWayMatch(viewingInvoice.id, currentUserName);
    setMatchResult(result);
    const refreshed = getSupplierInvoice(viewingInvoice.id);
    if (refreshed) setViewingInvoice(refreshed);
  };

  // Stock Operations State
  const [stockOpSubTab, setStockOpSubTab] = useState('goods-receipt');
  const [stockTransferSearchTerm, setStockTransferSearchTerm] = useState('');
  const [stockTransferFilterStatus, setStockTransferFilterStatus] = useState<string>('all');
  const [stockCountSearchTerm, setStockCountSearchTerm] = useState('');
  const [stockCountFilterStatus, setStockCountFilterStatus] = useState<string>('all');

  // Goods Receipt State
  const { isOpen: isGoodsReceiptOpen, onOpen: onGoodsReceiptOpen, onClose: onGoodsReceiptClose } = useDisclosure();
  const [selectedPOForReceipt, setSelectedPOForReceipt] = useState<PurchaseOrder | null>(null);
  const [receiptItems, setReceiptItems] = useState<Array<{
    itemId: string;
    itemCode: string;
    itemName: string;
    orderedQty: number;
    alreadyReceived: number;
    receiveNow: number;
    unitCost: number;
    batchNumber?: string;
    expiryDate?: Date;
    notes?: string;
  }>>([]);

  // Goods Issue State
  const { isOpen: isGoodsIssueOpen, onOpen: onGoodsIssueOpen, onClose: onGoodsIssueClose } = useDisclosure();
  const { isOpen: isGoodsIssueViewOpen, onOpen: onGoodsIssueViewOpen, onClose: onGoodsIssueViewClose } = useDisclosure();
  const [viewingGoodsIssue, setViewingGoodsIssue] = useState<GoodsIssue | null>(null);
  const [issueFormData, setIssueFormData] = useState<{ department: string; issuedTo: string; items: Array<{ itemId: string; itemCode: string; itemName: string; quantity: number; unitCost: number; reason?: string }>; notes?: string }>({
    department: '',
    issuedTo: '',
    items: [],
    notes: ''
  });

  // Temporary form state for transfers/counts (documents live in stockStore)
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
      createdBy: currentUserName
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
    createdBy: currentUserName
  });

  // Goods Receipt Handlers
  const handleOpenGoodsReceipt = (po: PurchaseOrder) => {
    setSelectedPOForReceipt(po);
    setReceiptItems(po.items.map((item) => {
      const already = item.receivedQuantity || 0;
      const remaining = Math.max(0, item.quantity - already);
      return {
        itemId: item.itemId,
        itemCode: item.itemCode,
        itemName: item.itemName,
        orderedQty: item.quantity,
        alreadyReceived: already,
        receiveNow: remaining,
        unitCost: item.unitCost,
        notes: ''
      };
    }));
    onGoodsReceiptOpen();
  };

  const handleReceiveGoods = () => {
    if (!selectedPOForReceipt) return;

    const itemsToReceive = receiptItems.filter((item) => item.receiveNow > 0);
    if (itemsToReceive.length === 0) {
      alert('Enter a Receive Now quantity for at least one line.');
      return;
    }

    const po = supplierStorePurchaseOrders.find((p) => p.id === selectedPOForReceipt.id);
    if (!po) {
      alert('Purchase Order not found');
      return;
    }

    const grnItems: GRNItem[] = itemsToReceive.map((receiptItem) => {
      const poItem = po.items.find((i) => i.itemId === receiptItem.itemId);
      return {
        id: Date.now().toString() + Math.random(),
        poItemId: poItem?.id || '',
        itemId: receiptItem.itemId,
        itemCode: receiptItem.itemCode,
        itemName: receiptItem.itemName,
        orderedQuantity: receiptItem.orderedQty,
        receivedQuantity: receiptItem.receiveNow,
        acceptedQuantity: receiptItem.receiveNow,
        rejectedQuantity: 0,
        unitCost: receiptItem.unitCost,
        totalValue: receiptItem.receiveNow * receiptItem.unitCost,
        batchNumber: receiptItem.batchNumber,
        expiryDate: receiptItem.expiryDate,
        qualityStatus: 'pending' as const,
        notes: receiptItem.notes
      };
    });

    const grn = createGRN({
      poId: selectedPOForReceipt.id,
      poNumber: selectedPOForReceipt.poNumber,
      supplierId: selectedPOForReceipt.supplierId,
      supplierName: selectedPOForReceipt.supplierName,
      receiptDate: new Date(),
      receivedBy: currentUserName,
      items: grnItems,
      totalItems: grnItems.length,
      totalValue: grnItems.reduce((sum, item) => sum + item.totalValue, 0),
      status: 'pending',
      notes: `Received goods for PO ${selectedPOForReceipt.poNumber}`
    });

    const updatedPoItems = po.items.map((poItem) => {
      const receiptItem = itemsToReceive.find((r) => r.itemId === poItem.itemId);
      if (!receiptItem || receiptItem.receiveNow <= 0) return poItem;
      return {
        ...poItem,
        receivedQuantity: (poItem.receivedQuantity || 0) + receiptItem.receiveNow,
      };
    });

    itemsToReceive.forEach((receiptItem) => {
      if (receiptItem.receiveNow <= 0) return;
      const additionalQty = receiptItem.receiveNow;

      updateStockLevel(receiptItem.itemId, additionalQty, 'add', receiptItem.unitCost);

      addStockMovement({
        itemId: receiptItem.itemId,
        itemCode: receiptItem.itemCode,
        itemName: receiptItem.itemName,
        movementType: 'in',
        quantity: additionalQty,
        unitCost: receiptItem.unitCost,
        totalValue: additionalQty * receiptItem.unitCost,
        toLocation: stockItems.find((i) => i.id === receiptItem.itemId)?.location || '',
        referenceType: 'purchase',
        referenceId: grn.id,
        referenceNumber: grn.grnNumber,
        batchNumber: receiptItem.batchNumber,
        expiryDate: receiptItem.expiryDate,
        performedBy: currentUserName,
        notes: receiptItem.notes || `Received from ${selectedPOForReceipt.poNumber} - GRN ${grn.grnNumber}`
      });
    });

    const allReceived = updatedPoItems.every((item) => (item.receivedQuantity || 0) >= item.quantity);
    updatePurchaseOrder(po.id, {
      items: updatedPoItems,
      status: allReceived ? 'delivered' : 'in-transit',
      ...(allReceived ? { actualDeliveryDate: new Date() } : {}),
    });

    onGoodsReceiptClose();
    // Open GRN details so QC can run immediately — without this the PO leaves the
    // receivable list and there is no inbox to resume quality check.
    setViewingGRN(grn);
    onGRNViewOpen();
    trackEvent('Stores.Issued', { action: 'goods_receipt', poNumber: selectedPOForReceipt.poNumber, grnNumber: grn.grnNumber });
  };

  const openQualityCheck = (grn: GoodsReceiptNote) => {
    setSelectedGRNForQC(grn);
    setQualityCheckFormData({
      grnId: grn.id,
      grnNumber: grn.grnNumber,
      poId: grn.poId,
      poNumber: grn.poNumber,
      supplierId: grn.supplierId,
      supplierName: grn.supplierName,
      checkedBy: currentUserName,
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
        qualityStatus: 'passed' as const
      }))
    });
    onQualityCheckOpen();
  };

  const handleSubmitQualityCheck = () => {
    if (!selectedGRNForQC || !qualityCheckFormData.items?.length) {
      alert('Nothing to check.');
      return;
    }
    const items = qualityCheckFormData.items.map((item: any) => {
      const failed = Math.max(0, Number(item.failedQuantity) || 0);
      const passed = Math.max(0, (Number(item.checkedQuantity) || 0) - failed);
      return {
        ...item,
        passedQuantity: passed,
        failedQuantity: failed,
        qualityStatus: (failed === 0 ? 'passed' : passed === 0 ? 'failed' : 'failed') as 'passed' | 'failed'
      };
    });
    const failedCount = items.filter((i: any) => i.failedQuantity > 0).length;
    const passedCount = items.length - failedCount;
    const overallStatus = failedCount === 0 ? 'passed' : passedCount === 0 ? 'failed' : 'partial';

    const check = createQualityCheck({
      grnId: selectedGRNForQC.id,
      grnNumber: selectedGRNForQC.grnNumber,
      poId: selectedGRNForQC.poId,
      poNumber: selectedGRNForQC.poNumber,
      supplierId: selectedGRNForQC.supplierId,
      supplierName: selectedGRNForQC.supplierName,
      checkedBy: currentUserName,
      checkedDate: new Date(),
      items,
      overallStatus: overallStatus as 'passed' | 'failed' | 'partial',
      passedItems: passedCount,
      failedItems: failedCount,
      totalItems: items.length,
      notes: qualityCheckFormData.notes
    });
    completeQualityCheck(check.id, currentUserName);
    const refreshed = getGRN(selectedGRNForQC.id);
    setViewingGRN(refreshed || {
      ...selectedGRNForQC,
      status: overallStatus === 'passed' ? 'quality-check' : 'rejected',
      qualityStatus: overallStatus as 'passed' | 'failed' | 'partial'
    });
    onQualityCheckClose();
    onGRNViewOpen();
    trackEvent('Stores.Issued', { action: 'quality_check', grnNumber: selectedGRNForQC.grnNumber });
  };

  // Goods Issue Handlers
  const [issueSearchTerm, setIssueSearchTerm] = useState('');
  const [issueItemSearchTerms, setIssueItemSearchTerms] = useState<Record<number, string>>({});

  const handleOpenGoodsIssue = () => {
    setIssueFormData({ department: '', issuedTo: currentUserName, items: [], notes: '' });
    setIssueItemSearchTerms({});
    onGoodsIssueOpen();
  };

  const handleAddIssueItem = () => {
    setIssueFormData({
      ...issueFormData,
      items: [...issueFormData.items, {
        itemId: '',
        itemCode: '',
        itemName: '',
        quantity: 1,
        unitCost: 0
      }]
    });
  };

  const getFilteredIssueItems = (index: number) => {
    const searchTerm = (issueItemSearchTerms[index] || '').toLowerCase();
    const list = stockItems.filter((i) => i.isActive !== false && i.currentStock > 0);
    if (!searchTerm) return list.slice(0, 20);
    return list.filter((item) =>
      item.itemCode.toLowerCase().includes(searchTerm) ||
      item.name.toLowerCase().includes(searchTerm)
    ).slice(0, 20);
  };

  const handleIssueGoods = () => {
    if (!issueFormData.department || !issueFormData.issuedTo || issueFormData.items.length === 0) {
      alert('Please fill all required fields and add at least one item');
      return;
    }
    const lines = issueFormData.items.filter((i) => i.itemId && i.quantity > 0);
    if (lines.length === 0) {
      alert('Add at least one item with a quantity.');
      return;
    }
    for (const item of lines) {
      const stockItem = stockItems.find((i) => i.id === item.itemId);
      if (!stockItem) {
        alert(`Item ${item.itemCode} not found`);
        return;
      }
      if (stockItem.currentStock < item.quantity) {
        alert(`Insufficient stock for ${item.itemName}. Available: ${stockItem.currentStock}`);
        return;
      }
    }

    const issueNumber = settings.getNextModuleNumber('inventory', 'goodsIssue');
    const issueId = Date.now().toString();
    const issueItems = lines.map((item) => ({
      id: `${issueId}-${item.itemId}`,
      itemId: item.itemId,
      itemCode: item.itemCode,
      itemName: item.itemName,
      quantity: item.quantity,
      unitCost: item.unitCost || stockItems.find((i) => i.id === item.itemId)?.unitCost || 0,
      totalValue: item.quantity * (item.unitCost || stockItems.find((i) => i.id === item.itemId)?.unitCost || 0),
      reason: item.reason,
    }));

    lines.forEach((item) => {
      const stockItem = stockItems.find((i) => i.id === item.itemId)!;
      updateStockLevel(item.itemId, item.quantity, 'remove');
      addStockMovement({
        itemId: item.itemId,
        itemCode: item.itemCode,
        itemName: item.itemName,
        movementType: 'out',
        quantity: item.quantity,
        unitCost: item.unitCost || stockItem.unitCost,
        totalValue: item.quantity * (item.unitCost || stockItem.unitCost),
        fromLocation: stockItem.location,
        referenceType: 'adjustment',
        referenceId: issueId,
        referenceNumber: issueNumber,
        reason: item.reason || `Issued to ${issueFormData.department}`,
        performedBy: currentUserName,
        notes: `Issued to ${issueFormData.issuedTo} — ${issueFormData.department}.${issueFormData.notes ? ` ${issueFormData.notes}` : ''}`,
      });
    });

    upsertGoodsIssue({
      id: issueId,
      issueNumber,
      department: issueFormData.department,
      issuedTo: issueFormData.issuedTo,
      issueDate: new Date(),
      status: 'issued',
      totalItems: issueItems.length,
      totalValue: issueItems.reduce((sum, i) => sum + i.totalValue, 0),
      items: issueItems,
      notes: issueFormData.notes,
      issuedBy: currentUserName,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    onGoodsIssueClose();
    setIssueFormData({ department: '', issuedTo: '', items: [], notes: '' });
    setIssueItemSearchTerms({});
    trackEvent('Stores.Issued', { action: 'goods_issue', department: issueFormData.department, issueNumber });
  };

  // Stock Transfer Handlers
  const generateTransferNumber = () => {
    return settings.getNextModuleNumber('inventory', 'stockTransfer');
  };

  const applyTransferStock = (transferData: StockTransfer) => {
    for (const item of transferData.items) {
      const stockItem = stockItems.find((i) => i.id === item.itemId);
      if (!stockItem) continue;
      if (stockItem.location !== transferData.fromLocation) {
        alert(`${item.itemName} is not at ${transferData.fromLocation} (currently ${stockItem.location || 'unassigned'}).`);
        return false;
      }
      if (stockItem.currentStock < item.quantity) {
        alert(`Insufficient stock for ${item.itemName} at ${transferData.fromLocation}. Available: ${stockItem.currentStock}, requested: ${item.quantity}`);
        return false;
      }
      // Single-location SKU model: relocate the item. Qty stays on hand (still hotel stock).
      // Do NOT remove qty — that was wiping on-hand on every delivery.
      updateStockItem(item.itemId, { location: transferData.toLocation });
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
        notes: item.notes || `Transferred from ${transferData.fromLocation} to ${transferData.toLocation}`,
      });
    }
    return true;
  };

  const [transferItemSearchTerms, setTransferItemSearchTerms] = useState<Record<number, string>>({});

  const getFilteredTransferItems = (index: number) => {
    const searchTerm = (transferItemSearchTerms[index] || '').toLowerCase();
    const from = stockTransferFormData.fromLocation;
    const list = stockItems.filter((i) =>
      i.isActive !== false &&
      i.currentStock > 0 &&
      (!from || i.location === from)
    );
    if (!searchTerm) return list.slice(0, 20);
    return list.filter((item) =>
      item.itemCode.toLowerCase().includes(searchTerm) ||
      item.name.toLowerCase().includes(searchTerm)
    ).slice(0, 20);
  };

  const handleAddStockTransfer = () => {
    setEditingStockTransfer(null);
    setTransferItemSearchTerms({});
    setStockTransferFormData({
      transferNumber: settings.peekNextModuleNumber('inventory', 'stockTransfer'),
      fromLocation: '',
      toLocation: '',
      transferDate: new Date(),
      expectedDeliveryDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      status: 'pending',
      priority: 'medium',
      totalItems: 0,
      totalValue: 0,
      items: [],
      createdBy: currentUserName
    });
    onStockTransferOpen();
  };

  const handleSaveStockTransfer = () => {
    if (!stockTransferFormData.fromLocation || !stockTransferFormData.toLocation || !stockTransferFormData.items || stockTransferFormData.items.length === 0) {
      alert('Please fill all required fields and add at least one item');
      return;
    }
    if (stockTransferFormData.fromLocation === stockTransferFormData.toLocation) {
      alert('From and To locations must be different.');
      return;
    }
    const lines = stockTransferFormData.items.filter((i) => i.itemId && i.quantity > 0);
    if (lines.length === 0) {
      alert('Add at least one item with a quantity.');
      return;
    }

    const transferData: StockTransfer = {
      id: editingStockTransfer?.id || Date.now().toString(),
      transferNumber: editingStockTransfer
        ? (stockTransferFormData.transferNumber || editingStockTransfer.transferNumber)
        : generateTransferNumber(),
      fromLocation: stockTransferFormData.fromLocation,
      toLocation: stockTransferFormData.toLocation,
      transferDate: stockTransferFormData.transferDate || new Date(),
      expectedDeliveryDate: stockTransferFormData.expectedDeliveryDate || new Date(),
      status: stockTransferFormData.status || 'pending',
      priority: stockTransferFormData.priority || 'medium',
      totalItems: lines.length,
      totalValue: lines.reduce((sum, item) => sum + item.totalValue, 0),
      items: lines,
      notes: stockTransferFormData.notes,
      createdBy: stockTransferFormData.createdBy || currentUserName,
      createdAt: editingStockTransfer?.createdAt || new Date(),
      updatedAt: new Date()
    };

    if (transferData.status === 'delivered') {
      if (!applyTransferStock(transferData)) return;
      transferData.actualDeliveryDate = new Date();
    }

    upsertStockTransfer(transferData);
    onStockTransferClose();
    trackEvent('Stores.Issued', { action: editingStockTransfer ? 'update_stock_transfer' : 'create_stock_transfer', transferNumber: transferData.transferNumber });
  };

  const handleTransferStatusChange = (transfer: StockTransfer, status: StockTransfer['status']) => {
    let updated: StockTransfer = { ...transfer, status, updatedAt: new Date() };
    if (status === 'delivered' && transfer.status !== 'delivered') {
      if (!applyTransferStock(updated)) return;
      updated = { ...updated, actualDeliveryDate: new Date() };
    }
    upsertStockTransfer(updated);
    setViewingStockTransfer(updated);
    trackEvent('Stores.Issued', { action: 'update_stock_transfer_status', transferNumber: transfer.transferNumber, status });
  };

  // Stock Count Handlers
  const generateCountNumber = () => settings.getNextModuleNumber('inventory', 'stockCount');

  const handleAddStockCount = () => {
    setEditingStockCount(null);
    setStockCountFormData({
      countNumber: settings.peekNextModuleNumber('inventory', 'stockCount'),
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
      createdBy: currentUserName
    });
    onStockCountOpen();
  };

  const handleSaveStockCount = () => {
    if (!stockCountFormData.location || !stockCountFormData.items || stockCountFormData.items.length === 0) {
      alert('Select a location so items can load for counting.');
      return;
    }
    const countData: StockCount = {
      id: editingStockCount?.id || Date.now().toString(),
      countNumber: editingStockCount
        ? (stockCountFormData.countNumber || editingStockCount.countNumber)
        : generateCountNumber(),
      countType: stockCountFormData.countType || 'full',
      location: stockCountFormData.location,
      startDate: stockCountFormData.startDate || new Date(),
      status: 'in-progress',
      totalItems: stockCountFormData.items.length,
      countedItems: stockCountFormData.items.filter((i) => i.countedQuantity >= 0).length,
      varianceItems: stockCountFormData.items.filter((i) => i.variance !== 0).length,
      totalValue: stockCountFormData.items.reduce((sum, i) => sum + (i.expectedQuantity * i.unitCost), 0),
      varianceValue: stockCountFormData.items.reduce((sum, i) => sum + Math.abs(i.varianceValue), 0),
      items: stockCountFormData.items,
      notes: stockCountFormData.notes,
      createdBy: stockCountFormData.createdBy || currentUserName,
      createdAt: editingStockCount?.createdAt || new Date(),
      updatedAt: new Date()
    };
    if (editingStockCount) {
      upsertStockCount(countData);
      setViewingStockCount(countData);
    } else {
      upsertStockCount(countData);
    }
    onStockCountClose();
    trackEvent('Stores.Issued', { action: editingStockCount ? 'update_stock_count' : 'create_stock_count', countNumber: countData.countNumber });
  };

  const handleCompleteStockCount = async (count: StockCount) => {
    if (!count.items || count.items.length === 0) {
      alert('No items counted');
      return;
    }

    // count.location can be a granular sub-location (e.g. "Kitchen Fridge"),
    // not just the 3 canonical department names in DEPARTMENT_LOCATIONS, so
    // resolve via the real StockLocation record's department field first —
    // matching by name alone against those 3 entries missed every specific
    // fridge/store location and silently fell back to the legacy path.
    const masterLoc = masterLocations.find((l) => l.name === count.location);
    const deptEntry = (masterLoc?.department && DEPARTMENT_LOCATIONS[masterLoc.department])
      ? [masterLoc.department, DEPARTMENT_LOCATIONS[masterLoc.department]] as const
      : Object.entries(DEPARTMENT_LOCATIONS).find(([, loc]) => loc.name === count.location);

    if (deptEntry) {
      try {
        const res = await fetch('/api/inventory/stock-counts/complete', {
          method: 'POST',
          headers: inventoryHeaders(),
          body: JSON.stringify({
            id: count.id,
            department: deptEntry[0],
            performedBy: count.performedBy || currentUserName,
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          alert(data.error || 'Could not complete count');
          return;
        }
        const updatedCount: StockCount = {
          ...count,
          status: 'completed',
          endDate: new Date(),
          varianceItems: count.items.filter((i) => i.variance !== 0).length,
          varianceValue: count.items.reduce((sum, i) => sum + Math.abs(i.varianceValue), 0),
          updatedAt: new Date(),
        };
        upsertStockCount(updatedCount);
        setViewingStockCount(updatedCount);
        trackEvent('Stores.Issued', { action: 'complete_stock_count', countNumber: count.countNumber });
      } catch {
        alert('Could not complete count');
      }
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
            performedBy: count.performedBy || currentUserName,
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

    upsertStockCount(updatedCount);
    setViewingStockCount(updatedCount);
    trackEvent('Stores.Issued', { action: 'complete_stock_count', countNumber: count.countNumber });
  };

  const handlePrintStockCount = (count: StockCount) => {
    const esc = (s: unknown) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const money = (n: number) => `₵${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const fmtDate = (d: Date | string | undefined) => {
      if (!d) return '—';
      const val = d instanceof Date ? d : new Date(d);
      return val.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    };
    const company = settings.companySettings;
    const companyName = company?.tradingName || company?.legalName || settings.tenant?.name || 'Hotel';

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Stock Count ${esc(count.countNumber)}</title>
          <style>
            body { font-family: Arial, Helvetica, sans-serif; color: #1a1a1a; padding: 32px 40px; font-size: 13px; }
            h1 { margin: 0 0 4px; font-size: 22px; }
            .meta { color: #555; margin-bottom: 20px; }
            .meta span { margin-right: 16px; }
            table { width: 100%; border-collapse: collapse; margin-top: 12px; }
            th { background: #1a1a1a; color: #fff; text-align: left; padding: 8px 10px; font-size: 12px; }
            td { padding: 8px 10px; border-bottom: 1px solid #eee; }
            th:nth-child(n+3), td:nth-child(n+3) { text-align: right; }
            .totals { margin-top: 16px; display: flex; justify-content: flex-end; }
            .totals table td { border: none; padding: 4px 8px; }
            .neg { color: #b91c1c; }
            .pos { color: #15803d; }
          </style>
        </head>
        <body>
          <h1>Stock Count</h1>
          <div class="meta">
            <div><strong>${esc(companyName)}</strong></div>
            <span>#${esc(count.countNumber)}</span>
            <span>${esc(count.countType)}</span>
            <span>${esc(count.location)}</span>
            <span>${esc(count.status)}</span>
            <span>Started ${esc(fmtDate(count.startDate))}</span>
            ${count.endDate ? `<span>Ended ${esc(fmtDate(count.endDate))}</span>` : ''}
          </div>
          <table>
            <thead>
              <tr>
                <th>Code</th>
                <th>Item</th>
                <th>Expected</th>
                <th>Counted</th>
                <th>Variance</th>
                <th>Variance Value</th>
              </tr>
            </thead>
            <tbody>
              ${count.items.map((item) => `
                <tr>
                  <td>${esc(item.itemCode)}</td>
                  <td>${esc(item.itemName)}</td>
                  <td>${esc(item.expectedQuantity)}</td>
                  <td>${esc(item.countedQuantity)}</td>
                  <td class="${item.variance < 0 ? 'neg' : item.variance > 0 ? 'pos' : ''}">${item.variance > 0 ? '+' : ''}${esc(item.variance)}</td>
                  <td>${money(Math.abs(item.varianceValue))}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <div class="totals">
            <table>
              <tr><td>Total items</td><td>${esc(count.totalItems)}</td></tr>
              <tr><td>Variance lines</td><td>${esc(count.varianceItems)}</td></tr>
              <tr><td>Stock value</td><td>${money(count.totalValue)}</td></tr>
              <tr><td><strong>Variance value</strong></td><td><strong>${money(count.varianceValue)}</strong></td></tr>
            </table>
          </div>
          ${count.notes ? `<p style="margin-top:24px;color:#555"><strong>Notes:</strong> ${esc(count.notes)}</p>` : ''}
        </body>
      </html>
    `;
    openHtmlPrintWindow(html);
    trackEvent('Stores.Issued', { action: 'print_stock_count', countNumber: count.countNumber });
  };

  const handleEditStockCountFromView = (count: StockCount) => {
    onStockCountViewClose();
    setEditingStockCount(count);
    setStockCountFormData({ ...count, items: count.items });
    onStockCountOpen();
  };

  const handleVoidStockCount = async (count: StockCount) => {
    if (count.status === 'completed') {
      alert('Completed counts cannot be voided — stock was already adjusted.');
      return;
    }
    if (count.status === 'cancelled') return;
    const { confirmVoid } = await import('./DangerConfirm');
    if (!(await confirmVoid(count.countNumber, 'The count stays on file as Void and will be marked cancelled. Completed counts that already adjusted stock cannot be voided.'))) return;
    const updated: StockCount = {
      ...count,
      status: 'cancelled',
      endDate: new Date(),
      updatedAt: new Date(),
    };
    upsertStockCount(updated);
    setViewingStockCount(updated);
    trackEvent('Stores.Issued', { action: 'void_stock_count', countNumber: count.countNumber });
  };

  const handleDeleteStockCount = async (count: StockCount) => {
    if (count.status === 'completed') {
      alert('Completed counts cannot be deleted — stock was already adjusted.');
      return;
    }
    const { confirmDelete } = await import('./DangerConfirm');
    if (!(await confirmDelete(count.countNumber, 'This stock count will be permanently removed. This cannot be undone.'))) return;
    deleteStockCount(count.id);
    setViewingStockCount(null);
    onStockCountViewClose();
    trackEvent('Stores.Issued', { action: 'delete_stock_count', countNumber: count.countNumber });
  };

  // Locations come from Settings → Stock Locations (seeded defaults + hotel edits).
  const availableLocations = useMemo(() => {
    const fromMaster = masterLocations.map((loc) => loc.name);
    if (fromMaster.length > 0) return fromMaster;
    const locSet = new Set<string>();
    stockItems.forEach((item) => {
      if (item.location) locSet.add(item.location);
    });
    return Array.from(locSet);
  }, [masterLocations, stockItems]);

  const departments = ['Kitchen', 'Restaurant & Bar', 'Housekeeping', 'Maintenance', 'Front Office', 'Accounting', 'Other'];

  // Render Invoice Management Function
  

  // Render Stock Operations Function — receive + recon only
  

  

  

    const inventoryScreen = {
    STOCK_CATEGORIES,
    accountingSuppliers,
    approveGRN,
    approveInvoice,
    availableLocations,
    canActOnRequisitions,
    canDeleteInventoryDocs,
    canEditInventoryDocs,
    canEditProcessedRequisitions,
    canPrintInventoryDocs,
    canRunStockCount,
    canVoidInventoryDocs,
    cancelPurchaseOrder,
    categories,
    closeReqAction,
    computePOTax,
    computePOTaxLines,
    confirmPurchaseOrder,
    confirmReqAction,
    countCols,
    countPage,
    countSort,
    currentUserName,
    deletePurchaseOrder,
    departments,
    editingInvoice,
    editingItem,
    editingPO,
    editingRequisition,
    editingStockCount,
    editingStockTransfer,
    editingSupplier,
    filterCategory,
    filterLocation,
    filterStatus,
    formData,
    generateNextInvoiceNumber,
    getCategoryColor,
    getFilteredIssueItems,
    getFilteredItemsForIndex,
    getFilteredPOItemsForIndex,
    getFilteredTransferItems,
    getGRN,
    getStockStatus,
    getVendorsForRequisitionLine,
    goodsIssues,
    goodsReceiptNotes,
    handleAddIssueItem,
    handleAddItem,
    handleAddPO,
    handleAddPOItem,
    handleAddRequisition,
    handleAddRequisitionItem,
    handleAddStockCount,
    handleAddStockTransfer,
    handleAddSupplier,
    handleCompleteStockCount,
    handleDeleteItem,
    handleDeleteStockCount,
    handleDeleteSupplier,
    handleEditItem,
    handleEditPO,
    handleEditRequisition,
    handleEditStockCountFromView,
    handleEditSupplier,
    handleGeneratePOPDF,
    handleGenerateRequisitionPDF,
    handleInvoicePOChange,
    handleIssueGoods,
    handleOpenGoodsIssue,
    handleOpenGoodsReceipt,
    handlePOItemChange,
    handlePOSupplierChange,
    handlePrintStockCount,
    handleReceiveGoods,
    handleRemovePOItem,
    handleRemoveRequisitionItem,
    handleRequisitionItemChange,
    handleRunThreeWayMatch,
    handleSaveInvoice,
    handleSaveItem,
    handleSavePO,
    handleSaveRequisition,
    handleSaveStockCount,
    handleSaveStockTransfer,
    handleSaveSupplier,
    handleSubmitQualityCheck,
    handleTransferStatusChange,
    handleUpdatePOItem,
    handleUpdateRequisitionItem,
    handleViewItem,
    handleViewPO,
    handleViewRequisition,
    handleViewSupplier,
    handleVoidStockCount,
    inventoryLocations,
    invoiceCols,
    invoiceFilterStatus,
    invoiceFormData,
    invoicePage,
    invoiceRowsPerPage,
    invoiceSearchTerm,
    invoiceSort,
    isGRNViewOpen,
    isGoodsIssueOpen,
    isGoodsIssueViewOpen,
    isGoodsReceiptOpen,
    isInvoiceModalOpen,
    isInvoiceViewOpen,
    isOpen,
    isPOModalOpen,
    isPOViewOpen,
    isQualityCheckOpen,
    isRequisitionModalOpen,
    isRequisitionViewOpen,
    isStockCountOpen,
    isStockCountViewOpen,
    isStockTransferOpen,
    isStockTransferViewOpen,
    isSupplierModalOpen,
    isThreeWayMatchOpen,
    issueCols,
    issueFormData,
    issueItemSearchTerms,
    issuePage,
    issueSearchTerm,
    issueSort,
    itemCols,
    itemSearchTerms,
    itemSort,
    markDelivered,
    markInTransit,
    markInvoicePaid,
    masterLocations,
    matchResult,
    mergedSuppliers,
    onClose,
    onGRNViewClose,
    onGRNViewOpen,
    onGoodsIssueClose,
    onGoodsIssueViewClose,
    onGoodsIssueViewOpen,
    onGoodsReceiptClose,
    onInvoiceModalClose,
    onInvoiceModalOpen,
    onInvoiceViewClose,
    onInvoiceViewOpen,
    onPOModalClose,
    onPOViewClose,
    onQualityCheckClose,
    onRequisitionModalClose,
    onRequisitionViewClose,
    onStockCountClose,
    onStockCountViewClose,
    onStockCountViewOpen,
    onStockTransferClose,
    onStockTransferOpen,
    onStockTransferViewClose,
    onStockTransferViewOpen,
    onSupplierModalClose,
    onThreeWayMatchClose,
    onThreeWayMatchOpen,
    openQualityCheck,
    openReqAction,
    pageSafe,
    pages,
    paginatedItems,
    paginatedPOs,
    paginatedRequisitions,
    paginatedSuppliers,
    poCols,
    poFilterStatus,
    poFormData,
    poItemSearchTerms,
    poPageSafe,
    poPages,
    poSearchTerm,
    poSort,
    qualityCheckFormData,
    receiptCols,
    receiptItems,
    receiptPage,
    receiptSort,
    rejectGRN,
    rejectInvoice,
    reqActionModal,
    reqConvertSuppliers,
    reqRejectReason,
    requisitionCols,
    requisitionFilterStatus,
    requisitionFormData,
    requisitionPageSafe,
    requisitionPages,
    requisitionSearchTerm,
    requisitionSort,
    searchTerm,
    selectedGRNForQC,
    selectedPOForReceipt,
    selectedTab,
    sendPurchaseOrder,
    setCountPage,
    setCountSort,
    setEditingInvoice,
    setEditingStockTransfer,
    setFilterCategory,
    setFilterLocation,
    setFilterStatus,
    setFormData,
    setInvoiceFilterStatus,
    setInvoiceFormData,
    setInvoicePage,
    setInvoiceSearchTerm,
    setInvoiceSort,
    setIssueFormData,
    setIssueItemSearchTerms,
    setIssuePage,
    setIssueSearchTerm,
    setIssueSort,
    setItemSearchTerms,
    setItemSort,
    setMatchResult,
    setPOFilterStatus,
    setPOFormData,
    setPOItemSearchTerms,
    setPOPage,
    setPOSearchTerm,
    setPOSort,
    setPage,
    setQualityCheckFormData,
    setReceiptItems,
    setReceiptPage,
    setReceiptSort,
    setReqConvertSuppliers,
    setReqRejectReason,
    setRequisitionFilterStatus,
    setRequisitionFormData,
    setRequisitionPage,
    setRequisitionSearchTerm,
    setRequisitionSort,
    setSearchTerm,
    setSelectedPOForInvoice,
    setStockCountFilterStatus,
    setStockCountFormData,
    setStockCountSearchTerm,
    setStockOpSubTab,
    setStockTransferFilterStatus,
    setStockTransferFormData,
    setStockTransferSearchTerm,
    setSupplierFilterCategory,
    setSupplierFilterPaymentTerms,
    setSupplierFilterStatus,
    setSupplierFormData,
    setSupplierPage,
    setSupplierSearchTerm,
    setSupplierSort,
    setSupplierViewOpen,
    setTransferItemSearchTerms,
    setTransferPage,
    setTransferSort,
    setViewOpen,
    setViewingGRN,
    setViewingGoodsIssue,
    setViewingInvoice,
    setViewingPO,
    setViewingStockCount,
    setViewingStockTransfer,
    stockCountFilterStatus,
    stockCountFormData,
    stockCountSearchTerm,
    stockCounts,
    stockItems,
    stockOpSubTab,
    stockTransferFilterStatus,
    stockTransferFormData,
    stockTransferSearchTerm,
    stockTransfers,
    supplierCategories,
    supplierCols,
    supplierFilterCategory,
    supplierFilterPaymentTerms,
    supplierFilterStatus,
    supplierFormData,
    supplierInvoices,
    supplierPageSafe,
    supplierPages,
    supplierSearchTerm,
    supplierSort,
    supplierStorePurchaseOrders,
    supplierStoreRequisitions,
    supplierViewOpen,
    taxOptions,
    transferCols,
    transferItemSearchTerms,
    transferPage,
    transferSort,
    updateGRN,
    updateStockLevel,
    updateSupplierInvoice,
    upsertGoodsIssue,
    viewOpen,
    viewingGRN,
    viewingGoodsIssue,
    viewingInvoice,
    viewingItem,
    viewingPO,
    viewingRequisition,
    viewingStockCount,
    viewingStockTransfer,
  };

  return (
    <InventoryScreenProvider value={inventoryScreen as InventoryScreen}>
    <div className={embedded ? undefined : 'p-6'}>
      {!embedded && (
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-ghana-black">Stock & Supply</h1>
          <p className="text-gray-600 text-sm">
            Items, suppliers, requisitions, POs, transfers, issues — then receive & reconcile.
          </p>
        </div>
      )}

      <Tabs 
        selectedKey={selectedTab} 
        onSelectionChange={(key) => {
          const tab = String(key);
          setSelectedTab(tab);
          // Keep recon sub-tab on a receive-related default when opening Recon
          if (tab === 'stock-operations' && !['goods-receipt', 'stock-counts'].includes(stockOpSubTab)) {
            setStockOpSubTab('goods-receipt');
          }
        }}
        className="w-full"
        size="sm"
        variant="solid"
        classNames={deskBookTabsClassNames}
        aria-label="Stock and supply sections"
      >
        <Tab key="inventory" title="📦 Items" />
        <Tab key="suppliers" title="🏢 Suppliers" />
        <Tab key="requisitions" title="📝 Requisitions" />
        <Tab key="purchase-orders" title="📋 Purchase Orders" />
        <Tab key="transfers" title="🔄 Transfers" />
        <Tab key="goods-issue" title="📤 Issues" />
        <Tab key="supplier-invoices" title="🧾 Invoices" />
        <Tab key="stock-operations" title="✅ Receive & Recon" />
      </Tabs>

      <div className={deskBookTabPanelClassName}>
        {selectedTab === 'inventory' && <ItemsTable />}
        {selectedTab === 'suppliers' && <SuppliersTable />}
        {selectedTab === 'requisitions' && <RequisitionsTable />}
        {selectedTab === 'purchase-orders' && <PurchaseOrdersTable />}
        {selectedTab === 'transfers' && <TransfersTable />}
        {selectedTab === 'goods-issue' && <GoodsIssueTable />}
        {selectedTab === 'supplier-invoices' && <SupplierInvoicesTable />}
        {selectedTab === 'stock-operations' && <ReceiveAndReconTable />}
      </div>
      
      <ItemModals />

      <SupplierModals />

      <PurchaseOrderModals />

      <RequisitionModals />

      <GoodsReceiptModals />

      <GoodsIssueModals />

      <StockTransferModal />

      <StockCountModal />

      <StockTransferViewModal />

      <StockCountViewModal />


      <SupplierInvoiceModals />

    </div>
    </InventoryScreenProvider>
  );
}
