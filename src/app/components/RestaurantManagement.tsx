'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardBody, CardHeader, Badge, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, Input, Select, SelectItem } from "@heroui/react";
import DashboardWrapper from './DashboardWrapper';
import FBPOS from './FBPOS';
import { ordersStore } from '../lib/fb/ordersStore';

export default function RestaurantManagement() {
  const [showPOS, setShowPOS] = useState(false);

  const stats = [
    { label: 'Today\'s Revenue', value: '₵1,850', change: '+15%', changeType: 'positive', icon: '💰' },
    { label: 'Active Orders', value: '12', change: '+3', changeType: 'positive', icon: '📋' },
    { label: 'Tables Occupied', value: '18/25', change: '+2', changeType: 'positive', icon: '🪑' },
    { label: 'Avg Order Time', value: '22 min', change: '-3 min', changeType: 'positive', icon: '⏱️' },
  ] as const;

  const quickActions = [
    { title: 'Open POS', icon: '🛒', color: 'bg-ghana-green', href: '#' },
    { title: 'Kitchen Display', icon: '👨‍🍳', color: 'bg-orange-500', href: '#' },
    { title: 'Menu Editor', icon: '🍽️', color: 'bg-blue-600', href: '#' },
    { title: 'Table Layout', icon: '🪑', color: 'bg-purple-600', href: '#' },
    { title: 'Staff Schedule', icon: '👥', color: 'bg-indigo-600', href: '#' },
    { title: 'Inventory Check', icon: '📦', color: 'bg-yellow-500', href: '#' },
  ] as const;

  const activeOrders = [
    { id: 'R001', table: 'T05', items: 'Jollof Rice, Grilled Chicken', status: 'preparing', time: '15 min', waiter: 'Ama' },
    { id: 'R002', table: 'T12', items: 'Banku & Tilapia', status: 'ready', time: 'Just now', waiter: 'Kwame' },
    { id: 'R003', table: 'T08', items: 'Waakye Pack, Beef Stew', status: 'urgent', time: '25 min', waiter: 'Efua' },
  ];

  const tableStatus = [
    { table: 'T01', status: 'occupied', guests: 4, time: '45 min', waiter: 'Ama' },
    { table: 'T02', status: 'reserved', guests: 0, time: '7:30 PM', waiter: '-' },
    { table: 'T03', status: 'available', guests: 0, time: '-', waiter: '-' },
    { table: 'T04', status: 'occupied', guests: 2, time: '20 min', waiter: 'Kwame' },
  ];

  // Filters for Table Status
  const [searchTables, setSearchTables] = useState('');
  const [filterWaiter, setFilterWaiter] = useState<string>('all');
  const [filterTable, setFilterTable] = useState('');
  const waiterOptions = useMemo(() => {
    const set = new Set<string>();
    tableStatus.forEach(t => { if (t.waiter && t.waiter !== '-') set.add(t.waiter); });
    return Array.from(set);
  }, [tableStatus]);

  const filteredTables = useMemo(() => {
    return tableStatus.filter(t => {
      const matchWaiter = filterWaiter === 'all' || t.waiter === filterWaiter;
      const matchTable = !filterTable || t.table.toLowerCase().includes(filterTable.toLowerCase());
      const q = searchTables.trim().toLowerCase();
      const matchSearch = !q || `${t.table} ${t.status} ${t.waiter}`.toLowerCase().includes(q);
      return matchWaiter && matchTable && matchSearch;
    });
  }, [tableStatus, filterWaiter, filterTable, searchTables]);

  // Transactions grid data (reactive to ordersStore). For demo, synthesize invoice/receipt/KOT rows.
  type Row = {
    code: string; // invoice/receipt/KOT id
    date: string;
    type: 'KOT' | 'BOT' | 'Invoice' | 'Receipt' | 'Bill';
    itemName: string;
    customerType: string;
    amount: number;
    discount: number;
    price: number;
    status: 'invoice' | 'receipt' | 'pending';
    customerName?: string;
    roomNo?: string;
    table: string;
    waiter: string;
  };

  const [rows, setRows] = useState<Row[]>([]);
  const [sortKey, setSortKey] = useState<keyof Row>('date');
  const [sortDesc, setSortDesc] = useState<boolean>(true);
  const [filterType, setFilterType] = useState<string>('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const build = () => {
      const orders = ordersStore.all();
      const out: Row[] = [];
      orders.forEach((o) => {
        // KOT/BOT
        out.push({
          code: `KOT-${o.id}`,
          date: o.createdAt || new Date().toISOString(),
          type: o.items.some(i => i.route === 'bar') ? 'BOT' : 'KOT',
          itemName: o.items.map(i => `${i.qty}x ${i.name}`).join(', '),
          customerType: o.customerType,
          amount: 0,
          discount: 0,
          price: o.items.reduce((s,i)=>s+(i.price-((i as any).discountPerUnit||0)+((i as any).serviceChargePerUnit||0))*i.qty,0),
          status: o.status === 'paid' ? 'receipt' : 'pending',
          customerName: '',
          roomNo: '',
          table: o.table,
          waiter: o.waiterId,
        });
        // If paid, add invoice+receipt demo rows
        if (o.status === 'paid') {
          const base = o.items.reduce((s,i)=>s+(i.price-((i as any).discountPerUnit||0)+((i as any).serviceChargePerUnit||0))*i.qty,0);
          out.push({
            code: `INV-${o.id}`,
            date: o.updatedAt || new Date().toISOString(),
            type: 'Invoice',
            itemName: '—',
            customerType: o.customerType,
            amount: base,
            discount: 0,
            price: base,
            status: 'invoice',
            table: o.table,
            waiter: o.waiterId,
          });
          out.push({
            code: `RCPT-${o.id}`,
            date: o.updatedAt || new Date().toISOString(),
            type: 'Receipt',
            itemName: '—',
            customerType: o.customerType,
            amount: base,
            discount: 0,
            price: base,
            status: 'receipt',
            table: o.table,
            waiter: o.waiterId,
          });
        }
      });
      setRows(out);
    };
    build();
    const unsub = ordersStore.subscribe(build);
    // Pulls in real persisted order history — build() re-runs via the subscribe
    // callback above once this resolves and notifies listeners.
    ordersStore.hydrateFromApi();
    return () => unsub();
  }, []);

  const filteredSorted = useMemo(() => {
    let data = rows;
    if (filterType !== 'all') {
      data = data.filter(r => r.type.toLowerCase() === filterType.toLowerCase());
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      data = data.filter(r =>
        r.code.toLowerCase().includes(q) ||
        r.itemName.toLowerCase().includes(q) ||
        r.table.toLowerCase().includes(q) ||
        r.waiter.toLowerCase().includes(q)
      );
    }
    const sorted = [...data].sort((a,b) => {
      const va = (a[sortKey] as any) ?? '';
      const vb = (b[sortKey] as any) ?? '';
      if (va < vb) return sortDesc ? 1 : -1;
      if (va > vb) return sortDesc ? -1 : 1;
      return 0;
    });
    return sorted;
  }, [rows, sortKey, sortDesc, filterType, search]);

  const onSort = (key: keyof Row) => {
    if (sortKey === key) setSortDesc(!sortDesc);
    else { setSortKey(key); setSortDesc(true); }
  };

  if (showPOS) {
    return <FBPOS onClose={() => setShowPOS(false)} />;
  }

  return (
    <DashboardWrapper
      title="Restaurant Management"
      subtitle="Kitchen operations, table management, and restaurant analytics"
      icon="🍽️"
      stats={stats as any}
      quickActions={quickActions as any}
    >
      <div className="space-y-6">
        {/* Transactions Table */}
        <Card className="border-0 shadow-lg">
          <CardHeader className="pb-2 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-ghana-black">📑 Transactions</h3>
            <div className="flex items-center gap-2">
              <Input size="sm" label="Search" value={search} onChange={(e) => setSearch(e.target.value)} />
              <Select size="sm" label="Filter" selectedKeys={[filterType]} onSelectionChange={(k)=> setFilterType(Array.from(k as Set<string>)[0] || 'all')}>
                <SelectItem key="all">All</SelectItem>
                <SelectItem key="KOT">KOT</SelectItem>
                <SelectItem key="BOT">BOT</SelectItem>
                <SelectItem key="Invoice">Invoice</SelectItem>
                <SelectItem key="Receipt">Receipt</SelectItem>
                <SelectItem key="Bill">Bill</SelectItem>
              </Select>
            </div>
          </CardHeader>
          <CardBody>
            <Table aria-label="Transactions table">
              <TableHeader>
                <TableColumn onClick={() => onSort('code')}>code/no.</TableColumn>
                <TableColumn onClick={() => onSort('date')}>date time</TableColumn>
                <TableColumn onClick={() => onSort('type')}>kot/bot</TableColumn>
                <TableColumn onClick={() => onSort('itemName')}>item name</TableColumn>
                <TableColumn onClick={() => onSort('customerType')}>customer type</TableColumn>
                <TableColumn onClick={() => onSort('amount')}>amount</TableColumn>
                <TableColumn onClick={() => onSort('discount')}>discount</TableColumn>
                <TableColumn onClick={() => onSort('price')}>price</TableColumn>
                <TableColumn onClick={() => onSort('status')}>status</TableColumn>
                <TableColumn>customer name</TableColumn>
                <TableColumn>room no.</TableColumn>
                <TableColumn onClick={() => onSort('table')}>table</TableColumn>
                <TableColumn onClick={() => onSort('waiter')}>waiter/ess</TableColumn>
              </TableHeader>
              <TableBody>
                {filteredSorted.map((r) => (
                  <TableRow key={`${r.code}-${r.date}`}>
                    <TableCell>{r.code}</TableCell>
                    <TableCell>{new Date(r.date).toLocaleString()}</TableCell>
                    <TableCell>{r.type}</TableCell>
                    <TableCell>{r.itemName}</TableCell>
                    <TableCell>{r.customerType}</TableCell>
                    <TableCell>₵{r.amount.toFixed(2)}</TableCell>
                    <TableCell>₵{r.discount.toFixed(2)}</TableCell>
                    <TableCell>₵{r.price.toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge size="sm" variant="flat" color={r.status === 'pending' ? 'warning' : r.status === 'invoice' ? 'primary' : 'success'}>{r.status}</Badge>
                    </TableCell>
                    <TableCell>{r.customerName || '-'}</TableCell>
                    <TableCell>{r.roomNo || '-'}</TableCell>
                    <TableCell>{r.table}</TableCell>
                    <TableCell>{r.waiter}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardBody>
        </Card>

        {/* Table Status only */}
        <Card className="border-0 shadow-lg">
          <CardHeader className="pb-2"><h3 className="text-lg font-semibold text-ghana-black">🪑 Table Status</h3></CardHeader>
          <CardBody>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
              <Input size="sm" label="Search" placeholder="Search table/status/waiter" value={searchTables} onChange={(e)=> setSearchTables(e.target.value)} />
              <Select size="sm" label="Filter Waiter" selectedKeys={[filterWaiter]} onSelectionChange={(k)=> setFilterWaiter(Array.from(k as Set<string>)[0] || 'all')}>
                {['all', ...waiterOptions].map(w => (<SelectItem key={w}>{w === 'all' ? 'All' : w}</SelectItem>))}
              </Select>
              <Input size="sm" label="Filter Table" placeholder="e.g., T12" value={filterTable} onChange={(e)=> setFilterTable(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
              {filteredTables.map((t) => (
                <div key={t.table} className={`p-2 rounded-lg border ${t.status === 'occupied' ? 'bg-green-50 border-green-200' : t.status === 'reserved' ? 'bg-yellow-50 border-yellow-200' : 'bg-gray-50 border-gray-200'}`}>
                  <div className="text-center">
                    <div className="text-sm font-bold text-ghana-black">{t.table}</div>
                    <Badge size="sm" variant="flat" color={t.status === 'occupied' ? 'success' : t.status === 'reserved' ? 'warning' : 'default'}>
                      {t.status}
                    </Badge>
                    <div className="text-xs text-gray-600 mt-1">
                      {t.guests > 0 ? `${t.guests} guests` : 'Empty'}
                    </div>
                    <div className="text-[10px] text-gray-500">{t.time}</div>
                    <div className="text-[10px] text-gray-500">{t.waiter}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      </div>
    </DashboardWrapper>
  );
}
