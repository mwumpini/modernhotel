'use client';

import React, { useState } from 'react';
import { PageLayout } from '../../components/PageLayout';
import { Card, CardBody, Button, Input, Select, SelectItem, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, Badge, Chip, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, useDisclosure } from '@heroui/react';

interface PaymentMethod {
	id: string;
	name: string;
	type: 'card' | 'mobile_money' | 'bank_transfer' | 'cash' | 'crypto';
	status: 'active' | 'inactive' | 'maintenance';
	processingFee: number;
	settlementTime: string;
	description: string;
	createdAt: string;
}

export default function PaymentMethodsPage() {
	const { isOpen, onOpen, onClose } = useDisclosure();
	const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
	const [formData, setFormData] = useState({
		name: '',
		type: '',
		processingFee: '',
		settlementTime: '',
		description: '',
		status: 'active'
	});

	const paymentMethods: PaymentMethod[] = [
		{
			id: '1',
			name: 'Visa/Mastercard',
			type: 'card',
			status: 'active',
			processingFee: 2.5,
			settlementTime: '2-3 business days',
			description: 'International credit and debit cards',
			createdAt: '2024-01-01'
		},
		{
			id: '2',
			name: 'Mobile Money (MTN)',
			type: 'mobile_money',
			status: 'active',
			processingFee: 1.0,
			settlementTime: 'Instant',
			description: 'MTN Mobile Money payments',
			createdAt: '2024-01-01'
		},
		{
			id: '3',
			name: 'Mobile Money (Vodafone)',
			type: 'mobile_money',
			status: 'active',
			processingFee: 1.0,
			settlementTime: 'Instant',
			description: 'Vodafone Cash payments',
			createdAt: '2024-01-01'
		},
		{
			id: '4',
			name: 'Bank Transfer',
			type: 'bank_transfer',
			status: 'active',
			processingFee: 0.0,
			settlementTime: '1-2 business days',
			description: 'Direct bank transfers',
			createdAt: '2024-01-01'
		},
		{
			id: '5',
			name: 'Cash',
			type: 'cash',
			status: 'active',
			processingFee: 0.0,
			settlementTime: 'Instant',
			description: 'Physical cash payments',
			createdAt: '2024-01-01'
		}
	];

	const handleAddMethod = () => {
		setSelectedMethod(null);
		setFormData({
			name: '',
			type: '',
			processingFee: '',
			settlementTime: '',
			description: '',
			status: 'active'
		});
		onOpen();
	};

	const handleEditMethod = (method: PaymentMethod) => {
		setSelectedMethod(method);
		setFormData({
			name: method.name,
			type: method.type,
			processingFee: method.processingFee.toString(),
			settlementTime: method.settlementTime,
			description: method.description,
			status: method.status
		});
		onOpen();
	};

	const handleSaveMethod = () => {
		if (!selectedMethod?.name || !selectedMethod?.type || !selectedMethod?.processingFee) return;
		
		const methodData: PaymentMethod = {
			id: selectedMethod.id || `method-${Date.now()}`,
			name: selectedMethod.name,
			type: selectedMethod.type,
			processingFee: parseFloat(selectedMethod.processingFee),
			settlementTime: selectedMethod.settlementTime,
			description: selectedMethod.description || '',
			createdAt: selectedMethod.createdAt || new Date().toISOString()
		};

		if (selectedMethod.id) {
			// Update existing method
			const index = paymentMethods.findIndex(m => m.id === selectedMethod.id);
			if (index !== -1) {
				paymentMethods[index] = methodData;
			}
		} else {
			// Add new method
			paymentMethods.push(methodData);
		}
		
		onClose();
		setSelectedMethod(null);
	};

	const getTypeIcon = (type: string) => {
		switch (type) {
			case 'card': return '💳';
			case 'mobile_money': return '📱';
			case 'bank_transfer': return '🏦';
			case 'cash': return '💵';
			case 'crypto': return '₿';
			default: return '💰';
		}
	};

	const getStatusColor = (status: string) => {
		switch (status) {
			case 'active': return 'success';
			case 'inactive': return 'default';
			case 'maintenance': return 'warning';
			default: return 'default';
		}
	};

	return (
		<PageLayout>
			<div className="py-8 px-6">
				<div className="max-w-7xl mx-auto">
					<div className="mb-8 flex items-center justify-between">
						<div>
							<h1 className="text-3xl font-bold text-gray-900">💳 Payment Methods</h1>
							<p className="text-gray-600">Manage payment options and processing fees</p>
						</div>
						<Button color="primary" variant="flat" onClick={handleAddMethod}>➕ Add Method</Button>
					</div>

					{/* Stats Cards */}
					<div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
						<Card className="border-0 shadow-lg">
							<CardBody className="p-4">
								<div className="text-center">
									<p className="text-2xl font-bold text-blue-600">{paymentMethods.length}</p>
									<p className="text-sm text-gray-600">Total Methods</p>
								</div>
							</CardBody>
						</Card>
						<Card className="border-0 shadow-lg">
							<CardBody className="p-4">
								<div className="text-center">
									<p className="text-2xl font-bold text-green-600">{paymentMethods.filter(m => m.status === 'active').length}</p>
									<p className="text-sm text-gray-600">Active Methods</p>
								</div>
							</CardBody>
						</Card>
						<Card className="border-0 shadow-lg">
							<CardBody className="p-4">
								<div className="text-center">
									<p className="text-2xl font-bold text-purple-600">{paymentMethods.filter(m => m.type === 'mobile_money').length}</p>
									<p className="text-sm text-gray-600">Mobile Money</p>
								</div>
							</CardBody>
						</Card>
						<Card className="border-0 shadow-lg">
							<CardBody className="p-4">
								<div className="text-center">
									<p className="text-2xl font-bold text-orange-600">{paymentMethods.filter(m => m.type === 'card').length}</p>
									<p className="text-sm text-gray-600">Card Methods</p>
								</div>
							</CardBody>
						</Card>
					</div>

					{/* Payment Methods Table */}
					<Card>
						<CardBody>
							<Table aria-label="Payment methods table">
								<TableHeader>
									<TableColumn>Method</TableColumn>
									<TableColumn>Type</TableColumn>
									<TableColumn>Processing Fee</TableColumn>
									<TableColumn>Settlement Time</TableColumn>
									<TableColumn>Status</TableColumn>
									<TableColumn>Actions</TableColumn>
								</TableHeader>
								<TableBody>
									{paymentMethods.map((method) => (
										<TableRow key={method.id}>
											<TableCell>
												<div className="flex items-center gap-3">
													<span className="text-2xl">{getTypeIcon(method.type)}</span>
													<div>
														<p className="font-medium">{method.name}</p>
														<p className="text-sm text-gray-500">{method.description}</p>
													</div>
												</div>
											</TableCell>
											<TableCell>
												<Badge variant="flat" color="primary">
													{method.type.replace('_', ' ').toUpperCase()}
												</Badge>
											</TableCell>
											<TableCell>
												{method.processingFee > 0 ? `${method.processingFee}%` : 'Free'}
											</TableCell>
											<TableCell>{method.settlementTime}</TableCell>
											<TableCell>
												<Badge color={getStatusColor(method.status)} variant="flat">
													{method.status}
												</Badge>
											</TableCell>
											<TableCell>
												<Button size="sm" variant="flat" onClick={() => handleEditMethod(method)}>
													Edit
												</Button>
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						</CardBody>
					</Card>
				</div>
			</div>

			{/* Add/Edit Payment Method Modal */}
			<Modal isOpen={isOpen} onClose={onClose} size="2xl">
				<ModalContent>
					<ModalHeader>
						{selectedMethod ? 'Edit Payment Method' : 'Add Payment Method'}
					</ModalHeader>
					<ModalBody>
						<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
							<div>
								<label className="block text-sm font-medium text-gray-700 mb-1">Method Name *</label>
								<Input 
									placeholder="e.g., Visa/Mastercard" 
									value={formData.name} 
									onChange={(e) => setFormData({...formData, name: e.target.value})} 
								/>
							</div>
							<div>
								<label className="block text-sm font-medium text-gray-700 mb-1">Payment Type *</label>
								<Select 
									selectedKeys={[formData.type]} 
									onSelectionChange={(k) => setFormData({...formData, type: Array.from(k as Set<string>)[0] || ''})}
								>
									<SelectItem key="card">Credit/Debit Card</SelectItem>
									<SelectItem key="mobile_money">Mobile Money</SelectItem>
									<SelectItem key="bank_transfer">Bank Transfer</SelectItem>
									<SelectItem key="cash">Cash</SelectItem>
									<SelectItem key="crypto">Cryptocurrency</SelectItem>
								</Select>
							</div>
							<div>
								<label className="block text-sm font-medium text-gray-700 mb-1">Processing Fee (%)</label>
								<Input 
									type="number" 
									step="0.1"
									placeholder="0.0" 
									value={formData.processingFee} 
									onChange={(e) => setFormData({...formData, processingFee: e.target.value})} 
									startContent={<span className="text-gray-400">%</span>}
								/>
							</div>
							<div>
								<label className="block text-sm font-medium text-gray-700 mb-1">Settlement Time</label>
								<Input 
									placeholder="e.g., 2-3 business days" 
									value={formData.settlementTime} 
									onChange={(e) => setFormData({...formData, settlementTime: e.target.value})} 
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
									<SelectItem key="maintenance">Maintenance</SelectItem>
								</Select>
							</div>
							<div className="md:col-span-2">
								<label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
								<Input 
									placeholder="Brief description of the payment method" 
									value={formData.description} 
									onChange={(e) => setFormData({...formData, description: e.target.value})} 
								/>
							</div>
						</div>
					</ModalBody>
					<ModalFooter>
						<Button variant="flat" onPress={onClose}>Cancel</Button>
						<Button color="primary" onPress={handleSaveMethod} isDisabled={!formData.name || !formData.type}>
							{selectedMethod ? 'Update' : 'Add'} Method
						</Button>
					</ModalFooter>
				</ModalContent>
			</Modal>
		</PageLayout>
	);
}
