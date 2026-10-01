'use client';

import React from 'react';
import { Card, CardBody, CardHeader, Button, Chip, Dropdown, DropdownTrigger, DropdownMenu, DropdownItem } from "@heroui/react";
import { useRouter } from 'next/navigation';
import { announcementStore, DepartmentKey } from '../lib/analytics/announcementStore';
import { useEmployeeStore } from '../lib/hr/employeeStore';
import { useSession } from 'next-auth/react';
import { dmStore } from '../lib/communications/dmStore';
import { buildDeskBrief } from '../lib/ai/deskBrief';
import { localMamaniReply } from '../lib/ai/mamaniReply';
import { findHelp, isHelpQuestion, type HelpMatch } from '../lib/ai/helpSearch';

interface DeptMessengerProps {
  from: DepartmentKey;
  mode?: 'inline' | 'drawer';
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
  const [dmInput, setDmInput] = React.useState('');
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
    const brief = buildDeskBrief(from);
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

  const contentMessenger = (
    <Card className="border-0 shadow-md">
      <CardHeader className="pb-1"><h3 className="font-semibold text-ghana-black">Department Messenger</h3></CardHeader>
      <CardBody className="pt-2 space-y-3 text-sm">
        <div className="flex gap-2 flex-wrap items-center">
          <label className="text-xs flex items-center gap-1"><input type="checkbox" checked={dmMode} onChange={(e) => setDmMode(e.target.checked)} /> Private</label>
          {dmMode && (
            <select className="border border-gray-300 rounded px-2 h-8 text-sm" value={dmTarget} onChange={(e) => setDmTarget(e.target.value)}>
              <option value="">Select colleague…</option>
          {employees.filter(emp => emp.id !== currentUserId).map(emp => (
            <option key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName}</option>
              ))}
            </select>
          )}
          <select className="border border-gray-300 rounded px-2 h-8 text-sm" value={level} onChange={(e) => setLevel(e.target.value as any)}>
            <option value="urgent">Urgent</option>
            <option value="normal">Normal</option>
            <option value="info">Info</option>
          </select>
          <Dropdown>
            <DropdownTrigger>
              <Button size="sm" variant="flat">
                {targets.includes('all') ? 'Departments: All' : `Departments: ${targets.length}`}
              </Button>
            </DropdownTrigger>
            <DropdownMenu
              aria-label="Select departments"
              selectionMode="multiple"
              selectedKeys={new Set(targets as any)}
              onSelectionChange={(keys) => {
                const arr = Array.from(keys as Set<any>) as DepartmentKey[];
                // If 'all' is selected, it overrides specific departments
                if (arr.includes('all')) {
                  setTargets(['all']);
                } else {
                  setTargets(arr.length ? arr : [from]);
                }
              }}
            >
      {(['all','master','gm','frontdesk','housekeeping','inventory','security','hr','accounting','f&b','events'] as DepartmentKey[]).map(d => (
                <DropdownItem key={d}>{d.toUpperCase()}</DropdownItem>
              ))}
            </DropdownMenu>
          </Dropdown>
          <input className="flex-1 border border-gray-300 rounded px-2 h-8" placeholder={dmMode ? "Private message to colleague..." : "Type a message... (use @master, @gm, @frontdesk)"} value={text} onChange={(e) => setText(e.target.value)} />
          <Button size="sm" onPress={send}>Send</Button>
        </div>
        <label className="flex items-center gap-2 text-xs text-gray-600"><input type="checkbox" checked={markReadOnSend} onChange={(e) => setMarkReadOnSend(e.target.checked)} /> Mark thread read on send</label>

        <div className="flex gap-2 mb-2 items-center">
          <input type="date" className="border border-gray-300 rounded px-2 h-8 text-sm" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          <input type="date" className="border border-gray-300 rounded px-2 h-8 text-sm" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          <input placeholder="Search messages..." className="flex-1 border border-gray-300 rounded px-2 h-8 text-sm" value={search} onChange={(e) => setSearch(e.target.value)} />
          <select className="border border-gray-300 rounded px-2 h-8 text-xs" onChange={(e) => {
            const v = e.target.value;
            if (v === 'today') { const d = new Date(); const iso = d.toISOString().split('T')[0]; setStartDate(iso); setEndDate(iso); }
            else if (v === '7') { const e2 = new Date(); const s = new Date(); s.setDate(e2.getDate() - 6); const is = s.toISOString().split('T')[0]; const ie = e2.toISOString().split('T')[0]; setStartDate(is); setEndDate(ie); }
            else if (v === 'month') { const e2 = new Date(); const s = new Date(e2.getFullYear(), e2.getMonth(), 1); const is = s.toISOString().split('T')[0]; const ie = e2.toISOString().split('T')[0]; setStartDate(is); setEndDate(ie); }
            else if (v === 'clear') { setStartDate(''); setEndDate(''); setSearch(''); }
            e.currentTarget.selectedIndex = 0;
          }}>
            <option value="">Presets</option>
            <option value="today">Today</option>
            <option value="7">Last 7 days</option>
            <option value="month">This month</option>
            <option value="clear">Clear</option>
          </select>
        </div>
        {!dmMode && (
        <div className="space-y-2">
          {history.filter(m => {
            const text = `${m.message}`.toLowerCase();
            if (search && !text.includes(search.toLowerCase())) return false;
            if (startDate && m.at < startDate) return false;
            if (endDate && m.at > endDate + 'T23:59:59') return false;
            return true;
          }).map(m => (
            <div key={m.id} className="p-2 bg-gray-50 rounded flex items-start justify-between">
              <div>
                <div className="text-xs text-gray-500">{new Date(m.at).toLocaleTimeString()} • From {m.from?.toUpperCase() || 'SYSTEM'}</div>
                <div className="mt-0.5">{m.message} {m.mentions && m.mentions.length ? <span className="ml-1 text-xs text-blue-600">[{m.mentions.join(', ')}]</span> : null} {m.userMentions && m.userMentions.length ? <span className="ml-1 text-xs text-purple-600">[@{m.userMentions.join(', @')}]</span> : null}</div>
              </div>
              <Chip size="sm" variant="flat" color={m.level === 'urgent' ? 'danger' : m.level === 'normal' ? 'warning' : 'primary'}>{m.level}</Chip>
            </div>
          ))}
          {history.length === 0 && <div className="text-gray-500">No messages yet</div>}
        </div>
        )}
        {dmMode && (
          <div className="space-y-2">
            <div className="text-xs text-gray-600">Private conversation</div>
            <div className="h-48 overflow-y-auto border border-gray-200 rounded p-2 bg-white">
              {dmTarget ? (
                dmStore.getState().getThread(currentUserId, dmTarget).map(m => (
                  <div key={m.id} className={`flex ${m.fromUserId === currentUserId ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] p-2 rounded ${m.fromUserId === currentUserId ? 'bg-ghana-green text-white' : 'bg-gray-100 text-gray-800'}`}>
                      {m.content}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-gray-500 text-sm">Select a colleague to start chatting.</div>
              )}
            </div>
            {dmTarget && dmStore.getState().isTyping(dmTarget, currentUserId) && (
              <div className="text-xs text-gray-500">Typing…</div>
            )}
            <div className="flex gap-2 items-center">
              <input className="flex-1 border border-gray-300 rounded px-2 h-8" placeholder="Type a private message…" value={dmInput} onChange={(e) => {
                setDmInput(e.target.value);
                if (dmTarget) dmStore.getState().setTyping(currentUserId, dmTarget, true);
              }} onBlur={() => { if (dmTarget) dmStore.getState().setTyping(currentUserId, dmTarget, false); }} onKeyDown={(e) => { if (e.key === 'Enter' && dmTarget && dmInput.trim()) { dmStore.getState().send(currentUserId, dmTarget, dmInput.trim()); setDmInput(''); dmStore.getState().setTyping(currentUserId, dmTarget, false); } }} />
              <Button size="sm" onPress={() => { if (dmTarget && dmInput.trim()) { dmStore.getState().send(currentUserId, dmTarget, dmInput.trim()); setDmInput(''); dmStore.getState().setTyping(currentUserId, dmTarget, false); } }}>Send</Button>
            </div>
          </div>
        )}
      </CardBody>
    </Card>
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

  const deskBrief = buildDeskBrief(from);
  const contentAi = (
    <Card className="border-0 shadow-md">
      <CardHeader className="pb-1"><h3 className="font-semibold text-ghana-black">Ask Mamani</h3></CardHeader>
      <CardBody className="pt-2 space-y-3 text-sm">
        <div className="h-64 overflow-y-auto border border-gray-200 rounded p-2 bg-white">
          {aiThread.length === 0 && (
            <div className="text-gray-500 text-sm space-y-2">
              <p>Ask about {deskBrief.label}, or how to use a screen. F12 opens this. I draft notices. You send them.</p>
              <div className="flex flex-wrap gap-1.5">
                {deskBrief.prompts.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    className="rounded border border-gray-300 bg-white px-2 py-1 text-xs text-ghana-black hover:bg-gray-50"
                    onClick={() => ask(prompt)}
                  >
                    {prompt}
                  </button>
                ))}
                <button
                  type="button"
                  className="rounded border border-gray-300 bg-white px-2 py-1 text-xs text-ghana-black hover:bg-gray-50"
                  onClick={() => ask('How do I use this desk?')}
                >
                  How do I use this desk?
                </button>
                <button
                  type="button"
                  className="rounded border border-gray-300 bg-white px-2 py-1 text-xs text-ghana-black hover:bg-gray-50"
                  onClick={() => { setIsOpen(false); router.push('/help'); }}
                >
                  Full Help
                </button>
              </div>
            </div>
          )}
          <div className="space-y-2">
            {aiThread.map(msg => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] p-2 rounded ${msg.role === 'user' ? 'bg-ghana-green text-white' : 'bg-gray-100 text-gray-800'}`}>
                  <div>{msg.content}</div>
                  {msg.role === 'assistant' && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {msg.help && (msg.help.section || msg.help.href) && (
                        <Button size="sm" variant="flat" onPress={() => openHelpTarget(msg.help!)}>Open in app</Button>
                      )}
                      <Button size="sm" variant="flat" onPress={() => setText((prev) => (prev ? prev + ' ' : '') + msg.content)}>Copy to Messenger</Button>
                      <Button size="sm" variant="flat" onPress={() => { setActiveMode('messenger'); setText(msg.content); }}>Use as Notice</Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {aiLoading && (
              <div className="flex justify-start">
                <div className="max-w-[80%] p-2 rounded bg-gray-100 text-gray-500 animate-pulse">Thinking…</div>
              </div>
            )}
            {aiError && (
              <div className="text-xs text-red-600">{aiError}</div>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <input className="flex-1 border border-gray-300 rounded px-2 h-9" placeholder="Ask Mamani to help..." value={aiInput} onChange={(e) => setAiInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') ask(); }} />
          <Button size="sm" onPress={() => ask()}>Ask</Button>
        </div>
      </CardBody>
    </Card>
  );
  if (mode === 'inline') return contentMessenger;

  // Drawer mode with floating trigger
  const lastSeenKey = `ann.msg.lastSeen.${from}`;
  const latestAt = history[0]?.at || '';
  const unread = (typeof window !== 'undefined') ? ((localStorage.getItem(lastSeenKey) || '') < latestAt) : false;

  const closeDrawer = () => {
    setIsOpen(false);
    try { localStorage.setItem(lastSeenKey, new Date().toISOString()); } catch {}
  };

  return (
    <>
      <button
        aria-label="Open Messenger"
        onClick={() => { setIsOpen(true); }}
        className="fixed bottom-6 right-6 z-40 h-12 w-12 rounded-full bg-ghana-green text-white shadow-xl flex items-center justify-center hover:bg-green-700"
      >
        💬
        {unread ? <span className="absolute -top-1 -right-1 h-3 w-3 bg-red-500 rounded-full" /> : null}
      </button>
      {isOpen && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/30" onClick={closeDrawer} />
          <aside className="absolute right-0 top-0 h-full w-full sm:w-[24rem] bg-white shadow-2xl p-4 overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <h4 className="font-semibold text-ghana-black">{from.toUpperCase()}</h4>
                <div className="border rounded overflow-hidden text-xs">
                  <button className={`px-2 py-1 ${activeMode === 'messenger' ? 'bg-ghana-green text-white' : 'bg-white'}`} onClick={() => setActiveMode('messenger')}>Messenger</button>
                  <button className={`px-2 py-1 ${activeMode === 'ai' ? 'bg-ghana-green text-white' : 'bg-white'}`} onClick={() => setActiveMode('ai')}>Ask Mamani</button>
                </div>
              </div>
              <button onClick={closeDrawer} className="text-gray-500 hover:text-gray-800">✕</button>
            </div>
            {activeMode === 'messenger' ? contentMessenger : contentAi}
          </aside>
        </div>
      )}
    </>
  );
}


