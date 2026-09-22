'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  Card, CardBody, CardHeader, Button,
  Tabs, Tab, Select, SelectItem, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter,
  useDisclosure, Textarea, Dropdown, DropdownTrigger, DropdownMenu, DropdownItem
} from '@heroui/react';
import { useReportingStore } from '../lib/frontoffice/reportingStore';
import { useSettingsStore } from '../lib/settings/store';
import { frontOfficeStore } from '../lib/frontoffice/store';
import { useGuestServicesStore } from '../lib/frontoffice/guestServicesStore';
import { useNightAuditLog } from '../lib/frontoffice/useNightAuditLog';
import { buildOrgProfile } from '../lib/print/buildOrgProfile';
import DailyTransactionReportView, { type TransactionRow } from './DailyTransactionReportView';
import { ReportOutput, ReportDateControl, TransactionFilters, type ReportDateMode } from './reports/ReportBasics';

// Reports whose generator accepts an optional endDate to cover a period
// instead of one day — see getCurrentReportData()'s switch below, which is
// the source of truth. Room Status and Daily Flash stay single-date only:
// Room Status has no historical per-day log to sum across a range, and
// Daily Flash is a point-in-time operational snapshot, not an event list.
const RANGE_REPORT_KEYS = new Set([
  'arrivals', 'departures', 'check-ins', 'high-balance', 'wake-up-calls', 'cancelled-reservations', 'checkinout-daybook',
  'daily-transactions', 'cashier-report', 'credit-card-reconciliation', 'guest-ledger',
  'occupancy', 'room-performance', 'room-type-revenue', 'agent-source', 'reservation-status', 'pace', 'no-shows', 'night-audit-history',
  'source-business', 'market-segmentation', 'discount-request', 'complimentary-room', 'pricing-analytics',
  'foreign-guest-document', 'guest-service-requests',
]);
// Reports that don't take a date at all (guest-history reads guestId instead).
const NO_DATE_REPORT_KEYS = new Set(['guest-history']);

export default function FrontOfficeReportsAnalysis() {
  const [selectedTab, setSelectedTab] = useState('daily-operations');
  const [selectedReport, setSelectedReport] = useState('arrivals');
  const [cashierId, setCashierId] = useState('');
  const [guestId, setGuestId] = useState('');
  // '' = every room (Room Performance report).
  const [roomFilter, setRoomFilter] = useState('');
  // startDate doubles as "the date" for Today/Specific Date mode (where it's
  // always equal to endDate) and as the period start for Range mode — kept
  // as one value instead of a separate date state, which used to go stale
  // the moment Range mode was selected (Range only ever updated
  // startDate/endDate, never that other field).
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  // One consistent 3-way control — Today / Specific Date / Range — always
  // rendered the same way regardless of report type, instead of the date
  // section restructuring itself per report (which read as broken/flaky).
  // "Today" and "Specific Date" are just a range collapsed to a single day
  // (start === end); "Range" is disabled, not hidden, for reports whose
  // generator only accepts one date — see RANGE_REPORT_KEYS.
  const [reportDateMode, setReportDateMode] = useState<ReportDateMode>('today');
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
  useEffect(() => {
    setMounted(true);
    // Nothing else on this screen loads the Guest Services catalog/queue — without this the
    // Guest Service Requests report would always show empty, not because there's nothing to
    // report but because it was never fetched.
    void useGuestServicesStore.getState().hydrateFromApi();
  }, []);

  const settings = useSettingsStore();
  const reportingStore = useReportingStore();
  // Re-render once the Guest Services catalog/queue finishes loading (see the mount effect below),
  // so the Guest Service Requests report reflects real data instead of the empty pre-hydration state.
  useGuestServicesStore((s) => s.hydrated);
  const { logs: nightAuditLogs } = useNightAuditLog({ startDate, endDate });
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
  }, [selectedReport, selectedTab, startDate, endDate]);

  // Switching to a report whose generator doesn't accept a range shouldn't
  // leave the control stuck showing a disabled "Range" pill with nothing to
  // fill in — fall back to Today, the same single-day value Range collapses
  // to anyway.
  useEffect(() => {
    if (reportDateMode === 'range' && !RANGE_REPORT_KEYS.has(selectedReport)) {
      const today = new Date().toISOString().split('T')[0];
      setReportDateMode('today');
      setStartDate(today);
      setEndDate(today);
    }
  }, [selectedReport, reportDateMode]);

  // Generate reports with detailed logging using the reporting store
  const generateArrivalsReport = useMemo(() => {
    return reportingStore.generateArrivalsReport(startDate, endDate);
  }, [startDate, endDate, reportingStore]);

  const generateDeparturesReport = useMemo(() => {
    return reportingStore.generateDeparturesReport(startDate, endDate);
  }, [startDate, endDate, reportingStore]);

  const generateRoomStatusReport = useMemo(() => {
    return reportingStore.generateRoomStatusReport(startDate);
  }, [startDate, reportingStore]);

  const generateCheckInGuestReport = useMemo(() => {
    return reportingStore.generateCheckInGuestReport(startDate, endDate);
  }, [startDate, endDate, reportingStore]);

  const generateDailyFlashReport = useMemo(() => {
    return reportingStore.generateDailyFlashReport(startDate);
  }, [startDate, reportingStore]);

  // The report picker's onSelectionChange fires with an empty key set on some
  // interactions (e.g. Escape while it's open), and Array.from(keys)[0] on an
  // empty set is undefined — setSelectedReport(undefined) then crashed every
  // selectedReport.replace(...) call below. Only commit a real selection.
  const handleSelectReport = (keys: unknown) => {
    const key = Array.from(keys as Set<string>)[0];
    if (key) setSelectedReport(key);
  };

  const handleExportReport = async (reportData: any, format: 'pdf' | 'excel' | 'csv') => {
    setIsGenerating(true);

    try {
      const extension = format === 'excel' ? 'xls' : format;
      const filename = `${selectedReport}_report_${startDate}.${extension}`;
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
        return reportingStore.generateHighBalanceReport(startDate, endDate);
      case 'wake-up-calls':
        return reportingStore.generateWakeUpCallReport(startDate, endDate);
      case 'cancelled-reservations':
        return reportingStore.generateCancelledReservationsReport(startDate, endDate);
      case 'checkinout-daybook':
        return reportingStore.generateCheckInOutDaybookReport(startDate, endDate);
      case 'daily-transactions':
        return reportingStore.generateDailyTransactionReport(startDate, endDate);
      case 'cashier-report':
        return reportingStore.generateCashierReport(startDate, cashierId, endDate);
      case 'credit-card-reconciliation':
        return reportingStore.generateCreditCardReconciliationReport(startDate, endDate);
      case 'guest-ledger':
        return reportingStore.generateGuestLedgerReport(startDate, endDate);
      case 'night-audit-history':
        // useNightAuditLog({ startDate, endDate }) already fetches only the
        // matching businessDate range from the server.
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
        return reportingStore.generateOccupancyReport(startDate, endDate);
      case 'room-performance':
        return reportingStore.generateRoomPerformanceReport(startDate, endDate, roomFilter || undefined);
      case 'room-type-revenue':
        return reportingStore.generateRoomTypeRevenueReport(startDate, endDate);
      case 'agent-source':
        return reportingStore.generateAgentSourceReport(startDate, endDate);
      case 'reservation-status':
        return reportingStore.generateReservationStatusReport(startDate, endDate);
      case 'pace':
        return reportingStore.generatePaceReport(startDate, endDate);
      case 'no-shows':
        return reportingStore.generateNoShowReport(startDate, endDate);
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
        return reportingStore.generateGuestCountMealPlanReport(startDate);
      case 'vip':
        return reportingStore.generateVIPReport(startDate);
      case 'guest-history':
        return reportingStore.generateGuestHistoryReport(guestId);
      case 'foreign-guest-document':
        return reportingStore.generateForeignGuestDocumentReport(startDate, endDate);
      case 'guest-service-requests':
        return reportingStore.generateGuestServiceRequestsReport(startDate, endDate);
      default:
        return generateArrivalsReport;
    }
  };

  const renderReportTable = () => {
    const data = mounted ? getCurrentReportData() : undefined;
    // Daily Transaction Report gets its own view — guest/staff/method/status/
    // category summaries plus a groupable detail table — instead of the plain
    // auto-columned table every other report uses.
    const customView = selectedReport === 'daily-transactions' && Array.isArray(data)
      ? <DailyTransactionReportView transactions={data as TransactionRow[]} />
      : undefined;
    return <ReportOutput mounted={mounted} data={data} ariaLabel={`${selectedReport} report table`} customView={customView} />;
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
            <ReportDateControl
              mode={reportDateMode}
              setMode={setReportDateMode}
              startDate={startDate}
              endDate={endDate}
              setStartDate={setStartDate}
              setEndDate={setEndDate}
              rangeSupported={RANGE_REPORT_KEYS.has(selectedReport)}
            />
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
          <Button
            color="primary"
            variant="flat"
            onClick={() => handleExportReport(getCurrentReportData(), exportFormat)}
            isLoading={isGenerating}
          >
            {isGenerating ? 'Exporting…' : '⬇️ Download'}
          </Button>
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
                  onSelectionChange={handleSelectReport}
                  className="w-80"
                >
                  <SelectItem key="arrivals">Arrivals Report</SelectItem>
                  <SelectItem key="departures">Departures Report</SelectItem>
                  <SelectItem key="room-status">Room Status Report</SelectItem>
                  <SelectItem key="check-ins">Check-In Guest List</SelectItem>
                  <SelectItem key="high-balance">High Balance Report</SelectItem>
                  <SelectItem key="wake-up-calls">Wake-up Call Sheet</SelectItem>
                  <SelectItem key="cancelled-reservations">Cancelled Reservations</SelectItem>
                  <SelectItem key="checkinout-daybook">Check-In / Check-Out DayBook</SelectItem>
                </Select>
                <Button
                  color="primary"
                  variant="flat"
                  onClick={() => window.print()}
                >
                  🖨️ Print
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
                  onSelectionChange={handleSelectReport}
                  className="w-80"
                >
                  <SelectItem key="daily-transactions">Daily Transaction Report</SelectItem>
                  <SelectItem key="cashier-report">Cashier's Report</SelectItem>
                  <SelectItem key="credit-card-reconciliation">Credit Card Reconciliation</SelectItem>
                  <SelectItem key="guest-ledger">Guest Ledger Report</SelectItem>
                  <SelectItem key="night-audit-history">Night Audit History</SelectItem>
                </Select>
                {selectedReport === 'cashier-report' && (
                  <TransactionFilters
                    dimensions={[{
                      key: 'cashier', label: 'Cashier', multi: false,
                      selected: cashierId ? [cashierId] : [],
                      setSelected: (values) => setCashierId(values[0] || ''),
                      // Matched against FolioPayment.processedBy, which records a name, not a user id.
                      options: settings.users.map((u) => {
                        const name = `${u.firstName} ${u.lastName}`.trim();
                        return { value: name, label: name };
                      }),
                    }]}
                  />
                )}
                <Button
                  color="primary"
                  variant="flat"
                  onClick={() => window.print()}
                >
                  🖨️ Print
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
                  onSelectionChange={handleSelectReport}
                  className="w-80"
                >
                  <SelectItem key="daily-flash">Daily Flash Report</SelectItem>
                  <SelectItem key="occupancy">Daily Occupancy Report</SelectItem>
                  <SelectItem key="room-performance">Room Performance Report</SelectItem>
                  <SelectItem key="pace">Pace Report</SelectItem>
                  <SelectItem key="no-shows">No-Show Report</SelectItem>
                  <SelectItem key="source-business">Source of Business Report</SelectItem>
                  <SelectItem key="market-segmentation">Market Segmentation Report</SelectItem>
                  <SelectItem key="discount-request">Discount Request Report</SelectItem>
                  <SelectItem key="complimentary-room">Complimentary Room Report</SelectItem>
                  <SelectItem key="pricing-analytics">Pricing Analytics Report</SelectItem>
                  <SelectItem key="room-type-revenue">Room Type Revenue Report</SelectItem>
                  <SelectItem key="agent-source">Agent / Source Wise Report</SelectItem>
                  <SelectItem key="reservation-status">Reservation Status Report</SelectItem>
                </Select>
                {selectedReport === 'room-performance' && (
                  <TransactionFilters
                    dimensions={[{
                      key: 'room', label: 'Room', multi: false,
                      selected: roomFilter ? [roomFilter] : [],
                      setSelected: (values) => setRoomFilter(values[0] || ''),
                      options: frontOfficeStore.rooms.map((r) => ({ value: r.id, label: `Room ${r.id}` })),
                    }]}
                  />
                )}
                <Button
                  color="primary"
                  variant="flat"
                  onClick={() => window.print()}
                >
                  🖨️ Print
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
                  onSelectionChange={handleSelectReport}
                  className="w-80"
                >
                  <SelectItem key="guest-count-meal-plan">Guest Count & Meal Plan Report</SelectItem>
                  <SelectItem key="vip">VIP Report</SelectItem>
                  <SelectItem key="guest-history">Guest History Report</SelectItem>
                  <SelectItem key="foreign-guest-document">Foreign Guest Document Report</SelectItem>
                  <SelectItem key="guest-service-requests">Guest Service Requests Report</SelectItem>
                </Select>
                {selectedReport === 'guest-history' && (
                  <TransactionFilters
                    dimensions={[{
                      key: 'guest', label: 'Guest', multi: false,
                      selected: guestId ? [guestId] : [],
                      setSelected: (values) => setGuestId(values[0] || ''),
                      options: frontOfficeStore.guests.slice(0, 200).map((g) => ({ value: g.id, label: g.name || g.id })),
                    }]}
                  />
                )}
                <Button
                  color="primary"
                  variant="flat"
                  onClick={() => window.print()}
                >
                  🖨️ Print
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
