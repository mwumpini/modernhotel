'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  Card, 
  CardBody, 
  CardHeader, 
  Button, 
  Badge, 
  Tabs, 
  Tab, 
  Chip,
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
  Textarea,
  Switch,
  Divider,
  Accordion,
  AccordionItem,
  Checkbox,
  RadioGroup,
  Radio,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  Tooltip,
  Popover,
  PopoverTrigger,
  PopoverContent
} from "@heroui/react";
import { trackEvent } from '../lib/analytics/trackEvent';
import { useRouter } from 'next/navigation';

// Info Icon Component with Tooltip
const InfoIcon = ({ description }: { description: string }) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      setShowTooltip(true);
    }, 2000); // 2 second delay
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setShowTooltip(false);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <Tooltip
      content={description}
      isOpen={showTooltip}
      onOpenChange={setShowTooltip}
      placement="top"
      showArrow
      color="primary"
      delay={0}
    >
      <div
        className="inline-flex items-center justify-center w-4 h-4 mr-2 text-xs text-blue-500 bg-blue-100 rounded-full cursor-help hover:bg-blue-200 transition-colors"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        title={description}
      >
        ℹ
      </div>
    </Tooltip>
  );
};

export default function EventsConferencesMainDashboard() {
  const router = useRouter();
  const [selectedTab, setSelectedTab] = useState('overview');
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [isVenueModalOpen, setIsVenueModalOpen] = useState(false);
  const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
  const [isQuoteModalOpen, setIsQuoteModalOpen] = useState(false);
  const [isPackageModalOpen, setIsPackageModalOpen] = useState(false);
  const [isTaxModalOpen, setIsTaxModalOpen] = useState(false);
  const [isBEOModalOpen, setIsBEOModalOpen] = useState(false);
  const [isFunctionSheetModalOpen, setIsFunctionSheetModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<any>(null);
  const [editingVenue, setEditingVenue] = useState<any>(null);
  const [editingService, setEditingService] = useState<any>(null);
  const [editingQuote, setEditingQuote] = useState<any>(null);
  const [editingPackage, setEditingPackage] = useState<any>(null);
  const [editingTax, setEditingTax] = useState<any>(null);
  const [selectedEventForBEO, setSelectedEventForBEO] = useState<any>(null);
  const [selectedEventForFunctionSheet, setSelectedEventForFunctionSheet] = useState<any>(null);
  const [eventViewMode, setEventViewMode] = useState('table');
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState({ startDate: '', endDate: '' });
  const [programmeTypeFilter, setProgrammeTypeFilter] = useState('all');
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [isClientViewModalOpen, setIsClientViewModalOpen] = useState(false);
  const [isContractModalOpen, setIsContractModalOpen] = useState(false);
  const [isClientEditModalOpen, setIsClientEditModalOpen] = useState(false);
  

  // Sample events data - in real app, this would come from stores
  const totalEvents = 24;
  const activeEvents = 8;
  const completedEvents = 12;
  const cancelledEvents = 4;
  
  // Venue metrics
  const totalVenues = 6;
  const availableVenues = 3;
  const bookedVenues = 2;
  const maintenanceVenues = 1;
  
  // Revenue metrics
  
  // Today's operations
  const eventsToday = 3;
  const newBookings = 2;
  const eventsCompleted = 1;
  const setupInProgress = 2;

  // Sample data for tables
  const events = [
    {
      id: 'evt-001',
      name: 'Ghana Tech Conference 2024',
      venue: 'Accra Conference Hall',
      date: '2024-03-15',
      time: '09:00 AM',
      attendees: 200,
      status: 'confirmed',
      type: 'conference',
      revenue: 15000,
      organizer: 'Tech Ghana Ltd'
    },
    {
      id: 'evt-002',
      name: 'Wedding Reception - Sarah & John',
      venue: 'Ghana Banquet Hall',
      date: '2024-03-20',
      time: '06:00 PM',
      attendees: 150,
      status: 'confirmed',
      type: 'wedding',
      revenue: 8000,
      organizer: 'Sarah Johnson'
    },
    {
      id: 'evt-003',
      name: 'Corporate Training Session',
      venue: 'Kumasi Meeting Room',
      date: '2024-03-18',
      time: '10:00 AM',
      attendees: 25,
      status: 'confirmed',
      type: 'training',
      revenue: 3000,
      organizer: 'Corporate Solutions Inc'
    },
    {
      id: 'evt-004',
      name: 'Product Launch Event',
      venue: 'Accra Auditorium',
      date: '2024-03-25',
      time: '07:00 PM',
      attendees: 300,
      status: 'pending',
      type: 'launch',
      revenue: 20000,
      organizer: 'Innovation Corp'
    }
  ];

  // Sample client data for contract management
  const sampleClients = [
    {
      id: 'client-001',
      name: 'Kwame Asante',
      position: 'Events Manager',
      organization: 'Ghana Tech Solutions',
      industry: 'Technology',
      contact: '+233 24 123 4567',
      email: 'kwame.asante@ghanatech.com',
      whatsapp: true,
      contractStatus: 'active',
      rates: {
        accommodation: 450,
        conference: 250,
        catering: 180
      },
      contractStart: '2024-01-01',
      contractEnd: '2024-12-31',
      specialTerms: 'Corporate discount applied, 15% off accommodation for groups of 20+'
    },
    {
      id: 'client-002',
      name: 'Ama Osei',
      position: 'Marketing Director',
      organization: 'Accra Business Network',
      industry: 'Business Services',
      contact: '+233 26 987 6543',
      email: 'ama.osei@accrabusiness.com',
      whatsapp: true,
      contractStatus: 'active',
      rates: {
        accommodation: 380,
        conference: 200,
        catering: 150
      },
      contractStart: '2024-02-01',
      contractEnd: '2024-12-31',
      specialTerms: 'Monthly retainer for regular events, priority booking'
    },
    {
      id: 'client-003',
      name: 'Kofi Mensah',
      position: 'CEO',
      organization: 'Kumasi Ventures',
      industry: 'Manufacturing',
      contact: '+233 20 555 1234',
      email: 'kofi.mensah@kumasiventures.com',
      whatsapp: false,
      contractStatus: 'pending',
      rates: {
        accommodation: 500,
        conference: 300,
        catering: 220
      },
      contractStart: '2024-03-01',
      contractEnd: '2024-12-31',
      specialTerms: 'Premium package, dedicated event coordinator'
    },
    {
      id: 'client-004',
      name: 'Efua Addo',
      position: 'HR Manager',
      organization: 'Ghana Education Trust',
      industry: 'Education',
      contact: '+233 27 777 8888',
      email: 'efua.addo@ghanatrust.edu.gh',
      whatsapp: true,
      contractStatus: 'expired',
      rates: {
        accommodation: 320,
        conference: 180,
        catering: 120
      },
      contractStart: '2023-01-01',
      contractEnd: '2023-12-31',
      specialTerms: 'Educational institution discount, flexible payment terms'
    }
  ];

  // Comprehensive Quoting System Data Structures
  
  // Tax Structure for Ghana
  const ghanaTaxes = [
    { id: 'nhil', name: 'NHIL', rate: 2.5, authority: 'National Health Insurance', appliesTo: ['all'] },
    { id: 'getfund', name: 'GETFund Levy', rate: 2.5, authority: 'Ghana Education Trust Fund', appliesTo: ['all'] },
    { id: 'covid', name: 'COVID-19 Levy', rate: 1.0, authority: 'Government of Ghana', appliesTo: ['all'] },
    { id: 'vat', name: 'VAT', rate: 15.0, authority: 'Ghana Revenue Authority', appliesTo: ['all'] },
    { id: 'gta', name: 'GTA Levy', rate: 1.0, authority: 'Ghana Tourism Authority', appliesTo: ['accommodation', 'venue', 'tourism'] }
  ];

  // Tax Groups for easy application
  const taxGroups = [
    {
      id: 'ghana-standard',
      name: 'Ghana Standard',
      description: 'Full Ghana tax suite: NHIL + GETFund + COVID + VAT + GTA',
      taxes: ['nhil', 'getfund', 'covid', 'vat', 'gta'],
      totalRate: 22.0
    },
    {
      id: 'ghana-basic',
      name: 'Ghana Basic',
      description: 'Basic taxes: NHIL + GETFund + COVID + VAT',
      taxes: ['nhil', 'getfund', 'covid', 'vat'],
      totalRate: 21.0
    },
    {
      id: 'vat-only',
      name: 'VAT Only',
      description: 'VAT only (15%)',
      taxes: ['vat'],
      totalRate: 15.0
    }
  ];

  // Service Packages
  const servicePackages = [
    {
      id: 'gold-conference',
      name: 'Gold Conference Package',
      description: 'Complete conference package with all amenities',
      basePrice: 350,
      currency: 'GH₵',
      perPerson: true,
      perDay: true,
      includes: [
        'Conference venue rental',
        '2 Tea breaks (coffee, tea, pastries)',
        'Buffet lunch',
        'Basic stationery (notepad, pen)',
        'Projector & screen',
        'Sound system',
        'WiFi access'
      ],
      taxGroup: 'ghana-standard',
      minNotice: '48 hours',
      maxCapacity: 200
    },
    {
      id: 'silver-conference',
      name: 'Silver Conference Package',
      description: 'Standard conference package',
      basePrice: 250,
      currency: 'GH₵',
      perPerson: true,
      perDay: true,
      includes: [
        'Conference venue rental',
        '1 Tea break (coffee, tea)',
        'Basic stationery (notepad, pen)',
        'Projector & screen',
        'WiFi access'
      ],
      taxGroup: 'ghana-standard',
      minNotice: '24 hours',
      maxCapacity: 100
    },
    {
      id: 'wedding-package',
      name: 'Wedding Package',
      description: 'Complete wedding reception package',
      basePrice: 500,
      currency: 'GH₵',
      perPerson: true,
      perDay: false,
      includes: [
        'Banquet hall rental',
        'Full catering service',
        'Table decorations',
        'Basic sound system',
        'Parking for guests',
        'Setup and cleanup'
      ],
      taxGroup: 'ghana-standard',
      minNotice: '72 hours',
      maxCapacity: 300
    }
  ];

  // Individual Services (à la carte)
  const individualServices = [
    {
      id: 'accommodation-standard',
      name: 'Standard Room',
      category: 'accommodation',
      basePrice: 450,
      currency: 'GH₵',
      perPerson: false,
      perDay: true,
      taxGroup: 'ghana-standard',
      description: 'Standard hotel room with breakfast'
    },
    {
      id: 'accommodation-deluxe',
      name: 'Deluxe Room',
      category: 'accommodation',
      basePrice: 650,
      currency: 'GH₵',
      perPerson: false,
      perDay: true,
      taxGroup: 'ghana-standard',
      description: 'Deluxe hotel room with breakfast'
    },
    {
      id: 'breakfast',
      name: 'Breakfast',
      category: 'food',
      basePrice: 60,
      currency: 'GH₵',
      perPerson: true,
      perDay: true,
      taxGroup: 'ghana-basic',
      description: 'Continental breakfast buffet'
    },
    {
      id: 'lunch',
      name: 'Lunch',
      category: 'food',
      basePrice: 80,
      currency: 'GH₵',
      perPerson: true,
      perDay: true,
      taxGroup: 'ghana-basic',
      description: 'Buffet lunch with soft drinks'
    },
    {
      id: 'dinner',
      name: 'Dinner',
      category: 'food',
      basePrice: 100,
      currency: 'GH₵',
      perPerson: true,
      perDay: true,
      taxGroup: 'ghana-basic',
      description: 'Three-course dinner with soft drinks'
    },
    {
      id: 'tea-break',
      name: 'Tea Break',
      category: 'refreshments',
      basePrice: 25,
      currency: 'GH₵',
      perPerson: true,
      perDay: true,
      taxGroup: 'ghana-basic',
      description: 'Coffee, tea, and light refreshments'
    },
    {
      id: 'extra-projector',
      name: 'Extra Projector',
      category: 'equipment',
      basePrice: 200,
      currency: 'GH₵',
      perPerson: false,
      perDay: true,
      taxGroup: 'ghana-standard',
      description: 'Additional projector for large events'
    },
    {
      id: 'branded-stationery',
      name: 'Branded Stationery',
      category: 'supplies',
      basePrice: 15,
      currency: 'GH₵',
      perPerson: true,
      perDay: false,
      taxGroup: 'ghana-basic',
      description: 'Custom branded notepads and pens'
    }
  ];

  // Sample Quote Structure
  const sampleQuote = {
    id: 'quote-001',
    quoteNumber: 'Q-2024-001',
    clientName: 'Tech Ghana Ltd',
    clientEmail: 'events@techghana.com',
    clientPhone: '+233 20 123 4567',
    eventName: 'Ghana Tech Conference 2024',
    eventType: 'conference',
    startDate: '2024-03-15',
    endDate: '2024-03-17',
    totalDays: 3,
    validity: '30 days',
    status: 'pending',
    createdAt: '2024-02-15',
    createdBy: 'Sales Manager',
    
    // Tax Exemption Information
    taxExempt: false,
    taxExemptionType: null, // 'government', 'ngo', 'diplomatic', 'other'
    taxExemptionNumber: null,
    taxExemptionAuthority: null,
    taxExemptionExpiry: null,
    taxExemptionDocuments: [], // Array of uploaded document references
    taxExemptionNotes: null,
    
    // Event Timeline with Daily Services
    eventTimeline: [
      {
        date: '2024-03-15',
        dayNumber: 1,
        dayType: 'arrival',
        services: [
          {
            serviceId: 'accommodation-standard',
            serviceName: 'Standard Room',
            category: 'accommodation',
            quantity: 15,
            unitPrice: 450,
            totalPrice: 6750,
            taxGroup: 'ghana-standard',
            notes: 'Arrival day - early check-in available'
          },
          {
            serviceId: 'dinner',
            serviceName: 'Dinner',
            category: 'food',
            quantity: 15,
            unitPrice: 100,
            totalPrice: 1500,
            taxGroup: 'ghana-basic',
            notes: 'Welcome dinner for residential guests'
          }
        ]
      },
      {
        date: '2024-03-16',
        dayNumber: 2,
        dayType: 'conference',
        services: [
          {
            serviceId: 'accommodation-standard',
            serviceName: 'Standard Room',
            category: 'accommodation',
            quantity: 15,
            unitPrice: 450,
            totalPrice: 6750,
            taxGroup: 'ghana-standard',
            notes: 'Full day accommodation'
          },
          {
            serviceId: 'breakfast',
            serviceName: 'Breakfast',
            category: 'food',
            quantity: 15,
            unitPrice: 60,
            totalPrice: 900,
            taxGroup: 'ghana-basic',
            notes: 'Breakfast for residential guests'
          },
          {
            serviceId: 'gold-conference',
            serviceName: 'Gold Conference Package',
            category: 'package',
            quantity: 30,
            unitPrice: 350,
            totalPrice: 10500,
            taxGroup: 'ghana-standard',
            notes: 'Full conference package for all attendees'
          },
          {
            serviceId: 'dinner',
            serviceName: 'Dinner',
            category: 'food',
            quantity: 15,
            unitPrice: 100,
            totalPrice: 1500,
            taxGroup: 'ghana-basic',
            notes: 'Dinner for residential guests'
          }
        ]
      },
      {
        date: '2024-03-17',
        dayNumber: 3,
        dayType: 'departure',
        services: [
          {
            serviceId: 'accommodation-standard',
            serviceName: 'Standard Room',
            category: 'accommodation',
            quantity: 15,
            unitPrice: 450,
            totalPrice: 6750,
            taxGroup: 'ghana-standard',
            notes: 'Checkout by 12:00 PM'
          },
          {
            serviceId: 'breakfast',
            serviceName: 'Breakfast',
            category: 'food',
            quantity: 15,
            unitPrice: 60,
            totalPrice: 900,
            taxGroup: 'ghana-basic',
            notes: 'Breakfast before departure'
          },
          {
            serviceId: 'gold-conference',
            serviceName: 'Gold Conference Package',
            category: 'package',
            quantity: 30,
            unitPrice: 350,
            totalPrice: 10500,
            taxGroup: 'ghana-standard',
            notes: 'Half-day conference (morning only)'
          }
        ]
      }
    ],

    // Financial Summary
    subtotal: 0, // Will be calculated
    taxBreakdown: [], // Will be calculated
    totalTax: 0, // Will be calculated
    grandTotal: 0, // Will be calculated
    
    // Terms & Conditions
    depositRequired: 50,
    depositAmount: 0, // Will be calculated
    balanceAmount: 0, // Will be calculated
    paymentTerms: '50% deposit to confirm, balance 7 days before event',
    cancellationPolicy: 'Deposit non-refundable if cancelled within 14 days of event',
    guaranteePolicy: 'Final numbers guaranteed 48 hours before event',
    
    // Additional Notes
    specialRequirements: 'Vegetarian options required for 5 attendees, wheelchair accessible venue needed',
    setupTime: 'Setup begins 2 hours before event start time',
    contactPerson: 'John Doe - Event Coordinator (Phone: +233 20 123 4567)'
  };

  // Sample Tax-Exempt Quote
  const sampleTaxExemptQuote = {
    id: 'quote-002',
    quoteNumber: 'Q-2024-002',
    clientName: 'Ministry of Education Ghana',
    clientEmail: 'events@moe.gov.gh',
    clientPhone: '+233 30 123 4567',
    eventName: 'National Education Summit 2024',
    eventType: 'conference',
    startDate: '2024-04-10',
    endDate: '2024-04-12',
    totalDays: 3,
    validity: '30 days',
    status: 'pending',
    createdAt: '2024-02-20',
    createdBy: 'Sales Manager',
    
    // Tax Exemption Information
    taxExempt: true,
    taxExemptionType: 'government',
    taxExemptionNumber: 'GRA/EXEMPT/2024/001',
    taxExemptionAuthority: 'Ghana Revenue Authority',
    taxExemptionExpiry: '2024-12-31',
    taxExemptionDocuments: [
      'GRA_Tax_Exemption_Certificate_2024.pdf',
      'Ministry_Registration_Document.pdf'
    ],
    taxExemptionNotes: 'Government ministry - fully tax exempt under Section 15 of GRA Act',
    
    // Event Timeline with Daily Services (same structure but no taxes)
    eventTimeline: [
      {
        date: '2024-04-10',
        dayNumber: 1,
        dayType: 'conference',
        services: [
          {
            serviceId: 'gold-conference',
            serviceName: 'Gold Conference Package',
            category: 'package',
            quantity: 50,
            unitPrice: 350,
            totalPrice: 17500,
            taxGroup: 'none', // No taxes for exempt clients
            notes: 'Full conference package for government officials'
          }
        ]
      }
    ],
    
    // Financial Summary (no taxes)
    subtotal: 17500,
    taxBreakdown: [],
    totalTax: 0,
    grandTotal: 17500,
    
    // Terms & Conditions
    depositRequired: 0, // Government clients often don't pay deposits
    depositAmount: 0,
    balanceAmount: 17500,
    paymentTerms: 'Payment within 30 days after event completion',
    cancellationPolicy: 'No cancellation fees for government events',
    guaranteePolicy: 'Final numbers guaranteed 72 hours before event',
    
    // Additional Notes
    specialRequirements: 'Government protocol requirements, security clearance needed',
    setupTime: 'Setup begins 4 hours before event start time',
    contactPerson: 'Dr. Kwame Mensah - Director of Events (Phone: +233 30 123 4567)'
  };

  const venues = [
    {
      id: 'venue-001',
      name: 'Accra Conference Hall',
      type: 'conference',
      capacity: 200,
      price: 6000,
      status: 'available',
      features: ['Projector', 'Sound System', 'WiFi', 'Catering Kitchen'],
      location: 'Main Building, 1st Floor'
    },
    {
      id: 'venue-002',
      name: 'Kumasi Meeting Room',
      type: 'meeting',
      capacity: 50,
      price: 2000,
      status: 'booked',
      features: ['Projector', 'Whiteboard', 'Coffee Service'],
      location: 'East Wing, Ground Floor'
    },
    {
      id: 'venue-003',
      name: 'Ghana Banquet Hall',
      type: 'banquet',
      capacity: 300,
      price: 8000,
      status: 'setup',
      features: ['Dance Floor', 'Bar', 'Kitchen', 'Parking'],
      location: 'Garden Area, Separate Building'
    },
    {
      id: 'venue-004',
      name: 'Accra Auditorium',
      type: 'auditorium',
      capacity: 500,
      price: 12000,
      status: 'maintenance',
      features: ['Stage', 'Lighting', 'Sound System', 'VIP Seating'],
      location: 'Main Building, 2nd Floor'
    }
  ];

  const services = [
    {
      id: 'service-001',
      name: 'Projector Setup',
      type: 'equipment',
      price: 500,
      status: 'available',
      description: 'High-quality projector with screen'
    },
    {
      id: 'service-002',
      name: 'Catering Service',
      type: 'food',
      price: 1500,
      status: 'available',
      description: 'Full catering service for events'
    },
    {
      id: 'service-003',
      name: 'Sound System',
      type: 'equipment',
      price: 800,
      status: 'available',
      description: 'Professional sound system setup'
    },
    {
      id: 'service-004',
      name: 'Decoration Service',
      type: 'decoration',
      price: 1200,
      status: 'available',
      description: 'Event decoration and setup'
    }
  ];

  // Operational items following the superior Front Office pattern
  const operationalItems = [
    {
      category: 'Event Management',
      items: [
        { title: 'Event Calendar', icon: '📅', description: 'Complete event scheduling and timeline', status: 'active', count: totalEvents },
        { title: 'Active Events', icon: '🎯', description: 'Ongoing and upcoming events', status: 'active', count: activeEvents },
        { title: 'Completed Events', icon: '✅', description: 'Successfully concluded events', status: 'active', count: completedEvents },
        { title: 'Cancelled Events', icon: '❌', description: 'Cancelled or postponed events', status: 'warning', count: cancelledEvents },
      ]
    },
    {
      category: 'Venue Management',
      items: [
        { title: 'Conference Halls', icon: '🏢', description: 'Large conference and meeting spaces', status: 'active', count: 3 },
        { title: 'Meeting Rooms', icon: '🪑', description: 'Small to medium meeting spaces', status: 'active', count: 2 },
        { title: 'Banquet Halls', icon: '🍽️', description: 'Wedding and celebration venues', status: 'active', count: 1 },
        { title: 'Auditoriums', icon: '🎭', description: 'Large presentation and performance spaces', status: 'active', count: 0 },
      ]
    },
    {
      category: 'Services & Amenities',
      items: [
        { title: 'Catering Services', icon: '🍽️', description: 'Food and beverage options', status: 'active', count: 8 },
        { title: 'Audio Visual', icon: '🎵', description: 'Sound, lighting, and projection', status: 'active', count: 6 },
        { title: 'Decoration', icon: '🎨', description: 'Event styling and theming', status: 'active', count: 4 },
        { title: 'Transportation', icon: '🚗', description: 'Guest and equipment transport', status: 'active', count: 2 },
      ]
    },
    {
      category: 'Operations & Setup',
      items: [
        { title: 'Setup in Progress', icon: '🔧', description: 'Venues being prepared', status: 'active', count: setupInProgress },
        { title: 'Event Reports', icon: '📊', description: 'Performance and analytics', status: 'active', count: 0 },
        { title: 'Revenue Tracking', icon: '💰', description: 'Financial performance metrics', status: 'active', count: 125000 },
        { title: 'Attendee Management', icon: '👥', description: 'Guest registration and tracking', status: 'active', count: 1240 },
      ]
    }
  ];

  const handleQuickAction = (action: string) => {
    trackEvent('Events.QuickAction', { action });
    switch (action) {
      case 'book_venue':
        setSelectedTab('venues');
        break;
      case 'catering':
        setSelectedTab('services');
        break;
      case 'event_reports':
        setSelectedTab('reports');
        break;
      case 'setup_management':
        setSelectedTab('operations');
        break;
      default:
        break;
    }
  };

  const handleEventSubmit = () => {
    // Handle event creation/update
    setIsEventModalOpen(false);
    setEditingEvent(null);
    trackEvent('Events.EventCreated', { action: editingEvent?.id ? 'updated' : 'created' });
  };

  const handleVenueSubmit = () => {
    // Handle venue creation/update
    setIsVenueModalOpen(false);
    setEditingVenue(null);
    trackEvent('Events.VenueBooked', { action: editingVenue?.id ? 'updated' : 'created' });
  };

  const handleServiceSubmit = () => {
    // Handle service creation/update
    setIsServiceModalOpen(false);
    setEditingService(null);
    trackEvent('Events.SetupStarted', { action: editingService?.id ? 'updated' : 'created' });
  };

  // Comprehensive Quoting System Functions
  
  // Calculate taxes for a service line
  const calculateTaxes = (serviceLine: any, isTaxExempt: boolean = false) => {
    // If client is tax exempt, return no taxes
    if (isTaxExempt) {
      return { taxes: [], totalTax: 0, exemptionApplied: true };
    }
    
    const taxGroup = taxGroups.find(tg => tg.id === serviceLine.taxGroup);
    if (!taxGroup) return { taxes: [], totalTax: 0, exemptionApplied: false };
    
    const taxes = taxGroup.taxes.map(taxId => {
      const tax = ghanaTaxes.find(t => t.id === taxId);
      if (!tax) return null;
      
      const taxAmount = (serviceLine.totalPrice * tax.rate) / 100;
      return {
        id: tax.id,
        name: tax.name,
        rate: tax.rate,
        amount: taxAmount,
        authority: tax.authority
      };
    }).filter((tax): tax is NonNullable<typeof tax> => tax !== null);
    
    const totalTax = taxes.reduce((sum: number, tax: any) => sum + tax.amount, 0);
    return { taxes, totalTax, exemptionApplied: false };
  };

  // Calculate quote totals
  const calculateQuoteTotals = (quote: any) => {
    let subtotal = 0;
    const allTaxes: any[] = [];
    let hasTaxExemption = false;
    
    // Calculate subtotal and collect all taxes
    quote.eventTimeline.forEach((day: any) => {
      day.services.forEach((service: any) => {
        subtotal += service.totalPrice;
        const { taxes, exemptionApplied } = calculateTaxes(service, quote.taxExempt);
        if (exemptionApplied) hasTaxExemption = true;
        allTaxes.push(...taxes);
      });
    });
    
    // Group taxes by type and sum amounts
    const taxBreakdown = allTaxes.reduce((acc: any[], tax: any) => {
      const existing = acc.find((t: any) => t.id === tax.id);
      if (existing) {
        existing.amount += tax.amount;
      } else {
        acc.push({ ...tax });
      }
      return acc;
    }, []);
    
    const totalTax = taxBreakdown.reduce((sum: number, tax: any) => sum + tax.amount, 0);
    const grandTotal = subtotal + totalTax;
    const depositAmount = (grandTotal * quote.depositRequired) / 100;
    const balanceAmount = grandTotal - depositAmount;
    
    return {
      subtotal,
      taxBreakdown,
      totalTax,
      grandTotal,
      depositAmount,
      balanceAmount,
      hasTaxExemption
    };
  };

  // Add service to a specific day
  const addServiceToDay = (quote: any, dayIndex: number, service: any, quantity: number, notes: string = '') => {
    const newService = {
      serviceId: service.id,
      serviceName: service.name,
      category: service.category,
      quantity: quantity,
      unitPrice: service.basePrice,
      totalPrice: service.basePrice * quantity,
      taxGroup: service.taxGroup,
      notes: notes
    };
    
    quote.eventTimeline[dayIndex].services.push(newService);
    return quote;
  };

  // Remove service from a specific day
  const removeServiceFromDay = (quote: any, dayIndex: number, serviceIndex: number) => {
    quote.eventTimeline[dayIndex].services.splice(serviceIndex, 1);
    return quote;
  };

  // Add new day to timeline
  const addDayToTimeline = (quote: any, date: string, dayType: string) => {
    const newDay = {
      date: date,
      dayNumber: quote.eventTimeline.length + 1,
      dayType: dayType,
      services: []
    };
    quote.eventTimeline.push(newDay);
    return quote;
  };

  // Generate PDF Quote
  const generatePDFQuote = (quote: any) => {
    const totals = calculateQuoteTotals(quote);
    // In a real implementation, this would use a PDF library like jsPDF
    console.log('Generating PDF quote:', { quote, totals });
    trackEvent('Events.QuoteGenerated', { quoteId: quote.id });
  };

  // Send quote to client
  const sendQuoteToClient = (quote: any) => {
    // In a real implementation, this would send via email/WhatsApp
    console.log('Sending quote to client:', quote);
    trackEvent('Events.QuoteSent', { quoteId: quote.id });
  };

  // Convert quote to booking
  const convertQuoteToBooking = (quote: any) => {
    // In a real implementation, this would create a booking record
    console.log('Converting quote to booking:', quote);
    trackEvent('Events.QuoteConverted', { quoteId: quote.id });
  };

  // BEO (Banquet Event Order) Generation Functions
  const generateBEO = (event: any) => {
    const beoData = {
      eventId: event.id,
      eventName: event.eventName,
      organization: event.organization,
      venue: event.venueName,
      date: event.arrivalDate,
      duration: event.duration,
      pax: event.pax,
      residential: event.residential,
      revenue: event.revenue,
      deposit: event.deposit,
      balance: event.balance,
      salesManager: event.salesManager,
      contactPerson: event.contactPerson,
      contactPhone: event.contactPhone,
      contactEmail: event.contactEmail,
      specialRequirements: event.specialRequirements,
      setupTime: event.setupTime,
      status: event.status,
      linkedQuote: event.linkedQuote,
      linkedBooking: event.linkedBooking,
      linkedFolio: event.linkedFolio,
      
      // BEO Specific Fields
      roomSetup: getRoomSetupForEvent(event),
      cateringDetails: getCateringDetailsForEvent(event),
      audioVisual: getAudioVisualForEvent(event),
      staffing: getStaffingForEvent(event),
      timeline: getEventTimeline(event),
      notes: event.notes || ''
    };
    
    console.log('Generating BEO:', beoData);
    trackEvent('Events.EventCreated', { action: 'beo_generated', eventId: event.id });
    return beoData;
  };

  const getRoomSetupForEvent = (event: any) => {
    const baseSetup = {
      layout: 'Theatre Style',
      tables: Math.ceil(event.pax / 8),
      chairs: event.pax,
      headTable: event.pax > 50 ? 1 : 0,
      registrationTable: 1,
      displayTable: 1
    };
    
    if (event.eventType === 'wedding') {
      baseSetup.layout = 'Banquet Style';
      baseSetup.headTable = 1;
      baseSetup.displayTable = 2;
    } else if (event.eventType === 'training') {
      baseSetup.layout = 'Classroom Style';
      baseSetup.tables = Math.ceil(event.pax / 6);
    }
    
    return baseSetup;
  };

  const getCateringDetailsForEvent = (event: any) => {
    const catering = {
      mealType: 'Buffet',
      teaBreaks: event.duration > 1 ? 2 : 1,
      lunch: event.duration > 1 ? 1 : 0,
      dinner: event.duration > 1 ? 1 : 0,
      specialDietary: event.specialRequirements?.includes('vegetarian') ? 5 : 0,
      beverages: ['Coffee', 'Tea', 'Water', 'Soft Drinks'],
      snacks: ['Biscuits', 'Pastries', 'Fruits']
    };
    
    if (event.eventType === 'wedding') {
      catering.mealType = 'Plated Service';
      catering.dinner = 1;
      catering.beverages.push('Champagne');
    }
    
    return catering;
  };

  const getAudioVisualForEvent = (event: any) => {
    return {
      projector: 1,
      screen: 1,
      soundSystem: 1,
      microphones: event.pax > 50 ? 2 : 1,
      laptop: 1,
      internet: 'High-speed WiFi',
      lighting: 'Standard',
      recording: event.eventType === 'conference' ? true : false
    };
  };

  const getStaffingForEvent = (event: any) => {
    return {
      eventManager: 1,
      waitStaff: Math.ceil(event.pax / 25),
      kitchenStaff: Math.ceil(event.pax / 50),
      security: event.pax > 100 ? 1 : 0,
      technicalSupport: 1,
      cleaningStaff: 2
    };
  };

  const getEventTimeline = (event: any) => {
    const timeline = [];
    const startHour = 9; // Default start time
    
    timeline.push({
      time: `${startHour - 2}:00`,
      activity: 'Setup begins',
      responsible: 'Operations Team',
      duration: '2 hours'
    });
    
    timeline.push({
      time: `${startHour - 1}:00`,
      activity: 'Final setup and testing',
      responsible: 'Technical Team',
      duration: '1 hour'
    });
    
    timeline.push({
      time: `${startHour}:00`,
      activity: 'Event starts',
      responsible: 'Event Manager',
      duration: 'Event duration'
    });
    
    if (event.duration > 1) {
      timeline.push({
        time: `${startHour + 4}:00`,
        activity: 'Tea break',
        responsible: 'Catering Team',
        duration: '30 minutes'
      });
      
      if (event.duration > 2) {
        timeline.push({
          time: `${startHour + 6}:00`,
          activity: 'Lunch break',
          responsible: 'Catering Team',
          duration: '1 hour'
        });
      }
    }
    
    timeline.push({
      time: `${startHour + event.duration * 4}:00`,
      activity: 'Event ends',
      responsible: 'Event Manager',
      duration: 'Cleanup begins'
    });
    
    return timeline;
  };

  // Function Sheet Generation Functions
  const generateFunctionSheet = (event: any) => {
    const functionSheetData = {
      eventId: event.id,
      eventName: event.eventName,
      organization: event.organization,
      venue: event.venueName,
      date: event.arrivalDate,
      duration: event.duration,
      pax: event.pax,
      residential: event.residential,
      revenue: event.revenue,
      salesManager: event.salesManager,
      contactPerson: event.contactPerson,
      contactPhone: event.contactPhone,
      contactEmail: event.contactEmail,
      specialRequirements: event.specialRequirements,
      setupTime: event.setupTime,
      
      // Function Sheet Specific Fields
      roomSpecifications: getRoomSpecifications(event),
      cateringSpecifications: getCateringSpecifications(event),
      technicalSpecifications: getTechnicalSpecifications(event),
      serviceSchedule: getServiceSchedule(event),
      specialInstructions: getSpecialInstructions(event),
      contactList: getContactList(event)
    };
    
    console.log('Generating Function Sheet:', functionSheetData);
    trackEvent('Events.EventCreated', { action: 'function_sheet_generated', eventId: event.id });
    return functionSheetData;
  };

  const getRoomSpecifications = (event: any) => {
    return {
      roomName: event.venueName,
      capacity: event.pax,
      layout: getRoomSetupForEvent(event).layout,
      temperature: '22-24°C',
      lighting: 'Adjustable',
      access: 'Main entrance, elevator available',
      parking: 'Available for guests',
      setupNotes: event.specialRequirements || 'Standard setup'
    };
  };

  const getCateringSpecifications = (event: any) => {
    const catering = getCateringDetailsForEvent(event);
    return {
      ...catering,
      serviceStyle: catering.mealType === 'Plated Service' ? 'Formal' : 'Casual',
      dietaryAccommodations: catering.specialDietary > 0 ? 'Vegetarian options available' : 'Standard menu',
      allergies: 'Please inform in advance',
      presentation: 'Professional buffet setup with garnishes'
    };
  };

  const getTechnicalSpecifications = (event: any) => {
    const av = getAudioVisualForEvent(event);
    return {
      ...av,
      backupEquipment: 'Spare projector and microphone available',
      internetSpeed: '100 Mbps dedicated line',
      powerRequirements: 'Multiple power outlets available',
      technicalSupport: 'Available throughout event'
    };
  };

  const getServiceSchedule = (event: any) => {
    const timeline = getEventTimeline(event);
    return timeline.map(item => ({
      ...item,
      department: item.responsible,
      status: 'Pending',
      notes: ''
    }));
  };

  const getSpecialInstructions = (event: any) => {
    const instructions = [];
    
    if (event.specialRequirements?.includes('wheelchair')) {
      instructions.push('Wheelchair accessible venue required');
    }
    
    if (event.specialRequirements?.includes('vegetarian')) {
      instructions.push('Vegetarian meal options for 5 attendees');
    }
    
    if (event.pax > 100) {
      instructions.push('High-capacity event - additional staff required');
    }
    
    if (event.residential) {
      instructions.push('Accommodation arrangements confirmed');
    }
    
    return instructions.length > 0 ? instructions : ['Standard service protocols apply'];
  };

  const getContactList = (event: any) => {
    return [
      {
        name: event.contactPerson,
        role: 'Event Coordinator',
        phone: event.contactPhone,
        email: event.contactEmail
      },
      {
        name: event.salesManager,
        role: 'Sales Manager',
        phone: '+233 20 123 4567',
        email: 'sales@ghana-hotel.com'
      },
      {
        name: 'Operations Manager',
        role: 'Venue Operations',
        phone: '+233 20 123 4568',
        email: 'operations@ghana-hotel.com'
      },
      {
        name: 'Catering Manager',
        role: 'Food & Beverage',
        phone: '+233 20 123 4569',
        email: 'catering@ghana-hotel.com'
      }
    ];
  };

  // Helper functions for export operations
  const getFoodBeverageServices = (event: any) => {
    const services = [];
    if (event.duration > 0) services.push('ARRIVAL DINNER');
    if (event.duration > 1) {
      services.push('MORNING SNACK', 'LUNCH');
      if (event.duration > 2) services.push('AFTERNOON SNACK', 'DINNER');
    }
    return services.join(', ');
  };

  const getHousekeepingNotes = (event: any) => {
    if (event.residential) {
      return `PREPARE ${event.pax} ROOMS`;
    }
    return 'N/A';
  };

  const getProgrammeType = (event: any) => {
    switch (event.eventType) {
      case 'residential-conference':
        return 'RESIDENTIAL CONFERENCE';
      case 'non-residential':
        return 'NON-RESIDENTIAL CONFERENCE';
      case 'conference':
        return 'CONFERENCE';
      case 'workshop':
        return 'WORKSHOP';
      case 'training':
        return 'TRAINING';
      case 'wedding':
        return 'WEDDING';
      case 'banquet':
        return 'BANQUET';
      case 'meeting':
        return 'MEETING';
      case 'launch':
        return 'PRODUCT LAUNCH';
      case 'auditorium':
        return 'AUDITORIUM EVENT';
      default:
        return 'EVENT';
    }
  };

  // Function Schedule Export Functions
  const exportFunctionSchedulePDF = () => {
    try {
      // Track the export action
      trackEvent('Events.EventCreated', { action: 'function_schedule_pdf_exported', eventCount: allEvents.length });
      
      // Create PDF content
      const pdfContent = `
        Provisional Function Schedule - August 2025
        Generated on: ${new Date().toLocaleDateString()}
        
        Total Functions: ${allEvents.length}
        Confirmed: ${allEvents.filter(e => e.status === 'confirmed').length}
        Pending: ${allEvents.filter(e => e.status === 'awaiting-confirmation').length}
        Total Attendees: ${allEvents.reduce((sum, e) => sum + e.pax, 0)}
        
        ${allEvents.map((event, index) => `
          ${index + 1}. ${event.eventName}
          Organization: ${event.organization}
          Event Type: ${event.eventType}
          Programme Type: ${getProgrammeType(event)}
          Venue: ${event.venueName}
          Dates: ${event.arrivalDate} - ${event.departureDate}
          Duration: ${event.duration} days
          Attendees: ${event.pax}
          Status: ${event.status}
          Food & Beverage: ${getFoodBeverageServices(event)}
          Housekeeping/Front Desk: ${getHousekeepingNotes(event)}
        `).join('\n\n')}
      `;
      
      // Create blob and download
      const blob = new Blob([pdfContent], { type: 'text/plain' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `function-schedule-${new Date().toISOString().split('T')[0]}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      console.log('Function Schedule PDF exported successfully');
    } catch (error) {
      console.error('Error exporting PDF:', error);
    }
  };

  const downloadFunctionScheduleCSV = () => {
    try {
      // Track the export action
      trackEvent('Events.EventCreated', { action: 'function_schedule_csv_downloaded', eventCount: allEvents.length });
      
      // Create CSV content
      const headers = [
        'Item',
        'Organization',
        'Event Name',
        'Venue',
        'Arrival Date',
        'Departure Date',
        'Duration (Days)',
        'Attendees',
        'Status',
        'Revenue (GH₵)',
        'Sales Manager',
        'Contact Person',
        'Contact Phone',
        'Contact Email'
      ];
      
      const csvContent = [
        headers.join(','),
        ...allEvents.map((event, index) => [
          index + 1,
          `"${event.organization}"`,
          `"${event.eventName}"`,
          `"${event.venueName}"`,
          event.arrivalDate,
          event.departureDate,
          event.duration,
          event.pax,
          event.status,
          event.revenue,
          `"${event.salesManager}"`,
          `"${event.contactPerson}"`,
          `"${event.contactPhone}"`,
          `"${event.contactEmail}"`
        ].join(','))
      ].join('\n');
      
      // Create blob and download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `function-schedule-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      console.log('Function Schedule CSV downloaded successfully');
    } catch (error) {
      console.error('Error downloading CSV:', error);
    }
  };

  const shareToDepartments = () => {
    try {
      // Track the share action
      trackEvent('Events.EventCreated', { action: 'function_schedule_shared_to_departments', eventCount: allEvents.length });
      
      // Create summary for departments
      const summary = {
        totalFunctions: allEvents.length,
        confirmedEvents: allEvents.filter(e => e.status === 'confirmed').length,
        pendingEvents: allEvents.filter(e => e.status === 'awaiting-confirmation').length,
        totalAttendees: allEvents.reduce((sum, e) => sum + e.pax, 0),
        totalRevenue: allEvents.reduce((sum, e) => sum + e.revenue, 0),
        eventsByVenue: allEvents.reduce((acc, event) => {
          acc[event.venueName] = (acc[event.venueName] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        eventsByStatus: allEvents.reduce((acc, event) => {
          acc[event.status] = (acc[event.status] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      };
      
      // Simulate sending to departments
      const departments = ['Operations', 'Catering', 'Housekeeping', 'Security', 'Finance'];
      const message = `Function Schedule Summary sent to ${departments.join(', ')} departments:
      
Total Functions: ${summary.totalFunctions}
Confirmed Events: ${summary.confirmedEvents}
Pending Events: ${summary.pendingEvents}
Total Attendees: ${summary.totalAttendees}
Total Revenue: ₵${summary.totalRevenue.toLocaleString()}

Venue Distribution:
${Object.entries(summary.eventsByVenue).map(([venue, count]) => `- ${venue}: ${count} events`).join('\n')}

Status Distribution:
${Object.entries(summary.eventsByStatus).map(([status, count]) => `- ${status}: ${count} events`).join('\n')}`;
      
      // Show success message (in a real app, this would send emails/notifications)
      alert(`✅ Function Schedule shared successfully to all departments!\n\n${message}`);
      
      console.log('Function Schedule shared to departments:', summary);
    } catch (error) {
      console.error('Error sharing to departments:', error);
    }
  };
    
  const printFunctionSchedule = () => {
    try {
      // Track the print action
      trackEvent('Events.EventCreated', { action: 'function_schedule_printed', eventCount: allEvents.length });
      
      // Create print-friendly content
      const printContent = `
        <html>
          <head>
            <title>Function Schedule - August 2025</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 20px; }
              .header { text-align: center; margin-bottom: 30px; }
              .summary { margin-bottom: 30px; }
              .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-bottom: 20px; }
              .summary-item { text-align: center; padding: 15px; border: 1px solid #ddd; border-radius: 8px; }
              .summary-number { font-size: 24px; font-weight: bold; color: #2563eb; }
              .summary-label { font-size: 14px; color: #666; margin-top: 5px; }
              table { width: 100%; border-collapse: collapse; margin-top: 20px; }
              th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 12px; }
              th { background-color: #f8f9fa; font-weight: bold; }
              .status-confirmed { color: #059669; }
              .status-pending { color: #d97706; }
              .status-on-hold { color: #6b7280; }
              @media print { body { margin: 0; } .no-print { display: none; } }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>📋 Provisional Function Schedule</h1>
              <h2>August 2025</h2>
              <p>Generated on: ${new Date().toLocaleDateString()}</p>
            </div>
            
            <div class="summary">
              <div class="summary-grid">
                <div class="summary-item">
                  <div class="summary-number">${allEvents.length}</div>
                  <div class="summary-label">Total Functions</div>
                </div>
                <div class="summary-item">
                  <div class="summary-number">${allEvents.filter(e => e.status === 'confirmed').length}</div>
                  <div class="summary-label">Confirmed</div>
                </div>
                <div class="summary-item">
                  <div class="summary-number">${allEvents.filter(e => e.status === 'awaiting-confirmation').length}</div>
                  <div class="summary-label">Pending</div>
                </div>
                <div class="summary-item">
                  <div class="summary-number">${allEvents.reduce((sum, e) => sum + e.pax, 0)}</div>
                  <div class="summary-label">Total Attendees</div>
                </div>
              </div>
            </div>
            
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Organization</th>
                  <th>Event Name</th>
                  <th>Venue</th>
                  <th>Dates</th>
                  <th>Duration</th>
                  <th>Attendees</th>
                  <th>Status</th>
                  <th>Food & Beverage</th>
                  <th>Housekeeping/Front Desk</th>
                </tr>
              </thead>
              <tbody>
                ${allEvents.map((event, index) => `
                  <tr>
                    <td>${index + 1}</td>
                    <td>${event.organization}</td>
                    <td>${event.eventName}</td>
                    <td>${event.venueName}</td>
                    <td>${event.arrivalDate} - ${event.departureDate}</td>
                    <td>${event.duration} days</td>
                    <td>${event.pax}</td>
                    <td class="status-${event.status}">${event.status}</td>
                    <td>${getFoodBeverageServices(event)}</td>
                    <td>${getHousekeepingNotes(event)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            
            <div class="no-print" style="margin-top: 30px; text-align: center;">
              <button onclick="window.print()">🖨️ Print Schedule</button>
            </div>
          </body>
        </html>
      `;
      
      // Open print window
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(printContent);
        printWindow.document.close();
        printWindow.focus();
        // Auto-print after content loads
        setTimeout(() => {
          printWindow.print();
        }, 500);
      }
      
      console.log('Function Schedule print window opened successfully');
    } catch (error) {
      console.error('Error printing function schedule:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return 'success';
      case 'pending': return 'warning';
      case 'cancelled': return 'danger';
      case 'completed': return 'primary';
      case 'available': return 'success';
      case 'booked': return 'warning';
      case 'setup': return 'secondary';
      case 'maintenance': return 'danger';
      case 'active': return 'success';
      default: return 'default';
    }
  };

  const getEventTypeIcon = (type: string) => {
    switch (type) {
      case 'conference': return '🏢';
      case 'wedding': return '💒';
      case 'training': return '📚';
      case 'launch': return '🚀';
      case 'meeting': return '👥';
      case 'banquet': return '🍽️';
      case 'auditorium': return '🎭';
      default: return '📅';
    }
  };

  // Comprehensive Event Management Data Structures
  
  // Event Status Types with Color Coding
  const eventStatuses = {
    'tentative': { label: 'Tentative', color: 'danger', bgColor: 'bg-red-50', borderColor: 'border-red-200' },
    'awaiting-confirmation': { label: 'Awaiting Confirmation', color: 'warning', bgColor: 'bg-yellow-50', borderColor: 'border-yellow-200' },
    'on-hold': { label: 'On Hold', color: 'secondary', bgColor: 'bg-gray-50', borderColor: 'border-gray-200' },
    'confirmed': { label: 'Confirmed', color: 'success', bgColor: 'bg-green-50', borderColor: 'border-green-200' },
    'completed': { label: 'Completed', color: 'primary', bgColor: 'bg-blue-50', borderColor: 'border-blue-200' },
    'cancelled': { label: 'Cancelled', color: 'danger', bgColor: 'bg-red-100', borderColor: 'border-red-300' }
  };

  // Modern Venue Information (Replacing static data)
  const modernVenues = [
    {
      id: 'oforwaa-hall',
      name: 'Oforwaa Hall',
      capacity: 200,
      type: 'conference',
      location: 'Main Building, Ground Floor',
      features: ['Projector', 'Sound System', 'WiFi', 'Air Conditioning', 'Flexible Layout'],
      basePrice: 800,
      currency: 'GH₵',
      status: 'available'
    },
    {
      id: 'dankwah-hall',
      name: 'Dankwah Hall',
      capacity: 150,
      type: 'conference',
      location: 'Main Building, First Floor',
      features: ['Projector', 'Sound System', 'WiFi', 'Air Conditioning', 'Fixed Theater Layout'],
      basePrice: 600,
      currency: 'GH₵',
      status: 'available'
    },
    {
      id: 'aqua-blue-room',
      name: 'Aqua Blue Room',
      capacity: 80,
      type: 'meeting',
      location: 'East Wing, Second Floor',
      features: ['Projector', 'WiFi', 'Air Conditioning', 'U-Shape Layout'],
      basePrice: 400,
      currency: 'GH₵',
      status: 'available'
    },
    {
      id: 'gold-coast-hall',
      name: 'Gold Coast Hall',
      capacity: 300,
      type: 'banquet',
      location: 'West Wing, Ground Floor',
      features: ['Stage', 'Sound System', 'WiFi', 'Air Conditioning', 'Banquet Layout'],
      basePrice: 1200,
      currency: 'GH₵',
      status: 'available'
    }
  ];

  // Comprehensive Events Data (Replacing static PDF function sheet)
  const comprehensiveEvents = [
    {
      id: 'evt-001',
      organization: 'T-TEL',
      eventName: 'T-TEL Extended Conference',
      eventType: 'residential-conference',
      venue: 'oforwaa-hall',
      venueName: 'Oforwaa Hall',
      arrivalDate: '2025-07-27',
      departureDate: '2025-08-08',
      duration: 13,
      pax: 45,
      residential: true,
      status: 'confirmed',
      statusColor: 'success',
      revenue: 45000,
      deposit: 22500,
      balance: 22500,
      salesManager: 'Kwame Mensah',
      notes: 'Extended conference with full accommodation package. Special dietary requirements for 5 attendees.',
      specialRequirements: 'Vegetarian options, wheelchair access, extra projectors',
      setupTime: '2 hours before event',
      contactPerson: 'Dr. Sarah Addo',
      contactPhone: '+233 20 123 4567',
      contactEmail: 'sarah.addo@t-tel.com',
      linkedQuote: 'Q-2025-001',
      linkedBooking: 'BK-2025-001',
      linkedBEO: 'BEO-2025-001',
      linkedFolio: 'FOL-2025-001'
    },
    {
      id: 'evt-002',
      organization: 'T-TEL',
      eventName: 'T-TEL On Hold Event',
      eventType: 'non-residential',
      venue: 'oforwaa-hall',
      venueName: 'Oforwaa Hall',
      arrivalDate: '2025-07-30',
      departureDate: '2025-08-02',
      duration: 3,
      pax: 30,
      residential: false,
      status: 'on-hold',
      statusColor: 'secondary',
      revenue: 9000,
      deposit: 0,
      balance: 9000,
      salesManager: 'Kwame Mensah',
      notes: 'On hold pending budget approval from headquarters.',
      specialRequirements: 'Standard setup, no special requirements',
      setupTime: '1 hour before event',
      contactPerson: 'Mr. John Doe',
      contactPhone: '+233 20 123 4568',
      contactEmail: 'john.doe@t-tel.com',
      linkedQuote: 'Q-2025-002',
      linkedBooking: null,
      linkedBEO: null,
      linkedFolio: null
    },
    {
      id: 'evt-003',
      organization: 'AAMUSTED',
      eventName: 'AAMUSTED Academic Conference',
      eventType: 'residential-conference',
      venue: 'oforwaa-hall',
      venueName: 'Oforwaa Hall',
      arrivalDate: '2025-08-02',
      departureDate: '2025-08-05',
      duration: 4,
      pax: 60,
      residential: true,
      status: 'confirmed',
      statusColor: 'success',
      revenue: 36000,
      deposit: 18000,
      balance: 18000,
      salesManager: 'Ama Osei',
      notes: 'Academic conference with international participants. High-speed internet required.',
      specialRequirements: 'High-speed WiFi, presentation equipment, recording facilities',
      setupTime: '3 hours before event',
      contactPerson: 'Prof. Kwesi Addo',
      contactPhone: '+233 20 123 4569',
      contactEmail: 'kwesi.addo@aamusted.edu.gh',
      linkedQuote: 'Q-2025-003',
      linkedBooking: 'BK-2025-002',
      linkedBEO: 'BEO-2025-002',
      linkedFolio: 'FOL-2025-002'
    },
    {
      id: 'evt-004',
      organization: 'Garden City University',
      eventName: 'Garden City University Workshop',
      eventType: 'non-residential',
      venue: 'oforwaa-hall',
      venueName: 'Oforwaa Hall',
      arrivalDate: '2025-08-07',
      departureDate: '2025-08-09',
      duration: 3,
      pax: 40,
      residential: false,
      status: 'awaiting-confirmation',
      statusColor: 'warning',
      revenue: 12000,
      deposit: 0,
      balance: 12000,
      salesManager: 'Ama Osei',
      notes: 'Workshop for university staff. Awaiting final confirmation from university board.',
      specialRequirements: 'Workshop layout, flip charts, whiteboards',
      setupTime: '2 hours before event',
      contactPerson: 'Dr. Grace Mensah',
      contactPhone: '+233 20 123 4570',
      contactEmail: 'grace.mensah@gcuniversity.edu.gh',
      linkedQuote: 'Q-2025-004',
      linkedBooking: null,
      linkedBEO: null,
      linkedFolio: null
    },
    {
      id: 'evt-005',
      organization: 'I-Trade Consult',
      eventName: 'I-Trade Consult Training',
      eventType: 'non-residential',
      venue: 'oforwaa-hall',
      venueName: 'Oforwaa Hall',
      arrivalDate: '2025-08-12',
      departureDate: '2025-08-14',
      duration: 3,
      pax: 25,
      residential: false,
      status: 'confirmed',
      statusColor: 'success',
      revenue: 7500,
      deposit: 3750,
      balance: 3750,
      salesManager: 'Kwame Mensah',
      notes: 'Corporate training session. All materials provided by client.',
      specialRequirements: 'Training room layout, projector, whiteboard',
      setupTime: '1 hour before event',
      contactPerson: 'Mr. David Wilson',
      contactPhone: '+233 20 123 4571',
      contactEmail: 'david.wilson@itradeconsult.com',
      linkedQuote: 'Q-2025-005',
      linkedBooking: null,
      linkedBEO: 'BEO-2025-003',
      linkedFolio: 'FOL-2025-003'
    },
    {
      id: 'evt-006',
      organization: 'CHAI',
      eventName: 'CHAI Health Conference',
      eventType: 'residential-conference',
      venue: 'oforwaa-hall',
      venueName: 'Oforwaa Hall',
      arrivalDate: '2025-08-18',
      departureDate: '2025-08-21',
      duration: 4,
      pax: 80,
      residential: true,
      status: 'awaiting-confirmation',
      statusColor: 'warning',
      revenue: 48000,
      deposit: 0,
      balance: 48000,
      salesManager: 'Ama Osei',
      notes: 'International health conference. Awaiting visa confirmations for international participants.',
      specialRequirements: 'International standards, health protocols, recording facilities',
      setupTime: '4 hours before event',
      contactPerson: 'Dr. Mary Johnson',
      contactPhone: '+233 20 123 4572',
      contactEmail: 'mary.johnson@chai.org',
      linkedQuote: 'Q-2025-006',
      linkedBooking: null,
      linkedBEO: null,
      linkedFolio: null
    },
    {
      id: 'evt-007',
      organization: 'GIZ-NEID',
      eventName: 'GIZ-NEID CLUSTER Conference',
      eventType: 'residential-conference',
      venue: 'oforwaa-hall',
      venueName: 'Oforwaa Hall',
      arrivalDate: '2025-08-18',
      departureDate: '2025-08-23',
      duration: 6,
      pax: 120,
      residential: true,
      status: 'confirmed',
      statusColor: 'success',
      revenue: 72000,
      deposit: 36000,
      balance: 36000,
      salesManager: 'Kwame Mensah',
      notes: 'Major international development conference. High-profile attendees including government officials.',
      specialRequirements: 'Security clearance, VIP protocols, international standards',
      setupTime: '6 hours before event',
      contactPerson: 'Ms. Anna Schmidt',
      contactPhone: '+233 20 123 4573',
      contactEmail: 'anna.schmidt@giz.de',
      linkedQuote: 'Q-2025-007',
      linkedBooking: 'BK-2025-003',
      linkedBEO: 'BEO-2025-004',
      linkedFolio: 'FOL-2025-004'
    }
  ];

  // Additional events for other venues
  const additionalEvents = [
    {
      id: 'evt-008',
      organization: 'Integrated Health',
      eventName: 'Integrated Health Workshop',
      eventType: 'non-residential',
      venue: 'dankwah-hall',
      venueName: 'Dankwah Hall',
      arrivalDate: '2025-08-04',
      departureDate: '2025-08-07',
      duration: 4,
      pax: 100,
      residential: false,
      status: 'awaiting-confirmation',
      statusColor: 'warning',
      revenue: 24000,
      deposit: 0,
      balance: 24000,
      salesManager: 'Ama Osei',
      notes: 'Healthcare workshop for medical professionals.',
      specialRequirements: 'Medical equipment setup, health protocols',
      setupTime: '2 hours before event',
      contactPerson: 'Dr. Kofi Asante',
      contactPhone: '+233 20 123 4574',
      contactEmail: 'kofi.asante@integratedhealth.com',
      linkedQuote: 'Q-2025-008',
      linkedBooking: null,
      linkedBEO: null,
      linkedFolio: null
    },
    {
      id: 'evt-009',
      organization: 'GIZ-NEID',
      eventName: 'GIZ-NEID Side Event',
      eventType: 'non-residential',
      venue: 'dankwah-hall',
      venueName: 'Dankwah Hall',
      arrivalDate: '2025-08-13',
      departureDate: '2025-08-14',
      duration: 2,
      pax: 50,
      residential: false,
      status: 'confirmed',
      statusColor: 'success',
      revenue: 12000,
      deposit: 6000,
      balance: 6000,
      salesManager: 'Kwame Mensah',
      notes: 'Side event to main conference in Oforwaa Hall.',
      specialRequirements: 'Linked to main conference setup',
      setupTime: '1 hour before event',
      contactPerson: 'Ms. Anna Schmidt',
      contactPhone: '+233 20 123 4573',
      contactEmail: 'anna.schmidt@giz.de',
      linkedQuote: 'Q-2025-009',
      linkedBooking: null,
      linkedBEO: 'BEO-2025-005',
      linkedFolio: 'FOL-2025-005'
    },
    {
      id: 'evt-010',
      organization: 'International Justice Mission',
      eventName: 'IJM Legal Workshop',
      eventType: 'non-residential',
      venue: 'dankwah-hall',
      venueName: 'Dankwah Hall',
      arrivalDate: '2025-08-18',
      departureDate: '2025-08-21',
      duration: 4,
      pax: 75,
      residential: false,
      status: 'confirmed',
      statusColor: 'success',
      revenue: 18000,
      deposit: 9000,
      balance: 9000,
      salesManager: 'Ama Osei',
      notes: 'Legal workshop for justice professionals.',
      specialRequirements: 'Legal documentation setup, recording facilities',
      setupTime: '2 hours before event',
      contactPerson: 'Mr. James Brown',
      contactPhone: '+233 20 123 4575',
      contactEmail: 'james.brown@ijm.org',
      linkedQuote: 'Q-2025-010',
      linkedBooking: null,
      linkedBEO: 'BEO-2025-006',
      linkedFolio: 'FOL-2025-006'
    },
    {
      id: 'evt-011',
      organization: 'Rural Bank Association',
      eventName: 'Rural Bank AGM',
      eventType: 'non-residential',
      venue: 'dankwah-hall',
      venueName: 'Dankwah Hall',
      arrivalDate: '2025-08-28',
      departureDate: '2025-08-30',
      duration: 3,
      pax: 120,
      residential: false,
      status: 'confirmed',
      statusColor: 'success',
      revenue: 18000,
      deposit: 9000,
      balance: 9000,
      salesManager: 'Kwame Mensah',
      notes: 'Annual general meeting for rural bank members.',
      specialRequirements: 'AGM setup, voting facilities, presentation equipment',
      setupTime: '3 hours before event',
      contactPerson: 'Mr. Kwame Owusu',
      contactPhone: '+233 20 123 4576',
      contactEmail: 'kwame.owusu@ruralbank.org',
      linkedQuote: 'Q-2025-011',
      linkedBooking: null,
      linkedBEO: 'BEO-2025-007',
      linkedFolio: 'FOL-2025-007'
    }
  ];

  // Combine all events for modern management system
  const allEvents = [...comprehensiveEvents, ...additionalEvents];

  // Report and Analytics Data
  const monthlyRevenue = allEvents.reduce((sum, event) => sum + event.revenue, 0);
  const averageEventValue = allEvents.length > 0 ? monthlyRevenue / allEvents.length : 0;
  const totalAttendees = allEvents.reduce((sum, event) => sum + event.pax, 0);
  const occupancyRate = Math.round((allEvents.length / 30) * 100); // Simple calculation for demo

  // Comprehensive Event Management Functions
  
  // Check for venue double-booking conflicts
  const checkForClashes = (newEvent: any, existingEvents: any[] = allEvents) => {
    const conflictingEvents = existingEvents.filter(event => {
      // Skip the event itself if updating
      if (event.id === newEvent.id) return false;
      
      // Check if same venue
      if (event.venue !== newEvent.venue) return false;
      
      // Check for date overlap
      const newStart = new Date(newEvent.arrivalDate);
      const newEnd = new Date(newEvent.departureDate);
      const existingStart = new Date(event.arrivalDate);
      const existingEnd = new Date(event.departureDate);
      
      // Check if dates overlap
      return (newStart <= existingEnd && newEnd >= existingStart);
    });
    
    return conflictingEvents;
  };

  // Check for resource overload (rooms, kitchen capacity, etc.)
  const checkResourceOverload = (newEvent: any, existingEvents: any[] = allEvents) => {
    const eventDate = new Date(newEvent.arrivalDate);
    const sameDateEvents = existingEvents.filter(event => {
      if (event.id === newEvent.id) return false;
      
      const eventStart = new Date(event.arrivalDate);
      const eventEnd = new Date(event.departureDate);
      
      return (eventStart <= eventDate && eventEnd >= eventDate);
    });
    
    // Calculate total pax for the same date
    const totalPax = sameDateEvents.reduce((sum, event) => sum + event.pax, 0) + newEvent.pax;
    
    // Check against venue capacity
    const venue = modernVenues.find(v => v.id === newEvent.venue);
    const venueCapacity = venue ? venue.capacity : 0;
    
    // Check against room inventory (assuming 150 rooms available)
    const totalResidentialPax = sameDateEvents
      .filter(event => event.residential)
      .reduce((sum, event) => sum + event.pax, 0) + (newEvent.residential ? newEvent.pax : 0);
    
    const warnings = [];
    
    if (totalPax > venueCapacity) {
      warnings.push({
        type: 'venue-overload',
        message: `High Venue Load Warning! Total attendees (${totalPax}) exceeds venue capacity (${venueCapacity}) on ${newEvent.arrivalDate}.`
      });
    }
    
    if (totalResidentialPax > 150) {
      warnings.push({
        type: 'room-overload',
        message: `Insufficient Room Inventory! These bookings would require ${totalResidentialPax} rooms on ${newEvent.arrivalDate}, but only 150 are available.`
      });
    }
    
    if (totalPax > 200) {
      warnings.push({
        type: 'kitchen-overload',
        message: `High Kitchen Load Warning on ${newEvent.arrivalDate}! Total attendees (${totalPax}) may overwhelm kitchen capacity.`
      });
    }
    
    return warnings;
  };

  // Get events for a specific date range
  const getEventsForDateRange = (startDate: string, endDate: string, venue?: string) => {
    const filteredEvents = allEvents.filter(event => {
      const eventStart = new Date(event.arrivalDate);
      const eventEnd = new Date(event.departureDate);
      const rangeStart = new Date(startDate);
      const rangeEnd = new Date(endDate);
      
      // Check if event overlaps with date range
      const dateOverlap = (eventStart <= rangeEnd && eventEnd >= rangeStart);
      
      // If venue specified, also check venue
      if (venue) {
        return dateOverlap && event.venue === venue;
      }
      
      return dateOverlap;
    });
    
    return filteredEvents.sort((a, b) => new Date(a.arrivalDate).getTime() - new Date(b.arrivalDate).getTime());
  };

  // Get events for a specific venue
  const getEventsForVenue = (venueId: string) => {
    return allEvents.filter(event => event.venue === venueId)
      .sort((a, b) => new Date(a.arrivalDate).getTime() - new Date(b.arrivalDate).getTime());
  };

  // Get events by status
  const getEventsByStatus = (status: string) => {
    return allEvents.filter(event => event.status === status);
  };

  // Get events by organization
  const getEventsByOrganization = (organization: string) => {
    return allEvents.filter(event => event.organization === organization);
  };

  // Update event status
  const updateEventStatus = (eventId: string, newStatus: string) => {
    const event = allEvents.find(e => e.id === eventId);
    if (event) {
      event.status = newStatus;
      event.statusColor = eventStatuses[newStatus as keyof typeof eventStatuses]?.color || 'default';
      trackEvent('Events.EventStatusUpdated', { eventId, newStatus });
    }
  };

  // Generate Gantt chart data for a specific venue
  const generateGanttData = (venueId: string) => {
    const venueEvents = getEventsForVenue(venueId);
    
    return venueEvents.map(event => ({
      id: event.id,
      text: `${event.organization} - ${event.eventName}`,
      start: event.arrivalDate,
      end: event.departureDate,
      duration: event.duration,
      status: event.status,
      statusColor: event.statusColor,
      pax: event.pax,
      residential: event.residential,
      revenue: event.revenue,
      salesManager: event.salesManager
    }));
  };

  // Get calendar view data (monthly/weekly)
  const getCalendarViewData = (year: number, month: number) => {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);
    
    return allEvents.filter(event => {
      const eventStart = new Date(event.arrivalDate);
      const eventEnd = new Date(event.departureDate);
      
      return (eventStart <= endDate && eventEnd >= startDate);
    });
  };

  // Calculate venue utilization for a date range
  const calculateVenueUtilization = (startDate: string, endDate: string) => {
    const events = getEventsForDateRange(startDate, endDate);
    const venueStats: { [key: string]: { totalDays: number, totalRevenue: number, eventCount: number } } = {};
    
    events.forEach(event => {
      if (!venueStats[event.venue]) {
        venueStats[event.venue] = { totalDays: 0, totalRevenue: 0, eventCount: 0 };
      }
      
      venueStats[event.venue].totalDays += event.duration;
      venueStats[event.venue].totalRevenue += event.revenue;
      venueStats[event.venue].eventCount += 1;
    });
    
    return venueStats;
  };

  // Get upcoming events that need attention
  const getUpcomingEventsNeedingAttention = () => {
    const today = new Date();
    const thirtyDaysFromNow = new Date(today.getTime() + (30 * 24 * 60 * 60 * 1000));
    
    return allEvents.filter(event => {
      const eventDate = new Date(event.arrivalDate);
      const isUpcoming = eventDate >= today && eventDate <= thirtyDaysFromNow;
      const needsAttention = event.status === 'awaiting-confirmation' || event.status === 'on-hold';
      
      return isUpcoming && needsAttention;
    });
  };

  // Get events requiring follow-up
  const getEventsRequiringFollowUp = () => {
    const today = new Date();
    
    return allEvents.filter(event => {
      const eventDate = new Date(event.arrivalDate);
      const daysUntilEvent = Math.ceil((eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      
      // Events in next 7 days that are not confirmed
      return daysUntilEvent <= 7 && event.status !== 'confirmed' && event.status !== 'completed';
    });
  };

  const getFilteredAndSortedEvents = () => {
    let filteredEvents = allEvents;

    if (searchTerm) {
      filteredEvents = filteredEvents.filter(event => 
        event.eventName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        event.organization.toLowerCase().includes(searchTerm.toLowerCase()) ||
        event.venueName.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (dateRange.startDate && dateRange.endDate) {
      filteredEvents = filteredEvents.filter(event => 
        new Date(event.arrivalDate) >= new Date(dateRange.startDate) &&
        new Date(event.departureDate) <= new Date(dateRange.endDate)
      );
    }

    if (programmeTypeFilter !== 'all') {
      filteredEvents = filteredEvents.filter(event => 
        event.eventType === programmeTypeFilter
      );
    }

    return filteredEvents.sort((a, b) => new Date(a.arrivalDate).getTime() - new Date(b.arrivalDate).getTime());
  };

  // Client Management Functions
  const handleClientAction = (action: string, client: any) => {
    trackEvent('Analytics.ActionClicked', { action: 'EventsClientAction', clientAction: action, clientId: client.id });
    setSelectedClient(client);
    
    switch (action) {
      case 'view':
        setIsClientViewModalOpen(true);
        break;
      case 'contract':
        setIsContractModalOpen(true);
        break;
      case 'edit':
        setIsClientEditModalOpen(true);
        break;
      default:
        break;
    }
  };

  const generateClientContract = (client: any) => {
    // Generate contract with negotiated rates
    const contractData = {
      clientName: client.name,
      organization: client.organization,
      contractStart: client.contractStart,
      contractEnd: client.contractEnd,
      rates: client.rates,
      specialTerms: client.specialTerms,
      generatedDate: new Date().toISOString().split('T')[0]
    };
    
    console.log('Contract generated:', contractData);
    // Here you would typically open a contract modal or generate PDF
  };

  const handleContractDownload = () => {
    // Generate and download PDF contract
    if (selectedClient) {
      // Create contract content
      const contractContent = `
        EVENT SERVICES CONTRACT
        
        Between Ghana Hotel & Conference Center and ${selectedClient.organization}
        Contract Period: ${selectedClient.contractStart} to ${selectedClient.contractEnd}
        
        CLIENT DETAILS:
        Name: ${selectedClient.name}
        Position: ${selectedClient.position}
        Organization: ${selectedClient.organization}
        Contact: ${selectedClient.contact}
        Email: ${selectedClient.email}
        WhatsApp: ${selectedClient.whatsapp ? 'Available' : 'Not Available'}
        
        NEGOTIATED RATES:
        Accommodation: ₵${selectedClient.rates.accommodation}/night
        Conference Services: ₵${selectedClient.rates.conference}/head
        Catering: ₵${selectedClient.rates.catering}/head
        
        ${selectedClient.specialTerms ? `SPECIAL TERMS: ${selectedClient.specialTerms}` : ''}
        
        STANDARD CONTRACT TERMS:
        • Payment Terms: 50% deposit required upon booking, balance due 7 days before event
        • Cancellation Policy: 30 days notice required for full refund, 14 days for 50% refund
        • Force Majeure: Events beyond our control may result in rescheduling or refund
        • Liability: Ghana Hotel & Conference Center liability limited to contract value
        • Governing Law: This contract is governed by the laws of Ghana
        
        Generated on: ${new Date().toLocaleDateString()}
      `;
      
      // Create blob and download
      const blob = new Blob([contractContent], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Contract_${selectedClient.organization}_${selectedClient.contractStart}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      console.log('Contract PDF downloaded successfully');
      trackEvent('Analytics.ActionClicked', { action: 'ContractDownloaded', clientId: selectedClient.id });
    }
  };

  const handleContractPrint = () => {
    // Print contract
    if (selectedClient) {
      // Create printable contract content
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Event Services Contract - ${selectedClient.organization}</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; }
              .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px; }
              .section { margin-bottom: 25px; }
              .rates-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin: 20px 0; }
              .rate-card { border: 1px solid #ddd; padding: 15px; text-align: center; background: #f9f9f9; }
              .signature-section { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-top: 40px; }
              .signature-box { border-top: 2px solid #333; padding-top: 15px; }
              @media print { body { margin: 20px; } }
            </style>
          </head>
          <body>
            <div class="header">
              <h1 style="font-size: 28px; margin-bottom: 10px;">EVENT SERVICES CONTRACT</h1>
              <p style="font-size: 18px;">Between Ghana Hotel & Conference Center and ${selectedClient.organization}</p>
              <p style="font-size: 14px; color: #666;">Contract Period: ${selectedClient.contractStart} to ${selectedClient.contractEnd}</p>
            </div>
            
            <div class="section">
              <h2>Client Details</h2>
              <p><strong>Name:</strong> ${selectedClient.name}</p>
              <p><strong>Position:</strong> ${selectedClient.position}</p>
              <p><strong>Organization:</strong> ${selectedClient.organization}</p>
              <p><strong>Contact:</strong> ${selectedClient.contact}</p>
              <p><strong>Email:</strong> ${selectedClient.email}</p>
              <p><strong>WhatsApp:</strong> ${selectedClient.whatsapp ? 'Available' : 'Not Available'}</p>
            </div>
            
            <div class="section">
              <h2>Negotiated Rates & Services</h2>
              <div class="rates-grid">
                <div class="rate-card">
                  <h3>Accommodation</h3>
                  <p style="font-size: 24px; font-weight: bold; color: #4f46e5;">₵${selectedClient.rates.accommodation}</p>
                  <p>per night</p>
                </div>
                <div class="rate-card">
                  <h3>Conference Services</h3>
                  <p style="font-size: 24px; font-weight: bold; color: #4f46e5;">₵${selectedClient.rates.conference}</p>
                  <p>per person</p>
                </div>
                <div class="rate-card">
                  <h3>Catering</h3>
                  <p style="font-size: 24px; font-weight: bold; color: #4f46e5;">₵${selectedClient.rates.catering}</p>
                  <p>per person</p>
                </div>
              </div>
            </div>
            
            ${selectedClient.specialTerms ? `
            <div class="section">
              <h2>Special Terms & Conditions</h2>
              <p>${selectedClient.specialTerms}</p>
            </div>
            ` : ''}
            
            <div class="section">
              <h2>Standard Contract Terms</h2>
              <ul>
                <li><strong>Payment Terms:</strong> 50% deposit required upon booking, balance due 7 days before event</li>
                <li><strong>Cancellation Policy:</strong> 30 days notice required for full refund, 14 days for 50% refund</li>
                <li><strong>Force Majeure:</strong> Events beyond our control may result in rescheduling or refund</li>
                <li><strong>Liability:</strong> Ghana Hotel & Conference Center liability limited to contract value</li>
                <li><strong>Governing Law:</strong> This contract is governed by the laws of Ghana</li>
              </ul>
            </div>
            
            <div class="signature-section">
              <div class="signature-box">
                <h3>Client Signature</h3>
                <p>Client Name: _________________</p>
                <p>Date: _________________</p>
                <p>Signature: _________________</p>
              </div>
              <div class="signature-box">
                <h3>Hotel Representative</h3>
                <p>Name: _________________</p>
                <p>Date: _________________</p>
                <p>Signature: _________________</p>
              </div>
            </div>
            
            <div style="text-align: center; margin-top: 40px; color: #666; font-size: 12px;">
              Generated on: ${new Date().toLocaleDateString()}
            </div>
          </body>
          </html>
        `);
        
        printWindow.document.close();
        printWindow.focus();
        
        // Wait for content to load then print
        printWindow.onload = () => {
          printWindow.print();
          printWindow.close();
        };
        
        console.log('Contract printed successfully');
        trackEvent('Analytics.ActionClicked', { action: 'ContractPrinted', clientId: selectedClient.id });
      }
    }
  };

  // Removed local add-client modal; creation now redirects to canonical form

  const handleClientEdit = () => {
    // Handle client edit
    setIsClientEditModalOpen(false);
    trackEvent('Analytics.ActionClicked', { action: 'EventsClientEdited', clientId: selectedClient?.id });
    console.log('Client edited successfully');
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-ghana-black">🎉 Events & Conferences Management</h2>
        <div className="flex items-center gap-3">
          <Badge color="success" variant="flat">✔ Online</Badge>
          <Button 
            color="success" 
            variant="solid" 
            size="sm"
            onClick={() => {
              setEditingEvent({});
              setIsEventModalOpen(true);
            }}
          >
            ➕ New Event
          </Button>
        </div>
      </div>

      {/* Venue Status Overview */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold text-ghana-black flex items-center gap-2">
            🏢 Venue Status Overview ({totalVenues} Venues)
          </h3>
        </div>
        
        {/* Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          {/* Available Venues */}
          <Card className="border-0 shadow-lg border-l-4 border-l-green-500">
            <CardBody className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-lg font-semibold text-ghana-black">Available Venues</h4>
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              </div>
              <div className="text-3xl font-bold text-green-600 mb-3">{availableVenues}</div>
              <div className="space-y-1 text-sm text-gray-600">
                <div className="flex justify-between">
                  <span>Conference Halls</span>
                  <span className="font-medium">2</span>
                </div>
                <div className="flex justify-between">
                  <span>Meeting Rooms</span>
                  <span className="font-medium">1</span>
                </div>
                <div className="flex justify-between">
                  <span>Auditoriums</span>
                  <span className="font-medium">0</span>
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Booked Venues */}
          <Card className="border-0 shadow-lg border-l-4 border-l-red-500">
            <CardBody className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-lg font-semibold text-ghana-black">Booked Venues</h4>
                <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              </div>
              <div className="text-3xl font-bold text-red-600 mb-3">{bookedVenues}</div>
              <div className="space-y-1 text-sm text-gray-600">
                <div className="flex justify-between">
                  <span>Today's Events</span>
                  <span className="font-medium">{eventsToday}</span>
                </div>
                <div className="flex justify-between">
                  <span>Setup in Progress</span>
                  <span className="font-medium">{setupInProgress}</span>
                </div>
                <div className="flex justify-between">
                  <span>VIP Events</span>
                  <span className="font-medium">1</span>
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Financial Performance */}
          <Card className="border-0 shadow-lg border-l-4 border-l-purple-500">
            <CardBody className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-lg font-semibold text-ghana-black">Financial Performance</h4>
                <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
              </div>
              <div className="text-3xl font-bold text-purple-600 mb-3">₵{monthlyRevenue.toLocaleString()}</div>
              <div className="space-y-1 text-sm text-gray-600">
                <div className="flex justify-between">
                  <span>Monthly Revenue</span>
                  <span className="font-medium">₵{monthlyRevenue.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Avg Event Value</span>
                  <span className="font-medium">₵{averageEventValue.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Total Attendees</span>
                  <span className="font-medium">{totalAttendees}</span>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>

        {/* Today's Event Operations */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-lg">📅</span>
              <h4 className="text-lg font-semibold text-ghana-black">Today's Event Operations</h4>
            </div>
            <div className="flex items-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-green-600 font-medium">{eventsToday} Events</span>
                <span className="text-gray-500">Today</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-blue-600 font-medium">{newBookings} New Bookings</span>
                <span className="text-gray-500">Received</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-orange-600 font-medium">{setupInProgress} Setup</span>
                <span className="text-gray-500">In Progress</span>
              </div>
            </div>
          </div>
          <Button 
            color="success" 
            variant="solid"
            className="bg-green-600 hover:bg-green-700"
            onClick={() => setSelectedTab('venues')}
          >
            🏢 View Full Status
          </Button>
        </div>
      </div>

      {/* Quick Actions */}
      <Card className="border-0 shadow-lg mb-6">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">🚀</span>
            <h3 className="text-lg font-semibold text-ghana-black">Quick Actions</h3>
          </div>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">

            <Button
              color="warning"
              variant="flat"
              className="h-24 flex flex-col items-center justify-center gap-2 p-4"
              onClick={() => handleQuickAction('book_venue')}
            >
              <span className="text-2xl">🏢</span>
              <span className="font-medium">Book Venue</span>
              <span className="text-xs text-center opacity-80">Reserve venue space</span>
            </Button>
            <Button
              color="danger"
              variant="flat"
              className="h-24 flex flex-col items-center justify-center gap-2 p-4"
              onClick={() => handleQuickAction('catering')}
            >
              <span className="text-2xl">🍽️</span>
              <span className="font-medium">Catering</span>
              <span className="text-xs text-center opacity-80">Arrange food services</span>
            </Button>
            <Button
              color="primary"
              variant="flat"
              className="h-24 flex flex-col items-center justify-center gap-2 p-4"
              onClick={() => handleQuickAction('event_reports')}
            >
              <span className="text-2xl">📊</span>
              <span className="font-medium">Event Reports</span>
              <span className="text-xs text-center opacity-80">Generate event reports</span>
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Main Operations Interface */}
      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-3">
          <h3 className="text-xl font-semibold text-ghana-black">📊 Operations Overview</h3>
        </CardHeader>
        <CardBody>
          <Tabs 
            selectedKey={selectedTab} 
            onSelectionChange={(key) => setSelectedTab(key as string)}
            className="w-full"
            aria-label="Events and conferences operations"
          >
            <Tab key="overview" title="📊 Overview">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-4">
                {operationalItems.map((category, categoryIndex) => (
                  <Card key={categoryIndex} className="border border-gray-200 shadow-md">
                    <CardHeader className="pb-3">
                      <h4 className="text-lg font-semibold text-ghana-black">{category.category}</h4>
                    </CardHeader>
                    <CardBody className="pt-0">
                      <div className="space-y-3">
                        {category.items.map((item, itemIndex) => (
                          <div 
                            key={itemIndex}
                            className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-ghana-gold/10 cursor-pointer transition-colors"
                            onClick={() => {
                              // Handle navigation based on item type
                              if (item.title.includes('Event Calendar') || item.title.includes('Active Events')) {
                                setSelectedTab('events');
                              } else if (item.title.includes('Conference Halls') || item.title.includes('Meeting Rooms')) {
                                setSelectedTab('venues');
                              } else if (item.title.includes('Catering Services') || item.title.includes('Audio Visual')) {
                                setSelectedTab('services');
                              } else if (item.title.includes('Setup in Progress') || item.title.includes('Operations')) {
                                setSelectedTab('operations');
                              } else if (item.title.includes('Event Reports') || item.title.includes('Revenue Tracking')) {
                                setSelectedTab('reports');
                              }
                            }}
                          >
                            <div className="flex items-center space-x-3">
                              <span className="text-xl">{item.icon}</span>
                              <div>
                                <div className="flex items-center">
                                  <InfoIcon description={item.description} />
                                  <p className="font-medium text-ghana-black">{item.title}</p>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Badge 
                                color={item.status === 'active' ? 'success' : item.status === 'warning' ? 'warning' : 'default'}
                                variant="flat"
                              >
                                {item.status}
                              </Badge>
                              <Chip size="sm" variant="flat" color="primary">
                                {item.count}
                              </Chip>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardBody>
                  </Card>
                ))}
              </div>
            </Tab>

            <Tab key="events" title="📅 Event Management">
              <div className="space-y-6 mt-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-semibold text-ghana-black">Dynamic Event Management & Prevention System</h3>
                  <div className="flex gap-2">
                    <Button 
                      color="primary" 
                      variant="flat"
                      onClick={() => {
                        setEditingEvent({});
                        setIsEventModalOpen(true);
                      }}
                    >
                      ➕ New Event
                    </Button>
                    <Button 
                      color="warning" 
                      variant="flat"
                      onClick={() => {
                        // Open BEO selector modal or use first event as example
                        const firstEvent = allEvents[0];
                        if (firstEvent) {
                          setSelectedEventForBEO(firstEvent);
                          generateBEO(firstEvent);
                          setIsBEOModalOpen(true);
                        }
                      }}
                    >
                      📊 Generate BEO
                    </Button>
                    <Button 
                      color="success" 
                      variant="flat"
                      onClick={() => {
                        // Open Function Sheet selector modal or use first event as example
                        const firstEvent = allEvents[0];
                        if (firstEvent) {
                          setSelectedEventForFunctionSheet(firstEvent);
                          generateFunctionSheet(firstEvent);
                          setIsFunctionSheetModalOpen(true);
                        }
                      }}
                    >
                      📋 Function Sheets
                    </Button>
                  </div>
                </div>

                {/* Ghanaian Business Process Status Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <Card className="border border-gray-200">
                    <CardBody className="p-4 text-center">
                      <div className="text-2xl mb-2">📞</div>
                      <p className="text-sm font-medium text-gray-600">Inquiries</p>
                      <p className="text-xl font-bold text-blue-600">8</p>
                    </CardBody>
                  </Card>
                  <Card className="border border-gray-200">
                    <CardBody className="p-4 text-center">
                      <div className="text-2xl mb-2">📝</div>
                      <p className="text-sm font-medium text-gray-600">Quotes Sent</p>
                      <p className="text-xl font-bold text-yellow-600">5</p>
                    </CardBody>
                  </Card>
                  <Card className="border border-gray-200">
                    <CardBody className="p-4 text-center">
                      <div className="text-2xl mb-2">✍️</div>
                      <p className="text-sm font-medium text-gray-600">Contracts Signed</p>
                      <p className="text-xl font-bold text-green-600">3</p>
                    </CardBody>
                  </Card>
                  <Card className="border border-gray-200">
                    <CardBody className="p-4 text-center">
                      <div className="text-2xl mb-2">💰</div>
                      <p className="text-sm font-medium text-gray-600">Deposits Paid</p>
                      <p className="text-xl font-bold text-purple-600">2</p>
                    </CardBody>
                  </Card>
                </div>

                {/* Real-Time Clash Prevention Dashboard */}
                <Card className="border border-orange-200 bg-orange-50">
                  <CardBody className="p-3">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold text-orange-800 text-sm">🚨 Real-Time Clash Prevention System</h4>
                      <Tooltip
                        content={
                          <div className="p-2 max-w-xs">
                            <p className="text-sm">
                              <strong>Active Monitoring:</strong> The system is actively preventing double-bookings and resource conflicts. 
                              All new bookings are automatically checked against existing events.
                            </p>
                          </div>
                        }
                        placement="top"
                      >
                        <Button
                          size="sm"
                          color="warning"
                          variant="flat"
                          className="flex items-center gap-1 px-2 py-1"
                        >
                          <span className="text-xs">⚠️</span>
                          <span className="text-xs">Status</span>
                        </Button>
                      </Tooltip>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="text-center">
                        <div className="text-lg">⚠️</div>
                        <p className="text-xs font-medium text-orange-700">Conflicts</p>
                        <p className="text-base font-bold text-orange-800">2</p>
                      </div>
                      <div className="text-center">
                        <div className="text-lg">🏨</div>
                        <p className="text-xs font-medium text-orange-700">Rooms</p>
                        <p className="text-base font-bold text-orange-800">1</p>
                      </div>
                      <div className="text-center">
                        <div className="text-lg">🍽️</div>
                        <p className="text-xs font-medium text-orange-700">Kitchen</p>
                        <p className="text-base font-bold text-orange-800">1</p>
                      </div>
                    </div>
                  </CardBody>
                </Card>

                {/* View Toggle and Content */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold">Event Views</h4>
                      <div className="flex items-center gap-4">
                        <Select 
                          label="View Mode" 
                          placeholder="Select view" 
                          selectedKeys={[eventViewMode]}
                          onSelectionChange={(keys) => setEventViewMode(Array.from(keys)[0] as string)}
                          className="w-48"
                        >
                          <SelectItem key="table">📋 Table View</SelectItem>
                          <SelectItem key="calendar">📅 Calendar View</SelectItem>
                          <SelectItem key="gantt">📊 Gantt Chart</SelectItem>
                          <SelectItem key="function">📋 Function View</SelectItem>
                        </Select>

                      </div>
                    </div>
                  </CardHeader>
                  <CardBody>
                    {/* Table View */}
                    {eventViewMode === 'table' && (
                      <div>
                        {/* Search and Filter Controls */}
                        <div className="mb-6 space-y-4">
                          {/* Search Bar */}
                          <div className="flex gap-4">
                            <Input
                              placeholder="Search events, organizations, venues..."
                              value={searchTerm}
                              onChange={(e) => setSearchTerm(e.target.value)}
                              className="flex-1"
                              startContent={<span className="text-gray-400">🔍</span>}
                            />
                            <Button 
                              color="secondary" 
                              variant="flat"
                              onPress={() => {
                                setSearchTerm('');
                                setDateRange({ startDate: '', endDate: '' });
                                setProgrammeTypeFilter('all');
                              }}
                            >
                              Clear Filters
                            </Button>
                          </div>
                          
                          {/* Date Range and Programme Type Filters */}
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <Input
                              type="date"
                              label="Start Date"
                              value={dateRange.startDate}
                              onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                              placeholder="Programme start date"
                            />
                            <Input
                              type="date"
                              label="End Date"
                              value={dateRange.endDate}
                              onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                              placeholder="Programme end date"
                            />
                            <Select
                              label="Programme Type"
                              placeholder="All types"
                              selectedKeys={[programmeTypeFilter]}
                              onSelectionChange={(keys) => setProgrammeTypeFilter(Array.from(keys)[0] as string)}
                            >
                              <SelectItem key="all">All Types</SelectItem>
                              <SelectItem key="residential-conference">Residential Conference</SelectItem>
                              <SelectItem key="non-residential">Non-Residential</SelectItem>
                              <SelectItem key="workshop">Workshop</SelectItem>
                              <SelectItem key="training">Training</SelectItem>
                              <SelectItem key="wedding">Wedding</SelectItem>
                              <SelectItem key="banquet">Banquet</SelectItem>
                              <SelectItem key="meeting">Meeting</SelectItem>
                              <SelectItem key="launch">Product Launch</SelectItem>
                            </Select>
                          </div>
                          
                          {/* Results Summary */}
                          <div className="text-sm text-gray-600">
                            Showing {getFilteredAndSortedEvents().length} of {allEvents.length} events
                          </div>
                        </div>
                        
                        <Table aria-label="Events table">
                          <TableHeader>
                            <TableColumn>Event</TableColumn>
                            <TableColumn>Venue</TableColumn>
                            <TableColumn>Date & Time</TableColumn>
                            <TableColumn>Attendees</TableColumn>
                            <TableColumn>Process Status</TableColumn>
                            <TableColumn>Financial Status</TableColumn>
                            <TableColumn>Actions</TableColumn>
                          </TableHeader>
                          <TableBody>
                            {getFilteredAndSortedEvents().map((event) => (
                              <TableRow key={event.id}>
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    <span className="text-lg">{getEventTypeIcon(event.eventType)}</span>
                                    <div>
                                      <p className="font-medium">{event.eventName}</p>
                                      <p className="text-sm text-gray-600">{event.organization}</p>
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <Badge color="primary" variant="flat">{event.venueName}</Badge>
                                </TableCell>
                                <TableCell>
                                  <div>
                                    <p className="font-medium">{event.arrivalDate}</p>
                                    <p className="text-sm text-gray-600">{event.duration} days</p>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <Chip size="sm" variant="flat" color="primary">
                                    {event.pax}
                                  </Chip>
                                </TableCell>
                                <TableCell>
                                  <div className="space-y-1">
                                    <Badge color={event.statusColor as any} variant="flat">
                                      {eventStatuses[event.status as keyof typeof eventStatuses]?.label || event.status}
                                    </Badge>
                                    <div className="text-xs text-gray-600">
                                      {event.status === 'confirmed' ? 'Contract Signed' : 
                                       event.status === 'awaiting-confirmation' ? 'Quote Sent' : 'Inquiry'}
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="space-y-1">
                                    <span className="font-medium">₵{event.revenue.toLocaleString()}</span>
                                    <div className="text-xs text-gray-600">
                                      {event.status === 'confirmed' ? 'Deposit: ₵' + event.deposit.toLocaleString() : 'Quote'}
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="flex gap-2">
                                    <Button 
                                      size="sm" 
                                      color="primary" 
                                      variant="flat"
                                      onClick={() => {
                                        setEditingEvent(event);
                                        setIsEventModalOpen(true);
                                      }}
                                    >
                                      Edit
                                    </Button>
                                    <Button 
                                      size="sm" 
                                      color="secondary" 
                                      variant="flat"
                                      onClick={() => {
                                        setSelectedEventForBEO(event);
                                        generateBEO(event);
                                        setIsBEOModalOpen(true);
                                      }}
                                    >
                                      📋 BEO
                                    </Button>
                                    <Button 
                                      size="sm" 
                                      color="success" 
                                      variant="flat"
                                      onClick={() => {
                                        setSelectedEventForFunctionSheet(event);
                                        generateFunctionSheet(event);
                                        setIsFunctionSheetModalOpen(true);
                                      }}
                                    >
                                      📋 Sheet
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}

                    {/* Calendar View */}
                    {eventViewMode === 'calendar' && (
                      <div>
                        <div className="flex items-center justify-between mb-4">
                          <h5 className="font-semibold">📅 Dynamic Event Calendar - August 2025</h5>
                          <div className="flex gap-2">
                            <Button size="sm" color="primary" variant="flat">📅 Month View</Button>
                            <Button size="sm" color="secondary" variant="flat">📅 Week View</Button>
                            <Button size="sm" color="success" variant="flat">📅 Day View</Button>
                          </div>
                        </div>
                        {/* Calendar Grid */}
                        <div className="grid grid-cols-7 gap-2 mb-4">
                          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                            <div key={day} className="text-center font-medium text-gray-600 p-2">
                              {day}
                            </div>
                          ))}
                          
                          {/* Calendar Days with Events */}
                          {Array.from({ length: 31 }, (_, i) => {
                            const day = i + 1;
                            const date = `2025-08-${day.toString().padStart(2, '0')}`;
                            const dayEvents = getEventsForDateRange(date, date);
                            
                            return (
                              <div key={day} className="min-h-[80px] border border-gray-200 p-2 relative">
                                <span className="text-sm font-medium">{day}</span>
                                {dayEvents.map((event, index) => (
                                  <div
                                    key={index}
                                    className={`mt-1 p-1 text-xs rounded cursor-pointer ${
                                      eventStatuses[event.status as keyof typeof eventStatuses]?.bgColor || 'bg-gray-100'
                                    } ${
                                      eventStatuses[event.status as keyof typeof eventStatuses]?.borderColor || 'border-gray-200'
                                    } border`}
                                    onClick={() => {
                                      setEditingEvent(event);
                                      setIsEventModalOpen(true);
                                    }}
                                  >
                                    <div className="font-medium truncate">{event.organization}</div>
                                    <div className="text-xs truncate">{event.eventName}</div>
                                    <Badge 
                                      size="sm" 
                                      color={eventStatuses[event.status as keyof typeof eventStatuses]?.color as any} 
                                      variant="flat"
                                    >
                                      {eventStatuses[event.status as keyof typeof eventStatuses]?.label || event.status}
                                    </Badge>
                                  </div>
                                ))}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Gantt Chart View */}
                    {eventViewMode === 'gantt' && (
                      <div>
                        <div className="flex items-center justify-between mb-4">
                          <h5 className="font-semibold">📊 Gantt Chart - Venue Timeline</h5>
                          <Select label="Select Venue" placeholder="Choose venue" className="w-48">
                            {modernVenues.map(venue => (
                              <SelectItem key={venue.id}>
                                {venue.name}
                              </SelectItem>
                            ))}
                          </Select>
                        </div>
                        {/* Gantt Chart Visualization */}
                        <div className="space-y-4">
                          {modernVenues.map(venue => (
                            <div key={venue.id} className="border border-gray-200 rounded-lg p-4">
                              <h5 className="font-semibold mb-3">{venue.name}</h5>
                              <div className="relative h-16 bg-gray-50 rounded">
                                {/* Timeline bars */}
                                {getEventsForVenue(venue.id).map((event, index) => {
                                  const startDate = new Date(event.arrivalDate);
                                  const endDate = new Date(event.departureDate);
                                  const monthStart = new Date('2025-08-01');
                                  const monthEnd = new Date('2025-08-31');
                                  
                                  // Calculate position and width
                                  const totalDays = (monthEnd.getTime() - monthStart.getTime()) / (1000 * 60 * 60 * 24);
                                  const startOffset = (startDate.getTime() - monthStart.getTime()) / (1000 * 60 * 60 * 24);
                                  const duration = event.duration;
                                  
                                  const left = `${(startOffset / totalDays) * 100}%`;
                                  const width = `${(duration / totalDays) * 100}%`;
                                  
                                  return (
                                    <Tooltip
                                      key={event.id}
                                      content={
                                        <div className="p-2">
                                          <p><strong>{event.organization}</strong></p>
                                          <p>{event.eventName}</p>
                                          <p>Duration: {event.duration} days</p>
                                          <p>Pax: {event.pax}</p>
                                          <p>Status: {eventStatuses[event.status as keyof typeof eventStatuses]?.label}</p>
                                        </div>
                                      }
                                    >
                                      <div
                                        className={`absolute top-2 h-8 rounded cursor-pointer ${
                                          eventStatuses[event.status as keyof typeof eventStatuses]?.bgColor || 'bg-gray-300'
                                        } ${
                                          eventStatuses[event.status as keyof typeof eventStatuses]?.borderColor || 'border-gray-400'
                                        } border`}
                                        style={{ left, width }}
                                        onClick={() => {
                                          setEditingEvent(event);
                                          setIsEventModalOpen(true);
                                        }}
                                      >
                                        <div className="px-2 py-1 text-xs font-medium text-white truncate">
                                          {event.organization}
                                        </div>
                                      </div>
                                    </Tooltip>
                                  );
                                })}
                                
                                {/* Date markers */}
                                {Array.from({ length: 31 }, (_, i) => {
                                  const day = i + 1;
                                  const date = new Date(2025, 7, day);
                                  const position = ((day - 1) / 30) * 100;
                                  
                                  return (
                                    <div
                                      key={day}
                                      className="absolute top-0 bottom-0 w-px bg-gray-300"
                                      style={{ left: `${position}%` }}
                                    >
                                      <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 text-xs text-gray-500">
                                        {day}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Function View */}
                    {eventViewMode === 'function' && (
                      <div>
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
                          <h5 className="font-semibold text-lg sm:text-xl">📋 Provisional Function Schedule - August 2025</h5>
                          <div className="flex flex-wrap gap-2">
                            <Button 
                              size="sm" 
                              color="primary" 
                              variant="flat"
                              className="flex-1 sm:flex-none min-w-[120px]"
                              onPress={() => exportFunctionSchedulePDF()}
                            >
                              📄 Export PDF
                            </Button>
                            <Button 
                              size="sm" 
                              color="secondary" 
                              variant="flat"
                              className="flex-1 sm:flex-none min-w-[120px]"
                              onPress={() => downloadFunctionScheduleCSV()}
                            >
                              📊 Download CSV
                            </Button>
                            <Button 
                              size="sm" 
                              color="success" 
                              variant="flat"
                              className="flex-1 sm:flex-none min-w-[120px]"
                              onPress={() => shareToDepartments()}
                            >
                              📧 Send to Departments
                            </Button>
                            <Button 
                              size="sm" 
                              color="warning" 
                              variant="flat"
                              className="flex-1 sm:flex-none min-w-[120px]"
                              onPress={() => printFunctionSchedule()}
                            >
                              🖨️ Print Schedule
                            </Button>
                          </div>
                        </div>
                        
                        {/* Live Data Status */}
                        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                          <div className="flex items-center gap-2">
                            <span className="text-blue-600">📊</span>
                            <span className="text-sm text-blue-800">
                              <strong>Live Data:</strong> {allEvents.length} events loaded • Last updated: {new Date().toLocaleTimeString()}
                            </span>
                          </div>
                        </div>
                        
                        {/* Function Schedule Table */}
                        <div className="overflow-x-auto">
                          <Table aria-label="Function schedule table" className="min-w-full">
                            <TableHeader>
                              <TableColumn>ITEM</TableColumn>
                              <TableColumn>ARRIVAL DATE</TableColumn>
                              <TableColumn>DEPARTURE DATE</TableColumn>
                              <TableColumn>ORGANIZATION</TableColumn>
                              <TableColumn>PROG TYPE</TableColumn>
                              <TableColumn>NO. OF PAX</TableColumn>
                              <TableColumn>NO. OF RMS</TableColumn>
                              <TableColumn>ROOM NIGHTS</TableColumn>
                              <TableColumn>CONFERENCE DAYS</TableColumn>
                              <TableColumn>EVENT VENUE</TableColumn>
                              <TableColumn>FOOD & BEVERAGE</TableColumn>
                              <TableColumn>HOUSEKEEPING/FRONT DESK</TableColumn>
                              <TableColumn>RESERVATION STATUS</TableColumn>
                            </TableHeader>
                                                        <TableBody>
                              {allEvents.length > 0 ? (
                                allEvents.map((event, index) => {
                                  const arrivalDate = new Date(event.arrivalDate);
                                  const departureDate = new Date(event.departureDate);
                                  const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
                                  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
                                  
                                  const formatDate = (date: Date) => {
                                    const dayName = dayNames[date.getDay()];
                                    const day = date.getDate();
                                    const month = months[date.getMonth()];
                                    return `${dayName} ${day}${getDaySuffix(day)} ${month}`;
                                  };
                                  
                                  const getDaySuffix = (day: number) => {
                                    if (day >= 11 && day <= 13) return 'TH';
                                    switch (day % 10) {
                                      case 1: return 'ST';
                                      case 2: return 'ND';
                                      case 3: return 'RD';
                                      default: return 'TH';
                                    }
                                  };
                                  
                                  const getEventTypeLabel = (type: string) => {
                                    switch (type) {
                                      case 'conference': return 'RESIDENTIAL CONFERENCE';
                                      case 'workshop': return 'RESIDENTIAL WORKSHOP';
                                      case 'training': return 'NON RESIDENTIAL CONFERENCE';
                                      case 'residential-conference': return 'RESIDENTIAL CONFERENCE';
                                      case 'non-residential': return 'NON RESIDENTIAL CONFERENCE';
                                      case 'residential-workshop': return 'RESIDENTIAL WORKSHOP';
                                      case 'residential': return 'RESIDENTIAL CONFERENCE';
                                      default: return 'CONFERENCE';
                                    }
                                  };
                                  
                                  const getFoodBeverageServices = (event: any) => {
                                    const services = [];
                                    if (event.duration > 0) services.push('ARRIVAL DINNER');
                                    if (event.duration > 1) {
                                      services.push('MORNING SNACK', 'LUNCH');
                                      if (event.duration > 2) services.push('AFTERNOON SNACK', 'DINNER');
                                    }
                                    return services.join(', ');
                                  };
                                  
                                  const getHousekeepingNotes = (event: any) => {
                                    if (event.residential) {
                                      return `PREPARE ${event.pax} ROOMS`;
                                    }
                                    return 'N/A';
                                  };
                                  
                                  const getStatusBadge = (status: string) => {
                                    switch (status) {
                                      case 'confirmed':
                                        return <Badge color="success" variant="flat">CONFIRMED</Badge>;
                                      case 'awaiting-confirmation':
                                        return <Badge color="warning" variant="flat">AWAITING CONFIRMATION</Badge>;
                                      case 'on-hold':
                                        return <Badge color="secondary" variant="flat">ON HOLD</Badge>;
                                      default:
                                        return <Badge color="default" variant="flat">{status.toUpperCase()}</Badge>;
                                    }
                                  };
                                  
                                  return (
                                    <TableRow key={event.id} className="hover:bg-gray-50 cursor-pointer">
                                      <TableCell className="text-center font-medium">{index + 1}</TableCell>
                                      <TableCell className="text-center">
                                        <div className="font-medium">{formatDate(arrivalDate)}</div>
                                      </TableCell>
                                      <TableCell className="text-center">
                                        <div className="font-medium">{formatDate(departureDate)}</div>
                                      </TableCell>
                                      <TableCell>
                                        <div>
                                          <p className="font-medium">{event.organization}</p>
                                          <p className="text-xs text-gray-600">{event.eventName}</p>
                                        </div>
                                      </TableCell>
                                      <TableCell className="text-center">
                                        <Badge color="primary" variant="flat" className="text-xs">
                                          {getEventTypeLabel(event.eventType)}
                                        </Badge>
                                      </TableCell>
                                      <TableCell className="text-center font-medium">{event.pax}</TableCell>
                                      <TableCell className="text-center">
                                        {event.residential ? event.pax : 'N/A'}
                                      </TableCell>
                                      <TableCell className="text-center">
                                        {event.residential ? event.duration * event.pax : 'N/A'}
                                      </TableCell>
                                      <TableCell className="text-center font-medium">{event.duration}</TableCell>
                                      <TableCell>
                                        <Badge color="secondary" variant="flat">{event.venueName}</Badge>
                                      </TableCell>
                                      <TableCell className="max-w-xs">
                                        <div className="text-xs text-gray-700">
                                          {getFoodBeverageServices(event)}
                                        </div>
                                      </TableCell>
                                      <TableCell className="max-w-xs">
                                        <div className="text-xs text-gray-700">
                                          {getHousekeepingNotes(event)}
                                        </div>
                                      </TableCell>
                                      <TableCell className="text-center">
                                        {getStatusBadge(event.status)}
                                      </TableCell>
                                    </TableRow>
                                  );
                                })
                              ) : (
                                <TableRow>
                                  <TableCell colSpan={13} className="text-center py-8">
                                    <div className="text-gray-500">
                                      <div className="text-2xl mb-2">📅</div>
                                      <p>No events found</p>
                                      <p className="text-sm">Events will appear here when added to the system</p>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              )}
                            </TableBody>
                          </Table>
                        </div>
                        
                        {/* Summary Statistics */}
                        <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
                          <Card className="border border-blue-200 bg-blue-50">
                            <CardBody className="p-3 text-center">
                              <div className="text-lg font-bold text-blue-800">
                                {allEvents.length}
                              </div>
                              <div className="text-sm text-blue-600">Total Functions</div>
                            </CardBody>
                          </Card>
                          <Card className="border border-green-200 bg-green-50">
                            <CardBody className="p-3 text-center">
                              <div className="text-lg font-bold text-green-800">
                                {allEvents.filter(e => e.status === 'confirmed').length}
                              </div>
                              <div className="text-sm text-green-600">Confirmed</div>
                            </CardBody>
                          </Card>
                          <Card className="border border-yellow-200 bg-yellow-50">
                            <CardBody className="p-3 text-center">
                              <div className="text-sm font-bold text-yellow-800">
                                {allEvents.filter(e => e.status === 'awaiting-confirmation').length}
                              </div>
                              <div className="text-sm text-yellow-600">Pending</div>
                            </CardBody>
                          </Card>
                          <Card className="border border-purple-200 bg-purple-50">
                            <CardBody className="p-3 text-center">
                              <div className="text-lg font-bold text-purple-800">
                                {allEvents.reduce((sum, e) => sum + e.pax, 0)}
                              </div>
                              <div className="text-sm text-purple-600">Total Attendees</div>
                            </CardBody>
                          </Card>
                        </div>
                      </div>
                    )}
                  </CardBody>
                </Card>

                {/* Event Management Tools */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <h4 className="font-semibold">🔍 Quick Filters & Search</h4>
                    </CardHeader>
                    <CardBody>
                      <div className="space-y-3">
                        <Select label="Filter by Status" placeholder="All statuses">
                          {Object.entries(eventStatuses).map(([key, status]) => (
                            <SelectItem key={key}>
                              {status.label}
                            </SelectItem>
                          ))}
                        </Select>
                        <Select label="Filter by Venue" placeholder="All venues">
                          {modernVenues.map(venue => (
                            <SelectItem key={venue.id}>
                              {venue.name}
                            </SelectItem>
                          ))}
                        </Select>
                        <Select label="Filter by Organization" placeholder="All organizations">
                          {Array.from(new Set(allEvents.map(e => e.organization))).map(org => (
                            <SelectItem key={org}>
                              {org}
                            </SelectItem>
                          ))}
                        </Select>
                        <Button color="primary" variant="flat" className="w-full">
                          🔍 Apply Filters
                        </Button>
                      </div>
                    </CardBody>
                  </Card>
                  
                  <Card>
                    <CardHeader>
                      <h4 className="font-semibold">📋 Management Actions</h4>
                    </CardHeader>
                    <CardBody>
                      <div className="space-y-3">
                        <Button color="warning" variant="flat" className="w-full">
                          📊 Generate Reports
                        </Button>
                        <Button color="secondary" variant="flat" className="w-full">
                          📧 Send Follow-ups
                        </Button>
                        <Button color="success" variant="flat" className="w-full">
                          💰 Track Payments
                        </Button>
                        <Button color="primary" variant="flat" className="w-full">
                          📅 Sync Calendar
                        </Button>
                      </div>
                    </CardBody>
                  </Card>
                </div>
              </div>
            </Tab>

            <Tab key="venues" title="🏢 Venue Management">
              <div className="space-y-6 mt-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-semibold text-ghana-black">Venue Management</h3>
                  <Button 
                    color="success" 
                    variant="solid"
                    onClick={() => {
                      setEditingVenue({});
                      setIsVenueModalOpen(true);
                    }}
                  >
                    ➕ New Venue
                  </Button>
                </div>

                {/* Venues Table */}
                <Card>
                  <CardHeader>
                    <h4 className="font-semibold">All Venues</h4>
                  </CardHeader>
                  <CardBody>
                    <Table aria-label="Venues table">
                      <TableHeader>
                        <TableColumn>Venue</TableColumn>
                        <TableColumn>Type</TableColumn>
                        <TableColumn>Capacity</TableColumn>
                        <TableColumn>Price/Day</TableColumn>
                        <TableColumn>Status</TableColumn>
                        <TableColumn>Features</TableColumn>
                        <TableColumn>Actions</TableColumn>
                      </TableHeader>
                      <TableBody>
                        {venues.map((venue) => (
                          <TableRow key={venue.id}>
                            <TableCell>
                              <div>
                                <p className="font-medium">{venue.name}</p>
                                <p className="text-sm text-gray-600">{venue.location}</p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge color="primary" variant="flat">{venue.type}</Badge>
                            </TableCell>
                            <TableCell>
                              <Chip size="sm" variant="flat" color="primary">
                                {venue.capacity} people
                              </Chip>
                            </TableCell>
                            <TableCell>
                              <span className="font-medium">₵{venue.price.toLocaleString()}</span>
                            </TableCell>
                            <TableCell>
                              <Badge color={getStatusColor(venue.status) as any} variant="flat">
                                {venue.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {venue.features.slice(0, 2).map((feature, index) => (
                                  <Chip key={index} size="sm" variant="flat" color="secondary">
                                    {feature}
                                  </Chip>
                                ))}
                                {venue.features.length > 2 && (
                                  <Chip size="sm" variant="flat" color="default">
                                    +{venue.features.length - 2} more
                                  </Chip>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button 
                                  size="sm" 
                                  color="primary" 
                                  variant="flat"
                                  onClick={() => {
                                    setEditingVenue(venue);
                                    setIsVenueModalOpen(true);
                                  }}
                                >
                                  Edit
                                </Button>
                                <Button size="sm" color="warning" variant="flat">
                                  Book
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardBody>
                </Card>
              </div>
            </Tab>

            <Tab key="services" title="🍽️ Services & Amenities">
              <div className="space-y-6 mt-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-semibold text-ghana-black">Services & Amenities</h3>
                  <Button 
                    color="success" 
                    variant="solid"
                    onClick={() => {
                      setEditingService({});
                      setIsServiceModalOpen(true);
                    }}
                  >
                    ➕ New Service
                  </Button>
                </div>

                {/* Services Table */}
                <Card>
                  <CardHeader>
                    <h4 className="font-semibold">All Services</h4>
                  </CardHeader>
                  <CardBody>
                    <Table aria-label="Services table">
                      <TableHeader>
                        <TableColumn>Service</TableColumn>
                        <TableColumn>Category</TableColumn>
                        <TableColumn>Price</TableColumn>
                        <TableColumn>Status</TableColumn>
                        <TableColumn>Availability</TableColumn>
                        <TableColumn>Actions</TableColumn>
                      </TableHeader>
                      <TableBody>
                        {services.map((service) => (
                          <TableRow key={service.id}>
                            <TableCell>
                              <div>
                                <p className="font-medium">{service.name}</p>
                                <p className="text-sm text-gray-600">{service.description}</p>
                              </div>
                            </TableCell>
                                                          <TableCell>
                                <Badge color="primary" variant="flat">{service.type}</Badge>
                              </TableCell>
                            <TableCell>
                              <span className="font-medium">₵{service.price.toLocaleString()}</span>
                            </TableCell>
                            <TableCell>
                              <Badge color={getStatusColor(service.status) as any} variant="flat">
                                {service.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div>
                                <p className="font-medium">Available</p>
                                <p className="text-sm text-gray-600">Min: 24h</p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button 
                                  size="sm" 
                                  color="primary" 
                                  variant="flat"
                                  onClick={() => {
                                    setEditingService(service);
                                    setIsServiceModalOpen(true);
                                  }}
                                >
                                  Edit
                                </Button>
                                <Button size="sm" color="warning" variant="flat">
                                  Configure
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardBody>
                </Card>
              </div>
            </Tab>

            <Tab key="operations" title="🔧 Operations & Setup">
              <div className="space-y-6 mt-4">
                <h3 className="text-xl font-semibold text-ghana-black">Operations & Setup</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <h4 className="font-semibold">Setup Status</h4>
                    </CardHeader>
                    <CardBody>
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span>Setup in Progress:</span>
                          <Badge color="warning">{setupInProgress}</Badge>
                        </div>
                        <div className="flex justify-between">
                          <span>Events Today:</span>
                          <Badge color="primary">{eventsToday}</Badge>
                        </div>
                        <div className="flex justify-between">
                          <span>Completed Today:</span>
                          <Badge color="success">{eventsCompleted}</Badge>
                        </div>
                        <div className="flex justify-between">
                          <span>New Bookings:</span>
                          <Badge color="primary">{newBookings}</Badge>
                        </div>
                      </div>
                    </CardBody>
                  </Card>
                  <Card>
                    <CardHeader>
                      <h4 className="font-semibold">Quick Actions</h4>
                    </CardHeader>
                    <CardBody>
                      <div className="space-y-3">
                        <Button color="primary" variant="flat" className="w-full">
                          🔧 Start Setup
                        </Button>
                        <Button color="secondary" variant="flat" className="w-full">
                          📊 Setup Reports
                        </Button>
                        <Button color="success" variant="flat" className="w-full">
                          ✅ Complete Setup
                        </Button>
                      </div>
                    </CardBody>
                  </Card>
                </div>
              </div>
            </Tab>

            <Tab key="workflow" title="🔄 Business Workflow">
              <div className="space-y-6 mt-4">
                <h3 className="text-xl font-semibold text-ghana-black">Ghanaian Business Process Workflow</h3>
                
                {/* Workflow Stages */}
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  <Card className="border border-blue-200 bg-blue-50">
                    <CardBody className="p-4 text-center">
                      <div className="text-3xl mb-2">📞</div>
                      <h4 className="font-semibold text-blue-800">Phase 1: Inquiry</h4>
                      <p className="text-sm text-blue-600 mb-2">Client Contact</p>
                      <Badge color="primary" variant="flat">8 Active</Badge>
                    </CardBody>
                  </Card>
                  
                  <Card className="border border-yellow-200 bg-yellow-50">
                    <CardBody className="p-4 text-center">
                      <div className="text-3xl mb-2">📝</div>
                      <h4 className="font-semibold text-yellow-800">Phase 2: Quote</h4>
                      <p className="text-sm text-yellow-600 mb-2">Proposal Sent</p>
                      <Badge color="warning" variant="flat">5 Pending</Badge>
                    </CardBody>
                  </Card>
                  
                  <Card className="border border-orange-200 bg-orange-50">
                    <CardBody className="p-4 text-center">
                      <div className="text-3xl mb-2">✍️</div>
                      <h4 className="font-semibold text-orange-800">Phase 3: Contract</h4>
                      <p className="text-sm text-orange-600 mb-2">Negotiation</p>
                      <Badge color="warning" variant="flat">3 Active</Badge>
                    </CardBody>
                  </Card>
                  
                  <Card className="border border-green-200 bg-green-50">
                    <CardBody className="p-4 text-center">
                      <div className="text-3xl mb-2">💰</div>
                      <h4 className="font-semibold text-green-800">Phase 4: Deposit</h4>
                      <p className="text-sm text-green-600 mb-2">50% Payment</p>
                      <Badge color="success" variant="flat">2 Paid</Badge>
                    </CardBody>
                  </Card>
                  
                  <Card className="border border-purple-200 bg-purple-50">
                    <CardBody className="p-4 text-center">
                      <div className="text-3xl mb-2">🎉</div>
                      <h4 className="font-semibold text-purple-800">Phase 5: Event</h4>
                      <p className="text-sm text-purple-600 mb-2">Execution</p>
                      <Badge color="primary" variant="flat">1 Ready</Badge>
                    </CardBody>
                  </Card>
                </div>

                {/* Process Management Tools */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <h4 className="font-semibold">📋 Document Management</h4>
                    </CardHeader>
                    <CardBody>
                      <div className="space-y-3">
                        <Button color="success" variant="flat" className="w-full">
                          🖨️ Print Documents
                        </Button>
                        <Button color="warning" variant="flat" className="w-full">
                          📧 Send to Departments
                        </Button>
                        <Button color="primary" variant="flat" className="w-full">
                          📊 Generate Reports
                        </Button>
                        <Button color="secondary" variant="flat" className="w-full">
                          📁 Archive Files
                        </Button>
                      </div>
                    </CardBody>
                  </Card>
                  
                  <Card>
                    <CardHeader>
                      <h4 className="font-semibold">💰 Financial Management</h4>
                    </CardHeader>
                    <CardBody>
                      <div className="space-y-3">
                        <Button color="primary" variant="flat" className="w-full">
                          💳 Track Deposits
                        </Button>
                        <Button color="secondary" variant="flat" className="w-full">
                          📊 Generate Invoices
                        </Button>
                        <Button color="success" variant="flat" className="w-full">
                          💰 Process Payments
                        </Button>
                        <Button color="warning" variant="flat" className="w-full">
                          📈 Revenue Reports
                        </Button>
                      </div>
                    </CardBody>
                  </Card>
                </div>

                {/* Communication Log */}
                <Card>
                  <CardHeader>
                    <h4 className="font-semibold">📞 Communication & Follow-up</h4>
                  </CardHeader>
                  <CardBody>
                    <div className="space-y-4">
                      <div className="flex items-center gap-4">
                        <Badge color="warning" variant="flat">Today</Badge>
                        <span className="text-sm text-gray-600">Follow up on 3 pending quotes</span>
                        <Button size="sm" color="primary" variant="flat">Action</Button>
                      </div>
                      <div className="flex items-center gap-4">
                        <Badge color="success" variant="flat">Tomorrow</Badge>
                        <span className="text-sm text-gray-600">Send contracts to 2 confirmed events</span>
                        <Button size="sm" color="primary" variant="flat">Action</Button>
                      </div>
                      <div className="flex items-center gap-4">
                        <Badge color="danger" variant="flat">This Week</Badge>
                        <span className="text-sm text-gray-600">Collect deposits for 1 confirmed event</span>
                        <Button size="sm" color="primary" variant="flat">Action</Button>
                      </div>
                    </div>
                  </CardBody>
                </Card>
              </div>
            </Tab>

            <Tab key="quoting" title="📋 Quoting System">
              <div className="space-y-6 mt-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-semibold text-ghana-black">Comprehensive Quoting & Proforma System</h3>
                  <div className="flex gap-2">
                    <Button 
                      color="warning" 
                      variant="flat"
                      onClick={() => {
                        setEditingQuote({});
                        setIsQuoteModalOpen(true);
                      }}
                    >
                      📋 New Quote
                    </Button>
                    <Button 
                      color="success" 
                      variant="flat"
                      onClick={() => {
                        setEditingPackage({});
                        setIsPackageModalOpen(true);
                    }}
                    >
                      📦 Manage Packages
                    </Button>
                    <Button 
                      color="secondary" 
                      variant="flat"
                      onClick={() => {
                        setEditingTax({});
                        setIsTaxModalOpen(true);
                    }}
                    >
                      🧮 Tax Management
                    </Button>
                  </div>
                </div>

                {/* Tax Exemption Notice */}
                <Card className="border border-blue-200 bg-blue-50">
                  <CardBody className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="text-2xl">ℹ️</div>
                      <div>
                        <h4 className="font-semibold text-blue-800 mb-2">Tax Exemption Information</h4>
                        <p className="text-sm text-blue-700 mb-3">
                          <strong>Note:</strong> Some clients may be eligible for tax exemption (e.g., government agencies, NGOs, diplomatic missions). 
                          While not compulsory, clients should provide supporting documentation from GRA or relevant authorities for verification.
                        </p>
                        <div className="text-xs text-blue-600">
                          <p><strong>Common Exemptions:</strong> Government ministries, registered NGOs, diplomatic missions, certain educational institutions</p>
                          <p><strong>Required Documents:</strong> GRA exemption certificate, organization registration, authority letter</p>
                        </div>
                      </div>
                    </div>
                  </CardBody>
                </Card>

                {/* Sample Quote Display */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold">Sample Quote: {sampleQuote.quoteNumber}</h4>
                      <div className="flex gap-2">
                        <Button size="sm" color="primary" variant="flat">
                          📄 Generate PDF
                        </Button>
                        <Button size="sm" color="success" variant="flat">
                          📧 Send to Client
                        </Button>
                        <Button size="sm" color="warning" variant="flat">
                          ✍️ Convert to Booking
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardBody>
                    {/* Quote Header */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                      <div>
                        <h5 className="font-semibold mb-2">Client Information</h5>
                        <p><strong>Name:</strong> {sampleQuote.clientName}</p>
                        <p><strong>Email:</strong> {sampleQuote.clientEmail}</p>
                        <p><strong>Phone:</strong> {sampleQuote.clientPhone}</p>
                      </div>
                      <div>
                        <h5 className="font-semibold mb-2">Event Details</h5>
                        <p><strong>Event:</strong> {sampleQuote.eventName}</p>
                        <p><strong>Type:</strong> {sampleQuote.eventType}</p>
                        <p><strong>Duration:</strong> {sampleQuote.startDate} to {sampleQuote.endDate} ({sampleQuote.totalDays} days)</p>
                      </div>
                    </div>

                    {/* Event Timeline Grid */}
                    <div className="mb-6">
                      <h5 className="font-semibold mb-3">Event Timeline & Daily Services</h5>
                      <Accordion variant="splitted">
                        {sampleQuote.eventTimeline.map((day, dayIndex) => (
                          <AccordionItem
                            key={dayIndex}
                            aria-label={`Day ${day.dayNumber} - ${day.date}`}
                            title={
                              <div className="flex items-center gap-3">
                                <Badge color="primary" variant="flat">Day {day.dayNumber}</Badge>
                                <span className="font-medium">{day.date}</span>
                                <Badge color="secondary" variant="flat">{day.dayType}</Badge>
                                <span className="text-sm text-gray-600">
                                  {day.services.length} services
                                </span>
                              </div>
                            }
                          >
                            <div className="space-y-3">
                              {day.services.map((service, serviceIndex) => (
                                <div key={serviceIndex} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                      <span className="font-medium">{service.serviceName}</span>
                                      <Badge color="primary" variant="flat">{service.category}</Badge>
                                    </div>
                                    <p className="text-sm text-gray-600">{service.notes}</p>
                                  </div>
                                  <div className="text-right">
                                    <p className="font-medium">{service.quantity} × ₵{service.unitPrice}</p>
                                    <p className="text-lg font-bold">₵{service.totalPrice.toLocaleString()}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </AccordionItem>
                        ))}
                      </Accordion>
                    </div>

                    {/* Financial Summary */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <h5 className="font-semibold mb-3">Financial Summary</h5>
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span>Subtotal:</span>
                            <span className="font-medium">₵{calculateQuoteTotals(sampleQuote).subtotal.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Total Tax:</span>
                            <span className="font-medium">₵{calculateQuoteTotals(sampleQuote).totalTax.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between text-lg font-bold">
                            <span>Grand Total:</span>
                            <span>₵{calculateQuoteTotals(sampleQuote).grandTotal.toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                      <div>
                        <h5 className="font-semibold mb-3">Payment Terms</h5>
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span>Deposit Required:</span>
                            <span className="font-medium">{sampleQuote.depositRequired}%</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Deposit Amount:</span>
                            <span className="font-medium">₵{calculateQuoteTotals(sampleQuote).depositAmount.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Balance Due:</span>
                            <span className="font-medium">₵{calculateQuoteTotals(sampleQuote).balanceAmount.toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Tax Breakdown */}
                    <div className="mt-6">
                      <h5 className="font-semibold mb-3">Tax Breakdown</h5>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {calculateQuoteTotals(sampleQuote).taxBreakdown.map((tax: any, index: number) => (
                          <div key={index} className="flex justify-between p-2 bg-gray-50 rounded">
                            <span>{tax.name} ({tax.rate}%)</span>
                            <span className="font-medium">₵{tax.amount.toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardBody>
                </Card>

                  {/* Tax-Exempt Quote Display */}
                  <Card className="mt-6 border border-green-200">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <h4 className="font-semibold">Tax-Exempt Quote: {sampleTaxExemptQuote.quoteNumber}</h4>
                          <Badge color="success" variant="flat">Tax Exempt</Badge>
                          <Badge color="secondary" variant="flat">{sampleTaxExemptQuote.taxExemptionType}</Badge>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" color="primary" variant="flat">
                            📄 Generate PDF
                          </Button>
                          <Button size="sm" color="success" variant="flat">
                            📧 Send to Client
                          </Button>
                          <Button size="sm" color="warning" variant="flat">
                            ✍️ Convert to Booking
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardBody>
                      {/* Quote Header */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                        <div>
                          <h5 className="font-semibold mb-2">Client Information</h5>
                          <p><strong>Name:</strong> {sampleTaxExemptQuote.clientName}</p>
                          <p><strong>Email:</strong> {sampleTaxExemptQuote.clientEmail}</p>
                          <p><strong>Phone:</strong> {sampleTaxExemptQuote.clientPhone}</p>
                        </div>
                        <div>
                          <h5 className="font-semibold mb-2">Event Details</h5>
                          <p><strong>Event:</strong> {sampleTaxExemptQuote.eventName}</p>
                          <p><strong>Type:</strong> {sampleTaxExemptQuote.eventType}</p>
                          <p><strong>Duration:</strong> {sampleTaxExemptQuote.startDate} to {sampleTaxExemptQuote.endDate} ({sampleTaxExemptQuote.totalDays} days)</p>
                        </div>
                      </div>

                      {/* Tax Exemption Details */}
                      <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                        <h5 className="font-semibold text-green-800 mb-3">Tax Exemption Details</h5>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <p><strong>Exemption Type:</strong> {sampleTaxExemptQuote.taxExemptionType}</p>
                            <p><strong>Exemption Number:</strong> {sampleTaxExemptQuote.taxExemptionNumber}</p>
                            <p><strong>Authority:</strong> {sampleTaxExemptQuote.taxExemptionAuthority}</p>
                          </div>
                          <div>
                            <p><strong>Expiry Date:</strong> {sampleTaxExemptQuote.taxExemptionExpiry}</p>
                            <p><strong>Documents:</strong> {sampleTaxExemptQuote.taxExemptionDocuments.length} attached</p>
                            <p><strong>Notes:</strong> {sampleTaxExemptQuote.taxExemptionNotes}</p>
                          </div>
                        </div>
                        <div className="mt-3">
                          <Button size="sm" color="success" variant="flat">
                            📎 View Documents
                          </Button>
                          <Button size="sm" color="warning" variant="flat" className="ml-2">
                            ✏️ Edit Exemption
                          </Button>
                        </div>
                      </div>

                      {/* Event Timeline Grid */}
                      <div className="mb-6">
                        <h5 className="font-semibold mb-3">Event Timeline & Daily Services</h5>
                        <Accordion variant="splitted">
                          {sampleTaxExemptQuote.eventTimeline.map((day, dayIndex) => (
                            <AccordionItem
                              key={dayIndex}
                              aria-label={`Day ${day.dayNumber} - ${day.date}`}
                              title={
                                <div className="flex items-center gap-3">
                                  <Badge color="primary" variant="flat">Day {day.dayNumber}</Badge>
                                  <span className="font-medium">{day.date}</span>
                                  <Badge color="secondary" variant="flat">{day.dayType}</Badge>
                                  <span className="text-sm text-gray-600">
                                    {day.services.length} services
                                  </span>
                                </div>
                              }
                            >
                              <div className="space-y-3">
                                {day.services.map((service, serviceIndex) => (
                                  <div key={serviceIndex} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2 mb-1">
                                        <span className="font-medium">{service.serviceName}</span>
                                        <Badge color="primary" variant="flat">{service.category}</Badge>
                                        <Badge color="success" variant="flat">No Tax</Badge>
                                      </div>
                                      <p className="text-sm text-gray-600">{service.notes}</p>
                                    </div>
                                    <div className="text-right">
                                      <p className="font-medium">{service.quantity} × ₵{service.unitPrice}</p>
                                      <p className="text-lg font-bold">₵{service.totalPrice.toLocaleString()}</p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </AccordionItem>
                          ))}
                        </Accordion>
                      </div>

                      {/* Financial Summary - No Taxes */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <h5 className="font-semibold mb-3">Financial Summary</h5>
                          <div className="space-y-2">
                            <div className="flex justify-between">
                              <span>Subtotal:</span>
                              <span className="font-medium">₵{sampleTaxExemptQuote.subtotal.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Total Tax:</span>
                              <span className="font-medium text-green-600">₵0.00 (Exempt)</span>
                            </div>
                            <div className="flex justify-between text-lg font-bold">
                              <span>Grand Total:</span>
                              <span>₵{sampleTaxExemptQuote.grandTotal.toLocaleString()}</span>
                            </div>
                          </div>
                        </div>
                        <div>
                          <h5 className="font-semibold mb-3">Payment Terms</h5>
                          <div className="space-y-2">
                            <div className="flex justify-between">
                              <span>Deposit Required:</span>
                              <span className="font-medium">{sampleTaxExemptQuote.depositRequired}%</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Deposit Amount:</span>
                              <span className="font-medium">₵{sampleTaxExemptQuote.depositAmount.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Balance Due:</span>
                              <span className="font-medium">₵{sampleTaxExemptQuote.balanceAmount.toLocaleString()}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Tax Exemption Notice */}
                      <div className="mt-6 p-3 bg-green-100 border border-green-300 rounded">
                        <div className="flex items-center gap-2">
                          <span className="text-green-600">✅</span>
                          <span className="text-sm text-green-800">
                            <strong>Tax Exemption Applied:</strong> This quote has been processed with tax exemption. 
                            All services are tax-free as per the provided exemption documentation.
                          </span>
                        </div>
                      </div>
                    </CardBody>
                  </Card>
              </div>
            </Tab>

            <Tab key="reports" title="📊 Reports & Analytics">
              <div className="space-y-6 mt-4">
                <h3 className="text-xl font-semibold text-ghana-black">Reports & Analytics</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <h4 className="font-semibold">Financial Metrics</h4>
                    </CardHeader>
                    <CardBody>
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span>Monthly Revenue:</span>
                          <Badge color="success">₵{monthlyRevenue.toLocaleString()}</Badge>
                        </div>
                        <div className="flex justify-between">
                          <span>Average Event Value:</span>
                          <Badge color="primary">₵{averageEventValue.toLocaleString()}</Badge>
                        </div>
                        <div className="flex justify-between">
                          <span>Total Attendees:</span>
                          <Badge color="primary">{totalAttendees}</Badge>
                        </div>
                        <div className="flex justify-between">
                          <span>Occupancy Rate:</span>
                          <Badge color="success">{occupancyRate}%</Badge>
                        </div>
                      </div>
                    </CardBody>
                  </Card>
                  <Card>
                    <CardHeader>
                      <h4 className="font-semibold">Quick Actions</h4>
                    </CardHeader>
                    <CardBody>
                      <div className="space-y-3">
                        <Button color="primary" variant="flat" className="w-full">
                          📊 Generate Report
                        </Button>
                        <Button color="secondary" variant="flat" className="w-full">
                          📈 View Analytics
                        </Button>
                        <Button color="success" variant="flat" className="w-full">
                          💾 Export Data
                        </Button>
                      </div>
                    </CardBody>
                  </Card>
                </div>
              </div>
            </Tab>
            
            <Tab key="clients" title="👥 Client Management">
              <div className="mt-6">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-semibold text-ghana-black">Client Management & Contract Generation</h3>
                  <Button 
                    color="primary" 
                    startContent={<span>➕</span>}
                    onClick={() => router.push('/guest-services/client-services/clients-services?new=1')}
                  >
                    Add New Client
                  </Button>
                </div>
                
                {/* Client Management Table */}
                <Card className="border-0 shadow-lg">
                  <CardBody className="p-0">
                    <Table aria-label="Client management table">
                      <TableHeader>
                        <TableColumn>#</TableColumn>
                        <TableColumn>Client Code</TableColumn>
                        <TableColumn>Client Name</TableColumn>
                        <TableColumn>Organization</TableColumn>
                        <TableColumn>Contact</TableColumn>
                        <TableColumn>Contract Status</TableColumn>
                        <TableColumn>Negotiated Rates</TableColumn>
                        <TableColumn>Actions</TableColumn>
                      </TableHeader>
                      <TableBody>
                        {sampleClients.map((client, index) => (
                          <TableRow key={client.id}>
                            <TableCell>
                              <div className="text-center">
                                <span className="inline-flex items-center justify-center w-8 h-8 bg-blue-100 text-blue-800 text-sm font-semibold rounded-full">
                                  {index + 1}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="text-center">
                                <span className="inline-flex items-center px-2 py-1 bg-gray-100 text-gray-800 text-xs font-mono rounded">
                                  {client.id}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div>
                                <p className="font-medium">{client.name}</p>
                                <p className="text-sm text-gray-600">{client.position}</p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div>
                                <p className="font-medium">{client.organization}</p>
                                <p className="text-sm text-gray-600">{client.industry}</p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="space-y-1">
                                <p className="text-sm">{client.contact}</p>
                                <p className="text-sm text-blue-600">{client.email}</p>
                                <div className="flex items-center gap-2">
                                  <input type="checkbox" id={`whatsapp-${client.id}`} className="w-4 h-4 text-green-600 rounded focus:ring-green-500" defaultChecked={client.whatsapp} disabled />
                                  <label htmlFor={`whatsapp-${client.id}`} className="text-sm text-green-600">WhatsApp</label>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge 
                                color={client.contractStatus === 'active' ? 'success' : 
                                       client.contractStatus === 'expired' ? 'warning' : 
                                       client.contractStatus === 'pending' ? 'primary' : 'default'}
                                variant="flat"
                              >
                                {client.contractStatus}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="text-sm">
                                <p><strong>Accommodation:</strong> ₵{client.rates.accommodation}/night</p>
                                <p><strong>Conference:</strong> ₵{client.rates.conference}/head</p>
                                <p><strong>Catering:</strong> ₵{client.rates.catering}/head</p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button 
                                  size="sm" 
                                  color="primary" 
                                  variant="flat"
                                  onClick={() => handleClientAction('view', client)}
                                >
                                  👁️ View
                                </Button>
                                <Button 
                                  size="sm" 
                                  color="success" 
                                  variant="flat"
                                  onClick={() => handleClientAction('contract', client)}
                                >
                                  📄 Contract
                                </Button>
                                <Button 
                                  size="sm" 
                                  color="warning" 
                                  variant="flat"
                                  onClick={() => handleClientAction('edit', client)}
                                >
                                  ✏️ Edit
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardBody>
                </Card>
              </div>
            </Tab>
          </Tabs>
        </CardBody>
      </Card>

      {/* Event Modal - Ghanaian Business Process */}
      <Modal 
        isOpen={isEventModalOpen} 
        onClose={() => setIsEventModalOpen(false)} 
        size="full"
        scrollBehavior="inside"
        classNames={{
          base: "max-w-[60vw] max-h-[90vh]",
          body: "p-0"
        }}
      >
        <ModalContent>
          <ModalHeader>
            <div className="flex items-center gap-2">
              <span className="text-2xl">🎉</span>
              <div>
                <h3 className="text-lg font-semibold">
                  {editingEvent?.id ? 'Edit Event' : 'Create New Event'}
                </h3>
                <p className="text-sm text-gray-600">Complete event booking following Ghanaian business process</p>
              </div>
            </div>
          </ModalHeader>
          <ModalBody className="p-8">
            {/* Phase 1: Event Details & Client */}
            <div className="mb-8">
              <h4 className="font-semibold text-lg mb-4 flex items-center gap-2">
                📋 Phase 1: Event Details & Client
              </h4>
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                <Input
                  label="Event Name"
                  placeholder="e.g., Ghana Tech Conference 2024"
                  defaultValue={editingEvent?.name || ''}
                />
                <Input
                  label="Organization"
                  placeholder="Client or company name"
                  defaultValue={editingEvent?.organization || ''}
                />
                <Input
                  label="Contact"
                  placeholder="Phone number"
                  defaultValue={editingEvent?.contact || ''}
                />
                <div className="flex items-center gap-3 p-4 bg-green-50 rounded-lg border border-green-200">
                  <input type="checkbox" id="whatsapp" className="w-5 h-5 text-green-600 rounded focus:ring-green-500" />
                  <label htmlFor="whatsapp" className="text-lg font-medium text-green-800">
                    📱 WhatsApp Available
                  </label>
                </div>
                <Input
                  label="Client Email"
                  placeholder="Email address"
                  defaultValue={editingEvent?.clientEmail || ''}
                />
              </div>
              
              {/* Crucial Addition: Residential Event Checkbox */}
              <div className="mt-6 p-6 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="isResidential"
                    className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="isResidential" className="text-lg font-medium text-blue-800">
                    🏨 This is a Residential Event (requires accommodation)
                  </label>
                </div>
              </div>
            </div>

            <Divider className="my-8" />

            {/* Phase 2: Event Dates & Venue */}
            <div className="mb-8">
              <h4 className="font-semibold text-lg mb-4 flex items-center gap-2">
                📅 Phase 2: Event Dates & Venue
              </h4>
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                <Input
                  label="Start Date"
                  type="date"
                  defaultValue={editingEvent?.startDate || ''}
                />
                <Input
                  label="End Date"
                  type="date"
                  defaultValue={editingEvent?.endDate || ''}
                />
                <Select label="Venue Selection" placeholder="Select venue">
                  <SelectItem key="main-hall">Main Conference Hall (200 pax)</SelectItem>
                  <SelectItem key="executive-room">Executive Meeting Room (50 pax)</SelectItem>
                  <SelectItem key="outdoor-garden">Outdoor Garden (150 pax)</SelectItem>
                  <SelectItem key="banquet-hall">Banquet Hall (300 pax)</SelectItem>
                </Select>
                <Input
                  label="Expected Pax"
                  type="number"
                  placeholder="Number of attendees"
                  defaultValue={editingEvent?.expectedPax || ''}
                />
              </div>
              
              {/* Venue Availability Warning */}
              <div className="mt-6 p-6 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-center gap-2 text-yellow-800">
                  <span className="text-xl">⚠️</span>
                  <span className="font-medium">Venue Availability Check</span>
                </div>
                <p className="text-yellow-700 mt-2">
                  Checking venue availability for selected dates...
                </p>
              </div>
            </div>

            <Divider className="my-8" />

            {/* Phase 3: Daily Schedule & Headcounts (NEW, MOST IMPORTANT PHASE) */}
            <div className="mb-6">
              <h4 className="font-semibold text-lg mb-3 flex items-center gap-2">
                📊 Phase 3: Daily Schedule & Headcounts
              </h4>
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200 mb-4">
                <p className="text-blue-800 text-sm">
                  <strong>Note:</strong> This table will be dynamically generated based on your Start and End dates. 
                  Each day will show Conference Pax, Lunch Pax, Dinner Pax, and Rooms Needed (if residential).
                </p>
              </div>
              
              {/* Daily Schedule Table */}
              <div className="overflow-x-auto">
                <Table aria-label="Daily schedule">
                  <TableHeader>
                    <TableColumn>Date</TableColumn>
                    <TableColumn>Conference Pax</TableColumn>
                    <TableColumn>Lunch Pax</TableColumn>
                    <TableColumn>Dinner Pax</TableColumn>
                    <TableColumn>Rooms Needed</TableColumn>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="text-center text-gray-500" colSpan={5}>
                        <div className="py-8">
                          <span className="text-4xl">📅</span>
                          <p className="mt-2">Please select Start and End dates to generate daily schedule</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </div>

            <Divider />

            {/* Phase 4: Packages & Add-Ons */}
            <div className="mb-6">
              <h4 className="font-semibold text-lg mb-3 flex items-center gap-2">
                🎁 Phase 4: Packages & Add-Ons
              </h4>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                <div>
                  <h5 className="font-medium text-gray-700 mb-3">Select Package</h5>
                  <div className="space-y-3">
                    <div className="p-4 border border-gray-200 rounded-lg cursor-pointer hover:border-blue-300 transition-all">
                      <div className="flex justify-between items-start">
                        <div>
                          <h6 className="font-medium text-gray-800">Gold Conference Package</h6>
                          <p className="text-sm text-gray-600">Full conference with premium services</p>
                        </div>
                        <span className="text-lg font-bold text-blue-600">₵250</span>
                      </div>
                    </div>
                    <div className="p-4 border border-gray-200 rounded-lg cursor-pointer hover:border-blue-300 transition-all">
                      <div className="flex justify-between items-start">
                        <div>
                          <h6 className="font-medium text-gray-800">Silver Conference Package</h6>
                          <p className="text-sm text-gray-600">Standard conference package</p>
                        </div>
                        <span className="text-lg font-bold text-blue-600">₵180</span>
                      </div>
                    </div>
                    <div className="p-4 border border-gray-200 rounded-lg cursor-pointer hover:border-blue-300 transition-all">
                      <div className="flex justify-between items-start">
                        <div>
                          <h6 className="font-medium text-gray-800">Bronze Conference Package</h6>
                          <p className="text-sm text-gray-600">Basic conference essentials</p>
                        </div>
                        <span className="text-lg font-bold text-blue-600">₵120</span>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div>
                  <h5 className="font-medium text-gray-700 mb-3">Add-Ons (à la carte)</h5>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 p-3 border border-gray-200 rounded-lg">
                      <input type="checkbox" className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500" />
                      <div className="flex-1">
                        <span className="font-medium text-gray-800">Extra Microphones</span>
                        <span className="text-sm text-gray-600 ml-2">(+₵200)</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 p-3 border border-gray-200 rounded-lg">
                      <input type="checkbox" className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500" />
                      <div className="flex-1">
                        <span className="font-medium text-gray-800">Flip Charts</span>
                        <span className="text-sm text-gray-600 ml-2">(+₵150)</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 p-3 border border-gray-200 rounded-lg">
                      <input type="checkbox" className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500" />
                      <div className="flex-1">
                        <span className="font-medium text-gray-800">Branded Cookies</span>
                        <span className="text-sm text-gray-600 ml-2">(+₵100)</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 p-3 border border-gray-200 rounded-lg">
                      <input type="checkbox" className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500" />
                      <div className="flex-1">
                        <span className="font-medium text-gray-800">Special Lunch Menu</span>
                        <span className="text-sm text-gray-600 ml-2">(+₵300/head)</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <Divider />

            {/* Phase 5: Financial Summary (AUTO-CALCULATED) */}
            <div className="mb-8">
              <h4 className="font-semibold text-lg mb-4 flex items-center gap-2">
                💰 Phase 5: Financial Summary (AUTO-CALCULATED)
              </h4>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-10">
                <div className="space-y-6">
                  <div className="p-6 bg-gray-50 rounded-lg">
                    <h5 className="font-medium text-gray-700 mb-4">Package & Add-Ons</h5>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span>Package Price:</span>
                        <span className="font-medium">₵0</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Add-Ons:</span>
                        <span className="font-medium">₵0</span>
                      </div>
                      <div className="border-t pt-3 flex justify-between font-bold">
                        <span>Subtotal:</span>
                        <span>₵0</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-6 bg-blue-50 rounded-lg">
                    <h5 className="font-medium text-blue-700 mb-4">Ghana Tax Breakdown</h5>
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between">
                        <span>NHIL (2.5%):</span>
                        <span>₵0</span>
                      </div>
                      <div className="flex justify-between">
                        <span>GETFund (2.5%):</span>
                        <span>₵0</span>
                      </div>
                      <div className="flex justify-between">
                        <span>COVID Levy (1%):</span>
                        <span>₵0</span>
                      </div>
                      <div className="flex justify-between">
                        <span>VAT (12.5%):</span>
                        <span>₵0</span>
                      </div>
                      <div className="flex justify-between">
                        <span>GTA Levy (1%):</span>
                        <span>₵0</span>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="p-8 bg-gradient-to-br from-green-50 to-blue-50 rounded-lg border border-green-200">
                  <h5 className="text-xl font-bold text-green-800 mb-6">Final Summary</h5>
                  <div className="space-y-4">
                    <div className="flex justify-between text-lg">
                      <span>Grand Total:</span>
                      <span className="font-bold text-green-600">₵0</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Deposit (50%):</span>
                      <span className="font-medium text-blue-600">₵0</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Balance Due:</span>
                      <span className="font-medium text-orange-600">₵0</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <Divider className="my-8" />

            {/* Phase 6: Status & Communication */}
            <div className="mb-8">
              <h4 className="font-semibold text-lg mb-4 flex items-center gap-2">
                📞 Phase 6: Status & Communication
              </h4>
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                <Select label="Current Status" placeholder="Select status">
                  <SelectItem key="inquiry">Inquiry</SelectItem>
                  <SelectItem key="quote-sent">Quote Sent</SelectItem>
                  <SelectItem key="negotiating">Negotiating</SelectItem>
                  <SelectItem key="confirmed">Confirmed</SelectItem>
                  <SelectItem key="deposit-paid">Deposit Paid</SelectItem>
                  <SelectItem key="cancelled">Cancelled</SelectItem>
                </Select>
                <Input
                  label="Next Action Required"
                  placeholder="e.g., Send contract, Follow up on deposit"
                  defaultValue={editingEvent?.nextAction || ''}
                />
                <Input
                  label="Follow-up Date"
                  type="date"
                  defaultValue={editingEvent?.followUpDate || ''}
                />
                <Input
                  label="Sales Manager"
                  placeholder="Assigned sales manager"
                  defaultValue={editingEvent?.salesManager || ''}
                />
              </div>
              
              <div className="mt-6 space-y-6">
                <Textarea
                  label="Special Requirements & Notes"
                  placeholder="Any special requirements, dietary restrictions, or additional notes..."
                  defaultValue={editingEvent?.specialRequirements || ''}
                />
                
                <Textarea
                  label="Communication Notes"
                  placeholder="Log all WhatsApp messages, calls, and emails with client..."
                  defaultValue={editingEvent?.communicationNotes || ''}
                />
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <div className="flex gap-2">
              <Button color="secondary" variant="flat" onPress={() => setIsEventModalOpen(false)}>
                📋 Generate Quote
              </Button>
              <Button color="warning" variant="flat" onPress={() => setIsEventModalOpen(false)}>
                ✍️ Send Contract
              </Button>
              <Button color="danger" variant="flat" onPress={() => setIsEventModalOpen(false)}>
                Cancel
              </Button>
              <Button color="primary" onPress={handleEventSubmit}>
                {editingEvent?.id ? 'Update Event' : 'Create Event'}
              </Button>
            </div>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Venue Modal */}
      <Modal isOpen={isVenueModalOpen} onClose={() => setIsVenueModalOpen(false)} size="2xl">
        <ModalContent>
          <ModalHeader>
            {editingVenue?.id ? 'Edit Venue' : 'Create New Venue'}
          </ModalHeader>
          <ModalBody>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Venue Name"
                placeholder="Enter venue name"
                defaultValue={editingVenue?.name || ''}
              />
              <Select label="Venue Type" placeholder="Select venue type">
                <SelectItem key="conference">Conference Hall</SelectItem>
                <SelectItem key="meeting">Meeting Room</SelectItem>
                <SelectItem key="banquet">Banquet Hall</SelectItem>
                <SelectItem key="auditorium">Auditorium</SelectItem>
              </Select>
              <Input
                label="Capacity"
                type="number"
                placeholder="Number of people"
                defaultValue={editingVenue?.capacity || ''}
              />
              <Input
                label="Price per Day"
                type="number"
                placeholder="Daily rate"
                defaultValue={editingVenue?.price || ''}
              />
              <Input
                label="Location"
                placeholder="Venue location"
                defaultValue={editingVenue?.location || ''}
              />
              <Select label="Status" placeholder="Select status">
                <SelectItem key="available">Available</SelectItem>
                <SelectItem key="booked">Booked</SelectItem>
                <SelectItem key="setup">Setup</SelectItem>
                <SelectItem key="maintenance">Maintenance</SelectItem>
              </Select>
            </div>
            <Textarea
              label="Features"
              placeholder="Venue features (one per line)"
              className="mt-4"
              defaultValue={editingVenue?.features?.join('\n') || ''}
            />
          </ModalBody>
          <ModalFooter>
            <Button color="danger" variant="flat" onPress={() => setIsVenueModalOpen(false)}>
              Cancel
            </Button>
            <Button color="primary" onPress={handleVenueSubmit}>
              {editingVenue?.id ? 'Update Venue' : 'Create Venue'}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Quote Modal - Comprehensive Quoting System */}
      <Modal isOpen={isQuoteModalOpen} onClose={() => setIsQuoteModalOpen(false)} size="5xl">
        <ModalContent>
          <ModalHeader>
            <div className="flex items-center gap-2">
              <span className="text-2xl">📋</span>
              <div>
                <h3 className="text-lg font-semibold">
                  {editingQuote?.id ? 'Edit Quote' : 'Create New Quote'}
                </h3>
                <p className="text-sm text-gray-600">Comprehensive quoting system with tax exemption support</p>
              </div>
            </div>
          </ModalHeader>
          <ModalBody className="max-h-[80vh] overflow-y-auto">
            {/* Client Information */}
            <div className="mb-6">
              <h4 className="font-semibold text-lg mb-3">👤 Client Information</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Client Name"
                  placeholder="e.g., Tech Ghana Ltd"
                  defaultValue={editingQuote?.clientName || ''}
                />
                <Input
                  label="Client Email"
                  type="email"
                  placeholder="events@company.com"
                  defaultValue={editingQuote?.clientEmail || ''}
                />
                <Input
                  label="Client Phone"
                  placeholder="+233 20 123 4567"
                  defaultValue={editingQuote?.clientPhone || ''}
                />
                <Select label="Client Type" placeholder="Select client type">
                  <SelectItem key="corporate">Corporate</SelectItem>
                  <SelectItem key="government">Government Agency</SelectItem>
                  <SelectItem key="ngo">NGO</SelectItem>
                  <SelectItem key="diplomatic">Diplomatic Mission</SelectItem>
                  <SelectItem key="educational">Educational Institution</SelectItem>
                  <SelectItem key="individual">Individual</SelectItem>
                </Select>
              </div>
            </div>

            {/* Event Details */}
            <div className="mb-6">
              <h4 className="font-semibold text-lg mb-3">🎉 Event Details</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Event Name"
                  placeholder="e.g., Ghana Tech Conference 2024"
                  defaultValue={editingQuote?.eventName || ''}
                />
                <Select label="Event Type" placeholder="Select event type">
                  <SelectItem key="conference">Conference</SelectItem>
                  <SelectItem key="workshop">Workshop</SelectItem>
                  <SelectItem key="wedding">Wedding</SelectItem>
                  <SelectItem key="funeral">Funeral</SelectItem>
                  <SelectItem key="agm">AGM</SelectItem>
                  <SelectItem key="training">Corporate Training</SelectItem>
                  <SelectItem key="product-launch">Product Launch</SelectItem>
                  <SelectItem key="other">Other</SelectItem>
                </Select>
                <Input
                  label="Start Date"
                  type="date"
                  defaultValue={editingQuote?.startDate || ''}
                />
                <Input
                  label="End Date"
                  type="date"
                  defaultValue={editingQuote?.endDate || ''}
                />
              </div>
            </div>

            {/* Tax Exemption Section */}
            <div className="mb-6">
              <h4 className="font-semibold text-lg mb-3">🧮 Tax Exemption</h4>
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg mb-4">
                <div className="flex items-center gap-3 mb-3">
                  <Switch 
                    defaultSelected={editingQuote?.taxExempt || false}
                    size="sm"
                  />
                  <span className="text-sm font-medium text-blue-800">
                    Client is eligible for tax exemption
                  </span>
                </div>
                <p className="text-xs text-blue-600">
                  <strong>Note:</strong> Tax exemption requires supporting documentation from GRA or relevant authorities. 
                  This is not compulsory but recommended for eligible clients.
                </p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Select label="Exemption Type" placeholder="Select exemption type">
                  <SelectItem key="government">Government Agency</SelectItem>
                  <SelectItem key="ngo">Registered NGO</SelectItem>
                  <SelectItem key="diplomatic">Diplomatic Mission</SelectItem>
                  <SelectItem key="educational">Educational Institution</SelectItem>
                  <SelectItem key="other">Other (Specify)</SelectItem>
                </Select>
                <Input
                  label="Exemption Number"
                  placeholder="e.g., GRA/EXEMPT/2024/001"
                  defaultValue={editingQuote?.taxExemptionNumber || ''}
                />
                <Input
                  label="Exemption Authority"
                  placeholder="e.g., Ghana Revenue Authority"
                  defaultValue={editingQuote?.taxExemptionAuthority || ''}
                />
                <Input
                  label="Exemption Expiry Date"
                  type="date"
                  defaultValue={editingQuote?.taxExemptionExpiry || ''}
                />
              </div>
              
              <div className="mt-4">
                <Textarea
                  label="Exemption Notes"
                  placeholder="Additional details about the tax exemption..."
                  defaultValue={editingQuote?.taxExemptionNotes || ''}
                />
              </div>
              
              <div className="mt-4">
                <label className="block text-sm font-medium mb-2">📎 Supporting Documents</label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                  <div className="text-2xl mb-2">📎</div>
                  <p className="text-sm text-gray-600 mb-2">
                    Upload tax exemption certificates, registration documents, or authority letters
                  </p>
                  <Button color="primary" variant="flat" size="sm">
                    📁 Choose Files
                  </Button>
                  <p className="text-xs text-gray-500 mt-2">
                    PDF, JPG, PNG up to 10MB each
                  </p>
                </div>
              </div>
            </div>

            {/* Event Timeline & Services */}
            <div className="mb-6">
              <h4 className="font-semibold text-lg mb-3">📅 Event Timeline & Services</h4>
              <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                <p className="text-sm text-gray-600 mb-3">
                  <strong>Note:</strong> The system will automatically calculate totals and taxes based on the services added. 
                  For tax-exempt clients, all taxes will be automatically set to zero.
                </p>
                <Button color="primary" variant="flat" size="sm">
                  ➕ Add Day to Timeline
                </Button>
                <Button color="secondary" variant="flat" size="sm" className="ml-2">
                  📦 Add Service Package
                </Button>
                <Button color="success" variant="flat" size="sm" className="ml-2">
                  🍽️ Add Individual Service
                </Button>
              </div>
            </div>

            {/* Terms & Conditions */}
            <div className="mb-6">
              <h4 className="font-semibold text-lg mb-3">📋 Terms & Conditions</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Deposit Required (%)"
                  type="number"
                  placeholder="50"
                  defaultValue={editingQuote?.depositRequired || '50'}
                />
                <Input
                  label="Payment Terms"
                  placeholder="e.g., 50% deposit to confirm, balance 7 days before event"
                  defaultValue={editingQuote?.paymentTerms || ''}
                />
                <Input
                  label="Cancellation Policy"
                  placeholder="e.g., Deposit non-refundable if cancelled within 14 days"
                  defaultValue={editingQuote?.cancellationPolicy || ''}
                />
                <Input
                  label="Guarantee Policy"
                  placeholder="e.g., Final numbers guaranteed 48 hours before event"
                  defaultValue={editingQuote?.guaranteePolicy || ''}
                />
              </div>
            </div>

            {/* Additional Notes */}
            <div className="mb-6">
              <h4 className="font-semibold text-lg mb-3">📝 Additional Information</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Textarea
                  label="Special Requirements"
                  placeholder="Any special requirements, dietary restrictions, or additional notes..."
                  defaultValue={editingQuote?.specialRequirements || ''}
                />
                <Textarea
                  label="Setup Requirements"
                  placeholder="Setup time, special arrangements, or technical requirements..."
                  defaultValue={editingQuote?.setupTime || ''}
                />
              </div>
              <div className="mt-4">
                <Input
                  label="Contact Person on Event Day"
                  placeholder="Name and phone number of main contact person"
                  defaultValue={editingQuote?.contactPerson || ''}
                />
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <div className="flex gap-2">
              <Button color="secondary" variant="flat" onPress={() => setIsQuoteModalOpen(false)}>
                Cancel
              </Button>
              <Button color="warning" variant="flat">
                💾 Save Draft
              </Button>
              <Button color="success" variant="flat">
                📄 Generate PDF
              </Button>
              <Button color="primary">
                📧 Send to Client
              </Button>
            </div>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Service Modal */}
      <Modal isOpen={isServiceModalOpen} onClose={() => setIsServiceModalOpen(false)} size="2xl">
        <ModalContent>
          <ModalHeader>
            {editingService?.id ? 'Edit Service' : 'Create New Service'}
          </ModalHeader>
          <ModalBody>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Service Name"
                placeholder="Enter service name"
                defaultValue={editingService?.name || ''}
              />
              <Select label="Category" placeholder="Select category">
                <SelectItem key="catering">Catering</SelectItem>
                <SelectItem key="av">Audio Visual</SelectItem>
                <SelectItem key="decoration">Decoration</SelectItem>
                <SelectItem key="transport">Transportation</SelectItem>
              </Select>
              <Input
                label="Price"
                type="number"
                placeholder="Service price"
                defaultValue={editingService?.price || ''}
              />
              <Input
                label="Minimum Notice"
                placeholder="e.g., 24 hours"
                defaultValue={editingService?.minNotice || ''}
              />
              <Select label="Availability" placeholder="Select availability">
                <SelectItem key="daily">Daily</SelectItem>
                <SelectItem key="weekdays">Weekdays Only</SelectItem>
                <SelectItem key="weekends">Weekends Only</SelectItem>
                <SelectItem key="custom">Custom Schedule</SelectItem>
              </Select>
              <div className="flex items-center gap-2">
                <Switch defaultSelected={editingService?.status === 'active'} />
                <span>Active Service</span>
              </div>
            </div>
            <Textarea
              label="Description"
              placeholder="Service description"
              className="mt-4"
              defaultValue={editingService?.description || ''}
            />
          </ModalBody>
          <ModalFooter>
            <Button color="danger" variant="flat" onPress={() => setIsServiceModalOpen(false)}>
              Cancel
            </Button>
            <Button color="primary" onPress={handleServiceSubmit}>
              {editingService?.id ? 'Update Service' : 'Create Service'}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* BEO (Banquet Event Order) Modal */}
      <Modal isOpen={isBEOModalOpen} onClose={() => setIsBEOModalOpen(false)} size="5xl">
        <ModalContent>
          <ModalHeader>
            <div className="flex items-center gap-2">
              <span className="text-2xl">📊</span>
              <div>
                <h3 className="text-lg font-semibold">Banquet Event Order (BEO)</h3>
                <p className="text-sm text-gray-600">
                  {selectedEventForBEO?.eventName} - {selectedEventForBEO?.organization}
                </p>
              </div>
            </div>
          </ModalHeader>
          <ModalBody className="max-h-[80vh] overflow-y-auto">
            {selectedEventForBEO && (
              <div className="space-y-6">
                {/* Event Overview */}
                <Card>
                  <CardHeader>
                    <h4 className="font-semibold">Event Overview</h4>
                  </CardHeader>
                  <CardBody>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <p><strong>Event:</strong> {selectedEventForBEO.eventName}</p>
                        <p><strong>Organization:</strong> {selectedEventForBEO.organization}</p>
                        <p><strong>Contact:</strong> {selectedEventForBEO.contactPerson}</p>
                      </div>
                      <div>
                        <p><strong>Date:</strong> {selectedEventForBEO.arrivalDate}</p>
                        <p><strong>Venue:</strong> {selectedEventForBEO.venueName}</p>
                        <p><strong>Duration:</strong> {selectedEventForBEO.duration} days</p>
                      </div>
                      <div>
                        <p><strong>Attendees:</strong> {selectedEventForBEO.pax}</p>
                        <p><strong>Revenue:</strong> ₵{selectedEventForBEO.revenue?.toLocaleString()}</p>
                        <p><strong>Status:</strong> {selectedEventForBEO.status}</p>
                      </div>
                    </div>
                  </CardBody>
                </Card>

                {/* Room Setup */}
                <Card>
                  <CardHeader>
                    <h4 className="font-semibold">Room Setup & Configuration</h4>
                  </CardHeader>
                  <CardBody>
                    {(() => {
                      const roomSetup = getRoomSetupForEvent(selectedEventForBEO);
                      return (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <p><strong>Layout:</strong> {roomSetup.layout}</p>
                            <p><strong>Tables:</strong> {roomSetup.tables}</p>
                            <p><strong>Chairs:</strong> {roomSetup.chairs}</p>
                          </div>
                          <div>
                            <p><strong>Head Table:</strong> {roomSetup.headTable ? 'Yes' : 'No'}</p>
                            <p><strong>Registration Table:</strong> {roomSetup.registrationTable}</p>
                            <p><strong>Display Table:</strong> {roomSetup.displayTable}</p>
                          </div>
                        </div>
                      );
                    })()}
                  </CardBody>
                </Card>

                {/* Catering Details */}
                <Card>
                  <CardHeader>
                    <h4 className="font-semibold">Catering & Food Service</h4>
                  </CardHeader>
                  <CardBody>
                    {(() => {
                      const catering = getCateringDetailsForEvent(selectedEventForBEO);
                      return (
                        <div className="space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <p><strong>Service Style:</strong> {catering.mealType}</p>
                              <p><strong>Tea Breaks:</strong> {catering.teaBreaks}</p>
                              <p><strong>Lunch:</strong> {catering.lunch ? 'Yes' : 'No'}</p>
                              <p><strong>Dinner:</strong> {catering.dinner ? 'Yes' : 'No'}</p>
                            </div>
                            <div>
                              <p><strong>Special Dietary:</strong> {catering.specialDietary} guests</p>
                              <p><strong>Beverages:</strong> {catering.beverages.join(', ')}</p>
                              <p><strong>Snacks:</strong> {catering.snacks.join(', ')}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </CardBody>
                </Card>

                {/* Audio Visual */}
                <Card>
                  <CardHeader>
                    <h4 className="font-semibold">Audio Visual & Technical</h4>
                  </CardHeader>
                  <CardBody>
                    {(() => {
                      const av = getAudioVisualForEvent(selectedEventForBEO);
                      return (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <p><strong>Projector:</strong> {av.projector}</p>
                            <p><strong>Screen:</strong> {av.screen}</p>
                            <p><strong>Sound System:</strong> {av.soundSystem}</p>
                            <p><strong>Microphones:</strong> {av.microphones}</p>
                          </div>
                          <div>
                            <p><strong>Laptop:</strong> {av.laptop}</p>
                            <p><strong>Internet:</strong> {av.internet}</p>
                            <p><strong>Lighting:</strong> {av.lighting}</p>
                            <p><strong>Recording:</strong> {av.recording ? 'Yes' : 'No'}</p>
                          </div>
                        </div>
                      );
                    })()}
                  </CardBody>
                </Card>

                {/* Staffing */}
                <Card>
                  <CardHeader>
                    <h4 className="font-semibold">Staffing Requirements</h4>
                  </CardHeader>
                  <CardBody>
                    {(() => {
                      const staffing = getStaffingForEvent(selectedEventForBEO);
                      return (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <p><strong>Event Manager:</strong> {staffing.eventManager}</p>
                            <p><strong>Wait Staff:</strong> {staffing.waitStaff}</p>
                            <p><strong>Kitchen Staff:</strong> {staffing.kitchenStaff}</p>
                          </div>
                          <div>
                            <p><strong>Security:</strong> {staffing.security}</p>
                            <p><strong>Technical Support:</strong> {staffing.technicalSupport}</p>
                            <p><strong>Cleaning Staff:</strong> {staffing.cleaningStaff}</p>
                          </div>
                        </div>
                      );
                    })()}
                  </CardBody>
                </Card>

                {/* Event Timeline */}
                <Card>
                  <CardHeader>
                    <h4 className="font-semibold">Event Timeline</h4>
                  </CardHeader>
                  <CardBody>
                    {(() => {
                      const timeline = getEventTimeline(selectedEventForBEO);
                      return (
                        <div className="space-y-3">
                          {timeline.map((item, index) => (
                            <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                              <div>
                                <p className="font-medium">{item.time} - {item.activity}</p>
                                <p className="text-sm text-gray-600">Duration: {item.duration}</p>
                              </div>
                              <Badge color="primary" variant="flat">{item.responsible}</Badge>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </CardBody>
                </Card>
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            <Button color="danger" variant="flat" onPress={() => setIsBEOModalOpen(false)}>
              Cancel
            </Button>
            <Button color="warning" variant="flat">
              💾 Save BEO
            </Button>
            <Button color="success" variant="flat">
              📄 Generate PDF
            </Button>
            <Button color="primary">
              📧 Send to Departments
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Function Sheet Modal */}
      <Modal isOpen={isFunctionSheetModalOpen} onClose={() => setIsFunctionSheetModalOpen(false)} size="5xl">
        <ModalContent>
          <ModalHeader>
            <div className="flex items-center gap-2">
              <span className="text-2xl">📋</span>
              <div>
                <h3 className="text-lg font-semibold">Function Sheet</h3>
                <p className="text-sm text-gray-600">
                  {selectedEventForFunctionSheet?.eventName} - {selectedEventForFunctionSheet?.organization}
                </p>
              </div>
            </div>
          </ModalHeader>
          <ModalBody className="max-h-[80vh] overflow-y-auto">
            {selectedEventForFunctionSheet && (
              <div className="space-y-6">
                {/* Event Overview */}
                <Card>
                  <CardHeader>
                    <h4 className="font-semibold">Event Information</h4>
                  </CardHeader>
                  <CardBody>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <p><strong>Event:</strong> {selectedEventForFunctionSheet.eventName}</p>
                        <p><strong>Organization:</strong> {selectedEventForFunctionSheet.organization}</p>
                        <p><strong>Date:</strong> {selectedEventForFunctionSheet.arrivalDate}</p>
                      </div>
                      <div>
                        <p><strong>Venue:</strong> {selectedEventForFunctionSheet.venueName}</p>
                        <p><strong>Duration:</strong> {selectedEventForFunctionSheet.duration} days</p>
                        <p><strong>Attendees:</strong> {selectedEventForFunctionSheet.pax}</p>
                      </div>
                      <div>
                        <p><strong>Contact:</strong> {selectedEventForFunctionSheet.contactPerson}</p>
                        <p><strong>Phone:</strong> {selectedEventForFunctionSheet.contactPhone}</p>
                        <p><strong>Email:</strong> {selectedEventForFunctionSheet.contactEmail}</p>
                      </div>
                    </div>
                  </CardBody>
                </Card>

                {/* Room Specifications */}
                <Card>
                  <CardHeader>
                    <h4 className="font-semibold">Room Specifications</h4>
                  </CardHeader>
                  <CardBody>
                    {(() => {
                      const roomSpecs = getRoomSpecifications(selectedEventForFunctionSheet);
                      return (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <p><strong>Room:</strong> {roomSpecs.roomName}</p>
                            <p><strong>Capacity:</strong> {roomSpecs.capacity} people</p>
                            <p><strong>Layout:</strong> {roomSpecs.layout}</p>
                            <p><strong>Temperature:</strong> {roomSpecs.temperature}</p>
                          </div>
                          <div>
                            <p><strong>Lighting:</strong> {roomSpecs.lighting}</p>
                            <p><strong>Access:</strong> {roomSpecs.access}</p>
                            <p><strong>Parking:</strong> {roomSpecs.parking}</p>
                            <p><strong>Setup Notes:</strong> {roomSpecs.setupNotes}</p>
                          </div>
                        </div>
                      );
                    })()}
                  </CardBody>
                </Card>

                {/* Catering Specifications */}
                <Card>
                  <CardHeader>
                    <h4 className="font-semibold">Catering Specifications</h4>
                  </CardHeader>
                  <CardBody>
                    {(() => {
                      const cateringSpecs = getCateringSpecifications(selectedEventForFunctionSheet);
                      return (
                        <div className="space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <p><strong>Service Style:</strong> {cateringSpecs.serviceStyle}</p>
                              <p><strong>Meal Type:</strong> {cateringSpecs.mealType}</p>
                              <p><strong>Tea Breaks:</strong> {cateringSpecs.teaBreaks}</p>
                              <p><strong>Lunch:</strong> {cateringSpecs.lunch ? 'Yes' : 'No'}</p>
                            </div>
                            <div>
                              <p><strong>Dinner:</strong> {cateringSpecs.dinner ? 'Yes' : 'No'}</p>
                              <p><strong>Dietary Accommodations:</strong> {cateringSpecs.dietaryAccommodations}</p>
                              <p><strong>Allergies:</strong> {cateringSpecs.allergies}</p>
                              <p><strong>Presentation:</strong> {cateringSpecs.presentation}</p>
                            </div>
                          </div>
                          <div>
                            <p><strong>Beverages:</strong> {cateringSpecs.beverages.join(', ')}</p>
                            <p><strong>Snacks:</strong> {cateringSpecs.snacks.join(', ')}</p>
                          </div>
                        </div>
                      );
                    })()}
                  </CardBody>
                </Card>

                {/* Technical Specifications */}
                <Card>
                  <CardHeader>
                    <h4 className="font-semibold">Technical Specifications</h4>
                  </CardHeader>
                  <CardBody>
                    {(() => {
                      const techSpecs = getTechnicalSpecifications(selectedEventForFunctionSheet);
                      return (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <p><strong>Projector:</strong> {techSpecs.projector}</p>
                            <p><strong>Screen:</strong> {techSpecs.screen}</p>
                            <p><strong>Sound System:</strong> {techSpecs.soundSystem}</p>
                            <p><strong>Microphones:</strong> {techSpecs.microphones}</p>
                          </div>
                          <div>
                            <p><strong>Internet Speed:</strong> {techSpecs.internetSpeed}</p>
                            <p><strong>Power Requirements:</strong> {techSpecs.powerRequirements}</p>
                            <p><strong>Backup Equipment:</strong> {techSpecs.backupEquipment}</p>
                            <p><strong>Technical Support:</strong> {techSpecs.technicalSupport}</p>
                          </div>
                        </div>
                      );
                    })()}
                  </CardBody>
                </Card>

                {/* Service Schedule */}
                <Card>
                  <CardHeader>
                    <h4 className="font-semibold">Service Schedule</h4>
                  </CardHeader>
                  <CardBody>
                    {(() => {
                      const schedule = getServiceSchedule(selectedEventForFunctionSheet);
                      return (
                        <div className="space-y-3">
                          {schedule.map((item, index) => (
                            <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                              <div>
                                <p className="font-medium">{item.time} - {item.activity}</p>
                                <p className="text-sm text-gray-600">Duration: {item.duration}</p>
                              </div>
                              <div className="text-right">
                                <Badge color="primary" variant="flat">{item.department}</Badge>
                                <p className="text-sm text-gray-600 mt-1">Status: {item.status}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </CardBody>
                </Card>

                {/* Special Instructions */}
                <Card>
                  <CardHeader>
                    <h4 className="font-semibold">Special Instructions</h4>
                  </CardHeader>
                  <CardBody>
                    {(() => {
                      const instructions = getSpecialInstructions(selectedEventForFunctionSheet);
                      return (
                        <div className="space-y-2">
                          {instructions.map((instruction, index) => (
                            <div key={index} className="flex items-center gap-2">
                              <span className="text-orange-600">⚠️</span>
                              <span className="text-sm">{instruction}</span>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </CardBody>
                </Card>

                {/* Contact List */}
                <Card>
                  <CardHeader>
                    <h4 className="font-semibold">Contact List</h4>
                  </CardHeader>
                  <CardBody>
                    {(() => {
                      const contacts = getContactList(selectedEventForFunctionSheet);
                      return (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {contacts.map((contact, index) => (
                            <div key={index} className="p-3 bg-gray-50 rounded-lg">
                              <p className="font-medium">{contact.name}</p>
                              <p className="text-sm text-gray-600">{contact.role}</p>
                              <p className="text-sm">{contact.phone}</p>
                              <p className="text-sm">{contact.email}</p>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </CardBody>
                </Card>
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            <Button color="danger" variant="flat" onPress={() => setIsFunctionSheetModalOpen(false)}>
              Cancel
            </Button>
            <Button color="warning" variant="flat">
              💾 Save Function Sheet
            </Button>
            <Button color="success" variant="flat">
              📄 Generate PDF
            </Button>
            <Button color="primary">
              📧 Send to Teams
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Events Add/Edit Client modal removed; use canonical client form via redirect */}

      {/* Client View Modal */}
      <Modal 
        isOpen={isClientViewModalOpen} 
        onClose={() => setIsClientViewModalOpen(false)} 
        size="2xl"
        scrollBehavior="inside"
        classNames={{
          base: "max-w-[70vw] max-h-[90vh]",
          body: "p-6"
        }}
      >
        <ModalContent>
          <ModalHeader>
            <div className="flex items-center gap-2">
              <span className="text-2xl">👁️</span>
              <div>
                <h3 className="text-lg font-semibold">
                  Client Details
                </h3>
                <p className="text-sm text-gray-600">Viewing client information and contract details</p>
              </div>
            </div>
          </ModalHeader>
          <ModalBody>
            {selectedClient && (
              <>
                {/* Client Basic Information */}
                <div className="mb-8">
                  <h4 className="font-semibold text-lg mb-4 flex items-center gap-2">
                    👤 Basic Information
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-600">Client Name</p>
                      <p className="font-medium">{selectedClient.name}</p>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-600">Position/Title</p>
                      <p className="font-medium">{selectedClient.position}</p>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-600">Contact Number</p>
                      <p className="font-medium">{selectedClient.contact}</p>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-600">Email Address</p>
                      <p className="font-medium text-blue-600">{selectedClient.email}</p>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-600">WhatsApp Available</p>
                      <p className="font-medium">{selectedClient.whatsapp ? '✅ Yes' : '❌ No'}</p>
                    </div>
                  </div>
                </div>

                {/* Company Information */}
                <div className="mb-8">
                  <h4 className="font-semibold text-lg mb-4 flex items-center gap-2">
                    🏢 Company & Organization
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="p-4 bg-blue-50 rounded-lg">
                      <p className="text-sm text-blue-600">Company Name</p>
                      <p className="font-medium text-blue-800">{selectedClient.organization}</p>
                    </div>
                    <div className="p-4 bg-blue-50 rounded-lg">
                      <p className="text-sm text-blue-600">Industry</p>
                      <p className="font-medium text-blue-800">{selectedClient.industry}</p>
                    </div>
                  </div>
                </div>

                {/* Contract & Rates */}
                <div className="mb-8">
                  <h4 className="font-semibold text-lg mb-4 flex items-center gap-2">
                    💼 Contract & Rates
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="p-4 bg-green-50 rounded-lg">
                      <p className="text-sm text-green-600">Contract Status</p>
                      <Badge 
                        color={selectedClient.contractStatus === 'active' ? 'success' : 
                               selectedClient.contractStatus === 'expired' ? 'warning' : 
                               selectedClient.contractStatus === 'pending' ? 'primary' : 'default'}
                        variant="flat"
                      >
                        {selectedClient.contractStatus}
                      </Badge>
                    </div>
                    <div className="p-4 bg-green-50 rounded-lg">
                      <p className="text-sm text-green-600">Contract Period</p>
                      <p className="font-medium text-green-800">
                        {selectedClient.contractStart} to {selectedClient.contractEnd}
                      </p>
                    </div>
                    <div className="p-4 bg-purple-50 rounded-lg">
                      <p className="text-sm text-purple-600">Accommodation Rate</p>
                      <p className="font-medium text-purple-800">₵{selectedClient.rates.accommodation}/night</p>
                    </div>
                    <div className="p-4 bg-purple-50 rounded-lg">
                      <p className="text-sm text-purple-600">Conference Rate</p>
                      <p className="font-medium text-purple-800">₵{selectedClient.rates.conference}/head</p>
                    </div>
                    <div className="p-4 bg-purple-50 rounded-lg">
                      <p className="text-sm text-purple-600">Catering Rate</p>
                      <p className="font-medium text-purple-800">₵{selectedClient.rates.catering}/head</p>
                    </div>
                  </div>
                </div>

                {/* Special Terms */}
                {selectedClient.specialTerms && (
                  <div className="mb-8">
                    <h4 className="font-semibold text-lg mb-4 flex items-center gap-2">
                      ⭐ Special Terms & Conditions
                    </h4>
                    <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                      <p className="text-yellow-800">{selectedClient.specialTerms}</p>
                    </div>
                  </div>
                )}
              </>
            )}
          </ModalBody>
          <ModalFooter>
            <Button color="primary" variant="flat" onPress={() => setIsClientViewModalOpen(false)}>
              Close
            </Button>
            <Button 
              color="success" 
              onPress={() => {
                setIsClientViewModalOpen(false);
                setIsContractModalOpen(true);
              }}
            >
              📄 Generate Contract
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Client Edit Modal */}
      <Modal 
        isOpen={isClientEditModalOpen} 
        onClose={() => setIsClientEditModalOpen(false)} 
        size="2xl"
        scrollBehavior="inside"
        classNames={{
          base: "max-w-[70vw] max-h-[90vh]",
          body: "p-6"
        }}
      >
        <ModalContent>
          <ModalHeader>
            <div className="flex items-center gap-2">
              <span className="text-2xl">✏️</span>
              <div>
                <h3 className="text-lg font-semibold">
                  Edit Client
                </h3>
                <p className="text-sm text-gray-600">Update client information and contract details</p>
              </div>
            </div>
          </ModalHeader>
          <ModalBody>
            {selectedClient && (
              <>
                {/* Client Basic Information */}
                <div className="mb-8">
                  <h4 className="font-semibold text-lg mb-4 flex items-center gap-2">
                    👤 Basic Information
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Input
                      label="Client Name"
                      placeholder="e.g., Kwame Asante"
                      defaultValue={selectedClient.name}
                      required
                    />
                    <Input
                      label="Position/Title"
                      placeholder="e.g., Events Manager, CEO, Director"
                      defaultValue={selectedClient.position}
                      required
                    />
                    <Input
                      label="Contact Number"
                      placeholder="+233 24 123 4567"
                      defaultValue={selectedClient.contact}
                      required
                    />
                    <Input
                      label="Email Address"
                      type="email"
                      placeholder="client@company.com"
                      defaultValue={selectedClient.email}
                      required
                    />
                    <div className="md:col-span-2">
                      <div className="flex items-center gap-3 p-4 bg-green-50 rounded-lg border border-green-200">
                        <input 
                          type="checkbox" 
                          id="whatsapp-available-edit" 
                          className="w-5 h-5 text-green-600 rounded focus:ring-green-500" 
                          defaultChecked={selectedClient.whatsapp}
                        />
                        <label htmlFor="whatsapp-available-edit" className="text-lg font-medium text-green-800">
                          📱 WhatsApp Available
                        </label>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Company/Organization Details */}
                <div className="mb-8">
                  <h4 className="font-semibold text-lg mb-4 flex items-center gap-2">
                    🏢 Company & Organization
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Input
                      label="Company Name"
                      placeholder="e.g., Ghana Tech Solutions Ltd"
                      defaultValue={selectedClient.organization}
                      required
                    />
                    <Input
                      label="Industry"
                      placeholder="e.g., Technology, Manufacturing, etc."
                      defaultValue={selectedClient.industry}
                      required
                    />
                  </div>
                </div>

                {/* Contract & Rates Configuration */}
                <div className="mb-8">
                  <h4 className="font-semibold text-lg mb-4 flex items-center gap-2">
                    💼 Contract & Rates Configuration
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Input
                      label="Contract Start Date"
                      type="date"
                      defaultValue={selectedClient.contractStart}
                      required
                    />
                    <Input
                      label="Contract End Date"
                      type="date"
                      defaultValue={selectedClient.contractEnd}
                      required
                    />
                    <Input
                      label="Accommodation Rate (₵/night)"
                      type="number"
                      placeholder="450"
                      defaultValue={selectedClient.rates.accommodation}
                      startContent={<span className="text-gray-500">₵</span>}
                      required
                    />
                    <Input
                      label="Conference Rate (₵/head)"
                      type="number"
                      placeholder="250"
                      defaultValue={selectedClient.rates.conference}
                      startContent={<span className="text-gray-500">₵</span>}
                      required
                    />
                    <Input
                      label="Catering Rate (₵/head)"
                      type="number"
                      placeholder="180"
                      defaultValue={selectedClient.rates.catering}
                      startContent={<span className="text-gray-500">₵</span>}
                      required
                    />
                    <Select label="Contract Status" placeholder="Select status" defaultSelectedKeys={[selectedClient.contractStatus]} required>
                      <SelectItem key="active">Active</SelectItem>
                      <SelectItem key="pending">Pending</SelectItem>
                      <SelectItem key="expired">Expired</SelectItem>
                      <SelectItem key="draft">Draft</SelectItem>
                    </Select>
                  </div>
                </div>

                {/* Special Terms */}
                <div className="mb-8">
                  <h4 className="font-semibold text-lg mb-4 flex items-center gap-2">
                    ⭐ Special Terms & Conditions
                  </h4>
                  <Textarea
                    label="Special Terms & Conditions"
                    placeholder="Any special terms, corporate discounts, or unique arrangements..."
                    defaultValue={selectedClient.specialTerms}
                    rows={3}
                  />
                </div>
              </>
            )}
          </ModalBody>
          <ModalFooter>
            <Button color="danger" variant="flat" onPress={() => setIsClientEditModalOpen(false)}>
              Cancel
            </Button>
            <Button color="primary" onPress={() => handleClientEdit()}>
              Save Changes
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Contract Generation Modal */}
      <Modal 
        isOpen={isContractModalOpen} 
        onClose={() => setIsContractModalOpen(false)} 
        size="4xl"
        scrollBehavior="inside"
        classNames={{
          base: "max-w-[80vw] max-h-[90vh]",
          body: "p-6"
        }}
      >
        <ModalContent>
          <ModalHeader>
            <div className="flex items-center gap-2">
              <span className="text-2xl">📄</span>
              <div>
                <h3 className="text-lg font-semibold">
                  Generate Contract
                </h3>
                <p className="text-sm text-gray-600">Professional contract with negotiated rates and terms</p>
              </div>
            </div>
          </ModalHeader>
          <ModalBody>
            {selectedClient && (
              <div className="space-y-8">
                {/* Contract Header */}
                <div className="text-center border-b-2 border-gray-200 pb-6">
                  <h1 className="text-3xl font-bold text-gray-800 mb-2">EVENT SERVICES CONTRACT</h1>
                  <p className="text-gray-600">Between Ghana Hotel & Conference Center and {selectedClient.organization}</p>
                  <p className="text-sm text-gray-500 mt-2">Contract Period: {selectedClient.contractStart} to {selectedClient.contractEnd}</p>
                </div>

                {/* Client Information */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="p-6 bg-blue-50 rounded-lg border border-blue-200">
                    <h4 className="font-semibold text-blue-800 mb-4">Client Details</h4>
                    <div className="space-y-2">
                      <p><strong>Name:</strong> {selectedClient.name}</p>
                      <p><strong>Position:</strong> {selectedClient.position}</p>
                      <p><strong>Organization:</strong> {selectedClient.organization}</p>
                      <p><strong>Contact:</strong> {selectedClient.contact}</p>
                      <p><strong>Email:</strong> {selectedClient.email}</p>
                      <p><strong>WhatsApp:</strong> {selectedClient.whatsapp ? 'Available' : 'Not Available'}</p>
                    </div>
                  </div>
                  <div className="p-6 bg-green-50 rounded-lg border border-green-200">
                    <h4 className="font-semibold text-green-800 mb-4">Contract Information</h4>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span><strong>Status:</strong></span>
                        <Badge 
                          color={selectedClient.contractStatus === 'active' ? 'success' : 
                                 selectedClient.contractStatus === 'expired' ? 'warning' : 
                                 selectedClient.contractStatus === 'pending' ? 'primary' : 'default'}
                          variant="flat"
                        >
                          {selectedClient.contractStatus}
                        </Badge>
                      </div>
                      <div><strong>Start Date:</strong> {selectedClient.contractStart}</div>
                      <div><strong>End Date:</strong> {selectedClient.contractEnd}</div>
                      <div><strong>Generated:</strong> {new Date().toLocaleDateString()}</div>
                    </div>
                  </div>
                </div>

                {/* Negotiated Rates */}
                <div className="p-6 bg-purple-50 rounded-lg border border-purple-200">
                  <h4 className="font-semibold text-purple-800 mb-4">Negotiated Rates & Services</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="text-center p-4 bg-white rounded-lg">
                      <h5 className="font-medium text-purple-700 mb-2">Accommodation</h5>
                      <p className="text-2xl font-bold text-purple-800">₵{selectedClient.rates.accommodation}</p>
                      <p className="text-sm text-gray-600">per night</p>
                    </div>
                    <div className="text-center p-4 bg-white rounded-lg">
                      <h5 className="font-medium text-purple-700 mb-2">Conference Services</h5>
                      <p className="text-2xl font-bold text-purple-800">₵{selectedClient.rates.conference}</p>
                      <p className="text-sm text-gray-600">per person</p>
                    </div>
                    <div className="text-center p-4 bg-white rounded-lg">
                      <h5 className="font-medium text-purple-700 mb-2">Catering</h5>
                      <p className="text-2xl font-bold text-purple-800">₵{selectedClient.rates.catering}</p>
                      <p className="text-sm text-gray-600">per person</p>
                    </div>
                  </div>
                </div>

                {/* Special Terms */}
                {selectedClient.specialTerms && (
                  <div className="p-6 bg-yellow-50 rounded-lg border border-yellow-200">
                    <h4 className="font-semibold text-yellow-800 mb-4">Special Terms & Conditions</h4>
                    <p className="text-yellow-800">{selectedClient.specialTerms}</p>
                  </div>
                )}

                {/* Contract Terms */}
                <div className="p-6 bg-gray-50 rounded-lg border border-gray-200">
                  <h4 className="font-semibold text-gray-800 mb-4">Standard Contract Terms</h4>
                  <div className="space-y-3 text-sm text-gray-700">
                    <p>• <strong>Payment Terms:</strong> 50% deposit required upon booking, balance due 7 days before event</p>
                    <p>• <strong>Cancellation Policy:</strong> 30 days notice required for full refund, 14 days for 50% refund</p>
                    <p>• <strong>Force Majeure:</strong> Events beyond our control may result in rescheduling or refund</p>
                    <p>• <strong>Liability:</strong> Ghana Hotel & Conference Center liability limited to contract value</p>
                    <p>• <strong>Governing Law:</strong> This contract is governed by the laws of Ghana</p>
                  </div>
                </div>

                {/* Signature Section */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="p-6 bg-white rounded-lg border border-gray-200">
                    <h4 className="font-semibold text-gray-800 mb-4">Client Signature</h4>
                    <div className="border-t-2 border-gray-300 pt-4">
                      <p className="text-sm text-gray-600 mb-2">Client Name: _________________</p>
                      <p className="text-sm text-gray-600 mb-2">Date: _________________</p>
                      <p className="text-sm text-gray-600">Signature: _________________</p>
                    </div>
                  </div>
                  <div className="p-6 bg-white rounded-lg border border-gray-200">
                    <h4 className="font-semibold text-gray-800 mb-4">Hotel Representative</h4>
                    <div className="border-t-2 border-gray-300 pt-4">
                      <p className="text-sm text-gray-600 mb-2">Name: _________________</p>
                      <p className="text-sm text-gray-600 mb-2">Date: _________________</p>
                      <p className="text-sm text-gray-600">Signature: _________________</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            <Button color="danger" variant="flat" onPress={() => setIsContractModalOpen(false)}>
              Cancel
            </Button>
            <Button color="success" onPress={() => handleContractDownload()}>
              📥 Download PDF
            </Button>
            <Button color="primary" onPress={() => handleContractPrint()}>
              🖨️ Print Contract
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
