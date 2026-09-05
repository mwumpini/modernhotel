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
import { formatAccountingCurrency } from '@/app/lib/accounting/tenantAccountingConfig';
import { downloadCSV, openPrintPreview } from '@/app/lib/accounting/helpers/exportHelpers';

type PeriodType = 'custom' | 'month' | 'quarter' | 'year' | 'ytd';
type ReportFormat = 'summary' | 'detailed';

// ==================== HELPERS ====================
// Financial-statement-specific presentation on top of the shared currency formatter:
// zero amounts collapse to a dash, negatives render in parentheses (accounting convention).
const formatCurrency = (amount: number, showZero = false) => {
  if (!showZero && Math.abs(amount) < 0.01) return '-';
  return formatAccountingCurrency(amount);
};

const formatCurrencyWithSign = (amount: number, showZero = false) => {
  if (!showZero && Math.abs(amount) < 0.01) return '-';
  const sign = amount < 0 ? '(' : '';
  const end = amount < 0 ? ')' : '';
  return `${sign}${formatAccountingCurrency(amount)}${end}`;
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
  const [closeMessage, setCloseMessage] = useState<string | null>(null);
  const [closeBusy, setCloseBusy] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Period Selection
  const [periodType, setPeriodType] = useState<PeriodType>('ytd');
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [selectedQuarter, setSelectedQuarter] = useState('Q1');
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

  // Initialize
  useEffect(() => {
    initializeAccounting();
  }, [initializeAccounting]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await initializeAccounting();
    setTimeout(() => setIsRefreshing(false), 500);
  }, [initializeAccounting]);

  // Toggle section expansion
  const toggleSection = (sectionKey: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(sectionKey)) {
        next.delete(sectionKey);
      } else {
        next.add(sectionKey);
      }
      return next;
    });
  };

  // ==================== PERIOD CALCULATIONS ====================
  const { startDate, endDate } = useMemo(() => 
    getPeriodDates(periodType, selectedMonth, selectedQuarter, selectedYear, customDateFrom, customDateTo),
    [periodType, selectedMonth, selectedQuarter, selectedYear, customDateFrom, customDateTo]
  );

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

  const accountTreePeriod = useMemo(
    () => buildFinancialAccountTree(rollupCoa, journalEntries, { kind: 'period', startDate, endDate }),
    [rollupCoa, journalEntries, startDate, endDate]
  );

  const accountTreeCumulative = useMemo(
    () => buildFinancialAccountTree(rollupCoa, journalEntries, { kind: 'cumulative', endDate }),
    [rollupCoa, journalEntries, endDate]
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

  // Income Statement flat list (revenue then expense), same shape/purpose as
  // trialBalanceRows: one source feeds the CSV export and the print preview, so
  // neither one can show a different set of rows — or silently stop at a
  // shallower depth — than what renderAccountRows draws on screen. (Revenue and
  // Expense accounts run 3 levels deep in this chart, e.g. 5000 -> 5200 -> 5210 —
  // a hand-rolled 2-level-only renderer here previously dropped that 3rd level.)
  const incomeStatementRows = useMemo(() => {
    const flattenSection = (nodes: AccountNode[], section: 'Revenue' | 'Expense', level = 0, rows: Array<{ section: string; code: string; name: string; level: number; amount: number }> = []) => {
      nodes.forEach((node) => {
        const hasBalance = Math.abs(node.balance) > 0.01;
        if (showZeroBalances || hasBalance || node.children.length > 0) {
          rows.push({ section, code: node.code, name: node.name, level, amount: node.balance });
        }
        if (node.children.length > 0 && (expandedSections.has('all') || expandedSections.has(node.code))) {
          flattenSection(node.children, section, level + 1, rows);
        }
      });
      return rows;
    };
    return [...flattenSection(revenueAccounts, 'Revenue'), ...flattenSection(expenseAccounts, 'Expense')];
  }, [revenueAccounts, expenseAccounts, showZeroBalances, expandedSections]);

  const cashFlow = useMemo(
    () => computeCashFlowFromJournals(journalEntries, startDate, endDate),
    [journalEntries, startDate, endDate]
  );

  // ==================== CALCULATIONS ====================
  const totals = useMemo(() => {
    const sumBalance = (nodes: AccountNode[]): number => nodes.reduce((s, n) => s + n.balance, 0);

    const totalAssets = sumBalance(assetAccounts);
    const totalLiabilities = sumBalance(liabilityAccounts);
    const totalEquityLedger = sumBalance(equityAccounts);
    const totalRevenue = sumBalance(revenueAccounts);
    const totalExpenses = sumBalance(expenseAccounts);
    const netIncome = totalRevenue - totalExpenses;

    // totalEquity is a plug (Assets − Liabilities), shown as "Total Equity" together with an
    // itemized "Accumulated results (unclosed P&L)" row equal to accumulatedUnclosedPlug — so
    // totalLiabAndEquity (= Liabilities + the plug) is definitionally equal to totalAssets and
    // is NOT an independent balance check; it's a display subtotal only. The real check is
    // accumulatedUnclosedPlug itself: it isolates whatever isn't explained by real ledger
    // equity + this period's known unclosed P&L (see the "Balance Check" card below).
    const totalEquity = totalAssets - totalLiabilities;
    const accumulatedUnclosedPlug = totalEquity - totalEquityLedger;
    const totalLiabAndEquity = totalLiabilities + totalEquity;

    return {
      totalAssets,
      totalLiabilities,
      totalEquityLedger,
      totalEquity,
      accumulatedUnclosedPlug,
      totalRevenue,
      totalExpenses,
      netIncome,
      totalLiabAndEquity,
    };
  }, [assetAccounts, liabilityAccounts, equityAccounts, revenueAccounts, expenseAccounts]);

  // Balance Sheet flat list (assets, then liabilities, then equity) — same shape/purpose
  // as trialBalanceRows and incomeStatementRows: one source feeds the CSV export and the
  // print preview so neither can silently stop at a shallower depth than the on-screen
  // Detailed view, or disagree on the "accumulated results" plug row.
  const balanceSheetRows = useMemo(() => {
    const flattenSection = (nodes: AccountNode[], section: 'Asset' | 'Liability' | 'Equity', level = 0, rows: Array<{ section: string; code: string; name: string; level: number; amount: number }> = []) => {
      nodes.forEach((node) => {
        const hasBalance = Math.abs(node.balance) > 0.01;
        if (showZeroBalances || hasBalance || node.children.length > 0) {
          rows.push({ section, code: node.code, name: node.name, level, amount: node.balance });
        }
        if (node.children.length > 0 && (expandedSections.has('all') || expandedSections.has(node.code))) {
          flattenSection(node.children, section, level + 1, rows);
        }
      });
      return rows;
    };
    const rows = [
      ...flattenSection(assetAccounts, 'Asset'),
      ...flattenSection(liabilityAccounts, 'Liability'),
      ...flattenSection(equityAccounts, 'Equity'),
    ];
    if (Math.abs(totals.accumulatedUnclosedPlug) >= 0.01) {
      rows.push({ section: 'Equity', code: '', name: 'Accumulated results (unclosed P&L to equity GL)', level: 1, amount: totals.accumulatedUnclosedPlug });
    }
    return rows;
  }, [assetAccounts, liabilityAccounts, equityAccounts, showZeroBalances, expandedSections, totals.accumulatedUnclosedPlug]);

  useEffect(() => {
    setCloseAsOfDate(endDate.toISOString().slice(0, 10));
  }, [endDate]);

  const socie = useMemo(
    () => buildStatementOfChangesInEquity(journalEntries, rollupCoa, startDate, endDate, totals.netIncome),
    [journalEntries, rollupCoa, startDate, endDate, totals.netIncome]
  );

  const closeAlreadyPosted = useMemo(
    () => (closeAsOfDate ? hasPeriodCloseForDate(journalEntries, closeAsOfDate) : false),
    [journalEntries, closeAsOfDate]
  );

  // Trial Balance flat list
  const trialBalanceRows = useMemo(() => {
    const flattenTree = (nodes: AccountNode[], rows: any[] = []): any[] => {
      nodes.forEach(node => {
        const hasBalance = Math.abs(node.debit) > 0.01 || Math.abs(node.credit) > 0.01;
        if (showZeroBalances || hasBalance || node.children.length > 0) {
          rows.push({
            code: node.code,
            name: node.name,
            type: node.type,
            level: node.level,
            debit: node.debit > node.credit ? node.debit - node.credit : 0,
            credit: node.credit > node.debit ? node.credit - node.debit : 0,
          });
        }
        // Show children if expanded or showing all
        if (node.children.length > 0 && (expandedSections.has('all') || expandedSections.has(node.code))) {
          flattenTree(node.children, rows);
        }
      });
      return rows;
    };
    return flattenTree(accountTreeCumulative);
  }, [accountTreeCumulative, showZeroBalances, expandedSections]);

  // Trial Balance footer totals — summed over LEAF accounts only (accounts with no children).
  // A parent/header node's debit/credit is already a cumulative roll-up of its descendants
  // (see financialReportRollup.ts), so summing every row in the displayed tree — which is what
  // `trialBalanceRows` does for on-screen hierarchy display — would count each real posting
  // once per ancestor level. Independent of `showZeroBalances`/`expandedSections` so the total
  // can't shift just because the user expanded or collapsed a section.
  const trialBalanceTotals = useMemo(() => {
    let debit = 0;
    let credit = 0;
    const walk = (nodes: AccountNode[]) => {
      for (const node of nodes) {
        if (node.children.length > 0) {
          walk(node.children);
        } else {
          debit += node.debit > node.credit ? node.debit - node.credit : 0;
          credit += node.credit > node.debit ? node.credit - node.debit : 0;
        }
      }
    };
    walk(accountTreeCumulative);
    return { debit, credit };
  }, [accountTreeCumulative]);

  // ==================== RENDER ACCOUNT ROWS ====================
  const renderAccountRows = useCallback((nodes: AccountNode[], showDebitCredit = false): JSX.Element[] => {
    const rows: JSX.Element[] = [];
    
    const renderNode = (node: AccountNode, indent: number = 0) => {
      const hasBalance = Math.abs(node.balance) > 0.01;
      const isExpanded = expandedSections.has('all') || expandedSections.has(node.code);
      const hasChildren = node.children.length > 0;
      
      // Skip if no balance and not showing zeros (unless it has children with balances)
      if (!showZeroBalances && !hasBalance && !hasChildren) return;
      
      const paddingClass = indent === 0 ? '' : indent === 1 ? 'pl-6' : 'pl-12';
      const fontClass = indent === 0 ? 'font-semibold' : indent === 1 ? 'font-medium' : '';
      const bgClass = indent === 0 ? 'bg-gray-50' : '';
      
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

      rows.push(
        showDebitCredit ? (
          <TableRow key={node.code} className={`hover:bg-slate-50 ${bgClass}`}>
            {accountCell}
            <TableCell className="text-right font-mono text-sm">
              {node.debit > node.credit ? formatCurrency(node.debit - node.credit) : '-'}
            </TableCell>
            <TableCell className="text-right font-mono text-sm">
              {node.credit > node.debit ? formatCurrency(node.credit - node.debit) : '-'}
            </TableCell>
          </TableRow>
        ) : (
          <TableRow key={node.code} className={`hover:bg-slate-50 ${bgClass}`}>
            {accountCell}
            <TableCell className={`text-right font-mono text-sm ${node.balance < 0 ? 'text-rose-600' : ''}`}>
              {formatCurrencyWithSign(node.balance)}
            </TableCell>
          </TableRow>
        )
      );
      
      // Render children if expanded
      if (hasChildren && isExpanded) {
        node.children.forEach(child => renderNode(child, indent + 1));
      }
    };
    
    nodes.forEach(node => renderNode(node, 0));
    return rows;
  }, [expandedSections, showZeroBalances, toggleSection]);

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
          <td class="text-right font-mono">${row.debit > 0 ? formatCurrency(row.debit) : '-'}</td>
          <td class="text-right font-mono">${row.credit > 0 ? formatCurrency(row.credit) : '-'}</td>
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
            <td class="text-right font-mono font-bold double-underline">${formatCurrency(trialBalanceTotals.debit)}</td>
            <td class="text-right font-mono font-bold double-underline">${formatCurrency(trialBalanceTotals.credit)}</td>
          </tr>
        </tbody>
      </table>
    `;
    openPrintPreview(generateReportHTML('TRIAL BALANCE', periodLabel, content));
  }, [trialBalanceRows, trialBalanceTotals, periodLabel]);

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
          return `<tr class="${levelClass}"><td>${indent}${row.code} ${row.name}</td><td class="text-right font-mono">${formatCurrency(row.amount)}</td></tr>`;
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
          return `<tr class="${levelClass}"><td>${indent}${label}</td><td class="text-right font-mono">${formatCurrencyWithSign(row.amount)}</td></tr>`;
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
          <tr class="level-2"><td colspan="2" style="font-size:9px;color:#666">Profit/(loss) for period (SoPL): ${formatCurrencyWithSign(totals.netIncome)} — reference only.</td></tr>
          <tr class="subtotal-row"><td class="font-bold">Total Equity</td><td class="text-right font-mono font-bold underline">${formatCurrencyWithSign(totals.totalEquity)}</td></tr>
          <tr class="total-row"><td class="font-bold">TOTAL LIABILITIES AND EQUITY</td><td class="text-right font-mono font-bold double-underline">${formatCurrencyWithSign(totals.totalLiabAndEquity)}</td></tr>
        </tbody></table>
      </div>
    `;
    openPrintPreview(generateReportHTML('STATEMENT OF FINANCIAL POSITION', periodLabel, content));
  }, [balanceSheetRows, totals, periodLabel]);

  const exportCashFlowCSV = useCallback(() => {
    const cf = cashFlow;
    const rows = [
      { line: 'Opening cash and cash equivalents', amount: cf.openingCash },
      { line: 'Net cash from operating activities', amount: cf.operating },
      { line: 'Net cash from investing activities', amount: cf.investing },
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
    const content = `
      <div class="section">
        <div class="section-title">Cash and cash equivalents — movement (from general ledger)</div>
        <p style="font-size:10px;color:#555;margin-bottom:10px">IAS 7 — simplified direct classification by journal entry (cash accounts 1000, 1100, 1110, 1120).</p>
        <table><tbody>
          <tr><td>Opening cash and cash equivalents</td><td class="text-right font-mono">${formatCurrency(cf.openingCash)}</td></tr>
          <tr class="subtotal-row"><td colspan="2"><strong>Operating activities</strong></td></tr>
          <tr><td style="padding-left:16px">Net cash flows (classified operating)</td><td class="text-right font-mono">${formatCurrencyWithSign(cf.operating)}</td></tr>
          <tr class="subtotal-row"><td colspan="2"><strong>Investing activities</strong></td></tr>
          <tr><td style="padding-left:16px">Net cash flows (PPE-related)</td><td class="text-right font-mono">${formatCurrencyWithSign(cf.investing)}</td></tr>
          <tr class="subtotal-row"><td colspan="2"><strong>Financing activities</strong></td></tr>
          <tr><td style="padding-left:16px">Net cash flows (equity capital)</td><td class="text-right font-mono">${formatCurrencyWithSign(cf.financing)}</td></tr>
          <tr class="total-row"><td class="font-bold">Net increase / (decrease) in cash (sum of above)</td><td class="text-right font-mono font-bold">${formatCurrencyWithSign(cf.operating + cf.investing + cf.financing)}</td></tr>
          <tr><td>Closing cash and cash equivalents (GL)</td><td class="text-right font-mono">${formatCurrency(cf.closingCash)}</td></tr>
          <tr class="level-2"><td colspan="2" style="font-size:9px;color:#666">Cross-check: closing − opening = ${formatCurrencyWithSign(cf.netChange)}. Classification residual: ${formatCurrencyWithSign(cf.reconciliationDiff)}</td></tr>
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
        (r) =>
          `<tr class="${r.key === 'close' ? 'total-row' : ''}"><td>${esc(r.label)}</td><td class="text-right font-mono">${formatCurrency(r.shareCapital)}</td><td class="text-right font-mono">${formatCurrencyWithSign(r.retainedAndOther)}</td><td class="text-right font-mono">${formatCurrencyWithSign(r.total)}</td></tr>`
      )
      .join('');
    const content = `
      <div class="section">
        <p style="font-size:10px;color:#555;margin-bottom:10px">Share capital (3100); retained &amp; other is the residual of total equity (assets − liabilities) after share capital. Profit for the period matches the statement of profit or loss for the same dates.</p>
        <table>
          <thead><tr><th>Description</th><th class="text-right">Share capital</th><th class="text-right">Retained &amp; other</th><th class="text-right">Total equity</th></tr></thead>
          <tbody>${body}</tbody>
        </table>
      </div>`;
    openPrintPreview(generateReportHTML('STATEMENT OF CHANGES IN EQUITY', periodLabel, content));
  }, [socie, periodLabel]);

  const handlePostPeriodClose = useCallback(() => {
    setCloseMessage(null);
    if (!closeAsOfDate) {
      setCloseMessage('Choose a closing date.');
      return;
    }
    if (
      !window.confirm(
        `Post profit/loss close to retained earnings (GL ${RETAINED_EARNINGS_GL}) as at ${closeAsOfDate}? This creates a posted journal entry, and locks every date on or before ${closeAsOfDate} against new postings.`
      )
    ) {
      return;
    }
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
  const ReportOptions = () => (
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
            {[2024, 2025, 2026].map((y) => (
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
          {[2024, 2025, 2026].map((y) => (
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
        <div className="border-b border-slate-200 px-3 md:px-4 py-2.5">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <h1 className="text-lg md:text-xl font-bold text-gray-800 shrink-0">📊 Financial Reports</h1>
            <div className="flex flex-wrap items-center gap-2">{periodControls}</div>
          </div>
          <p className="text-xs text-gray-500 mt-1.5 md:hidden">{periodRangeLabel}</p>
        </div>

        <CardBody className="p-0">
          <Tabs
            selectedKey={selectedTab}
            onSelectionChange={(key) => setSelectedTab(key as string)}
            className="w-full"
            size="sm"
            variant="underlined"
            classNames={{
              tabList: 'gap-0 px-2 bg-slate-50/80 border-b border-slate-200 overflow-x-auto flex-nowrap scrollbar-thin',
              tab: 'px-2.5 sm:px-3 min-w-fit text-xs sm:text-sm',
              tabContent: 'text-xs sm:text-sm',
              cursor: 'bg-ghana-green',
              panel: 'p-0',
            }}
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
                    </CardBody>
                  </Card>
                  <Card className="bg-slate-50 border border-slate-200 shadow-none">
                    <CardBody className="py-4 text-center">
                      <div className="text-lg md:text-2xl font-bold text-slate-700">{formatCurrency(totals.totalExpenses, true)}</div>
                      <div className="text-xs md:text-sm text-slate-500">Total Expenses</div>
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
                    </CardBody>
                  </Card>
                  <Card className="bg-slate-50 border border-slate-200 shadow-none">
                    <CardBody className="py-4 text-center">
                      <div className="text-lg md:text-2xl font-bold text-slate-700">{formatCurrencyWithSign(totals.totalAssets, true)}</div>
                      <div className="text-xs md:text-sm text-slate-500">Total Assets</div>
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
                        <div className="flex justify-between"><span className="text-gray-600">Total Equity</span><span className="font-mono">{formatCurrencyWithSign(totals.totalEquity, true)}</span></div>
                        <Divider />
                        <div className="flex justify-between font-semibold">
                          <span>Liabilities + Equity</span>
                          <span className="font-mono">{formatCurrencyWithSign(totals.totalLiabAndEquity, true)}</span>
                        </div>
                      </div>
                    </CardBody>
                  </Card>
                </div>

                {/* Balance Check — real debit=credit check across every posted journal entry
                    through the report date. (Assets vs Liabilities+Equity can't be used here:
                    Equity is displayed as a plug, Assets − Liabilities by construction, so that
                    comparison is always exactly zero regardless of what's actually posted.) */}
                <Card className={`mt-4 shadow-none border ${Math.abs(trialBalanceTotals.debit - trialBalanceTotals.credit) < 0.01 ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
                  <CardBody className="py-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-gray-700">Balance Check (Debits = Credits, all posted entries)</span>
                      <Chip size="sm" variant="flat" color={Math.abs(trialBalanceTotals.debit - trialBalanceTotals.credit) < 0.01 ? 'success' : 'warning'}>
                        {Math.abs(trialBalanceTotals.debit - trialBalanceTotals.credit) < 0.01 ? '✓ Balanced' : '⚠ Difference: ' + formatCurrency(Math.abs(trialBalanceTotals.debit - trialBalanceTotals.credit), true)}
                      </Chip>
                    </div>
                  </CardBody>
                </Card>

                {unmappedGlCodes.length > 0 && (
                  <Card className="mt-3 shadow-none border bg-rose-50 border-rose-200">
                    <CardBody className="py-3 text-sm">
                      <p className="font-medium text-rose-800">
                        ⚠ Posted entries reference {unmappedGlCodes.length} account code{unmappedGlCodes.length > 1 ? 's' : ''} not in your Chart of Accounts
                      </p>
                      <p className="text-rose-700 text-xs mt-1">
                        These amounts are real (posted) but excluded from every total above — add the code(s) below to
                        the Chart of Accounts, or fix the entries listed under each, to bring them into your reports and
                        resolve the balance difference.
                      </p>
                      <div className="mt-2 space-y-2.5">
                        {unmappedGlCodes.map((u) => (
                          <div key={u.code}>
                            <div className="flex justify-between font-mono text-xs font-semibold text-rose-800">
                              <span>{u.code}</span>
                              <span>{u.debit > 0 ? `Dr ${formatCurrency(u.debit, true)}` : `Cr ${formatCurrency(u.credit, true)}`}</span>
                            </div>
                            <ul className="mt-1 ml-2 space-y-0.5 border-l-2 border-rose-200 pl-2">
                              {u.entries.map((e) => (
                                <li key={e.journalEntryId} className="flex justify-between gap-3 text-[11px] text-rose-700">
                                  <span className="truncate">
                                    {e.entryNumber || e.journalEntryId} · {new Date(e.date).toLocaleDateString()}
                                    {e.sourceModule ? ` · ${e.sourceModule}` : ''}{e.reference ? ` · ${e.reference}` : ''}
                                  </span>
                                  <span className="font-mono shrink-0">
                                    {e.debit > 0 ? `Dr ${formatCurrency(e.debit, true)}` : `Cr ${formatCurrency(e.credit, true)}`}
                                  </span>
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
                        These amounts are counted in every total above — not invisible like an unmapped code — but a
                        header account summarizes its child accounts and isn't meant to be posted to directly, which is
                        why a specific child below can show a smaller balance than its own parent. Repost the entries
                        listed below to the correct child account.
                      </p>
                      <div className="mt-2 space-y-2.5">
                        {nonLeafPostings.map((u) => (
                          <div key={u.code}>
                            <div className="flex justify-between font-mono text-xs font-semibold text-amber-800">
                              <span>{u.code} — {u.name}</span>
                              <span>{u.debit > 0 ? `Dr ${formatCurrency(u.debit, true)}` : `Cr ${formatCurrency(u.credit, true)}`}</span>
                            </div>
                            <ul className="mt-1 ml-2 space-y-0.5 border-l-2 border-amber-200 pl-2">
                              {u.entries.map((e) => (
                                <li key={e.journalEntryId} className="flex justify-between gap-3 text-[11px] text-amber-700">
                                  <span className="truncate">
                                    {e.entryNumber || e.journalEntryId} · {new Date(e.date).toLocaleDateString()}
                                    {e.sourceModule ? ` · ${e.sourceModule}` : ''}{e.reference ? ` · ${e.reference}` : ''}
                                  </span>
                                  <span className="font-mono shrink-0">
                                    {e.debit > 0 ? `Dr ${formatCurrency(e.debit, true)}` : `Cr ${formatCurrency(e.credit, true)}`}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    </CardBody>
                  </Card>
                )}
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
                
                <ReportOptions />

                <Card className="shadow-none border overflow-hidden">
                  <CardBody className="p-0">
                    {/* Revenue Section */}
                    <div className="border-b">
                      <div className="bg-slate-100 px-4 py-2 font-semibold text-gray-700 text-sm uppercase tracking-wide">Revenue</div>
                      <div className="overflow-x-auto">
                        <Table removeWrapper aria-label="Revenue" classNames={{ th: "bg-slate-50 text-gray-600", table: "min-w-[420px]" }}>
                          <TableHeader>
                            <TableColumn>Account</TableColumn>
                            <TableColumn width={150} className="text-right">Amount</TableColumn>
                          </TableHeader>
                          <TableBody emptyContent="No revenue accounts.">{renderAccountRows(revenueAccounts)}</TableBody>
                        </Table>
                      </div>
                      <div className="bg-slate-100 px-4 py-2 flex justify-between font-semibold border-t">
                        <span>Total Revenue</span>
                        <span className="font-mono">{formatCurrency(totals.totalRevenue, true)}</span>
                      </div>
                    </div>

                    {/* Expenses Section */}
                    <div className="border-b">
                      <div className="bg-slate-100 px-4 py-2 font-semibold text-gray-700 text-sm uppercase tracking-wide">Less: Expenses</div>
                      <div className="overflow-x-auto">
                        <Table removeWrapper aria-label="Expenses" classNames={{ th: "bg-slate-50 text-gray-600", table: "min-w-[420px]" }}>
                          <TableHeader>
                            <TableColumn>Account</TableColumn>
                            <TableColumn width={150} className="text-right">Amount</TableColumn>
                          </TableHeader>
                          <TableBody emptyContent="No expense accounts.">{renderAccountRows(expenseAccounts)}</TableBody>
                        </Table>
                      </div>
                      <div className="bg-slate-100 px-4 py-2 flex justify-between font-semibold border-t">
                        <span>Total Expenses</span>
                        <span className="font-mono">({formatCurrency(totals.totalExpenses, true)})</span>
                      </div>
                    </div>

                    {/* Net Income */}
                    <div className={`px-4 py-4 flex justify-between font-bold text-lg ${totals.netIncome >= 0 ? 'bg-emerald-50' : 'bg-rose-50'}`}>
                      <span>NET {totals.netIncome >= 0 ? 'PROFIT' : 'LOSS'} FOR THE PERIOD</span>
                      <span className={`font-mono ${totals.netIncome >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                        {totals.netIncome < 0 && '('}{formatCurrency(Math.abs(totals.netIncome), true)}{totals.netIncome < 0 && ')'}
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

                <ReportOptions />

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
                        <Table removeWrapper aria-label="Assets" classNames={{ th: "bg-slate-50 text-gray-600", table: "min-w-[320px]" }}>
                          <TableHeader>
                            <TableColumn>Account</TableColumn>
                            <TableColumn width={120} className="text-right">Amount</TableColumn>
                          </TableHeader>
                          <TableBody emptyContent="No asset accounts.">{renderAccountRows(assetAccounts)}</TableBody>
                        </Table>
                      </div>
                      {/* mt-auto only does anything in Account Form's flex column (h-full/flex-1
                          above), where it pins this to the bottom of whichever card is taller —
                          keeping TOTAL ASSETS level with TOTAL LIABILITIES & EQUITY, the whole
                          point of the T layout. In Report Form these classes are inert. */}
                      <div className="bg-slate-200 px-4 py-2 flex justify-between font-bold border-t-2 border-slate-300 mt-auto">
                        <span>TOTAL ASSETS</span>
                        <span className="font-mono">{formatCurrencyWithSign(totals.totalAssets, true)}</span>
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
                          <Table removeWrapper aria-label="Liabilities" classNames={{ th: "bg-white text-gray-500", table: "min-w-[320px]" }}>
                            <TableHeader>
                              <TableColumn>Account</TableColumn>
                              <TableColumn width={120} className="text-right">Amount</TableColumn>
                            </TableHeader>
                            <TableBody emptyContent="No liabilities.">{renderAccountRows(liabilityAccounts)}</TableBody>
                          </Table>
                        </div>
                        <div className="bg-slate-100 px-4 py-1 flex justify-between font-semibold text-sm">
                          <span>Total Liabilities</span>
                          <span className="font-mono">{formatCurrencyWithSign(totals.totalLiabilities, true)}</span>
                        </div>
                      </div>
                      {/* Equity */}
                      <div className="border-b">
                        <div className="bg-slate-50 px-4 py-1 font-medium text-gray-600 text-xs uppercase">Equity</div>
                        <div className="overflow-x-auto">
                          <Table removeWrapper aria-label="Equity" classNames={{ th: "bg-white text-gray-500", table: "min-w-[320px]" }}>
                            <TableHeader>
                              <TableColumn>Account</TableColumn>
                              <TableColumn width={120} className="text-right">Amount</TableColumn>
                            </TableHeader>
                            <TableBody>
                              {[
                                ...renderAccountRows(equityAccounts),
                                ...(Math.abs(totals.accumulatedUnclosedPlug) >= 0.01
                                  ? [
                                      <TableRow key="accumulated-plug">
                                        <TableCell className="pl-6 italic text-gray-600">
                                          Accumulated results (unclosed P&amp;L to equity GL)
                                        </TableCell>
                                        <TableCell className="text-right font-mono text-sm">
                                          {formatCurrencyWithSign(totals.accumulatedUnclosedPlug)}
                                        </TableCell>
                                      </TableRow>,
                                    ]
                                  : []),
                              ]}
                            </TableBody>
                          </Table>
                        </div>
                        <p className="text-xs text-gray-500 px-4 py-2 border-b border-slate-100">
                          Profit / (loss) for the selected period (SoPL):{' '}
                          <span className="font-mono">{formatCurrencyWithSign(totals.netIncome)}</span> — informational; total equity
                          reconciles assets less liabilities (IAS 1).
                        </p>
                        <div className="bg-slate-100 px-4 py-1 flex justify-between font-semibold text-sm">
                          <span>Total Equity</span>
                          <span className="font-mono">{formatCurrencyWithSign(totals.totalEquity, true)}</span>
                        </div>
                      </div>
                      <div className="bg-slate-200 px-4 py-2 flex justify-between font-bold border-t-2 border-slate-300 mt-auto">
                        <span>TOTAL LIABILITIES & EQUITY</span>
                        <span className="font-mono">{formatCurrencyWithSign(totals.totalLiabAndEquity, true)}</span>
                      </div>
                    </CardBody>
                  </Card>
                </div>

                {/* Balance Check — real debit=credit check across every posted journal entry
                    through the report date. (Assets vs Liabilities+Equity isn't shown here:
                    Equity is displayed as a plug, Assets − Liabilities by construction, so that
                    comparison is always exactly zero regardless of what's actually posted.) */}
                <Card className={`mt-4 shadow-none border ${Math.abs(trialBalanceTotals.debit - trialBalanceTotals.credit) < 0.01 ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
                  <CardBody className="py-3">
                    <div className="flex items-center justify-center gap-4 text-sm flex-wrap">
                      <span>Debits: <span className="font-mono font-semibold">{formatCurrency(trialBalanceTotals.debit, true)}</span></span>
                      <span className="text-gray-400">=</span>
                      <span>Credits: <span className="font-mono font-semibold">{formatCurrency(trialBalanceTotals.credit, true)}</span></span>
                      <Chip size="sm" variant="flat" color={Math.abs(trialBalanceTotals.debit - trialBalanceTotals.credit) < 0.01 ? 'success' : 'warning'}>
                        {Math.abs(trialBalanceTotals.debit - trialBalanceTotals.credit) < 0.01 ? '✓ Balanced' : '⚠ Diff: ' + formatCurrency(Math.abs(trialBalanceTotals.debit - trialBalanceTotals.credit), true)}
                      </Chip>
                    </div>
                  </CardBody>
                </Card>
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
                          onValueChange={setCloseAsOfDate}
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
                      One posted close per calendar date. Once posted, every posting path (folio checkout,
                      manual invoices/payments, departmental capture) refuses new entries dated on or before
                      this date — reopen by voiding the close entry if a correction is needed.
                      Reversals are not automated — void or adjust manually if needed.
                    </p>
                  </CardBody>
                </Card>

                <Card className="shadow-none border overflow-hidden">
                  <CardBody className="p-0">
                    <div className="overflow-x-auto">
                    <Table removeWrapper aria-label="Statement of changes in equity" classNames={{ th: 'bg-slate-50 text-gray-600', table: 'min-w-[600px]' }}>
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
                            className={r.key === 'close' ? 'bg-slate-100 font-semibold' : ''}
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
                      Cash and bank accounts (1000, 1100, 1110, 1120) — operating / investing / financing split.
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
                  <Card className="shadow-none border overflow-hidden">
                    <CardHeader className="bg-slate-100 py-2 border-b">
                      <h4 className="font-semibold text-gray-700 text-sm">Operating activities</h4>
                    </CardHeader>
                    <CardBody>
                      <div className="flex justify-between font-semibold text-sm">
                        <span>Net cash from operating activities</span>
                        <span className="font-mono">{formatCurrencyWithSign(cashFlow.operating)}</span>
                      </div>
                    </CardBody>
                  </Card>
                  <Card className="shadow-none border overflow-hidden">
                    <CardHeader className="bg-slate-100 py-2 border-b">
                      <h4 className="font-semibold text-gray-700 text-sm">Investing activities</h4>
                    </CardHeader>
                    <CardBody>
                      <div className="flex justify-between font-semibold text-sm">
                        <span>Net cash from investing activities</span>
                        <span className="font-mono">{formatCurrencyWithSign(cashFlow.investing)}</span>
                      </div>
                    </CardBody>
                  </Card>
                  <Card className="shadow-none border overflow-hidden">
                    <CardHeader className="bg-slate-100 py-2 border-b">
                      <h4 className="font-semibold text-gray-700 text-sm">Financing activities</h4>
                    </CardHeader>
                    <CardBody>
                      <div className="flex justify-between font-semibold text-sm">
                        <span>Net cash from financing activities</span>
                        <span className="font-mono">{formatCurrencyWithSign(cashFlow.financing)}</span>
                      </div>
                    </CardBody>
                  </Card>
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
                      Cumulative posted balances through the reporting date.
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
                      <Table removeWrapper aria-label="Trial Balance" classNames={{ th: "bg-slate-100 text-gray-600 font-semibold", table: "min-w-[560px]" }}>
                        <TableHeader>
                          <TableColumn>Account</TableColumn>
                          <TableColumn width={150} className="text-right">Debit</TableColumn>
                          <TableColumn width={150} className="text-right">Credit</TableColumn>
                        </TableHeader>
                        <TableBody emptyContent="No posted journal activity through the reporting date.">
                          {renderAccountRows(accountTreeCumulative, true)}
                        </TableBody>
                      </Table>
                    </div>

                    {/* Totals */}
                    <div className="bg-slate-200 px-4 py-3 flex flex-wrap justify-end gap-x-8 gap-y-1 font-bold border-t-2 border-slate-300">
                      <div className="text-sm">
                        <span className="text-gray-600 mr-2">Total Debit:</span>
                        <span className="font-mono">{formatCurrency(trialBalanceTotals.debit, true)}</span>
                      </div>
                      <div className="text-sm">
                        <span className="text-gray-600 mr-2">Total Credit:</span>
                        <span className="font-mono">{formatCurrency(trialBalanceTotals.credit, true)}</span>
                      </div>
                      <Chip size="sm" variant="flat" color={Math.abs(trialBalanceTotals.debit - trialBalanceTotals.credit) < 0.01 ? 'success' : 'warning'}>
                        {Math.abs(trialBalanceTotals.debit - trialBalanceTotals.credit) < 0.01 ? '✓ Balanced' : '⚠ Diff: ' + formatCurrency(Math.abs(trialBalanceTotals.debit - trialBalanceTotals.credit), true)}
                      </Chip>
                    </div>
                  </CardBody>
                </Card>
              </div>
            </Tab>
          </Tabs>
        </CardBody>
      </Card>
    </div>
  );
}
