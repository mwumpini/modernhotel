'use client';

import React from 'react';
import { Card, CardBody, CardHeader, Button } from "@heroui/react";
import { useAnalyticsStore } from '../lib/analytics/analyticsStore';
import { useReportingStore } from '../lib/frontoffice/reportingStore';
import { auditLogStore, AuditRecord } from '../lib/analytics/auditLogStore';
import { frontOfficeStore } from '../lib/frontoffice/store';
import { housekeepingStore } from '../lib/housekeeping/store';
import { useStockStore } from '../lib/inventory/stockStore';
import { announcementStore } from '../lib/analytics/announcementStore';
import { ordersStore } from '../lib/fb/ordersStore';
import { kitchenOpsStore } from '../lib/fb/kitchenOpsStore';
import { useIncidentStore } from '../lib/security/incidentStore';
import { usePatrolStore } from '../lib/security/patrolStore';
import { fetchEventBookings } from '../lib/frontoffice/eventsApi';
import { getZonedClockParts } from '../lib/frontoffice/propertyTime';
import { resolvePropertyTimezone } from '../lib/frontoffice/propertyTimeClient';
import { useAccountingStore } from '../lib/accounting/store';
import { toRollupCoa } from '../lib/accounting/coaHierarchy';
import { buildFinancialAccountTree } from '../lib/accounting/financialReportRollup';
import OfflineIndicator from './OfflineIndicator';
import DeptMessenger from './DeptMessenger';
import RecentActivities from './RecentActivities';
import DeptNotices from './DeptNotices';
import CustomizeViewControl, { HideCardButton } from './dashboard/CustomizeViewControl';
import { useDashboardVisibility, type DashboardSectionDef } from '../lib/dashboard/useDashboardVisibility';
// Removed broadcast/mentions sidebar; bottom notices cover communication needs

// The full set of hideable cards on this dashboard — used both to render the
// ✕ hide button on each card and to populate the "Customize View" restore
// panel. Kept as a module-level constant (not recreated per render) since
// useDashboardVisibility only reads it once on mount.
const DASHBOARD_SECTIONS: DashboardSectionDef[] = [
  { id: 'liveOps', label: 'Live Operations' },
  { id: 'security', label: 'Security & Safety' },
  { id: 'housekeeping', label: 'Housekeeping Status' },
  { id: 'events', label: 'Conferences & Events' },
  { id: 'financial', label: "Today's Financial Pulse" },
  { id: 'alerts', label: 'System Alerts' },
  { id: 'trend', label: '7-Day Occupancy Trend' },
  { id: 'fbKitchen', label: 'F&B and Kitchen Efficiency' },
  { id: 'stock', label: 'Critical Stock Levels' },
  { id: 'recentActivities', label: 'Recent Activities' },
  { id: 'notices', label: 'Executive Notices' },
];


/** Today's date at the hotel, in the hotel's own timezone — not the browser's clock or UTC. */
function propertyToday(): string {
  return getZonedClockParts(new Date(), resolvePropertyTimezone()).date;
}

function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** A smooth curve through the given points (Catmull-Rom, converted to cubic Beziers) — used for the
 * occupancy trend so it reads as a trend line rather than a bar-by-bar comparison. */
function smoothLinePath(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x},${points[0].y}`;
  let d = `M ${points[0].x},${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] || points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x},${c1y} ${c2x},${c2y} ${p2.x},${p2.y}`;
  }
  return d;
}

function formatCurrency(amount: number | undefined) {
  if (!amount || Number.isNaN(amount)) return '₵0';
  try {
    return new Intl.NumberFormat('en-GH', { style: 'currency', currency: 'GHS', maximumFractionDigits: 0 }).format(amount).replace('GHS', '₵');
  } catch {
    return `₵${Math.round(amount).toLocaleString()}`;
  }
}

export default function ExecutiveManagementDashboard() {
  // Selected (not destructured from the whole store) so this component only
  // re-renders when these two actions actually change reference — which, since
  // they're plain Zustand actions, is never. Destructuring the whole store
  // (the previous code) re-subscribes to every field in analyticsStore /
  // reportingStore, so any unrelated field changing there re-renders this
  // component; combined with a useEffect below that depends on these two
  // functions and re-subscribes several other stores on every run, that turned
  // into a self-sustaining loop of report/analytics recalculation.
  const calculateOccupancyAnalytics = useAnalyticsStore((s) => s.calculateOccupancyAnalytics);
  const generateDailyFlashReport = useReportingStore((s) => s.generateDailyFlashReport);

  const { isHidden, hide, toggle: toggleSection, showAll, hiddenCount } = useDashboardVisibility('dashboard.hidden.executive', DASHBOARD_SECTIONS);

  // IMPORTANT: Keep initial render deterministic across server and client
  const [occupancy, setOccupancy] = React.useState<ReturnType<typeof calculateOccupancyAnalytics> | null>(null);
  const [revenueToday, setRevenueToday] = React.useState<number>(0);
  // Real GL-posted revenue for the selected date (from Chart of Accounts / journal entries),
  // as distinct from revenueToday (folio charges accrued today, which can include an in-house
  // guest's room charges days before they check out and those charges actually post to the GL).
  const [postedRevenue, setPostedRevenue] = React.useState<number>(0);
  const [recent, setRecent] = React.useState<AuditRecord[]>([]);
  const [adr, setAdr] = React.useState<number>(0);
  const [revpar, setRevpar] = React.useState<number>(0);
  const [arrivals, setArrivals] = React.useState<number>(0);
  const [departures, setDepartures] = React.useState<number>(0);
  const [occupancyTrend, setOccupancyTrend] = React.useState<Array<{date: string; rate: number}>>([]);
  const [trendHoverIdx, setTrendHoverIdx] = React.useState<number | null>(null);
  const [revenueSplit, setRevenueSplit] = React.useState<{room: number; fb: number; other: number; total: number}>({ room: 0, fb: 0, other: 0, total: 0 });
  const [selectedDate, setSelectedDate] = React.useState<string>('');
  // Live store updates refresh whichever date is on screen, not just today.
  const selectedDateRef = React.useRef('');
  selectedDateRef.current = selectedDate;
  // Room counts for the selected date — kept separate from `occupancy` (which is
  // always "today") so CSV/PDF exports don't mix today's room counts with a
  // different selected date's revenue/ADR/arrivals figures.
  const [roomCounts, setRoomCounts] = React.useState<{ totalRooms: number; occupiedRooms: number; availableRooms: number }>({ totalRooms: 0, occupiedRooms: 0, availableRooms: 0 });

  // LIVE OPS SNAPSHOT
  const [guestsInHouse, setGuestsInHouse] = React.useState<number>(0);
  const [awaitingArrival, setAwaitingArrival] = React.useState<number>(0);
  const [awaitingDeparture, setAwaitingDeparture] = React.useState<number>(0);
  const [overstays, setOverstays] = React.useState<number>(0);
  const [expectedOcc, setExpectedOcc] = React.useState<number>(0);

  // HOUSEKEEPING SUMMARY — rooms by their real status
  const [hk, setHk] = React.useState({ total: 0, ready: 0, occupied: 0, inProgress: 0, dirty: 0, outOfOrder: 0 });

  // SECURITY and EVENTS come straight from their own stores / bookings
  const incidents = useIncidentStore((st) => st.incidents);
  const patrols = usePatrolStore((st) => st.patrols);
  const [eventBookings, setEventBookings] = React.useState<Array<Record<string, any>>>([]);

  // F&B and Kitchen Efficiency
  const [fbEff, setFbEff] = React.useState<{ total: number; served: number; queue: number; avgOrder: number; lastHour: number }>({ total: 0, served: 0, queue: 0, avgOrder: 0, lastHour: 0 });
  const [kitchEff, setKitchEff] = React.useState<{ assigned: number; prepared: number; avgPrep: number; sla15: number }>({ assigned: 0, prepared: 0, avgPrep: 0, sla15: 0 });

  // SYSTEM ALERTS - live generation + acknowledge persistence
  type ExecAlert = { id: string; severity: 'critical'|'warning'|'info'; text: string; nav?: string };
  const [ackIds, setAckIds] = React.useState<string[]>(() => {
    try { const raw = typeof window !== 'undefined' ? localStorage.getItem('exec.ackAlerts') : null; return raw ? JSON.parse(raw) : []; } catch { return []; }
  });
  React.useEffect(() => { try { localStorage.setItem('exec.ackAlerts', JSON.stringify(ackIds)); } catch {} }, [ackIds]);
  const acknowledgeAlert = (id: string) => {
    setAckIds(prev => Array.from(new Set([...(prev||[]), id])));
    try { auditLogStore.add({ area: 'system', action: 'status', details: `Alert acknowledged: ${id}` }); } catch {}
  };

  const refreshForDate = React.useCallback((isoDate: string) => {
    const flash = generateDailyFlashReport(isoDate);
    setRevenueToday(flash?.revenue?.totalRevenue || 0);
    setAdr(flash?.revenue?.averageDailyRate || 0);
    setRevpar(flash?.revenue?.revenuePerAvailableRoom || 0);
    setRoomCounts({
      totalRooms: flash?.occupancy?.totalRooms || 0,
      occupiedRooms: flash?.occupancy?.occupiedRooms || 0,
      availableRooms: flash?.occupancy?.availableRooms || 0
    });
    setArrivals(flash?.arrivals?.total || 0);
    setDepartures(flash?.departures?.total || 0);
    setRevenueSplit({
      room: flash?.revenue?.roomRevenue || 0,
      fb: flash?.revenue?.foodBeverageRevenue || 0,
      other: flash?.revenue?.otherRevenue || 0,
      total: flash?.revenue?.totalRevenue || 0
    });

    // Real GL-posted revenue for this date, straight from the Chart of Accounts /
    // journal entries — the same computation Financial Reports and the Chart of
    // Accounts screen use, so this figure always ties out to the books.
    try {
      const { chartOfAccounts, journalEntries } = useAccountingStore.getState();
      const rollup = toRollupCoa(chartOfAccounts as any);
      const dayDate = new Date(isoDate);
      const tree = buildFinancialAccountTree(rollup, journalEntries, { kind: 'period', startDate: dayDate, endDate: dayDate });
      const revenueForDay = tree.filter(n => n.type === 'Revenue').reduce((s, n) => s + n.balance, 0);
      setPostedRevenue(Number.isFinite(revenueForDay) ? revenueForDay : 0);
    } catch {
      setPostedRevenue(0);
    }

    // Live operations snapshot — the same definitions as the Daily Flash report, so every screen agrees.
    try {
      const res = frontOfficeStore.reservations || [];
      const on = (d?: string) => (d || '').slice(0, 10);
      const today = propertyToday();
      const isToday = isoDate === today;
      // Headcount, not reservations. Event groups checked in as a block are only known "right now".
      setGuestsInHouse((flash?.occupancy?.guestsInHouse || 0) + (isToday ? frontOfficeStore.getInHouseGroupPax() : 0));
      const occRate = Number(flash?.occupancy?.occupancyRate);
      setExpectedOcc(Number.isFinite(occRate) ? occRate : 0);
      // What is still to happen today (meaningless for another date)
      setAwaitingArrival(isToday ? res.filter(r => on(r.arrival) === isoDate && (r.status === 'confirmed' || r.status === 'pending')).length : 0);
      setAwaitingDeparture(isToday ? res.filter(r => r.status === 'checked-in' && on(r.departure) === isoDate).length : 0);
      // Still checked in after their departure date
      setOverstays(res.filter(r => r.status === 'checked-in' && on(r.departure) < today).length);
    } catch {}

    // Housekeeping: rooms by their real status right now (a room held by a checked-in guest is occupied).
    try {
      const rooms = housekeepingStore.getAllRooms();
      const heldNow = new Set((frontOfficeStore.reservations || []).filter(r => r.status === 'checked-in' && r.roomId).map(r => r.roomId));
      const beingCleaned = new Set(housekeepingStore.getAllTasks().filter(t => t.status === 'in-progress').map(t => t.roomNumber));
      const count = { ready: 0, occupied: 0, inProgress: 0, dirty: 0, outOfOrder: 0 };
      for (const room of rooms) {
        if (room.status === 'out-of-order' || room.status === 'maintenance') count.outOfOrder++;
        else if (beingCleaned.has(room.roomNumber)) count.inProgress++;
        else if (room.status === 'occupied' || heldNow.has(room.roomNumber)) count.occupied++;
        else if (room.status === 'dirty') count.dirty++;
        else count.ready++;
      }
      setHk({ total: rooms.length, ...count });
    } catch {}

    // Refresh analytics-derived trend to keep it live
    try { setOccupancyTrend(calculateOccupancyAnalytics()?.occupancyTrend || []); } catch {}
    // F&B efficiency from orders (today)
    try {
      const all = ordersStore.all();
      const todays = all.filter(o => (o.createdAt || '').startsWith(isoDate));
      const total = todays.length;
      const served = todays.filter(o => o.status === 'served' || o.status === 'paid').length;
      const queue = todays.reduce((sum, o) => sum + (o.items || []).filter(it => (it.status === 'pending' || it.status === 'preparing')).length, 0);
      const totalRevenue = todays.reduce((sum, o) => sum + (o.items || []).reduce((s, it: any) => s + ((it.price || 0) * (it.qty || 0)), 0), 0);
      const avgOrder = total > 0 ? totalRevenue / total : 0;
      const oneHourAgo = Date.now() - 60 * 60 * 1000;
      const lastHour = todays.filter(o => {
        const t = o.updatedAt || o.createdAt;
        return t ? new Date(t).getTime() >= oneHourAgo : false;
      }).length;
      setFbEff({ total, served, queue, avgOrder, lastHour });
    } catch {}
    // Kitchen efficiency from kitchen ops (today)
    try {
      const recs = kitchenOpsStore.all().filter(r => (r.at || '').startsWith(isoDate));
      const assigned = recs.filter(r => r.action === 'assigned').length;
      const prepared = recs.filter(r => r.action === 'prepared').length;
      const prepTimes = recs.filter(r => typeof r.prepMinutes === 'number').map(r => r.prepMinutes as number);
      const avgPrep = prepTimes.length > 0 ? (prepTimes.reduce((a, b) => a + b, 0) / prepTimes.length) : 0;
      const sla15 = prepared > 0 ? Math.round((recs.filter(r => r.action === 'prepared' && (r.prepMinutes || 0) <= 15).length / prepared) * 100) : 0;
      setKitchEff({ assigned, prepared, avgPrep, sla15 });
    } catch {}
  }, [generateDailyFlashReport]);

  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    // Refresh KPIs on mount
    // Compute metrics on client after mount to avoid SSR/client mismatches
    setOccupancy(calculateOccupancyAnalytics());
    const todayISO = propertyToday();
    setSelectedDate(todayISO);
    refreshForDate(todayISO);

    // Trend line from analytics store
    const trend = calculateOccupancyAnalytics()?.occupancyTrend || [];
    setOccupancyTrend(trend);
    setMounted(true);

    // Subscribe to audit log updates for Recent Activity
    const listener = () => setRecent(auditLogStore.all().slice(0, 5));
    auditLogStore.subscribe(listener);

    // Subscriptions for live updates
    const unsubs: Array<(() => void) | null> = [];
    try { unsubs.push(frontOfficeStore.subscribe(() => refreshForDate(selectedDateRef.current || todayISO))); } catch {}
    try { unsubs.push(housekeepingStore.subscribe(() => refreshForDate(selectedDateRef.current || todayISO))); } catch {}
    try {
      const uaUnsub = (useAnalyticsStore as any).subscribe?.(() => {
        try {
          setOccupancy(calculateOccupancyAnalytics());
          setOccupancyTrend(calculateOccupancyAnalytics()?.occupancyTrend || []);
        } catch {}
      }) || null;
      unsubs.push(uaUnsub);
    } catch {}
    try {
      const stockUnsub = (useStockStore as any).subscribe?.(() => setStockSummary(computeStockSummary())) || null;
      unsubs.push(stockUnsub);
    } catch {}
    try { unsubs.push(ordersStore.subscribe(() => refreshForDate(selectedDateRef.current || todayISO))); } catch {}
    try { unsubs.push(kitchenOpsStore.subscribe(() => refreshForDate(selectedDateRef.current || todayISO))); } catch {}
    // Pulls in real persisted order history — the subscribe above re-runs
    // refreshForDate once this resolves and notifies listeners.
    try { ordersStore.hydrateFromApi(); } catch {}
    // Same for housekeeping — without this, a user landing directly on the
    // Executive dashboard sees every room as the default 'vacant' instead of
    // its real logged status.
    try { housekeepingStore.hydrateFromApi(); } catch {}
    // Security, stock and events aren't loaded by anything else on this screen — without these the
    // cards would show only what another page happened to load first.
    try { useIncidentStore.getState().hydrateFromApi(); } catch {}
    try { usePatrolStore.getState().hydrateFromApi(); } catch {}
    try { useStockStore.getState().hydrateFromApi(); } catch {}

    return () => {
      unsubs.forEach((fn) => {
        try {
          if (typeof fn === 'function') { fn(); }
        } catch {}
      });
    };
  }, [calculateOccupancyAnalytics, refreshForDate, generateDailyFlashReport]);

  // Event bookings (the hotel's real conference / event calendar)
  React.useEffect(() => {
    let cancelled = false;
    const load = () => { fetchEventBookings().then((b) => { if (!cancelled) setEventBookings(b); }).catch(() => {}); };
    load();
    const timer = setInterval(load, 5 * 60_000);
    return () => { cancelled = true; clearInterval(timer); };
  }, []);

  // Auto-refresh timers
  React.useEffect(() => {
    if (!selectedDate) return;
    const critical = setInterval(() => refreshForDate(selectedDate), 60_000);
    const financial = setInterval(() => refreshForDate(selectedDate), 5 * 60_000);
    const full = setInterval(() => refreshForDate(selectedDate), 15 * 60_000);
    return () => {
      clearInterval(critical);
      clearInterval(financial);
      clearInterval(full);
    };
  }, [selectedDate, refreshForDate]);

  const { totalRooms, occupiedRooms, availableRooms } = roomCounts;

  const go = (href: string) => { window.location.href = href; };

  const handleExportCSV = () => {
    const data = {
      date: selectedDate || propertyToday(),
      totalRooms,
      occupiedRooms,
      availableRooms,
      revenueToday,
      postedRevenue,
      adr,
      revpar,
      guestsInHouse,
      arrivals,
      departures,
      revenueSplit
    };
    const csv = useAnalyticsStore.getState().convertToCSV(data);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `executive_dashboard_${data.date}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportPDF = async () => {
    const data = {
      date: selectedDate || propertyToday(),
      kpis: { totalRooms, occupiedRooms, availableRooms, revenueToday, postedRevenue, adr, revpar, arrivals, departures },
      trend: occupancyTrend,
      revenueSplit
    };
    const url = await useReportingStore.getState().exportReport(data, 'pdf', `executive_dashboard_${data.date}.pdf`);
    const a = document.createElement('a');
    a.href = url;
    a.download = `executive_dashboard_${data.date}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Communications hub removed on executive dashboard

  // Inventory snapshot
  const computeStockSummary = () => {
    try {
      const stock = useStockStore.getState();
      const items = stock.stockItems || [];
      const low = items.filter(i => i.currentStock <= i.reorderPoint);
      const critical = items.filter(i => i.currentStock <= i.minimumStock);
      const adequate = items.filter(i => i.currentStock > i.reorderPoint);
      return { adequate: adequate.slice(0, 5), low: low.slice(0, 5), critical: critical.slice(0, 5) };
    } catch {
      return { adequate: [], low: [], critical: [] };
    }
  };
  const [stockSummary, setStockSummary] = React.useState(computeStockSummary());

  // The hotel's own timezone decides what "today" is; everything below is for the selected date.
  const isTodaySelected = selectedDate !== '' && selectedDate === propertyToday();
  const hkDirtyPct = hk.total > 0 ? (hk.dirty / hk.total) * 100 : 0;

  const security = React.useMemo(() => {
    const tz = resolvePropertyTimezone();
    const dayOf = (d: unknown) => (d ? getZonedClockParts(new Date(d as any), tz).date : '');
    const open = incidents.filter((i) => i.status !== 'resolved' && i.status !== 'closed');
    const dayPatrols = patrols.filter((p) => dayOf(p.startTime) === selectedDate);
    return {
      reported: incidents.filter((i) => dayOf(i.reportedAt) === selectedDate).length,
      open: open.length,
      openSerious: open.filter((i) => i.severity === 'high' || i.severity === 'critical').length,
      patrolsTotal: dayPatrols.length,
      patrolsCompleted: dayPatrols.filter((p) => p.status === 'completed').length,
      missedCheckpoints: dayPatrols.reduce((n, p) => n + p.checkpoints.filter((c) => c.status === 'missed').length, 0),
    };
  }, [incidents, patrols, selectedDate]);

  const eventsOnDate = React.useMemo(() => {
    const on = (d: unknown) => (d ? String(d).slice(0, 10) : '');
    return eventBookings.filter((b) => b.status !== 'cancelled' && on(b.startDate) <= selectedDate && selectedDate <= on(b.endDate));
  }, [eventBookings, selectedDate]);

  // Generate live system alerts from stores
  const buildLiveAlerts = React.useCallback(() => {
    const out: { critical: ExecAlert[]; warning: ExecAlert[]; info: ExecAlert[] } = { critical: [], warning: [], info: [] };
    try {
      const stock = useStockStore.getState();
      (stock.alerts || []).filter(a => a.isActive && !a.isAcknowledged).forEach(a => {
        const sev = a.severity === 'high' ? 'critical' : a.severity === 'medium' ? 'warning' : 'info';
        out[sev].push({ id: `inv-${a.id}`, severity: sev as any, text: `${a.message} (${a.itemName})`, nav: '/?tab=overview' });
      });
    } catch {}
    // Ids carry the date (or the count), so acknowledging one occurrence doesn't hide every future one.
    if (expectedOcc > 95) {
      out.warning.push({ id: `occ-high:${selectedDate}`, severity: 'warning', text: 'Occupancy above 95% - monitor overbooking risk', nav: '/reports' });
    }
    if (hkDirtyPct > 30) {
      out.warning.push({ id: `hk-backlog:${selectedDate}`, severity: 'warning', text: 'Housekeeping backlog: Dirty rooms exceed 30%', nav: '/housekeeping' });
    }
    if (overstays > 0) {
      out.warning.push({ id: `overstays:${overstays}`, severity: 'warning', text: `${overstays} guest${overstays === 1 ? '' : 's'} still checked in past their check-out date`, nav: '/guest-services/check-ins?tab=checkouts' });
    }
    if (security.openSerious > 0) {
      out.critical.push({ id: `sec-serious:${security.openSerious}`, severity: 'critical', text: `${security.openSerious} high-severity security incident${security.openSerious === 1 ? '' : 's'} still open` });
    }
    return out;
  }, [expectedOcc, hkDirtyPct, overstays, security.openSerious, selectedDate]);

  return (
    <div className="p-4 sm:p-6">
      {/* Header — wraps on phones and tablets */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between mb-6">
        <h2 className="text-xl sm:text-2xl font-bold text-ghana-black">🏛️ Master Command Center</h2>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            aria-label="Date"
            className="h-9 px-2 rounded border border-gray-300 text-sm bg-white"
            value={selectedDate}
            onChange={(e) => { setSelectedDate(e.target.value); if (e.target.value) refreshForDate(e.target.value); }}
          />
          <Button size="sm" variant="flat" onPress={() => { const iso = propertyToday(); setSelectedDate(iso); refreshForDate(iso); }}>Today</Button>
          <Button size="sm" variant="flat" onPress={() => { const iso = addDays(propertyToday(), -1); setSelectedDate(iso); refreshForDate(iso); }}>Yesterday</Button>
          <Button size="sm" variant="flat" onPress={handleExportCSV}>Export CSV</Button>
          <Button size="sm" variant="flat" onPress={handleExportPDF}>Export PDF</Button>
          <CustomizeViewControl
            sections={DASHBOARD_SECTIONS}
            isHidden={isHidden}
            toggle={toggleSection}
            showAll={showAll}
            hiddenCount={hiddenCount}
          />
          <OfflineIndicator />
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left Sidebar - Live Operations & Safety */}
        <aside className="xl:col-span-1 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-1 gap-6 content-start">
          {!isHidden('liveOps') && (
          <Card className="border-0 shadow-md">
            <CardHeader className="pb-1 flex items-center justify-between">
              <h3 className="font-semibold text-ghana-black">Live Operations</h3>
              <HideCardButton onHide={() => hide('liveOps')} label="Live Operations" />
            </CardHeader>
            <CardBody className="pt-2 space-y-1">
              <button onClick={() => go('/housekeeping')} className="w-full text-left flex justify-between items-baseline text-sm hover:bg-gray-100 px-1.5 py-2 rounded">
                <span>In-House Guests <span className="text-xs text-gray-500">({occupiedRooms} {occupiedRooms === 1 ? 'room' : 'rooms'})</span></span><span className="font-semibold">{guestsInHouse}</span>
              </button>
              <button onClick={() => go('/guest-services/check-ins?tab=checkins')} className="w-full text-left flex justify-between text-sm hover:bg-gray-100 px-1.5 py-2 rounded">
                <span>{isTodaySelected ? "Today's " : ''}Arrivals</span><span className="font-semibold">{arrivals}</span>
              </button>
              <button onClick={() => go('/guest-services/check-ins?tab=checkouts')} className="w-full text-left flex justify-between text-sm hover:bg-gray-100 px-1.5 py-2 rounded">
                <span>{isTodaySelected ? "Today's " : ''}Departures</span><span className="font-semibold">{departures}</span>
              </button>
              <button onClick={() => go('/reports')} className="w-full text-left flex justify-between text-sm hover:bg-gray-100 px-1.5 py-2 rounded">
                <span>Occupancy</span><span className="font-semibold">{Number.isFinite(expectedOcc) ? Math.round(expectedOcc) : 0}%</span>
              </button>
              {isTodaySelected && (
                <div className="flex justify-between gap-2 text-xs text-gray-600 px-1.5 pt-1">
                  <span>Still to arrive: {awaitingArrival}</span><span>Still to depart: {awaitingDeparture}</span>
                </div>
              )}
            </CardBody>
          </Card>
          )}

          {!isHidden('security') && (
          <Card className="border-0 shadow-md">
            <CardHeader className="pb-1 flex items-center justify-between">
              <h3 className="font-semibold text-ghana-black">Security & Safety</h3>
              <HideCardButton onHide={() => hide('security')} label="Security & Safety" />
            </CardHeader>
            <CardBody className="pt-2 space-y-2 text-sm">
              <div className="flex justify-between gap-2"><span>Incidents reported</span><span className="font-semibold">{security.reported}</span></div>
              <div className="flex justify-between gap-2">
                <span>Open incidents</span>
                <span className={`font-semibold ${security.openSerious > 0 ? 'text-red-600' : ''}`}>
                  {security.open}{security.openSerious > 0 ? ` (${security.openSerious} high/critical)` : ''}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span>Patrols completed</span>
                <span className="font-semibold">{security.patrolsTotal === 0 ? 'None logged' : `${security.patrolsCompleted} of ${security.patrolsTotal}`}</span>
              </div>
              {security.missedCheckpoints > 0 && (
                <div className="flex justify-between gap-2"><span>Checkpoints missed</span><span className="font-semibold text-red-600">{security.missedCheckpoints}</span></div>
              )}
            </CardBody>
          </Card>
          )}

          {!isHidden('housekeeping') && (
          <Card className="border-0 shadow-md">
            <CardHeader className="pb-1 flex items-center justify-between">
              <h3 className="font-semibold text-ghana-black">Housekeeping Status</h3>
              <HideCardButton onHide={() => hide('housekeeping')} label="Housekeeping Status" />
            </CardHeader>
            <CardBody className="pt-2 space-y-3 text-sm">
              {hk.total === 0 ? (
                <p className="text-gray-500">No rooms configured yet.</p>
              ) : (
                <>
                  {([
                    ['Clean / Ready', hk.ready, 'bg-green-600'],
                    ['Occupied', hk.occupied, 'bg-slate-500'],
                    ['Being cleaned', hk.inProgress, 'bg-blue-600'],
                    ['Dirty', hk.dirty, 'bg-yellow-500'],
                    ['Out of order', hk.outOfOrder, 'bg-red-600'],
                  ] as const).map(([label, count, color]) => (
                    <div key={label} className="space-y-1 cursor-pointer" onClick={() => go('/housekeeping')}>
                      <div className="flex justify-between">
                        <span>{label}</span>
                        <span className="font-semibold">{count} <span className="text-xs text-gray-500 font-normal">· {Math.round((count / hk.total) * 100)}%</span></span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded overflow-hidden"><div className={`h-2 ${color}`} style={{ width: `${(count / hk.total) * 100}%` }} /></div>
                    </div>
                  ))}
                  {!isTodaySelected && <p className="text-xs text-gray-500">Rooms are shown as they are right now.</p>}
                </>
              )}
            </CardBody>
          </Card>
          )}

          {/* Conferences & Events — the hotel's real event bookings for the selected date */}
          {!isHidden('events') && (
          <Card className="border-0 shadow-md">
            <CardHeader className="pb-1 flex items-center justify-between">
              <h3 className="font-semibold text-ghana-black">Conferences & Events</h3>
              <HideCardButton onHide={() => hide('events')} label="Conferences & Events" />
            </CardHeader>
            <CardBody className="pt-2 space-y-2 text-sm">
              {eventsOnDate.length === 0 && (
                <div className="p-3 bg-gray-50 border border-gray-200 rounded text-left">{isTodaySelected ? 'No events today' : 'No events on this date'}</div>
              )}
              {eventsOnDate.slice(0, 4).map((e) => (
                <div key={e.id} className="p-3 bg-green-50 border border-green-200 rounded text-left">
                  <div className="font-medium">{e.title}</div>
                  <div className="text-xs text-gray-600">
                    {[e.hallName, e.startTime && e.endTime ? `${e.startTime}–${e.endTime}` : null, e.attendees ? `${e.attendees} guests` : null].filter(Boolean).join(' · ')}
                  </div>
                  {e.status === 'pending' && <div className="text-xs text-amber-700">Pending confirmation</div>}
                </div>
              ))}
              {eventsOnDate.length > 4 && <div className="text-xs text-gray-500">+{eventsOnDate.length - 4} more</div>}
            </CardBody>
          </Card>
          )}
        </aside>

        {/* Center - Financial, Alerts, Trends, F&B/Kitchen, Stocks, Events */}
        <section className="xl:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
          {!isHidden('financial') && (
          <Card className="border-0 shadow-lg md:col-span-2">
            <CardHeader className="pb-1 flex items-center justify-between">
              <h3 className="font-semibold text-ghana-black">{isTodaySelected || !selectedDate ? "Today's Financial Pulse" : `Financial Pulse — ${selectedDate}`}</h3>
              <HideCardButton onHide={() => hide('financial')} label="Today's Financial Pulse" />
            </CardHeader>
            <CardBody className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="text-xs text-gray-600">REVENUE (Posted to GL)</div>
                <div className="text-2xl font-bold text-ghana-black">{formatCurrency(postedRevenue)}</div>
                <div className="text-xs text-gray-500" title="Room/F&B charges accrued on guest folios today, before checkout posts them to the ledger">
                  Charges billed today (pre-checkout): {formatCurrency(revenueToday)}
                </div>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="text-xs text-gray-600">OCCUPANCY</div>
                <div className="text-2xl font-bold text-ghana-black">{Number.isFinite(expectedOcc) ? Math.round(expectedOcc) : 0}%</div>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg flex items-center justify-between">
                <div>
                  <div className="text-xs text-gray-600">ADR</div>
                  <div className="text-xl font-bold text-ghana-black">{formatCurrency(adr)}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-600">RevPAR</div>
                  <div className="text-xl font-bold text-ghana-black">{formatCurrency(revpar)}</div>
                </div>
              </div>
            </CardBody>
          </Card>
          )}

			{/* System Alerts - functional */}
			{!isHidden('alerts') && (
			<Card className="border-0 shadow-md md:col-span-2">
            <CardHeader className="pb-1 flex items-center justify-between">
              <h3 className="font-semibold text-ghana-black">System Alerts</h3>
              <HideCardButton onHide={() => hide('alerts')} label="System Alerts" />
            </CardHeader>
            <CardBody className="pt-2 grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
              {!mounted ? (
                <>
                  <div className="p-3 rounded-lg border border-red-200 bg-red-50 space-y-2">
                    <div className="font-semibold mb-1">🔴 CRITICAL</div>
                    <div className="h-4 bg-white/60 rounded animate-pulse" />
                    <div className="h-4 bg-white/60 rounded animate-pulse w-2/3" />
                  </div>
                  <div className="p-3 rounded-lg border border-yellow-200 bg-yellow-50 space-y-2">
                    <div className="font-semibold mb-1">🟡 WARNING</div>
                    <div className="h-4 bg-white/60 rounded animate-pulse" />
                    <div className="h-4 bg-white/60 rounded animate-pulse w-1/2" />
                  </div>
                  <div className="p-3 rounded-lg border border-blue-200 bg-blue-50 space-y-2">
                    <div className="font-semibold mb-1">🔵 INFORMATIONAL</div>
                    <div className="text-xs text-gray-500">No alerts</div>
                  </div>
                </>
              ) : (
                (() => {
                  const live = buildLiveAlerts();
                  const blocks: Array<{ key: 'critical'|'warning'|'info'; title: string; cls: string; items: ExecAlert[] }> = [
                    { key: 'critical', title: '🔴 CRITICAL', cls: 'border-red-200 bg-red-50', items: live.critical.filter(a => !ackIds.includes(a.id)) },
                    { key: 'warning', title: '🟡 WARNING', cls: 'border-yellow-200 bg-yellow-50', items: live.warning.filter(a => !ackIds.includes(a.id)) },
                    { key: 'info', title: '🔵 INFORMATIONAL', cls: 'border-blue-200 bg-blue-50', items: live.info.filter(a => !ackIds.includes(a.id)) }
                  ];
                  return blocks.map(b => (
                    <div key={b.key} className={`p-3 rounded-lg border ${b.cls} space-y-2`}>
                      <div className="font-semibold mb-1">{b.title}</div>
                      {b.items.length === 0 && <div className="text-xs text-gray-500">No alerts</div>}
                      {b.items.map(a => (
                        <div key={a.id} className="flex flex-col items-start gap-1.5">
                          <button onClick={() => a.nav && go(a.nav)} className="text-left hover:underline">{a.text}</button>
                          <Button size="sm" variant="flat" onPress={() => acknowledgeAlert(a.id)}>Acknowledge</Button>
                        </div>
                      ))}
                    </div>
                  ));
                })()
              )}
            </CardBody>
          </Card>
          )}

          {/* Trends */}
          {!isHidden('trend') && (
          <Card className="border-0 shadow-md md:col-span-2">
            <CardHeader className="pb-1 flex items-center justify-between">
              <h3 className="font-semibold text-ghana-black">7-Day Occupancy Trend</h3>
              <HideCardButton onHide={() => hide('trend')} label="7-Day Occupancy Trend" />
            </CardHeader>
            <CardBody className="pt-2">
              {!mounted ? (
                <div className="h-40 bg-gray-50 rounded animate-pulse" />
              ) : (
                (() => {
                  const trend = occupancyTrend || [];
                  if (trend.length === 0) return <div className="h-40 flex items-center justify-center text-sm text-gray-500">No trend data</div>;

                  const avg = trend.reduce((s, t) => s + (t.rate || 0), 0) / trend.length;
                  // A view box in real percentage/day units — CSS stretches it to the card's actual size
                  // (preserveAspectRatio="none"), so the maths below never has to know the pixel width.
                  const W = trend.length; // one unit per day
                  const H = 100;
                  const topPad = 14; // headroom so a 100% peak, and the "Avg" label, aren't clipped
                  const bottomPad = 4;
                  const yFor = (rate: number) => topPad + (1 - Math.max(0, Math.min(100, rate)) / 100) * (H - topPad - bottomPad);
                  const points = trend.map((p, i) => ({ x: i + 0.5, y: yFor(p.rate) }));
                  const linePath = smoothLinePath(points);
                  const areaPath = `${linePath} L ${points[points.length - 1].x},${H} L ${points[0].x},${H} Z`;
                  const avgY = yFor(avg);
                  const activeIdx = trendHoverIdx ?? trend.findIndex((p) => p.date === selectedDate);
                  const active = activeIdx >= 0 ? { day: trend[activeIdx], point: points[activeIdx] } : null;

                  return (
                    <div>
                      <div className="relative h-40 sm:h-44">
                        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 w-full h-full overflow-visible">
                          <defs>
                            <linearGradient id="execTrendFill" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#059669" stopOpacity="0.35" />
                              <stop offset="100%" stopColor="#059669" stopOpacity="0" />
                            </linearGradient>
                          </defs>
                          <line x1="0" y1={avgY} x2={W} y2={avgY} stroke="#cbd5e1" strokeWidth="0.6" strokeDasharray="2,1.5" vectorEffect="non-scaling-stroke" />
                          <path d={areaPath} fill="url(#execTrendFill)" stroke="none" />
                          <path d={linePath} fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                        </svg>
                        {/* Dots as HTML, not SVG circles — the chart above stretches x and y by different
                            amounts to fill the card (preserveAspectRatio="none"), which would turn a true
                            SVG circle into an ellipse. A percentage-positioned, fixed-pixel-size dot stays round. */}
                        {points.map((pt, i) => (
                          <div
                            key={i}
                            className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-emerald-600 ${i === activeIdx ? 'bg-emerald-600 w-2.5 h-2.5' : 'bg-white w-1.5 h-1.5'}`}
                            style={{ left: `${(pt.x / W) * 100}%`, top: `${(pt.y / H) * 100}%` }}
                          />
                        ))}
                        {active && (
                          <div
                            className="absolute -translate-x-1/2 -translate-y-full bg-ghana-black text-white text-[11px] rounded px-1.5 py-0.5 whitespace-nowrap pointer-events-none shadow"
                            style={{ left: `${(active.point.x / W) * 100}%`, top: `${(active.point.y / H) * 100}%`, marginTop: '-6px' }}
                          >
                            {active.day.rate.toFixed(0)}%
                          </div>
                        )}
                        <div className="absolute left-0 bottom-0 text-[11px] text-gray-500 bg-white/70 pr-1 rounded-tr">Avg {avg.toFixed(0)}%</div>
                        {/* Transparent per-day columns: click to jump the dashboard to that date, hover/focus to see its value. */}
                        <div className="absolute inset-0 flex">
                          {trend.map((p, i) => (
                            <button
                              key={i}
                              onClick={() => { setSelectedDate(p.date); refreshForDate(p.date); }}
                              onMouseEnter={() => setTrendHoverIdx(i)}
                              onMouseLeave={() => setTrendHoverIdx(null)}
                              onFocus={() => setTrendHoverIdx(i)}
                              onBlur={() => setTrendHoverIdx(null)}
                              aria-label={`${p.date}: ${p.rate.toFixed(0)}% occupancy`}
                              title={`${p.date}: ${p.rate.toFixed(0)}%`}
                              className="flex-1 h-full"
                            />
                          ))}
                        </div>
                      </div>
                      <div className="mt-1 flex text-[10px] text-gray-600">
                        {trend.map((p, i) => (
                          <div key={i} className={`flex-1 text-center ${p.date === selectedDate ? 'font-semibold text-ghana-black' : ''}`}>
                            {new Date(p.date).toLocaleDateString(undefined, { weekday: 'short' }).slice(0, 3)}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()
              )}
            </CardBody>
          </Card>
          )}

          {/* F&B and Kitchen Efficiency */}
          {!isHidden('fbKitchen') && (
          <Card className="border-0 shadow-md md:col-span-2">
            <CardHeader className="pb-1 flex items-center justify-between">
              <h3 className="font-semibold text-ghana-black">F&B and Kitchen Efficiency</h3>
              <HideCardButton onHide={() => hide('fbKitchen')} label="F&B and Kitchen Efficiency" />
            </CardHeader>
            <CardBody className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="font-semibold mb-2">Restaurant/Bar</div>
                <div className="flex justify-between"><span>Total Orders</span><span className="font-semibold">{fbEff.total}</span></div>
                <div className="flex justify-between"><span>Served/Paid</span><span className="font-semibold">{fbEff.served}</span></div>
                <div className="flex justify-between"><span>Items in Queue</span><span className="font-semibold">{fbEff.queue}</span></div>
                <div className="flex justify-between"><span>Avg Order Value</span><span className="font-semibold">{formatCurrency(fbEff.avgOrder)}</span></div>
                <div className="flex justify-between"><span>Orders (Last 1h)</span><span className="font-semibold">{fbEff.lastHour}</span></div>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="font-semibold mb-2">Kitchen</div>
                <div className="flex justify-between"><span>Items Assigned</span><span className="font-semibold">{kitchEff.assigned}</span></div>
                <div className="flex justify-between"><span>Items Prepared</span><span className="font-semibold">{kitchEff.prepared}</span></div>
                <div className="flex justify-between"><span>Avg Prep Time</span><span className="font-semibold">{Math.round(kitchEff.avgPrep)} min</span></div>
                <div className="flex justify-between"><span>SLA ≤ 15m</span><span className="font-semibold">{kitchEff.sla15}%</span></div>
              </div>
            </CardBody>
          </Card>
          )}

          {/* Stocks & Inventory - functional */}
          {!isHidden('stock') && (
          <Card className="border-0 shadow-md md:col-span-2">
            <CardHeader className="pb-1 flex items-center justify-between">
              <h3 className="font-semibold text-ghana-black">Critical Stock Levels</h3>
              <div className="flex items-center gap-3">
                <div className="text-xs text-gray-500">Low stock %: {useStockStore.getState().getLowStockPercentage().toFixed(0)}%</div>
                <HideCardButton onHide={() => hide('stock')} label="Critical Stock Levels" />
              </div>
            </CardHeader>
            <CardBody className="pt-2 grid grid-cols-1 lg:grid-cols-3 gap-4 text-sm">
              <div>
                <div className="font-semibold mb-2">🟢 Adequate</div>
                <ul className="space-y-1 list-disc list-inside">
                  {stockSummary.adequate.map(i => (<li key={i.id} className="flex justify-between items-center gap-2"><span>{i.name}</span><Button size="sm" variant="light" onPress={() => go('/?tab=overview')}>View</Button></li>))}
                  {stockSummary.adequate.length === 0 && <li className="text-gray-500">No items</li>}
                </ul>
              </div>
              <div>
                <div className="font-semibold mb-2">🟡 Low (Reorder)</div>
                 <ul className="space-y-1 list-disc list-inside">
                  {stockSummary.low.map(i => (
                    <li key={i.id} className="flex justify-between items-center gap-2">
                      <span>{i.name}</span>
                      <Button size="sm" variant="flat" onPress={() => {
                        try {
                          announcementStore.publish({ level: 'normal', message: `Reorder suggested for ${i.name} (low stock)`, departments: ['inventory'], from: 'Master' });
                          auditLogStore.add({ area: 'inventory' as any, action: 'status', entity: 'Stock', entityId: i.id, details: `Notified Inventory: Reorder ${i.name}` });
                        } catch {}
                      }}>Notify Inventory</Button>
                    </li>
                  ))}
                  {stockSummary.low.length === 0 && <li className="text-gray-500">No items</li>}
                </ul>
              </div>
              <div>
                <div className="font-semibold mb-2">🔴 Critical</div>
                <ul className="space-y-1 list-disc list-inside">
                  {stockSummary.critical.map(i => (
                    <li key={i.id} className="flex justify-between items-center gap-2">
                      <span>{i.name}</span>
                      <Button size="sm" color="danger" variant="flat" onPress={() => {
                        try {
                          announcementStore.publish({ level: 'urgent', message: `URGENT: Critical stock for ${i.name}. Immediate action required.`, departments: ['inventory'], from: 'Master' });
                          auditLogStore.add({ area: 'inventory' as any, action: 'status', entity: 'Stock', entityId: i.id, details: `Notified Inventory: URGENT ${i.name}` });
                        } catch {}
                      }}>Notify (Urgent)</Button>
                    </li>
                  ))}
                  {stockSummary.critical.length === 0 && <li className="text-gray-500">No items</li>}
                </ul>
              </div>
            </CardBody>
          </Card>
          )}

          {/* Recent Activity card removed to avoid duplication; see bottom section */}
        </section>

        {/* Right Sidebar removed to avoid duplication with Notices */}
      </div>
      {/* Global messenger for GM */}
      <DeptMessenger from="master" mode="drawer" />
      {/* Quick hotkey hint */}
      <div className="hidden lg:block fixed bottom-6 left-6 text-xs text-gray-500 bg-white/60 backdrop-blur px-2 py-1 rounded shadow">Press Ctrl+M to open Messenger</div>

      {/* Recent Activities & Notices - bottom section */}
      {(!isHidden('recentActivities') || !isHidden('notices')) && (
      <div className="mt-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {!isHidden('recentActivities') && (
          <Card className="border-0 shadow-lg">
            <CardHeader className="pb-3 flex items-center justify-between">
              <h3 className="text-xl font-semibold text-ghana-black">📋 Recent Activities</h3>
              <HideCardButton onHide={() => hide('recentActivities')} label="Recent Activities" />
            </CardHeader>
            <CardBody>
              <RecentActivities area="system" limit={10} />
            </CardBody>
          </Card>
          )}
          {!isHidden('notices') && (
          <Card className="border-0 shadow-lg">
            <CardHeader className="pb-3 flex items-center justify-between">
              <h3 className="text-xl font-semibold text-ghana-black">🔔 Executive Notices</h3>
              <HideCardButton onHide={() => hide('notices')} label="Executive Notices" />
            </CardHeader>
            <CardBody>
              <DeptNotices dept="gm" title="" defaultTab="alerts" />
            </CardBody>
          </Card>
          )}
        </div>
      </div>
      )}
    </div>
  );
}


