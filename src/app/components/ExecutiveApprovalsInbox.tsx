'use client';

import React from 'react';
import { Card, CardHeader, CardBody, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, Button, Chip, Spinner } from '@heroui/react';
import { useAccountingStore } from '../lib/accounting/store';
import { useSettingsStore } from '../lib/settings/store';
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

/**
 * Director/GM approval inbox — journal entries, payments, and requisitions
 * the tenant's configured thresholds parked for sign-off (see
 * src/app/lib/api/approvalThresholds.ts). Gated in Navigation.tsx so only
 * someone holding at least one of the three approve permissions ever
 * reaches this screen; each section below still re-checks its own
 * permission independently in case a role only has one of the three.
 */
export default function ExecutiveApprovalsInbox() {
  const {
    journalEntries,
    payments,
    businessPartners,
    initializeAccounting,
    postJournalEntry,
    postPayment,
  } = useAccountingStore();
  const hasPermission = useSettingsStore(s => s.hasPermission);
  const canApproveJournalEntries = hasPermission('accounting.approve-journal-entry');
  const canApprovePayments = hasPermission('accounting.approve-payment');
  const canApproveRequisitions = hasPermission('inventory.approve-high-value-requisition');

  const [loading, setLoading] = React.useState(true);
  const [requisitions, setRequisitions] = React.useState<PendingRequisition[]>([]);
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
    (async () => {
      setLoading(true);
      await Promise.all([initializeAccounting(), loadRequisitions()]);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pendingJournalEntries = journalEntries.filter(e => e.status === 'Pending Approval');
  const pendingPayments = payments.filter(p => p.status === 'Pending Approval');
  const partnerName = (id: string) => businessPartners.find(bp => bp.id === id)?.name || id;
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
      await postPayment(id);
    } finally {
      setActingOn(null);
    }
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

  if (loading) {
    return <div className="p-6 flex justify-center"><Spinner size="lg" /></div>;
  }

  const totalPending = pendingJournalEntries.length + pendingPayments.length + requisitions.length;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ghana-black">✅ Approvals</h1>
        <p className="text-sm text-gray-600 mt-1">
          {totalPending === 0
            ? 'Nothing is waiting on your sign-off right now.'
            : `${totalPending} item${totalPending === 1 ? '' : 's'} waiting on director sign-off.`}
        </p>
      </div>

      {canApproveJournalEntries && (
        <Card className="border-0 shadow-lg">
          <CardHeader className="flex items-center justify-between">
            <h3 className="font-semibold">Journal Entries</h3>
            <Chip size="sm" variant="flat" color={pendingJournalEntries.length ? 'warning' : 'default'}>
              {pendingJournalEntries.length} pending
            </Chip>
          </CardHeader>
          <CardBody>
            {pendingJournalEntries.length === 0 ? (
              <p className="text-sm text-gray-500">No journal entries pending approval.</p>
            ) : (
              <Table removeWrapper aria-label="Pending journal entries">
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
                        <Button size="sm" color="success" variant="flat" isLoading={actingOn === e.id} onPress={() => approveJournalEntry(e.id)}>
                          Approve &amp; Post
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardBody>
        </Card>
      )}

      {canApprovePayments && (
        <Card className="border-0 shadow-lg">
          <CardHeader className="flex items-center justify-between">
            <h3 className="font-semibold">Payments</h3>
            <Chip size="sm" variant="flat" color={pendingPayments.length ? 'warning' : 'default'}>
              {pendingPayments.length} pending
            </Chip>
          </CardHeader>
          <CardBody>
            {pendingPayments.length === 0 ? (
              <p className="text-sm text-gray-500">No payments pending approval.</p>
            ) : (
              <Table removeWrapper aria-label="Pending payments">
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
                      <TableCell>{partnerName(p.businessPartnerId)}</TableCell>
                      <TableCell className="text-right">{formatAccountingCurrency(p.amount, p.currency)}</TableCell>
                      <TableCell>
                        <Button size="sm" color="success" variant="flat" isLoading={actingOn === p.id} onPress={() => approvePayment(p.id)}>
                          Approve &amp; Post
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardBody>
        </Card>
      )}

      {canApproveRequisitions && (
        <Card className="border-0 shadow-lg">
          <CardHeader className="flex items-center justify-between">
            <h3 className="font-semibold">Requisitions</h3>
            <Chip size="sm" variant="flat" color={requisitions.length ? 'warning' : 'default'}>
              {requisitions.length} pending
            </Chip>
          </CardHeader>
          <CardBody>
            {requisitions.length === 0 ? (
              <p className="text-sm text-gray-500">No requisitions pending approval.</p>
            ) : (
              <Table removeWrapper aria-label="Pending requisitions">
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
                        <Button size="sm" color="success" variant="flat" isLoading={actingOn === r.id} onPress={() => approveRequisition(r)}>
                          Approve
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardBody>
        </Card>
      )}
    </div>
  );
}
