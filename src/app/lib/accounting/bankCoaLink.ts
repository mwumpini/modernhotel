import type { ChartOfAccounts } from './models';
import { collectDescendantIds, generateCoaCode } from './coaTree';

export const GL_CASH_IN_HAND = '1110';
export const GL_BANK_ACCOUNTS = '1120';
export const GL_CASH_EQUIVALENTS = '1100';

const CASH_BANK_HEADER_CODES = new Set(['1000', '1100']);

/** GL codes that represent cash or bank balances in journals and cash-flow reports. */
export function isBankOrCashGlCode(code: string): boolean {
  if (!code) return false;
  const c = code.trim();
  if (c === '1000' || c === GL_CASH_EQUIVALENTS || c === GL_CASH_IN_HAND || c === GL_BANK_ACCOUNTS) {
    return true;
  }
  const n = parseInt(c, 10);
  return !isNaN(n) && n >= 1121 && n <= 1199;
}

export function isPettyCashAccount(accountName?: string, bankName?: string): boolean {
  const hay = `${accountName || ''} ${bankName || ''}`.toLowerCase();
  return (
    hay.includes('petty cash') ||
    hay.includes('cash in hand') ||
    hay.includes('cash drawer') ||
    (hay.includes('cash') && !hay.includes('bank'))
  );
}

export function findCoaByCode(chart: ChartOfAccounts[], code: string): ChartOfAccounts | undefined {
  return chart.find((a) => a.code === code);
}

/** Asset accounts under Cash & Cash Equivalents (1100), excluding header-only parents. */
export function listBankGlAccounts(chart: ChartOfAccounts[]): ChartOfAccounts[] {
  const cashRoot = findCoaByCode(chart, GL_CASH_EQUIVALENTS);
  const ids = new Set<string>();

  if (cashRoot) {
    ids.add(cashRoot.id);
    for (const id of collectDescendantIds(cashRoot.id, chart)) ids.add(id);
  }

  const fallback = chart.filter(
    (a) =>
      a.isActive &&
      (a.type === 'Asset' || a.type === 'Contra') &&
      (a.code === GL_CASH_IN_HAND || a.code === GL_BANK_ACCOUNTS || isBankOrCashGlCode(a.code))
  );

  const fromTree =
    ids.size > 0
      ? chart.filter(
          (a) =>
            ids.has(a.id) &&
            a.isActive &&
            (a.type === 'Asset' || a.type === 'Contra') &&
            !CASH_BANK_HEADER_CODES.has(a.code)
        )
      : fallback;

  const seen = new Set<string>();
  return fromTree
    .filter((a) => {
      if (seen.has(a.code)) return false;
      seen.add(a.code);
      return true;
    })
    .sort((a, b) => a.code.localeCompare(b.code));
}

export function defaultGlCodeForKind(kind: 'bank' | 'petty_cash'): string {
  return kind === 'petty_cash' ? GL_CASH_IN_HAND : GL_BANK_ACCOUNTS;
}

export function generateBankSubAccountCode(chart: ChartOfAccounts[], bankParentId: string): string {
  const used = new Set(chart.map((a) => a.code));
  const siblings = chart.filter((a) => a.parentId === bankParentId);
  let max = 1120;
  for (const s of siblings) {
    const n = parseInt(s.code, 10);
    if (!isNaN(n) && n >= 1120 && n < 1200) max = Math.max(max, n);
  }
  for (let n = max + 1; n < 1200; n++) {
    const code = String(n);
    if (!used.has(code)) return code;
  }
  return generateCoaCode('Asset', chart);
}

export function resolveBankGlAccountCode(params: {
  chart: ChartOfAccounts[];
  accountName: string;
  bankName?: string;
  accountKind: 'bank' | 'petty_cash';
  createDedicatedGl: boolean;
  preferredCode?: string;
  addCoaChild: (parentId: string, params: { name: string; type: 'Asset'; code?: string }) => void;
  getChart: () => ChartOfAccounts[];
}): string {
  const trimmedName = params.accountName.trim();
  const selectable = listBankGlAccounts(params.chart);

  if (params.preferredCode) {
    const pick = selectable.find((a) => a.code === params.preferredCode);
    if (pick) return pick.code;
  }

  if (params.accountKind === 'petty_cash') {
    return findCoaByCode(params.chart, GL_CASH_IN_HAND)?.code ?? GL_CASH_IN_HAND;
  }

  const bankParent = findCoaByCode(params.chart, GL_BANK_ACCOUNTS);
  if (!bankParent) {
    return params.preferredCode || GL_BANK_ACCOUNTS;
  }

  if (trimmedName) {
    const existingChild = params.chart.find(
      (a) => a.parentId === bankParent.id && a.name.toLowerCase() === trimmedName.toLowerCase()
    );
    if (existingChild) return existingChild.code;
  }

  if (!params.createDedicatedGl || !trimmedName) {
    return params.preferredCode || GL_BANK_ACCOUNTS;
  }

  const code = generateBankSubAccountCode(params.chart, bankParent.id);
  params.addCoaChild(bankParent.id, { name: trimmedName, type: 'Asset', code });

  const refreshed = params.getChart();
  const created =
    refreshed.find((a) => a.code === code) ??
    refreshed.find(
      (a) => a.parentId === bankParent.id && a.name.toLowerCase() === trimmedName.toLowerCase()
    );

  return created?.code ?? code;
}
