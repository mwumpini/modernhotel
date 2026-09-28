'use client';

import React from 'react';
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
  balance: 92,
};

export default function StayWorksheetTable({
  stays,
  today,
  selectedId,
  sortKey,
  sortDir,
  onSort,
  onOpen,
  emptyContent = 'No stay matches these filters.',
}: {
  stays: Reservation[];
  today: string;
  selectedId?: string | null;
  sortKey: StaySortKey;
  sortDir: 'asc' | 'desc';
  onSort: (key: StaySortKey) => void;
  onOpen: (id: string) => void;
  emptyContent?: string;
}) {
  const cols = useResizableColumns<StaySortKey>(defaultColumnWidths);

  const column = (key: StaySortKey, label: string, align: 'left' | 'right' | 'center' = 'left') => (
    <TableColumn key={key} className="relative" style={cols.style(key)}>
      <SortLabel active={sortKey === key} dir={sortDir} align={align} onPress={() => onSort(key)}>{label}</SortLabel>
      {cols.sizer(key, label)}
    </TableColumn>
  );

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
      <TableHeader>
        {column('id', 'ID')}
        {column('guest', 'Guest')}
        {column('status', 'Status')}
        {column('room', 'Room')}
        {column('arrival', 'Check-in')}
        {column('departure', 'Check-out')}
        {column('nights', 'Nights', 'center')}
        {column('rate', 'Rate', 'right')}
        {column('discount', 'Discount', 'right')}
        {column('other', 'Other charges', 'right')}
        {column('amount', 'Amount', 'right')}
        {column('balance', 'Balance', 'right')}
      </TableHeader>
      <TableBody emptyContent={emptyContent}>
        {stays.map((stay) => {
          const status = deskStatus(stay, today);
          const figures = stayFigures(stay);
          const owed = stay.status === 'checked-in' && figures.balance > 0;
          const room = stay.roomId && stay.roomId !== 'TBD' ? stay.roomId : '';
          return (
            <TableRow
              key={stay.id}
              className={`cursor-pointer ${stay.id === selectedId ? 'bg-green-50 dark:bg-white/10' : 'hover:bg-gray-50'}`}
              onClick={() => onOpen(stay.id)}
            >
              <TableCell className="text-gray-600">{stay.resId || stay.id}</TableCell>
              <TableCell className="font-semibold text-ghana-black">
                <span className="block truncate" title={stay.guestName}>{stay.guestName}</span>
              </TableCell>
              <TableCell>
                <Chip size="sm" variant="flat" color={status.color} className="max-w-full">{status.label}</Chip>
              </TableCell>
              <TableCell>
                {room ? (
                  <Chip size="sm" variant="flat" color="success">{room}</Chip>
                ) : (
                  <span className="block truncate text-gray-400" title="Unassigned">Unassigned</span>
                )}
              </TableCell>
              <TableCell>
                <div>{shortDay(stay.arrival)}</div>
                <div className="text-xs font-medium text-gray-700">{stayClock(stay, 'in')}</div>
              </TableCell>
              <TableCell>
                <div>{shortDay(stay.departure)}</div>
                <div className="text-xs font-medium text-gray-700">{stayClock(stay, 'out')}</div>
              </TableCell>
              <TableCell className="text-center tabular-nums">{figures.nights}</TableCell>
              <TableCell className="text-right tabular-nums">{money(figures.rate)}</TableCell>
              <TableCell className={`text-right tabular-nums ${figures.discount > 0 ? 'font-semibold text-green-700' : 'text-gray-400'}`}>{money(figures.discount)}</TableCell>
              <TableCell className={`text-right tabular-nums ${figures.other > 0 ? 'font-semibold text-ghana-black' : 'text-gray-400'}`}>{money(figures.other)}</TableCell>
              <TableCell className="text-right tabular-nums font-semibold">{money(figures.amount)}</TableCell>
              <TableCell className={`text-right tabular-nums font-semibold ${owed ? 'text-ghana-red' : ''}`}>{money(figures.balance)}</TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
    </div>
  );
}
