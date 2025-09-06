'use client';

import React, { useState } from 'react';
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

export default function PaymentMethodsSettings() {
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
		if (!formData.name || !formData.type || !formData.processingFee) return;
		
		const methodData: PaymentMethod = {
			id: selectedMethod?.id || `method-${Date.now()}`,
			name: formData.name,
			type: formData.type as any,
			processingFee: parseFloat(formData.processingFee),
			settlementTime: formData.settlementTime,
			description: formData.description || '',
			status: formData.status as any,
			createdAt: selectedMethod?.createdAt || new Date().toISOString()
		};

		// In a real app, this would save to a store
		console.log('Saving payment method:', methodData);
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
		<div className="space-y-6">
			<div className="flex justify-between items-center">
				<div>
					<h3 className="text-xl font-semibold mb-2">Payment Methods Configuration</h3>
					<p className="text-gray-600">Configure payment methods, processing fees, and settlement times</p>
				</div>
				<Button color="primary" onPress={handleAddMethod}>
					Add Payment Method
				</Button>
			</div>

			<Card>
				<CardBody>
					<Table aria-label="Payment methods table">
						<TableHeader>
							<TableColumn>METHOD</TableColumn>
							<TableColumn>TYPE</TableColumn>
							<TableColumn>PROCESSING FEE</TableColumn>
							<TableColumn>SETTLEMENT TIME</TableColumn>
							<TableColumn>STATUS</TableColumn>
							<TableColumn>ACTIONS</TableColumn>
						</TableHeader>
						<TableBody>
							{paymentMethods.map((method) => (
								<TableRow key={method.id}>
									<TableCell>
										<div className="flex items-center gap-2">
											<span className="text-lg">{getTypeIcon(method.type)}</span>
											<div>
												<p className="font-medium">{method.name}</p>
												<p className="text-sm text-gray-500">{method.description}</p>
											</div>
										</div>
									</TableCell>
									<TableCell>
										<Chip size="sm" variant="flat">
											{method.type.replace('_', ' ').toUpperCase()}
										</Chip>
									</TableCell>
									<TableCell>
										<span className="font-medium">
											{method.processingFee > 0 ? `${method.processingFee}%` : 'Free'}
										</span>
									</TableCell>
									<TableCell>
										<span className="text-sm">{method.settlementTime}</span>
									</TableCell>
									<TableCell>
										<Badge color={getStatusColor(method.status)} variant="flat">
											{method.status}
										</Badge>
									</TableCell>
									<TableCell>
										<Button size="sm" variant="light" onPress={() => handleEditMethod(method)}>
											Edit
										</Button>
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
						{selectedMethod ? 'Edit Payment Method' : 'Add Payment Method'}
					</ModalHeader>
					<ModalBody>
						<div className="space-y-4">
							<Input
								label="Method Name"
								placeholder="e.g., Visa/Mastercard"
								value={formData.name}
								onChange={(e) => setFormData({ ...formData, name: e.target.value })}
							/>
							<Select
								label="Payment Type"
								placeholder="Select payment type"
								value={formData.type}
								onChange={(e) => setFormData({ ...formData, type: e.target.value })}
							>
								<SelectItem key="card" value="card">💳 Credit/Debit Card</SelectItem>
								<SelectItem key="mobile_money" value="mobile_money">📱 Mobile Money</SelectItem>
								<SelectItem key="bank_transfer" value="bank_transfer">🏦 Bank Transfer</SelectItem>
								<SelectItem key="cash" value="cash">💵 Cash</SelectItem>
								<SelectItem key="crypto" value="crypto">₿ Cryptocurrency</SelectItem>
							</Select>
							<Input
								label="Processing Fee (%)"
								placeholder="0.00"
								type="number"
								step="0.01"
								value={formData.processingFee}
								onChange={(e) => setFormData({ ...formData, processingFee: e.target.value })}
							/>
							<Input
								label="Settlement Time"
								placeholder="e.g., 2-3 business days"
								value={formData.settlementTime}
								onChange={(e) => setFormData({ ...formData, settlementTime: e.target.value })}
							/>
							<Input
								label="Description"
								placeholder="Brief description of the payment method"
								value={formData.description}
								onChange={(e) => setFormData({ ...formData, description: e.target.value })}
							/>
							<Select
								label="Status"
								value={formData.status}
								onChange={(e) => setFormData({ ...formData, status: e.target.value })}
							>
								<SelectItem key="active" value="active">Active</SelectItem>
								<SelectItem key="inactive" value="inactive">Inactive</SelectItem>
								<SelectItem key="maintenance" value="maintenance">Maintenance</SelectItem>
							</Select>
						</div>
					</ModalBody>
					<ModalFooter>
						<Button variant="light" onPress={onClose}>
							Cancel
						</Button>
						<Button color="primary" onPress={handleSaveMethod}>
							{selectedMethod ? 'Update' : 'Add'} Method
						</Button>
					</ModalFooter>
				</ModalContent>
			</Modal>
		</div>
	);
}
