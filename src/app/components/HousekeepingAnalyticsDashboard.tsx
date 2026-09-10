'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardBody, CardHeader, Tabs, Tab, Button, Progress, Chip, Badge, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell } from "@heroui/react";
import { housekeepingStore } from '../lib/housekeeping/store';
import { HousekeepingTask, MaintenanceRequest, HousekeepingStaff } from '../lib/housekeeping/types';

export default function HousekeepingAnalyticsDashboard() {
  const [selectedTab, setSelectedTab] = useState('overview');
  const [, setTick] = useState(0);

  // Real data — hydrated from the DB on mount, same store as the main
  // Housekeeping dashboard. Previously this component read from four separate,
  // entirely fake in-memory zustand stores that never matched what the main
  // dashboard showed.
  useEffect(() => {
    const unsubscribe = housekeepingStore.subscribe(() => setTick((t) => t + 1));
    housekeepingStore.hydrateFromApi();
    return unsubscribe;
  }, []);

  const rooms = housekeepingStore.getAllRooms();
  const tasks: HousekeepingTask[] = housekeepingStore.getAllTasks();
  const staff: HousekeepingStaff[] = housekeepingStore.getAllStaff();
  const maintenanceRequests: MaintenanceRequest[] = housekeepingStore.getAllMaintenanceRequests();
  const stats = housekeepingStore.getDailyStats();

  const formatCurrency = (amount: number) => new Intl.NumberFormat('en-GH', { style: 'currency', currency: 'GHS' }).format(amount);
  const formatPercentage = (value: number) => `${value.toFixed(1)}%`;

  // Room status breakdown
  const roomStatusReport = useMemo(() => {
    const total = Math.max(rooms.length, 1);
    const counts: Record<string, number> = {};
    rooms.forEach((r) => { counts[r.status] = (counts[r.status] || 0) + 1; });
    return Object.entries(counts).map(([status, count]) => ({ status, count, percentage: (count / total) * 100 }));
  }, [rooms]);

  const getRoomStatusColor = (status: string) => {
    switch (status) {
      case 'clean': return 'success';
      case 'occupied': return 'primary';
      case 'dirty': return 'warning';
      case 'maintenance': return 'danger';
      case 'out-of-order': return 'danger';
      default: return 'default';
    }
  };

  // Task completion metrics
  const completedTasks = tasks.filter((t) => t.status === 'completed');
  const pendingTasks = tasks.filter((t) => t.status === 'pending');
  const inProgressTasks = tasks.filter((t) => t.status === 'in-progress');
  const taskCompletionRate = tasks.length > 0 ? (completedTasks.length / tasks.length) * 100 : 0;
  const avgTaskTime = stats.averageTaskTime;

  const cleaningEfficiencyMetrics = [
    { metric: 'Tasks Completed Today', value: stats.tasksCompleted, target: Math.max(tasks.length, 1), status: taskCompletionRate >= 80 ? 'good' : taskCompletionRate >= 50 ? 'warning' : 'critical' },
    { metric: 'Avg Task Time (min)', value: avgTaskTime, target: 30, status: avgTaskTime > 0 && avgTaskTime <= 30 ? 'good' : avgTaskTime <= 45 ? 'warning' : 'critical' },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'good': return 'success';
      case 'warning': return 'warning';
      case 'critical': return 'danger';
      default: return 'default';
    }
  };

  // Staff performance — real fields only. "Quality score" isn't tracked
  // anywhere (no inspection-to-staff linkage exists yet), so it's omitted
  // rather than fabricated.
  const staffPerformance = staff.map((s) => ({
    staffId: s.id,
    name: s.name,
    role: s.role,
    tasksCompleted: s.completedToday,
    dailyTarget: s.dailyTarget,
    efficiency: s.efficiency,
    active: s.active,
  }));

  // Maintenance cost by category — real, from actualCost (falls back to
  // estimatedCost if the work isn't complete yet), summed per category.
  const maintenanceCostReport = useMemo(() => {
    const byCategory = new Map<string, { cost: number; count: number }>();
    let totalCost = 0;
    maintenanceRequests.forEach((r) => {
      const cost = r.actualCost ?? r.estimatedCost ?? 0;
      totalCost += cost;
      const existing = byCategory.get(r.category) || { cost: 0, count: 0 };
      byCategory.set(r.category, { cost: existing.cost + cost, count: existing.count + 1 });
    });
    return Array.from(byCategory.entries()).map(([category, { cost, count }]) => ({
      category, cost, count, percentage: totalCost > 0 ? (cost / totalCost) * 100 : 0,
    }));
  }, [maintenanceRequests]);

  const totalMaintenanceCost = maintenanceCostReport.reduce((sum, c) => sum + c.cost, 0);
  const completedMaintenance = maintenanceRequests.filter((r) => r.status === 'completed' || r.status === 'verified');
  const maintenanceCompletionRate = maintenanceRequests.length > 0 ? (completedMaintenance.length / maintenanceRequests.length) * 100 : 0;
  const avgResolutionHours = useMemo(() => {
    const resolved = completedMaintenance.filter((r) => r.completedAt);
    if (resolved.length === 0) return 0;
    const totalHours = resolved.reduce((sum, r) => {
      const start = new Date(r.reportedAt).getTime();
      const end = new Date(r.completedAt!).getTime();
      return sum + Math.max(0, (end - start) / (1000 * 60 * 60));
    }, 0);
    return totalHours / resolved.length;
  }, [completedMaintenance]);

  const overdueOpenRequests = maintenanceRequests.filter((r) => r.status === 'reported' || r.status === 'assigned').length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ghana-black">🛏️ Housekeeping Analytics Dashboard</h1>
          <p className="text-gray-600">Real-time insights from actual housekeeping records</p>
        </div>
      </div>

      {/* Key Metrics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardBody className="text-center">
            <div className="text-2xl font-bold text-blue-600">{rooms.length}</div>
            <div className="text-sm text-gray-600">Total Rooms</div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="text-center">
            <div className="text-2xl font-bold text-green-600">{formatPercentage(taskCompletionRate)}</div>
            <div className="text-sm text-gray-600">Task Completion Rate</div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="text-center">
            <div className="text-2xl font-bold text-orange-600">{pendingTasks.length + inProgressTasks.length}</div>
            <div className="text-sm text-gray-600">Active Tasks</div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="text-center">
            <div className="text-2xl font-bold text-purple-600">{formatCurrency(totalMaintenanceCost)}</div>
            <div className="text-sm text-gray-600">Maintenance Cost</div>
          </CardBody>
        </Card>
      </div>

      <Tabs
        selectedKey={selectedTab}
        onSelectionChange={(key) => setSelectedTab(key as string)}
        className="w-full"
      >
        <Tab key="overview" title="📊 Overview">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <h3 className="text-lg font-semibold">Room Status Overview</h3>
              </CardHeader>
              <CardBody>
                {roomStatusReport.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">No rooms configured yet.</p>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    {roomStatusReport.map((status) => (
                      <div key={status.status} className="text-center">
                        <div className={`text-2xl font-bold text-${getRoomStatusColor(status.status)}-600`}>
                          {status.count}
                        </div>
                        <div className="text-sm text-gray-600 capitalize">{status.status}</div>
                        <div className="text-xs text-gray-500">{formatPercentage(status.percentage)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHeader>
                <h3 className="text-lg font-semibold">Cleaning Efficiency Metrics</h3>
              </CardHeader>
              <CardBody>
                <div className="space-y-4">
                  {cleaningEfficiencyMetrics.map((metric) => (
                    <div key={metric.metric} className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex justify-between mb-1">
                          <span className="text-sm font-medium">{metric.metric}</span>
                          <span className="text-sm text-gray-600">{metric.value} / {metric.target}</span>
                        </div>
                        <Progress value={Math.min(100, (metric.value / metric.target) * 100)} color={getStatusColor(metric.status)} className="w-full" />
                      </div>
                      <Chip color={getStatusColor(metric.status)} className="ml-4">{metric.status}</Chip>
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardHeader>
                <h3 className="text-lg font-semibold">Alerts & Notifications</h3>
              </CardHeader>
              <CardBody>
                <div className="space-y-4">
                  {pendingTasks.length > 0 && (
                    <div className="flex items-center gap-2 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                      <Badge color="warning">{pendingTasks.length}</Badge>
                      <span className="text-orange-700">Pending cleaning tasks not yet started</span>
                    </div>
                  )}
                  {overdueOpenRequests > 0 && (
                    <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                      <Badge color="danger">{overdueOpenRequests}</Badge>
                      <span className="text-red-700">Maintenance requests awaiting assignment</span>
                    </div>
                  )}
                  {pendingTasks.length === 0 && overdueOpenRequests === 0 && (
                    <p className="text-sm text-gray-500">No active alerts.</p>
                  )}
                </div>
              </CardBody>
            </Card>
          </div>
        </Tab>

        <Tab key="operations" title="⚙️ Operations">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <h3 className="text-lg font-semibold">Staff Performance</h3>
              </CardHeader>
              <CardBody>
                <div className="max-h-[480px] overflow-y-auto">
                  <Table aria-label="Staff Performance Table">
                    <TableHeader>
                      <TableColumn>Staff ID</TableColumn>
                      <TableColumn>Name</TableColumn>
                      <TableColumn>Role</TableColumn>
                      <TableColumn>Completed Today</TableColumn>
                      <TableColumn>Daily Target</TableColumn>
                      <TableColumn>Efficiency</TableColumn>
                    </TableHeader>
                    <TableBody emptyContent="No staff on file yet.">
                      {staffPerformance.map((s) => (
                        <TableRow key={s.staffId}>
                          <TableCell>{s.staffId}</TableCell>
                          <TableCell>{s.name}</TableCell>
                          <TableCell className="capitalize">{s.role}</TableCell>
                          <TableCell>{s.tasksCompleted}</TableCell>
                          <TableCell>{s.dailyTarget}</TableCell>
                          <TableCell>
                            <Chip color={s.efficiency >= 90 ? 'success' : s.efficiency >= 75 ? 'warning' : 'danger'}>
                              {formatPercentage(s.efficiency)}
                            </Chip>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardHeader>
                <h3 className="text-lg font-semibold">Supply Inventory Status</h3>
              </CardHeader>
              <CardBody>
                <p className="text-sm text-gray-500 text-center py-4">
                  Cleaning-supplies inventory isn't tracked yet — that's a separate, larger fix (no data model exists for it today).
                </p>
              </CardBody>
            </Card>
          </div>
        </Tab>

        <Tab key="maintenance" title="🔧 Maintenance">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <h3 className="text-lg font-semibold">Maintenance Costs by Category</h3>
              </CardHeader>
              <CardBody>
                <Table aria-label="Maintenance Costs Table">
                  <TableHeader>
                    <TableColumn>Category</TableColumn>
                    <TableColumn>Cost</TableColumn>
                    <TableColumn>Count</TableColumn>
                    <TableColumn>Percentage</TableColumn>
                  </TableHeader>
                  <TableBody emptyContent="No maintenance requests yet.">
                    {maintenanceCostReport.map((category) => (
                      <TableRow key={category.category}>
                        <TableCell className="capitalize">{category.category}</TableCell>
                        <TableCell>{formatCurrency(category.cost)}</TableCell>
                        <TableCell>{category.count}</TableCell>
                        <TableCell>{formatPercentage(category.percentage)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardBody>
            </Card>

            <Card>
              <CardHeader>
                <h3 className="text-lg font-semibold">Work Order Efficiency</h3>
              </CardHeader>
              <CardBody>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">{avgResolutionHours.toFixed(1)}</div>
                    <div className="text-sm text-gray-600">Avg Resolution Time (hours)</div>
                  </div>
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">{formatPercentage(maintenanceCompletionRate)}</div>
                    <div className="text-sm text-gray-600">Completion Rate</div>
                  </div>
                </div>
              </CardBody>
            </Card>
          </div>
        </Tab>
      </Tabs>
    </div>
  );
}
