'use client';

import React, { useEffect, useMemo, useState } from 'react';
import PageLayout from '../../components/PageLayout';
import { Card, CardBody, Button, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, Input, Select, SelectItem, Avatar, Badge } from '@heroui/react';
import { Dropdown, DropdownTrigger, DropdownMenu, DropdownItem } from '@heroui/react';
import { Tabs, Tab } from '@heroui/react';
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Textarea, useDisclosure } from '@heroui/react';
import { frontOfficeStore } from '../../lib/frontoffice/store';

interface InvoiceData {
	id: string;
	invoiceNumber: string;
	guestName: string;
	roomNumber: string;
	totalAmount: number;
	outstandingBalance: number;
	status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
	dueDate: string;
	billingPerson?: string;
	phone?: string;
	email?: string;
}

export default function InvoicesPaymentsPage() {
	const [invoices, setInvoices] = useState<InvoiceData[]>([]);
	const [searchTerm, setSearchTerm] = useState('');
	const [statusFilter, setStatusFilter] = useState<string>('all');
	const [selectedInvoice, setSelectedInvoice] = useState<InvoiceData | null>(null);
	const { isOpen, onOpen, onClose } = useDisclosure();
	const [paymentAmount, setPaymentAmount] = useState('');
	const [paymentMethod, setPaymentMethod] = useState('');
	const [paymentNotes, setPaymentNotes] = useState('');
	const [isProcessing, setIsProcessing] = useState(false);
	const [activeTab, setActiveTab] = useState<'overview' | 'payments'>('overview');

	const handleProcessPayment = async () => {
		if (!selectedInvoice) return;
		setIsProcessing(true);
		try {
			const amount = parseFloat(paymentAmount);
			if (isNaN(amount) || amount <= 0 || !paymentMethod) return;
			const reservation = frontOfficeStore.reservations.find(r => r.id === selectedInvoice.id);
			if (reservation) {
				reservation.paymentMethod = paymentMethod;
				reservation.paymentDate = new Date().toISOString();
				reservation.billingNotes = paymentNotes;
				// Update payment status and potentially checkout status
				reservation.paymentStatus = 'paid';
				reservation.amountPaid = (reservation.amountPaid || 0) + amount;
				
				// If full payment, mark as fully paid
				if (amount >= selectedInvoice.outstandingBalance) {
					reservation.paymentStatus = 'fully_paid';
					// If guest is checked out and fully paid, update status
					if (reservation.status === 'checked-out') {
						reservation.checkoutStatus = 'completed';
					}
				}
				frontOfficeStore.notify();
			}
			onClose();
			setSelectedInvoice(null);
			setPaymentAmount('');
			setPaymentMethod('');
			setPaymentNotes('');
		} finally {
			setIsProcessing(false);
		}
	};

	const handleSendInvoice = async (invoice: InvoiceData) => {
		const reservation = frontOfficeStore.reservations.find(r => r.id === invoice.id);
		if (reservation) {
			reservation.invoiceStatus = 'sent';
			reservation.invoiceSentDate = new Date().toISOString();
			frontOfficeStore.notify();
		}
	};

	const handleCreateInvoice = () => {
		// Find checked-in guests without invoices
		const checkedInGuests = frontOfficeStore.reservations.filter(r => 
			r.status === 'checked-in' && !invoices.find(inv => inv.id === r.id)
		);
		
		if (checkedInGuests.length === 0) {
			alert('No checked-in guests found without invoices');
			return;
		}
		
		// Create invoices for checked-in guests
		checkedInGuests.forEach(reservation => {
			reservation.invoiceGenerated = true;
			reservation.invoiceGeneratedDate = new Date().toISOString();
		});
		
		frontOfficeStore.notify();
	};

	useEffect(() => {
		const load = () => {
			const reservations = frontOfficeStore.reservations;
			const invoices = reservations.filter(r => r.invoiceGenerated).map(r => ({
				id: r.id,
				reservationId: r.id,
				guestName: r.guestName,
				guestPhone: r.guestPhone || '',
				guestEmail: r.guestEmail || '',
				checkIn: r.arrival,
				checkOut: r.departure,
				amount: r.rateBreakdown?.[0]?.total || 0,
				status: r.invoiceStatus || 'draft',
				dueDate: r.departure,
				createdAt: r.createdAt,
				billingPerson: r.billingPerson || null
			}));
			setInvoices(invoices);
		};
		load();
		const unsub = frontOfficeStore.subscribe(load);
		return unsub;
	}, []);

	const filtered = useMemo(() => {
		let list = invoices;
		if (searchTerm) {
			list = list.filter(inv => (
				inv.guestName.toLowerCase().includes(searchTerm.toLowerCase()) ||
				inv.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
				inv.roomNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
				inv.phone?.includes(searchTerm) ||
				inv.email?.toLowerCase().includes(searchTerm.toLowerCase())
			));
		}
		if (statusFilter !== 'all') list = list.filter(inv => inv.status === statusFilter);
		return list;
	}, [invoices, searchTerm, statusFilter]);

	return (
		<PageLayout>
			<div className="py-8 px-6">
				<div className="max-w-7xl mx-auto">
					<div className="mb-8 flex items-center justify-between">
						<div>
							<h1 className="text-3xl font-bold text-gray-900">💰 Invoices & Payments</h1>
							<p className="text-gray-600">Manage billing, invoicing, and payment processing</p>
						</div>
						<Button color="primary" variant="flat" onClick={handleCreateInvoice}>📄 Create Invoice</Button>
					</div>

					<div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
						<Card className="border-0 shadow-lg"><CardBody>Total Invoices: {invoices.length}</CardBody></Card>
						<Card className="border-0 shadow-lg"><CardBody>Outstanding: ₵{invoices.reduce((s, i) => s + i.outstandingBalance, 0).toLocaleString()}</CardBody></Card>
						<Card className="border-0 shadow-lg"><CardBody>Paid: ₵{invoices.filter(i=>i.status==='paid').reduce((s, i)=> s + i.totalAmount, 0).toLocaleString()}</CardBody></Card>
						<Card className="border-0 shadow-lg"><CardBody>Overdue: ₵{invoices.filter(i=>i.status==='overdue').reduce((s, i)=> s + i.outstandingBalance, 0).toLocaleString()}</CardBody></Card>
					</div>

					<div className="flex flex-col sm:flex-row gap-4 mb-6">
						<Input placeholder="Search by guest, invoice, room, phone, email" value={searchTerm} onChange={(e)=>setSearchTerm(e.target.value)} className="flex-1" />
						<Select selectedKeys={[statusFilter]} onSelectionChange={(keys)=>setStatusFilter(Array.from(keys as Set<string>)[0]||'all')} className="w-full sm:w-48">
							<SelectItem key="all">All Statuses</SelectItem>
							<SelectItem key="draft">Draft</SelectItem>
							<SelectItem key="sent">Sent</SelectItem>
							<SelectItem key="paid">Paid</SelectItem>
							<SelectItem key="overdue">Overdue</SelectItem>
							<SelectItem key="cancelled">Cancelled</SelectItem>
						</Select>
					</div>

					<Tabs selectedKey={activeTab} onSelectionChange={(k)=>setActiveTab(k as 'overview'|'payments')} className="mb-4">
						<Tab key="overview" title="📊 Overview"/>
						<Tab key="payments" title="💳 Payments"/>
					</Tabs>

					<Table aria-label="Invoices table" className={activeTab==='overview'?'':'hidden'}>
						<TableHeader>
							<TableColumn>Invoice</TableColumn>
							<TableColumn>Guest</TableColumn>
							<TableColumn>Room</TableColumn>
							<TableColumn>Amount</TableColumn>
							<TableColumn>Due Date</TableColumn>
							<TableColumn>Status</TableColumn>
							<TableColumn>Actions</TableColumn>
						</TableHeader>
						<TableBody>
							{filtered.map(inv => (
								<TableRow key={inv.id}>
									<TableCell>{inv.invoiceNumber}</TableCell>
									<TableCell>
										<div className="flex items-center gap-3">
											<Avatar name={inv.guestName} size="sm" className="bg-ghana-gold text-white" />
											<div>
												<p className="font-medium">{inv.guestName}</p>
												<p className="text-xs text-gray-500">{inv.phone}</p>
											</div>
										</div>
									</TableCell>
									<TableCell>
										<div>
											<p className="font-medium">{inv.roomNumber}</p>
											{inv.billingPerson && <p className="text-xs text-gray-500">Bill to: {inv.billingPerson}</p>}
										</div>
									</TableCell>
									<TableCell>
										<p>₵{inv.totalAmount.toLocaleString()}</p>
										{inv.outstandingBalance > 0 && <p className="text-xs text-red-600">Outstanding: ₵{inv.outstandingBalance.toLocaleString()}</p>}
									</TableCell>
									<TableCell>{new Date(inv.dueDate).toLocaleDateString()}</TableCell>
									<TableCell>
										<Badge variant="flat" color={inv.status==='paid'?'success':inv.status==='overdue'?'danger':inv.status==='sent'?'primary':inv.status==='cancelled'?'secondary':'default'}>
											{inv.status}
										</Badge>
									</TableCell>
									<TableCell>
										<div className="flex gap-2">
											<Button size="sm" variant="flat" onClick={() => { setSelectedInvoice(inv); onOpen(); }}>
												{inv.status==='paid'?'View':'Manage'}
											</Button>
											<Dropdown>
												<DropdownTrigger>
													<Button size="sm" variant="flat" isIconOnly>⋯</Button>
												</DropdownTrigger>
												<DropdownMenu>
													<DropdownItem key="view" onClick={() => { setSelectedInvoice(inv); onOpen(); }}>View Details</DropdownItem>
													{inv.status==='draft' && (
														<DropdownItem key="send" onClick={() => handleSendInvoice(inv)}>Send Invoice</DropdownItem>
													)}
													{inv.status==='sent' && (
														<DropdownItem key="process" onClick={() => { setSelectedInvoice(inv); onOpen(); }}>Process Payment</DropdownItem>
													)}
													<DropdownItem key="download" onClick={() => window.open(`/api/invoices/${inv.id}/pdf`, '_blank')}>Download PDF</DropdownItem>
												</DropdownMenu>
											</Dropdown>
										</div>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>

					{activeTab === 'payments' && (
						<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
							<Card>
								<CardBody>
									<h3 className="text-lg font-semibold mb-3">Recent Payments</h3>
									<div className="space-y-3">
										{invoices.filter(i=>i.status==='paid').slice(0,5).map(i=> (
											<div key={i.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
												<div>
													<p className="font-medium">{i.guestName}</p>
													<p className="text-xs text-gray-500">{i.invoiceNumber}</p>
												</div>
												<div className="text-right">
													<p className="font-medium">₵{i.totalAmount.toLocaleString()}</p>
												</div>
											</div>
										))}
									</div>
								</CardBody>
							</Card>
							<Card>
								<CardBody>
									<h3 className="text-lg font-semibold mb-3">Overdue Invoices</h3>
									<div className="space-y-3">
										{invoices.filter(i=>i.status==='overdue').slice(0,5).map(i=> (
											<div key={i.id} className="flex justify-between items-center p-3 bg-red-50 rounded-lg">
												<div>
													<p className="font-medium">{i.guestName}</p>
													<p className="text-xs text-gray-500">{i.invoiceNumber}</p>
												</div>
												<div className="text-right">
													<p className="font-medium text-red-600">₵{i.outstandingBalance.toLocaleString()}</p>
													<p className="text-xs text-gray-500">Due: {new Date(i.dueDate).toLocaleDateString()}</p>
												</div>
											</div>
										))}
									</div>
								</CardBody>
							</Card>
						</div>
					)}
				</div>
			</div>
		{/* Invoice Management Modal */}
		<Modal isOpen={isOpen} onClose={onClose} size="2xl">
			<ModalContent>
				<ModalHeader>Manage Invoice</ModalHeader>
				<ModalBody>
					{selectedInvoice && (
						<div className="space-y-4">
							<div className="grid grid-cols-2 gap-4">
								<div>
									<label className="block text-sm font-medium text-gray-700 mb-1">Invoice Number</label>
									<p className="text-lg font-semibold">{selectedInvoice.invoiceNumber}</p>
								</div>
								<div>
									<label className="block text-sm font-medium text-gray-700 mb-1">Guest Name</label>
									<p className="text-lg font-semibold">{selectedInvoice.guestName}</p>
								</div>
								<div>
									<label className="block text-sm font-medium text-gray-700 mb-1">Room Number</label>
									<p className="text-lg">{selectedInvoice.roomNumber}</p>
								</div>
								<div>
									<label className="block text-sm font-medium text-gray-700 mb-1">Total Amount</label>
									<p className="text-lg font-semibold text-green-600">₵{selectedInvoice.totalAmount.toLocaleString()}</p>
								</div>
								<div>
									<label className="block text-sm font-medium text-gray-700 mb-1">Outstanding Balance</label>
									<p className="text-lg font-semibold text-red-600">₵{selectedInvoice.outstandingBalance.toLocaleString()}</p>
								</div>
								<div>
									<label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
									<p className="text-lg">{new Date(selectedInvoice.dueDate).toLocaleDateString()}</p>
								</div>
							</div>

							{selectedInvoice.billingPerson && (
								<div>
									<label className="block text-sm font-medium text-gray-700 mb-1">Billing Person</label>
									<p className="text-gray-600">{selectedInvoice.billingPerson}</p>
								</div>
							)}

							{selectedInvoice.status !== 'paid' && (
								<div className="border-t pt-4">
									<h4 className="font-semibold mb-3">Process Payment</h4>
									<div className="grid grid-cols-2 gap-4">
										<div>
											<label className="block text-sm font-medium text-gray-700 mb-1">Payment Amount</label>
											<Input type="number" placeholder="Enter amount" value={paymentAmount} onChange={(e)=>setPaymentAmount(e.target.value)} startContent={<span className="text-gray-400">₵</span>} />
										</div>
										<div>
											<label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
											<Select selectedKeys={[paymentMethod]} onSelectionChange={(keys)=>setPaymentMethod(Array.from(keys as Set<string>)[0]||'')} placeholder="Select method">
												<SelectItem key="cash">Cash</SelectItem>
												<SelectItem key="card">Credit/Debit Card</SelectItem>
												<SelectItem key="bank_transfer">Bank Transfer</SelectItem>
												<SelectItem key="mobile_money">Mobile Money</SelectItem>
												<SelectItem key="check">Check</SelectItem>
											</Select>
										</div>
									</div>
									<div className="mt-3">
										<label className="block text-sm font-medium text-gray-700 mb-1">Payment Notes</label>
										<Textarea placeholder="Add payment notes..." value={paymentNotes} onChange={(e)=>setPaymentNotes(e.target.value)} className="w-full" rows={2} />
									</div>
								</div>
							)}
						</div>
					)}
				</ModalBody>
				<ModalFooter>
					<Button variant="flat" onPress={onClose}>Close</Button>
					{selectedInvoice && selectedInvoice.status !== 'paid' && (
						<Button color="primary" isDisabled={!paymentAmount || !paymentMethod} isLoading={isProcessing} onPress={handleProcessPayment}>Process Payment</Button>
					)}
				</ModalFooter>
			</ModalContent>
		</Modal>
	</PageLayout>
	);
}
