'use client';

import React, { useEffect, useMemo, useState } from 'react';
import HeadingInfo from './HeadingInfo';
import dynamic from 'next/dynamic';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Select,
  SelectItem,
  Switch,
  Tab,
  Tabs,
} from '@heroui/react';
import { useRouter } from 'next/navigation';
import { HideCardButton } from './dashboard/CustomizeViewControl';
import { FoDeskKpiCustomize, FO_DESK_KPI_SECTIONS, useFrontOfficeDeskVisibility, useFrontOfficeDeskPeriod } from './frontoffice/foDeskKpi';
import { useHostSummaryCollapsed } from '../lib/dashboard/useSummaryCollapsed';
import { periodToDateFilter } from '../lib/dashboard/useDashboardPeriod';
import { frontOfficeStore } from '../lib/frontoffice/store';
import { housekeepingStore } from '../lib/housekeeping/store';
import { useSettingsStore } from '../lib/settings/store';
import { confirmDanger } from './DangerConfirm';
import { findMainFolio, getFolioDisplayTotals } from '../lib/frontoffice/helpers/folio';
import { isPostedRoomCharge, nextCalendarDate, previousCalendarDate } from '../lib/frontoffice/folioLedger';
import { getRoomChargeDatesOnFolio, postRoomChargeForDate } from '../lib/frontoffice/roomCharges';
import { isLateCheckoutNow } from '../lib/frontoffice/lateCheckout';
import { isCorporateGuest } from '../lib/frontoffice/helpers/guests';
import { calculateStayNights } from '../lib/frontoffice/helpers/rates';
import {
  dayOf,
  deskStatus,
  isRoomLine,
  money,
  shortDay,
  sortStays,
  stayFigures,
  type StaySortKey,
} from '../lib/frontoffice/stayWorksheet';
import StayWorksheetTable from './frontoffice/StayWorksheetTable';
import { DateFilterPills, type DateMode } from './fb/DateFilterPills';
import { CompanyStatement } from './frontoffice/CompanyAccounts';
import {
  companyKeyOf,
  guestEarlierStays,
  lookupCompanyName,
  standingLabel,
} from '../lib/frontoffice/companyAccount';
import { notifyError, notifySuccess } from '../lib/notifications/notify';
import { openHtmlPrintWindow, renderPrint } from '../lib/print/engine';
import { computeSalesTax } from '../lib/tax/engine';
import { buildOrgProfile } from '../lib/print/buildOrgProfile';
import type { PrintType } from '../lib/print/templates';
import type { Reservation } from '../lib/frontoffice/types';

const ReservationsBookingsManager = dynamic(() => import('./ReservationsBookingsManager'), { ssr: false });

const DESK_SUMMARY_CARDS = FO_DESK_KPI_SECTIONS;
type PayMethod = 'Cash' | 'Card' | 'Mobile Money' | 'Bank Transfer';
type PrintChoice = 'registration-card' | 'invoice' | 'receipt';

type DeskFocus = StaySortKey | 'purpose' | 'billing' | 'centre' | 'staff';

const SORT_CHOICES: { key: DeskFocus; label: string }[] = [
  { key: 'arrival', label: 'Check-in' },
  { key: 'departure', label: 'Check-out' },
  { key: 'purpose', label: 'Purpose' },
  { key: 'billing', label: 'Billing' },
  { key: 'centre', label: 'Centre' },
  { key: 'staff', label: 'Staff' },
  { key: 'guest', label: 'Guest' },
  { key: 'status', label: 'Status' },
  { key: 'room', label: 'Room' },
  { key: 'nights', label: 'Nights' },
  { key: 'rate', label: 'Rate' },
  { key: 'amount', label: 'Amount' },
  { key: 'paid', label: 'Paid' },
  { key: 'balance', label: 'Balance' },
  { key: 'discount', label: 'Discount' },
  { key: 'other', label: 'Other charges' },
  { key: 'id', label: 'ID' },
];

const PURPOSE_OPTIONS = [
  ['personal', 'Personal'],
  ['business', 'Business'],
  ['corporate', 'Corporate'],
  ['conference', 'Conference'],
  ['training', 'Training'],
  ['medical', 'Medical'],
  ['tourism', 'Tourism'],
  ['leisure', 'Leisure'],
  ['other', 'Other'],
] as const;

function isColumnSort(focus: DeskFocus): focus is StaySortKey {
  return focus !== 'purpose' && focus !== 'billing' && focus !== 'centre' && focus !== 'staff';
}

const PRINTS: { key: PrintChoice; label: string; fallback: string }[] = [
  { key: 'registration-card', label: 'Registration card', fallback: 'builtin-registration-card-standard' },
  { key: 'invoice', label: 'Invoice', fallback: 'builtin-invoice-standard' },
  { key: 'receipt', label: 'Receipt', fallback: 'builtin-receipt-standard' },
];

function todayKey() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function stayTouches(stay: Reservation, from: string, to: string) {
  const start = dayOf(stay.arrival);
  const end = dayOf(stay.departure);
  return !!start && !!end && start <= to && end >= from;
}

function centreOf(stay: Reservation) {
  const guest = stay.guestName.trim().toLowerCase();
  const named = [stay.costCenter, stay.companyName, stay.billingPersonName]
    .map((value) => (value || '').trim())
    .find((value) => value && value.toLowerCase() !== guest);
  return named || '';
}

function clerksOf(stay: Reservation) {
  const folio = findMainFolio(frontOfficeStore.folios, stay.id);
  const names = new Set<string>();
  for (const charge of folio?.charges || []) {
    const name = (charge as { staffName?: string }).staffName?.trim();
    if (name) names.add(name);
  }
  for (const payment of folio?.payments || []) {
    const name = payment.processedBy?.trim();
    if (name) names.add(name);
  }
  return Array.from(names);
}

function addDays(iso: string, nights: number) {
  const [year, month, date] = iso.split('-').map(Number);
  const day = new Date(year, (month || 1) - 1, date || 1);
  day.setDate(day.getDate() + Math.max(1, nights));
  const m = String(day.getMonth() + 1).padStart(2, '0');
  const d = String(day.getDate()).padStart(2, '0');
  return `${day.getFullYear()}-${m}-${d}`;
}

function roomTypeName(roomTypeId: string) {
  return frontOfficeStore.roomTypes.find((rt) => rt.id === roomTypeId)?.name || 'Room';
}

function vacantRoomsFor(res: Reservation): string[] {
  const free = (roomNumber: string) =>
    frontOfficeStore.isRoomBookable(roomNumber) &&
    frontOfficeStore.isRoomFreeForRange(roomNumber, res.arrival, res.departure, res.id);
  const vacant = housekeepingStore.getRoomsByStatus('vacant');
  const typed = vacant.filter((room) => room.roomTypeId === res.roomTypeId && free(room.roomNumber));
  const list = typed.length > 0 ? typed : vacant.filter((room) => free(room.roomNumber));
  return list.map((room) => room.roomNumber);
}

function payLaterAllowed(res: Reservation) {
  const policy = useSettingsStore.getState().roomManagement?.payLaterPolicy || 'both';
  const guest = frontOfficeStore.guests.find((g) => g.id === res.guestId);
  const corporate = isCorporateGuest(guest) || !!(res.companyName || res.billingPersonName);
  return policy === 'both' || (policy === 'corporate' && corporate) || (policy === 'individual' && !corporate);
}

export default function FrontDeskCounter() {
  const router = useRouter();
  const { isHidden, hide, hiddenCount, isHosted } =
    useFrontOfficeDeskVisibility(FO_DESK_KPI_SECTIONS);
  const summaryCollapsed = useHostSummaryCollapsed();
  const { period: kpiPeriod, todayISO: kpiToday } = useFrontOfficeDeskPeriod();
  const [tick, setTick] = useState(0);
  const [query, setQuery] = useState('');
  const [view, setView] = useState<'all' | 'arriving' | 'leaving' | 'inhouse'>(() => {
    if (typeof window === 'undefined') return 'all';
    try {
      const stored = localStorage.getItem('fo.deskView');
      localStorage.removeItem('fo.deskView');
      if (stored === 'arriving' || stored === 'leaving' || stored === 'inhouse') return stored;
    } catch {}
    return 'all';
  });
  const [dateMode, setDateMode] = useState<'any' | 'today' | 'day' | 'range'>('any');
  const [specificDate, setSpecificDate] = useState('');
  const [rangeFrom, setRangeFrom] = useState('');
  const [rangeTo, setRangeTo] = useState('');
  const [focus, setFocus] = useState<DeskFocus>('arrival');
  const [narrow, setNarrow] = useState('all');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [chosenRoom, setChosenRoom] = useState('');
  const [method, setMethod] = useState<PayMethod>('Cash');
  const [payAmount, setPayAmount] = useState('');
  const [leaveOnAccount, setLeaveOnAccount] = useState(false);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [walkOpen, setWalkOpen] = useState(false);
  const [printKind, setPrintKind] = useState<PrintChoice>('invoice');
  const [nightCount, setNightCount] = useState('1');
  const [preview, setPreview] = useState<{ title: string; html: string } | null>(null);
  const [companyFocus, setCompanyFocus] = useState<{ key: string; name: string } | null>(null);
  const lateCheckoutPolicy = useSettingsStore((s) => s.roomManagement);
  const canWaiveLateCheckout = useSettingsStore((s) => s.hasPermission('frontdesk.waive-late-checkout'));

  useEffect(() => frontOfficeStore.subscribe(() => setTick((n) => n + 1)), []);

  // Keep desk date filter aligned with Customize → KPI period (drives KPI strip + list).
  useEffect(() => {
    const mapped = periodToDateFilter(kpiPeriod, kpiToday);
    if (mapped.mode === 'all') {
      setDateMode('any');
      setSpecificDate('');
      setRangeFrom('');
      setRangeTo('');
      return;
    }
    if (mapped.mode === 'today') {
      setDateMode('today');
      setSpecificDate('');
      setRangeFrom('');
      setRangeTo('');
      return;
    }
    setDateMode('range');
    setSpecificDate('');
    setRangeFrom(mapped.from);
    setRangeTo(mapped.to);
  }, [kpiPeriod, kpiToday]);

  const today = todayKey();
  const stays = frontOfficeStore.reservations;

  const arrivals = useMemo(() => {
    return stays
      .filter((r) => (r.status === 'confirmed' || r.status === 'pending') && dayOf(r.arrival) <= today)
      .sort((a, b) => dayOf(a.arrival).localeCompare(dayOf(b.arrival)) || a.guestName.localeCompare(b.guestName));
  }, [stays, today, tick]);

  const departures = useMemo(() => {
    return stays
      .filter((r) => r.status === 'checked-in' && dayOf(r.departure) <= today)
      .sort((a, b) => dayOf(a.departure).localeCompare(dayOf(b.departure)) || a.guestName.localeCompare(b.guestName));
  }, [stays, today, tick]);

  const inHouse = useMemo(() => {
    return stays
      .filter((r) => r.status === 'checked-in')
      .sort((a, b) => dayOf(a.departure).localeCompare(dayOf(b.departure)) || a.guestName.localeCompare(b.guestName));
  }, [stays, today, tick]);

  const checkedOut = useMemo(() => {
    return stays
      .filter((r) => r.status === 'checked-out')
      .sort((a, b) => dayOf(a.departure).localeCompare(dayOf(b.departure)) || a.guestName.localeCompare(b.guestName));
  }, [stays, tick]);

  const everyone = useMemo(() => {
    const byId = new Map<string, Reservation>();
    for (const stay of [...arrivals, ...inHouse, ...departures, ...checkedOut]) byId.set(stay.id, stay);
    return Array.from(byId.values()).sort(
      (a, b) => dayOf(a.arrival).localeCompare(dayOf(b.arrival)) || a.guestName.localeCompare(b.guestName),
    );
  }, [arrivals, inHouse, departures, checkedOut]);

  const selected = stays.find((r) => r.id === selectedId) || null;
  const pool = useMemo(() => {
    const base = view === 'all'
      ? everyone
      : view === 'arriving'
        ? arrivals
        : view === 'leaving'
          ? checkedOut
          : inHouse;
    const q = query.trim().toLowerCase();
    if (!q) return base;
    return base.filter((stay) => {
      const blob = [stay.guestName, stay.resId, stay.roomId, stay.guestPhone, centreOf(stay), stay.stayReason].join(' ').toLowerCase();
      return blob.includes(q);
    });
  }, [query, view, everyone, arrivals, checkedOut, inHouse]);

  const centres = useMemo(() => {
    return Array.from(new Set(pool.map(centreOf).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  }, [pool]);

  const clerks = useMemo(() => {
    return Array.from(new Set(pool.flatMap(clerksOf))).sort((a, b) => a.localeCompare(b));
  }, [pool, tick]);

  useEffect(() => {
    setChosenRoom('');
    setMethod('Cash');
    setLeaveOnAccount(false);
    setNotes('');
    const stay = frontOfficeStore.reservations.find((r) => r.id === selectedId);
    setPreview(null);
    setCompanyFocus(null);
    setNightCount('1');
    setPrintKind(stay?.status === 'checked-in' || stay?.status === 'checked-out' ? 'invoice' : 'registration-card');
    if (!stay || stay.status !== 'checked-in') {
      setPayAmount('');
      return;
    }
    const folio = findMainFolio(frontOfficeStore.folios, stay.id);
    const due = folio ? getFolioDisplayTotals(folio).outstandingBalance : 0;
    setPayAmount(due > 0 ? due.toFixed(2) : '');
  }, [selectedId, selected?.status]);

  const folio = selected ? findMainFolio(frontOfficeStore.folios, selected.id) : null;
  const folioTotals = folio ? getFolioDisplayTotals(folio) : null;
  const postedRoomDates = folio ? getRoomChargeDatesOnFolio(folio) : new Set<string>();
  const postedThrough = Array.from(postedRoomDates).sort().at(-1) || '';
  const businessDay = frontOfficeStore.businessDate || today;
  const otherCharges = (folio?.charges || []).filter((charge) => !isRoomLine(charge));
  const chargeGross = (charge: (typeof otherCharges)[number]) => charge.amount + (charge.serviceCharge || 0) - (charge.discountAmount || 0) + (charge.tax || 0);
  const otherPosted = otherCharges.reduce((sum, charge) => sum + chargeGross(charge), 0);
  const balance = folioTotals?.outstandingBalance || 0;
  const rooms = selected && (selected.status === 'confirmed' || selected.status === 'pending') ? vacantRoomsFor(selected) : [];
  const hasRoom = !!(selected?.roomId && selected.roomId !== 'TBD');
  const canLeaveBalance = selected ? payLaterAllowed(selected) : false;
  const guestRecord = selected ? frontOfficeStore.guests.find((item) => item.id === selected.guestId) : undefined;
  const companyLookup = selected ? lookupCompanyName(selected, guestRecord) : null;
  const earlierStays = selected ? guestEarlierStays(selected.guestId, selected.id) : [];
  const earlierTotal = earlierStays.reduce((sum, row) => sum + row.balance, 0);

  const openStay = (id: string) => setSelectedId(id);

  const filtered = [...pool].filter((stay) => {
    let from = '';
    let to = '';
    if (dateMode === 'today') {
      from = today;
      to = today;
    } else if (dateMode === 'day' && specificDate) {
      from = specificDate;
      to = specificDate;
    } else if (dateMode === 'range' && (rangeFrom || rangeTo)) {
      from = rangeFrom || rangeTo;
      to = rangeTo || rangeFrom;
    }
    if (from && to && !stayTouches(stay, from, to)) return false;
    if (focus === 'purpose' && narrow !== 'all' && stay.stayReason !== narrow) return false;
    const billedOut = !!(stay.billingPersonId || stay.billingPersonName || stay.companyName);
    if (focus === 'billing' && narrow === 'third_party' && !billedOut) return false;
    if (focus === 'billing' && narrow === 'guest' && billedOut) return false;
    if (focus === 'centre' && narrow !== 'all' && centreOf(stay) !== narrow) return false;
    const clerks = clerksOf(stay);
    if (focus === 'staff' && narrow === 'none' && clerks.length > 0) return false;
    if (focus === 'staff' && narrow !== 'all' && narrow !== 'none' && !clerks.includes(narrow)) return false;
    return true;
  });
  const shown = isColumnSort(focus)
    ? sortStays(filtered, focus, sortDir, today)
    : [...filtered].sort((a, b) => {
        const label = (stay: Reservation) => {
          if (focus === 'purpose') return stay.stayReason || '';
          if (focus === 'billing') return (stay.billingPersonId || stay.billingPersonName || stay.companyName) ? 'Company pays' : 'Guest pays';
          if (focus === 'centre') return centreOf(stay);
          return clerksOf(stay).join(', ');
        };
        const order = label(a).localeCompare(label(b), undefined, { sensitivity: 'base' });
        if (order !== 0) return order * (sortDir === 'asc' ? 1 : -1);
        return a.guestName.localeCompare(b.guestName);
      });

  const summary = shown.reduce(
    (sum, stay) => {
      const figures = stayFigures(stay);
      sum.charges += figures.amount;
      sum.paid += figures.paid;
      sum.outstanding += figures.balance;
      if (figures.balance <= 0.005) sum.settled += 1;
      return sum;
    },
    { charges: 0, paid: 0, outstanding: 0, settled: 0 },
  );

  const pick = (keys: Iterable<unknown> | 'all', fallback = 'all') => {
    if (keys === 'all') return fallback;
    const value = Array.from(keys)[0];
    return value ? String(value) : fallback;
  };

  const chooseFocus = (next: DeskFocus) => {
    if (next === focus) return;
    setFocus(next);
    setNarrow('all');
    setSortDir('asc');
  };

  const sortBy = (key: StaySortKey) => {
    if (focus === key) setSortDir((dir) => (dir === 'asc' ? 'desc' : 'asc'));
    else chooseFocus(key);
  };
  const sortStaff = () => {
    if (focus === 'staff') setSortDir((dir) => (dir === 'asc' ? 'desc' : 'asc'));
    else chooseFocus('staff');
  };

  const dateFilter = (
    <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
      <DateFilterPills
        mode={dateMode === 'any' ? 'all' : dateMode === 'day' ? 'specific' : dateMode}
        onMode={(mode: DateMode) =>
          setDateMode(mode === 'all' ? 'any' : mode === 'specific' ? 'day' : mode)
        }
        single={specificDate}
        onSingle={setSpecificDate}
        from={rangeFrom}
        onFrom={setRangeFrom}
        to={rangeTo}
        onTo={setRangeTo}
      />
    </div>
  );

  const checkIn = async () => {
    if (!selected || busy) return;
    const leaveRoomOpen = !hasRoom && !chosenRoom;
    if (leaveRoomOpen) {
      const ok = await confirmDanger({
        tone: 'void',
        title: `Check in ${selected.guestName} without a room?`,
        message: 'No room is assigned. You can check this guest in anyway. The room stays open until you assign one.',
        confirmLabel: 'Check in anyway',
      });
      if (!ok) return;
    }
    setBusy(true);
    try {
      if (!hasRoom && chosenRoom) frontOfficeStore.assignRoom(selected.id, chosenRoom);
      frontOfficeStore.checkIn(selected.id, leaveRoomOpen ? { leaveRoomOpen: true } : undefined);
      const updated = frontOfficeStore.reservations.find((r) => r.id === selected.id);
      const room = updated?.roomId && updated.roomId !== 'TBD' ? `Room ${updated.roomId}` : 'room still to assign';
      notifySuccess(`${selected.guestName} is in house — ${room}`, 'Checked in');
      setView('inhouse');
    } finally {
      setBusy(false);
    }
  };

  const takePayment = () => {
    if (!selected || busy) return;
    const amount = Number(payAmount);
    if (!(amount > 0)) {
      notifyError('Enter the amount the guest is paying.', 'Payment');
      return;
    }
    setBusy(true);
    try {
      frontOfficeStore.addPayment(selected.id, method, amount, { processedBy: 'Front Desk' });
      const folio = findMainFolio(frontOfficeStore.folios, selected.id);
      const due = folio ? getFolioDisplayTotals(folio).outstandingBalance : 0;
      setPayAmount(due > 0 ? due.toFixed(2) : '');
      notifySuccess(`${money(amount)} received by ${method}`, 'Payment posted');
    } finally {
      setBusy(false);
    }
  };

  const checkOut = () => {
    if (!selected || busy) return;
    if (balance > 0 && !(canLeaveBalance && leaveOnAccount)) {
      notifyError(`Take ${money(balance)} before this guest leaves.`, 'Balance due');
      return;
    }
    setBusy(true);
    try {
      const done = frontOfficeStore.processCheckout(selected.id, notes.trim() || undefined);
      if (!done) {
        notifyError('This company stay needs a PO, project code, or cost center before checkout.', 'Checkout blocked');
        return;
      }
      notifySuccess(`${selected.guestName} has checked out`, 'Checked out');
      setSelectedId(null);
      setView('leaving');
    } finally {
      setBusy(false);
    }
  };

  const stayDocument = () => {
    if (!selected) return null;
    const choice = PRINTS.find((item) => item.key === printKind) || PRINTS[1];
    const payments = (folio?.payments || []).filter((payment) => !payment.status || payment.status === 'completed');
    if (choice.key === 'receipt' && payments.length === 0) {
      notifyError('This stay has no payment to put on a receipt.', 'Print');
      return null;
    }
    const settings = useSettingsStore.getState();
    const charges = folio?.charges || [];
    const chargeRows = charges.map((charge) => ({
      description: charge.description,
      qty: 1,
      unitPrice: charge.amount,
      amount: charge.amount + (charge.serviceCharge || 0) - (charge.discountAmount || 0) + (charge.tax || 0),
      date: charge.date,
    }));
    const paymentRows = payments.map((payment) => ({
      description: payment.description || `Payment (${payment.method})`,
      amount: payment.amount,
      date: payment.date,
    }));
    const subTotal = folioTotals?.subtotal ?? quote?.subtotal ?? 0;
    const tax = folioTotals?.taxTotal ?? quote?.tax ?? 0;
    const grand = folioTotals?.totalCharges ?? quote?.grandTotal ?? 0;
    const paid = folioTotals?.totalPayments ?? 0;
    const taxLines = computeSalesTax(subTotal, tax).lines;
    const taxAmount = (type: string) =>
      taxLines.find((line) => line.type === type || line.taxCode.toUpperCase().includes(type.toUpperCase()))?.amount ?? 0;
    const html = renderPrint(choice.key as PrintType, settings.printing[choice.key] || choice.fallback, {
      org: buildOrgProfile(settings),
      guest: {
        name: selected.guestName,
        company: selected.companyName,
        roomNumber: hasRoom ? selected.roomId : '',
        roomType: roomTypeName(selected.roomTypeId),
        roomRate: quote?.nightlyGross,
        arrivalDate: selected.arrival,
        departureDate: selected.departure,
        nights: quote?.nights || calculateStayNights(selected.arrival, selected.departure) || 1,
      },
      docNumber: selected.resId || folio?.id || selected.id,
      docDate: new Date().toISOString(),
      title: choice.label,
      items: choice.key === 'receipt' ? paymentRows : choice.key === 'registration-card' ? [] : chargeRows,
      totals: {
        subTotal,
        taxes: {
          nhil: taxAmount('NHIL'),
          gefl: taxAmount('GETFund'),
          vat: taxAmount('VAT'),
          levy: taxAmount('Tourism'),
        },
        payments: paid,
        balance: Math.max(0, grand - paid),
        grandTotal: choice.key === 'receipt' ? paid : grand,
      },
      currency: '₵',
    } as any);
    return { title: choice.label, html };
  };

  const printStay = () => {
    const document = stayDocument();
    if (document) openHtmlPrintWindow(document.html);
  };

  const previewStay = () => {
    const document = stayDocument();
    if (document) setPreview(document);
  };

  const changeNights = (direction: 1 | -1) => {
    if (!selected || busy) return;
    const count = Math.floor(Number(nightCount));
    if (!(count > 0)) {
      notifyError('Enter how many nights to add or remove.', 'Stay');
      return;
    }
    const oldDeparture = dayOf(selected.departure);
    let next = oldDeparture;
    for (let i = 0; i < count; i++) next = direction > 0 ? nextCalendarDate(next) : previousCalendarDate(next);
    if (next <= dayOf(selected.arrival)) {
      notifyError('A stay has to keep at least one night.', 'Stay');
      return;
    }
    if (selected.status === 'checked-in' && next <= today) {
      notifyError('That would end the stay today. Use Check out.', 'Stay');
      return;
    }
    if (
      direction > 0 &&
      hasRoom &&
      !frontOfficeStore.isRoomFreeForRange(selected.roomId!, dayOf(selected.arrival), next, selected.id)
    ) {
      notifyError(`Room ${selected.roomId} is not free through ${shortDay(next)}.`, 'Room taken');
      return;
    }
    setBusy(true);
    try {
      if (direction > 0) {
        const updated = frontOfficeStore.extendStay(selected.id, count);
        if (!updated) {
          notifyError('This stay could not be lengthened.', 'Stay');
          return;
        }
        if (selected.status === 'checked-in') {
          let night = oldDeparture;
          for (let i = 0; i < count; i++) {
            postRoomChargeForDate(frontOfficeStore as any, selected.id, night);
            night = nextCalendarDate(night);
          }
        }
        notifySuccess(`${selected.guestName} now leaves ${shortDay(next)}`, 'Extra nights');
      } else {
        const folioNow = findMainFolio(frontOfficeStore.folios, selected.id);
        const removed = (folioNow?.charges || []).filter((charge) => {
          const description = (charge.description || '').toLowerCase();
          if (description.startsWith('void') || (charge.amount || 0) < 0) return false;
          if (!isPostedRoomCharge(charge)) return false;
          const chargeDate = (charge.date || '').slice(0, 10);
          return chargeDate >= next && chargeDate < oldDeparture;
        });
        const updated = frontOfficeStore.shortenStay(selected.id, count);
        if (!updated) {
          notifyError('This stay could not be shortened.', 'Stay');
          return;
        }
        removed.forEach((charge) => {
          frontOfficeStore.voidCharge(selected.id, charge.id, 'Stay shortened');
        });
        notifySuccess(`${selected.guestName} now leaves ${shortDay(next)}`, 'Fewer nights');
      }
    } finally {
      setBusy(false);
    }
  };

  const staying = selected?.status === 'checked-in';
  const departed = selected?.status === 'checked-out';
  const arriving = selected?.status === 'confirmed' || selected?.status === 'pending';
  const quote = selected ? frontOfficeStore.getReservationQuote(selected) : null;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <h2 className="text-lg font-bold text-ghana-black">Front Desk</h2>
          <HeadingInfo label="About the desk">One list for the shift. Open a row to check a guest in, or to settle and check them out.</HeadingInfo>
        </div>
        {!isHosted && <FoDeskKpiCustomize sections={FO_DESK_KPI_SECTIONS} />}
      </div>

      <Card className="border-0 shadow-lg">
        <CardBody className="space-y-2 px-3 py-2">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              size="sm"
              placeholder="Search name, room, or reservation..."
              value={query}
              onValueChange={setQuery}
              startContent={<span className="text-gray-400">🔍</span>}
              isClearable
              onClear={() => setQuery('')}
              aria-label="Search the desk"
              className="min-w-[14rem] grow basis-[16rem]"
            />
            <Select
              size="sm"
              aria-label="Sort by"
              placeholder="Sort by"
              className="w-40"
              selectedKeys={[focus]}
              onSelectionChange={(keys) => chooseFocus(pick(keys, 'arrival') as DeskFocus)}
            >
              {SORT_CHOICES.map((choice) => (
                <SelectItem key={choice.key}>{choice.label}</SelectItem>
              ))}
            </Select>
            {focus === 'purpose' && (
              <Select
                size="sm"
                aria-label="Filter by purpose"
                placeholder="Purpose"
                className="w-40"
                selectedKeys={[narrow]}
                onSelectionChange={(keys) => setNarrow(pick(keys))}
              >
                {[
                  <SelectItem key="all">All purposes</SelectItem>,
                  ...PURPOSE_OPTIONS.map(([key, label]) => <SelectItem key={key}>{label}</SelectItem>),
                ]}
              </Select>
            )}
            {focus === 'billing' && (
              <Select
                size="sm"
                aria-label="Filter by billing"
                placeholder="Billing"
                className="w-40"
                selectedKeys={[narrow]}
                onSelectionChange={(keys) => setNarrow(pick(keys))}
              >
                <SelectItem key="all">All billing</SelectItem>
                <SelectItem key="guest">Guest pays</SelectItem>
                <SelectItem key="third_party">Company pays</SelectItem>
              </Select>
            )}
            {focus === 'centre' && (
              <Select
                size="sm"
                aria-label="Filter by centre"
                placeholder="Centre"
                className="w-44"
                selectedKeys={[narrow]}
                onSelectionChange={(keys) => setNarrow(pick(keys))}
              >
                {[
                  <SelectItem key="all">All centres</SelectItem>,
                  ...centres.map((name) => <SelectItem key={name}>{name}</SelectItem>),
                ]}
              </Select>
            )}
            {focus === 'staff' && (
              <Select
                size="sm"
                aria-label="Filter by staff"
                placeholder="Staff"
                className="w-44"
                selectedKeys={[narrow]}
                onSelectionChange={(keys) => setNarrow(pick(keys))}
              >
                {[
                  <SelectItem key="all">All staff</SelectItem>,
                  <SelectItem key="none">No staff recorded</SelectItem>,
                  ...clerks.map((name) => <SelectItem key={name}>{name}</SelectItem>),
                ]}
              </Select>
            )}
            {(focus === 'arrival' || focus === 'departure') && (
              <div className="contents lg:hidden">{dateFilter}</div>
            )}
            <Button size="sm" color="success" className="ml-auto shrink-0 bg-green-600 text-white" onPress={() => setWalkOpen(true)}>
              Walk-in
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {([
              ['all', 'All'],
              ['arriving', 'Check-in'],
              ['inhouse', 'In-house'],
              ['leaving', 'Check-out'],
            ] as const).map(([key, label]) => (
              <Button
                key={key}
                size="sm"
                color={view === key ? 'success' : 'default'}
                variant={view === key ? 'solid' : 'flat'}
                className={view === key ? 'bg-green-600 text-white' : ''}
                onPress={() => setView(key)}
              >
                {label}
              </Button>
            ))}
            <Button size="sm" variant="flat" onPress={() => setSortDir((dir) => (dir === 'asc' ? 'desc' : 'asc'))}>
              {sortDir === 'asc' ? '↑ Ascending' : '↓ Descending'}
            </Button>
            <span className="text-xs text-gray-500">{shown.length === 1 ? '1 stay' : `${shown.length} stays`}</span>
            <div className="hidden lg:contents">{dateFilter}</div>
          </div>
        </CardBody>
      </Card>

      {!summaryCollapsed && hiddenCount < DESK_SUMMARY_CARDS.length && (
        <div className="mb-0 grid grid-cols-2 gap-2 lg:grid-cols-4">
          {([
            ['desk.totalCharges', money(summary.charges), 'text-blue-700'],
            ['desk.paidAmount', money(summary.paid), 'text-green-700'],
            ['desk.outstanding', money(summary.outstanding), 'text-orange-700'],
            ['desk.paidTotal', `${summary.settled}/${shown.length}`, 'text-purple-700'],
          ] as const).map(([id, value, tone]) => {
            if (isHidden(id)) return null;
            const label = DESK_SUMMARY_CARDS.find((card) => card.id === id)?.label || id;
            return (
              <Card key={id} className="relative border border-gray-200 shadow-none">
                <CardBody className="px-2 py-1.5 text-center">
                  <div className="absolute right-1 top-0.5">
                    <HideCardButton onHide={() => hide(id)} label={label} />
                  </div>
                  <div className={`text-base font-semibold tabular-nums ${tone}`}>{value}</div>
                  <div className="text-xs leading-tight text-gray-500">{label}</div>
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}

      <Card className="border-0 shadow-lg">
        <CardBody className="px-2 py-3">
          <StayWorksheetTable
            stays={shown}
            today={today}
            selectedId={selectedId}
            sortKey={focus}
            sortDir={sortDir}
            onSort={sortBy}
            onStaffSort={sortStaff}
            staffOf={(stay) => clerksOf(stay).join(', ')}
            onOpen={openStay}
          />
        </CardBody>
      </Card>

      <Modal
        isOpen={!!selected}
        onClose={() => setSelectedId(null)}
        size="3xl"
        scrollBehavior="inside"
        classNames={{ base: 'sm:!max-w-[52rem]', closeButton: 'text-white hover:bg-white/20' }}
      >
        <ModalContent>
          {selected && (
            <>
              <ModalHeader className="bg-gradient-to-r from-blue-600 to-purple-600 pr-12 text-white">
                <div>
                  <h2 className="text-xl font-bold">{selected.guestName}</h2>
                  <p className="text-sm font-normal text-blue-100">
                    {selected.resId || selected.id} • Room {hasRoom ? selected.roomId : 'Unassigned'}
                  </p>
                </div>
              </ModalHeader>
              <ModalBody className="gap-4">
                <Card shadow="sm" className="shrink-0">
                  <CardHeader className="pb-0">
                    <h4 className="text-base font-semibold text-ghana-black">Stay</h4>
                  </CardHeader>
                  <CardBody>
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                      <Fact label="Status" value={deskStatus(selected, today).label} />
                      <Fact label="Type" value={roomTypeName(selected.roomTypeId)} />
                      <Fact label="Nights" value={String(quote?.nights || calculateStayNights(selected.arrival, selected.departure) || 1)} />
                      <Fact label="Check-in" value={shortDay(selected.arrival)} />
                      <Fact label="Check-out" value={shortDay(selected.departure)} />
                      <Fact label="Rate" value={money(stayFigures(selected).rate)} />
                    </div>
                  </CardBody>
                </Card>

                {!!quote?.breakdown.length && (
                  <MoneyLines
                    title="Room rent"
                    rows={(() => {
                      const stayDays = quote.breakdown.map((night) => dayOf(night.date));
                      const activeDay = postedThrough
                        || (stayDays.includes(businessDay) ? businessDay : stayDays[0] || '');
                      return quote.breakdown.map((night) => {
                        const day = dayOf(night.date);
                        const posted = postedRoomDates.has(day);
                        return {
                          key: night.date,
                          date: shortDay(night.date),
                          description: night.roomId && hasRoom && night.roomId !== selected.roomId ? `Room ${night.roomId}` : '',
                          rate: night.base || 0,
                          tax: (night.total || 0) - (night.base || 0),
                          posted,
                          active: day === activeDay,
                        };
                      });
                    })()}
                    footerLabel="Stay total"
                    footerAmount={money(quote.grandTotal)}
                    note={
                      postedThrough
                        ? `Total charges below include room rent through ${shortDay(postedThrough)}. Later nights post at night audit.`
                        : 'Total charges below do not include room rent yet. The first night posts at check-in or night audit.'
                    }
                  />
                )}
                {otherCharges.length > 0 && (
                  <MoneyLines
                    title="Other charges"
                    rows={otherCharges.map((charge) => ({
                      key: charge.id,
                      date: shortDay(charge.date),
                      description: charge.description,
                      rate: charge.amount + (charge.serviceCharge || 0) - (charge.discountAmount || 0),
                      tax: charge.tax || 0,
                    }))}
                    footerLabel="Posted"
                    footerAmount={money(otherPosted)}
                  />
                )}

                <div className="flex shrink-0 flex-wrap items-end gap-2">
                  {(staying || arriving) && (
                    <>
                      <Button size="sm" variant="flat" className="h-12 min-h-12 w-12 shrink-0 px-0" isLoading={busy} aria-label="Remove nights" onPress={() => changeNights(-1)}>
                        −
                      </Button>
                      <Input
                        size="sm"
                        type="number"
                        label="Nights"
                        className="w-24"
                        value={nightCount}
                        onValueChange={setNightCount}
                      />
                      <Button size="sm" variant="flat" color="primary" className="h-12 min-h-12 w-12 shrink-0 px-0" isLoading={busy} aria-label="Add nights" onPress={() => changeNights(1)}>
                        +
                      </Button>
                    </>
                  )}
                  <div className="min-w-2 flex-1" />
                  <Select
                    size="sm"
                    label="Print"
                    className="w-[12.5rem]"
                    selectedKeys={[printKind]}
                    onSelectionChange={(keys) => {
                      const value = Array.from(keys)[0];
                      if (value === 'registration-card' || value === 'invoice' || value === 'receipt') setPrintKind(value);
                    }}
                  >
                    {PRINTS.map((item) => (
                      <SelectItem key={item.key}>{item.label}</SelectItem>
                    ))}
                  </Select>
                  <Button size="sm" variant="flat" className="h-12 min-h-12 shrink-0" onPress={previewStay}>Preview</Button>
                  <Button size="sm" variant="flat" className="h-12 min-h-12 shrink-0" onPress={printStay}>Print</Button>
                </div>

                {arriving && !hasRoom && rooms.length > 0 && (
                  <Select
                    label="Assign a room"
                    selectedKeys={chosenRoom ? [chosenRoom] : []}
                    onSelectionChange={(keys) => {
                      const value = Array.from(keys)[0];
                      setChosenRoom(value ? String(value) : '');
                    }}
                  >
                    {rooms.map((number) => (
                      <SelectItem key={number}>{number}</SelectItem>
                    ))}
                  </Select>
                )}
                {arriving && !hasRoom && rooms.length === 0 && (
                  <p className="text-sm text-gray-600">No vacant room is free for these dates. Check in anyway leaves the room open.</p>
                )}

                {(earlierStays.length > 0 || companyLookup) && (
                  <Card shadow="sm" className="shrink-0">
                    <CardHeader className="flex items-center justify-between gap-2 pb-0">
                      <h4 className="text-base font-semibold text-ghana-black">Earlier balances</h4>
                      {companyLookup && (
                        <Button
                          size="sm"
                          variant="flat"
                          color="secondary"
                          onPress={() => setCompanyFocus({ key: companyKeyOf(companyLookup), name: companyLookup })}
                        >
                          {companyLookup} record
                        </Button>
                      )}
                    </CardHeader>
                    <CardBody className="gap-2">
                      {earlierStays.length === 0 ? (
                        <p className="text-sm text-gray-600">This guest has no unpaid stay from before. This visit starts on its own bill.</p>
                      ) : (
                        <>
                          <p className="text-sm text-gray-600">
                            {selected.guestName} still owes {money(earlierTotal)} from earlier stays. That amount stays on those stays. It is not part of this visit&apos;s balance.
                          </p>
                          <div className="divide-y divide-gray-100">
                            {earlierStays.map((row) => (
                              <div key={row.reservation.id} className="flex items-center justify-between gap-2 py-1.5 text-sm">
                                <div className="min-w-0">
                                  <span className="font-medium">{row.reservation.resId || row.reservation.id}</span>
                                  <span className="ml-2 text-gray-500">{shortDay(row.reservation.arrival)} – {shortDay(row.reservation.departure)}</span>
                                </div>
                                <div className="flex shrink-0 items-center gap-2">
                                  <span className="text-xs text-gray-500">{standingLabel(row.standing)}</span>
                                  <span className="font-semibold tabular-nums text-orange-700">{money(row.balance)}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </CardBody>
                  </Card>
                )}

                {(staying || departed) && (
                  <Card shadow="sm" className="shrink-0">
                    <CardHeader className="pb-0">
                      <h4 className="text-base font-semibold text-ghana-black">Financial summary</h4>
                    </CardHeader>
                    <CardBody className="gap-3">
                    <div className="grid grid-cols-3 gap-2">
                      <div className="rounded-lg bg-blue-50 px-2 py-1.5 text-center">
                        <div className="text-base font-semibold tabular-nums text-blue-700">{money(folioTotals?.totalCharges || 0)}</div>
                        <div className="text-xs text-blue-600">Total charges</div>
                      </div>
                      <div className="rounded-lg bg-green-50 px-2 py-1.5 text-center">
                        <div className="text-base font-semibold tabular-nums text-green-700">{money(folioTotals?.totalPayments || 0)}</div>
                        <div className="text-xs text-green-600">Total payments</div>
                      </div>
                      <div className={`rounded-lg px-2 py-1.5 text-center ${balance > 0 ? 'bg-orange-50' : 'bg-green-50'}`}>
                        <div className={`text-base font-semibold tabular-nums ${balance > 0 ? 'text-orange-700' : 'text-green-700'}`}>{money(balance)}</div>
                        <div className={`text-xs ${balance > 0 ? 'text-orange-600' : 'text-green-600'}`}>Outstanding balance</div>
                      </div>
                    </div>
                    {staying && balance > 0 && (
                      <>
                        <div className="flex items-end gap-2">
                          <Select
                            size="sm"
                            label="Payment"
                            className="w-[271px] shrink-0"
                            selectedKeys={[method]}
                            onSelectionChange={(keys) => {
                              const value = Array.from(keys)[0];
                              if (value) setMethod(String(value) as PayMethod);
                            }}
                          >
                            <SelectItem key="Cash">Cash</SelectItem>
                            <SelectItem key="Card">Card</SelectItem>
                            <SelectItem key="Mobile Money">Mobile Money</SelectItem>
                            <SelectItem key="Bank Transfer">Bank Transfer</SelectItem>
                          </Select>
                          <Input
                            size="sm"
                            type="number"
                            label="Amount"
                            className="w-[124px] shrink-0"
                            value={payAmount}
                            onValueChange={setPayAmount}
                            startContent={<span className="text-gray-400">₵</span>}
                          />
                          <Button size="sm" color="success" variant="flat" className="h-12 min-h-12 w-[81px] shrink-0 px-2" onPress={takePayment} isLoading={busy}>
                            Take payment
                          </Button>
                        </div>
                        {canLeaveBalance && (
                          <Switch isSelected={leaveOnAccount} onValueChange={setLeaveOnAccount} size="sm">
                            Leave the balance on account
                          </Switch>
                        )}
                      </>
                    )}
                    {staying && canWaiveLateCheckout && isLateCheckoutNow(lateCheckoutPolicy) && (
                      <div className="space-y-1">
                        <p className="text-xs text-gray-600">This guest is past checkout. Turn this on to skip the late fee for this stay.</p>
                        <Switch
                          isSelected={!!selected.waiveLateCheckoutFee}
                          onValueChange={(waive) => {
                            const ok = frontOfficeStore.setLateCheckoutWaiver(selected.id, waive);
                            if (!ok) notifyError('You cannot waive the late checkout fee.', 'Late checkout');
                          }}
                          size="sm"
                        >
                          Waive late checkout fee
                        </Switch>
                      </div>
                    )}
                    {staying && <Input label="Checkout note" value={notes} onValueChange={setNotes} placeholder="Optional" />}
                    </CardBody>
                  </Card>
                )}
              </ModalBody>
              <ModalFooter>
                <Button variant="light" onPress={() => setSelectedId(null)}>Close</Button>
                {(staying || departed) && (
                  <Button variant="flat" onPress={() => router.push('/guest-services/client-services/invoices-payments')}>
                    Open the folio
                  </Button>
                )}
                {arriving && (
                  <Button color="success" className="bg-green-600 font-semibold text-white" isLoading={busy} onPress={checkIn}>
                    Check in
                  </Button>
                )}
                {staying && (
                  <Button color="warning" className="font-semibold" isLoading={busy} onPress={checkOut}>
                    Check out
                  </Button>
                )}
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      <Modal isOpen={!!companyFocus} onClose={() => setCompanyFocus(null)} size="3xl" scrollBehavior="inside" classNames={{ base: 'sm:!max-w-3xl' }}>
        <ModalContent>
          <ModalHeader className="text-ghana-black">{companyFocus?.name} ledger</ModalHeader>
          <ModalBody>
            {companyFocus && <CompanyStatement companyKey={companyFocus.key} />}
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={() => setCompanyFocus(null)}>Close</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={!!preview} onClose={() => setPreview(null)} size="4xl" scrollBehavior="inside">
        <ModalContent>
          <ModalHeader className="text-ghana-black">{preview?.title || 'Preview'}</ModalHeader>
          <ModalBody>
            {preview && (
              <iframe
                title={preview.title}
                sandbox=""
                srcDoc={preview.html}
                className="h-[70vh] w-full rounded-lg border border-gray-200 bg-white"
              />
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={() => setPreview(null)}>Close</Button>
            <Button color="success" className="bg-green-600 font-semibold text-white" onPress={() => preview && openHtmlPrintWindow(preview.html)}>
              Print
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {walkOpen && (
        <ReservationsBookingsManager
          mode="checkin"
          embed
          autoOpenNew
          defaultArrival={today}
          defaultDeparture={addDays(today, 1)}
          onFinished={(ids) => {
            setWalkOpen(false);
            if (ids[0]) {
              const stay = frontOfficeStore.reservations.find((r) => r.id === ids[0]);
              setSelectedId(ids[0]);
              setView(stay?.status === 'checked-in' ? 'inhouse' : 'arriving');
            }
          }}
        />
      )}
    </div>
  );
}

function MoneyLines({
  title,
  rows,
  footerLabel,
  footerAmount,
  note,
}: {
  title: string;
  rows: {
    key: string;
    date: string;
    description?: string;
    rate: number;
    tax: number;
    posted?: boolean;
    active?: boolean;
  }[];
  footerLabel: string;
  footerAmount: string;
  note?: string;
}) {
  const described = rows.some((row) => row.description);
  const columns = described
    ? 'grid grid-cols-[7.5rem_minmax(0,1fr)_6rem_5.5rem_6.25rem] gap-x-3'
    : 'grid grid-cols-[minmax(0,1fr)_6rem_5.5rem_6.25rem] gap-x-3';
  return (
    <Card shadow="sm" className="shrink-0">
      <CardBody className="px-3 py-2">
        <div className={`${columns} items-baseline border-b border-gray-200 pb-1`}>
          <span className={`${described ? 'col-span-2 ' : ''}text-sm font-semibold text-ghana-black`}>{title}</span>
          <span className="text-right text-xs text-gray-500">Rate</span>
          <span className="text-right text-xs text-gray-500">Tax</span>
          <span className="text-right text-xs text-gray-500">Amount</span>
        </div>
        {rows.map((row) => (
          <div
            key={row.key}
            className={`${columns} border-b border-gray-100 py-1.5 text-sm ${
              row.active
                ? 'rounded-md bg-amber-50 font-semibold text-ghana-black dark:bg-amber-950/40'
                : row.posted
                  ? 'bg-blue-50/70 dark:bg-blue-950/30'
                  : ''
            }`}
          >
            <span className={row.active ? 'text-ghana-black' : 'text-gray-600'}>
              {row.date}
              {row.active && row.posted ? ' · on bill' : row.active ? ' · current' : row.posted ? ' · posted' : ''}
            </span>
            {described && <span className="truncate text-ghana-black">{row.description}</span>}
            <span className="text-right tabular-nums">{money(row.rate)}</span>
            <span className="text-right tabular-nums">{money(row.tax)}</span>
            <span className="text-right tabular-nums">{money(row.rate + row.tax)}</span>
          </div>
        ))}
        <div className={`${columns} pt-2 text-sm font-semibold text-ghana-black`}>
          <span className={described ? 'col-span-2' : ''}>{footerLabel}</span>
          <span />
          <span />
          <span className="text-right tabular-nums">{footerAmount}</span>
        </div>
        {note && <p className="mt-1 text-xs text-gray-500">{note}</p>}
      </CardBody>
    </Card>
  );
}

function Fact({ label, value, emphasize }: { label: string; value: string; emphasize?: boolean }) {
  return (
    <div>
      <div className="text-xs text-gray-500">{label}</div>
      <div className={`font-semibold ${emphasize ? 'text-ghana-red' : 'text-ghana-black'}`}>{value}</div>
    </div>
  );
}

