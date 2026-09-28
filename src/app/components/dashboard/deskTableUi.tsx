'use client';

import React from 'react';
import { worksheetTableClassNames } from '../frontoffice/StayWorksheetTable';

/** Clip the card so only the table base scrolls — avoids a second bar under pagination. */
export const deskTableCardClassName = 'min-w-0 overflow-hidden border-0 shadow-lg';
export const deskTableCardBodyClassName = 'overflow-x-hidden px-2 py-3';

export const deskTableClassNames = {
  ...worksheetTableClassNames,
  base: 'max-w-full overflow-x-auto',
  table: 'w-full min-w-max',
  th: `${worksheetTableClassNames.th} relative`,
};

export type ColumnSort = { column: string; direction: 'asc' | 'desc' };

export function toggleColumnSort(prev: ColumnSort, column: string): ColumnSort {
  return prev.column === column
    ? { column, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
    : { column, direction: 'asc' };
}

export function SortHeader({
  label,
  column,
  sort,
  onSort,
  align = 'left',
}: {
  label: string;
  column: string;
  sort: ColumnSort;
  onSort: (column: string) => void;
  align?: 'left' | 'right';
}) {
  const active = sort.column === column;
  return (
    <button
      type="button"
      className={`max-w-full truncate text-xs font-medium uppercase tracking-wide ${active ? 'text-ghana-black' : 'text-gray-500'} ${align === 'right' ? 'ml-auto block text-right' : 'text-left'}`}
      onClick={(e) => {
        e.stopPropagation();
        onSort(column);
      }}
    >
      {label}{active ? (sort.direction === 'asc' ? ' ↑' : ' ↓') : ''}
    </button>
  );
}

export const DESK_PAGE_SIZE = 10;
