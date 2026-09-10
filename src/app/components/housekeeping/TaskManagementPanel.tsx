'use client';

import React, { useState, useEffect } from 'react';
import { 
  Card, 
  CardBody, 
  CardHeader, 
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
  Progress,
  Avatar,
  Checkbox
} from "@heroui/react";
import { housekeepingStore } from '../../lib/housekeeping/store';
import { frontOfficeStore } from '../../lib/frontoffice/store';
import { trackEvent } from '../../lib/analytics/trackEvent';
import { 
  HousekeepingTask, 
  TaskPriority, 
  TaskStatus,
  HousekeepingStaff 
} from '../../lib/housekeeping/types';

// Task Templates for quick creation
const TASK_TEMPLATES = {
  'daily-cleaning': {
    name: 'Daily Room Cleaning',
    description: 'Standard daily cleaning for occupied rooms',
    taskType: 'daily' as const,
    estimatedMinutes: 25,
    checklist: [
      'Make bed and change linens if needed',
      'Clean bathroom and restock amenities',
      'Empty trash and replace liners',
      'Dust surfaces and vacuum floor',
      'Check and restock minibar',
      'Report any maintenance issues'
    ],
    priority: 'medium' as TaskPriority,
    icon: '🧹'
  },
  'turnover': {
    name: 'Room Turnover',
    description: 'Complete cleaning after guest check-out',
    taskType: 'turnover' as const,
    estimatedMinutes: 45,
    checklist: [
      'Strip all bedding and replace with fresh linens',
      'Deep clean bathroom and sanitize surfaces',
      'Vacuum and mop floors thoroughly',
      'Clean all surfaces and fixtures',
      'Restock all amenities and supplies',
      'Check appliances and report issues',
      'Final inspection and quality check'
    ],
    priority: 'high' as TaskPriority,
    icon: '🔄'
  },
  'deep-clean': {
    name: 'Deep Cleaning',
    description: 'Weekly deep cleaning for all rooms',
    taskType: 'deep-clean' as const,
    estimatedMinutes: 60,
    checklist: [
      'Move furniture and clean underneath',
      'Deep clean carpets and upholstery',
      'Clean windows and window sills',
      'Sanitize all touch points',
      'Clean air vents and filters',
      'Polish fixtures and hardware',
      'Complete quality inspection'
    ],
    priority: 'medium' as TaskPriority,
    icon: '✨'
  },
  'maintenance-support': {
    name: 'Maintenance Support',
    description: 'Support tasks for maintenance work',
    taskType: 'maintenance' as const,
    estimatedMinutes: 30,
    checklist: [
      'Prepare room for maintenance work',
      'Cover furniture and protect surfaces',
      'Assist with cleaning after repairs',
      'Restore room to guest-ready condition',
      'Final quality check'
    ],
    priority: 'high' as TaskPriority,
    icon: '🔧'
  }
};

export default function TaskManagementPanel() {
  const [tasks, setTasks] = useState<HousekeepingTask[]>([]);
  const [staff, setStaff] = useState<HousekeepingStaff[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [selectedTask, setSelectedTask] = useState<HousekeepingTask | null>(null);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [bulkTaskModalOpen, setBulkTaskModalOpen] = useState(false);
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [selectedTab, setSelectedTab] = useState('tasks');

  // Form state
  const [taskForm, setTaskForm] = useState({
    roomNumber: '',
    roomTypeId: '',
    taskType: 'daily' as HousekeepingTask['taskType'],
    priority: 'medium' as TaskPriority,
    estimatedMinutes: 30,
    checklist: [] as string[],
    notes: '',
    assignedTo: ''
  });

  // Bulk task creation state
  const [bulkTaskForm, setBulkTaskForm] = useState({
    template: 'daily-cleaning',
    selectedRooms: [] as string[],
    assignedTo: '',
    priority: 'medium' as TaskPriority,
    startDate: new Date().toISOString().slice(0, 10),
    endDate: new Date().toISOString().slice(0, 10),
    repeatDaily: false,
    notes: ''
  });

  useEffect(() => {
    loadData();
    const unsubscribe = housekeepingStore.subscribe(loadData);
    return unsubscribe;
  }, []);

  const loadData = () => {
    setTasks(housekeepingStore.getAllTasks());
    setStaff(housekeepingStore.getAllStaff());
    setRooms(housekeepingStore.getAllRooms());
  };

  // Quick task creation from template
  const handleQuickTask = (templateKey: string, roomNumber?: string) => {
    const template = TASK_TEMPLATES[templateKey as keyof typeof TASK_TEMPLATES];
    if (!template) return;

    setTaskForm({
      roomNumber: roomNumber || '',
      roomTypeId: rooms.find(r => r.roomNumber === roomNumber)?.roomTypeId || 'standard',
      taskType: template.taskType,
      priority: template.priority,
      estimatedMinutes: template.estimatedMinutes,
      checklist: [...template.checklist],
      notes: '',
      assignedTo: ''
    });
    setIsCreatingTask(true);
    setTaskModalOpen(true);
  };

  // Bulk task creation
  const handleBulkTaskCreation = () => {
    const template = TASK_TEMPLATES[bulkTaskForm.template as keyof typeof TASK_TEMPLATES];
    if (!template || bulkTaskForm.selectedRooms.length === 0) return;

    const createdTasks: HousekeepingTask[] = [];
    
    bulkTaskForm.selectedRooms.forEach(roomNumber => {
      const room = rooms.find(r => r.roomNumber === roomNumber);
      if (room) {
        const task = housekeepingStore.createTask({
          roomNumber,
          roomTypeId: room.roomTypeId,
          taskType: template.taskType,
          priority: bulkTaskForm.priority,
          estimatedMinutes: template.estimatedMinutes,
          checklist: [...template.checklist],
          notes: bulkTaskForm.notes
        });

        // Auto-assign if staff member selected
        if (bulkTaskForm.assignedTo) {
          housekeepingStore.assignTask(task.id, bulkTaskForm.assignedTo);
        }

        createdTasks.push(task);
      }
    });

    trackEvent('HK.BulkTasks.Created', {
      count: createdTasks.length,
      template: bulkTaskForm.template,
      assignedTo: bulkTaskForm.assignedTo
    });

    setBulkTaskModalOpen(false);
    loadData();
  };

  const handleCreateTask = () => {
    setIsCreatingTask(true);
    setTaskForm({
      roomNumber: '',
      roomTypeId: '',
      taskType: 'daily',
      priority: 'medium',
      estimatedMinutes: 30,
      checklist: [],
      notes: '',
      assignedTo: ''
    });
    setTaskModalOpen(true);
  };

  const handleEditTask = (task: HousekeepingTask) => {
    setIsCreatingTask(false);
    setSelectedTask(task);
    setTaskForm({
      roomNumber: task.roomNumber,
      roomTypeId: task.roomTypeId,
      taskType: task.taskType,
      priority: task.priority,
      estimatedMinutes: task.estimatedMinutes,
      checklist: task.checklist,
      notes: task.notes || '',
      assignedTo: task.assignedTo || ''
    });
    setTaskModalOpen(true);
  };

  const handleSaveTask = () => {
    if (!taskForm.roomNumber || !taskForm.roomTypeId) return;

    if (isCreatingTask) {
      const task = housekeepingStore.createTask({
        roomNumber: taskForm.roomNumber,
        roomTypeId: taskForm.roomTypeId,
        taskType: taskForm.taskType,
        priority: taskForm.priority,
        estimatedMinutes: taskForm.estimatedMinutes,
        checklist: taskForm.checklist,
        notes: taskForm.notes
      });

      // Auto-assign if staff member selected
      if (taskForm.assignedTo) {
        housekeepingStore.assignTask(task.id, taskForm.assignedTo);
      }

      trackEvent('HK.Task.Created', {
        roomNumber: taskForm.roomNumber,
        taskType: taskForm.taskType,
        priority: taskForm.priority
      });
    } else if (selectedTask) {
      housekeepingStore.updateTask(selectedTask.id, {
        ...taskForm,
        status: selectedTask.status
      });

      trackEvent('HK.Task.Updated', {
        taskId: selectedTask.id,
        roomNumber: taskForm.roomNumber
      });
    }

    setTaskModalOpen(false);
    loadData();
  };

  const handleAssignTask = (taskId: string, staffId: string) => {
    housekeepingStore.assignTask(taskId, staffId);
    trackEvent('HK.Task.Assigned', { taskId, staffId });
    loadData();
  };

  const handleUpdateTaskStatus = (taskId: string, status: TaskStatus) => {
    housekeepingStore.updateTaskStatus(taskId, status);
    trackEvent('HK.Task.StatusUpdated', { taskId, status });
    loadData();
  };

  const handleChecklistUpdate = (taskId: string, completedItems: string[]) => {
    housekeepingStore.updateTaskStatus(taskId, 'in-progress', completedItems);
    trackEvent('HK.Task.ChecklistUpdated', { taskId, completedItems });
    loadData();
  };

  const getStatusColor = (status: TaskStatus) => {
    switch (status) {
      case 'pending': return 'default';
      case 'in-progress': return 'warning';
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

  const getTaskTypeColor = (type: string) => {
    switch (type) {
      case 'daily': return 'primary';
      case 'turnover': return 'secondary';
      case 'deep-clean': return 'success';
      case 'maintenance': return 'warning';
      case 'inspection': return 'default';
      default: return 'default';
    }
  };

  const getProgressPercentage = (task: HousekeepingTask) => {
    if (task.checklist.length === 0) return 0;
    return (task.completedItems.length / task.checklist.length) * 100;
  };

  const filteredTasks = tasks.filter(task => {
    if (searchTerm && !task.roomNumber.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    if (statusFilter !== 'all' && task.status !== statusFilter) return false;
    if (priorityFilter !== 'all' && task.priority !== priorityFilter) return false;
    return true;
  });

  const getRoomTypeName = (typeId: string) => {
    return frontOfficeStore.roomTypes.find(rt => rt.id === typeId)?.name || 'Unknown';
  };

  const getStaffName = (staffId: string) => {
    return staff.find(s => s.id === staffId)?.name || 'Unassigned';
  };

  // Get available rooms for bulk operations
  const availableRooms = rooms.filter(r => 
    r.status === 'dirty' || r.status === 'vacant' || r.status === 'clean'
  );

  return (
    <div className="p-6 space-y-4">
      {/* Header and Actions */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-ghana-black">🧹 Task Management</h2>
          <p className="text-gray-600">Create, assign, and track housekeeping tasks efficiently</p>
        </div>
        <div className="flex gap-2">
          <Button 
            color="secondary" 
            variant="flat"
            onClick={() => setBulkTaskModalOpen(true)}
          >
            📋 Bulk Tasks
          </Button>
          <Button 
            color="primary" 
            className="bg-ghana-green text-white"
            onClick={handleCreateTask}
          >
            + New Task
          </Button>
        </div>
      </div>

      {/* Quick Task Templates */}
      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-3">
          <h3 className="text-lg font-semibold text-ghana-black">🚀 Quick Task Creation</h3>
          <p className="text-sm text-gray-600">Click any template to create tasks quickly</p>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {Object.entries(TASK_TEMPLATES).map(([key, template]) => (
              <div
                key={key}
                className="p-4 border border-gray-200 rounded-lg hover:border-ghana-gold hover:shadow-md transition-all cursor-pointer bg-gray-50 hover:bg-white"
                onClick={() => handleQuickTask(key)}
              >
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-2xl">{template.icon}</span>
                  <div>
                    <h4 className="font-semibold text-ghana-black">{template.name}</h4>
                    <p className="text-xs text-gray-600">{template.description}</p>
                  </div>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Time:</span>
                    <span className="font-medium">{template.estimatedMinutes}m</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Priority:</span>
                    <Chip size="sm" variant="flat" color={template.priority === 'urgent' ? 'danger' : template.priority === 'high' ? 'warning' : 'primary'}>
                      {template.priority}
                    </Chip>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Checklist:</span>
                    <span className="font-medium">{template.checklist.length} items</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>

      {/* Filters */}
      <Card className="border-0 shadow-lg">
        <CardBody className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
              <SelectItem key="pending">⏳ Pending</SelectItem>
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
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">Total:</span>
              <Badge color="primary" variant="flat">{filteredTasks.length}</Badge>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Tasks Table */}
      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-3">
          <h3 className="text-lg font-semibold text-ghana-black">Housekeeping Tasks</h3>
        </CardHeader>
        <CardBody className="p-0">
          <div className="max-h-[560px] overflow-y-auto">
          <Table aria-label="Tasks table">
            <TableHeader>
              <TableColumn>Task ID</TableColumn>
              <TableColumn>Room</TableColumn>
              <TableColumn>Type</TableColumn>
              <TableColumn>Priority</TableColumn>
              <TableColumn>Status</TableColumn>
              <TableColumn>Assigned To</TableColumn>
              <TableColumn>Progress</TableColumn>
              <TableColumn>Time</TableColumn>
              <TableColumn>Actions</TableColumn>
            </TableHeader>
            <TableBody>
              {filteredTasks.map((task) => (
                <TableRow key={task.id} className="cursor-pointer hover:bg-gray-50">
                  <TableCell>
                    <span className="font-semibold text-ghana-black">{task.id}</span>
                  </TableCell>
                  <TableCell>
                    <Chip size="sm" variant="flat" color="secondary">
                      {task.roomNumber}
                    </Chip>
                  </TableCell>
                  <TableCell>
                    <Chip size="sm" variant="flat" color={getTaskTypeColor(task.taskType) as any}>
                      {task.taskType.replace('-', ' ').charAt(0).toUpperCase() + task.taskType.replace('-', ' ').slice(1)}
                    </Chip>
                  </TableCell>
                  <TableCell>
                    <Chip size="sm" variant="flat" color={getPriorityColor(task.priority) as any}>
                      {task.priority}
                    </Chip>
                  </TableCell>
                  <TableCell>
                    <Chip size="sm" variant="flat" color={getStatusColor(task.status) as any}>
                      {task.status === 'in-progress' ? '🔄 In Progress' : 
                       task.status === 'completed' ? '✅ Completed' :
                       task.status === 'verified' ? '🔍 Verified' : '⏳ Pending'}
                    </Chip>
                  </TableCell>
                  <TableCell>
                    {task.assignedTo ? (
                      <div className="flex items-center gap-2">
                        <Avatar size="sm" name={getStaffName(task.assignedTo)} />
                        <span className="text-sm">{getStaffName(task.assignedTo)}</span>
                      </div>
                    ) : (
                      <Chip size="sm" variant="flat" color="default">Unassigned</Chip>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Progress 
                        value={getProgressPercentage(task)} 
                        size="sm" 
                        color={getProgressPercentage(task) === 100 ? 'success' : 'primary'}
                        className="flex-1"
                      />
                      <span className="text-xs text-gray-600 w-12">
                        {task.completedItems.length}/{task.checklist.length}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <div className="font-medium">{task.estimatedMinutes}m</div>
                      {task.actualMinutes && (
                        <div className="text-xs text-gray-500">Actual: {task.actualMinutes}m</div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="flat"
                        color="primary"
                        onClick={() => handleEditTask(task)}
                      >
                        Edit
                      </Button>
                      {!task.assignedTo && (
                        <Select
                          placeholder="Assign"
                          size="sm"
                          onChange={(e) => handleAssignTask(task.id, e.target.value)}
                        >
                          {staff.filter(s => s.active).map(s => (
                            <SelectItem key={s.id}>
                              {s.name}
                            </SelectItem>
                          ))}
                        </Select>
                      )}
                      <Select
                        placeholder="Status"
                        size="sm"
                        value={task.status}
                        onChange={(e) => handleUpdateTaskStatus(task.id, e.target.value as TaskStatus)}
                      >
                        <SelectItem key="pending">⏳ Pending</SelectItem>
                        <SelectItem key="in-progress">🔄 In Progress</SelectItem>
                        <SelectItem key="completed">✅ Completed</SelectItem>
                        <SelectItem key="verified">🔍 Verified</SelectItem>
                      </Select>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
        </CardBody>
      </Card>

      {/* Task Creation/Edit Modal */}
      <Modal isOpen={taskModalOpen} onClose={() => setTaskModalOpen(false)} size="2xl">
        <ModalContent>
          <ModalHeader>
            {isCreatingTask ? 'Create New Task' : 'Edit Task'}
          </ModalHeader>
          <ModalBody>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Room Number"
                placeholder="Enter room number"
                value={taskForm.roomNumber}
                onChange={(e) => setTaskForm({...taskForm, roomNumber: e.target.value})}
                required
              />
              <Select
                label="Room Type"
                placeholder="Select room type"
                value={taskForm.roomTypeId}
                onChange={(e) => setTaskForm({...taskForm, roomTypeId: e.target.value})}
                required
              >
                {frontOfficeStore.roomTypes.map(type => (
                  <SelectItem key={type.id}>
                    {type.name}
                  </SelectItem>
                ))}
              </Select>
              <Select
                label="Task Type"
                placeholder="Select task type"
                value={taskForm.taskType}
                onChange={(e) => setTaskForm({...taskForm, taskType: e.target.value as any})}
                required
              >
                <SelectItem key="daily">Daily Cleaning</SelectItem>
                <SelectItem key="turnover">Room Turnover</SelectItem>
                <SelectItem key="deep-clean">Deep Cleaning</SelectItem>
                <SelectItem key="maintenance">Maintenance Support</SelectItem>
                <SelectItem key="inspection">Inspection</SelectItem>
              </Select>
              <Select
                label="Priority"
                placeholder="Select priority"
                value={taskForm.priority}
                onChange={(e) => setTaskForm({...taskForm, priority: e.target.value as any})}
                required
              >
                <SelectItem key="low">Low</SelectItem>
                <SelectItem key="medium">Medium</SelectItem>
                <SelectItem key="high">High</SelectItem>
                <SelectItem key="urgent">Urgent</SelectItem>
              </Select>
              <Input
                label="Estimated Time (minutes)"
                type="number"
                placeholder="30"
                value={String(taskForm.estimatedMinutes)}
                onChange={(e) => setTaskForm({...taskForm, estimatedMinutes: parseInt(e.target.value)})}
                required
              />
              <Select
                label="Assign To"
                placeholder="Select staff member"
                value={taskForm.assignedTo}
                onChange={(e) => setTaskForm({...taskForm, assignedTo: e.target.value})}
              >
                {[{ id: '', name: 'Unassigned', role: '' }, ...staff.filter(s => s.active)].map(s => (
                  <SelectItem key={s.id}>
                    {s.id === '' ? 'Unassigned' : `${s.name} (${s.role})`}
                  </SelectItem>
                ))}
              </Select>
            </div>
            
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Checklist Items
              </label>
              <div className="space-y-2">
                {taskForm.checklist.map((item, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      value={item}
                      onChange={(e) => {
                        const newChecklist = [...taskForm.checklist];
                        newChecklist[index] = e.target.value;
                        setTaskForm({...taskForm, checklist: newChecklist});
                      }}
                      placeholder="Checklist item"
                    />
                    <Button
                      size="sm"
                      color="danger"
                      variant="flat"
                      onClick={() => {
                        const newChecklist = taskForm.checklist.filter((_, i) => i !== index);
                        setTaskForm({...taskForm, checklist: newChecklist});
                      }}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
                <Button
                  size="sm"
                  color="secondary"
                  variant="flat"
                  onClick={() => setTaskForm({...taskForm, checklist: [...taskForm.checklist, '']})}
                >
                  + Add Item
                </Button>
              </div>
            </div>

            <Textarea
              label="Notes"
              placeholder="Additional notes or special instructions..."
              value={taskForm.notes}
              onChange={(e) => setTaskForm({...taskForm, notes: e.target.value})}
              className="mt-4"
            />
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onClick={() => setTaskModalOpen(false)}>
              Cancel
            </Button>
            <Button color="primary" onClick={handleSaveTask}>
              {isCreatingTask ? 'Create Task' : 'Update Task'}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Bulk Task Creation Modal */}
      <Modal isOpen={bulkTaskModalOpen} onClose={() => setBulkTaskModalOpen(false)} size="3xl">
        <ModalContent>
          <ModalHeader>
            <h3 className="text-lg font-semibold">📋 Bulk Task Creation</h3>
            <p className="text-sm text-gray-600">Create multiple tasks quickly using templates</p>
          </ModalHeader>
          <ModalBody>
            <div className="space-y-6">
              {/* Template Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Task Template
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {Object.entries(TASK_TEMPLATES).map(([key, template]) => (
                    <div
                      key={key}
                      className={`p-3 border rounded-lg cursor-pointer transition-all ${
                        bulkTaskForm.template === key 
                          ? 'border-ghana-gold bg-ghana-gold/10' 
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => setBulkTaskForm({...bulkTaskForm, template: key})}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{template.icon}</span>
                        <div>
                          <div className="font-medium">{template.name}</div>
                          <div className="text-xs text-gray-600">{template.description}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Room Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Rooms ({bulkTaskForm.selectedRooms.length} selected)
                </label>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 max-h-40 overflow-y-auto border rounded-lg p-3">
                  {availableRooms.map(room => (
                    <div
                      key={room.roomNumber}
                      className={`p-2 border rounded cursor-pointer text-sm transition-all ${
                        bulkTaskForm.selectedRooms.includes(room.roomNumber)
                          ? 'border-ghana-gold bg-ghana-gold/10'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => {
                        const isSelected = bulkTaskForm.selectedRooms.includes(room.roomNumber);
                        if (isSelected) {
                          setBulkTaskForm({
                            ...bulkTaskForm,
                            selectedRooms: bulkTaskForm.selectedRooms.filter(r => r !== room.roomNumber)
                          });
                        } else {
                          setBulkTaskForm({
                            ...bulkTaskForm,
                            selectedRooms: [...bulkTaskForm.selectedRooms, room.roomNumber]
                          });
                        }
                      }}
                    >
                      <div className="font-medium">{room.roomNumber}</div>
                      <div className="text-xs text-gray-600">{room.status}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex gap-2">
                  <Button
                    size="sm"
                    variant="flat"
                    onClick={() => setBulkTaskForm({...bulkTaskForm, selectedRooms: availableRooms.map(r => r.roomNumber)})}
                  >
                    Select All
                  </Button>
                  <Button
                    size="sm"
                    variant="flat"
                    onClick={() => setBulkTaskForm({...bulkTaskForm, selectedRooms: []})}
                  >
                    Clear All
                  </Button>
                </div>
              </div>

              {/* Assignment and Settings */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Select
                  label="Assign To"
                  placeholder="Select staff member"
                  value={bulkTaskForm.assignedTo}
                  onChange={(e) => setBulkTaskForm({...bulkTaskForm, assignedTo: e.target.value})}
                >
                  {[{ id: '', name: 'Unassigned', role: '' }, ...staff.filter(s => s.active)].map(s => (
                    <SelectItem key={s.id}>
                      {s.id === '' ? 'Unassigned' : `${s.name} (${s.role})`}
                    </SelectItem>
                  ))}
                </Select>
                <Select
                  label="Priority"
                  placeholder="Select priority"
                  value={bulkTaskForm.priority}
                  onChange={(e) => setBulkTaskForm({...bulkTaskForm, priority: e.target.value as any})}
                >
                  <SelectItem key="low">Low</SelectItem>
                  <SelectItem key="medium">Medium</SelectItem>
                  <SelectItem key="high">High</SelectItem>
                  <SelectItem key="urgent">Urgent</SelectItem>
                </Select>
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={bulkTaskForm.repeatDaily}
                    onChange={(e) => setBulkTaskForm({...bulkTaskForm, repeatDaily: e.target.checked})}
                  />
                  <label className="text-sm text-gray-700">Repeat Daily</label>
                </div>
              </div>

              {/* Date Range */}
              {bulkTaskForm.repeatDaily && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Start Date"
                    type="date"
                    value={bulkTaskForm.startDate}
                    onChange={(e) => setBulkTaskForm({...bulkTaskForm, startDate: e.target.value})}
                  />
                  <Input
                    label="End Date"
                    type="date"
                    value={bulkTaskForm.endDate}
                    onChange={(e) => setBulkTaskForm({...bulkTaskForm, endDate: e.target.value})}
                  />
                </div>
              )}

              <Textarea
                label="Notes"
                placeholder="Additional notes for all tasks..."
                value={bulkTaskForm.notes}
                onChange={(e) => setBulkTaskForm({...bulkTaskForm, notes: e.target.value})}
              />

              {/* Summary */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium mb-2">Task Summary</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Template:</span>
                    <div className="font-medium">{TASK_TEMPLATES[bulkTaskForm.template as keyof typeof TASK_TEMPLATES]?.name}</div>
                  </div>
                  <div>
                    <span className="text-gray-600">Rooms:</span>
                    <div className="font-medium">{bulkTaskForm.selectedRooms.length}</div>
                  </div>
                  <div>
                    <span className="text-gray-600">Staff:</span>
                    <div className="font-medium">
                      {bulkTaskForm.assignedTo ? staff.find(s => s.id === bulkTaskForm.assignedTo)?.name : 'Unassigned'}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-600">Priority:</span>
                    <div className="font-medium">{bulkTaskForm.priority}</div>
                  </div>
                </div>
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onClick={() => setBulkTaskModalOpen(false)}>
              Cancel
            </Button>
            <Button 
              color="primary" 
              onClick={handleBulkTaskCreation}
              disabled={bulkTaskForm.selectedRooms.length === 0}
            >
              Create {bulkTaskForm.selectedRooms.length} Tasks
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
