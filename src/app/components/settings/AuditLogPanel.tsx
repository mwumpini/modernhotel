'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  Card, CardBody, Input, Button, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, Pagination, Chip,
} from '@heroui/react';
import { useSettingsStore } from '../../lib/settings/store';
import { getClientTenantSubdomain } from '../../lib/api/clientTenant';

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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (q: string, p: number) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(p), limit: String(PAGE_SIZE) });
      if (q) params.set('q', q);
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
    const t = setTimeout(() => load(search, page), 300);
    return () => clearTimeout(t);
  }, [search, page, canView, load]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const downloadCsv = async () => {
    const params = new URLSearchParams({ format: 'csv' });
    if (search) params.set('q', search);
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
        <Input
          placeholder="Search by action, entity, user, IP, or device..."
          value={search}
          onValueChange={(v) => { setSearch(v); setPage(1); }}
          className="max-w-md"
          isClearable
          onClear={() => { setSearch(''); setPage(1); }}
        />
        <Button variant="flat" onPress={downloadCsv}>Download CSV</Button>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="overflow-x-auto">
        <Table
          aria-label="Audit log"
          isStriped
          classNames={{
            base: 'overflow-x-auto',
            table: '!min-w-[66rem] !w-max !table-auto',
          }}
        >
          <TableHeader>
            <TableColumn>Time</TableColumn>
            <TableColumn>Category</TableColumn>
            <TableColumn>Action</TableColumn>
            <TableColumn>Entity</TableColumn>
            <TableColumn>Details</TableColumn>
            <TableColumn>User</TableColumn>
            <TableColumn>IP Address</TableColumn>
            <TableColumn>Device</TableColumn>
          </TableHeader>
          <TableBody emptyContent={loading ? 'Loading...' : 'No activity recorded yet.'}>
            {entries.map((e) => (
              <TableRow key={e.id}>
                <TableCell className="whitespace-nowrap">{new Date(e.createdAt).toLocaleString()}</TableCell>
                <TableCell>
                  <Chip size="sm" variant="flat" color={isSensitive(e.action) ? 'danger' : 'default'}>
                    {categoryFor(e.action)}
                  </Chip>
                </TableCell>
                <TableCell className="font-mono text-xs">{e.action}</TableCell>
                <TableCell>{e.entity}{e.entityId ? ` #${e.entityId.slice(-6)}` : ''}</TableCell>
                <TableCell className="text-xs text-gray-600 max-w-[280px]">{e.details || '—'}</TableCell>
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
