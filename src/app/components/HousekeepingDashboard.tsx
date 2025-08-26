'use client';

import React from 'react';
import { Card, CardBody, CardHeader, Button, Chip, Progress, Badge } from '@heroui/react';
import { housekeepingStore } from '../lib/housekeeping/store';
import { RoomStatus } from '../lib/housekeeping/types';
import DashboardWrapper from './DashboardWrapper';

const statusColors: Record<RoomStatus, string> = {
  occupied: 'bg-blue-100 text-blue-800',
  vacant: 'bg-gray-100 text-gray-800',
  dirty: 'bg-red-100 text-red-800',
  clean: 'bg-green-100 text-green-800',
  inspected: 'bg-emerald-100 text-emerald-800',
  'out-of-order': 'bg-orange-100 text-orange-800',
  maintenance: 'bg-purple-100 text-purple-800'
};

const statusLabels: Record<RoomStatus, string> = {
  occupied: 'Occupied',
  vacant: 'Vacant',
  dirty: 'Dirty',
  clean: 'Clean',
  inspected: 'Inspected',
  'out-of-order': 'OOO',
  maintenance: 'Maintenance'
};

export default function HousekeepingDashboard() {
  const [tick, setTick] = React.useState(0);
  const [selectedStatus, setSelectedStatus] = React.useState<RoomStatus | 'all'>('all');
  
  React.useEffect(() => {
    const unsubscribe = housekeepingStore.subscribe(() => setTick(t => t + 1));
    return unsubscribe;
  }, []);

  const allRooms = housekeepingStore.getAllRooms();
  const filteredRooms = selectedStatus === 'all' 
    ? allRooms 
    : allRooms.filter(room => room.status === selectedStatus);

  const stats = housekeepingStore.getDailyStats();
  const staff = housekeepingStore.getStaffByRole('housekeeper');
  const pendingTasks = housekeepingStore.getTasksByStatus('pending');
  const inProgressTasks = housekeepingStore.getTasksByStatus('in-progress');
  const maintenanceRequests = housekeepingStore.getMaintenanceRequests();

  const quickActions = [
    { title: 'Create Task', icon: 'plus', color: 'primary', href: '#' },
    { title: 'Assign Tasks', icon: 'users', color: 'secondary', href: '#' },
    { title: 'Room Inspection', icon: 'check', color: 'success', href: '#' },
    { title: 'Maintenance Request', icon: 'wrench', color: 'warning', href: '#' }
  ];

  const kpis = [
    { label: 'Tasks Completed', value: stats.tasksCompleted, target: 50, color: 'success' },
    { label: 'Inspections', value: stats.inspectionsCompleted, target: 20, color: 'primary' },
    { label: 'Avg Task Time', value: `${stats.averageTaskTime}m`, target: 30, color: 'secondary' },
    { label: 'Avg Score', value: `${stats.averageInspectionScore}%`, target: 90, color: 'warning' }
  ];

  return (
    <DashboardWrapper
      title="Housekeeping & Maintenance"
      subtitle="Room status management, task assignment, and quality control"
      icon="🏠"
      stats={[
        { label: 'Total Rooms', value: allRooms.length.toString(), change: '+0', changeType: 'neutral', icon: '🏠' },
        { label: 'Available', value: allRooms.filter(r => r.status === 'clean' || r.status === 'inspected').length.toString(), change: '+2', changeType: 'positive', icon: '✅' },
        { label: 'Pending Tasks', value: pendingTasks.length.toString(), change: '-1', changeType: 'positive', icon: '📋' },
        { label: 'Active Staff', value: staff.filter(s => s.active).length.toString(), change: '+0', changeType: 'neutral', icon: '👥' }
      ]}
      quickActions={quickActions}
    >
      {/* Room Status Grid */}
      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-2 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-ghana-black">Room Status Overview</h3>
          <div className="flex gap-2">
            <Button 
              size="sm" 
              variant={selectedStatus === 'all' ? 'solid' : 'bordered'}
              onClick={() => setSelectedStatus('all')}
            >
              All ({allRooms.length})
            </Button>
            {Object.entries(statusLabels).map(([status, label]) => (
              <Button
                key={status}
                size="sm"
                variant={selectedStatus === status ? 'solid' : 'bordered'}
                onClick={() => setSelectedStatus(status as RoomStatus)}
              >
                {label} ({allRooms.filter(r => r.status === status).length})
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {filteredRooms.map(room => (
              <div
                key={room.roomNumber}
                className="p-3 border rounded-lg hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => console.log('Room details:', room.roomNumber)}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-ghana-black">{room.roomNumber}</span>
                  <Chip size="sm" className={statusColors[room.status]}>
                    {statusLabels[room.status]}
                  </Chip>
                </div>
                <div className="text-xs text-gray-600">
                  <div>Type: {room.roomTypeId}</div>
                  {room.currentGuest && <div>Guest: {room.currentGuest}</div>}
                  <div>Updated: {new Date(room.lastUpdated).toLocaleTimeString()}</div>
                </div>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>

      {/* Staff Overview */}
      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-2">
          <h3 className="text-lg font-semibold text-ghana-black">Staff Performance</h3>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {staff.map(member => (
              <div key={member.id} className="p-4 border rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="font-semibold text-ghana-black">{member.name}</h4>
                    <p className="text-sm text-gray-600 capitalize">{member.role}</p>
                  </div>
                  <Badge 
                    color={member.active ? 'success' : 'default'}
                    size="sm"
                  >
                    {member.active ? 'Active' : 'Offline'}
                  </Badge>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Today's Progress</span>
                    <span>{member.completedToday}/{member.dailyTarget}</span>
                  </div>
                  <Progress 
                    value={(member.completedToday / member.dailyTarget) * 100} 
                    color={member.efficiency >= 90 ? 'success' : member.efficiency >= 70 ? 'warning' : 'danger'}
                    size="sm"
                  />
                  <div className="flex justify-between text-xs text-gray-600">
                    <span>Efficiency</span>
                    <span>{member.efficiency}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>

      {/* Task Management */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-0 shadow-lg">
          <CardHeader className="pb-2">
            <h3 className="text-lg font-semibold text-ghana-black">Pending Tasks</h3>
          </CardHeader>
          <CardBody>
            <div className="space-y-3">
              {pendingTasks.slice(0, 5).map(task => (
                <div key={task.id} className="p-3 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold">Room {task.roomNumber}</span>
                    <Chip size="sm" color={task.priority === 'urgent' ? 'danger' : task.priority === 'high' ? 'warning' : 'default'}>
                      {task.priority}
                    </Chip>
                  </div>
                  <div className="text-sm text-gray-600">
                    <div>Type: {task.taskType}</div>
                    <div>Est. Time: {task.estimatedMinutes}m</div>
                    <div>Checklist: {task.checklist.length} items</div>
                  </div>
                </div>
              ))}
              {pendingTasks.length === 0 && (
                <div className="text-center text-gray-500 py-4">No pending tasks</div>
              )}
            </div>
          </CardBody>
        </Card>

        <Card className="border-0 shadow-lg">
          <CardHeader className="pb-2">
            <h3 className="text-lg font-semibold text-ghana-black">In Progress</h3>
          </CardHeader>
          <CardBody>
            <div className="space-y-3">
              {inProgressTasks.slice(0, 5).map(task => (
                <div key={task.id} className="p-3 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold">Room {task.roomNumber}</span>
                    <Chip size="sm" color="primary">In Progress</Chip>
                  </div>
                  <div className="text-sm text-gray-600">
                    <div>Assigned: {task.assignedTo}</div>
                    <div>Started: {task.startedAt ? new Date(task.startedAt).toLocaleTimeString() : 'N/A'}</div>
                    <div>Completed: {task.completedItems.length}/{task.checklist.length} items</div>
                  </div>
                </div>
              ))}
              {inProgressTasks.length === 0 && (
                <div className="text-center text-gray-500 py-4">No tasks in progress</div>
              )}
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Maintenance Requests */}
      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-2">
          <h3 className="text-lg font-semibold text-ghana-black">Maintenance Requests</h3>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {maintenanceRequests.slice(0, 6).map(request => (
              <div key={request.id} className="p-4 border rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold">Room {request.roomNumber}</span>
                  <Chip size="sm" color={request.priority === 'urgent' ? 'danger' : request.priority === 'high' ? 'warning' : 'default'}>
                    {request.priority}
                  </Chip>
                </div>
                <div className="text-sm text-gray-600 mb-2">
                  <div>Category: {request.category}</div>
                  <div>Status: {request.status}</div>
                  <div>Reported: {new Date(request.reportedAt).toLocaleDateString()}</div>
                </div>
                <p className="text-sm text-gray-700">{request.description}</p>
              </div>
            ))}
            {maintenanceRequests.length === 0 && (
              <div className="text-center text-gray-500 py-4 col-span-full">No maintenance requests</div>
            )}
          </div>
        </CardBody>
      </Card>
    </DashboardWrapper>
  );
}
