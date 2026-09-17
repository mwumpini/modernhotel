'use client';

import React from 'react';
import {
  Card,
  CardBody,
  CardHeader,
  Button,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Chip,
  Divider,
  Select,
  SelectItem,
  Input,
} from '@heroui/react';
import { frontOfficeStore } from '../lib/frontoffice/store';
import { useNightAuditLog } from '../lib/frontoffice/useNightAuditLog';
import { checkNightAuditDiscrepancies, computeDailyRevenue } from '../lib/frontoffice/nightAuditChecks';
import type { NightAuditRun } from '../lib/frontoffice/nightAudit';

function money(n: number) {
  return `₵${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function FrontofficeNightAudit() {
  const [tick, setTick] = React.useState(0);
  const [lastRun, setLastRun] = React.useState<NightAuditRun | null>(null);
  const [running, setRunning] = React.useState(false);
  // Only recordManualRun is used here — the run history itself now lives in
  // Reports & Analysis (Financial & Auditing → Night Audit History), which
  // reads from the same server log this writes to.
  const { recordManualRun } = useNightAuditLog();

  // Starts null (matching SSR, which has no client-persisted state to read) and
  // is only ever set from an effect, so the businessDate this component paints
  // on its first render can never diverge from the server-rendered HTML —
  // regardless of whether some unrelated store elsewhere has already loaded a
  // persisted value into frontOfficeStore by the time this component hydrates.
  const [businessDate, setBusinessDate] = React.useState<string | null>(null);
  const [lastNightAuditAt, setLastNightAuditAt] = React.useState<string | undefined>(undefined);

  React.useEffect(() => {
    const sync = () => {
      setBusinessDate(frontOfficeStore.getBusinessDate());
      setLastNightAuditAt(frontOfficeStore.lastNightAuditAt);
    };
    sync();
    const u1 = frontOfficeStore.subscribe(() => { setTick((t) => t + 1); sync(); });
    return () => {
      u1();
    };
  }, []);

  void tick;

  const inHouse = frontOfficeStore.reservations.filter((r) => r.status === 'checked-in');
  const expectedArrivals = businessDate
    ? frontOfficeStore.reservations.filter(
        (r) =>
          r.arrival.slice(0, 10) === businessDate &&
          (r.status === 'confirmed' || r.status === 'pending'),
      )
    : [];
  const discrepancies = businessDate ? checkNightAuditDiscrepancies(frontOfficeStore as any, businessDate) : [];
  const revenue = businessDate ? computeDailyRevenue(frontOfficeStore as any, businessDate) : null;

  const [wakeUpReservationId, setWakeUpReservationId] = React.useState('');
  const [wakeUpTime, setWakeUpTime] = React.useState('06:00');
  const [wakeUpNotes, setWakeUpNotes] = React.useState('');
  const todaysWakeUpCalls = businessDate ? frontOfficeStore.wakeUpCalls.filter((c) => c.date === businessDate) : [];

  const scheduleWakeUpCall = () => {
    if (!wakeUpReservationId || !businessDate) return;
    frontOfficeStore.scheduleWakeUpCall(wakeUpReservationId, businessDate, wakeUpTime, wakeUpNotes || undefined);
    setWakeUpReservationId('');
    setWakeUpNotes('');
  };

  const runAudit = () => {
    setRunning(true);
    try {
      const result = frontOfficeStore.executeNightAudit();
      setLastRun(result);
      void recordManualRun({
        businessDate: result.businessDate,
        roomChargesPosted: result.roomChargesPosted,
        noShowsMarked: result.noShowsProcessed,
        status: result.status,
        errors: result.error ? [result.error] : undefined,
      });
    } finally {
      setRunning(false);
    }
  };

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader className="pb-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-ghana-black">Night Audit</h3>
          <p className="text-xs text-gray-500 mt-1">
            Business date: <strong>{businessDate ?? '…'}</strong>
            {lastNightAuditAt && (
              <> · Last run: {new Date(lastNightAuditAt).toLocaleString()}</>
            )}
            {' '}· Auto-runs nightly at 1:00am
          </p>
        </div>
        <Button
          className="bg-ghana-green text-white"
          variant="flat"
          size="sm"
          isLoading={running}
          onPress={runAudit}
        >
          Run Night Audit
        </Button>
      </CardHeader>
      <CardBody className="space-y-6">
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg bg-blue-50 p-3 border border-blue-100">
            <div className="text-xs text-blue-700">In-house</div>
            <div className="text-xl font-bold text-blue-900">{inHouse.length}</div>
          </div>
          <div className="rounded-lg bg-amber-50 p-3 border border-amber-100">
            <div className="text-xs text-amber-700">Expected arrivals (no-show candidates)</div>
            <div className="text-xl font-bold text-amber-900">{expectedArrivals.length}</div>
          </div>
          <div className={`rounded-lg p-3 border ${discrepancies.length > 0 ? 'bg-red-50 border-red-100' : 'bg-gray-50 border-gray-200'}`}>
            <div className={`text-xs ${discrepancies.length > 0 ? 'text-red-700' : 'text-gray-500'}`}>Discrepancies</div>
            <div className={`text-xl font-bold ${discrepancies.length > 0 ? 'text-red-900' : 'text-gray-700'}`}>{discrepancies.length}</div>
          </div>
        </div>

        {discrepancies.length > 0 && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <h4 className="text-sm font-semibold text-red-800 mb-2">Rate &amp; discrepancy checks — fix before running</h4>
            <ul className="text-sm text-red-800 space-y-1">
              {discrepancies.map((d, i) => (
                <li key={`${d.reservationId}-${i}`}>
                  <span className="font-medium">{d.guestName}</span>
                  {d.roomId && <span> — Room {d.roomId}</span>}: {d.message}
                </li>
              ))}
            </ul>
          </div>
        )}

        {lastRun && (
          <div className="rounded-lg border border-gray-200 p-4 bg-gray-50">
            <h4 className="text-sm font-semibold mb-2">Last run — closed {lastRun.businessDate}</h4>
            <div className="flex flex-wrap gap-2 text-sm">
              <Chip size="sm" color={lastRun.status === 'completed' ? 'success' : 'danger'} variant="flat">
                {lastRun.status}
              </Chip>
              <Chip size="sm" variant="flat">{lastRun.roomChargesPosted} room charge(s)</Chip>
              <Chip size="sm" variant="flat">{lastRun.noShowsProcessed} no-show(s)</Chip>
              <Chip size="sm" variant="flat">Folio charges ₵{lastRun.folioChargesTotal.toLocaleString()}</Chip>
              <Chip size="sm" variant="flat">Payments ₵{lastRun.folioPaymentsTotal.toLocaleString()}</Chip>
            </div>
            {lastRun.error && <p className="text-xs text-red-600 mt-2">{lastRun.error}</p>}
          </div>
        )}

        <Divider />

        <div>
          <h4 className="text-sm font-semibold text-ghana-black mb-2">Daily Revenue — {businessDate ?? '…'}</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-lg bg-gray-50 p-3 border border-gray-200">
              <div className="text-xs text-gray-500">Room Charges</div>
              <div className="text-lg font-semibold text-ghana-black">{money(revenue?.roomCharges ?? 0)}</div>
            </div>
            <div className="rounded-lg bg-gray-50 p-3 border border-gray-200">
              <div className="text-xs text-gray-500">Other Charges</div>
              <div className="text-lg font-semibold text-ghana-black">{money(revenue?.otherCharges ?? 0)}</div>
            </div>
            <div className="rounded-lg bg-gray-50 p-3 border border-gray-200">
              <div className="text-xs text-gray-500">Tax</div>
              <div className="text-lg font-semibold text-ghana-black">{money(revenue?.taxTotal ?? 0)}</div>
            </div>
            <div className="rounded-lg bg-green-50 p-3 border border-green-100">
              <div className="text-xs text-green-700">Total Charges</div>
              <div className="text-lg font-semibold text-green-900">{money(revenue?.totalCharges ?? 0)}</div>
            </div>
            <div className="rounded-lg bg-gray-50 p-3 border border-gray-200">
              <div className="text-xs text-gray-500">Cash</div>
              <div className="text-lg font-semibold text-ghana-black">{money(revenue?.paymentsByMethod.cash ?? 0)}</div>
            </div>
            <div className="rounded-lg bg-gray-50 p-3 border border-gray-200">
              <div className="text-xs text-gray-500">Card</div>
              <div className="text-lg font-semibold text-ghana-black">{money(revenue?.paymentsByMethod.card ?? 0)}</div>
            </div>
            <div className="rounded-lg bg-gray-50 p-3 border border-gray-200">
              <div className="text-xs text-gray-500">Mobile Money</div>
              <div className="text-lg font-semibold text-ghana-black">{money(revenue?.paymentsByMethod.mobileMoney ?? 0)}</div>
            </div>
            <div className="rounded-lg bg-blue-50 p-3 border border-blue-100">
              <div className="text-xs text-blue-700">Total Payments</div>
              <div className="text-lg font-semibold text-blue-900">{money(revenue?.totalPayments ?? 0)}</div>
            </div>
          </div>
        </div>

        <Divider />

        <div>
          <h4 className="text-sm font-semibold text-ghana-black mb-2">Checked-in reservations</h4>
          <Table aria-label="Checked-in">
            <TableHeader>
              <TableColumn>Reservation</TableColumn>
              <TableColumn>Guest</TableColumn>
              <TableColumn>Room type</TableColumn>
            </TableHeader>
            <TableBody emptyContent="No in-house guests">
              {inHouse.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.id}</TableCell>
                  <TableCell>{r.guestName}</TableCell>
                  <TableCell>{frontOfficeStore.roomTypes.find((rt) => rt.id === r.roomTypeId)?.name}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <Divider />

        <div>
          <h4 className="text-sm font-semibold text-ghana-black mb-2">Wake-up calls — {businessDate ?? '…'}</h4>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-3">
            <Select
              label="Guest"
              placeholder="Select in-house guest"
              selectedKeys={wakeUpReservationId ? [wakeUpReservationId] : []}
              onSelectionChange={(k) => setWakeUpReservationId(Array.from(k as Set<string>)[0] || '')}
            >
              {inHouse.map((r) => (
                <SelectItem key={r.id}>{`${r.guestName} — Room ${r.roomId || 'TBD'}`}</SelectItem>
              ))}
            </Select>
            <Input type="time" label="Time" value={wakeUpTime} onChange={(e) => setWakeUpTime(e.target.value)} />
            <Input label="Notes" placeholder="e.g. Early flight" value={wakeUpNotes} onChange={(e) => setWakeUpNotes(e.target.value)} />
            <div className="flex items-end">
              <Button className="bg-ghana-green text-white w-full" variant="flat" onPress={scheduleWakeUpCall} isDisabled={!wakeUpReservationId}>
                Schedule
              </Button>
            </div>
          </div>
          <Table aria-label="Wake-up calls">
            <TableHeader>
              <TableColumn>Guest</TableColumn>
              <TableColumn>Room</TableColumn>
              <TableColumn>Time</TableColumn>
              <TableColumn>Notes</TableColumn>
              <TableColumn>Status</TableColumn>
              <TableColumn>Actions</TableColumn>
            </TableHeader>
            <TableBody emptyContent="No wake-up calls scheduled">
              {todaysWakeUpCalls.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>{c.guestName}</TableCell>
                  <TableCell>{c.roomNumber}</TableCell>
                  <TableCell>{c.time}</TableCell>
                  <TableCell className="max-w-[160px] truncate">{c.notes || '—'}</TableCell>
                  <TableCell>
                    <Chip size="sm" variant="flat" color={c.status === 'completed' ? 'success' : c.status === 'cancelled' ? 'default' : 'warning'}>
                      {c.status}
                    </Chip>
                  </TableCell>
                  <TableCell>
                    {c.status === 'scheduled' && (
                      <div className="flex gap-2">
                        <Button size="sm" variant="flat" color="success" onPress={() => frontOfficeStore.completeWakeUpCall(c.id)}>Done</Button>
                        <Button size="sm" variant="flat" onPress={() => frontOfficeStore.cancelWakeUpCall(c.id)}>Cancel</Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <p className="text-xs text-gray-500">
          Running closes {businessDate ?? 'today'}: posts room charges, processes no-shows, then opens the next day. Full run history is in Reports &amp; Analysis → Financial &amp; Auditing → Night Audit History.
        </p>
      </CardBody>
    </Card>
  );
}
