'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardBody, Button, Input, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, Chip, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Select, SelectItem, Badge, Tabs, Tab } from "@heroui/react";
import { ordersStore } from '../lib/fb/ordersStore';
import { getClientTenantSubdomain } from '../lib/api/clientTenant';
import DepartmentActivityLog from './DepartmentActivityLog';

function fbHeaders() {
  return { 'Content-Type': 'application/json', 'x-tenant-subdomain': getClientTenantSubdomain() };
}

interface RestaurantTable {
  id: string;
  number: string;
  capacity: number;
  section?: string;
  status: 'available' | 'occupied' | 'reserved' | 'cleaning';
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
}

interface StaffMember {
  id: string;
  name: string;
  position: string;
  department: string;
  employmentType: string;
  status: string;
}

const TABLE_STATUSES: RestaurantTable['status'][] = ['available', 'occupied', 'reserved', 'cleaning'];

export default function FoodBeverageRestaurantBar() {
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
  const [isNewMenuItemModalOpen, setIsNewMenuItemModalOpen] = useState(false);
  const [isNewTableModalOpen, setIsNewTableModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedVenue, setSelectedVenue] = useState('all');

  // ---------------------------------------------------------------------
  // Tables
  // ---------------------------------------------------------------------
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const reloadTables = () => {
    fetch('/api/fb/tables', { headers: fbHeaders() })
      .then((r) => (r.ok ? r.json() : { tables: [] }))
      .then((data) => setTables(data.tables || []));
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
      .then((data) => setReservations(data.reservations || []));
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
    fetch('/api/fb/menu', { headers: fbHeaders() })
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
      }))));
  };
  useEffect(() => { reloadMenu(); }, []);

  const [menuForm, setMenuForm] = useState({ name: '', category: 'main-course', venue: 'restaurant', description: '', price: '0', prepTime: '15', allergens: '' });
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
      }),
    });
    if (res.ok) {
      setMenuForm({ name: '', category: 'main-course', venue: 'restaurant', description: '', price: '0', prepTime: '15', allergens: '' });
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

  // ---------------------------------------------------------------------
  // Staff — sourced from real HR employee/department/position records,
  // filtered to F&B-relevant departments. Shift and per-table assignment
  // aren't tracked anywhere yet, so they're intentionally left off rather
  // than fabricated.
  // ---------------------------------------------------------------------
  const [staff, setStaff] = useState<StaffMember[]>([]);
  useEffect(() => {
    Promise.all([
      fetch('/api/hr/employees', { headers: fbHeaders() }).then((r) => (r.ok ? r.json() : { employees: [] })),
      fetch('/api/hr/departments', { headers: fbHeaders() }).then((r) => (r.ok ? r.json() : { departments: [] })),
      fetch('/api/hr/positions', { headers: fbHeaders() }).then((r) => (r.ok ? r.json() : { positions: [] })),
    ]).then(([empData, deptData, posData]) => {
      const departments = deptData.departments || [];
      const positions = posData.positions || [];
      const fbDeptIds = new Set(
        departments
          .filter((d: any) => /food|beverage|restaurant|bar|kitchen/i.test(d.name || ''))
          .map((d: any) => d.id)
      );
      const deptById = new Map<string, string>(departments.map((d: any) => [d.id, d.name]));
      const posById = new Map<string, string>(positions.map((p: any) => [p.id, p.title]));
      const employees = (empData.employees || []) as any[];
      setStaff(
        employees
          .filter((e) => fbDeptIds.has(e.departmentId))
          .map((e) => ({
            id: e.id,
            name: `${e.firstName} ${e.lastName}`,
            position: posById.get(e.positionId) || 'Unassigned',
            department: deptById.get(e.departmentId) || 'Unknown',
            employmentType: e.employmentType,
            status: e.status,
          }))
      );
    });
  }, []);

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

  const getStaffStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'success';
      case 'on_leave': return 'warning';
      case 'suspended': return 'danger';
      case 'terminated': return 'danger';
      default: return 'default';
    }
  };

  const availableTablesCount = tables.filter((t) => t.status === 'available').length;
  const availablePct = tables.length > 0 ? ((availableTablesCount / tables.length) * 100).toFixed(1) : '0.0';
  const todayStr = new Date().toISOString().slice(0, 10);
  const todaysReservations = reservations.filter((r) => (r.reservationDate || '').slice(0, 10) === todayStr);
  const pendingReservations = todaysReservations.filter((r) => r.status === 'pending').length;
  const activeStaffCount = staff.filter((s) => s.status === 'active').length;

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-ghana-black">🍽️ Food & Beverage - Restaurant & Bar</h2>
          <p className="text-gray-600">Manage tables, reservations, menu, and staff</p>
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

      {/* Stats Overview */}
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
                <p className="text-sm text-green-600">of {staff.length} in F&B</p>
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

      {/* Main Content Tabs */}
      <Card className="border-0 shadow-lg">
        <CardBody className="p-0">
          <Tabs
            selectedKey={selectedTab}
            onSelectionChange={(key) => setSelectedTab(key as string)}
            className="w-full"
          >
            <Tab key="pos-activity" title="📊 POS Activity Table">
              <div className="p-6">
                <DepartmentActivityLog area="f&b" title="POS Activity Table" showCategory showAlias />
              </div>
            </Tab>

            <Tab key="tables" title="🪑 Table Management">
              <div className="p-6">
                <div className="flex justify-end mb-4">
                  <Button size="sm" color="primary" variant="flat" onClick={() => setIsNewTableModalOpen(true)}>
                    + Add Table
                  </Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {tables.map((table) => (
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
                  {tables.length === 0 && (
                    <p className="text-gray-500 col-span-full text-center py-8">No tables yet. Add one to get started.</p>
                  )}
                </div>
              </div>
            </Tab>

            <Tab key="reservations" title="📅 Reservations">
              <div className="p-6">
                <div className="max-h-[560px] overflow-y-auto">
                  <Table aria-label="Reservations table">
                    <TableHeader>
                      <TableColumn>CUSTOMER</TableColumn>
                      <TableColumn>TABLE</TableColumn>
                      <TableColumn>DATE & TIME</TableColumn>
                      <TableColumn>GUESTS</TableColumn>
                      <TableColumn>STATUS</TableColumn>
                      <TableColumn>SPECIAL REQUESTS</TableColumn>
                      <TableColumn>ACTIONS</TableColumn>
                    </TableHeader>
                    <TableBody emptyContent="No reservations yet.">
                      {reservations.map((reservation) => (
                        <TableRow key={reservation.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium text-ghana-black">{reservation.customerName}</p>
                              <p className="text-sm text-gray-600">{reservation.phone}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge color="primary" variant="flat">{reservation.tableNumber || '—'}</Badge>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{new Date(reservation.reservationDate).toLocaleDateString()}</p>
                              <p className="text-sm text-gray-600">{reservation.time}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge color="secondary" variant="flat">{reservation.guests} guests</Badge>
                          </TableCell>
                          <TableCell>
                            <Chip color={getReservationStatusColor(reservation.status)} size="sm">
                              {reservation.status.charAt(0).toUpperCase() + reservation.status.slice(1)}
                            </Chip>
                          </TableCell>
                          <TableCell>
                            <p className="text-sm text-gray-600 max-w-xs truncate">
                              {reservation.specialRequests || 'None'}
                            </p>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              {reservation.status === 'pending' && (
                                <Button size="sm" color="success" variant="flat" onClick={() => setReservationStatus(reservation, 'confirmed')}>Confirm</Button>
                              )}
                              {(reservation.status === 'pending' || reservation.status === 'confirmed') && (
                                <Button size="sm" color="danger" variant="flat" onClick={() => setReservationStatus(reservation, 'cancelled')}>Cancel</Button>
                              )}
                              {reservation.status === 'confirmed' && (
                                <Button size="sm" color="secondary" variant="flat" onClick={() => setReservationStatus(reservation, 'completed')}>Complete</Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </Tab>

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

            <Tab key="staff" title="👥 Staff Management">
              <div className="p-6">
                <p className="text-sm text-gray-500 mb-4">
                  Staff sourced from HR records for Food &amp; Beverage-related departments. Shift scheduling and per-table
                  assignment aren't tracked yet — manage those in the HR module once that's built out.
                </p>
                <Table aria-label="Staff table">
                  <TableHeader>
                    <TableColumn>STAFF MEMBER</TableColumn>
                    <TableColumn>POSITION</TableColumn>
                    <TableColumn>DEPARTMENT</TableColumn>
                    <TableColumn>EMPLOYMENT TYPE</TableColumn>
                    <TableColumn>STATUS</TableColumn>
                  </TableHeader>
                  <TableBody emptyContent="No F&B staff found in HR records.">
                    {staff.map((member) => (
                      <TableRow key={member.id}>
                        <TableCell>
                          <p className="font-medium text-ghana-black">{member.name}</p>
                        </TableCell>
                        <TableCell>{member.position}</TableCell>
                        <TableCell>{member.department}</TableCell>
                        <TableCell>
                          <Badge color="primary" variant="flat">{member.employmentType}</Badge>
                        </TableCell>
                        <TableCell>
                          <Chip color={getStaffStatusColor(member.status)} size="sm">
                            {member.status.charAt(0).toUpperCase() + member.status.slice(1).replace('_', ' ')}
                          </Chip>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Tab>
          </Tabs>
        </CardBody>
      </Card>

      {/* New Table Modal */}
      <Modal isOpen={isNewTableModalOpen} onClose={() => setIsNewTableModalOpen(false)} size="lg">
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
      <Modal isOpen={isNewReservationModalOpen} onClose={() => setIsNewReservationModalOpen(false)} size="2xl">
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
