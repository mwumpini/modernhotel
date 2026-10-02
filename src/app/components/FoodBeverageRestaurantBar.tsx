'use client';

import React, { useEffect, useMemo, useState } from 'react';
import HeadingInfo from './HeadingInfo';
import { Card, CardBody, Button, Input, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, Chip, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Select, SelectItem, Tabs, Tab } from "@heroui/react";
import { worksheetTableClassNames } from './frontoffice/StayWorksheetTable';
import { sizedTableClassNames, useResizableColumns } from './frontoffice/columnResize';
import { ordersStore } from '../lib/fb/ordersStore';
import { DateFilterPills, matchesDateFilter, useDateFilter } from './fb/DateFilterPills';
import { getClientTenantSubdomain } from '../lib/api/clientTenant';
import DepartmentActivityLog from './DepartmentActivityLog';
import DepartmentStaffTab from './hr/DepartmentStaffTab';
import { useDepartmentStaff } from '../lib/hr/useDepartmentStaff';

const RESTAURANT_STAFF_DEPT_HINTS = ['food', 'beverage', 'restaurant', 'bar'];
const RESTAURANT_STAFF_EXCLUDE_HINTS = ['kitchen'];

function fbHeaders() {
  return { 'Content-Type': 'application/json', 'x-tenant-subdomain': getClientTenantSubdomain() };
}

const deskTableClassNames = {
  ...worksheetTableClassNames,
  table: 'w-full min-w-max',
  th: `${worksheetTableClassNames.th} relative`,
};

type ColumnSort = { column: string; direction: 'asc' | 'desc' };

function SortHeader({
  label,
  column,
  sort,
  onSort,
}: {
  label: string;
  column: string;
  sort: ColumnSort;
  onSort: (column: string) => void;
}) {
  const active = sort.column === column;
  return (
    <button type="button" className="max-w-full truncate font-semibold text-ghana-black" onClick={() => onSort(column)}>
      {label}{active ? (sort.direction === 'asc' ? ' ↑' : ' ↓') : ''}
    </button>
  );
}

function toggleColumnSort(prev: ColumnSort, column: string): ColumnSort {
  return prev.column === column
    ? { column, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
    : { column, direction: 'asc' };
}

interface RestaurantTable {
  id: string;
  number: string;
  capacity: number;
  section?: string;
  status: 'available' | 'occupied' | 'reserved' | 'cleaning';
  createdAt?: string;
}

interface Reservation {
  id: string;
  customerName: string;
  phone: string;
  tableId?: string;
  tableNumber?: string;
  reservationDate: string;
  time: string;
  guests: number;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  specialRequests: string;
}

interface MenuItem {
  id: string;
  name: string;
  description: string;
  category: string;
  venue: string;
  price: number;
  available: boolean;
  preparationTime: number;
  allergens: string[];
  usedCount: number;
}

const TABLE_STATUSES: RestaurantTable['status'][] = ['available', 'occupied', 'reserved', 'cleaning'];

export default function FoodBeverageRestaurantBar({ panel }: { panel?: 'tables' | 'reservations' }) {
  const [selectedTab, setSelectedTab] = useState('pos-activity');
  const [storeOrders, setStoreOrders] = useState(ordersStore.all());
  React.useEffect(() => {
    const sync = () => setStoreOrders(ordersStore.all());
    sync();
    const unsub = ordersStore.subscribe(sync);
    // Pulls in real persisted order history — sync() re-runs via the subscribe
    // callback above once this resolves and notifies listeners.
    ordersStore.hydrateFromApi();
    return unsub;
  }, []);

  const [isNewReservationModalOpen, setIsNewReservationModalOpen] = useState(false);
  const [viewingReservationId, setViewingReservationId] = useState<string | null>(null);
  const [reservationSort, setReservationSort] = useState<ColumnSort>({ column: 'date', direction: 'desc' });
  const reservationCols = useResizableColumns({
    customer: 180,
    table: 100,
    date: 160,
    guests: 90,
    status: 120,
    requests: 240,
  });
  const [isNewMenuItemModalOpen, setIsNewMenuItemModalOpen] = useState(false);
  const [isNewTableModalOpen, setIsNewTableModalOpen] = useState(false);
  const [tableQuery, setTableQuery] = useState('');
  const [tableLayout, setTableLayout] = useState<'cards' | 'table'>('cards');
  const [tableSort, setTableSort] = useState<ColumnSort>({ column: 'number', direction: 'asc' });
  const tableDates = useDateFilter();
  const tableCols = useResizableColumns({
    number: 120,
    capacity: 110,
    section: 160,
    status: 160,
  });
  const [reservationQuery, setReservationQuery] = useState('');
  const reservationDates = useDateFilter();
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedVenue, setSelectedVenue] = useState('all');

  // ---------------------------------------------------------------------
  // Tables
  // ---------------------------------------------------------------------
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const reloadTables = () => {
    fetch('/api/fb/tables', { headers: fbHeaders() })
      .then((r) => (r.ok ? r.json() : { tables: [] }))
      .then((data) => setTables(data.tables || []))
      .catch(() => setTables([]));
  };
  useEffect(() => { reloadTables(); }, []);

  const [tableForm, setTableForm] = useState({ number: '', capacity: '4', section: '' });
  const submitTable = async () => {
    if (!tableForm.number) return;
    const res = await fetch('/api/fb/tables', {
      method: 'POST',
      headers: fbHeaders(),
      body: JSON.stringify({
        id: `tbl-${Date.now()}`,
        number: tableForm.number,
        capacity: Number(tableForm.capacity) || 2,
        section: tableForm.section || undefined,
      }),
    });
    if (res.ok) {
      setTableForm({ number: '', capacity: '4', section: '' });
      setIsNewTableModalOpen(false);
      reloadTables();
    }
  };
  const setTableStatus = async (table: RestaurantTable, status: RestaurantTable['status']) => {
    await fetch('/api/fb/tables', {
      method: 'POST',
      headers: fbHeaders(),
      body: JSON.stringify({ id: table.id, status }),
    });
    reloadTables();
  };

  // ---------------------------------------------------------------------
  // Reservations
  // ---------------------------------------------------------------------
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const reloadReservations = () => {
    fetch('/api/fb/reservations', { headers: fbHeaders() })
      .then((r) => (r.ok ? r.json() : { reservations: [] }))
      .then((data) => setReservations(data.reservations || []))
      .catch(() => setReservations([]));
  };
  useEffect(() => { reloadReservations(); }, []);

  const [reservationForm, setReservationForm] = useState({
    customerName: '', phone: '', date: '', time: '', guests: '2', tableId: '', specialRequests: '',
  });
  const submitReservation = async () => {
    if (!reservationForm.customerName || !reservationForm.date || !reservationForm.time) return;
    const res = await fetch('/api/fb/reservations', {
      method: 'POST',
      headers: fbHeaders(),
      body: JSON.stringify({
        id: `res-${Date.now()}`,
        customerName: reservationForm.customerName,
        phone: reservationForm.phone || undefined,
        reservationDate: reservationForm.date,
        time: reservationForm.time,
        guests: Number(reservationForm.guests) || 1,
        tableId: reservationForm.tableId || undefined,
        specialRequests: reservationForm.specialRequests || undefined,
        status: 'pending',
      }),
    });
    if (res.ok) {
      setReservationForm({ customerName: '', phone: '', date: '', time: '', guests: '2', tableId: '', specialRequests: '' });
      setIsNewReservationModalOpen(false);
      reloadReservations();
    }
  };
  const setReservationStatus = async (reservation: Reservation, status: Reservation['status']) => {
    await fetch('/api/fb/reservations', {
      method: 'POST',
      headers: fbHeaders(),
      body: JSON.stringify({ id: reservation.id, status }),
    });
    reloadReservations();
  };

  // ---------------------------------------------------------------------
  // Menu
  // ---------------------------------------------------------------------
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const reloadMenu = () => {
    fetch('/api/fb/menu?includeUsage=true', { headers: fbHeaders() })
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((data) => setMenuItems((data.items || []).map((i: any) => ({
        id: i.id,
        name: i.name,
        description: i.description || '',
        category: i.category,
        venue: i.venue,
        price: Number(i.unitPrice || 0),
        available: i.isAvailable,
        preparationTime: i.prepMinutes,
        allergens: i.allergens ? i.allergens.split(',').map((a: string) => a.trim()).filter(Boolean) : [],
        usedCount: Number(i.usedCount || 0),
      }))))
      .catch(() => setMenuItems([]));
  };
  useEffect(() => { reloadMenu(); }, []);

  const [menuForm, setMenuForm] = useState({ name: '', category: 'main-course', venue: 'restaurant', description: '', price: '0', prepTime: '15', allergens: '', aliases: '' });
  const submitMenuItem = async () => {
    if (!menuForm.name) return;
    const code = menuForm.name.toUpperCase().replace(/[^A-Z0-9]+/g, '-').slice(0, 20) + '-' + Date.now().toString().slice(-4);
    const res = await fetch('/api/fb/menu', {
      method: 'POST',
      headers: fbHeaders(),
      body: JSON.stringify({
        code,
        name: menuForm.name,
        description: menuForm.description,
        category: menuForm.category,
        venue: menuForm.venue,
        unitPrice: Number(menuForm.price) || 0,
        costPrice: 0,
        prepMinutes: Number(menuForm.prepTime) || 10,
        allergens: menuForm.allergens || undefined,
        aliases: menuForm.aliases.split(',').map((a) => a.trim()).filter(Boolean).join(',') || undefined,
      }),
    });
    if (res.ok) {
      setMenuForm({ name: '', category: 'main-course', venue: 'restaurant', description: '', price: '0', prepTime: '15', allergens: '', aliases: '' });
      setIsNewMenuItemModalOpen(false);
      reloadMenu();
    }
  };
  const toggleMenuItemAvailability = async (item: MenuItem) => {
    await fetch('/api/fb/menu', {
      method: 'PATCH',
      headers: fbHeaders(),
      body: JSON.stringify({ id: item.id, isAvailable: !item.available }),
    });
    reloadMenu();
  };

  const handleRemoveMenuItem = async (item: MenuItem) => {
    if (item.usedCount > 0) {
      if (!item.available) {
        alert(`${item.name} has ${item.usedCount} order line${item.usedCount === 1 ? '' : 's'} and cannot be deleted. It is already unavailable.`);
        return;
      }
      const { confirmDanger } = await import('./DangerConfirm');
      const retire = await confirmDanger({
        tone: 'delete',
        title: `Deactivate ${item.name}?`,
        message: `${item.name} has ${item.usedCount} order line${item.usedCount === 1 ? '' : 's'} and cannot be deleted. It will be marked Unavailable so it stays off new orders. History is kept.`,
        confirmLabel: 'Deactivate',
      });
      if (!retire) return;
      await fetch('/api/fb/menu', {
        method: 'PATCH',
        headers: fbHeaders(),
        body: JSON.stringify({ id: item.id, isAvailable: false }),
      });
      reloadMenu();
      return;
    }
    const { confirmDelete } = await import('./DangerConfirm');
    if (!(await confirmDelete(item.name, 'This menu item was never sold and will be permanently removed.'))) return;
    await fetch(`/api/fb/menu?id=${encodeURIComponent(item.id)}`, { method: 'DELETE', headers: fbHeaders() });
    reloadMenu();
  };

  const menuCategories = Array.from(new Set(menuItems.map((i) => i.category)));
  const filteredMenuItems = menuItems
    .filter((item) => selectedCategory === 'all' || item.category === selectedCategory)
    .filter((item) => selectedVenue === 'all' || item.venue === selectedVenue);
  const venueLabel = (v: string) => {
    switch (v) {
      case 'restaurant': return 'Restaurant';
      case 'bar': return 'Bar';
      case 'room_service': return 'Room Service';
      case 'pool_bar': return 'Pool Bar';
      case 'all': return 'All Venues';
      default: return v;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available': return 'success';
      case 'occupied': return 'warning';
      case 'reserved': return 'primary';
      case 'cleaning': return 'danger';
      default: return 'default';
    }
  };

  const getReservationStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return 'success';
      case 'pending': return 'warning';
      case 'cancelled': return 'danger';
      case 'completed': return 'secondary';
      default: return 'default';
    }
  };

  const staff = useDepartmentStaff(RESTAURANT_STAFF_DEPT_HINTS, RESTAURANT_STAFF_EXCLUDE_HINTS).members;
  const availableTablesCount = tables.filter((t) => t.status === 'available').length;
  const availablePct = tables.length > 0 ? ((availableTablesCount / tables.length) * 100).toFixed(1) : '0.0';
  const todayStr = new Date().toISOString().slice(0, 10);
  const todaysReservations = reservations.filter((r) => (r.reservationDate || '').slice(0, 10) === todayStr);
  const pendingReservations = todaysReservations.filter((r) => r.status === 'pending').length;
  const activeStaffCount = staff.filter((s) => s.status === 'active').length;

  const visibleTables = useMemo(() => {
    const term = tableQuery.trim().toLowerCase();
    const list = tables.filter((table) => {
      if (!matchesDateFilter(table.createdAt, tableDates.mode, tableDates.single, tableDates.from, tableDates.to)) return false;
      if (!term) return true;
      return [table.number, table.section, table.status, String(table.capacity)]
        .some((value) => String(value || '').toLowerCase().includes(term));
    });
    const direction = tableSort.direction === 'asc' ? 1 : -1;
    const value = (table: RestaurantTable) => {
      switch (tableSort.column) {
        case 'capacity': return table.capacity || 0;
        case 'section': return table.section || '';
        case 'status': return table.status || '';
        default: return table.number || '';
      }
    };
    return [...list].sort((a, b) => {
      const left = value(a);
      const right = value(b);
      if (typeof left === 'number' && typeof right === 'number') return (left - right) * direction;
      return String(left).localeCompare(String(right), undefined, { numeric: true }) * direction;
    });
  }, [tables, tableQuery, tableSort, tableDates.mode, tableDates.single, tableDates.from, tableDates.to]);

  const sortedReservations = useMemo(() => {
    const term = reservationQuery.trim().toLowerCase();
    const list = reservations.filter((reservation) => {
      if (!matchesDateFilter(reservation.reservationDate, reservationDates.mode, reservationDates.single, reservationDates.from, reservationDates.to)) return false;
      if (!term) return true;
      return [reservation.customerName, reservation.phone, reservation.tableNumber, reservation.specialRequests, reservation.status]
        .some((value) => String(value || '').toLowerCase().includes(term));
    });
    const direction = reservationSort.direction === 'asc' ? 1 : -1;
    const value = (reservation: Reservation) => {
      switch (reservationSort.column) {
        case 'customer': return reservation.customerName || '';
        case 'table': return reservation.tableNumber || '';
        case 'guests': return reservation.guests || 0;
        case 'status': return reservation.status || '';
        case 'requests': return reservation.specialRequests || '';
        default: return new Date(`${reservation.reservationDate}T${reservation.time || '00:00'}`).getTime();
      }
    };
    return [...list].sort((a, b) => {
      const left = value(a);
      const right = value(b);
      if (typeof left === 'number' && typeof right === 'number') return (left - right) * direction;
      return String(left).localeCompare(String(right)) * direction;
    });
  }, [reservations, reservationSort, reservationQuery, reservationDates.mode, reservationDates.single, reservationDates.from, reservationDates.to]);

  const embedded = Boolean(panel);
  const openReservation = viewingReservationId
    ? reservations.find((r) => r.id === viewingReservationId) ?? null
    : null;

  return (
    <div className={embedded ? 'px-2 pb-2' : 'p-6'}>
      {/* Header */}
      {!embedded && (
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-1.5">
            <h2 className="text-2xl font-bold text-ghana-black">🍽️ Food & Beverage - Restaurant & Bar</h2>
            <HeadingInfo label="About restaurant and bar">Manage tables, reservations, menu, and staff</HeadingInfo>
          </div>
        </div>
        <div className="flex gap-3">
          <Button
            color="primary"
            className="bg-ghana-green text-white"
            onClick={() => setIsNewReservationModalOpen(true)}
          >
            + New Reservation
          </Button>
          <Button
            color="secondary"
            className="bg-ghana-gold text-white"
            onClick={() => setIsNewMenuItemModalOpen(true)}
          >
            + Add Menu Item
          </Button>
        </div>
      </div>
      )}

      {/* Stats Overview */}
      {!embedded && (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card className="border-0 shadow-lg">
          <CardBody className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Available Tables</p>
                <p className="text-2xl font-bold text-ghana-black">{availableTablesCount}/{tables.length}</p>
                <p className="text-sm text-green-600">{availablePct}% available</p>
              </div>
              <div className="text-3xl">🪑</div>
            </div>
          </CardBody>
        </Card>

        <Card className="border-0 shadow-lg">
          <CardBody className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Today's Reservations</p>
                <p className="text-2xl font-bold text-ghana-black">{todaysReservations.length}</p>
                <p className="text-sm text-blue-600">{pendingReservations} pending</p>
              </div>
              <div className="text-3xl">📅</div>
            </div>
          </CardBody>
        </Card>

        <Card className="border-0 shadow-lg">
          <CardBody className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Staff</p>
                <p className="text-2xl font-bold text-ghana-black">{activeStaffCount}</p>
                <p className="text-sm text-green-600">of {staff.length} in Restaurant &amp; Bar</p>
              </div>
              <div className="text-3xl">👥</div>
            </div>
          </CardBody>
        </Card>

        <Card className="border-0 shadow-lg">
          <CardBody className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Menu Items</p>
                <p className="text-2xl font-bold text-ghana-black">{menuItems.length}</p>
                <p className="text-sm text-green-600">{menuItems.filter((i) => i.available).length} available</p>
              </div>
              <div className="text-3xl">🍽️</div>
            </div>
          </CardBody>
        </Card>
      </div>
      )}

      {/* Main Content Tabs */}
      <Card className="border-0 shadow-lg">
        <CardBody className="p-0">
          <Tabs
            selectedKey={panel || selectedTab}
            onSelectionChange={(key) => { if (!embedded) setSelectedTab(key as string); }}
            className="w-full"
            classNames={embedded ? { tabList: 'hidden', panel: 'p-0' } : undefined}
          >
            {!embedded && (
            <Tab key="pos-activity" title="📊 Transactions">
              <div className="p-6">
                <DepartmentActivityLog area="f&b" title="Transactions" showCategory />
              </div>
            </Tab>
            )}

            {(!embedded || panel === 'tables') && (
            <Tab key="tables" title="🪑 Table Management">
              <div className={embedded ? 'px-2 pb-3' : 'p-6'}>
                <div className="mb-[18px] flex flex-wrap items-center gap-2">
                  <Input
                    aria-label="Search tables"
                    placeholder="Search tables"
                    size="sm"
                    value={tableQuery}
                    onValueChange={setTableQuery}
                    isClearable
                    onClear={() => setTableQuery('')}
                    className="w-full max-w-full sm:w-56 sm:max-w-[14rem] shrink-0"
                  />
                  <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
                    <DateFilterPills
                      mode={tableDates.mode}
                      onMode={tableDates.setMode}
                      single={tableDates.single}
                      onSingle={tableDates.setSingle}
                      from={tableDates.from}
                      onFrom={tableDates.setFrom}
                      to={tableDates.to}
                      onTo={tableDates.setTo}
                    />
                    <div className="flex shrink-0 rounded-lg border border-gray-200 bg-gray-50 p-0.5">
                      <button
                        type="button"
                        className={`rounded-md px-3 min-h-8 text-sm ${tableLayout === 'cards' ? 'bg-white font-semibold text-ghana-black shadow-sm' : 'text-gray-600'}`}
                        onClick={() => setTableLayout('cards')}
                      >
                        Cards
                      </button>
                      <button
                        type="button"
                        className={`rounded-md px-3 min-h-8 text-sm ${tableLayout === 'table' ? 'bg-white font-semibold text-ghana-black shadow-sm' : 'text-gray-600'}`}
                        onClick={() => setTableLayout('table')}
                      >
                        Table
                      </button>
                    </div>
                    <Button size="sm" color="primary" variant="flat" className="shrink-0" onClick={() => setIsNewTableModalOpen(true)}>
                      + Add Table
                    </Button>
                  </div>
                </div>
                {tableLayout === 'cards' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {visibleTables.map((table) => (
                    <Card key={table.id} className={`border-2 transition-colors ${
                      table.status === 'available' ? 'border-green-200 hover:border-green-400' :
                      table.status === 'occupied' ? 'border-yellow-200 hover:border-yellow-400' :
                      table.status === 'reserved' ? 'border-blue-200 hover:border-blue-400' :
                      'border-red-200 hover:border-red-400'
                    }`}>
                      <CardBody className="p-4">
                        <div className="text-center">
                          <h3 className="text-lg font-bold text-ghana-black mb-2">Table {table.number}</h3>
                          <Chip color={getStatusColor(table.status)} size="sm" className="mb-3">
                            {table.status.charAt(0).toUpperCase() + table.status.slice(1)}
                          </Chip>
                          <p className="text-sm text-gray-600 mb-2">Capacity: {table.capacity} guests</p>
                          {table.section && (
                            <p className="text-sm text-gray-600 mb-2">Section: {table.section}</p>
                          )}
                          <Select
                            aria-label="Change table status"
                            selectedKeys={[table.status]}
                            onChange={(e) => setTableStatus(table, e.target.value as RestaurantTable['status'])}
                            size="sm"
                            className="mt-2"
                          >
                            {TABLE_STATUSES.map((s) => (
                              <SelectItem key={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>
                            ))}
                          </Select>
                        </div>
                      </CardBody>
                    </Card>
                  ))}
                  {visibleTables.length === 0 && (
                    <p className="text-gray-500 col-span-full text-center py-8">{tables.length === 0 ? 'No tables yet. Add one to get started.' : 'No tables match.'}</p>
                  )}
                </div>
                ) : (
                <div ref={tableCols.frameRef} style={tableCols.frameStyle}>
                <Table aria-label="Tables" removeWrapper classNames={sizedTableClassNames(deskTableClassNames)}>
                  <TableHeader>
                    <TableColumn className="relative" style={tableCols.style('number')}>{<SortHeader label="Table" column="number" sort={tableSort} onSort={(column) => setTableSort((prev) => toggleColumnSort(prev, column))} />}{tableCols.sizer('number', 'Table')}</TableColumn>
                    <TableColumn className="relative" style={tableCols.style('capacity')}>{<SortHeader label="Capacity" column="capacity" sort={tableSort} onSort={(column) => setTableSort((prev) => toggleColumnSort(prev, column))} />}{tableCols.sizer('capacity', 'Capacity')}</TableColumn>
                    <TableColumn className="relative" style={tableCols.style('section')}>{<SortHeader label="Section" column="section" sort={tableSort} onSort={(column) => setTableSort((prev) => toggleColumnSort(prev, column))} />}{tableCols.sizer('section', 'Section')}</TableColumn>
                    <TableColumn className="relative" style={tableCols.style('status')}>{<SortHeader label="Status" column="status" sort={tableSort} onSort={(column) => setTableSort((prev) => toggleColumnSort(prev, column))} />}{tableCols.sizer('status', 'Status')}</TableColumn>
                  </TableHeader>
                  <TableBody emptyContent={tables.length === 0 ? 'No tables yet. Add one to get started.' : 'No tables match.'}>
                    {visibleTables.map((table) => (
                      <TableRow key={table.id}>
                        <TableCell className="font-medium">Table {table.number}</TableCell>
                        <TableCell>{table.capacity} guests</TableCell>
                        <TableCell>{table.section || '—'}</TableCell>
                        <TableCell>
                          <Select
                            aria-label={`Status for table ${table.number}`}
                            selectedKeys={[table.status]}
                            onChange={(e) => setTableStatus(table, e.target.value as RestaurantTable['status'])}
                            size="sm"
                            className="max-w-[9rem]"
                          >
                            {TABLE_STATUSES.map((s) => (
                              <SelectItem key={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>
                            ))}
                          </Select>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
                )}
              </div>
            </Tab>
            )}

            {(!embedded || panel === 'reservations') && (
            <Tab key="reservations" title="📅 Reservations">
              <div className="px-2 pb-3">
                <div className="mb-[18px] flex flex-wrap items-center gap-2">
                  <Input
                    aria-label="Search reservations"
                    placeholder="Search reservations"
                    size="sm"
                    value={reservationQuery}
                    onValueChange={setReservationQuery}
                    isClearable
                    onClear={() => setReservationQuery('')}
                    className="w-full max-w-full sm:w-56 sm:max-w-[14rem] shrink-0"
                  />
                  <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
                    <DateFilterPills
                      mode={reservationDates.mode}
                      onMode={reservationDates.setMode}
                      single={reservationDates.single}
                      onSingle={reservationDates.setSingle}
                      from={reservationDates.from}
                      onFrom={reservationDates.setFrom}
                      to={reservationDates.to}
                      onTo={reservationDates.setTo}
                    />
                    {embedded && (
                      <Button size="sm" color="primary" className="shrink-0 bg-ghana-green text-white" onClick={() => setIsNewReservationModalOpen(true)}>
                        + New Reservation
                      </Button>
                    )}
                  </div>
                </div>
                <div ref={reservationCols.frameRef} style={reservationCols.frameStyle}>
                <Table aria-label="Reservations table" removeWrapper classNames={sizedTableClassNames(deskTableClassNames)}>
                  <TableHeader>
                    <TableColumn className="relative" style={reservationCols.style('customer')}>{<SortHeader label="Customer" column="customer" sort={reservationSort} onSort={(column) => setReservationSort((prev) => toggleColumnSort(prev, column))} />}{reservationCols.sizer('customer', 'Customer')}</TableColumn>
                    <TableColumn className="relative" style={reservationCols.style('table')}>{<SortHeader label="Table" column="table" sort={reservationSort} onSort={(column) => setReservationSort((prev) => toggleColumnSort(prev, column))} />}{reservationCols.sizer('table', 'Table')}</TableColumn>
                    <TableColumn className="relative" style={reservationCols.style('date')}>{<SortHeader label="Date & time" column="date" sort={reservationSort} onSort={(column) => setReservationSort((prev) => toggleColumnSort(prev, column))} />}{reservationCols.sizer('date', 'Date & time')}</TableColumn>
                    <TableColumn className="relative" style={reservationCols.style('guests')}>{<SortHeader label="Guests" column="guests" sort={reservationSort} onSort={(column) => setReservationSort((prev) => toggleColumnSort(prev, column))} />}{reservationCols.sizer('guests', 'Guests')}</TableColumn>
                    <TableColumn className="relative" style={reservationCols.style('status')}>{<SortHeader label="Status" column="status" sort={reservationSort} onSort={(column) => setReservationSort((prev) => toggleColumnSort(prev, column))} />}{reservationCols.sizer('status', 'Status')}</TableColumn>
                    <TableColumn className="relative" style={reservationCols.style('requests')}>{<SortHeader label="Special requests" column="requests" sort={reservationSort} onSort={(column) => setReservationSort((prev) => toggleColumnSort(prev, column))} />}{reservationCols.sizer('requests', 'Special requests')}</TableColumn>
                  </TableHeader>
                  <TableBody emptyContent={reservations.length === 0 ? 'No reservations yet.' : 'No reservations match.'}>
                    {sortedReservations.map((reservation) => (
                      <TableRow
                        key={reservation.id}
                        className="cursor-pointer hover:bg-gray-50"
                        onClick={() => setViewingReservationId(reservation.id)}
                      >
                        <TableCell>
                          <div className="min-w-0 whitespace-normal">
                            <p className="font-medium text-ghana-black">{reservation.customerName}</p>
                            <p className="text-xs text-gray-500">{reservation.phone}</p>
                          </div>
                        </TableCell>
                        <TableCell>{reservation.tableNumber || '—'}</TableCell>
                        <TableCell>
                          <div className="whitespace-normal">
                            <p className="font-medium">{new Date(reservation.reservationDate).toLocaleDateString()}</p>
                            <p className="text-xs text-gray-500">{reservation.time}</p>
                          </div>
                        </TableCell>
                        <TableCell>{reservation.guests} guests</TableCell>
                        <TableCell>
                          <Chip color={getReservationStatusColor(reservation.status)} size="sm" variant="flat">
                            {reservation.status.charAt(0).toUpperCase() + reservation.status.slice(1)}
                          </Chip>
                        </TableCell>
                        <TableCell>
                          <p className="min-w-0 whitespace-normal text-sm text-gray-600">
                            {reservation.specialRequests || 'None'}
                          </p>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
              </div>
            </Tab>
            )}

            {!embedded && (
            <Tab key="menu" title="🍽️ Menu Management">
              <div className="p-6">
                <div className="flex items-center gap-4 mb-4">
                  <Select
                    label="Filter by Venue"
                    placeholder="All Venues"
                    selectedKeys={[selectedVenue]}
                    onChange={(e) => setSelectedVenue(e.target.value)}
                    className="w-64"
                  >
                    {['all', 'restaurant', 'bar', 'room_service', 'pool_bar'].map((v) => (
                      <SelectItem key={v}>{venueLabel(v)}</SelectItem>
                    ))}
                  </Select>
                  <Select
                    label="Filter by Category"
                    placeholder="All Categories"
                    selectedKeys={[selectedCategory]}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="w-64"
                  >
                    {[{ id: 'all', name: 'All Categories' }, ...menuCategories.map((c) => ({ id: c, name: c }))].map((category) => (
                      <SelectItem key={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </Select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredMenuItems.map((item) => (
                    <Card key={item.id} className="border border-gray-200 hover:border-ghana-green transition-colors">
                      <CardBody className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-semibold text-ghana-black">{item.name}</h4>
                          <Chip
                            color={item.available ? 'success' : 'danger'}
                            size="sm"
                          >
                            {item.available ? 'Available' : 'Unavailable'}
                          </Chip>
                        </div>
                        <Chip size="sm" variant="flat" color="primary" className="mb-2">{venueLabel(item.venue)}</Chip>
                        <p className="text-sm text-gray-600 mb-2">{item.description}</p>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-lg font-bold text-ghana-black">₵{item.price.toFixed(2)}</span>
                          <span className="text-xs text-gray-500">⏱️ {item.preparationTime}min</span>
                        </div>
                        <div className="flex flex-wrap gap-1 mb-3">
                          {item.allergens.map((allergen, index) => (
                            <Chip key={index} size="sm" variant="flat" color="warning">
                              {allergen}
                            </Chip>
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" color="secondary" variant="flat" onClick={() => toggleMenuItemAvailability(item)}>
                            Toggle Availability
                          </Button>
                          <Button
                            size="sm"
                            color={item.usedCount > 0 ? 'warning' : 'danger'}
                            variant="flat"
                            onClick={() => handleRemoveMenuItem(item)}
                          >
                            {item.usedCount > 0 ? (item.available ? 'Deactivate' : 'Already inactive') : 'Delete'}
                          </Button>
                        </div>
                      </CardBody>
                    </Card>
                  ))}
                  {filteredMenuItems.length === 0 && (
                    <p className="text-gray-500 col-span-full text-center py-8">No menu items yet.</p>
                  )}
                </div>
              </div>
            </Tab>
            )}

            {!embedded && (
            <Tab key="staff" title="👥 Staff Management">
              <DepartmentStaffTab
                staff={staff}
                departmentLabel="Restaurant & Bar"
                overtimePermissionId="restaurant.log-overtime"
                departmentNameHints={RESTAURANT_STAFF_DEPT_HINTS}
                excludeNameHints={RESTAURANT_STAFF_EXCLUDE_HINTS}
                helperText="HR staff in a Restaurant / Bar / Food & Beverage department. Kitchen staff stay on the Kitchen tab. Names come from the HR file — this tab does not invent staff."
              />
            </Tab>
            )}
          </Tabs>
        </CardBody>
      </Card>

      {/* New Table Modal */}
      <Modal isOpen={isNewTableModalOpen} onClose={() => setIsNewTableModalOpen(false)} size="lg" scrollBehavior="inside">
        <ModalContent>
          <ModalHeader>Add New Table</ModalHeader>
          <ModalBody>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input label="Table Number" placeholder="e.g. T1" value={tableForm.number} onChange={(e) => setTableForm({ ...tableForm, number: e.target.value })} />
                <Input label="Capacity" type="number" value={tableForm.capacity} onChange={(e) => setTableForm({ ...tableForm, capacity: e.target.value })} />
              </div>
              <Input label="Section" placeholder="e.g. Patio, Main Floor" value={tableForm.section} onChange={(e) => setTableForm({ ...tableForm, section: e.target.value })} />
            </div>
          </ModalBody>
          <ModalFooter>
            <Button color="danger" variant="light" onPress={() => setIsNewTableModalOpen(false)}>
              Cancel
            </Button>
            <Button color="primary" className="bg-ghana-green text-white" onPress={submitTable}>
              Add Table
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* New Reservation Modal */}
      <Modal isOpen={!!openReservation} onClose={() => setViewingReservationId(null)} size="lg" scrollBehavior="inside">
        <ModalContent>
          <ModalHeader>Reservation</ModalHeader>
          <ModalBody>
            {openReservation && (
              <div className="space-y-2 text-sm">
                <p><span className="text-gray-500">Guest</span> · {openReservation.customerName}</p>
                <p><span className="text-gray-500">Phone</span> · {openReservation.phone || '—'}</p>
                <p><span className="text-gray-500">Table</span> · {openReservation.tableNumber || '—'}</p>
                <p><span className="text-gray-500">When</span> · {new Date(openReservation.reservationDate).toLocaleDateString()} {openReservation.time}</p>
                <p><span className="text-gray-500">Guests</span> · {openReservation.guests}</p>
                <p><span className="text-gray-500">Status</span> · {openReservation.status}</p>
                <p><span className="text-gray-500">Requests</span> · {openReservation.specialRequests || 'None'}</p>
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            {openReservation?.status === 'pending' && (
              <Button color="success" variant="flat" onPress={() => setReservationStatus(openReservation, 'confirmed')}>Confirm</Button>
            )}
            {openReservation && (openReservation.status === 'pending' || openReservation.status === 'confirmed') && (
              <Button color="danger" variant="flat" onPress={() => setReservationStatus(openReservation, 'cancelled')}>Cancel</Button>
            )}
            {openReservation?.status === 'pending' && (
              <Button color="danger" variant="light" onPress={async () => {
                const { confirmDelete } = await import('./DangerConfirm');
                if (!(await confirmDelete('this table reservation', 'A booking that never happened will be permanently removed.'))) return;
                await fetch(`/api/fb/reservations?id=${encodeURIComponent(openReservation.id)}`, { method: 'DELETE', headers: fbHeaders() });
                setViewingReservationId(null);
                reloadReservations();
              }}>Delete</Button>
            )}
            {openReservation?.status === 'confirmed' && (
              <Button color="secondary" variant="flat" onPress={() => setReservationStatus(openReservation, 'completed')}>Complete</Button>
            )}
            <Button variant="light" onPress={() => setViewingReservationId(null)}>Close</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={isNewReservationModalOpen} onClose={() => setIsNewReservationModalOpen(false)} size="2xl" scrollBehavior="inside">
        <ModalContent>
          <ModalHeader>Create New Reservation</ModalHeader>
          <ModalBody>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input label="Customer Name" placeholder="Enter customer name" value={reservationForm.customerName} onChange={(e) => setReservationForm({ ...reservationForm, customerName: e.target.value })} />
                <Input label="Phone Number" placeholder="Enter phone number" value={reservationForm.phone} onChange={(e) => setReservationForm({ ...reservationForm, phone: e.target.value })} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Input label="Date" type="date" value={reservationForm.date} onChange={(e) => setReservationForm({ ...reservationForm, date: e.target.value })} />
                <Input label="Time" type="time" value={reservationForm.time} onChange={(e) => setReservationForm({ ...reservationForm, time: e.target.value })} />
                <Input label="Number of Guests" type="number" value={reservationForm.guests} onChange={(e) => setReservationForm({ ...reservationForm, guests: e.target.value })} />
              </div>

              <Select
                label="Table Preference"
                placeholder="Select table"
                selectedKeys={reservationForm.tableId ? [reservationForm.tableId] : []}
                onChange={(e) => setReservationForm({ ...reservationForm, tableId: e.target.value })}
              >
                {tables.filter(t => t.status === 'available').map((table) => (
                  <SelectItem key={table.id}>
                    Table {table.number} ({table.capacity} guests)
                  </SelectItem>
                ))}
              </Select>

              <Input label="Special Requests" placeholder="Any special requests or notes" value={reservationForm.specialRequests} onChange={(e) => setReservationForm({ ...reservationForm, specialRequests: e.target.value })} />
            </div>
          </ModalBody>
          <ModalFooter>
            <Button color="danger" variant="light" onPress={() => setIsNewReservationModalOpen(false)}>
              Cancel
            </Button>
            <Button color="primary" className="bg-ghana-green text-white" onPress={submitReservation}>
              Create Reservation
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* New Menu Item Modal */}
      <Modal isOpen={isNewMenuItemModalOpen} onClose={() => setIsNewMenuItemModalOpen(false)} size="2xl">
        <ModalContent>
          <ModalHeader>Add New Menu Item</ModalHeader>
          <ModalBody>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input label="Item Name" placeholder="Enter item name" value={menuForm.name} onChange={(e) => setMenuForm({ ...menuForm, name: e.target.value })} />
                <Select
                  label="Venue"
                  selectedKeys={[menuForm.venue]}
                  onChange={(e) => setMenuForm({ ...menuForm, venue: e.target.value })}
                >
                  <SelectItem key="restaurant">Restaurant</SelectItem>
                  <SelectItem key="bar">Bar</SelectItem>
                  <SelectItem key="room_service">Room Service</SelectItem>
                  <SelectItem key="pool_bar">Pool Bar</SelectItem>
                </Select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Select
                  label="Category"
                  placeholder="Select category"
                  selectedKeys={[menuForm.category]}
                  onChange={(e) => setMenuForm({ ...menuForm, category: e.target.value })}
                >
                  <SelectItem key="appetizer">Appetizer</SelectItem>
                  <SelectItem key="main-course">Main Course</SelectItem>
                  <SelectItem key="dessert">Dessert</SelectItem>
                  <SelectItem key="beverage">Beverage</SelectItem>
                </Select>
              </div>

              <Input label="Description" placeholder="Enter item description" value={menuForm.description} onChange={(e) => setMenuForm({ ...menuForm, description: e.target.value })} />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input label="Price (₵)" type="number" value={menuForm.price} onChange={(e) => setMenuForm({ ...menuForm, price: e.target.value })} />
                <Input label="Preparation Time (min)" type="number" value={menuForm.prepTime} onChange={(e) => setMenuForm({ ...menuForm, prepTime: e.target.value })} />
              </div>

              <Input label="Allergens" placeholder="e.g., Peanuts, Fish, Gluten" value={menuForm.allergens} onChange={(e) => setMenuForm({ ...menuForm, allergens: e.target.value })} />
              <Input label="Short names (aliases)" placeholder="e.g., SB, Star, Club" description="Separate with commas. Staff can type any of these in the POS search to find this item." value={menuForm.aliases} onChange={(e) => setMenuForm({ ...menuForm, aliases: e.target.value })} />
            </div>
          </ModalBody>
          <ModalFooter>
            <Button color="danger" variant="light" onPress={() => setIsNewMenuItemModalOpen(false)}>
              Cancel
            </Button>
            <Button color="primary" className="bg-ghana-green text-white" onPress={submitMenuItem}>
              Add Menu Item
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
