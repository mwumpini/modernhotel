'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { HideCardButton } from '../dashboard/CustomizeViewControl';
import { 
  Card, 
  CardBody, 
  Button, 
  Input, 
  Select, 
  SelectItem, 
  Chip, 
  Badge, 
  Modal, 
  ModalContent, 
  ModalHeader, 
  ModalBody, 
  ModalFooter,
  Textarea,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Avatar,
  Pagination,
} from "@heroui/react";
import { housekeepingStore } from '../../lib/housekeeping/store';
import { trackEvent } from '../../lib/analytics/trackEvent';
import { 
  MaintenanceRequest, 
  TaskPriority,
  HousekeepingStaff 
} from '../../lib/housekeeping/types';
import { sizedTableClassNames, useResizableColumns } from '../frontoffice/columnResize';
import { deskTableCardBodyClassName, deskTableCardClassName, deskTableClassNames, SortHeader, toggleColumnSort, DESK_PAGE_SIZE, type ColumnSort } from '../dashboard/deskTableUi';

export default function MaintenancePanel({
  hideStats = false,
  onHideStats,
}: {
  hideStats?: boolean;
  onHideStats?: () => void;
} = {}) {
  const [maintenanceRequests, setMaintenanceRequests] = useState<MaintenanceRequest[]>([]);
  const [staff, setStaff] = useState<HousekeepingStaff[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<MaintenanceRequest | null>(null);
  const [maintenanceModalOpen, setMaintenanceModalOpen] = useState(false);
  const [isCreatingRequest, setIsCreatingRequest] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [sort, setSort] = useState<ColumnSort>({ column: 'reported', direction: 'desc' });
  const [page, setPage] = useState(1);
  const cols = useResizableColumns({
    id: 120,
    room: 80,
    category: 120,
    priority: 90,
    status: 120,
    description: 200,
    assigned: 140,
    reported: 110,
  });

  // Form state
  const [maintenanceForm, setMaintenanceForm] = useState({
    roomNumber: '',
    category: 'other' as MaintenanceRequest['category'],
    priority: 'medium' as TaskPriority,
    description: '',
    estimatedCost: 0,
    assignedTo: ''
  });

  useEffect(() => {
    loadData();
    const unsubscribe = housekeepingStore.subscribe(loadData);
    return unsubscribe;
  }, []);

  const loadData = () => {
    setMaintenanceRequests(housekeepingStore.getAllMaintenanceRequests());
    setStaff(housekeepingStore.getAllStaff());
    setRooms(housekeepingStore.getAllRooms());
  };

  const handleCreateRequest = () => {
    setIsCreatingRequest(true);
    setMaintenanceForm({
      roomNumber: '',
      category: 'other',
      priority: 'medium',
      description: '',
      estimatedCost: 0,
      assignedTo: ''
    });
    setMaintenanceModalOpen(true);
  };

  const handleEditRequest = (request: MaintenanceRequest) => {
    setIsCreatingRequest(false);
    setSelectedRequest(request);
    setMaintenanceForm({
      roomNumber: request.roomNumber,
      category: request.category,
      priority: request.priority,
      description: request.description,
      estimatedCost: request.estimatedCost || 0,
      assignedTo: request.assignedTo || ''
    });
    setMaintenanceModalOpen(true);
  };

  const handleSaveRequest = () => {
    if (!maintenanceForm.roomNumber || !maintenanceForm.description) return;

    if (isCreatingRequest) {
      housekeepingStore.createMaintenanceRequest({
        roomNumber: maintenanceForm.roomNumber,
        reportedBy: 'Housekeeping Staff',
        category: maintenanceForm.category,
        priority: maintenanceForm.priority,
        description: maintenanceForm.description
      });

      trackEvent('HK.Maintenance.Created', {
        roomNumber: maintenanceForm.roomNumber,
        category: maintenanceForm.category,
        priority: maintenanceForm.priority
      });
    } else if (selectedRequest) {
      housekeepingStore.updateMaintenanceRequest(selectedRequest.id, {
        ...maintenanceForm,
        status: selectedRequest.status
      });

      trackEvent('HK.Maintenance.Updated', {
        requestId: selectedRequest.id,
        roomNumber: maintenanceForm.roomNumber
      });
    }

    setMaintenanceModalOpen(false);
    loadData();
  };

  const handleUpdateStatus = (requestId: string, status: MaintenanceRequest['status'], assignedTo?: string) => {
    housekeepingStore.updateMaintenanceStatus(requestId, status, assignedTo);
    trackEvent('HK.Maintenance.StatusUpdated', { requestId, status, assignedTo });
    loadData();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'reported': return 'default';
      case 'assigned': return 'warning';
      case 'in-progress': return 'primary';
      case 'completed': return 'success';
      case 'verified': return 'secondary';
      default: return 'default';
    }
  };

  const getPriorityColor = (priority: TaskPriority) => {
    switch (priority) {
      case 'urgent': return 'danger';
      case 'high': return 'warning';
      case 'medium': return 'primary';
      case 'low': return 'default';
      default: return 'default';
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'plumbing': return 'primary';
      case 'electrical': return 'warning';
      case 'hvac': return 'secondary';
      case 'furniture': return 'success';
      case 'appliances': return 'default';
      case 'structural': return 'danger';
      case 'other': return 'default';
      default: return 'default';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'plumbing': return '🚰';
      case 'electrical': return '⚡';
      case 'hvac': return '❄️';
      case 'furniture': return '🪑';
      case 'appliances': return '🔌';
      case 'structural': return '🏗️';
      case 'other': return '🔧';
      default: return '🔧';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'reported': return '📝';
      case 'assigned': return '👥';
      case 'in-progress': return '🔄';
      case 'completed': return '✅';
      case 'verified': return '🔍';
      default: return '📝';
    }
  };

  const filteredRequests = maintenanceRequests.filter(request => {
    if (searchTerm && !request.roomNumber.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    if (statusFilter !== 'all' && request.status !== statusFilter) return false;
    if (priorityFilter !== 'all' && request.priority !== priorityFilter) return false;
    if (categoryFilter !== 'all' && request.category !== categoryFilter) return false;
    return true;
  });

  const sortedRequests = useMemo(() => {
    const dir = sort.direction === 'asc' ? 1 : -1;
    return [...filteredRequests].sort((a, b) => {
      switch (sort.column) {
        case 'id':
          return a.id.localeCompare(b.id) * dir;
        case 'room':
          return a.roomNumber.localeCompare(b.roomNumber, undefined, { numeric: true }) * dir;
        case 'category':
          return a.category.localeCompare(b.category) * dir;
        case 'priority':
          return a.priority.localeCompare(b.priority) * dir;
        case 'status':
          return a.status.localeCompare(b.status) * dir;
        case 'description':
          return a.description.localeCompare(b.description) * dir;
        case 'assigned':
          return (a.assignedTo || '').localeCompare(b.assignedTo || '') * dir;
        case 'reported':
        default:
          return (new Date(a.reportedAt).getTime() - new Date(b.reportedAt).getTime()) * dir;
      }
    });
  }, [filteredRequests, sort]);

  const pages = Math.max(1, Math.ceil(sortedRequests.length / DESK_PAGE_SIZE));
  const pageSafe = Math.min(page, pages);
  const pagedRequests = sortedRequests.slice((pageSafe - 1) * DESK_PAGE_SIZE, pageSafe * DESK_PAGE_SIZE);

  useEffect(() => { setPage(1); }, [searchTerm, statusFilter, priorityFilter, categoryFilter]);

  const getStaffName = (staffId: string) => {
    return staff.find(s => s.id === staffId)?.name || 'Unassigned';
  };

  const getCategoryName = (category: string) => {
    return category.charAt(0).toUpperCase() + category.slice(1);
  };

  return (
    <div className="space-y-3">
      {/* Header and Actions */}
      <div className="mb-[18px] flex flex-nowrap items-center justify-between gap-2 overflow-x-auto">
        <h2 className="text-lg font-semibold text-ghana-black shrink-0">Maintenance</h2>
        <Button
          size="sm"
          color="primary"
          className="bg-ghana-green text-white"
          onClick={handleCreateRequest}
        >
          + New Maintenance Request
        </Button>
      </div>

      {/* Maintenance Overview Cards — Desk-style compact */}
      {!hideStats && (
        <div className="flex items-start gap-1">
          <div className="grid min-w-0 flex-1 grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {([
              { label: 'Total', value: maintenanceRequests.length, tone: 'text-ghana-black' },
              {
                label: 'Open',
                value: maintenanceRequests.filter((r) => r.status !== 'completed' && r.status !== 'verified').length,
                tone: 'text-yellow-700',
              },
              {
                label: 'In progress',
                value: maintenanceRequests.filter((r) => r.status === 'in-progress').length,
                tone: 'text-blue-700',
              },
              {
                label: 'Completed',
                value: maintenanceRequests.filter((r) => r.status === 'completed' || r.status === 'verified').length,
                tone: 'text-green-700',
              },
              {
                label: 'Urgent',
                value: maintenanceRequests.filter((r) => r.priority === 'urgent').length,
                tone: 'text-red-700',
              },
            ] as const).map((stat) => (
              <Card key={stat.label} className="border border-gray-200 shadow-none">
                <CardBody className="px-2 py-1.5 text-center">
                  <div className={`text-base font-semibold tabular-nums ${stat.tone}`}>{stat.value}</div>
                  <div className="text-xs leading-tight text-gray-500">{stat.label}</div>
                </CardBody>
              </Card>
            ))}
          </div>
          {onHideStats && <HideCardButton onHide={onHideStats} label="Maintenance summary" />}
        </div>
      )}

      {/* Filters */}
      <Card className="border-0 shadow-lg">
        <CardBody className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <Input
              placeholder="Search room numbers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              startContent={<span className="text-gray-400">🔍</span>}
            />
            <Select
              placeholder="Filter by status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <SelectItem key="all">All Statuses</SelectItem>
              <SelectItem key="reported">📝 Reported</SelectItem>
              <SelectItem key="assigned">👥 Assigned</SelectItem>
              <SelectItem key="in-progress">🔄 In Progress</SelectItem>
              <SelectItem key="completed">✅ Completed</SelectItem>
              <SelectItem key="verified">🔍 Verified</SelectItem>
            </Select>
            <Select
              placeholder="Filter by priority"
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
            >
              <SelectItem key="all">All Priorities</SelectItem>
              <SelectItem key="low">Low</SelectItem>
              <SelectItem key="medium">Medium</SelectItem>
              <SelectItem key="high">High</SelectItem>
              <SelectItem key="urgent">Urgent</SelectItem>
            </Select>
            <Select
              placeholder="Filter by category"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <SelectItem key="all">All Categories</SelectItem>
              <SelectItem key="plumbing">🚰 Plumbing</SelectItem>
              <SelectItem key="electrical">⚡ Electrical</SelectItem>
              <SelectItem key="hvac">❄️ HVAC</SelectItem>
              <SelectItem key="furniture">🪑 Furniture</SelectItem>
              <SelectItem key="appliances">🔌 Appliances</SelectItem>
              <SelectItem key="structural">🏗️ Structural</SelectItem>
              <SelectItem key="other">🔧 Other</SelectItem>
            </Select>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">Filtered:</span>
              <Badge color="primary" variant="flat">{filteredRequests.length}</Badge>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Maintenance Requests Table */}
      <Card className={deskTableCardClassName}>
        <CardBody className={deskTableCardBodyClassName}>
          <div ref={cols.frameRef} style={cols.frameStyle}>
          <Table aria-label="Maintenance requests table" removeWrapper classNames={sizedTableClassNames(deskTableClassNames)}>
            <TableHeader>
              <TableColumn className="relative" style={cols.style('id')}>{<SortHeader label="ID" column="id" sort={sort} onSort={(c) => setSort((p) => toggleColumnSort(p, c))} />}{cols.sizer('id', 'ID')}</TableColumn>
              <TableColumn className="relative" style={cols.style('room')}>{<SortHeader label="Room" column="room" sort={sort} onSort={(c) => setSort((p) => toggleColumnSort(p, c))} />}{cols.sizer('room', 'Room')}</TableColumn>
              <TableColumn className="relative" style={cols.style('category')}>{<SortHeader label="Category" column="category" sort={sort} onSort={(c) => setSort((p) => toggleColumnSort(p, c))} />}{cols.sizer('category', 'Category')}</TableColumn>
              <TableColumn className="relative" style={cols.style('priority')}>{<SortHeader label="Priority" column="priority" sort={sort} onSort={(c) => setSort((p) => toggleColumnSort(p, c))} />}{cols.sizer('priority', 'Priority')}</TableColumn>
              <TableColumn className="relative" style={cols.style('status')}>{<SortHeader label="Status" column="status" sort={sort} onSort={(c) => setSort((p) => toggleColumnSort(p, c))} />}{cols.sizer('status', 'Status')}</TableColumn>
              <TableColumn className="relative" style={cols.style('description')}>{<SortHeader label="Description" column="description" sort={sort} onSort={(c) => setSort((p) => toggleColumnSort(p, c))} />}{cols.sizer('description', 'Description')}</TableColumn>
              <TableColumn className="relative" style={cols.style('assigned')}>{<SortHeader label="Assigned" column="assigned" sort={sort} onSort={(c) => setSort((p) => toggleColumnSort(p, c))} />}{cols.sizer('assigned', 'Assigned')}</TableColumn>
              <TableColumn className="relative" style={cols.style('reported')}>{<SortHeader label="Reported" column="reported" sort={sort} onSort={(c) => setSort((p) => toggleColumnSort(p, c))} />}{cols.sizer('reported', 'Reported')}</TableColumn>
            </TableHeader>
            <TableBody emptyContent="No maintenance requests match.">
              {pagedRequests.map((request) => (
                <TableRow
                  key={request.id}
                  className="cursor-pointer hover:bg-gray-50"
                  onClick={() => handleEditRequest(request)}
                >
                  <TableCell>
                    <span className="font-semibold text-ghana-black">{request.id}</span>
                  </TableCell>
                  <TableCell>
                    <Chip size="sm" variant="flat" color="secondary">
                      {request.roomNumber}
                    </Chip>
                  </TableCell>
                  <TableCell>
                    <Chip 
                      size="sm" 
                      variant="flat" 
                      color={getCategoryColor(request.category) as any}
                    >
                      <span className="mr-1">{getCategoryIcon(request.category)}</span>
                      {getCategoryName(request.category)}
                    </Chip>
                  </TableCell>
                  <TableCell>
                    <Badge 
                      color={getPriorityColor(request.priority) as any}
                      variant="flat"
                      size="sm"
                    >
                      {request.priority}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge 
                      color={getStatusColor(request.status) as any}
                      variant="flat"
                      size="sm"
                    >
                      <span className="mr-1">{getStatusIcon(request.status)}</span>
                      {request.status.replace('-', ' ').charAt(0).toUpperCase() + request.status.replace('-', ' ').slice(1)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-gray-700 truncate block" title={request.description}>
                      {request.description}
                    </span>
                  </TableCell>
                  <TableCell>
                    {request.assignedTo ? (
                      <div className="flex items-center gap-2 min-w-0">
                        <Avatar size="sm" name={getStaffName(request.assignedTo)} />
                        <span className="text-sm truncate" title={getStaffName(request.assignedTo)}>{getStaffName(request.assignedTo)}</span>
                      </div>
                    ) : (
                      <span className="text-gray-400 text-sm">Unassigned</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="whitespace-nowrap text-sm text-gray-600">
                      {new Date(request.reportedAt).toLocaleDateString()}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
          <div className="mt-3 flex justify-end">
            <Pagination page={pageSafe} total={pages} onChange={setPage} showControls size="sm" />
          </div>
        </CardBody>
      </Card>

      {/* Maintenance Request Modal */}
      <Modal isOpen={maintenanceModalOpen} onClose={() => setMaintenanceModalOpen(false)} size="2xl">
        <ModalContent>
          <ModalHeader>
            {isCreatingRequest ? 'Create Maintenance Request' : 'Maintenance Request Details'}
          </ModalHeader>
          <ModalBody>
            <div className="space-y-4">
              {/* Room Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Room Number *</label>
                <Select
                  value={maintenanceForm.roomNumber}
                  onChange={(e) => setMaintenanceForm({...maintenanceForm, roomNumber: e.target.value})}
                  placeholder="Select room"
                  isRequired
                >
                  {rooms.map((room) => (
                    <SelectItem key={room.roomNumber}>
                      Room {room.roomNumber}
                    </SelectItem>
                  ))}
                </Select>
              </div>

              {/* Category and Priority */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Category *</label>
                  <Select
                    value={maintenanceForm.category}
                    onChange={(e) => setMaintenanceForm({...maintenanceForm, category: e.target.value as any})}
                    placeholder="Select category"
                    isRequired
                  >
                    <SelectItem key="plumbing">🚰 Plumbing</SelectItem>
                    <SelectItem key="electrical">⚡ Electrical</SelectItem>
                    <SelectItem key="hvac">❄️ HVAC</SelectItem>
                    <SelectItem key="furniture">🪑 Furniture</SelectItem>
                    <SelectItem key="appliances">🔌 Appliances</SelectItem>
                    <SelectItem key="structural">🏗️ Structural</SelectItem>
                    <SelectItem key="other">🔧 Other</SelectItem>
                  </Select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Priority *</label>
                  <Select
                    value={maintenanceForm.priority}
                    onChange={(e) => setMaintenanceForm({...maintenanceForm, priority: e.target.value as any})}
                    placeholder="Select priority"
                    isRequired
                  >
                    <SelectItem key="low">Low</SelectItem>
                    <SelectItem key="medium">Medium</SelectItem>
                    <SelectItem key="high">High</SelectItem>
                    <SelectItem key="urgent">Urgent</SelectItem>
                  </Select>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Description *</label>
                <Textarea
                  value={maintenanceForm.description}
                  onChange={(e) => setMaintenanceForm({...maintenanceForm, description: e.target.value})}
                  placeholder="Describe the maintenance issue in detail"
                  rows={4}
                  isRequired
                />
              </div>

              {/* Cost and Assignment */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Estimated Cost</label>
                  <Input
                    type="number"
                    value={String(maintenanceForm.estimatedCost)}
                    onChange={(e) => setMaintenanceForm({...maintenanceForm, estimatedCost: parseFloat(e.target.value) || 0})}
                    placeholder="0.00"
                    startContent={<span className="text-gray-400">$</span>}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Assign To</label>
                  <Select
                    value={maintenanceForm.assignedTo}
                    onChange={(e) => setMaintenanceForm({...maintenanceForm, assignedTo: e.target.value})}
                    placeholder="Select staff member"
                  >
                    {staff.filter(s => s.active && s.role === 'maintenance').map((member) => (
                      <SelectItem key={member.id}>
                        {member.name} ({member.role})
                      </SelectItem>
                    ))}
                  </Select>
                </div>
              </div>

              {/* Current Status Display (for editing) */}
              {!isCreatingRequest && selectedRequest && (
                <div className="p-4 bg-gray-50 rounded-lg">
                  <h4 className="font-medium text-gray-900 mb-2">Current Status</h4>
                  <div className="flex items-center gap-2">
                    <Badge color={getStatusColor(selectedRequest.status) as any} variant="flat">
                      {getStatusIcon(selectedRequest.status)} {selectedRequest.status.replace('-', ' ').charAt(0).toUpperCase() + selectedRequest.status.replace('-', ' ').slice(1)}
                    </Badge>
                    <span className="text-sm text-gray-600">
                      Reported: {new Date(selectedRequest.reportedAt).toLocaleString()}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onClick={() => setMaintenanceModalOpen(false)}>
              Cancel
            </Button>
            <Button 
              color="primary" 
              onClick={handleSaveRequest}
              isDisabled={!maintenanceForm.roomNumber || !maintenanceForm.description}
            >
              {isCreatingRequest ? 'Create Request' : 'Update Request'}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
