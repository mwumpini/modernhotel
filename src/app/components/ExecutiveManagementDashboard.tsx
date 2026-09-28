'use client';

import React from 'react';
import { Card, CardBody, CardHeader, Button, Dropdown, DropdownTrigger, DropdownMenu, DropdownItem, Tooltip } from "@heroui/react";
import { CalendarDays, Download, Shield, Sparkles, PartyPopper, Wallet, AlertTriangle, TrendingUp, TrendingDown, UtensilsCrossed, Package, Activity, Bell, Users, LogIn, LogOut, Gauge } from 'lucide-react';
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
import CustomizeViewControl, { HideCardButton } from './dashboard/CustomizeViewControl';
import { useDashboardVisibility, type DashboardSectionDef } from '../lib/dashboard/useDashboardVisibility';
import { useSettingsStore } from '../lib/settings/store';
import { moduleEnabled } from '../lib/settings/moduleAccess';
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


function formatCurrency(amount: number | undefined) {
  // Intl already renders GHS as "GH₵" for this locale (the .replace below is a
  // no-op safety net for locales/engines that instead spell out "GHS") — the
  // zero fallback has to match that exact prefix, or ₵0 sits next to GH₵3,300
  // on the same card with no explanation for the missing "GH".
  if (!amount || Number.isNaN(amount)) return 'GH₵0';
  try {
    return new Intl.NumberFormat('en-GH', { style: 'currency', currency: 'GHS', maximumFractionDigits: 0 }).format(amount).replace('GHS', '₵');
  } catch {
    return `GH₵${Math.round(amount).toLocaleString()}`;
  }
}

function isoDaysFromToday(offset: number) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().split('T')[0];
}

/** Same module keys the sidebar uses, minus this dashboard itself. */
// Same emoji per module the sidebar (Navigation.tsx) uses, so this quick-nav
// row reads as a shortcut to those same sections rather than a separate icon set.
const QUICK_MODULES: { key: string; label: string; icon: string }[] = [
  { key: 'frontdesk', label: 'Front Office', icon: '🏨' },
  { key: 'events-conferences', label: 'Events', icon: '🎪' },
  { key: 'restaurant', label: 'Restaurant', icon: '🍽️' },
  { key: 'kitchen', label: 'Kitchen', icon: '👨‍🍳' },
  { key: 'housekeeping', label: 'Housekeeping', icon: '🛏️' },
  { key: 'inventory', label: 'Inventory', icon: '📦' },
  { key: 'security', label: 'Security', icon: '🚨' },
  { key: 'hr', label: 'HR', icon: '👥' },
  { key: 'accounting', label: 'Accounting', icon: '🧾' },
  { key: 'compliance', label: 'Compliance', icon: '⚖️' },
  { key: 'settings', label: 'Settings', icon: '⚙️' },
];

function openModule(section: string) {
  window.dispatchEvent(new CustomEvent('app.navigate', { detail: { section } }));
}

function OpsMetric({
  label,
  value,
  icon,
  iconClass,
  onClick,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  iconClass: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-left transition hover:-translate-y-0.5 hover:border-ghana-green/40 hover:shadow-md"
    >
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${iconClass}`}>{icon}</span>
      <span className="min-w-0">
        <span className="block text-xs font-medium text-gray-600">{label}</span>
        <span className="block text-lg font-semibold tabular-nums text-ghana-black">{value}</span>
      </span>
    </button>
  );
}

// Consistent icon-badge + title + hide-button header, used across all
// dashboard cards so each section reads as a distinct "widget" at a glance.
function SectionHeader({
  icon,
  iconClass,
  title,
  onHide,
  hideLabel,
  extra,
}: {
  icon: React.ReactNode;
  iconClass: string;
  title: string;
  onHide: () => void;
  hideLabel: string;
  extra?: React.ReactNode;
}) {
  return (
    <CardHeader className="pb-1 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${iconClass}`}>{icon}</span>
        <h3 className="font-semibold text-ghana-black">{title}</h3>
      </div>
      <div className="flex items-center gap-3">
        {extra}
        <HideCardButton onHide={onHide} label={hideLabel} />
      </div>
    </CardHeader>
  );
}

// Big-number-on-a-tile stat, matching the treatment Today's Financial Pulse
// established — used to bring the same visual weight to the other cards'
// metrics instead of plain text rows. Sticks to bg-gray-50/text-gray-600,
// the only shades this app's dark-mode CSS (globals.css) has overrides for;
// a colored tile background here would repeat the light-on-light bug fixed
// in the first pass.
function StatTile({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-gray-50 p-2.5">
      <div className="text-xs font-medium text-gray-600">{label}</div>
      <div className="mt-0.5 text-lg font-semibold tracking-tight text-ghana-black">{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-gray-600">{sub}</div>}
    </div>
  );
}

// Hand-rolled SVG area chart (no charting library in this project's
// dependencies) for the 7-day occupancy trend: gradient fill under the line,
// a dot per day, a dashed average line, and a real day-over-day delta badge
// computed from the last two data points (no fabricated comparison).
function OccupancyTrendChart({ trend, onSelectDate }: { trend: Array<{ date: string; rate: number }>; onSelectDate: (date: string) => void }) {
  const w = 560;
  const h = 200;
  const padX = 6;
  const padTop = 14;
  const padBottom = 20;
  const plotW = w - padX * 2;
  const plotH = h - padTop - padBottom;
  const n = trend.length;
  const avg = n ? trend.reduce((s, t) => s + (t.rate || 0), 0) / n : 0;
  const xFor = (i: number) => (n <= 1 ? padX : padX + (i / (n - 1)) * plotW);
  const yFor = (rate: number) => padTop + (1 - Math.max(0, Math.min(100, rate)) / 100) * plotH;
  const points = trend.map((t, i) => ({ x: xFor(i), y: yFor(t.rate || 0), t }));
  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const areaPath = points.length
    ? `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${(padTop + plotH).toFixed(1)} L ${points[0].x.toFixed(1)} ${(padTop + plotH).toFixed(1)} Z`
    : '';
  const avgY = yFor(avg);
  const last = trend[n - 1]?.rate;
  const prev = trend[n - 2]?.rate;
  const delta = typeof last === 'number' && typeof prev === 'number' ? last - prev : null;
  // Peak/lowest day summary — same trend data as the chart, just called out
  // as numbers so the card has real substance instead of empty space below
  // a short chart when it sits next to a taller sibling card.
  const bestDay = n ? trend.reduce((a, b) => ((b.rate || 0) > (a.rate || 0) ? b : a)) : null;
  const worstDay = n ? trend.reduce((a, b) => ((b.rate || 0) < (a.rate || 0) ? b : a)) : null;
  const fmtDay = (d: string) => new Date(d).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

  const svgRef = React.useRef<SVGSVGElement>(null);
  const [hoverIndex, setHoverIndex] = React.useState<number | null>(null);

  const handleMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (n === 0 || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const fraction = (e.clientX - rect.left) / rect.width;
    const idx = Math.round(fraction * (n - 1));
    setHoverIndex(Math.max(0, Math.min(n - 1, idx)));
  };

  const hovered = hoverIndex !== null ? points[hoverIndex] : null;

  return (
    <div>
      <div className="flex items-center justify-end gap-2 text-xs text-gray-600">
        {delta !== null && (
          <span className={`inline-flex items-center gap-0.5 font-semibold ${delta >= 0 ? 'text-green-700' : 'text-red-700'}`}>
            {delta >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {Math.abs(delta).toFixed(0)}pt vs yesterday
          </span>
        )}
        <span>Avg {avg.toFixed(0)}%</span>
      </div>
      {n === 0 ? (
        <div className="flex h-52 items-center justify-center text-sm text-gray-600">No trend data</div>
      ) : (
        <>
          <div className="relative">
            {hovered && (
              <div
                className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-md border border-gray-200 bg-white px-2 py-1 text-[11px] font-medium shadow-md whitespace-nowrap"
                style={{ left: `${(hovered.x / w) * 100}%`, top: `${(hovered.y / h) * 100}%`, marginTop: '-8px' }}
              >
                <div className="text-gray-600">{new Date(hovered.t.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</div>
                <div className="text-sm font-semibold text-ghana-black">{hovered.t.rate.toFixed(0)}% occupied</div>
              </div>
            )}
            <svg
              ref={svgRef}
              viewBox={`0 0 ${w} ${h}`}
              className="h-52 w-full cursor-crosshair"
              preserveAspectRatio="none"
              onMouseMove={handleMove}
              onMouseLeave={() => setHoverIndex(null)}
              onClick={() => hovered && onSelectDate(hovered.t.date)}
            >
              <defs>
                <linearGradient id="occTrendFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#006B3F" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#006B3F" stopOpacity="0" />
                </linearGradient>
              </defs>
              {areaPath && <path d={areaPath} fill="url(#occTrendFill)" />}
              <line x1={padX} y1={avgY} x2={w - padX} y2={avgY} stroke="#9CA3AF" strokeDasharray="4 4" strokeWidth="1" />
              {hovered && (
                <line x1={hovered.x} y1={padTop} x2={hovered.x} y2={padTop + plotH} stroke="#006B3F" strokeOpacity="0.3" strokeWidth="1.5" />
              )}
              {linePath && <path d={linePath} fill="none" stroke="#006B3F" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}
              {points.map((p, i) => (
                <circle
                  key={i}
                  cx={p.x}
                  cy={p.y}
                  r={hoverIndex === i ? 6 : 4}
                  fill="white"
                  stroke="#006B3F"
                  strokeWidth={hoverIndex === i ? 3 : 2}
                  className="cursor-pointer transition-[r]"
                />
              ))}
            </svg>
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-gray-600">
            {trend.map((t, i) => (
              <span key={i} className={hoverIndex === i ? 'font-semibold text-ghana-black' : undefined}>
                {new Date(t.date).toLocaleDateString(undefined, { weekday: 'short' }).slice(0, 3)}
              </span>
            ))}
          </div>
          {bestDay && worstDay && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <StatTile label="Peak day" value={`${bestDay.rate.toFixed(0)}%`} sub={fmtDay(bestDay.date)} />
              <StatTile label="Lowest day" value={`${worstDay.rate.toFixed(0)}%`} sub={fmtDay(worstDay.date)} />
            </div>
          )}
        </>
      )}
    </div>
  );
}

// Hand-rolled SVG donut for the room/F&B/other revenue split that
// generateDailyFlashReport already computes (revenueSplit) but this
// dashboard never visualized — no new data, just a chart for data that
// already existed in state.
function RevenueSplitDonut({ room, fb, other, total }: { room: number; fb: number; other: number; total: number }) {
  const size = 88;
  const stroke = 13;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const safeTotal = total > 0 ? total : room + fb + other;
  const segments = [
    { label: 'Room', value: room, color: '#006B3F' },
    { label: 'F&B', value: fb, color: '#F59E0B' },
    { label: 'Other', value: other, color: '#3B82F6' },
  ];
  let offset = 0;
  return (
    <div className="flex items-center gap-3">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90 shrink-0">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#E5E7EB" strokeWidth={stroke} />
        {safeTotal > 0 && segments.map((s) => {
          const frac = s.value / safeTotal;
          const dash = Math.max(0, frac * c);
          const el = (
            <circle
              key={s.label}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth={stroke}
              strokeDasharray={`${dash} ${c - dash}`}
              strokeDashoffset={-offset}
            />
          );
          offset += dash;
          return el;
        })}
      </svg>
      <div className="space-y-1 text-[11px]">
        {segments.map((s) => (
          <div key={s.label} className="flex items-center gap-1.5 text-gray-600">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: s.color }} />
            {s.label} {formatCurrency(s.value)}
          </div>
        ))}
      </div>
    </div>
  );
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
  useSettingsStore((s) => s.sessionRoleId);
  useSettingsStore((s) => s.roles);
  const moduleSettings = useSettingsStore((s) => s.moduleSettings);
  const quickModules = QUICK_MODULES.filter(
    (m) => useSettingsStore.getState().hasModuleAccess(m.key) && moduleEnabled(m.key, moduleSettings)
  );

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

  const todayISO = isoDaysFromToday(0);
  const yesterdayISO = isoDaysFromToday(-1);
  const occupancyPct = Number.isFinite(expectedOcc) ? Math.round(expectedOcc) : 0;
  const dateChip = (active: boolean) =>
    `h-8 rounded-lg px-3 text-sm font-medium transition-colors ${
      active ? 'bg-ghana-green text-white' : 'text-gray-600 hover:bg-gray-100'
    }`;

  return (
    <div className="p-6">
      <div className="mb-4 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-semibold tracking-tight text-ghana-black">Executive Management</h2>
          <Tooltip content="Rooms, guests, and performance for the selected day" placement="right">
            <button
              type="button"
              aria-label="Rooms, guests, and performance for the selected day"
              className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-gray-300 text-[10px] font-bold leading-none text-gray-600"
            >
              i
            </button>
          </Tooltip>
          <OfflineIndicator />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center rounded-xl border border-gray-200 bg-white p-1 shadow-sm">
            <button type="button" className={dateChip(selectedDate === todayISO)} onClick={() => { setSelectedDate(todayISO); refreshForDate(todayISO); }}>Today</button>
            <button type="button" className={dateChip(selectedDate === yesterdayISO)} onClick={() => { setSelectedDate(yesterdayISO); refreshForDate(yesterdayISO); }}>Yesterday</button>
          </div>
          <label className="inline-flex h-10 items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-600 shadow-sm">
            <CalendarDays className="h-4 w-4 shrink-0" aria-hidden />
            <input
              type="date"
              aria-label="Dashboard date"
              className="bg-transparent text-sm text-ghana-black outline-none"
              value={selectedDate}
              onChange={(e) => { setSelectedDate(e.target.value); if (e.target.value) refreshForDate(e.target.value); }}
            />
          </label>
          <Dropdown>
            <DropdownTrigger>
              <Button size="sm" variant="flat" className="h-10 rounded-xl border border-gray-200 bg-white px-3 shadow-sm" startContent={<Download className="h-3.5 w-3.5" />}>
                Export
              </Button>
            </DropdownTrigger>
            <DropdownMenu aria-label="Export dashboard">
              <DropdownItem key="csv" onPress={handleExportCSV}>Export CSV</DropdownItem>
              <DropdownItem key="pdf" onPress={handleExportPDF}>Export PDF</DropdownItem>
            </DropdownMenu>
          </Dropdown>
          <CustomizeViewControl
            sections={DASHBOARD_SECTIONS}
            isHidden={isHidden}
            toggle={toggleSection}
            showAll={showAll}
            hiddenCount={hiddenCount}
            className="h-10 rounded-xl border border-gray-200 bg-white px-3 shadow-sm"
          />
        </div>
      </div>

      {quickModules.length > 0 && (
        <nav aria-label="Open a module" className="mb-4 flex flex-wrap gap-1.5">
          {quickModules.map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => openModule(m.key)}
              className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-semibold text-gray-700 transition hover:-translate-y-0.5 hover:border-ghana-green/40 hover:bg-white hover:text-ghana-green hover:shadow-sm"
            >
              <span aria-hidden>{m.icon}</span>
              {m.label}
            </button>
          ))}
        </nav>
      )}

      {!isHidden('liveOps') && (
        <section className="mb-5" aria-label="Live Operations">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-xs font-medium uppercase tracking-wider text-gray-600">Live operations</h3>
            <HideCardButton onHide={() => hide('liveOps')} label="Live Operations" />
          </div>
          <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
            <OpsMetric label="In-house guests" value={String(inHouse)} icon={<Users className="h-4 w-4" />} iconClass="bg-blue-100 text-blue-600" onClick={() => go('/housekeeping')} />
            <OpsMetric label="Today's arrivals" value={String(arrivalsToday)} icon={<LogIn className="h-4 w-4" />} iconClass="bg-green-100 text-green-600" onClick={() => go('/guest-services/check-ins?tab=checkins')} />
            <OpsMetric label="Today's departures" value={String(departuresToday)} icon={<LogOut className="h-4 w-4" />} iconClass="bg-orange-100 text-orange-600" onClick={() => go('/guest-services/check-ins?tab=checkouts')} />
            <OpsMetric label="Expected occupancy" value={`${occupancyPct}%`} icon={<Gauge className="h-4 w-4" />} iconClass="bg-purple-100 text-purple-600" onClick={() => go('/reports')} />
          </div>
          <p className="mt-2 text-xs text-gray-600">
            Next hour · {nextHourCheckins} check-ins · {nextHourCheckouts} check-outs
          </p>
        </section>
      )}

      {(() => {
        // At full desktop width the left rail is its own grid column (xl:col-span-1)
        // reserving that width regardless of what's inside it — hiding every card in
        // it (Customize View) left the column an empty gap with the rest of the
        // dashboard still squeezed into the remaining two-thirds. Below xl the outer
        // grid is already single-column, so an empty rail just collapses to zero
        // height there and this never showed up on tablet/mobile — PC only.
        const hasAsideContent = !isHidden('security') || !isHidden('housekeeping') || !isHidden('events');
        return (
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left Sidebar - Safety & status */}
        {hasAsideContent && (
        <aside className="xl:col-span-1 space-y-6">
          {!isHidden('security') && (
          <Card className="border border-gray-200/70 border-l-4 border-l-red-300 rounded-2xl shadow-sm transition-shadow duration-200 hover:shadow-md">
            <SectionHeader
              icon={<Shield className="h-4 w-4" />}
              iconClass="bg-red-100 text-red-600"
              title="Security & Safety"
              onHide={() => hide('security')}
              hideLabel="Security & Safety"
            />
            <CardBody className="pt-2 grid grid-cols-2 gap-3 text-sm">
              <StatTile
                label="Incident Log"
                value={
                  <span className={`inline-flex items-center gap-1.5 ${incidentsToday === 0 ? 'text-green-700' : 'text-red-700'}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${incidentsToday === 0 ? 'bg-green-500' : 'bg-red-500'}`} />
                    {incidentsToday}
                  </span>
                }
              />
              <StatTile
                label="Security Checks"
                value={
                  <span className={`inline-flex items-center gap-1.5 text-base ${securityRoundsComplete ? 'text-green-700' : 'text-red-700'}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${securityRoundsComplete ? 'bg-green-500' : 'bg-red-500'}`} />
                    {securityRoundsComplete ? 'Complete' : 'Pending'}
                  </span>
                }
              />
              <StatTile
                label="CCTV Status"
                value={
                  <span className="inline-flex items-center gap-1.5 text-base text-green-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                    Operational
                  </span>
                }
              />
              <StatTile
                label="Fire Panel"
                value={
                  <span className="inline-flex items-center gap-1.5 text-base text-green-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                    Normal
                  </span>
                }
              />
            </CardBody>
          </Card>
          )}

          {!isHidden('housekeeping') && (
          <Card className="border border-gray-200/70 border-l-4 border-l-blue-300 rounded-2xl shadow-sm transition-shadow duration-200 hover:shadow-md">
            <SectionHeader
              icon={<Sparkles className="h-4 w-4" />}
              iconClass="bg-blue-100 text-blue-600"
              title="Housekeeping Status"
              onHide={() => hide('housekeeping')}
              hideLabel="Housekeeping Status"
            />
            <CardBody className="pt-2 grid grid-cols-2 gap-2 text-sm">
              <div className="space-y-1 cursor-pointer rounded-lg bg-gray-50 p-2.5" onClick={() => go('/housekeeping')}>
                <div className="flex justify-between"><span>Clean/Ready</span><span className="font-semibold text-ghana-black">{Math.round(hkCleanReadyPct)}%</span></div>
                <div className="h-1.5 bg-gray-200 rounded overflow-hidden"><div className="h-1.5 bg-green-600" style={{ width: `${hkCleanReadyPct}%` }} /></div>
              </div>
              <div className="space-y-1 cursor-pointer rounded-lg bg-gray-50 p-2.5" onClick={() => go('/housekeeping')}>
                <div className="flex justify-between"><span>In Progress</span><span className="font-semibold text-ghana-black">{Math.round(hkInProgressPct)}%</span></div>
                <div className="h-1.5 bg-gray-200 rounded overflow-hidden"><div className="h-1.5 bg-blue-600" style={{ width: `${hkInProgressPct}%` }} /></div>
              </div>
              <div className="space-y-1 cursor-pointer rounded-lg bg-gray-50 p-2.5" onClick={() => go('/housekeeping')}>
                <div className="flex justify-between"><span>Dirty</span><span className="font-semibold text-ghana-black">{Math.round(hkDirtyPct)}%</span></div>
                <div className="h-1.5 bg-gray-200 rounded overflow-hidden"><div className="h-1.5 bg-yellow-500" style={{ width: `${hkDirtyPct}%` }} /></div>
              </div>
              <div className="space-y-1 cursor-pointer rounded-lg bg-gray-50 p-2.5" onClick={() => go('/housekeeping')}>
                <div className="flex justify-between"><span>Out of Order</span><span className="font-semibold text-ghana-black">{Math.round(hkOooPct)}%</span></div>
                <div className="h-1.5 bg-gray-200 rounded overflow-hidden"><div className="h-1.5 bg-red-600" style={{ width: `${hkOooPct}%` }} /></div>
              </div>
            </CardBody>
          </Card>
          )}

          {/* Conferences & Events - live from announcements */}
          {!isHidden('events') && (
          <Card className="border border-gray-200/70 border-l-4 border-l-purple-300 rounded-2xl shadow-sm transition-shadow duration-200 hover:shadow-md">
            <SectionHeader
              icon={<PartyPopper className="h-4 w-4" />}
              iconClass="bg-purple-100 text-purple-600"
              title="Conferences & Events"
              onHide={() => hide('events')}
              hideLabel="Conferences & Events"
            />
            <CardBody className="pt-2 space-y-2 text-sm">
              {eventsList.length === 0 && (
                <div className="p-3 bg-gray-50 border border-gray-200 rounded text-left">No events today</div>
              )}
              {eventsList.slice(0,3).map((t, idx) => (
                <div key={idx} className="p-3 bg-green-50 border border-green-200 rounded text-left">{t}</div>
              ))}
            </CardBody>
          </Card>
          )}
        </aside>
        )}

        {/* Center - Financial, Alerts, Trends, F&B/Kitchen, Stocks, Events */}
        <section className={`${hasAsideContent ? 'xl:col-span-2' : 'xl:col-span-3'} grid grid-cols-1 md:grid-cols-2 gap-6`}>
          {!isHidden('financial') && (
          <Card className="border border-gray-200/70 border-l-4 border-l-green-300 rounded-2xl shadow-sm transition-shadow duration-200 hover:shadow-md md:col-span-2">
            <SectionHeader
              icon={<Wallet className="h-4 w-4" />}
              iconClass="bg-green-100 text-green-600"
              title="Today's Financial Pulse"
              onHide={() => hide('financial')}
              hideLabel="Today's Financial Pulse"
            />
            <CardBody className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="rounded-xl bg-gray-50 p-4">
                <div className="text-xs font-medium text-gray-600">Revenue posted to GL</div>
                <div className="mt-1 text-2xl font-semibold tracking-tight text-ghana-black">{formatCurrency(postedRevenue)}</div>
                <div className="mt-1 text-xs text-gray-600" title="Room/F&B charges accrued on guest folios today, before checkout posts them to the ledger">
                  Billed today, not yet posted: {formatCurrency(revenueToday)}
                </div>
              </div>
              <div className="flex items-center justify-between gap-4 rounded-xl bg-gray-50 p-4">
                <div>
                  <div className="text-xs font-medium text-gray-600">ADR</div>
                  <div className="mt-1 text-xl font-semibold tracking-tight text-ghana-black">{formatCurrency(adr)}</div>
                </div>
                <div>
                  <div className="text-xs font-medium text-gray-600">RevPAR</div>
                  <div className="mt-1 text-xl font-semibold tracking-tight text-ghana-black">{formatCurrency(revpar)}</div>
                </div>
              </div>
              <div className="rounded-xl bg-gray-50 p-4">
                <div className="mb-1 text-xs font-medium text-gray-600">Revenue split</div>
                {revenueSplit.total > 0 ? (
                  <RevenueSplitDonut {...revenueSplit} />
                ) : (
                  <div className="flex h-full items-center text-xs text-gray-600">No revenue yet today</div>
                )}
              </div>
            </CardBody>
          </Card>
          )}

			{/* System Alerts - functional */}
			{!isHidden('alerts') && (
			<Card className="border border-gray-200/70 border-l-4 border-l-yellow-300 rounded-2xl shadow-sm transition-shadow duration-200 hover:shadow-md md:col-span-2">
            <SectionHeader
              icon={<AlertTriangle className="h-4 w-4" />}
              iconClass="bg-yellow-100 text-yellow-700"
              title="System Alerts"
              onHide={() => hide('alerts')}
              hideLabel="System Alerts"
            />
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
                    <div className="text-xs text-gray-600">No alerts</div>
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
                      {b.items.length === 0 && <div className="text-xs text-gray-600">No alerts</div>}
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
          )}

          {/* Trends */}
          {!isHidden('trend') && (
          <Card className="self-start border border-gray-200/70 border-l-4 border-l-blue-300 rounded-2xl shadow-sm transition-shadow duration-200 hover:shadow-md">
            <SectionHeader
              icon={<TrendingUp className="h-4 w-4" />}
              iconClass="bg-blue-100 text-blue-600"
              title="7-Day Occupancy Trend"
              onHide={() => hide('trend')}
              hideLabel="7-Day Occupancy Trend"
            />
            <CardBody className="pt-2">
              {!mounted ? (
                <div className="h-52 bg-gray-50 rounded animate-pulse" />
              ) : (
                <OccupancyTrendChart
                  trend={occupancyTrend || []}
                  onSelectDate={(date) => { setSelectedDate(date); refreshForDate(date); }}
                />
              )}
            </CardBody>
          </Card>
          )}

          {/* F&B and Kitchen Efficiency */}
          {!isHidden('fbKitchen') && (
          <Card className="border border-gray-200/70 border-l-4 border-l-orange-300 rounded-2xl shadow-sm transition-shadow duration-200 hover:shadow-md">
            <SectionHeader
              icon={<UtensilsCrossed className="h-4 w-4" />}
              iconClass="bg-orange-100 text-orange-600"
              title="F&B and Kitchen Efficiency"
              onHide={() => hide('fbKitchen')}
              hideLabel="F&B and Kitchen Efficiency"
            />
            <CardBody className="pt-2 space-y-3 text-sm">
              <div>
                <div className="font-semibold mb-1.5">Restaurant/Bar</div>
                <div className="grid grid-cols-3 gap-2">
                  <StatTile label="Total Orders" value={fbEff.total} />
                  <StatTile label="Served/Paid" value={fbEff.served} />
                  <StatTile label="Items in Queue" value={fbEff.queue} />
                  <StatTile label="Avg Order Value" value={formatCurrency(fbEff.avgOrder)} />
                  <StatTile label="Orders (Last 1h)" value={fbEff.lastHour} />
                </div>
              </div>
              <div>
                <div className="font-semibold mb-1.5">Kitchen</div>
                <div className="grid grid-cols-4 gap-2">
                  <StatTile label="Items Assigned" value={kitchEff.assigned} />
                  <StatTile label="Items Prepared" value={kitchEff.prepared} />
                  <StatTile label="Avg Prep Time" value={`${Math.round(kitchEff.avgPrep)} min`} />
                  <StatTile label="SLA ≤ 15m" value={`${kitchEff.sla15}%`} />
                </div>
              </div>
            </CardBody>
          </Card>
          )}

          {/* Stocks & Inventory - functional */}
          {!isHidden('stock') && (
          <Card className="border border-gray-200/70 border-l-4 border-l-purple-300 rounded-2xl shadow-sm transition-shadow duration-200 hover:shadow-md md:col-span-2">
            <SectionHeader
              icon={<Package className="h-4 w-4" />}
              iconClass="bg-purple-100 text-purple-600"
              title="Critical Stock Levels"
              onHide={() => hide('stock')}
              hideLabel="Critical Stock Levels"
              extra={<div className="text-xs text-gray-600">Low stock %: {useStockStore.getState().getLowStockPercentage().toFixed(0)}%</div>}
            />
            <CardBody className="pt-2 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <div className="font-semibold mb-2">🟢 Adequate</div>
                <ul className="space-y-1 list-disc list-inside">
                  {stockSummary.adequate.map(i => (<li key={i.id} className="flex justify-between items-center"><span>{i.name}</span><Button size="sm" variant="light" onPress={() => go('/?tab=overview')}>View</Button></li>))}
                  {stockSummary.adequate.length === 0 && <li className="text-gray-600">No items</li>}
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
                  {stockSummary.low.length === 0 && <li className="text-gray-600">No items</li>}
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
                  {stockSummary.critical.length === 0 && <li className="text-gray-600">No items</li>}
                </ul>
              </div>
            </CardBody>
          </Card>
          )}

          {/* Recent Activity card removed to avoid duplication; see bottom section */}
        </section>

        {/* Right Sidebar removed to avoid duplication with Notices */}
      </div>
        );
      })()}
      {/* Global messenger for GM */}
      <DeptMessenger from="master" mode="drawer" />

      {/* Recent Activities & Notices - bottom section */}
      {(!isHidden('recentActivities') || !isHidden('notices')) && (
      <div className="mt-5">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {!isHidden('recentActivities') && (
          <Card className="border border-gray-200/70 rounded-2xl shadow-sm transition-shadow duration-200 hover:shadow-md">
            <CardHeader className="flex items-center justify-between px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-600"><Activity className="h-3.5 w-3.5" /></span>
                <h3 className="text-sm font-semibold text-ghana-black">Recent Activities</h3>
              </div>
              <HideCardButton onHide={() => hide('recentActivities')} label="Recent Activities" />
            </CardHeader>
            <CardBody className="px-3 pb-3 pt-0">
              <RecentActivities area="system" limit={10} />
            </CardBody>
          </Card>
          )}
          {!isHidden('notices') && (
          <Card className="border border-gray-200/70 rounded-2xl shadow-sm transition-shadow duration-200 hover:shadow-md">
            <CardHeader className="flex items-center justify-between px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-600"><Bell className="h-3.5 w-3.5" /></span>
                <h3 className="text-sm font-semibold text-ghana-black">Executive Notices</h3>
              </div>
              <HideCardButton onHide={() => hide('notices')} label="Executive Notices" />
            </CardHeader>
            <CardBody className="px-3 pb-3 pt-0">
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


