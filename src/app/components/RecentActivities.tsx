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

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs text-gray-600">{new Date(viewDate + 'T00:00:00').toDateString()}</div>
        <div className="flex gap-2">
          <button className="px-2 h-7 text-xs border rounded hover:bg-gray-50" onClick={() => setViewDate(todayISO)}>Today</button>
          <button className="px-2 h-7 text-xs border rounded hover:bg-gray-50" onClick={() => { const d = new Date(); d.setDate(d.getDate()-1); setViewDate(d.toISOString().split('T')[0]); }}>Yesterday</button>
        </div>
      </div>
      <div className="space-y-3">
      {(mounted ? items : []).map((i) => (
        <div key={i.id} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
          <div className={`h-3 w-3 rounded-full ${dotClass((i as any).severity)}`}></div>
          <span className="text-sm text-gray-800">{formatText(i)}</span>
        </div>
      ))}
      {mounted && items.length === 0 && (
        <div className="text-sm text-gray-500">No activity for this day</div>
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


