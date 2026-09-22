'use client';

/**
 * Shared building blocks for a module's "Reports & Analysis" screen — first built for Front Office
 * (FrontOfficeReportsAnalysis.tsx) and pulled out here so every module that gets the same treatment
 * (F&B next) reuses one renderer and one date control instead of each screen reimplementing its own.
 */

import React, { useState } from 'react';
import { Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, Button, Popover, PopoverTrigger, PopoverContent } from '@heroui/react';
import { formatPercent, isPercentKey, isCountKey } from '../../lib/frontoffice/reportExportFormat';

export function labelize(key: string): string {
  return key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase());
}

export function formatReportValue(value: unknown, key?: string): React.ReactNode {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') {
    if (key && isPercentKey(key)) return formatPercent(value);
    if (key && isCountKey(key)) return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
    // Most numeric report fields are money — fixed 2 decimals, the standard currency
    // convention, instead of the count-friendly "whatever digits it happens to have".
    return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  return String(value);
}

/** Numbers read right-aligned (so digits/decimal points line up down the column, the
 * standard spreadsheet convention) — text stays left-aligned. Checked across every row,
 * not just the first, since a column can be numeric in one row and "—" (null) in another. */
function isNumericColumn(rows: Record<string, unknown>[], column: string): boolean {
  return rows.some((row) => typeof row[column] === 'number');
}

/** Renders an array of row objects as a small table — used for nested arrays inside a summary object
 * (e.g. a report's "topCustomers" or "byStatus" list). */
export function ReportMiniTable({ rows }: { rows: Record<string, unknown>[] }) {
  if (rows.length === 0) return <p className="text-sm text-gray-500">None</p>;
  const columns = Object.keys(rows[0]);
  return (
    <Table removeWrapper isCompact aria-label="Report detail">
      <TableHeader>
        {columns.map((c) => <TableColumn key={c} align={isNumericColumn(rows, c) ? 'end' : 'start'}>{labelize(c)}</TableColumn>) as any}
      </TableHeader>
      <TableBody>
        {rows.map((row, i) => (
          <TableRow key={i}>
            {columns.map((c) => <TableCell key={c}>{formatReportValue(row[c], c)}</TableCell>) as any}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/** Renders a report's summary object recursively: primitive fields as a plain Field/Value
 * table, nested objects as labeled sub-sections, arrays of objects as mini tables. Used for
 * reports that return one object rather than a row array — without this, anything past the
 * top level of primitives silently never reached the screen. */
export function ReportSummarySection({ data }: { data: Record<string, unknown> }) {
  const entries = Object.entries(data);
  const primitives = entries.filter(([, v]) => v === null || typeof v !== 'object');
  const objects = entries.filter(([, v]) => v !== null && typeof v === 'object' && !Array.isArray(v));
  const arrays = entries.filter(([, v]) => Array.isArray(v));

  return (
    <div className="space-y-6">
      {primitives.length > 0 && (
        <Table removeWrapper isCompact aria-label="Report summary">
          <TableHeader>
            <TableColumn>Field</TableColumn>
            <TableColumn>Value</TableColumn>
          </TableHeader>
          <TableBody>
            {primitives.map(([key, value]) => (
              <TableRow key={key}>
                <TableCell className="font-medium text-gray-600">{labelize(key)}</TableCell>
                <TableCell>{formatReportValue(value, key)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      {objects.map(([key, value]) => (
        <div key={key}>
          <h4 className="text-sm font-semibold text-gray-700 mb-2">{labelize(key)}</h4>
          <ReportSummarySection data={value as Record<string, unknown>} />
        </div>
      ))}
      {arrays.map(([key, value]) => {
        const arr = value as unknown[];
        const isObjectArray = arr.length > 0 && typeof arr[0] === 'object' && arr[0] !== null;
        return (
          <div key={key}>
            <h4 className="text-sm font-semibold text-gray-700 mb-2">{labelize(key)}</h4>
            {isObjectArray
              ? <ReportMiniTable rows={arr as Record<string, unknown>[]} />
              : <p className="text-sm text-gray-600">{arr.length > 0 ? arr.join(', ') : 'None'}</p>}
          </div>
        );
      })}
    </div>
  );
}

/** The plain auto-column table used for any report that's just a row array — column headers come
 * straight from the first row's keys, so a new field on a report shows up with no UI change needed. */
export function ReportTable({ data, ariaLabel }: { data: Record<string, unknown>[]; ariaLabel: string }) {
  const columns = Object.keys(data[0] || {});
  return (
    <Table aria-label={ariaLabel}>
      <TableHeader>
        {columns.map((column) => (
          <TableColumn key={column} align={isNumericColumn(data, column) ? 'end' : 'start'}>{labelize(column)}</TableColumn>
        ))}
      </TableHeader>
      <TableBody>
        {data.map((row, index) => (
          <TableRow key={index}>
            {columns.map((column) => (
              <TableCell key={column}>{formatReportValue(row[column], column)}</TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/** Whatever a report generator returned, rendered the right way: the Daily Transaction-style custom
 * view when `customView` is supplied, a recursive summary for a single object, or the plain table for
 * a row array. `mounted` gates the very first render so SSR and the client's first paint agree. */
export function ReportOutput({ mounted, data, ariaLabel, customView }: {
  mounted: boolean;
  data: unknown;
  ariaLabel: string;
  customView?: React.ReactNode;
}) {
  if (!mounted) return <div className="text-center py-8"><p className="text-gray-500">Loading…</p></div>;
  if (!data || (Array.isArray(data) && data.length === 0)) {
    return <div className="text-center py-8"><p className="text-gray-500">No data available for the selected report and date.</p></div>;
  }
  if (customView) return <>{customView}</>;
  if (!Array.isArray(data)) return <ReportSummarySection data={data as Record<string, unknown>} />;
  return <ReportTable data={data as Record<string, unknown>[]} ariaLabel={ariaLabel} />;
}

export type ReportDateMode = 'today' | 'specific' | 'range';

/** The Today / Specific Date / Range pill control — Range is disabled (not hidden) with a tooltip
 * when the selected report's generator only takes a single date. */
export function ReportDateControl({ mode, setMode, startDate, endDate, setStartDate, setEndDate, rangeSupported }: {
  mode: ReportDateMode;
  setMode: (m: ReportDateMode) => void;
  startDate: string;
  endDate: string;
  setStartDate: (d: string) => void;
  setEndDate: (d: string) => void;
  rangeSupported: boolean;
}) {
  const pill = (active: boolean, disabled?: boolean) =>
    `px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
      disabled
        ? 'bg-gray-50 text-gray-300 border-gray-200 cursor-not-allowed'
        : active
        ? 'bg-blue-600 text-white border-blue-600'
        : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400 hover:text-blue-600'
    }`;
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">Report Date</label>
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => { const today = new Date().toISOString().split('T')[0]; setMode('today'); setStartDate(today); setEndDate(today); }}
          className={pill(mode === 'today')}
        >
          Today
        </button>
        <button onClick={() => setMode('specific')} className={pill(mode === 'specific')}>Specific Date</button>
        <button
          onClick={() => setMode('range')}
          disabled={!rangeSupported}
          title={rangeSupported ? undefined : "This report doesn't support a date range yet — it runs for a single day"}
          className={pill(mode === 'range', !rangeSupported)}
        >
          Range
        </button>
        {mode === 'specific' && (
          <input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setEndDate(e.target.value); }} className="w-40 h-9 px-2 rounded border border-gray-300 text-sm" />
        )}
        {mode === 'range' && rangeSupported && (
          <>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-40 h-9 px-2 rounded border border-gray-300 text-sm" />
            <span className="text-gray-400 text-sm">→</span>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-40 h-9 px-2 rounded border border-gray-300 text-sm" />
          </>
        )}
      </div>
    </div>
  );
}

export type FilterOption = { value: string; label: string };
export type FilterDimension = {
  key: string;
  label: string;
  options: FilterOption[];
  selected: string[];
  setSelected: (values: string[]) => void;
  disabled?: boolean;
  disabledReason?: string;
  /** false = single-choice (e.g. one cashier, one room) — picking a value replaces the
   * selection and closes the popover, and an "All <label>" option appears at the top to
   * clear it, instead of the checkbox multi-select that's the default. */
  multi?: boolean;
};

/** One "+ Filter" entry point instead of a row of always-visible dropdowns: click it, pick
 * WHICH dimension to filter by (Category/Staff/Cashier/…), then that dimension's real
 * value list opens right there in the same popover. A multi-select dimension shows
 * checkboxes and stays open for picking several; a single-select one (multi: false)
 * closes as soon as you pick one, same as the plain Select it replaces. Once set, a
 * dimension shows as a removable chip next to the button — click the chip to reopen and
 * edit it, or its ✕ to clear it. When there's only one available dimension, the button
 * skips straight to its value list instead of showing a menu with one entry to click.
 * Shared by Front Office and F&B's Reports & Analysis screens. */
export function TransactionFilters({ dimensions }: { dimensions: FilterDimension[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const active = dimensions.find((d) => d.key === activeKey);
  const enabled = dimensions.filter((d) => !d.disabled);

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Popover
        isOpen={isOpen}
        onOpenChange={(open) => {
          setIsOpen(open);
          // A fresh open from the trigger button starts at the dimension menu, or skips
          // straight to it when there's only one to pick from; a chip's own onClick sets
          // activeKey directly before opening, so it isn't touched here.
          if (!open) setActiveKey(null);
          else if (!activeKey) setActiveKey(enabled.length === 1 ? enabled[0].key : null);
        }}
        placement="bottom-start"
      >
        <PopoverTrigger>
          <Button variant="bordered" size="sm">🔎 Filter</Button>
        </PopoverTrigger>
        <PopoverContent>
          <div className="py-2 w-60">
            {!active ? (
              <div className="flex flex-col">
                {dimensions.map((d) => (
                  <button
                    key={d.key}
                    disabled={d.disabled}
                    onClick={() => setActiveKey(d.key)}
                    title={d.disabled ? d.disabledReason : undefined}
                    className={`text-left px-3 py-2 rounded text-sm flex items-center justify-between ${
                      d.disabled ? 'text-gray-300 cursor-not-allowed' : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <span>{d.label}</span>
                    {d.selected.length > 0 && (
                      <span className="text-xs bg-blue-100 text-blue-700 rounded-full px-1.5">{d.selected.length}</span>
                    )}
                  </button>
                ))}
              </div>
            ) : (
              <div className="px-1">
                {enabled.length > 1 && (
                  <button
                    onClick={() => setActiveKey(null)}
                    className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 mb-1"
                  >
                    ← Back
                  </button>
                )}
                <div className="max-h-64 overflow-y-auto space-y-0.5 px-2 pb-2">
                  {active.options.length === 0 && (
                    <p className="text-xs text-gray-400 py-2">Nothing to filter by yet.</p>
                  )}
                  {active.multi === false ? (
                    <>
                      <button
                        onClick={() => { active.setSelected([]); setIsOpen(false); setActiveKey(null); }}
                        className={`w-full text-left py-1.5 px-1 text-sm rounded hover:bg-gray-50 ${active.selected.length === 0 ? 'font-semibold text-blue-700' : 'text-gray-700'}`}
                      >
                        All {active.label.toLowerCase()}
                      </button>
                      {active.options.map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => { active.setSelected([opt.value]); setIsOpen(false); setActiveKey(null); }}
                          className={`w-full text-left py-1.5 px-1 text-sm rounded hover:bg-gray-50 ${active.selected[0] === opt.value ? 'font-semibold text-blue-700' : 'text-gray-700'}`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </>
                  ) : (
                    active.options.map((opt) => {
                      const checked = active.selected.includes(opt.value);
                      return (
                        <label key={opt.value} className="flex items-center gap-2 py-1 text-sm text-gray-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              active.setSelected(
                                checked ? active.selected.filter((v) => v !== opt.value) : [...active.selected, opt.value]
                              );
                            }}
                          />
                          {opt.label}
                        </label>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
      {dimensions.filter((d) => d.selected.length > 0).map((d) => (
        <div
          key={d.key}
          onClick={() => { setActiveKey(d.key); setIsOpen(true); }}
          className="cursor-pointer flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-full bg-blue-50 border border-blue-200 text-xs text-blue-700"
        >
          <span>{d.label}: {d.selected.map((v) => d.options.find((o) => o.value === v)?.label || v).join(', ')}</span>
          <button
            onClick={(e) => { e.stopPropagation(); d.setSelected([]); }}
            className="text-blue-400 hover:text-blue-600 font-bold px-1"
            aria-label={`Clear ${d.label} filter`}
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
