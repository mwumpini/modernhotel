'use client';

import React, { useState } from 'react';
import { Card, CardBody, Button, Input, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, Chip, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Select, SelectItem, Badge, Tabs, Tab } from "@heroui/react";
import { ordersStore } from '../lib/fb/ordersStore';
import DepartmentActivityLog from './DepartmentActivityLog';

interface Table {
  id: string;
  number: string;
  capacity: number;
  status: 'available' | 'occupied' | 'reserved' | 'cleaning';
  currentOrder?: string;
  server?: string;
  reservationTime?: Date;
}

interface Reservation {
  id: string;
  customerName: string;
  phone: string;
  tableNumber: string;
  date: Date;
  time: string;
  guests: number;
  status: 'confirmed' | 'pending' | 'cancelled' | 'completed';
  specialRequests: string;
}

interface MenuCategory {
  id: string;
  name: string;
  items: MenuItem[];
}

interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  available: boolean;
  preparationTime: number;
  allergens: string[];
  image?: string;
}

interface Staff {
  id: string;
  name: string;
  role: 'waiter' | 'bartender' | 'host' | 'manager';
  status: 'on-duty' | 'off-duty' | 'break';
  assignedTables: string[];
  shift: 'morning' | 'afternoon' | 'evening' | 'night';
}

export default function FoodBeverageRestaurantBar() {
  const [selectedTab, setSelectedTab] = useState('pos-activity');
  const [storeOrders, setStoreOrders] = useState(ordersStore.all());
  React.useEffect(() => {
    const sync = () => setStoreOrders(ordersStore.all());
    sync();
    return ordersStore.subscribe(sync);
  }, []);
  const [isNewReservationModalOpen, setIsNewReservationModalOpen] = useState(false);
  const [isNewMenuItemModalOpen, setIsNewMenuItemModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');

  // Sample data
  const tables: Table[] = [
    { id: '1', number: 'T1', capacity: 4, status: 'occupied', currentOrder: 'ORD001', server: 'Kwame' },
    { id: '2', number: 'T2', capacity: 2, status: 'available' },
    { id: '3', number: 'T3', capacity: 6, status: 'reserved', reservationTime: new Date(Date.now() + 30 * 60000) },
    { id: '4', number: 'T4', capacity: 4, status: 'cleaning' },
    { id: '5', number: 'T5', capacity: 8, status: 'occupied', currentOrder: 'ORD002', server: 'Ama' },
    { id: '6', number: 'T6', capacity: 2, status: 'available' },
    { id: '7', number: 'T7', capacity: 4, status: 'available' },
    { id: '8', number: 'T8', capacity: 6, status: 'reserved', reservationTime: new Date(Date.now() + 60 * 60000) },
  ];

  const reservations: Reservation[] = [
    {
      id: 'RES001',
      customerName: 'Kwame Asante',
      phone: '+233 24 123 4567',
      tableNumber: 'T3',
      date: new Date(),
      time: '19:00',
      guests: 4,
      status: 'confirmed',
      specialRequests: 'Window seat preferred'
    },
    {
      id: 'RES002',
      customerName: 'Ama Osei',
      phone: '+233 20 987 6543',
      tableNumber: 'T8',
      date: new Date(),
      time: '20:30',
      guests: 6,
      status: 'confirmed',
      specialRequests: 'Birthday celebration'
    },
    {
      id: 'RES003',
      customerName: 'Kofi Mensah',
      phone: '+233 26 555 1234',
      tableNumber: 'T2',
      date: new Date(),
      time: '18:00',
      guests: 2,
      status: 'pending',
      specialRequests: ''
    }
  ];

  const menuCategories: MenuCategory[] = [
    {
      id: '1',
      name: 'Appetizers',
      items: [
        { id: '1', name: 'Kelewele', description: 'Spicy fried plantains', price: 12.00, category: 'Appetizers', available: true, preparationTime: 8, allergens: ['None'] },
        { id: '2', name: 'Peanut Soup', description: 'Rich groundnut soup with meat', price: 18.00, category: 'Appetizers', available: true, preparationTime: 15, allergens: ['Peanuts'] },
        { id: '3', name: 'Grilled Fish', description: 'Fresh tilapia with herbs', price: 25.00, category: 'Appetizers', available: true, preparationTime: 20, allergens: ['Fish'] }
      ]
    },
    {
      id: '2',
      name: 'Main Courses',
      items: [
        { id: '4', name: 'Jollof Rice', description: 'Traditional Ghanaian rice dish', price: 28.00, category: 'Main Courses', available: true, preparationTime: 25, allergens: ['None'] },
        { id: '5', name: 'Banku & Tilapia', description: 'Fermented corn with grilled fish', price: 35.00, category: 'Main Courses', available: true, preparationTime: 30, allergens: ['Fish', 'Corn'] },
        { id: '6', name: 'Fufu & Light Soup', description: 'Pounded yam with chicken soup', price: 32.00, category: 'Main Courses', available: true, preparationTime: 28, allergens: ['None'] }
      ]
    },
    {
      id: '3',
      name: 'Beverages',
      items: [
        { id: '7', name: 'Palm Wine', description: 'Traditional palm wine', price: 15.00, category: 'Beverages', available: true, preparationTime: 5, allergens: ['None'] },
        { id: '8', name: 'Fresh Coconut', description: 'Natural coconut water', price: 8.00, category: 'Beverages', available: true, preparationTime: 3, allergens: ['None'] },
        { id: '9', name: 'Ghanaian Coffee', description: 'Local coffee blend', price: 12.00, category: 'Beverages', available: true, preparationTime: 8, allergens: ['None'] }
      ]
    }
  ];

  const staff: Staff[] = [
    { id: '1', name: 'Kwame Asante', role: 'waiter', status: 'on-duty', assignedTables: ['T1', 'T2'], shift: 'evening' },
    { id: '2', name: 'Ama Osei', role: 'waiter', status: 'on-duty', assignedTables: ['T5', 'T6'], shift: 'evening' },
    { id: '3', name: 'Kofi Mensah', role: 'bartender', status: 'on-duty', assignedTables: [], shift: 'evening' },
    { id: '4', name: 'Efua Addo', role: 'host', status: 'on-duty', assignedTables: [], shift: 'evening' },
    { id: '5', name: 'Yaw Boateng', role: 'manager', status: 'on-duty', assignedTables: [], shift: 'evening' }
  ];

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
      case 'on-duty': return 'success';
      case 'off-duty': return 'danger';
      case 'break': return 'warning';
      default: return 'default';
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'waiter': return 'primary';
      case 'bartender': return 'secondary';
      case 'host': return 'success';
      case 'manager': return 'warning';
      default: return 'default';
    }
  };

  const allMenuItems = menuCategories.flatMap(category => category.items);
  const filteredMenuItems = selectedCategory === 'all' 
    ? allMenuItems 
    : allMenuItems.filter(item => item.category === selectedCategory);

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
                <p className="text-2xl font-bold text-ghana-black">3/8</p>
                <p className="text-sm text-green-600">37.5% available</p>
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
                <p className="text-2xl font-bold text-ghana-black">12</p>
                <p className="text-sm text-blue-600">3 pending</p>
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
                <p className="text-2xl font-bold text-ghana-black">5</p>
                <p className="text-sm text-green-600">All on duty</p>
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
                <p className="text-2xl font-bold text-ghana-black">9</p>
                <p className="text-sm text-green-600">All available</p>
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
                          {table.server && (
                            <p className="text-sm text-gray-600 mb-2">Server: {table.server}</p>
                          )}
                          {table.currentOrder && (
                            <p className="text-sm text-gray-600 mb-2">Order: {table.currentOrder}</p>
                          )}
                          {table.reservationTime && (
                            <p className="text-sm text-gray-600 mb-2">
                              Reserved: {table.reservationTime.toLocaleTimeString()}
                            </p>
                          )}
                          <div className="flex gap-2 mt-3">
                            <Button size="sm" color="primary" variant="flat">View</Button>
                            <Button size="sm" color="success" variant="flat">Manage</Button>
                          </div>
                        </div>
                      </CardBody>
                    </Card>
                  ))}
                </div>
              </div>
            </Tab>

            <Tab key="reservations" title="📅 Reservations">
              <div className="p-6">
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
                  <TableBody>
                    {reservations.map((reservation) => (
                      <TableRow key={reservation.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium text-ghana-black">{reservation.customerName}</p>
                            <p className="text-sm text-gray-600">{reservation.phone}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge color="primary" variant="flat">{reservation.tableNumber}</Badge>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{reservation.date.toLocaleDateString()}</p>
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
                            <Button size="sm" color="primary" variant="flat">Edit</Button>
                            <Button size="sm" color="success" variant="flat">Confirm</Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Tab>

            <Tab key="menu" title="🍽️ Menu Management">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <Select
                    label="Filter by Category"
                    placeholder="All Categories"
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="w-64"
                  >
                    {[{ id: 'all', name: 'All Categories' }, ...menuCategories].map((category) => (
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
                          <Button size="sm" color="primary" variant="flat">Edit</Button>
                          <Button size="sm" color="secondary" variant="flat">Toggle</Button>
                        </div>
                      </CardBody>
                    </Card>
                  ))}
                </div>
              </div>
            </Tab>

            <Tab key="staff" title="👥 Staff Management">
              <div className="p-6">
                <Table aria-label="Staff table">
                  <TableHeader>
                    <TableColumn>STAFF MEMBER</TableColumn>
                    <TableColumn>ROLE</TableColumn>
                    <TableColumn>STATUS</TableColumn>
                    <TableColumn>SHIFT</TableColumn>
                    <TableColumn>ASSIGNED TABLES</TableColumn>
                    <TableColumn>ACTIONS</TableColumn>
                  </TableHeader>
                  <TableBody>
                    {staff.map((member) => (
                      <TableRow key={member.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium text-ghana-black">{member.name}</p>
                            <p className="text-sm text-gray-600">ID: {member.id}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Chip color={getRoleColor(member.role)} size="sm">
                            {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                          </Chip>
                        </TableCell>
                        <TableCell>
                          <Chip color={getStaffStatusColor(member.status)} size="sm">
                            {member.status.charAt(0).toUpperCase() + member.status.slice(1)}
                          </Chip>
                        </TableCell>
                        <TableCell>
                          <Badge color="primary" variant="flat">{member.shift}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {member.assignedTables.length > 0 ? (
                              member.assignedTables.map((table) => (
                                <Badge key={table} color="secondary" variant="flat" size="sm">
                                  {table}
                                </Badge>
                              ))
                            ) : (
                              <span className="text-gray-500 text-sm">None</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button size="sm" color="primary" variant="flat">View</Button>
                            <Button size="sm" color="success" variant="flat">Assign</Button>
                          </div>
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

      {/* New Reservation Modal */}
      <Modal isOpen={isNewReservationModalOpen} onClose={() => setIsNewReservationModalOpen(false)} size="2xl">
        <ModalContent>
          <ModalHeader>Create New Reservation</ModalHeader>
          <ModalBody>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input label="Customer Name" placeholder="Enter customer name" />
                <Input label="Phone Number" placeholder="Enter phone number" />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Input label="Date" type="date" />
                <Input label="Time" type="time" />
                <Input label="Number of Guests" type="number" placeholder="2" />
              </div>
              
              <Select label="Table Preference" placeholder="Select table">
                {tables.filter(t => t.status === 'available').map((table) => (
                  <SelectItem key={table.id}>
                    Table {table.number} ({table.capacity} guests)
                  </SelectItem>
                ))}
              </Select>
              
              <Input label="Special Requests" placeholder="Any special requests or notes" />
            </div>
          </ModalBody>
          <ModalFooter>
            <Button color="danger" variant="light" onPress={() => setIsNewReservationModalOpen(false)}>
              Cancel
            </Button>
            <Button color="primary" className="bg-ghana-green text-white" onPress={() => setIsNewReservationModalOpen(false)}>
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
                <Input label="Item Name" placeholder="Enter item name" />
                <Select label="Category" placeholder="Select category">
                  {menuCategories.map((category) => (
                    <SelectItem key={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </Select>
              </div>
              
              <Input label="Description" placeholder="Enter item description" />
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Input label="Price (₵)" type="number" placeholder="0.00" />
                <Input label="Preparation Time (min)" type="number" placeholder="15" />
                <Select label="Availability" placeholder="Select status">
                  <SelectItem key="available">Available</SelectItem>
                  <SelectItem key="unavailable">Unavailable</SelectItem>
                </Select>
              </div>
              
              <Input label="Allergens" placeholder="e.g., Peanuts, Fish, Gluten" />
            </div>
          </ModalBody>
          <ModalFooter>
            <Button color="danger" variant="light" onPress={() => setIsNewMenuItemModalOpen(false)}>
              Cancel
            </Button>
            <Button color="primary" className="bg-ghana-green text-white" onPress={() => setIsNewMenuItemModalOpen(false)}>
              Add Menu Item
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
