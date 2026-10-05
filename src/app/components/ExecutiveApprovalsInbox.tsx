'use client';

import React from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardHeader, CardBody, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, Button, Chip, Spinner } from '@heroui/react';
import { useAccountingStore } from '../lib/accounting/store';
import { fetchPayments } from '../lib/accounting/helpers/api';
import type { Payment } from '../lib/accounting/models';
import { useSettingsStore } from '../lib/settings/store';
import { useLeaveAttendanceStore } from '../lib/hr/leaveAttendanceStore';
import { useEmployeeStore } from '../lib/hr/employeeStore';
import { usePayrollStore } from '../lib/hr/payrollStore';
import { buildPayrollJournal, readEmployerContribution } from '../lib/payroll/monthlyRun';
import { getClientTenantSubdomain } from '../lib/api/clientTenant';
import { formatAccountingCurrency } from '../lib/accounting/tenantAccountingConfig';

type PendingRequisition = {
  id: string;
  requisitionNumber: string;
  requestedBy: string;
  department?: string;
  requestedDate: string;
  items: { quantity: number | string; estimatedPrice: number | string; totalCost: number | string }[];
};

const periodMonthLabel = (periodNumber: string, startDate: Date | string) => {
  const m = /(\d{4})-(\d{2})/.exec(periodNumber);
  return m
    ? new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, 1)).toLocaleString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })
    : new Date(startDate).toLocaleString('en-GB', { month: 'long', year: 'numeric' });
};

function SectionCardHeader({
  title,
  chipLabel,
  chipColor,
}: {
  title: string;
  chipLabel: string;
  chipColor: 'warning' | 'default';
}) {
  return (
    <CardHeader className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="font-semibold text-ghana-black">{title}</h3>
      <Chip size="sm" variant="flat" color={chipColor}>
        {chipLabel}
      </Chip>
    </CardHeader>
  );
}

/**
 * Director/GM approval inbox. Payments and requisitions load first. Journal
 * entries, overtime, and payroll follow so they do not hold those two up.
 * Gated in Navigation.tsx so only someone holding at least one approve
 * permission reaches this screen; each section re-checks its own permission.
 */
export default function ExecutiveApprovalsInbox() {
  const {
    journalEntries,
    payments,
    businessPartners,
    initializeAccounting,
    postJournalEntry,
    postPayment,
    addJournalEntry,
  } = useAccountingStore();
  const hasPermission = useSettingsStore(s => s.hasPermission);
  const canApproveJournalEntries = hasPermission('accounting.approve-journal-entry');
  const canApprovePayments = hasPermission('accounting.approve-payment');
  const canApproveRequisitions = hasPermission('inventory.approve-high-value-requisition');
  const canApproveOvertime = hasPermission('hr.approve-overtime');
  const canApprovePayroll = hasPermission('hr.approve-payroll');
  const requireOvertimeApproval = useSettingsStore(s => s.financialSettings.requireApprovalForOvertime);
  const overtimeThreshold = useSettingsStore(s => s.financialSettings.overtimeApprovalThreshold);
  const requirePayrollApproval = useSettingsStore(s => s.financialSettings.requireApprovalForPayroll !== false);

  const attendances = useLeaveAttendanceStore(s => s.attendances);
  const hydrateAttendance = useLeaveAttendanceStore(s => s.hydrateFromApi);
  const approveOvertime = useLeaveAttendanceStore(s => s.approveOvertime);
  const employees = useEmployeeStore(s => s.employees);
  const hydrateEmployees = useEmployeeStore(s => s.hydrateFromApi);
  const payrollPeriods = usePayrollStore(s => s.payrollPeriods);
  const payrollRecords = usePayrollStore(s => s.payrollRecords);
  const hydratePayroll = usePayrollStore(s => s.hydrateFromApi);
  const approvePeriod = usePayrollStore(s => s.approvePeriod);
  const { data: session } = useSession();
  const approverName = (session?.user as any)?.name || (session?.user as any)?.email || 'Director';

  // Payments and requisitions are marked ready on their own. The other lists
  // start only after those two, so they are not competing for the first load.
  const [ready, setReady] = React.useState({
    payments: false,
    accounting: false,
    requisitions: false,
    overtime: false,
    payroll: false,
  });
  const markReady = (key: keyof typeof ready) => setReady((r) => ({ ...r, [key]: true }));
  const [requisitions, setRequisitions] = React.useState<PendingRequisition[]>([]);
  const [earlyPayments, setEarlyPayments] = React.useState<Payment[] | null>(null);
  const [actingOn, setActingOn] = React.useState<string | null>(null);

  const loadRequisitions = React.useCallback(async () => {
    const t = getClientTenantSubdomain();
    if (!t) return;
    try {
      const res = await fetch('/api/inventory/requisitions?status=pending-director-approval', {
        headers: { 'x-tenant-subdomain': t },
      });
      if (!res.ok) return;
      const data = await res.json();
      setRequisitions(Array.isArray(data?.requisitions) ? data.requisitions : []);
    } catch (e) {
      console.warn('[ExecutiveApprovalsInbox] Failed to load requisitions:', e);
    }
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    const done = (key: keyof typeof ready) => () => {
      if (!cancelled) markReady(key);
    };
    (async () => {
      const first: Promise<void>[] = [];
      if (canApprovePayments) {
        first.push(
          fetchPayments()
            .then((rows) => {
              if (!cancelled && rows) setEarlyPayments(rows);
            })
            .finally(done('payments')),
        );
      } else {
        done('payments')();
      }
      if (canApproveRequisitions) {
        first.push(loadRequisitions().finally(done('requisitions')));
      } else {
        done('requisitions')();
      }
      await Promise.all(first);
      if (cancelled) return;
      // Journals need the full book. Overtime and payroll need the staff file.
      // Neither starts until payments and requisitions have been asked for.
      initializeAccounting().finally(done('accounting'));
      const employeesLoaded = hydrateEmployees();
      Promise.all([hydrateAttendance(), employeesLoaded]).finally(done('overtime'));
      Promise.all([hydratePayroll(), employeesLoaded]).finally(done('payroll'));
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pendingJournalEntries = journalEntries.filter(e => e.status === 'Pending Approval');
  const pendingPayments = (ready.accounting ? payments : earlyPayments ?? []).filter(
    (p) => p.status === 'Pending Approval',
  );
  const pendingOvertime = attendances.filter(
    a => (a.overtimeHours || 0) > 0 && !a.approvedAt && requireOvertimeApproval && (a.overtimeHours || 0) >= overtimeThreshold
  );
  // Whole-month gate (Settings → requireApprovalForPayroll). When off, prepare auto-approves.
  const pendingPayroll = requirePayrollApproval
    ? payrollPeriods.filter((p) => p.status === 'processing' || p.status === 'draft')
      .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
    : [];
  const partnerName = (payment: Payment) =>
    businessPartners.find((bp) => bp.id === payment.businessPartnerId)?.name ||
    payment.customerName ||
    payment.description ||
    payment.businessPartnerId;
  const employeeName = (id: string) => {
    const e = employees.find(emp => emp.id === id);
    return e ? `${e.firstName} ${e.lastName}` : id;
  };
  const requisitionTotal = (r: PendingRequisition) =>
    r.items.reduce((sum, i) => sum + Number(i.totalCost ?? Number(i.quantity) * Number(i.estimatedPrice)), 0);

  const approveJournalEntry = async (id: string) => {
    setActingOn(id);
    try {
      await postJournalEntry(id);
    } finally {
      setActingOn(null);
    }
  };

  const approvePayment = async (id: string) => {
    setActingOn(id);
    try {
      // The list can show before the rest of the books are in. Posting needs them.
      await initializeAccounting();
      await postPayment(id);
    } finally {
      setActingOn(null);
    }
  };

  const approveOvertimeRequest = async (id: string) => {
    setActingOn(id);
    try {
      await approveOvertime(id, approverName);
    } finally {
      setActingOn(null);
    }
  };

  const approvePayrollMonth = async (periodId: string) => {
    setActingOn(periodId);
    try {
      const period = usePayrollStore.getState().payrollPeriods.find((p) => p.id === periodId);
      if (!period) return;
      const ok = await approvePeriod(periodId, approverName);
      if (!ok) {
        window.alert('Could not approve this payroll month.');
        return;
      }
      // Same ledger post as Payment Advice Approve — month is then ready to pay.
      try {
        const records = usePayrollStore.getState().payrollRecords.filter((r) => r.payrollPeriodId === periodId);
        const jeId = `JE-PAYROLL-${periodId}`;
        const entry = readEmployerContribution(period) !== undefined
          ? buildPayrollJournal(period, records)
          : undefined;
        if (entry) addJournalEntry(entry);
        await postJournalEntry(jeId);
      } catch (e) {
        console.warn('[ExecutiveApprovals] Ledger post failed after payroll approval:', e);
        window.alert('Payroll was approved, but posting it to the ledger failed. Please tell accounting.');
      }
    } finally {
      setActingOn(null);
    }
  };

  const openPaymentAdvice = (periodId: string) => {
    try {
      localStorage.setItem('hr.tab', 'payroll');
      localStorage.setItem('payroll.advicePeriodId', periodId);
    } catch {
      /* ignore */
    }
    window.dispatchEvent(new CustomEvent('app.navigate', { detail: { section: 'hr' } }));
    window.dispatchEvent(new Event('hr-navigate'));
    // Panel may already be mounted under HR — fire after a tick so it exists.
    window.setTimeout(() => window.dispatchEvent(new Event('payroll-navigate')), 0);
  };

  const approveRequisition = async (req: PendingRequisition) => {
    const t = getClientTenantSubdomain();
    if (!t) return;
    setActingOn(req.id);
    try {
      const res = await fetch('/api/inventory/requisitions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-tenant-subdomain': t },
        body: JSON.stringify({
          id: req.id,
          status: 'approved',
          items: (req as any).items.map((i: any) => ({
            itemId: i.itemId,
            itemCode: i.itemCode,
            itemName: i.itemName,
            quantity: Number(i.quantity),
            estimatedPrice: Number(i.estimatedPrice),
            notes: i.notes,
          })),
        }),
      });
      if (res.ok) {
        setRequisitions(prev => prev.filter(r => r.id !== req.id));
      } else {
        const data = await res.json().catch(() => null);
        window.alert(data?.error || 'Failed to approve requisition');
      }
    } finally {
      setActingOn(null);
    }
  };

  const priorityReady =
    (!canApprovePayments || ready.payments) && (!canApproveRequisitions || ready.requisitions);
  const restReady = ready.accounting && ready.overtime && ready.payroll;
  const totalPending =
    (ready.payments ? pendingPayments.length : 0) +
    (ready.requisitions ? requisitions.length : 0) +
    (ready.accounting ? pendingJournalEntries.length : 0) +
    (ready.overtime ? pendingOvertime.length : 0) +
    (ready.payroll ? pendingPayroll.length : 0);

  const approveBtnClass = 'min-h-11 shrink-0 sm:min-h-9';

  return (
    <div className="space-y-6 px-3 pt-3 pb-6 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-ghana-black">✅ Approvals</h1>
          <p className="mt-1 text-sm text-gray-600">
            {!priorityReady
              ? 'Checking payments and requisitions…'
              : totalPending === 0 && !restReady
              ? 'No payments or requisitions are waiting. Still checking the other lists.'
              : totalPending === 0
              ? 'Nothing is waiting on your sign-off right now.'
              : `${totalPending} item${totalPending === 1 ? '' : 's'} waiting on director sign-off.`}
          </p>
        </div>
      </div>

      {canApprovePayments && (
        <Card className="border-0 shadow-lg">
          <SectionCardHeader
            title="Payments"
            chipLabel={ready.payments ? `${pendingPayments.length} pending` : 'checking…'}
            chipColor={pendingPayments.length ? 'warning' : 'default'}
          />
          <CardBody>
            {!ready.payments ? (
              <div className="flex items-center gap-2 text-sm text-gray-500"><Spinner size="sm" /> Checking…</div>
            ) : pendingPayments.length === 0 ? (
              <p className="text-sm text-gray-500">No payments pending approval.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table removeWrapper aria-label="Pending payments" className="min-w-[36rem]">
                  <TableHeader>
                    <TableColumn>PAYMENT #</TableColumn>
                    <TableColumn>DATE</TableColumn>
                    <TableColumn>PAYEE</TableColumn>
                    <TableColumn className="text-right">AMOUNT</TableColumn>
                    <TableColumn> </TableColumn>
                  </TableHeader>
                  <TableBody>
                    {pendingPayments.map(p => (
                      <TableRow key={p.id}>
                        <TableCell>{p.paymentNumber}</TableCell>
                        <TableCell>{new Date(p.date).toLocaleDateString()}</TableCell>
                        <TableCell>{partnerName(p)}</TableCell>
                        <TableCell className="text-right">{formatAccountingCurrency(p.amount, p.currency)}</TableCell>
                        <TableCell>
                          <Button size="sm" color="success" variant="flat" className={approveBtnClass} isLoading={actingOn === p.id} onPress={() => approvePayment(p.id)}>
                            Approve &amp; Post
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {canApproveRequisitions && (
        <Card className="border-0 shadow-lg">
          <SectionCardHeader
            title="Requisitions"
            chipLabel={ready.requisitions ? `${requisitions.length} pending` : 'checking…'}
            chipColor={requisitions.length ? 'warning' : 'default'}
          />
          <CardBody>
            {!ready.requisitions ? (
              <div className="flex items-center gap-2 text-sm text-gray-500"><Spinner size="sm" /> Checking…</div>
            ) : requisitions.length === 0 ? (
              <p className="text-sm text-gray-500">No requisitions pending approval.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table removeWrapper aria-label="Pending requisitions" className="min-w-[36rem]">
                  <TableHeader>
                    <TableColumn>REQUISITION #</TableColumn>
                    <TableColumn>DATE</TableColumn>
                    <TableColumn>REQUESTED BY</TableColumn>
                    <TableColumn className="text-right">TOTAL VALUE</TableColumn>
                    <TableColumn> </TableColumn>
                  </TableHeader>
                  <TableBody>
                    {requisitions.map(r => (
                      <TableRow key={r.id}>
                        <TableCell>{r.requisitionNumber}</TableCell>
                        <TableCell>{new Date(r.requestedDate).toLocaleDateString()}</TableCell>
                        <TableCell>{r.requestedBy}{r.department ? ` (${r.department})` : ''}</TableCell>
                        <TableCell className="text-right">{formatAccountingCurrency(requisitionTotal(r))}</TableCell>
                        <TableCell>
                          <Button size="sm" color="success" variant="flat" className={approveBtnClass} isLoading={actingOn === r.id} onPress={() => approveRequisition(r)}>
                            Approve
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {canApproveJournalEntries && (
        <Card className="border-0 shadow-lg">
          <SectionCardHeader
            title="Journal Entries"
            chipLabel={ready.accounting ? `${pendingJournalEntries.length} pending` : 'checking…'}
            chipColor={pendingJournalEntries.length ? 'warning' : 'default'}
          />
          <CardBody>
            {!ready.accounting ? (
              <div className="flex items-center gap-2 text-sm text-gray-500"><Spinner size="sm" /> Checking…</div>
            ) : pendingJournalEntries.length === 0 ? (
              <p className="text-sm text-gray-500">No journal entries pending approval.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table removeWrapper aria-label="Pending journal entries" className="min-w-[36rem]">
                  <TableHeader>
                    <TableColumn>ENTRY #</TableColumn>
                    <TableColumn>DATE</TableColumn>
                    <TableColumn>DESCRIPTION</TableColumn>
                    <TableColumn className="text-right">AMOUNT</TableColumn>
                    <TableColumn> </TableColumn>
                  </TableHeader>
                  <TableBody>
                    {pendingJournalEntries.map(e => (
                      <TableRow key={e.id}>
                        <TableCell>{e.entryNumber}</TableCell>
                        <TableCell>{new Date(e.date).toLocaleDateString()}</TableCell>
                        <TableCell>{e.description}</TableCell>
                        <TableCell className="text-right">{formatAccountingCurrency(e.totalDebit, e.currency)}</TableCell>
                        <TableCell>
                          <Button size="sm" color="success" variant="flat" className={approveBtnClass} isLoading={actingOn === e.id} onPress={() => approveJournalEntry(e.id)}>
                            Approve &amp; Post
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {canApproveOvertime && (
        <Card className="border-0 shadow-lg">
          <SectionCardHeader
            title="Overtime"
            chipLabel={ready.overtime ? `${pendingOvertime.length} pending` : 'checking…'}
            chipColor={pendingOvertime.length ? 'warning' : 'default'}
          />
          <CardBody>
            {!ready.overtime ? (
              <div className="flex items-center gap-2 text-sm text-gray-500"><Spinner size="sm" /> Checking…</div>
            ) : pendingOvertime.length === 0 ? (
              <p className="text-sm text-gray-500">No overtime requests pending approval.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table removeWrapper aria-label="Pending overtime" className="min-w-[28rem]">
                  <TableHeader>
                    <TableColumn>EMPLOYEE</TableColumn>
                    <TableColumn>DATE</TableColumn>
                    <TableColumn className="text-right">HOURS</TableColumn>
                    <TableColumn> </TableColumn>
                  </TableHeader>
                  <TableBody>
                    {pendingOvertime.map(a => (
                      <TableRow key={a.id}>
                        <TableCell>{employeeName(a.employeeId)}</TableCell>
                        <TableCell>{new Date(a.date).toLocaleDateString()}</TableCell>
                        <TableCell className="text-right">{(a.overtimeHours || 0).toFixed(2)}</TableCell>
                        <TableCell>
                          <Button size="sm" color="success" variant="flat" className={approveBtnClass} isLoading={actingOn === a.id} onPress={() => approveOvertimeRequest(a.id)}>
                            Approve
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {canApprovePayroll && requirePayrollApproval && (
        <Card className="border-0 shadow-lg">
          <SectionCardHeader
            title="Payroll"
            chipLabel={ready.payroll ? `${pendingPayroll.length} pending` : 'checking…'}
            chipColor={pendingPayroll.length ? 'warning' : 'default'}
          />
          <CardBody>
            {!ready.payroll ? (
              <div className="flex items-center gap-2 text-sm text-gray-500"><Spinner size="sm" /> Checking…</div>
            ) : pendingPayroll.length === 0 ? (
              <p className="text-sm text-gray-500">No payroll months pending approval.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table removeWrapper aria-label="Pending payroll" selectionMode="none" className="min-w-[40rem]">
                  <TableHeader>
                    <TableColumn>MONTH</TableColumn>
                    <TableColumn>PREPARED BY</TableColumn>
                    <TableColumn className="text-right">STAFF</TableColumn>
                    <TableColumn className="text-right">NET PAY</TableColumn>
                    <TableColumn> </TableColumn>
                  </TableHeader>
                  <TableBody>
                    {pendingPayroll.map((p) => {
                      const staffCount = payrollRecords.filter((r) => r.payrollPeriodId === p.id && r.status !== 'failed').length;
                      return (
                        <TableRow
                          key={p.id}
                          className="cursor-pointer hover:bg-gray-50"
                          onClick={() => openPaymentAdvice(p.id)}
                        >
                          <TableCell>
                            <span className="font-medium text-ghana-black">{periodMonthLabel(p.periodNumber, p.startDate)}</span>
                            <span className="block text-xs text-gray-500">Open Payment Advice</span>
                          </TableCell>
                          <TableCell>{p.processedBy || '—'}</TableCell>
                          <TableCell className="text-right">{staffCount || p.employeeCount || '—'}</TableCell>
                          <TableCell className="text-right">{formatAccountingCurrency(p.totalNetPay || 0)}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-2 justify-end" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()} role="presentation">
                              <Button size="sm" variant="flat" className={approveBtnClass} onPress={() => openPaymentAdvice(p.id)}>
                                View advice
                              </Button>
                              <Button size="sm" color="success" variant="flat" className={approveBtnClass} isLoading={actingOn === p.id} onPress={() => approvePayrollMonth(p.id)}>
                                Approve
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
            <p className="mt-2 text-xs text-gray-500">
              Click a month (or View advice) to open the payee / channel summary. Approve here or on Payment Advice — then pay from Advice.
            </p>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
