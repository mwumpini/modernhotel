'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Card, CardBody, CardHeader, Button, Tabs, Tab, Select, SelectItem, Input,
  Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, useDisclosure,
  Textarea, Dropdown, DropdownTrigger, DropdownMenu, DropdownItem, Chip,
  Table, TableHeader, TableColumn, TableBody, TableRow, TableCell,
} from '@heroui/react';
import {
  ArrowDownToLine, CalendarDays, FileSpreadsheet, FileText,
  Printer, RefreshCw, StickyNote, TrendingUp,
} from 'lucide-react';
import { useAccountingStore } from '@/app/lib/accounting/store';
import { buildAccountingIntelligenceReport } from '@/app/lib/accounting/accountingIntelligenceReports';

const REPORT_GROUPS = {
  performance: {
    title: 'Performance',
    description: 'Where income, cost and department profit came from.',
    reports: [
      ['revenue-department', 'Income by department'],
      ['revenue-account', 'Income by books account'],
      ['revenue-date', 'Income by date'],
      ['revenue-payment', 'Income by payment method'],
      ['revenue-outlet', 'Income by outlet'],
      ['revenue-trend', 'Income trend'],
      ['revenue-mix', 'Income mix'],
      ['expense-account', 'Spend by books account'],
      ['expense-department', 'Spend by department'],
      ['expense-vendor', 'Spend by supplier'],
      ['expense-trend', 'Spend trend'],
      ['expense-ratio', 'Spend as % of income'],
      ['top-expenses', 'Top 10 spends'],
      ['gop', 'Operating profit & margin'],
      ['ebitda', 'EBITDA'],
      ['departmental-profit', 'Department profit'],
      ['rooms-pl', 'Rooms profit'],
      ['restaurant-pl', 'Restaurant profit'],
      ['bar-pl', 'Bar profit'],
    ],
  },
  plan: {
    title: 'Plan vs result',
    description: 'Budget, forecast and why the difference moved.',
    reports: [
      ['budget-vs-actual', 'Budget vs actual'],
      ['budget-department', 'Department budget vs actual'],
      ['prior-year', 'Same period last year'],
      ['forecast-vs-actual', 'Forecast vs actual'],
      ['forecast-accuracy', 'Forecast accuracy'],
      ['variance', 'Why it moved'],
      ['food-cost-variance', 'Food cost % vs budget'],
      ['labor-cost-variance', 'Labour cost % vs budget'],
    ],
  },
  'working-capital': {
    title: 'Cash & bills',
    description: 'Money owed, bills to pay, cash and how fast they turn.',
    reports: [
      ['ar-aging', 'Money owed by age'],
      ['ar-customer', 'Who still owes'],
      ['dso', 'Days sales outstanding'],
      ['ap-aging', 'Bills to pay by age'],
      ['ap-forecast', 'Upcoming payments'],
      ['dpo', 'Days to pay suppliers'],
      ['cash-position', 'Cash on hand'],
      ['cash-movement', 'Cash in and out'],
      ['bank-balances', 'Bank balances'],
      ['bank-recon-summary', 'Statement match summary'],
      ['unreconciled', 'Unmatched bank lines'],
      ['working-capital', 'Working capital'],
    ],
  },
  control: {
    title: 'Checks',
    description: 'Tax, ratios, and whether the books match each desk.',
    reports: [
      ['tax-collected', 'Tax collected'],
      ['tax-payable', 'Tax still owed'],
      ['vat', 'VAT analysis'],
      ['wht', 'Withholding tax'],
      ['tax-recon', 'Tax reconciliation'],
      ['ratios', 'Financial ratios'],
      ['pms-gl', 'Front office → books'],
      ['pos-gl', 'POS → books'],
      ['ar-gl', 'Receivables → books'],
      ['ap-gl', 'Payables → books'],
      ['bank-gl', 'Bank → books'],
      ['journal-register', 'Journal register'],
      ['adjustments', 'Adjustments'],
      ['reversals', 'Reversals / voids'],
      ['unposted', 'Not yet on the books'],
    ],
  },
} as const;

type ReportGroupKey = keyof typeof REPORT_GROUPS;

const REPORT_QUESTIONS: Record<string, string> = {
  'revenue-department': 'Where is room, restaurant, bar and events revenue coming from?',
  'revenue-account': 'Which revenue accounts posted in this period?',
  'revenue-date': 'How did revenue land by day?',
  'revenue-payment': 'Cash, card, MoMo, bank or room charge?',
  'revenue-outlet': 'Which outlet produced the revenue?',
  'revenue-trend': 'How does this period compare with the previous one?',
  'revenue-mix': 'What share of revenue did each department contribute?',
  'expense-account': 'Which expense accounts absorbed the spend?',
  'expense-department': 'Which department spent the money?',
  'expense-vendor': 'Which vendors received the spend?',
  'expense-trend': 'Is spend rising or falling versus the prior period?',
  'expense-ratio': 'What share of revenue did expenses consume?',
  'top-expenses': 'Which ten lines dominate the spend?',
  gop: 'Gross operating profit and margin for the period.',
  ebitda: 'Earnings before interest, tax, depreciation and amortisation.',
  'departmental-profit': 'Revenue less direct cost by department.',
  'rooms-pl': 'Financial result of rooms operations.',
  'restaurant-pl': 'Financial result of restaurant operations — not the operational restaurant report.',
  'bar-pl': 'Financial result of bar operations.',
  'budget-vs-actual': 'Account, budget, actual, variance and variance %.',
  'budget-department': 'Same comparison rolled up by department.',
  'prior-year': 'Actual versus the same period last year.',
  'forecast-vs-actual': 'Latest forecast against what actually posted.',
  'forecast-accuracy': 'How close the forecast was.',
  variance: 'Why the result moved — revenue versus cost.',
  'food-cost-variance': 'Food cost % against budget.',
  'labor-cost-variance': 'Labor cost % against budget.',
  'ar-aging': 'How old outstanding receivables are.',
  'ar-customer': 'Who still owes the hotel.',
  dso: 'How many days of sales sit in receivables.',
  'ap-aging': 'How old vendor bills are.',
  'ap-forecast': 'What is due to be paid next.',
  dpo: 'How many days the hotel takes to pay vendors.',
  'cash-position': 'Cash and bank on hand.',
  'cash-movement': 'Where cash came from and went.',
  'bank-balances': 'Balance by bank account.',
  'bank-recon-summary': 'Which accounts are reconciled for the period.',
  unreconciled: 'Bank lines still open.',
  'working-capital': 'DSO, DPO and cash conversion.',
  'tax-collected': 'Output tax collected in the period.',
  'tax-payable': 'Tax still owed.',
  vat: 'VAT collected, input and net.',
  wht: 'Withholding tax withheld and still payable.',
  'tax-recon': 'Tax ledger versus the tax report.',
  ratios: 'Liquidity, margin and turnover ratios.',
  'pms-gl': 'Front office totals versus the books.',
  'pos-gl': 'POS sales versus the books.',
  'ar-gl': 'Receivables desk versus the books.',
  'ap-gl': 'Payables desk versus the books.',
  'bank-gl': 'Bank register versus the books.',
  'journal-register': 'Journals posted in the period.',
  adjustments: 'Manual adjusting entries.',
  reversals: 'Reversed and voided entries.',
  unposted: 'Transactions that have not hit the books.',
};

export default function ReportsAnalysis() {
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = `${today.slice(0, 7)}-01`;
  const [selectedTab, setSelectedTab] = useState<ReportGroupKey>('performance');
  const [selectedReport, setSelectedReport] = useState('revenue-account');
  const [startDate, setStartDate] = useState(monthStart);
  const [endDate, setEndDate] = useState(today);
  const [reportDateMode, setReportDateMode] = useState<'today' | 'specific' | 'range'>('range');
  const [generatedAt, setGeneratedAt] = useState(() => new Date().toLocaleString());
  const [reportNotes, setReportNotes] = useState('');
  const { isOpen, onOpen, onClose } = useDisclosure();
  const initializeAccounting = useAccountingStore((s) => s.initializeAccounting);
  const journalEntries = useAccountingStore((s) => s.journalEntries);
  const chartOfAccounts = useAccountingStore((s) => s.chartOfAccounts);
  const invoices = useAccountingStore((s) => s.invoices);
  const payments = useAccountingStore((s) => s.payments);
  const bankAccounts = useAccountingStore((s) => s.bankAccounts);
  const bankTransactions = useAccountingStore((s) => s.bankTransactions);
  const businessPartners = useAccountingStore((s) => s.businessPartners);
  const costCenters = useAccountingStore((s) => s.costCenters);
  const revenueCenters = useAccountingStore((s) => s.revenueCenters);

  useEffect(() => {
    initializeAccounting().catch(() => {});
  }, [initializeAccounting]);

  const reportLabel = useMemo(
    () => REPORT_GROUPS[selectedTab].reports.find(([key]) => key === selectedReport)?.[1] || 'Report',
    [selectedTab, selectedReport]
  );

  const report = useMemo(
    () => buildAccountingIntelligenceReport({
      reportKey: selectedReport,
      startDate,
      endDate,
      journalEntries,
      chartOfAccounts,
      invoices,
      payments,
      bankAccounts,
      bankTransactions,
      businessPartners,
      costCenters,
      revenueCenters,
    }),
    [selectedReport, startDate, endDate, journalEntries, chartOfAccounts, invoices, payments, bankAccounts, bankTransactions, businessPartners, costCenters, revenueCenters]
  );

  const handleTabChange = (key: React.Key) => {
    const groupKey = key as ReportGroupKey;
    setSelectedTab(groupKey);
    setSelectedReport(REPORT_GROUPS[groupKey].reports[0][0]);
  };

  const handleRefresh = () => {
    setGeneratedAt(new Date().toLocaleString());
    initializeAccounting().catch(() => {});
  };

  const handleExport = (format: 'csv' | 'excel') => {
    const header = report.columns.map((column) => column.label);
    const body = report.rows.map((row) => report.columns.map((column) => row[column.key] || ''));
    const csv = [header, ...body].map((line) => line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: format === 'excel' ? 'application/vnd.ms-excel' : 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `accounting_${selectedReport}_${startDate}.${format === 'excel' ? 'xls' : 'csv'}`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="px-3 pt-2 pb-3 md:px-4 md:pt-3 md:pb-4">
      <div className="mx-auto max-w-[1600px] space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="mb-1 flex items-center gap-1.5">
              <h1 className="text-lg md:text-xl font-bold text-gray-800">Reports</h1>
            </div>
            <p className="max-w-2xl text-sm text-slate-600">
              Why the numbers moved, where money came from or went, and what needs attention.
              Official statements stay under Statements.
            </p>
          </div>
          <div className="flex flex-nowrap items-center gap-2 overflow-x-auto shrink-0">
            <Button size="sm" variant="flat" className="shrink-0" startContent={<RefreshCw size={16} />} onPress={handleRefresh}>
              Refresh
            </Button>
            <Button size="sm" variant="bordered" className="shrink-0" startContent={<StickyNote size={16} />} onPress={onOpen}>
              Notes
            </Button>
            <Button size="sm" variant="bordered" className="shrink-0" startContent={<Printer size={16} />} onPress={() => window.print()}>
              Print
            </Button>
            <Dropdown>
              <DropdownTrigger>
                <Button size="sm" color="primary" className="shrink-0" startContent={<ArrowDownToLine size={16} />}>
                  Export
                </Button>
              </DropdownTrigger>
              <DropdownMenu aria-label="Export report">
                <DropdownItem key="excel" startContent={<FileSpreadsheet size={16} />} onPress={() => handleExport('excel')}>
                  Spreadsheet
                </DropdownItem>
                <DropdownItem key="csv" startContent={<ArrowDownToLine size={16} />} onPress={() => handleExport('csv')}>
                  CSV
                </DropdownItem>
                <DropdownItem key="pdf" startContent={<FileText size={16} />} onPress={() => window.print()}>
                  Print PDF
                </DropdownItem>
              </DropdownMenu>
            </Dropdown>
          </div>
        </div>

        <Card className="border border-slate-200 shadow-sm">
          <CardBody className="gap-4 p-4">
            <Tabs
              selectedKey={selectedTab}
              onSelectionChange={handleTabChange}
              aria-label="Accounting report categories"
              color="primary"
              variant="underlined"
              classNames={{ tabList: 'gap-5', cursor: 'w-full', tab: 'px-0 h-10' }}
            >
              {Object.entries(REPORT_GROUPS).map(([key, group]) => (
                <Tab key={key} title={group.title} />
              ))}
            </Tabs>

            <div className="grid gap-4 lg:grid-cols-[minmax(260px,1fr)_2fr]">
              <Select
                label="Report"
                selectedKeys={[selectedReport]}
                onSelectionChange={(keys) => {
                  const next = Array.from(keys)[0] as string;
                  if (next) setSelectedReport(next);
                }}
                startContent={<TrendingUp size={16} className="text-slate-400" />}
              >
                {REPORT_GROUPS[selectedTab].reports.map(([key, label]) => (
                  <SelectItem key={key}>{label}</SelectItem>
                ))}
              </Select>

              <div>
                <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <CalendarDays size={14} /> Reporting period
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {(['today', 'specific', 'range'] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => {
                        if (mode === 'today') {
                          const day = new Date().toISOString().slice(0, 10);
                          setStartDate(day);
                          setEndDate(day);
                        }
                        setReportDateMode(mode);
                      }}
                      className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                        reportDateMode === mode
                          ? 'border-blue-600 bg-blue-600 text-white'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-blue-400'
                      }`}
                    >
                      {mode === 'today' ? 'Today' : mode === 'specific' ? 'Specific date' : 'Date range'}
                    </button>
                  ))}
                  {reportDateMode === 'specific' && (
                    <Input
                      aria-label="Report date"
                      type="date"
                      value={startDate}
                      onChange={(event) => {
                        setStartDate(event.target.value);
                        setEndDate(event.target.value);
                      }}
                      className="w-44"
                      size="sm"
                    />
                  )}
                  {reportDateMode === 'range' && (
                    <>
                      <Input aria-label="Start date" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="w-44" size="sm" />
                      <span className="text-sm text-slate-400">to</span>
                      <Input aria-label="End date" type="date" value={endDate} min={startDate} onChange={(event) => setEndDate(event.target.value)} className="w-44" size="sm" />
                    </>
                  )}
                </div>
              </div>
            </div>
          </CardBody>
        </Card>

        <Card className="border border-slate-200 shadow-sm">
          <CardBody className="overflow-x-auto px-4 py-3">
            <div className="flex min-w-max items-center divide-x divide-slate-200">
              {(report.kpis.length ? report.kpis : [{ label: 'Rows', value: String(report.rows.length) }]).map((kpi) => (
                <div key={kpi.label} className="flex items-baseline gap-2 px-4 first:pl-0 last:pr-0">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{kpi.label}</span>
                  <span className="text-base font-bold text-slate-950">{kpi.value}</span>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>

        <Card id="report-print-area" className="border border-slate-200 shadow-sm">
          <CardHeader className="flex flex-col items-start gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-bold text-slate-950">{reportLabel}</h2>
                <Chip size="sm" color="primary" variant="flat">{REPORT_GROUPS[selectedTab].title}</Chip>
              </div>
              <p className="mt-1 text-sm text-slate-500">
                {REPORT_QUESTIONS[selectedReport] || REPORT_GROUPS[selectedTab].description}
              </p>
            </div>
            <div className="text-left text-xs text-slate-500 sm:text-right">
              <div>{startDate === endDate ? startDate : `${startDate} – ${endDate}`}</div>
              <div>Generated {generatedAt}</div>
            </div>
          </CardHeader>
          <CardBody className="p-5">
            {report.rows.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center">
                <p className="text-sm font-medium text-slate-700">No rows for this period</p>
                <p className="mt-1 text-xs text-slate-500">{report.emptyHint}</p>
              </div>
            ) : (
              <Table removeWrapper aria-label={reportLabel}>
                <TableHeader>
                  {report.columns.map((column) => (
                    <TableColumn key={column.key} className={column.align === 'right' ? 'text-right' : ''}>
                      {column.label}
                    </TableColumn>
                  ))}
                </TableHeader>
                <TableBody>
                  {report.rows.map((row, index) => (
                    <TableRow key={`${selectedReport}-${index}`}>
                      {report.columns.map((column) => (
                        <TableCell key={column.key} className={column.align === 'right' ? 'text-right font-mono text-sm' : 'text-sm'}>
                          {row[column.key]}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            {reportNotes && (
              <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-amber-800">Report notes</div>
                <p className="mt-1 whitespace-pre-wrap text-sm text-amber-950">{reportNotes}</p>
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      <Modal isOpen={isOpen} onClose={onClose} size="2xl">
        <ModalContent>
          <ModalHeader>Notes for this report</ModalHeader>
          <ModalBody>
            <Textarea
              label="Notes"
              placeholder="Anything to remember about this report…"
              value={reportNotes}
              onValueChange={setReportNotes}
              minRows={4}
            />
          </ModalBody>
          <ModalFooter>
            <Button variant="bordered" onPress={onClose}>Cancel</Button>
            <Button color="primary" onPress={onClose}>Save notes</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
