"use client";

import React, { useState, useMemo, useEffect } from 'react';
import {
  Card,
  CardBody,
  CardHeader,
  Button,
  Input,
  Select,
  SelectItem,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Badge,
  Chip,
  Textarea,
  Divider,
  Pagination,
  Switch
} from "@heroui/react";
import CustomizeViewControl, { HideCardButton } from '../../components/dashboard/CustomizeViewControl';
import { useDashboardVisibility, type DashboardSectionDef } from '../../lib/dashboard/useDashboardVisibility';
import { frontOfficeStore } from '../../lib/frontoffice/store';
import { useSettingsStore } from '../../lib/settings/store';
import { useCurrentUserName } from '../../lib/auth/useCurrentUserName';
import { trackEvent } from '../../lib/analytics/trackEvent';
import { openPrintPreview, openHtmlPrintWindow } from '../../lib/print/engine';
import { listTemplates } from '../../lib/print/templates';
import { buildOrgProfile } from '../../lib/print/buildOrgProfile';
import { computeChargeTax } from '../../lib/frontoffice/helpers/folio';
import { formatMoney } from '../../lib/format/currency';

/**
 * Line total incl. tax (table / guest-facing amounts) — via the same compliance-engine
 * computeChargeTax the store's addCharge/addFolioCharge actually save with (see
 * frontoffice/helpers/folio.ts), so this preview can never show a different number than
 * what actually lands on the guest's folio. `description` lets it category-match the
 * same way (e.g. Laundry -> no Tourism Levy) when the charge is known; omit it for a
 * mixed-category aggregate, where a single per-item category wouldn't apply anyway.
 */
function resolveTaxExempt(guestId?: string, forceExempt?: boolean): boolean | undefined {
  if (forceExempt) return true;
  if (!guestId) return undefined;
  return frontOfficeStore.reservations.find(r => r.guestId === guestId)?.taxExempt;
}
function serviceChargeGross(amount: number, description?: string, guestId?: string, forceExempt?: boolean): number {
  return Math.round((amount + computeChargeTax(amount, description, undefined, resolveTaxExempt(guestId, forceExempt))) * 100) / 100;
}
function serviceChargeTax(amount: number, description?: string, guestId?: string, forceExempt?: boolean): number {
  return computeChargeTax(amount, description, undefined, resolveTaxExempt(guestId, forceExempt));
}

interface ServiceCharge {
  id: string;
  guestId: string;
  guestName: string;
  roomNumber: string;
  category: string;
  description: string;
  amount: number;
  quantity: number;
  date: string;
  status: 'pending' | 'approved' | 'billed' | 'paid';
  notes?: string;
  createdBy: string;
  // Per-charge exemption override set from the Add Service Charge modal's Tax Exempt
  // toggle — only ever adds exemption on top of whatever the reservation itself has.
  taxExempt?: boolean;
}

const SERVICE_CHARGES_DASHBOARD_SECTIONS: DashboardSectionDef[] = [
  { id: 'totalCharges', label: 'Total Charges (incl. tax)' },
  { id: 'paidAmount', label: 'Paid Amount (incl. tax)' },
  { id: 'outstanding', label: 'Outstanding (incl. tax)' },
  { id: 'paidTotal', label: 'Paid/Total' },
];

export default function ServiceChargesPage() {
  const currentUserName = useCurrentUserName();
  const { isHidden, hide, toggle: toggleStatSection, showAll: showAllStats, hiddenCount: hiddenStatsCount } =
    useDashboardVisibility('dashboard.hidden.serviceCharges', SERVICE_CHARGES_DASHBOARD_SECTIONS);
  const { roomManagement } = useSettingsStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [dateFilterMode, setDateFilterMode] = useState<'all' | 'today' | 'specific' | 'range'>('today');
  const [dateFilterSingle, setDateFilterSingle] = useState('');
  const [dateFilterFrom, setDateFilterFrom] = useState('');
  const [dateFilterTo, setDateFilterTo] = useState('');
  const [selectedCharge, setSelectedCharge] = useState<ServiceCharge | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const receiptTemplates = useMemo(() => listTemplates('receipt'), []);
  const [receiptTpl, setReceiptTpl] = useState<string>(receiptTemplates[0]?.key || 'simple-receipt');

  // Form state
  const [formData, setFormData] = useState({
    guestId: '',
    roomNumber: '',
    category: '',
    description: '',
    amount: 0,
    quantity: 1,
    discountAmount: 0,
    notes: '',
    customerType: 'inhouse', // 'inhouse' or 'external'
    taxExempt: false
  });

  // External guest form state
  const [externalGuestData, setExternalGuestData] = useState({
    name: '',
    phone: '',
    email: '',
    company: ''
  });

  // Payment form state
  const [paymentData, setPaymentData] = useState({
    amount: 0,
    paymentMethod: 'cash',
    reference: '',
    notes: ''
  });

  // Get service charges from settings store
  const serviceChargesConfig = roomManagement.serviceCharges || [];

  // Get available guests (checked-in only) — subscribe so list updates on new check-ins
  const [storeVersion, setStoreVersion] = useState(0);
  useEffect(() => {
    const unsub = frontOfficeStore.subscribe(() => setStoreVersion(v => v + 1));
    return unsub;
  }, []);
  const availableGuests = useMemo(() => {
    return frontOfficeStore.reservations
      .filter(r => r.status === 'checked-in' && r.roomId && r.roomId !== 'TBD')
      .map(r => ({
        guestId: r.guestId,
        guestName: r.guestName,
        roomNumber: r.roomId,
        roomType: frontOfficeStore.roomTypes.find(rt => rt.id === r.roomTypeId)?.name || 'Unknown'
      }))
      .filter((guest, index, self) =>
        index === self.findIndex(g => g.guestId === guest.guestId)
      );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeVersion]);

  // Mock service charges data (in real app, this would come from a store)
  const [serviceCharges, setServiceCharges] = useState<ServiceCharge[]>([]);

  // Get categories from settings
  const categories = useMemo(() => {
    const uniqueCategories = [...new Set(serviceChargesConfig.map(charge => charge.category))];
    return uniqueCategories.sort();
  }, [serviceChargesConfig]);

  // Filtered charges
  const filteredCharges = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return serviceCharges.filter(charge => {
      const matchesSearch = charge.guestName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           charge.roomNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           charge.description.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || charge.status === statusFilter;
      const matchesCategory = categoryFilter === 'all' || charge.category === categoryFilter;
      const chargeDate = charge.date?.slice(0, 10) ?? '';
      let matchesDate = true;
      if (dateFilterMode === 'today') {
        matchesDate = chargeDate === today;
      } else if (dateFilterMode === 'specific' && dateFilterSingle) {
        matchesDate = chargeDate === dateFilterSingle;
      } else if (dateFilterMode === 'range') {
        if (dateFilterFrom && chargeDate < dateFilterFrom) matchesDate = false;
        if (dateFilterTo   && chargeDate > dateFilterTo)   matchesDate = false;
      }
      return matchesSearch && matchesStatus && matchesCategory && matchesDate;
    });
  }, [serviceCharges, searchTerm, statusFilter, categoryFilter, dateFilterMode, dateFilterSingle, dateFilterFrom, dateFilterTo]);

  // Pagination state
  const [page, setPage] = useState(1);
  const rowsPerPage = 10;

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const selectedCategory = serviceChargesConfig.find(c => c.id === formData.category);
    if (!selectedCategory) return;

    // Calculate final amount with discount
    const maxDiscount = (selectedCategory.basePrice * selectedCategory.maxDiscountPercent) / 100;
    const finalDiscount = Math.min(formData.discountAmount, maxDiscount);
    const finalAmount = (formData.amount - finalDiscount) * formData.quantity;

    let guestName = '';
    let roomNumber = '';

    if (formData.customerType === 'inhouse') {
      const selectedGuest = availableGuests.find(g => g.guestId === formData.guestId);
      if (!selectedGuest) return;
      guestName = selectedGuest.guestName;
      roomNumber = selectedGuest.roomNumber || '';
    } else {
      // External guest
      if (!externalGuestData.name.trim()) {
        alert('Please enter external guest name');
        return;
      }
      guestName = externalGuestData.name;
      roomNumber = 'External';
    }

    const newCharge: ServiceCharge = {
      id: `SC-${Date.now()}`,
      guestId: formData.customerType === 'inhouse' ? (formData.guestId || '') : `EXT-${Date.now()}`,
      guestName: guestName,
      roomNumber: roomNumber,
      category: formData.category,
      description: formData.description,
      amount: finalAmount,
      quantity: formData.quantity,
      date: new Date().toISOString(),
      status: 'pending',
      notes: formData.notes,
      createdBy: 'Current User', // In real app, get from auth context
      taxExempt: formData.taxExempt
    };

    setServiceCharges(prev => [newCharge, ...prev]);
    
    // Add to guest folio (only for in-house guests)
    if (formData.customerType === 'inhouse') {
      const reservation = frontOfficeStore.reservations.find(r => 
        r.guestId === formData.guestId && r.status === 'checked-in'
      );
      
      if (reservation) {
        // Use the store's addCharge method which automatically calculates taxes
        frontOfficeStore.addCharge(
          reservation.id,
          `${formData.description} (${formData.quantity}x)`,
          finalAmount,
          formData.taxExempt
        );
      }
    }

    // Track event
    trackEvent('FO.ServiceCharge.Created' as any, {
      chargeId: newCharge.id,
      guestId: formData.guestId,
      roomNumber: formData.customerType === 'inhouse' ? formData.roomNumber : 'External',
      category: formData.category,
      amount: finalAmount,
      customerType: formData.customerType
    }, { sourceModule: 'Guest Services' });

    resetAddForm();
  };

  // Reset the Add Service Charge form (used on successful submit, and before
  // reopening the modal, so a prior guest/category selection can never carry
  // over into the next charge).
  const resetAddForm = () => {
    setFormData({
      guestId: '',
      roomNumber: '',
      category: '',
      description: '',
      amount: 0,
      quantity: 1,
      discountAmount: 0,
      notes: '',
      customerType: 'inhouse',
      taxExempt: false
    });
    setExternalGuestData({
      name: '',
      phone: '',
      email: '',
      company: ''
    });
    setIsAddModalOpen(false);
  };

  // Handle category selection
  const handleCategorySelect = (categoryId: string) => {
    const category = serviceChargesConfig.find(c => c.id === categoryId);
    if (category) {
      setFormData(prev => ({
        ...prev,
        category: categoryId,
        description: category.name,
        amount: category.basePrice,
        discountAmount: 0
      }));
    } else {
      setFormData(prev => ({ ...prev, category: '', description: '', amount: 0, discountAmount: 0 }));
    }
  };

  // Handle guest selection
  const handleGuestSelect = (guestId: string) => {
    const guest = availableGuests.find(g => g.guestId === guestId);
    if (guest) {
      setFormData(prev => ({
        ...prev,
        guestId,
        roomNumber: guest.roomNumber || ''
      }));
    } else {
      setFormData(prev => ({ ...prev, guestId: '', roomNumber: '' }));
    }
  };

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'warning';
      case 'approved': return 'primary';
      case 'billed': return 'secondary';
      case 'paid': return 'success';
      default: return 'default';
    }
  };

  // Get category info
  const getCategoryInfo = (categoryId: string) => {
    return serviceChargesConfig.find(c => c.id === categoryId) || { name: 'Unknown', icon: '❓', basePrice: 0 };
  };

  // Get unit label
  const getUnitLabel = (unit: string) => {
    const unitLabels = {
      'per_item': 'per item',
      'per_hour': 'per hour',
      'per_day': 'per day',
      'per_person': 'per person',
      'per_order': 'per order',
      'per_session': 'per session',
      'per_trip': 'per trip',
      'fixed': 'fixed'
    };
    return unitLabels[unit as keyof typeof unitLabels] || unit;
  };

  // Fixed-layout internal slip (Guest Info / Charge Details, mirroring the View modal) --
  // built and opened directly rather than via openPrintPreview, same reasoning as
  // handlePrintFolio in invoices-payments/page.tsx: this isn't a guest-facing invoice a
  // tenant reformats, it always looks the same with just the org's own header on top.
  const handlePrintServiceCharge = (charge: ServiceCharge) => {
    const org = buildOrgProfile(useSettingsStore.getState());
    const gross = serviceChargeGross(charge.amount, charge.description, charge.guestId, charge.taxExempt);
    const tax = serviceChargeTax(charge.amount, charge.description, charge.guestId, charge.taxExempt);
    const categoryInfo = getCategoryInfo(charge.category);
    const fmt = (n: number) => `₵${formatMoney(n)}`;

    const html = `
    <!doctype html><html><head><meta charset="utf-8" />
    <title>Service Charge — ${charge.guestName}</title>
    <style>
      :root { --fg:#111; --muted:#555; --border:#ddd; }
      * { box-sizing:border-box; }
      body { font-family: Arial, system-ui, -apple-system, Segoe UI, Roboto, "Helvetica Neue", sans-serif; color:var(--fg); margin:0; padding:24px; }
      h1,h2 { margin:0; }
      .header { text-align:center; border-bottom:2px solid var(--border); padding-bottom:16px; margin-bottom:16px; }
      .logo { max-width:120px; max-height:80px; object-fit:contain; margin-bottom:8px; }
      .org-name { font-size:1.4em; font-weight:700; }
      .org-detail { font-size:12px; color:var(--muted); margin-top:2px; }
      .doc-title { text-align:center; font-size:1.2em; font-weight:700; margin:4px 0 20px; text-decoration:underline; }
      .section { margin-bottom:20px; }
      .section-title { font-size:1.05em; font-weight:700; margin-bottom:10px; border-bottom:1px solid var(--border); padding-bottom:4px; }
      .grid { display:grid; grid-template-columns: repeat(3, 1fr); gap:12px; }
      .field-label { font-size:11px; color:var(--muted); }
      .field-value { font-weight:600; margin-top:2px; }
      table { width:100%; border-collapse:collapse; margin-top:8px; font-size:13px; }
      th, td { border:1px solid var(--border); padding:8px; text-align:left; }
      th { background:#f7f7f7; }
      .right { text-align:right; }
      .total-row td { font-weight:700; font-size:1.1em; }
      .footer { margin-top:24px; font-size:11px; color:var(--muted); text-align:center; }
      @media print { body { padding:0; } }
    </style>
    </head><body>
      <div class="header">
        ${org.logoUrl ? `<img class="logo" src="${org.logoUrl}" />` : ''}
        <div class="org-name">${org.name || ''}</div>
        <div class="org-detail">${[org.address, org.phone, org.email].filter(Boolean).join(' • ')}</div>
      </div>

      <div class="doc-title">Service Charge Slip</div>

      <div class="section">
        <div class="section-title">Guest Information</div>
        <div class="grid">
          <div><div class="field-label">Customer</div><div class="field-value">${charge.guestName}</div></div>
          <div><div class="field-label">Type</div><div class="field-value">${charge.roomNumber === 'External' ? 'External Customer' : 'In-House Guest'}</div></div>
          <div><div class="field-label">Room/Reference</div><div class="field-value">${charge.roomNumber === 'External' ? 'External Service' : `Room ${charge.roomNumber}`}</div></div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">Charge Details</div>
        <table>
          <thead><tr><th>Category</th><th>Description</th><th class="right">Qty</th><th class="right">Unit Price</th><th class="right">Amount</th></tr></thead>
          <tbody>
            <tr>
              <td>${categoryInfo.icon} ${categoryInfo.name}</td>
              <td>${charge.description}</td>
              <td class="right">${charge.quantity}</td>
              <td class="right">${fmt(charge.quantity > 0 ? gross / charge.quantity : gross)}</td>
              <td class="right">${fmt(gross)}</td>
            </tr>
            <tr><td colspan="4" class="right">Subtotal (excl. tax)</td><td class="right">${fmt(charge.amount)}</td></tr>
            <tr><td colspan="4" class="right">Tax</td><td class="right">${fmt(tax)}</td></tr>
            <tr class="total-row"><td colspan="4" class="right">Total (incl. tax)</td><td class="right">${fmt(gross)}</td></tr>
          </tbody>
        </table>
      </div>

      ${charge.notes ? `<div class="section"><div class="section-title">Notes</div><div>${charge.notes}</div></div>` : ''}

      <div class="footer">Status: ${charge.status.toUpperCase()} • Created by ${charge.createdBy} on ${new Date(charge.date).toLocaleString()} • Printed ${new Date().toLocaleString()}</div>
    </body></html>`;

    openHtmlPrintWindow(html);
    try { trackEvent('Print.ServiceCharge' as any, { chargeId: charge.id, guestName: charge.guestName }); } catch {}
  };

  // Handle payment processing
  const handlePayment = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedCharge) return;

    // Update charge status to paid
    setServiceCharges(prev => 
      prev.map(charge => 
        charge.id === selectedCharge.id 
          ? { ...charge, status: 'paid' as const }
          : charge
      )
    );

    // Add payment to folio for in-house guests
    if (selectedCharge.roomNumber !== 'External') {
      const reservation = frontOfficeStore.reservations.find(r => 
        r.guestId === selectedCharge.guestId && r.status === 'checked-in'
      );
      
      if (reservation) {
        frontOfficeStore.addPayment(
          reservation.id,
          paymentData.paymentMethod as 'Cash' | 'Card' | 'Mobile Money' | 'Credit' | 'Corporate Account' | 'Bank Transfer' | 'Check',
          paymentData.amount,
          {
            notes: `Payment for ${selectedCharge.description}`,
            processedBy: currentUserName,
            ref: paymentData.reference || undefined
          }
        );
      }
    }

    // Track payment event
    trackEvent('FO.ServiceCharge.PaymentProcessed' as any, {
      chargeId: selectedCharge.id,
      amount: paymentData.amount,
      paymentMethod: paymentData.paymentMethod,
      customerType: selectedCharge.roomNumber === 'External' ? 'external' : 'inhouse'
    }, { sourceModule: 'Guest Services' });

    // Reset payment form and close modal
    setPaymentData({
      amount: 0,
      paymentMethod: 'cash',
      reference: '',
      notes: ''
    });
    setIsPaymentModalOpen(false);
  };

  // Handle payment button click
  const handlePaymentClick = (charge: ServiceCharge) => {
    setSelectedCharge(charge);
    setPaymentData(prev => ({
      ...prev,
      amount: serviceChargeGross(charge.amount, charge.description, charge.guestId, charge.taxExempt)
    }));
    setIsPaymentModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-ghana-black">Service Charges Management</h1>
          <p className="text-gray-600">Manage additional charges for guests (swimming pool, laundry, spa, etc.)</p>
        </div>
        <div className="flex gap-2">
          <CustomizeViewControl
            sections={SERVICE_CHARGES_DASHBOARD_SECTIONS}
            isHidden={isHidden}
            toggle={toggleStatSection}
            showAll={showAllStats}
            hiddenCount={hiddenStatsCount}
          />
          <Button
            color="primary"
            onClick={() => {
              setFormData({
                guestId: '',
                roomNumber: '',
                category: '',
                description: '',
                amount: 0,
                quantity: 1,
                discountAmount: 0,
                notes: '',
                customerType: 'inhouse',
                taxExempt: false
              });
              setExternalGuestData({ name: '', phone: '', email: '', company: '' });
              setIsAddModalOpen(true);
            }}
            className="bg-ghana-gold text-white"
          >
            ➕ Add Service Charge
          </Button>
          <Button 
            color="secondary" 
            variant="flat"
            onClick={() => alert('Room and event pricing is managed in Settings > Rooms & Pricing')}
          >
            ⚙️ Manage Pricing
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardBody className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-4">
            <Input
              placeholder="Search by guest name, room number, or description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1"
              startContent={<span className="text-gray-400">🔍</span>}
            />
            <Select
              placeholder="Filter by status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full sm:w-48"
            >
              <SelectItem key="all">All Statuses</SelectItem>
              <SelectItem key="pending">⏳ Pending</SelectItem>
              <SelectItem key="approved">✅ Approved</SelectItem>
              <SelectItem key="billed">📄 Billed</SelectItem>
              <SelectItem key="paid">💳 Paid</SelectItem>
            </Select>
            <Select
              placeholder="Filter by category"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full sm:w-48"
            >
              <SelectItem key="all">All Categories</SelectItem>
              <>
                {categories.map(category =>
                  <SelectItem key={category} textValue={category}>
                    {category}
                  </SelectItem>
                )}
              </>
            </Select>
          </div>
          {/* Date filter pills */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-gray-500 mr-1">📅 Charge Date:</span>
            {(['all', 'today', 'specific', 'range'] as const).map((mode) => {
              const labels: Record<string, string> = { all: 'All Dates', today: 'Today', specific: 'Specific Date', range: 'Date Range' };
              return (
                <button key={mode} onClick={() => setDateFilterMode(mode)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${dateFilterMode === mode ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400 hover:text-blue-600'}`}
                >{labels[mode]}</button>
              );
            })}
            {dateFilterMode === 'specific' && (
              <input type="date" value={dateFilterSingle} onChange={(e) => setDateFilterSingle(e.target.value)}
                className="ml-2 px-2 py-1 rounded border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
            )}
            {dateFilterMode === 'range' && (
              <div className="flex items-center gap-2 ml-2">
                <input type="date" value={dateFilterFrom} onChange={(e) => setDateFilterFrom(e.target.value)}
                  className="px-2 py-1 rounded border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                <span className="text-gray-400 text-sm">→</span>
                <input type="date" value={dateFilterTo} onChange={(e) => setDateFilterTo(e.target.value)}
                  className="px-2 py-1 rounded border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
            )}
          </div>
        </CardBody>
      </Card>

      {/* Payment Summary — totals reflect the active filter so cards match table rows */}
      {hiddenStatsCount < SERVICE_CHARGES_DASHBOARD_SECTIONS.length && (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {!isHidden('totalCharges') && (
        <Card className="relative">
          <CardBody className="text-center">
            <div className="absolute top-2 right-2">
              <HideCardButton onHide={() => hide('totalCharges')} label="Total Charges (incl. tax)" />
            </div>
            <div className="text-2xl font-bold text-blue-600">
              ₵{formatMoney(filteredCharges.reduce((sum, charge) => sum + serviceChargeGross(charge.amount, charge.description, charge.guestId, charge.taxExempt), 0))}
            </div>
            <div className="text-sm text-gray-600">Total Charges (incl. tax)</div>
          </CardBody>
        </Card>
        )}
        {!isHidden('paidAmount') && (
        <Card className="relative">
          <CardBody className="text-center">
            <div className="absolute top-2 right-2">
              <HideCardButton onHide={() => hide('paidAmount')} label="Paid Amount (incl. tax)" />
            </div>
            <div className="text-2xl font-bold text-green-600">
              ₵{formatMoney(filteredCharges.filter(c => c.status === 'paid').reduce((sum, charge) => sum + serviceChargeGross(charge.amount, charge.description, charge.guestId, charge.taxExempt), 0))}
            </div>
            <div className="text-sm text-gray-600">Paid Amount (incl. tax)</div>
          </CardBody>
        </Card>
        )}
        {!isHidden('outstanding') && (
        <Card className="relative">
          <CardBody className="text-center">
            <div className="absolute top-2 right-2">
              <HideCardButton onHide={() => hide('outstanding')} label="Outstanding (incl. tax)" />
            </div>
            <div className="text-2xl font-bold text-orange-600">
              ₵{formatMoney(filteredCharges.filter(c => c.status !== 'paid').reduce((sum, charge) => sum + serviceChargeGross(charge.amount, charge.description, charge.guestId, charge.taxExempt), 0))}
            </div>
            <div className="text-sm text-gray-600">Outstanding (incl. tax)</div>
          </CardBody>
        </Card>
        )}
        {!isHidden('paidTotal') && (
        <Card className="relative">
          <CardBody className="text-center">
            <div className="absolute top-2 right-2">
              <HideCardButton onHide={() => hide('paidTotal')} label="Paid/Total" />
            </div>
            <div className="text-2xl font-bold text-purple-600">
              {filteredCharges.filter(c => c.status === 'paid').length}/{filteredCharges.length}
            </div>
            <div className="text-sm text-gray-600">Paid/Total</div>
          </CardBody>
        </Card>
        )}
      </div>
      )}

      {/* Service Charges Table */}
      <Card>
        <CardBody>
          <Table aria-label="Service charges table">
            <TableHeader>
              <TableColumn>CUSTOMER</TableColumn>
              <TableColumn>TYPE</TableColumn>
              <TableColumn>ROOM/REF</TableColumn>
              <TableColumn>CATEGORY</TableColumn>
              <TableColumn>DESCRIPTION</TableColumn>
              <TableColumn>AMOUNT</TableColumn>
              <TableColumn>STATUS</TableColumn>
              <TableColumn>DATE</TableColumn>
              <TableColumn>ACTIONS</TableColumn>
            </TableHeader>
            <TableBody emptyContent={<div className="text-center text-gray-500 py-8">No service charges found</div>}>
              {filteredCharges.length === 0 ? [] as any : (
                filteredCharges
                  .slice((page - 1) * rowsPerPage, page * rowsPerPage)
                  .map((charge) => {
                  const categoryInfo = getCategoryInfo(charge.category);
                  const isExternal = charge.roomNumber === 'External';
                  return (
                    <TableRow key={charge.id}>
                      <TableCell>
                        <div className="font-medium">{charge.guestName}</div>
                        {isExternal && (
                          <div className="text-xs text-gray-500">External Customer</div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge 
                          color={isExternal ? 'secondary' : 'primary'} 
                          variant="flat"
                        >
                          {isExternal ? 'External' : 'In-House'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge color="primary" variant="flat">
                          {isExternal ? 'External' : `Room ${charge.roomNumber}`}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Chip size="sm" variant="flat">
                          {categoryInfo.icon} {categoryInfo.name}
                        </Chip>
                      </TableCell>
                      <TableCell>
                        <div className="max-w-xs truncate">{charge.description}</div>
                        {charge.quantity > 1 && (
                          <div className="text-sm text-gray-500">Qty: {charge.quantity}</div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="font-semibold">₵{formatMoney(serviceChargeGross(charge.amount, charge.description, charge.guestId, charge.taxExempt))}</div>
                        {charge.quantity > 1 && (
                          <div className="text-xs text-gray-500">
                            ₵{formatMoney(serviceChargeGross(charge.amount / charge.quantity, charge.description, charge.guestId, charge.taxExempt))} / unit
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold
                          ${charge.status === 'paid' ? 'bg-green-100 text-green-700 border border-green-200'
                          : charge.status === 'approved' ? 'bg-blue-100 text-blue-700 border border-blue-200'
                          : charge.status === 'billed' ? 'bg-purple-100 text-purple-700 border border-purple-200'
                          : 'bg-amber-100 text-amber-700 border border-amber-200'}`}>
                          <span className={`w-1.5 h-1.5 rounded-full
                            ${charge.status === 'paid' ? 'bg-green-500'
                            : charge.status === 'approved' ? 'bg-blue-500'
                            : charge.status === 'billed' ? 'bg-purple-500'
                            : 'bg-amber-500'}`} />
                          {charge.status.charAt(0).toUpperCase() + charge.status.slice(1)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {new Date(charge.date).toLocaleDateString()}
                        </div>
                        <div className="text-xs text-gray-500">
                          {new Date(charge.date).toLocaleTimeString()}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            color="primary"
                            variant="solid"
                            className="bg-blue-600 text-white font-semibold px-3 py-1"
                            onClick={() => {
                              setSelectedCharge(charge);
                              setIsViewModalOpen(true);
                            }}
                          >
                            View
                          </Button>
                          {charge.status !== 'paid' && (
                            <Button
                              size="sm"
                              color="success"
                              variant="solid"
                              className="bg-green-600 text-white font-semibold px-3 py-1"
                              onClick={() => handlePaymentClick(charge)}
                            >
                              Pay
                            </Button>
                          )}
                          <Button
                            size="sm"
                            color="default"
                            variant="solid"
                            className="bg-gray-600 text-white font-semibold px-3 py-1"
                            onClick={() => {
                              setSelectedCharge(charge);
                              setIsEditModalOpen(true);
                            }}
                          >
                            Edit
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
          <div className="flex justify-end mt-3">
            <Pagination
              page={page}
              total={Math.max(1, Math.ceil(filteredCharges.length / rowsPerPage))}
              onChange={setPage}
              showControls
              size="sm"
            />
          </div>
        </CardBody>
      </Card>

      {/* Add Service Charge Modal */}
      <Modal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} size="2xl">
        <ModalContent>
          <ModalHeader>Add Service Charge</ModalHeader>
          <form onSubmit={handleSubmit}>
            <ModalBody className="space-y-4">
              {/* Customer Type Selection */}
              <div className="mb-4">
                <label className="text-sm font-medium text-gray-700 mb-2 block">Customer Type</label>
                <div className="flex gap-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="customerType"
                      value="inhouse"
                      checked={formData.customerType === 'inhouse'}
                      onChange={(e) => setFormData(prev => ({ ...prev, customerType: e.target.value }))}
                      className="mr-2"
                    />
                    <span className="text-sm">🏠 In-House Guest</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="customerType"
                      value="external"
                      checked={formData.customerType === 'external'}
                      onChange={(e) => setFormData(prev => ({ ...prev, customerType: e.target.value }))}
                      className="mr-2"
                    />
                    <span className="text-sm">👤 External Customer</span>
                  </label>
                </div>
              </div>

              {/* Guest Selection - In-House */}
              {formData.customerType === 'inhouse' && (
                <Select
                  label="Guest & Room"
                  placeholder="Select in-house guest"
                  selectedKeys={formData.guestId ? [formData.guestId] : []}
                  onSelectionChange={(keys) => handleGuestSelect(Array.from(keys)[0] as string || '')}
                  isRequired
                >
                  {availableGuests.map(guest => (
                    <SelectItem key={guest.guestId} textValue={`${guest.guestName} - Room ${guest.roomNumber}`}>
                      {guest.guestName} - Room {guest.roomNumber} ({guest.roomType})
                    </SelectItem>
                  ))}
                </Select>
              )}

              {/* External Guest Form */}
              {formData.customerType === 'external' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Customer Name"
                    placeholder="Enter customer name"
                    value={externalGuestData.name}
                    onChange={(e) => setExternalGuestData(prev => ({ ...prev, name: e.target.value }))}
                    isRequired
                  />
                  <Input
                    label="Phone Number"
                    placeholder="Enter phone number"
                    value={externalGuestData.phone}
                    onChange={(e) => setExternalGuestData(prev => ({ ...prev, phone: e.target.value }))}
                  />
                  <Input
                    label="Email Address"
                    placeholder="Enter email address"
                    type="email"
                    value={externalGuestData.email}
                    onChange={(e) => setExternalGuestData(prev => ({ ...prev, email: e.target.value }))}
                  />
                  <Input
                    label="Company (Optional)"
                    placeholder="Enter company name"
                    value={externalGuestData.company}
                    onChange={(e) => setExternalGuestData(prev => ({ ...prev, company: e.target.value }))}
                  />
                </div>
              )}

              <Select
                label="Service Category"
                placeholder="Select category"
                selectedKeys={formData.category ? [formData.category] : []}
                onSelectionChange={(keys) => handleCategorySelect(Array.from(keys)[0] as string || '')}
                isRequired
              >
                {serviceChargesConfig.map(category => (
                  <SelectItem key={category.id} textValue={`${category.name} - ₵${category.basePrice}`}>
                    {category.icon} {category.name} - ₵{category.basePrice} {getUnitLabel(category.unit)}
                  </SelectItem>
                ))}
              </Select>

              <Input
                label="Description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                isRequired
              />

              <div className="grid grid-cols-3 gap-4">
                <Input
                  label="Amount per Unit"
                  type="number"
                  value={formData.amount.toString()}
                  onChange={(e) => setFormData(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))}
                  isRequired
                  isReadOnly
                  description="Pricing managed in Settings"
                />
                <Input
                  label="Quantity"
                  type="number"
                  value={formData.quantity.toString()}
                  onChange={(e) => setFormData(prev => ({ ...prev, quantity: parseInt(e.target.value) || 1 }))}
                  isRequired
                />
                <Input
                  label="Discount Amount (GHS)"
                  type="number"
                  value={formData.discountAmount.toString()}
                  onChange={(e) => setFormData(prev => ({ ...prev, discountAmount: parseFloat(e.target.value) || 0 }))}
                  description={`Max: ₵${formData.category ? ((serviceChargesConfig.find(c => c.id === formData.category)?.basePrice || 0) * (serviceChargesConfig.find(c => c.id === formData.category)?.maxDiscountPercent || 0)) / 100 : 0}`}
                />
              </div>

              <Textarea
                label="Notes (Optional)"
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Additional notes about this charge..."
              />

              <div className="flex items-center justify-between p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <div>
                  <div className="text-sm font-medium text-amber-900">Tax Exempt</div>
                  <div className="text-xs text-amber-700">Post this charge with no tax, regardless of the guest's own status</div>
                </div>
                <Switch
                  isSelected={formData.taxExempt}
                  onValueChange={(val) => setFormData(prev => ({ ...prev, taxExempt: val }))}
                />
              </div>

              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="text-sm text-blue-800">
                  <div className="font-medium">
                    Total Amount: ₵{((formData.amount - formData.discountAmount) * formData.quantity).toLocaleString()}
                    {formData.discountAmount > 0 && (
                      <span className="text-green-600 ml-2">
                        (₵{(formData.amount * formData.quantity).toLocaleString()} - ₵{formData.discountAmount} discount)
                      </span>
                    )}
                  </div>
                  <div className="text-xs">This charge will be added to the guest's folio</div>
                </div>
              </div>
            </ModalBody>
            <ModalFooter>
              <Button variant="light" onPress={() => setIsAddModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" color="primary" className="bg-ghana-gold text-white">
                Add Charge
              </Button>
            </ModalFooter>
          </form>
        </ModalContent>
      </Modal>

      {/* View Service Charge Modal */}
      <Modal isOpen={isViewModalOpen} onClose={() => setIsViewModalOpen(false)} size="lg" scrollBehavior="inside">
        <ModalContent>
          <ModalHeader className="bg-gradient-to-r from-ghana-green to-emerald-700 text-white">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center text-xl">
                {selectedCharge ? getCategoryInfo(selectedCharge.category).icon : '🧾'}
              </div>
              <div>
                <h2 className="text-xl font-bold">Service Charge Details</h2>
                <p className="text-white/80 text-sm">
                  {selectedCharge?.guestName || 'Unknown Guest'} •{' '}
                  {selectedCharge?.roomNumber === 'External' ? 'External Service' : `Room ${selectedCharge?.roomNumber || 'TBD'}`}
                </p>
              </div>
            </div>
          </ModalHeader>
          <ModalBody className="py-4">
            {selectedCharge ? (
              <div className="space-y-4">
                <Card>
                  <CardHeader className="pb-0">
                    <h4 className="text-sm font-semibold text-gray-700">Guest Information</h4>
                  </CardHeader>
                  <CardBody>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs text-gray-500">Customer Type</label>
                        <div className="mt-1">
                          <Badge color={selectedCharge.roomNumber === 'External' ? 'secondary' : 'primary'} variant="flat">
                            {selectedCharge.roomNumber === 'External' ? 'External Customer' : 'In-House Guest'}
                          </Badge>
                        </div>
                      </div>
                      <div>
                        <label className="text-xs text-gray-500">Status</label>
                        <div className="mt-1">
                          <Badge color={getStatusColor(selectedCharge.status)} variant="flat">
                            {selectedCharge.status.toUpperCase()}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </CardBody>
                </Card>

                <Card>
                  <CardHeader className="pb-0">
                    <h4 className="text-sm font-semibold text-gray-700">Charge Details</h4>
                  </CardHeader>
                  <CardBody className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs text-gray-500">Category</label>
                        <div className="flex items-center gap-2 font-medium">
                          <span>{getCategoryInfo(selectedCharge.category).icon}</span>
                          <span>{getCategoryInfo(selectedCharge.category).name}</span>
                        </div>
                      </div>
                      <div>
                        <label className="text-xs text-gray-500">Description</label>
                        <div className="font-medium">{selectedCharge.description}</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <label className="text-xs text-gray-500">Unit Price (incl. tax)</label>
                        <div className="font-medium">
                          ₵{formatMoney(serviceChargeGross(
                            selectedCharge.quantity > 0 ? selectedCharge.amount / selectedCharge.quantity : selectedCharge.amount,
                            selectedCharge.description,
                            selectedCharge.guestId,
                            selectedCharge.taxExempt
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="text-xs text-gray-500">Quantity</label>
                        <div className="font-medium">{selectedCharge.quantity}</div>
                      </div>
                    </div>

                    <Divider />

                    <div className="bg-default-50 rounded-lg p-3 flex items-center justify-between">
                      <div>
                        <div className="text-xs text-gray-500">Total Amount (incl. tax)</div>
                        <div className="text-xs text-gray-500">
                          Excl. tax: ₵{formatMoney(selectedCharge.amount)} + ₵{formatMoney(serviceChargeTax(selectedCharge.amount, selectedCharge.description, selectedCharge.guestId, selectedCharge.taxExempt))} tax
                        </div>
                      </div>
                      <div className="text-2xl font-bold text-ghana-gold">
                        ₵{formatMoney(serviceChargeGross(selectedCharge.amount, selectedCharge.description, selectedCharge.guestId, selectedCharge.taxExempt))}
                      </div>
                    </div>

                    {selectedCharge.notes && (
                      <div>
                        <label className="text-xs text-gray-500">Notes</label>
                        <div>{selectedCharge.notes}</div>
                      </div>
                    )}
                  </CardBody>
                </Card>

                <div className="text-xs text-gray-500 text-center">
                  Created by {selectedCharge.createdBy} on {new Date(selectedCharge.date).toLocaleDateString()} at{' '}
                  {new Date(selectedCharge.date).toLocaleTimeString()}
                </div>
              </div>
            ) : (
              <div className="text-center text-gray-500 py-4">
                No service charge selected
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={() => setIsViewModalOpen(false)}>
              Close
            </Button>
            <Button
              variant="flat"
              className="bg-ghana-green text-white"
              isDisabled={!selectedCharge}
              onPress={() => selectedCharge && handlePrintServiceCharge(selectedCharge)}
            >
              🖨️ Print
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Payment Modal */}
      <Modal isOpen={isPaymentModalOpen} onClose={() => setIsPaymentModalOpen(false)} size="lg">
        <ModalContent>
          <ModalHeader>Process Payment</ModalHeader>
          <form onSubmit={handlePayment}>
            <ModalBody className="space-y-4">
              {selectedCharge && (
                <div className="space-y-4">
                  {/* Charge Summary */}
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h3 className="font-semibold text-gray-900 mb-2">Charge Details</h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">Customer:</span>
                        <div className="font-medium">{selectedCharge.guestName}</div>
                      </div>
                      <div>
                        <span className="text-gray-600">Type:</span>
                        <div className="font-medium">
                          {selectedCharge.roomNumber === 'External' ? 'External' : 'In-House'}
                        </div>
                      </div>
                      <div>
                        <span className="text-gray-600">Description:</span>
                        <div className="font-medium">{selectedCharge.description}</div>
                      </div>
                      <div>
                        <span className="text-gray-600">Amount (incl. tax):</span>
                        <div className="font-medium text-lg text-ghana-gold">
                          ₵{formatMoney(serviceChargeGross(selectedCharge.amount, selectedCharge.description, selectedCharge.guestId, selectedCharge.taxExempt))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Payment Form */}
                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      label="Payment Amount (GHS)"
                      type="number"
                      value={paymentData.amount.toString()}
                      onChange={(e) => setPaymentData(prev => ({ 
                        ...prev, 
                        amount: parseFloat(e.target.value) || 0 
                      }))}
                      isRequired
                      description="Enter the amount being paid"
                    />
                    <Select
                      label="Payment Method"
                      value={paymentData.paymentMethod}
                      onChange={(e) => setPaymentData(prev => ({ 
                        ...prev, 
                        paymentMethod: e.target.value 
                      }))}
                      isRequired
                    >
                      <SelectItem key="cash">💵 Cash</SelectItem>
                      <SelectItem key="card">💳 Card</SelectItem>
                      <SelectItem key="mobile_money">📱 Mobile Money</SelectItem>
                      <SelectItem key="bank_transfer">🏦 Bank Transfer</SelectItem>
                      <SelectItem key="check">📝 Check</SelectItem>
                      <SelectItem key="corporate_account">🏢 Corporate Account</SelectItem>
                    </Select>
                  </div>

                  <Input
                    label="Reference/Transaction ID"
                    value={paymentData.reference}
                    onChange={(e) => setPaymentData(prev => ({ 
                      ...prev, 
                      reference: e.target.value 
                    }))}
                    placeholder="Enter transaction reference or check number"
                  />

                  <Textarea
                    label="Payment Notes (Optional)"
                    value={paymentData.notes}
                    onChange={(e) => setPaymentData(prev => ({ 
                      ...prev, 
                      notes: e.target.value 
                    }))}
                    placeholder="Additional notes about this payment..."
                    rows={3}
                  />

                  {/* Payment Summary */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-blue-900">Total Payment:</span>
                      <span className="text-xl font-bold text-blue-900">
                        ₵{paymentData.amount.toLocaleString()}
                      </span>
                    </div>
                    {(() => {
                      const due = serviceChargeGross(selectedCharge.amount, selectedCharge.description, selectedCharge.guestId, selectedCharge.taxExempt);
                      return (
                        <>
                          {paymentData.amount < due && (
                            <div className="text-sm text-orange-600 mt-1">
                              ⚠️ Partial payment - Balance: ₵{formatMoney(due - paymentData.amount)}
                            </div>
                          )}
                          {paymentData.amount > due && (
                            <div className="text-sm text-green-600 mt-1">
                              💰 Overpayment - Change: ₵{formatMoney(paymentData.amount - due)}
                            </div>
                          )}
                        </>
                      );
                    })()}
                  <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2 items-end">
                    <Select label="Receipt Template" selectedKeys={[receiptTpl]} onSelectionChange={(keys)=> setReceiptTpl(Array.from(keys)[0] as string)}>
                      {receiptTemplates.map(t => (<SelectItem key={t.key}>{t.name}</SelectItem>))}
                    </Select>
                    <Button
                      variant="flat"
                      onPress={() => {
                        if (!selectedCharge) return;
                        const settings = useSettingsStore.getState();
                        const data = {
                          org: buildOrgProfile(settings),
                          guest: { name: selectedCharge.guestName, roomNumber: selectedCharge.roomNumber },
                          docNumber: settings.getNextReceiptNumber(),
                          docDate: new Date().toISOString(),
                          title: 'Receipt',
                          items: [ { description: `Payment for ${selectedCharge.description}`, amount: paymentData.amount, date: new Date().toISOString() } ],
                          totals: { subTotal: paymentData.amount, payments: paymentData.amount, balance: 0, grandTotal: paymentData.amount },
                          currency: '₵'
                        } as any;
                        try { openPrintPreview('receipt' as any, receiptTpl, data); } catch {}
                      }}
                    >
                      🧾 Print Receipt
                    </Button>
                  </div>
                  </div>
                </div>
              )}
            </ModalBody>
            <ModalFooter>
              <Button variant="light" onPress={() => setIsPaymentModalOpen(false)}>
                Cancel
              </Button>
              <Button 
                type="submit" 
                color="success" 
                className="bg-green-600 text-white"
                isDisabled={paymentData.amount <= 0}
              >
                💳 Process Payment
              </Button>
            </ModalFooter>
          </form>
        </ModalContent>
      </Modal>
    </div>
  );
}