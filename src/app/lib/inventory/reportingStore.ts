import { create } from 'zustand';
import { useStockStore } from './stockStore';
import { useSupplierStore } from './supplierStore';
import { InventoryReport, InventoryAnalytics, CostAnalysis } from './models';
import { openHtmlPrintWindow } from '../print/engine';

// ---------------------------------------------------------------------------
// Report export helpers — every generate*Report() above returns either
// {mainArray, summary} (items/movements/suppliers/locations/categories) or a
// flatter summary/breakdown object (financial/inventory/analytics reports).
// These turn either shape into a real CSV download or a printable HTML page,
// instead of the old "console.log and pretend" stub.
// ---------------------------------------------------------------------------

const REPORT_ARRAY_KEYS = ['items', 'movements', 'suppliers', 'locations', 'categories', 'trends'];

function findMainArray(report: any): { rows: any[] } | null {
  if (!report || typeof report !== 'object') return null;
  for (const key of REPORT_ARRAY_KEYS) {
    if (Array.isArray(report[key]) && report[key].length) return { rows: report[key] };
  }
  for (const key of Object.keys(report)) {
    if (Array.isArray(report[key]) && report[key].length) return { rows: report[key] };
  }
  return null;
}

function cellText(v: any): string {
  if (v == null) return '';
  if (v instanceof Date) return v.toLocaleDateString();
  if (Array.isArray(v)) return v.join('; ');
  return String(v);
}

/** Flattens a (possibly nested) summary object into label/value pairs, e.g.
 *  {byCategory: {food: {count: 3}}} -> [["byCategory food count", "3"]]. */
function flattenToPairs(obj: any, prefix = ''): Array<[string, string]> {
  const pairs: Array<[string, string]> = [];
  for (const [key, val] of Object.entries(obj || {})) {
    const label = prefix ? `${prefix} ${key}` : key;
    if (val && typeof val === 'object' && !(val instanceof Date) && !Array.isArray(val)) {
      pairs.push(...flattenToPairs(val, label));
    } else {
      pairs.push([label, cellText(val)]);
    }
  }
  return pairs;
}

function csvCell(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

function buildReportCsv(report: any): string {
  const lines: string[] = [];
  const main = findMainArray(report);
  if (main) {
    const cols = Object.keys(main.rows[0]);
    lines.push(cols.map(csvCell).join(','));
    for (const row of main.rows) lines.push(cols.map((c) => csvCell(cellText(row[c]))).join(','));
  }
  const summarySource = report?.summary || (!main ? report : null);
  if (summarySource) {
    if (lines.length) lines.push('');
    lines.push('Summary');
    for (const [label, value] of flattenToPairs(summarySource)) lines.push(`${csvCell(label)},${csvCell(value)}`);
  }
  return lines.join('\n');
}

function downloadReportCsv(report: any, title: string) {
  const csv = buildReportCsv(report);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${title.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function buildReportHtml(report: any, title: string): string {
  const main = findMainArray(report);
  let body = `<h1>${title}</h1><p style="color:#666;">${new Date().toLocaleString()}</p>`;
  if (main) {
    const cols = Object.keys(main.rows[0]);
    body += `<table><thead><tr>${cols.map((c) => `<th>${c}</th>`).join('')}</tr></thead><tbody>${main.rows
      .map((row) => `<tr>${cols.map((c) => `<td>${cellText(row[c])}</td>`).join('')}</tr>`)
      .join('')}</tbody></table>`;
  }
  const summarySource = report?.summary || (!main ? report : null);
  if (summarySource) {
    body += `<h2>Summary</h2><table>${flattenToPairs(summarySource)
      .map(([l, v]) => `<tr><td><strong>${l}</strong></td><td>${v}</td></tr>`)
      .join('')}</table>`;
  }
  return `<!doctype html><html><head><meta charset="utf-8" /><title>${title}</title>
  <style>body{font-family:Arial,system-ui,sans-serif;padding:24px;color:#222;} table{border-collapse:collapse;width:100%;margin-top:12px;} th,td{border:1px solid #ddd;padding:8px;text-align:left;font-size:13px;} th{background:#f5f5f5;}</style>
  </head><body>${body}<script>window.print()</script></body></html>`;
}

interface InventoryReportingStore {
  // Report Generation
  generateInventoryReport: (type: InventoryReport['type'], startDate: Date, endDate: Date) => InventoryReport;
  generateInventoryAnalytics: (period: InventoryAnalytics['period'], date: Date) => InventoryAnalytics;
  generateCostAnalysis: (period: CostAnalysis['period'], startDate: Date, endDate: Date) => CostAnalysis;
  
  // Specific Reports
  generateLowStockReport: () => {
    items: Array<{
      itemCode: string;
      name: string;
      category: string;
      currentStock: number;
      reorderPoint: number;
      supplierName: string;
      lastOrderDate?: Date;
      urgency: 'low' | 'medium' | 'high' | 'critical';
    }>;
    summary: {
      totalItems: number;
      criticalItems: number;
      highPriorityItems: number;
      estimatedReorderValue: number;
    };
  };
  
  generateExpiryReport: (daysThreshold: number) => {
    items: Array<{
      itemCode: string;
      name: string;
      category: string;
      currentStock: number;
      expiryDate: Date;
      daysUntilExpiry: number;
      unitCost: number;
      totalValue: number;
      supplierName: string;
    }>;
    summary: {
      totalItems: number;
      totalValue: number;
      itemsExpiringToday: number;
      itemsExpiringThisWeek: number;
      itemsExpiringThisMonth: number;
    };
  };
  
  generateMovementReport: (startDate: Date, endDate: Date) => {
    movements: Array<{
      date: Date;
      itemCode: string;
      itemName: string;
      movementType: string;
      quantity: number;
      value: number;
      reference: string;
      location: string;
      performedBy: string;
    }>;
    summary: {
      totalMovements: number;
      totalInValue: number;
      totalOutValue: number;
      netChange: number;
      movementsByType: Record<string, { count: number; value: number }>;
      topItems: Array<{ itemCode: string; name: string; totalMovement: number; value: number }>;
    };
  };
  
  generateSupplierReport: () => {
    suppliers: Array<{
      name: string;
      code: string;
      categories: string[];
      totalOrders: number;
      totalSpend: number;
      averageOrderValue: number;
      onTimeDelivery: number;
      qualityRating: number;
      responseTime: number;
      performance: number;
    }>;
    summary: {
      totalSuppliers: number;
      activeSuppliers: number;
      totalSpend: number;
      averageSupplierRating: number;
      topCategories: Array<{ category: string; spend: number; percentage: number }>;
    };
  };
  
  generateLocationReport: () => {
    locations: Array<{
      name: string;
      totalItems: number;
      totalValue: number;
      utilization: number;
      lowStockItems: number;
      overstockItems: number;
      categories: Array<{ category: string; count: number; value: number }>;
    }>;
    summary: {
      totalLocations: number;
      totalInventoryValue: number;
      averageLocationValue: number;
      mostUtilizedLocation: string;
      leastUtilizedLocation: string;
    };
  };
  
  generateCategoryReport: () => {
    categories: Array<{
      name: string;
      itemCount: number;
      totalStock: number;
      totalValue: number;
      averageItemValue: number;
      lowStockItems: number;
      overstockItems: number;
      turnoverRate: number;
      suppliers: string[];
    }>;
    summary: {
      totalCategories: number;
      totalItems: number;
      totalValue: number;
      topCategory: string;
      bottomCategory: string;
      categoryDistribution: Array<{ category: string; percentage: number }>;
    };
  };
  
  generateFinancialReport: () => {
    summary: {
      totalInventoryValue: number;
      totalPurchaseOrders: number;
      totalPurchaseValue: number;
      averageOrderValue: number;
      stockTurnoverRate: number;
      daysInventoryOutstanding: number;
      carryingCostPercentage: number;
    };
    breakdown: {
      byCategory: Record<string, { count: number; value: number; percentage: number }>;
      byLocation: Record<string, { count: number; value: number; percentage: number }>;
      bySupplier: Record<string, { count: number; value: number; percentage: number }>;
    };
    trends: Array<{
      period: string;
      inventoryValue: number;
      purchaseValue: number;
      turnoverRate: number;
      change: number;
    }>;
  };
  
  // Export Functions
  exportReport: (report: any, format: 'csv' | 'pdf' | 'excel', title?: string) => void;
  exportInventoryReport: (type: InventoryReport['type'], startDate: Date, endDate: Date, format: 'csv' | 'pdf' | 'excel') => void;
  exportLowStockReport: (format: 'csv' | 'pdf' | 'excel') => void;
  exportExpiryReport: (daysThreshold: number, format: 'csv' | 'pdf' | 'excel') => void;
  exportMovementReport: (startDate: Date, endDate: Date, format: 'csv' | 'pdf' | 'excel') => void;
  exportSupplierReport: (format: 'csv' | 'pdf' | 'excel') => void;
  exportLocationReport: (format: 'csv' | 'pdf' | 'excel') => void;
  exportCategoryReport: (format: 'csv' | 'pdf' | 'excel') => void;
  exportFinancialReport: (format: 'csv' | 'pdf' | 'excel') => void;
}

export const useInventoryReportingStore = create<InventoryReportingStore>((set, get) => ({
  // Report Generation
  generateInventoryReport: (type, startDate, endDate) => {
    const stockStore = useStockStore.getState();
    const supplierStore = useSupplierStore.getState();
    
    const totalItems = stockStore.stockItems.length;
    const totalValue = stockStore.getTotalInventoryValue();
    const lowStockItems = stockStore.getLowStockItems().length;
    const expiringItems = stockStore.getExpiringItems(30).length;
    const activeSuppliers = supplierStore.getActiveSuppliers().length;
    
    const movements = stockStore.getMovementsByDateRange(startDate, endDate);
    const totalMovements = movements.length;
    
    const purchaseOrders = supplierStore.getPurchaseOrdersByDateRange(startDate, endDate);
    const totalPurchases = purchaseOrders.length;
    const totalTransfers = movements.filter(m => m.movementType === 'transfer').length;
    
    const categoryBreakdown = stockStore.getCategoryBreakdown();
    const locationBreakdown = stockStore.getLocationBreakdown();
    const supplierBreakdown = stockStore.getSupplierBreakdown();
    
    const movementSummary: Record<string, number> = {};
    movements.forEach(movement => {
      movementSummary[movement.movementType] = (movementSummary[movement.movementType] || 0) + 1;
    });
    
    const topItems = stockStore.stockItems
      .sort((a, b) => (b.currentStock * b.unitCost) - (a.currentStock * a.unitCost))
      .slice(0, 10)
      .map(item => ({
        itemCode: item.itemCode,
        name: item.name,
        quantity: item.currentStock,
        value: item.currentStock * item.unitCost
      }));
    
    const recommendations = [];
    if (lowStockItems > 0) {
      recommendations.push(`Reorder ${lowStockItems} items that are below reorder point`);
    }
    if (expiringItems > 0) {
      recommendations.push(`${expiringItems} items are expiring soon - consider usage or disposal`);
    }
    if (stockStore.getOverstockItems().length > 0) {
      recommendations.push('Some items are overstocked - consider promotions or transfers');
    }
    
    return {
      id: Date.now().toString(),
      type,
      startDate,
      endDate,
      generatedBy: 'System',
      generatedAt: new Date(),
      summary: {
        totalItems,
        totalValue,
        lowStockItems,
        expiringItems,
        activeSuppliers,
        totalMovements,
        totalPurchases,
        totalTransfers,
        averageCleaningTime: 0, // Not applicable for inventory
        qualityScore: 0, // Not applicable for inventory
        maintenanceRequests: 0, // Not applicable for inventory
        resolvedMaintenance: 0 // Not applicable for inventory
      },
      details: {
        roomStatusBreakdown: {}, // Not applicable for inventory
        taskCompletionRates: {}, // Not applicable for inventory
        staffPerformance: {}, // Not applicable for inventory
        maintenanceCosts: {}, // Not applicable for inventory
        supplyUsage: {}, // Not applicable for inventory
        categoryBreakdown,
        locationBreakdown,
        supplierBreakdown,
        movementSummary,
        topItems
      },
      recommendations
    };
  },

  generateInventoryAnalytics: (period, date) => {
    const stockStore = useStockStore.getState();
    const supplierStore = useSupplierStore.getState();
    
    const totalInventoryValue = stockStore.getTotalInventoryValue();
    const averageItemValue = stockStore.stockItems.length > 0 ? 
      totalInventoryValue / stockStore.stockItems.length : 0;
    const stockTurnoverRate = stockStore.getStockTurnoverRate();
    const daysInventoryOutstanding = stockStore.getDaysInventoryOutstanding();
    const lowStockPercentage = stockStore.getLowStockPercentage();
    const overstockPercentage = stockStore.getOverstockPercentage();
    
    const categoryDistribution = stockStore.getCategoryBreakdown();
    const locationEfficiency = stockStore.getLocationBreakdown();
    
    const supplierPerformance: Record<string, { rating: number; deliveryTime: number; qualityScore: number }> = {};
    supplierStore.getActiveSuppliers().forEach(supplier => {
      supplierPerformance[supplier.name] = {
        rating: supplier.rating,
        deliveryTime: supplier.performance.responseTime,
        qualityScore: supplier.performance.qualityRating
      };
    });
    
    // Generate trends (simplified for demo)
    const trends = [
      { period: 'Previous', value: totalInventoryValue * 0.9, change: -10, percentageChange: -10 },
      { period: 'Current', value: totalInventoryValue, change: 0, percentageChange: 0 }
    ];
    
    return {
      id: Date.now().toString(),
      period,
      date,
      totalInventoryValue,
      averageItemValue,
      stockTurnoverRate,
      daysInventoryOutstanding,
      lowStockPercentage,
      overstockPercentage,
      expiryRiskValue: 0, // Would calculate based on expiring items
      categoryDistribution,
      locationEfficiency,
      supplierPerformance,
      trends
    } as unknown as InventoryAnalytics;
  },

  generateCostAnalysis: (period, startDate, endDate) => {
    const stockStore = useStockStore.getState();
    const supplierStore = useSupplierStore.getState();
    
    const totalInventoryValue = stockStore.getTotalInventoryValue();
    const totalPurchaseCost = supplierStore.purchaseOrders
      .filter(po => po.orderDate >= startDate && po.orderDate <= endDate)
      .reduce((sum, po) => sum + po.finalAmount, 0);
    
    // Simplified cost calculations for demo
    const totalHoldingCost = totalInventoryValue * 0.02; // 2% holding cost
    const totalOrderingCost = supplierStore.purchaseOrders.length * 50; // $50 per order
    const totalShortageCost = 0; // Would calculate based on stockouts
    
    const categoryBreakdown = stockStore.getCategoryBreakdown();
    const costBreakdown = Object.entries(categoryBreakdown).map(([category, data]) => ({
      category,
      purchaseCost: data.value * 0.8, // Simplified
      holdingCost: data.value * 0.02,
      orderingCost: 50, // Simplified
      shortageCost: 0,
      totalCost: (data.value * 0.8) + (data.value * 0.02) + 50,
      percentage: (data.value / totalInventoryValue) * 100
    }));
    
    const efficiencyMetrics = {
      inventoryTurnover: stockStore.getStockTurnoverRate(),
      daysInventoryOutstanding: stockStore.getDaysInventoryOutstanding(),
      carryingCostPercentage: (totalHoldingCost / totalInventoryValue) * 100,
      stockoutRate: 0 // Would calculate based on actual stockouts
    };
    
    return {
      id: Date.now().toString(),
      period,
      startDate,
      endDate,
      totalPurchaseCost,
      totalHoldingCost,
      totalOrderingCost,
      totalShortageCost,
      totalInventoryValue,
      costBreakdown,
      efficiencyMetrics
    };
  },

  // Specific Reports
  generateLowStockReport: () => {
    const stockStore = useStockStore.getState();
    const supplierStore = useSupplierStore.getState();
    
    const lowStockItems = stockStore.getLowStockItems();
    
    const items = lowStockItems.map(item => {
      const urgency: 'critical' | 'high' | 'medium' | 'low' = item.currentStock === 0 ? 'critical' :
                     item.currentStock <= item.reorderPoint * 0.5 ? 'high' :
                     item.currentStock <= item.reorderPoint * 0.8 ? 'medium' : 'low';
      
      return {
        itemCode: item.itemCode,
        name: item.name,
        category: item.category,
        currentStock: item.currentStock,
        reorderPoint: item.reorderPoint,
        supplierName: item.supplierName || '',
        lastOrderDate: undefined, // Would get from purchase orders
        urgency
      };
    });
    
    const criticalItems = items.filter(item => item.urgency === 'critical').length;
    const highPriorityItems = items.filter(item => item.urgency === 'high').length;
    const estimatedReorderValue = items.reduce((sum, item) => 
      sum + (item.reorderPoint * (stockStore.getStockItem(item.itemCode)?.unitCost || 0)), 0
    );
    
    return {
      items,
      summary: {
        totalItems: items.length,
        criticalItems,
        highPriorityItems,
        estimatedReorderValue
      }
    };
  },

  generateExpiryReport: (daysThreshold) => {
    const stockStore = useStockStore.getState();
    const expiringItems = stockStore.getExpiringItems(daysThreshold);
    
    const items = expiringItems.map(item => {
      const daysUntilExpiry = Math.ceil((item.expiryDate!.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
      
      return {
        itemCode: item.itemCode,
        name: item.name,
        category: item.category,
        currentStock: item.currentStock,
        expiryDate: item.expiryDate!,
        daysUntilExpiry,
        unitCost: item.unitCost,
        totalValue: item.currentStock * item.unitCost,
        supplierName: item.supplierName || ''
      };
    });
    
    const itemsExpiringToday = items.filter(item => item.daysUntilExpiry === 0).length;
    const itemsExpiringThisWeek = items.filter(item => item.daysUntilExpiry <= 7).length;
    const itemsExpiringThisMonth = items.filter(item => item.daysUntilExpiry <= 30).length;
    
    return {
      items,
      summary: {
        totalItems: items.length,
        totalValue: items.reduce((sum, item) => sum + item.totalValue, 0),
        itemsExpiringToday,
        itemsExpiringThisWeek,
        itemsExpiringThisMonth
      }
    };
  },

  generateMovementReport: (startDate, endDate) => {
    const stockStore = useStockStore.getState();
    const movements = stockStore.getMovementsByDateRange(startDate, endDate);
    
    const movementData = movements.map(movement => ({
      date: movement.createdAt,
      itemCode: movement.itemCode,
      itemName: movement.itemName,
      movementType: movement.movementType,
      quantity: movement.quantity,
      value: movement.totalValue,
      reference: movement.referenceNumber,
      location: movement.toLocation || movement.fromLocation || 'N/A',
      performedBy: movement.performedBy
    }));
    
    const totalInValue = movements
      .filter(m => m.movementType === 'in')
      .reduce((sum, m) => sum + m.totalValue, 0);
    
    const totalOutValue = movements
      .filter(m => m.movementType === 'out')
      .reduce((sum, m) => sum + m.totalValue, 0);
    
    const netChange = totalInValue - totalOutValue;
    
    const movementsByType: Record<string, { count: number; value: number }> = {};
    movements.forEach(movement => {
      if (!movementsByType[movement.movementType]) {
        movementsByType[movement.movementType] = { count: 0, value: 0 };
      }
      movementsByType[movement.movementType].count += 1;
      movementsByType[movement.movementType].value += movement.totalValue;
    });
    
    const topItems = Object.entries(
      movements.reduce((acc, m) => {
        acc[m.itemCode] = (acc[m.itemCode] || 0) + m.quantity;
        return acc;
      }, {} as Record<string, number>)
    )
      .map(([itemCode, totalMovement]) => {
        const item = stockStore.getStockItemByCode(itemCode);
        return {
          itemCode,
          name: item?.name || 'Unknown',
          totalMovement,
          value: totalMovement * (item?.unitCost || 0)
        };
      })
      .sort((a, b) => b.totalMovement - a.totalMovement)
      .slice(0, 10);
    
    return {
      movements: movementData,
      summary: {
        totalMovements: movements.length,
        totalInValue,
        totalOutValue,
        netChange,
        movementsByType,
        topItems
      }
    };
  },

  generateSupplierReport: () => {
    const supplierStore = useSupplierStore.getState();
    const suppliers = supplierStore.getActiveSuppliers();
    
    const supplierData = suppliers.map(supplier => {
      const performance = supplierStore.getSupplierPerformance(supplier.id);
      const performanceScore = (performance.onTimeDelivery * 0.4) + 
                             (performance.averageRating * 0.4) + 
                             ((10 - performance.averageResponseTime) * 0.2);
      
      return {
        name: supplier.name,
        code: supplier.code,
        categories: supplier.categories,
        totalOrders: performance.totalOrders,
        totalSpend: performance.totalValue,
        averageOrderValue: performance.totalOrders > 0 ? performance.totalValue / performance.totalOrders : 0,
        onTimeDelivery: performance.onTimeDelivery,
        qualityRating: performance.averageRating,
        responseTime: performance.averageResponseTime,
        performance: performanceScore
      };
    });
    
    const totalSpend = suppliers.reduce((sum, supplier) => 
      sum + supplierStore.getSupplierPerformance(supplier.id).totalValue, 0
    );
    
    const averageSupplierRating = suppliers.reduce((sum, supplier) => sum + supplier.rating, 0) / suppliers.length;
    
    const categorySpend: Record<string, number> = {};
    suppliers.forEach(supplier => {
      supplier.categories.forEach(category => {
        categorySpend[category] = (categorySpend[category] || 0) + 
          supplierStore.getSupplierPerformance(supplier.id).totalValue;
      });
    });
    
    const topCategories = Object.entries(categorySpend)
      .map(([category, spend]) => ({
        category,
        spend,
        percentage: (spend / totalSpend) * 100
      }))
      .sort((a, b) => b.spend - a.spend)
      .slice(0, 5);
    
    return {
      suppliers: supplierData,
      summary: {
        totalSuppliers: suppliers.length,
        activeSuppliers: suppliers.filter(s => s.isActive).length,
        totalSpend,
        averageSupplierRating,
        topCategories
      }
    };
  },

  generateLocationReport: () => {
    const stockStore = useStockStore.getState();
    const locationBreakdown = stockStore.getLocationBreakdown();
    
    const locations = Object.entries(locationBreakdown).map(([name, data]) => {
      const items = stockStore.getStockItemsByLocation(name);
      const lowStockItems = items.filter(item => item.currentStock <= item.reorderPoint).length;
      const overstockItems = items.filter(item => item.currentStock > item.maximumStock * 0.8).length;
      
      const categories: Record<string, { count: number; value: number }> = {};
      items.forEach(item => {
        if (!categories[item.category]) {
          categories[item.category] = { count: 0, value: 0 };
        }
        categories[item.category].count += item.currentStock;
        categories[item.category].value += item.currentStock * item.unitCost;
      });
      
      const categoryArray = Object.entries(categories).map(([category, data]) => ({
        category,
        count: data.count,
        value: data.value
      }));
      
      return {
        name,
        totalItems: data.count,
        totalValue: data.value,
        utilization: 0, // Would calculate based on capacity
        lowStockItems,
        overstockItems,
        categories: categoryArray
      };
    });
    
    const totalInventoryValue = stockStore.getTotalInventoryValue();
    const averageLocationValue = locations.length > 0 ? totalInventoryValue / locations.length : 0;
    
    const mostUtilizedLocation = locations.reduce((max, loc) => 
      loc.totalValue > max.totalValue ? loc : max
    ).name;
    
    const leastUtilizedLocation = locations.reduce((min, loc) => 
      loc.totalValue < min.totalValue ? loc : min
    ).name;
    
    return {
      locations,
      summary: {
        totalLocations: locations.length,
        totalInventoryValue,
        averageLocationValue,
        mostUtilizedLocation,
        leastUtilizedLocation
      }
    };
  },

  generateCategoryReport: () => {
    const stockStore = useStockStore.getState();
    const categoryBreakdown = stockStore.getCategoryBreakdown();
    
    const categories = Object.entries(categoryBreakdown).map(([name, data]) => {
      const items = stockStore.getStockItemsByCategory(name as any);
      const lowStockItems = items.filter(item => item.currentStock <= item.reorderPoint).length;
      const overstockItems = items.filter(item => item.currentStock > item.maximumStock * 0.8).length;
      
      const suppliers = [...new Set(items.map(item => item.supplierName).filter((s): s is string => !!s))];
      
      return {
        name,
        itemCount: items.length,
        totalStock: data.count,
        totalValue: data.value,
        averageItemValue: items.length > 0 ? data.value / items.length : 0,
        lowStockItems,
        overstockItems,
        turnoverRate: 0, // Would calculate based on movements
        suppliers
      };
    });
    
    const totalItems = stockStore.stockItems.length;
    const totalValue = stockStore.getTotalInventoryValue();
    
    const topCategory = categories.reduce((max, cat) => 
      cat.totalValue > max.totalValue ? cat : max
    ).name;
    
    const bottomCategory = categories.reduce((min, cat) => 
      cat.totalValue < min.totalValue ? cat : min
    ).name;
    
    const categoryDistribution = categories.map(cat => ({
      category: cat.name,
      percentage: (cat.totalValue / totalValue) * 100
    }));
    
    return {
      categories,
      summary: {
        totalCategories: categories.length,
        totalItems,
        totalValue,
        topCategory,
        bottomCategory,
        categoryDistribution
      }
    };
  },

  generateFinancialReport: () => {
    const stockStore = useStockStore.getState();
    const supplierStore = useSupplierStore.getState();
    
    const totalInventoryValue = stockStore.getTotalInventoryValue();
    const totalPurchaseOrders = supplierStore.purchaseOrders.length;
    const totalPurchaseValue = supplierStore.purchaseOrders.reduce((sum, po) => sum + po.finalAmount, 0);
    const averageOrderValue = totalPurchaseOrders > 0 ? totalPurchaseValue / totalPurchaseOrders : 0;
    const stockTurnoverRate = stockStore.getStockTurnoverRate();
    const daysInventoryOutstanding = stockStore.getDaysInventoryOutstanding();
    const carryingCostPercentage = 2; // Simplified
    
    const categoryBreakdown = stockStore.getCategoryBreakdown();
    const locationBreakdown = stockStore.getLocationBreakdown();
    const supplierBreakdown = stockStore.getSupplierBreakdown();
    
    const breakdown = {
      byCategory: Object.entries(categoryBreakdown).reduce((acc, [category, data]) => {
        acc[category] = {
          count: data.count,
          value: data.value,
          percentage: (data.value / totalInventoryValue) * 100
        };
        return acc;
      }, {} as Record<string, { count: number; value: number; percentage: number }>),
      
      byLocation: Object.entries(locationBreakdown).reduce((acc, [location, data]) => {
        acc[location] = {
          count: data.count,
          value: data.value,
          percentage: (data.value / totalInventoryValue) * 100
        };
        return acc;
      }, {} as Record<string, { count: number; value: number; percentage: number }>),
      
      bySupplier: Object.entries(supplierBreakdown).reduce((acc, [supplier, data]) => {
        acc[supplier] = {
          count: data.count,
          value: data.value,
          percentage: (data.value / totalInventoryValue) * 100
        };
        return acc;
      }, {} as Record<string, { count: number; value: number; percentage: number }>)
    };
    
    // Simplified trends for demo
    const trends = [
      { period: 'Previous Month', inventoryValue: totalInventoryValue * 0.95, purchaseValue: totalPurchaseValue * 0.9, turnoverRate: stockTurnoverRate * 0.95, change: -5 },
      { period: 'Current Month', inventoryValue: totalInventoryValue, purchaseValue: totalPurchaseValue, turnoverRate: stockTurnoverRate, change: 0 }
    ];
    
    return {
      summary: {
        totalInventoryValue,
        totalPurchaseOrders,
        totalPurchaseValue,
        averageOrderValue,
        stockTurnoverRate,
        daysInventoryOutstanding,
        carryingCostPercentage
      },
      breakdown,
      trends
    };
  },

  // Export Functions — real CSV download (also used for 'excel', which every
  // spreadsheet app opens natively) or a printable HTML page for 'pdf' (via
  // the same hidden-iframe print mechanism every other document in the app
  // uses — see print/engine.ts's openHtmlPrintWindow).
  exportReport: (report, format, title = 'Inventory Report') => {
    if (typeof window === 'undefined') return;
    if (format === 'pdf') {
      openHtmlPrintWindow(buildReportHtml(report, title));
    } else {
      downloadReportCsv(report, title);
    }
  },

  exportInventoryReport: (type, startDate, endDate, format) => {
    const report = get().generateInventoryReport(type, startDate, endDate);
    get().exportReport(report, format, `Inventory Report (${type})`);
  },

  exportLowStockReport: (format) => {
    const report = get().generateLowStockReport();
    get().exportReport(report, format, 'Low Stock Report');
  },

  exportExpiryReport: (daysThreshold, format) => {
    const report = get().generateExpiryReport(daysThreshold);
    get().exportReport(report, format, 'Expiry Report');
  },

  exportMovementReport: (startDate, endDate, format) => {
    const report = get().generateMovementReport(startDate, endDate);
    get().exportReport(report, format, 'Stock Movement Report');
  },

  exportSupplierReport: (format) => {
    const report = get().generateSupplierReport();
    get().exportReport(report, format, 'Supplier Performance Report');
  },

  exportLocationReport: (format) => {
    const report = get().generateLocationReport();
    get().exportReport(report, format, 'Location Report');
  },

  exportCategoryReport: (format) => {
    const report = get().generateCategoryReport();
    get().exportReport(report, format, 'Category Report');
  },

  exportFinancialReport: (format) => {
    const report = get().generateFinancialReport();
    get().exportReport(report, format, 'Financial Report');
  }
}));
