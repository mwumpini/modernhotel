'use client';

import { TableColumn } from '@heroui/react';
import { SortLabel, useResizableColumns } from './columnResize';

export const FOLIO_PAGE_SIZE = 4;

export type FolioAccountCol = 'date' | 'description' | 'reference' | 'charge' | 'payment' | 'balance' | 'actions';

export const folioAccountWidths: Record<FolioAccountCol, number> = {
  date: 118,
  description: 200,
  reference: 120,
  charge: 110,
  payment: 110,
  balance: 110,
  actions: 188,
};

export const folioAccountColumnList: { key: FolioAccountCol; label: string; align?: 'left' | 'right'; sortable: boolean }[] = [
  { key: 'date', label: 'Date', sortable: true },
  { key: 'description', label: 'Description', sortable: true },
  { key: 'reference', label: 'Reference', sortable: true },
  { key: 'charge', label: 'Charge', align: 'right', sortable: true },
  { key: 'payment', label: 'Payment', align: 'right', sortable: true },
  { key: 'balance', label: 'Balance', align: 'right', sortable: true },
  { key: 'actions', label: 'Actions', align: 'right', sortable: false },
];

export function useFolioAccountColumns() {
  return useResizableColumns<FolioAccountCol>(folioAccountWidths, { flexKeys: ['description', 'actions'] });
}

export function compareFolioValues(left: string | number | null, right: string | number | null, dir: 'asc' | 'desc') {
  const sign = dir === 'asc' ? 1 : -1;
  const leftEmpty = left == null || left === '';
  const rightEmpty = right == null || right === '';
  if (leftEmpty && rightEmpty) return 0;
  if (leftEmpty) return 1;
  if (rightEmpty) return -1;
  if (typeof left === 'number' && typeof right === 'number') return (left - right) * sign;
  return String(left).localeCompare(String(right), undefined, { numeric: true, sensitivity: 'base' }) * sign;
}

export function renderFolioAccountColumn(
  col: (typeof folioAccountColumnList)[number],
  sortKey: FolioAccountCol,
  sortDir: 'asc' | 'desc',
  onSort: (key: FolioAccountCol) => void,
  cols: ReturnType<typeof useFolioAccountColumns>,
) {
  return (
    <TableColumn key={col.key} className="relative" style={cols.style(col.key)}>
      {col.sortable ? (
        <SortLabel active={sortKey === col.key} dir={sortDir} align={col.align} onPress={() => onSort(col.key)}>
          {col.label}
        </SortLabel>
      ) : (
        <span className={`block truncate font-semibold text-ghana-black ${col.align === 'right' ? 'text-right' : ''}`}>{col.label}</span>
      )}
      {cols.sizer(col.key, col.label)}
    </TableColumn>
  );
}
