'use client';

import { useMemo, useState } from 'react';
import { Card, CardBody, CardHeader, Chip, Input, Select, SelectItem, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell } from '@heroui/react';

type TaxRow = {
	id: string;
	period: string; // 2025-01
	code: string;   // VAT, NHIL, WHT
	basis: number;
	tax: number;
	status: 'Open' | 'Filed' | 'Paid';
};

const demoTaxes: TaxRow[] = [
	{ id: 'T-1', period: '2025-01', code: 'VAT', basis: 48200, tax: 6025, status: 'Filed' },
	{ id: 'T-2', period: '2025-01', code: 'NHIL', basis: 48200, tax: 1205, status: 'Filed' },
	{ id: 'T-3', period: '2025-02', code: 'VAT', basis: 27100, tax: 3387.5, status: 'Open' },
	{ id: 'T-4', period: '2025-02', code: 'NHIL', basis: 27100, tax: 542, status: 'Open' },
];

export default function BooksTaxes() {
	const [period, setPeriod] = useState('All');
	const [q, setQ] = useState('');

	const rows = useMemo(() => {
		return demoTaxes
			.filter(r => (period === 'All' ? true : r.period === period))
			.filter(r => (q ? (r.code + r.period).toLowerCase().includes(q.toLowerCase()) : true));
	}, [period, q]);

	const totals = rows.reduce((acc, r) => {
		acc.basis += r.basis;
		acc.tax += r.tax;
		return acc;
	}, { basis: 0, tax: 0 });

	return (
		<div className="space-y-4">
			<div className="flex flex-wrap items-end gap-3">
				<Input label="Search" placeholder="Period or tax code..." value={q} onValueChange={setQ} className="w-64" />
				<Select label="Period" selectedKeys={[period]} onSelectionChange={(s: any) => setPeriod(Array.from(s)[0] as any)} className="w-48">
					<SelectItem key="All">All</SelectItem>
					<SelectItem key="2025-01">2025-01</SelectItem>
					<SelectItem key="2025-02">2025-02</SelectItem>
				</Select>
			</div>

			<Card>
				<CardHeader>
					<div className="flex items-center gap-3">
						<h3 className="text-lg font-semibold">Tax Summary</h3>
						<Chip size="sm" color="primary" variant="flat">UI only</Chip>
					</div>
				</CardHeader>
				<CardBody className="grid grid-cols-1 md:grid-cols-3 gap-4">
					<div>
						<div className="text-sm text-gray-500">Taxable Sales</div>
						<div className="text-2xl font-semibold">GHS {totals.basis.toFixed(2)}</div>
					</div>
					<div>
						<div className="text-sm text-gray-500">Tax Owed</div>
						<div className="text-2xl font-semibold">GHS {totals.tax.toFixed(2)}</div>
					</div>
					<div>
						<div className="text-sm text-gray-500">Status</div>
						<div className="text-2xl font-semibold">{rows.every(r => r.status !== 'Open') ? 'Filed' : 'Open'}</div>
					</div>
				</CardBody>
			</Card>

			<Table aria-label="Tax rows">
				<TableHeader>
					<TableColumn>Period</TableColumn>
					<TableColumn>Code</TableColumn>
					<TableColumn align="end">Basis</TableColumn>
					<TableColumn align="end">Tax</TableColumn>
					<TableColumn>Status</TableColumn>
				</TableHeader>
				<TableBody emptyContent="No rows">
					{rows.map(r => (
						<TableRow key={r.id}>
							<TableCell>{r.period}</TableCell>
							<TableCell>{r.code}</TableCell>
							<TableCell className="text-right">GHS {r.basis.toFixed(2)}</TableCell>
							<TableCell className="text-right">GHS {r.tax.toFixed(2)}</TableCell>
							<TableCell><Chip size="sm" color={r.status === 'Open' ? 'warning' : 'success'} variant="flat">{r.status}</Chip></TableCell>
						</TableRow>
					))}
				</TableBody>
			</Table>
		</div>
	);
}


