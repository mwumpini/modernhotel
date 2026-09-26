'use client';

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
  // Requisition action gates — mirrors the server-side requirePermission() checks in
  // /api/inventory/requisitions, so a user who can't act just doesn't see the button
  // rather than clicking it and hitting a 403 with no explanation.
  const canActOnRequisitions = settings.hasPermission('inventory.approve-requisition');
  const canEditProcessedRequisitions = settings.hasPermission('inventory.edit-processed-requisition');

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
    requestedBy: currentUserName
  });
  const [requisitionSearchTerm, setRequisitionSearchTerm] = useState('');
  const [requisitionFilterStatus, setRequisitionFilterStatus] = useState<string>('all');
  const [requisitionPage, setRequisitionPage] = useState(1);

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
  const requisitionRowsPerPage = 10;

  // Empty placeholder removed — Overview tab no longer used.

  const renderInventoryManagement = () => {
    return (
    <div className="space-y-6">
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
              <h3 className="text-xl font-semibold text-ghana-black">📦 Stock Items</h3>
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
            <Table aria-label="Stock items table" classNames={{ table: "min-w-[960px]", th: "whitespace-nowrap" }}>
            <TableHeader>
                <TableColumn className="w-[110px]">CODE</TableColumn>
                <TableColumn className="min-w-[200px]">ITEM</TableColumn>
                <TableColumn className="w-[110px]">CATEGORY</TableColumn>
                <TableColumn className="w-[70px]">UNIT</TableColumn>
                <TableColumn className="w-[120px] text-right">ON HAND</TableColumn>
                <TableColumn className="w-[80px] text-right">REORDER</TableColumn>
                <TableColumn className="w-[100px] text-right">UNIT COST</TableColumn>
                <TableColumn className="min-w-[120px]">LOCATION</TableColumn>
                <TableColumn className="w-[100px]">STATUS</TableColumn>
                <TableColumn className="w-[70px]">ACTIONS</TableColumn>
            </TableHeader>
              <TableBody emptyContent="No stock items found.">
                {paginatedItems.map((item) => {
                  const stockStatus = getStockStatus(item);
                  const onHand = Number(item.currentStock || 0);
                  const maxStock = Number(item.maximumStock || 0);
                  const reorder = Number(item.reorderPoint || 0);
                  const barMax = maxStock > 0 ? maxStock : Math.max(reorder * 2, onHand, 1);
                  const stockPercentage = Math.min(100, (onHand / barMax) * 100);
                  const stockColor =
                    onHand <= reorder ? 'danger' :
                    onHand <= reorder * 1.5 ? 'warning' :
                    'success';
                  const stockText =
                    stockColor === 'danger' ? 'text-red-600' :
                    stockColor === 'warning' ? 'text-orange-600' :
                    'text-green-600';
                  return (
                <TableRow key={item.id}>
                      <TableCell>
                        <span className="font-mono text-sm font-semibold text-blue-700 whitespace-nowrap" title={item.itemCode}>
                          {item.itemCode}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="min-w-0 max-w-[260px]">
                          <div className="font-semibold text-ghana-black truncate" title={item.name}>{item.name}</div>
                          {item.description ? (
                            <div className="text-xs text-gray-500 truncate" title={item.description}>{item.description}</div>
                          ) : null}
                        </div>
                      </TableCell>
                  <TableCell>
                    <Chip
                          color={getCategoryColor(item.category)}
                      size="sm"
                      variant="flat"
                      className="capitalize"
                    >
                      {item.category}
                    </Chip>
                  </TableCell>
                  <TableCell>
                        <span className="text-sm font-medium whitespace-nowrap">{item.unit || '—'}</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col items-end gap-0.5">
                          <div className={`font-semibold tabular-nums ${stockText}`}>
                            {onHand.toLocaleString()}
                          </div>
                          <Progress
                            aria-label={`${item.name} stock level`}
                            value={stockPercentage}
                            size="sm"
                            color={stockColor}
                            className="w-16"
                          />
                          {maxStock > 0 && (
                            <div className="text-[10px] text-gray-500 tabular-nums">Max {maxStock.toLocaleString()}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="font-medium text-slate-700 tabular-nums">{reorder}</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="font-semibold text-blue-600 tabular-nums whitespace-nowrap">₵{Number(item.unitCost || 0).toLocaleString()}</span>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm truncate max-w-[140px]" title={item.location || undefined}>{item.location || '—'}</div>
                        {item.binLocation && (
                          <div className="text-xs text-gray-500 truncate">Bin: {item.binLocation}</div>
                        )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1 items-start">
                    <Badge
                          color={stockStatus.color as any}
                      size="sm"
                          variant="flat"
                    >
                          {stockStatus.label}
                    </Badge>
                        {item.isPerishable && (
                          <Chip size="sm" variant="flat" color="warning">
                            🍃 Perishable
                          </Chip>
                        )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Tooltip content="Review — then edit or delete">
                      <Button
                        size="sm"
                        variant="flat"
                        color="primary"
                        onClick={() => handleViewItem(item)}
                      >
                        👁️
                      </Button>
                    </Tooltip>
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
          setStockOpSubTab(op);
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

  const supplierPages = Math.ceil(filteredSuppliers.length / supplierRowsPerPage);
  const paginatedSuppliers = useMemo(() => {
    const start = (supplierPage - 1) * supplierRowsPerPage;
    return filteredSuppliers.slice(start, start + supplierRowsPerPage);
  }, [filteredSuppliers, supplierPage]);

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

  const poPages = Math.ceil(filteredPOs.length / poRowsPerPage);
  const paginatedPOs = useMemo(() => {
    const start = (poPage - 1) * poRowsPerPage;
    return filteredPOs.slice(start, start + poRowsPerPage);
  }, [filteredPOs, poPage]);

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
              <h3 className="text-xl font-semibold text-ghana-black">🤝 Suppliers</h3>
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
                <TableColumn>SUPPLIER</TableColumn>
                <TableColumn>CONTACT</TableColumn>
                <TableColumn>ADDRESS</TableColumn>
                <TableColumn>SUPPLIES</TableColumn>
                <TableColumn>TERMS</TableColumn>
                <TableColumn>STATUS</TableColumn>
                <TableColumn>ACTIONS</TableColumn>
              </TableHeader>
              <TableBody emptyContent="No suppliers found.">
                {paginatedSuppliers.map((supplier) => (
                  <TableRow key={supplier.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-semibold text-blue-700">{supplier.code}</span>
                        {accountingSuppliers.some(bp => bp.id === supplier.id || bp.code === supplier.code) && (
                          <Tooltip content="Linked to Accounting">
                            <Badge color="success" size="sm" variant="flat">💼</Badge>
                          </Tooltip>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-semibold text-ghana-black">{supplier.name}</div>
                      {supplier.email && (
                        <div className="text-xs text-gray-500 truncate max-w-[160px]">{supplier.email}</div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm font-medium">{supplier.contactPerson || '—'}</div>
                      <div className="text-xs text-gray-500">{supplier.phone || supplier.email || ''}</div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm max-w-[180px]">
                        {supplier.address ? (
                          <>
                            <div className="truncate" title={supplier.address}>{supplier.address}</div>
                            {(supplier.city || supplier.country) && (
                              <div className="text-xs text-gray-500">
                                {[supplier.city, supplier.country].filter(Boolean).join(', ')}
                              </div>
                            )}
                          </>
                        ) : (
                          <span className="text-gray-400">{supplier.city || '—'}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1 max-w-[160px]">
                        {(supplier.categories || []).length > 0 ? (
                          <>
                            {supplier.categories.slice(0, 2).map((category) => (
                              <Chip key={category} color="primary" size="sm" variant="flat">
                                {category}
                              </Chip>
                            ))}
                            {supplier.categories.length > 2 && (
                              <Chip size="sm" variant="flat" color="secondary">
                                +{supplier.categories.length - 2}
                              </Chip>
                            )}
                          </>
                        ) : (
                          <span className="text-gray-400 text-sm">—</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Chip size="sm" variant="flat" color="secondary">
                        {(supplier.paymentTerms || 'net30').toUpperCase()}
                      </Chip>
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
                ))}
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

          <Table aria-label="Purchase orders table" classNames={{ table: "min-w-[900px]", th: "whitespace-nowrap" }}>
            <TableHeader>
              <TableColumn className="w-[130px]">PO Number</TableColumn>
              <TableColumn className="min-w-[160px]">Supplier</TableColumn>
              <TableColumn className="w-[110px]">Order Date</TableColumn>
              <TableColumn className="w-[120px]">Expected</TableColumn>
              <TableColumn className="w-[90px]">Priority</TableColumn>
              <TableColumn className="w-[130px] text-right">Amount</TableColumn>
              <TableColumn className="w-[110px]">Status</TableColumn>
              <TableColumn className="w-[70px]">Actions</TableColumn>
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
                    <TableCell>
                      <span className="font-mono text-sm font-semibold whitespace-nowrap">{po.poNumber}</span>
                    </TableCell>
                    <TableCell>
                      <div className="font-semibold truncate max-w-[200px]" title={po.supplierName}>{po.supplierName}</div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {po.orderDate instanceof Date ? po.orderDate.toLocaleDateString() : new Date(po.orderDate).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {po.expectedDeliveryDate instanceof Date 
                        ? po.expectedDeliveryDate.toLocaleDateString() 
                        : new Date(po.expectedDeliveryDate).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Badge color={getPriorityColor(po.priority)} size="sm" variant="flat" className="capitalize">
                        {po.priority}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="font-semibold tabular-nums whitespace-nowrap">
                        ₵{Number(po.finalAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge color={getStatusColor(po.status)} size="sm" className="capitalize whitespace-nowrap">
                        {po.status.replace('-', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Tooltip content="Review — then send, confirm, or edit">
                        <Button
                          size="sm"
                          variant="flat"
                          color="primary"
                          onPress={() => handleViewPO(po)}
                        >
                          👁️
                        </Button>
                      </Tooltip>
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
              <SelectItem key="ready">Ready for Pickup</SelectItem>
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
                    case 'approved': return 'primary';
                    case 'ready': return 'success';
                    case 'rejected': case 'cancelled': return 'danger';
                    case 'converted-to-po': return 'secondary';
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
                      <Tooltip content="Review — then approve, reject, or edit">
                        <Button 
                          size="sm" 
                          variant="flat" 
                          color="primary"
                          onPress={() => handleViewRequisition(req)}
                        >
                          👁️
                        </Button>
                      </Tooltip>
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

    itemsToReceive.forEach((receiptItem) => {
      const poItem = po.items.find((i) => i.itemId === receiptItem.itemId);
      if (!poItem || receiptItem.receiveNow <= 0) return;
      const additionalQty = receiptItem.receiveNow;
      poItem.receivedQuantity = (poItem.receivedQuantity || 0) + additionalQty;

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

    const allReceived = po.items.every((item) => (item.receivedQuantity || 0) >= item.quantity);
    if (allReceived) {
      updatePurchaseOrder(po.id, { status: 'delivered', actualDeliveryDate: new Date() });
    } else {
      updatePurchaseOrder(po.id, { status: 'in-transit' });
    }

    onGoodsReceiptClose();
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

  // Get unique locations from stock items
  const availableLocations = useMemo(() => {
    const locSet = new Set<string>();
    stockItems.forEach(item => {
      if (item.location) locSet.add(item.location);
    });
    return Array.from(locSet);
  }, [stockItems]);

  const departments = ['Kitchen', 'Restaurant & Bar', 'Housekeeping', 'Maintenance', 'Front Office', 'Accounting', 'Other'];

  // Render GRN Management Function
  const renderGRNManagement = () => {
    const filteredGRNs = goodsReceiptNotes.filter((grn) => {
      const matchesSearch = grnSearchTerm === '' ||
        grn.grnNumber.toLowerCase().includes(grnSearchTerm.toLowerCase()) ||
        grn.poNumber.toLowerCase().includes(grnSearchTerm.toLowerCase()) ||
        grn.supplierName.toLowerCase().includes(grnSearchTerm.toLowerCase());
      const matchesStatus = grnFilterStatus === 'all' || grn.status === grnFilterStatus;
      return matchesSearch && matchesStatus;
    });

    return (
      <div className="space-y-6">
        <Card className="border-0 shadow-lg">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between w-full">
              <div>
                <h3 className="text-xl font-semibold text-ghana-black">📋 GRN & Quality</h3>
                <p className="text-sm text-gray-500">Review receipts, run QC, then approve — actions in View</p>
              </div>
              <Badge color="primary" variant="flat">{filteredGRNs.length} GRNs</Badge>
            </div>
          </CardHeader>
          <CardBody>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <Input
                placeholder="Search GRN, PO, or supplier..."
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
                <SelectItem key="pending">Pending QC</SelectItem>
                <SelectItem key="quality-check">Ready to Approve</SelectItem>
                <SelectItem key="approved">Approved</SelectItem>
                <SelectItem key="rejected">Rejected</SelectItem>
                <SelectItem key="completed">Completed</SelectItem>
              </Select>
            </div>

            <Table aria-label="Goods receipt notes" classNames={{ th: 'whitespace-nowrap' }}>
              <TableHeader>
                <TableColumn className="w-[130px]">GRN #</TableColumn>
                <TableColumn className="w-[120px]">PO #</TableColumn>
                <TableColumn>Supplier</TableColumn>
                <TableColumn className="w-[110px]">Date</TableColumn>
                <TableColumn className="w-[70px]">Lines</TableColumn>
                <TableColumn className="w-[120px] text-right">Value</TableColumn>
                <TableColumn className="w-[110px]">Status</TableColumn>
                <TableColumn className="w-[70px]">Actions</TableColumn>
              </TableHeader>
              <TableBody emptyContent="No GRNs yet. Receive goods from a PO first.">
                {filteredGRNs.map((grn: GoodsReceiptNote) => (
                  <TableRow key={grn.id}>
                    <TableCell>
                      <span className="font-mono text-sm font-semibold whitespace-nowrap">{grn.grnNumber}</span>
                    </TableCell>
                    <TableCell className="font-mono text-sm whitespace-nowrap">{grn.poNumber}</TableCell>
                    <TableCell className="truncate max-w-[160px]" title={grn.supplierName}>{grn.supplierName}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {grn.receiptDate instanceof Date ? grn.receiptDate.toLocaleDateString() : new Date(grn.receiptDate).toLocaleDateString()}
                    </TableCell>
                    <TableCell>{grn.totalItems}</TableCell>
                    <TableCell className="text-right tabular-nums font-semibold whitespace-nowrap">
                      ₵{grn.totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell>
                      <Badge
                        color={
                          grn.status === 'completed' || grn.status === 'approved' ? 'success' :
                          grn.status === 'quality-check' ? 'primary' :
                          grn.status === 'rejected' ? 'danger' : 'warning'
                        }
                        size="sm"
                        variant="flat"
                        className="capitalize"
                      >
                        {grn.status === 'quality-check' ? 'QC done' : grn.status.replace('-', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Tooltip content="Review — then QC / approve">
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
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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
                                    approveInvoice(inv.id, currentUserName);
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
                                    rejectInvoice(inv.id, currentUserName, reason);
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
                                  markInvoicePaid(inv.id, currentUserName, method, ref);
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

  // Render Stock Operations Function — receive + recon only
  const renderStockOperations = () => {
    // Get POs ready for receipt (confirmed or in-transit)
    const posForReceipt = supplierStorePurchaseOrders.filter(po => 
      po.status === 'confirmed' || po.status === 'in-transit'
    );

    return (
      <div className="space-y-6">
        <Tabs
          selectedKey={stockOpSubTab}
          onSelectionChange={(key) => setStockOpSubTab(key as string)}
        >
          <Tab key="goods-receipt" title="📥 Goods Receipt" />
          <Tab key="grn-management" title="📋 GRN & Quality" />
          <Tab key="stock-counts" title="🔍 Stock Count" />
        </Tabs>

        {stockOpSubTab === 'grn-management' && renderGRNManagement()}

        {stockOpSubTab === 'goods-receipt' && (
          <div className="space-y-6">
            <Card className="border-0 shadow-lg">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between w-full">
                  <div>
                    <h3 className="text-xl font-semibold text-ghana-black">📥 Goods Receipt</h3>
                    <p className="text-sm text-gray-500">Receive against confirmed / in-transit POs — creates a GRN</p>
                  </div>
                  <Badge color="primary" variant="flat">{posForReceipt.length} ready</Badge>
                </div>
              </CardHeader>
              <CardBody>
                <div className="mb-6">
                  <Input
                    placeholder="Search PO # or supplier..."
                    value={poSearchTerm}
                    onChange={(e) => setPOSearchTerm(e.target.value)}
                    startContent={<span className="text-gray-400">🔍</span>}
                  />
                </div>
                <Table aria-label="POs ready for receipt" classNames={{ th: 'whitespace-nowrap' }}>
                  <TableHeader>
                    <TableColumn className="w-[130px]">PO #</TableColumn>
                    <TableColumn>Supplier</TableColumn>
                    <TableColumn className="w-[110px]">Ordered</TableColumn>
                    <TableColumn className="w-[110px]">Expected</TableColumn>
                    <TableColumn className="w-[70px]">Lines</TableColumn>
                    <TableColumn className="w-[100px]">Status</TableColumn>
                    <TableColumn className="w-[70px]">Actions</TableColumn>
                  </TableHeader>
                  <TableBody emptyContent="No POs ready. Confirm a purchase order first.">
                    {posForReceipt
                      .filter((po) =>
                        po.poNumber.toLowerCase().includes(poSearchTerm.toLowerCase()) ||
                        po.supplierName.toLowerCase().includes(poSearchTerm.toLowerCase())
                      )
                      .map((po) => (
                        <TableRow key={po.id}>
                          <TableCell>
                            <span className="font-mono text-sm font-semibold whitespace-nowrap">{po.poNumber}</span>
                          </TableCell>
                          <TableCell className="truncate max-w-[160px]" title={po.supplierName}>{po.supplierName}</TableCell>
                          <TableCell className="whitespace-nowrap">
                            {po.orderDate instanceof Date ? po.orderDate.toLocaleDateString() : new Date(po.orderDate).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {po.expectedDeliveryDate instanceof Date ? po.expectedDeliveryDate.toLocaleDateString() : new Date(po.expectedDeliveryDate).toLocaleDateString()}
                          </TableCell>
                          <TableCell>{po.items.length}</TableCell>
                          <TableCell>
                            <Badge color={po.status === 'confirmed' ? 'warning' : 'primary'} size="sm" variant="flat" className="capitalize">
                              {po.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Tooltip content="Receive this shipment">
                              <Button
                                size="sm"
                                variant="flat"
                                color="success"
                                className="bg-ghana-green text-white"
                                onPress={() => handleOpenGoodsReceipt(po)}
                              >
                                📥
                              </Button>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </CardBody>
            </Card>
          </div>
        )}

        {stockOpSubTab === 'stock-counts' && (
          <div className="space-y-6">
            <Card className="border-0 shadow-lg">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between w-full">
                  <div>
                    <h3 className="text-xl font-semibold text-ghana-black">🔍 Stock Count</h3>
                    <p className="text-sm text-gray-500">Physical vs book — post variances on Complete</p>
                  </div>
                  <Button color="primary" className="bg-ghana-gold text-white" variant="flat" onPress={handleAddStockCount}>
                    + New Count
                  </Button>
                </div>
              </CardHeader>
              <CardBody>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <Input
                    placeholder="Search count # or location..."
                    value={stockCountSearchTerm}
                    onChange={(e) => setStockCountSearchTerm(e.target.value)}
                    startContent={<span className="text-gray-400">🔍</span>}
                    className="md:col-span-2"
                  />
                  <Select
                    selectedKeys={[stockCountFilterStatus]}
                    onSelectionChange={(keys) => setStockCountFilterStatus(Array.from(keys)[0] as string)}
                  >
                    <SelectItem key="all">All Status</SelectItem>
                    <SelectItem key="planned">Planned</SelectItem>
                    <SelectItem key="in-progress">In Progress</SelectItem>
                    <SelectItem key="completed">Completed</SelectItem>
                    <SelectItem key="cancelled">Cancelled</SelectItem>
                  </Select>
                </div>
                <Table aria-label="Stock counts" classNames={{ th: 'whitespace-nowrap' }}>
                  <TableHeader>
                    <TableColumn className="w-[130px]">Count #</TableColumn>
                    <TableColumn className="w-[90px]">Type</TableColumn>
                    <TableColumn>Location</TableColumn>
                    <TableColumn className="w-[110px]">Started</TableColumn>
                    <TableColumn className="w-[70px]">Lines</TableColumn>
                    <TableColumn className="w-[70px]">Δ</TableColumn>
                    <TableColumn className="w-[110px]">Status</TableColumn>
                    <TableColumn className="w-[70px]">Actions</TableColumn>
                  </TableHeader>
                  <TableBody emptyContent="No counts yet. Create one to reconcile a location.">
                    {stockCounts
                      .filter((c) =>
                        (stockCountSearchTerm === '' ||
                          c.countNumber.toLowerCase().includes(stockCountSearchTerm.toLowerCase()) ||
                          c.location.toLowerCase().includes(stockCountSearchTerm.toLowerCase())) &&
                        (stockCountFilterStatus === 'all' || c.status === stockCountFilterStatus)
                      )
                      .map((count) => (
                        <TableRow key={count.id}>
                          <TableCell>
                            <span className="font-mono text-sm font-semibold whitespace-nowrap">{count.countNumber}</span>
                          </TableCell>
                          <TableCell>
                            <Chip size="sm" variant="flat" className="capitalize">{count.countType}</Chip>
                          </TableCell>
                          <TableCell className="truncate max-w-[140px]" title={count.location}>{count.location}</TableCell>
                          <TableCell className="whitespace-nowrap">
                            {count.startDate instanceof Date ? count.startDate.toLocaleDateString() : new Date(count.startDate).toLocaleDateString()}
                          </TableCell>
                          <TableCell>{count.items.length}</TableCell>
                          <TableCell className={count.varianceItems > 0 ? 'font-semibold text-orange-600' : ''}>
                            {count.varianceItems}
                          </TableCell>
                          <TableCell>
                            <Badge
                              color={
                                count.status === 'completed' ? 'success' :
                                count.status === 'in-progress' ? 'warning' :
                                count.status === 'cancelled' ? 'danger' : 'default'
                              }
                              size="sm"
                              variant="flat"
                              className="capitalize"
                            >
                              {count.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Tooltip content="Review — then edit or complete">
                              <Button
                                size="sm"
                                variant="flat"
                                color="primary"
                                onPress={() => {
                                  setViewingStockCount(count);
                                  onStockCountViewOpen();
                                }}
                              >
                                👁️
                              </Button>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </CardBody>
            </Card>
          </div>
        )}
      </div>
    );
  };

  const renderStockTransfers = () => {
    const filtered = stockTransfers.filter((t) =>
      (stockTransferSearchTerm === '' ||
        t.transferNumber.toLowerCase().includes(stockTransferSearchTerm.toLowerCase()) ||
        t.fromLocation.toLowerCase().includes(stockTransferSearchTerm.toLowerCase()) ||
        t.toLocation.toLowerCase().includes(stockTransferSearchTerm.toLowerCase())) &&
      (stockTransferFilterStatus === 'all' || t.status === stockTransferFilterStatus)
    );

    return (
      <div className="space-y-6">
        <Card className="border-0 shadow-lg">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between w-full">
              <div>
                <h3 className="text-xl font-semibold text-ghana-black">🔄 Stock Transfers</h3>
                <p className="text-sm text-gray-500">Move stock between locations</p>
              </div>
              <Button color="primary" className="bg-ghana-green text-white" variant="flat" onPress={handleAddStockTransfer}>
                + New Transfer
              </Button>
            </div>
          </CardHeader>
          <CardBody>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <Input
                placeholder="Search transfer # or location..."
                value={stockTransferSearchTerm}
                onChange={(e) => setStockTransferSearchTerm(e.target.value)}
                startContent={<span className="text-gray-400">🔍</span>}
                className="md:col-span-2"
              />
              <Select
                placeholder="Filter by Status"
                selectedKeys={[stockTransferFilterStatus]}
                onSelectionChange={(keys) => setStockTransferFilterStatus(Array.from(keys)[0] as string)}
              >
                <SelectItem key="all">All Status</SelectItem>
                <SelectItem key="pending">Pending</SelectItem>
                <SelectItem key="in-transit">In Transit</SelectItem>
                <SelectItem key="delivered">Delivered</SelectItem>
                <SelectItem key="cancelled">Cancelled</SelectItem>
              </Select>
            </div>
            <Table aria-label="Stock transfers" classNames={{ th: "whitespace-nowrap" }}>
              <TableHeader>
                <TableColumn className="w-[130px]">Transfer #</TableColumn>
                <TableColumn>From</TableColumn>
                <TableColumn>To</TableColumn>
                <TableColumn className="w-[110px]">Date</TableColumn>
                <TableColumn className="w-[70px]">Items</TableColumn>
                <TableColumn className="w-[100px]">Status</TableColumn>
                <TableColumn className="w-[70px]">Actions</TableColumn>
              </TableHeader>
              <TableBody emptyContent="No stock transfers yet. Create one to move stock between locations.">
                {filtered.map((transfer) => (
                  <TableRow key={transfer.id}>
                    <TableCell>
                      <span className="font-mono text-sm font-semibold whitespace-nowrap">{transfer.transferNumber}</span>
                    </TableCell>
                    <TableCell className="truncate max-w-[140px]" title={transfer.fromLocation}>{transfer.fromLocation}</TableCell>
                    <TableCell className="truncate max-w-[140px]" title={transfer.toLocation}>{transfer.toLocation}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {transfer.transferDate instanceof Date ? transfer.transferDate.toLocaleDateString() : new Date(transfer.transferDate).toLocaleDateString()}
                    </TableCell>
                    <TableCell>{transfer.items.length}</TableCell>
                    <TableCell>
                      <Badge
                        color={
                          transfer.status === 'delivered' ? 'success' :
                          transfer.status === 'in-transit' ? 'warning' :
                          transfer.status === 'cancelled' ? 'danger' : 'default'
                        }
                        size="sm"
                        variant="flat"
                        className="capitalize"
                      >
                        {transfer.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Tooltip content="Review — then edit or complete">
                        <Button
                          size="sm"
                          variant="flat"
                          color="primary"
                          onPress={() => {
                            setViewingStockTransfer(transfer);
                            onStockTransferViewOpen();
                          }}
                        >
                          👁️
                        </Button>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardBody>
        </Card>
      </div>
    );
  };

  const renderGoodsIssue = () => {
    const filtered = goodsIssues.filter((row) =>
      issueSearchTerm === '' ||
      row.issueNumber.toLowerCase().includes(issueSearchTerm.toLowerCase()) ||
      row.department.toLowerCase().includes(issueSearchTerm.toLowerCase()) ||
      row.issuedTo.toLowerCase().includes(issueSearchTerm.toLowerCase())
    );

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayCount = goodsIssues.filter((r) => {
      const d = new Date(r.issueDate);
      d.setHours(0, 0, 0, 0);
      return d.getTime() === today.getTime();
    }).length;

    return (
      <div className="space-y-6">
        <Card className="border-0 shadow-lg">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between w-full">
              <div>
                <h3 className="text-xl font-semibold text-ghana-black">📤 Goods Issue</h3>
                <p className="text-sm text-gray-500">Issue stock from Stores to a department or person</p>
              </div>
              <div className="flex gap-2 items-center">
                <Badge color="success" variant="flat">{todayCount} today</Badge>
                <Button color="primary" className="bg-ghana-gold text-white" variant="flat" onPress={handleOpenGoodsIssue}>
                  + New Issue
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardBody>
            <div className="mb-6">
              <Input
                placeholder="Search issue #, department, or person..."
                value={issueSearchTerm}
                onChange={(e) => setIssueSearchTerm(e.target.value)}
                startContent={<span className="text-gray-400">🔍</span>}
              />
            </div>
            <Table aria-label="Goods issues" classNames={{ th: 'whitespace-nowrap' }}>
              <TableHeader>
                <TableColumn className="w-[130px]">Issue #</TableColumn>
                <TableColumn className="w-[110px]">Date</TableColumn>
                <TableColumn>Department</TableColumn>
                <TableColumn>Issued To</TableColumn>
                <TableColumn className="w-[70px]">Lines</TableColumn>
                <TableColumn className="w-[120px] text-right">Value</TableColumn>
                <TableColumn className="w-[70px]">Actions</TableColumn>
              </TableHeader>
              <TableBody emptyContent="No issues yet. Create one to send stock to a department.">
                {filtered.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <span className="font-mono text-sm font-semibold whitespace-nowrap">{row.issueNumber}</span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {row.issueDate instanceof Date ? row.issueDate.toLocaleDateString() : new Date(row.issueDate).toLocaleDateString()}
                    </TableCell>
                    <TableCell>{row.department}</TableCell>
                    <TableCell>{row.issuedTo}</TableCell>
                    <TableCell>{row.totalItems}</TableCell>
                    <TableCell className="text-right tabular-nums font-semibold whitespace-nowrap">
                      ₵{row.totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell>
                      <Tooltip content="View issue">
                        <Button
                          size="sm"
                          variant="flat"
                          color="primary"
                          onPress={() => {
                            setViewingGoodsIssue(row);
                            onGoodsIssueViewOpen();
                          }}
                        >
                          👁️
                        </Button>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardBody>
        </Card>
      </div>
    );
  };

  return (
    <div className={embedded ? 'pt-2' : 'p-6'}>
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
          if (tab === 'stock-operations' && !['goods-receipt', 'grn-management', 'stock-counts'].includes(stockOpSubTab)) {
            setStockOpSubTab('goods-receipt');
          }
        }}
        className="w-full"
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

      <div className="mt-6">
        {selectedTab === 'inventory' && renderInventoryManagement()}
        {selectedTab === 'suppliers' && renderSupplierManagement()}
        {selectedTab === 'requisitions' && renderRequisitions()}
        {selectedTab === 'purchase-orders' && renderPurchaseOrders()}
        {selectedTab === 'transfers' && renderStockTransfers()}
        {selectedTab === 'goods-issue' && renderGoodsIssue()}
        {selectedTab === 'supplier-invoices' && renderInvoiceManagement()}
        {selectedTab === 'stock-operations' && renderStockOperations()}
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
                <p className="text-sm text-slate-500 -mt-1 mb-2">
                  Stock on the shelf. Receiving and issues change on-hand later — you set the starting qty here.
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Item Code"
                    value={formData.itemCode || ''}
                    isReadOnly
                    isRequired
                    description={
                      editingItem
                        ? 'Locked — assigned when the item was created'
                        : 'Auto from Settings → Document Numbering → Stock Item'
                    }
                    classNames={{ input: 'font-mono font-semibold' }}
                  />
                  <Input
                    label="Item Name"
                    value={formData.name || ''}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Bath Soap"
                    isRequired
                    classNames={{ input: 'font-medium' }}
                  />
                  <Select
                    label="Category"
                    selectedKeys={formData.category ? [formData.category] : ['other']}
                    onSelectionChange={(keys) => setFormData({ ...formData, category: Array.from(keys)[0] as any })}
                    isRequired
                  >
                    {STOCK_CATEGORIES.map((cat) => (
                      <SelectItem key={cat} textValue={cat}>
                        <span className="capitalize">{cat}</span>
                      </SelectItem>
                    ))}
                  </Select>
                  <Select
                    label="Preferred Supplier"
                    placeholder="Who supplies this item?"
                    selectedKeys={formData.supplierId ? [formData.supplierId] : []}
                    onSelectionChange={(keys) => {
                      const sid = Array.from(keys)[0] as string | undefined;
                      const supplier = mergedSuppliers.find((s) => s.id === sid);
                      setFormData({
                        ...formData,
                        supplierId: supplier?.id,
                        supplierName: supplier?.name,
                      });
                    }}
                    description="Used to filter vendors on requisitions"
                  >
                    {mergedSuppliers.filter((s) => s.isActive).map((s) => (
                      <SelectItem key={s.id}>{s.name}</SelectItem>
                    ))}
                  </Select>
                  <Input
                    label="Unit"
                    value={formData.unit || ''}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    placeholder="e.g. pcs, kg, bottles"
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
                    label="On Hand (starting qty)"
                    type="number"
                    value={formData.currentStock?.toString() || '0'}
                    onChange={(e) => {
                      const currentStock = parseFloat(e.target.value) || 0;
                      setFormData({
                        ...formData,
                        currentStock,
                        // Keep min/max sensible defaults if still blank
                        minimumStock: formData.minimumStock || 0,
                        maximumStock: formData.maximumStock || Math.max(currentStock * 2, 100),
                      });
                    }}
                    description={editingItem ? 'Prefer receive / issue to change stock' : 'Opening balance'}
                  />
                  <Input
                    label="Reorder Point"
                    type="number"
                    value={formData.reorderPoint?.toString() || '0'}
                    onChange={(e) => {
                      const reorderPoint = parseFloat(e.target.value) || 0;
                      setFormData({
                        ...formData,
                        reorderPoint,
                        minimumStock: formData.minimumStock || reorderPoint,
                      });
                    }}
                    description="Alert when on hand falls to this"
                  />
                  <Input
                    label="Location"
                    value={formData.location || ''}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    placeholder="e.g. Main Store"
                  />
                  <Textarea
                    label="Description (optional)"
                    value={formData.description || ''}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Short note"
                    className="col-span-2"
                    minRows={2}
                  />
                  <div className="col-span-2 flex flex-wrap gap-3">
                    <Chip
                      color={formData.isActive !== false ? 'success' : 'warning'}
                      variant="flat"
                      onClick={() => setFormData({ ...formData, isActive: !(formData.isActive !== false) })}
                      className="cursor-pointer"
                    >
                      {formData.isActive !== false ? '✓ Active — in the stock file' : 'Inactive — hidden from day-to-day'}
                    </Chip>
                    <Chip
                      color={formData.isPerishable ? 'warning' : 'default'}
                      variant="flat"
                      onClick={() => setFormData({ ...formData, isPerishable: !formData.isPerishable })}
                      className="cursor-pointer"
                    >
                      {formData.isPerishable ? '🍃 Perishable' : 'Not perishable'}
                    </Chip>
                  </div>
                </div>
              </ModalBody>
              <ModalFooter>
                <Button variant="bordered" onPress={onClose}>Cancel</Button>
                <Button color="primary" className="bg-ghana-green text-white" onPress={handleSaveItem}>
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
              <ModalFooter className="flex flex-wrap gap-2">
                <Button variant="bordered" onPress={() => setViewOpen(false)}>Close</Button>
                {viewingItem && (
                  <Button color="warning" variant="flat" onPress={() => {
                    setViewOpen(false);
                    handleEditItem(viewingItem);
                  }}>
                    ✏️ Edit
                  </Button>
                )}
                {viewingItem && (
                  <Button color="danger" variant="flat" onPress={() => {
                    setViewOpen(false);
                    handleDeleteItem(viewingItem.id);
                  }}>
                    🗑️ Delete
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
                <p className="text-sm text-slate-500 -mt-1 mb-2">
                  Who you buy from. Rating and balance stay on View / Accounting.
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Supplier Code"
                    value={supplierFormData.code || ''}
                    onChange={(e) => setSupplierFormData({ ...supplierFormData, code: e.target.value })}
                    placeholder="Auto-generated"
                    isDisabled={!editingSupplier}
                    description={editingSupplier ? 'Code can be edited' : 'Auto-generated'}
                    isRequired
                  />
                  <Input
                    label="Supplier Name"
                    value={supplierFormData.name || ''}
                    onChange={(e) => setSupplierFormData({ ...supplierFormData, name: e.target.value })}
                    placeholder="e.g. Accra Fresh Foods Ltd"
                    isRequired
                    classNames={{ input: 'font-medium' }}
                  />
                  <Input
                    label="Contact Person"
                    value={supplierFormData.contactPerson || ''}
                    onChange={(e) => setSupplierFormData({ ...supplierFormData, contactPerson: e.target.value })}
                    placeholder="Who we call"
                  />
                  <Input
                    label="Phone"
                    value={supplierFormData.phone || ''}
                    onChange={(e) => setSupplierFormData({ ...supplierFormData, phone: e.target.value })}
                    placeholder="+233 XX XXX XXXX"
                  />
                  <Input
                    label="Email"
                    type="email"
                    value={supplierFormData.email || ''}
                    onChange={(e) => setSupplierFormData({ ...supplierFormData, email: e.target.value })}
                    placeholder="supplier@email.com"
                    className="col-span-2"
                  />
                  <Textarea
                    label="Address"
                    value={supplierFormData.address || ''}
                    onChange={(e) => setSupplierFormData({ ...supplierFormData, address: e.target.value })}
                    placeholder="Street / building"
                    className="col-span-2"
                    minRows={2}
                  />
                  <Input
                    label="City"
                    value={supplierFormData.city || ''}
                    onChange={(e) => setSupplierFormData({ ...supplierFormData, city: e.target.value })}
                    placeholder="e.g. Accra"
                  />
                  <Input
                    label="Category — what they’re into"
                    value={supplierFormData.categories?.join(', ') || ''}
                    onChange={(e) => setSupplierFormData({
                      ...supplierFormData,
                      categories: e.target.value.split(',').map(c => c.trim()).filter(Boolean),
                    })}
                    placeholder="e.g. food, cleaning, linens"
                    description="Separate with commas — shows as chips in the table"
                  />
                  <Select
                    label="Payment Terms"
                    selectedKeys={supplierFormData.paymentTerms ? [supplierFormData.paymentTerms] : ['net30']}
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
                    description="Optional"
                  />
                  <Input
                    label="Tax ID / TIN"
                    value={supplierFormData.taxId || ''}
                    onChange={(e) => setSupplierFormData({ ...supplierFormData, taxId: e.target.value })}
                    placeholder="e.g. GH123456789"
                    className="col-span-2"
                  />
                  <div className="col-span-2">
                    <Chip
                      color={supplierFormData.isActive !== false ? 'success' : 'warning'}
                      variant="flat"
                      onClick={() => setSupplierFormData({ ...supplierFormData, isActive: !(supplierFormData.isActive !== false) })}
                      className="cursor-pointer"
                    >
                      {supplierFormData.isActive !== false ? '✓ Active — ready to buy from' : 'Inactive — paused'}
                    </Chip>
                  </div>
                </div>
              </ModalBody>
              <ModalFooter>
                <Button variant="bordered" onPress={onSupplierModalClose}>Cancel</Button>
                <Button color="primary" className="bg-blue-500" onPress={handleSaveSupplier}>
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
                  isReadOnly
                  description="Auto from Settings → Document Numbering → Purchase Order"
                  classNames={{ input: 'font-mono font-semibold' }}
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
                    setPOFormData({
                      ...poFormData,
                      taxType: selectedTaxType,
                      // Only 'custom' has a rate to type in — a real Tax Type's
                      // amount comes from its assigned rules, not one percentage.
                      taxRate: selectedTaxType === 'custom' ? (poFormData.taxRate || 0) : 0
                    });
                  }}
                >
                  <>
                    {taxOptions.map(option => (
                      <SelectItem key={option.value}>{option.label}</SelectItem>
                    ))}
                  </>
                </Select>
                {poFormData.taxType === 'custom' && (
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
              </div>

              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex justify-between mb-2">
                  <span className="font-semibold">Subtotal:</span>
                  <span className="font-semibold">
                    ₵{((poFormData.items || []).reduce((sum, item) => sum + item.totalCost, 0)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                {poFormData.taxType && poFormData.taxType !== 'none' && (() => {
                  const itemsTotal = (poFormData.items || []).reduce((sum, item) => sum + item.totalCost, 0);
                  const lines = computePOTaxLines(itemsTotal, poFormData.taxType, poFormData.taxRate || 0);
                  return lines.map((line, idx) => (
                    <div key={idx} className="flex justify-between mb-2 text-sm">
                      <span>{line.amount < 0 ? `${line.name} (withheld)` : line.name}:</span>
                      <span>
                        {line.amount < 0 ? '-' : ''}₵{Math.abs(line.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  ));
                })()}
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
                    ₵{(() => {
                      const itemsTotal = (poFormData.items || []).reduce((sum, item) => sum + item.totalCost, 0);
                      const taxAmount = computePOTax(itemsTotal, poFormData.taxType, poFormData.taxRate || 0);
                      const total = itemsTotal + taxAmount + (poFormData.shippingAmount || 0) - (poFormData.discountAmount || 0);
                      return total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                    })()}
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
            Purchase Order Details — {viewingPO?.poNumber}
            <span className="block text-sm font-normal text-slate-500 mt-1">
              Review the order, then send, confirm, or edit from here.
            </span>
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
                  {viewingPO.taxAmount !== 0 && (() => {
                    // Real Tax Types are a bundle of rules — show each one (NHIL,
                    // GETFund, VAT, etc.) separately, re-derived live from the current
                    // rules (rates may have changed in Settings since this PO was
                    // saved). 'custom' and legacy records have no rules to re-derive,
                    // so those fall back to the one persisted signed amount.
                    const lines = viewingPO.taxTypeId && viewingPO.taxTypeId !== 'custom'
                      ? computePOTaxLines(viewingPO.totalAmount, viewingPO.taxTypeId, 0)
                      : [];
                    if (lines.length > 0) {
                      return lines.map((line, idx) => (
                        <div key={idx} className="flex justify-between mb-2 text-sm">
                          <span>{line.amount < 0 ? `${line.name} (withheld)` : line.name}:</span>
                          <span>{line.amount < 0 ? '-' : ''}₵{Math.abs(line.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                      ));
                    }
                    const rate = viewingPO.totalAmount > 0 ? Math.abs((viewingPO.taxAmount / viewingPO.totalAmount) * 100) : 0;
                    const isWithheld = viewingPO.taxAmount < 0;
                    return (
                      <div className="flex justify-between mb-2 text-sm">
                        <span>{isWithheld ? 'Withholding' : 'Tax'} ({rate.toFixed(1)}%):</span>
                        <span>{isWithheld ? '-' : ''}₵{Math.abs(viewingPO.taxAmount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                    );
                  })()}
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
          <ModalFooter className="flex flex-wrap gap-2">
            <Button variant="bordered" onPress={onPOViewClose}>Close</Button>
            {viewingPO && viewingPO.status === 'draft' && (
              <Button color="warning" variant="flat" onPress={() => {
                onPOViewClose();
                handleEditPO(viewingPO);
              }}>
                ✏️ Edit
              </Button>
            )}
            {viewingPO && viewingPO.status === 'draft' && (
              <Button color="success" onPress={() => {
                sendPurchaseOrder(viewingPO.id);
                trackEvent('Stores.Issued', { action: 'send_po', poNumber: viewingPO.poNumber });
                setViewingPO({ ...viewingPO, status: 'sent' });
              }}>
                📤 Send to Supplier
              </Button>
            )}
            {viewingPO && viewingPO.status === 'sent' && (
              <Button color="success" onPress={() => {
                confirmPurchaseOrder(viewingPO.id, viewingPO.supplierId);
                trackEvent('Stores.Issued', { action: 'confirm_po', poNumber: viewingPO.poNumber });
                setViewingPO({ ...viewingPO, status: 'confirmed' });
              }}>
                ✓ Confirm
              </Button>
            )}
            {viewingPO && (viewingPO.status === 'confirmed' || viewingPO.status === 'sent') && (
              <Button color="warning" variant="flat" onPress={() => {
                markInTransit(viewingPO.id);
                trackEvent('Stores.Issued', { action: 'mark_in_transit_po', poNumber: viewingPO.poNumber });
                setViewingPO({ ...viewingPO, status: 'in-transit' });
              }}>
                🚚 Mark In Transit
              </Button>
            )}
            {viewingPO && (viewingPO.status === 'in-transit' || viewingPO.status === 'confirmed') && (
              <Button color="success" onPress={() => {
                markDelivered(viewingPO.id, new Date());
                trackEvent('Stores.Issued', { action: 'mark_delivered_po', poNumber: viewingPO.poNumber });
                setViewingPO({ ...viewingPO, status: 'delivered' });
              }}>
                ✅ Mark Delivered
              </Button>
            )}
            {viewingPO && (viewingPO.status === 'draft' || viewingPO.status === 'sent' || viewingPO.status === 'confirmed') && (
              <Button color="danger" variant="flat" onPress={() => {
                if (confirm('Are you sure you want to cancel this purchase order?')) {
                  cancelPurchaseOrder(viewingPO.id, 'Cancelled by user');
                  trackEvent('Stores.Issued', { action: 'cancel_po', poNumber: viewingPO.poNumber });
                  setViewingPO({ ...viewingPO, status: 'cancelled' });
                }
              }}>
                ❌ Cancel
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
                <p className="text-xs text-slate-500 mb-3">
                  Optional preferred supplier per line — filtered to vendors linked to that product (item supplier, matching category, or past POs).
                </p>
                {(requisitionFormData.requestedItems || []).length > 0 ? (
                  <Table aria-label="Requested items" className="[&_thead]:hidden">
                    <TableHeader>
                      <TableColumn>Item</TableColumn>
                      <TableColumn>Supplier</TableColumn>
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
                            <TableCell className="w-[32%]">
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
                                      totalCost: 0,
                                      preferredSupplierId: undefined,
                                      preferredSupplierName: undefined,
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
                            <TableCell className="w-[22%]">
                              {(() => {
                                const vendors = getVendorsForRequisitionLine(item);
                                const selectedOk = item.preferredSupplierId && vendors.some((v) => v.id === item.preferredSupplierId);
                                return (
                                  <Select
                                    placeholder={item.itemId ? (vendors.length ? 'Preferred vendor' : 'No vendor for item') : 'Pick item first'}
                                    size="sm"
                                    isDisabled={!item.itemId || vendors.length === 0}
                                    selectedKeys={selectedOk ? [item.preferredSupplierId!] : []}
                                    onSelectionChange={(keys) => {
                                      const sid = Array.from(keys)[0] as string;
                                      const supplier = vendors.find((s) => s.id === sid);
                                      handleUpdateRequisitionItem(item.id, {
                                        preferredSupplierId: supplier?.id,
                                        preferredSupplierName: supplier?.name,
                                      });
                                    }}
                                    description={
                                      !item.itemId
                                        ? undefined
                                        : vendors.length === 0
                                          ? 'Link a supplier on the item (or category)'
                                          : undefined
                                    }
                                  >
                                    {vendors.map((s) => (
                                      <SelectItem key={s.id}>{s.name}</SelectItem>
                                    ))}
                                  </Select>
                                );
                              })()}
                            </TableCell>
                            <TableCell className="w-[12%]">
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
                            <TableCell className="w-[14%]">
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
            Requisition Details — {viewingRequisition?.requisitionNumber}
            <span className="block text-sm font-normal text-slate-500 mt-1">
              Review the lines below, then approve or reject from here.
            </span>
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
                      viewingRequisition.status === 'ready' ? 'success' :
                      viewingRequisition.status === 'approved' ? 'primary' :
                      viewingRequisition.status === 'rejected' || viewingRequisition.status === 'cancelled' ? 'danger' :
                      viewingRequisition.status === 'converted-to-po' ? 'secondary' :
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
                      <TableColumn>Preferred Supplier</TableColumn>
                      <TableColumn>Quantity</TableColumn>
                      <TableColumn>Estimated Price</TableColumn>
                      <TableColumn className="text-right">Total</TableColumn>
                    </TableHeader>
                    <TableBody>
                      {viewingRequisition.requestedItems.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-mono">{item.itemCode}</TableCell>
                          <TableCell>{item.itemName}</TableCell>
                          <TableCell className="text-sm">
                            {item.preferredSupplierName || '—'}
                          </TableCell>
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
          <ModalFooter className="flex flex-wrap gap-2">
            <Button variant="bordered" onPress={onRequisitionViewClose}>Close</Button>
            {viewingRequisition && (viewingRequisition.status === 'pending' || canEditProcessedRequisitions) && viewingRequisition.status !== 'converted-to-po' && (
              <Button color="warning" variant="flat" onPress={() => {
                onRequisitionViewClose();
                handleEditRequisition(viewingRequisition);
              }}>
                ✏️ Edit
              </Button>
            )}
            {viewingRequisition && (viewingRequisition.status === 'pending' || canEditProcessedRequisitions) && viewingRequisition.status !== 'converted-to-po' && (
              <Button color="danger" variant="flat" onPress={() => openReqAction('delete', viewingRequisition)}>
                🗑️ Delete
              </Button>
            )}
            {viewingRequisition && viewingRequisition.status === 'pending' && canActOnRequisitions && (
              <>
                <Button color="success" onPress={() => openReqAction('approve', viewingRequisition)}>
                  ✓ Approve
                </Button>
                <Button color="danger" variant="flat" onPress={() => openReqAction('reject', viewingRequisition)}>
                  ❌ Reject
                </Button>
              </>
            )}
            {viewingRequisition && viewingRequisition.status === 'approved' && canActOnRequisitions && (
              <>
                <Button color="success" onPress={() => openReqAction('ready', viewingRequisition)}>
                  📦 Mark Ready
                </Button>
                <Button color="primary" onPress={() => openReqAction('convert', viewingRequisition)}>
                  📋 Convert to PO
                </Button>
              </>
            )}
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Requisition Approve/Reject/Ready/Convert/Delete confirmation — see reqActionModal above */}
      <Modal isOpen={!!reqActionModal} onClose={closeReqAction} size={reqActionModal?.type === 'convert' ? '3xl' : 'md'}>
        <ModalContent>
          <ModalHeader>
            {reqActionModal?.type === 'approve' && 'Approve Requisition'}
            {reqActionModal?.type === 'ready' && 'Mark Ready for Pickup'}
            {reqActionModal?.type === 'reject' && 'Reject Requisition'}
            {reqActionModal?.type === 'convert' && 'Convert to Purchase Order(s)'}
            {reqActionModal?.type === 'delete' && 'Delete Requisition'}
          </ModalHeader>
          <ModalBody>
            {reqActionModal?.type === 'approve' && (
              <p>
                Approve requisition <strong>{reqActionModal.requisitionNumber}</strong>? This means Stores agrees to
                fulfill it — the requester is still waiting until you mark it ready for pickup.
              </p>
            )}
            {reqActionModal?.type === 'ready' && (
              <p>
                Mark requisition <strong>{reqActionModal.requisitionNumber}</strong> ready for pickup? This transfers
                the requested items from Stores' shared stock into the requesting department's own stock, and lets
                them know it's ready to collect.
              </p>
            )}
            {reqActionModal?.type === 'reject' && (
              <div className="space-y-3">
                <p>Reject requisition <strong>{reqActionModal.requisitionNumber}</strong>?</p>
                <Textarea
                  label="Rejection reason (optional)"
                  value={reqRejectReason}
                  onChange={(e) => setReqRejectReason(e.target.value)}
                  placeholder="Let the requester know why..."
                />
              </div>
            )}
            {reqActionModal?.type === 'convert' && (() => {
              const req = supplierStoreRequisitions.find((r) => r.id === reqActionModal.requisitionId);
              const lines = req?.requestedItems || [];
              const groupCounts = new Map<string, number>();
              for (const item of lines) {
                const sid = reqConvertSuppliers[item.id];
                if (!sid) continue;
                groupCounts.set(sid, (groupCounts.get(sid) || 0) + 1);
              }
              return (
                <div className="space-y-4">
                  <p className="text-sm text-slate-600">
                    Assign a supplier per line. Lines to the same vendor become <strong>one PO</strong>;
                    different vendors (fish vs biscuits) become <strong>separate POs</strong>.
                  </p>
                  <div className="space-y-3 max-h-[360px] overflow-y-auto">
                    {lines.map((item) => {
                      const vendors = getVendorsForRequisitionLine(item);
                      const selectedOk = reqConvertSuppliers[item.id] && vendors.some((v) => v.id === reqConvertSuppliers[item.id]);
                      return (
                        <div key={item.id} className="grid grid-cols-1 md:grid-cols-[1fr_220px] gap-2 items-center border rounded-lg p-3">
                          <div>
                            <div className="font-mono text-sm font-semibold">{item.itemCode}</div>
                            <div className="text-sm">{item.itemName} · qty {item.quantity}</div>
                            {vendors.length === 0 && (
                              <div className="text-xs text-amber-700 mt-1">No vendor linked to this product — set one on the item first.</div>
                            )}
                          </div>
                          <Select
                            label="Supplier"
                            size="sm"
                            isDisabled={vendors.length === 0}
                            selectedKeys={selectedOk ? [reqConvertSuppliers[item.id]] : []}
                            onSelectionChange={(keys) => {
                              const sid = Array.from(keys)[0] as string;
                              if (!sid) return;
                              setReqConvertSuppliers((prev) => ({ ...prev, [item.id]: sid }));
                            }}
                            isRequired
                            placeholder={vendors.length ? 'Select vendor' : 'No vendors'}
                          >
                            {vendors.map((s) => (
                              <SelectItem key={s.id}>{s.name}</SelectItem>
                            ))}
                          </Select>
                        </div>
                      );
                    })}
                  </div>
                  {groupCounts.size > 0 && (
                    <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-sm">
                      <div className="font-semibold mb-1">Will create {groupCounts.size} purchase order{groupCounts.size === 1 ? '' : 's'}:</div>
                      <ul className="list-disc pl-5 space-y-0.5">
                        {[...groupCounts.entries()].map(([sid, count]) => (
                          <li key={sid}>
                            {mergedSuppliers.find((s) => s.id === sid)?.name || sid} — {count} line{count === 1 ? '' : 's'}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              );
            })()}
            {reqActionModal?.type === 'delete' && (
              <p>
                Permanently delete requisition <strong>{reqActionModal.requisitionNumber}</strong>? This cannot be
                undone. It does not reverse any stock already transferred if this requisition was marked ready.
              </p>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="bordered" onPress={closeReqAction}>Cancel</Button>
            <Button
              color={reqActionModal?.type === 'reject' || reqActionModal?.type === 'delete' ? 'danger' : 'primary'}
              onPress={confirmReqAction}
            >
              {reqActionModal?.type === 'approve' && 'Approve'}
              {reqActionModal?.type === 'ready' && 'Mark Ready'}
              {reqActionModal?.type === 'reject' && 'Reject'}
              {reqActionModal?.type === 'convert' && `Create ${new Set(Object.values(reqConvertSuppliers)).size || 0} PO(s)`}
              {reqActionModal?.type === 'delete' && 'Delete'}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Stock Operations Modals */}
      {/* Goods Receipt Modal */}
      <Modal isOpen={isGoodsReceiptOpen} onClose={onGoodsReceiptClose} size="4xl" scrollBehavior="inside">
        <ModalContent>
          <ModalHeader>
            Receive Goods
            <span className="block text-sm font-normal text-slate-500 mt-1 font-mono">
              {selectedPOForReceipt?.poNumber} · GRN # assigned on save
            </span>
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
                  <h4 className="font-semibold mb-2">This shipment</h4>
                  <Table>
                    <TableHeader>
                      <TableColumn>Item</TableColumn>
                      <TableColumn>Ordered</TableColumn>
                      <TableColumn>Already</TableColumn>
                      <TableColumn>Receive Now</TableColumn>
                      <TableColumn>Batch / Expiry</TableColumn>
                    </TableHeader>
                    <TableBody>
                      {receiptItems.map((item, index) => {
                        const remaining = Math.max(0, item.orderedQty - item.alreadyReceived);
                        return (
                          <TableRow key={item.itemId}>
                            <TableCell>
                              <div className="font-mono text-sm font-semibold">{item.itemCode}</div>
                              <div className="text-sm text-gray-500">{item.itemName}</div>
                            </TableCell>
                            <TableCell>
                              <div>{item.orderedQty}</div>
                              <div className="text-xs text-gray-500">₵{item.unitCost.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
                            </TableCell>
                            <TableCell>
                              <div className="text-sm">{item.alreadyReceived}</div>
                              <div className="text-xs text-gray-400">left {remaining}</div>
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                value={String(item.receiveNow)}
                                onChange={(e) => {
                                  const newQty = Math.min(Math.max(0, parseInt(e.target.value) || 0), remaining);
                                  const updatedItems = [...receiptItems];
                                  updatedItems[index] = { ...item, receiveNow: newQty };
                                  setReceiptItems(updatedItems);
                                }}
                                min={0}
                                max={remaining}
                                size="sm"
                                isDisabled={remaining === 0}
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                placeholder="Batch #"
                                value={item.batchNumber || ''}
                                onChange={(e) => {
                                  const updatedItems = [...receiptItems];
                                  updatedItems[index] = { ...item, batchNumber: e.target.value };
                                  setReceiptItems(updatedItems);
                                }}
                                size="sm"
                                className="mb-1"
                              />
                              <Input
                                type="date"
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
            <Button color="primary" className="bg-ghana-green text-white" onPress={handleReceiveGoods}>
              Receive & Create GRN
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* GRN View Modal */}
      <Modal isOpen={isGRNViewOpen} onClose={onGRNViewClose} size="4xl" scrollBehavior="inside">
        <ModalContent>
          <ModalHeader>
            <div>
              <div className="text-xl font-semibold">GRN Details</div>
              <div className="text-sm text-gray-500 font-mono">{viewingGRN?.grnNumber}</div>
            </div>
          </ModalHeader>
          <ModalBody>
            {viewingGRN && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-gray-500 mb-1">PO</div>
                    <div className="font-mono font-semibold">{viewingGRN.poNumber}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Supplier</div>
                    <div className="font-semibold">{viewingGRN.supplierName}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Receipt Date</div>
                    <div>{viewingGRN.receiptDate instanceof Date ? viewingGRN.receiptDate.toLocaleDateString() : new Date(viewingGRN.receiptDate).toLocaleDateString()}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Status</div>
                    <Badge
                      color={
                        viewingGRN.status === 'approved' || viewingGRN.status === 'completed' ? 'success' :
                        viewingGRN.status === 'quality-check' ? 'primary' :
                        viewingGRN.status === 'rejected' ? 'danger' : 'warning'
                      }
                      variant="flat"
                      className="capitalize"
                    >
                      {viewingGRN.status.replace('-', ' ')}
                    </Badge>
                    {viewingGRN.qualityStatus && (
                      <span className="ml-2 text-sm text-slate-500">QC: {viewingGRN.qualityStatus}</span>
                    )}
                  </div>
                </div>
                <Divider />
                <Table>
                  <TableHeader>
                    <TableColumn>Item</TableColumn>
                    <TableColumn>Ordered</TableColumn>
                    <TableColumn>Received</TableColumn>
                    <TableColumn className="text-right">Value</TableColumn>
                  </TableHeader>
                  <TableBody>
                    {viewingGRN.items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div className="font-mono text-sm">{item.itemCode}</div>
                          <div className="text-sm text-gray-500">{item.itemName}</div>
                        </TableCell>
                        <TableCell>{item.orderedQuantity}</TableCell>
                        <TableCell>{item.receivedQuantity}</TableCell>
                        <TableCell className="text-right font-semibold">
                          ₵{item.totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="flex justify-between bg-gray-50 p-3 rounded-lg">
                  <span className="font-semibold">Total</span>
                  <span className="font-semibold">
                    ₵{viewingGRN.totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            )}
          </ModalBody>
          <ModalFooter className="flex flex-wrap gap-2">
            <Button variant="bordered" onPress={onGRNViewClose}>Close</Button>
            {viewingGRN?.status === 'pending' && (
              <Button
                color="warning"
                onPress={() => {
                  onGRNViewClose();
                  openQualityCheck(viewingGRN);
                }}
              >
                🔍 Quality Check
              </Button>
            )}
            {viewingGRN?.status === 'quality-check' && (
              <>
                <Button
                  color="success"
                  onPress={() => {
                    if (confirm('Approve this GRN? Posts inventory & AP.')) {
                      approveGRN(viewingGRN.id, currentUserName);
                      setViewingGRN(getGRN(viewingGRN.id) || { ...viewingGRN, status: 'approved' });
                      trackEvent('Stores.Issued', { action: 'approve_grn', grnNumber: viewingGRN.grnNumber });
                    }
                  }}
                >
                  ✓ Approve
                </Button>
                <Button
                  color="danger"
                  variant="flat"
                  onPress={() => {
                    const reason = prompt('Enter rejection reason:');
                    if (reason) {
                      rejectGRN(viewingGRN.id, currentUserName, reason);
                      setViewingGRN(getGRN(viewingGRN.id) || { ...viewingGRN, status: 'rejected' });
                      trackEvent('Stores.Issued', { action: 'reject_grn', grnNumber: viewingGRN.grnNumber });
                    }
                  }}
                >
                  ✗ Reject
                </Button>
              </>
            )}
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Quality Check Modal */}
      <Modal isOpen={isQualityCheckOpen} onClose={onQualityCheckClose} size="4xl" scrollBehavior="inside">
        <ModalContent>
          <ModalHeader>
            Quality Check
            <span className="block text-sm font-normal text-slate-500 mt-1 font-mono">
              {selectedGRNForQC?.grnNumber}
            </span>
          </ModalHeader>
          <ModalBody>
            {selectedGRNForQC && (
              <div className="space-y-4">
                <p className="text-sm text-slate-500">
                  Mark failed qty per line. Zero failed = pass. Completing QC unlocks Approve on the GRN.
                </p>
                <Table>
                  <TableHeader>
                    <TableColumn>Item</TableColumn>
                    <TableColumn>Received</TableColumn>
                    <TableColumn>Failed Qty</TableColumn>
                    <TableColumn>Reason</TableColumn>
                  </TableHeader>
                  <TableBody>
                    {(qualityCheckFormData.items || []).map((item: any, index: number) => (
                      <TableRow key={item.id || index}>
                        <TableCell>
                          <div className="font-mono text-sm">{item.itemCode}</div>
                          <div className="text-sm text-gray-500">{item.itemName}</div>
                        </TableCell>
                        <TableCell>{item.receivedQuantity}</TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            size="sm"
                            min={0}
                            max={item.receivedQuantity}
                            value={String(item.failedQuantity || 0)}
                            onChange={(e) => {
                              const failed = Math.min(Math.max(0, parseInt(e.target.value) || 0), item.receivedQuantity);
                              const items = [...(qualityCheckFormData.items || [])];
                              items[index] = { ...item, failedQuantity: failed, checkedQuantity: item.receivedQuantity };
                              setQualityCheckFormData({ ...qualityCheckFormData, items });
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            size="sm"
                            placeholder="If failed…"
                            value={item.failureReason || ''}
                            onChange={(e) => {
                              const items = [...(qualityCheckFormData.items || [])];
                              items[index] = { ...item, failureReason: e.target.value };
                              setQualityCheckFormData({ ...qualityCheckFormData, items });
                            }}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <Textarea
                  label="Notes"
                  value={qualityCheckFormData.notes || ''}
                  onChange={(e) => setQualityCheckFormData({ ...qualityCheckFormData, notes: e.target.value })}
                />
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="bordered" onPress={onQualityCheckClose}>Cancel</Button>
            <Button color="primary" className="bg-ghana-gold text-white" onPress={handleSubmitQualityCheck}>
              Submit QC
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Goods Issue View Modal */}
      <Modal isOpen={isGoodsIssueViewOpen} onClose={onGoodsIssueViewClose} size="3xl" scrollBehavior="inside">
        <ModalContent>
          <ModalHeader>
            <div>
              <div className="text-xl font-semibold">Goods Issue</div>
              <div className="text-sm text-gray-500 font-mono">{viewingGoodsIssue?.issueNumber}</div>
            </div>
          </ModalHeader>
          <ModalBody>
            {viewingGoodsIssue && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Department</div>
                    <div className="font-semibold">{viewingGoodsIssue.department}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Issued To</div>
                    <div className="font-semibold">{viewingGoodsIssue.issuedTo}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Date</div>
                    <div>{viewingGoodsIssue.issueDate instanceof Date ? viewingGoodsIssue.issueDate.toLocaleDateString() : new Date(viewingGoodsIssue.issueDate).toLocaleDateString()}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 mb-1">By</div>
                    <div>{viewingGoodsIssue.issuedBy}</div>
                  </div>
                </div>
                <Divider />
                <Table>
                  <TableHeader>
                    <TableColumn>Item</TableColumn>
                    <TableColumn>Qty</TableColumn>
                    <TableColumn className="text-right">Value</TableColumn>
                    <TableColumn>Reason</TableColumn>
                  </TableHeader>
                  <TableBody>
                    {viewingGoodsIssue.items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div className="font-mono text-sm">{item.itemCode}</div>
                          <div className="text-sm text-gray-500">{item.itemName}</div>
                        </TableCell>
                        <TableCell>{item.quantity}</TableCell>
                        <TableCell className="text-right font-semibold">
                          ₵{item.totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-sm text-slate-600">{item.reason || '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="flex justify-between bg-gray-50 p-3 rounded-lg">
                  <span className="font-semibold">Total</span>
                  <span className="font-semibold">
                    ₵{viewingGoodsIssue.totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                {viewingGoodsIssue.notes && (
                  <p className="text-sm text-slate-600">{viewingGoodsIssue.notes}</p>
                )}
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="bordered" onPress={onGoodsIssueViewClose}>Close</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Goods Issue Modal */}
      <Modal isOpen={isGoodsIssueOpen} onClose={onGoodsIssueClose} size="4xl" scrollBehavior="inside">
        <ModalContent>
          <ModalHeader>
            Issue Goods
            <span className="block text-sm font-normal text-slate-500 mt-1">
              Pull stock from Stores for a department or person. Number assigned on save.
            </span>
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
                  placeholder="Person name"
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
                        const filtered = getFilteredIssueItems(index);
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
                                        quantity: item.quantity || 1,
                                        unitCost: selectedItem.unitCost,
                                        reason: item.reason
                                      };
                                      setIssueFormData({ ...issueFormData, items: updatedItems });
                                      setIssueItemSearchTerms((prev) => {
                                        const next = { ...prev };
                                        delete next[index];
                                        return next;
                                      });
                                    }
                                  }
                                }}
                                onInputChange={(value) => {
                                  setIssueItemSearchTerms((prev) => ({ ...prev, [index]: value }));
                                }}
                                inputValue={
                                  issueItemSearchTerms[index] !== undefined
                                    ? issueItemSearchTerms[index]
                                    : item.itemCode
                                      ? `${item.itemCode} - ${item.itemName}`
                                      : ''
                                }
                                size="sm"
                                allowsCustomValue={false}
                              >
                                <>
                                  {filtered.map((stockItem: StockItem) => (
                                    <AutocompleteItem key={stockItem.itemCode} textValue={`${stockItem.itemCode} ${stockItem.name}`}>
                                      <div className="flex flex-col">
                                        <span className="font-semibold">{stockItem.itemCode}</span>
                                        <span className="text-sm text-gray-500">{stockItem.name} · {stockItem.currentStock} {stockItem.unit}</span>
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
                    No items yet — add lines to issue.
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
            <Button color="primary" className="bg-ghana-gold text-white" onPress={handleIssueGoods}>
              Issue Goods
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Stock Transfer Modal */}
      <Modal isOpen={isStockTransferOpen} onClose={onStockTransferClose} size="4xl" scrollBehavior="inside">
        <ModalContent>
          <ModalHeader>
            {editingStockTransfer ? 'Edit Stock Transfer' : 'Create Stock Transfer'}
          </ModalHeader>
          <ModalBody>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Transfer #"
                  value={stockTransferFormData.transferNumber || ''}
                  isReadOnly
                  description="Auto from Settings → Document Numbering → Stock Transfer"
                  classNames={{ input: 'font-mono font-semibold' }}
                />
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

              <Divider />

              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold">Transfer Items</h4>
                  <Button
                    size="sm"
                    color="primary"
                    isDisabled={!stockTransferFormData.fromLocation}
                    onPress={() => {
                      const newItem: StockTransferItem = {
                        id: Date.now().toString(),
                        itemId: '',
                        itemCode: '',
                        itemName: '',
                        quantity: 1,
                        unitCost: 0,
                        totalValue: 0,
                        transferredQuantity: 0
                      };
                      setStockTransferFormData({
                        ...stockTransferFormData,
                        items: [...(stockTransferFormData.items || []), newItem]
                      });
                    }}
                  >
                    + Add Item
                  </Button>
                </div>
                {!stockTransferFormData.fromLocation && (
                  <p className="text-sm text-amber-600 mb-2">Select a From location before adding items.</p>
                )}
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
                      {stockTransferFormData.items.map((item, index) => {
                        const filtered = getFilteredTransferItems(index);
                        return (
                        <TableRow key={item.id}>
                          <TableCell className="w-[40%]">
                            <Autocomplete
                              placeholder="🔍 Search item at from location..."
                              selectedKey={item.itemCode || undefined}
                              onSelectionChange={(key) => {
                                if (key && stockTransferFormData.fromLocation) {
                                  const selectedItem = stockItems.find(i => 
                                    i.itemCode === String(key) && i.location === stockTransferFormData.fromLocation
                                  );
                                  if (selectedItem) {
                                    const updatedItems = [...(stockTransferFormData.items || [])];
                                    const qty = item.quantity || 1;
                                    updatedItems[index] = {
                                      ...item,
                                      itemId: selectedItem.id,
                                      itemCode: selectedItem.itemCode,
                                      itemName: selectedItem.name,
                                      unitCost: selectedItem.unitCost,
                                      quantity: qty,
                                      totalValue: qty * selectedItem.unitCost
                                    };
                                    setStockTransferFormData({ ...stockTransferFormData, items: updatedItems });
                                    setTransferItemSearchTerms((prev) => {
                                      const next = { ...prev };
                                      delete next[index];
                                      return next;
                                    });
                                  }
                                }
                              }}
                              onInputChange={(value) => {
                                setTransferItemSearchTerms((prev) => ({ ...prev, [index]: value }));
                              }}
                              inputValue={
                                transferItemSearchTerms[index] !== undefined
                                  ? transferItemSearchTerms[index]
                                  : item.itemCode
                                    ? `${item.itemCode} - ${item.itemName}`
                                    : ''
                              }
                              size="sm"
                              allowsCustomValue={false}
                            >
                              <>
                                {filtered.map((stockItem: StockItem) => (
                                  <AutocompleteItem key={stockItem.itemCode} textValue={`${stockItem.itemCode} ${stockItem.name}`}>
                                    <div className="flex flex-col">
                                      <span className="font-semibold">{stockItem.itemCode}</span>
                                      <span className="text-sm text-gray-500">{stockItem.name} · {stockItem.currentStock} {stockItem.unit}</span>
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
                        );
                      })}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    No items yet — select From location, then add lines.
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
            <Button color="primary" className="bg-ghana-green text-white" onPress={handleSaveStockTransfer}>
              {editingStockTransfer ? 'Update' : 'Create'} Transfer
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Stock Count Modal */}
      <Modal isOpen={isStockCountOpen} onClose={onStockCountClose} size="4xl" scrollBehavior="inside">
        <ModalContent>
          <ModalHeader>
            {editingStockCount ? 'Edit Stock Count' : 'Create Stock Count'}
          </ModalHeader>
          <ModalBody>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Count #"
                  value={stockCountFormData.countNumber || ''}
                  isReadOnly
                  description="Auto from Settings → Document Numbering → Stock Count"
                  classNames={{ input: 'font-mono font-semibold' }}
                />
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
                        .filter((i) => i.location === selectedLocation)
                        .map((item) => ({
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
                    {availableLocations.map((loc) => (
                      <SelectItem key={loc}>{loc}</SelectItem>
                    ))}
                  </>
                </Select>
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
              </div>

              {stockCountFormData.items && stockCountFormData.items.length > 0 ? (
                <>
                  <Divider />
                  <div>
                    <h4 className="font-semibold mb-2">Count lines ({stockCountFormData.items.length})</h4>
                    <Table>
                      <TableHeader>
                        <TableColumn>Item</TableColumn>
                        <TableColumn>Book</TableColumn>
                        <TableColumn>Counted</TableColumn>
                        <TableColumn>Δ</TableColumn>
                        <TableColumn className="text-right">Δ Value</TableColumn>
                      </TableHeader>
                      <TableBody>
                        {stockCountFormData.items.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell>
                              <div className="font-mono text-sm font-semibold">{item.itemCode}</div>
                              <div className="text-sm text-gray-500">{item.itemName}</div>
                            </TableCell>
                            <TableCell className="font-semibold">{item.expectedQuantity}</TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                value={String(item.countedQuantity)}
                                onChange={(e) => {
                                  const counted = parseInt(e.target.value) || 0;
                                  const variance = counted - item.expectedQuantity;
                                  const updatedItems = (stockCountFormData.items || []).map((i) =>
                                    i.id === item.id
                                      ? {
                                          ...i,
                                          countedQuantity: counted,
                                          variance,
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
                            <TableCell>
                              <div className={`font-semibold ${item.variance > 0 ? 'text-green-600' : item.variance < 0 ? 'text-red-600' : 'text-gray-600'}`}>
                                {item.variance > 0 ? '+' : ''}{item.variance}
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-semibold">
                              {item.varianceValue > 0 ? `₵${item.varianceValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </>
              ) : (
                <p className="text-sm text-amber-600">Select a location to load items for counting.</p>
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
            <Button color="primary" className="bg-ghana-gold text-white" onPress={handleSaveStockCount}>
              {editingStockCount ? 'Update' : 'Save'} Count
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
          <ModalFooter className="flex flex-wrap gap-2">
            <Button variant="bordered" onPress={onStockTransferViewClose}>Close</Button>
            {viewingStockTransfer?.status === 'pending' && (
              <Button
                color="warning"
                variant="flat"
                onPress={() => {
                  onStockTransferViewClose();
                  setEditingStockTransfer(viewingStockTransfer);
                  setStockTransferFormData({ ...viewingStockTransfer, items: viewingStockTransfer.items });
                  setTransferItemSearchTerms({});
                  onStockTransferOpen();
                }}
              >
                ✏️ Edit
              </Button>
            )}
            {viewingStockTransfer?.status === 'pending' && (
              <Button color="warning" onPress={() => handleTransferStatusChange(viewingStockTransfer, 'in-transit')}>
                🚚 Mark In Transit
              </Button>
            )}
            {viewingStockTransfer && (viewingStockTransfer.status === 'pending' || viewingStockTransfer.status === 'in-transit') && (
              <Button color="success" onPress={() => handleTransferStatusChange(viewingStockTransfer, 'delivered')}>
                ✅ Mark Delivered
              </Button>
            )}
            {viewingStockTransfer && (viewingStockTransfer.status === 'pending' || viewingStockTransfer.status === 'in-transit') && (
              <Button color="danger" variant="flat" onPress={() => handleTransferStatusChange(viewingStockTransfer, 'cancelled')}>
                ❌ Cancel
              </Button>
            )}
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
          <ModalFooter className="flex flex-wrap gap-2">
            <Button variant="bordered" onPress={onStockCountViewClose}>Close</Button>
            {viewingStockCount && viewingStockCount.status === 'in-progress' && (
              <Button
                color="warning"
                variant="flat"
                onPress={() => {
                  onStockCountViewClose();
                  setEditingStockCount(viewingStockCount);
                  setStockCountFormData({ ...viewingStockCount, items: viewingStockCount.items });
                  onStockCountOpen();
                }}
              >
                ✏️ Edit Counts
              </Button>
            )}
            {viewingStockCount && viewingStockCount.status === 'in-progress' && (
              <Button
                color="success"
                onPress={() => {
                  if (confirm('Complete this stock count? Variances will adjust on-hand stock.')) {
                    handleCompleteStockCount(viewingStockCount);
                  }
                }}
              >
                ✅ Complete & Post
              </Button>
            )}
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Supplier Invoice — Create */}
      <Modal
        isOpen={isInvoiceModalOpen}
        onClose={() => {
          onInvoiceModalClose();
          setInvoiceFormData({ items: [] });
          setSelectedPOForInvoice(null);
        }}
        size="4xl"
        scrollBehavior="inside"
      >
        <ModalContent>
          <ModalHeader>
            {editingInvoice ? 'Edit Supplier Invoice' : 'Create Supplier Invoice'}
          </ModalHeader>
          <ModalBody>
            <p className="text-sm text-slate-500 -mt-1 mb-2">
              Pick a PO — lines fill from the order (and GRN qty when one exists). Then save for three-way match.
            </p>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Select
                  label="Purchase Order"
                  placeholder="Select PO"
                  selectedKeys={invoiceFormData.poId ? [invoiceFormData.poId] : []}
                  onSelectionChange={(keys) => {
                    const id = Array.from(keys)[0] as string;
                    if (id) handleInvoicePOChange(id);
                  }}
                  isRequired
                >
                  {supplierStorePurchaseOrders
                    .filter((po) => ['confirmed', 'in-transit', 'delivered', 'closed'].includes(po.status))
                    .map((po) => (
                      <SelectItem key={po.id} textValue={`${po.poNumber} — ${po.supplierName}`}>
                        {po.poNumber} — {po.supplierName}
                      </SelectItem>
                    ))}
                </Select>
                <Input
                  label="Invoice #"
                  value={generateNextInvoiceNumber()}
                  isReadOnly
                  description="Assigned on save"
                  classNames={{ input: 'font-mono font-semibold' }}
                />
                <Input
                  label="Supplier"
                  value={invoiceFormData.supplierName || ''}
                  isReadOnly
                />
                <Input
                  label="Linked GRN"
                  value={invoiceFormData.grnNumber || 'None yet'}
                  isReadOnly
                />
                <Input
                  label="Invoice Date"
                  type="date"
                  value={
                    invoiceFormData.invoiceDate instanceof Date
                      ? invoiceFormData.invoiceDate.toISOString().split('T')[0]
                      : invoiceFormData.invoiceDate
                        ? new Date(invoiceFormData.invoiceDate).toISOString().split('T')[0]
                        : new Date().toISOString().split('T')[0]
                  }
                  onChange={(e) =>
                    setInvoiceFormData({ ...invoiceFormData, invoiceDate: new Date(e.target.value) })
                  }
                  isRequired
                />
                <Input
                  label="Due Date"
                  type="date"
                  value={
                    invoiceFormData.dueDate instanceof Date
                      ? invoiceFormData.dueDate.toISOString().split('T')[0]
                      : invoiceFormData.dueDate
                        ? new Date(invoiceFormData.dueDate).toISOString().split('T')[0]
                        : ''
                  }
                  onChange={(e) =>
                    setInvoiceFormData({ ...invoiceFormData, dueDate: new Date(e.target.value) })
                  }
                  isRequired
                />
              </div>

              {(invoiceFormData.items || []).length > 0 && (
                <>
                  <Divider />
                  <Table aria-label="Invoice lines">
                    <TableHeader>
                      <TableColumn>Item</TableColumn>
                      <TableColumn className="text-right">Qty</TableColumn>
                      <TableColumn className="text-right">Unit Price</TableColumn>
                      <TableColumn className="text-right">Total</TableColumn>
                    </TableHeader>
                    <TableBody>
                      {(invoiceFormData.items || []).map((item, index) => (
                        <TableRow key={item.id}>
                          <TableCell>
                            <div className="font-mono text-sm font-semibold">{item.itemCode}</div>
                            <div className="text-xs text-gray-500">{item.itemName}</div>
                          </TableCell>
                          <TableCell className="text-right">
                            <Input
                              type="number"
                              size="sm"
                              className="max-w-[100px] ml-auto"
                              value={String(item.quantity)}
                              onChange={(e) => {
                                const quantity = parseFloat(e.target.value) || 0;
                                const items = [...(invoiceFormData.items || [])];
                                items[index] = {
                                  ...item,
                                  quantity,
                                  totalPrice: quantity * item.unitPrice,
                                };
                                const subtotal = items.reduce((s, i) => s + i.totalPrice, 0);
                                const taxAmount = Number(invoiceFormData.taxAmount || 0);
                                const shippingAmount = Number(invoiceFormData.shippingAmount || 0);
                                const discountAmount = Number(invoiceFormData.discountAmount || 0);
                                setInvoiceFormData({
                                  ...invoiceFormData,
                                  items,
                                  subtotal,
                                  totalAmount: subtotal + taxAmount + shippingAmount - discountAmount,
                                });
                              }}
                            />
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            ₵{Number(item.unitPrice).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell className="text-right font-semibold tabular-nums">
                            ₵{Number(item.totalPrice).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <div className="bg-gray-50 p-4 rounded-lg space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>Subtotal</span>
                      <span className="tabular-nums">₵{Number(invoiceFormData.subtotal || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Tax</span>
                      <span className="tabular-nums">₵{Number(invoiceFormData.taxAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between font-bold text-base pt-1 border-t">
                      <span>Total</span>
                      <span className="tabular-nums">₵{Number(invoiceFormData.totalAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                </>
              )}

              <Textarea
                label="Notes"
                value={invoiceFormData.notes || ''}
                onChange={(e) => setInvoiceFormData({ ...invoiceFormData, notes: e.target.value })}
                minRows={2}
              />
            </div>
          </ModalBody>
          <ModalFooter>
            <Button
              variant="bordered"
              onPress={() => {
                onInvoiceModalClose();
                setInvoiceFormData({ items: [] });
                setSelectedPOForInvoice(null);
              }}
            >
              Cancel
            </Button>
            <Button color="primary" className="bg-ghana-gold text-white" onPress={handleSaveInvoice}>
              Save Invoice
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Supplier Invoice — View */}
      <Modal isOpen={isInvoiceViewOpen} onClose={onInvoiceViewClose} size="4xl" scrollBehavior="inside">
        <ModalContent>
          <ModalHeader>
            Invoice Details — {viewingInvoice?.invoiceNumber}
            <span className="block text-sm font-normal text-slate-500 mt-1">
              Review, then match / approve / pay from here.
            </span>
          </ModalHeader>
          <ModalBody>
            {viewingInvoice && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Invoice #</div>
                    <div className="font-mono font-semibold">{viewingInvoice.invoiceNumber}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Status</div>
                    <Badge
                      color={
                        viewingInvoice.status === 'paid' ? 'success' :
                        viewingInvoice.status === 'approved' ? 'primary' :
                        viewingInvoice.status === 'matched' ? 'warning' :
                        viewingInvoice.status === 'rejected' || viewingInvoice.status === 'cancelled' ? 'danger' : 'default'
                      }
                      variant="flat"
                    >
                      {viewingInvoice.status}
                    </Badge>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Supplier</div>
                    <div className="font-semibold">{viewingInvoice.supplierName}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 mb-1">PO</div>
                    <div className="font-mono">{viewingInvoice.poNumber}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 mb-1">GRN</div>
                    <div className="font-mono">{viewingInvoice.grnNumber || '—'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Total</div>
                    <div className="font-semibold tabular-nums">
                      ₵{Number(viewingInvoice.totalAmount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>
                <Divider />
                <Table aria-label="Invoice items">
                  <TableHeader>
                    <TableColumn>Item</TableColumn>
                    <TableColumn className="text-right">Qty</TableColumn>
                    <TableColumn className="text-right">Unit Price</TableColumn>
                    <TableColumn className="text-right">Total</TableColumn>
                  </TableHeader>
                  <TableBody>
                    {viewingInvoice.items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div className="font-mono text-sm">{item.itemCode}</div>
                          <div className="text-xs text-gray-500">{item.itemName}</div>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{item.quantity}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          ₵{Number(item.unitPrice).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">
                          ₵{Number(item.totalPrice).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {viewingInvoice.matchingStatus?.discrepancies?.length > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm">
                    <div className="font-semibold mb-1">Match notes</div>
                    <ul className="list-disc pl-5 space-y-0.5 text-amber-900">
                      {viewingInvoice.matchingStatus.discrepancies.map((d, i) => (
                        <li key={i}>{d}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </ModalBody>
          <ModalFooter className="flex flex-wrap gap-2">
            <Button variant="bordered" onPress={onInvoiceViewClose}>Close</Button>
            {viewingInvoice?.status === 'pending' && (
              <Button
                color="warning"
                variant="flat"
                onPress={() => {
                  onInvoiceViewClose();
                  setMatchResult(null);
                  onThreeWayMatchOpen();
                }}
              >
                🔗 3-Way Match
              </Button>
            )}
            {viewingInvoice?.status === 'matched' && (
              <>
                <Button
                  color="success"
                  onPress={() => {
                    if (confirm('Approve this invoice for payment?')) {
                      approveInvoice(viewingInvoice.id, currentUserName);
                      trackEvent('Stores.Issued', { action: 'approve_invoice', invoiceNumber: viewingInvoice.invoiceNumber });
                      setViewingInvoice({ ...viewingInvoice, status: 'approved' });
                    }
                  }}
                >
                  ✓ Approve
                </Button>
                <Button
                  color="danger"
                  variant="flat"
                  onPress={() => {
                    const reason = prompt('Enter rejection reason:');
                    if (reason) {
                      rejectInvoice(viewingInvoice.id, currentUserName, reason);
                      trackEvent('Stores.Issued', { action: 'reject_invoice', invoiceNumber: viewingInvoice.invoiceNumber });
                      setViewingInvoice({ ...viewingInvoice, status: 'rejected' });
                    }
                  }}
                >
                  ✗ Reject
                </Button>
              </>
            )}
            {viewingInvoice?.status === 'approved' && (
              <Button
                color="success"
                onPress={() => {
                  const method = prompt('Enter payment method (e.g., Bank Transfer, Check, Cash):');
                  const ref = prompt('Enter payment reference:');
                  if (method && ref) {
                    markInvoicePaid(viewingInvoice.id, currentUserName, method, ref);
                    trackEvent('Stores.Issued', { action: 'mark_invoice_paid', invoiceNumber: viewingInvoice.invoiceNumber });
                    setViewingInvoice({ ...viewingInvoice, status: 'paid' });
                  }
                }}
              >
                💰 Mark Paid
              </Button>
            )}
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Supplier Invoice — 3-Way Match */}
      <Modal
        isOpen={isThreeWayMatchOpen}
        onClose={() => {
          onThreeWayMatchClose();
          setMatchResult(null);
        }}
        size="lg"
      >
        <ModalContent>
          <ModalHeader>Three-Way Match — {viewingInvoice?.invoiceNumber}</ModalHeader>
          <ModalBody>
            <p className="text-sm text-slate-600 mb-3">
              Compares invoice lines to the PO and approved GRN (qty, price, totals).
            </p>
            {viewingInvoice && (
              <div className="grid grid-cols-3 gap-3 text-sm mb-4">
                <div className="bg-slate-50 rounded-lg p-3">
                  <div className="text-xs text-gray-500">PO</div>
                  <div className="font-mono font-semibold">{viewingInvoice.poNumber}</div>
                </div>
                <div className="bg-slate-50 rounded-lg p-3">
                  <div className="text-xs text-gray-500">GRN</div>
                  <div className="font-mono font-semibold">{viewingInvoice.grnNumber || '—'}</div>
                </div>
                <div className="bg-slate-50 rounded-lg p-3">
                  <div className="text-xs text-gray-500">Invoice total</div>
                  <div className="font-semibold tabular-nums">
                    ₵{Number(viewingInvoice.totalAmount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </div>
                </div>
              </div>
            )}
            {matchResult && (
              <div
                className={`rounded-lg p-3 text-sm border ${
                  matchResult.matched
                    ? 'bg-green-50 border-green-200 text-green-900'
                    : 'bg-amber-50 border-amber-200 text-amber-900'
                }`}
              >
                <div className="font-semibold mb-1">
                  {matchResult.matched ? '✓ Matched' : '⚠ Discrepancies found'}
                </div>
                {matchResult.discrepancies.length > 0 ? (
                  <ul className="list-disc pl-5 space-y-0.5">
                    {matchResult.discrepancies.map((d, i) => (
                      <li key={i}>{d}</li>
                    ))}
                  </ul>
                ) : (
                  <p>PO, GRN, and invoice line up.</p>
                )}
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            <Button
              variant="bordered"
              onPress={() => {
                onThreeWayMatchClose();
                setMatchResult(null);
              }}
            >
              Close
            </Button>
            <Button color="warning" onPress={handleRunThreeWayMatch}>
              Run Match
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
