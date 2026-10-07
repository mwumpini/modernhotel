'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Badge,
  Button,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Select,
  SelectItem,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
  Pagination,
  Tooltip,
  useDisclosure,
} from '@heroui/react';
import { confirmDanger, confirmDelete, confirmUnvoid, confirmVoid } from '../DangerConfirm';
import { CompanyStatement } from './CompanyAccounts';
import { deskResizableTableClassNames } from './columnResize';
import { FOLIO_PAGE_SIZE, compareFolioValues, folioAccountColumnList, renderFolioAccountColumn, useFolioAccountColumns, type FolioAccountCol } from './folioAccountColumns';
import { frontOfficeStore } from '../../lib/frontoffice/store';
import { useSettingsStore } from '../../lib/settings/store';
import { useCurrentUserName } from '../../lib/auth/useCurrentUserName';
import { companyKeyOf, guestEarlierStays, lookupCompanyName } from '../../lib/frontoffice/companyAccount';
import { shortDay, stayClock, stayFigures } from '../../lib/frontoffice/stayWorksheet';
import { postDueRoomCharges } from '../../lib/frontoffice/roomCharges';
import { chargeGross, type FolioLineJson } from '../../lib/frontoffice/folioLedger';
import { getFolioDisplayTotals } from '../../lib/frontoffice/helpers/folio';
import type { Folio, FolioCharge, FolioPayment } from '../../lib/frontoffice/types';
import { formatMoney } from '../../lib/format/currency';
import { buildOrgProfile } from '../../lib/print/buildOrgProfile';
import { openHtmlPrintWindow } from '../../lib/print/engine';
import { trackEvent } from '../../lib/analytics/trackEvent';
import { logAudit } from '../../lib/analytics/auditLogStore';
import { notifyError, notifySuccess } from '../../lib/notifications/notify';

type ReservationLike = {
  id: string;
  resId?: string;
  guestId?: string;
  guestName?: string;
  roomId?: string;
  status?: string;
  arrival?: string;
  departure?: string;
  taxExempt?: boolean;
};

type AccountRow = {
  key: string;
  kind: 'charge' | 'payment' | 'rounding';
  id: string;
  date: string;
  description: string;
  reference: string;
  charge: number | null;
  payment: number | null;
  balance: number;
  reversal: boolean;
  paymentStatus?: string;
};

const PAYMENT_METHODS = ['Cash', 'Card', 'Mobile Money', 'Bank Transfer', 'Credit', 'Corporate Account', 'Check'] as const;

function cents(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function roomLabel(roomId?: string) {
  return roomId && roomId !== 'TBD' ? roomId : 'Unassigned';
}

function stayStatus(status?: string): { label: string; color: 'success' | 'warning' | 'danger' | 'default' } {
  if (status === 'checked-in') return { label: 'In house', color: 'success' };
  if (status === 'checked-out') return { label: 'Checked out', color: 'default' };
  if (status === 'cancelled') return { label: 'Cancelled', color: 'danger' };
  if (status === 'no-show') return { label: 'No show', color: 'danger' };
  if (status === 'confirmed' || status === 'pending') return { label: 'Arriving', color: 'warning' };
  return { label: status || 'Open', color: 'default' };
}

function nightCount(arrival?: string, departure?: string) {
  const n = Math.ceil((new Date(departure || '').getTime() - new Date(arrival || '').getTime()) / 86400000);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function accountRows(folio: Folio): AccountRow[] {
  const rows: Omit<AccountRow, 'balance'>[] = [];
  for (const charge of folio.charges || []) {
    const gross = chargeGross(charge as FolioLineJson);
    rows.push({
      key: `c-${charge.id}`,
      kind: 'charge',
      id: charge.id,
      date: charge.date,
      description: charge.description || 'Charge',
      reference: charge.reference || '—',
      charge: gross,
      payment: null,
      reversal: (charge.description || '').startsWith('VOID') || (charge.amount || 0) < 0,
    });
  }
  for (const payment of folio.payments || []) {
    const extra = [payment.status && payment.status !== 'completed' ? payment.status : '', payment.notes || ''].filter(Boolean).join(' · ');
    rows.push({
      key: `p-${payment.id}`,
      kind: 'payment',
      id: payment.id,
      date: payment.date,
      description: extra ? `${payment.method} · ${extra}` : payment.method,
      reference: payment.ref || '—',
      charge: null,
      payment: payment.amount,
      reversal: payment.status === 'refunded' || payment.status === 'failed',
      paymentStatus: payment.status,
    });
  }
  rows.sort((a, b) => a.date.localeCompare(b.date) || a.key.localeCompare(b.key));
  let running = 0;
  const posted: AccountRow[] = rows.map((row) => {
    const effect = row.kind === 'charge'
      ? row.charge || 0
      : (row.paymentStatus || 'completed') === 'completed'
        ? -(row.payment || 0)
        : 0;
    running = cents(running + effect);
    return { ...row, balance: running };
  });
  const rounding = cents((folio.balance || 0) - running);
  if (Math.abs(rounding) >= 0.01) {
    running = cents(running + rounding);
    posted.push({
      key: 'rounding',
      kind: 'rounding',
      id: '',
      date: '',
      description: 'Rounding',
      reference: '—',
      charge: rounding,
      payment: null,
      balance: running,
      reversal: true,
    });
  }
  return posted;
}

function printFolio(reservation: ReservationLike) {
  const settings = useSettingsStore.getState();
  const folio = frontOfficeStore.getOrCreateFolio(reservation.id);
  const org = buildOrgProfile(settings);
  const currency = settings.countryCompliance[settings.defaultCountry]?.currencySymbol || '₵';
  const fmt = (n?: number | null) => (n == null ? '—' : `${currency}${formatMoney(n)}`);
  const rows = accountRows(folio);
  const body = rows.length
    ? rows.map((row) => `<tr><td>${row.date ? new Date(row.date).toLocaleDateString() : '—'}</td><td>${row.description}</td><td>${row.reference}</td><td class="right">${row.charge == null ? '—' : fmt(row.charge)}</td><td class="right">${row.payment == null ? '—' : fmt(row.payment)}</td><td class="right">${fmt(row.balance)}</td></tr>`).join('')
    : '<tr><td colspan="6" class="empty">No charges or payments on this visit yet.</td></tr>';
  const figures = getFolioDisplayTotals(folio);
  const due = figures.balance || 0;
  const html = `<!doctype html><html><head><meta charset="utf-8" /><title>Folio — ${reservation.guestName || ''}</title>
    <style>
      body { font-family: Arial, sans-serif; color:#111; margin:0; padding:24px; }
      table { width:100%; border-collapse:collapse; margin-top:12px; font-size:12px; }
      th, td { border:1px solid #ddd; padding:6px 8px; text-align:left; }
      th { background:#f7f7f7; } .right { text-align:right; } .empty { text-align:center; color:#555; }
      h1 { font-size:1.2em; margin:0; } p { margin:4px 0; }
    </style></head><body>
      <h1>${org.name || 'Guest folio'} · ${folio.id}</h1>
      <p>${reservation.guestName || 'Guest'} · ${reservation.resId || reservation.id} · Room ${roomLabel(reservation.roomId)}</p>
      <p>Charges ${fmt(figures.totalCharges)} · Payments ${fmt(figures.totalPayments)} · ${due < -0.01 ? 'Credit' : 'Amount due'} ${fmt(Math.abs(due))}</p>
      <table><thead><tr><th>Date</th><th>Description</th><th>Reference</th><th class="right">Charge</th><th class="right">Payment</th><th class="right">Balance</th></tr></thead><tbody>${body}</tbody></table>
    </body></html>`;
  openHtmlPrintWindow(html);
  try { trackEvent('Print.Folio' as never, { reservationId: reservation.id, guestName: reservation.guestName }); } catch { /* ignore */ }
  try { logAudit({ area: 'frontdesk', action: 'print', entity: 'Folio', entityId: reservation.id, details: `Printed folio for ${reservation.guestName}`, severity: 'low' }); } catch { /* ignore */ }
}

export default function GuestFolioModal({
  reservation,
  isOpen,
  onClose,
  onChanged,
  headerExtra,
}: {
  reservation: ReservationLike | null;
  isOpen: boolean;
  onClose: () => void;
  onChanged?: () => void;
  headerExtra?: React.ReactNode;
}) {
  const currentUserName = useCurrentUserName();
  const canVoid = useSettingsStore((s) => s.hasPermission('frontdesk.void-charge'));
  const [tick, setTick] = useState(0);
  const [composer, setComposer] = useState<'charge' | 'payment' | null>(null);
  const [adjustmentAmount, setAdjustmentAmount] = useState(0);
  const [adjustmentReason, setAdjustmentReason] = useState('');
  const [adjustmentType, setAdjustmentType] = useState<'charge' | 'credit' | 'discount' | 'complimentary'>('charge');
  const [receiptAmount, setReceiptAmount] = useState('');
  const [receiptMethod, setReceiptMethod] = useState<(typeof PAYMENT_METHODS)[number]>('Cash');
  const [receiptNote, setReceiptNote] = useState('');
  const [entrySearch, setEntrySearch] = useState('');
  const [sortKey, setSortKey] = useState<FolioAccountCol>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [accountPage, setAccountPage] = useState(1);
  const accountCols = useFolioAccountColumns();
  const [chargeEdit, setChargeEdit] = useState<{ id: string; description: string; amount: string; original: number } | null>(null);
  const [paymentEdit, setPaymentEdit] = useState<{ id: string; amount: string; method: string; notes: string; original: number; status: string } | null>(null);
  const [companyFocus, setCompanyFocus] = useState<{ key: string; name: string } | null>(null);
  const { isOpen: splitOpen, onOpen: openSplit, onClose: closeSplit } = useDisclosure();
  const [splitChargeId, setSplitChargeId] = useState('');
  const [splitTargetId, setSplitTargetId] = useState('');
  const [splitAmount, setSplitAmount] = useState(0);
  const [splitNote, setSplitNote] = useState('');

  useEffect(() => frontOfficeStore.subscribe(() => setTick((n) => n + 1)), []);

  useEffect(() => {
    if (!isOpen) {
      setComposer(null);
      setEntrySearch('');
      return;
    }
    if (!reservation || reservation.status !== 'checked-in') return;
    const through = frontOfficeStore.businessDate || new Date().toISOString().slice(0, 10);
    postDueRoomCharges(frontOfficeStore as never, reservation.id, through);
  }, [isOpen, reservation]);

  const stay = reservation
    ? frontOfficeStore.reservations.find((item) => item.id === reservation.id) || reservation
    : null;
  void tick;

  const changed = () => onChanged?.();
  const folio = stay ? frontOfficeStore.getOrCreateFolio(stay.id) : null;
  const locked = folio?.status === 'closed' || folio?.status === 'void';
  const guest = stay ? frontOfficeStore.guests.find((item) => item.id === stay.guestId) : undefined;
  const companyName = stay ? lookupCompanyName(stay as never, guest) : null;
  const earlierStays = stay ? guestEarlierStays(stay.guestId || '', stay.id) : [];
  const earlierPayment = earlierStays.reduce((sum, row) => sum + stayFigures(row.reservation).paid, 0);
  const earlierOutstanding = earlierStays.reduce((sum, row) => sum + row.balance, 0);
  const others = frontOfficeStore.reservations.filter((item) => stay && item.id !== stay.id && item.status === 'checked-in');
  const rows = useMemo(() => (folio ? accountRows(folio) : []), [folio, tick]);
  const shown = rows.filter((row) => {
    const q = entrySearch.trim().toLowerCase();
    if (!q) return true;
    return `${row.description} ${row.reference}`.toLowerCase().includes(q);
  });
  const accountValue = (row: AccountRow, key: FolioAccountCol): string | number | null => {
    if (key === 'date') return row.date || '';
    if (key === 'description') return row.description || '';
    if (key === 'reference') return row.reference === '—' ? '' : row.reference;
    if (key === 'charge') return row.charge;
    if (key === 'payment') return row.payment;
    if (key === 'balance') return row.balance;
    return null;
  };
  const sorted = [...shown].sort((a, b) => compareFolioValues(accountValue(a, sortKey), accountValue(b, sortKey), sortDir));
  const pageCount = Math.max(1, Math.ceil(sorted.length / FOLIO_PAGE_SIZE));
  const page = Math.min(accountPage, pageCount);
  const pageRows = sorted.slice((page - 1) * FOLIO_PAGE_SIZE, page * FOLIO_PAGE_SIZE);
  const sortAccount = (key: FolioAccountCol) => {
    setAccountPage(1);
    setSortDir((dir) => (sortKey === key ? (dir === 'asc' ? 'desc' : 'asc') : (key === 'date' ? 'desc' : 'asc')));
    setSortKey(key);
  };
  const status = stayStatus(stay?.status);
  const figures = folio ? getFolioDisplayTotals(folio) : null;
  const due = figures?.balance || 0;
  const nights = nightCount(stay?.arrival, stay?.departure);

  const clearChargeComposer = () => {
    setAdjustmentAmount(0);
    setAdjustmentReason('');
    setAdjustmentType('charge');
    setComposer(null);
  };

  const processAdjustment = () => {
    if (!stay || adjustmentAmount <= 0 || !adjustmentReason.trim() || locked) return;
    if (adjustmentType === 'charge') frontOfficeStore.addCharge(stay.id, adjustmentReason, adjustmentAmount);
    else if (adjustmentType === 'credit') frontOfficeStore.addPayment(stay.id, 'Credit', adjustmentAmount, { notes: adjustmentReason, processedBy: currentUserName });
    else if (adjustmentType === 'discount') frontOfficeStore.addCharge(stay.id, `Discount: ${adjustmentReason}`, -adjustmentAmount);
    else frontOfficeStore.addCharge(stay.id, `Complimentary: ${adjustmentReason}`, -adjustmentAmount);
    notifySuccess('Charge posted', 'Folio');
    clearChargeComposer();
    changed();
  };

  const recordReceipt = () => {
    if (!stay || locked) return;
    const amount = Number(receiptAmount);
    if (!(amount > 0)) return;
    const notes = receiptNote.trim() || (stay.status === 'checked-in' ? undefined : 'Advance payment');
    frontOfficeStore.addPayment(stay.id, receiptMethod, amount, { notes, processedBy: currentUserName });
    notifySuccess('Receipt recorded', 'Folio');
    setReceiptAmount('');
    setReceiptNote('');
    setComposer(null);
    changed();
  };

  const saveCharge = async () => {
    if (!chargeEdit || !stay) return;
    const description = chargeEdit.description.trim();
    const amount = Number(chargeEdit.amount);
    if (!description || !(amount >= 0)) return;
    const open = stay.status === 'checked-in' || stay.status === 'pending';
    if (!open && Math.abs(amount - chargeEdit.original) > 0.001) {
      await confirmDanger({
        tone: 'void',
        title: 'This charge is already on the bill',
        message: 'The amount has already counted. Void this charge, then add the correct one. The original stays on file and the books stay even.',
        confirmLabel: 'OK',
      });
      return;
    }
    frontOfficeStore.updateFolioCharge(stay.id, chargeEdit.id, { description, ...(open ? { amount } : {}) });
    setChargeEdit(null);
    changed();
  };

  const savePayment = async () => {
    if (!paymentEdit || !stay) return;
    const amount = Number(paymentEdit.amount);
    if (!(amount > 0)) return;
    const open = stay.status === 'checked-in' || stay.status === 'pending';
    if (paymentEdit.status === 'completed' && !open && Math.abs(amount - paymentEdit.original) > 0.001) {
      await confirmDanger({
        tone: 'void',
        title: 'This payment is already on the bill',
        message: 'The amount has already counted. Void this payment, then take the correct one. The original stays on file and the books stay even.',
        confirmLabel: 'OK',
      });
      return;
    }
    frontOfficeStore.updateFolioPayment(stay.id, paymentEdit.id, {
      amount,
      method: paymentEdit.method as FolioPayment['method'],
      notes: paymentEdit.notes,
    });
    setPaymentEdit(null);
    changed();
  };

  return (
    <>
      <Modal isOpen={isOpen && !!stay && !!folio} onClose={onClose} size="4xl" scrollBehavior="inside">
        <ModalContent className="w-[72.25vw] max-w-[935px]">
          <ModalHeader className="flex flex-col items-stretch gap-3">
            {stay && folio && (
              <>
                <div className="flex items-start justify-between gap-4 rounded-lg border-l-4 border-ghana-green bg-green-50 px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-xs font-medium uppercase tracking-wide text-green-800">Guest folio</p>
                    <h3 className="text-xl font-semibold text-green-900">{folio.id}</h3>
                    <p className="text-sm font-normal text-slate-600">
                      <span className="font-bold text-slate-900">{stay.guestName || 'Guest'}</span>
                      {` · ${stay.resId || stay.id}`}
                      {` · Room ${roomLabel(stay.roomId)}`}
                    </p>
                    <p className="text-sm font-normal text-green-800">
                      {stay.arrival ? `${shortDay(stay.arrival)} ${stayClock(stay, 'in')}` : '—'}
                      {' – '}
                      {stay.departure ? `${shortDay(stay.departure)} ${stayClock(stay, 'out')}` : '—'}
                      {nights ? ` · ${nights} night${nights === 1 ? '' : 's'}` : ''}
                      {stay.taxExempt ? ' · Tax exempt' : ''}
                    </p>
                  </div>
                  <Badge color={status.color} variant="flat">{status.label}</Badge>
                </div>
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div>
                    <p className="text-slate-500">Charges</p>
                    <p className="font-semibold text-slate-900">₵{formatMoney(figures?.totalCharges || 0)}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Payments</p>
                    <p className="font-semibold text-slate-900">₵{formatMoney(figures?.totalPayments || 0)}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">{due < -0.01 ? 'Credit' : 'Amount due'}</p>
                    <p className={`font-semibold ${due > 0.01 ? 'text-red-700' : due < -0.01 ? 'text-emerald-700' : 'text-slate-900'}`}>
                      ₵{formatMoney(Math.abs(due))}
                    </p>
                  </div>
                </div>
                {earlierStays.length > 0 && (
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600">
                    <span>
                      Earlier account · Payment ₵{formatMoney(earlierPayment)} · Outstanding{' '}
                      <span className={earlierOutstanding > 0.01 ? 'font-semibold text-red-700' : ''}>₵{formatMoney(earlierOutstanding)}</span>
                    </span>
                    {companyName && (
                      <Button size="sm" variant="flat" color="secondary" onPress={() => setCompanyFocus({ key: companyKeyOf(companyName), name: companyName })}>
                        {companyName} record
                      </Button>
                    )}
                  </div>
                )}
              </>
            )}
          </ModalHeader>
          <ModalBody className="py-4">
            {stay && folio && (
              <div className="space-y-4">
                <div className="flex w-full flex-wrap items-center gap-2">
                  <Button size="sm" color="primary" variant="flat" isDisabled={locked} onPress={() => setComposer((open) => open === 'charge' ? null : 'charge')}>
                    Add charge
                  </Button>
                  <Button size="sm" color="success" variant="flat" isDisabled={locked} onPress={() => setComposer((open) => open === 'payment' ? null : 'payment')}>
                    Record receipt
                  </Button>
                  <div className="ml-auto flex items-center gap-2">
                    {headerExtra}
                    <Button size="sm" variant="flat" onPress={() => printFolio(stay)}>Print</Button>
                  </div>
                </div>

                {composer === 'charge' && (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-sm font-medium text-slate-800">Add charge</p>
                      <Button size="sm" variant="light" onPress={clearChargeComposer}>Cancel</Button>
                    </div>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                      <Input label="Amount" type="number" value={adjustmentAmount ? String(adjustmentAmount) : ''} onValueChange={(value) => setAdjustmentAmount(Number(value) || 0)} startContent={<span className="text-slate-400">₵</span>} />
                      <Select label="Type" selectedKeys={new Set([adjustmentType])} onSelectionChange={(keys) => setAdjustmentType((Array.from(keys)[0] as typeof adjustmentType) || 'charge')}>
                        <SelectItem key="charge">Add charge</SelectItem>
                        <SelectItem key="credit">Add credit</SelectItem>
                        <SelectItem key="discount">Apply discount</SelectItem>
                        <SelectItem key="complimentary">Complimentary</SelectItem>
                      </Select>
                      <Input label="Description" value={adjustmentReason} onValueChange={setAdjustmentReason} />
                    </div>
                    <div className="mt-3 flex justify-end">
                      <Button size="sm" color="primary" onPress={processAdjustment} isDisabled={adjustmentAmount <= 0 || !adjustmentReason.trim()}>Post</Button>
                    </div>
                  </div>
                )}

                {composer === 'payment' && (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-sm font-medium text-slate-800">Record receipt</p>
                      <Button size="sm" variant="light" onPress={() => setComposer(null)}>Cancel</Button>
                    </div>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                      <Input label="Amount" type="number" value={receiptAmount} onValueChange={setReceiptAmount} startContent={<span className="text-slate-400">₵</span>} />
                      <Select label="Method" selectedKeys={new Set([receiptMethod])} onSelectionChange={(keys) => setReceiptMethod((Array.from(keys)[0] as typeof receiptMethod) || 'Cash')}>
                        {PAYMENT_METHODS.map((method) => <SelectItem key={method}>{method}</SelectItem>)}
                      </Select>
                      <Input label="Note" value={receiptNote} onValueChange={setReceiptNote} />
                    </div>
                    <div className="mt-3 flex justify-end">
                      <Button size="sm" color="success" onPress={recordReceipt} isDisabled={!(Number(receiptAmount) > 0)}>Record receipt</Button>
                    </div>
                  </div>
                )}

                <div>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <h4 className="text-sm font-semibold text-slate-800">Account</h4>
                    {rows.length > FOLIO_PAGE_SIZE && (
                      <Input size="sm" placeholder="Search entries" value={entrySearch} onValueChange={(value) => { setEntrySearch(value); setAccountPage(1); }} className="max-w-xs" variant="bordered" />
                    )}
                  </div>
                  {rows.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-slate-200 py-10 text-center text-sm text-slate-500">
                      No charges or payments on this visit yet.
                    </div>
                  ) : shown.length === 0 ? (
                    <div className="rounded-lg border border-slate-200 py-8 text-center text-sm text-slate-500">
                      No entries match the search.
                      <div className="mt-2">
                        <Button size="sm" variant="flat" onPress={() => setEntrySearch('')}>Clear search</Button>
                      </div>
                    </div>
                  ) : (
                    <>
                    <div ref={accountCols.frameRef} style={accountCols.frameStyle}>
                    <Table aria-label="Folio account" removeWrapper classNames={deskResizableTableClassNames()}>
                      <TableHeader columns={folioAccountColumnList}>
                        {(col) => renderFolioAccountColumn(col, sortKey, sortDir, sortAccount, accountCols)}
                      </TableHeader>
                      <TableBody>
                        {pageRows.map((row) => (
                          <TableRow key={row.key}>
                            <TableCell>{row.date ? new Date(row.date).toLocaleDateString() : '—'}</TableCell>
                            <TableCell>{row.description}</TableCell>
                            <TableCell className="text-slate-600">{row.reference}</TableCell>
                            <TableCell className="text-right tabular-nums">{row.charge == null ? '—' : `₵${formatMoney(row.charge)}`}</TableCell>
                            <TableCell className="text-right tabular-nums">
                              {row.payment == null ? '—' : row.reversal ? (
                                <span className="text-slate-400 line-through" title="Voided amount">₵{formatMoney(row.payment)}</span>
                              ) : `₵${formatMoney(row.payment)}`}
                            </TableCell>
                            <TableCell className={`text-right tabular-nums font-semibold ${row.balance > 0.01 ? 'text-red-700' : row.balance < -0.01 ? 'text-emerald-700' : 'text-slate-900'}`}>
                              ₵{formatMoney(row.balance)}
                            </TableCell>
                            <TableCell className="w-px">
                              {row.kind === 'charge' && row.reversal && !locked ? (
                                <Tooltip content="Unvoid this charge">
                                  <Button size="sm" color="warning" variant="light" className="min-w-8 h-8" onPress={async () => {
                                    const ok = await confirmUnvoid(row.description || 'this charge', 'The charge counts again. Charges and amount due go back up. If this stay is already in Accounting, that invoice goes up by the same amount.');
                                    if (ok) { frontOfficeStore.unvoidCharge(stay.id, row.id); changed(); }
                                  }}>Unvoid</Button>
                                </Tooltip>
                              ) : row.paymentStatus === 'refunded' && !locked ? (
                                <Tooltip content="Unvoid this payment">
                                  <Button size="sm" color="warning" variant="light" className="min-w-8 h-8" onPress={async () => {
                                    const ok = await confirmUnvoid(row.description || 'this payment', 'The payment counts again. Payments go up and amount due goes down. The receipt in Accounting is put back if the invoice is still live.');
                                    if (ok) { frontOfficeStore.unvoidPayment(stay.id, row.id); changed(); }
                                  }}>Unvoid</Button>
                                </Tooltip>
                              ) : row.kind === 'rounding' || locked || row.reversal ? (
                                <span className="text-slate-400">—</span>
                              ) : row.kind === 'charge' ? (
                                <div className="flex items-center justify-end gap-1 whitespace-nowrap">
                                  <Button size="sm" variant="light" className="min-w-8 h-8" onPress={() => {
                                    const charge = (folio.charges || []).find((item) => item.id === row.id);
                                    if (!charge) return;
                                    setChargeEdit({ id: charge.id, description: charge.description, amount: String(charge.amount), original: charge.amount });
                                  }}>Edit</Button>
                                  {canVoid && (
                                    <Tooltip content="Void this charge">
                                      <Button size="sm" color="warning" variant="light" isIconOnly className="min-w-8 h-8" onPress={async () => {
                                        const charge = (folio.charges || []).find((item) => item.id === row.id);
                                        const ok = await confirmVoid(charge?.description || 'this charge', 'Charges and amount due go down by this amount. The charge stays on the folio so you can see it was voided. If this stay is already in Accounting, that invoice goes down by the same amount.');
                                        if (ok) { frontOfficeStore.voidCharge(stay.id, row.id, 'User action'); changed(); }
                                      }}>↻</Button>
                                    </Tooltip>
                                  )}
                                  <Tooltip content="Delete this charge">
                                    <Button size="sm" color="danger" variant="light" isIconOnly className="min-w-8 h-8" onPress={() => {
                                      const charge = (folio.charges || []).find((item) => item.id === row.id);
                                      confirmDanger({ tone: 'delete', title: `Delete ${charge?.description || 'this charge'}?`, message: 'This charge is already on the folio, so it cannot be deleted. Use Void. Charges and amount due will go down, and Accounting will follow.', confirmLabel: 'OK' });
                                    }}>✖</Button>
                                  </Tooltip>
                                  <Button size="sm" variant="light" className="min-w-8 h-8" onPress={() => {
                                    const charge = (folio.charges || []).find((item) => item.id === row.id);
                                    setSplitChargeId(row.id);
                                    setSplitAmount(charge?.amount || 0);
                                    setSplitTargetId('');
                                    setSplitNote('');
                                    openSplit();
                                  }}>Split</Button>
                                </div>
                              ) : (
                                <div className="flex items-center justify-end gap-1 whitespace-nowrap">
                                  <Button size="sm" variant="light" className="min-w-8 h-8" onPress={() => {
                                    const payment = (folio.payments || []).find((item) => item.id === row.id);
                                    if (!payment) return;
                                    setPaymentEdit({ id: payment.id, amount: String(payment.amount), method: payment.method, notes: payment.notes || '', original: payment.amount, status: payment.status || '' });
                                  }}>Edit</Button>
                                  <Tooltip content="Void this payment">
                                    <Button size="sm" color="warning" variant="light" isIconOnly className="min-w-8 h-8" onPress={async () => {
                                      const payment = (folio.payments || []).find((item) => item.id === row.id);
                                      if (!payment || !(payment.amount > 0)) return;
                                      const ok = await confirmVoid(payment.method ? `this ${payment.method} payment` : 'this payment', 'Payments go down and amount due goes up by this amount. The payment stays on the folio as voided. The receipt in Accounting is reversed.');
                                      if (ok) { frontOfficeStore.refundPayment(stay.id, payment.id, payment.amount, 'Void'); changed(); }
                                    }}>↻</Button>
                                  </Tooltip>
                                  <Tooltip content="Delete this payment">
                                    <Button size="sm" color="danger" variant="light" isIconOnly className="min-w-8 h-8" onPress={async () => {
                                      const payment = (folio.payments || []).find((item) => item.id === row.id);
                                      if (!payment) return;
                                      if (payment.status === 'pending') {
                                        const ok = await confirmDelete('this payment', 'This payment was never completed, so it is removed. Payments go down and amount due goes up. It is also taken off Accounting if it was sent there.');
                                        if (ok) { frontOfficeStore.removeFolioPayment(stay.id, payment.id); changed(); }
                                        return;
                                      }
                                      await confirmDanger({ tone: 'delete', title: 'Delete this payment?', message: 'This payment was already taken, so it cannot be deleted. Use Void. Payments will go down, amount due will go up, and the receipt in Accounting will be reversed.', confirmLabel: 'OK' });
                                    }}>✖</Button>
                                  </Tooltip>
                                </div>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    </div>
                    {sorted.length > FOLIO_PAGE_SIZE && (
                      <div className="mt-3 flex justify-end">
                        <Pagination page={page} total={pageCount} onChange={setAccountPage} size="sm" showControls />
                      </div>
                    )}
                    </>
                  )}
                </div>
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={onClose}>Close</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={!!chargeEdit} onClose={() => setChargeEdit(null)} size="md">
        <ModalContent>
          <ModalHeader>Edit charge</ModalHeader>
          <ModalBody className="gap-3">
            <Input label="Description" value={chargeEdit?.description || ''} onValueChange={(description) => setChargeEdit((row) => row ? { ...row, description } : row)} />
            <Input label="Amount" type="number" value={chargeEdit?.amount || ''} onValueChange={(amount) => setChargeEdit((row) => row ? { ...row, amount } : row)} startContent={<span className="text-gray-400">₵</span>} />
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={() => setChargeEdit(null)}>Cancel</Button>
            <Button color="primary" onPress={saveCharge}>Save</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={!!paymentEdit} onClose={() => setPaymentEdit(null)} size="md">
        <ModalContent>
          <ModalHeader>Edit payment</ModalHeader>
          <ModalBody className="gap-3">
            <Select label="Method" selectedKeys={paymentEdit ? [paymentEdit.method] : []} onSelectionChange={(keys) => { const method = String(Array.from(keys)[0] || ''); if (method) setPaymentEdit((row) => row ? { ...row, method } : row); }}>
              {PAYMENT_METHODS.map((method) => <SelectItem key={method}>{method}</SelectItem>)}
            </Select>
            <Input label="Amount" type="number" value={paymentEdit?.amount || ''} onValueChange={(amount) => setPaymentEdit((row) => row ? { ...row, amount } : row)} startContent={<span className="text-gray-400">₵</span>} />
            <Input label="Note" value={paymentEdit?.notes || ''} onValueChange={(notes) => setPaymentEdit((row) => row ? { ...row, notes } : row)} />
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={() => setPaymentEdit(null)}>Cancel</Button>
            <Button color="primary" onPress={savePayment}>Save</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={splitOpen} onClose={closeSplit}>
        <ModalContent>
          <ModalHeader>Split charge</ModalHeader>
          <ModalBody className="gap-3">
            <Input type="number" label="Amount to move" value={splitAmount > 0 ? String(splitAmount) : ''} onValueChange={(value) => setSplitAmount(parseFloat(value) || 0)} startContent={<span className="text-gray-400">₵</span>} />
            <Select label="Target stay" placeholder="Select a guest" selectedKeys={splitTargetId ? [splitTargetId] : []} onSelectionChange={(keys) => setSplitTargetId(String(Array.from(keys)[0] || ''))}>
              {others.map((item) => (
                <SelectItem key={item.id} textValue={`${item.guestName} ${item.resId || item.id}`}>{item.guestName} — {item.resId || item.id}</SelectItem>
              ))}
            </Select>
            <Input label="Note" value={splitNote} onValueChange={setSplitNote} />
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={closeSplit}>Cancel</Button>
            <Button color="primary" isDisabled={!splitTargetId || splitAmount <= 0} onPress={() => {
              if (!stay) return;
              const ok = frontOfficeStore.splitCharge(stay.id, splitChargeId, splitTargetId, splitAmount, splitNote.trim() || undefined);
              if (!ok) { notifyError('The split did not post. Check the amount.', 'Folio'); return; }
              closeSplit();
              changed();
            }}>Split charge</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={!!companyFocus} onClose={() => setCompanyFocus(null)} size="3xl" scrollBehavior="inside">
        <ModalContent>
          <ModalHeader>{companyFocus?.name} ledger</ModalHeader>
          <ModalBody>{companyFocus && <CompanyStatement companyKey={companyFocus.key} />}</ModalBody>
          <ModalFooter><Button variant="light" onPress={() => setCompanyFocus(null)}>Close</Button></ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}
