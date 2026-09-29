'use client';

import { useMemo, useState } from 'react';
import {
	Card, CardBody, Chip, Input, Select, SelectItem, Table, TableHeader, TableColumn,
	TableBody, TableRow, TableCell, Button, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter,
	useDisclosure, Alert, Dropdown, DropdownTrigger, DropdownMenu, DropdownItem, Tooltip, Pagination,
} from '@heroui/react';
import { useAccountingStore } from '@/app/lib/accounting/store';
import { rollupTaxLedger } from '@/app/lib/tax/ledgerRollup';
import { TAX_LIABILITY_GL } from '@/app/lib/tax/glMap';
import { captureTaxRemittance } from '@/app/lib/tax/remittanceLedgerSync';
import { formatAccountingCurrency } from '@/app/lib/accounting/tenantAccountingConfig';
import { downloadCSV, openPrintPreview, generatePdfHtml } from '@/app/lib/accounting/helpers/exportHelpers';
import BankAccountOptionLabel from '@/app/components/shared/BankAccountOptionLabel';
import { SortLabel, deskResizableTableClassNames, rowClassNames, useResizableColumns } from '../frontoffice/columnResize';
import { useDeskPagination } from '../dashboard/deskTableUi';
import { DeskKpiStrip } from './DeskKpiStrip';

// formatAccountingCurrency always shows a magnitude, so the sign is reattached in front
// of it here (net tax position can be a credit, i.e. negative).
const fmt = (n: number) => (n < 0 ? '-' : '') + formatAccountingCurrency(n);

type TaxSortKey = 'period' | 'tax' | 'gl' | 'collected' | 'withholding' | 'inputOffset' | 'payroll' | 'remitted' | 'net';

const defaultRemitForm = {
	taxCode: '',
	period: new Date().toISOString().slice(0, 7),
	amount: '',
	date: new Date().toISOString().slice(0, 10),
	reference: '',
	bankAccountId: '',
};

export default function BooksTaxes() {
	const journalEntries = useAccountingStore((s) => s.journalEntries);
	const bankAccounts = useAccountingStore((s) => s.bankAccounts);
	const activeBankAccounts = useMemo(() => bankAccounts.filter((b) => b.isActive), [bankAccounts]);

	const [period, setPeriod] = useState('All');
	const [q, setQ] = useState('');
	const [notice, setNotice] = useState<string | null>(null);
	const [remitForm, setRemitForm] = useState(defaultRemitForm);
	const [remitErrors, setRemitErrors] = useState<Record<string, string>>({});
	const [remitFormError, setRemitFormError] = useState<string | null>(null);
	const { isOpen, onOpen, onClose } = useDisclosure();
	const [sortKey, setSortKey] = useState<TaxSortKey>('period');
	const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
	const cols = useResizableColumns<TaxSortKey>({
		period: 88, tax: 148, gl: 80, collected: 100, withholding: 108, inputOffset: 108, payroll: 96, remitted: 100, net: 100,
	});
	const [viewRow, setViewRow] = useState<any>(null);
	const isViewOpen = viewRow != null;
	const summary = useMemo(() => rollupTaxLedger(journalEntries), [journalEntries]);

	const rows = useMemo(() => {
		const filtered = summary.rows
			.filter((r) => (period === 'All' ? true : r.period === period))
			.filter((r) =>
				q ? (r.taxCode + r.period + r.taxName).toLowerCase().includes(q.toLowerCase()) : true
			);
		const value = (r: (typeof filtered)[0]): string | number => {
			switch (sortKey) {
				case 'period': return r.period;
				case 'tax': return r.taxName.toLowerCase();
				case 'gl': return r.glAccountCode;
				case 'collected': return r.outputCollected;
				case 'withholding': return r.withholding;
				case 'inputOffset': return r.inputOffset;
				case 'payroll': return r.payrollWithheld;
				case 'remitted': return r.remitted;
				case 'net': return r.netPosition;
				default: return '';
			}
		};
		const sorted = [...filtered].sort((a, b) => {
			const av = value(a);
			const bv = value(b);
			if (typeof av === 'number' && typeof bv === 'number') return av - bv;
			return String(av).localeCompare(String(bv));
		});
		return sortDir === 'asc' ? sorted : sorted.reverse();
	}, [summary.rows, period, q, sortKey, sortDir]);

	const { page, setPage, pages, paged } = useDeskPagination(rows, [period, q, sortKey, sortDir]);

	const onSort = (key: TaxSortKey) => {
		if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
		else {
			setSortKey(key);
			setSortDir(key === 'period' || key === 'net' || key === 'collected' || key === 'remitted' ? 'desc' : 'asc');
		}
	};

	const column = (key: TaxSortKey, label: string, align: 'left' | 'right' | 'center' = 'left') => (
		<TableColumn key={key} className="relative" style={cols.style(key)}>
			<SortLabel active={sortKey === key} dir={sortDir} align={align} onPress={() => onSort(key)}>{label}</SortLabel>
			{cols.sizer(key, label)}
		</TableColumn>
	);

	const totals = rows.reduce(
		(acc, r) => {
			acc.outputCollected += r.outputCollected;
			acc.withholding += r.withholding;
			acc.inputOffset += r.inputOffset;
			acc.payrollWithheld += r.payrollWithheld;
			acc.remitted += r.remitted;
			acc.remittedUnconfirmed += r.remittedUnconfirmed;
			acc.netPosition += r.netPosition;
			return acc;
		},
		{ outputCollected: 0, withholding: 0, inputOffset: 0, payrollWithheld: 0, remitted: 0, remittedUnconfirmed: 0, netPosition: 0 }
	);

	const periodOptions = ['All', ...summary.periods];

	const openRemit = (prefill?: { taxCode: string; period: string; amount: number }) => {
		setRemitForm({
			...defaultRemitForm,
			taxCode: prefill?.taxCode || '',
			period: prefill?.period || defaultRemitForm.period,
			amount: prefill && prefill.amount > 0 ? String(prefill.amount) : '',
			bankAccountId: activeBankAccounts[0]?.id || '',
		});
		setRemitErrors({});
		setRemitFormError(null);
		onOpen();
	};

	const validateRemitForm = (f: typeof remitForm) => {
		const errs: Record<string, string> = {};
		if (!f.taxCode) errs.taxCode = 'Tax is required';
		if (!/^\d{4}-\d{2}$/.test(f.period)) errs.period = 'Period must be YYYY-MM';
		if (!f.amount || Number(f.amount) <= 0) errs.amount = 'Amount must be greater than 0';
		if (!f.date) errs.date = 'Date is required';
		if (!f.bankAccountId) errs.bankAccountId = 'Paying account is required';
		setRemitErrors(errs);
		return Object.keys(errs).length === 0;
	};

	const handleRemit = () => {
		setRemitFormError(null);
		if (!validateRemitForm(remitForm)) return;
		const meta = TAX_LIABILITY_GL[remitForm.taxCode];
		const result = captureTaxRemittance({
			taxGlCode: meta.code,
			taxName: meta.name,
			period: remitForm.period,
			amount: Number(remitForm.amount),
			date: remitForm.date,
			reference: remitForm.reference || undefined,
			bankAccountId: remitForm.bankAccountId,
		});
		if (result) {
			setNotice(`Remittance recorded — JE ${result.journalEntryId}`);
			onClose();
		} else {
			setRemitFormError('Could not post remittance — check the paying account is still active.');
		}
	};

	const exportCSV = () => {
		downloadCSV(
			rows.map((r) => ({
				period: r.period,
				tax: r.taxName,
				gl: r.glAccountCode,
				collected: r.outputCollected.toFixed(2),
				withholding: r.withholding.toFixed(2),
				inputOffset: r.inputOffset.toFixed(2),
				payroll: r.payrollWithheld.toFixed(2),
				remitted: r.remitted.toFixed(2),
				net: r.netPosition.toFixed(2),
			})),
			'tax_ledger',
			[
				{ key: 'period', label: 'Period' },
				{ key: 'tax', label: 'Tax' },
				{ key: 'gl', label: 'GL' },
				{ key: 'collected', label: 'Collected' },
				{ key: 'withholding', label: 'Withholding' },
				{ key: 'inputOffset', label: 'Input Offset' },
				{ key: 'payroll', label: 'Payroll' },
				{ key: 'remitted', label: 'Remitted' },
				{ key: 'net', label: 'Net' },
			]
		);
	};

	const printPDF = () => {
		const tableRows = rows.map((r) => `<tr>
			<td>${r.period}</td>
			<td>${r.taxName}</td>
			<td>${r.glAccountCode}</td>
			<td class="amount">${fmt(r.outputCollected)}</td>
			<td class="amount">${fmt(r.withholding)}</td>
			<td class="amount">${fmt(r.inputOffset)}</td>
			<td class="amount">${fmt(r.payrollWithheld)}</td>
			<td class="amount">${fmt(r.remitted)}</td>
			<td class="amount">${fmt(r.netPosition)}</td>
		</tr>`).join('');
		const html = generatePdfHtml('Tax Ledger', `
			<div class="header">
				<h1>🧮 Tax Inflows &amp; Outflows</h1>
				<div class="subtitle">Generated on ${new Date().toLocaleString()}</div>
			</div>
			<div class="meta">
				<div class="meta-item"><div class="meta-label">Output Collected</div><div class="meta-value">${fmt(totals.outputCollected)}</div></div>
				<div class="meta-item"><div class="meta-label">Withholding</div><div class="meta-value">${fmt(totals.withholding)}</div></div>
				<div class="meta-item"><div class="meta-label">Input Offset</div><div class="meta-value">${fmt(totals.inputOffset)}</div></div>
				<div class="meta-item"><div class="meta-label">Payroll Withheld</div><div class="meta-value">${fmt(totals.payrollWithheld)}</div></div>
				<div class="meta-item"><div class="meta-label">Remitted</div><div class="meta-value">${fmt(totals.remitted)}</div></div>
				<div class="meta-item"><div class="meta-label">Net Tax Position</div><div class="meta-value">${fmt(totals.netPosition)}</div></div>
			</div>
			<table>
				<thead><tr><th>Period</th><th>Tax</th><th>GL</th><th>Collected</th><th>Withholding</th><th>Input Offset</th><th>Payroll</th><th>Remitted</th><th>Net</th></tr></thead>
				<tbody>${tableRows}</tbody>
			</table>
		`, 'Tax Ledger');
		openPrintPreview(html);
	};

	return (
		<div className="space-y-3 px-3 pt-2 pb-3 md:px-4 md:pt-3 md:pb-4">
			{notice && (
				<Alert color="success" className="mb-1" onClose={() => setNotice(null)}>
					{notice}
				</Alert>
			)}

			<div className="flex flex-wrap items-end justify-between gap-2">
				<div className="flex flex-wrap items-end gap-2">
					<Input label="Search" placeholder="Period or tax code..." value={q} onValueChange={setQ} className="w-64" size="sm" />
					<Select
						label="Period"
						selectedKeys={[period]}
						onSelectionChange={(s: any) => setPeriod(Array.from(s)[0] as string)}
						className="w-48"
						size="sm"
					>
						{periodOptions.map((p) => (
							<SelectItem key={p}>{p}</SelectItem>
						))}
					</Select>
				</div>
				<div className="flex gap-2">
					<Dropdown>
						<DropdownTrigger>
							<Button size="sm" variant="bordered">📥 Export</Button>
						</DropdownTrigger>
						<DropdownMenu>
							<DropdownItem key="csv" onPress={exportCSV}>CSV spreadsheet</DropdownItem>
							<DropdownItem key="pdf" onPress={printPDF}>📑 Print PDF</DropdownItem>
						</DropdownMenu>
					</Dropdown>
					<Button size="sm" color="primary" onPress={() => openRemit()}>
						Record remittance
					</Button>
				</div>
			</div>

			<DeskKpiStrip
				className="mb-0"
				items={[
					{ id: 'tax.output', label: 'Output Tax Collected', value: fmt(totals.outputCollected), tone: 'text-green-700' },
					{ id: 'tax.withholding', label: 'Withholding', value: fmt(totals.withholding), tone: 'text-purple-700' },
					{ id: 'tax.input', label: 'Input Tax Offset', value: fmt(totals.inputOffset), tone: 'text-blue-700' },
					{ id: 'tax.payroll', label: 'Payroll Withheld', value: fmt(totals.payrollWithheld), tone: 'text-orange-700' },
					{ id: 'tax.remitted', label: 'Remitted', value: fmt(totals.remitted), tone: 'text-red-700' },
					{ id: 'tax.net', label: 'Net Tax Position', value: fmt(totals.netPosition), tone: 'text-gray-900' },
				]}
			/>

			<div ref={cols.frameRef} style={cols.frameStyle}>
			<Table aria-label="Tax ledger rows" removeWrapper classNames={deskResizableTableClassNames()}>
				<TableHeader>
					{column('period', 'Period')}
					{column('tax', 'Tax')}
					{column('gl', 'GL')}
					{column('collected', 'Collected', 'right')}
					{column('withholding', 'Withholding', 'right')}
					{column('inputOffset', 'Input Offset', 'right')}
					{column('payroll', 'Payroll', 'right')}
					{column('remitted', 'Remitted', 'right')}
					{column('net', 'Net', 'right')}
				</TableHeader>
				<TableBody emptyContent="No tax journal entries posted yet">
					{paged.map((r) => (
						<TableRow
							key={`${r.period}-${r.glAccountCode}`}
							className={rowClassNames(viewRow?.period === r.period && viewRow?.glAccountCode === r.glAccountCode)}
							onClick={() => setViewRow(r)}
						>
							<TableCell className="text-blue-600 hover:underline">{r.period}</TableCell>
							<TableCell><span className="block truncate" title={r.taxName}>{r.taxName}</span></TableCell>
							<TableCell>{r.glAccountCode}</TableCell>
							<TableCell className="text-right tabular-nums text-green-700">{fmt(r.outputCollected)}</TableCell>
							<TableCell className="text-right tabular-nums text-purple-700">{fmt(r.withholding)}</TableCell>
							<TableCell className="text-right tabular-nums text-blue-700">{fmt(r.inputOffset)}</TableCell>
							<TableCell className="text-right tabular-nums text-orange-700">{fmt(r.payrollWithheld)}</TableCell>
							<TableCell className="text-right tabular-nums text-red-700">
								<span className="inline-flex items-center gap-1">
									{fmt(r.remitted)}
									{r.remittedUnconfirmed > 0.004 && (
										<Tooltip content={`${fmt(r.remittedUnconfirmed)} not posted via "Record remittance" — verify.`}>
											<span className="text-amber-500 cursor-help text-xs">⚠</span>
										</Tooltip>
									)}
								</span>
							</TableCell>
							<TableCell className="text-right font-medium tabular-nums">{fmt(r.netPosition)}</TableCell>
						</TableRow>
					))}
				</TableBody>
			</Table>
			</div>
			<div className="mt-3 flex justify-end">
				<Pagination page={page} total={pages} onChange={setPage} showControls size="sm" />
			</div>

			<Modal isOpen={isOpen} onClose={onClose}>
				<ModalContent>
					<ModalHeader>Record remittance</ModalHeader>
					<ModalBody className="gap-3">
						{remitFormError && <Alert color="warning" className="mb-1">{remitFormError}</Alert>}
						<div>
							<Select
								label="Tax"
								isRequired
								isInvalid={!!remitErrors.taxCode}
								selectedKeys={remitForm.taxCode ? [remitForm.taxCode] : []}
								onSelectionChange={(k) => setRemitForm({ ...remitForm, taxCode: Array.from(k)[0] as string })}
							>
								{Object.entries(TAX_LIABILITY_GL).map(([code, meta]) => (
									<SelectItem key={code} textValue={meta.name}>
										{meta.name} ({meta.code})
									</SelectItem>
								))}
							</Select>
							{remitErrors.taxCode && <div className="text-xs text-danger mt-1">{remitErrors.taxCode}</div>}
						</div>
						<div>
							<Input
								label="Period"
								placeholder="YYYY-MM"
								isRequired
								isInvalid={!!remitErrors.period}
								value={remitForm.period}
								onValueChange={(v) => setRemitForm({ ...remitForm, period: v })}
							/>
							{remitErrors.period && <div className="text-xs text-danger mt-1">{remitErrors.period}</div>}
						</div>
						<div>
							<Input
								type="number"
								min="0"
								step="0.01"
								label="Amount (GHS)"
								isRequired
								isInvalid={!!remitErrors.amount}
								value={remitForm.amount}
								onValueChange={(v) => setRemitForm({ ...remitForm, amount: v })}
								startContent={<span className="text-gray-400 text-sm">₵</span>}
							/>
							{remitErrors.amount && <div className="text-xs text-danger mt-1">{remitErrors.amount}</div>}
						</div>
						<div>
							<Input
								type="date"
								label="Payment date"
								isRequired
								isInvalid={!!remitErrors.date}
								value={remitForm.date}
								onValueChange={(v) => setRemitForm({ ...remitForm, date: v })}
							/>
							{remitErrors.date && <div className="text-xs text-danger mt-1">{remitErrors.date}</div>}
						</div>
						<Input
							label="Reference"
							placeholder="GRA receipt / voucher number"
							value={remitForm.reference}
							onValueChange={(v) => setRemitForm({ ...remitForm, reference: v })}
						/>
						<div>
							{activeBankAccounts.length ? (
								<Select
									label="Paid from"
									isRequired
									isInvalid={!!remitErrors.bankAccountId}
									selectedKeys={remitForm.bankAccountId ? [remitForm.bankAccountId] : []}
									onSelectionChange={(k) => setRemitForm({ ...remitForm, bankAccountId: Array.from(k)[0] as string })}
								>
									{activeBankAccounts.map((b) => (
										<SelectItem key={b.id} textValue={b.accountName}>
											<BankAccountOptionLabel account={b} />
										</SelectItem>
									))}
								</Select>
							) : (
								<div className="text-xs text-gray-500">No bank/cash accounts yet — add one under Bank & Cash first.</div>
							)}
							{remitErrors.bankAccountId && <div className="text-xs text-danger mt-1">{remitErrors.bankAccountId}</div>}
						</div>
					</ModalBody>
					<ModalFooter>
						<Button variant="bordered" onPress={onClose}>Cancel</Button>
						<Button color="primary" onPress={handleRemit}>Record</Button>
					</ModalFooter>
				</ModalContent>
			</Modal>

			<Modal isOpen={isViewOpen} onOpenChange={(open) => { if (!open) setViewRow(null); }} size="2xl">
				<ModalContent>
					{(onClose) => {
						if (!viewRow) return null;
						const r = viewRow;
						return (
							<>
								<ModalHeader className="border-b bg-white px-6 py-4">
									<div className="flex justify-between items-start w-full pr-6">
										<div>
											<h3 className="text-xl font-bold text-gray-900">TAX POSITION</h3>
											<p className="text-lg text-gray-800">{r.taxName}</p>
											<p className="text-sm text-gray-500">{r.period} · GL {r.glAccountCode}</p>
										</div>
										<div className="text-right">
											<p className="text-2xl font-bold tabular-nums">{fmt(r.netPosition)}</p>
											<p className="text-xs text-gray-500">Net position</p>
										</div>
									</div>
								</ModalHeader>
								<ModalBody className="p-6 bg-white text-sm">
									<div className="grid grid-cols-2 gap-4">
										<div className="flex justify-between"><span className="text-gray-500">Collected</span><span className="tabular-nums text-green-700">{fmt(r.outputCollected)}</span></div>
										<div className="flex justify-between"><span className="text-gray-500">Withholding</span><span className="tabular-nums text-purple-700">{fmt(r.withholding)}</span></div>
										<div className="flex justify-between"><span className="text-gray-500">Input offset</span><span className="tabular-nums text-blue-700">{fmt(r.inputOffset)}</span></div>
										<div className="flex justify-between"><span className="text-gray-500">Payroll</span><span className="tabular-nums text-orange-700">{fmt(r.payrollWithheld)}</span></div>
										<div className="flex justify-between"><span className="text-gray-500">Remitted</span><span className="tabular-nums text-red-700">{fmt(r.remitted)}</span></div>
										<div className="flex justify-between font-semibold"><span>Net</span><span className="tabular-nums">{fmt(r.netPosition)}</span></div>
									</div>
								</ModalBody>
								<ModalFooter className="border-t bg-white">
									<Button variant="flat" onPress={onClose}>Close</Button>
									{r.netPosition > 0.004 && (
										<Button color="primary" onPress={() => {
											setViewRow(null);
											openRemit({ taxCode: r.taxCode, period: r.period, amount: r.netPosition });
										}}>💳 Record remittance</Button>
									)}
								</ModalFooter>
							</>
						);
					}}
				</ModalContent>
			</Modal>
		</div>
	);
}
