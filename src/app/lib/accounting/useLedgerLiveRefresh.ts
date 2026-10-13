'use client';

import { useEffect } from 'react';
import { useAccountingStore } from './store';
import { pollInterval, useLiveChanges } from '../realtime/useLiveChanges';

const LEDGER_REFRESH_MS = 15_000;

/** Reload invoices and receipts while Accounting stays open. The journal refreshes only while a desk that uses it is open. */
export function useAccountingLedgerLiveRefresh(options?: { journal?: boolean }) {
  const journal = options?.journal === true;
  const live = useLiveChanges(['JournalEntry', 'JournalEntryLine', 'AccountingInvoice', 'AccountingPayment'], () => {
    void useAccountingStore.getState().refreshLedgerFromServer({ journal });
  });
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === 'hidden') return;
      void useAccountingStore.getState().refreshLedgerFromServer({ journal });
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
  }, [live, journal]);
}
