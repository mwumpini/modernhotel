'use client';

import React, { useEffect, useMemo, useState } from 'react';
import PageLayout from '../../components/PageLayout';
import { Card, CardBody, Button, Input, Select, SelectItem, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, Avatar, Badge } from '@heroui/react';
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Textarea, useDisclosure, Tabs, Tab } from '@heroui/react';
import { frontOfficeStore } from '../../lib/frontoffice/store';
import { GuestProfile, Reservation } from '../../lib/frontoffice/types';

interface ClientRow {
	id: string;
	name: string;
	email?: string;
	phone?: string;
	type: 'individual' | 'corporate';
	services: number;
	totalSpent: number;
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

export default function ClientsServicesPage() {
	const [rows, setRows] = useState<ClientRow[]>([]);
	const [searchTerm, setSearchTerm] = useState('');
	const [typeFilter, setTypeFilter] = useState<'all' | 'individual' | 'corporate'>('all');
    const [selected, setSelected] = useState<ClientRow | null>(null);
    const { isOpen, onOpen, onClose } = useDisclosure();
    const { isOpen: isNewOpen, onOpen: onNewOpen, onClose: onNewClose } = useDisclosure();
    const [activeTab, setActiveTab] = useState<'overview'|'analytics'>('overview');
    const [serviceName, setServiceName] = useState('');
    const [serviceType, setServiceType] = useState('');
    const [rate, setRate] = useState('');
    const [notes, setNotes] = useState('');
    const [contractStart, setContractStart] = useState('');
    const [contractEnd, setContractEnd] = useState('');
    const [clientServices, setClientServices] = useState<ClientService[]>([]);
    const [newClient, setNewClient] = useState({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        type: 'individual' as 'individual' | 'corporate',
        companyName: '',
        isCorporate: false
    });

	useEffect(() => {
		const load = () => {
			// Gather clients from store (guests), aggregate simple service metrics from reservations
			const guests = frontOfficeStore.guests || [];
			const reservations = frontOfficeStore.reservations || [];
			// Load client services from store
			const services = frontOfficeStore.clientServices || [];
			setClientServices(services);

			const rowsData: ClientRow[] = guests.map((g: GuestProfile) => {
				const fullName = [g.firstName, g.middleName, g.lastName].filter(Boolean).join(' ').trim() || 'Unknown';
				const clientReservations = reservations.filter((r: Reservation) => r.guestId === g.id || r.guestName?.includes(g.lastName || ''));
				const clientServicesCount = services.filter((s: ClientService) => s.clientId === g.id && s.isActive).length;
				const totalSpent = clientReservations.reduce((sum: number, r: Reservation) => sum + (r.rateBreakdown?.reduce((s: number, d) => s + d.total, 0) || 0), 0);
				return {
					id: g.id,
					name: fullName,
					email: g.email,
					phone: g.phone,
					type: (g.companyName || g.isCorporate) ? 'corporate' : 'individual',
					services: clientServicesCount,
					totalSpent,
				};
			});
			setRows(rowsData);
		};
		load();
		const unsub = frontOfficeStore.subscribe(load);
		return unsub;
	}, []);

	const filtered = useMemo(() => {
		let list = rows;
		if (searchTerm) {
			list = list.filter(r => (
				r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
				r.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
				r.phone?.includes(searchTerm)
			));
		}
		if (typeFilter !== 'all') list = list.filter(r => r.type === typeFilter);
		return list;
	}, [rows, searchTerm, typeFilter]);

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

    const handleCreateClient = () => {
        if (!newClient.firstName || !newClient.lastName) return;
        
        const clientId = `guest_${Date.now()}`;
        const newGuest: GuestProfile = {
            id: clientId,
            serialNumber: `C${String(frontOfficeStore.guests.length + 1).padStart(3, '0')}`,
            firstName: newClient.firstName,
            lastName: newClient.lastName,
            middleName: '',
            phone: newClient.phone || undefined,
            email: newClient.email || undefined,
            nationality: 'ghanaian',
            idType: 'ghana_card',
            idNumber: '',
            dateOfBirth: '',
            gender: 'prefer_not_to_say',
            emergencyContact: {
                name: '',
                relationship: 'other',
                phone: '',
                email: '',
                address: ''
            },
            source: 'walkin',
            address: '',
            city: '',
            country: '',
            notes: newClient.isCorporate ? `Corporate client - ${newClient.companyName}` : ''
        };
        
        // Add to store
        if (!frontOfficeStore.guests) {
            frontOfficeStore.guests = [];
        }
        frontOfficeStore.guests.push(newGuest);
        frontOfficeStore.notify();
        
        // Reset form and close modal
        setNewClient({
            firstName: '',
            lastName: '',
            email: '',
            phone: '',
            type: 'individual',
            companyName: '',
            isCorporate: false
        });
        onNewClose();
    };

    const resetNewClientForm = () => {
        setNewClient({
            firstName: '',
            lastName: '',
            email: '',
            phone: '',
            type: 'individual',
            companyName: '',
            isCorporate: false
        });
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
        
        // Add to store
        if (!frontOfficeStore.clientServices) {
            frontOfficeStore.clientServices = [];
        }
        frontOfficeStore.clientServices.push(newService);
        frontOfficeStore.notify();
        
        onClose();
        setSelected(null);
        setServiceName('');
        setServiceType('');
        setRate('');
        setNotes('');
        setContractStart('');
        setContractEnd('');
    };

	return (
		<PageLayout>
			<div className="py-8 px-6">
				<div className="max-w-7xl mx-auto">
					<div className="mb-8 flex items-center justify-between">
						<div>
							<h1 className="text-3xl font-bold text-gray-900">👥 Clients & Services</h1>
							<p className="text-gray-600">Manage clients, corporate accounts, and service offerings</p>
						</div>
						<Button color="primary" variant="flat" onClick={onNewOpen}>➕ New Client</Button>
					</div>

					<div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
						<Card className="border-0 shadow-lg"><CardBody> Total Clients: {stats.totalClients}</CardBody></Card>
						<Card className="border-0 shadow-lg"><CardBody> Active Services: {stats.activeServices}</CardBody></Card>
						<Card className="border-0 shadow-lg"><CardBody> Contracts: {stats.contracts}</CardBody></Card>
						<Card className="border-0 shadow-lg"><CardBody> Revenue: ₵{stats.revenue.toLocaleString()}</CardBody></Card>
					</div>

                    <Tabs selectedKey={activeTab} onSelectionChange={(k)=>setActiveTab(k as 'overview'|'analytics')} className="mb-4">
                        <Tab key="overview" title="📋 Overview"/>
                        <Tab key="analytics" title="📈 Analytics"/>
                    </Tabs>

					<div className="flex flex-col sm:flex-row gap-4 mb-6">
						<Input placeholder="Search by name, email, phone" value={searchTerm} onChange={(e)=>setSearchTerm(e.target.value)} className="flex-1" />
						<Select selectedKeys={[typeFilter]} onSelectionChange={(keys)=>setTypeFilter((Array.from(keys as Set<string>)[0] as string)||'all')} className="w-full sm:w-48">
							<SelectItem key="all">All Types</SelectItem>
							<SelectItem key="individual">Individual</SelectItem>
							<SelectItem key="corporate">Corporate</SelectItem>
						</Select>
					</div>

					<Table aria-label="Clients and services table" className={activeTab==='overview'?'':'hidden'}>
						<TableHeader>
							<TableColumn>Client</TableColumn>
							<TableColumn>Type</TableColumn>
							<TableColumn>Services</TableColumn>
							<TableColumn>Total Spent</TableColumn>
							<TableColumn>Actions</TableColumn>
						</TableHeader>
						<TableBody>
							{filtered.map(row => (
								<TableRow key={row.id}>
									<TableCell>
										<div className="flex items-center gap-3">
											<Avatar name={row.name} size="sm" className="bg-ghana-gold text-white" />
											<div>
												<p className="font-medium">{row.name}</p>
												<p className="text-xs text-gray-500">{row.email || row.phone || '—'}</p>
											</div>
										</div>
									</TableCell>
									<TableCell>
										<Badge variant="flat" color={row.type==='corporate'?'primary':'default'}>{row.type}</Badge>
									</TableCell>
									<TableCell>{row.services}</TableCell>
									<TableCell>₵{row.totalSpent.toLocaleString()}</TableCell>
									<TableCell>
										<Button size="sm" variant="flat" onClick={()=>openManage(row)}>Manage</Button>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>

                    {activeTab==='analytics' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <Card><CardBody>Top Clients by Spend (coming soon)</CardBody></Card>
                            <Card><CardBody>Services Usage Trends (coming soon)</CardBody></Card>
                        </div>
                    )}

				</div>
			</div>

            {/* New Client Modal */}
            <Modal isOpen={isNewOpen} onClose={onNewClose} size="2xl">
                <ModalContent>
                    <ModalHeader>Create New Client</ModalHeader>
                    <ModalBody>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
                                <Input placeholder="First name" value={newClient.firstName} onChange={(e)=>setNewClient({...newClient, firstName: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
                                <Input placeholder="Last name" value={newClient.lastName} onChange={(e)=>setNewClient({...newClient, lastName: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                                <Input type="email" placeholder="email@example.com" value={newClient.email} onChange={(e)=>setNewClient({...newClient, email: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                                <Input placeholder="Phone number" value={newClient.phone} onChange={(e)=>setNewClient({...newClient, phone: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Client Type</label>
                                <Select selectedKeys={[newClient.type]} onSelectionChange={(k)=>setNewClient({...newClient, type: Array.from(k as Set<string>)[0] as 'individual'|'corporate'})}>
                                    <SelectItem key="individual">Individual</SelectItem>
                                    <SelectItem key="corporate">Corporate</SelectItem>
                                </Select>
                            </div>
                            {newClient.type === 'corporate' && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
                                    <Input placeholder="Company name" value={newClient.companyName} onChange={(e)=>setNewClient({...newClient, companyName: e.target.value})} />
                                </div>
                            )}
                        </div>
                    </ModalBody>
                    <ModalFooter>
                        <Button variant="flat" onPress={() => { onNewClose(); resetNewClientForm(); }}>Cancel</Button>
                        <Button color="primary" onPress={handleCreateClient} isDisabled={!newClient.firstName || !newClient.lastName}>Create Client</Button>
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
		</PageLayout>
	);
}
