import { create } from 'zustand';
import { StockItem, StockMovement, InventoryAlert, StockTransfer, StockCount, GoodsIssue } from './models';
import { getClientTenantSubdomain } from '../api/clientTenant';

function invHeaders(): HeadersInit {
  return { 'Content-Type': 'application/json', 'x-tenant-subdomain': getClientTenantSubdomain() };
}

const CATEGORY_VALUES: StockItem['category'][] = ['food', 'beverage', 'cleaning', 'maintenance', 'office', 'linens', 'amenities', 'electronics', 'furniture', 'other'];

function toCategory(name?: string): StockItem['category'] {
  const code = (name || '').toLowerCase();
  return (CATEGORY_VALUES as string[]).includes(code) ? (code as StockItem['category']) : 'other';
}

function toStockItem(row: any): StockItem {
  return {
    id: row.id,
    itemCode: row.code,
    name: row.name,
    description: row.description || '',
    category: toCategory(row.category?.name),
    subcategory: '',
    unit: row.unit?.name || '',
    unitCost: Number(row.defaultCost || 0),
    sellingPrice: row.sellingPrice != null ? Number(row.sellingPrice) : undefined,
    currentStock: Number(row.quantityOnHand || 0),
    minimumStock: Number(row.minimumStock || 0),
    maximumStock: Number(row.maximumStock || 0),
    reorderPoint: Number(row.reorderLevel || 0),
    supplierId: row.supplierId || undefined,
    supplierName: row.supplier?.name || undefined,
    location: row.location || '',
    isActive: row.isActive,
    isPerishable: row.isPerishable,
    isSerialized: row.isSerialized,
    barcode: row.barcode || undefined,
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
  };
}

function toStockMovement(row: any): StockMovement {
  const qty = Math.abs(Number(row.quantity || 0));
  const movementType: StockMovement['movementType'] =
    row.type === 'receipt' ? 'in' :
    row.type === 'issue' ? 'out' :
    row.type === 'transfer_in' || row.type === 'transfer_out' ? 'transfer' :
    row.type === 'count' ? 'adjustment' :
    'adjustment';
  return {
    id: row.id,
    itemId: row.itemId,
    itemCode: row.item?.code || '',
    itemName: row.item?.name || '',
    movementType,
    quantity: qty,
    unitCost: Number(row.unitCost || 0),
    totalValue: qty * Number(row.unitCost || 0),
    fromLocation: row.type === 'issue' || row.type === 'transfer_out' ? row.location?.name : undefined,
    toLocation: row.type === 'receipt' || row.type === 'transfer_in' ? row.location?.name : undefined,
    referenceType: (row.referenceType || 'adjustment') as StockMovement['referenceType'],
    referenceId: row.referenceId || '',
    referenceNumber: row.referenceId || '',
    performedBy: row.performedBy || 'System',
    notes: row.notes || undefined,
    createdAt: new Date(row.createdAt),
  };
}

function mapApiTransferToStore(raw: any): StockTransfer {
  return {
    id: raw.id,
    transferNumber: raw.transferNumber,
    fromLocation: raw.fromLocation,
    toLocation: raw.toLocation,
    transferDate: new Date(raw.transferDate),
    expectedDeliveryDate: raw.expectedDeliveryDate ? new Date(raw.expectedDeliveryDate) : new Date(raw.transferDate),
    actualDeliveryDate: raw.actualDeliveryDate ? new Date(raw.actualDeliveryDate) : undefined,
    status: raw.status,
    priority: raw.priority || 'medium',
    totalItems: Number(raw.totalItems || 0),
    totalValue: Number(raw.totalValue || 0),
    items: (raw.items || []).map((i: any) => ({
      id: i.id,
      itemId: i.itemId,
      itemCode: i.itemCode,
      itemName: i.itemName,
      quantity: Number(i.quantity),
      unitCost: Number(i.unitCost),
      totalValue: Number(i.totalValue),
      transferredQuantity: Number(i.transferredQuantity || 0),
      notes: i.notes ?? undefined,
    })),
    notes: raw.notes ?? undefined,
    createdBy: raw.createdBy,
    approvedBy: raw.approvedBy ?? undefined,
    approvedAt: raw.approvedAt ? new Date(raw.approvedAt) : undefined,
    createdAt: new Date(raw.createdAt),
    updatedAt: new Date(raw.updatedAt),
  };
}

function mapApiCountToStore(raw: any): StockCount {
  return {
    id: raw.id,
    countNumber: raw.countNumber,
    countType: raw.countType || 'full',
    location: raw.location,
    startDate: new Date(raw.startDate),
    endDate: raw.endDate ? new Date(raw.endDate) : undefined,
    status: raw.status,
    totalItems: Number(raw.totalItems || 0),
    countedItems: Number(raw.countedItems || 0),
    varianceItems: Number(raw.varianceItems || 0),
    totalValue: Number(raw.totalValue || 0),
    varianceValue: Number(raw.varianceValue || 0),
    items: (raw.items || []).map((i: any) => ({
      id: i.id,
      itemId: i.itemId,
      itemCode: i.itemCode,
      itemName: i.itemName,
      expectedQuantity: Number(i.expectedQuantity),
      countedQuantity: Number(i.countedQuantity),
      variance: Number(i.variance),
      unitCost: Number(i.unitCost),
      varianceValue: Number(i.varianceValue),
      notes: i.notes ?? undefined,
    })),
    notes: raw.notes ?? undefined,
    createdBy: raw.createdBy,
    performedBy: raw.performedBy ?? undefined,
    createdAt: new Date(raw.createdAt),
    updatedAt: new Date(raw.updatedAt),
  };
}

function syncTransferToApi(transfer: StockTransfer) {
  if (typeof window === 'undefined') return;
  fetch('/api/inventory/stock-transfers', {
    method: 'PUT',
    headers: invHeaders(),
    body: JSON.stringify({
      id: transfer.id,
      transferNumber: transfer.transferNumber,
      fromLocation: transfer.fromLocation,
      toLocation: transfer.toLocation,
      transferDate: transfer.transferDate,
      expectedDeliveryDate: transfer.expectedDeliveryDate,
      actualDeliveryDate: transfer.actualDeliveryDate ?? null,
      status: transfer.status,
      priority: transfer.priority,
      notes: transfer.notes,
      createdBy: transfer.createdBy,
      approvedBy: transfer.approvedBy,
      approvedAt: transfer.approvedAt,
      items: transfer.items.map((i) => ({
        itemId: i.itemId,
        itemCode: i.itemCode,
        itemName: i.itemName,
        quantity: i.quantity,
        unitCost: i.unitCost,
        transferredQuantity: i.transferredQuantity,
        notes: i.notes,
      })),
    }),
  }).catch((e) => console.warn('[Inventory] Failed to sync stock transfer:', e));
}

function syncCountToApi(count: StockCount) {
  if (typeof window === 'undefined') return;
  fetch('/api/inventory/stock-counts', {
    method: 'PUT',
    headers: invHeaders(),
    body: JSON.stringify({
      id: count.id,
      countNumber: count.countNumber,
      countType: count.countType,
      location: count.location,
      startDate: count.startDate,
      endDate: count.endDate ?? null,
      status: count.status,
      notes: count.notes,
      createdBy: count.createdBy,
      performedBy: count.performedBy,
      items: count.items.map((i) => ({
        itemId: i.itemId,
        itemCode: i.itemCode,
        itemName: i.itemName,
        expectedQuantity: i.expectedQuantity,
        countedQuantity: i.countedQuantity,
        variance: i.variance,
        unitCost: i.unitCost,
        varianceValue: i.varianceValue,
        notes: i.notes,
      })),
    }),
  })
    // fetch() only rejects on a network failure, not on a non-2xx response —
    // without checking res.ok, a save that the server actually rejected (e.g.
    // a 500) looked identical here to one that succeeded, and the optimistic
    // local state never got corrected, so the count silently only ever
    // existed in this tab and vanished on reload.
    .then(async (res) => {
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || `Save failed (${res.status})`);
      }
    })
    .catch((e) => {
      console.warn('[Inventory] Failed to sync stock count:', e);
      if (typeof window !== 'undefined') {
        window.alert(`Stock count "${count.countNumber}" did not save to the server: ${e?.message || e}. Please retry.`);
      }
    });
}

function mapApiIssueToStore(raw: any): GoodsIssue {
  return {
    id: raw.id,
    issueNumber: raw.issueNumber,
    department: raw.department,
    issuedTo: raw.issuedTo,
    issueDate: new Date(raw.issueDate),
    status: raw.status || 'issued',
    totalItems: Number(raw.totalItems || 0),
    totalValue: Number(raw.totalValue || 0),
    items: (raw.items || []).map((i: any) => ({
      id: i.id,
      itemId: i.itemId,
      itemCode: i.itemCode,
      itemName: i.itemName,
      quantity: Number(i.quantity),
      unitCost: Number(i.unitCost),
      totalValue: Number(i.totalValue),
      reason: i.reason ?? undefined,
    })),
    notes: raw.notes ?? undefined,
    issuedBy: raw.issuedBy,
    createdAt: new Date(raw.createdAt),
    updatedAt: new Date(raw.updatedAt),
  };
}

function syncIssueToApi(issue: GoodsIssue) {
  if (typeof window === 'undefined') return;
  fetch('/api/inventory/goods-issues', {
    method: 'PUT',
    headers: invHeaders(),
    body: JSON.stringify({
      id: issue.id,
      issueNumber: issue.issueNumber,
      department: issue.department,
      issuedTo: issue.issuedTo,
      issueDate: issue.issueDate,
      status: issue.status,
      notes: issue.notes,
      issuedBy: issue.issuedBy,
      items: issue.items.map((i) => ({
        itemId: i.itemId,
        itemCode: i.itemCode,
        itemName: i.itemName,
        quantity: i.quantity,
        unitCost: i.unitCost,
        reason: i.reason,
      })),
    }),
  }).catch((e) => console.warn('[Inventory] Failed to sync goods issue:', e));
}

function deriveAlerts(items: StockItem[]): InventoryAlert[] {
  // Computed, not persisted — alerts are a live view of current stock levels,
  // not a durable business record, so they're recalculated on every hydrate
  // rather than needing their own table.
  const alerts: InventoryAlert[] = [];
  for (const item of items) {
    if (!item.isActive) continue;
    if (item.currentStock <= 0 || item.currentStock < item.minimumStock) {
      alerts.push({
        id: `low_${item.id}`,
        itemId: item.id,
        itemCode: item.itemCode,
        itemName: item.name,
        alertType: item.currentStock <= 0 ? 'low-stock' : 'low-stock',
        severity: item.currentStock <= 0 ? 'critical' : 'high',
        message: item.currentStock <= 0 ? `${item.name} is out of stock` : `${item.name} stock is below minimum`,
        currentValue: item.currentStock,
        thresholdValue: item.minimumStock,
        isActive: true,
        isAcknowledged: false,
        createdAt: item.updatedAt,
        updatedAt: item.updatedAt,
      });
    } else if (item.currentStock <= item.reorderPoint) {
      alerts.push({
        id: `reorder_${item.id}`,
        itemId: item.id,
        itemCode: item.itemCode,
        itemName: item.name,
        alertType: 'reorder',
        severity: 'medium',
        message: `${item.name} has reached its reorder point`,
        currentValue: item.currentStock,
        thresholdValue: item.reorderPoint,
        isActive: true,
        isAcknowledged: false,
        createdAt: item.updatedAt,
        updatedAt: item.updatedAt,
      });
    } else if (item.maximumStock > 0 && item.currentStock > item.maximumStock * 0.8) {
      alerts.push({
        id: `over_${item.id}`,
        itemId: item.id,
        itemCode: item.itemCode,
        itemName: item.name,
        alertType: 'overstock',
        severity: 'low',
        message: `${item.name} stock is approaching its maximum level`,
        currentValue: item.currentStock,
        thresholdValue: item.maximumStock,
        isActive: true,
        isAcknowledged: false,
        createdAt: item.updatedAt,
        updatedAt: item.updatedAt,
      });
    }
  }
  return alerts;
}

interface StockStore {
  stockItems: StockItem[];
  stockMovements: StockMovement[];
  stockTransfers: StockTransfer[];
  stockCounts: StockCount[];
  goodsIssues: GoodsIssue[];
  alerts: InventoryAlert[];
  selectedItem: StockItem | null;
  selectedMovement: StockMovement | null;
  hydrateFromApi: () => Promise<void>;
  hydrateTransfersFromApi: () => Promise<void>;
  hydrateCountsFromApi: () => Promise<void>;
  hydrateIssuesFromApi: () => Promise<void>;
  upsertStockTransfer: (transfer: StockTransfer) => void;
  upsertStockCount: (count: StockCount) => void;
  deleteStockCount: (id: string) => void;
  upsertGoodsIssue: (issue: GoodsIssue) => void;

  // Stock Item Management
  addStockItem: (item: Omit<StockItem, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateStockItem: (id: string, updates: Partial<StockItem>) => void;
  deleteStockItem: (id: string) => void;
  getStockItem: (id: string) => StockItem | undefined;
  getStockItemByCode: (itemCode: string) => StockItem | undefined;
  getStockItemsByCategory: (category: StockItem['category']) => StockItem[];
  getStockItemsByLocation: (location: string) => StockItem[];
  getStockItemsBySupplier: (supplierId: string) => StockItem[];

  // Stock Level Management
  updateStockLevel: (itemId: string, quantity: number, operation: 'add' | 'remove' | 'set', receivedUnitCost?: number) => void;
  checkReorderPoint: (itemId: string) => boolean;
  getLowStockItems: () => StockItem[];
  getOutOfStockItems: () => StockItem[];
  getOverstockItems: () => StockItem[];
  getExpiringItems: (daysThreshold: number) => StockItem[];

  // Stock Movement Management
  addStockMovement: (movement: Omit<StockMovement, 'id' | 'createdAt'>) => void;
  getMovementsByItem: (itemId: string) => StockMovement[];
  getMovementsByType: (type: StockMovement['movementType']) => StockMovement[];
  getMovementsByDateRange: (startDate: Date, endDate: Date) => StockMovement[];

  // Alert Management
  createAlert: (alert: Omit<InventoryAlert, 'id' | 'createdAt' | 'updatedAt'>) => void;
  acknowledgeAlert: (alertId: string, acknowledgedBy: string) => void;
  getActiveAlerts: () => InventoryAlert[];
  getAlertsByType: (type: InventoryAlert['alertType']) => InventoryAlert[];
  getAlertsBySeverity: (severity: InventoryAlert['severity']) => InventoryAlert[];

  // Selection
  selectStockItem: (item: StockItem | null) => void;
  selectMovement: (movement: StockMovement | null) => void;

  // Analytics
  getTotalInventoryValue: () => number;
  getCategoryBreakdown: () => Record<string, { count: number; value: number }>;
  getLocationBreakdown: () => Record<string, { count: number; value: number }>;
  getSupplierBreakdown: () => Record<string, { count: number; value: number }>;
  getStockTurnoverRate: () => number;
  getDaysInventoryOutstanding: () => number;
  getLowStockPercentage: () => number;
  getOverstockPercentage: () => number;
}

export const useStockStore = create<StockStore>((set, get) => ({
  stockItems: [],
  stockMovements: [],
  stockTransfers: [],
  stockCounts: [],
  goodsIssues: [],
  alerts: [],
  selectedItem: null,
  selectedMovement: null,

  hydrateFromApi: async () => {
    if (typeof window === 'undefined') return;
    try {
      const [itemsRes, txnsRes] = await Promise.all([
        fetch('/api/inventory/items', { headers: invHeaders(), cache: 'no-store' }),
        fetch('/api/inventory/stock-transactions', { headers: invHeaders(), cache: 'no-store' }),
      ]);
      const items: StockItem[] = itemsRes.ok ? ((await itemsRes.json()).items || []).map(toStockItem) : [];
      const movements: StockMovement[] = txnsRes.ok ? ((await txnsRes.json()).transactions || []).map(toStockMovement) : [];
      const alerts = deriveAlerts(items);
      try {
        const acksRes = await fetch('/api/inventory/alert-acknowledgments', { headers: invHeaders(), cache: 'no-store' });
        if (acksRes.ok) {
          const acks: Array<{ alertId: string; acknowledgedBy: string; acknowledgedAt: string }> = (await acksRes.json()).acknowledgments || [];
          const byAlertId = new Map(acks.map((a) => [a.alertId, a]));
          for (const alert of alerts) {
            const ack = byAlertId.get(alert.id);
            if (ack) {
              alert.isAcknowledged = true;
              alert.acknowledgedBy = ack.acknowledgedBy;
              alert.acknowledgedAt = new Date(ack.acknowledgedAt);
            }
          }
        }
      } catch (e) {
        console.warn('[Inventory] Failed to hydrate alert acknowledgments:', e);
      }
      set({ stockItems: items, stockMovements: movements, alerts });
      await Promise.all([
        get().hydrateTransfersFromApi(),
        get().hydrateCountsFromApi(),
        get().hydrateIssuesFromApi(),
      ]);
    } catch (e) {
      console.warn('[Inventory] stockStore hydrateFromApi failed:', e);
    }
  },

  hydrateTransfersFromApi: async () => {
    if (typeof window === 'undefined') return;
    try {
      const res = await fetch('/api/inventory/stock-transfers', { headers: invHeaders(), cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      const transfers = Array.isArray(data.transfers) ? data.transfers.map(mapApiTransferToStore) : [];
      set({ stockTransfers: transfers });
    } catch (e) {
      console.warn('[Inventory] Failed to hydrate stock transfers:', e);
    }
  },

  hydrateCountsFromApi: async () => {
    if (typeof window === 'undefined') return;
    try {
      const res = await fetch('/api/inventory/stock-counts', { headers: invHeaders(), cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      const counts = Array.isArray(data.counts) ? data.counts.map(mapApiCountToStore) : [];
      set({ stockCounts: counts });
    } catch (e) {
      console.warn('[Inventory] Failed to hydrate stock counts:', e);
    }
  },

  hydrateIssuesFromApi: async () => {
    if (typeof window === 'undefined') return;
    try {
      const res = await fetch('/api/inventory/goods-issues', { headers: invHeaders(), cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      const issues = Array.isArray(data.issues) ? data.issues.map(mapApiIssueToStore) : [];
      set({ goodsIssues: issues });
    } catch (e) {
      console.warn('[Inventory] Failed to hydrate goods issues:', e);
    }
  },

  upsertStockTransfer: (transfer) => {
    set((state) => {
      const exists = state.stockTransfers.some((t) => t.id === transfer.id);
      return {
        stockTransfers: exists
          ? state.stockTransfers.map((t) => (t.id === transfer.id ? transfer : t))
          : [transfer, ...state.stockTransfers],
      };
    });
    syncTransferToApi(transfer);
  },

  upsertStockCount: (count) => {
    set((state) => {
      const exists = state.stockCounts.some((c) => c.id === count.id);
      return {
        stockCounts: exists
          ? state.stockCounts.map((c) => (c.id === count.id ? count : c))
          : [count, ...state.stockCounts],
      };
    });
    syncCountToApi(count);
  },

  deleteStockCount: (id) => {
    set((state) => ({
      stockCounts: state.stockCounts.filter((c) => c.id !== id),
    }));
    if (typeof window !== 'undefined') {
      fetch(`/api/inventory/stock-counts?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: invHeaders(),
      }).catch((e) => console.warn('[Inventory] Failed to delete stock count:', e));
    }
  },

  upsertGoodsIssue: (issue) => {
    set((state) => {
      const exists = state.goodsIssues.some((i) => i.id === issue.id);
      return {
        goodsIssues: exists
          ? state.goodsIssues.map((i) => (i.id === issue.id ? issue : i))
          : [issue, ...state.goodsIssues],
      };
    });
    syncIssueToApi(issue);
  },

  // Stock Item Management
  addStockItem: (itemData) => {
    const tempId = `tmp_${Date.now()}`;
    const newItem: StockItem = { ...itemData, id: tempId, createdAt: new Date(), updatedAt: new Date() };
    set(state => ({ stockItems: [...state.stockItems, newItem] }));

    fetch('/api/inventory/items', {
      method: 'POST',
      headers: invHeaders(),
      body: JSON.stringify({
        code: itemData.itemCode,
        name: itemData.name,
        description: itemData.description,
        category: itemData.category,
        unit: itemData.unit,
        unitCost: itemData.unitCost,
        sellingPrice: itemData.sellingPrice,
        currentStock: itemData.currentStock,
        minimumStock: itemData.minimumStock,
        maximumStock: itemData.maximumStock,
        reorderPoint: itemData.reorderPoint,
        location: itemData.location,
        supplierId: itemData.supplierId,
        isPerishable: itemData.isPerishable,
        isSerialized: itemData.isSerialized,
        barcode: itemData.barcode,
        isActive: itemData.isActive,
      }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then(() => get().hydrateFromApi())
      .catch((e) => console.warn('[Inventory] Failed to sync new item:', e));
  },

  updateStockItem: (id, updates) => {
    set(state => ({
      stockItems: state.stockItems.map(item =>
        item.id === id ? { ...item, ...updates, updatedAt: new Date() } : item
      )
    }));
    if (id.startsWith('tmp_')) return; // not persisted yet — hydrate will replace it shortly

    fetch('/api/inventory/items', {
      method: 'PATCH',
      headers: invHeaders(),
      body: JSON.stringify({
        id,
        name: updates.name,
        description: updates.description,
        category: updates.category,
        unit: updates.unit,
        unitCost: updates.unitCost,
        sellingPrice: updates.sellingPrice,
        minimumStock: updates.minimumStock,
        maximumStock: updates.maximumStock,
        reorderPoint: updates.reorderPoint,
        location: updates.location,
        supplierId: updates.supplierId,
        isPerishable: updates.isPerishable,
        isSerialized: updates.isSerialized,
        barcode: updates.barcode,
        isActive: updates.isActive,
      }),
    }).catch((e) => console.warn('[Inventory] Failed to sync item update:', e));
  },

  deleteStockItem: (id) => {
    set(state => ({ stockItems: state.stockItems.filter(item => item.id !== id) }));
    if (id.startsWith('tmp_')) return;
    fetch(`/api/inventory/items?id=${encodeURIComponent(id)}`, { method: 'DELETE', headers: invHeaders() })
      .catch((e) => console.warn('[Inventory] Failed to sync item delete:', e));
  },

  getStockItem: (id) => get().stockItems.find(item => item.id === id),

  getStockItemByCode: (itemCode) => get().stockItems.find(item => item.itemCode === itemCode),

  getStockItemsByCategory: (category) => get().stockItems.filter(item => item.category === category),

  getStockItemsByLocation: (location) => get().stockItems.filter(item => item.location === location),

  getStockItemsBySupplier: (supplierId) => get().stockItems.filter(item => item.supplierId === supplierId),

  // Stock Level Management — optimistic local update only; the real write happens in
  // addStockMovement, which every call site in InventorySupplyChainDashboard.tsx calls
  // immediately after this with the reference/reason metadata this function doesn't have.
  updateStockLevel: (itemId, quantity, operation, receivedUnitCost) => {
    const item = get().getStockItem(itemId);
    if (!item) return;

    let newQuantity = item.currentStock;
    let newUnitCost = item.unitCost;
    switch (operation) {
      case 'add':
        newQuantity = item.maximumStock > 0 ? Math.min(item.maximumStock, item.currentStock + quantity) : item.currentStock + quantity;
        if (typeof receivedUnitCost === 'number' && receivedUnitCost >= 0 && quantity > 0) {
          const existingValue = item.currentStock * item.unitCost;
          const receivedValue = quantity * receivedUnitCost;
          const totalQty = item.currentStock + quantity;
          newUnitCost = totalQty > 0 ? (existingValue + receivedValue) / totalQty : receivedUnitCost;
        }
        break;
      case 'remove':
        newQuantity = Math.max(0, item.currentStock - quantity);
        break;
      case 'set':
        newQuantity = item.maximumStock > 0 ? Math.max(0, Math.min(item.maximumStock, quantity)) : Math.max(0, quantity);
        break;
    }

    get().updateStockItem(itemId, { currentStock: newQuantity, unitCost: newUnitCost });
  },

  checkReorderPoint: (itemId) => {
    const item = get().getStockItem(itemId);
    if (!item) return false;
    return item.currentStock <= item.reorderPoint;
  },

  getLowStockItems: () => get().stockItems.filter(item =>
    item.isActive && item.currentStock > 0 && item.currentStock <= item.reorderPoint
  ),

  getOutOfStockItems: () => get().stockItems.filter(item =>
    item.isActive && (item.currentStock === 0 || item.currentStock < item.minimumStock)
  ),

  getOverstockItems: () => get().stockItems.filter(item =>
    item.isActive && item.maximumStock > 0 && item.currentStock > item.maximumStock * 0.8
  ),

  getExpiringItems: () => [], // expiry/batch tracking isn't modeled yet — honestly empty, not fabricated

  // Stock Movement Management — the real sync point: translates the UI's movement
  // vocabulary into a signed InventoryTransaction and persists it.
  addStockMovement: (movementData) => {
    const newMovement: StockMovement = { ...movementData, id: `tmp_${Date.now()}`, createdAt: new Date() };
    set(state => ({ stockMovements: [...state.stockMovements, newMovement] }));

    const item = get().getStockItem(movementData.itemId);
    if (!item || item.id.startsWith('tmp_')) return; // item not persisted yet

    let type: string;
    let signedQty = movementData.quantity;
    switch (movementData.movementType) {
      case 'in':
      case 'return':
        type = 'receipt';
        signedQty = Math.abs(movementData.quantity);
        break;
      case 'out':
      case 'damage':
      case 'expiry':
        type = 'issue';
        signedQty = -Math.abs(movementData.quantity);
        break;
      case 'adjustment': {
        const isUndercount = /undercount/i.test(movementData.reason || movementData.notes || '');
        type = 'count';
        signedQty = isUndercount ? -Math.abs(movementData.quantity) : Math.abs(movementData.quantity);
        break;
      }
      case 'transfer': {
        // Audit trail only — location already updated via updateStockItem.
        // Net-zero on quantityOnHand (hotel still owns the units).
        const absQty = Math.abs(movementData.quantity);
        if (!absQty) return;
        const base = {
          itemId: movementData.itemId,
          unitCost: movementData.unitCost,
          referenceType: movementData.referenceType || 'transfer',
          referenceId: movementData.referenceId,
          notes: movementData.notes || movementData.reason,
          performedBy: movementData.performedBy,
        };
        Promise.all([
          fetch('/api/inventory/stock-transactions', {
            method: 'POST',
            headers: invHeaders(),
            body: JSON.stringify({ ...base, type: 'transfer_out', quantity: -absQty }),
          }),
          fetch('/api/inventory/stock-transactions', {
            method: 'POST',
            headers: invHeaders(),
            body: JSON.stringify({ ...base, type: 'transfer_in', quantity: absQty }),
          }),
        ])
          .then(() => get().hydrateFromApi())
          .catch((e) => console.warn('[Inventory] Failed to sync transfer movement:', e));
        return;
      }
      default:
        type = 'adjustment';
    }
    if (!signedQty) return;

    fetch('/api/inventory/stock-transactions', {
      method: 'POST',
      headers: invHeaders(),
      body: JSON.stringify({
        itemId: movementData.itemId,
        type,
        quantity: signedQty,
        unitCost: movementData.unitCost,
        referenceType: movementData.referenceType,
        referenceId: movementData.referenceId,
        notes: movementData.notes || movementData.reason,
        performedBy: movementData.performedBy,
      }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then(() => get().hydrateFromApi())
      .catch((e) => console.warn('[Inventory] Failed to sync stock movement:', e));
  },

  getMovementsByItem: (itemId) => get().stockMovements.filter(movement => movement.itemId === itemId),

  getMovementsByType: (type) => get().stockMovements.filter(movement => movement.movementType === type),

  getMovementsByDateRange: (startDate, endDate) => {
    return get().stockMovements.filter(movement =>
      movement.createdAt >= startDate && movement.createdAt <= endDate
    );
  },

  // Alert Management — alerts are a computed view (see deriveAlerts) recomputed fresh
  // from real stock levels on every hydrate, so only the acknowledgment itself needs a
  // durable row (keyed by the alert's deterministic id, e.g. "low_<itemId>") — hydrateFromApi
  // merges it back in after deriveAlerts runs, so a dismissed alert doesn't resurface.
  createAlert: (alertData) => {
    const newAlert: InventoryAlert = { ...alertData, id: Date.now().toString(), createdAt: new Date(), updatedAt: new Date() };
    set(state => ({ alerts: [...state.alerts, newAlert] }));
  },

  acknowledgeAlert: (alertId, acknowledgedBy) => {
    if (typeof window !== 'undefined') {
      fetch('/api/inventory/alert-acknowledgments', {
        method: 'POST',
        headers: invHeaders(),
        body: JSON.stringify({ alertId, acknowledgedBy }),
      }).catch((e) => console.warn('[Inventory] Failed to sync alert acknowledgment:', e));
    }
    set(state => ({
      alerts: state.alerts.map(alert =>
        alert.id === alertId
          ? { ...alert, isAcknowledged: true, acknowledgedBy, acknowledgedAt: new Date(), updatedAt: new Date() }
          : alert
      )
    }));
  },

  getActiveAlerts: () => get().alerts.filter(alert => alert.isActive && !alert.isAcknowledged),

  getAlertsByType: (type) => get().alerts.filter(alert => alert.alertType === type),

  getAlertsBySeverity: (severity) => get().alerts.filter(alert => alert.severity === severity),

  // Selection
  selectStockItem: (item) => set({ selectedItem: item }),

  selectMovement: (movement) => set({ selectedMovement: movement }),

  // Analytics
  getTotalInventoryValue: () => {
    return get().stockItems.reduce((total, item) => total + (item.currentStock * item.unitCost), 0);
  },

  getCategoryBreakdown: () => {
    const breakdown: Record<string, { count: number; value: number }> = {};
    get().stockItems.forEach(item => {
      if (!breakdown[item.category]) breakdown[item.category] = { count: 0, value: 0 };
      breakdown[item.category].count += item.currentStock;
      breakdown[item.category].value += item.currentStock * item.unitCost;
    });
    return breakdown;
  },

  getLocationBreakdown: () => {
    const breakdown: Record<string, { count: number; value: number }> = {};
    get().stockItems.forEach(item => {
      const loc = item.location || 'Unassigned';
      if (!breakdown[loc]) breakdown[loc] = { count: 0, value: 0 };
      breakdown[loc].count += item.currentStock;
      breakdown[loc].value += item.currentStock * item.unitCost;
    });
    return breakdown;
  },

  getSupplierBreakdown: () => {
    const breakdown: Record<string, { count: number; value: number }> = {};
    get().stockItems.forEach(item => {
      const supplier = item.supplierName || 'Unknown';
      if (!breakdown[supplier]) breakdown[supplier] = { count: 0, value: 0 };
      breakdown[supplier].count += item.currentStock;
      breakdown[supplier].value += item.currentStock * item.unitCost;
    });
    return breakdown;
  },

  getStockTurnoverRate: () => {
    const movements = get().stockMovements;
    const totalOutValue = movements
      .filter(m => m.movementType === 'out')
      .reduce((sum, m) => sum + m.totalValue, 0);
    const averageInventoryValue = get().getTotalInventoryValue();
    return averageInventoryValue > 0 ? totalOutValue / averageInventoryValue : 0;
  },

  getDaysInventoryOutstanding: () => {
    const turnoverRate = get().getStockTurnoverRate();
    return turnoverRate > 0 ? 365 / turnoverRate : 0;
  },

  getLowStockPercentage: () => {
    const items = get().stockItems;
    const lowStockItems = items.filter(item => item.currentStock <= item.reorderPoint);
    return items.length > 0 ? (lowStockItems.length / items.length) * 100 : 0;
  },

  getOverstockPercentage: () => {
    const items = get().stockItems;
    const overstockItems = items.filter(item => item.maximumStock > 0 && item.currentStock > item.maximumStock * 0.8);
    return items.length > 0 ? (overstockItems.length / items.length) * 100 : 0;
  }
}));
