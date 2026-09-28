'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  CardBody,
  Chip,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Pagination,
  Select,
  SelectItem,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from '@heroui/react';
import { sizedTableClassNames, useResizableColumns } from '../frontoffice/columnResize';
import {
  DESK_PAGE_SIZE,
  deskTableCardBodyClassName,
  deskTableCardClassName,
  deskTableClassNames,
  SortHeader,
  toggleColumnSort,
  type ColumnSort,
} from '../dashboard/deskTableUi';
import { DateFilterPills, matchesDateFilter, useDateFilter } from '../fb/DateFilterPills';
import { getClientTenantSubdomain } from '../../lib/api/clientTenant';
import { HideCardButton } from '../dashboard/CustomizeViewControl';

function tenantHeaders() {
  return { 'Content-Type': 'application/json', 'x-tenant-subdomain': getClientTenantSubdomain() };
}

function stockLevelLabel(onHand: number, reorder: number, minimum: number) {
  if (onHand <= 0) return { label: 'Out', color: 'danger' as const };
  const floor = Math.max(reorder, minimum);
  if (floor > 0 && onHand <= floor) return { label: 'Low', color: 'warning' as const };
  return { label: 'OK', color: 'success' as const };
}

export type DepartmentInventoryKey = 'restaurant' | 'kitchen' | 'housekeeping';

interface InventoryItem {
  id: string;
  code: string;
  name: string;
  description: string;
  category: string;
  unit: string;
  defaultCost: number;
  sellingPrice: number;
  reorderPoint: number;
  minimumStock: number;
  maximumStock: number;
  isActive: boolean;
  createdAt?: string;
}

const DEPT_LABEL: Record<DepartmentInventoryKey, string> = {
  restaurant: 'Restaurant',
  kitchen: 'Kitchen',
  housekeeping: 'Housekeeping',
};

/**
 * Shared department Inventory tab: desk table, on-hand vs reorder/min/max,
 * Level chip, view on row click, Edit levels. SKUs are created in Stores.
 */
export default function DepartmentInventoryPanel({
  department,
  hideStats = false,
  onHideStats,
}: {
  department: DepartmentInventoryKey;
  hideStats?: boolean;
  onHideStats?: () => void;
}) {
  const label = DEPT_LABEL[department];
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [stockOnHand, setStockOnHand] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const dates = useDateFilter();
  const [sort, setSort] = useState<ColumnSort>({ column: 'item', direction: 'asc' });
  const [page, setPage] = useState(1);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [levelsForm, setLevelsForm] = useState({ reorderPoint: '0', minimumStock: '0', maximumStock: '0' });
  const [isSaving, setIsSaving] = useState(false);

  const cols = useResizableColumns({
    code: 100,
    item: 180,
    category: 110,
    onHand: 80,
    reorder: 80,
    min: 70,
    max: 70,
    unit: 70,
    stock: 90,
    status: 90,
  });

  const reloadItems = () =>
    fetch('/api/inventory/items', { headers: tenantHeaders() })
      .then(async (r) => {
        if (!r.ok) throw new Error('Could not load inventory catalog');
        return r.json();
      })
      .then((data) => {
        setItems(
          (data.items || []).map((i: any) => ({
            id: i.id,
            code: i.code,
            name: i.name,
            description: i.description || '',
            category: i.category?.name || '—',
            unit: i.unit?.name || '—',
            defaultCost: Number(i.defaultCost || 0),
            sellingPrice: Number(i.sellingPrice || 0),
            reorderPoint: Number(i.reorderLevel ?? i.reorderPoint ?? 0),
            minimumStock: Number(i.minimumStock || 0),
            maximumStock: Number(i.maximumStock || 0),
            isActive: i.isActive !== false,
            createdAt: i.createdAt,
          })),
        );
      });

  const reloadStockLevels = () =>
    fetch(`/api/inventory/stock-levels?department=${department}`, { headers: tenantHeaders() })
      .then(async (r) => {
        if (!r.ok) throw new Error('Could not load stock levels');
        return r.json();
      })
      .then((data) =>
        setStockOnHand(
          Object.fromEntries((data.items || []).map((i: any) => [i.id, Number(i.onHand || 0)])),
        ),
      );

  const reloadAll = () => {
    setLoading(true);
    setLoadError(null);
    Promise.all([reloadItems(), reloadStockLevels()])
      .catch((err: unknown) => {
        setLoadError(err instanceof Error ? err.message : 'Could not load inventory');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    reloadAll();
    const onFocus = () => {
      reloadItems().catch(() => {});
      reloadStockLevels().catch(() => {});
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when department changes
  }, [department]);

  useEffect(() => {
    setPage(1);
  }, [query, statusFilter, dates.mode, dates.single, dates.from, dates.to, sort.column, sort.direction]);

  const openLevelsEditor = (item: InventoryItem) => {
    setViewingId(null);
    setEditingItem(item);
    setLevelsForm({
      reorderPoint: String(item.reorderPoint ?? 0),
      minimumStock: String(item.minimumStock ?? 0),
      maximumStock: String(item.maximumStock ?? 0),
    });
  };

  const closeLevelsEditor = () => {
    setEditingItem(null);
    setLevelsForm({ reorderPoint: '0', minimumStock: '0', maximumStock: '0' });
  };

  const submitLevels = async () => {
    if (!editingItem) return;
    setIsSaving(true);
    try {
      const res = await fetch('/api/inventory/items', {
        method: 'PATCH',
        headers: tenantHeaders(),
        body: JSON.stringify({
          id: editingItem.id,
          reorderPoint: Number(levelsForm.reorderPoint) || 0,
          minimumStock: Number(levelsForm.minimumStock) || 0,
          maximumStock: Number(levelsForm.maximumStock) || 0,
        }),
      });
      if (res.ok) {
        closeLevelsEditor();
        reloadItems();
      } else {
        const err = await res.json().catch(() => ({}));
        alert((err as { error?: string }).error || 'Could not save stock levels');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const queryText = query.trim().toLowerCase();
  const filtered = items.filter((item) => {
    if (statusFilter === 'active' && !item.isActive) return false;
    if (statusFilter === 'inactive' && item.isActive) return false;
    if (statusFilter === 'low') {
      const onHand = stockOnHand[item.id] ?? 0;
      if (stockLevelLabel(onHand, item.reorderPoint, item.minimumStock).label === 'OK') return false;
    }
    if (!matchesDateFilter(item.createdAt, dates.mode, dates.single, dates.from, dates.to)) return false;
    if (!queryText) return true;
    return [item.code, item.name, item.description, item.category, item.unit]
      .some((value) => String(value || '').toLowerCase().includes(queryText));
  });

  const sorted = useMemo(() => {
    const direction = sort.direction === 'asc' ? 1 : -1;
    const value = (item: InventoryItem) => {
      switch (sort.column) {
        case 'code': return item.code || '';
        case 'category': return item.category || '';
        case 'onHand': return stockOnHand[item.id] ?? 0;
        case 'reorder': return item.reorderPoint || 0;
        case 'min': return item.minimumStock || 0;
        case 'max': return item.maximumStock || 0;
        case 'unit': return item.unit || '';
        case 'stock': {
          const onHand = stockOnHand[item.id] ?? 0;
          return stockLevelLabel(onHand, item.reorderPoint, item.minimumStock).label;
        }
        case 'status': return item.isActive ? 'Active' : 'Inactive';
        default: return item.name || '';
      }
    };
    return [...filtered].sort((a, b) => {
      const left = value(a);
      const right = value(b);
      if (typeof left === 'number' && typeof right === 'number') return (left - right) * direction;
      return String(left).localeCompare(String(right)) * direction;
    });
  }, [filtered, sort, stockOnHand]);

  const pages = Math.max(1, Math.ceil(sorted.length / DESK_PAGE_SIZE));
  const pageSafe = Math.min(page, pages);
  const paged = sorted.slice((pageSafe - 1) * DESK_PAGE_SIZE, pageSafe * DESK_PAGE_SIZE);

  const openItem = viewingId ? items.find((item) => item.id === viewingId) ?? null : null;

  const stockStats = useMemo(() => {
    let active = 0;
    let ok = 0;
    let low = 0;
    let out = 0;
    for (const item of items) {
      if (item.isActive) active += 1;
      const level = stockLevelLabel(stockOnHand[item.id] ?? 0, item.reorderPoint, item.minimumStock).label;
      if (level === 'OK') ok += 1;
      else if (level === 'Low') low += 1;
      else out += 1;
    }
    return { total: items.length, active, ok, low, out };
  }, [items, stockOnHand]);

  return (
    <div className="space-y-3">
      {!hideStats && (
        <div className="flex items-start gap-1">
          <div className="grid min-w-0 flex-1 grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {([
              { label: 'Total', value: stockStats.total, tone: 'text-ghana-black' },
              { label: 'Active', value: stockStats.active, tone: 'text-blue-700' },
              { label: 'OK', value: stockStats.ok, tone: 'text-green-700' },
              { label: 'Low', value: stockStats.low, tone: 'text-yellow-700' },
              { label: 'Out', value: stockStats.out, tone: 'text-red-700' },
            ] as const).map((stat) => (
              <Card key={stat.label} className="border border-gray-200 shadow-none">
                <CardBody className="px-2 py-1.5 text-center">
                  <div className={`text-base font-semibold tabular-nums ${stat.tone}`}>{stat.value}</div>
                  <div className="text-xs leading-tight text-gray-500">{stat.label}</div>
                </CardBody>
              </Card>
            ))}
          </div>
          {onHideStats && <HideCardButton onHide={onHideStats} label="Inventory summary" />}
        </div>
      )}

      <div className="mb-[18px] flex flex-nowrap items-center gap-2 overflow-x-auto">
        <Input
          aria-label="Search inventory"
          placeholder="Search inventory"
          size="sm"
          value={query}
          onValueChange={setQuery}
          isClearable
          onClear={() => setQuery('')}
          className="w-56 shrink-0"
        />
        <Select
          aria-label="Filter by status"
          placeholder="All items"
          size="sm"
          selectedKeys={[statusFilter]}
          onSelectionChange={(keys) => {
            const next = Array.from(keys)[0] as string;
            if (next) setStatusFilter(next);
          }}
          className="w-44 shrink-0"
        >
          <SelectItem key="all">All items</SelectItem>
          <SelectItem key="active">Active</SelectItem>
          <SelectItem key="inactive">Inactive</SelectItem>
          <SelectItem key="low">Low / out of stock</SelectItem>
        </Select>
        <p className="text-sm text-gray-500 shrink-0 whitespace-nowrap">
          Catalog {items.length} · Showing {filtered.length}
          {loading ? ' · Loading…' : ''}
        </p>
        <div className="ml-auto flex flex-nowrap items-center justify-end gap-2">
          <DateFilterPills
            mode={dates.mode}
            onMode={dates.setMode}
            single={dates.single}
            onSingle={dates.setSingle}
            from={dates.from}
            onFrom={dates.setFrom}
            to={dates.to}
            onTo={dates.setTo}
          />
        </div>
      </div>

      {loadError && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-danger-200 bg-danger-50 px-3 py-2 text-sm text-danger">
          <span>{loadError}</span>
          <Button size="sm" variant="flat" color="danger" onPress={reloadAll}>
            Retry
          </Button>
        </div>
      )}

      <Card className={deskTableCardClassName}>
        <CardBody className={deskTableCardBodyClassName}>
          <div ref={cols.frameRef} style={cols.frameStyle}>
            <Table aria-label={`${label} inventory`} removeWrapper classNames={sizedTableClassNames(deskTableClassNames)}>
              <TableHeader>
                <TableColumn className="relative" style={cols.style('code')}>{<SortHeader label="Code" column="code" sort={sort} onSort={(column) => setSort((prev) => toggleColumnSort(prev, column))} />}{cols.sizer('code', 'Code')}</TableColumn>
                <TableColumn className="relative" style={cols.style('item')}>{<SortHeader label="Item" column="item" sort={sort} onSort={(column) => setSort((prev) => toggleColumnSort(prev, column))} />}{cols.sizer('item', 'Item')}</TableColumn>
                <TableColumn className="relative" style={cols.style('category')}>{<SortHeader label="Category" column="category" sort={sort} onSort={(column) => setSort((prev) => toggleColumnSort(prev, column))} />}{cols.sizer('category', 'Category')}</TableColumn>
                <TableColumn className="relative" style={cols.style('onHand')}>{<SortHeader label="On hand" column="onHand" sort={sort} onSort={(column) => setSort((prev) => toggleColumnSort(prev, column))} align="right" />}{cols.sizer('onHand', 'On hand')}</TableColumn>
                <TableColumn className="relative" style={cols.style('reorder')}>{<SortHeader label="Reorder" column="reorder" sort={sort} onSort={(column) => setSort((prev) => toggleColumnSort(prev, column))} align="right" />}{cols.sizer('reorder', 'Reorder')}</TableColumn>
                <TableColumn className="relative" style={cols.style('min')}>{<SortHeader label="Min" column="min" sort={sort} onSort={(column) => setSort((prev) => toggleColumnSort(prev, column))} align="right" />}{cols.sizer('min', 'Min')}</TableColumn>
                <TableColumn className="relative" style={cols.style('max')}>{<SortHeader label="Max" column="max" sort={sort} onSort={(column) => setSort((prev) => toggleColumnSort(prev, column))} align="right" />}{cols.sizer('max', 'Max')}</TableColumn>
                <TableColumn className="relative" style={cols.style('unit')}>{<SortHeader label="Unit" column="unit" sort={sort} onSort={(column) => setSort((prev) => toggleColumnSort(prev, column))} />}{cols.sizer('unit', 'Unit')}</TableColumn>
                <TableColumn className="relative" style={cols.style('stock')}>{<SortHeader label="Level" column="stock" sort={sort} onSort={(column) => setSort((prev) => toggleColumnSort(prev, column))} />}{cols.sizer('stock', 'Level')}</TableColumn>
                <TableColumn className="relative" style={cols.style('status')}>{<SortHeader label="Status" column="status" sort={sort} onSort={(column) => setSort((prev) => toggleColumnSort(prev, column))} />}{cols.sizer('status', 'Status')}</TableColumn>
              </TableHeader>
              <TableBody
                items={paged}
                isLoading={loading}
                emptyContent={
                  loading
                    ? 'Loading inventory…'
                    : items.length === 0
                      ? 'No inventory items. Add SKUs in Stores.'
                      : 'No inventory items match.'
                }
              >
                {(item) => {
                  const onHand = stockOnHand[item.id] ?? 0;
                  const level = stockLevelLabel(onHand, item.reorderPoint, item.minimumStock);
                  return (
                    <TableRow
                      key={item.id}
                      className="cursor-pointer hover:bg-gray-50"
                      onClick={() => setViewingId(item.id)}
                    >
                      <TableCell className="whitespace-nowrap">{item.code}</TableCell>
                      <TableCell>
                        <p className="font-medium text-ghana-black truncate" title={item.name}>{item.name}</p>
                      </TableCell>
                      <TableCell>
                        <Chip size="sm" variant="flat">{item.category || '—'}</Chip>
                      </TableCell>
                      <TableCell>
                        <span className={`block text-right tabular-nums ${level.label !== 'OK' ? 'text-danger font-semibold' : 'font-medium'}`}>
                          {onHand}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="block text-right tabular-nums">{item.reorderPoint}</span>
                      </TableCell>
                      <TableCell>
                        <span className="block text-right tabular-nums">{item.minimumStock}</span>
                      </TableCell>
                      <TableCell>
                        <span className="block text-right tabular-nums">{item.maximumStock}</span>
                      </TableCell>
                      <TableCell>{item.unit || '—'}</TableCell>
                      <TableCell>
                        <Chip color={level.color} size="sm" variant="flat">{level.label}</Chip>
                      </TableCell>
                      <TableCell>
                        <Chip color={item.isActive ? 'success' : 'default'} size="sm" variant="flat">
                          {item.isActive ? 'Active' : 'Inactive'}
                        </Chip>
                      </TableCell>
                    </TableRow>
                  );
                }}
              </TableBody>
            </Table>
          </div>
          <div className="mt-3 flex justify-end">
            <Pagination page={pageSafe} total={pages} onChange={setPage} showControls size="sm" />
          </div>
        </CardBody>
      </Card>

      <Modal isOpen={!!openItem} onClose={() => setViewingId(null)} size="lg">
        <ModalContent>
          <ModalHeader className="flex items-center gap-3">
            <span>{openItem?.name}</span>
            {openItem && (() => {
              const level = stockLevelLabel(
                stockOnHand[openItem.id] ?? 0,
                openItem.reorderPoint,
                openItem.minimumStock,
              );
              return <Chip color={level.color} size="sm" variant="flat">{level.label}</Chip>;
            })()}
          </ModalHeader>
          <ModalBody>
            {openItem && (
              <div className="space-y-4">
                <p className="text-xs text-gray-400">{openItem.code} · {openItem.category}</p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    ['On hand', String(stockOnHand[openItem.id] ?? 0)],
                    ['Reorder', String(openItem.reorderPoint)],
                    ['Minimum', String(openItem.minimumStock)],
                    ['Maximum', String(openItem.maximumStock)],
                  ].map(([field, value]) => (
                    <div key={field} className="rounded-lg border border-gray-200 px-3 py-2">
                      <p className="text-xs text-gray-500">{field}</p>
                      <p className="font-semibold tabular-nums text-ghana-black">{value}</p>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <div className="rounded-lg border border-gray-200 px-3 py-2">
                    <p className="text-xs text-gray-500">Unit</p>
                    <p className="font-medium text-ghana-black">{openItem.unit || '—'}</p>
                  </div>
                  <div className="rounded-lg border border-gray-200 px-3 py-2">
                    <p className="text-xs text-gray-500">Default cost</p>
                    <p className="font-semibold tabular-nums text-ghana-black">₵{openItem.defaultCost.toFixed(2)}</p>
                  </div>
                  <div className="rounded-lg border border-gray-200 px-3 py-2">
                    <p className="text-xs text-gray-500">Selling price</p>
                    <p className="font-semibold tabular-nums text-ghana-black">₵{openItem.sellingPrice.toFixed(2)}</p>
                  </div>
                </div>
                <Chip color={openItem.isActive ? 'success' : 'default'} size="sm" variant="flat">
                  {openItem.isActive ? 'Active' : 'Inactive'}
                </Chip>
                {openItem.description && <p className="text-sm text-gray-700">{openItem.description}</p>}
                <p className="text-sm text-gray-500">
                  On hand is {label} stock. Reorder / min / max are on the shared SKU. New items are added in Stores.
                </p>
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            {openItem && (
              <Button variant="flat" onPress={() => openLevelsEditor(openItem)}>Edit levels</Button>
            )}
            <Button variant="light" onPress={() => setViewingId(null)}>Close</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={!!editingItem} onClose={closeLevelsEditor} size="md">
        <ModalContent>
          <ModalHeader>Edit stock levels — {editingItem?.name}</ModalHeader>
          <ModalBody>
            <p className="text-sm text-gray-500 -mt-1">
              Changes apply to the shared SKU used by Stores and this department.
            </p>
            {editingItem && (
              <p className="text-sm text-gray-600">
                {editingItem.code} · On hand:{' '}
                <span className="font-semibold tabular-nums">{stockOnHand[editingItem.id] ?? 0}</span>
                {' '}{editingItem.unit}
              </p>
            )}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Input
                label="Reorder"
                type="number"
                min={0}
                value={levelsForm.reorderPoint}
                onChange={(e) => setLevelsForm({ ...levelsForm, reorderPoint: e.target.value })}
                description="Alert at or below"
              />
              <Input
                label="Minimum"
                type="number"
                min={0}
                value={levelsForm.minimumStock}
                onChange={(e) => setLevelsForm({ ...levelsForm, minimumStock: e.target.value })}
              />
              <Input
                label="Maximum"
                type="number"
                min={0}
                value={levelsForm.maximumStock}
                onChange={(e) => setLevelsForm({ ...levelsForm, maximumStock: e.target.value })}
                description="Par / capacity"
              />
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={closeLevelsEditor}>Cancel</Button>
            <Button color="primary" className="bg-ghana-green text-white" onPress={submitLevels} isLoading={isSaving}>
              Save levels
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
