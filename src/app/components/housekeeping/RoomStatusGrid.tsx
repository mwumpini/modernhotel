'use client';

import React, { useState, useEffect } from 'react';
import { 
  Card, 
  CardBody, 
  Button, 
  Input, 
  Select, 
  SelectItem, 
  Chip, 
  Badge, 
  Modal, 
  ModalContent, 
  ModalHeader, 
  ModalBody, 
  ModalFooter,
  Textarea,
  Tooltip
} from "@heroui/react";
import { housekeepingStore } from '../../lib/housekeeping/store';
import { frontOfficeStore } from '../../lib/frontoffice/store';
import { trackEvent } from '../../lib/analytics/trackEvent';
import { RoomStatus } from '../../lib/housekeeping/types';

interface RoomStatusData {
  roomNumber: string;
  roomTypeId: string;
  status: RoomStatus;
  lastUpdated: string;
  currentGuest?: string;
  checkInDate?: string;
  checkOutDate?: string;
  notes?: string;
  blockedUntil?: string;
}

export default function RoomStatusGrid() {
  const [rooms, setRooms] = useState<RoomStatusData[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<RoomStatusData | null>(null);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [floorFilter, setFloorFilter] = useState<string>('all');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [newStatus, setNewStatus] = useState<RoomStatus>('vacant');
  const [statusReason, setStatusReason] = useState('');
  const [statusNotes, setStatusNotes] = useState('');

  useEffect(() => {
    loadData();
    const unsubscribe = housekeepingStore.subscribe(loadData);
    return unsubscribe;
  }, []);

  const loadData = () => {
    setRooms(housekeepingStore.getAllRooms());
  };

  const handleRoomClick = (room: RoomStatusData) => {
    setSelectedRoom(room);
    setStatusModalOpen(true);
  };

  const handleStatusUpdate = () => {
    if (!selectedRoom || !statusReason) return;

    housekeepingStore.updateRoomStatus(
      selectedRoom.roomNumber, 
      newStatus, 
      'Housekeeping Staff', 
      statusReason
    );

    // Update local notes if provided
    if (statusNotes) {
      // This would typically update the room notes in the store
      console.log('Updating room notes:', statusNotes);
    }

    trackEvent('HK.RoomStatus.Updated', {
      roomNumber: selectedRoom.roomNumber,
      previousStatus: selectedRoom.status,
      newStatus: newStatus,
      reason: statusReason
    });

    setStatusModalOpen(false);
    setStatusReason('');
    setStatusNotes('');
    loadData();
  };

  const handleQuickAction = (action: string, room: RoomStatusData) => {
    let newStatus: RoomStatus;
    let reason: string;

    switch (action) {
      case 'clean':
        newStatus = 'dirty';
        reason = 'Marked for cleaning';
        break;
      case 'maintenance':
        newStatus = 'out-of-order';
        reason = 'Maintenance requested';
        break;
      case 'inspect':
        newStatus = 'clean';
        reason = 'Ready for inspection';
        break;
      case 'block':
        newStatus = 'out-of-order';
        reason = 'Room blocked';
        break;
      case 'available':
        newStatus = 'vacant';
        reason = 'Room made available';
        break;
      default:
        return;
    }

    housekeepingStore.updateRoomStatus(room.roomNumber, newStatus, 'Housekeeping Staff', reason);
    
    trackEvent('HK.RoomStatus.QuickAction', {
      action,
      roomNumber: room.roomNumber,
      status: newStatus
    });
    
    loadData();
  };

  const getStatusColor = (status: RoomStatus) => {
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

  const getStatusIcon = (status: RoomStatus) => {
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

  const getPriorityColor = (status: RoomStatus) => {
    switch (status) {
      case 'dirty': return 'danger';
      case 'maintenance': return 'warning';
      case 'out-of-order': return 'danger';
      case 'occupied': return 'primary';
      default: return 'default';
    }
  };

  const filteredRooms = rooms.filter(room => {
    if (searchTerm && !room.roomNumber.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    if (statusFilter !== 'all' && room.status !== statusFilter) return false;
    if (floorFilter !== 'all' && room.roomNumber.charAt(0) !== floorFilter) return false;
    return true;
  });

  const getRoomTypeName = (typeId: string) => {
    return frontOfficeStore.roomTypes.find(rt => rt.id === typeId)?.name || 'Unknown';
  };

  return (
    <div className="p-6 space-y-4">
      {/* Filters and Search */}
      <Card className="border-0 shadow-lg">
        <CardBody className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Input
              placeholder="Search room numbers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              startContent={<span className="text-gray-400">🔍</span>}
            />
            <Select
              placeholder="Filter by status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <SelectItem key="all">All Statuses</SelectItem>
              <SelectItem key="occupied">🟢 Occupied</SelectItem>
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
              <SelectItem key="all">All Floors</SelectItem>
              <SelectItem key="1">Floor 1</SelectItem>
              <SelectItem key="2">Floor 2</SelectItem>
              <SelectItem key="3">Floor 3</SelectItem>
            </Select>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">Filtered:</span>
              <Badge color="primary" variant="flat">{filteredRooms.length}</Badge>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Room Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredRooms.map((room) => (
          <Card 
            key={room.roomNumber} 
            className={`border-2 cursor-pointer transition-all hover:shadow-lg ${
              room.status === 'dirty' ? 'border-red-200 hover:border-red-400' :
              room.status === 'maintenance' ? 'border-orange-200 hover:border-orange-400' :
              room.status === 'out-of-order' ? 'border-red-300 hover:border-red-500' :
              room.status === 'clean' ? 'border-green-200 hover:border-green-400' :
              room.status === 'inspected' ? 'border-blue-200 hover:border-blue-400' :
              'border-gray-200 hover:border-gray-400'
            }`}
            onClick={() => handleRoomClick(room)}
          >
            <CardBody className="p-4">
              <div className="text-center">
                {/* Room Header */}
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-bold text-ghana-black">Room {room.roomNumber}</h3>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-gray-500">F{room.roomNumber.charAt(0)}</span>
                    {room.status === 'dirty' || room.status === 'maintenance' || room.status === 'out-of-order' ? (
                      <Badge color={getPriorityColor(room.status) as any} variant="flat" size="sm">
                        !
                      </Badge>
                    ) : null}
                  </div>
                </div>
                
                {/* Status Display */}
                <div className="mb-3">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <span className="text-2xl">{getStatusIcon(room.status)}</span>
                    <Chip 
                      color={getStatusColor(room.status) as any} 
                      size="sm"
                      variant="flat"
                    >
                      {room.status.replace('-', ' ').charAt(0).toUpperCase() + room.status.replace('-', ' ').slice(1)}
                    </Chip>
                  </div>
                </div>
                
                {/* Room Details */}
                <div className="space-y-2 mb-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Type:</span>
                    <Badge color="secondary" variant="flat" size="sm">
                      {getRoomTypeName(room.roomTypeId)}
                    </Badge>
                  </div>
                  
                  {room.currentGuest && (
                    <div className="p-2 bg-blue-50 rounded text-left">
                      <p className="text-xs font-medium text-blue-800">Guest: {room.currentGuest}</p>
                      {room.checkOutDate && (
                        <p className="text-xs text-blue-600">
                          Check-out: {new Date(room.checkOutDate).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  )}
                  
                  {room.notes && (
                    <div className="p-2 bg-yellow-50 rounded text-left">
                      <p className="text-xs text-yellow-800">{room.notes}</p>
                    </div>
                  )}
                  
                  <div className="text-xs text-gray-500">
                    <p>Updated: {new Date(room.lastUpdated).toLocaleTimeString()}</p>
                  </div>
                </div>
                
                {/* Quick Actions */}
                <div className="flex gap-1 justify-center">
                  <Tooltip content="Mark for cleaning">
                    <Button 
                      size="sm" 
                      color="warning" 
                      variant="flat"
                      isIconOnly
                      onClick={(e) => {
                        e.stopPropagation();
                        handleQuickAction('clean', room);
                      }}
                    >
                      🧹
                    </Button>
                  </Tooltip>
                  
                  <Tooltip content="Report issue">
                    <Button 
                      size="sm" 
                      color="danger" 
                      variant="flat"
                      isIconOnly
                      onClick={(e) => {
                        e.stopPropagation();
                        handleQuickAction('maintenance', room);
                      }}
                    >
                      🔧
                    </Button>
                  </Tooltip>
                  
                  <Tooltip content="Ready for inspection">
                    <Button 
                      size="sm" 
                      color="primary" 
                      variant="flat"
                      isIconOnly
                      onClick={(e) => {
                        e.stopPropagation();
                        handleQuickAction('inspect', room);
                      }}
                    >
                      🔍
                    </Button>
                  </Tooltip>
                </div>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      {/* Room Status Update Modal */}
      <Modal isOpen={statusModalOpen} onClose={() => setStatusModalOpen(false)} size="2xl">
        <ModalContent>
          <ModalHeader>Update Room {selectedRoom?.roomNumber} Status</ModalHeader>
          <ModalBody>
            {selectedRoom && (
              <div className="space-y-4">
                {/* Current Status */}
                <div className="p-4 bg-gray-50 rounded-lg">
                  <h4 className="font-medium text-gray-900 mb-2">Current Status</h4>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{getStatusIcon(selectedRoom.status)}</span>
                    <Chip color={getStatusColor(selectedRoom.status) as any} variant="flat">
                      {selectedRoom.status.replace('-', ' ').charAt(0).toUpperCase() + selectedRoom.status.replace('-', ' ').slice(1)}
                    </Chip>
                  </div>
                </div>

                {/* New Status Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">New Status *</label>
                  <Select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value as RoomStatus)}
                    placeholder="Select new status"
                  >
                    <SelectItem key="vacant">⚪ Vacant</SelectItem>
                    <SelectItem key="dirty">🟡 Dirty</SelectItem>
                    <SelectItem key="clean">🔵 Clean</SelectItem>
                    <SelectItem key="inspected">🟣 Inspected</SelectItem>
                    <SelectItem key="maintenance">🟠 Maintenance</SelectItem>
                    <SelectItem key="out-of-order">🔴 Out of Order</SelectItem>
                  </Select>
                </div>

                {/* Reason for Change */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Reason for Change *</label>
                  <Input
                    value={statusReason}
                    onChange={(e) => setStatusReason(e.target.value)}
                    placeholder="Why is the status changing?"
                    isRequired
                  />
                </div>

                {/* Additional Notes */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Additional Notes</label>
                  <Textarea
                    value={statusNotes}
                    onChange={(e) => setStatusNotes(e.target.value)}
                    placeholder="Any additional information about this room..."
                    rows={3}
                  />
                </div>

                {/* Room Information */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-gray-700">Room Number:</span>
                    <span className="ml-2">{selectedRoom.roomNumber}</span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Room Type:</span>
                    <span className="ml-2">{getRoomTypeName(selectedRoom.roomTypeId)}</span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Current Guest:</span>
                    <span className="ml-2">{selectedRoom.currentGuest || 'None'}</span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Last Updated:</span>
                    <span className="ml-2">{new Date(selectedRoom.lastUpdated).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onClick={() => setStatusModalOpen(false)}>
              Cancel
            </Button>
            <Button 
              color="primary" 
              onClick={handleStatusUpdate}
              isDisabled={!statusReason}
            >
              Update Status
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
