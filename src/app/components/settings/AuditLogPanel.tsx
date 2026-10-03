'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Card, CardBody, Input, Button, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, Pagination, Chip,
} from '@heroui/react';
import { useSettingsStore } from '../../lib/settings/store';
import { getClientTenantSubdomain } from '../../lib/api/clientTenant';
import { SortLabel, deskResizableTableClassNames, useResizableColumns } from '../frontoffice/columnResize';

function auditHeaders(): HeadersInit {
  return { 'x-tenant-subdomain': getClientTenantSubdomain() };
}

interface AuditLogEntry {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  userName: string | null;
  userEmail: string | null;
  ipAddress: string | null;
  createdAt: string;
  details: string;
  device: string | null;
}

/** Coarse module tag derived from the action name — no schema/column needed. */
function categoryFor(action: string): string {
  if (action.startsWith('USER_')) return 'Auth';
  if (action.startsWith('SECURITY_')) return 'Security';
  if (action.startsWith('HR_')) return 'HR';
  if (action.startsWith('FB_') || action.startsWith('RESTAURANT_') || action.startsWith('RECIPE') || action.startsWith('TABLE_')) return 'F&B';
  if (action.startsWith('INVOICE') || action.startsWith('PAYMENT') || action.startsWith('JOURNAL')) return 'Accounting';
  if (action.startsWith('HOUSEKEEPING') || action.startsWith('ROOM_') || action.startsWith('MAINTENANCE')) return 'Housekeeping';
  if (action.startsWith('EVENT') || action.startsWith('CONFERENCE') || action.startsWith('CATERING')) return 'Events';
  if (action.startsWith('GUEST_SERVICE') || action.startsWith('SERVICE_REQUEST')) return 'Guest Services';
  if (action.startsWith('RESERVATION') || action.startsWith('GUEST_') || action.startsWith('FOLIO')) return 'Front Desk';
  if (action.startsWith('SUPPLIER') || action.startsWith('INVENTORY') || action.startsWith('STOCK')) return 'Inventory';
  return 'System';
}

/** Actions worth calling out visually — logins, removals, and reversals carry more audit weight than routine saves. */
const SENSITIVE_MARKERS = ['LOGIN', 'DELET', 'CANCEL', 'VOID', 'DEACTIVAT', 'REJECT'];
function isSensitive(action: string): boolean {
  return SENSITIVE_MARKERS.some((m) => action.includes(m));
}

const PAGE_SIZE = 50;

type AuditCol = 'time' | 'category' | 'action' | 'entity' | 'details' | 'user' | 'ip' | 'device';

const COLUMNS: { key: AuditCol; label: string }[] = [
  { key: 'time', label: 'Time' },
  { key: 'category', label: 'Category' },
  { key: 'action', label: 'Action' },
  { key: 'entity', label: 'Entity' },
  { key: 'details', label: 'Details' },
  { key: 'user', label: 'User' },
  { key: 'ip', label: 'IP Address' },
  { key: 'device', label: 'Device' },
];

const COLUMN_WIDTHS: Record<AuditCol, number> = {
  time: 176,
  category: 132,
  action: 188,
  entity: 150,
  details: 280,
  user: 210,
  ip: 140,
  device: 170,
};

/**
 * Read-only viewer for the audit_logs table: who did what, and who logged in
 * when, from which machine (IP). Kept intentionally simple — one searchable
 * table plus a CSV download, no charts or heavy client-side state.
 */
export default function AuditLogPanel() {
  const settings = useSettingsStore();
  const canView = settings.hasPermission('settings.view-audit-log');

  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [sort, setSort] = useState<{ key: AuditCol; dir: 'asc' | 'desc' }>({ key: 'time', dir: 'desc' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cols = useResizableColumns<AuditCol>(COLUMN_WIDTHS, { flexKeys: ['details', 'user'] });

  const load = useCallback(async (q: string, p: number, fromDate: string, toDate: string, sortKey: AuditCol, sortDir: 'asc' | 'desc') => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(p), limit: String(PAGE_SIZE), sort: sortKey, dir: sortDir });
      if (q) params.set('q', q);
      if (fromDate) params.set('from', fromDate);
      if (toDate) params.set('to', toDate);
      const res = await fetch(`/api/audit-logs?${params.toString()}`, { headers: auditHeaders() });
      if (!res.ok) throw new Error(res.status === 403 ? 'You do not have permission to view the audit log.' : 'Failed to load audit log');
      const data = await res.json();
      setEntries(data.entries);
      setTotal(data.total);
    } catch (e: any) {
      setError(e.message || 'Failed to load audit log');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!canView) return;
    const t = setTimeout(() => load(search, page, from, to, sort.key, sort.dir), 300);
    return () => clearTimeout(t);
  }, [search, page, from, to, sort, canView, load]);

  const onSort = (key: AuditCol) => {
    setSort((current) => (
      current.key === key
        ? { key, dir: current.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: 'asc' }
    ));
    setPage(1);
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const shown = useMemo(() => {
    if (sort.key !== 'category' && sort.key !== 'user' && sort.key !== 'details' && sort.key !== 'device') return entries;
    const text = (e: AuditLogEntry) => {
      if (sort.key === 'category') return categoryFor(e.action);
      if (sort.key === 'user') return `${e.userName || ''} ${e.userEmail || ''}`.trim();
      if (sort.key === 'details') return e.details || '';
      return e.device || '';
    };
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...entries].sort((a, b) => text(a).localeCompare(text(b)) * dir);
  }, [entries, sort]);

  const downloadCsv = async () => {
    const params = new URLSearchParams({ format: 'csv', sort: sort.key, dir: sort.dir });
    if (search) params.set('q', search);
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const res = await fetch(`/api/audit-logs?${params.toString()}`, { headers: auditHeaders() });
    if (!res.ok) { setError('Failed to download audit log'); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  if (!canView) {
    return (
      <Card className="mt-4">
        <CardBody className="text-sm text-gray-600">
          You do not have permission to view the audit log.
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="mt-2 space-y-3">
      <div className="flex flex-col md:flex-row md:items-center gap-3 md:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
          <Input
            placeholder="Search by action, entity, user, IP, or device..."
            value={search}
            onValueChange={(v) => { setSearch(v); setPage(1); }}
            className="w-full sm:max-w-md"
            isClearable
            onClear={() => { setSearch(''); setPage(1); }}
            aria-label="Search the audit log"
          />
          <Input
            type="date"
            label="From"
            size="sm"
            value={from}
            onValueChange={(v) => { setFrom(v); setPage(1); }}
            className="w-full sm:w-40"
          />
          <Input
            type="date"
            label="To"
            size="sm"
            value={to}
            onValueChange={(v) => { setTo(v); setPage(1); }}
            className="w-full sm:w-40"
          />
          {(from || to) && (
            <Button size="sm" variant="light" onPress={() => { setFrom(''); setTo(''); setPage(1); }}>
              Clear dates
            </Button>
          )}
        </div>
        <Button variant="flat" onPress={downloadCsv}>Download CSV</Button>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      <div ref={cols.frameRef} style={cols.frameStyle} className="overflow-x-auto">
        <Table
          aria-label="Audit log"
          isStriped
          removeWrapper
          classNames={deskResizableTableClassNames()}
        >
          <TableHeader>
            {COLUMNS.map((col) => (
              <TableColumn key={col.key} className="relative" style={cols.style(col.key)}>
                <SortLabel active={sort.key === col.key} dir={sort.dir} onPress={() => onSort(col.key)}>
                  {col.label}
                </SortLabel>
                {cols.sizer(col.key, col.label)}
              </TableColumn>
            ))}
          </TableHeader>
          <TableBody emptyContent={loading ? 'Loading...' : 'No activity recorded yet.'}>
            {shown.map((e) => (
              <TableRow key={e.id}>
                <TableCell className="whitespace-nowrap">{new Date(e.createdAt).toLocaleString()}</TableCell>
                <TableCell>
                  <Chip size="sm" variant="flat" color={isSensitive(e.action) ? 'danger' : 'default'}>
                    {categoryFor(e.action)}
                  </Chip>
                </TableCell>
                <TableCell className="font-mono text-xs">{e.action}</TableCell>
                <TableCell>{e.entity}{e.entityId ? ` #${e.entityId.slice(-6)}` : ''}</TableCell>
                <TableCell className="text-xs text-gray-600"><span className="block truncate" title={e.details || undefined}>{e.details || '—'}</span></TableCell>
                <TableCell>{e.userName ? `${e.userName}${e.userEmail ? ` (${e.userEmail})` : ''}` : '—'}</TableCell>
                <TableCell className="font-mono text-xs">{e.ipAddress || '—'}</TableCell>
                <TableCell className="text-xs text-gray-600 whitespace-nowrap">{e.device || '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center">
          <Pagination total={totalPages} page={page} onChange={setPage} />
        </div>
      )}
    </div>
  );
}
