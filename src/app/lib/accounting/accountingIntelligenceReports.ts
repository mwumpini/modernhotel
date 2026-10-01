'use client';

import type { BankAccount, BankTransaction, BusinessPartner, CostCenter, Invoice, JournalEntry, Payment, RevenueCenter } from './models';
import { GHANA_CHART_OF_ACCOUNTS } from './models';
import { toRollupCoa } from './coaHierarchy';
import { buildFinancialAccountTree, type AccountNode } from './financialReportRollup';
import { formatAccountingCurrency } from './tenantAccountingConfig';
import { rollupTaxLedger } from '../tax/ledgerRollup';
import { computeCostCenterActual, computeRevenueCenterActual } from './costRevenueRollup';
import type { ChartOfAccounts } from './models';

export type IntelColumn = { key: string; label: string; align?: 'right' };

export type IntelReport = {
  columns: IntelColumn[];
  rows: Record<string, string | number>[];
  kpis: { label: string; value: string }[];
  emptyHint: string;
};

type Input = {
  reportKey: string;
  startDate: string;
  endDate: string;
  journalEntries: JournalEntry[];
  chartOfAccounts: ChartOfAccounts[];
  invoices: Invoice[];
  payments: Payment[];
  bankAccounts: BankAccount[];
  bankTransactions: BankTransaction[];
  businessPartners: BusinessPartner[];
  costCenters: CostCenter[];
  revenueCenters: RevenueCenter[];
};

const money = (n: number) => formatAccountingCurrency(n);
const day = (iso?: string) => (iso || '').slice(0, 10);

function inRange(iso: string | undefined, start: string, end: string) {
  const d = day(iso);
  return Boolean(d) && d >= start && d <= end;
}

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function leaves(nodes: AccountNode[], into: AccountNode[] = []): AccountNode[] {
  for (const node of nodes) {
    if (node.children.length) leaves(node.children, into);
    else if (Math.abs(node.balance) > 0.004) into.push(node);
  }
  return into;
}

function periodDays(start: string, end: string) {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return Math.max(1, Math.round(ms / 86_400_000) + 1);
}

function ageDays(due: string, asOf: string) {
  const dueDay = day(due) || asOf;
  return Math.floor((new Date(`${asOf}T00:00:00`).getTime() - new Date(`${dueDay}T00:00:00`).getTime()) / 86_400_000);
}

function ageBucket(due: string, asOf: string) {
  const days = Math.floor((new Date(asOf).getTime() - new Date(due || asOf).getTime()) / 86_400_000);
  if (days <= 0) return 'Current';
  if (days <= 30) return '1–30 days';
  if (days <= 60) return '31–60 days';
  if (days <= 90) return '61–90 days';
  return 'Over 90 days';
}

/** Register balance from the last line before `asOf`, or on that day when `inclusive`. */
function registerBalance(lines: BankTransaction[], asOf: string, opening: number, inclusive: boolean) {
  const prior = lines.filter((line) => {
    const posted = day(line.transactionDate);
    return inclusive ? posted <= asOf : posted < asOf;
  });
  const last = prior[prior.length - 1];
  if (last && Number.isFinite(last.balance)) return round2(last.balance);
  return round2(opening);
}

function signedRegisterLine(line: BankTransaction, running: number) {
  if (line.type === 'Transfer' && Number.isFinite(line.balance)) return round2(line.balance - running);
  if (line.type === 'Withdrawal' || line.type === 'Charge') return -Math.abs(line.amount || 0);
  if (line.type === 'Transfer') {
    if (/transfer to/i.test(line.description || '')) return -Math.abs(line.amount || 0);
    if (/transfer from/i.test(line.description || '')) return Math.abs(line.amount || 0);
    return 0;
  }
  return Math.abs(line.amount || 0);
}

function openAmount(invoice: Invoice) {
  const due = invoice.amountDue ?? invoice.total - (invoice.paidAmount || 0);
  return round2(Math.max(0, due));
}

function empty(hint: string, columns: IntelColumn[] = [{ key: 'note', label: 'Note' }]): IntelReport {
  return { columns, rows: [], kpis: [], emptyHint: hint };
}

export function buildAccountingIntelligenceReport(input: Input): IntelReport {
  const {
    reportKey, startDate, endDate, journalEntries, invoices, payments,
    bankAccounts, bankTransactions, businessPartners, costCenters, revenueCenters,
  } = input;

  const coa = toRollupCoa(input.chartOfAccounts.length ? input.chartOfAccounts : GHANA_CHART_OF_ACCOUNTS);
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  const tree = buildFinancialAccountTree(coa, journalEntries, { kind: 'period', startDate: start, endDate: end });
  const position = buildFinancialAccountTree(coa, journalEntries, { kind: 'cumulative', endDate: end });
  const revenueLeaves = leaves(tree.filter((n) => n.type === 'Revenue'));
  const expenseLeaves = leaves(tree.filter((n) => n.type === 'Expense'));
  const revenueTotal = round2(revenueLeaves.reduce((s, n) => s + n.balance, 0));
  const expenseTotal = round2(expenseLeaves.reduce((s, n) => s + n.balance, 0));
  const net = round2(revenueTotal - expenseTotal);

  const partnerName = (id: string) => businessPartners.find((p) => p.id === id)?.name || id || '—';
  const posted = journalEntries.filter((je) => je.status === 'Posted' && inRange(je.date, startDate, endDate));
  const typeByCode = new Map(coa.map((a) => [a.code, a.type]));

  const glBalance = (codes: string[]) => {
    const set = new Set(codes);
    return round2(leaves(position).filter((n) => set.has(n.code)).reduce((s, n) => s + n.balance, 0));
  };

  const accountRows = (list: AccountNode[], kind: 'Revenue' | 'Expense'): IntelReport => ({
    columns: [
      { key: 'code', label: 'Account' },
      { key: 'name', label: 'Name' },
      { key: 'amount', label: 'Amount', align: 'right' },
    ],
    rows: [...list]
      .sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance))
      .map((n) => ({ code: n.code, name: n.name, amount: money(n.balance) })),
    kpis: [
      { label: kind === 'Revenue' ? 'Revenue' : 'Expenses', value: money(kind === 'Revenue' ? revenueTotal : expenseTotal) },
      { label: 'Accounts', value: String(list.length) },
    ],
    emptyHint: `No posted ${kind.toLowerCase()} in this period.`,
  });

  if (reportKey === 'revenue-account') return accountRows(revenueLeaves, 'Revenue');
  if (reportKey === 'expense-account' || reportKey === 'top-expenses') {
    const list = reportKey === 'top-expenses' ? [...expenseLeaves].sort((a, b) => b.balance - a.balance).slice(0, 10) : expenseLeaves;
    return accountRows(list, 'Expense');
  }

  if (reportKey === 'revenue-date' || reportKey === 'expense-trend' || reportKey === 'revenue-trend') {
    const byDay = new Map<string, { revenue: number; expense: number }>();
    for (const je of posted) {
      const d = day(je.date);
      const bucket = byDay.get(d) || { revenue: 0, expense: 0 };
      for (const line of je.lines) {
        const type = typeByCode.get(line.accountCode);
        if (type === 'Revenue') bucket.revenue += (line.credit || 0) - (line.debit || 0);
        if (type === 'Expense') bucket.expense += (line.debit || 0) - (line.credit || 0);
      }
      byDay.set(d, bucket);
    }
    const rows = [...byDay.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({
        date,
        revenue: money(v.revenue),
        expense: money(v.expense),
        net: money(v.revenue - v.expense),
      }));
    return {
      columns: [
        { key: 'date', label: 'Date' },
        { key: 'revenue', label: 'Revenue', align: 'right' },
        { key: 'expense', label: 'Expenses', align: 'right' },
        { key: 'net', label: 'Net', align: 'right' },
      ],
      rows,
      kpis: [
        { label: 'Revenue', value: money(revenueTotal) },
        { label: 'Expenses', value: money(expenseTotal) },
        { label: 'Net', value: money(net) },
      ],
      emptyHint: 'No posted revenue or expense on these dates.',
    };
  }

  if (reportKey === 'revenue-mix' || reportKey === 'gop' || reportKey === 'ebitda' || reportKey === 'expense-ratio' || reportKey === 'ratios') {
    const margin = revenueTotal ? (net / revenueTotal) * 100 : 0;
    const expensePct = revenueTotal ? (expenseTotal / revenueTotal) * 100 : 0;
    const currentAssets = round2(leaves(position).filter((n) => {
      const code = parseInt(n.code, 10);
      return n.type === 'Asset' && code >= 1000 && code < 1500;
    }).reduce((s, n) => s + n.balance, 0));
    const currentLiab = round2(leaves(position).filter((n) => {
      const code = parseInt(n.code, 10);
      return n.type === 'Liability' && code >= 2000 && code < 2500;
    }).reduce((s, n) => s + Math.abs(n.balance), 0));
    const rows = reportKey === 'revenue-mix'
      ? revenueLeaves.map((n) => ({
          account: `${n.code} ${n.name}`,
          amount: money(n.balance),
          mix: revenueTotal ? `${((n.balance / revenueTotal) * 100).toFixed(1)}%` : '—',
        }))
      : [
          { metric: 'Revenue', value: money(revenueTotal) },
          { metric: 'Expenses', value: money(expenseTotal) },
          { metric: 'Net profit / (loss)', value: money(net) },
          { metric: 'Net margin', value: `${margin.toFixed(1)}%` },
          { metric: 'Expense % of revenue', value: `${expensePct.toFixed(1)}%` },
          ...(reportKey === 'ratios'
            ? [
                { metric: 'Current assets', value: money(currentAssets) },
                { metric: 'Current liabilities', value: money(currentLiab) },
                { metric: 'Current ratio', value: currentLiab ? (currentAssets / currentLiab).toFixed(2) : '—' },
              ]
            : []),
        ];
    return {
      columns: reportKey === 'revenue-mix'
        ? [
            { key: 'account', label: 'Account' },
            { key: 'amount', label: 'Amount', align: 'right' },
            { key: 'mix', label: 'Mix', align: 'right' },
          ]
        : [
            { key: 'metric', label: 'Metric' },
            { key: 'value', label: 'Value', align: 'right' },
          ],
      rows: rows as Record<string, string>[],
      kpis: [
        { label: 'Revenue', value: money(revenueTotal) },
        { label: 'Net', value: money(net) },
        { label: 'Margin', value: `${margin.toFixed(1)}%` },
      ],
      emptyHint: reportKey === 'ebitda'
        ? 'EBITDA is shown as net profit until depreciation and interest accounts are tagged separately.'
        : 'No posted activity in this period.',
    };
  }

  if (reportKey === 'revenue-payment') {
    const receipts = payments.filter((p) => p.type === 'Receipt' && p.status === 'Posted' && inRange(p.date, startDate, endDate));
    const byMethod = new Map<string, number>();
    for (const p of receipts) byMethod.set(p.paymentMethod, (byMethod.get(p.paymentMethod) || 0) + p.amount);
    const total = [...byMethod.values()].reduce((s, n) => s + n, 0);
    return {
      columns: [
        { key: 'method', label: 'Payment method' },
        { key: 'amount', label: 'Receipts', align: 'right' },
        { key: 'mix', label: 'Mix', align: 'right' },
      ],
      rows: [...byMethod.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([method, amount]) => ({
          method,
          amount: money(amount),
          mix: total ? `${((amount / total) * 100).toFixed(1)}%` : '—',
        })),
      kpis: [
        { label: 'Receipts', value: money(total) },
        { label: 'Methods', value: String(byMethod.size) },
      ],
      emptyHint: 'No posted receipts in this period. This is collections, not GL revenue.',
    };
  }

  if (reportKey === 'revenue-department' || reportKey === 'expense-department' || reportKey === 'departmental-profit' || reportKey === 'rooms-pl' || reportKey === 'restaurant-pl' || reportKey === 'bar-pl') {
    const byDept = new Map<string, { revenue: number; expense: number }>();
    for (const je of posted) {
      for (const line of je.lines) {
        const type = typeByCode.get(line.accountCode);
        if (type !== 'Revenue' && type !== 'Expense') continue;
        const dept = (line.department || line.costCenter || 'Unassigned').trim() || 'Unassigned';
        const bucket = byDept.get(dept) || { revenue: 0, expense: 0 };
        if (type === 'Revenue') bucket.revenue += (line.credit || 0) - (line.debit || 0);
        else bucket.expense += (line.debit || 0) - (line.credit || 0);
        byDept.set(dept, bucket);
      }
    }
    let entries = [...byDept.entries()];
    if (reportKey === 'rooms-pl') entries = entries.filter(([name]) => /room/i.test(name));
    if (reportKey === 'restaurant-pl') entries = entries.filter(([name]) => /restaurant|food|fb|f&b/i.test(name));
    if (reportKey === 'bar-pl') entries = entries.filter(([name]) => /bar|beverage/i.test(name));
    return {
      columns: [
        { key: 'department', label: 'Department' },
        { key: 'revenue', label: 'Revenue', align: 'right' },
        { key: 'expense', label: 'Direct cost', align: 'right' },
        { key: 'profit', label: 'Contribution', align: 'right' },
      ],
      rows: entries
        .sort((a, b) => (b[1].revenue - b[1].expense) - (a[1].revenue - a[1].expense))
        .map(([department, v]) => ({
          department,
          revenue: money(v.revenue),
          expense: money(v.expense),
          profit: money(v.revenue - v.expense),
        })),
      kpis: [
        { label: 'Departments', value: String(entries.length) },
        { label: 'Net', value: money(net) },
      ],
      emptyHint: entries.length === 0 && byDept.size > 0
        ? 'Journal lines are not tagged to this department yet. Use Departmental Profit for everything that is tagged.'
        : 'No department or cost-centre tag on posted revenue and expense lines in this period.',
    };
  }

  if (reportKey === 'revenue-outlet') {
    const rows = revenueCenters
      .filter((c) => c.isActive)
      .map((center) => ({
        outlet: center.name,
        amount: computeRevenueCenterActual(center, posted, revenueCenters, input.chartOfAccounts).amount,
      }));
    return {
      columns: [
        { key: 'outlet', label: 'Revenue centre' },
        { key: 'amount', label: 'Revenue', align: 'right' },
      ],
      rows: rows.map((row) => ({ outlet: row.outlet, amount: money(row.amount) })),
      kpis: [
        { label: 'Centres', value: String(rows.length) },
        { label: 'Revenue', value: money(rows.reduce((sum, row) => sum + row.amount, 0)) },
      ],
      emptyHint: 'No active revenue centres.',
    };
  }

  if (reportKey === 'expense-vendor') {
    const purchases = invoices.filter((i) => i.type === 'Purchase' && i.status !== 'Void' && i.status !== 'Draft' && !i.isProforma && inRange(i.date, startDate, endDate));
    const byVendor = new Map<string, number>();
    for (const inv of purchases) {
      const name = partnerName(inv.businessPartnerId);
      byVendor.set(name, (byVendor.get(name) || 0) + inv.total);
    }
    const total = [...byVendor.values()].reduce((s, n) => s + n, 0);
    return {
      columns: [
        { key: 'vendor', label: 'Vendor' },
        { key: 'amount', label: 'Billed', align: 'right' },
      ],
      rows: [...byVendor.entries()].sort((a, b) => b[1] - a[1]).map(([vendor, amount]) => ({ vendor, amount: money(amount) })),
      kpis: [
        { label: 'Billed', value: money(total) },
        { label: 'Vendors', value: String(byVendor.size) },
      ],
      emptyHint: 'No posted purchase bills in this period.',
    };
  }

  if (reportKey === 'budget-vs-actual' || reportKey === 'budget-department' || reportKey === 'prior-year') {
    if (reportKey === 'prior-year') {
      const priorStart = new Date(start);
      const priorEnd = new Date(end);
      priorStart.setFullYear(priorStart.getFullYear() - 1);
      priorEnd.setFullYear(priorEnd.getFullYear() - 1);
      const priorTree = buildFinancialAccountTree(coa, journalEntries, { kind: 'period', startDate: priorStart, endDate: priorEnd });
      const priorRevenue = round2(leaves(priorTree.filter((n) => n.type === 'Revenue')).reduce((s, n) => s + n.balance, 0));
      const priorExpense = round2(leaves(priorTree.filter((n) => n.type === 'Expense')).reduce((s, n) => s + n.balance, 0));
      const line = (label: string, current: number, prior: number) => ({
        line: label,
        current: money(current),
        prior: money(prior),
        variance: money(current - prior),
      });
      return {
        columns: [
          { key: 'line', label: 'Line' },
          { key: 'current', label: 'This period', align: 'right' },
          { key: 'prior', label: 'Prior year', align: 'right' },
          { key: 'variance', label: 'Variance', align: 'right' },
        ],
        rows: [
          line('Revenue', revenueTotal, priorRevenue),
          line('Expenses', expenseTotal, priorExpense),
          line('Net', net, priorRevenue - priorExpense),
        ],
        kpis: [{ label: 'Revenue variance', value: money(revenueTotal - priorRevenue) }],
        emptyHint: 'No activity in either period.',
      };
    }
    const centers = [
      ...revenueCenters.filter((c) => c.isActive).map((c) => ({
        name: c.name,
        department: c.department || 'Unassigned',
        kind: 'Revenue',
        budget: c.budget || 0,
        actual: computeRevenueCenterActual(c, posted, revenueCenters, input.chartOfAccounts).amount,
      })),
      ...costCenters.filter((c) => c.isActive).map((c) => ({
        name: c.name,
        department: c.department || 'Unassigned',
        kind: 'Expense',
        budget: c.budget || 0,
        actual: computeCostCenterActual(c, posted, costCenters, input.chartOfAccounts).amount,
      })),
    ];
    if (reportKey === 'budget-department') {
      const grouped = new Map<string, { budget: number; actual: number }>();
      for (const center of centers) {
        const key = `${center.department}\u0000${center.kind}`;
        const bucket = grouped.get(key) || { budget: 0, actual: 0 };
        bucket.budget += center.budget;
        bucket.actual += center.actual;
        grouped.set(key, bucket);
      }
      const rows = [...grouped.entries()].map(([key, value]) => {
        const [department, kind] = key.split('\u0000');
        return { department, kind, budget: value.budget, actual: value.actual };
      });
      return {
        columns: [
          { key: 'department', label: 'Department' },
          { key: 'kind', label: 'Type' },
          { key: 'budget', label: 'Budget', align: 'right' },
          { key: 'actual', label: 'Actual', align: 'right' },
          { key: 'variance', label: 'Variance', align: 'right' },
        ],
        rows: rows.map((row) => ({
          department: row.department.replace(/_/g, ' '),
          kind: row.kind,
          budget: money(row.budget),
          actual: money(row.actual),
          variance: money(row.kind === 'Revenue' ? row.actual - row.budget : row.budget - row.actual),
        })),
        kpis: [{ label: 'Departments', value: String(new Set(rows.map((row) => row.department)).size) }],
        emptyHint: 'No revenue or cost centres are set up.',
      };
    }
    return {
      columns: [
        { key: 'name', label: 'Centre' },
        { key: 'kind', label: 'Type' },
        { key: 'budget', label: 'Budget', align: 'right' },
        { key: 'actual', label: 'Actual', align: 'right' },
        { key: 'variance', label: 'Variance', align: 'right' },
      ],
      rows: centers.map((c) => ({
        name: c.name,
        kind: c.kind,
        budget: money(c.budget),
        actual: money(c.actual),
        variance: money(c.kind === 'Revenue' ? c.actual - c.budget : c.budget - c.actual),
      })),
      kpis: [{ label: 'Centres', value: String(centers.length) }],
      emptyHint: 'No revenue or cost centres are set up.',
    };
  }

  if (reportKey === 'forecast-vs-actual' || reportKey === 'forecast-accuracy') {
    return empty('No forecast is stored yet. Use Budget vs Actual until a forecast is maintained.');
  }

  if (reportKey === 'variance' || reportKey === 'food-cost-variance' || reportKey === 'labor-cost-variance') {
    const food = expenseLeaves.filter((n) => /food/i.test(n.name));
    const labor = expenseLeaves.filter((n) => /wage|salar|labor|labour|staff/i.test(n.name));
    const pick = reportKey === 'food-cost-variance' ? food : reportKey === 'labor-cost-variance' ? labor : expenseLeaves.slice(0, 12);
    return {
      columns: [
        { key: 'account', label: 'Account' },
        { key: 'actual', label: 'Actual', align: 'right' },
        { key: 'pct', label: '% of revenue', align: 'right' },
      ],
      rows: pick.map((n) => ({
        account: `${n.code} ${n.name}`,
        actual: money(n.balance),
        pct: revenueTotal ? `${((n.balance / revenueTotal) * 100).toFixed(1)}%` : '—',
      })),
      kpis: [
        { label: 'Revenue', value: money(revenueTotal) },
        { label: 'Spend', value: money(pick.reduce((s, n) => s + n.balance, 0)) },
      ],
      emptyHint: reportKey === 'variance'
        ? 'No expense accounts posted in this period.'
        : 'No food or labour account name matched. Tag those accounts so this variance can isolate them.',
    };
  }

  const openInvoices = (type: 'Sales' | 'Purchase') =>
    invoices.filter((i) => i.type === type && i.status !== 'Void' && i.status !== 'Draft' && !i.isProforma && openAmount(i) > 0.009);

  if (reportKey === 'ar-aging' || reportKey === 'ap-aging' || reportKey === 'ar-customer' || reportKey === 'ap-forecast' || reportKey === 'dso' || reportKey === 'dpo') {
    const sales = reportKey.startsWith('ar') || reportKey === 'dso';
    const partyLabel = sales ? 'Customer' : 'Vendor';
    const list = openInvoices(sales ? 'Sales' : 'Purchase');
    const totalOpen = round2(list.reduce((s, i) => s + openAmount(i), 0));
    const invoiceLine = (inv: Invoice) => {
      const overdue = ageDays(inv.dueDate, endDate);
      return {
        invoice: inv.invoiceNumber,
        party: partnerName(inv.businessPartnerId),
        date: day(inv.date),
        due: day(inv.dueDate),
        age: ageBucket(inv.dueDate, endDate),
        days: Math.max(0, overdue),
        dueIn: overdue > 0 ? 0 : -overdue,
        total: round2(inv.total || 0),
        paid: round2(inv.paidAmount || 0),
        open: openAmount(inv),
        status: inv.status,
      };
    };
    if (reportKey === 'ar-aging' || reportKey === 'ap-aging') {
      const lines = list.map(invoiceLine).sort((a, b) => b.days - a.days || a.due.localeCompare(b.due));
      const overdue = round2(lines.filter((line) => line.days > 0).reduce((sum, line) => sum + line.open, 0));
      return {
        columns: [
          { key: 'invoice', label: 'Invoice' },
          { key: 'party', label: partyLabel },
          { key: 'date', label: 'Date' },
          { key: 'due', label: 'Due' },
          { key: 'age', label: 'Age' },
          { key: 'days', label: 'Days overdue', align: 'right' },
          { key: 'total', label: 'Total', align: 'right' },
          { key: 'paid', label: 'Paid', align: 'right' },
          { key: 'open', label: 'Open', align: 'right' },
          { key: 'status', label: 'Status' },
        ],
        rows: lines,
        kpis: [
          { label: sales ? 'Open AR' : 'Open AP', value: money(totalOpen) },
          { label: 'Invoices', value: String(lines.length) },
          { label: 'Overdue', value: money(overdue) },
        ],
        emptyHint: sales ? 'No open sales invoices.' : 'No open purchase bills.',
      };
    }
    if (reportKey === 'ap-forecast') {
      const lines = list.map(invoiceLine).sort((a, b) => a.due.localeCompare(b.due));
      return {
        columns: [
          { key: 'party', label: 'Vendor' },
          { key: 'invoice', label: 'Bill' },
          { key: 'date', label: 'Date' },
          { key: 'due', label: 'Due' },
          { key: 'dueIn', label: 'Days to due', align: 'right' },
          { key: 'total', label: 'Total', align: 'right' },
          { key: 'paid', label: 'Paid', align: 'right' },
          { key: 'open', label: 'Open', align: 'right' },
          { key: 'status', label: 'Status' },
        ],
        rows: lines,
        kpis: [
          { label: 'Open AP', value: money(totalOpen) },
          { label: 'Bills', value: String(lines.length) },
        ],
        emptyHint: 'No open purchase bills.',
      };
    }
    const byName = new Map<string, { open: number; count: number; due: string }>();
    for (const inv of list) {
      const name = partnerName(inv.businessPartnerId);
      const prev = byName.get(name) || { open: 0, count: 0, due: inv.dueDate || '9999-12-31' };
      prev.open += openAmount(inv);
      prev.count += 1;
      if ((inv.dueDate || '') < prev.due) prev.due = inv.dueDate;
      byName.set(name, prev);
    }
    const days = periodDays(startDate, endDate);
    const base = sales ? revenueTotal : expenseTotal;
    const ratio = base ? (totalOpen / base) * days : 0;
    const billedByName = new Map<string, number>();
    for (const inv of invoices) {
      if (inv.type !== (sales ? 'Sales' : 'Purchase')) continue;
      if (inv.status === 'Void' || inv.status === 'Draft' || inv.isProforma) continue;
      if (!inRange(inv.date, startDate, endDate)) continue;
      const name = partnerName(inv.businessPartnerId);
      billedByName.set(name, (billedByName.get(name) || 0) + (inv.total || 0));
    }
    const parties = [...byName.entries()]
      .map(([name, value]) => {
        return {
          party: name,
          invoices: value.count,
          due: day(value.due),
          days: Math.max(0, ageDays(value.due, endDate)),
          open: round2(value.open),
          billed: round2(billedByName.get(name) || 0),
        };
      })
      .sort((a, b) => b.open - a.open);
    if (reportKey === 'dso' || reportKey === 'dpo') {
      return {
        columns: [
          { key: 'party', label: partyLabel },
          { key: 'invoices', label: 'Invoices', align: 'right' },
          { key: 'due', label: 'Oldest due' },
          { key: 'days', label: 'Days overdue', align: 'right' },
          { key: 'open', label: 'Open', align: 'right' },
          { key: 'billed', label: 'Billed in period', align: 'right' },
        ],
        rows: parties,
        kpis: [
          { label: sales ? `DSO · ${days} days` : `DPO · ${days} days`, value: base ? ratio.toFixed(1) : '—' },
          { label: sales ? 'Open AR' : 'Open AP', value: money(totalOpen) },
          { label: sales ? 'Period revenue' : 'Period expenses', value: money(base) },
        ],
        emptyHint: sales ? 'No open sales invoices.' : 'No open purchase bills.',
      };
    }
    return {
      columns: [
        { key: 'party', label: 'Customer' },
        { key: 'invoices', label: 'Invoices', align: 'right' },
        { key: 'due', label: 'Oldest due' },
        { key: 'days', label: 'Days overdue', align: 'right' },
        { key: 'open', label: 'Open', align: 'right' },
      ],
      rows: parties,
      kpis: [
        { label: 'Open AR', value: money(totalOpen) },
        { label: 'Customers', value: String(parties.length) },
      ],
      emptyHint: 'No open sales invoices.',
    };
  }

  if (reportKey === 'cash-position') {
    const now = new Date();
    const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const throughNow = endDate >= todayIso;
    const accounts = bankAccounts.filter((b) => b.isActive || bankTransactions.some((t) => t.bankAccountId === b.id && inRange(t.transactionDate, startDate, endDate)));
    const rows = accounts.map((account) => {
      const lines = bankTransactions
        .filter((t) => t.bankAccountId === account.id)
        .sort((a, b) => day(a.transactionDate).localeCompare(day(b.transactionDate)) || (a.createdAt || '').localeCompare(b.createdAt || ''));
      let moneyIn = 0;
      let moneyOut = 0;
      let running = round2(account.openingBalance || 0);
      for (const line of lines) {
        const signed = signedRegisterLine(line, running);
        running = Number.isFinite(line.balance) ? round2(line.balance) : round2(running + signed);
        if (!inRange(line.transactionDate, startDate, endDate)) continue;
        if (signed >= 0) moneyIn += signed;
        else moneyOut += -signed;
      }
      moneyIn = round2(moneyIn);
      moneyOut = round2(moneyOut);
      const closing = throughNow
        ? round2(account.currentBalance || 0)
        : registerBalance(lines, endDate, account.openingBalance || 0, true);
      const opening = throughNow
        ? round2(closing - moneyIn + moneyOut)
        : registerBalance(lines, startDate, account.openingBalance || 0, false);
      return {
        account: account.accountName,
        bank: account.bankName,
        number: account.accountNumber,
        gl: account.glAccountCode,
        opening,
        in: moneyIn,
        out: moneyOut,
        closing,
      };
    });
    const closingTotal = round2(rows.reduce((sum, row) => sum + row.closing, 0));
    const inTotal = round2(rows.reduce((sum, row) => sum + row.in, 0));
    const outTotal = round2(rows.reduce((sum, row) => sum + row.out, 0));
    return {
      columns: [
        { key: 'account', label: 'Account' },
        { key: 'bank', label: 'Bank' },
        { key: 'number', label: 'Number' },
        { key: 'gl', label: 'GL' },
        { key: 'opening', label: 'Opening', align: 'right' },
        { key: 'in', label: 'In', align: 'right' },
        { key: 'out', label: 'Out', align: 'right' },
        { key: 'closing', label: 'Closing', align: 'right' },
      ],
      rows,
      kpis: [
        { label: 'Closing', value: money(closingTotal) },
        { label: 'In', value: money(inTotal) },
        { label: 'Out', value: money(outTotal) },
      ],
      emptyHint: 'No bank or cash accounts on the register.',
    };
  }

  if (reportKey === 'bank-balances' || reportKey === 'working-capital') {
    const banks = bankAccounts.filter((b) => b.isActive);
    const bankTotal = round2(banks.reduce((s, b) => s + (b.currentBalance || 0), 0));
    const ar = round2(openInvoices('Sales').reduce((s, i) => s + openAmount(i), 0));
    const ap = round2(openInvoices('Purchase').reduce((s, i) => s + openAmount(i), 0));
    if (reportKey === 'working-capital') {
      return {
        columns: [
          { key: 'item', label: 'Item' },
          { key: 'detail', label: 'Detail' },
          { key: 'amount', label: 'Amount', align: 'right' },
        ],
        rows: [
          ...banks.map((b) => ({
            item: b.accountName,
            detail: `${b.bankName} · ${b.glAccountCode}`,
            amount: round2(b.currentBalance || 0),
          })),
          { item: 'Open receivables', detail: 'Sales invoices still open', amount: ar },
          { item: 'Open payables', detail: 'Purchase bills still open', amount: ap },
          { item: 'Working capital', detail: 'Cash + receivables − payables', amount: round2(bankTotal + ar - ap) },
        ],
        kpis: [
          { label: 'Working capital', value: money(bankTotal + ar - ap) },
          { label: 'Bank & cash', value: money(bankTotal) },
          { label: 'Open AR', value: money(ar) },
          { label: 'Open AP', value: money(ap) },
        ],
        emptyHint: 'No bank, receivable, or payable balances.',
      };
    }
    return {
      columns: [
        { key: 'account', label: 'Account' },
        { key: 'bank', label: 'Bank' },
        { key: 'number', label: 'Number' },
        { key: 'gl', label: 'GL' },
        { key: 'currency', label: 'Currency' },
        { key: 'opening', label: 'Opening', align: 'right' },
        { key: 'balance', label: 'Balance', align: 'right' },
      ],
      rows: banks.map((b) => ({
        account: b.accountName,
        bank: b.bankName,
        number: b.accountNumber,
        gl: b.glAccountCode,
        currency: b.currency,
        opening: round2(b.openingBalance || 0),
        balance: round2(b.currentBalance || 0),
      })),
      kpis: [{ label: 'Bank & cash', value: money(bankTotal) }],
      emptyHint: 'No active bank accounts.',
    };
  }

  if (reportKey === 'cash-movement' || reportKey === 'unreconciled' || reportKey === 'bank-recon-summary') {
    const accountName = (id: string) => bankAccounts.find((b) => b.id === id)?.accountName || id;
    const openingByAccount = new Map(bankAccounts.map((account) => [account.id, round2(account.openingBalance || 0)]));
    const signedById = new Map<string, number>();
    const grouped = new Map<string, BankTransaction[]>();
    for (const line of bankTransactions) {
      const list = grouped.get(line.bankAccountId) || [];
      list.push(line);
      grouped.set(line.bankAccountId, list);
    }
    for (const [accountId, lines] of grouped) {
      lines.sort((a, b) => day(a.transactionDate).localeCompare(day(b.transactionDate)) || (a.createdAt || '').localeCompare(b.createdAt || ''));
      let running = openingByAccount.get(accountId) || 0;
      for (const line of lines) {
        const signed = signedRegisterLine(line, running);
        signedById.set(line.id, signed);
        running = Number.isFinite(line.balance) ? round2(line.balance) : round2(running + signed);
      }
    }
    const txns = bankTransactions.filter((t) => inRange(t.transactionDate, startDate, endDate));
    if (reportKey === 'bank-recon-summary') {
      const byAccount = new Map<string, { total: number; reconciled: number; open: number; openAmount: number }>();
      for (const t of bankTransactions.filter((t) => day(t.transactionDate) <= endDate)) {
        const bucket = byAccount.get(t.bankAccountId) || { total: 0, reconciled: 0, open: 0, openAmount: 0 };
        bucket.total += 1;
        if (t.status === 'Reconciled') bucket.reconciled += 1;
        else {
          bucket.open += 1;
          bucket.openAmount += Math.abs(signedById.get(t.id) || 0);
        }
        byAccount.set(t.bankAccountId, bucket);
      }
      return {
        columns: [
          { key: 'account', label: 'Account' },
          { key: 'lines', label: 'Lines', align: 'right' },
          { key: 'reconciled', label: 'Reconciled', align: 'right' },
          { key: 'openLines', label: 'Open lines', align: 'right' },
          { key: 'openAmount', label: 'Open amount', align: 'right' },
        ],
        rows: [...byAccount.entries()].map(([id, value]) => ({
          account: accountName(id),
          lines: value.total,
          reconciled: value.reconciled,
          openLines: value.open,
          openAmount: round2(value.openAmount),
        })),
        kpis: [
          { label: 'Accounts', value: String(byAccount.size) },
          { label: 'Open lines', value: String([...byAccount.values()].reduce((sum, value) => sum + value.open, 0)) },
        ],
        emptyHint: 'No bank register lines through this date.',
      };
    }
    const list = (reportKey === 'unreconciled' ? txns.filter((t) => t.status !== 'Reconciled') : txns)
      .slice()
      .sort((a, b) => day(a.transactionDate).localeCompare(day(b.transactionDate)));
    const movementRows = list.map((t) => {
      const signed = round2(signedById.get(t.id) || 0);
      return {
        date: day(t.transactionDate),
        account: accountName(t.bankAccountId),
        type: t.type,
        description: t.description || '—',
        reference: t.reference || '—',
        status: t.status,
        in: signed > 0 ? signed : 0,
        out: signed < 0 ? round2(-signed) : 0,
      };
    });
    const inTotal = round2(movementRows.reduce((sum, row) => sum + row.in, 0));
    const outTotal = round2(movementRows.reduce((sum, row) => sum + row.out, 0));
    return {
      columns: [
        { key: 'date', label: 'Date' },
        { key: 'account', label: 'Account' },
        { key: 'type', label: 'Type' },
        { key: 'description', label: 'Description' },
        { key: 'reference', label: 'Reference' },
        { key: 'status', label: 'Status' },
        { key: 'in', label: 'In', align: 'right' },
        { key: 'out', label: 'Out', align: 'right' },
      ],
      rows: movementRows,
      kpis: [
        { label: 'Lines', value: String(list.length) },
        { label: 'In', value: money(inTotal) },
        { label: 'Out', value: money(outTotal) },
      ],
      emptyHint: reportKey === 'unreconciled' ? 'Nothing unreconciled in this period.' : 'No bank movements in this period.',
    };
  }

  if (reportKey === 'tax-collected' || reportKey === 'tax-payable' || reportKey === 'vat' || reportKey === 'wht' || reportKey === 'tax-recon') {
    const fromPeriod = startDate.slice(0, 7);
    const toPeriod = endDate.slice(0, 7);
    const summary = rollupTaxLedger(journalEntries, { fromPeriod, toPeriod });
    let rows = summary.rows;
    if (reportKey === 'vat') rows = rows.filter((r) => /vat/i.test(r.taxCode) && !/wht/i.test(r.taxCode));
    if (reportKey === 'wht') rows = rows.filter((r) => /wht|withhold/i.test(`${r.taxCode} ${r.taxName}`));
    return {
      columns: [
        { key: 'period', label: 'Period' },
        { key: 'tax', label: 'Tax' },
        { key: 'collected', label: 'Collected', align: 'right' },
        { key: 'withheld', label: 'Withheld', align: 'right' },
        { key: 'remitted', label: 'Remitted', align: 'right' },
        { key: 'net', label: 'Net payable', align: 'right' },
      ],
      rows: rows.map((r) => ({
        period: r.period,
        tax: r.taxName,
        collected: money(r.outputCollected),
        withheld: money(r.withholding + r.payrollWithheld),
        remitted: money(r.remitted),
        net: money(r.netPosition),
      })),
      kpis: [
        { label: 'Collected', value: money(summary.totals.outputCollected) },
        { label: 'Net payable', value: money(summary.totals.netPosition) },
      ],
      emptyHint: 'No tax postings in this period.',
    };
  }

  if (reportKey === 'journal-register' || reportKey === 'adjustments' || reportKey === 'reversals' || reportKey === 'unposted') {
    let list = journalEntries.filter((je) => inRange(je.date, startDate, endDate));
    if (reportKey === 'journal-register') list = list.filter((je) => je.status === 'Posted');
    if (reportKey === 'adjustments') list = list.filter((je) => je.status === 'Posted' && /manual|adjust/i.test(`${je.sourceModule || ''} ${je.description}`));
    if (reportKey === 'reversals') list = list.filter((je) => je.status === 'Void' || /revers|void/i.test(je.description));
    if (reportKey === 'unposted') list = list.filter((je) => je.status === 'Draft' || je.status === 'Pending Approval');
    return {
      columns: [
        { key: 'date', label: 'Date' },
        { key: 'number', label: 'Entry' },
        { key: 'status', label: 'Status' },
        { key: 'source', label: 'Source' },
        { key: 'description', label: 'Description' },
        { key: 'amount', label: 'Debit', align: 'right' },
      ],
      rows: list.slice(0, 200).map((je) => ({
        date: day(je.date),
        number: je.entryNumber,
        status: je.status,
        source: je.sourceModule || '—',
        description: je.description || je.reference || '—',
        amount: money(je.totalDebit),
      })),
      kpis: [{ label: 'Entries', value: String(list.length) }],
      emptyHint: 'Nothing matches this audit view in the selected period.',
    };
  }

  if (reportKey === 'ar-gl' || reportKey === 'ap-gl' || reportKey === 'bank-gl' || reportKey === 'pms-gl' || reportKey === 'pos-gl') {
    const subledger = reportKey === 'ap-gl'
      ? round2(openInvoices('Purchase').reduce((s, i) => s + openAmount(i), 0))
      : reportKey === 'bank-gl'
        ? round2(bankAccounts.filter((b) => b.isActive).reduce((s, b) => s + (b.currentBalance || 0), 0))
        : reportKey === 'pms-gl'
          ? round2(openInvoices('Sales').filter((i) => /front_office|pms|folio/i.test(i.sourceModule || '')).reduce((s, i) => s + openAmount(i), 0))
          : reportKey === 'pos-gl'
            ? round2(payments.filter((p) => p.status === 'Posted' && /pos|restaurant|fb/i.test(p.sourceModule || '') && inRange(p.date, startDate, endDate)).reduce((s, p) => s + p.amount, 0))
            : round2(openInvoices('Sales').reduce((s, i) => s + openAmount(i), 0));
    const glCodes = reportKey === 'ap-gl'
      ? ['2200', '2205']
      : reportKey === 'bank-gl'
        ? bankAccounts.map((b) => b.glAccountCode)
        : reportKey === 'pos-gl'
          ? coa.filter((a) => a.type === 'Revenue' && /food|beverage|restaurant|bar/i.test(a.name)).map((a) => a.code)
          : ['1200', '1210', '1220', '1225', '1226'];
    const gl = reportKey === 'pos-gl'
      ? round2(leaves(tree).filter((n) => glCodes.includes(n.code)).reduce((s, n) => s + n.balance, 0))
      : glBalance(glCodes);
    const gap = round2(subledger - (reportKey === 'ap-gl' || reportKey === 'bank-gl' ? Math.abs(gl) : gl));
    return {
      columns: [
        { key: 'side', label: 'Side' },
        { key: 'amount', label: 'Amount', align: 'right' },
      ],
      rows: [
        { side: reportKey === 'pos-gl' ? 'POS / outlet receipts in period' : 'Subledger', amount: money(subledger) },
        { side: reportKey === 'pos-gl' ? 'Matching revenue accounts' : `GL ${glCodes.filter(Boolean).join(', ') || '—'}`, amount: money(reportKey === 'ap-gl' ? Math.abs(gl) : gl) },
        { side: 'Difference', amount: money(gap) },
      ],
      kpis: [{ label: 'Difference', value: money(gap) }],
      emptyHint: 'Both sides are zero for this tie-out.',
    };
  }

  return empty('This report is not wired yet.');
}
