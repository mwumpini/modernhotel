'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { 
  Card, CardBody, CardHeader, Button, Input, Select, SelectItem,
  Table, TableHeader, TableColumn, TableBody, TableRow, TableCell,
  Chip, Tabs, Tab, Divider, Spinner, Dropdown, DropdownTrigger, DropdownMenu, DropdownItem,
  Checkbox, RadioGroup, Radio
} from "@heroui/react";
import { toRollupCoa } from '@/app/lib/accounting/coaHierarchy';
import { useAccountingStore } from '@/app/lib/accounting/store';
import { GHANA_CHART_OF_ACCOUNTS } from '@/app/lib/accounting/models';
import {
  buildFinancialAccountTree,
  computeCashFlowFromJournals,
  computeTrialBalanceCheckTotals,
  findUnmappedGlCodes,
  findNonLeafPostings,
  type AccountNode,
  type RollupCoa,
} from '@/app/lib/accounting/financialReportRollup';
import { buildStatementOfChangesInEquity } from '@/app/lib/accounting/statementOfChangesInEquity';
import {
  buildProfitLossCloseEntry,
  hasPeriodCloseForDate,
  RETAINED_EARNINGS_GL,
} from '@/app/lib/accounting/periodClose';
import { logAccountingProcess } from '@/app/lib/accounting/accountingProcessLog';
import { accountingAmountsLabel } from '@/app/lib/accounting/tenantAccountingConfig';
import { downloadCSV, openPrintPreview } from '@/app/lib/accounting/helpers/exportHelpers';
import { unifiedTableClassNames } from '../frontoffice/columnResize';
import { deskBookTabsClassNames } from './DeskKpiStrip';

const reportTableClassNamesBase = {
  ...unifiedTableClassNames,
  base: 'max-w-full overflow-x-auto',
  table: 'w-full min-w-max',
};

/** Desk chrome for hierarchical statement tables (no sort/resize/pagination). */
const reportTableClassNames = {
  ...reportTableClassNamesBase,
  th: `${unifiedTableClassNames.th} bg-slate-50 text-gray-600`,
};

const reportTableClassNamesNested = {
  ...reportTableClassNamesBase,
  th: `${unifiedTableClassNames.th} bg-white text-gray-500`,
};

const trialBalanceReportTableClassNames = {
  ...reportTableClassNamesBase,
  th: `${unifiedTableClassNames.th} bg-slate-100 text-gray-600 font-semibold`,
};

type PeriodType = 'custom' | 'month' | 'quarter' | 'year' | 'ytd';
type ReportFormat = 'summary' | 'detailed';

// ==================== HELPERS ====================
// Statement columns are plain numbers. The currency is named once in the heading.
// Zero amounts collapse to a dash, negatives render in parentheses.
const formatPlainAmount = (amount: number) =>
  Math.abs(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const formatCurrency = (amount: number, showZero = false) => {
  if (!showZero && Math.abs(amount) < 0.01) return '-';
  return formatPlainAmount(amount);
};

const formatCurrencyWithSign = (amount: number, showZero = false) => {
  if (!showZero && Math.abs(amount) < 0.01) return '-';
  const sign = amount < 0 ? '(' : '';
  const end = amount < 0 ? ')' : '';
  return `${sign}${formatPlainAmount(amount)}${end}`;
};

/** Calendar date in the browser's timezone. toISOString() shifts local midnight to the previous day east of UTC. */
const formatLocalIsoDate = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const roundMoney = (amount: number) => Math.round((amount + Number.EPSILON) * 100) / 100;

const formatDrCr = (debit: number, credit: number) => {
  const parts: string[] = [];
  if (debit > 0.005) parts.push(`Dr ${formatCurrency(debit, true)}`);
  if (credit > 0.005) parts.push(`Cr ${formatCurrency(credit, true)}`);
  return parts.join(' · ') || '—';
};

/** Amount posted on this account itself, excluding what its children already show. */
const directPosting = (node: AccountNode) => {
  let childDebit = 0;
  let childCredit = 0;
  let childBalance = 0;
  for (const child of node.children) {
    childDebit += child.debit;
    childCredit += child.credit;
    childBalance += child.balance;
  }
  return {
    debit: node.debit - childDebit,
    credit: node.credit - childCredit,
    balance: node.balance - childBalance,
  };
};

/** Net debit / net credit columns. A parent that is expanded must not be included — its children already are. */
const addNetColumns = (into: { debit: number; credit: number }, debit: number, credit: number) => {
  const net = debit - credit;
  if (net > 0.005) into.debit += net;
  else if (net < -0.005) into.credit += -net;
};

// Get period dates helper
const getPeriodDates = (periodType: PeriodType, selectedMonth: string, selectedQuarter: string, selectedYear: string, customFrom: string, customTo: string) => {
  const now = new Date();
  let startDate: Date;
  let endDate: Date;

  switch (periodType) {
    case 'month':
      const [monthYear, month] = selectedMonth.split('-').map(Number);
      startDate = new Date(monthYear || now.getFullYear(), (month || now.getMonth() + 1) - 1, 1);
      endDate = new Date(monthYear || now.getFullYear(), month || now.getMonth() + 1, 0);
      break;
    case 'quarter':
      const qYear = parseInt(selectedYear) || now.getFullYear();
      const qNum = parseInt(selectedQuarter?.replace('Q', '') || '1');
      startDate = new Date(qYear, (qNum - 1) * 3, 1);
      endDate = new Date(qYear, qNum * 3, 0);
      break;
    case 'year':
      const year = parseInt(selectedYear) || now.getFullYear();
      startDate = new Date(year, 0, 1);
      endDate = new Date(year, 11, 31);
      break;
    case 'ytd':
      startDate = new Date(now.getFullYear(), 0, 1);
      endDate = now;
      break;
    case 'custom':
    default:
      startDate = customFrom ? new Date(customFrom) : new Date(now.getFullYear(), 0, 1);
      endDate = customTo ? new Date(customTo) : now;
  }

  return { startDate, endDate };
};

// Generate PDF HTML for printing - Professional accounting style
const generateReportHTML = (title: string, period: string, content: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <style>
    @page { size: A4; margin: 15mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Times New Roman', Georgia, serif; font-size: 11px; color: #000; line-height: 1.4; }
    .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 15px; margin-bottom: 20px; }
    .header h1 { font-size: 18px; font-weight: bold; margin-bottom: 5px; text-transform: uppercase; letter-spacing: 1px; }
    .header h2 { font-size: 14px; font-weight: normal; margin-bottom: 3px; }
    .header p { font-size: 11px; color: #444; }
    .section { margin-bottom: 20px; }
    .section-title { font-size: 12px; font-weight: bold; border-bottom: 1px solid #999; padding-bottom: 5px; margin-bottom: 10px; text-transform: uppercase; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
    th { background: #f5f5f5; padding: 8px 6px; text-align: left; font-weight: bold; font-size: 10px; text-transform: uppercase; border-bottom: 2px solid #000; }
    td { padding: 5px 6px; border-bottom: 1px solid #ddd; }
    .text-right { text-align: right; }
    .font-bold { font-weight: bold; }
    .font-mono { font-family: 'Courier New', monospace; font-size: 10px; }
    .total-row { background: #e8e8e8; font-weight: bold; }
    .total-row td { border-top: 2px solid #000; border-bottom: 2px solid #000; }
    .subtotal-row { background: #f5f5f5; font-weight: 600; }
    .level-1 { font-weight: bold; }
    .level-2 { padding-left: 20px; }
    .level-3 { padding-left: 40px; }
    .underline { border-bottom: 1px solid #000; }
    .double-underline { border-bottom: 3px double #000; }
    .footer { margin-top: 30px; padding-top: 15px; border-top: 1px solid #999; font-size: 9px; color: #666; display: flex; justify-content: space-between; }
    @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>${title}</h1>
    <p>${period}</p>
    <p>${accountingAmountsLabel()}</p>
  </div>
  ${content}
  <div class="footer">
    <span>Generated: ${new Date().toLocaleString()}</span>
    <span>Page 1</span>
  </div>
</body>
</html>
`;

// ==================== MAIN COMPONENT ====================
export default function FinancialReportsPage() {
  const {
    chartOfAccounts,
    journalEntries,
    initializeAccounting,
    isLoading,
    addJournalEntry,
    addAuditTrail,
  } = useAccountingStore();

  // ==================== STATE ====================
  const [selectedTab, setSelectedTab] = useState("overview");
  const [closeAsOfDate, setCloseAsOfDate] = useState('');
  const [closeDateEdited, setCloseDateEdited] = useState(false);
  const [closeMessage, setCloseMessage] = useState<string | null>(null);
  const [closeBusy, setCloseBusy] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Period Selection
  const [periodType, setPeriodType] = useState<PeriodType>('ytd');
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [selectedQuarter, setSelectedQuarter] = useState(() => `Q${Math.floor(new Date().getMonth() / 3) + 1}`);
  const [selectedYear, setSelectedYear] = useState(() => String(new Date().getFullYear()));
  const [customDateFrom, setCustomDateFrom] = useState('');
  const [customDateTo, setCustomDateTo] = useState('');
  
  // Report Options
  const [reportFormat, setReportFormat] = useState<ReportFormat>('detailed');
  const [showZeroBalances, setShowZeroBalances] = useState(false);
  // Balance Sheet presentation: 'report' (Assets, then Liabilities, then Equity, stacked in
  // one column — the modern default) vs 'account' (Assets left, Liabilities & Equity right,
  // side by side — the classic "T" ledger form).
  const [balanceSheetForm, setBalanceSheetForm] = useState<'report' | 'account'>('report');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['all']));
  // Comparative statements (Income Statement / Balance Sheet only) — same period one year
  // earlier, side by side with the current column. Off by default: most day-to-day report
  // pulls don't need it, and a second tree walk is wasted work when nobody's looking at it.
  const [compareWithPriorYear, setCompareWithPriorYear] = useState(false);

  // Initialize
  useEffect(() => {
    initializeAccounting();
  }, [initializeAccounting]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await initializeAccounting();
    setTimeout(() => setIsRefreshing(false), 500);
  }, [initializeAccounting]);

  // 'all' means every section is open (Detailed). An individual click has to
  // drop that flag, otherwise the triangle can never close one section.
  const isSectionExpanded = useCallback(
    (code: string) => expandedSections.has('all') || expandedSections.has(code),
    [expandedSections]
  );

  // ==================== PERIOD CALCULATIONS ====================
  const { startDate, endDate } = useMemo(() =>
    getPeriodDates(periodType, selectedMonth, selectedQuarter, selectedYear, customDateFrom, customDateTo),
    [periodType, selectedMonth, selectedQuarter, selectedYear, customDateFrom, customDateTo]
  );

  // Prior-year comparison: same period/as-at date, shifted back exactly one year — the
  // conventional "vs last year" comparative column.
  const priorStartDate = useMemo(() => {
    const d = new Date(startDate);
    d.setFullYear(d.getFullYear() - 1);
    return d;
  }, [startDate]);

  const priorEndDate = useMemo(() => {
    const d = new Date(endDate);
    d.setFullYear(d.getFullYear() - 1);
    return d;
  }, [endDate]);

  const periodRangeLabel = useMemo(() => {
    const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };
    return `${startDate.toLocaleDateString('en-GB', options)} – ${endDate.toLocaleDateString('en-GB', options)}`;
  }, [startDate, endDate]);

  const periodLabel = useMemo(() => {
    if (periodType === 'month') {
      return startDate.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    }
    if (periodType === 'quarter') {
      return `${selectedQuarter} ${selectedYear}`;
    }
    if (periodType === 'year') {
      return `Year ended 31 December ${selectedYear}`;
    }
    if (periodType === 'ytd') {
      return `Year to Date — ${periodRangeLabel}`;
    }
    return periodRangeLabel;
  }, [periodType, startDate, endDate, selectedQuarter, selectedYear, periodRangeLabel]);

  // Short year labels for comparison column headers — "2026" vs "2025", or "2025–2026" for a
  // range that itself spans a year boundary (e.g. a custom period).
  const yearSpanLabel = (from: Date, to: Date) =>
    from.getFullYear() === to.getFullYear() ? `${to.getFullYear()}` : `${from.getFullYear()}–${to.getFullYear()}`;
  const incomeStatementColumnLabels = useMemo(
    () => ({ current: yearSpanLabel(startDate, endDate), prior: yearSpanLabel(priorStartDate, priorEndDate) }),
    [startDate, endDate, priorStartDate, priorEndDate]
  );
  const balanceSheetColumnLabels = useMemo(
    () => ({ current: `${endDate.getFullYear()}`, prior: `${priorEndDate.getFullYear()}` }),
    [endDate, priorEndDate]
  );

  // ==================== COA + ROLL-UPS (IFRS-style) ====================
  /** Profit or loss: movement in selected period. Statement of financial position: cumulative through reporting date. */
  const rollupCoa: RollupCoa[] = useMemo(() => {
    const raw = chartOfAccounts.length > 0 ? chartOfAccounts : GHANA_CHART_OF_ACCOUNTS;
    return toRollupCoa(raw);
  }, [chartOfAccounts]);

  // Expand = Detailed (full account-by-account breakdown), Collapse = Summary
  // (top-level category totals only) — the two controls drive the same
  // underlying expandedSections state, so each stays in sync with the other.
  const expandAll = () => {
    setExpandedSections(new Set(['all', ...rollupCoa.map((a) => a.code)]));
    setReportFormat('detailed');
  };
  const collapseAll = () => {
    setExpandedSections(new Set());
    setReportFormat('summary');
  };

  const toggleSection = useCallback((sectionKey: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has('all')) {
        for (const account of rollupCoa) next.add(account.code);
        next.delete('all');
        next.delete(sectionKey);
        return next;
      }
      if (next.has(sectionKey)) next.delete(sectionKey);
      else next.add(sectionKey);
      return next;
    });
  }, [rollupCoa]);

  const yearOptions = useMemo(() => {
    const current = new Date().getFullYear();
    const from = Math.min(2024, current);
    const to = current + 1;
    return Array.from({ length: to - from + 1 }, (_, i) => from + i);
  }, []);

  const accountTreePeriod = useMemo(
    () => buildFinancialAccountTree(rollupCoa, journalEntries, { kind: 'period', startDate, endDate }),
    [rollupCoa, journalEntries, startDate, endDate]
  );

  const accountTreeCumulative = useMemo(
    () => buildFinancialAccountTree(rollupCoa, journalEntries, { kind: 'cumulative', endDate }),
    [rollupCoa, journalEntries, endDate]
  );

  // Only built when the toggle is on; an idle second tree walk on every render would be
  // wasted cost for the common case.
  const accountTreePeriodPrior = useMemo(
    () => compareWithPriorYear ? buildFinancialAccountTree(rollupCoa, journalEntries, { kind: 'period', startDate: priorStartDate, endDate: priorEndDate }) : [],
    [compareWithPriorYear, rollupCoa, journalEntries, priorStartDate, priorEndDate]
  );

  const accountTreeCumulativePrior = useMemo(
    () => compareWithPriorYear ? buildFinancialAccountTree(rollupCoa, journalEntries, { kind: 'cumulative', endDate: priorEndDate }) : [],
    [compareWithPriorYear, rollupCoa, journalEntries, priorEndDate]
  );

  const getAccountsByType = useCallback((tree: AccountNode[], type: string) => tree.filter((node) => node.type === type), []);

  // Posted journal lines pointing at a GL code that isn't in the current Chart of
  // Accounts — invisible in every rollup above, and the most common reason the
  // Balance Check below shows a difference with no obvious cause.
  const unmappedGlCodes = useMemo(
    () => findUnmappedGlCodes(rollupCoa, journalEntries),
    [rollupCoa, journalEntries]
  );

  // Posted lines that hit a category header account directly instead of one of its postable
  // leaves — the other common, previously-silent cause of a Balance Check gap alongside an
  // unmapped code (see findNonLeafPostings for why this breaks the parent/child hierarchy).
  const nonLeafPostings = useMemo(
    () => findNonLeafPostings(rollupCoa, journalEntries),
    [rollupCoa, journalEntries]
  );

  const assetAccounts = useMemo(() => getAccountsByType(accountTreeCumulative, 'Asset'), [accountTreeCumulative, getAccountsByType]);
  const liabilityAccounts = useMemo(() => getAccountsByType(accountTreeCumulative, 'Liability'), [accountTreeCumulative, getAccountsByType]);
  const equityAccounts = useMemo(() => getAccountsByType(accountTreeCumulative, 'Equity'), [accountTreeCumulative, getAccountsByType]);
  const revenueAccounts = useMemo(() => getAccountsByType(accountTreePeriod, 'Revenue'), [accountTreePeriod, getAccountsByType]);
  const expenseAccounts = useMemo(() => getAccountsByType(accountTreePeriod, 'Expense'), [accountTreePeriod, getAccountsByType]);

  const assetAccountsPrior = useMemo(() => getAccountsByType(accountTreeCumulativePrior, 'Asset'), [accountTreeCumulativePrior, getAccountsByType]);
  const liabilityAccountsPrior = useMemo(() => getAccountsByType(accountTreeCumulativePrior, 'Liability'), [accountTreeCumulativePrior, getAccountsByType]);
  const equityAccountsPrior = useMemo(() => getAccountsByType(accountTreeCumulativePrior, 'Equity'), [accountTreeCumulativePrior, getAccountsByType]);
  const revenueAccountsPrior = useMemo(() => getAccountsByType(accountTreePeriodPrior, 'Revenue'), [accountTreePeriodPrior, getAccountsByType]);
  const expenseAccountsPrior = useMemo(() => getAccountsByType(accountTreePeriodPrior, 'Expense'), [accountTreePeriodPrior, getAccountsByType]);

  // Income Statement flat list (revenue then expense), same shape/purpose as
  // trialBalanceRows: one source feeds the CSV export and the print preview, so
  // neither one can show a different set of rows — or silently stop at a
  // shallower depth — than what renderAccountRows draws on screen. (Revenue and
  // Expense accounts run 3 levels deep in this chart, e.g. 5000 -> 5200 -> 5210 —
  // a hand-rolled 2-level-only renderer here previously dropped that 3rd level.)
  // Heading rows (an expanded parent) carry a null amount so a total of the export
  // matches the lines a reader can add on screen. The parent's own postings, if any,
  // are a separate "posted directly" line.
  const flattenStatement = useCallback((
    nodes: AccountNode[],
    section: string,
    level = 0,
    rows: Array<{ section: string; code: string; name: string; level: number; amount: number | null; heading: boolean }> = []
  ) => {
    nodes.forEach((node) => {
      const hasBalance = Math.abs(node.balance) > 0.01;
      const hasChildren = node.children.length > 0;
      if (!showZeroBalances && !hasBalance && !hasChildren) return;
      const open = hasChildren && isSectionExpanded(node.code);
      if (!open) {
        rows.push({ section, code: node.code, name: node.name, level, amount: node.balance, heading: false });
        return;
      }
      rows.push({ section, code: node.code, name: node.name, level, amount: null, heading: true });
      const direct = directPosting(node);
      if (Math.abs(direct.balance) > 0.01) {
        rows.push({
          section,
          code: node.code,
          name: 'Posted directly to this account',
          level: level + 1,
          amount: direct.balance,
          heading: false,
        });
      }
      flattenStatement(node.children, section, level + 1, rows);
    });
    return rows;
  }, [showZeroBalances, isSectionExpanded]);

  const incomeStatementRows = useMemo(
    () => [...flattenStatement(revenueAccounts, 'Revenue'), ...flattenStatement(expenseAccounts, 'Expense')],
    [flattenStatement, revenueAccounts, expenseAccounts]
  );

  const cashFlow = useMemo(
    () => computeCashFlowFromJournals(journalEntries, startDate, endDate, rollupCoa),
    [journalEntries, startDate, endDate, rollupCoa]
  );

  // ==================== CALCULATIONS ====================
  const totals = useMemo(() => {
    const sumBalance = (nodes: AccountNode[]): number => nodes.reduce((s, n) => s + n.balance, 0);

    const totalAssets = sumBalance(assetAccounts);
    const totalLiabilities = sumBalance(liabilityAccounts);
    const totalEquityLedger = sumBalance(equityAccounts);
    const totalRevenue = sumBalance(revenueAccounts);
    const totalExpenses = sumBalance(expenseAccounts);
    const netIncome = roundMoney(totalRevenue - totalExpenses);

    // Unclosed profit is the revenue and expense still sitting on the P&L accounts
    // through the reporting date (cumulative, not just the selected period). Equity
    // on the statement is that figure plus the equity accounts. Anything left over
    // — usually a code that is not on the chart — is unexplainedDifference, and the
    // balance sheet is allowed to show it instead of forcing Assets = Liabilities + Equity.
    const cumulativeRevenue = sumBalance(accountTreeCumulative.filter((n) => n.type === 'Revenue'));
    const cumulativeExpenses = sumBalance(accountTreeCumulative.filter((n) => n.type === 'Expense'));
    const unclosedProfit = roundMoney(cumulativeRevenue - cumulativeExpenses);
    const totalEquity = roundMoney(totalEquityLedger + unclosedProfit);
    const unexplainedDifference = roundMoney(totalAssets - totalLiabilities - totalEquity);
    const totalLiabAndEquity = roundMoney(totalLiabilities + totalEquity);

    return {
      totalAssets,
      totalLiabilities,
      totalEquityLedger,
      totalEquity,
      unclosedProfit,
      unexplainedDifference,
      totalRevenue,
      totalExpenses,
      netIncome,
      totalLiabAndEquity,
    };
  }, [assetAccounts, liabilityAccounts, equityAccounts, revenueAccounts, expenseAccounts, accountTreeCumulative]);

  // Same shape as `totals`, computed from the prior-year trees — feeds the comparison
  // column's section totals so they're never separately re-derived from the main figures.
  const totalsPrior = useMemo(() => {
    const sumBalance = (nodes: AccountNode[]): number => nodes.reduce((s, n) => s + n.balance, 0);
    const totalAssets = sumBalance(assetAccountsPrior);
    const totalLiabilities = sumBalance(liabilityAccountsPrior);
    const totalEquityLedger = sumBalance(equityAccountsPrior);
    const totalRevenue = sumBalance(revenueAccountsPrior);
    const totalExpenses = sumBalance(expenseAccountsPrior);
    const cumulativeRevenue = sumBalance(accountTreeCumulativePrior.filter((n) => n.type === 'Revenue'));
    const cumulativeExpenses = sumBalance(accountTreeCumulativePrior.filter((n) => n.type === 'Expense'));
    const unclosedProfit = roundMoney(cumulativeRevenue - cumulativeExpenses);
    const totalEquity = roundMoney(totalEquityLedger + unclosedProfit);
    const unexplainedDifference = roundMoney(totalAssets - totalLiabilities - totalEquity);
    return {
      totalAssets,
      totalLiabilities,
      totalEquityLedger,
      totalEquity,
      unclosedProfit,
      unexplainedDifference,
      totalRevenue,
      totalExpenses,
      netIncome: roundMoney(totalRevenue - totalExpenses),
      totalLiabAndEquity: roundMoney(totalLiabilities + totalEquity),
    };
  }, [assetAccountsPrior, liabilityAccountsPrior, equityAccountsPrior, revenueAccountsPrior, expenseAccountsPrior, accountTreeCumulativePrior]);

  // Balance Sheet flat list (assets, then liabilities, then equity) — same shape/purpose
  // as trialBalanceRows and incomeStatementRows: one source feeds the CSV export and the
  // print preview so neither can silently stop at a shallower depth than the on-screen
  // Detailed view, or disagree on the "accumulated results" plug row.
  const balanceSheetRows = useMemo(() => {
    const rows = [
      ...flattenStatement(assetAccounts, 'Asset'),
      ...flattenStatement(liabilityAccounts, 'Liability'),
      ...flattenStatement(equityAccounts, 'Equity'),
    ];
    if (Math.abs(totals.unclosedProfit) >= 0.01 || Math.abs(totalsPrior.unclosedProfit) >= 0.01) {
      rows.push({ section: 'Equity', code: '', name: 'Unclosed profit / (loss)', level: 1, amount: totals.unclosedProfit, heading: false });
    }
    if (Math.abs(totals.unexplainedDifference) >= 0.01) {
      rows.push({
        section: 'Difference',
        code: '',
        name: 'Assets minus liabilities minus equity (not on the chart of accounts)',
        level: 0,
        amount: totals.unexplainedDifference,
        heading: false,
      });
    }
    return rows;
  }, [flattenStatement, assetAccounts, liabilityAccounts, equityAccounts, totals.unclosedProfit, totals.unexplainedDifference, totalsPrior.unclosedProfit, totalsPrior.unexplainedDifference]);

  useEffect(() => {
    if (!closeDateEdited) setCloseAsOfDate(formatLocalIsoDate(endDate));
  }, [endDate, closeDateEdited]);

  const socie = useMemo(
    () => buildStatementOfChangesInEquity(journalEntries, rollupCoa, startDate, endDate, totals.netIncome),
    [journalEntries, rollupCoa, startDate, endDate, totals.netIncome]
  );

  const closeAlreadyPosted = useMemo(
    () => (closeAsOfDate ? hasPeriodCloseForDate(journalEntries, closeAsOfDate) : false),
    [journalEntries, closeAsOfDate]
  );

  // Trial balance rows that are safe to add: a collapsed parent contributes its
  // rolled-up net, an expanded parent contributes nothing (its children do), plus
  // any amount posted on the parent itself and any code missing from the chart.
  const trialBalanceRows = useMemo(() => {
    type TbRow = { code: string; name: string; type: string; level: number; debit: number | null; credit: number | null; heading: boolean };
    const rows: TbRow[] = [];
    const netOf = (debit: number, credit: number) => ({
      debit: debit > credit + 0.005 ? roundMoney(debit - credit) : 0,
      credit: credit > debit + 0.005 ? roundMoney(credit - debit) : 0,
    });
    const walk = (nodes: AccountNode[]) => {
      nodes.forEach((node) => {
        const hasBalance = Math.abs(node.debit) > 0.01 || Math.abs(node.credit) > 0.01 || Math.abs(node.balance) > 0.01;
        const hasChildren = node.children.length > 0;
        if (!showZeroBalances && !hasBalance && !hasChildren) return;
        const open = hasChildren && isSectionExpanded(node.code);
        if (!open) {
          rows.push({ code: node.code, name: node.name, type: node.type, level: node.level, ...netOf(node.debit, node.credit), heading: false });
          return;
        }
        rows.push({ code: node.code, name: node.name, type: node.type, level: node.level, debit: null, credit: null, heading: true });
        const direct = directPosting(node);
        if (Math.abs(direct.debit) > 0.01 || Math.abs(direct.credit) > 0.01) {
          rows.push({
            code: node.code,
            name: 'Posted directly to this account',
            type: node.type,
            level: node.level + 1,
            ...netOf(direct.debit, direct.credit),
            heading: false,
          });
        }
        walk(node.children);
      });
    };
    walk(accountTreeCumulative);
    for (const unmapped of unmappedGlCodes) {
      const net = unmapped.debit - unmapped.credit;
      rows.push({
        code: unmapped.code,
        name: 'Not on the chart of accounts',
        type: 'Unmapped',
        level: 0,
        debit: net > 0.005 ? roundMoney(net) : 0,
        credit: net < -0.005 ? roundMoney(-net) : 0,
        heading: false,
      });
    }
    return rows;
  }, [accountTreeCumulative, showZeroBalances, isSectionExpanded, unmappedGlCodes]);

  const trialBalanceColumnTotals = useMemo(() => {
    const into = { debit: 0, credit: 0 };
    for (const row of trialBalanceRows) {
      if (row.heading) continue;
      into.debit += row.debit || 0;
      into.credit += row.credit || 0;
    }
    return { debit: roundMoney(into.debit), credit: roundMoney(into.credit) };
  }, [trialBalanceRows]);

  // Trial Balance / Balance Check totals — the raw debit=credit invariant across every posted
  // entry through the report date, independent of the Chart of Accounts hierarchy. A walk over
  // the displayed account tree (leaf-only, to avoid double-counting a parent's rolled-up total)
  // previously backed this figure, but that missed two real cases: a line posted to a GL code
  // not in the COA at all (see unmappedGlCodes below), and the portion of a header account's
  // balance posted directly to the header rather than rolled up from a child (see
  // nonLeafPostings below) — a header's own direct-posting delta isn't exposed separately from
  // its rolled-up total, so a leaf-only walk silently dropped it. Both blind spots made this
  // report a false "difference" even when the underlying ledger was perfectly balanced. Any gap
  // between this total and what the visible Trial Balance rows add up to is exactly what those
  // two warning cards already explain.
  const trialBalanceTotals = useMemo(
    () => computeTrialBalanceCheckTotals(journalEntries, endDate),
    [journalEntries, endDate]
  );

  // ==================== RENDER ACCOUNT ROWS ====================
  // `priorNodes` is the same-shaped tree for the comparison column (Income Statement / Balance
  // Sheet only — Trial Balance never passes it). Flattened once into a code lookup up front
  // rather than re-searched per node, since both trees are built from the same rollupCoa and
  // every code in `nodes` is either present once in `priorNodes` or didn't exist that year.
  const renderAccountRows = useCallback((nodes: AccountNode[], showDebitCredit = false, priorNodes?: AccountNode[]): JSX.Element[] => {
    const rows: JSX.Element[] = [];

    const priorByCode = new Map<string, AccountNode>();
    if (priorNodes) {
      const flatten = (list: AccountNode[]) => list.forEach((n) => { priorByCode.set(n.code, n); flatten(n.children); });
      flatten(priorNodes);
    }

    const renderNode = (node: AccountNode, indent: number = 0) => {
      const hasBalance = Math.abs(node.balance) > 0.01;
      const hasChildren = node.children.length > 0;
      const isExpanded = hasChildren && isSectionExpanded(node.code);
      
      // Skip if no balance and not showing zeros (unless it has children with balances)
      if (!showZeroBalances && !hasBalance && !hasChildren) return;
      
      // Depth (indentation) and "is this a rollup" (has children — its figure sums the rows
      // below it, not a directly-posted balance) are two different things a reader needs to
      // tell apart, and depth alone doesn't show it: a subtotal like "4300 Other Revenue" sat
      // at the same indent, weight, and background as leaf siblings like "4100 Room Revenue"
      // right next to it, with only the expand/collapse triangle hinting it's a rollup. Anchor
      // the weight/tint on hasChildren instead of indent so every subtotal — at any depth —
      // reads as one, and every leaf reads as a directly-posted figure. Among rollups
      // themselves, grade the tint/weight by depth (darkest+boldest at the top-level category,
      // lightest at the deepest nested subtotal) so a 3-level chart like 5000 -> 5200 -> 5210
      // visually steps down as you drill in, rather than every rollup looking equally "total".
      const paddingClass = indent === 0 ? '' : indent === 1 ? 'pl-6' : 'pl-12';
      const fontClass = hasChildren
        ? (indent === 0 ? 'font-bold text-gray-900' : indent === 1 ? 'font-semibold text-gray-800' : 'font-medium text-gray-700')
        : indent === 1 ? 'font-medium' : '';
      const bgClass = hasChildren
        ? (indent === 0 ? 'bg-slate-100' : indent === 1 ? 'bg-slate-50' : 'bg-slate-50/40')
        : '';
      
      const accountCell = (
        <TableCell className={paddingClass}>
          <div className="flex items-center gap-2">
            {hasChildren && (
              <button 
                onClick={(e) => { e.stopPropagation(); toggleSection(node.code); }}
                className="w-4 h-4 flex items-center justify-center text-gray-400 hover:text-gray-600 text-xs"
              >
                {isExpanded ? '▼' : '▶'}
              </button>
            )}
            {!hasChildren && indent > 0 && <span className="w-4" />}
            <span className={`font-mono text-xs text-gray-400 ${indent === 0 ? 'font-medium' : ''}`}>{node.code}</span>
            <span className={fontClass}>{node.name}</span>
          </div>
        </TableCell>
      );

      const priorNode = priorNodes ? priorByCode.get(node.code) : undefined;
      const priorBalance = priorNode ? priorNode.balance : null;
      // An open parent is a heading. Its figure is the sum of the rows under it,
      // so printing that figure as well is what made the column overshoot the total.
      const blankAmounts = isExpanded;

      // Table rows in this library only accept TableCell children. A fragment here
      // crashes the trial balance (and every other statement) as soon as it renders.
      const amountCells = (debit: number, credit: number, balance: number, priorAmount: number | null, blank: boolean) => (
        showDebitCredit ? [
          <TableCell key="debit" className="text-right font-mono text-sm">
            {blank ? '' : debit > credit ? formatCurrency(debit - credit) : '-'}
          </TableCell>,
          <TableCell key="credit" className="text-right font-mono text-sm">
            {blank ? '' : credit > debit ? formatCurrency(credit - debit) : '-'}
          </TableCell>,
        ] : [
          <TableCell key="amount" className={`text-right font-mono text-sm ${!blank && balance < 0 ? 'text-rose-600' : ''}`}>
            {blank ? '' : formatCurrencyWithSign(balance)}
          </TableCell>,
          <TableCell key="prior" className={`text-right font-mono text-sm text-gray-500 ${!priorNodes ? 'hidden' : ''} ${!blank && (priorAmount ?? 0) < 0 ? 'text-rose-500' : ''}`}>
            {blank || !priorNodes ? '' : formatCurrencyWithSign(priorAmount ?? 0)}
          </TableCell>,
        ]
      );

      const amounts = amountCells(node.debit, node.credit, node.balance, priorBalance, blankAmounts);
      rows.push(
        <TableRow key={node.code} className={`hover:bg-slate-50 ${bgClass}`}>
          {accountCell}
          {amounts[0]}
          {amounts[1]}
        </TableRow>
      );
      
      // Render children if expanded. A balance posted on the parent itself is its own
      // line, otherwise it disappears once the parent's total is hidden.
      if (isExpanded) {
        const direct = directPosting(node);
        const priorDirect = priorNode ? directPosting(priorNode) : null;
        if (Math.abs(direct.balance) > 0.01 || (showDebitCredit && (Math.abs(direct.debit) > 0.01 || Math.abs(direct.credit) > 0.01))) {
          const directPad = indent + 1 === 1 ? 'pl-6' : 'pl-12';
          const directAmounts = amountCells(direct.debit, direct.credit, direct.balance, priorDirect ? priorDirect.balance : 0, false);
          rows.push(
            <TableRow key={`${node.code}-direct`} className="hover:bg-slate-50">
              <TableCell className={directPad}>
                <div className="flex items-center gap-2">
                  <span className="w-4" />
                  <span className="font-mono text-xs text-gray-400">{node.code}</span>
                  <span className="italic text-gray-600">Posted directly to this account</span>
                </div>
              </TableCell>
              {directAmounts[0]}
              {directAmounts[1]}
            </TableRow>
          );
        }
        node.children.forEach(child => renderNode(child, indent + 1));
      }
    };
    
    nodes.forEach(node => renderNode(node, 0));
    return rows;
  }, [isSectionExpanded, showZeroBalances, toggleSection]);

  // ==================== EXPORT FUNCTIONS ====================
  const exportTrialBalanceCSV = useCallback(() => {
    const columns = [
      { key: 'code', label: 'Account Code' },
      { key: 'name', label: 'Account Name' },
      { key: 'type', label: 'Type' },
      { key: 'debit', label: 'Debit' },
      { key: 'credit', label: 'Credit' },
    ];
    downloadCSV(trialBalanceRows, 'trial_balance', columns);
  }, [trialBalanceRows]);

  const printTrialBalance = useCallback(() => {
    // Print exactly the rows currently on screen (same source, `trialBalanceRows`, already
    // respecting showZeroBalances/expandedSections) instead of independently re-walking the
    // full tree — otherwise the printout could show a different set of rows, in a different
    // order, than what the user was looking at when they clicked Print.
    const renderRows = (): string => {
      return trialBalanceRows.map(row => {
        const indent = '&nbsp;'.repeat(row.level * 6);
        const levelClass = row.level === 0 ? 'level-1' : row.level === 1 ? 'level-2' : 'level-3';
        return `<tr class="${levelClass}">
          <td class="font-mono">${row.code}</td>
          <td>${indent}${row.name}</td>
          <td>${row.type}</td>
          <td class="text-right font-mono">${row.heading ? '' : row.debit ? formatCurrency(row.debit) : '-'}</td>
          <td class="text-right font-mono">${row.heading ? '' : row.credit ? formatCurrency(row.credit) : '-'}</td>
        </tr>`;
      }).join('');
    };

    const content = `
      <table>
        <thead><tr><th>Code</th><th>Account Name</th><th>Type</th><th class="text-right">Debit</th><th class="text-right">Credit</th></tr></thead>
        <tbody>
          ${renderRows()}
          <tr class="total-row">
            <td colspan="3" class="font-bold">TOTAL</td>
            <td class="text-right font-mono font-bold double-underline">${formatCurrency(trialBalanceColumnTotals.debit)}</td>
            <td class="text-right font-mono font-bold double-underline">${formatCurrency(trialBalanceColumnTotals.credit)}</td>
          </tr>
        </tbody>
      </table>
    `;
    openPrintPreview(generateReportHTML('TRIAL BALANCE', periodLabel, content));
  }, [trialBalanceRows, trialBalanceColumnTotals, periodLabel]);

  const exportIncomeStatementCSV = useCallback(() => {
    const columns = [
      { key: 'section', label: 'Section' },
      { key: 'code', label: 'Account Code' },
      { key: 'name', label: 'Account Name' },
      { key: 'amount', label: 'Amount' },
    ];
    downloadCSV(incomeStatementRows, 'income_statement', columns);
  }, [incomeStatementRows]);

  const printIncomeStatement = useCallback(() => {
    // Print exactly the rows currently on screen (same source, `incomeStatementRows`,
    // already respecting showZeroBalances/expandedSections) instead of a separate
    // hand-rolled 2-level walk — the previous version silently dropped a 3rd level
    // of account detail (e.g. 5210/5220 under 5200) that the on-screen Detailed view
    // does show, so print and screen could disagree without any indication why.
    const renderRows = (section: 'Revenue' | 'Expense'): string => {
      return incomeStatementRows
        .filter((row) => row.section === section)
        .map((row) => {
          const levelClass = row.level === 0 ? 'level-1' : row.level === 1 ? 'level-2' : 'level-3';
          const indent = '&nbsp;'.repeat(row.level * 6);
          return `<tr class="${levelClass}"><td>${indent}${row.code} ${row.name}</td><td class="text-right font-mono">${row.amount == null ? '' : formatCurrency(row.amount)}</td></tr>`;
        })
        .join('');
    };

    const content = `
      <div class="section">
        <div class="section-title">Revenue</div>
        <table><tbody>${renderRows('Revenue')}
          <tr class="subtotal-row"><td class="font-bold">Total Revenue</td><td class="text-right font-mono font-bold underline">${formatCurrency(totals.totalRevenue)}</td></tr>
        </tbody></table>
      </div>
      <div class="section">
        <div class="section-title">Less: Expenses</div>
        <table><tbody>${renderRows('Expense')}
          <tr class="subtotal-row"><td class="font-bold">Total Expenses</td><td class="text-right font-mono font-bold underline">(${formatCurrency(totals.totalExpenses)})</td></tr>
        </tbody></table>
      </div>
      <div class="section">
        <table><tbody>
          <tr class="total-row"><td class="font-bold">NET ${totals.netIncome >= 0 ? 'PROFIT' : 'LOSS'} FOR THE PERIOD</td><td class="text-right font-mono font-bold double-underline">${totals.netIncome >= 0 ? '' : '('}${formatCurrency(Math.abs(totals.netIncome))}${totals.netIncome >= 0 ? '' : ')'}</td></tr>
        </tbody></table>
      </div>
    `;
    openPrintPreview(generateReportHTML('STATEMENT OF PROFIT OR LOSS', periodLabel, content));
  }, [incomeStatementRows, totals, periodLabel]);

  const exportBalanceSheetCSV = useCallback(() => {
    const columns = [
      { key: 'section', label: 'Section' },
      { key: 'code', label: 'Account Code' },
      { key: 'name', label: 'Account Name' },
      { key: 'amount', label: 'Amount' },
    ];
    downloadCSV(balanceSheetRows, 'balance_sheet', columns);
  }, [balanceSheetRows]);

  const printBalanceSheet = useCallback(() => {
    // Print exactly the rows currently on screen (same source, `balanceSheetRows`,
    // already respecting showZeroBalances/expandedSections) instead of a separate
    // hand-rolled 2-level walk — the previous version silently dropped any 3rd level
    // of account detail the on-screen Detailed view does show, the same gap fixed
    // for the Income Statement print above.
    const renderRows = (section: 'Asset' | 'Liability' | 'Equity'): string => {
      return balanceSheetRows
        .filter((row) => row.section === section)
        .map((row) => {
          const levelClass = row.level === 0 ? 'level-1' : row.level === 1 ? 'level-2' : 'level-3';
          const indent = '&nbsp;'.repeat(row.level * 6);
          const label = row.code ? `${row.code} ${row.name}` : `<em>${row.name}</em>`;
          return `<tr class="${levelClass}"><td>${indent}${label}</td><td class="text-right font-mono">${row.amount == null ? '' : formatCurrencyWithSign(row.amount)}</td></tr>`;
        })
        .join('');
    };

    const content = `
      <div class="section">
        <div class="section-title">Assets</div>
        <table><tbody>${renderRows('Asset')}
          <tr class="total-row"><td class="font-bold">TOTAL ASSETS</td><td class="text-right font-mono font-bold double-underline">${formatCurrencyWithSign(totals.totalAssets)}</td></tr>
        </tbody></table>
      </div>
      <div class="section">
        <div class="section-title">Liabilities</div>
        <table><tbody>${renderRows('Liability')}
          <tr class="subtotal-row"><td class="font-bold">Total Liabilities</td><td class="text-right font-mono font-bold underline">${formatCurrencyWithSign(totals.totalLiabilities)}</td></tr>
        </tbody></table>
      </div>
      <div class="section">
        <div class="section-title">Equity</div>
        <table><tbody>${renderRows('Equity')}
          <tr class="level-2"><td colspan="2" style="font-size:9px;color:#666">Profit/(loss) for the selected period: ${formatCurrencyWithSign(totals.netIncome)}. Unclosed profit above is everything still open on revenue and expense accounts through the reporting date.</td></tr>
          <tr class="subtotal-row"><td class="font-bold">Total Equity</td><td class="text-right font-mono font-bold underline">${formatCurrencyWithSign(totals.totalEquity)}</td></tr>
          <tr class="total-row"><td class="font-bold">TOTAL LIABILITIES AND EQUITY</td><td class="text-right font-mono font-bold double-underline">${formatCurrencyWithSign(totals.totalLiabAndEquity)}</td></tr>
          ${Math.abs(totals.unexplainedDifference) >= 0.01 ? `<tr><td>Assets minus liabilities minus equity</td><td class="text-right font-mono">${formatCurrencyWithSign(totals.unexplainedDifference)}</td></tr>` : ''}
        </tbody></table>
      </div>
    `;
    openPrintPreview(generateReportHTML('STATEMENT OF FINANCIAL POSITION', periodLabel, content));
  }, [balanceSheetRows, totals, periodLabel]);

  const exportCashFlowCSV = useCallback(() => {
    const cf = cashFlow;
    const activityLines = (activity: 'operating' | 'investing' | 'financing', title: string) =>
      cf.lines
        .filter((line) => line.activity === activity)
        .map((line) => ({ line: `${title}: ${line.accountCode ? `${line.accountCode} ` : ''}${line.accountName}`, amount: line.amount }));
    const rows = [
      { line: 'Opening cash and cash equivalents', amount: cf.openingCash },
      ...activityLines('operating', 'Operating'),
      { line: 'Net cash from operating activities', amount: cf.operating },
      ...activityLines('investing', 'Investing'),
      { line: 'Net cash from investing activities', amount: cf.investing },
      ...activityLines('financing', 'Financing'),
      { line: 'Net cash from financing activities', amount: cf.financing },
      { line: 'Net increase / (decrease) in cash', amount: cf.operating + cf.investing + cf.financing },
      { line: 'Closing cash and cash equivalents', amount: cf.closingCash },
      { line: 'Classification residual (closing - opening vs. sum of activities)', amount: cf.reconciliationDiff },
    ];
    downloadCSV(rows, 'cash_flow', [
      { key: 'line', label: 'Line' },
      { key: 'amount', label: 'Amount' },
    ]);
  }, [cashFlow]);

  const printCashFlow = useCallback(() => {
    const cf = cashFlow;
    const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const sectionRows = (activity: 'operating' | 'investing' | 'financing', title: string, total: number) => {
      const lines = cf.lines.filter((line) => line.activity === activity);
      const body = lines.length
        ? lines.map((line) => `<tr><td style="padding-left:16px">${esc(line.accountCode ? `${line.accountCode} ` : '')}${esc(line.accountName)}</td><td class="text-right font-mono">${formatCurrencyWithSign(line.amount)}</td></tr>`).join('')
        : '<tr><td style="padding-left:16px;color:#666">No cash movement in this period.</td><td></td></tr>';
      return `<tr class="subtotal-row"><td colspan="2"><strong>${title}</strong></td></tr>${body}<tr><td class="font-bold" style="padding-left:16px">Net cash from ${title.toLowerCase()}</td><td class="text-right font-mono font-bold">${formatCurrencyWithSign(total)}</td></tr>`;
    };
    const content = `
      <div class="section">
        <div class="section-title">Cash and cash equivalents — movement (from general ledger)</div>
        <p style="font-size:10px;color:#555;margin-bottom:10px">Each cash journal is split by the other side of the entry. Fixed assets are investing. Equity and long-term borrowings are financing. Revenue, expenses and working capital are operating.</p>
        <table><tbody>
          <tr><td>Opening cash and cash equivalents</td><td class="text-right font-mono">${formatCurrency(cf.openingCash)}</td></tr>
          ${sectionRows('operating', 'Operating activities', cf.operating)}
          ${sectionRows('investing', 'Investing activities', cf.investing)}
          ${sectionRows('financing', 'Financing activities', cf.financing)}
          <tr class="total-row"><td class="font-bold">Net increase / (decrease) in cash</td><td class="text-right font-mono font-bold">${formatCurrencyWithSign(cf.operating + cf.investing + cf.financing)}</td></tr>
          <tr><td>Closing cash and cash equivalents</td><td class="text-right font-mono">${formatCurrency(cf.closingCash)}</td></tr>
          <tr class="level-2"><td colspan="2" style="font-size:9px;color:#666">Closing minus opening: ${formatCurrencyWithSign(cf.netChange)}. Residual: ${formatCurrencyWithSign(cf.reconciliationDiff)}</td></tr>
        </tbody></table>
      </div>
    `;
    openPrintPreview(generateReportHTML('STATEMENT OF CASH FLOWS', periodLabel, content));
  }, [cashFlow, periodLabel]);

  const exportSocieCSV = useCallback(() => {
    downloadCSV(
      socie.rows.map((r) => ({
        description: r.label,
        shareCapital: r.shareCapital,
        retainedAndOther: r.retainedAndOther,
        totalEquity: r.total,
      })),
      'statement_of_changes_in_equity',
      [
        { key: 'description', label: 'Description' },
        { key: 'shareCapital', label: 'Share capital' },
        { key: 'retainedAndOther', label: 'Retained & other' },
        { key: 'totalEquity', label: 'Total equity' },
      ]
    );
  }, [socie.rows]);

  const printSocie = useCallback(() => {
    const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const body = socie.rows
      .map(
        // Opening and closing balances are both totals (a point-in-time equity figure), not
        // movement lines — match the on-screen table, which styles both the same way rather
        // than only the closing row.
        (r) =>
          `<tr class="${r.key === 'open' || r.key === 'close' ? 'total-row' : ''}"><td>${esc(r.label)}</td><td class="text-right font-mono">${formatCurrency(r.shareCapital)}</td><td class="text-right font-mono">${formatCurrencyWithSign(r.retainedAndOther)}</td><td class="text-right font-mono">${formatCurrencyWithSign(r.total)}</td></tr>`
      )
      .join('');
    const content = `
      <div class="section">
        <p style="font-size:10px;color:#555;margin-bottom:10px">Share capital (3100). Retained and other is total equity after share capital: the other equity accounts plus profit not yet closed. Profit for the period matches the statement of profit or loss for the same dates.</p>
        <table>
          <thead><tr><th>Description</th><th class="text-right">Share capital</th><th class="text-right">Retained &amp; other</th><th class="text-right">Total equity</th></tr></thead>
          <tbody>${body}</tbody>
        </table>
      </div>`;
    openPrintPreview(generateReportHTML('STATEMENT OF CHANGES IN EQUITY', periodLabel, content));
  }, [socie, periodLabel]);

  const handlePostPeriodClose = useCallback(async () => {
    setCloseMessage(null);
    if (!closeAsOfDate) {
      setCloseMessage('Choose a closing date.');
      return;
    }
    const { confirmChoice } = await import('../DangerConfirm');
    if (!(await confirmChoice(
      `Close the books as at ${closeAsOfDate}?`,
      `This posts profit or loss to retained earnings (GL ${RETAINED_EARNINGS_GL}) and locks every date on or before ${closeAsOfDate} against new postings.`,
      'Post close',
    ))) return;
    setCloseBusy(true);
    try {
      const result = buildProfitLossCloseEntry(journalEntries, rollupCoa, closeAsOfDate);
      if (!result.ok) {
        setCloseMessage(result.error);
        return;
      }
      addJournalEntry(result.entry);
      logAccountingProcess('PeriodClose', 'P&L close posted to retained earnings', {
        date: closeAsOfDate,
        entryNumber: result.entry.entryNumber,
        reference: result.entry.reference,
        retainedEarningsGl: RETAINED_EARNINGS_GL,
      });
      addAuditTrail({
        id: `AT-PLC-${Date.now()}`,
        tableName: 'PeriodClose',
        recordId: result.entry.id,
        action: 'Create',
        oldValues: undefined,
        newValues: {
          type: 'PeriodClose',
          date: closeAsOfDate,
          entryNumber: result.entry.entryNumber,
          reference: result.entry.reference,
        },
        userId: 'system',
        timestamp: new Date().toISOString(),
      });
      setCloseMessage(`Posted ${result.entry.entryNumber}. Ledger refreshed.`);
      void handleRefresh();
    } finally {
      setCloseBusy(false);
    }
  }, [closeAsOfDate, journalEntries, rollupCoa, addJournalEntry, addAuditTrail, handleRefresh]);

  // ==================== REPORT OPTIONS ====================
  // `showComparisonToggle` is only passed true from Income Statement / Balance Sheet — Trial
  // Balance has no prior-year column to switch on, so it keeps the default (hidden) toggle.
  const ReportOptions = ({ showComparisonToggle = false }: { showComparisonToggle?: boolean } = {}) => (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-3 py-2 px-3 bg-slate-50 rounded-md border border-slate-100 text-sm">
      <RadioGroup
        orientation="horizontal"
        value={reportFormat}
        onValueChange={(v) => (v === 'summary' ? collapseAll() : expandAll())}
        size="sm"
        classNames={{ label: 'text-gray-600 text-xs' }}
      >
        <Radio value="summary" classNames={{ label: 'text-xs' }}>Summary</Radio>
        <Radio value="detailed" classNames={{ label: 'text-xs' }}>Detailed</Radio>
      </RadioGroup>
      <Divider orientation="vertical" className="h-4 hidden sm:block" />
      <Checkbox size="sm" isSelected={showZeroBalances} onValueChange={setShowZeroBalances} classNames={{ label: 'text-xs text-gray-600' }}>
        Zero balances
      </Checkbox>
      {showComparisonToggle && (
        <>
          <Divider orientation="vertical" className="h-4 hidden sm:block" />
          <Checkbox size="sm" isSelected={compareWithPriorYear} onValueChange={setCompareWithPriorYear} classNames={{ label: 'text-xs text-gray-600' }}>
            Compare to prior year
          </Checkbox>
        </>
      )}
      <div className="flex gap-1 ml-auto">
        <Button size="sm" variant="light" onPress={expandAll} className="text-gray-600 min-w-0 px-2 h-7 text-xs">Expand</Button>
        <Button size="sm" variant="light" onPress={collapseAll} className="text-gray-600 min-w-0 px-2 h-7 text-xs">Collapse</Button>
      </div>
    </div>
  );

  const periodControls = (
    <>
      <Select
        selectedKeys={[periodType]}
        onSelectionChange={(keys) => setPeriodType(Array.from(keys)[0] as PeriodType)}
        size="sm"
        className="w-[9.5rem]"
        variant="bordered"
        aria-label="Period type"
        classNames={{ trigger: 'h-8 min-h-8' }}
      >
        <SelectItem key="ytd">Year to Date</SelectItem>
        <SelectItem key="month">Specific Month</SelectItem>
        <SelectItem key="quarter">Quarter</SelectItem>
        <SelectItem key="year">Full Year</SelectItem>
        <SelectItem key="custom">Custom Range</SelectItem>
      </Select>

      {periodType === 'month' && (
        <Input
          type="month"
          value={selectedMonth}
          onValueChange={setSelectedMonth}
          size="sm"
          variant="bordered"
          aria-label="Month"
          className="w-[9.5rem]"
          classNames={{ inputWrapper: 'h-8 min-h-8' }}
        />
      )}

      {periodType === 'quarter' && (
        <>
          <Select
            selectedKeys={[selectedQuarter]}
            onSelectionChange={(keys) => setSelectedQuarter(Array.from(keys)[0] as string)}
            size="sm"
            variant="bordered"
            aria-label="Quarter"
            className="w-20"
            classNames={{ trigger: 'h-8 min-h-8' }}
          >
            <SelectItem key="Q1">Q1</SelectItem>
            <SelectItem key="Q2">Q2</SelectItem>
            <SelectItem key="Q3">Q3</SelectItem>
            <SelectItem key="Q4">Q4</SelectItem>
          </Select>
          <Select
            selectedKeys={[selectedYear]}
            onSelectionChange={(keys) => setSelectedYear(Array.from(keys)[0] as string)}
            size="sm"
            variant="bordered"
            aria-label="Year"
            className="w-20"
            classNames={{ trigger: 'h-8 min-h-8' }}
          >
            {yearOptions.map((y) => (
              <SelectItem key={String(y)}>{y}</SelectItem>
            ))}
          </Select>
        </>
      )}

      {periodType === 'year' && (
        <Select
          selectedKeys={[selectedYear]}
          onSelectionChange={(keys) => setSelectedYear(Array.from(keys)[0] as string)}
          size="sm"
          variant="bordered"
          aria-label="Year"
          className="w-20"
          classNames={{ trigger: 'h-8 min-h-8' }}
        >
          {yearOptions.map((y) => (
            <SelectItem key={String(y)}>{y}</SelectItem>
          ))}
        </Select>
      )}

      {periodType === 'custom' && (
        <>
          <Input
            type="date"
            value={customDateFrom}
            onValueChange={setCustomDateFrom}
            size="sm"
            variant="bordered"
            aria-label="From date"
            className="w-[8.5rem]"
            classNames={{ inputWrapper: 'h-8 min-h-8' }}
          />
          <Input
            type="date"
            value={customDateTo}
            onValueChange={setCustomDateTo}
            size="sm"
            variant="bordered"
            aria-label="To date"
            className="w-[8.5rem]"
            classNames={{ inputWrapper: 'h-8 min-h-8' }}
          />
        </>
      )}

      <Chip size="sm" variant="flat" color="default" className="hidden md:flex text-xs">
        {periodRangeLabel}
      </Chip>

      <Button
        isIconOnly
        variant="light"
        onPress={handleRefresh}
        isDisabled={isRefreshing}
        size="sm"
        className="text-gray-500 min-w-8 w-8 h-8"
        aria-label="Refresh reports"
      >
        {isRefreshing ? <Spinner size="sm" /> : '🔄'}
      </Button>
    </>
  );

  const ledgerWarnings = (
    <>
      {unmappedGlCodes.length > 0 && (
        <Card className="mt-3 shadow-none border bg-rose-50 border-rose-200">
          <CardBody className="py-3 text-sm">
            <p className="font-medium text-rose-800">
              ⚠ Posted entries reference {unmappedGlCodes.length} account code{unmappedGlCodes.length > 1 ? 's' : ''} not in your Chart of Accounts
            </p>
            <p className="text-rose-700 text-xs mt-1">
              These amounts are posted, but the code is not on the chart, so the income statement and balance sheet leave them out. They are listed on the trial balance. Add the code, or correct the entry.
            </p>
            <div className="mt-2 space-y-2.5">
              {unmappedGlCodes.map((u) => (
                <div key={u.code}>
                  <div className="flex justify-between font-mono text-xs font-semibold text-rose-800">
                    <span>{u.code}</span>
                    <span>{formatDrCr(u.debit, u.credit)}</span>
                  </div>
                  <ul className="mt-1 ml-2 space-y-0.5 border-l-2 border-rose-200 pl-2">
                    {u.entries.map((e, entryIndex) => (
                      <li key={`${u.code}-${e.journalEntryId}-${entryIndex}`} className="flex justify-between gap-3 text-[11px] text-rose-700">
                        <span className="truncate">
                          {e.entryNumber || e.journalEntryId} · {new Date(e.date).toLocaleDateString()}
                          {e.sourceModule ? ` · ${e.sourceModule}` : ''}{e.reference ? ` · ${e.reference}` : ''}
                        </span>
                        <span className="font-mono shrink-0">{formatDrCr(e.debit, e.credit)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      )}
      {nonLeafPostings.length > 0 && (
        <Card className="mt-3 shadow-none border bg-amber-50 border-amber-200">
          <CardBody className="py-3 text-sm">
            <p className="font-medium text-amber-800">
              ⚠ Posted entries reference {nonLeafPostings.length} category header account{nonLeafPostings.length > 1 ? 's' : ''} directly
            </p>
            <p className="text-amber-700 text-xs mt-1">
              A header account summarizes its children. Expand it on the trial balance to see the amount posted on the header itself, and repost those entries to the child account.
            </p>
            <div className="mt-2 space-y-2.5">
              {nonLeafPostings.map((u) => (
                <div key={u.code}>
                  <div className="flex justify-between font-mono text-xs font-semibold text-amber-800">
                    <span>{u.code} — {u.name}</span>
                    <span>{formatDrCr(u.debit, u.credit)}</span>
                  </div>
                  <ul className="mt-1 ml-2 space-y-0.5 border-l-2 border-amber-200 pl-2">
                    {u.entries.map((e, entryIndex) => (
                      <li key={`${u.code}-${e.journalEntryId}-${entryIndex}`} className="flex justify-between gap-3 text-[11px] text-amber-700">
                        <span className="truncate">
                          {e.entryNumber || e.journalEntryId} · {new Date(e.date).toLocaleDateString()}
                          {e.sourceModule ? ` · ${e.sourceModule}` : ''}{e.reference ? ` · ${e.reference}` : ''}
                        </span>
                        <span className="font-mono shrink-0">{formatDrCr(e.debit, e.credit)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      )}
    </>
  );

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="p-3 md:p-5 max-w-7xl mx-auto">
      <Card className="shadow-sm">
        <div className="border-b border-slate-200 px-3 md:px-4 py-2">
          <div className="flex flex-col gap-1.5 lg:flex-row lg:items-center lg:justify-between">
            <div className="shrink-0">
              <h1 className="text-lg md:text-xl font-bold text-gray-800">Financial Statements</h1>
              <p className="text-xs text-gray-500">{accountingAmountsLabel()}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">{periodControls}</div>
          </div>
          <p className="text-xs text-gray-500 mt-1 md:hidden">{periodRangeLabel}</p>
        </div>

        <CardBody className="p-0">
          <Tabs
            selectedKey={selectedTab}
            onSelectionChange={(key) => setSelectedTab(key as string)}
            className="w-full"
            size="sm"
            variant="solid"
            classNames={deskBookTabsClassNames}
          >
            {/* ==================== OVERVIEW TAB ==================== */}
            <Tab key="overview" title="Overview">
              <div className="p-3 md:p-5">
                {/* Key Metrics - Mild colors */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-3 mb-4">
                  <Card className="bg-slate-50 border border-slate-200 shadow-none">
                    <CardBody className="py-4 text-center">
                      <div className="text-lg md:text-2xl font-bold text-slate-700">{formatCurrency(totals.totalRevenue, true)}</div>
                      <div className="text-xs md:text-sm text-slate-500">Total Revenue</div>
                      <div className="text-[11px] text-slate-400">This period</div>
                    </CardBody>
                  </Card>
                  <Card className="bg-slate-50 border border-slate-200 shadow-none">
                    <CardBody className="py-4 text-center">
                      <div className="text-lg md:text-2xl font-bold text-slate-700">{formatCurrency(totals.totalExpenses, true)}</div>
                      <div className="text-xs md:text-sm text-slate-500">Total Expenses</div>
                      <div className="text-[11px] text-slate-400">This period</div>
                    </CardBody>
                  </Card>
                  <Card className={`border shadow-none ${totals.netIncome >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'}`}>
                    <CardBody className="py-4 text-center">
                      <div className={`text-lg md:text-2xl font-bold ${totals.netIncome >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                        {formatCurrency(Math.abs(totals.netIncome), true)}
                      </div>
                      <div className={`text-xs md:text-sm ${totals.netIncome >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        Net {totals.netIncome >= 0 ? 'Profit' : 'Loss'}
                      </div>
                      <div className={`text-[11px] ${totals.netIncome >= 0 ? 'text-emerald-500' : 'text-rose-400'}`}>This period</div>
                    </CardBody>
                  </Card>
                  <Card className="bg-slate-50 border border-slate-200 shadow-none">
                    <CardBody className="py-4 text-center">
                      <div className="text-lg md:text-2xl font-bold text-slate-700">{formatCurrencyWithSign(totals.totalAssets, true)}</div>
                      <div className="text-xs md:text-sm text-slate-500">Total Assets</div>
                      <div className="text-[11px] text-slate-400">At period end</div>
                    </CardBody>
                  </Card>
                </div>

                {/* Quick Summary */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card className="shadow-none border">
                    <CardHeader className="pb-2 bg-slate-50"><h3 className="font-semibold text-gray-700">Income Statement Summary</h3></CardHeader>
                    <CardBody className="pt-2">
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between"><span className="text-gray-600">Revenue</span><span className="font-mono">{formatCurrency(totals.totalRevenue, true)}</span></div>
                        <div className="flex justify-between"><span className="text-gray-600">Expenses</span><span className="font-mono text-gray-500">({formatCurrency(totals.totalExpenses, true)})</span></div>
                        <Divider />
                        <div className="flex justify-between font-semibold">
                          <span>Net {totals.netIncome >= 0 ? 'Profit' : 'Loss'}</span>
                          <span className={`font-mono ${totals.netIncome >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {formatCurrency(Math.abs(totals.netIncome), true)}
                          </span>
                        </div>
                      </div>
                    </CardBody>
                  </Card>
                  <Card className="shadow-none border">
                    <CardHeader className="pb-2 bg-slate-50"><h3 className="font-semibold text-gray-700">Balance Sheet Summary</h3></CardHeader>
                    <CardBody className="pt-2">
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between"><span className="text-gray-600">Total Assets</span><span className="font-mono">{formatCurrencyWithSign(totals.totalAssets, true)}</span></div>
                        <div className="flex justify-between"><span className="text-gray-600">Total Liabilities</span><span className="font-mono">{formatCurrencyWithSign(totals.totalLiabilities, true)}</span></div>
                        <div className="flex justify-between"><span className="text-gray-600">Equity accounts</span><span className="font-mono">{formatCurrencyWithSign(totals.totalEquityLedger, true)}</span></div>
                        <div className="flex justify-between"><span className="text-gray-600">Unclosed profit / (loss)</span><span className="font-mono">{formatCurrencyWithSign(totals.unclosedProfit, true)}</span></div>
                        <Divider />
                        <div className="flex justify-between font-semibold">
                          <span>Liabilities + equity</span>
                          <span className="font-mono">{formatCurrencyWithSign(totals.totalLiabAndEquity, true)}</span>
                        </div>
                        <div className={`flex justify-between font-semibold ${Math.abs(totals.unexplainedDifference) < 0.01 ? 'text-emerald-700' : 'text-amber-800'}`}>
                          <span>Assets − liabilities − equity</span>
                          <span className="font-mono">{formatCurrencyWithSign(totals.unexplainedDifference, true)}</span>
                        </div>
                      </div>
                    </CardBody>
                  </Card>
                </div>

                {/* Gross debit = gross credit across every posted line. Separate from the
                    balance-sheet equation above, which can fail when a code is missing from the chart. */}
                <Card className={`mt-4 shadow-none border ${Math.abs(trialBalanceTotals.debit - trialBalanceTotals.credit) < 0.01 ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
                  <CardBody className="py-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-gray-700">Journal lines: gross debits equal gross credits</span>
                      <Chip size="sm" variant="flat" color={Math.abs(trialBalanceTotals.debit - trialBalanceTotals.credit) < 0.01 ? 'success' : 'warning'}>
                        {Math.abs(trialBalanceTotals.debit - trialBalanceTotals.credit) < 0.01 ? '✓ Balanced' : '⚠ Difference: ' + formatCurrency(Math.abs(trialBalanceTotals.debit - trialBalanceTotals.credit), true)}
                      </Chip>
                    </div>
                  </CardBody>
                </Card>

                {ledgerWarnings}
              </div>
            </Tab>

            {/* ==================== INCOME STATEMENT TAB ==================== */}
            <Tab key="income-statement" title="Income Statement">
              <div className="p-3 md:p-5">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-3">
                  <div>
                    <h3 className="text-base font-semibold text-gray-800">Statement of profit or loss</h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Posted journal activity in the selected period only.
                    </p>
                  </div>
                  <Dropdown>
                    <DropdownTrigger><Button variant="bordered" size="sm">📥 Export</Button></DropdownTrigger>
                    <DropdownMenu>
                      <DropdownItem key="csv" onPress={exportIncomeStatementCSV}>📄 Download CSV</DropdownItem>
                      <DropdownItem key="print" onPress={printIncomeStatement}>🖨️ Print PDF</DropdownItem>
                    </DropdownMenu>
                  </Dropdown>
                </div>
                
                <ReportOptions showComparisonToggle />

                <Card className="shadow-none border overflow-hidden">
                  <CardBody className="p-0">
                    {/* Revenue Section */}
                    <div className="border-b">
                      <div className="bg-slate-100 px-4 py-2 font-semibold text-gray-700 text-sm uppercase tracking-wide">Revenue</div>
                      <div className="overflow-x-auto">
                        <Table removeWrapper aria-label="Revenue" classNames={reportTableClassNames}>
                          <TableHeader>
                            <TableColumn>Account</TableColumn>
                            <TableColumn width={150} className="text-right">{compareWithPriorYear ? incomeStatementColumnLabels.current : 'Amount'}</TableColumn>
                            <TableColumn width={150} className={compareWithPriorYear ? "text-right" : "hidden"}>{incomeStatementColumnLabels.prior}</TableColumn>
                          </TableHeader>
                          <TableBody emptyContent="No revenue accounts.">{renderAccountRows(revenueAccounts, false, compareWithPriorYear ? revenueAccountsPrior : undefined)}</TableBody>
                        </Table>
                      </div>
                      <div className="bg-slate-100 px-4 py-2 flex justify-between font-semibold border-t">
                        <span>Total Revenue</span>
                        <span className="flex gap-6">
                          <span className="font-mono w-[150px] text-right">{formatCurrency(totals.totalRevenue, true)}</span>
                          {compareWithPriorYear && <span className="font-mono w-[150px] text-right text-gray-500">{formatCurrency(totalsPrior.totalRevenue, true)}</span>}
                        </span>
                      </div>
                    </div>

                    {/* Expenses Section */}
                    <div className="border-b">
                      <div className="bg-slate-100 px-4 py-2 font-semibold text-gray-700 text-sm uppercase tracking-wide">Less: Expenses</div>
                      <div className="overflow-x-auto">
                        <Table removeWrapper aria-label="Expenses" classNames={reportTableClassNames}>
                          <TableHeader>
                            <TableColumn>Account</TableColumn>
                            <TableColumn width={150} className="text-right">{compareWithPriorYear ? incomeStatementColumnLabels.current : 'Amount'}</TableColumn>
                            <TableColumn width={150} className={compareWithPriorYear ? "text-right" : "hidden"}>{incomeStatementColumnLabels.prior}</TableColumn>
                          </TableHeader>
                          <TableBody emptyContent="No expense accounts.">{renderAccountRows(expenseAccounts, false, compareWithPriorYear ? expenseAccountsPrior : undefined)}</TableBody>
                        </Table>
                      </div>
                      <div className="bg-slate-100 px-4 py-2 flex justify-between font-semibold border-t">
                        <span>Total Expenses</span>
                        <span className="flex gap-6">
                          <span className="font-mono w-[150px] text-right">({formatCurrency(totals.totalExpenses, true)})</span>
                          {compareWithPriorYear && <span className="font-mono w-[150px] text-right text-gray-500">({formatCurrency(totalsPrior.totalExpenses, true)})</span>}
                        </span>
                      </div>
                    </div>

                    {/* Net Income */}
                    <div className={`px-4 py-4 flex justify-between font-bold text-lg ${totals.netIncome >= 0 ? 'bg-emerald-50' : 'bg-rose-50'}`}>
                      <span>NET {totals.netIncome >= 0 ? 'PROFIT' : 'LOSS'} FOR THE PERIOD</span>
                      <span className="flex gap-6">
                        <span className={`font-mono w-[150px] text-right ${totals.netIncome >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                          {totals.netIncome < 0 && '('}{formatCurrency(Math.abs(totals.netIncome), true)}{totals.netIncome < 0 && ')'}
                        </span>
                        {compareWithPriorYear && (
                          <span className={`font-mono w-[150px] text-right text-sm font-normal ${totalsPrior.netIncome >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {totalsPrior.netIncome < 0 && '('}{formatCurrency(Math.abs(totalsPrior.netIncome), true)}{totalsPrior.netIncome < 0 && ')'}
                          </span>
                        )}
                      </span>
                    </div>
                  </CardBody>
                </Card>
              </div>
            </Tab>

            {/* ==================== BALANCE SHEET TAB ==================== */}
            <Tab key="balance-sheet" title="Balance Sheet">
              <div className="p-3 md:p-5">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-3">
                  <div>
                    <h3 className="text-base font-semibold text-gray-800">Statement of financial position</h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      As at {endDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })} — cumulative posted balances.
                    </p>
                  </div>
                  <Dropdown>
                    <DropdownTrigger><Button variant="bordered" size="sm">📥 Export</Button></DropdownTrigger>
                    <DropdownMenu>
                      <DropdownItem key="csv" onPress={exportBalanceSheetCSV}>📄 Download CSV</DropdownItem>
                      <DropdownItem key="print" onPress={printBalanceSheet}>🖨️ Print PDF</DropdownItem>
                    </DropdownMenu>
                  </Dropdown>
                </div>

                <ReportOptions showComparisonToggle />

                <div className="flex items-center gap-3 mb-3 -mt-1 text-sm">
                  <span className="text-gray-600 text-xs">Presentation</span>
                  <div className="flex rounded-lg border border-gray-200 p-0.5">
                    <button
                      type="button"
                      onClick={() => setBalanceSheetForm('report')}
                      className={`px-3 py-1 text-xs rounded-md transition-colors ${balanceSheetForm === 'report' ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-100'}`}
                    >
                      Report Form
                    </button>
                    <button
                      type="button"
                      onClick={() => setBalanceSheetForm('account')}
                      className={`px-3 py-1 text-xs rounded-md transition-colors ${balanceSheetForm === 'account' ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-100'}`}
                    >
                      Account Form (T)
                    </button>
                  </div>
                </div>

                <div className={balanceSheetForm === 'account' ? 'grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-0 lg:divide-x lg:divide-gray-300' : 'space-y-4'}>
                  {/* Assets */}
                  <Card className={`shadow-none border overflow-hidden ${balanceSheetForm === 'account' ? 'h-full flex flex-col' : ''}`}>
                    <CardHeader className="bg-slate-100 py-2 border-b"><h4 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">Assets</h4></CardHeader>
                    <CardBody className={`p-0 ${balanceSheetForm === 'account' ? 'flex-1 flex flex-col' : ''}`}>
                      <div className="overflow-x-auto">
                        <Table removeWrapper aria-label="Assets" classNames={reportTableClassNames}>
                          <TableHeader>
                            <TableColumn>Account</TableColumn>
                            <TableColumn width={120} className="text-right">{compareWithPriorYear ? balanceSheetColumnLabels.current : 'Amount'}</TableColumn>
                            <TableColumn width={120} className={compareWithPriorYear ? "text-right" : "hidden"}>{balanceSheetColumnLabels.prior}</TableColumn>
                          </TableHeader>
                          <TableBody emptyContent="No asset accounts.">{renderAccountRows(assetAccounts, false, compareWithPriorYear ? assetAccountsPrior : undefined)}</TableBody>
                        </Table>
                      </div>
                      {/* mt-auto only does anything in Account Form's flex column (h-full/flex-1
                          above), where it pins this to the bottom of whichever card is taller —
                          keeping TOTAL ASSETS level with TOTAL LIABILITIES & EQUITY, the whole
                          point of the T layout. In Report Form these classes are inert. */}
                      <div className="bg-slate-200 px-4 py-2 flex justify-between font-bold border-t-2 border-slate-300 mt-auto">
                        <span>TOTAL ASSETS</span>
                        <span className="flex gap-6">
                          <span className="font-mono w-[120px] text-right">{formatCurrencyWithSign(totals.totalAssets, true)}</span>
                          {compareWithPriorYear && <span className="font-mono w-[120px] text-right text-gray-500 font-normal">{formatCurrencyWithSign(totalsPrior.totalAssets, true)}</span>}
                        </span>
                      </div>
                    </CardBody>
                  </Card>

                  {/* Liabilities & Equity */}
                  <Card className={`shadow-none border overflow-hidden ${balanceSheetForm === 'account' ? 'h-full flex flex-col' : ''}`}>
                    <CardHeader className="bg-slate-100 py-2 border-b"><h4 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">Liabilities & Equity</h4></CardHeader>
                    <CardBody className={`p-0 ${balanceSheetForm === 'account' ? 'flex-1 flex flex-col' : ''}`}>
                      {/* Liabilities */}
                      <div className="border-b">
                        <div className="bg-slate-50 px-4 py-1 font-medium text-gray-600 text-xs uppercase">Liabilities</div>
                        <div className="overflow-x-auto">
                          <Table removeWrapper aria-label="Liabilities" classNames={reportTableClassNamesNested}>
                            <TableHeader>
                              <TableColumn>Account</TableColumn>
                              <TableColumn width={120} className="text-right">{compareWithPriorYear ? balanceSheetColumnLabels.current : 'Amount'}</TableColumn>
                              <TableColumn width={120} className={compareWithPriorYear ? "text-right" : "hidden"}>{balanceSheetColumnLabels.prior}</TableColumn>
                            </TableHeader>
                            <TableBody emptyContent="No liabilities.">{renderAccountRows(liabilityAccounts, false, compareWithPriorYear ? liabilityAccountsPrior : undefined)}</TableBody>
                          </Table>
                        </div>
                        <div className="bg-slate-100 px-4 py-1 flex justify-between font-semibold text-sm">
                          <span>Total Liabilities</span>
                          <span className="flex gap-6">
                            <span className="font-mono w-[120px] text-right">{formatCurrencyWithSign(totals.totalLiabilities, true)}</span>
                            {compareWithPriorYear && <span className="font-mono w-[120px] text-right text-gray-500 font-normal">{formatCurrencyWithSign(totalsPrior.totalLiabilities, true)}</span>}
                          </span>
                        </div>
                      </div>
                      {/* Equity */}
                      <div className="border-b">
                        <div className="bg-slate-50 px-4 py-1 font-medium text-gray-600 text-xs uppercase">Equity</div>
                        <div className="overflow-x-auto">
                          <Table removeWrapper aria-label="Equity" classNames={reportTableClassNamesNested}>
                            <TableHeader>
                              <TableColumn>Account</TableColumn>
                              <TableColumn width={120} className="text-right">{compareWithPriorYear ? balanceSheetColumnLabels.current : 'Amount'}</TableColumn>
                              <TableColumn width={120} className={compareWithPriorYear ? "text-right" : "hidden"}>{balanceSheetColumnLabels.prior}</TableColumn>
                            </TableHeader>
                            <TableBody>
                              {[
                                ...renderAccountRows(equityAccounts, false, compareWithPriorYear ? equityAccountsPrior : undefined),
                                ...((Math.abs(totals.unclosedProfit) >= 0.01 || (compareWithPriorYear && Math.abs(totalsPrior.unclosedProfit) >= 0.01))
                                  ? [
                                      <TableRow key="unclosed-profit">
                                        <TableCell className="pl-6 italic text-gray-600">
                                          Unclosed profit / (loss)
                                        </TableCell>
                                        <TableCell className="text-right font-mono text-sm">
                                          {formatCurrencyWithSign(totals.unclosedProfit)}
                                        </TableCell>
                                        <TableCell className={`text-right font-mono text-sm text-gray-500 ${!compareWithPriorYear ? 'hidden' : ''}`}>
                                          {compareWithPriorYear ? formatCurrencyWithSign(totalsPrior.unclosedProfit, true) : ''}
                                        </TableCell>
                                      </TableRow>,
                                    ]
                                  : []),
                              ]}
                            </TableBody>
                          </Table>
                        </div>
                        <p className="text-xs text-gray-500 px-4 py-2 border-b border-slate-100">
                          Profit / (loss) for the selected period:{' '}
                          <span className="font-mono">{formatCurrencyWithSign(totals.netIncome)}</span>.
                          Unclosed profit is everything still open on revenue and expense accounts through the reporting date.
                          Total equity is the equity accounts plus that figure.
                        </p>
                        <div className="bg-slate-100 px-4 py-1 flex justify-between font-semibold text-sm">
                          <span>Total Equity</span>
                          <span className="flex gap-6">
                            <span className="font-mono w-[120px] text-right">{formatCurrencyWithSign(totals.totalEquity, true)}</span>
                            {compareWithPriorYear && <span className="font-mono w-[120px] text-right text-gray-500 font-normal">{formatCurrencyWithSign(totalsPrior.totalEquity, true)}</span>}
                          </span>
                        </div>
                      </div>
                      <div className="bg-slate-200 px-4 py-2 flex justify-between font-bold border-t-2 border-slate-300 mt-auto">
                        <span>TOTAL LIABILITIES & EQUITY</span>
                        <span className="flex gap-6">
                          <span className="font-mono w-[120px] text-right">{formatCurrencyWithSign(totals.totalLiabAndEquity, true)}</span>
                          {compareWithPriorYear && <span className="font-mono w-[120px] text-right text-gray-500 font-normal">{formatCurrencyWithSign(totalsPrior.totalLiabAndEquity, true)}</span>}
                        </span>
                      </div>
                    </CardBody>
                  </Card>
                </div>

                <Card className={`mt-4 shadow-none border ${Math.abs(totals.unexplainedDifference) < 0.01 ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
                  <CardBody className="py-3">
                    <div className="flex items-center justify-between gap-4 text-sm flex-wrap">
                      <span>
                        Assets − liabilities − equity:{' '}
                        <span className="font-mono font-semibold">{formatCurrencyWithSign(totals.unexplainedDifference, true)}</span>
                      </span>
                      <Chip size="sm" variant="flat" color={Math.abs(totals.unexplainedDifference) < 0.01 ? 'success' : 'warning'}>
                        {Math.abs(totals.unexplainedDifference) < 0.01 ? '✓ Statement balances' : '⚠ Not on the chart of accounts'}
                      </Chip>
                    </div>
                  </CardBody>
                </Card>
                <Card className={`mt-3 shadow-none border ${Math.abs(trialBalanceTotals.debit - trialBalanceTotals.credit) < 0.01 ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
                  <CardBody className="py-3">
                    <div className="flex items-center justify-center gap-4 text-sm flex-wrap">
                      <span>Journal lines — debits: <span className="font-mono font-semibold">{formatCurrency(trialBalanceTotals.debit, true)}</span></span>
                      <span className="text-gray-400">=</span>
                      <span>Credits: <span className="font-mono font-semibold">{formatCurrency(trialBalanceTotals.credit, true)}</span></span>
                      <Chip size="sm" variant="flat" color={Math.abs(trialBalanceTotals.debit - trialBalanceTotals.credit) < 0.01 ? 'success' : 'warning'}>
                        {Math.abs(trialBalanceTotals.debit - trialBalanceTotals.credit) < 0.01 ? '✓ Balanced' : '⚠ Diff: ' + formatCurrency(Math.abs(trialBalanceTotals.debit - trialBalanceTotals.credit), true)}
                      </Chip>
                    </div>
                  </CardBody>
                </Card>
                {ledgerWarnings}
              </div>
            </Tab>

            {/* ==================== CHANGES IN EQUITY + PERIOD CLOSE ==================== */}
            <Tab key="changes-in-equity" title="Changes in equity">
              <div className="p-3 md:p-5 space-y-3">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                  <div>
                    <h3 className="text-base font-semibold text-gray-800">Statement of changes in equity</h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Post period close below to move P&amp;L into retained earnings ({RETAINED_EARNINGS_GL}).
                    </p>
                  </div>
                  <Dropdown>
                    <DropdownTrigger>
                      <Button variant="bordered" size="sm">
                        📥 Export
                      </Button>
                    </DropdownTrigger>
                    <DropdownMenu>
                      <DropdownItem key="csv" onPress={exportSocieCSV}>
                        📄 Download CSV
                      </DropdownItem>
                      <DropdownItem key="print" onPress={printSocie}>
                        🖨️ Print PDF
                      </DropdownItem>
                    </DropdownMenu>
                  </Dropdown>
                </div>

                <Card className="shadow-none border border-slate-200 bg-slate-50/40">
                  <CardHeader className="py-3 border-b border-slate-200">
                    <h4 className="font-semibold text-gray-800 text-sm">Period close — P&amp;L to retained earnings</h4>
                  </CardHeader>
                  <CardBody className="py-4 space-y-3">
                    <div className="flex flex-wrap items-end gap-3">
                      <div className="min-w-[200px]">
                        <label className="text-xs font-medium text-gray-500 mb-1 block">Close as at (date)</label>
                        <Input
                          type="date"
                          value={closeAsOfDate}
                          onValueChange={(value) => {
                            setCloseDateEdited(true);
                            setCloseAsOfDate(value);
                          }}
                          size="sm"
                          variant="bordered"
                          aria-label="Period close as-of date"
                        />
                      </div>
                      <Button
                        color="primary"
                        size="sm"
                        isDisabled={closeBusy || closeAlreadyPosted || !closeAsOfDate}
                        isLoading={closeBusy}
                        onPress={handlePostPeriodClose}
                      >
                        Post P&amp;L to retained earnings
                      </Button>
                      {closeAlreadyPosted && (
                        <Chip size="sm" variant="flat" color="warning">
                          Close already posted for this date
                        </Chip>
                      )}
                    </div>
                    {closeMessage && (
                      <p className={`text-sm ${closeMessage.startsWith('Posted') ? 'text-emerald-700' : 'text-rose-700'}`}>
                        {closeMessage}
                      </p>
                    )}
                    <p className="text-xs text-gray-500">
                      The date follows the report end date until you change it. One posted close per calendar date. Once posted, every posting path (folio checkout,
                      manual invoices/payments, departmental capture) refuses new entries dated on or before
                      this date — reopen by voiding the close entry if a correction is needed.
                      Reversals are not automated — void or adjust manually if needed.
                    </p>
                  </CardBody>
                </Card>

                <Card className="shadow-none border overflow-hidden">
                  <CardBody className="p-0">
                    <div className="overflow-x-auto">
                    <Table removeWrapper aria-label="Statement of changes in equity" classNames={reportTableClassNames}>
                      <TableHeader>
                        <TableColumn>Description</TableColumn>
                        <TableColumn width={140} className="text-right">
                          Share capital
                        </TableColumn>
                        <TableColumn width={160} className="text-right">
                          Retained &amp; other
                        </TableColumn>
                        <TableColumn width={140} className="text-right">
                          Total equity
                        </TableColumn>
                      </TableHeader>
                      <TableBody>
                        {socie.rows.map((r) => (
                          <TableRow
                            key={r.key}
                            // Opening and closing balances are both totals (a point-in-time
                            // equity figure), not movement lines — only 'close' got the bold/
                            // tint treatment before, so 'open' looked identical to the plain
                            // 'profit'/'other' movement rows between them. Same tonal top-level
                            // treatment as the account trees elsewhere in this module.
                            className={r.key === 'open' || r.key === 'close' ? 'bg-slate-100 font-bold text-gray-900' : ''}
                          >
                            <TableCell className="text-sm max-w-md">{r.label}</TableCell>
                            <TableCell className="text-right font-mono text-sm">{formatCurrency(r.shareCapital)}</TableCell>
                            <TableCell className="text-right font-mono text-sm">{formatCurrencyWithSign(r.retainedAndOther)}</TableCell>
                            <TableCell className="text-right font-mono text-sm">{formatCurrencyWithSign(r.total)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    </div>
                  </CardBody>
                </Card>
              </div>
            </Tab>

            {/* ==================== CASH FLOW TAB ==================== */}
            <Tab key="cash-flow" title="Cash Flow">
              <div className="p-3 md:p-5">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-3">
                  <div>
                    <h3 className="text-base font-semibold text-gray-800">Statement of cash flows</h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Cash and bank movement, split by the other side of each journal. Fixed assets are investing. Equity and long-term borrowings are financing. Revenue, expenses and working capital are operating.
                    </p>
                  </div>
                  <Dropdown>
                    <DropdownTrigger><Button variant="bordered" size="sm">📥 Export</Button></DropdownTrigger>
                    <DropdownMenu>
                      <DropdownItem key="csv" onPress={exportCashFlowCSV}>
                        📄 Download CSV
                      </DropdownItem>
                      <DropdownItem key="print" onPress={printCashFlow}>
                        🖨️ Print PDF
                      </DropdownItem>
                    </DropdownMenu>
                  </Dropdown>
                </div>

                <div className="space-y-4">
                  <Card className="shadow-none border overflow-hidden">
                    <CardHeader className="bg-slate-100 py-2 border-b">
                      <h4 className="font-semibold text-gray-700 text-sm">Cash and cash equivalents</h4>
                    </CardHeader>
                    <CardBody className="text-sm space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Opening (start of period)</span>
                        <span className="font-mono">{formatCurrency(cashFlow.openingCash, true)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Closing (through reporting date)</span>
                        <span className="font-mono">{formatCurrency(cashFlow.closingCash, true)}</span>
                      </div>
                      <Divider />
                      <div className="flex justify-between font-semibold">
                        <span>Net change (GL)</span>
                        <span className="font-mono">{formatCurrencyWithSign(cashFlow.netChange)}</span>
                      </div>
                    </CardBody>
                  </Card>
                  {([
                    ['operating', 'Operating activities', cashFlow.operating],
                    ['investing', 'Investing activities', cashFlow.investing],
                    ['financing', 'Financing activities', cashFlow.financing],
                  ] as const).map(([activity, title, total]) => {
                    const lines = cashFlow.lines.filter((line) => line.activity === activity);
                    return (
                      <Card key={activity} className="shadow-none border overflow-hidden">
                        <CardHeader className="bg-slate-100 py-2 border-b">
                          <h4 className="font-semibold text-gray-700 text-sm">{title}</h4>
                        </CardHeader>
                        <CardBody className="text-sm space-y-1.5">
                          {lines.length === 0 ? (
                            <p className="text-xs text-gray-500">No cash movement in this period.</p>
                          ) : lines.map((line) => (
                            <div key={`${activity}-${line.accountCode || line.accountName}`} className="flex justify-between gap-3">
                              <span className="text-gray-600">
                                {line.accountCode ? <span className="font-mono text-xs text-gray-400 mr-2">{line.accountCode}</span> : null}
                                {line.accountName}
                              </span>
                              <span className="font-mono shrink-0">{formatCurrencyWithSign(line.amount)}</span>
                            </div>
                          ))}
                          <Divider />
                          <div className="flex justify-between font-semibold">
                            <span>Net cash from {title.toLowerCase()}</span>
                            <span className="font-mono">{formatCurrencyWithSign(total)}</span>
                          </div>
                        </CardBody>
                      </Card>
                    );
                  })}
                  {Math.abs(cashFlow.reconciliationDiff) >= 0.01 && (
                    <Card className="shadow-none border border-amber-200 bg-amber-50/50">
                      <CardBody className="text-xs text-amber-900 py-3">
                        Classification total differs from net GL change by{' '}
                        <span className="font-mono">{formatCurrency(cashFlow.reconciliationDiff, true)}</span> — refine journal
                        tagging or expand activity rules if you need a full IAS 7 reconciliation.
                      </CardBody>
                    </Card>
                  )}
                </div>
              </div>
            </Tab>

            {/* ==================== TRIAL BALANCE TAB ==================== */}
            <Tab key="trial-balance" title="Trial Balance">
              <div className="p-3 md:p-5">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-3">
                  <div>
                    <h3 className="text-base font-semibold text-gray-800">Trial balance</h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Cumulative posted balances through the reporting date. The total adds the amount lines only — an expanded heading is not added again.
                    </p>
                  </div>
                  <Dropdown>
                    <DropdownTrigger><Button variant="bordered" size="sm">📥 Export</Button></DropdownTrigger>
                    <DropdownMenu>
                      <DropdownItem key="csv" onPress={exportTrialBalanceCSV}>📄 Download CSV</DropdownItem>
                      <DropdownItem key="print" onPress={printTrialBalance}>🖨️ Print PDF</DropdownItem>
                    </DropdownMenu>
                  </Dropdown>
                </div>
                
                <ReportOptions />

                <Card className="shadow-none border overflow-hidden">
                  <CardBody className="p-0">
                    <div className="overflow-x-auto">
                      <Table removeWrapper aria-label="Trial Balance" classNames={trialBalanceReportTableClassNames}>
                        <TableHeader>
                          <TableColumn>Account</TableColumn>
                          <TableColumn width={150} className="text-right">Debit</TableColumn>
                          <TableColumn width={150} className="text-right">Credit</TableColumn>
                        </TableHeader>
                        <TableBody emptyContent="No posted journal activity through the reporting date.">
                          {[
                            ...renderAccountRows(accountTreeCumulative, true),
                            ...unmappedGlCodes.map((u) => {
                              const net = u.debit - u.credit;
                              return (
                                <TableRow key={`unmapped-${u.code}`}>
                                  <TableCell>
                                    <div className="flex items-center gap-2">
                                      <span className="font-mono text-xs text-rose-700">{u.code}</span>
                                      <span className="italic text-rose-700">Not on the chart of accounts</span>
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-right font-mono text-sm">{net > 0.005 ? formatCurrency(net) : '-'}</TableCell>
                                  <TableCell className="text-right font-mono text-sm">{net < -0.005 ? formatCurrency(-net) : '-'}</TableCell>
                                </TableRow>
                              );
                            }),
                            <TableRow key="tb-totals" className="bg-slate-200 font-bold border-t-2 border-slate-300">
                              <TableCell>
                                <Chip size="sm" variant="flat" color={Math.abs(trialBalanceColumnTotals.debit - trialBalanceColumnTotals.credit) < 0.01 ? 'success' : 'warning'}>
                                  {Math.abs(trialBalanceColumnTotals.debit - trialBalanceColumnTotals.credit) < 0.01 ? '✓ Balanced' : '⚠ Diff: ' + formatCurrency(Math.abs(trialBalanceColumnTotals.debit - trialBalanceColumnTotals.credit), true)}
                                </Chip>
                              </TableCell>
                              <TableCell className="text-right font-mono text-sm font-bold">
                                {formatCurrency(trialBalanceColumnTotals.debit, true)}
                              </TableCell>
                              <TableCell className="text-right font-mono text-sm font-bold">
                                {formatCurrency(trialBalanceColumnTotals.credit, true)}
                              </TableCell>
                            </TableRow>,
                          ]}
                        </TableBody>
                      </Table>
                    </div>
                  </CardBody>
                </Card>
                {ledgerWarnings}
              </div>
            </Tab>
          </Tabs>
        </CardBody>
      </Card>
    </div>
  );
}
