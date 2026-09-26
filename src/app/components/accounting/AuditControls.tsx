'use client';

import React, { useState, useMemo } from 'react';
import HeadingInfo from '../HeadingInfo';
import {
  Card, CardBody, Button, Input, Select, SelectItem,
  Table, TableHeader, TableColumn, TableBody, TableRow, TableCell,
  Chip,
  Spinner, Alert, Progress, Pagination
} from "@heroui/react";
import { useAccountingStore } from '@/app/lib/accounting/store';
import { downloadCSV } from '@/app/lib/accounting/helpers/exportHelpers';

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
  const [page, setPage] = useState(1);
  const rowsPerPage = 10;

  // Filter audit trail
  const filteredAuditTrail = useMemo(() => {
    return auditTrail.filter(entry => {
      const matchesSearch = entry.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           entry.tableName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesAction = filterAction === 'all' || entry.action === filterAction;
      const matchesTable = filterTable === 'all' || entry.tableName === filterTable;
      
      const entryDate = new Date(entry.timestamp);
      const matchesStart = !dateRange.start || entryDate >= new Date(dateRange.start);
      const matchesEnd = !dateRange.end || entryDate <= new Date(new Date(dateRange.end).setHours(23, 59, 59, 999));

      return matchesSearch && matchesAction && matchesTable && matchesStart && matchesEnd;
    });
  }, [auditTrail, searchTerm, filterAction, filterTable, dateRange]);

  // Pagination
  const paginatedAuditTrail = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    return filteredAuditTrail.slice(start, start + rowsPerPage);
  }, [filteredAuditTrail, page]);

  const auditTrailPages = Math.ceil(filteredAuditTrail.length / rowsPerPage);

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
    <div className="p-6">
      <div className="mb-6">
        <div className="flex items-center gap-1.5">
          <h1 className="text-3xl font-bold text-gray-900">🔍 Audit & Controls</h1>
          <HeadingInfo label="About audit and controls">Monitor system activities, audit trails, and internal controls</HeadingInfo>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <Card>
          <CardBody className="text-center">
            <div className="text-2xl font-bold text-blue-600">{auditTrail.length}</div>
            <div className="text-sm text-gray-600">Total Audit Entries</div>
            <Progress value={100} size="sm" color="primary" className="mt-2" />
          </CardBody>
        </Card>

        <Card>
          <CardBody className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {auditTrail.filter(entry => entry.action === 'Create').length}
            </div>
            <div className="text-sm text-gray-600">Create Operations</div>
            <Progress value={100} size="sm" color="success" className="mt-2" />
          </CardBody>
        </Card>

        <Card>
          <CardBody className="text-center">
            <div className="text-2xl font-bold text-orange-600">
              {auditTrail.filter(entry => entry.action === 'Update').length}
            </div>
            <div className="text-sm text-gray-600">Update Operations</div>
            <Progress value={100} size="sm" color="warning" className="mt-2" />
          </CardBody>
        </Card>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Input
              placeholder="Search audit trail..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              startContent={<span className="text-gray-400">🔍</span>}
            />
            
            <Select
              placeholder="Filter by Action"
              selectedKeys={[filterAction]}
              onSelectionChange={(keys) => setFilterAction(Array.from(keys)[0] as string)}
            >
              {['all', ...actions].map(action => (
                <SelectItem key={action}>{action === 'all' ? 'All Actions' : action}</SelectItem>
              ))}
            </Select>

            <Select
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
                type="date"
                placeholder="Start Date"
                value={dateRange.start}
                onChange={(e) => setDateRange({...dateRange, start: e.target.value})}
              />
              <Input
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
        <Alert color="danger" className="mb-6">
          {error}
        </Alert>
      )}

      <Card>
        <CardBody className="p-0">
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold">
                    Audit Trail ({filteredAuditTrail.length})
                  </h3>
                  <Button
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

                <Table aria-label="Audit Trail">
                  <TableHeader>
                    <TableColumn>TIMESTAMP</TableColumn>
                    <TableColumn>USER</TableColumn>
                    <TableColumn>ACTION</TableColumn>
                    <TableColumn>TABLE</TableColumn>
                    <TableColumn>RECORD ID</TableColumn>
                    <TableColumn>DETAILS</TableColumn>
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
                          <span className="font-medium">{entry.userId}</span>
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
                          <span className="font-mono text-sm">{entry.tableName}</span>
                        </TableCell>
                        <TableCell>
                          <span className="font-mono text-sm">{entry.recordId}</span>
                        </TableCell>
                        <TableCell>
                          <div className="max-w-xs">
                            {entry.oldValues && (
                              <div className="text-xs text-gray-500 mb-1">
                                Old: {JSON.stringify(entry.oldValues).substring(0, 50)}...
                              </div>
                            )}
                            {entry.newValues && (
                              <div className="text-xs text-gray-500">
                                New: {JSON.stringify(entry.newValues).substring(0, 50)}...
                              </div>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {auditTrailPages > 1 && (
                  <div className="flex justify-center mt-4">
                    <Pagination total={auditTrailPages} page={page} onChange={setPage} showControls />
                  </div>
                )}
              </div>
        </CardBody>
      </Card>
    </div>
  );
}
