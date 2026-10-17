'use client';

import React from 'react';
import {
  Button,
  Card,
  CardBody,
  Chip,
  Table,
  Tooltip,
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
import { checkNightAuditDiscrepancies, computeDailyRevenue, computeRevenueWhere } from '../lib/frontoffice/nightAuditChecks';
import { DateFilterPills, type DateMode } from './fb/DateFilterPills';
import type { NightAuditRun } from '../lib/frontoffice/nightAudit';
import { findMainFolio } from '../lib/frontoffice/helpers/folio';
import { chargeNet, isPostedRoomCharge, type FolioLineJson } from '../lib/frontoffice/folioLedger';
import { resolveRateForDate } from '../lib/frontoffice/roomCharges';
import { computeBookingPenalty, type BookingPolicy } from '../lib/frontoffice/bookingPenalty';
import { computeSalesTaxTotal } from '../lib/tax/engine';
import { useSettingsStore } from '../lib/settings/store';
import { dayOf, money, shortDay } from '../lib/frontoffice/stayWorksheet';
import { getZonedClockParts } from '../lib/frontoffice/propertyTime';
import { resolvePropertyTimezone } from '../lib/frontoffice/propertyTimeClient';
import { worksheetTableClassNames } from './frontoffice/StayWorksheetTable';
import type { Reservation } from '../lib/frontoffice/types';

type Tonight = {
  label: string;
  color: 'success' | 'warning' | 'danger' | 'primary' | 'default';
  amount: number | null;
};

function noCharge(label: string, color: Tonight['color']): Tonight {
  return { label, color, amount: null };
}

function arrivalOutcome(stay: Reservation, policy: BookingPolicy): Tonight {
  const quoted = stay.rateBreakdown || [];
  const nights = quoted.length
    ? quoted.map((night) => ({ date: night.date, base: night.base, total: night.total }))
    : [{ date: dayOf(stay.arrival), base: resolveRateForDate(frontOfficeStore as any, stay, dayOf(stay.arrival)) }];
  const penalty = computeBookingPenalty({
    kind: 'no-show',
    policy,
    nights,
    deposit: stay.deposit?.amount || 0,
    taxExempt: !!stay.taxExempt,
    taxOn: (net) => (stay.taxExempt ? 0 : computeSalesTaxTotal(net)),
  });
  const amount = penalty.fee.gross > 0 ? penalty.fee.gross : null;
  return { label: amount == null ? 'Will no-show · no fee' : 'Will no-show', color: 'warning', amount };
}

function openStayOnDesk(reservationId: string) {
  try {
    localStorage.setItem('fo.tab', 'desk');
    localStorage.setItem('fo.deskStay', reservationId);
    window.dispatchEvent(new Event('fo-navigate'));
  } catch {
    /* the desk stays where it is if storage is blocked */
  }
}

function tonightPlan(stay: Reservation, businessDate: string): Tonight {
  const arrival = dayOf(stay.arrival);
  const departure = dayOf(stay.departure);
  if (!stay.roomId || stay.roomId === 'TBD') return noCharge('No charge · no room', 'warning');
  if (departure < businessDate) return noCharge('No charge · still in after checkout', 'danger');
  if (businessDate < arrival) return noCharge('No charge · not this night', 'default');
  if (businessDate >= departure) return noCharge('No charge · leaves today', 'default');
  const rate = resolveRateForDate(frontOfficeStore as any, stay, businessDate);
  if (rate <= 0) return noCharge('No charge · no rate', 'warning');
  const folio = findMainFolio(frontOfficeStore.folios, stay.id);
  const posted = (folio?.charges || []).find(
    (charge) => isPostedRoomCharge(charge) && dayOf(charge.date) === businessDate,
  );
  if (posted) return { label: 'Charged', color: 'success', amount: chargeNet(posted as FolioLineJson) };
  return { label: 'Will charge', color: 'primary', amount: rate };
}

export default function FrontofficeNightAudit() {
  const summaryCollapsed = useHostSummaryCollapsed();
  const [tick, setTick] = React.useState(0);
  const [lastRun, setLastRun] = React.useState<NightAuditRun | null>(null);
  const [running, setRunning] = React.useState(false);
  const { refresh } = useNightAuditLog();
  const canRun = useSettingsStore((s) => s.hasPermission('frontdesk.night-audit'));
  const noShowPolicy = useSettingsStore((s) => s.roomManagement);

  const [businessDate, setBusinessDate] = React.useState<string | null>(null);
  const [dateMode, setDateMode] = React.useState<DateMode>('today');
  const [specificDate, setSpecificDate] = React.useState('');
  const [rangeFrom, setRangeFrom] = React.useState('');
  const [rangeTo, setRangeTo] = React.useState('');
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

  const calendarDate = getZonedClockParts(new Date(), resolvePropertyTimezone()).date;
  const hotelDate = businessDate && businessDate <= calendarDate ? businessDate : calendarDate;
  const clampDate = (value: string) => (value && value > calendarDate ? calendarDate : value);
  const focusDate = dateMode === 'specific' && specificDate ? clampDate(specificDate) : hotelDate;
  const singleDay = dateMode === 'today' || dateMode === 'specific';
  const postedOn = (value: string) => {
    if (!value) return false;
    if (dateMode === 'all') return true;
    if (dateMode === 'today') return value === calendarDate;
    if (dateMode === 'specific') return !specificDate || value === clampDate(specificDate);
    if (rangeFrom && value < rangeFrom) return false;
    if (rangeTo && value > clampDate(rangeTo)) return false;
    return true;
  };

  const inHouse = frontOfficeStore.reservations.filter((r) => r.status === 'checked-in');
  const noShowCandidates = focusDate
    ? frontOfficeStore.reservations.filter(
        (r) => (r.status === 'confirmed' || r.status === 'pending') && dayOf(r.arrival) <= focusDate,
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
    if (!singleDay || !focusDate) return;
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`/api/frontoffice/day-ledger?date=${dateMode === 'today' ? calendarDate : focusDate}`, {
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
        if (!cancelled && typeof data.currentBusinessDate === 'string' && data.currentBusinessDate !== frontOfficeStore.getBusinessDate()) {
          frontOfficeStore.businessDate = data.currentBusinessDate;
          frontOfficeStore.persistNightAuditState();
          frontOfficeStore.notify();
        }
      } catch {
        /* the on-screen totals fall back to the open folios */
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [singleDay, focusDate, dateMode, calendarDate, tick]);

  const discrepancies = focusDate ? checkNightAuditDiscrepancies(frontOfficeStore as any, focusDate) : [];
  const clientRevenue = singleDay && focusDate
    ? computeDailyRevenue(frontOfficeStore as any, dateMode === 'today' ? calendarDate : focusDate)
    : computeRevenueWhere(frontOfficeStore as any, postedOn);
  const revenue = singleDay ? (serverRevenue || clientRevenue) : clientRevenue;
  const willPost = focusDate ? inHouse.filter((stay) => tonightPlan(stay, focusDate).label === 'Will charge').length : 0;
  const onAccount = (revenue?.totalCharges ?? 0) - (revenue?.totalPayments ?? 0);

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

  const behind = Boolean(hotelDate && hotelDate < calendarDate);
  const dateLabel = hotelDate ? shortDay(hotelDate) : '…';
  const viewLabel = dateMode === 'all'
    ? 'all dates'
    : dateMode === 'range'
      ? `${rangeFrom ? shortDay(rangeFrom) : '…'} to ${rangeTo ? shortDay(clampDate(rangeTo)) : '…'}`
      : dateMode === 'today'
        ? shortDay(calendarDate)
        : shortDay(focusDate);
  const viewingOtherDay = dateMode === 'all' || dateMode === 'range' || (dateMode === 'specific' && Boolean(specificDate) && clampDate(specificDate) !== hotelDate);
  const closedDays = lastRun?.daysClosed?.filter(Boolean) ?? [];
  const closedLabel = closedDays.length > 1
    ? `${shortDay(closedDays[0])} to ${shortDay(closedDays[closedDays.length - 1])}`
    : lastRun ? shortDay(lastRun.businessDate) : '';

  return (
    <div className="space-y-3">
      <div className="flex w-full items-center gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          <h3 className="truncate text-base font-semibold text-ghana-black">
            Night Audit
            <span className="ml-2 text-sm font-normal text-gray-600">
              {dateLabel} · {behind ? 'behind calendar' : 'locked'}
            </span>
          </h3>
          <Tooltip
            placement="bottom-start"
            showArrow
            content={
              <div className="max-w-xs space-y-1 px-0.5 py-0.5 text-xs">
                {lastNightAuditAt ? <p>Last run {new Date(lastNightAuditAt).toLocaleString()}.</p> : null}
                <p>
                  {viewingOtherDay
                    ? `Viewing ${viewLabel}. The hotel date stays ${dateLabel}.`
                    : 'The open day stays open until the calendar moves on.'}
                </p>
                <p>Auto at 1:00 AM. History under Reports &amp; Analysis.</p>
              </div>
            }
          >
            <button
              type="button"
              aria-label="Night audit notes"
              className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-blue-100 text-[10px] font-semibold leading-none text-blue-600 hover:bg-blue-200"
            >
              i
            </button>
          </Tooltip>
        </div>
        <DateFilterPills
          compact
          mode={dateMode}
          onMode={setDateMode}
          single={specificDate}
          onSingle={(value) => setSpecificDate(clampDate(value))}
          from={rangeFrom}
          onFrom={(value) => setRangeFrom(clampDate(value))}
          to={rangeTo}
          onTo={(value) => setRangeTo(clampDate(value))}
        />
        <Button
          size="sm"
          className="shrink-0 bg-ghana-green text-white"
          variant="flat"
          isLoading={running}
          isDisabled={!canRun || !behind}
          onPress={runAudit}
        >
          {behind ? `Catch up to ${shortDay(calendarDate)}` : 'Still open'}
        </Button>
      </div>

      {!summaryCollapsed && (
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {([
          ['In house', String(inHouse.length), 'text-blue-700'],
          ['Will charge', String(willPost), 'text-purple-700'],
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
          <h4 className="text-sm font-semibold text-ghana-black">Posted · {viewLabel}</h4>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
            {([
              {
                label: 'Charges',
                amount: revenue?.totalCharges ?? 0,
                lines: [
                  ['Room', revenue?.roomCharges ?? 0],
                  ['Other', revenue?.otherCharges ?? 0],
                  ['Tax', revenue?.taxTotal ?? 0],
                ] as [string, number][],
                hot: false,
              },
              {
                label: 'Payments',
                amount: revenue?.totalPayments ?? 0,
                lines: [
                  ['Cash', revenue?.paymentsByMethod.cash ?? 0],
                  ['Card', revenue?.paymentsByMethod.card ?? 0],
                  ['Mobile money', revenue?.paymentsByMethod.mobileMoney ?? 0],
                ] as [string, number][],
                hot: false,
              },
              {
                label: 'On account',
                amount: onAccount,
                lines: [] as [string, number][],
                hot: onAccount > 0,
              },
            ]).map((group) => (
              <div key={group.label} className={`rounded-lg px-3 py-2 ${group.hot ? 'bg-amber-50' : 'bg-gray-50'}`}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-xs text-gray-500">{group.label}</span>
                  <span className={`text-base font-semibold tabular-nums ${group.hot ? 'text-amber-800' : 'text-ghana-black'}`}>{money(group.amount)}</span>
                </div>
                {group.lines.length > 0 ? (
                  <div className="mt-2 space-y-0.5 border-t border-gray-200/80 pt-2">
                    {group.lines.map(([label, amount]) => (
                      <div key={label} className="flex items-baseline justify-between gap-3 text-xs">
                        <span className="text-gray-500">{label}</span>
                        <span className="tabular-nums text-gray-700">{money(amount)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className={`mt-2 border-t pt-2 text-xs text-gray-500 ${group.hot ? 'border-amber-200/80' : 'border-gray-200/80'}`}>
                    {group.hot ? 'Charged and not yet paid.' : 'Nothing left unpaid.'}
                  </p>
                )}
              </div>
            ))}
          </div>
        </CardBody>
      </Card>

      <Card className="border-0 shadow-lg">
        <CardBody className="px-2 py-3">
          <h4 className="mb-2 px-1 text-sm font-semibold text-ghana-black">In house</h4>
          <p className="mb-2 px-1 text-xs text-gray-500">Open a row to check the guest out, extend the stay, or fix the room.</p>
          <Table aria-label="In house for night audit" removeWrapper classNames={worksheetTableClassNames}>
            <TableHeader>
              <TableColumn className="w-[8.5rem]">ID</TableColumn>
              <TableColumn>Guest</TableColumn>
              <TableColumn className="w-[4.5rem]">Room</TableColumn>
              <TableColumn className="w-[6.5rem]">Check-out</TableColumn>
              <TableColumn className="w-[18rem]">Tonight</TableColumn>
              <TableColumn className="w-[6.5rem] text-right">Charge</TableColumn>
            </TableHeader>
            <TableBody emptyContent="No guests are in house.">
              {inHouse.map((stay) => {
                const plan: Tonight = focusDate
                  ? tonightPlan(stay, focusDate)
                  : { label: '…', color: 'default', amount: null };
                const room = stay.roomId && stay.roomId !== 'TBD' ? stay.roomId : '';
                return (
                  <TableRow key={stay.id} className="cursor-pointer hover:bg-gray-50" onClick={() => openStayOnDesk(stay.id)}>
                    <TableCell className="text-gray-600">{stay.resId || stay.id}</TableCell>
                    <TableCell className="font-semibold text-ghana-black">{stay.guestName}</TableCell>
                    <TableCell>
                      {room ? <Chip size="sm" variant="flat" color="success">{room}</Chip> : <span className="text-gray-400">Unassigned</span>}
                    </TableCell>
                    <TableCell>{shortDay(stay.departure)}</TableCell>
                    <TableCell><Chip size="sm" variant="flat" color={plan.color}>{plan.label}</Chip></TableCell>
                    <TableCell className="text-right tabular-nums">{plan.amount == null ? '—' : money(plan.amount)}</TableCell>
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
            <p className="mb-2 px-1 text-xs text-gray-500">Open a row to check the guest in. Closing the day marks anyone still listed here as a no-show.</p>
            <Table aria-label="No-show candidates" removeWrapper classNames={worksheetTableClassNames}>
              <TableHeader>
                <TableColumn className="w-[8.5rem]">ID</TableColumn>
                <TableColumn>Guest</TableColumn>
                <TableColumn className="w-[4.5rem]">Room</TableColumn>
                <TableColumn className="w-[6.5rem]">Arrival</TableColumn>
                <TableColumn className="w-[14rem]">On close</TableColumn>
                <TableColumn className="w-[6.5rem] text-right">Fee</TableColumn>
              </TableHeader>
              <TableBody>
                {noShowCandidates.map((stay) => {
                  const outcome = arrivalOutcome(stay, noShowPolicy);
                  const room = stay.roomId && stay.roomId !== 'TBD' ? stay.roomId : '';
                  return (
                    <TableRow key={stay.id} className="cursor-pointer hover:bg-gray-50" onClick={() => openStayOnDesk(stay.id)}>
                      <TableCell className="text-gray-600">{stay.resId || stay.id}</TableCell>
                      <TableCell className="font-semibold text-ghana-black">{stay.guestName}</TableCell>
                      <TableCell>
                        {room ? <Chip size="sm" variant="flat" color="success">{room}</Chip> : <span className="text-gray-400">—</span>}
                      </TableCell>
                      <TableCell>{shortDay(stay.arrival)}</TableCell>
                      <TableCell><Chip size="sm" variant="flat" color={outcome.color}>{outcome.label}</Chip></TableCell>
                      <TableCell className="text-right tabular-nums">{outcome.amount == null ? '—' : money(outcome.amount)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
