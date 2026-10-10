'use client';

import React from 'react';
import {
  Card, CardBody, CardHeader, Button, Input, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell,
  Chip, Divider, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter,
} from '@heroui/react';
import { useSession } from 'next-auth/react';
import { getClientTenantSubdomain } from '../lib/api/clientTenant';
import { useCashierShift, type ShiftPreview } from '../lib/frontoffice/useCashierShift';
import type { CashierOutlet, CashierShiftDTO } from '../lib/frontoffice/cashierShiftRepository';
import { PETTY_EXPENSES } from '../lib/frontoffice/pettyExpenses';
import { printSimpleReport } from '../lib/print/simpleReport';
import { DateFilterPills, matchesDateFilter, useDateFilter } from './fb/DateFilterPills';
import { useSettingsStore } from '../lib/settings/store';
import { BACKDATE_MESSAGE, postingDateError, postingDateMin } from '../lib/frontoffice/backdate';

type TransferUser = { id: string; name: string; role?: string; isActive?: boolean };

function money(n?: number) {
  return `GH₵${(n ?? 0).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function signedMoney(n: number) {
  return `${n > 0 ? '+' : ''}${money(n)}`;
}

function fmtWhen(iso?: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function todayLocalISO() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function paidOutTotal(shift?: { paidOuts?: { amount: number; voidedAt?: string }[] } | null) {
  return (shift?.paidOuts || []).filter((row) => !row.voidedAt).reduce((sum, row) => sum + row.amount, 0);
}

function shiftDayKey(s: { businessDate?: string | null; openedAt: string }) {
  if (s.businessDate && /^\d{4}-\d{2}-\d{2}/.test(s.businessDate)) return s.businessDate.slice(0, 10);
  return s.openedAt;
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="font-medium text-gray-600">{label}</span>
      {children}
    </label>
  );
}

const fieldInputClass =
  'h-10 w-full rounded-lg border border-default-300 bg-white px-3 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary disabled:bg-default-100 disabled:text-gray-400';

function ReconStrip({
  float,
  cashSales,
  paidOut,
  expected,
  counted,
  variance,
}: {
  float: number;
  cashSales: number;
  paidOut?: number;
  expected: number;
  counted?: number | null;
  variance?: number | null;
}) {
  const rows: { label: string; value: string; strong?: boolean; tone?: 'primary' | 'success' | 'danger' }[] = [
    { label: 'Opening float', value: money(float) },
    { label: '+ Cash sales', value: money(cashSales) },
  ];
  if (paidOut) rows.push({ label: '− Petty paid-out', value: money(paidOut) });
  rows.push(
    { label: '= Expected', value: money(expected), strong: true, tone: 'primary' },
    { label: 'Counted', value: counted != null ? money(counted) : '—', strong: true },
    {
      label: 'Variance',
      value: variance == null ? '—' : `${variance > 0 ? '+' : ''}${money(variance)}`,
      strong: true,
      tone: variance == null ? undefined : variance === 0 ? 'success' : 'danger',
    },
  );

  return (
    <div className="rounded-lg border border-default-200 bg-default-50 p-3 text-sm">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
        {paidOut ? 'Till cash — Expected = Float + Cash sales − Petty' : 'Till cash — Expected = Float + Cash sales'}
      </p>
      <div className="divide-y divide-default-200">
        {rows.map((row) => (
          <div key={row.label} className="flex items-baseline justify-between gap-3 py-1.5">
            <span className="shrink-0 text-gray-500">{row.label}</span>
            <span
              className={`min-w-0 text-right tabular-nums ${
                row.strong ? 'font-semibold' : 'font-medium'
              } ${
                row.tone === 'primary'
                  ? 'text-primary'
                  : row.tone === 'success'
                    ? 'text-success'
                    : row.tone === 'danger'
                      ? 'text-danger'
                      : 'text-foreground'
              }`}
            >
              {row.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function WalletStrip({
  momo,
  card,
  other,
  declared,
  variance,
}: {
  momo?: number | null;
  card?: number | null;
  other?: number | null;
  declared?: number | null;
  variance?: number | null;
}) {
  const shown = (value?: number | null) => (value == null ? '—' : money(value));
  const rows: { label: string; value: string; strong?: boolean; tone?: 'success' | 'danger' }[] = [
    { label: 'MoMo recorded', value: shown(momo), strong: true },
    { label: 'Card recorded', value: shown(card) },
    { label: 'Other recorded', value: shown(other) },
    { label: 'MoMo on device', value: shown(declared), strong: true },
    {
      label: 'MoMo difference',
      value: variance == null ? '—' : signedMoney(variance),
      strong: true,
      tone: variance == null ? undefined : variance === 0 ? 'success' : 'danger',
    },
  ];

  return (
    <div className="rounded-lg border border-default-200 bg-default-50 p-3 text-sm">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
        Card, MoMo, and other payments
      </p>
      <div className="divide-y divide-default-200">
        {rows.map((row) => (
          <div key={row.label} className="flex items-baseline justify-between gap-3 py-1.5">
            <span className="shrink-0 text-gray-500">{row.label}</span>
            <span
              className={`min-w-0 text-right tabular-nums ${
                row.strong ? 'font-semibold' : 'font-medium'
              } ${
                row.tone === 'success' ? 'text-success' : row.tone === 'danger' ? 'text-danger' : 'text-foreground'
              }`}
            >
              {row.value}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-gray-500">
        Read the amount received on the MoMo device for this shift. A difference is a shortage or an unposted receipt.
      </p>
    </div>
  );
}

export default function CashierShiftPanel({
  outlet = 'frontoffice',
}: {
  outlet?: CashierOutlet;
} = {}) {
  const { data: session } = useSession();
  const allowBackdating = useSettingsStore((s) => s.roomManagement.allowBackdating === true);
  const currentUserId = (session?.user as any)?.id as string | undefined;
  const {
    shifts, myOpenShift, loading, openShift, closeShift, recordPaidOut, voidPaidOut, updateShift, deleteShift, fetchPreview,
  } = useCashierShift(currentUserId, outlet);
  const dateFilter = useDateFilter();

  const [businessDate, setBusinessDate] = React.useState(todayLocalISO);
  const [openingFloat, setOpeningFloat] = React.useState('');
  const [openNotes, setOpenNotes] = React.useState('');
  const [opening, setOpening] = React.useState(false);
  const [openError, setOpenError] = React.useState<string | null>(null);

  const [closingCount, setClosingCount] = React.useState('');
  const [momoOnDevice, setMomoOnDevice] = React.useState('');
  const [pettyAmount, setPettyAmount] = React.useState('');
  const [pettyCode, setPettyCode] = React.useState<string>(PETTY_EXPENSES[0].code);
  const [pettyNote, setPettyNote] = React.useState('');
  const [pettyBusy, setPettyBusy] = React.useState(false);
  const [closeNotes, setCloseNotes] = React.useState('');
  const [closing, setClosing] = React.useState(false);
  const [closeError, setCloseError] = React.useState<string | null>(null);
  const [pettyError, setPettyError] = React.useState<string | null>(null);
  const [tillOpen, setTillOpen] = React.useState(false);
  const [pettyOpen, setPettyOpen] = React.useState(false);
  const [livePreview, setLivePreview] = React.useState<ShiftPreview | null>(null);

  const [selected, setSelected] = React.useState<CashierShiftDTO | null>(null);
  const [editBusinessDate, setEditBusinessDate] = React.useState('');
  const [editFloat, setEditFloat] = React.useState('');
  const [editCount, setEditCount] = React.useState('');
  const [editMomo, setEditMomo] = React.useState('');
  const [editNotes, setEditNotes] = React.useState('');
  const [transferTo, setTransferTo] = React.useState<'accounts' | 'cashier'>('accounts');
  const [transferName, setTransferName] = React.useState('Accounts');
  const [transferUserId, setTransferUserId] = React.useState('');
  const [transferAmount, setTransferAmount] = React.useState('');
  const [transferUsers, setTransferUsers] = React.useState<TransferUser[]>([]);
  const [custody, setCustody] = React.useState<{
    holding: number;
    received: number;
    forwarded: number;
    transfers: Array<{
      id: string;
      fromUserId?: string;
      fromName: string;
      toType: string;
      toUserId?: string;
      toName: string;
      amount: number;
      kind: string;
      transferredAt: string;
      businessDate: string;
    }>;
  } | null>(null);
  const [custodyTo, setCustodyTo] = React.useState<'accounts' | 'cashier'>('accounts');
  const [custodyName, setCustodyName] = React.useState('Accounts');
  const [custodyUserId, setCustodyUserId] = React.useState('');
  const [custodyAmount, setCustodyAmount] = React.useState('');
  const [custodyBusy, setCustodyBusy] = React.useState(false);
  const [custodyError, setCustodyError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [transferring, setTransferring] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [modalError, setModalError] = React.useState<string | null>(null);

  const isRestaurant = outlet === 'restaurant';
  const title = isRestaurant ? 'Restaurant / Bar Till' : 'Front Desk Till';

  const recipientCashiers = React.useMemo(
    () =>
      transferUsers.filter(
        (u) =>
          u.isActive !== false &&
          u.id !== selected?.cashierUserId &&
          u.id !== currentUserId &&
          u.name.trim().toLowerCase() !== (selected?.cashierName || '').trim().toLowerCase()
      ),
    [transferUsers, selected?.cashierUserId, selected?.cashierName, currentUserId]
  );

  const custodyRecipients = React.useMemo(
    () =>
      transferUsers.filter(
        (u) => u.isActive !== false && u.id !== currentUserId
      ),
    [transferUsers, currentUserId]
  );

  const filteredShifts = React.useMemo(
    () =>
      shifts.filter((s) =>
        matchesDateFilter(shiftDayKey(s), dateFilter.mode, dateFilter.single, dateFilter.from, dateFilter.to)
      ),
    [shifts, dateFilter.mode, dateFilter.single, dateFilter.from, dateFilter.to]
  );

  const refreshCustody = React.useCallback(async () => {
    try {
      const res = await fetch(`/api/frontoffice/cash-transfers?outlet=${outlet}&mine=1`, {
        headers: { 'x-tenant-subdomain': getClientTenantSubdomain() },
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data?.custody) setCustody(data.custody);
    } catch {
      /* ignore */
    }
  }, [outlet]);

  React.useEffect(() => {
    void refreshCustody();
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/users', {
          headers: { 'x-tenant-subdomain': getClientTenantSubdomain() },
        });
        if (!res.ok || cancelled) return;
        const data = await res.json();
        const users: TransferUser[] = Array.isArray(data.users)
          ? data.users.map((u: any) => ({
              id: String(u.id),
              name: String(u.name || u.email || 'User'),
              role: u.role ? String(u.role) : undefined,
              isActive: u.isActive !== false,
            }))
          : [];
        setTransferUsers(users);
      } catch {
        /* ignore */
      }
    })();
    return () => { cancelled = true; };
  }, [refreshCustody]);

  React.useEffect(() => {
    if (transferTo !== 'cashier' || !selected) return;
    if (transferUserId && recipientCashiers.some((u) => u.id === transferUserId)) return;
    if (recipientCashiers[0]) {
      setTransferUserId(recipientCashiers[0].id);
      setTransferName(recipientCashiers[0].name);
    }
  }, [transferTo, recipientCashiers, selected, transferUserId]);

  React.useEffect(() => {
    if (!myOpenShift) {
      setLivePreview(null);
      return;
    }
    let cancelled = false;
    const load = async () => {
      const preview = await fetchPreview(myOpenShift.id);
      if (!cancelled) setLivePreview(preview);
    };
    void load();
    const t = window.setInterval(load, 15000);
    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, [myOpenShift, fetchPreview]);

  const openDetail = (s: CashierShiftDTO) => {
    setSelected(s);
    setEditBusinessDate(s.businessDate || '');
    setEditFloat(String(s.openingFloat ?? ''));
    setEditCount(s.closingCount != null ? String(s.closingCount) : '');
    setEditMomo(s.momoDeclared != null ? String(s.momoDeclared) : '');
    setEditNotes(s.notes || '');
    const dest = s.transferTo === 'cashier' ? 'cashier' : 'accounts';
    setTransferTo(dest);
    setTransferName(s.transferToName || (dest === 'accounts' ? 'Accounts' : ''));
    setTransferUserId('');
    const defaultAmt =
      s.transferAmount != null
        ? s.transferAmount
        : dest === 'accounts'
          ? (s.totalCash ?? 0)
          : (s.closingCount ?? s.expectedCash ?? 0);
    setTransferAmount(String(defaultAmt));
    setModalError(null);
  };

  const handleOpen = async () => {
    const val = parseFloat(openingFloat);
    if (isNaN(val) || val < 0) { setOpenError('Enter a valid opening float.'); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(businessDate)) { setOpenError('Pick a valid business date.'); return; }
    const backdate = postingDateError(businessDate, allowBackdating);
    if (backdate) { setOpenError(backdate); return; }
    setOpening(true);
    setOpenError(null);
    const result = await openShift(val, openNotes || undefined, businessDate);
    setOpening(false);
    if (!result.ok) { setOpenError(result.error || 'Failed to open shift.'); return; }
    setOpeningFloat('');
    setOpenNotes('');
    setTillOpen(false);
  };

  const handlePaidOut = async () => {
    if (!myOpenShift) return;
    const amount = parseFloat(pettyAmount);
    if (isNaN(amount) || amount <= 0) { setPettyError('Enter the cash that left the till.'); return; }
    if (!pettyNote.trim()) { setPettyError('Say what the cash was for.'); return; }
    setPettyBusy(true);
    setPettyError(null);
    const result = await recordPaidOut(myOpenShift.id, {
      amount,
      expenseCode: pettyCode,
      description: pettyNote.trim(),
    });
    setPettyBusy(false);
    if (!result.ok) { setPettyError(result.error || 'Could not record the paid-out.'); return; }
    setPettyAmount('');
    setPettyNote('');
  };

  const handleVoidPaidOut = async (paidOutId: string) => {
    if (!myOpenShift) return;
    setPettyBusy(true);
    setPettyError(null);
    const result = await voidPaidOut(myOpenShift.id, paidOutId);
    setPettyBusy(false);
    if (!result.ok) setPettyError(result.error || 'Could not undo the paid-out.');
  };

  const handleClose = async () => {
    if (!myOpenShift) return;
    const val = parseFloat(closingCount);
    if (isNaN(val) || val < 0) { setCloseError('Enter a valid closing count.'); return; }
    const momoVal = parseFloat(momoOnDevice);
    if (isNaN(momoVal) || momoVal < 0) { setCloseError('Enter the amount received on the MoMo device.'); return; }
    setClosing(true);
    setCloseError(null);
    const result = await closeShift(myOpenShift.id, val, closeNotes || undefined, momoVal);
    setClosing(false);
    if (!result.ok) { setCloseError(result.error || 'Failed to close shift.'); return; }
    setClosingCount('');
    setMomoOnDevice('');
    setCloseNotes('');
    setTillOpen(false);
    if (result.shift) openDetail(result.shift);
  };

  const handleSaveEdit = async (recompute = false) => {
    if (!selected) return;
    const floatVal = parseFloat(editFloat);
    if (isNaN(floatVal) || floatVal < 0) { setModalError('Enter a valid opening float.'); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(editBusinessDate)) { setModalError('Pick a valid business date.'); return; }
    const originalDay = (selected.businessDate || '').slice(0, 10);
    if (editBusinessDate !== originalDay) {
      const backdate = postingDateError(editBusinessDate, allowBackdating);
      if (backdate) { setModalError(backdate); return; }
    }
    let countVal: number | undefined;
    if (selected.status === 'closed' || editCount !== '') {
      countVal = parseFloat(editCount);
      if (isNaN(countVal!) || countVal! < 0) { setModalError('Enter a valid closing count.'); return; }
    }
    let momoVal: number | null | undefined;
    if (editMomo === '') {
      momoVal = selected.momoDeclared != null ? null : undefined;
    } else {
      momoVal = parseFloat(editMomo);
      if (isNaN(momoVal) || momoVal < 0) { setModalError('Enter the MoMo amount from the device.'); return; }
    }
    setSaving(true);
    setModalError(null);
    const result = await updateShift(selected.id, {
      businessDate: editBusinessDate,
      openingFloat: floatVal,
      closingCount: countVal,
      momoDeclared: momoVal,
      notes: editNotes || null,
      recompute,
    });
    setSaving(false);
    if (!result.ok) { setModalError(result.error || 'Failed to save.'); return; }
    if (recompute && result.shift) {
      openDetail(result.shift);
      return;
    }
    setSelected(null);
  };

  const handleTransfer = async () => {
    if (!selected || selected.status !== 'closed') return;
    const amount = parseFloat(transferAmount);
    if (isNaN(amount) || amount <= 0) { setModalError('Enter a transfer amount greater than zero.'); return; }
    if (transferTo === 'cashier') {
      const pick = recipientCashiers.find((u) => u.id === transferUserId);
      if (!pick) { setModalError('Select the receiving cashier.'); return; }
    }
    setTransferring(true);
    setModalError(null);
    const toName =
      transferTo === 'accounts'
        ? (transferName.trim() || 'Accounts')
        : (recipientCashiers.find((u) => u.id === transferUserId)?.name || transferName.trim());
    const result = await updateShift(selected.id, {
      transferTo,
      transferToName: toName,
      transferToUserId: transferTo === 'cashier' ? transferUserId : null,
      transferAmount: amount,
    });
    setTransferring(false);
    if (!result.ok) { setModalError(result.error || 'Transfer failed.'); return; }
    if (result.shift) openDetail(result.shift);
    void refreshCustody();
  };

  const handleCustodyForward = async () => {
    const amount = parseFloat(custodyAmount);
    if (isNaN(amount) || amount <= 0) { setCustodyError('Enter an amount greater than zero.'); return; }
    if (custodyTo === 'cashier' && !custodyUserId) {
      setCustodyError('Select the receiving cashier.');
      return;
    }
    setCustodyBusy(true);
    setCustodyError(null);
    try {
      const res = await fetch('/api/frontoffice/cash-transfers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-subdomain': getClientTenantSubdomain(),
        },
        body: JSON.stringify({
          outlet,
          businessDate: todayLocalISO(),
          toType: custodyTo,
          toUserId: custodyTo === 'cashier' ? custodyUserId : undefined,
          toName:
            custodyTo === 'accounts'
              ? (custodyName.trim() || 'Accounts')
              : (custodyRecipients.find((u) => u.id === custodyUserId)?.name || ''),
          amount,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setCustodyError(data?.error || 'Transfer failed.');
        setCustodyBusy(false);
        return;
      }
      if (data?.custody) setCustody(data.custody);
      setCustodyAmount('');
    } catch {
      setCustodyError('Transfer failed.');
    }
    setCustodyBusy(false);
  };

  const handleDelete = async () => {
    if (!selected) return;
    const { confirmDelete } = await import('./DangerConfirm');
    if (!(await confirmDelete('this cashier shift', `${selected.cashierName} on ${selected.businessDate} (${selected.status}) will be permanently removed.`))) return;
    setDeleting(true);
    setModalError(null);
    const result = await deleteShift(selected.id);
    setDeleting(false);
    if (!result.ok) { setModalError(result.error || 'Failed to delete.'); return; }
    setSelected(null);
  };

  const printHistory = () => {
    printSimpleReport(
      `${title} — Shift History`,
      `${filteredShifts.length} shift${filteredShifts.length === 1 ? '' : 's'}`,
      ['Business Date', 'Cashier', 'Opened', 'Closed', 'Float', 'Cash sales', 'Expected', 'Counted', 'Variance', 'MoMo', 'Card', 'Other', 'MoMo on device', 'MoMo difference', 'Transfer', 'Status'],
      filteredShifts.map((s) => [
        s.businessDate,
        s.cashierName,
        fmtWhen(s.openedAt),
        s.closedAt ? fmtWhen(s.closedAt) : '—',
        money(s.openingFloat),
        s.totalCash != null ? money(s.totalCash) : '—',
        s.expectedCash != null ? money(s.expectedCash) : '—',
        s.closingCount != null ? money(s.closingCount) : '—',
        s.variance != null ? money(s.variance) : '—',
        s.totalMobileMoney != null ? money(s.totalMobileMoney) : '—',
        s.totalCard != null ? money(s.totalCard) : '—',
        s.totalOther != null ? money(s.totalOther) : '—',
        s.momoDeclared != null ? money(s.momoDeclared) : '—',
        s.momoVariance != null ? signedMoney(s.momoVariance) : '—',
        s.transferTo
          ? `${s.transferTo === 'accounts' ? 'Accounts' : s.transferToName || 'Cashier'} ${money(s.transferAmount)}`
          : '—',
        s.status,
      ])
    );
  };

  const liveCash = livePreview?.totalCash ?? 0;
  const livePaidOut = paidOutTotal(myOpenShift);
  const liveExpected = myOpenShift ? myOpenShift.openingFloat + liveCash - livePaidOut : 0;
  const liveMomo = livePreview?.totalMobileMoney ?? 0;
  const liveCard = livePreview?.totalCard ?? 0;
  const liveOther = livePreview?.totalOther ?? 0;
  const typedMomo = momoOnDevice !== '' && !isNaN(parseFloat(momoOnDevice)) ? parseFloat(momoOnDevice) : null;
  const momoReady = typedMomo != null && typedMomo >= 0;

  const recordedTotal = (pick: (shift: CashierShiftDTO) => number | undefined) => {
    const known = filteredShifts.filter((shift) => pick(shift) != null);
    if (!known.length) return null;
    return known.reduce((total, shift) => total + Number(pick(shift) || 0), 0);
  };
  const shownMomo = recordedTotal((shift) => shift.totalMobileMoney);
  const shownCard = recordedTotal((shift) => shift.totalCard);
  const shownOther = recordedTotal((shift) => shift.totalOther);
  const shownMomoDiff = recordedTotal((shift) => shift.momoVariance);
  const shownCash = recordedTotal((shift) => shift.totalCash);
  const shownPetty = filteredShifts.length
    ? filteredShifts.reduce((total, shift) => total + paidOutTotal(shift), 0)
    : null;

  const filteredTransfers = React.useMemo(
    () =>
      (custody?.transfers || []).filter((row) =>
        matchesDateFilter(row.businessDate || row.transferredAt, dateFilter.mode, dateFilter.single, dateFilter.from, dateFilter.to),
      ),
    [custody?.transfers, dateFilter.mode, dateFilter.single, dateFilter.from, dateFilter.to],
  );
  const periodReceived = dateFilter.mode === 'all'
    ? (custody?.received ?? 0)
    : filteredTransfers
      .filter((row) => row.toType === 'cashier' && row.toUserId === currentUserId)
      .reduce((total, row) => total + row.amount, 0);
  const periodForwarded = dateFilter.mode === 'all'
    ? (custody?.forwarded ?? 0)
    : filteredTransfers
      .filter((row) => row.kind === 'custody_forward' && row.fromUserId === currentUserId)
      .reduce((total, row) => total + row.amount, 0);

  const activePaidOuts = (myOpenShift?.paidOuts || []).filter((row) => !row.voidedAt);

  return (
    <div className="p-2 space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button color="primary" variant={myOpenShift ? 'solid' : 'flat'} onPress={() => setTillOpen(true)}>
          Till
        </Button>
        <Button color="secondary" variant="flat" onPress={() => setPettyOpen(true)}>
          Petty expense
        </Button>
        {myOpenShift && (
          <span className="text-sm text-gray-600">
            Open · {myOpenShift.cashierName} · expected {money(liveExpected)}
          </span>
        )}
      </div>

      <Modal isOpen={tillOpen} onClose={() => setTillOpen(false)} size="3xl" scrollBehavior="inside">
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader>{myOpenShift ? `Till — ${myOpenShift.cashierName}` : `Open ${title}`}</ModalHeader>
              <ModalBody className="gap-4">
      {!myOpenShift ? (
        <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <Field label="Business date">
                <input
                  type="date"
                  className={fieldInputClass}
                  min={postingDateMin(allowBackdating)}
                  value={businessDate}
                  onChange={(e) => {
                    const error = postingDateError(e.target.value, allowBackdating);
                    if (error) { setOpenError(error); return; }
                    setBusinessDate(e.target.value);
                    setOpenError((prev) => (prev === BACKDATE_MESSAGE ? null : prev));
                  }}
                />
              </Field>
              <Field label="Opening float (GH₵)">
                <input type="number" min={0} step="0.01" className={fieldInputClass} value={openingFloat} onChange={(e) => setOpeningFloat(e.target.value)} placeholder="0.00" />
              </Field>
              <Field label="Notes (optional)">
                <input type="text" className={fieldInputClass} value={openNotes} onChange={(e) => setOpenNotes(e.target.value)} placeholder="Optional" />
              </Field>
            </div>
            {openError && <p className="text-sm text-danger">{openError}</p>}
            <Button color="primary" isLoading={opening} isDisabled={!openingFloat || !businessDate} onPress={handleOpen}>
              Open Shift
            </Button>
        </div>
      ) : (
        <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-3">
              <div>
                <p className="text-gray-500">Business date</p>
                <p className="font-medium">{myOpenShift.businessDate}</p>
              </div>
              <div>
                <p className="text-gray-500">Opened</p>
                <p className="font-medium">{fmtWhen(myOpenShift.openedAt)}</p>
              </div>
              <div>
                <p className="text-gray-500">Opening float</p>
                <p className="font-medium tabular-nums">{money(myOpenShift.openingFloat)}</p>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              <ReconStrip
                float={myOpenShift.openingFloat}
                cashSales={liveCash}
                paidOut={livePaidOut}
                expected={liveExpected}
                counted={closingCount !== '' && !isNaN(parseFloat(closingCount)) ? parseFloat(closingCount) : null}
                variance={
                  closingCount !== '' && !isNaN(parseFloat(closingCount))
                    ? parseFloat(closingCount) - liveExpected
                    : null
                }
              />
              <WalletStrip
                momo={liveMomo}
                card={liveCard}
                other={liveOther}
                declared={typedMomo}
                variance={typedMomo == null ? null : typedMomo - liveMomo}
              />
            </div>
            <Divider />
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <Field label="Closing count (GH₵)">
                <input type="number" min={0} step="0.01" className={fieldInputClass} value={closingCount} onChange={(e) => setClosingCount(e.target.value)} placeholder="Cash on hand" />
              </Field>
              <Field label="MoMo on the device (GH₵)">
                <input type="number" min={0} step="0.01" className={fieldInputClass} value={momoOnDevice} onChange={(e) => setMomoOnDevice(e.target.value)} placeholder="Received on MoMo" />
              </Field>
              <Field label="Notes (optional)">
                <input type="text" className={fieldInputClass} value={closeNotes} onChange={(e) => setCloseNotes(e.target.value)} placeholder="Optional" />
              </Field>
            </div>
            {closeError && <p className="text-sm text-danger">{closeError}</p>}
            <Button color="primary" isLoading={closing} isDisabled={!closingCount || !momoReady} onPress={handleClose}>
              Close &amp; Reconcile
            </Button>
        </div>
      )}
              </ModalBody>
              <ModalFooter>
                <Button variant="light" onPress={onClose}>Close</Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      <Modal isOpen={pettyOpen} onClose={() => setPettyOpen(false)} size="2xl" scrollBehavior="inside">
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader>Petty expense</ModalHeader>
              <ModalBody className="gap-4">
                {!myOpenShift ? (
                  <div className="space-y-3">
                    <p className="text-sm text-gray-600">Open a till first. Petty cash comes out of that drawer.</p>
                    <Button color="primary" variant="flat" onPress={() => { setPettyOpen(false); setTillOpen(true); }}>
                      Open till
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm text-gray-500">
                      Expected cash after this is {money(liveExpected)}. Card and MoMo stay out of the drawer.
                    </p>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                      <Field label="Amount (GH₵)">
                        <input type="number" min={0} step="0.01" className={fieldInputClass} value={pettyAmount} onChange={(e) => setPettyAmount(e.target.value)} placeholder="Cash from the drawer" />
                      </Field>
                      <Field label="Expense">
                        <select className={fieldInputClass} value={pettyCode} onChange={(e) => setPettyCode(e.target.value)}>
                          {PETTY_EXPENSES.map((row) => (
                            <option key={row.code} value={row.code}>{row.name}</option>
                          ))}
                        </select>
                      </Field>
                      <Field label="What it was for">
                        <input type="text" className={fieldInputClass} value={pettyNote} onChange={(e) => setPettyNote(e.target.value)} placeholder="Taxi, stationery, fuel" />
                      </Field>
                    </div>
                    {pettyError && <p className="text-sm text-danger">{pettyError}</p>}
                    <Button size="sm" color="secondary" variant="flat" isLoading={pettyBusy} isDisabled={!pettyAmount || !pettyNote.trim()} onPress={handlePaidOut}>
                      Record paid-out
                    </Button>
                    {activePaidOuts.length > 0 && (
                      <div className="divide-y divide-default-200 text-sm">
                        {activePaidOuts.map((row) => (
                          <div key={row.id} className="flex items-baseline justify-between gap-3 py-1.5">
                            <span className="min-w-0">
                              <span className="font-medium">{row.expenseName}</span>
                              <span className="text-gray-500"> — {row.description}</span>
                            </span>
                            <span className="flex shrink-0 items-center gap-2">
                              <span className="tabular-nums">{money(row.amount)}</span>
                              <button type="button" className="text-xs text-danger" disabled={pettyBusy} onClick={() => handleVoidPaidOut(row.id)}>Undo</button>
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </ModalBody>
              <ModalFooter>
                <Button variant="light" onPress={onClose}>Close</Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      <Card>
        <CardHeader className="flex flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between">
          <div className="font-medium">Cash and payments</div>
          <DateFilterPills
            mode={dateFilter.mode}
            onMode={dateFilter.setMode}
            single={dateFilter.single}
            onSingle={dateFilter.setSingle}
            from={dateFilter.from}
            onFrom={dateFilter.setFrom}
            to={dateFilter.to}
            onTo={dateFilter.setTo}
          />
        </CardHeader>
        <CardBody className="space-y-3">
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3 lg:grid-cols-5">
            <div>
              <p className="text-xs text-gray-500">Holding</p>
              <p className="font-semibold tabular-nums text-primary">{money(custody?.holding ?? 0)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Received</p>
              <p className="font-medium tabular-nums">{money(periodReceived)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Forwarded</p>
              <p className="font-medium tabular-nums">{money(periodForwarded)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Cash sales</p>
              <p className="font-medium tabular-nums">{shownCash == null ? '—' : money(shownCash)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Petty</p>
              <p className="font-medium tabular-nums">{shownPetty == null ? '—' : money(shownPetty)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">MoMo</p>
              <p className="font-semibold tabular-nums">{shownMomo == null ? '—' : money(shownMomo)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Card</p>
              <p className="font-semibold tabular-nums">{shownCard == null ? '—' : money(shownCard)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Other</p>
              <p className="font-semibold tabular-nums">{shownOther == null ? '—' : money(shownOther)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">MoMo difference</p>
              <p className={`font-semibold tabular-nums ${shownMomoDiff == null ? '' : shownMomoDiff === 0 ? 'text-success' : 'text-danger'}`}>
                {shownMomoDiff == null ? '—' : signedMoney(shownMomoDiff)}
              </p>
            </div>
          </div>

          {(custody?.holding ?? 0) > 0 && (
            <div className="rounded-lg border border-default-200 p-3 space-y-3">
              <p className="text-sm font-medium">Forward holding</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Field label="Destination">
                  <select
                    className={fieldInputClass}
                    value={custodyTo}
                    onChange={(e) => {
                      const next = e.target.value === 'cashier' ? 'cashier' : 'accounts';
                      setCustodyTo(next);
                      if (next === 'accounts') {
                        setCustodyName('Accounts');
                        setCustodyUserId('');
                      } else if (custodyRecipients[0]) {
                        setCustodyUserId(custodyRecipients[0].id);
                        setCustodyName(custodyRecipients[0].name);
                      }
                      setCustodyAmount(String(custody?.holding ?? 0));
                    }}
                  >
                    <option value="accounts">Accounts / safe</option>
                    <option value="cashier">Another cashier</option>
                  </select>
                </Field>
                <Field label={custodyTo === 'accounts' ? 'Received by' : 'Receiving cashier'}>
                  {custodyTo === 'cashier' ? (
                    <select
                      className={fieldInputClass}
                      value={custodyUserId}
                      onChange={(e) => {
                        setCustodyUserId(e.target.value);
                        setCustodyName(custodyRecipients.find((u) => u.id === e.target.value)?.name || '');
                      }}
                    >
                      <option value="">Select cashier…</option>
                      {custodyRecipients.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name}{u.role ? ` (${u.role})` : ''}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      className={fieldInputClass}
                      value={custodyName}
                      onChange={(e) => setCustodyName(e.target.value)}
                      placeholder="Accounts"
                    />
                  )}
                </Field>
                <Field label="Amount (GH₵)">
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    className={fieldInputClass}
                    value={custodyAmount}
                    onChange={(e) => setCustodyAmount(e.target.value)}
                    placeholder={String(custody?.holding ?? 0)}
                  />
                </Field>
              </div>
              {custodyError && <p className="text-sm text-danger">{custodyError}</p>}
              <Button color="secondary" isLoading={custodyBusy} onPress={handleCustodyForward}>
                Record custody transfer
              </Button>
            </div>
          )}

          <div>
            {filteredTransfers.length === 0 ? (
              <p className="text-sm text-gray-500">
                {(custody?.transfers?.length ?? 0) === 0 ? 'No cash transfers yet.' : 'No cash transfers for these dates.'}
              </p>
            ) : (
              <>
              <p className="mb-2 text-sm font-medium">Recent movements</p>
              <div className="overflow-x-auto rounded-lg border border-default-200">
                <table className="min-w-full text-sm">
                  <thead className="bg-default-100 text-left text-xs uppercase text-gray-500">
                    <tr>
                      <th className="px-3 py-2">When</th>
                      <th className="px-3 py-2">From</th>
                      <th className="px-3 py-2">To</th>
                      <th className="px-3 py-2">Kind</th>
                      <th className="px-3 py-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTransfers.slice(0, 12).map((t) => (
                      <tr key={t.id} className="border-t border-default-200">
                        <td className="whitespace-nowrap px-3 py-2">{fmtWhen(t.transferredAt)}</td>
                        <td className="px-3 py-2">{t.fromName}</td>
                        <td className="px-3 py-2">
                          {t.toType === 'accounts' ? `Accounts (${t.toName})` : t.toName}
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-500">
                          {t.kind === 'custody_forward' ? 'forward' : 'till drop'}
                        </td>
                        <td className="px-3 py-2 text-right font-medium tabular-nums">{money(t.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              </>
            )}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader className="flex flex-wrap items-center justify-between gap-2">
          <div className="font-medium">Shift History</div>
          <Button size="sm" color="primary" variant="flat" className="shrink-0" onPress={printHistory}>🖨️ Print</Button>
        </CardHeader>
        <CardBody>
          <Table
            aria-label="Cashier shift history"
            classNames={{ base: 'overflow-x-auto', th: 'whitespace-nowrap', td: 'whitespace-nowrap' }}
            selectionMode="single"
            selectionBehavior="replace"
            onRowAction={(key) => {
              const s = filteredShifts.find((row) => row.id === String(key));
              if (s) openDetail(s);
            }}
          >
            <TableHeader>
              <TableColumn>BUSINESS DATE</TableColumn>
              <TableColumn>CASHIER</TableColumn>
              <TableColumn>MOMO</TableColumn>
              <TableColumn>CARD</TableColumn>
              <TableColumn>OTHER</TableColumn>
              <TableColumn>MOMO DIFF</TableColumn>
              <TableColumn>CASH SALES</TableColumn>
              <TableColumn>STATUS</TableColumn>
              <TableColumn>OPENED</TableColumn>
              <TableColumn>CLOSED</TableColumn>
              <TableColumn>FLOAT</TableColumn>
              <TableColumn>EXPECTED</TableColumn>
              <TableColumn>COUNTED</TableColumn>
              <TableColumn>VARIANCE</TableColumn>
            </TableHeader>
            <TableBody emptyContent={loading ? 'Loading…' : filteredShifts.length === 0 && shifts.length > 0 ? 'No shifts for this date filter.' : 'No cashier shifts yet for this outlet.'}>
              {filteredShifts.map((s) => (
                <TableRow key={s.id} className="cursor-pointer">
                  <TableCell className="whitespace-nowrap font-medium tabular-nums">{s.businessDate || '—'}</TableCell>
                  <TableCell>{s.cashierName}</TableCell>
                  <TableCell className="tabular-nums">{s.totalMobileMoney != null ? money(s.totalMobileMoney) : '—'}</TableCell>
                  <TableCell className="tabular-nums">{s.totalCard != null ? money(s.totalCard) : '—'}</TableCell>
                  <TableCell className="tabular-nums">{s.totalOther != null ? money(s.totalOther) : '—'}</TableCell>
                  <TableCell>
                    {s.momoVariance != null ? (
                      <span className={`tabular-nums ${s.momoVariance === 0 ? 'text-success' : 'text-danger'}`}>
                        {signedMoney(s.momoVariance)}
                      </span>
                    ) : '—'}
                  </TableCell>
                  <TableCell className="tabular-nums">{s.totalCash != null ? money(s.totalCash) : '—'}</TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <Chip size="sm" variant="flat" color={s.status === 'open' ? 'warning' : 'default'}>{s.status}</Chip>
                      {s.transferTo && (
                        <span className="text-[11px] text-gray-500">
                          → {s.transferTo === 'accounts' ? 'Accounts' : s.transferToName || 'Cashier'}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{fmtWhen(s.openedAt)}</TableCell>
                  <TableCell className="whitespace-nowrap">{s.closedAt ? fmtWhen(s.closedAt) : '—'}</TableCell>
                  <TableCell className="tabular-nums">{money(s.openingFloat)}</TableCell>
                  <TableCell className="font-semibold tabular-nums">{s.expectedCash != null ? money(s.expectedCash) : '—'}</TableCell>
                  <TableCell className="font-semibold tabular-nums">{s.closingCount != null ? money(s.closingCount) : '—'}</TableCell>
                  <TableCell>
                    {s.variance != null ? (
                      <span className={`tabular-nums ${s.variance === 0 ? 'text-success' : 'text-danger'}`}>
                        {s.variance > 0 ? '+' : ''}{money(s.variance)}
                      </span>
                    ) : '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardBody>
      </Card>

      <Modal isOpen={!!selected} onClose={() => setSelected(null)} size="2xl" scrollBehavior="inside">
        <ModalContent>
          {(onClose) => selected && (
            <>
              <ModalHeader className="flex flex-col gap-0.5">
                <span>Shift — {selected.cashierName}</span>
                <span className="text-sm font-normal text-gray-500">
                  {selected.businessDate} · {selected.status} · {fmtWhen(selected.openedAt)}
                  {selected.closedAt ? ` → ${fmtWhen(selected.closedAt)}` : ''}
                </span>
              </ModalHeader>
              <ModalBody className="gap-5">
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                  <ReconStrip
                    float={Number(editFloat) || selected.openingFloat}
                    cashSales={selected.totalCash ?? 0}
                    paidOut={paidOutTotal(selected)}
                    expected={(Number(editFloat) || selected.openingFloat) + (selected.totalCash ?? 0) - paidOutTotal(selected)}
                    counted={editCount !== '' && !isNaN(parseFloat(editCount)) ? parseFloat(editCount) : selected.closingCount}
                    variance={
                      editCount !== '' && !isNaN(parseFloat(editCount))
                        ? parseFloat(editCount) - ((Number(editFloat) || selected.openingFloat) + (selected.totalCash ?? 0) - paidOutTotal(selected))
                        : selected.variance
                    }
                  />
                  <WalletStrip
                    momo={selected.totalMobileMoney}
                    card={selected.totalCard}
                    other={selected.totalOther}
                    declared={editMomo !== '' && !isNaN(parseFloat(editMomo)) ? parseFloat(editMomo) : null}
                    variance={
                      editMomo !== '' && !isNaN(parseFloat(editMomo))
                        ? parseFloat(editMomo) - (selected.totalMobileMoney ?? 0)
                        : selected.momoVariance
                    }
                  />
                </div>

                {selected.paidOuts.some((row) => !row.voidedAt) && (
                  <div className="text-sm">
                    <p className="mb-1 font-medium">Petty paid-outs</p>
                    <div className="divide-y divide-default-200">
                      {selected.paidOuts.filter((row) => !row.voidedAt).map((row) => (
                        <div key={row.id} className="flex items-baseline justify-between gap-3 py-1.5">
                          <span className="min-w-0">
                            <span className="font-medium">{row.expenseName}</span>
                            <span className="text-gray-500"> — {row.description}</span>
                          </span>
                          <span className="shrink-0 tabular-nums">{money(row.amount)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Business date">
                    <input
                      type="date"
                      className={fieldInputClass}
                      min={editBusinessDate && editBusinessDate < (postingDateMin(allowBackdating) || '') ? undefined : postingDateMin(allowBackdating)}
                      value={editBusinessDate}
                      onChange={(e) => {
                        const originalDay = (selected?.businessDate || '').slice(0, 10);
                        if (e.target.value !== originalDay) {
                          const error = postingDateError(e.target.value, allowBackdating);
                          if (error) { setModalError(error); return; }
                        }
                        setEditBusinessDate(e.target.value);
                        setModalError((prev) => (prev === BACKDATE_MESSAGE ? null : prev));
                      }}
                    />
                  </Field>
                  <Field label="Opening float (GH₵)">
                    <input type="number" min={0} step="0.01" className={fieldInputClass} value={editFloat} onChange={(e) => setEditFloat(e.target.value)} />
                  </Field>
                  <Field label="Closing count (GH₵)">
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      className={fieldInputClass}
                      value={editCount}
                      onChange={(e) => setEditCount(e.target.value)}
                      disabled={selected.status === 'open'}
                      placeholder={selected.status === 'open' ? 'Close shift first' : '0.00'}
                    />
                  </Field>
                  <Field label="MoMo on the device (GH₵)">
                    <input type="number" min={0} step="0.01" className={fieldInputClass} value={editMomo} onChange={(e) => setEditMomo(e.target.value)} placeholder="Received on MoMo" />
                  </Field>
                  <Field label="Notes">
                    <input type="text" className={fieldInputClass} value={editNotes} onChange={(e) => setEditNotes(e.target.value)} placeholder="Optional" />
                  </Field>
                </div>

                {selected.status === 'closed' && (
                  <div className="rounded-lg border border-default-200 p-3 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium">Transfer cash</p>
                      {selected.transferredAt && (
                        <Chip size="sm" color="success" variant="flat">
                          Transferred {fmtWhen(selected.transferredAt)}
                        </Chip>
                      )}
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <Field label="Destination">
                        <select
                          className={fieldInputClass}
                          value={transferTo}
                          onChange={(e) => {
                            const next = e.target.value === 'cashier' ? 'cashier' : 'accounts';
                            setTransferTo(next);
                            if (next === 'accounts') {
                              setTransferName('Accounts');
                              setTransferUserId('');
                            } else if (recipientCashiers[0]) {
                              setTransferUserId(recipientCashiers[0].id);
                              setTransferName(recipientCashiers[0].name);
                            } else {
                              setTransferUserId('');
                              setTransferName('');
                            }
                            setTransferAmount(
                              String(
                                next === 'accounts'
                                  ? (selected.totalCash ?? 0)
                                  : (selected.closingCount ?? selected.expectedCash ?? 0)
                              )
                            );
                          }}
                        >
                          <option value="accounts">Accounts / safe</option>
                          <option value="cashier">Another cashier (head / float)</option>
                        </select>
                      </Field>
                      <Field label={transferTo === 'accounts' ? 'Received by' : 'Receiving cashier'}>
                        {transferTo === 'cashier' ? (
                          <>
                            <select
                              className={fieldInputClass}
                              value={transferUserId}
                              onChange={(e) => {
                                const id = e.target.value;
                                setTransferUserId(id);
                                setTransferName(recipientCashiers.find((u) => u.id === id)?.name || '');
                              }}
                            >
                              <option value="">Select cashier…</option>
                              {recipientCashiers.map((u) => (
                                <option key={u.id} value={u.id}>
                                  {u.name}{u.role ? ` (${u.role})` : ''}
                                </option>
                              ))}
                            </select>
                            {recipientCashiers.length === 0 && (
                              <span className="text-xs text-amber-700">No other active users found to transfer to.</span>
                            )}
                          </>
                        ) : (
                          <input
                            type="text"
                            className={fieldInputClass}
                            value={transferName}
                            onChange={(e) => setTransferName(e.target.value)}
                            placeholder="Accounts"
                          />
                        )}
                      </Field>
                      <Field label="Amount (GH₵)">
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          className={fieldInputClass}
                          value={transferAmount}
                          onChange={(e) => setTransferAmount(e.target.value)}
                        />
                      </Field>
                    </div>
                    <Button color="secondary" isLoading={transferring} onPress={handleTransfer}>
                      Record transfer
                    </Button>
                  </div>
                )}

                {modalError && <p className="text-sm text-danger">{modalError}</p>}
              </ModalBody>
              <ModalFooter className="flex flex-wrap gap-2">
                <Button color="danger" variant="light" isLoading={deleting} onPress={handleDelete}>
                  Delete
                </Button>
                <div className="flex-1" />
                {selected.status === 'closed' && (
                  <Button color="secondary" variant="flat" isLoading={saving} onPress={() => handleSaveEdit(true)}>
                    Re-sum sales
                  </Button>
                )}
                <Button color="primary" isLoading={saving} onPress={() => handleSaveEdit(false)}>
                  Save
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}
