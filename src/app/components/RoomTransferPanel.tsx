'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Button, Card, CardBody, Select, SelectItem, Switch } from '@heroui/react';
import { frontOfficeStore } from '../lib/frontoffice/store';
import { housekeepingStore } from '../lib/housekeeping/store';
import { useSettingsStore } from '../lib/settings/store';
import { notifyError, notifySuccess } from '../lib/notifications/notify';
import { formatMoney } from '../lib/format/currency';
import type { Reservation } from '../lib/frontoffice/types';

const REASONS = [
  { key: 'guest-request', label: 'Guest request' },
  { key: 'maintenance', label: 'Maintenance' },
  { key: 'upgrade', label: 'Upgrade' },
  { key: 'downgrade', label: 'Downgrade' },
  { key: 'noise', label: 'Noise' },
  { key: 'room-issue', label: 'Room issue' },
];

function localToday() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

function shortDay(iso?: string) {
  const day = (iso || '').slice(0, 10);
  if (!day) return '';
  const [year, month, date] = day.split('-').map(Number);
  return new Date(year, (month || 1) - 1, date || 1).toLocaleDateString();
}

function money(amount: number) {
  return `₵${formatMoney(amount)}`;
}

function nightlyOn(stay: Reservation, today: string, roomTypeId?: string) {
  const breakdown = roomTypeId
    ? frontOfficeStore.calculateRateBreakdown(roomTypeId, stay.arrival, stay.departure, undefined, undefined, stay.taxExempt)
    : frontOfficeStore.getReservationQuote(stay).breakdown;
  const night = breakdown.find((day) => day.date.slice(0, 10) >= today) || breakdown[0];
  return night?.total || 0;
}

function roomTypeName(roomTypeId?: string) {
  if (!roomTypeId) return 'Room';
  return frontOfficeStore.roomTypes.find((type) => type.id === roomTypeId)?.name
    || useSettingsStore.getState().roomManagement?.roomTypes?.find((type) => type.id === roomTypeId)?.name
    || 'Room';
}

function freeRooms(stay: Reservation, today: string) {
  const ready = new Set(['vacant', 'clean', 'inspected']);
  return frontOfficeStore.rooms
    .filter((room) => {
      const number = room.id;
      if (!number || number === stay.roomId) return false;
      if (!frontOfficeStore.isRoomBookable(number)) return false;
      if (!frontOfficeStore.isRoomFreeForRange(number, today, stay.departure, stay.id)) return false;
      const status = housekeepingStore.getAllRooms().find((item) => item.roomNumber === number)?.status;
      return !status || ready.has(status);
    })
    .map((room) => ({
      number: room.id,
      type: roomTypeName(room.roomTypeId),
    }))
    .sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }));
}

export default function RoomTransferPanel() {
  const [tick, setTick] = useState(0);
  const [guestId, setGuestId] = useState('');
  const [roomNumber, setRoomNumber] = useState('');
  const [reason, setReason] = useState('');
  const [keepRate, setKeepRate] = useState(true);
  const [busy, setBusy] = useState(false);
  const canTransfer = useSettingsStore((s) => s.hasPermission('frontdesk.assign-room'));

  useEffect(() => frontOfficeStore.subscribe(() => setTick((n) => n + 1)), []);

  const today = localToday();
  const inHouse = useMemo(() => {
    return frontOfficeStore.reservations
      .filter((stay) => stay.status === 'checked-in' && stay.roomId && stay.roomId !== 'TBD')
      .sort((a, b) => a.guestName.localeCompare(b.guestName));
  }, [tick]);
  const stay = inHouse.find((item) => item.id === guestId) || null;
  const rooms = stay ? freeRooms(stay, today) : [];
  const chosen = rooms.find((room) => room.number === roomNumber) || null;
  const currentRate = stay ? nightlyOn(stay, today) : 0;
  const nextTypeId = chosen ? frontOfficeStore.rooms.find((room) => room.id === chosen.number)?.roomTypeId : undefined;
  const nextRate = stay && nextTypeId ? nightlyOn(stay, today, nextTypeId) : 0;

  const transfer = () => {
    if (!stay || !stay.roomId || !roomNumber || !reason) return;
    if (!canTransfer) {
      notifyError('You cannot move a guest to another room.', 'Room transfer');
      return;
    }
    const from = stay.roomId;
    setBusy(true);
    try {
      frontOfficeStore.assignRoom(stay.id, roomNumber, { keepRate });
      try { housekeepingStore.updateRoomStatus(from, 'dirty', 'Front Office', `Transferred ${stay.guestName} to ${roomNumber}`); } catch {}
      try { housekeepingStore.updateRoomStatus(roomNumber, 'occupied', 'Front Office', `Transferred ${stay.guestName} from ${from}`); } catch {}
      notifySuccess(`${stay.guestName} is now in ${roomNumber}. Nights already stayed stay on ${from}.`, 'Room transfer');
      setRoomNumber('');
      setReason('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card shadow="sm">
      <CardBody className="gap-4">
        <div>
          <h4 className="text-base font-semibold text-ghana-black">Room transfer</h4>
          <p className="text-sm text-gray-500">Move an in-house guest. Nights already stayed keep the old room and the old rate. From today, the guest is in the new room.</p>
        </div>
        {inHouse.length === 0 && <p className="text-sm text-gray-600">No guest is in house.</p>}
        {inHouse.length > 0 && (
          <Select
            label="Guest"
            placeholder="Choose an in-house guest"
            selectedKeys={guestId ? [guestId] : []}
            onSelectionChange={(keys) => {
              const value = Array.from(keys)[0];
              setGuestId(value ? String(value) : '');
              setRoomNumber('');
              setKeepRate(true);
            }}
          >
            {inHouse.map((item) => (
              <SelectItem key={item.id} textValue={`${item.guestName} ${item.roomId}`}>
                {item.guestName} · Room {item.roomId}
              </SelectItem>
            ))}
          </Select>
        )}
        {stay && (
          <>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Fact label="Current room" value={stay.roomId || '—'} />
              <Fact label="Type" value={roomTypeName(stay.roomTypeId)} />
              <Fact label="Check-in" value={shortDay(stay.arrival)} />
              <Fact label="Check-out" value={shortDay(stay.departure)} />
            </div>
            <Select
              label="New room"
              placeholder={rooms.length ? 'Choose a vacant room' : 'No vacant room is free'}
              selectedKeys={roomNumber ? [roomNumber] : []}
              isDisabled={rooms.length === 0}
              onSelectionChange={(keys) => {
                const value = Array.from(keys)[0];
                setRoomNumber(value ? String(value) : '');
              }}
            >
              {rooms.map((room) => (
                <SelectItem key={room.number} textValue={`${room.number} ${room.type}`}>
                  {room.number} · {room.type}
                </SelectItem>
              ))}
            </Select>
            {chosen && (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <Fact label="Current rate" value={money(currentRate)} />
                <Fact label="New room rate" value={money(nextRate)} />
                <div className="sm:col-span-1">
                  <Switch isSelected={keepRate} onValueChange={setKeepRate} size="sm">
                    Keep the current rate
                  </Switch>
                  <p className="mt-1 text-xs text-gray-500">
                    {keepRate
                      ? 'From today this stay keeps the current nightly rate.'
                      : 'From today this stay uses the new room rate. Nights already posted are left as they are.'}
                  </p>
                </div>
              </div>
            )}
            <Select
              label="Reason"
              placeholder="Why is this guest moving?"
              selectedKeys={reason ? [reason] : []}
              onSelectionChange={(keys) => {
                const value = Array.from(keys)[0];
                setReason(value ? String(value) : '');
              }}
            >
              {REASONS.map((item) => (
                <SelectItem key={item.key}>{item.label}</SelectItem>
              ))}
            </Select>
            {!canTransfer && <p className="text-sm text-gray-600">You cannot move a guest to another room.</p>}
            <div>
              <Button color="primary" isDisabled={!roomNumber || !reason || !canTransfer} isLoading={busy} onPress={transfer}>
                Transfer
              </Button>
            </div>
          </>
        )}
      </CardBody>
    </Card>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-gray-500">{label}</div>
      <div className="font-semibold text-ghana-black">{value}</div>
    </div>
  );
}
