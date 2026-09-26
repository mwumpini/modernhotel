'use client';

/**
 * Persistence helpers for the Accounting store (general ledger).
 *
 * Journal entries are the financial source of truth, so every entry created or
 * transitioned in the store is mirrored to the database. Writes are serialized
 * so an entry's POST always lands before any status PATCH that follows.
 */
import { getClientTenantSubdomain } from '../../api/clientTenant';
import { JournalEntry, Invoice, Payment, ChartOfAccounts, BankAccount, CostCenter, RevenueCenter, BusinessPartner, BankTransaction, AuditTrail } from '../models';

let writeQueue: Promise<unknown> = Promise.resolve();

// Returns the per-call promise (not just the shared queue) so a caller that
// needs to know the outcome of THIS specific write — e.g. whether a post
// actually landed as 'Posted' or was downgraded to 'Pending Approval' — can
// await it. The shared `writeQueue` chain still absorbs failures (via the
// trailing .then(ok, err) below) so one failed write never blocks writes
// queued after it; the raw `result` returned to the caller still rejects on
// failure so they can handle it themselves.
function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const t = getClientTenantSubdomain();
  if (typeof window === 'undefined' || !t) return Promise.reject(new Error('No tenant context'));
  const result = writeQueue.then(fn);
  writeQueue = result.then(
    () => undefined,
    (e) => { console.warn('Accounting: persist failed', e); },
  );
  return result;
}

const headers = (t: string) => ({
  'Content-Type': 'application/json',
  'x-tenant-subdomain': t,
});

export function persistJournalEntry(entry: JournalEntry) {
  const t = getClientTenantSubdomain();
  if (!t) return;
  enqueue(async () => {
    const res = await fetch('/api/accounting/journal-entries', {
      method: 'POST',
      headers: headers(t),
      body: JSON.stringify(entry),
    });
    if (!res.ok) throw new Error('POST journal entry failed');
  });
}

/**
 * Returns the server's actual resulting entry once the PATCH lands (or null
 * if the tenant context is missing) — the server may silently downgrade a
 * 'Posted' request to 'Pending Approval' (see approvalThresholds.ts), so a
 * caller that applied 'Posted' optimistically must await this and check the
 * real status before treating the post as genuine (e.g. before applying GL
 * balance changes) — see postJournalEntry in ../store.ts.
 */
export function persistJournalEntryStatus(
  id: string,
  patch: { status?: string; postedBy?: string; postedAt?: string },
): Promise<{ status: string } | null> {
  const t = getClientTenantSubdomain();
  if (!t) return Promise.resolve(null);
  return enqueue(async () => {
    const res = await fetch(`/api/accounting/journal-entries/${id}`, {
      method: 'PATCH',
      headers: headers(t),
      body: JSON.stringify(patch),
    });
    if (!res.ok) throw new Error('PATCH journal entry failed');
    const data = await res.json().catch(() => null);
    return data?.journalEntry ?? null;
  });
}

export async function fetchJournalEntries(): Promise<JournalEntry[] | null> {
  const t = getClientTenantSubdomain();
  if (typeof window === 'undefined' || !t) return null;
  try {
    const res = await fetch('/api/accounting/journal-entries', {
      headers: { 'x-tenant-subdomain': t },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return Array.isArray(data.journalEntries) ? data.journalEntries : null;
  } catch (e) {
    console.warn('Accounting: journal entry hydration failed', e);
    return null;
  }
}

export async function fetchAccountingAuditTrail(): Promise<AuditTrail[] | null> {
  const t = getClientTenantSubdomain();
  if (typeof window === 'undefined' || !t) return null;
  try {
    const res = await fetch('/api/accounting/audit-trail', {
      headers: { 'x-tenant-subdomain': t },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return Array.isArray(data.auditTrail) ? data.auditTrail : null;
  } catch (e) {
    console.warn('Accounting: audit trail hydration failed', e);
    return null;
  }
}

// --- AR/AP sub-ledger: invoices --------------------------------------------

export function persistInvoice(invoice: Invoice) {
  const t = getClientTenantSubdomain();
  if (!t) return;
  enqueue(async () => {
    const res = await fetch('/api/accounting/invoices', {
      method: 'POST',
      headers: headers(t),
      body: JSON.stringify(invoice),
    });
    if (!res.ok) throw new Error('POST invoice failed');
  });
}

export function persistInvoicePatch(id: string, patch: Partial<Invoice>) {
  const t = getClientTenantSubdomain();
  if (!t) return;
  enqueue(async () => {
    const res = await fetch(`/api/accounting/invoices/${id}`, {
      method: 'PATCH',
      headers: headers(t),
      body: JSON.stringify(patch),
    });
    if (!res.ok) throw new Error('PATCH invoice failed');
  });
}

export function persistInvoiceDelete(id: string) {
  const t = getClientTenantSubdomain();
  if (!t) return;
  enqueue(async () => {
    const res = await fetch(`/api/accounting/invoices/${id}`, {
      method: 'DELETE',
      headers: headers(t),
    });
    if (!res.ok && res.status !== 404) throw new Error('DELETE invoice failed');
  });
}

export async function fetchInvoices(): Promise<Invoice[] | null> {
  const t = getClientTenantSubdomain();
  if (typeof window === 'undefined' || !t) return null;
  try {
    const res = await fetch('/api/accounting/invoices', {
      headers: { 'x-tenant-subdomain': t },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return Array.isArray(data.invoices) ? data.invoices : null;
  } catch (e) {
    console.warn('Accounting: invoice hydration failed', e);
    return null;
  }
}

// --- AR/AP sub-ledger: payments --------------------------------------------

export function persistPayment(payment: Payment) {
  const t = getClientTenantSubdomain();
  if (!t) return;
  enqueue(async () => {
    const res = await fetch('/api/accounting/payments', {
      method: 'POST',
      headers: headers(t),
      body: JSON.stringify(payment),
    });
    if (!res.ok) throw new Error('POST payment failed');
  });
}

/**
 * Returns the server's actual resulting payment once the PATCH lands (or null
 * if the tenant context is missing) — the server may silently downgrade a
 * 'Posted' request to 'Pending Approval' (see approvalThresholds.ts); see
 * persistJournalEntryStatus above for why a caller must await this before
 * treating the post as genuine (e.g. before syncing to the ledger).
 */
export function persistPaymentPatch(
  id: string,
  patch: Partial<Payment>,
): Promise<{ status: string } | null> {
  const t = getClientTenantSubdomain();
  if (!t) return Promise.resolve(null);
  return enqueue(async () => {
    const res = await fetch(`/api/accounting/payments/${id}`, {
      method: 'PATCH',
      headers: headers(t),
      body: JSON.stringify(patch),
    });
    if (!res.ok) throw new Error('PATCH payment failed');
    const data = await res.json().catch(() => null);
    return data?.payment ?? null;
  });
}

export async function fetchPayments(): Promise<Payment[] | null> {
  const t = getClientTenantSubdomain();
  if (typeof window === 'undefined' || !t) return null;
  try {
    const res = await fetch('/api/accounting/payments', {
      headers: { 'x-tenant-subdomain': t },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return Array.isArray(data.payments) ? data.payments : null;
  } catch (e) {
    console.warn('Accounting: payment hydration failed', e);
    return null;
  }
}

// --- Chart of accounts -------------------------------------------------------
// Was previously in-memory only — every add/rename/delete was gone on refresh.

/** `parentCode` — the parent's `code`, not its id. A code is the only identifier
 *  guaranteed to match the DB row across seeding paths; see repository.ts's
 *  upsertChartOfAccount for why the client's parentId can't be trusted directly. */
export function persistChartOfAccount(account: ChartOfAccounts, parentCode: string | null) {
  const t = getClientTenantSubdomain();
  if (!t) return;
  enqueue(async () => {
    const res = await fetch('/api/accounting/chart-of-accounts', {
      method: 'POST',
      headers: headers(t),
      body: JSON.stringify({ ...account, parentCode }),
    });
    if (!res.ok) throw new Error('POST chart-of-accounts entry failed');
  });
}

/** First-visit seed only — persists the prebuilt chart the client already showed. */
export function persistChartOfAccountsBulk(accounts: ChartOfAccounts[]) {
  const t = getClientTenantSubdomain();
  if (!t || accounts.length === 0) return;
  enqueue(async () => {
    const res = await fetch('/api/accounting/chart-of-accounts', {
      method: 'POST',
      headers: headers(t),
      body: JSON.stringify({ accounts }),
    });
    if (!res.ok) throw new Error('POST chart-of-accounts bulk seed failed');
  });
}

export function persistChartOfAccountDelete(id: string) {
  const t = getClientTenantSubdomain();
  if (!t) return;
  enqueue(async () => {
    const res = await fetch(`/api/accounting/chart-of-accounts?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: headers(t),
    });
    if (!res.ok && res.status !== 404) throw new Error('DELETE chart-of-accounts entry failed');
  });
}

export async function fetchChartOfAccounts(): Promise<ChartOfAccounts[] | null> {
  const t = getClientTenantSubdomain();
  if (typeof window === 'undefined' || !t) return null;
  try {
    const res = await fetch('/api/accounting/chart-of-accounts', {
      headers: { 'x-tenant-subdomain': t },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return Array.isArray(data.accounts) ? data.accounts : null;
  } catch (e) {
    console.warn('Accounting: chart-of-accounts hydration failed', e);
    return null;
  }
}

// --- Bank & cash accounts -----------------------------------------------------
// Same previously-in-memory-only gap as chart of accounts.

export function persistBankAccount(account: BankAccount) {
  const t = getClientTenantSubdomain();
  if (!t) return;
  enqueue(async () => {
    const res = await fetch('/api/accounting/bank-accounts', {
      method: 'POST',
      headers: headers(t),
      body: JSON.stringify(account),
    });
    if (!res.ok) throw new Error('POST bank account failed');
  });
}

export function persistBankAccountDelete(id: string) {
  const t = getClientTenantSubdomain();
  if (!t) return;
  enqueue(async () => {
    const res = await fetch(`/api/accounting/bank-accounts?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: headers(t),
    });
    if (!res.ok && res.status !== 404) throw new Error('DELETE bank account failed');
  });
}

export async function fetchBankAccounts(): Promise<BankAccount[] | null> {
  const t = getClientTenantSubdomain();
  if (typeof window === 'undefined' || !t) return null;
  try {
    const res = await fetch('/api/accounting/bank-accounts', {
      headers: { 'x-tenant-subdomain': t },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return Array.isArray(data.bankAccounts) ? data.bankAccounts : null;
  } catch (e) {
    console.warn('Accounting: bank account hydration failed', e);
    return null;
  }
}

// --- Cost & revenue centers ---------------------------------------------------
// Same previously-in-memory-only gap as chart of accounts / bank accounts.

export function persistCostCenter(center: CostCenter) {
  const t = getClientTenantSubdomain();
  if (!t) return;
  enqueue(async () => {
    const res = await fetch('/api/accounting/cost-centers', {
      method: 'POST',
      headers: headers(t),
      body: JSON.stringify(center),
    });
    if (!res.ok) throw new Error('POST cost center failed');
  });
}

export function persistCostCenterDelete(id: string) {
  const t = getClientTenantSubdomain();
  if (!t) return;
  enqueue(async () => {
    const res = await fetch(`/api/accounting/cost-centers?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: headers(t),
    });
    if (!res.ok && res.status !== 404) throw new Error('DELETE cost center failed');
  });
}

export async function fetchCostCenters(): Promise<CostCenter[] | null> {
  const t = getClientTenantSubdomain();
  if (typeof window === 'undefined' || !t) return null;
  try {
    const res = await fetch('/api/accounting/cost-centers', {
      headers: { 'x-tenant-subdomain': t },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return Array.isArray(data.costCenters) ? data.costCenters : null;
  } catch (e) {
    console.warn('Accounting: cost center hydration failed', e);
    return null;
  }
}

export function persistRevenueCenter(center: RevenueCenter) {
  const t = getClientTenantSubdomain();
  if (!t) return;
  enqueue(async () => {
    const res = await fetch('/api/accounting/revenue-centers', {
      method: 'POST',
      headers: headers(t),
      body: JSON.stringify(center),
    });
    if (!res.ok) throw new Error('POST revenue center failed');
  });
}

export function persistRevenueCenterDelete(id: string) {
  const t = getClientTenantSubdomain();
  if (!t) return;
  enqueue(async () => {
    const res = await fetch(`/api/accounting/revenue-centers?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: headers(t),
    });
    if (!res.ok && res.status !== 404) throw new Error('DELETE revenue center failed');
  });
}

export async function fetchRevenueCenters(): Promise<RevenueCenter[] | null> {
  const t = getClientTenantSubdomain();
  if (typeof window === 'undefined' || !t) return null;
  try {
    const res = await fetch('/api/accounting/revenue-centers', {
      headers: { 'x-tenant-subdomain': t },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return Array.isArray(data.revenueCenters) ? data.revenueCenters : null;
  } catch (e) {
    console.warn('Accounting: revenue center hydration failed', e);
    return null;
  }
}

// --- Business partners (customers/suppliers) -----------------------------------
// Same previously-in-memory-only gap as chart of accounts / bank accounts.

export function persistBusinessPartner(partner: BusinessPartner) {
  const t = getClientTenantSubdomain();
  if (!t) return;
  enqueue(async () => {
    const res = await fetch('/api/accounting/business-partners', {
      method: 'POST',
      headers: headers(t),
      body: JSON.stringify(partner),
    });
    if (!res.ok) throw new Error('POST business partner failed');
  });
}

export function persistBusinessPartnerDelete(id: string) {
  const t = getClientTenantSubdomain();
  if (!t) return;
  enqueue(async () => {
    const res = await fetch(`/api/accounting/business-partners?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: headers(t),
    });
    if (!res.ok && res.status !== 404) throw new Error('DELETE business partner failed');
  });
}

export async function fetchBusinessPartners(): Promise<BusinessPartner[] | null> {
  const t = getClientTenantSubdomain();
  if (typeof window === 'undefined' || !t) return null;
  try {
    const res = await fetch('/api/accounting/business-partners', {
      headers: { 'x-tenant-subdomain': t },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return Array.isArray(data.partners) ? data.partners : null;
  } catch (e) {
    console.warn('Accounting: business partner hydration failed', e);
    return null;
  }
}

// --- Bank ledger transactions ----------------------------------------------------
// Base rows are re-derivable from journal entries, but manual entries and cleared/
// reconciled status are not — same previously-in-memory-only gap as elsewhere.

export function persistBankTransaction(txn: BankTransaction) {
  const t = getClientTenantSubdomain();
  if (!t) return;
  enqueue(async () => {
    const res = await fetch('/api/accounting/bank-transactions', {
      method: 'POST',
      headers: headers(t),
      body: JSON.stringify(txn),
    });
    if (!res.ok) throw new Error('POST bank transaction failed');
  });
}

export function persistBankTransactionDelete(id: string) {
  const t = getClientTenantSubdomain();
  if (!t) return;
  enqueue(async () => {
    const res = await fetch(`/api/accounting/bank-transactions?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: headers(t),
    });
    if (!res.ok && res.status !== 404) throw new Error('DELETE bank transaction failed');
  });
}

export async function fetchBankTransactions(): Promise<BankTransaction[] | null> {
  const t = getClientTenantSubdomain();
  if (typeof window === 'undefined' || !t) return null;
  try {
    const res = await fetch('/api/accounting/bank-transactions', {
      headers: { 'x-tenant-subdomain': t },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return Array.isArray(data.transactions) ? data.transactions : null;
  } catch (e) {
    console.warn('Accounting: bank transaction hydration failed', e);
    return null;
  }
}
