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
  Table, 
  TableHeader, 
  TableColumn, 
  TableBody, 
  TableRow, 
  TableCell, 
  Chip, 
  Switch,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
  Tabs,
  Tab,
  Textarea,
  Tooltip,
  Badge
} from '@heroui/react';
import { useSettingsStore } from '../lib/settings/store';
import EventRateManagement from './EventRateManagement';
// Dynamic imports for PDF generation to avoid SSR issues
// import jsPDF from 'jspdf';
// import 'jspdf-autotable';

interface RoomType {
  id: string;
  name: string;
  baseRate: number;
  capacity: number;
  amenities: string[];
  isActive: boolean;
  category: string;
  description: string;
  images: string[];
  policies: {
    cancellation: string;
    deposit: boolean;
    smoking: boolean;
    pets: boolean;
  };
}

interface Room {
  id: string;
  number: string;
  typeId: string;
  floor: string;
  floorNumber?: number; // Optional since store data doesn't have it
  status: string;
  isActive: boolean;
  notes: string;
  features: string[];
  maintenance: {
    lastInspection: string;
    nextInspection: string;
    issues: string[];
  };
}

interface RatePlan {
  id: string;
  name: string;
  roomTypeId: string;
  basePrice: number;
  priceType?: 'subtotal' | 'gross_total'; // Optional since store data doesn't have it
  isActive: boolean;
  marketSegment: string;
  lastUpdated?: string; // Optional since store data doesn't have it
  restrictions: {
    minStay: number;
    maxStay: number;
    advanceBooking: number;
    cancellationPolicy: string;
  };
  seasonalRates: Array<{
    id: string;
    name: string;
    startDate: string;
    endDate: string;
    multiplier: number;
    description: string;
  }>;
  dayOfWeekRates: {
    monday: number;
    tuesday: number;
    wednesday: number;
    thursday: number;
    friday: number;
    saturday: number;
    sunday: number;
  };
}

interface Amenity {
  id: string;
  name: string;
  enabled: boolean;
  category: 'bedding' | 'bathroom' | 'furniture' | 'electronics' | 'supplies' | 'specialized' | 'luxury' | 'other' | 'disability';
}

export default function RoomConfigurationDashboard() {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [activeTab, setActiveTab] = useState('room-types');
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [selectedRoomType, setSelectedRoomType] = useState<RoomType | null>(null);
  const [editRoomTypeModalOpen, setEditRoomTypeModalOpen] = useState(false);
  const [editRoomModalOpen, setEditRoomModalOpen] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [isPdfLoading, setIsPdfLoading] = useState(false);
  const [isCsvLoading, setIsCsvLoading] = useState(false);
  
  // Amenities management state - LINK to selected room type
  const [selectedAmenitiesRoomTypeId, setSelectedAmenitiesRoomTypeId] = useState<string>('');

  // Seasonal rate modal state
  const [seasonalModalOpen, setSeasonalModalOpen] = useState(false);
  const [seasonalPlanId, setSeasonalPlanId] = useState<string>('');
  const [seasonalForm, setSeasonalForm] = useState({
    name: '',
    startDate: '',
    endDate: '',
    multiplier: 1,
    description: ''
  });
  
  // Sorting states
  const [roomsSortField, setRoomsSortField] = useState<string>('number');
  const [roomsSortDirection, setRoomsSortDirection] = useState<'asc' | 'desc'>('asc');
  const [ratePlansSortField, setRatePlansSortField] = useState<string>('name');
  const [ratePlansSortDirection, setRatePlansSortDirection] = useState<'asc' | 'desc'>('asc');
  
  // Visual display state
  const [visualDisplayExpanded, setVisualDisplayExpanded] = useState(false);
  
  const settingsStore = useSettingsStore();
  
  // Form states
  const [newRoomType, setNewRoomType] = useState({
    name: '',
    capacity: '1', // Keep as string for input compatibility
    description: ''
  });
  
  const [editRoomType, setEditRoomType] = useState({
    name: '',
    capacity: '1', // Keep as string for input compatibility
    description: ''
  });
  
  const [newRoom, setNewRoom] = useState({
    roomNumber: '',
    type: '',
    floor: '1',
    floorNumber: '1' // Keep as string for input compatibility
  });
  
  const [editRoom, setEditRoom] = useState({
    roomNumber: '',
    type: '',
    floor: '1',
    floorNumber: '1', // Keep as string for input compatibility
    status: 'available'
  });
  
  const [newRatePlan, setNewRatePlan] = useState<{
    name: string;
    roomType: string;
    price: string;
    priceType: 'subtotal' | 'gross_total';
    description: string;
  }>({
    name: '',
    roomType: '',
    price: '0', // Keep as string for input compatibility
    priceType: 'subtotal',
    description: ''
  });
  
  const [bulkRoomData, setBulkRoomData] = useState({
    roomType: '',
    building: '',
    floor: '1',
    floorNumber: '1', // Keep as string for input compatibility
    roomsOnFloor: '1', // Keep as string for input compatibility
    startRoomNumber: '1', // Keep as string for input compatibility
    prefix: '',
    suffix: ''
  });

  // Edit rate plan modal state
  const [editRatePlanModalOpen, setEditRatePlanModalOpen] = useState(false);
  const [selectedRatePlan, setSelectedRatePlan] = useState<RatePlan | null>(null);
  const [editRatePlanForm, setEditRatePlanForm] = useState({
    name: '',
    roomType: '',
    price: '0',
    currency: 'GHS' as 'USD' | 'GBP' | 'EUR' | 'GHS',
    priceType: 'subtotal' as 'subtotal' | 'gross_total',
    description: ''
  });

  // Enhanced logging function
  const logAction = (action: string, details: any) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ROOM_CONFIG: ${action}`, details);
    
    // In a real app, this would be sent to a logging service
    // For now, we'll use console.log as requested
  };

  // Initialize categorized amenities based on professional hotel standards
  const [amenities] = useState<Amenity[]>([
    // Bedding & Linens
    { id: '1', name: 'Bed Clothes (Bed Linens)', enabled: true, category: 'bedding' },
    { id: '2', name: 'Bed Sheets', enabled: true, category: 'bedding' },
    { id: '3', name: 'Pillows', enabled: true, category: 'bedding' },
    { id: '4', name: 'Duvets / Comforters', enabled: true, category: 'bedding' },
    { id: '5', name: 'Mattress Protectors', enabled: true, category: 'bedding' },
    { id: '6', name: 'Pillow Protectors', enabled: true, category: 'bedding' },
    
    // Bathroom Amenities
    { id: '7', name: 'Dispensers (Soap, Shampoo, Lotion)', enabled: true, category: 'bathroom' },
    { id: '8', name: 'Sani Dispenser', enabled: true, category: 'bathroom' },
    { id: '9', name: 'Shoe Mitt', enabled: true, category: 'bathroom' },
    { id: '10', name: 'Shoe Horn', enabled: true, category: 'bathroom' },
    { id: '11', name: 'Door Hanger', enabled: true, category: 'bathroom' },
    { id: '12', name: 'Clothes Line', enabled: true, category: 'bathroom' },
    { id: '13', name: 'Gown (Bathrobe)', enabled: false, category: 'bathroom' },
    { id: '14', name: 'Slippers', enabled: false, category: 'bathroom' },
    { id: '15', name: 'Laundry Bag', enabled: true, category: 'bathroom' },
    { id: '16', name: 'Dustbins (Trash Cans)', enabled: true, category: 'bathroom' },
    
    // Furniture & Storage
    { id: '17', name: 'Luggage Rack', enabled: true, category: 'furniture' },
    { id: '18', name: 'Wooden Hangers', enabled: true, category: 'furniture' },
    { id: '19', name: 'Clothes Brush', enabled: true, category: 'furniture' },
    { id: '20', name: 'Trouser Press', enabled: false, category: 'furniture' },
    { id: '21', name: 'Guest Amenity Tray', enabled: true, category: 'furniture' },
    { id: '22', name: 'Mirror', enabled: true, category: 'furniture' },
    { id: '23', name: 'Ironing Centre', enabled: true, category: 'furniture' },
    { id: '24', name: 'Drinking Glass & Cover', enabled: true, category: 'furniture' },
    
    // Electronics & Appliances
    { id: '25', name: 'Television', enabled: true, category: 'electronics' },
    { id: '26', name: 'Fridge (Mini-Bar)', enabled: true, category: 'electronics' },
    { id: '27', name: 'Air Conditioner', enabled: true, category: 'electronics' },
    { id: '28', name: 'Hair Dryer', enabled: true, category: 'electronics' },
    { id: '29', name: 'Internet Computer', enabled: false, category: 'electronics' },
    { id: '30', name: 'Internet (Wi-Fi)', enabled: true, category: 'electronics' },
    { id: '31', name: 'Telephone', enabled: true, category: 'electronics' },
    
    // Guest Supplies & Consumables
    { id: '32', name: 'Pens', enabled: true, category: 'supplies' },
    { id: '33', name: 'Notepads', enabled: true, category: 'supplies' },
    { id: '34', name: 'Drinking Glasses', enabled: true, category: 'supplies' },
    { id: '35', name: 'Coffee & Tea Making Facilities', enabled: true, category: 'supplies' },
    
    // Specialized Equipment
    { id: '36', name: 'Ozone Machine', enabled: false, category: 'specialized' },
    { id: '37', name: 'Portable Fans/Heaters', enabled: false, category: 'specialized' },
    { id: '38', name: 'Exchange Rate Boards', enabled: false, category: 'specialized' },
    { id: '39', name: 'Trolleys', enabled: false, category: 'specialized' },
    
    // Disability-Friendly Amenities
    { id: '40', name: 'Wheelchair Accessible Entrance', enabled: false, category: 'disability' },
    { id: '41', name: 'Wider Doorways (32" minimum)', enabled: false, category: 'disability' },
    { id: '42', name: 'Roll-in Shower', enabled: false, category: 'disability' },
    { id: '43', name: 'Grab Bars in Bathroom', enabled: false, category: 'disability' },
    { id: '44', name: 'Shower Seat/Bench', enabled: false, category: 'disability' },
    { id: '45', name: 'Lowered Sink & Countertops', enabled: false, category: 'disability' },
    { id: '46', name: 'Accessible Toilet (17-19" height)', enabled: false, category: 'disability' },
    { id: '47', name: 'Emergency Call Button', enabled: false, category: 'disability' },
    { id: '48', name: 'Visual Fire Alarm', enabled: false, category: 'disability' },
    { id: '49', name: 'TTY/TDD Phone', enabled: false, category: 'disability' },
    { id: '50', name: 'Closed Caption TV', enabled: false, category: 'disability' },
    { id: '51', name: 'Lowered Closet Rods', enabled: false, category: 'disability' },
    { id: '52', name: 'Accessible Light Switches', enabled: false, category: 'disability' },
    { id: '53', name: 'Braille Room Number Signs', enabled: false, category: 'disability' },
    { id: '54', name: 'Service Animal Welcome Kit', enabled: false, category: 'disability' },
    
    // Additional Luxury Amenities
    { id: '55', name: 'Fruits (Welcome Basket)', enabled: false, category: 'luxury' },
    { id: '56', name: 'Liquor (Mini-Bar Spirits)', enabled: false, category: 'luxury' },
    { id: '57', name: 'Specialty Toiletries', enabled: false, category: 'luxury' },
    { id: '58', name: 'Yoga Mat', enabled: false, category: 'luxury' },
    { id: '59', name: 'Safe', enabled: false, category: 'luxury' },
    
    // Other
    { id: '60', name: 'Other (Custom Amenities)', enabled: false, category: 'other' }
  ]);

  // Get amenities by category for organized display
  const getAmenitiesByCategory = (category: string) => {
    return amenities.filter(amenity => amenity.category === category);
  };

  // Get category display name
  const getCategoryDisplayName = (category: string) => {
    const categoryNames: { [key: string]: string } = {
      'bedding': 'Bedding & Linens',
      'bathroom': 'Bathroom Amenities',
      'furniture': 'Furniture & Storage',
      'electronics': 'Electronics & Appliances',
      'supplies': 'Guest Supplies & Consumables',
      'specialized': 'Specialized Equipment',
      'luxury': 'Luxury Amenities',
      'other': 'Other',
      'disability': 'Disability-Friendly Amenities'
    };
    return categoryNames[category] || category;
  };

  // Initialize selected room type for amenities tab
  useEffect(() => {
    if (!selectedAmenitiesRoomTypeId && settingsStore.roomManagement.roomTypes.length > 0) {
      setSelectedAmenitiesRoomTypeId(settingsStore.roomManagement.roomTypes[0].id);
    }
  }, [selectedAmenitiesRoomTypeId, settingsStore.roomManagement.roomTypes]);

  const getSelectedAmenitiesRoomType = () => {
    return settingsStore.roomManagement.roomTypes.find(rt => rt.id === selectedAmenitiesRoomTypeId);
  };

  const isAmenityEnabledForSelectedType = (amenityId: string) => {
    const rt = getSelectedAmenitiesRoomType();
    return rt ? rt.amenities.includes(amenityId) : false;
  };

  const handleAddRoomType = () => {
    if (newRoomType.name) {
             const roomType: RoomType = {
         id: Date.now().toString(),
         name: newRoomType.name,
         baseRate: 0, // Add default baseRate
         capacity: Number(newRoomType.capacity), // Convert string to number
         amenities: [],
         isActive: true,
         category: 'other',
         description: newRoomType.description || '',
         images: [],
         policies: {
           cancellation: 'Flexible',
           deposit: false,
           smoking: false,
           pets: false,
         }
       };
      
      settingsStore.addRoomType(roomType);
      logAction('ADD_ROOM_TYPE', { roomType });
      setNewRoomType({ name: '', capacity: '1', description: '' });
    }
  };

  const handleEditRoomType = (roomType: RoomType) => {
    setSelectedRoomType(roomType);
    setEditRoomType({
      name: roomType.name,
      capacity: roomType.capacity.toString(), // Convert number to string for form
      description: roomType.description || ''
    });
    setEditRoomTypeModalOpen(true);
    logAction('EDIT_ROOM_TYPE_OPEN', { roomType });
  };

  const handleUpdateRoomType = () => {
    if (selectedRoomType && editRoomType.name) {
      const updates = {
        name: editRoomType.name,
        capacity: Number(editRoomType.capacity), // Convert string to number
        description: editRoomType.description
      };
      
      settingsStore.updateRoomType(selectedRoomType.id, updates);
      logAction('UPDATE_ROOM_TYPE', { roomTypeId: selectedRoomType.id, updates });
      setEditRoomTypeModalOpen(false);
      setSelectedRoomType(null);
    }
  };

  const handleDeleteRoomType = (roomType: RoomType) => {
    if (confirm(`Are you sure you want to delete "${roomType.name}"? This will also remove all rooms of this type.`)) {
      // First delete all rooms of this type
      const roomsToDelete = settingsStore.roomManagement.rooms.filter(room => room.typeId === roomType.id);
      roomsToDelete.forEach(room => {
        settingsStore.deleteRoom(room.id);
        logAction('DELETE_ROOM', { roomId: room.id, roomNumber: room.number });
      });
      
      // Then delete the room type
      settingsStore.deleteRoomType(roomType.id);
      logAction('DELETE_ROOM_TYPE', { roomType });
    }
  };

    const handleAddRoom = () => {
    if (newRoom.roomNumber && newRoom.type) {
      // Check for duplicate room number
      if (isRoomNumberDuplicate(newRoom.roomNumber)) {
        alert(`Room number "${newRoom.roomNumber}" already exists. Please use a unique room number.`);
        logAction('DUPLICATE_ROOM_NUMBER_ATTEMPT', { 
          attemptedNumber: newRoom.roomNumber
        });
        return;
      }

      const room: Room = {
        id: Date.now().toString(),
        number: newRoom.roomNumber,
        typeId: newRoom.type, // This should be the room type ID
        floor: newRoom.floor.toString(),
        floorNumber: Number(newRoom.floorNumber), // Convert string to number
        status: 'available',
        isActive: true,
        notes: '',
        features: [],
        maintenance: {
          lastInspection: '',
          nextInspection: '',
          issues: [],
        }
      };
      
      console.log('Creating room with typeId:', newRoom.type); // Debug log
      settingsStore.addRoom(room);
      logAction('ADD_ROOM', { room });
      setNewRoom({ roomNumber: '', type: '', floor: '1', floorNumber: '1' });
    }
  };

  const handleEditRoom = (room: Room) => {
    setSelectedRoom(room);
         setEditRoom({
       roomNumber: room.number,
       type: room.typeId,
       floor: room.floor || '1',
       floorNumber: (room.floorNumber || parseInt(room.floor) || 0).toString(), // Convert number to string for form
       status: room.status
     });
    setEditRoomModalOpen(true);
    logAction('EDIT_ROOM_OPEN', { room });
  };

    const handleUpdateRoom = () => {
    if (selectedRoom && editRoom.roomNumber && editRoom.type) {
      // Check for duplicate room number (excluding the current room being edited)
      if (isRoomNumberDuplicate(editRoom.roomNumber, selectedRoom.id)) {
        alert(`Room number "${editRoom.roomNumber}" already exists. Please use a unique room number.`);
        logAction('UPDATE_DUPLICATE_ROOM_NUMBER_ATTEMPT', { 
          attemptedNumber: editRoom.roomNumber,
          updatingRoomId: selectedRoom.id
        });
        return;
      }

      const updates = {
        number: editRoom.roomNumber,
        typeId: editRoom.type,
        floor: editRoom.floor.toString(),
        floorNumber: Number(editRoom.floorNumber), // Convert string to number
        status: editRoom.status
      };
      
      settingsStore.updateRoom(selectedRoom.id, updates);
      logAction('UPDATE_ROOM', { roomId: selectedRoom.id, updates });
      setEditRoomModalOpen(false);
      setSelectedRoom(null);
    }
  };

  const handleDeleteRoom = (room: Room) => {
    if (confirm(`Are you sure you want to delete room "${room.number}"?`)) {
      settingsStore.deleteRoom(room.id);
      logAction('DELETE_ROOM', { roomId: room.id, roomNumber: room.number });
    }
  };

  const handleToggleRoomActive = (room: Room) => {
    const newActiveState = !room.isActive;
    const action = newActiveState ? 'activate' : 'deactivate';
    
    if (confirm(`Are you sure you want to ${action} room "${room.number}"?`)) {
      settingsStore.updateRoom(room.id, { isActive: newActiveState });
      logAction('TOGGLE_ROOM_ACTIVE', { 
        roomId: room.id, 
        roomNumber: room.number, 
        newState: newActiveState 
      });
    }
  };

  // Smart workflow integration: Auto-deactivate rooms in maintenance
  const handleRoomStatusChange = (room: Room, newStatus: string) => {
    const updates: any = { status: newStatus };
    
    // Smart defaults: Auto-deactivate rooms in maintenance
    if (newStatus === 'maintenance') {
      updates.isActive = false;
      logAction('AUTO_DEACTIVATE_MAINTENANCE', { 
        roomId: room.id, 
        roomNumber: room.number,
        reason: 'Status changed to maintenance'
      });
    }
    
    // Auto-reactivate when returning to available status
    if (newStatus === 'available' && !room.isActive) {
      updates.isActive = true;
      logAction('AUTO_REACTIVATE_AVAILABLE', { 
        roomId: room.id, 
        roomNumber: room.number,
        reason: 'Status returned to available'
      });
    }
    
    settingsStore.updateRoom(room.id, updates);
    logAction('UPDATE_ROOM_STATUS', { 
      roomId: room.id, 
      roomNumber: room.number, 
      oldStatus: room.status, 
      newStatus: newStatus,
      autoActiveChange: updates.isActive !== undefined
    });
  };

  // Bulk operations for seasonal management
  const handleBulkRoomStatusChange = (criteria: {
    roomTypes?: string[];
    floors?: number[];
    status?: string;
    isActive?: boolean;
  }, newStatus: string, newActiveState?: boolean) => {
    const roomsToUpdate = settingsStore.roomManagement.rooms.filter(room => {
      if (criteria.roomTypes && !criteria.roomTypes.includes(room.typeId)) return false;
      if (criteria.floors && !criteria.floors.includes(Number(room.floor))) return false;
      if (criteria.status && room.status !== criteria.status) return false;
      if (criteria.isActive !== undefined && room.isActive !== criteria.isActive) return false;
      return true;
    });

    if (roomsToUpdate.length === 0) {
      alert('No rooms match the selected criteria.');
      return;
    }

    const action = `update ${roomsToUpdate.length} rooms`;
    if (confirm(`Are you sure you want to ${action}?\n\nThis will affect:\n${roomsToUpdate.map(r => `• ${r.number} (${getRoomTypeName(r.typeId)})`).join('\n')}`)) {
      roomsToUpdate.forEach(room => {
        const updates: any = { status: newStatus };
        if (newActiveState !== undefined) {
          updates.isActive = newActiveState;
        }
        
        // Apply smart defaults
        if (newStatus === 'maintenance') {
          updates.isActive = false;
        } else if (newStatus === 'available' && !room.isActive) {
          updates.isActive = true;
        }
        
        settingsStore.updateRoom(room.id, updates);
      });

      logAction('BULK_ROOM_UPDATE', { 
        totalRooms: roomsToUpdate.length,
        criteria,
        newStatus,
        newActiveState,
        affectedRooms: roomsToUpdate.map(r => ({ id: r.id, number: r.number }))
      });

      alert(`Successfully updated ${roomsToUpdate.length} rooms.`);
    }
  };

  const handleAddRatePlan = () => {
    if (newRatePlan.name && newRatePlan.roomType && Number(newRatePlan.price) > 0) {
      const ratePlan: RatePlan = {
        id: Date.now().toString(),
        name: newRatePlan.name,
        roomTypeId: newRatePlan.roomType,
        basePrice: Number(newRatePlan.price), // Convert string to number
        priceType: newRatePlan.priceType,
                 isActive: true,
         marketSegment: 'General',
         lastUpdated: new Date().toISOString(),
         restrictions: {
          minStay: 1,
          maxStay: 30,
          advanceBooking: 30,
          cancellationPolicy: 'Flexible',
        },
        seasonalRates: [],
        dayOfWeekRates: {
          monday: 0,
          tuesday: 0,
          wednesday: 0,
          thursday: 0,
          friday: 0,
          saturday: 0,
          sunday: 0,
        }
      };
      
      settingsStore.addRatePlan(ratePlan);
      logAction('ADD_RATE_PLAN', { ratePlan });
      setNewRatePlan({ name: '', roomType: '', price: '0', priceType: 'subtotal', description: '' });
    }
  };

  const handleBulkAddRooms = () => {
    if (bulkRoomData.roomType && Number(bulkRoomData.roomsOnFloor) > 0) {
      const rooms: Room[] = [];
      
      console.log('Bulk creating rooms with typeId:', bulkRoomData.roomType, 'Building:', bulkRoomData.building, 'Floor:', bulkRoomData.floor);
      
                          for (let roomNum = 1; roomNum <= Number(bulkRoomData.roomsOnFloor); roomNum++) {
        const roomNumber = `${bulkRoomData.prefix}${bulkRoomData.building || ''}${bulkRoomData.floor || ''}${String(Number(bulkRoomData.startRoomNumber) + roomNum - 1).padStart(2, '0')}${bulkRoomData.suffix}`;
        
        // Check for duplicate room number
        if (isRoomNumberDuplicate(roomNumber)) {
          alert(`Room number "${roomNumber}" already exists. Please adjust your bulk room settings to avoid conflicts.`);
          logAction('BULK_DUPLICATE_ROOM_NUMBER_ATTEMPT', { 
            attemptedNumber: roomNumber,
            bulkSettings: bulkRoomData 
          });
          return;
        }
        
        rooms.push({
          id: Date.now().toString() + Math.random(),
          number: roomNumber,
          typeId: bulkRoomData.roomType,
          floor: bulkRoomData.floor || '1',
          floorNumber: Number(bulkRoomData.floorNumber), // Convert string to number
          status: 'available',
          isActive: true,
          notes: '',
          features: [],
          maintenance: {
            lastInspection: '',
            nextInspection: '',
            issues: [],
          }
        });
      }
      
      rooms.forEach(room => {
        settingsStore.addRoom(room);
        logAction('BULK_ADD_ROOM', { room });
      });
      
             logAction('BULK_ADD_ROOMS_COMPLETE', { 
         totalRooms: rooms.length, 
         building: bulkRoomData.building,
         floor: bulkRoomData.floor,
         floorNumber: Number(bulkRoomData.floorNumber), // Convert string to number
         roomsOnFloor: Number(bulkRoomData.roomsOnFloor), // Convert string to number
         startRoomNumber: Number(bulkRoomData.startRoomNumber) // Convert string to number
       });
      
      setBulkModalOpen(false);
      setBulkRoomData({ 
        roomType: '', 
        building: '',
        floor: '1', 
        floorNumber: '1',
        roomsOnFloor: '1', 
        startRoomNumber: '1',
        prefix: '',
        suffix: ''
      });
    }
  };

  const toggleAmenity = (amenityId: string) => {
    if (!selectedAmenitiesRoomTypeId) {
      alert('Please select a room type to manage its amenities.');
      return;
    }
    const currentType = settingsStore.roomManagement.roomTypes.find(rt => rt.id === selectedAmenitiesRoomTypeId);
    if (!currentType) return;

    const currentlyEnabled = currentType.amenities.includes(amenityId);
    const updatedAmenities = currentlyEnabled
      ? currentType.amenities.filter(id => id !== amenityId)
      : [...currentType.amenities, amenityId];

    settingsStore.updateRoomType(currentType.id, { amenities: updatedAmenities });
    logAction('TOGGLE_AMENITY_FOR_ROOM_TYPE', { amenityId, roomTypeId: currentType.id, enabled: !currentlyEnabled });
  };

  const getTotalRooms = () => {
    return Number(bulkRoomData.roomsOnFloor);
  };

  const getRoomCountByType = (typeId: string) => {
    return settingsStore.roomManagement.rooms.filter(room => room.typeId === typeId).length;
  };

  const getAvailableRoomCountByType = (typeId: string) => {
    return settingsStore.roomManagement.rooms.filter(room => 
      room.typeId === typeId && room.status === 'available'
    ).length;
  };

  const getRoomTypeName = (typeId: string) => {
    const roomType = settingsStore.roomManagement.roomTypes.find(rt => rt.id === typeId);
    return roomType ? roomType.name : typeId;
  };

  // Data transformation helpers to convert store data to expected interface format
  const transformRoomData = (room: any): Room => ({
    id: room.id,
    number: room.number,
    typeId: room.typeId,
    floor: room.floor,
    floorNumber: room.floorNumber || parseInt(room.floor) || 0,
    status: room.status,
    isActive: room.isActive,
    notes: room.notes || '',
    features: room.features || [],
    maintenance: {
      lastInspection: room.maintenance?.lastInspection || '',
      nextInspection: room.maintenance?.nextInspection || '',
      issues: room.maintenance?.issues || []
    }
  });

  const transformRatePlanData = (plan: any): RatePlan => ({
    id: plan.id,
    name: plan.name,
    roomTypeId: plan.roomTypeId,
    basePrice: plan.basePrice,
    priceType: plan.priceType || 'subtotal',
    isActive: plan.isActive,
    marketSegment: plan.marketSegment || 'standard',
    lastUpdated: plan.lastUpdated || new Date().toISOString(),
    restrictions: plan.restrictions || {
      minStay: 1,
      maxStay: 30,
      advanceBooking: 0,
      cancellationPolicy: 'Flexible'
    },
    seasonalRates: plan.seasonalRates || [],
    dayOfWeekRates: plan.dayOfWeekRates || {
      monday: 1,
      tuesday: 1,
      wednesday: 1,
      thursday: 1,
      friday: 1,
      saturday: 1,
      sunday: 1
    }
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available': return 'success';
      case 'occupied': return 'warning';
      case 'maintenance': return 'danger';
      case 'cleaning': return 'primary';
      default: return 'default';
    }
  };

  // Sorting functions
  const handleRoomsSort = (field: string) => {
    if (roomsSortField === field) {
      setRoomsSortDirection(roomsSortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setRoomsSortField(field);
      setRoomsSortDirection('asc');
    }
  };

  const handleRatePlansSort = (field: string) => {
    if (ratePlansSortField === field) {
      setRatePlansSortDirection(ratePlansSortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setRatePlansSortField(field);
      setRatePlansSortDirection('asc');
    }
  };

  const getSortedRooms = () => {
    const rooms = settingsStore.roomManagement.rooms.map(transformRoomData);
    return rooms.sort((a: Room, b: Room) => {
      let aValue: any, bValue: any;
      
      switch (roomsSortField) {
        case 'number':
          aValue = a.number;
          bValue = b.number;
          break;
        case 'type':
          aValue = getRoomTypeName(a.typeId);
          bValue = getRoomTypeName(b.typeId);
          break;
        case 'floor':
          aValue = a.floorNumber;
          bValue = b.floorNumber;
          break;
        case 'status':
          aValue = a.status;
          bValue = b.status;
          break;
        case 'isActive':
          aValue = a.isActive;
          bValue = b.isActive;
          break;
        default:
          aValue = a.number;
          bValue = b.number;
      }
      
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return roomsSortDirection === 'asc' 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      } else {
        return roomsSortDirection === 'asc' 
          ? (aValue > bValue ? 1 : -1)
          : (aValue < bValue ? -1 : 1);
      }
    });
  };

  const getSortedRatePlans = () => {
    const ratePlans = settingsStore.roomManagement.ratePlans.map(transformRatePlanData);
    return ratePlans.sort((a: RatePlan, b: RatePlan) => {
      let aValue: any, bValue: any;
      
      switch (ratePlansSortField) {
        case 'name':
          aValue = a.name;
          bValue = b.name;
          break;
        case 'roomType':
          aValue = getRoomTypeName(a.roomTypeId);
          bValue = getRoomTypeName(b.roomTypeId);
          break;
        case 'price':
          aValue = a.basePrice;
          bValue = b.basePrice;
          break;
        case 'priceType':
          aValue = a.priceType;
          bValue = b.priceType;
          break;
        case 'lastUpdated':
          aValue = new Date(a.lastUpdated || new Date().toISOString()).getTime();
          bValue = new Date(b.lastUpdated || new Date().toISOString()).getTime();
          break;
        default:
          aValue = a.name;
          bValue = b.name;
      }
      
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return ratePlansSortDirection === 'asc' 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      } else {
        return ratePlansSortDirection === 'asc' 
          ? (aValue > bValue ? 1 : -1)
          : (aValue < bValue ? -1 : 1);
      }
    });
  };

  const getSortIcon = (field: string, currentField: string, direction: 'asc' | 'desc') => {
    if (currentField !== field) return '↕️';
    return direction === 'asc' ? '↑' : '↓';
  };

  // Price preview helpers (Ghana taxes)
  const computeTaxBreakdown = (base: number) => {
    const subtotal = base;
    const nhil = subtotal * 0.025;
    const getfund = subtotal * 0.025;
    const covid = subtotal * 0.01;
    const vat = (subtotal + nhil + getfund + covid) * 0.15;
    const tourism = subtotal * 0.01;
    const totalTax = nhil + getfund + covid + vat + tourism;
    const finalBill = subtotal + totalTax;
    return { subtotal, nhil, getfund, covid, vat, tourism, totalTax, finalBill };
  };

  // Ghana hotel taxes effective gross factor: 2.5% NHIL + 2.5% GETFund + 1% COVID on base,
  // VAT 15% applied on (base + levies), plus 1% Tourism on base ⇒ overall multiplier ≈ 1.229
  const GHANA_GROSS_FACTOR = 1.229;
  const reverseToSubtotalFromGross = (gross: number) => {
    return gross / GHANA_GROSS_FACTOR;
  };

  const getLivePreview = () => {
    if (!newRatePlan.price || Number(newRatePlan.price) <= 0) return null;
    const baseForCalc = newRatePlan.priceType === 'subtotal' 
      ? Number(newRatePlan.price)
      : reverseToSubtotalFromGross(Number(newRatePlan.price));
    return computeTaxBreakdown(baseForCalc);
  };

  const handleDownloadCSV = () => {
    if (settingsStore.roomManagement.rooms.length === 0) return;
    
    setIsCsvLoading(true);
    try {
      const headers = ['Room Number', 'Type', 'Floor', 'Status', 'Notes', 'Features', 'Last Inspection', 'Next Inspection', 'Issues'];
      const data = settingsStore.roomManagement.rooms.map(room => {
        const transformedRoom = transformRoomData(room);
        return [
          transformedRoom.number,
          getRoomTypeName(transformedRoom.typeId),
          transformedRoom.floorNumber === 0 ? 'Ground Floor' : `Floor ${transformedRoom.floorNumber}`,
          transformedRoom.status,
          transformedRoom.notes,
          transformedRoom.features.join(', '),
          transformedRoom.maintenance.lastInspection,
          transformedRoom.maintenance.nextInspection,
          transformedRoom.maintenance.issues.join(', ')
        ];
      });
      
      // Create CSV content
      const csvContent = [
        headers.join(','),
        ...data.map(row => row.map((cell: any) => `"${cell}"`).join(','))
      ].join('\n');
      
      // Create and download CSV file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', 'rooms.csv');
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      logAction('DOWNLOAD_CSV', { totalRooms: settingsStore.roomManagement.rooms.length });
    } catch (error) {
      console.error('Error generating CSV:', error);
      alert('Error generating CSV. Please try again.');
    } finally {
      setIsCsvLoading(false);
    }
  };

  const handleDownloadPDF = async () => {
    setIsPdfLoading(true);
    try {
      // Dynamic import to avoid SSR issues
      const jsPDF = (await import('jspdf')).default;
      const autoTable = (await import('jspdf-autotable')).default;
      
      const data = settingsStore.roomManagement.rooms.map(room => {
        const transformedRoom = transformRoomData(room);
        return [
          transformedRoom.number,
          getRoomTypeName(transformedRoom.typeId),
          transformedRoom.floorNumber === 0 ? 'Ground Floor' : `Floor ${transformedRoom.floorNumber}`,
          transformedRoom.status,
          transformedRoom.notes,
          transformedRoom.features.join(', '),
          transformedRoom.maintenance.lastInspection,
          transformedRoom.maintenance.nextInspection,
          transformedRoom.maintenance.issues.join(', ')
        ];
      });
      
      const headers = ['Room Number', 'Type', 'Floor', 'Status', 'Notes', 'Features', 'Last Inspection', 'Next Inspection', 'Issues'];
      
      const doc = new jsPDF();
      (autoTable as any)(doc, { 
        head: [headers], 
        body: data,
        startY: 20,
        styles: {
          fontSize: 8,
          cellPadding: 2
        },
        headStyles: {
          fillColor: [41, 128, 185],
          textColor: 255
        }
      });
      
      doc.save('rooms.pdf');
      logAction('DOWNLOAD_PDF', { totalRooms: settingsStore.roomManagement.rooms.length });
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Error generating PDF. Please try again.');
    } finally {
      setIsPdfLoading(false);
    }
  };

  // Enhanced Rate Plans CSV download with seasonal pricing
  const handleDownloadRatePlansCSV = () => {
    if (settingsStore.roomManagement.ratePlans.length === 0) return;
    
    setIsCsvLoading(true);
    try {
      // Main rate plans data
      const mainData = settingsStore.roomManagement.ratePlans.map(plan => {
        const transformedPlan = transformRatePlanData(plan);
        // Calculate tax breakdown for CSV export
        const subtotal = transformedPlan.priceType === 'subtotal' ? transformedPlan.basePrice : transformedPlan.basePrice / GHANA_GROSS_FACTOR;
        const nhil = subtotal * 0.025; // 2.5%
        const getfund = subtotal * 0.025; // 2.5%
        const covid = subtotal * 0.01; // 1.0%
        const vat = (subtotal + nhil + getfund + covid) * 0.15; // 15% on amount after levies
        const tourism = subtotal * 0.01; // 1.0%
        const totalTax = nhil + getfund + covid + vat + tourism;
        const finalBill = subtotal + totalTax;
        
        return [
          transformedPlan.name,
          getRoomTypeName(transformedPlan.roomTypeId),
          `₵${transformedPlan.basePrice.toFixed(2)}`,
          `₵${finalBill.toFixed(2)}`,
          transformedPlan.priceType === 'subtotal' ? 'Subtotal' : 'Gross Total',
          transformedPlan.seasonalRates.length > 0 ? `${transformedPlan.seasonalRates.length} seasonal periods` : 'No seasonal rates',
          new Date(transformedPlan.lastUpdated || new Date().toISOString()).toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          }),
          transformedPlan.isActive ? 'Active' : 'Inactive'
        ];
      });
      
      const mainHeaders = ['Rate Plan', 'Room Type', 'Subtotal', 'Final Bill (Tax Inclusive)', 'Price Type', 'Seasonal Rates', 'Last Updated', 'Status'];
      
      // Seasonal rates detailed data
      const seasonalData: any[] = [];
      settingsStore.roomManagement.ratePlans.forEach(plan => {
        const transformedPlan = transformRatePlanData(plan);
        if (transformedPlan.seasonalRates.length > 0) {
          transformedPlan.seasonalRates.forEach(seasonal => {
            seasonalData.push([
              transformedPlan.name,
              seasonal.name,
              new Date(seasonal.startDate).toLocaleDateString('en-GB'),
              new Date(seasonal.endDate).toLocaleDateString('en-GB'),
              seasonal.multiplier,
              seasonal.description || ''
            ]);
          });
        }
      });
      
      const seasonalHeaders = ['Rate Plan', 'Season Name', 'Start Date', 'End Date', 'Multiplier', 'Description'];
      
      // Combine all data
      const csvContent = [
        '=== MAIN RATE PLANS ===',
        mainHeaders.join(','),
        ...mainData.map(row => row.map(cell => `"${cell}"`).join(','))
      ];
      
      if (seasonalData.length > 0) {
        csvContent.push(
          '',
          '=== SEASONAL RATES DETAILS ===',
          seasonalHeaders.join(','),
          ...seasonalData.map(row => row.map((cell: any) => `"${cell}"`).join(','))
        );
      }
      
      const blob = new Blob([csvContent.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', 'rate-plans-comprehensive.csv');
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      logAction('DOWNLOAD_RATE_PLANS_CSV', { totalPlans: settingsStore.roomManagement.ratePlans.length, includesSeasonal: seasonalData.length > 0 });
    } catch (error) {
      console.error('Error generating Rate Plans CSV:', error);
      alert('Error generating CSV. Please try again.');
    } finally {
      setIsCsvLoading(false);
    }
  };

  // Basic Rate Plans CSV download (simple format)
  const handleDownloadBasicRatePlansCSV = () => {
    if (settingsStore.roomManagement.ratePlans.length === 0) return;
    
    try {
      const data = settingsStore.roomManagement.ratePlans.map(plan => {
        const transformedPlan = transformRatePlanData(plan);
        return [
          transformedPlan.name,
          getRoomTypeName(transformedPlan.roomTypeId),
          `₵${transformedPlan.basePrice}`,
          transformedPlan.priceType === 'subtotal' ? 'Subtotal' : 'Gross Total',
          new Date(transformedPlan.lastUpdated || new Date().toISOString()).toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          }),
          transformedPlan.isActive ? 'Active' : 'Inactive'
        ];
      });
      
      const headers = ['Name', 'Room Type', 'Base Price', 'Price Type', 'Last Updated', 'Status'];
      const csvContent = [
        headers.join(','),
        ...data.map(row => row.map((cell: any) => `"${cell}"`).join(','))
      ].join('\n');
      
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', 'rate-plans-basic.csv');
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      logAction('DOWNLOAD_BASIC_RATE_PLANS_CSV', { totalPlans: settingsStore.roomManagement.ratePlans.length });
    } catch (error) {
      console.error('Error generating Basic Rate Plans CSV:', error);
      alert('Error generating CSV. Please try again.');
    }
  };

  // Enhanced Rate Plans PDF download with seasonal pricing
  const handleDownloadRatePlansPDF = async () => {
    setIsPdfLoading(true);
    try {
      const jsPDF = (await import('jspdf')).default;
      const autoTable = (await import('jspdf-autotable')).default;
      
      const data = settingsStore.roomManagement.ratePlans.map(plan => {
        const transformedPlan = transformRatePlanData(plan);
        const roomType = getRoomTypeName(transformedPlan.roomTypeId);
        const seasonalInfo = transformedPlan.seasonalRates.length > 0 
          ? `${transformedPlan.seasonalRates.length} seasonal periods`
          : 'No seasonal rates';
        
        return [
          transformedPlan.name,
          roomType,
          `₵${transformedPlan.basePrice}`,
          transformedPlan.priceType === 'subtotal' ? 'Subtotal' : 'Gross Total',
          seasonalInfo,
          new Date(transformedPlan.lastUpdated || new Date().toISOString()).toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
          }),
          transformedPlan.isActive ? 'Active' : 'Inactive'
        ];
      });
      
      const headers = ['Rate Plan', 'Room Type', 'Base Price', 'Price Type', 'Seasonal Rates', 'Last Updated', 'Status'];
      
      const doc = new jsPDF();
      (autoTable as any)(doc, { 
        head: [headers], 
        body: data,
        startY: 20,
        styles: {
          fontSize: 8,
          cellPadding: 2
        },
        headStyles: {
          fillColor: [41, 128, 185],
          textColor: 255
        }
      });
      
      // Add seasonal rates details on a new page if any exist
      const plansWithSeasonalRates = settingsStore.roomManagement.ratePlans.filter(plan => plan.seasonalRates.length > 0);
      if (plansWithSeasonalRates.length > 0) {
        (doc as any).addPage();
        (doc as any).text('Seasonal Rates Details', 20, 20);
        
        const seasonalData: any[] = [];
        plansWithSeasonalRates.forEach(plan => {
          const transformedPlan = transformRatePlanData(plan);
          transformedPlan.seasonalRates.forEach(seasonal => {
            seasonalData.push([
              transformedPlan.name,
              seasonal.name,
              new Date(seasonal.startDate).toLocaleDateString('en-GB'),
              new Date(seasonal.endDate).toLocaleDateString('en-GB'),
              `${seasonal.multiplier}x`,
              seasonal.description || ''
            ]);
          });
        });
        
        const seasonalHeaders = ['Rate Plan', 'Season Name', 'Start Date', 'End Date', 'Multiplier', 'Description'];
        (autoTable as any)(doc, { 
          head: [seasonalHeaders], 
          body: seasonalData,
          startY: 30,
          styles: {
            fontSize: 8,
            cellPadding: 2
          },
          headStyles: {
            fillColor: [255, 165, 0],
            fixedTextColor: 0
          }
        });
      }
      
      doc.save('rate-plans-comprehensive.pdf');
      logAction('DOWNLOAD_RATE_PLANS_PDF', { totalPlans: settingsStore.roomManagement.ratePlans.length });
    } catch (error) {
      console.error('Error generating Rate Plans PDF:', error);
      alert('Error generating PDF. Please try again.');
    } finally {
      setIsPdfLoading(false);
    }
  };

  // Tax Calculation Preview
  const [selectedTaxPreviewPlan, setSelectedTaxPreviewPlan] = useState<string | null>(null);

  // Seasonal Rates Management
  const [selectedSeasonalPlan, setSelectedSeasonalPlan] = useState<string | null>(null);

  // Currency configuration
  const CURRENCIES = {
    USD: { symbol: '$', name: 'US Dollar', taxRates: { vat: 0, nhil: 0, covid: 0, tourism: 0 } },
    GBP: { symbol: '£', name: 'British Pound', taxRates: { vat: 0.20, nhil: 0, covid: 0, tourism: 0 } },
    EUR: { symbol: '€', name: 'Euro', taxRates: { vat: 0.21, nhil: 0, covid: 0, tourism: 0 } },
    GHS: { symbol: '₵', name: 'Ghanaian Cedi', taxRates: { vat: 0.15, nhil: 0.025, covid: 0.01, tourism: 0.01 } }
  };

  // Get currency symbol for display
  const getCurrencySymbol = (currency: string) => {
    return CURRENCIES[currency as keyof typeof CURRENCIES]?.symbol || currency;
  };

  // Get currency name for display
  const getCurrencyName = (currency: string) => {
    return CURRENCIES[currency as keyof typeof CURRENCIES]?.name || currency;
  };

  // Helper function to check for duplicate room numbers
  const isRoomNumberDuplicate = (roomNumber: string, excludeRoomId?: string): boolean => {
    return settingsStore.roomManagement.rooms.some(
      room => room.number === roomNumber && room.id !== excludeRoomId
    );
  };

  // Real-time room number validation
  const getRoomNumberValidationStatus = (roomNumber: string, excludeRoomId?: string) => {
    if (!roomNumber) return { isValid: false, message: '', color: 'default' };
    
    if (isRoomNumberDuplicate(roomNumber, excludeRoomId)) {
      return { 
        isValid: false, 
        message: 'Room number already exists', 
        color: 'danger' 
      };
    }
    
    if (roomNumber.length < 1) {
      return { 
        isValid: false, 
        message: 'Room number is too short', 
        color: 'warning' 
      };
    }
    
    return { 
      isValid: true, 
      message: 'Room number available', 
      color: 'success' 
    };
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-ghana-black">🏠 Room Configuration</h1>
          <p className="text-gray-600">Manage room types, amenities, and pricing</p>
        </div>
        <div className="flex gap-3">
          <Button 
            color="primary" 
            variant="flat"
            onClick={() => setActiveTab('event-rates')}
            className="bg-purple-600 text-white hover:bg-purple-700"
          >
            🎯 Event Rates
          </Button>
          <Button 
            color="primary" 
            variant="flat"
            onClick={() => setBulkModalOpen(true)}
          >
            Bulk Add Rooms
          </Button>
        </div>
      </div>

      <Tabs 
        selectedKey={activeTab} 
        onSelectionChange={(key) => setActiveTab(key as string)}
        className="w-full"
      >
        <Tab key="room-types" title="Room Types & Categories">
                     <Card className="mb-6">
             <CardHeader>
               <h3 className="text-xl font-semibold">Add New Room Type</h3>
               <p className="text-sm text-gray-600">Pricing is managed through Rate Plans in the Rate Plans tab</p>
             </CardHeader>
             <CardBody>
               <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                 <Input
                   label="Room Type Name"
                   placeholder="e.g., Standard, Deluxe"
                   value={newRoomType.name}
                   onChange={(e) => setNewRoomType({...newRoomType, name: e.target.value})}
                 />
                 
                 <Input
                   label="Capacity (Adults)"
                   type="number"
                   placeholder="2"
                   value={newRoomType.capacity}
                   onChange={(e) => setNewRoomType({...newRoomType, capacity: e.target.value})}
                 />
                 <div className="flex items-end">
                   <Button 
                     color="primary" 
                     onClick={handleAddRoomType}
                     className="w-full"
                   >
                     Add Room Type
                   </Button>
                 </div>
               </div>
              {newRoomType.description && (
                <div className="mt-4">
                  <Textarea
                    label="Description (Optional)"
                    placeholder="Additional details about this room type..."
                    value={newRoomType.description}
                    onChange={(e) => setNewRoomType({...newRoomType, description: e.target.value})}
                  />
                </div>
              )}
            </CardBody>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {settingsStore.roomManagement.roomTypes.map((type) => (
              <Card key={type.id} className="border-2 border-gray-200">
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="text-lg font-semibold text-ghana-black">{type.name}</h4>
                                             <p className="text-sm text-gray-600">
                         {type.capacity} Adults
                       </p>
                    </div>
                    <div className="flex gap-2">
                      <Tooltip content="Edit Room Type">
                        <Button 
                          size="sm" 
                          variant="light" 
                          isIconOnly
                          onClick={() => handleEditRoomType(type)}
                        >
                          ✏️
                        </Button>
                      </Tooltip>
                      <Tooltip content="Delete Room Type">
                        <Button 
                          size="sm" 
                          variant="light" 
                          color="danger" 
                          isIconOnly
                          onClick={() => handleDeleteRoomType(type)}
                        >
                          🗑️
                        </Button>
                      </Tooltip>
                    </div>
                  </div>
                </CardHeader>
                <CardBody className="pt-0">
                  <div className="mb-4">
                    <div className="flex justify-between text-sm mb-1">
                      <span># {getRoomCountByType(type.id)} Rooms</span>
                      <span>{getAvailableRoomCountByType(type.id)}/{getRoomCountByType(type.id)} Available</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-green-500 h-2 rounded-full transition-all duration-300"
                        style={{ 
                          width: `${getRoomCountByType(type.id) > 0 ? (getAvailableRoomCountByType(type.id) / getRoomCountByType(type.id)) * 100 : 0}%` 
                        }}
                      ></div>
                    </div>
                  </div>
                  
                                    {/* Quick Add Room Form */}
                  <div className="border-t pt-3">
                    <h5 className="text-sm font-medium mb-2">Quick Add Room</h5>
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <Input
                          size="sm"
                          placeholder="Room #"
                          value={newRoom.roomNumber}
                          onChange={(e) => setNewRoom({...newRoom, roomNumber: e.target.value})}
                          color={getRoomNumberValidationStatus(newRoom.roomNumber).color as any}
                          description={getRoomNumberValidationStatus(newRoom.roomNumber).message}
                          className="w-24"
                        />
                        <Input
                          size="sm"
                          placeholder="Floor ID"
                          value={newRoom.floor}
                          onChange={(e) => setNewRoom({...newRoom, floor: e.target.value})}
                          className="w-24"
                        />
                        <Button 
                          size="sm" 
                          color="primary"
                          onClick={() => {
                            setNewRoom({...newRoom, type: type.id});
                            handleAddRoom();
                          }}
                        >
                          Add
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
          
          {/* Download Room Types */}
          {settingsStore.roomManagement.roomTypes.length > 0 && (
            <div className="mt-6 flex justify-end">
              <Button 
                color="primary" 
                variant="flat" 
                onClick={() => {
                  const data = settingsStore.roomManagement.roomTypes.map(type => [
                    type.name,
                    type.capacity.toString(),
                    type.category,
                    type.description || '',
                    type.isActive ? 'Active' : 'Inactive',
                    getRoomCountByType(type.id).toString(),
                    getAvailableRoomCountByType(type.id).toString()
                  ]);
                  
                  const headers = ['Name', 'Capacity', 'Category', 'Description', 'Status', 'Total Rooms', 'Available Rooms'];
                        const csvContent = [
        headers.join(','),
        ...data.map(row => row.map((cell: any) => `"${cell}"`).join(','))
      ].join('\n');
                  
                  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                  const link = document.createElement('a');
                  const url = URL.createObjectURL(blob);
                  link.setAttribute('href', url);
                  link.setAttribute('download', 'room-types.csv');
                  link.style.visibility = 'hidden';
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                  
                  logAction('DOWNLOAD_ROOM_TYPES_CSV', { totalTypes: settingsStore.roomManagement.roomTypes.length });
                }}
              >
                📊 Download Room Types CSV
              </Button>
            </div>
          )}
        </Tab>

        <Tab key="rooms" title="Rooms">
          <Card className="mb-6">
            <CardHeader>
              <h3 className="text-xl font-semibold">Add Single Room</h3>
            </CardHeader>
            <CardBody>
                             <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                 <div className="space-y-1">
                  <Input
                    label="Room Number"
                    placeholder="e.g., 101, 2A"
                    value={newRoom.roomNumber}
                    onChange={(e) => setNewRoom({...newRoom, roomNumber: e.target.value})}
                    color={getRoomNumberValidationStatus(newRoom.roomNumber).color as any}
                    description={getRoomNumberValidationStatus(newRoom.roomNumber).message}
                  />
                </div>
                 <Select
                   label="Room Type"
                   placeholder="Select room type"
                   value={newRoom.type}
                   onChange={(e) => setNewRoom({...newRoom, type: e.target.value})}
                 >
                   {settingsStore.roomManagement.roomTypes.map((type) => (
                     <SelectItem key={type.id}>
                       {type.name}
                     </SelectItem>
                   ))}
                 </Select>
                 <Input
                   label="Floor Number"
                   type="number"
                   min="0"
                   placeholder="0 (Ground), 1, 2, 3..."
                   value={newRoom.floorNumber}
                   onChange={(e) => setNewRoom({...newRoom, floorNumber: e.target.value})}
                 />
                 <div className="flex items-end">
                   <Button 
                     color="primary" 
                     onClick={handleAddRoom}
                     className="w-full"
                   >
                     Add Room
                   </Button>
                 </div>
               </div>
            </CardBody>
          </Card>

          {/* Visual Room Display in Small Boxes */}
          <Card className="mb-6">
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-semibold">All Rooms - Visual Display</h3>
                  <p className="text-sm text-gray-600">Click on rooms to edit or delete them</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">
                    {settingsStore.roomManagement.rooms.length} rooms total
                  </span>
                  <Button 
                    size="sm" 
                    variant="light" 
                    onClick={() => setVisualDisplayExpanded(!visualDisplayExpanded)}
                  >
                    {visualDisplayExpanded ? 'Collapse' : 'Expand'} Visual Display
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardBody>
              {visualDisplayExpanded ? (
                // Full display when expanded
                <div className="grid grid-cols-3 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-12 gap-2">
                  {settingsStore.roomManagement.rooms.map((room) => (
                    <div
                      key={room.id}
                      className="relative group cursor-pointer"
                      onClick={() => handleEditRoom(room)}
                    >
                      <Card className="h-16 border border-gray-300 hover:border-blue-400 transition-all duration-200 hover:shadow-sm">
                        <CardBody className="p-2 text-center">
                          <div className="text-sm font-bold text-gray-800 mb-1">
                            {room.number}
                          </div>
                          <div className="text-xs text-gray-600 truncate">
                            {getRoomTypeName(room.typeId)}
                          </div>
                          {/* Active/Inactive indicator */}
                          <div className="absolute top-1 left-1">
                            <div className={`w-2 h-2 rounded-full ${room.isActive ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                          </div>
                          
                          {/* Action buttons - visible on hover */}
                          <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                            <div className="flex gap-1">
                              <Tooltip content="Edit Room">
                                <Button 
                                  size="sm" 
                                  variant="light" 
                                  isIconOnly
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleEditRoom(room);
                                  }}
                                >
                                  ✏️
                                </Button>
                              </Tooltip>
                              <Tooltip content="Delete Room">
                                <Button 
                                  size="sm" 
                                  variant="light" 
                                  color="danger" 
                                  isIconOnly
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteRoom(room);
                                  }}
                                >
                                  🗑️
                                </Button>
                              </Tooltip>
                              <Tooltip content={room.isActive ? 'Deactivate Room' : 'Activate Room'}>
                                <Button 
                                  size="sm" 
                                  variant="light" 
                                  color={room.isActive ? 'warning' : 'success'}
                                  isIconOnly
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleToggleRoomActive(room);
                                  }}
                                >
                                  {room.isActive ? '⏸️' : '▶️'}
                                </Button>
                              </Tooltip>
                            </div>
                          </div>
                        </CardBody>
                      </Card>
                    </div>
                  ))}
                </div>
              ) : (
                // Compact display when collapsed - show only first 24 rooms with "show more" option
                <div>
                  <div className="grid grid-cols-3 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-12 gap-2">
                    {settingsStore.roomManagement.rooms.slice(0, 24).map((room) => (
                      <div
                        key={room.id}
                        className="relative group cursor-pointer"
                        onClick={() => handleEditRoom(room)}
                      >
                        <Card className="h-16 border border-gray-300 hover:border-blue-400 transition-all duration-200 hover:shadow-sm">
                          <CardBody className="p-2 text-center">
                            <div className="text-sm font-bold text-gray-800 mb-1">
                              {room.number}
                            </div>
                            <div className="text-xs text-gray-600 truncate">
                              {getRoomTypeName(room.typeId)}
                            </div>
                            
                            {/* Action buttons - visible on hover */}
                            <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                              <div className="flex gap-1">
                                <Tooltip content="Edit Room">
                                  <Button 
                                    size="sm" 
                                    variant="light" 
                                    isIconOnly
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleEditRoom(room);
                                    }}
                                  >
                                    ✏️
                                  </Button>
                                </Tooltip>
                                <Tooltip content="Delete Room">
                                  <Button 
                                    size="sm" 
                                    variant="light" 
                                    color="danger" 
                                    isIconOnly
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteRoom(room);
                                    }}
                                  >
                                    🗑️
                                  </Button>
                                </Tooltip>
                                <Tooltip content={room.isActive ? 'Deactivate Room' : 'Activate Room'}>
                                  <Button 
                                    size="sm" 
                                    variant="light" 
                                    color={room.isActive ? 'warning' : 'success'}
                                    isIconOnly
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleToggleRoomActive(room);
                                    }}
                                  >
                                    {room.isActive ? '⏸️' : '▶️'}
                                  </Button>
                                </Tooltip>
                              </div>
                            </div>
                          </CardBody>
                        </Card>
                      </div>
                    ))}
                  </div>
                  
                  {settingsStore.roomManagement.rooms.length > 24 && (
                    <div className="mt-4 text-center">
                      <div className="text-sm text-gray-600 mb-2">
                        Showing 24 of {settingsStore.roomManagement.rooms.length} rooms
                      </div>
                      <Button 
                        size="sm" 
                        variant="light" 
                        onClick={() => setVisualDisplayExpanded(true)}
                      >
                        Show All Rooms
                      </Button>
                    </div>
                  )}
                </div>
              )}
              
              {settingsStore.roomManagement.rooms.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <p>No rooms configured yet. Add some rooms to see them here!</p>
                </div>
              )}
            </CardBody>
          </Card>

          {/* Traditional Table View */}
                     <Card>
             <CardHeader>
               <div className="flex justify-between items-center">
                 <div>
                   <h3 className="text-xl font-semibold">All Rooms - Table View</h3>
                   <p className="text-sm text-gray-600">Click on column headers to sort the data</p>
                 </div>
                 <div className="flex gap-2">
                   <Button 
                     size="sm" 
                     variant="light" 
                     onClick={() => setVisualDisplayExpanded(true)}
                   >
                     📊 Show Full Visual Display
                   </Button>
                   <Button 
                     size="sm" 
                     variant="light" 
                     onClick={() => setActiveTab('room-types')}
                   >
                     🏷️ Room Types
                   </Button>
                 </div>
               </div>
             </CardHeader>
            <CardBody>
                             <Table aria-label="Rooms table">
                 <TableHeader>
                   <TableColumn 
                     className="cursor-pointer hover:bg-gray-100 select-none transition-colors duration-200"
                     onClick={() => handleRoomsSort('number')}
                   >
                     <div className="flex items-center gap-2">
                       <span>Room Number</span>
                       <span className="text-gray-500">{getSortIcon('number', roomsSortField, roomsSortDirection)}</span>
                     </div>
                   </TableColumn>
                   <TableColumn 
                     className="cursor-pointer hover:bg-gray-100 select-none transition-colors duration-200"
                     onClick={() => handleRoomsSort('type')}
                   >
                     <div className="flex items-center gap-2">
                       <span>Type</span>
                       <span className="text-gray-500">{getSortIcon('type', roomsSortField, roomsSortDirection)}</span>
                     </div>
                   </TableColumn>
                   <TableColumn 
                     className="text-center cursor-pointer hover:bg-gray-100 select-none transition-colors duration-200"
                     onClick={() => handleRoomsSort('floor')}
                   >
                     <div className="flex items-center gap-2 justify-center">
                       <span>Floor #</span>
                       <span className="text-gray-500">{getSortIcon('floor', roomsSortField, roomsSortDirection)}</span>
                     </div>
                   </TableColumn>
                   <TableColumn 
                     className="cursor-pointer hover:bg-gray-100 select-none transition-colors duration-200"
                     onClick={() => handleRoomsSort('status')}
                   >
                     <div className="flex items-center gap-2">
                       <span>Status</span>
                       <span className="text-gray-500">{getSortIcon('status', roomsSortField, roomsSortDirection)}</span>
                     </div>
                   </TableColumn>
                   <TableColumn 
                     className="cursor-pointer hover:bg-gray-100 select-none transition-colors duration-200"
                     onClick={() => handleRoomsSort('isActive')}
                   >
                     <div className="flex items-center gap-2">
                       <span>Active</span>
                       <span className="text-gray-500">{getSortIcon('isActive', roomsSortField, roomsSortDirection)}</span>
                     </div>
                   </TableColumn>
                   <TableColumn>Actions</TableColumn>
                 </TableHeader>
                 <TableBody>
                   {getSortedRooms().map((room) => (
                    <TableRow key={room.id}>
                      <TableCell className="font-medium">{room.number}</TableCell>
                      <TableCell>{getRoomTypeName(room.typeId)}</TableCell>
                      <TableCell className="text-center">
                        {room.floorNumber === 0 ? 'Ground Floor' : `Floor ${room.floorNumber}`}
                      </TableCell>
                      <TableCell>
                        <Chip 
                          color={getStatusColor(room.status)}
                          variant="flat"
                        >
                          {room.status}
                        </Chip>
                      </TableCell>
                      <TableCell>
                        <Chip 
                          color={room.isActive ? 'success' : 'default'}
                          variant="flat"
                        >
                          {room.isActive ? 'Active' : 'Inactive'}
                        </Chip>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Tooltip content="Edit Room">
                            <Button 
                              size="sm" 
                              variant="light" 
                              isIconOnly
                              onClick={() => handleEditRoom(room)}
                            >
                              ✏️
                            </Button>
                          </Tooltip>
                          <Tooltip content="Delete Room">
                            <Button 
                              size="sm" 
                              variant="light" 
                              color="danger" 
                              isIconOnly
                              onClick={() => handleDeleteRoom(room)}
                            >
                              🗑️
                            </Button>
                          </Tooltip>
                          <Tooltip content={room.isActive ? 'Deactivate Room' : 'Activate Room'}>
                            <Button 
                              size="sm" 
                              variant="light" 
                              color={room.isActive ? 'warning' : 'success'}
                              isIconOnly
                              onClick={() => handleToggleRoomActive(room)}
                            >
                              {room.isActive ? '⏸️' : '▶️'}
                            </Button>
                          </Tooltip>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                             </Table>
               {settingsStore.roomManagement.rooms.length > 0 && (
                 <div className="mt-4 flex justify-end gap-2">
                   <Button 
                     color="primary" 
                     variant="flat" 
                     onClick={handleDownloadCSV}
                     isLoading={isCsvLoading}
                     disabled={isCsvLoading}
                   >
                     {isCsvLoading ? 'Generating CSV...' : '📊 Download CSV'}
                   </Button>
                   <Button 
                     color="primary" 
                     variant="flat" 
                     onClick={handleDownloadPDF}
                     isLoading={isPdfLoading}
                     disabled={isPdfLoading}
                   >
                     {isPdfLoading ? 'Generating PDF...' : '📄 Download PDF'}
                   </Button>
                 </div>
               )}
             </CardBody>
           </Card>
        </Tab>

        <Tab key="rate-plans" title="Rate Plans">
          {/* Price Type Information */}
          <Card className="mb-6 bg-blue-50 border-blue-200">
            <CardHeader>
              <h3 className="text-lg font-semibold text-blue-800">💰 Understanding Price Types</h3>
            </CardHeader>
            <CardBody>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <h4 className="font-medium text-blue-700">Subtotal (Before Tax)</h4>
                  <ul className="text-sm text-blue-600 space-y-1">
                    <li>• You set the base room rate</li>
                    <li>• Taxes are calculated and added on top</li>
                    <li>• Guest pays: Base Rate + Taxes</li>
                    <li>• Example: ₵600 + ₵132 = ₵732 total</li>
                  </ul>
                </div>
                <div className="space-y-3">
                  <h4 className="font-medium text-blue-700">Gross Total (Including Tax)</h4>
                  <ul className="text-sm text-blue-600 space-y-1">
                    <li>• You set the final guest price</li>
                    <li>• Taxes are included in your rate</li>
                    <li>• Guest pays exactly what you set</li>
                    <li>• Example: ₵732 (taxes already included)</li>
                  </ul>
                </div>
              </div>
              <div className="mt-4 p-3 bg-blue-100 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>💡 Tip:</strong> Use "Subtotal" if you want to control your base revenue, 
                  use "Gross Total" if you want to control the final guest price.
                </p>
              </div>
            </CardBody>
          </Card>

          <Card className="mb-6">
            <CardHeader>
              <h3 className="text-xl font-semibold">Add New Rate Plan</h3>
            </CardHeader>
            <CardBody>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <Input
                  label="Rate Plan Name"
                  placeholder="e.g., Weekend Special, Corporate Rate"
                  value={newRatePlan.name}
                  onChange={(e) => setNewRatePlan({...newRatePlan, name: e.target.value})}
                />
                <Select
                  label="Room Type"
                  placeholder="Select room type"
                  value={newRatePlan.roomType}
                  onChange={(e) => setNewRatePlan({...newRatePlan, roomType: e.target.value})}
                >
                  {settingsStore.roomManagement.roomTypes.map((type) => (
                    <SelectItem key={type.id}>
                      {type.name}
                    </SelectItem>
                  ))}
                </Select>
                <Input
                  label={`Price (₵) - ${newRatePlan.priceType === 'subtotal' ? 'Subtotal' : 'Gross Total'}`}
                  type="number"
                  placeholder="750"
                  value={newRatePlan.price}
                  onChange={(e) => setNewRatePlan({...newRatePlan, price: e.target.value})}
                />
                <Select
                  label="Price Type"
                  placeholder="Select price type"
                  value={newRatePlan.priceType}
                  onChange={(e) => setNewRatePlan({...newRatePlan, priceType: e.target.value as 'subtotal' | 'gross_total'})}
                >
                  <SelectItem key="subtotal">
                    Subtotal (Before Tax)
                  </SelectItem>
                  <SelectItem key="gross_total">
                    Gross Total (Including Tax)
                  </SelectItem>
                </Select>
                <div className="flex items-end">
                  <Button 
                    color="primary" 
                    onClick={handleAddRatePlan}
                    className="w-full"
                  >
                    Add Rate Plan
                  </Button>
                </div>
              </div>

              {/* Live tax preview */}
              {getLivePreview() && (
                <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 bg-gray-50 p-4 rounded-lg border">
                  <div>
                    <h4 className="font-medium mb-2">Live Preview</h4>
                    <div className="text-sm text-gray-700">
                      <div className="flex justify-between"><span>Base (Subtotal):</span><span className="font-mono">₵{getLivePreview()?.subtotal?.toFixed(2) || '0.00'}</span></div>
                      <div className="flex justify-between"><span>NHIL (2.5%):</span><span className="font-mono">₵{getLivePreview()?.nhil?.toFixed(2) || '0.00'}</span></div>
                      <div className="flex justify-between"><span>GETFund (2.5%):</span><span className="font-mono">₵{getLivePreview()?.getfund?.toFixed(2) || '0.00'}</span></div>
                      <div className="flex justify-between"><span>COVID-19 (1.0%):</span><span className="font-mono">₵{getLivePreview()?.covid?.toFixed(2) || '0.00'}</span></div>
                      <div className="flex justify-between"><span>VAT (15% on base+levies):</span><span className="font-mono">₵{getLivePreview()?.vat?.toFixed(2) || '0.00'}</span></div>
                      <div className="flex justify-between"><span>Tourism Levy (1%):</span><span className="font-mono">₵{getLivePreview()?.tourism?.toFixed(2) || '0.00'}</span></div>
                    </div>
                  </div>
                  <div className="flex items-center">
                    <div className="w-full">
                      <div className="flex justify-between text-sm text-gray-700">
                        <span>Total Tax:</span>
                        <span className="font-mono font-semibold text-red-600">₵{getLivePreview()?.totalTax?.toFixed(2) || '0.00'}</span>
                      </div>
                      <div className="flex justify-between text-base mt-2">
                        <span className="text-gray-800 font-medium">Guest Pays:</span>
                        <span className="font-mono font-bold text-green-700">₵{getLivePreview()?.finalBill?.toFixed(2) || '0.00'}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 self-end">
                    Changes respond instantly to price and price type. Switch between Subtotal and Gross Total anytime.
                  </div>
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <h3 className="text-xl font-semibold">All Rate Plans</h3>
            </CardHeader>
            <CardBody>
                             <Table aria-label="Rate plans table">
                 <TableHeader>
                   <TableColumn 
                     className="cursor-pointer hover:bg-gray-100 select-none transition-colors duration-200"
                     onClick={() => handleRatePlansSort('name')}
                   >
                     <div className="flex items-center gap-2">
                       <span>Name</span>
                       <span className="text-gray-500">{getSortIcon('name', ratePlansSortField, ratePlansSortDirection)}</span>
                     </div>
                   </TableColumn>
                   <TableColumn 
                     className="cursor-pointer hover:bg-gray-100 select-none transition-colors duration-200"
                     onClick={() => handleRatePlansSort('roomType')}
                   >
                     <div className="flex items-center gap-2">
                       <span>Room Type</span>
                       <span className="text-gray-500">{getSortIcon('roomType', ratePlansSortField, ratePlansSortDirection)}</span>
                     </div>
                   </TableColumn>
                   <TableColumn 
                     className="cursor-pointer hover:bg-gray-100 select-none transition-colors duration-200"
                     onClick={() => handleRatePlansSort('price')}
                   >
                     <div className="flex items-center gap-2">
                       <span>Subtotal</span>
                       <span className="text-gray-500">{getSortIcon('price', ratePlansSortField, ratePlansSortDirection)}</span>
                     </div>
                   </TableColumn>
                   <TableColumn className="text-center">
                     Final Bill (Tax Inclusive)
                   </TableColumn>
                   <TableColumn 
                     className="cursor-pointer hover:bg-gray-100 select-none transition-colors duration-200"
                     onClick={() => handleRatePlansSort('priceType')}
                   >
                     <div className="flex items-center gap-2">
                       <span>Price Type</span>
                       <span className="text-gray-500">{getSortIcon('priceType', ratePlansSortField, ratePlansSortDirection)}</span>
                     </div>
                   </TableColumn>
                   <TableColumn 
                     className="cursor-pointer hover:bg-gray-100 select-none transition-colors duration-200"
                     onClick={() => handleRatePlansSort('lastUpdated')}
                   >
                     <div className="flex items-center gap-2">
                       <span>Last Updated</span>
                       <span className="text-gray-500">{getSortIcon('lastUpdated', ratePlansSortField, ratePlansSortDirection)}</span>
                     </div>
                   </TableColumn>
                   <TableColumn>Seasonal Rates</TableColumn>
                   <TableColumn>Actions</TableColumn>
                 </TableHeader>
                 <TableBody>
                   {getSortedRatePlans().map((plan) => (
                    <TableRow key={plan.id}>
                      <TableCell className="font-medium">{plan.name}</TableCell>
                      <TableCell>{getRoomTypeName(plan.roomTypeId)}</TableCell>
                      <TableCell>₵{plan.basePrice}</TableCell>
                      <TableCell className="text-center">
                        {(() => {
                          const subtotal = plan.basePrice;
                          const nhil = subtotal * 0.025;
                          const getfund = subtotal * 0.025;
                          const covid = subtotal * 0.01;
                          const vat = (subtotal + nhil + getfund + covid) * 0.15;
                          const tourism = subtotal * 0.01;
                          const finalBill = subtotal + nhil + getfund + covid + vat + tourism;
                          return `₵${finalBill.toFixed(2)}`;
                        })()}
                      </TableCell>
                                             <TableCell>
                         <Chip 
                           size="sm" 
                           color={(plan.priceType || 'subtotal') === 'subtotal' ? 'primary' : 'success'} 
                           variant="flat"
                         >
                           {(plan.priceType || 'subtotal') === 'subtotal' ? 'Subtotal' : 'Gross Total'}
                         </Chip>
                       </TableCell>
                       <TableCell>
                         <span className="text-sm text-gray-600">
                           {new Date(plan.lastUpdated || new Date().toISOString()).toLocaleDateString('en-GB', {
                             day: '2-digit',
                             month: 'short',
                             year: 'numeric',
                             hour: '2-digit',
                             minute: '2-digit'
                           })}
                         </span>
                       </TableCell>
                       <TableCell>
                         {plan.seasonalRates.length > 0 ? (
                           <div className="space-y-1">
                             {plan.seasonalRates.map((seasonal) => (
                               <div key={seasonal.id} className="text-xs bg-blue-50 p-1 rounded">
                                 <span className="font-medium">{seasonal.name}</span>
                                 <br />
                                 <span className="text-gray-600">
                                   {new Date(seasonal.startDate).toLocaleDateString('en-GB')} - {new Date(seasonal.endDate).toLocaleDateString('en-GB')}
                                 </span>
                                 <br />
                                 <span className="text-green-600 font-semibold">{seasonal.multiplier}x</span>
                               </div>
                             ))}
                           </div>
                         ) : (
                           <span className="text-xs text-gray-400">No seasonal rates</span>
                         )}
                       </TableCell>
                       <TableCell>
                        <div className="flex gap-2">
                          <Tooltip content="Edit Rate Plan">
                            <Button 
                              size="sm" 
                              variant="light" 
                              isIconOnly
                              onClick={() => {
                                setSelectedRatePlan(plan);
                                setEditRatePlanModalOpen(true);
                              }}
                            >
                              ✏️
                            </Button>
                          </Tooltip>
                          <Tooltip content="Delete Rate Plan">
                            <Button 
                              size="sm" 
                              variant="light" 
                              color="danger" 
                              isIconOnly
                              onClick={() => {
                                if (confirm(`Are you sure you want to delete rate plan "${plan.name}"?`)) {
                                  settingsStore.deleteRatePlan(plan.id);
                                  logAction('DELETE_RATE_PLAN', { ratePlan: plan });
                                }
                              }}
                            >
                              🗑️
                            </Button>
                          </Tooltip>
                          <Tooltip content="Add Seasonal Rate">
                            <Button 
                              size="sm" 
                              variant="light" 
                              isIconOnly
                              onClick={() => {
                                setSeasonalPlanId(plan.id);
                                setSeasonalForm({ name: '', startDate: '', endDate: '', multiplier: 1, description: '' });
                                setSeasonalModalOpen(true);
                              }}
                            >
                              ➕
                            </Button>
                          </Tooltip>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                                 </TableBody>
               </Table>
               {settingsStore.roomManagement.ratePlans.length > 0 && (
                 <div className="mt-4 flex justify-end gap-2">
                   <Button 
                     color="primary" 
                     variant="flat" 
                     onClick={handleDownloadBasicRatePlansCSV}
                   >
                     📊 Download Basic CSV
                   </Button>
                   <Button 
                     color="success" 
                     variant="flat" 
                     onClick={handleDownloadRatePlansCSV}
                     isLoading={isCsvLoading}
                     disabled={isCsvLoading}
                   >
                     {isCsvLoading ? 'Generating CSV...' : '📊 Download Comprehensive CSV'}
                   </Button>
                   <Button 
                     color="warning" 
                     variant="flat" 
                     onClick={handleDownloadRatePlansPDF}
                     isLoading={isPdfLoading}
                     disabled={isPdfLoading}
                   >
                     {isPdfLoading ? 'Generating PDF...' : '📄 Download Comprehensive PDF'}
                   </Button>
                 </div>
               )}
             </CardBody>
           </Card>

          {/* Tax Calculation Preview */}
          <Card className="mt-6">
            <CardHeader>
              <h3 className="text-xl font-semibold">Tax Calculation Preview</h3>
              <p className="text-sm text-gray-600">See how your rates translate to guest bills</p>
            </CardHeader>
            <CardBody>
              {/* Rate Plan Selector */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <Select
                  label="Rate Plan"
                  placeholder="Select rate plan to preview"
                  value={selectedTaxPreviewPlan || ''}
                  onChange={(e) => setSelectedTaxPreviewPlan(e.target.value)}
                >
                  {settingsStore.roomManagement.ratePlans.map((plan) => (
                    <SelectItem key={plan.id}>
                      {plan.name} - {getRoomTypeName(plan.roomTypeId)}
                    </SelectItem>
                  ))}
                </Select>
                {selectedTaxPreviewPlan && (
                  <div className="flex items-end">
                    <Badge color="primary" variant="flat">
                      Previewing: {settingsStore.roomManagement.ratePlans.find(p => p.id === selectedTaxPreviewPlan)?.name}
                    </Badge>
                  </div>
                )}
              </div>

              {/* Tax Calculation Display */}
              {selectedTaxPreviewPlan ? (
                (() => {
                  const plan = settingsStore.roomManagement.ratePlans.find(p => p.id === selectedTaxPreviewPlan);
                  if (!plan) return null;
                  
                    const roomType = settingsStore.roomManagement.roomTypes.find(rt => rt.id === plan.roomTypeId);
                    if (!roomType) return null;

                    // Calculate tax breakdown (Ghana taxes)
                    const transformedPlan = transformRatePlanData(plan);
                    const subtotal = transformedPlan.priceType === 'subtotal' ? transformedPlan.basePrice : transformedPlan.basePrice / GHANA_GROSS_FACTOR;
                    const nhil = subtotal * 0.025; // 2.5%
                    const getfund = subtotal * 0.025; // 2.5%
                    const covid = subtotal * 0.01; // 1.0%
                    const vat = (subtotal + nhil + getfund + covid) * 0.15; // 15% on amount after levies
                    const tourism = subtotal * 0.01; // 1.0%
                    const totalTax = nhil + getfund + covid + vat + tourism;
                    const grossTotal = subtotal + totalTax;

                    return (
                    <div className="p-4 border rounded-lg bg-gray-50">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <h4 className="font-semibold text-lg">{transformedPlan.name}</h4>
                            <p className="text-sm text-gray-600">{roomType.name} • {transformedPlan.priceType === 'subtotal' ? 'Subtotal Rate' : 'Gross Rate'}</p>
                          </div>
                          <Chip 
                            size="sm" 
                            color={transformedPlan.priceType === 'subtotal' ? 'primary' : 'success'} 
                            variant="flat"
                          >
                            {transformedPlan.priceType === 'subtotal' ? 'Subtotal' : 'Gross Total'}
                          </Chip>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-600">Base Rate:</span>
                              <span className="font-mono">₵{subtotal.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-600">NHIL (2.5%):</span>
                              <span className="font-mono text-orange-600">₵{nhil.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-600">GETFund (2.5%):</span>
                              <span className="font-mono text-orange-600">₵{getfund.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-600">COVID-19 (1.0%):</span>
                              <span className="font-mono text-orange-600">₵{covid.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-600">VAT (15.0%):</span>
                              <span className="font-mono text-orange-600">₵{vat.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-600">Tourism (1.0%):</span>
                              <span className="font-mono text-orange-600">₵{tourism.toFixed(2)}</span>
                            </div>
                          </div>
                          
                          <div className="space-y-2">
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-600">Total Tax:</span>
                              <span className="font-mono font-semibold text-red-600">₵{totalTax.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-600">Guest Pays:</span>
                              <span className="font-mono font-bold text-green-600 text-lg">₵{grossTotal.toFixed(2)}</span>
                            </div>
                            <div className="pt-2">
                              <div className="text-xs text-gray-500">
                                <p><strong>Tax Breakdown:</strong></p>
                                <p>• NHIL + GETFund + COVID-19 = {((nhil + getfund + covid) / subtotal * 100).toFixed(1)}% of base</p>
                                <p>• VAT = 15% of (base + levies)</p>
                                <p>• Tourism = 1% of base</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                })()
                ) : (
                  <div className="text-center py-8 text-gray-500">
                  <p>Select a rate plan above to see tax calculations.</p>
                  </div>
                )}
            </CardBody>
          </Card>

                        {/* Seasonal Rates Management */}
              <Card className="mt-6">
                <CardHeader>
                  <h3 className="text-xl font-semibold">Seasonal Rates Management</h3>
                  <p className="text-sm text-gray-600">Manage seasonal pricing periods and multipliers</p>
                </CardHeader>
                <CardBody>
                  {/* Rate Plan Selector */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <Select
                      label="Rate Plan"
                      placeholder="Select rate plan to manage seasonal rates"
                      value={selectedSeasonalPlan || ''}
                      onChange={(e) => setSelectedSeasonalPlan(e.target.value)}
                    >
                      {settingsStore.roomManagement.ratePlans.map((plan) => (
                        <SelectItem key={plan.id}>
                          {plan.name} - {getRoomTypeName(plan.roomTypeId)}
                        </SelectItem>
                      ))}
                    </Select>
                {selectedSeasonalPlan && (
                  <div className="flex items-end gap-2">
                    <Badge color="primary" variant="flat">
                      Managing: {settingsStore.roomManagement.ratePlans.find(p => p.id === selectedSeasonalPlan)?.name}
                    </Badge>
                    <Button 
                      size="sm" 
                      color="success" 
                      variant="flat"
                      onClick={() => {
                        setSeasonalPlanId(selectedSeasonalPlan);
                        setSeasonalForm({ name: '', startDate: '', endDate: '', multiplier: 1, description: '' });
                        setSeasonalModalOpen(true);
                      }}
                    >
                      ➕ Add Seasonal Rate
                    </Button>
                  </div>
                )}
              </div>

              {/* Seasonal Rates Display */}
              {selectedSeasonalPlan ? (
                (() => {
                  const plan = settingsStore.roomManagement.ratePlans.find(p => p.id === selectedSeasonalPlan);
                  if (!plan) return null;
                  
                    const roomType = settingsStore.roomManagement.roomTypes.find(rt => rt.id === plan.roomTypeId);
                    if (!roomType) return null;

                    return (
                    <div className="p-4 border rounded-lg bg-blue-50">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <h4 className="font-semibold text-lg">{plan.name}</h4>
                            <p className="text-sm text-blue-600">{roomType.name} • Base: ₵{plan.basePrice}</p>
                          </div>
                          <Chip 
                            size="sm" 
                            color={plan.seasonalRates.length > 0 ? 'success' : 'default'} 
                            variant="flat"
                          >
                            {plan.seasonalRates.length} Seasonal Periods
                          </Chip>
                        </div>
                        
                        {plan.seasonalRates.length > 0 ? (
                          <div className="space-y-3">
                            {plan.seasonalRates.map((seasonal) => (
                              <div key={seasonal.id} className="p-3 bg-white rounded border">
                                <div className="flex justify-between items-center">
                                  <div>
                                    <h5 className="font-medium">{seasonal.name}</h5>
                                    <p className="text-sm text-gray-600">
                                      {new Date(seasonal.startDate).toLocaleDateString('en-GB')} - {new Date(seasonal.endDate).toLocaleDateString('en-GB')}
                                    </p>
                                    <p className="text-sm text-gray-600">
                                      Multiplier: {seasonal.multiplier}x • Final Price: ₵{(plan.basePrice * seasonal.multiplier).toFixed(2)}
                                    </p>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-sm text-gray-600">{seasonal.description || 'No description'}</p>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-4 text-blue-600">
                            <p>No seasonal rates configured for this plan.</p>
                          <p className="text-sm">Click "Add Seasonal Rate" above to create dynamic pricing.</p>
                          </div>
                        )}
                      </div>
                    );
                })()
                ) : (
                  <div className="text-center py-8 text-gray-500">
                  <p>Select a rate plan above to manage seasonal pricing.</p>
                  </div>
                )}
            </CardBody>
          </Card>
        </Tab>

        <Tab key="event-rates" title="🎯 Event & Conference Rates">
          <Card className="mb-6 bg-purple-50 border-purple-200">
            <CardHeader>
              <h3 className="text-lg font-semibold text-purple-800">🎯 Event & Conference Rate Management</h3>
              <p className="text-sm text-purple-600">Manage conference rates, event packages, and resource pricing integrated with your room system</p>
            </CardHeader>
            <CardBody>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <h4 className="font-medium text-purple-700">Event Rate Plans</h4>
                  <ul className="text-sm text-purple-600 space-y-1">
                    <li>• Special rates for conference attendees</li>
                    <li>• Package pricing for events</li>
                    <li>• Seasonal adjustments for events</li>
                    <li>• Integration with room booking system</li>
                  </ul>
                </div>
                <div className="space-y-3">
                  <h4 className="font-medium text-purple-700">Event Resources & Packages</h4>
                  <ul className="text-sm text-purple-600 space-y-1">
                    <li>• Venue hire (conference halls, meeting rooms)</li>
                    <li>• Equipment rental (AV, furniture)</li>
                    <li>• Service packages (catering, setup)</li>
                    <li>• Bundled offerings for events</li>
                  </ul>
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Event Rate Management Component */}
          <div className="space-y-6">
            <EventRateManagement />
          </div>
        </Tab>

        <Tab key="amenities" title="Room Amenities">
          <Card>
            <CardHeader>
              <h3 className="text-xl font-semibold">Room Amenities</h3>
              <p className="text-sm text-gray-600">LINK amenities to specific room types and toggle them</p>
            </CardHeader>
            <CardBody>
              {/* Room Type Selector for Amenities */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div>
                  <label className="text-sm text-gray-600">Room Type</label>
                  <select
                    className="mt-1 w-full border rounded-md h-10 px-3"
                    value={selectedAmenitiesRoomTypeId}
                    onChange={(e) => setSelectedAmenitiesRoomTypeId(e.target.value)}
                  >
                    <option value="">Select room type to manage amenities</option>
                    {settingsStore.roomManagement.roomTypes.map((type) => (
                      <option key={type.id} value={type.id}>{type.name}</option>
                    ))}
                  </select>
                </div>
                {selectedAmenitiesRoomTypeId && (
                  <div className="flex items-end">
                    <Badge color="primary" variant="flat">
                      Managing: {getRoomTypeName(selectedAmenitiesRoomTypeId)}
                    </Badge>
                  </div>
                )}
              </div>
              {/* First Row: Bedding & Linens, Bathroom Amenities */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium mb-3"><strong>Bedding & Linens</strong></h4>
                  <div className="space-y-3">
                    {getAmenitiesByCategory('bedding').map((amenity) => (
                      <div key={amenity.id} className="flex items-center justify-between">
                        <span className="text-sm">{amenity.name}</span>
                        <Switch
                          isSelected={isAmenityEnabledForSelectedType(amenity.id)}
                          onValueChange={() => toggleAmenity(amenity.id)}
                          color="primary"
                        />
                      </div>
                    ))}
                  </div>
                </div>
                
                <div>
                  <h4 className="font-medium mb-3"><strong>Bathroom Amenities</strong></h4>
                  <div className="space-y-3">
                    {getAmenitiesByCategory('bathroom').map((amenity) => (
                      <div key={amenity.id} className="flex items-center justify-between">
                        <span className="text-sm">{amenity.name}</span>
                        <Switch
                          isSelected={isAmenityEnabledForSelectedType(amenity.id)}
                          onValueChange={() => toggleAmenity(amenity.id)}
                          color="primary"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              
              {/* Second Row: Furniture & Storage, Electronics & Appliances */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                <div>
                  <h4 className="font-medium mb-3"><strong>Furniture & Storage</strong></h4>
                  <div className="space-y-3">
                    {getAmenitiesByCategory('furniture').map((amenity) => (
                      <div key={amenity.id} className="flex items-center justify-between">
                        <span className="text-sm">{amenity.name}</span>
                        <Switch
                          isSelected={isAmenityEnabledForSelectedType(amenity.id)}
                          onValueChange={() => toggleAmenity(amenity.id)}
                          color="primary"
                        />
                      </div>
                    ))}
                  </div>
                </div>
                
                <div>
                  <h4 className="font-medium mb-3"><strong>Electronics & Appliances</strong></h4>
                  <div className="space-y-3">
                    {getAmenitiesByCategory('electronics').map((amenity) => (
                      <div key={amenity.id} className="flex items-center justify-between">
                        <span className="text-sm">{amenity.name}</span>
                        <Switch
                          isSelected={isAmenityEnabledForSelectedType(amenity.id)}
                          onValueChange={() => toggleAmenity(amenity.id)}
                          color="primary"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Third Row: Guest Supplies & Consumables, Specialized Equipment */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                <div>
                  <h4 className="font-medium mb-3"><strong>Guest Supplies & Consumables</strong></h4>
                  <div className="space-y-3">
                    {getAmenitiesByCategory('supplies').map((amenity) => (
                      <div key={amenity.id} className="flex items-center justify-between">
                        <span className="text-sm">{amenity.name}</span>
                        <Switch
                          isSelected={isAmenityEnabledForSelectedType(amenity.id)}
                          onValueChange={() => toggleAmenity(amenity.id)}
                          color="primary"
                        />
                      </div>
                    ))}
                  </div>
                </div>
                
                <div>
                  <h4 className="font-medium mb-3"><strong>Specialized Equipment</strong></h4>
                  <div className="space-y-3">
                    {getAmenitiesByCategory('specialized').map((amenity) => (
                      <div key={amenity.id} className="flex items-center justify-between">
                        <span className="text-sm">{amenity.name}</span>
                        <Switch
                          isSelected={isAmenityEnabledForSelectedType(amenity.id)}
                          onValueChange={() => toggleAmenity(amenity.id)}
                          color="primary"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Fourth Row: Disability-Friendly Amenities, Luxury Amenities */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                <div>
                  <h4 className="font-medium mb-3"><strong>Disability-Friendly Amenities</strong></h4>
                  <div className="space-y-3">
                    {getAmenitiesByCategory('disability').map((amenity) => (
                      <div key={amenity.id} className="flex items-center justify-between">
                        <span className="text-sm">{amenity.name}</span>
                        <Switch
                          isSelected={isAmenityEnabledForSelectedType(amenity.id)}
                          onValueChange={() => toggleAmenity(amenity.id)}
                          color="primary"
                        />
                      </div>
                    ))}
                  </div>
                </div>
                
                <div>
                  <h4 className="font-medium mb-3"><strong>Luxury Amenities</strong></h4>
                  <div className="space-y-3">
                    {getAmenitiesByCategory('luxury').map((amenity) => (
                      <div key={amenity.id} className="flex items-center justify-between">
                        <span className="text-sm">{amenity.name}</span>
                        <Switch
                          isSelected={isAmenityEnabledForSelectedType(amenity.id)}
                          onValueChange={() => toggleAmenity(amenity.id)}
                          color="primary"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Fifth Row: Other */}
              <div className="grid grid-cols-1 gap-6 mt-6">
                <div>
                  <h4 className="font-medium mb-3"><strong>Other</strong></h4>
                  <div className="space-y-3">
                    {getAmenitiesByCategory('other').map((amenity) => (
                      <div key={amenity.id} className="flex items-center justify-between">
                        <span className="text-sm">{amenity.name}</span>
                        <Switch
                          isSelected={isAmenityEnabledForSelectedType(amenity.id)}
                          onValueChange={() => toggleAmenity(amenity.id)}
                          color="primary"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              
              <div className="mt-6 pt-4 border-t">
                <Button color="primary" variant="flat" onClick={() => {
                  if (!selectedAmenitiesRoomTypeId) {
                    alert('Please select a room type first.');
                    return;
                  }
                  const rt = getSelectedAmenitiesRoomType();
                  logAction('SAVE_AMENITIES_FOR_ROOM_TYPE', { roomTypeId: selectedAmenitiesRoomTypeId, amenities: rt?.amenities || [] });
                  alert('Amenities updated for ' + getRoomTypeName(selectedAmenitiesRoomTypeId));
                }}>
                  Update Amenities for Selected Type
                </Button>
              </div>
            </CardBody>
          </Card>
        </Tab>

        {/* Bulk Operations standalone tab placed after Rate Plans */}
        <Tab key="bulk-operations" title="🔄 Bulk Operations">
          <Card className="mb-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
            <CardHeader className="py-2">
              <h3 className="text-base font-semibold text-blue-800">🔄 Bulk Operations & Workflow Management</h3>
              <p className="text-xs text-blue-600">Smart room management with automated workflows and bulk operations</p>
            </CardHeader>
            <CardBody className="p-3">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {/* Seasonal Management */}
                <div className="p-3 bg-white rounded-lg border border-blue-200">
                  <h4 className="text-sm font-medium text-blue-800 mb-2">🌤️ Seasonal Management</h4>
                  <div className="space-y-2">
                    <Button size="sm" color="primary" variant="flat" onClick={() => handleBulkRoomStatusChange({ status: 'available' }, 'available', true)}>
                      Activate All Available Rooms
                    </Button>
                    <Button size="sm" color="warning" variant="flat" onClick={() => handleBulkRoomStatusChange({ status: 'available' }, 'available', false)}>
                      Deactivate All Available Rooms
                    </Button>
                  </div>
                </div>

                {/* Floor-based Operations */}
                <div className="p-3 bg-white rounded-lg border border-blue-200">
                  <h4 className="text-sm font-medium text-blue-800 mb-2">🏢 Floor Management</h4>
                  <div className="space-y-2">
                    <Button size="sm" color="primary" variant="flat" onClick={() => { const floor = prompt('Enter floor number to activate all rooms:'); if (floor && !isNaN(Number(floor))) { handleBulkRoomStatusChange({ floors: [Number(floor)] }, 'available', true); } }}>
                      Activate Floor
                    </Button>
                    <Button size="sm" color="warning" variant="flat" onClick={() => { const floor = prompt('Enter floor number to deactivate all rooms:'); if (floor && !isNaN(Number(floor))) { handleBulkRoomStatusChange({ floors: [Number(floor)] }, 'available', false); } }}>
                      Deactivate Floor
                    </Button>
                  </div>
                </div>

                {/* Room Type Operations */}
                <div className="p-3 bg-white rounded-lg border border-blue-200">
                  <h4 className="text-sm font-medium text-blue-800 mb-2">🏷️ Room Type Management</h4>
                  <div className="space-y-2">
                    <Select size="sm" label="Select Room Type" placeholder="Choose room type" onChange={(e) => { if (e.target.value) { handleBulkRoomStatusChange({ roomTypes: [e.target.value] }, 'available', true); } }}>
                      {settingsStore.roomManagement.roomTypes.map((type) => (
                        <SelectItem key={type.id}>{type.name}</SelectItem>
                      ))}
                    </Select>
                    <Button size="sm" color="success" variant="flat" className="w-full" onClick={() => { const selectedType = document.querySelector('select')?.value; if (selectedType) { handleBulkRoomStatusChange({ roomTypes: [selectedType] }, 'available', true); } }}>
                      Activate All Rooms of Type
                    </Button>
                  </div>
                </div>
              </div>

              {/* Workflow Status */}
              <div className="mt-3 p-3 bg-blue-100 rounded-lg border border-blue-300">
                <h4 className="text-sm font-medium text-blue-800 mb-1">⚡ Smart Workflow Status</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
                  <div className="text-blue-700 leading-snug"><strong>Auto-deactivation:</strong> Rooms automatically deactivate when status changes to maintenance</div>
                  <div className="text-blue-700 leading-snug"><strong>Auto-reactivation:</strong> Rooms automatically reactivate when returning to available status</div>
                  <div className="text-blue-700 leading-snug"><strong>Smart defaults:</strong> Workflow-aware room management with minimal manual intervention</div>
                </div>
              </div>
            </CardBody>
          </Card>
        </Tab>
      </Tabs>

      {/* Edit Room Type Modal */}
      <Modal isOpen={editRoomTypeModalOpen} onClose={() => setEditRoomTypeModalOpen(false)} size="2xl">
        <ModalContent>
          <ModalHeader>Edit Room Type</ModalHeader>
          <ModalBody>
            <div className="space-y-4">
              <Input
                label="Room Type Name"
                placeholder="e.g., Standard, Deluxe"
                value={editRoomType.name}
                onChange={(e) => setEditRoomType({...editRoomType, name: e.target.value})}
              />
              
              <Input
                label="Capacity (Adults)"
                type="number"
                placeholder="2"
                value={editRoomType.capacity}
                onChange={(e) => setEditRoomType({...editRoomType, capacity: e.target.value})}
              />
              <Textarea
                label="Description (Optional)"
                placeholder="Additional details about this room type..."
                value={editRoomType.description}
                onChange={(e) => setEditRoomType({...editRoomType, description: e.target.value})}
              />
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={() => setEditRoomTypeModalOpen(false)}>
              Cancel
            </Button>
            <Button color="primary" onPress={handleUpdateRoomType}>
              Update Room Type
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Edit Room Modal */}
      <Modal isOpen={editRoomModalOpen} onClose={() => setEditRoomModalOpen(false)} size="2xl">
        <ModalContent>
          <ModalHeader>Edit Room</ModalHeader>
          <ModalBody>
            <div className="space-y-4">
              <div className="space-y-1">
                <Input
                  label="Room Number"
                  placeholder="e.g., 101, 2A"
                  value={editRoom.roomNumber}
                  onChange={(e) => setEditRoom({...editRoom, roomNumber: e.target.value})}
                  color={getRoomNumberValidationStatus(editRoom.roomNumber, selectedRoom?.id).color as any}
                  description={getRoomNumberValidationStatus(editRoom.roomNumber, selectedRoom?.id).message}
                />
              </div>
                               <Select
                   label="Room Type"
                   placeholder="Select room type"
                   value={editRoom.type}
                   onChange={(e) => setEditRoom({...editRoom, type: e.target.value})}
                 >
                   {settingsStore.roomManagement.roomTypes.map((type) => (
                     <SelectItem key={type.id}>
                       {type.name}
                     </SelectItem>
                   ))}
                 </Select>
                             <Input
                 label="Floor Identifier"
                 placeholder="e.g., A, B, 1A, 2B"
                 value={editRoom.floor}
                 onChange={(e) => setEditRoom({...editRoom, floor: e.target.value})}
               />
               <Input
                 label="Floor Number"
                 type="number"
                 min="0"
                 placeholder="0 (Ground), 1, 2, 3..."
                 value={editRoom.floorNumber}
                 onChange={(e) => setEditRoom({...editRoom, floorNumber: e.target.value})}
               />
              <Select
                label="Status"
                placeholder="Select status"
                value={editRoom.status}
                onChange={(e) => setEditRoom({...editRoom, status: e.target.value})}
              >
                <SelectItem key="available">Available</SelectItem>
                <SelectItem key="occupied">Occupied</SelectItem>
                <SelectItem key="maintenance">Maintenance</SelectItem>
                <SelectItem key="cleaning">Cleaning</SelectItem>
              </Select>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={() => setEditRoomModalOpen(false)}>
              Cancel
            </Button>
            <Button color="primary" onPress={handleUpdateRoom}>
              Update Room
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Seasonal Rate - Compact Modal */}
      <Modal isOpen={seasonalModalOpen} onClose={() => setSeasonalModalOpen(false)} size="md" backdrop="blur">
        <ModalContent>
          <ModalHeader>Add Seasonal Rate</ModalHeader>
          <ModalBody className="max-h-[60vh] overflow-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input 
                label="Season Name" 
                placeholder="e.g., Peak Season" 
                value={seasonalForm.name}
                onChange={(e) => setSeasonalForm({...seasonalForm, name: e.target.value})}
              />
              <Input 
                label="Multiplier (e.g., 1.2)" 
                type="number" 
                step="0.01"
                value={seasonalForm.multiplier as unknown as string}
                onChange={(e) => setSeasonalForm({...seasonalForm, multiplier: Number(e.target.value)})}
              />
              <Input 
                label="Start Date" 
                type="date" 
                value={seasonalForm.startDate}
                onChange={(e) => setSeasonalForm({...seasonalForm, startDate: e.target.value})}
              />
              <Input 
                label="End Date" 
                type="date" 
                value={seasonalForm.endDate}
                onChange={(e) => setSeasonalForm({...seasonalForm, endDate: e.target.value})}
              />
            </div>
            <Textarea 
              label="Description (Optional)" 
              placeholder="Notes about this seasonal period"
              value={seasonalForm.description}
              onChange={(e) => setSeasonalForm({...seasonalForm, description: e.target.value})}
            />
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={() => setSeasonalModalOpen(false)}>Cancel</Button>
            <Button color="primary" onPress={() => {
              if (!seasonalPlanId || !seasonalForm.name || !seasonalForm.startDate || !seasonalForm.endDate) return;
              const seasonal = {
                id: Date.now().toString(),
                name: seasonalForm.name,
                startDate: seasonalForm.startDate,
                endDate: seasonalForm.endDate,
                multiplier: seasonalForm.multiplier,
                description: seasonalForm.description
              };
              settingsStore.addSeasonalRate(seasonalPlanId, seasonal);
              logAction('ADD_SEASONAL_RATE', { ratePlanId: seasonalPlanId, seasonal });
              setSeasonalModalOpen(false);
            }}>Save Seasonal Rate</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Bulk Add Rooms Modal */}
      <Modal isOpen={bulkModalOpen} onClose={() => setBulkModalOpen(false)} size="2xl">
        <ModalContent>
          <ModalHeader>Bulk Add Rooms</ModalHeader>
          <ModalBody>
            <div className="space-y-4">
              {/* Simple Help Section */}
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <h4 className="font-semibold text-blue-800 mb-2">🎯 Single Floor Room Creation</h4>
                <p className="text-sm text-blue-700 mb-3">
                  Create rooms for a specific building and floor. Perfect for adding floors one by one!
                </p>
                
                                 <div className="grid grid-cols-1 gap-3 text-sm">
                   <div className="p-3 bg-white rounded border">
                     <strong className="text-green-700">Example:</strong> Building 1, Floor A (Floor #1) → 1A01, 1A02, 1A03...
                   </div>
                   <div className="p-3 bg-white rounded border">
                     <strong className="text-blue-700">Then:</strong> Building 1, Floor 2B (Floor #2) → 12B01, 12B02, 12B03...
                   </div>
                   <div className="p-3 bg-white rounded border">
                     <strong className="text-purple-700">Pattern:</strong> Prefix + Building + Floor + Room Number + Suffix
                   </div>
                   <div className="p-3 bg-white rounded border">
                     <strong className="text-orange-700">Floor System:</strong> Floor Identifier (A, B, 1A) + Floor Number (0=Ground, 1=1st, 2=2nd)
                   </div>
                   <div className="p-3 bg-white rounded border">
                     <strong className="text-indigo-700">Analytics:</strong> Floor Number tracks actual level for occupancy, pricing, and maintenance analysis
                   </div>
                 </div>
              </div>
              
              {/* Basic Settings */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Select
                  label="Room Type"
                  placeholder="Select room type"
                  value={bulkRoomData.roomType}
                  onChange={(e) => setBulkRoomData({...bulkRoomData, roomType: e.target.value})}
                >
                  {settingsStore.roomManagement.roomTypes.map((type) => (
                    <SelectItem key={type.id}>
                      {type.name}
                    </SelectItem>
                  ))}
                </Select>
                
                                 <Input
                   label="Building Identifier (Optional)"
                   placeholder="e.g., 1, A, Main"
                   value={bulkRoomData.building}
                   onChange={(e) => setBulkRoomData({...bulkRoomData, building: e.target.value})}
                 />
              </div>
              
                             <div className="grid grid-cols-4 gap-4">
                 <Input
                   label="Floor Identifier (Optional)"
                   placeholder="e.g., 1, A, 1A, 2B"
                   value={bulkRoomData.floor}
                   onChange={(e) => setBulkRoomData({...bulkRoomData, floor: e.target.value})}
                 />
                 
                 <Input
                   label="Floor Number"
                   type="number"
                   min="0"
                   placeholder="0 (Ground), 1, 2, 3..."
                   value={bulkRoomData.floorNumber}
                   onChange={(e) => setBulkRoomData({...bulkRoomData, floorNumber: e.target.value})}
                 />
                 
                 <Input
                   label="Rooms on Floor"
                   type="number"
                   min="1"
                   value={bulkRoomData.roomsOnFloor}
                   onChange={(e) => setBulkRoomData({...bulkRoomData, roomsOnFloor: e.target.value})}
                 />
                 
                 <Input
                   label="Starting Room Number"
                   type="number"
                   min="1"
                   value={bulkRoomData.startRoomNumber}
                   onChange={(e) => setBulkRoomData({...bulkRoomData, startRoomNumber: e.target.value})}
                 />
               </div>
               
               <div className="grid grid-cols-2 gap-4">
                 <Input
                   label="Prefix (Optional)"
                   placeholder="e.g., RM, Suite, VIP"
                   value={bulkRoomData.prefix}
                   onChange={(e) => setBulkRoomData({...bulkRoomData, prefix: e.target.value})}
                 />
                 
                 <Input
                   label="Suffix (Optional)"
                   placeholder="e.g., -VIP, -Suite, -Deluxe"
                   value={bulkRoomData.suffix}
                   onChange={(e) => setBulkRoomData({...bulkRoomData, suffix: e.target.value})}
                 />
               </div>
              
              {/* Preview */}
                             <div className="p-4 bg-green-50 rounded-lg">
                 <p className="text-sm text-green-800">
                   This will create <strong>{getTotalRooms()} rooms</strong> of type "{bulkRoomData.roomType || '[Select Type]'}" 
                   in Building <strong>{bulkRoomData.building || '[Select Building]'}</strong>
                   on Floor <strong>{bulkRoomData.floor || '[Select Floor]'}</strong> (Level {bulkRoomData.floorNumber})
                   starting from room <strong>{bulkRoomData.startRoomNumber}</strong>.
                 </p>
                
                                 {bulkRoomData.building && bulkRoomData.roomType && (
                   <div className="mt-3 p-3 bg-white rounded border">
                     <h5 className="font-medium text-green-800 mb-2">Example Room Numbers:</h5>
                     <div className="text-sm text-green-700">
                       <p>{bulkRoomData.prefix}{bulkRoomData.building}{bulkRoomData.floor}{String(bulkRoomData.startRoomNumber).padStart(2, '0')}{bulkRoomData.suffix}, {bulkRoomData.prefix}{bulkRoomData.building}{bulkRoomData.floor}{String(bulkRoomData.startRoomNumber + 1).padStart(2, '0')}{bulkRoomData.suffix}, {bulkRoomData.prefix}{bulkRoomData.building}{bulkRoomData.floor}{String(bulkRoomData.startRoomNumber + 2).padStart(2, '0')}{bulkRoomData.suffix}...</p>
                     </div>
                   </div>
                 )}
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={() => setBulkModalOpen(false)}>
              Cancel
            </Button>
            <Button color="primary" onPress={handleBulkAddRooms}>
              Add {getTotalRooms()} Rooms
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
