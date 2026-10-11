'use client';

import { useEffect } from 'react';
import { useAccountingStore } from './store';
import { pollInterval, useLiveChanges } from '../realtime/useLiveChanges';

const LEDGER_REFRESH_MS = 15_000;

/** Reload invoices, receipts, and journal entries while Accounting stays open: at once on a save elsewhere (live updates), else every 15 seconds. */
export function useAccountingLedgerLiveRefresh() {
  const live = useLiveChanges(['JournalEntry', 'JournalEntryLine', 'AccountingInvoice', 'AccountingPayment'], () => {
    void useAccountingStore.getState().refreshLedgerFromServer();
  });
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
    const timer = window.setInterval(refresh, pollInterval(live, LEDGER_REFRESH_MS));
    return () => {
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', onVisible);
      window.clearInterval(timer);
    };
  }, [live]);
}
