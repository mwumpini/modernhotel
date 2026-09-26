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

export const worksheetTableClassNames = {
  base: 'overflow-x-auto',
  table: 'w-full table-fixed',
  th: 'border-b border-gray-200 bg-gray-50 px-2 py-2.5 text-xs font-medium uppercase tracking-wide text-gray-500 whitespace-nowrap',
  td: 'border-b border-gray-100 px-2 py-2.5 align-middle whitespace-nowrap',
};

function SortLabel({
  active,
  dir,
  onPress,
  align = 'left',
  children,
}: {
  active: boolean;
  dir: 'asc' | 'desc';
  onPress: () => void;
  align?: 'left' | 'right';
  children: string;
}) {
  return (
    <button
      type="button"
      className={`font-semibold text-ghana-black ${align === 'right' ? 'ml-auto block' : ''}`}
      onClick={onPress}
    >
      {children}{active ? (dir === 'asc' ? ' ↑' : ' ↓') : ''}
    </button>
  );
}

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
  return (
    <Table
      aria-label="Stay worksheet"
      removeWrapper
      classNames={{
        ...worksheetTableClassNames,
        table: 'w-full min-w-[79rem] table-fixed',
        td: `${worksheetTableClassNames.td} overflow-hidden`,
      }}
    >
      <TableHeader>
        <TableColumn className="w-[8.5rem]">ID</TableColumn>
        <TableColumn className="w-[9rem]"><SortLabel active={sortKey === 'guest'} dir={sortDir} onPress={() => onSort('guest')}>Guest</SortLabel></TableColumn>
        <TableColumn className="w-[7.5rem]">Status</TableColumn>
        <TableColumn className="w-[6.75rem]"><SortLabel active={sortKey === 'room'} dir={sortDir} onPress={() => onSort('room')}>Room</SortLabel></TableColumn>
        <TableColumn className="w-[6.25rem]"><SortLabel active={sortKey === 'arrival'} dir={sortDir} onPress={() => onSort('arrival')}>Check-in</SortLabel></TableColumn>
        <TableColumn className="w-[6.25rem]"><SortLabel active={sortKey === 'departure'} dir={sortDir} onPress={() => onSort('departure')}>Check-out</SortLabel></TableColumn>
        <TableColumn className="w-[4rem] text-center"><span className="block w-full text-center">Nights</span></TableColumn>
        <TableColumn className="w-[5.5rem] text-right">Rate</TableColumn>
        <TableColumn className="w-[5.5rem] text-right">Discount</TableColumn>
        <TableColumn className="w-[8rem] text-right">Other charges</TableColumn>
        <TableColumn className="w-[5.75rem] text-right"><SortLabel active={sortKey === 'amount'} dir={sortDir} onPress={() => onSort('amount')} align="right">Amount</SortLabel></TableColumn>
        <TableColumn className="w-[5.75rem] text-right">Balance</TableColumn>
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
  );
}
