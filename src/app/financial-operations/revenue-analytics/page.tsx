'use client';

import React, { useState, useEffect, useMemo } from 'react';
import PageLayout from '../../components/PageLayout';
import { Card, CardBody, Button, Input, Select, SelectItem, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, Badge, Chip } from '@heroui/react';
import { frontOfficeStore } from '../../lib/frontoffice/store';

export default function RevenueAnalyticsPage() {
	const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | '1y'>('30d');
	const [startDate, setStartDate] = useState('');
	const [endDate, setEndDate] = useState('');

	useEffect(() => {
		// Set default date range to current month
		const now = new Date();
		const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
		const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
		
		setStartDate(firstDay.toISOString().split('T')[0]);
		setEndDate(lastDay.toISOString().split('T')[0]);
	}, []);

	const stats = useMemo(() => {
		const reservations = frontOfficeStore.reservations;
		const totalRevenue = reservations.reduce((sum, r) => {
			const rateTotal = r.rateBreakdown?.reduce((rateSum, rate) => rateSum + rate.total, 0) || 0;
			return sum + rateTotal;
		}, 0);
		
		const totalBookings = reservations.length;
		const completedStays = reservations.filter(r => r.status === 'checked-out').length;
		const averageStay = totalBookings > 0 ? 
			reservations.reduce((sum, r) => {
				const checkIn = new Date(r.arrival);
				const checkOut = new Date(r.departure);
				const days = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
				return sum + days;
			}, 0) / totalBookings : 0;

		return { totalRevenue, totalBookings, completedStays, averageStay: Math.round(averageStay * 10) / 10 };
	}, [frontOfficeStore.reservations]);

	const filtered = useMemo(() => {
		const reservations = frontOfficeStore.reservations;
		return reservations.filter(r => {
			if (!startDate || !endDate) return true;
			const reservationDate = new Date(r.arrival);
			const start = new Date(startDate);
			const end = new Date(endDate);
			return reservationDate >= start && reservationDate <= end;
		});
	}, [frontOfficeStore.reservations, startDate, endDate]);

	const topRevenueSources = useMemo(() => {
		const reservations = frontOfficeStore.reservations;
		const sourceMap = new Map<string, { revenue: number; bookings: number }>();
		
		reservations.forEach(r => {
			const source = r.source || 'Direct';
			const rateTotal = r.rateBreakdown?.reduce((sum, rate) => sum + rate.total, 0) || 0;
			
			if (sourceMap.has(source)) {
				const existing = sourceMap.get(source);
				if (existing) {
					existing.revenue += rateTotal;
					existing.bookings += 1;
				}
			} else {
				sourceMap.set(source, { revenue: rateTotal, bookings: 1 });
			}
		});
		
		return Array.from(sourceMap.entries())
			.map(([source, data]) => ({ source, ...data }))
			.sort((a, b) => b.revenue - a.revenue)
			.slice(0, 5);
	}, [frontOfficeStore.reservations]);

	return (
		<PageLayout>
			<div className="py-8 px-6">
				<div className="max-w-7xl mx-auto">
					<div className="mb-8">
						<h1 className="text-3xl font-bold text-gray-900">📈 Revenue Analytics</h1>
						<p className="text-gray-600">Financial reporting and business intelligence</p>
					</div>

					{/* Filters */}
					<div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
						<div>
							<label className="block text-sm font-medium text-gray-700 mb-1">Time Range</label>
							<Select selectedKeys={[timeRange]} onSelectionChange={(k) => setTimeRange(Array.from(k as Set<string>)[0] as '7d' | '30d' | '90d' | '1y')}>
								<SelectItem key="7d">7 Days</SelectItem>
								<SelectItem key="30d">30 Days</SelectItem>
								<SelectItem key="90d">90 Days</SelectItem>
								<SelectItem key="1y">1 Year</SelectItem>
							</Select>
						</div>
						<div>
							<label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
							<Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
						</div>
						<div>
							<label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
							<Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
						</div>
						<div className="flex items-end">
							<Button color="primary" variant="flat">Generate Report</Button>
						</div>
					</div>

					{/* Stats Cards */}
					<div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
						<Card className="border-0 shadow-lg">
							<CardBody className="p-4">
								<div className="text-center">
									<p className="text-2xl font-bold text-green-600">₵{stats.totalRevenue.toLocaleString()}</p>
									<p className="text-sm text-gray-600">Total Revenue</p>
								</div>
							</CardBody>
						</Card>
						<Card className="border-0 shadow-lg">
							<CardBody className="p-4">
								<div className="text-center">
									<p className="text-2xl font-bold text-blue-600">{stats.totalBookings}</p>
									<p className="text-sm text-gray-600">Total Bookings</p>
								</div>
							</CardBody>
						</Card>
						<Card className="border-0 shadow-lg">
							<CardBody className="p-4">
								<div className="text-center">
									<p className="text-2xl font-bold text-purple-600">{stats.averageStay}</p>
									<p className="text-sm text-gray-600">Avg Stay (Days)</p>
								</div>
							</CardBody>
						</Card>
						<Card className="border-0 shadow-lg">
							<CardBody className="p-4">
								<div className="text-center">
									<p className="text-2xl font-bold text-orange-600">{stats.completedStays}</p>
									<p className="text-sm text-gray-600">Completed Stays</p>
								</div>
							</CardBody>
						</Card>
					</div>

					{/* Booking Status Breakdown */}
					<div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
						<Card>
							<CardBody>
								<h3 className="text-lg font-semibold mb-4">Booking Status Breakdown</h3>
								<div className="space-y-3">
									<div className="flex justify-between items-center">
										<span className="text-sm text-gray-600">Confirmed</span>
										<Badge color="primary" variant="flat">{stats.totalBookings}</Badge>
									</div>
									<div className="flex justify-between items-center">
										<span className="text-sm text-gray-600">Checked In</span>
										<Badge color="success" variant="flat">{stats.totalBookings}</Badge>
									</div>
									<div className="flex justify-between items-center">
										<span className="text-sm text-gray-600">Checked Out</span>
										<Badge color="warning" variant="flat">{stats.completedStays}</Badge>
									</div>
									<div className="flex justify-between items-center">
										<span className="text-sm text-gray-600">Cancelled</span>
										<Badge color="danger" variant="flat">{0}</Badge>
									</div>
								</div>
							</CardBody>
						</Card>
						<Card>
							<CardBody>
								<h3 className="text-lg font-semibold mb-4">Revenue Trends</h3>
								<div className="text-center py-8">
									<p className="text-gray-500">📊 Chart visualization coming soon</p>
									<p className="text-sm text-gray-400">Revenue over time, occupancy rates, seasonal trends</p>
								</div>
							</CardBody>
						</Card>
					</div>

					{/* Top Revenue Sources */}
					<Card>
						<CardBody>
							<h3 className="text-lg font-semibold mb-4">Top Revenue Sources</h3>
							<Table aria-label="Top revenue sources">
								<TableHeader>
									<TableColumn>Source</TableColumn>
									<TableColumn>Bookings</TableColumn>
									<TableColumn>Revenue</TableColumn>
									<TableColumn>Status</TableColumn>
								</TableHeader>
								<TableBody>
									{topRevenueSources.map((source, index) => (
										<TableRow key={`source-${index}`}>
											<TableCell>
												<div>
													<p className="font-medium">{source.source}</p>
													<p className="text-sm text-gray-500">Primary accommodation revenue</p>
												</div>
											</TableCell>
											<TableCell>{source.bookings}</TableCell>
											<TableCell>₵{source.revenue.toLocaleString()}</TableCell>
											<TableCell>
												<Chip color="success" variant="flat">Active</Chip>
											</TableCell>
										</TableRow>
									))}
									<TableRow>
										<TableCell>
											<div>
												<p className="font-medium">Additional Services</p>
												<p className="text-sm text-gray-500">Amenities and packages</p>
											</div>
										</TableCell>
										<TableCell>—</TableCell>
										<TableCell>₵0</TableCell>
										<TableCell>
											<Chip color="default" variant="flat">Coming Soon</Chip>
										</TableCell>
									</TableRow>
								</TableBody>
							</Table>
						</CardBody>
					</Card>
				</div>
			</div>
		</PageLayout>
	);
}
