'use client';

import React, { useState, useEffect } from 'react';
import { 
  Card, CardBody, CardHeader, Button, Badge, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, 
  Input, Select, SelectItem, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Chip, Textarea,
  Tabs, Tab
} from '@heroui/react';
import { frontOfficeStore } from '../lib/frontoffice/store';
import { housekeepingStore } from '../lib/housekeeping/store';
import { useSettingsStore } from '../lib/settings/store';
import { trackEvent } from '../lib/analytics/trackEvent';
import type { Reservation } from '../lib/frontoffice/types';

interface QuickAction {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  action: () => void;
  requiresModule?: string;
}

export default function FrontOfficeOperationsDashboard() {
  const [selectedTab, setSelectedTab] = useState('overview');
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [isReservationModalOpen, setIsReservationModalOpen] = useState(false);
  const [isCheckInModalOpen, setIsCheckInModalOpen] = useState(false);
  const [isCheckOutModalOpen, setIsCheckOutModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [tick, setTick] = useState(0);

  const settings = useSettingsStore();

  useEffect(() => {
    const unsubscribe = frontOfficeStore.subscribe(() => setTick(t => t + 1));
    return unsubscribe;
  }, []);

  // Initial sync from API
  useEffect(() => {
    const sub = (settings as any)?.tenant?.subdomain || 'demo';
    frontOfficeStore.syncReservationsFromApi(sub);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Get data
  const reservations = frontOfficeStore.reservations;
  const rooms = frontOfficeStore.rooms;
  const roomTypes = settings.roomManagement.roomTypes || [];

  // Housekeeping-driven room status overview
  const hkAllRooms = housekeepingStore.getAllRooms();
  const settingsRoomsCount = settings.roomManagement.rooms?.length || 0;
  const totalRooms = settingsRoomsCount || rooms.length || hkAllRooms.length;
  const availableRooms = hkAllRooms.filter(r => ['vacant', 'clean', 'inspected'].includes(r.status as any)).length;
  const occupiedRooms = hkAllRooms.filter(r => r.status === 'occupied').length;
  const dirtyRooms = hkAllRooms.filter(r => r.status === 'dirty').length;
  const maintenanceOpen = housekeepingStore.getMaintenanceRequests().filter(m => m.status !== 'completed').length;
  const readySoon = hkAllRooms.filter(r => r.status === 'inspected').length;

  // Breakdowns
  const todayIso = new Date().toISOString().slice(0,10);
  const checkingOutToday = reservations.filter(r => r.status === 'checked-in' && r.departure.slice(0,10) === todayIso).length;
  const extendedStays = reservations.filter(r => r.status === 'checked-in' && r.departure < new Date().toISOString()).length;
  const vipGuests = 0;

  // Metrics
  const totalReservations = reservations.length;
  const checkedInReservations = reservations.filter(r => r.status === 'checked-in').length;
  const pendingCheckIns = reservations.filter(r => r.status === 'confirmed').length;
  const pendingCheckOuts = reservations.filter(r => r.status === 'checked-in').length;
  const totalRevenue = 0;

  const quickActions: QuickAction[] = [
    {
      id: 'new-reservation',
      title: 'New Reservation',
      description: 'Create a new guest reservation',
      icon: '📅',
      color: 'ghana-green',
      action: () => setIsReservationModalOpen(true)
    },
    {
      id: 'room-assignment',
      title: 'Room Assignment',
      description: 'Assign rooms to guests',
      icon: '🏠',
      color: 'purple-500',
      action: () => setSelectedTab('room-assignment'),
      requiresModule: 'frontOffice'
    }
  ];

  // Get room counts by type from settings
  const getRoomCountByType = (typeId: string) => {
    const count = settings.roomManagement.rooms?.filter(room => room.typeId === typeId).length || 0;
    console.log(`Room count for type ${typeId}:`, count);
    return count;
  };

  const getAvailableRoomCountByType = (typeId: string) => {
    const count = hkAllRooms.filter(room => 
      room.roomTypeId === typeId && ['vacant', 'clean', 'inspected'].includes(room.status as any)
    ).length;
    console.log(`Available room count for type ${typeId}:`, count);
    return count;
  };

  // Debug logging
  console.log('Settings rooms:', settings.roomManagement.rooms);
  console.log('Housekeeping rooms:', hkAllRooms);
  console.log('Total rooms count:', totalRooms);

  const renderOverview = () => (
    <div className="space-y-6">
      {/* Room Status Overview */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xl font-semibold text-ghana-black">🏨 Room Status Overview ({totalRooms} Rooms)</h3>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Available */}
          <Card className="border-0 shadow-lg">
            <CardHeader className="pb-0"><span className="font-semibold">Available Rooms</span></CardHeader>
            <CardBody className="pt-3">
                              <div className="text-4xl font-bold text-ghana-green mb-3">{availableRooms}</div>
                <div className="space-y-1 text-sm text-gray-600">
                  <div className="flex justify-between"><span>Standard Rooms</span><span>{getAvailableRoomCountByType('standard')}</span></div>
                  <div className="flex justify-between"><span>Deluxe Rooms</span><span>{getAvailableRoomCountByType('deluxe')}</span></div>
                  <div className="flex justify-between"><span>Suite Rooms</span><span>{getAvailableRoomCountByType('suite')}</span></div>
                </div>
            </CardBody>
          </Card>

          {/* Occupied */}
          <Card className="border-0 shadow-lg">
            <CardHeader className="pb-0"><span className="font-semibold">Occupied Rooms</span></CardHeader>
            <CardBody className="pt-3">
              <div className="text-4xl font-bold text-ghana-red mb-3">{occupiedRooms}</div>
              <div className="space-y-1 text-sm text-gray-600">
                <div className="flex justify-between"><span>Checking Out Today</span><span>{checkingOutToday}</span></div>
                <div className="flex justify-between"><span>Extended Stays</span><span>{extendedStays}</span></div>
                <div className="flex justify-between"><span>VIP Guests</span><span>{vipGuests}</span></div>
              </div>
            </CardBody>
          </Card>

          {/* Maintenance & Cleaning */}
          <Card className="border-0 shadow-lg">
            <CardHeader className="pb-0"><span className="font-semibold">Maintenance & Cleaning</span></CardHeader>
            <CardBody className="pt-3">
              <div className="text-4xl font-bold text-ghana-black mb-3">{maintenanceOpen + dirtyRooms}</div>
              <div className="space-y-1 text-sm text-gray-600">
                <div className="flex justify-between"><span>Under Maintenance</span><span>{maintenanceOpen}</span></div>
                <div className="flex justify-between"><span>Deep Cleaning</span><span>{dirtyRooms}</span></div>
                <div className="flex justify-between"><span>Ready Soon</span><span>{readySoon}</span></div>
              </div>
              <div className="mt-4 flex justify-end">
                <a href="/room-status" className="inline-flex items-center px-4 py-2 rounded-md bg-ghana-green text-white text-sm">🏨 View Full Status</a>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="border-0 shadow-lg"><CardBody className="p-6"><div className="flex items-center justify-between"><div><p className="text-sm font-medium text-gray-600">Total Reservations</p><p className="text-2xl font-bold text-ghana-black">{totalReservations}</p></div><div className="text-3xl">📅</div></div></CardBody></Card>
        <Card className="border-0 shadow-lg"><CardBody className="p-6"><div className="flex items-center justify-between"><div><p className="text-sm font-medium text-gray-600">Checked In</p><p className="text-2xl font-bold text-ghana-black">{checkedInReservations}</p></div><div className="text-3xl">🔑</div></div></CardBody></Card>
        <Card className="border-0 shadow-lg"><CardBody className="p-6"><div className="flex items-center justify-between"><div><p className="text-sm font-medium text-gray-600">Pending Check-ins</p><p className="text-2xl font-bold text-ghana-black">{pendingCheckIns}</p></div><div className="text-3xl">⏳</div></div></CardBody></Card>
        <Card className="border-0 shadow-lg"><CardBody className="p-6"><div className="flex items-center justify-between"><div><p className="text-sm font-medium text-gray-600">Total Revenue</p><p className="text-2xl font-bold text-ghana-black">₵{totalRevenue.toLocaleString()}</p></div><div className="text-3xl">💰</div></div></CardBody></Card>
      </div>

      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-3"><h3 className="text-xl font-semibold text-ghana-black">🚀 Quick Actions</h3></CardHeader>
        <CardBody>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {quickActions.map(action => (
              <Button key={action.id} variant="flat" className={`h-24 flex flex-col items-center justify-center space-y-2 bg-${action.color} text-white`} size="lg" onClick={action.action}>
                <span className="text-2xl">{action.icon}</span>
                <span className="text-xs font-medium text-center">{action.title}</span>
              </Button>
            ))}
          </div>
        </CardBody>
      </Card>
    </div>
  );

  const renderReservations = () => (
    <div className="space-y-6">
      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold text-ghana-black">📅 Reservations</h3>
            <Button color="primary" className="bg-ghana-green text-white" variant="flat" onClick={() => setIsReservationModalOpen(true)}>
              ➕ New Reservation
            </Button>
          </div>
        </CardHeader>
        <CardBody>
          <Table aria-label="Reservations table">
            <TableHeader>
              <TableColumn>Guest</TableColumn>
              <TableColumn>Dates</TableColumn>
              <TableColumn>Room</TableColumn>
              <TableColumn>Status</TableColumn>
              <TableColumn>Source</TableColumn>
            </TableHeader>
            <TableBody>
              {reservations.map((reservation) => (
                <TableRow key={reservation.id}>
                  <TableCell>
                    <div>
                      <div className="font-semibold">{reservation.guestName}</div>
                      <div className="text-sm text-gray-500">
                        {reservation.adults} adult{(reservation.adults || 1) > 1 ? 's' : ''}
                        {(reservation.children || 0) > 0 && `, ${reservation.children} child${(reservation.children || 0) > 1 ? 'ren' : ''}`}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <div>Check-in: {new Date(reservation.arrival).toLocaleDateString()}</div>
                      <div>Check-out: {new Date(reservation.departure).toLocaleDateString()}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {reservation.roomId ? (
                      <Badge color="success" size="sm">Room {reservation.roomId}</Badge>
                    ) : (
                      <Badge color="warning" size="sm">Unassigned</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge color={
                      reservation.status === 'checked-in' ? 'success' :
                      reservation.status === 'confirmed' ? 'primary' :
                      reservation.status === 'checked-out' ? 'default' :
                      'warning'
                    } size="sm">
                      {reservation.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Chip color="primary" size="sm" variant="flat">{reservation.source || 'Direct'}</Chip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardBody>
      </Card>
    </div>
  );

  const renderRoomAssignment = () => (
    <div className="space-y-6">
      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between w-full">
            <h3 className="text-xl font-semibold text-ghana-black">🏠 Room Assignment</h3>
          </div>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold mb-3">Available Rooms</h4>
              <div className="space-y-2">
                {rooms.map(room => (
                  <div key={room.id} className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                    <div>
                      <span className="font-semibold">Room {room.id}</span>
                      <span className="text-sm text-gray-600 ml-2">Floor {room.floor || '-'}</span>
                    </div>
                    <Badge color="success" size="sm">Available</Badge>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h4 className="font-semibold mb-3">Add New Room</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Input label="Room Number" placeholder="e.g., 305" id="fo-room-num" />
                <Select label="Room Type" placeholder="Select type" id="fo-room-type">
                  {roomTypes.map(rt => (
                    <SelectItem key={rt.id} value={rt.id}>{rt.name}</SelectItem>
                  ))}
                </Select>
                <Input label="Floor" placeholder="e.g., 3" id="fo-room-floor" />
                <div className="flex items-end">
                  <Button color="primary" onClick={() => {
                    const id = (document.getElementById('fo-room-num') as HTMLInputElement)?.value?.trim();
                    const typeId = (document.getElementById('fo-room-type') as HTMLSelectElement)?.value || (document.getElementById('fo-room-type') as any)?.dataset?.value;
                    const floor = (document.getElementById('fo-room-floor') as HTMLInputElement)?.value?.trim();
                    if (!id || !typeId) {
                      alert('Room number and type are required');
                      return;
                    }
                    frontOfficeStore.addRoom({ id, roomTypeId: typeId, floor });
                    trackEvent('FO.Room.Created.UI', { id, roomTypeId: typeId });
                    (document.getElementById('fo-room-num') as HTMLInputElement).value = '';
                    (document.getElementById('fo-room-floor') as HTMLInputElement).value = '';
                  }}>Add Room</Button>
                </div>
              </div>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-ghana-black">🏨 Front Office Operations</h1>
          <p className="text-gray-600">Complete guest lifecycle management from reservation to check-out</p>
        </div>
        <div className="flex items-center space-x-2">
          <Badge color="success">System Online</Badge>
          <Badge color="primary">SaaS Ready</Badge>
        </div>
      </div>

      <Tabs selectedKey={selectedTab} onSelectionChange={(key) => setSelectedTab(key as string)} className="w-full">
        <Tab key="overview" title="Overview" />
        <Tab key="reservations" title="Reservations" />
        <Tab key="room-assignment" title="Room Assignment" />
      </Tabs>

      <div className="mt-6">
        {selectedTab === 'overview' && renderOverview()}
        {selectedTab === 'reservations' && renderReservations()}
        {selectedTab === 'room-assignment' && renderRoomAssignment()}
      </div>

      {/* Reservation Modal */}
      <Modal isOpen={isReservationModalOpen} onClose={() => setIsReservationModalOpen(false)} size="4xl">
        <ModalContent>
          <ModalHeader>
            {selectedReservation ? 'Edit Reservation' : 'New Reservation'}
          </ModalHeader>
          <ModalBody>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label="Guest Name" placeholder="e.g., Ama Kofi" id="fo-guest-name" />
              <Input label="Phone" placeholder="e.g., +233..." id="fo-guest-phone" />
              <Input type="date" label="Arrival" id="fo-arrival" />
              <Input type="date" label="Departure" id="fo-departure" />
              <Input type="number" label="Adults" defaultValue={'1'} id="fo-adults" />
              <Input type="number" label="Children" defaultValue={'0'} id="fo-children" />
            </div>
          </ModalBody>
          <ModalFooter>
            <Button color="danger" variant="light" onPress={() => setIsReservationModalOpen(false)}>
              Cancel
            </Button>
            <Button color="primary" onPress={async () => {
              const sub = (settings as any)?.tenant?.subdomain || 'demo';
              const g = (document.getElementById('fo-guest-name') as HTMLInputElement)?.value;
              const p = (document.getElementById('fo-guest-phone') as HTMLInputElement)?.value;
              const a = (document.getElementById('fo-arrival') as HTMLInputElement)?.value;
              const d = (document.getElementById('fo-departure') as HTMLInputElement)?.value;
              const ad = Number((document.getElementById('fo-adults') as HTMLInputElement)?.value || '1');
              const ch = Number((document.getElementById('fo-children') as HTMLInputElement)?.value || '0');
              if (!g || !a || !d) {
                alert('Guest name, arrival and departure are required');
                return;
              }
              await frontOfficeStore.createGuestAndReservationViaApi(sub, {
                guestName: g,
                guestPhone: p,
                arrival: a,
                departure: d,
                adults: ad,
                children: ch,
                source: 'Direct'
              });
              setIsReservationModalOpen(false);
            }}>
              {selectedReservation ? 'Update' : 'Create'}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Check-in Modal placeholder */}
      <Modal isOpen={isCheckInModalOpen} onClose={() => setIsCheckInModalOpen(false)} size="2xl">
        <ModalContent>
          <ModalHeader>Check In Guest</ModalHeader>
          <ModalBody>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Select Room</label>
                <Select placeholder="Choose available room">
                  {rooms.map(room => (
                    <SelectItem key={room.id} value={room.id}>Room {room.id}</SelectItem>
                  ))}
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Notes</label>
                <Textarea placeholder="Any special requests or notes..." />
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button color="danger" variant="light" onPress={() => setIsCheckInModalOpen(false)}>Cancel</Button>
            <Button color="primary" onPress={() => setIsCheckInModalOpen(false)}>Check In</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Check-out Modal placeholder */}
      <Modal isOpen={isCheckOutModalOpen} onClose={() => setIsCheckOutModalOpen(false)} size="2xl">
        <ModalContent>
          <ModalHeader>Check Out Guest</ModalHeader>
          <ModalBody>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Final Amount</label>
                <Input type="number" placeholder="0.00" />
              </div>
              <div>
                <label className="text-sm font-medium">Payment Method</label>
                <Select placeholder="Select payment method">
                  <SelectItem key="cash" value="cash">Cash</SelectItem>
                  <SelectItem key="card" value="card">Card</SelectItem>
                  <SelectItem key="mobile-money" value="mobile-money">Mobile Money</SelectItem>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Notes</label>
                <Textarea placeholder="Any feedback or notes..." />
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button color="danger" variant="light" onPress={() => setIsCheckOutModalOpen(false)}>Cancel</Button>
            <Button color="primary" onPress={() => setIsCheckOutModalOpen(false)}>Check Out</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Payment Modal placeholder */}
      <Modal isOpen={isPaymentModalOpen} onClose={() => setIsPaymentModalOpen(false)} size="2xl">
        <ModalContent>
          <ModalHeader>Process Payment</ModalHeader>
          <ModalBody>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Amount</label>
                <Input type="number" placeholder="0.00" />
              </div>
              <div>
                <label className="text-sm font-medium">Payment Method</label>
                <Select placeholder="Select payment method">
                  <SelectItem key="cash" value="cash">Cash</SelectItem>
                  <SelectItem key="card" value="card">Card</SelectItem>
                  <SelectItem key="mobile-money" value="mobile-money">Mobile Money</SelectItem>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Reference</label>
                <Input placeholder="Transaction reference or notes..." />
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button color="danger" variant="light" onPress={() => setIsPaymentModalOpen(false)}>Cancel</Button>
            <Button color="primary" onPress={() => setIsPaymentModalOpen(false)}>Process Payment</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}


