'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { 
  Card, CardBody, CardHeader, Button, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, 
  Tabs, Tab, Select, SelectItem, Input, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter,
  useDisclosure, Textarea, Dropdown, DropdownTrigger, DropdownMenu, DropdownItem
} from '@heroui/react';
import { useReportingStore } from '../lib/frontoffice/reportingStore';
import { useSettingsStore } from '../lib/settings/store';
import { frontOfficeStore } from '../lib/frontoffice/store';
import { useNightAuditLog } from '../lib/frontoffice/useNightAuditLog';
import { buildOrgProfile } from '../lib/print/buildOrgProfile';
import DailyTransactionReportView, { type TransactionRow } from './DailyTransactionReportView';

function labelize(key: string): string {
  return key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase());
}

function formatReportValue(value: unknown): React.ReactNode {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return String(value);
}

/** Renders an array of row objects as a small table — reused for nested
 * report arrays like discount requests or complimentary rooms. */
function ReportMiniTable({ rows }: { rows: Record<string, unknown>[] }) {
  if (rows.length === 0) return <p className="text-sm text-gray-500">None</p>;
  const columns = Object.keys(rows[0]);
  return (
    <Table removeWrapper isCompact aria-label="Report detail">
      <TableHeader>
        {columns.map((c) => <TableColumn key={c}>{labelize(c)}</TableColumn>) as any}
      </TableHeader>
      <TableBody>
        {rows.map((row, i) => (
          <TableRow key={i}>
            {columns.map((c) => <TableCell key={c}>{formatReportValue(row[c])}</TableCell>) as any}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/** Renders a report's summary object recursively: primitive fields as stat
 * tiles, nested objects as labeled sub-sections, arrays of objects as mini
 * tables. Used for reports that return one object rather than a row array
 * (daily flash, occupancy, discount requests, complimentary rooms, pricing
 * analytics, ...) — previously these silently dropped every non-primitive
 * field, so most of what the report actually computed never reached the screen. */
function ReportSummarySection({ data }: { data: Record<string, unknown> }) {
  const entries = Object.entries(data);
  const primitives = entries.filter(([, v]) => v === null || typeof v !== 'object');
  const objects = entries.filter(([, v]) => v !== null && typeof v === 'object' && !Array.isArray(v));
  const arrays = entries.filter(([, v]) => Array.isArray(v));

  return (
    <div className="space-y-6">
      {primitives.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {primitives.map(([key, value]) => (
            <div key={key} className="p-3 bg-gray-50 rounded-lg border">
              <div className="text-xs text-gray-500">{labelize(key)}</div>
              <div className="text-lg font-semibold text-ghana-black">{formatReportValue(value)}</div>
            </div>
          ))}
        </div>
      )}
      {objects.map(([key, value]) => (
        <div key={key}>
          <h4 className="text-sm font-semibold text-gray-700 mb-2">{labelize(key)}</h4>
          <ReportSummarySection data={value as Record<string, unknown>} />
        </div>
      ))}
      {arrays.map(([key, value]) => {
        const arr = value as unknown[];
        const isObjectArray = arr.length > 0 && typeof arr[0] === 'object' && arr[0] !== null;
        return (
          <div key={key}>
            <h4 className="text-sm font-semibold text-gray-700 mb-2">{labelize(key)}</h4>
            {isObjectArray
              ? <ReportMiniTable rows={arr as Record<string, unknown>[]} />
              : <p className="text-sm text-gray-600">{arr.length > 0 ? arr.join(', ') : 'None'}</p>}
          </div>
        );
      })}
    </div>
  );
}

// Reports that read startDate/endDate instead of a single selectedDate —
// see getCurrentReportData()'s switch below, which is the source of truth.
const RANGE_REPORT_KEYS = new Set(['source-business', 'market-segmentation', 'discount-request', 'complimentary-room', 'pricing-analytics']);
// Reports that don't take a date at all (guest-history reads guestId instead).
const NO_DATE_REPORT_KEYS = new Set(['guest-history']);

export default function FrontOfficeReportsAnalysis() {
  const [selectedTab, setSelectedTab] = useState('daily-operations');
  const [selectedReport, setSelectedReport] = useState('arrivals');
  const [cashierId, setCashierId] = useState('');
  const [guestId, setGuestId] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  // One consistent 3-way control — Today / Specific Date / Range — always
  // rendered the same way regardless of report type, instead of the date
  // section restructuring itself per report (which read as broken/flaky).
  // "Today" and "Specific Date" are just a range collapsed to a single day
  // (start === end); "Range" is disabled, not hidden, for reports whose
  // generator only accepts one date — see RANGE_REPORT_KEYS.
  const [reportDateMode, setReportDateMode] = useState<'today' | 'specific' | 'range'>('today');
  const [exportFormat, setExportFormat] = useState<'pdf' | 'excel' | 'csv'>('pdf');
  const [isGenerating, setIsGenerating] = useState(false);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [selectedReportData, setSelectedReportData] = useState<any>(null);
  const [reportNotes, setReportNotes] = useState('');

  // Report data reads frontOfficeStore.rooms/reservations/roomTypes directly,
  // which start empty on the server (and on the client's first paint) and
  // only get populated once syncRoomsFromSettings() runs in an effect
  // elsewhere in the app. Rendering the report table before that finishes
  // would show placeholders like a room's "TBD" during SSR and the real
  // value once hydrated — a hydration mismatch. Defer the table itself
  // (not the surrounding page chrome) until after mount.
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const settings = useSettingsStore();
  const reportingStore = useReportingStore();
  const { logs: nightAuditLogs } = useNightAuditLog();
  const orgProfile = buildOrgProfile(settings);

  // currentUser.id is a raw database cuid, not something meant for display —
  // show the person's actual name (or email as a fallback) instead.
  const currentUserLabel = settings.currentUser
    ? `${settings.currentUser.firstName} ${settings.currentUser.lastName}`.trim() || settings.currentUser.email
    : 'System';

  // Starts null (matching SSR, which has no "now" to render) and is only set
  // from an effect — reading new Date() directly in the render body ran on
  // both the server and the client's first paint, and those two clock reads
  // can land in different seconds, failing hydration (the classic Date.now()
  // case React's own hydration-mismatch docs call out).
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  useEffect(() => {
    setGeneratedAt(new Date().toLocaleString('en-GH'));
  }, [selectedReport, selectedTab, selectedDate, startDate, endDate]);

  // Switching to a report whose generator doesn't accept a range shouldn't
  // leave the control stuck showing a disabled "Range" pill with nothing to
  // fill in — fall back to Today, the same single-day value Range collapses
  // to anyway.
  useEffect(() => {
    if (reportDateMode === 'range' && !RANGE_REPORT_KEYS.has(selectedReport)) {
      const today = new Date().toISOString().split('T')[0];
      setReportDateMode('today');
      setSelectedDate(today);
      setStartDate(today);
      setEndDate(today);
    }
  }, [selectedReport, reportDateMode]);

  // Generate reports with detailed logging using the reporting store
  const generateArrivalsReport = useMemo(() => {
    return reportingStore.generateArrivalsReport(selectedDate);
  }, [selectedDate, reportingStore]);

  const generateDeparturesReport = useMemo(() => {
    return reportingStore.generateDeparturesReport(selectedDate);
  }, [selectedDate, reportingStore]);

  const generateRoomStatusReport = useMemo(() => {
    return reportingStore.generateRoomStatusReport(selectedDate);
  }, [selectedDate, reportingStore]);

  const generateCheckInGuestReport = useMemo(() => {
    return reportingStore.generateCheckInGuestReport(selectedDate);
  }, [selectedDate, reportingStore]);

  const generateDailyFlashReport = useMemo(() => {
    return reportingStore.generateDailyFlashReport(selectedDate);
  }, [selectedDate, reportingStore]);

  const handleExportReport = async (reportData: any, format: 'pdf' | 'excel' | 'csv') => {
    setIsGenerating(true);

    try {
      const extension = format === 'excel' ? 'xls' : format;
      const filename = `${selectedReport}_report_${selectedDate}.${extension}`;
      const generatedLabel = generatedAt ? `Generated on ${generatedAt} by ${currentUserLabel}` : undefined;
      const fileUrl = await reportingStore.exportReport(reportData, format, filename, generatedLabel);

      // Download the file
      const a = document.createElement('a');
      a.href = fileUrl;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(fileUrl);

      console.log(`[REPORTS] Successfully exported ${selectedReport} report`);
    } catch (error) {
      console.error(`[REPORTS] Error exporting report:`, error);
    } finally {
      setIsGenerating(false);
    }
  };

  const getCurrentReportData = () => {
    switch (selectedReport) {
      case 'arrivals':
        return generateArrivalsReport;
      case 'departures':
        return generateDeparturesReport;
      case 'room-status':
        return generateRoomStatusReport;
      case 'check-ins':
        return generateCheckInGuestReport;
      case 'high-balance':
        return reportingStore.generateHighBalanceReport(selectedDate);
      case 'wake-up-calls':
        return reportingStore.generateWakeUpCallReport(selectedDate);
      case 'daily-transactions':
        return reportingStore.generateDailyTransactionReport(selectedDate);
      case 'cashier-report':
        return reportingStore.generateCashierReport(selectedDate, cashierId);
      case 'credit-card-reconciliation':
        return reportingStore.generateCreditCardReconciliationReport(selectedDate);
      case 'guest-ledger':
        return reportingStore.generateGuestLedgerReport(selectedDate);
      case 'night-audit-history':
        return nightAuditLogs.map((l) => ({
          businessDate: l.businessDate,
          runAt: new Date(l.runAt).toLocaleString(),
          source: l.source,
          roomCharges: l.roomChargesPosted,
          noShows: l.noShowsMarked,
          status: l.status,
          runBy: l.runBy || '—',
        }));
      case 'daily-flash':
        return generateDailyFlashReport;
      case 'occupancy':
        return reportingStore.generateOccupancyReport(selectedDate);
      case 'pace':
        return reportingStore.generatePaceReport(selectedDate);
      case 'no-shows':
        return reportingStore.generateNoShowReport(selectedDate);
      case 'source-business':
        return reportingStore.generateSourceOfBusinessReport(startDate, endDate);
      case 'market-segmentation':
        return reportingStore.generateMarketSegmentationReport(startDate, endDate);
      case 'discount-request':
        return reportingStore.generateDiscountRequestReport(startDate, endDate);
      case 'complimentary-room':
        return reportingStore.generateComplimentaryRoomReport(startDate, endDate);
      case 'pricing-analytics':
        return reportingStore.generatePricingAnalyticsReport(startDate, endDate);
      case 'guest-count-meal-plan':
        return reportingStore.generateGuestCountMealPlanReport(selectedDate);
      case 'vip':
        return reportingStore.generateVIPReport(selectedDate);
      case 'guest-history':
        return reportingStore.generateGuestHistoryReport(guestId);
      default:
        return generateArrivalsReport;
    }
  };

  const renderReportTable = () => {
    if (!mounted) {
      return (
        <div className="text-center py-8">
          <p className="text-gray-500">Loading…</p>
        </div>
      );
    }

    const data = getCurrentReportData();

    if (!data || (Array.isArray(data) && data.length === 0)) {
      return (
        <div className="text-center py-8">
          <p className="text-gray-500">No data available for the selected report and date.</p>
        </div>
      );
    }

    // Daily Transaction Report gets its own view — guest/staff/method/status/
    // category summaries plus a groupable detail table — instead of the plain
    // auto-columned table every other report uses.
    if (selectedReport === 'daily-transactions' && Array.isArray(data)) {
      return <DailyTransactionReportView transactions={data as TransactionRow[]} />;
    }

    // Some reports (daily-flash, occupancy, cashier's report, guest history,
    // discount requests, complimentary rooms, pricing analytics) return a
    // single summary object rather than a row-per-record array — render
    // those recursively instead of feeding a non-array into the table below.
    if (!Array.isArray(data)) {
      return <ReportSummarySection data={data as Record<string, unknown>} />;
    }

    // Get column headers from the first item
    const columns = Object.keys(data[0] || {});
    
    return (
      <Table aria-label={`${selectedReport} report table`}>
        <TableHeader>
          {columns.map((column) => (
            <TableColumn key={column}>
              {column.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
            </TableColumn>
          ))}
        </TableHeader>
        <TableBody>
          {data.map((row: any, index: number) => (
            <TableRow key={index}>
              {columns.map((column) => (
                <TableCell key={column}>
                  {typeof row[column] === 'boolean'
                    ? (row[column] ? 'Yes' : 'No')
                    : Array.isArray(row[column])
                    ? row[column].join(', ')
                    // A plain object isn't a valid React child and crashes the render —
                    // fall back to a readable "key: value" summary instead.
                    : row[column] !== null && typeof row[column] === 'object'
                    ? Object.entries(row[column]).map(([k, v]) => `${k}: ${v}`).join(', ')
                    : row[column]}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-ghana-black mb-2">📈 Reports & Analysis</h1>
        <p className="text-gray-600">
          Comprehensive reporting system for hotel operations and performance analysis
        </p>
      </div>

      {/* Date and Report Selection */}
      <div className="flex items-end justify-between gap-4 mb-6 flex-wrap">
        <div className="flex items-end gap-2 flex-wrap">
          {!NO_DATE_REPORT_KEYS.has(selectedReport) && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Report Date</label>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const today = new Date().toISOString().split('T')[0];
                    setReportDateMode('today');
                    setSelectedDate(today);
                    setStartDate(today);
                    setEndDate(today);
                  }}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${reportDateMode === 'today' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400 hover:text-blue-600'}`}
                >
                  Today
                </button>
                <button
                  onClick={() => setReportDateMode('specific')}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${reportDateMode === 'specific' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400 hover:text-blue-600'}`}
                >
                  Specific Date
                </button>
                <button
                  onClick={() => setReportDateMode('range')}
                  disabled={!RANGE_REPORT_KEYS.has(selectedReport)}
                  title={RANGE_REPORT_KEYS.has(selectedReport) ? undefined : "This report doesn't support a date range yet — it runs for a single day"}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                    !RANGE_REPORT_KEYS.has(selectedReport)
                      ? 'bg-gray-50 text-gray-300 border-gray-200 cursor-not-allowed'
                      : reportDateMode === 'range'
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400 hover:text-blue-600'
                  }`}
                >
                  Range
                </button>
                {reportDateMode === 'specific' && (
                  <Input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => {
                      setSelectedDate(e.target.value);
                      setStartDate(e.target.value);
                      setEndDate(e.target.value);
                    }}
                    className="w-40"
                  />
                )}
                {reportDateMode === 'range' && RANGE_REPORT_KEYS.has(selectedReport) && (
                  <>
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-40"
                    />
                    <span className="text-gray-400 text-sm">→</span>
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-40"
                    />
                  </>
                )}
              </div>
            </div>
          )}
        </div>
        <div className="flex items-end space-x-2">
          <Button
            color="primary"
            variant="flat"
            onClick={() => {
              console.log(`[REPORTS] Manually triggered report generation for ${selectedReport}`);
            }}
          >
            🔄 Refresh
          </Button>
          <Dropdown>
            <DropdownTrigger>
              <Button variant="bordered">
                📥 Export
              </Button>
            </DropdownTrigger>
            <DropdownMenu
              selectionMode="single"
              disallowEmptySelection
              selectedKeys={[exportFormat]}
              onSelectionChange={(keys) => setExportFormat(Array.from(keys)[0] as 'pdf' | 'excel' | 'csv')}
            >
              <DropdownItem key="pdf">PDF</DropdownItem>
              <DropdownItem key="excel">Excel</DropdownItem>
              <DropdownItem key="csv">CSV</DropdownItem>
            </DropdownMenu>
          </Dropdown>
        </div>
      </div>

      <Tabs 
        selectedKey={selectedTab} 
        onSelectionChange={(key) => setSelectedTab(key as string)}
        className="mb-6"
      >
        <Tab key="daily-operations" title="Daily Operations">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Daily Operations Reports</h2>
              <div className="flex space-x-2">
                <Select
                  selectedKeys={[selectedReport]}
                  onSelectionChange={(keys) => setSelectedReport(Array.from(keys)[0] as string)}
                  className="w-48"
                >
                  <SelectItem key="arrivals">Arrivals Report</SelectItem>
                  <SelectItem key="departures">Departures Report</SelectItem>
                  <SelectItem key="room-status">Room Status Report</SelectItem>
                  <SelectItem key="check-ins">Check-In Guest List</SelectItem>
                  <SelectItem key="high-balance">High Balance Report</SelectItem>
                  <SelectItem key="wake-up-calls">Wake-up Call Sheet</SelectItem>
                </Select>
                <Button
                  color="primary"
                  variant="flat"
                  onClick={() => handleExportReport(getCurrentReportData(), exportFormat)}
                  isLoading={isGenerating}
                >
                  {isGenerating ? '🖨️ Printing...' : '🖨️ Print'}
                </Button>
              </div>
            </div>

            <Card id="report-print-area">
              <CardHeader className="flex flex-col items-start gap-0">
                <div className="hidden print:block">
                  <h2 className="text-xl font-bold">{orgProfile.name}</h2>
                  {(orgProfile.address || orgProfile.phone || orgProfile.email) && (
                    <p className="text-xs text-gray-500">
                      {[orgProfile.address, orgProfile.phone, orgProfile.email].filter(Boolean).join(' · ')}
                    </p>
                  )}
                </div>
                <h3 className="text-lg font-semibold mt-3">
                  {selectedReport.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </h3>
                <p className="hidden print:block text-sm text-gray-600">
                  Generated on {generatedAt ?? '…'} by {currentUserLabel}
                </p>
              </CardHeader>
              <CardBody>
                {renderReportTable()}
              </CardBody>
            </Card>
          </div>
        </Tab>

        <Tab key="financial-auditing" title="Financial & Auditing">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Financial & Auditing Reports</h2>
              <div className="flex space-x-2">
                <Select
                  selectedKeys={[selectedReport]}
                  onSelectionChange={(keys) => setSelectedReport(Array.from(keys)[0] as string)}
                  className="w-48"
                >
                  <SelectItem key="daily-transactions">Daily Transaction Report</SelectItem>
                  <SelectItem key="cashier-report">Cashier's Report</SelectItem>
                  <SelectItem key="credit-card-reconciliation">Credit Card Reconciliation</SelectItem>
                  <SelectItem key="guest-ledger">Guest Ledger Report</SelectItem>
                  <SelectItem key="night-audit-history">Night Audit History</SelectItem>
                </Select>
                {selectedReport === 'cashier-report' && (
                  <Select
                    selectedKeys={cashierId ? [cashierId] : []}
                    onSelectionChange={(keys) => setCashierId(Array.from(keys)[0] as string || '')}
                    className="w-48"
                    placeholder="Select cashier"
                  >
                    {/* Matched against FolioPayment.processedBy, which records a name, not a user id. */}
                    {settings.users.map(u => {
                      const name = `${u.firstName} ${u.lastName}`.trim();
                      return <SelectItem key={name}>{name}</SelectItem>;
                    })}
                  </Select>
                )}
                <Button
                  color="primary"
                  variant="flat"
                  onClick={() => handleExportReport(getCurrentReportData(), exportFormat)}
                  isLoading={isGenerating}
                >
                  {isGenerating ? '🖨️ Printing...' : '🖨️ Print'}
                </Button>
              </div>
            </div>

            <Card id="report-print-area">
              <CardHeader className="flex flex-col items-start gap-0">
                <div className="hidden print:block">
                  <h2 className="text-xl font-bold">{orgProfile.name}</h2>
                  {(orgProfile.address || orgProfile.phone || orgProfile.email) && (
                    <p className="text-xs text-gray-500">
                      {[orgProfile.address, orgProfile.phone, orgProfile.email].filter(Boolean).join(' · ')}
                    </p>
                  )}
                </div>
                <h3 className="text-lg font-semibold mt-3">
                  {selectedReport.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </h3>
                <p className="hidden print:block text-sm text-gray-600">
                  Generated on {generatedAt ?? '…'} by {currentUserLabel}
                </p>
              </CardHeader>
              <CardBody>
                {renderReportTable()}
              </CardBody>
            </Card>
          </div>
        </Tab>

        <Tab key="management-strategy" title="Management & Strategy">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Management & Strategy Reports</h2>
              <div className="flex space-x-2">
                <Select
                  selectedKeys={[selectedReport]}
                  onSelectionChange={(keys) => setSelectedReport(Array.from(keys)[0] as string)}
                  className="w-48"
                >
                  <SelectItem key="daily-flash">Daily Flash Report</SelectItem>
                  <SelectItem key="occupancy">Daily Occupancy Report</SelectItem>
                  <SelectItem key="pace">Pace Report</SelectItem>
                  <SelectItem key="no-shows">No-Show Report</SelectItem>
                  <SelectItem key="source-business">Source of Business Report</SelectItem>
                  <SelectItem key="market-segmentation">Market Segmentation Report</SelectItem>
                  <SelectItem key="discount-request">Discount Request Report</SelectItem>
                  <SelectItem key="complimentary-room">Complimentary Room Report</SelectItem>
                  <SelectItem key="pricing-analytics">Pricing Analytics Report</SelectItem>
                </Select>
                <Button
                  color="primary"
                  variant="flat"
                  onClick={() => handleExportReport(getCurrentReportData(), exportFormat)}
                  isLoading={isGenerating}
                >
                  {isGenerating ? '🖨️ Printing...' : '🖨️ Print'}
                </Button>
              </div>
            </div>

            <Card id="report-print-area">
              <CardHeader className="flex flex-col items-start gap-0">
                <div className="hidden print:block">
                  <h2 className="text-xl font-bold">{orgProfile.name}</h2>
                  {(orgProfile.address || orgProfile.phone || orgProfile.email) && (
                    <p className="text-xs text-gray-500">
                      {[orgProfile.address, orgProfile.phone, orgProfile.email].filter(Boolean).join(' · ')}
                    </p>
                  )}
                </div>
                <h3 className="text-lg font-semibold mt-3">
                  {selectedReport.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </h3>
                <p className="hidden print:block text-sm text-gray-600">
                  Generated on {generatedAt ?? '…'} by {currentUserLabel}
                </p>
              </CardHeader>
              <CardBody>
                {renderReportTable()}
              </CardBody>
            </Card>
          </div>
        </Tab>

        <Tab key="other-departments" title="Other Departments">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Other Departments Reports</h2>
              <div className="flex space-x-2">
                <Select
                  selectedKeys={[selectedReport]}
                  onSelectionChange={(keys) => setSelectedReport(Array.from(keys)[0] as string)}
                  className="w-48"
                >
                  <SelectItem key="guest-count-meal-plan">Guest Count & Meal Plan Report</SelectItem>
                  <SelectItem key="vip">VIP Report</SelectItem>
                  <SelectItem key="guest-history">Guest History Report</SelectItem>
                </Select>
                {selectedReport === 'guest-history' && (
                  <Select
                    selectedKeys={guestId ? [guestId] : []}
                    onSelectionChange={(keys) => setGuestId(Array.from(keys)[0] as string || '')}
                    className="w-48"
                    placeholder="Select guest"
                  >
                    {frontOfficeStore.guests.slice(0, 200).map(g => <SelectItem key={g.id}>{g.name}</SelectItem>)}
                  </Select>
                )}
                <Button
                  color="primary"
                  variant="flat"
                  onClick={() => handleExportReport(getCurrentReportData(), exportFormat)}
                  isLoading={isGenerating}
                >
                  {isGenerating ? '🖨️ Printing...' : '🖨️ Print'}
                </Button>
              </div>
            </div>

            <Card id="report-print-area">
              <CardHeader className="flex flex-col items-start gap-0">
                <div className="hidden print:block">
                  <h2 className="text-xl font-bold">{orgProfile.name}</h2>
                  {(orgProfile.address || orgProfile.phone || orgProfile.email) && (
                    <p className="text-xs text-gray-500">
                      {[orgProfile.address, orgProfile.phone, orgProfile.email].filter(Boolean).join(' · ')}
                    </p>
                  )}
                </div>
                <h3 className="text-lg font-semibold mt-3">
                  {selectedReport.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </h3>
                <p className="hidden print:block text-sm text-gray-600">
                  Generated on {generatedAt ?? '…'} by {currentUserLabel}
                </p>
              </CardHeader>
              <CardBody>
                {renderReportTable()}
              </CardBody>
            </Card>
          </div>
        </Tab>
      </Tabs>

      {/* Report Notes Modal */}
      <Modal isOpen={isOpen} onClose={onClose} size="2xl">
        <ModalContent>
          <ModalHeader>Add Report Notes</ModalHeader>
          <ModalBody>
            <Textarea
              label="Report Notes"
              placeholder="Add any additional notes or observations about this report..."
              value={reportNotes}
              onChange={(e) => setReportNotes(e.target.value)}
              minRows={4}
            />
          </ModalBody>
          <ModalFooter>
            <Button variant="bordered" onPress={onClose}>
              Cancel
            </Button>
            <Button color="primary" onPress={() => {
              console.log(`[REPORTS] Added notes to ${selectedReport} report:`, reportNotes);
              onClose();
            }}>
              Save Notes
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
