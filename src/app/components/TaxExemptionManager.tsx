'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardBody } from '@heroui/react';
import { Input } from '@heroui/react';
import { Button } from '@heroui/react';
import { Table, TableHeader, TableColumn, TableBody, TableRow, TableCell } from '@heroui/react';
import { Chip } from '@heroui/react';
import { Tooltip } from '@heroui/react';
import { Select, SelectItem } from '@heroui/react';
import { Textarea } from '@heroui/react';
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, useDisclosure } from '@heroui/react';
import { Tabs, Tab } from '@heroui/react';

interface TaxExemption {
  id: string;
  guestId?: string;
  guestName: string;
  guestType: 'individual' | 'corporate' | 'diplomatic' | 'government' | 'charity' | 'educational';
  exemptionType: string;
  exemptionReason: string;
  certificateNumber?: string;
  certificateExpiry: string;
  taxCategories: string[];
  exemptionPercentage: number;
  status: 'pending' | 'approved' | 'rejected' | 'expired' | 'suspended';
  approvedBy?: string;
  approvedDate?: string;
  rejectionReason?: string;
  notes?: string;
  documents: ExemptionDocument[];
  createdAt: string;
  updatedAt: string;
  lastUsed?: string;
  usageCount: number;
  totalTaxSaved: number;
}

interface ExemptionDocument {
  id: string;
  name: string;
  type: 'certificate' | 'letter' | 'contract' | 'other';
  url: string;
  uploadedAt: string;
  verified: boolean;
}

interface ExemptionTemplate {
  id: string;
  name: string;
  guestType: string;
  exemptionType: string;
  taxCategories: string[];
  exemptionPercentage: number;
  requirements: string[];
  validityPeriod: number; // in days
  isActive: boolean;
}

const EXEMPTION_TYPES = {
  individual: ['None', 'Senior Citizen', 'Student', 'Veteran', 'Disability'],
  corporate: ['Export Business', 'Manufacturing', 'Agriculture', 'Tourism Investment', 'Research & Development', 'Green Energy'],
  diplomatic: ['Diplomatic Mission', 'International Organization', 'Embassy Staff', 'Consular Staff'],
  government: ['Government Contract', 'Public Service', 'Development Project', 'Infrastructure', 'Healthcare'],
  charity: ['Non-Profit Organization', 'Religious Institution', 'Community Service', 'Humanitarian Aid'],
  educational: ['Educational Institution', 'Research Organization', 'Training Center', 'Library']
};

const TAX_CATEGORIES = [
  'VAT (Standard Rate)',
  'NHIL',
  'GETFund Levy', 
  'Tourism Levy',
  'Withholding Tax',
  'Corporate Tax',
  'Import Duty'
];

const EXEMPTION_TEMPLATES: ExemptionTemplate[] = [
  {
    id: 'template-1',
    name: 'Export Business Standard',
    guestType: 'corporate',
    exemptionType: 'Export Business',
    taxCategories: ['VAT (Standard Rate)', 'NHIL', 'GETFund Levy'],
    exemptionPercentage: 100,
    requirements: ['Export License', 'Business Registration', 'Tax Clearance'],
    validityPeriod: 365,
    isActive: true
  },
  {
    id: 'template-2',
    name: 'Diplomatic Mission Full',
    guestType: 'diplomatic',
    exemptionType: 'Diplomatic Mission',
    taxCategories: ['VAT (Standard Rate)', 'NHIL', 'GETFund Levy', 'Tourism Levy'],
    exemptionPercentage: 100,
    requirements: ['Diplomatic ID', 'Mission Letter', 'Country Accreditation'],
    validityPeriod: 1095,
    isActive: true
  },
  {
    id: 'template-3',
    name: 'Government Contract Partial',
    guestType: 'government',
    exemptionType: 'Government Contract',
    taxCategories: ['Tourism Levy'],
    exemptionPercentage: 100,
    requirements: ['Contract Document', 'Government ID', 'Project Authorization'],
    validityPeriod: 730,
    isActive: true
  }
];

export default function TaxExemptionManager() {
  const [exemptions, setExemptions] = useState<TaxExemption[]>([]);
  const [templates] = useState<ExemptionTemplate[]>(EXEMPTION_TEMPLATES);
  const [selectedExemption, setSelectedExemption] = useState<TaxExemption | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isApprovalModalOpen, setIsApprovalModalOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterGuestType, setFilterGuestType] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const { isOpen, onOpen, onClose } = useDisclosure();

  const [newExemption, setNewExemption] = useState({
    guestName: '',
    guestType: 'corporate' as const,
    exemptionType: '',
    exemptionReason: '',
    certificateNumber: '',
    certificateExpiry: '',
    taxCategories: [] as string[],
    exemptionPercentage: 100,
    notes: ''
  });

  useEffect(() => {
    // Initialize with sample data
    const sampleExemptions: TaxExemption[] = [
      {
        id: 'ex-1',
        guestName: 'Ghana Export Corporation',
        guestType: 'corporate',
        exemptionType: 'Export Business',
        exemptionReason: 'Export of agricultural products',
        certificateNumber: 'EXP-2024-001',
        certificateExpiry: '2025-12-31',
        taxCategories: ['VAT (Standard Rate)', 'NHIL', 'GETFund Levy'],
        exemptionPercentage: 100,
        status: 'approved',
        approvedBy: 'Tax Officer John Doe',
        approvedDate: '2024-01-15',
        notes: 'Valid export business with proper documentation',
        documents: [
          {
            id: 'doc-1',
            name: 'Export License 2024',
            type: 'certificate',
            url: '/documents/export-license.pdf',
            uploadedAt: '2024-01-10',
            verified: true
          }
        ],
        createdAt: '2024-01-10',
        updatedAt: '2024-01-15',
        lastUsed: '2024-01-20',
        usageCount: 5,
        totalTaxSaved: 2500.00
      },
      {
        id: 'ex-2',
        guestName: 'US Embassy Accra',
        guestType: 'diplomatic',
        exemptionType: 'Diplomatic Mission',
        exemptionReason: 'Official diplomatic activities',
        certificateNumber: 'DIP-2024-002',
        certificateExpiry: '2027-01-31',
        taxCategories: ['VAT (Standard Rate)', 'NHIL', 'GETFund Levy', 'Tourism Levy'],
        exemptionPercentage: 100,
        status: 'approved',
        approvedBy: 'Senior Tax Officer Jane Smith',
        approvedDate: '2024-01-20',
        notes: 'Full diplomatic immunity confirmed',
        documents: [
          {
            id: 'doc-2',
            name: 'Diplomatic ID Card',
            type: 'certificate',
            url: '/documents/diplomatic-id.pdf',
            uploadedAt: '2024-01-18',
            verified: true
          }
        ],
        createdAt: '2024-01-18',
        updatedAt: '2024-01-20',
        lastUsed: '2024-01-25',
        usageCount: 12,
        totalTaxSaved: 8500.00
      }
    ];
    setExemptions(sampleExemptions);
  }, []);

  const handleAddExemption = () => {
    if (!newExemption.guestName || !newExemption.exemptionType || !newExemption.taxCategories.length) {
      return;
    }

    const exemption: TaxExemption = {
      id: `ex-${Date.now()}`,
      guestName: newExemption.guestName,
      guestType: newExemption.guestType,
      exemptionType: newExemption.exemptionType,
      exemptionReason: newExemption.exemptionReason,
      certificateNumber: newExemption.certificateNumber,
      certificateExpiry: newExemption.certificateExpiry,
      taxCategories: newExemption.taxCategories,
      exemptionPercentage: newExemption.exemptionPercentage,
      status: 'pending',
      notes: newExemption.notes,
      documents: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      usageCount: 0,
      totalTaxSaved: 0
    };

    setExemptions(prev => [...prev, exemption]);
    setNewExemption({
      guestName: '',
      guestType: 'corporate',
      exemptionType: '',
      exemptionReason: '',
      certificateNumber: '',
      certificateExpiry: '',
      taxCategories: [],
      exemptionPercentage: 100,
      notes: ''
    });
    setIsAddModalOpen(false);
  };

  const handleStatusChange = (exemptionId: string, newStatus: TaxExemption['status'], notes?: string) => {
    setExemptions(prev => prev.map(ex => {
      if (ex.id === exemptionId) {
        return {
          ...ex,
          status: newStatus,
          approvedBy: newStatus === 'approved' ? 'Current User' : ex.approvedBy,
          approvedDate: newStatus === 'approved' ? new Date().toISOString() : ex.approvedDate,
          rejectionReason: newStatus === 'rejected' ? notes : undefined,
          updatedAt: new Date().toISOString()
        };
      }
      return ex;
    }));
    setIsApprovalModalOpen(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'success';
      case 'pending': return 'warning';
      case 'rejected': return 'danger';
      case 'expired': return 'secondary';
      case 'suspended': return 'default';
      default: return 'default';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved': return '✅';
      case 'pending': return '⏳';
      case 'rejected': return '❌';
      case 'expired': return '⏰';
      case 'suspended': return '⏸️';
      default: return '❓';
    }
  };

  const filteredExemptions = exemptions.filter(exemption => {
    const matchesStatus = filterStatus === 'all' || exemption.status === filterStatus;
    const matchesGuestType = filterGuestType === 'all' || exemption.guestType === filterGuestType;
    const matchesSearch = exemption.guestName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         exemption.certificateNumber?.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesStatus && matchesGuestType && matchesSearch;
  });

  const getExemptionTypeOptions = (guestType: string) => {
    return EXEMPTION_TYPES[guestType as keyof typeof EXEMPTION_TYPES] || [];
  };

  const handleTemplateSelect = (template: ExemptionTemplate) => {
    setNewExemption(prev => ({
      ...prev,
      guestType: template.guestType as any,
      exemptionType: template.exemptionType,
      taxCategories: template.taxCategories,
      exemptionPercentage: template.exemptionPercentage
    }));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="bg-gradient-to-r from-green-50 to-emerald-50">
        <CardHeader>
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Tax Exemption Manager</h2>
            <p className="text-gray-600">Manage tax exemptions, certificates, and approval workflows</p>
          </div>
        </CardHeader>
      </Card>

      {/* Filters and Search */}
      <Card>
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Input
              label="Search"
              placeholder="Search by name or certificate number"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              startContent="🔍"
            />
            
            <Select
              label="Status"
              selectedKeys={[filterStatus]}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <SelectItem key="all">All Statuses</SelectItem>
              <SelectItem key="pending">Pending</SelectItem>
              <SelectItem key="approved">Approved</SelectItem>
              <SelectItem key="rejected">Rejected</SelectItem>
              <SelectItem key="expired">Expired</SelectItem>
              <SelectItem key="suspended">Suspended</SelectItem>
            </Select>

            <Select
              label="Guest Type"
              selectedKeys={[filterGuestType]}
              onChange={(e) => setFilterGuestType(e.target.value)}
            >
              <SelectItem key="all">All Types</SelectItem>
              <SelectItem key="individual">Individual</SelectItem>
              <SelectItem key="corporate">Corporate</SelectItem>
              <SelectItem key="diplomatic">Diplomatic</SelectItem>
              <SelectItem key="government">Government</SelectItem>
              <SelectItem key="charity">Charity</SelectItem>
              <SelectItem key="educational">Educational</SelectItem>
            </Select>

            <div className="flex items-end">
              <Button
                color="primary"
                onClick={() => setIsAddModalOpen(true)}
                className="w-full"
              >
                Add Exemption
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Exemptions Table */}
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">Tax Exemptions</h3>
        </CardHeader>
        <CardBody>
          <Table aria-label="Tax exemptions">
            <TableHeader>
              <TableColumn>Guest</TableColumn>
              <TableColumn>Type & Reason</TableColumn>
              <TableColumn>Tax Categories</TableColumn>
              <TableColumn>Status</TableColumn>
              <TableColumn>Certificate</TableColumn>
              <TableColumn>Usage & Savings</TableColumn>
              <TableColumn>Actions</TableColumn>
            </TableHeader>
            <TableBody>
              {filteredExemptions.map((exemption) => (
                <TableRow key={exemption.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{exemption.guestName}</div>
                      <div className="text-sm text-gray-500 capitalize">{exemption.guestType}</div>
                    </div>
                  </TableCell>
                  
                  <TableCell>
                    <div>
                      <div className="font-medium">{exemption.exemptionType}</div>
                      <div className="text-sm text-gray-500">{exemption.exemptionReason}</div>
                    </div>
                  </TableCell>
                  
                  <TableCell>
                    <div className="space-y-1">
                      {exemption.taxCategories.map((category, index) => (
                        <Chip key={index} size="sm" variant="flat" color="primary">
                          {category}
                        </Chip>
                      ))}
                    </div>
                  </TableCell>
                  
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{getStatusIcon(exemption.status)}</span>
                      <Chip
                        size="sm"
                        color={getStatusColor(exemption.status)}
                        variant="flat"
                      >
                        {exemption.status}
                      </Chip>
                    </div>
                    {exemption.approvedBy && (
                      <div className="text-xs text-gray-500 mt-1">
                        by {exemption.approvedBy}
                      </div>
                    )}
                  </TableCell>
                  
                  <TableCell>
                    <div>
                      <div className="font-mono text-sm">{exemption.certificateNumber}</div>
                      <div className="text-xs text-gray-500">
                        Expires: {new Date(exemption.certificateExpiry).toLocaleDateString()}
                      </div>
                    </div>
                  </TableCell>
                  
                  <TableCell>
                    <div className="text-right">
                      <div className="text-sm font-medium">{exemption.usageCount} uses</div>
                      <div className="text-xs text-green-600">
                        Saved: ₵{exemption.totalTaxSaved.toFixed(2)}
                      </div>
                      {exemption.lastUsed && (
                        <div className="text-xs text-gray-500">
                          Last: {new Date(exemption.lastUsed).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  
                  <TableCell>
                    <div className="flex gap-2">
                      <Tooltip content="View details">
                        <Button
                          size="sm"
                          variant="light"
                          onClick={() => {
                            setSelectedExemption(exemption);
                            setIsViewModalOpen(true);
                          }}
                        >
                          👁️
                        </Button>
                      </Tooltip>
                      
                      {exemption.status === 'pending' && (
                        <Tooltip content="Approve/Reject">
                          <Button
                            size="sm"
                            variant="light"
                            onClick={() => {
                              setSelectedExemption(exemption);
                              setIsApprovalModalOpen(true);
                            }}
                          >
                            ✅
                          </Button>
                        </Tooltip>
                      )}
                      
                      <Tooltip content="Edit">
                        <Button
                          size="sm"
                          variant="light"
                          onClick={() => {
                            setSelectedExemption(exemption);
                            setIsEditModalOpen(true);
                          }}
                        >
                          ✏️
                        </Button>
                      </Tooltip>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardBody>
      </Card>

      {/* Add Exemption Modal */}
      <Modal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} size="3xl">
        <ModalContent>
          <ModalHeader>Add New Tax Exemption</ModalHeader>
          <ModalBody>
            <Tabs aria-label="Exemption creation">
              <Tab key="manual" title="Manual Entry">
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input
                      label="Guest Name"
                      value={newExemption.guestName}
                      onChange={(e) => setNewExemption(prev => ({ ...prev, guestName: e.target.value }))}
                      placeholder="Enter guest or organization name"
                    />
                    
                    <Select
                      label="Guest Type"
                      selectedKeys={[newExemption.guestType]}
                      onChange={(e) => setNewExemption(prev => ({ ...prev, guestType: e.target.value as any }))}
                    >
                      {Object.keys(EXEMPTION_TYPES).map((type) => (
                        <SelectItem key={type}>
                          {type.charAt(0).toUpperCase() + type.slice(1)}
                        </SelectItem>
                      ))}
                    </Select>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Select
                      label="Exemption Type"
                      selectedKeys={[newExemption.exemptionType]}
                      onChange={(e) => setNewExemption(prev => ({ ...prev, exemptionType: e.target.value }))}
                      placeholder="Select exemption type"
                    >
                      {getExemptionTypeOptions(newExemption.guestType).map((type) => (
                        <SelectItem key={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </Select>
                    
                    <Input
                      label="Certificate Number (Optional)"
                      value={newExemption.certificateNumber}
                      onChange={(e) => setNewExemption(prev => ({ ...prev, certificateNumber: e.target.value }))}
                      placeholder="e.g., EXP-2024-001"
                    />
                  </div>

                  <Input
                    label="Exemption Reason"
                    value={newExemption.exemptionReason}
                    onChange={(e) => setNewExemption(prev => ({ ...prev, exemptionReason: e.target.value }))}
                    placeholder="Describe the reason for exemption"
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input
                      label="Certificate Expiry Date"
                      type="date"
                      value={newExemption.certificateExpiry}
                      onChange={(e) => setNewExemption(prev => ({ ...prev, certificateExpiry: e.target.value }))}
                    />
                    
                    <Input
                      label="Exemption Percentage"
                      type="number"
                      min="0"
                      max="100"
                      value={String(newExemption.exemptionPercentage)}
                      onChange={(e) => setNewExemption(prev => ({ ...prev, exemptionPercentage: Number(e.target.value) }))}
                      endContent="%"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium">Tax Categories</label>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">
                      {TAX_CATEGORIES.map((category) => (
                        <label key={category} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={newExemption.taxCategories.includes(category)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setNewExemption(prev => ({
                                  ...prev,
                                  taxCategories: [...prev.taxCategories, category]
                                }));
                              } else {
                                setNewExemption(prev => ({
                                  ...prev,
                                  taxCategories: prev.taxCategories.filter(c => c !== category)
                                }));
                              }
                            }}
                          />
                          <span className="text-sm">{category}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <Textarea
                    label="Notes"
                    value={newExemption.notes}
                    onChange={(e) => setNewExemption(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Additional notes or requirements"
                  />
                </div>
              </Tab>
              
              <Tab key="templates" title="Use Template">
                <div className="space-y-4">
                  <p className="text-sm text-gray-600">Select a pre-configured exemption template:</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {templates.map((template) => (
                      <Card
                        key={template.id}
                        className={`cursor-pointer transition-all ${
                          newExemption.exemptionType === template.exemptionType ? 'ring-2 ring-blue-500' : ''
                        }`}
                        onClick={() => handleTemplateSelect(template)}
                      >
                        <CardBody className="p-4">
                          <h4 className="font-medium">{template.name}</h4>
                          <p className="text-sm text-gray-600">{template.exemptionType}</p>
                          <div className="mt-2">
                            <Chip size="sm" color="primary" variant="flat">
                              {template.exemptionPercentage}% exemption
                            </Chip>
                          </div>
                          <div className="mt-2 text-xs text-gray-500">
                            <p><strong>Requirements:</strong></p>
                            <ul className="list-disc list-inside">
                              {template.requirements.map((req, index) => (
                                <li key={index}>{req}</li>
                              ))}
                            </ul>
                          </div>
                        </CardBody>
                      </Card>
                    ))}
                  </div>
                </div>
              </Tab>
            </Tabs>
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={() => setIsAddModalOpen(false)}>
              Cancel
            </Button>
            <Button color="primary" onPress={handleAddExemption}>
              Create Exemption
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* View Exemption Modal */}
      <Modal isOpen={isViewModalOpen} onClose={() => setIsViewModalOpen(false)} size="2xl">
        <ModalContent>
          <ModalHeader>Exemption Details</ModalHeader>
          <ModalBody>
            {selectedExemption && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-600">Guest Name</label>
                    <p className="font-medium">{selectedExemption.guestName}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">Guest Type</label>
                    <p className="capitalize">{selectedExemption.guestType}</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-600">Exemption Type</label>
                    <p className="font-medium">{selectedExemption.exemptionType}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">Status</label>
                    <Chip color={getStatusColor(selectedExemption.status)} variant="flat">
                      {selectedExemption.status}
                    </Chip>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-600">Tax Categories</label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {selectedExemption.taxCategories.map((category, index) => (
                      <Chip key={index} size="sm" variant="flat" color="primary">
                        {category}
                      </Chip>
                    ))}
                  </div>
                </div>

                {selectedExemption.documents.length > 0 && (
                  <div>
                    <label className="text-sm font-medium text-gray-600">Documents</label>
                    <div className="space-y-2 mt-1">
                      {selectedExemption.documents.map((doc) => (
                        <div key={doc.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                          <div className="flex items-center gap-2">
                            <span>{doc.type === 'certificate' ? '📄' : '📎'}</span>
                            <span className="text-sm">{doc.name}</span>
                          </div>
                          <Chip size="sm" color={doc.verified ? 'success' : 'warning'} variant="flat">
                            {doc.verified ? 'Verified' : 'Pending'}
                          </Chip>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                  <div className="p-3 bg-blue-50 rounded">
                    <div className="text-lg font-bold text-blue-600">{selectedExemption.usageCount}</div>
                    <div className="text-sm text-gray-600">Times Used</div>
                  </div>
                  <div className="p-3 bg-green-50 rounded">
                    <div className="text-lg font-bold text-green-600">₵{selectedExemption.totalTaxSaved.toFixed(2)}</div>
                    <div className="text-sm text-gray-600">Total Tax Saved</div>
                  </div>
                  <div className="p-3 bg-orange-50 rounded">
                    <div className="text-lg font-bold text-orange-600">{selectedExemption.exemptionPercentage}%</div>
                    <div className="text-sm text-gray-600">Exemption Rate</div>
                  </div>
                </div>
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

      {/* Approval Modal */}
      <Modal isOpen={isApprovalModalOpen} onClose={() => setIsApprovalModalOpen(false)}>
        <ModalContent>
          <ModalHeader>Approve/Reject Exemption</ModalHeader>
          <ModalBody>
            {selectedExemption && (
              <div className="space-y-4">
                <p>Review exemption for <strong>{selectedExemption.guestName}</strong></p>
                <div className="p-3 bg-gray-50 rounded">
                  <p><strong>Type:</strong> {selectedExemption.exemptionType}</p>
                  <p><strong>Reason:</strong> {selectedExemption.exemptionReason}</p>
                </div>
                
                <div className="flex gap-2">
                  <Button
                    color="success"
                    onClick={() => handleStatusChange(selectedExemption.id, 'approved')}
                    className="flex-1"
                  >
                    ✅ Approve
                  </Button>
                  <Button
                    color="danger"
                    onClick={() => {
                      const reason = prompt('Enter rejection reason:');
                      if (reason) {
                        handleStatusChange(selectedExemption.id, 'rejected', reason);
                      }
                    }}
                    className="flex-1"
                  >
                    ❌ Reject
                  </Button>
                </div>
              </div>
            )}
          </ModalBody>
        </ModalContent>
      </Modal>
    </div>
  );
}
