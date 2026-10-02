'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Button, Card, CardBody, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Spinner } from '@heroui/react';
import { useSettingsStore } from '../../lib/settings/store';
import { usePpeRegisterStore } from '../../lib/accounting/ppeStore';
import { notifyError, notifySuccess } from '../../lib/notifications/notify';

type Status = {
  loaded: boolean;
  counts: {
    staff: number; departments: number; guests: number; reservations: number; stockItems: number; suppliers: number; housekeepingTasks: number; events: number; recipes: number;
    restaurantOrders?: number; securityIncidents?: number; journalEntries?: number;
  };
  notes?: string[];
  kept?: string[];
};

const INCLUDED: Array<[string, string]> = [
  ['Front Office', '8 guests and 8 reservations — arriving today, in the house, upcoming and checked out — with folios whose charges and payments add up, the last three night audits, yesterday’s closed till, and guest service requests (airport pick-up, laundry, spa).'],
  ['Restaurant & Bar', 'Live orders on the kitchen screen (new, cooking, ready), an open bar tab, paid bills from yesterday and this morning, tonight’s table bookings, 8 tables and 4 regular customers. A starter menu is added if you have none.'],
  ['Accounting', 'Every sample sale and payment posted to the ledger, a corporate account with invoices in each aging bucket (one 45 days overdue), supplier bills (paid, open and overdue), expenses, a cash deposit, fixed assets and last month’s payroll — so the trial balance, P&L, balance sheet, cash book and AR/AP aging all have figures.'],
  ['HR & Payroll', '5 departments, 9 positions and 11 staff on real salaries, plus leave requests, attendance, this week’s roster, training, reviews, a promotion, a staff loan, medical cover, a new hire mid-onboarding, and last month’s payroll paid. This month is left for you to run.'],
  ['Inventory & Kitchen', '4 suppliers, 16 stock items (three below their reorder level so alerts show), purchase orders, requisitions, store transfers, goods issued to housekeeping, a stock count with variances and 4 recipes.'],
  ['Housekeeping, Maintenance & Events', 'Cleaning tasks, room assignments per housekeeper, public cleaning areas, maintenance requests, 3 event halls, catering items and 3 event bookings.'],
  ['Security', '4 guards, checkpoints and patrol routes, who is on duty now, patrols (one interrupted), incidents from minor to a live fire alarm, visitors (one overdue) and compliance deadlines (one overdue).'],
];

type TestDataCounts = { transactions: Record<string, number>; profiles: Record<string, number>; total: number };

/** Plain names for the groups shown before clearing. */
const COUNT_GROUPS: Array<[string, string[]]> = [
  ['Stays, folios and payments', ['reservation', 'guestFolio', 'folio', 'folioLine', 'payment', 'cashierShift', 'cashTransfer', 'nightAuditLog', 'serviceRequest']],
  ['Restaurant orders and table bookings', ['fBOrder', 'fBOrderItem', 'tableReservation']],
  ['Accounting entries, invoices and bank lines', ['journalEntry', 'journalEntryLine', 'accountingInvoice', 'accountingInvoiceLine', 'accountingPayment', 'bankTransaction', 'bankReconciliation', 'reconcilingItem', 'expenseVoucher', 'expenseLine', 'pettyCashTxn', 'ppeAsset']],
  ['Stock movements, orders and counts', ['inventoryTransaction', 'purchaseOrder', 'purchaseOrderItem', 'requisition', 'requisitionItem', 'goodsReceiptNote', 'gRNItem', 'stockTransfer', 'stockTransferItem', 'stockCount', 'stockCountItem', 'goodsIssue', 'goodsIssueItem', 'qualityCheck', 'qualityCheckItem', 'supplierInvoice', 'supplierInvoiceItem', 'inventoryAlertAcknowledgment']],
  ['HR and payroll records', ['hrPayrollPeriod', 'hrPayrollRecord', 'hrLeaveRequest', 'hrTrainingRecord', 'hrAttendance', 'hrShift', 'hrEmployeeBenefits', 'hrPerformanceReview', 'hrPerformanceLog', 'hrEmployeeChange', 'hrOnboardingChecklist', 'hrStaffDebt', 'hrStaffDebtRepayment']],
  ['Housekeeping, events, security and compliance reports', ['housekeepingTask', 'roomStatusLog', 'maintenanceRequest', 'eventBooking', 'securityIncident', 'securityVisitor', 'securityPatrolLog', 'securityShift', 'complianceReport']],
];
const PROFILE_LABELS: Record<string, string> = {
  guest: 'guests', company: 'company clients', fBCustomer: 'restaurant customers',
  businessPartner: 'business partners', supplier: 'suppliers', hrEmployee: 'employees',
};

export default function SampleDataPanel() {
  const canManage = useSettingsStore((s) => s.hasPermission('settings.manage-sample-data'));
  const isAdmin = useSettingsStore((s) => (s.sessionRoleId ?? s.currentUser?.roleId) === 'admin');
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState<'load' | 'remove' | 'clear' | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [clearCounts, setClearCounts] = useState<TestDataCounts | null>(null);
  const [clearTyped, setClearTyped] = useState('');

  const openClear = async () => {
    setClearTyped('');
    try {
      const res = await fetch('/api/settings/test-data', { cache: 'no-store' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) { notifyError(body?.error || 'Could not count the test data.', 'Clear test data'); return; }
      setClearCounts(body);
    } catch {
      notifyError('Could not reach the server. Please try again.', 'Clear test data');
    }
  };

  const runClear = async () => {
    setBusy('clear');
    try {
      const res = await fetch('/api/settings/test-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: clearTyped.trim() }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) { notifyError(body?.error || 'Clearing failed. Nothing was removed.', 'Test data not cleared'); return; }
      const extra = [
        body.sampleReloaded ? 'Sample data was loaded again, dated around today.' : '',
        ...(body.notes || []),
      ].filter(Boolean).join(' ');
      notifySuccess(`Test data cleared. ${extra} Reloading…`.trim(), 'Test data cleared');
      setClearCounts(null);
      reloadHere();
    } catch {
      notifyError('Could not reach the server. Please try again.', 'Clear test data');
    } finally {
      setBusy(null);
    }
  };

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/settings/sample-data');
      if (res.ok) setStatus(await res.json());
    } catch {}
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  // The server is now clean, but this browser still remembers the sample rooms and guests. Left alone it would
  // show them, and even push the rooms back up (the app copies a browser's room set to a server that has none).
  const forgetSampleLocally = () => {
    const isSample = (x: { id?: string }) => typeof x?.id === 'string' && x.id.startsWith('smp_');
    const state = useSettingsStore.getState();
    const rm = state.roomManagement;
    useSettingsStore.setState({
      roomManagement: { ...rm, roomTypes: rm.roomTypes.filter((x) => !isSample(x)), rooms: rm.rooms.filter((x) => !isSample(x)), ratePlans: rm.ratePlans.filter((x) => !isSample(x)) },
    });
    state.saveSettings();
    for (const storage of [localStorage, sessionStorage]) {
      try {
        const raw = storage.getItem('fo.guests');
        const guests = raw ? JSON.parse(raw) : null;
        if (Array.isArray(guests)) storage.setItem('fo.guests', JSON.stringify(guests.filter((g) => !isSample(g))));
      } catch {}
    }
    // The fixed-asset register keeps a browser copy too, and pushes it to a server that has none.
    const ppe = usePpeRegisterStore.getState();
    usePpeRegisterStore.setState({ assets: ppe.assets.filter((x) => !isSample(x)), categories: ppe.categories.filter((x) => !isSample(x)) });
  };

  // Every screen keeps its own copy of the data, so after a change the app reloads (and comes back to this tab)
  // to show it everywhere.
  const reloadHere = () => {
    try {
      localStorage.setItem('nav.section', 'settings');
      localStorage.setItem('settings.tab', 'sample-data');
    } catch {}
    window.setTimeout(() => window.location.reload(), 1800);
  };

  const run = async (action: 'load' | 'remove') => {
    setBusy(action);
    try {
      const res = await fetch('/api/settings/sample-data', { method: action === 'load' ? 'POST' : 'DELETE' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        notifyError(body?.error || 'Something went wrong — nothing was changed that you can’t retry.', action === 'load' ? 'Sample data not loaded' : 'Sample data not removed');
        return;
      }
      setStatus(body);
      if (action === 'remove') forgetSampleLocally();
      const extra = [...(body.notes || []), ...(body.kept?.length ? [`Kept because other records depend on them: ${body.kept.join(', ')}.`] : [])].join(' ');
      notifySuccess(`${action === 'load' ? 'Sample data loaded.' : 'Sample data removed.'} ${extra} Reloading to show it everywhere…`.trim(), action === 'load' ? 'Sample data loaded' : 'Sample data removed');
      reloadHere();
    } catch {
      notifyError('Could not reach the server. Please try again.', 'Sample data');
    } finally {
      setBusy(null);
      setConfirmRemove(false);
    }
  };

  const c = status?.counts;
  return (
    <div className="mt-2 max-w-4xl space-y-3">
      <div>
        <h3 className="text-lg font-semibold text-ghana-black">Sample data for testing</h3>
        <p className="mt-0.5 text-xs text-gray-600">
          Fill this hotel with realistic starter records so testers can try every screen straight away. Sample records are kept apart from
          anything you enter yourself: <strong>Remove sample data</strong> takes out exactly what was loaded and leaves your own data — and a clean slate — behind.
        </p>
      </div>

      <Card className="border-0 shadow-md">
        <CardBody className="space-y-3">
          <p className="text-sm font-medium text-ghana-black">What gets added</p>
          <ul className="space-y-2">
            {INCLUDED.map(([area, text]) => (
              <li key={area} className="text-sm text-gray-700"><span className="font-semibold text-ghana-black">{area}:</span> {text}</li>
            ))}
          </ul>
          <p className="text-xs text-gray-500">Loading again never duplicates anything. If this hotel has no rooms or menu yet, a sample set is added too. Dates are relative to today, so the data always looks current.</p>
        </CardBody>
      </Card>

      <Card className="border-0 shadow-md">
        <CardBody className="space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <p className="text-sm font-medium text-ghana-black">{status === null ? 'Checking…' : status.loaded ? 'Sample data is loaded' : 'No sample data loaded'}</p>
              {c && status?.loaded && (
                <p className="text-xs text-gray-600 mt-1">
                  {c.staff} staff · {c.guests} guests · {c.reservations} reservations · {c.restaurantOrders ?? 0} restaurant orders · {c.journalEntries ?? 0} ledger entries · {c.stockItems} stock items · {c.suppliers} suppliers · {c.housekeepingTasks} housekeeping tasks · {c.events} events · {c.securityIncidents ?? 0} security incidents · {c.recipes} recipes
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <Button color="primary" isDisabled={!canManage || busy !== null} isLoading={busy === 'load'} onPress={() => run('load')}>
                {status?.loaded ? 'Load again' : 'Load sample data'}
              </Button>
              <Button color="danger" variant="flat" isDisabled={!canManage || busy !== null || !status?.loaded} onPress={() => setConfirmRemove(true)}>
                Remove sample data
              </Button>
            </div>
          </div>
          {!canManage && <p className="text-xs text-amber-700">Loading or removing sample data needs the “Load or remove sample data” permission (System Administrators have it).</p>}
          {busy && <div className="flex items-center gap-2 text-sm text-gray-600"><Spinner size="sm" /> Working — this can take a few seconds…</div>}
        </CardBody>
      </Card>

      <Card className="border border-red-200 bg-red-50/40 shadow-none">
        <CardBody className="space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold text-red-800">Clear test data</p>
              <p className="mt-1 text-xs text-gray-700">
                Removes everything testers entered — stays, folios, payments, invoices, ledger entries, restaurant orders, stock movements,
                HR and security records — plus guests, clients, suppliers and employees that testers created. Settings, staff logins,
                rooms and rates, menu, stock items, chart of accounts, taxes, compliance rules and document designs stay, and so does the
                audit log. Stock on hand, cash and bank balances go back to their starting figures. If sample data was loaded, it is
                loaded again fresh, dated around today.
              </p>
            </div>
            <Button color="danger" variant="flat" isDisabled={!canManage || !isAdmin || busy !== null} onPress={openClear}>
              Clear test data…
            </Button>
          </div>
          {(!canManage || !isAdmin) && <p className="text-xs text-amber-700">Only an administrator can clear test data.</p>}
        </CardBody>
      </Card>

      <Modal isOpen={!!clearCounts} onOpenChange={(open) => { if (!open) setClearCounts(null); }} size="lg" scrollBehavior="inside">
        <ModalContent>
          <ModalHeader>Clear all test data?</ModalHeader>
          <ModalBody className="space-y-3 text-sm text-gray-700">
            {clearCounts && (
              <>
                <p>This permanently deletes {clearCounts.total.toLocaleString()} records:</p>
                <ul className="space-y-1">
                  {COUNT_GROUPS.map(([label, keys]) => {
                    const n = keys.reduce((s, k) => s + (clearCounts.transactions[k] || 0), 0);
                    return n > 0 ? <li key={label}>• {label}: <strong>{n.toLocaleString()}</strong></li> : null;
                  })}
                  {Object.entries(clearCounts.profiles).filter(([, n]) => n > 0).map(([k, n]) => (
                    <li key={k}>• Test {PROFILE_LABELS[k] || k}: <strong>{n.toLocaleString()}</strong></li>
                  ))}
                </ul>
                <p className="font-medium text-red-700">This can’t be undone. Take a backup of the database first if you may need any of it.</p>
                <Input
                  label="Type CLEAR to confirm"
                  value={clearTyped}
                  onValueChange={setClearTyped}
                  autoCapitalize="characters"
                />
              </>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={() => setClearCounts(null)}>Keep as is</Button>
            <Button color="danger" isDisabled={clearTyped.trim() !== 'CLEAR'} isLoading={busy === 'clear'} onPress={runClear}>
              Clear test data
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={confirmRemove} onOpenChange={setConfirmRemove} size="lg">
        <ModalContent>
          <ModalHeader>Remove all sample data?</ModalHeader>
          <ModalBody className="space-y-2 text-sm text-gray-700">
            <p>This deletes every sample record listed above, together with anything added to them since — for example a payment or charge on a sample guest’s stay, or attendance for a sample staff member.</p>
            <p>Records you created yourself stay, and the sample ledger entries are taken out with the rest. Anything <em>you</em> posted against sample records (for example a payroll you ran for sample staff, or depreciation on a sample asset) keeps its own ledger entries.</p>
            <p className="font-medium text-ghana-black">This can’t be undone, but you can load the sample data again any time.</p>
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={() => setConfirmRemove(false)}>Cancel</Button>
            <Button color="danger" isLoading={busy === 'remove'} onPress={() => run('remove')}>Remove sample data</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
