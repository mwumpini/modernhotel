'use client';

import React from 'react';
import {
  Card, CardBody, CardHeader, Button, Input, Select, SelectItem, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell,
  Chip, Divider, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter,
} from '@heroui/react';
import { useSession } from 'next-auth/react';
import { getClientTenantSubdomain } from '../lib/api/clientTenant';
import { useCashierShift, type ShiftPreview } from '../lib/frontoffice/useCashierShift';
import type { CashierOutlet, CashierShiftDTO } from '../lib/frontoffice/cashierShiftRepository';
import { PETTY_EXPENSES } from '../lib/frontoffice/pettyExpenses';
import { CASH_TILL_ID, defaultTillTypes, type TillType } from '../lib/frontoffice/tillTypes';
import { printDetailSheet, printSimpleReport } from '../lib/print/simpleReport';
import { DateFilterPills, matchesDateFilter, useDateFilter, type DateMode } from './fb/DateFilterPills';
import { SortLabel, deskResizableTableClassNames, rowClassNames, useResizableColumns } from './frontoffice/columnResize';
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

function fmtDay(iso?: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'numeric', day: 'numeric' });
}

function fmtTime(iso?: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function todayLocalISO() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function paidOutTotal(
  shift?: { paidOuts?: { amount: number; voidedAt?: string; method?: string }[] } | null,
  kind: 'all' | 'cash' | 'momo' = 'all',
) {
  return (shift?.paidOuts || [])
    .filter((row) => !row.voidedAt && (kind === 'momo' ? row.method === 'momo' : kind === 'cash' ? row.method !== 'momo' : true))
    .reduce((sum, row) => sum + row.amount, 0);
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

type PettyHistoryRow = {
  id: string;
  shiftId: string;
  businessDate: string;
  cashierName: string;
  expenseName: string;
  description: string;
  method: 'cash' | 'momo';
  momoTxnId?: string;
  paidTo?: string;
  paidToNumber?: string;
  amount: number;
  createdAt: string;
  voidedAt?: string;
  entryNumber?: string;
  canUndo: boolean;
};

type ExpenseCol = 'date' | 'txn' | 'cashier' | 'expense' | 'paidFrom' | 'amount' | 'paidTo' | 'status' | 'note';
type ShiftCol = 'date' | 'cashier' | 'status' | 'cash' | 'momo' | 'card' | 'other' | 'momoDiff' | 'expected' | 'counted' | 'variance' | 'float' | 'opened' | 'openTime' | 'closed' | 'closeTime';

const COL = {
  date: 118,
  time: 96,
  cashier: 156,
  status: 104,
  money: 118,
  paidFrom: 112,
  paidTo: 148,
  txn: 156,
  expense: 196,
  note: 220,
};

const EXPENSE_WIDTHS: Record<ExpenseCol, number> = {
  date: COL.date,
  txn: COL.txn,
  cashier: COL.cashier,
  expense: COL.expense,
  paidFrom: COL.paidFrom,
  amount: COL.money,
  paidTo: COL.paidTo,
  status: COL.status,
  note: COL.note,
};

const SHIFT_WIDTHS: Record<ShiftCol, number> = {
  date: COL.date,
  cashier: COL.cashier,
  status: COL.status,
  cash: COL.money,
  momo: COL.money,
  card: COL.money,
  other: COL.money,
  momoDiff: COL.money,
  expected: COL.money,
  counted: COL.money,
  variance: COL.money,
  float: COL.money,
  opened: COL.date,
  openTime: COL.time,
  closed: COL.date,
  closeTime: COL.time,
};

function compareValues(a: string | number | null, b: string | number | null) {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
}

function useColumnSort<K extends string>(initial: K) {
  const [sortKey, setSortKey] = React.useState<K>(initial);
  const [sortDir, setSortDir] = React.useState<'asc' | 'desc'>('desc');
  const onSort = (key: K) => {
    if (key === sortKey) setSortDir((dir) => (dir === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir('asc');
    }
  };
  return { sortKey, sortDir, onSort };
}

function SheetFrame<T extends { id: string }>({
  items,
  columns,
  widths,
  sortKey,
  sortDir,
  onSort,
  label,
  empty,
  flexKeys,
  renderRow,
}: {
  items: T[];
  columns: { key: string; label: string; align?: 'left' | 'right' }[];
  widths: Record<string, number>;
  sortKey: string;
  sortDir: 'asc' | 'desc';
  onSort: (key: string) => void;
  label: string;
  empty: string;
  flexKeys?: string[];
  renderRow: (item: T) => React.ReactElement;
}) {
  const cols = useResizableColumns(widths, { flexKeys });
  return (
    <div ref={cols.frameRef} style={{ ...cols.frameStyle, overflowX: 'auto' }}>
      <Table aria-label={label} removeWrapper classNames={deskResizableTableClassNames()}>
        <TableHeader columns={columns}>
          {(col) => (
            <TableColumn key={col.key} className="relative" style={cols.style(col.key)}>
              <SortLabel active={sortKey === col.key} dir={sortDir} align={col.align} onPress={() => onSort(col.key)}>
                {col.label}
              </SortLabel>
              {cols.sizer(col.key, col.label)}
            </TableColumn>
          )}
        </TableHeader>
        <TableBody emptyContent={empty} items={items}>
          {(item) => renderRow(item)}
        </TableBody>
      </Table>
    </div>
  );
}

function ExpenseSheet({
  rows,
  selectedId,
  onOpen,
}: {
  rows: PettyHistoryRow[];
  selectedId?: string | null;
  onOpen: (row: PettyHistoryRow) => void;
}) {
  const { sortKey, sortDir, onSort } = useColumnSort<ExpenseCol>('date');
  const columns: { key: ExpenseCol; label: string; align?: 'left' | 'right' }[] = [
    { key: 'date', label: 'Date' },
    { key: 'txn', label: 'Transaction ID' },
    { key: 'cashier', label: 'Cashier' },
    { key: 'expense', label: 'Expense' },
    { key: 'paidFrom', label: 'Paid from' },
    { key: 'amount', label: 'Amount', align: 'right' },
    { key: 'paidTo', label: 'Paid to' },
    { key: 'status', label: 'Status' },
    { key: 'note', label: 'What it was for' },
  ];
  const valueOf = (row: PettyHistoryRow, key: ExpenseCol): string | number | null => {
    if (key === 'date') return row.businessDate || row.createdAt;
    if (key === 'txn') return row.momoTxnId || null;
    if (key === 'cashier') return row.cashierName;
    if (key === 'expense') return row.expenseName;
    if (key === 'paidFrom') return row.method === 'momo' ? 'MoMo' : 'Cash';
    if (key === 'amount') return row.amount;
    if (key === 'paidTo') return row.paidTo || null;
    if (key === 'note') return row.description;
    return row.voidedAt ? 'Voided' : 'Posted';
  };
  const sorted = [...rows].sort((a, b) => {
    const diff = compareValues(valueOf(a, sortKey), valueOf(b, sortKey));
    return sortDir === 'asc' ? diff : -diff;
  });
  return (
    <SheetFrame
      items={sorted}
      columns={columns}
      widths={EXPENSE_WIDTHS}
      flexKeys={['note', 'expense', 'txn', 'cashier', 'paidTo']}
      sortKey={sortKey}
      sortDir={sortDir}
      onSort={(key) => onSort(key as ExpenseCol)}
      label="Petty expenses"
      empty="No petty expenses match."
      renderRow={(row) => {
        const cells: Record<ExpenseCol, React.ReactNode> = {
          date: <span className="tabular-nums">{row.businessDate || '—'}</span>,
          txn: <span className="block truncate" title={row.momoTxnId || undefined}>{row.momoTxnId || '—'}</span>,
          cashier: <span className="block truncate" title={row.cashierName}>{row.cashierName}</span>,
          expense: <span className="block truncate" title={row.expenseName}>{row.expenseName}</span>,
          paidFrom: row.method === 'momo' ? 'MoMo' : 'Cash',
          amount: <span className={`block text-right font-semibold tabular-nums ${row.voidedAt ? 'text-gray-400 line-through' : ''}`}>{money(row.amount)}</span>,
          paidTo: <span className="block truncate" title={row.paidTo || undefined}>{row.paidTo || '—'}</span>,
          status: <Chip size="sm" variant="flat" color={row.voidedAt ? 'default' : 'success'}>{row.voidedAt ? 'Voided' : 'Posted'}</Chip>,
          note: <span className="block truncate" title={row.description}>{row.description}</span>,
        };
        return (
          <TableRow key={row.id} className={rowClassNames(row.id === selectedId)} onClick={() => onOpen(row)}>
            {(columnKey) => <TableCell>{cells[columnKey as ExpenseCol]}</TableCell>}
          </TableRow>
        );
      }}
    />
  );
}

function ShiftSheet({
  rows,
  selectedId,
  onOpen,
  empty,
}: {
  rows: CashierShiftDTO[];
  selectedId?: string | null;
  onOpen: (row: CashierShiftDTO) => void;
  empty: string;
}) {
  const { sortKey, sortDir, onSort } = useColumnSort<ShiftCol>('date');
  const columns: { key: ShiftCol; label: string; align?: 'left' | 'right' }[] = [
    { key: 'date', label: 'Date' },
    { key: 'cashier', label: 'Cashier' },
    { key: 'status', label: 'Status' },
    { key: 'cash', label: 'Cash', align: 'right' },
    { key: 'momo', label: 'MoMo', align: 'right' },
    { key: 'card', label: 'Card', align: 'right' },
    { key: 'other', label: 'Other', align: 'right' },
    { key: 'momoDiff', label: 'MoMo diff', align: 'right' },
    { key: 'expected', label: 'Expected', align: 'right' },
    { key: 'counted', label: 'Counted', align: 'right' },
    { key: 'variance', label: 'Variance', align: 'right' },
    { key: 'float', label: 'Float', align: 'right' },
    { key: 'opened', label: 'Opened' },
    { key: 'openTime', label: 'Open time' },
    { key: 'closed', label: 'Closed' },
    { key: 'closeTime', label: 'Close time' },
  ];
  const valueOf = (row: CashierShiftDTO, key: ShiftCol): string | number | null => {
    if (key === 'date') return row.businessDate || row.openedAt;
    if (key === 'cashier') return row.cashierName;
    if (key === 'status') return row.status;
    if (key === 'cash') return row.totalCash ?? null;
    if (key === 'momo') return row.totalMobileMoney ?? null;
    if (key === 'card') return row.totalCard ?? null;
    if (key === 'other') return row.totalOther ?? null;
    if (key === 'momoDiff') return row.momoVariance ?? null;
    if (key === 'expected') return row.expectedCash ?? null;
    if (key === 'counted') return row.closingCount ?? null;
    if (key === 'variance') return row.variance ?? null;
    if (key === 'float') return row.openingFloat;
    if (key === 'opened' || key === 'openTime') return row.openedAt;
    return row.closedAt || null;
  };
  const sorted = [...rows].sort((a, b) => {
    const diff = compareValues(valueOf(a, sortKey), valueOf(b, sortKey));
    return sortDir === 'asc' ? diff : -diff;
  });
  const moneyCell = (n?: number | null, strike = false) => (
    <span className={`block text-right tabular-nums ${strike ? 'text-gray-400' : ''}`}>{n == null ? '—' : money(n)}</span>
  );
  return (
    <SheetFrame
      items={sorted}
      columns={columns}
      widths={SHIFT_WIDTHS}
      flexKeys={['cashier']}
      sortKey={sortKey}
      sortDir={sortDir}
      onSort={(key) => onSort(key as ShiftCol)}
      label="Cashier shifts"
      empty={empty}
      renderRow={(row) => {
        const cells: Record<ShiftCol, React.ReactNode> = {
          date: <span className="tabular-nums">{row.businessDate || '—'}</span>,
          cashier: <span className="block font-semibold text-ghana-black">{row.cashierName}</span>,
          status: <Chip size="sm" variant="flat" color={row.status === 'open' ? 'warning' : 'default'}>{row.status}</Chip>,
          cash: moneyCell(row.totalCash),
          momo: moneyCell(row.totalMobileMoney),
          card: moneyCell(row.totalCard),
          other: moneyCell(row.totalOther),
          momoDiff: row.momoVariance == null
            ? <span className="block text-right text-gray-400">—</span>
            : <span className={`block text-right tabular-nums ${row.momoVariance === 0 ? 'text-success' : 'text-danger'}`}>{signedMoney(row.momoVariance)}</span>,
          expected: moneyCell(row.expectedCash),
          counted: moneyCell(row.closingCount),
          variance: row.variance == null
            ? <span className="block text-right text-gray-400">—</span>
            : <span className={`block text-right tabular-nums ${row.variance === 0 ? 'text-success' : 'text-danger'}`}>{signedMoney(row.variance)}</span>,
          float: moneyCell(row.openingFloat),
          opened: <span className="tabular-nums">{fmtDay(row.openedAt)}</span>,
          openTime: <span className="tabular-nums">{fmtTime(row.openedAt)}</span>,
          closed: <span className="tabular-nums">{row.closedAt ? fmtDay(row.closedAt) : '—'}</span>,
          closeTime: <span className="tabular-nums">{row.closedAt ? fmtTime(row.closedAt) : '—'}</span>,
        };
        return (
          <TableRow key={row.id} className={rowClassNames(row.id === selectedId)} onClick={() => onOpen(row)}>
            {(columnKey) => <TableCell>{cells[columnKey as ShiftCol]}</TableCell>}
          </TableRow>
        );
      }}
    />
  );
}

function ListTools({
  query,
  onQuery,
  placeholder,
  filters,
  filter,
  onFilter,
  dateMode,
  onDateMode,
  single,
  onSingle,
  from,
  onFrom,
  to,
  onTo,
  countLabel,
  children,
}: {
  query: string;
  onQuery: (value: string) => void;
  placeholder: string;
  filters: { key: string; label: string }[];
  filter: string;
  onFilter: (key: string) => void;
  dateMode: DateMode;
  onDateMode: (mode: DateMode) => void;
  single: string;
  onSingle: (value: string) => void;
  from: string;
  onFrom: (value: string) => void;
  to: string;
  onTo: (value: string) => void;
  countLabel: string;
  children?: React.ReactNode;
}) {
  return (
    <Card className="border-0 shadow-lg">
      <CardBody className="space-y-2 px-3 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            size="sm"
            placeholder={placeholder}
            value={query}
            onValueChange={onQuery}
            startContent={<span className="text-gray-400">🔍</span>}
            isClearable
            onClear={() => onQuery('')}
            aria-label={placeholder}
            className="min-w-[14rem] grow basis-[16rem]"
          />
          {children}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {filters.map((item) => (
            <Button
              key={item.key}
              size="sm"
              color={filter === item.key ? 'primary' : 'default'}
              variant={filter === item.key ? 'solid' : 'flat'}
              onPress={() => onFilter(item.key)}
            >
              {item.label}
            </Button>
          ))}
          {dateMode !== 'all' && <span className="text-xs text-gray-500">{countLabel}</span>}
          <div className="ml-auto">
            <DateFilterPills
              mode={dateMode}
              onMode={onDateMode}
              single={single}
              onSingle={onSingle}
              from={from}
              onFrom={onFrom}
              to={to}
              onTo={onTo}
            />
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

export default function CashierShiftPanel({
  outlet = 'frontoffice',
}: {
  outlet?: CashierOutlet;
} = {}) {
  const { data: session } = useSession();
  const allowBackdating = useSettingsStore((s) => s.roomManagement.allowBackdating === true);
  const canVoidPetty = useSettingsStore((s) =>
    s.hasPermission(outlet === 'restaurant' ? 'restaurant.void-petty' : 'frontdesk.void-petty'),
  );
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
  const [pettyTillId, setPettyTillId] = React.useState(CASH_TILL_ID);
  const [tillTypes, setTillTypes] = React.useState<TillType[]>(() => defaultTillTypes());
  const [openLines, setOpenLines] = React.useState<Record<string, { amount: string; note: string }>>({});
  const [tillCounts, setTillCounts] = React.useState<Record<string, string>>({});
  const [momoTxnId, setMomoTxnId] = React.useState('');
  const [paidTo, setPaidTo] = React.useState('');
  const [paidToNumber, setPaidToNumber] = React.useState('');
  const [expenseOpen, setExpenseOpen] = React.useState(false);
  const [cashierPage, setCashierPage] = React.useState<'till' | 'petty'>('till');
  const [tillQuery, setTillQuery] = React.useState('');
  const [pettyQuery, setPettyQuery] = React.useState('');
  const [tillView, setTillView] = React.useState<'all' | 'open' | 'closed'>('all');
  const [pettyView, setPettyView] = React.useState<'all' | 'posted' | 'voided'>('all');
  const [tillFormOpen, setTillFormOpen] = React.useState(false);
  const [openExpense, setOpenExpense] = React.useState<PettyHistoryRow | null>(null);
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
    let cancel = false;
    fetch('/api/frontoffice/till-types', {
      headers: { 'x-tenant-subdomain': getClientTenantSubdomain() },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancel && Array.isArray(data?.tills) && data.tills.length) setTillTypes(data.tills);
      })
      .catch(() => { /* the cash row stays available if settings cannot load */ });
    return () => { cancel = true; };
  }, []);

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
    if (!/^\d{4}-\d{2}-\d{2}$/.test(businessDate)) { setOpenError('Pick a valid business date.'); return; }
    const backdate = postingDateError(businessDate, allowBackdating);
    if (backdate) { setOpenError(backdate); return; }
    const tills = tillTypes.filter((till) => till.active).map((till) => {
      const amount = parseFloat(openLines[till.id]?.amount ?? '');
      return { till, amount, note: openLines[till.id]?.note?.trim() || '' };
    });
    const missing = tills.find((row) => isNaN(row.amount) || row.amount < 0);
    if (missing) { setOpenError(`Enter the opening amount for ${missing.till.name}.`); return; }
    const cash = tills.find((row) => row.till.id === CASH_TILL_ID);
    setOpening(true);
    setOpenError(null);
    const result = await openShift(
      cash?.amount ?? 0,
      cash?.note,
      businessDate,
      tills.map((row) => ({ tillId: row.till.id, opening: row.amount, note: row.note })),
    );
    setOpening(false);
    if (!result.ok) { setOpenError(result.error || 'Failed to open shift.'); return; }
    setTillFormOpen(false);
    setOpenLines({});
    setOpeningFloat('');
    setOpenNotes('');
  };

  const spendChoices = React.useMemo(() => {
    const lines = myOpenShift?.tillLines || [];
    if (lines.length) {
      return lines
        .filter((line) => {
          const type = tillTypes.find((till) => till.id === line.tillId);
          return type ? type.spend : line.kind === 'cash';
        })
        .map((line) => ({ id: line.tillId, name: line.name, kind: line.kind }));
    }
    const choices: Array<{ id: string; name: string; kind: 'cash' | 'momo' }> = [];
    const cash = tillTypes.find((till) => till.id === CASH_TILL_ID);
    if (cash?.spend) choices.push({ id: CASH_TILL_ID, name: cash.name || 'Cash', kind: 'cash' });
    if (tillTypes.some((till) => till.kind === 'momo' && till.spend)) {
      choices.push({ id: 'momo', name: 'MoMo', kind: 'momo' });
    }
    return choices;
  }, [myOpenShift?.tillLines, tillTypes]);
  const pettyAllowed = tillTypes.some((till) => till.spend);

  React.useEffect(() => {
    if (!spendChoices.some((row) => row.id === pettyTillId)) setPettyTillId(spendChoices[0]?.id || CASH_TILL_ID);
  }, [spendChoices, pettyTillId]);

  React.useEffect(() => {
    if (!pettyAllowed && cashierPage === 'petty') setCashierPage('till');
  }, [pettyAllowed, cashierPage]);

  const handlePaidOut = async () => {
    if (!myOpenShift) return;
    const amount = parseFloat(pettyAmount);
    if (isNaN(amount) || amount <= 0) { setPettyError('Enter the amount.'); return; }
    if (!pettyNote.trim()) { setPettyError('Say what it was for.'); return; }
    const payingFrom = spendChoices.find((row) => row.id === pettyTillId) || spendChoices[0];
    if (!payingFrom) { setPettyError('No till can pay this expense.'); return; }
    const payingMomo = payingFrom?.kind === 'momo';
    if (!paidTo.trim()) { setPettyError('Say who was paid.'); return; }
    const digits = paidToNumber.replace(/\D/g, '');
    if (digits.length < 9 || digits.length > 15) { setPettyError('Enter the number.'); return; }
    if (payingMomo && !momoTxnId.trim()) { setPettyError('Enter the MoMo transaction ID.'); return; }
    setPettyBusy(true);
    setPettyError(null);
    const result = await recordPaidOut(myOpenShift.id, {
      amount,
      expenseCode: pettyCode,
      description: pettyNote.trim(),
      method: payingMomo ? 'momo' : 'cash',
      tillId: payingFrom && payingFrom.id !== 'momo' ? payingFrom.id : undefined,
      momoTxnId: payingMomo ? momoTxnId.trim() : undefined,
      paidTo: paidTo.trim(),
      paidToNumber: paidToNumber.trim(),
    });
    setPettyBusy(false);
    if (!result.ok) { setPettyError(result.error || 'Could not record the expense.'); return; }
    setPettyAmount('');
    setPettyNote('');
    setMomoTxnId('');
    setPaidTo('');
    setPaidToNumber('');
    setExpenseOpen(false);
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
    const opened = myOpenShift.tillLines || [];
    let cashCount = parseFloat(closingCount);
    let momoVal = parseFloat(momoOnDevice);
    let counts: Array<{ tillId: string; amount: number }> | undefined;
    if (opened.length) {
      counts = [];
      for (const line of opened) {
        const amount = parseFloat(tillCounts[line.tillId] ?? '');
        if (isNaN(amount) || amount < 0) { setCloseError(`Count ${line.name}.`); return; }
        counts.push({ tillId: line.tillId, amount });
        if (line.kind === 'cash') cashCount = amount;
      }
      momoVal = opened.filter((line) => line.kind === 'momo').reduce((sum, line) => sum + parseFloat(tillCounts[line.tillId] || '0'), 0);
    } else {
      if (isNaN(cashCount) || cashCount < 0) { setCloseError('Enter a valid closing count.'); return; }
      if (isNaN(momoVal) || momoVal < 0) { setCloseError('Enter the amount received on the MoMo device.'); return; }
    }
    setClosing(true);
    setCloseError(null);
    const result = await closeShift(myOpenShift.id, cashCount, closeNotes || undefined, opened.length ? undefined : momoVal, counts);
    setClosing(false);
    if (!result.ok) { setCloseError(result.error || 'Failed to close shift.'); return; }
    setClosingCount('');
    setMomoOnDevice('');
    setTillCounts({});
    setCloseNotes('');
    setTillFormOpen(false);
    setCashierPage('till');
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

  const printExpense = (slip: {
    paidFrom: 'cash' | 'momo';
    amount: string;
    expense: string;
    description: string;
    paidTo: string;
    number: string;
    txnId?: string;
    entryNumber?: string;
    cashier?: string;
    when?: string;
    status?: string;
  }) => {
    const fields: Array<{ label: string; value: string }> = [
      { label: 'Entry', value: slip.entryNumber || '—' },
      { label: 'Paid from', value: slip.paidFrom === 'momo' ? 'MoMo' : 'Cash' },
      { label: 'Amount', value: slip.amount || '—' },
      { label: 'Expense', value: slip.expense || '—' },
      { label: 'What it was for', value: slip.description || '—' },
      { label: 'Paid to', value: slip.paidTo || '—' },
      { label: 'Number', value: slip.number || '—' },
    ];
    if (slip.paidFrom === 'momo') fields.push({ label: 'Transaction ID', value: slip.txnId || '—' });
    if (slip.cashier) fields.push({ label: 'Cashier', value: slip.cashier });
    if (slip.when) fields.push({ label: 'When', value: slip.when });
    if (slip.status) fields.push({ label: 'Status', value: slip.status });
    printDetailSheet('Petty expense', fields, slip.cashier || '');
  };

  const printHistory = () => {
    printSimpleReport(
      `${title} — Shift History`,
      `${shownShifts.length} shift${shownShifts.length === 1 ? '' : 's'}`,
      ['Business Date', 'Cashier', 'Opened', 'Closed', 'Float', 'Cash sales', 'Expected', 'Counted', 'Variance', 'MoMo', 'Card', 'Other', 'MoMo on device', 'MoMo difference', 'Transfer', 'Status'],
      shownShifts.map((s) => [
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
  const livePaidOut = paidOutTotal(myOpenShift, 'cash');
  const liveMomoOut = paidOutTotal(myOpenShift, 'momo');
  const liveExpected = myOpenShift ? myOpenShift.openingFloat + liveCash - livePaidOut : 0;
  const liveMomo = livePreview?.totalMobileMoney ?? 0;
  const openedMomo = (myOpenShift?.tillLines || []).filter((line) => line.kind === 'momo');
  const liveMomoExpected = openedMomo.reduce((sum, line) => sum + line.opening, 0) + liveMomo - liveMomoOut;
  const liveCard = livePreview?.totalCard ?? 0;
  const liveOther = livePreview?.totalOther ?? 0;
  const countedMomo = openedMomo.length && openedMomo.every((line) => tillCounts[line.tillId] !== undefined && tillCounts[line.tillId] !== '' && !isNaN(parseFloat(tillCounts[line.tillId])))
    ? openedMomo.reduce((sum, line) => sum + parseFloat(tillCounts[line.tillId]), 0)
    : null;
  const typedMomo = openedMomo.length ? countedMomo : (momoOnDevice !== '' && !isNaN(parseFloat(momoOnDevice)) ? parseFloat(momoOnDevice) : null);
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

  const pettyHistory = React.useMemo(() => {
    const rows: PettyHistoryRow[] = [];
    for (const shift of shifts) {
      for (const row of shift.paidOuts || []) {
        rows.push({
          id: row.id,
          shiftId: shift.id,
          businessDate: shift.businessDate,
          cashierName: shift.cashierName,
          expenseName: row.expenseName,
          description: row.description,
          method: row.method === 'momo' ? 'momo' : 'cash',
          momoTxnId: row.momoTxnId,
          paidTo: row.paidTo,
          paidToNumber: row.paidToNumber,
          amount: row.amount,
          createdAt: row.createdAt,
          voidedAt: row.voidedAt,
          entryNumber: row.entryNumber,
          canUndo: canVoidPetty && shift.status === 'open' && shift.id === myOpenShift?.id && !row.voidedAt,
        });
      }
    }
    rows.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    return rows;
  }, [shifts, myOpenShift?.id, canVoidPetty]);

  const shownShifts = React.useMemo(() => {
    const q = tillQuery.trim().toLowerCase();
    return filteredShifts.filter((shift) => {
      if (tillView !== 'all' && shift.status !== tillView) return false;
      if (!q) return true;
      return [shift.cashierName, shift.businessDate, shift.status].join(' ').toLowerCase().includes(q);
    });
  }, [filteredShifts, tillQuery, tillView]);

  const shownExpenses = React.useMemo(() => {
    const q = pettyQuery.trim().toLowerCase();
    return pettyHistory.filter((row) => {
      if (!matchesDateFilter(row.businessDate, dateFilter.mode, dateFilter.single, dateFilter.from, dateFilter.to)) return false;
      if (pettyView === 'posted' && row.voidedAt) return false;
      if (pettyView === 'voided' && !row.voidedAt) return false;
      if (!q) return true;
      return [row.cashierName, row.expenseName, row.description, row.method === 'momo' ? 'momo' : 'cash', row.paidTo, row.paidToNumber, row.momoTxnId].join(' ').toLowerCase().includes(q);
    });
  }, [pettyHistory, pettyQuery, pettyView, dateFilter.mode, dateFilter.single, dateFilter.from, dateFilter.to]);

  const viewedExpense = openExpense ? pettyHistory.find((row) => row.id === openExpense.id) ?? null : null;

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

  return (
    <div className="p-2 space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button color="primary" variant={cashierPage === 'till' ? 'solid' : 'flat'} onPress={() => setCashierPage('till')}>
          Till
        </Button>
        {pettyAllowed && (
          <Button color="primary" variant={cashierPage === 'petty' ? 'solid' : 'flat'} onPress={() => setCashierPage('petty')}>
            Petty expense
          </Button>
        )}
        {myOpenShift && (
          <span className="text-sm text-gray-600">
            Open · {myOpenShift.cashierName} · expected {money(liveExpected)}
          </span>
        )}
      </div>

      <Modal isOpen={tillFormOpen} onClose={() => setTillFormOpen(false)} size="3xl" scrollBehavior="inside">
        <ModalContent>
          <ModalHeader>{myOpenShift ? `Till — ${myOpenShift.cashierName}` : `Open ${title}`}</ModalHeader>
          <ModalBody className="gap-4">
      {!myOpenShift ? (
        <div className="space-y-3">
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
            {tillTypes.filter((till) => till.active).map((till) => (
              <div key={till.id} className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div className="flex items-end pb-2">
                  <p className="text-sm font-medium text-gray-700">{till.name}</p>
                </div>
                <Field label="Opening amount (GH₵)">
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    className={fieldInputClass}
                    value={openLines[till.id]?.amount ?? ''}
                    onChange={(e) => setOpenLines((rows) => ({ ...rows, [till.id]: { amount: e.target.value, note: rows[till.id]?.note ?? '' } }))}
                    placeholder="0.00"
                  />
                </Field>
                <Field label="Notes (optional)">
                  <input
                    type="text"
                    className={fieldInputClass}
                    value={openLines[till.id]?.note ?? ''}
                    onChange={(e) => setOpenLines((rows) => ({ ...rows, [till.id]: { amount: rows[till.id]?.amount ?? '', note: e.target.value } }))}
                    placeholder="Optional"
                  />
                </Field>
              </div>
            ))}
            {openError && <p className="text-sm text-danger">{openError}</p>}
            <Button color="success" isLoading={opening} isDisabled={!businessDate || tillTypes.filter((till) => till.active).some((till) => openLines[till.id]?.amount === undefined || openLines[till.id]?.amount === '')} onPress={handleOpen}>
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
                variance={typedMomo == null ? null : typedMomo - liveMomoExpected}
              />
            </div>
            {liveMomoOut > 0 && (
              <p className="text-sm text-gray-500">MoMo expenses of {money(liveMomoOut)} have already left the device. Count what is still on it.</p>
            )}
            <Divider />
            {myOpenShift.tillLines?.length ? (
              <div className="space-y-3">
                {myOpenShift.tillLines.map((line) => (
                  <div key={line.tillId} className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    <div className="flex flex-col justify-end pb-2">
                      <p className="text-sm font-medium text-gray-700">{line.name}</p>
                      <p className="text-xs text-gray-500">Opening {money(line.opening)}</p>
                    </div>
                    <Field label="Count (GH₵)">
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        className={fieldInputClass}
                        value={tillCounts[line.tillId] ?? ''}
                        onChange={(e) => setTillCounts((rows) => ({ ...rows, [line.tillId]: e.target.value }))}
                        placeholder="0.00"
                      />
                    </Field>
                    <Field label="Note">
                      <input type="text" className={fieldInputClass} value={line.note || ''} disabled />
                    </Field>
                  </div>
                ))}
              </div>
            ) : (
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
            )}
            {closeError && <p className="text-sm text-danger">{closeError}</p>}
            <Button color="warning" isLoading={closing} isDisabled={myOpenShift.tillLines?.length ? myOpenShift.tillLines.some((line) => tillCounts[line.tillId] === undefined || tillCounts[line.tillId] === '') : (!closingCount || !momoReady)} onPress={handleClose}>
              Close &amp; Reconcile
            </Button>
        </div>
      )}
          </ModalBody>
        </ModalContent>
      </Modal>

      {cashierPage === 'petty' && (
        <>
          <ListTools
            query={pettyQuery}
            onQuery={setPettyQuery}
            placeholder="Search cashier, expense, or what it was for"
            filters={[
              { key: 'all', label: 'All' },
              { key: 'posted', label: 'Posted' },
              { key: 'voided', label: 'Voided' },
            ]}
            filter={pettyView}
            onFilter={(key) => setPettyView(key as 'all' | 'posted' | 'voided')}
            dateMode={dateFilter.mode}
            onDateMode={dateFilter.setMode}
            single={dateFilter.single}
            onSingle={dateFilter.setSingle}
            from={dateFilter.from}
            onFrom={dateFilter.setFrom}
            to={dateFilter.to}
            onTo={dateFilter.setTo}
            countLabel={shownExpenses.length === 1 ? '1 expense' : `${shownExpenses.length} expenses`}
          >
            <Button color="primary" className="ml-auto shrink-0" onPress={() => { setPettyError(null); setExpenseOpen(true); }}>
              New expense
            </Button>
          </ListTools>
          <Card className="border-0 shadow-lg">
            <CardBody className="px-2 py-3">
              <ExpenseSheet rows={shownExpenses} selectedId={openExpense?.id} onOpen={setOpenExpense} />
            </CardBody>
          </Card>
        </>
      )}

      <Modal isOpen={expenseOpen} onClose={() => setExpenseOpen(false)} size="lg" scrollBehavior="inside">
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader>New expense</ModalHeader>
              <ModalBody className="gap-4">
                {!myOpenShift ? (
                  <p className="text-sm text-gray-600">Open a till first. The expense is recorded on that shift.</p>
                ) : (
                  <>
                    <p className="text-sm text-gray-500">
                      {myOpenShift.cashierName} · expected cash {money(liveExpected)}
                    </p>
                    <div>
                      <p className="mb-2 text-sm font-medium text-gray-600">Paid from</p>
                      <div className="flex flex-wrap gap-2">
                        {spendChoices.map((choice) => (
                          <Button key={choice.id} size="sm" color="primary" variant={pettyTillId === choice.id ? 'solid' : 'flat'} onPress={() => setPettyTillId(choice.id)}>{choice.name}</Button>
                        ))}
                      </div>
                    </div>
                    <p className="text-sm text-gray-500">
                      {(spendChoices.find((row) => row.id === pettyTillId) || spendChoices[0])?.kind === 'momo'
                        ? `This leaves ${(spendChoices.find((row) => row.id === pettyTillId) || spendChoices[0])?.name}. The cash drawer does not change.`
                        : 'This leaves the cash drawer.'}
                    </p>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-[9rem_1fr]">
                      <Field label="Amount (GH₵)">
                        <input type="number" min={0} step="0.01" className={fieldInputClass} value={pettyAmount} onChange={(e) => setPettyAmount(e.target.value)} placeholder="0.00" />
                      </Field>
                      <Field label="What it was for">
                        <input type="text" className={fieldInputClass} value={pettyNote} onChange={(e) => setPettyNote(e.target.value)} placeholder="Taxi to the bank, guest cards, fuel" />
                      </Field>
                    </div>
                    <Select
                      label="Expense"
                      labelPlacement="outside"
                      placeholder="Choose an expense"
                      selectedKeys={pettyCode ? [pettyCode] : []}
                      disallowEmptySelection
                      onSelectionChange={(keys) => {
                        const next = Array.from(keys)[0];
                        if (typeof next === 'string') setPettyCode(next);
                      }}
                      classNames={{
                        label: 'text-sm font-medium text-gray-600',
                        trigger: 'h-10 min-h-10 border border-default-300 bg-white shadow-none',
                        value: 'text-sm',
                      }}
                    >
                      {PETTY_EXPENSES.map((row) => (
                        <SelectItem key={row.code}>{row.name}</SelectItem>
                      ))}
                    </Select>
                    {(spendChoices.find((row) => row.id === pettyTillId) || spendChoices[0])?.kind === 'momo' && (
                      <Field label="Transaction ID">
                        <input type="text" className={fieldInputClass} value={momoTxnId} onChange={(e) => setMomoTxnId(e.target.value)} placeholder="MoMo receipt number" />
                      </Field>
                    )}
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <Field label="Paid to">
                        <input type="text" className={fieldInputClass} value={paidTo} onChange={(e) => setPaidTo(e.target.value)} placeholder="Who received it" />
                      </Field>
                      <Field label="Number">
                        <input type="tel" className={fieldInputClass} value={paidToNumber} onChange={(e) => setPaidToNumber(e.target.value)} placeholder="024 000 0000" />
                      </Field>
                    </div>
                    {pettyError && <p className="text-sm text-danger">{pettyError}</p>}
                  </>
                )}
              </ModalBody>
              <ModalFooter>
                {!myOpenShift ? (
                  <Button color="success" onPress={() => { onClose(); setCashierPage('till'); setTillFormOpen(true); }}>
                    Open till
                  </Button>
                ) : (
                  <>
                    <Button
                      variant="flat"
                      onPress={() => printExpense({
                        paidFrom: (spendChoices.find((row) => row.id === pettyTillId) || spendChoices[0])?.kind === 'momo' ? 'momo' : 'cash',
                        amount: pettyAmount ? money(parseFloat(pettyAmount) || 0) : '',
                        expense: PETTY_EXPENSES.find((row) => row.code === pettyCode)?.name || '',
                        description: pettyNote.trim(),
                        paidTo: paidTo.trim(),
                        number: paidToNumber.trim(),
                        txnId: momoTxnId.trim(),
                        cashier: myOpenShift.cashierName,
                      })}
                    >
                      Print
                    </Button>
                    <Button color="primary" isLoading={pettyBusy} isDisabled={!pettyAmount || !pettyNote.trim() || !paidTo.trim() || paidToNumber.replace(/\D/g, '').length < 9 || ((spendChoices.find((row) => row.id === pettyTillId) || spendChoices[0])?.kind === 'momo' && !momoTxnId.trim())} onPress={handlePaidOut}>
                      Record expense
                    </Button>
                  </>
                )}
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      <Modal isOpen={!!viewedExpense} onClose={() => setOpenExpense(null)} size="md">
        <ModalContent>
          {viewedExpense && (
            <>
              <ModalHeader className="flex flex-col gap-0.5">
                <span>{viewedExpense.expenseName}</span>
                <span className="text-sm font-normal text-gray-500">
                  {viewedExpense.businessDate} · {fmtTime(viewedExpense.createdAt)} · {viewedExpense.cashierName}
                </span>
              </ModalHeader>
              <ModalBody className="gap-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-gray-500">Entry</span>
                  <span className="font-mono">{viewedExpense.entryNumber || '—'}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-gray-500">Paid from</span>
                  <span>{viewedExpense.method === 'momo' ? 'MoMo' : 'Cash'}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-gray-500">Amount</span>
                  <span className={`font-semibold tabular-nums ${viewedExpense.voidedAt ? 'text-gray-400 line-through' : ''}`}>{money(viewedExpense.amount)}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-gray-500">Status</span>
                  <Chip size="sm" variant="flat" color={viewedExpense.voidedAt ? 'default' : 'success'}>{viewedExpense.voidedAt ? 'Voided' : 'Posted'}</Chip>
                </div>
                {viewedExpense.method === 'momo' && (
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-gray-500">Transaction ID</span>
                    <span>{viewedExpense.momoTxnId || '—'}</span>
                  </div>
                )}
                <div className="flex items-center justify-between gap-3">
                  <span className="text-gray-500">Paid to</span>
                  <span>{viewedExpense.paidTo || '—'}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-gray-500">Number</span>
                  <span>{viewedExpense.paidToNumber || '—'}</span>
                </div>
                <p>{viewedExpense.description}</p>
                <p className="text-xs text-gray-500">{fmtWhen(viewedExpense.createdAt)}</p>
              </ModalBody>
              <ModalFooter>
                <Button
                  variant="flat"
                  onPress={() => printExpense({
                    paidFrom: viewedExpense.method,
                    amount: money(viewedExpense.amount),
                    expense: viewedExpense.expenseName,
                    description: viewedExpense.description,
                    paidTo: viewedExpense.paidTo || '',
                    number: viewedExpense.paidToNumber || '',
                    txnId: viewedExpense.momoTxnId,
                    entryNumber: viewedExpense.entryNumber,
                    cashier: viewedExpense.cashierName,
                    when: fmtWhen(viewedExpense.createdAt),
                    status: viewedExpense.voidedAt ? 'Voided' : 'Posted',
                  })}
                >
                  Print
                </Button>
                {viewedExpense.canUndo && (
                  <Button color="danger" variant="flat" isLoading={pettyBusy} onPress={() => { void handleVoidPaidOut(viewedExpense.id); }}>
                    Undo
                  </Button>
                )}
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      {cashierPage === 'till' && (
      <>
      <ListTools
        query={tillQuery}
        onQuery={setTillQuery}
        placeholder="Search cashier or date"
        filters={[
          { key: 'all', label: 'All' },
          { key: 'open', label: 'Open' },
          { key: 'closed', label: 'Closed' },
        ]}
        filter={tillView}
        onFilter={(key) => setTillView(key as 'all' | 'open' | 'closed')}
        dateMode={dateFilter.mode}
        onDateMode={dateFilter.setMode}
        single={dateFilter.single}
        onSingle={dateFilter.setSingle}
        from={dateFilter.from}
        onFrom={dateFilter.setFrom}
        to={dateFilter.to}
        onTo={dateFilter.setTo}
        countLabel={shownShifts.length === 1 ? '1 shift' : `${shownShifts.length} shifts`}
      >
        <Button size="sm" variant="flat" className="shrink-0" onPress={printHistory}>Print</Button>
        <Button color={myOpenShift ? 'warning' : 'success'} className="ml-auto shrink-0" onPress={() => setTillFormOpen(true)}>
          {myOpenShift ? 'Close till' : 'Open till'}
        </Button>
      </ListTools>
      <Card>
        <CardHeader>
          <div className="font-medium">Cash and payments</div>
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

      <Card className="border-0 shadow-lg">
        <CardBody className="px-2 py-3">
          <ShiftSheet
            rows={shownShifts}
            selectedId={selected?.id}
            onOpen={openDetail}
            empty={loading ? 'Loading…' : shifts.length > 0 ? 'No shifts match.' : 'No cashier shifts yet.'}
          />
        </CardBody>
      </Card>
      </>
      )}

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
                    paidOut={paidOutTotal(selected, 'cash')}
                    expected={(Number(editFloat) || selected.openingFloat) + (selected.totalCash ?? 0) - paidOutTotal(selected, 'cash')}
                    counted={editCount !== '' && !isNaN(parseFloat(editCount)) ? parseFloat(editCount) : selected.closingCount}
                    variance={
                      editCount !== '' && !isNaN(parseFloat(editCount))
                        ? parseFloat(editCount) - ((Number(editFloat) || selected.openingFloat) + (selected.totalCash ?? 0) - paidOutTotal(selected, 'cash'))
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
                        ? parseFloat(editMomo) - ((selected.totalMobileMoney ?? 0) - paidOutTotal(selected, 'momo'))
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
