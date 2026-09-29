'use client';

import React, { useMemo, useState, useCallback, useEffect } from 'react';
import HeadingInfo from '../HeadingInfo';
import {
	Card, CardBody, Button,
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
import { buildOrgProfile } from '@/app/lib/print/buildOrgProfile';
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
import { convertProformaToInvoice, GL_ACCOUNTS } from '@/app/lib/accounting/integration';
import { computeSalesTax } from '@/app/lib/tax/engine';
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from '@heroui/react';
import { formatAccountingCurrency } from '@/app/lib/accounting/tenantAccountingConfig';
import { downloadCSV, openPrintPreview, generatePdfHtml } from '@/app/lib/accounting/helpers/exportHelpers';
import AttachmentUpload from '@/app/components/shared/AttachmentUpload';
import { SortLabel, deskResizableTableClassNames, rowClassNames, useResizableColumns } from '../frontoffice/columnResize';
import { useDeskPagination } from '../dashboard/deskTableUi';
import { DeskKpiStrip, deskBookTabsClassNames, deskBookTabPanelClassName } from './DeskKpiStrip';

// Shared by the New Invoice form's "new customer" payment-terms select and the due-date
// auto-calc below it — keeps both in sync with the one mapping instead of two copies.
const PAYMENT_TERMS_DAYS: Record<string, number> = { immediate: 0, net30: 30, net60: 60, net90: 90 };

type SalesSortKey =
	| 'invoice' | 'source' | 'customer' | 'date' | 'dueDate' | 'staff'
	| 'total' | 'paid' | 'balance' | 'status' | 'wht' | 'gl';
type ProformaSortKey =
	| 'proforma' | 'source' | 'client' | 'event' | 'dates' | 'pax' | 'venue'
	| 'amount' | 'validUntil' | 'status';
type AgingSortKey =
	| 'customer' | 'source' | 'invoiced' | 'paid' | 'balance'
	| 'current' | 'days30' | 'days60' | 'days90' | 'over90';
type ReceiptSortKey =
	| 'receipt' | 'source' | 'customer' | 'date' | 'time' | 'method' | 'staff'
	| 'invoice' | 'amount' | 'status';
type WhtSortKey =
	| 'certificate' | 'agent' | 'tin' | 'invoice' | 'taxPeriod'
	| 'wht' | 'whtVat' | 'total' | 'status';

function deskCmp(a: string | number, b: string | number) {
	if (typeof a === 'number' && typeof b === 'number') return a - b;
	return String(a).localeCompare(String(b));
}

function formatDeskDate(value: unknown): string {
	if (value == null || value === '') return '—';
	const d = value instanceof Date ? value : new Date(String(value));
	return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

function isPastDue(dueDate: unknown, balance: number): boolean {
	if (!(balance > 0) || dueDate == null || dueDate === '') return false;
	const d = dueDate instanceof Date ? dueDate : new Date(String(dueDate));
	return !Number.isNaN(d.getTime()) && d < new Date();
}

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
	const [refreshKey, setRefreshKey] = useState(0);
	const [isRefreshing, setIsRefreshing] = useState(false);

	// Filters
	const [statusFilter, setStatusFilter] = useState('all');
	const [sourceFilter, setSourceFilter] = useState('all');
	const [dateFrom, setDateFrom] = useState('');
	const [dateTo, setDateTo] = useState('');
	const [searchQuery, setSearchQuery] = useState('');
	// Sales Invoices and Proforma Invoices are the same underlying document set
	// (allSalesInvoices, split by isProforma) — one merged tab toggles which
	// subset is shown instead of forcing two separate top-level tabs.
	const [invoiceDocType, setInvoiceDocType] = useState<'sales' | 'proforma'>('sales');

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
	const printOrg = useMemo(() => buildOrgProfile(settings), [settings]);
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
	const allCustomerAging = useMemo(
		() => computeCustomerAgingFromInvoices(salesInvoices, customers),
		[salesInvoices, customers],
	);
	const agingScopeInvoices = useMemo(() => {
		return salesInvoices.filter((inv: any) => {
			if (sourceFilter !== 'all' && !sourceMatchesFilter(inv.sourceModule, sourceFilter)) return false;
			if (dateFrom && new Date(inv.date) < new Date(dateFrom)) return false;
			if (dateTo && new Date(inv.date) > new Date(dateTo)) return false;
			return true;
		});
	}, [salesInvoices, sourceFilter, dateFrom, dateTo]);
	const scopedCustomerAging = useMemo(
		() => computeCustomerAgingFromInvoices(agingScopeInvoices, customers),
		[agingScopeInvoices, customers],
	);
	const filteredAging = useMemo(() => {
		if (!searchQuery) return scopedCustomerAging;
		const q = searchQuery.toLowerCase();
		return scopedCustomerAging.filter((c: any) =>
			(c.customerName || '').toLowerCase().includes(q) ||
			(c.customerId || '').toLowerCase().includes(q),
		);
	}, [scopedCustomerAging, searchQuery]);
	const customerAging = allCustomerAging;

	// Totals — finance AR subledger (posted sales invoices only)
	const financeInvoices = useMemo(() => filterFinanceArInvoices(salesInvoices), [salesInvoices]);
	const totalRevenue = financeInvoices.reduce((s: number, i: any) => s + (i.total || 0), 0);
	const totalReceived = financeInvoices.reduce((s: number, i: any) => s + (i.paidAmount || 0), 0);
	const totalOutstanding = totalFinanceReceivables(salesInvoices);
	const totalProforma = proformaInvoices.reduce((s: number, i: any) => s + (i.total || 0), 0);

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
	const [receiveCertForm, setReceiveCertForm] = useState<{ certificateNumber: string; withholdingAgentTIN: string; attachments: string[] }>({ certificateNumber: '', withholdingAgentTIN: '', attachments: [] });
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
	const openAgingCustomer = (c: any) => {
		setSearchQuery(c.customerName || '');
		setStatusFilter('all');
		setDateFrom('');
		setDateTo('');
		setInvoiceDocType('sales');
		setSelectedTab('invoices');
	};

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
		downloadCSV(filteredAging, 'customer_aging', columns);
	}, [filteredAging]);

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
				<td class="amount">${formatAccountingCurrency(Number(inv.total || 0))}</td>
				<td class="amount">${formatAccountingCurrency(Number(inv.paidAmount || 0))}</td>
				<td class="amount">${formatAccountingCurrency(balance)}</td>
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
				<div class="meta-item"><div class="meta-label">Total Amount</div><div class="meta-value">${formatAccountingCurrency(totalAmount)}</div></div>
				<div class="meta-item"><div class="meta-label">Total Paid</div><div class="meta-value">${formatAccountingCurrency(totalPaid)}</div></div>
				<div class="meta-item"><div class="meta-label">Outstanding</div><div class="meta-value">${formatAccountingCurrency((totalAmount - totalPaid))}</div></div>
			</div>
			<table>
				<thead><tr><th>Invoice #</th><th>Customer</th><th>Source</th><th>Date</th><th>Total</th><th>Paid</th><th>Balance</th><th>Status</th></tr></thead>
				<tbody>${rows}</tbody>
			</table>
		`, 'Accounts Receivable • Sales Invoices');
		openPrintPreview(html);
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
				<td class="amount">${formatAccountingCurrency(Number(inv.total || 0))}</td>
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
				<div class="meta-item"><div class="meta-label">Total Value</div><div class="meta-value">${formatAccountingCurrency(totalAmount)}</div></div>
			</div>
			<table>
				<thead><tr><th>Proforma #</th><th>Client</th><th>Event</th><th>Pax</th><th>Venue</th><th>Amount</th><th>Valid Until</th><th>Status</th></tr></thead>
				<tbody>${rows}</tbody>
			</table>
		`, 'Accounts Receivable • Proforma Invoices');
		openPrintPreview(html);
	}, [filteredProformas]);

	// Print Receipts Table as PDF
	const printReceiptsTablePDF = useCallback(() => {
		const rows = filteredReceipts.map((r: any) => `<tr>
			<td>${r.paymentNumber || r.id}</td>
			<td>${r.customerName || '-'}</td>
			<td>${getSourceLabel(r.sourceModule).label}</td>
			<td>${new Date(r.date).toLocaleString()}</td>
			<td>${r.paymentMethod || 'Cash'}</td>
			<td class="amount">${formatAccountingCurrency(Number(r.amount || 0))}</td>
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
				<div class="meta-item"><div class="meta-label">Total Received</div><div class="meta-value">${formatAccountingCurrency(totalAmount)}</div></div>
			</div>
			<table>
				<thead><tr><th>Receipt #</th><th>Customer</th><th>Source</th><th>Date/Time</th><th>Method</th><th>Amount</th><th>Staff</th></tr></thead>
				<tbody>${rows}</tbody>
			</table>
		`, 'Accounts Receivable • Receipts');
		openPrintPreview(html);
	}, [filteredReceipts]);

	// Export WHT Certificates to CSV
	const exportWHTCertificatesCSV = useCallback(() => {
		const columns = [
			{ key: 'certificateNumber', label: 'Certificate #' },
			{ key: 'withholdingAgentName', label: 'Agent' },
			{ key: 'withholdingAgentTIN', label: 'TIN' },
			{ key: 'invoiceNumber', label: 'Invoice' },
			{ key: 'taxPeriod', label: 'Tax Period' },
			{ key: 'whtAmount', label: 'WHT' },
			{ key: 'whtVatAmount', label: 'WHT-VAT' },
			{ key: 'totalWithheld', label: 'Total' },
			{ key: 'status', label: 'Status' },
		];
		downloadCSV(filteredWHTCerts, 'wht_certificates', columns);
	}, [filteredWHTCerts]);

	// Print WHT Certificates Table as PDF
	const printWHTCertificatesTablePDF = useCallback(() => {
		const rows = filteredWHTCerts.map((cert: any) => `<tr>
			<td>${cert.certificateNumber || 'PENDING'}</td>
			<td>${cert.withholdingAgentName || '-'}</td>
			<td>${cert.withholdingAgentTIN || '-'}</td>
			<td>${cert.invoiceNumber || '-'}</td>
			<td>${cert.taxPeriod || '-'}</td>
			<td class="amount">${formatAccountingCurrency(Number(cert.whtAmount || 0))}</td>
			<td class="amount">${formatAccountingCurrency(Number(cert.whtVatAmount || 0))}</td>
			<td class="amount">${formatAccountingCurrency(Number(cert.totalWithheld || 0))}</td>
			<td><span class="badge ${cert.status === 'Verified' ? 'badge-success' : cert.status === 'Received' ? 'badge-info' : 'badge-warning'}">${cert.status}</span></td>
		</tr>`).join('');
		const totalWithheld = filteredWHTCerts.reduce((s: number, c: any) => s + (c.totalWithheld || 0), 0);
		const html = generatePdfHtml('WHT Certificates Report', `
			<div class="header">
				<h1>📜 WHT Certificates Report</h1>
				<div class="subtitle">Generated on ${new Date().toLocaleString()}</div>
			</div>
			<div class="meta">
				<div class="meta-item"><div class="meta-label">Total Certificates</div><div class="meta-value">${filteredWHTCerts.length}</div></div>
				<div class="meta-item"><div class="meta-label">Total Tax Credit</div><div class="meta-value">${formatAccountingCurrency(totalWithheld)}</div></div>
			</div>
			<table>
				<thead><tr><th>Certificate #</th><th>Agent</th><th>TIN</th><th>Invoice</th><th>Tax Period</th><th>WHT</th><th>WHT-VAT</th><th>Total</th><th>Status</th></tr></thead>
				<tbody>${rows}</tbody>
			</table>
		`, 'Accounts Receivable • WHT Certificates');
		openPrintPreview(html);
	}, [filteredWHTCerts]);

	// Print Aging Report as PDF
	const printAgingPDF = useCallback(() => {
		const rows = filteredAging.map((c: any) => `<tr>
			<td>${c.customerName}</td>
			<td>${c.invoiceCount}</td>
			<td class="amount">${formatAccountingCurrency(c.totalInvoiced)}</td>
			<td class="amount">${formatAccountingCurrency(c.totalPaid)}</td>
			<td class="amount" style="font-weight:bold">${formatAccountingCurrency(c.balance)}</td>
			<td class="amount">${c.current > 0 ? `${formatAccountingCurrency(c.current)}` : '-'}</td>
			<td class="amount" style="color:#ca8a04">${c.days30 > 0 ? `${formatAccountingCurrency(c.days30)}` : '-'}</td>
			<td class="amount" style="color:#ea580c">${c.days60 > 0 ? `${formatAccountingCurrency(c.days60)}` : '-'}</td>
			<td class="amount" style="color:#dc2626">${c.days90 > 0 ? `${formatAccountingCurrency(c.days90)}` : '-'}</td>
			<td class="amount" style="color:#991b1b;font-weight:bold">${c.over90 > 0 ? `${formatAccountingCurrency(c.over90)}` : '-'}</td>
		</tr>`).join('');
		const totals = filteredAging.reduce((acc: any, c: any) => ({
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
				<div class="meta-item"><div class="meta-label">Active Customers</div><div class="meta-value">${filteredAging.length}</div></div>
				<div class="meta-item"><div class="meta-label">Total Outstanding</div><div class="meta-value">${formatAccountingCurrency(totals.balance)}</div></div>
				<div class="meta-item"><div class="meta-label">Overdue (30+ days)</div><div class="meta-value">${formatAccountingCurrency((totals.days30 + totals.days60 + totals.days90 + totals.over90))}</div></div>
			</div>
			<table>
				<thead><tr><th>Customer</th><th>Invoices</th><th>Invoiced</th><th>Paid</th><th>Balance</th><th>Current</th><th>1-30</th><th>31-60</th><th>61-90</th><th>90+</th></tr></thead>
				<tbody>${rows}
				<tr class="total-row">
					<td colspan="4"><strong>TOTAL</strong></td>
					<td class="amount">${formatAccountingCurrency(totals.balance)}</td>
					<td class="amount">${formatAccountingCurrency(totals.current)}</td>
					<td class="amount">${formatAccountingCurrency(totals.days30)}</td>
					<td class="amount">${formatAccountingCurrency(totals.days60)}</td>
					<td class="amount">${formatAccountingCurrency(totals.days90)}</td>
					<td class="amount">${formatAccountingCurrency(totals.over90)}</td>
				</tr>
				</tbody>
			</table>
		`, 'Accounts Receivable • Customer Aging Analysis');
		openPrintPreview(html);
	}, [filteredAging]);

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
			<td class="amount">${formatAccountingCurrency(Number(r.amount))}</td>
		</tr>`).join('') || '<tr><td colspan="4" style="text-align:center;color:#6b7280">No payments recorded</td></tr>';

		// Same canonical stacked-tax reconstruction as the on-screen invoice modal, so the
		// PDF itemizes VAT/NHIL/GETFund/Tourism instead of a single opaque "Tax" line.
		const pdfSubtotal = Number(invoice.subtotal || 0);
		const pdfTotalTax = Number(invoice.taxAmount || 0);
		const pdfTaxBreakdown: { name: string; rate: number; amount: number }[] =
			invoice.taxBreakdown && invoice.taxBreakdown.length > 0
				? invoice.taxBreakdown
				: (pdfSubtotal > 0 ? computeSalesTax(pdfSubtotal, pdfTotalTax).lines.map(l => ({ name: l.name, rate: l.rate, amount: l.amount })) : []);
		const taxBreakdownRows = pdfTaxBreakdown.map(t =>
			`<tr><td>${t.name} (${t.rate}%)</td><td class="amount">${formatAccountingCurrency(Number(t.amount))}</td></tr>`
		).join('');

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

			${taxBreakdownRows ? `
			<div class="section">
				<div class="section-title">Tax Breakdown (Ghana GRA)</div>
				<table>
					${taxBreakdownRows}
				</table>
			</div>
			` : ''}

			<div class="section">
				<div class="section-title">Financial Summary</div>
				<table>
					<tr><td style="width:70%">Subtotal</td><td class="amount">${formatAccountingCurrency(Number(invoice.subtotal || 0))}</td></tr>
					<tr><td>Total Tax</td><td class="amount">${formatAccountingCurrency(Number(invoice.taxAmount || 0))}</td></tr>
					<tr class="total-row"><td><strong>Total</strong></td><td class="amount"><strong>${formatAccountingCurrency(Number(invoice.total || 0))}</strong></td></tr>
					${!isProforma ? `
					<tr><td>Paid</td><td class="amount" style="color:#16a34a">${formatAccountingCurrency(Number(invoice.paidAmount || 0))}</td></tr>
					<tr><td><strong>Balance Due</strong></td><td class="amount" style="color:${balance > 0 ? '#ea580c' : '#16a34a'};font-weight:bold">${formatAccountingCurrency(balance)}</td></tr>
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
		openPrintPreview(html);
	}, [getInvoiceReceipts]);

	// Print Individual Receipt (hotel template via folio/invoice picker context)
	const printReceiptPDF = useCallback(
		(receipt: StoredReceiptPayment) => {
			printCustomerReceiptForPayment(receipt);
		},
		[printCustomerReceiptForPayment],
	);

	// Recomputes Due Date from Invoice Date + payment terms — an existing customer's own
	// terms on file, or the "new customer" terms picked in this same form — instead of a
	// flat +30 days regardless of who's actually being billed.
	const dueDateFromTerms = (dateStr: string, businessPartnerId: string, newCustomerTerms: string): string => {
		const days = businessPartnerId
			? (customers.find((c) => c.id === businessPartnerId)?.paymentTerms ?? 30)
			: (PAYMENT_TERMS_DAYS[newCustomerTerms] ?? 30);
		const base = dateStr ? new Date(dateStr) : new Date();
		return new Date(base.getTime() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
	};

	// New invoice/proforma
	const openNewInvoice = (isProforma: boolean = false) => {
		setInvoiceForm({
			businessPartnerId: '',
			customerName: '',
			customerPhone: '',
			customerEmail: '',
			customerAddress: '',
			customerTaxNumber: '',
			customerCreditLimit: 0,
			customerPaymentTerms: 'net30',
			invoiceNumber: '',
			poNumber: '',
			date: new Date().toISOString().slice(0, 10),
			dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
			description: '',
			subtotal: 0,
			taxAmount: 0,
			total: 0,
			taxType: 'STANDARD',
			customTaxPercent: 0,
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
		const typedNumber = invoiceForm.invoiceNumber?.trim();
		const invoiceNumber = typedNumber || (isProforma ? settings.getNextProformaInvoiceNumber() : settings.getNextInvoiceNumber());

		const subtotal = Number(invoiceForm.subtotal || invoiceForm.total);
		const invoiceId = `${prefix}-${Date.now()}`;

		// A customer typed by name with no existing business partner selected needs a real
		// BusinessPartner record — otherwise their running balance never appears anywhere
		// (addInvoice's balance update only touches an existing partner by id) even though the
		// invoice itself saves fine. Capture the same level of contact/credit detail AP's Add
		// Supplier form does, so a new AR customer isn't a bare name with nothing else on file.
		let businessPartnerId = invoiceForm.businessPartnerId;
		if (!businessPartnerId) {
			businessPartnerId = `CUST-${Date.now()}`;
			const now = new Date().toISOString();
			addBusinessPartner({
				id: businessPartnerId,
				code: `CUST-${String(businessPartners.length + 1).padStart(4, '0')}`,
				name: invoiceForm.customerName.trim(),
				type: 'Customer',
				phone: invoiceForm.customerPhone || '',
				email: invoiceForm.customerEmail || '',
				address: invoiceForm.customerAddress || '',
				taxNumber: invoiceForm.customerTaxNumber || '',
				creditLimit: Number(invoiceForm.customerCreditLimit || 0),
				paymentTerms: PAYMENT_TERMS_DAYS[invoiceForm.customerPaymentTerms] ?? 30,
				glAccountCode: GL_ACCOUNTS.ACCOUNTS_RECEIVABLE,
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
			invoiceNumber,
			type: 'Sales' as const,
			isProforma: isProforma,
			date: new Date(invoiceForm.date).toISOString(),
			dueDate: new Date(invoiceForm.dueDate).toISOString(),
			businessPartnerId,
			customerName: invoiceForm.customerName,
			description: invoiceForm.description || (isProforma ? 'Proforma invoice' : 'Sales invoice'),
			poNumber: invoiceForm.poNumber || '',
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
					glAccountCode: GL_ACCOUNTS.OTHER_REVENUE,
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
			attachments: receipt.attachments || [],
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
				whtHasTax: true,
				whtHasVat: true,
				amount: settlement.cashRemaining,
			}));
		} else if (kind === 'wht_only' && settlement) {
			setReceiptForm((f: any) => ({
				...f,
				paymentKind: kind,
				cashAmount: 0,
				whtAmount: settlement.whtRemaining,
				whtVatAmount: settlement.whtVatRemaining,
				whtHasTax: true,
				whtHasVat: true,
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

	// Same flag-not-just-disable pattern as toggleWhtHasTax/toggleWhtHasVat above, for the
	// Record Receipt modal's WHT settlement mode.
	const toggleReceiptWhtHasTax = (checked: boolean) => {
		setReceiptForm((f: any) => {
			if (!checked) return { ...f, whtHasTax: false, whtAmount: 0 };
			const invoice = selectedReceiptInvoice;
			const settlement = invoice ? computeInvoiceWhtSettlement(invoice, taxConfigs) : null;
			return { ...f, whtHasTax: true, whtAmount: settlement?.whtRemaining ?? f.whtAmount };
		});
	};

	const toggleReceiptWhtHasVat = (checked: boolean) => {
		setReceiptForm((f: any) => {
			if (!checked) return { ...f, whtHasVat: false, whtVatAmount: 0 };
			const invoice = selectedReceiptInvoice;
			const settlement = invoice ? computeInvoiceWhtSettlement(invoice, taxConfigs) : null;
			return { ...f, whtHasVat: true, whtVatAmount: settlement?.whtVatRemaining ?? f.whtVatAmount };
		});
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
					`Total (${formatAccountingCurrency(totalEntered)}) exceeds balance due (${formatAccountingCurrency(balanceDue)})`,
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
			// recordWHTPayment doesn't take attachments (it's a store-level settlement helper
			// shared with the WHT-only flow) — attach proof-of-payment as a follow-up update
			// instead of widening that function's params for a UI-only field.
			if (receiptForm.attachments?.length > 0) {
				updatePayment(result.receiptId, { attachments: receiptForm.attachments });
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
				attachments: receiptForm.attachments?.length > 0 ? receiptForm.attachments : undefined,
				updatedAt: new Date().toISOString(),
			});

			setEditingReceiptId(null);
			setIsNewReceiptOpen(false);
			handleRefresh();
			return;
		}

		if (selectedReceiptTarget && amount > receiptBalanceDue + 0.01) {
			setFormError(`Amount cannot exceed balance due (${formatAccountingCurrency(receiptBalanceDue)})`);
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
				attachments: receiptForm.attachments?.length > 0 ? receiptForm.attachments : undefined,
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
			paymentNumber: settings.getNextReceiptNumber(),
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
			attachments: receiptForm.attachments?.length > 0 ? receiptForm.attachments : undefined,
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
			// Not every withholding agent withholds both — most private customers withhold tax
			// only, while designated agents (mostly government) withhold VAT too. Both default on
			// since the suggested amounts are usually right when a customer does withhold both,
			// but these flags let the preparer say which actually applied to this payment instead
			// of silently zeroing a field with no record of that being a deliberate choice.
			whtHasTax: true,
			whtHasVat: true,
			paymentMethod: 'Bank',
			certificateNumber: '',
			withholdingAgentTIN: '',
		});
		setFormError('');
		setIsWHTPaymentOpen(true);
	};

	// Flip whether this payment includes a tax/VAT withholding component. Re-checking restores
	// the statutory-rate suggestion (recomputed fresh, since the invoice's remaining balance may
	// have changed since the modal opened); unchecking zeroes the amount rather than just
	// disabling the field, so an unflagged component can never sneak into the posted total.
	const toggleWhtHasTax = (checked: boolean) => {
		setWHTPaymentForm((f: any) => {
			if (!checked) return { ...f, whtHasTax: false, whtAmount: 0 };
			const invoice = invoices.find((i: any) => i.id === f.invoiceId);
			const settlement = invoice ? computeInvoiceWhtSettlement(invoice, taxConfigs) : null;
			return { ...f, whtHasTax: true, whtAmount: settlement?.whtRemaining ?? f.whtAmount };
		});
	};

	const toggleWhtHasVat = (checked: boolean) => {
		setWHTPaymentForm((f: any) => {
			if (!checked) return { ...f, whtHasVat: false, whtVatAmount: 0 };
			const invoice = invoices.find((i: any) => i.id === f.invoiceId);
			const settlement = invoice ? computeInvoiceWhtSettlement(invoice, taxConfigs) : null;
			return { ...f, whtHasVat: true, whtVatAmount: settlement?.whtVatRemaining ?? f.whtVatAmount };
		});
	};

	// Convert proforma → sales invoice (+ GL post)
	const handleConvertProforma = async (inv: any, e?: React.MouseEvent) => {
		e?.stopPropagation();
		const src = inv.sourceModule || 'manual_ar_ap';
		if (src === 'manual_ar_ap' || src === 'manual') {
			const currentNumber = inv.invoiceNumber || '';
			const newNumber = currentNumber.startsWith('PRO-')
				? currentNumber.replace(/^PRO-/, 'INV-')
				: settings.getNextInvoiceNumber();
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
							glAccountCode: GL_ACCOUNTS.OTHER_REVENUE,
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
			setFormError(`Total (${formatAccountingCurrency(totalEntered)}) exceeds balance due (${formatAccountingCurrency(balanceDue)})`);
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
			attachments: cert.attachments || [],
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
			// receiveWHTCertificate doesn't take attachments (a focused certificate-number/TIN
			// helper) — attach the scanned certificate as a follow-up update instead of widening
			// that function's params for a UI-only field, same pattern as the receipt attachments fix.
			if (receiveCertForm.attachments.length > 0) {
				updateWHTCertificate(selectedWHTCert.id, { attachments: receiveCertForm.attachments });
			}
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
		// Posts a reversing GL entry against a live invoice — irreversible and
		// financially significant, so it's gated on its own permission rather
		// than general accounting.* access, re-checked here in case the button
		// that normally hides for this role was somehow still reachable.
		if (!useSettingsStore.getState().hasPermission('accounting.void-transaction')) {
			setFormError("You don't have permission to void invoices.");
			return;
		}
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
		if (!useSettingsStore.getState().hasPermission('accounting.void-transaction')) {
			setFormError("You don't have permission to void receipts.");
			return;
		}
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

	// —— Desk table: per-list sort, resizable columns, pagination ——
	const [salesSortKey, setSalesSortKey] = useState<SalesSortKey>('date');
	const [salesSortDir, setSalesSortDir] = useState<'asc' | 'desc'>('desc');
	const salesCols = useResizableColumns<SalesSortKey>({
		// Sized to max(uppercase header, typical cell) — long INV-* numbers & currency chips.
		invoice: 168, source: 124, customer: 152, date: 92, dueDate: 96, staff: 112,
		total: 100, paid: 92, balance: 100, status: 84, wht: 104, gl: 72,
	});
	const sortedSales = useMemo(() => {
		const value = (inv: any): string | number => {
			const balance = (inv.total || 0) - (inv.paidAmount || 0);
			const isOverdue = balance > 0 && new Date(inv.dueDate) < new Date();
			const settlement = computeInvoiceWhtSettlement(inv, taxConfigs);
			const hasPendingWhtCert = (whtCertificates || []).some(
				(c: any) => c.invoiceId === inv.id && c.status === 'Pending',
			);
			const glChip = getGlSyncChip('invoice', inv);
			switch (salesSortKey) {
				case 'invoice': return (inv.invoiceNumber || inv.id || '').toLowerCase();
				case 'source': return (inv.sourceModule || '').toLowerCase();
				case 'customer': return (inv.customerName || '').toLowerCase();
				case 'date': return new Date(inv.date).getTime();
				case 'dueDate': return new Date(inv.dueDate).getTime();
				case 'staff': return (inv.staffName || '').toLowerCase();
				case 'total': return Number(inv.total || 0);
				case 'paid': return Number(inv.paidAmount || 0);
				case 'balance': return balance;
				case 'status': return balance === 0 ? 'paid' : isOverdue ? 'overdue' : 'open';
				case 'wht': return inv.whtStatus === 'Complete' ? 2 : inv.whtStatus === 'Pending' || hasPendingWhtCert ? 1 : settlement.whtTotalRemaining > 0 ? 0 : -1;
				case 'gl': return glChip?.label || '';
				default: return '';
			}
		};
		const sorted = [...filteredSalesInvoices].sort((a, b) => deskCmp(value(a), value(b)));
		return salesSortDir === 'asc' ? sorted : sorted.reverse();
	}, [filteredSalesInvoices, salesSortKey, salesSortDir, taxConfigs, whtCertificates, journalEntries]);
	const salesPaging = useDeskPagination(sortedSales, [statusFilter, sourceFilter, dateFrom, dateTo, searchQuery, salesSortKey, salesSortDir, invoiceDocType]);
	const onSalesSort = (key: SalesSortKey) => {
		if (salesSortKey === key) setSalesSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
		else {
			setSalesSortKey(key);
			setSalesSortDir(key === 'date' || key === 'dueDate' || key === 'total' || key === 'paid' || key === 'balance' ? 'desc' : 'asc');
		}
	};
	const salesColumn = (key: SalesSortKey, label: string, align: 'left' | 'right' | 'center' = 'left') => (
		<TableColumn key={key} className="relative" style={salesCols.style(key)}>
			<SortLabel active={salesSortKey === key} dir={salesSortDir} align={align} onPress={() => onSalesSort(key)}>{label}</SortLabel>
			{salesCols.sizer(key, label)}
		</TableColumn>
	);

	const [proformaSortKey, setProformaSortKey] = useState<ProformaSortKey>('validUntil');
	const [proformaSortDir, setProformaSortDir] = useState<'asc' | 'desc'>('desc');
	const proformaCols = useResizableColumns<ProformaSortKey>({
		proforma: 140, source: 124, client: 144, event: 148, dates: 104, pax: 64,
		venue: 112, amount: 100, validUntil: 104, status: 96,
	});
	const sortedProformas = useMemo(() => {
		const value = (inv: any): string | number => {
			switch (proformaSortKey) {
				case 'proforma': return (inv.invoiceNumber || inv.id || '').toLowerCase();
				case 'source': return (inv.sourceModule || '').toLowerCase();
				case 'client': return (inv.customerName || '').toLowerCase();
				case 'event': return (inv.description || '').toLowerCase();
				case 'dates': return inv.checkIn ? new Date(inv.checkIn).getTime() : 0;
				case 'pax': return Number(inv.pax || 0);
				case 'venue': return (inv.venue || '').toLowerCase();
				case 'amount': return Number(inv.total || 0);
				case 'validUntil': return new Date(inv.dueDate).getTime();
				case 'status': return new Date(inv.dueDate) < new Date() ? 1 : 0;
				default: return '';
			}
		};
		const sorted = [...filteredProformas].sort((a, b) => deskCmp(value(a), value(b)));
		return proformaSortDir === 'asc' ? sorted : sorted.reverse();
	}, [filteredProformas, proformaSortKey, proformaSortDir]);
	const proformaPaging = useDeskPagination(sortedProformas, [statusFilter, sourceFilter, dateFrom, dateTo, searchQuery, proformaSortKey, proformaSortDir, invoiceDocType]);
	const onProformaSort = (key: ProformaSortKey) => {
		if (proformaSortKey === key) setProformaSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
		else {
			setProformaSortKey(key);
			setProformaSortDir(key === 'amount' || key === 'validUntil' || key === 'dates' ? 'desc' : 'asc');
		}
	};
	const proformaColumn = (key: ProformaSortKey, label: string, align: 'left' | 'right' | 'center' = 'left') => (
		<TableColumn key={key} className="relative" style={proformaCols.style(key)}>
			<SortLabel active={proformaSortKey === key} dir={proformaSortDir} align={align} onPress={() => onProformaSort(key)}>{label}</SortLabel>
			{proformaCols.sizer(key, label)}
		</TableColumn>
	);

	const [agingSortKey, setAgingSortKey] = useState<AgingSortKey>('balance');
	const [agingSortDir, setAgingSortDir] = useState<'asc' | 'desc'>('desc');
	const agingCols = useResizableColumns<AgingSortKey>({
		customer: 152, source: 64, invoiced: 100, paid: 88, balance: 100,
		current: 88, days30: 92, days60: 100, days90: 100, over90: 92,
	});
	const sortedAging = useMemo(() => {
		const value = (c: any): string | number => {
			switch (agingSortKey) {
				case 'customer': return (c.customerName || '').toLowerCase();
				case 'source': return (c.source || '').toLowerCase();
				case 'invoiced': return Number(c.totalInvoiced || 0);
				case 'paid': return Number(c.totalPaid || 0);
				case 'balance': return Number(c.balance || 0);
				case 'current': return Number(c.current || 0);
				case 'days30': return Number(c.days30 || 0);
				case 'days60': return Number(c.days60 || 0);
				case 'days90': return Number(c.days90 || 0);
				case 'over90': return Number(c.over90 || 0);
				default: return '';
			}
		};
		const sorted = [...filteredAging].sort((a, b) => deskCmp(value(a), value(b)));
		return agingSortDir === 'asc' ? sorted : sorted.reverse();
	}, [filteredAging, agingSortKey, agingSortDir]);
	const agingPaging = useDeskPagination(sortedAging, [agingSortKey, agingSortDir, searchQuery, sourceFilter, dateFrom, dateTo, filteredAging.length]);
	const onAgingSort = (key: AgingSortKey) => {
		if (agingSortKey === key) setAgingSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
		else {
			setAgingSortKey(key);
			setAgingSortDir(key === 'customer' || key === 'source' ? 'asc' : 'desc');
		}
	};
	const agingColumn = (key: AgingSortKey, label: string, align: 'left' | 'right' | 'center' = 'left') => (
		<TableColumn key={key} className="relative" style={agingCols.style(key)}>
			<SortLabel active={agingSortKey === key} dir={agingSortDir} align={align} onPress={() => onAgingSort(key)}>{label}</SortLabel>
			{agingCols.sizer(key, label)}
		</TableColumn>
	);

	const [receiptSortKey, setReceiptSortKey] = useState<ReceiptSortKey>('date');
	const [receiptSortDir, setReceiptSortDir] = useState<'asc' | 'desc'>('desc');
	const receiptCols = useResizableColumns<ReceiptSortKey>({
		receipt: 128, source: 124, customer: 144, date: 92, time: 88, method: 88,
		staff: 112, invoice: 120, amount: 100, status: 84,
	});
	const sortedReceipts = useMemo(() => {
		const value = (r: any): string | number => {
			switch (receiptSortKey) {
				case 'receipt': return (r.paymentNumber || r.id || '').toLowerCase();
				case 'source': return (r.sourceModule || '').toLowerCase();
				case 'customer': return (r.customerName || '').toLowerCase();
				case 'date': return new Date(r.date).getTime();
				case 'time': return new Date(r.date).getTime();
				case 'method': return (r.paymentMethod || '').toLowerCase();
				case 'staff': return (r.staffName || '').toLowerCase();
				case 'invoice': return (r.invoiceId || '').toLowerCase();
				case 'amount': return Number(r.amount || 0);
				case 'status': return (r.status || '').toLowerCase();
				default: return '';
			}
		};
		const sorted = [...filteredReceipts].sort((a, b) => deskCmp(value(a), value(b)));
		return receiptSortDir === 'asc' ? sorted : sorted.reverse();
	}, [filteredReceipts, receiptSortKey, receiptSortDir]);
	const receiptPaging = useDeskPagination(sortedReceipts, [sourceFilter, dateFrom, dateTo, searchQuery, receiptSortKey, receiptSortDir]);
	const onReceiptSort = (key: ReceiptSortKey) => {
		if (receiptSortKey === key) setReceiptSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
		else {
			setReceiptSortKey(key);
			setReceiptSortDir(key === 'date' || key === 'time' || key === 'amount' ? 'desc' : 'asc');
		}
	};
	const receiptColumn = (key: ReceiptSortKey, label: string, align: 'left' | 'right' | 'center' = 'left') => (
		<TableColumn key={key} className="relative" style={receiptCols.style(key)}>
			<SortLabel active={receiptSortKey === key} dir={receiptSortDir} align={align} onPress={() => onReceiptSort(key)}>{label}</SortLabel>
			{receiptCols.sizer(key, label)}
		</TableColumn>
	);

	const [whtSortKey, setWhtSortKey] = useState<WhtSortKey>('taxPeriod');
	const [whtSortDir, setWhtSortDir] = useState<'asc' | 'desc'>('desc');
	const whtCols = useResizableColumns<WhtSortKey>({
		certificate: 132, agent: 168, tin: 108, invoice: 112, taxPeriod: 100,
		wht: 88, whtVat: 96, total: 96, status: 132,
	});
	const sortedWhtCerts = useMemo(() => {
		const value = (cert: any): string | number => {
			switch (whtSortKey) {
				case 'certificate': return (cert.certificateNumber || 'PENDING').toLowerCase();
				case 'agent': return (cert.withholdingAgentName || '').toLowerCase();
				case 'tin': return (cert.withholdingAgentTIN || '').toLowerCase();
				case 'invoice': return (cert.invoiceNumber || '').toLowerCase();
				case 'taxPeriod': return (cert.taxPeriod || '').toLowerCase();
				case 'wht': return Number(cert.whtAmount || 0);
				case 'whtVat': return Number(cert.whtVatAmount || 0);
				case 'total': return Number(cert.totalWithheld || 0);
				case 'status': return (cert.status || '').toLowerCase();
				default: return '';
			}
		};
		const sorted = [...filteredWHTCerts].sort((a, b) => deskCmp(value(a), value(b)));
		return whtSortDir === 'asc' ? sorted : sorted.reverse();
	}, [filteredWHTCerts, whtSortKey, whtSortDir]);
	const whtPaging = useDeskPagination(sortedWhtCerts, [statusFilter, dateFrom, dateTo, searchQuery, whtSortKey, whtSortDir]);
	const onWhtSort = (key: WhtSortKey) => {
		if (whtSortKey === key) setWhtSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
		else {
			setWhtSortKey(key);
			setWhtSortDir(key === 'wht' || key === 'whtVat' || key === 'total' || key === 'taxPeriod' ? 'desc' : 'asc');
		}
	};
	const whtColumn = (key: WhtSortKey, label: string, align: 'left' | 'right' | 'center' = 'left') => (
		<TableColumn key={key} className="relative" style={whtCols.style(key)}>
			<SortLabel active={whtSortKey === key} dir={whtSortDir} align={align} onPress={() => onWhtSort(key)}>{label}</SortLabel>
			{whtCols.sizer(key, label)}
		</TableColumn>
	);

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
	const renderSalesInvoiceTable = () => (
		<>
			<div ref={salesCols.frameRef} style={salesCols.frameStyle}>
				<Table removeWrapper classNames={deskResizableTableClassNames()} aria-label="Sales invoices">
					<TableHeader>
						{salesColumn('invoice', 'Invoice #')}
						{salesColumn('source', 'Source')}
						{salesColumn('customer', 'Customer')}
						{salesColumn('date', 'Date')}
						{salesColumn('dueDate', 'Due date')}
						{salesColumn('staff', 'Staff')}
						{salesColumn('total', 'Total', 'right')}
						{salesColumn('paid', 'Paid', 'right')}
						{salesColumn('balance', 'Balance', 'right')}
						{salesColumn('status', 'Status')}
						{salesColumn('wht', 'WHT')}
						{salesColumn('gl', 'GL')}
					</TableHeader>
					<TableBody emptyContent="No sales invoices found.">
						{salesPaging.paged.map((inv: any) => {
							const source = getSourceLabel(inv.sourceModule);
							const glChip = getGlSyncChip('invoice', inv);
							const balance = (inv.total || 0) - (inv.paidAmount || 0);
							const settlement = computeInvoiceWhtSettlement(inv, taxConfigs);
							const hasPendingWhtCert = (whtCertificates || []).some(
								(c: any) => c.invoiceId === inv.id && c.status === 'Pending',
							);
							const isOverdue = isPastDue(inv.dueDate, balance);
							return (
								<TableRow key={inv.id} className={rowClassNames(selectedInvoice?.id === inv.id)} onClick={() => openInvoiceDetail(inv)}>
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
									<TableCell>{formatDeskDate(inv.date)}</TableCell>
									<TableCell className={isOverdue ? 'text-red-600' : ''}>{formatDeskDate(inv.dueDate)}</TableCell>
									<TableCell>
										<div className="text-sm">{inv.staffName || '-'}</div>
										<div className="text-xs text-gray-500">{inv.staffRole || ''}</div>
									</TableCell>
									<TableCell className="tabular-nums text-right font-medium">{formatAccountingCurrency(Number(inv.total || 0))}</TableCell>
									<TableCell className="tabular-nums text-right text-green-600">{formatAccountingCurrency(Number(inv.paidAmount || 0))}</TableCell>
									<TableCell className="tabular-nums text-right text-orange-600 font-medium">{formatAccountingCurrency(balance)}</TableCell>
									<TableCell>
										<Chip size="sm" color={balance === 0 ? 'success' : isOverdue ? 'danger' : 'warning'} variant="flat">
											{balance === 0 ? 'Paid' : isOverdue ? 'Overdue' : 'Open'}
										</Chip>
									</TableCell>
									<TableCell>
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
								</TableRow>
							);
						})}
					</TableBody>
				</Table>
			</div>
			<div className="mt-3 flex justify-end">
				<Pagination page={salesPaging.page} total={salesPaging.pages} onChange={salesPaging.setPage} showControls size="sm" />
			</div>
		</>
	);

	// Render proforma invoice table with event details
	const renderProformaTable = () => (
		<>
			<div ref={proformaCols.frameRef} style={proformaCols.frameStyle}>
				<Table removeWrapper classNames={deskResizableTableClassNames()} aria-label="Proforma invoices">
					<TableHeader>
						{proformaColumn('proforma', 'Proforma #')}
						{proformaColumn('source', 'Source')}
						{proformaColumn('client', 'Client')}
						{proformaColumn('event', 'Event/booking')}
						{proformaColumn('dates', 'Dates')}
						{proformaColumn('pax', 'Pax')}
						{proformaColumn('venue', 'Venue')}
						{proformaColumn('amount', 'Amount', 'right')}
						{proformaColumn('validUntil', 'Valid until')}
						{proformaColumn('status', 'Status')}
					</TableHeader>
					<TableBody emptyContent="No proforma invoices found. Generate a quote from Events & Conferences to create proformas.">
						{proformaPaging.paged.map((inv: any) => {
							const source = getSourceLabel(inv.sourceModule);
							const isExpired = new Date(inv.dueDate) < new Date();
							return (
								<TableRow key={inv.id} className={rowClassNames(selectedInvoice?.id === inv.id)} onClick={() => openInvoiceDetail(inv)}>
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
									<TableCell className="tabular-nums text-right font-bold text-purple-700">{formatAccountingCurrency(Number(inv.total || 0))}</TableCell>
									<TableCell className={isExpired ? 'text-red-600' : 'text-gray-600'}>
										{new Date(inv.dueDate).toLocaleDateString()}
									</TableCell>
									<TableCell>
										<Chip size="sm" color={isExpired ? 'danger' : 'secondary'} variant="flat">
											{isExpired ? '⏰ Expired' : '📋 Active'}
										</Chip>
									</TableCell>
								</TableRow>
							);
						})}
					</TableBody>
				</Table>
			</div>
			<div className="mt-3 flex justify-end">
				<Pagination page={proformaPaging.page} total={proformaPaging.pages} onChange={proformaPaging.setPage} showControls size="sm" />
			</div>
		</>
	);

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
		<div className="px-3 pt-2 pb-3 md:px-4 md:pt-3 md:pb-4" key={refreshKey}>
			<div className="mb-2 flex justify-between items-center gap-2">
				<div className="flex items-center gap-1.5 min-w-0">
					<h1 className="text-lg md:text-xl font-bold text-gray-800 truncate">🧾 Accounts Receivable</h1>
					<HeadingInfo label="About accounts receivable">
						<p>Manage customer accounts, sales invoices, proformas, and receipts.</p>
						<p className="mt-2 font-semibold">Official finance AR</p>
						<p className="mt-1">Aging and outstanding on this screen come from the accounting subledger (posted invoices + GL). In-house guest folios are operational only until checkout posts here.</p>
					</HeadingInfo>
				</div>
				<div className="flex gap-2 shrink-0">
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
			<DeskKpiStrip
				className="mb-2"
				items={[
					{ id: 'ar.totalInvoiced', label: 'Total Invoiced', value: formatAccountingCurrency(totalRevenue), tone: 'text-blue-700' },
					{ id: 'ar.outstanding', label: 'Outstanding AR', value: formatAccountingCurrency(totalOutstanding), tone: 'text-orange-700' },
					{ id: 'ar.receipts', label: 'Total Receipts', value: formatAccountingCurrency(totalReceived), tone: 'text-green-700' },
					{ id: 'ar.whtCredits', label: 'WHT Credits', value: formatAccountingCurrency(totalWHTReceivable), tone: 'text-amber-700' },
				]}
			/>

			{/* Main Tabs */}
			<Card className="shadow-sm">
				<CardBody className="p-0">
					<Tabs
						selectedKey={selectedTab}
						onSelectionChange={(k) => setSelectedTab(k as string)}
						className="w-full"
						size="sm"
						variant="solid"
						classNames={deskBookTabsClassNames}
					>
						
						{/* Overview Tab */}
						<Tab key="overview" title="📊 Overview & Aging">
							<div className={deskBookTabPanelClassName}>
								<div className="flex justify-between items-center mb-2">
									<h3 className="text-sm font-semibold text-gray-800">Customer Balance & Aging Analysis</h3>
									<div className="flex items-center gap-2">
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
								{renderFilters(false)}
								<div ref={agingCols.frameRef} style={agingCols.frameStyle}>
								<Table removeWrapper classNames={deskResizableTableClassNames()} aria-label="Customer aging">
									<TableHeader>
										{agingColumn('customer', 'Customer')}
										{agingColumn('source', 'Source')}
										{agingColumn('invoiced', 'Invoiced', 'right')}
										{agingColumn('paid', 'Paid', 'right')}
										{agingColumn('balance', 'Balance', 'right')}
										{agingColumn('current', 'Current', 'right')}
										{agingColumn('days30', '1-30 days', 'right')}
										{agingColumn('days60', '31-60 days', 'right')}
										{agingColumn('days90', '61-90 days', 'right')}
										{agingColumn('over90', '90+ days', 'right')}
									</TableHeader>
									<TableBody emptyContent="No customer data.">
										{agingPaging.paged.map((c: any) => {
											const source = getSourceLabel(c.source);
											return (
												<TableRow key={c.customerId} className={rowClassNames(false)} onClick={() => openAgingCustomer(c)}>
												<TableCell>
														<div className="font-medium text-blue-600 hover:underline">{c.customerName}</div>
														<div className="text-xs text-gray-500">{c.invoiceCount} invoices</div>
												</TableCell>
													<TableCell>
														<Chip size="sm" color={source.color} variant="flat">{source.icon}</Chip>
													</TableCell>
													<TableCell className="tabular-nums text-right">{formatAccountingCurrency(c.totalInvoiced)}</TableCell>
													<TableCell className="tabular-nums text-right text-green-600">{formatAccountingCurrency(c.totalPaid)}</TableCell>
													<TableCell className={`tabular-nums text-right font-bold ${c.balance < -0.005 ? 'text-sky-700' : ''}`}>{c.balance < -0.005 ? `−${formatAccountingCurrency(c.balance)}` : formatAccountingCurrency(c.balance)}</TableCell>
													<TableCell className="tabular-nums text-right">{c.current > 0 ? `${formatAccountingCurrency(c.current)}` : '-'}</TableCell>
													<TableCell className="tabular-nums text-right text-yellow-600">{c.days30 > 0 ? `${formatAccountingCurrency(c.days30)}` : '-'}</TableCell>
													<TableCell className="tabular-nums text-right text-orange-600">{c.days60 > 0 ? `${formatAccountingCurrency(c.days60)}` : '-'}</TableCell>
													<TableCell className="tabular-nums text-right text-red-500">{c.days90 > 0 ? `${formatAccountingCurrency(c.days90)}` : '-'}</TableCell>
													<TableCell className="tabular-nums text-right text-red-700 font-medium">{c.over90 > 0 ? `${formatAccountingCurrency(c.over90)}` : '-'}</TableCell>
											</TableRow>
											);
										})}
									</TableBody>
								</Table>
								</div>
								<div className="mt-3 flex justify-end">
									<Pagination page={agingPaging.page} total={agingPaging.pages} onChange={agingPaging.setPage} showControls size="sm" />
								</div>

								{/* Aging Summary */}
								<div className="mt-6 grid grid-cols-5 gap-4">
									<Card className="bg-green-50">
										<CardBody className="text-center py-3">
											<div className="text-lg font-bold text-green-700">{formatAccountingCurrency(filteredAging.reduce((s, c) => s + c.current, 0))}</div>
											<div className="text-xs text-green-600">Current</div>
										</CardBody>
									</Card>
									<Card className="bg-yellow-50">
										<CardBody className="text-center py-3">
											<div className="text-lg font-bold text-yellow-700">{formatAccountingCurrency(filteredAging.reduce((s, c) => s + c.days30, 0))}</div>
											<div className="text-xs text-yellow-600">1-30 Days</div>
										</CardBody>
									</Card>
									<Card className="bg-orange-50">
										<CardBody className="text-center py-3">
											<div className="text-lg font-bold text-orange-700">{formatAccountingCurrency(filteredAging.reduce((s, c) => s + c.days60, 0))}</div>
											<div className="text-xs text-orange-600">31-60 Days</div>
										</CardBody>
									</Card>
									<Card className="bg-red-50">
										<CardBody className="text-center py-3">
											<div className="text-lg font-bold text-red-600">{formatAccountingCurrency(filteredAging.reduce((s, c) => s + c.days90, 0))}</div>
											<div className="text-xs text-red-500">61-90 Days</div>
										</CardBody>
									</Card>
									<Card className="bg-red-100">
										<CardBody className="text-center py-3">
											<div className="text-lg font-bold text-red-800">{formatAccountingCurrency(filteredAging.reduce((s, c) => s + c.over90, 0))}</div>
											<div className="text-xs text-red-700">90+ Days</div>
										</CardBody>
									</Card>
								</div>
							</div>
						</Tab>

						{/* Invoices Tab — Sales and Proforma are the same document set (allSalesInvoices),
						    split by isProforma; toggle below switches which subset renders instead of
						    forcing two separate top-level tabs for what is one invoice ledger. */}
						<Tab key="invoices" title={`🧾 Invoices (${allSalesInvoices.length})`}>
							<div className={deskBookTabPanelClassName}>
								<div className="flex justify-between items-center mb-4">
									<div className="flex items-center gap-3">
										<h3 className="text-lg font-semibold">{invoiceDocType === 'sales' ? 'Sales Invoices' : 'Proforma Invoices'}</h3>
										<div className="flex rounded-lg border border-gray-200 p-0.5">
											<button
												type="button"
												onClick={() => setInvoiceDocType('sales')}
												className={`px-3 py-1 text-sm rounded-md transition-colors ${invoiceDocType === 'sales' ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-100'}`}
											>
												Sales ({salesInvoices.length})
											</button>
											<button
												type="button"
												onClick={() => setInvoiceDocType('proforma')}
												className={`px-3 py-1 text-sm rounded-md transition-colors ${invoiceDocType === 'proforma' ? 'bg-secondary text-white' : 'text-gray-600 hover:bg-gray-100'}`}
											>
												Proforma ({proformaInvoices.length})
											</button>
										</div>
									</div>
									{invoiceDocType === 'sales' ? (
										<div className="flex items-center gap-2">
											<Dropdown>
												<DropdownTrigger>
													<Button variant="flat" size="sm">📥 Export</Button>
												</DropdownTrigger>
												<DropdownMenu>
													<DropdownItem key="csv" onPress={exportInvoicesCSV}>📄 Download CSV</DropdownItem>
													<DropdownItem key="pdf" onPress={printInvoicesTablePDF}>📑 Print PDF</DropdownItem>
												</DropdownMenu>
											</Dropdown>
											<Button color="primary" size="sm" onClick={() => openNewInvoice(false)}>➕ New Manual Invoice</Button>
										</div>
									) : (
										<div className="flex items-center gap-2">
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
									)}
								</div>
								{invoiceDocType === 'sales' ? (
									<>
										{renderFilters(true)}
										{renderSalesInvoiceTable()}
									</>
								) : (
									<>
										{renderFilters(false)}
										{renderProformaTable()}
									</>
								)}
							</div>
						</Tab>

						{/* Receipts Tab */}
						<Tab key="receipts" title={`💳 Receipts (${receipts.length})`}>
							<div className={deskBookTabPanelClassName}>
								<div className="flex justify-between items-center mb-4">
                                    <h3 className="text-lg font-semibold">Customer Receipts</h3>
									<div className="flex items-center gap-2">
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
								
								<div ref={receiptCols.frameRef} style={receiptCols.frameStyle}>
								<Table removeWrapper classNames={deskResizableTableClassNames()} aria-label="Customer receipts">
                                    <TableHeader>
                                        {receiptColumn('receipt', 'Receipt #')}
										{receiptColumn('source', 'Source')}
                                        {receiptColumn('customer', 'Customer')}
                                        {receiptColumn('date', 'Date')}
										{receiptColumn('time', 'Time')}
                                        {receiptColumn('method', 'Method')}
										{receiptColumn('staff', 'Staff')}
										{receiptColumn('invoice', 'Invoice')}
                                        {receiptColumn('amount', 'Amount', 'right')}
                                        {receiptColumn('status', 'Status')}
                                    </TableHeader>
                                    <TableBody emptyContent="No receipts found.">
										{receiptPaging.paged.map((r: any) => {
											const source = getSourceLabel(r.sourceModule);
											return (
												<TableRow key={r.id} className={rowClassNames(selectedReceipt?.id === r.id)} onClick={() => openReceiptDetail(r)}>
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
													<TableCell className="tabular-nums text-right font-medium text-green-600">{formatAccountingCurrency(Number(r.amount || 0))}</TableCell>
													<TableCell>
														<Chip size="sm" color={r.status === 'Posted' ? 'success' : r.status === 'Void' ? 'danger' : 'default'} variant="flat">{r.status || 'Draft'}</Chip>
													</TableCell>
                                            </TableRow>
											);
										})}
                                    </TableBody>
                                </Table>
								</div>
								
								<div className="mt-3 flex justify-end">
									<Pagination page={receiptPaging.page} total={receiptPaging.pages} onChange={receiptPaging.setPage} showControls size="sm" />
								</div>
                            </div>
                        </Tab>

						{/* WHT Certificates Tab */}
						<Tab key="wht" title={`📜 WHT Certificates (${whtCertificates?.length || 0})`}>
							<div className={deskBookTabPanelClassName}>
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
										<Dropdown>
											<DropdownTrigger>
												<Button variant="flat" size="sm">📥 Export</Button>
											</DropdownTrigger>
											<DropdownMenu>
												<DropdownItem key="csv" onPress={exportWHTCertificatesCSV}>📄 Download CSV</DropdownItem>
												<DropdownItem key="pdf" onPress={printWHTCertificatesTablePDF}>📑 Print PDF</DropdownItem>
											</DropdownMenu>
										</Dropdown>
									</div>
								</div>

								{renderFilters(false)}

								<div ref={whtCols.frameRef} style={whtCols.frameStyle}>
								<Table removeWrapper classNames={deskResizableTableClassNames()} aria-label="WHT Certificates">
									<TableHeader>
										{whtColumn('certificate', 'Certificate #')}
										{whtColumn('agent', 'Agent (who withheld)')}
										{whtColumn('tin', 'TIN')}
										{whtColumn('invoice', 'Invoice')}
										{whtColumn('taxPeriod', 'Tax period')}
										{whtColumn('wht', 'WHT', 'right')}
										{whtColumn('whtVat', 'WHT-VAT', 'right')}
										{whtColumn('total', 'Total', 'right')}
										{whtColumn('status', 'Status')}
									</TableHeader>
									<TableBody emptyContent="No WHT certificates found. WHT certificates are created when you record payments with withholding tax.">
										{whtPaging.paged.map((cert: any) => (
											<TableRow key={cert.id} className={rowClassNames(selectedWHTCert?.id === cert.id)} onClick={() => openWHTDetail(cert)}>
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
												<TableCell className="tabular-nums text-right font-medium">{formatAccountingCurrency(Number(cert.whtAmount || 0))}</TableCell>
												<TableCell className="tabular-nums text-right font-medium">{formatAccountingCurrency(Number(cert.whtVatAmount || 0))}</TableCell>
												<TableCell className="tabular-nums text-right font-bold text-amber-600">{formatAccountingCurrency(Number(cert.totalWithheld || 0))}</TableCell>
												<TableCell onClick={(e) => e.stopPropagation()}>
													{cert.status === 'Received' ? (
														<Tooltip content="Click to mark as verified">
															<Chip
																size="sm"
																color="primary"
																variant="flat"
																className="cursor-pointer"
																onClick={() => verifyWHTCertificate(cert.id)}
															>
																Received · Verify
															</Chip>
														</Tooltip>
													) : cert.status === 'Pending' ? (
														<Tooltip content="Click to enter GRA certificate number">
															<Chip
																size="sm"
																color="warning"
																variant="flat"
																className="cursor-pointer"
																onClick={() => openWHTDetail(cert)}
															>
																Pending · Receive
															</Chip>
														</Tooltip>
													) : (
														<Chip
															size="sm"
															color={cert.status === 'Verified' ? 'success' : 'default'}
															variant="flat"
														>
															{cert.status}
														</Chip>
													)}
												</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
								</div>

								<div className="mt-3 flex justify-end">
									<Pagination page={whtPaging.page} total={whtPaging.pages} onChange={whtPaging.setPage} showControls size="sm" />
								</div>
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
												<div className="font-bold">{formatAccountingCurrency(Number(whtPaymentForm.invoiceTotal || 0))}</div>
											</div>
											<div>
												<div className="text-gray-500">Balance Due</div>
												<div className="font-bold text-orange-600">{formatAccountingCurrency(Number(whtPaymentForm.balanceDue || 0))}</div>
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
										<h4 className="font-semibold text-amber-800 mb-1">Withholding Tax Deducted by Customer</h4>
										<p className="text-xs text-amber-700 mb-3">Not every payer withholds both — flag which apply to this payment.</p>
										<div className="grid grid-cols-2 gap-4">
											<div>
												<Checkbox
													size="sm"
													isSelected={whtPaymentForm.whtHasTax}
													onValueChange={toggleWhtHasTax}
													classNames={{ label: 'text-xs font-medium text-amber-800' }}
												>
													Tax withheld (WHT)
												</Checkbox>
												<Input
													type="number"
													label={whtLabels.whtLabel}
													placeholder="0.00"
													value={whtPaymentForm.whtAmount}
													onValueChange={(v) => setWHTPaymentForm((f: any) => ({ ...f, whtAmount: Number(v) }))}
													startContent="₵"
													description="Withholding Tax on subtotal"
													isDisabled={!whtPaymentForm.whtHasTax}
													className="mt-1"
												/>
											</div>
											<div>
												<Checkbox
													size="sm"
													isSelected={whtPaymentForm.whtHasVat}
													onValueChange={toggleWhtHasVat}
													classNames={{ label: 'text-xs font-medium text-amber-800' }}
												>
													VAT withheld (WHT-VAT)
												</Checkbox>
												<Input
													type="number"
													label={whtLabels.whtVatLabel}
													placeholder="0.00"
													value={whtPaymentForm.whtVatAmount}
													onValueChange={(v) => setWHTPaymentForm((f: any) => ({ ...f, whtVatAmount: Number(v) }))}
													startContent="₵"
													description="Withholding VAT on tax amount"
													isDisabled={!whtPaymentForm.whtHasVat}
													className="mt-1"
												/>
											</div>
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
												<div className="font-bold text-green-600">{formatAccountingCurrency(Number(whtPaymentForm.cashAmount || 0))}</div>
											</div>
											<div>
												<div className="text-gray-500">WHT Credit</div>
												<div className="font-bold text-amber-600">{formatAccountingCurrency(Number(whtPaymentForm.whtAmount || 0))}</div>
											</div>
											<div>
												<div className="text-gray-500">WHT-VAT Credit</div>
												<div className="font-bold text-amber-600">{formatAccountingCurrency(Number(whtPaymentForm.whtVatAmount || 0))}</div>
											</div>
											<div>
												<div className="text-gray-500">Total Clearing AR</div>
												<div className="font-bold text-blue-600">
													{formatAccountingCurrency((Number(whtPaymentForm.cashAmount || 0) + Number(whtPaymentForm.whtAmount || 0) + Number(whtPaymentForm.whtVatAmount || 0)))}
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
													<span className="font-bold">{formatAccountingCurrency(Number(selectedWHTCert.grossAmount || 0))}</span>
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
													{/* ?? not || : a real 0% (this preparer flagged "not withheld") must not fall back to
													    the statutory default -- only a genuinely missing rate (older certs) should. */}
													<TableCell>{selectedWHTCert.whtRate ?? 5}%</TableCell>
													<TableCell className="text-right font-medium">{formatAccountingCurrency(Number(selectedWHTCert.whtAmount || 0))}</TableCell>
                                                    </TableRow>
												<TableRow>
													<TableCell>Withholding VAT (WHT-VAT)</TableCell>
													<TableCell>{selectedWHTCert.whtVatRate ?? 7}%</TableCell>
													<TableCell className="text-right font-medium">{formatAccountingCurrency(Number(selectedWHTCert.whtVatAmount || 0))}</TableCell>
												</TableRow>
												<TableRow className="bg-amber-50">
													<TableCell className="font-bold">TOTAL TAX CREDIT</TableCell>
													<TableCell>-</TableCell>
													<TableCell className="text-right font-bold text-amber-600">{formatAccountingCurrency(Number(selectedWHTCert.totalWithheld || 0))}</TableCell>
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
												<div className="font-bold text-lg">{formatAccountingCurrency(Number(selectedWHTCert.totalWithheld || 0))}</div>
                                    </div>
											<div>
												<div className="text-gray-600">Used</div>
												<div className="font-bold text-lg text-gray-500">{formatAccountingCurrency(Number(selectedWHTCert.taxCreditUsedAmount || 0))}</div>
                                </div>
											<div>
												<div className="text-gray-600">Remaining Balance</div>
												<div className="font-bold text-lg text-green-600">{formatAccountingCurrency(Number(selectedWHTCert.taxCreditBalance || selectedWHTCert.totalWithheld || 0))}</div>
											</div>
										</div>
                                                </CardBody>
                                            </Card>

								{selectedWHTCert.attachments?.length > 0 && (
									<Card className="mt-4">
										<CardBody>
											<h4 className="font-semibold text-gray-700 mb-2">Attachments</h4>
											<ul className="text-sm text-gray-700 space-y-1">
												{selectedWHTCert.attachments.map((a: string, i: number) => (
													<li key={i} className="font-mono text-xs">
														{/^https?:\/\//.test(a) ? (
															<a href={a} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
																{decodeURIComponent(a.split('/').pop() || a)}
															</a>
														) : a}
													</li>
												))}
											</ul>
										</CardBody>
									</Card>
								)}

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
												<AttachmentUpload
													label="Attachments — scanned certificate (optional)"
													attachments={receiveCertForm.attachments}
													onChange={(next) => setReceiveCertForm((f) => ({ ...f, attachments: next }))}
													className="col-span-2"
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
							<ModalHeader>➕ {invoiceForm.isProforma ? 'New Proforma Invoice' : 'New Manual Invoice'}</ModalHeader>
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
									<Autocomplete
										label="Customer Name *"
										placeholder="Search existing or type a new customer..."
										selectedKey={invoiceForm.businessPartnerId || null}
										inputValue={invoiceForm.customerName || ''}
										onInputChange={(v) =>
											setInvoiceForm((f: any) => ({
												...f,
												customerName: v,
												...(f.businessPartnerId && v !== customers.find((c) => c.id === f.businessPartnerId)?.name
													? { businessPartnerId: '' }
													: {}),
											}))
										}
										onSelectionChange={(key) => {
											const partner = customers.find((c) => c.id === key);
											setInvoiceForm((f: any) => ({
												...f,
												businessPartnerId: (key as string) || '',
												customerName: partner?.name || f.customerName,
												dueDate: dueDateFromTerms(f.date, (key as string) || '', f.customerPaymentTerms),
											}));
										}}
										allowsCustomValue
									>
										{customers.map((c) => (
											<AutocompleteItem key={c.id} textValue={c.name}>
												<div className="font-medium">{c.name}</div>
												<div className="text-xs text-gray-500">{c.id}</div>
											</AutocompleteItem>
										))}
									</Autocomplete>
									<Input label={invoiceForm.isProforma ? "Proforma Number" : "Invoice Number"} value={invoiceForm.invoiceNumber || ''} onChange={(e) => setInvoiceForm({ ...invoiceForm, invoiceNumber: e.target.value })} placeholder="Auto-generated" />
									<Input label="Customer PO / Reference" placeholder="Buyer's PO number (optional)" value={invoiceForm.poNumber || ''} onChange={(e) => setInvoiceForm({ ...invoiceForm, poNumber: e.target.value })} />
									<Input type="date" label={invoiceForm.isProforma ? "Proforma Date" : "Invoice Date"} value={invoiceForm.date || ''} onValueChange={(v) => setInvoiceForm((f: any) => ({ ...f, date: v, dueDate: dueDateFromTerms(v, f.businessPartnerId, f.customerPaymentTerms) }))} />
									<Input type="date" label={invoiceForm.isProforma ? "Valid Until" : "Due Date"} value={invoiceForm.dueDate || ''} onValueChange={(v) => setInvoiceForm({ ...invoiceForm, dueDate: v })} description="Auto-set from payment terms — editable" />
									<Input type="number" label="Subtotal" value={invoiceForm.subtotal?.toString() || ''} onChange={(e) => setInvoiceForm({ ...invoiceForm, subtotal: e.target.value, total: Number(e.target.value) + Number(invoiceForm.taxAmount || 0) })} />
									<Input type="number" label="Tax Amount" value={invoiceForm.taxAmount?.toString() || ''} onChange={(e) => setInvoiceForm({ ...invoiceForm, taxAmount: e.target.value, total: Number(invoiceForm.subtotal || 0) + Number(e.target.value) })} />
                                </div>

								{/* Tax Options — mirrors AP's Standard/Custom/No-Tax selector so a tax-exempt
								    or non-standard-rate sale has a clean way in, not just hand-editing the amount. */}
								<div className="grid grid-cols-4 gap-4 p-3 mt-4 border rounded items-end">
									<Select
										label="Tax Type"
										className="col-span-2"
										selectedKeys={[invoiceForm.taxType || 'STANDARD']}
										onSelectionChange={(keys) => {
											const v = Array.from(keys)[0] as string;
											if (v === 'NONE') {
												const subtotal = Number(invoiceForm.subtotal || 0);
												setInvoiceForm({ ...invoiceForm, taxType: 'NONE', taxAmount: 0, total: subtotal });
											} else {
												setInvoiceForm({ ...invoiceForm, taxType: v });
											}
										}}
									>
										<SelectItem key="STANDARD">Standard (Sales stack)</SelectItem>
										<SelectItem key="CUSTOM">Custom Rate</SelectItem>
										<SelectItem key="NONE">No Tax</SelectItem>
									</Select>
									{invoiceForm.taxType === 'CUSTOM' && (
										<Input type="number" label="Custom Rate %" value={invoiceForm.customTaxPercent?.toString() || ''} onChange={(e) => setInvoiceForm({ ...invoiceForm, customTaxPercent: e.target.value })} />
									)}
									<Button
										size="sm"
										variant="bordered"
										className={invoiceForm.taxType === 'CUSTOM' ? 'col-span-1' : 'col-span-2'}
										onPress={() => {
											const subtotal = Number(invoiceForm.subtotal || 0);
											if (invoiceForm.taxType === 'NONE') {
												setInvoiceForm({ ...invoiceForm, taxAmount: 0, total: subtotal });
												return;
											}
											if (invoiceForm.taxType === 'CUSTOM') {
												const taxAmount = +(subtotal * (Number(invoiceForm.customTaxPercent || 0) / 100)).toFixed(2);
												setInvoiceForm({ ...invoiceForm, taxAmount, total: subtotal + taxAmount });
												return;
											}
											const { totalTax } = computeSalesTax(subtotal);
											setInvoiceForm({ ...invoiceForm, taxAmount: totalTax, total: subtotal + totalTax });
										}}
									>Apply Tax</Button>
								</div>

								<div className="grid grid-cols-2 gap-4 mt-4">
									<Input type="number" isReadOnly label="Total" value={(Number(invoiceForm.subtotal || 0) + Number(invoiceForm.taxAmount || 0)).toString()} description="Subtotal + Tax — not independently editable" />
									<Input label="Description" value={invoiceForm.description || ''} onChange={(e) => setInvoiceForm({ ...invoiceForm, description: e.target.value })} />
								</div>

								{!invoiceForm.businessPartnerId && invoiceForm.customerName?.trim() && (
									<div className="mt-4 p-3 bg-gray-50 rounded-lg">
										<div className="text-sm font-medium text-gray-700 mb-3">
											New customer — additional details (optional)
										</div>
										<div className="grid grid-cols-2 gap-4">
											<Input label="Phone" value={invoiceForm.customerPhone || ''} onChange={(e) => setInvoiceForm({ ...invoiceForm, customerPhone: e.target.value })} />
											<Input label="Email" value={invoiceForm.customerEmail || ''} onChange={(e) => setInvoiceForm({ ...invoiceForm, customerEmail: e.target.value })} />
											<Input label="Address" value={invoiceForm.customerAddress || ''} onChange={(e) => setInvoiceForm({ ...invoiceForm, customerAddress: e.target.value })} className="col-span-2" />
											<Input label="Tax ID (TIN)" value={invoiceForm.customerTaxNumber || ''} onChange={(e) => setInvoiceForm({ ...invoiceForm, customerTaxNumber: e.target.value })} />
											<Input type="number" label="Credit Limit" value={invoiceForm.customerCreditLimit?.toString() || ''} onChange={(e) => setInvoiceForm({ ...invoiceForm, customerCreditLimit: e.target.value })} />
											<Select
												label="Payment Terms"
												className="col-span-2"
												selectedKeys={[invoiceForm.customerPaymentTerms || 'net30']}
												onSelectionChange={(s) => {
													const terms = Array.from(s)[0] as string;
													setInvoiceForm((f: any) => ({
														...f,
														customerPaymentTerms: terms,
														dueDate: dueDateFromTerms(f.date, f.businessPartnerId, terms),
													}));
												}}
											>
												<SelectItem key="immediate">Immediate</SelectItem>
												<SelectItem key="net30">Net 30</SelectItem>
												<SelectItem key="net60">Net 60</SelectItem>
												<SelectItem key="net90">Net 90</SelectItem>
											</Select>
										</div>
									</div>
								)}
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
													<div className="font-bold text-orange-600">{formatAccountingCurrency(receiptBalanceDue)}</div>
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
													<div className="font-medium">{formatAccountingCurrency(Number(selectedReceiptInvoice.total || 0))}</div>
												</div>
												<div>
													<div className="text-gray-500">Balance due</div>
													<div className="font-bold text-orange-600">{formatAccountingCurrency(receiptBalanceDue)}</div>
												</div>
												<div>
													<div className="text-gray-500">After this receipt</div>
													<div className="font-bold text-green-700">
														{formatAccountingCurrency(Math.max(0, receiptBalanceDue - roundMoney2(
															Number(receiptForm.amount || 0) +
															Number(receiptForm.whtAmount || 0) +
															Number(receiptForm.whtVatAmount || 0)
														)))}
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
												? `Balance due ${formatAccountingCurrency(receiptBalanceDue)}`
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
											<div>
												<Checkbox
													size="sm"
													isSelected={receiptForm.whtHasTax !== false}
													onValueChange={toggleReceiptWhtHasTax}
													classNames={{ label: 'text-xs font-medium text-gray-600' }}
												>
													Tax withheld (WHT)
												</Checkbox>
												<Input
													type="number"
													label={whtLabels.whtLabel}
													placeholder="0.00"
													value={receiptForm.whtAmount?.toString() ?? ''}
													onValueChange={(v) =>
														setReceiptForm((f: any) => ({ ...f, whtAmount: v }))
													}
													startContent="₵"
													isDisabled={receiptForm.whtHasTax === false}
													className="mt-1"
												/>
											</div>
											<div>
												<Checkbox
													size="sm"
													isSelected={receiptForm.whtHasVat !== false}
													onValueChange={toggleReceiptWhtHasVat}
													classNames={{ label: 'text-xs font-medium text-gray-600' }}
												>
													VAT withheld (WHT-VAT)
												</Checkbox>
												<Input
													type="number"
													label={whtLabels.whtVatLabel}
													placeholder="0.00"
													value={receiptForm.whtVatAmount?.toString() ?? ''}
													onValueChange={(v) =>
														setReceiptForm((f: any) => ({ ...f, whtVatAmount: v }))
													}
													startContent="₵"
													isDisabled={receiptForm.whtHasVat === false}
													className="mt-1"
												/>
											</div>
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
									<AttachmentUpload
										label="Attachments — bank slip, cheque photo, MoMo screenshot (optional)"
										attachments={receiptForm.attachments || []}
										onChange={(next) => setReceiptForm((f: any) => ({ ...f, attachments: next }))}
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
						
						// Use stored tax breakdown if available, otherwise reconstruct from the same
						// canonical stacked-tax engine used at checkout (computeSalesTax), so every
						// component that was actually charged (VAT/NHIL/GETFund/Tourism) shows up.
						const taxBreakdown = selectedInvoice.taxBreakdown && selectedInvoice.taxBreakdown.length > 0
							? selectedInvoice.taxBreakdown
							: (subtotal > 0 ? computeSalesTax(subtotal, totalTax).lines.map(l => ({
								code: l.taxCode,
								name: l.name,
								rate: l.rate,
								amount: l.amount,
							})) : []);

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
													<div className="flex justify-between"><span className="text-gray-500">PO / Reference:</span><span className="font-mono text-xs">{selectedInvoice.poNumber || selectedInvoice.reference || '-'}</span></div>
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
															<td className="py-2 text-right">{formatAccountingCurrency(Number(item.unitPrice || item.price || 0))}</td>
															<td className="py-2 text-right font-medium">{formatAccountingCurrency(Number((item.quantity || item.qty || 1) * (item.unitPrice || item.price || 0)))}</td>
														</tr>
													)) : (
														<tr className="border-b border-gray-100">
															<td className="py-2 text-gray-500">1</td>
															<td className="py-2">{selectedInvoice.description || 'Services/Products'}</td>
															<td className="py-2 text-right">1</td>
															<td className="py-2 text-right">{formatAccountingCurrency(subtotal)}</td>
															<td className="py-2 text-right font-medium">{formatAccountingCurrency(subtotal)}</td>
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
																	<td className="py-2 text-right font-mono">{formatAccountingCurrency(Number(tax.amount || 0))}</td>
																</tr>
															)) : (
																<tr className="border-b border-gray-200">
																	<td className="py-2 text-gray-400 italic" colSpan={2}>No taxes applied</td>
																</tr>
															)}
															<tr className="font-semibold">
																<td className="py-2 text-gray-800">Total Tax ({totalTaxRate.toFixed(1)}%)</td>
																<td className="py-2 text-right font-mono">{formatAccountingCurrency(totalTax)}</td>
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
																<td className="py-2 text-right font-mono">{formatAccountingCurrency(subtotal)}</td>
															</tr>
															<tr className="border-b border-gray-200">
																<td className="py-2 text-gray-600">Total Tax</td>
																<td className="py-2 text-right font-mono">{formatAccountingCurrency(totalTax)}</td>
															</tr>
															<tr className="border-b border-gray-200 font-semibold text-base">
																<td className="py-3 text-gray-900">TOTAL AMOUNT</td>
																<td className="py-3 text-right font-mono">{formatAccountingCurrency(Number(selectedInvoice.total || 0))}</td>
															</tr>
															<tr className="border-b border-gray-200">
																<td className="py-2 text-green-700">Amount Paid</td>
																<td className="py-2 text-right font-mono text-green-700">{formatAccountingCurrency(Number(selectedInvoice.paidAmount || 0))}</td>
															</tr>
															<tr className={`font-bold text-lg ${balance > 0 ? 'text-red-700' : 'text-green-700'}`}>
																<td className="py-3">BALANCE DUE</td>
																<td className="py-3 text-right font-mono">{formatAccountingCurrency(balance)}</td>
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
																	<td className="py-2 text-right font-semibold text-green-700">{formatAccountingCurrency(Number(r.amount))}</td>
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
									{!isProforma && selectedInvoice.status !== 'Void' && isManualArApSource(selectedInvoice.sourceModule) && invoiceReceipts.length === 0 && settings.hasPermission('accounting.void-transaction') && (
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
											<p className="text-4xl font-bold text-gray-900">{formatAccountingCurrency(Number(selectedReceipt.amount || 0))}</p>
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
															<td className="py-2 text-right font-mono text-green-700">{formatAccountingCurrency(Number(selectedReceipt.amount || 0))}</td>
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
																<td className="py-2 text-right font-mono">{formatAccountingCurrency(Number(linkedInvoice.total || 0))}</td>
															</tr>
															<tr className="border-b border-gray-200">
																<td className="py-2 text-gray-600">Total Paid (incl. this receipt)</td>
																<td className="py-2 text-right font-mono text-green-700">{formatAccountingCurrency(Number(linkedInvoice.paidAmount || 0))}</td>
															</tr>
															<tr className={`font-semibold ${invoiceBalance > 0 ? 'text-red-700' : 'text-green-700'}`}>
																<td className="py-2">Invoice Balance</td>
																<td className="py-2 text-right font-mono">{formatAccountingCurrency(invoiceBalance)}</td>
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

										{/* Attachments */}
										{selectedReceipt.attachments?.length > 0 && (
											<div>
												<h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Attachments</h4>
												<ul className="text-sm text-gray-700 bg-gray-50 p-4 rounded space-y-1">
													{selectedReceipt.attachments.map((a: string, i: number) => (
														<li key={i} className="font-mono text-xs">
														{/^https?:\/\//.test(a) ? (
															<a href={a} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
																{decodeURIComponent(a.split('/').pop() || a)}
															</a>
														) : a}
													</li>
													))}
												</ul>
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
									{selectedReceipt.status !== 'Void' && receiptCanVoid(selectedReceipt) && settings.hasPermission('accounting.void-transaction') && (
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
