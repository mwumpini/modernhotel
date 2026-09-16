'use client';

import React from 'react';

/**
 * Per-device "which cards am I hiding right now" preference for a dashboard —
 * genuinely just a display/focus preference (unlike profile/theme, which had
 * to be made real and server-synced), so localStorage is the right home for
 * it: no tenant-wide meaning, no need to follow the user across devices.
 *
 * `sections` is the full list of hideable section ids for this dashboard,
 * each with a human label used by the "Customize View" restore panel.
 */
export interface DashboardSectionDef {
  id: string;
  label: string;
}

export function useDashboardVisibility(storageKey: string, sections: DashboardSectionDef[]) {
  // Start with nothing hidden so the first client render matches the server
  // (which has no localStorage) — read the real saved set after mount,
  // same pattern used elsewhere in this app to avoid hydration mismatches.
  const [hidden, setHidden] = React.useState<Set<string>>(() => new Set());
  const [loaded, setLoaded] = React.useState(false);

  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      const ids: string[] = raw ? JSON.parse(raw) : [];
      const valid = new Set(sections.map((s) => s.id));
      setHidden(new Set(ids.filter((id) => valid.has(id))));
    } catch {
      // ignore malformed storage
    } finally {
      setLoaded(true);
    }
    // Only load once on mount — `sections` is expected to be a stable literal
    // array defined at module/component scope, not recreated per render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  const persist = React.useCallback((next: Set<string>) => {
    setHidden(next);
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(Array.from(next)));
    } catch {
      // ignore write failures (private browsing, storage full, etc.)
    }
  }, [storageKey]);

  const hide = React.useCallback((id: string) => {
    persist(new Set(hidden).add(id));
  }, [hidden, persist]);

  const show = React.useCallback((id: string) => {
    const next = new Set(hidden);
    next.delete(id);
    persist(next);
  }, [hidden, persist]);

  const toggle = React.useCallback((id: string) => {
    hidden.has(id) ? show(id) : hide(id);
  }, [hidden, hide, show]);

  const showAll = React.useCallback(() => persist(new Set()), [persist]);

  return {
    /** True once the real saved state has been read from localStorage — use
     * this to avoid a one-frame flash of "everything visible" if it matters. */
    loaded,
    isHidden: (id: string) => hidden.has(id),
    hiddenCount: hidden.size,
    hide,
    show,
    toggle,
    showAll,
  };
}
