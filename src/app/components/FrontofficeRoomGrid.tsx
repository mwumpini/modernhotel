'use client';

import React from 'react';
import { Card, CardBody, CardHeader, Badge, Select, SelectItem, Input, Tooltip } from '@heroui/react';
import { useFrontOfficeRooms, useFrontOfficeRoomTypes, useFrontOfficeReservations } from '../lib/frontoffice/useFoStore';

export default function FrontofficeRoomGrid() {
  const [filterType, setFilterType] = React.useState<string>('all');
  const [search, setSearch] = React.useState('');
  const roomsAll = useFrontOfficeRooms();
  const roomTypes = useFrontOfficeRoomTypes();
  const reservations = useFrontOfficeReservations();

  const rooms = React.useMemo(() => {
    const q = search.toLowerCase();
    return roomsAll.filter(r => (filterType === 'all' || r.roomTypeId === filterType) && (!q || r.id.toLowerCase().includes(q)));
  }, [roomsAll, filterType, search]);

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader className="pb-2 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-ghana-black">Rooms</h3>
        <div className="flex gap-2">
          <Select size="sm" label="Room Type" selectedKeys={[filterType]} onSelectionChange={(k)=> setFilterType(Array.from(k as Set<string>)[0] || 'all')}>
            <SelectItem key="all">All</SelectItem>
            {roomTypes.map(rt => <SelectItem key={rt.id}>{rt.name}</SelectItem>)}
          </Select>
          <Input size="sm" label="Search by room" value={search} onChange={(e)=> setSearch(e.target.value)} />
        </div>
      </CardHeader>
      <CardBody>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {rooms.map(room => {
            const res = reservations.find(x => x.roomId === room.id && x.status === 'checked-in');
            const label = res ? `${res.guestName} (${res.arrival} → ${res.departure})` : 'Available';
            return (
              <Tooltip key={room.id} content={label} placement="top">
                <div className={`p-3 rounded-lg border ${res ? 'bg-green-500/20 border-green-500' : 'bg-white'} `}>
                  <div className="text-center">
                    <div className="font-bold text-ghana-black">{room.id}</div>
                    <div className="text-xs text-gray-600">{roomTypes.find(rt => rt.id === room.roomTypeId)?.name}</div>
                    <div className="mt-1 flex items-center justify-center gap-2">
                      <Badge size="sm" variant="flat" color="primary">{room.floor ? `Floor ${room.floor}` : '—'}</Badge>
                      <Badge size="sm" variant="flat" color={res ? 'success' : 'default'}>{res ? 'Occupied' : 'Vacant'}</Badge>
                    </div>
                  </div>
                </div>
              </Tooltip>
            );
          })}
        </div>
      </CardBody>
    </Card>
  );
}


