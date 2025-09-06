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
import { useSettingsStore } from '../lib/settings/store';
import { housekeepingStore } from '../lib/housekeeping/store';
import { trackEvent } from '../lib/analytics/trackEvent';
import { Reservation, GuestProfile, RoomType, RatePlan, StayReason, Nationality, IdType } from '../lib/frontoffice/types';

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
  const [tabKey, setTabKey] = useState<string>('guest');
  
  // New state for guest selection (default to existing guest search)
  const [useExistingGuest, setUseExistingGuest] = useState(true);
  const [guestSearchTerm, setGuestSearchTerm] = useState('');
  const [filteredGuests, setFilteredGuests] = useState<GuestProfile[]>([]);
  const [selectedGuest, setSelectedGuest] = useState<GuestProfile | null>(null);
  const [showGuestSearch, setShowGuestSearch] = useState(false);
  const [isGuestSearching, setIsGuestSearching] = useState(false);
  const [guestSearchError, setGuestSearchError] = useState<string | null>(null);
  
  // New state for billing person selection
  const [useBillingPerson, setUseBillingPerson] = useState(false);
  const [billingPersonSearchTerm, setBillingPersonSearchTerm] = useState('');
  const [filteredBillingPersons, setFilteredBillingPersons] = useState<GuestProfile[]>([]);
  const [selectedBillingPerson, setSelectedBillingPerson] = useState<GuestProfile | null>(null);
  const [showBillingPersonSearch, setShowBillingPersonSearch] = useState(false);
  const [isBillingPersonSearching, setIsBillingPersonSearching] = useState(false);
  const [billingPersonSearchError, setBillingPersonSearchError] = useState<string | null>(null);
  
  // Bulk reservation state
  const [isBulkReservation, setIsBulkReservation] = useState(false);
  const [bulkGuests, setBulkGuests] = useState<Array<{
    id: string;
    guest: GuestProfile;
    roomTypeId: string;
    roomId?: string;
    customRate?: number;
    specialRequests?: string;
    adults: number;
    children: number;
    arrival: string;
    departure: string;
  }>>([]);
  
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

  // Filter guests based on search term with enhanced validation
  useEffect(() => {
    if (guestSearchTerm.trim()) {
      const term = guestSearchTerm.toLowerCase().trim();
      
      // Validate search term length
      if (term.length < 2) {
        setFilteredGuests([]);
        setGuestSearchError('Please enter at least 2 characters to search');
        setIsGuestSearching(false);
        return;
      }
      
      setIsGuestSearching(true);
      setGuestSearchError(null);
      
      // Add small delay to prevent excessive filtering
      const timeoutId = setTimeout(() => {
        try {
      const filtered = frontOfficeStore.guests.filter((guest: any) => {
            // Ensure guest has required fields
            if (!guest || !guest.id) return false;
            
            const name = guest.name || `${guest.firstName || ''} ${guest.lastName || ''}`.trim();
        const phone = guest.phone || '';
        const email = guest.email || '';
        const idNum = guest.idNumber || '';
            const serialNum = guest.serialNumber || '';
            
            // Enhanced search criteria
        return (
          (name && String(name).toLowerCase().includes(term)) ||
              (phone && String(phone).replace(/\s+/g, '').includes(term.replace(/\s+/g, ''))) ||
          (email && String(email).toLowerCase().includes(term)) ||
              (idNum && String(idNum).toLowerCase().includes(term)) ||
              (serialNum && String(serialNum).toLowerCase().includes(term))
        );
      });
          
          // Sort by relevance (exact matches first, then partial matches)
          const sortedFiltered = filtered.sort((a, b) => {
            const aName = (a as any).name || `${(a as any).firstName || ''} ${(a as any).lastName || ''}`.trim();
            const bName = (b as any).name || `${(b as any).firstName || ''} ${(b as any).lastName || ''}`.trim();
            
            const aExactMatch = aName.toLowerCase().startsWith(term);
            const bExactMatch = bName.toLowerCase().startsWith(term);
            
            if (aExactMatch && !bExactMatch) return -1;
            if (!aExactMatch && bExactMatch) return 1;
            return aName.localeCompare(bName);
          });
          
          setFilteredGuests(sortedFiltered);
          setIsGuestSearching(false);
          
          if (sortedFiltered.length === 0) {
            setGuestSearchError('No guests found matching your search');
          }
        } catch (error) {
          console.error('Error filtering guests:', error);
          setFilteredGuests([]);
          setGuestSearchError('Error searching guests. Please try again.');
          setIsGuestSearching(false);
        }
      }, 300); // 300ms debounce
      
      return () => clearTimeout(timeoutId);
    } else {
      setFilteredGuests([]);
      setGuestSearchError(null);
      setIsGuestSearching(false);
    }
  }, [guestSearchTerm]);

  // Filter billing persons based on search term with enhanced validation
  useEffect(() => {
    if (billingPersonSearchTerm.trim()) {
      const term = billingPersonSearchTerm.toLowerCase().trim();
      
      // Validate search term length
      if (term.length < 2) {
        setFilteredBillingPersons([]);
        setBillingPersonSearchError('Please enter at least 2 characters to search');
        setIsBillingPersonSearching(false);
        return;
      }
      
      setIsBillingPersonSearching(true);
      setBillingPersonSearchError(null);
      
      // Add small delay to prevent excessive filtering
      const timeoutId = setTimeout(() => {
        try {
          const filtered = frontOfficeStore.guests.filter((g: any) => {
            // Ensure guest has required fields
            if (!g || !g.id) return false;
            
            const name = g.name || `${g.firstName || ''} ${g.lastName || ''}`.trim();
            const company = g.employerCompany || g.companyName || '';
            const email = g.email || '';
            const phone = g.phone || '';
            const jobTitle = g.jobTitle || '';
            const serialNum = g.serialNumber || '';
            
            // Enhanced search criteria for billing persons
        return (
          (name && String(name).toLowerCase().includes(term)) ||
          (company && String(company).toLowerCase().includes(term)) ||
          (email && String(email).toLowerCase().includes(term)) ||
              (phone && String(phone).replace(/\s+/g, '').includes(term.replace(/\s+/g, ''))) ||
              (jobTitle && String(jobTitle).toLowerCase().includes(term)) ||
              (serialNum && String(serialNum).toLowerCase().includes(term))
        );
      });
          
          // Sort by relevance (company matches first, then name matches)
          const sortedFiltered = filtered.sort((a, b) => {
            const aName = (a as any).name || `${(a as any).firstName || ''} ${(a as any).lastName || ''}`.trim();
            const bName = (b as any).name || `${(b as any).firstName || ''} ${(b as any).lastName || ''}`.trim();
            const aCompany = (a as any).employerCompany || (a as any).companyName || '';
            const bCompany = (b as any).employerCompany || (b as any).companyName || '';
            
            const aCompanyMatch = aCompany.toLowerCase().includes(term);
            const bCompanyMatch = bCompany.toLowerCase().includes(term);
            const aNameMatch = aName.toLowerCase().startsWith(term);
            const bNameMatch = bName.toLowerCase().startsWith(term);
            
            // Prioritize company matches, then name matches
            if (aCompanyMatch && !bCompanyMatch) return -1;
            if (!aCompanyMatch && bCompanyMatch) return 1;
            if (aNameMatch && !bNameMatch) return -1;
            if (!aNameMatch && bNameMatch) return 1;
            
            return aName.localeCompare(bName);
          });
          
          setFilteredBillingPersons(sortedFiltered);
          setIsBillingPersonSearching(false);
          
          if (sortedFiltered.length === 0) {
            setBillingPersonSearchError('No billing persons found matching your search');
          }
        } catch (error) {
          console.error('Error filtering billing persons:', error);
          setFilteredBillingPersons([]);
          setBillingPersonSearchError('Error searching billing persons. Please try again.');
          setIsBillingPersonSearching(false);
        }
      }, 300); // 300ms debounce
      
      return () => clearTimeout(timeoutId);
    } else {
      setFilteredBillingPersons([]);
      setBillingPersonSearchError(null);
      setIsBillingPersonSearching(false);
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
    setIsBulkReservation(true); // Always use bulk form - it can handle single guests too
    setUseExistingGuest(false);
    setSelectedGuest(null);
    setGuestSearchTerm('');
    setUseBillingPerson(false); // Let user choose billing person
    setSelectedBillingPerson(null);
    setBillingPersonSearchTerm('');
    setBulkGuests([]);
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

  const addGuestToBulk = (guest: GuestProfile) => {
    // Check if guest is already added
    if (bulkGuests.some(bg => bg.guest.id === guest.id)) {
      alert('This guest is already added to the bulk reservation');
      return;
    }

    const newId = (bulkGuests.length + 1).toString();
    const roomTypeId = formData.roomTypeId || useSettingsStore.getState().roomManagement.roomTypes[0]?.id || '';
    const roomType = useSettingsStore.getState().roomManagement.roomTypes.find(rt => rt.id === roomTypeId);
    const baseRate = roomType?.baseRate || 0;

    setBulkGuests([...bulkGuests, {
      id: newId,
      guest: guest,
      roomTypeId: roomTypeId,
      roomId: '',
      customRate: baseRate,
      specialRequests: '',
      adults: 1,
      children: 0,
      arrival: formData.arrival || '',
      departure: formData.departure || ''
    }]);

    // Clear search
    setGuestSearchTerm('');
    setFilteredGuests([]);
    setShowGuestSearch(false);
  };

  const removeBulkGuest = (id: string) => {
    setBulkGuests(bulkGuests.filter(guest => guest.id !== id));
  };

  const updateBulkGuest = (id: string, field: string, value: string | number) => {
    setBulkGuests(bulkGuests.map(guest => 
      guest.id === id ? { ...guest, [field]: value } : guest
    ));
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
      guestName: guest.name || '',
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

  const handleBillingPersonSelection = (billingPerson: GuestProfile) => {
    setSelectedBillingPerson(billingPerson);
    setFormData(prev => ({
      ...prev,
      billingPersonId: billingPerson.id,
      companyName: (billingPerson as any).employerCompany || prev.companyName || ''
    }));
    setShowBillingPersonSearch(false);
    setBillingPersonSearchTerm('');
    
    console.log(`[FO.Reservation] Billing person selected: ${(billingPerson as any).name} for reservation`);
    trackEvent('FO.Reservation.BillingPersonSelected', {
      billingPersonId: (billingPerson as any).id,
      billingPersonName: (billingPerson as any).name,
      company: (billingPerson as any).employerCompany
    });
  };

  const handleSaveReservation = () => {
    if (isCreatingNew) {
      // Handle reservation (single or multiple guests)
      if (bulkGuests.length === 0) {
        alert('Please add at least one guest to the reservation');
        return;
      }
      
      // Validate billing person for multiple guests
      if (bulkGuests.length > 1 && !selectedBillingPerson) {
        alert('Please select a billing person for multiple guest reservations');
        return;
      }

        // Create reservations for each guest
        const createdReservations = [];
        for (const bulkGuest of bulkGuests) {
          // Use the selected guest (already exists in system)
          const guest = bulkGuest.guest;

          // Create reservation with personal details from each guest
      const reservation = frontOfficeStore.createReservation({
        guestId: guest.id,
        guestName: guest.name,
            roomTypeId: bulkGuest.roomTypeId,
        ratePlanId: formData.ratePlanId || undefined,
            arrival: bulkGuest.arrival,
            departure: bulkGuest.departure,
            adults: bulkGuest.adults,
            children: bulkGuest.children,
        source: formData.source,
        isGuaranteed: formData.isGuaranteed,
            remarksToGuest: bulkGuest.specialRequests || formData.remarksToGuest,
        internalNotes: formData.internalNotes,
        marketCodes: formData.marketCodes,
        status: 'confirmed',
        stayReason: formData.stayReason,
        stayReasonDetails: formData.stayReasonDetails,
        billingPersonId: formData.billingPersonId,
        companyName: formData.companyName,
        projectCode: formData.projectCode,
            costCenter: formData.costCenter,
            roomId: bulkGuest.roomId,
            customRate: bulkGuest.customRate // Add custom rate if specified
          });

          createdReservations.push(reservation);
        }

        trackEvent('FO.Reservation.BulkCreated', {
          count: createdReservations.length,
          companyName: formData.companyName,
          billingPersonId: formData.billingPersonId,
          stayReason: formData.stayReason
        });

        alert(`Successfully created ${createdReservations.length} reservation${createdReservations.length !== 1 ? 's' : ''}${formData.companyName ? ` for ${formData.companyName}` : ''}`);
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
              <TableColumn className="hidden sm:table-cell">ResID</TableColumn>
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
                      <span className="font-semibold text-ghana-black">{reservation.resId || reservation.id}</span>
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
            <Tabs aria-label="Reservation details" selectedKey={tabKey} onSelectionChange={(key)=> setTabKey(key as string)}>
              <Tab key="guest" title="👤 Guest & Reservation Details">
                <div className="space-y-4 pt-4">
                  {/* Guest Management - Unified for Single and Multiple */}
                  {isCreatingNew && (
                    <div className="bg-purple-50 p-4 rounded-lg border">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="font-medium text-purple-900">👥 Guest List ({bulkGuests.length} guest{bulkGuests.length !== 1 ? 's' : ''})</h4>
                        <div className="text-sm text-purple-700">
                          Search and add guests from the system
                        </div>
                      </div>
                      
                      {/* Guest Search for Bulk */}
                      <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                          Search and Add Guests
                            </label>
                            <div className="relative guest-search-container">
                              <div className="flex">
                                <Input
                                  value={guestSearchTerm}
                              onChange={(e) => {
                                setGuestSearchTerm(e.target.value);
                                setGuestSearchError(null);
                              }}
                              placeholder="Search for existing guests by name, phone, email, or Ghana Card"
                                  onFocus={() => setShowGuestSearch(true)}
                                  className="flex-1"
                              isInvalid={!!guestSearchError && guestSearchTerm.length >= 2}
                              errorMessage={guestSearchError && guestSearchTerm.length >= 2 ? guestSearchError : undefined}
                              startContent={
                                isGuestSearching ? (
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-600"></div>
                                ) : (
                                  <span className="text-gray-400">🔍</span>
                                )
                              }
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
                              {isGuestSearching ? (
                                <div className="p-4 text-center">
                                  <div className="flex items-center justify-center space-x-2">
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-600"></div>
                                    <span className="text-sm text-gray-600">Searching guests...</span>
                                  </div>
                                </div>
                              ) : guestSearchError ? (
                                <div className="p-3 text-center">
                                  <div className="text-red-600 text-sm mb-2">⚠️ {guestSearchError}</div>
                                </div>
                              ) : filteredGuests.length > 0 ? (
                                    filteredGuests.map(guest => (
                                      <div
                                        key={guest.id}
                                        className="p-3 hover:bg-gray-100 cursor-pointer border-b border-gray-200 last:border-b-0"
                                    onClick={() => addGuestToBulk(guest)}
                                  >
                                    <div className="flex items-center justify-between">
                                <div>
                                        <div className="font-medium text-gray-900">
                                          {(guest as any).name || `${(guest as any).firstName || ''} ${(guest as any).lastName || ''}`.trim() || 'Unknown guest'}
                                        </div>
                                        <div className="text-sm text-gray-600">
                                          {(guest as any).phone && `📱 ${(guest as any).phone}`}
                                          {(guest as any).email && ` 📧 ${(guest as any).email}`}
                                  </div>
                                </div>
                                <Button
                                  size="sm"
                                        color="primary"
                                        variant="flat"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          addGuestToBulk(guest);
                                        }}
                                      >
                                        ➕ Add
                                </Button>
                              </div>
                              </div>
                                ))
                              ) : (
                                <div className="p-3 text-gray-500 text-center">
                                  <div className="text-sm">No guests found</div>
                                  <div className="text-xs mt-1">Try searching by name, phone, email, or ID number</div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    </div>
                      
                      {/* Selected Guests List */}
                      {bulkGuests.length > 0 && (
                        <div className="space-y-3">
                          {bulkGuests.map((bulkGuest, index) => {
                            const roomType = useSettingsStore.getState().roomManagement.roomTypes.find(rt => rt.id === bulkGuest.roomTypeId);
                            const baseRate = roomType?.baseRate || 0;
                            const finalRate = bulkGuest.customRate || baseRate;
                            
                            return (
                              <div key={bulkGuest.id} className="bg-white p-4 rounded-lg border border-purple-200">
                                <div className="flex items-center justify-between mb-3">
                                  <div className="flex items-center space-x-3">
                                    <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center text-sm font-medium text-purple-700">
                                      {index + 1}
                    </div>
                      <div>
                                      <h5 className="font-medium text-gray-900">{bulkGuest.guest.name}</h5>
                                      <div className="text-sm text-gray-600">
                                        {bulkGuest.guest.phone && `📱 ${bulkGuest.guest.phone}`}
                                        {bulkGuest.guest.email && ` 📧 ${bulkGuest.guest.email}`}
                      </div>
                      </div>
                      </div>
                                  <Button
                          size="sm"
                                    color="danger"
                                    variant="light"
                                    onClick={() => removeBulkGuest(bulkGuest.id)}
                                  >
                                    🗑️ Remove
                                  </Button>
                      </div>
                                
                                {/* Personal Details */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3 p-3 bg-gray-50 rounded-lg">
                        <Input
                                    label="Adults"
                                    type="number"
                                    min="1"
                                    max="10"
                                    value={bulkGuest.adults.toString()}
                                    onChange={(e) => updateBulkGuest(bulkGuest.id, 'adults', parseInt(e.target.value) || 1)}
                          size="sm"
                                  />
                        <Input
                                    label="Children"
                                    type="number"
                                    min="0"
                                    max="10"
                                    value={bulkGuest.children.toString()}
                                    onChange={(e) => updateBulkGuest(bulkGuest.id, 'children', parseInt(e.target.value) || 0)}
                          size="sm"
                        />
                        <Input
                                    label="Arrival Date"
                                    type="date"
                                    value={bulkGuest.arrival}
                                    onChange={(e) => updateBulkGuest(bulkGuest.id, 'arrival', e.target.value)}
                          size="sm"
                                  />
                      <Input
                                    label="Departure Date"
                                    type="date"
                                    value={bulkGuest.departure}
                                    onChange={(e) => updateBulkGuest(bulkGuest.id, 'departure', e.target.value)}
                        size="sm"
                      />
                    </div>

                                {/* Room Configuration */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <Select
                                    label="Room Type"
                                    selectedKeys={bulkGuest.roomTypeId ? new Set([bulkGuest.roomTypeId]) : new Set()}
                                    onSelectionChange={(keys) => {
                                      const id = Array.from(keys as Set<string>)[0] || '';
                                      const newRoomType = useSettingsStore.getState().roomManagement.roomTypes.find(rt => rt.id === id);
                                      updateBulkGuest(bulkGuest.id, 'roomTypeId', id);
                                      updateBulkGuest(bulkGuest.id, 'customRate', newRoomType?.baseRate || 0);
                                    }}
                        placeholder="Select room type"
                                  >
                                    {useSettingsStore.getState().roomManagement.roomTypes.map(rt => (
                                      <SelectItem key={rt.id}>
                                        {rt.name} - ₵{rt.baseRate}/night
                          </SelectItem>
                        ))}
                      </Select>
                                  
                      <Input
                                    label="Custom Rate (₵)"
                                    type="number"
                                    placeholder="Override rate"
                                    value={bulkGuest.customRate?.toString() || ''}
                                    onChange={(e) => updateBulkGuest(bulkGuest.id, 'customRate', parseFloat(e.target.value) || baseRate)}
                                    startContent="₵"
                                  />
                                  
                                  <div className="flex items-end">
                                    <div className="w-full p-3 bg-gray-50 rounded-lg">
                                      <div className="text-sm text-gray-600">Final Rate</div>
                                      <div className="text-lg font-semibold text-gray-900">₵{finalRate.toFixed(2)}/night</div>
                    </div>
                    </div>
                  </div>
                  
                                <div className="mt-3">
                                  <Textarea
                                    label="Special Requests"
                                    placeholder="Any special requests for this guest"
                                    value={bulkGuest.specialRequests || ''}
                                    onChange={(e) => updateBulkGuest(bulkGuest.id, 'specialRequests', e.target.value)}
                                    rows={2}
                      />
                    </div>
                    </div>
                            );
                          })}
                  </div>
                      )}
                      
                      {bulkGuests.length === 0 && (
                        <div className="text-center py-8 text-gray-500">
                          <div className="text-4xl mb-2">👥</div>
                          <div className="text-lg font-medium">No guests added yet</div>
                          <div className="text-sm">Search for guests above and click "Add" to include them</div>
                  </div>
                      )}
                </div>
                  )}
              
                  {/* Stay Purpose & Billing moved here from the separate tab */}
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
                          <SelectItem key="corporate">🏢 Corporate</SelectItem>
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
                                onChange={(e) => {
                                  setBillingPersonSearchTerm(e.target.value);
                                  setBillingPersonSearchError(null);
                                }}
                                placeholder="Search by name, company, or email"
                                onFocus={() => setShowBillingPersonSearch(true)}
                                className="flex-1"
                                isInvalid={!!billingPersonSearchError && billingPersonSearchTerm.length >= 2}
                                errorMessage={billingPersonSearchError && billingPersonSearchTerm.length >= 2 ? billingPersonSearchError : undefined}
                                startContent={
                                  isBillingPersonSearching ? (
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600"></div>
                                  ) : (
                                    <span className="text-gray-400">🔍</span>
                                  )
                                }
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
                                {isBillingPersonSearching ? (
                                  <div className="p-4 text-center">
                                    <div className="flex items-center justify-center space-x-2">
                                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600"></div>
                                      <span className="text-sm text-gray-600">Searching billing persons...</span>
                                    </div>
                                  </div>
                                ) : billingPersonSearchError ? (
                                  <div className="p-3 text-center">
                                    <div className="text-red-600 text-sm mb-2">⚠️ {billingPersonSearchError}</div>
                                    {billingPersonSearchTerm.length < 2 && (
                                      <div className="text-xs text-gray-500">
                                        Enter at least 2 characters to search
                                      </div>
                                    )}
                                  </div>
                                ) : filteredBillingPersons.length > 0 ? (
                                  (filteredBillingPersons as any[]).map((bp: any) => (
                                    <div
                                      key={bp.id}
                                      className="p-3 hover:bg-gray-100 cursor-pointer border-b border-gray-200 last:border-b-0"
                                      onClick={() => handleBillingPersonSelection(bp)}
                                    >
                                      <div className="font-medium text-gray-900">
                                        {bp.name || `${bp.firstName || ''} ${bp.lastName || ''}`}
                                      </div>
                                      <div className="text-sm text-gray-600">
                                        {bp.employerCompany && `🏢 ${bp.employerCompany}`}
                                        {bp.jobTitle && ` 👤 ${bp.jobTitle}`}
                                        {bp.phone && ` 📱 ${bp.phone}`}
                                        {bp.email && ` 📧 ${bp.email}`}
                                      </div>
                                      <div className="text-xs text-gray-500 mt-1">
                                        Serial: {bp.serialNumber || 'N/A'}
                                      </div>
                                    </div>
                                  ))
                                ) : (
                                  <div className="p-3 text-gray-500 text-center">
                                    <div className="text-sm">No billing persons found</div>
                                    <div className="text-xs mt-1">Try searching by name, company, or email</div>
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
                                  {(selectedBillingPerson as any).name || `${(selectedBillingPerson as any).firstName || ''} ${(selectedBillingPerson as any).lastName || ''}`.trim()}
                                </div>
                                <div className="text-xs text-green-700">
                                  {(selectedBillingPerson as any).employerCompany || formData.companyName || '—'}
                                  {((selectedBillingPerson as any).jobTitle ? ` • ${(selectedBillingPerson as any).jobTitle}` : '')}
                                </div>
                                <div className="text-xs text-green-600">
                                  {((selectedBillingPerson as any).email || '—')}
                                  {((selectedBillingPerson as any).phone ? ` • ${(selectedBillingPerson as any).phone}` : '')}
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

                  {/* Source */}
                  <div className="mb-4 p-3 bg-yellow-50 rounded-lg">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Source
                    </label>
                    <Select
                      value={formData.source}
                      onChange={(e) => setFormData(prev => ({ ...prev, source: e.target.value }))}
                    >
                      <SelectItem key="walkin">🚶 Walk-in</SelectItem>
                      <SelectItem key="online">🌐 Online</SelectItem>
                      <SelectItem key="booking">📱 Booking.com</SelectItem>
                      <SelectItem key="corporate">🏢 Corporate</SelectItem>
                      <SelectItem key="referral">👥 Referral</SelectItem>
                    </Select>
                  </div>
                </div>
              </Tab>
              
              
              {/* Removed separate Stay Purpose & Billing tab (merged into Guest Information) */}
              
              
              
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
            <Button 
              color="primary" 
              onClick={handleSaveReservation} 
              className="w-full sm:w-auto"
              isDisabled={isCreatingNew && bulkGuests.length === 0}
            >
              {isCreatingNew 
                ? (bulkGuests.length > 0 
                    ? `💾 Create ${bulkGuests.length} Reservation${bulkGuests.length !== 1 ? 's' : ''}`
                    : '💾 Add Guest First')
                : '💾 Update Reservation'
              }
            </Button>
            <Button 
              color="secondary" 
              variant="flat" 
              onClick={() => setTabKey(prev => (prev === 'guest' ? 'additional' : 'guest'))}
              className="w-full sm:w-auto"
            >
              {tabKey === 'guest' ? 'Next: Additional Info' : 'Previous: Guest Info'}
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
