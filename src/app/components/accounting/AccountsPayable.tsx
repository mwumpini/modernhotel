'use client';

import React, { useState, useMemo, useCallback } from 'react';
import HeadingInfo from '../HeadingInfo';
import { confirmDelete, confirmUnvoid, confirmVoid } from '../DangerConfirm';
import {
  Card, CardBody, Button, Input, Select, SelectItem,
  Table, TableHeader, TableColumn, TableBody, TableRow, TableCell,
  Chip, Checkbox, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter,
  Tabs, Tab, Textarea, Divider, Spinner, Alert, Pagination,
  Autocomplete, AutocompleteItem,
  Dropdown, DropdownTrigger, DropdownMenu, DropdownItem
} from "@heroui/react";
import { useAccountingStore } from '@/app/lib/accounting/store';
import { useSettingsStore } from '@/app/lib/settings/store';
import { useSupplierStore } from '@/app/lib/inventory/supplierStore';
import { useStockStore } from '@/app/lib/inventory/stockStore';
import { computePurchaseTax, getActiveTaxConfigs } from '@/app/lib/tax/engine';
import { useComplianceStore } from '@/app/lib/compliance/store';
import { computePurchaseWht, computePurchaseWhtVat, PURCHASE_WHT_CATEGORIES, type PurchaseWhtCategory } from '@/app/lib/accounting/purchaseWht';
import { formatAccountingCurrency } from '@/app/lib/accounting/tenantAccountingConfig';
import { filterFinanceApInvoices, computeSupplierAgingFromInvoices } from '@/app/lib/accounting/apSubledger';
import { GL_ACCOUNTS } from '@/app/lib/accounting/integration';
import { isManualArApSource } from '@/app/lib/accounting/journalReversal';
import { downloadCSV, openPrintPreview, generatePdfHtml } from '@/app/lib/accounting/helpers/exportHelpers';
import { buildOrgProfile } from '@/app/lib/print/buildOrgProfile';
import { buildSupplierPaymentVoucherPrintData, printSupplierPaymentVoucher } from '@/app/lib/accounting/paymentVoucherPrint';
import AttachmentUpload from '@/app/components/shared/AttachmentUpload';
import PostingDateField from '@/app/components/shared/PostingDateField';
import { SortLabel, deskResizableTableClassNames, rowClassNames, useResizableColumns } from '../frontoffice/columnResize';
import { useDeskPagination } from '../dashboard/deskTableUi';
import { DeskKpiStrip, deskBookTabsClassNames, deskBookTabPanelClassName, useAccountingDeskPeriod } from './DeskKpiStrip';
import { isInPeriod } from '@/app/lib/dashboard/useDashboardPeriod';
import { SupplierFormModal } from '../inventory/SuppliersPanel';

type AgingSortKey = 'supplier' | 'outstanding' | 'current' | 'overdue30' | 'overdue60' | 'overdue90' | 'overdue90Plus' | 'lastActivity';
type SupplierSortKey = 'supplier' | 'contact' | 'address' | 'creditLimit' | 'balance' | 'paymentTerms' | 'lastActivity' | 'status';
type BillSortKey = 'invoice' | 'supplier' | 'date' | 'dueDate' | 'subtotal' | 'tax' | 'total' | 'paid' | 'balance' | 'status' | 'aging' | 'approval';
type PaymentSortKey = 'payment' | 'supplier' | 'date' | 'amount' | 'method' | 'status';

const agingColumnWidths: Record<AgingSortKey, number> = {
  supplier: 152, outstanding: 110, current: 88, overdue30: 92, overdue60: 100,
  overdue90: 100, overdue90Plus: 92, lastActivity: 132,
};
const supplierColumnWidths: Record<SupplierSortKey, number> = {
  supplier: 152, contact: 148, address: 70, creditLimit: 115, balance: 112,
  paymentTerms: 112, lastActivity: 132, status: 104,
};
const billColumnWidths: Record<BillSortKey, number> = {
  invoice: 128, supplier: 144, date: 92, dueDate: 96, subtotal: 100, tax: 80,
  total: 100, paid: 92, balance: 100, status: 104, aging: 112, approval: 96,
};
const paymentColumnWidths: Record<PaymentSortKey, number> = {
  payment: 128, supplier: 152, date: 92, amount: 108, method: 96, status: 132,
};

function signedInPersonName() {
  const user = useSettingsStore.getState().currentUser;
  return `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || user?.email || user?.username || '';
}

function billProcessedBy(invoice: { preparedBy?: string; department?: string }) {
  const settings = useSettingsStore.getState();
  const user = settings.currentUser;
  const signedIn = signedInPersonName();
  const stored = String(invoice.preparedBy || '').trim();
  const name = stored && !/^system$/i.test(stored) ? stored : signedIn;
  const isSelf = !!name && (!stored || name === signedIn);
  const role = isSelf
    ? (user?.profile?.position || settings.roles.find((item) => item.id === user?.roleId)?.name || '')
    : '';
  const staffId = isSelf ? String(user?.profile?.employeeId || '').trim() : '';
  const department = String(invoice.department || (isSelf ? user?.profile?.department : '') || '').trim();
  return { name, role, staffId, department };
}

export default function AccountsPayablePage() {
  const {
    businessPartners,
    invoices,
    payments,
    chartOfAccounts,
    costCenters,
    bankAccounts,
    isLoading,
    error,
    addBusinessPartner,
    updateBusinessPartner,
    addInvoice,
    updateInvoice,
    deleteInvoice,
    voidInvoice,
    unvoidInvoice,
    addPayment,
    postPayment,
    deletePayment,
    voidPayment,
    unvoidPayment,
    updatePayment,
    recordSupplierWHTPayment,
    initializeAccounting,
  } = useAccountingStore();
  const expenseAccounts = useMemo(() => {
    const accounts = chartOfAccounts || [];
    const parentIds = new Set(accounts.map((a) => a.parentId).filter(Boolean) as string[]);
    const expenses = accounts.filter((a) => a.isActive !== false && (a.type === 'Expense' || a.type === 'Operating Expense' || a.type === 'Cost of Sales'));
    const leaves = expenses.filter((a) => !parentIds.has(a.id));
    return (leaves.length ? leaves : expenses).slice().sort((a, b) => a.name.localeCompare(b.name));
  }, [chartOfAccounts]);
  const expenseAccountChoices = (selectedCode?: string) => {
    if (!selectedCode || expenseAccounts.some((a) => a.code === selectedCode)) return expenseAccounts;
    const current = (chartOfAccounts || []).find((a) => a.code === selectedCode);
    return current ? [current, ...expenseAccounts] : expenseAccounts;
  };
  const defaultExpenseCode = (kind: 'item' | 'service') => {
    const prefer = kind === 'item' ? '5110' : '5680';
    if (expenseAccounts.some((a) => a.code === prefer)) return prefer;
    return expenseAccounts[0]?.code || '5100';
  };
  const canApprovePayments = useSettingsStore((s) => s.hasPermission('accounting.approve-payment'));
  const canManageAp = useSettingsStore((s) => s.hasPermission('accounting.manage-ap'));
  const canDeleteAp = useSettingsStore((s) => s.hasPermission('accounting.delete'));
  const canVoidAp = useSettingsStore((s) => s.hasPermission('accounting.void-transaction'));
  const { generateNextSupplierCode } = useSupplierStore();
  const { stockItems } = useStockStore();

  const [selectedTab, setSelectedTab] = useState("balances");
  const [isOpen, setIsOpen] = useState(false);
  const [supplierFormOpen, setSupplierFormOpen] = useState(false);
  const [dialogType, setDialogType] = useState<'supplier'|'invoice'|'payment'>('supplier');
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [postOnSave, setPostOnSave] = useState(true);
  const [showAdvancedInvoice, setShowAdvancedInvoice] = useState(false);
  const [showTaxDetail, setShowTaxDetail] = useState(false);
  const [lineEntryKind, setLineEntryKind] = useState<'item' | 'service'>('item');
  const [viewKind, setViewKind] = useState<'supplier' | 'invoice' | 'payment' | null>(null);
  const [viewItem, setViewItem] = useState<any>(null);
  const purchaseOrders = useSupplierStore((s) => s.purchaseOrders);
  const isViewOpen = viewKind != null && viewItem != null;

  // Filter states
  const [statusFilter, setStatusFilter] = useState('all');
  const [supplierFilter, setSupplierFilter] = useState('all');
  const [dateFromFilter, setDateFromFilter] = useState('');
  const [dateToFilter, setDateToFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setDateFromFilter('');
    setDateToFilter('');
    setIsRefreshing(true);
    await initializeAccounting();
    setTimeout(() => setIsRefreshing(false), 500);
  }, [initializeAccounting]);

  const [agingSortKey, setAgingSortKey] = useState<AgingSortKey>('outstanding');
  const [agingSortDir, setAgingSortDir] = useState<'asc' | 'desc'>('desc');
  const agingCols = useResizableColumns<AgingSortKey>(agingColumnWidths);

  const [supplierSortKey, setSupplierSortKey] = useState<SupplierSortKey>('supplier');
  const [supplierSortDir, setSupplierSortDir] = useState<'asc' | 'desc'>('asc');
  const supplierCols = useResizableColumns<SupplierSortKey>(supplierColumnWidths);

  const [billSortKey, setBillSortKey] = useState<BillSortKey>('date');
  const [billSortDir, setBillSortDir] = useState<'asc' | 'desc'>('desc');
  const billCols = useResizableColumns<BillSortKey>(billColumnWidths);

  const [paymentSortKey, setPaymentSortKey] = useState<PaymentSortKey>('date');
  const [paymentSortDir, setPaymentSortDir] = useState<'asc' | 'desc'>('desc');
  const paymentCols = useResizableColumns<PaymentSortKey>(paymentColumnWidths);

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (dialogType === 'supplier') {
      if (!form.name || String(form.name).trim().length < 2) e.name = 'Name is required';
      if (form.email && !/^([^\s@]+)@([^\s@]+)\.[^\s@]+$/.test(form.email)) e.email = 'Invalid email';
      if (form.phone && !/^[0-9+\-()\s]{6,}$/.test(form.phone)) e.phone = 'Invalid phone';
      if (form.creditLimit != null && Number(form.creditLimit) < 0) e.creditLimit = 'Must be >= 0';
      if (form.paymentTerms != null && Number(form.paymentTerms) < 0) e.paymentTerms = 'Must be >= 0';
    } else if (dialogType === 'invoice') {
      if (!form.businessPartnerId && !(form.supplierName || '').trim()) e.businessPartnerId = 'Supplier is required';
      if (!form.date) e.date = 'Date is required';
      if (!form.dueDate) e.dueDate = 'Due date is required';
      if (Number(form.total || 0) < 0) e.total = 'Total must be >= 0';
    } else if (dialogType === 'payment') {
      const whtAmount = form.applyWht ? Number(form.whtAmount || 0) : 0;
      if (!form.businessPartnerId && !(form.supplierName || '').trim()) e.businessPartnerId = 'Supplier is required';
      if (!form.date) e.date = 'Date is required';
      if (!(Number(form.amount || 0) + whtAmount > 0)) e.amount = 'Amount must be > 0';
      else if (Number(form.amount || 0) < 0) e.amount = 'Amount must be >= 0';
      if (form.paymentMethod === 'Bank' && !form.bankAccountId) e.bankAccountId = 'Bank account required for Bank payments';
      if (form.invoiceId) {
        const inv = purchaseInvoices.find(i => i.id === form.invoiceId);
        if (inv) {
          const paidForInvoice = payments.filter(p => p.invoiceId === inv.id).reduce((s, p) => s + p.amount, 0);
          const outstanding = Math.max(0, (inv.total || 0) - paidForInvoice);
          if (Number(form.amount || 0) + whtAmount > outstanding + 0.01) e.amount = `Amount exceeds outstanding (${formatAccountingCurrency(outstanding)})`;
        }
      }
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // Activity totals follow Customize KPI period; still-to-pay / overdue stay current open balance.
  const { period: kpiPeriod, todayISO: kpiToday } = useAccountingDeskPeriod();

  const totalInvoices = useMemo(() => {
    return invoices
      .filter((invoice) => invoice.type === 'Purchase' && isInPeriod(invoice.date || invoice.createdAt, kpiPeriod, kpiToday))
      .reduce((sum, invoice) => sum + invoice.total, 0);
  }, [invoices, kpiPeriod, kpiToday]);

  const totalPayments = useMemo(() => {
    return payments
      .filter((payment) => payment.type === 'Payment' && isInPeriod(payment.date || payment.createdAt, kpiPeriod, kpiToday))
      .reduce((sum, payment) => sum + payment.amount, 0);
  }, [payments, kpiPeriod, kpiToday]);

  // Filter purchase invoices — excludes Draft/Void, which have no GL impact and
  // shouldn't count toward payables/aging any more than a Draft/Void sale counts
  // toward receivables (see arSubledger.ts's isFinanceArInvoice, its AR mirror).
  const purchaseInvoices = useMemo(() => {
    return filterFinanceApInvoices(invoices);
  }, [invoices]);

  // Total Payables = sum of per-invoice balances (total − paidAmount on each invoice)
  const totalPayables = useMemo(() => {
    return purchaseInvoices
      .reduce((sum, invoice) => sum + Math.max(0, (invoice.total || 0) - (invoice.paidAmount || 0)), 0);
  }, [purchaseInvoices]);

  // Overdue = the portion of totalPayables whose due date has already passed
  const totalOverduePayables = useMemo(() => {
    const now = new Date();
    return purchaseInvoices
      .reduce((sum, invoice) => {
        const balance = Math.max(0, (invoice.total || 0) - (invoice.paidAmount || 0));
        if (balance <= 0) return sum;
        const dueDate = new Date(invoice.dueDate || invoice.date);
        const daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
        return daysOverdue > 0 ? sum + balance : sum;
      }, 0);
  }, [purchaseInvoices]);

  // Filter suppliers
  const suppliers = useMemo(() => {
    return businessPartners.filter(partner =>
      partner.type === 'Supplier' || partner.type === 'Both'
    );
  }, [businessPartners]);

  // Suppliers matching the shared search box (name, code, email, phone, tax ID)
  const filteredSuppliers = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return suppliers;
    return suppliers.filter(s =>
      [s.name, s.code, s.email, s.phone, s.taxNumber].some(v => (v || '').toLowerCase().includes(q))
    );
  }, [suppliers, searchTerm]);

  // Filter payments
  const supplierPayments = useMemo(() => {
    return payments.filter(payment => payment.type === 'Payment');
  }, [payments]);

  // Payments matching the shared search box (payment #, supplier name, reference)
  const filteredPayments = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return supplierPayments.filter((p: any) => {
      const d = String(p.date || '').slice(0, 10);
      if (dateFromFilter && d < dateFromFilter) return false;
      if (dateToFilter && d > dateToFilter) return false;
      if (!q) return true;
      const supplierName = suppliers.find(s => s.id === p.businessPartnerId)?.name || '';
      return [p.paymentNumber, supplierName, p.businessPartnerId, p.reference].some((v: any) => (v || '').toLowerCase().includes(q));
    });
  }, [supplierPayments, suppliers, searchTerm, dateFromFilter, dateToFilter]);

  // Supplier Aging Analysis — shared with any future report/audit-assist consumer via
  // apSubledger.ts, mirroring how arSubledger.ts centralizes AR's aging for the same reason.
  const supplierAging = useMemo(
    () => computeSupplierAgingFromInvoices(suppliers, invoices, payments),
    [suppliers, invoices, payments],
  );

  const filteredAging = useMemo(() => {
    const dated = Boolean(dateFromFilter || dateToFilter);
    const rows = dated
      ? computeSupplierAgingFromInvoices(
          suppliers,
          invoices.filter((inv) => {
            const d = String(inv.date || '').slice(0, 10);
            if (dateFromFilter && d < dateFromFilter) return false;
            if (dateToFilter && d > dateToFilter) return false;
            return true;
          }),
          payments,
        )
      : supplierAging;
    const open = rows.filter((s) => Math.abs(s.outstandingBalance) > 0.009);
    const q = searchTerm.trim().toLowerCase();
    if (!q) return open;
    return open.filter((s) =>
      [s.name, s.code, s.taxNumber].some((v) => (v || '').toLowerCase().includes(q)),
    );
  }, [supplierAging, suppliers, invoices, payments, searchTerm, dateFromFilter, dateToFilter]);

  // Filtered invoices
  const filteredInvoices = useMemo(() => {
    return purchaseInvoices.filter(invoice => {
      // Status filter
      if (statusFilter !== 'all') {
        const paidAmount = (invoice.paidAmount != null)
          ? invoice.paidAmount
          : supplierPayments.filter(p => p.invoiceId === invoice.id).reduce((sum, p) => sum + p.amount, 0);
        const balance = invoice.total - paidAmount;
        const dueDate = new Date(invoice.dueDate);
        const today = new Date();
        const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
        
        if (statusFilter === 'paid' && balance > 0) return false;
        if (statusFilter === 'outstanding' && balance <= 0) return false;
        if (statusFilter === 'overdue' && daysOverdue <= 0) return false;
      }
      
      // Supplier filter
      if (supplierFilter !== 'all' && invoice.businessPartnerId !== supplierFilter) return false;

      // Date filters
      if (dateFromFilter && invoice.date < dateFromFilter) return false;
      if (dateToFilter && invoice.date > dateToFilter) return false;

      // Free-text search — invoice #, PO #, description, supplier name
      const q = searchTerm.trim().toLowerCase();
      if (q) {
        const supplierName = suppliers.find(s => s.id === invoice.businessPartnerId)?.name || '';
        const haystack = [invoice.invoiceNumber, invoice.poNumber, invoice.description, supplierName].map(v => (v || '').toLowerCase());
        if (!haystack.some(v => v.includes(q))) return false;
      }

      return true;
    });
  }, [purchaseInvoices, supplierPayments, suppliers, statusFilter, supplierFilter, dateFromFilter, dateToFilter, searchTerm]);

  // Sorted list rows + Desk pagination (DESK_PAGE_SIZE 10)
  const sortedAging = useMemo(() => {
    const rows = [...filteredAging];
    const value = (s: (typeof rows)[0]): string | number => {
      switch (agingSortKey) {
        case 'supplier': return (s.name || '').toLowerCase();
        case 'outstanding': return s.outstandingBalance;
        case 'current': return s.current;
        case 'overdue30': return s.overdue30;
        case 'overdue60': return s.overdue60;
        case 'overdue90': return s.overdue90;
        case 'overdue90Plus': return s.overdue90Plus;
        case 'lastActivity': return s.lastInvoiceDate || s.lastPaymentDate || '';
        default: return '';
      }
    };
    rows.sort((a, b) => {
      const av = value(a); const bv = value(b);
      if (av < bv) return -1; if (av > bv) return 1; return 0;
    });
    return agingSortDir === 'asc' ? rows : rows.reverse();
  }, [filteredAging, agingSortKey, agingSortDir]);

  const sortedSuppliers = useMemo(() => {
    const rows = [...filteredSuppliers];
    const value = (s: (typeof rows)[0]): string | number => {
      const outstanding = supplierAging.find(a => a.id === s.id)?.outstandingBalance ?? 0;
      switch (supplierSortKey) {
        case 'supplier': return (s.name || '').toLowerCase();
        case 'contact': return (s.contactPerson || s.email || '').toLowerCase();
        case 'address': return (s.address || '').toLowerCase();
        case 'creditLimit': return s.creditLimit || 0;
        case 'balance': return outstanding;
        case 'paymentTerms': return s.paymentTerms ?? 0;
        case 'lastActivity': {
          const invs = purchaseInvoices.filter(inv => inv.businessPartnerId === s.id);
          return invs.length ? Math.max(...invs.map(inv => new Date(inv.date).getTime())) : 0;
        }
        case 'status': return outstanding > (s.creditLimit || 0) ? 2 : outstanding > 0 ? 1 : 0;
        default: return '';
      }
    };
    rows.sort((a, b) => {
      const av = value(a); const bv = value(b);
      if (av < bv) return -1; if (av > bv) return 1; return 0;
    });
    return supplierSortDir === 'asc' ? rows : rows.reverse();
  }, [filteredSuppliers, supplierAging, purchaseInvoices, supplierSortKey, supplierSortDir]);

  const sortedInvoices = useMemo(() => {
    const rows = [...filteredInvoices];
    const value = (invoice: (typeof rows)[0]): string | number => {
      const paidAmount = (invoice.paidAmount != null)
        ? invoice.paidAmount
        : supplierPayments.filter(p => p.invoiceId === invoice.id).reduce((sum, p) => sum + p.amount, 0);
      const balance = invoice.total - paidAmount;
      const daysOverdue = Math.floor((new Date().getTime() - new Date(invoice.dueDate).getTime()) / (1000 * 60 * 60 * 24));
      switch (billSortKey) {
        case 'invoice': return (invoice.invoiceNumber || '').toLowerCase();
        case 'supplier': return (suppliers.find(s => s.id === invoice.businessPartnerId)?.name || '').toLowerCase();
        case 'date': return new Date(invoice.date).getTime();
        case 'dueDate': return new Date(invoice.dueDate).getTime();
        case 'subtotal': return invoice.subtotal || 0;
        case 'tax': return invoice.taxAmount || 0;
        case 'total': return invoice.total || 0;
        case 'paid': return paidAmount;
        case 'balance': return balance;
        case 'status': return balance <= 0 ? 'paid' : daysOverdue > 0 ? 'overdue' : 'outstanding';
        case 'aging': return daysOverdue;
        case 'approval': return invoice.status || '';
        default: return '';
      }
    };
    rows.sort((a, b) => {
      const av = value(a); const bv = value(b);
      if (av < bv) return -1; if (av > bv) return 1; return 0;
    });
    return billSortDir === 'asc' ? rows : rows.reverse();
  }, [filteredInvoices, supplierPayments, suppliers, billSortKey, billSortDir]);

  const sortedPayments = useMemo(() => {
    const rows = [...filteredPayments];
    const value = (p: (typeof rows)[0]): string | number => {
      switch (paymentSortKey) {
        case 'payment': return (p.paymentNumber || '').toLowerCase();
        case 'supplier': return (suppliers.find(s => s.id === p.businessPartnerId)?.name || p.businessPartnerId || '').toLowerCase();
        case 'date': return new Date(p.date).getTime();
        case 'amount': return p.amount || 0;
        case 'method': return p.paymentMethod || '';
        case 'status': return p.status || '';
        default: return '';
      }
    };
    rows.sort((a, b) => {
      const av = value(a); const bv = value(b);
      if (av < bv) return -1; if (av > bv) return 1; return 0;
    });
    return paymentSortDir === 'asc' ? rows : rows.reverse();
  }, [filteredPayments, suppliers, paymentSortKey, paymentSortDir]);

  const agingPager = useDeskPagination(sortedAging, [agingSortKey, agingSortDir, searchTerm, filteredAging.length]);
  const suppliersPager = useDeskPagination(sortedSuppliers, [searchTerm, supplierSortKey, supplierSortDir]);
  const invoicesPager = useDeskPagination(sortedInvoices, [statusFilter, supplierFilter, dateFromFilter, dateToFilter, searchTerm, billSortKey, billSortDir]);
  const paymentsPager = useDeskPagination(sortedPayments, [searchTerm, dateFromFilter, dateToFilter, paymentSortKey, paymentSortDir]);

  const onAgingSort = (key: AgingSortKey) => {
    if (agingSortKey === key) setAgingSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setAgingSortKey(key);
      setAgingSortDir(key === 'supplier' || key === 'lastActivity' ? 'asc' : 'desc');
    }
  };
  const agingColumn = (key: AgingSortKey, label: string, align: 'left' | 'right' | 'center' = 'left') => (
    <TableColumn key={key} className="relative" style={agingCols.style(key)}>
      <SortLabel active={agingSortKey === key} dir={agingSortDir} align={align} onPress={() => onAgingSort(key)}>{label}</SortLabel>
      {agingCols.sizer(key, label)}
    </TableColumn>
  );

  const onSupplierSort = (key: SupplierSortKey) => {
    if (supplierSortKey === key) setSupplierSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSupplierSortKey(key); setSupplierSortDir('asc'); }
  };
  const supplierColumn = (key: SupplierSortKey, label: string, align: 'left' | 'right' | 'center' = 'left') => (
    <TableColumn key={key} className="relative" style={supplierCols.style(key)}>
      <SortLabel active={supplierSortKey === key} dir={supplierSortDir} align={align} onPress={() => onSupplierSort(key)}>{label}</SortLabel>
      {supplierCols.sizer(key, label)}
    </TableColumn>
  );

  const onBillSort = (key: BillSortKey) => {
    if (billSortKey === key) setBillSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setBillSortKey(key); setBillSortDir('asc'); }
  };
  const billColumn = (key: BillSortKey, label: string, align: 'left' | 'right' | 'center' = 'left') => (
    <TableColumn key={key} className="relative" style={billCols.style(key)}>
      <SortLabel active={billSortKey === key} dir={billSortDir} align={align} onPress={() => onBillSort(key)}>{label}</SortLabel>
      {billCols.sizer(key, label)}
    </TableColumn>
  );

  const onPaymentSort = (key: PaymentSortKey) => {
    if (paymentSortKey === key) setPaymentSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setPaymentSortKey(key); setPaymentSortDir('asc'); }
  };
  const paymentColumn = (key: PaymentSortKey, label: string, align: 'left' | 'right' | 'center' = 'left') => (
    <TableColumn key={key} className="relative" style={paymentCols.style(key)}>
      <SortLabel active={paymentSortKey === key} dir={paymentSortDir} align={align} onPress={() => onPaymentSort(key)}>{label}</SortLabel>
      {paymentCols.sizer(key, label)}
    </TableColumn>
  );

  const hotelBillTax = (subtotal: number) => {
    const compliance = useComplianceStore.getState();
    const loaded = compliance.taxTypes.some((t) => t.id === 'gh-purchases-hotel');
    const { taxes } = compliance.calculateTax(subtotal, 'HOTEL_BILL', {
      domain: 'purchases',
      operation: 'internal',
      typeId: 'gh-purchases-hotel',
    });
    if (loaded) {
      const rules = compliance.getActiveRules();
      const lines = taxes.map((line) => {
        const rule = rules.find((r) => r.id === line.ruleId);
        return {
          key: line.ruleId,
          label: `${line.name} ${line.rate}%`,
          amount: line.amount,
          recoverable: rule?.isRecoverable !== false,
        };
      });
      const tourism = +lines.filter((line) => !line.recoverable).reduce((sum, line) => sum + line.amount, 0).toFixed(2);
      const total = +lines.reduce((sum, line) => sum + line.amount, 0).toFixed(2);
      return { lines, tourism, total };
    }
    const purchase = computePurchaseTax(subtotal);
    const tourism = +((subtotal * 1) / 100).toFixed(2);
    return {
      lines: [
        ...purchase.lines.map((line) => ({
          key: line.taxCode || line.name,
          label: `${line.name} ${line.rate}%`,
          amount: line.amount,
          recoverable: true,
        })),
        { key: 'tourism', label: 'Tourism Levy 1%', amount: tourism, recoverable: false },
      ],
      tourism,
      total: +(purchase.totalTax + tourism).toFixed(2),
    };
  };

  const taxFromSubtotal = (subtotal: number, taxType?: string, customTaxPercent?: number) => {
    const type = taxType || 'STANDARD';
    if (type === 'NONE') return 0;
    if (type === 'CUSTOM') return +(subtotal * (Number(customTaxPercent || 0) / 100)).toFixed(2);
    if (type === 'HOTEL') return hotelBillTax(subtotal).total;
    return +computePurchaseTax(subtotal).totalTax.toFixed(2);
  };

  const purchaseTaxLines = (current: { taxType?: string; subtotal?: number; taxAmount?: number; customTaxPercent?: number }) => {
    const type = current.taxType || 'STANDARD';
    const subtotal = Number(current.subtotal || 0);
    if (type === 'NONE') return [{ key: 'none', label: 'No tax', amount: 0 }];
    if (type === 'CUSTOM') {
      const rate = Number(current.customTaxPercent || 0);
      return [{ key: 'custom', label: rate > 0 ? `Custom ${rate}%` : 'Custom', amount: Number(current.taxAmount || 0) }];
    }
    if (type === 'HOTEL') return hotelBillTax(subtotal).lines;
    const computed = computePurchaseTax(subtotal).lines;
    if (computed.length) {
      return computed.map((line) => ({
        key: line.taxCode || line.name,
        label: `${line.name} ${line.rate}%`,
        amount: line.amount,
      }));
    }
    const order: Record<string, number> = { NHIL: 10, GETFund: 20, VAT: 30, Tourism: 40, COVID19: 50 };
    return getActiveTaxConfigs()
      .filter((c) => c.isActive && c.rate > 0 && c.type !== 'Withholding' && c.applyOnPurchases !== false && c.isRecoverable)
      .sort((a, b) => (order[a.type] ?? 60) - (order[b.type] ?? 60))
      .map((c) => ({ key: c.code, label: `${c.name} ${c.rate}%`, amount: 0 }));
  };

  const taxBreakdownFor = (current: any, taxType: string, subtotal: number, taxAmount: number) => {
    const tb = { ...(current.taxBreakdown || {}) };
    if (taxType === 'HOTEL') tb.tourism = hotelBillTax(subtotal).tourism;
    else delete tb.tourism;
    if (current.whtVatApplicable) {
      const vatBase = taxType === 'HOTEL' ? Math.max(0, taxAmount - Number(tb.tourism || 0)) : taxAmount;
      tb.withholdingVat = computePurchaseWhtVat(vatBase)?.amount || 0;
    }
    return tb;
  };

  const recomputeInvoiceFromLines = (
    lines: any[],
    taxType?: string,
    customTaxPercent?: number,
    taxBreakdown?: any,
  ) => {
    const subtotal = lines.reduce((s: number, l: any) => {
      const qty = l.lineKind === 'service' ? 1 : Number(l.quantity || 0);
      return s + qty * Number(l.unitPrice || 0);
    }, 0);
    const type = taxType ?? form.taxType;
    const taxAmount = taxFromSubtotal(subtotal, type, customTaxPercent ?? form.customTaxPercent);
    const nextBreakdown = taxBreakdownFor(
      { ...form, taxBreakdown: taxBreakdown ?? form.taxBreakdown },
      type || 'STANDARD',
      subtotal,
      taxAmount,
    );
    if (form.whtApplicable) {
      const wht = computePurchaseWht(subtotal, form.whtCategory || 'SERVICE');
      nextBreakdown.withholding = wht?.amount || 0;
    }
    return {
      lines,
      subtotal: +subtotal.toFixed(2),
      taxAmount,
      total: +(subtotal + taxAmount).toFixed(2),
      taxBreakdown: nextBreakdown,
    };
  };

  const resolveOrCreateSupplierId = (currentForm: any): string | null => {
    if (currentForm.businessPartnerId) return currentForm.businessPartnerId;
    const name = String(currentForm.supplierName || '').trim();
    if (name.length < 2) return null;
    const existing = suppliers.find((s) => s.name.toLowerCase() === name.toLowerCase());
    if (existing) return existing.id;
    const id = `SUP-${Date.now()}`;
    const now = new Date().toISOString();
    addBusinessPartner({
      id,
      code: generateNextSupplierCode(),
      name,
      type: 'Supplier',
      taxNumber: '',
      address: '',
      phone: currentForm.supplierPhone || '',
      email: currentForm.supplierEmail || '',
      contactPerson: '',
      creditLimit: 0,
      paymentTerms: 30,
      glAccountCode: GL_ACCOUNTS.ACCOUNTS_PAYABLE,
      currency: 'GHS',
      balance: 0,
      isActive: true,
      countryCode: 'GH',
      createdAt: now,
      updatedAt: now,
    });
    return id;
  };

  // Opens the "new invoice" dialog pre-filled for a given supplier — used by every quick-action
  // "Invoice" button so they all create a real invoice instead of misusing `editing` (which
  // must hold an invoice being edited, never a supplier) and silently no-op'ing on save.
  const openNewInvoiceFor = (supplierId: string) => {
    setDialogType('invoice');
    setEditing(null);
    setShowAdvancedInvoice(false);
    setShowTaxDetail(false);
    setLineEntryKind('item');
    const today = new Date().toISOString().slice(0, 10);
    const supplier = suppliers.find((s) => s.id === supplierId);
    const terms = supplier?.paymentTerms || 0;
    const due = new Date(Date.now() + terms * 86400000).toISOString().slice(0, 10);
    const vatCfg = useAccountingStore.getState().taxConfigs.find((c) => c.type === 'VAT' && c.isActive);
    setForm({
      businessPartnerId: supplierId,
      supplierName: supplier?.name || '',
      invoiceNumber: '',
      date: today,
      dueDate: due,
      currency: 'GHS',
      exchangeRate: 1,
      subtotal: 0,
      taxAmount: 0,
      total: 0,
      taxType: 'STANDARD',
      claimInputTax: vatCfg ? vatCfg.isRecoverable !== false : true,
      description: '',
      preparedBy: signedInPersonName(),
      lines: [{ id: `INL-${Date.now()}`, lineKind: 'item', description: '', quantity: 1, unitPrice: 0, glAccountCode: defaultExpenseCode('item'), uom: 'Each' }],
    });
    setIsOpen(true);
  };

  const closeView = () => {
    setViewKind(null);
    setViewItem(null);
  };

  const openBillView = (invoice: any) => {
    setViewKind('invoice');
    setViewItem(invoice);
  };

  const openBillEdit = (invoice: any) => {
    if (invoice.status === 'Void') {
      window.alert('Voided bills cannot be edited');
      return;
    }
    const activePay = payments.filter((p) => p.invoiceId === invoice.id && p.status !== 'Void');
    if (activePay.length > 0) {
      window.alert('Void linked payments before editing this bill');
      return;
    }
    setDialogType('invoice');
    setEditing(invoice);
    setShowAdvancedInvoice(false);
    setShowTaxDetail(false);
    const rawLines = invoice.lines || invoice.items || invoice.lineItems || [];
    const normalized = rawLines.map((ln: any) => ({
      ...ln,
      lineKind: ln.lineKind || (ln.itemId ? 'item' : 'service'),
    }));
    setLineEntryKind(normalized.some((ln: any) => ln.lineKind === 'service') && !normalized.some((ln: any) => ln.lineKind === 'item') ? 'service' : 'item');
    setForm({
      businessPartnerId: invoice.businessPartnerId,
      supplierName: suppliers.find((s) => s.id === invoice.businessPartnerId)?.name || '',
      invoiceNumber: invoice.invoiceNumber,
      date: String(invoice.date || '').slice(0, 10),
      dueDate: String(invoice.dueDate || invoice.date || '').slice(0, 10),
      subtotal: invoice.subtotal,
      taxAmount: invoice.taxAmount,
      total: invoice.total,
      currency: invoice.currency || 'GHS',
      exchangeRate: invoice.exchangeRate ?? 1,
      description: invoice.description,
      poNumber: invoice.poNumber || '',
      receiptNumber: invoice.receiptNumber || '',
      discountAmount: invoice.discountAmount || 0,
      shippingCharges: invoice.shippingCharges || 0,
      otherCharges: invoice.otherCharges || 0,
      paidAmount: invoice.paidAmount || 0,
      taxBreakdown: invoice.taxBreakdown,
      taxType: invoice.taxType || 'STANDARD',
      claimInputTax: invoice.claimInputTax !== false,
      whtApplicable: Number(invoice.taxBreakdown?.withholding || 0) > 0,
      whtVatApplicable: Number(invoice.taxBreakdown?.withholdingVat || 0) > 0,
      whtCategory: invoice.whtCategory || 'SERVICE',
      attachments: invoice.attachments || [],
      preparedBy: invoice.preparedBy || '',
      checkedBy: invoice.checkedBy || '',
      approvedBy: invoice.approvedBy || '',
      authorizedBy: invoice.authorizedBy || '',
      paymentApprovedBy: invoice.paymentApprovedBy || '',
      department: invoice.department || '',
      lines: normalized,
    });
    setIsOpen(true);
  };

  const billActivePayments = (invoiceId: string) =>
    payments.filter((p) => p.invoiceId === invoiceId && p.status !== 'Void');

  const printBillPDF = (invoice: any) => {
    try {
      if (!invoice) {
        window.alert('No bill selected to print.');
        return;
      }
      const esc = (value: unknown) => String(value ?? '').replace(/[&<>"]/g, (ch) => (
        ch === '&' ? '&amp;' : ch === '<' ? '&lt;' : ch === '>' ? '&gt;' : '&quot;'
      ));
      const money = (amount: number) => esc(formatAccountingCurrency(amount));
      const supplier = suppliers.find((s) => s.id === invoice.businessPartnerId);
      const paidAmount = (invoice.paidAmount != null)
        ? invoice.paidAmount
        : supplierPayments.filter((p) => p.invoiceId === invoice.id).reduce((sum, p) => sum + p.amount, 0);
      const balance = (invoice.total || 0) - paidAmount;
      const dueRaw = invoice.dueDate || invoice.date;
      const dueDate = new Date(dueRaw);
      const dueValid = !Number.isNaN(dueDate.getTime());
      const daysOverdue = dueValid ? Math.floor((Date.now() - dueDate.getTime()) / 86400000) : 0;
      const statusLabel = balance <= 0 ? 'Paid' : daysOverdue > 0 ? 'Overdue' : 'Still owed';
      const storedLines = (invoice.lines || invoice.items || invoice.lineItems || []).map((ln: any) => {
        const quantity = Number(ln.quantity || 1) || 1;
        const unitPrice = Number(ln.unitPrice || 0);
        const amount = ln.amount != null && ln.amount !== '' ? Number(ln.amount) : quantity * unitPrice;
        return {
          description: String(ln.description || ln.itemName || ''),
          quantity,
          unitPrice: unitPrice || (quantity ? amount / quantity : amount),
          amount,
        };
      });
      const linkedPo = purchaseOrders.find((po) => po.poNumber && po.poNumber === invoice.poNumber);
      const poLines = (linkedPo?.items || []).map((item) => ({
        description: item.itemName,
        quantity: Number(item.quantity || 0),
        unitPrice: Number(item.unitCost || 0),
        amount: Number(item.totalCost || (Number(item.quantity || 0) * Number(item.unitCost || 0))),
      }));
      const linesToShow = storedLines.length > 1 ? storedLines : (poLines.length > storedLines.length ? poLines : storedLines);
      const rows = (linesToShow.length ? linesToShow : [{
        description: invoice.description || 'Purchase',
        quantity: 1,
        unitPrice: Number(invoice.subtotal || 0),
        amount: Number(invoice.subtotal || 0),
      }]).map((ln: { description: string; quantity: number; unitPrice: number; amount: number }) => `<tr>
        <td>${esc(ln.description || '—')}</td>
        <td class="num">${esc(ln.quantity)}</td>
        <td class="num">${money(ln.unitPrice)}</td>
        <td class="num strong">${money(ln.amount)}</td>
      </tr>`).join('');
      const wht = Number(invoice.taxBreakdown?.withholding || 0);
      const whtVat = Number(invoice.taxBreakdown?.withholdingVat || 0);
      const payments = billActivePayments(invoice.id);
      const paymentRows = payments.map((p) => `<tr>
        <td class="mono">${esc(p.paymentNumber || p.id)}</td>
        <td>${esc(new Date(p.date).toLocaleDateString())}</td>
        <td>${esc(p.paymentMethod || '—')}</td>
        <td class="num strong">${money(Number(p.amount || 0))}</td>
      </tr>`).join('');
      const processed = billProcessedBy(invoice);
      const hero = balance > 0 ? balance : Number(invoice.total || 0);
      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Purchase bill ${esc(invoice.invoiceNumber || invoice.id)}</title>
        <style>
          * { box-sizing: border-box; }
          body { font-family: 'Segoe UI', Arial, sans-serif; color: #111827; margin: 0; padding: 28px; }
          .top { display: flex; justify-content: space-between; gap: 16px; border-bottom: 1px solid #e5e7eb; padding-bottom: 10px; }
          h1 { font-size: 16px; margin: 0; }
          .chip { display: inline-block; margin-left: 8px; padding: 2px 8px; border-radius: 999px; background: #f3f4f6; font-size: 12px; font-weight: 600; }
          .chip.ok { background: #dcfce7; color: #166534; }
          .chip.warn { background: #fee2e2; color: #991b1b; }
          .num-no { font-family: ui-monospace, monospace; font-size: 13px; color: #374151; margin: 2px 0 0; }
          .meta { text-align: right; font-size: 12px; color: #4b5563; }
          .hero { text-align: center; padding: 16px 0; border-bottom: 1px solid #e5e7eb; }
          .kicker { font-size: 11px; letter-spacing: 0.04em; text-transform: uppercase; color: #6b7280; margin: 0; }
          .hero .sum { font-size: 28px; font-weight: 700; margin: 2px 0; }
          .hero .sum.owed { color: #111827; }
          .hero .sum.paid { color: #15803d; }
          .fine { font-size: 12px; color: #6b7280; margin: 0; }
          .pair { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; padding: 12px 0; border-bottom: 1px solid #e5e7eb; font-size: 13px; }
          .label { font-size: 11px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; color: #6b7280; margin: 0 0 4px; }
          .name { font-weight: 700; }
          .muted { color: #6b7280; font-size: 12px; }
          .row { display: flex; justify-content: space-between; gap: 12px; }
          .split { display: grid; grid-template-columns: minmax(0, 1fr) 220px; gap: 12px; margin-top: 12px; }
          table.grid { width: 100%; border-collapse: collapse; font-size: 13px; background: #fff; }
          table.grid th, table.grid td { border: 1px solid #d1d5db; padding: 6px 8px; vertical-align: top; }
          table.grid th { background: #f3f4f6; color: #374151; font-size: 12px; font-weight: 600; text-align: left; }
          .num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
          .strong { font-weight: 600; }
          .mono { font-family: ui-monospace, monospace; font-size: 12px; }
          .green { color: #15803d; }
          .red { color: #dc2626; }
          h2 { font-size: 11px; letter-spacing: 0.04em; text-transform: uppercase; color: #6b7280; margin: 0 0 6px; }
          .pay-break { border-top: 1px solid #111827; margin-top: 16px; padding-top: 12px; }
        </style></head><body>
        <div class="top">
          <div>
            <h1>PURCHASE BILL <span class="chip ${balance <= 0 ? 'ok' : daysOverdue > 0 ? 'warn' : ''}">${esc(statusLabel)}</span></h1>
            <p class="num-no">${esc(invoice.invoiceNumber || invoice.id)}</p>
          </div>
          <div class="meta">
            <div>Supplier: <strong>${esc(supplier?.name || '—')}</strong></div>
            <div>Date: ${esc(new Date(invoice.date).toLocaleDateString())}</div>
          </div>
        </div>
        <div class="hero">
          <p class="kicker">${balance > 0 ? 'Still owed' : 'Paid in full'}</p>
          <p class="sum ${balance > 0 ? 'owed' : 'paid'}">${money(hero)}</p>
          <p class="fine">Total ${money(Number(invoice.total || 0))} · Paid ${money(paidAmount)}</p>
        </div>
        <div class="pair">
          <div>
            <p class="label">Supplier</p>
            <div class="name">${esc(supplier?.name || 'Unknown')}</div>
            <div class="muted">${esc(supplier?.code || invoice.businessPartnerId || '')}</div>
            ${supplier?.phone ? `<div class="muted">${esc(supplier.phone)}</div>` : ''}
            ${supplier?.taxNumber ? `<div class="muted">TIN ${esc(supplier.taxNumber)}</div>` : ''}
          </div>
          <div>
            <p class="label">Bill</p>
            <div class="row"><span class="muted">Invoice date</span><span>${esc(new Date(invoice.date).toLocaleDateString())}</span></div>
            <div class="row"><span class="muted">Due</span><span class="${daysOverdue > 0 && balance > 0 ? 'red' : ''}">${dueValid ? esc(dueDate.toLocaleDateString()) : '—'}</span></div>
            ${invoice.poNumber ? `<div class="row"><span class="muted">Purchase order</span><span class="mono">${esc(invoice.poNumber)}</span></div>` : ''}
            ${invoice.description ? `<p class="muted">${esc(invoice.description)}</p>` : ''}
          </div>
          ${processed.name ? `<div>
            <p class="label">Processed by</p>
            <div class="name">${esc(processed.name)}</div>
            ${processed.staffId ? `<div class="muted">${esc(processed.staffId)}</div>` : ''}
            ${processed.role ? `<div class="muted">${esc(processed.role)}</div>` : ''}
            ${processed.department ? `<div class="muted">${esc(processed.department)}</div>` : ''}
          </div>` : ''}
        </div>
        <div class="split">
          <div>
            <h2>Lines</h2>
            <table class="grid">
              <thead><tr><th>Description</th><th class="num">Qty</th><th class="num">Unit</th><th class="num">Amount</th></tr></thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
          <div>
            <h2>Totals</h2>
            <table class="grid">
              <tbody>
                <tr><td>Subtotal</td><td class="num">${money(Number(invoice.subtotal || 0))}</td></tr>
                <tr><td>Tax</td><td class="num">${money(Number(invoice.taxAmount || 0))}</td></tr>
                ${wht > 0 ? `<tr><td>WHT</td><td class="num">−${money(wht)}</td></tr>` : ''}
                ${whtVat > 0 ? `<tr><td>WHT-VAT</td><td class="num">−${money(whtVat)}</td></tr>` : ''}
                <tr class="strong"><td>Total</td><td class="num">${money(Number(invoice.total || 0))}</td></tr>
                <tr class="green"><td>Paid</td><td class="num">${money(paidAmount)}</td></tr>
                <tr class="strong ${balance > 0 ? 'red' : 'green'}"><td>Balance</td><td class="num">${money(balance)}</td></tr>
              </tbody>
            </table>
          </div>
        </div>
        ${payments.length ? `<div class="pay-break"><h2>Payments</h2><table class="grid">
          <thead><tr><th>Payment</th><th>Date</th><th>Method</th><th class="num">Amount</th></tr></thead>
          <tbody>${paymentRows}</tbody>
        </table></div>` : ''}
        </body></html>`;
      openPrintPreview(html);
    } catch (err) {
      console.error('[AP] Print bill failed', err);
      window.alert('Could not print this bill.');
    }
  };

  const printPaymentPDF = (payment: any) => {
    try {
      if (!payment) {
        window.alert('No payment selected to print.');
        return;
      }
      const settings = useSettingsStore.getState();
      const supplier = suppliers.find((s) => s.id === payment.businessPartnerId);
      const linkedBill = payment.invoiceId ? purchaseInvoices.find((i) => i.id === payment.invoiceId) : undefined;
      const bank = payment.bankAccountId ? bankAccounts.find((b) => b.id === payment.bankAccountId) : undefined;
      const user = settings.currentUser;
      const preparedBy = `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || user?.email || user?.username || payment.staffName;
      const data = buildSupplierPaymentVoucherPrintData({
        payment,
        payee: {
          name: supplier?.name || 'Supplier',
          address: supplier?.address,
          phone: supplier?.phone,
          email: supplier?.email,
          contactPerson: supplier?.contactPerson,
          taxNumber: supplier?.taxNumber,
        },
        bill: linkedBill,
        bank,
        accountName: (code) => chartOfAccounts.find((a) => a.code === code)?.name,
        org: buildOrgProfile(settings),
        currency: settings.countryCompliance?.[settings.defaultCountry]?.currencySymbol || '₵',
        preparedBy,
      });
      const selectedVoucher = settings.printing?.['payment-voucher'];
      const voucherKey = !selectedVoucher || selectedVoucher === 'builtin-payment-voucher-standard'
        ? 'builtin-payment-voucher-ledger'
        : selectedVoucher;
      printSupplierPaymentVoucher(voucherKey, data);
    } catch (err) {
      console.error('[AP] Print payment failed', err);
      window.alert('Could not print this payment.');
    }
  };

  const handleVoidBill = async (invoice: any) => {
    if (!canVoidAp) {
      window.alert("You don't have permission to void bills.");
      return;
    }
    if (invoice.status === 'Void') return;
    if (billActivePayments(invoice.id).length > 0) {
      window.alert('Void linked payments on this bill first.');
      return;
    }
    if (!(await confirmVoid(invoice.invoiceNumber || 'this bill', 'A reversing GL entry will be posted. The bill stays on file as Void.'))) return;
    await voidInvoice(invoice.id);
    const err = useAccountingStore.getState().error;
    if (err) {
      window.alert(err);
      return;
    }
    closeView();
  };

  const handleUnvoidBill = async (invoice: any) => {
    if (!canVoidAp) {
      window.alert("You don't have permission to unvoid bills.");
      return;
    }
    if (invoice.status !== 'Void') return;
    if (!(await confirmUnvoid(invoice.invoiceNumber || 'this bill', 'The bill counts again. The void entry is reversed so the books match.'))) return;
    await unvoidInvoice(invoice.id);
    const err = useAccountingStore.getState().error;
    if (err) {
      window.alert(err);
      return;
    }
    closeView();
  };

  const handleDeleteBill = async (invoice: any) => {
    if (!canDeleteAp) {
      window.alert("You don't have permission to delete bills.");
      return;
    }
    if (invoice.status === 'Void') {
      window.alert('Voided bills cannot be deleted');
      return;
    }
    if (billActivePayments(invoice.id).length > 0) {
      window.alert('Void or delete linked payments on this bill first.');
      return;
    }
    if (!isManualArApSource(invoice.sourceModule) && invoice.status === 'Posted') {
      window.alert('Only manually entered bills can be deleted here');
      return;
    }
    const label = invoice.invoiceNumber || invoice.id;
    const isDraft = invoice.status === 'Draft';
    if (!(await confirmDelete(label, isDraft
      ? 'This draft will be permanently removed. This cannot be undone.'
      : 'The bill will be voided (GL reversed) then removed.',
    ))) return;
    if (!isDraft && invoice.status === 'Posted') {
      await voidInvoice(invoice.id);
      const err = useAccountingStore.getState().error;
      if (err) {
        window.alert(err);
        return;
      }
    }
    deleteInvoice(invoice.id);
    closeView();
  };

  const handleVoidPayment = async (payment: any) => {
    if (!canVoidAp) {
      window.alert("You don't have permission to void payments.");
      return;
    }
    if (payment.status === 'Void') return;
    if (!(await confirmVoid(payment.paymentNumber || 'this payment', 'This reverses GL and reopens the bill balance. The payment stays on file as Void.'))) return;
    await voidPayment(payment.id);
    const err = useAccountingStore.getState().error;
    if (err) {
      window.alert(err);
      return;
    }
    closeView();
  };

  const handleUnvoidPayment = async (payment: any) => {
    if (!canVoidAp) {
      window.alert("You don't have permission to unvoid payments.");
      return;
    }
    if (payment.status !== 'Void') return;
    if (!(await confirmUnvoid(payment.paymentNumber || 'this payment', 'The payment counts again. Unvoid the bill first if that bill is still void.'))) return;
    await unvoidPayment(payment.id);
    const err = useAccountingStore.getState().error;
    if (err) {
      window.alert(err);
      return;
    }
    closeView();
  };

  const handleDeletePayment = async (payment: any) => {
    if (!canDeleteAp) {
      window.alert("You don't have permission to delete payments.");
      return;
    }
    if (payment.status === 'Void') {
      window.alert('Voided payments cannot be deleted');
      return;
    }
    const isDraft = payment.status === 'Draft' || payment.status === 'Pending Approval';
    if (!isDraft && !isManualArApSource(payment.sourceModule)) {
      window.alert('Only draft or manual payments can be deleted here');
      return;
    }
    const label = payment.paymentNumber || payment.id;
    if (!(await confirmDelete(label, isDraft
      ? 'This draft will be permanently removed. This cannot be undone.'
      : 'The payment will be voided then removed.',
    ))) return;
    if (!isDraft && payment.status === 'Posted') {
      await voidPayment(payment.id);
      const err = useAccountingStore.getState().error;
      if (err) {
        window.alert(err);
        return;
      }
    }
    deletePayment(payment.id);
    closeView();
  };

  // Opens the "record payment" dialog pre-filled for a given supplier/amount.
  const openNewPaymentFor = (supplierId: string, amount: number, description: string) => {
    setDialogType('payment');
    setEditing(null);
    setForm({
      businessPartnerId: supplierId,
      supplierName: suppliers.find((s) => s.id === supplierId)?.name || '',
      date: new Date().toISOString().slice(0, 10),
      amount,
      paymentMethod: 'Bank',
      reference: description,
    });
    setIsOpen(true);
  };

  // Opens the "record payment" dialog for a specific invoice, pre-selected and pre-split into
  // cash + any remaining WHT — mirrors the invoice Autocomplete's own selection logic so every
  // entry point into "pay this invoice" behaves the same way.
  const openPaymentForInvoice = (inv: (typeof purchaseInvoices)[number]) => {
    const paidForInvoice = payments.filter(p => p.invoiceId === inv.id).reduce((s, p) => s + p.amount, 0);
    const outstanding = Math.max(0, (inv.total || 0) - paidForInvoice);
    const whtConfigured = Number(inv.taxBreakdown?.withholding || 0);
    const whtVatConfigured = Number(inv.taxBreakdown?.withholdingVat || 0);
    const whtAlreadyWithheld = payments
      .filter((p: any) => p.invoiceId === inv.id && p.isWHTCertificate)
      .reduce((s: number, p: any) => s + Number(p.whtAmount || 0), 0);
    const whtVatAlreadyWithheld = payments
      .filter((p: any) => p.invoiceId === inv.id && p.isWHTCertificate)
      .reduce((s: number, p: any) => s + Number(p.whtVatAmount || 0), 0);
    const whtRemaining = Math.min(outstanding, Math.max(0, whtConfigured - whtAlreadyWithheld));
    const whtVatRemaining = Math.min(Math.max(0, outstanding - whtRemaining), Math.max(0, whtVatConfigured - whtVatAlreadyWithheld));
    const applyWht = whtRemaining > 0 || whtVatRemaining > 0;
    const amount = Math.max(0, outstanding - whtRemaining - whtVatRemaining);
    setDialogType('payment');
    setEditing(null);
    setForm({
      businessPartnerId: inv.businessPartnerId,
      supplierName: suppliers.find((s) => s.id === inv.businessPartnerId)?.name || '',
      invoiceId: inv.id,
      date: new Date().toISOString().slice(0, 10),
      amount,
      applyWht,
      whtAmount: whtRemaining,
      whtVatAmount: whtVatRemaining,
      paymentMethod: 'Bank',
      reference: `Payment for invoice ${inv.invoiceNumber}`,
    });
    setIsOpen(true);
  };

  const openAgingSupplier = (supplier: (typeof supplierAging)[number]) => {
    setSupplierFilter(supplier.id);
    setStatusFilter('all');
    setDateFromFilter('');
    setDateToFilter('');
    setSearchTerm('');
    setSelectedTab('invoices');
  };

  const openSupplierView = (supplier: (typeof suppliers)[number]) => {
    setViewKind('supplier');
    setViewItem(supplier);
  };

  const openSupplierEdit = (supplier: (typeof suppliers)[number]) => {
    const outstandingBalance = supplierAging.find((a) => a.id === supplier.id)?.outstandingBalance ?? 0;
    setDialogType('supplier');
    setEditing(supplier);
    setForm({
      ...supplier,
      code: supplier.code,
      name: supplier.name,
      contactPerson: supplier.contactPerson || '',
      email: supplier.email || '',
      phone: supplier.phone || '',
      taxNumber: supplier.taxNumber || '',
      taxId: supplier.taxNumber || '',
      address: supplier.address || '',
      country: supplier.countryCode === 'GH' ? 'Ghana' : supplier.countryCode || 'Ghana',
      paymentTerms: supplier.paymentTerms === 0 ? 'immediate' :
                    supplier.paymentTerms === 30 ? 'net30' :
                    supplier.paymentTerms === 60 ? 'net60' :
                    supplier.paymentTerms === 90 ? 'net90' : 'net30',
      creditLimit: supplier.creditLimit || 0,
      currentBalance: outstandingBalance,
      isActive: supplier.isActive !== undefined ? supplier.isActive : true,
    });
    setIsOpen(true);
  };

  const openPaymentView = (payment: (typeof supplierPayments)[number]) => {
    setViewKind('payment');
    setViewItem(payment);
  };

  const openPaymentEdit = (payment: (typeof supplierPayments)[number]) => {
    if (payment.status === 'Void') {
      window.alert('Voided payments cannot be edited');
      return;
    }
    setDialogType('payment');
    setEditing(payment);
    setShowAdvancedInvoice(false);
    setForm({
      businessPartnerId: payment.businessPartnerId,
      supplierName: suppliers.find((s) => s.id === payment.businessPartnerId)?.name || '',
      date: String(payment.date || '').slice(0, 10),
      amount: payment.amount,
      paymentMethod: payment.paymentMethod,
      reference: payment.reference || '',
      invoiceId: payment.invoiceId || '',
      bankAccountId: payment.bankAccountId || '',
      checkNumber: payment.checkNumber || '',
      receivedBy: payment.receivedBy || '',
      receiverContact: payment.receiverContact || '',
      receiverIdType: payment.receiverIdType || '',
      receiverIdNumber: payment.receiverIdNumber || '',
      receivedDate: payment.receivedDate ? String(payment.receivedDate).slice(0, 10) : '',
      receiverSignature: payment.receiverSignature || '',
      attachments: payment.attachments || [],
      pdfUrl: payment.pdfUrl || '',
      pdfFileName: payment.pdfFileName || '',
    });
    setIsOpen(true);
  };

  // Export Suppliers to CSV
  const exportSuppliersCSV = useCallback(() => {
    const columns = [
      { key: 'code', label: 'Code' },
      { key: 'name', label: 'Supplier' },
      { key: 'contactPerson', label: 'Contact' },
      { key: 'email', label: 'Email' },
      { key: 'phone', label: 'Phone' },
      { key: 'address', label: 'Address' },
      { key: 'taxNumber', label: 'Tax ID' },
      { key: 'creditLimit', label: 'Credit Limit' },
      { key: 'outstandingBalance', label: 'Outstanding Balance' },
      { key: 'paymentTerms', label: 'Payment Terms (days)' },
      { key: 'isActive', label: 'Active' },
    ];
    const data = filteredSuppliers.map(s => ({
      ...s,
      outstandingBalance: supplierAging.find(a => a.id === s.id)?.outstandingBalance ?? 0,
      isActive: s.isActive !== false ? 'Yes' : 'No',
    }));
    downloadCSV(data, 'suppliers', columns);
  }, [filteredSuppliers, supplierAging]);

  // Print Suppliers Table as PDF
  const printSuppliers = useCallback(() => {
    const rows = filteredSuppliers.map(s => {
      const outstandingBalance = supplierAging.find(a => a.id === s.id)?.outstandingBalance ?? 0;
      const overLimit = outstandingBalance > (s.creditLimit || 0);
      return `<tr>
        <td>${s.code}</td>
        <td>${s.name}</td>
        <td>${s.contactPerson || '-'}</td>
        <td>${s.email || '-'}</td>
        <td>${s.phone || '-'}</td>
        <td class="amount">${formatAccountingCurrency(s.creditLimit || 0)}</td>
        <td class="amount">${formatAccountingCurrency(outstandingBalance)}</td>
        <td><span class="badge ${overLimit ? 'badge-danger' : outstandingBalance > 0 ? 'badge-warning' : 'badge-success'}">${overLimit ? 'Over Limit' : outstandingBalance > 0 ? 'Outstanding' : 'Current'}</span></td>
      </tr>`;
    }).join('');
    const totalCreditLimit = filteredSuppliers.reduce((s, sup) => s + (sup.creditLimit || 0), 0);
    const totalOutstanding = filteredSuppliers.reduce((s, sup) => s + (supplierAging.find(a => a.id === sup.id)?.outstandingBalance ?? 0), 0);
    const html = generatePdfHtml('Suppliers Report', `
      <div class="header">
        <h1>🏢 Suppliers Report</h1>
        <div class="subtitle">Generated on ${new Date().toLocaleString()}</div>
      </div>
      <div class="meta">
        <div class="meta-item"><div class="meta-label">Total Suppliers</div><div class="meta-value">${filteredSuppliers.length}</div></div>
        <div class="meta-item"><div class="meta-label">Total Credit Limit</div><div class="meta-value">${formatAccountingCurrency(totalCreditLimit)}</div></div>
        <div class="meta-item"><div class="meta-label">Total Outstanding</div><div class="meta-value">${formatAccountingCurrency(totalOutstanding)}</div></div>
      </div>
      <table>
        <thead><tr><th>Code</th><th>Supplier</th><th>Contact</th><th>Email</th><th>Phone</th><th>Credit Limit</th><th>Outstanding</th><th>Status</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    `, 'Accounts Payable • Suppliers');
    openPrintPreview(html);
  }, [filteredSuppliers, supplierAging]);

  // Export Bills to CSV
  const exportBillsCSV = useCallback(() => {
    const columns = [
      { key: 'invoiceNumber', label: 'Invoice #' },
      { key: 'supplierName', label: 'Supplier' },
      { key: 'date', label: 'Date' },
      { key: 'dueDate', label: 'Due Date' },
      { key: 'subtotal', label: 'Subtotal' },
      { key: 'taxAmount', label: 'Tax' },
      { key: 'total', label: 'Total' },
      { key: 'paidAmount', label: 'Paid' },
      { key: 'status', label: 'Status' },
    ];
    const data = filteredInvoices.map(inv => ({
      ...inv,
      supplierName: suppliers.find(s => s.id === inv.businessPartnerId)?.name || 'Unknown Supplier',
      date: new Date(inv.date).toLocaleDateString(),
      dueDate: new Date(inv.dueDate).toLocaleDateString(),
      paidAmount: (inv.paidAmount != null) ? inv.paidAmount : supplierPayments.filter(p => p.invoiceId === inv.id).reduce((s, p) => s + p.amount, 0),
    }));
    downloadCSV(data, 'bills', columns);
  }, [filteredInvoices, suppliers, supplierPayments]);

  // Print Bills Table as PDF
  const printBills = useCallback(() => {
    const rows = filteredInvoices.map(invoice => {
      const supplier = suppliers.find(s => s.id === invoice.businessPartnerId);
      const paidAmount = (invoice.paidAmount != null) ? invoice.paidAmount : supplierPayments.filter(p => p.invoiceId === invoice.id).reduce((sum, p) => sum + p.amount, 0);
      const balance = invoice.total - paidAmount;
      const status = balance <= 0 ? 'Paid' : new Date(invoice.dueDate) < new Date() ? 'Overdue' : 'Outstanding';
      return `<tr>
        <td>${invoice.invoiceNumber}</td>
        <td>${supplier?.name || 'Unknown Supplier'}</td>
        <td>${new Date(invoice.date).toLocaleDateString()}</td>
        <td class="amount">${formatAccountingCurrency(invoice.total)}</td>
        <td class="amount">${formatAccountingCurrency(paidAmount)}</td>
        <td class="amount">${formatAccountingCurrency(balance)}</td>
        <td><span class="badge ${status === 'Paid' ? 'badge-success' : status === 'Overdue' ? 'badge-danger' : 'badge-warning'}">${status}</span></td>
      </tr>`;
    }).join('');
    const totalAmount = filteredInvoices.reduce((s, i) => s + (i.total || 0), 0);
    const totalPaid = filteredInvoices.reduce((s, i) => {
      const paidAmount = (i.paidAmount != null) ? i.paidAmount : supplierPayments.filter(p => p.invoiceId === i.id).reduce((sum, p) => sum + p.amount, 0);
      return s + paidAmount;
    }, 0);
    const html = generatePdfHtml('Bills (Purchases) Report', `
      <div class="header">
        <h1>📄 Bills (Purchases) Report</h1>
        <div class="subtitle">Generated on ${new Date().toLocaleString()}</div>
      </div>
      <div class="meta">
        <div class="meta-item"><div class="meta-label">Total Bills</div><div class="meta-value">${filteredInvoices.length}</div></div>
        <div class="meta-item"><div class="meta-label">Total Amount</div><div class="meta-value">${formatAccountingCurrency(totalAmount)}</div></div>
        <div class="meta-item"><div class="meta-label">Total Paid</div><div class="meta-value">${formatAccountingCurrency(totalPaid)}</div></div>
        <div class="meta-item"><div class="meta-label">Outstanding</div><div class="meta-value">${formatAccountingCurrency(totalAmount - totalPaid)}</div></div>
      </div>
      <table>
        <thead><tr><th>Invoice #</th><th>Supplier</th><th>Date</th><th>Total</th><th>Paid</th><th>Balance</th><th>Status</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    `, 'Accounts Payable • Bills (Purchases)');
    openPrintPreview(html);
  }, [filteredInvoices, suppliers, supplierPayments]);

  // Export Payments to CSV
  const exportPaymentsCSV = useCallback(() => {
    const columns = [
      { key: 'paymentNumber', label: 'Payment #' },
      { key: 'date', label: 'Date' },
      { key: 'supplierName', label: 'Supplier' },
      { key: 'amount', label: 'Amount' },
      { key: 'paymentMethod', label: 'Method' },
      { key: 'status', label: 'Status' },
    ];
    const data = filteredPayments.map((p: any) => ({
      ...p,
      supplierName: suppliers.find(s => s.id === p.businessPartnerId)?.name || p.businessPartnerId,
      date: new Date(p.date).toLocaleDateString(),
    }));
    downloadCSV(data, 'supplier_payments', columns);
  }, [filteredPayments, suppliers]);

  // Print Payments Table as PDF
  const printPayments = useCallback(() => {
    const rows = filteredPayments.map((payment: any) => {
      const supplierName = suppliers.find(s => s.id === payment.businessPartnerId)?.name || payment.businessPartnerId;
      return `<tr>
        <td>${payment.paymentNumber}</td>
        <td>${new Date(payment.date).toLocaleDateString()}</td>
        <td>${supplierName}</td>
        <td class="amount">${formatAccountingCurrency(payment.amount)}</td>
        <td>${payment.paymentMethod}</td>
        <td><span class="badge ${payment.status === 'Posted' ? 'badge-success' : payment.status === 'Draft' ? 'badge-warning' : 'badge-danger'}">${payment.status}</span></td>
      </tr>`;
    }).join('');
    const totalAmount = filteredPayments.reduce((s: number, p: any) => s + (p.amount || 0), 0);
    const html = generatePdfHtml('Supplier Payments Report', `
      <div class="header">
        <h1>💸 Supplier Payments Report</h1>
        <div class="subtitle">Generated on ${new Date().toLocaleString()}</div>
      </div>
      <div class="meta">
        <div class="meta-item"><div class="meta-label">Total Payments</div><div class="meta-value">${filteredPayments.length}</div></div>
        <div class="meta-item"><div class="meta-label">Total Amount</div><div class="meta-value">${formatAccountingCurrency(totalAmount)}</div></div>
      </div>
      <table>
        <thead><tr><th>Payment #</th><th>Date</th><th>Supplier</th><th>Amount</th><th>Method</th><th>Status</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    `, 'Accounts Payable • Payments');
    openPrintPreview(html);
  }, [filteredPayments, suppliers]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="px-3 pt-2 pb-3 md:px-4 md:pt-3 md:pb-4">
      <div className="mb-2 flex justify-between items-center gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <h1 className="text-lg md:text-xl font-bold text-gray-800 truncate">Accounts Payable</h1>
          <HeadingInfo label="About money we owe suppliers">
            <p>What you still owe suppliers from purchase bills, plus payments you have already made.</p>
          </HeadingInfo>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button
            variant="flat"
            size="sm"
            onClick={() => { void handleRefresh(); }}
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
        className="mb-3"
        items={[
          { id: 'ap.totalPayables', label: 'Still to pay', value: formatAccountingCurrency(totalPayables), tone: 'text-red-700' },
          { id: 'ap.overdue', label: 'Overdue', value: formatAccountingCurrency(totalOverduePayables), tone: 'text-orange-700' },
          { id: 'ap.totalInvoices', label: 'Billed', value: formatAccountingCurrency(totalInvoices), tone: 'text-blue-700' },
          { id: 'ap.totalPayments', label: 'Paid out', value: formatAccountingCurrency(totalPayments), tone: 'text-green-700' },
        ]}
      />

      {/* Error Alert */}
      {error && (
        <Alert color="danger" className="mb-6">
          {error}
        </Alert>
      )}

      {/* Main Content Tabs */}
      <Card className="shadow-sm">
        <CardBody className="p-0">
          <Tabs
            selectedKey={selectedTab}
            onSelectionChange={(key) => setSelectedTab(key as string)}
            className="w-full"
            size="sm"
            variant="solid"
            classNames={deskBookTabsClassNames}
          >
            <Tab key="balances" title="Who we owe">
              <div className={deskBookTabPanelClassName}>
                <div className="flex flex-nowrap items-center gap-2 overflow-x-auto mb-2">
                  <h3 className="text-sm font-semibold text-gray-800 shrink-0 mr-auto">Supplier balances by age</h3>
                  <Button size="sm" color="primary" className="shrink-0" onClick={() => setSupplierFormOpen(true)}>
                      Add supplier
                    </Button>
                </div>

                <div className="flex flex-nowrap items-center gap-2 overflow-x-auto mb-3">
                  <Input aria-label="Search suppliers" placeholder="Search supplier" value={searchTerm} onValueChange={setSearchTerm} className="w-56 shrink-0" size="sm" />
                  <Input type="date" aria-label="From date" className="w-36 shrink-0" size="sm" value={dateFromFilter} onChange={(e) => setDateFromFilter(e.target.value)} />
                  <Input type="date" aria-label="To date" className="w-36 shrink-0" size="sm" value={dateToFilter} onChange={(e) => setDateToFilter(e.target.value)} />
                </div>

                <div ref={agingCols.frameRef} style={agingCols.frameStyle}>
                <Table aria-label="Supplier Aging" removeWrapper classNames={deskResizableTableClassNames()}>
                  <TableHeader>
                    {agingColumn('supplier', 'Supplier')}
                    {agingColumn('outstanding', 'Still owed', 'right')}
                    {agingColumn('current', 'Current', 'right')}
                    {agingColumn('overdue30', '1-30 days', 'right')}
                    {agingColumn('overdue60', '31-60 days', 'right')}
                    {agingColumn('overdue90', '61-90 days', 'right')}
                    {agingColumn('overdue90Plus', '90+ days', 'right')}
                    {agingColumn('lastActivity', 'Last activity')}
                  </TableHeader>
                  <TableBody emptyContent="No supplier data found.">
                    {agingPager.paged.map((supplier) => (
                      <TableRow key={supplier.id} className={rowClassNames(false)} onClick={() => openAgingSupplier(supplier)}>
                        <TableCell>
                          <div className="font-medium text-blue-600 hover:underline">{supplier.name}</div>
                          <div className="text-xs text-gray-500 font-mono">{supplier.code}</div>
                        </TableCell>
                        <TableCell className="tabular-nums text-right font-semibold text-red-600">
                          {formatAccountingCurrency(supplier.outstandingBalance)}
                        </TableCell>
                        <TableCell className="tabular-nums text-right text-green-600">
                          {formatAccountingCurrency(supplier.current)}
                        </TableCell>
                        <TableCell className="tabular-nums text-right text-yellow-600">
                          {formatAccountingCurrency(supplier.overdue30)}
                        </TableCell>
                        <TableCell className="tabular-nums text-right text-orange-600">
                          {formatAccountingCurrency(supplier.overdue60)}
                        </TableCell>
                        <TableCell className="tabular-nums text-right text-red-600">
                          {formatAccountingCurrency(supplier.overdue90)}
                        </TableCell>
                        <TableCell className="tabular-nums text-right text-red-800 font-bold">
                          {formatAccountingCurrency(supplier.overdue90Plus)}
                        </TableCell>
                        <TableCell>
                          <div className="text-xs">
                            <div>Invoice: {supplier.lastInvoiceDate || 'Never'}</div>
                            <div>Payment: {supplier.lastPaymentDate || 'Never'}</div>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
                <div className="mt-3 flex justify-end">
                  <Pagination page={agingPager.page} total={agingPager.pages} onChange={agingPager.setPage} showControls size="sm" />
                </div>
              </div>
            </Tab>

            <Tab key="suppliers" title={dateFromFilter || dateToFilter ? `Suppliers (${suppliers.length})` : 'Suppliers'}>
              <div className={deskBookTabPanelClassName}>
                <div className="flex flex-nowrap items-center gap-2 overflow-x-auto mb-2">
                  <h3 className="text-sm font-semibold text-gray-800 shrink-0 mr-auto">Supplier list</h3>
                    <Dropdown>
                      <DropdownTrigger>
                        <Button variant="flat" size="sm" className="shrink-0">📥 Export</Button>
                      </DropdownTrigger>
                      <DropdownMenu>
                        <DropdownItem key="csv" onPress={exportSuppliersCSV}>CSV spreadsheet</DropdownItem>
                        <DropdownItem key="pdf" onPress={printSuppliers}>📑 Print PDF</DropdownItem>
                      </DropdownMenu>
                    </Dropdown>
                    <Button color="primary" size="sm" className="shrink-0" onClick={() => setSupplierFormOpen(true)}>
                      Add supplier
                    </Button>
                </div>

                <div className="flex flex-nowrap items-center gap-2 overflow-x-auto mb-3">
                  <Input aria-label="Search suppliers" placeholder="Search name, code, phone" value={searchTerm} onValueChange={setSearchTerm} className="w-56 shrink-0" size="sm" />
                </div>

                <div ref={supplierCols.frameRef} style={supplierCols.frameStyle}>
                <Table aria-label="Supplier Accounts" removeWrapper classNames={deskResizableTableClassNames()}>
                  <TableHeader>
                    {supplierColumn('supplier', 'Supplier')}
                    {supplierColumn('contact', 'Contact Info')}
                    {supplierColumn('address', 'Address')}
                    {supplierColumn('creditLimit', 'Credit Limit', 'right')}
                    {supplierColumn('balance', 'Current Balance', 'right')}
                    {supplierColumn('paymentTerms', 'Payment Terms')}
                    {supplierColumn('lastActivity', 'Last Activity')}
                    {supplierColumn('status', 'Status')}
                  </TableHeader>
                  <TableBody emptyContent="No suppliers found.">
                    {suppliersPager.paged.map((supplier) => {
                      const supplierInvoices = purchaseInvoices.filter(inv => inv.businessPartnerId === supplier.id);
                      const supplierPaymentsFiltered = supplierPayments.filter(pay => pay.businessPartnerId === supplier.id);
                      const lastInvoiceDate = supplierInvoices.length > 0 ?
                        new Date(Math.max(...supplierInvoices.map(inv => new Date(inv.date).getTime()))).toISOString().slice(0,10) : null;
                      const lastPaymentDate = supplierPaymentsFiltered.length > 0 ?
                        new Date(Math.max(...supplierPaymentsFiltered.map(pay => new Date(pay.date).getTime()))).toISOString().slice(0,10) : null;
                      const outstandingBalance = supplierAging.find(a => a.id === supplier.id)?.outstandingBalance ?? 0;

                      return (
                        <TableRow key={supplier.id} className={rowClassNames(viewItem?.id === supplier.id && viewKind === 'supplier')} onClick={() => openSupplierView(supplier)}>
                          <TableCell>
                            <div className="font-medium text-blue-600 hover:underline">{supplier.name}</div>
                            <div className="text-xs text-gray-500 font-mono">{supplier.code}</div>
                            <div className="text-xs text-gray-500">{supplier.taxNumber || 'No Tax ID'}</div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {supplier.contactPerson && <div className="font-medium">{supplier.contactPerson}</div>}
                              {supplier.email && <div className="text-blue-600">{supplier.email}</div>}
                              {supplier.phone && <div className="text-gray-600">{supplier.phone}</div>}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {supplier.address && <div>{supplier.address}</div>}
                              {supplier.countryCode && <div>{supplier.countryCode}</div>}
                            </div>
                          </TableCell>
                          <TableCell className="tabular-nums text-right">
                            <div className="font-medium">{formatAccountingCurrency((supplier.creditLimit || 0))}</div>
                          </TableCell>
                          <TableCell className="tabular-nums text-right">
                            <div className={`font-semibold ${outstandingBalance >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                              {formatAccountingCurrency(Math.abs(outstandingBalance))}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {supplier.paymentTerms ? `${supplier.paymentTerms} days` : 'N/A'}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-xs">
                              <div>Invoice: {lastInvoiceDate || 'Never'}</div>
                              <div>Payment: {lastPaymentDate || 'Never'}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Chip
                              color={
                                outstandingBalance > (supplier.creditLimit || 0) ? 'danger' :
                                outstandingBalance > 0 ? 'warning' :
                                'success'
                              }
                              variant="flat"
                              size="sm"
                            >
                              {outstandingBalance > (supplier.creditLimit || 0) ? 'Over Limit' :
                               outstandingBalance > 0 ? 'Still owed' :
                               'Current'}
                            </Chip>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                </div>
                <div className="mt-3 flex justify-end">
                  <Pagination page={suppliersPager.page} total={suppliersPager.pages} onChange={suppliersPager.setPage} showControls size="sm" />
                </div>
              </div>
            </Tab>

            <Tab key="invoices" title={dateFromFilter || dateToFilter ? `Bills (${filteredInvoices.length})` : 'Bills'}>
              <div className={deskBookTabPanelClassName}>
                <div className="flex flex-nowrap items-center gap-2 overflow-x-auto mb-2">
                  <h3 className="text-sm font-semibold text-gray-800 shrink-0 mr-auto">Purchase bills</h3>
                    <Dropdown>
                      <DropdownTrigger>
                        <Button variant="flat" size="sm" className="shrink-0">📥 Export</Button>
                      </DropdownTrigger>
                      <DropdownMenu>
                        <DropdownItem key="csv" onPress={exportBillsCSV}>CSV spreadsheet</DropdownItem>
                        <DropdownItem key="pdf" onPress={printBills}>📑 Print PDF</DropdownItem>
                      </DropdownMenu>
                    </Dropdown>
                    <Button color="primary" size="sm" className="shrink-0" onClick={() => openNewInvoiceFor(suppliers[0]?.id || '')}>
                    New bill
                    </Button>
                </div>

                <div className="flex flex-nowrap items-center gap-2 overflow-x-auto mb-3">
                  <Input
                    aria-label="Search bills"
                    placeholder="Search bill or supplier"
                    className="w-52 shrink-0"
                    size="sm"
                    value={searchTerm}
                    onValueChange={setSearchTerm}
                  />
                  <Select
                    aria-label="Status"
                    className="w-36 shrink-0"
                    size="sm"
                    selectedKeys={[statusFilter]}
                    disallowEmptySelection
                    onSelectionChange={(keys) => setStatusFilter(Array.from(keys)[0] as string)}
                  >
                    <SelectItem key="all">All statuses</SelectItem>
                    <SelectItem key="outstanding">Still owed</SelectItem>
                    <SelectItem key="overdue">Overdue</SelectItem>
                    <SelectItem key="paid">Paid</SelectItem>
                  </Select>
                  <Select
                    aria-label="Supplier"
                    className="w-44 shrink-0"
                    size="sm"
                    selectedKeys={[supplierFilter]}
                    disallowEmptySelection
                    onSelectionChange={(keys) => setSupplierFilter(Array.from(keys)[0] as string)}
                  >
                    <SelectItem key="all">All suppliers</SelectItem>
                    <>
                      {suppliers.map(supplier => (
                        <SelectItem key={supplier.id}>{supplier.name}</SelectItem>
                      ))}
                    </>
                  </Select>
                  <Input
                    type="date"
                    aria-label="From date"
                    className="w-36 shrink-0"
                    size="sm"
                    value={dateFromFilter}
                    onChange={(e) => setDateFromFilter(e.target.value)}
                  />
                  <Input
                    type="date"
                    aria-label="To date"
                    className="w-36 shrink-0"
                    size="sm"
                    value={dateToFilter}
                    onChange={(e) => setDateToFilter(e.target.value)}
                  />
                </div>

              <div ref={billCols.frameRef} style={billCols.frameStyle}>
              <Table aria-label="Bills" removeWrapper classNames={deskResizableTableClassNames()}>
                  <TableHeader>
                    {billColumn('invoice', 'Invoice #')}
                    {billColumn('supplier', 'Supplier')}
                    {billColumn('date', 'Date')}
                    {billColumn('dueDate', 'Due Date')}
                    {billColumn('subtotal', 'Subtotal', 'right')}
                    {billColumn('tax', 'Tax', 'right')}
                    {billColumn('total', 'Total', 'right')}
                    {billColumn('paid', 'Paid', 'right')}
                    {billColumn('balance', 'Balance', 'right')}
                    {billColumn('status', 'Status')}
                    {billColumn('aging', 'Aging')}
                    {billColumn('approval', 'Approval')}
                  </TableHeader>
                  <TableBody emptyContent="No purchase invoices found.">
                    {invoicesPager.paged.map((invoice) => {
                      const supplier = suppliers.find(s => s.id === invoice.businessPartnerId);
                      // Use per-invoice paidAmount from store; fall back to invoice-linked payments
                      const paidAmount = (invoice.paidAmount != null)
                        ? invoice.paidAmount
                        : supplierPayments.filter(p => p.invoiceId === invoice.id).reduce((sum, p) => sum + p.amount, 0);
                      const balance = invoice.total - paidAmount;
                      const dueRaw = invoice.dueDate || invoice.date;
                      const dueDate = new Date(dueRaw);
                      const dueValid = !Number.isNaN(dueDate.getTime());
                      const today = new Date();
                      const daysOverdue = dueValid
                        ? Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
                        : 0;
                      
                      return (
                        <TableRow
                          key={invoice.id}
                          className={rowClassNames(viewItem?.id === invoice.id && viewKind === 'invoice')}
                          onClick={() => openBillView(invoice)}
                        >
                          <TableCell>
                            <div className="font-mono font-medium text-blue-600 hover:underline">{invoice.invoiceNumber}</div>
                            <div className="text-xs text-gray-500">{invoice.poNumber || 'No PO'}</div>
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">{supplier?.name || 'Unknown Supplier'}</div>
                            <div className="text-xs text-gray-500">{supplier?.code || invoice.businessPartnerId}</div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">{new Date(invoice.date).toLocaleDateString()}</div>
                            <div className="text-xs text-gray-500">{new Date(invoice.date).toLocaleDateString('en-US', { weekday: 'short' })}</div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">{dueValid ? dueDate.toLocaleDateString() : '—'}</div>
                            <div className="text-xs text-gray-500">{dueValid ? dueDate.toLocaleDateString('en-US', { weekday: 'short' }) : ''}</div>
                          </TableCell>
                          <TableCell className="tabular-nums text-right">
                            <div className="font-medium">{formatAccountingCurrency(invoice.subtotal)}</div>
                          </TableCell>
                          <TableCell className="tabular-nums text-right">
                            <div className="text-sm">{formatAccountingCurrency(invoice.taxAmount)}</div>
                          </TableCell>
                          <TableCell className="tabular-nums text-right">
                            <div className="font-semibold text-red-600">{formatAccountingCurrency(invoice.total)}</div>
                          </TableCell>
                          <TableCell className="tabular-nums text-right">
                            <div className="text-green-600">{formatAccountingCurrency(paidAmount)}</div>
                          </TableCell>
                          <TableCell className="tabular-nums text-right">
                            <div className={`font-semibold ${balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                              {formatAccountingCurrency(balance)}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Chip 
                              color={
                                balance <= 0 ? 'success' : 
                                daysOverdue > 30 ? 'danger' : 
                                daysOverdue > 0 ? 'warning' : 
                                'primary'
                              } 
                              variant="flat" 
                              size="sm"
                            >
                              {balance <= 0 ? 'Paid' : 
                               daysOverdue > 0 ? 'Overdue' : 
                               'Still owed'}
                            </Chip>
                          </TableCell>
                          <TableCell>
                            {balance <= 0 ? (
                              <div className="text-xs text-green-600">Settled</div>
                            ) : !dueValid ? (
                              <div className="text-xs text-gray-400">—</div>
                            ) : daysOverdue > 0 ? (
                              <div className="text-xs text-red-600 font-medium">
                                {daysOverdue} days overdue
                              </div>
                            ) : daysOverdue === 0 ? (
                              <div className="text-xs text-yellow-600 font-medium">
                                Due today
                              </div>
                            ) : (
                              <div className="text-xs text-green-600">
                                {Math.abs(daysOverdue)} days left
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <Chip 
                              color={
                                invoice.status === 'Paid' ? 'success' : 
                                invoice.status === 'Posted' ? 'primary' : 
                                invoice.status === 'Void' ? 'danger' : 
                                'default'
                              } 
                              variant="flat" 
                              size="sm"
                            >
                              {invoice.status}
                            </Chip>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
                <div className="mt-3 flex justify-end">
                  <Pagination page={invoicesPager.page} total={invoicesPager.pages} onChange={invoicesPager.setPage} showControls size="sm" />
                </div>
              </div>
            </Tab>

            <Tab key="payments" title={dateFromFilter || dateToFilter ? `Payments (${filteredPayments.length})` : 'Payments'}>
              <div className={deskBookTabPanelClassName}>
                <div className="flex flex-nowrap items-center gap-2 overflow-x-auto mb-2">
                  <h3 className="text-sm font-semibold text-gray-800 shrink-0 mr-auto">Payments to suppliers</h3>
                    <Dropdown>
                      <DropdownTrigger>
                        <Button variant="flat" size="sm" className="shrink-0">📥 Export</Button>
                      </DropdownTrigger>
                      <DropdownMenu>
                        <DropdownItem key="csv" onPress={exportPaymentsCSV}>CSV spreadsheet</DropdownItem>
                        <DropdownItem key="pdf" onPress={printPayments}>📑 Print PDF</DropdownItem>
                      </DropdownMenu>
                    </Dropdown>
                    <Button color="primary" size="sm" className="shrink-0" onClick={() => { setDialogType('payment'); setEditing(null); setShowAdvancedInvoice(false); setForm({ businessPartnerId: suppliers[0]?.id || '', supplierName: suppliers[0]?.name || '', date: new Date().toISOString().slice(0,10), amount: 0, paymentMethod: 'Bank', reference: '' }); setIsOpen(true); }}>
                      Record payment
                    </Button>
                </div>

                <div className="flex flex-nowrap items-center gap-2 overflow-x-auto mb-3">
                  <Input aria-label="Search payments" placeholder="Search payment or supplier" value={searchTerm} onValueChange={setSearchTerm} className="w-56 shrink-0" size="sm" />
                  <Input type="date" aria-label="From date" className="w-36 shrink-0" size="sm" value={dateFromFilter} onChange={(e) => setDateFromFilter(e.target.value)} />
                  <Input type="date" aria-label="To date" className="w-36 shrink-0" size="sm" value={dateToFilter} onChange={(e) => setDateToFilter(e.target.value)} />
                </div>

                <div ref={paymentCols.frameRef} style={paymentCols.frameStyle}>
                <Table aria-label="Supplier Payments" removeWrapper classNames={deskResizableTableClassNames()}>
                  <TableHeader>
                    {paymentColumn('payment', 'Payment #')}
                    {paymentColumn('date', 'Date')}
                    {paymentColumn('supplier', 'Supplier')}
                    {paymentColumn('amount', 'Amount', 'right')}
                    {paymentColumn('method', 'Method')}
                    {paymentColumn('status', 'Status')}
                  </TableHeader>
                  <TableBody emptyContent="No payments found.">
                    {paymentsPager.paged.map((payment) => {
                      const supplierName = suppliers.find((s) => s.id === payment.businessPartnerId)?.name || payment.businessPartnerId;
                      const canApprove = payment.status === 'Pending Approval' && canApprovePayments;
                      return (
                      <TableRow key={payment.id} className={rowClassNames(viewItem?.id === payment.id && viewKind === 'payment')} onClick={() => openPaymentView(payment)}>
                        <TableCell>
                          <span className="font-mono font-medium text-blue-600 hover:underline">{payment.paymentNumber}</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">
                            {new Date(payment.date).toLocaleDateString()}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">{supplierName}</span>
                        </TableCell>
                        <TableCell className="tabular-nums text-right">
                          <div className="font-medium">
                            {formatAccountingCurrency(payment.amount)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Chip variant="flat" size="sm">
                            {payment.paymentMethod}
                          </Chip>
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          {canApprove ? (
                            <Chip
                              color="warning"
                              variant="flat"
                              size="sm"
                              className="cursor-pointer"
                              onClick={() => { try { postPayment(payment.id); } catch {} }}
                            >
                              Pending · Approve
                            </Chip>
                          ) : (
                            <Chip
                              color={
                                payment.status === 'Posted' ? 'success' :
                                payment.status === 'Draft' ? 'default' :
                                payment.status === 'Pending Approval' ? 'warning' :
                                'danger'
                              }
                              variant="flat"
                              size="sm"
                            >
                              {payment.status}
                            </Chip>
                          )}
                        </TableCell>
                      </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                </div>
                <div className="mt-3 flex justify-end">
                  <Pagination page={paymentsPager.page} total={paymentsPager.pages} onChange={paymentsPager.setPage} showControls size="sm" />
                </div>
              </div>
            </Tab>

          </Tabs>
        </CardBody>
      </Card>

      {/* Create/Edit Dialog */}
      <Modal
        isOpen={isOpen}
        onOpenChange={(open) => {
          setIsOpen(open);
          if (!open) {
            setShowAdvancedInvoice(false);
            setShowTaxDetail(false);
            setErrors({});
          }
        }}
        size={dialogType === 'invoice' ? '5xl' : dialogType === 'payment' ? '3xl' : '2xl'}
        scrollBehavior="inside"
        classNames={
          dialogType === 'invoice'
            ? { base: 'max-w-[980px]' }
            : dialogType === 'payment'
              ? { base: 'max-w-[720px]' }
              : undefined
        }
      >
        <ModalContent>
          {(onClose) => {
          const dialogTitle = dialogType === 'supplier' ? (editing ? 'Edit Supplier' : 'Add Supplier') : dialogType === 'invoice' ? (editing ? 'Edit Purchase Invoice' : 'Add Purchase Invoice') : (editing ? 'Edit Payment' : 'Record Payment');
          const selectedSupplier = suppliers.find((s) => s.id === (form.businessPartnerId || suppliers[0]?.id));
          const selectedPaymentInvoice = form.invoiceId
            ? purchaseInvoices.find((i) => i.id === form.invoiceId)
            : undefined;
          const paymentInvoicePaid = selectedPaymentInvoice
            ? payments.filter((p) => p.invoiceId === selectedPaymentInvoice.id).reduce((s, p) => s + p.amount, 0)
            : 0;
          const paymentInvoiceOutstanding = selectedPaymentInvoice
            ? Math.max(0, (selectedPaymentInvoice.total || 0) - paymentInvoicePaid)
            : 0;
          const paymentCash = Number(form.amount || 0);
          const paymentWht = form.applyWht ? Number(form.whtAmount || 0) : 0;
          const paymentWhtVat = form.applyWht ? Number(form.whtVatAmount || 0) : 0;
          const paymentSettlement = +(paymentCash + paymentWht + paymentWhtVat).toFixed(2);
          const paymentNewBalance = selectedPaymentInvoice
            ? Math.max(0, paymentInvoiceOutstanding - paymentSettlement)
            : null;
          const invoiceNetPayable = +(
            Number(form.subtotal || 0)
            + Number(form.taxAmount || 0)
            + Number(form.shippingCharges || 0)
            + Number(form.otherCharges || 0)
            - Number(form.discountAmount || 0)
            - Number(form.taxBreakdown?.withholding || 0)
            - Number(form.taxBreakdown?.withholdingVat || 0)
            - Number(form.paidAmount || 0)
          ).toFixed(2);
          const handleSave = () => {
          if (!validate()) return;
          if (dialogType === 'supplier') {
            // Convert payment terms string to number if needed
            let paymentTermsDays = 30;
            if (typeof form.paymentTerms === 'string') {
              const paymentTermsMap: Record<string, number> = {
                'immediate': 0,
                'net30': 30,
                'net60': 60,
                'net90': 90
              };
              paymentTermsDays = paymentTermsMap[form.paymentTerms] !== undefined ? paymentTermsMap[form.paymentTerms] : 30;
            } else if (typeof form.paymentTerms === 'number') {
              paymentTermsDays = form.paymentTerms;
            }

            const payload: import('@/app/lib/accounting/models').BusinessPartner = {
              id: editing?.id || `BP-${Date.now()}`,
              code: form.code || generateNextSupplierCode(),
              name: form.name || '',
              type: 'Supplier' as const,
              taxNumber: form.taxNumber || form.taxId || '',
              address: form.address || '',
              phone: form.phone || '',
              email: form.email || '',
              contactPerson: form.contactPerson || '',
              creditLimit: Number(form.creditLimit || 0),
              paymentTerms: paymentTermsDays,
              glAccountCode: GL_ACCOUNTS.ACCOUNTS_PAYABLE,
              currency: form.currency || 'GHS',
              balance: Number(form.currentBalance || editing?.balance || 0),
              isActive: form.isActive !== undefined ? form.isActive !== false : true,
              countryCode: form.country === 'Ghana' ? 'GH' : (form.country || 'GH'),
              createdAt: editing?.createdAt || new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              // Preserve bank details if they exist
              bankName: form.bankName,
              bankAccountNumber: form.bankAccountNumber,
              bankSwift: form.bankSwift,
              bankIban: form.bankIban
            };
            if (editing) updateBusinessPartner(editing.id, payload); else addBusinessPartner(payload);
          } else if (dialogType === 'invoice') {
            const supplierId = resolveOrCreateSupplierId(form);
            if (!supplierId) { setErrors({ businessPartnerId: 'Supplier is required' }); return; }
            // duplicate invoice check
            const dup = purchaseInvoices.some((inv)=> inv.invoiceNumber === (form.invoiceNumber||'') && inv.businessPartnerId === supplierId && (!editing || inv.id !== editing.id));
            if (dup) { setErrors({ invoiceNumber: 'Duplicate invoice for this supplier' }); return; }
            const invId = editing?.id || `INV-${Date.now()}`;
            const lines = (form.lines || []).map((ln: any, idx: number) => {
              const quantity = ln.lineKind === 'service' ? 1 : Number(ln.quantity || 0);
              const unitPrice = Number(ln.unitPrice || 0);
              const amount = +(quantity * unitPrice).toFixed(2);
              const taxAmount = +((amount * Number(ln.taxPercent || 0)) / 100).toFixed(2);
              return {
                id: ln.id || `INL-${Date.now()}-${idx}`,
                invoiceId: invId,
                lineKind: ln.lineKind || (ln.itemId ? 'item' : 'service'),
                itemId: ln.itemId || undefined,
                itemCode: ln.itemCode || undefined,
                description: ln.description || '',
                quantity,
                unitPrice,
                amount,
                taxAmount,
                uom: ln.uom || 'Each',
                costCenter: ln.costCenter || undefined,
                glAccountCode: ln.glAccountCode || defaultExpenseCode(ln.lineKind === 'service' ? 'service' : 'item'),
              };
            });
            const subtotalFromLines = lines.reduce((s: number, l: any) => s + l.amount, 0);
            const taxFromLines = lines.reduce((s: number, l: any) => s + l.taxAmount, 0);
            const payload = {
              id: invId,
              invoiceNumber: form.invoiceNumber || `PINV-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`,
              type: 'Purchase' as const,
              date: (form.date ? new Date(form.date) : new Date()).toISOString(),
              dueDate: (form.dueDate ? new Date(form.dueDate) : new Date()).toISOString(),
              businessPartnerId: supplierId,
              description:
                form.description
                || (form.lines || []).map((l: any) => l.description).find((d: string) => d?.trim())
                || 'Purchase invoice',
              subtotal: +(Number(form.subtotal ?? subtotalFromLines)).toFixed(2),
              taxAmount: +(Number(form.taxAmount ?? taxFromLines)).toFixed(2),
              total: +((Number(form.subtotal ?? subtotalFromLines)) + (Number(form.taxAmount ?? taxFromLines))).toFixed(2),
              currency: 'GHS',
              status: editing?.status || 'Posted',
              paidAmount: editing?.paidAmount || 0,
              createdAt: editing?.createdAt || new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              poNumber: form.poNumber || '',
              receiptNumber: form.receiptNumber || '',
              attachments: form.attachments || [],
              discountAmount: Number(form.discountAmount || 0),
              shippingCharges: Number(form.shippingCharges || 0),
              otherCharges: Number(form.otherCharges || 0),
              amountDue: +(((Number(form.subtotal ?? subtotalFromLines)) + (Number(form.taxAmount ?? taxFromLines)) + Number(form.shippingCharges || 0) + Number(form.otherCharges || 0) - Number(form.discountAmount || 0) - Number(form.taxBreakdown?.withholding || 0) - Number(form.taxBreakdown?.withholdingVat || 0)) - Number(form.paidAmount || 0)).toFixed(2),
              workflowStatus: form.workflowStatus || 'Posted',
              taxType: form.taxType || 'STANDARD',
              taxBreakdown: form.taxBreakdown || undefined,
              claimInputTax: form.taxType === 'NONE' ? false : form.claimInputTax !== false,
              sourceModule: editing?.sourceModule || 'manual',
              preparedBy: String(form.preparedBy || '').trim() || signedInPersonName() || undefined,
              checkedBy: form.checkedBy || undefined,
              approvedBy: form.approvedBy || undefined,
              authorizedBy: form.authorizedBy || undefined,
              paymentApprovedBy: form.paymentApprovedBy || undefined,
              department: form.department || editing?.department || undefined,
              lines
            } as any;
            if (editing) updateInvoice(editing.id, payload); else addInvoice(payload);
          } else if (dialogType === 'payment' && !editing && form.applyWht && form.invoiceId && (Number(form.whtAmount || 0) > 0 || Number(form.whtVatAmount || 0) > 0)) {
            const supplierId = resolveOrCreateSupplierId(form);
            if (!supplierId) { setErrors({ businessPartnerId: 'Supplier is required' }); return; }
            const result = recordSupplierWHTPayment({
              invoiceId: form.invoiceId,
              cashAmount: Number(form.amount || 0),
              whtAmount: Number(form.whtAmount || 0),
              whtVatAmount: Number(form.whtVatAmount || 0),
              paymentMethod: form.paymentMethod || 'Bank',
              bankAccountId: form.bankAccountId || undefined,
              reference: form.reference || undefined,
            });
            if (!result) {
              setErrors({ amount: 'Could not record payment — check the amount against the outstanding balance.' });
              return;
            }
          } else if (dialogType === 'payment') {
            const supplierId = resolveOrCreateSupplierId(form);
            if (!supplierId) { setErrors({ businessPartnerId: 'Supplier is required' }); return; }
            const payload = {
              id: editing?.id || `PAY-${Date.now()}`,
              paymentNumber: editing?.paymentNumber || `AP-PAY-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`,
              date: (form.date ? new Date(form.date) : new Date()).toISOString(),
              type: 'Payment' as const,
              businessPartnerId: supplierId,
              invoiceId: form.invoiceId || undefined,
              description: form.reference || 'Supplier payment',
              amount: Number(form.amount || 0),
              currency: 'GHS',
              paymentMethod: form.paymentMethod || 'Bank',
              bankAccountId: form.bankAccountId || undefined,
              checkNumber: form.checkNumber || undefined,
              status: 'Draft' as const,
              // receipt/pdf
              receivedBy: form.receivedBy,
              receiverContact: form.receiverContact,
              receiverIdType: form.receiverIdType,
              receiverIdNumber: form.receiverIdNumber,
              receivedDate: form.receivedDate,
              receiverSignature: form.receiverSignature,
              attachments: form.attachments,
              pdfUrl: form.pdfUrl,
              pdfFileName: form.pdfFileName,
              createdAt: editing?.createdAt || new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              sourceModule: editing?.sourceModule || 'manual',
            };
            if (editing) {
              updatePayment(editing.id, {
                ...payload,
                id: editing.id,
                paymentNumber: editing.paymentNumber || payload.paymentNumber,
                status: editing.status || payload.status,
                createdAt: editing.createdAt || payload.createdAt,
              } as any);
            } else {
              addPayment(payload as any);
              if (postOnSave) {
                try { postPayment(payload.id); } catch {}
              }
            }
          }
          setIsOpen(false);
          setEditing(null);
          setForm({});
          };
          return (
            <>
              {dialogType === 'invoice' ? (
                <ModalHeader className="border-b bg-white px-4 py-2.5 pe-12">
                  <div className="flex justify-between items-start w-full gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-gray-900">
                          {editing ? 'PURCHASE BILL' : 'NEW PURCHASE BILL'}
                        </h3>
                        <Chip size="sm" variant="flat" color={editing ? 'primary' : 'default'}>
                          {editing ? 'EDITING' : 'DRAFT'}
                        </Chip>
                      </div>
                      <p className="text-sm text-gray-600 mt-0.5">
                        {selectedSupplier?.name || form.supplierName || 'Select a supplier'}
                        {selectedSupplier?.paymentTerms != null ? (
                          <span className="text-gray-400"> · Net {selectedSupplier.paymentTerms} days</span>
                        ) : !selectedSupplier && form.supplierName?.trim() ? (
                          <span className="text-amber-600"> · new</span>
                        ) : null}
                      </p>
                    </div>
                    <div className="text-right text-xs text-gray-600 leading-snug">
                      <div className="text-[11px] uppercase tracking-wide text-gray-400">Invoice #</div>
                      <div className="font-mono text-sm text-gray-800">{form.invoiceNumber || 'Auto on save'}</div>
                      <div className="tabular-nums font-semibold text-gray-900 mt-1">
                        {formatAccountingCurrency(invoiceNetPayable)} due
                      </div>
                    </div>
                  </div>
                </ModalHeader>
              ) : dialogType === 'payment' ? (
                <ModalHeader className="border-b bg-white px-4 py-2.5 pe-12">
                  <div className="flex justify-between items-start w-full gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-gray-900">
                          {editing ? 'EDIT PAYMENT' : 'RECORD PAYMENT'}
                        </h3>
                        <Chip size="sm" variant="flat" color={postOnSave ? 'success' : 'default'}>
                          {postOnSave ? 'POST ON SAVE' : 'DRAFT'}
                        </Chip>
                      </div>
                      <p className="text-sm text-gray-600 mt-0.5">
                        {selectedSupplier?.name || form.supplierName || 'Select a supplier'}
                        {selectedPaymentInvoice ? (
                          <span className="text-gray-400"> · {selectedPaymentInvoice.invoiceNumber}</span>
                        ) : !selectedSupplier && form.supplierName?.trim() ? (
                          <span className="text-amber-600"> · new</span>
                        ) : null}
                      </p>
                    </div>
                    <div className="text-right text-xs text-gray-600 leading-snug">
                      <div className="text-[11px] uppercase tracking-wide text-gray-400">Paying</div>
                      <div className="tabular-nums font-semibold text-gray-900 text-sm">
                        {formatAccountingCurrency(paymentCash)}
                      </div>
                      {(paymentWht > 0 || paymentWhtVat > 0) && (
                        <div className="text-[11px] text-amber-700 mt-0.5">
                          + {formatAccountingCurrency(paymentWht + paymentWhtVat)} withheld
                        </div>
                      )}
                    </div>
                  </div>
                </ModalHeader>
              ) : (
                <ModalHeader>{dialogTitle}</ModalHeader>
              )}
              <ModalBody className={dialogType === 'invoice' || dialogType === 'payment' ? 'px-4 py-3 bg-white' : undefined}>
        {dialogType === 'supplier' && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Supplier Code"
              value={form.code || ''}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              placeholder="Auto-generated"
              isDisabled={!editing}
              description={editing ? "Code can be edited" : "Code is auto-generated"}
              isRequired
            />
            <div>
              <Input
                label="Supplier Name"
                value={form.name || ''}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Enter supplier name"
                isRequired
              />
              {errors.name && <div className="text-red-600 text-xs mt-1">{errors.name}</div>}
            </div>
            <Input
              label="Contact Person"
              value={form.contactPerson || ''}
              onChange={(e) => setForm({ ...form, contactPerson: e.target.value })}
              placeholder="Contact person name"
            />
            <div>
              <Input
                label="Email"
                type="email"
                value={form.email || ''}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="supplier@email.com"
              />
              {errors.email && <div className="text-red-600 text-xs mt-1">{errors.email}</div>}
            </div>
            <div>
              <Input
                label="Phone"
                value={form.phone || ''}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+233 XX XXX XXXX"
              />
              {errors.phone && <div className="text-red-600 text-xs mt-1">{errors.phone}</div>}
            </div>
            <Input
              label="Tax ID"
              value={form.taxNumber || ''}
              onChange={(e) => setForm({ ...form, taxNumber: e.target.value })}
              placeholder="e.g., GH123456789"
            />
            <Textarea
              label="Address"
              value={form.address || ''}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder="Street address"
              className="col-span-2"
            />
            <Input
              label="Country"
              value={form.country || 'Ghana'}
              onChange={(e) => setForm({ ...form, country: e.target.value })}
              placeholder="Country"
            />
            <Select
              label="Payment Terms"
              selectedKeys={form.paymentTerms !== undefined && form.paymentTerms !== null ? [form.paymentTerms.toString()] : []}
              onSelectionChange={(keys) => {
                const selected = Array.from(keys)[0] as string;
                // Convert string back to number for BusinessPartner
                const paymentTermsMap: Record<string, number> = {
                  'immediate': 0,
                  'net30': 30,
                  'net60': 60,
                  'net90': 90
                };
                // If it's already a number string, use it directly
                const value = paymentTermsMap[selected] !== undefined ? paymentTermsMap[selected] : (selected === '0' || selected === '30' || selected === '60' || selected === '90' ? parseInt(selected) : 30);
                setForm({ ...form, paymentTerms: value });
              }}
              value={form.paymentTerms?.toString() || '30'}
            >
              <SelectItem key="immediate">Immediate</SelectItem>
              <SelectItem key="net30">Net 30</SelectItem>
              <SelectItem key="net60">Net 60</SelectItem>
              <SelectItem key="net90">Net 90</SelectItem>
            </Select>
            <div>
              <Input
                label="Credit Limit (₵)"
                type="number"
                value={form.creditLimit?.toString() || '0'}
                onChange={(e) => setForm({ ...form, creditLimit: parseFloat(e.target.value) || 0 })}
                isRequired
              />
              {errors.creditLimit && <div className="text-red-600 text-xs mt-1">{errors.creditLimit}</div>}
            </div>
            <Input
              label="Current Balance (₵)"
              type="number"
              value={form.currentBalance?.toString() || (editing?.balance?.toString() || '0')}
              onChange={(e) => setForm({ ...form, currentBalance: parseFloat(e.target.value) || 0 })}
            />
            <div className="col-span-2">
              <Chip
                color={form.isActive !== false ? 'success' : 'default'}
                onClick={() => setForm({ ...form, isActive: !(form.isActive !== false) })}
                className="cursor-pointer"
              >
                {form.isActive !== false ? '✓ Active' : 'Inactive'}
              </Chip>
            </div>
            <Input
              label="Bank Name"
              value={form.bankName || ''}
              onChange={(e) => setForm({ ...form, bankName: e.target.value })}
              placeholder="Bank name"
            />
            <Input
              label="Bank Account #"
              value={form.bankAccountNumber || ''}
              onChange={(e) => setForm({ ...form, bankAccountNumber: e.target.value })}
              placeholder="Account number"
            />
            <Input
              label="SWIFT/BIC"
              value={form.bankSwift || ''}
              onChange={(e) => setForm({ ...form, bankSwift: e.target.value })}
              placeholder="SWIFT code"
            />
            <Input
              label="IBAN"
              value={form.bankIban || ''}
              onChange={(e) => setForm({ ...form, bankIban: e.target.value })}
              placeholder="IBAN"
            />

            {Array.isArray(form.taxComponents) && form.taxComponents.length > 0 && (
              <div className="col-span-2 p-3 border rounded mt-2">
                <div className="font-semibold mb-2">Tax Components (from Compliance)</div>
                <Table aria-label="Tax Components">
                  <TableHeader>
                    <TableColumn>NAME</TableColumn>
                    <TableColumn>GL CODE</TableColumn>
                    <TableColumn>AMOUNT</TableColumn>
                  </TableHeader>
                  <TableBody>
                    {form.taxComponents.map((t: any, i: number) => (
                      <TableRow key={i}>
                        <TableCell>{t.name}</TableCell>
                        <TableCell><span className="font-mono text-sm">{t.glCode}</span></TableCell>
                        <TableCell>{formatAccountingCurrency(Number(t.amount||0))}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        )}
        {dialogType === 'invoice' && (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_220px] gap-4 items-start">
            <div className="space-y-4 min-w-0">
              {/* Document details */}
              <section className="space-y-3">
                <h4 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Document</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <Autocomplete
                    size="sm"
                    label="Supplier"
                    className="sm:col-span-2"
                    placeholder="Search or type a new supplier..."
                    startContent={<span className="text-gray-400 text-sm">🔍</span>}
                    selectedKey={form.businessPartnerId || null}
                    inputValue={form.supplierName || ''}
                    allowsCustomValue
                    isInvalid={!!errors.businessPartnerId}
                    errorMessage={errors.businessPartnerId}
                    onInputChange={(v) => {
                      const matched = suppliers.find((s) => s.name === v);
                      setForm({
                        ...form,
                        supplierName: v,
                        ...(form.businessPartnerId && !matched && v !== suppliers.find((s) => s.id === form.businessPartnerId)?.name
                          ? { businessPartnerId: '' }
                          : matched
                            ? { businessPartnerId: matched.id }
                            : {}),
                      });
                    }}
                    onSelectionChange={(key) => {
                      const id = String(key || '');
                      const supplier = suppliers.find((s) => s.id === id);
                      const terms = supplier?.paymentTerms || 0;
                      const base = form.date ? new Date(form.date) : new Date();
                      const due = new Date(base.getTime() + terms * 86400000).toISOString().slice(0, 10);
                      setForm({
                        ...form,
                        businessPartnerId: id,
                        supplierName: supplier?.name || form.supplierName || '',
                        dueDate: due,
                      });
                    }}
                  >
                    {suppliers.map((s) => (
                      <AutocompleteItem key={s.id} textValue={s.name}>
                        <div className="flex flex-col">
                          <span className="font-medium">{s.name}</span>
                          <span className="text-xs text-gray-500">{s.code}{s.paymentTerms != null ? ` · Net ${s.paymentTerms}` : ''}</span>
                        </div>
                      </AutocompleteItem>
                    ))}
                  </Autocomplete>
                  <Input
                    size="sm"
                    label="Supplier invoice #"
                    placeholder="From supplier bill"
                    value={form.invoiceNumber || ''}
                    onChange={(e) => setForm({ ...form, invoiceNumber: e.target.value })}
                    isInvalid={!!errors.invoiceNumber}
                    errorMessage={errors.invoiceNumber}
                  />
                  <PostingDateField
                    size="sm"
                    type="date"
                    label="Invoice date"
                    value={form.date || new Date().toISOString().slice(0, 10)}
                    onChange={(e) => {
                      const d = new Date(e.target.value);
                      const terms = selectedSupplier?.paymentTerms || 0;
                      const due = new Date(d.getTime() + terms * 86400000).toISOString().slice(0, 10);
                      setForm({ ...form, date: e.target.value, dueDate: due });
                    }}
                    isInvalid={!!errors.date}
                    errorMessage={errors.date}
                  />
                  <Input
                    size="sm"
                    type="date"
                    label="Due date"
                    value={form.dueDate || new Date().toISOString().slice(0, 10)}
                    onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                    description={selectedSupplier?.paymentTerms != null ? `From Net ${selectedSupplier.paymentTerms} — editable` : undefined}
                    isInvalid={!!errors.dueDate}
                    errorMessage={errors.dueDate}
                  />
                  <Input
                    size="sm"
                    label="Our PO #"
                    placeholder="Optional"
                    value={form.poNumber || ''}
                    onChange={(e) => setForm({ ...form, poNumber: e.target.value })}
                  />
                  <Input
                    size="sm"
                    label="Delivery / GRN #"
                    placeholder="Optional"
                    value={form.receiptNumber || ''}
                    onChange={(e) => setForm({ ...form, receiptNumber: e.target.value })}
                  />
                  <Input
                    size="sm"
                    label="Memo"
                    placeholder="Bill note — e.g. September produce order"
                    value={form.description || ''}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    className="sm:col-span-3"
                  />
                </div>
                {selectedSupplier ? (
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 px-0.5">
                    {selectedSupplier.contactPerson && <span>Attn: {selectedSupplier.contactPerson}</span>}
                    {selectedSupplier.phone && <span>{selectedSupplier.phone}</span>}
                    {selectedSupplier.email && <span>{selectedSupplier.email}</span>}
                    {selectedSupplier.taxNumber && <span className="font-mono">TIN {selectedSupplier.taxNumber}</span>}
                  </div>
                ) : form.supplierName?.trim() ? (
                  <div className="text-xs text-amber-700 px-0.5">New supplier — will be created when you save this bill</div>
                ) : null}
              </section>

              {/* Line items — primary work surface */}
              <section className="space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="inline-flex rounded-md border border-gray-200 p-0.5 bg-white">
                    <button
                      type="button"
                      className={`px-3 py-1 text-xs font-medium rounded ${lineEntryKind === 'item' ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
                      onClick={() => {
                        setLineEntryKind('item');
                        const next = (form.lines || []).map((ln: any) => ({
                          ...ln,
                          lineKind: 'item',
                          quantity: ln.quantity || 1,
                          glAccountCode: ln.glAccountCode === defaultExpenseCode('service') ? defaultExpenseCode('item') : ln.glAccountCode,
                        }));
                        setForm({ ...form, ...recomputeInvoiceFromLines(next.length ? next : [{
                          id: `INL-${Date.now()}`,
                          lineKind: 'item',
                          description: '',
                          quantity: 1,
                          unitPrice: 0,
                          glAccountCode: defaultExpenseCode('item'),
                          uom: 'Each',
                        }]) });
                      }}
                    >
                      Item
                    </button>
                    <button
                      type="button"
                      className={`px-3 py-1 text-xs font-medium rounded ${lineEntryKind === 'service' ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
                      onClick={() => {
                        setLineEntryKind('service');
                        const next = (form.lines || []).map((ln: any) => ({
                          ...ln,
                          lineKind: 'service',
                          quantity: 1,
                          itemId: '',
                          itemCode: '',
                          uom: undefined,
                          glAccountCode: ln.glAccountCode === defaultExpenseCode('item') ? defaultExpenseCode('service') : ln.glAccountCode,
                        }));
                        setForm({ ...form, ...recomputeInvoiceFromLines(next.length ? next : [{
                          id: `INL-${Date.now()}`,
                          lineKind: 'service',
                          description: '',
                          quantity: 1,
                          unitPrice: 0,
                          glAccountCode: defaultExpenseCode('service'),
                        }]) });
                      }}
                    >
                      Service
                    </button>
                  </div>
                  <Button
                    size="sm"
                    variant="flat"
                    color="primary"
                    onPress={() => {
                      const next = [...(form.lines || [])];
                      next.push(
                        lineEntryKind === 'service'
                          ? {
                              id: `INL-${Date.now()}`,
                              lineKind: 'service',
                              description: '',
                              quantity: 1,
                              unitPrice: 0,
                              glAccountCode: defaultExpenseCode('service'),
                            }
                          : {
                              id: `INL-${Date.now()}`,
                              lineKind: 'item',
                              description: '',
                              quantity: 1,
                              unitPrice: 0,
                              glAccountCode: defaultExpenseCode('item'),
                              uom: 'Each',
                              costCenter: '',
                            },
                      );
                      setForm({ ...form, ...recomputeInvoiceFromLines(next) });
                    }}
                  >
                    ➕ Add line
                  </Button>
                </div>
                <div className="rounded-lg border border-gray-200 overflow-x-auto">
                  {lineEntryKind === 'item' ? (
                    <Table aria-label="Item lines" removeWrapper classNames={{ table: 'table-fixed', th: 'bg-gray-50 text-[11px] uppercase tracking-wide', td: 'py-2' }}>
                      <TableHeader>
                        <TableColumn width={192}>ITEM</TableColumn>
                        <TableColumn width={181}>ACCOUNT</TableColumn>
                        <TableColumn width={77}>QTY</TableColumn>
                        <TableColumn width={104}>UNIT PRICE</TableColumn>
                        <TableColumn width={100}>AMOUNT</TableColumn>
                        <TableColumn width={44}>{''}</TableColumn>
                      </TableHeader>
                      <TableBody emptyContent="Add a line to start this bill.">
                        {(form.lines || []).map((ln: any, idx: number) => {
                          const lineAmount = +(Number(ln.quantity || 0) * Number(ln.unitPrice || 0)).toFixed(2);
                          const updateLine = (patch: Record<string, any>) => {
                            const next = [...(form.lines || [])];
                            next[idx] = { ...next[idx], lineKind: 'item', ...patch };
                            setForm({ ...form, ...recomputeInvoiceFromLines(next) });
                          };
                          return (
                            <TableRow key={ln.id || idx}>
                              <TableCell>
                                <div className="space-y-1.5 w-full min-w-0">
                                  <Autocomplete
                                    size="sm"
                                    className="w-full [&_button[aria-label='Show_suggestions']]:!min-w-[15px] [&_button[aria-label='Show_suggestions']]:!w-[15px] [&_button[aria-label='Show_suggestions']]:!h-[15px] [&_button[aria-label='Show_suggestions']]:!p-0"
                                    classNames={{ popoverContent: 'min-w-[280px]' }}
                                    selectedKey={ln.itemId || undefined}
                                    onSelectionChange={(key) => {
                                      const item = stockItems.find((i) => i.id === String(key || ''));
                                      if (item) {
                                        updateLine({
                                          itemId: item.id,
                                          itemCode: item.itemCode,
                                          description: item.name,
                                          unitPrice: ln.unitPrice > 0 ? ln.unitPrice : item.unitCost,
                                          uom: item.unit || 'Each',
                                        });
                                      } else {
                                        updateLine({ itemId: '', itemCode: '', description: ln.description || '' });
                                      }
                                    }}
                                    placeholder="Select stock item"
                                  >
                                    {(stockItems || [])
                                      .filter((it) => !form.businessPartnerId || it.supplierId === form.businessPartnerId)
                                      .map((item) => (
                                        <AutocompleteItem key={item.id} textValue={`${item.itemCode} ${item.name}`}>
                                          <div className="flex flex-col">
                                            <span className="font-mono text-xs">{item.itemCode}</span>
                                            <span className="text-xs text-gray-600">{item.name}</span>
                                          </div>
                                        </AutocompleteItem>
                                      ))}
                                  </Autocomplete>
                                  {showAdvancedInvoice && (
                                    <div className="grid grid-cols-2 gap-1.5">
                                      <Input
                                        size="sm"
                                        aria-label="UOM"
                                        placeholder="UOM"
                                        value={ln.uom || 'Each'}
                                        onChange={(e) => updateLine({ uom: e.target.value })}
                                      />
                                      <Autocomplete
                                        size="sm"
                                        selectedKey={ln.costCenter || undefined}
                                        onSelectionChange={(key) => updateLine({ costCenter: String(key || '') })}
                                        placeholder="Cost center"
                                        className="col-span-2"
                                      >
                                        {(costCenters || []).map((cc) => (
                                          <AutocompleteItem key={cc.code} textValue={`${cc.code} ${cc.name}`}>
                                            <span className="font-mono text-xs">{cc.code}</span> {cc.name}
                                          </AutocompleteItem>
                                        ))}
                                      </Autocomplete>
                                    </div>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                <Autocomplete
                                  size="sm"
                                  aria-label="Expense account"
                                  className="min-w-0 [&_button[aria-label='Show_suggestions']]:!min-w-[15px] [&_button[aria-label='Show_suggestions']]:!w-[15px] [&_button[aria-label='Show_suggestions']]:!h-[15px] [&_button[aria-label='Show_suggestions']]:!p-0"
                                  classNames={{ popoverContent: 'min-w-[320px]' }}
                                  selectedKey={ln.glAccountCode || undefined}
                                  onSelectionChange={(key) => updateLine({ glAccountCode: String(key || '') })}
                                  placeholder="Expense account"
                                >
                                  {expenseAccountChoices(ln.glAccountCode).map((acc) => (
                                    <AutocompleteItem key={acc.code} textValue={acc.name} className="whitespace-nowrap">
                                      {acc.name}
                                    </AutocompleteItem>
                                  ))}
                                </Autocomplete>
                              </TableCell>
                              <TableCell>
                                <Input
                                  size="sm"
                                  type="number"
                                  aria-label="Quantity"
                                  className="w-full min-w-[61px]"
                                  value={String(ln.quantity ?? 1)}
                                  onChange={(e) => updateLine({ quantity: parseFloat(e.target.value) || 0 })}
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  size="sm"
                                  type="number"
                                  aria-label="Unit price"
                                  className="w-full min-w-[88px]"
                                  value={String(ln.unitPrice ?? 0)}
                                  onChange={(e) => updateLine({ unitPrice: parseFloat(e.target.value) || 0 })}
                                />
                              </TableCell>
                              <TableCell>
                                <div className="text-sm tabular-nums text-right font-medium">{formatAccountingCurrency(lineAmount)}</div>
                              </TableCell>
                              <TableCell>
                                <Button
                                  size="sm"
                                  isIconOnly
                                  variant="light"
                                  color="danger"
                                  aria-label="Remove line"
                                  onPress={() => {
                                    const next = (form.lines || []).filter((_: any, i: number) => i !== idx);
                                    setForm({ ...form, ...recomputeInvoiceFromLines(next) });
                                  }}
                                >
                                  ✕
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  ) : (
                    <Table aria-label="Service lines" removeWrapper classNames={{ table: 'table-fixed', th: 'bg-gray-50 text-[11px] uppercase tracking-wide', td: 'py-2' }}>
                      <TableHeader>
                        <TableColumn>DESCRIPTION</TableColumn>
                        <TableColumn width={220}>ACCOUNT</TableColumn>
                        <TableColumn width={140}>AMOUNT</TableColumn>
                        <TableColumn width={48}>{''}</TableColumn>
                      </TableHeader>
                      <TableBody emptyContent="Add a line to start this bill.">
                        {(form.lines || []).map((ln: any, idx: number) => {
                          const updateLine = (patch: Record<string, any>) => {
                            const next = [...(form.lines || [])];
                            next[idx] = { ...next[idx], lineKind: 'service', quantity: 1, ...patch };
                            setForm({ ...form, ...recomputeInvoiceFromLines(next) });
                          };
                          return (
                            <TableRow key={ln.id || idx}>
                              <TableCell>
                                <div className="space-y-1.5 min-w-[240px]">
                                  <Input
                                    size="sm"
                                    aria-label="Service description"
                                    placeholder="Describe the service"
                                    value={ln.description || ''}
                                    onChange={(e) => updateLine({ description: e.target.value })}
                                  />
                                  {showAdvancedInvoice && (
                                    <div className="grid grid-cols-2 gap-1.5">
                                      <Autocomplete
                                        size="sm"
                                        selectedKey={ln.costCenter || undefined}
                                        onSelectionChange={(key) => updateLine({ costCenter: String(key || '') })}
                                        placeholder="Cost center"
                                        className="col-span-2"
                                      >
                                        {(costCenters || []).map((cc) => (
                                          <AutocompleteItem key={cc.code} textValue={`${cc.code} ${cc.name}`}>
                                            <span className="font-mono text-xs">{cc.code}</span> {cc.name}
                                          </AutocompleteItem>
                                        ))}
                                      </Autocomplete>
                                    </div>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                <Autocomplete
                                  size="sm"
                                  aria-label="Expense account"
                                  className="min-w-0 [&_button[aria-label='Show_suggestions']]:!min-w-[15px] [&_button[aria-label='Show_suggestions']]:!w-[15px] [&_button[aria-label='Show_suggestions']]:!h-[15px] [&_button[aria-label='Show_suggestions']]:!p-0"
                                  classNames={{ popoverContent: 'min-w-[320px]' }}
                                  selectedKey={ln.glAccountCode || undefined}
                                  onSelectionChange={(key) => updateLine({ glAccountCode: String(key || '') })}
                                  placeholder="Expense account"
                                >
                                  {expenseAccountChoices(ln.glAccountCode).map((acc) => (
                                    <AutocompleteItem key={acc.code} textValue={acc.name} className="whitespace-nowrap">
                                      {acc.name}
                                    </AutocompleteItem>
                                  ))}
                                </Autocomplete>
                              </TableCell>
                              <TableCell>
                                <Input
                                  size="sm"
                                  type="number"
                                  aria-label="Amount"
                                  value={String(ln.unitPrice ?? 0)}
                                  onChange={(e) => updateLine({ unitPrice: parseFloat(e.target.value) || 0 })}
                                />
                              </TableCell>
                              <TableCell>
                                <Button
                                  size="sm"
                                  isIconOnly
                                  variant="light"
                                  color="danger"
                                  aria-label="Remove line"
                                  onPress={() => {
                                    const next = (form.lines || []).filter((_: any, i: number) => i !== idx);
                                    setForm({ ...form, ...recomputeInvoiceFromLines(next) });
                                  }}
                                >
                                  ✕
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}
                </div>
              </section>

              {/* Tax & withholding */}
              <section className="rounded-lg border border-gray-200 p-3 space-y-3">
                <h4 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Tax & withholding</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
                  <div className="flex flex-wrap gap-2 items-end">
                    <Select
                      size="sm"
                      label="VAT / tax"
                      className="flex-1"
                      selectedKeys={[form.taxType || 'STANDARD']}
                      onSelectionChange={(keys) => {
                        const v = Array.from(keys)[0] as string;
                        const subtotal = Number(form.subtotal || 0);
                        const taxAmount = taxFromSubtotal(subtotal, v, form.customTaxPercent);
                        setForm({
                          ...form,
                          taxType: v,
                          taxAmount,
                          total: +(subtotal + taxAmount).toFixed(2),
                          taxBreakdown: taxBreakdownFor(form, v, subtotal, taxAmount),
                        });
                      }}
                    >
                      <SelectItem key="STANDARD">Standard purchase stack</SelectItem>
                      <SelectItem key="HOTEL">Hotel bill</SelectItem>
                      <SelectItem key="CUSTOM">Custom rate</SelectItem>
                      <SelectItem key="NONE">No tax</SelectItem>
                    </Select>
                    {form.taxType === 'HOTEL' && (
                      <p className="w-full text-[11px] text-gray-500 leading-snug">
                        From Compliance. Tourism stays a cost. NHIL, GETFund, and VAT can be claimed.
                      </p>
                    )}
                    {form.taxType === 'CUSTOM' && (
                      <Input
                        size="sm"
                        type="number"
                        label="%"
                        className="w-20"
                        value={String(form.customTaxPercent ?? 0)}
                        onChange={(e) => {
                          const customTaxPercent = parseFloat(e.target.value) || 0;
                          const subtotal = Number(form.subtotal || 0);
                          const taxAmount = taxFromSubtotal(subtotal, 'CUSTOM', customTaxPercent);
                          setForm({
                            ...form,
                            customTaxPercent,
                            taxAmount,
                            total: +(subtotal + taxAmount).toFixed(2),
                            taxBreakdown: taxBreakdownFor(form, 'CUSTOM', subtotal, taxAmount),
                          });
                        }}
                      />
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <Checkbox
                      size="sm"
                      isSelected={form.taxType !== 'NONE' && form.claimInputTax !== false}
                      isDisabled={form.taxType === 'NONE' || !(Number(form.taxAmount || 0) > 0)}
                      onValueChange={(checked) => setForm({ ...form, claimInputTax: checked })}
                    >
                      Claim input tax (VAT)
                    </Checkbox>
                    <p className="text-[11px] text-gray-500 -mt-1 leading-snug">
                      On = reclaimable on the Taxes desk. Off = tax stays as a cost on this bill.
                    </p>
                    <Checkbox
                      size="sm"
                      isSelected={!!form.whtApplicable}
                      onValueChange={(checked) => {
                        const subtotal = Number(form.subtotal || 0);
                        const category: PurchaseWhtCategory = form.whtCategory || 'SERVICE';
                        if (checked) {
                          const wht = computePurchaseWht(subtotal, category);
                          setForm({
                            ...form,
                            whtApplicable: true,
                            whtCategory: category,
                            taxBreakdown: { ...(form.taxBreakdown || {}), withholding: wht?.amount || 0 },
                          });
                        } else {
                          const tb = { ...(form.taxBreakdown || {}) };
                          delete tb.withholding;
                          setForm({ ...form, whtApplicable: false, taxBreakdown: tb });
                        }
                      }}
                    >
                      Withhold tax (WHT)
                    </Checkbox>
                    <Checkbox
                      size="sm"
                      isSelected={!!form.whtVatApplicable}
                      onValueChange={(checked) => {
                        const taxAmount = Number(form.taxAmount || 0);
                        if (checked) {
                          const whtVat = computePurchaseWhtVat(taxAmount);
                          setForm({
                            ...form,
                            whtVatApplicable: true,
                            taxBreakdown: { ...(form.taxBreakdown || {}), withholdingVat: whtVat?.amount || 0 },
                          });
                        } else {
                          const tb = { ...(form.taxBreakdown || {}) };
                          delete tb.withholdingVat;
                          setForm({ ...form, whtVatApplicable: false, taxBreakdown: tb });
                        }
                      }}
                    >
                      Withhold VAT (agent only)
                    </Checkbox>
                  </div>
                </div>
                {form.whtApplicable && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <Select
                      size="sm"
                      label="WHT category"
                      selectedKeys={[form.whtCategory || 'SERVICE']}
                      onSelectionChange={(keys) => {
                        const category = Array.from(keys)[0] as PurchaseWhtCategory;
                        const wht = computePurchaseWht(Number(form.subtotal || 0), category);
                        setForm({
                          ...form,
                          whtCategory: category,
                          taxBreakdown: { ...(form.taxBreakdown || {}), withholding: wht?.amount || 0 },
                        });
                      }}
                    >
                      {PURCHASE_WHT_CATEGORIES.map((c) => (
                        <SelectItem key={c.key}>{c.label}</SelectItem>
                      ))}
                    </Select>
                    {(() => {
                      const category: PurchaseWhtCategory = form.whtCategory || 'SERVICE';
                      const wht = computePurchaseWht(Number(form.subtotal || 0), category);
                      if (!wht) {
                        const label = PURCHASE_WHT_CATEGORIES.find((c) => c.key === category)?.label || category;
                        return (
                          <div className="sm:col-span-2 text-xs text-amber-600 flex items-center">
                            No active WHT rule for {label} — set one under Compliance taxes.
                          </div>
                        );
                      }
                      return (
                        <>
                          <Input size="sm" isReadOnly label="Rate" value={`${wht.rate}%`} />
                          <Input
                            size="sm"
                            type="number"
                            label="WHT amount"
                            value={String(form.taxBreakdown?.withholding ?? wht.amount)}
                            onChange={(e) =>
                              setForm({
                                ...form,
                                taxBreakdown: { ...(form.taxBreakdown || {}), withholding: parseFloat(e.target.value) || 0 },
                              })
                            }
                          />
                        </>
                      );
                    })()}
                  </div>
                )}
                {form.whtVatApplicable && (() => {
                  const whtVat = computePurchaseWhtVat(Number(form.taxAmount || 0));
                  if (!whtVat) {
                    return <div className="text-xs text-amber-600">Tax is ₵0 — nothing to withhold VAT on.</div>;
                  }
                  return (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <Input size="sm" isReadOnly label="WHT-VAT rate" value={`${whtVat.rate}%`} />
                      <Input
                        size="sm"
                        type="number"
                        label="WHT-VAT amount"
                        value={String(form.taxBreakdown?.withholdingVat ?? whtVat.amount)}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            taxBreakdown: { ...(form.taxBreakdown || {}), withholdingVat: parseFloat(e.target.value) || 0 },
                          })
                        }
                      />
                    </div>
                  );
                })()}
              </section>

              {/* Advanced */}
              <section className="space-y-3">
                <button
                  type="button"
                  className="text-xs font-medium text-gray-500 hover:text-gray-800"
                  onClick={() => setShowAdvancedInvoice((v) => !v)}
                >
                  {showAdvancedInvoice ? '▾ Hide advanced' : '▸ GL, cost center, charges, approvals & files'}
                </button>
                {showAdvancedInvoice && (
                  <div className="space-y-3 rounded-lg border border-dashed border-gray-200 p-3">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <Input
                        size="sm"
                        type="number"
                        label="Discount"
                        value={String(form.discountAmount ?? 0)}
                        onChange={(e) => setForm({ ...form, discountAmount: parseFloat(e.target.value) || 0 })}
                      />
                      <Input
                        size="sm"
                        type="number"
                        label="Shipping"
                        value={String(form.shippingCharges ?? 0)}
                        onChange={(e) => setForm({ ...form, shippingCharges: parseFloat(e.target.value) || 0 })}
                      />
                      <Input
                        size="sm"
                        type="number"
                        label="Other charges"
                        value={String(form.otherCharges ?? 0)}
                        onChange={(e) => setForm({ ...form, otherCharges: parseFloat(e.target.value) || 0 })}
                      />
                      <Input
                        size="sm"
                        type="number"
                        label="Already paid"
                        value={String(form.paidAmount ?? 0)}
                        onChange={(e) => setForm({ ...form, paidAmount: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      <Input size="sm" label="Prepared by" value={form.preparedBy || ''} onChange={(e) => setForm({ ...form, preparedBy: e.target.value })} />
                      <Input size="sm" label="Checked by" value={form.checkedBy || ''} onChange={(e) => setForm({ ...form, checkedBy: e.target.value })} />
                      <Input size="sm" label="Approved by" value={form.approvedBy || ''} onChange={(e) => setForm({ ...form, approvedBy: e.target.value })} />
                      <Input size="sm" label="Authorized by" value={form.authorizedBy || ''} onChange={(e) => setForm({ ...form, authorizedBy: e.target.value })} />
                      <Input size="sm" label="Payment approved by" value={form.paymentApprovedBy || ''} onChange={(e) => setForm({ ...form, paymentApprovedBy: e.target.value })} />
                    </div>
                    <AttachmentUpload attachments={form.attachments || []} onChange={(next) => setForm({ ...form, attachments: next })} />
                  </div>
                )}
              </section>
              {errors.total && <div className="text-red-600 text-xs">{errors.total}</div>}
            </div>

            {/* Sticky totals rail */}
            <aside className="lg:sticky lg:top-2 rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-2 text-sm">
              <h4 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Totals</h4>
              <div className="flex justify-between text-gray-600">
                <span>Subtotal</span>
                <span className="tabular-nums">{formatAccountingCurrency(Number(form.subtotal || 0))}</span>
              </div>
              <div>
                <button
                  type="button"
                  className="flex w-full justify-between text-gray-600"
                  aria-expanded={showTaxDetail}
                  onClick={() => setShowTaxDetail((open) => !open)}
                >
                  <span>{showTaxDetail ? '▾' : '▸'} Tax</span>
                  <span className="tabular-nums">{formatAccountingCurrency(Number(form.taxAmount || 0))}</span>
                </button>
                {showTaxDetail && (
                  <div className="mt-1 space-y-1 ps-3 text-[11px] text-gray-500">
                    {purchaseTaxLines(form).map((line) => (
                      <div key={line.key} className="flex justify-between gap-2">
                        <span>{line.label}</span>
                        <span className="tabular-nums">{formatAccountingCurrency(line.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {Number(form.discountAmount || 0) > 0 && (
                <div className="flex justify-between text-gray-600">
                  <span>Discount</span>
                  <span className="tabular-nums">−{formatAccountingCurrency(Number(form.discountAmount || 0))}</span>
                </div>
              )}
              {Number(form.shippingCharges || 0) > 0 && (
                <div className="flex justify-between text-gray-600">
                  <span>Shipping</span>
                  <span className="tabular-nums">{formatAccountingCurrency(Number(form.shippingCharges || 0))}</span>
                </div>
              )}
              {Number(form.otherCharges || 0) > 0 && (
                <div className="flex justify-between text-gray-600">
                  <span>Other</span>
                  <span className="tabular-nums">{formatAccountingCurrency(Number(form.otherCharges || 0))}</span>
                </div>
              )}
              {Number(form.taxBreakdown?.withholding || 0) > 0 && (
                <div className="flex justify-between text-amber-700">
                  <span>WHT</span>
                  <span className="tabular-nums">−{formatAccountingCurrency(Number(form.taxBreakdown?.withholding || 0))}</span>
                </div>
              )}
              {Number(form.taxBreakdown?.withholdingVat || 0) > 0 && (
                <div className="flex justify-between text-amber-700">
                  <span>WHT-VAT</span>
                  <span className="tabular-nums">−{formatAccountingCurrency(Number(form.taxBreakdown?.withholdingVat || 0))}</span>
                </div>
              )}
              {Number(form.paidAmount || 0) > 0 && (
                <div className="flex justify-between text-gray-600">
                  <span>Paid</span>
                  <span className="tabular-nums">−{formatAccountingCurrency(Number(form.paidAmount || 0))}</span>
                </div>
              )}
              <Divider className="my-1" />
              <div className="flex justify-between font-semibold text-gray-900">
                <span>Amount due</span>
                <span className="tabular-nums">{formatAccountingCurrency(invoiceNetPayable)}</span>
              </div>
            </aside>
          </div>
        )}
        {dialogType === 'payment' && (
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_200px] gap-4 items-start">
            <div className="space-y-4 min-w-0">
              <section className="space-y-3">
                <h4 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Pay to</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Autocomplete
                    size="sm"
                    label="Supplier"
                    placeholder="Search or type a new supplier..."
                    startContent={<span className="text-gray-400 text-sm">🔍</span>}
                    selectedKey={form.businessPartnerId || null}
                    inputValue={form.supplierName || ''}
                    allowsCustomValue
                    isInvalid={!!errors.businessPartnerId}
                    errorMessage={errors.businessPartnerId}
                    onInputChange={(v) => {
                      const matched = suppliers.find((s) => s.name === v);
                      setForm({
                        ...form,
                        supplierName: v,
                        invoiceId: form.businessPartnerId && !matched ? '' : form.invoiceId,
                        ...(form.businessPartnerId && !matched && v !== suppliers.find((s) => s.id === form.businessPartnerId)?.name
                          ? { businessPartnerId: '' }
                          : matched
                            ? { businessPartnerId: matched.id }
                            : {}),
                      });
                    }}
                    onSelectionChange={(key) => {
                      const id = String(key || '');
                      const supplier = suppliers.find((s) => s.id === id);
                      setForm({
                        ...form,
                        businessPartnerId: id,
                        supplierName: supplier?.name || form.supplierName || '',
                        invoiceId: '',
                      });
                    }}
                  >
                    {suppliers.map((s) => (
                      <AutocompleteItem key={s.id} textValue={s.name}>
                        <div className="flex flex-col">
                          <span className="font-medium">{s.name}</span>
                          <span className="text-xs text-gray-500">{s.code}</span>
                        </div>
                      </AutocompleteItem>
                    ))}
                  </Autocomplete>
                  <PostingDateField
                    size="sm"
                    type="date"
                    label="Payment date"
                    value={form.date || new Date().toISOString().slice(0, 10)}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                    isInvalid={!!errors.date}
                    errorMessage={errors.date}
                  />
                  {!form.businessPartnerId && form.supplierName?.trim() ? (
                    <div className="sm:col-span-2 text-xs text-amber-700 -mt-1">
                      New supplier — will be created when you record this payment
                    </div>
                  ) : null}
                  <Autocomplete
                    size="sm"
                    label="Apply to bill"
                    className="sm:col-span-2"
                    allowsCustomValue={false}
                    selectedKey={form.invoiceId || undefined}
                    onSelectionChange={(key) => {
                      const id = String(key || '');
                      const inv = purchaseInvoices.find((i) => i.id === id);
                      if (!inv) {
                        setForm({ ...form, invoiceId: '' });
                        return;
                      }
                      const paidForInvoice = payments.filter((p) => p.invoiceId === inv.id).reduce((s, p) => s + p.amount, 0);
                      const outstanding = Math.max(0, (inv.total || 0) - paidForInvoice);
                      const whtConfigured = Number(inv.taxBreakdown?.withholding || 0);
                      const whtVatConfigured = Number(inv.taxBreakdown?.withholdingVat || 0);
                      const whtAlreadyWithheld = payments
                        .filter((p: any) => p.invoiceId === inv.id && p.isWHTCertificate)
                        .reduce((s: number, p: any) => s + Number(p.whtAmount || 0), 0);
                      const whtVatAlreadyWithheld = payments
                        .filter((p: any) => p.invoiceId === inv.id && p.isWHTCertificate)
                        .reduce((s: number, p: any) => s + Number(p.whtVatAmount || 0), 0);
                      const whtRemaining = Math.min(outstanding, Math.max(0, whtConfigured - whtAlreadyWithheld));
                      const whtVatRemaining = Math.min(
                        Math.max(0, outstanding - whtRemaining),
                        Math.max(0, whtVatConfigured - whtVatAlreadyWithheld),
                      );
                      const applyWht = whtRemaining > 0 || whtVatRemaining > 0;
                      const nextAmount = Math.max(0, outstanding - whtRemaining - whtVatRemaining);
                      setForm({
                        ...form,
                        invoiceId: inv.id,
                        amount: nextAmount,
                        applyWht,
                        whtAmount: whtRemaining,
                        whtVatAmount: whtVatRemaining,
                        reference: form.reference || `Payment for invoice ${inv.invoiceNumber}`,
                      });
                    }}
                    placeholder={form.businessPartnerId ? 'Optional — select open bill' : 'Select supplier first'}
                    isDisabled={!form.businessPartnerId}
                  >
                    {purchaseInvoices
                      .filter((inv) => !form.businessPartnerId || inv.businessPartnerId === form.businessPartnerId)
                      .map((inv) => {
                        const paid = payments.filter((p) => p.invoiceId === inv.id).reduce((s, p) => s + p.amount, 0);
                        const bal = Math.max(0, (inv.total || 0) - paid);
                        return (
                          <AutocompleteItem key={inv.id} textValue={`${inv.invoiceNumber}`}>
                            <div className="flex items-center justify-between gap-3 w-full">
                              <span className="font-mono text-xs">{inv.invoiceNumber}</span>
                              <span className="text-xs text-gray-600">{formatAccountingCurrency(bal)} due</span>
                            </div>
                          </AutocompleteItem>
                        );
                      })}
                  </Autocomplete>
                </div>
              </section>

              <section className="space-y-3">
                <h4 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Payment</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input
                    size="sm"
                    type="number"
                    label="Cash to supplier"
                    value={String(form.amount ?? 0)}
                    onChange={(e) => setForm({ ...form, amount: parseFloat(e.target.value) || 0 })}
                    isInvalid={!!errors.amount}
                    errorMessage={errors.amount}
                  />
                  <Select
                    size="sm"
                    label="Method"
                    selectedKeys={[form.paymentMethod || 'Bank']}
                    onSelectionChange={(keys) => setForm({ ...form, paymentMethod: Array.from(keys)[0] })}
                  >
                    <SelectItem key="Cash">Cash</SelectItem>
                    <SelectItem key="Bank">Bank</SelectItem>
                    <SelectItem key="Check">Check</SelectItem>
                    <SelectItem key="Card">Card</SelectItem>
                    <SelectItem key="Mobile Money">Mobile Money</SelectItem>
                  </Select>
                  {(form.paymentMethod === 'Bank' || form.paymentMethod === 'Check') && (
                    <>
                      <Select
                        size="sm"
                        label="Bank account"
                        selectedKeys={form.bankAccountId ? [form.bankAccountId] : []}
                        onSelectionChange={(keys) => {
                          const id = Array.from(keys)[0];
                          setForm({ ...form, bankAccountId: id ? String(id) : '' });
                        }}
                        isInvalid={!!errors.bankAccountId}
                        errorMessage={errors.bankAccountId}
                      >
                        {bankAccounts.map((acc) => (
                          <SelectItem key={acc.id} textValue={`${acc.accountName} - ${acc.accountNumber}`}>
                            {acc.accountName} - {acc.accountNumber}
                          </SelectItem>
                        ))}
                      </Select>
                      <Input
                        size="sm"
                        label="Cheque / ref no"
                        value={form.checkNumber || ''}
                        onChange={(e) => setForm({ ...form, checkNumber: e.target.value })}
                      />
                    </>
                  )}
                  <Input
                    size="sm"
                    label="Reference"
                    placeholder="Optional note"
                    value={form.reference || ''}
                    onChange={(e) => setForm({ ...form, reference: e.target.value })}
                    className="sm:col-span-2"
                  />
                </div>
              </section>

              {selectedPaymentInvoice && (() => {
                const whtConfigured = Number(selectedPaymentInvoice.taxBreakdown?.withholding || 0);
                const whtVatConfigured = Number(selectedPaymentInvoice.taxBreakdown?.withholdingVat || 0);
                if (whtConfigured <= 0 && whtVatConfigured <= 0) return null;
                const whtAlreadyWithheld = payments
                  .filter((p: any) => p.invoiceId === selectedPaymentInvoice.id && p.isWHTCertificate)
                  .reduce((s: number, p: any) => s + Number(p.whtAmount || 0), 0);
                const whtVatAlreadyWithheld = payments
                  .filter((p: any) => p.invoiceId === selectedPaymentInvoice.id && p.isWHTCertificate)
                  .reduce((s: number, p: any) => s + Number(p.whtVatAmount || 0), 0);
                const whtRemaining = Math.max(0, whtConfigured - whtAlreadyWithheld);
                const whtVatRemaining = Math.max(0, whtVatConfigured - whtVatAlreadyWithheld);
                if (whtRemaining <= 0 && whtVatRemaining <= 0) return null;
                const currentWht = Number(form.whtAmount || 0);
                const currentWhtVat = Number(form.whtVatAmount || 0);
                return (
                  <section className="rounded-lg border border-gray-200 p-3 space-y-2">
                    <h4 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Withholding</h4>
                    {whtRemaining > 0 && (
                      <Checkbox
                        size="sm"
                        isSelected={currentWht > 0}
                        onValueChange={(checked) => {
                          const nextWht = checked ? whtRemaining : 0;
                          const nextAmount = Math.max(0, paymentInvoiceOutstanding - nextWht - currentWhtVat);
                          setForm({ ...form, applyWht: nextWht > 0 || currentWhtVat > 0, whtAmount: nextWht, amount: nextAmount });
                        }}
                      >
                        Tax withheld (WHT) — {formatAccountingCurrency(whtRemaining)}
                      </Checkbox>
                    )}
                    {whtVatRemaining > 0 && (
                      <Checkbox
                        size="sm"
                        isSelected={currentWhtVat > 0}
                        onValueChange={(checked) => {
                          const nextWhtVat = checked ? whtVatRemaining : 0;
                          const nextAmount = Math.max(0, paymentInvoiceOutstanding - currentWht - nextWhtVat);
                          setForm({ ...form, applyWht: currentWht > 0 || nextWhtVat > 0, whtVatAmount: nextWhtVat, amount: nextAmount });
                        }}
                      >
                        VAT withheld (WHT-VAT) — {formatAccountingCurrency(whtVatRemaining)}
                      </Checkbox>
                    )}
                  </section>
                );
              })()}

              <section className="space-y-3">
                <button
                  type="button"
                  className="text-xs font-medium text-gray-500 hover:text-gray-800"
                  onClick={() => setShowAdvancedInvoice((v) => !v)}
                >
                  {showAdvancedInvoice ? '▾ Hide advanced' : '▸ Receipt acknowledgement & files'}
                </button>
                {showAdvancedInvoice && (
                  <div className="space-y-3 rounded-lg border border-dashed border-gray-200 p-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Input size="sm" label="Received by" value={form.receivedBy || ''} onChange={(e) => setForm({ ...form, receivedBy: e.target.value })} />
                      <Input size="sm" label="Receiver contact" value={form.receiverContact || ''} onChange={(e) => setForm({ ...form, receiverContact: e.target.value })} />
                      <Select
                        size="sm"
                        label="ID type"
                        selectedKeys={form.receiverIdType ? [form.receiverIdType] : []}
                        onSelectionChange={(keys) => setForm({ ...form, receiverIdType: Array.from(keys)[0] as string })}
                      >
                        <SelectItem key="Ghana Card">Ghana Card</SelectItem>
                        <SelectItem key="Passport">Passport</SelectItem>
                        <SelectItem key="Driver's License">Driver&apos;s License</SelectItem>
                        <SelectItem key="Voter ID">Voter ID</SelectItem>
                        <SelectItem key="National ID">National ID</SelectItem>
                        <SelectItem key="Other">Other</SelectItem>
                      </Select>
                      <Input size="sm" label="ID number" value={form.receiverIdNumber || ''} onChange={(e) => setForm({ ...form, receiverIdNumber: e.target.value })} />
                      <PostingDateField size="sm" type="date" label="Received date" value={form.receivedDate || ''} onChange={(e) => setForm({ ...form, receivedDate: e.target.value })} />
                    </div>
                    <AttachmentUpload attachments={form.attachments || []} onChange={(next) => setForm({ ...form, attachments: next })} />
                  </div>
                )}
              </section>

              <Checkbox size="sm" isSelected={postOnSave} onValueChange={setPostOnSave}>
                Post payment to ledger on save
              </Checkbox>
            </div>

            <aside className="sm:sticky sm:top-2 rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-2 text-sm">
              <h4 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Settlement</h4>
              {selectedPaymentInvoice ? (
                <>
                  <div className="flex justify-between text-gray-600">
                    <span>Bill due</span>
                    <span className="tabular-nums">{formatAccountingCurrency(paymentInvoiceOutstanding)}</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>Cash</span>
                    <span className="tabular-nums">−{formatAccountingCurrency(paymentCash)}</span>
                  </div>
                  {paymentWht > 0 && (
                    <div className="flex justify-between text-amber-700">
                      <span>WHT</span>
                      <span className="tabular-nums">−{formatAccountingCurrency(paymentWht)}</span>
                    </div>
                  )}
                  {paymentWhtVat > 0 && (
                    <div className="flex justify-between text-amber-700">
                      <span>WHT-VAT</span>
                      <span className="tabular-nums">−{formatAccountingCurrency(paymentWhtVat)}</span>
                    </div>
                  )}
                  <Divider className="my-1" />
                  <div className="flex justify-between font-semibold text-gray-900">
                    <span>New balance</span>
                    <span className={`tabular-nums ${paymentNewBalance === 0 ? 'text-green-700' : ''}`}>
                      {formatAccountingCurrency(paymentNewBalance || 0)}
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex justify-between text-gray-600">
                    <span>Cash</span>
                    <span className="tabular-nums">{formatAccountingCurrency(paymentCash)}</span>
                  </div>
                  <p className="text-[11px] text-gray-400 leading-snug pt-1">
                    Link a bill to see outstanding and withholding options.
                  </p>
                </>
              )}
            </aside>
          </div>
        )}
              </ModalBody>
              <ModalFooter className={dialogType === 'invoice' || dialogType === 'payment' ? 'border-t bg-white' : undefined}>
                <Button variant="light" onPress={onClose}>Cancel</Button>
                <Button color="primary" onPress={handleSave}>
                  {dialogType === 'invoice'
                    ? (editing ? 'Update bill' : 'Save bill')
                    : dialogType === 'payment'
                      ? (editing ? 'Update payment' : 'Record payment')
                      : 'Save'}
                </Button>
              </ModalFooter>
            </>
          );
          }}
        </ModalContent>
      </Modal>

      {/* Click-to-view detail (Edit / other actions in footer) */}
      <Modal
        isOpen={isViewOpen}
        onOpenChange={(open) => { if (!open) closeView(); }}
        size={viewKind === 'invoice' ? '4xl' : '2xl'}
        scrollBehavior="inside"
      >
        <ModalContent>
          {(onClose) => {
            if (!viewItem || !viewKind) return null;

            if (viewKind === 'supplier') {
              const outstanding = supplierAging.find((a) => a.id === viewItem.id)?.outstandingBalance ?? 0;
              const statusLabel = outstanding > (viewItem.creditLimit || 0) ? 'Over Limit' : outstanding > 0 ? 'Still owed' : 'Current';
              const statusColor = outstanding > (viewItem.creditLimit || 0) ? 'danger' : outstanding > 0 ? 'warning' : 'success';
              return (
                <>
                  <ModalHeader className="border-b bg-white px-6 py-4">
                    <div className="flex justify-between items-start w-full pr-6">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-xl font-bold text-gray-900">SUPPLIER</h3>
                          <Chip size="sm" variant="flat" color={statusColor as any}>{statusLabel}</Chip>
                        </div>
                        <p className="text-lg text-gray-800">{viewItem.name}</p>
                        <p className="text-sm font-mono text-gray-500">{viewItem.code}</p>
                      </div>
                    </div>
                  </ModalHeader>
                  <ModalBody className="p-6 bg-white">
                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 text-sm">
                      <div>
                        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Contact</h4>
                        <div className="space-y-1">
                          <div><span className="text-gray-500">Person:</span> <span className="font-medium">{viewItem.contactPerson || '—'}</span></div>
                          <div><span className="text-gray-500">Email:</span> <span className="font-medium">{viewItem.email || '—'}</span></div>
                          <div><span className="text-gray-500">Phone:</span> <span className="font-medium">{viewItem.phone || '—'}</span></div>
                          <div><span className="text-gray-500">Tax ID:</span> <span className="font-mono text-xs">{viewItem.taxNumber || '—'}</span></div>
                        </div>
                      </div>
                      <div>
                        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Account</h4>
                        <div className="space-y-1">
                          <div><span className="text-gray-500">Address:</span> <span className="font-medium">{viewItem.address || '—'}</span></div>
                          <div><span className="text-gray-500">Country:</span> <span className="font-medium">{viewItem.countryCode || '—'}</span></div>
                          <div><span className="text-gray-500">Payment terms:</span> <span className="font-medium">{viewItem.paymentTerms != null ? `${viewItem.paymentTerms} days` : '—'}</span></div>
                          <div><span className="text-gray-500">Credit limit:</span> <span className="font-medium tabular-nums">{formatAccountingCurrency(viewItem.creditLimit || 0)}</span></div>
                          <div><span className="text-gray-500">Outstanding:</span> <span className="font-semibold text-red-600 tabular-nums">{formatAccountingCurrency(outstanding)}</span></div>
                        </div>
                      </div>
                    </div>
                  </ModalBody>
                  <ModalFooter className="border-t bg-white">
                    <Button variant="flat" onPress={onClose}>Close</Button>
                    <Button color="primary" variant="flat" onPress={() => { closeView(); openNewInvoiceFor(viewItem.id); }}>📄 Add Bill</Button>
                    {outstanding > 0 && (
                      <Button color="danger" variant="flat" onPress={() => { closeView(); openNewPaymentFor(viewItem.id, outstanding, `Payment to ${viewItem.name}`); }}>💳 Record Payment</Button>
                    )}
                    <Button color="primary" onPress={() => { closeView(); openSupplierEdit(viewItem); }}>✏️ Edit</Button>
                  </ModalFooter>
                </>
              );
            }

            if (viewKind === 'invoice') {
              const supplier = suppliers.find((s) => s.id === viewItem.businessPartnerId);
              const paidAmount = (viewItem.paidAmount != null)
                ? viewItem.paidAmount
                : supplierPayments.filter((p) => p.invoiceId === viewItem.id).reduce((sum, p) => sum + p.amount, 0);
              const balance = (viewItem.total || 0) - paidAmount;
              const dueRaw = viewItem.dueDate || viewItem.date;
              const dueDate = new Date(dueRaw);
              const dueValid = !Number.isNaN(dueDate.getTime());
              const daysOverdue = dueValid ? Math.floor((Date.now() - dueDate.getTime()) / 86400000) : 0;
              const statusLabel = balance <= 0 ? 'Paid' : daysOverdue > 0 ? 'Overdue' : 'Still owed';
              const statusColor = balance <= 0 ? 'success' : daysOverdue > 0 ? 'danger' : 'warning';
              const storedLines = (viewItem.lines || viewItem.items || viewItem.lineItems || []).map((ln: any) => {
                const quantity = Number(ln.quantity || 1) || 1;
                const unitPrice = Number(ln.unitPrice || 0);
                const amount = ln.amount != null && ln.amount !== '' ? Number(ln.amount) : quantity * unitPrice;
                return {
                  id: ln.id,
                  description: String(ln.description || ln.itemName || ''),
                  quantity,
                  unitPrice: unitPrice || (quantity ? amount / quantity : amount),
                  amount,
                };
              });
              const linkedPo = purchaseOrders.find((po) => po.poNumber && po.poNumber === viewItem.poNumber);
              const poLines = (linkedPo?.items || []).map((item) => ({
                id: item.id,
                description: item.itemName,
                quantity: Number(item.quantity || 0),
                unitPrice: Number(item.unitCost || 0),
                amount: Number(item.totalCost || (Number(item.quantity || 0) * Number(item.unitCost || 0))),
              }));
              const linesToShow = storedLines.length > 1 ? storedLines : (poLines.length > storedLines.length ? poLines : storedLines);
              const billPayments = billActivePayments(viewItem.id);
              const processed = billProcessedBy(viewItem);
              const wht = Number(viewItem.taxBreakdown?.withholding || 0);
              const whtVat = Number(viewItem.taxBreakdown?.withholdingVat || 0);
              return (
                <>
                  <ModalHeader className="border-b bg-white px-4 py-2.5 pe-12">
                    <div className="flex justify-between items-start w-full gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-bold text-gray-900">PURCHASE BILL</h3>
                          <Chip size="sm" variant="flat" color={statusColor as any}>{statusLabel}</Chip>
                        </div>
                        <p className="text-sm font-mono text-gray-700">{viewItem.invoiceNumber || viewItem.id}</p>
                      </div>
                      <div className="text-right text-xs text-gray-600 leading-snug">
                        <div>Supplier: <span className="font-medium">{supplier?.name || '—'}</span></div>
                        <div>Date: {new Date(viewItem.date).toLocaleDateString()}</div>
                      </div>
                    </div>
                  </ModalHeader>
                  <ModalBody className="px-4 py-3 bg-white">
                    <div className="space-y-3">
                      <div className="text-center py-3 border-b">
                        <p className="text-[11px] text-gray-500 uppercase tracking-wide mb-0.5">{balance > 0 ? 'Still owed' : 'Paid in full'}</p>
                        <p className={`text-2xl font-bold tabular-nums ${balance > 0 ? 'text-gray-900' : 'text-green-700'}`}>{formatAccountingCurrency(balance > 0 ? balance : (viewItem.total || 0))}</p>
                        <p className="text-xs text-gray-500 mt-0.5">Total {formatAccountingCurrency(viewItem.total || 0)} · Paid {formatAccountingCurrency(paidAmount)}</p>
                      </div>

                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 pb-3 border-b text-sm">
                        <div>
                          <h4 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Supplier</h4>
                          <div className="font-semibold text-gray-900">{supplier?.name || 'Unknown'}</div>
                          <div className="text-xs text-gray-500 font-mono">{supplier?.code || viewItem.businessPartnerId}</div>
                          {supplier?.phone && <div className="text-xs text-gray-600 mt-1">{supplier.phone}</div>}
                          {supplier?.taxNumber && <div className="text-xs text-gray-500 font-mono">TIN {supplier.taxNumber}</div>}
                        </div>
                        <div>
                          <h4 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Bill</h4>
                          <div className="flex justify-between gap-2"><span className="text-gray-500">Invoice date</span><span>{new Date(viewItem.date).toLocaleDateString()}</span></div>
                          <div className="flex justify-between gap-2"><span className="text-gray-500">Due</span><span className={daysOverdue > 0 && balance > 0 ? 'text-red-600 font-medium' : ''}>{dueValid ? dueDate.toLocaleDateString() : '—'}</span></div>
                          {viewItem.poNumber && <div className="flex justify-between gap-2"><span className="text-gray-500">Purchase order</span><span className="font-mono text-xs">{viewItem.poNumber}</span></div>}
                          {viewItem.description && <p className="mt-1 text-gray-600">{viewItem.description}</p>}
                        </div>
                        {processed.name && (
                          <div>
                            <h4 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Processed by</h4>
                            <div className="font-semibold text-gray-900">{processed.name}</div>
                            {processed.staffId && <div className="text-xs text-gray-500 font-mono">{processed.staffId}</div>}
                            {processed.role && <div className="text-xs text-gray-600">{processed.role}</div>}
                            {processed.department && <div className="text-xs text-gray-600">{processed.department}</div>}
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
                        <div>
                          <h4 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Lines</h4>
                          <table className="w-full text-sm border-collapse">
                            <thead>
                              <tr>
                                <th className="text-left py-1.5 px-2 border border-gray-300 bg-gray-50 text-gray-600 font-semibold">Description</th>
                                <th className="text-right py-1.5 px-2 border border-gray-300 bg-gray-50 text-gray-600 font-semibold">Qty</th>
                                <th className="text-right py-1.5 px-2 border border-gray-300 bg-gray-50 text-gray-600 font-semibold">Unit</th>
                                <th className="text-right py-1.5 px-2 border border-gray-300 bg-gray-50 text-gray-600 font-semibold">Amount</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(linesToShow.length ? linesToShow : [{ id: 'summary', description: viewItem.description || 'Purchase', quantity: 1, unitPrice: Number(viewItem.subtotal || 0), amount: Number(viewItem.subtotal || 0) }]).map((ln: { id?: string; description: string; quantity: number; unitPrice: number; amount: number }, i: number) => (
                                <tr key={ln.id || i}>
                                  <td className="py-1.5 px-2 border border-gray-300">{ln.description || '—'}</td>
                                  <td className="py-1.5 px-2 border border-gray-300 text-right tabular-nums">{ln.quantity}</td>
                                  <td className="py-1.5 px-2 border border-gray-300 text-right tabular-nums">{formatAccountingCurrency(ln.unitPrice)}</td>
                                  <td className="py-1.5 px-2 border border-gray-300 text-right tabular-nums font-medium">{formatAccountingCurrency(ln.amount)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <div>
                          <h4 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Totals</h4>
                          <table className="w-full text-sm border-collapse">
                            <tbody>
                              <tr><td className="py-1.5 px-2 border border-gray-300 text-gray-600">Subtotal</td><td className="py-1.5 px-2 border border-gray-300 text-right tabular-nums">{formatAccountingCurrency(viewItem.subtotal || 0)}</td></tr>
                              <tr><td className="py-1.5 px-2 border border-gray-300 text-gray-600">Tax</td><td className="py-1.5 px-2 border border-gray-300 text-right tabular-nums">{formatAccountingCurrency(viewItem.taxAmount || 0)}</td></tr>
                              {wht > 0 && <tr><td className="py-1.5 px-2 border border-gray-300 text-gray-600">WHT</td><td className="py-1.5 px-2 border border-gray-300 text-right tabular-nums">−{formatAccountingCurrency(wht)}</td></tr>}
                              {whtVat > 0 && <tr><td className="py-1.5 px-2 border border-gray-300 text-gray-600">WHT-VAT</td><td className="py-1.5 px-2 border border-gray-300 text-right tabular-nums">−{formatAccountingCurrency(whtVat)}</td></tr>}
                              <tr><td className="py-1.5 px-2 border border-gray-300 font-semibold">Total</td><td className="py-1.5 px-2 border border-gray-300 text-right tabular-nums font-semibold">{formatAccountingCurrency(viewItem.total || 0)}</td></tr>
                              <tr><td className="py-1.5 px-2 border border-gray-300 text-green-700">Paid</td><td className="py-1.5 px-2 border border-gray-300 text-right tabular-nums text-green-700">{formatAccountingCurrency(paidAmount)}</td></tr>
                              <tr><td className={`py-1.5 px-2 border border-gray-300 font-bold ${balance > 0 ? 'text-red-600' : 'text-green-700'}`}>Balance</td><td className={`py-1.5 px-2 border border-gray-300 text-right tabular-nums font-bold ${balance > 0 ? 'text-red-600' : 'text-green-700'}`}>{formatAccountingCurrency(balance)}</td></tr>
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {billPayments.length > 0 && (
                        <div className="border-t border-gray-900 pt-3">
                          <h4 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Payments</h4>
                          <table className="w-full text-sm border-collapse">
                            <thead>
                              <tr>
                                <th className="text-left py-1.5 px-2 border border-gray-300 bg-gray-50 text-gray-600 font-semibold">Payment</th>
                                <th className="text-left py-1.5 px-2 border border-gray-300 bg-gray-50 text-gray-600 font-semibold">Date</th>
                                <th className="text-left py-1.5 px-2 border border-gray-300 bg-gray-50 text-gray-600 font-semibold">Method</th>
                                <th className="text-right py-1.5 px-2 border border-gray-300 bg-gray-50 text-gray-600 font-semibold">Amount</th>
                              </tr>
                            </thead>
                            <tbody>
                              {billPayments.map((p) => (
                                <tr key={p.id}>
                                  <td className="py-1.5 px-2 border border-gray-300 font-mono text-xs">{p.paymentNumber || p.id}</td>
                                  <td className="py-1.5 px-2 border border-gray-300">{new Date(p.date).toLocaleDateString()}</td>
                                  <td className="py-1.5 px-2 border border-gray-300">{p.paymentMethod || '—'}</td>
                                  <td className="py-1.5 px-2 border border-gray-300 text-right tabular-nums font-medium">{formatAccountingCurrency(Number(p.amount || 0))}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </ModalBody>
                  <ModalFooter className="border-t bg-white px-4 py-2.5">
                    <Button variant="flat" size="sm" onPress={onClose}>Close</Button>
                    {viewItem.status !== 'Void' && balance > 0 && (
                      <Button color="danger" variant="flat" size="sm" onPress={() => { closeView(); openPaymentForInvoice(viewItem); }}>
                        Record Payment
                      </Button>
                    )}
                    {viewItem.status !== 'Void' && (
                      <Button color="primary" variant="flat" size="sm" onPress={() => { closeView(); openBillEdit(viewItem); }}>
                        Edit
                      </Button>
                    )}
                    {viewItem.status !== 'Void' && (
                      <Button color="danger" variant="flat" size="sm" onPress={() => handleVoidBill(viewItem)}>
                        Void
                      </Button>
                    )}
                    {viewItem.status !== 'Void' && (
                      <Button color="danger" variant="light" size="sm" onPress={() => handleDeleteBill(viewItem)}>
                        Delete
                      </Button>
                    )}
                    {viewItem.status === 'Void' && (
                      <Button color="warning" variant="flat" size="sm" onPress={() => handleUnvoidBill(viewItem)}>
                        Unvoid
                      </Button>
                    )}
                    <Button color="primary" size="sm" onPress={() => printBillPDF(viewItem)}>
                      Print PDF
                    </Button>
                  </ModalFooter>
                </>
              );
            }

            // payment view
            const paySupplier = suppliers.find((s) => s.id === viewItem.businessPartnerId);
            const canApprove = viewItem.status === 'Pending Approval' && canApprovePayments;
            return (
              <>
                <ModalHeader className="border-b bg-white px-6 py-4">
                  <div className="flex justify-between items-start w-full pr-6">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-xl font-bold text-gray-900">SUPPLIER PAYMENT</h3>
                        <Chip
                          size="sm"
                          variant="flat"
                          color={
                            viewItem.status === 'Posted' ? 'success' :
                            viewItem.status === 'Pending Approval' ? 'warning' :
                            viewItem.status === 'Draft' ? 'default' : 'danger'
                          }
                        >
                          {viewItem.status || '—'}
                        </Chip>
                      </div>
                      <p className="text-lg font-mono text-gray-700">{viewItem.paymentNumber || viewItem.id}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-3xl font-bold tabular-nums text-gray-900">{formatAccountingCurrency(viewItem.amount || 0)}</p>
                      <p className="text-sm text-gray-500">{viewItem.paymentMethod || '—'}</p>
                    </div>
                  </div>
                </ModalHeader>
                <ModalBody className="p-6 bg-white">
                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 text-sm">
                    <div>
                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Paid To</h4>
                      <div className="font-semibold">{paySupplier?.name || viewItem.businessPartnerId}</div>
                      <div className="text-xs text-gray-500 font-mono">{paySupplier?.code || '—'}</div>
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Details</h4>
                      <div className="flex justify-between"><span className="text-gray-500">Date:</span><span>{new Date(viewItem.date).toLocaleDateString()}</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">Reference:</span><span>{viewItem.reference || '—'}</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">Invoice:</span><span className="font-mono text-xs">{viewItem.invoiceId || '—'}</span></div>
                      {viewItem.checkNumber && <div className="flex justify-between"><span className="text-gray-500">Check #:</span><span className="font-mono text-xs">{viewItem.checkNumber}</span></div>}
                    </div>
                  </div>
                </ModalBody>
                <ModalFooter className="border-t bg-white px-4 py-2.5">
                  <Button variant="flat" size="sm" onPress={onClose}>Close</Button>
                  {canApprove && (
                    <Button color="success" variant="flat" size="sm" onPress={() => { try { postPayment(viewItem.id); } catch {} closeView(); }}>
                      Approve &amp; Post
                    </Button>
                  )}
                  {viewItem.status !== 'Void' && (
                    <Button color="primary" variant="flat" size="sm" onPress={() => { closeView(); openPaymentEdit(viewItem); }}>
                      Edit
                    </Button>
                  )}
                  {viewItem.status !== 'Void' && (
                    <Button color="danger" variant="flat" size="sm" onPress={() => handleVoidPayment(viewItem)}>
                      Void
                    </Button>
                  )}
                  {viewItem.status !== 'Void' && (
                    <Button color="danger" variant="light" size="sm" onPress={() => handleDeletePayment(viewItem)}>
                      Delete
                    </Button>
                  )}
                  {viewItem.status === 'Void' && (
                    <Button color="warning" variant="flat" size="sm" onPress={() => handleUnvoidPayment(viewItem)}>
                      Unvoid
                    </Button>
                  )}
                  <Button color="primary" size="sm" onPress={() => printPaymentPDF(viewItem)}>
                    Print PDF
                  </Button>
                </ModalFooter>
              </>
            );
          }}
        </ModalContent>
      </Modal>

      {/* end create/edit dialog */}
      <SupplierFormModal isOpen={supplierFormOpen} onClose={() => setSupplierFormOpen(false)} />
    </div>
  );
}

// end of file
