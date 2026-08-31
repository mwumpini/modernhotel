'use client';

import React, { useMemo, useState, useCallback, useEffect } from 'react';
import {
	Card, CardBody, Button, Progress,
	Tabs, Tab,
	Input, Select, SelectItem,
	Table, TableHeader, TableColumn, TableBody, TableRow, TableCell,
	Chip, Pagination, Checkbox,
	Dropdown, DropdownTrigger, DropdownMenu, DropdownItem,
	Tooltip,
	Autocomplete, AutocompleteItem,
} from '@heroui/react';
import { useAccountingStore } from '@/app/lib/accounting/store';
import { frontOfficeStore } from '@/app/lib/frontoffice/store';
import { useFrontOfficeSelector } from '@/app/lib/frontoffice/useFoStore';
import { findMainFolio } from '@/app/lib/frontoffice/helpers/folio';
import {
	buildFolioReceiptTargets,
	buildInvoiceReceiptTargets,
	parseReceiptTargetKey,
	type ReceiptTarget,
} from '@/app/lib/accounting/receiptTargets';
import {
	buildCustomerReceiptPrintData,
	FRONT_OFFICE_FOLIO_RECEIPT_SOURCE,
	mapUiPaymentMethodToStore,
	printCustomerReceipt,
	receiptCanEdit,
	receiptCanVoid,
	resolvePaymentsForReceiptTarget,
	suggestReceiptRevenueCenter,
	type StoredReceiptPayment,
} from '@/app/lib/accounting/receiptPrint';
import { useSettingsStore } from '@/app/lib/settings/store';
import {
	invoiceSyncStatus,
	paymentSyncStatus,
	sourceMatchesFilter,
} from '@/app/lib/accounting/accountingProcessPolicy';
import {
	computeCustomerAgingFromInvoices,
	filterFinanceArInvoices,
	totalFinanceReceivables,
} from '@/app/lib/accounting/arSubledger';
import { computeInvoiceWhtSettlement, getWhtCertificateRates, whtFormLabels } from '@/app/lib/accounting/whtRates';
import { isManualArApSource } from '@/app/lib/accounting/journalReversal';
import { roundMoney2 } from '@/app/lib/accounting/taxFromConfig';
import { convertProformaToInvoice } from '@/app/lib/accounting/integration';
import { computeSalesTax } from '@/app/lib/tax/engine';
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from '@heroui/react';

// ===== EXPORT UTILITIES =====

// Download CSV
const downloadCSV = (data: any[], filename: string, columns: { key: string; label: string }[]) => {
	const header = columns.map(c => c.label).join(',');
	const rows = data.map(row => 
		columns.map(c => {
			const val = row[c.key];
			// Escape quotes and wrap in quotes if contains comma
			const str = String(val ?? '').replace(/"/g, '""');
			return str.includes(',') ? `"${str}"` : str;
		}).join(',')
	);
	const csv = [header, ...rows].join('\n');
	const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
	const url = URL.createObjectURL(blob);
	const link = document.createElement('a');
	link.href = url;
	link.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
	link.click();
	URL.revokeObjectURL(url);
};

// Generate PDF HTML
const generatePdfHtml = (title: string, content: string, footer?: string) => `
<!DOCTYPE html>
<html>
<head>
	<meta charset="utf-8">
	<title>${title}</title>
	<style>
		* { margin: 0; padding: 0; box-sizing: border-box; }
		body { font-family: 'Segoe UI', Arial, sans-serif; color: #1f2937; padding: 40px; }
		.header { border-bottom: 3px solid #3b82f6; padding-bottom: 20px; margin-bottom: 30px; }
		.header h1 { font-size: 28px; color: #1e40af; margin-bottom: 5px; }
		.header .subtitle { color: #6b7280; font-size: 14px; }
		.meta { display: flex; gap: 40px; margin-bottom: 30px; padding: 15px; background: #f3f4f6; border-radius: 8px; }
		.meta-item { }
		.meta-label { font-size: 11px; color: #6b7280; text-transform: uppercase; }
		.meta-value { font-size: 16px; font-weight: 600; color: #111827; }
		table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
		th { background: #1e40af; color: white; padding: 12px 8px; text-align: left; font-size: 12px; text-transform: uppercase; }
		td { padding: 10px 8px; border-bottom: 1px solid #e5e7eb; font-size: 13px; }
		tr:nth-child(even) { background: #f9fafb; }
		.amount { text-align: right; font-family: monospace; }
		.total-row { background: #dbeafe !important; font-weight: bold; }
		.total-row td { border-top: 2px solid #3b82f6; }
		.footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 12px; }
		.badge { display: inline-block; padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; }
		.badge-success { background: #dcfce7; color: #166534; }
		.badge-warning { background: #fef3c7; color: #92400e; }
		.badge-danger { background: #fee2e2; color: #991b1b; }
		.badge-info { background: #dbeafe; color: #1e40af; }
		.section { margin-bottom: 25px; }
		.section-title { font-size: 14px; font-weight: 600; color: #374151; margin-bottom: 10px; border-bottom: 1px solid #e5e7eb; padding-bottom: 5px; }
		.detail-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; }
		.detail-item .label { font-size: 11px; color: #6b7280; }
		.detail-item .value { font-size: 14px; font-weight: 500; }
		@media print { body { padding: 20px; } }
	</style>
</head>
<body>
	${content}
	${footer ? `<div class="footer">${footer}</div>` : ''}
</body>
</html>
`;

// Open print preview
const openPdfPreview = (html: string) => {
	const win = window.open('', '_blank');
	if (win) {
		win.document.write(html);
		win.document.close();
		setTimeout(() => win.print(), 500);
	}
};

function InfoTip({ label, children }: { label: string; children: React.ReactNode }) {
	return (
		<Tooltip placement="top" classNames={{ content: 'max-w-sm p-3 text-sm leading-snug' }} content={children}>
			<button
				type="button"
				aria-label={label}
				className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-default-300 text-[10px] font-semibold text-default-600 hover:bg-default-100"
			>
				i
			</button>
		</Tooltip>
	);
}

export default function AccountsReceivable() {
	const [selectedTab, setSelectedTab] = useState('overview');
	const [page, setPage] = useState(1);
	const rowsPerPage = 10;
	const [refreshKey, setRefreshKey] = useState(0);
	const [isRefreshing, setIsRefreshing] = useState(false);

	// Filters
	const [statusFilter, setStatusFilter] = useState('all');
	const [sourceFilter, setSourceFilter] = useState('all');
	const [dateFrom, setDateFrom] = useState('');
	const [dateTo, setDateTo] = useState('');
	const [searchQuery, setSearchQuery] = useState('');

	// Live data from store
    const {
        businessPartners,
        invoices,
        payments,
		journalEntries,
		taxConfigs,
		whtCertificates,
		bankAccounts,
		revenueCenters,
        addPayment,
		updatePayment,
		addInvoice,
		updateInvoice,
		addBusinessPartner,
		postInvoice,
		initializeAccounting,
		isLoading,
		recordWHTPayment,
		receiveWHTCertificate,
		updateWHTCertificate,
		voidInvoice,
		voidPayment,
    } = useAccountingStore();
	const settings = useSettingsStore();
	const receiptTemplateKey = settings.printing?.receipt || 'simple-receipt';
	const printOrg = useMemo(() => {
		const biz = settings.countryCompliance?.[settings.defaultCountry]?.businessInfo;
		return {
			name: biz?.name || settings.systemName || 'Hotel',
			address: biz?.address,
			phone: biz?.phone,
			email: biz?.email,
			taxId: biz?.taxId,
		};
	}, [settings]);
	const printCurrency =
		settings.countryCompliance?.[settings.defaultCountry]?.currencySymbol || '₵';

	// Parent AccountingMainDashboard initializes the store; refresh via button only.

	// Refresh data
	const handleRefresh = useCallback(async () => {
		setIsRefreshing(true);
		await initializeAccounting();
		setRefreshKey(k => k + 1);
		setTimeout(() => setIsRefreshing(false), 500);
		console.log('[AR] 🔄 Data refreshed');
	}, [initializeAccounting]);

	// Get active tax rates from config or use defaults
	const activeTaxRates = useMemo(() => {
		const defaultRates = {
			VAT:     { name: 'VAT',          rate: 20.0 },
			NHIL:    { name: 'NHIL',         rate: 2.5  },
			GETFUND: { name: 'GETFund Levy', rate: 2.5  },
			TOURISM: { name: 'Tourism Levy', rate: 1.0  },
		};
		
		if (taxConfigs && taxConfigs.length > 0) {
			const rates: Record<string, { name: string; rate: number }> = {};
			taxConfigs.filter(t => t.isActive).forEach(t => {
				rates[t.code] = { name: t.name, rate: t.rate };
			});
			return Object.keys(rates).length > 0 ? rates : defaultRates;
		}
		return defaultRates;
	}, [taxConfigs]);

	// Filter customers and sales data
    const customers = useMemo(() => businessPartners.filter(p => p.type === 'Customer' || p.type === 'Both'), [businessPartners]);
	const allSalesInvoices = useMemo(() => invoices.filter(inv => inv.type === 'Sales'), [invoices]);
    const receipts = useMemo(() => payments.filter(p => p.type === 'Receipt'), [payments]);

	// Separate Sales Invoices from Proforma
	const salesInvoices = useMemo(() => allSalesInvoices.filter((inv: any) => !inv.isProforma && !inv.invoiceNumber?.startsWith('PRO-')), [allSalesInvoices]);
	const proformaInvoices = useMemo(() => allSalesInvoices.filter((inv: any) => inv.isProforma || inv.invoiceNumber?.startsWith('PRO-')), [allSalesInvoices]);

	// Source label helper
	const getSourceLabel = (sourceModule: string) => {
		const sourceLabels: Record<string, { label: string; color: 'primary' | 'secondary' | 'success' | 'warning' | 'danger'; icon: string }> = {
			front_office: { label: 'Front Office', color: 'primary', icon: '🏨' },
			front_office_checkout: { label: 'Front Office', color: 'primary', icon: '🏨' },
			front_office_folio: { label: 'In-house folio', color: 'primary', icon: '🏨' },
			guest_noshow: { label: 'Front Office', color: 'primary', icon: '🏨' },
			restaurant: { label: 'Restaurant', color: 'success', icon: '🍽️' },
			bar: { label: 'Bar', color: 'warning', icon: '🍺' },
			room_service: { label: 'Room Service', color: 'secondary', icon: '🛎️' },
			conference: { label: 'Conference', color: 'danger', icon: '📅' },
			manual_ar_ap: { label: 'Manual', color: 'default' as any, icon: '📝' },
			manual: { label: 'Manual', color: 'default' as any, icon: '📝' },
		};
		return sourceLabels[sourceModule] || { label: sourceModule || 'Manual', color: 'default' as any, icon: '📝' };
	};

	const getGlSyncChip = (kind: 'invoice' | 'payment', record: any) => {
		const status =
			kind === 'invoice'
				? invoiceSyncStatus(record, journalEntries)
				: paymentSyncStatus(record, journalEntries);
		if (status === 'not_applicable') return null;
		const color = status === 'synced' ? 'success' : status === 'subledger_only' ? 'warning' : 'danger';
		const label = status === 'synced' ? 'GL ✓' : status === 'subledger_only' ? 'No GL' : 'GL only';
		return { color, label };
	};

	// Apply filters to invoices
	const applyFilters = (invoiceList: any[]) => {
		return invoiceList.filter((inv: any) => {
			// Status filter
			if (statusFilter !== 'all') {
				const balance = (inv.total || 0) - (inv.paidAmount || 0);
				if (statusFilter === 'paid' && balance > 0) return false;
				if (statusFilter === 'unpaid' && balance <= 0) return false;
				if (statusFilter === 'overdue') {
					const dueDate = new Date(inv.dueDate);
					if (balance <= 0 || dueDate >= new Date()) return false;
				}
			}
			// Source filter
			if (sourceFilter !== 'all' && !sourceMatchesFilter(inv.sourceModule, sourceFilter)) return false;
			// Date filter
			if (dateFrom && new Date(inv.date) < new Date(dateFrom)) return false;
			if (dateTo && new Date(inv.date) > new Date(dateTo)) return false;
			// Search
			if (searchQuery) {
				const q = searchQuery.toLowerCase();
				const matchInvoice = (inv.invoiceNumber || inv.id || '').toLowerCase().includes(q);
				const matchCustomer = (inv.customerName || '').toLowerCase().includes(q);
				const matchDesc = (inv.description || '').toLowerCase().includes(q);
				if (!matchInvoice && !matchCustomer && !matchDesc) return false;
			}
			return true;
		});
	};

	// Filtered lists
	const filteredSalesInvoices = useMemo(() => applyFilters(salesInvoices), [salesInvoices, statusFilter, sourceFilter, dateFrom, dateTo, searchQuery]);
	const filteredProformas = useMemo(() => applyFilters(proformaInvoices), [proformaInvoices, statusFilter, sourceFilter, dateFrom, dateTo, searchQuery]);
	const filteredReceipts = useMemo(() => {
		return receipts.filter((r: any) => {
			if (sourceFilter !== 'all' && !sourceMatchesFilter(r.sourceModule, sourceFilter)) return false;
			if (dateFrom && new Date(r.date) < new Date(dateFrom)) return false;
			if (dateTo && new Date(r.date) > new Date(dateTo)) return false;
			if (searchQuery) {
				const q = searchQuery.toLowerCase();
				const matchReceipt = (r.paymentNumber || r.id || '').toLowerCase().includes(q);
				const matchCustomer = (r.customerName || '').toLowerCase().includes(q);
				if (!matchReceipt && !matchCustomer) return false;
			}
			return true;
		});
	}, [receipts, sourceFilter, dateFrom, dateTo, searchQuery]);

	// Customer aging — finance subledger only (excludes open folios / proformas)
	const customerAging = useMemo(
		() => computeCustomerAgingFromInvoices(salesInvoices, customers),
		[salesInvoices, customers],
	);

	// Totals — finance AR subledger (posted sales invoices only)
	const financeInvoices = useMemo(() => filterFinanceArInvoices(salesInvoices), [salesInvoices]);
	const totalRevenue = financeInvoices.reduce((s: number, i: any) => s + (i.total || 0), 0);
	const totalReceived = financeInvoices.reduce((s: number, i: any) => s + (i.paidAmount || 0), 0);
	const totalOutstanding = totalFinanceReceivables(salesInvoices);
	const totalProforma = proformaInvoices.reduce((s: number, i: any) => s + (i.total || 0), 0);

	// Pagination helpers
	const getPaginatedData = (data: any[], currentPage: number) => {
		const start = (currentPage - 1) * rowsPerPage;
		return data.slice(start, start + rowsPerPage);
	};

	// Modal states
	const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
	const [isDetailOpen, setIsDetailOpen] = useState(false);
	const [selectedReceipt, setSelectedReceipt] = useState<any>(null);
	const [isReceiptDetailOpen, setIsReceiptDetailOpen] = useState(false);
	const [isNewInvoiceOpen, setIsNewInvoiceOpen] = useState(false);
	const [isNewReceiptOpen, setIsNewReceiptOpen] = useState(false);
	const [isPrintReceiptOpen, setIsPrintReceiptOpen] = useState(false);
	const [isWHTPaymentOpen, setIsWHTPaymentOpen] = useState(false);
	const [whtPaymentMode, setWhtPaymentMode] = useState<'settlement' | 'wht_only'>('settlement');
	const [selectedWHTCert, setSelectedWHTCert] = useState<any>(null);
	const [isWHTDetailOpen, setIsWHTDetailOpen] = useState(false);
	const [receiveCertForm, setReceiveCertForm] = useState({ certificateNumber: '', withholdingAgentTIN: '' });
    const [invoiceForm, setInvoiceForm] = useState<any>({});
	const [receiptForm, setReceiptForm] = useState<any>({ printAfterSave: true });
	const [editingReceiptId, setEditingReceiptId] = useState<string | null>(null);
	const [printForm, setPrintForm] = useState<{ targetKey: string; paymentId: string }>({
		targetKey: '',
		paymentId: '',
	});
	const [whtPaymentForm, setWHTPaymentForm] = useState<any>({
		invoiceId: '',
		invoiceNumber: '',
		invoiceTotal: 0,
		customerName: '',
		cashAmount: 0,
		whtAmount: 0,
		whtVatAmount: 0,
		paymentMethod: 'Bank',
		certificateNumber: '',
		withholdingAgentTIN: '',
	});
	const [formError, setFormError] = useState('');

	const activeRevenueCenters = useMemo(
		() => (revenueCenters || []).filter((rc) => rc.isActive),
		[revenueCenters],
	);

	const foFolios = useFrontOfficeSelector((s) => s.folios);
	const foReservations = useFrontOfficeSelector((s) => s.reservations);

	useEffect(() => {
		if (isNewReceiptOpen || isPrintReceiptOpen) void frontOfficeStore.refreshFromApi();
	}, [isNewReceiptOpen, isPrintReceiptOpen]);

	const activeBankAccounts = useMemo(
		() => (bankAccounts || []).filter((b) => b.isActive),
		[bankAccounts],
	);

	const receiptTargets = useMemo(
		() => [
			...buildFolioReceiptTargets(foFolios, foReservations),
			...buildInvoiceReceiptTargets(salesInvoices),
		],
		[foFolios, foReservations, salesInvoices],
	);

	const filteredReceiptTargets = useMemo(() => {
		if (!receiptForm.businessPartnerId && !receiptForm.customerName?.trim()) {
			return receiptTargets;
		}
		const name = receiptForm.customerName?.trim().toLowerCase();
		return receiptTargets.filter(
			(t) =>
				(receiptForm.businessPartnerId && t.businessPartnerId === receiptForm.businessPartnerId) ||
				(name && t.customerName.toLowerCase().includes(name)),
		);
	}, [receiptTargets, receiptForm.businessPartnerId, receiptForm.customerName]);

	const selectedReceiptTarget = useMemo(
		() =>
			receiptForm.targetKey
				? receiptTargets.find((t) => t.key === receiptForm.targetKey) ?? null
				: null,
		[receiptForm.targetKey, receiptTargets],
	);

	const selectedReceiptInvoice = useMemo(
		() =>
			selectedReceiptTarget?.kind === 'invoice'
				? salesInvoices.find((inv: any) => inv.id === selectedReceiptTarget.id)
				: receiptForm.invoiceId
					? salesInvoices.find((inv: any) => inv.id === receiptForm.invoiceId)
					: null,
		[selectedReceiptTarget, receiptForm.invoiceId, salesInvoices],
	);

	const receiptBalanceDue = useMemo(
		() =>
			selectedReceiptTarget
				? roundMoney2(selectedReceiptTarget.balance)
				: selectedReceiptInvoice
					? roundMoney2((selectedReceiptInvoice.total || 0) - (selectedReceiptInvoice.paidAmount || 0))
					: 0,
		[selectedReceiptTarget, selectedReceiptInvoice],
	);

	const receiptWhtSettlement = useMemo(
		() =>
			selectedReceiptInvoice
				? computeInvoiceWhtSettlement(selectedReceiptInvoice, taxConfigs)
				: null,
		[selectedReceiptInvoice, taxConfigs],
	);

	const receiptNeedsBankAccount = ['Bank Transfer', 'Bank', 'Card', 'Mobile Money', 'Cheque', 'Check'].includes(
		receiptForm.paymentMethod || '',
	);

	const selectedPrintTarget = useMemo(
		() =>
			printForm.targetKey
				? receiptTargets.find((t) => t.key === printForm.targetKey) ?? null
				: null,
		[printForm.targetKey, receiptTargets],
	);

	const printTargetPayments = useMemo(() => {
		if (!selectedPrintTarget) return [] as StoredReceiptPayment[];
		const folio =
			selectedPrintTarget.kind === 'folio'
				? findMainFolio(foFolios, selectedPrintTarget.id)
				: null;
		return resolvePaymentsForReceiptTarget(
			selectedPrintTarget,
			receipts as StoredReceiptPayment[],
			folio,
		);
	}, [selectedPrintTarget, receipts, foFolios]);

	const selectedPrintPayment = useMemo(
		() =>
			printTargetPayments.find((p) => p.id === printForm.paymentId) ??
			printTargetPayments[0] ??
			null,
		[printTargetPayments, printForm.paymentId],
	);

	const printCustomerReceiptForPayment = useCallback(
		(payment: StoredReceiptPayment, target?: ReceiptTarget | null) => {
			const targetResolved =
				target ??
				(payment.receiptTargetKey
					? receiptTargets.find((t) => t.key === payment.receiptTargetKey) ?? null
					: payment.invoiceId
						? receiptTargets.find((t) => t.kind === 'invoice' && t.id === payment.invoiceId) ?? null
						: payment.reservationId
							? receiptTargets.find((t) => t.kind === 'folio' && t.id === payment.reservationId) ?? null
							: null);
			const invoice = payment.invoiceId
				? (salesInvoices.find((i: any) => i.id === payment.invoiceId) as any)
				: null;
			const reservation = payment.reservationId
				? foReservations.find((r) => r.id === payment.reservationId)
				: undefined;
			const folio = reservation
				? findMainFolio(foFolios, reservation.id)
				: undefined;
			const data = buildCustomerReceiptPrintData({
				payment,
				customerName:
					payment.customerName || targetResolved?.customerName || invoice?.customerName || 'Customer',
				target: targetResolved,
				invoice,
				reservation,
				folio,
				org: printOrg,
				currency: printCurrency,
				docNumber: payment.paymentNumber || payment.id,
			});
			printCustomerReceipt(receiptTemplateKey, data);
		},
		[
			receiptTargets,
			salesInvoices,
			foReservations,
			foFolios,
			printOrg,
			printCurrency,
			receiptTemplateKey,
		],
	);

	// WHT Certificates filtered
	const filteredWHTCerts = useMemo(() => {
		return (whtCertificates || []).filter((cert: any) => {
			if (statusFilter !== 'all' && cert.status?.toLowerCase() !== statusFilter) return false;
			if (dateFrom && new Date(cert.date) < new Date(dateFrom)) return false;
			if (dateTo && new Date(cert.date) > new Date(dateTo)) return false;
			if (searchQuery) {
				const q = searchQuery.toLowerCase();
				const matchCert = (cert.certificateNumber || '').toLowerCase().includes(q);
				const matchAgent = (cert.withholdingAgentName || '').toLowerCase().includes(q);
				const matchInv = (cert.invoiceNumber || '').toLowerCase().includes(q);
				if (!matchCert && !matchAgent && !matchInv) return false;
			}
			return true;
		});
	}, [whtCertificates, statusFilter, dateFrom, dateTo, searchQuery]);

	// WHT totals
	const totalWHTReceivable = (whtCertificates || []).reduce((s: number, c: any) => s + (c.totalWithheld || 0), 0);
	const pendingWHTCerts = (whtCertificates || []).filter((c: any) => c.status === 'Pending').length;

	const whtCertRates = useMemo(() => getWhtCertificateRates(taxConfigs), [taxConfigs]);
	const whtLabels = useMemo(() => whtFormLabels(whtCertRates), [whtCertRates]);
	const receiptWhtAvailable =
		!!receiptWhtSettlement && receiptWhtSettlement.whtTotalRemaining > 0.009;

	// Get related data
	const getInvoiceReceipts = (invoiceId: string) =>
		receipts.filter((r: any) => r.invoiceId === invoiceId && r.status !== 'Void');
	const getReceiptInvoice = (invoiceId: string) => allSalesInvoices.find((inv: any) => inv.id === invoiceId);

	// Open detail views
	const openInvoiceDetail = (invoice: any) => { setSelectedInvoice(invoice); setIsDetailOpen(true); };
	const openReceiptDetail = (receipt: any) => { setSelectedReceipt(receipt); setIsReceiptDetailOpen(true); };

	// ===== EXPORT FUNCTIONS =====
	
	// Export Sales Invoices to CSV
	const exportInvoicesCSV = useCallback(() => {
		const columns = [
			{ key: 'invoiceNumber', label: 'Invoice #' },
			{ key: 'customerName', label: 'Customer' },
			{ key: 'sourceModule', label: 'Source' },
			{ key: 'date', label: 'Date' },
			{ key: 'dueDate', label: 'Due Date' },
			{ key: 'subtotal', label: 'Subtotal' },
			{ key: 'taxAmount', label: 'Tax' },
			{ key: 'total', label: 'Total' },
			{ key: 'paidAmount', label: 'Paid' },
			{ key: 'status', label: 'Status' },
			{ key: 'staffName', label: 'Staff' },
		];
		const data = filteredSalesInvoices.map((inv: any) => ({
			...inv,
			date: new Date(inv.date).toLocaleDateString(),
			dueDate: new Date(inv.dueDate).toLocaleDateString(),
		}));
		downloadCSV(data, 'sales_invoices', columns);
	}, [filteredSalesInvoices]);

	// Export Proformas to CSV
	const exportProformasCSV = useCallback(() => {
		const columns = [
			{ key: 'invoiceNumber', label: 'Proforma #' },
			{ key: 'customerName', label: 'Client' },
			{ key: 'sourceModule', label: 'Source' },
			{ key: 'eventId', label: 'Event ID' },
			{ key: 'checkIn', label: 'Check-In' },
			{ key: 'checkOut', label: 'Check-Out' },
			{ key: 'pax', label: 'Pax' },
			{ key: 'venue', label: 'Venue' },
			{ key: 'total', label: 'Amount' },
			{ key: 'dueDate', label: 'Valid Until' },
		];
		const data = filteredProformas.map((inv: any) => ({
			...inv,
			checkIn: inv.checkIn ? new Date(inv.checkIn).toLocaleDateString() : '',
			checkOut: inv.checkOut ? new Date(inv.checkOut).toLocaleDateString() : '',
			dueDate: new Date(inv.dueDate).toLocaleDateString(),
		}));
		downloadCSV(data, 'proforma_invoices', columns);
	}, [filteredProformas]);

	// Export Receipts to CSV
	const exportReceiptsCSV = useCallback(() => {
		const columns = [
			{ key: 'paymentNumber', label: 'Receipt #' },
			{ key: 'customerName', label: 'Customer' },
			{ key: 'sourceModule', label: 'Source' },
			{ key: 'date', label: 'Date' },
			{ key: 'paymentMethod', label: 'Method' },
			{ key: 'amount', label: 'Amount' },
			{ key: 'invoiceId', label: 'Invoice ID' },
			{ key: 'staffName', label: 'Staff' },
			{ key: 'status', label: 'Status' },
		];
		const data = filteredReceipts.map((r: any) => ({
			...r,
			date: new Date(r.date).toLocaleString(),
		}));
		downloadCSV(data, 'receipts', columns);
	}, [filteredReceipts]);

	// Export Aging to CSV
	const exportAgingCSV = useCallback(() => {
		const columns = [
			{ key: 'customerName', label: 'Customer' },
			{ key: 'invoiceCount', label: 'Invoices' },
			{ key: 'totalInvoiced', label: 'Total Invoiced' },
			{ key: 'totalPaid', label: 'Total Paid' },
			{ key: 'balance', label: 'Balance' },
			{ key: 'current', label: 'Current' },
			{ key: 'days30', label: '1-30 Days' },
			{ key: 'days60', label: '31-60 Days' },
			{ key: 'days90', label: '61-90 Days' },
			{ key: 'over90', label: '90+ Days' },
		];
		downloadCSV(customerAging, 'customer_aging', columns);
	}, [customerAging]);

	// Print Invoices Table as PDF
	const printInvoicesTablePDF = useCallback(() => {
		const rows = filteredSalesInvoices.map((inv: any) => {
			const balance = (inv.total || 0) - (inv.paidAmount || 0);
			const status = balance === 0 ? 'Paid' : new Date(inv.dueDate) < new Date() ? 'Overdue' : 'Open';
			return `<tr>
				<td>${inv.invoiceNumber || inv.id}</td>
				<td>${inv.customerName || '-'}</td>
				<td>${getSourceLabel(inv.sourceModule).label}</td>
				<td>${new Date(inv.date).toLocaleDateString()}</td>
				<td class="amount">₵${Number(inv.total || 0).toLocaleString()}</td>
				<td class="amount">₵${Number(inv.paidAmount || 0).toLocaleString()}</td>
				<td class="amount">₵${balance.toLocaleString()}</td>
				<td><span class="badge ${status === 'Paid' ? 'badge-success' : status === 'Overdue' ? 'badge-danger' : 'badge-warning'}">${status}</span></td>
			</tr>`;
		}).join('');
		const totalAmount = filteredSalesInvoices.reduce((s: number, i: any) => s + (i.total || 0), 0);
		const totalPaid = filteredSalesInvoices.reduce((s: number, i: any) => s + (i.paidAmount || 0), 0);
		const html = generatePdfHtml('Sales Invoices Report', `
			<div class="header">
				<h1>🧾 Sales Invoices Report</h1>
				<div class="subtitle">Generated on ${new Date().toLocaleString()}</div>
			</div>
			<div class="meta">
				<div class="meta-item"><div class="meta-label">Total Invoices</div><div class="meta-value">${filteredSalesInvoices.length}</div></div>
				<div class="meta-item"><div class="meta-label">Total Amount</div><div class="meta-value">₵${totalAmount.toLocaleString()}</div></div>
				<div class="meta-item"><div class="meta-label">Total Paid</div><div class="meta-value">₵${totalPaid.toLocaleString()}</div></div>
				<div class="meta-item"><div class="meta-label">Outstanding</div><div class="meta-value">₵${(totalAmount - totalPaid).toLocaleString()}</div></div>
			</div>
			<table>
				<thead><tr><th>Invoice #</th><th>Customer</th><th>Source</th><th>Date</th><th>Total</th><th>Paid</th><th>Balance</th><th>Status</th></tr></thead>
				<tbody>${rows}</tbody>
			</table>
		`, 'Accounts Receivable • Sales Invoices');
		openPdfPreview(html);
	}, [filteredSalesInvoices]);

	// Print Proformas Table as PDF
	const printProformasTablePDF = useCallback(() => {
		const rows = filteredProformas.map((inv: any) => {
			const isExpired = new Date(inv.dueDate) < new Date();
			return `<tr>
				<td>${inv.invoiceNumber || inv.id}</td>
				<td>${inv.customerName || '-'}</td>
				<td>${inv.eventId || '-'}</td>
				<td>${inv.pax || '-'}</td>
				<td>${inv.venue || '-'}</td>
				<td class="amount">₵${Number(inv.total || 0).toLocaleString()}</td>
				<td>${new Date(inv.dueDate).toLocaleDateString()}</td>
				<td><span class="badge ${isExpired ? 'badge-danger' : 'badge-info'}">${isExpired ? 'Expired' : 'Active'}</span></td>
			</tr>`;
		}).join('');
		const totalAmount = filteredProformas.reduce((s: number, i: any) => s + (i.total || 0), 0);
		const html = generatePdfHtml('Proforma Invoices Report', `
			<div class="header">
				<h1>📋 Proforma Invoices Report</h1>
				<div class="subtitle">Generated on ${new Date().toLocaleString()}</div>
			</div>
			<div class="meta">
				<div class="meta-item"><div class="meta-label">Total Proformas</div><div class="meta-value">${filteredProformas.length}</div></div>
				<div class="meta-item"><div class="meta-label">Total Value</div><div class="meta-value">₵${totalAmount.toLocaleString()}</div></div>
			</div>
			<table>
				<thead><tr><th>Proforma #</th><th>Client</th><th>Event</th><th>Pax</th><th>Venue</th><th>Amount</th><th>Valid Until</th><th>Status</th></tr></thead>
				<tbody>${rows}</tbody>
			</table>
		`, 'Accounts Receivable • Proforma Invoices');
		openPdfPreview(html);
	}, [filteredProformas]);

	// Print Receipts Table as PDF
	const printReceiptsTablePDF = useCallback(() => {
		const rows = filteredReceipts.map((r: any) => `<tr>
			<td>${r.paymentNumber || r.id}</td>
			<td>${r.customerName || '-'}</td>
			<td>${getSourceLabel(r.sourceModule).label}</td>
			<td>${new Date(r.date).toLocaleString()}</td>
			<td>${r.paymentMethod || 'Cash'}</td>
			<td class="amount">₵${Number(r.amount || 0).toLocaleString()}</td>
			<td>${r.staffName || '-'}</td>
		</tr>`).join('');
		const totalAmount = filteredReceipts.reduce((s: number, r: any) => s + (r.amount || 0), 0);
		const html = generatePdfHtml('Receipts Report', `
			<div class="header">
				<h1>💳 Receipts Report</h1>
				<div class="subtitle">Generated on ${new Date().toLocaleString()}</div>
			</div>
			<div class="meta">
				<div class="meta-item"><div class="meta-label">Total Receipts</div><div class="meta-value">${filteredReceipts.length}</div></div>
				<div class="meta-item"><div class="meta-label">Total Received</div><div class="meta-value">₵${totalAmount.toLocaleString()}</div></div>
			</div>
			<table>
				<thead><tr><th>Receipt #</th><th>Customer</th><th>Source</th><th>Date/Time</th><th>Method</th><th>Amount</th><th>Staff</th></tr></thead>
				<tbody>${rows}</tbody>
			</table>
		`, 'Accounts Receivable • Receipts');
		openPdfPreview(html);
	}, [filteredReceipts]);

	// Print Aging Report as PDF
	const printAgingPDF = useCallback(() => {
		const rows = customerAging.map((c: any) => `<tr>
			<td>${c.customerName}</td>
			<td>${c.invoiceCount}</td>
			<td class="amount">₵${c.totalInvoiced.toLocaleString()}</td>
			<td class="amount">₵${c.totalPaid.toLocaleString()}</td>
			<td class="amount" style="font-weight:bold">₵${c.balance.toLocaleString()}</td>
			<td class="amount">${c.current > 0 ? `₵${c.current.toLocaleString()}` : '-'}</td>
			<td class="amount" style="color:#ca8a04">${c.days30 > 0 ? `₵${c.days30.toLocaleString()}` : '-'}</td>
			<td class="amount" style="color:#ea580c">${c.days60 > 0 ? `₵${c.days60.toLocaleString()}` : '-'}</td>
			<td class="amount" style="color:#dc2626">${c.days90 > 0 ? `₵${c.days90.toLocaleString()}` : '-'}</td>
			<td class="amount" style="color:#991b1b;font-weight:bold">${c.over90 > 0 ? `₵${c.over90.toLocaleString()}` : '-'}</td>
		</tr>`).join('');
		const totals = customerAging.reduce((acc: any, c: any) => ({
			balance: acc.balance + c.balance,
			current: acc.current + c.current,
			days30: acc.days30 + c.days30,
			days60: acc.days60 + c.days60,
			days90: acc.days90 + c.days90,
			over90: acc.over90 + c.over90,
		}), { balance: 0, current: 0, days30: 0, days60: 0, days90: 0, over90: 0 });
		const html = generatePdfHtml('Customer Aging Report', `
			<div class="header">
				<h1>📊 Customer Aging Report</h1>
				<div class="subtitle">Generated on ${new Date().toLocaleString()}</div>
			</div>
			<div class="meta">
				<div class="meta-item"><div class="meta-label">Active Customers</div><div class="meta-value">${customerAging.length}</div></div>
				<div class="meta-item"><div class="meta-label">Total Outstanding</div><div class="meta-value">₵${totals.balance.toLocaleString()}</div></div>
				<div class="meta-item"><div class="meta-label">Overdue (30+ days)</div><div class="meta-value">₵${(totals.days30 + totals.days60 + totals.days90 + totals.over90).toLocaleString()}</div></div>
			</div>
			<table>
				<thead><tr><th>Customer</th><th>Invoices</th><th>Invoiced</th><th>Paid</th><th>Balance</th><th>Current</th><th>1-30</th><th>31-60</th><th>61-90</th><th>90+</th></tr></thead>
				<tbody>${rows}
				<tr class="total-row">
					<td colspan="4"><strong>TOTAL</strong></td>
					<td class="amount">₵${totals.balance.toLocaleString()}</td>
					<td class="amount">₵${totals.current.toLocaleString()}</td>
					<td class="amount">₵${totals.days30.toLocaleString()}</td>
					<td class="amount">₵${totals.days60.toLocaleString()}</td>
					<td class="amount">₵${totals.days90.toLocaleString()}</td>
					<td class="amount">₵${totals.over90.toLocaleString()}</td>
				</tr>
				</tbody>
			</table>
		`, 'Accounts Receivable • Customer Aging Analysis');
		openPdfPreview(html);
	}, [customerAging]);

	// Print Individual Invoice/Proforma PDF
	const printInvoicePDF = useCallback((invoice: any) => {
		const isProforma = invoice.isProforma || invoice.invoiceNumber?.startsWith('PRO-');
		const source = getSourceLabel(invoice.sourceModule);
		const balance = (invoice.total || 0) - (invoice.paidAmount || 0);
		const relatedReceipts = getInvoiceReceipts(invoice.id);
		
		const receiptRows = relatedReceipts.map((r: any) => `<tr>
			<td>${r.paymentNumber || r.id}</td>
			<td>${new Date(r.date).toLocaleString()}</td>
			<td>${r.paymentMethod}</td>
			<td class="amount">₵${Number(r.amount).toLocaleString()}</td>
		</tr>`).join('') || '<tr><td colspan="4" style="text-align:center;color:#6b7280">No payments recorded</td></tr>';

		const html = generatePdfHtml(isProforma ? 'Proforma Invoice' : 'Sales Invoice', `
			<div class="header">
				<h1>${isProforma ? '📋' : '🧾'} ${isProforma ? 'PROFORMA INVOICE' : 'SALES INVOICE'}</h1>
				<div class="subtitle">${invoice.invoiceNumber || invoice.id}</div>
			</div>
			
			<div class="section">
				<div class="section-title">Transaction Details</div>
				<div class="detail-grid">
					<div class="detail-item"><div class="label">Type</div><div class="value">${isProforma ? 'Proforma' : 'Invoice'}</div></div>
					<div class="detail-item"><div class="label">Source</div><div class="value">${source.icon} ${source.label}</div></div>
					<div class="detail-item"><div class="label">Date</div><div class="value">${new Date(invoice.date).toLocaleDateString()}</div></div>
					<div class="detail-item"><div class="label">${isProforma ? 'Valid Until' : 'Due Date'}</div><div class="value">${new Date(invoice.dueDate).toLocaleDateString()}</div></div>
				</div>
			</div>

			<div class="section">
				<div class="section-title">Customer Details</div>
				<div class="detail-grid">
					<div class="detail-item"><div class="label">Name</div><div class="value">${invoice.customerName || '-'}</div></div>
					<div class="detail-item"><div class="label">Email</div><div class="value">${invoice.customerEmail || '-'}</div></div>
					<div class="detail-item"><div class="label">Phone</div><div class="value">${invoice.customerPhone || '-'}</div></div>
					<div class="detail-item"><div class="label">ID</div><div class="value">${invoice.businessPartnerId || '-'}</div></div>
				</div>
			</div>

			${isProforma && (invoice.eventId || invoice.venue) ? `
			<div class="section">
				<div class="section-title">Event Details</div>
				<div class="detail-grid">
					${invoice.eventId ? `<div class="detail-item"><div class="label">Event ID</div><div class="value">${invoice.eventId}</div></div>` : ''}
					${invoice.checkIn ? `<div class="detail-item"><div class="label">Check-In</div><div class="value">${new Date(invoice.checkIn).toLocaleDateString()}</div></div>` : ''}
					${invoice.checkOut ? `<div class="detail-item"><div class="label">Check-Out</div><div class="value">${new Date(invoice.checkOut).toLocaleDateString()}</div></div>` : ''}
					${invoice.pax ? `<div class="detail-item"><div class="label">Pax</div><div class="value">${invoice.pax}</div></div>` : ''}
					${invoice.venue ? `<div class="detail-item"><div class="label">Venue</div><div class="value">${invoice.venue}</div></div>` : ''}
				</div>
			</div>
			` : ''}

			<div class="section">
				<div class="section-title">Financial Summary</div>
				<table>
					<tr><td style="width:70%">Subtotal</td><td class="amount">₵${Number(invoice.subtotal || 0).toLocaleString()}</td></tr>
					<tr><td>Tax</td><td class="amount">₵${Number(invoice.taxAmount || 0).toLocaleString()}</td></tr>
					<tr class="total-row"><td><strong>Total</strong></td><td class="amount"><strong>₵${Number(invoice.total || 0).toLocaleString()}</strong></td></tr>
					${!isProforma ? `
					<tr><td>Paid</td><td class="amount" style="color:#16a34a">₵${Number(invoice.paidAmount || 0).toLocaleString()}</td></tr>
					<tr><td><strong>Balance Due</strong></td><td class="amount" style="color:${balance > 0 ? '#ea580c' : '#16a34a'};font-weight:bold">₵${balance.toLocaleString()}</td></tr>
					` : ''}
				</table>
			</div>

			${!isProforma ? `
			<div class="section">
				<div class="section-title">Payment History</div>
				<table>
					<thead><tr><th>Receipt #</th><th>Date/Time</th><th>Method</th><th>Amount</th></tr></thead>
					<tbody>${receiptRows}</tbody>
				</table>
			</div>
			` : ''}

			<div class="section">
				<div class="section-title">Processed By</div>
				<div class="detail-grid">
					<div class="detail-item"><div class="label">Staff</div><div class="value">${invoice.staffName || 'System'}</div></div>
					<div class="detail-item"><div class="label">Role</div><div class="value">${invoice.staffRole || '-'}</div></div>
				</div>
			</div>
		`, `Generated on ${new Date().toLocaleString()}`);
		openPdfPreview(html);
	}, [getInvoiceReceipts]);

	// Print Individual Receipt (hotel template via folio/invoice picker context)
	const printReceiptPDF = useCallback(
		(receipt: StoredReceiptPayment) => {
			printCustomerReceiptForPayment(receipt);
		},
		[printCustomerReceiptForPayment],
	);

	// New invoice/proforma
	const openNewInvoice = (isProforma: boolean = false) => {
		setInvoiceForm({
			businessPartnerId: '',
			customerName: '',
			invoiceNumber: '',
			date: new Date().toISOString().slice(0, 10),
			dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
			description: '',
			subtotal: 0,
			taxAmount: 0,
			total: 0,
			isProforma: isProforma,
		});
		setFormError('');
		setIsNewInvoiceOpen(true);
	};

	const saveInvoice = () => {
		if (!invoiceForm.customerName?.trim()) { setFormError('Customer name is required'); return; }
		if (!invoiceForm.total || Number(invoiceForm.total) <= 0) { setFormError('Total must be greater than 0'); return; }
		
		const isProforma = invoiceForm.isProforma || false;
		const prefix = isProforma ? 'PRO' : 'INV';

		const subtotal = Number(invoiceForm.subtotal || invoiceForm.total);
		const invoiceId = `${prefix}-${Date.now()}`;

		// A customer typed by name with no existing business partner selected needs a real
		// BusinessPartner record — otherwise their running balance never appears anywhere
		// (addInvoice's balance update only touches an existing partner by id) even though the
		// invoice itself saves fine.
		let businessPartnerId = invoiceForm.businessPartnerId;
		if (!businessPartnerId) {
			businessPartnerId = `CUST-${Date.now()}`;
			const now = new Date().toISOString();
			addBusinessPartner({
				id: businessPartnerId,
				code: `CUST-${String(businessPartners.length + 1).padStart(4, '0')}`,
				name: invoiceForm.customerName.trim(),
				type: 'Customer',
				glAccountCode: '1200',
				currency: 'GHS',
				balance: 0,
				isActive: true,
				countryCode: 'GH',
				createdAt: now,
				updatedAt: now,
			});
		}

		const payload = {
			id: invoiceId,
			invoiceNumber: invoiceForm.invoiceNumber || `${prefix}-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`,
			type: 'Sales' as const,
			isProforma: isProforma,
			date: new Date(invoiceForm.date).toISOString(),
			dueDate: new Date(invoiceForm.dueDate).toISOString(),
			businessPartnerId,
			customerName: invoiceForm.customerName,
			description: invoiceForm.description || (isProforma ? 'Proforma invoice' : 'Sales invoice'),
			subtotal,
			taxAmount: Number(invoiceForm.taxAmount || 0),
			total: Number(invoiceForm.total),
			currency: 'GHS',
			status: isProforma ? 'Draft' as const : 'Posted' as const,
			paidAmount: 0,
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
			sourceModule: 'manual_ar_ap',
			staffName: 'Manual Entry',
			lines: isProforma
				? []
				: [{
					id: `IL-${Date.now()}`,
					invoiceId,
					description: invoiceForm.description || 'Sales revenue',
					quantity: 1,
					unitPrice: subtotal,
					amount: subtotal,
					taxAmount: Number(invoiceForm.taxAmount || 0),
					glAccountCode: '4300',
				}],
		};
		addInvoice(payload as any);
		setIsNewInvoiceOpen(false);
	};

	const mapReceiptMethodToFo = (
		method: string,
	): 'Cash' | 'Card' | 'Mobile Money' | 'Bank Transfer' | 'Check' => {
		switch (method) {
			case 'Bank':
			case 'Bank Transfer':
				return 'Bank Transfer';
			case 'Cheque':
			case 'Check':
				return 'Check';
			case 'Card':
				return 'Card';
			case 'Mobile Money':
				return 'Mobile Money';
			default:
				return 'Cash';
		}
	};

	const mapStoreMethodToUi = (method?: string) => {
		switch (method) {
			case 'Bank':
				return 'Bank';
			case 'Check':
				return 'Cheque';
			case 'Card':
				return 'Card';
			case 'Mobile Money':
				return 'Mobile Money';
			default:
				return 'Cash';
		}
	};

	// New / edit receipt — optional invoice (posted AR) or folio reservation (in-house guest)
	const openReceiptForm = (invoice?: any, folioReservationId?: string) => {
		setEditingReceiptId(null);
		if (folioReservationId) {
			const folioTarget = buildFolioReceiptTargets(foFolios, foReservations).find(
				(t) => t.id === folioReservationId,
			);
			const res = foReservations.find((r) => r.id === folioReservationId);
			setReceiptForm({
				targetKey: `folio:${folioReservationId}`,
				businessPartnerId: folioTarget?.businessPartnerId || res?.guestId || '',
				customerName: folioTarget?.customerName || res?.guestName || '',
				invoiceId: '',
				invoiceNumber: '',
				date: new Date().toISOString().slice(0, 10),
				amount: folioTarget?.balance ?? '',
				paymentMethod: 'Bank',
				bankAccountId: activeBankAccounts[0]?.id || '',
				checkNumber: '',
				reference: res
					? `In-house payment — ${res.guestName}${res.roomId ? ` Rm ${res.roomId}` : ''}`
					: '',
				notes: '',
				printAfterSave: true,
				paymentKind: 'standard',
				cashAmount: '',
				whtAmount: '',
				whtVatAmount: '',
				certificateNumber: '',
				withholdingAgentTIN: '',
				revenueCenterCode: folioTarget
					? suggestReceiptRevenueCenter(folioTarget)
					: 'RM',
			});
		} else {
			const settlement = invoice ? computeInvoiceWhtSettlement(invoice, taxConfigs) : null;
			const defaultAmount =
				invoice && settlement
					? settlement.whtTotalRemaining > 0
						? settlement.cashRemaining
						: settlement.balanceDue
					: '';
			setReceiptForm({
				targetKey: invoice?.id ? `invoice:${invoice.id}` : '',
				businessPartnerId: invoice?.businessPartnerId || '',
				customerName: invoice?.customerName || '',
				invoiceId: invoice?.id || '',
				invoiceNumber: invoice?.invoiceNumber || '',
				date: new Date().toISOString().slice(0, 10),
				amount: defaultAmount === '' ? '' : defaultAmount,
				paymentMethod: 'Bank',
				bankAccountId: activeBankAccounts[0]?.id || '',
				checkNumber: '',
				reference: invoice?.invoiceNumber ? `Payment for ${invoice.invoiceNumber}` : '',
				notes: '',
				printAfterSave: true,
				paymentKind: 'standard',
				cashAmount: '',
				whtAmount: '',
				whtVatAmount: '',
				certificateNumber: '',
				withholdingAgentTIN: '',
				revenueCenterCode: invoice
					? suggestReceiptRevenueCenter(
							{ kind: 'invoice', id: invoice.id } as ReceiptTarget,
							invoice,
						)
					: '',
			});
		}
		setFormError('');
		setIsNewReceiptOpen(true);
	};

	const openEditReceiptForm = (receipt: StoredReceiptPayment) => {
		if (!receiptCanEdit(receipt)) return;
		const linkedInv = receipt.invoiceId
			? salesInvoices.find((i: any) => i.id === receipt.invoiceId)
			: null;
		setEditingReceiptId(receipt.id);
		setReceiptForm({
			targetKey:
				receipt.receiptTargetKey ||
				(receipt.invoiceId
					? `invoice:${receipt.invoiceId}`
					: receipt.reservationId
						? `folio:${receipt.reservationId}`
						: ''),
			businessPartnerId: receipt.businessPartnerId || '',
			customerName: receipt.customerName || '',
			invoiceId: receipt.invoiceId || '',
			invoiceNumber: linkedInv?.invoiceNumber || '',
			date: (receipt.date || new Date().toISOString()).slice(0, 10),
			amount: receipt.amount,
			paymentMethod: mapStoreMethodToUi(receipt.paymentMethod),
			bankAccountId: receipt.bankAccountId || activeBankAccounts[0]?.id || '',
			checkNumber: receipt.checkNumber || '',
			reference: receipt.reference || '',
			notes: receipt.description || '',
			printAfterSave: false,
			paymentKind: 'standard',
			revenueCenterCode: receipt.revenueCenterCode || '',
		});
		setFormError('');
		setIsNewReceiptOpen(true);
	};

	const applyReceiptPaymentKind = (
		kind: 'standard' | 'wht_settlement' | 'wht_only',
		invoice?: any,
	) => {
		const inv = invoice || selectedReceiptInvoice;
		const settlement = inv ? computeInvoiceWhtSettlement(inv, taxConfigs) : null;
		if (kind === 'wht_settlement' && settlement) {
			setReceiptForm((f: any) => ({
				...f,
				paymentKind: kind,
				cashAmount: settlement.cashRemaining,
				whtAmount: settlement.whtRemaining,
				whtVatAmount: settlement.whtVatRemaining,
				amount: settlement.cashRemaining,
			}));
		} else if (kind === 'wht_only' && settlement) {
			setReceiptForm((f: any) => ({
				...f,
				paymentKind: kind,
				cashAmount: 0,
				whtAmount: settlement.whtRemaining,
				whtVatAmount: settlement.whtVatRemaining,
				amount: 0,
			}));
		} else {
			setReceiptForm((f: any) => ({
				...f,
				paymentKind: 'standard',
				cashAmount: '',
				whtAmount: '',
				whtVatAmount: '',
			}));
		}
	};

	const onReceiptPaymentKindChange = (kind: string | null) => {
		if (!kind || kind === 'standard') {
			applyReceiptPaymentKind('standard');
			return;
		}
		if (kind === 'wht_settlement' || kind === 'wht_only') {
			applyReceiptPaymentKind(kind);
		}
	};

	const openPrintReceiptModal = () => {
		setPrintForm({ targetKey: '', paymentId: '' });
		setFormError('');
		setIsPrintReceiptOpen(true);
	};

	const onPrintTargetSelect = (targetKey: string | null) => {
		if (!targetKey) {
			setPrintForm({ targetKey: '', paymentId: '' });
			return;
		}
		const target = receiptTargets.find((t) => t.key === targetKey);
		if (!target) return;
		const folio =
			target.kind === 'folio'
				? findMainFolio(foFolios, target.id)
				: null;
		const list = resolvePaymentsForReceiptTarget(
			target,
			receipts as StoredReceiptPayment[],
			folio,
		);
		setPrintForm({ targetKey, paymentId: list[0]?.id || '' });
	};

	const runPrintReceipt = () => {
		if (!selectedPrintTarget || !selectedPrintPayment) {
			setFormError('Select a folio or invoice that has at least one payment to print');
			return;
		}
		printCustomerReceiptForPayment(selectedPrintPayment, selectedPrintTarget);
		setIsPrintReceiptOpen(false);
	};

	const onReceiptCustomerSelect = (partnerId: string | null) => {
		if (!partnerId) {
			setReceiptForm((f: any) => ({
				...f,
				businessPartnerId: '',
				customerName: '',
				targetKey: '',
				invoiceId: '',
				invoiceNumber: '',
			}));
			return;
		}
		const partner = customers.find((c) => c.id === partnerId);
		setReceiptForm((f: any) => ({
			...f,
			businessPartnerId: partnerId,
			customerName: partner?.name || f.customerName,
			targetKey: '',
			invoiceId: '',
			invoiceNumber: '',
			amount: '',
		}));
	};

	const onReceiptTargetSelect = (targetKey: string | null) => {
		if (!targetKey) {
			setReceiptForm((f: any) => ({
				...f,
				targetKey: '',
				invoiceId: '',
				invoiceNumber: '',
				amount: '',
			}));
			return;
		}
		const target = receiptTargets.find((t) => t.key === targetKey);
		if (!target) return;

		if (target.kind === 'invoice') {
			const inv = salesInvoices.find((i: any) => i.id === target.id);
			if (!inv) return;
			const settlement = computeInvoiceWhtSettlement(inv, taxConfigs);
			const suggested =
				settlement.whtTotalRemaining > 0 ? settlement.cashRemaining : settlement.balanceDue;
			setReceiptForm((f: any) => ({
				...f,
				targetKey,
				invoiceId: inv.id,
				invoiceNumber: inv.invoiceNumber,
				businessPartnerId: inv.businessPartnerId,
				customerName: (inv as { customerName?: string }).customerName || inv.businessPartnerId,
				amount: suggested,
				paymentKind: 'standard',
				cashAmount: '',
				whtAmount: '',
				whtVatAmount: '',
				revenueCenterCode: suggestReceiptRevenueCenter(target, inv),
				reference: f.reference || `Payment for ${inv.invoiceNumber}`,
			}));
			return;
		}

		const res = foReservations.find((r) => r.id === target.id);
		setReceiptForm((f: any) => ({
			...f,
			targetKey,
			invoiceId: '',
			invoiceNumber: '',
			businessPartnerId: target.businessPartnerId || '',
			customerName: target.customerName,
			amount: target.balance,
			paymentKind: 'standard',
			cashAmount: '',
			whtAmount: '',
			whtVatAmount: '',
			revenueCenterCode: suggestReceiptRevenueCenter(target),
			reference:
				f.reference ||
				`In-house payment — ${target.customerName}${res?.roomId ? ` Rm ${res.roomId}` : ''}`,
		}));
	};

	const fillReceiptFullBalance = () => {
		if (selectedReceiptTarget) {
			const amt =
				selectedReceiptTarget.kind === 'invoice' &&
				receiptWhtSettlement &&
				receiptWhtSettlement.whtTotalRemaining > 0
					? receiptWhtSettlement.cashRemaining
					: receiptBalanceDue;
			setReceiptForm((f: any) => ({ ...f, amount: amt }));
			return;
		}
		if (!selectedReceiptInvoice) return;
		const amt =
			receiptWhtSettlement && receiptWhtSettlement.whtTotalRemaining > 0
				? receiptWhtSettlement.cashRemaining
				: receiptBalanceDue;
		setReceiptForm((f: any) => ({ ...f, amount: amt }));
	};

	const saveReceipt = () => {
		const amount = roundMoney2(Number(receiptForm.amount || 0));
		const targetParsed = receiptForm.targetKey
			? parseReceiptTargetKey(receiptForm.targetKey)
			: null;
		const editingReceipt = editingReceiptId
			? (payments.find((p) => p.id === editingReceiptId) as StoredReceiptPayment | undefined)
			: undefined;

		if (!receiptForm.customerName?.trim() && !receiptForm.businessPartnerId) {
			setFormError('Select or enter a customer');
			return;
		}

		const descParts = [
			receiptForm.reference?.trim(),
			receiptForm.notes?.trim(),
		].filter(Boolean);

		const isWhtReceipt =
			!editingReceipt &&
			receiptForm.paymentKind !== 'standard' &&
			selectedReceiptTarget?.kind === 'invoice' &&
			selectedReceiptInvoice?.id;

		if (isWhtReceipt) {
			const cash = roundMoney2(Number(receiptForm.cashAmount || 0));
			const wht = roundMoney2(Number(receiptForm.whtAmount || 0));
			const whtVat = roundMoney2(Number(receiptForm.whtVatAmount || 0));
			if (cash <= 0 && wht <= 0 && whtVat <= 0) {
				setFormError('Enter cash and/or WHT amounts');
				return;
			}
			if (receiptForm.paymentKind === 'wht_settlement' && cash <= 0) {
				setFormError('Enter net cash received');
				return;
			}
			if (receiptForm.paymentKind === 'wht_only' && wht + whtVat <= 0) {
				setFormError('Enter WHT certificate amounts');
				return;
			}
			const balanceDue = roundMoney2(
				selectedReceiptInvoice.total - (selectedReceiptInvoice.paidAmount || 0),
			);
			const totalEntered = roundMoney2(cash + wht + whtVat);
			if (totalEntered > balanceDue + 0.01) {
				setFormError(
					`Total (₵${totalEntered.toLocaleString()}) exceeds balance due (₵${balanceDue.toLocaleString()})`,
				);
				return;
			}
			if (
				cash > 0 &&
				receiptNeedsBankAccount &&
				activeBankAccounts.length > 0 &&
				!receiptForm.bankAccountId
			) {
				setFormError('Select the bank account that received this payment');
				return;
			}

			const result = recordWHTPayment({
				invoiceId: selectedReceiptInvoice.id,
				cashAmount: cash,
				whtAmount: wht,
				whtVatAmount: whtVat,
				paymentMethod: (() => {
					const m = mapUiPaymentMethodToStore(receiptForm.paymentMethod || 'Cash');
					return m === 'WHT Certificate' ? 'Bank' : m;
				})(),
				bankAccountId: receiptForm.bankAccountId || undefined,
				certificateNumber: receiptForm.certificateNumber?.trim() || undefined,
				withholdingAgentTIN: receiptForm.withholdingAgentTIN?.trim() || undefined,
				revenueCenterCode: receiptForm.revenueCenterCode?.trim() || undefined,
				staffName: 'Manual Entry',
				staffId: 'MANUAL',
			});
			if (!result) {
				setFormError(useAccountingStore.getState().error || 'Failed to record WHT payment');
				return;
			}
			setIsNewReceiptOpen(false);
			if (receiptForm.printAfterSave && result.receiptId) {
				const saved = useAccountingStore
					.getState()
					.payments.find((p) => p.id === result.receiptId);
				if (saved) printCustomerReceiptForPayment(saved as StoredReceiptPayment, selectedReceiptTarget);
			}
			handleRefresh();
			return;
		}

		if (amount <= 0) {
			setFormError('Amount must be greater than 0');
			return;
		}

		if (editingReceipt) {
			if (editingReceipt.journalEntryId && Math.abs(amount - editingReceipt.amount) > 0.009) {
				setFormError('Cannot change amount after GL posting — void this receipt and record a new one.');
				return;
			}
			if (receiptNeedsBankAccount && activeBankAccounts.length > 0 && !receiptForm.bankAccountId) {
				setFormError('Select the bank account that received this payment');
				return;
			}
			if (receiptForm.paymentMethod === 'Cheque' && !receiptForm.checkNumber?.trim()) {
				setFormError('Enter cheque number');
				return;
			}

			const delta = roundMoney2(amount - editingReceipt.amount);
			if (editingReceipt.invoiceId && Math.abs(delta) > 0.009) {
				const inv = salesInvoices.find((i: any) => i.id === editingReceipt.invoiceId);
				if (inv) {
					const newPaid = roundMoney2(Math.max(0, (inv.paidAmount || 0) + delta));
					if (newPaid > inv.total + 0.01) {
						setFormError('Updated amount would overpay the linked invoice');
						return;
					}
					updateInvoice(editingReceipt.invoiceId, {
						paidAmount: newPaid,
						status: newPaid >= inv.total ? 'Paid' : 'Posted',
						updatedAt: new Date().toISOString(),
					});
				}
			}

			if (
				editingReceipt.sourceModule === FRONT_OFFICE_FOLIO_RECEIPT_SOURCE &&
				editingReceipt.reservationId &&
				editingReceipt.folioPaymentId
			) {
				frontOfficeStore.updateFolioPayment(
					editingReceipt.reservationId,
					editingReceipt.folioPaymentId,
					{
						amount,
						method: mapReceiptMethodToFo(receiptForm.paymentMethod || 'Cash'),
						notes: descParts.join(' — ') || undefined,
						ref: receiptForm.reference?.trim() || undefined,
					},
				);
			}

			updatePayment(editingReceipt.id, {
				amount,
				date: new Date(receiptForm.date).toISOString(),
				paymentMethod: mapUiPaymentMethodToStore(receiptForm.paymentMethod || 'Cash'),
				bankAccountId: receiptForm.bankAccountId || undefined,
				checkNumber: receiptForm.checkNumber?.trim() || undefined,
				reference: receiptForm.reference?.trim() || undefined,
				description: descParts.join(' — ') || editingReceipt.description,
				customerName: receiptForm.customerName?.trim() || editingReceipt.customerName,
				revenueCenterCode: receiptForm.revenueCenterCode?.trim() || undefined,
				updatedAt: new Date().toISOString(),
			});

			setEditingReceiptId(null);
			setIsNewReceiptOpen(false);
			handleRefresh();
			return;
		}

		if (selectedReceiptTarget && amount > receiptBalanceDue + 0.01) {
			setFormError(`Amount cannot exceed balance due (₵${receiptBalanceDue.toLocaleString()})`);
			return;
		}
		if (receiptNeedsBankAccount && activeBankAccounts.length > 0 && !receiptForm.bankAccountId) {
			setFormError('Select the bank account that received this payment');
			return;
		}
		if (receiptForm.paymentMethod === 'Cheque' && !receiptForm.checkNumber?.trim()) {
			setFormError('Enter cheque number');
			return;
		}

		if (targetParsed?.kind === 'folio') {
			const folioPayment = frontOfficeStore.addPayment(
				targetParsed.id,
				mapReceiptMethodToFo(receiptForm.paymentMethod || 'Cash'),
				amount,
				{
					notes: descParts.join(' — ') || undefined,
					ref: receiptForm.reference?.trim() || undefined,
					processedBy: 'Finance AR',
				},
			);
			const paymentNumber = settings.getNextReceiptNumber();
			const mirrorPayload: StoredReceiptPayment = {
				id: `RCP-FO-${folioPayment.id}`,
				paymentNumber,
				date: new Date(receiptForm.date).toISOString(),
				type: 'Receipt',
				businessPartnerId:
					receiptForm.businessPartnerId ||
					selectedReceiptTarget?.businessPartnerId ||
					targetParsed.id,
				customerName:
					receiptForm.customerName?.trim() || selectedReceiptTarget?.customerName || 'Guest',
				description: descParts.join(' — ') || 'In-house folio payment',
				amount,
				currency: 'GHS',
				paymentMethod: mapUiPaymentMethodToStore(receiptForm.paymentMethod || 'Cash'),
				bankAccountId: receiptForm.bankAccountId || undefined,
				checkNumber: receiptForm.checkNumber?.trim() || undefined,
				reference: receiptForm.reference?.trim() || undefined,
				status: 'Posted',
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
				sourceModule: FRONT_OFFICE_FOLIO_RECEIPT_SOURCE,
				staffName: 'Finance AR',
				reservationId: targetParsed.id,
				folioPaymentId: folioPayment.id,
				receiptTargetKey: receiptForm.targetKey,
				revenueCenterCode: receiptForm.revenueCenterCode?.trim() || undefined,
			};
			addPayment(mirrorPayload as any);
			setIsNewReceiptOpen(false);
			if (receiptForm.printAfterSave) {
				printCustomerReceiptForPayment(mirrorPayload, selectedReceiptTarget);
			}
			handleRefresh();
			return;
		}

		const payload: StoredReceiptPayment = {
			id: `RCP-${Date.now()}`,
			paymentNumber: `RCP-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`,
			date: new Date(receiptForm.date).toISOString(),
			type: 'Receipt' as const,
			businessPartnerId: receiptForm.businessPartnerId || `CUST-${Date.now()}`,
			customerName: receiptForm.customerName?.trim() || 'Customer',
			invoiceId: receiptForm.invoiceId || undefined,
			receiptTargetKey:
				receiptForm.targetKey ||
				(receiptForm.invoiceId ? `invoice:${receiptForm.invoiceId}` : undefined),
			description: descParts.join(' — ') || 'Customer receipt',
			amount,
			currency: 'GHS',
			paymentMethod: mapUiPaymentMethodToStore(receiptForm.paymentMethod || 'Cash'),
			bankAccountId: receiptForm.bankAccountId || undefined,
			checkNumber: receiptForm.checkNumber?.trim() || undefined,
			reference: receiptForm.reference?.trim() || receiptForm.invoiceNumber || undefined,
			status: 'Posted' as const,
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
			sourceModule: 'manual_ar_ap',
			staffName: 'Manual Entry',
			revenueCenterCode: receiptForm.revenueCenterCode?.trim() || undefined,
		};
		addPayment(payload as any);
		setIsNewReceiptOpen(false);
		if (receiptForm.printAfterSave) {
			printCustomerReceiptForPayment(payload, selectedReceiptTarget);
		}
		handleRefresh();
	};

	// Open WHT Payment Modal (from an invoice)
	const openWHTPayment = (invoice: any, mode: 'settlement' | 'wht_only' = 'settlement') => {
		const settlement = computeInvoiceWhtSettlement(invoice, taxConfigs);
		if (settlement.balanceDue <= 0) {
			setFormError('Invoice has no balance due');
			return;
		}
		if (mode === 'wht_only' && settlement.whtTotalRemaining <= 0) {
			setFormError('No WHT remainder on this invoice — use Record Receipt for cash payments');
			return;
		}

		const cashAmount = mode === 'wht_only' ? 0 : settlement.cashRemaining;
		const whtAmount = settlement.whtRemaining;
		const whtVatAmount = settlement.whtVatRemaining;

		setWhtPaymentMode(mode);
		setWHTPaymentForm({
			invoiceId: invoice.id,
			invoiceNumber: invoice.invoiceNumber,
			invoiceTotal: invoice.total,
			balanceDue: settlement.balanceDue,
			customerName: invoice.customerName || invoice.businessPartnerId,
			cashAmount,
			whtAmount,
			whtVatAmount,
			paymentMethod: 'Bank',
			certificateNumber: '',
			withholdingAgentTIN: '',
		});
		setFormError('');
		setIsWHTPaymentOpen(true);
	};

	// Convert proforma → sales invoice (+ GL post)
	const handleConvertProforma = async (inv: any, e?: React.MouseEvent) => {
		e?.stopPropagation();
		const src = inv.sourceModule || 'manual_ar_ap';
		if (src === 'manual_ar_ap' || src === 'manual') {
			const newNumber = (inv.invoiceNumber || '').replace(/^PRO-/, 'INV-') || `INV-${Date.now()}`;
			const subtotal = Number(inv.subtotal || inv.total);
			updateInvoice(inv.id, {
				isProforma: false,
				status: 'Posted',
				invoiceNumber: newNumber,
				...(inv.lines?.length
					? {}
					: {
						lines: [{
							id: `IL-${Date.now()}`,
							invoiceId: inv.id,
							description: inv.description || 'Sales revenue',
							quantity: 1,
							unitPrice: subtotal,
							amount: subtotal,
							taxAmount: Number(inv.taxAmount || 0),
							glAccountCode: '4300',
						}],
					}),
			});
			await postInvoice(inv.id);
		} else {
			convertProformaToInvoice(inv.id);
		}
		setIsDetailOpen(false);
		handleRefresh();
	};

	// Save WHT Payment
	const saveWHTPayment = () => {
		if (!whtPaymentForm.invoiceId) { setFormError('No invoice selected'); return; }
		if (!whtPaymentForm.cashAmount && !whtPaymentForm.whtAmount && !whtPaymentForm.whtVatAmount) {
			setFormError('Enter cash and/or WHT amounts'); return;
		}

		const invoice = invoices.find((i) => i.id === whtPaymentForm.invoiceId);
		const balanceDue = invoice ? roundMoney2(invoice.total - (invoice.paidAmount || 0)) : 0;
		const totalEntered = roundMoney2(
			Number(whtPaymentForm.cashAmount || 0) +
			Number(whtPaymentForm.whtAmount || 0) +
			Number(whtPaymentForm.whtVatAmount || 0),
		);
		if (totalEntered > balanceDue + 0.01) {
			setFormError(`Total (₵${totalEntered.toLocaleString()}) exceeds balance due (₵${balanceDue.toLocaleString()})`);
			return;
		}

		const result = recordWHTPayment({
			invoiceId: whtPaymentForm.invoiceId,
			cashAmount: Number(whtPaymentForm.cashAmount || 0),
			whtAmount: Number(whtPaymentForm.whtAmount || 0),
			whtVatAmount: Number(whtPaymentForm.whtVatAmount || 0),
			paymentMethod: whtPaymentForm.paymentMethod as any,
			bankAccountId: whtPaymentForm.paymentMethod === 'Bank' ? (whtPaymentForm.bankAccountId || undefined) : undefined,
			certificateNumber: whtPaymentForm.certificateNumber || undefined,
			withholdingAgentTIN: whtPaymentForm.withholdingAgentTIN || undefined,
			staffName: 'Manual Entry',
			staffId: 'MANUAL',
		});

		if (result) {
			console.log('[AR] ✅ WHT Payment recorded:', result);
			setIsWHTPaymentOpen(false);
			handleRefresh();
		} else {
			setFormError('Failed to record payment');
		}
	};

	// Open WHT Certificate Detail
	const openWHTDetail = (cert: any) => {
		setSelectedWHTCert(cert);
		setReceiveCertForm({
			certificateNumber: cert.certificateNumber?.startsWith('PENDING-') ? '' : (cert.certificateNumber || ''),
			withholdingAgentTIN: cert.withholdingAgentTIN || '',
		});
		setIsWHTDetailOpen(true);
	};

	const saveReceiveWHTCertificate = () => {
		if (!selectedWHTCert?.id) return;
		if (!receiveCertForm.certificateNumber.trim()) {
			setFormError('Enter the GRA certificate number');
			return;
		}
		const ok = receiveWHTCertificate(selectedWHTCert.id, {
			certificateNumber: receiveCertForm.certificateNumber.trim(),
			withholdingAgentTIN: receiveCertForm.withholdingAgentTIN.trim() || undefined,
		});
		if (ok) {
			setFormError('');
			setIsWHTDetailOpen(false);
			handleRefresh();
		} else {
			setFormError('Could not save certificate details');
		}
	};

	// Verify WHT Certificate (mark as received/verified)
	const verifyWHTCertificate = (certId: string) => {
		const cert = whtCertificates?.find((c: any) => c.id === certId);
		if (cert?.status === 'Pending') {
			setFormError('Receive the GRA certificate number first');
			return;
		}
		updateWHTCertificate(certId, {
			status: 'Verified',
			verifiedBy: 'Manual Entry',
			verifiedDate: new Date().toISOString(),
		});
		handleRefresh();
	};

	const handleVoidInvoice = async (inv: any) => {
		const activePay = payments.filter((p) => p.invoiceId === inv.id && p.status !== 'Void');
		if (activePay.length > 0) {
			setFormError('Void all receipts and WHT payments on this invoice first');
			return;
		}
		if (!window.confirm(`Void invoice ${inv.invoiceNumber}? A reversing GL entry will be posted.`)) return;
		await voidInvoice(inv.id);
		const err = useAccountingStore.getState().error;
		if (err) {
			setFormError(err);
			return;
		}
		setIsDetailOpen(false);
		handleRefresh();
	};

	const handleVoidReceipt = async (receipt: StoredReceiptPayment) => {
		if (receipt.status === 'Void') return;
		if (!receiptCanVoid(receipt)) {
			setFormError('Only manual or in-house folio receipts can be voided from here');
			return;
		}
		const isFolio = receipt.sourceModule === FRONT_OFFICE_FOLIO_RECEIPT_SOURCE;
		const msg = isFolio
			? `Void receipt ${receipt.paymentNumber || receipt.id}? This removes the payment from the guest folio.`
			: `Void receipt ${receipt.paymentNumber || receipt.id}? This reverses GL and reopens invoice balance.`;
		if (!window.confirm(msg)) return;

		if (isFolio && receipt.reservationId && receipt.folioPaymentId) {
			frontOfficeStore.removeFolioPayment(receipt.reservationId, receipt.folioPaymentId);
		}

		await voidPayment(receipt.id);
		const err = useAccountingStore.getState().error;
		if (err) {
			setFormError(err);
			return;
		}
		setIsReceiptDetailOpen(false);
		handleRefresh();
	};

	// Render filter bar
	const renderFilters = (showStatus: boolean = true) => (
		<div className="flex flex-wrap items-end gap-3 mb-4">
			<Input label="Search" placeholder="Invoice #, customer..." value={searchQuery} onValueChange={setSearchQuery} className="w-56" size="sm" />
			{showStatus && (
				<Select label="Status" selectedKeys={[statusFilter]} onSelectionChange={(s: any) => setStatusFilter(Array.from(s)[0] as string)} className="w-36" size="sm">
					<SelectItem key="all">All</SelectItem>
					<SelectItem key="paid">Paid</SelectItem>
					<SelectItem key="unpaid">Unpaid</SelectItem>
					<SelectItem key="overdue">Overdue</SelectItem>
				</Select>
			)}
			<Select label="Source" selectedKeys={[sourceFilter]} onSelectionChange={(s: any) => setSourceFilter(Array.from(s)[0] as string)} className="w-44" size="sm">
				<SelectItem key="all">All Sources</SelectItem>
				<SelectItem key="front_office">🏨 Front Office</SelectItem>
				<SelectItem key="restaurant">🍽️ Restaurant</SelectItem>
				<SelectItem key="bar">🍺 Bar</SelectItem>
				<SelectItem key="room_service">🛎️ Room Service</SelectItem>
				<SelectItem key="conference">📅 Conference</SelectItem>
				<SelectItem key="manual">📝 Manual</SelectItem>
			</Select>
			<Input type="date" label="From" value={dateFrom} onValueChange={setDateFrom} className="w-36" size="sm" />
			<Input type="date" label="To" value={dateTo} onValueChange={setDateTo} className="w-36" size="sm" />
		</div>
	);

	// Render sales invoice table
	const renderSalesInvoiceTable = (invoiceList: any[]) => {
		const pages = Math.ceil(invoiceList.length / rowsPerPage);
		const paginatedData = getPaginatedData(invoiceList, page);

		return (
			<>
				<Table aria-label="Sales invoices">
					<TableHeader>
						<TableColumn>INVOICE #</TableColumn>
						<TableColumn>SOURCE</TableColumn>
						<TableColumn>CUSTOMER</TableColumn>
						<TableColumn>DATE</TableColumn>
						<TableColumn>DUE DATE</TableColumn>
						<TableColumn>STAFF</TableColumn>
						<TableColumn align="end">TOTAL</TableColumn>
						<TableColumn align="end">PAID</TableColumn>
						<TableColumn align="end">BALANCE</TableColumn>
						<TableColumn>STATUS</TableColumn>
						<TableColumn>WHT</TableColumn>
						<TableColumn>GL</TableColumn>
						<TableColumn>ACTIONS</TableColumn>
					</TableHeader>
					<TableBody emptyContent="No sales invoices found.">
						{paginatedData.map((inv: any) => {
							const source = getSourceLabel(inv.sourceModule);
							const glChip = getGlSyncChip('invoice', inv);
							const balance = (inv.total || 0) - (inv.paidAmount || 0);
							const settlement = computeInvoiceWhtSettlement(inv, taxConfigs);
							const hasPendingWhtCert = (whtCertificates || []).some(
								(c: any) => c.invoiceId === inv.id && c.status === 'Pending',
							);
							const isOverdue = balance > 0 && new Date(inv.dueDate) < new Date();
							return (
								<TableRow key={inv.id} className="cursor-pointer hover:bg-gray-50" onClick={() => openInvoiceDetail(inv)}>
									<TableCell>
										<span className="font-mono text-sm text-blue-600 hover:underline">{inv.invoiceNumber || inv.id}</span>
									</TableCell>
									<TableCell>
										<Chip size="sm" color={source.color} variant="flat">{source.icon} {source.label}</Chip>
									</TableCell>
									<TableCell>
										<div className="font-medium">{inv.customerName || inv.businessPartnerId}</div>
										<div className="text-xs text-gray-500 truncate max-w-xs">{inv.description}</div>
									</TableCell>
									<TableCell>{new Date(inv.date).toLocaleDateString()}</TableCell>
									<TableCell className={isOverdue ? 'text-red-600' : ''}>{new Date(inv.dueDate).toLocaleDateString()}</TableCell>
									<TableCell>
										<div className="text-sm">{inv.staffName || '-'}</div>
										<div className="text-xs text-gray-500">{inv.staffRole || ''}</div>
									</TableCell>
									<TableCell className="text-right font-medium">₵{Number(inv.total || 0).toLocaleString()}</TableCell>
									<TableCell className="text-right text-green-600">₵{Number(inv.paidAmount || 0).toLocaleString()}</TableCell>
									<TableCell className="text-right text-orange-600 font-medium">₵{balance.toLocaleString()}</TableCell>
									<TableCell>
										<Chip size="sm" color={balance === 0 ? 'success' : isOverdue ? 'danger' : 'warning'} variant="flat">
											{balance === 0 ? 'Paid' : isOverdue ? 'Overdue' : 'Open'}
										</Chip>
									</TableCell>
									<TableCell onClick={(e) => e.stopPropagation()}>
										{inv.whtStatus === 'Pending' || hasPendingWhtCert ? (
											<Chip size="sm" color="warning" variant="flat">Cert pending</Chip>
										) : inv.whtStatus === 'Complete' ? (
											<Chip size="sm" color="success" variant="flat">WHT ✓</Chip>
										) : settlement.whtTotalRemaining > 0 && balance > 0 ? (
											<Chip size="sm" color="default" variant="flat">WHT due</Chip>
										) : (
											<span className="text-xs text-gray-400">—</span>
										)}
									</TableCell>
									<TableCell>
										{glChip ? (
											<Chip size="sm" color={glChip.color as any} variant="flat">{glChip.label}</Chip>
										) : (
											<span className="text-xs text-gray-400">—</span>
										)}
									</TableCell>
									<TableCell onClick={(e) => e.stopPropagation()}>
										{balance > 0 && (
											<Dropdown>
												<DropdownTrigger>
													<Button size="sm" variant="flat">Actions</Button>
												</DropdownTrigger>
												<DropdownMenu aria-label="Invoice actions">
													<DropdownItem
														key="receipt"
														onPress={() => openReceiptForm(inv)}
													>
														➕ Record receipt
													</DropdownItem>
													<DropdownItem
														key="wht-settle"
														onPress={() => openWHTPayment(inv, 'settlement')}
													>
														💰 Payment + WHT (cert later OK)
													</DropdownItem>
													{settlement.whtTotalRemaining > 0 ? (
														<DropdownItem
															key="wht-only"
															onPress={() => openWHTPayment(inv, 'wht_only')}
														>
															📜 WHT only (cash already received)
														</DropdownItem>
													) : null}
													<DropdownItem key="view" onPress={() => openInvoiceDetail(inv)}>
														🧾 View invoice
													</DropdownItem>
												</DropdownMenu>
											</Dropdown>
										)}
									</TableCell>
								</TableRow>
							);
						})}
					</TableBody>
				</Table>
				{pages > 1 && (
					<div className="flex justify-center mt-4">
						<Pagination total={pages} page={page} onChange={setPage} />
					</div>
				)}
			</>
		);
	};

	// Render proforma invoice table with event details
	const renderProformaTable = (proformaList: any[]) => {
		const pages = Math.ceil(proformaList.length / rowsPerPage);
		const paginatedData = getPaginatedData(proformaList, page);

		return (
			<>
				<Table aria-label="Proforma invoices">
					<TableHeader>
						<TableColumn>PROFORMA #</TableColumn>
						<TableColumn>SOURCE</TableColumn>
						<TableColumn>CLIENT</TableColumn>
						<TableColumn>EVENT/BOOKING</TableColumn>
						<TableColumn>DATES</TableColumn>
						<TableColumn>PAX</TableColumn>
						<TableColumn>VENUE</TableColumn>
						<TableColumn align="end">AMOUNT</TableColumn>
						<TableColumn>VALID UNTIL</TableColumn>
						<TableColumn>STATUS</TableColumn>
						<TableColumn>ACTIONS</TableColumn>
					</TableHeader>
					<TableBody emptyContent="No proforma invoices found. Generate a quote from Events & Conferences to create proformas.">
						{paginatedData.map((inv: any) => {
							const source = getSourceLabel(inv.sourceModule);
							const isExpired = new Date(inv.dueDate) < new Date();
							return (
								<TableRow key={inv.id} className="cursor-pointer hover:bg-gray-50" onClick={() => openInvoiceDetail(inv)}>
									<TableCell>
										<span className="font-mono text-sm text-purple-600 hover:underline">{inv.invoiceNumber || inv.id}</span>
									</TableCell>
									<TableCell>
										<Chip size="sm" color={source.color} variant="flat">{source.icon} {source.label}</Chip>
									</TableCell>
									<TableCell>
										<div className="font-medium">{inv.customerName || inv.businessPartnerId}</div>
										<div className="text-xs text-gray-500">{inv.customerEmail || inv.customerPhone || '-'}</div>
									</TableCell>
									<TableCell>
										<div className="font-medium text-sm">{inv.description?.split(' - ')[0] || 'Event'}</div>
										{inv.eventId && <div className="text-xs text-gray-500 font-mono">{inv.eventId}</div>}
									</TableCell>
									<TableCell>
										{inv.checkIn ? (
											<div className="text-xs">
												<div>{new Date(inv.checkIn).toLocaleDateString()}</div>
												{inv.checkOut && <div className="text-gray-500">→ {new Date(inv.checkOut).toLocaleDateString()}</div>}
											</div>
										) : (
											<span className="text-gray-400">-</span>
										)}
									</TableCell>
									<TableCell>
										{inv.pax ? (
											<Chip size="sm" variant="flat">{inv.pax} pax</Chip>
										) : (
											<span className="text-gray-400">-</span>
										)}
									</TableCell>
									<TableCell>
										<div className="text-sm truncate max-w-[120px]">{inv.venue || '-'}</div>
									</TableCell>
									<TableCell className="text-right font-bold text-purple-700">₵{Number(inv.total || 0).toLocaleString()}</TableCell>
									<TableCell className={isExpired ? 'text-red-600' : 'text-gray-600'}>
										{new Date(inv.dueDate).toLocaleDateString()}
									</TableCell>
									<TableCell>
										<Chip size="sm" color={isExpired ? 'danger' : 'secondary'} variant="flat">
											{isExpired ? '⏰ Expired' : '📋 Active'}
										</Chip>
									</TableCell>
									<TableCell>
										<Button
											size="sm"
											color="primary"
											variant="flat"
											onPress={() => handleConvertProforma(inv)}
										>
											Convert to invoice
										</Button>
									</TableCell>
								</TableRow>
							);
						})}
					</TableBody>
				</Table>
				{pages > 1 && (
					<div className="flex justify-center mt-4">
						<Pagination total={pages} page={page} onChange={setPage} />
					</div>
				)}
			</>
		);
	};

	// Show loading state only on first bootstrap (avoid spinner loop on refresh)
	if (isLoading && invoices.length === 0 && payments.length === 0) {
		return (
			<div className="p-6 flex items-center justify-center min-h-[400px]">
				<div className="text-center">
					<div className="animate-spin text-4xl mb-4">⏳</div>
					<p className="text-gray-600">Loading Accounts Receivable...</p>
				</div>
			</div>
		);
    }

	return (
		<div className="p-6" key={refreshKey}>
			<div className="mb-6 flex justify-between items-start">
				<div>
				<h1 className="text-3xl font-bold text-gray-900">🧾 Accounts Receivable</h1>
					<p className="text-gray-600 mt-2 inline-flex items-center gap-1.5 flex-wrap">
						Manage customer accounts, sales invoices, proformas, and receipts
						<InfoTip label="Official finance AR">
							<div className="space-y-2">
								<p className="font-semibold">Official finance AR</p>
								<p>
									Aging and outstanding on this screen come from the <strong>accounting subledger</strong>{' '}
									(posted invoices + GL).
								</p>
								<p>In-house guest folios are operational only until checkout posts here.</p>
								<p className="text-default-500 text-xs">API: /api/accounting/receivables/aging</p>
							</div>
						</InfoTip>
					</p>
				</div>
				<div className="flex gap-2">
					<Button 
						variant="flat" 
						size="sm" 
						onClick={handleRefresh}
						isLoading={isRefreshing}
						startContent={!isRefreshing && <span>🔄</span>}
					>
						{isRefreshing ? 'Refreshing...' : 'Refresh'}
					</Button>
					<Chip size="sm" variant="flat" color="default">
						Last updated: {new Date().toLocaleTimeString()}
					</Chip>
				</div>
			</div>

			{/* Summary Cards */}
			<div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
				<Card>
					<CardBody className="text-center py-4">
						<div className="text-2xl font-bold text-blue-600">₵{totalRevenue.toLocaleString()}</div>
						<div className="text-sm text-gray-600">Total Invoiced</div>
						<div className="text-xs text-gray-400 mt-1">{salesInvoices.length} invoices</div>
					</CardBody>
				</Card>
				<Card>
					<CardBody className="text-center py-4">
						<div className="text-2xl font-bold text-orange-600">₵{totalOutstanding.toLocaleString()}</div>
						<div className="text-sm text-gray-600">Outstanding AR</div>
						<Progress value={totalRevenue > 0 ? (totalOutstanding / totalRevenue) * 100 : 0} size="sm" color="warning" className="mt-2" />
					</CardBody>
				</Card>
				<Card>
					<CardBody className="text-center py-4">
						<div className="text-2xl font-bold text-green-600">₵{totalReceived.toLocaleString()}</div>
						<div className="text-sm text-gray-600">Total Receipts</div>
						<div className="text-xs text-gray-400 mt-1">{receipts.length} receipts</div>
					</CardBody>
				</Card>
				<Card>
					<CardBody className="text-center py-4">
						<div className="text-2xl font-bold text-purple-600">₵{totalProforma.toLocaleString()}</div>
						<div className="text-sm text-gray-600">Proformas</div>
						<div className="text-xs text-gray-400 mt-1">{proformaInvoices.length} proformas</div>
					</CardBody>
				</Card>
				<Card>
					<CardBody className="text-center py-4">
						<div className="text-2xl font-bold text-amber-600">₵{totalWHTReceivable.toLocaleString()}</div>
						<div className="text-sm text-gray-600">WHT Credits</div>
						<div className="text-xs text-gray-400 mt-1">{whtCertificates?.length || 0} certificates</div>
					</CardBody>
				</Card>
				<Card>
					<CardBody className="text-center py-4">
						<div className="text-2xl font-bold text-emerald-600">{customerAging.length}</div>
						<div className="text-sm text-gray-600">Active Customers</div>
						<Progress value={100} size="sm" color="success" className="mt-2" />
					</CardBody>
				</Card>
			</div>

			{/* Main Tabs */}
			<Card>
				<CardBody className="p-0">
					<Tabs selectedKey={selectedTab} onSelectionChange={(k) => { setSelectedTab(k as string); setPage(1); }} className="w-full">
						
						{/* Overview Tab */}
						<Tab key="overview" title="📊 Overview & Aging">
							<div className="p-6">
								<div className="flex justify-between items-center mb-4">
									<h3 className="text-lg font-semibold">Customer Balance & Aging Analysis</h3>
									<div className="flex items-center gap-2">
										<Chip color="primary" variant="flat">{customerAging.length} customers</Chip>
										<Dropdown>
											<DropdownTrigger>
												<Button variant="flat" size="sm">📥 Export</Button>
											</DropdownTrigger>
											<DropdownMenu>
												<DropdownItem key="csv" onPress={exportAgingCSV}>📄 Download CSV</DropdownItem>
												<DropdownItem key="pdf" onPress={printAgingPDF}>📑 Print PDF</DropdownItem>
											</DropdownMenu>
										</Dropdown>
								</div>
								</div>
								<Table aria-label="Customer aging">
									<TableHeader>
										<TableColumn>CUSTOMER</TableColumn>
										<TableColumn>SOURCE</TableColumn>
										<TableColumn align="end">INVOICED</TableColumn>
										<TableColumn align="end">PAID</TableColumn>
										<TableColumn align="end">BALANCE</TableColumn>
										<TableColumn align="end">CURRENT</TableColumn>
										<TableColumn align="end">1-30 DAYS</TableColumn>
										<TableColumn align="end">31-60 DAYS</TableColumn>
										<TableColumn align="end">61-90 DAYS</TableColumn>
										<TableColumn align="end">90+ DAYS</TableColumn>
									</TableHeader>
									<TableBody emptyContent="No customer data.">
										{customerAging.map((c: any) => {
											const source = getSourceLabel(c.source);
											return (
												<TableRow key={c.customerId}>
												<TableCell>
														<div className="font-medium">{c.customerName}</div>
														<div className="text-xs text-gray-500">{c.invoiceCount} invoices</div>
												</TableCell>
													<TableCell>
														<Chip size="sm" color={source.color} variant="flat">{source.icon}</Chip>
													</TableCell>
													<TableCell className="text-right">₵{c.totalInvoiced.toLocaleString()}</TableCell>
													<TableCell className="text-right text-green-600">₵{c.totalPaid.toLocaleString()}</TableCell>
													<TableCell className="text-right font-bold">₵{c.balance.toLocaleString()}</TableCell>
													<TableCell className="text-right">{c.current > 0 ? `₵${c.current.toLocaleString()}` : '-'}</TableCell>
													<TableCell className="text-right text-yellow-600">{c.days30 > 0 ? `₵${c.days30.toLocaleString()}` : '-'}</TableCell>
													<TableCell className="text-right text-orange-600">{c.days60 > 0 ? `₵${c.days60.toLocaleString()}` : '-'}</TableCell>
													<TableCell className="text-right text-red-500">{c.days90 > 0 ? `₵${c.days90.toLocaleString()}` : '-'}</TableCell>
													<TableCell className="text-right text-red-700 font-medium">{c.over90 > 0 ? `₵${c.over90.toLocaleString()}` : '-'}</TableCell>
											</TableRow>
											);
										})}
									</TableBody>
								</Table>
								
								{/* Aging Summary */}
								<div className="mt-6 grid grid-cols-5 gap-4">
									<Card className="bg-green-50">
										<CardBody className="text-center py-3">
											<div className="text-lg font-bold text-green-700">₵{customerAging.reduce((s, c) => s + c.current, 0).toLocaleString()}</div>
											<div className="text-xs text-green-600">Current</div>
										</CardBody>
									</Card>
									<Card className="bg-yellow-50">
										<CardBody className="text-center py-3">
											<div className="text-lg font-bold text-yellow-700">₵{customerAging.reduce((s, c) => s + c.days30, 0).toLocaleString()}</div>
											<div className="text-xs text-yellow-600">1-30 Days</div>
										</CardBody>
									</Card>
									<Card className="bg-orange-50">
										<CardBody className="text-center py-3">
											<div className="text-lg font-bold text-orange-700">₵{customerAging.reduce((s, c) => s + c.days60, 0).toLocaleString()}</div>
											<div className="text-xs text-orange-600">31-60 Days</div>
										</CardBody>
									</Card>
									<Card className="bg-red-50">
										<CardBody className="text-center py-3">
											<div className="text-lg font-bold text-red-600">₵{customerAging.reduce((s, c) => s + c.days90, 0).toLocaleString()}</div>
											<div className="text-xs text-red-500">61-90 Days</div>
										</CardBody>
									</Card>
									<Card className="bg-red-100">
										<CardBody className="text-center py-3">
											<div className="text-lg font-bold text-red-800">₵{customerAging.reduce((s, c) => s + c.over90, 0).toLocaleString()}</div>
											<div className="text-xs text-red-700">90+ Days</div>
										</CardBody>
									</Card>
								</div>
							</div>
						</Tab>

						{/* Sales Invoices Tab */}
						<Tab key="invoices" title={`🧾 Sales Invoices (${salesInvoices.length})`}>
							<div className="p-6">
								<div className="flex justify-between items-center mb-4">
									<h3 className="text-lg font-semibold">Sales Invoices</h3>
									<div className="flex items-center gap-2">
										<Chip color="primary" variant="flat">{filteredSalesInvoices.length} invoices</Chip>
										<Chip color="success" variant="flat">₵{filteredSalesInvoices.reduce((s: number, i: any) => s + (i.total || 0), 0).toLocaleString()}</Chip>
										<Dropdown>
											<DropdownTrigger>
												<Button variant="flat" size="sm">📥 Export</Button>
											</DropdownTrigger>
											<DropdownMenu>
												<DropdownItem key="csv" onPress={exportInvoicesCSV}>📄 Download CSV</DropdownItem>
												<DropdownItem key="pdf" onPress={printInvoicesTablePDF}>📑 Print PDF</DropdownItem>
											</DropdownMenu>
										</Dropdown>
										<Button color="primary" size="sm" onClick={() => openNewInvoice(false)}>➕ New Invoice</Button>
									</div>
								</div>
								{renderFilters(true)}
								{renderSalesInvoiceTable(filteredSalesInvoices)}
							</div>
						</Tab>

						{/* Proforma Invoices Tab */}
						<Tab key="proformas" title={`📋 Proforma Invoices (${proformaInvoices.length})`}>
							<div className="p-6">
								<div className="flex justify-between items-center mb-4">
									<h3 className="text-lg font-semibold">Proforma Invoices</h3>
									<div className="flex items-center gap-2">
										<Chip color="secondary" variant="flat">{filteredProformas.length} proformas</Chip>
										<Chip color="warning" variant="flat">₵{filteredProformas.reduce((s: number, i: any) => s + (i.total || 0), 0).toLocaleString()}</Chip>
										<Dropdown>
											<DropdownTrigger>
												<Button variant="flat" size="sm">📥 Export</Button>
											</DropdownTrigger>
											<DropdownMenu>
												<DropdownItem key="csv" onPress={exportProformasCSV}>📄 Download CSV</DropdownItem>
												<DropdownItem key="pdf" onPress={printProformasTablePDF}>📑 Print PDF</DropdownItem>
											</DropdownMenu>
										</Dropdown>
										<Button color="secondary" size="sm" onClick={() => openNewInvoice(true)}>➕ New Proforma</Button>
									</div>
								</div>
								{renderFilters(false)}
								{renderProformaTable(filteredProformas)}
							</div>
						</Tab>

						{/* Receipts Tab */}
						<Tab key="receipts" title={`💳 Receipts (${receipts.length})`}>
							<div className="p-6">
								<div className="flex justify-between items-center mb-4">
                                    <h3 className="text-lg font-semibold">Customer Receipts</h3>
									<div className="flex items-center gap-2">
										<Chip color="success" variant="flat">{filteredReceipts.length} receipts</Chip>
										<Chip color="primary" variant="flat">₵{filteredReceipts.reduce((s: number, r: any) => s + (r.amount || 0), 0).toLocaleString()}</Chip>
										<Dropdown>
											<DropdownTrigger>
												<Button variant="flat" size="sm">📥 Export</Button>
											</DropdownTrigger>
											<DropdownMenu>
												<DropdownItem key="csv" onPress={exportReceiptsCSV}>📄 Download CSV</DropdownItem>
												<DropdownItem key="pdf" onPress={printReceiptsTablePDF}>📑 Print PDF</DropdownItem>
											</DropdownMenu>
										</Dropdown>
										<Button variant="flat" size="sm" onClick={openPrintReceiptModal}>🖨️ Print Receipt</Button>
										<Button color="primary" size="sm" onClick={() => openReceiptForm()}>➕ Record Receipt</Button>
                                </div>
								</div>
								{renderFilters(false)}
								
								<Table aria-label="Customer receipts">
                                    <TableHeader>
                                        <TableColumn>RECEIPT #</TableColumn>
										<TableColumn>SOURCE</TableColumn>
                                        <TableColumn>CUSTOMER</TableColumn>
                                        <TableColumn>DATE</TableColumn>
										<TableColumn>TIME</TableColumn>
                                        <TableColumn>METHOD</TableColumn>
										<TableColumn>STAFF</TableColumn>
										<TableColumn>INVOICE</TableColumn>
										<TableColumn align="end">AMOUNT</TableColumn>
                                        <TableColumn>STATUS</TableColumn>
										<TableColumn>ACTIONS</TableColumn>
                                    </TableHeader>
                                    <TableBody emptyContent="No receipts found.">
										{getPaginatedData(filteredReceipts, page).map((r: any) => {
											const source = getSourceLabel(r.sourceModule);
											const canEdit = receiptCanEdit(r);
											const canVoid = receiptCanVoid(r);
											return (
												<TableRow key={r.id} className="cursor-pointer hover:bg-gray-50" onClick={() => openReceiptDetail(r)}>
													<TableCell>
														<span className="font-mono text-sm text-blue-600 hover:underline">{r.paymentNumber || r.id}</span>
													</TableCell>
													<TableCell>
														<Chip size="sm" color={source.color} variant="flat">{source.icon} {source.label}</Chip>
													</TableCell>
													<TableCell>
														<div className="font-medium">{r.customerName || r.businessPartnerId}</div>
													</TableCell>
													<TableCell>{new Date(r.date).toLocaleDateString()}</TableCell>
													<TableCell className="text-gray-600">{new Date(r.date).toLocaleTimeString()}</TableCell>
													<TableCell>
														<Chip size="sm" variant="flat">{r.paymentMethod || 'Cash'}</Chip>
													</TableCell>
													<TableCell>
														<div className="text-sm">{r.staffName || '-'}</div>
														<div className="text-xs text-gray-500">{r.staffRole || ''}</div>
													</TableCell>
													<TableCell>
														{r.invoiceId ? (
															<span className="font-mono text-xs text-blue-600">{r.invoiceId.slice(0, 15)}...</span>
														) : '-'}
													</TableCell>
													<TableCell className="text-right font-medium text-green-600">₵{Number(r.amount || 0).toLocaleString()}</TableCell>
													<TableCell>
														<Chip size="sm" color={r.status === 'Posted' ? 'success' : r.status === 'Void' ? 'danger' : 'default'} variant="flat">{r.status || 'Draft'}</Chip>
													</TableCell>
													<TableCell onClick={(e) => e.stopPropagation()}>
														<Dropdown>
															<DropdownTrigger>
																<Button size="sm" variant="flat">Actions</Button>
															</DropdownTrigger>
															<DropdownMenu aria-label="Receipt actions">
																<DropdownItem key="view" onPress={() => openReceiptDetail(r)}>
																	🧾 View
																</DropdownItem>
																<DropdownItem key="print" onPress={() => printReceiptPDF(r)}>
																	🖨️ Print
																</DropdownItem>
																{canEdit ? (
																	<DropdownItem key="edit" onPress={() => openEditReceiptForm(r)}>
																		✏️ Edit
																	</DropdownItem>
																) : null}
																{canVoid ? (
																	<DropdownItem
																		key="void"
																		className="text-danger"
																		color="danger"
																		onPress={() => handleVoidReceipt(r)}
																	>
																		🗑️ Void
																	</DropdownItem>
																) : null}
															</DropdownMenu>
														</Dropdown>
													</TableCell>
                                            </TableRow>
											);
										})}
                                    </TableBody>
                                </Table>
								
								{Math.ceil(filteredReceipts.length / rowsPerPage) > 1 && (
									<div className="flex justify-center mt-4">
										<Pagination total={Math.ceil(filteredReceipts.length / rowsPerPage)} page={page} onChange={setPage} />
									</div>
								)}
                            </div>
                        </Tab>

						{/* WHT Certificates Tab */}
						<Tab key="wht" title={`📜 WHT Certificates (${whtCertificates?.length || 0})`}>
							<div className="p-6">
								<div className="flex justify-between items-center mb-4">
									<h3 className="text-lg font-semibold inline-flex items-center gap-1.5">
										WHT Certificates (Tax Credits)
										<InfoTip label="What is WHT?">
											<div className="space-y-2">
												<p className="font-semibold">What is WHT?</p>
												<p>
													When corporate/government clients pay, they withhold WHT on the invoice subtotal (
													{whtCertRates.onSubtotalPct}% per your tax settings) and WHT-VAT on the VAT portion (
													{whtCertRates.onVatPct}%). They later provide a GRA certificate as proof. These certificates
													become tax credits for your company. Adjust rates under Books &amp; Taxes (WHT_CERT / WHT_VAT_CERT).
												</p>
											</div>
										</InfoTip>
									</h3>
									<div className="flex items-center gap-2">
										<Chip color="warning" variant="flat">{filteredWHTCerts.length} certificates</Chip>
										<Chip color="primary" variant="flat">₵{totalWHTReceivable.toLocaleString()} receivable</Chip>
										{pendingWHTCerts > 0 && (
											<Chip color="danger" variant="flat">{pendingWHTCerts} pending</Chip>
										)}
									</div>
								</div>

								{renderFilters(false)}

								<Table aria-label="WHT Certificates">
									<TableHeader>
										<TableColumn>CERTIFICATE #</TableColumn>
										<TableColumn>AGENT (WHO WITHHELD)</TableColumn>
										<TableColumn>TIN</TableColumn>
										<TableColumn>INVOICE</TableColumn>
										<TableColumn>TAX PERIOD</TableColumn>
										<TableColumn align="end">WHT</TableColumn>
										<TableColumn align="end">WHT-VAT</TableColumn>
										<TableColumn align="end">TOTAL</TableColumn>
										<TableColumn>STATUS</TableColumn>
										<TableColumn>ACTIONS</TableColumn>
									</TableHeader>
									<TableBody emptyContent="No WHT certificates found. WHT certificates are created when you record payments with withholding tax.">
										{getPaginatedData(filteredWHTCerts, page).map((cert: any) => (
											<TableRow key={cert.id} className="cursor-pointer hover:bg-gray-50" onClick={() => openWHTDetail(cert)}>
												<TableCell>
													<span className="font-mono text-sm text-blue-600 hover:underline">
														{cert.certificateNumber || 'PENDING'}
													</span>
												</TableCell>
												<TableCell>
													<div className="font-medium">{cert.withholdingAgentName}</div>
												</TableCell>
												<TableCell className="font-mono text-sm">{cert.withholdingAgentTIN || '-'}</TableCell>
												<TableCell>
													<span className="font-mono text-xs text-gray-600">{cert.invoiceNumber}</span>
												</TableCell>
												<TableCell>{cert.taxPeriod}</TableCell>
												<TableCell className="text-right font-medium">₵{Number(cert.whtAmount || 0).toLocaleString()}</TableCell>
												<TableCell className="text-right font-medium">₵{Number(cert.whtVatAmount || 0).toLocaleString()}</TableCell>
												<TableCell className="text-right font-bold text-amber-600">₵{Number(cert.totalWithheld || 0).toLocaleString()}</TableCell>
												<TableCell>
													<Chip 
														size="sm" 
														color={
															cert.status === 'Verified' ? 'success' : 
															cert.status === 'Received' ? 'primary' :
															cert.status === 'Pending' ? 'warning' : 'default'
														} 
														variant="flat"
													>
														{cert.status}
													</Chip>
												</TableCell>
												<TableCell>
													{cert.status === 'Pending' && (
														<Tooltip content="Enter GRA certificate number">
															<Button size="sm" color="primary" variant="flat" onClick={(e) => { e.stopPropagation(); openWHTDetail(cert); }}>
																📥 Receive cert
															</Button>
														</Tooltip>
													)}
													{cert.status === 'Received' && (
														<Tooltip content="Mark as verified">
															<Button size="sm" color="success" variant="flat" onClick={(e) => { e.stopPropagation(); verifyWHTCertificate(cert.id); }}>
																✓ Verify
															</Button>
														</Tooltip>
													)}
												</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>

								{Math.ceil(filteredWHTCerts.length / rowsPerPage) > 1 && (
									<div className="flex justify-center mt-4">
										<Pagination total={Math.ceil(filteredWHTCerts.length / rowsPerPage)} page={page} onChange={setPage} />
									</div>
								)}
                            </div>
                        </Tab>

					</Tabs>
				</CardBody>
			</Card>

			{/* WHT Payment Modal */}
			<Modal isOpen={isWHTPaymentOpen} onOpenChange={setIsWHTPaymentOpen} size="2xl">
                <ModalContent>
                    {(onClose) => (
                        <>
							<ModalHeader>
								{whtPaymentMode === 'wht_only'
									? '📜 Record WHT Certificate (clears remaining balance)'
									: '💰 Record Payment with WHT Deduction'}
							</ModalHeader>
                            <ModalBody>
								{formError && <div className="text-red-600 text-sm mb-3 p-2 bg-red-50 rounded">{formError}</div>}

								{whtPaymentMode === 'settlement' && (
									<p className="text-sm text-gray-600 mb-3 p-2 bg-blue-50 rounded border border-blue-100">
										Record the net cash received now. WHT amounts can be saved without a certificate number — attach the GRA certificate later from the WHT Certificates tab.
									</p>
								)}
								{whtPaymentMode === 'wht_only' && (
									<p className="text-sm text-gray-600 mb-3 p-2 bg-amber-50 rounded border border-amber-100">
										Cash was already recorded on this invoice. Enter the withheld WHT + WHT-VAT to clear the remaining balance. Certificate number can be added when GRA issues it.
									</p>
								)}

								{/* Invoice Info */}
								<Card className="mb-4 bg-blue-50 border border-blue-200">
									<CardBody className="py-3">
										<div className="grid grid-cols-4 gap-4 text-sm">
											<div>
												<div className="text-gray-500">Invoice</div>
												<div className="font-bold">{whtPaymentForm.invoiceNumber}</div>
											</div>
											<div>
												<div className="text-gray-500">Customer</div>
												<div className="font-medium">{whtPaymentForm.customerName}</div>
											</div>
											<div>
												<div className="text-gray-500">Invoice Total</div>
												<div className="font-bold">₵{Number(whtPaymentForm.invoiceTotal || 0).toLocaleString()}</div>
											</div>
											<div>
												<div className="text-gray-500">Balance Due</div>
												<div className="font-bold text-orange-600">₵{Number(whtPaymentForm.balanceDue || 0).toLocaleString()}</div>
											</div>
										</div>
									</CardBody>
								</Card>

								{/* Payment Breakdown */}
								<div className="grid grid-cols-2 gap-4 mb-4">
									<Input 
										type="number"
										label="Cash/Bank Amount Received"
										placeholder="0.00"
										value={whtPaymentForm.cashAmount}
										onValueChange={(v) => setWHTPaymentForm((f: any) => ({ ...f, cashAmount: Number(v) }))}
										startContent="₵"
										description={whtPaymentMode === 'wht_only' ? 'Leave at 0 — cash already received' : 'Actual amount received from customer'}
										isReadOnly={whtPaymentMode === 'wht_only'}
									/>
									{whtPaymentMode !== 'wht_only' && (
									<Select 
										label="Payment Method"
										selectedKeys={[whtPaymentForm.paymentMethod]}
										onSelectionChange={(s: any) => setWHTPaymentForm((f: any) => ({ ...f, paymentMethod: Array.from(s)[0] as string }))}
									>
										<SelectItem key="Bank">Bank Transfer</SelectItem>
                                        <SelectItem key="Cash">Cash</SelectItem>
                                        <SelectItem key="Card">Card</SelectItem>
                                        <SelectItem key="Mobile Money">Mobile Money</SelectItem>
                                    </Select>
									)}
									{whtPaymentMode !== 'wht_only' && whtPaymentForm.paymentMethod === 'Bank' && activeBankAccounts.length > 0 && (
										<Select
											label="Deposit to account"
											selectedKeys={whtPaymentForm.bankAccountId ? [whtPaymentForm.bankAccountId] : []}
											onSelectionChange={(s: any) =>
												setWHTPaymentForm((f: any) => ({ ...f, bankAccountId: Array.from(s)[0] as string }))
											}
										>
											{activeBankAccounts.map((acc: any) => (
												<SelectItem key={acc.id}>{acc.accountName}</SelectItem>
											))}
										</Select>
									)}
                                </div>

								{/* WHT Amounts */}
								<Card className="mb-4 bg-amber-50 border border-amber-200">
									<CardBody>
										<h4 className="font-semibold text-amber-800 mb-3">Withholding Tax Deducted by Customer</h4>
										<div className="grid grid-cols-2 gap-4">
											<Input 
												type="number"
												label={whtLabels.whtLabel}
												placeholder="0.00"
												value={whtPaymentForm.whtAmount}
												onValueChange={(v) => setWHTPaymentForm((f: any) => ({ ...f, whtAmount: Number(v) }))}
												startContent="₵"
												description="Withholding Tax on subtotal"
											/>
											<Input 
												type="number"
												label={whtLabels.whtVatLabel}
												placeholder="0.00"
												value={whtPaymentForm.whtVatAmount}
												onValueChange={(v) => setWHTPaymentForm((f: any) => ({ ...f, whtVatAmount: Number(v) }))}
												startContent="₵"
												description="Withholding VAT on tax amount"
											/>
										</div>
									</CardBody>
								</Card>

								{/* Certificate Details */}
								<Card className="mb-4 bg-gray-50">
									<CardBody>
										<h4 className="font-semibold text-gray-700 mb-3">GRA Certificate Details (Optional - fill when received)</h4>
										<div className="grid grid-cols-2 gap-4">
											<Input 
												label="Certificate Number"
												placeholder="e.g., WHT-2026-001234"
												value={whtPaymentForm.certificateNumber}
												onValueChange={(v) => setWHTPaymentForm((f: any) => ({ ...f, certificateNumber: v }))}
												description="Leave blank if not yet received"
											/>
											<Input 
												label="Withholding Agent TIN"
												placeholder="e.g., P00012345X"
												value={whtPaymentForm.withholdingAgentTIN}
												onValueChange={(v) => setWHTPaymentForm((f: any) => ({ ...f, withholdingAgentTIN: v }))}
												description="Customer's Tax ID"
											/>
										</div>
									</CardBody>
								</Card>

								{/* Summary */}
								<Card className="bg-green-50 border border-green-200">
									<CardBody>
										<h4 className="font-semibold text-green-800 mb-2">Payment Summary</h4>
										<div className="grid grid-cols-4 gap-4 text-sm">
											<div>
												<div className="text-gray-500">Cash Received</div>
												<div className="font-bold text-green-600">₵{Number(whtPaymentForm.cashAmount || 0).toLocaleString()}</div>
											</div>
											<div>
												<div className="text-gray-500">WHT Credit</div>
												<div className="font-bold text-amber-600">₵{Number(whtPaymentForm.whtAmount || 0).toLocaleString()}</div>
											</div>
											<div>
												<div className="text-gray-500">WHT-VAT Credit</div>
												<div className="font-bold text-amber-600">₵{Number(whtPaymentForm.whtVatAmount || 0).toLocaleString()}</div>
											</div>
											<div>
												<div className="text-gray-500">Total Clearing AR</div>
												<div className="font-bold text-blue-600">
													₵{(Number(whtPaymentForm.cashAmount || 0) + Number(whtPaymentForm.whtAmount || 0) + Number(whtPaymentForm.whtVatAmount || 0)).toLocaleString()}
												</div>
											</div>
										</div>
									</CardBody>
								</Card>
                            </ModalBody>
                            <ModalFooter>
								<Button variant="flat" onPress={onClose}>Cancel</Button>
								<Button color="primary" onPress={saveWHTPayment}>Record Payment</Button>
                            </ModalFooter>
                        </>
                    )}
                </ModalContent>
            </Modal>

			{/* WHT Certificate Detail Modal */}
			<Modal isOpen={isWHTDetailOpen} onOpenChange={setIsWHTDetailOpen} size="2xl">
                <ModalContent>
					{(onClose) => selectedWHTCert && (
                        <>
							<ModalHeader>📜 WHT Certificate Details</ModalHeader>
                            <ModalBody>
								<div className="grid grid-cols-2 gap-6">
									{/* Certificate Info */}
									<Card className="bg-amber-50 border border-amber-200">
										<CardBody>
											<h4 className="font-semibold text-amber-800 mb-3">Certificate Information</h4>
											<div className="space-y-2 text-sm">
												<div className="flex justify-between">
													<span className="text-gray-600">Certificate #:</span>
													<span className="font-mono font-bold">{selectedWHTCert.certificateNumber || 'PENDING'}</span>
                                </div>
												<div className="flex justify-between">
													<span className="text-gray-600">Tax Period:</span>
													<span className="font-medium">{selectedWHTCert.taxPeriod}</span>
												</div>
												<div className="flex justify-between">
													<span className="text-gray-600">Status:</span>
													<Chip size="sm" color={selectedWHTCert.status === 'Verified' ? 'success' : selectedWHTCert.status === 'Pending' ? 'warning' : 'primary'}>
														{selectedWHTCert.status}
													</Chip>
												</div>
												<div className="flex justify-between">
													<span className="text-gray-600">Date Received:</span>
													<span>{selectedWHTCert.receivedDate ? new Date(selectedWHTCert.receivedDate).toLocaleDateString() : 'Not yet received'}</span>
												</div>
											</div>
										</CardBody>
									</Card>

									{/* Withholding Agent */}
									<Card className="bg-gray-50">
										<CardBody>
											<h4 className="font-semibold text-gray-700 mb-3">Withholding Agent (Customer)</h4>
											<div className="space-y-2 text-sm">
												<div className="flex justify-between">
													<span className="text-gray-600">Name:</span>
													<span className="font-medium">{selectedWHTCert.withholdingAgentName}</span>
												</div>
												<div className="flex justify-between">
													<span className="text-gray-600">TIN:</span>
													<span className="font-mono">{selectedWHTCert.withholdingAgentTIN || '-'}</span>
												</div>
												<div className="flex justify-between">
													<span className="text-gray-600">Related Invoice:</span>
													<span className="font-mono text-blue-600">{selectedWHTCert.invoiceNumber}</span>
												</div>
												<div className="flex justify-between">
													<span className="text-gray-600">Gross Amount:</span>
													<span className="font-bold">₵{Number(selectedWHTCert.grossAmount || 0).toLocaleString()}</span>
												</div>
											</div>
										</CardBody>
									</Card>
								</div>

								{/* Tax Breakdown */}
								<Card className="mt-4">
									<CardBody>
										<h4 className="font-semibold text-gray-800 mb-3">Tax Credit Breakdown</h4>
										<Table removeWrapper aria-label="Tax breakdown">
                                        <TableHeader>
												<TableColumn>TAX TYPE</TableColumn>
												<TableColumn>RATE</TableColumn>
                                            <TableColumn align="end">AMOUNT</TableColumn>
                                        </TableHeader>
											<TableBody>
												<TableRow>
													<TableCell>Withholding Tax (WHT)</TableCell>
													<TableCell>{selectedWHTCert.whtRate || 5}%</TableCell>
													<TableCell className="text-right font-medium">₵{Number(selectedWHTCert.whtAmount || 0).toLocaleString()}</TableCell>
                                                    </TableRow>
												<TableRow>
													<TableCell>Withholding VAT (WHT-VAT)</TableCell>
													<TableCell>{selectedWHTCert.whtVatRate || 7}%</TableCell>
													<TableCell className="text-right font-medium">₵{Number(selectedWHTCert.whtVatAmount || 0).toLocaleString()}</TableCell>
												</TableRow>
												<TableRow className="bg-amber-50">
													<TableCell className="font-bold">TOTAL TAX CREDIT</TableCell>
													<TableCell>-</TableCell>
													<TableCell className="text-right font-bold text-amber-600">₵{Number(selectedWHTCert.totalWithheld || 0).toLocaleString()}</TableCell>
												</TableRow>
                                        </TableBody>
                                    </Table>
									</CardBody>
								</Card>

								{/* Tax Credit Usage */}
								<Card className="mt-4 bg-green-50 border border-green-200">
									<CardBody>
										<h4 className="font-semibold text-green-800 mb-3">Tax Credit Usage</h4>
										<div className="grid grid-cols-3 gap-4 text-sm">
											<div>
												<div className="text-gray-600">Total Credit</div>
												<div className="font-bold text-lg">₵{Number(selectedWHTCert.totalWithheld || 0).toLocaleString()}</div>
                                    </div>
											<div>
												<div className="text-gray-600">Used</div>
												<div className="font-bold text-lg text-gray-500">₵{Number(selectedWHTCert.taxCreditUsedAmount || 0).toLocaleString()}</div>
                                </div>
											<div>
												<div className="text-gray-600">Remaining Balance</div>
												<div className="font-bold text-lg text-green-600">₵{Number(selectedWHTCert.taxCreditBalance || selectedWHTCert.totalWithheld || 0).toLocaleString()}</div>
											</div>
										</div>
                                                </CardBody>
                                            </Card>

								{selectedWHTCert.status === 'Pending' && (
									<Card className="mt-4 border border-amber-300 bg-amber-50">
										<CardBody>
											<h4 className="font-semibold text-amber-900 mb-3">Receive GRA Certificate</h4>
											<p className="text-sm text-amber-800 mb-3">
												The WHT was recorded when payment was received. Enter the official certificate details when the customer/GRA provides them.
											</p>
											{formError && <div className="text-red-600 text-sm mb-3">{formError}</div>}
											<div className="grid grid-cols-2 gap-4">
												<Input
													label="Certificate Number *"
													placeholder="e.g., WHT-2026-001234"
													value={receiveCertForm.certificateNumber}
													onValueChange={(v) => setReceiveCertForm((f) => ({ ...f, certificateNumber: v }))}
												/>
												<Input
													label="Withholding Agent TIN"
													placeholder="e.g., P00012345X"
													value={receiveCertForm.withholdingAgentTIN}
													onValueChange={(v) => setReceiveCertForm((f) => ({ ...f, withholdingAgentTIN: v }))}
												/>
											</div>
										</CardBody>
									</Card>
								)}
							</ModalBody>
							<ModalFooter>
								{selectedWHTCert.status === 'Pending' && (
									<Button color="primary" onPress={saveReceiveWHTCertificate}>
										Save certificate details
									</Button>
								)}
								{selectedWHTCert.status === 'Received' && (
									<Button color="success" onPress={() => { verifyWHTCertificate(selectedWHTCert.id); onClose(); }}>
										✓ Mark as Verified
									</Button>
								)}
								<Button variant="flat" onPress={onClose}>Close</Button>
							</ModalFooter>
						</>
					)}
				</ModalContent>
			</Modal>

			{/* New Invoice Modal */}
			<Modal isOpen={isNewInvoiceOpen} onOpenChange={setIsNewInvoiceOpen} size="2xl">
                <ModalContent>
                    {(onClose) => (
                        <>
							<ModalHeader>➕ {invoiceForm.isProforma ? 'New Proforma Invoice' : 'New Sales Invoice'}</ModalHeader>
                            <ModalBody>
								{formError && <div className="text-red-600 text-sm mb-3 p-2 bg-red-50 rounded">{formError}</div>}
								
								<div className="mb-4 p-3 bg-gray-50 rounded-lg">
									<Checkbox 
										isSelected={invoiceForm.isProforma || false} 
										onValueChange={(v) => setInvoiceForm({ ...invoiceForm, isProforma: v })}
									>
										📋 Proforma Invoice
									</Checkbox>
									<span className="text-xs text-gray-500 ml-2">
										{invoiceForm.isProforma ? 'Preliminary invoice before delivery' : 'Regular sales invoice'}
									</span>
                                        </div>

                                <div className="grid grid-cols-2 gap-4">
									<Input label="Customer Name *" value={invoiceForm.customerName || ''} onChange={(e) => setInvoiceForm({ ...invoiceForm, customerName: e.target.value })} />
									<Input label={invoiceForm.isProforma ? "Proforma Number" : "Invoice Number"} value={invoiceForm.invoiceNumber || ''} onChange={(e) => setInvoiceForm({ ...invoiceForm, invoiceNumber: e.target.value })} placeholder="Auto-generated" />
									<Input type="date" label={invoiceForm.isProforma ? "Proforma Date" : "Invoice Date"} value={invoiceForm.date || ''} onValueChange={(v) => setInvoiceForm({ ...invoiceForm, date: v })} />
									<Input type="date" label={invoiceForm.isProforma ? "Valid Until" : "Due Date"} value={invoiceForm.dueDate || ''} onValueChange={(v) => setInvoiceForm({ ...invoiceForm, dueDate: v })} />
									<Input type="number" label="Subtotal" value={invoiceForm.subtotal?.toString() || ''} onChange={(e) => setInvoiceForm({ ...invoiceForm, subtotal: e.target.value, total: Number(e.target.value) + Number(invoiceForm.taxAmount || 0) })} />
									<div className="flex gap-2 items-end">
										<Input type="number" label="Tax Amount" value={invoiceForm.taxAmount?.toString() || ''} onChange={(e) => setInvoiceForm({ ...invoiceForm, taxAmount: e.target.value, total: Number(invoiceForm.subtotal || 0) + Number(e.target.value) })} />
										<Button size="sm" variant="bordered" onPress={() => {
											const subtotal = Number(invoiceForm.subtotal || 0);
											const { totalTax } = computeSalesTax(subtotal);
											setInvoiceForm({ ...invoiceForm, taxAmount: totalTax, total: subtotal + totalTax });
										}}>Apply Tax</Button>
									</div>
									<Input type="number" isReadOnly label="Total" value={(Number(invoiceForm.subtotal || 0) + Number(invoiceForm.taxAmount || 0)).toString()} description="Subtotal + Tax — not independently editable" className="col-span-2" />
									<Input label="Description" value={invoiceForm.description || ''} onChange={(e) => setInvoiceForm({ ...invoiceForm, description: e.target.value })} className="col-span-2" />
                                </div>
                            </ModalBody>
                            <ModalFooter>
                                <Button variant="light" onPress={onClose}>Cancel</Button>
								<Button color={invoiceForm.isProforma ? "secondary" : "primary"} onPress={saveInvoice}>
									{invoiceForm.isProforma ? 'Save Proforma' : 'Save Invoice'}
								</Button>
                            </ModalFooter>
                        </>
                    )}
                </ModalContent>
            </Modal>

			{/* Record Receipt Modal */}
			<Modal
				isOpen={isNewReceiptOpen}
				onOpenChange={(open) => {
					setIsNewReceiptOpen(open);
					if (!open) {
						setEditingReceiptId(null);
						setFormError('');
					}
				}}
				size="2xl"
			>
                <ModalContent>
                    {(onClose) => (
                        <>
							<ModalHeader className="flex items-center gap-2">
								<span>
									{editingReceiptId ? '✏️ Edit Customer Receipt' : '➕ Record Customer Receipt'}
								</span>
								<InfoTip label="Receipt form help">
									<div className="space-y-2 text-left">
										<p>
											Apply to an <strong>in-house folio</strong> (guest checked in) or a{' '}
											<strong>posted invoice</strong> (incl. front-office checkout).
										</p>
										<p>
											Invoice payments post to GL; folio payments update the guest ledger until
											checkout.
										</p>
										<p>
											For corporate WHT, choose <strong>Net cash + WHT</strong> or{' '}
											<strong>WHT certificate only</strong> under Payment type.
										</p>
										<p>
											<strong>Revenue centre</strong> is optional — it tags the GL segment when
											the receipt posts (suggested from the folio or invoice you select).
										</p>
										{editingReceiptId && (
											<p className="text-amber-800">
												Amount changes are blocked after GL posting — void and re-record instead.
											</p>
										)}
									</div>
								</InfoTip>
							</ModalHeader>
                            <ModalBody>
								{formError && <div className="text-red-600 text-sm mb-3 p-2 bg-red-50 rounded">{formError}</div>}

								<div className="grid grid-cols-2 gap-4 mb-4">
									<Autocomplete
										label="Customer"
										placeholder="Search customer..."
										selectedKey={receiptForm.businessPartnerId || null}
										onSelectionChange={(key) => onReceiptCustomerSelect(key as string | null)}
										inputValue={receiptForm.customerName || ''}
										onInputChange={(v) =>
											setReceiptForm((f: any) => ({
												...f,
												customerName: v,
												...(f.businessPartnerId && v !== customers.find((c) => c.id === f.businessPartnerId)?.name
													? { businessPartnerId: '', targetKey: '', invoiceId: '', invoiceNumber: '' }
													: {}),
											}))
										}
										allowsCustomValue
									>
										{customers.map((c) => (
											<AutocompleteItem key={c.id} textValue={c.name}>
												<div className="font-medium">{c.name}</div>
												<div className="text-xs text-gray-500">{c.id}</div>
											</AutocompleteItem>
										))}
									</Autocomplete>

									<Select
										label="Apply to folio or invoice"
										placeholder="In-house guest or open invoice"
										selectedKeys={receiptForm.targetKey ? [receiptForm.targetKey] : []}
										onSelectionChange={(s) => onReceiptTargetSelect(Array.from(s)[0] as string | null)}
										isDisabled={!!editingReceiptId}
									>
										{filteredReceiptTargets.map((target: ReceiptTarget) => (
											<SelectItem key={target.key} textValue={target.label}>
												<div className="flex flex-col gap-0.5">
													<span>{target.label}</span>
													<span className="text-xs text-gray-500">{target.sourceBadge}</span>
												</div>
											</SelectItem>
										))}
									</Select>
								</div>

								{activeRevenueCenters.length > 0 && (
									<Select
										label="Revenue centre (optional)"
										placeholder="Suggested when you pick folio or invoice"
										className="mb-4"
										selectedKeys={
											receiptForm.revenueCenterCode ? [receiptForm.revenueCenterCode] : []
										}
										onSelectionChange={(s) => {
											const key = Array.from(s)[0] as string | undefined;
											setReceiptForm((f: any) => ({
												...f,
												revenueCenterCode: key || '',
											}));
										}}
									>
										{activeRevenueCenters.map((rc) => (
											<SelectItem key={rc.code} textValue={`${rc.code} — ${rc.name}`}>
												{rc.code} — {rc.name}
											</SelectItem>
										))}
									</Select>
								)}

								{selectedReceiptTarget?.kind === 'invoice' && !editingReceiptId && (
									<Select
										label="Payment type"
										className="mb-4"
										selectedKeys={[receiptForm.paymentKind || 'standard']}
										onSelectionChange={(s) =>
											onReceiptPaymentKindChange(Array.from(s)[0] as string | null)
										}
									>
										<SelectItem key="standard">Full payment (cash/bank)</SelectItem>
										<SelectItem key="wht_settlement" isDisabled={!receiptWhtAvailable}>
											Net cash + WHT (certificate later OK)
										</SelectItem>
										<SelectItem key="wht_only" isDisabled={!receiptWhtAvailable}>
											WHT certificate only
										</SelectItem>
									</Select>
								)}

								{selectedReceiptTarget?.kind === 'folio' && (
									<Card className="mb-4 bg-emerald-50 border border-emerald-200">
										<CardBody className="py-3">
											<div className="grid grid-cols-3 gap-3 text-sm">
												<div>
													<div className="text-gray-500">Guest</div>
													<div className="font-bold">{selectedReceiptTarget.customerName}</div>
												</div>
												{selectedReceiptTarget.roomNumber && (
													<div>
														<div className="text-gray-500">Room</div>
														<div className="font-medium">{selectedReceiptTarget.roomNumber}</div>
													</div>
												)}
												<div>
													<div className="text-gray-500 inline-flex items-center gap-1">
														Folio balance
														<InfoTip label="Folio payment">
															Posts to the in-house guest folio. Accounting invoice and GL are
															created at checkout.
														</InfoTip>
													</div>
													<div className="font-bold text-orange-600">₵{receiptBalanceDue.toLocaleString()}</div>
												</div>
											</div>
										</CardBody>
									</Card>
								)}

								{selectedReceiptInvoice && (
									<Card className="mb-4 bg-blue-50 border border-blue-200">
										<CardBody className="py-3">
											<div className="grid grid-cols-4 gap-3 text-sm">
												<div>
													<div className="text-gray-500">Invoice</div>
													<div className="font-mono font-bold">{selectedReceiptInvoice.invoiceNumber}</div>
													{selectedReceiptInvoice.sourceModule === 'front_office_checkout' && (
														<Chip size="sm" variant="flat" color="secondary" className="mt-1">
															Front office
														</Chip>
													)}
												</div>
												<div>
													<div className="text-gray-500">Invoice total</div>
													<div className="font-medium">₵{Number(selectedReceiptInvoice.total || 0).toLocaleString()}</div>
												</div>
												<div>
													<div className="text-gray-500">Balance due</div>
													<div className="font-bold text-orange-600">₵{receiptBalanceDue.toLocaleString()}</div>
												</div>
												<div>
													<div className="text-gray-500">After this receipt</div>
													<div className="font-bold text-green-700">
														₵{Math.max(0, receiptBalanceDue - roundMoney2(
															Number(receiptForm.amount || 0) +
															Number(receiptForm.whtAmount || 0) +
															Number(receiptForm.whtVatAmount || 0)
														)).toLocaleString()}
													</div>
												</div>
											</div>
										</CardBody>
									</Card>
								)}

								<div className="grid grid-cols-2 gap-4 mb-4">
									{(receiptForm.paymentKind === 'standard' ||
										selectedReceiptTarget?.kind !== 'invoice' ||
										editingReceiptId) && (
									<Input
										type="number"
										label="Amount received *"
										placeholder="0.00"
										value={receiptForm.amount?.toString() ?? ''}
										onValueChange={(v) => setReceiptForm((f: any) => ({ ...f, amount: v }))}
										startContent="₵"
										description={
											selectedReceiptTarget
												? `Balance due ₵${receiptBalanceDue.toLocaleString()}`
												: 'Enter amount received'
										}
										endContent={
											selectedReceiptTarget ? (
												<Button size="sm" variant="flat" onPress={fillReceiptFullBalance}>
													Fill
												</Button>
											) : undefined
										}
									/>
									)}

									{(receiptForm.paymentKind === 'wht_settlement' ||
										receiptForm.paymentKind === 'wht_only') &&
										!editingReceiptId && (
										<>
											<Input
												type="number"
												label="Cash/bank received"
												placeholder="0.00"
												value={receiptForm.cashAmount?.toString() ?? ''}
												onValueChange={(v) =>
													setReceiptForm((f: any) => ({ ...f, cashAmount: v, amount: v }))
												}
												startContent="₵"
												isReadOnly={receiptForm.paymentKind === 'wht_only'}
												description={
													receiptForm.paymentKind === 'wht_only'
														? 'Leave at 0 if cash already received'
														: 'Net cash from customer'
												}
											/>
											<Input
												type="number"
												label={whtLabels.whtLabel}
												placeholder="0.00"
												value={receiptForm.whtAmount?.toString() ?? ''}
												onValueChange={(v) =>
													setReceiptForm((f: any) => ({ ...f, whtAmount: v }))
												}
												startContent="₵"
											/>
											<Input
												type="number"
												label={whtLabels.whtVatLabel}
												placeholder="0.00"
												value={receiptForm.whtVatAmount?.toString() ?? ''}
												onValueChange={(v) =>
													setReceiptForm((f: any) => ({ ...f, whtVatAmount: v }))
												}
												startContent="₵"
											/>
											<Input
												label="WHT certificate # (optional)"
												placeholder="GRA cert number when received"
												value={receiptForm.certificateNumber || ''}
												onValueChange={(v) =>
													setReceiptForm((f: any) => ({ ...f, certificateNumber: v }))
												}
											/>
											<Input
												label="Withholding agent TIN (optional)"
												value={receiptForm.withholdingAgentTIN || ''}
												onValueChange={(v) =>
													setReceiptForm((f: any) => ({ ...f, withholdingAgentTIN: v }))
												}
											/>
										</>
									)}

									<Input
										type="date"
										label="Receipt date"
										value={receiptForm.date || ''}
										onValueChange={(v) => setReceiptForm((f: any) => ({ ...f, date: v }))}
									/>
									<Select
										label="Payment method"
										selectedKeys={[receiptForm.paymentMethod || 'Bank']}
										onSelectionChange={(s: any) =>
											setReceiptForm((f: any) => ({
												...f,
												paymentMethod: Array.from(s)[0] as string,
											}))
										}
										isDisabled={
											receiptForm.paymentKind === 'wht_only' && !Number(receiptForm.cashAmount)
										}
									>
										<SelectItem key="Bank">Bank transfer</SelectItem>
										<SelectItem key="Cash">Cash</SelectItem>
										<SelectItem key="Card">Card</SelectItem>
										<SelectItem key="Mobile Money">Mobile money</SelectItem>
										<SelectItem key="Cheque">Cheque</SelectItem>
									</Select>
									{receiptNeedsBankAccount && activeBankAccounts.length > 0 && (
										<Select
											label="Deposit to account"
											selectedKeys={receiptForm.bankAccountId ? [receiptForm.bankAccountId] : []}
											onSelectionChange={(s: any) =>
												setReceiptForm((f: any) => ({
													...f,
													bankAccountId: Array.from(s)[0] as string,
												}))
											}
										>
											{activeBankAccounts.map((acc) => (
												<SelectItem key={acc.id}>{acc.accountName}</SelectItem>
											))}
										</Select>
									)}
									{receiptForm.paymentMethod === 'Cheque' && (
										<Input
											label="Cheque number *"
											value={receiptForm.checkNumber || ''}
											onValueChange={(v) => setReceiptForm((f: any) => ({ ...f, checkNumber: v }))}
										/>
									)}
									<Input
										label="Reference / transaction ID"
										placeholder="Bank ref, MoMo txn…"
										value={receiptForm.reference || ''}
										onValueChange={(v) => setReceiptForm((f: any) => ({ ...f, reference: v }))}
										className={receiptForm.paymentMethod === 'Cheque' ? '' : 'col-span-2'}
									/>
									<Input
										label="Notes (optional)"
										placeholder="Internal note"
										value={receiptForm.notes || ''}
										onValueChange={(v) => setReceiptForm((f: any) => ({ ...f, notes: v }))}
										className="col-span-2"
									/>
								</div>

								{!editingReceiptId && (
									<Checkbox
										isSelected={!!receiptForm.printAfterSave}
										onValueChange={(v) => setReceiptForm((f: any) => ({ ...f, printAfterSave: v }))}
										className="mb-2"
									>
										Print receipt after posting (uses hotel receipt template)
									</Checkbox>
								)}
							</ModalBody>
							<ModalFooter>
								<Button variant="light" onPress={onClose}>Cancel</Button>
								<Button color="primary" onPress={saveReceipt}>
									{editingReceiptId
										? 'Save Changes'
										: selectedReceiptTarget?.kind === 'folio'
											? 'Post to Folio'
											: receiptForm.paymentKind === 'wht_only'
												? 'Record WHT'
												: receiptForm.paymentKind === 'wht_settlement'
													? 'Record Payment + WHT'
													: 'Post Receipt'}
								</Button>
							</ModalFooter>
						</>
					)}
				</ModalContent>
			</Modal>

			{/* Print Receipt Modal — same folio/invoice picker as Record Receipt */}
			<Modal isOpen={isPrintReceiptOpen} onOpenChange={setIsPrintReceiptOpen} size="2xl">
				<ModalContent>
					{(onClose) => (
						<>
							<ModalHeader>🖨️ Print Customer Receipt</ModalHeader>
							<ModalBody>
								{formError && (
									<div className="text-red-600 text-sm mb-3 p-2 bg-red-50 rounded">{formError}</div>
								)}
								<p className="text-sm text-gray-600 mb-4">
									Select the same folio or invoice used when recording the payment, then choose which
									payment to print.
								</p>
								<Select
									label="Folio or invoice"
									placeholder="In-house guest or posted invoice"
									selectedKeys={printForm.targetKey ? [printForm.targetKey] : []}
									onSelectionChange={(s) => onPrintTargetSelect(Array.from(s)[0] as string | null)}
									className="mb-4"
								>
									{receiptTargets.map((target: ReceiptTarget) => (
										<SelectItem key={target.key} textValue={target.label}>
											<div className="flex flex-col gap-0.5">
												<span>{target.label}</span>
												<span className="text-xs text-gray-500">{target.sourceBadge}</span>
											</div>
										</SelectItem>
									))}
								</Select>

								{selectedPrintTarget && (
									<Select
										label="Payment to print"
										placeholder="Select payment"
										selectedKeys={
											selectedPrintPayment?.id ? [selectedPrintPayment.id] : []
										}
										onSelectionChange={(s) =>
											setPrintForm((f) => ({
												...f,
												paymentId: Array.from(s)[0] as string,
											}))
										}
										isDisabled={printTargetPayments.length === 0}
									>
										{printTargetPayments.map((p) => (
											<SelectItem
												key={p.id}
												textValue={`${p.paymentNumber || p.id} — ${printCurrency}${Number(p.amount || 0).toLocaleString()}`}
											>
												{p.paymentNumber || p.id} — {new Date(p.date).toLocaleString()} —{' '}
												{printCurrency}
												{Number(p.amount || 0).toLocaleString()}
											</SelectItem>
										))}
									</Select>
								)}

								{selectedPrintTarget && printTargetPayments.length === 0 && (
									<p className="text-sm text-amber-700 mt-3 p-2 bg-amber-50 rounded">
										No payments found for this target yet. Record a receipt first, or pick another
										folio/invoice.
									</p>
								)}
							</ModalBody>
							<ModalFooter>
								<Button variant="light" onPress={onClose}>Cancel</Button>
								<Button
									color="primary"
									isDisabled={!selectedPrintPayment}
									onPress={runPrintReceipt}
								>
									Print
								</Button>
							</ModalFooter>
						</>
					)}
				</ModalContent>
			</Modal>

			{/* Invoice Detail Modal */}
			<Modal isOpen={isDetailOpen} onOpenChange={setIsDetailOpen} size="5xl" scrollBehavior="inside">
				<ModalContent className="max-w-[1200px]">
					{(onClose) => {
						if (!selectedInvoice) return null;
						const source = getSourceLabel(selectedInvoice.sourceModule);
						const balance = (selectedInvoice.total || 0) - (selectedInvoice.paidAmount || 0);
						const invoiceReceipts = getInvoiceReceipts(selectedInvoice.id);
						const isProforma = selectedInvoice.isProforma || selectedInvoice.invoiceNumber?.startsWith('PRO-');
						const isOverdue = !isProforma && balance > 0 && new Date(selectedInvoice.dueDate) < new Date();
						
						// Tax breakdown from invoice or calculate from config
						const subtotal = Number(selectedInvoice.subtotal || 0);
						const totalTax = Number(selectedInvoice.taxAmount || 0);
						
						// Use stored tax breakdown if available, otherwise calculate from config
						const taxBreakdown = selectedInvoice.taxBreakdown || (() => {
							if (totalTax <= 0) return [];
							const breakdown: { code: string; name: string; rate: number; amount: number }[] = [];
							const taxCodes = ['NHIL', 'GETFUND', 'VAT', 'TOURISM'] as const; // Order matters for Ghana (VAT after levies in stored breakdowns)
							let remainingTax = totalTax;
							
							taxCodes.forEach(code => {
								const config = (activeTaxRates as Record<string, { name: string; rate: number }>)[code];
								if (config) {
									const amount = subtotal * (config.rate / 100);
									breakdown.push({
										code,
										name: config.name,
										rate: config.rate,
										amount: Math.min(amount, remainingTax)
									});
									remainingTax -= amount;
								}
							});
							return breakdown;
						})();
						
						const totalTaxRate = taxBreakdown.reduce((sum: number, t: any) => sum + t.rate, 0);
						
						// Line items
						const lineItems = selectedInvoice.items || selectedInvoice.lineItems || [];
						
                                                return (
							<>
								<ModalHeader className="border-b bg-white px-6 py-4">
									<div className="flex justify-between items-start w-full">
										<div>
											<div className="flex items-center gap-2 mb-1">
												<h3 className="text-xl font-bold text-gray-900">{isProforma ? 'PROFORMA INVOICE' : 'SALES INVOICE'}</h3>
												<Chip size="sm" variant="flat" color={balance === 0 ? 'success' : isOverdue ? 'danger' : 'warning'}>
													{balance === 0 ? 'PAID' : isOverdue ? 'OVERDUE' : isProforma ? 'DRAFT' : 'OPEN'}
												</Chip>
											</div>
											<p className="text-lg font-mono text-gray-700">{selectedInvoice.invoiceNumber || selectedInvoice.id}</p>
										</div>
										<div className="text-right text-sm text-gray-600">
											<div>Source: <span className="font-medium">{source.label}</span></div>
											<div>Created: {new Date(selectedInvoice.date).toLocaleString()}</div>
										</div>
									</div>
								</ModalHeader>
								<ModalBody className="p-6 bg-white">
									<div className="space-y-6">
										{/* Header Info Grid */}
										<div className="grid grid-cols-3 gap-6 pb-6 border-b">
											{/* Bill To */}
											<div>
												<h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Bill To</h4>
												<div className="text-sm space-y-1">
													<div className="font-semibold text-gray-900">{selectedInvoice.customerName || 'Walk-in Customer'}</div>
													{selectedInvoice.customerEmail && <div className="text-gray-600">{selectedInvoice.customerEmail}</div>}
													{selectedInvoice.customerPhone && <div className="text-gray-600">{selectedInvoice.customerPhone}</div>}
													<div className="text-gray-500 font-mono text-xs mt-2">ID: {selectedInvoice.businessPartnerId}</div>
                                    </div>
                                </div>

											{/* Invoice Details */}
											<div>
												<h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Invoice Details</h4>
												<div className="text-sm space-y-1">
													<div className="flex justify-between"><span className="text-gray-500">Invoice Date:</span><span className="font-medium">{new Date(selectedInvoice.date).toLocaleDateString()}</span></div>
													<div className="flex justify-between"><span className="text-gray-500">{isProforma ? 'Valid Until:' : 'Due Date:'}</span><span className={`font-medium ${isOverdue ? 'text-red-600' : ''}`}>{new Date(selectedInvoice.dueDate).toLocaleDateString()}</span></div>
													<div className="flex justify-between"><span className="text-gray-500">Reference:</span><span className="font-mono text-xs">{selectedInvoice.reference || '-'}</span></div>
													<div className="flex justify-between"><span className="text-gray-500">Currency:</span><span className="font-medium">GHS (₵)</span></div>
                                        </div>
											</div>
											
											{/* Processed By */}
											<div>
												<h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Processed By</h4>
												<div className="text-sm space-y-1">
													<div className="flex justify-between"><span className="text-gray-500">Staff:</span><span className="font-medium">{selectedInvoice.staffName || 'System'}</span></div>
													<div className="flex justify-between"><span className="text-gray-500">Staff ID:</span><span className="font-mono text-xs">{selectedInvoice.staffId || '-'}</span></div>
													<div className="flex justify-between"><span className="text-gray-500">Role:</span><span>{selectedInvoice.staffRole || 'Staff'}</span></div>
													<div className="flex justify-between"><span className="text-gray-500">Department:</span><span>{source.label}</span></div>
												</div>
											</div>
										</div>
										
										{/* Event/Booking Details (for Proformas) */}
										{isProforma && (selectedInvoice.eventId || selectedInvoice.checkIn || selectedInvoice.venue) && (
											<div className="pb-6 border-b">
												<h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Event / Booking Information</h4>
												<div className="grid grid-cols-5 gap-4 text-sm">
													{selectedInvoice.eventId && <div><span className="text-gray-500 block">Event ID</span><span className="font-mono">{selectedInvoice.eventId}</span></div>}
													{selectedInvoice.checkIn && <div><span className="text-gray-500 block">Check-In</span><span className="font-medium">{new Date(selectedInvoice.checkIn).toLocaleDateString()}</span></div>}
													{selectedInvoice.checkOut && <div><span className="text-gray-500 block">Check-Out</span><span className="font-medium">{new Date(selectedInvoice.checkOut).toLocaleDateString()}</span></div>}
													{selectedInvoice.pax && <div><span className="text-gray-500 block">Guests/Pax</span><span className="font-semibold">{selectedInvoice.pax}</span></div>}
													{selectedInvoice.venue && <div><span className="text-gray-500 block">Venue</span><span className="font-medium">{selectedInvoice.venue}</span></div>}
												</div>
											</div>
										)}

										{/* Line Items Table */}
										<div className="pb-6 border-b">
											<h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Line Items</h4>
											<table className="w-full text-sm">
												<thead>
													<tr className="border-b-2 border-gray-200">
														<th className="text-left py-2 text-gray-600 font-semibold">#</th>
														<th className="text-left py-2 text-gray-600 font-semibold">Description</th>
														<th className="text-right py-2 text-gray-600 font-semibold">Qty</th>
														<th className="text-right py-2 text-gray-600 font-semibold">Unit Price</th>
														<th className="text-right py-2 text-gray-600 font-semibold">Amount</th>
													</tr>
												</thead>
												<tbody>
													{lineItems.length > 0 ? lineItems.map((item: any, idx: number) => (
														<tr key={idx} className="border-b border-gray-100">
															<td className="py-2 text-gray-500">{idx + 1}</td>
															<td className="py-2">{item.description || item.name}</td>
															<td className="py-2 text-right">{item.quantity || item.qty || 1}</td>
															<td className="py-2 text-right">₵{Number(item.unitPrice || item.price || 0).toLocaleString()}</td>
															<td className="py-2 text-right font-medium">₵{Number((item.quantity || item.qty || 1) * (item.unitPrice || item.price || 0)).toLocaleString()}</td>
														</tr>
													)) : (
														<tr className="border-b border-gray-100">
															<td className="py-2 text-gray-500">1</td>
															<td className="py-2">{selectedInvoice.description || 'Services/Products'}</td>
															<td className="py-2 text-right">1</td>
															<td className="py-2 text-right">₵{subtotal.toLocaleString()}</td>
															<td className="py-2 text-right font-medium">₵{subtotal.toLocaleString()}</td>
														</tr>
													)}
												</tbody>
											</table>
										</div>

										{/* Financial Summary with Tax Breakdown */}
										<div className="grid grid-cols-2 gap-8">
											{/* Tax Breakdown */}
											<div>
												<div className="flex items-center justify-between mb-3">
													<h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Tax Breakdown (Ghana GRA)</h4>
													<Tooltip content="Tax rates from system configuration">
														<span className="text-xs text-gray-400 cursor-help">ⓘ</span>
													</Tooltip>
												</div>
												<div className="bg-gray-50 rounded-lg p-4 text-sm">
													<table className="w-full">
														<tbody>
															{taxBreakdown.length > 0 ? taxBreakdown.map((tax: any, idx: number) => (
																<tr key={tax.code || idx} className="border-b border-gray-200">
																	<td className="py-2 text-gray-600">{tax.name} ({tax.rate}%)</td>
																	<td className="py-2 text-right font-mono">₵{Number(tax.amount || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
																</tr>
															)) : (
																<tr className="border-b border-gray-200">
																	<td className="py-2 text-gray-400 italic" colSpan={2}>No taxes applied</td>
																</tr>
															)}
															<tr className="font-semibold">
																<td className="py-2 text-gray-800">Total Tax ({totalTaxRate.toFixed(1)}%)</td>
																<td className="py-2 text-right font-mono">₵{totalTax.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
															</tr>
														</tbody>
													</table>
												</div>
											</div>
											
											{/* Amount Summary */}
											<div>
												<h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Amount Summary</h4>
												<div className="bg-gray-50 rounded-lg p-4 text-sm">
													<table className="w-full">
														<tbody>
															<tr className="border-b border-gray-200">
																<td className="py-2 text-gray-600">Subtotal</td>
																<td className="py-2 text-right font-mono">₵{subtotal.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
															</tr>
															<tr className="border-b border-gray-200">
																<td className="py-2 text-gray-600">Total Tax</td>
																<td className="py-2 text-right font-mono">₵{totalTax.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
															</tr>
															<tr className="border-b border-gray-200 font-semibold text-base">
																<td className="py-3 text-gray-900">TOTAL AMOUNT</td>
																<td className="py-3 text-right font-mono">₵{Number(selectedInvoice.total || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
															</tr>
															<tr className="border-b border-gray-200">
																<td className="py-2 text-green-700">Amount Paid</td>
																<td className="py-2 text-right font-mono text-green-700">₵{Number(selectedInvoice.paidAmount || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
															</tr>
															<tr className={`font-bold text-lg ${balance > 0 ? 'text-red-700' : 'text-green-700'}`}>
																<td className="py-3">BALANCE DUE</td>
																<td className="py-3 text-right font-mono">₵{balance.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
															</tr>
														</tbody>
													</table>
												</div>
											</div>
										</div>

										{/* Payment History */}
										{!isProforma && (
											<div className="pt-6 border-t">
												<h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Payment History ({invoiceReceipts.length})</h4>
												{invoiceReceipts.length > 0 ? (
													<table className="w-full text-sm">
														<thead>
															<tr className="border-b-2 border-gray-200">
																<th className="text-left py-2 text-gray-600 font-semibold">Receipt #</th>
																<th className="text-left py-2 text-gray-600 font-semibold">Date/Time</th>
																<th className="text-left py-2 text-gray-600 font-semibold">Method</th>
																<th className="text-left py-2 text-gray-600 font-semibold">Processed By</th>
																<th className="text-right py-2 text-gray-600 font-semibold">Amount</th>
															</tr>
														</thead>
														<tbody>
															{invoiceReceipts.map((r: any) => (
																<tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50">
																	<td className="py-2 font-mono text-xs">{r.paymentNumber || r.id}</td>
																	<td className="py-2">{new Date(r.date).toLocaleString()}</td>
																	<td className="py-2">{r.paymentMethod}</td>
																	<td className="py-2">{r.staffName || '-'}</td>
																	<td className="py-2 text-right font-semibold text-green-700">₵{Number(r.amount).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
																</tr>
															))}
														</tbody>
													</table>
												) : (
													<div className="text-center py-6 text-gray-500 bg-gray-50 rounded">
														No payments recorded
													</div>
												)}
											</div>
										)}
									</div>
                            </ModalBody>
								<ModalFooter className="border-t bg-white">
									<Button variant="flat" onPress={onClose}>Close</Button>
									{isProforma && (
										<Button color="primary" onPress={() => handleConvertProforma(selectedInvoice)}>
											Convert to sales invoice
										</Button>
									)}
									{!isProforma && selectedInvoice.status !== 'Void' && isManualArApSource(selectedInvoice.sourceModule) && invoiceReceipts.length === 0 && (
										<Button color="danger" variant="flat" onPress={() => handleVoidInvoice(selectedInvoice)}>
											Void invoice
										</Button>
									)}
									{!isProforma && balance > 0 && (
										<>
											<Button
												color="primary"
												variant="flat"
												onPress={() => { openReceiptForm(selectedInvoice); setIsDetailOpen(false); }}
											>
												➕ Record receipt
											</Button>
											<Button 
												color="warning" 
												variant="flat" 
												onPress={() => { openWHTPayment(selectedInvoice, 'settlement'); setIsDetailOpen(false); }}
											>
												💰 Payment + WHT
											</Button>
											{computeInvoiceWhtSettlement(selectedInvoice, taxConfigs).whtTotalRemaining > 0 && (
												<Button 
													color="secondary" 
													variant="flat" 
													onPress={() => { openWHTPayment(selectedInvoice, 'wht_only'); setIsDetailOpen(false); }}
												>
													📜 WHT only
												</Button>
											)}
										</>
									)}
									<Button color="primary" variant="flat" onPress={() => printInvoicePDF(selectedInvoice)}>
										Print PDF
									</Button>
                            </ModalFooter>
                        </>
						);
					}}
				</ModalContent>
			</Modal>

			{/* Receipt Detail Modal - Clean Accounting Style */}
			<Modal isOpen={isReceiptDetailOpen} onOpenChange={setIsReceiptDetailOpen} size="4xl" scrollBehavior="inside">
				<ModalContent className="max-w-[900px]">
					{(onClose) => {
						if (!selectedReceipt) return null;
						const source = getSourceLabel(selectedReceipt.sourceModule);
						const linkedInvoice = getReceiptInvoice(selectedReceipt.invoiceId);
						const invoiceBalance = linkedInvoice ? (linkedInvoice.total || 0) - (linkedInvoice.paidAmount || 0) : 0;
						
						return (
							<>
								<ModalHeader className="border-b bg-white px-6 py-4">
									<div className="flex justify-between items-start w-full">
										<div>
											<div className="flex items-center gap-2 mb-1">
												<h3 className="text-xl font-bold text-gray-900">PAYMENT RECEIPT</h3>
												<Chip
													size="sm"
													variant="flat"
													color={selectedReceipt.status === 'Void' ? 'danger' : 'success'}
												>
													{selectedReceipt.status === 'Void' ? 'VOID' : 'POSTED'}
												</Chip>
											</div>
											<p className="text-lg font-mono text-gray-700">{selectedReceipt.paymentNumber || selectedReceipt.id}</p>
										</div>
										<div className="text-right text-sm text-gray-600">
											<div>Source: <span className="font-medium">{source.label}</span></div>
											<div>Posted: {new Date(selectedReceipt.date).toLocaleString()}</div>
										</div>
									</div>
								</ModalHeader>
								<ModalBody className="p-6 bg-white">
									<div className="space-y-6">
										{/* Amount Received - Clean Highlight */}
										<div className="text-center py-6 border-b">
											<p className="text-sm text-gray-500 uppercase tracking-wide mb-2">Amount Received</p>
											<p className="text-4xl font-bold text-gray-900">₵{Number(selectedReceipt.amount || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
											<p className="text-sm text-gray-500 mt-2">{selectedReceipt.currency || 'GHS'} • {selectedReceipt.paymentMethod || 'Cash'}</p>
										</div>

										{/* Receipt Details Grid */}
										<div className="grid grid-cols-2 gap-6 pb-6 border-b">
											{/* Received From */}
											<div>
												<h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Received From</h4>
												<div className="text-sm space-y-1">
													<div className="font-semibold text-gray-900">{selectedReceipt.customerName || 'Walk-in Customer'}</div>
													<div className="text-gray-500 font-mono text-xs mt-2">ID: {selectedReceipt.businessPartnerId || '-'}</div>
												</div>
											</div>
											
											{/* Processed By */}
											<div>
												<h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Processed By</h4>
												<div className="text-sm space-y-1">
													<div className="flex justify-between"><span className="text-gray-500">Staff:</span><span className="font-medium">{selectedReceipt.staffName || 'System'}</span></div>
													<div className="flex justify-between"><span className="text-gray-500">Staff ID:</span><span className="font-mono text-xs">{selectedReceipt.staffId || '-'}</span></div>
													<div className="flex justify-between"><span className="text-gray-500">Role:</span><span>{selectedReceipt.staffRole || 'Staff'}</span></div>
													<div className="flex justify-between"><span className="text-gray-500">Department:</span><span>{source.label}</span></div>
												</div>
											</div>
										</div>

										{/* Payment Details */}
										<div className="pb-6 border-b">
											<h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Payment Details</h4>
											<div className="bg-gray-50 rounded-lg p-4 text-sm">
												<table className="w-full">
													<tbody>
														<tr className="border-b border-gray-200">
															<td className="py-2 text-gray-600">Payment Method</td>
															<td className="py-2 text-right font-medium">{selectedReceipt.paymentMethod || 'Cash'}</td>
														</tr>
														<tr className="border-b border-gray-200">
															<td className="py-2 text-gray-600">Transaction Date</td>
															<td className="py-2 text-right">{new Date(selectedReceipt.date).toLocaleDateString()}</td>
														</tr>
														<tr className="border-b border-gray-200">
															<td className="py-2 text-gray-600">Transaction Time</td>
															<td className="py-2 text-right">{new Date(selectedReceipt.date).toLocaleTimeString()}</td>
														</tr>
														<tr className="border-b border-gray-200">
															<td className="py-2 text-gray-600">Reference</td>
															<td className="py-2 text-right font-mono text-xs">{selectedReceipt.reference || '-'}</td>
														</tr>
														<tr className="border-b border-gray-200">
															<td className="py-2 text-gray-600">Currency</td>
															<td className="py-2 text-right">{selectedReceipt.currency || 'GHS'}</td>
														</tr>
														<tr className="font-semibold">
															<td className="py-2 text-gray-800">Amount</td>
															<td className="py-2 text-right font-mono text-green-700">₵{Number(selectedReceipt.amount || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
														</tr>
													</tbody>
												</table>
											</div>
										</div>

										{/* Linked Invoice */}
										{linkedInvoice && (
											<div className="pb-6 border-b">
												<h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Applied To Invoice</h4>
												<div className="bg-gray-50 rounded-lg p-4 text-sm">
													<table className="w-full">
														<tbody>
															<tr className="border-b border-gray-200">
																<td className="py-2 text-gray-600">Invoice Number</td>
																<td className="py-2 text-right font-mono">{(linkedInvoice as any).invoiceNumber || linkedInvoice.id}</td>
															</tr>
															<tr className="border-b border-gray-200">
																<td className="py-2 text-gray-600">Invoice Total</td>
																<td className="py-2 text-right font-mono">₵{Number(linkedInvoice.total || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
															</tr>
															<tr className="border-b border-gray-200">
																<td className="py-2 text-gray-600">Total Paid (incl. this receipt)</td>
																<td className="py-2 text-right font-mono text-green-700">₵{Number(linkedInvoice.paidAmount || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
															</tr>
															<tr className={`font-semibold ${invoiceBalance > 0 ? 'text-red-700' : 'text-green-700'}`}>
																<td className="py-2">Invoice Balance</td>
																<td className="py-2 text-right font-mono">₵{invoiceBalance.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
															</tr>
														</tbody>
													</table>
												</div>
											</div>
										)}

										{/* Description / Notes */}
										{selectedReceipt.description && (
											<div>
												<h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Notes / Description</h4>
												<p className="text-sm text-gray-700 bg-gray-50 p-4 rounded">{selectedReceipt.description}</p>
											</div>
										)}
									</div>
								</ModalBody>
								<ModalFooter className="border-t bg-white">
									<Button variant="flat" onPress={onClose}>Close</Button>
									{selectedReceipt.status !== 'Void' && receiptCanEdit(selectedReceipt) && (
										<Button
											variant="flat"
											onPress={() => {
												openEditReceiptForm(selectedReceipt);
												setIsReceiptDetailOpen(false);
											}}
										>
											Edit
										</Button>
									)}
									{selectedReceipt.status !== 'Void' && receiptCanVoid(selectedReceipt) && (
										<Button color="danger" variant="flat" onPress={() => handleVoidReceipt(selectedReceipt)}>
											Void receipt
										</Button>
									)}
									<Button color="primary" variant="flat" onPress={() => printReceiptPDF(selectedReceipt)}>
										Print Receipt
									</Button>
								</ModalFooter>
							</>
						);
					}}
                </ModalContent>
            </Modal>
		</div>
	);
}
