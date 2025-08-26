import { create } from 'zustand';
import { Room, CleaningTask, CleaningChecklistItem, CleaningSupply } from './models';

interface RoomStore {
  rooms: Room[];
  cleaningTasks: CleaningTask[];
  selectedRoom: Room | null;
  selectedTask: CleaningTask | null;
  
  // Room Management
  addRoom: (room: Omit<Room, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateRoom: (id: string, updates: Partial<Room>) => void;
  deleteRoom: (id: string) => void;
  getRoom: (id: string) => Room | undefined;
  getRoomsByStatus: (status: Room['status']) => Room[];
  getRoomsByFloor: (floor: number) => Room[];
  getRoomsByType: (type: Room['type']) => Room[];
  
  // Cleaning Task Management
  createCleaningTask: (task: Omit<CleaningTask, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateCleaningTask: (id: string, updates: Partial<CleaningTask>) => void;
  deleteCleaningTask: (id: string) => void;
  getTask: (id: string) => CleaningTask | undefined;
  getTasksByStatus: (status: CleaningTask['status']) => CleaningTask[];
  getTasksByPriority: (priority: CleaningTask['priority']) => CleaningTask[];
  getTasksByStaff: (staffId: string) => CleaningTask[];
  getTasksByRoom: (roomId: string) => CleaningTask[];
  
  // Task Assignment
  assignTask: (taskId: string, staffId: string, staffName: string) => void;
  startTask: (taskId: string) => void;
  completeTask: (taskId: string, qualityScore: number, notes?: string) => void;
  verifyTask: (taskId: string, supervisorId: string, supervisorName: string) => void;
  
  // Room Status Updates
  updateRoomStatus: (roomId: string, status: Room['status']) => void;
  markRoomForCleaning: (roomId: string, cleaningType: Room['cleaningType']) => void;
  markRoomCleaned: (roomId: string) => void;
  
  // Selection
  selectRoom: (room: Room | null) => void;
  selectTask: (task: CleaningTask | null) => void;
  
  // Analytics
  getRoomOccupancyRate: () => number;
  getCleaningEfficiency: () => { averageTime: number; completionRate: number };
  getPendingTasksCount: () => number;
  getOverdueTasks: () => CleaningTask[];
}

// Sample data
const sampleRooms: Room[] = [
  {
    id: '1',
    number: '101',
    type: 'standard',
    floor: 1,
    status: 'occupied',
    lastCleaned: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
    nextCleaning: new Date(Date.now() + 12 * 60 * 60 * 1000), // 12 hours from now
    cleaningType: 'daily',
    amenities: ['WiFi', 'TV', 'AC', 'Private Bathroom'],
    capacity: 2,
    rate: 150,
    isActive: true
  },
  {
    id: '2',
    number: '102',
    type: 'standard',
    floor: 1,
    status: 'dirty',
    lastCleaned: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
    nextCleaning: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours from now
    cleaningType: 'turnover',
    amenities: ['WiFi', 'TV', 'AC', 'Private Bathroom'],
    capacity: 2,
    rate: 150,
    isActive: true
  },
  {
    id: '3',
    number: '201',
    type: 'deluxe',
    floor: 2,
    status: 'clean',
    lastCleaned: new Date(Date.now() - 6 * 60 * 60 * 1000), // 6 hours ago
    nextCleaning: new Date(Date.now() + 18 * 60 * 60 * 1000), // 18 hours from now
    cleaningType: 'daily',
    amenities: ['WiFi', 'TV', 'AC', 'Private Bathroom', 'Mini Bar', 'Balcony'],
    capacity: 3,
    rate: 250,
    isActive: true
  },
  {
    id: '4',
    number: '301',
    type: 'suite',
    floor: 3,
    status: 'maintenance',
    lastCleaned: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
    nextCleaning: new Date(Date.now() + 24 * 60 * 60 * 1000), // 1 day from now
    cleaningType: 'maintenance',
    amenities: ['WiFi', 'TV', 'AC', 'Private Bathroom', 'Mini Bar', 'Balcony', 'Kitchen'],
    capacity: 4,
    rate: 400,
    isActive: true
  }
];

const sampleCleaningTasks: CleaningTask[] = [
  {
    id: '1',
    roomId: '2',
    roomNumber: '102',
    assignedToId: 'staff1',
    assignedToName: 'Sarah Johnson',
    type: 'turnover',
    status: 'pending',
    priority: 'high',
    duration: 45,
    checklist: [
      { id: '1', description: 'Change bed linens', isCompleted: false },
      { id: '2', description: 'Clean bathroom', isCompleted: false },
      { id: '3', description: 'Vacuum carpet', isCompleted: false },
      { id: '4', description: 'Restock amenities', isCompleted: false }
    ],
    supplies: [
      { id: '1', name: 'Cleaning solution', quantity: 1, unit: 'bottle', cost: 5.50, supplier: 'CleanPro' },
      { id: '2', name: 'Fresh linens', quantity: 1, unit: 'set', cost: 12.00, supplier: 'LinenCo' }
    ],
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: '2',
    roomId: '1',
    roomNumber: '101',
    assignedToId: 'staff2',
    assignedToName: 'Mike Chen',
    type: 'daily',
    status: 'in-progress',
    priority: 'medium',
    startTime: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
    duration: 30,
    checklist: [
      { id: '1', description: 'Make bed', isCompleted: true },
      { id: '2', description: 'Clean bathroom', isCompleted: false },
      { id: '3', description: 'Empty trash', isCompleted: true },
      { id: '4', description: 'Restock towels', isCompleted: false }
    ],
    supplies: [
      { id: '1', name: 'Cleaning solution', quantity: 1, unit: 'bottle', cost: 5.50, supplier: 'CleanPro' },
      { id: '2', name: 'Fresh towels', quantity: 2, unit: 'pieces', cost: 8.00, supplier: 'LinenCo' }
    ],
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
    updatedAt: new Date()
  }
];

export const useRoomStore = create<RoomStore>((set, get) => ({
  rooms: sampleRooms,
  cleaningTasks: sampleCleaningTasks,
  selectedRoom: null,
  selectedTask: null,

  // Room Management
  addRoom: (roomData) => {
    const newRoom: Room = {
      ...roomData,
      id: Date.now().toString(),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    set(state => ({ rooms: [...state.rooms, newRoom] }));
  },

  updateRoom: (id, updates) => {
    set(state => ({
      rooms: state.rooms.map(room => 
        room.id === id 
          ? { ...room, ...updates, updatedAt: new Date() }
          : room
      )
    }));
  },

  deleteRoom: (id) => {
    set(state => ({ rooms: state.rooms.filter(room => room.id !== id) }));
  },

  getRoom: (id) => get().rooms.find(room => room.id === id),

  getRoomsByStatus: (status) => get().rooms.filter(room => room.status === status),

  getRoomsByFloor: (floor) => get().rooms.filter(room => room.floor === floor),

  getRoomsByType: (type) => get().rooms.filter(room => room.type === type),

  // Cleaning Task Management
  createCleaningTask: (taskData) => {
    const newTask: CleaningTask = {
      ...taskData,
      id: Date.now().toString(),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    set(state => ({ cleaningTasks: [...state.cleaningTasks, newTask] }));
  },

  updateCleaningTask: (id, updates) => {
    set(state => ({
      cleaningTasks: state.cleaningTasks.map(task => 
        task.id === id 
          ? { ...task, ...updates, updatedAt: new Date() }
          : task
      )
    }));
  },

  deleteCleaningTask: (id) => {
    set(state => ({ cleaningTasks: state.cleaningTasks.filter(task => task.id !== id) }));
  },

  getTask: (id) => get().cleaningTasks.find(task => task.id === id),

  getTasksByStatus: (status) => get().cleaningTasks.filter(task => task.status === status),

  getTasksByPriority: (priority) => get().cleaningTasks.filter(task => task.priority === priority),

  getTasksByStaff: (staffId) => get().cleaningTasks.filter(task => task.assignedToId === staffId),

  getTasksByRoom: (roomId) => get().cleaningTasks.filter(task => task.roomId === roomId),

  // Task Assignment
  assignTask: (taskId, staffId, staffName) => {
    get().updateCleaningTask(taskId, { 
      assignedToId: staffId, 
      assignedToName: staffName,
      status: 'pending'
    });
  },

  startTask: (taskId) => {
    get().updateCleaningTask(taskId, { 
      status: 'in-progress',
      startTime: new Date()
    });
  },

  completeTask: (taskId, qualityScore, notes) => {
    get().updateCleaningTask(taskId, { 
      status: 'completed',
      completedTime: new Date(),
      qualityScore,
      notes: notes || undefined
    });
    
    // Update room status to clean
    const task = get().getTask(taskId);
    if (task) {
      get().updateRoomStatus(task.roomId, 'clean');
    }
  },

  verifyTask: (taskId, supervisorId, supervisorName) => {
    get().updateCleaningTask(taskId, { 
      status: 'verified',
      supervisorId,
      supervisorName
    });
  },

  // Room Status Updates
  updateRoomStatus: (roomId, status) => {
    get().updateRoom(roomId, { status });
  },

  markRoomForCleaning: (roomId, cleaningType) => {
    get().updateRoom(roomId, { 
      status: 'dirty',
      cleaningType,
      nextCleaning: new Date(Date.now() + 2 * 60 * 60 * 1000) // 2 hours from now
    });
  },

  markRoomCleaned: (roomId) => {
    get().updateRoom(roomId, { 
      status: 'clean',
      lastCleaned: new Date(),
      nextCleaning: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours from now
    });
  },

  // Selection
  selectRoom: (room) => set({ selectedRoom: room }),

  selectTask: (task) => set({ selectedTask: task }),

  // Analytics
  getRoomOccupancyRate: () => {
    const state = get();
    const totalRooms = state.rooms.length;
    const occupiedRooms = state.rooms.filter(room => room.status === 'occupied').length;
    return totalRooms > 0 ? (occupiedRooms / totalRooms) * 100 : 0;
  },

  getCleaningEfficiency: () => {
    const state = get();
    const completedTasks = state.cleaningTasks.filter(task => task.status === 'completed');
    const totalTasks = state.cleaningTasks.length;
    
    if (completedTasks.length === 0) return { averageTime: 0, completionRate: 0 };
    
    const totalTime = completedTasks.reduce((sum, task) => {
      if (task.startTime && task.completedTime) {
        return sum + (task.completedTime.getTime() - task.startTime.getTime()) / (1000 * 60);
      }
      return sum;
    }, 0);
    
    const averageTime = totalTime / completedTasks.length;
    const completionRate = (completedTasks.length / totalTasks) * 100;
    
    return { averageTime, completionRate };
  },

  getPendingTasksCount: () => {
    return get().cleaningTasks.filter(task => task.status === 'pending').length;
  },

  getOverdueTasks: () => {
    const now = new Date();
    return get().cleaningTasks.filter(task => {
      if (task.status === 'pending' && task.startTime) {
        const timeDiff = now.getTime() - task.startTime.getTime();
        return timeDiff > 4 * 60 * 60 * 1000; // 4 hours overdue
      }
      return false;
    });
  }
}));
