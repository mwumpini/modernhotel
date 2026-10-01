'use client';

import React from 'react';
import {
  Button,
  Card,
  CardBody,
  Chip,
  Input,
  Select,
  SelectItem,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from '@heroui/react';
import { frontOfficeStore } from '../lib/frontoffice/store';
import { useHostSummaryCollapsed } from '../lib/dashboard/useSummaryCollapsed';
import { getClientTenantSubdomain } from '../lib/api/clientTenant';
import { useNightAuditLog } from '../lib/frontoffice/useNightAuditLog';
import { checkNightAuditDiscrepancies, computeDailyRevenue } from '../lib/frontoffice/nightAuditChecks';
import type { NightAuditRun } from '../lib/frontoffice/nightAudit';
import { findMainFolio } from '../lib/frontoffice/helpers/folio';
import { isPostedRoomCharge } from '../lib/frontoffice/folioLedger';
import { resolveRateForDate } from '../lib/frontoffice/roomCharges';
import { useSettingsStore } from '../lib/settings/store';
import { dayOf, money, shortDay } from '../lib/frontoffice/stayWorksheet';
import { getZonedClockParts } from '../lib/frontoffice/propertyTime';
import { resolvePropertyTimezone } from '../lib/frontoffice/propertyTimeClient';
import { worksheetTableClassNames } from './frontoffice/StayWorksheetTable';
import type { Reservation } from '../lib/frontoffice/types';

type Tonight = { label: string; color: 'success' | 'warning' | 'danger' | 'primary' | 'default' };

function tonightPlan(stay: Reservation, businessDate: string): Tonight {
  const arrival = dayOf(stay.arrival);
  const departure = dayOf(stay.departure);
  if (!stay.roomId || stay.roomId === 'TBD') return { label: 'No room', color: 'warning' };
  if (departure < businessDate) return { label: 'Past departure', color: 'danger' };
  if (businessDate < arrival || businessDate >= departure) return { label: 'Not tonight', color: 'default' };
  if (resolveRateForDate(frontOfficeStore as any, stay, businessDate) <= 0) return { label: 'No rate', color: 'warning' };
  const folio = findMainFolio(frontOfficeStore.folios, stay.id);
  const posted = (folio?.charges || []).some(
    (charge) => isPostedRoomCharge(charge) && dayOf(charge.date) === businessDate,
  );
  return posted ? { label: 'Posted', color: 'success' } : { label: 'Will post', color: 'primary' };
}

export default function FrontofficeNightAudit() {
  const summaryCollapsed = useHostSummaryCollapsed();
  const [tick, setTick] = React.useState(0);
  const [lastRun, setLastRun] = React.useState<NightAuditRun | null>(null);
  const [running, setRunning] = React.useState(false);
  const { refresh } = useNightAuditLog();
  const canRun = useSettingsStore((s) => s.hasPermission('frontdesk.night-audit'));

  const [businessDate, setBusinessDate] = React.useState<string | null>(null);
  const [lastNightAuditAt, setLastNightAuditAt] = React.useState<string | undefined>(undefined);

  React.useEffect(() => {
    const sync = () => {
      setBusinessDate(frontOfficeStore.getBusinessDate());
      setLastNightAuditAt(frontOfficeStore.lastNightAuditAt);
    };
    sync();
    const unsubscribe = frontOfficeStore.subscribe(() => { setTick((t) => t + 1); sync(); });
    return () => { unsubscribe(); };
  }, []);

  void tick;

  const inHouse = frontOfficeStore.reservations.filter((r) => r.status === 'checked-in');
  const noShowCandidates = businessDate
    ? frontOfficeStore.reservations.filter(
        (r) => (r.status === 'confirmed' || r.status === 'pending') && dayOf(r.arrival) <= businessDate,
      )
    : [];
  const [serverRevenue, setServerRevenue] = React.useState<{
    roomCharges: number;
    otherCharges: number;
    taxTotal: number;
    totalCharges: number;
    totalPayments: number;
    paymentsByMethod: { cash: number; card: number; mobileMoney: number; other: number };
  } | null>(null);

  React.useEffect(() => {
    if (!businessDate) return;
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`/api/frontoffice/day-ledger?date=${businessDate}`, {
          headers: { 'x-tenant-subdomain': getClientTenantSubdomain() },
        });
        if (!res.ok) return;
        const data = await res.json();
        const ledger = data.ledger;
        if (!cancelled && ledger) {
          setServerRevenue({
            roomCharges: ledger.chargesByCategory?.room || 0,
            otherCharges: (ledger.chargesByCategory?.fb || 0) + (ledger.chargesByCategory?.other || 0),
            taxTotal: ledger.taxTotal || 0,
            totalCharges: ledger.folioChargesTotal || 0,
            totalPayments: ledger.folioPaymentsTotal || 0,
            paymentsByMethod: ledger.paymentsByMethod || { cash: 0, card: 0, mobileMoney: 0, other: 0 },
          });
        }
      } catch {
        /* the on-screen totals fall back to the open folios */
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [businessDate, tick]);

  const discrepancies = businessDate ? checkNightAuditDiscrepancies(frontOfficeStore as any, businessDate) : [];
  const clientRevenue = businessDate ? computeDailyRevenue(frontOfficeStore as any, businessDate) : null;
  const revenue = serverRevenue || clientRevenue;
  const willPost = businessDate ? inHouse.filter((stay) => tonightPlan(stay, businessDate).label === 'Will post').length : 0;

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

  const runAudit = async () => {
    setRunning(true);
    try {
      const result = await frontOfficeStore.executeNightAudit();
      setLastRun(result);
      void refresh();
    } finally {
      setRunning(false);
    }
  };

  const calendarDate = getZonedClockParts(new Date(), resolvePropertyTimezone()).date;
  const behind = Boolean(businessDate && businessDate < calendarDate);
  const dateLabel = businessDate ? shortDay(businessDate) : '…';
  const closedDays = lastRun?.daysClosed?.filter(Boolean) ?? [];
  const closedLabel = closedDays.length > 1
    ? `${shortDay(closedDays[0])} to ${shortDay(closedDays[closedDays.length - 1])}`
    : lastRun ? shortDay(lastRun.businessDate) : '';

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-2xl">
          <h3 className="text-lg font-semibold text-ghana-black">Night Audit</h3>
          <p className="mt-0.5 text-sm text-gray-600">
            Business date <strong className="text-ghana-black">{dateLabel}</strong>
            {behind ? ' — behind calendar' : ''}
          </p>
          <p className="mt-0.5 text-xs text-gray-500">
            {lastNightAuditAt ? `Last run ${new Date(lastNightAuditAt).toLocaleString()}. ` : ''}
            Auto at 1:00 AM · History under Reports &amp; Analysis
          </p>
        </div>
        <Button
          className="bg-ghana-green text-white"
          variant="flat"
          isLoading={running}
          isDisabled={!canRun || !businessDate}
          onPress={runAudit}
        >
          {behind ? `Catch up to ${shortDay(calendarDate)}` : `Close ${dateLabel}`}
        </Button>
      </div>

      {!summaryCollapsed && (
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {([
          ['In house', String(inHouse.length), 'text-blue-700'],
          ['Will post tonight', String(willPost), 'text-purple-700'],
          ['No-show if still out', String(noShowCandidates.length), 'text-orange-700'],
          ['Needs a look', String(discrepancies.length), discrepancies.length > 0 ? 'text-red-700' : 'text-green-700'],
        ] as const).map(([label, value, tone]) => (
          <Card key={label} className="border border-gray-200 shadow-none">
            <CardBody className="px-2 py-1.5 text-center">
              <div className={`text-base font-semibold tabular-nums ${tone}`}>{value}</div>
              <div className="text-xs leading-tight text-gray-500">{label}</div>
            </CardBody>
          </Card>
        ))}
      </div>
      )}

      {discrepancies.length > 0 && (
        <Card className="border border-red-200 bg-red-50 shadow-none">
          <CardBody className="px-3 py-2">
            <h4 className="text-sm font-semibold text-red-800">These stays will not get a room charge tonight</h4>
            <ul className="mt-1 space-y-1 text-sm text-red-800">
              {discrepancies.map((item, index) => (
                <li key={`${item.reservationId}-${index}`}>
                  <span className="font-medium">{item.guestName}</span>
                  {item.roomId ? ` · Room ${item.roomId}` : ''}: {item.message}
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}

      {lastRun && (
        <Card className="border border-gray-200 shadow-none">
          <CardBody className="flex flex-wrap items-center gap-2 px-3 py-2">
            <span className="text-sm font-semibold text-ghana-black">Closed {closedLabel}</span>
            <Chip size="sm" color={lastRun.status === 'completed' ? 'success' : 'danger'} variant="flat">{lastRun.status}</Chip>
            <Chip size="sm" variant="flat">{lastRun.roomChargesPosted} room charge{lastRun.roomChargesPosted === 1 ? '' : 's'}</Chip>
            <Chip size="sm" variant="flat">{lastRun.noShowsProcessed} no-show{lastRun.noShowsProcessed === 1 ? '' : 's'}</Chip>
            {closedDays.length <= 1 && (
              <>
                <Chip size="sm" variant="flat">Charges {money(lastRun.folioChargesTotal)}</Chip>
                <Chip size="sm" variant="flat">Payments {money(lastRun.folioPaymentsTotal)}</Chip>
              </>
            )}
            {lastRun.error && <p className="w-full text-xs text-red-600">{lastRun.error}</p>}
          </CardBody>
        </Card>
      )}

      <Card className="border-0 shadow-lg">
        <CardBody className="px-3 py-3">
          <h4 className="text-sm font-semibold text-ghana-black">Posted today · {dateLabel}</h4>
          <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
            {([
              ['Room', revenue?.roomCharges],
              ['Other', revenue?.otherCharges],
              ['Tax', revenue?.taxTotal],
              ['Charges', revenue?.totalCharges],
              ['Cash', revenue?.paymentsByMethod.cash],
              ['Card', revenue?.paymentsByMethod.card],
              ['Mobile money', revenue?.paymentsByMethod.mobileMoney],
              ['Payments', revenue?.totalPayments],
            ] as const).map(([label, amount]) => (
              <div key={label}>
                <div className="text-xs text-gray-500">{label}</div>
                <div className={`tabular-nums font-semibold ${label === 'Charges' || label === 'Payments' ? 'text-ghana-black' : 'text-gray-700'}`}>{money(amount ?? 0)}</div>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>

      <Card className="border-0 shadow-lg">
        <CardBody className="px-2 py-3">
          <h4 className="mb-2 px-1 text-sm font-semibold text-ghana-black">In house</h4>
          <Table aria-label="In house for night audit" removeWrapper classNames={worksheetTableClassNames}>
            <TableHeader>
              <TableColumn className="w-[8.5rem]">ID</TableColumn>
              <TableColumn>Guest</TableColumn>
              <TableColumn className="w-[4.5rem]">Room</TableColumn>
              <TableColumn className="w-[6.5rem]">Check-out</TableColumn>
              <TableColumn className="w-[8rem]">Tonight</TableColumn>
            </TableHeader>
            <TableBody emptyContent="No guests are in house.">
              {inHouse.map((stay) => {
                const plan: Tonight = businessDate ? tonightPlan(stay, businessDate) : { label: '…', color: 'default' };
                const room = stay.roomId && stay.roomId !== 'TBD' ? stay.roomId : '';
                return (
                  <TableRow key={stay.id}>
                    <TableCell className="text-gray-600">{stay.resId || stay.id}</TableCell>
                    <TableCell className="font-semibold text-ghana-black">{stay.guestName}</TableCell>
                    <TableCell>
                      {room ? <Chip size="sm" variant="flat" color="success">{room}</Chip> : <span className="text-gray-400">Unassigned</span>}
                    </TableCell>
                    <TableCell>{shortDay(stay.departure)}</TableCell>
                    <TableCell><Chip size="sm" variant="flat" color={plan.color}>{plan.label}</Chip></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardBody>
      </Card>

      {noShowCandidates.length > 0 && (
        <Card className="border-0 shadow-lg">
          <CardBody className="px-2 py-3">
            <h4 className="mb-1 px-1 text-sm font-semibold text-ghana-black">Still not checked in</h4>
            <p className="mb-2 px-1 text-xs text-gray-500">Closing the day marks these arrivals as no-show. Check them in first if they are here.</p>
            <Table aria-label="No-show candidates" removeWrapper classNames={worksheetTableClassNames}>
              <TableHeader>
                <TableColumn className="w-[8.5rem]">ID</TableColumn>
                <TableColumn>Guest</TableColumn>
                <TableColumn className="w-[6.5rem]">Arrival</TableColumn>
                <TableColumn className="w-[7rem]">Status</TableColumn>
              </TableHeader>
              <TableBody>
                {noShowCandidates.map((stay) => (
                  <TableRow key={stay.id}>
                    <TableCell className="text-gray-600">{stay.resId || stay.id}</TableCell>
                    <TableCell className="font-semibold text-ghana-black">{stay.guestName}</TableCell>
                    <TableCell>{shortDay(stay.arrival)}</TableCell>
                    <TableCell><Chip size="sm" variant="flat" color="warning">{stay.status}</Chip></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardBody>
        </Card>
      )}

      <Card className="border-0 shadow-lg">
        <CardBody className="px-2 py-3">
          <h4 className="mb-2 px-1 text-sm font-semibold text-ghana-black">Wake-up calls · {dateLabel}</h4>
          <div className="mb-3 grid grid-cols-1 items-end gap-2 md:grid-cols-[minmax(0,1.4fr)_8rem_minmax(0,1fr)_auto]">
            <Select
              aria-label="Guest"
              placeholder="In-house guest"
              selectedKeys={wakeUpReservationId ? [wakeUpReservationId] : []}
              onSelectionChange={(keys) => setWakeUpReservationId(Array.from(keys as Set<string>)[0] || '')}
            >
              {inHouse.map((stay) => (
                <SelectItem key={stay.id}>{`${stay.guestName}${stay.roomId && stay.roomId !== 'TBD' ? ` · ${stay.roomId}` : ''}`}</SelectItem>
              ))}
            </Select>
            <Input aria-label="Time" type="time" value={wakeUpTime} onChange={(event) => setWakeUpTime(event.target.value)} />
            <Input aria-label="Notes" placeholder="Notes" value={wakeUpNotes} onChange={(event) => setWakeUpNotes(event.target.value)} />
            <Button className="bg-ghana-green text-white" variant="flat" onPress={scheduleWakeUpCall} isDisabled={!wakeUpReservationId}>
              Schedule
            </Button>
          </div>
          <Table aria-label="Wake-up calls" removeWrapper classNames={worksheetTableClassNames}>
            <TableHeader>
              <TableColumn>Guest</TableColumn>
              <TableColumn className="w-[4.5rem]">Room</TableColumn>
              <TableColumn className="w-[5rem]">Time</TableColumn>
              <TableColumn>Notes</TableColumn>
              <TableColumn className="w-[7rem]">Status</TableColumn>
              <TableColumn className="w-[9rem]"> </TableColumn>
            </TableHeader>
            <TableBody emptyContent="No wake-up calls for this date.">
              {todaysWakeUpCalls.map((call) => (
                <TableRow key={call.id}>
                  <TableCell className="font-semibold text-ghana-black">{call.guestName}</TableCell>
                  <TableCell>{call.roomNumber || '—'}</TableCell>
                  <TableCell>{call.time}</TableCell>
                  <TableCell className="truncate">{call.notes || '—'}</TableCell>
                  <TableCell>
                    <Chip size="sm" variant="flat" color={call.status === 'completed' ? 'success' : call.status === 'cancelled' ? 'default' : 'warning'}>
                      {call.status}
                    </Chip>
                  </TableCell>
                  <TableCell>
                    {call.status === 'scheduled' && (
                      <div className="flex gap-1">
                        <Button size="sm" variant="flat" color="success" onPress={() => frontOfficeStore.completeWakeUpCall(call.id)}>Done</Button>
                        <Button size="sm" variant="flat" onPress={() => frontOfficeStore.cancelWakeUpCall(call.id)}>Cancel</Button>
                      </div>
                    )}
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
