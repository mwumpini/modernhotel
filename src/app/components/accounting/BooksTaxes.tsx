'use client';

import { useMemo, useState } from 'react';
import {
	Chip, Input, Select, SelectItem, Table, TableHeader, TableColumn,
	TableBody, TableRow, TableCell, Button, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter,
	useDisclosure, Alert, Dropdown, DropdownTrigger, DropdownMenu, DropdownItem, Pagination,
} from '@heroui/react';
import { useAccountingStore } from '@/app/lib/accounting/store';
import { rollupTaxLedger, type TaxPeriodRow } from '@/app/lib/tax/ledgerRollup';
import { TAX_LIABILITY_GL } from '@/app/lib/tax/glMap';
import {
	captureTaxRemittance,
	listTaxRemittances,
	voidTaxRemittance,
	type TaxRemittancePayment,
} from '@/app/lib/tax/remittanceLedgerSync';
import { accountingAmountsLabel, formatAccountingCurrency } from '@/app/lib/accounting/tenantAccountingConfig';
import { downloadCSV, openPrintPreview, generatePdfHtml } from '@/app/lib/accounting/helpers/exportHelpers';
import BankAccountOptionLabel from '@/app/components/shared/BankAccountOptionLabel';
import PostingDateField from '@/app/components/shared/PostingDateField';
import { SortLabel, deskResizableTableClassNames, rowClassNames, useResizableColumns } from '../frontoffice/columnResize';
import { useDeskPagination } from '../dashboard/deskTableUi';
import { DeskKpiStrip, useAccountingDeskPeriod } from './DeskKpiStrip';
import { getPeriodBounds } from '@/app/lib/dashboard/useDashboardPeriod';

const fmt = (n: number) => (n < 0 ? '-' : '') + formatAccountingCurrency(n);
const fmtNum = (n: number) => (n < 0 ? '-' : '') + Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type TaxSortKey = 'period' | 'tax' | 'collected' | 'withholding' | 'inputOffset' | 'payroll' | 'remitted' | 'net';
type TaxKindFilter = 'all' | 'sales' | 'withholding' | 'payroll';

const KIND_LABEL: Record<TaxKindFilter, string> = {
	all: 'All taxes',
	sales: 'Sales taxes',
	withholding: 'Withholding',
	payroll: 'Payroll',
};

function taxKind(taxCode: string): TaxKindFilter {
	const meta = TAX_LIABILITY_GL[taxCode];
	return meta?.category ?? 'sales';
}

function formatPeriodLabel(period: string) {
	if (!/^\d{4}-\d{2}$/.test(period)) return period;
	const [y, m] = period.split('-').map(Number);
	return new Date(y, m - 1, 1).toLocaleString(undefined, { month: 'long', year: 'numeric' });
}

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
	const [kind, setKind] = useState<TaxKindFilter>('all');
	const [q, setQ] = useState('');
	const [notice, setNotice] = useState<string | null>(null);
	const [remitForm, setRemitForm] = useState(defaultRemitForm);
	const [remitErrors, setRemitErrors] = useState<Record<string, string>>({});
	const [remitFormError, setRemitFormError] = useState<string | null>(null);
	const [editingRemittanceId, setEditingRemittanceId] = useState<string | null>(null);
	const { isOpen, onOpen, onClose: closeRemitModal } = useDisclosure();
	const [sortKey, setSortKey] = useState<TaxSortKey>('period');
	const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
	const cols = useResizableColumns<TaxSortKey>({
		period: 100, tax: 168, collected: 108, withholding: 120, inputOffset: 120, payroll: 100, remitted: 108, net: 108,
	});
	const [viewRow, setViewRow] = useState<TaxPeriodRow | null>(null);
	const [deletePrompt, setDeletePrompt] = useState<{ message: string; canConfirm: boolean; paymentIds: string[] } | null>(null);
	const isViewOpen = viewRow != null;
	const summary = useMemo(() => rollupTaxLedger(journalEntries), [journalEntries]);

	const viewPayments = useMemo(() => {
		if (!viewRow) return [] as TaxRemittancePayment[];
		return listTaxRemittances(journalEntries, viewRow.glAccountCode, viewRow.period);
	}, [journalEntries, viewRow]);

	const onClose = () => {
		setEditingRemittanceId(null);
		setRemitFormError(null);
		setRemitErrors({});
		closeRemitModal();
	};

	const rows = useMemo(() => {
		const filtered = summary.rows.filter((r) => {
			if (period !== 'All' && r.period !== period) return false;
			if (kind !== 'all' && taxKind(r.taxCode) !== kind) return false;
			if (!q.trim()) return true;
			const hay = `${r.taxCode} ${r.period} ${r.taxName} ${r.glAccountCode} ${formatPeriodLabel(r.period)}`.toLowerCase();
			return hay.includes(q.trim().toLowerCase());
		});
		const value = (r: TaxPeriodRow): string | number => {
			switch (sortKey) {
				case 'period': return r.period;
				case 'tax': return r.taxName.toLowerCase();
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
	}, [summary.rows, period, kind, q, sortKey, sortDir]);

	const { page, setPage, pages, paged } = useDeskPagination(rows, [period, kind, q, sortKey, sortDir]);

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

	const { period: kpiPeriod, todayISO: kpiToday } = useAccountingDeskPeriod();

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

	// KPI strip follows Customize period (tax rows are YYYY-MM); table keeps its own filters.
	const kpiTotals = useMemo(() => {
		const bounds = getPeriodBounds(kpiPeriod, kpiToday);
		const startMonth = bounds?.start.slice(0, 7);
		const endMonth = bounds?.end.slice(0, 7);
		const scoped = rows.filter((r) => {
			if (!startMonth || !endMonth) return true;
			return r.period >= startMonth && r.period <= endMonth;
		});
		return scoped.reduce(
			(acc, r) => {
				acc.outputCollected += r.outputCollected;
				acc.withholding += r.withholding;
				acc.inputOffset += r.inputOffset;
				acc.payrollWithheld += r.payrollWithheld;
				acc.remitted += r.remitted;
				acc.netPosition += r.netPosition;
				return acc;
			},
			{ outputCollected: 0, withholding: 0, inputOffset: 0, payrollWithheld: 0, remitted: 0, netPosition: 0 },
		);
	}, [rows, kpiPeriod, kpiToday]);

	const periodOptions = ['All', ...summary.periods];
	const owingCount = rows.filter((r) => r.netPosition > 0.004).length;

	const openRemit = (prefill?: { taxCode: string; period: string; amount: number }) => {
		setEditingRemittanceId(null);
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

	const openEditPayment = (payment?: TaxRemittancePayment, row?: TaxPeriodRow) => {
		const target = payment || viewPayments[0];
		const taxCode = target
			? (Object.entries(TAX_LIABILITY_GL).find(([, m]) => m.code === target.taxGlCode)?.[0] || row?.taxCode || '')
			: (row?.taxCode || '');
		if (target) {
			setEditingRemittanceId(target.journalEntryId);
			setRemitForm({
				taxCode,
				period: target.period,
				amount: String(target.amount),
				date: target.date,
				reference: target.reference,
				bankAccountId: target.bankAccountId || activeBankAccounts[0]?.id || '',
			});
		} else if (row) {
			setEditingRemittanceId(null);
			setRemitForm({
				...defaultRemitForm,
				taxCode: row.taxCode,
				period: row.period,
				amount: row.netPosition > 0.004 ? String(row.netPosition) : '',
				bankAccountId: activeBankAccounts[0]?.id || '',
			});
		} else {
			openRemit();
			return;
		}
		setRemitErrors({});
		setRemitFormError(null);
		setDeletePrompt(null);
		setViewRow(null);
		onOpen();
	};

	const askDeletePayments = (row: TaxPeriodRow, payments: TaxRemittancePayment[]) => {
		if (payments.length === 0) {
			setDeletePrompt({
				canConfirm: false,
				paymentIds: [],
				message: 'Nothing recorded with Record payment for this tax and month. Sales, payroll, and purchase amounts stay on the journal — remove those there if needed.',
			});
			return;
		}
		const total = payments.reduce((s, p) => s + p.amount, 0);
		setDeletePrompt({
			canConfirm: true,
			paymentIds: payments.map((p) => p.journalEntryId),
			message: payments.length === 1
				? `Remove the ${fmt(total)} payment for ${row.taxName} · ${formatPeriodLabel(row.period)}? The money goes back to the paying account, and this desk will show it as still to pay again.`
				: `Remove ${payments.length} payments (${fmt(total)}) for ${row.taxName} · ${formatPeriodLabel(row.period)}? The money goes back to the paying accounts, and this desk will show them as still to pay again.`,
		});
	};

	const confirmDeletePayments = () => {
		if (!deletePrompt?.canConfirm || !viewRow) return;
		let failed = 0;
		for (const id of deletePrompt.paymentIds) {
			const result = voidTaxRemittance(id);
			if (!result.ok) failed += 1;
		}
		const removed = deletePrompt.paymentIds.length - failed;
		if (removed > 0) {
			setNotice(
				failed > 0
					? `Removed ${removed} payment${removed === 1 ? '' : 's'}; ${failed} could not be removed.`
					: `Removed ${removed} payment${removed === 1 ? '' : 's'} for ${viewRow.taxName} · ${formatPeriodLabel(viewRow.period)}.`,
			);
			setViewRow(null);
		} else {
			setDeletePrompt({
				canConfirm: false,
				paymentIds: [],
				message: 'Could not remove those payments. Check that the period is not closed.',
			});
			return;
		}
		setDeletePrompt(null);
	};

	const validateRemitForm = (f: typeof remitForm) => {
		const errs: Record<string, string> = {};
		if (!f.taxCode) errs.taxCode = 'Choose which tax you are paying';
		if (!/^\d{4}-\d{2}$/.test(f.period)) errs.period = 'Use a month like 2026-09';
		if (!f.amount || Number(f.amount) <= 0) errs.amount = 'Enter an amount greater than zero';
		if (!f.date) errs.date = 'Payment date is required';
		if (!f.bankAccountId) errs.bankAccountId = 'Choose the account you paid from';
		setRemitErrors(errs);
		return Object.keys(errs).length === 0;
	};

	const handleRemit = () => {
		setRemitFormError(null);
		if (!validateRemitForm(remitForm)) return;
		const meta = TAX_LIABILITY_GL[remitForm.taxCode];
		if (!meta) {
			setRemitFormError('That tax is not set up on this desk.');
			return;
		}
		if (editingRemittanceId) {
			const voided = voidTaxRemittance(editingRemittanceId);
			if (!voided.ok) {
				setRemitFormError(voided.error);
				return;
			}
		}
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
			setNotice(
				editingRemittanceId
					? `Updated payment to ${fmt(Number(remitForm.amount))} for ${meta.name} · ${formatPeriodLabel(remitForm.period)}.`
					: `Paid ${fmt(Number(remitForm.amount))} for ${meta.name} · ${formatPeriodLabel(remitForm.period)}.`,
			);
			onClose();
		} else {
			setRemitFormError(
				editingRemittanceId
					? 'Removed the old payment, but could not save the new one. Check the paying account and that the date is not in a closed period.'
					: 'Could not record this payment. Check the paying account is active, and that the payment date is not in a closed period.',
			);
			if (editingRemittanceId) setEditingRemittanceId(null);
		}
	};

	const exportCSV = () => {
		downloadCSV(
			rows.map((r) => ({
				period: r.period,
				tax: r.taxName,
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
				{ key: 'collected', label: 'From sales' },
				{ key: 'withholding', label: 'Withheld from suppliers' },
				{ key: 'inputOffset', label: 'On purchases' },
				{ key: 'payroll', label: 'From payroll' },
				{ key: 'remitted', label: 'Paid to GRA' },
				{ key: 'net', label: 'Still to pay' },
			]
		);
	};

	const printPDF = () => {
		const tableRows = rows.map((r) => `<tr>
			<td>${formatPeriodLabel(r.period)}</td>
			<td>${r.taxName}</td>
			<td class="amount">${fmt(r.outputCollected)}</td>
			<td class="amount">${fmt(r.withholding)}</td>
			<td class="amount">${fmt(r.inputOffset)}</td>
			<td class="amount">${fmt(r.payrollWithheld)}</td>
			<td class="amount">${fmt(r.remitted)}</td>
			<td class="amount">${fmt(r.netPosition)}</td>
		</tr>`).join('');
		const html = generatePdfHtml('Taxes', `
			<div class="header">
				<h1>Taxes</h1>
				<div class="subtitle">Generated on ${new Date().toLocaleString()}</div>
			</div>
			<div class="meta">
				<div class="meta-item"><div class="meta-label">From sales</div><div class="meta-value">${fmt(totals.outputCollected)}</div></div>
				<div class="meta-item"><div class="meta-label">Withheld from suppliers</div><div class="meta-value">${fmt(totals.withholding)}</div></div>
				<div class="meta-item"><div class="meta-label">On purchases</div><div class="meta-value">${fmt(totals.inputOffset)}</div></div>
				<div class="meta-item"><div class="meta-label">From payroll</div><div class="meta-value">${fmt(totals.payrollWithheld)}</div></div>
				<div class="meta-item"><div class="meta-label">Paid to GRA</div><div class="meta-value">${fmt(totals.remitted)}</div></div>
				<div class="meta-item"><div class="meta-label">Still to pay</div><div class="meta-value">${fmt(totals.netPosition)}</div></div>
			</div>
			<table>
				<thead><tr><th>Period</th><th>Tax</th><th>From sales</th><th>Withheld</th><th>On purchases</th><th>Payroll</th><th>Paid</th><th>Still to pay</th></tr></thead>
				<tbody>${tableRows}</tbody>
			</table>
		`, 'Taxes');
		openPrintPreview(html);
	};

	return (
		<div className="space-y-3 px-3 pt-2 pb-3 md:px-4 md:pt-3 md:pb-4">
			{notice && (
				<Alert color="success" className="mb-1" onClose={() => setNotice(null)}>
					{notice}
				</Alert>
			)}

			<div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
				<div>
					<h4 className="text-lg md:text-xl font-bold text-gray-800">Taxes</h4>
					<p className="text-xs text-gray-500">{accountingAmountsLabel()}</p>
					<p className="text-xs text-gray-600 mt-1">
						What you collected, what you already paid to GRA, and what is still due.
						{owingCount > 0 ? ` ${owingCount} ${owingCount === 1 ? 'line still has' : 'lines still have'} an amount to pay.` : ''}
					</p>
				</div>
			</div>

			<div className="flex flex-nowrap items-center gap-2 overflow-x-auto">
				<Select
					aria-label="Period"
					size="sm"
					className="w-36 shrink-0"
					selectedKeys={[period]}
					disallowEmptySelection
					onSelectionChange={(s) => setPeriod(String(Array.from(s)[0] ?? 'All'))}
				>
					{periodOptions.map((p) => (
						<SelectItem key={p}>{p === 'All' ? 'All periods' : formatPeriodLabel(p)}</SelectItem>
					))}
				</Select>
				<Select
					aria-label="Tax type"
					size="sm"
					className="w-40 shrink-0"
					selectedKeys={[kind]}
					disallowEmptySelection
					onSelectionChange={(s) => setKind((Array.from(s)[0] as TaxKindFilter) || 'all')}
				>
					{(Object.keys(KIND_LABEL) as TaxKindFilter[]).map((k) => (
						<SelectItem key={k}>{KIND_LABEL[k]}</SelectItem>
					))}
				</Select>
				<Input
					size="sm"
					className="w-48 shrink-0"
					placeholder="Search tax or period"
					aria-label="Search taxes"
					value={q}
					onValueChange={setQ}
				/>
				<span className="text-xs text-gray-500 whitespace-nowrap ml-auto shrink-0">
					{rows.length === summary.rows.length
						? `${summary.rows.length} ${summary.rows.length === 1 ? 'line' : 'lines'}`
						: `${rows.length} of ${summary.rows.length} lines`}
				</span>
				<Dropdown>
					<DropdownTrigger>
						<Button size="sm" variant="flat" className="shrink-0">📥 Export</Button>
					</DropdownTrigger>
					<DropdownMenu>
						<DropdownItem key="csv" onPress={exportCSV}>CSV spreadsheet</DropdownItem>
						<DropdownItem key="pdf" onPress={printPDF}>📑 Print PDF</DropdownItem>
					</DropdownMenu>
				</Dropdown>
				<Button size="sm" color="primary" className="shrink-0" onPress={() => openRemit()}>
					Record payment
				</Button>
			</div>

			<DeskKpiStrip
				className="mb-0"
				items={[
					{ id: 'tax.output', label: 'From sales', value: fmt(kpiTotals.outputCollected), tone: 'text-green-700' },
					{ id: 'tax.withholding', label: 'Withheld from suppliers', value: fmt(kpiTotals.withholding), tone: 'text-purple-700' },
					{ id: 'tax.input', label: 'On purchases', value: fmt(kpiTotals.inputOffset), tone: 'text-blue-700' },
					{ id: 'tax.payroll', label: 'From payroll', value: fmt(kpiTotals.payrollWithheld), tone: 'text-orange-700' },
					{ id: 'tax.remitted', label: 'Paid to GRA', value: fmt(kpiTotals.remitted), tone: 'text-red-700' },
					{ id: 'tax.net', label: 'Still to pay', value: fmt(kpiTotals.netPosition), tone: 'text-gray-900' },
				]}
			/>

			<div ref={cols.frameRef} style={cols.frameStyle}>
			<Table aria-label="Taxes" removeWrapper classNames={deskResizableTableClassNames()}>
				<TableHeader>
					{column('period', 'Period')}
					{column('tax', 'Tax')}
					{column('collected', 'From sales (₵)', 'right')}
					{column('withholding', 'Withheld (₵)', 'right')}
					{column('inputOffset', 'On purchases (₵)', 'right')}
					{column('payroll', 'Payroll (₵)', 'right')}
					{column('remitted', 'Paid (₵)', 'right')}
					{column('net', 'Still to pay (₵)', 'right')}
				</TableHeader>
				<TableBody emptyContent={summary.rows.length === 0 ? 'No tax activity posted yet.' : 'No taxes match this search.'}>
					{paged.map((r) => (
						<TableRow
							key={`${r.period}-${r.glAccountCode}`}
							className={rowClassNames(viewRow?.period === r.period && viewRow?.glAccountCode === r.glAccountCode)}
							onClick={() => setViewRow(r)}
						>
							<TableCell>
								<span className="text-blue-600 hover:underline whitespace-nowrap">{formatPeriodLabel(r.period)}</span>
							</TableCell>
							<TableCell>
								<div className="font-medium text-sm truncate" title={r.taxName}>{r.taxName}</div>
								<div className="text-[10px] text-gray-400">{KIND_LABEL[taxKind(r.taxCode)]}</div>
							</TableCell>
							<TableCell className="text-right tabular-nums text-sm text-green-700">{fmtNum(r.outputCollected)}</TableCell>
							<TableCell className="text-right tabular-nums text-sm text-purple-700">{fmtNum(r.withholding)}</TableCell>
							<TableCell className="text-right tabular-nums text-sm text-blue-700">{fmtNum(r.inputOffset)}</TableCell>
							<TableCell className="text-right tabular-nums text-sm text-orange-700">{fmtNum(r.payrollWithheld)}</TableCell>
							<TableCell className="text-right tabular-nums text-sm text-red-700">
								<span className="inline-flex items-center gap-1 justify-end">
									{fmtNum(r.remitted)}
									{r.remittedUnconfirmed > 0.004 && (
										<Chip size="sm" variant="flat" color="warning" className="h-5 text-[10px]">Check</Chip>
									)}
								</span>
							</TableCell>
							<TableCell className={`text-right font-medium tabular-nums text-sm ${r.netPosition > 0.004 ? 'text-amber-800' : 'text-gray-800'}`}>
								{fmtNum(r.netPosition)}
							</TableCell>
						</TableRow>
					))}
				</TableBody>
			</Table>
			</div>
			<div className="mt-3 flex justify-end">
				<Pagination page={page} total={pages} onChange={setPage} showControls size="sm" />
			</div>

			<Modal isOpen={isOpen} onClose={onClose} scrollBehavior="inside">
				<ModalContent>
					<ModalHeader>{editingRemittanceId ? 'Edit tax payment' : 'Record a tax payment'}</ModalHeader>
					<ModalBody className="gap-3">
						<p className="text-sm text-gray-600 -mt-1">
							{editingRemittanceId
								? 'Change the amount, date, reference, or paying account. The old payment is replaced so this desk stays correct.'
								: 'Use this when you have paid GRA (or SSNIT). It reduces what this desk says you still owe, and draws the money from the account you choose.'}
						</p>
						{remitFormError && <Alert color="warning" className="mb-1">{remitFormError}</Alert>}
						<div>
							<Select
								label="Which tax"
								isRequired
								isDisabled={!!editingRemittanceId}
								isInvalid={!!remitErrors.taxCode}
								selectedKeys={remitForm.taxCode ? [remitForm.taxCode] : []}
								onSelectionChange={(k) => setRemitForm({ ...remitForm, taxCode: Array.from(k)[0] as string })}
							>
								{Object.entries(TAX_LIABILITY_GL).map(([code, meta]) => (
									<SelectItem key={code} textValue={meta.name}>
										{meta.name}
									</SelectItem>
								))}
							</Select>
							{remitErrors.taxCode && <div className="text-xs text-danger mt-1">{remitErrors.taxCode}</div>}
						</div>
						<div>
							<Input
								label="For which month"
								placeholder="YYYY-MM"
								description="The month this payment covers"
								isRequired
								isDisabled={!!editingRemittanceId}
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
								label="Amount paid"
								isRequired
								isInvalid={!!remitErrors.amount}
								value={remitForm.amount}
								onValueChange={(v) => setRemitForm({ ...remitForm, amount: v })}
								startContent={<span className="text-gray-400 text-sm">₵</span>}
							/>
							{remitErrors.amount && <div className="text-xs text-danger mt-1">{remitErrors.amount}</div>}
						</div>
						<div>
							<PostingDateField
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
							label="Receipt or reference"
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
								<div className="text-xs text-gray-500">No bank or cash account yet — add one under Bank & Cash first.</div>
							)}
							{remitErrors.bankAccountId && <div className="text-xs text-danger mt-1">{remitErrors.bankAccountId}</div>}
						</div>
					</ModalBody>
					<ModalFooter>
						<Button variant="bordered" onPress={onClose}>Cancel</Button>
						<Button color="primary" onPress={handleRemit}>
							{editingRemittanceId ? 'Save changes' : 'Record payment'}
						</Button>
					</ModalFooter>
				</ModalContent>
			</Modal>

			<Modal
				isOpen={isViewOpen}
				onOpenChange={(open) => {
					if (!open) {
						setViewRow(null);
						setDeletePrompt(null);
					}
				}}
				size="2xl"
				scrollBehavior="inside"
			>
				<ModalContent>
					{(closeView) => {
						if (!viewRow) return null;
						const r = viewRow;
						const owed = r.netPosition > 0.004;
						const payments = viewPayments;
						return (
							<>
								<ModalHeader className="border-b bg-white px-6 py-4">
									<div className="flex justify-between items-start w-full pr-6">
										<div>
											<p className="text-xs uppercase tracking-wide text-gray-500">Tax for {formatPeriodLabel(r.period)}</p>
											<h3 className="text-xl font-bold text-gray-900">{r.taxName}</h3>
											<p className="text-sm text-gray-500">{KIND_LABEL[taxKind(r.taxCode)]}</p>
										</div>
										<div className="text-right">
											<p className={`text-2xl font-bold tabular-nums ${owed ? 'text-amber-800' : 'text-gray-900'}`}>{fmt(r.netPosition)}</p>
											<p className="text-xs text-gray-500">{owed ? 'Still to pay' : 'Balance'}</p>
										</div>
									</div>
								</ModalHeader>
								<ModalBody className="p-6 bg-white text-sm space-y-3">
									<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
										<div className="flex justify-between gap-3"><span className="text-gray-500">Collected on sales</span><span className="tabular-nums text-green-700">{fmt(r.outputCollected)}</span></div>
										<div className="flex justify-between gap-3"><span className="text-gray-500">Withheld from suppliers</span><span className="tabular-nums text-purple-700">{fmt(r.withholding)}</span></div>
										<div className="flex justify-between gap-3"><span className="text-gray-500">Tax on purchases (reduces what you owe)</span><span className="tabular-nums text-blue-700">{fmt(r.inputOffset)}</span></div>
										<div className="flex justify-between gap-3"><span className="text-gray-500">Taken from payroll</span><span className="tabular-nums text-orange-700">{fmt(r.payrollWithheld)}</span></div>
										<div className="flex justify-between gap-3"><span className="text-gray-500">Already paid to GRA</span><span className="tabular-nums text-red-700">{fmt(r.remitted)}</span></div>
										<div className="flex justify-between gap-3 font-semibold"><span>Still to pay</span><span className="tabular-nums">{fmt(r.netPosition)}</span></div>
									</div>
									{payments.length > 0 && (
										<div className="rounded-lg border border-gray-200 p-3 space-y-2">
											<p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Payments recorded here</p>
											{payments.map((p) => {
												const bank = bankAccounts.find((b) => b.id === p.bankAccountId);
												return (
													<div key={p.journalEntryId} className="flex flex-wrap items-center justify-between gap-2 text-sm">
														<div>
															<span className="tabular-nums font-medium text-red-700">{fmt(p.amount)}</span>
															<span className="text-gray-500"> · {p.date}</span>
															{p.reference ? <span className="text-gray-400"> · {p.reference}</span> : null}
															{bank ? <span className="text-gray-400"> · {bank.accountName}</span> : null}
														</div>
														<Button size="sm" variant="flat" onPress={() => openEditPayment(p, r)}>✏️ Edit</Button>
													</div>
												);
											})}
										</div>
									)}
									{r.remittedUnconfirmed > 0.004 && (
										<Alert color="warning">
											{fmt(r.remittedUnconfirmed)} shows as paid, but it was not recorded with Record payment on this screen. Open the journal if you need to check that entry.
										</Alert>
									)}
									{deletePrompt && (
										<Alert color={deletePrompt.canConfirm ? 'danger' : 'warning'}>
											{deletePrompt.message}
										</Alert>
									)}
								</ModalBody>
								<ModalFooter className="border-t bg-white">
									<Button variant="flat" onPress={() => { setDeletePrompt(null); closeView(); }}>Close</Button>
									{deletePrompt?.canConfirm ? (
										<Button color="danger" onPress={confirmDeletePayments}>Confirm delete</Button>
									) : (
										<Button color="danger" variant="flat" onPress={() => askDeletePayments(r, payments)}>🗑️ Delete</Button>
									)}
									<Button color="primary" variant="flat" onPress={() => openEditPayment(payments[0], r)}>✏️ Edit</Button>
									{owed && (
										<Button color="primary" onPress={() => {
											setDeletePrompt(null);
											setViewRow(null);
											openRemit({ taxCode: r.taxCode, period: r.period, amount: r.netPosition });
										}}>
											Record payment
										</Button>
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
