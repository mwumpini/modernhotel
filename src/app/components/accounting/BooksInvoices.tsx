'use client';

import { useMemo, useState } from 'react';
import { Button, Input, Select, SelectItem, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, Chip, Modal, ModalBody, ModalContent, ModalHeader, ModalFooter, Textarea } from '@heroui/react';

type Invoice = {
	id: string;
	number: string;
	date: string;
	customer: string;
	dueDate: string;
	status: 'Draft' | 'Sent' | 'Overdue' | 'Paid' | 'Cancelled';
	currency: string;
	amount: number;
	balance: number;
};

const demoInvoices: Invoice[] = [
	{ id: 'INV-001', number: 'INV-001', date: '2025-01-05', customer: 'Akwaaba Estates', dueDate: '2025-01-20', status: 'Overdue', currency: 'GHS', amount: 3600, balance: 1800 },
	{ id: 'INV-002', number: 'INV-002', date: '2025-02-01', customer: 'Comfort Guest', dueDate: '2025-02-05', status: 'Sent', currency: 'GHS', amount: 820, balance: 820 },
	{ id: 'INV-003', number: 'INV-003', date: '2025-02-12', customer: 'Safari Logistics', dueDate: '2025-02-28', status: 'Paid', currency: 'USD', amount: 460, balance: 0 },
];

export default function BooksInvoices() {
	const [query, setQuery] = useState('');
	const [status, setStatus] = useState<'All' | Invoice['status']>('All');
	const [isNewOpen, setIsNewOpen] = useState(false);

	const rows = useMemo(() => {
		return demoInvoices
			.filter(r => (status === 'All' ? true : r.status === status))
			.filter(r => (query ? (r.number + r.customer).toLowerCase().includes(query.toLowerCase()) : true));
	}, [query, status]);

	return (
		<div className="space-y-4">
			<div className="flex flex-wrap items-end gap-3">
				<Input label="Search" placeholder="Invoice no. or customer..." value={query} onValueChange={setQuery} className="w-64" />
				<Select label="Status" selectedKeys={[status]} onSelectionChange={(s: any) => setStatus(Array.from(s)[0] as any)} className="w-48">
					<SelectItem key="All">All</SelectItem>
					<SelectItem key="Draft">Draft</SelectItem>
					<SelectItem key="Sent">Sent</SelectItem>
					<SelectItem key="Overdue">Overdue</SelectItem>
					<SelectItem key="Paid">Paid</SelectItem>
					<SelectItem key="Cancelled">Cancelled</SelectItem>
				</Select>
				<div className="flex-1" />
				<Button color="primary" onPress={() => setIsNewOpen(true)}>New Invoice</Button>
			</div>

			<Table aria-label="Invoices">
				<TableHeader>
					<TableColumn>Invoice</TableColumn>
					<TableColumn>Date</TableColumn>
					<TableColumn>Customer</TableColumn>
					<TableColumn>Due</TableColumn>
					<TableColumn>Status</TableColumn>
					<TableColumn align="end">Amount</TableColumn>
					<TableColumn align="end">Balance</TableColumn>
				</TableHeader>
				<TableBody emptyContent="No invoices">
					{rows.map(r => (
						<TableRow key={r.id}>
							<TableCell className="font-medium">{r.number}</TableCell>
							<TableCell>{r.date}</TableCell>
							<TableCell>{r.customer}</TableCell>
							<TableCell>{r.dueDate}</TableCell>
							<TableCell>
								<Chip size="sm" color={r.status === 'Overdue' ? 'danger' : r.status === 'Paid' ? 'success' : r.status === 'Sent' ? 'primary' : 'default'} variant="flat">
									{r.status}
								</Chip>
							</TableCell>
							<TableCell className="text-right">{r.currency} {r.amount.toFixed(2)}</TableCell>
							<TableCell className="text-right">{r.currency} {r.balance.toFixed(2)}</TableCell>
						</TableRow>
					))}
				</TableBody>
			</Table>

			<Modal isOpen={isNewOpen} onOpenChange={setIsNewOpen}>
				<ModalContent>
					{(onClose) => (
						<>
							<ModalHeader>New Invoice (UI only)</ModalHeader>
							<ModalBody>
								<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
									<Input label="Customer" placeholder="Select or type..." />
									<Input label="Invoice Date" type="date" />
									<Input label="Due Date" type="date" />
									<Input label="Currency" placeholder="GHS" />
								</div>
								<Textarea label="Notes" placeholder="Optional note to customer..." />
							</ModalBody>
							<ModalFooter>
								<Button variant="light" onPress={onClose}>Cancel</Button>
								<Button color="primary" onPress={onClose}>Save Draft</Button>
							</ModalFooter>
						</>
					)}
				</ModalContent>
			</Modal>
		</div>
	);
}


