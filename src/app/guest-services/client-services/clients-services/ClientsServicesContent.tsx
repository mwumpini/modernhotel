'use client';

import React, { useEffect, useMemo, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import PageLayout from '../../../components/PageLayout';
import HeadingInfo from '../../../components/HeadingInfo';
import { confirmDanger, confirmDelete } from '../../../components/DangerConfirm';
import FrontOfficeBackButton from '../../../components/FrontOfficeBackButton';
import { Card, CardBody, Button, Input, Select, SelectItem, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, Badge, Chip, Switch, Tooltip } from '@heroui/react';
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Textarea, useDisclosure } from '@heroui/react';
import { worksheetTableClassNames } from '../../../components/frontoffice/StayWorksheetTable';
import { frontOfficeStore } from '../../../lib/frontoffice/store';
import { useSettingsStore } from '../../../lib/settings/store';
import { COUNTRIES, countryCodeToNationalityAdjective } from '../../../lib/countries';
import { Autocomplete, AutocompleteItem } from '@heroui/react';
import { GuestProfile, Reservation, Nationality } from '../../../lib/frontoffice/types';
import { isCorporateGuest } from '../../../lib/frontoffice/helpers/guests';
import { trackEvent } from '../../../lib/analytics/trackEvent';
interface ClientRow {
	id: string;
	serialNumber: string;
	name: string;
	email?: string;
	phone?: string;
	secondaryPhone?: string;
	type: 'individual' | 'corporate';
	gender?: string;
	nationality?: string;
	dateOfBirth?: string;
	company?: string;
	jobTitle?: string;
	industry?: string;
	contactPerson?: string;
	contactPosition?: string;
	contactPhone?: string;
	contactEmail?: string;
	address?: string;
	city?: string;
	country?: string;
	services: number;
	totalSpent: number;
	lastVisit?: string;
	preferences?: ClientPreferences;
	reservationCount: number;
	createdAt: string;
	isActive: boolean;
}

interface ClientPreferences {
	preferredRoomType?: 'standard' | 'deluxe' | 'suite';
	preferredFloor?: 'low' | 'middle' | 'high';
	allergies?: string[];
	dietaryRestrictions?: string[];
	roomService?: boolean;
	housekeepingFrequency?: 'daily' | 'every_other_day' | 'weekly';
	checkInTime?: 'early' | 'standard' | 'late';
	checkOutTime?: 'early' | 'standard' | 'late';
	specialRequests?: string[];
	newsletter?: boolean;
	marketingEmails?: boolean;
	bloodGroup?: 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-';
	medications?: string;
	familyCompanions?: string;
	emergencyName?: string;
	emergencyRelationship?: 'spouse' | 'parent' | 'child' | 'sibling' | 'friend' | 'colleague' | 'other';
	emergencyPhone?: string;
	emergencyEmail?: string;
	emergencyAddress?: string;
	bankName?: string;
	bankAccount?: string;
	preferredPaymentMethod?: 'cash' | 'card' | 'mobile_money' | 'bank_transfer' | 'corporate_billing';
}

interface ClientService {
	id: string;
	clientId: string;
	serviceName: string;
	serviceType: 'amenity' | 'package' | 'contract';
	rate: number;
	notes?: string;
	contractStart?: string;
	contractEnd?: string;
	status: 'active' | 'inactive' | 'expired';
	isActive: boolean;
	createdAt: string;
}

interface ReservationHistory {
	id: string;
	roomNumber: string;
	roomType: string;
	checkIn: string;
	checkOut: string;
	status: 'confirmed' | 'checked-in' | 'checked-out' | 'cancelled';
	totalAmount: number;
	rate: number;
	services: string[];
	notes?: string;
}

export function ClientsServicesContent({ embedded = false }: { embedded?: boolean }) {
	const [rows, setRows] = useState<ClientRow[]>([]);
	const [searchTerm, setSearchTerm] = useState('');
	const [typeFilter, setTypeFilter] = useState<'all' | 'individual' | 'corporate'>('all');
	const [countryFilter, setCountryFilter] = useState<string>('all');
	const [localityFilter, setLocalityFilter] = useState<'all'|'local'|'foreigner'>('all');
	const [dobFrom, setDobFrom] = useState<string>('');
	const [dobTo, setDobTo] = useState<string>('');
	const [companyFilter, setCompanyFilter] = useState<string>('');
	const [idFilter, setIdFilter] = useState<string>('');
	const [showProfile, setShowProfile] = useState<null | string>(null);
	const [showMessageFor, setShowMessageFor] = useState<null | string>(null);
	const fileRef = React.useRef<HTMLInputElement|null>(null);
    const [selected, setSelected] = useState<ClientRow | null>(null);
    const [showDuplicates, setShowDuplicates] = useState(false);
    const [duplicateList, setDuplicateList] = useState<Array<{primaryId:string;dupId:string;reason:string}>>([]);
    const { isOpen, onOpen, onClose } = useDisclosure();
    const { isOpen: isNewOpen, onOpen: onNewOpen, onClose: onNewClose } = useDisclosure();
    const canManageGuests = useSettingsStore((s) => s.hasPermission('frontdesk.manage-clients'));
    const canManageCompanies = useSettingsStore((s) => s.hasPermission('frontdesk.manage-company-clients'));
    const [serviceName, setServiceName] = useState('');
    const [serviceType, setServiceType] = useState('');
    const [rate, setRate] = useState('');
    const [notes, setNotes] = useState('');
    const [contractStart, setContractStart] = useState('');
    const [contractEnd, setContractEnd] = useState('');
    const [clientServices, setClientServices] = useState<ClientService[]>([]);
    const [reservationHistory, setReservationHistory] = useState<ReservationHistory[]>([]);
    const [showPreferences, setShowPreferences] = useState(false);
    const settings = useSettingsStore();
    const defaultCountryCode = settings?.defaultCountry || 'GH';
    const [newClientStep, setNewClientStep] = useState<'basic'|'secondary'>('basic');
    const [editClientId, setEditClientId] = useState<string | null>(null);
    const searchParams = useSearchParams();
    const router = useRouter();
    const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
    const [genderFilter, setGenderFilter] = useState<string>('all');
    const [nationalityFilter, setNationalityFilter] = useState<string>('all');
    const [industryFilter, setIndustryFilter] = useState<string>('');
    const [reservationFilter, setReservationFilter] = useState<string>('all');
    const [dateJoinedFrom, setDateJoinedFrom] = useState<string>('');
    const [dateJoinedTo, setDateJoinedTo] = useState<string>('');
    
    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage] = useState(20);
    const [sortState, setSortState] = useState<{ column: string; direction: 'asc'|'desc' }>({ column: 'name', direction: 'asc' });
    const defaultColWidths: Record<string, number> = { 
        index: 40, id: 90, name: 200, email: 150, phone: 110, secondaryPhone: 110, 
        gender: 70, nationality: 90, dob: 90, company: 150, jobTitle: 120, 
        industry: 120, contactPerson: 140, address: 160, city: 90, 
        type: 110, reservations: 90, services: 80, dateJoined: 100
    };
    const [colWidths, setColWidths] = useState<Record<string, number>>(defaultColWidths);
    
    // People and companies do not share a column set. "All" keeps a Type column so both can sit in one list.
    const visibleColumns: Array<keyof typeof colWidths> = typeFilter === 'corporate'
        ? ['index', 'id', 'name', 'contactPerson', 'email', 'phone', 'reservations']
        : typeFilter === 'individual'
            ? ['index', 'id', 'name', 'email', 'phone', 'nationality', 'reservations']
            : ['index', 'id', 'name', 'type', 'email', 'phone', 'reservations'];
    
    // Optimized form input handlers
    const handleInputChange = React.useCallback((field: string, value: any) => {
        setNewClient(prev => ({ ...prev, [field]: value }));
    }, []);
    
    const handleSelectChange = React.useCallback((field: string, selection: any) => {
        const value = Array.from(selection as Set<string>)[0];
        setNewClient(prev => ({ ...prev, [field]: value }));
    }, []);

    // Lightweight validators
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneRegex = /^\+?[0-9()\-\s]{7,20}$/;
    const validateEmail = (val?: string) => !!val && emailRegex.test(val);
    const validatePhone = (val?: string) => !!val && phoneRegex.test(val);
    const validateCredit = (val?: string) => (val === '' || val === undefined) ? true : !Number.isNaN(Number(val));
    // ID is optional. If a number is typed, it must look like one (4+ characters).
    const validateId = (type?: string, num?: string) => {
        if (!type || !num || !num.trim()) return true;
        return num.trim().length >= 4;
    };

    const [newClient, setNewClient] = useState({
        firstName: '',
        middleName: '',
        lastName: '',
        email: '',
        phone: '',
        secondaryPhone: '',
        type: 'individual' as 'individual' | 'corporate',
        companyName: '',
        industry: '',
        industryOther: '',
        registrationNumber: '',
        taxId: '',
        vatNumber: '',
        companyPhone: '',
        companyEmail: '',
        website: '',
        companyCountryCode: defaultCountryCode,
        companyAddressLine1: '',
        companyAddressLine2: '',
        companyCity: '',
        companyRegion: '',
        companyPostalCode: '',
        contactPersonName: '',
        contactPersonPosition: '',
        contactPersonPhone: '',
        contactPersonEmail: '',
        paymentTerms: '',
        creditLimit: '',
        corporateAccountNumber: '',
        // Corporate secondary details
        billingSameAsCompany: true,
        billingContactName: '',
        billingContactEmail: '',
        billingContactPhone: '',
        accountsEmail: '',
        requirePO: false,
        poRequirement: 'number' as 'none'|'number'|'attachment',
        invoiceCurrency: 'GHS',
        corpContacts: [] as Array<{id: string; name: string; position: string; phone: string; email: string;}>,
        contactDraft: { name: '', position: '', phone: '', email: '' } as { name: string; position: string; phone: string; email: string },
        invoiceDelivery: 'email' as 'email'|'paper'|'portal',
        contractStart: '',
        contractEnd: '',
        contractStatus: 'active' as 'active'|'pending'|'expired'|'suspended',
        contractNotes: '',
        isCorporate: false,
        countryCode: defaultCountryCode,
        idType: 'ghana_card' as 'ghana_card' | 'passport' | 'drivers_license' | 'national_id' | 'voters_id' | 'nhis_card' | 'other',
        idNumber: '',
        gender: 'prefer_not_to_say' as 'male' | 'female' | 'other' | 'prefer_not_to_say',
        dateOfBirth: '',
        idExpiry: '',
        idIssuingAuthority: '',
        maritalStatus: 'single' as 'single'|'married'|'divorced'|'widowed'|'separated'|'other',
        addressLine1: '',
        addressLine2: '',
        city: '',
        region: '',
        postalCode: '',
        emergencyName: '',
        emergencyRelationship: 'other' as 'spouse'|'parent'|'child'|'sibling'|'friend'|'colleague'|'other',
        emergencyPhone: '',
        emergencyEmail: '',
        emergencyAddress: '',
        bankName: '',
        bankAccount: '',
        preferredPaymentMethod: 'cash' as 'cash' | 'card' | 'mobile_money' | 'bank_transfer' | 'corporate_billing',
        preferences: {
            preferredRoomType: 'standard',
            preferredFloor: 'middle',
            allergies: [],
            dietaryRestrictions: [],
            roomService: true,
            housekeepingFrequency: 'daily',
            checkInTime: 'standard',
            checkOutTime: 'standard',
            specialRequests: [],
            newsletter: false,
            marketingEmails: false
        } as ClientPreferences
    });

    // Build rows from store state - Simplified and responsive
    const computeRows = React.useCallback(() => {
			const guests = frontOfficeStore.guests || [];
			const reservations = frontOfficeStore.reservations || [];
			const services = frontOfficeStore.clientServices || [];
        
        
        // Update client services if changed
        if (JSON.stringify(services) !== JSON.stringify(clientServices)) {
			setClientServices(services);
        }

        // Create maps for efficient lookups
        const reservationMap = new Map<string, Reservation[]>();
        const serviceMap = new Map<string, number>();
        
        reservations.forEach((r: Reservation) => {
            const key = r.guestId;
            if (!reservationMap.has(key)) reservationMap.set(key, []);
            reservationMap.get(key)!.push(r);
        });
        
        services.forEach((s: ClientService) => {
            if (s.isActive) {
                serviceMap.set(s.clientId, (serviceMap.get(s.clientId) || 0) + 1);
            }
        });

			const rowsData: ClientRow[] = guests.map((g: GuestProfile) => {
            const lastIsCorporate = String((g as any).lastName || '').toLowerCase() === 'corporate';
            const isCorp = isCorporateGuest(g);
            const corpMeta: any = (g as any).corporateMeta || {};
            const corpContact = corpMeta.contactPerson || {};
            
            // Name logic
            const defaultFullName = [g.firstName, g.middleName, g.lastName].filter(Boolean).join(' ').trim() || 'Unknown';
            const inferredCompany = lastIsCorporate ? (g as any).firstName : undefined;
            const companyName = (g as any).companyName || corpMeta.companyName || inferredCompany;
            const fullName = isCorp ? (companyName || 'Unknown Company') : defaultFullName;
            
            // Contact info
            const companyEmail = (g as any).companyEmail || corpMeta.terms?.accountsEmail || g.email;
            const companyPhone = (g as any).companyPhone || corpContact.phone || g.phone;
            
            // Reservation and service data
            const clientReservations = reservationMap.get(g.id) || [];
            const clientServicesCount = serviceMap.get(g.id) || 0;
            const totalSpent = clientReservations.reduce((sum: number, r: Reservation) => 
                sum + (r.rateBreakdown?.reduce((s: number, d) => s + d.total, 0) || 0), 0);
                const lastVisit = clientReservations.length > 0 ? 
                    clientReservations.sort((a, b) => new Date(b.departure).getTime() - new Date(a.departure).getTime())[0]?.departure : undefined;
                
                return {
                    id: g.id,
                serialNumber: g.serialNumber,
                    name: fullName,
                email: isCorp ? companyEmail : g.email,
                phone: isCorp ? companyPhone : g.phone,
                secondaryPhone: g.secondaryPhone,
                type: isCorp ? 'corporate' : 'individual',
                gender: isCorp ? 'N/A' : g.gender,
                nationality: g.nationality,
                dateOfBirth: g.dateOfBirth,
                company: isCorp ? (companyName || (g as any).companyName) : g.employerCompany,
                jobTitle: g.jobTitle,
                industry: corpMeta.industry,
                contactPerson: corpContact.name,
                contactPosition: corpContact.position,
                contactPhone: corpContact.phone,
                contactEmail: corpContact.email,
                address: isCorp ? `${corpMeta.address?.line1 || ''} ${corpMeta.address?.line2 || ''}`.trim() : '',
                city: isCorp ? corpMeta.address?.city : '',
                country: isCorp ? corpMeta.address?.countryCode : '',
                    services: clientServicesCount,
                    totalSpent,
                    lastVisit,
                preferences: {
                    preferredRoomType: (g as any).preferences?.preferredRoomType || 'standard',
                    preferredFloor: (g as any).preferences?.preferredFloor || 'middle',
                    allergies: Array.isArray((g as any).preferences?.allergies) ? (g as any).preferences.allergies : [],
                    dietaryRestrictions: Array.isArray((g as any).preferences?.dietaryRestrictions) ? (g as any).preferences.dietaryRestrictions : [],
                    roomService: (g as any).preferences?.roomService ?? true,
                    housekeepingFrequency: (g as any).preferences?.housekeepingFrequency || 'daily',
                    checkInTime: (g as any).preferences?.checkInTime || 'standard',
                    checkOutTime: (g as any).preferences?.checkOutTime || 'standard',
                    specialRequests: Array.isArray((g as any).preferences?.specialRequests) ? (g as any).preferences.specialRequests : [],
                    newsletter: (g as any).preferences?.newsletter ?? false,
                    marketingEmails: (g as any).preferences?.marketingEmails ?? false
                },
                createdAt: (g as any).createdAt || new Date().toISOString(),
                    reservationCount: clientReservations.length,
                    isActive: g.isActive !== false,
                };
            });
        
        // Update rows immediately
			setRows(rowsData);
    }, [clientServices]);

    // Subscribe to store changes and update table immediately
    useEffect(() => {
        computeRows();
        const unsubscribe = frontOfficeStore.subscribe(() => {
            computeRows();
        });
        return unsubscribe;
    }, [computeRows]);
    
    // One-time normalization: ensure corporate clients are labeled and shaped correctly
    useEffect(() => {
        try {
            for (const g of frontOfficeStore.guests as any[]) {
                const lastIsCorporate = String(g?.lastName || '').toLowerCase() === 'corporate';
                const inferredCompany = lastIsCorporate ? g?.firstName : undefined;
                const companyName: string | undefined = g?.companyName || g?.corporateMeta?.companyName || inferredCompany;
                const looksCorporate = isCorporateGuest(g) || !!companyName;
                if (looksCorporate) {
                    const updates: any = {};
                    if (!g.isCorporate) updates.isCorporate = true;
                    if (!g.companyName && companyName) updates.companyName = companyName;
                    if (g.lastName && g.lastName.toLowerCase() === 'corporate') updates.lastName = '';
                    // Ensure display name uses company
                    if (companyName && g.firstName !== companyName) updates.firstName = companyName;
                    if (Object.keys(updates).length > 0) {
                        frontOfficeStore.updateGuest(g.id, updates as any);
                    }
                }
            }
        } catch {}
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            // Cleanup any pending operations
        };
	}, []);


    // Auto-open modal from query (?new=1&type=corporate&name=John+Mensah)
    useEffect(() => {
        const openFlag = searchParams?.get('new');
        if (openFlag && !isNewOpen) {
            const t = (searchParams?.get('type') || '').toLowerCase();
            const nameParam = searchParams?.get('name')?.trim();
            const nameParts = nameParam ? nameParam.split(/\s+/) : [];

            setNewClient(prev => {
                const next = { ...prev };
                if ((t === 'corporate' && canManageCompanies) || (!canManageGuests && canManageCompanies)) {
                    next.type = 'corporate';
                    next.isCorporate = true;
                    if (nameParam) next.companyName = nameParam;
                } else {
                    next.type = 'individual';
                    next.isCorporate = false;
                    if (nameParts.length > 0) {
                        next.firstName = nameParts[0] || '';
                        next.lastName = nameParts.slice(1).join(' ') || '';
                    }
                }
                return next;
            });
            setNewClientStep('basic');
            onNewOpen();
            // Clean URL
            try { router.replace(window.location.pathname); } catch {}
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchParams, isNewOpen]);

    // Note: localStorage loading is now handled by the store constructor to avoid race conditions

    // Note: localStorage saving is now handled automatically by the store's notify() method

    // (Removed debounced search and virtual scrolling)

	const filtered = useMemo(() => {
		let list = [...rows];
		
		
		// Early return if no filters applied
		if (!searchTerm && typeFilter === 'all' && countryFilter === 'all' && 
			localityFilter === 'all' && !dobFrom && !dobTo && !companyFilter && !idFilter &&
			genderFilter === 'all' && nationalityFilter === 'all' && !industryFilter && 
			reservationFilter === 'all' && !dateJoinedFrom && !dateJoinedTo) {
			return list;
		}
		
		if (searchTerm) {
			const searchLower = searchTerm.toLowerCase();
			list = list.filter(r => (
				r.id.toLowerCase().includes(searchLower) ||
				r.serialNumber.toLowerCase().includes(searchLower) ||
				r.name.toLowerCase().includes(searchLower) ||
				r.email?.toLowerCase().includes(searchLower) ||
				r.phone?.includes(searchTerm) ||
				r.secondaryPhone?.includes(searchTerm) ||
				r.gender?.toLowerCase().includes(searchLower) ||
				r.nationality?.toLowerCase().includes(searchLower) ||
				r.company?.toLowerCase().includes(searchLower) ||
				r.jobTitle?.toLowerCase().includes(searchLower) ||
				r.industry?.toLowerCase().includes(searchLower) ||
				r.contactPerson?.toLowerCase().includes(searchLower) ||
				r.address?.toLowerCase().includes(searchLower) ||
				r.city?.toLowerCase().includes(searchLower) ||
				r.type.toLowerCase().includes(searchLower) ||
				// Search in preferences
				r.preferences?.preferredRoomType?.includes(searchLower) ||
				(r.preferences?.specialRequests && Array.isArray(r.preferences.specialRequests) && r.preferences.specialRequests.some(req => req.toLowerCase().includes(searchLower))) ||
				(r.preferences?.allergies && Array.isArray(r.preferences.allergies) && r.preferences.allergies.some(allergy => allergy.toLowerCase().includes(searchLower))) ||
				(r.preferences?.dietaryRestrictions && Array.isArray(r.preferences.dietaryRestrictions) && r.preferences.dietaryRestrictions.some(diet => diet.toLowerCase().includes(searchLower))) ||
				// Search by reservation count
				r.reservationCount.toString().includes(searchTerm) ||
				// Search by total spent
				r.totalSpent.toString().includes(searchTerm)
			));
		}
		if (typeFilter !== 'all') list = list.filter(r => r.type === typeFilter);
		if (countryFilter !== 'all') {
			list = list.filter(r => {
				const g = frontOfficeStore.guests.find(g=>g.id===r.id) as any;
				return (g?.countryCode || g?.companyCountryCode || settings.defaultCountry) === countryFilter;
			});
		}
		if (localityFilter !== 'all') {
			list = list.filter(r => {
				const g = frontOfficeStore.guests.find(g=>g.id===r.id) as any;
				const code = g?.countryCode || settings.defaultCountry;
				const isForeign = code !== settings.defaultCountry;
				return localityFilter === 'foreigner' ? isForeign : !isForeign;
			});
		}
		if (dobFrom) {
			list = list.filter(r => {
				const g = frontOfficeStore.guests.find(g=>g.id===r.id) as any;
				return g?.dateOfBirth && new Date(g.dateOfBirth) >= new Date(dobFrom);
			});
		}
		if (dobTo) {
			list = list.filter(r => {
				const g = frontOfficeStore.guests.find(g=>g.id===r.id) as any;
				return g?.dateOfBirth && new Date(g.dateOfBirth) <= new Date(dobTo);
			});
		}
		if (companyFilter) {
			const lc = companyFilter.toLowerCase();
			list = list.filter(r => {
				const g = frontOfficeStore.guests.find(g=>g.id===r.id) as any;
				return (g?.companyName || g?.employerCompany || '').toLowerCase().includes(lc);
			});
		}
		if (idFilter) {
			const lf = idFilter.toLowerCase();
			list = list.filter(r => r.id.toLowerCase().includes(lf));
		}
		
		// New filters
		if (genderFilter !== 'all') {
			list = list.filter(r => r.gender?.toLowerCase() === genderFilter.toLowerCase());
		}
		if (nationalityFilter !== 'all') {
			list = list.filter(r => r.nationality?.toLowerCase() === nationalityFilter.toLowerCase());
		}
		if (industryFilter) {
			const lc = industryFilter.toLowerCase();
			list = list.filter(r => r.industry?.toLowerCase().includes(lc));
		}
		if (reservationFilter !== 'all') {
			if (reservationFilter === 'none') {
				list = list.filter(r => r.reservationCount === 0);
			} else if (reservationFilter === '1-5') {
				list = list.filter(r => r.reservationCount >= 1 && r.reservationCount <= 5);
			} else if (reservationFilter === '6-10') {
				list = list.filter(r => r.reservationCount >= 6 && r.reservationCount <= 10);
			} else if (reservationFilter === '10+') {
				list = list.filter(r => r.reservationCount > 10);
			}
		}
		if (dateJoinedFrom) {
			list = list.filter(r => {
				const g = frontOfficeStore.guests.find(g=>g.id===r.id) as any;
				return g?.createdAt && new Date(g.createdAt) >= new Date(dateJoinedFrom);
			});
		}
		if (dateJoinedTo) {
			list = list.filter(r => {
				const g = frontOfficeStore.guests.find(g=>g.id===r.id) as any;
				return g?.createdAt && new Date(g.createdAt) <= new Date(dateJoinedTo);
			});
		}
		
		// Filtering complete
		return list;
	}, [rows, searchTerm, typeFilter, countryFilter, localityFilter, dobFrom, dobTo, companyFilter, idFilter, genderFilter, nationalityFilter, industryFilter, reservationFilter, dateJoinedFrom, dateJoinedTo, settings.defaultCountry]);

	// Reset to first page when filters change
	useEffect(() => {
		setCurrentPage(1);
	}, [searchTerm, typeFilter, countryFilter, localityFilter, dobFrom, dobTo, companyFilter, idFilter, genderFilter, nationalityFilter, industryFilter, reservationFilter, dateJoinedFrom, dateJoinedTo]);

	const stats = useMemo(() => {
		const totalClients = rows.length;
		const activeServices = rows.reduce((s, r) => s + r.services, 0);
		const contracts = rows.filter(r => r.type === 'corporate').length;
		const revenue = rows.reduce((s, r) => s + r.totalSpent, 0);
		return { totalClients, activeServices, contracts, revenue };
	}, [rows]);

    const openManage = (row: ClientRow) => {
        setSelected(row);
        setServiceName('');
        setServiceType('');
        setRate('');
        setNotes('');
        setContractStart('');
        setContractEnd('');
        onOpen();
    };

    const openPreferences = (row: ClientRow) => {
        setSelected(row);
        setShowPreferences(true);
    };

    const handleCreateClient = () => {
        // Simple validation
        if (newClient.type === 'corporate' ? !canManageCompanies : !canManageGuests) {
            return;
        }
        if (newClient.type === 'individual' && (!newClient.firstName.trim() || !newClient.lastName.trim() || !validatePhone(newClient.phone))) {
            return;
        }
        if (newClient.type === 'corporate' && (!newClient.companyName.trim() || !validatePhone(newClient.companyPhone) || !newClient.contactPersonName.trim() || !validatePhone(newClient.contactPersonPhone))) {
            return;
        }
        
        const nationality = countryCodeToNationalityAdjective(newClient.countryCode) as Nationality;

        // Guest fields shared by create + edit. serialNumber/id are deliberately absent:
        // createGuest() mints them once internally on create, and an edit must never
        // touch the guest's existing serial number.
        const newGuest: Partial<GuestProfile> = {
            firstName: newClient.type === 'corporate'
                ? newClient.companyName
                : newClient.firstName,
            lastName: newClient.type === 'corporate'
                ? ''
                : newClient.lastName,
            middleName: newClient.middleName || undefined,
            phone: (newClient.type === 'corporate' ? newClient.companyPhone : newClient.phone) || undefined,
            secondaryPhone: newClient.secondaryPhone || undefined,
            email: newClient.email || undefined,
            nationality,
            idType: newClient.idType,
            idNumber: newClient.idNumber,
            dateOfBirth: newClient.dateOfBirth || undefined,
            gender: newClient.gender,
            emergencyContact: {
                name: newClient.emergencyName || '',
                relationship: newClient.emergencyRelationship,
                phone: newClient.emergencyPhone || '',
                email: newClient.emergencyEmail || '',
                address: newClient.emergencyAddress || ''
            },
            source: 'walkin',
            updatedAt: new Date().toISOString(),
            employerCompany: (newClient as any).employerCompany || undefined,
            companyPhone: (newClient as any).companyPhone || undefined,
            jobTitle: (newClient as any).jobTitle || undefined,
            isCorporate: newClient.type === 'corporate',
        };

        // Add corporate metadata if corporate client
        if (newClient.type === 'corporate') {
            (newGuest as any).companyName = newClient.companyName;
            (newGuest as any).companyEmail = newClient.companyEmail;
            (newGuest as any).billingContactName = newClient.billingContactName || undefined;
            (newGuest as any).billingContactEmail = newClient.billingContactEmail || undefined;
            (newGuest as any).billingContactPhone = newClient.billingContactPhone || undefined;
            (newGuest as any).corporateMeta = {
                industry: newClient.industry,
                registrationNumber: newClient.registrationNumber,
                taxId: newClient.taxId,
                vatNumber: newClient.vatNumber,
                website: newClient.website,
                address: {
                    countryCode: newClient.companyCountryCode,
                    line1: newClient.companyAddressLine1,
                    line2: newClient.companyAddressLine2,
                    city: newClient.companyCity,
                    region: newClient.companyRegion,
                    postalCode: newClient.companyPostalCode,
                },
                contactPerson: {
                    name: newClient.contactPersonName,
                    position: newClient.contactPersonPosition,
                    phone: newClient.contactPersonPhone,
                    email: newClient.contactPersonEmail,
                },
                terms: {
                    paymentTerms: newClient.paymentTerms,
                    creditLimit: newClient.creditLimit,
                    corporateAccountNumber: newClient.corporateAccountNumber,
                    requirePO: newClient.requirePO,
                    poRequirement: newClient.poRequirement,
                    invoiceDelivery: newClient.invoiceDelivery,
                    invoiceCurrency: newClient.invoiceCurrency,
                    accountsEmail: newClient.accountsEmail,
                },
                contacts: newClient.corpContacts,
                contract: {
                    start: newClient.contractStart,
                    end: newClient.contractEnd,
                    status: newClient.contractStatus,
                    notes: newClient.contractNotes,
                },
            };
        }
        
        // Update store. Branching explicitly on editClientId (rather than "try update,
        // fall back to create") avoids pre-minting a serialNumber that would either
        // clobber an existing guest's number (edit) or get silently discarded and
        // double-burn the counter (create) — see getNextClientNumber() in settings/store.ts.
        if (editClientId) {
            frontOfficeStore.updateGuest(editClientId, newGuest as any);
        } else {
            frontOfficeStore.createGuest({ ...newGuest, createdAt: new Date().toISOString() } as any);
        }
        
        // Reset form
        setNewClient({
            firstName: '',
            middleName: '',
            lastName: '',
            email: '',
            phone: '',
            secondaryPhone: '',
            type: 'individual',
            companyName: '',
            industry: '',
            industryOther: '',
            registrationNumber: '',
            taxId: '',
            vatNumber: '',
            companyPhone: '',
            companyEmail: '',
            website: '',
            companyCountryCode: defaultCountryCode,
            companyAddressLine1: '',
            companyAddressLine2: '',
            companyCity: '',
            companyRegion: '',
            companyPostalCode: '',
            contactPersonName: '',
            contactPersonPosition: '',
            contactPersonPhone: '',
            contactPersonEmail: '',
            paymentTerms: '',
            creditLimit: '',
            corporateAccountNumber: '',
            billingSameAsCompany: true,
            billingContactName: '',
            billingContactEmail: '',
            billingContactPhone: '',
            accountsEmail: '',
            requirePO: false,
            poRequirement: 'number',
            invoiceCurrency: 'GHS',
            corpContacts: [],
            contactDraft: { name: '', position: '', phone: '', email: '' },
            invoiceDelivery: 'email',
            contractStart: '',
            contractEnd: '',
            contractStatus: 'active',
            contractNotes: '',
            isCorporate: false,
            countryCode: defaultCountryCode,
            idType: 'ghana_card',
            idNumber: '',
            gender: 'prefer_not_to_say',
            dateOfBirth: '',
            idExpiry: '',
            idIssuingAuthority: '',
            maritalStatus: 'single',
            addressLine1: '',
            addressLine2: '',
            city: '',
            region: '',
            postalCode: '',
            emergencyName: '',
            emergencyRelationship: 'other',
            emergencyPhone: '',
            emergencyEmail: '',
            emergencyAddress: '',
            bankName: '',
            bankAccount: '',
            preferredPaymentMethod: 'cash',
            preferences: {
                preferredRoomType: 'standard',
                preferredFloor: 'middle',
                allergies: [],
                dietaryRestrictions: [],
                roomService: true,
                housekeepingFrequency: 'daily',
                checkInTime: 'standard',
                checkOutTime: 'standard',
                specialRequests: [],
                newsletter: false,
                marketingEmails: false
            } as ClientPreferences
        });
        onNewClose();
        setEditClientId(null);
        setNewClientStep('basic');
        
        // Reset filters to show new client
        setTypeFilter('all');
        setCountryFilter('all');
        setLocalityFilter('all');
        setDobFrom('');
        setDobTo('');
        setCompanyFilter('');
        setIdFilter('');
    };


    const handleSaveService = () => {
        if (!selected || !serviceName || !serviceType || !rate) return;
        
        const newService: ClientService = {
            id: `service_${Date.now()}`,
            clientId: selected.id,
            serviceName,
            serviceType: serviceType as ClientService['serviceType'],
            rate: parseFloat(rate),
            notes: notes || undefined,
            contractStart: contractStart || undefined,
            contractEnd: contractEnd || undefined,
            status: 'active',
            isActive: true,
            createdAt: new Date().toISOString(),
        };
        
        // Add to store via API
        frontOfficeStore.addClientService(newService);
        
        onClose();
        setSelected(null);
        setServiceName('');
        setServiceType('');
        setRate('');
        setNotes('');
        setContractStart('');
        setContractEnd('');
    };

    const isForeigner = !!newClient.countryCode && newClient.countryCode !== defaultCountryCode;

    const openEdit = (row: ClientRow) => {
        const g = frontOfficeStore.guests.find(gg=>gg.id===row.id) as any;
        if (!g) return;
        setEditClientId(g.id);
        setNewClientStep('basic');
        setNewClient({
            firstName: g.firstName || '',
            middleName: g.middleName || '',
            lastName: g.lastName || '',
            email: g.email || '',
            phone: g.phone || '',
            secondaryPhone: g.secondaryPhone || '',
            type: isCorporateGuest(g) ? 'corporate' : 'individual',
            companyName: g.companyName || '',
            industry: g.corporateMeta?.industry || '',
            industryOther: '',
            registrationNumber: g.corporateMeta?.registrationNumber || '',
            taxId: g.corporateMeta?.taxId || '',
            vatNumber: g.corporateMeta?.vatNumber || '',
            companyPhone: (g as any).companyPhone || g.corporateMeta?.contactPerson?.phone || '',
            companyEmail: (g as any).companyEmail || g.corporateMeta?.terms?.accountsEmail || '',
            website: g.corporateMeta?.website || '',
            companyCountryCode: g.corporateMeta?.address?.countryCode || defaultCountryCode,
            companyAddressLine1: g.corporateMeta?.address?.line1 || '',
            companyAddressLine2: g.corporateMeta?.address?.line2 || '',
            companyCity: g.corporateMeta?.address?.city || '',
            companyRegion: g.corporateMeta?.address?.region || '',
            companyPostalCode: g.corporateMeta?.address?.postalCode || '',
            contactPersonName: g.corporateMeta?.contactPerson?.name || '',
            contactPersonPosition: g.corporateMeta?.contactPerson?.position || '',
            contactPersonPhone: g.corporateMeta?.contactPerson?.phone || '',
            contactPersonEmail: g.corporateMeta?.contactPerson?.email || '',
            paymentTerms: g.corporateMeta?.terms?.paymentTerms || '',
            creditLimit: g.corporateMeta?.terms?.creditLimit || '',
            corporateAccountNumber: g.corporateMeta?.terms?.corporateAccountNumber || '',
            billingSameAsCompany: g.corporateMeta?.billingSameAsCompany || true,
            billingContactName: g.billingContactName || '',
            billingContactEmail: g.billingContactEmail || '',
            billingContactPhone: g.billingContactPhone || '',
            accountsEmail: g.corporateMeta?.terms?.accountsEmail || '',
            requirePO: !!g.corporateMeta?.terms?.requirePO,
            poRequirement: g.corporateMeta?.terms?.poRequirement || 'number',
            invoiceCurrency: g.corporateMeta?.terms?.invoiceCurrency || 'GHS',
            corpContacts: g.corporateMeta?.contacts || [],
            contactDraft: { name: '', position: '', phone: '', email: '' },
            invoiceDelivery: g.corporateMeta?.terms?.invoiceDelivery || 'email',
            contractStart: g.corporateMeta?.contract?.start || '',
            contractEnd: g.corporateMeta?.contract?.end || '',
            contractStatus: g.corporateMeta?.contract?.status || 'active',
            contractNotes: g.corporateMeta?.contract?.notes || '',
            isCorporate: !!g.isCorporate,
            countryCode: g.nationality ? (g.nationality === 'ghanaian' ? defaultCountryCode : g.countryCode || defaultCountryCode) : defaultCountryCode,
            idType: g.idType || 'ghana_card',
            idNumber: g.idNumber || '',
            gender: (isCorporateGuest(g) ? 'prefer_not_to_say' : (g.gender || 'prefer_not_to_say')),
            dateOfBirth: g.dateOfBirth || '',
            idExpiry: '',
            idIssuingAuthority: '',
            maritalStatus: 'single',
            addressLine1: g.addressLine1 || '',
            addressLine2: g.addressLine2 || '',
            city: g.city || '',
            region: g.region || '',
            postalCode: g.postalCode || '',
            employerCompany: g.employerCompany || '',
            jobTitle: g.jobTitle || '',
            emergencyName: g.emergencyContact?.name || '',
            emergencyRelationship: g.emergencyContact?.relationship || 'other',
            emergencyPhone: g.emergencyContact?.phone || '',
            emergencyEmail: g.emergencyContact?.email || '',
            emergencyAddress: g.emergencyContact?.address || '',
            bankName: g.bankName || '',
            bankAccount: g.bankAccount || '',
            preferredPaymentMethod: 'cash',
            preferences: g.preferences || {
                preferredRoomType: 'standard', preferredFloor: 'middle', allergies: [], dietaryRestrictions: [], roomService: true, housekeepingFrequency: 'daily', checkInTime: 'standard', checkOutTime: 'standard', specialRequests: [], newsletter: false, marketingEmails: false
            }
        } as any);
        onNewOpen();
    };

    const clientHasHistory = (row: ClientRow) =>
        row.reservationCount > 0 || row.services > 0 || frontOfficeStore.guestHasHistory(row.id);

    const handleDelete = async (row: ClientRow) => {
        const used = clientHasHistory(row);
        if (used) {
            if (!row.isActive) {
                const ok = await confirmDanger({
                    tone: 'delete',
                    title: `Reactivate ${row.name}?`,
                    message: 'Stay history stays in place. They can be used on new bookings again.',
                    confirmLabel: 'Reactivate',
                });
                if (!ok) return;
                frontOfficeStore.updateGuest(row.id, { isActive: true } as any);
                return;
            }
            const ok = await confirmDanger({
                tone: 'delete',
                title: `Deactivate ${row.name}?`,
                message: 'This profile has stay or folio history and cannot be deleted. It will be marked Inactive so it stays off new bookings. History is kept.',
                confirmLabel: 'Deactivate',
            });
            if (!ok) return;
            frontOfficeStore.retireGuest(row.id);
            return;
        }
        const ok = await confirmDelete(row.name, 'This client has no stay history and will be permanently removed.');
        if (!ok) return;
        frontOfficeStore.deleteGuest(row.id);
        frontOfficeStore.deleteClientServicesForClient(row.id);
    };

    const getSortableValue = (row: ClientRow, key: string) => {
        switch (key) {
            case 'id': return row.id;
            case 'name': return row.name;
            case 'email': return row.email || '';
            case 'phone': return row.phone || '';
            case 'secondaryPhone': return row.secondaryPhone || '';
            case 'gender': return row.gender || '';
            case 'nationality': return row.nationality || '';
            case 'dob': return row.dateOfBirth || '';
            case 'company': return row.company || '';
            case 'jobTitle': return row.jobTitle || '';
            case 'industry': return row.industry || '';
            case 'contactPerson': return row.contactPerson || '';
            case 'address': return row.address || '';
            case 'city': return row.city || '';
            case 'type': return row.type;
            case 'reservations': return row.reservationCount;
            case 'services': return row.services;
            case 'dateJoined': return row.createdAt || '';
            case 'index': return 0; // Index is always 0 for sorting purposes
            case 'actions': return ''; // Actions column is not sortable
            default: return '';
        }
    };

    const sorted = useMemo(() => {
        const list = [...filtered];
        const { column, direction } = sortState;
        const dir = direction === 'asc' ? 1 : -1;
        list.sort((a,b) => {
            const va = getSortableValue(a, column);
            const vb = getSortableValue(b, column);
            const na = typeof va === 'number' ? va : isNaN(Date.parse(va)) ? (va?.toString() || '').toLowerCase() : Date.parse(va);
            const nb = typeof vb === 'number' ? vb : isNaN(Date.parse(vb)) ? (vb?.toString() || '').toLowerCase() : Date.parse(vb);
            if (na < nb) return -1*dir; if (na > nb) return 1*dir; return 0;
        });
        		// Debug logging removed for production
        return list;
    }, [filtered, sortState]);

	// Pagination logic - AFTER sorting
	const totalItems = sorted.length;
	const totalPages = Math.ceil(totalItems / itemsPerPage);
	const startIndex = (currentPage - 1) * itemsPerPage;
	const endIndex = startIndex + itemsPerPage;
	const paginatedData = sorted.slice(startIndex, endIndex);
	
	
	// Debug logging
	// Debug logging removed for production
    const HeaderCell = ({ colKey, title }: { colKey: string; title: string }) => {
        const isSortable = colKey !== 'index';
        const isActive = sortState.column === colKey;
        
        return (
            <div className="flex items-center w-full select-none">
                <div 
                    className={`mx-1 flex items-center px-1 py-0.5 rounded transition-colors ${
                        isSortable 
                            ? 'cursor-pointer hover:bg-gray-100 active:bg-gray-200' 
                            : 'cursor-default'
                    }`}
                    onClick={() => {
                        if (isSortable) {
                            setSortState(prev => ({ 
                                column: colKey, 
                                direction: prev.column === colKey && prev.direction === 'asc' ? 'desc' : 'asc' 
                            }));
                        }
                    }}
                >
                    <span className="font-semibold text-ghana-black">{title}{isActive ? (sortState.direction === 'asc' ? ' ↑' : ' ↓') : ''}</span>
                </div>
            </div>
        );
    };

    const colStyle = (key: keyof typeof colWidths): React.CSSProperties => ({ 
        width: colWidths[key], 
        minWidth: colWidths[key]
    });

	const content = (
		<>
			<div className={embedded ? '' : 'py-8 px-6'}>
				<div className={embedded ? '' : 'max-w-[1800px] mx-auto'}>
					<div className="mb-[18px] flex flex-wrap items-center justify-between gap-2">
						<div className="flex min-w-0 items-center gap-1.5">
							{!embedded && <FrontOfficeBackButton />}
							<h2 className="text-lg font-semibold text-ghana-black">Clients</h2>
							<HeadingInfo label="About clients">People and companies who stay or bill with the hotel</HeadingInfo>
						</div>
						<div className="flex flex-wrap items-center justify-end gap-2">
                            <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={async e=>{
                                try {
                                    const file = e.target.files?.[0];
                                    if (!file) return;
                                    const raw = await file.text();
                                    const text = raw.replace(/^\ufeff/, ''); // remove BOM if present

                                    // Robust CSV parser for commas in quotes
                                    const parseCSV = (t: string): string[][] => {
                                        const rows: string[][] = [];
                                        let cur = '';
                                        let row: string[] = [];
                                        let inQuotes = false;
                                        for (let i = 0; i < t.length; i++) {
                                            const ch = t[i];
                                            const next = t[i + 1];
                                            if (ch === '"') {
                                                if (inQuotes && next === '"') { cur += '"'; i++; }
                                                else { inQuotes = !inQuotes; }
                                            } else if (ch === ',' && !inQuotes) {
                                                row.push(cur.trim()); cur = '';
                                            } else if ((ch === '\n' || ch === '\r') && !inQuotes) {
                                                if (ch === '\r' && next === '\n') { i++; }
                                                row.push(cur.trim()); rows.push(row); row = []; cur = '';
                                            } else {
                                                cur += ch;
                                            }
                                        }
                                        if (cur.length > 0 || row.length > 0) { row.push(cur.trim()); rows.push(row); }
                                        return rows.filter(r => r.some(c => c && c.length));
                                    };

                                    const rows = parseCSV(text);
                                    if (rows.length === 0) throw new Error('Empty CSV');
                                    const headerRaw = rows.shift()!;
                                    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '');
                                    const header = headerRaw.map(h => norm(h));

                                    const indexOf = (keys: string[]): number => {
                                        for (const k of keys) {
                                            const i = header.indexOf(k);
                                            if (i !== -1) return i;
                                        }
                                        return -1;
                                    };

                                    const idx = {
                                        firstName: indexOf(['firstname','first','givenname']),
                                        lastName: indexOf(['lastname','last','surname','familyname']),
                                        companyName: indexOf(['company','companyname','organization','organisation']),
                                        email: indexOf(['email','emailaddress']),
                                        phone: indexOf(['phone','phonenumber','mobile','mobilephone','tel']),
                                        id: indexOf(['id','clientid','code']),
                                        emergencyName: indexOf(['emergencyname','emergencycontact','emergencycontactname']),
                                        emergencyPhone: indexOf(['emergencyphone','emergencycontactphone'])
                                    };

                                    const guests: any[] = [];
                                    for (const r of rows) {
                                        const pick = (i: number) => (i >= 0 && r[i] !== undefined) ? r[i] : '';
                                        const first = pick(idx.firstName);
                                        const last = pick(idx.lastName);
                                        const company = pick(idx.companyName);
                                        const email = pick(idx.email);
                                        const phone = pick(idx.phone);
                                        const id = pick(idx.id);
                                        const emName = pick(idx.emergencyName);
                                        const emPhone = pick(idx.emergencyPhone);
                                        if ([first,last,company,email,phone].some(Boolean)) {
                                            guests.push({
                                                firstname: first,
                                                lastname: last,
                                                companyname: company,
                                                email,
                                                phone,
                                                id,
                                                emergencyname: emName,
                                                emergencyphone: emPhone
                                            });
                                        }
                                    }

                                    for (const r of guests) {
                                        const existing = frontOfficeStore.guests.find(g=> g.email && r.email && g.email.toLowerCase()===String(r.email).toLowerCase()) ||
                                            frontOfficeStore.guests.find(g=> g.phone && r.phone && g.phone.replace(/\D/g,'')===String(r.phone).replace(/\D/g,''));
                                        if (existing) {
                                            frontOfficeStore.updateGuest(existing.id, {
                                                firstName: r.firstname || existing.firstName,
                                                lastName: r.lastname || existing.lastName,
                                                email: r.email || existing.email,
                                                phone: r.phone || existing.phone,
                                            });
                                        } else {
                                            frontOfficeStore.createGuest({
                                                firstName: r.firstname || r.companyname || 'Guest',
                                                lastName: r.lastname || (r.companyname ? 'Corporate' : 'New'),
                                                email: r.email,
                                                phone: r.phone,
                                                nationality: countryCodeToNationalityAdjective(settings.defaultCountry) as Nationality,
                                                idType: 'other',
                                                idNumber: r.id || `IMP-${Date.now().toString().slice(-6)}`,
                                                emergencyContact: { name: r.emergencyname || 'N/A', relationship: 'other', phone: r.emergencyphone || '' },
                                                preferences: {}
                                            });
                                        }
                                    }
                                } catch (err) {
                                    // CSV import failed
                                    alert('Import failed. Please ensure the file is a CSV with headers like First Name, Last Name, Email, Phone (any casing/spacing ok).');
                                } finally {
                                    e.currentTarget.value='';
                                }
                            }} />
                            <Button size="sm" variant="flat" onPress={()=>{
                                const headers = ['id','firstName','lastName','email','phone'];
                                const lines = [headers.join(',')];
                                filtered.forEach(r=>{
                                    const g = frontOfficeStore.guests.find(g=>g.id===r.id) as any;
                                    lines.push([
                                        r.id,
                                        g?.firstName||'',
                                        g?.lastName||'',
                                        r.email||'',
                                        r.phone||''
                                    ].map(v=>`"${String(v).replace(/"/g,'""')}"`).join(','));
                                });
                                const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = 'clients-export.csv';
                                a.click();
                                URL.revokeObjectURL(url);
                            }}>Export CSV</Button>
                            <Button size="sm" variant="flat" onPress={()=>fileRef.current?.click()}>Import CSV</Button>
                            <Button size="sm" variant="flat" color="warning" onPress={()=>{
                                const norm = (s?:string)=> (s||'').replace(/\D/g,'').trim();
                                const dups: Array<{primaryId:string;dupId:string;reason:string}> = [];
                                const seenEmail = new Map<string,string>();
                                const seenPhone = new Map<string,string>();
                                for (const g of frontOfficeStore.guests) {
                                    if (g.email) {
                                        const key = g.email.toLowerCase();
                                        if (seenEmail.has(key)) dups.push({primaryId: seenEmail.get(key)!, dupId: g.id, reason: 'Same email'}); else seenEmail.set(key, g.id);
                                    }
                                    if (g.phone) {
                                        const key = norm(g.phone);
                                        if (key && seenPhone.has(key)) dups.push({primaryId: seenPhone.get(key)!, dupId: g.id, reason: 'Same phone'}); else if (key) seenPhone.set(key, g.id);
                                    }
                                }
                                setDuplicateList(dups);
                                setShowDuplicates(true);
                            }}>Find Duplicates</Button>
							{(canManageGuests || canManageCompanies) && (
							<Button size="sm" color="primary" variant="flat" onPress={()=>{
								setEditClientId(null);
								setNewClientStep('basic');
								if (canManageCompanies && !canManageGuests) {
									setNewClient(prev => ({ ...prev, type: 'corporate', isCorporate: true }));
								}
								onNewOpen();
							}}>{canManageCompanies && !canManageGuests ? 'New Company' : 'New Client'}</Button>
							)}
                        </div>
                    </div>

					<div className="flex flex-col gap-2 mb-[18px]">
					<div className="flex flex-wrap items-center gap-2">
						<Input
							size="sm"
							placeholder="Name, company, phone or email…"
							value={searchTerm}
							onChange={(e)=>setSearchTerm(e.target.value)}
							className="w-full max-w-full sm:w-64 sm:max-w-[16rem] shrink-0"
							startContent={<span className="text-gray-400">🔍</span>}
							aria-label="Search clients"
						/>
						<Select
							size="sm"
							selectedKeys={[typeFilter]}
							disallowEmptySelection
							onChange={(e) => {
								const value = e.target.value;
								if (value === 'all' || value === 'individual' || value === 'corporate') setTypeFilter(value);
							}}
							className="w-full max-w-full sm:w-40 sm:max-w-[10rem] shrink-0"
							aria-label="People or companies"
						>
							<SelectItem key="all">All clients</SelectItem>
							<SelectItem key="individual">People</SelectItem>
							<SelectItem key="corporate">Companies</SelectItem>
						</Select>
                         <Autocomplete size="sm" className="w-full max-w-full sm:w-48 sm:max-w-[12rem] shrink-0" placeholder="Country" selectedKey={countryFilter || 'all'} onSelectionChange={(k)=>{
                             const key = (k as string) || 'all';
                             setCountryFilter(key);
                         }} aria-label="Filter by country">
                             {([{ code: 'all', name: 'All countries' }, ...COUNTRIES] as {code:string;name:string}[]).map(item => <AutocompleteItem key={item.code}>{item.name}</AutocompleteItem>)}
                         </Autocomplete>
						<Button
							size="sm"
							variant="flat"
							onPress={() => {
								setSearchTerm('');
								setTypeFilter('all');
                                     setCountryFilter('all');
                                     setLocalityFilter('all');
                                     setDobFrom('');
                                     setDobTo('');
                                     setCompanyFilter('');
                                     setIdFilter('');
                                     setGenderFilter('all');
                                     setNationalityFilter('all');
                                     setIndustryFilter('');
                                     setReservationFilter('all');
                                     setDateJoinedFrom('');
                                     setDateJoinedTo('');
							}}
						>
							Clear
						</Button>
                             <Button size="sm" variant="flat" onPress={()=>setShowAdvancedFilters(v=>!v)}>{showAdvancedFilters ? 'Hide filters' : 'More filters'}</Button>
						<span className="ml-auto text-sm text-gray-600 shrink-0">
							{typeFilter === 'corporate' ? 'Companies' : typeFilter === 'individual' ? 'People' : 'Clients'}: {filtered.length}
						</span>
                     </div>
                     {showAdvancedFilters && (
                     <div className="space-y-4">
                         <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
                             <Select selectedKeys={[localityFilter]} onSelectionChange={(keys)=>setLocalityFilter((Array.from(keys as Set<string>)[0] as 'all'|'local'|'foreigner')||'all')} className="w-full sm:w-44" aria-label="Filter by locality">
                                 <SelectItem key="all">Local & Foreigner</SelectItem>
                                 <SelectItem key="local">Local</SelectItem>
                                 <SelectItem key="foreigner">Foreigner</SelectItem>
                             </Select>
                             <Input type="date" className="w-full sm:w-40" labelPlacement="outside" placeholder="DOB From" value={dobFrom} onChange={e=>setDobFrom(e.target.value)} aria-label="Date of birth from" />
                             <Input type="date" className="w-full sm:w-40" labelPlacement="outside" placeholder="DOB To" value={dobTo} onChange={e=>setDobTo(e.target.value)} aria-label="Date of birth to" />
                             <Input className="w-full sm:w-48" placeholder="Company" value={companyFilter} onChange={e=>setCompanyFilter(e.target.value)} aria-label="Filter by company" />
                             <Input className="w-full sm:w-48" placeholder="Client ID" value={idFilter} onChange={e=>setIdFilter(e.target.value)} aria-label="Filter by client ID" />
					</div>

                         <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
                             <Select selectedKeys={[genderFilter]} onSelectionChange={(keys)=>setGenderFilter(Array.from(keys as Set<string>)[0] || 'all')} className="w-full sm:w-44" aria-label="Filter by gender">
                                 <SelectItem key="all">All Genders</SelectItem>
                                 <SelectItem key="male">Male</SelectItem>
                                 <SelectItem key="female">Female</SelectItem>
                                 <SelectItem key="other">Other</SelectItem>
                             </Select>
                             <Select selectedKeys={[nationalityFilter]} onSelectionChange={(keys)=>setNationalityFilter(Array.from(keys as Set<string>)[0] || 'all')} className="w-full sm:w-44" aria-label="Filter by nationality">
                                 <SelectItem key="all">All Nationalities</SelectItem>
                                 <SelectItem key="ghanaian">Ghanaian</SelectItem>
                                 <SelectItem key="nigerian">Nigerian</SelectItem>
                                 <SelectItem key="american">American</SelectItem>
                                 <SelectItem key="british">British</SelectItem>
                                 <SelectItem key="other">Other</SelectItem>
                             </Select>
                             <Input className="w-full sm:w-48" placeholder="Industry" value={industryFilter} onChange={e=>setIndustryFilter(e.target.value)} aria-label="Filter by industry" />
                             <Select selectedKeys={[reservationFilter]} onSelectionChange={(keys)=>setReservationFilter(Array.from(keys as Set<string>)[0] || 'all')} className="w-full sm:w-44" aria-label="Filter by reservation count">
                                 <SelectItem key="all">All Reservations</SelectItem>
                                 <SelectItem key="none">No Reservations</SelectItem>
                                 <SelectItem key="1-5">1-5 Reservations</SelectItem>
                                 <SelectItem key="6-10">6-10 Reservations</SelectItem>
                                 <SelectItem key="10+">10+ Reservations</SelectItem>
                             </Select>
                             <Input type="date" className="w-full sm:w-40" labelPlacement="outside" placeholder="Joined From" value={dateJoinedFrom} onChange={e=>setDateJoinedFrom(e.target.value)} aria-label="Date joined from" />
                             <Input type="date" className="w-full sm:w-40" labelPlacement="outside" placeholder="Joined To" value={dateJoinedTo} onChange={e=>setDateJoinedTo(e.target.value)} aria-label="Date joined to" />
                         </div>
                     </div>
                     )}
					</div>

					{duplicateList.length > 0 && (
						<p className="mb-2 text-sm text-gray-600">Duplicates found: {duplicateList.length}</p>
					)}
							<Card className="border-0 shadow-lg">
								<CardBody className="px-2 py-3">
									<Table
										aria-label="Clients and services table"
										removeWrapper
										classNames={{
											...worksheetTableClassNames,
											th: `${worksheetTableClassNames.th} py-2`,
											td: `${worksheetTableClassNames.td} overflow-hidden text-ellipsis py-1.5`,
										}}
									>
						<TableHeader>
							{visibleColumns.map(columnKey => {
								const columnTitles: Record<string, string> = {
									index: "#",
									id: "Client ID",
									name: typeFilter === 'corporate' ? 'Company' : 'Name',
									email: "Email",
									phone: "Phone",
									secondaryPhone: "Phone 2",
									gender: "Gender",
									nationality: "Nationality",
									dob: "DOB",
									company: "Company",
									jobTitle: "Job Title",
									industry: "Industry",
									contactPerson: "Contact Person",
									address: "Address",
									city: "City",
									type: "Type",
									reservations: "Reservations",
									services: "Services",
									dateJoined: "Date Joined",
									actions: "Actions"
								};
								
								return (
									<TableColumn 
										key={columnKey} 
										style={columnKey === 'index' ? colStyle(columnKey) : { width: colWidths[columnKey] }}
									>
										<HeaderCell colKey={columnKey} title={columnTitles[columnKey]} />
									</TableColumn>
								);
							})}
						</TableHeader>
						<TableBody>
							{paginatedData.map((row, idx) => {
								// Memoize row rendering for better performance with large datasets
								const rowKey = `${row.id}-${idx}`;
								return (
								<TableRow key={row.id} className="cursor-pointer hover:bg-gray-50" onClick={() => setShowProfile(row.id)}>
									{visibleColumns.map(columnKey => {
										const renderCell = (): JSX.Element => {
											switch (columnKey) {
												case 'index':
													return <TableCell style={colStyle('index')}>{startIndex + idx + 1}</TableCell>;
												case 'id':
													return <TableCell className="text-gray-600" style={{ width: colWidths.id }}>{row.serialNumber}</TableCell>;
												case 'name':
													return (
														<TableCell style={{ width: colWidths.name }}>
											<div>
												<div className="flex items-center gap-2">
												<p className="font-semibold text-ghana-black">{row.name}</p>
												{!row.isActive && <Chip size="sm" variant="flat">Inactive</Chip>}
												</div>
																{typeFilter !== 'corporate' && row.type==='corporate' && row.contactPerson && (
																	<p className="text-xs text-gray-500">{row.contactPerson}</p>
																)}
										</div>
									</TableCell>
													);
												case 'email':
													return <TableCell style={{ width: colWidths.email }}>{row.email || '—'}</TableCell>;
												case 'phone':
													return <TableCell style={{ width: colWidths.phone }}>{row.phone || '—'}</TableCell>;
												case 'secondaryPhone':
													return <TableCell style={{ width: colWidths.secondaryPhone }}>{row.secondaryPhone || '—'}</TableCell>;
												case 'gender':
													return <TableCell style={{ width: colWidths.gender }}>{row.gender || '—'}</TableCell>;
												case 'nationality':
													return <TableCell style={{ width: colWidths.nationality }}>{row.nationality || '—'}</TableCell>;
												case 'dob':
													return <TableCell style={{ width: colWidths.dob }}>{row.dateOfBirth ? new Date(row.dateOfBirth).toLocaleDateString() : '—'}</TableCell>;
												case 'company':
													return <TableCell style={{ width: colWidths.company }}>{row.company || '—'}</TableCell>;
												case 'jobTitle':
													return <TableCell style={{ width: colWidths.jobTitle }}>{row.jobTitle || '—'}</TableCell>;
												case 'industry':
													return <TableCell style={{ width: colWidths.industry }}>{row.industry || '—'}</TableCell>;
												case 'contactPerson':
													return <TableCell style={{ width: colWidths.contactPerson }}>{row.contactPerson || '—'}</TableCell>;
												case 'address':
													return <TableCell style={{ width: colWidths.address }}>{row.address || '—'}</TableCell>;
												case 'city':
													return <TableCell style={{ width: colWidths.city }}>{row.city || '—'}</TableCell>;
												case 'type':
													return (
														<TableCell style={{ width: colWidths.type }}>
										<Chip size="sm" variant="flat" color={row.type==='corporate'?'primary':'default'}>{row.type === 'corporate' ? 'Company' : 'Person'}</Chip>
									</TableCell>
													);
												case 'reservations':
													return (
														<TableCell style={{ width: colWidths.reservations }}>
															<span className="block text-center font-medium">{row.reservationCount}</span>
														</TableCell>
													);
												case 'services':
													return <TableCell style={{ width: colWidths.services }}>{row.services}</TableCell>;
												case 'dateJoined':
													return (
														<TableCell style={{ width: colWidths.dateJoined }}>
															<span className="block text-center text-sm">{new Date(row.createdAt).toLocaleDateString()}</span>
														</TableCell>
													);
												default:
													return <TableCell>—</TableCell>;
											}
										};
										
										return renderCell();
									})}
								</TableRow>
								);
							})}
						</TableBody>
					</Table>
								</CardBody>
							</Card>
							
							{/* Pagination Controls */}
							{totalPages > 1 && (
								<div className="flex items-center justify-between px-4 py-3 bg-white border-t border-gray-200">
									<div className="flex items-center text-sm text-gray-700">
										<span>
											Showing {startIndex + 1} to {Math.min(endIndex, totalItems)} of {totalItems} clients
										</span>
									</div>
									
									<div className="flex items-center space-x-2">
										{/* Previous Button */}
										<Button
											isDisabled={currentPage === 1}
											onPress={() => setCurrentPage(currentPage - 1)}
											size="sm"
											variant="flat"
											aria-label="Go to previous page"
										>
											Previous
										</Button>
										
										{/* Page Numbers */}
										<div className="flex items-center space-x-1">
											{(() => {
												const pages = [];
												const maxVisiblePages = 5;
												
												if (totalPages <= maxVisiblePages) {
													// Show all pages if total is small
													for (let i = 1; i <= totalPages; i++) {
														pages.push(
															<Button
																key={i}
																onPress={() => setCurrentPage(i)}
																size="sm"
																variant={currentPage === i ? "solid" : "flat"}
																color={currentPage === i ? "primary" : "default"}
																className="min-w-[40px]"
																aria-label={`Go to page ${i}`}
																aria-current={currentPage === i ? "page" : undefined}
															>
																{i}
															</Button>
														);
													}
												} else {
													// Show smart pagination for large datasets
													if (currentPage <= 3) {
														// Show first 3 pages, ellipsis, last page
														for (let i = 1; i <= 3; i++) {
															pages.push(
																<Button
																	key={i}
																	onPress={() => setCurrentPage(i)}
																	size="sm"
																	variant={currentPage === i ? "solid" : "flat"}
																	color={currentPage === i ? "primary" : "default"}
																	className="min-w-[40px]"
																	aria-label={`Go to page ${i}`}
																	aria-current={currentPage === i ? "page" : undefined}
																>
																	{i}
																</Button>
															);
														}
														pages.push(<span key="ellipsis1" className="px-2 text-gray-500">...</span>);
														pages.push(
															<Button
																key={totalPages}
																onPress={() => setCurrentPage(totalPages)}
																size="sm"
																variant="flat"
																className="min-w-[40px]"
																aria-label={`Go to page ${totalPages}`}
															>
																{totalPages}
															</Button>
														);
													} else if (currentPage >= totalPages - 2) {
														// Show first page, ellipsis, last 3 pages
														pages.push(
															<Button
																key={1}
																onPress={() => setCurrentPage(1)}
																size="sm"
																variant="flat"
																className="min-w-[40px]"
																aria-label="Go to page 1"
															>
																1
															</Button>
														);
														pages.push(<span key="ellipsis2" className="px-2 text-gray-500">...</span>);
														for (let i = totalPages - 2; i <= totalPages; i++) {
															pages.push(
																<Button
																	key={i}
																	onPress={() => setCurrentPage(i)}
																	size="sm"
																	variant={currentPage === i ? "solid" : "flat"}
																	color={currentPage === i ? "primary" : "default"}
																	className="min-w-[40px]"
																	aria-label={`Go to page ${i}`}
																	aria-current={currentPage === i ? "page" : undefined}
																>
																	{i}
																</Button>
															);
														}
													} else {
														// Show first page, ellipsis, current-1, current, current+1, ellipsis, last page
														pages.push(
															<Button
																key={1}
																onPress={() => setCurrentPage(1)}
																size="sm"
																variant="flat"
																className="min-w-[40px]"
																aria-label="Go to page 1"
															>
																1
															</Button>
														);
														pages.push(<span key="ellipsis3" className="px-2 text-gray-500">...</span>);
														for (let i = currentPage - 1; i <= currentPage + 1; i++) {
															pages.push(
																<Button
																	key={i}
																	onPress={() => setCurrentPage(i)}
																	size="sm"
																	variant={currentPage === i ? "solid" : "flat"}
																	color={currentPage === i ? "primary" : "default"}
																	className="min-w-[40px]"
																	aria-label={`Go to page ${i}`}
																	aria-current={currentPage === i ? "page" : undefined}
																>
																	{i}
																</Button>
															);
														}
														pages.push(<span key="ellipsis4" className="px-2 text-gray-500">...</span>);
														pages.push(
															<Button
																key={totalPages}
																onPress={() => setCurrentPage(totalPages)}
																size="sm"
																variant="flat"
																className="min-w-[40px]"
																aria-label={`Go to page ${totalPages}`}
															>
																{totalPages}
															</Button>
														);
													}
												}
												return pages;
											})()}
										</div>
										
										{/* Next Button */}
										<Button
											isDisabled={currentPage === totalPages}
											onPress={() => setCurrentPage(currentPage + 1)}
											size="sm"
											variant="flat"
											aria-label="Go to next page"
										>
											Next
										</Button>
									</div>
									
									{/* Jump to Page */}
									<div className="flex items-center space-x-2">
										<span className="text-sm text-gray-700">Go to:</span>
										<Input
											type="number"
											min="1"
											max={totalPages}
											value={currentPage.toString()}
											onChange={(e) => {
												const page = parseInt(e.target.value);
												if (page >= 1 && page <= totalPages) {
													setCurrentPage(page);
												}
											}}
											className="w-16"
											size="sm"
											aria-label="Jump to page number"
										/>
									</div>
							</div>
							)}

				</div>
			</div>

            {/* New Client Modal */}
            <Modal isOpen={isNewOpen} onClose={()=>{ onNewClose(); setEditClientId(null); setNewClientStep('basic'); }} size="5xl">
                <ModalContent className="max-w-[1280px]">
                    <ModalHeader>{editClientId ? 'Edit Client' : 'Create New Client'}</ModalHeader>
                    <ModalBody className="max-h-[75vh] overflow-y-auto">
                        {newClientStep === 'basic' ? (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {canManageGuests && canManageCompanies && (
                                <div className="md:col-span-3 flex justify-end">
                                    <Switch
                                        isSelected={newClient.type === 'corporate'}
                                        onValueChange={(val)=> setNewClient({
                                            ...newClient,
                                            type: val ? 'corporate' : 'individual',
                                            isCorporate: val
                                        })}
                                    >
                                        Corporate Client
                                    </Switch>
                                </div>
                                )}

                                {newClient.type === 'individual' && (
                                    <>
                                        <div className="md:col-span-3 border-b border-gray-200 pb-1">
                                            <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Bio</h4>
                                        </div>
                                        <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
                                                <Input placeholder="First name" value={newClient.firstName} onChange={(e)=>handleInputChange('firstName', e.target.value)} />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
                                                <Input placeholder="Last name" value={newClient.lastName} onChange={(e)=>handleInputChange('lastName', e.target.value)} />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Middle Name</label>
                                                <Input placeholder="Other name(s)" value={newClient.middleName} onChange={(e)=>handleInputChange('middleName', e.target.value)} />
                                            </div>
                                        </div>
                                        <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
                                                <Select selectedKeys={[newClient.gender]} onSelectionChange={(k)=>handleSelectChange('gender', k)}>
                                                    <SelectItem key="male">Male</SelectItem>
                                                    <SelectItem key="female">Female</SelectItem>
                                                    <SelectItem key="other">Other</SelectItem>
                                                    <SelectItem key="prefer_not_to_say">Prefer not to say</SelectItem>
                                                </Select>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Marital Status</label>
                                                <Select selectedKeys={[newClient.maritalStatus]} onSelectionChange={(k)=>handleSelectChange('maritalStatus', k)}>
                                                    <SelectItem key="single">Single</SelectItem>
                                                    <SelectItem key="married">Married</SelectItem>
                                                    <SelectItem key="divorced">Divorced</SelectItem>
                                                    <SelectItem key="widowed">Widowed</SelectItem>
                                                    <SelectItem key="separated">Separated</SelectItem>
                                                    <SelectItem key="other">Other</SelectItem>
                                                </Select>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
                                                <Input type="date" value={newClient.dateOfBirth} onChange={(e)=>handleInputChange('dateOfBirth', e.target.value)} />
                                            </div>
                                        </div>
                                        <div className="md:col-span-3 mt-2 border-b border-gray-200 pb-1">
                                            <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Identity</h4>
                                        </div>
                                        <div className="md:col-span-3 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">ID Type</label>
                                                <Select selectedKeys={[newClient.idType]} onSelectionChange={(k)=>handleSelectChange('idType', k)}>
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
                                                <label className="block text-sm font-medium text-gray-700 mb-1">ID Number</label>
                                                <Input placeholder="ID number" value={newClient.idNumber} onChange={(e)=>handleInputChange('idNumber', e.target.value)} isInvalid={!validateId(newClient.idType, newClient.idNumber)} errorMessage={!validateId(newClient.idType, newClient.idNumber) ? 'Enter at least 4 characters, or leave it empty' : undefined} />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">ID Expiry</label>
                                                <Input type="date" value={newClient.idExpiry} onChange={(e)=>handleInputChange('idExpiry', e.target.value)} />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Issuing Authority</label>
                                                <Input placeholder="e.g., NIA, DVLA" value={newClient.idIssuingAuthority} onChange={(e)=>handleInputChange('idIssuingAuthority', e.target.value)} />
                                            </div>
                                        </div>
                                        <div className="md:col-span-3 mt-2 border-b border-gray-200 pb-1">
                                            <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Contact</h4>
                                        </div>
                                        <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Mobile *</label>
                                                <Input placeholder="Mobile number" value={newClient.phone} onChange={(e)=>handleInputChange('phone', e.target.value)} isInvalid={!validatePhone(newClient.phone)} errorMessage={!newClient.phone ? 'Mobile is required' : !validatePhone(newClient.phone) ? 'Enter a valid phone number' : undefined} />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                                                <Input type="email" placeholder="email@example.com" value={newClient.email} onChange={(e)=>handleInputChange('email', e.target.value)} isInvalid={!!newClient.email && !validateEmail(newClient.email)} errorMessage={!!newClient.email && !validateEmail(newClient.email) ? 'Enter a valid email' : undefined} />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Phone 2</label>
                                                <Input placeholder="Alternate phone" value={newClient.secondaryPhone} onChange={(e)=>handleInputChange('secondaryPhone', e.target.value)} isInvalid={!!newClient.secondaryPhone && !validatePhone(newClient.secondaryPhone)} errorMessage={!!newClient.secondaryPhone && !validatePhone(newClient.secondaryPhone) ? 'Enter a valid phone number' : undefined} />
                                            </div>
                                        </div>
                                        <div className="md:col-span-3 mt-2 border-b border-gray-200 pb-1">
                                            <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Work</h4>
                                        </div>
                                        <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Employer Company</label>
                                                <Input placeholder="Company (if applicable)" value={(newClient as any).employerCompany || ''} onChange={(e)=>handleInputChange('employerCompany', e.target.value)} />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Job Title</label>
                                                <Input placeholder="e.g., Manager" value={(newClient as any).jobTitle || ''} onChange={(e)=>handleInputChange('jobTitle', e.target.value)} />
                                            </div>
                                            <div>
                                                <div className="mb-1 flex items-center justify-between gap-2">
                                                    <label className="block text-sm font-medium text-gray-700">Nationality</label>
                                                    <Badge size="sm" variant="flat" color={isForeigner ? 'warning' : 'success'}>{isForeigner ? 'Foreigner' : 'Local'}</Badge>
                                                </div>
                                                <Autocomplete
                                                    defaultSelectedKey={defaultCountryCode}
                                                    selectedKey={newClient.countryCode}
                                                    onSelectionChange={(key)=>{
                                                        const selectedKey = (key as string) || defaultCountryCode;
                                                        setNewClient({...newClient, countryCode: selectedKey});
                                                    }}
                                                    allowsCustomValue
                                                    placeholder="Nationality"
                                                >
                                                    {COUNTRIES.concat([{ code: 'OT', name: 'Other' }]).map(c => (
                                                        <AutocompleteItem key={c.code}>
                                                            {c.name}
                                                        </AutocompleteItem>
                                                    ))}
                                                </Autocomplete>
                                            </div>
                                        </div>
                                        <div className="md:col-span-3 mt-2 border-b border-gray-200 pb-1">
                                            <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Address</h4>
                                        </div>
                                        <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Address Line 1</label>
                                                <Input placeholder="Street address" value={newClient.addressLine1} onChange={(e)=>handleInputChange('addressLine1', e.target.value)} />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Address Line 2</label>
                                                <Input placeholder="Apartment, suite, etc." value={newClient.addressLine2} onChange={(e)=>handleInputChange('addressLine2', e.target.value)} />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                                                <Input placeholder="City" value={newClient.city} onChange={(e)=>handleInputChange('city', e.target.value)} />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Region/State</label>
                                                <Input placeholder="Region or State" value={newClient.region} onChange={(e)=>handleInputChange('region', e.target.value)} />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Postal Code</label>
                                                <Input placeholder="Postal code" value={newClient.postalCode} onChange={(e)=>handleInputChange('postalCode', e.target.value)} />
                                            </div>
                                        </div>
                                        <div className="md:col-span-3 mt-2 border-b border-gray-200 pb-1">
                                            <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Other</h4>
                                        </div>
                                        <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Disability / Accessibility Needs</label>
                                                <Input placeholder="e.g., Wheelchair access, hearing assistance" value={(newClient as any).disability || ''} onChange={(e)=>setNewClient({...newClient, disability: e.target.value} as any)} />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Allergies</label>
                                                <Input placeholder="Comma-separated allergies" value={newClient.preferences?.allergies?.join(', ') || ''} onChange={(e)=>setNewClient({
                                                    ...newClient,
                                                    preferences: {
                                                        ...newClient.preferences,
                                                        allergies: e.target.value.split(',').map(s=>s.trim()).filter(Boolean)
                                                    }
                                                })} />
                                            </div>
                                        </div>
                                        <div className="md:col-span-3 mt-2 border-b border-gray-200 pb-1">
                                            <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Emergency</h4>
                                        </div>
                                        <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                                                <Input placeholder="Full name" value={newClient.emergencyName} onChange={(e)=>setNewClient({...newClient, emergencyName: e.target.value})} />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Relationship</label>
                                                <Select selectedKeys={[newClient.emergencyRelationship]} onSelectionChange={(k)=>setNewClient({...newClient, emergencyRelationship: Array.from(k as Set<string>)[0] as any})}>
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
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                                                <Input placeholder="Emergency phone" value={newClient.emergencyPhone} onChange={(e)=>setNewClient({...newClient, emergencyPhone: e.target.value})} />
                                            </div>
                                        </div>
                                    </>
                                )}

                            {newClient.type === 'corporate' && (
                                    <>
                                    <div className="md:col-span-3 border-b border-gray-200 pb-1">
                                        <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Company</h4>
                                    </div>
                                    <div className="md:col-span-3">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Company Name *</label>
                                    <Input placeholder="Company name" value={newClient.companyName} onChange={(e)=>handleInputChange('companyName', e.target.value)} />
                                    </div>
                                <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Industry</label>
                                        <Autocomplete
                                            allowsCustomValue
                                            placeholder="Select or search industry"
                                            defaultSelectedKey={['NGO','Healthcare','Government','Finance','Education','Technology','Manufacturing','Construction','Logistics','Hospitality','Energy','Agriculture','Retail','Media'].includes(newClient.industry) ? newClient.industry : 'other'}
                                            selectedKey={['NGO','Healthcare','Government','Finance','Education','Technology','Manufacturing','Construction','Logistics','Hospitality','Energy','Agriculture','Retail','Media'].includes(newClient.industry) ? newClient.industry : 'other'}
                        onSelectionChange={(key)=>{
                                                const sel = (key as string) || 'other';
                                                if (sel === 'other') {
                                                    setNewClient({...newClient, industry: newClient.industryOther || '', industryOther: newClient.industryOther || ''});
                                                } else {
                                                    setNewClient({...newClient, industry: sel, industryOther: ''});
                                                }
                                            }}
                                        >
                                            {['NGO','Healthcare','Government','Finance','Education','Technology','Manufacturing','Construction','Logistics','Hospitality','Energy','Agriculture','Retail','Media','other'].map(opt => (
                                                <AutocompleteItem key={opt}>{opt === 'other' ? 'Other' : opt}</AutocompleteItem>
                                            ))}
                                        </Autocomplete>
                                        {(!['NGO','Healthcare','Government','Finance','Education','Technology','Manufacturing','Construction','Logistics','Hospitality','Energy','Agriculture','Retail','Media'].includes(newClient.industry) || newClient.industry === '') && (
                                            <div className="mt-2">
                                                <Input placeholder="Specify industry" value={newClient.industryOther} onChange={(e)=>handleInputChange('industryOther', e.target.value)} />
                                </div>
                            )}
                        </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Registration No.</label>
                                        <Input placeholder="Company registration number" value={newClient.registrationNumber} onChange={(e)=>handleInputChange('registrationNumber', e.target.value)} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Tax ID / VAT</label>
                                        <Input placeholder="TIN / VAT Number" value={newClient.taxId} onChange={(e)=>handleInputChange('taxId', e.target.value)} />
                                    </div>
                                    <div className="md:col-span-3 mt-2 border-b border-gray-200 pb-1">
                                        <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Contact</h4>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Phone *</label>
                                        <Input placeholder="Company phone" value={newClient.companyPhone} onChange={(e)=>handleInputChange('companyPhone', e.target.value)} isInvalid={!validatePhone(newClient.companyPhone)} errorMessage={!newClient.companyPhone ? 'Phone is required' : !validatePhone(newClient.companyPhone) ? 'Enter a valid phone number' : undefined} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Contact person *</label>
                                        <Input placeholder="Full name" value={newClient.contactPersonName} onChange={(e)=>setNewClient({...newClient, contactPersonName: e.target.value})} isInvalid={!newClient.contactPersonName.trim()} errorMessage={!newClient.contactPersonName.trim() ? 'Contact person is required' : undefined} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Contact phone *</label>
                                        <Input placeholder="Contact phone" value={newClient.contactPersonPhone} onChange={(e)=>setNewClient({...newClient, contactPersonPhone: e.target.value})} isInvalid={!validatePhone(newClient.contactPersonPhone)} errorMessage={!newClient.contactPersonPhone ? 'Contact phone is required' : !validatePhone(newClient.contactPersonPhone) ? 'Enter a valid phone number' : undefined} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                                        <Input type="email" placeholder="company@email.com" value={newClient.companyEmail} onChange={(e)=>handleInputChange('companyEmail', e.target.value)} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
                                        <Input placeholder="https://" value={newClient.website} onChange={(e)=>handleInputChange('website', e.target.value)} />
                                    </div>
                                    <div className="md:col-span-3 mt-2 border-b border-gray-200 pb-1">
                                        <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Address</h4>
                                    </div>
                                    <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Address Line 1</label>
                                            <Input placeholder="Street address" value={newClient.companyAddressLine1} onChange={(e)=>handleInputChange('companyAddressLine1', e.target.value)} />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Address Line 2</label>
                                            <Input placeholder="Suite, Floor" value={newClient.companyAddressLine2} onChange={(e)=>handleInputChange('companyAddressLine2', e.target.value)} />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                                            <Input placeholder="City" value={newClient.companyCity} onChange={(e)=>handleInputChange('companyCity', e.target.value)} />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Region/State</label>
                                            <Input placeholder="Region or State" value={newClient.companyRegion} onChange={(e)=>handleInputChange('companyRegion', e.target.value)} />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Postal Code</label>
                                            <Input placeholder="Postal code" value={newClient.companyPostalCode} onChange={(e)=>handleInputChange('companyPostalCode', e.target.value)} />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
                                            <Autocomplete defaultSelectedKey={defaultCountryCode} selectedKey={newClient.companyCountryCode} onSelectionChange={(key)=>{
                                                const selectedKey = (key as string) || defaultCountryCode;
                                                setNewClient({...newClient, companyCountryCode: selectedKey});
                                            }} allowsCustomValue placeholder="Country">
                                                {COUNTRIES.concat([{ code: 'OT', name: 'Other' }]).map(c => (
                                                    <AutocompleteItem key={c.code}>{c.name}</AutocompleteItem>
                                                ))}
                                            </Autocomplete>
                                        </div>
                                    </div>
                                    <div className="md:col-span-3 mt-2 border-b border-gray-200 pb-1">
                                        <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Billing</h4>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Payment Terms</label>
                                        <Input placeholder="e.g., Net 30" value={newClient.paymentTerms} onChange={(e)=>setNewClient({...newClient, paymentTerms: e.target.value})} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Credit Limit</label>
                                        <Input type="number" placeholder="0.00" value={newClient.creditLimit} onChange={(e)=>setNewClient({...newClient, creditLimit: e.target.value})} isInvalid={!validateCredit(newClient.creditLimit)} errorMessage={!validateCredit(newClient.creditLimit) ? 'Enter a valid number' : undefined} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Invoice Currency</label>
                                        <Select selectedKeys={[newClient.invoiceCurrency]} onSelectionChange={(k)=>setNewClient({...newClient, invoiceCurrency: Array.from(k as Set<string>)[0] as any})}>
                                            <SelectItem key="GHS">GHS</SelectItem>
                                            <SelectItem key="USD">USD</SelectItem>
                                            <SelectItem key="EUR">EUR</SelectItem>
                                            <SelectItem key="GBP">GBP</SelectItem>
                                            <SelectItem key="NGN">NGN</SelectItem>
                                            <SelectItem key="XOF">XOF</SelectItem>
                                            <SelectItem key="XAF">XAF</SelectItem>
                                        </Select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Billing Contact</label>
                                        <Input placeholder="Who invoices are addressed to" value={newClient.billingContactName} onChange={(e)=>setNewClient({...newClient, billingContactName: e.target.value})} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Billing Email</label>
                                        <Input type="email" placeholder="billing@company.com" value={newClient.billingContactEmail} onChange={(e)=>setNewClient({...newClient, billingContactEmail: e.target.value})} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Billing Phone</label>
                                        <Input placeholder="Phone" value={newClient.billingContactPhone} onChange={(e)=>setNewClient({...newClient, billingContactPhone: e.target.value})} />
                                    </div>
                                    <div className="md:col-span-3 mt-2 border-b border-gray-200 pb-1">
                                        <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Purchase order</h4>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="flex items-center gap-1">
                                            <label className="text-sm font-medium text-gray-700">Require PO</label>
                                            <Tooltip content="If ON, invoices for this company must include a Purchase Order (PO) reference. Turn this on when the client requires PO numbers before payment.">
                                                <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-gray-200 text-gray-700 text-[10px] cursor-default">i</span>
                                            </Tooltip>
                                        </div>
                                        <Switch isSelected={newClient.requirePO} onValueChange={(v)=>setNewClient({...newClient, requirePO: v})} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">PO Requirement</label>
                                        <Select selectedKeys={[newClient.poRequirement]} onSelectionChange={(k)=>setNewClient({...newClient, poRequirement: Array.from(k as Set<string>)[0] as any})}>
                                            <SelectItem key="none">None</SelectItem>
                                            <SelectItem key="number">PO Number</SelectItem>
                                            <SelectItem key="attachment">Attachment</SelectItem>
                                        </Select>
                                    </div>
                                    <div className="md:col-span-3 mt-2 border-b border-gray-200 pb-1">
                                        <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Contract</h4>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                                        <Input type="date" value={newClient.contractStart} onChange={(e)=>setNewClient({...newClient, contractStart: e.target.value})} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                                        <Input type="date" value={newClient.contractEnd} onChange={(e)=>setNewClient({...newClient, contractEnd: e.target.value})} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                                        <Select selectedKeys={[newClient.contractStatus]} onSelectionChange={(k)=>setNewClient({...newClient, contractStatus: Array.from(k as Set<string>)[0] as any})}>
                                            <SelectItem key="active">Active</SelectItem>
                                            <SelectItem key="pending">Pending</SelectItem>
                                            <SelectItem key="expired">Expired</SelectItem>
                                            <SelectItem key="suspended">Suspended</SelectItem>
                                        </Select>
                                    </div>
                                    <div className="md:col-span-3">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                                        <Textarea rows={3} placeholder="Contract or invoicing notes" value={newClient.contractNotes} onChange={(e)=>setNewClient({...newClient, contractNotes: e.target.value})} />
                                    </div>
                                    </>
                                )}

                                {/* Details */}
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {newClient.type === 'corporate' ? null : (
                                    <>
                                        <div className="md:col-span-3">
                                            <h4 className="font-semibold text-gray-800">Emergency Contact</h4>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                                            <Input placeholder="Full name" value={newClient.emergencyName} onChange={(e)=>setNewClient({...newClient, emergencyName: e.target.value})} />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Relationship</label>
                                            <Select selectedKeys={[newClient.emergencyRelationship]} onSelectionChange={(k)=>setNewClient({...newClient, emergencyRelationship: Array.from(k as Set<string>)[0] as any})}>
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
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                                            <Input placeholder="Emergency phone" value={newClient.emergencyPhone} onChange={(e)=>setNewClient({...newClient, emergencyPhone: e.target.value})} />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                                            <Input type="email" placeholder="Emergency email" value={newClient.emergencyEmail} onChange={(e)=>setNewClient({...newClient, emergencyEmail: e.target.value})} />
                                        </div>
                                        <div className="md:col-span-2">
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                                            <Input placeholder="Emergency address" value={newClient.emergencyAddress} onChange={(e)=>setNewClient({...newClient, emergencyAddress: e.target.value})} />
                                        </div>
                                        <div className="md:col-span-3">
                                            <h4 className="font-semibold text-gray-800">Bank Preferences</h4>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Preferred Payment Method</label>
                                            <Select selectedKeys={[newClient.preferredPaymentMethod]} onSelectionChange={(k)=>setNewClient({...newClient, preferredPaymentMethod: Array.from(k as Set<string>)[0] as any})}>
                                                <SelectItem key="cash">Cash</SelectItem>
                                                <SelectItem key="card">Card</SelectItem>
                                                <SelectItem key="mobile_money">Mobile Money</SelectItem>
                                                <SelectItem key="bank_transfer">Bank Transfer</SelectItem>
                                                <SelectItem key="corporate_billing">Corporate Billing</SelectItem>
                                            </Select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Bank Name</label>
                                            <Input placeholder="e.g., GCB Bank" value={newClient.bankName} onChange={(e)=>setNewClient({...newClient, bankName: e.target.value})} />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Account Number</label>
                                            <Input placeholder="Account number" value={newClient.bankAccount} onChange={(e)=>setNewClient({...newClient, bankAccount: e.target.value})} />
                                        </div>
                                    </>
                                )}
                            </div>
                        )}
                    </ModalBody>
                    <ModalFooter>
                        <Button variant="flat" onPress={() => { 
                            setNewClientStep('basic'); 
                            onNewClose(); 
                            setEditClientId(null);
                            // Reset form to default values
                            setNewClient({
                                firstName: '',
                                middleName: '',
                                lastName: '',
                                email: '',
                                phone: '',
                                secondaryPhone: '',
                                type: 'individual',
                                companyName: '',
                                industry: '',
                                industryOther: '',
                                registrationNumber: '',
                                taxId: '',
                                vatNumber: '',
                                companyPhone: '',
                                companyEmail: '',
                                website: '',
                                companyCountryCode: defaultCountryCode,
                                companyAddressLine1: '',
                                companyAddressLine2: '',
                                companyCity: '',
                                companyRegion: '',
                                companyPostalCode: '',
                                contactPersonName: '',
                                contactPersonPosition: '',
                                contactPersonPhone: '',
                                contactPersonEmail: '',
                                paymentTerms: '',
                                creditLimit: '',
                                corporateAccountNumber: '',
                                billingSameAsCompany: true,
                                billingContactName: '',
                                billingContactEmail: '',
                                billingContactPhone: '',
                                accountsEmail: '',
                                requirePO: false,
                                poRequirement: 'number',
                                invoiceCurrency: 'GHS',
                                corpContacts: [],
                                contactDraft: { name: '', position: '', phone: '', email: '' },
                                invoiceDelivery: 'email',
                                contractStart: '',
                                contractEnd: '',
                                contractStatus: 'active',
                                contractNotes: '',
                                isCorporate: false,
                                countryCode: defaultCountryCode,
                                idType: 'ghana_card',
                                idNumber: '',
                                gender: 'prefer_not_to_say',
                                dateOfBirth: '',
                                idExpiry: '',
                                idIssuingAuthority: '',
                                maritalStatus: 'single',
                                addressLine1: '',
                                addressLine2: '',
                                city: '',
                                region: '',
                                postalCode: '',
                                emergencyName: '',
                                emergencyRelationship: 'other',
                                emergencyPhone: '',
                                emergencyEmail: '',
                                emergencyAddress: '',
                                bankName: '',
                                bankAccount: '',
                                preferredPaymentMethod: 'cash',
                                preferences: {
                                    preferredRoomType: 'standard',
                                    preferredFloor: 'middle',
                                    allergies: [],
                                    dietaryRestrictions: [],
                                    roomService: true,
                                    housekeepingFrequency: 'daily',
                                    checkInTime: 'standard',
                                    checkOutTime: 'standard',
                                    specialRequests: [],
                                    newsletter: false,
                                    marketingEmails: false
                                } as ClientPreferences
                            });
                        }}>Cancel</Button>
                        <Button color="primary" onPress={handleCreateClient} isDisabled={newClient.type==='individual' ? (!newClient.firstName.trim() || !newClient.lastName.trim() || !validatePhone(newClient.phone)) : (!newClient.companyName.trim() || !validatePhone(newClient.companyPhone) || !newClient.contactPersonName.trim() || !validatePhone(newClient.contactPersonPhone))}>{editClientId ? 'Save Changes' : 'Create Client'}</Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>

            {/* Manage Client Services Modal */}
            <Modal isOpen={isOpen} onClose={onClose} size="2xl">
                <ModalContent>
                    <ModalHeader>Manage Services{selected?` — ${selected.name}`:''}</ModalHeader>
                    <ModalBody>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Service Name</label>
                                <Input placeholder="e.g., Airport Pickup, Laundry" value={serviceName} onChange={(e)=>setServiceName(e.target.value)} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Service Type</label>
                                <Select selectedKeys={[serviceType]} onSelectionChange={(k)=>setServiceType(Array.from(k as Set<string>)[0]||'')} placeholder="Select type">
                                    <SelectItem key="amenity">Amenity</SelectItem>
                                    <SelectItem key="package">Package</SelectItem>
                                    <SelectItem key="contract">Contract</SelectItem>
                                </Select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Rate (₵)</label>
                                <Input type="number" placeholder="0.00" value={rate} onChange={(e)=>setRate(e.target.value)} startContent={<span className="text-gray-400">₵</span>} />
                            </div>
                            {serviceType === 'contract' && (
                                <>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Contract Start</label>
                                        <Input type="date" value={contractStart} onChange={(e)=>setContractStart(e.target.value)} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Contract End</label>
                                        <Input type="date" value={contractEnd} onChange={(e)=>setContractEnd(e.target.value)} />
                                    </div>
                                </>
                            )}
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                                <Textarea rows={2} placeholder="Additional details..." value={notes} onChange={(e)=>setNotes(e.target.value)} />
                            </div>
                        </div>
                    </ModalBody>
                    <ModalFooter>
                        <Button variant="flat" onPress={onClose}>Close</Button>
                        <Button color="primary" onPress={handleSaveService} isDisabled={!serviceName || !serviceType}>Save</Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>

            {/* Client Preferences Modal */}
            <Modal isOpen={showPreferences} onClose={() => setShowPreferences(false)} size="3xl">
                <ModalContent>
                    <ModalHeader>Client Preferences — {selected?.name}</ModalHeader>
                    <ModalBody>
                        {selected && (
                            <div className="space-y-6">
                                {/* Room Preferences */}
                                <div>
                                    <h4 className="font-semibold mb-3 text-gray-800">🏠 Room Preferences</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Preferred Room Type</label>
                                            <Select 
                                                selectedKeys={[selected.preferences?.preferredRoomType || 'standard']} 
                                                onSelectionChange={(k) => {
                                                    const newPreferences = { ...selected.preferences };
                                                    newPreferences.preferredRoomType = Array.from(k as Set<string>)[0] as any;
                                                    setSelected({ ...selected, preferences: newPreferences });
                                                }}
                                            >
                                                <SelectItem key="standard">Standard Room</SelectItem>
                                                <SelectItem key="deluxe">Deluxe Room</SelectItem>
                                                <SelectItem key="suite">Suite</SelectItem>
                                            </Select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Preferred Floor</label>
                                            <Select 
                                                selectedKeys={[selected.preferences?.preferredFloor || 'middle']} 
                                                onSelectionChange={(k) => {
                                                    const newPreferences = { ...selected.preferences };
                                                    newPreferences.preferredFloor = Array.from(k as Set<string>)[0] as any;
                                                    setSelected({ ...selected, preferences: newPreferences });
                                                }}
                                            >
                                                <SelectItem key="low">Low Floor (1-3)</SelectItem>
                                                <SelectItem key="middle">Middle Floor (4-7)</SelectItem>
                                                <SelectItem key="high">High Floor (8+)</SelectItem>
                                            </Select>
                                        </div>
                                    </div>
                                </div>

                                {/* Service Preferences */}
                                <div>
                                    <h4 className="font-semibold mb-3 text-gray-800">🛎️ Service Preferences</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Housekeeping Frequency</label>
                                            <Select 
                                                selectedKeys={[selected.preferences?.housekeepingFrequency || 'daily']} 
                                                onSelectionChange={(k) => {
                                                    const newPreferences = { ...selected.preferences };
                                                    newPreferences.housekeepingFrequency = Array.from(k as Set<string>)[0] as any;
                                                    setSelected({ ...selected, preferences: newPreferences });
                                                }}
                                            >
                                                <SelectItem key="daily">Daily</SelectItem>
                                                <SelectItem key="every_other_day">Every Other Day</SelectItem>
                                                <SelectItem key="weekly">Weekly</SelectItem>
                                            </Select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Check-in Time</label>
                                            <Select 
                                                selectedKeys={[selected.preferences?.checkInTime || 'standard']} 
                                                onSelectionChange={(k) => {
                                                    const newPreferences = { ...selected.preferences };
                                                    newPreferences.checkInTime = Array.from(k as Set<string>)[0] as any;
                                                    setSelected({ ...selected, preferences: newPreferences });
                                                }}
                                            >
                                                <SelectItem key="early">Early (Before 2 PM)</SelectItem>
                                                <SelectItem key="standard">Standard (2-4 PM)</SelectItem>
                                                <SelectItem key="late">Late (After 4 PM)</SelectItem>
                                            </Select>
                                        </div>
                                    </div>
                                </div>

                                {/* Special Requirements */}
                                <div>
                                    <h4 className="font-semibold mb-3 text-gray-800">⚠️ Special Requirements</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Allergies</label>
                                            <Input 
                                                placeholder="e.g., Peanuts, Shellfish, Latex"
                                                value={selected.preferences?.allergies?.join(', ') || ''}
                                                onChange={(e) => {
                                                    const newPreferences = { ...selected.preferences };
                                                    newPreferences.allergies = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                                                    setSelected({ ...selected, preferences: newPreferences });
                                                }}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Dietary Restrictions</label>
                                            <Input 
                                                placeholder="e.g., Vegetarian, Gluten-free, Halal"
                                                value={selected.preferences?.dietaryRestrictions?.join(', ') || ''}
                                                onChange={(e) => {
                                                    const newPreferences = { ...selected.preferences };
                                                    newPreferences.dietaryRestrictions = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                                                    setSelected({ ...selected, preferences: newPreferences });
                                                }}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Communication Preferences */}
                                <div>
                                    <h4 className="font-semibold mb-3 text-gray-800">📧 Communication Preferences</h4>
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-3">
                                            <input 
                                                type="checkbox" 
                                                id="newsletter"
                                                checked={selected.preferences?.newsletter || false}
                                                onChange={(e) => {
                                                    const newPreferences = { ...selected.preferences };
                                                    newPreferences.newsletter = e.target.checked;
                                                    setSelected({ ...selected, preferences: newPreferences });
                                                }}
                                            />
                                            <label htmlFor="newsletter" className="text-sm">Receive newsletter and updates</label>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <input 
                                                type="checkbox" 
                                                id="marketing"
                                                checked={selected.preferences?.marketingEmails || false}
                                                onChange={(e) => {
                                                    const newPreferences = { ...selected.preferences };
                                                    newPreferences.marketingEmails = e.target.checked;
                                                    setSelected({ ...selected, preferences: newPreferences });
                                                }}
                                            />
                                            <label htmlFor="marketing" className="text-sm">Receive marketing emails</label>
                                        </div>
                                    </div>
                                </div>

                                {/* Special Requests */}
                                <div>
                                    <h4 className="font-semibold mb-3 text-gray-800">💬 Special Requests</h4>
                                    <Textarea 
                                        rows={3}
                                        placeholder="Any special requests or notes for this client..."
                                        value={selected.preferences?.specialRequests?.join('\n') || ''}
                                        onChange={(e) => {
                                            const newPreferences = { ...selected.preferences };
                                            newPreferences.specialRequests = e.target.value.split('\n').filter(Boolean);
                                            setSelected({ ...selected, preferences: newPreferences });
                                        }}
                                    />
                                </div>
                            </div>
                        )}
                    </ModalBody>
                    <ModalFooter>
                        <Button variant="flat" onPress={() => setShowPreferences(false)}>Close</Button>
                        <Button color="primary" onPress={() => {
                            // Save preferences logic here
                            // Saving preferences
                            setShowPreferences(false);
                        }}>Save Preferences</Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>

            {/* Profile Modal */}
            <Modal
              isOpen={!!showProfile}
              onClose={() => setShowProfile(null)}
              size="2xl"
              classNames={{ base: 'sm:!max-w-3xl', closeButton: 'text-white hover:bg-white/20' }}
            >
              <ModalContent>
                {(() => {
                  const profile = rows.find((row) => row.id === showProfile);
                  const guest = frontOfficeStore.guests.find((item) => item.id === showProfile);
                  if (!profile || !guest) {
                    return (
                      <>
                        <ModalHeader>Client Profile</ModalHeader>
                        <ModalBody>Not found</ModalBody>
                      </>
                    );
                  }
                  const joined = profile.createdAt ? new Date(profile.createdAt).toLocaleDateString() : '—';
                  const removeLabel = !profile.isActive ? 'Reactivate' : clientHasHistory(profile) ? 'Deactivate' : 'Delete';
                  const fact = (label: string, value?: string | number) => (
                    <div>
                      <div className="text-xs text-gray-500">{label}</div>
                      <div className="font-semibold text-ghana-black">{value || '—'}</div>
                    </div>
                  );
                  return (
                    <>
                      <ModalHeader className="flex flex-row items-center justify-between gap-3 bg-gradient-to-r from-blue-600 to-purple-600 py-3 pr-12 text-white">
                        <div className="min-w-0">
                          <h2 className="truncate text-xl font-bold">{profile.name}</h2>
                          <p className="text-sm font-normal text-blue-100">
                            {profile.serialNumber} • {profile.type === 'corporate' ? 'Corporate' : 'Individual'}
                            {!profile.isActive ? ' • Inactive' : ''}
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-wrap justify-end gap-1">
                          <Button size="sm" variant="flat" className="bg-white/20 text-white" onPress={() => openEdit(profile)}>Edit</Button>
                          <Button size="sm" variant="flat" className="bg-white/20 text-white" onPress={() => openPreferences(profile)}>Preferences</Button>
                          <Button size="sm" variant="flat" className="bg-white/20 text-white" onPress={() => setShowMessageFor(profile.id)}>Message</Button>
                          <Button
                            size="sm"
                            variant="flat"
                            className="bg-white/20 text-white"
                            onPress={() => {
                              handleDelete(profile);
                              if (!frontOfficeStore.guests.find((item) => item.id === profile.id)) setShowProfile(null);
                            }}
                          >
                            {removeLabel}
                          </Button>
                        </div>
                      </ModalHeader>
                      <ModalBody className="gap-4">
                        <Card shadow="sm">
                          <CardBody>
                            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                              {fact('Phone', profile.phone)}
                              {fact('Email', profile.email)}
                              {fact('Nationality', profile.nationality)}
                              {fact('ID', guest.idNumber ? `${guest.idType || ''} ${guest.idNumber}`.trim() : '')}
                              {fact('Date of birth', profile.dateOfBirth ? new Date(profile.dateOfBirth).toLocaleDateString() : '')}
                              {fact('Company', profile.company)}
                              {fact('Stays', profile.reservationCount)}
                              {fact('Last visit', profile.lastVisit ? new Date(profile.lastVisit).toLocaleDateString() : '')}
                              {fact('Joined', joined)}
                            </div>
                          </CardBody>
                        </Card>
                      </ModalBody>
                    </>
                  );
                })()}
              </ModalContent>
            </Modal>

            {/* Message Modal */}
            <Modal isOpen={!!showMessageFor} onClose={()=>setShowMessageFor(null)}>
              <ModalContent>
                <ModalHeader>Message Client</ModalHeader>
                <ModalBody>
                  <Textarea placeholder="Type message (SMS/Email template)" minRows={4} />
                  <div className="flex justify-end">
                    <Button color="primary" onPress={()=>setShowMessageFor(null)}>Send</Button>
                  </div>
                </ModalBody>
              </ModalContent>
            </Modal>

            {/* Duplicates Modal */}
            <Modal isOpen={showDuplicates} onClose={()=>setShowDuplicates(false)}>
              <ModalContent>
                <ModalHeader>Possible Duplicates</ModalHeader>
                <ModalBody>
                  {duplicateList.length === 0 ? (
                    <div>No duplicates found</div>
                  ) : (
                    <div className="space-y-2 text-sm">
                      {duplicateList.map((d, idx)=>{
                        const a = frontOfficeStore.guests.find(g=>g.id===d.primaryId);
                        const b = frontOfficeStore.guests.find(g=>g.id===d.dupId);
                        return (
                          <div key={idx} className="flex items-center justify-between gap-2 p-2 rounded bg-gray-50">
                            <div>
                              <div className="font-medium">{d.reason}</div>
                              <div>{a?.id} ↔ {b?.id}</div>
                            </div>
                            <div className="flex gap-2">
                              <Button size="sm" variant="flat" onPress={()=>{
                                // Simple merge: keep primary, copy missing email/phone
                                if (a && b) {
                                  frontOfficeStore.updateGuest(a.id, {
                                    email: (a as any).email || (b as any).email,
                                    phone: (a as any).phone || (b as any).phone,
                                  });
                                  if (frontOfficeStore.guestHasHistory(b.id)) frontOfficeStore.retireGuest(b.id);
                                  else frontOfficeStore.deleteGuest(b.id);
                                }
                                setDuplicateList(prev => prev.filter((_,i)=>i!==idx));
                              }}>Merge</Button>
                              <Button size="sm" color="danger" variant="light" onPress={async () => {
                                const ok = await confirmDelete('this duplicate', 'The duplicate profile will be removed. A profile with history is deactivated instead.');
                                if (!ok) return;
                                if (frontOfficeStore.guestHasHistory(d.dupId)) frontOfficeStore.retireGuest(d.dupId);
                                else frontOfficeStore.deleteGuest(d.dupId);
                                setDuplicateList(prev => prev.filter((_,i)=>i!==idx));
                              }}>Delete Duplicate</Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </ModalBody>
                </ModalContent>
            </Modal>
		</>
	);

	return embedded ? content : <PageLayout>{content}</PageLayout>;
}
