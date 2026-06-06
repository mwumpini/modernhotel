'use client';

import React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { openMessengerFromShell } from '../lib/openMessenger';

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
      const helpKeys = e.key === 'F12' || e.key === 'F1';
      if (helpKeys) {
        if (isEditableTarget(e.target)) return;
        e.preventDefault();
        if (pathname === '/help') return;
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
