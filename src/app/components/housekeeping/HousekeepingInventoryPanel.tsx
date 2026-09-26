'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Badge,
  Card,
  CardBody,
  Chip,
  Input,
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

function hkHeaders() {
  return { 'x-tenant-subdomain': getClientTenantSubdomain() };
}

interface StockRow {
  id: string;
  code: string;
  name: string;
  category: string;
  unit: string;
  onHand: number;
}

export default function HousekeepingInventoryPanel() {
  const [rows, setRows] = useState<StockRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const reload = () => {
    fetch('/api/inventory/stock-levels?department=housekeeping', { headers: hkHeaders() })
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((data) => {
        setRows(
          (data.items || [])
            .map((item: any) => ({
              id: item.id,
              code: item.code,
              name: item.name,
              category: item.category || '—',
              unit: item.unit || '—',
              onHand: Number(item.onHand || 0),
            }))
            .filter((item: StockRow) => item.onHand > 0),
        );
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  };

  useEffect(() => {
    reload();
    const onFocus = () => reload();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  const categories = useMemo(
    () => Array.from(new Set(rows.map((row) => row.category).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [rows],
  );

  const filtered = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return rows
      .filter((row) => {
        if (categoryFilter !== 'all' && row.category !== categoryFilter) return false;
        if (!query) return true;
        return row.name.toLowerCase().includes(query) || row.code.toLowerCase().includes(query);
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [rows, searchTerm, categoryFilter]);

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        This is Housekeeping’s own stock — soap, towels and the rest Stores has marked Ready. It is separate from what Stores, Kitchen or Restaurant hold. Finishing a room task uses it up. Request more on the Requisitions tab.
      </p>

      <Card className="border-0 shadow-lg">
        <CardBody className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input
              placeholder="Search item or code..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              startContent={<span className="text-gray-400">🔍</span>}
            />
            <Select
              placeholder="Filter by category"
              selectedKeys={[categoryFilter]}
              onSelectionChange={(keys) => {
                const next = Array.from(keys)[0] as string;
                if (next) setCategoryFilter(next);
              }}
            >
              {[
                <SelectItem key="all">All Categories</SelectItem>,
                ...categories.map((category) => (
                  <SelectItem key={category}>{category}</SelectItem>
                )),
              ]}
            </Select>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">Filtered:</span>
              <Badge color="primary" variant="flat">{filtered.length}</Badge>
            </div>
          </div>
        </CardBody>
      </Card>

      <Table aria-label="Housekeeping inventory">
        <TableHeader>
          <TableColumn>ITEM</TableColumn>
          <TableColumn>CATEGORY</TableColumn>
          <TableColumn>ON HAND</TableColumn>
          <TableColumn>UNIT</TableColumn>
        </TableHeader>
        <TableBody
          emptyContent={
            !loaded
              ? 'Loading stock…'
              : rows.length === 0
              ? 'Nothing on hand yet. When Stores marks a requisition Ready, those items show up here.'
              : 'No items match these filters.'
          }
        >
          {filtered.map((item) => (
            <TableRow key={item.id}>
              <TableCell>
                <div>
                  <p className="font-medium text-ghana-black">{item.name}</p>
                  <p className="text-sm text-gray-600">{item.code}</p>
                </div>
              </TableCell>
              <TableCell>
                <Chip size="sm" variant="flat" color="primary">{item.category}</Chip>
              </TableCell>
              <TableCell>
                <span className="font-semibold">{item.onHand}</span>
              </TableCell>
              <TableCell>{item.unit}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
