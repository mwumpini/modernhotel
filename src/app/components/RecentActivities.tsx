'use client';

import React from 'react';
import { auditLogStore } from '../lib/analytics/auditLogStore';

interface RecentActivitiesProps {
  area?: string;
  limit?: number;
}

export default function RecentActivities({ area, limit = 8 }: RecentActivitiesProps) {
  const todayISO = new Date().toISOString().split('T')[0];
  const [viewDate, setViewDate] = React.useState(todayISO);
  const [items, setItems] = React.useState<any[]>([]);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
    const update = () => setItems(getItemsForDate(area, limit, viewDate));
    update();
    const unsub = auditLogStore.subscribe(update);
    return () => { try { unsub && (unsub as any)(); } catch {} };
  }, [area, limit, viewDate]);

  const dotClass = (sev?: string) => {
    switch ((sev || '').toLowerCase()) {
      case 'high':
      case 'critical':
        return 'bg-red-500';
      case 'medium':
        return 'bg-yellow-500';
      case 'low':
      default:
        return 'bg-green-500';
    }
  };

  const yesterdayISO = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
  })();
  const dayChip = (active: boolean) =>
    `h-6 rounded-md px-2 text-xs font-medium transition-colors ${
      active ? 'bg-ghana-green text-white' : 'text-gray-600 hover:bg-gray-100'
    }`;
  const shortDate = new Date(viewDate + 'T00:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs text-gray-500">{shortDate}</span>
        <div className="inline-flex items-center rounded-lg border border-gray-200 p-0.5">
          <button type="button" className={dayChip(viewDate === todayISO)} onClick={() => setViewDate(todayISO)}>Today</button>
          <button type="button" className={dayChip(viewDate === yesterdayISO)} onClick={() => setViewDate(yesterdayISO)}>Yesterday</button>
        </div>
      </div>
      <div className="space-y-1.5">
      {(mounted ? items : []).map((i) => (
        <div key={i.id} className="flex items-center gap-2 rounded-md px-1 py-1">
          <div className={`h-1.5 w-1.5 shrink-0 rounded-full ${dotClass((i as any).severity)}`}></div>
          <span className="text-sm text-gray-800">{formatText(i)}</span>
        </div>
      ))}
      {mounted && items.length === 0 && (
        <div className="py-1 text-xs text-gray-500">No activity for this day</div>
      )}
      </div>
    </div>
  );
}

function getItemsForDate(area: string | undefined, limit: number, isoDate: string) {
  try {
    const all = auditLogStore.all();
    const byArea = area ? all.filter((r: any) => String(r.area) === area) : all;
    // Exclude demo seed entries if present
    const nonDemo = byArea.filter((r: any) => !(r.meta && (r.meta as any).demo));
    const filtered = nonDemo.filter((r: any) => (r.at || '').startsWith(isoDate));
    return filtered.slice(0, limit);
  } catch {
    return [] as any[];
  }
}

function formatText(i: any) {
  const when = i.at ? timeAgo(new Date(i.at)) : '';
  const entity = i.entity ? `${i.entity}` : '';
  const action = i.action ? `${i.action}` : '';
  const details = i.details ? ` - ${i.details}` : '';
  return `${entity ? entity + ' ' : ''}${action}${details}${when ? ` (${when})` : ''}`;
}

function timeAgo(date: Date) {
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  const m = Math.floor(diff / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}


