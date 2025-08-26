'use client';

import React, { useState, useEffect } from 'react';
import { 
  Card, 
  CardBody, 
  CardHeader, 
  Button, 
  Badge, 
  Table, 
  TableHeader, 
  TableColumn, 
  TableBody, 
  TableRow, 
  TableCell,
  Input,
  Select,
  SelectItem,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
  Chip,
  Textarea,
  Tabs,
  Tab,
  Calendar,
  Popover,
  PopoverTrigger,
  PopoverContent,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem
} from "@heroui/react";
import { frontOfficeStore } from '../lib/frontoffice/store';
import { housekeepingStore } from '../lib/housekeeping/store';
import { trackEvent } from '../lib/analytics/trackEvent';
import { Reservation, GuestProfile, RoomType, RatePlan, BillingPerson, StayReason, Nationality, IdType } from '../lib/frontoffice/types';

interface ReservationFormData {
  guestName: string;
  phone?: string;
  email?: string;
  nationality: Nationality;
  idType: IdType;
  idNumber: string;
  dateOfBirth?: string;
  gender?: 'male' | 'female' | 'other' | 'prefer_not_to_say';
  
  // Emergency contact
  emergencyContactName: string;
  emergencyContactRelationship: 'spouse' | 'parent' | 'child' | 'sibling' | 'friend' | 'colleague' | 'other';
  emergencyContactPhone: string;
  emergencyContactEmail?: string;
  emergencyContactAddress?: string;
  
  roomTypeId: string;
  ratePlanId?: string;
  arrival: string;
  departure: string;
  adults: number;
  children: number;
  source?: string;
  isGuaranteed: boolean;
  remarksToGuest?: string;
  internalNotes?: string;
  marketCodes: string[];
  
  // New fields for billing and stay purpose
  stayReason: StayReason;
  stayReasonDetails?: string;
  billingPersonId?: string;
  companyName?: string;
  projectCode?: string;
  costCenter?: string;
}

export default function ReservationsBookingsManager() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [filteredReservations, setFilteredReservations] = useState<Reservation[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const { isOpen, onOpen, onClose } = useDisclosure();
  
  // New state for guest selection
  const [useExistingGuest, setUseExistingGuest] = useState(false);
  const [guestSearchTerm, setGuestSearchTerm] = useState('');
  const [filteredGuests, setFilteredGuests] = useState<GuestProfile[]>([]);
  const [selectedGuest, setSelectedGuest] = useState<GuestProfile | null>(null);
  const [showGuestSearch, setShowGuestSearch] = useState(false);
  
  // New state for billing person selection
  const [useBillingPerson, setUseBillingPerson] = useState(false);
  const [billingPersonSearchTerm, setBillingPersonSearchTerm] = useState('');
  const [filteredBillingPersons, setFilteredBillingPersons] = useState<BillingPerson[]>([]);
  const [selectedBillingPerson, setSelectedBillingPerson] = useState<BillingPerson | null>(null);
  const [showBillingPersonSearch, setShowBillingPersonSearch] = useState(false);
  
  const [formData, setFormData] = useState<ReservationFormData>({
    guestName: '',
    phone: '',
    email: '',
    nationality: 'ghanaian',
    idType: 'ghana_card',
    idNumber: '',
    dateOfBirth: '',
    gender: 'prefer_not_to_say',
    emergencyContactName: '',
    emergencyContactRelationship: 'other',
    emergencyContactPhone: '',
    emergencyContactEmail: '',
    emergencyContactAddress: '',
    roomTypeId: '',
    ratePlanId: '',
    arrival: '',
    departure: '',
    adults: 1,
    children: 0,
    source: 'walkin',
    isGuaranteed: false,
    remarksToGuest: '',
    internalNotes: '',
    marketCodes: [],
    stayReason: 'personal' as StayReason,
    stayReasonDetails: '',
    billingPersonId: undefined,
    companyName: '',
    projectCode: '',
    costCenter: ''
  });

  useEffect(() => {
    loadReservations();
    const unsubscribe = frontOfficeStore.subscribe(loadReservations);
    return unsubscribe;
  }, []);

  useEffect(() => {
    filterReservations();
  }, [reservations, searchTerm, statusFilter]);

  // Filter guests based on search term
  useEffect(() => {
    if (guestSearchTerm.trim()) {
      const filtered = frontOfficeStore.guests.filter(guest =>
        guest.name.toLowerCase().includes(guestSearchTerm.toLowerCase()) ||
        guest.phone?.toLowerCase().includes(guestSearchTerm.toLowerCase()) ||
        guest.email?.toLowerCase().includes(guestSearchTerm.toLowerCase()) ||
        guest.ghanaCard?.toLowerCase().includes(guestSearchTerm.toLowerCase())
      );
      setFilteredGuests(filtered);
    } else {
      setFilteredGuests([]);
    }
  }, [guestSearchTerm]);

  // Filter billing persons based on search term
  useEffect(() => {
    if (billingPersonSearchTerm.trim()) {
      const filtered = frontOfficeStore.billingPersons.filter(bp =>
        bp.name.toLowerCase().includes(billingPersonSearchTerm.toLowerCase()) ||
        bp.company?.toLowerCase().includes(billingPersonSearchTerm.toLowerCase()) ||
        bp.email?.toLowerCase().includes(billingPersonSearchTerm.toLowerCase()) ||
        bp.phone?.toLowerCase().includes(billingPersonSearchTerm.toLowerCase())
      );
      setFilteredBillingPersons(filtered);
    } else {
      setFilteredBillingPersons([]);
    }
  }, [billingPersonSearchTerm]);

  // Close guest search when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest('.guest-search-container')) {
        setShowGuestSearch(false);
      }
      if (!target.closest('.billing-person-search-container')) {
        setShowBillingPersonSearch(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const loadReservations = () => {
    setReservations([...frontOfficeStore.reservations]);
  };

  const filterReservations = () => {
    let filtered = reservations;

    if (searchTerm) {
      filtered = filtered.filter(reservation => 
        reservation.guestName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        reservation.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        reservation.roomId?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(reservation => reservation.status === statusFilter);
    }

    setFilteredReservations(filtered);
  };

  const handleCreateReservation = () => {
    setIsCreatingNew(true);
    setUseExistingGuest(false);
    setSelectedGuest(null);
    setGuestSearchTerm('');
    setUseBillingPerson(false);
    setSelectedBillingPerson(null);
    setBillingPersonSearchTerm('');
    setFormData({
      guestName: '',
      phone: '',
      email: '',
      nationality: 'ghanaian',
      idType: 'ghana_card',
      idNumber: '',
      dateOfBirth: '',
      gender: 'prefer_not_to_say',
      emergencyContactName: '',
      emergencyContactRelationship: 'other',
      emergencyContactPhone: '',
      emergencyContactEmail: '',
      emergencyContactAddress: '',
      roomTypeId: '',
      ratePlanId: '',
      arrival: '',
      departure: '',
      adults: 1,
      children: 0,
      source: 'walkin',
      isGuaranteed: false,
      remarksToGuest: '',
      internalNotes: '',
      marketCodes: [],
      stayReason: 'personal' as StayReason,
      stayReasonDetails: '',
      billingPersonId: undefined,
      companyName: '',
      projectCode: '',
      costCenter: ''
    });
    onOpen();
  };

  const handleEditReservation = (reservation: Reservation) => {
    setSelectedReservation(reservation);
    setIsCreatingNew(false);
    setUseExistingGuest(false);
    setSelectedGuest(null);
    
          // Convert reservation to form data
      setFormData({
        guestName: reservation.guestName,
        phone: '',
        email: '',
        nationality: 'ghanaian', // Default value since reservation doesn't store this
        idType: 'ghana_card', // Default value since reservation doesn't store this
        idNumber: '',
        dateOfBirth: '',
        gender: 'prefer_not_to_say',
        emergencyContactName: '',
        emergencyContactRelationship: 'other',
        emergencyContactPhone: '',
        emergencyContactEmail: '',
        emergencyContactAddress: '',
        roomTypeId: reservation.roomTypeId,
        ratePlanId: reservation.ratePlanId || '',
        arrival: reservation.arrival,
        departure: reservation.departure,
        adults: reservation.adults || 1,
        children: reservation.children || 0,
        source: reservation.source || 'walkin',
        isGuaranteed: reservation.isGuaranteed || false,
        remarksToGuest: reservation.remarksToGuest || '',
        internalNotes: reservation.internalNotes || '',
        marketCodes: reservation.marketCodes || [],
        stayReason: reservation.stayReason || 'personal' as StayReason,
        stayReasonDetails: reservation.stayReasonDetails || '',
        billingPersonId: reservation.billingPersonId || undefined,
        companyName: reservation.companyName || '',
        projectCode: reservation.projectCode || '',
        costCenter: reservation.costCenter || ''
      });
    
    onOpen();
  };

  const handleGuestSelection = (guest: GuestProfile) => {
    setSelectedGuest(guest);
    setFormData(prev => ({
      ...prev,
      guestName: guest.name,
      phone: guest.phone || '',
      email: guest.email || '',
      nationality: guest.nationality || 'ghanaian',
      idType: guest.idType || 'ghana_card',
      idNumber: guest.idNumber || '',
      dateOfBirth: guest.dateOfBirth || '',
      gender: guest.gender || 'prefer_not_to_say',
      emergencyContactName: guest.emergencyContact?.name || '',
      emergencyContactRelationship: guest.emergencyContact?.relationship || 'other',
      emergencyContactPhone: guest.emergencyContact?.phone || '',
      emergencyContactEmail: guest.emergencyContact?.email || '',
      emergencyContactAddress: guest.emergencyContact?.address || '',
    }));
    setShowGuestSearch(false);
    setGuestSearchTerm('');
  };

  const handleBillingPersonSelection = (billingPerson: BillingPerson) => {
    setSelectedBillingPerson(billingPerson);
    setFormData(prev => ({
      ...prev,
      billingPersonId: billingPerson.id,
      companyName: billingPerson.company || ''
    }));
    setShowBillingPersonSearch(false);
    setBillingPersonSearchTerm('');
    
    console.log(`[FO.Reservation] Billing person selected: ${billingPerson.name} (${billingPerson.company}) for reservation`);
    trackEvent('FO.Reservation.BillingPersonSelected', {
      billingPersonId: billingPerson.id,
      billingPersonName: billingPerson.name,
      company: billingPerson.company,
      relationship: billingPerson.billingRelationship
    });
  };

  const handleSaveReservation = () => {
    if (isCreatingNew) {
      let guest: GuestProfile;
      
      // Validate required fields
      if (!formData.guestName.trim()) {
        alert('Guest name is required');
        return;
      }
      
      if (useExistingGuest && selectedGuest) {
        // Use existing guest
        guest = selectedGuest;
        console.log(`[FO.Reservation] Using existing guest profile: ${guest.name} (ID: ${guest.id})`);
        trackEvent('FO.Reservation.ExistingGuestUsed', {
          guestId: guest.id,
          guestName: guest.name
        });
      } else {
        // Create new guest profile
        guest = frontOfficeStore.createGuest({
          name: formData.guestName,
          phone: formData.phone,
          email: formData.email,
          nationality: formData.nationality,
          idType: formData.idType,
          idNumber: formData.idNumber,
          dateOfBirth: formData.dateOfBirth,
          gender: formData.gender,
          emergencyContact: {
            name: formData.emergencyContactName,
            relationship: formData.emergencyContactRelationship,
            phone: formData.emergencyContactPhone,
            email: formData.emergencyContactEmail,
            address: formData.emergencyContactAddress
          },
          source: formData.source as any
        });
        
        console.log(`[FO.Reservation] Created new guest profile: ${guest.name} (ID: ${guest.id})`);
        trackEvent('FO.Reservation.NewGuestCreated', {
          guestId: guest.id,
          guestName: guest.name
        });
      }

      // Create new reservation
      const reservation = frontOfficeStore.createReservation({
        guestId: guest.id,
        guestName: guest.name,
        roomTypeId: formData.roomTypeId,
        ratePlanId: formData.ratePlanId || undefined,
        arrival: formData.arrival,
        departure: formData.departure,
        adults: formData.adults,
        children: formData.children,
        source: formData.source,
        isGuaranteed: formData.isGuaranteed,
        remarksToGuest: formData.remarksToGuest,
        internalNotes: formData.internalNotes,
        marketCodes: formData.marketCodes,
        status: 'confirmed',
        stayReason: formData.stayReason,
        stayReasonDetails: formData.stayReasonDetails,
        billingPersonId: formData.billingPersonId,
        companyName: formData.companyName,
        projectCode: formData.projectCode,
        costCenter: formData.costCenter
      });

      trackEvent('FO.Reservation.Created', {
        id: reservation.id,
        guest: reservation.guestName,
        arrival: reservation.arrival,
        departure: reservation.departure,
        usedExistingGuest: useExistingGuest,
        stayReason: reservation.stayReason,
        hasBillingPerson: !!reservation.billingPersonId,
        companyName: reservation.companyName
      });
    } else if (selectedReservation) {
      // Update existing reservation
      const updatedReservation = {
        ...selectedReservation,
        guestName: formData.guestName,
        roomTypeId: formData.roomTypeId,
        ratePlanId: formData.ratePlanId || undefined,
        arrival: formData.arrival,
        departure: formData.departure,
        adults: formData.adults,
        children: formData.children,
        source: formData.source,
        isGuaranteed: formData.isGuaranteed,
        remarksToGuest: formData.remarksToGuest,
        internalNotes: formData.internalNotes,
        marketCodes: formData.marketCodes,
        stayReason: formData.stayReason,
        stayReasonDetails: formData.stayReasonDetails,
        billingPersonId: formData.billingPersonId,
        companyName: formData.companyName,
        projectCode: formData.projectCode,
        costCenter: formData.costCenter
      };

      frontOfficeStore.updateReservation(updatedReservation);
      
      trackEvent('FO.Reservation.Updated', {
        id: selectedReservation.id,
        guest: updatedReservation.guestName
      });
    }

    onClose();
    loadReservations();
  };

  const handleQuickAction = (action: string, reservation: Reservation) => {
    switch (action) {
      case 'checkin':
        frontOfficeStore.checkIn(reservation.id);
        break;
      case 'checkout':
        frontOfficeStore.checkOut(reservation.id);
        break;
      case 'cancel':
        frontOfficeStore.cancelReservation(reservation.id);
        break;
      case 'assign':
        // This would open a room assignment modal
        break;
    }
    
    trackEvent('FO.Reservation.QuickAction', {
      action,
      reservationId: reservation.id
    });
    
    loadReservations();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return 'success';
      case 'pending': return 'warning';
      case 'checked-in': return 'primary';
      case 'checked-out': return 'secondary';
      case 'cancelled': return 'danger';
      case 'no-show': return 'default';
      default: return 'default';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'confirmed': return '✅';
      case 'pending': return '⏳';
      case 'checked-in': return '🔑';
      case 'checked-out': return '🚪';
      case 'cancelled': return '❌';
      case 'no-show': return '👻';
      default: return '❓';
    }
  };

  const calculateNights = (arrival: string, departure: string) => {
    const start = new Date(arrival);
    const end = new Date(departure);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const getAvailableRooms = (roomTypeId: string) => {
    return housekeepingStore.getRoomsByStatus('vacant')
      .filter(room => room.roomTypeId === roomTypeId)
      .map(room => room.roomNumber);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-ghana-black">📅 Reservations & Bookings Management</h2>
          <p className="text-sm sm:text-base text-gray-600">Create, view, and manage room reservations and bookings</p>
        </div>
        <div className="flex items-center space-x-2 sm:space-x-4">
          <Button
            color="primary"
            variant="flat"
            onClick={handleCreateReservation}
            className="text-sm sm:text-base px-3 sm:px-4 py-2 sm:py-3"
          >
            ➕ New Reservation
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
        <Card className="border-0 shadow-lg">
          <CardBody className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Reservations</p>
                <p className="text-2xl font-bold text-ghana-black">{reservations.length}</p>
              </div>
              <span className="text-2xl">📊</span>
            </div>
          </CardBody>
        </Card>
        <Card className="border-0 shadow-lg">
          <CardBody className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Confirmed</p>
                <p className="text-2xl font-bold text-green-600">
                  {reservations.filter(r => r.status === 'confirmed').length}
                </p>
              </div>
              <span className="text-2xl">✅</span>
            </div>
          </CardBody>
        </Card>
        <Card className="border-0 shadow-lg">
          <CardBody className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Checked In</p>
                <p className="text-2xl font-bold text-blue-600">
                  {reservations.filter(r => r.status === 'checked-in').length}
                </p>
              </div>
              <span className="text-2xl">🔑</span>
            </div>
          </CardBody>
        </Card>
        <Card className="border-0 shadow-lg">
          <CardBody className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Business Stays</p>
                  <p className="text-2xl font-bold text-purple-600">
                    {reservations.filter(r => ['business', 'corporate', 'conference', 'training'].includes(r.stayReason || 'personal')).length}
                  </p>
                  <p className="text-xs text-gray-500">
                    {reservations.filter(r => r.stayReason === 'corporate').length} Corporate
                  </p>
                </div>
              </div>
              <span className="text-2xl">💼</span>
            </div>
          </CardBody>
        </Card>
        <Card className="border-0 shadow-lg">
          <CardBody className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Third Party Billing</p>
                  <p className="text-2xl font-bold text-orange-600">
                    {reservations.filter(r => r.billingPersonId).length}
                  </p>
                </div>
              </div>
              <span className="text-2xl">🏢</span>
            </div>
          </CardBody>
        </Card>
        <Card className="border-0 shadow-lg">
          <CardBody className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div>
                  <p className="text-sm font-medium text-gray-600">International Guests</p>
                  <p className="text-2xl font-bold text-indigo-600">
                    {reservations.filter(r => r.guestName && 
                      frontOfficeStore.guests.find(g => g.name === r.guestName)?.nationality !== 'ghanaian').length}
                  </p>
                  <p className="text-xs text-gray-500">
                    Non-Ghanaian
                  </p>
                </div>
              </div>
              <span className="text-2xl">🌍</span>
            </div>
          </CardBody>
        </Card>
        <Card className="border-0 shadow-lg">
          <CardBody className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Pending</p>
                <p className="text-2xl font-bold text-yellow-600">
                  {reservations.filter(r => r.status === 'pending').length}
                </p>
              </div>
              <span className="text-2xl">⏳</span>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Filters */}
      <Card className="border-0 shadow-lg">
        <CardBody className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4">
            <Input
              placeholder="Search reservations, guests, or room numbers..."
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
              <SelectItem key="confirmed">✅ Confirmed</SelectItem>
              <SelectItem key="checked-in">🔑 Checked In</SelectItem>
              <SelectItem key="checked-out">🚪 Checked Out</SelectItem>
              <SelectItem key="cancelled">❌ Cancelled</SelectItem>
              <SelectItem key="no-show">👻 No Show</SelectItem>
            </Select>
            <Select
              placeholder="Filter by purpose"
              value={formData.stayReason}
              onChange={(e) => setFormData({...formData, stayReason: e.target.value as StayReason})}
            >
              <SelectItem key="all">All Purposes</SelectItem>
              <SelectItem key="personal">👤 Personal</SelectItem>
              <SelectItem key="business">💼 Business</SelectItem>
              <SelectItem key="corporate">🏢 Corporate</SelectItem>
              <SelectItem key="conference">🎤 Conference</SelectItem>
              <SelectItem key="training">📚 Training</SelectItem>
              <SelectItem key="medical">🏥 Medical</SelectItem>
              <SelectItem key="tourism">🌍 Tourism</SelectItem>
              <SelectItem key="other">📋 Other</SelectItem>
            </Select>
            <Select
              placeholder="Filter by billing"
              value={useBillingPerson ? 'third_party' : 'guest'}
              onChange={(e) => setUseBillingPerson(e.target.value === 'third_party')}
            >
              <SelectItem key="all">All Billing Types</SelectItem>
              <SelectItem key="guest">Guest Pays</SelectItem>
              <SelectItem key="third_party">Third Party Pays</SelectItem>
            </Select>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">Filtered:</span>
              <Badge color="primary" variant="flat">{filteredReservations.length}</Badge>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Reservations Table */}
      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-3">
          <h3 className="text-lg sm:text-xl font-semibold text-ghana-black">Reservations</h3>
        </CardHeader>
        <CardBody className="p-0 overflow-x-auto">
          <Table aria-label="Reservations table">
            <TableHeader>
              <TableColumn className="hidden sm:table-cell">Reservation ID</TableColumn>
              <TableColumn>Guest</TableColumn>
              <TableColumn className="hidden lg:table-cell">Room Type</TableColumn>
              <TableColumn className="hidden md:table-cell">Dates</TableColumn>
              <TableColumn className="hidden xl:table-cell">Purpose</TableColumn>
              <TableColumn className="hidden xl:table-cell">Billing</TableColumn>
              <TableColumn>Status</TableColumn>
              <TableColumn className="hidden lg:table-cell">Room</TableColumn>
              <TableColumn className="hidden xl:table-cell">Rate</TableColumn>
              <TableColumn>Actions</TableColumn>
            </TableHeader>
            <TableBody>
              {filteredReservations.map((reservation) => (
                <TableRow 
                  key={reservation.id}
                  className="cursor-pointer hover:bg-gray-50"
                  onClick={() => handleEditReservation(reservation)}
                >
                  <TableCell className="hidden sm:table-cell">
                    <div className="flex items-center space-x-2">
                      <span className="font-semibold text-ghana-black">{reservation.id}</span>
                      <Chip size="sm" variant="flat" color="secondary">
                        {reservation.source || 'Direct'}
                      </Chip>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="max-w-[200px]">
                      <p className="font-medium text-ghana-black truncate">{reservation.guestName}</p>
                      <p className="text-xs text-gray-500">
                        {reservation.adults || 1} adult{reservation.adults !== 1 ? 's' : ''}
                        {reservation.children ? `, ${reservation.children} child${reservation.children !== 1 ? 'ren' : ''}` : ''}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <Chip size="sm" variant="flat" color="secondary">
                      {frontOfficeStore.roomTypes.find(rt => rt.id === reservation.roomTypeId)?.name || 'Unknown'}
                    </Chip>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <div className="text-sm">
                      <p>📅 {new Date(reservation.arrival).toLocaleDateString()}</p>
                      <p>📤 {new Date(reservation.departure).toLocaleDateString()}</p>
                      <p className="text-xs text-gray-500">
                        {calculateNights(reservation.arrival, reservation.departure)} night{calculateNights(reservation.arrival, reservation.departure) !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell className="hidden xl:table-cell">
                    <div className="text-sm">
                      <Chip size="sm" variant="flat" color="primary">
                        {reservation.stayReason || 'personal'}
                      </Chip>
                      {reservation.stayReasonDetails && (
                        <p className="text-xs text-gray-500 mt-1 truncate max-w-[150px]">
                          {reservation.stayReasonDetails}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="hidden xl:table-cell">
                    <div className="text-sm">
                      {reservation.billingPersonId ? (
                        <div>
                          <Chip size="sm" variant="flat" color="success">
                            Third Party
                          </Chip>
                          <p className="text-xs text-gray-500 mt-1 truncate max-w-[150px]">
                            {reservation.billingPersonName || 'Billing person'}
                          </p>
                        </div>
                      ) : (
                        <Chip size="sm" variant="flat" color="secondary">
                          Guest Pays
                        </Chip>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <span>{getStatusIcon(reservation.status)}</span>
                      <Badge 
                        color={getStatusColor(reservation.status) as any}
                        variant="flat"
                        size="sm"
                      >
                        {reservation.status}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    {reservation.roomId ? (
                      <Chip size="sm" variant="flat" color="success">
                        {reservation.roomId}
                      </Chip>
                    ) : (
                      <span className="text-gray-400">Unassigned</span>
                    )}
                  </TableCell>
                  <TableCell className="hidden xl:table-cell">
                    <span className="font-medium">
                      ₵{frontOfficeStore.roomTypes.find(rt => rt.id === reservation.roomTypeId)?.baseRate.toLocaleString() || '0'}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex space-x-1">
                      {reservation.status === 'confirmed' && !reservation.roomId && (
                        <Button
                          size="sm"
                          color="primary"
                          variant="flat"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleQuickAction('assign', reservation);
                          }}
                        >
                          🏠 Assign
                        </Button>
                      )}
                      {reservation.status === 'confirmed' && (
                        <Button
                          size="sm"
                          color="success"
                          variant="flat"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleQuickAction('checkin', reservation);
                          }}
                        >
                          🔑 Check In
                        </Button>
                      )}
                      {reservation.status === 'checked-in' && (
                        <Button
                          size="sm"
                          color="warning"
                          variant="flat"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleQuickAction('checkout', reservation);
                          }}
                        >
                          🚪 Check Out
                        </Button>
                      )}
                      {['pending', 'confirmed'].includes(reservation.status) && (
                        <Button
                          size="sm"
                          color="danger"
                          variant="flat"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleQuickAction('cancel', reservation);
                          }}
                        >
                          ❌ Cancel
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardBody>
      </Card>

      {/* Reservation Form Modal */}
      <Modal isOpen={isOpen} onClose={onClose} size="4xl" className="mx-2 sm:mx-4">
        <ModalContent>
          <ModalHeader>
            {isCreatingNew ? 'Create New Reservation' : 'Edit Reservation'}
          </ModalHeader>
          <ModalBody>
            <Tabs aria-label="Reservation details">
              <Tab key="guest" title="👤 Guest Information">
                <div className="space-y-4 pt-4">
                  {/* Guest Selection Toggle */}
                  {isCreatingNew && (
                    <div className="bg-gray-50 p-4 rounded-lg border">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-medium text-gray-900">Guest Selection</h4>
                        <div className="flex items-center space-x-2">
                          <span className="text-sm text-gray-600">New Guest</span>
                          <input
                            type="checkbox"
                            id="useExistingGuest"
                            checked={useExistingGuest}
                            onChange={(e) => {
                              setUseExistingGuest(e.target.checked);
                              if (e.target.checked) {
                                setSelectedGuest(null);
                                setFormData(prev => ({
                                  ...prev,
                                  guestName: '',
                                  phone: '',
                                  email: '',
                                  nationality: 'ghanaian',
                                  idType: 'ghana_card',
                                  idNumber: '',
                                  dateOfBirth: '',
                                  gender: 'prefer_not_to_say',
                                  emergencyContactName: '',
                                  emergencyContactRelationship: 'other',
                                  emergencyContactPhone: '',
                                  emergencyContactEmail: '',
                                  emergencyContactAddress: '',
                                }));
                              }
                            }}
                            className="rounded border-gray-300"
                          />
                          <span className="text-sm text-gray-600">Existing Guest</span>
                        </div>
                      </div>
                      
                      <p className="text-sm text-gray-600 mb-3">
                        {useExistingGuest 
                          ? "Search for an existing guest to use their profile information. This will auto-fill the guest details below."
                          : "Create a new guest profile for this reservation."
                        }
                      </p>
                      
                      {useExistingGuest && (
                        <div className="space-y-3">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Search for Existing Guest
                            </label>
                            <div className="relative guest-search-container">
                              <div className="flex">
                                <Input
                                  value={guestSearchTerm}
                                  onChange={(e) => setGuestSearchTerm(e.target.value)}
                                  placeholder="Search by name, phone, email, or Ghana Card"
                                  onFocus={() => setShowGuestSearch(true)}
                                  className="flex-1"
                                />
                                {guestSearchTerm && (
                                  <Button
                                    size="sm"
                                    variant="light"
                                    color="danger"
                                    onClick={() => {
                                      setGuestSearchTerm('');
                                      setFilteredGuests([]);
                                    }}
                                    className="ml-2"
                                  >
                                    ✕
                                  </Button>
                                )}
                              </div>
                              {showGuestSearch && guestSearchTerm.trim() && (
                                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                                  {filteredGuests.length > 0 ? (
                                    filteredGuests.map(guest => (
                                      <div
                                        key={guest.id}
                                        className="p-3 hover:bg-gray-100 cursor-pointer border-b border-gray-200 last:border-b-0"
                                        onClick={() => handleGuestSelection(guest)}
                                      >
                                        <div className="font-medium text-gray-900">{guest.name}</div>
                                        <div className="text-sm text-gray-600">
                                          {guest.phone && `📱 ${guest.phone}`}
                                          {guest.email && ` 📧 ${guest.email}`}
                                          {guest.ghanaCard && ` 🆔 ${guest.ghanaCard}`}
                                        </div>
                                      </div>
                                    ))
                                  ) : (
                                    <div className="p-3 text-gray-500 text-center">
                                      No guests found
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                          
                          {selectedGuest && (
                            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                              <div className="flex items-center justify-between mb-2">
                                <div>
                                  <div className="font-medium text-green-900">✅ Guest Selected</div>
                                  <div className="text-sm text-green-700">
                                    {selectedGuest.name} - {selectedGuest.phone || 'No phone'}
                                  </div>
                                </div>
                                <Button
                                  size="sm"
                                  color="danger"
                                  variant="light"
                                  onClick={() => {
                                    setSelectedGuest(null);
                                    setFormData(prev => ({
                                      ...prev,
                                      guestName: '',
                                      phone: '',
                                      email: '',
                                      nationality: 'ghanaian',
                                      idType: 'ghana_card',
                                      idNumber: '',
                                      dateOfBirth: '',
                                      gender: 'prefer_not_to_say',
                                      emergencyContactName: '',
                                      emergencyContactRelationship: 'other',
                                      emergencyContactPhone: '',
                                      emergencyContactEmail: '',
                                      emergencyContactAddress: '',
                                    }));
                                  }}
                                >
                                  Change
                                </Button>
                              </div>
                              
                              {/* Show guest history */}
                              <div className="text-xs text-green-600">
                                <div>📅 Previous stays: {reservations.filter(r => r.guestName === selectedGuest.name).length}</div>
                                <div>🏨 Last visit: {
                                  (() => {
                                    const guestReservations = reservations.filter(r => r.guestName === selectedGuest.name);
                                    if (guestReservations.length > 0) {
                                      const lastReservation = guestReservations.sort((a, b) => 
                                        new Date(b.departure).getTime() - new Date(a.departure).getTime()
                                      )[0];
                                      return new Date(lastReservation.departure).toLocaleDateString();
                                    }
                                    return 'No previous stays';
                                  })()
                                }</div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Guest Information Form */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Guest Name * {selectedGuest && <span className="text-green-600">(from existing profile)</span>}
                      </label>
                      <Input
                        value={formData.guestName}
                        onChange={(e) => setFormData({...formData, guestName: e.target.value})}
                        placeholder="Full name"
                        isRequired
                        isReadOnly={!!(useExistingGuest && selectedGuest)}
                        className={!!(useExistingGuest && selectedGuest) ? 'bg-gray-100' : ''}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                      <Input
                        value={formData.phone}
                        onChange={(e) => setFormData({...formData, phone: e.target.value})}
                        placeholder="Phone number"
                        isReadOnly={!!(useExistingGuest && selectedGuest)}
                        className={!!(useExistingGuest && selectedGuest) ? 'bg-gray-100' : ''}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                      <Input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({...formData, email: e.target.value})}
                        placeholder="Email address"
                        isReadOnly={!!(useExistingGuest && selectedGuest)}
                        className={!!(useExistingGuest && selectedGuest) ? 'bg-gray-100' : ''}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Nationality</label>
                      <Select
                        value={formData.nationality}
                        onChange={(e) => setFormData({...formData, nationality: e.target.value as Nationality})}
                        placeholder="Nationality"
                        isReadOnly={useExistingGuest && selectedGuest}
                        className={useExistingGuest && selectedGuest ? 'bg-gray-100' : ''}
                                             >
                         {/* African Countries */}
                         <SelectItem key="ghanaian">🇬🇭 Ghanaian</SelectItem>
                         <SelectItem key="nigerian">🇳🇬 Nigerian</SelectItem>
                         <SelectItem key="kenyan">🇰🇪 Kenyan</SelectItem>
                         <SelectItem key="south_african">🇿🇦 South African</SelectItem>
                         <SelectItem key="egyptian">🇪🇬 Egyptian</SelectItem>
                         <SelectItem key="moroccan">🇲🇦 Moroccan</SelectItem>
                         <SelectItem key="ethiopian">🇪🇹 Ethiopian</SelectItem>
                         <SelectItem key="ugandan">🇺🇬 Ugandan</SelectItem>
                         <SelectItem key="tanzanian">🇹🇿 Tanzanian</SelectItem>
                         <SelectItem key="ivorian">🇨🇮 Ivorian</SelectItem>
                         <SelectItem key="senegalese">🇸🇳 Senegalese</SelectItem>
                         <SelectItem key="cameroonian">🇨🇲 Cameroonian</SelectItem>
                         
                         {/* European Countries */}
                         <SelectItem key="british">🇬🇧 British</SelectItem>
                         <SelectItem key="german">🇩🇪 German</SelectItem>
                         <SelectItem key="french">🇫🇷 French</SelectItem>
                         <SelectItem key="italian">🇮🇹 Italian</SelectItem>
                         <SelectItem key="spanish">🇪🇸 Spanish</SelectItem>
                         <SelectItem key="dutch">🇳🇱 Dutch</SelectItem>
                         <SelectItem key="swiss">🇨🇭 Swiss</SelectItem>
                         <SelectItem key="swedish">🇸🇪 Swedish</SelectItem>
                         <SelectItem key="norwegian">🇳🇴 Norwegian</SelectItem>
                         <SelectItem key="danish">🇩🇰 Danish</SelectItem>
                         <SelectItem key="finnish">🇫🇮 Finnish</SelectItem>
                         <SelectItem key="russian">🇷🇺 Russian</SelectItem>
                         
                         {/* North American Countries */}
                         <SelectItem key="american">🇺🇸 American</SelectItem>
                         <SelectItem key="canadian">🇨🇦 Canadian</SelectItem>
                         <SelectItem key="mexican">🇲🇽 Mexican</SelectItem>
                         
                         {/* Asian Countries */}
                         <SelectItem key="chinese">🇨🇳 Chinese</SelectItem>
                         <SelectItem key="japanese">🇯🇵 Japanese</SelectItem>
                         <SelectItem key="indian">🇮🇳 Indian</SelectItem>
                         <SelectItem key="pakistani">🇵🇰 Pakistani</SelectItem>
                         <SelectItem key="bangladeshi">🇧🇩 Bangladeshi</SelectItem>
                         <SelectItem key="thai">🇹🇭 Thai</SelectItem>
                         <SelectItem key="vietnamese">🇻🇳 Vietnamese</SelectItem>
                         <SelectItem key="filipino">🇵🇭 Filipino</SelectItem>
                         <SelectItem key="indonesian">🇮🇩 Indonesian</SelectItem>
                         <SelectItem key="malaysian">🇲🇾 Malaysian</SelectItem>
                         <SelectItem key="singaporean">🇸🇬 Singaporean</SelectItem>
                         <SelectItem key="korean">🇰🇷 Korean</SelectItem>
                         
                         {/* South American Countries */}
                         <SelectItem key="brazilian">🇧🇷 Brazilian</SelectItem>
                         <SelectItem key="argentine">🇦🇷 Argentine</SelectItem>
                         <SelectItem key="chilean">🇨🇱 Chilean</SelectItem>
                         <SelectItem key="colombian">🇨🇴 Colombian</SelectItem>
                         <SelectItem key="peruvian">🇵🇪 Peruvian</SelectItem>
                         <SelectItem key="venezuelan">🇻🇪 Venezuelan</SelectItem>
                         <SelectItem key="ecuadorian">🇪🇨 Ecuadorian</SelectItem>
                         <SelectItem key="bolivian">🇧🇴 Bolivian</SelectItem>
                         <SelectItem key="paraguayan">🇵🇾 Paraguayan</SelectItem>
                         <SelectItem key="uruguayan">🇺🇾 Uruguayan</SelectItem>
                         
                         {/* Oceania */}
                         <SelectItem key="australian">🇦🇺 Australian</SelectItem>
                         <SelectItem key="new_zealander">🇳🇿 New Zealander</SelectItem>
                         
                         <SelectItem key="other">🌍 Other</SelectItem>
                       </Select>
                    </div>
                  </div>
                  {/* ID & Personal Details - Compact Layout */}
                  <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                    <h4 className="font-medium text-blue-900 mb-3 text-sm">🆔 ID & Personal Details</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">ID Type</label>
                        <Select
                          size="sm"
                          value={formData.idType}
                          onChange={(e) => setFormData({...formData, idType: e.target.value as IdType})}
                          placeholder="Select ID type"
                          isReadOnly={!!(useExistingGuest && selectedGuest)}
                          className={!!(useExistingGuest && selectedGuest) ? 'bg-gray-100' : ''}
                        >
                          <SelectItem key="ghana_card">Ghana Card</SelectItem>
                          <SelectItem key="passport">Passport</SelectItem>
                          <SelectItem key="drivers_license">Driver's License</SelectItem>
                          <SelectItem key="national_id">National ID</SelectItem>
                          <SelectItem key="voters_id">Voter's ID</SelectItem>
                          <SelectItem key="nhis_card">NHIS Card</SelectItem>
                          <SelectItem key="other">Other</SelectItem>
                        </Select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">ID Number</label>
                        <Input
                          size="sm"
                          value={formData.idNumber}
                          onChange={(e) => setFormData({...formData, idNumber: e.target.value})}
                          placeholder="ID number"
                          isReadOnly={!!(useExistingGuest && selectedGuest)}
                          className={!!(useExistingGuest && selectedGuest) ? 'bg-gray-100' : ''}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Date of Birth</label>
                        <Input
                          size="sm"
                          type="date"
                          value={formData.dateOfBirth}
                          onChange={(e) => setFormData({...formData, dateOfBirth: e.target.value})}
                          isReadOnly={!!(useExistingGuest && selectedGuest)}
                          className={!!(useExistingGuest && selectedGuest) ? 'bg-gray-100' : ''}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Gender</label>
                        <Select
                          size="sm"
                          value={formData.gender}
                          onChange={(e) => setFormData({...formData, gender: e.target.value as 'male' | 'female' | 'other' | 'prefer_not_to_say'})}
                          placeholder="Select gender"
                          isReadOnly={!!(useExistingGuest && selectedGuest)}
                          className={!!(useExistingGuest && selectedGuest) ? 'bg-gray-100' : ''}
                        >
                          <SelectItem key="male">Male</SelectItem>
                          <SelectItem key="female">Female</SelectItem>
                          <SelectItem key="other">Other</SelectItem>
                          <SelectItem key="prefer_not_to_say">Prefer not to say</SelectItem>
                        </Select>
                      </div>
                    </div>
                  </div>
                  {/* Emergency Contact Section - Compact Layout */}
                  <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                    <h4 className="font-medium text-yellow-900 mb-3 text-sm">🚨 Emergency Contact</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Name *</label>
                        <Input
                          size="sm"
                          value={formData.emergencyContactName}
                          onChange={(e) => setFormData({...formData, emergencyContactName: e.target.value})}
                          placeholder="Contact name"
                          isReadOnly={!!(useExistingGuest && selectedGuest)}
                          className={!!(useExistingGuest && selectedGuest) ? 'bg-gray-100' : ''}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Relationship</label>
                        <Select
                          size="sm"
                          value={formData.emergencyContactRelationship}
                          onChange={(e) => setFormData({...formData, emergencyContactRelationship: e.target.value as 'spouse' | 'parent' | 'child' | 'sibling' | 'friend' | 'colleague' | 'other'})}
                          placeholder="Relationship"
                          isReadOnly={!!(useExistingGuest && selectedGuest)}
                          className={!!(useExistingGuest && selectedGuest) ? 'bg-gray-100' : ''}
                        >
                          <SelectItem key="spouse">Spouse</SelectItem>
                          <SelectItem key="parent">Parent</SelectItem>
                          <SelectItem key="child">Child</SelectItem>
                          <SelectItem key="sibling">Sibling</SelectItem>
                          <SelectItem key="friend">Friend</SelectItem>
                          <SelectItem key="colleague">Colleague</SelectItem>
                          <SelectItem key="other">Other</SelectItem>
                        </Select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Phone *</label>
                        <Input
                          size="sm"
                          value={formData.emergencyContactPhone}
                          onChange={(e) => setFormData({...formData, emergencyContactPhone: e.target.value})}
                          placeholder="Phone number"
                          isReadOnly={!!(useExistingGuest && selectedGuest)}
                          className={!!(useExistingGuest && selectedGuest) ? 'bg-gray-100' : ''}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
                        <Input
                          size="sm"
                          type="email"
                          value={formData.emergencyContactEmail}
                          onChange={(e) => setFormData({...formData, emergencyContactEmail: e.target.value})}
                          placeholder="Email (optional)"
                          isReadOnly={!!(useExistingGuest && selectedGuest)}
                          className={!!(useExistingGuest && selectedGuest) ? 'bg-gray-100' : ''}
                        />
                      </div>
                    </div>
                    <div className="mt-3">
                      <label className="block text-xs font-medium text-gray-700 mb-1">Address</label>
                      <Input
                        size="sm"
                        value={formData.emergencyContactAddress}
                        onChange={(e) => setFormData({...formData, emergencyContactAddress: e.target.value})}
                        placeholder="Full address (optional)"
                        isReadOnly={!!(useExistingGuest && selectedGuest)}
                        className={!!(useExistingGuest && selectedGuest) ? 'bg-gray-100' : ''}
                      />
                    </div>
                  </div>
                </div>
              </Tab>
              
              <Tab key="reservation" title="🏨 Reservation Details">
                <div className="space-y-4 pt-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Room Type *</label>
                      <Select
                        value={formData.roomTypeId}
                        onChange={(e) => setFormData({...formData, roomTypeId: e.target.value})}
                        placeholder="Select room type"
                        isRequired
                      >
                        {frontOfficeStore.roomTypes.map(roomType => (
                          <SelectItem key={roomType.id}>
                            {roomType.name} - ₵{roomType.baseRate}/night
                          </SelectItem>
                        ))}
                      </Select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Rate Plan</label>
                      <Select
                        value={formData.ratePlanId}
                        onChange={(e) => setFormData({...formData, ratePlanId: e.target.value})}
                        placeholder="Select rate plan"
                      >
                        {frontOfficeStore.ratePlans
                          .filter(rp => !formData.roomTypeId || rp.roomTypeId === formData.roomTypeId)
                          .map(ratePlan => (
                            <SelectItem key={ratePlan.id}>
                              {ratePlan.name} - ₵{ratePlan.price}/night
                            </SelectItem>
                          ))}
                      </Select>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Arrival Date *</label>
                      <Input
                        type="date"
                        value={formData.arrival}
                        onChange={(e) => setFormData({...formData, arrival: e.target.value})}
                        isRequired
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Departure Date *</label>
                      <Input
                        type="date"
                        value={formData.departure}
                        onChange={(e) => setFormData({...formData, departure: e.target.value})}
                        isRequired
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Adults *</label>
                      <Input
                        type="number"
                        min="1"
                        value={formData.adults}
                        onChange={(e) => setFormData({...formData, adults: parseInt(e.target.value) || 1})}
                        isRequired
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Children</label>
                      <Input
                        type="number"
                        min="0"
                        value={formData.children}
                        onChange={(e) => setFormData({...formData, children: parseInt(e.target.value) || 0})}
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Source</label>
                    <Select
                      value={formData.source}
                      onChange={(e) => setFormData({...formData, source: e.target.value})}
                    >
                      <SelectItem key="walkin" value="walkin">🚶 Walk-in</SelectItem>
                      <SelectItem key="online" value="online">🌐 Online</SelectItem>
                      <SelectItem key="booking" value="booking">📱 Booking.com</SelectItem>
                      <SelectItem key="corporate" value="corporate">🏢 Corporate</SelectItem>
                      <SelectItem key="referral" value="referral">👥 Referral</SelectItem>
                    </Select>
                  </div>
                </div>
              </Tab>
              
              <Tab key="purpose-billing" title="🎯 Stay Purpose & Billing">
                <div className="space-y-4 pt-4">
                  {/* Stay Purpose Section */}
                  <div className="bg-blue-50 p-4 rounded-lg border">
                    <h4 className="font-medium text-blue-900 mb-3">Purpose of Stay</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Reason for Stay *</label>
                        <Select
                          value={formData.stayReason}
                          onChange={(e) => setFormData({...formData, stayReason: e.target.value as StayReason})}
                          isRequired
                        >
                          <SelectItem key="personal">👤 Personal</SelectItem>
                          <SelectItem key="business">💼 Business</SelectItem>
                          <SelectItem key="business">🏢 Corporate</SelectItem>
                          <SelectItem key="conference">🎤 Conference</SelectItem>
                          <SelectItem key="training">📚 Training</SelectItem>
                          <SelectItem key="medical">🏥 Medical</SelectItem>
                          <SelectItem key="tourism">🌍 Tourism</SelectItem>
                          <SelectItem key="other">📋 Other</SelectItem>
                        </Select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Additional Details</label>
                        <Input
                          value={formData.stayReasonDetails}
                          onChange={(e) => setFormData({...formData, stayReasonDetails: e.target.value})}
                          placeholder="More details about the purpose"
                        />
                      </div>
                    </div>
                    
                    {/* Business/Corporate specific fields */}
                    {['business', 'corporate', 'conference', 'training'].includes(formData.stayReason) && (
                      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
                          <Input
                            value={formData.companyName}
                            onChange={(e) => setFormData({...formData, companyName: e.target.value})}
                            placeholder="Company or organization name"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Project Code</label>
                          <Input
                            value={formData.projectCode}
                            onChange={(e) => setFormData({...formData, projectCode: e.target.value})}
                            placeholder="Project or cost center code"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Billing Person Section */}
                  <div className="bg-green-50 p-4 rounded-lg border">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium text-green-900">Billing Information</h4>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-gray-600">Guest Pays</span>
                        <input
                          type="checkbox"
                          id="useBillingPerson"
                          checked={useBillingPerson}
                          onChange={(e) => {
                            setUseBillingPerson(e.target.checked);
                            if (e.target.checked) {
                              setSelectedBillingPerson(null);
                              setFormData(prev => ({
                                ...prev,
                                billingPersonId: undefined,
                                companyName: ''
                              }));
                            }
                          }}
                          className="rounded border-gray-300"
                        />
                        <span className="text-sm text-gray-600">Third Party Pays</span>
                      </div>
                    </div>
                    
                    <p className="text-sm text-gray-600 mb-3">
                      {useBillingPerson 
                        ? "Select who will be responsible for payment (company, travel agent, etc.)"
                        : "Guest will be responsible for their own payment."
                      }
                    </p>
                    
                    {useBillingPerson && (
                      <div className="space-y-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Search for Billing Person
                          </label>
                          <div className="relative billing-person-search-container">
                            <div className="flex">
                              <Input
                                value={billingPersonSearchTerm}
                                onChange={(e) => setBillingPersonSearchTerm(e.target.value)}
                                placeholder="Search by name, company, or email"
                                onFocus={() => setShowBillingPersonSearch(true)}
                                className="flex-1"
                              />
                              {billingPersonSearchTerm && (
                                <Button
                                  size="sm"
                                  variant="light"
                                  color="danger"
                                  onClick={() => {
                                    setBillingPersonSearchTerm('');
                                    setFilteredBillingPersons([]);
                                  }}
                                  className="ml-2"
                                >
                                  ✕
                                </Button>
                              )}
                            </div>
                            {showBillingPersonSearch && billingPersonSearchTerm.trim() && (
                              <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                                {filteredBillingPersons.length > 0 ? (
                                  filteredBillingPersons.map(bp => (
                                    <div
                                      key={bp.id}
                                      className="p-3 hover:bg-gray-100 cursor-pointer border-b border-gray-200 last:border-b-0"
                                      onClick={() => handleBillingPersonSelection(bp)}
                                    >
                                      <div className="font-medium text-gray-900">{bp.name}</div>
                                      <div className="text-sm text-gray-600">
                                        {bp.company && `🏢 ${bp.company}`}
                                        {bp.position && ` 👤 ${bp.position}`}
                                        {bp.phone && ` 📱 ${bp.phone}`}
                                      </div>
                                      <div className="text-xs text-gray-500 mt-1">
                                        <Chip size="sm" variant="flat" color="secondary">
                                          {bp.billingRelationship.replace('_', ' ')}
                                        </Chip>
                                        {bp.isCorporateAccount && (
                                          <Chip size="sm" variant="flat" color="success" className="ml-1">
                                            Corporate Account
                                          </Chip>
                                        )}
                                      </div>
                                    </div>
                                  ))
                                ) : (
                                  <div className="p-3 text-gray-500 text-center">
                                    No billing persons found
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                        
                        {selectedBillingPerson && (
                          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                            <div className="flex items-center justify-between mb-2">
                              <div>
                                <div className="font-medium text-green-900">✅ Billing Person Selected</div>
                                <div className="text-sm text-green-700">
                                  {selectedBillingPerson.name} - {selectedBillingPerson.company || 'No company'}
                                </div>
                                <div className="text-xs text-green-600">
                                  {selectedBillingPerson.billingRelationship.replace('_', ' ')} • 
                                  {selectedBillingPerson.paymentTerms ? ` ${selectedBillingPerson.paymentTerms}` : ' Immediate payment'}
                                </div>
                              </div>
                              <Button
                                size="sm"
                                color="danger"
                                variant="light"
                                onClick={() => {
                                  setSelectedBillingPerson(null);
                                  setFormData(prev => ({
                                    ...prev,
                                    billingPersonId: undefined,
                                    companyName: ''
                                  }));
                                }}
                              >
                                Change
                              </Button>
                            </div>
                          </div>
                        )}
                        
                        {/* Quick add new billing person */}
                        <div className="text-center">
                          <Button
                            size="sm"
                            color="primary"
                            variant="bordered"
                            onClick={() => {
                              // This would open a modal to create a new billing person
                              alert('Feature: Create new billing person - Coming soon!');
                            }}
                          >
                            ➕ Add New Billing Person
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </Tab>
              
              <Tab key="self-checkin" title="🔑 Self-Check-in Link">
                <div className="space-y-4 pt-4">
                  <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                    <h4 className="font-medium text-green-900 mb-3">Self-Check-in Link</h4>
                    <p className="text-sm text-green-700 mb-3">
                      Generate a secure link that your client can use to check themselves in when they arrive. 
                      This provides contactless, queue-free check-in experience.
                    </p>
                    
                    {selectedGuest && selectedGuest.selfReservationToken ? (
                      <div className="space-y-3">
                        <div className="bg-white p-3 rounded border">
                          <label className="block text-sm font-medium text-gray-700 mb-2">Self-Check-in Link</label>
                          <div className="flex">
                            <Input
                              value={`${window.location.origin}/self-checkin/${selectedGuest.selfReservationToken}`}
                              isReadOnly
                              className="flex-1"
                            />
                            <Button
                              size="sm"
                              color="primary"
                              variant="flat"
                              onClick={() => {
                                navigator.clipboard.writeText(`${window.location.origin}/self-checkin/${selectedGuest.selfReservationToken}`);
                                alert('Link copied to clipboard!');
                              }}
                              className="ml-2"
                            >
                              📋 Copy
                            </Button>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            Expires: {new Date(selectedGuest.selfReservationExpiry || '').toLocaleDateString()}
                          </p>
                        </div>
                        
                        <div className="flex space-x-2">
                          <Button
                            size="sm"
                            color="success"
                            variant="flat"
                            onClick={() => {
                              // Send via email (would integrate with email service)
                              alert('Feature: Send via email - Coming soon!');
                            }}
                          >
                            📧 Send via Email
                          </Button>
                          <Button
                            size="sm"
                            color="primary"
                            variant="flat"
                            onClick={() => {
                              // Send via WhatsApp (would integrate with WhatsApp Business API)
                              alert('Feature: Send via WhatsApp - Coming soon!');
                            }}
                          >
                            💬 Send via WhatsApp
                          </Button>
                          <Button
                            size="sm"
                            color="warning"
                            variant="flat"
                            onClick={() => {
                              // Generate new token
                              const newToken = frontOfficeStore.generateSelfCheckinToken();
                              selectedGuest.selfReservationToken = newToken;
                              selectedGuest.selfReservationExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
                              alert('New link generated!');
                            }}
                          >
                            🔄 Regenerate Link
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-4">
                        <p className="text-gray-500 mb-3">No self-check-in link available yet.</p>
                        <p className="text-sm text-gray-400">
                          Create a reservation first to generate a self-check-in link for this guest.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </Tab>
              
              <Tab key="additional" title="📝 Additional Information">
                <div className="space-y-4 pt-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Remarks to Guest</label>
                    <Textarea
                      value={formData.remarksToGuest}
                      onChange={(e) => setFormData({...formData, remarksToGuest: e.target.value})}
                      placeholder="Special requests, preferences, or notes for the guest"
                      rows={3}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Internal Notes</label>
                    <Textarea
                      value={formData.internalNotes}
                      onChange={(e) => setFormData({...formData, internalNotes: e.target.value})}
                      placeholder="Internal notes for staff (not visible to guest)"
                      rows={3}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Market Codes</label>
                    <div className="flex flex-wrap gap-2">
                      {frontOfficeStore.marketCodes.map(code => (
                        <Chip
                          key={code}
                          variant={formData.marketCodes.includes(code) ? "solid" : "bordered"}
                          color={formData.marketCodes.includes(code) ? "primary" : "default"}
                          className="cursor-pointer"
                          onClick={() => {
                            const newCodes = formData.marketCodes.includes(code)
                              ? formData.marketCodes.filter(c => c !== code)
                              : [...formData.marketCodes, code];
                            setFormData({...formData, marketCodes: newCodes});
                          }}
                        >
                          {code}
                        </Chip>
                      ))}
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="guaranteed"
                      checked={formData.isGuaranteed}
                      onChange={(e) => setFormData({...formData, isGuaranteed: e.target.checked})}
                      className="rounded border-gray-300"
                    />
                    <label htmlFor="guaranteed" className="text-sm font-medium text-gray-700">
                      Reservation is guaranteed (deposit received)
                    </label>
                  </div>
                </div>
              </Tab>
            </Tabs>
          </ModalBody>
          <ModalFooter className="flex flex-col sm:flex-row gap-2 sm:gap-0 sm:justify-end">
            <Button color="primary" onClick={handleSaveReservation} className="w-full sm:w-auto">
              {isCreatingNew 
                ? (useExistingGuest && selectedGuest 
                    ? `💾 Create Reservation for ${selectedGuest.name}` 
                    : '💾 Create Reservation')
                : '💾 Update Reservation'
              }
            </Button>
            <Button 
              color="secondary" 
              variant="flat" 
              onClick={() => {
                // Navigate to next step or show next form
                console.log('Next step clicked');
              }}
              className="w-full sm:w-auto"
            >
              ➡️ Next
            </Button>
            <Button variant="light" onClick={onClose} className="w-full sm:w-auto">
              Cancel
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
