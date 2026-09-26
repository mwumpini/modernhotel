'use client';

import React, { useState, useEffect } from 'react';
import HeadingInfo from './HeadingInfo';
import { 
  Card, 
  CardBody, 
  CardHeader, 
  Button, 
  Badge, 
  Table, 
  TableHeader, 
  TableColumn, 
  TableBody, 
  TableRow, 
  TableCell,
  Input,
  Select,
  SelectItem,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
  Chip,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  Switch
} from "@heroui/react";
import { worksheetTableClassNames } from './frontoffice/StayWorksheetTable';
import { frontOfficeStore } from '../lib/frontoffice/store';
import { housekeepingStore } from '../lib/housekeeping/store';
import { shortDay } from '../lib/frontoffice/stayWorksheet';
import { trackEvent } from '../lib/analytics/trackEvent';

interface RoomAssignment {
  roomId: string;
  roomNumber: string;
  roomType: string;
  floor: string;
  status: string;
  currentGuest?: string;
  reservationId?: string;
  checkInDate?: string;
  checkOutDate?: string;
  reservedGuest?: string;
  reservedArrival?: string;
  rate: number;
  notes?: string;
}

const OPEN_ROOM = ['vacant', 'clean', 'inspected'];

export default function RoomAssignmentsManager({ onNewReservation }: { onNewReservation?: () => void }) {
  const [assignments, setAssignments] = useState<RoomAssignment[]>([]);
  const [filteredAssignments, setFilteredAssignments] = useState<RoomAssignment[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilters, setStatusFilters] = useState<string[]>([]);
  const [floorFilter, setFloorFilter] = useState<string>('all');
  const [roomTypeFilter, setRoomTypeFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('roomNumber');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('grid');
  const [selectedAssignment, setSelectedAssignment] = useState<RoomAssignment | null>(null);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    loadRoomAssignments();
    const unsubscribe = frontOfficeStore.subscribe(loadRoomAssignments);
    return unsubscribe;
  }, []);

  useEffect(() => {
    filterAndSortAssignments();
  }, [assignments, searchTerm, statusFilters, floorFilter, roomTypeFilter, sortBy, sortOrder]);

  const loadRoomAssignments = () => {
    const rooms = housekeepingStore.getAllRooms();
    const reservations = frontOfficeStore.reservations;
    
    const assignmentsData: RoomAssignment[] = rooms.map(room => {
      const inHouse = reservations.find(
        (r) => r.status === 'checked-in' && r.roomId === room.roomNumber && r.roomId !== 'TBD'
      );
      const hold = reservations
        .filter((r) =>
          (r.status === 'confirmed' || r.status === 'pending') &&
          r.roomId === room.roomNumber &&
          r.roomId !== 'TBD'
        )
        .sort((a, b) => a.arrival.localeCompare(b.arrival))[0];
      const roomType = frontOfficeStore.roomTypes.find(rt => rt.id === room.roomTypeId);
      const open = OPEN_ROOM.includes(room.status);

      return {
        roomId: room.roomNumber,
        roomNumber: room.roomNumber,
        roomType: roomType?.name || 'Unknown',
        floor: room.roomNumber.charAt(0),
        status: room.status,
        currentGuest: open ? undefined : inHouse?.guestName,
        reservationId: open ? undefined : inHouse?.id,
        checkInDate: open ? undefined : inHouse?.arrival,
        checkOutDate: open ? undefined : inHouse?.departure,
        reservedGuest: hold?.guestName,
        reservedArrival: hold?.arrival,
        rate: roomType?.baseRate || 0,
        notes: room.notes
      };
    });

    setAssignments(assignmentsData);
  };

  const filterAndSortAssignments = () => {
    let filtered = assignments;

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(assignment => 
        assignment.roomNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        assignment.currentGuest?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        assignment.reservedGuest?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        assignment.roomType.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Empty means every status. Ticked statuses match together: a room shows if it is any of them.
    if (statusFilters.length > 0) {
      filtered = filtered.filter((assignment) => statusFilters.some((key) => (
        key === 'reserved' ? !!assignment.reservedGuest : assignment.status === key
      )));
    }

    // Floor filter
    if (floorFilter !== 'all') {
      filtered = filtered.filter(assignment => assignment.floor === floorFilter);
    }

    // Room type filter
    if (roomTypeFilter !== 'all') {
      filtered = filtered.filter(assignment => assignment.roomType === roomTypeFilter);
    }

    // Sorting
    filtered.sort((a, b) => {
      let aValue: any = a[sortBy as keyof RoomAssignment];
      let bValue: any = b[sortBy as keyof RoomAssignment];

      // Handle numeric sorting for room numbers
      if (sortBy === 'roomNumber') {
        aValue = parseInt(aValue) || 0;
        bValue = parseInt(bValue) || 0;
      }

      // Handle date sorting
      if (sortBy === 'checkInDate' || sortBy === 'checkOutDate') {
        aValue = aValue ? new Date(aValue).getTime() : 0;
        bValue = bValue ? new Date(bValue).getTime() : 0;
      }

      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    setFilteredAssignments(filtered);
  };

  const handleAssignmentClick = (assignment: RoomAssignment) => {
    setSelectedAssignment(assignment);
    setIsEditing(false);
    onOpen();
  };

  const handleEditAssignment = () => {
    setIsEditing(true);
  };

  const handleSaveAssignment = () => {
    if (!selectedAssignment) return;

    // Update room status in housekeeping store
    housekeepingStore.updateRoomStatus(
      selectedAssignment.roomNumber,
      selectedAssignment.status as any,
      'Front Desk',
      `Assignment updated: ${selectedAssignment.notes || 'No notes'}`
    );

    // Update reservation if exists
    if (selectedAssignment.reservationId) {
      const reservation = frontOfficeStore.reservations.find(r => r.id === selectedAssignment.reservationId);
      if (reservation) {
        reservation.roomId = selectedAssignment.roomId;
        frontOfficeStore.updateReservation(reservation);
      }
    }

    trackEvent('FO.Room.MarkedOOO', {
      action: 'MarkedOOO',
      roomNumber: selectedAssignment.roomNumber
    });

    onClose();
    loadRoomAssignments();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'occupied': return 'success';
      case 'vacant': return 'default';
      case 'dirty': return 'warning';
      case 'clean': return 'primary';
      case 'inspected': return 'secondary';
      case 'out-of-order': return 'danger';
      case 'maintenance': return 'warning';
      default: return 'default';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'occupied': return '🟢';
      case 'vacant': return '⚪';
      case 'dirty': return '🟡';
      case 'clean': return '🔵';
      case 'inspected': return '🟣';
      case 'out-of-order': return '🔴';
      case 'maintenance': return '🟠';
      default: return '⚪';
    }
  };

  const getStatusBgColor = (status: string) => {
    switch (status) {
      case 'occupied': return 'bg-green-100 border-green-300';
      case 'vacant': return 'bg-gray-100 border-gray-300';
      case 'dirty': return 'bg-yellow-100 border-yellow-300';
      case 'clean': return 'bg-blue-100 border-blue-300';
      case 'inspected': return 'bg-purple-100 border-purple-300';
      case 'out-of-order': return 'bg-red-100 border-red-300';
      case 'maintenance': return 'bg-orange-100 border-orange-300';
      default: return 'bg-gray-100 border-gray-300';
    }
  };

  const handleQuickAction = (action: string, assignment: RoomAssignment) => {
    switch (action) {
      case 'checkout':
        if (assignment.reservationId) {
          frontOfficeStore.checkOut(assignment.reservationId);
        }
        break;
      case 'maintenance':
        housekeepingStore.updateRoomStatus(
          assignment.roomNumber,
          'out-of-order',
          'Front Desk',
          'Maintenance requested by front desk'
        );
        break;
      case 'clean':
        housekeepingStore.updateRoomStatus(
          assignment.roomNumber,
          'dirty',
          'Front Desk',
          'Room marked for cleaning'
        );
        break;
    }
    
    trackEvent('FO.RoomAssignment.QuickAction', {
      action,
      roomNumber: assignment.roomNumber
    });
    
    loadRoomAssignments();
  };

  // Get unique floors and room types for filters
  const uniqueFloors = [...new Set(assignments.map(a => a.floor))].sort();
  const uniqueRoomTypes = [...new Set(assignments.map(a => a.roomType))].sort();

  // Get status counts for summary
  const statusCounts = assignments.reduce((acc, assignment) => {
    acc[assignment.status] = (acc[assignment.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const reservedCount = assignments.filter((assignment) => assignment.reservedGuest).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <h2 className="text-2xl font-bold text-ghana-black">🏠 Room Assignments</h2>
          <HeadingInfo label="About room assignments">View and manage room assignments, status, and guest information</HeadingInfo>
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-600">Table View</span>
            <Switch
              isSelected={viewMode === 'grid'}
              onValueChange={(checked) => setViewMode(checked ? 'grid' : 'table')}
              size="sm"
            />
            <span className="text-sm text-gray-600">Grid View</span>
          </div>
          <Button
            color="primary"
            variant="flat"
            onClick={onNewReservation}
          >
            ➕ New Reservation
          </Button>
        </div>
      </div>

      {/* Status Summary */}
      <Card className="border border-gray-200 shadow-none">
        <CardBody className="px-2 py-2">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-8">
            <div className="text-center">
              <div className="text-base font-semibold tabular-nums text-green-700">{statusCounts['occupied'] || 0}</div>
              <div className="text-xs text-gray-500">🟢 Occupied</div>
            </div>
            <div className="text-center">
              <div className="text-base font-semibold tabular-nums text-blue-700">{reservedCount}</div>
              <div className="text-xs text-gray-500">📌 Reserved</div>
            </div>
            <div className="text-center">
              <div className="text-base font-semibold tabular-nums text-gray-600">{statusCounts['vacant'] || 0}</div>
              <div className="text-xs text-gray-500">⚪ Vacant</div>
            </div>
            <div className="text-center">
              <div className="text-base font-semibold tabular-nums text-yellow-700">{statusCounts['dirty'] || 0}</div>
              <div className="text-xs text-gray-500">🟡 Dirty</div>
            </div>
            <div className="text-center">
              <div className="text-base font-semibold tabular-nums text-blue-700">{statusCounts['clean'] || 0}</div>
              <div className="text-xs text-gray-500">🔵 Clean</div>
            </div>
            <div className="text-center">
              <div className="text-base font-semibold tabular-nums text-purple-700">{statusCounts['inspected'] || 0}</div>
              <div className="text-xs text-gray-500">🟣 Inspected</div>
            </div>
            <div className="text-center">
              <div className="text-base font-semibold tabular-nums text-red-700">{statusCounts['out-of-order'] || 0}</div>
              <div className="text-xs text-gray-500">🔴 Out of Order</div>
            </div>
            <div className="text-center">
              <div className="text-base font-semibold tabular-nums text-orange-700">{statusCounts['maintenance'] || 0}</div>
              <div className="text-xs text-gray-500">🟠 Maintenance</div>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Enhanced Filters */}
      <Card className="border-0 shadow-lg">
        <CardBody className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
            <Input
              placeholder="Search rooms, guests, or room types..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              startContent={<span className="text-gray-400">🔍</span>}
            />
            <Select
              aria-label="Filter by status"
              placeholder="Filter by status"
              selectionMode="multiple"
              selectedKeys={new Set(statusFilters)}
              onSelectionChange={(keys) => {
                if (keys === 'all') return;
                setStatusFilters(Array.from(keys as Set<string>));
              }}
            >
              <SelectItem key="occupied">🟢 Occupied</SelectItem>
              <SelectItem key="reserved">📌 Reserved</SelectItem>
              <SelectItem key="vacant">⚪ Vacant</SelectItem>
              <SelectItem key="dirty">🟡 Dirty</SelectItem>
              <SelectItem key="clean">🔵 Clean</SelectItem>
              <SelectItem key="inspected">🟣 Inspected</SelectItem>
              <SelectItem key="out-of-order">🔴 Out of Order</SelectItem>
              <SelectItem key="maintenance">🟠 Maintenance</SelectItem>
            </Select>
            <Select
              placeholder="Filter by floor"
              value={floorFilter}
              onChange={(e) => setFloorFilter(e.target.value)}
            >
              {['all', ...uniqueFloors].map(floor => (
                <SelectItem key={String(floor)}>{floor === 'all' ? 'All Floors' : `Floor ${floor}`}</SelectItem>
              ))}
            </Select>
            <Select
              placeholder="Filter by room type"
              value={roomTypeFilter}
              onChange={(e) => setRoomTypeFilter(e.target.value)}
            >
              {['all', ...uniqueRoomTypes].map(type => (
                <SelectItem key={type}>{type === 'all' ? 'All Types' : type}</SelectItem>
              ))}
            </Select>
            <Select
              placeholder="Sort by"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <SelectItem key="roomNumber">Room Number</SelectItem>
              <SelectItem key="roomType">Room Type</SelectItem>
              <SelectItem key="status">Status</SelectItem>
              <SelectItem key="rate">Rate</SelectItem>
              <SelectItem key="checkInDate">Check In Date</SelectItem>
              <SelectItem key="checkOutDate">Check Out Date</SelectItem>
            </Select>
            <div className="flex items-center space-x-2">
              <Button
                size="sm"
                variant="flat"
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              >
                {sortOrder === 'asc' ? '↑' : '↓'} Sort
              </Button>
              <Badge color="primary" variant="flat">{filteredAssignments.length} rooms</Badge>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Room Assignments Display */}
      {viewMode === 'table' ? (
        <Card className="border-0 shadow-lg">
          <CardHeader className="pb-3">
            <h3 className="text-xl font-semibold text-ghana-black">Room Assignments Table</h3>
          </CardHeader>
          <CardBody className="px-2 py-3">
            <Table aria-label="Room assignments table" removeWrapper classNames={worksheetTableClassNames}>
              <TableHeader>
                <TableColumn>Room</TableColumn>
                <TableColumn>Type</TableColumn>
                <TableColumn>Status</TableColumn>
                <TableColumn>Guest</TableColumn>
                <TableColumn>Check In</TableColumn>
                <TableColumn>Check Out</TableColumn>
                <TableColumn>Rate</TableColumn>
                <TableColumn>Actions</TableColumn>
              </TableHeader>
              <TableBody>
                {filteredAssignments.map((assignment) => (
                  <TableRow 
                    key={assignment.roomId}
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => handleAssignmentClick(assignment)}
                  >
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <span className="font-semibold text-ghana-black">{assignment.roomNumber}</span>
                        <span className="text-xs text-gray-500">Floor {assignment.floor}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Chip size="sm" variant="flat" color="secondary">
                        {assignment.roomType}
                      </Chip>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <span>{getStatusIcon(assignment.status)}</span>
                        <Badge 
                          color={getStatusColor(assignment.status) as any}
                          variant="flat"
                          size="sm"
                        >
                          {assignment.status}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      {assignment.currentGuest ? (
                        <div className="max-w-[200px]">
                          <p className="font-medium text-ghana-black truncate">{assignment.currentGuest}</p>
                          {assignment.reservedGuest && (
                            <p className="truncate text-xs text-blue-700" title={assignment.reservedGuest}>Next: {assignment.reservedGuest}</p>
                          )}
                        </div>
                      ) : assignment.reservedGuest ? (
                        <div className="max-w-[200px]">
                          <p className="truncate font-medium text-blue-800" title={assignment.reservedGuest}>{assignment.reservedGuest}</p>
                          <p className="text-xs text-blue-700">Reserved{assignment.reservedArrival ? ` ${shortDay(assignment.reservedArrival)}` : ''}</p>
                        </div>
                      ) : (
                        <span className="text-gray-400">No guest</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {assignment.checkInDate ? (
                        <span className="text-sm">{new Date(assignment.checkInDate).toLocaleDateString()}</span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {assignment.checkOutDate ? (
                        <span className="text-sm">{new Date(assignment.checkOutDate).toLocaleDateString()}</span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">₵{assignment.rate.toLocaleString()}</span>
                    </TableCell>
                    <TableCell>
                      <Dropdown>
                        <DropdownTrigger>
                          <Button size="sm" variant="light" isIconOnly>
                            ⚙️
                          </Button>
                        </DropdownTrigger>
                        <DropdownMenu aria-label="Quick actions">
                          <DropdownItem 
                            key="view"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAssignmentClick(assignment);
                            }}
                          >
                            👁️ View Details
                          </DropdownItem>
                          <DropdownItem 
                            key="edit"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedAssignment(assignment);
                              setIsEditing(true);
                              onOpen();
                            }}
                          >
                            ✏️ Edit
                          </DropdownItem>
                          {(assignment.status === 'occupied' ? (
                            <DropdownItem 
                              key="checkout"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleQuickAction('checkout', assignment);
                              }}
                            >
                              🚪 Check Out
                            </DropdownItem>
                          ) : null) as any}
                          <DropdownItem 
                            key="maintenance"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleQuickAction('maintenance', assignment);
                            }}
                          >
                            🔧 Report Issue
                          </DropdownItem>
                          <DropdownItem 
                            key="clean"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleQuickAction('clean', assignment);
                            }}
                          >
                            🧹 Mark for Cleaning
                          </DropdownItem>
                        </DropdownMenu>
                      </Dropdown>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardBody>
        </Card>
      ) : (
        <Card className="border-0 shadow-lg">
          <CardHeader className="pb-3">
            <h3 className="text-xl font-semibold text-ghana-black">Room Assignments Grid</h3>
          </CardHeader>
          <CardBody>
            <div className={`grid grid-cols-1 gap-4 ${statusFilters.length === 1 && statusFilters[0] === 'reserved' ? '' : 'lg:grid-cols-3'}`}>
              {(statusFilters.length === 1 && statusFilters[0] === 'reserved'
                ? [{ title: 'Reserved', tone: 'text-blue-800', rooms: filteredAssignments }]
                : [
                    {
                      title: 'Available',
                      tone: 'text-green-800',
                      rooms: filteredAssignments.filter((a) => OPEN_ROOM.includes(a.status) && !a.currentGuest && !a.reservedGuest),
                    },
                    {
                      title: 'Reserved',
                      tone: 'text-blue-800',
                      rooms: filteredAssignments.filter((a) => !!a.reservedGuest && !a.currentGuest),
                    },
                    {
                      title: 'Not available',
                      tone: 'text-gray-800',
                      rooms: filteredAssignments.filter((a) => !!a.currentGuest || (!OPEN_ROOM.includes(a.status) && !a.reservedGuest)),
                    },
                  ]
              ).map((side) => (
                <div key={side.title} className="min-w-0">
                  <div className="mb-2 flex items-center justify-between">
                    <h4 className={`text-sm font-semibold ${side.tone}`}>{side.title}</h4>
                    <span className="text-xs tabular-nums text-gray-500">{side.rooms.length}</span>
                  </div>
                  {side.rooms.length === 0 ? (
                    <p className="text-sm text-gray-400">None</p>
                  ) : (
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {side.rooms.map((assignment) => (
                        <button
                          key={assignment.roomId}
                          type="button"
                          className={`rounded border px-2 py-1.5 text-left transition-shadow hover:shadow-md ${getStatusBgColor(assignment.status)}`}
                          onClick={() => handleAssignmentClick(assignment)}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-sm font-bold text-gray-800">{assignment.roomNumber}</span>
                            <span className="text-xs text-gray-500">F{assignment.floor} {getStatusIcon(assignment.status)}</span>
                          </div>
                          {assignment.reservedGuest && !assignment.currentGuest ? (
                            <div className="text-xs font-semibold text-blue-700">Reserved</div>
                          ) : null}
                          {assignment.currentGuest ? (
                            <div className="truncate text-xs font-medium text-gray-700" title={assignment.currentGuest}>
                              {assignment.currentGuest}
                            </div>
                          ) : null}
                          {assignment.reservedGuest ? (
                            <div className="truncate text-xs font-medium text-blue-800" title={assignment.reservedGuest}>
                              {assignment.currentGuest ? 'Next: ' : ''}{assignment.reservedGuest}
                              {assignment.reservedArrival ? ` · ${shortDay(assignment.reservedArrival)}` : ''}
                            </div>
                          ) : null}
                          <div className="text-xs text-gray-500">₵{assignment.rate.toLocaleString()}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      )}

      {/* Assignment Details Modal */}
      <Modal isOpen={isOpen} onClose={onClose} size="2xl">
        <ModalContent>
          <ModalHeader>
            {isEditing ? 'Edit Room Assignment' : 'Room Assignment Details'}
          </ModalHeader>
          <ModalBody>
            {selectedAssignment && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Room Number</label>
                    <Input
                      value={selectedAssignment.roomNumber}
                      onChange={(e) => setSelectedAssignment({
                        ...selectedAssignment,
                        roomNumber: e.target.value
                      })}
                      disabled={!isEditing}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Room Type</label>
                    <Input
                      value={selectedAssignment.roomType}
                      onChange={(e) => setSelectedAssignment({
                        ...selectedAssignment,
                        roomType: e.target.value
                      })}
                      disabled={!isEditing}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                    <Select
                      value={selectedAssignment.status}
                      onChange={(e) => setSelectedAssignment({
                        ...selectedAssignment,
                        status: e.target.value
                      })}
                      disabled={!isEditing}
                    >
                      <SelectItem key="occupied">🟢 Occupied</SelectItem>
                      <SelectItem key="vacant">⚪ Vacant</SelectItem>
                      <SelectItem key="dirty">🟡 Dirty</SelectItem>
                      <SelectItem key="clean">🔵 Clean</SelectItem>
                      <SelectItem key="inspected">🟣 Inspected</SelectItem>
                      <SelectItem key="out-of-order">🔴 Out of Order</SelectItem>
                      <SelectItem key="maintenance">🟠 Maintenance</SelectItem>
                    </Select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Rate (₵)</label>
                    <Input
                      type="number"
                      value={String(selectedAssignment.rate)}
                      onChange={(e) => setSelectedAssignment({
                        ...selectedAssignment,
                        rate: parseFloat(e.target.value) || 0
                      })}
                      disabled={!isEditing}
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Current Guest</label>
                  <Input
                    value={selectedAssignment.currentGuest || ''}
                    onChange={(e) => setSelectedAssignment({
                      ...selectedAssignment,
                      currentGuest: e.target.value
                    })}
                    disabled={!isEditing}
                    placeholder="Guest name"
                  />
                  {selectedAssignment.reservedGuest && (
                    <p className="mt-1 text-sm text-blue-800">
                      Reserved for {selectedAssignment.reservedGuest}
                      {selectedAssignment.reservedArrival ? ` · ${shortDay(selectedAssignment.reservedArrival)}` : ''}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Check In Date</label>
                    <Input
                      type="date"
                      value={selectedAssignment.checkInDate ? selectedAssignment.checkInDate.split('T')[0] : ''}
                      onChange={(e) => setSelectedAssignment({
                        ...selectedAssignment,
                        checkInDate: e.target.value
                      })}
                      disabled={!isEditing}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Check Out Date</label>
                    <Input
                      type="date"
                      value={selectedAssignment.checkOutDate ? selectedAssignment.checkOutDate.split('T')[0] : ''}
                      onChange={(e) => setSelectedAssignment({
                        ...selectedAssignment,
                        checkOutDate: e.target.value
                      })}
                      disabled={!isEditing}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <Input
                    value={selectedAssignment.notes || ''}
                    onChange={(e) => setSelectedAssignment({
                      ...selectedAssignment,
                      notes: e.target.value
                    })}
                    disabled={!isEditing}
                    placeholder="Additional notes about this assignment"
                  />
                </div>

                {!isEditing && (
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h4 className="font-medium text-gray-900 mb-2">Quick Actions</h4>
                    <div className="flex space-x-2">
                      <Button
                        size="sm"
                        color="warning"
                        variant="flat"
                        onClick={() => handleQuickAction('maintenance', selectedAssignment)}
                      >
                        🔧 Report Issue
                      </Button>
                      <Button
                        size="sm"
                        color="primary"
                        variant="flat"
                        onClick={() => handleQuickAction('clean', selectedAssignment)}
                      >
                        🧹 Mark for Cleaning
                      </Button>
                      {selectedAssignment.status === 'occupied' && (
                        <Button
                          size="sm"
                          color="danger"
                          variant="flat"
                          onClick={() => handleQuickAction('checkout', selectedAssignment)}
                        >
                          🚪 Check Out
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            {isEditing ? (
              <>
                <Button color="primary" onClick={handleSaveAssignment}>
                  💾 Save Changes
                </Button>
                <Button variant="light" onClick={() => setIsEditing(false)}>
                  Cancel
                </Button>
              </>
            ) : (
              <>
                <Button color="primary" onClick={handleEditAssignment}>
                  ✏️ Edit
                </Button>
                <Button variant="light" onClick={onClose}>
                  Close
                </Button>
              </>
            )}
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
