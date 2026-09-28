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
      case 'dirty':
        newStatus = 'dirty';
        reason = 'Marked for cleaning';
        break;
      case 'progress':
        newStatus = 'dirty';
        reason = 'Cleaning in progress';
        break;
      case 'ready':
        newStatus = 'clean';
        reason = 'Marked clean';
        break;
      case 'inspected':
        newStatus = 'inspected';
        reason = 'Passed floor inspection';
        break;
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

    if (action === 'dirty') {
      // Stayover clean while occupied; turnover after vacant/checkout-style dirty.
      const taskType = room.status === 'occupied' ? 'daily' : 'turnover';
      housekeepingStore.ensureOpenCleaningTask({
        location: room.roomNumber,
        roomTypeId: room.roomTypeId || 'standard',
        taskType,
        priority: 'high',
        estimatedMinutes: taskType === 'turnover' ? 45 : 25,
        notes: `Auto-created when room marked dirty`,
      });
    }

    if (action === 'progress') {
      let task = housekeepingStore.getOpenCleaningTask(room.roomNumber);
      if (!task) {
        task = housekeepingStore.ensureOpenCleaningTask({
          location: room.roomNumber,
          roomTypeId: room.roomTypeId || 'standard',
          taskType: 'daily',
          priority: 'high',
          notes: 'Auto-created when cleaning started',
        });
      }
      if (task.status === 'pending') {
        housekeepingStore.updateTaskStatus(task.id, 'in-progress');
      }
    }

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
    <div className="space-y-3">
      {/* Filters and Search */}
      <div className="mb-[18px] flex flex-nowrap items-center gap-2 overflow-x-auto">
        <Input
          size="sm"
          placeholder="Search room numbers..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          startContent={<span className="text-gray-400">🔍</span>}
          className="w-52 shrink-0"
        />
        <Select
          size="sm"
          placeholder="Filter by status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="w-44 shrink-0"
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
          size="sm"
          placeholder="Filter by floor"
          value={floorFilter}
          onChange={(e) => setFloorFilter(e.target.value)}
          className="w-36 shrink-0"
        >
          <SelectItem key="all">All Floors</SelectItem>
          <SelectItem key="1">Floor 1</SelectItem>
          <SelectItem key="2">Floor 2</SelectItem>
          <SelectItem key="3">Floor 3</SelectItem>
        </Select>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-sm text-gray-600">Filtered:</span>
          <Badge color="primary" variant="flat">{filteredRooms.length}</Badge>
        </div>
      </div>

      {/* Room Grid — slightly wider cards so status + actions don’t collide */}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))] gap-2.5">
        {filteredRooms.map((room) => (
          <Card
            key={room.roomNumber}
            className={`border shadow-none cursor-pointer transition-colors hover:border-ghana-gold ${
              room.status === 'dirty' ? 'border-red-200' :
              room.status === 'maintenance' ? 'border-orange-200' :
              room.status === 'out-of-order' ? 'border-red-300' :
              room.status === 'clean' ? 'border-green-200' :
              room.status === 'inspected' ? 'border-blue-200' :
              'border-gray-200'
            }`}
            onClick={() => handleRoomClick(room)}
          >
            <CardBody className="gap-2 overflow-hidden p-3">
              <div className="flex items-start justify-between gap-2 min-w-0">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold text-ghana-black leading-tight">
                    {room.roomNumber}
                  </p>
                  <p className="truncate text-xs text-gray-500 leading-tight">
                    F{room.roomNumber.charAt(0)} · {getRoomTypeName(room.roomTypeId)}
                  </p>
                </div>
                {(room.status === 'dirty' || room.status === 'maintenance' || room.status === 'out-of-order') && (
                  <Badge color={getPriorityColor(room.status) as any} variant="flat" size="sm" className="shrink-0">
                    !
                  </Badge>
                )}
              </div>

              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-base leading-none shrink-0" aria-hidden>{getStatusIcon(room.status)}</span>
                <Chip
                  color={getStatusColor(room.status) as any}
                  size="sm"
                  variant="flat"
                  className="h-6 max-w-full min-w-0"
                  classNames={{ content: 'truncate px-1 text-xs' }}
                >
                  {room.status.replace('-', ' ').charAt(0).toUpperCase() + room.status.replace('-', ' ').slice(1)}
                </Chip>
              </div>

              {room.currentGuest && (
                <p className="truncate text-xs text-blue-700" title={room.currentGuest}>
                  {room.currentGuest}
                </p>
              )}

              <div className="mt-auto flex flex-col gap-1.5 pt-1">
                <span className="text-[11px] tabular-nums text-gray-400">
                  {new Date(room.lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                <div className="flex flex-wrap gap-1" onClick={(e) => e.stopPropagation()}>
                  <Tooltip content="Mark dirty">
                    <Button
                      size="sm"
                      color="warning"
                      variant="flat"
                      isIconOnly
                      className="min-w-7 w-7 h-7"
                      onPress={() => handleQuickAction('dirty', room)}
                    >
                      🧹
                    </Button>
                  </Tooltip>
                  <Tooltip content="In progress">
                    <Button
                      size="sm"
                      color="primary"
                      variant="flat"
                      isIconOnly
                      className="min-w-7 w-7 h-7"
                      onPress={() => handleQuickAction('progress', room)}
                    >
                      🔄
                    </Button>
                  </Tooltip>
                  <Tooltip content="Mark clean">
                    <Button
                      size="sm"
                      color="success"
                      variant="flat"
                      isIconOnly
                      className="min-w-7 w-7 h-7"
                      onPress={() => handleQuickAction('ready', room)}
                    >
                      ✅
                    </Button>
                  </Tooltip>
                  <Tooltip content="Mark inspected">
                    <Button
                      size="sm"
                      color="secondary"
                      variant="flat"
                      isIconOnly
                      className="min-w-7 w-7 h-7"
                      onPress={() => handleQuickAction('inspected', room)}
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
