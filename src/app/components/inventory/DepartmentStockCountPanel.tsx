'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  CardBody,
  Chip,
  Divider,
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
  Textarea,
  useDisclosure,
} from '@heroui/react';
import { useSession } from 'next-auth/react';
import { getClientTenantSubdomain } from '../../lib/api/clientTenant';
import { DEPARTMENT_LOCATIONS } from '../../lib/inventory/departmentLocations';
import type { StockCount, StockCountItem } from '../../lib/inventory/models';
import { useStockStore } from '../../lib/inventory/stockStore';
import { useSettingsStore } from '../../lib/settings/store';
import { openHtmlPrintWindow } from '../../lib/print/engine';
import { trackEvent } from '../../lib/analytics/trackEvent';
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

function invHeaders() {
  return { 'Content-Type': 'application/json', 'x-tenant-subdomain': getClientTenantSubdomain() };
}

type DeptKey = keyof typeof DEPARTMENT_LOCATIONS;

interface LevelRow {
  id: string;
  code: string;
  name: string;
  onHand: number;
  defaultCost: number;
}

interface DeptLocation {
  id: string;
  code: string;
  name: string;
  type: string;
}

function linesFromLevels(rows: LevelRow[]): StockCountItem[] {
  return rows
    .filter((row) => row.onHand > 0)
    .map((row) => ({
      id: `${Date.now()}_${row.id}_${Math.random().toString(36).slice(2, 6)}`,
      itemId: row.id,
      itemCode: row.code,
      itemName: row.name,
      expectedQuantity: row.onHand,
      countedQuantity: row.onHand,
      variance: 0,
      unitCost: row.defaultCost,
      varianceValue: 0,
    }));
}

export default function DepartmentStockCountPanel({
  department,
}: {
  department: DeptKey;
}) {
  const floorName = DEPARTMENT_LOCATIONS[department].name;
  const { data: session } = useSession();
  const currentUserName = session?.user?.name || 'Staff';
  const settings = useSettingsStore();
  const {
    stockCounts,
    upsertStockCount,
    deleteStockCount,
    hydrateCountsFromApi,
  } = useStockStore();

  const canPrint = settings.hasPermission('inventory.print');
  const canEdit = settings.hasPermission('inventory.edit');
  const canDelete = settings.hasPermission('inventory.delete');
  const canVoid = settings.hasPermission('inventory.void');
  const canRun = settings.hasPermission('inventory.stock-count');

  const { isOpen: isFormOpen, onOpen: onFormOpen, onClose: onFormClose } = useDisclosure();
  const { isOpen: isViewOpen, onOpen: onViewOpen, onClose: onViewClose } = useDisclosure();

  const [locations, setLocations] = useState<DeptLocation[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [listLocationFilter, setListLocationFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<ColumnSort>({ column: 'started', direction: 'desc' });
  const cols = useResizableColumns({
    number: 128,
    location: 140,
    type: 96,
    started: 108,
    lines: 72,
    variance: 64,
    status: 112,
  });
  const [editing, setEditing] = useState<StockCount | null>(null);
  const [viewing, setViewing] = useState<StockCount | null>(null);
  const [loadingLines, setLoadingLines] = useState(false);
  const [form, setForm] = useState<{
    countNumber: string;
    countType: StockCount['countType'];
    locationId: string;
    locationName: string;
    startDate: Date;
    notes: string;
    items: StockCountItem[];
  }>({
    countNumber: '',
    countType: 'full',
    locationId: '',
    locationName: floorName,
    startDate: new Date(),
    notes: '',
    items: [],
  });

  const reloadLocations = useCallback(() => {
    fetch(`/api/inventory/stock-locations?activeOnly=1&department=${encodeURIComponent(department)}`, {
      headers: invHeaders(),
      cache: 'no-store',
    })
      .then((r) => (r.ok ? r.json() : { locations: [] }))
      .then((data) => {
        const rows: DeptLocation[] = (data.locations || []).map((loc: any) => ({
          id: loc.id,
          code: loc.code,
          name: loc.name,
          type: loc.type,
        }));
        // Ensure primary floor always appears even if department field was cleared historically
        if (!rows.some((r) => r.name === floorName)) {
          rows.unshift({
            id: `fallback_${department}`,
            code: DEPARTMENT_LOCATIONS[department].code,
            name: floorName,
            type: 'department',
          });
        }
        setLocations(rows);
      })
      .catch(() =>
        setLocations([
          {
            id: `fallback_${department}`,
            code: DEPARTMENT_LOCATIONS[department].code,
            name: floorName,
            type: 'department',
          },
        ]),
      );
  }, [department, floorName]);

  const loadLevelsForLocation = useCallback(
    async (locationId: string): Promise<LevelRow[]> => {
      if (!locationId || locationId.startsWith('fallback_')) {
        const res = await fetch(`/api/inventory/stock-levels?department=${encodeURIComponent(department)}`, {
          headers: invHeaders(),
          cache: 'no-store',
        });
        if (!res.ok) return [];
        const data = await res.json();
        return (data.items || []).map((item: any) => ({
          id: item.id,
          code: item.code,
          name: item.name,
          onHand: Number(item.onHand || 0),
          defaultCost: Number(item.defaultCost || 0),
        }));
      }
      const res = await fetch(
        `/api/inventory/stock-levels?department=${encodeURIComponent(department)}&locationId=${encodeURIComponent(locationId)}`,
        { headers: invHeaders(), cache: 'no-store' },
      );
      if (!res.ok) return [];
      const data = await res.json();
      return (data.items || []).map((item: any) => ({
        id: item.id,
        code: item.code,
        name: item.name,
        onHand: Number(item.onHand || 0),
        defaultCost: Number(item.defaultCost || 0),
      }));
    },
    [department],
  );

  useEffect(() => {
    hydrateCountsFromApi();
    reloadLocations();
  }, [hydrateCountsFromApi, reloadLocations]);

  const deptLocationNames = useMemo(
    () => new Set(locations.map((loc) => loc.name.toLowerCase())),
    [locations],
  );

  const deptCounts = useMemo(
    () =>
      stockCounts.filter((c) => {
        const name = c.location.toLowerCase();
        return deptLocationNames.has(name) || name === floorName.toLowerCase();
      }),
    [stockCounts, deptLocationNames, floorName],
  );

  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return deptCounts.filter((c) => {
      if (statusFilter !== 'all' && c.status !== statusFilter) return false;
      if (listLocationFilter !== 'all' && c.location !== listLocationFilter) return false;
      if (!term) return true;
      return (
        c.countNumber.toLowerCase().includes(term) ||
        c.location.toLowerCase().includes(term)
      );
    });
  }, [deptCounts, searchTerm, statusFilter, listLocationFilter]);

  const sorted = useMemo(() => {
    const dir = sort.direction === 'asc' ? 1 : -1;
    const startedMs = (c: StockCount) => {
      const d = c.startDate instanceof Date ? c.startDate : new Date(c.startDate);
      return d.getTime();
    };
    return [...filtered].sort((a, b) => {
      switch (sort.column) {
        case 'number':
          return a.countNumber.localeCompare(b.countNumber) * dir;
        case 'location':
          return a.location.localeCompare(b.location) * dir;
        case 'type':
          return a.countType.localeCompare(b.countType) * dir;
        case 'lines':
          return (a.items.length - b.items.length) * dir;
        case 'variance':
          return (a.varianceItems - b.varianceItems) * dir;
        case 'status':
          return a.status.localeCompare(b.status) * dir;
        case 'started':
        default:
          return (startedMs(a) - startedMs(b)) * dir;
      }
    });
  }, [filtered, sort]);

  const pages = Math.max(1, Math.ceil(sorted.length / DESK_PAGE_SIZE));
  const pageSafe = Math.min(page, pages);
  const paged = sorted.slice((pageSafe - 1) * DESK_PAGE_SIZE, pageSafe * DESK_PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [searchTerm, statusFilter, listLocationFilter, sort.column, sort.direction]);

  const openReview = (count: StockCount) => {
    setViewing(count);
    onViewOpen();
  };

  const applyLocationToForm = async (locationId: string, locationName: string) => {
    setLoadingLines(true);
    try {
      const rows = await loadLevelsForLocation(locationId);
      setForm((prev) => ({
        ...prev,
        locationId,
        locationName,
        items: linesFromLevels(rows),
      }));
    } finally {
      setLoadingLines(false);
    }
  };

  const openNew = async () => {
    setEditing(null);
    let locs = locations;
    try {
      const res = await fetch(
        `/api/inventory/stock-locations?activeOnly=1&department=${encodeURIComponent(department)}`,
        { headers: invHeaders(), cache: 'no-store' },
      );
      if (res.ok) {
        const data = await res.json();
        locs = (data.locations || []).map((loc: any) => ({
          id: loc.id,
          code: loc.code,
          name: loc.name,
          type: loc.type,
        }));
        if (!locs.some((r) => r.name === floorName)) {
          locs = [
            {
              id: `fallback_${department}`,
              code: DEPARTMENT_LOCATIONS[department].code,
              name: floorName,
              type: 'department',
            },
            ...locs,
          ];
        }
        setLocations(locs);
      }
    } catch {
      /* keep cached */
    }
    const preferred =
      locs.find((loc) => loc.name === floorName) ||
      locs[0] || {
        id: `fallback_${department}`,
        code: DEPARTMENT_LOCATIONS[department].code,
        name: floorName,
        type: 'department',
      };
    setForm({
      countNumber: settings.peekNextModuleNumber('inventory', 'stockCount'),
      countType: 'full',
      locationId: preferred.id,
      locationName: preferred.name,
      startDate: new Date(),
      notes: '',
      items: [],
    });
    onFormOpen();
    await applyLocationToForm(preferred.id, preferred.name);
  };

  const openEdit = (count: StockCount) => {
    const match = locations.find((loc) => loc.name === count.location);
    setEditing(count);
    setForm({
      countNumber: count.countNumber,
      countType: count.countType,
      locationId: match?.id || '',
      locationName: count.location,
      startDate: count.startDate instanceof Date ? count.startDate : new Date(count.startDate),
      notes: count.notes || '',
      items: count.items.map((item) => ({ ...item })),
    });
    onViewClose();
    onFormOpen();
  };

  const saveCount = () => {
    if (!form.locationName) {
      alert('Select a location to count.');
      return;
    }
    if (!form.items.length) {
      alert('No items on hand at this location yet.');
      return;
    }
    const countData: StockCount = {
      id: editing?.id || `cnt_${Date.now()}`,
      countNumber: editing
        ? form.countNumber
        : settings.getNextModuleNumber('inventory', 'stockCount'),
      countType: form.countType,
      location: form.locationName,
      startDate: form.startDate,
      status: 'in-progress',
      totalItems: form.items.length,
      countedItems: form.items.filter((i) => i.countedQuantity >= 0).length,
      varianceItems: form.items.filter((i) => i.variance !== 0).length,
      totalValue: form.items.reduce((sum, i) => sum + i.expectedQuantity * i.unitCost, 0),
      varianceValue: form.items.reduce((sum, i) => sum + Math.abs(i.varianceValue), 0),
      items: form.items,
      notes: form.notes || undefined,
      createdBy: editing?.createdBy || currentUserName,
      createdAt: editing?.createdAt || new Date(),
      updatedAt: new Date(),
    };
    upsertStockCount(countData);
    setViewing(countData);
    onFormClose();
    if (editing) onViewOpen();
    trackEvent('Stores.Issued', {
      action: editing ? 'update_dept_stock_count' : 'create_dept_stock_count',
      department,
      countNumber: countData.countNumber,
      location: countData.location,
    });
  };

  const printCount = (count: StockCount) => {
    const esc = (s: unknown) =>
      String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    const money = (n: number) =>
      `₵${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const html = `<!DOCTYPE html><html><head><title>Stock Count ${esc(count.countNumber)}</title>
      <style>body{font-family:Arial,sans-serif;padding:32px;font-size:13px}table{width:100%;border-collapse:collapse;margin-top:12px}
      th{background:#111;color:#fff;text-align:left;padding:8px}td{padding:8px;border-bottom:1px solid #eee}
      th:nth-child(n+3),td:nth-child(n+3){text-align:right}</style></head><body>
      <h1>Stock Count — ${esc(count.location)}</h1>
      <p>#${esc(count.countNumber)} · ${esc(count.countType)} · ${esc(count.status)}</p>
      <table><thead><tr><th>Code</th><th>Item</th><th>Expected</th><th>Counted</th><th>Variance</th><th>Value</th></tr></thead>
      <tbody>${count.items
        .map(
          (item) => `<tr><td>${esc(item.itemCode)}</td><td>${esc(item.itemName)}</td>
        <td>${esc(item.expectedQuantity)}</td><td>${esc(item.countedQuantity)}</td>
        <td>${item.variance > 0 ? '+' : ''}${esc(item.variance)}</td><td>${money(Math.abs(item.varianceValue))}</td></tr>`,
        )
        .join('')}</tbody></table></body></html>`;
    openHtmlPrintWindow(html);
  };

  const voidCount = (count: StockCount) => {
    if (count.status === 'completed' || count.status === 'cancelled') return;
    if (!confirm(`Void stock count ${count.countNumber}?`)) return;
    const updated: StockCount = {
      ...count,
      status: 'cancelled',
      endDate: new Date(),
      updatedAt: new Date(),
    };
    upsertStockCount(updated);
    setViewing(updated);
  };

  const removeCount = (count: StockCount) => {
    if (count.status === 'completed') return;
    if (!confirm(`Delete stock count ${count.countNumber}?`)) return;
    deleteStockCount(count.id);
    setViewing(null);
    onViewClose();
  };

  const completeCount = async (count: StockCount) => {
    if (!confirm(`Complete this stock count? Variances will adjust on-hand at ${count.location}.`)) return;
    try {
      const res = await fetch('/api/inventory/stock-counts/complete', {
        method: 'POST',
        headers: invHeaders(),
        body: JSON.stringify({
          id: count.id,
          department,
          performedBy: currentUserName,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || 'Could not complete count');
        return;
      }
      const data = await res.json();
      const raw = data.count;
      const updated: StockCount = {
        ...count,
        status: 'completed',
        endDate: raw?.endDate ? new Date(raw.endDate) : new Date(),
        updatedAt: new Date(),
      };
      upsertStockCount(updated);
      setViewing(updated);
      trackEvent('Stores.Issued', {
        action: 'complete_dept_stock_count',
        department,
        countNumber: count.countNumber,
        location: count.location,
      });
    } catch {
      alert('Could not complete count');
    }
  };

  return (
    <div className="space-y-3">
      <div className="mb-[18px] flex flex-nowrap items-center justify-between gap-2 overflow-x-auto">
        <h3 className="text-lg font-semibold text-ghana-black shrink-0">Stock Count</h3>
        {canRun && (
          <Button size="sm" color="primary" className="bg-ghana-gold text-white" variant="flat" onPress={openNew}>
            + New Count
          </Button>
        )}
      </div>

      <div className="mb-[18px] flex flex-nowrap items-center gap-2 overflow-x-auto">
        <Input
          size="sm"
          placeholder="Search count # or location..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          startContent={<span className="text-gray-400">🔍</span>}
          className="w-64 shrink-0"
        />
        <Select
          size="sm"
          selectedKeys={[listLocationFilter]}
          onSelectionChange={(keys) => setListLocationFilter(Array.from(keys)[0] as string)}
          aria-label="Filter by location"
          className="w-44 shrink-0"
        >
          <>
            <SelectItem key="all">All locations</SelectItem>
            {locations.map((loc) => (
              <SelectItem key={loc.name}>{loc.name}</SelectItem>
            ))}
          </>
        </Select>
        <Select
          size="sm"
          selectedKeys={[statusFilter]}
          onSelectionChange={(keys) => setStatusFilter(Array.from(keys)[0] as string)}
          aria-label="Filter by status"
          className="w-40 shrink-0"
        >
          <SelectItem key="all">All Status</SelectItem>
          <SelectItem key="planned">Planned</SelectItem>
          <SelectItem key="in-progress">In Progress</SelectItem>
          <SelectItem key="completed">Completed</SelectItem>
          <SelectItem key="cancelled">Cancelled</SelectItem>
        </Select>
      </div>

      <Card className={deskTableCardClassName}>
        <CardBody className={deskTableCardBodyClassName}>
          <div ref={cols.frameRef} style={cols.frameStyle}>
            <Table aria-label={`${floorName} stock counts`} removeWrapper classNames={sizedTableClassNames(deskTableClassNames)}>
              <TableHeader>
                <TableColumn className="relative" style={cols.style('number')}>{<SortHeader label="Count #" column="number" sort={sort} onSort={(column) => setSort((prev) => toggleColumnSort(prev, column))} />}{cols.sizer('number', 'Count #')}</TableColumn>
                <TableColumn className="relative" style={cols.style('location')}>{<SortHeader label="Location" column="location" sort={sort} onSort={(column) => setSort((prev) => toggleColumnSort(prev, column))} />}{cols.sizer('location', 'Location')}</TableColumn>
                <TableColumn className="relative" style={cols.style('type')}>{<SortHeader label="Type" column="type" sort={sort} onSort={(column) => setSort((prev) => toggleColumnSort(prev, column))} />}{cols.sizer('type', 'Type')}</TableColumn>
                <TableColumn className="relative" style={cols.style('started')}>{<SortHeader label="Started" column="started" sort={sort} onSort={(column) => setSort((prev) => toggleColumnSort(prev, column))} />}{cols.sizer('started', 'Started')}</TableColumn>
                <TableColumn className="relative" style={cols.style('lines')}>{<SortHeader label="Lines" column="lines" sort={sort} onSort={(column) => setSort((prev) => toggleColumnSort(prev, column))} align="right" />}{cols.sizer('lines', 'Lines')}</TableColumn>
                <TableColumn className="relative" style={cols.style('variance')}>{<SortHeader label="Δ" column="variance" sort={sort} onSort={(column) => setSort((prev) => toggleColumnSort(prev, column))} align="right" />}{cols.sizer('variance', 'Variance')}</TableColumn>
                <TableColumn className="relative" style={cols.style('status')}>{<SortHeader label="Status" column="status" sort={sort} onSort={(column) => setSort((prev) => toggleColumnSort(prev, column))} />}{cols.sizer('status', 'Status')}</TableColumn>
              </TableHeader>
              <TableBody emptyContent="No counts yet for this department.">
                {paged.map((count) => (
                  <TableRow
                    key={count.id}
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => openReview(count)}
                  >
                    <TableCell>
                      <span className="text-gray-600 whitespace-nowrap">{count.countNumber}</span>
                    </TableCell>
                    <TableCell className="truncate" title={count.location}>
                      {count.location}
                    </TableCell>
                    <TableCell>
                      <Chip size="sm" variant="flat" className="capitalize">
                        {count.countType}
                      </Chip>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {count.startDate instanceof Date
                        ? count.startDate.toLocaleDateString()
                        : new Date(count.startDate).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <span className="block text-right tabular-nums">{count.items.length}</span>
                    </TableCell>
                    <TableCell className={count.varianceItems > 0 ? 'font-semibold text-orange-600' : ''}>
                      <span className="block text-right tabular-nums">{count.varianceItems}</span>
                    </TableCell>
                    <TableCell>
                      <Badge
                        color={
                          count.status === 'completed'
                            ? 'success'
                            : count.status === 'in-progress'
                              ? 'warning'
                              : count.status === 'cancelled'
                                ? 'danger'
                                : 'default'
                        }
                        size="sm"
                        variant="flat"
                        className="capitalize"
                      >
                        {count.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="mt-3 flex justify-end">
            <Pagination page={pageSafe} total={pages} onChange={setPage} showControls size="sm" />
          </div>
        </CardBody>
      </Card>

      <Modal isOpen={isFormOpen} onClose={onFormClose} size="4xl" scrollBehavior="inside">
        <ModalContent>
          <ModalHeader>{editing ? 'Edit Stock Count' : 'Create Stock Count'}</ModalHeader>
          <ModalBody>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Count #"
                  value={form.countNumber}
                  isReadOnly
                  classNames={{ input: 'font-mono font-semibold' }}
                />
                <Select
                  label="Count Type"
                  selectedKeys={[form.countType]}
                  onSelectionChange={(keys) =>
                    setForm({
                      ...form,
                      countType: Array.from(keys)[0] as StockCount['countType'],
                    })
                  }
                >
                  <SelectItem key="full">Full Count</SelectItem>
                  <SelectItem key="cycle">Cycle Count</SelectItem>
                  <SelectItem key="spot">Spot Count</SelectItem>
                  <SelectItem key="random">Random Count</SelectItem>
                </Select>
                <Select
                  label="Location"
                  selectedKeys={form.locationId ? [form.locationId] : form.locationName ? [form.locationName] : []}
                  isDisabled={Boolean(editing)}
                  isRequired
                  description={
                    locations.length <= 1
                      ? 'Add fridges/stores under Settings → Stock Locations and assign this department'
                      : 'Floor, fridges, and outlets tagged to this department'
                  }
                  onSelectionChange={(keys) => {
                    const key = Array.from(keys)[0] as string;
                    if (!key) return;
                    const loc = locations.find((row) => row.id === key || row.name === key);
                    if (!loc) return;
                    void applyLocationToForm(loc.id, loc.name);
                  }}
                >
                  <>
                    {locations.map((loc) => (
                      <SelectItem key={loc.id} textValue={loc.name}>
                        {loc.name}
                      </SelectItem>
                    ))}
                  </>
                </Select>
                <Input
                  label="Start Date"
                  type="date"
                  value={form.startDate.toISOString().split('T')[0]}
                  onChange={(e) => setForm({ ...form, startDate: new Date(e.target.value) })}
                />
              </div>
              {loadingLines ? (
                <p className="text-sm text-gray-500">Loading items for {form.locationName}…</p>
              ) : form.items.length > 0 ? (
                <>
                  <Divider />
                  <Table>
                    <TableHeader>
                      <TableColumn>Item</TableColumn>
                      <TableColumn>Book</TableColumn>
                      <TableColumn>Counted</TableColumn>
                      <TableColumn>Δ</TableColumn>
                    </TableHeader>
                    <TableBody>
                      {form.items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>
                            <div className="font-mono text-sm font-semibold">{item.itemCode}</div>
                            <div className="text-sm text-gray-500">{item.itemName}</div>
                          </TableCell>
                          <TableCell className="font-semibold">{item.expectedQuantity}</TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              size="sm"
                              min={0}
                              value={String(item.countedQuantity)}
                              onChange={(e) => {
                                const counted = parseInt(e.target.value, 10) || 0;
                                const variance = counted - item.expectedQuantity;
                                setForm({
                                  ...form,
                                  items: form.items.map((row) =>
                                    row.id === item.id
                                      ? {
                                          ...row,
                                          countedQuantity: counted,
                                          variance,
                                          varianceValue: Math.abs(variance * row.unitCost),
                                        }
                                      : row,
                                  ),
                                });
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <span
                              className={
                                item.variance > 0
                                  ? 'text-green-600 font-semibold'
                                  : item.variance < 0
                                    ? 'text-red-600 font-semibold'
                                    : 'text-gray-600'
                              }
                            >
                              {item.variance > 0 ? '+' : ''}
                              {item.variance}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </>
              ) : (
                <p className="text-sm text-amber-600">
                  No on-hand stock at {form.locationName || 'this location'} yet.
                </p>
              )}
              <Textarea
                label="Notes"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="bordered" onPress={onFormClose}>
              Cancel
            </Button>
            <Button
              color="primary"
              className="bg-ghana-gold text-white"
              onPress={saveCount}
              isDisabled={loadingLines}
            >
              {editing ? 'Update' : 'Save'} Count
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={isViewOpen} onClose={onViewClose} size="4xl" scrollBehavior="inside">
        <ModalContent>
          <ModalHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="text-xl font-semibold">Stock Count Details</div>
              <div className="text-sm text-gray-500 font-mono">{viewing?.countNumber}</div>
            </div>
            {viewing && (
              <div className="flex flex-wrap items-center gap-1 border-b border-default-200 pb-0.5" role="tablist">
                {canPrint && (
                  <Button size="sm" variant="light" className="min-w-16 h-8 rounded-none" onPress={() => printCount(viewing)}>
                    Print
                  </Button>
                )}
                {canEdit && (
                  <Button
                    size="sm"
                    variant="light"
                    className="min-w-16 h-8 rounded-none"
                    isDisabled={viewing.status === 'completed' || viewing.status === 'cancelled'}
                    onPress={() => openEdit(viewing)}
                  >
                    Edit
                  </Button>
                )}
                {canDelete && (
                  <Button
                    size="sm"
                    variant="light"
                    color="danger"
                    className="min-w-16 h-8 rounded-none"
                    isDisabled={viewing.status === 'completed'}
                    onPress={() => removeCount(viewing)}
                  >
                    Delete
                  </Button>
                )}
                {canVoid && (
                  <Button
                    size="sm"
                    variant="light"
                    color="warning"
                    className="min-w-16 h-8 rounded-none"
                    isDisabled={viewing.status === 'completed' || viewing.status === 'cancelled'}
                    onPress={() => voidCount(viewing)}
                  >
                    Void
                  </Button>
                )}
              </div>
            )}
          </ModalHeader>
          <ModalBody>
            {viewing && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Location</div>
                    <div className="font-semibold">{viewing.location}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Status</div>
                    <Badge
                      color={
                        viewing.status === 'completed'
                          ? 'success'
                          : viewing.status === 'in-progress'
                            ? 'warning'
                            : viewing.status === 'cancelled'
                              ? 'danger'
                              : 'default'
                      }
                      variant="flat"
                      className="capitalize"
                    >
                      {viewing.status}
                    </Badge>
                  </div>
                </div>
                <Divider />
                <Table>
                  <TableHeader>
                    <TableColumn>Code</TableColumn>
                    <TableColumn>Item</TableColumn>
                    <TableColumn>Expected</TableColumn>
                    <TableColumn>Counted</TableColumn>
                    <TableColumn>Variance</TableColumn>
                  </TableHeader>
                  <TableBody>
                    {viewing.items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-mono">{item.itemCode}</TableCell>
                        <TableCell>{item.itemName}</TableCell>
                        <TableCell>{item.expectedQuantity}</TableCell>
                        <TableCell>{item.countedQuantity}</TableCell>
                        <TableCell>
                          <span
                            className={
                              item.variance > 0
                                ? 'text-green-600'
                                : item.variance < 0
                                  ? 'text-red-600'
                                  : 'text-gray-600'
                            }
                          >
                            {item.variance > 0 ? '+' : ''}
                            {item.variance}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="bordered" onPress={onViewClose}>
              Close
            </Button>
            {viewing?.status === 'in-progress' && canRun && (
              <Button color="success" onPress={() => completeCount(viewing)}>
                Complete & Post
              </Button>
            )}
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
