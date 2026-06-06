'use client';

import React, { useState, useMemo } from 'react';
import PageLayout from '../../components/PageLayout';
import { Card, CardBody, Button, Input, Select, SelectItem, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, Badge, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, useDisclosure, Tabs, Tab, Pagination } from '@heroui/react';

interface ActivityLog {
	id: string;
	userId: string;
	userName: string;
	action: string;
	module: 'reservations' | 'guests' | 'rooms' | 'housekeeping' | 'finance' | 'system';
	description: string;
	details: Record<string, unknown>;
	ipAddress: string;
	userAgent: string;
	timestamp: string;
	severity: 'low' | 'medium' | 'high' | 'critical';
	status: 'success' | 'failed' | 'pending';
}

interface AuditTrail {
	id: string;
	entityType: string;
	entityId: string;
	action: 'created' | 'updated' | 'deleted' | 'viewed';
	oldValues?: Record<string, unknown>;
	newValues?: Record<string, unknown>;
	userId: string;
	userName: string;
	timestamp: string;
	reason?: string;
}

type BadgeColor = 'success' | 'warning' | 'danger' | 'primary' | 'secondary' | 'default';

export default function ViewActivitiesPage() {
	const { isOpen, onOpen, onClose } = useDisclosure();
	const [selectedActivity, setSelectedActivity] = useState<ActivityLog | null>(null);
	const [activeTab, setActiveTab] = useState<'activities' | 'audit'>('activities');
	const [searchTerm, setSearchTerm] = useState('');
	const [moduleFilter, setModuleFilter] = useState<'all' | 'reservations' | 'guests' | 'rooms' | 'housekeeping' | 'finance' | 'system'>('all');
	const [severityFilter, setSeverityFilter] = useState<'all' | 'low' | 'medium' | 'high' | 'critical'>('all');
	const [dateRange, setDateRange] = useState({ start: '', end: '' });
	const [currentPage, setCurrentPage] = useState(1);
	const itemsPerPage = 20;

	const activityLogs: ActivityLog[] = [
		{
			id: '1',
			userId: 'user_001',
			userName: 'John Admin',
			action: 'CREATE_RESERVATION',
			module: 'reservations',
			description: 'Created new reservation for guest John Doe',
			details: { guestId: 'guest_001', roomId: 'room_101', checkIn: '2024-02-20', checkOut: '2024-02-22' },
			ipAddress: '192.168.1.100',
			userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
			timestamp: '2024-02-15T10:30:00Z',
			severity: 'low',
			status: 'success'
		},
		{
			id: '2',
			userId: 'user_002',
			userName: 'Sarah Manager',
			action: 'UPDATE_ROOM_STATUS',
			module: 'rooms',
			description: 'Updated room 205 status from available to occupied',
			details: { roomId: 'room_205', oldStatus: 'available', newStatus: 'occupied' },
			ipAddress: '192.168.1.101',
			userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
			timestamp: '2024-02-15T09:15:00Z',
			severity: 'medium',
			status: 'success'
		},
		{
			id: '3',
			userId: 'user_003',
			userName: 'Mike Staff',
			action: 'PROCESS_PAYMENT',
			module: 'finance',
			description: 'Processed payment for reservation RES001',
			details: { reservationId: 'RES001', amount: 500.00, paymentMethod: 'credit_card' },
			ipAddress: '192.168.1.102',
			userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
			timestamp: '2024-02-15T08:45:00Z',
			severity: 'high',
			status: 'success'
		},
		{
			id: '4',
			userId: 'user_001',
			userName: 'John Admin',
			action: 'DELETE_GUEST',
			module: 'guests',
			description: 'Deleted guest profile for Jane Smith',
			details: { guestId: 'guest_002', reason: 'Duplicate entry' },
			ipAddress: '192.168.1.100',
			userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
			timestamp: '2024-02-15T07:20:00Z',
			severity: 'critical',
			status: 'success'
		},
		{
			id: '5',
			userId: 'user_004',
			userName: 'Lisa Housekeeping',
			action: 'CREATE_MAINTENANCE_REQUEST',
			module: 'housekeeping',
			description: 'Created maintenance request for room 312',
			details: { roomId: 'room_312', issue: 'Air conditioning not working', priority: 'high' },
			ipAddress: '192.168.1.103',
			userAgent: 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)',
			timestamp: '2024-02-15T06:30:00Z',
			severity: 'medium',
			status: 'success'
		}
	];

	const auditTrails: AuditTrail[] = [
		{
			id: '1',
			entityType: 'Reservation',
			entityId: 'RES001',
			action: 'created',
			oldValues: undefined,
			newValues: { guestId: 'guest_001', roomId: 'room_101', checkIn: '2024-02-20', checkOut: '2024-02-22', rate: 250.00 },
			userId: 'user_001',
			userName: 'John Admin',
			timestamp: '2024-02-15T10:30:00Z',
			reason: 'New guest booking'
		},
		{
			id: '2',
			entityType: 'Room',
			entityId: 'room_205',
			action: 'updated',
			oldValues: { status: 'available', lastCleaned: '2024-02-14T16:00:00Z' },
			newValues: { status: 'occupied', lastCleaned: '2024-02-14T16:00:00Z', currentGuestId: 'guest_003' },
			userId: 'user_002',
			userName: 'Sarah Manager',
			timestamp: '2024-02-15T09:15:00Z',
			reason: 'Guest check-in'
		},
		{
			id: '3',
			entityType: 'Guest',
			entityId: 'guest_002',
			action: 'deleted',
			oldValues: { name: 'Jane Smith', email: 'jane@example.com', phone: '+233123456789' },
			newValues: undefined,
			userId: 'user_001',
			userName: 'John Admin',
			timestamp: '2024-02-15T07:20:00Z',
			reason: 'Duplicate entry removal'
		},
		{
			id: '4',
			entityType: 'Payment',
			entityId: 'PAY001',
			action: 'created',
			oldValues: undefined,
			newValues: { reservationId: 'RES001', amount: 500.00, method: 'credit_card', status: 'completed' },
			userId: 'user_003',
			userName: 'Mike Staff',
			timestamp: '2024-02-15T08:45:00Z',
			reason: 'Reservation payment'
		}
	];

	const handleViewDetails = (activity: ActivityLog) => {
		setSelectedActivity(activity);
		onOpen();
	};

	const getModuleIcon = (module: string) => {
		switch (module) {
			case 'reservations': return '📅';
			case 'guests': return '👥';
			case 'rooms': return '🏠';
			case 'housekeeping': return '🧹';
			case 'finance': return '💰';
			case 'system': return '⚙️';
			default: return '📋';
		}
	};

	const getSeverityColor = (severity: string): BadgeColor => {
		switch (severity) {
			case 'low': return 'success';
			case 'medium': return 'warning';
			case 'high': return 'danger';
			case 'critical': return 'danger';
			default: return 'default';
		}
	};

	const getStatusColor = (status: string): BadgeColor => {
		switch (status) {
			case 'success': return 'success';
			case 'failed': return 'danger';
			case 'pending': return 'warning';
			default: return 'default';
		}
	};

	const getActionColor = (action: string): BadgeColor => {
		switch (action) {
			case 'created': return 'success';
			case 'updated': return 'primary';
			case 'deleted': return 'danger';
			case 'viewed': return 'default';
			default: return 'default';
		}
	};

	const filteredActivities = useMemo(() => {
		let list = activityLogs;
		if (searchTerm) {
			list = list.filter(a => 
				a.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
				a.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
				a.description.toLowerCase().includes(searchTerm.toLowerCase())
			);
		}
		if (moduleFilter !== 'all') {
			list = list.filter(a => a.module === moduleFilter);
		}
		if (severityFilter !== 'all') {
			list = list.filter(a => a.severity === severityFilter);
		}
		if (dateRange.start && dateRange.end) {
			list = list.filter(a => {
				const timestamp = new Date(a.timestamp);
				const start = new Date(dateRange.start);
				const end = new Date(dateRange.end);
				return timestamp >= start && timestamp <= end;
			});
		}
		return list;
	}, [searchTerm, moduleFilter, severityFilter, dateRange, activityLogs]);

	const filteredAuditTrails = useMemo(() => {
		let list = auditTrails;
		if (searchTerm) {
			list = list.filter(a => 
				a.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
				a.entityType.toLowerCase().includes(searchTerm.toLowerCase()) ||
				a.action.toLowerCase().includes(searchTerm.toLowerCase())
			);
		}
		if (moduleFilter !== 'all') {
			list = list.filter(a => {
				const moduleMap: { [key: string]: string[] } = {
					reservations: ['Reservation'],
					guests: ['Guest'],
					rooms: ['Room'],
					housekeeping: ['MaintenanceRequest', 'CleaningTask'],
					finance: ['Payment', 'Invoice'],
					system: ['User', 'System']
				};
				return moduleMap[moduleFilter]?.includes(a.entityType) || false;
			});
		}
		if (dateRange.start && dateRange.end) {
			list = list.filter(a => {
				const timestamp = new Date(a.timestamp);
				const start = new Date(dateRange.start);
				const end = new Date(dateRange.end);
				return timestamp >= start && timestamp <= end;
			});
		}
		return list;
	 }, [searchTerm, moduleFilter, dateRange, auditTrails]);

	const paginatedActivities = useMemo(() => {
		const startIndex = (currentPage - 1) * itemsPerPage;
		return filteredActivities.slice(startIndex, startIndex + itemsPerPage);
	}, [filteredActivities, currentPage]);

	const paginatedAuditTrails = useMemo(() => {
		const startIndex = (currentPage - 1) * itemsPerPage;
		return filteredAuditTrails.slice(startIndex, startIndex + itemsPerPage);
	}, [filteredAuditTrails, currentPage]);

	const stats = useMemo(() => {
		const totalActivities = activityLogs.length;
		const totalAuditTrails = auditTrails.length;
		const criticalActivities = activityLogs.filter(a => a.severity === 'critical').length;
		const failedActivities = activityLogs.filter(a => a.status === 'failed').length;

		return {
			totalActivities,
			totalAuditTrails,
			criticalActivities,
			failedActivities
		};
	}, [activityLogs, auditTrails]);

	return (
		<PageLayout>
			<div className="py-8 px-6">
				<div className="max-w-7xl mx-auto">
					<div className="mb-8">
						<h1 className="text-3xl font-bold text-gray-900">📊 View Activities</h1>
						<p className="text-gray-600">Activity logs, audit trails, and system monitoring</p>
					</div>

					{/* Stats Cards */}
					<div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
						<Card className="border-0 shadow-lg">
							<CardBody className="p-4">
								<div className="text-center">
									<p className="text-2xl font-bold text-blue-600">{stats.totalActivities}</p>
									<p className="text-sm text-gray-600">Total Activities</p>
								</div>
							</CardBody>
						</Card>
						<Card className="border-0 shadow-lg">
							<CardBody className="p-4">
								<div className="text-center">
									<p className="text-2xl font-bold text-green-600">{stats.totalAuditTrails}</p>
									<p className="text-sm text-gray-600">Audit Trails</p>
								</div>
							</CardBody>
						</Card>
						<Card className="border-0 shadow-lg">
							<CardBody className="p-4">
								<div className="text-center">
									<p className="text-2xl font-bold text-red-600">{stats.criticalActivities}</p>
									<p className="text-sm text-gray-600">Critical Events</p>
								</div>
							</CardBody>
						</Card>
						<Card className="border-0 shadow-lg">
							<CardBody className="p-4">
								<div className="text-center">
									<p className="text-2xl font-bold text-orange-600">{stats.failedActivities}</p>
									<p className="text-sm text-gray-600">Failed Actions</p>
								</div>
							</CardBody>
						</Card>
					</div>

					{/* Tabs */}
					<Tabs selectedKey={activeTab} onSelectionChange={(k) => setActiveTab(k as 'activities' | 'audit')} className="mb-6">
						<Tab key="activities" title="📝 Activity Logs" />
						<Tab key="audit" title="🔍 Audit Trails" />
					</Tabs>

					{/* Search and Filters */}
					<div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
						<Input 
							placeholder="Search activities..." 
							value={searchTerm} 
							onChange={(e) => setSearchTerm(e.target.value)} 
							className="md:col-span-2" 
						/>
						<Select 
							selectedKeys={[moduleFilter]} 
							onSelectionChange={(k) => setModuleFilter((Array.from(k as Set<string>)[0] as any) || 'all')} 
						>
							<SelectItem key="all">All Modules</SelectItem>
							<SelectItem key="reservations">Reservations</SelectItem>
							<SelectItem key="guests">Guests</SelectItem>
							<SelectItem key="rooms">Rooms</SelectItem>
							<SelectItem key="housekeeping">Housekeeping</SelectItem>
							<SelectItem key="finance">Finance</SelectItem>
							<SelectItem key="system">System</SelectItem>
						</Select>
						{activeTab === 'activities' && (
							<Select 
								selectedKeys={[severityFilter]} 
								onSelectionChange={(k) => setSeverityFilter((Array.from(k as Set<string>)[0] as any) || 'all')} 
							>
								<SelectItem key="all">All Severity</SelectItem>
								<SelectItem key="low">Low</SelectItem>
								<SelectItem key="medium">Medium</SelectItem>
								<SelectItem key="high">High</SelectItem>
								<SelectItem key="critical">Critical</SelectItem>
							</Select>
						)}
						<Button color="primary" variant="flat" onClick={() => setDateRange({ start: '', end: '' })}>
							Clear Filters
						</Button>
					</div>

					{/* Date Range Filter */}
					<div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
						<div>
							<label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
							<Input 
								type="date" 
								value={dateRange.start} 
								onChange={(e) => setDateRange({...dateRange, start: e.target.value})} 
							/>
						</div>
						<div>
							<label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
							<Input 
								type="date" 
								value={dateRange.end} 
								onChange={(e) => setDateRange({...dateRange, end: e.target.value})} 
							/>
						</div>
						<div className="flex items-end">
							<Button color="secondary" variant="flat" onClick={() => {
								const today = new Date();
								const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
								setDateRange({
									start: weekAgo.toISOString().split('T')[0],
									end: today.toISOString().split('T')[0]
								});
							}}>
								Last 7 Days
							</Button>
						</div>
					</div>

					{/* Activities Table */}
					{activeTab === 'activities' && (
						<Card className="mb-6">
							<CardBody>
								<Table aria-label="Activity logs table">
									<TableHeader>
										<TableColumn>User</TableColumn>
										<TableColumn>Action</TableColumn>
										<TableColumn>Module</TableColumn>
										<TableColumn>Description</TableColumn>
										<TableColumn>Severity</TableColumn>
										<TableColumn>Status</TableColumn>
										<TableColumn>Timestamp</TableColumn>
										<TableColumn>Actions</TableColumn>
									</TableHeader>
									<TableBody>
										{paginatedActivities.map((activity) => (
											<TableRow key={activity.id}>
												<TableCell>
													<div>
														<p className="font-medium">{activity.userName}</p>
														<p className="text-sm text-gray-500">{activity.userId}</p>
													</div>
												</TableCell>
												<TableCell>
													<Badge variant="flat" color="primary">
														{activity.action.replace(/_/g, ' ')}
													</Badge>
												</TableCell>
												<TableCell>
													<div className="flex items-center gap-2">
														<span className="text-lg">{getModuleIcon(activity.module)}</span>
														<Badge variant="flat" color="secondary">
															{activity.module.charAt(0).toUpperCase() + activity.module.slice(1)}
														</Badge>
													</div>
												</TableCell>
												<TableCell>
													<div className="max-w-xs">
														<p className="text-sm">{activity.description}</p>
														<p className="text-xs text-gray-500">{activity.ipAddress}</p>
													</div>
												</TableCell>
												<TableCell>
													<Badge color={getSeverityColor(activity.severity)} variant="flat">
														{activity.severity}
													</Badge>
												</TableCell>
												<TableCell>
													<Badge color={getStatusColor(activity.status)} variant="flat">
														{activity.status}
													</Badge>
												</TableCell>
												<TableCell>
													<div className="text-sm">
														<p>{new Date(activity.timestamp).toLocaleDateString()}</p>
														<p className="text-gray-500">{new Date(activity.timestamp).toLocaleTimeString()}</p>
													</div>
												</TableCell>
												<TableCell>
													<Button size="sm" variant="flat" onClick={() => handleViewDetails(activity)}>
														View Details
													</Button>
												</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>
								{filteredActivities.length > itemsPerPage && (
									<div className="flex justify-center mt-4">
										<Pagination
											total={Math.ceil(filteredActivities.length / itemsPerPage)}
											page={currentPage}
											onChange={setCurrentPage}
										/>
									</div>
								)}
							</CardBody>
						</Card>
					)}

					{/* Audit Trails Table */}
					{activeTab === 'audit' && (
						<Card>
							<CardBody>
								<Table aria-label="Audit trails table">
									<TableHeader>
										<TableColumn>Entity</TableColumn>
										<TableColumn>Action</TableColumn>
										<TableColumn>User</TableColumn>
										<TableColumn>Changes</TableColumn>
										<TableColumn>Reason</TableColumn>
										<TableColumn>Timestamp</TableColumn>
									</TableHeader>
									<TableBody>
										{paginatedAuditTrails.map((audit) => (
											<TableRow key={audit.id}>
												<TableCell>
													<div>
														<p className="font-medium">{audit.entityType}</p>
														<p className="text-sm text-gray-500">ID: {audit.entityId}</p>
													</div>
												</TableCell>
												<TableCell>
													<Badge color={getActionColor(audit.action)} variant="flat">
														{audit.action.toUpperCase()}
													</Badge>
												</TableCell>
												<TableCell>
													<div>
														<p className="font-medium">{audit.userName}</p>
														<p className="text-sm text-gray-500">{audit.userId}</p>
													</div>
												</TableCell>
												<TableCell>
													<div className="max-w-xs">
														{audit.action === 'created' && (
															<p className="text-sm text-green-600">New {audit.entityType.toLowerCase()} created</p>
														)}
														{audit.action === 'updated' && (
															<p className="text-sm text-blue-600">Fields updated</p>
														)}
														{audit.action === 'deleted' && (
															<p className="text-sm text-red-600">{audit.entityType} removed</p>
														)}
														{audit.action === 'viewed' && (
															<p className="text-sm text-gray-600">Record accessed</p>
														)}
													</div>
												</TableCell>
												<TableCell>
													<p className="text-sm">{audit.reason || '—'}</p>
												</TableCell>
												<TableCell>
													<div className="text-sm">
														<p>{new Date(audit.timestamp).toLocaleDateString()}</p>
														<p className="text-gray-500">{new Date(audit.timestamp).toLocaleTimeString()}</p>
													</div>
												</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>
								{filteredAuditTrails.length > itemsPerPage && (
									<div className="flex justify-center mt-4">
										<Pagination
											total={Math.ceil(filteredAuditTrails.length / itemsPerPage)}
											page={currentPage}
											onChange={setCurrentPage}
										/>
									</div>
								)}
							</CardBody>
						</Card>
					)}
				</div>
			</div>

			{/* Activity Details Modal */}
			<Modal isOpen={isOpen} onClose={onClose} size="3xl">
				<ModalContent>
					<ModalHeader>Activity Details</ModalHeader>
					<ModalBody>
						{selectedActivity && (
							<div className="space-y-4">
								<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
									<div>
										<label className="block text-sm font-medium text-gray-700 mb-1">User</label>
										<p className="text-sm bg-gray-50 p-2 rounded">{selectedActivity.userName} ({selectedActivity.userId})</p>
									</div>
									<div>
										<label className="block text-sm font-medium text-gray-700 mb-1">Action</label>
										<p className="text-sm bg-gray-50 p-2 rounded">{selectedActivity.action}</p>
									</div>
									<div>
										<label className="block text-sm font-medium text-gray-700 mb-1">Module</label>
										<p className="text-sm bg-gray-50 p-2 rounded">{selectedActivity.module}</p>
									</div>
									<div>
										<label className="block text-sm font-medium text-gray-700 mb-1">Timestamp</label>
										<p className="text-sm bg-gray-50 p-2 rounded">{new Date(selectedActivity.timestamp).toLocaleString()}</p>
									</div>
									<div>
										<label className="block text-sm font-medium text-gray-700 mb-1">Severity</label>
										<Badge color={getSeverityColor(selectedActivity.severity)} variant="flat">
											{selectedActivity.severity}
										</Badge>
									</div>
									<div>
										<label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
										<Badge color={getStatusColor(selectedActivity.status)} variant="flat">
											{selectedActivity.status}
										</Badge>
									</div>
								</div>
								<div>
									<label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
									<p className="text-sm bg-gray-50 p-2 rounded">{selectedActivity.description}</p>
								</div>
								<div>
									<label className="block text-sm font-medium text-gray-700 mb-1">Details</label>
									<pre className="text-sm bg-gray-50 p-2 rounded overflow-auto">
										{JSON.stringify(selectedActivity.details, null, 2)}
									</pre>
								</div>
								<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
									<div>
										<label className="block text-sm font-medium text-gray-700 mb-1">IP Address</label>
										<p className="text-sm bg-gray-50 p-2 rounded">{selectedActivity.ipAddress}</p>
									</div>
									<div>
										<label className="block text-sm font-medium text-gray-700 mb-1">User Agent</label>
										<p className="text-sm bg-gray-50 p-2 rounded text-xs">{selectedActivity.userAgent}</p>
									</div>
								</div>
							</div>
						)}
					</ModalBody>
					<ModalFooter>
						<Button variant="flat" onPress={onClose}>Close</Button>
					</ModalFooter>
				</ModalContent>
			</Modal>
		</PageLayout>
	);
}
