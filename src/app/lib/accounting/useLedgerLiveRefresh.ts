'use client';

import { useEffect } from 'react';
import { useAccountingStore } from './store';

const LEDGER_REFRESH_MS = 15_000;

/** Reload invoices, receipts, and journal entries while Accounting stays open. */
export function useAccountingLedgerLiveRefresh() {
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === 'hidden') return;
      void useAccountingStore.getState().refreshLedgerFromServer();
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', onVisible);
    const timer = window.setInterval(refresh, LEDGER_REFRESH_MS);
    return () => {
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', onVisible);
      window.clearInterval(timer);
    };
  }, []);
}
