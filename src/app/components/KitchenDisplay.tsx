'use client';

import React from 'react';
import { Card, CardBody, Badge, Button, Chip } from '@heroui/react';
import { ordersStore, FBOrder } from '../lib/fb/ordersStore';

function useOrders() {
  const [orders, setOrders] = React.useState<FBOrder[]>(ordersStore.all());
  React.useEffect(() => {
    const id = setInterval(() => setOrders(ordersStore.all()), 1000);
    return () => clearInterval(id);
  }, []);
  return orders;
}

function since(ts?: string) {
  if (!ts) return '-';
  const ms = Date.now() - new Date(ts).getTime();
  const m = Math.floor(ms / 60000);
  return m <= 0 ? 'Just now' : `${m} min`;
}

export default function KitchenDisplay() {
  const orders = useOrders();
  const [station, setStation] = React.useState<'all' | 'kitchen' | 'grill' | 'cold' | 'bar'>('all');

  const isKitchen = (o: FBOrder) => o.items.some(i => i.route === 'kitchen');
  const isBar = (o: FBOrder) => o.items.some(i => i.route === 'bar');

  const filtered = orders.filter(o => {
    if (station === 'all') return isKitchen(o);
    if (station === 'bar') return isBar(o);
    return isKitchen(o); // future: map items->stations
  });

  const byStatus = (s: FBOrder['status']) => filtered.filter(o => o.status === s);

  const kpi = {
    active: filtered.length,
    urgent: filtered.filter(o => o.urgent).length,
    ready: byStatus('served').length,
    avgPrep: '16 min',
  };

  const Section = ({ title, color, children }: any) => (
    <div className="space-y-3">
      <h3 className={`text-lg font-semibold ${color}`}>{title}</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {children}
      </div>
    </div>
  );

  const CardOrder = (o: FBOrder, tone: 'red' | 'blue' | 'green') => {
    const normalClass = tone === 'red' ? 'bg-red-50 border-red-200' : tone === 'blue' ? 'bg-blue-50 border-blue-200' : 'bg-green-50 border-green-200';
    const urgentClass = 'bg-red-100 border-red-400 shadow-[0_0_0_3px_rgba(220,38,38,0.25)]';
    return (
    <div key={o.id} className={`p-4 rounded-lg border-2 ${o.urgent ? urgentClass : normalClass}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="font-mono text-sm text-gray-600">{o.table} • #{o.id}</div>
        <div className="flex items-center gap-2">
          {o.urgent && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-600 text-white animate-pulse">
              ⚡ urgent
            </span>
          )}
          <Badge size="sm" variant="flat" color={o.status === 'pending' ? 'warning' : o.status === 'served' ? 'success' : 'primary'}>{o.status}</Badge>
          <Chip size="sm" variant="flat">{since(o.createdAt)}</Chip>
        </div>
      </div>
      <div className="text-xs text-gray-500 mb-1">{o.notes ? `Notes: ${o.notes}` : ''}</div>
      <div className="space-y-1">
        {o.items.filter(i => i.route === 'kitchen').map((it, idx) => (
          <div key={idx} className="text-sm text-ghana-black">{it.qty}x {it.name}</div>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        {o.status !== 'sent' && (
          <Button size="sm" variant="flat" className="bg-blue-600 text-white" onClick={() => ordersStore.update({ ...o, status: 'sent' })}>Start Prep</Button>
        )}
        <Button size="sm" variant="flat" className="bg-green-600 text-white" onClick={() => ordersStore.update({ ...o, status: 'served' })}>Ready</Button>
      </div>
    </div>
  ); } 

  return (
    <div className="min-h-screen bg-[#0f172a] p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* KPI strip */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-[#111827] border-0 text-white"><CardBody><div className="flex items-center justify-between"><div><div className="text-xs text-gray-400">Active Orders</div><div className="text-2xl font-bold">{kpi.active}</div></div><span>📋</span></div></CardBody></Card>
          <Card className="bg-[#111827] border-0 text-white"><CardBody><div className="flex items-center justify-between"><div><div className="text-xs text-gray-400">Urgent Orders</div><div className="text-2xl font-bold">{kpi.urgent}</div></div><span>⚠️</span></div></CardBody></Card>
          <Card className="bg-[#111827] border-0 text-white"><CardBody><div className="flex items-center justify-between"><div><div className="text-xs text-gray-400">Ready to Serve</div><div className="text-2xl font-bold">{kpi.ready}</div></div><span>✅</span></div></CardBody></Card>
          <Card className="bg-[#111827] border-0 text-white"><CardBody><div className="flex items-center justify-between"><div><div className="text-xs text-gray-400">Avg Prep Time</div><div className="text-2xl font-bold">{kpi.avgPrep}</div></div><span>⏱️</span></div></CardBody></Card>
        </div>

        {/* Station filters */}
        <div className="flex flex-wrap gap-2">
          {['all','kitchen','bar'].map(s => (
            <Chip key={s} className={`${station===s?'bg-ghana-gold text-ghana-black':'bg-[#111827] text-white'}`} variant="flat" onClick={() => setStation(s as any)}>{s === 'all' ? 'All Stations' : s}</Chip>
          ))}
        </div>

        {/* Columns */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Section title="🆕 New Orders" color="text-red-400">
            {byStatus('pending').map(o => CardOrder(o, 'red'))}
          </Section>
          <Section title="🛠️ Preparing" color="text-blue-400">
            {byStatus('sent').map(o => CardOrder(o, 'blue'))}
          </Section>
          <Section title="✅ Ready to Serve" color="text-green-400">
            {byStatus('served').map(o => CardOrder(o, 'green'))}
          </Section>
        </div>
      </div>
    </div>
  );
}
