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
} from '@heroui/react';
import { frontOfficeStore } from '../lib/frontoffice/store';
import { useAccountingStore } from '../lib/accounting/store';
import { useSettingsStore } from '../lib/settings/store';
import type { NightAuditRun } from '../lib/frontoffice/nightAudit';

export default function FrontofficeNightAudit() {
  const journalEntries = useAccountingStore((s) => s.journalEntries);
  const [tick, setTick] = React.useState(0);
  const [lastRun, setLastRun] = React.useState<NightAuditRun | null>(null);
  const [running, setRunning] = React.useState(false);

  React.useEffect(() => {
    const u1 = frontOfficeStore.subscribe(() => setTick((t) => t + 1));
    return () => {
      u1();
    };
  }, []);

  void tick;

  const postFirstNightAtCheckin = useSettingsStore((s) => s.roomManagement.postFirstNightAtCheckin);
  const nightAuditAutoRun = useSettingsStore((s) => s.roomManagement.nightAuditAutoRun !== false);

  const businessDate = frontOfficeStore.getBusinessDate();
  const inHouse = frontOfficeStore.reservations.filter((r) => r.status === 'checked-in');
  const expectedArrivals = frontOfficeStore.reservations.filter(
    (r) =>
      r.arrival.slice(0, 10) === businessDate &&
      (r.status === 'confirmed' || r.status === 'pending'),
  );

  const runAudit = () => {
    setRunning(true);
    try {
      const result = frontOfficeStore.executeNightAudit();
      setLastRun(result);
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
            Business date: <strong>{businessDate}</strong>
            {frontOfficeStore.lastNightAuditAt && (
              <> · Last run: {new Date(frontOfficeStore.lastNightAuditAt).toLocaleString()}</>
            )}
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
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          <div className="rounded-lg bg-blue-50 p-3 border border-blue-100">
            <div className="text-xs text-blue-700">In-house</div>
            <div className="text-xl font-bold text-blue-900">{inHouse.length}</div>
          </div>
          <div className="rounded-lg bg-amber-50 p-3 border border-amber-100">
            <div className="text-xs text-amber-700">Expected arrivals (no-show candidates)</div>
            <div className="text-xl font-bold text-amber-900">{expectedArrivals.length}</div>
          </div>
          <div className="rounded-lg bg-green-50 p-3 border border-green-100">
            <div className="text-xs text-green-700">First night at check-in</div>
            <div className="text-sm font-semibold text-green-900">
              {postFirstNightAtCheckin ? 'Enabled' : 'Night audit only'}
            </div>
          </div>
          <div className="rounded-lg bg-indigo-50 p-3 border border-indigo-100">
            <div className="text-xs text-indigo-700">Auto-run 1:00am</div>
            <div className="text-sm font-semibold text-indigo-900">{nightAuditAutoRun ? 'On' : 'Off'}</div>
          </div>
          <div className="rounded-lg bg-purple-50 p-3 border border-purple-100">
            <div className="text-xs text-purple-700">GL recognition</div>
            <div className="text-sm font-semibold text-purple-900">At checkout</div>
          </div>
        </div>

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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
          <div>
            <h4 className="text-sm font-semibold text-ghana-black mb-2">Recent GL journal entries</h4>
            <p className="text-xs text-gray-500 mb-2">
              Room nights post to the guest folio at night audit. Revenue and cash hit the ledger at guest checkout
              (no-show penalties post directly).
            </p>
            <Table aria-label="Journals">
              <TableHeader>
                <TableColumn>Date</TableColumn>
                <TableColumn>Description</TableColumn>
                <TableColumn>Source</TableColumn>
              </TableHeader>
              <TableBody emptyContent="No journal entries">
                {journalEntries.slice(0, 10).map((j) => (
                  <TableRow key={j.id}>
                    <TableCell>{new Date(j.date).toLocaleString()}</TableCell>
                    <TableCell className="max-w-[180px] truncate">{j.description}</TableCell>
                    <TableCell className="text-xs">{j.sourceModule || '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        <div className="text-xs text-gray-500 space-y-1">
          <p><strong>Night audit steps:</strong> roll business date → post room charges → process no-shows → reconcile folio activity → open new day.</p>
          <p>Check-in posts the first night only when enabled in Settings → Operational Policies. Subsequent nights post here (idempotent).</p>
        </div>
      </CardBody>
    </Card>
  );
}
