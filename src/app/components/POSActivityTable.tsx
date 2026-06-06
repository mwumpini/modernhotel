'use client';

import React from 'react';
import { Card, CardBody, CardHeader, Button, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, Input, Select, SelectItem, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from '@heroui/react';
import { ordersStore, FBOrder } from '../lib/fb/ordersStore';
import { logAudit } from '../lib/analytics/auditLogStore';
import { previewReceipt } from '../lib/print/print';

interface PosRow {
  id: string;
  itemCode: string;
  itemName: string;
  category: string;
  status: string;
  customerName: string;
  room: string;
  table: string;
  venue: string;
  qty: number;
  amount: number;
  discount: number;
  price: number;
  waiter: string;
  createdAt?: string;
}

function mapOrdersToRows(orders: FBOrder[]): PosRow[] {
  const rows: PosRow[] = [];
  for (const order of orders) {
    for (const item of order.items) {
      const unitPrice = item.price ?? 0;
      const qty = item.qty ?? 0;
      const discountPerUnit = item.discountPerUnit ?? 0;
      const discountTotal = discountPerUnit * qty;
      const amount = unitPrice * qty - discountTotal;
      rows.push({
        id: `${order.id}-${item.id}`,
        itemCode: item.id,
        itemName: item.name,
        category: item.route || '-',
        status: item.status || 'pending',
        customerName: order.guestName || order.tabName || '-',
        room: order.roomNumber || '-',
        table: order.table || '-',
        venue: order.venue,
        qty,
        amount,
        discount: discountTotal,
        price: unitPrice,
        waiter: item.assignedToName || order.waiterId || '-',
        createdAt: order.createdAt,
      });
    }
  }
  // newest first by createdAt if available
  rows.sort((a, b) => {
    const at = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bt = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return bt - at;
  });
  return rows;
}

export default function POSActivityTable() {
  const [rows, setRows] = React.useState<PosRow[]>(() => mapOrdersToRows(ordersStore.all()));
  const [query, setQuery] = React.useState('');
  const [venue, setVenue] = React.useState<string>('');
  const [waiter, setWaiter] = React.useState<string>('');
  const [from, setFrom] = React.useState<string>('');
  const [to, setTo] = React.useState<string>('');
  const [selected, setSelected] = React.useState<PosRow | null>(null);
  const [editQty, setEditQty] = React.useState<number>(0);
  const [editTable, setEditTable] = React.useState<string>('');
  const [editVenue, setEditVenue] = React.useState<string>('');
  const [editWaiter, setEditWaiter] = React.useState<string>('');
  const [notice, setNotice] = React.useState<{ color: 'success' | 'warning' | 'danger'; message: string } | null>(null);

  React.useEffect(() => {
    const sync = () => setRows(mapOrdersToRows(ordersStore.all()));
    sync();
    return ordersStore.subscribe(sync);
  }, []);

  const waiterOptions = React.useMemo(() => {
    const set = new Set<string>();
    ordersStore.all().forEach(o => {
      if (o.waiterId) set.add(o.waiterId);
      o.items.forEach(i => { if (i.assignedToName) set.add(i.assignedToName); });
    });
    try {
      if (typeof window !== 'undefined') {
        const stored = JSON.parse(localStorage.getItem('pos.waiters') || '[]');
        for (const w of stored) set.add(String(w));
      }
    } catch {}
    return Array.from(set).filter(Boolean).sort();
  }, [rows]);

  const columns = React.useMemo(
    () => [
      { key: 'id', label: 'ID' },
      { key: 'time', label: 'DATE/TIME' },
      { key: 'itemCode', label: 'ITEM CODE' },
      { key: 'itemName', label: 'ITEM NAME' },
      { key: 'category', label: 'CATEGORY' },
      { key: 'status', label: 'STATUS' },
      { key: 'customerName', label: 'CUSTOMER NAME' },
      { key: 'room', label: 'ROOM' },
      { key: 'table', label: 'TABLE' },
      { key: 'venue', label: 'VENUE' },
      { key: 'qty', label: 'QTY' },
      { key: 'amount', label: 'AMOUNT' },
      { key: 'discount', label: 'DISCOUNT' },
      { key: 'price', label: 'PRICE' },
      { key: 'waiter', label: 'WAITER/ESS' },
    ],
    []
  );

  const filtered = React.useMemo(() => {
    return rows.filter(r => {
      const byText = !query || `${r.itemCode} ${r.itemName} ${r.customerName} ${r.table} ${r.venue} ${r.waiter}`.toLowerCase().includes(query.toLowerCase());
      const byVenue = !venue || r.venue === venue;
      const byWaiter = !waiter || (r.waiter || '').toLowerCase().includes(waiter.toLowerCase());
      const t = r.createdAt ? new Date(r.createdAt).getTime() : undefined;
      const byFrom = !from || (t !== undefined && t >= new Date(from).getTime());
      const byTo = !to || (t !== undefined && t <= new Date(to + 'T23:59:59').getTime());
      return byText && byVenue && byWaiter && byFrom && byTo;
    });
  }, [rows, query, venue, waiter, from, to]);

  const exportCsv = () => {
    const header = ['ID','DATE/TIME','ITEM CODE','ITEM NAME','CATEGORY','STATUS','CUSTOMER NAME','ROOM','TABLE','VENUE','QTY','AMOUNT','DISCOUNT','PRICE','WAITER/ESS'];
    const lines = filtered.map(r => [r.id, (r.createdAt ? new Date(r.createdAt).toLocaleString() : '-'), r.itemCode, r.itemName, r.category, r.status, r.customerName, r.room, r.table, r.venue, r.qty, r.amount.toFixed(2), r.discount.toFixed(2), r.price.toFixed(2), r.waiter].map(v => `"${String(v).replace(/"/g,'""')}"`).join(','));
    const body = [header.join(','), ...lines].join('\n');
    const blob = new Blob([body], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pos-activity-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleRowAction = (row: PosRow, action: 'edit' | 'cancel' | 'receipt' | 'change-order') => {
    if (action === 'receipt') {
      previewReceipt({
        hotelName: 'Ghana Hotel',
        code: row.id,
        datetime: new Date().toLocaleString(),
        items: [{ name: row.itemName, qty: row.qty, price: row.price }],
        subtotal: row.qty * row.price,
        discount: row.discount,
        total: row.amount,
        table: row.table,
        waiter: row.waiter,
      });
      logAudit({ area: 'f&b', action: 'print', entity: 'Receipt', entityId: row.id, details: `Printed receipt for ${row.itemName}`, meta: { table: row.table, waiter: row.waiter }});
      return;
    }
    // For edit/cancel/change-order, open modal and seed fields
    setSelected(row);
    setEditQty(row.qty);
    setEditTable(row.table || '');
    setEditVenue(row.venue || '');
    setEditWaiter(row.waiter || '');
  };

  const confirmEdit = () => {
    if (!selected) return;
    if (editQty <= 0) {
      setNotice({ color: 'warning', message: 'Quantity must be greater than 0.' });
      setTimeout(() => setNotice(null), 2500);
      return;
    }
    const [orderId, itemId] = selected.id.split('-');
    ordersStore.updateItem(orderId, itemId, { qty: editQty });
    // also allow table/venue update on order
    if (editTable !== selected.table || editVenue !== selected.venue) {
      ordersStore.updateOrder(orderId, { table: editTable || selected.table, venue: (editVenue || selected.venue) as any });
    }
    if (editWaiter && editWaiter !== selected.waiter) {
      ordersStore.updateOrder(orderId, { waiterId: editWaiter });
      try {
        const existing = JSON.parse(localStorage.getItem('pos.waiters') || '[]');
        const next = Array.from(new Set([editWaiter, ...existing])).slice(0, 20);
        localStorage.setItem('pos.waiters', JSON.stringify(next));
      } catch {}
    }
    logAudit({ area: 'f&b', action: 'update', entity: 'OrderItem', entityId: selected.id, details: `Edited qty to ${editQty}`, meta: { table: editTable || selected.table, waiter: selected.waiter, venue: editVenue || selected.venue }});
    setNotice({ color: 'success', message: 'Item updated successfully.' });
    setTimeout(() => setNotice(null), 2000);
    setSelected(null);
  };

  const confirmCancel = () => {
    if (!selected) return;
    const [orderId, itemId] = selected.id.split('-');
    ordersStore.removeItem(orderId, itemId);
    logAudit({ area: 'f&b', action: 'delete', entity: 'OrderItem', entityId: selected.id, details: `Cancelled ${selected.itemName}`, meta: { table: selected.table, waiter: selected.waiter }});
    setNotice({ color: 'success', message: 'Item cancelled.' });
    setTimeout(() => setNotice(null), 2000);
    setSelected(null);
  };

  const confirmChangeOrder = () => {
    if (!selected) return;
    const [orderId, itemId] = selected.id.split('-');
    // Change order: move to new table/venue
    ordersStore.updateOrder(orderId, { table: editTable || selected.table, venue: (editVenue || selected.venue) as any });
    logAudit({ area: 'f&b', action: 'status', entity: 'Order', entityId: orderId, details: `Changed order to table ${editTable || selected.table}, venue ${editVenue || selected.venue}`, meta: { fromTable: selected.table, fromVenue: selected.venue }});
    if (editWaiter && editWaiter !== selected.waiter) {
      ordersStore.updateOrder(orderId, { waiterId: editWaiter });
      try {
        const existing = JSON.parse(localStorage.getItem('pos.waiters') || '[]');
        const next = Array.from(new Set([editWaiter, ...existing])).slice(0, 20);
        localStorage.setItem('pos.waiters', JSON.stringify(next));
      } catch {}
    }
    setNotice({ color: 'success', message: 'Order updated.' });
    setTimeout(() => setNotice(null), 2000);
    setSelected(null);
  };

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between w-full">
          <h3 className="text-xl font-semibold text-ghana-black">POS Activity Table</h3>
          <div>
            <Button size="sm" variant="flat" className="mr-2" onClick={exportCsv}>Export CSV</Button>
            <Button size="sm" variant="flat" onClick={() => setRows(mapOrdersToRows(ordersStore.all()))}>Show All</Button>
          </div>
        </div>
      </CardHeader>
      <CardBody>
        {notice && (
          <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-white ${notice.color === 'success' ? 'bg-green-600' : notice.color === 'warning' ? 'bg-yellow-600' : 'bg-red-600'}`}>
            {notice.message}
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-4">
          <Input size="sm" label="Search" value={query} onChange={(e) => setQuery(e.target.value)} />
          <Select size="sm" label="Venue" selectedKeys={[venue]} onSelectionChange={(k) => setVenue(Array.from(k as Set<string>)[0] || '')}>
            <SelectItem key="">All</SelectItem>
            <SelectItem key="Restaurant">Restaurant</SelectItem>
            <SelectItem key="Bar">Bar</SelectItem>
          </Select>
          <Select size="sm" label="Waiter" selectedKeys={[waiter]} onSelectionChange={(k) => setWaiter(Array.from(k as Set<string>)[0] || '')}>
            {['', ...waiterOptions].map(w => (
              <SelectItem key={w}>{w || 'All'}</SelectItem>
            ))}
          </Select>
          <Input size="sm" type="date" label="From" value={from} onChange={(e) => setFrom(e.target.value)} />
          <Input size="sm" type="date" label="To" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <Table aria-label="POS Activity Table" selectionMode="none">
          <TableHeader columns={columns}>
            {(column) => <TableColumn key={column.key}>{column.label}</TableColumn>}
          </TableHeader>
          <TableBody items={filtered} emptyContent="No POS activity found.">
            {(item) => (
              <TableRow key={item.id} onDoubleClick={() => handleRowAction(item, 'edit')}>
                {(columnKey) => {
                  const key = String(columnKey) as keyof PosRow;
                  let value: any = item[key];
                  if ((key as string) === 'time') {
                    value = item.createdAt ? new Date(item.createdAt).toLocaleString() : '-';
                  }
                  if (key === 'amount' || key === 'discount' || key === 'price') {
                    value = `₵${Number(value || 0).toFixed(2)}`;
                  }
                  return <TableCell>{String(value ?? '-')}</TableCell>;
                }}
              </TableRow>
            )}
          </TableBody>
        </Table>

        <Modal isOpen={!!selected} onClose={() => setSelected(null)}>
          <ModalContent>
            <ModalHeader>POS Item Actions</ModalHeader>
            <ModalBody>
              <div className="text-sm text-gray-700">
                {selected ? (
                  <div className="space-y-3">
                    <div><strong>Item:</strong> {selected.itemName}</div>
                    <div className="grid grid-cols-3 gap-2">
                      <Input size="sm" type="number" label="Qty" value={String(editQty)} onChange={(e) => setEditQty(Math.max(0, Number(e.target.value || 0)))} />
                      <Input size="sm" label="Table" value={editTable} onChange={(e) => setEditTable(e.target.value)} />
                      <Select size="sm" label="Venue" selectedKeys={[editVenue]} onSelectionChange={(k) => setEditVenue(Array.from(k as Set<string>)[0] || '')}>
                        <SelectItem key="Restaurant">Restaurant</SelectItem>
                        <SelectItem key="Bar">Bar</SelectItem>
                      </Select>
                    </div>
                    <div>
                      <Select size="sm" label="Waiter" selectedKeys={[editWaiter]} onSelectionChange={(k) => setEditWaiter(Array.from(k as Set<string>)[0] || '')}>
                        {waiterOptions.map(w => (<SelectItem key={w}>{w}</SelectItem>))}
                      </Select>
                    </div>
                    <div className="text-xs text-gray-500">Original: Qty {selected.qty}, Table {selected.table}, Venue {selected.venue}</div>
                  </div>
                ) : null}
              </div>
            </ModalBody>
            <ModalFooter>
              <Button variant="light" onClick={() => setSelected(null)}>Close</Button>
              {selected && (
                <>
                  <Button color="primary" onClick={() => handleRowAction(selected, 'receipt')}>Receipt</Button>
                  <Button color="warning" variant="flat" onClick={confirmChangeOrder}>Change Order</Button>
                  <Button color="secondary" variant="flat" onClick={confirmEdit}>Edit</Button>
                  <Button color="danger" onClick={confirmCancel}>Cancel</Button>
                </>
              )}
            </ModalFooter>
          </ModalContent>
        </Modal>
      </CardBody>
    </Card>
  );
}


