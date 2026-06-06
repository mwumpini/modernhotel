'use client';

import { useMemo, useState } from 'react';
import { Card, CardBody, CardHeader, Chip, Input, Select, SelectItem, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell } from '@heroui/react';
import { useAccountingStore } from '@/app/lib/accounting/store';
import { rollupTaxLedger } from '@/app/lib/tax/ledgerRollup';

export default function BooksTaxes() {
	const journalEntries = useAccountingStore((s) => s.journalEntries);
	const [period, setPeriod] = useState('All');
	const [q, setQ] = useState('');

	const summary = useMemo(() => rollupTaxLedger(journalEntries), [journalEntries]);

	const rows = useMemo(() => {
		return summary.rows
			.filter((r) => (period === 'All' ? true : r.period === period))
			.filter((r) =>
				q ? (r.taxCode + r.period + r.taxName).toLowerCase().includes(q.toLowerCase()) : true
			);
	}, [summary.rows, period, q]);

	const totals = rows.reduce(
		(acc, r) => {
			acc.outputCollected += r.outputCollected;
			acc.inputOffset += r.inputOffset;
			acc.payrollWithheld += r.payrollWithheld;
			acc.remitted += r.remitted;
			acc.netPosition += r.netPosition;
			return acc;
		},
		{ outputCollected: 0, inputOffset: 0, payrollWithheld: 0, remitted: 0, netPosition: 0 }
	);

	const periodOptions = ['All', ...summary.periods];

	return (
		<div className="space-y-4">
			<div className="flex flex-wrap items-end gap-3">
				<Input label="Search" placeholder="Period or tax code..." value={q} onValueChange={setQ} className="w-64" />
				<Select
					label="Period"
					selectedKeys={[period]}
					onSelectionChange={(s: any) => setPeriod(Array.from(s)[0] as string)}
					className="w-48"
				>
					{periodOptions.map((p) => (
						<SelectItem key={p}>{p}</SelectItem>
					))}
				</Select>
			</div>

			<Card>
				<CardHeader>
					<div className="flex items-center gap-3">
						<h3 className="text-lg font-semibold">Tax Inflows & Outflows</h3>
						<Chip size="sm" color="success" variant="flat">Live from GL</Chip>
					</div>
				</CardHeader>
				<CardBody className="grid grid-cols-1 md:grid-cols-5 gap-4">
					<div>
						<div className="text-sm text-gray-500">Output Tax Collected</div>
						<div className="text-2xl font-semibold text-green-700">GHS {totals.outputCollected.toFixed(2)}</div>
						<div className="text-xs text-gray-400">Inflow (Cr liability)</div>
					</div>
					<div>
						<div className="text-sm text-gray-500">Input Tax Offset</div>
						<div className="text-2xl font-semibold text-blue-700">GHS {totals.inputOffset.toFixed(2)}</div>
						<div className="text-xs text-gray-400">Recoverable (Dr liability)</div>
					</div>
					<div>
						<div className="text-sm text-gray-500">Payroll Withheld</div>
						<div className="text-2xl font-semibold text-orange-700">GHS {totals.payrollWithheld.toFixed(2)}</div>
						<div className="text-xs text-gray-400">PAYE / SSNIT</div>
					</div>
					<div>
						<div className="text-sm text-gray-500">Remitted</div>
						<div className="text-2xl font-semibold text-red-700">GHS {totals.remitted.toFixed(2)}</div>
						<div className="text-xs text-gray-400">Outflow to GRA</div>
					</div>
					<div>
						<div className="text-sm text-gray-500">Net Tax Position</div>
						<div className="text-2xl font-semibold">GHS {totals.netPosition.toFixed(2)}</div>
						<div className="text-xs text-gray-400">Owed after offsets</div>
					</div>
				</CardBody>
			</Card>

			<Table aria-label="Tax ledger rows">
				<TableHeader>
					<TableColumn>Period</TableColumn>
					<TableColumn>Tax</TableColumn>
					<TableColumn>GL</TableColumn>
					<TableColumn align="end">Collected</TableColumn>
					<TableColumn align="end">Input Offset</TableColumn>
					<TableColumn align="end">Payroll</TableColumn>
					<TableColumn align="end">Remitted</TableColumn>
					<TableColumn align="end">Net</TableColumn>
				</TableHeader>
				<TableBody emptyContent="No tax journal entries posted yet">
					{rows.map((r) => (
						<TableRow key={`${r.period}-${r.glAccountCode}`}>
							<TableCell>{r.period}</TableCell>
							<TableCell>{r.taxName}</TableCell>
							<TableCell>{r.glAccountCode}</TableCell>
							<TableCell className="text-right text-green-700">GHS {r.outputCollected.toFixed(2)}</TableCell>
							<TableCell className="text-right text-blue-700">GHS {r.inputOffset.toFixed(2)}</TableCell>
							<TableCell className="text-right text-orange-700">GHS {r.payrollWithheld.toFixed(2)}</TableCell>
							<TableCell className="text-right text-red-700">GHS {r.remitted.toFixed(2)}</TableCell>
							<TableCell className="text-right font-medium">GHS {r.netPosition.toFixed(2)}</TableCell>
						</TableRow>
					))}
				</TableBody>
			</Table>
		</div>
	);
}
