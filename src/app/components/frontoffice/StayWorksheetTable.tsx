'use client';

import React, { useMemo } from 'react';
import { Chip, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow } from '@heroui/react';
import type { Reservation } from '../../lib/frontoffice/types';
import {
  deskStatus,
  money,
  shortDay,
  stayClock,
  stayFigures,
  type StaySortKey,
} from '../../lib/frontoffice/stayWorksheet';
import { SortLabel, unifiedTableClassNames, useResizableColumns } from './columnResize';

// Kept as its own export/name — 13+ other tables already import this
// constant — but it's just the shared unified look now, not a second copy of it.
export const worksheetTableClassNames = unifiedTableClassNames;

const defaultColumnWidths: Record<StaySortKey, number> = {
  id: 136,
  guest: 144,
  status: 120,
  room: 108,
  arrival: 100,
  departure: 100,
  nights: 72,
  rate: 88,
  discount: 96,
  other: 128,
  amount: 92,
  paid: 92,
  balance: 92,
};

type SheetColumn = StaySortKey | 'staff';

const withStaffWidths: Record<SheetColumn, number> = {
  ...defaultColumnWidths,
  staff: 140,
};

const BASE_COLUMNS: { key: StaySortKey; label: string; align?: 'left' | 'right' | 'center' }[] = [
  { key: 'id', label: 'ID' },
  { key: 'guest', label: 'Guest' },
  { key: 'status', label: 'Status' },
  { key: 'room', label: 'Room' },
  { key: 'arrival', label: 'Check-in' },
  { key: 'departure', label: 'Check-out' },
  { key: 'nights', label: 'Nights', align: 'center' },
  { key: 'rate', label: 'Rate', align: 'right' },
  { key: 'discount', label: 'Discount', align: 'right' },
  { key: 'other', label: 'Other charges', align: 'right' },
  { key: 'amount', label: 'Amount', align: 'right' },
  { key: 'paid', label: 'Paid', align: 'right' },
  { key: 'balance', label: 'Balance', align: 'right' },
];

export default function StayWorksheetTable({
  stays,
  today,
  selectedId,
  sortKey,
  sortDir,
  onSort,
  onStaffSort,
  staffOf,
  onOpen,
  emptyContent = 'No stay matches these filters.',
}: {
  stays: Reservation[];
  today: string;
  selectedId?: string | null;
  sortKey: string;
  sortDir: 'asc' | 'desc';
  onSort: (key: StaySortKey) => void;
  onStaffSort?: () => void;
  staffOf?: (stay: Reservation) => string;
  onOpen: (id: string) => void;
  emptyContent?: string;
}) {
  const showStaff = !!staffOf;
  const cols = useResizableColumns<SheetColumn>(showStaff ? withStaffWidths : defaultColumnWidths as Record<SheetColumn, number>);

  const columns = useMemo(() => {
    const list: { key: SheetColumn; label: string; align?: 'left' | 'right' | 'center' }[] = [...BASE_COLUMNS];
    if (showStaff) list.push({ key: 'staff', label: 'Staff' });
    return list;
  }, [showStaff]);

  return (
    <div ref={cols.frameRef} style={cols.frameStyle}>
    <Table
      aria-label="Stay worksheet"
      removeWrapper
      classNames={{
        ...worksheetTableClassNames,
        table: 'table-fixed w-[var(--col-table-width)] min-w-[var(--col-table-width)] max-w-none',
        th: `${worksheetTableClassNames.th} relative`,
        td: `${worksheetTableClassNames.td} overflow-hidden`,
      }}
    >
      <TableHeader columns={columns}>
        {(col) => (
          <TableColumn key={col.key} className="relative" style={cols.style(col.key)}>
            <SortLabel
              active={sortKey === col.key}
              dir={sortDir}
              align={col.align}
              onPress={() => (col.key === 'staff' ? onStaffSort?.() : onSort(col.key))}
            >
              {col.label}
            </SortLabel>
            {cols.sizer(col.key, col.label)}
          </TableColumn>
        )}
      </TableHeader>
      <TableBody emptyContent={emptyContent} items={stays}>
        {(stay) => {
          const status = deskStatus(stay, today);
          const figures = stayFigures(stay);
          const owed = stay.status === 'checked-in' && figures.balance > 0;
          const room = stay.roomId && stay.roomId !== 'TBD' ? stay.roomId : '';
          const staff = staffOf?.(stay) || '';
          const cells: Record<SheetColumn, React.ReactNode> = {
            id: <span className="text-gray-600">{stay.resId || stay.id}</span>,
            guest: (
              <span className="block truncate font-semibold text-ghana-black" title={stay.guestName}>{stay.guestName}</span>
            ),
            status: <Chip size="sm" variant="flat" color={status.color} className="max-w-full">{status.label}</Chip>,
            room: room ? (
              <Chip size="sm" variant="flat" color="success">{room}</Chip>
            ) : (
              <span className="block truncate text-gray-400" title="Unassigned">Unassigned</span>
            ),
            arrival: (
              <>
                <div>{shortDay(stay.arrival)}</div>
                <div className="text-xs font-medium text-gray-700">{stayClock(stay, 'in')}</div>
              </>
            ),
            departure: (
              <>
                <div>{shortDay(stay.departure)}</div>
                <div className="text-xs font-medium text-gray-700">{stayClock(stay, 'out')}</div>
              </>
            ),
            nights: <span className="block text-center tabular-nums">{figures.nights}</span>,
            rate: <span className="block text-right tabular-nums">{money(figures.rate)}</span>,
            discount: (
              <span className={`block text-right tabular-nums ${figures.discount > 0 ? 'font-semibold text-green-700' : 'text-gray-400'}`}>
                {money(figures.discount)}
              </span>
            ),
            other: (
              <span className={`block text-right tabular-nums ${figures.other > 0 ? 'font-semibold text-ghana-black' : 'text-gray-400'}`}>
                {money(figures.other)}
              </span>
            ),
            amount: <span className="block text-right tabular-nums font-semibold">{money(figures.amount)}</span>,
            paid: (
              <span className={`block text-right tabular-nums ${figures.paid > 0 ? 'font-semibold text-green-700' : 'text-gray-400'}`}>
                {money(figures.paid)}
              </span>
            ),
            balance: (
              <span className={`block text-right tabular-nums font-semibold ${owed ? 'text-ghana-red' : ''}`}>
                {money(figures.balance)}
              </span>
            ),
            staff: <span className="block truncate" title={staff || undefined}>{staff || '—'}</span>,
          };
          return (
            <TableRow
              key={stay.id}
              className={`cursor-pointer ${stay.id === selectedId ? 'bg-green-50 dark:bg-white/10' : 'hover:bg-gray-50'}`}
              onClick={() => onOpen(stay.id)}
            >
              {(columnKey) => (
                <TableCell>{cells[columnKey as SheetColumn]}</TableCell>
              )}
            </TableRow>
          );
        }}
      </TableBody>
    </Table>
    </div>
  );
}
