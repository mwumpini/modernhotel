'use client';

import { createContext, createElement, useContext, useEffect, useState, type ReactNode } from 'react';

/**
 * Status cards, today's operations, and quick actions stay hidden until
 * someone presses Show summary. That choice is remembered per desk.
 */
export function useSummaryCollapsed(storageKey: string) {
  const [collapsed, setCollapsed] = useState(true);

  useEffect(() => {
    let saved: string | null = null;
    try { saved = localStorage.getItem(storageKey); } catch {}
    if (saved !== null) setCollapsed(saved === '1');
  }, [storageKey]);

  const toggle = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try { localStorage.setItem(storageKey, next ? '1' : '0'); } catch {}
      return next;
    });
  };

  return { collapsed, toggle };
}

const HostSummaryContext = createContext(false);

/**
 * Desk shells set this so the count cards on each work tab follow Show summary.
 * A page opened on its own has no provider, so those cards stay visible.
 */
export function SummaryCollapsedProvider({
  collapsed,
  children,
}: {
  collapsed: boolean;
  children: ReactNode;
}) {
  return createElement(HostSummaryContext.Provider, { value: collapsed }, children);
}

export function useHostSummaryCollapsed() {
  return useContext(HostSummaryContext);
}
