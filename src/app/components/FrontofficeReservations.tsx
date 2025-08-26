'use client';

import React from 'react';
import { Card, CardBody, CardHeader, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, Button, Input, Select, SelectItem, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Chip, Textarea } from '@heroui/react';
import { frontOfficeStore } from '../lib/frontoffice/store';
import type { Reservation } from '../lib/frontoffice/types';

export default function FrontofficeReservations() {
  const [tick, setTick] = React.useState(0);
  const [search, setSearch] = React.useState('');
  const [isOpen, setOpen] = React.useState(false);
  const [guestName, setGuestName] = React.useState('');
  const [existingGuestId, setExistingGuestId] = React.useState<string>('');
  const [roomTypeId, setRoomTypeId] = React.useState('rt-standard');
  const [ratePlanId, setRatePlanId] = React.useState('rp-bar');
  const [arrival, setArrival] = React.useState<string>(new Date().toISOString().slice(0,10));
  const [departure, setDeparture] = React.useState<string>(new Date(Date.now()+86400000).toISOString().slice(0,10));
  const [adults, setAdults] = React.useState<string>('1');
  const [children, setChildren] = React.useState<string>('0');
  const [deposit, setDeposit] = React.useState<string>('0');
  const [depositMethod, setDepositMethod] = React.useState<'Cash'|'Card'|'Mobile Money'>('Cash');
  const [remarksToGuest, setRemarksToGuest] = React.useState('');
  const [internalNotes, setInternalNotes] = React.useState('');
  const [marketCodes, setMarketCodes] = React.useState<string[]>([]);
  const [nightlyRates, setNightlyRates] = React.useState<{ date: string; total: number }[]>([]);
  const [useCustomRates, setUseCustomRates] = React.useState(false);

  React.useEffect(() => { const unsub = frontOfficeStore.subscribe(() => setTick(t => t+1)); return () => unsub(); }, []);

  const rows = React.useMemo(() => {
    const q = search.toLowerCase();
    return frontOfficeStore.reservations.filter(r => !q || r.guestName.toLowerCase().includes(q) || r.id.toLowerCase().includes(q));
  }, [tick, search]);

  React.useEffect(() => {
    const calc = frontOfficeStore.calculateRateBreakdown(roomTypeId, arrival, departure);
    setNightlyRates(calc.map(n => ({ date: n.date, total: n.total })));
  }, [roomTypeId, arrival, departure]);

  const createReservation = () => {
    if (!guestName) return;
    const guest = existingGuestId ? frontOfficeStore.guests.find(g => g.id === existingGuestId)! : frontOfficeStore.createGuest({ name: guestName });
    const res = frontOfficeStore.createReservation({ guestId: guest.id, guestName, roomTypeId, ratePlanId, arrival, departure, source: 'Direct', adults: Number(adults||'0'), children: Number(children||'0'), remarksToGuest, internalNotes, marketCodes, isGuaranteed: Number(deposit||'0') > 0, rateBreakdown: nightlyRates.map(n => ({ date: n.date, base: n.total, total: n.total })) });
    if (Number(deposit||'0') > 0) {
      frontOfficeStore.addDeposit(res.id, Number(deposit||'0'), depositMethod);
    }
    setOpen(false); setGuestName('');
  };

  const ActionButtons = (r: Reservation) => (
    <div className="flex gap-2">
      <Button size="sm" variant="flat" className="bg-ghana-green text-white" onClick={() => frontOfficeStore.assignRoom(r.id, '101')}>Assign</Button>
      <Button size="sm" variant="flat" className="bg-blue-600 text-white" onClick={() => frontOfficeStore.checkIn(r.id)}>Check-in</Button>
      <Button size="sm" variant="flat" className="bg-gray-200" onClick={() => frontOfficeStore.cancelReservation(r.id)}>Cancel</Button>
    </div>
  );

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader className="pb-2 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-ghana-black">Reservations</h3>
        <div className="flex items-center gap-2">
          <Input size="sm" label="Search" value={search} onChange={(e)=> setSearch(e.target.value)} />
          <Button className="bg-ghana-green text-white" variant="flat" size="sm" onClick={()=> setOpen(true)}>New Reservation</Button>
        </div>
      </CardHeader>
      <CardBody>
        <Table aria-label="Reservations">
          <TableHeader>
            <TableColumn>Code</TableColumn>
            <TableColumn>Guest</TableColumn>
            <TableColumn>Room Type</TableColumn>
            <TableColumn>Rate</TableColumn>
            <TableColumn>Arrival</TableColumn>
            <TableColumn>Departure</TableColumn>
            <TableColumn>Status</TableColumn>
            <TableColumn>Actions</TableColumn>
          </TableHeader>
          <TableBody>
            {rows.map(r => (
              <TableRow key={r.id}>
                <TableCell>{r.id}</TableCell>
                <TableCell>{r.guestName}</TableCell>
                <TableCell>{frontOfficeStore.roomTypes.find(rt => rt.id === r.roomTypeId)?.name}</TableCell>
                <TableCell>₵{(frontOfficeStore.ratePlans.find(rp => rp.id === (r.ratePlanId || ''))?.price || frontOfficeStore.roomTypes.find(rt => rt.id === r.roomTypeId)?.baseRate || 0).toFixed(2)}</TableCell>
                <TableCell>{r.arrival}</TableCell>
                <TableCell>{r.departure}</TableCell>
                <TableCell>{r.status}</TableCell>
                <TableCell>{ActionButtons(r)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardBody>

      <Modal isOpen={isOpen} onClose={()=> setOpen(false)}>
        <ModalContent>
          <ModalHeader>New Reservation</ModalHeader>
          <ModalBody>
            <Input label="Guest Name" value={guestName} onChange={(e)=> { setGuestName(e.target.value); setExistingGuestId(''); }} />
            {frontOfficeStore.guests.length > 0 && (
              <Select label="Existing Guest (optional)" selectedKeys={[existingGuestId]} onSelectionChange={(k)=> { const id = Array.from(k as Set<string>)[0] || ''; setExistingGuestId(id); const g = frontOfficeStore.guests.find(x => x.id === id); if (g) setGuestName(g.name); }}>
                <SelectItem key="">—</SelectItem>
                {frontOfficeStore.guests.slice(0,100).map(g => <SelectItem key={g.id}>{g.name}</SelectItem>)}
              </Select>
            )}
            <div>
              <div className="flex items-center justify-between mb-1">
                <div className="text-xs text-gray-700 font-medium">Daily Rates</div>
                <Button size="sm" variant="light" onClick={()=> setUseCustomRates(v => !v)}>{useCustomRates ? 'Use Rule Rates' : 'Custom Rates'}</Button>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                {nightlyRates.map((n, idx) => (
                  <div key={n.date} className="border rounded p-2 flex items-center justify-between">
                    <span>{n.date}</span>
                    {useCustomRates ? (
                      <Input size="sm" type="number" value={String(n.total)} onChange={(e)=> setNightlyRates(prev => prev.map((x,i)=> i===idx ? { ...x, total: Number(e.target.value||0) } : x))} className="w-24" />
                    ) : (
                      <span>₵{n.total.toFixed(2)}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Select label="Room Type" selectedKeys={[roomTypeId]} onSelectionChange={(k)=> setRoomTypeId(Array.from(k as Set<string>)[0])}>
                {frontOfficeStore.roomTypes.map(rt => <SelectItem key={rt.id}>{rt.name}</SelectItem>)}
              </Select>
              <Select label="Rate Plan" selectedKeys={[ratePlanId]} onSelectionChange={(k)=> setRatePlanId(Array.from(k as Set<string>)[0])}>
                {frontOfficeStore.ratePlans.map(rp => <SelectItem key={rp.id}>{rp.name}</SelectItem>)}
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input type="date" label="Arrival" value={arrival} onChange={(e)=> setArrival(e.target.value)} />
              <Input type="date" label="Departure" value={departure} onChange={(e)=> setDeparture(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input type="number" label="Adults" value={adults} onChange={(e)=> setAdults(e.target.value)} />
              <Input type="number" label="Children" value={children} onChange={(e)=> setChildren(e.target.value)} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Input type="number" label="Deposit" value={deposit} onChange={(e)=> setDeposit(e.target.value)} />
              <Select label="Method" selectedKeys={[depositMethod]} onSelectionChange={(k)=> setDepositMethod(Array.from(k as Set<string>)[0] as any)}>
                <SelectItem key="Cash">Cash</SelectItem>
                <SelectItem key="Card">Card</SelectItem>
                <SelectItem key="Mobile Money">Mobile Money</SelectItem>
              </Select>
              <div className="flex items-center text-xs text-gray-600">{Number(deposit||'0')>0 ? <Chip color="success" variant="flat">Guaranteed</Chip> : <Chip color="warning" variant="flat">Pending</Chip>}</div>
            </div>
            <Select label="Market Codes" selectionMode="multiple" selectedKeys={new Set(marketCodes)} onSelectionChange={(k)=> setMarketCodes(Array.from(k as Set<string>))}>
              {frontOfficeStore.marketCodes.map(mc => <SelectItem key={mc}>{mc}</SelectItem>)}
            </Select>
            <Textarea label="Remarks to Guest" value={remarksToGuest} onChange={(e)=> setRemarksToGuest(e.target.value)} />
            <Textarea label="Internal Notes" value={internalNotes} onChange={(e)=> setInternalNotes(e.target.value)} />
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onClick={()=> setOpen(false)}>Cancel</Button>
            <Button className="bg-ghana-green text-white" variant="flat" onClick={createReservation}>Create</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Card>
  );
}


