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
} from "@heroui/react";
import { useSession } from 'next-auth/react';
import { housekeepingStore } from '../../lib/housekeeping/store';
import { frontOfficeStore } from '../../lib/frontoffice/store';
import { trackEvent } from '../../lib/analytics/trackEvent';
import { RoomStatus } from '../../lib/housekeeping/types';
import { getClientTenantSubdomain } from '../../lib/api/clientTenant';
import { cleanerStaffForUser } from '../../lib/housekeeping/attendantView';

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

function hkHeaders(): HeadersInit {
  return { 'Content-Type': 'application/json', 'x-tenant-subdomain': getClientTenantSubdomain() };
}

const UNDO_MS = 10 * 60 * 1000;

function stockSentence(preview: {
  suppliesIssued?: boolean;
  lines?: { itemName?: string; quantity?: number }[];
  alreadyTaken?: { itemName?: string; quantity?: number }[];
}) {
  const list = (rows?: { itemName?: string; quantity?: number }[]) =>
    (rows || [])
      .filter((line) => Number(line.quantity) > 0)
      .map((line) => `${line.itemName || 'Item'} × ${line.quantity}`)
      .join(', ');
  if (preview.suppliesIssued) {
    const taken = list(preview.alreadyTaken);
    return taken ? `Nothing more comes off stock. Already taken: ${taken}.` : 'Nothing comes off stock.';
  }
  const coming = list(preview.lines);
  return coming ? `${coming} will come off stock.` : 'Nothing comes off stock.';
}

export default function RoomStatusGrid({ attendant = false }: { attendant?: boolean }) {
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
  const [notice, setNotice] = useState('');
  const [busyRoom, setBusyRoom] = useState<string | null>(null);
  const [needRoom, setNeedRoom] = useState<RoomStatusData | null>(null);
  const [supplyItems, setSupplyItems] = useState<{ id: string; name: string }[]>([]);
  const [extraItemId, setExtraItemId] = useState('');
  const [extraQty, setExtraQty] = useState('1');
  const [kitNote, setKitNote] = useState('');
  const [confirmRoom, setConfirmRoom] = useState<RoomStatusData | null>(null);
  const [confirmExtras, setConfirmExtras] = useState<{ itemId: string; quantity: number }[]>([]);
  const [confirmText, setConfirmText] = useState('');
  const [clock, setClock] = useState(() => Date.now());
  const { data: session } = useSession();

  useEffect(() => {
    const id = window.setInterval(() => setClock(Date.now()), 15000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    loadData();
    const unsubscribe = housekeepingStore.subscribe(loadData);
    return unsubscribe;
  }, []);

  const loadData = () => {
    setRooms(housekeepingStore.getAllRooms());
  };

  const handleRoomClick = (room: RoomStatusData) => {
    if (attendant) return;
    setSelectedRoom(room);
    setStatusModalOpen(true);
  };

  const ensureOpenTask = async (room: RoomStatusData) => {
    let task = housekeepingStore.getOpenCleaningTask(room.roomNumber);
    if (task || attendant) return task;
    const taskType = room.status === 'occupied' ? 'daily' : 'turnover';
    task = housekeepingStore.ensureOpenCleaningTask({
      location: room.roomNumber,
      roomTypeId: room.roomTypeId || 'standard',
      taskType,
      priority: 'high',
      estimatedMinutes: taskType === 'turnover' ? 45 : 25,
      notes: 'Opened by supervisor',
    });
    const opened = await fetch('/api/housekeeping/tasks', {
      method: 'POST',
      headers: hkHeaders(),
      body: JSON.stringify({
        id: task.id,
        roomNumber: task.roomNumber,
        taskType: task.taskType,
        status: task.status,
        priority: task.priority,
        notes: task.notes,
        details: {
          roomTypeId: task.roomTypeId,
          estimatedMinutes: task.estimatedMinutes,
          checklist: task.checklist,
          completedItems: [],
        },
      }),
    });
    if (!opened.ok) throw new Error('Could not open the clean.');
    return task;
  };

  const finishRoom = async (room: RoomStatusData, extras: { itemId: string; quantity: number }[]) => {
    setBusyRoom(room.roomNumber);
    setNotice('');
    try {
      const task = await ensureOpenTask(room);
      if (!task) throw new Error('This room is not on your list.');
      const res = await fetch(`/api/housekeeping/tasks/${encodeURIComponent(task.id)}/finish`, {
        method: 'POST',
        headers: hkHeaders(),
        body: JSON.stringify({ extras }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not finish the room.');
      housekeepingStore.updateRoomStatus(room.roomNumber, 'clean', attendant ? 'Cleaner' : 'Supervisor', 'Finished the clean');
      await housekeepingStore.hydrateFromApi();
      const taken = Array.isArray(data.issued)
        ? data.issued.map((line: { itemName?: string; quantity?: number }) => `${line.itemName} × ${line.quantity}`).join(', ')
        : '';
      const extraNote = data.extraPending ? ' The extra request is waiting for a supervisor.' : '';
      setNotice(taken ? `Room ${room.roomNumber} is done. Taken: ${taken}.${extraNote}` : `Room ${room.roomNumber} is done. Nothing came off stock.${extraNote} Undo is here for 10 minutes. Stock stays out.`);
      setNeedRoom(null);
      setConfirmRoom(null);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not finish the room.');
    } finally {
      setBusyRoom(null);
      loadData();
    }
  };

  const askToFinish = async (room: RoomStatusData, extras: { itemId: string; quantity: number }[]) => {
    setNeedRoom(null);
    setConfirmRoom(room);
    setConfirmExtras(extras);
    setConfirmText('');
    setNotice('');
    try {
      const task = housekeepingStore.getOpenCleaningTask(room.roomNumber);
      if (!task && attendant) throw new Error('This room is not on your list.');
      if (!task) {
        setConfirmText('Press Finish to open this clean and take its kit.');
        return;
      }
      const res = await fetch(`/api/housekeeping/tasks/${encodeURIComponent(task.id)}/finish`, { headers: hkHeaders() });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not check the kit.');
      setConfirmText(stockSentence(data));
    } catch (error) {
      setConfirmText(error instanceof Error ? error.message : 'Could not check the kit.');
    }
  };

  const undoRoom = async (room: RoomStatusData, taskId: string) => {
    setBusyRoom(room.roomNumber);
    setNotice('');
    try {
      const res = await fetch(`/api/housekeeping/tasks/${encodeURIComponent(taskId)}/undo`, {
        method: 'POST',
        headers: hkHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not undo the room.');
      housekeepingStore.updateRoomStatus(room.roomNumber, 'dirty', attendant ? 'Cleaner' : 'Supervisor', 'Undid the finish');
      await housekeepingStore.hydrateFromApi();
      setNotice(`Room ${room.roomNumber} is back to cleaning. Stock stays out.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not undo the room.');
    } finally {
      setBusyRoom(null);
      loadData();
    }
  };

  const openNeedMore = (room: RoomStatusData) => {
    setNeedRoom(room);
    setExtraItemId('');
    setExtraQty('1');
    setKitNote('');
    setNotice('');
    const task = housekeepingStore.getOpenCleaningTask(room.roomNumber);
    if (task) {
      fetch(`/api/housekeeping/tasks/${encodeURIComponent(task.id)}/finish`, { headers: hkHeaders() })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => { if (data) setKitNote(stockSentence(data)); })
        .catch(() => setKitNote(''));
    }
    fetch('/api/housekeeping/cleaning-kits', { headers: hkHeaders() })
      .then((res) => (res.ok ? res.json() : { items: [] }))
      .then((data) => setSupplyItems(data.items || []))
      .catch(() => setSupplyItems([]));
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
      if (!task && attendant) {
        setNotice('This room is not on your list.');
        return;
      }
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
      setNotice(`Room ${room.roomNumber} started.`);
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

  const myStaff = attendant
    ? cleanerStaffForUser(housekeepingStore.getAllStaff(), session?.user?.name)
    : null;

  const assignedToMe = (task: { assignedTo?: string; assignedName?: string }) =>
    !!myStaff && (task.assignedTo === myStaff.id || (task.assignedName || '').trim().toLowerCase() === myStaff.name.trim().toLowerCase());

  const recentFinish = (roomNumber: string) => {
    const cutoff = clock - UNDO_MS;
    return housekeepingStore.getAllTasks().find((task) => {
      if (task.roomNumber !== roomNumber || task.status !== 'completed' || !task.completedAt) return false;
      if (new Date(task.completedAt).getTime() < cutoff) return false;
      if (attendant && !assignedToMe(task)) return false;
      return true;
    });
  };

  const filteredRooms = rooms.filter(room => {
    if (attendant) {
      if (!myStaff) return false;
      const task = housekeepingStore.getOpenCleaningTask(room.roomNumber);
      if (task && assignedToMe(task)) return true;
      return !!recentFinish(room.roomNumber);
    }
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
      {notice && <p className="rounded-lg bg-gray-100 px-3 py-2 text-sm text-ghana-black">{notice}</p>}
      {attendant && housekeepingStore.getAllStaff().length === 0 && (
        <p className="text-sm text-gray-600">Loading your rooms…</p>
      )}
      {attendant && housekeepingStore.getAllStaff().length > 0 && !myStaff && (
        <p className="text-sm text-gray-600">Your sign-in name is not on the cleaner list. Ask your supervisor to use the same name.</p>
      )}
      {attendant && myStaff && filteredRooms.length === 0 && (
        <p className="text-sm text-gray-600">No rooms assigned to you.</p>
      )}
      {/* Filters and Search — wrap on phone / zoomed tablet */}
      {!attendant && (
      <div className="mb-[18px] flex flex-wrap items-center gap-2">
        <Input
          size="sm"
          placeholder="Search room numbers..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          startContent={<span className="text-gray-400">🔍</span>}
          className="w-full max-w-full sm:w-52 sm:max-w-[13rem] shrink-0"
        />
        <Select
          size="sm"
          placeholder="Filter by status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="w-full max-w-full sm:w-44 sm:max-w-[11rem] shrink-0"
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
          className="w-full max-w-full sm:w-36 sm:max-w-[9rem] shrink-0"
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
      )}

      {/* Room Grid — phone-friendly cards with finger-sized status actions */}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,10.5rem),1fr))] gap-2.5">
        {filteredRooms.map((room) => {
          const openTask = housekeepingStore.getOpenCleaningTask(room.roomNumber);
          const finished = !openTask ? recentFinish(room.roomNumber) : undefined;
          const started = openTask?.status === 'in-progress';
          return (
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
                <span className="text-base leading-none shrink-0" aria-hidden>{finished ? '✅' : started ? '🧽' : getStatusIcon(room.status)}</span>
                <Chip
                  color={(finished ? 'success' : started ? 'primary' : getStatusColor(room.status)) as any}
                  size="sm"
                  variant="flat"
                  className="h-6 max-w-full min-w-0"
                  classNames={{ content: 'truncate px-1 text-xs' }}
                >
                  {finished
                    ? 'Done'
                    : started
                      ? 'Cleaning'
                      : room.status.replace('-', ' ').charAt(0).toUpperCase() + room.status.replace('-', ' ').slice(1)}
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
                <div className={attendant ? 'flex flex-col gap-1.5' : 'grid grid-cols-2 gap-1.5'} onClick={(e) => e.stopPropagation()}>
                  {finished ? (
                    <button
                      type="button"
                      disabled={busyRoom === room.roomNumber}
                      className={attendant ? 'min-h-12 rounded-lg bg-amber-100 text-sm font-medium text-amber-950 disabled:opacity-50' : 'col-span-2 min-h-10 rounded-lg bg-amber-100 text-[11px] font-medium text-amber-950 disabled:opacity-50'}
                      onClick={() => undoRoom(room, finished.id)}
                    >
                      {busyRoom === room.roomNumber ? 'Working…' : 'Undo'}
                    </button>
                  ) : (
                  <>
                  {!attendant && (
                    <button type="button" className="min-h-10 rounded-lg bg-amber-100 px-1 text-[11px] font-medium text-amber-900" onClick={() => handleQuickAction('dirty', room)}>
                      Dirty
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={busyRoom === room.roomNumber || started}
                    className={attendant ? 'min-h-12 rounded-lg bg-blue-100 text-sm font-medium text-blue-900 disabled:opacity-50' : 'min-h-10 rounded-lg bg-blue-100 px-1 text-[11px] font-medium text-blue-900 disabled:opacity-50'}
                    onClick={() => handleQuickAction('progress', room)}
                  >
                    {started ? 'Started' : 'Start'}
                  </button>
                  <button
                    type="button"
                    disabled={busyRoom === room.roomNumber}
                    className={attendant ? 'min-h-12 rounded-lg bg-green-100 text-sm font-medium text-green-900 disabled:opacity-50' : 'min-h-10 rounded-lg bg-green-100 px-1 text-[11px] font-medium text-green-900 disabled:opacity-50'}
                    onClick={() => askToFinish(room, [])}
                  >
                    {busyRoom === room.roomNumber ? 'Working…' : 'Done'}
                  </button>
                  {attendant ? (
                    <button
                      type="button"
                      disabled={busyRoom === room.roomNumber}
                      className="min-h-12 rounded-lg bg-gray-100 text-sm font-medium text-gray-800 disabled:opacity-50"
                      onClick={() => openNeedMore(room)}
                    >
                      Need more
                    </button>
                  ) : (
                    <button type="button" className="min-h-10 rounded-lg bg-purple-100 px-1 text-[11px] font-medium text-purple-900" onClick={() => handleQuickAction('inspected', room)}>
                      Inspect
                    </button>
                  )}
                  </>
                  )}
                </div>
              </div>
            </CardBody>
          </Card>
          );
        })}
      </div>

      <Modal isOpen={!!needRoom} onClose={() => setNeedRoom(null)} size="md" placement="center" classNames={{ base: 'dialog-fit' }}>
        <ModalContent>
          <ModalHeader>Need more — room {needRoom?.roomNumber}</ModalHeader>
          <ModalBody>
            <p className="text-sm text-gray-600">This stays a request. Stock does not move until a supervisor approves it.</p>
            {kitNote && <p className="text-sm text-ghana-black">{kitNote}</p>}
            <label className="block text-sm font-medium text-gray-700">Supply</label>
            <select
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
              value={extraItemId}
              onChange={(e) => setExtraItemId(e.target.value)}
            >
              <option value="">Choose a supply</option>
              {supplyItems.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
            <label className="block text-sm font-medium text-gray-700">Quantity</label>
            <input
              type="number"
              min={1}
              className="w-24 rounded-lg border border-gray-300 px-3 py-2 text-sm"
              value={extraQty}
              onChange={(e) => setExtraQty(e.target.value)}
            />
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={() => setNeedRoom(null)}>Cancel</Button>
            <button
              type="button"
              disabled={!extraItemId || !needRoom || (!!needRoom && busyRoom === needRoom.roomNumber)}
              className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
              onClick={() => {
                if (!needRoom || !extraItemId) return;
                const quantity = Math.max(1, Math.floor(Number(extraQty) || 1));
                askToFinish(needRoom, [{ itemId: extraItemId, quantity }]);
              }}
            >
              Continue
            </button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={!!confirmRoom} onClose={() => !busyRoom && setConfirmRoom(null)} size="md" placement="center" classNames={{ base: 'dialog-fit' }}>
        <ModalContent>
          <ModalHeader>Finish room {confirmRoom?.roomNumber}?</ModalHeader>
          <ModalBody>
            <p className="text-sm text-ghana-black">{confirmText || 'Checking what comes off stock…'}</p>
            {confirmExtras.length > 0 && (
              <p className="text-sm text-gray-600">The extra stays a request until a supervisor approves it.</p>
            )}
            <p className="text-sm text-gray-600">Undo stays on the card for 10 minutes. Stock stays out.</p>
          </ModalBody>
          <ModalFooter>
            <button
              type="button"
              className="rounded-lg bg-gray-100 px-3 py-2 text-sm font-medium text-gray-800"
              onClick={() => setConfirmRoom(null)}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!confirmText || confirmText.startsWith('Could not') || confirmText.includes('not on your list') || (!!confirmRoom && busyRoom === confirmRoom.roomNumber)}
              className="rounded-lg bg-green-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
              onClick={() => { if (confirmRoom) finishRoom(confirmRoom, confirmExtras); }}
            >
              {confirmRoom && busyRoom === confirmRoom.roomNumber ? 'Working…' : 'Finish'}
            </button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Room Status Update Modal */}
      <Modal isOpen={statusModalOpen} onClose={() => setStatusModalOpen(false)} size="2xl" scrollBehavior="inside">
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
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
