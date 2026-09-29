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

  // Filter audit trail
  const filteredAuditTrail = useMemo(() => {
    const filtered = auditTrail.filter(entry => {
      const matchesSearch = entry.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           entry.tableName.toLowerCase().includes(searchTerm.toLowerCase());
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
        case 'action': return entry.action;
        case 'table': return entry.tableName.toLowerCase();
        case 'recordId': return (entry.recordId || '').toLowerCase();
        case 'details': return JSON.stringify(entry.newValues || entry.oldValues || '').toLowerCase();
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

  // Get unique actions and tables for filters
  const actions = useMemo(() => {
    const acts = [...new Set(auditTrail.map(entry => entry.action))];
    return acts.sort();
  }, [auditTrail]);

  const tables = useMemo(() => {
    const tabs = [...new Set(auditTrail.map(entry => entry.tableName))];
    return tabs.sort();
  }, [auditTrail]);

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
        <h1 className="text-lg md:text-xl font-bold text-gray-800">🔍 Audit & Controls</h1>
        <HeadingInfo label="About audit and controls">Monitor system activities, audit trails, and internal controls</HeadingInfo>
      </div>

      {/* Summary Cards */}
      <DeskKpiStrip
        className="mb-3"
        items={[
          { id: 'audit.total', label: 'Total Audit Entries', value: auditTrail.length, tone: 'text-blue-700' },
          { id: 'audit.create', label: 'Create Operations', value: auditTrail.filter((entry) => entry.action === 'Create').length, tone: 'text-green-700' },
          { id: 'audit.update', label: 'Update Operations', value: auditTrail.filter((entry) => entry.action === 'Update').length, tone: 'text-orange-700' },
        ]}
      />

      {/* Filters */}
      <Card className="mb-3 shadow-sm">
        <CardBody className="py-2.5 px-3">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
            <Input
              size="sm"
              placeholder="Search audit trail..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              startContent={<span className="text-gray-400">🔍</span>}
            />
            
            <Select
              size="sm"
              placeholder="Filter by Action"
              selectedKeys={[filterAction]}
              onSelectionChange={(keys) => setFilterAction(Array.from(keys)[0] as string)}
            >
              {['all', ...actions].map(action => (
                <SelectItem key={action}>{action === 'all' ? 'All Actions' : action}</SelectItem>
              ))}
            </Select>

            <Select
              size="sm"
              placeholder="Filter by Table"
              selectedKeys={[filterTable]}
              onSelectionChange={(keys) => setFilterTable(Array.from(keys)[0] as string)}
            >
              {['all', ...tables].map(table => (
                <SelectItem key={table}>{table === 'all' ? 'All Tables' : table}</SelectItem>
              ))}
            </Select>

            <div className="flex gap-2">
              <Input
                size="sm"
                type="date"
                placeholder="Start Date"
                value={dateRange.start}
                onChange={(e) => setDateRange({...dateRange, start: e.target.value})}
              />
              <Input
                size="sm"
                type="date"
                placeholder="End Date"
                value={dateRange.end}
                onChange={(e) => setDateRange({...dateRange, end: e.target.value})}
              />
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Error Alert */}
      {error && (
        <Alert color="danger" className="mb-3">
          {error}
        </Alert>
      )}

      <Card className="shadow-sm">
        <CardBody className="p-0">
              <div className="px-3 pt-2 pb-3 md:px-4 md:pb-4">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-sm font-semibold text-gray-800">
                    Audit Trail ({filteredAuditTrail.length})
                  </h3>
                  <Button
                    size="sm"
                    color="primary"
                    variant="bordered"
                    startContent={<span>📥</span>}
                    onPress={() => downloadCSV(
                      filteredAuditTrail.map(entry => ({
                        ...entry,
                        details: entry.newValues ? JSON.stringify(entry.newValues) : (entry.oldValues ? JSON.stringify(entry.oldValues) : ''),
                      })),
                      'audit_trail',
                      [
                        { key: 'timestamp', label: 'Timestamp' },
                        { key: 'userId', label: 'User' },
                        { key: 'action', label: 'Action' },
                        { key: 'tableName', label: 'Table' },
                        { key: 'recordId', label: 'Record ID' },
                        { key: 'details', label: 'Details' },
                      ]
                    )}
                  >
                    Export
                  </Button>
                </div>

                <div ref={cols.frameRef} style={cols.frameStyle}>
                  <Table aria-label="Audit Trail" removeWrapper classNames={deskResizableTableClassNames()}>
                    <TableHeader>
                      {column('timestamp', 'Timestamp')}
                      {column('user', 'User')}
                      {column('action', 'Action')}
                      {column('table', 'Table')}
                      {column('recordId', 'Record ID')}
                      {column('details', 'Details')}
                    </TableHeader>
                    <TableBody emptyContent="No audit trail entries found.">
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
                                entry.action === 'Delete' ? 'danger' : 
                                'primary'
                              } 
                              variant="flat" 
                              size="sm"
                            >
                              {entry.action}
                            </Chip>
                          </TableCell>
                          <TableCell>
                            <span className="font-mono text-sm truncate block">{entry.tableName}</span>
                          </TableCell>
                          <TableCell>
                            <span className="font-mono text-sm truncate block">{entry.recordId}</span>
                          </TableCell>
                          <TableCell>
                            <div className="max-w-xs">
                              {entry.oldValues && (
                                <div className="text-xs text-gray-500 mb-1 truncate">
                                  Old: {JSON.stringify(entry.oldValues).substring(0, 50)}...
                                </div>
                              )}
                              {entry.newValues && (
                                <div className="text-xs text-gray-500 truncate">
                                  New: {JSON.stringify(entry.newValues).substring(0, 50)}...
                                </div>
                              )}
                            </div>
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
