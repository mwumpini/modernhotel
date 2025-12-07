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
  useDisclosure,
  Badge,
  Chip,
  Textarea,
  Divider,
  Pagination
} from "@heroui/react";
import { frontOfficeStore } from '../../lib/frontoffice/store';
import { useSettingsStore } from '../../lib/settings/store';
import { trackEvent } from '../../lib/analytics/trackEvent';
import { openPrintPreview } from '../../lib/print/engine';
import { listTemplates } from '../../lib/print/templates';

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
}

export default function ServiceChargesPage() {
  const { roomManagement } = useSettingsStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
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
    customerType: 'inhouse' // 'inhouse' or 'external'
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

  // Get available guests (checked-in only)
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
  }, []);

  // Mock service charges data (in real app, this would come from a store)
  const [serviceCharges, setServiceCharges] = useState<ServiceCharge[]>([]);

  // Get categories from settings
  const categories = useMemo(() => {
    const uniqueCategories = [...new Set(serviceChargesConfig.map(charge => charge.category))];
    return uniqueCategories.sort();
  }, [serviceChargesConfig]);

  // Filtered charges
  const filteredCharges = useMemo(() => {
    return serviceCharges.filter(charge => {
      const matchesSearch = charge.guestName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           charge.roomNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           charge.description.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || charge.status === statusFilter;
      const matchesCategory = categoryFilter === 'all' || charge.category === categoryFilter;
      return matchesSearch && matchesStatus && matchesCategory;
    });
  }, [serviceCharges, searchTerm, statusFilter, categoryFilter]);

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
      createdBy: 'Current User' // In real app, get from auth context
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
          finalAmount
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

    // Reset form and close modal
    setFormData({
      guestId: '',
      roomNumber: '',
      category: '',
      description: '',
      amount: 0,
      quantity: 1,
      discountAmount: 0,
      notes: '',
      customerType: 'inhouse'
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
        const folio = frontOfficeStore.getOrCreateFolio(reservation.id);
        const payment = {
          id: `payment-${Date.now()}-${Math.random()}`,
          amount: paymentData.amount,
          method: paymentData.paymentMethod as 'Cash' | 'Bank Transfer' | 'Mobile Money' | 'Check' | 'Corporate Account' | 'Credit' | 'Card',
          date: new Date().toISOString(),
          reference: paymentData.reference,
          description: `Payment for ${selectedCharge.description}`,
          processedBy: 'Current User',
          status: 'completed' as const
        };
        
        // Update folio payments array
        const updatedFolio = {
          ...folio,
          payments: [...(folio.payments || []), payment]
        };
        frontOfficeStore.updateFolioBalances(updatedFolio);
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
      amount: charge.amount
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
          <Button 
            color="primary" 
            onClick={() => setIsAddModalOpen(true)}
            className="bg-ghana-gold text-white"
          >
            ➕ Add Service Charge
          </Button>
          <Button 
            color="secondary" 
            variant="flat"
            onClick={() => alert('Service charge pricing is managed in Settings > Rate Management')}
          >
            ⚙️ Manage Pricing
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardBody>
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
        </CardBody>
      </Card>

      {/* Payment Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardBody className="text-center">
            <div className="text-2xl font-bold text-blue-600">
              ₵{serviceCharges.reduce((sum, charge) => sum + charge.amount, 0).toLocaleString()}
            </div>
            <div className="text-sm text-gray-600">Total Charges</div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="text-center">
            <div className="text-2xl font-bold text-green-600">
              ₵{serviceCharges.filter(c => c.status === 'paid').reduce((sum, charge) => sum + charge.amount, 0).toLocaleString()}
            </div>
            <div className="text-sm text-gray-600">Paid Amount</div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="text-center">
            <div className="text-2xl font-bold text-orange-600">
              ₵{serviceCharges.filter(c => c.status !== 'paid').reduce((sum, charge) => sum + charge.amount, 0).toLocaleString()}
            </div>
            <div className="text-sm text-gray-600">Outstanding</div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="text-center">
            <div className="text-2xl font-bold text-purple-600">
              {serviceCharges.filter(c => c.status === 'paid').length}/{serviceCharges.length}
            </div>
            <div className="text-sm text-gray-600">Paid/Total</div>
          </CardBody>
        </Card>
      </div>

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
            <TableBody>
              {filteredCharges.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-gray-500 py-8">
                    No service charges found
                  </TableCell>
                </TableRow>
              ) : (
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
                        <div className="font-semibold">₵{(charge.amount * charge.quantity).toLocaleString()}</div>
                      </TableCell>
                      <TableCell>
                        <Badge color={getStatusColor(charge.status)} variant="flat">
                          {charge.status.toUpperCase()}
                        </Badge>
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
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="flat"
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
                              variant="flat"
                              onClick={() => handlePaymentClick(charge)}
                            >
                              💳 Pay
                            </Button>
                          )}
                          <Button
                            size="sm"
                            color="primary"
                            variant="flat"
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
                  value={formData.guestId}
                  onChange={(e) => handleGuestSelect(e.target.value)}
                  isRequired
                >
                  {availableGuests.map(guest => (
                    <SelectItem key={guest.guestId}>
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
                value={formData.category}
                onChange={(e) => handleCategorySelect(e.target.value)}
                isRequired
              >
                {serviceChargesConfig.map(category => (
                  <SelectItem key={category.id}>
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
      <Modal isOpen={isViewModalOpen} onClose={() => setIsViewModalOpen(false)} size="lg">
        <ModalContent>
          <ModalHeader>Service Charge Details</ModalHeader>
          <ModalBody>
            {selectedCharge ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Customer Name</label>
                    <div className="text-lg font-semibold">{selectedCharge.guestName}</div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Customer Type</label>
                    <div className="text-lg font-semibold">
                      <Badge 
                        color={selectedCharge.roomNumber === 'External' ? 'secondary' : 'primary'} 
                        variant="flat"
                      >
                        {selectedCharge.roomNumber === 'External' ? 'External Customer' : 'In-House Guest'}
                      </Badge>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Room/Reference</label>
                    <div className="text-lg font-semibold">
                      {selectedCharge.roomNumber === 'External' ? 'External Service' : `Room ${selectedCharge.roomNumber}`}
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Status</label>
                    <Badge color={getStatusColor(selectedCharge.status)} variant="flat">
                      {selectedCharge.status.toUpperCase()}
                    </Badge>
                  </div>
                </div>

                <Divider />

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Category</label>
                    <div className="flex items-center gap-2">
                      <span>{getCategoryInfo(selectedCharge.category).icon}</span>
                      <span>{getCategoryInfo(selectedCharge.category).name}</span>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Description</label>
                    <div className="text-lg">{selectedCharge.description}</div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Unit Price</label>
                    <div className="text-lg font-semibold">₵{selectedCharge.amount.toLocaleString()}</div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Quantity</label>
                    <div className="text-lg font-semibold">{selectedCharge.quantity}</div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Total Amount</label>
                    <div className="text-lg font-semibold text-ghana-gold">
                      ₵{(selectedCharge.amount * selectedCharge.quantity).toLocaleString()}
                    </div>
                  </div>
                </div>

                {selectedCharge.notes && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Notes</label>
                    <div className="text-lg">{selectedCharge.notes}</div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Created By</label>
                    <div className="text-lg">{selectedCharge.createdBy}</div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Date Created</label>
                    <div className="text-lg">
                      {new Date(selectedCharge.date).toLocaleDateString()} at{' '}
                      {new Date(selectedCharge.date).toLocaleTimeString()}
                    </div>
                  </div>
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
                        <span className="text-gray-600">Amount:</span>
                        <div className="font-medium text-lg text-ghana-gold">
                          ₵{selectedCharge.amount.toLocaleString()}
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
                    {paymentData.amount < selectedCharge.amount && (
                      <div className="text-sm text-orange-600 mt-1">
                        ⚠️ Partial payment - Balance: ₵{(selectedCharge.amount - paymentData.amount).toLocaleString()}
                      </div>
                    )}
                    {paymentData.amount > selectedCharge.amount && (
                      <div className="text-sm text-green-600 mt-1">
                        💰 Overpayment - Change: ₵{(paymentData.amount - selectedCharge.amount).toLocaleString()}
                      </div>
                    )}
                  <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2 items-end">
                    <Select label="Receipt Template" selectedKeys={[receiptTpl]} onSelectionChange={(keys)=> setReceiptTpl(Array.from(keys)[0] as string)}>
                      {receiptTemplates.map(t => (<SelectItem key={t.key}>{t.name}</SelectItem>))}
                    </Select>
                    <Button
                      variant="flat"
                      onPress={() => {
                        if (!selectedCharge) return;
                        const data = {
                          org: { name: 'Hotel', address: '', phone: '', email: '' },
                          guest: { name: selectedCharge.guestName, roomNumber: selectedCharge.roomNumber },
                          docNumber: `RCPT-${Date.now()}`,
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