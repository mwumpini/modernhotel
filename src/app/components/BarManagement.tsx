'use client';

import React, { useState } from 'react';
import { Card, CardBody, CardHeader, Button, Badge, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, Progress } from "@heroui/react";
import DashboardWrapper from './DashboardWrapper';
import FBPOS from './FBPOS';
import { trackEvent } from '../lib/analytics/trackEvent';

export default function BarManagement() {
  const [showPOS, setShowPOS] = useState(false);

  const stats = [
    { label: 'Today\'s Revenue', value: '₵1,240', change: '+8%', changeType: 'positive', icon: '💰' },
    { label: 'Active Orders', value: '8', change: '+2', changeType: 'positive', icon: '🍷' },
    { label: 'Bar Stools', value: '12/15', change: '+1', changeType: 'positive', icon: '🪑' },
    { label: 'Avg Mix Time', value: '4 min', change: '-1 min', changeType: 'positive', icon: '⏱️' },
  ] as const;

  const quickActions = [
    { title: 'Open POS', icon: '🛒', color: 'bg-ghana-green', href: '#' },
    { title: 'Bar Display', icon: '🍷', color: 'bg-purple-600', href: '#' },
    { title: 'Drink Menu', icon: '🥃', color: 'bg-amber-600', href: '#' },
    { title: 'Inventory', icon: '📦', color: 'bg-blue-600', href: '#' },
    { title: 'Staff Schedule', icon: '👥', color: 'bg-indigo-600', href: '#' },
    { title: 'Stock Alerts', icon: '⚠️', color: 'bg-red-500', href: '#' },
  ] as const;

  const barOrders = [
    { id: 'B001', table: 'B03', items: '2x Club Beer, 1x Cocktail', status: 'mixing', time: '3 min', bartender: 'Yaw' },
    { id: 'B002', table: 'B08', items: 'Wine Selection, Whiskey', status: 'ready', time: 'Just now', bartender: 'Ama' },
    { id: 'B003', table: 'B12', items: 'Fresh Juice, Soft Drinks', status: 'preparing', time: '2 min', bartender: 'Kofi' },
  ];

  const drinkInventory = [
    { item: 'Club Beer', stock: 45, unit: 'bottles', status: 'good', reorder: 20 },
    { item: 'Whiskey', stock: 8, unit: 'bottles', status: 'low', reorder: 5 },
    { item: 'Wine (Red)', stock: 12, unit: 'bottles', status: 'good', reorder: 8 },
    { item: 'Gin', stock: 3, unit: 'bottles', status: 'critical', reorder: 10 },
  ];

  const barStaff = [
    { name: 'Yaw', status: 'active', orders: 15, efficiency: 'excellent' },
    { name: 'Ama', status: 'active', orders: 12, efficiency: 'good' },
    { name: 'Kofi', status: 'break', orders: 8, efficiency: 'good' },
  ];

  if (showPOS) {
    return <FBPOS onClose={() => setShowPOS(false)} />;
  }

  return (
    <DashboardWrapper
      title="Bar Management"
      subtitle="Drink orders, inventory management, and bar operations"
      icon="🍷"
      stats={stats as any}
      quickActions={quickActions as any}
    >
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6">
          <Card className="border-0 shadow-lg">
            <CardHeader className="pb-2 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-ghana-black">🍷 Active Bar Orders</h3>
              <Button size="sm" variant="flat" className="bg-purple-600 text-white" onClick={() => trackEvent('Analytics.ActionClicked', { action: 'View Bar Display' }, { sourceModule: 'Bar' })}>Bar Display</Button>
            </CardHeader>
            <CardBody>
              <Table aria-label="Bar orders">
                <TableHeader>
                  <TableColumn>Order</TableColumn>
                  <TableColumn>Table</TableColumn>
                  <TableColumn>Items</TableColumn>
                  <TableColumn>Status</TableColumn>
                  <TableColumn>Time</TableColumn>
                  <TableColumn>Bartender</TableColumn>
                </TableHeader>
                <TableBody>
                  {barOrders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell>{order.id}</TableCell>
                      <TableCell>{order.table}</TableCell>
                      <TableCell>{order.items}</TableCell>
                      <TableCell>
                        <Badge size="sm" variant="flat" color={order.status === 'mixing' ? 'secondary' : order.status === 'ready' ? 'success' : 'warning'}>
                          {order.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{order.time}</TableCell>
                      <TableCell>{order.bartender}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardBody>
          </Card>

          <Card className="border-0 shadow-lg">
            <CardHeader className="pb-2"><h3 className="text-lg font-semibold text-ghana-black">📦 Drink Inventory</h3></CardHeader>
            <CardBody>
              <Table aria-label="Drink inventory">
                <TableHeader>
                  <TableColumn>Item</TableColumn>
                  <TableColumn>Stock</TableColumn>
                  <TableColumn>Status</TableColumn>
                  <TableColumn>Reorder Level</TableColumn>
                  <TableColumn>Action</TableColumn>
                </TableHeader>
                <TableBody>
                  {drinkInventory.map((item) => (
                    <TableRow key={item.item}>
                      <TableCell>{item.item}</TableCell>
                      <TableCell>{item.stock} {item.unit}</TableCell>
                      <TableCell>
                        <Badge size="sm" variant="flat" color={item.status === 'critical' ? 'danger' : item.status === 'low' ? 'warning' : 'success'}>
                          {item.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{item.reorder}</TableCell>
                      <TableCell>
                        <Button size="sm" variant="flat" className="bg-blue-600 text-white" onClick={() => trackEvent('Analytics.ActionClicked', { action: 'Reorder Drink', item: item.item }, { sourceModule: 'Bar' })}>
                          Reorder
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardBody>
          </Card>
        </div>
        {/* Right column removed as requested */}
      </div>
    </DashboardWrapper>
  );
}
