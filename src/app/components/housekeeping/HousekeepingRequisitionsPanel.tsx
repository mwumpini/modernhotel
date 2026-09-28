'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Badge,
  Button,
  Chip,
  Select,
  SelectItem,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from '@heroui/react';
import { getClientTenantSubdomain } from '../../lib/api/clientTenant';
import DepartmentRequisitionModal from '../inventory/DepartmentRequisitionModal';

function hkHeaders() {
  return { 'Content-Type': 'application/json', 'x-tenant-subdomain': getClientTenantSubdomain() };
}

interface CatalogItem {
  id: string;
  code: string;
  name: string;
  defaultCost: number;
}

interface RequisitionRow {
  id: string;
  requisitionNumber: string;
  requestedBy: string;
  requestedDate: Date;
  status: string;
  items: { itemName: string; quantity: number }[];
}

function statusColor(status: string) {
  switch (status) {
    case 'pending': return 'warning';
    case 'approved': return 'primary';
    case 'ready': return 'success';
    case 'converted-to-po': return 'secondary';
    case 'rejected': return 'danger';
    default: return 'default';
  }
}

function statusLabel(status: string) {
  return status.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function HousekeepingRequisitionsPanel() {
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [requisitions, setRequisitions] = useState<RequisitionRow[]>([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [open, setOpen] = useState(false);

  const reload = () => {
    fetch('/api/inventory/requisitions?department=housekeeping', { headers: hkHeaders() })
      .then((r) => (r.ok ? r.json() : { requisitions: [] }))
      .then((data) => setRequisitions((data.requisitions || []).map((req: any) => ({
        id: req.id,
        requisitionNumber: req.requisitionNumber,
        requestedBy: req.requestedBy,
        requestedDate: new Date(req.requestedDate || req.createdAt),
        status: req.status,
        items: (req.items || []).map((it: any) => ({ itemName: it.itemName, quantity: Number(it.quantity) })),
      }))));
  };

  useEffect(() => {
    fetch('/api/inventory/items', { headers: hkHeaders() })
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((data) => setCatalog((data.items || []).map((i: any) => ({
        id: i.id,
        code: i.code,
        name: i.name,
        defaultCost: Number(i.defaultCost || 0),
      }))));
    reload();
  }, []);

  const visible = useMemo(() => {
    const rows = statusFilter === 'all'
      ? requisitions
      : requisitions.filter((req) => req.status === statusFilter);
    return [...rows].sort((a, b) => b.requestedDate.getTime() - a.requestedDate.getTime());
  }, [requisitions, statusFilter]);

  return (
    <div className="space-y-3">
      <div className="mb-[18px] flex flex-nowrap items-center justify-between gap-2 overflow-x-auto">
        <h3 className="text-base font-semibold text-ghana-black shrink-0">Requisitions</h3>
        <Button size="sm" color="primary" onPress={() => setOpen(true)} className="shrink-0">+ Request Stock</Button>
      </div>

      <div className="mb-[18px] flex flex-nowrap items-center gap-2 overflow-x-auto">
        <Select
          size="sm"
          placeholder="Filter by status"
          selectedKeys={[statusFilter]}
          onSelectionChange={(keys) => {
            const next = Array.from(keys)[0] as string;
            if (next) setStatusFilter(next);
          }}
          className="w-44 shrink-0"
        >
          <SelectItem key="all">🔍 All Statuses</SelectItem>
          <SelectItem key="pending">⏳ Pending</SelectItem>
          <SelectItem key="approved">👍 Approved</SelectItem>
          <SelectItem key="ready">✅ Ready</SelectItem>
          <SelectItem key="rejected">❌ Rejected</SelectItem>
        </Select>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-sm text-gray-600">Filtered:</span>
          <Badge color="primary" variant="flat">{visible.length}</Badge>
        </div>
      </div>

      <Table aria-label="Housekeeping requisitions">
        <TableHeader>
          <TableColumn>REQUISITION #</TableColumn>
          <TableColumn>ITEMS</TableColumn>
          <TableColumn>REQUESTED BY</TableColumn>
          <TableColumn>REQUESTED DATE</TableColumn>
          <TableColumn>STATUS</TableColumn>
        </TableHeader>
        <TableBody
          emptyContent={
            requisitions.length === 0
              ? 'No requisitions yet — request stock from Stores using the button above.'
              : 'No requisitions match this status.'
          }
        >
          {visible.map((req) => (
            <TableRow key={req.id}>
              <TableCell className="font-medium">{req.requisitionNumber}</TableCell>
              <TableCell>
                <div className="text-sm max-w-xs">
                  <p className="font-medium text-ghana-black">
                    {req.items.length} {req.items.length === 1 ? 'item' : 'items'}
                  </p>
                  <p className="text-gray-500 text-xs" title={req.items.map((item) => `${item.itemName} (${item.quantity})`).join(', ')}>
                    {req.items.slice(0, 2).map((item) => `${item.itemName} (${item.quantity})`).join(', ')}
                    {req.items.length > 2 ? ` +${req.items.length - 2} more` : ''}
                  </p>
                </div>
              </TableCell>
              <TableCell>{req.requestedBy}</TableCell>
              <TableCell>{req.requestedDate.toLocaleDateString()}</TableCell>
              <TableCell>
                <Chip color={statusColor(req.status) as any} size="sm">
                  {statusLabel(req.status)}
                </Chip>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <DepartmentRequisitionModal
        isOpen={open}
        onClose={() => setOpen(false)}
        department="housekeeping"
        departmentLabel="Housekeeping"
        inventoryItems={catalog}
        onCreated={reload}
      />
    </div>
  );
}
