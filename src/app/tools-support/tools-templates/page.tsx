'use client';

import React, { useState, useMemo } from 'react';
import PageLayout from '../../components/PageLayout';
import { Card, CardBody, Button, Input, Select, SelectItem, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, Badge, Chip, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, useDisclosure, Textarea, Tabs, Tab } from '@heroui/react';

interface OperationalTool {
	id: string;
	name: string;
	type: 'template' | 'calculator' | 'generator' | 'checklist';
	category: 'front_office' | 'housekeeping' | 'maintenance' | 'finance';
	status: 'active' | 'inactive' | 'maintenance';
	description: string;
	lastUsed?: string;
	usageCount: number;
	createdAt: string;
}

interface Template {
	id: string;
	name: string;
	type: 'email' | 'sms' | 'document' | 'form';
	category: 'reservation' | 'checkin' | 'checkout' | 'maintenance' | 'billing';
	content: string;
	variables: string[];
	status: 'active' | 'draft' | 'archived';
	createdAt: string;
}

type BadgeColor = 'success' | 'warning' | 'danger' | 'primary' | 'secondary' | 'default';

export default function ToolsTemplatesPage() {
	const { isOpen: isToolOpen, onOpen: onToolOpen, onClose: onToolClose } = useDisclosure();
	const { isOpen: isTemplateOpen, onOpen: onTemplateOpen, onClose: onTemplateClose } = useDisclosure();
	const [selectedTool, setSelectedTool] = useState<OperationalTool | null>(null);
	const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
	const [activeTab, setActiveTab] = useState<'tools' | 'templates'>('tools');
	const [searchTerm, setSearchTerm] = useState('');
	const [categoryFilter, setCategoryFilter] = useState<'all' | 'front_office' | 'housekeeping' | 'maintenance' | 'finance'>('all');

	const [toolFormData, setToolFormData] = useState({
		name: '',
		type: '',
		category: '',
		description: '',
		status: 'active'
	});

	const [templateFormData, setTemplateFormData] = useState({
		name: '',
		type: '',
		category: '',
		content: '',
		variables: '',
		status: 'draft'
	});

	const operationalTools: OperationalTool[] = [
		{
			id: '1',
			name: 'Room Rate Calculator',
			type: 'calculator',
			category: 'front_office',
			status: 'active',
			description: 'Calculate room rates based on season, occupancy, and special events',
			lastUsed: '2024-02-15',
			usageCount: 45,
			createdAt: '2024-01-01'
		},
		{
			id: '2',
			name: 'Housekeeping Checklist Generator',
			type: 'generator',
			category: 'housekeeping',
			status: 'active',
			description: 'Generate daily housekeeping checklists for different room types',
			lastUsed: '2024-02-14',
			usageCount: 32,
			createdAt: '2024-01-01'
		},
		{
			id: '3',
			name: 'Maintenance Request Form',
			type: 'template',
			category: 'maintenance',
			status: 'active',
			description: 'Standardized form for reporting maintenance issues',
			lastUsed: '2024-02-13',
			usageCount: 28,
			createdAt: '2024-01-01'
		},
		{
			id: '4',
			name: 'Revenue Forecasting Tool',
			type: 'calculator',
			category: 'finance',
			status: 'active',
			description: 'Predict revenue based on historical data and current bookings',
			lastUsed: '2024-02-12',
			usageCount: 15,
			createdAt: '2024-01-01'
		},
		{
			id: '5',
			name: 'Guest Satisfaction Survey',
			type: 'template',
			category: 'front_office',
			status: 'active',
			description: 'Standard guest satisfaction survey template',
			lastUsed: '2024-02-10',
			usageCount: 22,
			createdAt: '2024-01-01'
		}
	];

	const templates: Template[] = [
		{
			id: '1',
			name: 'Reservation Confirmation Email',
			type: 'email',
			category: 'reservation',
			content: 'Dear {{guestName}},\n\nYour reservation has been confirmed for {{checkInDate}} to {{checkOutDate}}.\n\nRoom: {{roomType}}\nRate: {{rate}}\n\nWe look forward to welcoming you!\n\nBest regards,\nHotel Team',
			variables: ['guestName', 'checkInDate', 'checkOutDate', 'roomType', 'rate'],
			status: 'active',
			createdAt: '2024-01-01'
		},
		{
			id: '2',
			name: 'Check-in Welcome SMS',
			type: 'sms',
			category: 'checkin',
			content: 'Welcome {{guestName}}! Your room {{roomNumber}} is ready. Check-in time: {{checkInTime}}. Enjoy your stay!',
			variables: ['guestName', 'roomNumber', 'checkInTime'],
			status: 'active',
			createdAt: '2024-01-01'
		},
		{
			id: '3',
			name: 'Checkout Reminder',
			type: 'email',
			category: 'checkout',
			content: 'Dear {{guestName}},\n\nWe hope you enjoyed your stay. Checkout time is {{checkoutTime}}.\n\nPlease return your room key to the front desk.\n\nThank you for choosing us!',
			variables: ['guestName', 'checkoutTime'],
			status: 'active',
			createdAt: '2024-01-01'
		},
		{
			id: '4',
			name: 'Maintenance Report',
			type: 'document',
			category: 'maintenance',
			content: 'Maintenance Report\n\nIssue: {{issueDescription}}\nLocation: {{location}}\nPriority: {{priority}}\nReported by: {{reportedBy}}\nDate: {{reportDate}}',
			variables: ['issueDescription', 'location', 'priority', 'reportedBy', 'reportDate'],
			status: 'active',
			createdAt: '2024-01-01'
		}
	];

	const handleAddTool = () => {
		setSelectedTool(null);
		setToolFormData({
			name: '',
			type: '',
			category: '',
			description: '',
			status: 'active'
		});
		onToolOpen();
	};

	const handleEditTool = (tool: OperationalTool) => {
		setSelectedTool(tool);
		setToolFormData({
			name: tool.name,
			type: tool.type,
			category: tool.category,
			description: tool.description,
			status: tool.status
		});
		onToolOpen();
	};

	const handleSaveTool = () => {
		// In a real app, this would save to the store
		console.log('Saving tool:', toolFormData);
		onToolClose();
	};

	const handleAddTemplate = () => {
		setSelectedTemplate(null);
		setTemplateFormData({
			name: '',
			type: '',
			category: '',
			content: '',
			variables: '',
			status: 'draft'
		});
		onTemplateOpen();
	};

	const handleEditTemplate = (template: Template) => {
		setSelectedTemplate(template);
		setTemplateFormData({
			name: template.name,
			type: template.type,
			category: template.category,
			content: template.content,
			variables: template.variables.join(', '),
			status: template.status
		});
		onTemplateOpen();
	};

	const handleSaveTemplate = () => {
		// In a real app, this would save to the store
		console.log('Saving template:', templateFormData);
		onTemplateClose();
	};

	const getTypeIcon = (type: string) => {
		switch (type) {
			case 'template': return '📋';
			case 'calculator': return '🧮';
			case 'generator': return '⚙️';
			case 'checklist': return '✅';
			default: return '🛠️';
		}
	};

	const getCategoryColor = (category: string): BadgeColor => {
		switch (category) {
			case 'front_office': return 'primary';
			case 'housekeeping': return 'success';
			case 'maintenance': return 'warning';
			case 'finance': return 'danger';
			default: return 'default';
		}
	};

	const getStatusColor = (status: string): BadgeColor => {
		switch (status) {
			case 'active': return 'success';
			case 'inactive': return 'default';
			case 'maintenance': return 'warning';
			case 'draft': return 'warning';
			case 'archived': return 'default';
			default: return 'default';
		}
	};

	const filteredTools = useMemo(() => {
		let list = operationalTools;
		if (searchTerm) {
			list = list.filter(t => 
				t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
				t.description.toLowerCase().includes(searchTerm.toLowerCase())
			);
		}
		if (categoryFilter !== 'all') {
			list = list.filter(t => t.category === categoryFilter);
		}
		return list;
	}, [searchTerm, categoryFilter, operationalTools]);

	const filteredTemplates = useMemo(() => {
		let list = templates;
		if (searchTerm) {
			list = list.filter(t => 
				t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
				t.content.toLowerCase().includes(searchTerm.toLowerCase())
			);
		}
		if (categoryFilter !== 'all') {
			list = list.filter(t => t.category === categoryFilter);
		}
		return list;
	}, [searchTerm, categoryFilter, templates]);

	const stats = useMemo(() => {
		const totalTools = operationalTools.length;
		const activeTools = operationalTools.filter(t => t.status === 'active').length;
		const totalTemplates = templates.length;
		const activeTemplates = templates.filter(t => t.status === 'active').length;

		return {
			totalTools,
			activeTools,
			totalTemplates,
			activeTemplates
		};
	}, [operationalTools, templates]);

	return (
		<PageLayout>
			<div className="py-8 px-6">
				<div className="max-w-7xl mx-auto">
					<div className="mb-8">
						<h1 className="text-3xl font-bold text-gray-900">🛠️ Tools & Templates</h1>
						<p className="text-gray-600">Operational tools, calculators, and communication templates</p>
					</div>

					{/* Stats Cards */}
					<div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
						<Card className="border-0 shadow-lg">
							<CardBody className="p-4">
								<div className="text-center">
									<p className="text-2xl font-bold text-blue-600">{stats.totalTools}</p>
									<p className="text-sm text-gray-600">Total Tools</p>
								</div>
							</CardBody>
						</Card>
						<Card className="border-0 shadow-lg">
							<CardBody className="p-4">
								<div className="text-center">
									<p className="text-2xl font-bold text-green-600">{stats.activeTools}</p>
									<p className="text-sm text-gray-600">Active Tools</p>
								</div>
							</CardBody>
						</Card>
						<Card className="border-0 shadow-lg">
							<CardBody className="p-4">
								<div className="text-center">
									<p className="text-2xl font-bold text-purple-600">{stats.totalTemplates}</p>
									<p className="text-sm text-gray-600">Total Templates</p>
								</div>
							</CardBody>
						</Card>
						<Card className="border-0 shadow-lg">
							<CardBody className="p-4">
								<div className="text-center">
									<p className="text-2xl font-bold text-orange-600">{stats.activeTemplates}</p>
									<p className="text-sm text-gray-600">Active Templates</p>
								</div>
							</CardBody>
						</Card>
					</div>

					{/* Tabs */}
					<Tabs selectedKey={activeTab} onSelectionChange={(k) => setActiveTab(k as 'tools' | 'templates')} className="mb-6">
						<Tab key="tools" title="🛠️ Operational Tools" />
						<Tab key="templates" title="📋 Communication Templates" />
					</Tabs>

					{/* Search and Filters */}
					<div className="flex flex-col sm:flex-row gap-4 mb-6">
						<Input 
							placeholder="Search tools and templates..." 
							value={searchTerm} 
							onChange={(e) => setSearchTerm(e.target.value)} 
							className="flex-1" 
						/>
						<Select 
							selectedKeys={[categoryFilter]} 
							onSelectionChange={(k) => setCategoryFilter((Array.from(k as Set<string>)[0] as any) || 'all')} 
							className="w-full sm:w-48"
						>
							<SelectItem key="all">All Categories</SelectItem>
							<SelectItem key="front_office">Front Office</SelectItem>
							<SelectItem key="housekeeping">Housekeeping</SelectItem>
							<SelectItem key="maintenance">Maintenance</SelectItem>
							<SelectItem key="finance">Finance</SelectItem>
						</Select>
						{activeTab === 'tools' ? (
							<Button color="primary" variant="flat" onClick={handleAddTool}>➕ Add Tool</Button>
						) : (
							<Button color="primary" variant="flat" onClick={handleAddTemplate}>➕ Add Template</Button>
						)}
					</div>

					{/* Tools Table */}
					{activeTab === 'tools' && (
						<Card>
							<CardBody>
								<Table aria-label="Operational tools table">
									<TableHeader>
										<TableColumn>Tool</TableColumn>
										<TableColumn>Type</TableColumn>
										<TableColumn>Category</TableColumn>
										<TableColumn>Usage</TableColumn>
										<TableColumn>Status</TableColumn>
										<TableColumn>Actions</TableColumn>
									</TableHeader>
									<TableBody>
										{filteredTools.map((tool) => (
											<TableRow key={tool.id}>
												<TableCell>
													<div className="flex items-center gap-3">
														<span className="text-2xl">{getTypeIcon(tool.type)}</span>
														<div>
															<p className="font-medium">{tool.name}</p>
															<p className="text-sm text-gray-500">{tool.description}</p>
														</div>
													</div>
												</TableCell>
												<TableCell>
													<Badge variant="flat" color="primary">
														{tool.type.charAt(0).toUpperCase() + tool.type.slice(1)}
													</Badge>
												</TableCell>
												<TableCell>
													<Badge color={getCategoryColor(tool.category)} variant="flat">
														{tool.category.replace('_', ' ').toUpperCase()}
													</Badge>
												</TableCell>
												<TableCell>
													<div>
														<p className="font-medium">{tool.usageCount} times</p>
														{tool.lastUsed && (
															<p className="text-sm text-gray-500">Last: {tool.lastUsed}</p>
														)}
													</div>
												</TableCell>
												<TableCell>
													<Badge color={getStatusColor(tool.status)} variant="flat">
														{tool.status}
													</Badge>
												</TableCell>
												<TableCell>
													<div className="flex gap-2">
														<Button size="sm" variant="flat" onClick={() => handleEditTool(tool)}>
															Edit
														</Button>
														<Button size="sm" color="primary" variant="flat">
															Use
														</Button>
													</div>
												</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>
							</CardBody>
						</Card>
					)}

					{/* Templates Table */}
					{activeTab === 'templates' && (
						<Card>
							<CardBody>
								<Table aria-label="Communication templates table">
									<TableHeader>
										<TableColumn>Template</TableColumn>
										<TableColumn>Type</TableColumn>
										<TableColumn>Category</TableColumn>
										<TableColumn>Variables</TableColumn>
										<TableColumn>Status</TableColumn>
										<TableColumn>Actions</TableColumn>
									</TableHeader>
									<TableBody>
										{filteredTemplates.map((template) => (
											<TableRow key={template.id}>
												<TableCell>
													<div>
														<p className="font-medium">{template.name}</p>
														<p className="text-sm text-gray-500 max-w-md truncate">{template.content}</p>
													</div>
												</TableCell>
												<TableCell>
													<Badge variant="flat" color="primary">
														{template.type.toUpperCase()}
													</Badge>
												</TableCell>
												<TableCell>
													<Badge color={getCategoryColor(template.category)} variant="flat">
														{template.category.charAt(0).toUpperCase() + template.category.slice(1)}
													</Badge>
												</TableCell>
												<TableCell>
													<div className="flex flex-wrap gap-1">
														{template.variables.map((variable, index) => (
															<Chip key={index} size="sm" variant="flat" color="secondary">
																{variable}
															</Chip>
														))}
													</div>
												</TableCell>
												<TableCell>
													<Badge color={getStatusColor(template.status)} variant="flat">
														{template.status}
													</Badge>
												</TableCell>
												<TableCell>
													<div className="flex gap-2">
														<Button size="sm" variant="flat" onClick={() => handleEditTemplate(template)}>
															Edit
														</Button>
														<Button size="sm" color="primary" variant="flat">
															Use
														</Button>
													</div>
												</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>
							</CardBody>
						</Card>
					)}
				</div>
			</div>

			{/* Add/Edit Tool Modal */}
			<Modal isOpen={isToolOpen} onClose={onToolClose} size="2xl">
				<ModalContent>
					<ModalHeader>
						{selectedTool ? 'Edit Operational Tool' : 'Add Operational Tool'}
					</ModalHeader>
					<ModalBody>
						<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
							<div>
								<label className="block text-sm font-medium text-gray-700 mb-1">Tool Name *</label>
								<Input 
									placeholder="e.g., Room Rate Calculator" 
									value={toolFormData.name} 
									onChange={(e) => setToolFormData({...toolFormData, name: e.target.value})} 
								/>
							</div>
							<div>
								<label className="block text-sm font-medium text-gray-700 mb-1">Tool Type *</label>
								<Select 
									selectedKeys={[toolFormData.type]} 
									onSelectionChange={(k) => setToolFormData({...toolFormData, type: Array.from(k as Set<string>)[0] || ''})}
								>
									<SelectItem key="template">Template</SelectItem>
									<SelectItem key="calculator">Calculator</SelectItem>
									<SelectItem key="generator">Generator</SelectItem>
									<SelectItem key="checklist">Checklist</SelectItem>
								</Select>
							</div>
							<div>
								<label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
								<Select 
									selectedKeys={[toolFormData.category]} 
									onSelectionChange={(k) => setToolFormData({...toolFormData, category: Array.from(k as Set<string>)[0] || ''})}
								>
									<SelectItem key="front_office">Front Office</SelectItem>
									<SelectItem key="housekeeping">Housekeeping</SelectItem>
									<SelectItem key="maintenance">Maintenance</SelectItem>
									<SelectItem key="finance">Finance</SelectItem>
								</Select>
							</div>
							<div>
								<label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
								<Select 
									selectedKeys={[toolFormData.status]} 
									onSelectionChange={(k) => setToolFormData({...toolFormData, status: Array.from(k as Set<string>)[0] || 'active'})}
								>
									<SelectItem key="active">Active</SelectItem>
									<SelectItem key="inactive">Inactive</SelectItem>
									<SelectItem key="maintenance">Maintenance</SelectItem>
								</Select>
							</div>
							<div className="md:col-span-2">
								<label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
								<Textarea 
									rows={3}
									placeholder="Describe what this tool does and how it helps operations" 
									value={toolFormData.description} 
									onChange={(e) => setToolFormData({...toolFormData, description: e.target.value})} 
								/>
							</div>
						</div>
					</ModalBody>
					<ModalFooter>
						<Button variant="flat" onPress={onToolClose}>Cancel</Button>
						<Button color="primary" onPress={handleSaveTool} isDisabled={!toolFormData.name || !toolFormData.type || !toolFormData.category}>
							{selectedTool ? 'Update' : 'Add'} Tool
						</Button>
					</ModalFooter>
				</ModalContent>
			</Modal>

			{/* Add/Edit Template Modal */}
			<Modal isOpen={isTemplateOpen} onClose={onTemplateClose} size="3xl">
				<ModalContent>
					<ModalHeader>
						{selectedTemplate ? 'Edit Communication Template' : 'Add Communication Template'}
					</ModalHeader>
					<ModalBody>
						<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
							<div>
								<label className="block text-sm font-medium text-gray-700 mb-1">Template Name *</label>
								<Input 
									placeholder="e.g., Reservation Confirmation Email" 
									value={templateFormData.name} 
									onChange={(e) => setTemplateFormData({...templateFormData, name: e.target.value})} 
								/>
							</div>
							<div>
								<label className="block text-sm font-medium text-gray-700 mb-1">Template Type *</label>
								<Select 
									selectedKeys={[templateFormData.type]} 
									onSelectionChange={(k) => setTemplateFormData({...templateFormData, type: Array.from(k as Set<string>)[0] || ''})}
								>
									<SelectItem key="email">Email</SelectItem>
									<SelectItem key="sms">SMS</SelectItem>
									<SelectItem key="document">Document</SelectItem>
									<SelectItem key="template">Template</SelectItem>
								</Select>
							</div>
							<div>
								<label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
								<Select 
									selectedKeys={[templateFormData.category]} 
									onSelectionChange={(k) => setTemplateFormData({...templateFormData, category: Array.from(k as Set<string>)[0] || ''})}
								>
									<SelectItem key="reservation">Reservation</SelectItem>
									<SelectItem key="checkin">Check-in</SelectItem>
									<SelectItem key="checkout">Check-out</SelectItem>
									<SelectItem key="maintenance">Maintenance</SelectItem>
									<SelectItem key="billing">Billing</SelectItem>
								</Select>
							</div>
							<div>
								<label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
								<Select 
									selectedKeys={[templateFormData.status]} 
									onSelectionChange={(k) => setTemplateFormData({...templateFormData, status: Array.from(k as Set<string>)[0] || 'draft'})}
								>
									<SelectItem key="draft">Draft</SelectItem>
									<SelectItem key="active">Active</SelectItem>
									<SelectItem key="archived">Archived</SelectItem>
								</Select>
							</div>
							<div className="md:col-span-2">
								<label className="block text-sm font-medium text-gray-700 mb-1">Variables (comma-separated)</label>
								<Input 
									placeholder="e.g., guestName, checkInDate, roomNumber" 
									value={templateFormData.variables} 
									onChange={(e) => setTemplateFormData({...templateFormData, variables: e.target.value})} 
								/>
								<p className="text-xs text-gray-500 mt-1">Use {'{variableName}'} in your content to insert dynamic values</p>
							</div>
							<div className="md:col-span-2">
								<label className="block text-sm font-medium text-gray-700 mb-1">Content *</label>
								<Textarea 
									rows={8}
									placeholder="Enter your template content here. Use {variableName} for dynamic values." 
									value={templateFormData.content} 
									onChange={(e) => setTemplateFormData({...templateFormData, content: e.target.value})} 
								/>
							</div>
						</div>
					</ModalBody>
					<ModalFooter>
						<Button variant="flat" onPress={onTemplateClose}>Cancel</Button>
						<Button color="primary" onPress={handleSaveTemplate} isDisabled={!templateFormData.name || !templateFormData.type || !templateFormData.content}>
							{selectedTemplate ? 'Update' : 'Add'} Template
						</Button>
					</ModalFooter>
				</ModalContent>
			</Modal>
		</PageLayout>
	);
}
