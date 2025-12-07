'use client';

import { useMemo, useState } from 'react';
import { Button, Input, Select, SelectItem, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, Chip, Modal, ModalBody, ModalContent, ModalHeader, ModalFooter, Textarea } from '@heroui/react';

type Bill = {
	id: string;
	number: string;
	date: string;
	vendor: string;
	dueDate: string;
	status: 'Draft' | 'Open' | 'Overdue' | 'Paid' | 'Cancelled';
	currency: string;
	total: number;
	balance: number;
};

const demoBills: Bill[] = [
	{ id: 'BILL-101', number: 'BILL-101', date: '2025-01-10', vendor: 'Ghana Foods Ltd', dueDate: '2025-01-25', status: 'Overdue', currency: 'GHS', total: 12500, balance: 5200 },
	{ id: 'BILL-102', number: 'BILL-102', date: '2025-02-03', vendor: 'CleanPro Supplies', dueDate: '2025-02-17', status: 'Open', currency: 'GHS', total: 3150, balance: 3150 },
	{ id: 'BILL-103', number: 'BILL-103', date: '2025-02-15', vendor: 'PowerFix Maintenance', dueDate: '2025-03-01', status: 'Paid', currency: 'GHS', total: 980, balance: 0 },
];

export default function BooksBills() {
	const [query, setQuery] = useState('');
	const [status, setStatus] = useState<'All' | Bill['status']>('All');
	const [isNewOpen, setIsNewOpen] = useState(false);

	const rows = useMemo(() => {
		return demoBills
			.filter(r => (status === 'All' ? true : r.status === status))
			.filter(r => (query ? (r.number + r.vendor).toLowerCase().includes(query.toLowerCase()) : true));
	}, [query, status]);

	return (
		<div className="space-y-4">
			<div className="flex flex-wrap items-end gap-3">
				<Input label="Search" placeholder="Bill no. or vendor..." value={query} onValueChange={setQuery} className="w-64" />
				<Select label="Status" selectedKeys={[status]} onSelectionChange={(s: any) => setStatus(Array.from(s)[0] as any)} className="w-48">
					<SelectItem key="All">All</SelectItem>
					<SelectItem key="Draft">Draft</SelectItem>
					<SelectItem key="Open">Open</SelectItem>
					<SelectItem key="Overdue">Overdue</SelectItem>
					<SelectItem key="Paid">Paid</SelectItem>
					<SelectItem key="Cancelled">Cancelled</SelectItem>
				</Select>
				<div className="flex-1" />
				<Button color="primary" onPress={() => setIsNewOpen(true)}>New Bill</Button>
			</div>

			<Table aria-label="Bills">
				<TableHeader>
					<TableColumn>Bill</TableColumn>
					<TableColumn>Date</TableColumn>
					<TableColumn>Vendor</TableColumn>
					<TableColumn>Due</TableColumn>
					<TableColumn>Status</TableColumn>
					<TableColumn align="end">Total</TableColumn>
					<TableColumn align="end">Balance</TableColumn>
				</TableHeader>
				<TableBody emptyContent="No bills">
					{rows.map(r => (
						<TableRow key={r.id}>
							<TableCell className="font-medium">{r.number}</TableCell>
							<TableCell>{r.date}</TableCell>
							<TableCell>{r.vendor}</TableCell>
							<TableCell>{r.dueDate}</TableCell>
							<TableCell>
								<Chip size="sm" color={r.status === 'Overdue' ? 'danger' : r.status === 'Paid' ? 'success' : r.status === 'Open' ? 'primary' : 'default'} variant="flat">
									{r.status}
								</Chip>
							</TableCell>
							<TableCell className="text-right">{r.currency} {r.total.toFixed(2)}</TableCell>
							<TableCell className="text-right">{r.currency} {r.balance.toFixed(2)}</TableCell>
						</TableRow>
					))}
				</TableBody>
			</Table>

			<Modal isOpen={isNewOpen} onOpenChange={setIsNewOpen}>
				<ModalContent>
					{(onClose) => (
						<>
							<ModalHeader>New Bill (UI only)</ModalHeader>
							<ModalBody>
								<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
									<Input label="Vendor" placeholder="Select or type..." />
									<Input label="Bill Date" type="date" />
									<Input label="Due Date" type="date" />
									<Input label="Currency" placeholder="GHS" />
								</div>
								<Textarea label="Notes" placeholder="Optional note..." />
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


