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

/** Activity and notice cards stay off until someone turns them on in Customize. */
const DEFAULT_HIDDEN_IDS = ['recentActivities', 'notices'];

function defaultHiddenIds(sections: DashboardSectionDef[]) {
  const ids = new Set(sections.map((s) => s.id));
  return DEFAULT_HIDDEN_IDS.filter((id) => ids.has(id));
}

export function useDashboardVisibility(storageKey: string, sections: DashboardSectionDef[]) {
  // Activity and notice cards start hidden on the server and the first client
  // paint, so they don't flash on. A saved choice (shown or hidden) is applied
  // after mount.
  const [hidden, setHidden] = React.useState<Set<string>>(() => new Set(defaultHiddenIds(sections)));
  const [loaded, setLoaded] = React.useState(false);

  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      const ids: string[] = raw ? JSON.parse(raw) : [];
      const valid = new Set(sections.map((s) => s.id));
      // Keep ids this screen doesn't know about. A desk tab shares the same
      // saved list and must not wipe the activity cards off it.
      const next = new Set(ids.filter((id) => typeof id === 'string'));
      let changed = !raw;
      // Apply the default once per card. After that, checking it in Customize
      // keeps it visible, and hiding it again sticks.
      for (const id of defaultHiddenIds(sections)) {
        const flag = `${storageKey}.defaultHidden.${id}`;
        if (!window.localStorage.getItem(flag)) {
          next.add(id);
          window.localStorage.setItem(flag, '1');
          changed = true;
        }
      }
      if (changed) window.localStorage.setItem(storageKey, JSON.stringify(Array.from(next)));
      setHidden(new Set(Array.from(next).filter((id) => valid.has(id))));
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
