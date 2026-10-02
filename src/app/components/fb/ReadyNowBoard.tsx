'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Chip, Input } from '@heroui/react';
import { fbTenantHeaders } from '../../lib/fb/api';
import { isOnReadyBoard, todayServiceDate } from '../../lib/fb/readyBoard';
import { useSettingsStore } from '../../lib/settings/store';

type Dish = {
  id: string;
  name: string;
  category: string;
  route: string;
  alias?: string;
  price: number;
  isPinned?: boolean;
  prepMinutes?: number;
  isAvailable?: boolean;
  readyNow?: boolean;
  readyForDate?: string | null;
  readyPortions?: number | null;
};

const ALL_TAB = '__all';
const PINNED_TAB = '__pinned';
const CATEGORY_ORDER = ['food', 'dessert', 'snack', 'special'];

async function loadKitchenMenu(): Promise<Dish[]> {
  const res = await fetch('/api/fb/menu', { headers: fbTenantHeaders() });
  if (!res.ok) throw new Error('Could not load the menu');
  const data = await res.json();
  return ((data.items || []) as Dish[])
    .filter((item) => (item.route || 'kitchen') === 'kitchen' && item.isAvailable !== false)
    .map((item) => ({
      ...item,
      price: Number((item as Dish & { unitPrice?: number }).unitPrice ?? item.price ?? 0),
      alias: item.alias || '',
      isPinned: !!item.isPinned,
    }));
}

function portionLabel(dish: Dish): string {
  if (!isOnReadyBoard(dish)) return '';
  if (dish.readyPortions == null) return 'Keep sending';
  return `${dish.readyPortions} left`;
}

function matchesSearch(dish: Dish, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [dish.name, dish.category, dish.alias || ''].some((value) => value.toLowerCase().includes(q));
}

/** Restaurant floor page: the food a quick order can sell right now. The kitchen marks the list. */
export function ReadyNowPage() {
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [failed, setFailed] = useState(false);
  const [search, setSearch] = useState('');
  const [menuTab, setMenuTab] = useState(ALL_TAB);

  const refresh = useCallback(async () => {
    try {
      setDishes(await loadKitchenMenu());
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    refresh();
    const timer = window.setInterval(refresh, 20000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const togglePin = async (dish: Dish) => {
    const pinned = !dish.isPinned;
    setDishes((prev) => prev.map((row) => (row.id === dish.id ? { ...row, isPinned: pinned } : row)));
    try {
      const res = await fetch('/api/fb/menu', {
        method: 'PATCH',
        headers: fbTenantHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ id: dish.id, isPinned: pinned }),
      });
      if (!res.ok) throw new Error('The star did not save');
    } catch {
      refresh();
    }
  };

  const ready = useMemo(() => dishes.filter((dish) => isOnReadyBoard(dish)), [dishes]);
  const ordered = useMemo(
    () => [...ready].sort((a, b) => Number(!!b.isPinned) - Number(!!a.isPinned) || a.name.localeCompare(b.name)),
    [ready],
  );
  const categories = useMemo(() => {
    const rank = (category: string) => {
      const index = CATEGORY_ORDER.indexOf(category.toLowerCase());
      return index === -1 ? CATEGORY_ORDER.length : index;
    };
    return Array.from(new Set(ordered.map((dish) => dish.category)))
      .sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
  }, [ordered]);
  const pinned = useMemo(() => ordered.filter((dish) => dish.isPinned), [ordered]);
  const tabs = useMemo(() => [ALL_TAB, PINNED_TAB, ...categories], [categories]);
  const activeTab = tabs.includes(menuTab) ? menuTab : ALL_TAB;
  const searching = search.trim() !== '';
  const shown = (activeTab === PINNED_TAB ? pinned : activeTab === ALL_TAB ? ordered : ordered.filter((dish) => dish.category === activeTab))
    .filter((dish) => matchesSearch(dish, search));
  const tabLabel = (tab: string) =>
    tab === ALL_TAB ? 'All' : tab === PINNED_TAB ? `★ Starred (${pinned.length})` : tab.charAt(0).toUpperCase() + tab.slice(1);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-[var(--text-secondary)]">Food the kitchen can send immediately. Quick orders can only sell this list.</p>
        <Chip size="sm" className="bg-[#006B3F] font-semibold text-white dark:bg-[#3dbe86] dark:text-[#06281a]">{ready.length} ready</Chip>
      </div>
      <Input
        aria-label="Search ready food"
        placeholder="Search food…"
        value={search}
        onValueChange={setSearch}
        isClearable
        onClear={() => setSearch('')}
        classNames={{
          inputWrapper: 'h-11 border-2 border-[var(--input-border)] bg-[var(--input-background)] shadow-none',
          input: 'text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]',
        }}
      />
      {failed ? (
        <p className="text-sm font-medium text-[#991b1b] dark:text-[#fecaca]">The ready board could not be loaded.</p>
      ) : (
        <>
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="tablist" aria-label="Ready food categories">
            {tabs.map((tab) => (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={activeTab === tab}
                onClick={() => setMenuTab(tab)}
                className={`h-10 shrink-0 rounded-xl border px-4 text-sm font-semibold ${activeTab === tab ? 'border-[#006B3F] bg-[#006B3F] text-white dark:border-[#3dbe86] dark:bg-[#3dbe86] dark:text-[#06281a]' : 'border-[var(--card-border)] bg-[var(--card-background)] text-[var(--text-primary)] hover:bg-[var(--surface)]'}`}
              >
                {tabLabel(tab)}
              </button>
            ))}
          </div>
          {shown.length === 0 ? (
            <p className="py-10 text-center text-sm font-medium text-[var(--text-secondary)]">
              {searching ? 'No ready dishes match your search.' : 'Nothing is marked ready. Drinks stay at the bar. Food has to be cooked to order.'}
            </p>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] gap-2.5">
              {shown.map((dish) => (
                <div
                  key={dish.id}
                  className="relative flex flex-col overflow-hidden rounded-xl border border-[#006B3F] bg-[#e5f6ec] dark:border-[#7dffa8] dark:bg-[#123528]"
                >
                  <div className="flex flex-1 flex-col p-2.5 pr-10 text-left">
                    <span className="line-clamp-2 text-sm font-semibold leading-snug text-[#064e3b] dark:text-[#e7fff2]">{dish.name}</span>
                    <span className="truncate text-xs font-medium text-[#14532d] dark:text-[#c8f5dc]">{dish.category}</span>
                    <span className="mt-auto flex flex-wrap items-center gap-1 pt-2 text-xs font-semibold text-[#065f46] dark:text-[#b6f3d0]">
                      Ready
                      {dish.readyPortions == null ? (
                        <span>Keep sending</span>
                      ) : (
                        <span className="inline-flex rounded-md bg-[#9a3412] px-1.5 py-0.5 font-bold leading-none text-[#fff7ed] dark:bg-[#fcd34d] dark:text-[#422006]">
                          {dish.readyPortions} left
                        </span>
                      )}
                    </span>
                    {Number.isFinite(dish.price) && dish.price > 0 && (
                      <span className="whitespace-nowrap text-sm font-bold text-[#064e3b] dark:text-[#e7fff2]">GH₵ {dish.price.toFixed(2)}</span>
                    )}
                  </div>
                  <button
                    type="button"
                    aria-label={dish.isPinned ? `Unstar ${dish.name}` : `Star ${dish.name}`}
                    title={dish.isPinned ? 'Unstar' : 'Star so it stays easy to find'}
                    className={`absolute right-1.5 top-1.5 inline-flex h-8 w-8 items-center justify-center rounded-full border text-lg leading-none ${dish.isPinned ? 'border-[#b45309] bg-[#fff7ed] text-[#9a3412] dark:border-[#fcd34d] dark:bg-[#422006] dark:text-[#fde68a]' : 'border-[var(--card-border)] bg-[var(--card-background)] text-[var(--text-secondary)] hover:text-[#9a3412] dark:hover:text-[#fde68a]'}`}
                    onClick={() => togglePin(dish)}
                  >
                    {dish.isPinned ? '★' : '☆'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** Read-only list for the restaurant floor: what can go out immediately. */
export function ReadyNowNotice() {
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [failed, setFailed] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const items = await loadKitchenMenu();
      setDishes(items.filter((item) => isOnReadyBoard(item)));
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    refresh();
    const timer = window.setInterval(refresh, 20000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  return (
    <div className="mb-8 rounded-xl border border-[#006B3F] bg-[#e5f6ec] px-4 py-3 dark:border-[#7dffa8] dark:bg-[#123528]">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-semibold text-[#064e3b] dark:text-[#e7fff2]">Ready now</p>
        <p className="text-xs font-medium text-[#14532d] dark:text-[#c8f5dc]">Food the kitchen can send immediately. Quick orders can only sell this list.</p>
      </div>
      {failed ? (
        <p className="mt-2 text-sm font-medium text-[#991b1b] dark:text-[#fecaca]">The ready board could not be loaded.</p>
      ) : dishes.length === 0 ? (
        <p className="mt-2 text-sm font-medium text-[#14532d] dark:text-[#c8f5dc]">Nothing is marked ready. Drinks stay at the bar. Food has to be cooked to order.</p>
      ) : (
        <div className="mt-2 flex flex-wrap gap-2">
          {dishes.map((dish) => (
            <Chip key={dish.id} variant="flat" className="bg-white font-semibold text-[#064e3b] dark:bg-[#06281a] dark:text-[#e7fff2]">
              {dish.name}{dish.readyPortions != null ? ` · ${dish.readyPortions}` : ''}
            </Chip>
          ))}
        </div>
      )}
    </div>
  );
}

/** Kitchen marks restaurant food that can leave the pass immediately. Drinks stay off this board. */
export default function ReadyNowBoard() {
  const canPublish = useSettingsStore((s) => s.hasPermission('kitchen.manage-ready-board'));
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [menuTab, setMenuTab] = useState(ALL_TAB);
  const today = todayServiceDate();

  const refresh = useCallback(async () => {
    try {
      setDishes(await loadKitchenMenu());
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the menu');
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const save = async (dish: Dish, patch: { readyNow: boolean; readyPortions: number | null }) => {
    if (!canPublish) return;
    setBusyId(dish.id);
    setError('');
    const next = {
      ...dish,
      readyNow: patch.readyNow,
      readyForDate: patch.readyNow ? today : null,
      readyPortions: patch.readyNow ? patch.readyPortions : null,
    };
    setDishes((prev) => prev.map((row) => (row.id === dish.id ? next : row)));
    try {
      const res = await fetch('/api/fb/menu', {
        method: 'PATCH',
        headers: fbTenantHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          id: dish.id,
          readyNow: next.readyNow,
          readyForDate: next.readyForDate,
          readyPortions: next.readyPortions,
        }),
      });
      if (!res.ok) throw new Error('The ready board did not save');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The ready board did not save');
      refresh();
    } finally {
      setBusyId(null);
    }
  };

  const togglePin = async (dish: Dish) => {
    if (!canPublish) return;
    const pinned = !dish.isPinned;
    setDishes((prev) => prev.map((row) => (row.id === dish.id ? { ...row, isPinned: pinned } : row)));
    try {
      const res = await fetch('/api/fb/menu', {
        method: 'PATCH',
        headers: fbTenantHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ id: dish.id, isPinned: pinned }),
      });
      if (!res.ok) throw new Error('The star did not save');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The star did not save');
      refresh();
    }
  };

  const clearBoard = async () => {
    if (!canPublish || !dishes.some((dish) => dish.readyNow)) return;
    setError('');
    try {
      const res = await fetch('/api/fb/menu', {
        method: 'PATCH',
        headers: fbTenantHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ clearReadyBoard: true }),
      });
      if (!res.ok) throw new Error('Could not clear the ready board');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not clear the ready board');
    }
  };

  const ordered = useMemo(
    () => [...dishes].sort((a, b) => Number(!!b.isPinned) - Number(!!a.isPinned) || a.name.localeCompare(b.name)),
    [dishes],
  );
  const categories = useMemo(() => {
    const rank = (category: string) => {
      const index = CATEGORY_ORDER.indexOf(category.toLowerCase());
      return index === -1 ? CATEGORY_ORDER.length : index;
    };
    return Array.from(new Set(ordered.map((dish) => dish.category)))
      .sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
  }, [ordered]);
  const pinned = useMemo(() => ordered.filter((dish) => dish.isPinned), [ordered]);
  const tabs = useMemo(
    () => [ALL_TAB, PINNED_TAB, ...categories],
    [categories],
  );
  const activeTab = tabs.includes(menuTab) ? menuTab : ALL_TAB;
  const searching = search.trim() !== '';
  const shown = (activeTab === PINNED_TAB ? pinned : activeTab === ALL_TAB ? ordered : ordered.filter((dish) => dish.category === activeTab))
    .filter((dish) => matchesSearch(dish, search));
  const tabLabel = (tab: string) =>
    tab === ALL_TAB ? 'All' : tab === PINNED_TAB ? `★ Starred (${pinned.length})` : tab.charAt(0).toUpperCase() + tab.slice(1);
  const readyCount = dishes.filter((dish) => isOnReadyBoard(dish)).length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-[var(--text-secondary)]">
          {canPublish
            ? 'Tap a dish to mark it ready for immediate service. Drinks are not on this board.'
            : 'This board is read-only for your role. Drinks are not on this board.'}
        </p>
        <div className="flex items-center gap-2">
          <Chip size="sm" className="bg-[#006B3F] font-semibold text-white dark:bg-[#3dbe86] dark:text-[#06281a]">{readyCount} ready</Chip>
          {canPublish && (
            <Button size="sm" variant="flat" className="font-semibold text-[var(--text-primary)]" onPress={clearBoard}>Clear board</Button>
          )}
        </div>
      </div>
      <Input
        aria-label="Search menu"
        placeholder="Search food…"
        value={search}
        onValueChange={setSearch}
        isClearable
        onClear={() => setSearch('')}
        classNames={{
          inputWrapper: 'h-11 border-2 border-[var(--input-border)] bg-[var(--input-background)] shadow-none',
          input: 'text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]',
        }}
      />
      {error && <p className="text-sm font-medium text-[#991b1b] dark:text-[#fecaca]">{error}</p>}
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="tablist" aria-label="Menu categories">
        {tabs.map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={activeTab === tab}
            onClick={() => setMenuTab(tab)}
            className={`h-10 shrink-0 rounded-xl border px-4 text-sm font-semibold ${activeTab === tab ? 'border-[#006B3F] bg-[#006B3F] text-white dark:border-[#3dbe86] dark:bg-[#3dbe86] dark:text-[#06281a]' : 'border-[var(--card-border)] bg-[var(--card-background)] text-[var(--text-primary)] hover:bg-[var(--surface)]'}`}
          >
            {tabLabel(tab)}
          </button>
        ))}
      </div>
      {shown.length === 0 ? (
        <p className="py-10 text-center text-sm font-medium text-[var(--text-secondary)]">
          {searching ? 'No dishes match your search.' : 'No food on this menu yet.'}
        </p>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] gap-2.5">
          {shown.map((dish) => {
            const on = isOnReadyBoard(dish);
            return (
              <div
                key={dish.id}
                className={`relative flex flex-col overflow-hidden rounded-xl border ${on ? 'border-[#006B3F] bg-[#e5f6ec] dark:border-[#7dffa8] dark:bg-[#123528]' : 'border-[var(--card-border)] bg-[var(--card-background)]'}`}
              >
                <button
                  type="button"
                  disabled={!canPublish || busyId === dish.id}
                  onClick={() => save(dish, { readyNow: !on, readyPortions: on ? null : dish.readyPortions ?? null })}
                  className="flex flex-1 flex-col p-2.5 pr-10 text-left"
                  aria-pressed={on}
                  aria-label={`${on ? 'Clear' : 'Mark'} ${dish.name} ready now`}
                >
                  <span className={`line-clamp-2 text-sm font-semibold leading-snug ${on ? 'text-[#064e3b] dark:text-[#e7fff2]' : 'text-[var(--text-primary)]'}`}>{dish.name}</span>
                  <span className={`truncate text-xs font-medium ${on ? 'text-[#14532d] dark:text-[#c8f5dc]' : 'text-[var(--text-secondary)]'}`}>{dish.category}</span>
                  <span className={`mt-auto pt-2 text-xs font-semibold ${on ? 'text-[#065f46] dark:text-[#b6f3d0]' : 'text-[var(--text-secondary)]'}`}>
                    {on ? `Ready · ${portionLabel(dish)}` : canPublish ? 'Tap to mark ready' : 'Not on the board'}
                  </span>
                  {Number.isFinite(dish.price) && dish.price > 0 && (
                    <span className={`whitespace-nowrap text-sm font-bold ${on ? 'text-[#064e3b] dark:text-[#e7fff2]' : 'text-[var(--text-primary)]'}`}>GH₵ {dish.price.toFixed(2)}</span>
                  )}
                </button>
                <button
                  type="button"
                  aria-label={dish.isPinned ? `Unstar ${dish.name}` : `Star ${dish.name}`}
                  title={dish.isPinned ? 'Unstar' : 'Star so it stays easy to find'}
                  disabled={!canPublish}
                  className={`absolute right-1.5 top-1.5 inline-flex h-8 w-8 items-center justify-center rounded-full border text-lg leading-none disabled:opacity-40 ${dish.isPinned ? 'border-[#b45309] bg-[#fff7ed] text-[#9a3412] dark:border-[#fcd34d] dark:bg-[#422006] dark:text-[#fde68a]' : 'border-[var(--card-border)] bg-[var(--card-background)] text-[var(--text-secondary)] hover:text-[#9a3412] dark:hover:text-[#fde68a]'}`}
                  onClick={() => togglePin(dish)}
                >
                  {dish.isPinned ? '★' : '☆'}
                </button>
                {on && (
                  <label className="flex items-center gap-1 border-t border-[#006B3F]/40 px-2 py-1.5 text-xs font-medium text-[#14532d] dark:border-[#7dffa8]/50 dark:text-[#c8f5dc]">
                    Portions
                    <input
                      type="number"
                      min={1}
                      aria-label={`Portions of ${dish.name}`}
                      placeholder="No limit"
                      disabled={!canPublish}
                      className="h-7 w-full rounded border border-[#006B3F] bg-[#ffffff] px-1.5 text-xs font-semibold text-[#064e3b] placeholder:text-[#3f6212] disabled:opacity-60 dark:border-[#7dffa8] dark:bg-[#06281a] dark:text-[#e7fff2] dark:placeholder:text-[#b6f3d0]"
                      value={dish.readyPortions != null ? String(dish.readyPortions) : ''}
                      onChange={(event) => {
                        const raw = event.target.value.trim();
                        const portions = raw === '' ? null : Math.max(0, Math.floor(Number(raw)) || 0);
                        setDishes((prev) => prev.map((row) => (row.id === dish.id ? { ...row, readyPortions: portions } : row)));
                      }}
                      onBlur={(event) => {
                        const raw = event.target.value.trim();
                        const portions = raw === '' ? null : Math.max(0, Math.floor(Number(raw)) || 0);
                        if (portions === 0) save(dish, { readyNow: false, readyPortions: null });
                        else save(dish, { readyNow: true, readyPortions: portions });
                      }}
                    />
                  </label>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
