'use client';

import React, { useState, useEffect, useMemo } from 'react';
import PageLayout from '../../components/PageLayout';
import { Card, CardBody, Button, Input, Select, SelectItem, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, Badge, Chip, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, useDisclosure, Textarea } from '@heroui/react';
import { frontOfficeStore } from '../../lib/frontoffice/store';

interface TaxRate {
	id: string;
	name: string;
	rate: number;
	type: 'vat' | 'withholding' | 'city_tax' | 'service_charge';
	status: 'active' | 'inactive';
	description: string;
	effectiveDate: string;
	expiryDate?: string;
	createdAt: string;
}

interface TaxTransaction {
	id: string;
	reservationId: string;
	guestName: string;
	amount: number;
	taxAmount: number;
	taxType: string;
	status: 'pending' | 'collected' | 'remitted' | 'refunded';
	dueDate: string;
	remittedDate?: string;
	createdAt: string;
}

export default function TaxManagementPage() {
	const { isOpen, onOpen, onClose } = useDisclosure();
	const [selectedTax, setSelectedTax] = useState<TaxRate | null>(null);
	const [formData, setFormData] = useState({
		name: '',
		rate: '',
		type: '',
		description: '',
		effectiveDate: '',
		expiryDate: '',
		status: 'active'
	});

	const taxRates: TaxRate[] = [
		{
			id: '1',
			name: 'Ghana VAT',
			rate: 12.5,
			type: 'vat',
			status: 'active',
			description: 'Standard Value Added Tax rate for Ghana',
			effectiveDate: '2024-01-01',
			createdAt: '2024-01-01'
		},
		{
			id: '2',
			name: 'Withholding Tax',
			rate: 5.0,
			type: 'withholding',
			status: 'active',
			description: 'Withholding tax on corporate payments',
			effectiveDate: '2024-01-01',
			createdAt: '2024-01-01'
		},
		{
			id: '3',
			name: 'Accra City Tax',
			rate: 2.0,
			type: 'city_tax',
			status: 'active',
			description: 'Municipal tax for Accra city',
			effectiveDate: '2024-01-01',
			createdAt: '2024-01-01'
		},
		{
			id: '4',
			name: 'Service Charge',
			rate: 10.0,
			type: 'service_charge',
			status: 'active',
			description: 'Service charge on accommodation',
			effectiveDate: '2024-01-01',
			createdAt: '2024-01-01'
		}
	];

	const taxTransactions: TaxTransaction[] = [
		{
			id: '1',
			reservationId: 'RES001',
			guestName: 'John Doe',
			amount: 500.00,
			taxAmount: 62.50,
			taxType: 'Ghana VAT',
			status: 'collected',
			dueDate: '2024-02-15',
			remittedDate: '2024-02-10',
			createdAt: '2024-01-15'
		},
		{
			id: '2',
			reservationId: 'RES002',
			guestName: 'Jane Smith',
			amount: 750.00,
			taxAmount: 93.75,
			taxType: 'Ghana VAT',
			status: 'pending',
			dueDate: '2024-02-20',
			createdAt: '2024-01-20'
		}
	];

	const handleAddTax = () => {
		setSelectedTax(null);
		setFormData({
			name: '',
			rate: '',
			type: '',
			description: '',
			effectiveDate: '',
			expiryDate: '',
			status: 'active'
		});
		onOpen();
	};

	const handleEditTax = (tax: TaxRate) => {
		setSelectedTax(tax);
		setFormData({
			name: tax.name,
			rate: tax.rate.toString(),
			type: tax.type,
			description: tax.description,
			effectiveDate: tax.effectiveDate,
			expiryDate: tax.expiryDate || '',
			status: tax.status
		});
		onOpen();
	};

	const handleSaveTax = () => {
		// In a real app, this would save to the store
		console.log('Saving tax rate:', formData);
		onClose();
	};

	const getTypeIcon = (type: string) => {
		switch (type) {
			case 'vat': return '🏛️';
			case 'withholding': return '📋';
			case 'city_tax': return '🏙️';
			case 'service_charge': return '💼';
			default: return '💰';
		}
	};

	const getStatusColor = (status: string) => {
		switch (status) {
			case 'active': return 'success';
			case 'inactive': return 'default';
			default: return 'default';
		}
	};

	const getTransactionStatusColor = (status: string) => {
		switch (status) {
			case 'collected': return 'success';
			case 'pending': return 'warning';
			case 'remitted': return 'primary';
			case 'refunded': return 'danger';
			default: return 'default';
		}
	};

	const stats = useMemo(() => {
		const totalRates = taxRates.length;
		const activeRates = taxRates.filter(rate => rate.status === 'active').length;
		const totalCollected = taxTransactions.reduce((sum, tx) => sum + tx.taxAmount, 0);
		const pendingTax = taxTransactions.filter(tx => tx.status === 'pending').reduce((sum, tx) => sum + tx.taxAmount, 0);
		
		return { totalRates, activeRates, totalCollected, pendingTax };
	}, [taxRates, taxTransactions]);

	const handleSaveTaxRate = () => {
		if (!selectedTax?.name || !selectedTax?.rate || !selectedTax?.type) return;
		
		const taxRateData: TaxRate = {
			id: selectedTax.id || `tax-${Date.now()}`,
			name: selectedTax.name,
			rate: parseFloat(selectedTax.rate),
			type: selectedTax.type as 'vat' | 'withholding' | 'city_tax' | 'service_charge',
			status: selectedTax.status,
			description: selectedTax.description || '',
			effectiveDate: selectedTax.effectiveDate || new Date().toISOString(),
			expiryDate: selectedTax.expiryDate,
			createdAt: selectedTax.createdAt || new Date().toISOString(),
			updatedAt: new Date().toISOString()
		};

		if (selectedTax) {
			// Update existing rate
			const index = taxRates.findIndex(r => r.id === selectedTax.id);
			if (index !== -1) {
				taxRates[index] = taxRateData;
				setTaxRates([...taxRates]);
			}
		} else {
			// Add new rate
			setTaxRates([...taxRates, taxRateData]);
		}
		
		onClose();
		setSelectedTax(null);
	};

	const handleProcessTransaction = (transaction: TaxTransaction) => {
		// Update transaction status
		const updatedTransaction = {
			...transaction,
			status: 'processed',
			processedAt: new Date().toISOString(),
			updatedAt: new Date().toISOString()
		};
		
		const index = taxTransactions.findIndex(tx => tx.id === transaction.id);
		if (index !== -1) {
			taxTransactions[index] = updatedTransaction;
			setTaxTransactions([...taxTransactions]);
		}
	};

	return (
		<PageLayout>
			<div className="py-8 px-6">
				<div className="max-w-7xl mx-auto">
					<div className="mb-8 flex items-center justify-between">
						<div>
							<h1 className="text-3xl font-bold text-gray-900">🧮 Tax Management</h1>
							<p className="text-gray-600">VAT, withholding tax, and compliance management</p>
						</div>
						<Button color="primary" variant="flat" onClick={handleAddTax}>➕ Add Tax Rate</Button>
					</div>

					{/* Stats Cards */}
					<div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
						<Card className="border-0 shadow-lg">
							<CardBody className="p-4">
								<div className="text-center">
									<p className="text-2xl font-bold text-blue-600">{stats.totalRates}</p>
									<p className="text-sm text-gray-600">Total Tax Rates</p>
								</div>
							</CardBody>
						</Card>
						<Card className="border-0 shadow-lg">
							<CardBody className="p-4">
								<div className="text-center">
									<p className="text-2xl font-bold text-green-600">{stats.activeRates}</p>
									<p className="text-sm text-gray-600">Active Rates</p>
								</div>
							</CardBody>
						</Card>
						<Card className="border-0 shadow-lg">
							<CardBody className="p-4">
								<div className="text-center">
									<p className="text-2xl font-bold text-purple-600">₵{stats.totalCollected.toLocaleString()}</p>
									<p className="text-sm text-gray-600">Tax Collected</p>
								</div>
							</CardBody>
						</Card>
						<Card className="border-0 shadow-lg">
							<CardBody className="p-4">
								<div className="text-center">
									<p className="text-2xl font-bold text-orange-600">₵{stats.pendingTax.toLocaleString()}</p>
									<p className="text-sm text-gray-600">Pending Tax</p>
								</div>
							</CardBody>
						</Card>
					</div>

					{/* Tax Rates Table */}
					<Card className="mb-6">
						<CardBody>
							<h3 className="text-lg font-semibold mb-4">Tax Rates Configuration</h3>
							<Table aria-label="Tax rates table">
								<TableHeader>
									<TableColumn>Tax Rate</TableColumn>
									<TableColumn>Type</TableColumn>
									<TableColumn>Rate (%)</TableColumn>
									<TableColumn>Effective Date</TableColumn>
									<TableColumn>Status</TableColumn>
									<TableColumn>Actions</TableColumn>
								</TableHeader>
								<TableBody>
									{taxRates.map((tax) => (
										<TableRow key={tax.id}>
											<TableCell>
												<div className="flex items-center gap-3">
													<span className="text-2xl">{getTypeIcon(tax.type)}</span>
													<div>
														<p className="font-medium">{tax.name}</p>
														<p className="text-sm text-gray-500">{tax.description}</p>
													</div>
												</div>
											</TableCell>
											<TableCell>
												<Badge variant="flat" color="primary">
													{tax.type.replace('_', ' ').toUpperCase()}
												</Badge>
											</TableCell>
											<TableCell>
												<span className="font-medium">{tax.rate}%</span>
											</TableCell>
											<TableCell>{tax.effectiveDate}</TableCell>
											<TableCell>
												<Badge color={getStatusColor(tax.status)} variant="flat">
													{tax.status}
												</Badge>
											</TableCell>
											<TableCell>
												<Button size="sm" variant="flat" onClick={() => handleEditTax(tax)}>
													Edit
												</Button>
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						</CardBody>
					</Card>

					{/* Tax Transactions Table */}
					<Card>
						<CardBody>
							<h3 className="text-lg font-semibold mb-4">Tax Transactions</h3>
							<Table aria-label="Tax transactions table">
								<TableHeader>
									<TableColumn>Transaction</TableColumn>
									<TableColumn>Guest</TableColumn>
									<TableColumn>Amount</TableColumn>
									<TableColumn>Tax Amount</TableColumn>
									<TableColumn>Status</TableColumn>
									<TableColumn>Due Date</TableColumn>
								</TableHeader>
								<TableBody>
									{taxTransactions.map((transaction) => (
										<TableRow key={transaction.id}>
											<TableCell>
												<div>
													<p className="font-medium">#{transaction.id}</p>
													<p className="text-sm text-gray-500">{transaction.reservationId}</p>
												</div>
											</TableCell>
											<TableCell>{transaction.guestName}</TableCell>
											<TableCell>₵{transaction.amount.toLocaleString()}</TableCell>
											<TableCell>₵{transaction.taxAmount.toLocaleString()}</TableCell>
											<TableCell>
												<Badge color={getTransactionStatusColor(transaction.status)} variant="flat">
													{transaction.status}
												</Badge>
											</TableCell>
											<TableCell>{transaction.dueDate}</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						</CardBody>
					</Card>
				</div>
			</div>

			{/* Add/Edit Tax Rate Modal */}
			<Modal isOpen={isOpen} onClose={onClose} size="2xl">
				<ModalContent>
					<ModalHeader>
						{selectedTax ? 'Edit Tax Rate' : 'Add Tax Rate'}
					</ModalHeader>
					<ModalBody>
						<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
							<div>
								<label className="block text-sm font-medium text-gray-700 mb-1">Tax Name *</label>
								<Input 
									placeholder="e.g., Ghana VAT" 
									value={formData.name} 
									onChange={(e) => setFormData({...formData, name: e.target.value})} 
								/>
							</div>
							<div>
								<label className="block text-sm font-medium text-gray-700 mb-1">Tax Type *</label>
								<Select 
									selectedKeys={[formData.type]} 
									onSelectionChange={(k) => setFormData({...formData, type: Array.from(k as Set<string>)[0] || ''})}
								>
									<SelectItem key="vat">VAT</SelectItem>
									<SelectItem key="withholding">Withholding Tax</SelectItem>
									<SelectItem key="city_tax">City Tax</SelectItem>
									<SelectItem key="service_charge">Service Charge</SelectItem>
								</Select>
							</div>
							<div>
								<label className="block text-sm font-medium text-gray-700 mb-1">Rate (%) *</label>
								<Input 
									type="number" 
									step="0.1"
									placeholder="0.0" 
									value={formData.rate} 
									onChange={(e) => setFormData({...formData, rate: e.target.value})} 
									startContent={<span className="text-gray-400">%</span>}
								/>
							</div>
							<div>
								<label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
								<Select 
									selectedKeys={[formData.status]} 
									onSelectionChange={(k) => setFormData({...formData, status: Array.from(k as Set<string>)[0] || 'active'})}
								>
									<SelectItem key="active">Active</SelectItem>
									<SelectItem key="inactive">Inactive</SelectItem>
								</Select>
							</div>
							<div>
								<label className="block text-sm font-medium text-gray-700 mb-1">Effective Date *</label>
								<Input 
									type="date" 
									value={formData.effectiveDate} 
									onChange={(e) => setFormData({...formData, effectiveDate: e.target.value})} 
								/>
							</div>
							<div>
								<label className="block text-sm font-medium text-gray-700 mb-1">Expiry Date</label>
								<Input 
									type="date" 
									value={formData.expiryDate} 
									onChange={(e) => setFormData({...formData, expiryDate: e.target.value})} 
								/>
							</div>
							<div className="md:col-span-2">
								<label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
								<Textarea 
									rows={2}
									placeholder="Brief description of the tax rate" 
									value={formData.description} 
									onChange={(e) => setFormData({...formData, description: e.target.value})} 
								/>
							</div>
						</div>
					</ModalBody>
					<ModalFooter>
						<Button variant="flat" onPress={onClose}>Cancel</Button>
						<Button color="primary" onPress={handleSaveTax} isDisabled={!formData.name || !formData.type || !formData.rate}>
							{selectedTax ? 'Update' : 'Add'} Tax Rate
						</Button>
					</ModalFooter>
				</ModalContent>
			</Modal>
		</PageLayout>
	);
}
