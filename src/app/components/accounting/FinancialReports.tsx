'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { 
  Card, CardBody, CardHeader, Button, Input, Select, SelectItem,
  Table, TableHeader, TableColumn, TableBody, TableRow, TableCell,
  Chip, Tabs, Tab, Divider, Spinner, Dropdown, DropdownTrigger, DropdownMenu, DropdownItem,
  Checkbox, RadioGroup, Radio
} from "@heroui/react";
import { useAccountingStore } from '@/app/lib/accounting/store';
import { GHANA_CHART_OF_ACCOUNTS } from '@/app/lib/accounting/models';

// ==================== TYPES ====================
interface AccountNode {
  code: string;
  name: string;
  type: string;
  category: string;
  level: number;
  balance: number;
  debit: number;
  credit: number;
  children: AccountNode[];
}

type PeriodType = 'custom' | 'month' | 'quarter' | 'year' | 'ytd';
type ReportFormat = 'summary' | 'detailed';

// ==================== HELPERS ====================
const formatCurrency = (amount: number, showZero = false) => {
  if (!showZero && Math.abs(amount) < 0.01) return '-';
  return `₵${Math.abs(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatCurrencyWithSign = (amount: number) => {
  if (Math.abs(amount) < 0.01) return '-';
  const sign = amount < 0 ? '(' : '';
  const end = amount < 0 ? ')' : '';
  return `${sign}₵${Math.abs(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${end}`;
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
const generateReportHTML = (title: string, companyName: string, period: string, content: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${title} - ${companyName}</title>
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
    <h1>${companyName}</h1>
    <h2>${title}</h2>
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

const openPrintPreview = (html: string) => {
  const win = window.open('', '_blank');
  if (win) {
    win.document.write(html);
    win.document.close();
    setTimeout(() => win.print(), 500);
  }
};

// Download CSV helper
const downloadCSV = (data: any[], filename: string, columns: { key: string; label: string }[]) => {
  const header = columns.map(c => c.label).join(',');
  const rows = data.map(row => 
    columns.map(c => {
      const val = row[c.key];
      const str = String(val ?? '').replace(/"/g, '""');
      return str.includes(',') ? `"${str}"` : str;
    }).join(',')
  );
  const csv = [header, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
  URL.revokeObjectURL(url);
};

// ==================== MAIN COMPONENT ====================
export default function FinancialReportsPage() {
  const {
    chartOfAccounts,
    journalEntries,
    payments,
    initializeAccounting,
    isLoading,
  } = useAccountingStore();

  // ==================== STATE ====================
  const [selectedTab, setSelectedTab] = useState("overview");
  const [companyName] = useState("MENISH HOTEL LIMITED");
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

  const expandAll = () => setExpandedSections(new Set(['all', ...chartOfAccounts.map(a => a.code)]));
  const collapseAll = () => setExpandedSections(new Set());

  // ==================== PERIOD CALCULATIONS ====================
  const { startDate, endDate } = useMemo(() => 
    getPeriodDates(periodType, selectedMonth, selectedQuarter, selectedYear, customDateFrom, customDateTo),
    [periodType, selectedMonth, selectedQuarter, selectedYear, customDateFrom, customDateTo]
  );

  const periodLabel = useMemo(() => {
    const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };
    if (periodType === 'ytd') {
      return `Year to Date (${startDate.toLocaleDateString('en-GB', options)} - ${endDate.toLocaleDateString('en-GB', options)})`;
    }
    if (periodType === 'month') {
      return startDate.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    }
    if (periodType === 'quarter') {
      return `${selectedQuarter} ${selectedYear}`;
    }
    if (periodType === 'year') {
      return `Year Ended 31 December ${selectedYear}`;
    }
    return `${startDate.toLocaleDateString('en-GB', options)} to ${endDate.toLocaleDateString('en-GB', options)}`;
  }, [periodType, startDate, endDate, selectedQuarter, selectedYear]);

  // ==================== BUILD ACCOUNT TREE FROM COA ====================
  const accountTree = useMemo(() => {
    // Use chart of accounts from store or default Ghana COA
    const allAccounts = chartOfAccounts.length > 0 ? chartOfAccounts : GHANA_CHART_OF_ACCOUNTS;
    
    // Build account balances from journal entries within period
    const accountBalances: Record<string, { debit: number; credit: number }> = {};
    
    // Initialize all accounts with zero
    allAccounts.forEach(acc => {
      accountBalances[acc.code] = { debit: 0, credit: 0 };
    });

    // Sum journal entries within date range
    journalEntries
      .filter(je => je.status === 'Posted')
      .filter(je => {
        const jeDate = new Date(je.date);
        return jeDate >= startDate && jeDate <= endDate;
      })
      .forEach(je => {
        je.lines.forEach(line => {
          if (!accountBalances[line.accountCode]) {
            accountBalances[line.accountCode] = { debit: 0, credit: 0 };
          }
          accountBalances[line.accountCode].debit += line.debit || 0;
          accountBalances[line.accountCode].credit += line.credit || 0;
        });
      });

    // Build hierarchical tree - Level 1 are root nodes
    const buildTree = (parentCode?: string, parentLevel?: number): AccountNode[] => {
      const targetLevel = parentLevel !== undefined ? parentLevel + 1 : 1;
      
      // Find accounts at target level that belong to parent
      const children = allAccounts.filter(acc => {
        if (acc.level !== targetLevel) return false;
        if (!parentCode) return true; // Level 1 - no parent filter
        // Check if this account is under the parent (same first digits based on level)
        const parentPrefix = parentCode.slice(0, parentLevel === 1 ? 2 : parentLevel === 2 ? 3 : 4);
        return acc.code.startsWith(parentPrefix);
      });

      return children.map(acc => {
        const bal = accountBalances[acc.code] || { debit: 0, credit: 0 };
        const childNodes = buildTree(acc.code, acc.level);
        
        // Sum up children balances
        const childrenDebit = childNodes.reduce((s, c) => s + c.debit, 0);
        const childrenCredit = childNodes.reduce((s, c) => s + c.credit, 0);
        const totalDebit = bal.debit + childrenDebit;
        const totalCredit = bal.credit + childrenCredit;
        
        // Calculate net balance based on normal balance for account type
        let balance = 0;
        if (acc.type === 'Asset' || acc.type === 'Expense') {
          balance = totalDebit - totalCredit; // Debit normal
        } else {
          balance = totalCredit - totalDebit; // Credit normal
        }

        return {
          code: acc.code,
          name: acc.name,
          type: acc.type,
          category: acc.category || '',
          level: acc.level,
          debit: totalDebit,
          credit: totalCredit,
          balance,
          children: childNodes,
        };
      });
    };

    return buildTree();
  }, [chartOfAccounts, journalEntries, startDate, endDate]);

  // Filter tree by type
  const getAccountsByType = useCallback((type: string) => accountTree.filter(node => node.type === type), [accountTree]);
  
  const assetAccounts = useMemo(() => getAccountsByType('Asset'), [getAccountsByType]);
  const liabilityAccounts = useMemo(() => getAccountsByType('Liability'), [getAccountsByType]);
  const equityAccounts = useMemo(() => getAccountsByType('Equity'), [getAccountsByType]);
  const revenueAccounts = useMemo(() => getAccountsByType('Revenue'), [getAccountsByType]);
  const expenseAccounts = useMemo(() => getAccountsByType('Expense'), [getAccountsByType]);

  // ==================== CALCULATIONS ====================
  const totals = useMemo(() => {
    const sumBalance = (nodes: AccountNode[]): number => nodes.reduce((s, n) => s + n.balance, 0);
    
    const totalAssets = sumBalance(assetAccounts);
    const totalLiabilities = sumBalance(liabilityAccounts);
    const totalEquity = sumBalance(equityAccounts);
    const totalRevenue = sumBalance(revenueAccounts);
    const totalExpenses = sumBalance(expenseAccounts);
    const netIncome = totalRevenue - totalExpenses;
    
    return {
      totalAssets,
      totalLiabilities,
      totalEquity,
      totalEquityWithIncome: totalEquity + netIncome,
      totalRevenue,
      totalExpenses,
      netIncome,
      totalLiabAndEquity: totalLiabilities + totalEquity + netIncome,
    };
  }, [assetAccounts, liabilityAccounts, equityAccounts, revenueAccounts, expenseAccounts]);

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
    return flattenTree(accountTree);
  }, [accountTree, showZeroBalances, expandedSections]);

  const trialBalanceTotals = useMemo(() => ({
    debit: trialBalanceRows.reduce((s, r) => s + (r.debit || 0), 0),
    credit: trialBalanceRows.reduce((s, r) => s + (r.credit || 0), 0),
  }), [trialBalanceRows]);

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
      
      rows.push(
        <TableRow key={node.code} className={`hover:bg-slate-50 ${bgClass}`}>
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
          {showDebitCredit ? (
            <>
              <TableCell className="text-right font-mono text-sm">
                {node.debit > node.credit ? formatCurrency(node.debit - node.credit) : '-'}
              </TableCell>
              <TableCell className="text-right font-mono text-sm">
                {node.credit > node.debit ? formatCurrency(node.credit - node.debit) : '-'}
              </TableCell>
            </>
          ) : (
            <TableCell className={`text-right font-mono text-sm ${node.balance < 0 ? 'text-rose-600' : ''}`}>
              {formatCurrencyWithSign(node.balance)}
            </TableCell>
          )}
        </TableRow>
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
    const renderRows = (nodes: AccountNode[], level = 0): string => {
      return nodes.map(node => {
        const indent = '&nbsp;'.repeat(level * 6);
        const levelClass = level === 0 ? 'level-1' : level === 1 ? 'level-2' : 'level-3';
        const debitBal = node.debit > node.credit ? node.debit - node.credit : 0;
        const creditBal = node.credit > node.debit ? node.credit - node.debit : 0;
        const row = `<tr class="${levelClass}">
          <td class="font-mono">${node.code}</td>
          <td>${indent}${node.name}</td>
          <td>${node.type}</td>
          <td class="text-right font-mono">${debitBal > 0 ? formatCurrency(debitBal) : '-'}</td>
          <td class="text-right font-mono">${creditBal > 0 ? formatCurrency(creditBal) : '-'}</td>
        </tr>`;
        const children = node.children.length > 0 ? renderRows(node.children, level + 1) : '';
        return row + children;
      }).join('');
    };
    
    const content = `
      <table>
        <thead><tr><th>Code</th><th>Account Name</th><th>Type</th><th class="text-right">Debit</th><th class="text-right">Credit</th></tr></thead>
        <tbody>
          ${renderRows(accountTree)}
          <tr class="total-row">
            <td colspan="3" class="font-bold">TOTAL</td>
            <td class="text-right font-mono font-bold double-underline">${formatCurrency(trialBalanceTotals.debit)}</td>
            <td class="text-right font-mono font-bold double-underline">${formatCurrency(trialBalanceTotals.credit)}</td>
          </tr>
        </tbody>
      </table>
    `;
    openPrintPreview(generateReportHTML('TRIAL BALANCE', companyName, periodLabel, content));
  }, [accountTree, trialBalanceTotals, companyName, periodLabel]);

  const printIncomeStatement = useCallback(() => {
    const renderSection = (nodes: AccountNode[], isExpense = false): string => {
      return nodes.map(node => {
        const amount = isExpense ? node.balance : node.balance;
        const mainRow = `<tr class="level-1"><td>${node.code} ${node.name}</td><td class="text-right font-mono">${formatCurrency(amount)}</td></tr>`;
        const childRows = node.children.map(child => 
          `<tr class="level-2"><td>${child.code} ${child.name}</td><td class="text-right font-mono">${formatCurrency(child.balance)}</td></tr>`
        ).join('');
        return mainRow + childRows;
      }).join('');
    };
    
    const content = `
      <div class="section">
        <div class="section-title">Revenue</div>
        <table><tbody>${renderSection(revenueAccounts)}
          <tr class="subtotal-row"><td class="font-bold">Total Revenue</td><td class="text-right font-mono font-bold underline">${formatCurrency(totals.totalRevenue)}</td></tr>
        </tbody></table>
      </div>
      <div class="section">
        <div class="section-title">Less: Expenses</div>
        <table><tbody>${renderSection(expenseAccounts, true)}
          <tr class="subtotal-row"><td class="font-bold">Total Expenses</td><td class="text-right font-mono font-bold underline">(${formatCurrency(totals.totalExpenses)})</td></tr>
        </tbody></table>
      </div>
      <div class="section">
        <table><tbody>
          <tr class="total-row"><td class="font-bold">NET ${totals.netIncome >= 0 ? 'PROFIT' : 'LOSS'} FOR THE PERIOD</td><td class="text-right font-mono font-bold double-underline">${totals.netIncome >= 0 ? '' : '('}${formatCurrency(Math.abs(totals.netIncome))}${totals.netIncome >= 0 ? '' : ')'}</td></tr>
        </tbody></table>
      </div>
    `;
    openPrintPreview(generateReportHTML('STATEMENT OF COMPREHENSIVE INCOME', companyName, periodLabel, content));
  }, [revenueAccounts, expenseAccounts, totals, companyName, periodLabel]);

  const printBalanceSheet = useCallback(() => {
    const renderSection = (nodes: AccountNode[]): string => {
      return nodes.map(node => {
        const mainRow = `<tr class="level-1"><td>${node.code} ${node.name}</td><td class="text-right font-mono">${formatCurrency(node.balance)}</td></tr>`;
        const childRows = node.children.map(child => 
          `<tr class="level-2"><td>${child.code} ${child.name}</td><td class="text-right font-mono">${formatCurrency(child.balance)}</td></tr>`
        ).join('');
        return mainRow + childRows;
      }).join('');
    };
    
    const content = `
      <div class="section">
        <div class="section-title">Assets</div>
        <table><tbody>${renderSection(assetAccounts)}
          <tr class="total-row"><td class="font-bold">TOTAL ASSETS</td><td class="text-right font-mono font-bold double-underline">${formatCurrency(totals.totalAssets)}</td></tr>
        </tbody></table>
      </div>
      <div class="section">
        <div class="section-title">Liabilities</div>
        <table><tbody>${renderSection(liabilityAccounts)}
          <tr class="subtotal-row"><td class="font-bold">Total Liabilities</td><td class="text-right font-mono font-bold underline">${formatCurrency(totals.totalLiabilities)}</td></tr>
        </tbody></table>
      </div>
      <div class="section">
        <div class="section-title">Equity</div>
        <table><tbody>${renderSection(equityAccounts)}
          <tr class="level-2"><td>Retained Earnings (Current Period)</td><td class="text-right font-mono">${formatCurrency(totals.netIncome)}</td></tr>
          <tr class="subtotal-row"><td class="font-bold">Total Equity</td><td class="text-right font-mono font-bold underline">${formatCurrency(totals.totalEquityWithIncome)}</td></tr>
          <tr class="total-row"><td class="font-bold">TOTAL LIABILITIES AND EQUITY</td><td class="text-right font-mono font-bold double-underline">${formatCurrency(totals.totalLiabAndEquity)}</td></tr>
        </tbody></table>
      </div>
    `;
    openPrintPreview(generateReportHTML('STATEMENT OF FINANCIAL POSITION', companyName, periodLabel, content));
  }, [assetAccounts, liabilityAccounts, equityAccounts, totals, companyName, periodLabel]);

  // ==================== PERIOD SELECTOR COMPONENT ====================
  const PeriodSelector = () => (
    <Card className="mb-4 shadow-sm">
      <CardBody className="py-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[180px]">
            <label className="text-xs font-medium text-gray-500 mb-1 block">Period Type</label>
            <Select
              selectedKeys={[periodType]}
              onSelectionChange={(keys) => setPeriodType(Array.from(keys)[0] as PeriodType)}
              size="sm"
              className="w-full"
              variant="bordered"
            >
              <SelectItem key="ytd">Year to Date</SelectItem>
              <SelectItem key="month">Specific Month</SelectItem>
              <SelectItem key="quarter">Quarter</SelectItem>
              <SelectItem key="year">Full Year</SelectItem>
              <SelectItem key="custom">Custom Range</SelectItem>
            </Select>
          </div>

          {periodType === 'month' && (
            <div className="flex-1 min-w-[150px]">
              <label className="text-xs font-medium text-gray-500 mb-1 block">Month</label>
              <Input type="month" value={selectedMonth} onValueChange={setSelectedMonth} size="sm" variant="bordered" />
            </div>
          )}

          {periodType === 'quarter' && (
            <>
              <div className="w-24">
                <label className="text-xs font-medium text-gray-500 mb-1 block">Quarter</label>
                <Select selectedKeys={[selectedQuarter]} onSelectionChange={(keys) => setSelectedQuarter(Array.from(keys)[0] as string)} size="sm" variant="bordered">
                  <SelectItem key="Q1">Q1</SelectItem>
                  <SelectItem key="Q2">Q2</SelectItem>
                  <SelectItem key="Q3">Q3</SelectItem>
                  <SelectItem key="Q4">Q4</SelectItem>
                </Select>
              </div>
              <div className="w-28">
                <label className="text-xs font-medium text-gray-500 mb-1 block">Year</label>
                <Select selectedKeys={[selectedYear]} onSelectionChange={(keys) => setSelectedYear(Array.from(keys)[0] as string)} size="sm" variant="bordered">
                  {[2024, 2025, 2026].map(y => (<SelectItem key={String(y)}>{y}</SelectItem>))}
                </Select>
              </div>
            </>
          )}

          {periodType === 'year' && (
            <div className="w-28">
              <label className="text-xs font-medium text-gray-500 mb-1 block">Year</label>
              <Select selectedKeys={[selectedYear]} onSelectionChange={(keys) => setSelectedYear(Array.from(keys)[0] as string)} size="sm" variant="bordered">
                {[2024, 2025, 2026].map(y => (<SelectItem key={String(y)}>{y}</SelectItem>))}
              </Select>
            </div>
          )}

          {periodType === 'custom' && (
            <>
              <div className="flex-1 min-w-[140px]">
                <label className="text-xs font-medium text-gray-500 mb-1 block">From</label>
                <Input type="date" value={customDateFrom} onValueChange={setCustomDateFrom} size="sm" variant="bordered" />
              </div>
              <div className="flex-1 min-w-[140px]">
                <label className="text-xs font-medium text-gray-500 mb-1 block">To</label>
                <Input type="date" value={customDateTo} onValueChange={setCustomDateTo} size="sm" variant="bordered" />
              </div>
            </>
          )}

          <Button isIconOnly variant="light" onPress={handleRefresh} isDisabled={isRefreshing} size="sm" className="text-gray-500">
            {isRefreshing ? <Spinner size="sm" /> : '🔄'}
          </Button>
        </div>
        
        <div className="mt-2 text-sm text-gray-600">
          <span className="font-medium">Reporting Period:</span> {periodLabel}
        </div>
      </CardBody>
    </Card>
  );

  // ==================== REPORT OPTIONS ====================
  const ReportOptions = () => (
    <div className="flex flex-wrap items-center gap-4 mb-4 p-3 bg-slate-50 rounded-lg border border-slate-100">
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-600">View:</span>
        <RadioGroup orientation="horizontal" value={reportFormat} onValueChange={(v) => setReportFormat(v as ReportFormat)} size="sm">
          <Radio value="summary">Summary</Radio>
          <Radio value="detailed">Detailed</Radio>
        </RadioGroup>
      </div>
      <Divider orientation="vertical" className="h-5" />
      <Checkbox size="sm" isSelected={showZeroBalances} onValueChange={setShowZeroBalances} className="text-gray-600">
        Show zero balances
      </Checkbox>
      <Divider orientation="vertical" className="h-5" />
      <div className="flex gap-2">
        <Button size="sm" variant="flat" onPress={expandAll} className="text-gray-600">+ Expand</Button>
        <Button size="sm" variant="flat" onPress={collapseAll} className="text-gray-600">− Collapse</Button>
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-800">📊 Financial Reports</h1>
        <p className="text-gray-500 mt-1">{companyName}</p>
      </div>

      {/* Period Selector */}
      <PeriodSelector />

      {/* Main Tabs */}
      <Card className="shadow-sm">
        <CardBody className="p-0">
          <Tabs
            selectedKey={selectedTab}
            onSelectionChange={(key) => setSelectedTab(key as string)}
            className="w-full"
            classNames={{ tabList: "flex-wrap bg-slate-50 border-b" }}
            variant="underlined"
          >
            {/* ==================== OVERVIEW TAB ==================== */}
            <Tab key="overview" title="📈 Overview">
              <div className="p-4 md:p-6">
                {/* Key Metrics - Mild colors */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
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
                      <div className="text-lg md:text-2xl font-bold text-slate-700">{formatCurrency(totals.totalAssets, true)}</div>
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
                        <div className="flex justify-between"><span className="text-gray-600">Total Assets</span><span className="font-mono">{formatCurrency(totals.totalAssets, true)}</span></div>
                        <div className="flex justify-between"><span className="text-gray-600">Total Liabilities</span><span className="font-mono">{formatCurrency(totals.totalLiabilities, true)}</span></div>
                        <div className="flex justify-between"><span className="text-gray-600">Total Equity</span><span className="font-mono">{formatCurrency(totals.totalEquityWithIncome, true)}</span></div>
                        <Divider />
                        <div className="flex justify-between font-semibold">
                          <span>Liabilities + Equity</span>
                          <span className="font-mono">{formatCurrency(totals.totalLiabAndEquity, true)}</span>
                        </div>
                      </div>
                    </CardBody>
                  </Card>
                </div>

                {/* Balance Check */}
                <Card className={`mt-4 shadow-none border ${Math.abs(totals.totalAssets - totals.totalLiabAndEquity) < 0.01 ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
                  <CardBody className="py-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-gray-700">Balance Check (Assets = Liabilities + Equity)</span>
                      <Chip size="sm" variant="flat" color={Math.abs(totals.totalAssets - totals.totalLiabAndEquity) < 0.01 ? 'success' : 'warning'}>
                        {Math.abs(totals.totalAssets - totals.totalLiabAndEquity) < 0.01 ? '✓ Balanced' : '⚠ Difference: ' + formatCurrency(Math.abs(totals.totalAssets - totals.totalLiabAndEquity), true)}
                      </Chip>
                    </div>
                  </CardBody>
                </Card>
              </div>
            </Tab>

            {/* ==================== INCOME STATEMENT TAB ==================== */}
            <Tab key="income-statement" title="📈 Income Statement">
              <div className="p-4 md:p-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800">Statement of Comprehensive Income</h3>
                    <p className="text-sm text-gray-500">{periodLabel}</p>
                  </div>
                  <Dropdown>
                    <DropdownTrigger><Button variant="bordered" size="sm">📥 Export</Button></DropdownTrigger>
                    <DropdownMenu>
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
                      <Table removeWrapper aria-label="Revenue" classNames={{ th: "bg-slate-50 text-gray-600" }}>
                        <TableHeader>
                          <TableColumn>Account</TableColumn>
                          <TableColumn width={150} className="text-right">Amount</TableColumn>
                        </TableHeader>
                        <TableBody emptyContent="No revenue accounts.">{renderAccountRows(revenueAccounts)}</TableBody>
                      </Table>
                      <div className="bg-slate-100 px-4 py-2 flex justify-between font-semibold border-t">
                        <span>Total Revenue</span>
                        <span className="font-mono">{formatCurrency(totals.totalRevenue, true)}</span>
                      </div>
                    </div>

                    {/* Expenses Section */}
                    <div className="border-b">
                      <div className="bg-slate-100 px-4 py-2 font-semibold text-gray-700 text-sm uppercase tracking-wide">Less: Expenses</div>
                      <Table removeWrapper aria-label="Expenses" classNames={{ th: "bg-slate-50 text-gray-600" }}>
                        <TableHeader>
                          <TableColumn>Account</TableColumn>
                          <TableColumn width={150} className="text-right">Amount</TableColumn>
                        </TableHeader>
                        <TableBody emptyContent="No expense accounts.">{renderAccountRows(expenseAccounts)}</TableBody>
                      </Table>
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
            <Tab key="balance-sheet" title="⚖️ Balance Sheet">
              <div className="p-4 md:p-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800">Statement of Financial Position</h3>
                    <p className="text-sm text-gray-500">As at {endDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                  </div>
                  <Dropdown>
                    <DropdownTrigger><Button variant="bordered" size="sm">📥 Export</Button></DropdownTrigger>
                    <DropdownMenu>
                      <DropdownItem key="print" onPress={printBalanceSheet}>🖨️ Print PDF</DropdownItem>
                    </DropdownMenu>
                  </Dropdown>
                </div>
                
                <ReportOptions />

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Assets */}
                  <Card className="shadow-none border overflow-hidden">
                    <CardHeader className="bg-slate-100 py-2 border-b"><h4 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">Assets</h4></CardHeader>
                    <CardBody className="p-0">
                      <Table removeWrapper aria-label="Assets" classNames={{ th: "bg-slate-50 text-gray-600" }}>
                        <TableHeader>
                          <TableColumn>Account</TableColumn>
                          <TableColumn width={120} className="text-right">Amount</TableColumn>
                        </TableHeader>
                        <TableBody emptyContent="No asset accounts.">{renderAccountRows(assetAccounts)}</TableBody>
                      </Table>
                      <div className="bg-slate-200 px-4 py-2 flex justify-between font-bold border-t-2 border-slate-300">
                        <span>TOTAL ASSETS</span>
                        <span className="font-mono">{formatCurrency(totals.totalAssets, true)}</span>
                      </div>
                    </CardBody>
                  </Card>

                  {/* Liabilities & Equity */}
                  <Card className="shadow-none border overflow-hidden">
                    <CardHeader className="bg-slate-100 py-2 border-b"><h4 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">Liabilities & Equity</h4></CardHeader>
                    <CardBody className="p-0">
                      {/* Liabilities */}
                      <div className="border-b">
                        <div className="bg-slate-50 px-4 py-1 font-medium text-gray-600 text-xs uppercase">Liabilities</div>
                        <Table removeWrapper aria-label="Liabilities" classNames={{ th: "bg-white text-gray-500" }}>
                          <TableHeader>
                            <TableColumn>Account</TableColumn>
                            <TableColumn width={120} className="text-right">Amount</TableColumn>
                          </TableHeader>
                          <TableBody emptyContent="No liabilities.">{renderAccountRows(liabilityAccounts)}</TableBody>
                        </Table>
                        <div className="bg-slate-100 px-4 py-1 flex justify-between font-semibold text-sm">
                          <span>Total Liabilities</span>
                          <span className="font-mono">{formatCurrency(totals.totalLiabilities, true)}</span>
                        </div>
                      </div>
                      {/* Equity */}
                      <div className="border-b">
                        <div className="bg-slate-50 px-4 py-1 font-medium text-gray-600 text-xs uppercase">Equity</div>
                        <Table removeWrapper aria-label="Equity" classNames={{ th: "bg-white text-gray-500" }}>
                          <TableHeader>
                            <TableColumn>Account</TableColumn>
                            <TableColumn width={120} className="text-right">Amount</TableColumn>
                          </TableHeader>
                          <TableBody>
                            {[
                              ...renderAccountRows(equityAccounts),
                              <TableRow key="retained-earnings">
                                <TableCell className="pl-6 italic text-gray-600">Retained Earnings (Current Period)</TableCell>
                                <TableCell className="text-right font-mono text-sm">{formatCurrency(totals.netIncome, true)}</TableCell>
                              </TableRow>
                            ]}
                          </TableBody>
                        </Table>
                        <div className="bg-slate-100 px-4 py-1 flex justify-between font-semibold text-sm">
                          <span>Total Equity</span>
                          <span className="font-mono">{formatCurrency(totals.totalEquityWithIncome, true)}</span>
                        </div>
                      </div>
                      <div className="bg-slate-200 px-4 py-2 flex justify-between font-bold border-t-2 border-slate-300">
                        <span>TOTAL LIABILITIES & EQUITY</span>
                        <span className="font-mono">{formatCurrency(totals.totalLiabAndEquity, true)}</span>
                      </div>
                    </CardBody>
                  </Card>
                </div>

                {/* Balance Check */}
                <Card className={`mt-4 shadow-none border ${Math.abs(totals.totalAssets - totals.totalLiabAndEquity) < 0.01 ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
                  <CardBody className="py-3">
                    <div className="flex items-center justify-center gap-4 text-sm flex-wrap">
                      <span>Assets: <span className="font-mono font-semibold">{formatCurrency(totals.totalAssets, true)}</span></span>
                      <span className="text-gray-400">=</span>
                      <span>Liab + Equity: <span className="font-mono font-semibold">{formatCurrency(totals.totalLiabAndEquity, true)}</span></span>
                      <Chip size="sm" variant="flat" color={Math.abs(totals.totalAssets - totals.totalLiabAndEquity) < 0.01 ? 'success' : 'warning'}>
                        {Math.abs(totals.totalAssets - totals.totalLiabAndEquity) < 0.01 ? '✓ Balanced' : '⚠ Diff: ' + formatCurrency(Math.abs(totals.totalAssets - totals.totalLiabAndEquity), true)}
                      </Chip>
                    </div>
                  </CardBody>
                </Card>
              </div>
            </Tab>

            {/* ==================== CASH FLOW TAB ==================== */}
            <Tab key="cash-flow" title="💸 Cash Flow">
              <div className="p-4 md:p-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800">Statement of Cash Flows</h3>
                    <p className="text-sm text-gray-500">{periodLabel}</p>
                  </div>
                  <Dropdown>
                    <DropdownTrigger><Button variant="bordered" size="sm">📥 Export</Button></DropdownTrigger>
                    <DropdownMenu>
                      <DropdownItem key="print">🖨️ Print PDF</DropdownItem>
                    </DropdownMenu>
                  </Dropdown>
                </div>

                <div className="space-y-4">
                  <Card className="shadow-none border overflow-hidden">
                    <CardHeader className="bg-slate-100 py-2 border-b"><h4 className="font-semibold text-gray-700 text-sm">Cash Flows from Operating Activities</h4></CardHeader>
                    <CardBody>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between pl-4"><span className="text-gray-600">Cash received from customers</span><span className="font-mono">{formatCurrency(payments.filter(p => p.type === 'Receipt').reduce((s, p) => s + p.amount, 0), true)}</span></div>
                        <div className="flex justify-between pl-4"><span className="text-gray-600">Cash paid to suppliers</span><span className="font-mono">({formatCurrency(payments.filter(p => p.type === 'Payment').reduce((s, p) => s + p.amount, 0), true)})</span></div>
                        <Divider />
                        <div className="flex justify-between font-semibold"><span>Net cash from operating activities</span><span className="font-mono">{formatCurrency(payments.filter(p => p.type === 'Receipt').reduce((s, p) => s + p.amount, 0) - payments.filter(p => p.type === 'Payment').reduce((s, p) => s + p.amount, 0), true)}</span></div>
                      </div>
                    </CardBody>
                  </Card>
                  <Card className="shadow-none border overflow-hidden">
                    <CardHeader className="bg-slate-100 py-2 border-b"><h4 className="font-semibold text-gray-700 text-sm">Cash Flows from Investing Activities</h4></CardHeader>
                    <CardBody><div className="text-sm text-gray-400 text-center py-2">No investing activities recorded</div></CardBody>
                  </Card>
                  <Card className="shadow-none border overflow-hidden">
                    <CardHeader className="bg-slate-100 py-2 border-b"><h4 className="font-semibold text-gray-700 text-sm">Cash Flows from Financing Activities</h4></CardHeader>
                    <CardBody><div className="text-sm text-gray-400 text-center py-2">No financing activities recorded</div></CardBody>
                  </Card>
                </div>
              </div>
            </Tab>

            {/* ==================== TRIAL BALANCE TAB ==================== */}
            <Tab key="trial-balance" title="📋 Trial Balance">
              <div className="p-4 md:p-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800">Trial Balance</h3>
                    <p className="text-sm text-gray-500">{periodLabel}</p>
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
                    <Table removeWrapper aria-label="Trial Balance" classNames={{ th: "bg-slate-100 text-gray-600 font-semibold" }}>
                      <TableHeader>
                        <TableColumn>Account</TableColumn>
                        <TableColumn width={150} className="text-right">Debit</TableColumn>
                        <TableColumn width={150} className="text-right">Credit</TableColumn>
                      </TableHeader>
                      <TableBody emptyContent="No transactions recorded for this period.">
                        {renderAccountRows(accountTree, true)}
                      </TableBody>
                    </Table>
                    
                    {/* Totals */}
                    <div className="bg-slate-200 px-4 py-3 flex justify-end gap-8 font-bold border-t-2 border-slate-300">
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
