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
import { useAccountingStore } from '../lib/accounting/store';
import { toRollupCoa } from '../lib/accounting/coaHierarchy';
import { buildFinancialAccountTree } from '../lib/accounting/financialReportRollup';
import OfflineIndicator from './OfflineIndicator';
import DeptMessenger from './DeptMessenger';
import RecentActivities from './RecentActivities';
import DeptNotices from './DeptNotices';
// Removed broadcast/mentions sidebar; bottom notices cover communication needs

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
  const [revenueSplit, setRevenueSplit] = React.useState<{room: number; fb: number; other: number; total: number}>({ room: 0, fb: 0, other: 0, total: 0 });
  const [selectedDate, setSelectedDate] = React.useState<string>('');
  // Room counts for the selected date — kept separate from `occupancy` (which is
  // always "today") so CSV/PDF exports don't mix today's room counts with a
  // different selected date's revenue/ADR/arrivals figures.
  const [roomCounts, setRoomCounts] = React.useState<{ totalRooms: number; occupiedRooms: number; availableRooms: number }>({ totalRooms: 0, occupiedRooms: 0, availableRooms: 0 });

  // LIVE OPS SNAPSHOT
  const [inHouse, setInHouse] = React.useState<number>(0);
  const [arrivalsToday, setArrivalsToday] = React.useState<number>(0);
  const [departuresToday, setDeparturesToday] = React.useState<number>(0);
  const [expectedOcc, setExpectedOcc] = React.useState<number>(0);
  const [nextHourCheckins, setNextHourCheckins] = React.useState<number>(0);
  const [nextHourCheckouts, setNextHourCheckouts] = React.useState<number>(0);

  // SECURITY
  const [incidentsToday, setIncidentsToday] = React.useState<number>(0);
  const [securityRoundsComplete, setSecurityRoundsComplete] = React.useState<boolean>(true);

  // HOUSEKEEPING SUMMARY
  const [hkCleanReadyPct, setHkCleanReadyPct] = React.useState<number>(0);
  const [hkInProgressPct, setHkInProgressPct] = React.useState<number>(0);
  const [hkDirtyPct, setHkDirtyPct] = React.useState<number>(0);
  const [hkOooPct, setHkOooPct] = React.useState<number>(0);

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

    // Live operations snapshot from Front Office store
    try {
      const res = frontOfficeStore.reservations || [];
      const today = isoDate;
      // Individually checked-in reservations, plus pax from bulk accommodation
      // event bookings checked in as a group (headcounts only — see
      // EventsConferencesMainDashboard's checkInEventGroup / addInHouseGroup).
      const inHouseNow = res.filter(r => r.status === 'checked-in' && r.arrival <= today && r.departure > today).length
        + frontOfficeStore.getInHouseGroupPax();
      const arr = res.filter(r => r.arrival === today).length;
      const dep = res.filter(r => r.departure === today).length;
      setInHouse(inHouseNow);
      setArrivalsToday(arr);
      setDeparturesToday(dep);
      const occRate = Number(flash?.occupancy?.occupancyRate);
      setExpectedOcc(Number.isFinite(occRate) ? occRate : 0);
      // Without check-in times, we cannot compute next-hour movements precisely
      setNextHourCheckins(0);
      setNextHourCheckouts(0);
    } catch {}

    // Housekeeping summary from housekeepingStore
    try {
      const attn = housekeepingStore.getRoomsNeedingAttention();
      const total = Math.max(attn.total || 0, 1);
      const dirty = (attn.dirty?.length || 0);
      const ooo = (attn.outOfOrder?.length || 0);
      const maintenance = (attn.maintenance?.length || 0);
      const notReady = dirty + ooo + maintenance;
      const cleanReady = Math.max(total - notReady, 0);
      setHkCleanReadyPct((cleanReady / total) * 100);
      setHkDirtyPct((dirty / total) * 100);
      setHkOooPct((ooo / total) * 100);
      // We do not track in-progress explicitly; approximate
      setHkInProgressPct(Math.max(0, 100 - ((cleanReady / total) * 100) - ((dirty / total) * 100) - ((ooo / total) * 100)));
    } catch {}

    // Security incidents from audit log (area === 'security') as proxy
    try {
      const todayStr = new Date(isoDate).toISOString().split('T')[0];
      const secs = auditLogStore.all().filter(r => (r as any).area === 'security' && (r.at || '').startsWith(todayStr));
      setIncidentsToday(secs.length);
      setSecurityRoundsComplete(true);
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
    const todayISO = new Date().toISOString().split('T')[0];
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
    try { unsubs.push(frontOfficeStore.subscribe(() => refreshForDate(todayISO))); } catch {}
    try { unsubs.push(housekeepingStore.subscribe(() => refreshForDate(todayISO))); } catch {}
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
    // Announcement store (no unsubscribe returned)
    try { announcementStore.subscribe(() => setEventsList(announcementStore.getForDepartment('events', 3).map(m => m.message))); } catch {}
    try { unsubs.push(ordersStore.subscribe(() => refreshForDate(todayISO))); } catch {}
    try { unsubs.push(kitchenOpsStore.subscribe(() => refreshForDate(todayISO))); } catch {}
    // Pulls in real persisted order history — the subscribe above re-runs
    // refreshForDate once this resolves and notifies listeners.
    try { ordersStore.hydrateFromApi(); } catch {}
    // Same for housekeeping — without this, a user landing directly on the
    // Executive dashboard sees every room as the default 'vacant' instead of
    // its real logged status.
    try { housekeepingStore.hydrateFromApi(); } catch {}

    return () => {
      unsubs.forEach((fn) => {
        try {
          if (typeof fn === 'function') { fn(); }
        } catch {}
      });
    };
  }, [calculateOccupancyAnalytics, refreshForDate, generateDailyFlashReport]);

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
      date: selectedDate || new Date().toISOString().split('T')[0],
      totalRooms,
      occupiedRooms,
      availableRooms,
      revenueToday,
      postedRevenue,
      adr,
      revpar,
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
      date: selectedDate || new Date().toISOString().split('T')[0],
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

  // Conferences & Events - live from announcements (events dept)
  const [eventsList, setEventsList] = React.useState<string[]>(() => announcementStore.getForDepartment('events', 3).map(m => m.message));

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
    try {
      if ((occupancy?.occupancyRate || expectedOcc) > 95) {
        out.warning.push({ id: 'occ-high', severity: 'warning', text: 'Occupancy above 95% - monitor overbooking risk', nav: '/reports' });
      }
    } catch {}
    try {
      if (hkDirtyPct > 30) {
        out.warning.push({ id: 'hk-backlog', severity: 'warning', text: 'Housekeeping backlog: Dirty rooms exceed 30%', nav: '/housekeeping' });
      }
    } catch {}
    return out;
  }, [occupancy?.occupancyRate, expectedOcc, hkDirtyPct]);

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-ghana-black">🏛️ Master Command Center</h2>
        <div className="flex items-center gap-2">
          <input
            type="date"
            className="h-8 px-2 rounded border border-gray-300 text-sm bg-white"
            value={selectedDate}
            onChange={(e) => { setSelectedDate(e.target.value); if (e.target.value) refreshForDate(e.target.value); }}
          />
          <Button size="sm" variant="flat" onPress={() => { const d = new Date(); const iso = d.toISOString().split('T')[0]; setSelectedDate(iso); refreshForDate(iso); }}>Today</Button>
          <Button size="sm" variant="flat" onPress={() => { const d = new Date(); d.setDate(d.getDate() - 1); const iso = d.toISOString().split('T')[0]; setSelectedDate(iso); refreshForDate(iso); }}>Yesterday</Button>
          <Button size="sm" variant="flat" onPress={handleExportCSV}>Export CSV</Button>
          <Button size="sm" variant="flat" onPress={handleExportPDF}>Export PDF</Button>
          <OfflineIndicator />
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left Sidebar - Live Operations & Safety */}
        <aside className="xl:col-span-1 space-y-6">
          <Card className="border-0 shadow-md">
            <CardHeader className="pb-1"><h3 className="font-semibold text-ghana-black">Live Operations</h3></CardHeader>
            <CardBody className="pt-2 space-y-3">
              <button onClick={() => go('/housekeeping')} className="w-full text-left flex justify-between text-sm hover:bg-gray-100 p-1.5 rounded">
                <span>In-House Guests</span><span className="font-semibold">{inHouse}</span>
              </button>
              <button onClick={() => go('/guest-services/check-ins?tab=checkins')} className="w-full text-left flex justify-between text-sm hover:bg-gray-100 p-1.5 rounded">
                <span>Today's Arrivals</span><span className="font-semibold">{arrivalsToday}</span>
              </button>
              <button onClick={() => go('/guest-services/check-ins?tab=checkouts')} className="w-full text-left flex justify-between text-sm hover:bg-gray-100 p-1.5 rounded">
                <span>Today's Departures</span><span className="font-semibold">{departuresToday}</span>
              </button>
              <button onClick={() => go('/reports')} className="w-full text-left flex justify-between text-sm hover:bg-gray-100 p-1.5 rounded">
                <span>Expected Occupancy</span><span className="font-semibold">{Number.isFinite(expectedOcc) ? Math.round(expectedOcc) : 0}%</span>
              </button>
              <div className="flex justify-between text-xs text-gray-600"><span>Next Hour</span><span>{nextHourCheckins} Check-ins • {nextHourCheckouts} Check-outs</span></div>
            </CardBody>
          </Card>

          <Card className="border-0 shadow-md">
            <CardHeader className="pb-1"><h3 className="font-semibold text-ghana-black">Security & Safety</h3></CardHeader>
            <CardBody className="pt-2 space-y-2 text-sm">
              <div className="flex justify-between"><span>Incident Log</span><span className="font-semibold">[{incidentsToday}]</span></div>
              <div className="flex justify-between"><span>Security Checks</span><span className="font-semibold">{securityRoundsComplete ? 'All completed' : 'Pending'}</span></div>
              <div className="flex justify-between"><span>CCTV Status</span><span className="font-semibold">Operational</span></div>
              <div className="flex justify-between"><span>Fire Panel</span><span className="font-semibold">Normal</span></div>
            </CardBody>
          </Card>

          <Card className="border-0 shadow-md">
            <CardHeader className="pb-1"><h3 className="font-semibold text-ghana-black">Housekeeping Status</h3></CardHeader>
            <CardBody className="pt-2 space-y-3 text-sm">
              <div className="space-y-1 cursor-pointer" onClick={() => go('/housekeeping')}>
                <div className="flex justify-between"><span>Clean/Ready</span><span className="font-semibold">{Math.round(hkCleanReadyPct)}%</span></div>
                <div className="h-2 bg-gray-100 rounded overflow-hidden"><div className="h-2 bg-green-600" style={{ width: `${hkCleanReadyPct}%` }} /></div>
              </div>
              <div className="space-y-1 cursor-pointer" onClick={() => go('/housekeeping')}>
                <div className="flex justify-between"><span>In Progress</span><span className="font-semibold">{Math.round(hkInProgressPct)}%</span></div>
                <div className="h-2 bg-gray-100 rounded overflow-hidden"><div className="h-2 bg-blue-600" style={{ width: `${hkInProgressPct}%` }} /></div>
              </div>
              <div className="space-y-1 cursor-pointer" onClick={() => go('/housekeeping')}>
                <div className="flex justify-between"><span>Dirty</span><span className="font-semibold">{Math.round(hkDirtyPct)}%</span></div>
                <div className="h-2 bg-gray-100 rounded overflow-hidden"><div className="h-2 bg-yellow-500" style={{ width: `${hkDirtyPct}%` }} /></div>
              </div>
              <div className="space-y-1 cursor-pointer" onClick={() => go('/housekeeping')}>
                <div className="flex justify-between"><span>Out of Order</span><span className="font-semibold">{Math.round(hkOooPct)}%</span></div>
                <div className="h-2 bg-gray-100 rounded overflow-hidden"><div className="h-2 bg-red-600" style={{ width: `${hkOooPct}%` }} /></div>
              </div>
            </CardBody>
          </Card>

          {/* Conferences & Events - live from announcements */}
          <Card className="border-0 shadow-md">
            <CardHeader className="pb-1"><h3 className="font-semibold text-ghana-black">Conferences & Events</h3></CardHeader>
            <CardBody className="pt-2 space-y-2 text-sm">
              {eventsList.length === 0 && (
                <div className="p-3 bg-gray-50 border border-gray-200 rounded text-left">No events today</div>
              )}
              {eventsList.slice(0,3).map((t, idx) => (
                <div key={idx} className="p-3 bg-green-50 border border-green-200 rounded text-left">{t}</div>
              ))}
            </CardBody>
          </Card>
        </aside>

        {/* Center - Financial, Alerts, Trends, F&B/Kitchen, Stocks, Events */}
        <section className="xl:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="border-0 shadow-lg md:col-span-2">
            <CardHeader className="pb-1"><h3 className="font-semibold text-ghana-black">Today's Financial Pulse</h3></CardHeader>
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
                <div className="text-xs text-gray-500">Target: 92%</div>
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

			{/* System Alerts - functional */}
			<Card className="border-0 shadow-md md:col-span-2">
            <CardHeader className="pb-1"><h3 className="font-semibold text-ghana-black">System Alerts</h3></CardHeader>
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
                        <div key={a.id} className="flex items-start justify-between gap-2">
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

          {/* Trends */}
          <Card className="border-0 shadow-md">
            <CardHeader className="pb-1"><h3 className="font-semibold text-ghana-black">7-Day Occupancy Trend</h3></CardHeader>
            <CardBody className="pt-2">
              {!mounted ? (
                <div className="h-28 bg-gray-50 rounded animate-pulse" />
              ) : (
                (() => {
                  const trend = occupancyTrend || [];
                  const avg = trend.length ? trend.reduce((s, t) => s + (t.rate || 0), 0) / trend.length : 0;
                  return (
                    <div className="relative h-32">
                      {/* average line */}
                      <div className="absolute left-0 right-0 border-t-2 border-dashed border-gray-300" style={{ bottom: `${Math.max(0, Math.min(100, avg))}%` }} />
                      <div className="absolute right-0 -top-2 text-xs text-gray-500">Avg {avg.toFixed(0)}%</div>
                      <div className="absolute inset-0 flex items-end gap-2">
                        {trend.map((p, i) => {
                          const day = new Date(p.date).toLocaleDateString(undefined, { weekday: 'short' }).slice(0, 3);
                          const height = Math.max(8, Math.min(100, p.rate));
                          return (
                            <div key={i} className="flex-1 flex flex-col items-center">
                              <button
                                onClick={() => { setSelectedDate(p.date); refreshForDate(p.date); }}
                                className="w-full rounded-t-md bg-gradient-to-t from-ghana-green to-emerald-400 hover:from-emerald-600 hover:to-emerald-400 transition-colors"
                                style={{ height: `${height}%` }}
                                title={`${p.date}: ${p.rate.toFixed(0)}%`}
                              />
                              <div className="mt-1 text-[10px] text-gray-600">{day}</div>
                            </div>
                          );
                        })}
                        {trend.length === 0 && (
                          <div className="text-sm text-gray-500">No trend data</div>
                        )}
                      </div>
                    </div>
                  );
                })()
              )}
            </CardBody>
          </Card>

          {/* F&B and Kitchen Efficiency */}
          <Card className="border-0 shadow-md">
            <CardHeader className="pb-1"><h3 className="font-semibold text-ghana-black">F&B and Kitchen Efficiency</h3></CardHeader>
            <CardBody className="pt-2 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
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

          {/* Stocks & Inventory - functional */}
          <Card className="border-0 shadow-md md:col-span-2">
            <CardHeader className="pb-1 flex items-center justify-between">
              <h3 className="font-semibold text-ghana-black">Critical Stock Levels</h3>
              <div className="text-xs text-gray-500">Low stock %: {useStockStore.getState().getLowStockPercentage().toFixed(0)}%</div>
            </CardHeader>
            <CardBody className="pt-2 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <div className="font-semibold mb-2">🟢 Adequate</div>
                <ul className="space-y-1 list-disc list-inside">
                  {stockSummary.adequate.map(i => (<li key={i.id} className="flex justify-between items-center"><span>{i.name}</span><Button size="sm" variant="light" onPress={() => go('/?tab=overview')}>View</Button></li>))}
                  {stockSummary.adequate.length === 0 && <li className="text-gray-500">No items</li>}
                </ul>
              </div>
              <div>
                <div className="font-semibold mb-2">🟡 Low (Reorder)</div>
                 <ul className="space-y-1 list-disc list-inside">
                  {stockSummary.low.map(i => (
                    <li key={i.id} className="flex justify-between items-center">
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
                    <li key={i.id} className="flex justify-between items-center">
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

          

          {/* Recent Activity card removed to avoid duplication; see bottom section */}
        </section>

        {/* Right Sidebar removed to avoid duplication with Notices */}
      </div>
      {/* Global messenger for GM */}
      <DeptMessenger from="master" mode="drawer" />
      {/* Quick hotkey hint */}
      <div className="fixed bottom-6 left-6 text-xs text-gray-500 bg-white/60 backdrop-blur px-2 py-1 rounded shadow">Press Ctrl+M to open Messenger</div>

      {/* Recent Activities & Notices - bottom section */}
      <div className="mt-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="border-0 shadow-lg">
            <CardHeader className="pb-3">
              <h3 className="text-xl font-semibold text-ghana-black">📋 Recent Activities</h3>
            </CardHeader>
            <CardBody>
              <RecentActivities area="system" limit={10} />
            </CardBody>
          </Card>
          <Card className="border-0 shadow-lg">
            <CardHeader className="pb-3">
              <h3 className="text-xl font-semibold text-ghana-black">🔔 Executive Notices</h3>
            </CardHeader>
            <CardBody>
              <DeptNotices dept="gm" title="" defaultTab="alerts" />
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}


