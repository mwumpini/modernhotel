'use client';

import React from 'react';
import { Card, CardBody, CardHeader, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, Button, Input, Select, SelectItem } from '@heroui/react';
import { printReceipt } from '../lib/print/print';
import { frontOfficeStore } from '../lib/frontoffice/store';

export default function FrontofficeFolio({ reservationId }: { reservationId: string }) {
  const [tick, setTick] = React.useState(0);
  const [desc, setDesc] = React.useState('Room Night');
  const [amt, setAmt] = React.useState<string>('0');
  const [method, setMethod] = React.useState<'Cash'|'Card'|'Mobile Money'>('Cash');

  React.useEffect(()=>{ const unsub = frontOfficeStore.subscribe(()=> setTick(t=>t+1)); return ()=>unsub(); },[]);
  const folio = frontOfficeStore.getOrCreateFolio(reservationId);
  const subtotal = folio.charges.reduce((s,c)=> s + c.amount, 0);
  const tax = folio.charges.reduce((s,c)=> s + (c.tax||0), 0);
  const total = subtotal + tax;
  const paid = folio.payments.reduce((s,p)=> s + p.amount, 0);
  const balance = total - paid;

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader className="pb-2 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-ghana-black">Folio</h3>
        <div className="flex gap-2">
          <Input size="sm" label="Charge Description" value={desc} onChange={(e)=> setDesc(e.target.value)} />
          <Input size="sm" type="number" label="Amount" value={amt} onChange={(e)=> setAmt(e.target.value)} />
          <Button size="sm" className="bg-ghana-green text-white" variant="flat" onClick={()=> frontOfficeStore.addCharge(reservationId, desc, Number(amt)||0)}>Add Charge</Button>
        </div>
      </CardHeader>
      <CardBody>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <Table aria-label="Charges">
              <TableHeader>
                <TableColumn>Date</TableColumn>
                <TableColumn>Description</TableColumn>
                <TableColumn>Amount</TableColumn>
                <TableColumn>Tax</TableColumn>
              </TableHeader>
              <TableBody>
                {folio.charges.map(c => (
                  <TableRow key={c.id}>
                    <TableCell>{new Date(c.date).toLocaleString()}</TableCell>
                    <TableCell>{c.description}</TableCell>
                    <TableCell>₵{c.amount.toFixed(2)}</TableCell>
                    <TableCell>₵{(c.tax||0).toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div>
            <Table aria-label="Payments">
              <TableHeader>
                <TableColumn>Date</TableColumn>
                <TableColumn>Method</TableColumn>
                <TableColumn>Amount</TableColumn>
              </TableHeader>
              <TableBody>
                {folio.payments.map(p => (
                  <TableRow key={p.id}>
                    <TableCell>{new Date(p.date).toLocaleString()}</TableCell>
                    <TableCell>{p.method}</TableCell>
                    <TableCell>₵{p.amount.toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="mt-3 flex gap-2">
              <Select size="sm" selectedKeys={[method]} onSelectionChange={(k)=> setMethod(Array.from(k as Set<string>)[0] as any)}>
                <SelectItem key="Cash">Cash</SelectItem>
                <SelectItem key="Card">Card</SelectItem>
                <SelectItem key="Mobile Money">Mobile Money</SelectItem>
              </Select>
              <Input size="sm" label="Amount" type="number" value={amt} onChange={(e)=> setAmt(e.target.value)} />
              <Button size="sm" className="bg-blue-600 text-white" variant="flat" onClick={()=> frontOfficeStore.addPayment(reservationId, method, Number(amt)||0)}>Add Payment</Button>
            </div>
          </div>
        </div>
        <div className="mt-4 text-sm">
          <div>Subtotal: <strong>₵{subtotal.toFixed(2)}</strong></div>
          <div>Tax: <strong>₵{tax.toFixed(2)}</strong></div>
          <div>Total: <strong>₵{total.toFixed(2)}</strong></div>
          <div>Paid: <strong>₵{paid.toFixed(2)}</strong></div>
          <div>Balance: <strong>₵{balance.toFixed(2)}</strong></div>
          {/** show deposit info if exists **/}
          {(() => {
            const res = frontOfficeStore.reservations.find(r => r.id === reservationId);
            if (!res?.deposit) return null;
            return <div className="text-xs text-gray-600">Deposit: ₵{res.deposit.amount.toFixed(2)} via {res.deposit.method} on {new Date(res.deposit.date).toLocaleString()}</div>;
          })()}
        </div>
        <div className="mt-3 flex gap-2">
          <Button size="sm" className="bg-indigo-600 text-white" variant="flat" onClick={()=>{
            printReceipt({
              hotelName: 'Ghana Hotel',
              contact: 'Accra • +233',
              code: `INV-${reservationId}`,
              datetime: new Date().toLocaleString(),
              items: folio.charges.map(c=>({ name: c.description, qty: 1, price: c.amount+(c.tax||0) })),
              subtotal, discount: 0, total,
            });
          }}>Print Invoice</Button>
        </div>
      </CardBody>
    </Card>
  );
}


