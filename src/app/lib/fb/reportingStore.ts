'use client';

import { SalesReport, InventoryReport, LaborReport } from './models';
import { ordersStore, type FBOrder } from './ordersStore';
import { inventoryStore } from './inventoryStore';
import { customerStore } from './customerStore';
import { supplierStore } from './supplierStore';
import { employeeStore } from './employeeStore';

/**
 * order.id is a cuid or `ORD-<timestamp>` string — never a valid Date input — and
 * order.timestamp is never actually set by ordersStore.add()/update() (only
 * createdAt/updatedAt are). `new Date(order.timestamp || order.id)` therefore
 * produces an Invalid Date whose .toISOString() throws RangeError. Use createdAt
 * (always set) as the real fallback, and never let an invalid result reach the caller.
 */
function orderDate(order: FBOrder): Date {
  const raw = order.timestamp || order.createdAt;
  const d = raw ? new Date(raw) : new Date(NaN);
  return isNaN(d.getTime()) ? new Date() : d;
}

class ReportingStore {
  private listeners: Array<() => void> = [];
  private paymentSnap: { cash: number; card: number; mobile: number; roomCharge: number } | null = null;

  async hydrateReportsFromApi(date?: string) {
    try {
      const { getClientTenantSubdomain } = await import('../api/clientTenant');
      const day = date || new Date().toISOString().slice(0, 10);
      const res = await fetch(`/api/fb/reports?date=${day}`, {
        headers: { 'x-tenant-subdomain': getClientTenantSubdomain() },
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data?.paymentBreakdown) {
        this.paymentSnap = {
          cash: Number(data.paymentBreakdown.cash || 0),
          card: Number(data.paymentBreakdown.card || 0),
          mobile: Number(data.paymentBreakdown.mobile || 0),
          roomCharge: Number(data.paymentBreakdown.roomCharge || 0),
        };
        this.notifyListeners();
      }
    } catch {
      /* keep prior snapshot */
    }
  }

  // Sales Reports
  generateDailySalesReport(date: string): SalesReport {
    const orders = ordersStore.all().filter(order => {
      const d = orderDate(order).toISOString().split('T')[0];
      return d === date;
    });

    const totalSales = orders.reduce((sum, order) => {
      return sum + order.items.reduce((itemSum, item) => {
        return itemSum + (item.price * item.qty);
      }, 0);
    }, 0);

    const totalOrders = orders.length;
    const averageOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0;

    // Real payment mix from /api/fb/reports (zeros until hydrate).
    const paymentBreakdown = this.paymentSnap
      ? { ...this.paymentSnap }
      : { cash: 0, card: 0, mobile: 0, roomCharge: 0 };

    // Top selling items
    const itemSales: Record<string, { itemId: string; name: string; quantity: number; revenue: number }> = {};
    orders.forEach(order => {
      order.items.forEach(item => {
        if (!itemSales[item.id]) {
          itemSales[item.id] = { itemId: item.id, name: item.name, quantity: 0, revenue: 0 };
        }
        itemSales[item.id].quantity += item.qty;
        itemSales[item.id].revenue += item.price * item.qty;
      });
    });

    const topSellingItems = Object.values(itemSales)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    // Sales by hour
    const salesByHour: Array<{ hour: number; orders: number; revenue: number }> = [];
    for (let hour = 6; hour <= 23; hour++) {
      const hourOrders = orders.filter(order => {
        const orderHour = orderDate(order).getHours();
        return orderHour === hour;
      });

      const hourRevenue = hourOrders.reduce((sum, order) => {
        return sum + order.items.reduce((itemSum, item) => {
          return itemSum + (item.price * item.qty);
        }, 0);
      }, 0);

      salesByHour.push({
        hour,
        orders: hourOrders.length,
        revenue: hourRevenue
      });
    }

    return {
      id: `SALES-${date}`,
      date,
      totalSales,
      totalOrders,
      averageOrderValue,
      paymentBreakdown,
      topSellingItems,
      salesByHour
    };
  }

  generateProductMixReport(startDate: string, endDate: string): {
    period: string;
    totalRevenue: number;
    totalOrders: number;
    productPerformance: Array<{
      itemId: string;
      name: string;
      category: string;
      quantity: number;
      revenue: number;
      percentageOfSales: number;
      averageOrderValue: number;
    }>;
    categoryBreakdown: Record<string, { quantity: number; revenue: number; percentage: number }>;
  } {
    const orders = ordersStore.all().filter(order => {
      const d = orderDate(order);
      const start = new Date(startDate);
      const end = new Date(endDate);
      return d >= start && d <= end;
    });

    const totalRevenue = orders.reduce((sum, order) => {
      return sum + order.items.reduce((itemSum, item) => {
        return itemSum + (item.price * item.qty);
      }, 0);
    }, 0);

    const totalOrders = orders.length;

    // Product performance
    const productSales: Record<string, {
      name: string;
      category: string;
      quantity: number;
      revenue: number;
      orderCount: number;
    }> = {};

    orders.forEach(order => {
      order.items.forEach(item => {
        if (!productSales[item.id]) {
          productSales[item.id] = {
            name: item.name,
            category: item.category || 'Unknown',
            quantity: 0,
            revenue: 0,
            orderCount: 0
          };
        }
        productSales[item.id].quantity += item.qty;
        productSales[item.id].revenue += item.price * item.qty;
        productSales[item.id].orderCount += 1;
      });
    });

    const productPerformance = Object.entries(productSales).map(([itemId, data]) => ({
      itemId,
      name: data.name,
      category: data.category,
      quantity: data.quantity,
      revenue: data.revenue,
      percentageOfSales: totalRevenue > 0 ? (data.revenue / totalRevenue) * 100 : 0,
      averageOrderValue: data.orderCount > 0 ? data.revenue / data.orderCount : 0
    })).sort((a, b) => b.revenue - a.revenue);

    // Category breakdown
    const categoryBreakdown: Record<string, { quantity: number; revenue: number; percentage: number }> = {};
    productPerformance.forEach(product => {
      if (!categoryBreakdown[product.category]) {
        categoryBreakdown[product.category] = { quantity: 0, revenue: 0, percentage: 0 };
      }
      categoryBreakdown[product.category].quantity += product.quantity;
      categoryBreakdown[product.category].revenue += product.revenue;
    });

    // Calculate category percentages
    Object.keys(categoryBreakdown).forEach(category => {
      categoryBreakdown[category].percentage = totalRevenue > 0 
        ? (categoryBreakdown[category].revenue / totalRevenue) * 100 
        : 0;
    });

    return {
      period: `${startDate} to ${endDate}`,
      totalRevenue,
      totalOrders,
      productPerformance,
      categoryBreakdown
    };
  }

  generateSalesByEmployeeReport(startDate: string, endDate: string): {
    period: string;
    totalSales: number;
    employeePerformance: Array<{
      employeeId: string;
      name: string;
      role: string;
      orders: number;
      revenue: number;
      averageOrderValue: number;
      percentageOfSales: number;
    }>;
  } {
    const orders = ordersStore.all().filter(order => {
      const d = orderDate(order);
      const start = new Date(startDate);
      const end = new Date(endDate);
      return d >= start && d <= end;
    });

    const totalSales = orders.reduce((sum, order) => {
      return sum + order.items.reduce((itemSum, item) => {
        return itemSum + (item.price * item.qty);
      }, 0);
    }, 0);

    // Employee performance
    const employeeSales: Record<string, {
      name: string;
      role: string;
      orders: number;
      revenue: number;
    }> = {};

    orders.forEach(order => {
      const waiterId = order.waiterId;
      if (!waiterId) return;

      if (!employeeSales[waiterId]) {
        employeeSales[waiterId] = {
          name: waiterId, // In real system, this would be looked up from employee store
          role: 'waiter',
          orders: 0,
          revenue: 0
        };
      }

      employeeSales[waiterId].orders += 1;
      employeeSales[waiterId].revenue += order.items.reduce((sum, item) => {
        return sum + (item.price * item.qty);
      }, 0);
    });

    const employeePerformance = Object.entries(employeeSales).map(([employeeId, data]) => ({
      employeeId,
      name: data.name,
      role: data.role,
      orders: data.orders,
      revenue: data.revenue,
      averageOrderValue: data.orders > 0 ? data.revenue / data.orders : 0,
      percentageOfSales: totalSales > 0 ? (data.revenue / totalSales) * 100 : 0
    })).sort((a, b) => b.revenue - a.revenue);

    return {
      period: `${startDate} to ${endDate}`,
      totalSales,
      employeePerformance
    };
  }

  // Inventory Reports
  generateInventoryReport(date: string): InventoryReport {
    const totalValue = inventoryStore.getInventoryValue();
    const lowStockItems = inventoryStore.getLowStockIngredients();
    const expiringItems = inventoryStore.getExpiringIngredients();
    
    // Calculate waste value for the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const wasteValue = inventoryStore.getWasteValue(thirtyDaysAgo.toISOString(), date);
    
    // Calculate COGS for the last 30 days
    const cogs = inventoryStore.getCostOfGoodsSold(thirtyDaysAgo.toISOString(), date);
    
    // Calculate stock turnover (simplified)
    const stockTurnover = totalValue > 0 ? cogs / totalValue : 0;

    return {
      id: `INV-${date}`,
      date,
      totalValue,
      lowStockItems,
      expiringItems,
      wasteValue,
      cogs,
      stockTurnover
    };
  }

  generateWasteReport(startDate: string, endDate: string): {
    period: string;
    totalWasteValue: number;
    wasteByReason: Record<string, { quantity: number; cost: number; percentage: number }>;
    wasteByIngredient: Array<{
      ingredientId: string;
      name: string;
      quantity: number;
      cost: number;
      reason: string;
    }>;
    wasteByEmployee: Record<string, { quantity: number; cost: number; percentage: number }>;
  } {
    const wasteRecords = inventoryStore.getWasteRecords();
    const filteredWaste = wasteRecords.filter(waste => {
      const wasteDate = new Date(waste.date);
      const start = new Date(startDate);
      const end = new Date(endDate);
      return wasteDate >= start && wasteDate <= end;
    });

    const totalWasteValue = filteredWaste.reduce((sum, waste) => sum + waste.cost, 0);

    // Waste by reason
    const wasteByReason: Record<string, { quantity: number; cost: number; percentage: number }> = {};
    filteredWaste.forEach(waste => {
      if (!wasteByReason[waste.reason]) {
        wasteByReason[waste.reason] = { quantity: 0, cost: 0, percentage: 0 };
      }
      wasteByReason[waste.reason].quantity += waste.quantity;
      wasteByReason[waste.reason].cost += waste.cost;
    });

    // Calculate percentages
    Object.keys(wasteByReason).forEach(reason => {
      wasteByReason[reason].percentage = totalWasteValue > 0 
        ? (wasteByReason[reason].cost / totalWasteValue) * 100 
        : 0;
    });

    // Waste by ingredient
    const wasteByIngredient = filteredWaste.map(waste => {
      const ingredient = inventoryStore.getIngredient(waste.ingredientId);
      return {
        ingredientId: waste.ingredientId,
        name: ingredient?.name || 'Unknown',
        quantity: waste.quantity,
        cost: waste.cost,
        reason: waste.reason
      };
    }).sort((a, b) => b.cost - a.cost);

    // Waste by employee
    const wasteByEmployee: Record<string, { quantity: number; cost: number; percentage: number }> = {};
    filteredWaste.forEach(waste => {
      if (!wasteByEmployee[waste.employeeId]) {
        wasteByEmployee[waste.employeeId] = { quantity: 0, cost: 0, percentage: 0 };
      }
      wasteByEmployee[waste.employeeId].quantity += waste.quantity;
      wasteByEmployee[waste.employeeId].cost += waste.cost;
    });

    // Calculate percentages
    Object.keys(wasteByEmployee).forEach(employeeId => {
      wasteByEmployee[employeeId].percentage = totalWasteValue > 0 
        ? (wasteByEmployee[employeeId].cost / totalWasteValue) * 100 
        : 0;
    });

    return {
      period: `${startDate} to ${endDate}`,
      totalWasteValue,
      wasteByReason,
      wasteByIngredient,
      wasteByEmployee
    };
  }

  // Labor Reports
  generateLaborReport(startDate: string, endDate: string): LaborReport {
    const laborCosts = employeeStore.getLaborCosts(startDate, endDate);
    const totalHours = laborCosts.totalHours;
    const totalPay = laborCosts.totalPay;
    const averageHourlyRate = laborCosts.averageHourlyRate;

    // Calculate labor percentage (would need sales data for this)
    const salesData = this.generateDailySalesReport(startDate);
    const totalSales = salesData.totalSales;
    const laborPercentage = totalSales > 0 ? (totalPay / totalSales) * 100 : 0;

    // Employee breakdown
    const employeeBreakdown = Object.entries(laborCosts.byRole).map(([role, data]) => {
      const employees = employeeStore.getEmployeesByRole(role);
      const totalRoleHours = data.hours;
      const totalRolePay = data.pay;
      
      // Calculate efficiency (simplified - could be based on orders processed, etc.)
      const efficiency = totalRoleHours > 0 ? Math.min(100, (totalRoleHours / (employees.length * 40)) * 100) : 0;

      return {
        employeeId: role, // Using role as ID for this summary
        name: `${role} (${employees.length} employees)`,
        hours: totalRoleHours,
        pay: totalRolePay,
        efficiency
      };
    });

    return {
      id: `LABOR-${startDate}-${endDate}`,
      period: `${startDate} to ${endDate}`,
      totalHours,
      totalPay,
      averageHourlyRate,
      laborPercentage,
      employeeBreakdown
    };
  }

  // Financial Reports
  generateFinancialSummary(startDate: string, endDate: string): {
    period: string;
    totalRevenue: number;
    totalCOGS: number;
    grossProfit: number;
    grossProfitMargin: number;
    totalLaborCost: number;
    laborPercentage: number;
    totalWaste: number;
    wastePercentage: number;
    netProfit: number;
    netProfitMargin: number;
  } {
    const salesReport = this.generateDailySalesReport(startDate);
    const inventoryReport = this.generateInventoryReport(endDate);
    const laborReport = this.generateLaborReport(startDate, endDate);
    const wasteReport = this.generateWasteReport(startDate, endDate);

    const totalRevenue = salesReport.totalSales;
    const totalCOGS = inventoryReport.cogs;
    const grossProfit = totalRevenue - totalCOGS;
    const grossProfitMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;
    
    const totalLaborCost = laborReport.totalPay;
    const laborPercentage = totalRevenue > 0 ? (totalLaborCost / totalRevenue) * 100 : 0;
    
    const totalWaste = wasteReport.totalWasteValue;
    const wastePercentage = totalRevenue > 0 ? (totalWaste / totalRevenue) * 100 : 0;
    
    const netProfit = grossProfit - totalLaborCost - totalWaste;
    const netProfitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

    return {
      period: `${startDate} to ${endDate}`,
      totalRevenue,
      totalCOGS,
      grossProfit,
      grossProfitMargin,
      totalLaborCost,
      laborPercentage,
      totalWaste,
      wastePercentage,
      netProfit,
      netProfitMargin
    };
  }

  // Customer Analytics
  generateCustomerAnalyticsReport(): {
    totalCustomers: number;
    activeCustomers: number;
    customerRetentionRate: number;
    averageCustomerLifetimeValue: number;
    customerGrowthRate: number;
    loyaltyTierDistribution: Record<string, number>;
    topCustomers: Array<{
      customerId: string;
      name: string;
      totalSpent: number;
      visitCount: number;
      loyaltyPoints: number;
      tier: string;
    }>;
  } {
    const totalCustomers = customerStore.getAllCustomers().length;
    const activeCustomers = customerStore.getActiveCustomers().length;
    const customerRetentionRate = customerStore.getCustomerRetentionRate();
    const averageCustomerLifetimeValue = customerStore.getAverageCustomerLifetimeValue();
    const customerGrowthRate = customerStore.getCustomerGrowthRate(30);

    // Loyalty tier distribution
    const customers = customerStore.getAllCustomers();
    const loyaltyTierDistribution: Record<string, number> = {};
    customers.forEach(customer => {
      const tier = customerStore.getLoyaltyTier(customer.loyaltyPoints);
      loyaltyTierDistribution[tier] = (loyaltyTierDistribution[tier] || 0) + 1;
    });

    // Top customers
    const topCustomers = customerStore.getTopSpendingCustomers(10).map(customer => ({
      customerId: customer.id,
      name: `${customer.firstName} ${customer.lastName}`,
      totalSpent: customer.totalSpent,
      visitCount: customer.visitCount,
      loyaltyPoints: customer.loyaltyPoints,
      tier: customerStore.getLoyaltyTier(customer.loyaltyPoints)
    }));

    return {
      totalCustomers,
      activeCustomers,
      customerRetentionRate,
      averageCustomerLifetimeValue,
      customerGrowthRate,
      loyaltyTierDistribution,
      topCustomers
    };
  }

  // Supplier Analytics
  generateSupplierAnalyticsReport(): {
    totalSuppliers: number;
    activeSuppliers: number;
    averageRating: number;
    topProductCategory: string;
    supplierDistribution: Record<string, number>;
    topRatedSuppliers: Array<{
      supplierId: string;
      name: string;
      rating: number;
      products: string[];
      contactPerson: string;
    }>;
  } {
    const metrics = supplierStore.getSupplierPerformanceMetrics();
    const topRatedSuppliers = supplierStore.getTopRatedSuppliers(5).map(supplier => ({
      supplierId: supplier.id,
      name: supplier.name,
      rating: supplier.rating,
      products: supplier.products,
      contactPerson: supplier.contactPerson
    }));

    return {
      totalSuppliers: metrics.totalSuppliers,
      activeSuppliers: metrics.activeSuppliers,
      averageRating: metrics.averageRating,
      topProductCategory: metrics.topProductCategory,
      supplierDistribution: metrics.supplierDistribution,
      topRatedSuppliers
    };
  }

  // Export functionality
  exportReport(reportType: string, data: any): string {
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `${reportType}_${timestamp}.csv`;
    
    // This would generate CSV data based on the report type
    // For now, return a simple JSON string
    return JSON.stringify(data, null, 2);
  }

  // Subscription management
  subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener());
  }
}

export const reportingStore = new ReportingStore();
