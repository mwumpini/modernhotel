'use client';

import React, { useState, useMemo } from 'react';
import HeadingInfo from '../HeadingInfo';
import {
  Card, CardBody, Button, Input, Select, SelectItem,
  Table, TableHeader, TableColumn, TableBody, TableRow, TableCell,
  Chip,
  Spinner, Alert, Pagination
} from "@heroui/react";
import { useAccountingStore } from '@/app/lib/accounting/store';
import { downloadCSV } from '@/app/lib/accounting/helpers/exportHelpers';
import { SortLabel, deskResizableTableClassNames, useResizableColumns } from '../frontoffice/columnResize';
import { useDeskPagination } from '../dashboard/deskTableUi';
import { DeskKpiStrip } from './DeskKpiStrip';

type AuditSortKey = 'timestamp' | 'user' | 'action' | 'table' | 'recordId' | 'details';

function plainAction(action: string): string {
  switch (action) {
    case 'Create': return 'Added';
    case 'Update': return 'Changed';
    case 'Delete': return 'Removed';
    case 'Void': return 'Voided';
    default: return action;
  }
}

function plainArea(tableName: string): string {
  const map: Record<string, string> = {
    JournalEntry: 'Journal',
    Invoice: 'Invoice',
    Payment: 'Payment',
    ChartOfAccount: 'Books',
    ChartOfAccounts: 'Books',
    BankAccount: 'Bank account',
    BankTransaction: 'Bank transaction',
    CostCenter: 'Spending area',
    RevenueCenter: 'Income area',
    BusinessPartner: 'Customer / supplier',
    PpeAsset: 'Asset',
    TaxRemittance: 'Tax remittance',
  };
  return map[tableName] || tableName.replace(/([a-z])([A-Z])/g, '$1 $2');
}

function detailsPreview(entry: { oldValues?: unknown; newValues?: unknown }): string {
  const payload = entry.newValues ?? entry.oldValues;
  if (payload == null) return '—';
  const text = typeof payload === 'string' ? payload : JSON.stringify(payload);
  return text.length > 80 ? `${text.slice(0, 80)}…` : text;
}

export default function AuditControlsPage() {
  const {
    auditTrail,
    isLoading,
    error
  } = useAccountingStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [filterAction, setFilterAction] = useState<string>('all');
  const [filterTable, setFilterTable] = useState<string>('all');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [sortKey, setSortKey] = useState<AuditSortKey>('timestamp');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const cols = useResizableColumns<AuditSortKey>({
    timestamp: 160, user: 120, action: 100, table: 140, recordId: 120, details: 240,
  });

  const filteredAuditTrail = useMemo(() => {
    const filtered = auditTrail.filter(entry => {
      const haystack = [
        entry.action,
        plainAction(entry.action),
        entry.tableName,
        plainArea(entry.tableName),
        entry.recordId,
        entry.userId,
      ].join(' ').toLowerCase();
      const matchesSearch = !searchTerm.trim() || haystack.includes(searchTerm.trim().toLowerCase());
      const matchesAction = filterAction === 'all' || entry.action === filterAction;
      const matchesTable = filterTable === 'all' || entry.tableName === filterTable;

      const entryDate = new Date(entry.timestamp);
      const matchesStart = !dateRange.start || entryDate >= new Date(dateRange.start);
      const matchesEnd = !dateRange.end || entryDate <= new Date(new Date(dateRange.end).setHours(23, 59, 59, 999));

      return matchesSearch && matchesAction && matchesTable && matchesStart && matchesEnd;
    });
    const value = (entry: (typeof auditTrail)[0]): string | number => {
      switch (sortKey) {
        case 'timestamp': return new Date(entry.timestamp).getTime();
        case 'user': return (entry.userId || '').toLowerCase();
        case 'action': return plainAction(entry.action).toLowerCase();
        case 'table': return plainArea(entry.tableName).toLowerCase();
        case 'recordId': return (entry.recordId || '').toLowerCase();
        case 'details': return detailsPreview(entry).toLowerCase();
        default: return '';
      }
    };
    const sorted = [...filtered].sort((a, b) => {
      const av = value(a);
      const bv = value(b);
      if (typeof av === 'number' && typeof bv === 'number') return av - bv;
      return String(av).localeCompare(String(bv));
    });
    return sortDir === 'asc' ? sorted : sorted.reverse();
  }, [auditTrail, searchTerm, filterAction, filterTable, dateRange, sortKey, sortDir]);

  const { page, setPage, pages, paged: paginatedAuditTrail } = useDeskPagination(
    filteredAuditTrail,
    [searchTerm, filterAction, filterTable, dateRange, sortKey, sortDir],
  );

  const onSort = (key: AuditSortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir(key === 'timestamp' ? 'desc' : 'asc');
    }
  };

  const column = (key: AuditSortKey, label: string, align: 'left' | 'right' | 'center' = 'left') => (
    <TableColumn key={key} className="relative" style={cols.style(key)}>
      <SortLabel active={sortKey === key} dir={sortDir} align={align} onPress={() => onSort(key)}>{label}</SortLabel>
      {cols.sizer(key, label)}
    </TableColumn>
  );

  const actions = useMemo(() => {
    const acts = [...new Set(auditTrail.map(entry => entry.action))];
    return acts.sort();
  }, [auditTrail]);

  const tables = useMemo(() => {
    const tabs = [...new Set(auditTrail.map(entry => entry.tableName))];
    return tabs.sort((a, b) => plainArea(a).localeCompare(plainArea(b)));
  }, [auditTrail]);

  const addedCount = auditTrail.filter((entry) => entry.action === 'Create').length;
  const changedCount = auditTrail.filter((entry) => entry.action === 'Update').length;

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="px-3 pt-2 pb-3 md:px-4 md:pt-3 md:pb-4">
      <div className="mb-2 flex items-center gap-1.5">
        <h1 className="text-lg md:text-xl font-bold text-gray-800">Activity log</h1>
        <HeadingInfo label="About the activity log">
          Who changed what in accounting — adds, edits, voids, and removals.
        </HeadingInfo>
      </div>

      <DeskKpiStrip
        className="mb-3"
        items={[
          { id: 'audit.total', label: 'Entries', value: auditTrail.length, tone: 'text-blue-700' },
          { id: 'audit.create', label: 'Added', value: addedCount, tone: 'text-green-700' },
          { id: 'audit.update', label: 'Changed', value: changedCount, tone: 'text-orange-700' },
        ]}
      />

      {error && (
        <Alert color="danger" className="mb-3">
          {error}
        </Alert>
      )}

      <Card className="mb-3 shadow-sm">
        <CardBody className="py-2.5 px-3">
          <div className="flex flex-nowrap items-center gap-2 overflow-x-auto mb-2">
            <h3 className="text-sm font-semibold text-gray-800 shrink-0 mr-auto">
              Changes ({filteredAuditTrail.length})
            </h3>
            <Button
              size="sm"
              color="primary"
              variant="bordered"
              className="shrink-0"
              onPress={() => downloadCSV(
                filteredAuditTrail.map(entry => ({
                  when: entry.timestamp,
                  user: entry.userId,
                  action: plainAction(entry.action),
                  area: plainArea(entry.tableName),
                  record: entry.recordId,
                  details: detailsPreview(entry),
                })),
                'activity_log',
                [
                  { key: 'when', label: 'When' },
                  { key: 'user', label: 'Who' },
                  { key: 'action', label: 'Action' },
                  { key: 'area', label: 'Area' },
                  { key: 'record', label: 'Record' },
                  { key: 'details', label: 'Details' },
                ]
              )}
            >
              Export
            </Button>
          </div>

          <div className="flex flex-nowrap items-center gap-2 overflow-x-auto">
            <Input
              size="sm"
              aria-label="Search activity"
              placeholder="Search who, action, area, record"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-56 shrink-0"
            />
            <Select
              size="sm"
              aria-label="Filter by action"
              selectedKeys={[filterAction]}
              onSelectionChange={(keys) => setFilterAction(Array.from(keys)[0] as string)}
              className="w-40 shrink-0"
            >
              {['all', ...actions].map(action => (
                <SelectItem key={action}>{action === 'all' ? 'All actions' : plainAction(action)}</SelectItem>
              ))}
            </Select>
            <Select
              size="sm"
              aria-label="Filter by area"
              selectedKeys={[filterTable]}
              onSelectionChange={(keys) => setFilterTable(Array.from(keys)[0] as string)}
              className="w-44 shrink-0"
            >
              {['all', ...tables].map(table => (
                <SelectItem key={table}>{table === 'all' ? 'All areas' : plainArea(table)}</SelectItem>
              ))}
            </Select>
            <Input
              size="sm"
              type="date"
              aria-label="From date"
              value={dateRange.start}
              onChange={(e) => setDateRange({...dateRange, start: e.target.value})}
              className="w-36 shrink-0"
            />
            <Input
              size="sm"
              type="date"
              aria-label="To date"
              value={dateRange.end}
              onChange={(e) => setDateRange({...dateRange, end: e.target.value})}
              className="w-36 shrink-0"
            />
          </div>
        </CardBody>
      </Card>

      <Card className="shadow-sm">
        <CardBody className="p-0">
              <div className="px-3 pt-2 pb-3 md:px-4 md:pb-4">
                <div ref={cols.frameRef} style={cols.frameStyle}>
                  <Table aria-label="Activity log" removeWrapper classNames={deskResizableTableClassNames()}>
                    <TableHeader>
                      {column('timestamp', 'When')}
                      {column('user', 'Who')}
                      {column('action', 'Action')}
                      {column('table', 'Area')}
                      {column('recordId', 'Record')}
                      {column('details', 'Details')}
                    </TableHeader>
                    <TableBody emptyContent="No activity for this search.">
                      {paginatedAuditTrail.map((entry) => (
                        <TableRow key={entry.id}>
                          <TableCell>
                            <span className="text-sm">
                              {new Date(entry.timestamp).toLocaleString()}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="font-medium truncate block">{entry.userId}</span>
                          </TableCell>
                          <TableCell>
                            <Chip
                              color={
                                entry.action === 'Create' ? 'success' :
                                entry.action === 'Update' ? 'warning' :
                                entry.action === 'Delete' || entry.action === 'Void' ? 'danger' :
                                'primary'
                              }
                              variant="flat"
                              size="sm"
                            >
                              {plainAction(entry.action)}
                            </Chip>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm truncate block">{plainArea(entry.tableName)}</span>
                          </TableCell>
                          <TableCell>
                            <span className="font-mono text-sm truncate block">{entry.recordId}</span>
                          </TableCell>
                          <TableCell>
                            <span className="text-xs text-gray-500 truncate block" title={detailsPreview(entry)}>
                              {detailsPreview(entry)}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="mt-3 flex justify-end">
                  <Pagination total={pages} page={page} onChange={setPage} showControls size="sm" />
                </div>
              </div>
        </CardBody>
      </Card>
    </div>
  );
}
