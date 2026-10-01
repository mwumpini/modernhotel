'use client';

import React, { useMemo, useState } from 'react';
import { Table, TableBody, TableCell, TableColumn, TableHeader, TableRow } from '@heroui/react';
import { SortLabel, deskResizableTableClassNames, useResizableColumns } from '../frontoffice/columnResize';

export type ReportTableColumn = {
  key: string;
  label: string;
  align?: 'left' | 'right' | 'center';
};

function dateRank(column: ReportTableColumn) {
  const key = column.key.toLowerCase();
  const label = column.label.toLowerCase();
  if (/^(days|age|duedin|nights)$/.test(key)) return null;
  if (/\bdays\b|\bage\b/.test(label) && !/\bdate\b/.test(label)) return null;
  if (/^last/.test(key) || /^last\b/.test(label) || /^next/.test(key) || /^next\b/.test(label)) return null;
  if (key === 'date' || label === 'date') return 0;
  if (/timestamp|datetime|businessdate/.test(key) || (/\bdate\b/.test(label) && /\btime\b/.test(label))) return 1;
  if (/arrival|checkin|startdate/.test(key) || label === 'arrival' || label === 'start') return 2;
  if (/departure|checkout|enddate/.test(key) || label === 'departure' || label === 'end') return 3;
  if (key === 'due' || /duedate|settlement|validuntil/.test(key) || label === 'due' || /\bdue\b/.test(label)) return 4;
  if (/date|period/.test(key) || /\bdate\b|\bperiod\b/.test(label)) return 5;
  if (/^(time|at)$/.test(key) || label === 'time') return 1;
  if (/createdat|sentat|cancelledat|requesteddate|completedat|reportedat/.test(key) || key === 'when' || label === 'when' || label === 'fired' || label === 'sent' || label === 'requested' || label === 'reported' || label === 'cancelled at') return 1;
  if (/startedat|servedat|startedpreparingat|preparingat/.test(key) || label === 'started' || label === 'served') return 2;
  return null;
}

function idRank(column: ReportTableColumn) {
  const key = column.key.toLowerCase();
  const label = column.label.toLowerCase();
  if (/^(roomnumber|guestphone|phone|nights|partysize|transactioncount|invoices|events|lines|openlines)$/.test(key)) return null;
  if (label === 'invoices' || label === 'events' || label === 'room' || label === 'phone') return null;
  if (/reservation/.test(key) || label === 'reservation') return 0;
  if (/^invoice$|invoicenumber|proforma|^bill$/.test(key) || label === 'invoice' || label === 'proforma' || label === 'bill') return 1;
  if (/folio/.test(key) || label === 'folio') return 2;
  if (/receipt|paymentnumber/.test(key) || label === 'receipt') return 3;
  if (/booking|quotenumber|^quote$/.test(key) || label === 'booking' || label === 'quote') return 4;
  if (/ordernumber|orderid|taskid|incidentnumber|patrolnumber|visitornumber|employeenumber|periodnumber/.test(key) || label === 'order' || label === 'ticket' || label === 'task id' || label === 'incident' || label === 'patrol' || label === 'visitor' || label === 'staff no.') return 2;
  if (/requisition|transfernumber|issuenumber|countnumber|ponumber/.test(key) || label === 'requisition' || label === 'transfer' || label === 'issue' || label === 'count' || label === 'po') return 2;
  if (key === 'code' && label === 'code') return 6;
  if (/callid|^id$|entry|journal/.test(key) || label === 'call id' || label === 'entry') return 5;
  if (key === 'number' && /entry|invoice|receipt|booking|bill/.test(label)) return 5;
  if (/reference/.test(key) || label === 'reference') return 8;
  return null;
}

/** Name and description columns can absorb spare width. Dates, ids, and status stay fitted. */
function isNarrative(column: ReportTableColumn) {
  if (dateRank(column) !== null || idRank(column) !== null) return false;
  const blob = `${column.key} ${column.label}`.toLowerCase();
  if (/\bstatus\b|\btype\b|\bmethod\b|\broom\b|\bpax\b|\bguests\b/.test(blob)) return false;
  return /name|guest|title|description|customer|organizer|notes|comment|detail|request|hall|vendor|party|account|department|segment|item|particular|outlet|location|route|purpose|officer/.test(blob);
}

/** Date in the first column, the record id in the second. Other columns keep their order. */
export function orderReportColumns<T extends ReportTableColumn>(columns: T[]): T[] {
  let date: T | undefined;
  let id: T | undefined;
  columns.forEach((column) => {
    const dateScore = dateRank(column);
    if (dateScore !== null && (date === undefined || dateScore < (dateRank(date) ?? 99))) date = column;
    const idScore = idRank(column);
    if (idScore !== null && (id === undefined || idScore < (idRank(id) ?? 99))) id = column;
  });
  if (date && id && date.key === id.key) id = undefined;
  const leading = [date, id].filter((column): column is T => Boolean(column));
  const leadingKeys = new Set(leading.map((column) => column.key));
  return [...leading, ...columns.filter((column) => !leadingKeys.has(column.key))];
}

/** Uppercase header text is about 6.5px per character, plus padding and room for the sort arrow. */
function headerWidth(label: string) {
  return Math.ceil(label.toUpperCase().length * 6.5 + 36);
}

function cellWidth(text: string) {
  return Math.ceil(text.length * 8.2 + 36);
}

function renderedText(node: React.ReactNode): string {
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  return '';
}

function longestCell(
  column: ReportTableColumn,
  rows: Record<string, unknown>[],
  renderCell: (row: Record<string, unknown>, column: ReportTableColumn) => React.ReactNode,
) {
  let longest = '';
  for (const row of rows) {
    const text = renderedText(renderCell(row, column));
    if (text.length > longest.length) longest = text;
  }
  return longest;
}

function compareValues(a: unknown, b: unknown) {
  const aEmpty = a === null || a === undefined || a === '';
  const bEmpty = b === null || b === undefined || b === '';
  if (aEmpty && bEmpty) return 0;
  if (aEmpty) return 1;
  if (bEmpty) return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
}

function SortableReportTableInner({
  ariaLabel,
  columns,
  rows,
  renderCell,
}: {
  ariaLabel: string;
  columns: ReportTableColumn[];
  rows: Record<string, unknown>[];
  renderCell: (row: Record<string, unknown>, column: ReportTableColumn) => React.ReactNode;
}) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const layout = useMemo(() => {
    const next: Record<string, number> = {};
    const flexKeys: string[] = [];
    columns.forEach((column) => {
      const align = column.align || (rows.some((row) => typeof row[column.key] === 'number') ? 'right' : 'left');
      const content = longestCell({ ...column, align }, rows, renderCell);
      const fitted = Math.max(72, headerWidth(column.label), content ? cellWidth(content) : 0);
      const cap = align === 'right' ? 220 : dateRank(column) !== null ? 188 : 560;
      next[column.key] = Math.min(cap, fitted);
      if (align !== 'right' && isNarrative(column)) flexKeys.push(column.key);
    });
    return { defaults: next, flexKeys };
  }, [columns, rows, renderCell]);

  const cols = useResizableColumns(layout.defaults, { flexKeys: layout.flexKeys });

  const sortedRows = useMemo(() => {
    if (!sortKey) return rows;
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => compareValues(a[sortKey], b[sortKey]) * dir);
  }, [rows, sortKey, sortDir]);

  const alignOf = (column: ReportTableColumn) => {
    if (column.align) return column.align;
    return rows.some((row) => typeof row[column.key] === 'number') ? 'right' : 'left';
  };

  const toggleSort = (key: string) => {
    if (sortKey === key) setSortDir((dir) => (dir === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  return (
    <div ref={cols.frameRef} style={cols.frameStyle}>
      <Table aria-label={ariaLabel} removeWrapper classNames={deskResizableTableClassNames()}>
        <TableHeader>
          {columns.map((column) => (
            <TableColumn key={column.key} className="relative" style={cols.style(column.key)}>
              <SortLabel
                active={sortKey === column.key}
                dir={sortDir}
                align={alignOf(column)}
                onPress={() => toggleSort(column.key)}
              >
                {column.label}
              </SortLabel>
              {cols.sizer(column.key, column.label)}
            </TableColumn>
          ))}
        </TableHeader>
        <TableBody emptyContent="No records match the selected filters.">
          {sortedRows.map((row, index) => (
            <TableRow key={index}>
              {columns.map((column) => {
                const align = alignOf(column);
                const raw = row[column.key];
                const title = raw === null || raw === undefined || typeof raw === 'object' ? undefined : String(raw);
                return (
                  <TableCell key={column.key}>
                    <span
                      className={`block truncate ${align === 'right' ? 'text-right tabular-nums' : align === 'center' ? 'text-center' : 'text-left'}`}
                      title={title}
                    >
                      {renderCell(row, column)}
                    </span>
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/** Report grid with the stay-worksheet header behavior: click to sort, drag the edge to resize, double-click to reset. */
export function SortableReportTable(props: {
  ariaLabel: string;
  columns: ReportTableColumn[];
  rows: Record<string, unknown>[];
  renderCell: (row: Record<string, unknown>, column: ReportTableColumn) => React.ReactNode;
}) {
  const columns = orderReportColumns(props.columns);
  const signature = columns.map((column) => column.key).join('\0');
  return <SortableReportTableInner key={signature} {...props} columns={columns} />;
}
