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
import { deskBookTabsClassNames } from './dashboard/deskTabsUi';
import { useSettingsStore } from '../lib/settings/store';
import { frontOfficeStore } from '../lib/frontoffice/store';
import HeadingInfo from './HeadingInfo';
import ServiceChargePricingPanel from './settings/ServiceChargePricingPanel';
import { reverseToSubtotalFromGross } from '../lib/frontoffice/helpers/rates';
// Dynamic imports for PDF generation to avoid SSR issues
// import jsPDF from 'jspdf';
// import 'jspdf-autotable';

/** Derive tax-exclusive subtotal from a stored plan price — via the compliance engine
 * (same source the live preview below uses), not the old disconnected tax/engine.ts. */
function subtotalFromPlanPrice(basePrice: number, priceType?: string): number {
  return priceType === 'gross_total' ? reverseToSubtotalFromGross(basePrice) : basePrice;
}

type BulkRoomMode = 'numbered' | 'named';

function blankBulkRooms() {
  return {
    mode: 'numbered' as BulkRoomMode,
    roomType: '',
    building: '',
    floor: '1',
    floorNumber: '1',
    roomsOnFloor: '1',
    startRoomNumber: '1',
    prefix: '',
    suffix: '',
    names: '',
  };
}

function namedRoomLines(value: string) {
  return value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

/** Digits count up (1 → 01, 02). Letters count A, B, C … Z, AA. */
function roomTokenAt(start: string, offset: number): string {
  const token = start.trim();
  if (/^\d+$/.test(token)) {
    return String(Number(token) + offset).padStart(Math.max(2, token.length), '0');
  }
  if (/^[A-Za-z]+$/.test(token)) {
    const lower = token === token.toLowerCase();
    let n = 0;
    for (const ch of token.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
    n += offset;
    let out = '';
    while (n > 0) {
      n -= 1;
      out = String.fromCharCode((n % 26) + 65) + out;
      n = Math.floor(n / 26);
    }
    return lower ? out.toLowerCase() : out;
  }
  const mixed = /^(.*?)(\d+)$/.exec(token);
  if (mixed) {
    return `${mixed[1]}${String(Number(mixed[2]) + offset).padStart(mixed[2].length, '0')}`;
  }
  return offset === 0 ? token : `${token}${offset + 1}`;
}

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
  useEffect(() => {
    try {
      const tab = localStorage.getItem('rooms.tab');
      if (tab === 'operations-policies') {
        localStorage.removeItem('rooms.tab');
        localStorage.setItem('settings.tab', 'policies');
        window.dispatchEvent(new Event('settings-navigate'));
      } else if (tab && tab !== 'event-rates' && tab !== 'bulk-operations') {
        localStorage.removeItem('rooms.tab');
        setActiveTab(tab);
      } else if (tab) {
        localStorage.removeItem('rooms.tab');
      }
    } catch {}
  }, []);
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
  const [seasonalFormError, setSeasonalFormError] = useState<string | null>(null);

  const [roomTypeFormError, setRoomTypeFormError] = useState<string | null>(null);
  const [editRoomTypeFormError, setEditRoomTypeFormError] = useState<string | null>(null);
  const [ratePlanFormError, setRatePlanFormError] = useState<string | null>(null);
  const [editRatePlanFormError, setEditRatePlanFormError] = useState<string | null>(null);
  const [, setFoTick] = useState(0);

  // Deep-link handler from Settings Overview — moved out of the render body (was calling
  // setActiveTab/localStorage.removeItem directly during render, which is unsafe under
  // concurrent rendering: a render that's discarded before committing could clear the
  // flag without ever actually switching tabs).
  useEffect(() => {
    try {
      const requested = localStorage.getItem('room-config.openTab');
      if (requested === 'operations-policies') {
        localStorage.removeItem('room-config.openTab');
        localStorage.setItem('settings.tab', 'policies');
        window.dispatchEvent(new Event('settings-navigate'));
      } else if (requested && requested !== 'event-rates' && requested !== 'bulk-operations') {
        setActiveTab(requested);
        localStorage.removeItem('room-config.openTab');
      } else if (requested) {
        localStorage.removeItem('room-config.openTab');
      }
    } catch {}
  }, []);

  useEffect(() => frontOfficeStore.subscribe(() => setFoTick((n) => n + 1)), []);
  
  // Sorting states
  const [roomsSortField, setRoomsSortField] = useState<string>('number');
  const [roomsSortDirection, setRoomsSortDirection] = useState<'asc' | 'desc'>('asc');
  const [ratePlansSortField, setRatePlansSortField] = useState<string>('name');
  const [ratePlansSortDirection, setRatePlansSortDirection] = useState<'asc' | 'desc'>('asc');
  
  // Visual display state
  const [visualDisplayExpanded, setVisualDisplayExpanded] = useState(false);
  
  const settingsStore = useSettingsStore();
  const canManageRoomPricing = settingsStore.hasPermission('settings.manage-rooms-pricing');

  // Form states
  const [newRoomType, setNewRoomType] = useState({
    name: '',
    capacity: '1', // Keep as string for input compatibility
    baseRate: '0',
    description: ''
  });

  const [editRoomType, setEditRoomType] = useState({
    name: '',
    capacity: '1', // Keep as string for input compatibility
    baseRate: '0',
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
    marketSegment: string;
    mealPlan: 'room_only' | 'bed_breakfast' | 'half_board' | 'full_board';
  }>({
    name: '',
    roomType: '',
    price: '0', // Keep as string for input compatibility
    priceType: 'subtotal',
    description: '',
    marketSegment: 'Leisure',
    mealPlan: 'room_only'
  });
  
  const [bulkRoomData, setBulkRoomData] = useState(blankBulkRooms);

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
    if (!canManageRoomPricing) { setRoomTypeFormError('You do not have permission to manage room types.'); return; }
    const baseRate = Number(newRoomType.baseRate);
    const capacity = Number(newRoomType.capacity);
    if (!newRoomType.name.trim()) {
      setRoomTypeFormError('Room type name is required.');
      return;
    }
    if (!(baseRate > 0)) {
      setRoomTypeFormError('Fallback Rate must be greater than 0.');
      return;
    }
    if (!(capacity > 0)) {
      setRoomTypeFormError('Capacity must be greater than 0.');
      return;
    }
    const nameTaken = settingsStore.roomManagement.roomTypes.some(
      rt => rt.name.trim().toLowerCase() === newRoomType.name.trim().toLowerCase()
    );
    if (nameTaken) {
      setRoomTypeFormError(`A room type named "${newRoomType.name}" already exists.`);
      return;
    }
    setRoomTypeFormError(null);
    {
             const roomType: RoomType = {
         id: Date.now().toString(),
         name: newRoomType.name,
         baseRate,
         capacity, // Convert string to number
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
      setNewRoomType({ name: '', capacity: '1', baseRate: '0', description: '' });
    }
  };

  const handleEditRoomType = (roomType: RoomType) => {
    setSelectedRoomType(roomType);
    setEditRoomType({
      name: roomType.name,
      capacity: roomType.capacity.toString(), // Convert number to string for form
      baseRate: (roomType.baseRate ?? 0).toString(),
      description: roomType.description || ''
    });
    setEditRoomTypeFormError(null);
    setEditRoomTypeModalOpen(true);
    logAction('EDIT_ROOM_TYPE_OPEN', { roomType });
  };

  const handleUpdateRoomType = () => {
    if (!canManageRoomPricing) { setEditRoomTypeFormError('You do not have permission to manage room types.'); return; }
    const baseRate = Number(editRoomType.baseRate);
    const capacity = Number(editRoomType.capacity);
    if (!selectedRoomType) return;
    if (!editRoomType.name.trim()) {
      setEditRoomTypeFormError('Room type name is required.');
      return;
    }
    if (!(baseRate > 0)) {
      setEditRoomTypeFormError('Fallback Rate must be greater than 0.');
      return;
    }
    if (!(capacity > 0)) {
      setEditRoomTypeFormError('Capacity must be greater than 0.');
      return;
    }
    const nameTaken = settingsStore.roomManagement.roomTypes.some(
      rt => rt.id !== selectedRoomType.id && rt.name.trim().toLowerCase() === editRoomType.name.trim().toLowerCase()
    );
    if (nameTaken) {
      setEditRoomTypeFormError(`A room type named "${editRoomType.name}" already exists.`);
      return;
    }
    const updates = {
      name: editRoomType.name,
      capacity, // Convert string to number
      baseRate,
      description: editRoomType.description
    };

    settingsStore.updateRoomType(selectedRoomType.id, updates);
    logAction('UPDATE_ROOM_TYPE', { roomTypeId: selectedRoomType.id, updates });
    setEditRoomTypeFormError(null);
    setEditRoomTypeModalOpen(false);
    setSelectedRoomType(null);
  };

  const roomHasStayHistory = (room: { id: string; number: string }) =>
    frontOfficeStore.reservationUsesRoom(room);

  const roomTypeHasStayHistory = (typeId: string) =>
    frontOfficeStore.roomTypeHasHistory(typeId) ||
    settingsStore.roomManagement.rooms.some((room) => room.typeId === typeId && roomHasStayHistory(room));

  const handleDeleteRoomType = async (roomType: RoomType) => {
    if (!canManageRoomPricing) { alert('You do not have permission to manage room types.'); return; }
    const used = roomTypeHasStayHistory(roomType.id);
    if (used) {
      if (!roomType.isActive) {
        alert(`${roomType.name} has stay history and cannot be deleted. It is already inactive.`);
        return;
      }
      const { confirmDanger } = await import('./DangerConfirm');
      const retire = await confirmDanger({
        tone: 'delete',
        title: `Deactivate ${roomType.name}?`,
        message: 'This room type has reservations and cannot be deleted. It will be marked Inactive so it stays off new bookings. History is kept.',
        confirmLabel: 'Deactivate',
      });
      if (!retire) return;
      settingsStore.updateRoomType(roomType.id, { isActive: false });
      logAction('DEACTIVATE_ROOM_TYPE', { roomTypeId: roomType.id });
      return;
    }
    const { confirmDelete } = await import('./DangerConfirm');
    if (!(await confirmDelete(roomType.name, 'Unused rooms of this type will also be removed. This cannot be undone.'))) {
      return;
    }
    const roomsToDelete = settingsStore.roomManagement.rooms.filter(room => room.typeId === roomType.id);
    roomsToDelete.forEach(room => {
      settingsStore.deleteRoom(room.id);
      logAction('DELETE_ROOM', { roomId: room.id, roomNumber: room.number });
    });
    settingsStore.deleteRoomType(roomType.id);
    logAction('DELETE_ROOM_TYPE', { roomType });
  };

  const handleActivateRoomType = (roomType: RoomType) => {
    if (!canManageRoomPricing) { alert('You do not have permission to manage room types.'); return; }
    settingsStore.updateRoomType(roomType.id, { isActive: true });
    logAction('ACTIVATE_ROOM_TYPE', { roomTypeId: roomType.id });
  };

    const handleAddRoom = () => {
    if (!canManageRoomPricing) { alert('You do not have permission to manage rooms.'); return; }
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
    if (!canManageRoomPricing) { alert('You do not have permission to manage rooms.'); return; }
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

  const handleDeleteRoom = async (room: Room) => {
    if (!canManageRoomPricing) { alert('You do not have permission to manage rooms.'); return; }
    if (roomHasStayHistory(room)) {
      if (!room.isActive) {
        alert(`Room ${room.number} has stay history and cannot be deleted. It is already inactive.`);
        return;
      }
      const { confirmDanger } = await import('./DangerConfirm');
      const retire = await confirmDanger({
        tone: 'delete',
        title: `Deactivate room ${room.number}?`,
        message: 'This room has reservations and cannot be deleted. It will be marked Inactive so it stays off new bookings. History is kept.',
        confirmLabel: 'Deactivate',
      });
      if (!retire) return;
      settingsStore.updateRoom(room.id, { isActive: false });
      logAction('DEACTIVATE_ROOM', { roomId: room.id, roomNumber: room.number });
      return;
    }
    const { confirmDelete } = await import('./DangerConfirm');
    if (!(await confirmDelete(`room ${room.number}`, 'This room will be permanently removed. This cannot be undone.'))) {
      return;
    }
    settingsStore.deleteRoom(room.id);
    logAction('DELETE_ROOM', { roomId: room.id, roomNumber: room.number });
  };

  const handleToggleRoomActive = async (room: Room) => {
    const newActiveState = !room.isActive;
    const action = newActiveState ? 'activate' : 'deactivate';
    const { confirmChoice } = await import('./DangerConfirm');
    const ok = await confirmChoice(
      `${newActiveState ? 'Activate' : 'Deactivate'} room ${room.number}?`,
      newActiveState
        ? 'The room will show as active and can be sold again.'
        : 'The room will be hidden from new bookings. History is kept.',
      newActiveState ? 'Activate' : 'Deactivate',
    );
    if (!ok) return;
    settingsStore.updateRoom(room.id, { isActive: newActiveState });
    logAction('TOGGLE_ROOM_ACTIVE', {
      roomId: room.id,
      roomNumber: room.number,
      newState: newActiveState,
    });
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

  const handleAddRatePlan = () => {
    if (!canManageRoomPricing) { setRatePlanFormError('You do not have permission to manage rate plans.'); return; }
    if (!newRatePlan.name.trim()) {
      setRatePlanFormError('Rate plan name is required.');
      return;
    }
    if (!newRatePlan.roomType) {
      setRatePlanFormError('Room type is required.');
      return;
    }
    if (!(Number(newRatePlan.price) > 0)) {
      setRatePlanFormError('Price must be greater than 0.');
      return;
    }
    const nameTaken = settingsStore.roomManagement.ratePlans.some(
      p => p.roomTypeId === newRatePlan.roomType && p.name.trim().toLowerCase() === newRatePlan.name.trim().toLowerCase()
    );
    if (nameTaken) {
      setRatePlanFormError(`A rate plan named "${newRatePlan.name}" already exists for this room type.`);
      return;
    }
    setRatePlanFormError(null);
    {
      const ratePlan = {
        id: Date.now().toString(),
        name: newRatePlan.name,
        roomTypeId: newRatePlan.roomType,
        basePrice: Number(newRatePlan.price), // Convert string to number
        priceType: newRatePlan.priceType,
        rateType: 'standard',
                 isActive: true,
         marketSegment: newRatePlan.marketSegment,
         mealPlan: newRatePlan.mealPlan,
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
      
      settingsStore.addRatePlan(ratePlan as any);
      logAction('ADD_RATE_PLAN', { ratePlan });
      setNewRatePlan({ name: '', roomType: '', price: '0', priceType: 'subtotal', description: '', marketSegment: 'Leisure', mealPlan: 'room_only' });
    }
  };

  const handleUpdateRatePlan = () => {
    if (!canManageRoomPricing) { setEditRatePlanFormError('You do not have permission to manage rate plans.'); return; }
    const price = Number(editRatePlanForm.price);
    if (!selectedRatePlan) return;
    if (!editRatePlanForm.name.trim()) {
      setEditRatePlanFormError('Rate plan name is required.');
      return;
    }
    if (!editRatePlanForm.roomType) {
      setEditRatePlanFormError('Room type is required.');
      return;
    }
    if (!(price > 0)) {
      setEditRatePlanFormError('Price must be greater than 0.');
      return;
    }
    const nameTaken = settingsStore.roomManagement.ratePlans.some(
      p => p.id !== selectedRatePlan.id && p.roomTypeId === editRatePlanForm.roomType && p.name.trim().toLowerCase() === editRatePlanForm.name.trim().toLowerCase()
    );
    if (nameTaken) {
      setEditRatePlanFormError(`A rate plan named "${editRatePlanForm.name}" already exists for this room type.`);
      return;
    }
    const updates = {
      name: editRatePlanForm.name,
      roomTypeId: editRatePlanForm.roomType,
      basePrice: price,
      priceType: editRatePlanForm.priceType,
      lastUpdated: new Date().toISOString(),
    };
    settingsStore.updateRatePlan(selectedRatePlan.id, updates as any);
    logAction('UPDATE_RATE_PLAN', { ratePlanId: selectedRatePlan.id, updates });
    setEditRatePlanFormError(null);
    setEditRatePlanModalOpen(false);
    setSelectedRatePlan(null);
  };

  const numberedRoomLabel = (offset: number) => {
    const token = roomTokenAt(bulkRoomData.startRoomNumber || '1', offset);
    return `${bulkRoomData.prefix}${bulkRoomData.building || ''}${bulkRoomData.floor || ''}${token}${bulkRoomData.suffix}`;
  };

  const bulkRoomLabels = () => {
    if (bulkRoomData.mode === 'named') return namedRoomLines(bulkRoomData.names);
    const count = Number(bulkRoomData.roomsOnFloor);
    if (!Number.isFinite(count) || count < 1) return [];
    return Array.from({ length: count }, (_, offset) => numberedRoomLabel(offset));
  };

  const handleBulkAddRooms = () => {
    if (!bulkRoomData.roomType) return;
    const labels = bulkRoomLabels();
    if (labels.length === 0) return;

    const seen = new Set<string>();
    for (const roomNumber of labels) {
      const key = roomNumber.toLowerCase();
      if (seen.has(key) || settingsStore.roomManagement.rooms.some((room) => room.number.trim().toLowerCase() === key)) {
        alert(`Room "${roomNumber}" is already used. Each room name has to be unique.`);
        logAction('BULK_DUPLICATE_ROOM_NUMBER_ATTEMPT', { attemptedNumber: roomNumber, bulkSettings: bulkRoomData });
        return;
      }
      seen.add(key);
    }

    const rooms: Room[] = labels.map((roomNumber) => ({
      id: Date.now().toString() + Math.random(),
      number: roomNumber,
      typeId: bulkRoomData.roomType,
      floor: bulkRoomData.floor || '1',
      floorNumber: Number(bulkRoomData.floorNumber),
      status: 'available',
      isActive: true,
      notes: '',
      features: [],
      maintenance: {
        lastInspection: '',
        nextInspection: '',
        issues: [],
      },
    }));

    rooms.forEach((room) => {
      settingsStore.addRoom(room);
      logAction('BULK_ADD_ROOM', { room });
    });
    logAction('BULK_ADD_ROOMS_COMPLETE', {
      totalRooms: rooms.length,
      mode: bulkRoomData.mode,
      building: bulkRoomData.building,
      floor: bulkRoomData.floor,
    });
    setBulkModalOpen(false);
    setBulkRoomData(blankBulkRooms());
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

  const getTotalRooms = () => bulkRoomLabels().length;

  const getRoomCountByType = (typeId: string) => {
    return settingsStore.roomManagement.rooms.filter(room => room.typeId === typeId).length;
  };

  // "Available" mirrors Front Office's own definition (bookable housekeeping
  // states) — room.status here is a housekeeping status (vacant/clean/
  // inspected/dirty/occupied/maintenance), never the literal string
  // 'available', so that exact-match check always returned zero.
  const getAvailableRoomCountByType = (typeId: string) => {
    return settingsStore.roomManagement.rooms.filter(room =>
      room.typeId === typeId && ['vacant', 'clean', 'inspected'].includes(room.status)
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

  // Price preview helpers via compliance engine. reverseToSubtotalFromGross is the one
  // shared implementation (also used by frontoffice/helpers/rates.ts for the actual
  // check-in charge) so this preview and the real guest charge can never diverge.
  const { useCalculateTax } = require('../hooks/useCalculateTax');
  const calcTax = useCalculateTax?.() || ((a: number) => ({ taxes: [], total: a }));
  const computeTaxBreakdown = (base: number) => {
    const category = 'HOTEL';
    const context = { numPersons: 1, numNights: 1 };
    const { taxes, total } = calcTax(base, category, context);
    const mapped: any = { subtotal: base, totalTax: taxes.reduce((s: number, t: any) => s + t.amount, 0), finalBill: total };
    taxes.forEach((t: any) => {
      const key = t.name.toLowerCase().replace(/[^a-z]/g, '');
      mapped[key] = t.amount;
      mapped[`${key}Rate`] = t.rate;
    });
    if (mapped.vatstandardrate != null) { mapped.vat = mapped.vatstandardrate; mapped.vatRate = mapped.vatstandardrateRate; }
    if (mapped.tourismlevy != null) { mapped.tourism = mapped.tourismlevy; mapped.tourismRate = mapped.tourismlevyRate; }
    if (mapped.getfundlevy != null) { mapped.getfund = mapped.getfundlevy; mapped.getfundRate = mapped.getfundlevyRate; }
    return mapped;
  };

  /** Rates snapshot (fraction of a ₵100 sample) for currency config — sourced from the
   * compliance engine's active rules, not the old disconnected tax/engine.ts. */
  const getCanonicalRates = () => {
    const { taxes } = calcTax(100, 'HOTEL', { numPersons: 1, numNights: 1 });
    const rateOf = (nameIncludes: string) => taxes.find((t: any) => t.name.toLowerCase().includes(nameIncludes))?.rate ?? 0;
    return { vat: rateOf('vat'), nhil: rateOf('nhil'), getfund: rateOf('getfund'), tourismLevy: rateOf('tourism') };
  };

  const getLivePreview = () => {
    if (!newRatePlan.price || Number(newRatePlan.price) <= 0) return null;
    const baseForCalc = newRatePlan.priceType === 'subtotal'
      ? Number(newRatePlan.price)
      : reverseToSubtotalFromGross(Number(newRatePlan.price), 'HOTEL', { numPersons: 1, numNights: 1 });
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
        // Only "subtotal" and "gross_total" are valid values for priceType
        const subtotal = subtotalFromPlanPrice(transformedPlan.basePrice, transformedPlan.priceType);
        const { nhil, getfund, vat, tourism, totalTax } = computeTaxBreakdown(subtotal);
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
    USD: { symbol: '$', name: 'US Dollar', taxRates: { vat: 0, nhil: 0, getfund: 0, tourism: 0 } },
    GBP: { symbol: '£', name: 'British Pound', taxRates: { vat: 0.20, nhil: 0, getfund: 0, tourism: 0 } },
    EUR: { symbol: '€', name: 'Euro', taxRates: { vat: 0.21, nhil: 0, getfund: 0, tourism: 0 } },
    GHS: (() => {
      const r = getCanonicalRates();
      return {
        symbol: '₵',
        name: 'Ghanaian Cedi',
        taxRates: { vat: r.vat / 100, nhil: r.nhil / 100, getfund: r.getfund / 100, tourism: r.tourismLevy / 100 },
      };
    })()
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
    <div className="pt-2">
      <div className="mb-3 flex items-center gap-1.5">
        <h1 className="text-xl font-bold text-ghana-black">🏠 Rooms & Pricing</h1>
        <HeadingInfo label="About rooms and pricing">Manage room types, rate plans, service charges, and seasonal pricing</HeadingInfo>
      </div>

      <Tabs 
        selectedKey={activeTab} 
        onSelectionChange={(key) => setActiveTab(key as string)}
        className="w-full"
        size="sm"
        variant="solid"
        classNames={deskBookTabsClassNames}
      >
        <Tab key="room-types" title="Room Types & Categories">
                     <Card className="mb-6">
             <CardHeader className="justify-between gap-2">
               <div className="flex items-center gap-1.5">
                 <h3 className="text-xl font-semibold">Add New Room Type</h3>
                 <HeadingInfo label="About the fallback rate">
                   Fallback Rate is the nightly subtotal charged until a Rate Plan is set up for this room type, in the Rate Plans tab.
                 </HeadingInfo>
               </div>
               <Button
                 color="primary"
                 variant="flat"
                 size="sm"
                 onClick={() => setBulkModalOpen(true)}
               >
                 Bulk Add Rooms
               </Button>
             </CardHeader>
             <CardBody>
               {roomTypeFormError && (
                 <div className="mb-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
                   {roomTypeFormError}
                 </div>
               )}
               <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                 <Input
                   label="Room Type Name"
                   placeholder="e.g., Standard, Deluxe"
                   value={newRoomType.name}
                   onChange={(e) => { setNewRoomType({...newRoomType, name: e.target.value}); setRoomTypeFormError(null); }}
                 />

                 <Input
                   label="Capacity (Adults)"
                   type="number"
                   min={1}
                   placeholder="2"
                   value={newRoomType.capacity}
                   onChange={(e) => setNewRoomType({...newRoomType, capacity: e.target.value})}
                 />
                 <Input
                   label={
                     <span className="flex items-center gap-1">
                       Fallback Rate (₵/night)
                       <Tooltip content="Subtotal (tax-exclusive) — tax is added on top at checkout, same as a Rate Plan's default pricing.">
                         <span className="text-gray-400 cursor-help">ⓘ</span>
                       </Tooltip>
                     </span>
                   }
                   type="number"
                   min={0.01}
                   step="0.01"
                   placeholder="e.g., 450"
                   value={newRoomType.baseRate}
                   onChange={(e) => setNewRoomType({...newRoomType, baseRate: e.target.value})}
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
                      <div className="flex items-center gap-2">
                        <h4 className="text-lg font-semibold text-ghana-black">{type.name}</h4>
                        {!type.isActive && (
                          <Chip size="sm" variant="flat">Inactive</Chip>
                        )}
                      </div>
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
                      <Tooltip content={roomTypeHasStayHistory(type.id) ? (type.isActive ? 'Deactivate Room Type' : 'Activate Room Type') : 'Delete Room Type'}>
                        <Button 
                          size="sm" 
                          variant="light" 
                          color={roomTypeHasStayHistory(type.id) ? (type.isActive ? 'warning' : 'success') : 'danger'} 
                          isIconOnly
                          onClick={() => roomTypeHasStayHistory(type.id) && !type.isActive ? handleActivateRoomType(type) : handleDeleteRoomType(type)}
                        >
                          {roomTypeHasStayHistory(type.id) ? (type.isActive ? '⏸️' : '▶️') : '🗑️'}
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
                <p className="text-sm text-gray-500">
                  {selectedAmenitiesRoomTypeId
                    ? `Changes save automatically as you toggle amenities for ${getRoomTypeName(selectedAmenitiesRoomTypeId)}.`
                    : 'Select a room type above to manage its amenities — changes save automatically.'}
                </p>
              </div>
            </CardBody>
          </Card>
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
                <div className="grid gap-2 grid-cols-[repeat(auto-fill,minmax(7.5rem,1fr))]">
                  {settingsStore.roomManagement.rooms.map((room) => (
                    <div
                      key={room.id}
                      className="relative group cursor-pointer"
                      onClick={() => handleEditRoom(room)}
                    >
                      <Card className="min-h-[4.5rem] border border-gray-300 hover:border-blue-400 transition-all duration-200 hover:shadow-sm">
                        <CardBody className="p-2 pt-3 text-center overflow-hidden justify-center">
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
                                  className="min-w-6 w-6 h-6"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleEditRoom(room);
                                  }}
                                >
                                  ✏️
                                </Button>
                              </Tooltip>
                              {roomHasStayHistory(room) ? (
                              <Tooltip content={room.isActive ? 'Deactivate Room' : 'Activate Room'}>
                                <Button 
                                  size="sm" 
                                  variant="light" 
                                  color={room.isActive ? 'warning' : 'success'}
                                  isIconOnly
                                  className="min-w-6 w-6 h-6"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    room.isActive ? handleDeleteRoom(room) : handleToggleRoomActive(room);
                                  }}
                                >
                                  {room.isActive ? '⏸️' : '▶️'}
                                </Button>
                              </Tooltip>
                              ) : (
                              <>
                              <Tooltip content="Delete Room">
                                <Button 
                                  size="sm" 
                                  variant="light" 
                                  color="danger" 
                                  isIconOnly
                                  className="min-w-6 w-6 h-6"
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
                                  className="min-w-6 w-6 h-6"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleToggleRoomActive(room);
                                  }}
                                >
                                  {room.isActive ? '⏸️' : '▶️'}
                                </Button>
                              </Tooltip>
                              </>
                              )}
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
                  <div className="grid gap-2 grid-cols-[repeat(auto-fill,minmax(7.5rem,1fr))]">
                    {settingsStore.roomManagement.rooms.slice(0, 24).map((room) => (
                      <div
                        key={room.id}
                        className="relative group cursor-pointer"
                        onClick={() => handleEditRoom(room)}
                      >
                        <Card className="min-h-[4.5rem] border border-gray-300 hover:border-blue-400 transition-all duration-200 hover:shadow-sm">
                          <CardBody className="p-2 pt-3 text-center overflow-hidden justify-center">
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
                                    className="min-w-6 w-6 h-6"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleEditRoom(room);
                                    }}
                                  >
                                    ✏️
                                  </Button>
                                </Tooltip>
                                {roomHasStayHistory(room) ? (
                                <Tooltip content={room.isActive ? 'Deactivate Room' : 'Activate Room'}>
                                  <Button 
                                    size="sm" 
                                    variant="light" 
                                    color={room.isActive ? 'warning' : 'success'}
                                    isIconOnly
                                    className="min-w-6 w-6 h-6"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      room.isActive ? handleDeleteRoom(room) : handleToggleRoomActive(room);
                                    }}
                                  >
                                    {room.isActive ? '⏸️' : '▶️'}
                                  </Button>
                                </Tooltip>
                                ) : (
                                <>
                                <Tooltip content="Delete Room">
                                  <Button 
                                    size="sm" 
                                    variant="light" 
                                    color="danger" 
                                    isIconOnly
                                    className="min-w-6 w-6 h-6"
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
                                    className="min-w-6 w-6 h-6"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleToggleRoomActive(room);
                                    }}
                                  >
                                    {room.isActive ? '⏸️' : '▶️'}
                                  </Button>
                                </Tooltip>
                                </>
                                )}
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
                             <Table
                               aria-label="Rooms table"
                               classNames={{
                                 base: 'overflow-x-auto',
                                 table: '!min-w-[48rem] !w-max !table-auto',
                               }}
                             >
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
                          {roomHasStayHistory(room) ? (
                          <Tooltip content={room.isActive ? 'Deactivate Room' : 'Activate Room'}>
                            <Button 
                              size="sm" 
                              variant="light" 
                              color={room.isActive ? 'warning' : 'success'}
                              isIconOnly
                              onClick={() => room.isActive ? handleDeleteRoom(room) : handleToggleRoomActive(room)}
                            >
                              {room.isActive ? '⏸️' : '▶️'}
                            </Button>
                          </Tooltip>
                          ) : (
                          <>
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
                          </>
                          )}
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
          <Card className="mb-6">
            <CardHeader className="flex items-center justify-between">
              <h3 className="text-xl font-semibold">Add New Rate Plan</h3>
              <Tooltip
                content={(() => {
                  const exampleBase = 600;
                  const { totalTax: exampleTax } = computeTaxBreakdown(exampleBase);
                  const exampleGross = exampleBase + exampleTax;
                  return (
                    <div className="max-w-sm text-sm space-y-2 p-1">
                      <div>
                        <strong className="text-blue-700">Subtotal (Before Tax):</strong> you set the base room rate,
                        taxes are added on top. Guest pays Base Rate + Taxes — e.g. ₵{exampleBase.toFixed(2)} + ₵{exampleTax.toFixed(2)} = ₵{exampleGross.toFixed(2)}.
                      </div>
                      <div>
                        <strong className="text-blue-700">Gross Total (Including Tax):</strong> you set the final guest price,
                        taxes are already included in it. Guest pays exactly ₵{exampleGross.toFixed(2)}.
                      </div>
                      <div className="text-gray-600">💡 Use Subtotal to control base revenue, Gross Total to control the final guest price.</div>
                    </div>
                  );
                })()}
              >
                <span
                  role="img"
                  aria-label="Understanding Price Types"
                  className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center cursor-pointer select-none text-sm font-semibold"
                  title="Understanding Price Types"
                >
                  i
                </span>
              </Tooltip>
            </CardHeader>
            <CardBody>
              {ratePlanFormError && (
                <div className="mb-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
                  {ratePlanFormError}
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <Input
                  label="Rate Plan Name"
                  placeholder="e.g., Weekend Special, Corporate Rate"
                  value={newRatePlan.name}
                  onChange={(e) => { setNewRatePlan({...newRatePlan, name: e.target.value}); setRatePlanFormError(null); }}
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
                <Input
                  label={`Price (₵) - ${newRatePlan.priceType === 'subtotal' ? 'Subtotal' : 'Gross Total'}`}
                  type="number"
                  placeholder="750"
                  value={newRatePlan.price}
                  onChange={(e) => setNewRatePlan({...newRatePlan, price: e.target.value})}
                />
                <Select
                  label="Market Segment"
                  placeholder="Select market segment"
                  value={newRatePlan.marketSegment}
                  onChange={(e) => setNewRatePlan({...newRatePlan, marketSegment: e.target.value})}
                >
                  <SelectItem key="Leisure">Leisure</SelectItem>
                  <SelectItem key="Business">Business</SelectItem>
                  <SelectItem key="Corporate">Corporate</SelectItem>
                  <SelectItem key="Group">Group</SelectItem>
                </Select>
                <Select
                  label="Meal Plan"
                  placeholder="Select meal plan"
                  value={newRatePlan.mealPlan}
                  onChange={(e) => setNewRatePlan({...newRatePlan, mealPlan: e.target.value as typeof newRatePlan.mealPlan})}
                >
                  <SelectItem key="room_only">Room Only</SelectItem>
                  <SelectItem key="bed_breakfast">Bed & Breakfast</SelectItem>
                  <SelectItem key="half_board">Half Board</SelectItem>
                  <SelectItem key="full_board">Full Board</SelectItem>
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

              {/* Live tax preview — rates in the labels come from the live preview itself
                  (i.e. the real Tax Rate Builder config), not hardcoded percentages, so this
                  never goes stale if VAT/NHIL/GETFund/Tourism rates change there. */}
              {(() => {
                const preview = getLivePreview();
                if (!preview) return null;
                const getfundAmt = preview.getfundlevy ?? preview.getfund;
                const getfundRate = preview.getfundlevyRate ?? preview.getfundRate;
                const pct = (r: number | undefined) => Number.isFinite(r) ? `${(r as number).toFixed(1).replace(/\.0$/, '')}%` : '—';
                return (
                <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 bg-gray-50 p-4 rounded-lg border">
                  <div>
                    <h4 className="font-medium mb-2">Live Preview</h4>
                    <div className="text-sm text-gray-700">
                      <div className="flex justify-between"><span>Base (Subtotal):</span><span className="font-mono">₵{preview.subtotal?.toFixed(2) || '0.00'}</span></div>
                      <div className="flex justify-between"><span>NHIL ({pct(preview.nhilRate)}):</span><span className="font-mono">₵{preview.nhil?.toFixed(2) || '0.00'}</span></div>
                      <div className="flex justify-between"><span>GETFund ({pct(getfundRate)}):</span><span className="font-mono">₵{getfundAmt?.toFixed(2) || '0.00'}</span></div>
                      <div className="flex justify-between"><span>VAT ({pct(preview.vatRate)} on base+levies):</span><span className="font-mono">₵{preview.vat?.toFixed(2) || '0.00'}</span></div>
                      <div className="flex justify-between"><span>Tourism Levy ({pct(preview.tourismRate)}):</span><span className="font-mono">₵{preview.tourism?.toFixed(2) || '0.00'}</span></div>
                    </div>
                  </div>
                  <div className="flex items-center">
                    <div className="w-full">
                      <div className="flex justify-between text-sm text-gray-700">
                        <span>Total Tax:</span>
                        <span className="font-mono font-semibold text-red-600">₵{preview.totalTax?.toFixed(2) || '0.00'}</span>
                      </div>
                      <div className="flex justify-between text-base mt-2">
                        <span className="text-gray-800 font-medium">Guest Pays:</span>
                        <span className="font-mono font-bold text-green-700">₵{preview.finalBill?.toFixed(2) || '0.00'}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 self-end">
                    Changes respond instantly to price and price type. Switch between Subtotal and Gross Total anytime.
                  </div>
                </div>
                );
              })()}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <h3 className="text-xl font-semibold">All Rate Plans</h3>
            </CardHeader>
            <CardBody>
                             <Table
                               aria-label="Rate plans table"
                               classNames={{
                                 base: 'overflow-x-auto',
                                 table: '!min-w-[72rem] !w-max !table-auto',
                               }}
                             >
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
                          const subtotal = subtotalFromPlanPrice(plan.basePrice, plan.priceType || 'subtotal');
                          const { nhil, getfund, vat, tourism } = computeTaxBreakdown(subtotal);
                          const finalBill = subtotal + nhil + getfund + vat + tourism;
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
                                setEditRatePlanForm({
                                  name: plan.name,
                                  roomType: plan.roomTypeId,
                                  price: String(plan.basePrice ?? 0),
                                  currency: 'GHS',
                                  priceType: (plan.priceType as 'subtotal' | 'gross_total') || 'subtotal',
                                  description: (plan as any).description || '',
                                });
                                setEditRatePlanFormError(null);
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
                              onClick={async () => {
                                if (!canManageRoomPricing) { alert('You do not have permission to manage rate plans.'); return; }
                                const { confirmDelete } = await import('./DangerConfirm');
                                if (await confirmDelete(plan.name, 'This rate plan will be permanently removed.')) {
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
                                setSeasonalFormError(null);
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
                    const subtotal = subtotalFromPlanPrice(transformedPlan.basePrice, transformedPlan.priceType);
                    const { nhil, getfund, vat, tourism, totalTax } = computeTaxBreakdown(subtotal);
                    const grossTotal = subtotal + totalTax;
                    const canonicalRates = getCanonicalRates();
                    const fmtRate = (r: number | undefined) => Number.isFinite(r) ? `${(r as number).toFixed(1).replace(/\.0$/, '')}%` : '—';

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
                              <span className="text-sm text-gray-600">NHIL ({fmtRate(canonicalRates.nhil)}):</span>
                              <span className="font-mono text-orange-600">₵{nhil.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-600">GETFund ({fmtRate(canonicalRates.getfund)}):</span>
                              <span className="font-mono text-orange-600">₵{getfund.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-600">VAT ({fmtRate(canonicalRates.vat)}):</span>
                              <span className="font-mono text-orange-600">₵{vat.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-600">Tourism ({fmtRate(canonicalRates.tourismLevy)}):</span>
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
                                <p>• NHIL + GETFund = {subtotal > 0 ? ((nhil + getfund) / subtotal * 100).toFixed(1) : '0.0'}% of base</p>
                                <p>• VAT = {fmtRate(canonicalRates.vat)} of (base + levies)</p>
                                <p>• Tourism = {fmtRate(canonicalRates.tourismLevy)} of base</p>
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

        <Tab key="service-charges" title="🏊 Service Charges">
          <ServiceChargePricingPanel />
        </Tab>

      </Tabs>

      {/* Edit Room Type Modal */}
      <Modal isOpen={editRoomTypeModalOpen} onClose={() => setEditRoomTypeModalOpen(false)} size="2xl">
        <ModalContent>
          <ModalHeader>Edit Room Type</ModalHeader>
          <ModalBody>
            {editRoomTypeFormError && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
                {editRoomTypeFormError}
              </div>
            )}
            <div className="space-y-4">
              <Input
                label="Room Type Name"
                placeholder="e.g., Standard, Deluxe"
                value={editRoomType.name}
                onChange={(e) => { setEditRoomType({...editRoomType, name: e.target.value}); setEditRoomTypeFormError(null); }}
              />
              
              <Input
                label="Capacity (Adults)"
                type="number"
                min={1}
                placeholder="2"
                value={editRoomType.capacity}
                onChange={(e) => setEditRoomType({...editRoomType, capacity: e.target.value})}
              />
              <Input
                label={
                  <span className="flex items-center gap-1">
                    Fallback Rate (₵/night)
                    <Tooltip content="Subtotal (tax-exclusive) — tax is added on top at checkout, same as a Rate Plan's default pricing.">
                      <span className="text-gray-400 cursor-help">ⓘ</span>
                    </Tooltip>
                  </span>
                }
                type="number"
                min={0.01}
                step="0.01"
                placeholder="e.g., 450"
                value={editRoomType.baseRate}
                onChange={(e) => setEditRoomType({...editRoomType, baseRate: e.target.value})}
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

      {/* Edit Rate Plan Modal */}
      <Modal isOpen={editRatePlanModalOpen} onClose={() => setEditRatePlanModalOpen(false)} size="2xl">
        <ModalContent>
          <ModalHeader>Edit Rate Plan</ModalHeader>
          <ModalBody>
            {editRatePlanFormError && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
                {editRatePlanFormError}
              </div>
            )}
            <div className="space-y-4">
              <Input
                label="Rate Plan Name"
                placeholder="e.g., Weekend Special, Corporate Rate"
                value={editRatePlanForm.name}
                onChange={(e) => { setEditRatePlanForm({ ...editRatePlanForm, name: e.target.value }); setEditRatePlanFormError(null); }}
              />
              <Select
                label="Room Type"
                placeholder="Select room type"
                selectedKeys={editRatePlanForm.roomType ? [editRatePlanForm.roomType] : []}
                onChange={(e) => setEditRatePlanForm({ ...editRatePlanForm, roomType: e.target.value })}
              >
                {settingsStore.roomManagement.roomTypes.map((type) => (
                  <SelectItem key={type.id}>
                    {type.name}
                  </SelectItem>
                ))}
              </Select>
              <Select
                label="Price Type"
                placeholder="Select price type"
                selectedKeys={[editRatePlanForm.priceType]}
                onChange={(e) => setEditRatePlanForm({ ...editRatePlanForm, priceType: e.target.value as 'subtotal' | 'gross_total' })}
              >
                <SelectItem key="subtotal">
                  Subtotal (Before Tax)
                </SelectItem>
                <SelectItem key="gross_total">
                  Gross Total (Including Tax)
                </SelectItem>
              </Select>
              <Input
                label={`Price (₵) - ${editRatePlanForm.priceType === 'subtotal' ? 'Subtotal' : 'Gross Total'}`}
                type="number"
                min={0.01}
                step="0.01"
                placeholder="750"
                value={editRatePlanForm.price}
                onChange={(e) => setEditRatePlanForm({ ...editRatePlanForm, price: e.target.value })}
              />
              <Textarea
                label="Description (Optional)"
                placeholder="Additional details about this rate plan..."
                value={editRatePlanForm.description}
                onChange={(e) => setEditRatePlanForm({ ...editRatePlanForm, description: e.target.value })}
              />
              <p className="text-xs text-gray-500">
                Market segment, meal plan, stay restrictions, and seasonal rates aren&apos;t editable here yet — delete and recreate the plan (seasonal rates will need re-entering) if those need to change.
              </p>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={() => setEditRatePlanModalOpen(false)}>
              Cancel
            </Button>
            <Button color="primary" onPress={handleUpdateRatePlan}>
              Update Rate Plan
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
            {seasonalFormError && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
                {seasonalFormError}
              </div>
            )}
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
              if (!seasonalPlanId || !seasonalForm.name.trim()) {
                setSeasonalFormError('Season name is required.');
                return;
              }
              if (!seasonalForm.startDate || !seasonalForm.endDate) {
                setSeasonalFormError('Start and end dates are required.');
                return;
              }
              if (seasonalForm.endDate <= seasonalForm.startDate) {
                setSeasonalFormError('End date must be after the start date.');
                return;
              }
              if (!Number.isFinite(seasonalForm.multiplier) || seasonalForm.multiplier <= 0) {
                setSeasonalFormError('Multiplier must be a positive number (e.g. 1.2 for +20%).');
                return;
              }
              const plan = settingsStore.roomManagement.ratePlans.find(p => p.id === seasonalPlanId);
              const overlaps = (plan?.seasonalRates || []).some(sr =>
                seasonalForm.startDate <= sr.endDate && seasonalForm.endDate >= sr.startDate
              );
              if (overlaps) {
                setSeasonalFormError('This date range overlaps an existing seasonal period on this rate plan.');
                return;
              }
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
              setSeasonalFormError(null);
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
              {/* Header + Info tooltip */}
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-blue-800">🎯 Single Floor Room Creation</h4>
                <Tooltip
                  content={
                    <div className="max-w-sm text-sm space-y-2">
                      <div className="text-blue-700">Create rooms for a specific building and floor. Perfect for adding floors one by one!</div>
                      <div><strong className="text-green-700">Numbers:</strong> Building 1, Floor A, start 1 → 1A01, 1A02. Start A with the floor identifier cleared → A, B, C.</div>
                      <div><strong className="text-blue-700">Names:</strong> One room name per line. The name is the room. Building and floor are only the location.</div>
                      <div><strong className="text-purple-700">Number pattern:</strong> Prefix + Building + Floor + Room Number + Suffix</div>
                      <div><strong className="text-orange-700">Floor System:</strong> Floor Identifier (A, B, 1A) + Floor Number (0=Ground, 1=1st, 2=2nd)</div>
                      <div><strong className="text-indigo-700">Analytics:</strong> Floor Number tracks actual level for occupancy, pricing, and maintenance analysis</div>
                    </div>
                  }
                >
                  <span
                    role="img"
                    aria-label="Info"
                    className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center cursor-pointer select-none"
                    title="Info"
                  >
                    i
                  </span>
                </Tooltip>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  color={bulkRoomData.mode === 'numbered' ? 'primary' : 'default'}
                  variant={bulkRoomData.mode === 'numbered' ? 'solid' : 'flat'}
                  onPress={() => setBulkRoomData({ ...bulkRoomData, mode: 'numbered' })}
                >
                  Numbers
                </Button>
                <Button
                  size="sm"
                  color={bulkRoomData.mode === 'named' ? 'primary' : 'default'}
                  variant={bulkRoomData.mode === 'named' ? 'solid' : 'flat'}
                  onPress={() => setBulkRoomData({ ...bulkRoomData, mode: 'named' })}
                >
                  Names
                </Button>
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
              
                             <div className={`grid grid-cols-1 gap-4 ${bulkRoomData.mode === 'named' ? 'md:grid-cols-2' : 'md:grid-cols-4'}`}>
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

                 {bulkRoomData.mode === 'numbered' && (
                   <>
                 <Input
                   label="Rooms on Floor"
                   type="number"
                   min="1"
                   value={bulkRoomData.roomsOnFloor}
                   onChange={(e) => setBulkRoomData({...bulkRoomData, roomsOnFloor: e.target.value})}
                 />
                 
                 <Input
                   label="Starting Room Number"
                   placeholder="1 or A"
                   value={bulkRoomData.startRoomNumber}
                   onChange={(e) => setBulkRoomData({...bulkRoomData, startRoomNumber: e.target.value})}
                 />
                   </>
                 )}
               </div>

               {bulkRoomData.mode === 'numbered' && (
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
               )}

               {bulkRoomData.mode === 'named' && (
                 <Textarea
                   label="Room names"
                   placeholder={'Rose\nOrchid\nPalm Suite'}
                   minRows={5}
                   value={bulkRoomData.names}
                   description="One name per line. The name is the room. Nothing is added in front of it."
                   onChange={(e) => setBulkRoomData({ ...bulkRoomData, names: e.target.value })}
                 />
               )}
              
              {/* Preview */}
                             <div className="p-4 bg-green-50 rounded-lg">
                 <p className="text-sm text-green-800">
                   This will create <strong>{getTotalRooms()} rooms</strong> of type "{bulkRoomData.roomType ? getRoomTypeName(bulkRoomData.roomType) : '[Select Type]'}"
                   {bulkRoomData.mode === 'named'
                     ? ' using the names below.'
                     : <> in Building <strong>{bulkRoomData.building || '[Select Building]'}</strong> on Floor <strong>{bulkRoomData.floor || '[Select Floor]'}</strong> (Level {bulkRoomData.floorNumber}), starting from <strong>{bulkRoomData.startRoomNumber || '1'}</strong>.</>}
                 </p>
                
                                 {getTotalRooms() > 0 && (
                   <div className="mt-3 p-3 bg-white rounded border">
                     <h5 className="font-medium text-green-800 mb-2">{bulkRoomData.mode === 'named' ? 'Room names' : 'Example room numbers'}</h5>
                     <div className="text-sm text-green-700">
                       <p>{bulkRoomLabels().slice(0, 8).join(', ')}{getTotalRooms() > 8 ? '…' : ''}</p>
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
            <Button color="primary" onPress={handleBulkAddRooms} isDisabled={!bulkRoomData.roomType || getTotalRooms() < 1}>
              Add {getTotalRooms()} Rooms
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
