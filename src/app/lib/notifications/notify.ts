'use client';

/**
 * Call these from anywhere — plain classes/stores included, not just React
 * components — to surface a dismissible banner via <NotificationToaster />
 * (mounted once in components/Providers.tsx).
 *
 * Uses a plain `window` CustomEvent rather than shared module state (a
 * zustand store, or HeroUI's own addToast() global queue — both tried
 * first). Next.js's per-route code splitting can give a deeply-nested
 * module (e.g. frontoffice/store.ts, pulled into many different page
 * bundles) a different compiled instance than the one the root-level
 * <NotificationToaster/> subscribes to, so state added on one instance
 * never reaches the other — confirmed here: addToast() returned a real
 * key and the zustand store's own state briefly ticked to 1, yet no
 * toast ever painted except once, by chance. `window` is not subject to
 * that — it's the one true singleton no bundler can duplicate.
 */
export const APP_NOTIFY_EVENT = 'app:notify';

export interface AppNotifyDetail {
  type: 'error' | 'success';
  title?: string;
  message: string;
}

function dispatch(detail: AppNotifyDetail) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<AppNotifyDetail>(APP_NOTIFY_EVENT, { detail }));
}

export function notifyError(message: string, title?: string) {
  dispatch({ type: 'error', title: title ?? "Something didn't save", message });
}

export function notifySuccess(message: string, title?: string) {
  dispatch({ type: 'success', title, message });
}
