'use client';

import React from 'react';
import { Card, CardBody, CardHeader, Button } from "@heroui/react";
import { announcementStore, DepartmentKey } from '../lib/analytics/announcementStore';
import { useSettingsStore } from '../lib/settings/store';

interface DeptNoticesProps {
  dept: DepartmentKey;
  title?: string;
  defaultTab?: 'all'|'alerts'|'broadcasts'|'mentions';
  dockBottom?: boolean;
}

export default function DeptNotices({ dept, title = 'Notices & Alerts', defaultTab = 'all', dockBottom = false }: DeptNoticesProps) {
  const [messages, setMessages] = React.useState(() => announcementStore.getForDepartment(dept));
  const [filter, setFilter] = React.useState<'all'|'urgent'|'unread'>('all');
  const [tab, setTab] = React.useState<'all'|'alerts'|'broadcasts'|'mentions'>(defaultTab);
  React.useEffect(() => { setTab(defaultTab); }, [defaultTab]);
  const [enableSound, setEnableSound] = React.useState<boolean>(() => {
    try { return localStorage.getItem(`ann.pref.sound.${dept}`) !== 'false'; } catch { return true; }
  });
  const [enableDesktop, setEnableDesktop] = React.useState<boolean>(() => {
    try { return localStorage.getItem(`ann.pref.desktop.${dept}`) === 'true'; } catch { return false; }
  });
  const [toast, setToast] = React.useState<{ text: string; at: string } | null>(null);
  const lastAtRef = React.useRef<string>(new Date().toISOString());
  const [isOpen, setIsOpen] = React.useState(true);

  React.useEffect(() => {
    const rerender = () => {
      const list = announcementStore.getForDepartment(dept);
      setMessages(list);
      // Detect new urgent messages for notifications
      try {
        const newUrgent = list.find(m => m.level === 'urgent' && m.at > lastAtRef.current);
        if (newUrgent) {
          if (enableSound) playBeep();
          setToast({ text: newUrgent.message, at: newUrgent.at });
          if (dockBottom) setIsOpen(true);
          if (enableDesktop && typeof window !== 'undefined' && 'Notification' in window) {
            if (Notification.permission === 'granted') {
              new Notification(`${dept.toUpperCase()} • Urgent`, { body: newUrgent.message });
            } else if (Notification.permission !== 'denied') {
              Notification.requestPermission().then(p => {
                if (p === 'granted') new Notification(`${dept.toUpperCase()} • Urgent`, { body: newUrgent.message });
              });
            }
          }
        }
        if (list[0]?.at) lastAtRef.current = list[0].at;
      } catch {}
    };
    announcementStore.subscribe(rerender);
    // Mark as seen for unread badge logic
    try {
      localStorage.setItem(`ann.lastSeen.${dept}` as const, new Date().toISOString());
    } catch {}
  }, [dept]);

  const chipColor = (level: string) => level === 'urgent' ? 'danger' : level === 'normal' ? 'warning' : 'primary';
  const levelStyles = (level: string) => {
    if (level === 'urgent') return 'bg-red-50 border border-red-200';
    if (level === 'normal') return 'bg-yellow-50 border border-yellow-200';
    if (level === 'info') return 'bg-blue-50 border border-blue-200';
    return 'bg-purple-50 border border-purple-200';
  };
  const dotColor = (level: string) => {
    if (level === 'urgent') return 'bg-red-500';
    if (level === 'normal') return 'bg-yellow-500';
    if (level === 'info') return 'bg-blue-500';
    return 'bg-purple-500';
  };

  const lastSeen = (typeof window !== 'undefined') ? localStorage.getItem(`ann.lastSeen.${dept}`) : null;
  const [search, setSearch] = React.useState('');
  const [startDate, setStartDate] = React.useState('');
  const [endDate, setEndDate] = React.useState('');
  const settings = useSettingsStore();
  const userId = (settings as any)?.currentUser?.username || (settings as any)?.currentUser?.email || (typeof window !== 'undefined' ? localStorage.getItem('app.username') : '') || '';

  const byFilter = messages.filter(m => {
    // Enforce department visibility: only show if targeted to this dept or 'all'
    if (!(m.departments || []).includes('all') && !(m.departments || []).includes(dept)) return false;
    if (filter === 'urgent') return m.level === 'urgent';
    if (filter === 'unread' && lastSeen) return m.at > lastSeen;
    return true;
  });

  const byDate = byFilter.filter(m => {
    if (startDate && m.at < startDate) return false;
    if (endDate && m.at > endDate + 'T23:59:59') return false;
    if (search && !m.message.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const byTab = byDate.filter(m => {
    if (tab === 'all') return true;
    if (tab === 'alerts') return m.level === 'urgent' || m.level === 'normal';
    if (tab === 'mentions') return (m.userMentions || []).includes(userId);
    if (tab === 'broadcasts') return !(m.userMentions && m.userMentions.length);
    return true;
  });

  const panelBody = (
    <Card className="border-0 shadow-md">
      <CardHeader className="pb-1 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="font-semibold text-ghana-black">{title}</h3>
          <div className="hidden md:flex items-center gap-1">
            {(['all','alerts','broadcasts','mentions'] as const).map(t => (
              <Button key={t} size="sm" variant={tab === t ? 'solid' : 'flat'} onPress={() => setTab(t as any)}>{t.charAt(0).toUpperCase()+t.slice(1)}</Button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1 text-xs text-gray-600"><input type="checkbox" checked={enableSound} onChange={(e) => { setEnableSound(e.target.checked); try { localStorage.setItem(`ann.pref.sound.${dept}`, String(e.target.checked)); } catch {} }} /> Sound</label>
          <label className="flex items-center gap-1 text-xs text-gray-600"><input type="checkbox" checked={enableDesktop} onChange={(e) => { setEnableDesktop(e.target.checked); try { localStorage.setItem(`ann.pref.desktop.${dept}`, String(e.target.checked)); } catch {} }} /> Desktop</label>
          <select className="border border-gray-300 rounded px-2 h-8 text-sm" value={filter} onChange={(e) => setFilter(e.target.value as any)}>
            <option value="all">All</option>
            <option value="urgent">Urgent</option>
            <option value="unread">Unread</option>
          </select>
        </div>
      </CardHeader>
      <CardBody className="pt-2 space-y-2 text-sm">
        <div className="flex gap-2 mb-2 items-center">
          <input type="date" className="border border-gray-300 rounded px-2 h-8 text-sm" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          <input type="date" className="border border-gray-300 rounded px-2 h-8 text-sm" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          <input placeholder="Search notices..." className="flex-1 border border-gray-300 rounded px-2 h-8 text-sm" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        {byTab.map(m => (
          <div key={m.id} className={`p-3 rounded ${levelStyles(m.level)} flex items-start gap-3`}>
            <span className={`h-3 w-3 rounded-full ${dotColor(m.level)} mt-1`}></span>
            <div className="flex-1">
              <div className="text-sm text-ghana-black">{m.message}</div>
              <div className="mt-1 flex items-center gap-2">
                <Button size="sm" variant="flat" onPress={() => {
                  const reply = prompt('Reply:');
                  if (reply && reply.trim()) {
                    announcementStore.publish({ level: 'info', message: reply.trim(), departments: m.departments, from: dept, userMentions: [], mentions: [], at: new Date().toISOString(), parentId: m.id } as any);
                  }
                }}>Reply</Button>
                <span className="text-xs text-gray-500">{new Date(m.at).toLocaleTimeString()}</span>
              </div>
            </div>
          </div>
        ))}
        {byTab.length === 0 && <div className="text-gray-500">No notices</div>}

        {toast && (
          <div className="fixed bottom-4 right-4 z-50 bg-red-600 text-white text-sm px-4 py-2 rounded shadow-lg">
            <div className="font-semibold">Urgent message</div>
            <div>{toast.text}</div>
            <button className="mt-2 text-xs underline" onClick={() => setToast(null)}>Dismiss</button>
          </div>
        )}
      </CardBody>
    </Card>
  );

  if (dockBottom) {
    const unreadCount = byFilter.filter(m => lastSeen ? m.at > lastSeen : true).length;
    return (
      <div className="fixed left-0 right-0 bottom-0 z-40 pointer-events-none">
        <div className="max-w-5xl mx-auto px-4 pb-20 sm:pb-8 pointer-events-auto">
          {/* Toggle bar */}
          <div className="mx-auto mb-2 w-full flex justify-center">
            <button
              className="px-3 py-1 rounded-full bg-white shadow border text-xs text-gray-600 hover:bg-gray-50"
              onClick={() => setIsOpen(v => !v)}
            >
              {isOpen ? 'Hide Notices' : 'Show Notices'}{unreadCount ? ` • ${unreadCount}` : ''}
            </button>
          </div>
          {isOpen && (
            <div className="bg-white/95 backdrop-blur rounded-t-2xl shadow-2xl border">
              <div className="p-3 max-h-64 overflow-y-auto">{panelBody}</div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return panelBody;
}

function playBeep() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);
    o.type = 'sine';
    o.frequency.value = 880;
    g.gain.value = 0.05;
    o.start();
    setTimeout(() => { o.stop(); ctx.close(); }, 250);
  } catch {}
}


