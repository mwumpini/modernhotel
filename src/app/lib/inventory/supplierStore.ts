import { create } from 'zustand';
import { Supplier, PurchaseOrder, PurchaseOrderItem, Requisition, GoodsReceiptNote, SupplierInvoice, QualityCheck } from './models';
import type { BusinessPartner } from '../accounting/models';
import { GL_ACCOUNTS } from '../accounting/integration';
import { useStockStore } from './stockStore';
import { computePurchaseTax } from '../tax/engine';
import { getClientTenantSubdomain } from '../api/clientTenant';
import { normalizeTenantSubdomain } from '../api/tenantSubdomain';
import { useSettingsStore } from '../settings/store';

function poTenantHeaders(): HeadersInit {
  const sub = normalizeTenantSubdomain(getClientTenantSubdomain());
  return { 'x-tenant-subdomain': sub, 'x-tenant-id': sub, 'Content-Type': 'application/json' };
}

// Persist a purchase order and return the server's authoritative record — the
// server (not this optimistic client guess) computes taxAmount/finalAmount for
// real (see repository.ts upsertPurchaseOrder), so callers must reconcile the
// store with this response instead of trusting the local totals past the
// optimistic first render.
function syncPurchaseOrderToApi(order: PurchaseOrder): Promise<PurchaseOrder | null> {
  if (typeof window === 'undefined') return Promise.resolve(null);
  return fetch('/api/inventory/purchase-orders', {
    method: 'PUT',
    headers: poTenantHeaders(),
    body: JSON.stringify({
      id: order.id,
      poNumber: order.poNumber,
      supplierId: order.supplierId,
      supplierName: order.supplierName,
      expectedDeliveryDate: order.expectedDeliveryDate,
      actualDeliveryDate: order.actualDeliveryDate,
      status: order.status,
      priority: order.priority,
      shippingAmount: order.shippingAmount,
      discountAmount: order.discountAmount,
      currency: order.currency,
      paymentTerms: order.paymentTerms,
      notes: order.notes,
      approvedBy: order.approvedBy,
      approvedAt: order.approvedAt,
      taxTypeId: order.taxTypeId,
      customTaxRate: order.customTaxRate,
      items: order.items.map((i) => ({
        itemId: i.itemId,
        itemCode: i.itemCode,
        itemName: i.itemName,
        quantity: i.quantity,
        unitCost: i.unitCost,
        receivedQuantity: i.receivedQuantity,
        notes: i.notes,
      })),
    }),
  })
    .then((r) => (r.ok ? r.json() : null))
    .then((data) => (data?.order ? mapApiOrderToStore(data.order) : null))
    .catch((e) => {
      console.warn('[Inventory] Failed to sync purchase order to server:', e);
      return null;
    });
}

function deletePurchaseOrderFromApi(id: string) {
  if (typeof window === 'undefined') return;
  fetch(`/api/inventory/purchase-orders?id=${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: poTenantHeaders(),
  }).catch((e) => console.warn('[Inventory] Failed to delete purchase order on server:', e));
}

// Prisma serializes Decimal as a string and DateTime as an ISO string over JSON —
// convert back to the numbers/Dates the rest of the app expects.
function mapApiOrderToStore(raw: any): PurchaseOrder {
  return {
    id: raw.id,
    poNumber: raw.poNumber,
    supplierId: raw.supplierId,
    supplierName: raw.supplierName,
    orderDate: new Date(raw.orderDate),
    expectedDeliveryDate: raw.expectedDeliveryDate ? new Date(raw.expectedDeliveryDate) : new Date(raw.orderDate),
    actualDeliveryDate: raw.actualDeliveryDate ? new Date(raw.actualDeliveryDate) : undefined,
    status: raw.status,
    priority: raw.priority,
    totalAmount: Number(raw.totalAmount),
    taxAmount: Number(raw.taxAmount),
    taxTypeId: raw.taxTypeId ?? undefined,
    shippingAmount: Number(raw.shippingAmount),
    discountAmount: Number(raw.discountAmount),
    finalAmount: Number(raw.finalAmount),
    currency: raw.currency,
    paymentTerms: raw.paymentTerms || '',
    notes: raw.notes ?? undefined,
    createdBy: raw.createdBy || 'system',
    approvedBy: raw.approvedBy ?? undefined,
    approvedAt: raw.approvedAt ? new Date(raw.approvedAt) : undefined,
    items: (raw.items || []).map((i: any) => ({
      id: i.id,
      itemId: i.itemId,
      itemCode: i.itemCode,
      itemName: i.itemName,
      quantity: Number(i.quantity),
      unitCost: Number(i.unitCost),
      totalCost: Number(i.totalCost),
      receivedQuantity: Number(i.receivedQuantity),
      notes: i.notes ?? undefined,
    })),
    createdAt: new Date(raw.createdAt),
    updatedAt: new Date(raw.updatedAt),
  };
}

// The real Supplier model only has a handful of columns (code, name, email, phone,
// contactPerson, taxNumber, address, isActive) — everything else the supplier form
// collects (payment terms, credit limit, rating, categories, contract dates,
// performance) lives in the `details` Json long-tail column, same pattern as
// hr/repository.ts's Employee.details.
function mapApiSupplierToStore(raw: any): Supplier {
  const addr = (raw.address || {}) as Record<string, any>;
  const details = (raw.details || {}) as Record<string, any>;
  return {
    id: raw.id,
    code: raw.code,
    name: raw.name,
    contactPerson: raw.contactPerson || '',
    email: raw.email || '',
    phone: raw.phone || '',
    address: addr.address || '',
    city: addr.city || '',
    country: addr.country || 'Ghana',
    postalCode: addr.postalCode || '',
    taxId: raw.taxNumber || '',
    paymentTerms: details.paymentTerms || 'net30',
    creditLimit: Number(details.creditLimit || 0),
    currentBalance: Number(details.currentBalance || 0),
    rating: Number(details.rating || 0),
    categories: details.categories || [],
    isActive: raw.isActive,
    contractStartDate: details.contractStartDate ? new Date(details.contractStartDate) : new Date(raw.createdAt),
    contractEndDate: details.contractEndDate ? new Date(details.contractEndDate) : undefined,
    performance: details.performance || { onTimeDelivery: 0, qualityRating: 0, responseTime: 0, totalOrders: 0 },
    notes: details.notes ?? undefined,
    createdAt: new Date(raw.createdAt),
    updatedAt: new Date(raw.updatedAt),
  };
}

function syncSupplierToApi(supplier: Partial<Supplier> & { id: string }) {
  if (typeof window === 'undefined') return;
  fetch('/api/inventory/suppliers', {
    method: 'POST',
    headers: poTenantHeaders(),
    body: JSON.stringify({
      id: supplier.id,
      code: supplier.code,
      name: supplier.name,
      email: supplier.email,
      phone: supplier.phone,
      contactPerson: supplier.contactPerson,
      taxNumber: supplier.taxId,
      isActive: supplier.isActive,
      address: {
        address: supplier.address,
        city: supplier.city,
        country: supplier.country,
        postalCode: supplier.postalCode,
      },
      details: {
        paymentTerms: supplier.paymentTerms,
        creditLimit: supplier.creditLimit,
        currentBalance: supplier.currentBalance,
        rating: supplier.rating,
        categories: supplier.categories,
        contractStartDate: supplier.contractStartDate,
        contractEndDate: supplier.contractEndDate,
        performance: supplier.performance,
        notes: supplier.notes,
      },
    }),
  }).catch((e) => console.warn('[Inventory] Failed to sync supplier to server:', e));
}

function deleteSupplierFromApi(id: string) {
  if (typeof window === 'undefined') return;
  fetch(`/api/inventory/suppliers?id=${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: poTenantHeaders(),
  }).catch((e) => console.warn('[Inventory] Failed to delete supplier on server:', e));
}

// Same previously-in-memory-only gap as purchase orders/suppliers — requisitions and
// goods receipt notes are real, live workflows (InventorySupplyChainDashboard.tsx) that
// had no Prisma model or API route at all.
function syncRequisitionToApi(req: Requisition) {
  if (typeof window === 'undefined') return;
  fetch('/api/inventory/requisitions', {
    method: 'PUT',
    headers: poTenantHeaders(),
    body: JSON.stringify({
      id: req.id,
      requisitionNumber: req.requisitionNumber,
      requestedBy: req.requestedBy,
      requestedDate: req.requestedDate,
      status: req.status,
      approvedBy: req.approvedBy,
      approvedAt: req.approvedAt,
      rejectedBy: req.rejectedBy,
      rejectedAt: req.rejectedAt,
      rejectionReason: req.rejectionReason,
      convertedToPOId: req.convertedToPOId,
      convertedToPONumber: req.convertedToPONumber,
      notes: req.notes,
      items: req.requestedItems.map((i) => ({
        itemId: i.itemId,
        itemCode: i.itemCode,
        itemName: i.itemName,
        quantity: i.quantity,
        estimatedPrice: i.estimatedPrice,
        notes: i.notes,
      })),
    }),
  }).catch((e) => console.warn('[Inventory] Failed to sync requisition to server:', e));
}

function deleteRequisitionFromApi(id: string) {
  if (typeof window === 'undefined') return;
  fetch(`/api/inventory/requisitions?id=${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: poTenantHeaders(),
  }).catch((e) => console.warn('[Inventory] Failed to delete requisition on server:', e));
}

function mapApiRequisitionToStore(raw: any): Requisition {
  return {
    id: raw.id,
    requisitionNumber: raw.requisitionNumber,
    requestedBy: raw.requestedBy,
    requestedDate: new Date(raw.requestedDate),
    requestedItems: (raw.items || []).map((i: any) => ({
      id: i.id,
      itemId: i.itemId,
      itemCode: i.itemCode,
      itemName: i.itemName,
      quantity: Number(i.quantity),
      estimatedPrice: Number(i.estimatedPrice),
      totalCost: Number(i.totalCost),
      notes: i.notes ?? undefined,
    })),
    status: raw.status,
    approvedBy: raw.approvedBy ?? undefined,
    approvedAt: raw.approvedAt ? new Date(raw.approvedAt) : undefined,
    rejectedBy: raw.rejectedBy ?? undefined,
    rejectedAt: raw.rejectedAt ? new Date(raw.rejectedAt) : undefined,
    rejectionReason: raw.rejectionReason ?? undefined,
    convertedToPOId: raw.convertedToPOId ?? undefined,
    convertedToPONumber: raw.convertedToPONumber ?? undefined,
    notes: raw.notes ?? undefined,
    createdAt: new Date(raw.createdAt),
    updatedAt: new Date(raw.updatedAt),
  };
}

function syncGRNToApi(grn: GoodsReceiptNote) {
  if (typeof window === 'undefined') return;
  fetch('/api/inventory/goods-receipt-notes', {
    method: 'PUT',
    headers: poTenantHeaders(),
    body: JSON.stringify({
      id: grn.id,
      grnNumber: grn.grnNumber,
      poId: grn.poId,
      poNumber: grn.poNumber,
      supplierId: grn.supplierId,
      supplierName: grn.supplierName,
      receiptDate: grn.receiptDate,
      receivedBy: grn.receivedBy,
      status: grn.status,
      qualityCheckedBy: grn.qualityCheckedBy,
      qualityCheckedAt: grn.qualityCheckedAt,
      qualityStatus: grn.qualityStatus,
      qualityNotes: grn.qualityNotes,
      approvedBy: grn.approvedBy,
      approvedAt: grn.approvedAt,
      notes: grn.notes,
      items: grn.items.map((i) => ({
        poItemId: i.poItemId,
        itemId: i.itemId,
        itemCode: i.itemCode,
        itemName: i.itemName,
        orderedQuantity: i.orderedQuantity,
        receivedQuantity: i.receivedQuantity,
        acceptedQuantity: i.acceptedQuantity,
        rejectedQuantity: i.rejectedQuantity,
        unitCost: i.unitCost,
      })),
    }),
  }).catch((e) => console.warn('[Inventory] Failed to sync goods receipt note to server:', e));
}

function mapApiGRNToStore(raw: any): GoodsReceiptNote {
  return {
    id: raw.id,
    grnNumber: raw.grnNumber,
    poId: raw.poId,
    poNumber: raw.poNumber,
    supplierId: raw.supplierId,
    supplierName: raw.supplierName,
    receiptDate: new Date(raw.receiptDate),
    receivedBy: raw.receivedBy,
    items: (raw.items || []).map((i: any) => ({
      id: i.id,
      poItemId: i.poItemId,
      itemId: i.itemId,
      itemCode: i.itemCode,
      itemName: i.itemName,
      orderedQuantity: Number(i.orderedQuantity),
      receivedQuantity: Number(i.receivedQuantity),
      acceptedQuantity: Number(i.acceptedQuantity),
      rejectedQuantity: Number(i.rejectedQuantity),
      unitCost: Number(i.unitCost),
      totalValue: Number(i.totalValue),
    })),
    totalItems: raw.totalItems,
    totalValue: Number(raw.totalValue),
    status: raw.status,
    qualityCheckedBy: raw.qualityCheckedBy ?? undefined,
    qualityCheckedAt: raw.qualityCheckedAt ? new Date(raw.qualityCheckedAt) : undefined,
    qualityStatus: raw.qualityStatus ?? undefined,
    qualityNotes: raw.qualityNotes ?? undefined,
    approvedBy: raw.approvedBy ?? undefined,
    approvedAt: raw.approvedAt ? new Date(raw.approvedAt) : undefined,
    notes: raw.notes ?? undefined,
    createdAt: new Date(raw.createdAt),
    updatedAt: new Date(raw.updatedAt),
  };
}

function syncQualityCheckToApi(check: QualityCheck) {
  if (typeof window === 'undefined') return;
  fetch('/api/inventory/quality-checks', {
    method: 'PUT',
    headers: poTenantHeaders(),
    body: JSON.stringify({
      id: check.id,
      checkNumber: check.checkNumber,
      grnId: check.grnId,
      grnNumber: check.grnNumber,
      poId: check.poId,
      poNumber: check.poNumber,
      supplierId: check.supplierId,
      supplierName: check.supplierName,
      checkedBy: check.checkedBy,
      checkedDate: check.checkedDate,
      overallStatus: check.overallStatus,
      notes: check.notes,
      approvedBy: check.approvedBy,
      approvedAt: check.approvedAt,
      items: check.items.map((i) => ({
        grnItemId: i.grnItemId,
        itemId: i.itemId,
        itemCode: i.itemCode,
        itemName: i.itemName,
        receivedQuantity: i.receivedQuantity,
        checkedQuantity: i.checkedQuantity,
        passedQuantity: i.passedQuantity,
        failedQuantity: i.failedQuantity,
        qualityStatus: i.qualityStatus,
        failureReason: i.failureReason,
        notes: i.notes,
      })),
    }),
  }).catch((e) => console.warn('[Inventory] Failed to sync quality check to server:', e));
}

function mapApiQualityCheckToStore(raw: any): QualityCheck {
  return {
    id: raw.id,
    checkNumber: raw.checkNumber,
    grnId: raw.grnId,
    grnNumber: raw.grnNumber,
    poId: raw.poId,
    poNumber: raw.poNumber,
    supplierId: raw.supplierId,
    supplierName: raw.supplierName,
    checkedBy: raw.checkedBy,
    checkedDate: new Date(raw.checkedDate),
    items: (raw.items || []).map((i: any) => ({
      id: i.id,
      grnItemId: i.grnItemId,
      itemId: i.itemId,
      itemCode: i.itemCode,
      itemName: i.itemName,
      receivedQuantity: Number(i.receivedQuantity),
      checkedQuantity: Number(i.checkedQuantity),
      passedQuantity: Number(i.passedQuantity),
      failedQuantity: Number(i.failedQuantity),
      qualityStatus: i.qualityStatus,
      failureReason: i.failureReason ?? undefined,
      notes: i.notes ?? undefined,
    })),
    overallStatus: raw.overallStatus,
    passedItems: raw.passedItems,
    failedItems: raw.failedItems,
    totalItems: raw.totalItems,
    notes: raw.notes ?? undefined,
    approvedBy: raw.approvedBy ?? undefined,
    approvedAt: raw.approvedAt ? new Date(raw.approvedAt) : undefined,
    createdAt: new Date(raw.createdAt),
    updatedAt: new Date(raw.updatedAt),
  };
}

function syncSupplierInvoiceToApi(invoice: SupplierInvoice) {
  if (typeof window === 'undefined') return;
  fetch('/api/inventory/supplier-invoices', {
    method: 'PUT',
    headers: poTenantHeaders(),
    body: JSON.stringify({
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      supplierId: invoice.supplierId,
      supplierName: invoice.supplierName,
      poId: invoice.poId,
      poNumber: invoice.poNumber,
      grnId: invoice.grnId,
      grnNumber: invoice.grnNumber,
      invoiceDate: invoice.invoiceDate,
      dueDate: invoice.dueDate,
      subtotal: invoice.subtotal,
      taxAmount: invoice.taxAmount,
      shippingAmount: invoice.shippingAmount,
      discountAmount: invoice.discountAmount,
      totalAmount: invoice.totalAmount,
      currency: invoice.currency,
      status: invoice.status,
      matchingStatus: invoice.matchingStatus,
      approvedBy: invoice.approvedBy,
      approvedAt: invoice.approvedAt,
      rejectedBy: invoice.rejectedBy,
      rejectedAt: invoice.rejectedAt,
      rejectionReason: invoice.rejectionReason,
      paidBy: invoice.paidBy,
      paidAt: invoice.paidAt,
      paymentMethod: invoice.paymentMethod,
      paymentReference: invoice.paymentReference,
      notes: invoice.notes,
      items: invoice.items.map((i) => ({
        poItemId: i.poItemId,
        grnItemId: i.grnItemId,
        itemId: i.itemId,
        itemCode: i.itemCode,
        itemName: i.itemName,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        notes: i.notes,
      })),
    }),
  }).catch((e) => console.warn('[Inventory] Failed to sync supplier invoice to server:', e));
}

function mapApiSupplierInvoiceToStore(raw: any): SupplierInvoice {
  return {
    id: raw.id,
    invoiceNumber: raw.invoiceNumber,
    supplierId: raw.supplierId,
    supplierName: raw.supplierName,
    poId: raw.poId,
    poNumber: raw.poNumber,
    grnId: raw.grnId ?? undefined,
    grnNumber: raw.grnNumber ?? undefined,
    invoiceDate: new Date(raw.invoiceDate),
    dueDate: new Date(raw.dueDate),
    items: (raw.items || []).map((i: any) => ({
      id: i.id,
      poItemId: i.poItemId,
      grnItemId: i.grnItemId ?? undefined,
      itemId: i.itemId,
      itemCode: i.itemCode,
      itemName: i.itemName,
      quantity: Number(i.quantity),
      unitPrice: Number(i.unitPrice),
      totalPrice: Number(i.totalPrice),
      notes: i.notes ?? undefined,
    })),
    subtotal: Number(raw.subtotal),
    taxAmount: Number(raw.taxAmount),
    shippingAmount: Number(raw.shippingAmount),
    discountAmount: Number(raw.discountAmount),
    totalAmount: Number(raw.totalAmount),
    currency: raw.currency,
    status: raw.status,
    matchingStatus: raw.matchingStatus || {
      isQuantityMatched: false,
      isPriceMatched: false,
      isTermsMatched: false,
      discrepancies: [],
    },
    approvedBy: raw.approvedBy ?? undefined,
    approvedAt: raw.approvedAt ? new Date(raw.approvedAt) : undefined,
    rejectedBy: raw.rejectedBy ?? undefined,
    rejectedAt: raw.rejectedAt ? new Date(raw.rejectedAt) : undefined,
    rejectionReason: raw.rejectionReason ?? undefined,
    paidBy: raw.paidBy ?? undefined,
    paidAt: raw.paidAt ? new Date(raw.paidAt) : undefined,
    paymentMethod: raw.paymentMethod ?? undefined,
    paymentReference: raw.paymentReference ?? undefined,
    notes: raw.notes ?? undefined,
    createdAt: new Date(raw.createdAt),
    updatedAt: new Date(raw.updatedAt),
  };
}

interface SupplierStore {
  suppliers: Supplier[];
  purchaseOrders: PurchaseOrder[];
  requisitions: Requisition[];
  goodsReceiptNotes: GoodsReceiptNote[];
  supplierInvoices: SupplierInvoice[];
  qualityChecks: QualityCheck[];
  selectedSupplier: Supplier | null;
  selectedPurchaseOrder: PurchaseOrder | null;
  selectedRequisition: Requisition | null;
  selectedGRN: GoodsReceiptNote | null;
  selectedInvoice: SupplierInvoice | null;
  _syncingToAccounting: boolean; // Internal flag to prevent circular sync
  
  // Supplier Management
  addSupplier: (supplier: Omit<Supplier, 'updatedAt'> & { id?: string; createdAt?: Date }, skipSync?: boolean) => void;
  updateSupplier: (id: string, updates: Partial<Supplier>, skipSync?: boolean) => void;
  deleteSupplier: (id: string) => void;
  hydrateSuppliersFromApi: () => Promise<void>;
  generateNextSupplierCode: () => string;
  getSupplier: (id: string) => Supplier | undefined;
  getSupplierByCode: (code: string) => Supplier | undefined;
  getSuppliersByCategory: (category: string) => Supplier[];
  getActiveSuppliers: () => Supplier[];
  
  // Purchase Order Management
  createPurchaseOrder: (order: Omit<PurchaseOrder, 'id' | 'createdAt' | 'updatedAt'>) => void;
  hydratePurchaseOrdersFromApi: () => Promise<void>;
  updatePurchaseOrder: (id: string, updates: Partial<PurchaseOrder>) => void;
  deletePurchaseOrder: (id: string) => void;
  getPurchaseOrder: (id: string) => PurchaseOrder | undefined;
  getPurchaseOrdersBySupplier: (supplierId: string) => PurchaseOrder[];
  getPurchaseOrdersByStatus: (status: PurchaseOrder['status']) => PurchaseOrder[];
  getPurchaseOrdersByDateRange: (startDate: Date, endDate: Date) => PurchaseOrder[];
  
  // Purchase Order Items Management
  addPurchaseOrderItem: (orderId: string, item: Omit<PurchaseOrderItem, 'id'>) => void;
  updatePurchaseOrderItem: (orderId: string, itemId: string, updates: Partial<PurchaseOrderItem>) => void;
  removePurchaseOrderItem: (orderId: string, itemId: string) => void;
  
  // Purchase Order Workflow
  sendPurchaseOrder: (orderId: string) => void;
  confirmPurchaseOrder: (orderId: string, supplierId: string) => void;
  markInTransit: (orderId: string) => void;
  markDelivered: (orderId: string, actualDeliveryDate: Date) => void;
  cancelPurchaseOrder: (orderId: string, reason: string) => void;
  closePurchaseOrder: (orderId: string) => void;
  
  // Requisition Management
  createRequisition: (requisition: Omit<Requisition, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateRequisition: (id: string, updates: Partial<Requisition>) => void;
  deleteRequisition: (id: string) => void;
  hydrateRequisitionsFromApi: () => Promise<void>;
  approveRequisition: (id: string, approvedBy: string) => void;
  rejectRequisition: (id: string, rejectedBy: string, reason?: string) => void;
  convertRequisitionToPO: (requisitionId: string, supplierId: string) => PurchaseOrder | null;
  getRequisition: (id: string) => Requisition | undefined;
  getRequisitionsByStatus: (status: Requisition['status']) => Requisition[];
  
  // Selection
  selectSupplier: (supplier: Supplier | null) => void;
  selectPurchaseOrder: (order: PurchaseOrder | null) => void;
  selectRequisition: (requisition: Requisition | null) => void;
  
  // Analytics
  getSupplierPerformance: (supplierId: string) => {
    totalOrders: number;
    totalValue: number;
    onTimeDelivery: number;
    averageRating: number;
    averageResponseTime: number;
  };
  getTopSuppliers: (limit: number) => Array<{
    supplier: Supplier;
    totalOrders: number;
    totalValue: number;
    performance: number;
  }>;
  getPurchaseOrderAnalytics: (period: 'daily' | 'weekly' | 'monthly') => {
    totalOrders: number;
    totalValue: number;
    averageOrderValue: number;
    ordersByStatus: Record<string, number>;
    ordersByPriority: Record<string, number>;
  };
  getSupplierSpendAnalysis: () => Record<string, {
    supplierName: string;
    totalSpend: number;
    orderCount: number;
    averageOrderValue: number;
    percentageOfTotal: number;
  }>;
  
  // GRN (Goods Receipt Note) Management
  generateNextGRNNumber: () => string;
  createGRN: (grn: Omit<GoodsReceiptNote, 'id' | 'grnNumber' | 'createdAt' | 'updatedAt'>) => GoodsReceiptNote;
  updateGRN: (id: string, updates: Partial<GoodsReceiptNote>) => void;
  hydrateGRNsFromApi: () => Promise<void>;
  getGRN: (id: string) => GoodsReceiptNote | undefined;
  getGRNsByPO: (poId: string) => GoodsReceiptNote[];
  getGRNsByStatus: (status: GoodsReceiptNote['status']) => GoodsReceiptNote[];
  approveGRN: (grnId: string, approvedBy: string) => void;
  rejectGRN: (grnId: string, rejectedBy: string, reason: string) => void;
  selectGRN: (grn: GoodsReceiptNote | null) => void;
  
  // Supplier Invoice Management
  generateNextInvoiceNumber: () => string;
  createSupplierInvoice: (invoice: Omit<SupplierInvoice, 'id' | 'invoiceNumber' | 'createdAt' | 'updatedAt'>) => SupplierInvoice;
  updateSupplierInvoice: (id: string, updates: Partial<SupplierInvoice>) => void;
  hydrateInvoicesFromApi: () => Promise<void>;
  getSupplierInvoice: (id: string) => SupplierInvoice | undefined;
  getInvoicesByPO: (poId: string) => SupplierInvoice[];
  getInvoicesByStatus: (status: SupplierInvoice['status']) => SupplierInvoice[];
  performThreeWayMatch: (invoiceId: string, matchedBy: string) => { matched: boolean; discrepancies: string[] };
  approveInvoice: (invoiceId: string, approvedBy: string) => void;
  rejectInvoice: (invoiceId: string, rejectedBy: string, reason: string) => void;
  markInvoicePaid: (invoiceId: string, paidBy: string, paymentMethod: string, paymentReference: string) => void;
  selectInvoice: (invoice: SupplierInvoice | null) => void;
  
  // Quality Check Management
  generateNextQualityCheckNumber: () => string;
  createQualityCheck: (check: Omit<QualityCheck, 'id' | 'checkNumber' | 'createdAt' | 'updatedAt'>) => QualityCheck;
  updateQualityCheck: (id: string, updates: Partial<QualityCheck>) => void;
  hydrateQualityChecksFromApi: () => Promise<void>;
  getQualityCheck: (id: string) => QualityCheck | undefined;
  getQualityChecksByGRN: (grnId: string) => QualityCheck[];
  completeQualityCheck: (checkId: string, approvedBy: string) => void;
}

// Sample data
const sampleSuppliers: Supplier[] = [
  {
    id: 'supplier1',
    code: 'FF001',
    name: 'Fresh Farms Ltd',
    contactPerson: 'John Farmer',
    email: 'john@freshfarms.com',
    phone: '+233 20 123 4567',
    address: '123 Farm Road',
    city: 'Accra',
    country: 'Ghana',
    postalCode: '00233',
    taxId: 'GH123456789',
    paymentTerms: 'net30',
    creditLimit: 50000,
    currentBalance: 15000,
    rating: 4.5,
    categories: ['food', 'vegetables', 'fruits'],
    isActive: true,
    contractStartDate: new Date('2023-01-01'),
    performance: {
      onTimeDelivery: 95,
      qualityRating: 4.5,
      responseTime: 2,
      totalOrders: 45
    },
    createdAt: new Date('2023-01-01'),
    updatedAt: new Date()
  },
  {
    id: 'supplier2',
    code: 'CT001',
    name: 'Coffee Traders Co',
    contactPerson: 'Sarah Coffee',
    email: 'sarah@coffeetraders.com',
    phone: '+233 24 987 6543',
    address: '456 Coffee Street',
    city: 'Kumasi',
    country: 'Ghana',
    postalCode: '00233',
    taxId: 'GH987654321',
    paymentTerms: 'net60',
    creditLimit: 30000,
    currentBalance: 8000,
    rating: 4.8,
    categories: ['beverage', 'coffee', 'tea'],
    isActive: true,
    contractStartDate: new Date('2023-03-15'),
    performance: {
      onTimeDelivery: 98,
      qualityRating: 4.8,
      responseTime: 1,
      totalOrders: 32
    },
    createdAt: new Date('2023-03-15'),
    updatedAt: new Date()
  },
  {
    id: 'supplier3',
    code: 'CP001',
    name: 'CleanPro Supplies',
    contactPerson: 'Mike Clean',
    email: 'mike@cleanpro.com',
    phone: '+233 26 555 1234',
    address: '789 Clean Avenue',
    city: 'Tema',
    country: 'Ghana',
    postalCode: '00233',
    taxId: 'GH555123456',
    paymentTerms: 'net30',
    creditLimit: 25000,
    currentBalance: 5000,
    rating: 4.2,
    categories: ['cleaning', 'chemicals', 'equipment'],
    isActive: true,
    contractStartDate: new Date('2023-02-01'),
    performance: {
      onTimeDelivery: 90,
      qualityRating: 4.2,
      responseTime: 3,
      totalOrders: 28
    },
    createdAt: new Date('2023-02-01'),
    updatedAt: new Date()
  },
  {
    id: 'supplier4',
    code: 'LC001',
    name: 'LinenCo',
    contactPerson: 'Lisa Linen',
    email: 'lisa@linenco.com',
    phone: '+233 27 777 8888',
    address: '321 Linen Lane',
    city: 'Accra',
    country: 'Ghana',
    postalCode: '00233',
    taxId: 'GH777888999',
    paymentTerms: 'net30',
    creditLimit: 40000,
    currentBalance: 12000,
    rating: 4.6,
    categories: ['linens', 'towels', 'bedding'],
    isActive: true,
    contractStartDate: new Date('2023-01-15'),
    performance: {
      onTimeDelivery: 92,
      qualityRating: 4.6,
      responseTime: 2,
      totalOrders: 38
    },
    createdAt: new Date('2023-01-15'),
    updatedAt: new Date()
  },
  {
    id: 'supplier5',
    code: 'HS001',
    name: 'HVAC Supplies',
    contactPerson: 'Tom HVAC',
    email: 'tom@hvacsupplies.com',
    phone: '+233 23 444 5678',
    address: '654 HVAC Road',
    city: 'Accra',
    country: 'Ghana',
    postalCode: '00233',
    taxId: 'GH444567890',
    paymentTerms: 'net30',
    creditLimit: 35000,
    currentBalance: 9000,
    rating: 4.4,
    categories: ['maintenance', 'hvac', 'electrical'],
    isActive: true,
    contractStartDate: new Date('2023-04-01'),
    performance: {
      onTimeDelivery: 88,
      qualityRating: 4.4,
      responseTime: 4,
      totalOrders: 22
    },
    createdAt: new Date('2023-04-01'),
    updatedAt: new Date()
  }
];

const samplePurchaseOrders: PurchaseOrder[] = [
  {
    id: '1',
    poNumber: 'PO-2024-001',
    supplierId: 'supplier1',
    supplierName: 'Fresh Farms Ltd',
    orderDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
    expectedDeliveryDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days from now
    status: 'confirmed',
    priority: 'high',
    totalAmount: 1500,
    taxAmount: 150,
    shippingAmount: 50,
    discountAmount: 100,
    finalAmount: 1600,
    currency: 'GHS',
    paymentTerms: 'net30',
    notes: 'Fresh vegetables for weekend menu',
    createdBy: 'John Smith',
    approvedBy: 'Manager',
    approvedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000), // 4 days ago
    items: [
      {
        id: '1',
        itemId: 'item1',
        itemCode: 'F001',
        itemName: 'Fresh Tomatoes',
        quantity: 60,
        unitCost: 2.50,
        totalCost: 150,
        receivedQuantity: 0
      },
      {
        id: '2',
        itemId: 'item2',
        itemCode: 'F002',
        itemName: 'Fresh Onions',
        quantity: 40,
        unitCost: 1.50,
        totalCost: 60,
        receivedQuantity: 0
      }
    ],
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
    updatedAt: new Date()
  },
  {
    id: '2',
    poNumber: 'PO-2024-002',
    supplierId: 'supplier2',
    supplierName: 'Coffee Traders Co',
    orderDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
    expectedDeliveryDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000), // 1 day from now
    status: 'in-transit',
    priority: 'medium',
    totalAmount: 2250,
    taxAmount: 225,
    shippingAmount: 75,
    discountAmount: 150,
    finalAmount: 2400,
    currency: 'GHS',
    paymentTerms: 'net60',
    notes: 'Premium coffee beans for bar',
    createdBy: 'John Smith',
    approvedBy: 'Manager',
    approvedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
    items: [
      {
        id: '3',
        itemId: 'item3',
        itemCode: 'B001',
        itemName: 'Premium Coffee Beans',
        quantity: 15,
        unitCost: 15.00,
        totalCost: 225,
        receivedQuantity: 0
      }
    ],
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
    updatedAt: new Date()
  }
];

export const useSupplierStore = create<SupplierStore>((set, get) => ({
  suppliers: [],
  purchaseOrders: samplePurchaseOrders,
  requisitions: [],
  goodsReceiptNotes: [],
  supplierInvoices: [],
  qualityChecks: [],
  selectedSupplier: null,
  selectedPurchaseOrder: null,
  selectedRequisition: null,
  selectedGRN: null,
  selectedInvoice: null,
  _syncingToAccounting: false,

  // Supplier Management
  addSupplier: (supplierData, skipSync = false) => {
    const supplierId = supplierData.id || Date.now().toString();
    
    // Auto-generate code if not provided
    let supplierCode = supplierData.code;
    if (!supplierCode || supplierCode.trim() === '') {
      supplierCode = get().generateNextSupplierCode();
    }
    
    // Check if supplier already exists by ID or code
    const state = get();
    const existingSupplier = state.suppliers.find(
      s => s.id === supplierId || s.code === supplierCode
    );
    
    if (existingSupplier) {
      // Supplier already exists, update it instead
      const updatedSupplier: Supplier = {
        ...existingSupplier,
        ...supplierData,
        id: existingSupplier.id, // Preserve existing ID
        updatedAt: new Date()
      };
      set(state => ({
        suppliers: state.suppliers.map(s => s.id === existingSupplier.id ? updatedSupplier : s)
      }));
      // skipSync also means "this came from the accounting mirror, not a real user
      // edit" — don't push a fake accounting-sourced record into the real backend.
      if (!skipSync) syncSupplierToApi(updatedSupplier);

      // Sync update to accounting if needed
      if (!skipSync && !state._syncingToAccounting) {
        try {
          set({ _syncingToAccounting: true });
          const { useAccountingStore } = require('../accounting/store');
          const accountingStore = useAccountingStore.getState();
          const existingBP = accountingStore.businessPartners.find(
            (bp: BusinessPartner) => bp.id === updatedSupplier.id || bp.code === updatedSupplier.code
          );
          
          if (existingBP) {
            const bpUpdates: Partial<BusinessPartner> = {
              code: updatedSupplier.code,
              name: updatedSupplier.name,
              taxNumber: updatedSupplier.taxId,
              address: updatedSupplier.address,
              phone: updatedSupplier.phone,
              email: updatedSupplier.email,
              contactPerson: updatedSupplier.contactPerson,
              creditLimit: updatedSupplier.creditLimit,
              paymentTerms: updatedSupplier.paymentTerms === 'immediate' ? 0 :
                            updatedSupplier.paymentTerms === 'net30' ? 30 :
                            updatedSupplier.paymentTerms === 'net60' ? 60 :
                            updatedSupplier.paymentTerms === 'net90' ? 90 : 30,
              balance: updatedSupplier.currentBalance,
              isActive: updatedSupplier.isActive,
              countryCode: updatedSupplier.country?.toUpperCase()?.slice(0, 2) || 'GH',
              updatedAt: updatedSupplier.updatedAt.toISOString()
            };
            accountingStore.updateBusinessPartner(existingBP.id, bpUpdates);
          }
        } catch (error) {
          console.error('Failed to sync supplier update to accounting:', error);
        } finally {
          set({ _syncingToAccounting: false });
        }
      }
      return;
    }
    
    // New supplier, add it
    const newSupplier: Supplier = {
      ...supplierData,
      id: supplierId,
      code: supplierCode, // Use auto-generated code
      createdAt: supplierData.createdAt || new Date(),
      updatedAt: new Date()
    };
    set(state => ({ suppliers: [...state.suppliers, newSupplier] }));
    if (!skipSync) syncSupplierToApi(newSupplier);

    // Sync to accounting store (unless we're syncing from accounting)
    if (!skipSync && !get()._syncingToAccounting) {
      try {
        set(state => ({ ...state, _syncingToAccounting: true }));
        const { useAccountingStore } = require('../accounting/store');
        const accountingStore = useAccountingStore.getState();
        const existingBP = accountingStore.businessPartners.find(
          (bp: BusinessPartner) => bp.id === newSupplier.id || bp.code === newSupplier.code
        );
        
        if (!existingBP) {
          // Convert Supplier to BusinessPartner
          const businessPartner: BusinessPartner = {
            id: newSupplier.id,
            code: newSupplier.code,
            name: newSupplier.name,
            type: 'Supplier',
            taxNumber: newSupplier.taxId,
            address: newSupplier.address,
            phone: newSupplier.phone,
            email: newSupplier.email,
            contactPerson: newSupplier.contactPerson,
            creditLimit: newSupplier.creditLimit,
            paymentTerms: newSupplier.paymentTerms === 'immediate' ? 0 :
                          newSupplier.paymentTerms === 'net30' ? 30 :
                          newSupplier.paymentTerms === 'net60' ? 60 :
                          newSupplier.paymentTerms === 'net90' ? 90 : 30,
            glAccountCode: GL_ACCOUNTS.ACCOUNTS_PAYABLE, // '2100' is Tax Payables, not AP -- was wrong
            currency: 'GHS',
            balance: newSupplier.currentBalance,
            isActive: newSupplier.isActive,
            countryCode: newSupplier.country?.toUpperCase()?.slice(0, 2) || 'GH',
            createdAt: newSupplier.createdAt.toISOString(),
            updatedAt: newSupplier.updatedAt.toISOString()
          };
          accountingStore.addBusinessPartner(businessPartner);
        }
      } catch (error) {
        console.error('Failed to sync supplier to accounting:', error);
      } finally {
        set(state => ({ ...state, _syncingToAccounting: false }));
      }
    }
  },

  updateSupplier: (id, updates, skipSync = false) => {
    set(state => {
      const updatedSuppliers = state.suppliers.map(supplier => 
        supplier.id === id 
          ? { ...supplier, ...updates, updatedAt: new Date() }
          : supplier
      );
      const updatedSupplier = updatedSuppliers.find(s => s.id === id);
      if (updatedSupplier && !skipSync) syncSupplierToApi(updatedSupplier);

      // Sync to accounting store (unless we're syncing from accounting)
      if (updatedSupplier && !skipSync && !state._syncingToAccounting) {
        try {
          set({ _syncingToAccounting: true });
          const { useAccountingStore } = require('../accounting/store');
          const accountingStore = useAccountingStore.getState();
          const existingBP = accountingStore.businessPartners.find(
            (bp: BusinessPartner) => bp.id === id || bp.code === updatedSupplier.code
          );
          
          if (existingBP) {
            // Update existing BusinessPartner
            const bpUpdates: Partial<BusinessPartner> = {
              code: updatedSupplier.code,
              name: updatedSupplier.name,
              taxNumber: updatedSupplier.taxId,
              address: updatedSupplier.address,
              phone: updatedSupplier.phone,
              email: updatedSupplier.email,
              contactPerson: updatedSupplier.contactPerson,
              creditLimit: updatedSupplier.creditLimit,
              paymentTerms: updatedSupplier.paymentTerms === 'immediate' ? 0 :
                            updatedSupplier.paymentTerms === 'net30' ? 30 :
                            updatedSupplier.paymentTerms === 'net60' ? 60 :
                            updatedSupplier.paymentTerms === 'net90' ? 90 : 30,
              balance: updatedSupplier.currentBalance,
              isActive: updatedSupplier.isActive,
              countryCode: updatedSupplier.country?.toUpperCase()?.slice(0, 2) || 'GH',
              updatedAt: updatedSupplier.updatedAt.toISOString()
            };
            accountingStore.updateBusinessPartner(existingBP.id, bpUpdates);
          } else {
            // Create new BusinessPartner if doesn't exist
            const businessPartner: BusinessPartner = {
              id: updatedSupplier.id,
              code: updatedSupplier.code,
              name: updatedSupplier.name,
              type: 'Supplier',
              taxNumber: updatedSupplier.taxId,
              address: updatedSupplier.address,
              phone: updatedSupplier.phone,
              email: updatedSupplier.email,
              contactPerson: updatedSupplier.contactPerson,
              creditLimit: updatedSupplier.creditLimit,
              paymentTerms: updatedSupplier.paymentTerms === 'immediate' ? 0 :
                            updatedSupplier.paymentTerms === 'net30' ? 30 :
                            updatedSupplier.paymentTerms === 'net60' ? 60 :
                            updatedSupplier.paymentTerms === 'net90' ? 90 : 30,
              glAccountCode: GL_ACCOUNTS.ACCOUNTS_PAYABLE,
              currency: 'GHS',
              balance: updatedSupplier.currentBalance,
              isActive: updatedSupplier.isActive,
              countryCode: updatedSupplier.country?.toUpperCase()?.slice(0, 2) || 'GH',
              createdAt: updatedSupplier.createdAt.toISOString(),
              updatedAt: updatedSupplier.updatedAt.toISOString()
            };
            accountingStore.addBusinessPartner(businessPartner);
          }
        } catch (error) {
          console.error('Failed to sync supplier update to accounting:', error);
        } finally {
          set({ _syncingToAccounting: false });
        }
      }
      
      return { suppliers: updatedSuppliers };
    });
  },

  deleteSupplier: (id) => {
    deleteSupplierFromApi(id);
    set(state => {
      const supplier = state.suppliers.find(s => s.id === id);

      // Sync to accounting store - mark as inactive instead of deleting
      if (supplier) {
        try {
          const { useAccountingStore } = require('../accounting/store');
          const accountingStore = useAccountingStore.getState();
          const existingBP = accountingStore.businessPartners.find(
            (bp: BusinessPartner) => bp.id === id || bp.code === supplier.code
          );
          
          if (existingBP) {
            accountingStore.updateBusinessPartner(existingBP.id, { 
              isActive: false,
              updatedAt: new Date().toISOString()
            });
          }
        } catch (error) {
          console.error('Failed to sync supplier deletion to accounting:', error);
        }
      }
      
      return { suppliers: state.suppliers.filter(supplier => supplier.id !== id) };
    });
  },

  generateNextSupplierCode: () => {
    const state = get();
    // Find all suppliers with codes matching SUP-XXX pattern
    const supPattern = /^SUP-(\d+)$/i;
    const supCodes = state.suppliers
      .map(s => {
        const match = s.code.match(supPattern);
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter(num => num > 0);
    
    // Get the highest number and increment
    const nextNumber = supCodes.length > 0 ? Math.max(...supCodes) + 1 : 1;
    return `SUP-${String(nextNumber).padStart(3, '0')}`;
  },

  getSupplier: (id) => get().suppliers.find(supplier => supplier.id === id),

  getSupplierByCode: (code) => get().suppliers.find(supplier => supplier.code === code),

  getSuppliersByCategory: (category) => get().suppliers.filter(supplier => 
    supplier.categories.includes(category)
  ),

  getActiveSuppliers: () => get().suppliers.filter(supplier => supplier.isActive),

  // Purchase Order Management
  createPurchaseOrder: (orderData) => {
    const newOrder: PurchaseOrder = {
      ...orderData,
      id: Date.now().toString(),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    set(state => ({ purchaseOrders: [...state.purchaseOrders, newOrder] }));
    // Reconcile with the server's authoritative totals (real VAT/withholding, not this
    // optimistic guess) once the sync resolves — see syncPurchaseOrderToApi.
    syncPurchaseOrderToApi(newOrder).then((serverOrder) => {
      if (!serverOrder) return;
      set(state => ({
        purchaseOrders: state.purchaseOrders.map(o => (o.id === newOrder.id ? serverOrder : o)),
      }));
    });
  },

  updatePurchaseOrder: (id, updates) => {
    let updated: PurchaseOrder | undefined;
    set(state => ({
      purchaseOrders: state.purchaseOrders.map(order => {
        if (order.id !== id) return order;
        updated = { ...order, ...updates, updatedAt: new Date() };
        return updated;
      })
    }));
    if (updated) {
      syncPurchaseOrderToApi(updated).then((serverOrder) => {
        if (!serverOrder) return;
        set(state => ({
          purchaseOrders: state.purchaseOrders.map(o => (o.id === serverOrder.id ? serverOrder : o)),
        }));
      });
    }
  },

  deletePurchaseOrder: (id) => {
    set(state => ({ purchaseOrders: state.purchaseOrders.filter(order => order.id !== id) }));
    deletePurchaseOrderFromApi(id);
  },

  // Pull real persisted purchase orders from the database, replacing the hardcoded
  // sample seed. Safe to call repeatedly (e.g. on tab focus) — always takes the
  // server as source of truth.
  hydratePurchaseOrdersFromApi: async () => {
    if (typeof window === 'undefined') return;
    try {
      const res = await fetch('/api/inventory/purchase-orders', { headers: poTenantHeaders(), cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      // Always replace, even with an empty list — a tenant with zero real purchase
      // orders should see zero, not fall back to the hardcoded sample seed.
      const orders = Array.isArray(data.orders) ? data.orders.map(mapApiOrderToStore) : [];
      set({ purchaseOrders: orders });
    } catch (e) {
      console.warn('[Inventory] Failed to hydrate purchase orders from server:', e);
    }
  },

  // Pull real persisted suppliers from the database, replacing the hardcoded sample
  // seed. Always replaces (even with an empty list) so a tenant with zero real
  // suppliers sees zero, not the fake seed.
  hydrateSuppliersFromApi: async () => {
    if (typeof window === 'undefined') return;
    try {
      const res = await fetch('/api/inventory/suppliers', { headers: poTenantHeaders(), cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      const suppliers = Array.isArray(data.suppliers) ? data.suppliers.map(mapApiSupplierToStore) : [];
      set({ suppliers });
    } catch (e) {
      console.warn('[Inventory] Failed to hydrate suppliers from server:', e);
    }
  },

  getPurchaseOrder: (id) => get().purchaseOrders.find(order => order.id === id),

  getPurchaseOrdersBySupplier: (supplierId) => get().purchaseOrders.filter(order => 
    order.supplierId === supplierId
  ),

  getPurchaseOrdersByStatus: (status) => get().purchaseOrders.filter(order => 
    order.status === status
  ),

  getPurchaseOrdersByDateRange: (startDate, endDate) => get().purchaseOrders.filter(order => 
    order.orderDate >= startDate && order.orderDate <= endDate
  ),

  // Purchase Order Items Management
  addPurchaseOrderItem: (orderId, itemData) => {
    const newItem: PurchaseOrderItem = {
      ...itemData,
      id: Date.now().toString()
    };

    let updated: PurchaseOrder | undefined;
    set(state => ({
      purchaseOrders: state.purchaseOrders.map(order => {
        if (order.id !== orderId) return order;
        updated = { ...order, items: [...order.items, newItem] };
        return updated;
      })
    }));
    if (updated) syncPurchaseOrderToApi(updated);
  },

  updatePurchaseOrderItem: (orderId, itemId, updates) => {
    let updated: PurchaseOrder | undefined;
    set(state => ({
      purchaseOrders: state.purchaseOrders.map(order => {
        if (order.id !== orderId) return order;
        updated = {
          ...order,
          items: order.items.map(item =>
            item.id === itemId
              ? { ...item, ...updates }
              : item
          )
        };
        return updated;
      })
    }));
    if (updated) syncPurchaseOrderToApi(updated);
  },

  removePurchaseOrderItem: (orderId, itemId) => {
    let updated: PurchaseOrder | undefined;
    set(state => ({
      purchaseOrders: state.purchaseOrders.map(order => {
        if (order.id !== orderId) return order;
        updated = { ...order, items: order.items.filter(item => item.id !== itemId) };
        return updated;
      })
    }));
    if (updated) syncPurchaseOrderToApi(updated);
  },

  // Purchase Order Workflow
  sendPurchaseOrder: (orderId) => {
    get().updatePurchaseOrder(orderId, { status: 'sent' });
  },

  confirmPurchaseOrder: (orderId, supplierId) => {
    get().updatePurchaseOrder(orderId, { 
      status: 'confirmed',
      supplierId
    });
  },

  markInTransit: (orderId) => {
    get().updatePurchaseOrder(orderId, { status: 'in-transit' });
  },

  markDelivered: (orderId, actualDeliveryDate) => {
    get().updatePurchaseOrder(orderId, { 
      status: 'delivered',
      actualDeliveryDate
    });
  },

  cancelPurchaseOrder: (orderId, reason) => {
    get().updatePurchaseOrder(orderId, { 
      status: 'cancelled',
      notes: reason
    });
  },

  closePurchaseOrder: (orderId) => {
    get().updatePurchaseOrder(orderId, { status: 'closed' });
  },

  // Requisition Management
  createRequisition: (requisitionData) => {
    const newRequisition: Requisition = {
      ...requisitionData,
      id: Date.now().toString(),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    set(state => ({ requisitions: [...state.requisitions, newRequisition] }));
    syncRequisitionToApi(newRequisition);
  },

  updateRequisition: (id, updates) => {
    let updated: Requisition | undefined;
    set(state => ({
      requisitions: state.requisitions.map(req => {
        if (req.id !== id) return req;
        updated = { ...req, ...updates, updatedAt: new Date() };
        return updated;
      })
    }));
    if (updated) syncRequisitionToApi(updated);
  },

  deleteRequisition: (id) => {
    set(state => ({ requisitions: state.requisitions.filter(req => req.id !== id) }));
    deleteRequisitionFromApi(id);
  },

  hydrateRequisitionsFromApi: async () => {
    if (typeof window === 'undefined') return;
    try {
      const res = await fetch('/api/inventory/requisitions', { headers: poTenantHeaders(), cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      const requisitions = Array.isArray(data.requisitions) ? data.requisitions.map(mapApiRequisitionToStore) : [];
      set({ requisitions });
    } catch (e) {
      console.warn('[Inventory] Failed to hydrate requisitions from server:', e);
    }
  },

  approveRequisition: (id, approvedBy) => {
    set(state => ({
      requisitions: state.requisitions.map(req => 
        req.id === id 
          ? { 
              ...req, 
              status: 'approved' as const,
              approvedBy,
              approvedAt: new Date(),
              updatedAt: new Date()
            }
          : req
      )
    }));
  },

  rejectRequisition: (id, rejectedBy, reason) => {
    set(state => ({
      requisitions: state.requisitions.map(req => 
        req.id === id 
          ? { 
              ...req, 
              status: 'rejected' as const,
              rejectedBy,
              rejectedAt: new Date(),
              rejectionReason: reason,
              updatedAt: new Date()
            }
          : req
      )
    }));
  },

  convertRequisitionToPO: (requisitionId, supplierId) => {
    const requisition = get().getRequisition(requisitionId);
    if (!requisition || requisition.status !== 'approved') {
      return null;
    }

    const supplier = get().getSupplier(supplierId);
    if (!supplier) {
      return null;
    }

    // Generate PO number
    const year = new Date().getFullYear();
    const poCount = get().purchaseOrders.length + 1;
    const poNumber = `PO-${year}-${String(poCount).padStart(3, '0')}`;

    // Convert requisition items to PO items
    const poItems: PurchaseOrderItem[] = requisition.requestedItems.map(item => ({
      id: Date.now().toString() + Math.random().toString(),
      itemId: item.itemId,
      itemCode: item.itemCode,
      itemName: item.itemName,
      quantity: item.quantity,
      unitCost: item.estimatedPrice,
      totalCost: item.totalCost,
      receivedQuantity: 0,
      notes: item.notes
    }));

    // Calculate totals
    const subtotal = poItems.reduce((sum, item) => sum + item.totalCost, 0);
    const tax = computePurchaseTax(subtotal).totalTax;
    const finalAmount = subtotal + tax;

    const newPO: PurchaseOrder = {
      id: Date.now().toString(),
      poNumber,
      supplierId: supplier.id,
      supplierName: supplier.name,
      orderDate: new Date(),
      expectedDeliveryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      status: 'draft',
      priority: 'medium',
      totalAmount: subtotal,
      taxAmount: tax,
      shippingAmount: 0,
      discountAmount: 0,
      finalAmount: finalAmount,
      currency: 'GHS',
      paymentTerms: supplier.paymentTerms || 'net30',
      notes: `Converted from Requisition ${requisition.requisitionNumber}`,
      items: poItems,
      createdBy: requisition.requestedBy,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Create the PO
    get().createPurchaseOrder(newPO);

    // Update requisition status
    get().updateRequisition(requisitionId, {
      status: 'converted-to-po',
      convertedToPOId: newPO.id,
      convertedToPONumber: newPO.poNumber
    });

    return newPO;
  },

  getRequisition: (id) => get().requisitions.find(req => req.id === id),

  getRequisitionsByStatus: (status) => get().requisitions.filter(req => req.status === status),

  // Selection
  selectSupplier: (supplier) => set({ selectedSupplier: supplier }),

  selectPurchaseOrder: (order) => set({ selectedPurchaseOrder: order }),

  selectRequisition: (requisition) => set({ selectedRequisition: requisition }),

  // Analytics
  getSupplierPerformance: (supplierId) => {
    const supplier = get().getSupplier(supplierId);
    if (!supplier) return {
      totalOrders: 0,
      totalValue: 0,
      onTimeDelivery: 0,
      averageRating: 0,
      averageResponseTime: 0
    };

    const orders = get().getPurchaseOrdersBySupplier(supplierId);
    const totalOrders = orders.length;
    const totalValue = orders.reduce((sum, order) => sum + order.finalAmount, 0);

    return {
      totalOrders,
      totalValue,
      onTimeDelivery: supplier.performance.onTimeDelivery,
      averageRating: supplier.performance.qualityRating,
      averageResponseTime: supplier.performance.responseTime
    };
  },

  getTopSuppliers: (limit) => {
    const suppliers = get().getActiveSuppliers();
    
    return suppliers
      .map(supplier => {
        const performance = get().getSupplierPerformance(supplier.id);
        const performanceScore = (performance.onTimeDelivery * 0.4) + 
                               (performance.averageRating * 0.4) + 
                               ((10 - performance.averageResponseTime) * 0.2);
        
        return {
          supplier,
          totalOrders: performance.totalOrders,
          totalValue: performance.totalValue,
          performance: performanceScore
        };
      })
      .sort((a, b) => b.performance - a.performance)
      .slice(0, limit);
  },

  getPurchaseOrderAnalytics: (period) => {
    const now = new Date();
    let startDate: Date;
    
    switch (period) {
      case 'daily':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'weekly':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'monthly':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
    }
    
    const orders = get().purchaseOrders.filter(order => order.orderDate >= startDate);
    const totalOrders = orders.length;
    const totalValue = orders.reduce((sum, order) => sum + order.finalAmount, 0);
    const averageOrderValue = totalOrders > 0 ? totalValue / totalOrders : 0;
    
    const ordersByStatus: Record<string, number> = {};
    const ordersByPriority: Record<string, number> = {};
    
    orders.forEach(order => {
      ordersByStatus[order.status] = (ordersByStatus[order.status] || 0) + 1;
      ordersByPriority[order.priority] = (ordersByPriority[order.priority] || 0) + 1;
    });
    
    return {
      totalOrders,
      totalValue,
      averageOrderValue,
      ordersByStatus,
      ordersByPriority
    };
  },

  getSupplierSpendAnalysis: () => {
    const suppliers = get().getActiveSuppliers();
    const totalSpend = suppliers.reduce((sum, supplier) => 
      sum + get().getSupplierPerformance(supplier.id).totalValue, 0
    );
    
    const analysis: Record<string, {
      supplierName: string;
      totalSpend: number;
      orderCount: number;
      averageOrderValue: number;
      percentageOfTotal: number;
    }> = {};
    
    suppliers.forEach(supplier => {
      const performance = get().getSupplierPerformance(supplier.id);
      const percentageOfTotal = totalSpend > 0 ? (performance.totalValue / totalSpend) * 100 : 0;
      
      analysis[supplier.id] = {
        supplierName: supplier.name,
        totalSpend: performance.totalValue,
        orderCount: performance.totalOrders,
        averageOrderValue: performance.totalOrders > 0 ? performance.totalValue / performance.totalOrders : 0,
        percentageOfTotal
      };
    });
    
    return analysis;
  },

  // GRN Management Functions — real configured sequence (Settings → Document Numbering →
  // Inventory → Goods Receipt) instead of counting existing records, which reissued an
  // already-used GRN number the moment any earlier one was deleted.
  generateNextGRNNumber: () => {
    return useSettingsStore.getState().getNextModuleNumber('inventory', 'goodsReceipt');
  },

  createGRN: (grnData) => {
    const grnNumber = get().generateNextGRNNumber();
    const newGRN: GoodsReceiptNote = {
      ...grnData,
      id: Date.now().toString(),
      grnNumber,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    set(state => ({ goodsReceiptNotes: [...state.goodsReceiptNotes, newGRN] }));
    syncGRNToApi(newGRN);
    return newGRN;
  },

  updateGRN: (id, updates) => {
    let updated: GoodsReceiptNote | undefined;
    set(state => ({
      goodsReceiptNotes: state.goodsReceiptNotes.map(grn => {
        if (grn.id !== id) return grn;
        updated = { ...grn, ...updates, updatedAt: new Date() };
        return updated;
      })
    }));
    if (updated) syncGRNToApi(updated);
  },

  hydrateGRNsFromApi: async () => {
    if (typeof window === 'undefined') return;
    try {
      const res = await fetch('/api/inventory/goods-receipt-notes', { headers: poTenantHeaders(), cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      const grns = Array.isArray(data.grns) ? data.grns.map(mapApiGRNToStore) : [];
      set({ goodsReceiptNotes: grns });
    } catch (e) {
      console.warn('[Inventory] Failed to hydrate goods receipt notes from server:', e);
    }
  },

  getGRN: (id) => get().goodsReceiptNotes.find(grn => grn.id === id),

  getGRNsByPO: (poId) => get().goodsReceiptNotes.filter(grn => grn.poId === poId),

  getGRNsByStatus: (status) => get().goodsReceiptNotes.filter(grn => grn.status === status),

  approveGRN: (grnId, approvedBy) => {
    const grn = get().goodsReceiptNotes.find(g => g.id === grnId);
    if (!grn) return;
    if (grn.status === 'approved') return; // idempotency: never post the same GRN's value twice

    // Determine cost center based on items
    const itemCategories = grn.items.map(item => {
      try {
        const stockStore = useStockStore.getState();
        const stockItem = stockStore.getStockItem(item.itemId);
        return stockItem?.category;
      } catch {
        return undefined;
      }
    });
    
    // Map categories to cost centers
    const categoryToCenterMap: Record<string, string> = {
      'food': 'KT',
      'beverage': 'FB',
      'cleaning': 'HK',
      'maintenance': 'MT',
      'office': 'AC',
      'linens': 'HK',
      'amenities': 'FO'
    };
    
    // Default to kitchen for food purchases, otherwise use first category
    let costCenter = 'KT';
    if (itemCategories.length > 0 && itemCategories[0]) {
      const firstCategory = itemCategories[0];
      costCenter = categoryToCenterMap[firstCategory] || 'FO';
    }
    
    // Record expense to the cost-center budget tracker (variance reporting — separate
    // from the actual GL posting below).
    try {
      const { useAccountingStore } = require('../accounting/store');
      const { recordExpense } = useAccountingStore.getState();
      recordExpense(costCenter, grn.totalValue);
    } catch {}

    // Post the real GL entry: Dr Inventory, Cr Accounts Payable. Previously nothing
    // wrote a journal entry here at all, so received stock never appeared on the
    // balance sheet or as a real AP liability — the books silently diverged from
    // actual purchasing activity every time a GRN was approved.
    if (grn.totalValue > 0) {
      try {
        const { useAccountingStore } = require('../accounting/store');
        const accountingStore = useAccountingStore.getState();
        const now = new Date().toISOString();
        const entryId = `JE-GRN-${grn.id}`;
        const amount = Math.round(grn.totalValue * 100) / 100;
        accountingStore.addJournalEntry({
          id: entryId,
          entryNumber: `JE-GRN-${grn.grnNumber}`,
          date: now,
          reference: grn.grnNumber,
          description: `Goods received — ${grn.supplierName} (PO ${grn.poNumber})`,
          totalDebit: amount,
          totalCredit: amount,
          currency: 'GHS',
          status: 'Posted',
          postedBy: approvedBy || 'system',
          postedAt: now,
          createdAt: now,
          updatedAt: now,
          sourceModule: 'inventory_grn',
          sourceTransactionId: grn.id,
          lines: [
            {
              id: `JL-${entryId}-dr`,
              journalEntryId: entryId,
              accountCode: '1300', // Inventory
              description: `Goods received from ${grn.supplierName}`,
              debit: amount,
              credit: 0,
              currency: 'GHS',
              reference: grn.grnNumber,
            },
            {
              id: `JL-${entryId}-cr`,
              journalEntryId: entryId,
              accountCode: '2000', // Accounts Payable
              description: `Payable to ${grn.supplierName}`,
              debit: 0,
              credit: amount,
              currency: 'GHS',
              reference: grn.grnNumber,
            },
          ],
        });
      } catch (e) {
        console.error('[Inventory] Failed to post GRN journal entry:', e);
      }
    }

    let updatedGrn: GoodsReceiptNote | undefined;
    set(state => ({
      goodsReceiptNotes: state.goodsReceiptNotes.map(grn => {
        if (grn.id !== grnId) return grn;
        updatedGrn = {
          ...grn,
          status: 'approved' as const,
          approvedBy,
          approvedAt: new Date(),
          updatedAt: new Date()
        };
        return updatedGrn;
      })
    }));
    if (updatedGrn) syncGRNToApi(updatedGrn);
  },

  rejectGRN: (grnId, rejectedBy, reason) => {
    let updatedGrn: GoodsReceiptNote | undefined;
    set(state => ({
      goodsReceiptNotes: state.goodsReceiptNotes.map(grn => {
        if (grn.id !== grnId) return grn;
        updatedGrn = {
          ...grn,
          status: 'rejected' as const,
          approvedBy: rejectedBy,
          approvedAt: new Date(),
          notes: reason,
          updatedAt: new Date()
        };
        return updatedGrn;
      })
    }));
    if (updatedGrn) syncGRNToApi(updatedGrn);
  },

  selectGRN: (grn) => set({ selectedGRN: grn }),

  // Supplier Invoice Management Functions
  generateNextInvoiceNumber: () => {
    const year = new Date().getFullYear();
    const existingInvoices = get().supplierInvoices.filter(inv => {
      const invYear = inv.invoiceNumber.includes(String(year));
      return invYear;
    });
    const nextNumber = existingInvoices.length + 1;
    return `INV-${year}-${String(nextNumber).padStart(4, '0')}`;
  },

  createSupplierInvoice: (invoiceData) => {
    const invoiceNumber = (invoiceData as any).invoiceNumber || get().generateNextInvoiceNumber();
    const newInvoice: SupplierInvoice = {
      ...invoiceData,
      id: Date.now().toString(),
      invoiceNumber,
      matchingStatus: {
        isQuantityMatched: false,
        isPriceMatched: false,
        isTermsMatched: false,
        discrepancies: []
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };
    set(state => ({ supplierInvoices: [...state.supplierInvoices, newInvoice] }));
    syncSupplierInvoiceToApi(newInvoice);
    return newInvoice;
  },

  updateSupplierInvoice: (id, updates) => {
    let updated: SupplierInvoice | undefined;
    set(state => ({
      supplierInvoices: state.supplierInvoices.map(inv => {
        if (inv.id !== id) return inv;
        updated = { ...inv, ...updates, updatedAt: new Date() };
        return updated;
      })
    }));
    if (updated) syncSupplierInvoiceToApi(updated);
  },

  hydrateInvoicesFromApi: async () => {
    if (typeof window === 'undefined') return;
    try {
      const res = await fetch('/api/inventory/supplier-invoices', { headers: poTenantHeaders(), cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      const invoices = Array.isArray(data.invoices) ? data.invoices.map(mapApiSupplierInvoiceToStore) : [];
      set({ supplierInvoices: invoices });
    } catch (e) {
      console.warn('[Inventory] Failed to hydrate supplier invoices from server:', e);
    }
  },

  getSupplierInvoice: (id) => get().supplierInvoices.find(inv => inv.id === id),

  getInvoicesByPO: (poId) => get().supplierInvoices.filter(inv => inv.poId === poId),

  getInvoicesByStatus: (status) => get().supplierInvoices.filter(inv => inv.status === status),

  performThreeWayMatch: (invoiceId, matchedBy) => {
    const invoice = get().getSupplierInvoice(invoiceId);
    if (!invoice) return { matched: false, discrepancies: ['Invoice not found'] };

    const po = get().getPurchaseOrder(invoice.poId);
    if (!po) return { matched: false, discrepancies: ['Purchase Order not found'] };

    const grn = get().getGRNsByPO(invoice.poId).find(g => g.status === 'approved' || g.status === 'completed');
    const discrepancies: string[] = [];

    // Quantity Matching (PO vs GRN vs Invoice)
    let quantityMatched = true;
    if (!grn) {
      discrepancies.push('GRN not found or not approved');
      quantityMatched = false;
    } else {
      invoice.items.forEach(invItem => {
        const poItem = po.items.find(i => i.id === invItem.poItemId);
        const grnItem = grn.items.find(i => i.poItemId === invItem.poItemId);
        
        if (poItem && grnItem) {
          if (invItem.quantity !== grnItem.acceptedQuantity) {
            discrepancies.push(`Quantity mismatch for ${invItem.itemCode}: Invoice ${invItem.quantity} vs GRN ${grnItem.acceptedQuantity}`);
            quantityMatched = false;
          }
          if (invItem.quantity > poItem.quantity) {
            discrepancies.push(`Quantity exceeds PO for ${invItem.itemCode}: Invoice ${invItem.quantity} vs PO ${poItem.quantity}`);
            quantityMatched = false;
          }
        }
      });
    }

    // Price Matching (PO vs Invoice)
    let priceMatched = true;
    invoice.items.forEach(invItem => {
      const poItem = po.items.find(i => i.id === invItem.poItemId);
      if (poItem && Math.abs(invItem.unitPrice - poItem.unitCost) > 0.01) {
        discrepancies.push(`Price mismatch for ${invItem.itemCode}: Invoice ₵${invItem.unitPrice} vs PO ₵${poItem.unitCost}`);
        priceMatched = false;
      }
    });

    // Terms Matching
    let termsMatched = true;
    const invoiceTotal = invoice.subtotal + invoice.taxAmount + invoice.shippingAmount - invoice.discountAmount;
    const poTotal = po.finalAmount;
    if (Math.abs(invoiceTotal - poTotal) > 0.01) {
      discrepancies.push(`Total amount mismatch: Invoice ₵${invoiceTotal.toFixed(2)} vs PO ₵${poTotal.toFixed(2)}`);
      termsMatched = false;
    }

    const allMatched = quantityMatched && priceMatched && termsMatched;

    // Update invoice matching status
    get().updateSupplierInvoice(invoiceId, {
      matchingStatus: {
        isQuantityMatched: quantityMatched,
        isPriceMatched: priceMatched,
        isTermsMatched: termsMatched,
        discrepancies,
        matchedBy,
        matchedAt: new Date()
      },
      status: allMatched ? 'matched' : 'pending'
    });

    return { matched: allMatched, discrepancies };
  },

  approveInvoice: (invoiceId, approvedBy) => {
    let updated: SupplierInvoice | undefined;
    set(state => ({
      supplierInvoices: state.supplierInvoices.map(inv =>
        inv.id === invoiceId
          ? (updated = {
              ...inv,
              status: 'approved' as const,
              approvedBy,
              approvedAt: new Date(),
              updatedAt: new Date()
            })
          : inv
      )
    }));
    if (updated) syncSupplierInvoiceToApi(updated);
  },

  rejectInvoice: (invoiceId, rejectedBy, reason) => {
    let updated: SupplierInvoice | undefined;
    set(state => ({
      supplierInvoices: state.supplierInvoices.map(inv =>
        inv.id === invoiceId
          ? (updated = {
              ...inv,
              status: 'rejected' as const,
              rejectedBy,
              rejectedAt: new Date(),
              rejectionReason: reason,
              updatedAt: new Date()
            })
          : inv
      )
    }));
    if (updated) syncSupplierInvoiceToApi(updated);
  },

  markInvoicePaid: (invoiceId, paidBy, paymentMethod, paymentReference) => {
    let updated: SupplierInvoice | undefined;
    set(state => ({
      supplierInvoices: state.supplierInvoices.map(inv =>
        inv.id === invoiceId
          ? (updated = {
              ...inv,
              status: 'paid' as const,
              paidBy,
              paidAt: new Date(),
              paymentMethod,
              paymentReference,
              updatedAt: new Date()
            })
          : inv
      )
    }));
    if (updated) syncSupplierInvoiceToApi(updated);
  },

  selectInvoice: (invoice) => set({ selectedInvoice: invoice }),

  // Quality Check Management Functions
  generateNextQualityCheckNumber: () => {
    const year = new Date().getFullYear();
    const existingChecks = get().qualityChecks.filter(qc => {
      const qcYear = qc.checkNumber.split('-')[1];
      return qcYear === String(year);
    });
    const nextNumber = existingChecks.length + 1;
    return `QC-${year}-${String(nextNumber).padStart(3, '0')}`;
  },

  createQualityCheck: (checkData) => {
    const checkNumber = get().generateNextQualityCheckNumber();
    const newCheck: QualityCheck = {
      ...checkData,
      id: Date.now().toString(),
      checkNumber,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    set(state => ({ qualityChecks: [...state.qualityChecks, newCheck] }));
    syncQualityCheckToApi(newCheck);
    return newCheck;
  },

  updateQualityCheck: (id, updates) => {
    let updated: QualityCheck | undefined;
    set(state => ({
      qualityChecks: state.qualityChecks.map(qc => {
        if (qc.id !== id) return qc;
        updated = { ...qc, ...updates, updatedAt: new Date() };
        return updated;
      })
    }));
    if (updated) syncQualityCheckToApi(updated);
  },

  hydrateQualityChecksFromApi: async () => {
    if (typeof window === 'undefined') return;
    try {
      const res = await fetch('/api/inventory/quality-checks', { headers: poTenantHeaders(), cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      const checks = Array.isArray(data.checks) ? data.checks.map(mapApiQualityCheckToStore) : [];
      set({ qualityChecks: checks });
    } catch (e) {
      console.warn('[Inventory] Failed to hydrate quality checks from server:', e);
    }
  },

  getQualityCheck: (id) => get().qualityChecks.find(qc => qc.id === id),

  getQualityChecksByGRN: (grnId) => get().qualityChecks.filter(qc => qc.grnId === grnId),

  completeQualityCheck: (checkId, approvedBy) => {
    const check = get().getQualityCheck(checkId);
    if (!check) return;

    const passedCount = check.items.filter(i => i.qualityStatus === 'passed').length;
    const failedCount = check.items.filter(i => i.qualityStatus === 'failed').length;
    const overallStatus = failedCount === 0 ? 'passed' : passedCount === 0 ? 'failed' : 'partial';

    let updatedCheck: QualityCheck | undefined;
    set(state => ({
      qualityChecks: state.qualityChecks.map(qc =>
        qc.id === checkId
          ? (updatedCheck = {
              ...qc,
              overallStatus: overallStatus as 'passed' | 'failed' | 'partial',
              passedItems: passedCount,
              failedItems: failedCount,
              approvedBy,
              approvedAt: new Date(),
              updatedAt: new Date()
            })
          : qc
      )
    }));
    if (updatedCheck) syncQualityCheckToApi(updatedCheck);

    // Update GRN quality status
    get().updateGRN(check.grnId, {
      qualityCheckedBy: approvedBy,
      qualityCheckedAt: new Date(),
      qualityStatus: overallStatus as 'passed' | 'failed' | 'partial',
      status: overallStatus === 'passed' ? 'quality-check' as const : 'rejected' as const
    });
  }
}));
