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
import { trackEvent } from '../lib/analytics/trackEvent';
import { Reservation, GuestProfile, RoomType, RatePlan, StayReason, Nationality, IdType } from '../lib/frontoffice/types';

interface CheckInFormData {
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

interface QuickCheckInManagerProps {
  onCheckInComplete?: (reservationId: string) => void;
  onClose?: () => void;
}

export default function QuickCheckInManager({ onCheckInComplete, onClose }: QuickCheckInManagerProps) {
  const [isCreatingNew, setIsCreatingNew] = useState(true);
  const { isOpen, onOpen, onClose: onModalClose } = useDisclosure();
  const [tabKey, setTabKey] = useState<string>('guest');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Folio preview modal state
  const { isOpen: isFolioModalOpen, onOpen: onFolioModalOpen, onClose: onFolioModalClose } = useDisclosure();
  const [folioData, setFolioData] = useState<any>(null);
  const [upfrontPayment, setUpfrontPayment] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<string>('cash');
  
  // Derived pricing helpers
  const getSelectedRoomType = (roomTypeId: string) =>
    useSettingsStore.getState().roomManagement.roomTypes.find(rt => rt.id === roomTypeId);
  const getNightlyRate = (roomTypeId: string) => {
    // First try to get rate from selected rate plan
    if (formData.ratePlanId) {
      const ratePlan = useSettingsStore.getState().roomManagement.ratePlans.find(rp => rp.id === formData.ratePlanId);
      if (ratePlan) {
        return ratePlan.basePrice || 0;
      }
    }
    
    // Fallback to room type base rate or first available rate plan for this room type
    const roomType = getSelectedRoomType(roomTypeId);
    if (roomType?.baseRate) {
      return roomType.baseRate;
    }
    
    // Try to find any rate plan for this room type
    const ratePlan = useSettingsStore.getState().roomManagement.ratePlans.find(rp => rp.roomTypeId === roomTypeId);
    return ratePlan?.basePrice || 0;
  };
  const getTaxRate = () => {
    // Try reading tax from settings; fall back to 15% if not configured
    try {
      const settings = useSettingsStore.getState();
      const vat = (settings as any)?.accounting?.taxRates?.vat || 0;
      const nhil = (settings as any)?.accounting?.taxRates?.nhil || 0;
      const levy = (settings as any)?.accounting?.taxRates?.tourismLevy || 0;
      const total = [vat, nhil, levy].filter(Boolean).reduce((a: number, b: number) => a + b, 0);
      return total > 0 ? total : 0.15;
    } catch {
      return 0.15;
    }
  };
  const getComputedTotals = (arrival: string, departure: string, roomTypeId: string) => {
    const nights = calculateNights(arrival, departure) || 1;
    const nightly = getNightlyRate(roomTypeId);
    const subtotal = nightly * nights;
    const taxRate = getTaxRate();
    const tax = Math.round(subtotal * taxRate);
    const grandTotal = subtotal + tax;
    return { nights, nightly, subtotal, taxRate, tax, grandTotal };
  };
  
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
  
  // Bulk check-in state
  const [isBulkCheckIn, setIsBulkCheckIn] = useState(false);
  const [bulkGuests, setBulkGuests] = useState<Array<{
    id: string;
    guest: GuestProfile;
    roomTypeId: string;
    ratePlanId?: string;
    specialRequests?: string;
    adults: number;
    children: number;
    arrival: string;
    departure: string;
  }>>([]);
  
  // Room search state
  const [selectedRoom, setSelectedRoom] = useState<any>(null);
  
  const [formData, setFormData] = useState<CheckInFormData>({
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
    arrival: new Date().toISOString().split('T')[0],
    departure: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    adults: 1,
    children: 0,
    source: 'walkin',
    isGuaranteed: true,
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

  // Auto-open modal when component mounts
  useEffect(() => {
    onOpen();
  }, []);


  // Disable form until guest is selected
  const isFormDisabled = !isBulkCheckIn ? !selectedGuest : bulkGuests.length === 0;

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

  const calculateNights = (arrival: string, departure: string) => {
    if (!arrival || !departure) return 0;
    const arrivalDate = new Date(arrival);
    const departureDate = new Date(departure);
    const diffTime = departureDate.getTime() - arrivalDate.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const handleGuestSelect = (guest: GuestProfile) => {
    setSelectedGuest(guest);
    setFormData(prev => ({
      ...prev,
      guestName: guest.name || `${guest.firstName || ''} ${guest.lastName || ''}`.trim(),
      phone: guest.phone || '',
      email: guest.email || '',
      nationality: guest.nationality || 'ghanaian',
      idType: guest.idType || 'ghana_card',
      idNumber: guest.idNumber || '',
      dateOfBirth: guest.dateOfBirth || '',
      gender: guest.gender || 'prefer_not_to_say',
      emergencyContactName: (guest as any).emergencyContactName || '',
      emergencyContactRelationship: (guest as any).emergencyContactRelationship || 'other',
      emergencyContactPhone: (guest as any).emergencyContactPhone || '',
      emergencyContactEmail: (guest as any).emergencyContactEmail || '',
      emergencyContactAddress: (guest as any).emergencyContactAddress || ''
    }));
    setGuestSearchTerm('');
    setFilteredGuests([]);
    setShowGuestSearch(false);
  };

  const handleBillingPersonSelect = (guest: GuestProfile) => {
    setSelectedBillingPerson(guest);
    setFormData(prev => ({
      ...prev,
      billingPersonId: guest.id,
      companyName: (guest as any).employerCompany || (guest as any).companyName || ''
    }));
    setBillingPersonSearchTerm('');
    setFilteredBillingPersons([]);
    setShowBillingPersonSearch(false);
  };

  // Bulk check-in functions
  const addGuestToBulk = (guest: GuestProfile) => {
    const newBulkGuest = {
      id: `bulk-${Date.now()}-${Math.random()}`,
      guest,
      roomTypeId: formData.roomTypeId || '',
      ratePlanId: formData.ratePlanId || '',
      adults: formData.adults,
      children: formData.children,
      arrival: formData.arrival,
      departure: formData.departure
    };
    setBulkGuests(prev => [...prev, newBulkGuest]);
    setGuestSearchTerm('');
    setFilteredGuests([]);
    setShowGuestSearch(false);
  };

  const removeBulkGuest = (id: string) => {
    setBulkGuests(prev => prev.filter(bg => bg.id !== id));
  };

  const updateBulkGuest = (id: string, field: string, value: any) => {
    setBulkGuests(prev => prev.map(bg => 
      bg.id === id ? { ...bg, [field]: value } : bg
    ));
  };


  const prepareFolioData = () => {
    if (isBulkCheckIn) {
      // For bulk check-ins, show summary for all guests
      const folioSummary = bulkGuests.map(guest => {
        const totals = getComputedTotals(guest.arrival, guest.departure, guest.roomTypeId);
        return {
          guestName: guest.guest.name || `${guest.guest.firstName || ''} ${guest.guest.lastName || ''}`.trim(),
          roomType: getSelectedRoomType(guest.roomTypeId)?.name || 'Unknown',
          arrival: guest.arrival,
          departure: guest.departure,
          nights: totals.nights,
          nightly: totals.nightly,
          subtotal: totals.subtotal,
          tax: totals.tax,
          grandTotal: totals.grandTotal
        };
      });
      
      setFolioData({
        type: 'bulk',
        guests: folioSummary,
        totalAmount: folioSummary.reduce((sum, guest) => sum + guest.grandTotal, 0)
      });
    } else {
      // For single guest check-in
      const totals = getComputedTotals(formData.arrival, formData.departure, formData.roomTypeId || '');
      setFolioData({
        type: 'single',
        guestName: formData.guestName,
        roomType: getSelectedRoomType(formData.roomTypeId || '')?.name || 'Unknown',
        arrival: formData.arrival,
        departure: formData.departure,
        nights: totals.nights,
        nightly: totals.nightly,
        subtotal: totals.subtotal,
        tax: totals.tax,
        grandTotal: totals.grandTotal
      });
    }
    onFolioModalOpen();
  };

  const handleSubmit = async () => {
    if (isBulkCheckIn) {
      if (bulkGuests.length === 0) {
        alert('Please add guests to check-in');
        return;
      }
    } else {
      if (!selectedGuest || !formData.roomTypeId) {
        alert('Please select a guest and room type');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      if (isBulkCheckIn) {
        // Process bulk check-ins
        const results = [];
        for (const bulkGuest of bulkGuests) {
          try {
            const guestId = bulkGuest.guest.id;
            
            // Create reservation for each guest
            const totals = getComputedTotals(bulkGuest.arrival, bulkGuest.departure, bulkGuest.roomTypeId);
            const reservation: Omit<Reservation, 'id'> = {
              guestId,
              guestName: bulkGuest.guest.name || `${bulkGuest.guest.firstName || ''} ${bulkGuest.guest.lastName || ''}`.trim(),
              guestPhone: bulkGuest.guest.phone,
              guestEmail: bulkGuest.guest.email,
              roomTypeId: bulkGuest.roomTypeId,
              ratePlanId: bulkGuest.ratePlanId,
              arrival: bulkGuest.arrival,
              departure: bulkGuest.departure,
              adults: bulkGuest.adults,
              children: bulkGuest.children,
              source: formData.source || 'walkin',
              status: 'confirmed',
              isGuaranteed: formData.isGuaranteed,
              remarksToGuest: formData.remarksToGuest,
              internalNotes: formData.internalNotes,
              marketCodes: formData.marketCodes,
              stayReason: formData.stayReason,
              stayReasonDetails: formData.stayReasonDetails,
              billingPersonId: formData.billingPersonId,
              companyName: formData.companyName,
              projectCode: formData.projectCode,
              costCenter: formData.costCenter,
              rateBreakdown: [{
                date: bulkGuest.arrival,
                base: totals.nightly,
                total: totals.nightly
              }],
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            };

            const reservationId = (frontOfficeStore.createReservation(reservation) as any).id;

            // Assign room (specific or auto)
            if (selectedRoom && selectedRoom.roomTypeId === bulkGuest.roomTypeId) {
              frontOfficeStore.assignRoom(reservationId, selectedRoom.id);
            } else {
              // Auto-assign room
              const availableRooms = frontOfficeStore.rooms.filter(room => 
                !(room as any).isOutOfService && 
                room.roomTypeId === bulkGuest.roomTypeId
              );

              if (availableRooms.length > 0) {
                const assignedRoom = availableRooms[0];
                frontOfficeStore.assignRoom(reservationId, assignedRoom.id);
              }
            }

            // Auto check-in
            frontOfficeStore.updateReservationStatus(reservationId, 'checked-in');

            results.push({ success: true, reservationId, guestName: bulkGuest.guest.name });
          } catch (error) {
            console.error(`Error processing check-in for ${bulkGuest.guest.name}:`, error);
            results.push({ success: false, guestName: bulkGuest.guest.name, error });
          }
        }

        // Track event
        trackEvent('reservation_created' as any, {
          bulkCheckIn: true,
          totalGuests: bulkGuests.length,
          successfulCheckIns: results.filter(r => r.success).length
        });

        // Call completion callback
        if (onCheckInComplete) {
          onCheckInComplete(`bulk-${results.filter(r => r.success).length}-guests`);
        }

        // Reset bulk form
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
          arrival: new Date().toISOString().split('T')[0],
          departure: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          adults: 1,
          children: 0,
          source: 'walkin',
          isGuaranteed: true,
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
        setSelectedBillingPerson(null);
      } else {
        // Single check-in (existing logic)
      // Create or update guest profile
      let guestId: string = selectedGuest?.id || '';
      if (!guestId) {
        const newGuest: Omit<GuestProfile, 'id'> = {
          name: formData.guestName,
          firstName: formData.guestName.split(' ')[0] || formData.guestName,
          lastName: formData.guestName.split(' ').slice(1).join(' ') || '',
          serialNumber: '',
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
          creditBalance: 0,
          preferences: {},
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        guestId = (frontOfficeStore.createGuest(newGuest) as any).id;
      }

      // Create reservation
      const totals = getComputedTotals(formData.arrival, formData.departure, formData.roomTypeId);
      const reservation: Omit<Reservation, 'id'> = {
        guestId,
        guestName: formData.guestName,
        guestPhone: formData.phone,
        guestEmail: formData.email,
        roomTypeId: formData.roomTypeId,
        ratePlanId: formData.ratePlanId,
        arrival: formData.arrival,
        departure: formData.departure,
        adults: formData.adults,
        children: formData.children,
        source: formData.source || 'walkin',
        status: 'confirmed',
        isGuaranteed: formData.isGuaranteed,
        remarksToGuest: formData.remarksToGuest,
        internalNotes: formData.internalNotes,
        marketCodes: formData.marketCodes,
        stayReason: formData.stayReason,
        stayReasonDetails: formData.stayReasonDetails,
        billingPersonId: formData.billingPersonId,
        companyName: formData.companyName,
        projectCode: formData.projectCode,
        costCenter: formData.costCenter,
        rateBreakdown: [{
          date: formData.arrival,
          base: totals.nightly,
          total: totals.nightly
        }],
        // totalAmount: totals.grandTotal,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const reservationId = (frontOfficeStore.createReservation(reservation) as any).id;

      // Assign room (specific or auto)
      if (selectedRoom && selectedRoom.roomTypeId === formData.roomTypeId) {
        frontOfficeStore.assignRoom(reservationId, selectedRoom.id);
      } else {
        // Auto-assign room
        const availableRooms = frontOfficeStore.rooms.filter(room => 
          !(room as any).isOutOfService && 
          room.roomTypeId === formData.roomTypeId
        );
        
        if (availableRooms.length > 0) {
          const assignedRoom = availableRooms[0];
          frontOfficeStore.assignRoom(reservationId, assignedRoom.id);
        }
      }

      // Auto check-in
      frontOfficeStore.updateReservationStatus(reservationId, 'checked-in');

      // Track event
      trackEvent('reservation_created' as any, {
        reservationId,
        guestName: formData.guestName,
        roomType: getSelectedRoomType(formData.roomTypeId)?.name,
        totalAmount: totals.grandTotal
      });

      // Call completion callback
      if (onCheckInComplete) {
        onCheckInComplete(reservationId);
      }

      // Reset form
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
        arrival: new Date().toISOString().split('T')[0],
        departure: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        adults: 1,
        children: 0,
        source: 'walkin',
        isGuaranteed: true,
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
      setSelectedGuest(null);
        setSelectedBillingPerson(null);
      }
    } catch (error) {
      console.error('Error creating check-in:', error);
      alert('Error creating check-in. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    onModalClose();
    if (onClose) {
      onClose();
    }
  };

  const totals = getComputedTotals(formData.arrival, formData.departure, formData.roomTypeId);

  return (
    <>
    <Modal isOpen={isOpen} onClose={handleClose} size="5xl" scrollBehavior="inside">
      <ModalContent>
        <ModalHeader>
          <div className="flex items-center justify-between w-full">
            <h3 className="text-xl font-semibold">⚡ Quick Check-In</h3>
            <Badge color="success" variant="flat">Auto-Process</Badge>
          </div>
        </ModalHeader>
        <ModalBody>
          <Tabs selectedKey={tabKey} onSelectionChange={(key) => setTabKey(key as string)}>
            <Tab key="summary" title="📋 Summary & Print">
              <div className="space-y-6">
                {/* Summary Card */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between w-full">
                      <h4 className="text-lg font-semibold">Check-In Summary</h4>
                      <div className="flex gap-2">
                        <Button size="sm" variant="flat" color="primary">
                          📄 Print Proforma
                        </Button>
                        <Button size="sm" variant="flat" color="secondary">
                          📧 Send Proforma
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardBody>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <div>
                          <label className="text-sm font-medium text-gray-700">Guest Information</label>
                          <div className="mt-1 space-y-1">
                            <p className="text-lg font-semibold">{formData.guestName || 'Not specified'}</p>
                            {formData.phone && <p className="text-sm text-gray-600">📞 {formData.phone}</p>}
                            {formData.email && <p className="text-sm text-gray-600">✉️ {formData.email}</p>}
                          </div>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-700">Stay Details</label>
                          <div className="mt-1 space-y-1">
                            <p className="text-sm">🏨 {getSelectedRoomType(formData.roomTypeId)?.name || 'Not selected'}</p>
                            <p className="text-sm">📅 {new Date(formData.arrival).toLocaleDateString()} - {new Date(formData.departure).toLocaleDateString()}</p>
                            <p className="text-sm">🌙 {totals.nights} night{totals.nights !== 1 ? 's' : ''}</p>
                            <p className="text-sm">👥 {formData.adults} adult{formData.adults !== 1 ? 's' : ''}, {formData.children} child{formData.children !== 1 ? 'ren' : ''}</p>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-4">
                        <div>
                          <label className="text-sm font-medium text-gray-700">Pricing Breakdown</label>
                          <div className="mt-1 space-y-1 text-sm">
                            <div className="flex justify-between">
                              <span>Room Rate ({totals.nights} nights)</span>
                              <span>₵{totals.subtotal.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Tax ({(totals.taxRate * 100).toFixed(1)}%)</span>
                              <span>₵{totals.tax.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between font-semibold text-lg border-t pt-2">
                              <span>Total Amount</span>
                              <span className="text-green-600">₵{totals.grandTotal.toLocaleString()}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardBody>
                </Card>
              </div>
            </Tab>

            <Tab key="guest" title="👤 Guest & Reservation Details">
              <div className="space-y-4 pt-4">
                {/* Guest Selection - Must be done first */}
                <div className="bg-purple-50 p-4 rounded-lg border">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-medium text-purple-900">
                      👥 Guest Selection {isBulkCheckIn ? `(${bulkGuests.length} guest${bulkGuests.length !== 1 ? 's' : ''})` : ''}
                    </h4>
                    <div className="flex items-center space-x-3">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-gray-600">Single</span>
                        <input
                          type="checkbox"
                          id="bulkMode"
                          checked={isBulkCheckIn}
                          onChange={(e) => {
                            setIsBulkCheckIn(e.target.checked);
                            if (!e.target.checked) {
                              setBulkGuests([]);
                              setSelectedGuest(null);
                            }
                          }}
                          className="rounded"
                        />
                        <span className="text-sm text-gray-600">Multiple</span>
                      </div>
                      <div className="text-sm text-purple-700">
                        {isBulkCheckIn 
                          ? "Search and add multiple guests from the system"
                          : "Search and select guest from the system"
                        }
                      </div>
                    </div>
                  </div>
                  
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
                              onClick={() => handleGuestSelect(guest)}
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
                                    if (isBulkCheckIn) {
                                      addGuestToBulk(guest);
                                    } else {
                                      handleGuestSelect(guest);
                                    }
                                  }}
                                >
                                  {isBulkCheckIn ? '➕ Add' : '➕ Select'}
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
                  
                  {/* Single Guest Selection */}
                  {!isBulkCheckIn && selectedGuest && (
                    <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium text-green-900">✅ Guest Selected</div>
                          <div className="text-sm text-green-700">
                            {(selectedGuest as any).name || `${(selectedGuest as any).firstName || ''} ${(selectedGuest as any).lastName || ''}`.trim()}
                          </div>
                          <div className="text-xs text-green-600">
                            {(selectedGuest as any).phone && `📱 ${(selectedGuest as any).phone}`}
                            {(selectedGuest as any).email && ` 📧 ${(selectedGuest as any).email}`}
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
                              gender: 'prefer_not_to_say'
                            }));
                          }}
                        >
                          Change
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Bulk Guests List */}
                  {isBulkCheckIn && bulkGuests.length > 0 && (
                    <div className="mt-4 space-y-3">
                      {bulkGuests.map((bulkGuest, index) => {
                        const roomType = useSettingsStore.getState().roomManagement.roomTypes.find(rt => rt.id === bulkGuest.roomTypeId);
                        const ratePlan = useSettingsStore.getState().roomManagement.ratePlans.find(rp => rp.id === bulkGuest.ratePlanId);
                        const baseRate = roomType?.baseRate || 0;
                        const finalRate = ratePlan ? baseRate * (ratePlan as any).multiplier : baseRate;
                        
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
                                onSelectionChange={(keys) => updateBulkGuest(bulkGuest.id, 'roomTypeId', Array.from(keys as Set<string>)[0] || '')}
                                size="sm"
                              >
                                {useSettingsStore.getState().roomManagement.roomTypes.map(rt => (
                                  <SelectItem key={rt.id}>{rt.name} - ₵{rt.baseRate}</SelectItem>
                                ))}
                              </Select>
                              <Select
                                label="Rate Plan"
                                selectedKeys={bulkGuest.ratePlanId ? new Set([bulkGuest.ratePlanId]) : new Set()}
                                onSelectionChange={(keys) => updateBulkGuest(bulkGuest.id, 'ratePlanId', Array.from(keys as Set<string>)[0] || '')}
                                size="sm"
                              >
                                <>
                                  {(useSettingsStore.getState()?.roomManagement?.ratePlans || []).map((rp: any) => (
                                    <SelectItem key={rp.id}>{rp.name || rp.code || rp.id} ({rp.multiplier}x)</SelectItem>
                                  ))}
                                </>
                              </Select>
                              <Textarea
                                label="Special Requests"
                                value={bulkGuest.specialRequests || ''}
                                onChange={(e) => updateBulkGuest(bulkGuest.id, 'specialRequests', e.target.value)}
                                placeholder="Any special requests for this guest"
                                size="sm"
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Check-in Details - Only for single guest mode */}
                {!isBulkCheckIn && selectedGuest && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Select
                        label="Room Type *"
                        selectedKeys={formData.roomTypeId ? new Set([formData.roomTypeId]) : new Set()}
                        onSelectionChange={(keys) => setFormData(prev => ({ ...prev, roomTypeId: Array.from(keys as Set<string>)[0] || '' }))}
                        isRequired
                        isDisabled={isFormDisabled}
                      >
                        {useSettingsStore.getState().roomManagement.roomTypes.map(rt => (
                          <SelectItem key={rt.id}>{rt.name} - ₵{rt.baseRate}</SelectItem>
                        ))}
                      </Select>
                      <Select
                        label="Rate Plan (optional)"
                        selectedKeys={formData.ratePlanId ? new Set([formData.ratePlanId]) : new Set()}
                        onSelectionChange={(keys) => setFormData(prev => ({ ...prev, ratePlanId: Array.from(keys as Set<string>)[0] || '' }))}
                        isDisabled={isFormDisabled}
                      >
                        {(useSettingsStore.getState()?.roomManagement?.ratePlans || []).map((rp: any) => (
                          <SelectItem key={rp.id}>{rp.name || rp.code || rp.id} ({rp.multiplier}x)</SelectItem>
                        ))}
                      </Select>
                      <Input
                        label="Check-in Date"
                        type="date"
                        value={formData.arrival}
                        onChange={(e) => setFormData(prev => ({ ...prev, arrival: e.target.value }))}
                        isDisabled={isFormDisabled}
                      />
                      <Input
                        label="Check-out Date"
                        type="date"
                        value={formData.departure}
                        onChange={(e) => setFormData(prev => ({ ...prev, departure: e.target.value }))}
                        isDisabled={isFormDisabled}
                      />
                      <Input
                        label="Adults"
                        type="number"
                        value={String(formData.adults)}
                        onChange={(e) => setFormData(prev => ({ ...prev, adults: parseInt(e.target.value) || 1 }))}
                        isDisabled={isFormDisabled}
                      />
                      <Input
                        label="Children"
                        type="number"
                        value={String(formData.children)}
                        onChange={(e) => setFormData(prev => ({ ...prev, children: parseInt(e.target.value) || 0 }))}
                        isDisabled={isFormDisabled}
                      />
                    </div>
                    
                    {/* Room Assignment */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Select
                        label="Room Assignment (optional)"
                        placeholder="Search and select a specific room"
                        selectedKeys={selectedRoom ? new Set([selectedRoom.id]) : new Set()}
                        onSelectionChange={(keys) => {
                          const roomId = Array.from(keys as Set<string>)[0] || '';
                          if (roomId) {
                            const room = frontOfficeStore.rooms.find(r => r.id === roomId);
                            if (room) {
                              setSelectedRoom(room);
                            }
                          } else {
                            setSelectedRoom(null);
                          }
                        }}
                        isDisabled={isFormDisabled}
                        startContent={<span className="text-gray-400">🏨</span>}
                        classNames={{
                          trigger: "min-h-unit-12",
                          listbox: "max-h-60"
                        }}
                        listboxProps={{
                          emptyContent: "No rooms found"
                        }}
                      >
                        {frontOfficeStore.rooms
                          .filter(room => 
                            !(room as any).isOutOfService && 
                            (!formData.roomTypeId || room.roomTypeId === formData.roomTypeId)
                          )
                          .map(room => (
                            <SelectItem key={room.id} textValue={`Room ${room.id} - ${useSettingsStore.getState().roomManagement.roomTypes.find(rt => rt.id === room.roomTypeId)?.name || 'Unknown Type'}`}>
                              <div className="flex flex-col">
                                <span className="font-medium">Room {room.id}</span>
                                <span className="text-sm text-gray-500">
                                  {useSettingsStore.getState().roomManagement.roomTypes.find(rt => rt.id === room.roomTypeId)?.name || 'Unknown Type'}
                                </span>
                              </div>
                            </SelectItem>
                          ))}
                      </Select>
                      <div className="flex items-center space-x-2 pt-6">
                        <input
                          type="checkbox"
                          id="autoAssignRoom"
                          checked={!selectedRoom}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedRoom(null);
                            }
                          }}
                          className="rounded"
                        />
                        <label htmlFor="autoAssignRoom" className="text-sm font-medium text-gray-700">
                          Auto-assign available room
                        </label>
                      </div>
                    </div>
                    
                    {/* Pricing Summary */}
                    <div className="mt-4 grid grid-cols-1 md:grid-cols-5 gap-3">
                      {(() => { const { nights, nightly, subtotal, taxRate, tax, grandTotal } = getComputedTotals(formData.arrival, formData.departure, formData.roomTypeId || ''); return (
                        <>
                          <Card><CardBody><div className="text-xs text-gray-600">Nightly</div><div className="text-lg font-semibold">₵{nightly.toLocaleString()}</div></CardBody></Card>
                          <Card><CardBody><div className="text-xs text-gray-600">Nights</div><div className="text-lg font-semibold">{nights}</div></CardBody></Card>
                          <Card><CardBody><div className="text-xs text-gray-600">Subtotal</div><div className="text-lg font-semibold">₵{subtotal.toLocaleString()}</div></CardBody></Card>
                          <Card><CardBody><div className="text-xs text-gray-600">Taxes ({Math.round(taxRate*100)}%)</div><div className="text-lg font-semibold">₵{tax.toLocaleString()}</div></CardBody></Card>
                          <Card><CardBody><div className="text-xs text-gray-600">Grand Total</div><div className="text-lg font-semibold">₵{grandTotal.toLocaleString()}</div></CardBody></Card>
                        </>
                      ); })()}
                    </div>
                  </div>
                )}

                {isFormDisabled && (
                  <div className="text-center py-8 text-gray-500">
                    <div className="text-4xl mb-4">👤</div>
                    <div className="text-lg font-medium">
                      {isBulkCheckIn ? 'Please add guests to check-in' : 'Please select a guest first'}
                    </div>
                    <div className="text-sm">
                      {isBulkCheckIn 
                        ? 'Search and add guests above to proceed with bulk check-in'
                        : 'Search and select a guest above to proceed with check-in'
                      }
                    </div>
                  </div>
                )}

                {/* Purpose and Billing - Only show after guest selection */}
                {!isFormDisabled && (
                  <div className="space-y-4">
                    {/* Stay Purpose */}
                    <div className="bg-yellow-50 p-4 rounded-lg border">
                      <h4 className="font-medium text-yellow-900 mb-3">🎯 Stay Purpose</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Select
                          label="Stay Reason"
                          value={formData.stayReason}
                          onChange={(e) => setFormData(prev => ({ ...prev, stayReason: e.target.value as StayReason }))}
                          isDisabled={isFormDisabled}
                        >
                          <SelectItem key="personal">Personal</SelectItem>
                          <SelectItem key="business">Business</SelectItem>
                          <SelectItem key="leisure">Leisure</SelectItem>
                          <SelectItem key="medical">Medical</SelectItem>
                          <SelectItem key="education">Education</SelectItem>
                          <SelectItem key="other">Other</SelectItem>
                        </Select>
                        <Input
                          label="Company Name"
                          value={formData.companyName}
                          onChange={(e) => setFormData(prev => ({ ...prev, companyName: e.target.value }))}
                          isDisabled={isFormDisabled}
                        />
                      </div>
                      <Textarea
                        label="Stay Reason Details"
                        value={formData.stayReasonDetails}
                        onChange={(e) => setFormData(prev => ({ ...prev, stayReasonDetails: e.target.value }))}
                        placeholder="Additional details about the purpose of stay"
                        isDisabled={isFormDisabled}
                        className="mt-3"
                      />
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
                            disabled={isFormDisabled}
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
                                  isDisabled={isFormDisabled}
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
                                    </div>
                                  ) : filteredBillingPersons.length > 0 ? (
                                    filteredBillingPersons.map((guest) => (
                                      <div
                                        key={guest.id}
                                        className="p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100"
                                        onClick={() => handleBillingPersonSelect(guest)}
                                      >
                                        <div className="font-medium">{guest.name || `${guest.firstName || ''} ${guest.lastName || ''}`.trim()}</div>
                                        <div className="text-sm text-gray-600">
                                          {(guest as any).employerCompany || (guest as any).companyName} • {guest.phone} • {guest.email}
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
                              <div className="flex items-center justify-between">
                                <div>
                                  <div className="font-medium text-green-900">✅ Billing Person Selected</div>
                                  <div className="text-sm text-green-700">
                                    {selectedBillingPerson.name} • {(selectedBillingPerson as any).employerCompany || (selectedBillingPerson as any).companyName}
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
                        isDisabled={isFormDisabled}
                      >
                        <SelectItem key="walkin">🚶 Walk-in</SelectItem>
                        <SelectItem key="phone">📞 Phone</SelectItem>
                        <SelectItem key="online">🌐 Online</SelectItem>
                        <SelectItem key="agent">✈️ Travel Agent</SelectItem>
                        <SelectItem key="corporate">🏢 Corporate</SelectItem>
                      </Select>
                    </div>
                  </div>
                )}
              </div>
            </Tab>

            <Tab key="additional" title="ℹ️ Additional Information">
              <div className="space-y-6">
                {/* Notes */}
                <Card>
                  <CardHeader>
                    <h4 className="text-lg font-semibold">Notes & Remarks</h4>
                  </CardHeader>
                  <CardBody className="space-y-4">
                    <Textarea
                      label="Internal Notes"
                      value={formData.internalNotes}
                      onChange={(e) => setFormData(prev => ({ ...prev, internalNotes: e.target.value }))}
                      placeholder="Internal notes for staff"
                      isDisabled={isFormDisabled}
                    />
                    <Textarea
                      label="Remarks to Guest"
                      value={formData.remarksToGuest}
                      onChange={(e) => setFormData(prev => ({ ...prev, remarksToGuest: e.target.value }))}
                      placeholder="Special remarks or instructions for the guest"
                      isDisabled={isFormDisabled}
                    />
                  </CardBody>
                </Card>

                {/* Project Details */}
                <Card>
                  <CardHeader>
                    <h4 className="text-lg font-semibold">Project Details (Optional)</h4>
                  </CardHeader>
                  <CardBody className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Input
                        label="Project Code"
                        value={formData.projectCode}
                        onChange={(e) => setFormData(prev => ({ ...prev, projectCode: e.target.value }))}
                        isDisabled={isFormDisabled}
                      />
                      <Input
                        label="Cost Center"
                        value={formData.costCenter}
                        onChange={(e) => setFormData(prev => ({ ...prev, costCenter: e.target.value }))}
                        isDisabled={isFormDisabled}
                      />
                    </div>
                  </CardBody>
                </Card>
              </div>
            </Tab>
          </Tabs>
        </ModalBody>
        <ModalFooter>
          <Button variant="flat" onClick={handleClose}>
            Cancel
          </Button>
          <Button 
            color="secondary" 
            onClick={prepareFolioData}
            isDisabled={isFormDisabled}
            startContent={<span>📄</span>}
          >
            View Folio
          </Button>
          <Button 
            color="primary" 
            onClick={handleSubmit}
            isLoading={isSubmitting}
            isDisabled={isFormDisabled}
          >
            {isSubmitting 
              ? 'Processing...' 
              : isBulkCheckIn 
                ? `Check-In ${bulkGuests.length} Guest${bulkGuests.length !== 1 ? 's' : ''}`
                : 'Complete Check-In'
            }
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>

    {/* Folio Preview Modal */}
    <Modal isOpen={isFolioModalOpen} onClose={onFolioModalClose} size="4xl" scrollBehavior="inside">
      <ModalContent>
        <ModalHeader>
          <div className="flex items-center justify-between w-full">
            <h3 className="text-xl font-semibold">📄 Folio Preview</h3>
            <Badge color="primary" variant="flat">
              {folioData?.type === 'bulk' ? `${folioData.guests.length} Guest${folioData.guests.length !== 1 ? 's' : ''}` : 'Single Guest'}
            </Badge>
          </div>
        </ModalHeader>
        <ModalBody>
          {folioData && (
            <div className="space-y-6">
              {/* Guest Information */}
              <Card>
                <CardHeader>
                  <h4 className="text-lg font-semibold">Guest Information</h4>
                </CardHeader>
                <CardBody>
                  {folioData.type === 'bulk' ? (
                    <div className="space-y-3">
                      {folioData.guests.map((guest: any, index: number) => (
                        <div key={index} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                          <div>
                            <div className="font-medium">{guest.guestName}</div>
                            <div className="text-sm text-gray-600">
                              {guest.roomType} • {guest.nights} night{guest.nights !== 1 ? 's' : ''}
                            </div>
                            <div className="text-sm text-gray-500">
                              {new Date(guest.arrival).toLocaleDateString()} - {new Date(guest.departure).toLocaleDateString()}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-semibold">₵{(guest.grandTotal || 0).toLocaleString()}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <div className="text-sm text-gray-600">Guest Name</div>
                        <div className="font-medium">{folioData.guestName}</div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-600">Room Type</div>
                        <div className="font-medium">{folioData.roomType}</div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-600">Arrival</div>
                        <div className="font-medium">{new Date(folioData.arrival).toLocaleDateString()}</div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-600">Departure</div>
                        <div className="font-medium">{new Date(folioData.departure).toLocaleDateString()}</div>
                      </div>
                    </div>
                  )}
                </CardBody>
              </Card>

              {/* Charges Breakdown */}
              <Card>
                <CardHeader>
                  <h4 className="text-lg font-semibold">Charges Breakdown</h4>
                </CardHeader>
                <CardBody>
                  {folioData.type === 'bulk' ? (
                    <div className="space-y-3">
                      {folioData.guests.map((guest: any, index: number) => (
                        <div key={index} className="border rounded-lg p-4">
                          <div className="font-medium mb-2">{guest.guestName}</div>
                          <div className="space-y-2">
                            <div className="flex justify-between">
                              <span>Room Rate ({guest.nights} night{guest.nights !== 1 ? 's' : ''})</span>
                              <span>₵{(guest.subtotal || 0).toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Taxes</span>
                              <span>₵{(guest.tax || 0).toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between font-semibold border-t pt-2">
                              <span>Total</span>
                              <span>₵{(guest.grandTotal || 0).toLocaleString()}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                      <div className="flex justify-between font-bold text-lg border-t pt-4">
                        <span>Grand Total</span>
                        <span>₵{(folioData.totalAmount || 0).toLocaleString()}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span>Room Rate ({folioData.nights} night{folioData.nights !== 1 ? 's' : ''})</span>
                        <span>₵{(folioData.subtotal || 0).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Taxes</span>
                        <span>₵{(folioData.tax || 0).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between font-semibold text-lg border-t pt-2">
                        <span>Total Amount</span>
                        <span>₵{(folioData.grandTotal || 0).toLocaleString()}</span>
                      </div>
                    </div>
                  )}
                </CardBody>
              </Card>

              {/* Optional Upfront Payment */}
              <Card>
                <CardHeader>
                  <h4 className="text-lg font-semibold">Optional Upfront Payment</h4>
                </CardHeader>
                <CardBody>
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Input
                        label="Payment Amount"
                        type="number"
                        value={upfrontPayment.toString()}
                        onChange={(e) => setUpfrontPayment(Number(e.target.value))}
                        placeholder="0"
                        startContent={<span className="text-gray-400">₵</span>}
                      />
                      <Select
                        label="Payment Method"
                        selectedKeys={new Set([paymentMethod])}
                        onSelectionChange={(keys) => setPaymentMethod(Array.from(keys as Set<string>)[0] || 'cash')}
                      >
                        <SelectItem key="cash">Cash</SelectItem>
                        <SelectItem key="card">Credit/Debit Card</SelectItem>
                        <SelectItem key="bank_transfer">Bank Transfer</SelectItem>
                        <SelectItem key="mobile_money">Mobile Money</SelectItem>
                      </Select>
                    </div>
                    {upfrontPayment > 0 && (
                      <div className="p-3 bg-blue-50 rounded-lg">
                        <div className="text-sm text-blue-600">
                          Remaining Balance: ₵{((folioData.type === 'bulk' ? folioData.totalAmount : folioData.grandTotal) || 0) - upfrontPayment}
                        </div>
                      </div>
                    )}
                  </div>
                </CardBody>
              </Card>
            </div>
          )}
        </ModalBody>
        <ModalFooter>
          <Button variant="flat" onClick={onFolioModalClose}>
            Close
          </Button>
          <Button 
            color="primary" 
            onClick={() => {
              onFolioModalClose();
              handleSubmit();
            }}
            startContent={<span>✅</span>}
          >
            Proceed with Check-In
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
    </>
  );
}