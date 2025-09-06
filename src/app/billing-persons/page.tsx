'use client';

import React, { useState, useEffect } from 'react';
import { 
  Card, 
  CardBody, 
  CardHeader, 
  Button, 
  Badge, 
  Table, 
  TableHeader, 
  TableColumn, 
  TableBody, 
  TableRow, 
  TableCell,
  Input,
  Select,
  SelectItem,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
  Chip,
  Textarea,
  Tabs,
  Tab,
  Divider
} from "@heroui/react";
import { frontOfficeStore } from '../lib/frontoffice/store';
import { trackEvent } from '../lib/analytics/trackEvent';
import { BillingPerson, BillingRelationship } from '../lib/frontoffice/types';
import PageLayout from '../components/PageLayout';

interface BillingPersonFormData {
  name: string;
  phone?: string;
  email?: string;
  company?: string;
  position?: string;
  address?: string;
  city?: string;
  country?: string;
  taxId?: string;
  billingRelationship: BillingRelationship;
  isCorporateAccount: boolean;
  corporateAccountNumber?: string;
  paymentMethod?: 'cash' | 'card' | 'mobile_money' | 'bank_transfer' | 'corporate_billing';
  creditLimit?: number;
  paymentTerms?: string;
  notes?: string;
}

export default function BillingPersonsPage() {
  const [billingPersons, setBillingPersons] = useState<BillingPerson[]>([]);
  const [filteredBillingPersons, setFilteredBillingPersons] = useState<BillingPerson[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [relationshipFilter, setRelationshipFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [rowsPerPage] = useState(10);
  const [selectedBillingPerson, setSelectedBillingPerson] = useState<BillingPerson | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const { isOpen, onOpen, onClose } = useDisclosure();
  
  const [formData, setFormData] = useState<BillingPersonFormData>({
    name: '',
    phone: '',
    email: '',
    company: '',
    position: '',
    address: '',
    city: '',
    country: '',
    taxId: '',
    billingRelationship: 'company',
    isCorporateAccount: false,
    corporateAccountNumber: '',
    paymentMethod: 'bank_transfer',
    creditLimit: 0,
    paymentTerms: 'Immediate',
    notes: ''
  });

  useEffect(() => {
    loadBillingPersons();
    const unsubscribe = frontOfficeStore.subscribe(loadBillingPersons);
    return unsubscribe;
  }, []);

  useEffect(() => {
    filterBillingPersons();
  }, [billingPersons, searchTerm, relationshipFilter]);

  // Reset to first page whenever the filtered list changes size
  useEffect(() => {
    setPage(1);
  }, [filteredBillingPersons.length]);

  const loadBillingPersons = () => {
    setBillingPersons([...frontOfficeStore.billingPersons]);
  };

  const filterBillingPersons = () => {
    let filtered = billingPersons;

    if (searchTerm) {
      filtered = filtered.filter(bp => 
        bp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        bp.company?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        bp.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        bp.phone?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (relationshipFilter !== 'all') {
      filtered = filtered.filter(bp => bp.billingRelationship === relationshipFilter);
    }

    setFilteredBillingPersons(filtered);
  };

  const handleCreateBillingPerson = () => {
    setIsCreatingNew(true);
    setSelectedBillingPerson(null);
    setFormData({
      name: '',
      phone: '',
      email: '',
      company: '',
      position: '',
      address: '',
      city: '',
      country: '',
      taxId: '',
      billingRelationship: 'company',
      isCorporateAccount: false,
      corporateAccountNumber: '',
      paymentMethod: 'bank_transfer',
      creditLimit: 0,
      paymentTerms: 'Immediate',
      notes: ''
    });
    onOpen();
  };

  const handleEditBillingPerson = (billingPerson: BillingPerson) => {
    setSelectedBillingPerson(billingPerson);
    setIsCreatingNew(false);
    setFormData({
      name: billingPerson.name,
      phone: billingPerson.phone || '',
      email: billingPerson.email || '',
      company: billingPerson.company || '',
      position: billingPerson.position || '',
      address: billingPerson.address || '',
      city: billingPerson.city || '',
      country: billingPerson.country || '',
      taxId: billingPerson.taxId || '',
      billingRelationship: billingPerson.billingRelationship,
      isCorporateAccount: billingPerson.isCorporateAccount,
      corporateAccountNumber: billingPerson.corporateAccountNumber || '',
      paymentMethod: billingPerson.paymentMethod || 'bank_transfer',
      creditLimit: billingPerson.creditLimit || 0,
      paymentTerms: billingPerson.paymentTerms || 'Immediate',
      notes: billingPerson.notes || ''
    });
    onOpen();
  };

  const handleSaveBillingPerson = () => {
    if (!formData.name.trim()) {
      alert('Billing person name is required');
      return;
    }

    if (isCreatingNew) {
      const newBillingPerson = frontOfficeStore.createBillingPerson(formData);
      trackEvent('FO.BillingPerson.Created', {
        id: newBillingPerson.id,
        name: newBillingPerson.name,
        company: newBillingPerson.company,
        relationship: newBillingPerson.billingRelationship
      });
         } else if (selectedBillingPerson) {
       // Update existing billing person
       const updatedBillingPerson = {
         ...selectedBillingPerson,
         ...formData
       };
       
       // Update using store method
       frontOfficeStore.updateBillingPerson(updatedBillingPerson);
     }

    onClose();
    loadBillingPersons();
  };

  const handleDeleteBillingPerson = (billingPerson: BillingPerson) => {
    if (confirm(`Are you sure you want to delete ${billingPerson.name}? This action cannot be undone.`)) {
      frontOfficeStore.deleteBillingPerson(billingPerson.id);
      loadBillingPersons();
    }
  };

  const getRelationshipColor = (relationship: BillingRelationship) => {
    switch (relationship) {
      case 'corporate_account': return 'success';
      case 'company': return 'primary';
      case 'travel_agent': return 'secondary';
      case 'third_party': return 'warning';
      case 'self': return 'default';
      default: return 'default';
    }
  };

  const getRelationshipIcon = (relationship: BillingRelationship) => {
    switch (relationship) {
      case 'corporate_account': return '🏢';
      case 'company': return '💼';
      case 'travel_agent': return '✈️';
      case 'third_party': return '🤝';
      case 'self': return '👤';
      default: return '❓';
    }
  };

  const getPaymentMethodIcon = (method?: string) => {
    switch (method) {
      case 'cash': return '💵';
      case 'card': return '💳';
      case 'mobile_money': return '📱';
      case 'bank_transfer': return '🏦';
      case 'corporate_billing': return '📋';
      default: return '💰';
    }
  };

  return (
    <PageLayout>
      <div className="py-8 px-6">
        <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-ghana-black">💳 Billing Persons Management</h2>
          <p className="text-gray-600">Manage corporate accounts, travel agents, and third-party billers</p>
        </div>
        <div className="flex items-center space-x-4">
          <Button
            color="primary"
            variant="flat"
            onClick={handleCreateBillingPerson}
          >
            ➕ New Billing Person
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-0 shadow-lg">
          <CardBody className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Billing Persons</p>
                <p className="text-2xl font-bold text-ghana-black">{billingPersons.length}</p>
              </div>
              <span className="text-2xl">💳</span>
            </div>
          </CardBody>
        </Card>
        <Card className="border-0 shadow-lg">
          <CardBody className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Corporate Accounts</p>
                <p className="text-2xl font-bold text-green-600">
                  {billingPersons.filter(bp => bp.isCorporateAccount).length}
                </p>
              </div>
              <span className="text-2xl">🏢</span>
            </div>
          </CardBody>
        </Card>
        <Card className="border-0 shadow-lg">
          <CardBody className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Travel Agents</p>
                <p className="text-2xl font-bold text-blue-600">
                  {billingPersons.filter(bp => bp.billingRelationship === 'travel_agent').length}
                </p>
              </div>
              <span className="text-2xl">✈️</span>
            </div>
          </CardBody>
        </Card>
        <Card className="border-0 shadow-lg">
          <CardBody className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Companies</p>
                <p className="text-2xl font-bold text-purple-600">
                  {billingPersons.filter(bp => bp.billingRelationship === 'company').length}
                </p>
              </div>
              <span className="text-2xl">💼</span>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Filters */}
      <Card className="border-0 shadow-lg">
        <CardBody className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input
              placeholder="Search billing persons, companies, or emails..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              startContent={<span className="text-gray-400">🔍</span>}
            />
            <Select
              placeholder="Filter by relationship"
              value={relationshipFilter}
              onChange={(e) => setRelationshipFilter(e.target.value)}
            >
              <SelectItem key="all">All Relationships</SelectItem>
              <SelectItem key="corporate_account">🏢 Corporate Account</SelectItem>
              <SelectItem key="company">💼 Company</SelectItem>
              <SelectItem key="travel_agent">✈️ Travel Agent</SelectItem>
              <SelectItem key="third_party">🤝 Third Party</SelectItem>
              <SelectItem key="self">👤 Self</SelectItem>
            </Select>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">Filtered:</span>
              <Badge color="primary" variant="flat">{filteredBillingPersons.length}</Badge>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Billing Persons Table */}
      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-3">
          <h3 className="text-xl font-semibold text-ghana-black">Billing Persons</h3>
        </CardHeader>
        <CardBody className="p-0">
          <Table aria-label="Billing persons table">
            <TableHeader>
              <TableColumn>Name/Company</TableColumn>
              <TableColumn>Relationship</TableColumn>
              <TableColumn>Contact Info</TableColumn>
              <TableColumn>Payment Details</TableColumn>
              <TableColumn>Corporate Account</TableColumn>
              <TableColumn>Actions</TableColumn>
            </TableHeader>
            <TableBody>
              {filteredBillingPersons.map((billingPerson) => (
                <TableRow 
                  key={billingPerson.id}
                  className="cursor-pointer hover:bg-gray-50"
                  onClick={() => handleEditBillingPerson(billingPerson)}
                >
                  <TableCell>
                    <div className="max-w-[200px]">
                      <p className="font-medium text-ghana-black truncate">{billingPerson.name}</p>
                      {billingPerson.company && billingPerson.company !== billingPerson.name && (
                        <p className="text-xs text-gray-500 truncate">{billingPerson.company}</p>
                      )}
                      {billingPerson.position && (
                        <p className="text-xs text-gray-400">{billingPerson.position}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <span>{getRelationshipIcon(billingPerson.billingRelationship)}</span>
                      <Chip 
                        size="sm" 
                        variant="flat" 
                        color={getRelationshipColor(billingPerson.billingRelationship) as any}
                      >
                        {billingPerson.billingRelationship.replace('_', ' ')}
                      </Chip>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {billingPerson.phone && <p>📱 {billingPerson.phone}</p>}
                      {billingPerson.email && <p>📧 {billingPerson.email}</p>}
                      {billingPerson.city && <p>📍 {billingPerson.city}, {billingPerson.country || 'Ghana'}</p>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <div className="flex items-center space-x-1 mb-1">
                        <span>{getPaymentMethodIcon(billingPerson.paymentMethod)}</span>
                        <span className="text-xs">{billingPerson.paymentMethod?.replace('_', ' ')}</span>
                      </div>
                      {billingPerson.paymentTerms && (
                        <p className="text-xs text-gray-500">{billingPerson.paymentTerms}</p>
                      )}
                      {billingPerson.creditLimit && billingPerson.creditLimit > 0 && (
                        <p className="text-xs text-gray-500">Limit: ₵{billingPerson.creditLimit.toLocaleString()}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {billingPerson.isCorporateAccount ? (
                      <div className="text-center">
                        <Chip size="sm" variant="flat" color="success">✅ Active</Chip>
                        {billingPerson.corporateAccountNumber && (
                          <p className="text-xs text-gray-500 mt-1">{billingPerson.corporateAccountNumber}</p>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex space-x-1">
                      <Button
                        size="sm"
                        color="primary"
                        variant="flat"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditBillingPerson(billingPerson);
                        }}
                      >
                        ✏️ Edit
                      </Button>
                      <Button
                        size="sm"
                        color="danger"
                        variant="flat"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteBillingPerson(billingPerson);
                        }}
                      >
                        🗑️ Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardBody>
      </Card>

      {/* Billing Person Form Modal */}
      <Modal isOpen={isOpen} onClose={onClose} size="4xl">
        <ModalContent>
          <ModalHeader>
            {isCreatingNew ? 'Create New Billing Person' : 'Edit Billing Person'}
          </ModalHeader>
          <ModalBody>
            <Tabs aria-label="Billing person details">
              <Tab key="basic" title="👤 Basic Information">
                <div className="space-y-4 pt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                      <Input
                        value={formData.name}
                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                        placeholder="Full name or company name"
                        isRequired
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Company</label>
                      <Input
                        value={formData.company}
                        onChange={(e) => setFormData({...formData, company: e.target.value})}
                        placeholder="Company name (if different from person name)"
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                      <Input
                        value={formData.phone}
                        onChange={(e) => setFormData({...formData, phone: e.target.value})}
                        placeholder="Phone number"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                      <Input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({...formData, email: e.target.value})}
                        placeholder="Email address"
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Position</label>
                      <Input
                        value={formData.position}
                        onChange={(e) => setFormData({...formData, position: e.target.value})}
                        placeholder="Job title or position"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Tax ID</label>
                      <Input
                        value={formData.taxId}
                        onChange={(e) => setFormData({...formData, taxId: e.target.value})}
                        placeholder="Tax identification number"
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                      <Input
                        value={formData.city}
                        onChange={(e) => setFormData({...formData, city: e.target.value})}
                        placeholder="City"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
                      <Input
                        value={formData.country}
                        onChange={(e) => setFormData({...formData, country: e.target.value})}
                        placeholder="Country (defaults to Ghana)"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                    <Textarea
                      value={formData.address}
                      onChange={(e) => setFormData({...formData, address: e.target.value})}
                      placeholder="Full address"
                      rows={2}
                    />
                  </div>
                </div>
              </Tab>
              
              <Tab key="billing" title="💳 Billing Details">
                <div className="space-y-4 pt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Billing Relationship *</label>
                      <Select
                        value={formData.billingRelationship}
                        onChange={(e) => setFormData({...formData, billingRelationship: e.target.value as BillingRelationship})}
                        isRequired
                      >
                        <SelectItem key="corporate_account">🏢 Corporate Account</SelectItem>
                        <SelectItem key="company">💼 Company</SelectItem>
                        <SelectItem key="travel_agent">✈️ Travel Agent</SelectItem>
                        <SelectItem key="third_party">🤝 Third Party</SelectItem>
                        <SelectItem key="self">👤 Self</SelectItem>
                      </Select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
                      <Select
                        value={formData.paymentMethod}
                        onChange={(e) => setFormData({...formData, paymentMethod: e.target.value as any})}
                      >
                        <SelectItem key="cash">💵 Cash</SelectItem>
                        <SelectItem key="card">💳 Card</SelectItem>
                        <SelectItem key="mobile_money">📱 Mobile Money</SelectItem>
                        <SelectItem key="bank_transfer">🏦 Bank Transfer</SelectItem>
                        <SelectItem key="corporate_billing">📋 Corporate Billing</SelectItem>
                      </Select>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Payment Terms</label>
                      <Input
                        value={formData.paymentTerms}
                        onChange={(e) => setFormData({...formData, paymentTerms: e.target.value})}
                        placeholder="e.g., Net 30, Immediate"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Credit Limit (₵)</label>
                      <Input
                        type="number"
                        value={formData.creditLimit}
                        onChange={(e) => setFormData({...formData, creditLimit: parseFloat(e.target.value) || 0})}
                        placeholder="0 for no limit"
                      />
                    </div>
                  </div>
                  
                  <Divider />
                  
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="isCorporateAccount"
                      checked={formData.isCorporateAccount}
                      onChange={(e) => setFormData({...formData, isCorporateAccount: e.target.checked})}
                      className="rounded border-gray-300"
                    />
                    <label htmlFor="isCorporateAccount" className="text-sm font-medium text-gray-700">
                      This is a corporate account with special billing privileges
                    </label>
                  </div>
                  
                  {formData.isCorporateAccount && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Corporate Account Number</label>
                      <Input
                        value={formData.corporateAccountNumber}
                        onChange={(e) => setFormData({...formData, corporateAccountNumber: e.target.value})}
                        placeholder="e.g., CORP-001, ACC-2024"
                      />
                    </div>
                  )}
                </div>
              </Tab>
              
              <Tab key="notes" title="📝 Additional Notes">
                <div className="space-y-4 pt-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                    <Textarea
                      value={formData.notes}
                      onChange={(e) => setFormData({...formData, notes: e.target.value})}
                      placeholder="Additional notes, special instructions, or important information about this billing person"
                      rows={6}
                    />
                  </div>
                  
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                    <h4 className="font-medium text-blue-900 mb-2">💡 Usage Tips</h4>
                    <ul className="text-sm text-blue-700 space-y-1">
                      <li>• <strong>Corporate Accounts:</strong> Use for large companies with regular bookings</li>
                      <li>• <strong>Travel Agents:</strong> For external booking agencies and tour operators</li>
                      <li>• <strong>Third Party:</strong> When someone else is paying for the guest's stay</li>
                      <li>• <strong>Credit Limits:</strong> Set appropriate limits to manage financial risk</li>
                      <li>• <strong>Payment Terms:</strong> Define when payment is expected (Net 30, Immediate, etc.)</li>
                    </ul>
                  </div>
                </div>
              </Tab>
            </Tabs>
          </ModalBody>
          <ModalFooter>
            <Button color="primary" onClick={handleSaveBillingPerson}>
              {isCreatingNew ? '💾 Create Billing Person' : '💾 Update Billing Person'}
            </Button>
            <Button variant="light" onClick={onClose}>
              Cancel
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
        </div>
      </div>
    </PageLayout>
  );
}
