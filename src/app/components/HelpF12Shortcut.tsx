'use client';

import React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { openMessengerFromShell, requestAskMamani } from '../lib/openMessenger';

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  return target.isContentEditable;
}

export default function HelpF12Shortcut() {
  const router = useRouter();
  const pathname = usePathname();

  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const ctrlShift = e.ctrlKey && e.shiftKey && !e.altKey && !e.metaKey;
      const ctrlOnly = e.ctrlKey && !e.shiftKey && !e.altKey && !e.metaKey;
      // Sign out: Ctrl+L when not typing in a field (so a habit press can't lose a half-filled
      // form), Ctrl+Shift+L from anywhere (a waiter handing over the POS).
      const signOutKeys =
        e.key.toLowerCase() === 'l' && (ctrlShift || (ctrlOnly && !isEditableTarget(e.target)));
      if (signOutKeys) {
        e.preventDefault();
        try { sessionStorage.removeItem('session.lastActivity'); } catch {}
        void signOut({ callbackUrl: '/' });
        return;
      }
      // Ctrl+Shift+H opens the Help page (F1 opens the desk assistant when there is one).
      if (ctrlShift && e.key.toLowerCase() === 'h') {
        e.preventDefault();
        if (pathname !== '/help') router.push('/help');
        return;
      }
      const helpKeys = e.key === 'F12' || e.key === 'F1';
      if (helpKeys) {
        if (isEditableTarget(e.target)) return;
        e.preventDefault();
        if (pathname === '/help') return;
        if (requestAskMamani()) return;
        router.push('/help');
        return;
      }

      if (e.ctrlKey && !e.metaKey && !e.altKey && e.key.toLowerCase() === 'm') {
        if (isEditableTarget(e.target)) return;
        e.preventDefault();
        openMessengerFromShell(router, pathname);
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [pathname, router]);

  return null;
}
