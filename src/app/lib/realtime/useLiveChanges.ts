'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Live updates on the screen side: one shared Ably connection per browser tab
 * listens to this hotel's channel. When someone saves, the server sends the
 * names of the tables that changed; screens watching those tables refetch.
 * If live updates are off (no key on the server) or the connection drops,
 * screens keep their normal polling.
 */

type Listener = { models: string[]; fire: () => void };

const listeners = new Set<Listener>();
const statusListeners = new Set<(live: boolean) => void>();
let started = false;
let live = false;

function setLive(next: boolean) {
  if (live === next) return;
  live = next;
  statusListeners.forEach((fn) => fn(next));
}

function matches(watched: string[], changed: string[]) {
  return changed.some((c) => watched.some((w) => c === w || c.startsWith(`${w}:`) || (w.endsWith('*') && c.startsWith(w.slice(0, -1)))));
}

type LiveToken = { channel: string; token: string; expires?: number };

async function fetchToken(): Promise<LiveToken | null> {
  const res = await fetch('/api/realtime/token', { cache: 'no-store', credentials: 'same-origin' });
  if (res.status === 204) return null;
  if (!res.ok) throw new Error(`token ${res.status}`);
  return (await res.json()) as LiveToken;
}

function onMessage(event: MessageEvent<string>) {
  try {
    const message = JSON.parse(event.data) as { name?: string; data?: unknown; encoding?: string };
    if (message.name !== 'changed') return;
    const data = typeof message.data === 'string' ? JSON.parse(message.data) : message.data;
    const changed = ((data as { models?: unknown[] })?.models ?? []).filter((m): m is string => typeof m === 'string');
    listeners.forEach((l) => {
      if (matches(l.models, changed)) l.fire();
    });
  } catch {
    /* not a notice we understand */
  }
}

/**
 * Ably's server-sent-events endpoint: the browser's own EventSource, no SDK.
 * A dropped connection or an expiring token gets a fresh token and reconnects.
 */
async function start() {
  if (started || typeof window === 'undefined') return;
  started = true;
  let source: EventSource | null = null;
  let renewTimer: number | undefined;
  let everConnected = false;
  let failures = 0;

  const connect = async () => {
    window.clearTimeout(renewTimer);
    source?.close();
    source = null;
    let token: LiveToken | null;
    try {
      token = await fetchToken();
    } catch {
      setLive(false);
      failures += 1;
      renewTimer = window.setTimeout(connect, Math.min(60_000, 2_000 * 2 ** failures));
      return;
    }
    if (!token?.token) {
      started = false; // live updates are off on this server; screens keep polling
      return;
    }
    const url = `https://realtime.ably.io/sse?v=1.2&channels=${encodeURIComponent(token.channel)}&accessToken=${encodeURIComponent(token.token)}`;
    const es = new EventSource(url);
    source = es;
    es.onopen = () => {
      failures = 0;
      setLive(true);
      // Back after a drop: refresh everything once in case a notice was missed.
      if (everConnected) listeners.forEach((l) => l.fire());
      everConnected = true;
    };
    es.onmessage = onMessage;
    es.onerror = () => {
      setLive(false);
      if (source !== es) return;
      window.clearTimeout(renewTimer);
      es.close();
      failures += 1;
      renewTimer = window.setTimeout(connect, Math.min(60_000, 1_000 * 2 ** failures));
    };
    // Renew a few minutes before the token runs out.
    const msLeft = (token.expires ?? Date.now() + 60 * 60_000) - Date.now();
    renewTimer = window.setTimeout(connect, Math.max(60_000, msLeft - 5 * 60_000));
  };

  await connect();
}

/**
 * Run `onChange` (debounced) whenever another save touches one of `models`
 * (Prisma model names such as 'FBOrder', or 'TenantRecord:fo.' style prefixes
 * ending in '*'). Returns true while the live connection is up, so callers can
 * slow their polling down to a safety check.
 */
export function useLiveChanges(models: string[], onChange: () => void, debounceMs = 250): boolean {
  const callback = useRef(onChange);
  callback.current = onChange;
  const key = models.join('|');
  const [isLive, setIsLive] = useState(live);

  useEffect(() => {
    let timer: number | undefined;
    const listener: Listener = {
      models: key.split('|').filter(Boolean),
      fire: () => {
        window.clearTimeout(timer);
        timer = window.setTimeout(() => callback.current(), debounceMs);
      },
    };
    listeners.add(listener);
    statusListeners.add(setIsLive);
    setIsLive(live);
    void start();
    return () => {
      window.clearTimeout(timer);
      listeners.delete(listener);
      statusListeners.delete(setIsLive);
    };
  }, [key, debounceMs]);

  return isLive;
}

/** Polling interval to use: the normal one, or a slow safety check while live updates are connected. */
export function pollInterval(isLive: boolean, normalMs: number, safetyMs = 60_000) {
  return isLive ? Math.max(normalMs, safetyMs) : normalMs;
}
