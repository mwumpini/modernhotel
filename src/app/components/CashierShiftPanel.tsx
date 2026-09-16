'use client';

import React from 'react';
import { Card, CardBody, CardHeader, Button, Input, Textarea, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, Chip, Divider } from '@heroui/react';
import { useSession } from 'next-auth/react';
import { useCashierShift } from '../lib/frontoffice/useCashierShift';
import { printSimpleReport } from '../lib/print/simpleReport';

function money(n?: number) {
  return `₵${(n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function CashierShiftPanel() {
  const { data: session } = useSession();
  const currentUserId = (session?.user as any)?.id as string | undefined;
  const { shifts, myOpenShift, loading, openShift, closeShift } = useCashierShift(currentUserId);

  const [openingFloat, setOpeningFloat] = React.useState('');
  const [openNotes, setOpenNotes] = React.useState('');
  const [opening, setOpening] = React.useState(false);
  const [openError, setOpenError] = React.useState<string | null>(null);

  const [closingCount, setClosingCount] = React.useState('');
  const [closeNotes, setCloseNotes] = React.useState('');
  const [closing, setClosing] = React.useState(false);
  const [closeError, setCloseError] = React.useState<string | null>(null);
  const [lastClosed, setLastClosed] = React.useState<typeof shifts[number] | null>(null);

  const handleOpen = async () => {
    const val = parseFloat(openingFloat);
    if (isNaN(val) || val < 0) { setOpenError('Enter a valid opening float.'); return; }
    setOpening(true);
    setOpenError(null);
    const result = await openShift(val, openNotes || undefined);
    setOpening(false);
    if (!result.ok) { setOpenError(result.error || 'Failed to open shift.'); return; }
    setOpeningFloat('');
    setOpenNotes('');
  };

  const handleClose = async () => {
    if (!myOpenShift) return;
    const val = parseFloat(closingCount);
    if (isNaN(val) || val < 0) { setCloseError('Enter a valid closing count.'); return; }
    setClosing(true);
    setCloseError(null);
    const result = await closeShift(myOpenShift.id, val, closeNotes || undefined);
    setClosing(false);
    if (!result.ok) { setCloseError(result.error || 'Failed to close shift.'); return; }
    setClosingCount('');
    setCloseNotes('');
    if (result.shift) setLastClosed(result.shift);
  };

  const printHistory = () => {
    printSimpleReport(
      'Cashier Shifts — History',
      `${shifts.length} shift${shifts.length === 1 ? '' : 's'}`,
      ['Cashier', 'Opened', 'Closed', 'Opening Float', 'Closing Count', 'Expected Cash', 'Variance', 'Status'],
      shifts.map((s) => [
        s.cashierName,
        new Date(s.openedAt).toLocaleString(),
        s.closedAt ? new Date(s.closedAt).toLocaleString() : '—',
        money(s.openingFloat),
        s.closingCount != null ? money(s.closingCount) : '—',
        s.expectedCash != null ? money(s.expectedCash) : '—',
        s.variance != null ? money(s.variance) : '—',
        s.status,
      ])
    );
  };

  return (
    <div className="p-6 space-y-4">
      {!myOpenShift ? (
        <Card>
          <CardHeader className="font-medium">Open a Cashier Shift</CardHeader>
          <CardBody className="space-y-3">
            <p className="text-sm text-gray-500">
              Declare the cash you're starting your shift with. Payments you record from here on are
              attributed to you and reconciled against this float when you close.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input label="Opening Float (₵)" type="number" value={openingFloat} onChange={(e) => setOpeningFloat(e.target.value)} variant="bordered" />
              <Input label="Notes (optional)" value={openNotes} onChange={(e) => setOpenNotes(e.target.value)} variant="bordered" />
            </div>
            {openError && <p className="text-sm text-danger">{openError}</p>}
            <Button color="primary" isLoading={opening} isDisabled={!openingFloat} onPress={handleOpen}>
              Open Shift
            </Button>
          </CardBody>
        </Card>
      ) : (
        <Card>
          <CardHeader className="font-medium">Shift In Progress — {myOpenShift.cashierName}</CardHeader>
          <CardBody className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-gray-500">Opened</p>
                <p className="font-medium">{new Date(myOpenShift.openedAt).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-gray-500">Opening Float</p>
                <p className="font-medium">{money(myOpenShift.openingFloat)}</p>
              </div>
            </div>
            <Divider />
            <p className="text-sm text-gray-500">
              Count the cash on hand now and enter it below to close this shift. The system will compute
              what you should have (opening float + cash payments recorded under your name since you
              opened) and flag any variance.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input label="Closing Count (₵)" type="number" value={closingCount} onChange={(e) => setClosingCount(e.target.value)} variant="bordered" />
              <Input label="Notes (optional)" value={closeNotes} onChange={(e) => setCloseNotes(e.target.value)} variant="bordered" />
            </div>
            {closeError && <p className="text-sm text-danger">{closeError}</p>}
            <Button color="primary" isLoading={closing} isDisabled={!closingCount} onPress={handleClose}>
              Close &amp; Reconcile
            </Button>
          </CardBody>
        </Card>
      )}

      {lastClosed && (
        <Card className="border-2 border-primary">
          <CardHeader className="font-medium">Shift Closed — Reconciliation</CardHeader>
          <CardBody>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div><p className="text-gray-500">Cash Collected</p><p className="font-medium">{money(lastClosed.totalCash)}</p></div>
              <div><p className="text-gray-500">Expected Cash</p><p className="font-medium">{money(lastClosed.expectedCash)}</p></div>
              <div><p className="text-gray-500">Counted</p><p className="font-medium">{money(lastClosed.closingCount)}</p></div>
              <div>
                <p className="text-gray-500">Variance</p>
                <p className={`font-medium ${(lastClosed.variance || 0) === 0 ? 'text-success' : 'text-danger'}`}>
                  {(lastClosed.variance || 0) > 0 ? '+' : ''}{money(lastClosed.variance)}
                </p>
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader className="flex items-center justify-between">
          <div className="font-medium">Shift History</div>
          <Button size="sm" color="primary" variant="flat" onPress={printHistory}>🖨️ Print</Button>
        </CardHeader>
        <CardBody>
          <Table aria-label="Cashier shift history">
            <TableHeader>
              <TableColumn>CASHIER</TableColumn>
              <TableColumn>OPENED</TableColumn>
              <TableColumn>CLOSED</TableColumn>
              <TableColumn>FLOAT</TableColumn>
              <TableColumn>EXPECTED</TableColumn>
              <TableColumn>COUNTED</TableColumn>
              <TableColumn>VARIANCE</TableColumn>
              <TableColumn>STATUS</TableColumn>
            </TableHeader>
            <TableBody emptyContent={loading ? 'Loading…' : 'No cashier shifts yet.'}>
              {shifts.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>{s.cashierName}</TableCell>
                  <TableCell>{new Date(s.openedAt).toLocaleString()}</TableCell>
                  <TableCell>{s.closedAt ? new Date(s.closedAt).toLocaleString() : '—'}</TableCell>
                  <TableCell>{money(s.openingFloat)}</TableCell>
                  <TableCell>{s.expectedCash != null ? money(s.expectedCash) : '—'}</TableCell>
                  <TableCell>{s.closingCount != null ? money(s.closingCount) : '—'}</TableCell>
                  <TableCell>
                    {s.variance != null ? (
                      <span className={s.variance === 0 ? 'text-success' : 'text-danger'}>
                        {s.variance > 0 ? '+' : ''}{money(s.variance)}
                      </span>
                    ) : '—'}
                  </TableCell>
                  <TableCell>
                    <Chip size="sm" variant="flat" color={s.status === 'open' ? 'warning' : 'default'}>{s.status}</Chip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardBody>
      </Card>
    </div>
  );
}
