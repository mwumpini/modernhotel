'use client';

import { ordersStore, type FBOrder } from './ordersStore';
import { customerStore } from './customerStore';
import { useTenantStaffStore } from '../tenant/tenantStaffStore';
import { reportDataToSections, sectionsToCSV, sectionsToExcelHtml, sectionsToPdfBlob, type ReportOrgInfo } from '../frontoffice/reportExportFormat';
import { useSettingsStore } from '../settings/store';
import { buildOrgProfile } from '../print/buildOrgProfile';

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

/** The [startDate, endDate] order filter every report below needs — was three
 * separate copies of the same start/end comparison before this. `endDate`'s day
 * is included in full (23:59:59.999), not cut off at midnight, so a single-day
 * "Today" range (start === end) actually captures that whole day's orders. */
function ordersInRange(startDate: string, endDate: string): FBOrder[] {
  const start = new Date(startDate);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);
  return ordersStore.all().filter((order) => {
    const d = orderDate(order);
    return d >= start && d <= end;
  });
}

function lineTotal(item: FBOrder['items'][number]): number {
  return item.price * item.qty;
}

function orderTotal(order: FBOrder): number {
  return order.items.reduce((sum, item) => sum + lineTotal(item), 0);
}

// The real per-item category (food|beverage|dessert|snack|special, set from
// FBMenuItem.category — see serializeOrder.ts) — not a fake Meals/Drinks binary
// invented on top of `route` (route only distinguishes kitchen vs bar prep
// station, not what's actually on the menu). Empty/undefined = no filter (every
// category); a multi-select list, not one choice at a time, since a manager may
// want e.g. Food + Dessert together.
export type CategoryFilter = string[];
function matchesCategoryFilter(item: FBOrder['items'][number], filter: CategoryFilter): boolean {
  if (!filter || filter.length === 0) return true;
  return filter.some((f) => (item.category || '').toLowerCase() === f.toLowerCase());
}

function matchesList(value: string, filter?: string[]): boolean {
  return !filter || filter.length === 0 || filter.includes(value);
}

export interface DailySalesFilters {
  categories?: string[];
  staff?: string[];
  items?: string[];
  customerTypes?: string[];
}

type TicketRow = {
  orderNumber: string;
  table: string;
  item: string;
  quantity: number;
  orderStatus: string;
  // Three distinct, real milestones in the order's own state machine (see
  // VALID_TRANSITIONS in api/fb/orders/[id]/route.ts) — kept as separate columns
  // rather than one "Completed" flag, because they're owned by different people
  // and happen at different times: the kitchen/bar finishing prep (status
  // reaches 'ready') is not the same event as the guest actually being served,
  // which is not the same event as the sale being paid for. A plate can be
  // fully cooked and eaten while still "unpaid" for however long the guest
  // takes to settle the bill — that's not a stuck ticket, so it shouldn't be
  // read as "kitchen didn't finish".
  kitchenBarStatus: 'Completed' | 'Pending' | 'Cancelled';
  billedPaid: 'Yes' | 'No';
  sentAt: string;
  startedPreparingAt: string;
  servedAt: string;
  prepTimeMinutes: number | string;
  preparedBy: string;
};

/** Minutes between two ISO timestamps, or undefined if either is missing —
 * callers show "—" rather than a misleading 0 when the workflow timestamp
 * that would make the duration real was never recorded. */
function minutesBetween(fromIso?: string, toIso?: string): number | undefined {
  if (!fromIso || !toIso) return undefined;
  const from = new Date(fromIso).getTime();
  const to = new Date(toIso).getTime();
  if (isNaN(from) || isNaN(to)) return undefined;
  return Math.max(0, Math.round((to - from) / 60000));
}

class ReportingStore {
  // Sales Reports
  //
  // One row per real line item — not one row per order with its items squashed into a
  // comma-joined cell (not actually queryable/sortable/summable), and not an aggregate
  // summary object either. The KPI cards above the report already show the day's Total
  // Revenue/Discounts/Voids; this is the real list of sales that adds up to those
  // totals — count the rows, sum the Amount column, it should match the KPI card.
  //
  // Cancelled orders are excluded entirely — they were never actually sold, so counting
  // them as "sales" would be wrong; that's what the separate Voided Orders report is
  // for. Status isn't shown as a raw string (pending/preparing/ready/served/billed all
  // read as equally valid "sales" otherwise); Billed/Paid answers the one question that
  // actually matters for a sales log — has this been paid for.
  generateDailySalesReport(date: string, filters: DailySalesFilters = {}): Array<{
    orderNumber: string;
    time: string;
    table: string;
    category: string;
    item: string;
    quantity: number;
    unitPrice: number;
    amount: number;
    customer: string;
    customerType: string;
    server: string;
    discount: number;
    tax: number;
    billedPaid: 'Yes' | 'No';
  }> {
    const orders = ordersStore.all()
      .filter((order) => orderDate(order).toISOString().split('T')[0] === date)
      .filter((order) => order.status !== 'cancelled')
      .filter((order) => matchesList(order.waiterId || '', filters.staff))
      .filter((order) => matchesList(order.customerType, filters.customerTypes));

    const rows: ReturnType<typeof this.generateDailySalesReport> = [];
    orders.forEach((order) => {
      const time = orderDate(order).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
      // Real guest/room when there is one, else the real customer-type label
      // (Walk-in/Bar Tab/Takeout) — never a fabricated name.
      const customer = order.guestName || (order.roomNumber ? `Room ${order.roomNumber}` : order.customerType);

      order.items
        .filter((item) => matchesCategoryFilter(item, filters.categories || []))
        .filter((item) => matchesList(item.name, filters.items))
        .forEach((item) => {
          rows.push({
            orderNumber: order.orderNumber || order.id,
            time,
            table: order.table || '—',
            category: item.category || 'Uncategorized',
            item: item.name,
            quantity: item.qty,
            unitPrice: item.price,
            amount: lineTotal(item),
            customer,
            customerType: order.customerType,
            // waiterId already holds the real server name for API-hydrated orders (see
            // ordersStore.hydrateFromApi's field-reconciliation notes), not a raw staff id.
            server: order.waiterId || '—',
            // Discount/Tax are captured per ORDER, not per item (see FBOrderItem —
            // taxAmount is always 0 there; "tax tracked at order level" per the order
            // creation route) — so on a multi-item order, the same order-level figure
            // appears on each of its item rows rather than being split by item, which
            // would be a made-up allocation.
            discount: order.discountAmount || 0,
            tax: order.taxAmount || 0,
            billedPaid: order.status === 'billed' ? 'Yes' : 'No',
          });
        });
    });

    return rows.sort((a, b) => (a.time < b.time ? 1 : -1));
  }

  generateProductMixReport(startDate: string, endDate: string, categoryFilter: CategoryFilter = []): {
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
    // Same "only the matching items count, and only orders that have any" shape as
    // Daily Sales' category filter above — see matchesCategoryFilter.
    const rows = ordersInRange(startDate, endDate)
      .map(order => order.items.filter(item => matchesCategoryFilter(item, categoryFilter)))
      .filter(items => items.length > 0);

    const totalRevenue = rows.reduce((sum, items) => sum + items.reduce((s, i) => s + lineTotal(i), 0), 0);
    const totalOrders = rows.length;

    // Product performance
    const productSales: Record<string, {
      name: string;
      category: string;
      quantity: number;
      revenue: number;
      orderCount: number;
    }> = {};

    rows.forEach(items => {
      items.forEach(item => {
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
        productSales[item.id].revenue += lineTotal(item);
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

  // One row per staff member — Gross/Discount/Net/Tax/Grand Total/Average Check/Voids,
  // the same shape a hotel POS's "Sales by Staff" report uses. Cancelled orders don't
  // count toward sales (they were never actually sold — see Daily Sales' same rule)
  // but are counted separately as Voids, so a manager can see both how much someone
  // sold AND how often their orders got cancelled.
  generateSalesByEmployeeReport(startDate: string, endDate: string): Array<{
    staff: string;
    role: string;
    transactions: number;
    grossSales: number;
    discounts: number;
    netSales: number;
    tax: number;
    grandTotal: number;
    averageCheck: number;
    voids: number;
  }> {
    const orders = ordersInRange(startDate, endDate);
    const sold = orders.filter((o) => o.status !== 'cancelled');
    const voided = orders.filter((o) => o.status === 'cancelled');

    // Real name/role for the id FBPOS recorded as waiterId — the same tenant staff list its own
    // waiter picker uses (see /api/tenant), not the disconnected, hardcoded lib/fb/employeeStore
    // this replaced (fake staff like "Kwame Addo" that never existed in this hotel's real data).
    // waiterId holds a raw staff id for an order placed in this browser session before its
    // first sync, but the real, already-resolved NAME for anything hydrated from the API (see
    // ordersStore.hydrateFromApi's field-reconciliation notes) — so a name-keyed lookup is
    // checked too, not just the id one, or every real historical order fell through to
    // "Not recorded" despite the correct name already sitting in waiterId.
    const staff = useTenantStaffStore.getState().staff;
    const staffById = new Map(staff.map((s) => [s.id, s]));
    const staffByName = new Map(staff.map((s) => [s.name, s]));
    const resolveStaff = (waiterId: string) => {
      const match = staffById.get(waiterId) || staffByName.get(waiterId);
      return { name: match?.name || waiterId || 'Not recorded', role: match?.role || 'Not recorded' };
    };

    const byStaff: Record<string, {
      transactions: number; grossSales: number; discounts: number; tax: number; grandTotal: number;
    }> = {};
    sold.forEach((order) => {
      const waiterId = order.waiterId;
      if (!waiterId) return;
      if (!byStaff[waiterId]) byStaff[waiterId] = { transactions: 0, grossSales: 0, discounts: 0, tax: 0, grandTotal: 0 };
      const gross = order.subtotal ?? orderTotal(order);
      byStaff[waiterId].transactions += 1;
      byStaff[waiterId].grossSales += gross;
      byStaff[waiterId].discounts += order.discountAmount || 0;
      byStaff[waiterId].tax += order.taxAmount || 0;
      byStaff[waiterId].grandTotal += order.total ?? gross;
    });

    const voidsByStaff: Record<string, number> = {};
    voided.forEach((order) => {
      if (!order.waiterId) return;
      voidsByStaff[order.waiterId] = (voidsByStaff[order.waiterId] || 0) + 1;
    });

    const allWaiterIds = new Set([...Object.keys(byStaff), ...Object.keys(voidsByStaff)]);

    return Array.from(allWaiterIds).map((waiterId) => {
      const data = byStaff[waiterId] || { transactions: 0, grossSales: 0, discounts: 0, tax: 0, grandTotal: 0 };
      const { name, role } = resolveStaff(waiterId);
      return {
        staff: name,
        role,
        transactions: data.transactions,
        grossSales: data.grossSales,
        discounts: data.discounts,
        netSales: data.grossSales - data.discounts,
        tax: data.tax,
        grandTotal: data.grandTotal,
        averageCheck: data.transactions > 0 ? data.grandTotal / data.transactions : 0,
        voids: voidsByStaff[waiterId] || 0,
      };
    }).sort((a, b) => b.grandTotal - a.grandTotal);
  }

  // Room Charge Report — every order tagged with a room number (charged, or intended to
  // be charged, to a guest's room) in the period. Posting Status can only honestly be
  // Posted (folioId set — the charge actually landed on the guest's folio, see
  // api/fb/orders/[id]/route.ts's billed handling) or Not Posted — there's no real
  // Failed/Reversed state recorded anywhere to distinguish "not yet billed" from
  // "posting failed".
  generateRoomChargeReport(startDate: string, endDate: string): Array<{
    orderNumber: string;
    date: string;
    room: string;
    guest: string;
    table: string;
    staff: string;
    amount: number;
    tax: number;
    total: number;
    postingStatus: 'Posted' | 'Not Posted';
  }> {
    return ordersInRange(startDate, endDate)
      .filter((order) => !!order.roomNumber && order.status !== 'cancelled')
      .map((order) => ({
        orderNumber: order.orderNumber || order.id,
        date: (order.createdAt || order.timestamp || '').split('T')[0],
        room: order.roomNumber || '—',
        guest: order.guestName || '—',
        table: order.table || '—',
        staff: order.waiterId || '—',
        amount: order.subtotal ?? orderTotal(order),
        tax: order.taxAmount || 0,
        total: order.total ?? orderTotal(order),
        postingStatus: (order.folioId ? 'Posted' : 'Not Posted') as 'Posted' | 'Not Posted',
      }))
      .sort((a, b) => (a.date < b.date ? 1 : -1));
  }

  // Kitchen/Bar tickets — a real history log (every item sent to that station in
  // the period), not a "what's outstanding right now" snapshot: that live view
  // already exists in KitchenDisplaySystem.tsx. Per-item prep timestamps aren't
  // persisted (FBOrderItem has no startedAt/readyAt/preparedAt columns — see
  // schema.prisma) — only the order's own preparingAt/servedAt are real, so a
  // multi-item order's prep time is shown once per ticket row, not computed
  // per item.
  private ticketRows(route: 'kitchen' | 'bar', startDate: string, endDate: string): TicketRow[] {
    const orders = ordersInRange(startDate, endDate);
    const rows: TicketRow[] = [];
    orders.forEach((order) => {
      const kitchenBarStatus: TicketRow['kitchenBarStatus'] =
        order.status === 'cancelled' ? 'Cancelled'
        : (order.status === 'ready' || order.status === 'served' || order.status === 'billed') ? 'Completed'
        : 'Pending';
      const billedPaid: TicketRow['billedPaid'] = order.status === 'billed' ? 'Yes' : 'No';

      order.items.filter((item) => item.route === route).forEach((item) => {
        const prep = minutesBetween(order.preparingAt, order.servedAt);
        rows.push({
          orderNumber: order.orderNumber || order.id,
          table: order.table || '—',
          item: item.name,
          quantity: item.qty,
          orderStatus: order.status,
          kitchenBarStatus,
          billedPaid,
          sentAt: order.createdAt || order.timestamp || '',
          startedPreparingAt: order.preparingAt || '—',
          servedAt: order.servedAt || '—',
          prepTimeMinutes: prep ?? '—',
          preparedBy: order.assignedToName || order.waiterId || '—',
        });
      });
    });
    return rows.sort((a, b) => (a.sentAt < b.sentAt ? 1 : -1));
  }

  generateKitchenTicketsReport(startDate: string, endDate: string) {
    return this.ticketRows('kitchen', startDate, endDate);
  }

  generateBarTicketsReport(startDate: string, endDate: string) {
    return this.ticketRows('bar', startDate, endDate);
  }

  // Voided/Cancelled Orders — filtered on updatedAt (the closest real timestamp
  // to "when it was cancelled"; there's no dedicated cancelledAt column) rather
  // than createdAt, so an order placed yesterday and cancelled today shows up
  // in today's range, not yesterday's. The cancellation reason isn't shown here
  // — it's captured in the audit log (FB_ORDER_CANCELLED, see
  // api/fb/orders/[id]/route.ts), not on the order record itself.
  generateVoidedOrdersReport(startDate: string, endDate: string): Array<{
    orderNumber: string;
    table: string;
    venue: string;
    server: string;
    items: string;
    total: number;
    cancelledAt: string;
  }> {
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    return ordersStore.all()
      .filter((order) => order.status === 'cancelled')
      .filter((order) => {
        const d = new Date(order.updatedAt || order.createdAt || '');
        return !isNaN(d.getTime()) && d >= start && d <= end;
      })
      .map((order) => ({
        orderNumber: order.orderNumber || order.id,
        table: order.table || '—',
        venue: order.venue,
        server: order.waiterId || '—',
        items: order.items.map((i) => `${i.qty}x ${i.name}`).join(', ') || 'None',
        total: order.total ?? orderTotal(order),
        cancelledAt: order.updatedAt || '—',
      }))
      .sort((a, b) => (a.cancelledAt < b.cancelledAt ? 1 : -1));
  }

  // Discount Report — every order with a real discountAmount in the period,
  // straight from the persisted order (not reconstructed per line item).
  generateDiscountReport(startDate: string, endDate: string): Array<{
    orderNumber: string;
    date: string;
    table: string;
    server: string;
    subtotal: number;
    discountAmount: number;
    discountPercentage: number;
    serviceCharge: number;
    total: number;
  }> {
    return ordersInRange(startDate, endDate)
      .filter((order) => (order.discountAmount || 0) > 0)
      .map((order) => {
        const subtotal = order.subtotal ?? orderTotal(order);
        return {
          orderNumber: order.orderNumber || order.id,
          date: (order.createdAt || order.timestamp || '').split('T')[0],
          table: order.table || '—',
          server: order.waiterId || '—',
          subtotal,
          discountAmount: order.discountAmount || 0,
          discountPercentage: subtotal > 0 ? ((order.discountAmount || 0) / subtotal) * 100 : 0,
          serviceCharge: order.serviceCharge || 0,
          total: order.total ?? subtotal,
        };
      })
      .sort((a, b) => b.discountAmount - a.discountAmount);
  }

  // Table Sales — one row per table, aggregated over the selected period (the
  // same "aggregate a real dimension over a range" shape as Front Office's Room
  // Performance report), not a live "who's sitting there now" view.
  generateTableSalesReport(startDate: string, endDate: string): Array<{
    table: string;
    orders: number;
    covers: number;
    sales: number;
    averageCheck: number;
  }> {
    const orders = ordersInRange(startDate, endDate).filter((o) => o.status !== 'cancelled');
    const byTable: Record<string, { orders: number; covers: number; sales: number }> = {};
    orders.forEach((order) => {
      const table = order.table || 'Unassigned';
      if (!byTable[table]) byTable[table] = { orders: 0, covers: 0, sales: 0 };
      byTable[table].orders += 1;
      byTable[table].covers += order.covers || 0;
      byTable[table].sales += order.total ?? orderTotal(order);
    });
    return Object.entries(byTable)
      .map(([table, data]) => ({
        table,
        orders: data.orders,
        covers: data.covers,
        sales: data.sales,
        averageCheck: data.orders > 0 ? data.sales / data.orders : 0,
      }))
      .sort((a, b) => b.sales - a.sales);
  }

  // The 4 top-row KPI tiles shown above whichever report table is selected (Total
  // Revenue/Discounts/Voids for the chosen period; Pending Orders is deliberately
  // NOT period-filtered — it's a live "what's outstanding right now" count, the
  // same thing the Restaurant & Bar overview's Active Orders card shows, not a
  // historical figure a date range would make sense for).
  generateSummaryKPIs(startDate: string, endDate: string): {
    totalRevenue: number;
    totalDiscounts: number;
    totalVoids: number;
    pendingOrders: number;
  } {
    const orders = ordersInRange(startDate, endDate);
    const totalRevenue = orders
      .filter((o) => o.status !== 'cancelled')
      .reduce((sum, o) => sum + (o.total ?? orderTotal(o)), 0);
    const totalDiscounts = orders.reduce((sum, o) => sum + (o.discountAmount || 0), 0);
    const totalVoids = orders.filter((o) => o.status === 'cancelled').length;
    const pendingOrders = ordersStore.all()
      .filter((o) => o.status === 'pending' || o.status === 'preparing' || o.status === 'ready').length;
    return { totalRevenue, totalDiscounts, totalVoids, pendingOrders };
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


  // Export and Print — same shared shaping/serializing pipeline Front Office's
  // reportingStore uses (reportExportFormat.ts), so a report's CSV/Excel/PDF
  // always matches what's on screen instead of a JSON dump wearing a .csv name.
  async exportReport(reportData: any, format: 'pdf' | 'excel' | 'csv', filename: string, generatedLabel?: string): Promise<string> {
    const sections = reportDataToSections(reportData);
    const org: ReportOrgInfo = buildOrgProfile(useSettingsStore.getState());
    const title = filename.replace(/\.[^.]+$/, '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    const blob = format === 'csv'
      ? new Blob([sectionsToCSV(sections, org, generatedLabel)], { type: 'text/csv' })
      : format === 'excel'
      ? new Blob([sectionsToExcelHtml(title, sections, org, generatedLabel)], { type: 'application/vnd.ms-excel' })
      : await sectionsToPdfBlob(title, sections, org, generatedLabel);
    return URL.createObjectURL(blob);
  }
}

export const reportingStore = new ReportingStore();
