'use client';

import React from 'react';
import { Card, CardBody, CardHeader, Button, Select, SelectItem } from '@heroui/react';
import { frontOfficeStore } from '../lib/frontoffice/store';

function formatDate(d: Date) { return d.toISOString().slice(0,10); }

export default function FrontofficeCalendar() {
  const [tick, setTick] = React.useState(0);
  const [days, setDays] = React.useState<number>(14);
  const [roomTypeId, setRoomTypeId] = React.useState<string>('all');
  React.useEffect(()=>{ const unsub = frontOfficeStore.subscribe(()=> setTick(t=>t+1)); return ()=>unsub(); },[]);

  const start = new Date();
  start.setHours(0,0,0,0);
  const dates = Array.from({length: days}).map((_,i)=>{ const d=new Date(start); d.setDate(start.getDate()+i); return d;});

  const reservations = frontOfficeStore.reservations.filter(r => roomTypeId==='all' || r.roomTypeId===roomTypeId);

  const createQuick = (date: string) => {
    const guest = frontOfficeStore.createGuest({ name: 'Walk-in' } as any);
    const rt = roomTypeId==='all' ? frontOfficeStore.roomTypes[0].id : roomTypeId;
    frontOfficeStore.createReservation({ guestId: guest.id, guestName: 'Walk-in', roomTypeId: rt, arrival: date, departure: date, source: 'Direct' } as any);
  };

  return (
    <Card className="border-0 shadow-lg">
             <CardHeader className="pb-2 flex items-center justify-between">
         <h3 className="text-lg font-semibold text-ghana-black">Reservation Calendar (Next {days} days)</h3>
         <div className="flex gap-4">
           <Select size="md" label="Room Type" className="min-w-[180px]" selectedKeys={[roomTypeId]} onSelectionChange={(k)=> setRoomTypeId(Array.from(k as Set<string>)[0] || 'all')}>
            {[{ id: 'all', name: 'All Room Types' }, ...frontOfficeStore.roomTypes].map(rt => <SelectItem key={rt.id}>{rt.name}</SelectItem>)}
           </Select>
           <Select size="md" label="Date Range" className="min-w-[150px]" selectedKeys={[String(days)]} onSelectionChange={(k)=> setDays(Number(Array.from(k as Set<string>)[0] || 14))}>
             <SelectItem key="7">7 Days</SelectItem>
             <SelectItem key="14">14 Days</SelectItem>
             <SelectItem key="30">30 Days</SelectItem>
           </Select>
         </div>
       </CardHeader>
      <CardBody>
        <div className="overflow-x-auto">
          <div className="min-w-[800px]">
            <div className="grid" style={{gridTemplateColumns: `150px repeat(${dates.length}, 1fr)`}}>
              <div className="p-2 font-semibold text-ghana-black bg-gray-50 border">Room Type</div>
              {dates.map(d => (
                <div key={d.toISOString()} className="p-2 text-xs text-gray-600 bg-gray-50 border text-center">{d.toLocaleDateString()}</div>
              ))}
              {frontOfficeStore.roomTypes.filter(rt => roomTypeId==='all' || rt.id===roomTypeId).map(rt => (
                <React.Fragment key={rt.id}>
                  <div className="p-2 font-medium text-ghana-black bg-white border">{rt.name}</div>
                  {dates.map(d => {
                    const ds = formatDate(d);
                    const has = reservations.filter(r => r.roomTypeId===rt.id && r.arrival <= ds && r.departure >= ds);
                    return (
                      <div key={rt.id+ds} className="border p-1 text-[11px]">
                        {has.length === 0 ? (
                          <Button size="sm" variant="light" onClick={()=> createQuick(ds)}>+</Button>
                        ) : (
                          <div className="space-y-1">
                            {has.slice(0,3).map(r => (
                              <div key={r.id} title={`${r.guestName}\n${r.arrival} → ${r.departure}\n${r.isGuaranteed ? 'Guaranteed' : 'Pending'}`} className={`px-1 py-0.5 rounded truncate ${r.isGuaranteed ? 'bg-yellow-200 text-yellow-800' : 'bg-ghana-green/10 text-ghana-green'}`}>{r.guestName} ({r.status})</div>
                            ))}
                            {has.length>3 && <div className="text-[10px] text-gray-500">+{has.length-3} more</div>}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}


