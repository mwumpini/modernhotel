'use client';

import React, { useState, useMemo } from 'react';
import { 
  Card, CardBody, Button, Input, Select, SelectItem,
  Table, TableHeader, TableColumn, TableBody, TableRow, TableCell,
  Chip,
  Tabs, Tab, Spinner, Alert, Progress
} from "@heroui/react";
import { useAccountingStore } from '@/app/lib/accounting/store';

export default function AuditControlsPage() {
  const {
    auditTrail,
    isLoading,
    error
  } = useAccountingStore();

  const [selectedTab, setSelectedTab] = useState("audit-trail");
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
      
      let matchesDate = true;
      if (dateRange.start && dateRange.end) {
        const entryDate = new Date(entry.timestamp);
        const startDate = new Date(dateRange.start);
        const endDate = new Date(dateRange.end);
        matchesDate = entryDate >= startDate && entryDate <= endDate;
      }
      
      return matchesSearch && matchesAction && matchesTable && matchesDate;
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
        <h1 className="text-3xl font-bold text-gray-900">🔍 Audit & Controls</h1>
        <p className="text-gray-600 mt-2">
          Monitor system activities, audit trails, and internal controls
        </p>
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

      {/* Main Content Tabs */}
      <Card>
        <CardBody className="p-0">
          <Tabs
            selectedKey={selectedTab}
            onSelectionChange={(key) => setSelectedTab(key as string)}
            className="w-full"
          >
            <Tab key="audit-trail" title="📋 Audit Trail">
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold">
                    Audit Trail ({filteredAuditTrail.length})
                  </h3>
                  <Button
                    color="primary"
                    variant="bordered"
                    startContent={<span>📥</span>}
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
              </div>
            </Tab>

            <Tab key="controls" title="🛡️ Internal Controls">
              <div className="p-6">
                <h3 className="text-lg font-semibold mb-4">Internal Controls</h3>
                <ul className="list-disc pl-6 text-sm text-gray-700 space-y-2">
                  <li>User actions are logged in the Audit Trail with timestamp and user ID.</li>
                  <li>Journal postings and voids generate immutable audit entries.</li>
                  <li>Bank reconciliations and period closes are recorded with user and time.</li>
                </ul>
              </div>
            </Tab>

            <Tab key="compliance" title="📋 Compliance">
              <div className="p-6">
                <h3 className="text-lg font-semibold mb-4">Compliance Reports</h3>
                <Alert color="primary">
                  For VAT, NHIL, GETFund, and Tourism Levy returns, use the Compliance module under ⚖️ Compliance & Reports. Accounting journal entries integrate via tax GL codes.
                </Alert>
              </div>
            </Tab>
          </Tabs>
        </CardBody>
      </Card>
    </div>
  );
}
