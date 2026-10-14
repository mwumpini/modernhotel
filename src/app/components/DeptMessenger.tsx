'use client';

import React from 'react';
import { Button, Dropdown, DropdownTrigger, DropdownMenu, DropdownItem } from "@heroui/react";
import { useRouter } from 'next/navigation';
import { announcementStore, DepartmentKey } from '../lib/analytics/announcementStore';
import { useEmployeeStore } from '../lib/hr/employeeStore';
import { useSession } from 'next-auth/react';
import { dmStore } from '../lib/communications/dmStore';
import { buildDeskBrief } from '../lib/ai/deskBrief';
import { localMamaniReply } from '../lib/ai/mamaniReply';
import { useSettingsStore } from '../lib/settings/store';
import { findHelp, isHelpQuestion, type HelpMatch } from '../lib/ai/helpSearch';

interface DeptMessengerProps {
  from: DepartmentKey;
  mode?: 'inline' | 'drawer';
}

const DEPT_LABEL: Record<DepartmentKey, string> = {
  all: 'All',
  master: 'Master',
  gm: 'GM',
  frontdesk: 'Front Desk',
  housekeeping: 'Housekeeping',
  inventory: 'Inventory',
  security: 'Security',
  hr: 'HR',
  accounting: 'Accounting',
  'f&b': 'F&B',
  events: 'Events',
};

const LEVELS = [
  { id: 'info', label: 'Info', on: 'bg-sky-100 text-sky-800' },
  { id: 'normal', label: 'Normal', on: 'bg-amber-100 text-amber-800' },
  { id: 'urgent', label: 'Urgent', on: 'bg-red-100 text-red-700' },
] as const;

const DEPT_KEYS = ['all', 'master', 'gm', 'frontdesk', 'housekeeping', 'inventory', 'security', 'hr', 'accounting', 'f&b', 'events'] as DepartmentKey[];

const FAB_KEY = 'messenger.fab';
const FAB_SIZE = 48;

type FabPlace = { x: number; y: number; hidden: boolean };

function clampFab(place: FabPlace): FabPlace {
  if (typeof window === 'undefined') return place;
  const maxX = Math.max(8, window.innerWidth - FAB_SIZE - 8);
  const maxY = Math.max(8, window.innerHeight - FAB_SIZE - 8);
  return {
    x: Math.min(maxX, Math.max(8, place.x)),
    y: Math.min(maxY, Math.max(8, place.y)),
    hidden: place.hidden,
  };
}

function loadFab(): FabPlace {
  const fallback = {
    x: typeof window === 'undefined' ? 16 : window.innerWidth - FAB_SIZE - 24,
    y: typeof window === 'undefined' ? 16 : window.innerHeight - FAB_SIZE - 24,
    hidden: false,
  };
  try {
    const raw = localStorage.getItem(FAB_KEY);
    if (!raw) return clampFab(fallback);
    const parsed = JSON.parse(raw) as Partial<FabPlace>;
    if (typeof parsed.x !== 'number' || typeof parsed.y !== 'number') return clampFab(fallback);
    return clampFab({ x: parsed.x, y: parsed.y, hidden: parsed.hidden === true });
  } catch {
    return clampFab(fallback);
  }
}

export default function DeptMessenger({ from, mode = 'inline' }: DeptMessengerProps) {
  const router = useRouter();
  const [text, setText] = React.useState('');
  const [level, setLevel] = React.useState<'urgent'|'normal'|'info'>('info');
  const [targets, setTargets] = React.useState<DepartmentKey[]>([from]);
  const [history, setHistory] = React.useState(() => announcementStore.getForDepartment(from, 20));
  const [markReadOnSend, setMarkReadOnSend] = React.useState(true);
  const [isOpen, setIsOpen] = React.useState(false);
  const [activeMode, setActiveMode] = React.useState<'messenger'|'ai'>('messenger');
  const [dmMode, setDmMode] = React.useState(false);
  // Reactive selector (not .getState(), which only reads a one-time snapshot
  // and never re-renders this component when the store fills in later) — and
  // hydrated below, since previously nothing here ever called hydrateFromApi()
  // at all; the picker only had names if some other component (HR & Payroll)
  // happened to have populated the store first this session.
  const employees = useEmployeeStore((s) => s.employees);
  const [dmTarget, setDmTarget] = React.useState<string>('');
  const [currentUserId, setCurrentUserId] = React.useState<string>('');

  const { data: session } = useSession();
  React.useEffect(() => {
    const sid = (session as any)?.user?.id || '';
    setCurrentUserId(sid);
  }, [session]);

  React.useEffect(() => {
    if (useEmployeeStore.getState().employees.length === 0) {
      void useEmployeeStore.getState().hydrateFromApi();
    }
  }, []);

  const [search, setSearch] = React.useState('');
  const [startDate, setStartDate] = React.useState('');
  const [endDate, setEndDate] = React.useState('');
  const [showFilters, setShowFilters] = React.useState(false);
  const [fab, setFab] = React.useState<FabPlace | null>(null);
  const fabDrag = React.useRef<{ px: number; py: number; x: number; y: number; moved: boolean } | null>(null);
  const dmMessages = dmStore((s) => s.messages);

  React.useEffect(() => {
    setFab(loadFab());
    const onResize = () => setFab((current) => (current ? clampFab(current) : current));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  React.useEffect(() => {
    if (!fab) return;
    try { localStorage.setItem(FAB_KEY, JSON.stringify(fab)); } catch { /* ignore */ }
  }, [fab]);

  // Simple local AI chat state (no external API; rule-based helper)
  type ChatMsg = { id: string; role: 'user'|'assistant'; content: string; at: string; help?: HelpMatch };
  const [aiInput, setAiInput] = React.useState('');
  const [aiThread, setAiThread] = React.useState<ChatMsg[]>([]);
  const [aiLoading, setAiLoading] = React.useState(false);
  const [aiError, setAiError] = React.useState<string | null>(null);
  const localOnly = (process.env.NEXT_PUBLIC_AI_LOCAL_ONLY === 'true');

  React.useEffect(() => {
    const rerender = () => setHistory(announcementStore.getForDepartment(from, 20));
    announcementStore.subscribe(rerender);
    const openHandler = () => setIsOpen(true);
    const askHandler = (ev: Event) => {
      ev.preventDefault();
      setIsOpen(true);
      setActiveMode('ai');
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('open-messenger', openHandler as any);
      window.addEventListener('open-ask-mamani', askHandler);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('open-messenger', openHandler as any);
        window.removeEventListener('open-ask-mamani', askHandler);
      }
    };
  }, [from]);

  const send = () => {
    if (!text.trim()) return;
    if (dmMode) {
      if (!dmTarget) return;
      dmStore.getState().send(currentUserId, dmTarget, text.trim());
      setText('');
      return;
    }
    const mentionMatches = Array.from(text.matchAll(/@([a-zA-Z&-]+)/g)).map(m => m[1].toLowerCase());
    const normalizedMentions = mentionMatches
      .map(n => n === 'fb' ? 'f&b' : n)
      .filter(n => ['frontdesk','housekeeping','inventory','security','hr','accounting','f&b','events','gm','all'].includes(n)) as DepartmentKey[];
    const userMentions = Array.from(text.matchAll(/@user:([\w.-]+)/g)).map(m => m[1]);
    // Route messages into Notices stream; DeptNotices renders them by level and style
    announcementStore.publish({ level, message: text.trim(), departments: targets, from, mentions: normalizedMentions, userMentions });
    if (markReadOnSend) {
      try {
        localStorage.setItem(`ann.lastSeen.${from}` as const, new Date().toISOString());
      } catch {}
    }
    setText('');
  };

  const ask = (raw?: string) => {
    const content = (raw ?? aiInput).trim();
    if (!content || aiLoading) return;
    const matches = isHelpQuestion(content) ? findHelp(content, from) : [];
    const helpLink = matches[0];
    // This desk plus every module this person can open, so full control can ask about anything.
    const brief = buildDeskBrief(from, (prefix) => useSettingsStore.getState().hasModuleAccess(prefix));
    const replyBrief = { ...brief, help: matches.map((m) => m.text) };
    const userMsg: ChatMsg = { id: `u-${Date.now()}`, role: 'user', content, at: new Date().toISOString() };
    const pushAssistant = (reply: string) => {
      setAiThread(prev => [...prev, { id: `a-${Date.now()}`, role: 'assistant', content: reply, at: new Date().toISOString(), help: helpLink }]);
    };
    setAiThread(prev => [...prev, userMsg]);
    setAiInput('');
    (async () => {
      if (localOnly) {
        pushAssistant(localMamaniReply(content, replyBrief));
        return;
      }
      setAiError(null);
      setAiLoading(true);
      try {
        const resp = await fetch('/api/ai/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: content, context: aiThread.slice(-6), desk: brief.label, deskKey: from, snapshot: brief.snapshot, notices: brief.notices }) });
        if (resp.ok) {
          // Stream the reply as it arrives (AI or the local fallback, both plain text).
          if ((resp as any).body?.getReader) {
            const reader = (resp as any).body.getReader();
            const decoder = new TextDecoder();
            let acc = '';
            let started = false;
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              acc += decoder.decode(value, { stream: true });
              if (!started) {
                started = true;
                pushAssistant(acc);
              } else {
                setAiThread(prev => {
                  const copy = [...prev];
                  const last = copy[copy.length - 1];
                  if (last && last.role === 'assistant') copy[copy.length - 1] = { ...last, content: acc };
                  return copy;
                });
              }
            }
            setAiLoading(false);
          } else {
            pushAssistant(await resp.text());
            setAiLoading(false);
          }
          return;
        }
        throw new Error('bad status');
      } catch {
        pushAssistant(localMamaniReply(content, replyBrief));
        setAiError('Falling back to local assistant due to network/model issue.');
        setAiLoading(false);
      }
    })();
  };

  const filtersActive = Boolean(search || startDate || endDate);
  const visibleHistory = history.filter((m) => {
    if (search && !m.message.toLowerCase().includes(search.toLowerCase())) return false;
    if (startDate && m.at < startDate) return false;
    if (endDate && m.at > `${endDate}T23:59:59`) return false;
    return true;
  });
  const dmThread = React.useMemo(
    () => (dmTarget ? dmStore.getState().getThread(currentUserId, dmTarget) : []),
    [dmMessages, dmTarget, currentUserId],
  );

  const applyRange = (preset: 'today' | '7' | 'month' | 'clear') => {
    if (preset === 'clear') {
      setStartDate('');
      setEndDate('');
      setSearch('');
      return;
    }
    const end = new Date();
    const start = new Date(end);
    if (preset === '7') start.setDate(end.getDate() - 6);
    if (preset === 'month') start.setDate(1);
    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(end.toISOString().split('T')[0]);
  };

  const renderMessenger = (fill: boolean) => (
    <div className={fill ? 'flex min-h-0 flex-1 flex-col' : 'flex max-h-[32rem] flex-col'}>
      <div className={`min-h-0 flex-1 overflow-y-auto px-4 py-3 ${fill ? '' : 'max-h-64'}`}>
        {dmMode ? (
          !dmTarget ? (
            <p className="flex h-full min-h-[8rem] items-center justify-center text-center text-sm text-gray-400">Choose a colleague to start a private chat.</p>
          ) : dmThread.length === 0 ? (
            <p className="flex h-full min-h-[8rem] items-center justify-center text-center text-sm text-gray-400">No private messages yet.</p>
          ) : (
            <div className="space-y-2">
              {dmThread.map((m) => (
                <div key={m.id} className={`flex ${m.fromUserId === currentUserId ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-2xl px-3 py-1.5 text-sm ${m.fromUserId === currentUserId ? 'bg-ghana-green text-white' : 'bg-gray-100 text-gray-800'}`}>
                    {m.content}
                  </div>
                </div>
              ))}
              {dmStore.getState().isTyping(dmTarget, currentUserId) && <p className="text-xs text-gray-400">Typing…</p>}
            </div>
          )
        ) : visibleHistory.length === 0 ? (
          <p className="flex h-full min-h-[8rem] items-center justify-center text-center text-sm text-gray-400">
            {history.length === 0 ? 'No messages yet.' : 'Nothing in this range.'}
          </p>
        ) : (
          <div className="space-y-1">
            {visibleHistory.map((m) => (
              <div key={m.id} className="rounded-lg px-2 py-1.5 hover:bg-gray-50">
                <div className="flex items-center gap-2 text-[11px] text-gray-400">
                  <span className={`h-1.5 w-1.5 rounded-full ${m.level === 'urgent' ? 'bg-red-500' : m.level === 'normal' ? 'bg-amber-400' : 'bg-sky-400'}`} />
                  <span>{new Date(m.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  <span>{DEPT_LABEL[(m.from as DepartmentKey) || 'master'] || 'Desk'}</span>
                  <span className="ml-auto capitalize">{m.level}</span>
                </div>
                <p className="mt-0.5 text-sm text-ghana-black">
                  {m.message}
                  {m.mentions && m.mentions.length ? <span className="ml-1 text-xs text-sky-700">[{m.mentions.join(', ')}]</span> : null}
                  {m.userMentions && m.userMentions.length ? <span className="ml-1 text-xs text-purple-600">[@{m.userMentions.join(', @')}]</span> : null}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {showFilters && !dmMode && (
        <div className="space-y-2 border-t border-gray-100 px-3 py-2">
          <input
            placeholder="Search messages"
            className="h-8 w-full rounded-lg border border-gray-200 bg-gray-50 px-2.5 text-sm outline-none focus:border-ghana-green"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="flex flex-wrap gap-1">
            {([['today', 'Today'], ['7', '7 days'], ['month', 'Month'], ['clear', 'Clear']] as const).map(([id, label]) => (
              <button key={id} type="button" className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-600 hover:bg-gray-200" onClick={() => applyRange(id)}>
                {label}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input type="date" aria-label="From date" className="h-8 min-w-0 flex-1 rounded-lg border border-gray-200 px-2 text-xs" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            <input type="date" aria-label="To date" className="h-8 min-w-0 flex-1 rounded-lg border border-gray-200 px-2 text-xs" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
          <label className="flex items-center gap-2 text-xs text-gray-500">
            <input type="checkbox" checked={markReadOnSend} onChange={(e) => setMarkReadOnSend(e.target.checked)} />
            Mark thread read on send
          </label>
        </div>
      )}

      <div className="shrink-0 border-t border-gray-100 px-3 py-2.5">
        <div className="mb-2 flex flex-wrap items-center gap-1">
          <button
            type="button"
            aria-pressed={dmMode}
            className={`h-7 rounded-full px-2.5 text-xs font-medium ${dmMode ? 'bg-ghana-green text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            onClick={() => setDmMode((v) => !v)}
          >
            Private
          </button>
          {dmMode ? (
            <select
              aria-label="Colleague"
              className="h-7 min-w-0 flex-1 rounded-full border border-gray-200 bg-white px-2 text-xs"
              value={dmTarget}
              onChange={(e) => setDmTarget(e.target.value)}
            >
              <option value="">Colleague…</option>
              {employees.filter((emp) => emp.id !== currentUserId).map((emp) => (
                <option key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName}</option>
              ))}
            </select>
          ) : (
            <>
              {LEVELS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={level === item.id}
                  className={`h-7 rounded-full px-2 text-xs font-medium ${level === item.id ? item.on : 'text-gray-400 hover:bg-gray-100'}`}
                  onClick={() => setLevel(item.id)}
                >
                  {item.label}
                </button>
              ))}
              <Dropdown>
                <DropdownTrigger>
                  <Button size="sm" variant="light" className="ml-auto h-7 min-w-0 px-2 text-xs font-medium text-gray-600">
                    {targets.includes('all') ? 'All desks' : `${targets.length} desk${targets.length === 1 ? '' : 's'}`}
                  </Button>
                </DropdownTrigger>
                <DropdownMenu
                  aria-label="Select departments"
                  selectionMode="multiple"
                  selectedKeys={new Set(targets)}
                  onSelectionChange={(keys) => {
                    const arr = Array.from(keys as Set<React.Key>) as DepartmentKey[];
                    setTargets(arr.includes('all') ? ['all'] : arr.length ? arr : [from]);
                  }}
                >
                  {DEPT_KEYS.map((d) => (
                    <DropdownItem key={d}>{DEPT_LABEL[d]}</DropdownItem>
                  ))}
                </DropdownMenu>
              </Dropdown>
            </>
          )}
          {!dmMode && (
            <button
              type="button"
              aria-pressed={showFilters}
              aria-label="Filter messages"
              className={`h-7 rounded-full px-2 text-xs font-medium ${showFilters || filtersActive ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              onClick={() => setShowFilters((v) => !v)}
            >
              Filter
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <input
            className="h-9 min-w-0 flex-1 rounded-full border border-gray-200 bg-gray-50 px-3 text-sm outline-none focus:border-ghana-green focus:bg-white"
            placeholder={dmMode ? 'Private message' : 'Message…  @frontdesk'}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              if (dmMode && dmTarget) dmStore.getState().setTyping(currentUserId, dmTarget, true);
            }}
            onBlur={() => { if (dmMode && dmTarget) dmStore.getState().setTyping(currentUserId, dmTarget, false); }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                if (dmMode && dmTarget) dmStore.getState().setTyping(currentUserId, dmTarget, false);
                send();
              }
            }}
          />
          <button
            type="button"
            className="h-9 shrink-0 rounded-full bg-ghana-green px-3.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-40"
            disabled={!text.trim() || (dmMode && !dmTarget)}
            onClick={() => {
              if (dmMode && dmTarget) dmStore.getState().setTyping(currentUserId, dmTarget, false);
              send();
            }}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
  const openHelpTarget = (hit: HelpMatch) => {
    if (hit.href) {
      router.push(hit.href);
      setIsOpen(false);
      return;
    }
    if (!hit.section) return;
    try {
      localStorage.setItem('nav.section', hit.section);
      if (hit.settingsTab) localStorage.setItem('settings.tab', hit.settingsTab);
      if (hit.complianceTab) localStorage.setItem('compliance.tab', hit.complianceTab);
      window.dispatchEvent(new CustomEvent('app.navigate', { detail: { section: hit.section } }));
    } catch {}
    setIsOpen(false);
  };

  const deskBrief = buildDeskBrief(from, (prefix) => useSettingsStore.getState().hasModuleAccess(prefix));
  const renderAi = (fill: boolean) => (
    <div className={fill ? 'flex min-h-0 flex-1 flex-col' : 'flex max-h-[32rem] flex-col'}>
      <div className={`min-h-0 flex-1 overflow-y-auto px-4 py-3 ${fill ? '' : 'max-h-64'}`}>
        {aiThread.length === 0 && (
          <div className="space-y-3 text-sm text-gray-500">
            <p>Ask about {deskBrief.label}. I draft notices. You send them.</p>
            <div className="flex flex-wrap gap-1.5">
              {deskBrief.prompts.map((prompt) => (
                <button key={prompt} type="button" className="rounded-full bg-gray-100 px-2.5 py-1 text-xs text-ghana-black hover:bg-gray-200" onClick={() => ask(prompt)}>
                  {prompt}
                </button>
              ))}
              <button type="button" className="rounded-full bg-gray-100 px-2.5 py-1 text-xs text-ghana-black hover:bg-gray-200" onClick={() => ask('How do I use this desk?')}>
                How do I use this desk?
              </button>
              <button type="button" className="rounded-full bg-gray-100 px-2.5 py-1 text-xs text-ghana-black hover:bg-gray-200" onClick={() => { setIsOpen(false); router.push('/help'); }}>
                Full Help
              </button>
            </div>
          </div>
        )}
        <div className="space-y-2">
          {aiThread.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl px-3 py-1.5 text-sm ${msg.role === 'user' ? 'bg-ghana-green text-white' : 'bg-gray-100 text-gray-800'}`}>
                <div className="whitespace-pre-line">{msg.content}</div>
                {msg.role === 'assistant' && (
                  <div className="mt-1.5 flex flex-wrap gap-2 text-[11px]">
                    {msg.help && (msg.help.section || msg.help.href) && (
                      <button type="button" className="underline" onClick={() => openHelpTarget(msg.help!)}>Open</button>
                    )}
                    <button type="button" className="underline" onClick={() => setText((prev) => (prev ? `${prev} ` : '') + msg.content)}>Copy</button>
                    <button type="button" className="underline" onClick={() => { setActiveMode('messenger'); setText(msg.content); }}>Use as notice</button>
                  </div>
                )}
              </div>
            </div>
          ))}
          {aiLoading && <p className="text-xs text-gray-400">Thinking…</p>}
          {aiError && <p className="text-xs text-red-600">{aiError}</p>}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2 border-t border-gray-100 px-3 py-2.5">
        <input
          className="h-9 min-w-0 flex-1 rounded-full border border-gray-200 bg-gray-50 px-3 text-sm outline-none focus:border-ghana-green focus:bg-white"
          placeholder="Ask Mamani"
          value={aiInput}
          onChange={(e) => setAiInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') ask(); }}
        />
        <button type="button" className="h-9 shrink-0 rounded-full bg-ghana-green px-3.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-40" disabled={!aiInput.trim() || aiLoading} onClick={() => ask()}>
          Ask
        </button>
      </div>
    </div>
  );

  if (mode === 'inline') return renderMessenger(false);

  const lastSeenKey = `ann.msg.lastSeen.${from}`;
  const latestAt = history[0]?.at || '';
  const unread = (typeof window !== 'undefined') ? ((localStorage.getItem(lastSeenKey) || '') < latestAt) : false;

  const closeDrawer = () => {
    setIsOpen(false);
    try { localStorage.setItem(lastSeenKey, new Date().toISOString()); } catch {}
  };

  return (
    <>
      {fab?.hidden ? (
        <button
          type="button"
          aria-label="Show messenger button"
          onClick={() => setFab((current) => (current ? { ...current, hidden: false } : loadFab()))}
          className="fixed z-40 flex h-10 w-7 items-center justify-center rounded-l-full bg-ghana-green text-sm text-white shadow-lg hover:bg-green-700"
          style={{ top: fab.y, right: 0 }}
        >
          💬
        </button>
      ) : (
        <div
          className={`fixed z-40 h-12 w-12 touch-none ${fab ? '' : 'bottom-6 right-6'}`}
          style={fab ? { left: fab.x, top: fab.y } : undefined}
        >
          <button
            type="button"
            aria-label="Open Messenger"
            title="Drag to move"
            onPointerDown={(event) => {
              if ((event.target as HTMLElement).closest('[data-fab-close]')) return;
              const rect = event.currentTarget.parentElement?.getBoundingClientRect();
              fabDrag.current = {
                px: event.clientX,
                py: event.clientY,
                x: rect?.left ?? fab?.x ?? 0,
                y: rect?.top ?? fab?.y ?? 0,
                moved: false,
              };
              try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* pointer already released */ }
            }}
            onPointerMove={(event) => {
              const drag = fabDrag.current;
              if (!drag) return;
              const dx = event.clientX - drag.px;
              const dy = event.clientY - drag.py;
              if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
              setFab(clampFab({ x: drag.x + dx, y: drag.y + dy, hidden: false }));
            }}
            onPointerUp={() => {
              const drag = fabDrag.current;
              fabDrag.current = null;
              if (drag && !drag.moved) setIsOpen(true);
            }}
            className="relative flex h-12 w-12 cursor-grab items-center justify-center rounded-full bg-ghana-green text-white shadow-xl hover:bg-green-700 active:cursor-grabbing"
          >
            💬
            {unread ? <span className="absolute -left-1 -top-1 h-3 w-3 rounded-full bg-red-500" /> : null}
            <span
              role="button"
              tabIndex={0}
              data-fab-close
              aria-label="Hide messenger button"
              onPointerDown={(event) => event.stopPropagation()}
              onPointerUp={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                setFab((current) => ({ ...(current ?? loadFab()), hidden: true }));
              }}
              onKeyDown={(event) => {
                if (event.key !== 'Enter' && event.key !== ' ') return;
                event.preventDefault();
                event.stopPropagation();
                setFab((current) => ({ ...(current ?? loadFab()), hidden: true }));
              }}
              className="absolute right-[1px] top-[1px] z-10 flex h-3 w-3 cursor-pointer items-center justify-center rounded-full bg-red-600 text-[8px] font-bold leading-none text-white shadow-sm hover:bg-red-700"
            >
              ✕
            </span>
          </button>
        </div>
      )}
      {isOpen && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/30" onClick={closeDrawer} />
          <aside className="absolute right-0 top-0 flex h-full w-full flex-col bg-white shadow-2xl sm:w-[22rem]">
            <div className="flex shrink-0 items-center gap-2 border-b border-gray-100 px-3 py-2.5">
              <h4 className="min-w-0 flex-1 truncate text-sm font-semibold text-ghana-black">{DEPT_LABEL[from]}</h4>
              <div className="flex rounded-full bg-gray-100 p-0.5 text-xs">
                <button type="button" className={`rounded-full px-2.5 py-1 ${activeMode === 'messenger' ? 'bg-white font-medium text-ghana-black shadow-sm' : 'text-gray-500'}`} onClick={() => setActiveMode('messenger')}>Messages</button>
                <button type="button" className={`rounded-full px-2.5 py-1 ${activeMode === 'ai' ? 'bg-white font-medium text-ghana-black shadow-sm' : 'text-gray-500'}`} onClick={() => setActiveMode('ai')}>Ask Mamani</button>
              </div>
              <button type="button" aria-label="Close messenger" onClick={closeDrawer} className="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-700">✕</button>
            </div>
            {activeMode === 'messenger' ? renderMessenger(true) : renderAi(true)}
          </aside>
        </div>
      )}
    </>
  );
}


