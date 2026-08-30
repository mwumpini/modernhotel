'use client';

import React, { useMemo, useState, useCallback } from 'react';
import { Button, Chip, Dropdown, DropdownTrigger, DropdownMenu, DropdownItem, Checkbox } from '@heroui/react';

const fmt = (n: number) =>
  `₵${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtRaw = (n: number) => n.toFixed(2);

const fmtCell = (n: number) => {
  if (Math.abs(n) < 0.01) {
    return <span className="text-slate-300 select-none">—</span>;
  }
  return fmt(n);
};

const SECTION_LABELS: Record<string, string> = {
  cost: 'Cost',
  dep: 'Depreciation',
  nbv: 'Net book value',
  gra: 'Capital allowance',
};

const SECTION_BORDER: Record<string, string> = {
  cost: 'border-l-blue-500',
  dep: 'border-l-amber-500',
  nbv: 'border-l-emerald-600',
  gra: 'border-l-violet-500',
};

export type PivotRow = {
  key: string;
  label: string;
  section?: 'cost' | 'dep' | 'nbv' | 'gra';
  emphasis?: boolean;
  dividerBefore?: boolean;
};

type Props = {
  title: string;
  reportDate: string;
  exportBasename: string;
  rowLabelHeader: string;
  rows: PivotRow[];
  columns: string[];
  columnLabels: Record<string, { short: string; full: string }>;
  totalKey: string;
  values: Record<string, Record<string, number>>;
  hideZeroColumns?: boolean;
};

function downloadPivotCsv(
  title: string,
  reportDate: string,
  rowLabelHeader: string,
  rows: PivotRow[],
  columns: string[],
  columnLabels: Record<string, { short: string; full: string }>,
  values: Record<string, Record<string, number>>,
  exportBasename: string
) {
  const header = [rowLabelHeader, ...columns.map((c) => columnLabels[c]?.full ?? c)].join(',');
  const body = rows.map((row) => {
    const cells = [
      row.label,
      ...columns.map((col) => fmtRaw(values[col]?.[row.key] ?? 0)),
    ];
    return cells.map((val) => {
      const str = String(val).replace(/"/g, '""');
      return str.includes(',') ? `"${str}"` : str;
    }).join(',');
  });
  const meta = `# ${title}, Report date: ${reportDate}`;
  const csv = [meta, header, ...body].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${exportBasename}_${reportDate}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function printPivotTable(
  title: string,
  reportDate: string,
  rowLabelHeader: string,
  rows: PivotRow[],
  columns: string[],
  columnLabels: Record<string, { short: string; full: string }>,
  values: Record<string, Record<string, number>>
) {
  const headerCells = columns.map((c) => columnLabels[c]?.full ?? c).join('</th><th>');
  const bodyRows = rows
    .map((row) => {
      const cells = columns
        .map((col) => {
          const v = values[col]?.[row.key] ?? 0;
          const text = Math.abs(v) < 0.01 ? '—' : fmt(v);
          return `<td style="text-align:right;font-family:monospace">${text}</td>`;
        })
        .join('');
      const weight = row.emphasis ? 'font-weight:600;background:#f8fafc' : '';
      return `<tr style="${weight}"><td style="text-align:left;padding:6px 10px">${row.label}</td>${cells}</tr>`;
    })
    .join('');

  const html = `<!DOCTYPE html><html><head><title>${title}</title>
<style>
  body{font-family:system-ui,sans-serif;padding:24px;color:#111}
  h1{font-size:18px;margin:0 0 4px}
  p{font-size:12px;color:#64748b;margin:0 0 16px}
  table{width:100%;border-collapse:collapse;font-size:12px}
  th,td{border:1px solid #e2e8f0;padding:6px 8px}
  th{background:#1e293b;color:#fff;text-align:right}
  th:first-child{text-align:left}
</style></head><body>
<h1>${title}</h1>
<p>Report date: ${reportDate}</p>
<table>
<thead><tr><th>${rowLabelHeader}</th><th>${headerCells}</th></tr></thead>
<tbody>${bodyRows}</tbody>
</table>
</body></html>`;

  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(html);
  win.document.close();
  setTimeout(() => win.print(), 400);
}

export default function PpeSummaryPivotTable({
  title,
  reportDate,
  exportBasename,
  rowLabelHeader,
  rows,
  columns,
  columnLabels,
  totalKey,
  values,
  hideZeroColumns = true,
}: Props) {
  const [showAllColumns, setShowAllColumns] = useState(false);

  const visibleColumns = useMemo(() => {
    if (showAllColumns || !hideZeroColumns) return columns;
    return columns.filter((col) => {
      if (col === totalKey) return true;
      return rows.some((row) => Math.abs(values[col]?.[row.key] ?? 0) >= 0.01);
    });
  }, [columns, rows, totalKey, values, hideZeroColumns, showAllColumns]);

  const sectionFirstRow = useMemo(() => {
    const seen = new Set<string>();
    const map = new Map<string, boolean>();
    for (const row of rows) {
      if (row.section && !seen.has(row.section)) {
        seen.add(row.section);
        map.set(row.key, true);
      }
    }
    return map;
  }, [rows]);

  const handleCsv = useCallback(() => {
    downloadPivotCsv(
      title,
      reportDate,
      rowLabelHeader,
      rows,
      columns,
      columnLabels,
      values,
      exportBasename
    );
  }, [title, reportDate, rowLabelHeader, rows, columns, columnLabels, values, exportBasename]);

  const handlePrint = useCallback(() => {
    printPivotTable(title, reportDate, rowLabelHeader, rows, columns, columnLabels, values);
  }, [title, reportDate, rowLabelHeader, rows, columns, columnLabels, values]);

  const hiddenColumnCount = columns.length - visibleColumns.length;

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 py-3 bg-gradient-to-r from-slate-50 to-white border-b border-slate-200">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
          <Chip size="sm" variant="flat" color="default" className="text-xs">
            {reportDate}
          </Chip>
          {hiddenColumnCount > 0 && !showAllColumns && (
            <Chip size="sm" variant="flat" color="primary" className="text-xs">
              {visibleColumns.length - 1} active groups
            </Chip>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {hideZeroColumns && (
            <Checkbox
              size="sm"
              isSelected={showAllColumns}
              onValueChange={setShowAllColumns}
              classNames={{ label: 'text-xs text-gray-600' }}
            >
              Show all columns
            </Checkbox>
          )}
          <Dropdown>
            <DropdownTrigger>
              <Button size="sm" variant="bordered" className="min-w-[100px]">
                Download
              </Button>
            </DropdownTrigger>
            <DropdownMenu aria-label="Export options">
              <DropdownItem key="csv" onPress={handleCsv}>
                CSV spreadsheet
              </DropdownItem>
              <DropdownItem key="print" onPress={handlePrint}>
                Print / PDF
              </DropdownItem>
            </DropdownMenu>
          </Dropdown>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-sm border-collapse">
          <thead>
            <tr>
              <th className="sticky left-0 z-20 text-left py-3 px-4 font-semibold text-[11px] uppercase tracking-wider text-slate-500 bg-slate-100/90 border-b border-slate-200 min-w-[160px]">
                {rowLabelHeader}
              </th>
              {visibleColumns.map((col) => (
                <th
                  key={col}
                  title={columnLabels[col]?.full ?? col}
                  className={`text-right py-3 px-3 font-semibold text-[11px] uppercase tracking-wide border-b border-slate-200 whitespace-nowrap ${
                    col === totalKey
                      ? 'bg-slate-800 text-white sticky right-0 z-20 min-w-[96px]'
                      : 'bg-slate-100/90 text-slate-600 min-w-[80px]'
                  }`}
                >
                  <span className="block">{columnLabels[col]?.short ?? col}</span>
                  {col !== totalKey && (
                    <span className="block font-normal normal-case text-[10px] text-slate-400 mt-0.5 truncate max-w-[88px]">
                      {columnLabels[col]?.full ?? col}
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => {
              const isSectionStart = sectionFirstRow.get(row.key);
              const section = row.section;
              const borderClass = section ? SECTION_BORDER[section] : 'border-l-transparent';

              let rowBg = 'bg-white';
              if (row.section === 'nbv' && row.emphasis) rowBg = 'bg-emerald-50';
              else if (row.emphasis) rowBg = 'bg-slate-50';
              else if (idx % 2 === 1) rowBg = 'bg-slate-50/40';

              return (
                <tr
                  key={row.key}
                  className={`${row.dividerBefore ? 'border-t-2 border-slate-300' : 'border-t border-slate-100'} ${rowBg}`}
                >
                  <td
                    className={`sticky left-0 z-10 py-2.5 px-4 border-r border-slate-100 border-l-4 ${borderClass} ${rowBg} ${
                      row.emphasis ? 'font-semibold text-gray-900' : 'text-gray-700'
                    }`}
                  >
                    {isSectionStart && section && (
                      <span
                        className={`block text-[10px] font-bold uppercase tracking-wider mb-0.5 ${
                          section === 'cost'
                            ? 'text-blue-600'
                            : section === 'dep'
                              ? 'text-amber-600'
                              : section === 'nbv'
                                ? 'text-emerald-700'
                                : 'text-violet-600'
                        }`}
                      >
                        {SECTION_LABELS[section]}
                      </span>
                    )}
                    <span className="text-xs sm:text-sm">{row.label}</span>
                  </td>
                  {visibleColumns.map((col) => {
                    const value = values[col]?.[row.key] ?? 0;
                    const isTotal = col === totalKey;

                    return (
                      <td
                        key={col}
                        className={`text-right py-2.5 px-3 font-mono text-xs tabular-nums ${
                          isTotal
                            ? `sticky right-0 z-10 border-l border-slate-200 ${rowBg} ${
                                row.emphasis ? 'font-bold text-gray-900' : 'font-semibold text-gray-800'
                              }`
                            : row.emphasis
                              ? 'font-semibold text-gray-900'
                              : 'text-gray-700'
                        }`}
                      >
                        {fmtCell(value)}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export const FS_PIVOT_ROWS: PivotRow[] = [
  { key: 'costOpening', label: 'Opening balance', section: 'cost' },
  { key: 'additions', label: 'Additions', section: 'cost' },
  { key: 'costClosing', label: 'Closing balance', section: 'cost', emphasis: true },
  { key: 'depOpening', label: 'Opening balance', section: 'dep', dividerBefore: true },
  { key: 'chargeForYear', label: 'Charge for the year', section: 'dep' },
  { key: 'depClosing', label: 'Closing balance', section: 'dep', emphasis: true },
  { key: 'nbv', label: 'At report date', section: 'nbv', emphasis: true, dividerBefore: true },
];

export const GRA_PIVOT_ROWS: PivotRow[] = [
  { key: 'openingWDV', label: 'Opening WDV', section: 'gra' },
  { key: 'additions', label: 'Additions', section: 'gra' },
  { key: 'caClaimed', label: 'Allowance claimed', section: 'gra' },
  { key: 'closingWDV', label: 'Closing WDV', section: 'gra', emphasis: true, dividerBefore: true },
];

export const FS_COLUMN_LABELS: Record<string, { short: string; full: string }> = {
  Land: { short: 'Land', full: 'Land' },
  Building: { short: 'Building', full: 'Building' },
  'Motor Vehicle & Machinery': { short: 'Vehicles', full: 'Motor Vehicle & Machinery' },
  'Furniture & Fixtures': { short: 'F&F', full: 'Furniture & Fixtures' },
  'Computer & Accessories': { short: 'IT', full: 'Computer & Accessories' },
  'Kitchen Equipment & Utensils': { short: 'Kitchen', full: 'Kitchen Equipment & Utensils' },
  'Intangible Assets': { short: 'Intangibles', full: 'Intangible Assets' },
  TOTAL: { short: 'Total', full: 'Total' },
};

export const GRA_COLUMN_LABELS: Record<string, { short: string; full: string }> = {
  'Class 1': { short: 'Class 1', full: 'Class 1 — Computers & IT' },
  'Class 2': { short: 'Class 2', full: 'Class 2 — Motor vehicles' },
  'Class 3': { short: 'Class 3', full: 'Class 3 — Plant & equipment' },
  'Class 4': { short: 'Class 4', full: 'Class 4 — Buildings & land' },
  TOTAL: { short: 'Total', full: 'Total' },
};
