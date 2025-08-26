'use client';

import React from 'react';
import { Card, CardBody, CardHeader, Button, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell } from '@heroui/react';
import { frontOfficeStore } from '../lib/frontoffice/store';
import { journalStore, postRoomRevenue } from '../lib/accounting/journal';

export default function FrontofficeNightAudit() {
  const [tick, setTick] = React.useState(0);
  React.useEffect(()=>{ const u1 = frontOfficeStore.subscribe(()=> setTick(t=>t+1)); const u2 = journalStore.subscribe(()=> setTick(t=>t+1)); return ()=>{u1();u2();}; },[]);

  const todays = frontOfficeStore.reservations.filter(r => r.status === 'checked-in');

  const postNightly = () => {
    const today = new Date().toISOString().slice(0,10);
    todays.forEach(r => {
      const breakdownRate = r.rateBreakdown?.find(n => n.date === today)?.total;
      const fallback = frontOfficeStore.ratePlans.find(rp => rp.roomTypeId === r.roomTypeId)?.price || 0;
      const rate = typeof breakdownRate === 'number' ? breakdownRate : fallback;
      frontOfficeStore.addCharge(r.id, 'Room Night', rate);
    });
  };

  return (
    <Card className="border-0 shadow-lg">
             <CardHeader className="pb-2 flex items-center justify-between">
         <h3 className="text-lg font-semibold text-ghana-black">Night Audit</h3>
         <Button className="bg-ghana-green text-white" variant="flat" size="sm" onClick={postNightly}>Post Room Nights</Button>
       </CardHeader>
      <CardBody>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <h4 className="text-sm font-semibold text-ghana-black mb-2">Checked-in Reservations</h4>
            <Table aria-label="Checked-in">
              <TableHeader>
                <TableColumn>Reservation</TableColumn>
                <TableColumn>Guest</TableColumn>
                <TableColumn>Room Type</TableColumn>
              </TableHeader>
              <TableBody>
                {todays.map(r => (
                  <TableRow key={r.id}>
                    <TableCell>{r.id}</TableCell>
                    <TableCell>{r.guestName}</TableCell>
                    <TableCell>{frontOfficeStore.roomTypes.find(rt => rt.id === r.roomTypeId)?.name}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-ghana-black mb-2">Recent Journal Entries</h4>
            <Table aria-label="Journals">
              <TableHeader>
                <TableColumn>Date</TableColumn>
                <TableColumn>Memo</TableColumn>
                <TableColumn>Lines</TableColumn>
              </TableHeader>
              <TableBody>
                {journalStore.list().slice(0,10).map(j => (
                  <TableRow key={j.id}>
                    <TableCell>{new Date(j.date).toLocaleString()}</TableCell>
                    <TableCell>{j.memo}</TableCell>
                    <TableCell>{j.lines.map(l => `${l.account}:${l.debit?`D${l.debit}`:`C${l.credit}`}`).join(', ')}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}


