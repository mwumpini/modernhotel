'use client';

import React, { useState, useMemo } from 'react';
import { Card, CardBody, Button, Input, Select, SelectItem, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, Badge, Chip, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, useDisclosure, Textarea } from '@heroui/react';

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

export default function TaxManagementSettings() {
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
		if (!formData.name || !formData.rate || !formData.type) return;
		
		const taxData: TaxRate = {
			id: selectedTax?.id || `tax-${Date.now()}`,
			name: formData.name,
			rate: parseFloat(formData.rate),
			type: formData.type as any,
			description: formData.description || '',
			status: formData.status as any,
			effectiveDate: formData.effectiveDate,
			expiryDate: formData.expiryDate || undefined,
			createdAt: selectedTax?.createdAt || new Date().toISOString()
		};

		// In a real app, this would save to a store
		console.log('Saving tax rate:', taxData);
		onClose();
		setSelectedTax(null);
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

	return (
		<div className="space-y-6">
			<div className="flex justify-between items-center">
				<div>
					<h3 className="text-xl font-semibold mb-2">Tax Management Configuration</h3>
					<p className="text-gray-600">Configure tax rates, rules, and compliance settings</p>
				</div>
				<Button color="primary" onPress={handleAddTax}>
					Add Tax Rate
				</Button>
			</div>

			{/* Stats Cards */}
			<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
				<Card>
					<CardBody className="text-center">
						<p className="text-2xl font-bold text-blue-600">{stats.totalRates}</p>
						<p className="text-sm text-gray-600">Total Tax Rates</p>
					</CardBody>
				</Card>
				<Card>
					<CardBody className="text-center">
						<p className="text-2xl font-bold text-green-600">{stats.activeRates}</p>
						<p className="text-sm text-gray-600">Active Rates</p>
					</CardBody>
				</Card>
				<Card>
					<CardBody className="text-center">
						<p className="text-2xl font-bold text-purple-600">₵{stats.totalCollected.toFixed(2)}</p>
						<p className="text-sm text-gray-600">Total Collected</p>
					</CardBody>
				</Card>
				<Card>
					<CardBody className="text-center">
						<p className="text-2xl font-bold text-orange-600">₵{stats.pendingTax.toFixed(2)}</p>
						<p className="text-sm text-gray-600">Pending Tax</p>
					</CardBody>
				</Card>
			</div>

			{/* Tax Rates Table */}
			<Card>
				<CardBody>
					<h4 className="text-lg font-semibold mb-4">Tax Rates Configuration</h4>
					<Table aria-label="Tax rates table">
						<TableHeader>
							<TableColumn>TAX NAME</TableColumn>
							<TableColumn>TYPE</TableColumn>
							<TableColumn>RATE</TableColumn>
							<TableColumn>EFFECTIVE DATE</TableColumn>
							<TableColumn>STATUS</TableColumn>
							<TableColumn>ACTIONS</TableColumn>
						</TableHeader>
						<TableBody>
							{taxRates.map((tax) => (
								<TableRow key={tax.id}>
									<TableCell>
										<div className="flex items-center gap-2">
											<span className="text-lg">{getTypeIcon(tax.type)}</span>
											<div>
												<p className="font-medium">{tax.name}</p>
												<p className="text-sm text-gray-500">{tax.description}</p>
											</div>
										</div>
									</TableCell>
									<TableCell>
										<Chip size="sm" variant="flat">
											{tax.type.replace('_', ' ').toUpperCase()}
										</Chip>
									</TableCell>
									<TableCell>
										<span className="font-medium">{tax.rate}%</span>
									</TableCell>
									<TableCell>
										<span className="text-sm">{tax.effectiveDate}</span>
									</TableCell>
									<TableCell>
										<Badge color={getStatusColor(tax.status)} variant="flat">
											{tax.status}
										</Badge>
									</TableCell>
									<TableCell>
										<Button size="sm" variant="light" onPress={() => handleEditTax(tax)}>
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
					<h4 className="text-lg font-semibold mb-4">Recent Tax Transactions</h4>
					<Table aria-label="Tax transactions table">
						<TableHeader>
							<TableColumn>RESERVATION</TableColumn>
							<TableColumn>GUEST</TableColumn>
							<TableColumn>AMOUNT</TableColumn>
							<TableColumn>TAX AMOUNT</TableColumn>
							<TableColumn>STATUS</TableColumn>
							<TableColumn>DUE DATE</TableColumn>
						</TableHeader>
						<TableBody>
							{taxTransactions.map((transaction) => (
								<TableRow key={transaction.id}>
									<TableCell>
										<span className="font-medium">{transaction.reservationId}</span>
									</TableCell>
									<TableCell>
										<span>{transaction.guestName}</span>
									</TableCell>
									<TableCell>
										<span className="font-medium">₵{transaction.amount.toFixed(2)}</span>
									</TableCell>
									<TableCell>
										<span className="font-medium">₵{transaction.taxAmount.toFixed(2)}</span>
									</TableCell>
									<TableCell>
										<Badge color={getTransactionStatusColor(transaction.status)} variant="flat">
											{transaction.status}
										</Badge>
									</TableCell>
									<TableCell>
										<span className="text-sm">{transaction.dueDate}</span>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</CardBody>
			</Card>

			{/* Add/Edit Modal */}
			<Modal isOpen={isOpen} onClose={onClose} size="lg">
				<ModalContent>
					<ModalHeader>
						{selectedTax ? 'Edit Tax Rate' : 'Add Tax Rate'}
					</ModalHeader>
					<ModalBody>
						<div className="space-y-4">
							<Input
								label="Tax Name"
								placeholder="e.g., Ghana VAT"
								value={formData.name}
								onChange={(e) => setFormData({ ...formData, name: e.target.value })}
							/>
							<Select
								label="Tax Type"
								placeholder="Select tax type"
								value={formData.type}
								onChange={(e) => setFormData({ ...formData, type: e.target.value })}
							>
								<SelectItem key="vat" value="vat">🏛️ VAT</SelectItem>
								<SelectItem key="withholding" value="withholding">📋 Withholding Tax</SelectItem>
								<SelectItem key="city_tax" value="city_tax">🏙️ City Tax</SelectItem>
								<SelectItem key="service_charge" value="service_charge">💼 Service Charge</SelectItem>
							</Select>
							<Input
								label="Tax Rate (%)"
								placeholder="0.00"
								type="number"
								step="0.01"
								value={formData.rate}
								onChange={(e) => setFormData({ ...formData, rate: e.target.value })}
							/>
							<Textarea
								label="Description"
								placeholder="Brief description of the tax"
								value={formData.description}
								onChange={(e) => setFormData({ ...formData, description: e.target.value })}
							/>
							<Input
								label="Effective Date"
								type="date"
								value={formData.effectiveDate}
								onChange={(e) => setFormData({ ...formData, effectiveDate: e.target.value })}
							/>
							<Input
								label="Expiry Date (Optional)"
								type="date"
								value={formData.expiryDate}
								onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
							/>
							<Select
								label="Status"
								value={formData.status}
								onChange={(e) => setFormData({ ...formData, status: e.target.value })}
							>
								<SelectItem key="active" value="active">Active</SelectItem>
								<SelectItem key="inactive" value="inactive">Inactive</SelectItem>
							</Select>
						</div>
					</ModalBody>
					<ModalFooter>
						<Button variant="light" onPress={onClose}>
							Cancel
						</Button>
						<Button color="primary" onPress={handleSaveTax}>
							{selectedTax ? 'Update' : 'Add'} Tax Rate
						</Button>
					</ModalFooter>
				</ModalContent>
			</Modal>
		</div>
	);
}
